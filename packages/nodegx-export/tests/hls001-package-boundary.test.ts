/**
 * HLS-001 AC2 — nothing under `src/` reaches outside this package.
 *
 * This package used to import two modules by deep relative path — `../../../noodl-editor/src/...`
 * for the default token vocabulary and `../../../noodl-runtime/src/...` for Logic Builder port
 * detection. Both worked, because in this repo the files are right there. Neither works for
 * anybody who installs the package, which is why #36's reporter had to reconstruct it from a
 * shipped sourcemap instead: the exporter could not be installed at all.
 *
 * 🔴 **Specifiers are read with the TypeScript parser, not with a regular expression.** The first
 * version of the sibling gate in `build.mjs` used a regex and reported two offenders that were
 * English prose inside doc comments — a sentence containing "from" followed by a quoted phrase.
 * `src/emit/component.ts` alone contains thousands of import statements *inside emitted string
 * literals*, and every one of them is a string this package writes, not a module it loads. A text
 * scan grades the wrong artefact here; a parse grades the right one.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

const PKG = path.join(__dirname, '..');
const SRC = path.join(PKG, 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));

/** Everything the package declares. `devDependencies` counts because `build.mjs` bundles them. */
const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {})
]);

const sourceFiles = (): string[] =>
  execFileSync('find', [SRC, '-name', '*.ts'], { encoding: 'utf8' }).split('\n').filter(Boolean);

/** Module specifiers this file actually loads — imports, exports and `import(...)` types. */
export function specifiersOf(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      out.push((node.moduleSpecifier as ts.StringLiteral).text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      out.push(node.argument.literal.text);
    }
    // 🔴 `require('x')` and `import('x')` are call expressions, not declarations. The first version
    // of this gate visited only declarations and read GREEN over `parseModules.ts:32`, which loads
    // `@nodegx/module-inject` — an undeclared, unpublished workspace package — with a bare
    // `require()`. The hole was exactly the shape of the defect, and what found it was installing
    // the tarball (AC1), not this file. A gate that cannot see a call expression cannot see how
    // half this repo loads things.
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * Node builtins this package loads. An inventory rather than a policy — every name here was added
 * because a command needed it, and the list is short enough that adding one is a decision somebody
 * makes on purpose. `http`/`https` arrived with HLS-014's `nodegx live`, which is the first command
 * that reads a machine other than this one.
 */
const BUILTINS = new Set([
  'fs',
  'path',
  'vm',
  'crypto',
  'child_process',
  'os',
  'url',
  'util',
  'assert',
  'http',
  'https'
]);

/** `<file>: <specifier>` for every specifier that leaves the package. */
export function escapees(files: string[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    for (const spec of specifiersOf(file)) {
      if (spec.startsWith('.')) {
        // Relative is fine as long as it stays inside the package.
        const resolved = path.resolve(path.dirname(file), spec);
        if (!resolved.startsWith(PKG + path.sep)) out.push(`${path.relative(PKG, file)}: ${spec}`);
        continue;
      }
      if (BUILTINS.has(spec) || spec.startsWith('node:')) continue;
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!declared.has(pkg)) out.push(`${path.relative(PKG, file)}: ${spec}`);
    }
  }
  return out;
}

describe('HLS-001 AC2 — the package does not reach outside itself', () => {
  it('reads a non-trivial number of source files', () => {
    // The control for every assertion below: an empty file list would make all of them pass.
    expect(sourceFiles().length).toBeGreaterThanOrEqual(40);
  });

  it('has no import that escapes the package', () => {
    expect(escapees(sourceFiles())).toEqual([]);
  });

  it('🔴 fails on a reintroduced outbound import (the mutant)', () => {
    // The exact import HLS-001 removed, written to a scratch file inside `src/` and parsed the
    // same way as everything else. Without this row the assertion above would pass just as
    // happily on a broken parser that returned nothing.
    const mutant = path.join(SRC, '__hls001_mutant__.ts');
    fs.writeFileSync(
      mutant,
      "import { DEFAULT_TOKENS } from '../../noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens';\n" +
        'export const x = DEFAULT_TOKENS.length;\n'
    );
    try {
      expect(escapees([mutant])).toHaveLength(1);
      expect(escapees([mutant])[0]).toContain('noodl-editor');
    } finally {
      fs.unlinkSync(mutant);
    }
  });

  it('🔴 fails on an undeclared bare import (the second mutant)', () => {
    const mutant = path.join(SRC, '__hls001_mutant2__.ts');
    fs.writeFileSync(mutant, "import lodash from 'lodash';\nexport const x = lodash;\n");
    try {
      expect(escapees([mutant])).toEqual([`src/__hls001_mutant2__.ts: lodash`]);
    } finally {
      fs.unlinkSync(mutant);
    }
  });

  it('🔴 sees a bare `require()` call, not just an import declaration (the third mutant)', () => {
    // The row that would have caught `@nodegx/module-inject`. Installing the tarball caught it
    // instead, which is a more expensive instrument and one that only runs when somebody thinks
    // to run it.
    const mutant = path.join(SRC, '__hls001_mutant3__.ts');
    fs.writeFileSync(mutant, "const x = require('some-undeclared-package');\nexport default x;\n");
    try {
      expect(escapees([mutant])).toEqual([`src/__hls001_mutant3__.ts: some-undeclared-package`]);
    } finally {
      fs.unlinkSync(mutant);
    }
  });

  it('does not mistake an import inside an emitted string literal for one this package loads', () => {
    // `src/emit/component.ts` writes `import ... from '../../../lib/script'` into the generated
    // app. It is a string, and the parse must not see it. If this ever reads > 0 the gate has
    // started grading the emitted app instead of this package.
    const emitters = sourceFiles().filter((f) => f.includes(`${path.sep}emit${path.sep}`));
    expect(emitters.length).toBeGreaterThan(10);
    expect(escapees(emitters)).toEqual([]);
  });
});
