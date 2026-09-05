/**
 * D4 — is a **refused** query distinguishable from an **empty** one, in the
 * browser?
 *
 * `DEFECTS-THE-TEMPLATES-FOUND.md` filed this open, and said why it matters
 * rather than leaving it a curiosity: `DbCollection2` has a `failure` signal and
 * an `error` output, so **if** a 403 reaches that path an app can tell "you may
 * not read this" from "there is nothing here". A prior session recorded the
 * opposite — a refused query publishing `[]` like an empty one — and that single
 * fact is why every members-only screen in TPL-001 is branched on the
 * `myStanding` round trip instead of on the query it is about to run. If the
 * refusal *is* legible, D2 (the browser cannot read its own roles) is a
 * convenience; if it is not, D2 is a necessity.
 *
 * ## Why this needs a mutated twin, and what exactly is varied
 *
 * 🔴 **TPL-001 never runs a members-only query as a non-member**, by design:
 * `standing.Member` is the only thing wired to `announcements.storageFetch`, so
 * the refusal this file is about never happens in the shipped app. The question
 * is about the *platform*, and answering it means building the app somebody
 * would have written without our findings — the one that branches on the query.
 *
 * So the twin varies **two wires in one component** and nothing else:
 *
 * | wire | why |
 * |---|---|
 * | `page.didMount → announcements.storageFetch` | the query runs whoever you are |
 * | `announcements.failure → toLanding.navigate` | a refusal, if legible, is unmissable |
 *
 * Both targets already exist on the page, so no node is added and the door's own
 * output is otherwise untouched.
 *
 * ## 🔴 Why the observable is a NAVIGATION and not a notice
 *
 * The first version of this twin wired `failure → unknownNotice.visible` and
 * `error → unknownNotice.text`, and it produced a reading that was **exactly
 * inverted**: the notice painted for the member whose query **succeeded** (HTTP
 * 200, rows on the page) and did not paint for the pending person whose query
 * was **refused** (HTTP 403). That is the signal-into-a-value-port class — a
 * `failure` **signal** wired to a `visible` **value** port — and it means the
 * instrument was measuring the wire rather than the refusal.
 *
 * `toLanding.navigate` is a **signal input**, so the twin is signal-to-signal
 * throughout. It is also unambiguous on this page: the only other thing wired
 * to it is `standing.Denied`, which fires for a visitor and for an unreadable
 * standing — and this arm's person is neither. The server answers `pending`
 * for them, so `decide` fires nothing and `failed` never runs. So being off
 * `/members` at the end of the visit means `failure` fired, and nothing else
 * does.
 *
 * ⚠️ **`toLanding` no longer goes to the landing page** — Richard's judgement 4
 * (2026-09-04) retargeted the six protected pages' refusal to `/sign-in`, and
 * this twin borrows one of those nodes rather than adding its own. The node's
 * ID is unchanged, deliberately: ids are unique project-wide and a rename would
 * renumber the artefact's `toSignIn-N` ids by authoring order, and would point
 * the wire pushed below at a node that does not exist — an arm that navigates
 * nowhere reads as *"the refusal is silent"*, which is the inverse of D4's
 * answer. The destination is read from the artefact below rather than typed.
 *
 * ## The arms
 *
 * Both on **one backend**, in **one browser**, minutes apart:
 *
 * 1. **member** — the control. The same three wires, a person the server allows.
 *    The list draws rows, so the added `storageFetch` is live and the component
 *    is running. Without this arm, a silent pending arm is equally consistent
 *    with "the mutation did nothing".
 * 2. **pending** — the measurement. Signed in, approved by nobody, refused by
 *    the server with a 403 (asserted over HTTP in the same run). What does the
 *    page know about it?
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import {
  bundleMembersCloud,
  copyTemplateProject,
  makeMembersDataDir,
  SETUP_TOKEN,
  signIn,
  signOut
} from './helpers/members-drive';
import { bindProjectToBackend, readVisit, Visit, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const MODERATOR = { email: 'mod@d4.invalid', password: 'pw-moderator' };
const PENDING = { name: 'Dee Four', email: 'dee@d4.invalid', password: 'pw-dee' };
const JOINER = { name: 'Em Ber', email: 'em@d4.invalid', password: 'pw-em' };
const ANNOUNCEMENT = { title: 'The refused query', body: 'Only members may read this.' };

interface Wire {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

interface Node {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
}

function nodesOf(projectDir: string, component: string): Node[] {
  const file = path.join(projectDir, 'components', 'Pages', component, 'nodes.json');
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as { nodes: Node[] }).nodes;
}

/**
 * 🔴 **Where `toLanding` goes, DERIVED from the artefact and never typed.**
 *
 * The twin borrows a `RouterNavigate` the page already has, so the URL this
 * file must expect is whatever that node's `target` resolves to — `/` before
 * Richard's judgement 4, `/sign-in` after it. Typing the answer would make this
 * spec's verdict depend on somebody remembering to edit it: a retarget would
 * leave `landed.pending` reading the NEW page against the OLD expectation and
 * the file would report *"a refusal is SILENT to the graph"*, reversing D4's
 * answer without a single line of the platform changing.
 *
 * Two hops, both out of the project on disk: the navigator's `target` names a
 * component, and that component's `Page` node carries the `urlPath` the router
 * serves it at.
 */
