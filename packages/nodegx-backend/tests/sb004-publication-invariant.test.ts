/**
 * SB-004 §7 — the publication invariant, on a real backend with enforcement on.
 *
 * This is the first thing in the phase that can say the invariant holds. Every
 * authoring run before it was green and none of them was evidence: the MCP door
 * returns `dynamic-port-skipped` over exactly the parameters that carry the
 * security model (`collectionName`, `acl-*`, `ptype-*`/`preq-*`), and says so —
 * the node is *"unverified by that check rather than verified as correct"*.
 *
 * ## The two conditions that make this a measurement
 *
 * 🔴 **`devOpen: false`.** `devOpenActive` appears in exactly one decision —
 * `SecurityState.aclFor` returns `undefined` (`state.ts:286-287`), disabling
 * **row-level ACL** — and `checkClp` has no such branch. So a default local
 * backend refuses an anonymous caller through collection permissions, which
 * *looks* like enforcement, while the published/draft boundary, which is
 * entirely ACL, is never exercised at all. Worse, it inverts under this
 * template's own §4 config: with `Page.find: 'public'` there is nothing left to
 * refuse, and a loopback backend then serves every draft to anybody. The suite
 * asserts `started.security.enforced === true` before it asserts anything else,
 * so "the ACLs held" can never be a reading taken with the ACLs switched off.
 *
 * 🔴 **The components are the ones the MCP door wrote.** Authored here through
 * the real server (`noodl-mcp/src/server`, `create_component`), read back off
 * disk and converted by the editor's own importer — see `helpers/authored-bundle.ts`.
 * A hand-written twin would measure a copy and leave the artefact untested,
 * which is §7 acceptance 8 and `measure-the-artefact-before-believing-the-task-file`.
 *
 * ## What running it found, and neither door could
 *
 *  1. **A `JavaScriptFunction`'s custom signal outputs are dead once deployed**
 *     unless the graph declares them as ports. The derivation that mints them
 *     from the script lives behind `context.editorConnection.isRunningLocally()`,
 *     so it never runs on a backend. `claimSite` threw `Outputs.ok is not a
 *     function`, no Response was reached, and the request 504'd after thirty
 *     seconds.
 *  2. **A signal is not a promise that the values beside it have arrived.** A
 *     code node triggered by `Query Records.fetched` saw its inputs appear one
 *     per update pass over three runs. `claimSite`'s gate therefore decided on
 *     an empty token and refused a *correct* one — in the refusal message that
 *     is deliberately indistinguishable from a wrong token.
 *
 * Both are recorded on the components themselves (`sb004Components.ts`, the two
 * rules at the top) and both are graded here: the first by the deploy asserting
 * the ports are on disk, the second by `claimSite` being driven with the token
 * that must work.
 *
 * ⚠️ **The invariant is read from the OUTSIDE.** A cloud function runs with
 * `masterKey` (`service.ts:490-500`) and its own writes bypass both layers, so
 * every assertion about who may see what is made by an anonymous or a
 * non-admin caller over HTTP — never from the function's own view.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../noodl-mcp/src/server';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient, adminHeaders } from './helpers/http';

jest.setTimeout(180000);

const SETUP_TOKEN = 'sb004-setup-token-4f2a91';
const CONTACT_TO = 'owner@example.invalid';

/**
 * SB-004 §4, verbatim, as the file that ships with the template.
 *
 * `role:<name>` is available at the collection layer, so the writes say
 * `role:admin` directly rather than leaning on the ACL to finish the job. The
 * row-level ACL is still load-bearing and not redundant: it is what separates
 * *published from draft* on the public read path, which no collection rule can
 * express — and it is the layer this suite exists to exercise.
 */
const SITE_SECURITY = {
  version: 1,
  devOpen: false,
  defaults: {
    permissions: {
      find: 'authenticated',
      get: 'authenticated',
      create: 'authenticated',
      update: 'authenticated',
      delete: 'authenticated'
    },
    // Off: `creatorOwns` would write a per-creator ACL over the one the graph
    // sets, and the graph's ACL *is* the publication state (§3).
    creatorOwns: false
  },
  collections: {
    Page: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    Section: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    Theme: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    SiteSettings: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    ContactMessage: {
      permissions: { find: 'role:admin', get: 'role:admin', create: 'nobody', update: 'role:admin', delete: 'nobody' }
    }
  },
  functions: {
    publishPage: { call: 'role:admin' },
    duplicatePage: { call: 'role:admin' },
    // SBR-007 AC2. Reordering is an admin act on an admin's own page — the same
    // policy publish and duplicate carry, and the reason the drive below can
    // assert a 403 for an outsider at all.
    reorderSection: { call: 'role:admin' },
    submitContactForm: { call: 'public' },
    claimSite: { call: 'authenticated' }
  },
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

/** §3's two ACL states, as a record on the wire carries them. */
const DRAFT_ACL = { 'role:admin': { read: true, write: true } };

/**
 * Author all seven components through the real MCP server and return the
 * project directory they were written into.
 *
 * `createServer` from `src`, not the built dist: the dist on a developer
 * machine can be days old (SB-004 §6 F4 measured one that predated the cloud
 * support this whole phase added), and authoring through it would exercise code
 * that is not the code under test.
 */
async function authorSb004(): Promise<string> {
  const fixture = path.join(__dirname, '..', '..', 'noodl-mcp', 'tests', 'fixtures', 'demo-app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb004-authored-'));
  fs.cpSync(fixture, dir, { recursive: true });

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sb004-run', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  for (const component of SB004_COMPONENTS) {
    const res = (await client.callTool({
      name: 'create_component',
      arguments: { path: component.path, nodes: component.nodes, connections: component.connections }
    })) as { isError?: boolean; content: Array<{ type: string; text: string }> };
    // A rejection here is evidence, not a mystery — print what the door said.
    if (res.isError) throw new Error(`create_component ${component.path} refused:\n${res.content?.[0]?.text}`);
  }

  await client.close();
  await server.close();
  return dir;
}

/** A data directory with the template's policy in it, ready to `start()`. */
function makeDataDir(bundle: WorkflowBundle, secrets: Record<string, string>): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb004-data-'));
  fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'workflows', 'site.workflow.json'), JSON.stringify(bundle));
  // ⚠️ Written BEFORE start(): `SecurityState` reads it in its constructor, and
  // a config applied afterwards would leave the boot running dev-open.
  fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(SITE_SECURITY));
  fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: secrets }));
  return dataDir;
}

interface Session {
  id: string;
  token: string;
  username: string;
}
interface Row {
  objectId: string;
  ACL?: Record<string, { read?: boolean; write?: boolean }>;
  published?: boolean;
  publishedAt?: string | null;
  title?: string;
  slug?: string;
  kind?: string;
  order?: number;
  pageId?: string;
  [key: string]: unknown;
}

/** What one owner-claim-then-outsider-claim run yields — SB-013's arms below. */
interface ClaimReading {
  /** What the FIRST claim answered. `undefined` is a claimed site telling nobody. */
  claimed: unknown;
  settings: number;
  themes: number;
  /** The second claim's answer — deliberately the same string as a wrong token. */
  secondAnswer: string;
  /** 🔴 The only reading that separates a refusal from a refusal-shaped breach. */
  outsiderIsAdmin: boolean;
  admins: number;
}

