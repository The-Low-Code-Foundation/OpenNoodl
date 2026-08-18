/**
 * CN-006 AC2 — *"the generated `index.js` produces autocomplete in VS Code with
 * no `tsconfig` and no `node_modules`."*
 *
 * Same instrument as CN-005's `resolution.test.js`: the **TypeScript language
 * service**, the process VS Code actually runs to build its completion list.
 * The difference — and the reason this exists rather than being covered there —
 * is the input. CN-005 drove a hand-written five-line kit that it wrote itself
 * to be favourable. This drives the exact bytes `writeKitScaffold` puts on disk,
 * which is the only version anybody will ever open.
 *
 * ⚠️ **The assertion that makes this mean anything is the negative one.** A
 * completion list that merely *contains* `inputCss` is offered in both worlds if
 * the fallback happens to include it; what tells them apart is that the working
 * arm does **not** offer `document`. CN-005 measured the broken arm at ~1,200
 * DOM globals, so the two outcomes are only distinguishable by what is absent.
 */

/* eslint-env jest */

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const { writeKitScaffold } = require('../src/index');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-ac2-'));
let kitFile;

beforeAll(async () => {
  const written = await writeKitScaffold(ROOT, { name: 'Weather Kit' });
  expect(written.ok).toBe(true);
  kitFile = path.join(ROOT, 'noodl_modules', 'weather-kit', 'index.js');
});

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

/** What an editor would show for a loose JS file belonging to no project. */
function askEditor(file) {
  const options = {
    allowJs: true,
    checkJs: false, // `// @ts-check` in the file turns it on, exactly as in VS Code
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    allowNonTsExtensions: true,
    noEmit: true
  };
  const text = fs.readFileSync(file, 'utf8');
  const host = {
    getScriptFileNames: () => [file],
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined),
    getCurrentDirectory: () => path.dirname(file),
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const at = (marker) => {
    const position = text.indexOf(marker);
    if (position < 0) throw new Error(`marker not found: ${marker}`);
    const completions = service.getCompletionsAtPosition(file, position, {});
    return completions ? completions.entries.map((e) => e.name) : [];
  };

  return {
    at,
    diagnostics: service.getSemanticDiagnostics(file).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
  };
}

/** Walk upwards and confirm the claim this whole test rests on. */
function ancestorsCarrying(dir, entry) {
  const found = [];
  let current = dir;
  for (;;) {
    if (fs.existsSync(path.join(current, entry))) found.push(current);
    const parent = path.dirname(current);
    if (parent === current) return found;
    current = parent;
  }
}

describe('AC2 — the scaffolded kit, opened cold', () => {
  it('really has no node_modules, tsconfig or package.json anywhere above it', () => {
    // Asserted rather than assumed: under a repository checkout every result
    // below would be measuring the wrong thing and still look right.
    const dir = path.dirname(kitFile);
    expect(ancestorsCarrying(dir, 'node_modules')).toEqual([]);
    expect(ancestorsCarrying(dir, 'tsconfig.json')).toEqual([]);
    expect(ancestorsCarrying(dir, 'package.json')).toEqual([]);
  });

  it('reports no diagnostics at all', () => {
    // 🔴 Not cosmetic. CN-005 found that the globals a kit runs against were
    // undeclared, so every annotated kit reported `Cannot find name 'Noodl'` on
    // line one — a scaffold whose first act is to underline itself in red would
    // teach an author that annotations are a nuisance.
    expect(askEditor(kitFile).diagnostics).toEqual([]);
  });

  it('offers the definition’s own fields where a new one would be typed', () => {
    // ⚠️ The fields already present in the file are deliberately absent from
    // this list — TypeScript filters members an object literal already has. So
    // the evidence is the ones the scaffold does *not* use: an author who
    // reaches for a capability the example did not need is offered it by name.
    //
    // ✅ **`docs` left this list on 2026-08-18 and that is the point.** The
    // scaffold now sets it (CN-008 measured that a kit node reached both the AI
    // assistant and the property panel with no statement of what it is for), so
    // TypeScript filters it exactly as this comment describes. `docsUrl` (D10)
    // took its place: the scaffold mentions it only in a comment, so it is
    // still a real completion — which is the whole discoverability claim for a
    // field an author would otherwise never learn exists.
    const members = askEditor(kitFile).at('    noodlNodeAsProp: true,');
    expect(members).toEqual(
      expect.arrayContaining(['dynamicports', 'frame', 'getInspectInfo', 'initialize', 'docsUrl', 'methods'])
    );
  });

  it('and the two fields the scaffold now SETS are filtered, not missing', () => {
    // 🔴 The row above proves `docsUrl` is offered. On its own that is also
    // what a file where `docs` simply failed to resolve would look like. This
    // one separates the two: `docs` must be absent from the completion list
    // *and* present in the emitted file. Same for `displayNodeName`, which has
    // always been set — so a resolution failure cannot pass either row.
    const members = askEditor(kitFile).at('    noodlNodeAsProp: true,');
    expect(members).not.toContain('docs');
    expect(members).not.toContain('displayNodeName');

    const source = fs.readFileSync(kitFile, 'utf8');
    expect(source).toContain('docs:');
    expect(source).toContain('displayNodeName:');
  });

  it('offers port fields inside a port', () => {
    const members = askEditor(kitFile).at("displayName: 'Label', group: 'Content'");
    expect(members).toEqual(expect.arrayContaining(['allowVisualStates', 'description', 'onChange', 'tooltip']));
  });

  it('🔴 and it is not the global fallback wearing a disguise', () => {
    // The whole test. The broken arm CN-005 measured offers ~1,200 DOM globals
    // and would satisfy every `arrayContaining` above by accident.
    const members = askEditor(kitFile).at('    noodlNodeAsProp: true,');
    expect(members).not.toContain('document');
    expect(members).not.toContain('XMLHttpRequest');
    expect(members.length).toBeLessThan(100);
  });

  it('catches the typo the index signature used to hide', () => {
    // CN-005's second hole: `dispayNodeName` matched `[extra: string]: unknown`
    // and drew no diagnostic, while the bridge silently dropped it. Asserted on
    // the *scaffolded* file, because a published type that catches it is only
    // useful if the file an author edits is annotated at all.
    const broken = kitFile.replace('index.js', 'typo.js');
    fs.writeFileSync(broken, fs.readFileSync(kitFile, 'utf8').replace('displayNodeName:', 'dispayNodeName:'), 'utf8');
    try {
      const diagnostics = askEditor(broken).diagnostics.join(' ');
      expect(diagnostics).toContain('dispayNodeName');
    } finally {
      fs.rmSync(broken);
    }
  });

  it('CONTROL — the same file with its annotation removed loses all of it', () => {
    // Without this, every assertion above could be true of a file that needs no
    // annotation to typecheck, and the `@type` line would be doing nothing.
    const bare = kitFile.replace('index.js', 'bare.js');
    fs.writeFileSync(
      bare,
      fs.readFileSync(kitFile, 'utf8').replace(/\/\*\* @type \{import\('\.\/types\/node-kit'\)\.[A-Za-z]+\} \*\/\n/g, ''),
      'utf8'
    );
    try {
      const members = askEditor(bare).at('    noodlNodeAsProp: true,');
      expect(members).toContain('document');
      expect(members).not.toContain('inputCss');
    } finally {
      fs.rmSync(bare);
    }
  });
});
