/**
 * TPL-001 — the members' area ships as a prepared project, and the project is
 * the app.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this file is for
 *
 * `tpl001Components.ts` and `tpl001Cloud.ts` are the graphs; this reads what a
 * person actually gets, which is `templates/members-area/` — nineteen component
 * directories, a project file and a policy. The difference between those two
 * populations is where a template breaks (SB-007's finding, restated because it
 * transfers exactly):
 *
 *  - the door checks a reference against **what is on disk when the write
 *    happens**. A shipped artefact is a different population: a component
 *    dropped from the emitted set is a reference the door once resolved and the
 *    project no longer contains.
 *  - `checkNavigation` resolves a Navigate target against **component names**,
 *    not against router registration. A page that exists and is not routed is a
 *    button that does nothing, and it is green everywhere else.
 *
 * ## 🔴 And one hole this template found, measured rather than assumed
 *
 * **The door does not check a connection to a component-instance port at all —
 * not an error, not a warning, not even an info.** Measured by sabotage:
 * renaming `standing.isMember` to `standing.isMemberXX` in `Pages/Members`
 * produced a run identical to the clean one, 46 `dynamic-port-skipped` infos and
 * nothing else.
 *
 * That matters more here than it would in most templates, because **every gate
 * in the members' area is an instance port**: `isMember` reveals the content,
 * `isModerator` reveals the moderator's tools, and `Member` / `Moderator` are
 * the only triggers the queries have. A typo in any of them is a screen that
 * stays empty and a query that never runs — failing shut, silently, exactly like
 * SB-018 (1)'s wire that named a port no runtime has and was dead for five
 * sessions. §3 below is the check the door does not do.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { validateSecurityConfig } from '../../nodegx-backend/src/security/model';

import { TPL001_CLOUD_COMPONENTS } from './tpl001Cloud';
import {
  ANNOUNCEMENT_ROW,
  CHROME_COMPONENT,
  compositionsStillNeedingInertBorderWidthRemoval,
  MEETING_ROW,
  REQUEST_ROW,
  STANDING_COMPONENT,
  withoutInertBorderWidth
} from './tpl001Components';
import { APP_COMPONENT, buildMembersTemplateProject, prepareArtefact, START_HERE_FILE, TEMPLATE_ID } from './tpl001Template';
import { requestedCompositions, USED_COMPOSITIONS } from './tpl001Theme';
import {
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_ASSOCIATION,
  COLLECTION_MEETING,
  COLLECTION_MEMBER,
  COLLECTION_REQUEST,
  FN_UNSUBSCRIBE,
  NO_ANNOUNCEMENTS_TEXT,
  NO_MEETINGS_TEXT,
  NO_REQUESTS_TEXT,
  PENDING_TEXT,
  ROLE_MEMBER,
  ROLE_MODERATOR,
  ROUTER,
  TPL001_COLLECTIONS,
  UNSUBSCRIBE_BACK_LABEL,
  UNSUBSCRIBE_FAILED_TEXT,
  UNSUBSCRIBED_TEXT,
  TPL001_FUNCTIONS,
  TPL002_FUNCTIONS
} from './tpl001Vocabulary';

jest.setTimeout(600000);

const ARTEFACT = path.join(__dirname, '..', '..', '..', 'templates', TEMPLATE_ID);
const POLICY_SOURCE = path.join(__dirname, '..', '..', '..', 'templates', `${TEMPLATE_ID}.security.json`);
const REGENERATE = 'npm run template:members';

// ── Reading the artefact off disk ────────────────────────────────────────────

interface StoredNode {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: string[];
}
interface StoredConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface StoredComponent {
  key: string;
  path: string;
  nodes: StoredNode[];
  connections: StoredConnection[];
}

/**
 * The node a notice's gate has to land on — the sentence's own node, or the box
 * that was put around it.
 *
 * 🔴 **Why this is not just `find the Text`.** Every notice in this template is
 * now a surface `Group` wrapping one `Text`, and the gate belongs on the
 * **wrapper**: that is the node which must leave the tree. Gating the inner
 * `Text` instead would unmount the words and leave a padded, bordered, empty
 * card sitting on the page — which is D16 again, in a nicer typeface.
 *
 * ⚠️ **The wrapper only counts when it wraps exactly this one sentence.** A box
 * with other children is a section, and accepting a gate on it would let a spec
 * pass because some large ancestor was gated rather than the notice itself —
 * an assertion that fits the right answer and the wrong one equally.
 */
function noticeHost(page: StoredComponent, text: string): StoredNode | undefined {
  const words = page.nodes.find((n) => n.type === 'Text' && n.parameters?.text === text);
  if (!words) return undefined;
  const box = page.nodes.find((n) => n.type === 'Group' && (n.children ?? []).includes(words.id));
  return box && (box.children ?? []).length === 1 ? box : words;
}

/** Every file in a directory tree, relative to it. */
function filesUnder(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

/** The shipped components, read from the directories rather than from a manifest. */
function readShipped(): StoredComponent[] {
  const root = path.join(ARTEFACT, 'components');
  const out: StoredComponent[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      walk(path.join(dir, entry.name));
    }
    const componentFile = path.join(dir, 'component.json');
    if (!fs.existsSync(componentFile)) return;
    const doc = JSON.parse(fs.readFileSync(componentFile, 'utf-8')) as { path: string };
    const nodesDoc = JSON.parse(fs.readFileSync(path.join(dir, 'nodes.json'), 'utf-8')) as { nodes?: StoredNode[] };
    const wiresDoc = JSON.parse(fs.readFileSync(path.join(dir, 'connections.json'), 'utf-8')) as {
      connections?: StoredConnection[];
    };
    out.push({
      key: path.relative(root, dir),
      path: doc.path,
      nodes: nodesDoc.nodes ?? [],
      connections: wiresDoc.connections ?? []
    });
  };
  walk(root);
  return out;
}

const shipped = readShipped();
const byLegacyName = new Map(shipped.map((c) => [c.path, c]));
const policy = JSON.parse(fs.readFileSync(path.join(ARTEFACT, 'nodegx.security.json'), 'utf-8')) as {
  version: number;
  devOpen: boolean;
  defaults: { permissions: Record<string, unknown>; creatorOwns: boolean };
  collections: Record<string, { permissions: Record<string, unknown> }>;
  functions: Record<string, { call: unknown }>;
  files: Record<string, unknown>;
  signup: unknown;
};

/** Every node in the whole project, tagged with the component holding it. */
function allNodes(): Array<{ component: StoredComponent; node: StoredNode }> {
  return shipped.flatMap((c) => c.nodes.map((node) => ({ component: c, node })));
}

/** Every rule value in the policy, flattened — the population "no `authenticated`" is about. */
function everyRule(): Array<{ where: string; rule: unknown }> {
  const rows: Array<{ where: string; rule: unknown }> = [];
  for (const [op, rule] of Object.entries(policy.defaults.permissions)) rows.push({ where: `defaults.${op}`, rule });
  for (const [name, entry] of Object.entries(policy.collections)) {
    for (const [op, rule] of Object.entries(entry.permissions)) rows.push({ where: `${name}.${op}`, rule });
  }
  for (const [name, entry] of Object.entries(policy.functions)) rows.push({ where: `${name}.call`, rule: entry.call });
  for (const [op, rule] of Object.entries(policy.files)) rows.push({ where: `files.${op}`, rule });
  rows.push({ where: 'signup', rule: policy.signup });
  return rows;
}

const atomsOf = (rule: unknown): string[] => (Array.isArray(rule) ? rule.map(String) : [String(rule)]);

// ── 1. The artefact is a regeneration, not a copy ────────────────────────────

