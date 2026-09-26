"""Isolated safety checks for the ECS static release helper (Python 3.6+).

Run with: python3 -m unittest discover -s tests -p 'ecs_static_release_test.py'
All deployment paths live in TemporaryDirectory and every external command is
replaced by a strict stub; this suite never contacts ECS or runs nginx.
"""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import tarfile
import tempfile
import unittest
from unittest import mock


HELPER = Path(__file__).resolve().parents[1] / 'scripts' / 'ecs-static-release.py'
SOURCE_SHA = 'a' * 64
BASE_CONFIG = '''server {
  listen 80;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl;
  server_name 47.94.56.16;
  ssl_certificate /etc/nginx/cert.pem;
  ssl_certificate_key /etc/nginx/key.pem;
  auth_basic "BigDream";
  auth_basic_user_file /etc/nginx/bigdream.htpasswd;
  location / {
    proxy_pass http://127.0.0.1:3001;
  }
}
'''


def sha(data):
    return hashlib.sha256(data).hexdigest()


class CommandStub(object):
    """Accept only the exact read-only checks/reload used by this helper."""

    def __init__(self, failures=None, codes=None):
        self.calls = []
        self.counts = {}
        self.failures = failures or set()
        self.codes = codes or {}

    def __call__(self, args):
        self.calls.append(list(args))
        if args == ['nginx', '-t']:
            kind = 'nginx'
            result = ''
        elif args == ['systemctl', 'reload', 'nginx']:
            kind = 'reload'
            result = ''
        elif args == ['curl', '--fail', '--silent', '--max-time', '15',
                      'http://127.0.0.1:3001/']:
            kind = 'backend'
            result = 'BigDream is healthy'
        elif (args[:-1] == ['curl', '--silent', '--output', '/dev/null',
                           '--write-out', '%{http_code}', '--max-time', '15',
                           '--resolve', '47.94.56.16:443:127.0.0.1'] and
              args[-1] in ['https://47.94.56.16/',
                           'https://47.94.56.16/english-game/',
                           'https://47.94.56.16/english-game/release.json']):
            kind = 'auth'
            result = self.codes.get(args[-1], '401')
        else:
            raise AssertionError('Unexpected command: {!r}'.format(args))
        self.counts[kind] = self.counts.get(kind, 0) + 1
        if (kind, self.counts[kind]) in self.failures:
            raise ValueError('Injected {} failure'.format(kind))
        return result


class StaticReleaseSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='ecs-release-test-')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        spec = importlib.util.spec_from_file_location('ecs_static_release_under_test', str(HELPER))
        self.helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.helper)
        self.helper.ROOT = self.base / 'english-game'
        self.helper.ROOT.mkdir()
        self.helper.NGINX_CONFIG = self.base / 'bigdream.conf'
        self.helper.NGINX_CONFIG.write_text(BASE_CONFIG)
        self.helper.NGINX_LOCATIONS = self.base / 'english-game.locations.conf'
        self.helper.INCLUDE = '  include {};\n'.format(self.helper.NGINX_LOCATIONS)
        self.helper.LOCATIONS = self.helper.LOCATIONS.replace('/opt/english-game', str(self.helper.ROOT))
        self.helper.LEGACY_LOCATIONS = self.helper.LEGACY_LOCATIONS.replace('/opt/english-game', str(self.helper.ROOT))
        self.commands = CommandStub()
        self.helper.run = self.commands

    def files(self, release, asset='index-old.js', contents=b'old bundle'):
        return {
            'site/index.html': ('<!doctype html><script type="module" '
                                'src="/english-game/assets/{}"></script>').format(asset).encode(),
            'site/favicon.svg': b'<svg xmlns="http://www.w3.org/2000/svg"/>',
            'site/release.json': json.dumps({'release': release, 'sourceSha256': SOURCE_SHA}).encode(),
            'site/assets/' + asset: contents,
        }

    def package(self, release='r-one', files=None, manifest_edit=None, extra=None):
        files = self.files(release) if files is None else files
        manifest = {
            'version': 1,
            'release': release,
            'source': {'sha256': SOURCE_SHA},
            'files': [{'path': name, 'size': len(data), 'sha256': sha(data)}
                      for name, data in sorted(files.items())],
        }
        if manifest_edit is not None:
            manifest_edit(manifest)
        directory = self.helper.ROOT / 'deployments' / release
        directory.mkdir(parents=True, exist_ok=True)
        archive = directory / 'site.tar.gz'
        with tarfile.open(str(archive), 'w:gz') as package:
            for name, data in [('manifest.json', json.dumps(manifest).encode())] + sorted(files.items()):
                member = tarfile.TarInfo(name)
                member.size = len(data)
                package.addfile(member, io.BytesIO(data))
            for member, data in extra or []:
                package.addfile(member, io.BytesIO(data) if data is not None else None)
        return archive, sha(archive.read_bytes())

    def staged(self, release='r-one', asset='index-old.js', contents=b'old bundle'):
        archive, archive_sha = self.package(release, self.files(release, asset, contents))
        self.helper.stage(release, archive_sha)
        return self.helper.ROOT / 'releases' / release

    def status(self, release):
        return json.loads((self.helper.deployment(release) / 'status.json').read_text())

    def previous_release(self):
        previous = self.staged('r-old')
        self.helper.set_current(previous)
        self.helper.NGINX_CONFIG.write_text(self.helper.nginx_plan(BASE_CONFIG))
        self.helper.NGINX_LOCATIONS.write_text(self.helper.LOCATIONS)
        return previous

    def assert_restored(self, previous, config, snippet):
        self.assertEqual(self.helper.NGINX_CONFIG.read_bytes(), config)
        if snippet is None:
            self.assertFalse(self.helper.NGINX_LOCATIONS.exists())
        else:
            self.assertEqual(self.helper.NGINX_LOCATIONS.read_bytes(), snippet)
            self.assert_game_auth(self.helper.NGINX_LOCATIONS.read_text())
        current = self.helper.ROOT / 'app'
        if previous is None:
            self.assertFalse(current.exists())
            self.assertFalse(current.is_symlink())
        else:
            self.assertTrue(current.is_symlink())
            self.assertEqual(os.readlink(str(current)), str(previous))
        self.assertFalse((self.helper.ROOT / 'app.pending').is_symlink())

    def assert_game_auth(self, snippet):
        locations = re.findall(r'^location ([^{]+)\{([^}]+)\}', snippet, re.MULTILINE)
        static_locations = {name.strip(): body for name, body in locations if 'alias ' in body}
        self.assertEqual(set(static_locations), {
            '= /english-game/', '= /english-game/index.html', '= /english-game/favicon.svg',
            '= /english-game/release.json', '^~ /english-game/assets/',
        })
        for name, body in static_locations.items():
            with self.subTest(location=name):
                self.assertEqual(body.count('  include /etc/nginx/english-game-auth.conf;\n'), 1)
                self.assertNotIn('auth_basic', body)
                self.assertNotIn('bigdream.htpasswd', body)

    def test_every_static_location_requires_independent_game_auth(self):
        self.assert_game_auth(self.helper.LOCATIONS)
        self.assert_game_auth(self.helper.LEGACY_LOCATIONS)

    def test_nginx_plan_only_adds_game_routes_and_preserves_bigdream_auth(self):
        planned = self.helper.nginx_plan(BASE_CONFIG)
        self.assertEqual(planned.replace(self.helper.INCLUDE, ''), BASE_CONFIG)
        self.assertEqual(planned.count('auth_basic "BigDream";'), 1)
        self.assertEqual(planned.count('auth_basic_user_file /etc/nginx/bigdream.htpasswd;'), 1)
        self.assertEqual(self.helper.nginx_plan(planned), planned)
        for changed in (BASE_CONFIG.replace('auth_basic "BigDream";', 'auth_basic off;'),
                        BASE_CONFIG.replace('/etc/nginx/bigdream.htpasswd', '/etc/nginx/english-game.htpasswd')):
            with self.subTest(config=changed):
                with self.assertRaisesRegex(ValueError, 'Existing access protection changed'):
                    self.helper.nginx_plan(changed)

    def test_valid_archive_round_trip(self):
        archive, archive_sha = self.package()
        manifest, files = self.helper.validate_archive(archive, archive_sha, 'r-one')
        self.assertEqual(manifest['release'], 'r-one')
        self.assertEqual(files, self.files('r-one'))

    def test_traversal_and_unexpected_directories_are_rejected(self):
        for name, kind in [('../outside', tarfile.REGTYPE),
                           ('/tmp/outside', tarfile.REGTYPE),
                           ('site/../../outside', tarfile.REGTYPE),
                           ('site/assets/../outside.js', tarfile.REGTYPE),
                           ('site/..', tarfile.DIRTYPE),
                           ('site/assets/nested', tarfile.DIRTYPE)]:
            with self.subTest(name=name):
                member = tarfile.TarInfo(name)
                member.type = kind
                member.size = 0
                archive, archive_sha = self.package(extra=[(member, b'')])
                with self.assertRaisesRegex(ValueError, 'Unexpected (file path|directory)'):
                    self.helper.validate_archive(archive, archive_sha, 'r-one')
        self.assertFalse((self.base / 'outside').exists())

    def test_links_and_special_files_are_rejected(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE]:
            with self.subTest(kind=kind):
                member = tarfile.TarInfo('site/assets/linked.js')
                member.type = kind
                member.linkname = '../../outside'
                archive, archive_sha = self.package(extra=[(member, None)])
                with self.assertRaisesRegex(ValueError, 'Links and special files'):
                    self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_duplicate_archive_member_is_rejected(self):
        member = tarfile.TarInfo('site/index.html')
        archive, archive_sha = self.package(extra=[(member, b'')])
        with self.assertRaisesRegex(ValueError, 'Duplicate archive member'):
            self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_unlisted_archive_member_is_rejected(self):
        member = tarfile.TarInfo('site/assets/unlisted.js')
        archive, archive_sha = self.package(extra=[(member, b'')])
        with self.assertRaisesRegex(ValueError, 'Manifest does not cover every file'):
            self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_archive_hash_is_required_and_verified(self):
        archive, unused_sha = self.package()
        for expected in ['0' * 64, 'bad-hash']:
            with self.subTest(expected=expected):
                with self.assertRaisesRegex(ValueError, '(SHA256 mismatch|Invalid archive SHA256)'):
                    self.helper.validate_archive(archive, expected, 'r-one')

    def test_manifest_file_hash_and_size_are_verified(self):
        for field, value, message in [('sha256', '0' * 64, 'File SHA256 mismatch'),
                                      ('size', 99999, 'File size mismatch')]:
            with self.subTest(field=field):
                def edit(manifest):
                    manifest['files'][0][field] = value
                archive, archive_sha = self.package(manifest_edit=edit)
                with self.assertRaisesRegex(ValueError, message):
                    self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_duplicate_manifest_path_is_rejected(self):
        def edit(manifest):
            manifest['files'].append(dict(manifest['files'][0]))
        archive, archive_sha = self.package(manifest_edit=edit)
        with self.assertRaisesRegex(ValueError, 'Invalid manifest path'):
            self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_wrong_release_and_source_identity_are_rejected(self):
        archive, archive_sha = self.package()
        with self.assertRaisesRegex(ValueError, 'Wrong manifest identity'):
            self.helper.validate_archive(archive, archive_sha, 'r-other')
        files = self.files('r-one')
        files['site/release.json'] = json.dumps({'release': 'r-one', 'sourceSha256': 'b' * 64}).encode()
        archive, archive_sha = self.package(files=files)
        with self.assertRaisesRegex(ValueError, 'Wrong site identity'):
            self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_html_resource_must_be_in_manifest(self):
        files = self.files('r-one')
        files['site/index.html'] = b'<script src="/english-game/assets/missing.js"></script>'
        archive, archive_sha = self.package(files=files)
        with self.assertRaisesRegex(ValueError, 'Missing HTML resource'):
            self.helper.validate_archive(archive, archive_sha, 'r-one')

    def test_staging_cannot_overwrite_an_existing_release(self):
        candidate = self.staged()
        before = (candidate / 'site/index.html').read_bytes()
        archive, archive_sha = self.package(files=self.files('r-one', 'different.js', b'different bundle'))
        with self.assertRaisesRegex(ValueError, 'Release already exists'):
            self.helper.stage('r-one', archive_sha)
        self.assertEqual((candidate / 'site/index.html').read_bytes(), before)
        self.assertFalse((self.helper.ROOT / 'shared/assets/different.js').exists())
        self.assertEqual(self.status('r-one')['phase'], 'staged')

    def test_staging_preserves_old_assets_and_does_not_switch_live_release(self):
        previous = self.previous_release()
        candidate = self.staged('r-new', 'index-new.js', b'new bundle')
        assets = self.helper.ROOT / 'shared/assets'
        self.assertEqual((assets / 'index-old.js').read_bytes(), b'old bundle')
        self.assertEqual((assets / 'index-new.js').read_bytes(), b'new bundle')
        self.assertEqual(os.readlink(str(self.helper.ROOT / 'app')), str(previous))
        self.assertEqual((candidate / 'site/assets/index-new.js').read_bytes(), b'new bundle')
        self.assertEqual(self.commands.calls, [])

    def test_existing_immutable_asset_cannot_be_changed(self):
        self.staged('r-old')
        archive, archive_sha = self.package('r-new', self.files('r-new', contents=b'changed bundle'))
        with self.assertRaisesRegex(ValueError, 'Existing immutable asset differs'):
            self.helper.stage('r-new', archive_sha)
        self.assertEqual((self.helper.ROOT / 'shared/assets/index-old.js').read_bytes(), b'old bundle')
        self.assertFalse((self.helper.ROOT / 'releases/r-new').exists())
        self.assertEqual(list((self.helper.ROOT / 'releases').glob('.r-new-*')), [])

    def test_shared_asset_symlink_is_rejected_without_writing_its_target(self):
        assets = self.helper.ROOT / 'shared/assets'
        assets.mkdir(parents=True)
        target = self.base / 'unrelated.txt'
        target.write_bytes(b'unrelated')
        (assets / 'index-old.js').symlink_to(target)
        archive, archive_sha = self.package()
        with self.assertRaisesRegex(ValueError, 'Unexpected asset symlink'):
            self.helper.stage('r-one', archive_sha)
        self.assertEqual(target.read_bytes(), b'unrelated')
        self.assertFalse((self.helper.ROOT / 'releases/r-one').exists())

    def test_first_activation_installs_exact_route_and_preserves_protection(self):
        candidate = self.staged()
        result = self.helper.activate('r-one')
        self.assertEqual(result['phase'], 'active')
        self.assertEqual(os.readlink(str(self.helper.ROOT / 'app')), str(candidate))
        self.assertEqual(self.helper.NGINX_CONFIG.read_text(), self.helper.nginx_plan(BASE_CONFIG))
        self.assertEqual(self.helper.NGINX_CONFIG.read_text().count(self.helper.INCLUDE), 1)
        self.assertEqual(self.helper.NGINX_LOCATIONS.read_text(), self.helper.LOCATIONS)
        self.assert_game_auth(self.helper.NGINX_LOCATIONS.read_text())
        self.assertEqual(Path(result['nginxBackup']).read_text(), BASE_CONFIG)
        self.assertEqual(self.commands.counts, {'nginx': 2, 'backend': 2, 'reload': 1, 'auth': 3})

    def test_deployment_and_code_rollback_keep_independent_auth(self):
        previous = self.previous_release()
        candidate = self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        self.assert_game_auth(snippet.decode())
        self.assertEqual(self.helper.activate('r-new')['phase'], 'active')
        self.assert_restored(candidate, config, snippet)
        self.assertEqual(self.helper.activate('r-old')['phase'], 'active')
        self.assert_restored(previous, config, snippet)

    def test_shared_auth_or_locally_modified_routes_stop_before_mutation(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        include = '  include /etc/nginx/english-game-auth.conf;\n'
        variants = [
            self.helper.LOCATIONS.replace(include, '').replace(
                '# Managed by english-game; independent access settings live outside versioned releases.',
                "# Managed by english-game; inherits the existing TLS server's access password."),
            self.helper.LOCATIONS.replace(include, '', 1),
            self.helper.LOCATIONS.replace(include, '  auth_basic "BigDream";\n', 1),
            self.helper.LOCATIONS + '# Local operator edit\n',
        ]
        for index, snippet in enumerate(variants):
            with self.subTest(variant=index):
                self.helper.NGINX_LOCATIONS.write_text(snippet)
                with self.assertRaisesRegex(ValueError, 'Existing game route has local changes'):
                    self.helper.activate('r-new')
                self.assertEqual(self.helper.NGINX_CONFIG.read_bytes(), config)
                self.assertEqual(self.helper.NGINX_LOCATIONS.read_text(), snippet)
                self.assertEqual(os.readlink(str(self.helper.ROOT / 'app')), str(previous))
                self.assertEqual(self.status('r-new')['phase'], 'staged')
                self.assertEqual(self.commands.calls, [])

    def test_legacy_alias_upgrade_preserves_independent_auth(self):
        self.previous_release()
        self.helper.NGINX_LOCATIONS.write_text(self.helper.LEGACY_LOCATIONS)
        self.assert_game_auth(self.helper.NGINX_LOCATIONS.read_text())
        self.staged('r-new', 'index-new.js', b'new bundle')
        self.assertEqual(self.helper.activate('r-new')['phase'], 'active')
        self.assertEqual(self.helper.NGINX_LOCATIONS.read_text(), self.helper.LOCATIONS)
        self.assert_game_auth(self.helper.NGINX_LOCATIONS.read_text())

    def test_changed_staged_file_stops_before_nginx_mutation(self):
        candidate = self.staged()
        (candidate / 'site/index.html').write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'Staged file changed'):
            self.helper.activate('r-one')
        self.assert_restored(None, BASE_CONFIG.encode(), None)
        self.assertEqual(self.commands.calls, [])

    def test_initial_nginx_precheck_failure_leaves_existing_site_untouched(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        self.helper.run = CommandStub(failures={('nginx', 1)})
        with self.assertRaisesRegex(ValueError, 'Injected nginx failure'):
            self.helper.activate('r-new')
        self.assert_restored(previous, config, snippet)
        self.assertEqual(self.status('r-new')['phase'], 'staged')
        self.assertEqual(self.helper.run.calls, [['nginx', '-t']])

    def test_new_nginx_config_precheck_failure_restores_existing_release(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        self.helper.run = CommandStub(failures={('nginx', 2)})
        with self.assertRaisesRegex(ValueError, 'Injected nginx failure'):
            self.helper.activate('r-new')
        self.assert_restored(previous, config, snippet)
        self.assertEqual(self.status('r-new')['phase'], 'failed')
        self.assertTrue(self.status('r-new')['restored'])
        self.assertEqual(self.helper.run.counts, {'nginx': 3, 'backend': 1, 'reload': 1})

    def test_auth_health_failure_restores_previous_release_and_config(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        self.helper.run = CommandStub(codes={'https://47.94.56.16/english-game/': '200'})
        with self.assertRaisesRegex(ValueError, 'Access protection health check failed'):
            self.helper.activate('r-new')
        self.assert_restored(previous, config, snippet)
        self.assertTrue(self.status('r-new')['restored'])
        self.assertEqual(self.helper.run.counts['reload'], 2)
        self.assertEqual((self.helper.ROOT / 'shared/assets/index-old.js').read_bytes(), b'old bundle')

    def test_backend_health_failure_restores_previous_release(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        self.helper.run = CommandStub(failures={('backend', 2)})
        with self.assertRaisesRegex(ValueError, 'Injected backend failure'):
            self.helper.activate('r-new')
        self.assert_restored(previous, config, snippet)
        self.assertTrue(self.status('r-new')['restored'])

    def test_first_activation_failure_removes_new_link_and_restores_original_protection(self):
        for failure in ['nginx', 'auth', 'reload']:
            with self.subTest(failure=failure):
                release = 'r-first-' + failure
                self.staged(release)
                if failure == 'auth':
                    commands = CommandStub(codes={'https://47.94.56.16/': '403'})
                else:
                    commands = CommandStub(failures={(failure, 2 if failure == 'nginx' else 1)})
                self.helper.run = commands
                with self.assertRaises(ValueError):
                    self.helper.activate(release)
                self.assert_restored(None, BASE_CONFIG.encode(), None)
                self.assertEqual(self.status(release)['phase'], 'failed')
                self.assertTrue(self.status(release)['restored'])

    def test_failed_recovery_is_reported_as_requiring_intervention(self):
        self.staged()
        self.helper.run = CommandStub(failures={('reload', 1), ('nginx', 3)})
        with self.assertRaisesRegex(ValueError, 'Injected reload failure'):
            self.helper.activate('r-one')
        self.assert_restored(None, BASE_CONFIG.encode(), None)
        record = self.status('r-one')
        self.assertEqual(record['phase'], 'recovery-required')
        self.assertEqual(record['recoveryError'], 'Injected nginx failure')
        self.assertEqual(Path(record['nginxBackup']).read_text(), BASE_CONFIG)

    def test_missing_stage_hash_cannot_activate_a_staged_release(self):
        self.staged()
        with mock.patch.object(self.helper.sys, 'argv', ['release.py', 'stage', 'r-one']):
            with self.assertRaises(ValueError):
                self.helper.main()
        self.assert_restored(None, BASE_CONFIG.encode(), None)
        self.assertEqual(self.commands.calls, [])

    def test_concurrent_config_change_before_mutation_is_not_overwritten(self):
        self.staged()
        concurrent_config = BASE_CONFIG + '# Concurrent operator update\n'

        def run_and_change_config(args):
            result = self.commands(args)
            if args[-1] == 'http://127.0.0.1:3001/' and self.commands.counts.get('backend') == 1:
                self.helper.NGINX_CONFIG.write_text(concurrent_config)
            return result

        self.helper.run = run_and_change_config
        with self.assertRaisesRegex(ValueError, 'Proxy configuration changed concurrently'):
            self.helper.activate('r-one')
        self.assertEqual(self.helper.NGINX_CONFIG.read_text(), concurrent_config)
        self.assertFalse(self.helper.NGINX_LOCATIONS.exists())
        self.assertFalse((self.helper.ROOT / 'app').is_symlink())
        self.assertEqual(self.commands.counts.get('reload', 0), 0)

    def test_preexisting_pending_link_is_rejected_before_nginx_mutation(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        pending = self.helper.ROOT / 'app.pending'
        pending.symlink_to(previous)
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        with mock.patch.object(self.helper, 'atomic_write', wraps=self.helper.atomic_write) as writes:
            with self.assertRaisesRegex(ValueError, 'Pending activation exists'):
                self.helper.activate('r-new')
        touched = [call[0][0] for call in writes.call_args_list]
        self.assertNotIn(self.helper.NGINX_CONFIG, touched)
        self.assertNotIn(self.helper.NGINX_LOCATIONS, touched)
        self.assertEqual(self.helper.NGINX_CONFIG.read_bytes(), config)
        self.assertEqual(self.helper.NGINX_LOCATIONS.read_bytes(), snippet)
        self.assertEqual(os.readlink(str(self.helper.ROOT / 'app')), str(previous))
        self.assertTrue(pending.is_symlink())

    def test_failed_symlink_replacement_cleans_pending_and_allows_recovery(self):
        previous = self.previous_release()
        self.staged('r-new', 'index-new.js', b'new bundle')
        config = self.helper.NGINX_CONFIG.read_bytes()
        snippet = self.helper.NGINX_LOCATIONS.read_bytes()
        original_replace = self.helper.os.replace
        failures = [0]

        def replace_with_one_activation_failure(source, destination):
            if str(destination) == str(self.helper.ROOT / 'app') and failures[0] == 0:
                failures[0] += 1
                raise OSError('Injected link replacement failure')
            return original_replace(source, destination)

        with mock.patch.object(self.helper.os, 'replace', side_effect=replace_with_one_activation_failure):
            with self.assertRaisesRegex(OSError, 'Injected link replacement failure'):
                self.helper.activate('r-new')
        self.assert_restored(previous, config, snippet)
        self.assertEqual(self.status('r-new')['phase'], 'failed')
        self.assertTrue(self.status('r-new')['restored'])


if __name__ == '__main__':
    unittest.main()