describe('SB-004 §7 — the publication invariant on a real backend', () => {
  let projectDir: string;
  let bundle: WorkflowBundle;
  let dataDir: string;
  let service: BackendService;
  let base = '';

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });

  let owner: Session;
  let outsider: Session;
  let seq = 0;

  async function signup(prefix: string): Promise<Session> {
    const username = `${prefix}-${++seq}`;
    const res = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username,
      password: `pw-${username}`
    });
    expect(res.status).toBe(201);
    return { id: res.json.objectId, token: res.json.sessionToken, username };
  }

  /** A row as the site owner writes it — the admin panel's path, over the wire. */
  const createAsAdmin = (className: string, body: Record<string, unknown>) =>
    client.post<Row>(`/classes/${className}`, { ACL: DRAFT_ACL, ...body }, asUser(owner));

  /** A page and its sections, all born drafts (§3). */
  async function makeDraftPage(title: string, slug: string, sectionKinds: string[]): Promise<{ page: string; sections: string[] }> {
    const page = await createAsAdmin('Page', { title, slug, published: false, showInNav: true, navOrder: 1 });
    expect(page.status).toBe(201);
    const sections: string[] = [];
    for (const [i, kind] of sectionKinds.entries()) {
      const section = await createAsAdmin('Section', {
        kind,
        order: i,
        data: { text: `${title} / ${kind}` },
        // 🔴 A plain String, not a Pointer. §2's unhedged bet was the Pointer and
        // §7's run is where it lost — see the last describe in this file, which
        // is the measurement rather than the assertion. A Pointer column is
        // written correctly and cannot be FILTERED from a cloud function, and it
        // fails by returning every row.
        pageId: page.json.objectId
      });
      expect(section.status).toBe(201);
      sections.push(section.json.objectId);
    }
    return { page: page.json.objectId, sections };
  }

  const readAsAdmin = (className: string, id: string) =>
    client.get<Row>(`/classes/${className}/${id}`, asUser(owner));
  const readAnonymously = (className: string, id: string) => client.get<Row>(`/classes/${className}/${id}`);

  beforeAll(async () => {
    projectDir = await authorSb004();
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO });
    service = new BackendService({ dataDir, port: 0, backendId: 'sb004', backendName: 'SB-004 site' });
    const started = await service.start();
    base = started.listen.url;

    // 🔴 The assertion that makes F2's trap visible rather than assumed. Without
    // it every ACL claim below would be a reading taken with row-level ACL off.
    expect(started.security.enforced).toBe(true);

    owner = await signup('owner');
    outsider = await signup('outsider');
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 0. What was deployed — the artefact, not a paraphrase of it
  // ==========================================================================

  describe('the deployed bundle is what the door wrote', () => {
    // 🔴 The list is DERIVED on both sides, so this cannot drift into checking a
    // subset — which is what makes every drive below a reading about the whole
    // authored set. Seven at SB-004; nine since SBR-007 AC2 added
    // `reorderSection` and `site/SetSectionOrder`.
    it('carries every authored component under its cloud name', () => {
      expect(bundle.components.map((c) => c.name).sort()).toEqual(
        SB004_COMPONENTS.map((c) => c.legacyName).sort()
      );
    });

    it('gives each helper the component ports its Component Inputs/Outputs nodes declare', () => {
      // The bridge derives these from the interface nodes and INVERTS the plug.
      // With them missing, Run Tasks reports `run-tasks/no-completion-output` and
      // the request hangs rather than failing (CWF-018) — so this is the
      // assertion that keeps the conversion honest.
      const worker = bundle.components.find((c) => c.name === '/#__cloud__/site/SetSectionAccess');
      expect(worker).toBeDefined();
      const byPlug = (plug: string) =>
        worker!.ports.filter((p) => p.plug === plug).map((p) => p.name).sort();
      expect(byPlug('input')).toEqual(['Do', 'isPublic', 'objectId']);
      expect(byPlug('output')).toEqual(['Failure', 'Success']);
    });

    it('🔴 declares every custom JavaScript signal output as a port', () => {
      // Finding 1. `Outputs.x()` is a call, and it resolves only if `out-x` is on
      // the node model as a signal. The editor derives these by parsing the
      // script; that derivation is editor-only, so a graph the MCP door wrote
      // carries whatever the author declared and nothing else. Undeclared, the
      // script throws mid-run, no Response is reached, and the caller waits out
      // the thirty-second timeout.
      //
      // Asserted against the SCRIPT rather than a fixed list, so a future author
      // who adds a signal and forgets its port gets a red here rather than a
      // 504 in a deploy.
      const missing: string[] = [];
      for (const component of bundle.components) {
        for (const node of component.nodes as Array<{
          id: string;
          type: string;
          ports?: Array<{ name: string; plug?: string; type?: unknown }>;
          parameters?: Record<string, unknown>;
        }>) {
          if (node.type !== 'JavaScriptFunction') continue;
          const script = String(node.parameters?.functionScript ?? '');
          const declared = new Set((node.ports ?? []).map((p) => p.name));
          for (const match of script.matchAll(/Outputs\.([A-Za-z0-9_]+)\s*\(/g)) {
            if (!declared.has(`out-${match[1]}`)) missing.push(`${component.name}#${node.id}:${match[1]}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });

    it('404s every helper as a function name, and answers on every endpoint', async () => {
      // SB-003's boundary, at run time rather than in the authored shape.
      for (const helper of ['site/SetSectionAccess', 'site/CopySectionToPage', 'site/ContactRecipient']) {
        const res = await client.post(`/functions/${helper}`, {}, asUser(owner));
        expect(`${helper}:${res.status}`).toBe(`${helper}:404`);
      }
      // An endpoint that exists but refuses is a 403, not a 404 — the difference
      // between "no such function" and "not for you".
      const refused = await client.post('/functions/publishPage', { pageId: 'x', publish: true }, asUser(outsider));
      expect(refused.status).toBe(403);
    });
  });

  // ==========================================================================
  // 1. claimSite — acceptance 9. Nothing else can run until this does.
  // ==========================================================================

  describe('claimSite mints the first admin (acceptance 9)', () => {
    it('refuses an anonymous caller before it refuses anything else', async () => {
      const res = await client.post('/functions/claimSite', { setupToken: SETUP_TOKEN });
      expect(res.status).toBe(403);
    });

    it('refuses a wrong token, and grants nothing', async () => {
      const res = await client.post('/functions/claimSite', { setupToken: 'not-the-token' }, asUser(owner));
      expect(res.json).toEqual({ error: 'This site cannot be claimed.' });

      // ⚠️ The half that makes this a refusal test: a 400 that arrived after the
      // grant would still be a breach.
      const roles = await client.get<{ roles: Array<{ name: string }> }>('/admin/roles', adminHeaders(dataDir));
      expect(roles.json.roles.map((r) => r.name)).not.toContain('admin');
    });

    it('🔴 accepts the right token, creates `admin` in-graph, and puts the CALLER in it', async () => {
      const res = await client.post<{ result?: { claimed?: boolean } }>(
        '/functions/claimSite',
        { setupToken: SETUP_TOKEN },
        asUser(owner)
      );
      expect(res.status).toBe(200);
      expect(res.json.result?.claimed).toBe(true);

      // F7 closed, measured: `role:admin` is a `_Role` row and nothing in the
      // backend seeds one. `Add User To Role`'s `Create Role If Missing` did it,
      // with no admin token and no `/admin/*` call anywhere in the graph.
      const roles = await client.get<{ roles: Array<{ name: string; users: string[] }> }>(
        '/admin/roles',
        adminHeaders(dataDir)
      );
      const admin = roles.json.roles.find((r) => r.name === 'admin');
      expect(admin).toBeDefined();
      // The grantee is the session the backend resolved, never a parameter.
      expect(admin!.users).toEqual([owner.id]);

      // And it is a real membership: a rule that says `role:admin` now lets the
      // owner through where it refused them a moment ago.
      const allowed = await client.post('/functions/duplicatePage', { pageId: 'nope' }, asUser(owner));
      expect(allowed.status).not.toBe(403);
    });

    /**
     * 🔴 SB-013 and SB-014 — the two assertions this suite did not have, and
     * both were wrong before s10 fixed the graph.
     *
     * Five mutants graded `claimSite` here and none could see either: they
     * asserted the role, the ACL and every refusal path, and never COUNTED. One
     * claim left **two** `SiteSettings` rows (SB-008 F21) and **no** `Theme` row
     * at all (F20), so the panel's two singleton editors were editing one row of
     * two that nothing orders, and one row that did not exist.
     */
    it('🔴 writes exactly ONE of each singleton (SB-013, SB-014)', async () => {
      const settings = await client.get<{ results: Row[] }>('/classes/SiteSettings', asUser(owner));
      expect(`SiteSettings rows:${settings.json.results.length}`).toBe('SiteSettings rows:1');

      const themes = await client.get<{ results: Row[] }>('/classes/Theme', asUser(owner));
      expect(`Theme rows:${themes.json.results.length}`).toBe('Theme rows:1');

      // …and the theme row is the one the editor can actually write to: its id
      // is what `theme.firstItemId` yields, which was `undefined` on the empty
      // collection and made Save write nowhere and say nothing.
      expect(themes.json.results[0].objectId).toBeTruthy();
      // The seeded tokens are the twelve keys `buildTokens` writes (SBR-003's
      // `THEME_TOKEN_FIELDS` contract), all empty — the same state as an author
      // saving the form with every field blank, so seeding decides no palette
      // and `applyTheme` overrides nothing. (A literal rather than an import:
      // this package's tests only `require` JSON from the editor tree;
      // `sb004Authoring.test.ts` is where the seed is bound to the contract.)
      expect(themes.json.results[0].tokens).toEqual({
        colorPrimary: '',
        colorOnPrimary: '',
        colorBackground: '',
        colorSurface: '',
        colorText: '',
        colorTextSoft: '',
        colorBorder: '',
        colorAccentSoft: '',
        radius: '',
        fontDisplay: '',
        fontUi: '',
        measure: ''
      });
      // 🔴 And it is world-readable, because the PUBLIC site reads the theme
      // with no session. A row created with no rules would read as public today
      // (`model.ts:701-718`) and stop doing so the moment a default arrives.
      expect(themes.json.results[0].ACL).toEqual({
        'role:admin': { read: true, write: true },
        '*': { read: true, write: false }
      });
    });

    it('refuses a second claim, with the same answer as a wrong token', async () => {
      const again = await client.post('/functions/claimSite', { setupToken: SETUP_TOKEN }, asUser(outsider));
      expect(again.json).toEqual({ error: 'This site cannot be claimed.' });

      // ⚠️ The point of one message: a caller must not be able to tell "already
      // claimed" from "wrong token", or this endpoint answers "is this site
      // claimed yet?" to anyone who asks.
      const wrong = await client.post('/functions/claimSite', { setupToken: 'still-wrong' }, asUser(outsider));
      expect(wrong.json).toEqual(again.json);
      expect(wrong.status).toBe(again.status);

      const roles = await client.get<{ roles: Array<{ name: string; users: string[] }> }>(
        '/admin/roles',
        adminHeaders(dataDir)
      );
      expect(roles.json.roles.find((r) => r.name === 'admin')!.users).toEqual([owner.id]);
    });
  });

  // ==========================================================================
  // 2. The classes, and a draft born with its ACL — acceptance 1 and 2
  // ==========================================================================

  describe('the classes exist by first write, and a draft is born admin-only', () => {
    let draft: { page: string; sections: string[] };

    beforeAll(async () => {
      draft = await makeDraftPage('About us', 'about', ['hero', 'richText']);
    });

    it('created every class on first write, with no migration step anywhere', async () => {
      // Acceptance 1. `_ensureTable` auto-creates on create/save/query and
      // `create` adds a column per unknown key — so the template ships no schema
      // step, and the evidence is that these rows exist at all.
      const schema = await client.get<{ tables: Array<{ name: string }> }>('/admin/schema', adminHeaders(dataDir));
      const names = schema.json.tables.map((t) => t.name);
      // `SiteSettings` is here because `claimSite` wrote the singleton, and
      // `Page`/`Section` because the owner wrote a draft — three classes that
      // no migration, no schema step and no `ensureImportShape` ever touched.
      for (const className of ['Page', 'Section', 'SiteSettings']) {
        expect(names).toContain(className);
      }
    });

    it('typed `Section.pageId` as a String — the field the filter can actually use', async () => {
      // SB-004 §2's one unhedged bet, settled. `inferColumnType` reads
      // `__type === 'Pointer'`; a bare id string would have made a String column,
      // after which `pointsTo` refuses for want of a `targetClass` — loudly, but
      // only at run time, which is why authoring could not answer this.
      const schema = await client.get<{ columns: Array<{ name: string; type: string }> }>(
        '/admin/schema/Section',
        adminHeaders(dataDir)
      );
      // Every column here was created by `_ensureTable` + `inferColumnType` on
      // the first write. `data` typed as `Object` is the one that matters after
      // `pageId`: §2 keeps the kind-specific payload in one column precisely
      // because the section shapes have nothing in common.
      expect(schema.json.columns.map((c) => `${c.name}:${c.type}`).sort()).toEqual([
        'data:Object',
        'kind:String',
        'order:Number',
        'pageId:String'
      ]);
    });

    it('a fresh draft is invisible to the world, page and sections alike', async () => {
      // Acceptance 2, and it is the assertion `devOpen: true` cannot make: with
      // `Page.find`/`get` public at the collection layer there is nothing left
      // for CLP to refuse, so a 404 here is the ROW-level ACL and nothing else.
      expect((await readAnonymously('Page', draft.page)).status).toBe(404);
      for (const section of draft.sections) {
        expect((await readAnonymously('Section', section)).status).toBe(404);
      }
      // A signed-in stranger is no better off — this is a permission boundary,
      // not a login wall.
      expect((await client.get(`/classes/Page/${draft.page}`, asUser(outsider))).status).toBe(404);

      // The control: the admin CAN see it, so the 404s above are about the
      // caller and not about the row being absent.
      expect((await readAsAdmin('Page', draft.page)).status).toBe(200);
    });

    it('carries the admin rule explicitly rather than relying on an absent ACL', async () => {
      // 🔴 `canAccessRecord` reads an ABSENT ACL as public. A row created with no
      // rules is world-readable from the instant `find` goes public, so "no
      // world rule" and "no ACL" are opposite states that look alike in a listing.
      const page = await readAsAdmin('Page', draft.page);
      expect(page.json.ACL).toEqual(DRAFT_ACL);
    });
  });

  // ==========================================================================
  // 3. publishPage — acceptance 3, and the F5 control beside it
  // ==========================================================================

  describe('publishPage moves the ACL and the mirror together (acceptance 3)', () => {
    let target: { page: string; sections: string[] };
    let bystander: { page: string; sections: string[] };

    const publish = (pageId: string, value: boolean) =>
      client.post<{ result?: Record<string, unknown> }>(
        '/functions/publishPage',
        { pageId, publish: value },
        asUser(owner)
      );

    beforeAll(async () => {
      target = await makeDraftPage('Services', 'services', ['hero', 'richText', 'cta']);
      // 🔴 The control F5 exists for. The publish flow's section query carried no
      // filter when it was first authored, so publishing one page would have
      // flipped the access rules on every Section in the site. An assertion that
      // only looks at the published page cannot see that; this one can.
      bystander = await makeDraftPage('Secret plans', 'secret', ['hero', 'richText']);
    });

    it('answers with a body rather than a bare 200', async () => {
      const res = await publish(target.page, true);
      expect(res.status).toBe(200);
      // The other half of F5: a Response declaring parameters and wiring none
      // answers `{}`, and every assertion about the ACL would still pass.
      expect(res.json.result).toEqual({ pageId: target.page, published: true });
    });

    it('opens the page AND every one of its sections to the world', async () => {
      const page = await readAsAdmin('Page', target.page);
      expect(page.json.ACL).toEqual({ ...DRAFT_ACL, '*': { read: true, write: false } });

      for (const section of target.sections) {
        const row = await readAsAdmin('Section', section);
        expect(row.json.ACL).toEqual({ ...DRAFT_ACL, '*': { read: true, write: false } });
      }

      // Read from the outside, which is the only reading that means anything —
      // an anonymous visitor with no session at all.
      expect((await readAnonymously('Page', target.page)).status).toBe(200);
      for (const section of target.sections) {
        expect((await readAnonymously('Section', section)).status).toBe(200);
      }
    });

    it('moved the queryable mirror with it, and the two agree', async () => {
      // §3: `published` exists for the admin panel, which can read both states
      // and needs to tell them apart. It is a mirror, and the spec that matters
      // is that it never disagrees with the enforced state.
      const page = await readAsAdmin('Page', target.page);
      expect(page.json.published).toBe(true);
      expect(!!page.json.ACL?.['*']?.read).toBe(page.json.published);
    });

    it('🔴 left every OTHER page and section exactly where they were', async () => {
      expect((await readAnonymously('Page', bystander.page)).status).toBe(404);
      for (const section of bystander.sections) {
        expect((await readAnonymously('Section', section)).status).toBe(404);
        expect((await readAsAdmin('Section', section)).json.ACL).toEqual(DRAFT_ACL);
      }
    });

    it('unpublishes: the same graph, driven by a boolean, closes both again', async () => {
      // The reason `acl-world-read` is a WIRED port rather than a parameter —
      // one graph, not two code paths.
      const res = await publish(target.page, false);
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ pageId: target.page, published: false });

      const page = await readAsAdmin('Page', target.page);
      expect(page.json.published).toBe(false);
      expect(page.json.ACL?.['*']?.read).toBeFalsy();
      expect((await readAnonymously('Page', target.page)).status).toBe(404);

      for (const section of target.sections) {
        expect((await readAnonymously('Section', section)).status).toBe(404);
      }
    });

    it('refuses a non-admin caller, and changes nothing when it does', async () => {
      await publish(target.page, true);
      const denied = await client.post(
        '/functions/publishPage',
        { pageId: target.page, publish: false },
        asUser(outsider)
      );
      expect(denied.status).toBe(403);
      // Still published: the refusal arrived before the write, not after it.
      expect((await readAnonymously('Page', target.page)).status).toBe(200);
    });
  });

  // ==========================================================================
  // 4. duplicatePage — acceptance 4
  // ==========================================================================

  describe('duplicatePage copies a page into a draft (acceptance 4)', () => {
    let source: { page: string; sections: string[] };
    let copyId: string;

    beforeAll(async () => {
      source = await makeDraftPage('Pricing', 'pricing', ['hero', 'cta']);
      // Published on purpose: the copy must come back a draft even when its
      // source is public, which is the assertion that separates "copied the
      // fields" from "copied the publication state".
      await client.post('/functions/publishPage', { pageId: source.page, publish: true }, asUser(owner));

      const res = await client.post<{ result?: { pageId?: string } }>(
        '/functions/duplicatePage',
        { pageId: source.page },
        asUser(owner)
      );
      expect(res.status).toBe(200);
      copyId = String(res.json.result?.pageId);
      expect(copyId).toMatch(/\S/);
      expect(copyId).not.toBe(source.page);
    });

    it('produces a DRAFT copy, admin-only, with the mirror cleared', async () => {
      const copy = await readAsAdmin('Page', copyId);
      expect(copy.status).toBe(200);
      expect(copy.json.published).toBe(false);
      expect(copy.json.ACL).toEqual(DRAFT_ACL);
      expect((await readAnonymously('Page', copyId)).status).toBe(404);
    });

    it('carries the fields over and renames the copy so it cannot collide', async () => {
      const copy = await readAsAdmin('Page', copyId);
      expect(copy.json.title).toBe('Copy of Pricing');
      expect(String(copy.json.slug)).toMatch(/^pricing-copy-[a-z0-9]{6}$/);
    });

    it('copies the sections onto the NEW page, each one a draft', async () => {
      // Read every Section and select here: the graph's own filter is exercised
      // by publishPage above, on the run that proves it narrows to one page.
      const all = await client.get<{ results: Row[] }>('/classes/Section?limit=1000', asUser(owner));
      expect(all.status).toBe(200);
      const pointsAt = (row: Row, pageId: string) => row.pageId === pageId;
      const copied = all.json.results.filter((r) => pointsAt(r, copyId));

      expect(copied).toHaveLength(source.sections.length);
      expect(copied.map((r) => r.kind).sort()).toEqual(['cta', 'hero']);
      // The copies are new rows, not the originals repointed.
      expect(copied.map((r) => r.objectId).some((id) => source.sections.includes(id))).toBe(false);
      for (const row of copied) {
        expect(row.ACL).toEqual(DRAFT_ACL);
        expect((await readAnonymously('Section', row.objectId)).status).toBe(404);
      }
      // And the source still has its own, still published.
      expect(all.json.results.filter((r) => pointsAt(r, source.page))).toHaveLength(source.sections.length);
    });

    it('left the published source alone', async () => {
      expect((await readAnonymously('Page', source.page)).status).toBe(200);
      expect((await readAsAdmin('Page', source.page)).json.title).toBe('Pricing');
    });
  });

  // ==========================================================================
  // 5. submitContactForm — acceptance 5
  // ==========================================================================

  describe('submitContactForm takes a message from a visitor with no session (acceptance 5)', () => {
    it('answers an anonymous caller and records the enquiry', async () => {
      const res = await client.post<{ result?: Record<string, unknown> }>('/functions/submitContactForm', {
        name: 'A visitor',
        email: 'visitor@example.invalid',
        message: 'Do you take on small jobs?',
        pageSlug: 'services'
      });
      expect(res.status).toBe(200);

      const found = await client.get<{ results: Row[] }>('/classes/ContactMessage', asUser(owner));
      expect(found.status).toBe(200);
      const row = found.json.results.find((r) => r.email === 'visitor@example.invalid');
      expect(row).toBeDefined();
      expect(row!.message).toBe('Do you take on small jobs?');
      expect(row!.handled).toBe(false);
    });

    it('🔴 is the ONLY door to that class: nobody may write one directly', async () => {
      // §4's `create: 'nobody'` — the function bypasses both layers because it
      // runs as system, and that is exactly why the direct door must be shut.
      const asVisitor = await client.post('/classes/ContactMessage', {
        name: 'bot',
        email: 'bot@example.invalid',
        message: 'x'
      });
      expect(asVisitor.status).toBe(403);
      // Not even the site owner, who is an admin everywhere else in this table.
      const asOwner = await client.post(
        '/classes/ContactMessage',
        { name: 'owner', email: 'o@example.invalid', message: 'x' },
        asUser(owner)
      );
      expect(asOwner.status).toBe(403);
    });

    it('keeps the enquiries admin-only', async () => {
      expect((await client.get('/classes/ContactMessage')).status).toBe(403);
      expect((await client.get('/classes/ContactMessage', asUser(outsider))).status).toBe(403);
    });
  });

  // ⚠️ **Placed last on purpose, and the reason is a defect rather than tidiness.**
  // Run BEFORE the `duplicatePage` block, this drive makes that block fail four
  // runs in five with `run-tasks/already-running` on duplicatePage's OWN node —
  // state left behind by an earlier request, because a cloud function's graph is
  // shared across requests. It is not call volume: ten `publishPage` calls and
  // seven `submitContactForm` calls in the same slot are green five times out of
  // five, and only this endpoint's traffic provokes it. Recorded as **D24**,
  // unowned, with those controls. Ordering keeps this gate honest meanwhile —
  // it does not fix anything, and D24 is the thing to fix.
  // ==========================================================================
  // 3b. reorderSection — SBR-007 AC2, the half a browser cannot do
  // ==========================================================================

  /**
   * 🔴 **This is AC2's evidence, and the authoring side could not be.**
   * `sb007Template.test.ts` can say the graph is shaped right; only a run can
   * say `order` moved. The endpoint exists because reordering renumbers
   * SIBLINGS: a `SectionRow` is a `For Each` template that knows its own id and
   * nothing about the row above it, and the browser runtime has no loop node.
   *
   * Every reading below is taken from the STORED rows, never from the answer —
   * the response says where the function thinks it put things, and that is the
   * claim under test rather than the evidence for it.
   */
  describe('reorderSection renumbers the siblings a browser cannot reach (SBR-007 AC2)', () => {
    let target: { page: string; sections: string[] };
    let bystander: { page: string; sections: string[] };

    const reorder = (pageId: string, sectionId: string, toIndex: number, as: Session = owner) =>
      client.post<{ result?: Record<string, unknown> }>(
        '/functions/reorderSection',
        { pageId, sectionId, toIndex },
        asUser(as)
      );

    /** The stored order of a page's sections, as ids, low `order` first. */
    async function storedOrder(of: { sections: string[] }): Promise<string[]> {
      const rows = await Promise.all(
        of.sections.map(async (id) => ({ id, order: (await readAsAdmin('Section', id)).json.order as number }))
      );
      return rows.sort((a, b) => a.order - b.order).map((r) => r.id);
    }

    beforeAll(async () => {
      // Three sections, born `order` 0/1/2 — AC2's own sentence is "from position
      // 3 to 1", so three is the smallest list that can express it.
      target = await makeDraftPage('Team', 'team', ['hero', 'richText', 'cta']);
      // 🔴 The same control F5 exists for, and it is not decoration here either:
      // this endpoint runs a filtered query and then WRITES to every row it came
      // back with. An unfiltered one would renumber the whole site, and an
      // assertion that only reads the target page cannot see that.
      bystander = await makeDraftPage('Careers', 'careers', ['hero', 'richText']);
    });

    it('CONTROL: the page starts in the order it was created in', async () => {
      // Without this, "the order changed" could be read off a page that was
      // never in the order the next test assumes it moved from.
      expect(await storedOrder(target)).toEqual(target.sections);
      expect(await storedOrder(bystander)).toEqual(bystander.sections);
    });

    it('🔴 AC2: the third section moves to the first, in the STORED rows', async () => {
      const [first, second, third] = target.sections;
      const res = await reorder(target.page, third, 0);
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ sectionId: third, order: 0 });

      // The reading that is actually AC2: what a visitor's query would return.
      expect(await storedOrder(target)).toEqual([third, first, second]);
    });

    it('renumbered CONTIGUOUSLY from zero, which is what makes a next move safe', async () => {
      // The endpoint writes each row its INDEX, so `order` is 0..n-1 afterwards
      // however gapped it was before. The browser's planners rely on positions
      // rather than on this — but a template whose numbers drift apart forever
      // would be a different artefact after every move.
      const orders = await Promise.all(
        target.sections.map(async (id) => (await readAsAdmin('Section', id)).json.order as number)
      );
      expect(orders.slice().sort()).toEqual([0, 1, 2]);
    });

    it('🔴 left every OTHER page exactly where it was', async () => {
      expect(await storedOrder(bystander)).toEqual(bystander.sections);
      const orders = await Promise.all(
        bystander.sections.map(async (id) => (await readAsAdmin('Section', id)).json.order as number)
      );
      expect(orders).toEqual([0, 1]);
    });

    it('moves back down again — one graph, driven by the index', async () => {
      const [first, second, third] = target.sections;
      const res = await reorder(target.page, third, 2);
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ sectionId: third, order: 2 });
      expect(await storedOrder(target)).toEqual([first, second, third]);
    });

    it('a move to where it already is answers rather than hanging', async () => {
      // 🔴 The empty-task-list path, and it is a real risk rather than a
      // hypothetical: this graph answers from `RunTasks.done`, and a node that
      // reported nothing for an empty list would leave the request with no exit
      // at all — a thirty-second 504, which is the SBR-015 shape. `Run Tasks`
      // fires `Done` on an empty list on purpose (`runtasks.ts:664-668`), and
      // this is the assertion that the purpose holds end to end.
      const before = await storedOrder(target);
      const res = await reorder(target.page, target.sections[0], 0);
      expect(res.status).toBe(200);
      expect(await storedOrder(target)).toEqual(before);
    });

    it('clamps an index past the end instead of refusing or corrupting', async () => {
      const [first, second, third] = target.sections;
      const res = await reorder(target.page, first, 99);
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ sectionId: first, order: 2 });
      expect(await storedOrder(target)).toEqual([second, third, first]);

      // Put it back, so the cases after this one start where they think they do.
      await reorder(target.page, first, 0);
      expect(await storedOrder(target)).toEqual([first, second, third]);
    });

    it('refuses a section that belongs to another page, and writes nothing', async () => {
      // The `plan` node throws on purpose here. Without the `failure` edge that
      // throw would be a silent 504 — SBR-015's whole subject.
      const before = await storedOrder(target);
      const res = await reorder(target.page, bystander.sections[0], 0);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await storedOrder(target)).toEqual(before);
      expect(await storedOrder(bystander)).toEqual(bystander.sections);
    });

    it('🔴 keeps a PUBLISHED page readable by the world after a reorder', async () => {
      // The invariant this endpoint could most easily have broken. Its worker
      // writes `prop-order` with NO access rules; had it carried the draft rule
      // the way `SetSectionAccess` does, moving a row on a live page would have
      // revoked the world's read on it while `Page.published` stayed true.
      await client.post('/functions/publishPage', { pageId: target.page, publish: true }, asUser(owner));
      const [first, , third] = target.sections;
      expect((await readAnonymously('Section', third)).status).toBe(200);

      const res = await reorder(target.page, third, 0);
      expect(res.status).toBe(200);

      for (const section of target.sections) {
        const row = await readAsAdmin('Section', section);
        expect(row.json.ACL).toEqual({ ...DRAFT_ACL, '*': { read: true, write: false } });
        expect((await readAnonymously('Section', section)).status).toBe(200);
      }
      expect(await storedOrder(target)).toEqual([third, first, target.sections[1]]);

      await client.post('/functions/publishPage', { pageId: target.page, publish: false }, asUser(owner));
    });

    it('refuses a non-admin caller, and changes nothing when it does', async () => {
      const before = await storedOrder(target);
      const denied = await reorder(target.page, target.sections[0], 2, outsider);
      expect(denied.status).toBe(403);
      expect(await storedOrder(target)).toEqual(before);
    });
  });
});

