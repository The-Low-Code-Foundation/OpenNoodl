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

/**
 * The same provider with nothing held, which is the only way to grade the **shape of the row**
 * now that the real shelf does not offer one.
 *
 * 🔴 **Richard's ruling D1 (2026-09-04) holds `site-builder` out of 0.2.2** — registered and
 * installable, absent from the create wizard. The two assertions below are about the row's title
 * and its category vocabulary, which are facts about the template's metadata and not about whether
 * it is currently offered; held behind an empty set they keep grading that metadata, and they will
 * go on grading it when the hold is lifted. `heldOut` below pins the ruling itself.
 */
const unheldProvider = new EmbeddedTemplateProvider(new Set<string>());
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
  it('lists a Site Builder row the registry can install, once nothing is held', async () => {
    const items = await unheldProvider.list();
    const row = items.find((i) => i.projectURL === TEMPLATE_URL);
    expect(row).toBeDefined();
    expect(row?.title).toBe('Site Builder');
  });

  it('🔴 is OFFERED on the real shelf for 0.2.2 — D1 closed, and the row is the whole row', async () => {
    /**
     * Ruling D1 held this off the create wizard on 2026-09-04. Richard closed it on 2026-09-05,
     * shown the two seams he had named built and photographed against a one-variable before-arm:
     * *"It's passable, let's include it in the 0.2.2 release, add it to the templates menu."*
     *
     * 🔴 **Asserted on the SHIPPED provider, not the unheld one.** The case above already reads
     * the row out of a provider constructed with nothing held, and that arm went on passing
     * through the entire time this template was invisible to every user — which is exactly what
     * the D1 near-miss was made of. This is the one that can tell the difference.
     *
     * The whole row is asserted rather than its presence: it is what the wizard and the Templates
     * tab both draw, and `needsBackend` is what SBR-001 routes the create path on.
     */
    const offered = await provider.list();
    const row = offered.find((i) => i.projectURL === TEMPLATE_URL);

    expect(row).toBeDefined();
    expect(row?.title).toBe('Site Builder');
    expect(row?.category).toBe('site');
    expect(row?.needsBackend).toBe(true);

    // Offered has never meant anything about installability, and still does not.
    expect(await provider.canInstall(TEMPLATE_URL)).toBe(true);
    expect(provider.getTemplateIds()).toContain('site-builder');
  });

  it('claims its own URL', async () => {
    expect(await provider.canInstall(TEMPLATE_URL)).toBe(true);
  });

  it('uses the platform’s category vocabulary rather than a prose title', async () => {
    // The full vocabulary check lives in `fb-005/template-shelf.test.ts`, which
    // walks every embedded template. This is the one row's half of it, stated
    // here so a failure names this template.
    const items = await unheldProvider.list();
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

  it('writes a project.json holding every component, and its policy, and nothing else', async () => {
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
    // 🔴 21 → 22: SBR-017's `/Pages/SignIn` (`7913e6b6`) — the template shipped a
    // SignUp and no LogIn. This literal, and the two below, sat WRONG for three
    // commits: `test:main` is the unwatched runner (the phase's standing gate note
    // quotes `test:ci`, a different one), so nothing reported the drift. Recorded
    // as D19.
    // ⚠️ **It was wrong again, and by the same mechanism.** Measured at HEAD
    // before this line was touched: the shipped template held **24** components
    // while this said 22, so the row was already two behind — `test:main` is
    // still the unwatched runner.
    // 24 → 30: SBR-005's six section-kind components.
    // 30 → 31: SBR-009's `/Admin/PresetChip`.
    // 31 → 33: SBR-010's `/Admin/MessageRow` and `/Pages/Messages`.
    expect(project.components).toHaveLength(33);
  });

  it('🔴 writes `bodyScroll: true` into the project a person receives (D40)', async () => {
    // 🔴 **This is not a preference, it is whether the app can be used** — the
    // sentence is `createProject.ts`'s own, where the MCP door has written this
    // setting for every project it makes since REL-002a. The site-builder
    // template's `settings` block said `{ htmlTitle, navigationPathType }` and
    // stopped, and that single absence is D40: `viewer.jsx` adds `body-scroll`
    // only when the setting is truthy, and without the class `#root` keeps
    // `overflow: clip` / `position: fixed`, which — per NDA-008's own comment —
    // *creates no scroll container at all*. Fourteen sessions read that as
    // "nothing scrolls": not the wheel, not `scrollTop`, not `scrollIntoView`,
    // because the page was never a scroll container. A person on a laptop could
    // not reach 9 of the page editor's 16 fields.
    //
    // ⚠️ It is asserted **here**, on the installed `project.json`, and not only
    // on `site-builder.content.json`. The artefact carrying the setting and the
    // project carrying it are two claims: `instantiateContent` stands between
    // them, and it is the code that has to understand the content. This is the
    // half that says what the wizard actually wrote to disk.
    const project = await installOnce('/projects/a');
    expect((project as unknown as { settings?: Record<string, unknown> }).settings).toMatchObject({
      bodyScroll: true
    });
  });

  it('control: the other settings survived instantiation too', async () => {
    // Without this, the assertion above is satisfied by an install that wrote a
    // `settings` block containing nothing else — which would be a different
    // regression wearing the same green.
    const project = await installOnce('/projects/a');
    expect((project as unknown as { settings?: Record<string, unknown> }).settings).toMatchObject({
      htmlTitle: 'Site Builder',
      navigationPathType: 'path'
    });
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
    // 236 → 257: SBR-017's `/Pages/SignIn` and its LogIn graph (`7913e6b6`).
    // 257 → 259: SBR-016's list-refresh pair (`cdd842fc`) — the query a migration
    // had written out of the graph.
    // 259 → 274: SBR-007 s21's rebuilt page editor (`7a156972`), net of the nodes
    // that rebuild replaced: +16 on `/Pages/PageEditor` (the header row this task
    // later fixed for D18), +2 on `/Pages/Admin`, +2 on `/Admin/PageRow`.
    // ⚠️ **Measured at HEAD before this line was touched: 295, against the 274
    // here.** Twenty-one ids of drift — SBR-015's and SBR-016's later passes — on
    // the same unwatched runner as the component count above. The two deltas
    // below are from 295, which is the number that was actually shipping.
    // 295 → 335: SBR-005, decomposed — `/Admin/SectionRow` +7, `/Site/SectionView`
    // +8, `/Pages/Site` −3 (the duplicate page-level contact form, D37), and +28
    // across the six new section components.
    // 335 → 372: SBR-009, decomposed — `/Pages/ThemeEditor` +32 (three cards, a
    // presets row, the live preview and its four logic nodes), `/Admin/Shell` +2
    // (AC1's Theme query and applier) and `/Admin/PresetChip` +3.
    // 372 → 393, and the arithmetic is +21 rather than +20: SBR-010's two
    // components carry 9 and 11 nodes, and `/Admin/Shell` gains the twenty-first
    // — `goMessages`, the RouterNavigate the rail item never had.
    // 🔴 **393 → 400, and the literal had been stale for FOUR sessions.** Read
    // as red by P82 s23 while running this suite for a different reason; the
    // decomposition is measured by counting nodes in the artefact at each
    // commit, not derived:
    //   393 → 394  REL-011b AC1 (`3f95a804`) — `/Admin/PresetChip`'s first
    //              Function node, the one that publishes `{ name }` at the press
    //              so three chips stop wiring a constant into one port.
    //              ⚠️ REL-011a (`d88368c5`) moved 53 controls onto the palette
    //              and added NO node, which is why it is not a step here.
    //   394 → 401  REL-011c (`86fcbcc6`) — three breakpoints, each a
    //              `Screen Resolution` plus the function that reads it:
    //              `/Admin/Shell` +2, `/Pages/ThemeEditor` +2, and
    //              `/Pages/PageEditor` +3 (its third is the `Pick a kind and add
    //              it` Group).
    //   401 → 400  REL-011c residual 2, s23 — `/Site/ContactForm`'s fixed `h2`
    //              is gone. The card sat one line below `/Site/ContactSection`'s
    //              own heading, which is the one the author writes, and
    //              `/contact-only` drew "Get in touch" twice.
    //   400 → 401  REL-011c's document outline, s27 — `siteMain`, `/Pages/Site`'s
    //              `<main>`. Six of the seven pages took the landmark as a
    //              PARAMETER on a column they already had and cost no node; this
    //              page's `shell` also holds the nav band and the colophon, so a
    //              `main` on it would announce the site's navigation as the
    //              page's content and the landmark had to be a box of its own.
    //   401 → 406  🔴 NOT this phase — P77/SBR-007 AC3 (`f77e6647`, 2026-09-05
    //              13:37), the drop zone on `/Admin/SectionRow`: `dropZone`,
    //              `dropHint`, `dropWords`, `dropRefused`, `dropRefusal`. Five
    //              ids, named in that commit's own diff, and 401 + 5 reconciles
    //              exactly. ⚠️ It left `test:main` RED for every peer on the
    //              checkout, because this gate lives in `noodl-editor` and the
    //              node it counts lives in `noodl-mcp` — a package boundary that
    //              no per-package run crosses. Reconciled by P82/s44 while
    //              reading the gate for another row; the FEATURE was not
    //              reviewed, only the count.
    //   406 → 410  🔴 NOT this phase — P82/REL-011c, the two look seams Richard
    //              named. FOUR ids, and each is one node added for one reason:
    //              `statusDot` on `/Admin/PageRow` and again on
    //              `/Pages/PageEditor` (seam 2 — the status stops being a filled
    //              pill and becomes a dot beside a quiet word, so the loudest
    //              thing in a row is no longer the one thing you cannot click),
    //              and `inner` on `/Site/HeroSection` and `/Site/CtaSection`
    //              (seam 5 — those two bands now run the window, and a band
    //              cannot hold its ground at the viewport and its words at the
    //              reading measure with one box). 406 + 4 reconciles exactly.
    //              ⚠️ Same package-boundary hazard as the line above: the nodes
    //              live in `noodl-mcp` and this gate lives in `noodl-editor`, so
    //              no per-package run sees it — `test:main` is what does.
    // ⚠️ The literal is still the point, for the reason four lines up: it is the
    // only thing standing between a rewrite that RENAMED ids and a disjointness
    // assertion that would stay green on a set that had shrunk.
    expect(a.size).toBe(410);
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
    // 14 → 15: SBR-017's `/Pages/SignIn`, which is a page and so carries one too.
    // 🔴 15 → 22, and unlike the two counts above this one was GREEN at HEAD —
    // measured, not assumed. The seven are exactly the seven components added
    // since: SBR-005's six section kinds and SBR-009's `/Admin/PresetChip`. Every
    // one of them is drawn, so every one carries a visual tree; a new component
    // that did not would leave this number alone and be worth asking about.
    // 22 → 24: both of SBR-010's are drawn — the screen and the row it repeats.
    expect(withVisualRoots).toHaveLength(24);
    expect((project.components ?? []).flatMap((c) => c.graph?.connections ?? []).length).toBeGreaterThan(200);
  });
});
