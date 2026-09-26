#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { constants, existsSync, realpathSync } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET = Object.freeze({
  instance: 'i-2zeb1trybvkcp8s281v5',
  region: 'cn-beijing',
  profile: 'bigdream',
  root: '/opt/english-game',
  base: '/english-game/',
});
const SOURCE_DIRECTORIES = new Set(['src', 'public', 'scripts', 'tests']);
const SOURCE_FILES = new Set([
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierignore',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
]);
const HELP = `Deploy the current English Game workspace to the registered ECS target.
Usage: node scripts/deploy-ecs.mjs [options]
  --dry-run          Snapshot, build and package locally; no Workbench/cloud calls
  --stage-only       Upload and validate a release without activating it
  --release ID       Use a unique release ID instead of generating one
  --status ID        Query an existing deployment; no build or upload
  --activate ID      Activate an existing release (also used for rollback)
  --workbench PATH   Workbench executable; defaults to ~/.local/bin/workbench or PATH
  --help             Show this help
Default: snapshot, build, upload, stage, then activate.
Target: ${TARGET.instance}, ${TARGET.region}, profile ${TARGET.profile}
Remote root: ${TARGET.root}; URL prefix: ${TARGET.base}
Local release files are retained in a private temporary directory for inspection.
If a cloud command fails, query the same release before attempting another write.`;

class DeploymentError extends Error {}
function fail(message) {
  throw new DeploymentError(message);
}
const sha256 = (content) => createHash('sha256').update(content).digest('hex');

export function validateReleaseId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value))
    fail('Release ID must contain 1–80 lowercase letters, digits or hyphens.');
  return value;
}

export function parseArgs(argv) {
  const options = { mode: 'deploy' };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (seen.has(key)) fail('Duplicate option; use --help.');
    seen.add(key);
    if (key === '--help') return { mode: 'help' };
    if (['--dry-run', '--stage-only', '--status', '--activate'].includes(key)) {
      if (options.mode !== 'deploy') fail('Choose only one deployment mode.');
      options.mode = key.slice(2);
      if (key === '--status' || key === '--activate')
        options.existingRelease = validateReleaseId(argv[++i]);
    } else if (key === '--release') {
      options.release = validateReleaseId(argv[++i]);
    } else if (key === '--workbench') {
      const value = argv[++i];
      if (!value || value.startsWith('-') || /[\x00-\x1f\x7f]/.test(value))
        fail('Invalid Workbench executable.');
      options.workbench = value;
    } else fail('Unknown option; use --help.');
  }
  if (options.existingRelease && options.release)
    fail('--release cannot be combined with --status or --activate.');
  return options;
}

export function validateRelativePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    path.posix.isAbsolute(value) ||
    /[\\\x00-\x1f\x7f]/.test(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('-'))
  )
    fail('Unsafe file path in deployment input.');
  return value;
}

function isSensitivePath(relative) {
  return relative
    .split('/')
    .some(
      (part) =>
        /^(?:\.env(?:\..*)?|node_modules|__pycache__|\.git|\.ssh|\.aws|\.workbench|\.codex|\.agents|\.npmrc|\.netrc|\.pypirc|\.docker|credentials(?:\..*)?|application_default_credentials\.json|secrets?(?:\.(?:json|ya?ml|toml|ini|env|txt|csv))?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?)$/i.test(
          part,
        ) || /\.(?:pem|key|p12|pfx|keystore|sqlite|sqlite3|db|log|pyc|pyo)$/i.test(part),
    );
}

export function isSourcePath(relative) {
  validateRelativePath(relative);
  if (isSensitivePath(relative)) return false;
  const parts = relative.split('/');
  return (
    (parts.length > 1 && SOURCE_DIRECTORIES.has(parts[0])) ||
    (parts.length === 1 &&
      (SOURCE_FILES.has(relative) || /^tsconfig(?:\.[a-zA-Z0-9_-]+)*\.json$/.test(relative)))
  );
}

async function readRegularFile(root, relative) {
  validateRelativePath(relative);
  const file = path.join(root, ...relative.split('/'));
  if ((await lstat(file)).isSymbolicLink())
    fail('Symbolic links are not allowed in release files.');
  const resolved = await realpath(file);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail('Source file escapes the workspace.');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) fail('Only regular files can enter a release.');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function walkFiles(root, directory) {
  const files = [];
  async function visit(relative) {
    validateRelativePath(relative);
    const full = path.join(root, ...relative.split('/'));
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) fail('Symbolic links are not allowed in release input.');
    if (isSensitivePath(relative)) return;
    if (stat.isDirectory()) {
      if (!(await realpath(full)).startsWith(`${root}${path.sep}`))
        fail('Directory escapes the workspace.');
      for (const name of (await readdir(full)).sort()) await visit(`${relative}/${name}`);
    } else if (stat.isFile()) files.push(relative);
    else fail('Only regular files and directories can enter a release.');
  }
  await visit(directory);
  return files;
}

