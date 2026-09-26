import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  TARGET,
  buildRemoteCommand,
  createSnapshot,
  inspectSource,
  isSourcePath,
  parseArgs,
  parseRemoteStatus,
  sourceDigest,
  validateArtifactManifest,
  validateRelativePath,
  validateReleaseId,
} from '../scripts/deploy-ecs.mjs';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ecs-deployment-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'workspace');
  await mkdir(root);
  for (const name of ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts'])
    await writeFile(path.join(root, name), name);
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'main.ts'), 'export const version = 1;');
  return { directory, root };
}

test('deployment modes are exclusive and the registered target cannot be overridden', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--release', 'review-001']), {
    mode: 'dry-run',
    release: 'review-001',
  });
  assert.deepEqual(parseArgs(['--status', 'review-001']), {
    mode: 'status',
    existingRelease: 'review-001',
  });
  assert.deepEqual(parseArgs(['--activate', 'old-001', '--workbench', '/tmp/tool with spaces']), {
    mode: 'activate',
    existingRelease: 'old-001',
    workbench: '/tmp/tool with spaces',
  });
  for (const args of [
    ['--dry-run', '--stage-only'],
    ['--status', 'review-001', '--release', 'another'],
    ['--release', 'one', '--release', 'two'],
    ['--status'],
    ['--instance', 'i-other'],
    ['--workbench', '--bad'],
  ])
    assert.throws(() => parseArgs(args));
  assert.equal(TARGET.instance, 'i-2zeb1trybvkcp8s281v5');
  assert.equal(TARGET.root, '/opt/english-game');
});

test('release IDs and remote shell commands reject traversal and shell substitutions', () => {
  for (const release of ['', '../escape', '/tmp/x', 'a/b', 'a\nb', '$(id)', 'a;id', 'a_b']) {
    assert.throws(() => validateReleaseId(release));
    assert.throws(() => buildRemoteCommand('stage', release, hash('archive')));
  }
  assert.equal(
    buildRemoteCommand('activate', 'valid-001'),
    "python3 '/opt/english-game/deployments/valid-001/release.py' activate 'valid-001'",
  );
  assert.equal(
    buildRemoteCommand('prepare', 'valid-001'),
    "mkdir -p -- '/opt/english-game/deployments' && mkdir -- '/opt/english-game/deployments/valid-001'",
  );
  assert.throws(() => buildRemoteCommand('stage', 'valid-001', 'wrong'));
  assert.throws(() => buildRemoteCommand('delete', 'valid-001'));
});

test('source allowlist excludes environment files, credentials and local dependencies', () => {
  for (const name of [
    '.env',
    'src/.env.production',
    'scripts/credentials.json',
    'scripts/keys/private.pem',
    'public/private.key',
    'public/assets/.npmrc',
    'scripts/.netrc',
    'scripts/application_default_credentials.json',
    'tests/node_modules/package/index.js',
    'scripts/__pycache__/release.cpython-311.pyc',
    'scripts/release.pyc',
    'node_modules/package/index.js',
    'docs/deployment.md',
    '.workbench/config.json',
  ])
    assert.equal(isSourcePath(name), false, name);
  for (const name of [
    'src/main.tsx',
    'src/rendering/scenery/meadow/secrets.ts',
    'public/favicon.svg',
    'tsconfig.app.json',
    '.prettierrc',
  ])
    assert.equal(isSourcePath(name), true, name);
  for (const name of ['/abs', '../escape', 'src/../escape', 'src//a', 'src/a\\b', 'src/a\nb'])
    assert.throws(() => validateRelativePath(name));
});

test('source fingerprints are deterministic and change for paths, contents or sizes', () => {
  const first = { path: 'src/a.ts', sha256: hash('a'), size: 1 };
  const second = { path: 'src/b.ts', sha256: hash('b'), size: 1 };
  const digest = sourceDigest([first, second]);
  assert.equal(sourceDigest([second, first]), digest);
  assert.notEqual(sourceDigest([{ ...first, sha256: hash('c') }, second]), digest);
  assert.notEqual(sourceDigest([{ ...first, path: 'src/c.ts' }, second]), digest);
  assert.notEqual(sourceDigest([{ ...first, size: 2 }, second]), digest);
  assert.throws(() => sourceDigest([first, first]));
});

