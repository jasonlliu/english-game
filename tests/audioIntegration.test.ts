import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function sourceAt(relative: string) {
  return ts.createSourceFile(
    relative,
    readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function walk(source: ts.Node, check: (node: ts.Node) => void) {
  check(source);
  source.forEachChild((child) => walk(child, check));
}

function isAudioRuntime(node: ts.Node) {
  if (!ts.isNewExpression(node) && !ts.isCallExpression(node)) return false;
  const expression = node.expression;
  const name = ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : '';
  return [
    'Audio',
    'AudioContext',
    'webkitAudioContext',
    'AudioListener',
    'PositionalAudio',
    'AudioLoader',
  ].includes(name);
}

test('scene and capture components receive audio callbacks without importing or constructing an audio runtime', () => {
  for (const file of ['WorldScene', 'TempleScene', 'CaptureGame']) {
    walk(sourceAt(`src/components/${file}.tsx`), (node) => {
      assert.equal(
        isAudioRuntime(node),
        false,
        `${file} must leave audio resource ownership to the application`,
      );
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.includes('/audio/')
      ) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const typeOnly =
          clause?.isTypeOnly ||
          (!clause?.name &&
            bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((binding) => binding.isTypeOnly));
        assert.ok(typeOnly, `${file} may import audio types only`);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = node.arguments[0];
        assert.ok(
          !specifier || !ts.isStringLiteral(specifier) || !specifier.text.includes('/audio/'),
          `${file} must not own a deferred audio engine either`,
        );
      }
    });
  }
});

test('pure game transitions never create browser audio as a side effect', () => {
  // architecture.test.ts already prohibits dependencies from game rules to audio/UI.
  // Cover browser globals too, which could otherwise bypass that import boundary.
  const files = readdirSync(new URL('../src/game/', import.meta.url)).filter((file) =>
    file.endsWith('.ts'),
  );
  for (const file of files) {
    walk(sourceAt(`src/game/${file}`), (node) => {
      assert.equal(
        isAudioRuntime(node),
        false,
        `${file} must remain usable without a browser audio context`,
      );
    });
  }
});
