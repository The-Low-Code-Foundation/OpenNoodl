// @ts-check
/**
 * CN-007 AC1 — every code sample on the custom-nodes docs page typechecks
 * against the published types.
 *
 * This gate exists because of how the page it grades came to be written. The
 * Noodl 2.7 `create-react-lib` guide is the single most-cited dead end in the
 * community, and it did not start out wrong: it drifted, because nothing ever
 * compiled the code in it. `docs-site/docs/custom-nodes.md` replaces that guide,
 * and it will rot the same way unless something reads it.
 *
 * ── Why it lives here and not in a script ──────────────────────────────────
 *
 * `@nodegx/node-kit-types` is already registered in `test:packages` (all four
 * registrations, done in CN-005). A new top-level script would need its own,
 * and a package in no gate runs no tests. The dependency direction is also the
 * right way round: the types package proves the documentation compiles against
 * it, not the other way about.
 *
 * ── What "checked" means, and what is deliberately excluded ────────────────
 *
 * Every ```js fence on the page is extracted. A fence is **complete** if it
 * registers a module (`Noodl.defineModule`); those are compiled as whole files,
 * exactly the way an author's editor would compile the file they pasted it
 * into. Everything else is a **fragment** — a few lines of a port declaration,
 * a two-line before/after — which cannot compile standalone and is not made to.
 *
 * 🔴 Fragments are COUNTED and asserted, not silently skipped. A silent skip is
 * how a gate comes to grade nothing: turn every complete sample into a fragment
 * and a "no diagnostics" gate goes green over a page of broken code. The count
 * below has to be updated deliberately when the page changes, which is the
 * point — it makes shrinking the checked set visible in a diff.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DOCS_PAGE = path.join(__dirname, '..', '..', '..', 'docs-site', 'docs', 'custom-nodes.md');
const TYPES_ENTRY = path.join(__dirname, '..', 'src', 'index.d.ts');

/**
 * Pull every fenced block off the page, keeping its language and title meta.
 *
 * @returns {Array<{ lang: string, meta: string, body: string, line: number }>}
 */
function fencedBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let open = null;

  lines.forEach((line, i) => {
    const fence = /^```(\w+)?(.*)$/.exec(line);
    if (open === null) {
      if (fence && fence[1]) {
        open = { lang: fence[1], meta: (fence[2] || '').trim(), body: [], line: i + 1 };
      }
      return;
    }
    if (/^```\s*$/.test(line)) {
      blocks.push({ lang: open.lang, meta: open.meta, body: open.body.join('\n'), line: open.line });
      open = null;
      return;
    }
    open.body.push(line);
  });

  if (open !== null) throw new Error(`unterminated fence opened at line ${open.line}`);
  return blocks;
}

