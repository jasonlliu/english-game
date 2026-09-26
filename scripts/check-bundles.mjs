import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const root = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', root), 'utf8'));
const records = Object.entries(manifest);
const entry = records.find(([, value]) => value.isEntry)?.[0];
assert(entry, 'Vite manifest must expose the HTML entry');
const resolveSource = (source) => {
  const result = records.find(([key, value]) => key === source || value.src === source)?.[0];
  assert(result, `Missing independent chunk for ${source}`);
  return result;
};
function closure(keys) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    assert(manifest[key], `Unknown manifest dependency ${key}`);
    seen.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  keys.forEach(visit);
  return seen;
}
const sizes = new Map();
for (const [key, value] of records) {
  const content = await readFile(new URL(value.file, root));
  sizes.set(key, { raw: content.byteLength, gzip: gzipSync(content).byteLength });
}
function sum(keys) {
  return [...keys].reduce(
    (total, key) => ({
      raw: total.raw + sizes.get(key).raw,
      gzip: total.gzip + sizes.get(key).gzip,
    }),
    { raw: 0, gzip: 0 },
  );
}
function budget(label, actual, limit) {
  assert(
    actual <= limit,
    `${label}: ${(actual / 1024).toFixed(1)} KiB exceeds ${(limit / 1024).toFixed(1)} KiB budget`,
  );
}
const initial = closure([entry]);
const world = resolveSource('src/components/WorldScene.tsx');
const temple = resolveSource('src/components/TempleScene.tsx');
const regionNames = ['meadow', 'water', 'fire', 'earth', 'steel', 'fairy'];
const regions = regionNames.map((name) =>
  resolveSource(`src/rendering/scenery/regions/${name}.ts`),
);
assert.equal(
  new Set(regions.map((key) => manifest[key].file)).size,
  regionNames.length,
  'Regions must have distinct loadable files',
);
for (const key of [world, temple, ...regions])
  assert(!initial.has(key), `Initial shell eagerly includes ${key}`);
assert(
  ![...initial].some((key) => /three/i.test(manifest[key].file)),
  'Three.js must not be a static dependency of the HTML shell',
);
for (const region of regions) {
  const imports = closure([region]);
  for (const other of regions)
    if (other !== region) assert(!imports.has(other), `${region} eagerly includes ${other}`);
  budget(`${region} code`, sizes.get(region).gzip, 12 * 1024);
}
for (const region of regions)
  assert(!closure([world]).has(region), `Outdoor controller eagerly imports ${region}`);
assert(!closure([world]).has(temple), 'Outdoor scene must not include the temple runtime');
const initialSize = sum(initial);
budget('Initial JS raw', initialSize.raw, 320 * 1024);
budget('Initial JS gzip', initialSize.gzip, 95 * 1024);
const playable = sum(closure([entry, world, regions[0]]));
budget('First playable world gzip', playable.gzip, 310 * 1024);
const sharedThree = records.filter(([, value]) => /\/three-/.test(value.file));
for (const [key] of sharedThree) budget('Shared Three runtime raw', sizes.get(key).raw, 550 * 1024);
const cssFiles = new Set([...initial].flatMap((key) => manifest[key].css ?? []));
let css = 0;
for (const file of cssFiles) css += gzipSync(await readFile(new URL(file, root))).byteLength;
budget('Initial CSS gzip', css, 18 * 1024);
const report = {
  initialJs: initialSize,
  firstPlayableJs: playable,
  initialCssGzip: css,
  regions: Object.fromEntries(regions.map((key, index) => [regionNames[index], sizes.get(key)])),
  deferredTemple: sizes.get(temple),
  units: 'bytes; gzip is measured, not a simulated network latency',
};
await writeFile(new URL('bundle-report.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
console.log('Bundle budgets and lazy-loading boundaries passed.');
