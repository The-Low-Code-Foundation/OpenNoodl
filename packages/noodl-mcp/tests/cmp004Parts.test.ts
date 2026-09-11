/**
 * CMP-004 AC3 + CMP-005 AC5 (P85) — **the shelf carries parts, and they were exported.**
 *
 * ## What the AC asked for, and what measuring it first changed
 *
 * AC3: *"the shelf carries at least three single-component entries, one of them produced by
 * `export_to_library` rather than hand-authored, and `list_library` distinguishes a part from a
 * prefab"*.
 *
 * 🔴 **The first clause was already true before any work.** Counted over the shelf on 2026-09-10:
 * **fourteen** entries ship exactly one component, **six** of them prefabs — `confirm-dialog`,
 * `date-picker`, `file-upload`, `progress-circle`, `search-bar`, `toggle-switch`. A criterion the
 * artefact already satisfies grades nothing, and CMP-004 §2's premise (*"Every entry is a whole
 * prefab"*) is false as written.
 *
 * What is true is the sentence underneath it: **the shelf has no entry at utility scale.** The
 * smallest graph on it is `rich-text-editor` at **4** nodes and the median is around twenty, and
 * "one component" does not separate the two things — `file-upload` is ONE component holding **48**
 * nodes while `toggle-switch` is ONE component holding **7**. So this suite grades the unit, not
 * the count: three entries that are one small component each, and the numbers a row now carries so
 * an agent can see that for itself.
 *
 * ## Why the entries are re-exported here rather than read
 *
 * ⚠️ **A spec that reads `library/prefabs/format-date/` proves a directory exists, not that the
 * export path produced it** — and "not hand-authored" is exactly what AC3 asks. So the grading
 * runs `export_to_library` again, from the committed source project and its committed manifest,
 * into a temp shelf, and compares every byte with what is on the real shelf. If somebody edits a
 * shipped entry by hand, this reddens and names the file. The source project and the manifest are
 * the inputs; `library/prefabs/<slug>/` is output, and is treated as such.
 *
 * ## And the parts are graded on what they DO
 *
 * A part that installs and formats nothing is a worse entry than none, because it costs the next
 * author the time to find out. Each `functionScript` is lifted out of the COMMITTED component file
 * and executed in the shape the runtime gives it (`Inputs`, `Outputs`), so these assertions grade
 * the shipped graph rather than a copy of its logic living in this file.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import { listShelf, readEntryContents, resolveLibraryRoot } from '../src/libraryShelf';
import type { ExportToLibraryResponse, InstallPrefabResponse } from '../src/tools/libraryTools';

const SOURCE = path.join(
  __dirname, '..', '..', '..', 'dev-docs', 'tasks', 'phase-85-the-component-is-the-backbone', 'parts-source'
);

interface ExportSpec {
  component: string;
  slug: string;
  label: string;
  description: string;
  tags: string[];
  version: string;
  readme: string;
}

const MANIFEST = JSON.parse(fs.readFileSync(path.join(SOURCE, 'export-manifest.json'), 'utf8')) as ExportSpec[];

const resolved = resolveLibraryRoot();
if (!resolved.ok) throw new Error(`the real library root is required for this suite: ${resolved.reason}`);
const SHELF = resolved.root;

/** Every file under a directory, relative and sorted — the comparison's own denominator. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) walk(next);
      else out.push(next);
    }
  };
  walk('');
  return out;
}

describe('CMP-004 AC3 — three parts, at the unit the shelf did not have', () => {
  it('🔴 the AC\'s literal criterion was already met before the work — so this grades the UNIT', () => {
    const rows = listShelf(SHELF).rows;
    const oneComponent = rows.filter((r) => r.size.components === 1);
    // Fourteen entries ship one component and six of those are prefabs. Asserted as a floor
    // that EXCLUDES this session's three, so it stays the pre-existing fact it is describing.
    const preExisting = oneComponent.filter((r) => !MANIFEST.some((m) => m.slug === r.slug));
    expect(preExisting.length).toBeGreaterThanOrEqual(11);
    expect(preExisting.filter((r) => r.type === 'prefab').map((r) => r.slug)).toEqual(
      expect.arrayContaining(['confirm-dialog', 'date-picker', 'file-upload', 'progress-circle', 'search-bar', 'toggle-switch'])
    );
    // 🔴 And the reason that criterion could not be the test: one component says nothing about size.
    const bySlug = new Map(rows.map((r) => [r.slug, r.size]));
    expect(bySlug.get('file-upload')).toEqual({ components: 1, nodes: 48 });
    expect(bySlug.get('toggle-switch')).toEqual({ components: 1, nodes: 7 });
  });

  it('the three parts are on the shelf, each one small component', () => {
    const rows = listShelf(SHELF).rows;
    for (const spec of MANIFEST) {
      const row = rows.find((r) => r.slug === spec.slug);
      expect(row).toBeDefined();
      expect(row!.size.components).toBe(1);
      // The unit the shelf lacked: at or below the smallest graph that was already on it
      // (`rich-text-editor` at 4 nodes, and that is a code module with a demo page, not a part).
      // ⚠️ Bounded on BOTH sides — a one-sided `<= 4` passes when the count is broken and
      // reads zero, which the control on `countNodes` demonstrated.
      expect(row!.size.nodes).toBeGreaterThan(0);
      expect(row!.size.nodes).toBeLessThanOrEqual(4);
    }
  });

  /**
   * 🔴 **The first version of this spec graded nothing, and the control said so.**
   *
   * It asked the three natural questions — *"is there a date formatter"*, *"clean up an email
   * address"*, *"first and last name initials"* — and asserted each part came back. Blanking all
   * three DESCRIPTIONS turned nothing red: every one of those questions matches the SLUG
   * (`format-date`, `sanitise-email`, `format-full-name`). The spec was measuring the naming, and
   * a part whose slug happens to spell its job is the easy case that proves nothing.
   *
   * This is session 4's finding arriving a second time in the same task, so it is worth stating
   * plainly: pick a term that lives in exactly one field, and assert `matchedIn` is that field.
   * The natural questions are still asserted below, as what they are — the author's own words
   * reaching the part — and not as evidence about descriptions.
   */
  it('🔴 is reachable by a word that is ONLY in its description', () => {
    const only = (query: string, slug: string) => {
      const row = listShelf(SHELF, { query }).rows.find((r) => r.slug === slug);
      expect({ query, slug, found: !!row }).toEqual({ query, slug, found: true });
      // Not "the description was among the fields that hit" — it is the ONLY field that hit.
      expect({ query, matchedIn: row!.matchedIn }).toEqual({ query, matchedIn: ['description'] });
    };
    only('weekday', 'format-date');
    only('surname', 'format-full-name');
    only('domain', 'sanitise-email');
  });

  it('and the question an author would actually type reaches it', () => {
    expect(listShelf(SHELF, { query: 'is there a date formatter' }).rows[0].slug).toBe('format-date');
    expect(listShelf(SHELF, { query: 'clean up an email address' }).rows.map((r) => r.slug)).toContain('sanitise-email');
    expect(listShelf(SHELF, { query: 'first and last name initials' }).rows.map((r) => r.slug)).toContain('format-full-name');
  });
});