// ============================================================================
// The arm that must not be skipped: an UNPROVISIONED setup token
// ============================================================================

/**
 * A second backend, identical but for one thing: `SITE_SETUP_TOKEN` is not
 * provisioned.
 *
 * ⚠️ This is the arm SB-004 §7 says must not be dropped, and the reason is that
 * its failure reads as success. A backend that opens when the token is missing
 * still passes every other test in this file — the site gets claimed, the role
 * appears, the ACLs hold — and the one door in the template that mints an admin
 * is standing open on any freshly deployed instance. Failing closed is the whole
 * of Richard's ruling, and `Secret` firing `failure` rather than yielding an
 * empty string is the mechanism that delivers it.
 */
describe('SB-004 §7 — an unprovisioned setup token fails CLOSED', () => {
  let projectDir: string;
  let dataDir: string;
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);

  beforeAll(async () => {
    projectDir = await authorSb004();
    const bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );
    // Everything the other backend has, except the one secret.
    dataDir = makeDataDir(bundle, { CONTACT_RECIPIENT_EMAIL: CONTACT_TO });
    service = new BackendService({ dataDir, port: 0, backendId: 'sb004-unprov', backendName: 'SB-004 unprovisioned' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('refuses every claim, and mints no admin at all', async () => {
    const user = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username: 'opportunist',
      password: 'pw-opportunist'
    });
    expect(user.status).toBe(201);
    const headers = { 'x-parse-session-token': user.json.sessionToken };

    // Every shape of guess, including the empty string — which is what an
    // unprovisioned secret would look like if it yielded one instead of failing.
    for (const setupToken of [SETUP_TOKEN, '', 'anything']) {
      const res = await client.post('/functions/claimSite', { setupToken }, headers);
      expect(res.json).toEqual({ error: 'This site cannot be claimed.' });
    }

    const roles = await client.get<{ roles: Array<{ name: string }> }>('/admin/roles', adminHeaders(dataDir));
    expect(roles.json.roles.map((r) => r.name)).not.toContain('admin');

    // ⚠️ And the site is still unclaimed — a refusal that had already written the
    // SiteSettings row would leave the site permanently unclaimable instead.
    const settings = await client.get<{ results: unknown[] }>('/classes/SiteSettings');
    expect(settings.json.results).toEqual([]);
  });
});

