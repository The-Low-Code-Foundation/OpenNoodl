/**
 * CMP-007 — a part that needs a token the installing project has never heard of
 * says so, on the way in and on the shelf.
 *
 * ## The defect this grades, measured before it was fixed
 *
 * `export_to_library` collects the `var(--token)` names a part reads
 * (`libraryExport.planEntry`) and puts them in its RESPONSE and in the generated
 * README — a message to one agent on one turn, and a file for a human. Neither
 * survives to the shelf: `LibraryJson` had no tokens field, so
 * `get_library_entry` could not relay one and `install_prefab` could not read
 * one. The install response named components, styles, assets and modules, and
 * said nothing whatsoever about tokens.
 *
 * Tokens travel by NAME on purpose — that is CMP-004 AC4's whole mechanism, and
 * this task does not change it. A token resolving against the host theme is what
 * makes an installed part adopt project B's look. But a token project B has
 * never DEFINED does not resolve against anything: `var(--brand-accent)` with no
 * `--brand-accent` on `:root` renders as an unset property, not as an error. The
 * part installs, reports success, and draws the wrong colour.
 *
 * ## 🔴 Why the fixture invents a token instead of using the shipped shelf
 *
 * Counted first, on `library/prefabs` at 2026-09-11: **18 of 45 entries read
 * tokens, 29 distinct names, and ZERO of the 29 are outside `DEFAULT_TOKENS`.**
 * So a gate written against the first-party shelf reads "0 unresolved" before the
 * fix and "0 unresolved" after it, in both arms, and grades nothing at all. The
 * defect lives on the path CMP-004 AC4 opened — a part exported from a project
 * that INVENTED tokens with `set_project_tokens` — which is exactly the community
 * shelf this phase is built on. So project A here mints `--brand-accent` through
 * that real door and reads it from a real parameter.
 *
 * The zero above is not thrown away: `the shipped shelf` spec below re-derives it
 * from the artefacts, and is labelled as the corpus fact it is rather than
 * dressed up as a gate.
 *
 * ## 🔴 Why both paths derive the list rather than reading a recorded one
 *
 * The obvious first fix was to write `tokens` into `library.json` at export, so
 * the record outlived the response. The artefacts refused it twice:
 * `scripts/library/schema.json` is `additionalProperties: false`, so
 * `library:check` rejects the key, and `scripts/library/build.js` copies a FIXED
 * set of fields into `index.json`, so no consumer downstream would read it. It
 * would have been an inert field whose only reader was the spec asserting it —
 * the exact trap that schema's own `runtimeVersion` note records.
 *
 * And it would not have worked anyway: **0 of the 45 entries on the shelf carry
 * such a field**, having been written before it existed. A reader that trusted
 * the metadata would answer "no tokens" for every one of them — an absence
 * indistinguishable from a pass, on precisely the entries most likely to be
 * installed. The `derived from the entry GRAPH` spec below is what holds that
 * line, and it is the one a metadata-trusting implementation fails.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import { buildEffectiveTokens, readStoredTokens } from '../src/editor-deps';
import type {
  ExportToLibraryResponse,
  GetLibraryEntryResponse,
  InstallPrefabResponse
} from '../src/tools/libraryTools';

let shelfRoot: string;

beforeAll(() => {
  shelfRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp007-shelf-'));
  fs.mkdirSync(path.join(shelfRoot, 'prefabs'), { recursive: true });
  process.env.NODEGX_LIBRARY_DIR = shelfRoot;
});

afterAll(() => {
  delete process.env.NODEGX_LIBRARY_DIR;
  fs.rmSync(shelfRoot, { recursive: true, force: true });
});

/** The token project A invents and project B has never heard of. */
const INVENTED = '--brand-accent';
/** A token every project has, carried in the same graph as the control. */
const SHIPPED = '--foreground';

const ENTRY = {
  slug: 'accent-card',
  label: 'Accent Card',
  description: 'A card that reads one invented token and one shipped token.',
  tags: ['UI']
};

