/**
 * SB-007 — the Site Builder template, from the shelf to the project.json on disk.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The half `sb007Template.test.ts` cannot reach
 *
 * The noodl-mcp suite grades the **artefact**: that `site-builder.content.json`
 * is what the MCP door writes today, that its router lists every page, that
 * nothing in it points outside it. All of that is true of a file. This file
 * grades what happens to that file when somebody picks the template — the
 * provider, the instantiation, and the two id rewrites that stand between a
 * shared template object and a project a person owns.
 *
 * That boundary matters because `instantiateContent` is where a template stops
 * being data and starts being a project, and it is the only code in the path
 * that has to *understand* the content. `hello-world` is 150 lines of
 * hand-written graph with no `visualRoots`, no repeaters and no cross-component
 * references; this template is twenty-one door-written components with all three.
 * Every assertion below is about something the existing template could not have
 * exercised.
 */
import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';
import { ProjectContent } from '@noodl-models/template/ProjectTemplate';

// ── The filesystem `install()` writes through ────────────────────────────────

/**
 * `EmbeddedTemplateProvider.install` reaches `@noodl/platform` through a dynamic
 * `import()` rather than a constructor dependency, so the seam is the module.
 * ⚠️ Mocking it does **not** make the renderer reachable — this runner is plain
 * Node and anything touching React or an editor singleton still fails loudly.
 */
const written = new Map<string, string>();
const madeDirectories: string[] = [];

jest.mock(
  '@noodl/platform',
  () => ({
    filesystem: {
      exists: () => false,
      join: (...parts: string[]) => parts.join('/'),
      makeDirectory: async (path: string) => {
        madeDirectories.push(path);
      },
      writeFile: async (path: string, contents: string) => {
        written.set(path, contents);
      }
    }
  }),
  { virtual: true }
);

const provider = new EmbeddedTemplateProvider();
const TEMPLATE_URL = 'embedded://site-builder';

async function installOnce(destination: string): Promise<ProjectContent> {
  await provider.install(TEMPLATE_URL, destination);
  const raw = written.get(`${destination}/project.json`);
  if (!raw) throw new Error(`install wrote nothing to ${destination}/project.json`);
  return JSON.parse(raw) as ProjectContent;
}

interface Node {
  id: string;
  type: string;
  children?: Node[];
}

function nodeIdsOf(project: ProjectContent): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children?.length) walk(node.children);
    }
  };
  for (const component of project.components ?? []) walk((component.graph?.roots ?? []) as unknown as Node[]);
  return ids;
}

// ── 1. It is on the shelf, and it is the right kind of thing ─────────────────

describe('SB-007 — the template is on the embedded shelf', () => {
  it('lists a Site Builder row the registry can install', async () => {
    const items = await provider.list();
    const row = items.find((i) => i.projectURL === TEMPLATE_URL);
    expect(row).toBeDefined();
    expect(row?.title).toBe('Site Builder');
  });

  it('claims its own URL', async () => {
    expect(await provider.canInstall(TEMPLATE_URL)).toBe(true);
  });

  it('uses the platform’s category vocabulary rather than a prose title', async () => {
    // The full vocabulary check lives in `fb-005/template-shelf.test.ts`, which
    // walks every embedded template. This is the one row's half of it, stated
    // here so a failure names this template.
    const items = await provider.list();
    expect(items.find((i) => i.projectURL === TEMPLATE_URL)?.category).toBe('site');
  });

  it('control: the shelf holds more than this one row', async () => {
    // Without it, "the shelf contains Site Builder" is satisfied by a provider
    // that lost `hello-world` — which is a regression this file would otherwise
    // pass straight over.
    const ids = provider.getTemplateIds();
    expect(ids).toContain('site-builder');
    expect(ids).toContain('hello-world');
  });
});

// ── 2. Instantiation: the project a person gets ──────────────────────────────