// ============================================================================
// Why `Section.pageId` is a String — the measurement, not the assertion
// ============================================================================

/**
 * SB-004 §2 called the Pointer *"the one unhedged bet in this model"* and named
 * its own fallback in the same paragraph: a plain `pageId` String, to be taken
 * *"if the pointer-equality path in Query Records defects"*. It defects. This is
 * the arm that says so, and it lives here rather than in a note because a design
 * decision justified by prose decays and one justified by a red test does not.
 *
 * ⚠️ **Two arms, differing in one thing.** Same backend, same rows, same graph
 * shape, same filter parameter — one filters `page` (a Pointer column) with
 * `points to`, the other filters `pageId` (a String column) with `equal to`.
 * Without the String arm, "the Pointer query returned everything" could not be
 * told from "no filter on this node ever narrows anything", which is the same
 * green with the opposite meaning.
 *
 * 🔴 And the direction of the failure is the finding. §6b finding 2 expected the
 * Pointer to fail LOUDLY — `parse.ts:219-231` genuinely does refuse, saying the
 * collection schema is needed — and that refusal reaches `getStorageFilter`'s
 * `catch`, which reports through `editorConnection` (`dbcollectionnode2.ts:925-932`).
 * A deployed backend has no editor connection. The filter is then `undefined`,
 * an undefined filter is a query with no `where`, and a query with no `where`
 * returns **every row in the class** — into a flow whose next act is to rewrite
 * access control on everything it was handed.
 *
 * DEF-012 closed that: the catch now fails the node, so the arm below pins the
 * refusal answering through the graph's own failure route — and the describe
 * after it pins the same filter NARROWING once the bundle carries its schema.
 */

