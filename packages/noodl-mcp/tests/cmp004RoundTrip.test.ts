/**
 * CMP-004 AC4 — **the path is two-way**, graded by the round trip the AC names:
 * export a component out of project A, install it into project B, and what
 * arrives is the thing that left.
 *
 * ## Why a round trip and not an assertion about a written file
 *
 * `export_to_library` could write a `library.json` and a `project.json` that
 * look right and are not installable, and every check that reads its own output
 * would pass. So the grading here never reads the entry it wrote in order to
 * decide whether the export worked: it hands the entry to `install_prefab` —
 * the tool a stranger would use, in a second project that has never seen these
 * components — and asks the SERVER for the result. The one direct read of the
 * entry directory is the `library.json`/README pair, because those are what a
 * human sees on the shelf and no installer ever looks at them.
 *
 * ## The four things a part reaches for outside itself
 *
 * A component that renders in project A and not in project B fails because of
 * one of: a component it places, a named style it uses, a file it points at, or
 * a node type from a code module. Project A here is built to use all four, so
 * an export that carries three of them fails a spec rather than shipping a
 * shelf entry that renders as a hole. The fifth thing — a `var(--token)` — is
 * asserted to be carried by NAME and left in the graph, because a token
 * resolving against the HOST project is what makes an installed part adopt the
 * new project's look rather than drag the old one's palette along.
 *
 * ⚠️ **Project B is the fixture with those components deleted, not a fresh
 * project.** A `create_project` mints a template full of components and would
 * make "did it arrive?" ambiguous; deleting leaves a project that provably
 * lacks exactly what the entry ships.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import { listShelf } from '../src/libraryShelf';
import type { ExportToLibraryResponse, InstallPrefabResponse, ListLibraryResponse } from '../src/tools/libraryTools';
import type { FindToolsResponse, ToolErrorPayload } from '../src/tools/responses';

let shelfRoot: string;

beforeAll(() => {
  shelfRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp004-shelf-'));
  fs.mkdirSync(path.join(shelfRoot, 'prefabs'), { recursive: true });
  process.env.NODEGX_LIBRARY_DIR = shelfRoot;
});

afterAll(() => {
  delete process.env.NODEGX_LIBRARY_DIR;
  fs.rmSync(shelfRoot, { recursive: true, force: true });
});

/**
 * Project A: the demo fixture, with `Card` given the four outside references a
 * real part has — a named colour, a named text style, a variant, and an asset —
 * plus one literal hex, which is the thing the export must warn about rather
 * than silently ship, and one `var(--token)`, which it must leave alone.
 */
function projectA(): string {
  const dir = copyFixture();

  fs.writeFileSync(
    path.join(dir, 'nodegx.styles.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/styles-v2.json',
        colors: { 'Brand Blue': '#1b6ef3', 'Unused Grey': '#888888' },
        textStyles: { 'Card Label': { fontSize: { value: '14', unit: 'px' } } },
        variants: [
          { name: 'Soft', typename: 'Group', parameters: { borderRadius: 12 } },
          { name: 'Loud', typename: 'Group', parameters: { borderRadius: 0 } }
        ]
      },
      null,
      2
    )
  );

  fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'images', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

  const nodesPath = path.join(dir, 'components', 'Card', 'nodes.json');
  const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8')) as {
    nodes: Array<Record<string, unknown>>;
  };
  const root = nodes.nodes.find((n) => n.id === 'card_root') as Record<string, unknown>;
  root.variant = 'Soft';
  root.parameters = {
    ...(root.parameters as Record<string, unknown>),
    backgroundColor: 'Brand Blue',
    backgroundImage: 'images/logo.svg',
    borderColor: '#ff00aa'
  };
  const text = nodes.nodes.find((n) => n.id === 'card_text') as Record<string, unknown>;
  text.parameters = { ...(text.parameters as Record<string, unknown>), textStyle: 'Card Label', color: 'var(--foreground)' };
  fs.writeFileSync(nodesPath, JSON.stringify(nodes, null, 2));

  return dir;
}

/** Project B: the same fixture with the two components the entry ships removed. */
async function projectB(): Promise<{ session: TestSession; dir: string }> {
  const dir = copyFixture();
  const session = await connect(dir, true);
  // Home first — it places Card, and deleting a component something still
  // instantiates is the case the delete path refuses.
  await call(session, 'delete_component', { path: 'Pages/Home' });
  await call(session, 'delete_component', { path: 'Card' });
  await reveal(session, 'explore');
  return { session, dir };
}

const ENTRY = {
  slug: 'demo-home',
  label: 'Demo Home',
  description: 'The demo fixture home page and the card it places, exported as a shelf entry.',
  tags: ['UI', 'Page']
};