test('snapshots copy only allowed regular files and preserve the recorded content', async (t) => {
  const { root, directory } = await fixture(t);
  await writeFile(path.join(root, '.env'), 'DO_NOT_COPY=secret');
  await writeFile(path.join(root, 'src', '.env.local'), 'DO_NOT_COPY=secret');
  await mkdir(path.join(root, 'node_modules'));
  await writeFile(path.join(root, 'node_modules', 'private.js'), 'private');
  const destination = path.join(directory, 'snapshot');
  const source = await createSnapshot(root, destination);
  assert.deepEqual(
    source.files.map((entry: { path: string }) => entry.path),
    ['index.html', 'package-lock.json', 'package.json', 'src/main.ts', 'vite.config.ts'],
  );
  assert.equal(
    await readFile(path.join(destination, 'src/main.ts'), 'utf8'),
    'export const version = 1;',
  );
  assert.equal((await inspectSource(destination)).sha256, source.sha256);
  await assert.rejects(readFile(path.join(destination, '.env')));
  await assert.rejects(readFile(path.join(destination, 'src/.env.local')));
  await writeFile(path.join(root, 'src/main.ts'), 'export const version = 2;');
  assert.notEqual((await inspectSource(root)).sha256, source.sha256);
  assert.equal((await inspectSource(destination)).sha256, source.sha256);
});

test('snapshots refuse links to files or directories outside the workspace', async (t) => {
  const { root, directory } = await fixture(t);
  const outside = path.join(directory, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'secret.txt'), 'private');
  await symlink(path.join(outside, 'secret.txt'), path.join(root, 'src/linked.txt'));
  await assert.rejects(inspectSource(root), /Symbolic links/);
  await rm(path.join(root, 'src/linked.txt'));
  await symlink(outside, path.join(root, 'src/linked-directory'));
  await assert.rejects(inspectSource(root), /Symbolic links/);
});

function artifactManifest() {
  return {
    version: 1,
    release: 'review-001',
    source: { revision: 'a'.repeat(40), dirty: true, sha256: hash('source') },
    files: [
      'site/index.html',
      'site/favicon.svg',
      'site/release.json',
      'site/assets/main-A1.js',
    ].map((name) => ({ path: name, sha256: hash(name), size: 20 })),
  };
}

test('artifact inventories reject duplicate, secret, build-metadata and nested asset entries', () => {
  const valid = artifactManifest();
  assert.equal(validateArtifactManifest(valid), valid);
  for (const name of [
    'site/.env',
    'site/.vite/manifest.json',
    'site/bundle-report.json',
    'site/assets/key.pem',
    'site/assets/nested/file.js',
    'site/assets/../file.js',
    'site/node_modules/index.js',
    'site/index.html',
  ]) {
    const candidate = artifactManifest();
    candidate.files.push({ path: name, sha256: hash('x'), size: 1 });
    assert.throws(() => validateArtifactManifest(candidate), name);
  }
  const oversized = artifactManifest();
  oversized.files[0].size = 30 * 1024 * 1024;
  assert.throws(() => validateArtifactManifest(oversized), /limit/);
  const missing = artifactManifest();
  missing.files = missing.files.filter((entry) => entry.path !== 'site/release.json');
  assert.throws(() => validateArtifactManifest(missing), /missing/);
});

test('remote success requires valid status for the requested release and hides unknown fields', () => {
  const record = {
    release: 'review-001',
    phase: 'active',
    source: artifactManifest().source,
    currentRelease: '/opt/english-game/releases/review-001',
    accessKey: 'do-not-print',
  };
  const parsed = parseRemoteStatus(JSON.stringify(record), 'activate', 'review-001');
  assert.equal(parsed.phase, 'active');
  assert.equal(JSON.stringify(parsed).includes('do-not-print'), false);
  assert.throws(() => parseRemoteStatus('SDK error with sensitive content', 'stage', 'review-001'));
  assert.throws(() => parseRemoteStatus(JSON.stringify(record), 'stage', 'review-001'));
  assert.throws(() => parseRemoteStatus(JSON.stringify(record), 'status', 'other-release'));
  assert.throws(() =>
    parseRemoteStatus(
      JSON.stringify({ ...record, currentRelease: '/tmp/elsewhere' }),
      'status',
      'review-001',
    ),
  );
});

test('CLI failures suppress Workbench credential diagnostics', async (t) => {
  const { directory } = await fixture(t);
  const executable = path.join(directory, 'workbench-failure');
  await writeFile(executable, '#!/bin/sh\necho "FAKE_SDK_ACCESS_KEY" >&2\nexit 3\n', {
    mode: 0o700,
  });
  const entrypoint = fileURLToPath(new URL('../scripts/deploy-ecs.mjs', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [entrypoint, '--status', 'review-001', '--workbench', executable],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Raw command diagnostics are suppressed/);
  assert.equal(`${result.stdout}${result.stderr}`.includes('FAKE_SDK_ACCESS_KEY'), false);
});