/** Request → prep → Query Records(filter) → count what came back. */
const pointerProbe = (name: string, property: string, operator: string) => ({
    name: `/#__cloud__/${name}`,
    ports: [],
    roots: [],
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        parameters: { allowNoAuth: true, params: 'pageId' },
        ports: [],
        children: []
      },
      {
        id: 'prep',
        type: 'JavaScriptFunction',
        parameters: {
          functionScript: 'if (Inputs.pageId === undefined) return;\nOutputs.pageId = Inputs.pageId;\nOutputs.ready();'
        },
        ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
        children: []
      },
      {
        id: 'q',
        type: 'DbCollection2',
        parameters: {
          // The same two the template's own filtered queries carry, so the load-
          // time unfiltered fetch cannot be mistaken for this measurement.
          'runOnChange-collectionName': false,
          'runOnChange-querySettings': false,
          collectionName: 'Chunk',
          visualFilter: { combinator: 'and', rules: [{ property, operator, input: 'pageId' }] }
        },
        ports: [],
        children: []
      },
      {
        id: 'count',
        type: 'JavaScriptFunction',
        parameters: {
          functionScript:
            'if (Inputs.items === undefined) return;\n' + 'Outputs.n = Inputs.items.length;\n' + 'Outputs.done();'
        },
        ports: [{ name: 'out-done', plug: 'output', type: 'signal' }],
        children: []
      },
      { id: 'res', type: 'noodl.cloud.response', parameters: { params: 'n' }, ports: [], children: [] },
      {
        id: 'bad',
        type: 'noodl.cloud.response',
        parameters: { params: 'e', status: 'failure', errorMessage: 'the query itself failed' },
        ports: [],
        children: []
      }
    ] as unknown[],
    connections: [
      { sourceId: 'req', sourcePort: 'pm-pageId', targetId: 'prep', targetPort: 'in-pageId' },
      { sourceId: 'req', sourcePort: 'receive', targetId: 'prep', targetPort: 'run' },
      { sourceId: 'prep', sourcePort: 'out-pageId', targetId: 'q', targetPort: 'qp-pageId' },
      { sourceId: 'q', sourcePort: 'items', targetId: 'count', targetPort: 'in-items' },
      { sourceId: 'q', sourcePort: 'fetched', targetId: 'count', targetPort: 'run' },
      { sourceId: 'count', sourcePort: 'out-n', targetId: 'res', targetPort: 'pm-n' },
      { sourceId: 'count', sourcePort: 'out-done', targetId: 'res', targetPort: 'send' },
      // ⚠️ Wired so that "the query failed" answers rather than hanging. Without
      // it a refused filter would be a thirty-second timeout, and a timeout says
      // nothing about which of the two arms is which.
      { sourceId: 'q', sourcePort: 'failure', targetId: 'bad', targetPort: 'send' }
    ]
  });