function refusalDestination(projectDir: string): string {
  const navigator = nodesOf(projectDir, 'Members').find((n) => n.id === 'toLanding');
  if (!navigator) throw new Error('`Pages/Members` has no `toLanding` — the twin has nothing to borrow');
  const target = String(navigator.parameters?.target ?? '');
  const component = target.replace(/^\/Pages\//, '');
  if (!component || component === target) throw new Error(`\`toLanding\` targets \`${target}\`, which is not a page`);
  const page = nodesOf(projectDir, component).find((n) => n.type === 'Page');
  if (!page) throw new Error(`\`Pages/${component}\` has no \`Page\` node, so it has no URL`);
  return `/${String(page.parameters?.urlPath ?? '')}`;
}

/** The two wires, added to the shipped `Pages/Members` on disk. */
function branchOnTheQuery(projectDir: string): void {
  const file = path.join(projectDir, 'components', 'Pages', 'Members', 'connections.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as { connections: Wire[] };
  const before = doc.connections.length;
  doc.connections.push(
    { fromId: 'page-3', fromProperty: 'didMount', toId: 'announcements', toProperty: 'storageFetch' },
    { fromId: 'announcements', fromProperty: 'failure', toId: 'toLanding', toProperty: 'navigate' }
  );
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  // An arm that varied nothing is not an arm.
  if (doc.connections.length !== before + 2) throw new Error('the twin did not take the two wires');
}

describe('D4 — what a refused query looks like from inside the page', () => {
  let projectDir = '';
  let dataDir = '';
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  const as = (token: string) => ({ 'x-parse-session-token': token });

  const visits: Record<string, Visit> = {};
  /** Where each arm ended up, and what it logged. */
  const landed: Record<string, string> = {};
  const status: Record<string, number> = {};
  let wired = 0;
  /** Filled from the artefact in `beforeAll`, once the project is on disk. */
  let REFUSAL_LANDS_AT = '';

  beforeAll(async () => {
    projectDir = copyTemplateProject('tpl001-d4');
    REFUSAL_LANDS_AT = refusalDestination(projectDir);
    branchOnTheQuery(projectDir);
    wired = (
      JSON.parse(
        fs.readFileSync(path.join(projectDir, 'components', 'Pages', 'Members', 'connections.json'), 'utf-8')
      ) as { connections: Wire[] }
    ).connections.filter((w) => w.fromId === 'announcements' || w.toId === 'announcements').length;

    dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl001-d4');
    service = new BackendService({ dataDir, port: 0, backendId: 'tpl001-d4', backendName: 'D4' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'tpl001-d4', started.listen.port);

    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      blurb: 'A congregation.',
      moderatorName: 'Ruth Bramley',
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    for (const p of [PENDING, JOINER]) {
      await client.post('/functions/requestAccess', {
        name: p.name,
        email: p.email,
        password: p.password,
        message: 'Please.'
      });
    }
    const mod = await client.post<{ sessionToken: string }>('/login', {
      username: MODERATOR.email,
      password: MODERATOR.password
    });
    await client.post(
      '/classes/Announcement',
      {
        ...ANNOUNCEMENT,
        postedAt: '2026-08-20T10:00:00.000Z',
        ACL: { 'role:admin': { read: true, write: true }, 'role:member': { read: true, write: false } }
      },
      as(mod.json.sessionToken)
    );

    // Em is approved so the control arm has somebody the server says yes to.
    const queue = await client.get<{ results: Array<{ objectId: string; name?: string }> }>(
      '/classes/MemberRequest',
      as(mod.json.sessionToken)
    );
    const emsRow = queue.json.results.find((r) => r.name === JOINER.name);
    expect(emsRow).toBeDefined();
    const decided = await client.post(
      '/functions/decideMembership',
      { requestId: emsRow?.objectId, approve: true },
      as(mod.json.sessionToken)
    );
    expect(`decide:${decided.status}`).toBe('decide:200');

    // The server's own answer to each of them, so the page's answer has
    // something to be compared with.
    const pending = await client.post<{ sessionToken: string }>('/login', {
      username: PENDING.email,
      password: PENDING.password
    });
    const member = await client.post<{ sessionToken: string }>('/login', {
      username: JOINER.email,
      password: JOINER.password
    });
    status.pending = (await client.get('/classes/Announcement', as(pending.json.sessionToken))).status;
    status.member = (await client.get('/classes/Announcement', as(member.json.sessionToken))).status;

    /** Where the router left this visit. `/` is the landing page. */
    const where = async (page: { evaluate(e: string): Promise<unknown> }): Promise<string> =>
      String(await page.evaluate('location.pathname'));

    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      // Arm 1 — the control. Somebody the server allows.
      await signIn(page, JOINER.email, JOINER.password);
      visits.member = await readVisit(page, '/members');
      landed.member = await where(page);
      await signOut(page);

      // Arm 2 — the measurement. Signed in, approved by nobody.
      await signIn(page, PENDING.email, PENDING.password);
      visits.pending = await readVisit(page, '/members');
      landed.pending = await where(page);
    });

    // eslint-disable-next-line no-console
    console.log(
      `\n[D4] HTTP member ${status.member} / pending ${status.pending}\n` +
        `  member  landed=${landed.member}\n` +
        `          text=${JSON.stringify(visits.member.text.replace(/\n/g, ' | ').slice(0, 160))}\n` +
        `          console=${JSON.stringify(visits.member.errors)}\n` +
        `  pending landed=${landed.pending}\n` +
        `          text=${JSON.stringify(visits.pending.text.replace(/\n/g, ' | ').slice(0, 160))}\n` +
        `          console=${JSON.stringify(visits.pending.errors)}`
    );
  });

  afterAll(async () => {
    if (service) await service.stop();
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('the twin took both wires', () => {
    // The template ships four wires touching `announcements` (storageFetch,
    // items, count, fetched); the twin adds two more.
    expect(wired).toBe(6);
  });

  it('the server tells the two of them apart — 200 for one, refused for the other', () => {
    expect(status.member).toBe(200);
    expect(status.pending).toBe(403);
  });

  it('🔴 CONTROL — the added storageFetch is live: the allowed person draws rows', () => {
    // Without this the pending arm's silence would be equally consistent with
    // "the mutation did nothing", which is the wrong finding entirely.
    expect(visits.member.text).toContain(ANNOUNCEMENT.title);
    // …and the person whose query succeeded was NOT navigated away, which is
    // what makes the pending arm's landing place mean something.
    expect(landed.member).toBe('/members');
  });

  /**
   * The measurement. Whichever way it lands it is written down here, because
   * D4's value is the answer and not a particular answer.
   */
  it('the refused person never sees the rows, whatever the page knew', () => {
    expect(visits.pending.text).not.toContain(ANNOUNCEMENT.title);
    expect(visits.pending.html).not.toContain(ANNOUNCEMENT.body);
  });

  /**
   * 🔴 **D4's answer: a refusal IS legible to the graph.** `failure` fired on
   * the 403 and the page acted on it; the allowed arm's query succeeded and it
   * did not. That reverses what a prior session recorded — *a refused query
   * publishing `[]` like an empty one* — and it is the reason D2 (the browser
   * cannot read its own roles) is a **convenience rather than a necessity**: an
   * app can branch locally on the query it was going to run anyway.
   *
   * ⚠️ It does **not** loosen TPL-001's design. Branching on `failure` means
   * the members-only query is issued and refused on every page load by every
   * stranger, and the screen flickers through "nothing here" on its way to
   * "you may not". `myStanding` stops the query being made at all, which is
   * both quieter and the thing AC2 is actually about.
   *
   * Pinned as an equality so a regression in EITHER direction reddens: if the
   * platform ever stops raising `failure` on a refusal, this is the spec that
   * says so, and every app that branched on it is wrong that day.
   */
  it('🔴 D4 — `failure` fires on a refusal, so a refused query is not an empty one', () => {
    // 🔴 The observable has to be somewhere OTHER than the page the arm starts
    // on, or "did not move" and "was navigated" are the same reading and this
    // spec answers D4 `true` for a platform that dropped the signal entirely.
    expect(REFUSAL_LANDS_AT).not.toBe('/members');
    const firedForRefused = landed.pending === REFUSAL_LANDS_AT;
    // eslint-disable-next-line no-console
    console.log(
      `\n[D4 ANSWER] a 403 reaching DbCollection2 is ${firedForRefused ? 'LEGIBLE' : 'SILENT'} to the graph: ` +
        `failure ${firedForRefused ? 'FIRED' : 'DID NOT FIRE'} (refused arm landed on ${landed.pending}, ` +
        `and \`toLanding\` goes to ${REFUSAL_LANDS_AT}).`
    );
    expect(firedForRefused).toBe(true);
  });

  /**
   * And it reaches the console too, with a code — the half a developer sees.
   * Asserted beside the member arm's silence so what is detected is the refusal
   * and not noise the page logs anyway.
   */
  it('and the runtime names it in the console, only for the refused arm', () => {
    expect(visits.pending.errors.join(' ')).toContain('query-records/query-failed');
    expect(visits.member.errors).toEqual([]);
  });
});