export function sourceDigest(files) {
  const ordered = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const seen = new Set();
  for (const file of ordered) {
    if (
      !isSourcePath(file.path) ||
      seen.has(file.path) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    )
      fail('Invalid source manifest.');
    seen.add(file.path);
  }
  return sha256(JSON.stringify(ordered.map(({ path, sha256, size }) => ({ path, sha256, size }))));
}

export async function inspectSource(workspace) {
  const root = await realpath(workspace);
  const names = (await readdir(root)).sort();
  const paths = [];
  for (const name of names) {
    if (SOURCE_DIRECTORIES.has(name)) paths.push(...(await walkFiles(root, name)));
    else if (isSourcePath(name)) paths.push(name);
  }
  const files = [];
  for (const relative of paths.sort()) {
    const content = await readRegularFile(root, relative);
    files.push({ path: relative, sha256: sha256(content), size: content.byteLength });
  }
  for (const required of ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts'])
    if (!files.some((file) => file.path === required)) fail('Required build input is missing.');
  return { files, sha256: sourceDigest(files) };
}

export async function createSnapshot(workspace, destination) {
  const root = await realpath(workspace);
  const before = await inspectSource(root);
  await mkdir(destination, { mode: 0o700 });
  for (const file of before.files) {
    const content = await readRegularFile(root, file.path);
    if (sha256(content) !== file.sha256)
      fail('Workspace changed while copying; start a new release.');
    const target = path.join(destination, ...file.path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx', mode: 0o600 });
  }
  if ((await inspectSource(root)).sha256 !== before.sha256)
    fail('Workspace changed while copying; start a new release.');
  return before;
}

export function validateArtifactManifest(manifest) {
  if (manifest?.version !== 1) fail('Unsupported artifact manifest.');
  validateReleaseId(manifest.release);
  if (
    !/^[a-f0-9]{40,64}$/.test(manifest.source?.revision ?? '') ||
    typeof manifest.source?.dirty !== 'boolean' ||
    !/^[a-f0-9]{64}$/.test(manifest.source?.sha256 ?? '') ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 1997
  )
    fail('Invalid artifact source metadata.');
  const seen = new Set();
  for (const file of manifest.files) {
    validateRelativePath(file.path);
    if (
      seen.has(file.path) ||
      isSensitivePath(file.path) ||
      !(
        ['site/index.html', 'site/favicon.svg', 'site/release.json'].includes(file.path) ||
        /^site\/assets\/[A-Za-z0-9_.-]+$/.test(file.path)
      ) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      file.size > 30 * 1024 * 1024
    )
      fail('Invalid or unexpected published file.');
    seen.add(file.path);
  }
  for (const required of ['site/index.html', 'site/favicon.svg', 'site/release.json'])
    if (!seen.has(required)) fail('Required published file is missing.');
  if (![...seen].some((name) => name.startsWith('site/assets/') && name.endsWith('.js')))
    fail('Published JavaScript is missing.');
  const total = manifest.files.reduce((sum, file) => sum + file.size, 0);
  if (total + Buffer.byteLength(JSON.stringify(manifest, null, 2)) + 1 > 30 * 1024 * 1024)
    fail('Expanded artifact exceeds the server limit.');
  return manifest;
}

export function shellQuote(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) fail('Unsafe shell argument.');
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function buildRemoteCommand(action, release, archiveSha) {
  validateReleaseId(release);
  const directory = `${TARGET.root}/deployments/${release}`;
  if (action === 'prepare')
    return `mkdir -p -- ${shellQuote(`${TARGET.root}/deployments`)} && mkdir -- ${shellQuote(directory)}`;
  if (!['stage', 'activate', 'status'].includes(action)) fail('Unknown remote operation.');
  const command = `python3 ${shellQuote(`${directory}/release.py`)} ${action} ${shellQuote(release)}`;
  if (action !== 'stage') return command;
  if (!/^[a-f0-9]{64}$/.test(archiveSha ?? '')) fail('Invalid archive SHA256.');
  return `${command} ${shellQuote(archiveSha)}`;
}

function run(executable, args, phase, options = {}) {
  const result = spawnSync(executable, args, {
    shell: false,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    // SDK failures sometimes include credential material. Never echo raw diagnostics.
    const exit = Number.isInteger(result.status) ? result.status : 'unavailable';
    fail(`${phase} failed (exit ${exit}). Raw command diagnostics are suppressed.`);
  }
  return result.stdout;
}

function gitState(root) {
  const revision = run('git', ['-C', root, 'rev-parse', 'HEAD'], 'Read Git revision').trim();
  if (!/^[a-f0-9]{40,64}$/.test(revision)) fail('Invalid Git revision.');
  const status = run(
    'git',
    ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all', '-z'],
    'Read Git state',
  );
  return { revision, dirty: Boolean(status), changes: status.split('\0').filter(Boolean) };
}

function buildEnvironment() {
  // Do not inherit VITE_*, NODE_OPTIONS or cloud credentials into the build.
  const result = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'SYSTEMROOT'])
    if (process.env[key] !== undefined) result[key] = process.env[key];
  return result;
}

export async function createPackage(root, release, temporary) {
  validateReleaseId(release);
  root = await realpath(root);
  temporary = await realpath(temporary);
  const git = gitState(root);
  const snapshot = path.join(temporary, 'snapshot');
  const source = await createSnapshot(root, snapshot);
  const sourceManifest = { version: 1, ...git, ...source };
  await writeFile(
    path.join(temporary, 'source-manifest.json'),
    `${JSON.stringify(sourceManifest, null, 2)}\n`,
    { mode: 0o600 },
  );
  const dependencies = path.join(root, 'node_modules');
  if (!(await lstat(dependencies)).isDirectory()) fail('Run npm ci with Node 22 before packaging.');
  // This local-only toolchain link is outside the published site and tar input.
  await symlink(dependencies, path.join(snapshot, 'node_modules'), 'dir');
  const buildOptions = { cwd: snapshot, env: buildEnvironment(), timeout: 300_000 };
  run('npm', ['run', 'build', '--', `--base=${TARGET.base}`], 'Build snapshot', buildOptions);
  run('npm', ['run', 'check:bundles'], 'Check bundle budgets', buildOptions);
  if (
    (await inspectSource(root)).sha256 !== source.sha256 ||
    (await inspectSource(snapshot)).sha256 !== source.sha256 ||
    gitState(root).revision !== git.revision
  )
    fail('Workspace changed during build; start a new release.');

  const artifact = path.join(temporary, 'artifact');
  const site = path.join(artifact, 'site');
  await mkdir(site, { recursive: true, mode: 0o700 });
  const dist = path.join(snapshot, 'dist');
  const publish = ['index.html', 'favicon.svg', ...(await walkFiles(dist, 'assets'))];
  const files = [];
  for (const relative of publish.sort()) {
    const content = await readRegularFile(dist, relative);
    const target = path.join(site, ...relative.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { mode: 0o644 });
    files.push({ path: `site/${relative}`, sha256: sha256(content), size: content.byteLength });
  }
  const identity = Buffer.from(
    `${JSON.stringify({ release, revision: git.revision, sourceSha256: source.sha256 })}\n`,
  );
  await writeFile(path.join(site, 'release.json'), identity, { mode: 0o644 });
  files.push({ path: 'site/release.json', sha256: sha256(identity), size: identity.byteLength });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = validateArtifactManifest({
    version: 1,
    release,
    source: { revision: git.revision, dirty: git.dirty, sha256: source.sha256 },
    files,
  });
  await writeFile(path.join(artifact, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // Use the helper from the verified snapshot, never a newly changed workspace file.
  const helperContent = await readRegularFile(snapshot, 'scripts/ecs-static-release.py');
  const helper = path.join(temporary, 'release.py');
  await writeFile(helper, helperContent, { mode: 0o600 });
  const archive = path.join(temporary, 'site.tar.gz');
  run('tar', ['-czf', archive, '-C', artifact, 'manifest.json', 'site'], 'Create static archive', {
    env: { ...buildEnvironment(), COPYFILE_DISABLE: '1' },
  });
  const archiveSha256 = sha256(await readFile(archive));
  return { release, manifest, archive, archiveSha256, helper, temporary };
}

function workbenchExecutable(options) {
  const fallback = path.join(homedir(), '.local/bin/workbench');
  return options.workbench ?? (existsSync(fallback) ? fallback : 'workbench');
}

function workbenchArgs() {
  return ['--instance-id', TARGET.instance, '--region', TARGET.region, '--profile', TARGET.profile];
}

function executeRemote(executable, action, release, digest) {
  const output = run(
    executable,
    [
      'exec',
      ...workbenchArgs(),
      '--command',
      buildRemoteCommand(action, release, digest),
      '--timeout',
      '60',
    ],
    `Remote ${action}; query --status ${release} before retrying a write`,
  );
  if (action === 'prepare') {
    if (output.trim()) fail('Unexpected directory preparation response; inspect the deployment.');
    return;
  }
  console.log(JSON.stringify(parseRemoteStatus(output, action, release), null, 2));
}

export function parseRemoteStatus(output, action, release) {
  validateReleaseId(release);
  let record;
  try {
    record = JSON.parse(output);
  } catch {
    fail('Workbench returned no valid deployment status; query the same release before retrying.');
  }
  const phases = new Set([
    'uploaded',
    'staging',
    'staged',
    'activating',
    'active',
    'failed',
    'recovery-required',
  ]);
  if (
    !record ||
    !phases.has(record.phase) ||
    (record.release !== undefined && record.release !== release) ||
    (action === 'stage' && record.phase !== 'staged') ||
    (action === 'activate' && record.phase !== 'active')
  )
    fail('Remote status does not confirm the requested operation.');
  const safe = { release, phase: record.phase };
  if (record.source) {
    if (
      !/^[a-f0-9]{40,64}$/.test(record.source.revision ?? '') ||
      !/^[a-f0-9]{64}$/.test(record.source.sha256 ?? '') ||
      typeof record.source.dirty !== 'boolean'
    )
      fail('Remote source identity is invalid.');
    safe.source = {
      revision: record.source.revision,
      dirty: record.source.dirty,
      sha256: record.source.sha256,
    };
  }
  for (const key of ['previous', 'currentRelease']) {
    if (record[key] === null) safe[key] = null;
    else if (record[key] !== undefined) {
      const prefix = `${TARGET.root}/releases/`;
      if (typeof record[key] !== 'string' || !record[key].startsWith(prefix))
        fail('Remote release pointer is outside the registered root.');
      validateReleaseId(record[key].slice(prefix.length));
      safe[key] = record[key];
    }
  }
  if (record.url === 'https://47.94.56.16/english-game/') safe.url = record.url;
  if (typeof record.restored === 'boolean') safe.restored = record.restored;
  if (Number.isSafeInteger(record.files) && record.files >= 0) safe.files = record.files;
  if (/^[a-f0-9]{64}$/.test(record.archiveSha256 ?? '')) safe.archiveSha256 = record.archiveSha256;
  return safe;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.mode === 'help') {
    console.log(HELP);
    return;
  }
  const executable = workbenchExecutable(options);
  if (options.mode === 'status' || options.mode === 'activate') {
    executeRemote(executable, options.mode, options.existingRelease);
    return;
  }
  const release =
    options.release ??
    `${new Date().toISOString().replace(/[-:.]/g, '').toLowerCase()}-${randomBytes(4).toString('hex')}`;
  validateReleaseId(release);
  const temporary = await mkdtemp(path.join(tmpdir(), `english-game-${release}-`));
  console.log(JSON.stringify({ phase: 'building', release, target: TARGET, temporary }, null, 2));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const built = await createPackage(root, release, temporary);
  console.log(
    JSON.stringify(
      {
        phase: 'packaged',
        release,
        source: built.manifest.source,
        files: built.manifest.files.length,
        archive: built.archive,
        archiveSha256: built.archiveSha256,
        sourceManifest: path.join(temporary, 'source-manifest.json'),
      },
      null,
      2,
    ),
  );
  if (options.mode === 'dry-run') return;
  executeRemote(executable, 'prepare', release);
  const directory = `${TARGET.root}/deployments/${release}`;
  for (const [local, remote] of [
    [built.archive, `${directory}/site.tar.gz`],
    [built.helper, `${directory}/release.py`],
  ])
    run(
      executable,
      ['upload', local, remote, ...workbenchArgs()],
      `Upload release; query --status ${release} before retrying a write`,
    );
  executeRemote(executable, 'stage', release, built.archiveSha256);
  if (options.mode !== 'stage-only') executeRemote(executable, 'activate', release);
  executeRemote(executable, 'status', release);
}

// Resolve both paths so invoking this entry point through a symlink still runs it.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(
      error instanceof DeploymentError
        ? error.message
        : 'Deployment failed locally; inspect the retained release directory. Raw diagnostics are suppressed.',
    );
    process.exitCode = 1;
  });
}