describe('SB-004 §7 — a `points to` filter cannot narrow inside a cloud function', () => {
  let dataDir: string;
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  let mine = '';

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb004-ptr-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'probe.workflow.json'),
      JSON.stringify({
        components: [pointerProbe('byPointer', 'owner', 'points to'), pointerProbe('byString', 'ownerId', 'equal to')],
        settings: {},
        metadata: {}
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'sb004-ptr', backendName: 'SB-004 pointer probe' });
    base = (await service.start()).listen.url;

    const owner = await client.post<{ objectId: string }>('/classes/Owner', { name: 'mine' });
    const other = await client.post<{ objectId: string }>('/classes/Owner', { name: 'theirs' });
    mine = owner.json.objectId;

    // Two rows on `mine`, one on `theirs`. Every Chunk carries BOTH shapes of the
    // same link, so the two arms differ only in which one they filter on.
    const chunk = (ownerId: string) =>
      client.post('/classes/Chunk', {
        ownerId,
        owner: { __type: 'Pointer', className: 'Owner', objectId: ownerId }
      });
    await chunk(mine);
    await chunk(mine);
    await chunk(other.json.objectId);
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('wrote the Pointer column correctly — the write half of the bet is fine', async () => {
    const schema = await client.get<{ columns: Array<{ name: string; type: string }> }>(
      '/admin/schema/Chunk',
      adminHeaders(dataDir)
    );
    const byName = Object.fromEntries(schema.json.columns.map((c) => [c.name, c.type]));
    expect(byName.owner).toBe('Pointer');
    expect(byName.ownerId).toBe('String');
  });

  it('the STRING arm narrows to the two rows it asked for (the known-firing control)', async () => {
    const res = await client.post<{ result?: { n?: number } }>('/functions/byString', { pageId: mine });
    expect(res.status).toBe(200);
    expect(res.json.result?.n).toBe(2);
  });

  it('the POINTER arm with no schema fails LOUDLY — never a success carrying every row', async () => {
    // DEF-012 inverted this pin. As authored by SB-004 §7 this arm asserted the
    // defect (`200`, n === 3 — every row in the class, answered as a success,
    // which is how publishing one page opened every Section on the site). The
    // meaning, not the number: a filter that cannot be translated must not
    // widen — the node fails, and the graph's own failure route answers.
    const res = await client.post<{ result?: { n?: number }; error?: string }>('/functions/byPointer', {
      pageId: mine
    });
    expect(res.status).toBe(400);
    expect(res.json.result).toBeUndefined();
    expect(res.json.error).toBe('the query itself failed');
  });
});