describe('CMP-004 AC3 — the entries were EXPORTED, and still are', () => {
  let session: TestSession;
  let temp: string;

  beforeAll(async () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp004-parts-'));
    fs.mkdirSync(path.join(temp, 'shelf', 'prefabs'), { recursive: true });
    const project = path.join(temp, 'source');
    fs.cpSync(SOURCE, project, { recursive: true });
    process.env.NODEGX_LIBRARY_DIR = path.join(temp, 'shelf');
    session = await connect(project, true);
    await reveal(session, 'explore');
  });

  afterAll(async () => {
    await session?.close();
    delete process.env.NODEGX_LIBRARY_DIR;
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it('🔴 re-exporting from the committed source reproduces the shipped entry byte for byte', async () => {
    for (const spec of MANIFEST) {
      const { isError, data } = await call<ExportToLibraryResponse>(session, 'export_to_library', { ...spec });
      expect(isError).toBe(false);
      expect(data.componentsExported).toEqual([`/${spec.component}`]);

      const fresh = path.join(temp, 'shelf', 'prefabs', spec.slug);
      const shipped = path.join(SHELF, 'prefabs', spec.slug);
      // The file LIST first: a comparison that only diffs the files it finds on both sides
      // passes when the shipped entry has gained a file nobody exported.
      expect(filesUnder(fresh)).toEqual(filesUnder(shipped));
      for (const file of filesUnder(fresh)) {
        expect({ file, body: fs.readFileSync(path.join(shipped, file), 'utf8') }).toEqual({
          file,
          body: fs.readFileSync(path.join(fresh, file), 'utf8')
        });
      }
    }
  });

  it('and what was exported installs into a project that has never seen it', async () => {
    const target = await connect(copyFixture(), true);
    await reveal(target, 'explore');
    try {
      for (const spec of MANIFEST) {
        const { isError, data } = await call<InstallPrefabResponse>(target, 'install_prefab', { slug: spec.slug });
        expect(isError).toBe(false);
        expect(data.componentsInstalled).toEqual([`/${spec.component}`]);
      }
      // Asked of the SERVER, not of the entry directory: a graph that arrived and does not
      // resolve is what "it installed" hides.
      const { data } = await call<{ summary: { errors: number } }>(target, 'validate_project', {});
      expect(data.summary.errors).toBe(0);
    } finally {
      await target.close();
    }
  });
});

/**
 * The scripts, executed exactly as the runtime executes them: the body is a function over
 * `Inputs` and `Outputs`. Lifted out of the committed component file, so editing the part
 * re-grades it and editing this file does not.
 */
function runScript(componentPath: string, nodeId: string, inputs: Record<string, unknown>): Record<string, unknown> {
  const nodes = JSON.parse(
    fs.readFileSync(path.join(SOURCE, 'components', componentPath, 'nodes.json'), 'utf8')
  ) as { nodes: Array<{ id: string; parameters?: { functionScript?: string } }> };
  const node = nodes.nodes.find((n) => n.id === nodeId);
  if (!node?.parameters?.functionScript) throw new Error(`no functionScript on ${componentPath}#${nodeId}`);
  const Outputs: Record<string, unknown> = {};
  // eslint-disable-next-line no-new-func
  new Function('Inputs', 'Outputs', node.parameters.functionScript)(inputs, Outputs);
  return Outputs;
}

describe('CMP-005 AC5 — Format Date, the part that answers the phase\'s own worked example', () => {
  const pick = (inputs: Record<string, unknown>) => runScript('Parts/Format Date', 'fdPick', inputs).format as string;

  it('turns a named style into a Date To String token string', () => {
    expect(pick({ style: 'long' })).toBe('{dayName} {ordinal} {monthName} {year}');
    expect(pick({ style: 'time' })).toBe('{h12}:{minutes} {ampm}');
    expect(pick({ style: 'iso' })).toBe('{year}-{month}-{date}');
  });

  it('defaults, and forgives the case and spacing a human types', () => {
    expect(pick({})).toBe(pick({ style: 'date' }));
    expect(pick({ style: '  LONG ' })).toBe(pick({ style: 'long' }));
    // An unknown style is the default, not an empty string: a typo must not blank the date.
    expect(pick({ style: 'medium-ish' })).toBe(pick({ style: 'date' }));
  });

  it('Format wins over Style, which is the escape hatch that keeps the presets honest', () => {
    expect(pick({ style: 'long', format: '{year}' })).toBe('{year}');
    // Whitespace is not a format — an empty-ish Format falls back rather than blanking.
    expect(pick({ style: 'long', format: '   ' })).toBe(pick({ style: 'long' }));
  });

  it('🔴 every preset is written in tokens the Date To String node actually has', () => {
    // The trap this phase already hit once: the one shipped corpus example that set a format
    // set "HH:mm:ss", moment syntax this node cannot read, and it validated clean because the
    // gate checked the PORT and never the VALUE. Every token below is asserted against the
    // node's own catalog documentation in `noodl-runtime`'s cmp-005 suite; here we assert the
    // shape — a preset is nothing but {tokens} and punctuation.
    for (const style of ['short', 'date', 'long', 'time', 'datetime', 'iso']) {
      const format = pick({ style });
      expect(format).toMatch(/\{/);
      const tokens = [...format.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);
      expect(tokens.length).toBeGreaterThan(0);
      expect(format.replace(/\{[a-zA-Z0-9]+\}/g, '')).toMatch(/^[\s,:/-]*$/);
    }
  });
});

describe('CMP-004 AC3 — Format Full Name does the three things a String Format node gets wrong', () => {
  const run = (inputs: Record<string, unknown>) => runScript('Parts/Format Full Name', 'fnFn', inputs);

  it('joins both names', () => {
    expect(run({ firstName: 'Ada', lastName: 'Lovelace' })).toEqual({
      hasName: true, fullName: 'Ada Lovelace', initials: 'AL'
    });
  });

  it('🔴 a missing surname leaves no trailing space — the whole reason this is not a String Format', () => {
    expect(run({ firstName: 'Ada', lastName: '' }).fullName).toBe('Ada');
    expect(run({ firstName: 'Ada' }).fullName).toBe('Ada');
    expect(run({ lastName: 'Lovelace' }).fullName).toBe('Lovelace');
    // And a stray space in a database column does not become a double space on screen.
    expect(run({ firstName: '  Ada  ', lastName: '  Lovelace ' }).fullName).toBe('Ada Lovelace');
  });

  it('🔴 one field holding a whole name still initials correctly', () => {
    expect(run({ firstName: 'Ada Lovelace' })).toEqual({ hasName: true, fullName: 'Ada Lovelace', initials: 'AL' });
    expect(run({ firstName: 'Ada King Lovelace' }).initials).toBe('AL');
  });

  it('falls back rather than rendering an empty string, and says which happened', () => {
    expect(run({ fallback: 'Deleted user' })).toEqual({ hasName: false, fullName: 'Deleted user', initials: 'D' });
    expect(run({})).toEqual({ hasName: false, fullName: '', initials: '' });
  });
});

describe('CMP-004 AC3 — Sanitise Email turns what was typed into what you can store', () => {
  const run = (email: unknown) => runScript('Parts/Sanitise Email', 'seFn', { email });

  it('trims, lower-cases and splits the domain out', () => {
    expect(run('  Ada@Example.COM ')).toEqual({ email: 'ada@example.com', domain: 'example.com', isValid: true });
  });

  it('🔴 unwraps the two shapes a paste actually arrives in', () => {
    expect(run('mailto:Ada@Example.com').email).toBe('ada@example.com');
    expect(run('<ada@example.com>').email).toBe('ada@example.com');
    expect(run('MAILTO: ada@example.com ').email).toBe('ada@example.com');
  });

  it('says invalid rather than throwing, for the things people paste that are not addresses', () => {
    for (const bad of ['', 'ada', 'ada@', '@example.com', 'ada@example', 'ada example.com', 'a@b@c.com']) {
      expect(run(bad).isValid).toBe(false);
    }
    expect(run(null).email).toBe('');
    expect(run(undefined).isValid).toBe(false);
  });

  it('two sign-ups for the same person come out the same string', () => {
    expect(run('Ada@Example.com').email).toBe(run('mailto:  ADA@EXAMPLE.COM').email);
  });
});

describe('CMP-004 AC3 — the shelf reports size instead of labelling a part', () => {
  it('🔴 there is no part/prefab label anywhere on a row, and that is the decision', () => {
    for (const row of listShelf(SHELF).rows) {
      expect(Object.keys(row)).not.toContain('unit');
      expect(row.tags).not.toContain('Part');
      expect(row.type === 'prefab' || row.type === 'module').toBe(true);
    }
  });

  it('the numbers are derived from the entry, so they cannot drift from what installs', () => {
    const rows = listShelf(SHELF).rows;
    for (const row of rows) {
      const contents = readEntryContents(path.join(SHELF, row.type === 'prefab' ? 'prefabs' : 'modules', row.slug));
      expect(row.size).toEqual({ components: contents.components, nodes: contents.nodes });
    }
    // ⚠️ The comparison above agrees with itself when the count is broken and BOTH sides read
    // zero. A known-firing signal beside the absence: most of the shelf has a graph in it.
    expect(rows.filter((r) => r.size.nodes > 0).length).toBeGreaterThan(40);
  });

  it('and they separate the two ends of the shelf the label was a proxy for', () => {
    const bySlug = new Map(listShelf(SHELF).rows.map((r) => [r.slug, r.size]));
    expect(bySlug.get('format-date')!.nodes).toBeLessThan(10);
    expect(bySlug.get('stripe')!.nodes).toBeGreaterThan(100);
    expect(bySlug.get('stripe')!.components).toBeGreaterThan(20);
  });
});