/**
 * Project A: the fixture, plus a token minted through `set_project_tokens` — the
 * real door, not a hand-written metadata block — and a `Card` reading both it and
 * a shipped token.
 */
async function projectA(): Promise<TestSession> {
  const dir = copyFixture();
  const session = await connect(dir, true);
  await reveal(session, 'theme');
  await reveal(session, 'explore');

  const minted = await call(session, 'set_project_tokens', {
    tokens: [{ name: INVENTED, value: '#ff6600' }]
  });
  expect(minted.isError).toBe(false);

  const nodesPath = path.join(dir, 'components', 'Card', 'nodes.json');
  const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8')) as { nodes: Array<Record<string, unknown>> };
  const root = nodes.nodes.find((n) => n.id === 'card_root') as Record<string, unknown>;
  root.parameters = { ...(root.parameters as Record<string, unknown>), backgroundColor: `var(${INVENTED})` };
  const text = nodes.nodes.find((n) => n.id === 'card_text') as Record<string, unknown>;
  text.parameters = { ...(text.parameters as Record<string, unknown>), color: `var(${SHIPPED})` };
  fs.writeFileSync(nodesPath, JSON.stringify(nodes, null, 2));

  return session;
}

/** Project B: a clean fixture. It has the default theme and nothing else. */
async function projectB(): Promise<TestSession> {
  const session = await connect(copyFixture(), true);
  await call(session, 'delete_component', { path: 'Pages/Home' });
  await call(session, 'delete_component', { path: 'Card' });
  await reveal(session, 'explore');
  return session;
}

describe('CMP-007 — the shelf keeps the token record the export takes', () => {
  let a: TestSession;
  let exported: ExportToLibraryResponse;

  beforeAll(async () => {
    a = await projectA();
    const res = await call<ExportToLibraryResponse>(a, 'export_to_library', { component: 'Card', ...ENTRY });
    expect(res.isError).toBe(false);
    exported = res.data;
  }, 30_000);

  afterAll(async () => {
    await a.close();
  });

  it('🔴 the export still reports both tokens, and still ships them as names', () => {
    // The pre-existing behaviour this task must not break: tokens are NOT
    // resolved to project A's literals on the way out.
    expect(exported.tokensUsed).toEqual(expect.arrayContaining([INVENTED, SHIPPED]));
    const project = JSON.parse(
      fs.readFileSync(path.join(shelfRoot, 'prefabs', ENTRY.slug, 'project', 'project.json'), 'utf8')
    );
    expect(JSON.stringify(project)).toContain(`var(${INVENTED})`);
    // And project A's VALUE for its invented token is not shipped with it —
    // carrying the override is the thing CMP-004 AC4 deliberately does not do.
    expect(JSON.stringify(project)).not.toContain('#ff6600');
  });

  it('🔴 AC1 — get_library_entry relays the tokens, so an agent can check BEFORE installing', async () => {
    const res = await call<GetLibraryEntryResponse>(a, 'get_library_entry', { slug: ENTRY.slug });
    expect(res.isError).toBe(false);
    expect(res.data.tokens).toEqual(expect.arrayContaining([INVENTED, SHIPPED]));
    // The browse path agrees with the export path about what the part reads:
    // two answers to the same question that could drift are worse than one.
    expect(res.data.tokens).toEqual(exported.tokensUsed);
  });

  it('🔴 library.json stays as the schema defines it — no inert token field', () => {
    // `scripts/library/schema.json` is additionalProperties:false and
    // `build.js` publishes a fixed set of keys, so a `tokens` key here fails
    // `library:check` and reaches no consumer. Asserted rather than remembered.
    const meta = JSON.parse(fs.readFileSync(path.join(shelfRoot, 'prefabs', ENTRY.slug, 'library.json'), 'utf8'));
    expect(Object.keys(meta).sort()).toEqual(['description', 'label', 'tags', 'type', 'version']);
  });
});