/**
 * DEF-012's other half: the same filter NARROWS once the bundle carries the
 * schema. The metadata here is the `columns` shape `SchemaHandler` caches into
 * `dbCollections` from `backend:getSchema` — not the Parse-era
 * `schema.properties` shape — because the built-in backend's cache is the shape
 * every project on the shipped backend actually carries, and it is the shape
 * `schemaFor` used to read as "no schema at all".
 */
describe('DEF-012 — the pointer filter narrows once the bundle carries its schema', () => {
  let dataDir: string;
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  let mine = '';

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'def012-ptr-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'probe.workflow.json'),
      JSON.stringify({
        components: [pointerProbe('byPointer', 'owner', 'points to')],
        settings: {},
        metadata: {
          dbCollections: [
            {
              name: 'Chunk',
              columns: [
                { name: 'owner', type: 'Pointer', targetClass: 'Owner' },
                { name: 'ownerId', type: 'String' }
              ]
            }
          ]
        }
      })
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'def012-ptr', backendName: 'DEF-012 pointer probe' });
    base = (await service.start()).listen.url;

    const owner = await client.post<{ objectId: string }>('/classes/Owner', { name: 'mine' });
    const other = await client.post<{ objectId: string }>('/classes/Owner', { name: 'theirs' });
    mine = owner.json.objectId;
    const chunk = (ownerId: string) =>
      client.post('/classes/Chunk', {
        ownerId,
        owner: { __type: 'Pointer', className: 'Owner', objectId: ownerId }
      });
    await chunk(mine);
    await chunk(mine);
    await chunk(other.json.objectId);

    // `CloudStore._collections` is a module-global cache, materialised by the
    // FIRST filter translated in this process — the describe above, whose
    // bundle has empty metadata. This service shares that module (jest keeps
    // one registry per file), so the cache must be re-derived from THIS
    // service's runtime — the newest `NoodlRuntime.instance` — or the arm
    // below silently measures the other bundle's emptiness.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require('@noodl/runtime/src/api/cloudstore') as { invalidateCollections(): void }).invalidateCollections();
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('the first write recorded the Pointer column with its class — the half SchemaHandler caches', async () => {
    // Before DEF-012 a first-write Pointer column was recorded as a bare
    // `Pointer` — the value's own `className` was dropped — so nothing the
    // editor could ever cache would have carried a `targetClass`.
    const schema = await client.get<{ columns: Array<{ name: string; type: string; targetClass?: string }> }>(
      '/admin/schema/Chunk',
      adminHeaders(dataDir)
    );
    const ownerColumn = schema.json.columns.find((c) => c.name === 'owner');
    expect(ownerColumn?.type).toBe('Pointer');
    expect(ownerColumn?.targetClass).toBe('Owner');
  });

  it('the POINTER arm narrows to the two rows it asked for', async () => {
    const res = await client.post<{ result?: { n?: number } }>('/functions/byPointer', { pageId: mine });
    expect(res.status).toBe(200);
    expect(res.json.result?.n).toBe(2);
  });
});

// ============================================================================
// SB-013 — why `claimSite` decides once, and why deciding once was not enough
// ============================================================================

/**
 * 🔴 **Two barriers, each graded against the same known-firing failure.**
 *
 * SB-008 F21 measured one claim leaving two `SiteSettings` rows and filed
 * SB-013, whose recommendation was one wire: drop `secret.done → storageFetch`
 * and let the load-time fetch answer. That reading was taken on the row count
 * alone, and the row count is not the property this endpoint is for.
 *
 * The gate's `Run` is wired from `settings.fetched`, which reads like *"decides
 * after the query"*. It is not: `Run` is purely ADDITIVE and every input is
 * ticked by default (`run-on-value-change.ts` §1, constraints 1 and 2), so the
 * node ALSO re-ran on each input arriving — and `isEmpty` is `true` before the
 * first query has run (`dbcollectionnode2.ts:410-421`), indistinguishable from
 * a collection that is genuinely empty. A gate run that arrives with the secret
 * and before the fetch therefore reads an already-claimed site as unclaimed.
 *
 * The shipped graph closes it twice, and neither is redundant:
 *
 *  - **A — the gate's `runOnChange-in-*` boxes are off**, so it runs on
 *    `fetched` and at no other time;
 *  - **B — the script returns unless `Inputs.rows` is defined**, `items` being
 *    the one output of a Query Records node that separates *matched nothing*
 *    from *has not run*.
 *
 * Every arm below removes exactly one thing from the deployed bundle and
 * changes nothing else. Read as pairs: **A-alone vs neither** and **B-alone vs
 * neither** differ by one barrier each, and the failure they are graded against
 * is not an assertion about rows but an OUTSIDER HOLDING THE ADMIN ROLE.
 */