describe('CMP-004 AC4 — export_to_library writes a shelf-shaped entry', () => {
  let session: TestSession;
  let response: ExportToLibraryResponse;

  beforeAll(async () => {
    session = await connect(projectA(), true);
    await reveal(session, 'explore');
    const res = await call<ExportToLibraryResponse>(session, 'export_to_library', {
      component: 'Pages/Home',
      ...ENTRY
    });
    expect(res.isError).toBe(false);
    response = res.data;
  }, 30_000);

  afterAll(async () => {
    await session.close();
    fs.rmSync(path.join(shelfRoot, 'prefabs', ENTRY.slug), { recursive: true, force: true });
  });

  it('🔴 carries the CLOSURE, not just the component it was asked for', () => {
    // `Pages/Home` places `/Card`. An entry shipping only the page installs a
    // page whose middle is a missing type — the exact failure this AC exists to
    // make impossible.
    expect(response.componentsExported).toEqual(expect.arrayContaining(['/Pages/Home', '/Card']));
    expect(response.componentsExported).toHaveLength(2);
  });

  it('carries the named styles the graph uses, and NOT the ones it does not', () => {
    expect(response.stylesCarried.colors).toEqual(['Brand Blue']);
    expect(response.stylesCarried.textStyles).toEqual(['Card Label']);
    expect(response.stylesCarried.variants).toEqual(['Soft (Group)']);
    // A part that drags a whole project's palette onto the shelf is a part
    // nobody can install without arguing with it.
    expect(response.stylesCarried.colors).not.toContain('Unused Grey');
    expect(response.stylesCarried.variants).not.toContain('Loud (Group)');
  });

  it('copies the file a parameter points at', () => {
    expect(response.assetsCopied).toEqual(['images/logo.svg']);
    expect(fs.existsSync(path.join(shelfRoot, 'prefabs', ENTRY.slug, 'project', 'images', 'logo.svg'))).toBe(true);
  });

  it('🔴 reports the token by NAME and leaves it in the graph, so the part adopts the host theme', () => {
    expect(response.tokensUsed).toContain('--foreground');
    const project = JSON.parse(
      fs.readFileSync(path.join(shelfRoot, 'prefabs', ENTRY.slug, 'project', 'project.json'), 'utf8')
    );
    // Not resolved to project A's literal on the way out: the string that ships
    // is still the token, which is the whole mechanism.
    expect(JSON.stringify(project)).toContain('var(--foreground)');
    expect(response.stylesCarried.colors).not.toContain('--foreground');
  });

  it('🔴 warns about the literal colour rather than shipping it silently', () => {
    expect(response.hardcodedColors).toEqual([
      { component: '/Card', node: 'Card', parameter: 'borderColor', value: '#ff00aa' }
    ]);
    expect(response.next).toContain('ignore the theme');
    // And the person browsing the shelf is told too, not only the agent that
    // called the tool.
    const readme = fs.readFileSync(path.join(shelfRoot, 'prefabs', ENTRY.slug, 'README.md'), 'utf8');
    expect(readme).toContain('#ff00aa');
    expect(readme).toContain('--foreground');
  });

  it('the entry is a shelf row: listShelf indexes it with the label and tags it was given', () => {
    const { rows, problems } = listShelf(shelfRoot);
    expect(problems).toEqual([]);
    const row = rows.find((r) => r.slug === ENTRY.slug);
    expect(row).toMatchObject({ type: 'prefab', label: 'Demo Home', tags: ['UI', 'Page'], version: '1.0.0' });
  });

  it('never overwrites an entry that exists', async () => {
    const again = await call<ToolErrorPayload>(session, 'export_to_library', { component: 'Card', ...ENTRY });
    expect(again.isError).toBe(true);
    expect(again.data.error.code).toBe('conflict');
    expect(again.data.error.message).toContain(ENTRY.slug);
  });

  it('refuses a slug that cannot be a directory, and a component that is not here', async () => {
    const badSlug = await call<ToolErrorPayload>(session, 'export_to_library', {
      component: 'Card',
      ...ENTRY,
      slug: '../escape'
    });
    expect(badSlug.isError).toBe(true);
    expect(badSlug.data.error.code).toBe('invalid-argument');

    const missing = await call<ToolErrorPayload>(session, 'export_to_library', {
      component: 'Nope/Missing',
      ...ENTRY,
      slug: 'nope'
    });
    expect(missing.isError).toBe(true);
    expect(missing.data.error.code).toBe('not-found');
    expect(fs.existsSync(path.join(shelfRoot, 'prefabs', 'nope'))).toBe(false);
  });
});

