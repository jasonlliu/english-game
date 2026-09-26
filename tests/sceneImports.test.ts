import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const regionDirectory = path.join(projectRoot, 'src/rendering/scenery/regions');
const config = ts.readConfigFile(path.join(projectRoot, 'tsconfig.json'), ts.sys.readFile);
assert.equal(
  config.error,
  undefined,
  'The dependency audit must use the project TypeScript config',
);
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot).options;
const sourceCache = new Map<string, string[]>();

/** Only emitted static edges count: type references and import() stay deferred. */
function runtimeSpecifiers(source: ts.SourceFile): string[] {
  const imports: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const bindings = clause?.namedBindings;
      if (
        !clause?.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly)
      )
        continue;
      imports.push(statement.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (
        clause &&
        ts.isNamedExports(clause) &&
        clause.elements.length > 0 &&
        clause.elements.every((element) => element.isTypeOnly)
      )
        continue;
      imports.push(statement.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      imports.push(statement.moduleReference.expression.text);
    }
  }
  return imports;
}

function staticClosure(entry: string) {
  const modules = new Map<string, string[]>();
  const external = new Map<string, string[]>();
  function visit(file: string, chain: string[]) {
    if (modules.has(file)) return;
    const route = [...chain, path.relative(projectRoot, file)];
    modules.set(file, route);
    let imports = sourceCache.get(file);
    if (!imports) {
      imports = runtimeSpecifiers(
        ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true),
      );
      sourceCache.set(file, imports);
    }
    for (const specifier of imports) {
      const resolved = ts.resolveModuleName(
        specifier,
        file,
        compilerOptions,
        ts.sys,
      ).resolvedModule;
      if (
        resolved &&
        !resolved.isExternalLibraryImport &&
        !resolved.resolvedFileName.endsWith('.d.ts')
      ) {
        visit(path.resolve(resolved.resolvedFileName), route);
      } else if (!specifier.startsWith('.')) {
        external.set(specifier, [...route, specifier]);
      } else if (!/\.(css|svg|png|jpe?g|webp|woff2?|json)(\?.*)?$/.test(specifier)) {
        assert(resolved, `Cannot resolve static dependency: ${[...route, specifier].join(' → ')}`);
      }
    }
  }
  visit(path.resolve(projectRoot, entry), []);
  return { modules, external };
}

const isRegion = (file: string) => file.startsWith(regionDirectory + path.sep);
const dependencyMessage = (chain: string[]) => `Unexpected eager dependency: ${chain.join(' → ')}`;

test('the dependency audit follows runtime imports/re-exports and excludes type-only or dynamic edges', () => {
  const source = ts.createSourceFile(
    'edges.ts',
    `
    import type DefaultType from './type-default';
    import { type OnlyType } from './type-named';
    import './side-effect';
    import DefaultValue, { type ExtraType } from './default-value';
    import { type OneType, runtimeValue } from './mixed-value';
    import {} from './empty-import';
    export type { ExportType } from './type-export';
    export { type OtherType } from './type-named-export';
    export * from './star-export';
    export * as namespaceValue from './namespace-export';
    export { type ThirdType, exportedValue } from './mixed-export';
    export {} from './empty-export';
    const deferred = () => import('./deferred');
  `,
    ts.ScriptTarget.Latest,
    true,
  );
  assert.deepEqual(runtimeSpecifiers(source), [
    './side-effect',
    './default-value',
    './mixed-value',
    './empty-import',
    './star-export',
    './namespace-export',
    './mixed-export',
    './empty-export',
  ]);
});

test('each region stays isolated even when shared dependencies are merged into one output chunk', () => {
  const regionFiles = readdirSync(regionDirectory).filter((file) => file.endsWith('.ts'));
  assert(regionFiles.length >= 6, 'Every region needs an independent entry module');
  for (const file of regionFiles) {
    const entry = path.join(regionDirectory, file);
    for (const [dependency, chain] of staticClosure(entry).modules) {
      assert(!isRegion(dependency) || dependency === entry, dependencyMessage(chain));
    }
  }
});

test('the outdoor runtime cannot statically include region entries or the indoor runtime', () => {
  const templeEntry = path.join(projectRoot, 'src/components/TempleScene.tsx');
  const templeDirectory = path.join(projectRoot, 'src/rendering/temple') + path.sep;
  for (const [dependency, chain] of staticClosure('src/components/WorldScene.tsx').modules) {
    assert(
      !isRegion(dependency) &&
        dependency !== templeEntry &&
        !dependency.startsWith(templeDirectory),
      dependencyMessage(chain),
    );
  }
});

test('the application shell cannot statically reach Three.js through a component or shared barrel', () => {
  const closure = staticClosure('src/main.tsx');
  for (const [specifier, chain] of closure.external) {
    assert(!/^three(?:\/|$)/.test(specifier), dependencyMessage(chain));
  }
});
