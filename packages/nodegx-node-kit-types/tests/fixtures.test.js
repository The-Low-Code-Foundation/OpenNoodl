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
const fs = require('fs');
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

/**
 * Apply one edit to a fixture, typecheck it, put it back. The fixture on disk is
 * always restored, including when the compile throws.
 *
 * @returns {string[]} the diagnostics the faulted file produced
 */
function withFault(fixture, from, to) {
  const file = path.join(FIXTURES, fixture, 'index.js');
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(from)) throw new Error(`fault anchor not in ${fixture}: ${from.slice(0, 40)}`);
  try {
    fs.writeFileSync(file, original.replace(from, to));
    return diagnosticsFor(fixture);
  } finally {
    fs.writeFileSync(file, original);
  }
}

/**
 * Ask the compiler what it resolved something to, by assigning it to `never` and
 * reading the error back. The only way to prove a green fixture is green because
 * the types work rather than because they silently did not load.
 *
 * @param {string} anchor a line in the fixture to insert after
 * @param {string[]} statements each is annotated `@type {never}`
 */
function probeTypesIn(fixture, anchor, statements) {
  const injected = statements.map((s) => `          /** @type {never} */ ${s}`).join('\n');
  return withFault(fixture, anchor, `${anchor}\n${injected}`);
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

/**
 * CN-012 AC3 — the LOGIC half, which is why the provisional marker came off.
 *
 * `kit-annotated` above is a *visual* kit. Until CN-012 nothing in this package
 * exercised `nodes` / `LogicNodeDefinition` at all, and that absence was the
 * stated reason the logic types were marked provisional. This is the fixture
 * that replaces the marker with a check.
 */
describe('a correct annotated LOGIC kit', () => {
  it('typechecks clean', () => {
    expect(diagnosticsFor('kit-logic')).toEqual([]);
  });

  /**
   * 🔴 The zero above is worthless on its own — this package's own header says
   * so: a `.d.ts` that failed to resolve, or one whose every member is `any`,
   * produces the same zero. These two ask the compiler what it actually
   * resolved, so a silent non-resolution cannot pass for a clean kit.
   *
   * Both work by assigning to `never`: the error message *is* the answer.
   */
  it('resolves `this` in a logic callback to NodeInstance, not any', () => {
    const answers = probeTypesIn('kit-logic', '          this._internal.reading = Number(value);', [
      'var _probeThis = this;',
      'var _probeFn = this.shouldRunOnValueChange;'
    ]);
    expect(answers).toEqual([
      "Type 'NodeInstance' is not assignable to type 'never'.",
      "Type '(inputName: string) => boolean' is not assignable to type 'never'."
    ]);
  });

  /**
   * The planted faults that MUST fire. Applied to the real fixture and reverted,
   * rather than kept as a second file, because what is being graded is that
   * *this* green arm would have gone red — a separate broken fixture can drift
   * away from the file it is supposed to be the control for.
   */
  const mentioning = (diagnostics, needle) => diagnostics.filter((d) => d.includes(needle));

  it('would have caught a missing required field and a malformed runOnValueChange', () => {
    const typo = withFault('kit-logic', "category: 'Math',\n    color: 'data',", "categry: 'Math',\n    color: 'data',");
    expect(mentioning(typo, 'categry')).not.toEqual([]);

    const noSignal = withFault('kit-logic', "controlSignal: 'read',\n      inputs: ['reading']", "inputs: ['reading']");
    expect(mentioning(noSignal, 'controlSignal')).not.toEqual([]);
  });

  /**
   * 🔴 **And the precise limit of the row above, because it is narrower than it
   * looks.** `categry` is caught for one reason only: `category` is *required*,
   * so misspelling it makes a required field go missing. Misspell an **optional**
   * top-level field and nothing is reported — measured on `displayNodeName` and
   * `docs`, both silent.
   *
   * ⚠️ This is the asymmetry CN-005 closed for `ReactNodeDefinition` and did not
   * close here: that interface's property set really is closed, so its index
   * signature was dropped, and `drift.test.js` asserts that it is **the one**
   * deliberate divergence. Closing `NodeDefinitionOptions` the same way was tried
   * during CN-012 and is a real improvement — but it makes a *second* divergence
   * and turns that drift row red, so it is CN-005's decision to take, not a
   * side-effect of establishing the logic half. Recorded here so the next person
   * finds the measurement rather than repeating it.
   */
  it('does NOT catch an optional top-level typo — the limit, measured', () => {
    expect(withFault('kit-logic', "displayNodeName: 'Tally Accumulator',", "dispayNodeName: 'Tally Accumulator',")).toEqual([]);
    expect(withFault('kit-logic', "docs: 'Adds Step", "dcos: 'Adds Step")).toEqual([]);
  });

  /**
   * ⚠️ **What it does NOT catch, said out loud rather than left to be found.**
   * Measured, all three silent: a misspelt method on `this`, a misspelt member
   * on the module object, and a nonsense port `default`.
   *
   * The cause is one deliberate decision, not three bugs: {@link NodeInstance}
   * and {@link NodeKitModule} both carry an index signature because both are
   * **partial** — the runtime has more members than this file lists, and
   * removing the signature would turn every legitimate unlisted call into an
   * error. CN-005 removed it from `ReactNodeDefinition`, where the property set
   * really is closed, and asserted that divergence in `drift.test.js`.
   *
   * This row exists so the limit is a recorded fact with a test behind it. If
   * one of these ever starts being caught, that is a real improvement and
   * somebody should hear about it here.
   */
  it('does NOT catch a typo behind an index signature, and that is deliberate', () => {
    expect(withFault('kit-logic', "this.flagOutputDirty('total');", "this.flagOutputDirtee('total');")).toEqual([]);
    expect(withFault('kit-logic', 'var module_ = { nodes:', 'var module_ = { noeds:')).toEqual([]);
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