describe('CMP-004 AC4 — the round trip: A → shelf → B', () => {
  let a: TestSession;
  let b: TestSession;
  let bDir: string;

  beforeAll(async () => {
    a = await connect(projectA(), true);
    await reveal(a, 'explore');
    await call<ExportToLibraryResponse>(a, 'export_to_library', { component: 'Pages/Home', ...ENTRY });
    const built = await projectB();
    b = built.session;
    bDir = built.dir;
  }, 60_000);

  afterAll(async () => {
    await a.close();
    await b.close();
    fs.rmSync(path.join(shelfRoot, 'prefabs', ENTRY.slug), { recursive: true, force: true });
  });

  it('🔴 project B sees the entry on the shelf and installs it', async () => {
    // The precondition, asserted rather than assumed: B genuinely lacks both.
    const before = await call<{ components: Array<{ path: string }> }>(b, 'list_components', {});
    expect(before.data.components.map((c) => c.path)).not.toContain('Card');

    const listed = await call<ListLibraryResponse>(b, 'list_library', {});
    expect(listed.data.entries.map((e) => e.slug)).toContain(ENTRY.slug);

    const installed = await call<InstallPrefabResponse>(b, 'install_prefab', { slug: ENTRY.slug });
    expect(installed.isError).toBe(false);
    expect(installed.data.componentsInstalled).toEqual(expect.arrayContaining(['/Pages/Home', '/Card']));
    expect(installed.data.stylesMerged.colors).toEqual(['Brand Blue']);
    expect(installed.data.stylesMerged.textStyles).toEqual(['Card Label']);
    expect(installed.data.stylesMerged.variants).toEqual(['Soft (Group)']);
    expect(installed.data.filesCopied).toEqual(['images/logo.svg']);
  }, 30_000);

  it('🔴 what arrives is the thing that left — the graph, the wire, and the reference between the two', async () => {
    const home = await call<{ nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }> }>(
      b,
      'get_component',
      { path: 'Pages/Home' }
    );
    expect(home.isError).toBe(false);
    const types = home.data.nodes.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['Page', 'Group', 'Text', 'net.noodl.controls.button']));

    // The instance reference survived the v2 → legacy → v2 conversion, and now
    // resolves against the component that travelled with it.
    const cardInstance = home.data.nodes.find((n) => n.id === 'card' || n.type === '/Card');
    expect(cardInstance?.type).toBe('/Card');

    const card = await call<{ nodes: Array<{ id: string; variant?: string; parameters?: Record<string, unknown> }> }>(
      b,
      'get_component',
      { path: 'Card' }
    );
    expect(card.isError).toBe(false);
    const root = card.data.nodes.find((n) => n.id === 'card_root');
    expect(root?.variant).toBe('Soft');
    expect(root?.parameters?.backgroundColor).toBe('Brand Blue');
    expect(root?.parameters?.backgroundImage).toBe('images/logo.svg');
    const text = card.data.nodes.find((n) => n.id === 'card_text');
    expect(text?.parameters?.color).toBe('var(--foreground)');
    expect(text?.parameters?.textStyle).toBe('Card Label');
  });

  it('🔴 and project B considers it sound: no error diagnostic names what arrived', async () => {
    const report = await call<{ diagnostics: Array<{ severity: string; message: string; component?: string }> }>(
      b,
      'validate_project',
      {}
    );
    expect(report.isError).toBe(false);
    const errors = report.data.diagnostics.filter((d) => d.severity === 'error');
    // Named rather than counted: a bare `toHaveLength(0)` on a fixture nobody
    // pinned would fail for somebody else's reason and read as this one's.
    expect(errors.filter((d) => /Card|Home/.test(`${d.component ?? ''} ${d.message}`))).toEqual([]);
  }, 30_000);

  it('the named colour landed in B\'s own styles file, where B\'s theme reads it', () => {
    const styles = JSON.parse(fs.readFileSync(path.join(bDir, 'nodegx.styles.json'), 'utf8')) as {
      colors: Record<string, string>;
      variants: Array<{ name: string }>;
    };
    expect(styles.colors['Brand Blue']).toBe('#1b6ef3');
    expect(styles.variants.map((v) => v.name)).toContain('Soft');
    // Project A's unused palette did not come along for the ride.
    expect(styles.colors['Unused Grey']).toBeUndefined();
  });
});

describe('CMP-004 AC4 — the door a model that was never told finds', () => {
  it('find_tools reveals it by name, the way the other three library tools are reached', async () => {
    const session = await connect(copyFixture(), true);
    try {
      const res = await call<FindToolsResponse>(session, 'find_tools', { query: 'library' });
      expect(res.data.revealed).toContain('export_to_library');
    } finally {
      await session.close();
    }
  });

  it('a read-only server never registers it — exporting is a write to the checkout', async () => {
    const session = await connect(copyFixture(), false);
    try {
      await reveal(session, 'explore');
      const tools = await session.client.listTools();
      expect(tools.tools.map((t) => t.name)).toContain('get_library_entry');
      expect(tools.tools.map((t) => t.name)).not.toContain('export_to_library');
    } finally {
      await session.close();
    }
  });
});
