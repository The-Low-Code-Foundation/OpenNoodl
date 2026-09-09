/**
 * Builds `@nodegx/export` into the entry points its `exports` map advertises, in ESM and CJS,
 * plus declarations. HLS-001.
 *
 * ## Why everything is bundled, including a workspace package
 *
 * `@nodegx/project-contract` is a private workspace package — it is where HLS-001 put the two
 * modules this package used to reach for by relative path into `noodl-editor` and `@noodl/runtime`.
 * esbuild inlines it here, so the published tarball is self-contained and does not depend on a
 * package that is not on the registry. That is the whole reason the contract package does not
 * itself have to be published.
 *
 * ⚠️ Consequently: **anything added to `dependencies` is bundled unless it is listed in `external`
 * below.** Node builtins are external by `platform: 'node'`.
 *
 * ## In-repo consumers do not go through this
 *
 * The editor resolves `@nodegx/export` by explicit alias to `src/` in three places — its
 * `tsconfig.json` paths, its `jest.config.js` moduleNameMapper, and `webpack.shared.js` — so
 * `main`/`exports` pointing at `dist/` changes nothing about how the editor builds or tests, and
 * `dist/` being absent cannot break a build in this repo. It is a publishing artefact only.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, globSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import esbuild from 'esbuild';
import ts from 'typescript';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

/**
 * The node catalog travels with the package (HLS-001 AC4). It is authored in `@noodl/types` and
 * copied here by the build, never edited in this package — a generated copy cannot drift, and a
 * consumer who installed the exporter from a registry has no `@noodl/types` to read it from.
 */
copyFileSync('../noodl-types/src/node-catalog.json', 'dist/node-catalog.json');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info'
};

// `index` is the library; `ledger` is a second entry because the editor's export badge imports
// `@nodegx/export/ledger` on its own, and a consumer of the published package can too.
/**
 * 🔴 The ESM output needs a real `require`, and this is not a nicety.
 *
 * esbuild's ESM output replaces `require()` with a shim that throws *"Dynamic require of "fs" is
 * not supported"* at import time. This package bundles `@nodegx/module-inject`, a CommonJS
 * workspace package that `parse/parseModules.ts` loads with a bare `require()`, so the very first
 * `import '@nodegx/export'` from an installed tarball threw before running a line of export code.
 * Nothing in this repo caught it: the editor consumes `src/`, and the test suite runs under CJS.
 * Installing the tarball and calling it (HLS-001 AC1) is what found it — which is the argument for
 * that acceptance criterion being a real install rather than a unit test.
 */
const esmBanner = {
  js: [
    "import { createRequire as __nodegxCreateRequire } from 'node:module';",
    "import { fileURLToPath as __nodegxFileURLToPath } from 'node:url';",
    "import { dirname as __nodegxDirname } from 'node:path';",
    'const require = __nodegxCreateRequire(import.meta.url);',
    // `catalogPath()` resolves the catalog that ships in `dist/` relative to the module that reads
    // it. CommonJS gives it `__dirname` for free and ESM does not, so the second run of AC1 threw
    // `__dirname is not defined in ES module scope` — one layer under the `require` failure, and
    // invisible until the first one was fixed. Two defects in the same install, each hidden by the
    // one in front of it.
    'const __filename = __nodegxFileURLToPath(import.meta.url);',
    'const __dirname = __nodegxDirname(__filename);'
  ].join('\n')
};

for (const entry of ['index', 'ledger']) {
  await esbuild.build({ ...shared, entryPoints: [`src/${entry}.ts`], format: 'esm', banner: esmBanner, outfile: `dist/${entry}.mjs` });
  await esbuild.build({ ...shared, entryPoints: [`src/${entry}.ts`], format: 'cjs', outfile: `dist/${entry}.cjs` });
}

// Declarations come from tsc, which esbuild does not emit. `tsconfig.build.json` sets an explicit
// `outDir`: a `tsc -p` without one emits beside the sources, which is how this repo has previously
// turned a typecheck into eighty-five red suites.
execFileSync('npx', ['tsc', '--project', 'tsconfig.build.json'], { stdio: 'inherit' });

/**
 * 🔴 The declarations are pruned to what the entry points actually reach, and then gated.
 *
 * tsc emits a `.d.ts` for all 42 source files, and one of them — `analyze/logicbuilder.d.ts` —
 * names `@nodegx/project-contract`, which is bundled into the JavaScript and is **not** on the
 * registry. Nothing public reaches that file today, so a consumer never loads it and nothing
 * breaks. That is exactly what makes it worth removing: the day something re-exports
 * `visualIoOf`, the tarball starts pointing at a package that does not exist, and the failure
 * lands on somebody else's `npm i`, not on this build.
 *
 * So: keep the declarations reachable from the entry points, delete the rest, and fail the build
 * if anything that survives names a module this package does not actually ship or depend on.
 */
const runtimeDeps = new Set(Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies ?? {}));

/**
 * ⚠️ Module specifiers are read with the TypeScript parser, not with a regular expression.
 * The first version of this gate matched `/(?:from|import)\s*['"]([^'"]+)['"]/` and reported two
 * offenders that were **English prose inside doc comments** — a sentence containing the word
 * "from" followed by a quoted phrase. A gate that invents findings is worse than no gate, and this
 * file is generated code the package is about to publish, so it gets parsed properly.
 */
const specifiersOf = (file) => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      out.push(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      out.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
};

const reachable = new Set();
const walk = (file) => {
  if (reachable.has(file) || !existsSync(file)) return;
  reachable.add(file);
  for (const spec of specifiersOf(file)) {
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    walk(target.endsWith('.d.ts') ? target : `${target}.d.ts`);
  }
};
for (const entry of ['index', 'ledger']) walk(resolve(`dist/${entry}.d.ts`));

let pruned = 0;
for (const file of globSync('dist/**/*.d.ts').map((f) => resolve(f))) {
  if (reachable.has(file)) continue;
  rmSync(file);
  pruned += 1;
}

const offenders = [];
for (const file of reachable) {
  for (const spec of specifiersOf(file)) {
    if (spec.startsWith('.') || isBuiltin(spec)) continue;
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!runtimeDeps.has(pkg)) offenders.push(`${relative('.', file)} -> ${spec}`);
  }
}
if (offenders.length > 0) {
  throw new Error(
    `Published declarations name modules that are not runtime dependencies:\n  ${offenders.join('\n  ')}\n` +
      'Either add the package to `dependencies` (and publish it), or keep the type out of the reachable surface.'
  );
}

console.log(`\ndeclarations: ${reachable.size} shipped, ${pruned} pruned as unreachable`);
