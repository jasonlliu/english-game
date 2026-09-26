import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const gameRoot = new URL('../src/game/', import.meta.url);
test('domain rules and the session remain independent of React, rendering and UI', () => {
  for (const file of readdirSync(gameRoot).filter((file) => file.endsWith('.ts'))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, gameRoot), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const specifier = statement.moduleSpecifier.text;
      assert(specifier.startsWith('./'), `${file} must not depend on an outer layer: ${specifier}`);
    }
  }
});

test('portrait UI imports its renderer only through a dynamic module boundary', () => {
  const path = new URL('../src/components/CompanionPortrait.tsx', import.meta.url);
  const source = ts.createSourceFile(
    fileURLToPath(path),
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    if (statement.importClause?.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier.text;
    assert(
      !/three|models|portraits\/service/.test(specifier),
      `Portrait component eagerly imports GPU code: ${specifier}`,
    );
  }
});

test('HUD map data and flight eligibility do not eagerly import world simulation', () => {
  const files = [
    'app/useAdventureController.ts',
    'app/worldTelemetry.ts',
    'features/hud/WorldMap.tsx',
    'features/hud/MinimapHud.tsx',
    'game/worldLayout.ts',
    'game/flightEligibility.ts',
  ];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every((item) => item.isTypeOnly)
      )
        continue;
      assert(
        !/(\/world|\/flight)$|rendering|three/.test(statement.moduleSpecifier.text),
        `${file} eagerly imports world simulation`,
      );
    }
  }
});