describe('CMP-007 AC2 — the install says which tokens will not resolve here', () => {
  let a: TestSession;
  let b: TestSession;
  let installed: InstallPrefabResponse;

  beforeAll(async () => {
    a = await projectA();
    const res = await call<ExportToLibraryResponse>(a, 'export_to_library', {
      component: 'Card',
      ...ENTRY,
      slug: 'accent-card-install'
    });
    expect(res.isError).toBe(false);

    b = await projectB();
    const inst = await call<InstallPrefabResponse>(b, 'install_prefab', { slug: 'accent-card-install' });
    expect(inst.isError).toBe(false);
    installed = inst.data;
  }, 45_000);

  afterAll(async () => {
    await a.close();
    await b.close();
  });

  it('🔴 names the invented token as unresolved in THIS project', () => {
    expect(installed.tokensUnresolved).toEqual([INVENTED]);
  });

  it('🔴 does NOT name the token the project already defines', () => {
    // Without this half the rule is "list every token the part reads", which is
    // noise on every install and tells an agent nothing it must act on.
    expect(installed.tokensUnresolved ?? []).not.toContain(SHIPPED);
    // The control is that project B genuinely has one and not the other.
    const effective = buildEffectiveTokens(readStoredTokens(b.store.designTokenMetaSource()));
    expect(effective.has(SHIPPED)).toBe(true);
    expect(effective.has(INVENTED)).toBe(false);
  });

  it('🔴 the install actually succeeded — this is a report, not a refusal', () => {
    // The part must still install. A token that does not resolve is a thing to
    // tell the agent about, not a reason to refuse a part that otherwise works.
    expect(installed.componentsInstalled).toContain('/Card');
  });

  it('🔴 next says what to do about it, naming the token and the tool that fixes it', () => {
    expect(installed.next).toContain(INVENTED);
    expect(installed.next).toContain('set_project_tokens');
  });

  it('🔴 the report is derived from the entry GRAPH, not from library.json', async () => {
    // The metadata carries nothing about tokens, by design and by schema — so an
    // implementation that read it would report NOTHING here while passing every
    // other spec in this file. That is the shape of the defect one level up, and
    // it is the arm that catches it: this asserts the report survives a
    // library.json that says nothing, which is every entry on the shipped shelf.
    const metaPath = path.join(shelfRoot, 'prefabs', 'accent-card-install', 'library.json');
    expect(JSON.parse(fs.readFileSync(metaPath, 'utf8')).tokens).toBeUndefined();

    const again = await call<InstallPrefabResponse>(b, 'install_prefab', { slug: 'accent-card-install' });
    expect(again.isError).toBe(false);
    expect(again.data.tokensUnresolved).toEqual([INVENTED]);
  });
});

describe('CMP-007 — the corpus fact that made the fixture necessary', () => {
  it('the shipped shelf reads 29 tokens and NOT ONE of them is outside the default theme', () => {
    // ⚠️ This is a MEASUREMENT, not a gate: it reads zero before the fix and zero
    // after it. It is here so the next reader knows why the specs above invent a
    // token rather than installing `card-grid`, and so that the day a first-party
    // prefab starts reading an invented token, this number moves and somebody
    // has to look at it.
    const prefabs = path.join(__dirname, '..', '..', '..', 'library', 'prefabs');
    const defaults = buildEffectiveTokens(undefined);
    const seen = new Set<string>();
    let entriesReadingTokens = 0;

    for (const slug of fs.readdirSync(prefabs)) {
      const projectJson = path.join(prefabs, slug, 'project', 'project.json');
      if (!fs.existsSync(projectJson)) continue;
      const names = new Set(
        [...fs.readFileSync(projectJson, 'utf8').matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1])
      );
      if (names.size > 0) entriesReadingTokens += 1;
      for (const n of names) seen.add(n);
    }

    expect(entriesReadingTokens).toBeGreaterThan(0);
    const outside = [...seen].filter((n) => !defaults.has(n)).sort();
    expect(outside).toEqual([]);
  });
});
