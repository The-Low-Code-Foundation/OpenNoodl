/**
 * LBR-008 — the shelf: `list_library`, `get_library_entry`, `install_prefab`.
 *
 * Grades against `tests/fixtures/library-shelf/`, never the repo's real
 * `library/` — ~24 agents edit that tree concurrently during the blitz, so a
 * content assertion against it would fail on a peer's mid-edit entry and pass
 * on nothing of ours. The one thing asserted about the real tree is that the
 * walk-up resolution *finds* it (no content read).
 *
 * 🔴 **The discovery door is asserted, not assumed** — the same posture as
 * `kitTools.test.ts` and for the same reason: these tools cost zero resident
 * tokens because they sit in a deferred group whose `purpose` line does not
 * name prefabs, so `find_tools`' name-matching `query` is the way a model that
 * has not been told they exist reaches them. If that door breaks, the failure
 * is silent everywhere else.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { buildKitExtractor, call, connect, copyFixture, exists, readJson, reveal, type TestSession } from './helpers';
import { clearProjectOverlay } from '../src/kitOverlay';
import { listShelf, resolveLibraryRoot } from '../src/libraryShelf';
import type {
  GetLibraryEntryResponse,
  InstallPrefabResponse,
  ListLibraryResponse
} from '../src/tools/libraryTools';
import type { FindToolsResponse, ToolErrorPayload } from '../src/tools/responses';

const SHELF_FIXTURE = path.join(__dirname, 'fixtures', 'library-shelf');

let extractorDir: string;

beforeAll(async () => {
  process.env.NODEGX_LIBRARY_DIR = SHELF_FIXTURE;
  // CN-003's extractor, built from source per run — dist/ is gitignored, so
  // reading it would skip in a fresh checkout and grade a stale artifact in a
  // working one. Needed by the module-install spec, whose whole point is that
  // the node ARRIVES rather than that files got copied.
  extractorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbr008-extract-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(extractorDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_LIBRARY_DIR;
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(extractorDir, { recursive: true, force: true });
});

afterEach(() => clearProjectOverlay());

describe('LBR-008 — the shelf resolves its source', () => {
  it('walks up from the package to the checkout library/ when the env override is absent', () => {
    const saved = process.env.NODEGX_LIBRARY_DIR;
    delete process.env.NODEGX_LIBRARY_DIR;
    try {
      const resolved = resolveLibraryRoot();
      // Existence only — the real tree's CONTENT belongs to ~24 concurrent
      // editors and is asserted by library:check, not here.
      expect(resolved).toEqual({ ok: true, root: expect.stringMatching(/\/library$/) });
    } finally {
      process.env.NODEGX_LIBRARY_DIR = saved;
    }
  });

  it('reports an env override that points nowhere, rather than falling back silently', () => {
    const saved = process.env.NODEGX_LIBRARY_DIR;
    process.env.NODEGX_LIBRARY_DIR = '/nonexistent/library';
    try {
      const resolved = resolveLibraryRoot();
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) expect(resolved.reason).toContain('/nonexistent/library');
    } finally {
      process.env.NODEGX_LIBRARY_DIR = saved;
    }
  });

  it('indexes entries cheaply and quarantines a malformed one instead of failing the list', () => {
    const { rows, problems } = listShelf(SHELF_FIXTURE);
    expect(rows.map((r) => r.slug).sort()).toEqual(['badge-card', 'tiny-kit']);
    // A peer mid-edit (here: prefabs/broken, invalid JSON) must neither kill
    // the index nor vanish from it.
    expect(problems).toEqual([{ slug: 'broken', type: 'prefab', problem: expect.any(String) }]);
  });
});

describe('LBR-008 — discovery through find_tools', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await connect(copyFixture());
  });

  afterEach(async () => {
    await session.close();
  });

  it('starts deferred, and query "library" reveals the shelf by tool name', async () => {
    const before = (await session.client.listTools()).tools.map((t) => t.name);
    expect(before).not.toContain('list_library');
    expect(before).not.toContain('install_prefab');

    const res = await call<FindToolsResponse>(session, 'find_tools', { query: 'library' });
    expect(res.isError).toBe(false);
    expect(res.data.revealed).toEqual(expect.arrayContaining(['list_library', 'get_library_entry']));

    const prefab = await call<FindToolsResponse>(session, 'find_tools', { query: 'prefab' });
    expect(prefab.data.revealed).toContain('install_prefab');
  });

  it('the explore group reveals all three on a write server', async () => {
    await reveal(session, 'explore');
    const names = (await session.client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_library', 'get_library_entry', 'install_prefab']));
  });

  it('a read-only server serves the reads and never registers install_prefab', async () => {
    const ro = await connect(copyFixture(), false);
    try {
      await reveal(ro, 'explore');
      const names = (await ro.client.listTools()).tools.map((t) => t.name);
      expect(names).toContain('list_library');
      expect(names).toContain('get_library_entry');
      expect(names).not.toContain('install_prefab');
    } finally {
      await ro.close();
    }
  });
});

describe('LBR-008 — list_library and get_library_entry', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await connect(copyFixture());
    await reveal(session, 'explore');
  });

  afterEach(async () => {
    await session.close();
  });

  it('lists index rows: slug, label, ONE-line description, tags, version, size', async () => {
    const res = await call<ListLibraryResponse>(session, 'list_library');
    expect(res.isError).toBe(false);
    const badge = res.data.entries.find((e) => e.slug === 'badge-card');
    expect(badge).toEqual({
      slug: 'badge-card',
      type: 'prefab',
      label: 'Badge Card',
      description: 'A small card with a badge.',
      tags: ['UI', 'Feedback'],
      version: '1.2.0',
      // CMP-004 AC3 — read off this fixture entry's own project.json, not declared anywhere.
      size: { components: 2, nodes: 3 }
    });
    // The second line of the description must NOT be in the index — the index
    // costs like an index, detail is get_library_entry's job.
    expect(JSON.stringify(res.data.entries)).not.toContain('Second line');
    expect(res.data.problems).toEqual([expect.objectContaining({ slug: 'broken' })]);
  });

  it('filters by type and by tag', async () => {
    const modules = await call<ListLibraryResponse>(session, 'list_library', { type: 'module' });
    expect(modules.data.entries.map((e) => e.slug)).toEqual(['tiny-kit']);
    const feedback = await call<ListLibraryResponse>(session, 'list_library', { tag: 'feedback' });
    expect(feedback.data.entries.map((e) => e.slug)).toEqual(['badge-card']);
  });

  it('returns full detail for one entry: description, components, modules, README', async () => {
    const res = await call<GetLibraryEntryResponse>(session, 'get_library_entry', { slug: 'badge-card' });
    expect(res.isError).toBe(false);
    expect(res.data.description).toContain('Second line');
    expect(res.data.components).toEqual(['/Badge Card', '/Badge Card/Chip']);
    expect(res.data.modules).toEqual([]);
    expect(res.data.readme).toContain('Post-install');

    const kit = await call<GetLibraryEntryResponse>(session, 'get_library_entry', { slug: 'tiny-kit' });
    expect(kit.data.modules).toEqual(['tiny-kit']);
    expect(kit.data.readme).toBeUndefined();
  });

  it('answers an unknown slug with not-found and points at the index', async () => {
    const res = await call<ToolErrorPayload>(session, 'get_library_entry', { slug: 'no-such-entry' });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('not-found');
    expect(res.data.error.message).toContain('list_library');
  });
});

describe('LBR-008 — install_prefab', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir);
    await reveal(session, 'explore');
  });

  afterEach(async () => {
    await session.close();
  });

  it('installs a prefab: components arrive converted, styles merge, assets copy', async () => {
    const res = await call<InstallPrefabResponse>(session, 'install_prefab', { slug: 'badge-card' });
    expect(res.isError).toBe(false);
    expect(res.data.componentsInstalled).toEqual(['/Badge Card', '/Badge Card/Chip']);
    expect(res.data.componentsSkipped).toEqual([]);
    expect(res.data.stylesMerged).toEqual({
      colors: ['Badge Red'],
      textStyles: ['Badge Label'],
      variants: ['Pill (Group)']
    });
    expect(res.data.filesCopied).toEqual(['images/badge.svg']);

    // On disk, in the v2 layout the store and the editor both read.
    expect(exists(projectDir, 'components/Badge Card/component.json')).toBe(true);
    expect(exists(projectDir, 'components/Badge Card/Chip/nodes.json')).toBe(true);
    expect(exists(projectDir, 'images/badge.svg')).toBe(true);
    const registry = readJson<{ components: Record<string, unknown> }>(projectDir, 'components/_registry.json');
    expect(Object.keys(registry.components)).toEqual(
      expect.arrayContaining(['Badge Card', 'Badge Card/Chip'])
    );
    const styles = readJson<{ colors: Record<string, string>; variants: unknown[] }>(projectDir, 'nodegx.styles.json');
    expect(styles.colors['Badge Red']).toBe('#ff0000');
    expect(styles.variants).toHaveLength(1);

    // And the server can read what it wrote — the component is a component,
    // not just three files.
    const fetched = await call<{ component: { path: string }; nodes: unknown[] }>(session, 'get_component', {
      path: 'Badge Card'
    });
    expect(fetched.isError).toBe(false);
    expect((fetched.data.nodes as Array<{ type: string }>).map((n) => n.type)).toEqual(
      expect.arrayContaining(['Group', 'Text'])
    );
  });

  it('a second install keeps yours: everything reports skipped, nothing duplicates', async () => {
    await call<InstallPrefabResponse>(session, 'install_prefab', { slug: 'badge-card' });
    const again = await call<InstallPrefabResponse>(session, 'install_prefab', { slug: 'badge-card' });
    expect(again.isError).toBe(false);
    expect(again.data.componentsInstalled).toEqual([]);
    expect(again.data.componentsSkipped).toEqual(['/Badge Card', '/Badge Card/Chip']);
    expect(again.data.stylesMerged).toEqual({ colors: [], textStyles: [], variants: [] });
    expect(again.data.stylesSkipped.colors).toEqual(['Badge Red']);
    expect(again.data.filesCopied).toEqual([]);
    expect(again.data.filesSkipped).toEqual(['images/badge.svg']);

    // The variant did not double — the collision check is by (name, typename),
    // not by "did anything error".
    const styles = readJson<{ variants: unknown[] }>(projectDir, 'nodegx.styles.json');
    expect(styles.variants).toHaveLength(1);
  });

  it('installs a module: files, provenance, and the node ARRIVES in the catalog', async () => {
    const res = await call<InstallPrefabResponse>(session, 'install_prefab', { slug: 'tiny-kit' });
    expect(res.isError).toBe(false);
    expect(res.data.modulesInstalled).toEqual(['tiny-kit']);
    expect(res.data.kitLoadFailures).toBeUndefined();
    expect(exists(projectDir, 'noodl_modules/tiny-kit/index.js')).toBe(true);

    // CN-017 — provenance, the 'imported' arm: local checkout content.
    const provenance = readJson<Array<{ module: string; origin: string; fromProject: string }>>(
      projectDir,
      'noodl_modules/kit-provenance.json'
    );
    expect(provenance).toEqual([
      expect.objectContaining({ module: 'tiny-kit', origin: 'imported', fromProject: expect.stringContaining('tiny-kit') })
    ]);

    // The feature is not that files got copied — it is that the agent's next
    // get_node_type knows the node (CN-006's AC6, one install path over).
    const fetched = await call<{ types?: Array<{ typeName: string }> }>(session, 'get_node_type', {
      type_names: ['tiny.kit.Chip']
    });
    expect(fetched.isError).toBe(false);
    expect(JSON.stringify(fetched.data)).toContain('tiny.kit.Chip');
  });

  it('refuses an unknown slug without touching the project', async () => {
    const before = fs.readdirSync(projectDir).sort();
    const res = await call<ToolErrorPayload>(session, 'install_prefab', { slug: 'no-such-entry' });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('not-found');
    expect(fs.readdirSync(projectDir).sort()).toEqual(before);
  });
});
