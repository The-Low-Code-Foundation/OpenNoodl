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
import { ANNOUNCEMENT_ROW, MEETING_ROW, REQUEST_ROW, STANDING_COMPONENT } from './tpl001Components';
import { APP_COMPONENT, buildMembersTemplateProject, prepareArtefact, TEMPLATE_ID } from './tpl001Template';
import {
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_ASSOCIATION,
  COLLECTION_MEETING,
  COLLECTION_REQUEST,
  NO_ANNOUNCEMENTS_TEXT,
  NO_MEETINGS_TEXT,
  NO_REQUESTS_TEXT,
  PENDING_TEXT,
  ROLE_MEMBER,
  ROLE_MODERATOR,
  ROUTER,
  TPL001_COLLECTIONS,
  TPL001_FUNCTIONS
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
    // 19 components × 3 files, plus the registry, the project file and the policy.
    expect(committed.length).toBe(19 * 3 + 3);
    expect(committed).toContain('nodegx.project.json');
    expect(committed).toContain('nodegx.security.json');
    expect(committed).toContain(path.join('components', '_registry.json'));
    // The policy in the artefact IS the hand-authored file, byte for byte —
    // stated separately because it is the one file the door does not write.
    expect(fs.readFileSync(path.join(ARTEFACT, 'nodegx.security.json'), 'utf-8')).toBe(
      fs.readFileSync(POLICY_SOURCE, 'utf-8')
    );
  });

  it('control: the generation really ran — nineteen components, App first', async () => {
    // 🔴 Without this, the comparison above is satisfiable by two empty sets, and
    // a build that silently authored nothing would read as agreement.
    const built = await buildMembersTemplateProject();
    expect(built.order).toHaveLength(19);
    expect(built.order[0]).toBe(APP_COMPONENT);
    expect(shipped).toHaveLength(19);
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
    expect(pageComponents.length).toBe(10);
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
    expect(allNodes().filter(({ node }) => node.type === 'For Each').length).toBe(3);
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

// ── 3. The check the door does not do ────────────────────────────────────────

/**
 * 🔴 **Every connection that names a component instance resolves to a port that
 * component actually declares.**
 *
 * The door skips this entirely — measured, see the module header. And it is the
 * template's whole boundary: `Members/Standing`'s eight outputs are what reveal
 * content, reveal the moderator's tools, and trigger every query.
 */
describe('TPL-001 — component-instance ports resolve (the door checks none of this)', () => {
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
      ['Member', 'Moderator', 'Visitor', 'isMember', 'isModerator', 'isPending', 'isUnknown', 'standing'].sort()
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
    expect(deployed.sort()).toEqual([...TPL001_FUNCTIONS].sort());
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
    const membersOnly = allNodes().filter(
      ({ node }) =>
        node.type === 'DbCollection2' &&
        [COLLECTION_ANNOUNCEMENT, COLLECTION_MEETING, COLLECTION_REQUEST].includes(
          String(node.parameters?.collectionName)
        )
    );
    expect(membersOnly.length).toBe(3);
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

  it('🔴 and each one’s only trigger comes from the standing gate or a write it caused', () => {
    const rows: Array<{ where: string; triggers: string[] }> = [];
    for (const component of shipped) {
      const instanceIds = new Set(
        component.nodes.filter((n) => n.type === STANDING_COMPONENT).map((n) => n.id)
      );
      for (const node of component.nodes) {
        if (node.type !== 'DbCollection2') continue;
        const collection = String(node.parameters?.collectionName);
        if (![COLLECTION_ANNOUNCEMENT, COLLECTION_MEETING, COLLECTION_REQUEST].includes(collection)) continue;
        rows.push({ where: `${component.path} › ${node.id}`, triggers: triggersOf(component, node.id) });
        for (const wire of component.connections.filter((w) => w.toId === node.id && w.toProperty === 'storageFetch')) {
          const fromStanding = instanceIds.has(wire.fromId);
          // The only other legitimate trigger is a refetch after a write this
          // page caused, which cannot fire before a moderator used a screen they
          // were already cleared for.
          const fromRefresh = wire.fromProperty.startsWith('itemOutputSignal-');
          expect(`${component.path}:${wire.fromId}.${wire.fromProperty}:${fromStanding || fromRefresh}`).toBe(
            `${component.path}:${wire.fromId}.${wire.fromProperty}:true`
          );
        }
      }
    }
    // Every one of the three has at least one trigger — a query with none is a
    // list that is empty for ever, which is the failure in the other direction.
    expect(rows.filter((r) => r.triggers.length === 0)).toEqual([]);
    expect(rows).toHaveLength(3);
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

  it('🔴 no signal is wired straight into a `visible` port', () => {
    // A signal into a value port arrives once as `false` (one entry per input
    // name in the drain queue, so a true/false pair coalesces), so a reveal
    // wired that way never happens. Every one here goes through a `Condition`
    // or a JavaScript value output.
    const signalSources = new Set(['done', 'failure', 'unchanged', 'didMount', 'onClick', 'fetched', 'changed']);
    const offenders: string[] = [];
    for (const component of shipped) {
      for (const wire of component.connections) {
        if (wire.toProperty !== 'visible') continue;
        if (signalSources.has(wire.fromProperty)) {
          offenders.push(`${component.path} › ${wire.fromId}.${wire.fromProperty} → ${wire.toId}.visible`);
        }
      }
    }
    expect(offenders).toEqual([]);
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
      const empty = page.nodes.find((n) => n.type === 'Text' && n.parameters?.text === text);
      expect(`${pageName}:${empty?.parameters?.visible}`).toBe(`${pageName}:false`);
      // 🔴 …and it is revealed by a node that runs on `fetched`, never by
      // `isEmpty` — which is `true` before the first query has run, so binding it
      // straight through would tell a member with a full noticeboard that
      // nothing had been posted.
      const reveal = page.connections.find((w) => w.toId === empty?.id && w.toProperty === 'visible');
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
      const notice = page.nodes.find((n) => n.type === 'Text' && n.parameters?.text === PENDING_TEXT);
      expect(`${pageName}:${notice !== undefined}`).toBe(`${pageName}:true`);
      expect(String(notice?.parameters?.text)).toContain('moderators');
      expect(page.connections.some((w) => w.toId === notice?.id && w.fromProperty === 'isPending')).toBe(true);
    }
  });

  it('AC4 — the moderator’s screens gate their UI, and the write is refused server-side too', () => {
    for (const pageName of ['/Pages/Post', '/Pages/Requests']) {
      const page = byLegacyName.get(pageName) as StoredComponent;
      const gated = page.connections.filter((w) => w.fromProperty === 'isModerator' && w.toProperty === 'visible');
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
    expect(allNodes().filter(({ node }) => node.type === 'NewDbModelProperties').length).toBe(4);
  });
});

// ── 7. The cloud half's own invariants ───────────────────────────────────────

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
