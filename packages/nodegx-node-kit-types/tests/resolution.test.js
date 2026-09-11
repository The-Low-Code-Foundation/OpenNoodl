/**
 * CN-005 AC1 — a kit author gets autocomplete with no build step.
 *
 * The criterion asks for this to be verified in a real editor rather than by
 * inspecting the `.d.ts`. This drives the **TypeScript language service** — the
 * process VS Code runs to produce its completion list — over a kit assembled in
 * a throwaway directory. It is the same question an editor answers, asked
 * directly, and unlike a screenshot it re-answers itself on every run.
 *
 * ## 🔴 The criterion's premise was false, and both arms are kept here
 *
 * AC1 as written asks for autocomplete in a project with **no `node_modules`**,
 * through `import('@nodegx/node-kit-types')`. Measured: a bare specifier resolves
 * only when the package is physically installed somewhere above the file. With no
 * `node_modules` the annotation is dead — `Cannot find module` — and the
 * completion list falls back to a thousand DOM globals. There is no editor
 * setting, and no way for a kit inside a NodeGX project to arrange otherwise.
 *
 * What does work, with the same zero configuration, is a **relative path** to a
 * copy of the `.d.ts` sitting in the kit folder. That is what this package ships
 * for and what the scaffold (CN-006) will write.
 *
 * Both arms are asserted below. The failing one is not decoration: it is the
 * evidence for why the delivery mechanism is what it is, and it will speak up if
 * TypeScript ever changes its mind.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const PUBLISHED = path.join(__dirname, '..', 'src', 'index.d.ts');
const ROOT = path.join(os.tmpdir(), 'nodegx-node-kit-types-ac1');

/** The body of a kit, minus its annotation — identical between the two arms. */
const KIT_BODY = `
const Chip = {
  name: 'mykit.Chip',
  getReactComponent: function () {
    return function (props) {
      return React.createElement('span', { style: props.style }, props.label);
    };
  },
  inputProps: {
    label: { type: 'string', displayName: 'Label' }
  }
};

Noodl.defineModule({ reactNodes: [Chip] });
`;

/**
 * Build a kit directory containing nothing but the kit: an `index.js`, and — for
 * the relative arm — a copy of the published `.d.ts`. No package.json, no
 * tsconfig, no node_modules.
 */
function makeKit(name, annotation, { withTypesFile }) {
  const dir = path.join(ROOT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });

  if (withTypesFile) fs.copyFileSync(PUBLISHED, path.join(dir, 'types', 'node-kit.d.ts'));

  const file = path.join(dir, 'index.js');
  fs.writeFileSync(file, `// @ts-check\n/** @type {${annotation}} */${KIT_BODY}`);
  return file;
}

/**
 * Ask the language service what an editor would show, using the options VS Code
 * gives a loose JavaScript file with no project to belong to.
 */
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

  /** Completions offered where a new member of the definition would be typed. */
  const at = (marker) => {
    const position = text.indexOf(marker);
    if (position < 0) throw new Error(`marker not found: ${marker}`);
    const completions = service.getCompletionsAtPosition(file, position, {});
    return completions ? completions.entries.map((e) => e.name) : [];
  };

  const docFor = (marker, member) => {
    const position = text.indexOf(marker);
    const details = service.getCompletionEntryDetails(file, position, member, {}, undefined, {}, undefined);
    return details ? ts.displayPartsToString(details.documentation || []) : '';
  };

  return {
    definitionMembers: at('  inputProps: {'),
    portMembers: at("displayName: 'Label'"),
    docFor,
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

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

describe('a kit folder with a copy of the .d.ts — the shipping form', () => {
  let file, editor;

  beforeAll(() => {
    file = makeKit('relative', "import('./types/node-kit').ReactNodeDefinition", { withTypesFile: true });
    editor = askEditor(file);
  });

  it('really has no node_modules and no tsconfig anywhere above it', () => {
    // Asserted rather than assumed: if the temp directory ever landed under one,
    // every result below would be measuring the wrong thing and still look right.
    expect(ancestorsCarrying(path.dirname(file), 'node_modules')).toEqual([]);
    expect(ancestorsCarrying(path.dirname(file), 'tsconfig.json')).toEqual([]);
    expect(ancestorsCarrying(path.dirname(file), 'package.json')).toEqual([]);
  });

  it('reports no errors', () => {
    expect(editor.diagnostics).toEqual([]);
  });

  it('offers the definition’s own fields, not the global scope', () => {
    expect(editor.definitionMembers).toEqual(expect.arrayContaining(['inputCss', 'outputProps', 'dynamicports']));
  });

  it('offers port fields inside a port', () => {
    expect(editor.portMembers).toEqual(expect.arrayContaining(['displayName', 'group', 'default', 'tooltip']));
  });

  it('is not the global fallback wearing a disguise', () => {
    // The failing arm below offers ~1200 DOM globals. Naming two of them here is
    // what tells the two outcomes apart — a list that merely *contains*
    // `inputCss` would pass the check above in both worlds if the fallback
    // happened to include it.
    expect(editor.definitionMembers).not.toContain('document');
    expect(editor.definitionMembers).not.toContain('XMLHttpRequest');
    expect(editor.definitionMembers.length).toBeLessThan(100);
  });

  it('says which fields the bridge generates, so an author does not write them', () => {
    // CN-005 item 3. The runtime synthesises `set` onto the very object the
    // author wrote; anything they put there is overwritten. The distinction is
    // only useful if it survives into what the editor shows on hover.
    expect(editor.docFor("displayName: 'Label'", 'set')).toContain('Generated');
  });
});

describe('the control: the bare specifier AC1 originally asked for', () => {
  let editor;

  beforeAll(() => {
    const file = makeKit('bare', "import('@nodegx/node-kit-types').ReactNodeDefinition", { withTypesFile: false });
    editor = askEditor(file);
  });

  it('cannot resolve the module', () => {
    expect(editor.diagnostics.join(' ')).toContain("Cannot find module '@nodegx/node-kit-types'");
  });

  it('gives the author the global scope instead of their definition', () => {
    expect(editor.definitionMembers).toContain('document');
    expect(editor.definitionMembers).not.toContain('inputCss');
  });
});