describe('SB-013 — the second claim, and the two barriers that refuse it', () => {
  let bundle: WorkflowBundle;
  let projectDir: string;

  beforeAll(async () => {
    projectDir = await authorSb004();
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  /** One claim by the owner, then one by an outsider, on a backend of its own. */
  async function claimTwice(label: string, mutate?: (b: WorkflowBundle) => void): Promise<ClaimReading> {
    const copy = JSON.parse(JSON.stringify(bundle)) as WorkflowBundle;
    if (mutate) mutate(copy);

    const dir = makeDataDir(copy, { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO });
    const svc = new BackendService({ dataDir: dir, port: 0, backendId: `sb013-${label}`, backendName: label });
    const started = await svc.start();
    const c = httpClient(() => started.listen.url);
    try {
      // Every arm re-asserts it: an arm read with the ACLs off measures nothing.
      expect(started.security.enforced).toBe(true);
      const signup = async (who: string) => {
        const u = await c.post<{ objectId: string; sessionToken: string }>('/users', {
          username: `${who}-${label}`,
          password: 'pw'
        });
        return { id: u.json.objectId, headers: { 'x-parse-session-token': u.json.sessionToken } };
      };
      const first = await signup('owner');
      const second = await signup('outsider');

      const claim = await c.post<{ result?: { claimed?: boolean } }>(
        '/functions/claimSite',
        { setupToken: SETUP_TOKEN },
        first.headers
      );
      const settings = (await c.get<{ results: Row[] }>('/classes/SiteSettings', first.headers)).json.results.length;
      const themes = (await c.get<{ results: Row[] }>('/classes/Theme', first.headers)).json.results.length;

      // 🔴 The reading SB-013's own arms never took. A claimed site, a CORRECT
      // token, a different caller — the case the whole gate exists for.
      const again = await c.post<{ result?: { claimed?: boolean }; error?: string }>(
        '/functions/claimSite',
        { setupToken: SETUP_TOKEN },
        second.headers
      );
      const roles = await c.get<{ roles: Array<{ name: string; users: string[] }> }>('/admin/roles', adminHeaders(dir));
      const admins = roles.json.roles.find((r) => r.name === 'admin')?.users ?? [];

      return {
        claimed: claim.json.result?.claimed,
        settings,
        themes,
        secondAnswer: again.json.error ?? `claimed:${String(again.json.result?.claimed)}`,
        outsiderIsAdmin: admins.includes(second.id),
        admins: admins.length
      };
    } finally {
      await svc.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  const CLAIM = '/#__cloud__/claimSite';

  /** Set parameters on the only node of a type in one deployed component. */
  function setParam(b: WorkflowBundle, nodeType: string, params: Record<string, unknown>): void {
    const c = b.components.find((x) => x.name === CLAIM);
    if (!c) throw new Error(`no ${CLAIM} in the bundle`);
    const hits = (c.nodes as Array<{ type: string; parameters?: Record<string, unknown> }>).filter(
      (n) => n.type === nodeType
    );
    // An arm that varied nothing is not an arm.
    expect(`${nodeType} nodes:${hits.length}`).toBe(`${nodeType} nodes:1`);
    hits[0].parameters = { ...(hits[0].parameters ?? {}), ...params };
  }

  /** Barrier A removed: the gate re-runs on every input value again. */
  const gateBoxesOn = (b: WorkflowBundle) =>
    setParam(b, 'JavaScriptFunction', {
      'runOnChange-in-expected': true,
      'runOnChange-in-supplied': true,
      'runOnChange-in-unclaimed': true,
      'runOnChange-in-rows': true
    });

  /** Barrier B removed: the readiness line, and only that line, out of the script. */
  const guardOff = (b: WorkflowBundle) => {
    const c = b.components.find((x) => x.name === CLAIM)!;
    const gate = (c.nodes as Array<{ type: string; parameters?: Record<string, unknown> }>).find(
      (n) => n.type === 'JavaScriptFunction'
    )!;
    const before = gate.parameters!.functionScript as string;
    const after = before.replace('if (Inputs.rows === undefined) return;\n', '');
    expect(`guard removed:${before !== after}`).toBe('guard removed:true');
    gate.parameters!.functionScript = after;
  };

  it('SHIPPED — one claim, one of each singleton, and the second claim refused', async () => {
    const r = await claimTwice('shipped');
    expect(`claimed:${String(r.claimed)}`).toBe('claimed:true');
    expect(`settings:${r.settings} themes:${r.themes}`).toBe('settings:1 themes:1');
    expect(r.secondAnswer).toBe('This site cannot be claimed.');
    expect(`outsider is admin:${r.outsiderIsAdmin}`).toBe('outsider is admin:false');
  });

  it('🔴 NEITHER barrier — the outsider becomes an admin on a claimed site', async () => {
    // The known-firing failure the two arms below are graded against. Note what
    // it is NOT: the answer is still `This site cannot be claimed.` and the HTTP
    // status is still 400. The refusal message is a lie and the only way to see
    // it is to ask the role who is in it.
    const r = await claimTwice('neither', (b) => {
      gateBoxesOn(b);
      guardOff(b);
    });
    expect(r.secondAnswer).toBe('This site cannot be claimed.');
    expect(`outsider is admin:${r.outsiderIsAdmin}`).toBe('outsider is admin:true');
    expect(`admins:${r.admins}`).toBe('admins:2');
  });

  it('barrier A alone (boxes off, guard removed) — refused', async () => {
    const r = await claimTwice('boxes-only', guardOff);
    expect(`outsider is admin:${r.outsiderIsAdmin}`).toBe('outsider is admin:false');
    expect(`settings:${r.settings} themes:${r.themes}`).toBe('settings:1 themes:1');
  });

  it('barrier B alone (guard kept, boxes on) — refused, and it costs the ANSWER', async () => {
    const r = await claimTwice('guard-only', gateBoxesOn);
    expect(`outsider is admin:${r.outsiderIsAdmin}`).toBe('outsider is admin:false');
    expect(`settings:${r.settings} themes:${r.themes}`).toBe('settings:1 themes:1');

    // 🔴 Why both barriers ship rather than the cheaper one. The boundary holds
    // on the guard alone — but with the boxes on the gate still runs more than
    // once, and the run that publishes `claimed` is not the run the Response
    // sends on: the caller is told nothing at all. A site that IS claimed
    // answering `claimed: undefined` is how an owner ends up claiming twice.
    expect(`claimed:${String(r.claimed)}`).toBe('claimed:undefined');
  });

  it('🔴 the row half: with the load-time fetch back on, the singleton is still ONE', async () => {
    // SB-013 §2 read the second row as "two fetches, two gate runs". The finer
    // reading is that the second RUN was the value-change one: with the gate
    // deciding on `fetched` alone, restoring the load-time fetch changes
    // nothing. That is why the fix is on the gate and not only on the query.
    const r = await claimTwice('two-fetches', (b) =>
      setParam(b, 'DbCollection2', { 'runOnChange-collectionName': true, 'runOnChange-querySettings': true })
    );
    expect(`settings:${r.settings} themes:${r.themes}`).toBe('settings:1 themes:1');
    expect(`outsider is admin:${r.outsiderIsAdmin}`).toBe('outsider is admin:false');
  });
});