/** A sample is compilable on its own if it registers a module. */
const isCompleteSample = (block) => /Noodl\.defineModule\s*\(/.test(block.body);

/**
 * Compile one sample the way an author's editor would.
 *
 * 🔴 This materialises a REAL kit folder — `index.js` beside `types/node-kit.d.ts`
 * — rather than pointing the compiler at this package's `src/`. That is the
 * whole delivery mechanism CN-005 established and it is the half that can fail:
 * a bare specifier (`import('@nodegx/node-kit-types')`) resolves only when the
 * package is physically installed, and a kit folder has no `node_modules`. A
 * harness that reached into `src/` directly would resolve where the real thing
 * does not, and would pass a page telling authors to write an import that dies.
 *
 * The first attempt at this used `/// <reference path=...>` to a module `.d.ts`,
 * which puts no names in scope at all — the samples "passed" because nothing was
 * resolved and nothing was checked. The planted-fault control below is what
 * caught it.
 *
 * `types: []` models the same folder: no `node_modules`, so no ambient `@types/*`
 * drifting in and quietly supplying something the real environment lacks.
 *
 * @returns {string[]} flattened diagnostic messages
 */
function diagnosticsForSource(source, tmpName) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cn007-'));
  const file = path.join(dir, tmpName);
  try {
    fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
    fs.copyFileSync(TYPES_ENTRY, path.join(dir, 'types', 'node-kit.d.ts'));
    fs.writeFileSync(file, `${source}\n`);
    const program = ts.createProgram([file], {
      allowJs: true,
      checkJs: false,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      noEmit: true,
      skipLibCheck: true,
      types: []
    });
    const sourceFile = program.getSourceFile(file);
    return ts
      .getPreEmitDiagnostics(program, sourceFile)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('CN-007 — the custom-nodes docs page', () => {
  const markdown = fs.readFileSync(DOCS_PAGE, 'utf8');
  const blocks = fencedBlocks(markdown);
  const js = blocks.filter((b) => b.lang === 'js');
  const complete = js.filter(isCompleteSample);
  const fragments = js.filter((b) => !isCompleteSample(b));

  it('is reachable at the path this gate grades', () => {
    expect(markdown.length).toBeGreaterThan(0);
  });

  /**
   * 🔴 The instrument check. Without this the suite passes on a page with no
   * code on it at all, which is indistinguishable from a page whose code is
   * perfect.
   */
  it('still has samples to grade', () => {
    expect(complete.length).toBeGreaterThanOrEqual(1);
  });

  it.each(complete.map((b, i) => [b.meta || `sample ${i + 1}`, b]))(
    'complete sample %s typechecks against the published types',
    (_label, block) => {
      expect(diagnosticsForSource(block.body, 'index.js')).toEqual([]);
    }
  );

  /**
   * The fragment budget. Not a style rule — a guard against the checked set
   * being quietly emptied. If the page legitimately grows a fragment, raise
   * this number in the same commit that adds it.
   *
   * **4 → 7 on 2026-08-18**, in the commit that added the four sections CN-007
   * still owed. The three new fragments, named so the next reader can tell a
   * deliberate rise from a drift:
   *
   * 1. the conditional-port-group declaration (CN-010 AC4) — a `dynamicports`
   *    entry beside the two ports it switches, with no module registration;
   * 2. the `docs` / `docsUrl` pair (D10) — two fields on a definition literal;
   * 3. the `runOnValueChange` setter (CN-012) — the three lines inside one
   *    `set`, which is the whole point of that caution and cannot be a file.
   *
   * ✅ **The complete count rose too, and that is the number that matters:** the
   * logic-node sample (`noodl_modules/tally-kit/index.js`) is compiled in full
   * against `LogicNodeDefinition`. A section added as fragments only would have
   * raised this budget while grading nothing new.
   */
  it('declares how many blocks it does not compile', () => {
    expect(fragments.length).toBe(7);
  });

  /**
   * 🔴 The other half of the budget above, and the reason raising it is safe.
   * A page could satisfy the fragment budget by turning complete samples into
   * fragments one at a time. This floor moves in the opposite direction.
   */
  it('and how many it does compile, so the checked set cannot shrink', () => {
    expect(complete.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * 🔴 Compiling is not the same as being *typed*. A sample with no `@type`
   * annotation compiles cleanly no matter what the `.d.ts` says, so at least one
   * complete sample has to actually reach the published types — otherwise this
   * whole suite grades syntax.
   */
  it('has at least one complete sample annotated against the published types', () => {
    const annotated = complete.filter((b) => /@type\s*\{import\(/.test(b.body));
    expect(annotated.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * 🔴 The control, and it is the reason any of the above means anything. A
   * `.d.ts` that failed to resolve — or one whose every member is `any` —
   * produces zero diagnostics on the real samples and zero on a broken one. The
   * two outcomes are identical without something that has to go red.
   *
   * The fault is planted in the same shape the samples use, so it exercises the
   * same resolution path rather than a simpler one that might resolve when the
   * real annotation does not.
   */
  it('reports a planted fault in a sample of the same shape', () => {
    const broken = `// @ts-check
(function () {
  /** @type {import('./types/node-kit').ReactNodeDefinition} */
  var Bad = {
    name: 'my-kit.Bad',
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content', default: 'New' }
    },
    thisFieldIsNotInTheDefinition: true
  };
  Noodl.defineModule({ reactNodes: [Bad] });
})();`;
    const diagnostics = diagnosticsForSource(broken, 'index.js');
    expect(diagnostics.join('\n')).toMatch(/thisFieldIsNotInTheDefinition/);
  });

  /**
   * CN-007 AC4 — the in-editor entry point points at a page that exists.
   *
   * 🔴 The failure this guards is the exact one that created CN-007. A docs link
   * is the one kind of reference nothing checks: it renders fine, it clicks
   * fine, and it 404s only for the user. `getDocsEndpoint()` in this repo still
   * carries a dead origin for precisely that reason.
   *
   * This checks the two halves that can drift independently — that the editor
   * composes the URL from the single docs origin rather than hardcoding a second
   * one, and that the slug it ends in is a file on disk.
   */
  it('the editor link composes from the docs origin and names a page that exists', () => {
    const constants = fs.readFileSync(
      path.join(__dirname, '..', '..', 'noodl-core-ui', 'src', 'constants', 'externalLinks.ts'),
      'utf8'
    );

    const entry = /customNodes:\s*`\$\{EXTERNAL_LINKS\.docs\}([^`]+)`/.exec(constants);
    expect(entry).not.toBeNull();

    const slug = entry[1].replace(/^docs\//, '');
    expect(fs.existsSync(path.join(path.dirname(DOCS_PAGE), `${slug}.md`))).toBe(true);
  });

  /**
   * The JSON sample is a manifest, and a malformed one is a kit that does not
   * load at all. Cheap to check, and it is a real failure mode.
   */
  it('parses every json sample, and every manifest names its entry point', () => {
    const jsonBlocks = blocks.filter((b) => b.lang === 'json');
    expect(jsonBlocks.length).toBeGreaterThanOrEqual(1);
    for (const block of jsonBlocks) {
      const parsed = JSON.parse(block.body);
      if (/manifest\.json/.test(block.meta)) {
        expect(typeof parsed.name).toBe('string');
        expect(parsed.main).toBe('index.js');
      }
    }
  });
});
