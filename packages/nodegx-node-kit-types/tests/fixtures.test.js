/**
 * CN-005 AC3 — the published types compile, and they compile *something*.
 *
 * Two fixtures, and the pair is the point:
 *
 * - `kit-annotated` is a correct kit and must produce **no** diagnostics.
 * - `kit-broken` plants five specific mistakes and each must be **reported**.
 *
 * The second is what makes the first mean anything. A `.d.ts` that failed to
 * resolve, or one whose every member is `any`, passes the green fixture in
 * silence — the two outcomes are indistinguishable without a control that has to
 * go red. Each expectation names the identifier it is looking for rather than
 * counting errors, so a fixture that breaks for a *different* reason does not
 * quietly stand in for the one being graded.
 */
const path = require('path');
const ts = require('typescript');

const FIXTURES = path.join(__dirname, 'fixtures');

/** Typecheck one loose .js file the way an editor does: allowJs + checkJs off, `// @ts-check` on in the file. */
function diagnosticsFor(fixture) {
  const file = path.join(FIXTURES, fixture, 'index.js');
  const program = ts.createProgram([file], {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    noEmit: true,
    skipLibCheck: true
  });
  const sourceFile = program.getSourceFile(file);
  return ts
    .getPreEmitDiagnostics(program, sourceFile)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
}

describe('the published .d.ts itself', () => {
  /**
   * Two environments, because the file is consumed in two and they differ.
   *
   * @param {string[]|undefined} types `[]` models a kit project — no
   *   `node_modules`, so no `@types/*` in scope. `undefined` is the default,
   *   which pulls in every `@types` package it can find above the file.
   */
  const compile = (types) => {
    const file = path.join(__dirname, '..', 'src', 'index.d.ts');
    const program = ts.createProgram([file], {
      strict: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      // 🔴 MUST stay false, and this was measured the hard way: `skipLibCheck`
      // skips type checking of *every* `.d.ts`, not just the bundled lib files.
      // With it on, this test — and an `npx tsc --noEmit --strict --skipLibCheck`
      // run on the same file — passed happily with `NoSuchTypeAtAll` substituted
      // into the file. It graded nothing at all.
      skipLibCheck: false,
      ...(types ? { types } : {})
    });
    return ts
      .getPreEmitDiagnostics(program, program.getSourceFile(file))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
  };

  it('compiles clean in a kit project, which is what it ships for', () => {
    expect(compile([])).toEqual([]);
  });

  it('collides with @types/react exactly once, and no more than that', () => {
    // A stated limitation rather than a hidden one. The file declares a global
    // `React: any` because a kit has no React types to resolve and every kit
    // opens by reaching for it — but in a project that *does* have
    // `@types/react` (this repo, and anywhere CN-007's examples get compiled)
    // that declaration collides with React's own UMD global.
    //
    // Pinned rather than skipped: if this ever becomes two diagnostics, the
    // limitation has grown and somebody should hear about it.
    expect(compile(undefined)).toEqual(["Cannot redeclare block-scoped variable 'React'."]);
  });

});

describe('a correct annotated kit', () => {
  it('typechecks clean', () => {
    expect(diagnosticsFor('kit-annotated')).toEqual([]);
  });
});

describe('the control: a kit with five planted mistakes', () => {
  let diagnostics;
  beforeAll(() => {
    diagnostics = diagnosticsFor('kit-broken');
  });

  const mentions = (needle) => () => {
    expect(diagnostics.filter((d) => d.includes(needle))).not.toEqual([]);
  };

  it('reports the missing required `name`', mentions("'name'"));
  it('reports the `dispayNodeName` typo at the top level', mentions('dispayNodeName'));
  it('reports the numeric port type', mentions('PortType'));
  it('reports the `displayNam` typo inside a port', mentions('displayNam'));
  it('reports the visual state missing its `label`', mentions("'label'"));

  it('reports nothing else, so the five above are the whole story', () => {
    // Not a count assertion for its own sake: an extra diagnostic here means a
    // fixture broke for a reason nobody chose, and one of the five tests above
    // may be passing on the wrong error.
    expect(diagnostics.length).toBe(5);
  });
});
