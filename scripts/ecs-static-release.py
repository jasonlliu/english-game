#!/usr/bin/env python3
"""Versioned static releases for this project's existing, authenticated ECS site.

Compatible with the host's Python 3.6. No packages, secrets, application processes
or databases are installed or changed. The shared asset pool preserves old lazy
chunks for already-open games; cleanup is a separate, deliberate operation.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime

ROOT = Path('/opt/english-game')
NGINX_CONFIG = Path('/etc/nginx/conf.d/bigdream.conf')
NGINX_LOCATIONS = Path('/etc/nginx/english-game.locations.conf')
INCLUDE = '  include /etc/nginx/english-game.locations.conf;\n'
ANCHOR = '  location / {\n    proxy_pass http://127.0.0.1:3001;'
SHA = re.compile(r'^[a-f0-9]{64}$')
RELEASE = re.compile(r'^[a-z0-9][a-z0-9-]{0,79}$')
SITE_FILE = re.compile(r'^site/(?:index\.html|favicon\.svg|release\.json|assets/[A-Za-z0-9_.-]+)$')
LOCATIONS = '''# Managed by english-game; independent access settings live outside versioned releases.
location = /english-game { return 308 /english-game/$is_args$args; }
location = /english-game/ {
  include /etc/nginx/english-game-auth.conf;
  alias /opt/english-game/app/site/;
  index index.html;
  add_header Cache-Control "no-cache" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
}
location = /english-game/index.html {
  include /etc/nginx/english-game-auth.conf;
  alias /opt/english-game/app/site/index.html;
  add_header Cache-Control "no-cache" always;
  add_header X-Content-Type-Options nosniff always;
}
location = /english-game/favicon.svg {
  include /etc/nginx/english-game-auth.conf;
  alias /opt/english-game/app/site/favicon.svg;
  add_header Cache-Control "no-cache" always;
  add_header X-Content-Type-Options nosniff always;
}
location = /english-game/release.json {
  include /etc/nginx/english-game-auth.conf;
  alias /opt/english-game/app/site/release.json;
  add_header Cache-Control "no-cache" always;
  add_header X-Content-Type-Options nosniff always;
}
location ^~ /english-game/assets/ {
  include /etc/nginx/english-game-auth.conf;
  alias /opt/english-game/shared/assets/;
  add_header Cache-Control "public, max-age=31536000, immutable";
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
}
location ^~ /english-game/ { return 404; }
'''
# The first staging template used a file alias on a directory URI; nginx's
# index module appended index.html again. Only that alias variation with the
# current independent auth may be upgraded; shared auth/local edits are rejected.
LEGACY_LOCATIONS = LOCATIONS.replace(
    '  alias /opt/english-game/app/site/;\n  index index.html;',
    '  alias /opt/english-game/app/site/index.html;', 1)


def check(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(path, data):
    temporary = path.with_name(path.name + '.pending-' + str(os.getpid()))
    with temporary.open('wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(str(temporary), 0o644)
    os.replace(str(temporary), str(path))


def deployment(release):
    check(RELEASE.fullmatch(release), 'Invalid release ID')
    return ROOT / 'deployments' / release


def state(release, phase, **extra):
    record = dict(release=release, phase=phase, updatedAt=datetime.utcnow().isoformat() + 'Z', **extra)
    atomic_write(deployment(release) / 'status.json', (json.dumps(record, indent=2) + '\n').encode())
    return record


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    check(result.returncode == 0, 'Command failed: ' + args[0])
    return result.stdout.decode().strip()


def validate_archive(archive, expected_sha, release):
    check(SHA.fullmatch(expected_sha), 'Invalid archive SHA256')
    check(archive.stat().st_size <= 30 * 1024 * 1024, 'Archive exceeds 30 MiB')
    check(digest(archive.read_bytes()) == expected_sha, 'Archive SHA256 mismatch')
    with tarfile.open(str(archive), 'r:gz') as package:
        members = package.getmembers()
        check(len(members) <= 2000, 'Too many archive members')
        names = set()
        total = 0
        for item in members:
            check(item.name not in names, 'Duplicate archive member')
            names.add(item.name)
            check(item.isfile() or item.isdir(), 'Links and special files are not allowed')
            if item.isdir():
                check(item.name in ('site', 'site/assets'), 'Unexpected directory')
            else:
                check(item.name == 'manifest.json' or SITE_FILE.fullmatch(item.name), 'Unexpected file path')
                total += item.size
                check(item.size >= 0 and total <= 30 * 1024 * 1024, 'Expanded archive exceeds limit')
        check('manifest.json' in names, 'Missing manifest')
        manifest = json.load(package.extractfile('manifest.json'))
        check(manifest.get('version') == 1 and manifest.get('release') == release, 'Wrong manifest identity')
        source = manifest.get('source', {})
        check(isinstance(source, dict) and SHA.fullmatch(source.get('sha256', '')), 'Missing source fingerprint')
        check(isinstance(manifest.get('files'), list), 'Missing file inventory')
        files = {}
        for entry in manifest['files']:
            name = entry['path']
            check(SITE_FILE.fullmatch(name) and name not in files, 'Invalid manifest path')
            check(SHA.fullmatch(entry['sha256']), 'Invalid file SHA256')
            check(isinstance(entry['size'], int) and entry['size'] >= 0, 'Invalid file size')
            item = package.getmember(name)
            check(item.isfile() and item.size == entry['size'], 'File size mismatch')
            data = package.extractfile(item).read()
            check(digest(data) == entry['sha256'], 'File SHA256 mismatch')
            files[name] = data
        actual_files = {item.name for item in members if item.isfile()} - {'manifest.json'}
        check(set(files) == actual_files, 'Manifest does not cover every file')
        check({'site/index.html', 'site/favicon.svg', 'site/release.json'} <= set(files), 'Missing entry files')
        identity = json.loads(files['site/release.json'])
        check(identity.get('release') == release and identity.get('sourceSha256') == source['sha256'], 'Wrong site identity')
        html = files['site/index.html'].decode()
        check('/english-game/assets/' in html and '"/assets/' not in html, 'Build requires /english-game/ base')
        for url in re.findall(r'(?:src|href)="(/english-game/assets/[^"?#]+)"', html):
            check('site/' + url[len('/english-game/'):] in files, 'Missing HTML resource')
        return manifest, files


def stage(release, expected_sha):
    directory = deployment(release)
    destination = ROOT / 'releases' / release
    check(not destination.exists(), 'Release already exists; inspect status instead of overwriting')
    manifest, files = validate_archive(directory / 'site.tar.gz', expected_sha, release)
    state(release, 'staging', archiveSha256=expected_sha)
    (ROOT / 'releases').mkdir(parents=True, exist_ok=True)
    assets = ROOT / 'shared' / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.' + release + '-', dir=str(ROOT / 'releases')))
    os.chmod(str(temporary), 0o755)
    try:
        for name, data in files.items():
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            atomic_write(target, data)
            if name.startswith('site/assets/'):
                retained = assets / target.name
                check(not retained.is_symlink(), 'Unexpected asset symlink')
                if retained.exists():
                    check(digest(retained.read_bytes()) == digest(data), 'Existing immutable asset differs')
                else:
                    atomic_write(retained, data)
        atomic_write(temporary / 'manifest.json', (json.dumps(manifest, indent=2) + '\n').encode())
        os.rename(str(temporary), str(destination))
    finally:
        if temporary.exists():
            shutil.rmtree(str(temporary))
    return state(release, 'staged', archiveSha256=expected_sha, files=len(files), source=manifest['source'])


def set_current(target):
    link = ROOT / 'app'
    pending = ROOT / 'app.pending'
    check(not pending.exists() and not pending.is_symlink(), 'Pending activation exists; inspect before retrying')
    os.symlink(str(target), str(pending))
    try:
        os.replace(str(pending), str(link))
    finally:
        # Remove only the link this call created, including an interrupted rename.
        if pending.is_symlink() and os.readlink(str(pending)) == str(target):
            pending.unlink()


def nginx_plan(config):
    check('auth_basic "BigDream";' in config and 'auth_basic_user_file /etc/nginx/bigdream.htpasswd;' in config,
          'Existing access protection changed; inspect before activation')
    check('server_name 47.94.56.16;' in config and 'listen 443 ssl;' in config, 'Unexpected TLS site')
    if INCLUDE in config:
        check(config.count(INCLUDE) == 1, 'Duplicate game include')
        return config
    check(config.count(ANCHOR) == 1 and '/english-game' not in config, 'Unexpected proxy configuration')
    return config.replace(ANCHOR, INCLUDE + ANCHOR, 1)


def activate(release):
    directory = deployment(release)
    candidate = ROOT / 'releases' / release
    check(candidate.is_dir() and not candidate.is_symlink(), 'Release has not been staged')
    manifest = json.loads((candidate / 'manifest.json').read_text())
    for entry in manifest['files']:
        check(SITE_FILE.fullmatch(entry['path']), 'Invalid staged path')
        data = (candidate / entry['path']).read_bytes()
        check(digest(data) == entry['sha256'], 'Staged file changed')
        if entry['path'].startswith('site/assets/'):
            check(digest((ROOT / 'shared' / 'assets' / Path(entry['path']).name).read_bytes()) == entry['sha256'],
                  'Shared immutable asset changed')
    current = ROOT / 'app'
    check(not current.exists() or current.is_symlink(), 'Live path must be a release symlink')
    previous = os.readlink(str(current)) if current.is_symlink() else None
    if previous:
        check(Path(previous).parent == ROOT / 'releases' and Path(previous).is_dir(), 'Unknown previous release')
    pending = ROOT / 'app.pending'
    check(not pending.exists() and not pending.is_symlink(), 'Pending activation exists; inspect before retrying')
    config_before = NGINX_CONFIG.read_bytes()
    config_after = nginx_plan(config_before.decode()).encode()
    snippet_before = NGINX_LOCATIONS.read_bytes() if NGINX_LOCATIONS.exists() else None
    check(snippet_before in (None, LOCATIONS.encode(), LEGACY_LOCATIONS.encode()),
          'Existing game route has local changes')
    run(['nginx', '-t'])
    run(['curl', '--fail', '--silent', '--max-time', '15', 'http://127.0.0.1:3001/'])
    # Preserve evidence before the first mutation. A hard kill can be inspected
    # from these records and recovered using the retained previous release.
    backup = directory / ('nginx-before-' + datetime.utcnow().strftime('%Y%m%dT%H%M%S%f') + '.conf')
    atomic_write(backup, config_before)
    state(release, 'activating', previous=previous, nginxBackup=str(backup))
    # A concurrent site's edit must never enter our rollback path: no live
    # mutation has happened yet, so there is nothing of ours to restore.
    check(NGINX_CONFIG.read_bytes() == config_before, 'Proxy configuration changed concurrently')
    check((NGINX_LOCATIONS.read_bytes() if NGINX_LOCATIONS.exists() else None) == snippet_before,
          'Game route changed concurrently')
    try:
        atomic_write(NGINX_LOCATIONS, LOCATIONS.encode())
        atomic_write(NGINX_CONFIG, config_after)
        run(['nginx', '-t'])
        set_current(candidate)
        run(['systemctl', 'reload', 'nginx'])
        for endpoint in ('/', '/english-game/', '/english-game/release.json'):
            code = run(['curl', '--silent', '--output', '/dev/null', '--write-out', '%{http_code}',
                        '--max-time', '15', '--resolve', '47.94.56.16:443:127.0.0.1',
                        'https://47.94.56.16' + endpoint])
            check(code == '401', 'Access protection health check failed')
        run(['curl', '--fail', '--silent', '--max-time', '15', 'http://127.0.0.1:3001/'])
    except Exception as error:
        recovery_errors = []
        try:
            if previous:
                set_current(Path(previous))
            elif current.is_symlink():
                current.unlink()
        except Exception as recovery_error:
            recovery_errors.append(str(recovery_error))
        # A link failure must not prevent independently restoring nginx.
        try:
            check(NGINX_CONFIG.read_bytes() in (config_before, config_after),
                  'Concurrent nginx edits preserved; manual recovery required')
            check((NGINX_LOCATIONS.read_bytes() if NGINX_LOCATIONS.exists() else None)
                  in (snippet_before, LOCATIONS.encode()),
                  'Concurrent game route edits preserved; manual recovery required')
            atomic_write(NGINX_CONFIG, config_before)
            if snippet_before is None:
                if NGINX_LOCATIONS.exists():
                    NGINX_LOCATIONS.unlink()
            else:
                atomic_write(NGINX_LOCATIONS, snippet_before)
            run(['nginx', '-t'])
            run(['systemctl', 'reload', 'nginx'])
        except Exception as recovery_error:
            recovery_errors.append(str(recovery_error))
        if recovery_errors:
            state(release, 'recovery-required', previous=previous, nginxBackup=str(backup),
                  error=str(error), recoveryError='; '.join(recovery_errors))
        else:
            state(release, 'failed', previous=previous, restored=True, error=str(error))
        raise
    return state(release, 'active', previous=previous, nginxBackup=str(backup),
                 source=manifest['source'], url='https://47.94.56.16/english-game/',
                 verification='Local TLS and access protection passed; external authenticated/browser checks pending')


def main():
    check(len(sys.argv) in (3, 4), 'Usage: release.py stage|activate|status RELEASE [ARCHIVE_SHA256]')
    action, release = sys.argv[1:3]
    check(action in ('stage', 'activate', 'status'), 'Unknown action')
    check(len(sys.argv) == (4 if action == 'stage' else 3), 'Wrong argument count')
    directory = deployment(release)
    check(directory.is_dir(), 'Deployment directory is missing')
    if action == 'status':
        record = json.loads((directory / 'status.json').read_text()) if (directory / 'status.json').exists() else {'phase': 'uploaded'}
        record['currentRelease'] = os.readlink(str(ROOT / 'app')) if (ROOT / 'app').is_symlink() else None
        print(json.dumps(record, indent=2))
        return
    with (ROOT / 'deployment.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = stage(release, sys.argv[3]) if action == 'stage' else activate(release)
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}), file=sys.stderr)
        sys.exit(1)