describe('SB-007 — install writes a project that opens', () => {
  beforeEach(() => {
    written.clear();
    madeDirectories.length = 0;
  });

  it('writes a project.json holding all twenty-one components, and its policy, and nothing else', async () => {
    const project = await installOnce('/projects/a');
    // 🔴 The list is EXHAUSTIVE on purpose, and it earned that in s12: SB-015
    // added a second write (`nodegx.security.json`, the backend policy the
    // template's graphs assume) and this assertion is what reported it. An
    // `toContain` here would have let a new file land in every project made from
    // every template with nothing to notice. Keep it exhaustive.
    // (It reported again when SBR-003 added the third write: `docs/THEME.md`,
    // the token contract the door's `get_project_doc` lists — path-validated by
    // `assertTemplateDocPath`, graded in `tests-unit/sbr-003/`.)
    expect([...written.keys()]).toEqual([
      '/projects/a/project.json',
      '/projects/a/nodegx.security.json',
      '/projects/a/docs/THEME.md'
    ]);
    // 19 → 21: SBR-006's `/Admin/Shell` and `/Admin/NewPageDialog`.
    expect(project.components).toHaveLength(21);
  });

  it('🔴 resolves a concrete rootNodeId, so the project has a home component', async () => {
    // 🔴 `instantiateContent`'s own header records why this is not decoration:
    // `ProjectModel.fromJSON` honours the `rootComponent` *name* only by calling
    // `setRootComponent()`, which silently no-ops unless the NodeLibrary already
    // has the root node's type loaded — and at project-creation time the editor
    // is on the launcher with an empty NodeLibrary. A concrete id is resolved by
    // lookup and does not care.
    const project = await installOnce('/projects/a');
    expect(project.rootNodeId).toBeDefined();
    expect(nodeIdsOf(project).has(project.rootNodeId as string)).toBe(true);
  });

  it('control: that rootNodeId is the App’s root node, not just any id', async () => {
    const project = await installOnce('/projects/a');
    const app = project.components?.find((c) => c.name === project.rootComponent);
    expect(app).toBeDefined();
    expect(app?.graph?.roots?.[0]?.id).toBe(project.rootNodeId);
  });

  it('gives two projects from the same template disjoint node ids', async () => {
    const first = await installOnce('/projects/a');
    const second = await installOnce('/projects/b');
    const a = nodeIdsOf(first);
    const b = nodeIdsOf(second);
    // 203 since SBR-004 gave the public site its shape: `Site/NavLink` gained
    // the current-page pair (`Variable2` + the state function, AC2) and
    // `Pages/Site` gained six — the `frame` that consumes `--background`, the
    // `notFoundCard` the empty-screen text now sits in, and the footer's four
    // (group, name, link, `RouterNavigate`). +2 and +6 against SBR-002's 195,
    // which was the answer deadline (`Timer`); 194 was SB-018 (5)'s `stored` on
    // `submitContactForm`; 193 was SB-015 F27's `diagnoseNotFound`; 192 was
    // SB-014's `Theme` creator. The literal is the point: a rewrite that renamed
    // ids instead of regenerating them would keep the disjointness assertion
    // below green on a set that had SHRUNK.
    // 203 → 232: the shell, the dialog, and the rebuilt page row / page list.
    // 232 → 234: SBR-015's two `status: 'failure'` Response nodes, one each on
    // `publishPage` and `duplicatePage` — the graphs had no failure exit at all.
    // 234 → 236: SBR-015 AC1's browser half — `/Admin/PageRow` gains the Text
    // that says why a call refused and the `States` that resets it, because the
    // server's refusal was arriving and being discarded.
    expect(a.size).toBe(236);
    expect([...a].filter((id) => b.has(id))).toEqual([]);
  });

  it('does not mutate the shared template object', async () => {
    // Two installs in a row that both produced fresh ids already implies it, but
    // the failure mode is worth naming: the template is a module-level singleton,
    // so a mutating instantiation would make the second project a copy of the
    // first's ids and the third a copy of the second's.
    await installOnce('/projects/a');
    const template = provider.getTemplate('site-builder');
    const authored = (template?.content.components ?? []).find((c) => c.name === '/App');
    expect(authored?.graph?.roots?.[0]?.id).toBe('app_root');
  });
});

// ── 3. Every id the project names is an id the project has ───────────────────

describe('SB-007 — the id rewrite reaches everything that carries an id', () => {
  beforeEach(() => {
    written.clear();
  });

  it('every connection endpoint names a node that exists', async () => {
    const project = await installOnce('/projects/a');
    const ids = nodeIdsOf(project);
    const dangling: string[] = [];

    for (const component of project.components ?? []) {
      for (const connection of component.graph?.connections ?? []) {
        if (!ids.has(connection.fromId)) dangling.push(`${component.name}: fromId ${connection.fromId}`);
        if (!ids.has(connection.toId)) dangling.push(`${component.name}: toId ${connection.toId}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it('🔴 every visualRoots entry names a node that exists', async () => {
    // 🔴 **THE THIRD PLACE A NODE ID LIVES, AND THE FIRST TEMPLATE THAT HAS ONE.**
    //
    // `instantiateContent` regenerates node ids and rewrites `connections`. It
    // does not touch `graph.visualRoots`, which twelve of this template's
    // twenty-one components carry — because `hello-world` is hand-written and has
    // none, and no other embedded template exists. So the field went unremapped
    // for the whole life of the provider with nothing to expose it.
    //
    // `lessonstarter.ts:341` already checks this exact class of defect on a
    // different artefact, in the same words: *"visualRoots names X, which is not
    // there"*.
    const project = await installOnce('/projects/a');
    const ids = nodeIdsOf(project);
    const dangling: string[] = [];

    for (const component of project.components ?? []) {
      const visualRoots = (component.graph as unknown as { visualRoots?: string[] })?.visualRoots ?? [];
      for (const id of visualRoots) {
        if (!ids.has(id)) dangling.push(`${component.name}: visualRoots names ${id}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it('control: there ARE visualRoots to grade, and connections too', async () => {
    // 🔴 Both assertions above are `toEqual([])`, which an empty population also
    // satisfies. This is the arm that says neither was vacuous.
    const project = await installOnce('/projects/a');
    const withVisualRoots = (project.components ?? []).filter(
      (c) => ((c.graph as unknown as { visualRoots?: string[] })?.visualRoots ?? []).length > 0
    );
    // 12 → 14: both new components carry visual trees.
    expect(withVisualRoots).toHaveLength(14);
    expect((project.components ?? []).flatMap((c) => c.graph?.connections ?? []).length).toBeGreaterThan(200);
  });
});