describe('TPL-001 — the committed template is what the door writes today', () => {
  /**
   * 🔴 **THE ONE ASSERTION THE WHOLE FILE STANDS ON.**
   *
   * Everything below reads the committed directory. If it can drift from the
   * component sets, every claim below is a claim about a stale file. This
   * regenerates through the real MCP server and compares every byte of every
   * file — including the hand-authored policy, which the generator copies in, so
   * there is no file to exclude and therefore no "some of the artefact" to
   * quietly become "the part that still agrees".
   *
   * ⚠️ Determinism is a property, not luck: the door's id remapping, its
   * auto-placement and its page registration are all functions of the authoring
   * order, and the three per-write fields that are not (`id`, `created`,
   * `modified`, in **three files** plus the registry) are pinned by the
   * generator for exactly this comparison.
   */
  it('regenerating from the component sets reproduces every committed byte', async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl001-gate-'));
    // 🔴 The output directory has to be named for the template: `prepareArtefact`
    // refuses to clear anything else, which is the guard that stops a mistyped
    // path deleting something.
    const output = path.join(scratch, TEMPLATE_ID);
    try {
      const built = await buildMembersTemplateProject();
      // The SAME preparation the generator runs, not a re-implementation of it.
      prepareArtefact(built, output, POLICY_SOURCE);

      const committed = filesUnder(ARTEFACT);
      const regenerated = filesUnder(output);
      expect(regenerated).toEqual(committed);

      const differing: string[] = [];
      for (const rel of committed) {
        const a = fs.readFileSync(path.join(ARTEFACT, rel));
        const b = fs.readFileSync(path.join(output, rel));
        if (!a.equals(b)) differing.push(rel);
      }
      if (differing.length > 0) {
        const rel = differing[0];
        const a = fs.readFileSync(path.join(ARTEFACT, rel), 'utf-8').split('\n');
        const b = fs.readFileSync(path.join(output, rel), 'utf-8').split('\n');
        const first = a.findIndex((line, i) => line !== b[i]);
        throw new Error(
          `templates/${TEMPLATE_ID} is not what the door writes today.\n` +
            `  ${differing.length} file(s) differ; first is ${rel} at line ${first + 1}:\n` +
            `    committed:    ${a[first]}\n` +
            `    regenerated:  ${b[first]}\n` +
            `  If a component set or the policy changed on purpose, run \`${REGENERATE}\` and commit the result.`
        );
      }
      expect(differing).toEqual([]);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('control: the comparison is over a real artefact, not two empty directories', () => {
    // 🔴 Without this, "every byte agrees" is satisfiable by two empty file
    // lists — the same green, and the opposite fix.
    const committed = filesUnder(ARTEFACT);
    // 23 components × 3 files, plus the registry, the project file and the policy.
    // 23 rather than 22 since s8: `Members/Chrome`, the band across every
    // signed-in page — the association's name now appears on all seven of them
    // rather than only on the landing page.
    // 22 rather than 21 since s8: `Members/InsideTile`, the landing page's
    // "what members can see" tile. It is a component and not three inline
    // subtrees because the door refused the inline form —
    // `repeated-sibling-subtree`, naming the remedy.
    // REL-002c §E-iii, s8: +1 for `docs/START-HERE.md`. It is the one page that
    // says what to change and where, and it is GENERATED from the artefact that
    // was just written rather than typed — see `writeStartHere`. `docs/` rather
    // than a `/start-here` route because a route would be a public URL telling
    // strangers which parts of a deployed members' area are unfinished.
    // REL-002c item 4: +1 component, `Members/Footer`. Eleven of the thirteen
    // pages ended in undifferentiated white; they place this now, and the two
    // `EDIT ME —` lines an association has to replace stayed two strings rather
    // than becoming twenty-six.
    //
    // 🔴 **REL-010: 32 rather than 30, and both new components exist because
    // something had to be placed on more than one page.** The row's §2.2 is the
    // reason, quoting VIB-013 on the page Richard rated: it is good *"partly
    // because 129 nodes were not hand-written — the compositions were declared
    // once and composed"*, and **the lift is a composition job, not a
    // hand-styling job**.
    //
    // - `Members/InsideBand` — the *"what members can see"* band. It was nine
    //   nodes inline on `Pages/Landing`, which is why the template's only
    //   photographed band could not be put on the door pages that measured
    //   `0 images`.
    // - `Members/Prompt` — the closing band. `/sign-in` and `/join` each ended
    //   in a loose line and a button sitting on the page ground; those two nodes
    //   ARE this band, and giving them a ground is what took `/sign-in` from two
    //   distinct grounds to four.
    //
    // ⚠️ **The count is not the check and never was** — the named assertions
    // below are. This number going up by two is satisfied by any two files at
    // all, which is exactly why the paragraph above it says which two and why.
    expect(committed.length).toBe(32 * 3 + 4); // TPL-002: +4 cloud functions, +2 pages
    expect(committed).toContain('nodegx.project.json');
    expect(committed).toContain('nodegx.security.json');
    expect(committed).toContain(path.join('components', '_registry.json'));
    // 🔴 Named rather than only counted: a file count that goes up by one is
    // satisfied by any file at all, including a stray one a failed run left
    // behind, and the note is the deliverable.
    expect(committed).toContain(path.join('docs', 'START-HERE.md'));
    // And it has to have found the marked strings, or its central section is a
    // heading with an empty table under it. `writeStartHere` refuses on zero;
    // this is the reading on the other side of that refusal.
    expect(fs.readFileSync(path.join(ARTEFACT, START_HERE_FILE), 'utf-8')).toContain('EDIT \u2014 who to contact');
    // The policy in the artefact IS the hand-authored file, byte for byte —
    // stated separately because it is the one file the door does not write.
    expect(fs.readFileSync(path.join(ARTEFACT, 'nodegx.security.json'), 'utf-8')).toBe(
      fs.readFileSync(POLICY_SOURCE, 'utf-8')
    );
  });

  it('control: the generation really ran — thirty-two components, App first', async () => {
    // 🔴 Without this, the comparison above is satisfiable by two empty sets, and
    // a build that silently authored nothing would read as agreement.
    //
    // 🔴 **REL-010: 32, and it is the SECOND hard count this row moved.** The file
    // count in §1 is the other. Both are written out here rather than bumped,
    // because this row's board carries the hazard by name: *"a gate can be a hard
    // count in several places, and the argument above it is the part that
    // matters"* — a silent increment hides the finding it was supposed to make.
    //
    // The two are `Members/InsideBand` and `Members/Prompt`, and neither is a
    // new feature. Both are things that already existed on ONE page, made
    // placeable so the other three public pages could carry them:
    //
    // - the *"what members can see"* band was nine nodes inline on
    //   `Pages/Landing`, which is why the template's only photographed band
    //   could not go on the door pages that measured `0 images`;
    // - the closing prompt was a loose `Text` and a button on the page ground of
    //   `/sign-in` and `/join` — the two weakest endings in the template.
    //
    // ⚠️ **The name in this test's title is part of the assertion.** It read
    // *"twenty-three components"* while the number said 30, because a previous
    // change moved the digit and not the words. A title that disagrees with its
    // own expectation is where the next reader stops trusting the file.
    const built = await buildMembersTemplateProject();
    expect(built.order).toHaveLength(32); // TPL-002: 8 endpoints, 13 pages · REL-002c: Footer · REL-010: InsideBand, Prompt
    expect(built.order[0]).toBe(APP_COMPONENT);
    expect(shipped).toHaveLength(32);
    // 🔴 Named, not only counted — a count of 32 is satisfied by any two
    // components at all, including two the door invented from a bad merge.
    expect(built.order).toContain('Members/InsideBand');
    expect(built.order).toContain('Members/Prompt');
  });
});

// ── 2. The router, and the page a stranger meets ─────────────────────────────

describe('TPL-001 — the app has an entry point, and it is the landing page', () => {
  const app = () => byLegacyName.get(`/${APP_COMPONENT}`) as StoredComponent;
  const routerNode = () => {
    const node = app().nodes.find((n) => n.type === 'Router');
    if (!node) throw new Error(`/${APP_COMPONENT} holds no Router node`);
    return node;
  };
  const pages = () => (routerNode().parameters?.pages as { startPage?: string; routes?: string[] }) ?? {};

  it('ships an App component holding exactly one Router, named what every navigate asks for', () => {
    expect(app()).toBeDefined();
    expect(app().nodes.filter((n) => n.type === 'Router')).toHaveLength(1);
    // 🔴 UNCHECKED AT THE DOOR: `RouterNavigate`'s ports are derived from the
    // target router, so all eighteen of them raise `dynamic-port-skipped`. A
    // router named anything else is eighteen buttons that do nothing, on a green
    // authoring run and a green deploy.
    expect(routerNode().parameters?.name).toBe(ROUTER);
  });

  it('🔴 opens on the landing page — a stranger meets the association, not a password box', () => {
    expect(pages().startPage).toBe('/Pages/Landing');
  });

  it('lists every page component in the routes, and only pages', () => {
    const pageComponents = shipped.map((c) => c.path).filter((n) => n.startsWith('/Pages/'));
    expect(pageComponents.length).toBe(13); // TPL-002: Account, Unsubscribe
    expect([...(pages().routes ?? [])].sort()).toEqual([...pageComponents].sort());
    // Control: the routes list is not simply everything — the four cloud
    // components a browser cannot show are not in it.
    expect((pages().routes ?? []).some((r) => r.startsWith('/#__cloud__/'))).toBe(false);
  });

  it('🔴 every page a RouterNavigate targets is REGISTERED, not merely present', () => {
    // 🔴 THE GAP `pageRegistration.ts` NAMES IN ITS OWN HEADER: `checkNavigation`
    // resolves a target against component names, and it is sound in the editor
    // only because the editor's apply registers the page immediately afterwards.
    // A page component that exists and is not in `routes` passes every gate in
    // the repository and does nothing when clicked.
    const routes = new Set(pages().routes ?? []);
    const unrouted = allNodes()
      .filter(({ node }) => node.type === 'RouterNavigate')
      .filter(({ node }) => !routes.has(String(node.parameters?.target)))
      .map(({ component, node }) => `${component.path} › ${node.id} → ${String(node.parameters?.target)}`);
    expect(unrouted).toEqual([]);
  });

  it('control: there are navigates and repeaters to grade, so the empty results above mean something', () => {
    expect(allNodes().filter(({ node }) => node.type === 'RouterNavigate').length).toBeGreaterThan(0);
    expect(allNodes().filter(({ node }) => node.type === 'For Each').length).toBe(4);
    expect(allNodes().filter(({ node }) => node.type.startsWith('/')).length).toBeGreaterThan(0);
  });

  it('every page carries a Page node, so it renders at all, and every path is unambiguous', () => {
    const paths: string[] = [];
    for (const name of pages().routes ?? []) {
      const component = byLegacyName.get(name) as StoredComponent;
      const pageNode = component.nodes.find((n) => n.type === 'Page');
      expect(pageNode).toBeDefined();
      paths.push(String(pageNode?.parameters?.urlPath ?? ''));
    }
    // 🔴 The Router matches by splitting on `/` and keeps the page with the
    // smallest |patternParts − pathParts|, **first one winning a tie**
    // (`router.tsx:775-783`, the guard is `>` not `>=`). This template has no
    // one-segment `{param}` catch-all, so no page can tie with another on a real
    // URL — asserted rather than assumed, because a later page that added one
    // would silently steal every one-segment route.
    const oneSegmentWildcards = paths.filter((p) => p.split('/').filter(Boolean).length === 1 && p.includes('{'));
    expect(oneSegmentWildcards).toEqual([]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

// ── 2b. The band, and the way out of every page ───────────────────────

/**
 * 🔴 **B2 — every signed-in page used to end in a button back to the
 * noticeboard, and that was the whole of this app's navigation.**
 *
 * Six of them, one per page, each the page's only exit and every one leading to
 * the same screen — so reaching the diary from the queue was a round trip
 * through the noticeboard. They are gone, and the band carries five destinations
 * instead.
 *
 * ⚠️ **None of what follows is checked at the door.** The nav buttons are
 * `net.noodl.controls.button` instances whose `onClick` is an ordinary wire, and
 * the three gates are connections to a component-instance port — the class §3
 * of this file exists because the door is *silent* about it. A nav item wired to
 * nothing, or a moderator's door left ungated, is green everywhere else.
 *
 * 🔴 **The expectations below are LITERALS, and the first draft of them was
 * not.** They compared the artefact against `BAND_NAV` — the table the artefact
 * is generated FROM — which reads like "a declaration against a measurement"
 * and is neither: proved by deleting `moderatorOnly` from the `Post` row, which
 * moved both sides of the comparison together and left this whole describe
 * block **green**. Only the `mounted` census in §6 noticed. A second statement
 * of a fact has to be written independently of the first or it is not a second
 * statement.
 */
describe('TPL-001 — the band is the navigation, and it goes somewhere', () => {
  const chrome = () => byLegacyName.get(CHROME_COMPONENT) as StoredComponent;

  /** The band's nav buttons, found by WHERE THEY SIT rather than by an authored id. */
  const navButtons = (): StoredNode[] => {
    const band = chrome();
    const byId = new Map(band.nodes.map((n) => [n.id, n]));
    const strip = band.nodes.find((n) => n.type === 'net.noodl.visual.columns');
    if (!strip) throw new Error('the band ships no Columns — nothing reflows');
    return (strip.children ?? []).map((id) => byId.get(id)).filter((n): n is StoredNode => n !== undefined);
  };

  it('🔴 ships every destination declared for it, each reaching a REGISTERED page', () => {
    const band = chrome();
    const byId = new Map(band.nodes.map((n) => [n.id, n]));
    const routes = new Set(
      ((byLegacyName.get(`/${APP_COMPONENT}`) as StoredComponent).nodes.find((n) => n.type === 'Router')
        ?.parameters?.pages as { routes?: string[] })?.routes ?? []
    );

    const reached = navButtons().map((button) => {
      const wire = band.connections.find((w) => w.fromId === button.id && w.fromProperty === 'onClick');
      const navigator = wire ? byId.get(wire.toId) : undefined;
      return {
        label: String(button.parameters?.label),
        // A button wired to nothing, and a button wired to a navigator whose
        // target is not routed, are the same screen: a click that does nothing.
        target: navigator?.type === 'RouterNavigate' ? String(navigator.parameters?.target) : '(nothing)',
        routed: navigator?.type === 'RouterNavigate' && routes.has(String(navigator.parameters?.target))
      };
    });

    expect(reached.filter((r) => !r.routed)).toEqual([]);
    // Written out rather than mapped from `BAND_NAV` — see the block comment.
    expect(reached.map((r) => `${r.label} → ${r.target}`)).toEqual([
      'Announcements → /Pages/Members',
      'Meetings → /Pages/Meetings',
      'Post → /Pages/Post',
      'Requests → /Pages/Requests',
      'Who belongs → /Pages/Directory',
      // TPL-002. Not moderator-only: the setting it leads to is every member's.
      'Your account → /Pages/Account'
    ]);
  });

  it('🔴 the moderator’s three doors are gated, and the member’s two are not', () => {
    const band = chrome();
    const standing = band.nodes.filter((n) => n.type === STANDING_COMPONENT);
    // The band asks for itself — two of the seven pages carrying it have no
    // standing component of their own to borrow an answer from.
    expect(standing).toHaveLength(1);
    expect(
      band.connections.some((w) => w.toId === standing[0].id && w.toProperty === 'Check')
    ).toBe(true);

    const gatedBy = new Map(
      band.connections
        .filter((w) => w.fromId === standing[0].id && w.toProperty === 'mounted')
        .map((w) => [w.toId, w.fromProperty])
    );
    const census = navButtons().map((button) => ({
      label: String(button.parameters?.label),
      gate: gatedBy.get(button.id) ?? '(none)',
      mounted: button.parameters?.mounted
    }));

    // 🔴 The `mounted` PARAMETER matters as much as the wire. Without it
    // the door is open on the first frame and closes only once the standing
    // call answers — the flash AC2 is about, in the one place on the page a
    // member could click straight through it.
    expect(census).toEqual([
      { label: 'Announcements', gate: '(none)', mounted: undefined },
      { label: 'Meetings', gate: '(none)', mounted: undefined },
      { label: 'Post', gate: 'isModerator', mounted: false },
      { label: 'Requests', gate: 'isModerator', mounted: false },
      { label: 'Who belongs', gate: 'isModerator', mounted: false },
      // TPL-002. Ungated like Announcements and Meetings, and for the same
      // reason: it leads to a page whose own panel is gated on `isMember`.
      { label: 'Your account', gate: '(none)', mounted: undefined }
    ]);
    // Control: the census is not all one answer, so it graded something.
    expect(new Set(census.map((c) => c.gate)).size).toBe(2);
  });

  it('🔴 every page the band offers CARRIES the band, so no door leads to a dead end', () => {
    // The failure this forbids is the one the six back buttons existed for: a
    // page you can reach and cannot leave. It is now structural rather than a
    // button per page — but only while every destination places the chrome.
    const destinations = ['/Pages/Members', '/Pages/Meetings', '/Pages/Post', '/Pages/Requests', '/Pages/Directory'];
    const without = destinations.filter((target) => {
      const page = byLegacyName.get(target) as StoredComponent | undefined;
      return !page || !page.nodes.some((n) => n.type === CHROME_COMPONENT);
    });
    expect(without).toEqual([]);
  });

  it('🔴 no child of a `Columns` is content-sized, anywhere in the artefact', () => {
    // 🔴 **`calcAutoFit` divides the container into equal boxes and hands
    // each child one; a `sizeMode: 'contentSize'` child ignores the box and
    // keeps its own width.** Both button compositions pin exactly that, so
    // following the design system verbatim inside the one node in the runtime
    // that reflows produces overlapping controls — measured at 1280px, where
    // "Announcements" was drawn across the left edge of "Meetings".
    //
    // ⚠️ It is a whole-artefact sweep rather than a check on the band, because
    // the band is not where it was introduced: `Pages/Members`' three moderator
    // actions have been in a `Columns` since s8, clearing their box by two
    // pixels at 390px. The symptom appeared in one place and the defect was in
    // two.
    const offenders: string[] = [];
    let graded = 0;
    for (const component of shipped) {
      const byId = new Map(component.nodes.map((n) => [n.id, n]));
      for (const strip of component.nodes.filter((n) => n.type === 'net.noodl.visual.columns')) {
        for (const childId of strip.children ?? []) {
          const child = byId.get(childId);
          if (!child) continue;
          graded += 1;
          const mode = child.parameters?.sizeMode;
          if (mode === 'contentSize' || mode === undefined || child.parameters?.width === undefined) {
            offenders.push(`${component.path} › ${strip.id} › ${childId} (sizeMode ${String(mode)})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    // Beside a known-firing count, so `[]` is a reading of a populated sweep and
    // not a walk over no `Columns` at all.
    // REL-002c: +3, the landing page's three "what members can see" tiles, which
    // became a `gridAutoFit` when the page went to a 1200px shell.
    // REL-002c s8: +3, `Members/MemberRow`'s three cells. The directory row is a
    // `Columns` now — three across above 700px and one stack below it — because
    // a Group row cannot reflow and a content-sized child at the far edge of one
    // broke every address mid-word at 390px. Both alternatives are recorded on
    // the node itself.
    // REL-002c item 2: −3, `Pages/Members`' `moderatorButtons`. That `Columns`
    // is gone with two of the three buttons in it, and the one that stayed
    // (`Post something`) is a direct child of the section — a `Columns` with a
    // single child hands it the whole container, which is a 1200px filled
    // button. ⚠️ The sweep still grades 12, so the `[]` above is a reading of a
    // populated population and the two remaining `Columns` still cover it.
    expect(graded).toBe(12); // TPL-002: the sixth band button
  });

  it('control: no page ships a button whose only job was to go back', () => {
    // The six that were removed, asserted as an absence beside the known-firing
    // signal above — the band's own five buttons were counted, so a walk that
    // found nothing here walked a populated artefact.
    const backish = allNodes()
      .filter(({ node }) => node.type === 'net.noodl.controls.button')
      .filter(({ node }) => String(node.parameters?.label ?? '').startsWith('Back to'))
      .map(({ component, node }) => `${component.path} › ${String(node.parameters?.label)}`);
    expect(backish).toEqual([]);
    expect(navButtons()).toHaveLength(6);
  });
});

// ── 3. The check the door does not do ────────────────────────────────────────

/**
 * 🔴 **Every connection that names a component instance resolves to a port that
 * component actually declares.**
 *
 * The door skips this entirely — measured, see the module header. And it is the
 * template's whole boundary: `Members/Standing`'s eight outputs are what reveal
 * content, reveal the moderator's tools, and trigger every query.
 */
/**
 * 🔴 **The door checks all of this now, and this block re-measured that rather
 * than inheriting it.** These specs were written as D1's interim cover, when the
 * door accepted a wire to a port that did not exist and said nothing. Richard
 * closed the last of it in `d419f295` (2026-08-29); re-sabotaged here on
 * 2026-08-29 (s11), all three of D1's classes are now blocking errors with
 * suggestions — an instance output, a `CloudFunction2` `in-*`, a
 * `RouterNavigate` `pm-*`.
 *
 * ⚠️ **It stays, and not out of sentiment.** The door grades what it is asked to
 * write; this grades what is *on disk*, so it still covers a component edited by
 * any other route — and a check whose subject moved is retired on a higher bar
 * than the one that added it.
 */
describe('TPL-001 — component-instance ports resolve, on disk', () => {
  /** The ports a component publishes to an instance of it, by plug direction. */
  function declaredPorts(legacyName: string): { inputs: Set<string>; outputs: Set<string> } {
    const component = byLegacyName.get(legacyName);
    if (!component) throw new Error(`no component named ${legacyName}`);
    const inputs = new Set<string>();
    const outputs = new Set<string>();
    for (const node of component.nodes) {
      const ports = (node.parameters?.ports ?? (node as { ports?: unknown }).ports) as
        | Array<{ name: string; plug: string }>
        | undefined;
      if (!ports) continue;
      // A `Component Inputs` node declares OUTPUT-plugged ports inside the
      // component, and those are the INPUTS an instance exposes. `Component
      // Outputs` is the mirror. The inversion is the thing a hand-check gets
      // wrong, so it is written once here.
      if (node.type === 'Component Inputs') for (const p of ports) inputs.add(p.name);
      if (node.type === 'Component Outputs') for (const p of ports) outputs.add(p.name);
    }
    return { inputs, outputs };
  }

  it('control: the instance components declare ports at all, so the sets below are not empty', () => {
    const standing = declaredPorts(STANDING_COMPONENT);
    expect([...standing.inputs]).toEqual(['Check']);
    expect([...standing.outputs].sort()).toEqual(
      // REL-002b added `Denied` (the refusal all six protected pages navigate
      // on) and `isSignedIn` (which the band consumes and no page reads).
      [
        'Member',
        'Moderator',
        'Visitor',
        'Denied',
        'isMember',
        'isModerator',
        'isPending',
        'isUnknown',
        'isSignedIn',
        'standing'
      ].sort()
    );
  });

  it('🔴 no wire names a port its target component does not declare', () => {
    const broken: string[] = [];
    for (const component of shipped) {
      const instances = new Map(component.nodes.filter((n) => n.type.startsWith('/')).map((n) => [n.id, n.type]));
      if (instances.size === 0) continue;
      for (const wire of component.connections) {
        const asTarget = instances.get(wire.toId);
        if (asTarget && !declaredPorts(asTarget).inputs.has(wire.toProperty)) {
          broken.push(`${component.path} › ${wire.toId} (${asTarget}) has no input "${wire.toProperty}"`);
        }
        const asSource = instances.get(wire.fromId);
        if (asSource && !declaredPorts(asSource).outputs.has(wire.fromProperty)) {
          broken.push(`${component.path} › ${wire.fromId} (${asSource}) has no output "${wire.fromProperty}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('control: the matcher discriminates — an invented port would be caught', () => {
    // 🔴 Without this arm, the assertion above passes on a matcher that finds no
    // instances at all, which is the same reading and the opposite fix.
    const standing = declaredPorts(STANDING_COMPONENT);
    expect(standing.outputs.has('isMemberXX')).toBe(false);
    const instanceWires = shipped.flatMap((c) => {
      const ids = new Set(c.nodes.filter((n) => n.type.startsWith('/')).map((n) => n.id));
      return c.connections.filter((w) => ids.has(w.fromId) || ids.has(w.toId));
    });
    expect(instanceWires.length).toBeGreaterThan(10);
  });

  it('every repeater template is a component the artefact contains', () => {
    const names = new Set(shipped.map((c) => c.path));
    const missing = allNodes()
      .filter(({ node }) => node.type === 'For Each')
      .filter(({ node }) => !names.has(String(node.parameters?.template)))
      .map(({ component, node }) => `${component.path} › ${node.id} → ${String(node.parameters?.template)}`);
    expect(missing).toEqual([]);
    expect(names.has(ANNOUNCEMENT_ROW)).toBe(true);
    expect(names.has(MEETING_ROW)).toBe(true);
    expect(names.has(REQUEST_ROW)).toBe(true);
  });

  it('every component an instance node names is in the project', () => {
    const names = new Set(shipped.map((c) => c.path));
    const missing = allNodes()
      .filter(({ node }) => node.type.startsWith('/') && !names.has(node.type))
      .map(({ component, node }) => `${component.path} › ${node.id} (${node.type})`);
    expect(missing).toEqual([]);
  });
});

// ── 4. The boundary: the policy, and the graphs that assume it ───────────────

describe('TPL-001 — the policy is the product', () => {
  it('🔴 is a policy the backend itself accepts, checked by the backend’s own validator', () => {
    // 🔴 Not "it looks like the site builder's". `validateSecurityConfig` is the
    // function the running service uses, and an invalid policy is a backend that
    // refuses to start — on the association's machine, after they installed the
    // template. Imported rather than restated: a second validator would agree
    // with this one until the first rule shape either side gained.
    expect(validateSecurityConfig(policy)).toEqual([]);
  });

  it('control: the validator would reject a policy this file could plausibly become', () => {
    // Without this, "no errors" is consistent with a validator that returns []
    // for everything, which is the same green and the opposite fix.
    expect(validateSecurityConfig({ ...policy, collections: { X: { permissions: { find: 'members' } } } })).not.toEqual(
      []
    );
  });

  it('🔴 says `authenticated` NOWHERE — the pending member is authenticated', () => {
    // 🔴 The finding this template is built on. `authenticated` is true for the
    // person who asked to join ten seconds ago and whom nobody has approved, and
    // it is ALSO what a collection read falls back to when a deployed backend
    // has `devOpen: false` and nothing else. The failure mode is the default, so
    // the spelling must not also be one anybody typed on purpose.
    const offenders = everyRule()
      .filter((row) => atomsOf(row.rule).includes('authenticated'))
      .map((row) => row.where);
    expect(offenders).toEqual([]);
  });

  it('control: the sweep reads real rules — it would catch one if it were there', () => {
    // Without this, "no rule says authenticated" passes on a sweep that reads
    // nothing at all, which is the same green.
    const rules = everyRule();
    expect(rules.length).toBeGreaterThan(25);
    expect(rules.filter((r) => atomsOf(r.rule).includes('role:admin')).length).toBeGreaterThan(5);
    expect(atomsOf(['authenticated', 'public']).includes('authenticated')).toBe(true);
  });

  it('fails SHUT: an unnamed collection is refused, not opened', () => {
    // The shipped default is `authenticated`; this template overrides all five
    // operations to `nobody`, so a class somebody adds later is unreadable until
    // a rule names it — loudly, rather than readable by every pending member.
    expect(policy.defaults.permissions).toEqual({
      find: 'nobody',
      get: 'nobody',
      create: 'nobody',
      update: 'nobody',
      delete: 'nobody'
    });
    expect(policy.devOpen).toBe(false);
    // 🔴 `devOpen: true` disables row-level ACL entirely, so every draft renders
    // to every visitor — a members-only app tested with it on looks like it
    // works and is wide open.
  });

  it('names a rule for every collection the graphs write or read', () => {
    // A census over the artefact rather than a list somebody maintained: every
    // `collectionName` any node carries must have a rule.
    const named = new Set<string>();
    for (const { node } of allNodes()) {
      const name = node.parameters?.collectionName;
      if (typeof name === 'string') named.add(name);
    }
    expect([...named].sort()).toEqual([...TPL001_COLLECTIONS].sort());
    for (const collection of named) expect(policy.collections[collection]).toBeDefined();
  });

  it('names a rule for every endpoint the artefact deploys', () => {
    // 🔴 SB-016: an endpoint the policy does not name resolves ONLY from its
    // Request node's `Allow Unauthenticated` port — `public` if ticked,
    // `authenticated` if not, and there is no defaults tier to lower it from.
    // Both of those are wrong for `decideMembership`.
    const deployed = shipped
      .filter((c) => c.path.startsWith('/#__cloud__/'))
      .map((c) => c.path.slice('/#__cloud__/'.length));
    expect(deployed.sort()).toEqual([...TPL001_FUNCTIONS, ...TPL002_FUNCTIONS].sort());
    for (const fn of deployed) expect(policy.functions[fn]?.call).toBeDefined();
  });

  it('🔴 the door that mints members is `role:admin`, and nothing weaker', () => {
    expect(policy.functions.decideMembership.call).toBe(`role:${ROLE_MODERATOR}`);
    // The Request node's port cannot express a role: unticked resolves to
    // `authenticated`, which for this template is any account that asked to
    // join — i.e. exactly the person the queue exists to keep out.
    const decide = byLegacyName.get('/#__cloud__/decideMembership') as StoredComponent;
    const request = decide.nodes.find((n) => n.type === 'noodl.cloud.request');
    expect(request?.parameters?.allowNoAuth).toBe(false);
  });

  it('members read the members-only classes; only moderators write them', () => {
    for (const collection of [COLLECTION_ANNOUNCEMENT, COLLECTION_MEETING]) {
      const perms = policy.collections[collection].permissions;
      // 🔴 Two atoms, not one: the roles are flat and a moderator is not
      // implicitly a member, so a `role:member`-only read rule is a moderator
      // who cannot read back what they just posted.
      expect(atomsOf(perms.find).sort()).toEqual([`role:${ROLE_MODERATOR}`, `role:${ROLE_MEMBER}`].sort());
      expect(atomsOf(perms.get).sort()).toEqual([`role:${ROLE_MODERATOR}`, `role:${ROLE_MEMBER}`].sort());
      for (const op of ['create', 'update', 'delete']) expect(perms[op]).toBe(`role:${ROLE_MODERATOR}`);
    }
  });

  it('the association row is the one thing a stranger may read', () => {
    const publicReads = Object.entries(policy.collections)
      .filter(([, entry]) => atomsOf(entry.permissions.find).includes('public'))
      .map(([name]) => name);
    expect(publicReads).toEqual([COLLECTION_ASSOCIATION]);
  });

  it('🔴 the browser may not write the join queue at all — only the cloud function may', () => {
    const perms = policy.collections[COLLECTION_REQUEST].permissions;
    expect(perms.create).toBe('nobody');
    expect(perms.update).toBe('nobody');
    expect(perms.delete).toBe('nobody');
    expect(perms.find).toBe(`role:${ROLE_MODERATOR}`);
    // ⚠️ `delete: nobody` and `decideMembership` deletes the row: a cloud
    // function runs as system and the master key bypasses CLPs and ACLs, so
    // `nobody` here means "no browser", which is exactly the claim.
    const decide = byLegacyName.get('/#__cloud__/decideMembership') as StoredComponent;
    expect(decide.nodes.some((n) => n.type === 'DeleteDbModelProperties')).toBe(true);
  });

  it('🔴 self-registration is closed: the association’s own front door is the only way in', () => {
    expect(policy.signup).toBe('nobody');
    // …which is only true if nothing in the browser half calls Sign Up. A
    // `net.noodl.user.SignUp` node here would be refused at run time and green
    // at every gate in this repository.
    const signups = allNodes().filter(({ node }) => node.type === 'net.noodl.user.SignUp');
    expect(signups.map(({ component, node }) => `${component.path} › ${node.id}`)).toEqual([]);
    // The two doors that DO create accounts are cloud-side and both are named in
    // the policy.
    const creators = allNodes().filter(({ node }) => node.type === 'noodl.cloud.createuser');
    expect(creators.map(({ component }) => component.path).sort()).toEqual([
      '/#__cloud__/claimAssociation',
      '/#__cloud__/requestAccess'
    ]);
  });
});

// ── 5. AC2 made structural: no query can run before the server says who you are ─

describe('TPL-001 — the members-only queries have no trigger but the standing check', () => {
  /** Which nodes in a component publish into `<queryId>.storageFetch` or a `qp-` port. */
  function triggersOf(component: StoredComponent, queryId: string): string[] {
    return component.connections
      .filter((w) => w.toId === queryId && (w.toProperty === 'storageFetch' || w.toProperty.startsWith('qp-')))
      .map((w) => `${w.fromId}.${w.fromProperty}`);
  }

  it('🔴 every members-only query carries NO_LOAD_TIME_FETCH', () => {
    // With either box left on, the node fetches the moment the graph is built —
    // before any standing is known, for anybody who opens the page. That is the
    // flash of content AC2 forbids, and it is a parameter rather than a wire.
    // 🔴 **The browser half only, and TPL-002 is what made the scope explicit.**
    // This rule is about a query that runs before any standing is known, for
    // anybody who opens a page. A cloud function has no page and no standing
    // gate: its boundary is `nodegx.security.json`'s `call` rule, which is the
    // stronger one and is graded by "names a rule for every endpoint the
    // artefact deploys". Leaving the four new endpoints in this population made
    // it demand a gate that cannot exist there.
    const membersOnly = allNodes().filter(
      ({ component, node }) =>
        !component.path.includes('__cloud__') &&
        node.type === 'DbCollection2' &&
        [COLLECTION_ANNOUNCEMENT, COLLECTION_MEETING, COLLECTION_REQUEST, COLLECTION_MEMBER].includes(
          String(node.parameters?.collectionName)
        )
    );
    expect(membersOnly.length).toBe(4);
    for (const { component, node } of membersOnly) {
      expect(`${component.path}:${node.id}:${node.parameters?.['runOnChange-collectionName']}`).toBe(
        `${component.path}:${node.id}:false`
      );
      expect(node.parameters?.['runOnChange-querySettings']).toBe(false);
    }
  });

  it('control: the association query KEEPS its load-time fetch — the arms differ', () => {
    // 🔴 The arm that makes the assertion above a measurement rather than a
    // habit. On an unfiltered query with both boxes off and no `Do` wire there
    // is no trigger left at all, and the landing page would be blank for ever.
    // This is the one query a stranger is allowed to run, and it must run on load.
    const association = allNodes().find(
      ({ node }) => node.type === 'DbCollection2' && node.parameters?.collectionName === COLLECTION_ASSOCIATION
    );
    expect(association).toBeDefined();
    expect(association?.node.parameters?.['runOnChange-collectionName']).toBeUndefined();
  });

  /**
   * 🔴 **The band's output ports that are driven by the band's OWN standing
   * gate, proven inside `Members/Chrome` rather than trusted.**
   *
   * Since D29 the five pages that used to own a `Members/Standing` read the
   * band's answer instead, so `chrome.Member` is now a legitimate trigger for a
   * members-only query. Accepting *any* port on a chrome instance would make
   * the gate below satisfiable by a band that forwarded something else — the
   * hole shaped exactly like the defect. So the provenance is established here,
   * once, from the band's own graph: a port qualifies only if a wire inside
   * `Members/Chrome` carries it from that component's `Members/Standing`
   * instance to its `Component Outputs`.
   */
  const bandPortsFromStanding = (): Set<string> => {
    const band = byLegacyName.get(CHROME_COMPONENT) as StoredComponent;
    const standingIds = new Set(band.nodes.filter((n) => n.type === STANDING_COMPONENT).map((n) => n.id));
    const outputIds = new Set(band.nodes.filter((n) => n.type === 'Component Outputs').map((n) => n.id));
    return new Set(
      band.connections
        .filter((w) => standingIds.has(w.fromId) && outputIds.has(w.toId))
        .map((w) => String(w.toProperty))
    );
  };

  it('🔴 and each one’s only trigger comes from the standing gate or a write it caused', () => {
    const rows: Array<{ where: string; triggers: string[] }> = [];
    const bandPorts = bandPortsFromStanding();
    // The instrument must be able to fail: an empty set would make every
    // `fromBand` below false, and this spec would then be grading nothing.
    expect(bandPorts.size).toBeGreaterThan(0);
    for (const component of shipped) {
      // Same population as the NO_LOAD_TIME_FETCH rule above, and for the same
      // reason: "its trigger comes from the standing gate" is a sentence about a
      // page. See that spec's note.
      if (component.path.includes('__cloud__')) continue;
      const instanceIds = new Set(
        component.nodes.filter((n) => n.type === STANDING_COMPONENT).map((n) => n.id)
      );
      const bandIds = new Set(component.nodes.filter((n) => n.type === CHROME_COMPONENT).map((n) => n.id));
      for (const node of component.nodes) {
        if (node.type !== 'DbCollection2') continue;
        const collection = String(node.parameters?.collectionName);
        const membersOnly = [COLLECTION_ANNOUNCEMENT, COLLECTION_MEETING, COLLECTION_REQUEST, COLLECTION_MEMBER];
        if (!membersOnly.includes(collection)) continue;
        rows.push({ where: `${component.path} › ${node.id}`, triggers: triggersOf(component, node.id) });
        for (const wire of component.connections.filter((w) => w.toId === node.id && w.toProperty === 'storageFetch')) {
          const fromStanding = instanceIds.has(wire.fromId);
          // D29: the band relaying the answer it already has. Same gate, one
          // call — and `bandPorts` is what makes "the band" mean the standing
          // check rather than any wire that happens to leave the chrome.
          const fromBand = bandIds.has(wire.fromId) && bandPorts.has(wire.fromProperty);
          // The only other legitimate trigger is a refetch after a write this
          // page caused, which cannot fire before a moderator used a screen they
          // were already cleared for.
          const fromRefresh = wire.fromProperty.startsWith('itemOutputSignal-');
          expect(
            `${component.path}:${wire.fromId}.${wire.fromProperty}:${fromStanding || fromBand || fromRefresh}`
          ).toBe(`${component.path}:${wire.fromId}.${wire.fromProperty}:true`);
        }
      }
    }
    // Every one of the three has at least one trigger — a query with none is a
    // list that is empty for ever, which is the failure in the other direction.
    expect(rows.filter((r) => r.triggers.length === 0)).toEqual([]);
    expect(rows).toHaveLength(4);
  });

  it('the meetings query is filtered, and its filter value is what runs it', () => {
    const meetings = allNodes().find(
      ({ node }) => node.type === 'DbCollection2' && node.parameters?.collectionName === COLLECTION_MEETING
    );
    const filter = meetings?.node.parameters?.visualFilter as { rules?: Array<{ input?: string }> };
    expect(filter?.rules?.[0]?.input).toBe('today');
    const page = shipped.find((c) => c.path === '/Pages/Meetings') as StoredComponent;
    const qp = page.connections.filter((w) => w.toId === meetings?.node.id && w.toProperty === 'qp-today');
    expect(qp).toHaveLength(1);
    // And the node publishing it is fired by the standing gate — so the filter
    // value, the fetch and the membership check are one chain.
    const producer = qp[0].fromId;
    const fired = page.connections.filter((w) => w.toId === producer && w.toProperty === 'run');
    expect(fired).toHaveLength(1);
    expect(fired[0].fromProperty).toBe('Member');
  });
});

// ── 5b. Where a refusal sends the reader ─────────────────────────────────────

/**
 * 🔴 **Richard's judgement 4, 2026-09-04 — pinned here because the byte gate
 * cannot pin it.**
 *
 * §1 asserts the committed artefact is byte-for-byte what the generator writes.
 * That is a drift gate, and it is green for ANY destination: edit the generator
 * back to `/Pages/Landing`, regenerate, and §1 still passes. So the ruling
 * needs a spec of its own or it is held by nothing but a comment.
 *
 * He was shown that `/` and `/members` were byte-identical for an
 * unauthenticated reader and answered *"send them to `/sign-in` instead"* — a
 * person who followed a deep link was handed the landing page with no
 * acknowledgement they had been moved.
 *
 * ⚠️ **REL-002b is untouched and this spec must not be read as replacing it.**
 * The refusal, its two producers and the six pages that navigate on it are all
 * exactly what that task built; `rel002b-fail-closed.test.ts` still grades the
 * behaviour in a real browser. **Only the destination is graded here.**
 *
 * ⚠️ **The pages are DERIVED, never listed.** A hardcoded six would pass on a
 * seventh protected page that ejected to the wrong place — which is precisely
 * the person REL-002b's §1 was written about, the one who adds a page and
 * inherits the gate.
 */
describe('TPL-001 — a refused reader is sent to the door, not to the front page', () => {
  const DOOR = '/Pages/SignIn';
  const FRONT = '/Pages/Landing';

  /** Every `RouterNavigate` a band's `Denied` fires, with the page it sits on. */
  const refusals = (): Array<{ page: string; id: string; target: string }> => {
    const found: Array<{ page: string; id: string; target: string }> = [];
    for (const component of shipped) {
      const bandIds = new Set(component.nodes.filter((n) => n.type === CHROME_COMPONENT).map((n) => n.id));
      if (bandIds.size === 0) continue;
      for (const wire of component.connections) {
        if (!bandIds.has(wire.fromId) || wire.fromProperty !== 'Denied') continue;
        const node = component.nodes.find((n) => n.id === wire.toId);
        if (!node || node.type !== 'RouterNavigate') continue;
        found.push({ page: component.path, id: node.id, target: String(node.parameters?.target) });
      }
    }
    return found;
  };

  it('🔴 CONTROL — the refusal is wired on six pages, so the assertion below grades something', () => {
    // An empty set would make every `toBe(DOOR)` below vacuously true. This is
    // also the row that reddens if somebody adds a seventh protected page and
    // forgets its ejection, or deletes one.
    const pages = refusals().map((r) => r.page).sort();
    expect(pages).toEqual(
      [
        '/Pages/Account',
        '/Pages/Directory',
        '/Pages/Meetings',
        '/Pages/Members',
        '/Pages/Post',
        '/Pages/Requests'
      ].sort()
    );
  });

  it('🔴 and every one of them goes to the sign-in page', () => {
    for (const r of refusals()) {
      expect(`${r.page} → ${r.target}`).toBe(`${r.page} → ${DOOR}`);
    }
  });

  /**
   * 🔴 **The known-firing control, and it is the half that says the change was
   * surgical.** `Members/Chrome` has a `RouterNavigate` of its own — where you
   * land after pressing `Sign out` — and it is STILL the front page, because
   * signing out is not a refusal and a person who chose to leave has not been
   * moved anywhere they did not ask to go.
   *
   * Without this row, "every navigator goes to `/sign-in`" would also pass on a
   * sweep that retargeted the sign-out button, which would drop a signed-out
   * reader on a form asking them to sign back in.
   */
  it('🔴 CONTROL — but signing out still leads to the front page', () => {
    const band = byLegacyName.get(CHROME_COMPONENT) as StoredComponent;
    // ⚠️ **Found by the wire that FIRES it, not by counting navigators.** The
    // first draft asserted the band held exactly one `RouterNavigate` and read
    // seven: the band IS the navigation, so six of them are its nav buttons.
    // A count would have graded the menu; what this row is about is the one
    // destination `Sign out` leads to.
    const logout = band.nodes.filter((n) => n.type === 'net.noodl.user.LogOut').map((n) => n.id);
    expect(logout).toHaveLength(1);
    const fired = band.connections.filter((w) => logout.includes(w.fromId) && w.toProperty === 'navigate');
    expect(fired).toHaveLength(1);
    const after = band.nodes.find((n) => n.id === fired[0].toId);
    expect(after?.type).toBe('RouterNavigate');
    expect(String(after?.parameters?.target)).toBe(FRONT);
  });
});

// ── 6. The screens a person actually meets ───────────────────────────────────

describe('TPL-001 — the states a person can be in all have a screen', () => {
  it('every wired Text carries a standing text, so none renders the word “Text”', () => {
    // SB-018 (3): `Text` declares `default: 'Text'`, a default applies until the
    // port is set, and a node whose only `text` is a wire renders the literal
    // word **Text** until that wire publishes.
    const offenders: string[] = [];
    for (const component of shipped) {
      const wiredTexts = new Set(
        component.connections.filter((w) => w.toProperty === 'text').map((w) => w.toId)
      );
      for (const node of component.nodes) {
        if (node.type !== 'Text' || !wiredTexts.has(node.id)) continue;
        if (node.parameters?.text === undefined) offenders.push(`${component.path} › ${node.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('control: there are wired Texts to grade', () => {
    const wired = shipped.flatMap((c) => c.connections.filter((w) => w.toProperty === 'text'));
    expect(wired.length).toBeGreaterThan(10);
  });

  it('🔴 no signal is wired straight into a `mounted` port', () => {
    // A signal into a value port arrives once as `false` (one entry per input
    // name in the drain queue, so a true/false pair coalesces), so a reveal
    // wired that way never happens. Every one here goes through a `Condition`
    // or a JavaScript value output.
    const signalSources = new Set(['done', 'failure', 'unchanged', 'didMount', 'onClick', 'fetched', 'changed']);
    const offenders: string[] = [];
    for (const component of shipped) {
      for (const wire of component.connections) {
        if (wire.toProperty !== 'mounted') continue;
        if (signalSources.has(wire.fromProperty)) {
          offenders.push(`${component.path} › ${wire.fromId}.${wire.fromProperty} → ${wire.toId}.mounted`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * 🔴 **D7/D16 — every gate is `mounted`, and none is `visible`.**
   *
   * `visible` renders as `visibility: hidden`, which **keeps the box**. Two
   * consequences, both of which shipped: the Post page drew a heading, ~500px of
   * nothing and a back button, and every gated subtree sat in the document of
   * the very person it was gated against — a member's browser held the
   * moderator's announcement form, unpainted.
   *
   * ⚠️ This is the ratchet, not the fix. The fix is in `tpl001Components.ts`;
   * without a spec that FAILS on `visible` the next author reaches for the port
   * whose name means what they want, and nothing says otherwise. Stated as a
   * census of offenders rather than a count, so a failure names the wire.
   */
  it('🔴 D7/D16 — nothing is gated with `visible`, which keeps its box', () => {
    const offenders: string[] = [];
    for (const component of shipped) {
      for (const wire of component.connections) {
        if (wire.toProperty === 'visible') {
          offenders.push(`${component.path} › wire ${wire.fromId}.${wire.fromProperty} → ${wire.toId}.visible`);
        }
      }
      for (const node of component.nodes) {
        if (node.parameters && 'visible' in node.parameters) {
          offenders.push(`${component.path} › param ${node.id}.visible`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // …beside the signal known to fire, so an empty census is a measurement and
    // not a spec that walked an empty population.
    const gates = shipped.flatMap((c) => c.connections.filter((w) => w.toProperty === 'mounted'));
    // 28 rather than 27 since s7: `Pages/SignIn`'s refusal had NO gate at all.
    // As bare text an empty string renders nothing, so "always mounted" and
    // "hidden until it has something to say" were indistinguishable — the
    // missing gate only became visible when the notice was given a box, which
    // would otherwise have shipped as a permanently empty card under the form.
    //
    // 🔴 **s8 added `Pages/Landing`'s "what members can see" here and REL-002c
    // item 1 took it out again — the count went 28 → 29 → 28.** The argument
    // recorded at s8 was that ungated it would *"promise a diary and a directory
    // to the one person who cannot have them yet"*. It does not: the band sits
    // BELOW the hero rather than above it (it was a section in the old
    // single-column page when that sentence was written), and its three
    // sentences describe the TEMPLATE — they are literals, pinned by the page
    // census below, not content a query fills. What the gate did do was leave
    // 190px of bare ground between the photograph and the footer on the one
    // state a stranger is most likely to meet, which is what the renders show.
    //
    // 32 since s9: the band's three moderator doors. They are the first gates in
    // the template that hide a way THROUGH rather than a piece of content, and
    // they are still `mounted` for the same reason as the rest — `visible`
    // would leave three button-shaped holes in the header of every page a plain
    // member opens.
    //
    // 40 since s11: the removal block on the two detail pages, four wires each.
    // `chrome.isModerator → removal.mounted` is the moderator's whole entry to
    // it; `confirmGate` and `confirmClear` are the two directions of the
    // confirm step; `removeFailedGate` is the refusal. All four are `mounted`
    // rather than `visible` for the reason above, and the confirm step's pair
    // is the one place in the template where a single node's `mounted` is
    // driven from TWO conditions — the shape `Pages/Setup`'s `missingClear`
    // established.
    //
    // 49 since s15: `Pages/Account`'s three clearing conditions. A `Condition`
    // only ever pushes its `result` true, so nothing put a confirmation away
    // again and a person who ticked the box and then unticked it was shown BOTH
    // sentences at once — found by driving the page rather than by reading it.
    // Each of `savedOn`, `savedOff` and `failed` is now driven from a gate and a
    // clear, which makes the confirm step above no longer the only place with
    // that shape — it is the shape this template uses whenever one node answers
    // a question that has more than one answer.
    //
    // 52 since REL-002b: the band's own two (`topRow` and `nav`, gated on
    // `isSignedIn`) and the landing page's waiting card. The first two are the
    // template's only gates that close over the CHROME rather than over
    // content — with no backend bound the band offered `Sign out` and a members'
    // nav to a reader who had never signed in. The third is the inverse of every
    // other gate here: `waitingCard` is the one node mounted by DEFAULT and
    // taken down by an answer, because "the query has not answered" is the state
    // the page starts in and no signal announces it.
    // REL-002c: +1, `Pages/Landing`'s `hero`. It was mounted by default and
    // painted an eyebrow over two empty `Text` nodes on every unanswered load;
    // it is now closed until `hasAssociation` answers, like `actions` beside it.
    // REL-002c §E-i, s8: +1, `Pages/Landing`'s `about` band. It carries the
    // association's own paragraph, which `/setup` collects and the record
    // supplies — so on a fresh install it is a `--background` stripe holding one
    // empty `Text` between a photograph and a footer unless it is gated on the
    // same `hasAssociation` every other record-filled band here is.
    expect(gates.length).toBe(54); // TPL-002: Account ×7, Unsubscribe ×2 · REL-002b: band ×2, waiting card · REL-002c: hero, about, −`inside` · judgement 1: `menuButton`
  });

  it('AC6 — every list ships an empty state, hidden until a query has answered', () => {
    for (const [pageName, text] of [
      ['/Pages/Members', NO_ANNOUNCEMENTS_TEXT],
      ['/Pages/Meetings', NO_MEETINGS_TEXT],
      ['/Pages/Requests', NO_REQUESTS_TEXT]
    ] as const) {
      const page = byLegacyName.get(pageName) as StoredComponent;
      // 🔴 Found by WHAT IT IS, not by the id it was authored under. The door
      // de-duplicates node ids across the whole project — a second component
      // reusing `emptyState` gets `emptyState-2` — so an id from the component
      // sets is not a name the artefact answers to.
      const empty = noticeHost(page, text);
      expect(`${pageName}:${empty?.parameters?.mounted}`).toBe(`${pageName}:false`);
      // 🔴 …and it is revealed by a node that runs on `fetched`, never by
      // `isEmpty` — which is `true` before the first query has run, so binding it
      // straight through would tell a member with a full noticeboard that
      // nothing had been posted.
      const reveal = page.connections.find((w) => w.toId === empty?.id && w.toProperty === 'mounted');
      expect(reveal).toBeDefined();
      const gate = page.nodes.find((n) => n.id === reveal?.fromId) as StoredNode;
      expect(String(gate.parameters?.functionScript)).toContain('Outputs.empty');
      const run = page.connections.find((w) => w.toId === gate.id && w.toProperty === 'run');
      expect(run?.fromProperty).toBe('fetched');
    }
  });

  it('AC3 — the pending member has a sentence of their own on the pages they can reach', () => {
    for (const pageName of ['/Pages/Members', '/Pages/Meetings']) {
      const page = byLegacyName.get(pageName) as StoredComponent;
      const words = page.nodes.find((n) => n.type === 'Text' && n.parameters?.text === PENDING_TEXT);
      const notice = noticeHost(page, PENDING_TEXT);
      expect(`${pageName}:${notice !== undefined}`).toBe(`${pageName}:true`);
      expect(String(words?.parameters?.text)).toContain('moderators');
      expect(page.connections.some((w) => w.toId === notice?.id && w.fromProperty === 'isPending')).toBe(true);
    }
  });

  it('AC4 — the moderator’s screens gate their UI, and the write is refused server-side too', () => {
    for (const pageName of ['/Pages/Post', '/Pages/Requests']) {
      const page = byLegacyName.get(pageName) as StoredComponent;
      const gated = page.connections.filter((w) => w.fromProperty === 'isModerator' && w.toProperty === 'mounted');
      expect(gated.length).toBeGreaterThan(0);
    }
    // The half that counts: UI-only enforcement fails AC4, so the writes the
    // post form makes are refused for anyone but `role:admin`.
    expect(policy.collections[COLLECTION_ANNOUNCEMENT].permissions.create).toBe(`role:${ROLE_MODERATOR}`);
    expect(policy.collections[COLLECTION_MEETING].permissions.create).toBe(`role:${ROLE_MODERATOR}`);
  });

  it('every record a screen creates is born with an access rule on it', () => {
    // A record written with no ACL is readable by whatever the collection rule
    // allows and nothing narrower, so a later widening exposes every row ever
    // written. The rules go on at creation, which is the only moment they are cheap.
    const naked = allNodes()
      .filter(({ node }) => node.type === 'NewDbModelProperties')
      .filter(({ node }) => !Array.isArray(node.parameters?.accessControl))
      .map(({ component, node }) => `${component.path} › ${node.id}`);
    expect(naked).toEqual([]);
    // 6, not 4: `decideMembership` and `claimAssociation` each gained the
    // `Member` projection write when the directory was built.
    expect(allNodes().filter(({ node }) => node.type === 'NewDbModelProperties').length).toBe(6);
  });
});

// ── 7. The cloud half's own invariants ───────────────────────────────────────

// ── 7. Taking something down again ──────────────────────────────────────────

/**
 * 🔴 **The policy granted this from the day it was written and no graph offered
 * it.** `role:admin` has held `delete` on `Announcement` and `Meeting`
 * throughout; the app placed a `Delete Record` exactly once, server-side in
 * `decideMembership`, and never in the browser. So the moderator who posted the
 * harvest supper on the wrong Saturday could fix it only through the backend's
 * own admin surface.
 *
 * ⚠️ **Every expectation below is a literal read off the artefact**, per s9's
 * rule: `removalBlock()` is the table these pages are generated from, so a spec
 * comparing them to it would move both sides together and stay green. No id is
 * derived by arithmetic on a name — D6 remaps (`del` → `del-2`), and s10 paid
 * for assuming otherwise; every one is found by walking the tree or the wires.
 */
describe('TPL-001 — a moderator can take something down again', () => {
  const DETAIL: Array<{ page: string; collection: string; back: string }> = [
    { page: '/Pages/Announcement', collection: 'Announcement', back: '/Pages/Members' },
    { page: '/Pages/Meeting', collection: 'Meeting', back: '/Pages/Meetings' }
  ];

  /** The `Delete Record` on a page, and the page, both read off disk. */
  function removalOf(pageName: string): { page: StoredComponent; del: StoredNode } {
    const page = byLegacyName.get(pageName);
    if (!page) throw new Error(`no page ${pageName}`);
    const dels = page.nodes.filter((n) => n.type === 'DeleteDbModelProperties');
    expect(dels).toHaveLength(1);
    return { page, del: dels[0] };
  }

  it('control: exactly two browser pages delete, and they are the two detail pages', () => {
    // 🔴 The control that stops every spec below reading as a pass over nothing,
    // and it is an ABSOLUTE row rather than `> 0`: a third `Delete Record`
    // appearing in the browser half is a thing to look at, not to wave through.
    const deleters = allNodes()
      .filter(({ node }) => node.type === 'DeleteDbModelProperties')
      .map(({ component }) => component.path)
      .sort();
    expect(deleters).toEqual(['/#__cloud__/decideMembership', '/Pages/Announcement', '/Pages/Meeting']);
  });

  it.each(DETAIL)('$page removes from the collection it reads, and goes back to $back', ({ page, collection, back }) => {
    const { page: comp, del } = removalOf(page);
    expect(del.parameters?.collectionName).toBe(collection);
    // `explicit`, because the id comes from the URL and not from a repeater.
    expect(del.parameters?.idSource).toBe('explicit');

    // The page reads and deletes the SAME collection. A removal pointed at the
    // other one would refuse at run time and pass every static check here.
    const read = comp.nodes.filter((n) => n.type === 'DbModel2');
    expect(read).toHaveLength(1);
    expect(read[0].parameters?.collectionName).toBe(collection);

    const done = comp.connections.filter((w) => w.fromId === del.id && w.fromProperty === 'done');
    expect(done).toHaveLength(1);
    const nav = comp.nodes.find((n) => n.id === done[0].toId);
    expect(nav?.type).toBe('RouterNavigate');
    expect(nav?.parameters?.target).toBe(back);
  });

  it.each(DETAIL)('$page reveals the removal only to a moderator, and asks nobody twice', ({ page }) => {
    const { page: comp } = removalOf(page);

    // The block the remove button lives in is gated, and the gate's source is
    // the BAND — not a standing check of the page's own.
    const gates = comp.connections.filter((w) => w.toProperty === 'mounted' && w.fromProperty === 'isModerator');
    expect(gates).toHaveLength(1);
    const band = comp.nodes.find((n) => n.id === gates[0].fromId);
    expect(band?.type).toBe(CHROME_COMPONENT);

    // 🔴 And the page does NOT place a `Members/Standing` of its own. That is
    // the whole reason the band publishes the port: an instance here would be a
    // second `myStanding` per page load, which is the cost D29 removed from the
    // other five rather than the wire that replaced it.
    expect(comp.nodes.filter((n) => n.type === STANDING_COMPONENT)).toEqual([]);
  });

  /**
   * 🔴 **D29, stated once over the whole project rather than page by page.**
   *
   * The two specs above say the two detail pages place no standing gate. Since
   * s13 that is true of every page: the band asks, and everything else reads the
   * band. Asserted as a census because that is the form a regression shows up
   * in — a page reintroducing its own gate is an ADDITION, and a rule written as
   * "these five pages have none" would not see a sixth page appear with one.
   */
  it('🔴 the whole project places exactly one standing gate, and the band holds it', () => {
    const placements = shipped.flatMap((c) =>
      c.nodes.filter((n) => n.type === STANDING_COMPONENT).map((n) => `${c.path} › ${n.id}`)
    );
    expect(placements).toHaveLength(1);
    expect(placements[0].startsWith(`${CHROME_COMPONENT} `)).toBe(true);
  });

  it('control: the census counts placements that exist, not a type nothing uses', () => {
    // 🔴 Without this, the assertion above is satisfied by a typo in
    // STANDING_COMPONENT — every page would place "none" of a type that is not
    // there, and the count would be wrong in the other direction. The component
    // itself must also be a thing the project ships.
    expect(shipped.map((c) => c.path)).toContain(STANDING_COMPONENT);
    expect(shipped.map((c) => c.path)).toContain(CHROME_COMPONENT);
  });

  it.each(DETAIL)('$page cannot delete without being asked, and never at page mount', ({ page }) => {
    const { page: comp, del } = removalOf(page);

    // Nothing reaches `store` but the one node that carries the id.
    const fired = comp.connections.filter((w) => w.toId === del.id && w.toProperty === 'store');
    expect(fired).toHaveLength(1);
    const holder = comp.nodes.find((n) => n.id === fired[0].fromId);
    expect(holder?.type).toBe('JavaScriptFunction');

    // 🔴 **The box that would have deleted a record on sight.** `Run` is
    // ADDITIVE: left ticked, this node also fires when the id arrives — which
    // is at page mount, so opening an announcement would remove it. There is no
    // screen on which that failure is visible before it has happened.
    const runOnChange = Object.entries(holder?.parameters ?? {}).filter(([k]) => k.startsWith('runOnChange-in-'));
    expect(runOnChange).toHaveLength(1);
    expect(runOnChange[0][1]).toBe(false);

    // And its one trigger is a button the moderator has to reach through the
    // confirm — which is mounted `false` until the remove button is pressed.
    const triggers = comp.connections.filter((w) => w.toId === holder?.id && w.toProperty === 'run');
    expect(triggers).toHaveLength(1);
    const yes = comp.nodes.find((n) => n.id === triggers[0].fromId);
    expect(yes?.type).toBe('net.noodl.controls.button');
    expect(yes?.parameters?.label).toBe('Yes, remove it');
    // Walk UP from the button: its row, then the panel holding the row. The
    // panel is the node that must be absent until asked for.
    const row = comp.nodes.find((n) => (n.children ?? []).includes(yes!.id));
    const panel = comp.nodes.find((n) => (n.children ?? []).includes(row!.id));
    expect(panel?.parameters?.mounted).toBe(false);
  });

  it('the confirm is answerable BOTH ways, and "keep it" is not the filled button', () => {
    for (const { page } of DETAIL) {
      const comp = byLegacyName.get(page)!;
      const labels = comp.nodes
        .filter((n) => n.type === 'net.noodl.controls.button')
        .map((n) => String(n.parameters?.label ?? ''))
        .sort();
      // Three controls and no more: the way in, and the two ways out of the
      // question. Written as literals — the words are what a moderator reads.
      expect(labels).toEqual([
        'Keep it',
        page === '/Pages/Announcement' ? 'Remove this announcement' : 'Remove this meeting',
        'Yes, remove it'
      ].sort());
      // 🔴 Neither answer is emphasised. A filled "Yes, remove it" would put the
      // eye on the irreversible half of a question about an irreversible act.
      const filled = comp.nodes.filter(
        (n) => n.type === 'net.noodl.controls.button' && n.parameters?.backgroundColor === 'var(--primary)'
      );
      expect(filled).toEqual([]);
    }
  });

  it('🔴 the policy already allowed every delete the app now performs', () => {
    // The finding this work came from, kept as a rule: a graph that deletes from
    // a collection the policy refuses is green everywhere and refused at run
    // time — the exact shape the whole file exists to catch.
    const deleted = new Set(
      allNodes()
        .filter(({ node }) => node.type === 'DeleteDbModelProperties')
        .map(({ node }) => String(node.parameters?.collectionName))
    );
    expect([...deleted].sort()).toEqual(['Announcement', 'Meeting', 'MemberRequest'].sort());
    for (const collection of deleted) {
      const rule = policy.collections[collection]?.permissions?.delete;
      // `MemberRequest` is deleted by a CLOUD function, which runs as system and
      // bypasses the policy — so `nobody` is correct there and `role:admin` is
      // correct for the two the browser touches. Graded per row rather than as
      // one sentence, because the two answers are opposite and both are right.
      const fromBrowser = collection !== 'MemberRequest';
      expect({ collection, rule }).toEqual({ collection, rule: fromBrowser ? `role:${ROLE_MODERATOR}` : 'nobody' });
    }
  });
});

describe('TPL-001 — the endpoints', () => {
  it('the two role-granting nodes create their role, because a fresh backend has neither', () => {
    // Without `createRole`, the FIRST call on every backend fails
    // `role/not-found`: the policy names `member` and `admin`, and a role exists
    // in `_Role` only once somebody is in it.
    const grants = allNodes().filter(({ node }) => node.type === 'noodl.cloud.addusertorole');
    expect(grants).toHaveLength(2);
    for (const { component, node } of grants) {
      expect(`${component.path}:${node.parameters?.createRole}`).toBe(`${component.path}:true`);
    }
    expect(grants.map(({ node }) => node.parameters?.role).sort()).toEqual([ROLE_MODERATOR, ROLE_MEMBER].sort());
  });

  it('every endpoint answers on every edge it can take', () => {
    // A cloud function that reaches no Response leaves the caller waiting until
    // the request times out — and every refusal path in this template is
    // deliberately routed to one message.
    for (const fn of TPL001_CLOUD_COMPONENTS) {
      const component = byLegacyName.get(fn.legacyName) as StoredComponent;
      const responses = component.nodes.filter((n) => n.type === 'noodl.cloud.response');
      expect(`${fn.legacyName}:${responses.length > 0}`).toBe(`${fn.legacyName}:true`);
      for (const response of responses) {
        const sends = component.connections.filter((w) => w.toId === response.id && w.toProperty === 'send');
        expect(`${fn.legacyName}:${response.id}:${sends.length > 0}`).toBe(`${fn.legacyName}:${response.id}:true`);
      }
    }
  });

  it('🔴 requestAccess answers an existing account exactly as it answers a new one', () => {
    // Telling a stranger "you are already registered" tells them who belongs to
    // this congregation, which is the one fact a members' area exists to keep.
    // Both edges reach ONE node, so they cannot drift apart.
    const fn = byLegacyName.get('/#__cloud__/requestAccess') as StoredComponent;
    const create = fn.nodes.find((n) => n.type === 'noodl.cloud.createuser') as StoredNode;
    const onUnchanged = fn.connections.filter((w) => w.fromId === create.id && w.fromProperty === 'unchanged');
    const onFiled = fn.connections.filter((w) => w.fromId === 'file' && w.fromProperty === 'done');
    expect(onUnchanged).toHaveLength(1);
    expect(onFiled).toHaveLength(1);
    expect(onUnchanged[0].toId).toBe(onFiled[0].toId);
    // …and nothing is filed on the `unchanged` edge.
    expect(onUnchanged[0].toId).not.toBe('file');
  });

  it('the standing endpoint reports the pending person, whose roles read answers `unchanged`', () => {
    // 🔴 `Get User Roles` fires `Unchanged` for "in no roles at all" rather than
    // `Done` with an empty list — the node's own contract. Leaving that edge
    // unwired is a members' area where nobody who has just asked to join ever
    // gets an answer, and it looks exactly like a slow network.
    const fn = byLegacyName.get('/#__cloud__/myStanding') as StoredComponent;
    const roles = fn.nodes.find((n) => n.type === 'noodl.cloud.getuserroles') as StoredNode;
    const edges = fn.connections
      .filter((w) => w.fromId === roles.id)
      .map((w) => w.fromProperty)
      .sort();
    expect(edges).toEqual(['done', 'failure', 'roles', 'unchanged']);
  });
});

/**
 * Phase 78 s7 — the look, ratcheted where the `>0` gate cannot reach.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * `templateAppearance.test.ts` asks whether this template opened the design
 * system at all: does it set *a* colour, *a* type size, *a* constrained width.
 * It was green on an artefact in which **31 of 45 `Text` nodes set no size and
 * no colour**, every notice was an unboxed grey line, and the only cards in the
 * app were the four repeater rows. That is not a fault in that gate — a `> 0`
 * question is the right one to ask of a template that might have ignored the
 * system entirely. It is the wrong one to ask of a template that has opened it
 * and then stopped half way, and this file's population is small enough to ask
 * the total question instead.
 *
 * 🔴 **§3 is the one worth reading.** §1 and §2 pin work that was done; §3 pins a
 * decision that is easy to undo by accident and expensive to notice, because
 * undoing it makes every spec here *greener*, not redder: wrapping a list in a
 * card raises the colour count, raises the structure count, and makes the page
 * disappear.
 */
describe('TPL-001 — the design system is finished, not merely opened', () => {
  /** Every visual node in the shipped artefact, with the component it is in. */
  const everyNode = shipped.flatMap((c) => c.nodes.map((n) => ({ component: c.path, node: n })));

  /**
   * §1 — no `Text` ships without a type ramp.
   *
   * A `Text` that sets neither a size nor a colour renders at the browser's
   * default in the runtime's default ink, which is what "black and white,
   * everything left aligned in one column" was made of. Stated as a census so a
   * failure names the node rather than a number.
   */
  it('§1 every Text sets a type ramp', () => {
    const bare = everyNode
      .filter(({ node }) => node.type === 'Text')
      .filter(({ node }) => {
        const p = node.parameters ?? {};
        return !('fontSize' in p) && !('color' in p);
      })
      .map(({ component, node }) => `${component} › ${node.id} "${String(node.parameters?.text ?? '')}"`);
    expect(bare).toEqual([]);
  });

  /**
   * §2 — a notice box is a box.
   *
   * Every notice in this template is a `Group` wrapping exactly one `Text`. The
   * point of the wrapper is the surface; a wrapper that lost its fill would be
   * padding around a sentence, which is worse than the grey line it replaced —
   * it takes the space of a designed thing and looks like a mistake.
   */
  it('§2 every notice box carries a fill and an edge', () => {
    const boxes = everyNode.filter(({ component, node }) => {
      if (node.type !== 'Group' || (node.children ?? []).length !== 1) return false;
      const nodes = shipped.find((c) => c.path === component)?.nodes ?? [];
      const only = nodes.find((n) => n.id === (node.children ?? [])[0]);
      if (only?.type !== 'Text') return false;
      // 🔴 **A CHILD OF A `Columns` IS A LAYOUT CELL, NEVER A NOTICE — and this
      // exclusion is a correction to the SHAPE this census matches, not a
      // waiver.** REL-002c made `Members/MemberRow` a three-column table row,
      // and a `Columns` child has to be a Group that declares `sizeMode` and
      // `width` (the gate above this one is about exactly that: a content-sized
      // child ignores the box `calcAutoFit` hands it). So "a Group wrapping one
      // Text" is now produced by two different intentions, and only one of them
      // is a notice. Painting the three cells to satisfy this would put a fill
      // and a radius behind every name in the directory.
      //
      // ⚠️ Read from the artefact — the cell's PARENT type — rather than from a
      // list of ids: an id here is not a name you may do arithmetic on (§5's
      // finding), and a rule over the shape holds for the next row that reflows.
      const parent = nodes.find((n) => (n.children ?? []).includes(node.id));
      return parent?.type !== 'net.noodl.visual.columns';
    });
    // Pinned exactly, not as a floor: an all-passing census over nothing is not
    // a measurement, and a notice quietly lost is the failure this catches.
    // 3 Members (pending, unknown, empty) + 2 Meetings + 2 Requests + 2
    // Directory + 2 Join + 2 Setup + 1 Announcement + 1 Meeting + 1 Post + 1
    // SignIn = 17. `Pages/Landing`'s setup card is NOT one of these: it wraps a
    // sentence AND a button, which makes it a panel rather than a notice.
    //
    // 19 since s11: the two detail pages' "that could not be removed". Their
    // sibling — the "are you sure" — is deliberately NOT one, by exactly the
    // `Pages/Landing` rule above: it holds the sentence and the two buttons
    // that answer it. It was written with `notice()` first, which gave it a
    // notice's styling while a second child kept it out of this census — a spec
    // passing for a reason nobody had stated. It is a `PANEL` now.
    expect(boxes.length).toBe(24); // TPL-002: 3 on Account, 2 on Unsubscribe; REL-002c's footer shell holds two
    const unpainted = boxes
      .filter(({ node }) => {
        const p = node.parameters ?? {};
        return !('backgroundColor' in p) || !('borderRadius' in p);
      })
      .map(({ component, node }) => `${component} › ${node.id}`);
    expect(unpainted).toEqual([]);
  });

  /**
   * §3 — 🔴 **a section that holds cards does not itself carry one.**
   *
   * `card` fills with `--surface` and the row cards fill with `--surface`, so a
   * list wrapped in a card puts the rows' fill on their own container: the row
   * edges measure **1.26:1** against it and the list stops reading as separate
   * cards. There is no contrast rule that forbids this — a decorative divider
   * carries no minimum — so nothing else in this repo would ever say so.
   *
   * ⚠️ **And the mistake makes the other gates happier.** Adding that fill would
   * raise `templateAppearance`'s colour count, add a structural parameter and
   * satisfy §2 above. Every instrument pointed at this template would go greener
   * while the screen got worse, which is exactly why it needs a row of its own.
   */
  it('§3 no container of a repeater carries its own fill', () => {
    const offenders: string[] = [];
    for (const component of shipped) {
      const byId = new Map(component.nodes.map((n) => [n.id, n]));
      for (const node of component.nodes) {
        const holdsRows = (node.children ?? []).some((id) => byId.get(id)?.type === 'For Each');
        if (holdsRows && node.parameters && 'backgroundColor' in node.parameters) {
          offenders.push(`${component.path} › ${node.id} fills behind its own rows`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Beside a known-firing signal: the repeater containers exist and were
    // walked, so `[]` is a reading and not an empty population.
    const holders = shipped.flatMap((c) => {
      const byId = new Map(c.nodes.map((n) => [n.id, n]));
      return c.nodes.filter((n) => (n.children ?? []).some((id) => byId.get(id)?.type === 'For Each'));
    });
    expect(holders.length).toBe(4);
  });

  /**
   * §4 — 🔴 **the list of compositions the template uses is the list it uses.**
   *
   * `USED_COMPOSITIONS` carried the sentence *"asserted by the gate, so a rename
   * reddens"* for its whole life and **no gate read it** — `grep` returned the
   * declaration and nothing else. It had drifted accordingly: `eyebrow` and
   * `sectionHead` were on it while the template used neither, so the one thing
   * it was for (noticing a composition that stopped being referenced) was
   * exactly what it could not do.
   *
   * The right-hand side is not another hand-written list: `composition()`
   * records every id it is asked for, and importing `tpl001Components` runs all
   * of them at module scope. So this compares a declaration against a
   * measurement rather than two declarations against each other.
   */
  it('§4 USED_COMPOSITIONS is exactly what the template asked the vocabulary for', () => {
    const asked = requestedCompositions();
    // Beside a known-firing signal: an empty recorder would make the comparison
    // below pass against an empty list, which is the failure this file's own
    // house rules are about.
    expect(asked.length).toBeGreaterThan(10);
    expect(asked).toEqual([...USED_COMPOSITIONS].sort());
  });

  /**
   * §4b — ✅ **DEF-006 (a) / AC5: the template's own repair has lapsed.**
   *
   * `withoutInertBorderWidth` was written as a *rule* rather than as an edit to
   * one call site precisely so this test could exist. It stripped a `borderWidth`
   * that `primaryButton` set under its own `borderStyle: 'none'` — a port the
   * runtime never reads, one `inactive-conditional-parameter` per button, twelve
   * on one generation run. That was one template working around a defect every
   * agent authoring on-system had.
   *
   * 🔴 **Asserted over the compositions the vocabulary SHIPS, not the ones this
   * template applies.** "The workaround does nothing for us" and "the product no
   * longer needs the workaround" are different sentences, and only the second is
   * what AC5 asks for. `raised` and `ruled` are in this population and neither
   * has ever been through the helper.
   *
   * If a composition ever reintroduces the shape, this names it — which is why
   * the helper stays rather than being deleted quietly.
   */
  it('§4b no shipped composition still needs the inert-borderWidth workaround', () => {
    expect(compositionsStillNeedingInertBorderWidthRemoval()).toEqual([]);
  });

  it('§4b CONTROL — the workaround still removes the shape it is about', () => {
    // Without this, §4b passes just as well on a helper that returns its input.
    expect(Object.keys(withoutInertBorderWidth({ borderStyle: 'none', borderWidth: 0, color: 'red' }))).toEqual([
      'borderStyle',
      'color'
    ]);
    expect(Object.keys(withoutInertBorderWidth({ borderStyle: 'solid', borderWidth: 1 })).sort()).toEqual([
      'borderStyle',
      'borderWidth'
    ]);
  });

  /**
   * §5 — 🔴 **every page says what KIND of screen it is, and the words are
   * LITERALS here.**
   *
   * The table below is typed out rather than imported, and that is the whole
   * design of this spec. s9's band specs mapped over `BAND_NAV` to build both
   * sides of their comparison, so deleting a field moved the expectation and the
   * measurement together and the block stayed green over a real regression. This
   * one reads the shipped artefact on one side and a hand-written table on the
   * other, so an eyebrow that changes wording, loses its page or gains a
   * duplicate reddens.
   *
   * ⚠️ **`Pages/Landing` is absent on purpose and pinned as absent below.** Its
   * eyebrow belongs to the hero (`HERO_HEAD`), not to a page head, and adding it
   * to this table would quietly widen what "a page head" means.
   *
   * ⚠️ The words themselves are a judgement, and the reason is recorded on
   * `pageHead()`: the band already carries "Members' area" over the association
   * name on seven pages, so a page eyebrow may not repeat that phrase there.
   */
  const PAGE_EYEBROWS: Record<string, string> = {
    '/Pages/SignIn': 'Members\u2019 area',
    '/Pages/Join': 'Members\u2019 area',
    '/Pages/Setup': 'First run',
    '/Pages/Members': 'For members',
    '/Pages/Meetings': 'For members',
    '/Pages/Announcement': 'Announcement',
    '/Pages/Meeting': 'Meeting',
    '/Pages/Post': 'For moderators',
    '/Pages/Requests': 'For moderators',
    '/Pages/Directory': 'For moderators',
    // TPL-002. `Your account` rather than `For members`: the band already says
    // whose members' area this is, and this page is about the reader themselves.
    '/Pages/Account': 'Your account',
    // ⚠️ The one page whose eyebrow DOES repeat the band's words, and it is the
    // one page with no band on it — the reader arrives here from a mail client,
    // signed out, and nothing else on the screen says which association this is.
    '/Pages/Unsubscribe': 'Members\u2019 area'
  };

  /**
   * 🔴 **Matched on `Head` with an optional `-n`, and the eyebrow is read as the
   * head's FIRST CHILD rather than by name.** D6 recorded that the door remaps a
   * node id that collides with one already written — the eleven pages all call
   * their heading `heading`, so ten of them ship as `headingHead-2` … `-8`. The
   * first version of this spec derived the eyebrow's id from the head's with
   * `replace(/Head$/, '')`, which silently matched nothing on every remapped
   * page and reported **two** of the ten as if the other eight had no eyebrow at
   * all. An id in this artefact is not a name you may do arithmetic on.
   */
  const HEAD_ID = /Head(-\d+)?$/;

  /**
   * The node types that put a request on the wire, and the node types that take
   * a person somewhere. Both are read from the artefact's own census rather
   * than invented: every db-shaped node this template ships is one of the four
   * below (`NewDbModelProperties` and `DeleteDbModelProperties` are writes, and
   * a write on this page would be worse than a read, not better).
   */
  const FETCHES = new Set(['DbCollection2', 'DbModel2', 'NewDbModelProperties', 'DeleteDbModelProperties']);
  const LEADS_AWAY = new Set(['RouterNavigate', 'net.noodl.controls.button']);

  it('§5 every page heads itself with the eyebrow this table names', () => {
    const found: Record<string, string> = {};
    for (const component of shipped) {
      const head = component.nodes.find((n) => n.type === 'Group' && HEAD_ID.test(n.id));
      if (!head) continue;
      const first = component.nodes.find((n) => n.id === (head.children ?? [])[0]);
      if (first) found[component.path] = String(first.parameters?.text ?? '');
    }
    expect(found).toEqual(PAGE_EYEBROWS);
  });

  it('§5 the page eyebrow never repeats the words the band is already saying', () => {
    // The band's own eyebrow, read from the artefact rather than assumed.
    const band = byLegacyName.get('/Members/Chrome');
    const bandEyebrow = String(band?.nodes.find((n) => n.id === 'eyebrow')?.parameters?.text ?? '');
    expect(bandEyebrow).toBe('Members\u2019 area');

    const carriesBand = shipped
      .filter((c) => c.nodes.some((n) => n.type === '/Members/Chrome'))
      .map((c) => c.path)
      .sort();
    // Known-firing: seven pages carry it, so the filter below reads something.
    // 🔴 Eight, not nine: `Pages/Unsubscribe` carries NO band, deliberately. It
    // is opened signed out from a mail client, and a band would be an auth round
    // trip on the one page whose whole point is not needing one.
    expect(carriesBand.length).toBe(8);

    // 🔴 Read from the ARTEFACT, not from `PAGE_EYEBROWS`. The first version of
    // this spec filtered the hand-written table, so it graded the table against
    // the band and never opened the shipped pages at all: setting
    // `Pages/Members`' eyebrow to the band's own words left it green. A rule
    // about what a screen shows has to read the screen.
    const repeats = carriesBand.filter((page) => {
      const component = byLegacyName.get(page);
      const head = component?.nodes.find((n) => n.type === 'Group' && HEAD_ID.test(n.id));
      const first = component?.nodes.find((n) => n.id === (head?.children ?? [])[0]);
      return String(first?.parameters?.text ?? '') === bandEyebrow;
    });
    expect(repeats).toEqual([]);
  });

  /**
   * 🔴 **RICHARD'S RULING, 2026-08-29 (D39), HALF-REVERSED BY HIM 2026-09-04.**
   *
   * D39 was: the unsubscribe page stays one sentence — it names no association
   * and offers no way back, and that is a decision rather than an omission.
   *
   * ⚠️ **It costs a query and a link, and only one of those is expensive.** The
   * association name is `acl-world-read`, so it CAN be fetched with no session —
   * but on a page opened from a mail client its whole design is making no round
   * trip. A link back is free, a static route with no data behind it. D39
   * declined both, so this spec covered both.
   *
   * ✅ **The LINK half is now authorised.** On the 0.2.2 ruling sheet he ruled
   * `/unsubscribe` **SHITTY** — its only sub-PASSABLE verdict in the members'
   * area — and answered the standing §7.3 judgement about its ~190px of void
   * with **"Allow a way back after all"**. So the page now carries an outline
   * button to `/Pages/SignIn`, which is precisely what s12 built and this spec
   * correctly refused at the time.
   *
   * 🔴 **This spec is REWRITTEN, not deleted, and the difference matters.** Its
   * whole reason to exist was that the page's silence used to be a property of
   * *what nobody had added yet*: nothing failed if a later session reached D39's
   * conclusion independently and "fixed" it. That hazard is unchanged for the
   * half still standing — so rows 1, 3 and 4 read exactly as they did, and row 2
   * now pins the way back as **one** route to **one** target rather than pinning
   * its absence. A second `RouterNavigate`, or a different destination, is still
   * a red.
   *
   * ⚠️ **The EXPENSIVE half was never put to him** and stays declined: row 1
   * still asserts this page reads nothing from the database, and row 3 still
   * pins the single cloud call by name.
   */
  it('§5 the unsubscribe page fetches nothing and leads to exactly one place \u2014 D39, half-reversed 2026-09-04', () => {
    const page = byLegacyName.get('/Pages/Unsubscribe');
    expect(page).toBeDefined();
    const types = (page?.nodes ?? []).map((n) => String(n.type));

    // 🔴 **Known-firing, and it is the whole reason to trust the three
    // emptinesses below.** An absence measured with a misspelt node type reads
    // exactly like an absence that is real, and the landing page is the natural
    // control: it is the OTHER page a signed-out stranger opens, and it does all
    // three of the things this one declines. If this block ever goes quiet, the
    // rows underneath it have stopped meaning anything.
    const landing = (byLegacyName.get('/Pages/Landing')?.nodes ?? []).map((n) => String(n.type));
    expect(landing.filter((t) => FETCHES.has(t)).length).toBeGreaterThan(0);
    expect(landing.filter((t) => LEADS_AWAY.has(t)).length).toBeGreaterThan(0);

    // 1. Nothing reads the database. This is the half that would name the
    //    association, and the half the ruling actually paid for.
    expect(types.filter((t) => FETCHES.has(t))).toEqual([]);

    // 2. 🔴 **The half he reversed on 2026-09-04.** It used to read
    //    `toEqual([])`. It now pins the shape of the thing that replaced the
    //    absence, because "there is a way back" is satisfied by a page with
    //    four of them pointing at three different places, and that would be a
    //    worse page than the silent one D39 asked for.
    //
    //    ⚠️ **Counted, then identified — never named by node id.** The id is
    //    the one thing about this graph a door rename can move.
    //    ⚠️ `LEADS_AWAY` holds BOTH halves of a way out — the control and the
    //    navigate — because D39 declined both and one without the other is not
    //    a way out. So the pair is counted as a pair.
    const leadsAway = (page?.nodes ?? []).filter((n) => LEADS_AWAY.has(String(n.type)));
    expect(leadsAway).toHaveLength(2);

    const navs = leadsAway.filter((n) => String(n.type) === 'RouterNavigate');
    expect(navs).toHaveLength(1);
    expect(String((navs[0].parameters ?? {}).target)).toBe('/Pages/SignIn');

    const controls = leadsAway.filter((n) => String(n.type) !== 'RouterNavigate');
    expect(controls).toHaveLength(1);
    expect(String((controls[0].parameters ?? {}).label)).toBe(UNSUBSCRIBE_BACK_LABEL);

    //    And the two are wired to each other, which is the half a census
    //    cannot see. An unreachable navigate is the same screen as no navigate
    //    at all — the state this row exists to tell apart.
    //
    //    🔴 **Both ends are read from the graph, never typed.** The door
    //    renames ids project-wide for uniqueness: this run's navigate came out
    //    as `toSignIn-3`, and a spec naming `toSignIn` would have been green on
    //    a template that had lost the wire.
    const navId = String(navs[0].id);
    const controlId = String(controls[0].id);
    const wire = (page?.connections ?? []).filter(
      (c) => String(c.toId) === navId && String(c.toProperty) === 'navigate'
    );
    expect(wire).toHaveLength(1);
    expect(String(wire[0].fromId)).toBe(controlId);

    // 3. It still makes exactly ONE outbound call, and it is the unsubscribe
    //    itself. 🔴 This row is not redundant with (1): the association name is
    //    reachable through a cloud function too, and a second `CloudFunction2`
    //    is how a well-meaning session would add it without tripping either
    //    absence above. Pinned by NAME, so swapping which function runs is a
    //    red rather than a green.
    const calls = (page?.nodes ?? []).filter((n) => n.type === 'CloudFunction2');
    expect(calls.map((n) => String((n.parameters ?? {}).function))).toEqual([FN_UNSUBSCRIBE]);

    // 4. And the words on it are still one heading and two notices. A sentence
    //    naming the association would land here without touching a node type.
    const texts = (page?.nodes ?? [])
      .filter((n) => n.type === 'Text')
      .map((n) => String((n.parameters ?? {}).text ?? ''));
    expect(texts).toEqual([
      'Members\u2019 area',
      'Emails',
      UNSUBSCRIBED_TEXT,
      UNSUBSCRIBE_FAILED_TEXT
    ]);
  });

  it('§5 the landing page heads itself with the hero, not a page head', () => {
    const landing = byLegacyName.get('/Pages/Landing');
    expect(landing).toBeDefined();
    expect(landing?.nodes.filter((n) => HEAD_ID.test(n.id)).map((n) => n.id)).toEqual([]);
    // It still has an eyebrow — it is simply the hero's, and it is found by what
    // it LOOKS like, because `eyebrow` collided with the band's and shipped as
    // `eyebrow-2`. See the note on `HEAD_ID`.
    const eyebrows = (landing?.nodes ?? []).filter(
      (n) => n.type === 'Text' && (n.parameters ?? {}).textTransform === 'uppercase'
    );
    expect(eyebrows.map((n) => String(n.parameters?.text ?? ''))).toEqual(['Members\u2019 area']);
  });

  /**
   * §6 — 🔴 **a section that follows another section carries the rule that says
   * where one ends.**
   *
   * Derived from the artefact's own parent/child structure rather than from a
   * list of node ids: any `Group` that is the second-or-later `SECTION` under
   * one ground has to carry a top border. A page that grows a second zone and
   * forgets the hairline reddens here without anybody adding it to a table.
   *
   * ⚠️ A `SECTION` is recognised the way the eye does — a full-width column
   * `Group` with no fill of its own that holds more than one child. The notice
   * boxes §2 pins are excluded by their fill, and the card rows by theirs.
   *
   * 🔴 **A page HEAD is not a section, and `paddingBottom` is what tells them
   * apart.** The first version of this spec counted every `headingHead` as the
   * first section on its page, which made the real content section the "second"
   * one everywhere and reported **seven** stacked pairs where there is one. The
   * distinction is the vocabulary's own: `sectionHead` carries the air below it
   * (`paddingBottom`) and `SECTION` carries none, so a head bundles its own
   * separation and a section is separated by the rule. `Pages/Landing`'s `hero`
   * is excluded by exactly this, correctly — "What members can see" follows a
   * head, not another section.
   */
  it('§6 the second section on a page carries a rule above it', () => {
    const missing: string[] = [];
    let seconds = 0;
    for (const component of shipped) {
      const byId = new Map(component.nodes.map((n) => [n.id, n]));
      for (const parent of component.nodes) {
        const kids = (parent.children ?? []).map((id) => byId.get(id)).filter(Boolean) as typeof component.nodes;
        const sections = kids.filter((k) => {
          const q = k.parameters ?? {};
          return (
            k.type === 'Group' &&
            !('backgroundColor' in q) &&
            !('paddingBottom' in q) &&
            (k.children ?? []).length > 1 &&
            q.flexDirection === 'column'
          );
        });
        for (const later of sections.slice(1)) {
          seconds += 1;
          if (!('borderTopWidth' in (later.parameters ?? {}))) {
            missing.push(`${component.path} \u203a ${later.id} follows a section with no rule above it`);
          }
        }
      }
    }
    // Beside a known-firing signal: `[]` below has to be a reading rather than
    // an empty population.
    //
    // 🔴 **3 since REL-002c s13, and the ARGUMENT moved, not just the number.**
    // It used to read *"today exactly one page stacks two sections"*. The two
    // detail pages now do as well: giving `/announcements/{id}` and
    // `/meetings/{id}` a `PROSE` measure turned their date-and-body into a
    // second full-width column `Group` above the removal zone, where before
    // they were two bare `Text` children of the ground and the removal was the
    // only section on the page.
    //
    // ✅ **This spec is what said so, and it read the structure correctly.** The
    // record IS a zone, `removal` IS the zone after it, and `removal` already
    // carried the hairline — which is why `missing` below stayed empty through
    // the change. A pin that had merely been incremented would have hidden the
    // one thing worth knowing: the shape this rule is about now occurs on three
    // pages rather than one.
    expect(seconds).toBe(3);
    expect(missing).toEqual([]);
  });

  /**
   * §7 — 🔴 **B3: a list of records reads as a LIST, and not every list is one.**
   *
   * Before this, all four repeater rows wore the same `card`: eight
   * announcements rendered as eight boxes 175px tall for one line of
   * information each, a six-meeting diary ran to 1,200px, and a directory of
   * four people read as four objects rather than as a directory. The cause was
   * in the kit — of eighteen compositions exactly **two** carried a content fill
   * and both were `--surface` (D26) — so no template could fix it for itself
   * until P80 C1 shipped `ruled`.
   *
   * 🔴 **And the fix was invisible to every gate here.** The whole suite stayed
   * green across the change, byte-identity included, because it regenerates: the
   * artefact and the source moved together and nothing compared either against a
   * *statement*. So these three rows are literals, in the sense s9's finding
   * settled — the side the rule is ABOUT is read from the shipped artefact, and
   * the side that says what it should be is written here by hand.
   */
  const ROW_TREATMENTS: Record<string, 'ruled' | 'card'> = {
    '/Members/AnnouncementRow': 'ruled',
    '/Members/MeetingRow': 'ruled',
    '/Members/MemberRow': 'ruled',
    // 🔴 **The one that stays a card, and it is the point of the section rather
    // than an exception to it.** A request to join is a decision with two
    // consequential buttons on it, and boxing it says "this is one thing you are
    // being asked about". A noticeboard, a diary and a directory are lists of
    // records a person scans. "Layout variety" that made all four `ruled` would
    // have swapped one uniform for another.
    '/Members/RequestRow': 'card'
  };

  /**
   * A component's root node, found by EXCLUSION rather than by a `parent` field.
   *
   * ⚠️ The artefact carries `parent` on every child, but `StoredNode` above does
   * not declare it — and reaching for an undeclared field is how this file's own
   * §5 finding started. The root is the node nothing lists as a child, which is
   * true of the artefact whatever it happens to serialise.
   */
  const rootOf = (row: (typeof shipped)[number]) => {
    const claimed = new Set(row.nodes.flatMap((n) => n.children ?? []));
    return row.nodes.find((n) => !claimed.has(n.id));
  };

  /** How a row's ROOT is dressed in the shipped artefact, by what it carries. */
  const treatmentOf = (row: (typeof shipped)[number]): string => {
    const root = rootOf(row);
    const p = (root?.parameters ?? {}) as Record<string, unknown>;
    const filled = 'backgroundColor' in p;
    const boxed = 'borderWidth' in p || 'borderRadius' in p;
    const bottomRule = 'borderBottomWidth' in p;
    if (filled && boxed && !bottomRule) return 'card';
    if (!filled && !boxed && bottomRule) return 'ruled';
    return `neither (fill:${filled} box:${boxed} rule:${bottomRule})`;
  };

  it('§7 every repeater row wears one of the two treatments, and which one is stated here', () => {
    const rows = allNodes()
      .filter(({ node }) => node.type === 'For Each')
      .map(({ node }) => String(node.parameters?.template));
    // Beside a known-firing signal, and pinned: four repeaters, four rows. A
    // list that stopped repeating would make every census below pass over
    // nothing.
    expect(new Set(rows).size).toBe(4);
    const found: Record<string, string> = {};
    for (const name of [...new Set(rows)].sort()) {
      const row = shipped.find((c) => c.path === name);
      found[name] = row ? treatmentOf(row) : 'no such component';
    }
    expect(found).toEqual(ROW_TREATMENTS);
    // And the two treatments are BOTH used: a map that agreed with itself on one
    // value would satisfy the line above while the variety it is about was gone.
    expect(new Set(Object.values(found)).size).toBe(2);
  });

  it('§7 a ruled row does not push the next one away, and a card does', () => {
    const margins: Record<string, boolean> = {};
    for (const [name] of Object.entries(ROW_TREATMENTS)) {
      const row = shipped.find((c) => c.path === name);
      const root = row ? rootOf(row) : undefined;
      margins[name] = 'marginBottom' in ((root?.parameters ?? {}) as Record<string, unknown>);
    }
    // 🔴 The two arms are opposite and that is what makes this a reading. A card
    // NEEDS the gap or its border sits flush against the next one's (§13); a
    // ruled row needs the rows to TOUCH, because the hairlines are the only
    // thing making eight of them one list rather than eight underlined
    // paragraphs.
    expect(margins).toEqual({
      '/Members/AnnouncementRow': false,
      '/Members/MeetingRow': false,
      '/Members/MemberRow': false,
      '/Members/RequestRow': true
    });
  });

  /**
   * §7 — 🔴 **the one thing in a split row that nothing else can see: how many
   * of its children GROW.**
   *
   * A ruled row with an action at its far edge works only if exactly one child
   * takes the slack. `layout.ts:79-88` turns a percentage width inside a row
   * parent into `flexGrow`; every visual node's `width` port **defaults to
   * `100%`** (`node-shared-port-definitions.ts:813-823`), so growing is what a
   * child does unless something stops it. Two growers and
   * `justifyContent: space-between` has nothing left to distribute: the row
   * splits down the middle and the action is stranded in the centre.
   *
   * That is not a hypothetical — it is what the directory row did when it was
   * first built this way. Measured: **348px per side** at 1280, and at 390 the
   * standing wrapped onto two lines while the addresses broke mid-word
   * (`ada@example.invali / d`). Every parameter was legal, the door raised
   * nothing, §1–§6 were unmoved, and the composition was used correctly.
   *
   * 🔴 **This spec's first draft could not have caught that, and the mistake is
   * worth keeping.** It asked whether the FIRST child grows — which was true of
   * the broken directory row *and* of the healthy one, so the number it reported
   * was the same on both sides of the defect. Two further things were wrong with
   * it and each was found by a different instrument:
   *
   * 1. It required `sizeMode` to be `contentHeight` or `explicit`. Deleting
   *    `sizeMode` reddened the spec and the page **rendered identically**, because
   *    a `Group` defaults to `explicit` and that assigns the width anyway.
   * 2. Restating it as `contentSize` — the mode that really does drop the width —
   *    could not reach the artefact at all: **the door refuses it**,
   *    `inert-dimension`, naming the port, the node and the fix. A gate for
   *    something the door already rejects is not a gate.
   *
   * What is left is the thing the door does NOT check, because each parameter is
   * individually valid and only their combination on one row is wrong.
   */

  /**
   * A visual node's `sizeMode` when the artefact does not say — the product's
   * own per-type default, which is what decides whether an unstated width is
   * read at all.
   *
   * ⚠️ **A second copy of a product fact, and it is fenced rather than trusted.**
   * A type absent from this table is a failure below, not an assumption: the
   * whole defect this spec exists for is a node that grew when nobody meant it
   * to, so "I do not know this type, assume it does not grow" is the one answer
   * that must never be given silently.
   */
  const DEFAULT_SIZE_MODE: Record<string, string> = {
    // `addDimensions(GroupNode)` — no options, so `defaultSizeMode = 'explicit'`.
    Group: 'explicit',
    // `text.ts:149` — `defaultSizeMode: 'contentHeight'`. A Text grows too, which
    // is exactly how the directory ended up 50/50.
    Text: 'contentHeight',
    // `button.ts:60` — `defaultSizeMode: 'contentSize'`. This is the whole reason
    // a button is safe at the far edge of a row and a sentence is not.
    'net.noodl.controls.button': 'contentSize'
  };

  it('§7 a row that splits has exactly one child that grows into the gap', () => {
    const unknownTypes: string[] = [];
    const wrong: string[] = [];
    let splits = 0;

    const grows = (node: { type: string; parameters?: Record<string, unknown> }): boolean => {
      const p = node.parameters ?? {};
      const mode = (p.sizeMode as string | undefined) ?? DEFAULT_SIZE_MODE[node.type];
      if (mode === undefined) {
        unknownTypes.push(node.type);
        return false;
      }
      if (mode === 'contentSize' || mode === 'contentWidth') return false;
      // An absent `width` is the port's own default of 100% — so absence grows.
      const width = (p.width as { unit?: string } | undefined) ?? { unit: '%' };
      return width.unit === '%';
    };

    for (const [name] of Object.entries(ROW_TREATMENTS)) {
      const row = shipped.find((c) => c.path === name);
      const root = row ? rootOf(row) : undefined;
      const p = (root?.parameters ?? {}) as Record<string, unknown>;
      if (p.justifyContent !== 'space-between') continue;
      splits += 1;
      const kids = (root?.children ?? []).map((id) => row?.nodes.find((n) => n.id === id)).filter(Boolean);
      const growers = kids.filter((k) => grows(k as { type: string; parameters?: Record<string, unknown> }));
      if (growers.length !== 1) {
        wrong.push(
          `${name}: ${growers.length} of ${kids.length} children grow — ` +
            `${kids.map((k) => `${k?.id}(${grows(k as never) ? 'grows' : 'fixed'})`).join(', ')}`
        );
      }
    }
    // A type this spec cannot reason about is a hole shaped like the defect.
    expect(unknownTypes).toEqual([]);
    expect(splits).toBe(2);
    expect(wrong).toEqual([]);
  });

  // ── §8 The document outline ──────────────────────────────────────────────
  //
  // 🔴 **Written because the tags had no gate at all, and the absence was not
  // visible from any suite.** REL-002c §7.4 measured the shipped artefact at
  // **0 semantic tags in 100 files** while every spec above it was green, and
  // the harness's own render-time reading agreed: 0 of 60 shots carried an `h1`
  // or an `h2`. §8 built them. Nothing here would have failed before that
  // change EXCEPT these four, which is the whole reason they exist — a later
  // edit to `pageHead()` or to the type ramp can return this template to a pile
  // of `<div>`s in one line, and the pictures cannot see it: **120 of 120 PNGs
  // were byte-identical across the change that added the tags.** A landmark is
  // invisible by design, so a picture is the wrong instrument and a census is
  // the right one.
  //
  // ⚠️ **Only `Group` and `Text` have an `as` port** (`group.ts`, `text.ts`);
  // `Columns`, `Image`, `Icon` and the rest have none, and `Text`'s enum is
  // `div|h1…h6|p|span` — the landmark names live on `Group` alone. §8.4 is what
  // holds that, because an `as` on any other type is a parameter nothing reads.

  /**
   * The predicate §8.1–§8.3 are all written in terms of, so a mutant can grade
   * the CHECK rather than the artefact — see §8.5.
   */
  const tagsIn = (nodes: readonly StoredNode[], tag: string): string[] =>
    nodes.filter((n) => (n.parameters ?? {}).as === tag).map((n) => n.id);

  /** The node type a page places to get the band — asserted OUT of `main` by §8.7. */
  const CHROME = '/Members/Chrome';

  /**
   * Is `childId` anywhere under `rootId`? A real walk down `children`, because
   * the defect §8.7 exists for is one level apart and a one-level check would
   * have passed on it.
   */
  const contains = (nodes: readonly StoredNode[], rootId: string | undefined, childId: string): boolean => {
    if (rootId === undefined) return false;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const seen = new Set<string>();
    const walk = (id: string): boolean =>
      (byId.get(id)?.children ?? []).some((c) => c === childId || (!seen.has(c) && (seen.add(c), walk(c))));
    return walk(rootId);
  };

  const pages = shipped.filter((c) => c.path.startsWith('/Pages/')).sort((a, b) => a.path.localeCompare(b.path));

  it('§8 every page declares exactly one h1, and there are thirteen pages', () => {
    expect(pages.length).toBe(13);
    const wrong = pages
      .map((c) => ({ page: c.path, h1: tagsIn(c.nodes, 'h1') }))
      .filter((r) => r.h1.length !== 1)
      .map((r) => `${r.page}: ${r.h1.length} h1 (${r.h1.join(', ') || 'none'})`);
    expect(wrong).toEqual([]);
  });

  /**
   * 🔴 **`/` needed a node of its own for this and `/join` did not**, which is
   * the one asymmetry in the outline. Both are built on `BAND_PAGE_GROUND`
   * rather than on `pageShell`, so neither has a `ground` to carry the landmark;
   * `/join`'s form band roots a `FORM_GROUND` and gets one anyway, and `/` had
   * nothing at all until `landingMain` was added. Without it the page a stranger
   * meets first put every word on it in no landmark.
   */
  it('§8 every page declares exactly one main', () => {
    const wrong = pages
      .map((c) => ({ page: c.path, main: tagsIn(c.nodes, 'main') }))
      .filter((r) => r.main.length !== 1)
      .map((r) => `${r.page}: ${r.main.length} main (${r.main.join(', ') || 'none'})`);
    expect(wrong).toEqual([]);
  });

  /**
   * The three landmarks a page does not own itself: they arrive with the parts
   * it places, so they are asserted where they are authored.
   *
   * ⚠️ **`nav` is on a wrapper Group, not on the node that draws the row.** The
   * band's nav is a `Columns`, which has no `as` port; REL-002b's `isSignedIn`
   * gate moved up onto that wrapper rather than being duplicated, so a
   * signed-out stranger gets no `<nav>` at all instead of an empty one.
   */
  it('§8 the chrome and the foot carry the three landmarks a page cannot own', () => {
    const chrome = byLegacyName.get('/Members/Chrome') as StoredComponent;
    const foot = byLegacyName.get('/Members/Footer') as StoredComponent;
    expect(tagsIn(chrome.nodes, 'header')).toEqual(['bar']);
    expect(tagsIn(chrome.nodes, 'nav')).toEqual(['navWrap']);
    expect(tagsIn(foot.nodes, 'footer')).toEqual(['footer']);

    // The gate the wrapper exists for: the landmark leaves the tree with its
    // contents rather than announcing navigation that is not there.
    const navWrap = chrome.nodes.find((n) => n.id === 'navWrap');
    expect(navWrap?.parameters?.mounted).toBe(false);
    expect(
      chrome.connections.some((w) => w.toId === 'navWrap' && w.toProperty === 'mounted')
    ).toBe(true);
  });

  it('§8 no node carries an `as` its type has no port for', () => {
    const stray = shipped
      .flatMap((c) => c.nodes.map((n) => ({ component: c.path, node: n })))
      .filter(({ node }) => 'as' in (node.parameters ?? {}))
      .filter(({ node }) => node.type !== 'Group' && node.type !== 'Text')
      .map(({ component, node }) => `${component} › ${node.id} (${node.type})`);
    expect(stray).toEqual([]);
  });

  /**
   * 🔴 **§8.7 — the landmark has to CONTAIN the heading, and for one session it
   * did not.** §8.1 and §8.2 are censuses: they count an `h1` and they count a
   * `main` and they are both satisfied by a page where the two are siblings —
   * which is exactly what §8 shipped. `pageHead()` roots the heading in
   * `headBand` (the eight chrome pages) or `heroBand` (the three door pages),
   * and s25 put `as: 'main'` on `PAGE_GROUND`, their sibling. **Twelve of the
   * thirteen pages declared a heading outside their own landmark**; only `/`
   * was right, and only because it had no ground to take the shortcut and was
   * given `landingMain` by hand. A reader who jumps to `main` landed after the
   * title of the page they jumped into.
   *
   * ⚠️ **The second half is the one a "fix" gets wrong.** The cheap way to make
   * the first half green is to move the landmark up to `pageBody`, which also
   * contains the `Chrome` instance — a `main` that swallows the site navigation.
   * So this asserts both directions: the heading is in, and the chrome is out.
   */
  it('§8.7 every page keeps its h1 INSIDE its main, and the chrome OUTSIDE it', () => {
    const inside = pages.map((c) => {
      const [h1] = tagsIn(c.nodes, 'h1');
      const [main] = tagsIn(c.nodes, 'main');
      return { page: c.path, h1, main, ok: h1 !== undefined && main !== undefined && contains(c.nodes, main, h1) };
    });
    expect(inside.filter((r) => !r.ok).map((r) => `${r.page}: h1 ${r.h1} is not inside main ${r.main}`)).toEqual([]);

    // The chrome is placed by the page, so the page is where it is asserted.
    const swallowed = pages
      .flatMap((c) =>
        c.nodes
          .filter((n) => n.type === CHROME)
          .filter((n) => contains(c.nodes, tagsIn(c.nodes, 'main')[0], n.id))
          .map((n) => `${c.path}: ${n.id} is inside main ${tagsIn(c.nodes, 'main')[0]}`)
      );
    expect(swallowed).toEqual([]);

    // 🔴 **Not vacuous, and the number is EIGHT.** REL-010 AC4 and REL-002c
    // §8.5 both say *"the nine chrome pages"*; the artefact says eight —
    // `/account`, `/announcements/{id}`, `/directory`, `/meetings`,
    // `/meetings/{id}`, `/members`, `/post` and `/requests`. Counted here so
    // the second assertion above cannot silently become an empty sweep.
    expect(pages.filter((c) => c.nodes.some((n) => n.type === CHROME)).length).toBe(8);
  });

  /**
   * 🔴 **CONTROL for §8.7, and it is a different predicate from `tagsIn`.**
   * `contains` walks `children`, and a walk that returned `true` for everything
   * — or one that only ever looked one level down — would pass §8.7 on the very
   * artefact that provoked it. So it is run over a hand-built tree whose answers
   * are known in both directions and at both depths.
   */
  it('§8.7 CONTROL — containment is a real walk, not a same-parent check', () => {
    const mutant = [
      { id: 'body', type: 'Group', children: ['chrome', 'main'] },
      { id: 'chrome', type: 'Group', children: [] },
      { id: 'main', type: 'Group', parameters: { as: 'main' }, children: ['band'] },
      { id: 'band', type: 'Group', children: ['head'] },
      { id: 'head', type: 'Text', parameters: { as: 'h1' } },
      { id: 'orphan', type: 'Text', parameters: { as: 'h1' } }
    ] as unknown as StoredNode[];
    // Two levels down is still inside.
    expect(contains(mutant, 'main', 'head')).toBe(true);
    // A sibling of the landmark is not — this is the shipped defect's shape.
    expect(contains(mutant, 'main', 'chrome')).toBe(false);
    // A node the walk never reaches is not, and neither is the root itself.
    expect(contains(mutant, 'main', 'orphan')).toBe(false);
    expect(contains(mutant, 'main', 'main')).toBe(false);
    expect(contains(mutant, 'missing', 'head')).toBe(false);
  });

  /**
   * 🔴 **CONTROL — it grades the PREDICATE, not the artefact.** The three specs
   * above are censuses over a shipped tree, and a census that counted the wrong
   * field would read clean on a template with no tags in it at all — which is
   * precisely the state this artefact was in one session ago. So `tagsIn` is run
   * against a hand-built mutant whose answer is known: it must find the tag that
   * is there, and must NOT find one that is merely spelled somewhere nearby.
   */
  it('§8 CONTROL — the census reads the `as` parameter, not a name that looks like one', () => {
    const mutant = [
      { id: 'real', type: 'Group', parameters: { as: 'main' } },
      // The two near-misses that would make the census a tautology: a node whose
      // ID is the tag name, and a node with the tag as some other parameter.
      { id: 'main', type: 'Group', parameters: { flexDirection: 'column' } },
      { id: 'decoy', type: 'Text', parameters: { text: 'main', label: 'main' } }
    ] as unknown as StoredNode[];
    expect(tagsIn(mutant, 'main')).toEqual(['real']);
    expect(tagsIn(mutant, 'h1')).toEqual([]);

    // And the same predicate, run over the artefact as the specs above run it,
    // is not vacuous: it finds one per page and thirteen in all.
    expect(pages.flatMap((c) => tagsIn(c.nodes, 'h1')).length).toBe(13);
  });
});
