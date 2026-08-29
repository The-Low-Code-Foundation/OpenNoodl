/**
 * TPL-001 — the members' area, in a browser, against an enforcing backend.
 *
 * 🔴 **This is the only thing in phase 78 that can say the template works.**
 * Nineteen components, four endpoints, a hand-authored policy and a 41-spec
 * byte gate were built and committed without a single node ever executing —
 * and TPL-001 §11's first finding is that **the door does not check a
 * connection to a component-instance port at all**, which is what every gate in
 * this template is. A graph is a claim; this is the evidence.
 *
 * ## What is measured, and against what
 *
 * The subject is `templates/members-area/` — **the artefact a person receives**,
 * copied and served, not a re-authoring of it. `tpl001Template.test.ts` already
 * proves that directory is what the MCP door writes; re-authoring here would
 * measure a project nobody is handed. See `helpers/members-drive.ts`.
 *
 * | AC | what it says | where it is graded |
 * |---|---|---|
 * | 2 | a member sees announcements; **signed out, nothing** | §2, §3 |
 * | 3 | a **pending** member is refused exactly as a stranger is | §4 |
 * | 4 | a member cannot post — UI **and** server | §5 |
 * | 5 | approve → that person can sign in and read | §6 |
 *
 * ⚠️ **AC1 is not graded here and cannot be.** It says *picking "Members' area"
 * and finishing the wizard*, and this template is delivered **curated** — it is
 * a directory Richard publishes, so until it is on the shelf there is no picker
 * row to pick. What this file does grade is the half that does not depend on
 * publication: the shipped directory boots, binds and renders its landing page
 * to a stranger with no white void (§1).
 *
 * ## The conditions that make it a measurement
 *
 * 🔴 **`devOpen: false`**, asserted from `started.security.enforced` before any
 * reading is taken. `devOpenActive` disables row-level ACL entirely, and a
 * members-only app tested with it on looks like it works and is wide open.
 *
 * 🔴 **Nobody is created by the harness.** The shipped policy sets
 * `signup: "nobody"`, so `POST /users` is refused and every account here is
 * minted the way the product mints one — the moderator through
 * `claimAssociation` against a backend secret, everyone else through
 * `requestAccess`. §0 asserts the refusal, because a harness that could create
 * an account would be driving a door this template does not have.
 *
 * 🔴 **Every absence sits beside a signal known to fire.** "The announcement was
 * not on the page" has a dozen causes with nothing to do with permissions — an
 * unbound query, a dead wire, a page that never rendered — and they are
 * indistinguishable from the DOM. Every refusal below is asserted in the same
 * run, against the same instrument, as a read that returns the row.
 *
 * 🔴 **Leaks are read off `outerHTML`, never `innerText`.** `innerText` reports
 * what a reader sees, so an absence checked on it alone would pass on a page
 * that had fetched every announcement and merely not painted it. `outerHTML`
 * cannot be fooled that way.
 *
 * ⚠️ **This template no longer hides anything — it unmounts it.** Every gate is
 * `mounted`, so a gated subtree is not in the document at all (§5, §8). The
 * `outerHTML` discipline stays anyway: it is what makes that claim checkable,
 * and it is the reading that would catch the regression back to `visible`.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import {
  bundleMembersCloud,
  clickButton,
  clickButtonInRow,
  controls,
  fill,
  copyTemplateProject,
  makeMembersDataDir,
  offered,
  present,
  SETUP_TOKEN,
  signIn,
  signOut
} from './helpers/members-drive';
import { bindProjectToBackend, readHere, readVisit, Visit, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

/** The people. Their addresses are their usernames — the template signs in by email. */
const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
/** Asked to join and was never decided. The state AC3 is about. */
const PENDING = { name: 'Pat Pending', email: 'pat@example.invalid', password: 'pw-pat' };
/** Asked to join and gets approved on camera, in §6. */
const JOINER = { name: 'Mo Joiner', email: 'mo@example.invalid', password: 'pw-mo' };

const ANNOUNCEMENT = { title: 'The roof appeal', body: 'We have raised half of what the roof needs.' };
const MEETING = { title: 'Parish council', place: 'The hall', details: 'All welcome.' };

/**
 * 🔴 What the moderator types into the Post page, rather than what the harness
 * writes over HTTP.
 *
 * The seeded row above exists because the anonymous and pending arms have to be
 * taken *before* anybody can post — but a seeded row exercises none of the
 * template's own writing. Everything on the Post page runs through ports the
 * MCP door cannot check (TPL-001 §11): `prop-title`, `prop-body`, `prop-when`,
 * `prop-place`, `prop-details` on two `NewDbModelProperties` nodes, and
 * `stampAnnouncement.out-go`. Typing it is the only thing that grades them.
 */
const TYPED = {
  title: 'The harvest supper',
  body: 'Saturday the ninth, in the hall, from seven.',
  meeting: 'Standing committee',
  when: '2099-06-01',
  place: 'The vestry',
  details: 'Papers circulated beforehand.'
};

/** The ACL a moderator's own write carries — `tpl001Vocabulary.MEMBERS_READ_RULES` on the wire. */
const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

interface Row {
  objectId: string;
  [field: string]: unknown;
}
interface Rows {
  results: Row[];
}

/** One HTTP reading, kept whole so a spec can assert on the status AND the body. */
interface Reading {
  status: number;
  rows: number;
  titles: string[];
  body: string;
}

describe("TPL-001 — the members' area, driven", () => {
  let projectDir = '';
  let dataDir = '';
  let service: BackendService;
  let base = '';

  const client = httpClient(() => base);
  const as = (token: string) => ({ 'x-parse-session-token': token });

  /** Session tokens, minted through the product's own doors. */
  const tokens: Record<string, string> = {};
  /** Every browser reading, taken once in `beforeAll` and asserted below. */
  const visits: Record<string, Visit> = {};
  /**
   * What each reading OFFERED — rendered, painted, clickable — and what was
   * merely PRESENT in the document. Two different claims; see `Control`.
   */
  const buttons: Record<string, string[]> = {};
  const inDocument: Record<string, string[]> = {};
  /** Every HTTP reading, same idea. */
  const http: Record<string, Reading> = {};
  /** What the browser held after each sign-in — a session, or nothing. */
  const sessions: Record<string, string | null> = {};
  let enforced = false;
  let signupStatus = -1;
  let approvedInBrowser = false;
  /**
   * 🔴 The viewer bundle is a shared, gitignored build artefact and a peer's dev
   * stack rewrites it. Stamped at both ends of the run: a bundle swapped
   * mid-drive would make every reading below unattributable, and the failure
   * mode is that it reads as a flake in whichever spec happened to be running.
   */
  let bundleStamp = '';
  let bundleStampAfter = '';
  const stampViewer = (): string => {
    const s = fs.statSync(
      path.join(__dirname, '..', '..', 'noodl-editor', 'src', 'external', 'viewer', 'noodl.viewer.js')
    );
    return `${s.mtime.toISOString()} ${s.size}B`;
  };

  const read = async (label: string, token: string | null, className = 'Announcement'): Promise<void> => {
    const res = await client.get<Rows>(`/classes/${className}`, token ? as(token) : {});
    http[label] = {
      status: res.status,
      rows: res.json?.results?.length ?? -1,
      // `title` for an announcement or a meeting, `name` for a directory row —
      // one helper, because the log line is "what did this person get to see".
      titles: (res.json?.results ?? []).map((r) => String(r.title ?? r.name ?? '')),
      body: res.text.slice(0, 300)
    };
  };

  beforeAll(async () => {
    bundleStamp = stampViewer();

    projectDir = copyTemplateProject('tpl001-drive');
    dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl001-drive');
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'tpl001-drive',
      backendName: "TPL-001 members' area"
    });
    const started = await service.start();
    base = started.listen.url;
    enforced = started.security.enforced;
    // Nothing below means anything if this is false — see the header.
    expect(enforced).toBe(true);

    bindProjectToBackend(projectDir, 'tpl001-drive', started.listen.port);

    // ── §0. Every account is minted through a door the template ships ─────────
    const sneak = await client.post('/users', { username: 'sneak@example.invalid', password: 'pw' });
    signupStatus = sneak.status;

    const claimed = await client.post<{ result?: { claimed?: boolean } }>('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      blurb: 'A congregation that meets on Sundays.',
      // D22 (s8): `moderatorName` is required at the door now, and it is what
      // the directory files the founding row under. §10 asserts the row.
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    expect(`claimed:${claimed.json.result?.claimed}`).toBe('claimed:true');

    for (const person of [PENDING, JOINER]) {
      const asked = await client.post<{ result?: { received?: boolean } }>('/functions/requestAccess', {
        name: person.name,
        email: person.email,
        password: person.password,
        message: `${person.name} would like to join.`
      });
      expect(`${person.email} received:${asked.json.result?.received}`).toBe(`${person.email} received:true`);
    }

    const login = async (who: { email: string; password: string }): Promise<string> => {
      const res = await client.post<{ sessionToken: string }>('/login', {
        username: who.email,
        password: who.password
      });
      expect(`${who.email} login:${res.status}`).toBe(`${who.email} login:200`);
      return res.json.sessionToken;
    };
    tokens.moderator = await login(MODERATOR);
    tokens.pending = await login(PENDING);

    // ── The content, written by the moderator the way the Post page writes it ──
    const posted = await client.post<Row>(
      '/classes/Announcement',
      { ...ANNOUNCEMENT, postedAt: '2026-08-20T10:00:00.000Z', ACL: MEMBERS_READ_ACL },
      as(tokens.moderator)
    );
    expect(`announcement:${posted.status}`).toBe('announcement:201');
    const meeting = await client.post<Row>(
      '/classes/Meeting',
      { ...MEETING, when: '2099-01-01', ACL: MEMBERS_READ_ACL },
      as(tokens.moderator)
    );
    expect(`meeting:${meeting.status}`).toBe('meeting:201');

    // ── The HTTP arms taken BEFORE anybody is approved ────────────────────────
    await read('anon', null);
    await read('pending', tokens.pending);
    await read('moderator', tokens.moderator);

    // ── The browser ───────────────────────────────────────────────────────────
    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      /**
       * ⚠️ Tall on purpose. The default preview is 988×313, in which the Post
       * page's second form starts below the fold — and while `offered` is
       * scroll-independent, every click still has to land somewhere real.
       */
      await page.setViewport({ width: 1280, height: 1600 });

      const look = async (label: string, url: string) => {
        visits[label] = await readVisit(page, url);
        const cs = await controls(page, 'button');
        buttons[label] = offered(cs);
        inDocument[label] = present(cs);
      };

      /**
       * The same reading, taken **without navigating** — see `readHere`.
       *
       * 🔴 A confirmation is state the click produced on the page in front of
       * the person. `look` reloads the URL, which throws that state away and
       * grades the boot instead of the click.
       */
      const lookHere = async (label: string, until?: string) => {
        visits[label] = await readHere(page, { until });
        const cs = await controls(page, 'button');
        buttons[label] = offered(cs);
        inDocument[label] = present(cs);
      };

      // §1 + §2 — a stranger.
      await look('anon.landing', '/');
      await look('anon.members', '/members');
      await look('anon.meetings', '/meetings');

      // §1b — the refusal a wrong password earns.
      //
      // 🔴 `lookHere`, not `look`, and for D14's reason: the gate fires on the
      // click, so navigating back to /sign-in would boot a fresh page and grade
      // the boot. The fresh reading is taken FIRST, as the arm that makes the
      // second one a statement — "the page says nothing yet" and "the page says
      // nothing ever" are the same reading taken once.
      await page.navigate('/sign-in');
      await lookHere('signin.fresh');
      // `signIn` is navigate-fill-click-settle, and it RETURNS the session the
      // browser ended up holding — which for a wrong password is `null`.
      sessions.wrongPassword = await signIn(page, MODERATOR.email, 'not the password');
      await lookHere('signin.refused');
      await signOut(page);

      // §4 — a pending member. Signed in, decided by nobody.
      sessions.pending = await signIn(page, PENDING.email, PENDING.password);
      await look('pending.members', '/members');
      await look('pending.meetings', '/meetings');
      await look('pending.post', '/post');
      await look('pending.requests', '/requests');
      await signOut(page);

      // §3's control, and §5's UI half — the moderator, same instrument.
      sessions.moderator = await signIn(page, MODERATOR.email, MODERATOR.password);
      await look('moderator.members', '/members');
      await look('moderator.meetings', '/meetings');
      await look('moderator.requests', '/requests');

      // §6 — approve Mo, on camera, through the queue the moderator is looking at.
      await clickButtonInRow(page, 'Approve', JOINER.name);
      approvedInBrowser = true;
      await look('moderator.requestsAfter', '/requests');

      // §7 — the moderator posts, by typing into the form the template ships.
      await look('moderator.post', '/post');
      await fill(page, 'Title', TYPED.title, 0);
      await fill(page, 'What you want to say', TYPED.body);
      await clickButton(page, 'Post it');
      await lookHere('moderator.posted', 'Posted. Members can see it now.');

      await fill(page, 'Title', TYPED.meeting, 1);
      await fill(page, 'Date', TYPED.when);
      await fill(page, 'Where', TYPED.place);
      await fill(page, 'Details', TYPED.details);
      await clickButton(page, 'Add it to the diary');
      await lookHere('moderator.added', 'Added. Members can see it now.');

      // §8 — the directory, AFTER approving Mo, so a passing reading is two
      // people and not one: the founding moderator's own row from setup, and
      // the projection row `decideMembership` wrote on the grant.
      await look('moderator.directory', '/directory');
      await signOut(page);

      // …and Mo signs in and reads.
      sessions.member = await signIn(page, JOINER.email, JOINER.password);
      await look('member.members', '/members');
      await look('member.meetings', '/meetings');
      await look('member.post', '/post');
      // §8's negative arm — a member is a member, and still not a moderator.
      await look('member.directory', '/directory');
    });

    // ── The HTTP arms that need Mo to be a member ─────────────────────────────
    tokens.member = await client
      .post<{ sessionToken: string }>('/login', { username: JOINER.email, password: JOINER.password })
      .then((r) => r.json.sessionToken);
    await read('member', tokens.member);

    const memberPost = await client.post(
      '/classes/Announcement',
      { title: 'A member wrote this', body: 'It should not exist.', postedAt: '2026-08-21T10:00:00.000Z' },
      as(tokens.member)
    );
    http['member.post'] = { status: memberPost.status, rows: -1, titles: [], body: memberPost.text.slice(0, 300) };

    const memberDecides = await client.post(
      '/functions/decideMembership',
      { requestId: 'anything', approve: true },
      as(tokens.member)
    );
    http['member.decide'] = {
      status: memberDecides.status,
      rows: -1,
      titles: [],
      body: memberDecides.text.slice(0, 300)
    };

    // §8 — the directory read, both arms. The moderator's is the known-firing
    // signal that makes the member's 403 a refusal rather than an empty table.
    await read('moderator.directory', tokens.moderator, 'Member');
    await read('member.directory', tokens.member, 'Member');
    await read('anon.directory', null, 'Member');

    const anonAsks = await client.post('/functions/decideMembership', { requestId: 'anything', approve: true });
    http['anon.decide'] = { status: anonAsks.status, rows: -1, titles: [], body: anonAsks.text.slice(0, 300) };

    bundleStampAfter = stampViewer();

    // eslint-disable-next-line no-console
    console.log(
      `\n[TPL-001 drive] viewer bundle ${bundleStamp}` +
        (bundleStamp === bundleStampAfter ? ' (unchanged across the run)' : ` → ${bundleStampAfter} 🔴 SWAPPED`) +
        '\n' +
        Object.entries(http)
          .map(([k, v]) => `  HTTP ${k.padEnd(16)} ${v.status} rows=${v.rows} ${JSON.stringify(v.titles)}`)
          .join('\n') +
        '\n' +
        Object.entries(visits)
          .map(([k, v]) => `  PAGE ${k.padEnd(24)} ${JSON.stringify(v.text.replace(/\n/g, ' | ').slice(0, 160))}`)
          .join('\n')
    );
  });

  afterAll(async () => {
    if (service) await service.stop();
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ── §0 — the conditions ────────────────────────────────────────────────────

  describe('§0 the conditions the rest of the file depends on', () => {
    it('runs with row-level enforcement on', () => {
      expect(enforced).toBe(true);
    });

    it('refuses to create an account any way but the two the template ships', () => {
      // `signup: "nobody"`. If this ever returns 201 every reading below is
      // about a backend that is not the one the template configures.
      expect(signupStatus).toBe(403);
    });

    it('has a moderator and two askers, all minted through the product', () => {
      expect(Object.keys(tokens).sort()).toEqual(['member', 'moderator', 'pending']);
    });

    it('read one viewer bundle from start to finish', () => {
      // A shared checkout rewrites this file whenever a peer starts the dev
      // stack. If it moved mid-run the readings came from two runtimes, and the
      // honest thing is to say so rather than to attribute them to either.
      expect(bundleStamp).toBe(bundleStampAfter);
    });
  });

  // ── §1 — AC1's testable half ───────────────────────────────────────────────

  describe('§1 the shipped directory renders to a stranger', () => {
    it('draws the association a stranger came to read', () => {
      expect(visits['anon.landing'].text).toContain('St Anywhere');
      expect(visits['anon.landing'].text).toContain('A congregation that meets on Sundays.');
    });

    it('is not a white void, and logged nothing', () => {
      expect(visits['anon.landing'].text.length).toBeGreaterThan(20);
      expect(visits['anon.landing'].errors).toEqual([]);
    });

    it('offers the stranger the two doors the template has', () => {
      expect(buttons['anon.landing']).toEqual(expect.arrayContaining(['Members sign in', 'Ask to join']));
    });
  });

  // ── §2 — the known-firing read, which every absence below is measured against ─

  /**
   * 🔴 **The gate this section grades did not exist until phase 78 s7, and its
   * absence was invisible.**
   *
   * `Pages/SignIn`'s refusal was an ungated `Text` whose `text` was wired to
   * `Log In`'s `error`. An empty string renders nothing, so "always mounted" and
   * "hidden until there is something to say" looked identical on screen — and
   * every spec in this file was green over it. Giving the notice a box is what
   * made the difference observable: without a gate it would have shipped as a
   * padded, bordered, permanently empty card sitting under the sign-in form.
   *
   * ⚠️ The refusal's wording is the runtime's, not this template's, so these
   * arms grade **that a refusal appeared and no session was minted** rather than
   * a sentence — pinning a string here would be pinning somebody else's copy.
   */
  describe('§1b the door refuses a wrong password, and says so', () => {
    it('mints no session', () => {
      expect(sessions.wrongPassword).toBeNull();
    });

    it('says nothing before an attempt is made — the arm that makes the next one a statement', () => {
      expect(visits['signin.fresh'].text).toContain('Members sign in');
      expect(visits['signin.fresh'].errors).toEqual([]);
    });

    it('and says something once the attempt is refused', () => {
      expect(visits['signin.refused'].text.length).toBeGreaterThan(visits['signin.fresh'].text.length);
    });

    it('🔴 and the form is still there to try again, not replaced by the refusal', () => {
      expect(buttons['signin.refused']).toEqual(expect.arrayContaining(['Sign in']));
    });
  });

  describe('§2 AC2 — a member sees the announcements (the signal that must fire)', () => {
    it('the moderator reads the announcement over HTTP', () => {
      expect(`${http.moderator.status}/${http.moderator.rows}`).toBe('200/1');
      expect(http.moderator.titles).toEqual([ANNOUNCEMENT.title]);
    });

    it('and reads it in the browser, on the page a member uses', () => {
      expect(visits['moderator.members'].text).toContain(ANNOUNCEMENT.title);
    });

    it('the approved member reads it too, over HTTP', () => {
      // Two rows by now, not one: the seeded announcement and the one the
      // moderator typed into the Post page in §7.
      expect(`${http.member.status}/${http.member.rows}`).toBe('200/2');
      expect(http.member.titles.sort()).toEqual([ANNOUNCEMENT.title, TYPED.title].sort());
    });
  });

  // ── §3 — AC2's negative control ────────────────────────────────────────────

  describe('§3 AC2 — signed out, the same URLs yield nothing', () => {
    it('sends a stranger asking for /members back to the public page', () => {
      // The template does not merely hide the content: `standing.Visitor` is
      // wired to a RouterNavigate. So the reading is the landing page.
      expect(visits['anon.members'].text).toContain('Members sign in');
      // 🔴 **"Sign out", not "Announcements", and the swap is a correction to the
      // instrument rather than a relaxation of the check.** This line asserted
      // the absence of the word *Announcements* as a proxy for "the members page
      // did not render". In s8 the landing page gained a "what members can see"
      // tile whose title is that word, so the proxy began measuring the landing
      // page's own copy — it would now fail on a correct app and pass on an
      // incorrect one whose tile happened to be renamed.
      //
      // "Sign out" is the same claim with a marker the public pages cannot hold:
      // measured on the shipped artefact, it appears twice on `Pages/Members` and
      // zero times on `Landing`, `SignIn` and `Join`.
      //
      // ⚠️ **`text`, not `html`, and that is a reading rather than a preference.**
      // `html` was tried first and FAILED: the members page's chrome *is* in the
      // document for a stranger, unpainted — the page mounts, the standing check
      // answers `Visitor`, and the RouterNavigate takes them away. So this is the
      // same strength as the assertion it replaces (which also read `text`): the
      // stranger is not *shown* the members page.
      //
      // 🔴 That is not the leak it looks like, and the spec below is why: no
      // announcement title or body appears anywhere in `html`, painted or not.
      // The chrome is static graph text; the records are what ACL protects, and
      // they never arrive. That spec passed throughout this change.
      expect(visits['anon.members'].text).not.toContain('Sign out');
    });

    it('and the same for /meetings', () => {
      expect(visits['anon.meetings'].text).toContain('Members sign in');
    });

    it('🔴 leaves no announcement anywhere in the document, hidden or shown', () => {
      // Read off outerHTML, which holds unpainted content too — so this is an
      // absence in the whole document, not merely in what was painted.
      expect(visits['anon.members'].html).not.toContain(ANNOUNCEMENT.title);
      expect(visits['anon.members'].html).not.toContain(ANNOUNCEMENT.body);
      expect(visits['anon.meetings'].html).not.toContain(MEETING.title);
    });

    it('and the server refuses the read outright, not merely returning nothing', () => {
      expect(http.anon.status).not.toBe(200);
    });
  });

  // ── §4 — AC3 ───────────────────────────────────────────────────────────────

  describe('§4 AC3 — a pending member is refused exactly as a stranger is', () => {
    it('is genuinely signed in — the arm that makes the rest a statement about roles', () => {
      // Without this, "the pending member saw nothing" is equally consistent
      // with "the sign-in failed", which is the wrong finding entirely.
      expect(typeof sessions.pending).toBe('string');
      expect(String(sessions.pending).length).toBeGreaterThan(10);
    });

    it('is told where their request is, rather than shown an empty members area', () => {
      expect(visits['pending.members'].text).toContain('Your request to join is with the moderators');
    });

    it('🔴 sees no announcement in the document at all', () => {
      expect(visits['pending.members'].html).not.toContain(ANNOUNCEMENT.title);
      expect(visits['pending.members'].html).not.toContain(ANNOUNCEMENT.body);
      expect(visits['pending.meetings'].html).not.toContain(MEETING.title);
    });

    it('is refused by the server exactly as an anonymous stranger is', () => {
      // The two readings compared directly: same status, same body shape. This
      // is AC3's whole sentence — a signed-in person nobody approved is not a
      // member, and the deployed default (`authenticated`) would make them one.
      expect(`pending:${http.pending.status}`).toBe(`pending:${http.anon.status}`);
      expect(http.pending.rows).toBe(http.anon.rows);
    });

    it('is offered no moderator tools', () => {
      // `offered` and not `present` — see below. The moderator control for this
      // pair is §5's first spec, taken in the same run with the same instrument.
      expect(buttons['pending.members']).not.toContain('Post something');
      expect(buttons['pending.members']).not.toContain('Requests to join');
    });

    it('is turned away from the moderator screens by name, not by a blank page', () => {
      expect(visits['pending.post'].text).toContain('Only a moderator can post here.');
      expect(visits['pending.requests'].text).toContain('Only a moderator can see who is waiting to join.');
    });

    it('and cannot read the queue of requests, which names other people', () => {
      expect(visits['pending.requests'].html).not.toContain(JOINER.name);
    });
  });

  // ── §5 — AC4 ───────────────────────────────────────────────────────────────

  describe('§5 AC4 — a member cannot post, in the UI and on the server', () => {
    it('the moderator IS offered the tools — the control for the two below', () => {
      expect(buttons['moderator.members']).toEqual(
        expect.arrayContaining(['Post something', 'Requests to join'])
      );
    });

    it('the member is not offered them', () => {
      expect(buttons['member.members']).not.toContain('Post something');
      expect(buttons['member.members']).not.toContain('Requests to join');
    });

    it('and reaching the Post page by its URL is refused, not merely unlinked', () => {
      expect(visits['member.post'].text).toContain('Only a moderator can post here.');
      // Nothing to type into and nothing to press: the whole form is unpainted.
      expect(buttons['member.post']).not.toContain('Post it');
      expect(buttons['member.post']).not.toContain('Add it to the diary');
    });

    /**
     * ✅ **D7/D16 closed — the form is not in a member's document at all.**
     *
     * This spec used to record the opposite, and the sentence it recorded was:
     * *"the moderator's form ships in every member's document, hidden."* `tools`
     * was gated with `visible: false`, which renders as `visibility: hidden` and
     * **keeps the box**, so the announcement form, the meeting form and both
     * submit buttons sat in the markup a member's browser held. It was never a
     * data leak — the forms are empty and §5's server arm refuses the write
     * whatever a person does to the DOM — but it made one sentence false in the
     * obvious reading: *"the member's UI does not offer it"* was true only of
     * what was **painted**.
     *
     * Every gate in this template is now `mounted`, so the subtree is not in the
     * tree. The assertion is inverted rather than deleted, because a deleted
     * spec cannot notice the regression back.
     *
     * 🔴 **Two controls, because a bare absence proves nothing.** A `present`
     * reading that saw no form because the page never rendered, or because the
     * helper reads the wrong thing, would pass this on its own. So: the same
     * reading holds the refusal sentence (the page rendered), and the
     * moderator's reading of the same URL through the same helper DOES hold the
     * form (the helper can see one when it is there).
     */
    it('✅ D7/D16 — the form is not in the member’s document at all, not merely unpainted', () => {
      expect(inDocument['member.post']).not.toContain('Post it');
      expect(inDocument['member.post']).not.toContain('Add it to the diary');
      // Control 1 — the document rendered: it carries the refusal.
      expect(visits['member.post'].text).toContain('Only a moderator can post here.');
      // Control 2 — the instrument can see a form when there is one to see.
      expect(inDocument['moderator.post']).toContain('Post it');
      expect(inDocument['moderator.post']).toContain('Add it to the diary');
    });

    it('🔴 the server refuses the write regardless of what the UI offered', () => {
      // UI-only enforcement fails this AC. This is the half that matters.
      expect(http['member.post'].status).not.toBe(201);
      expect(http['member.post'].status).toBe(403);
    });

    it('and refuses a member calling the endpoint that mints members', () => {
      expect(http['member.decide'].status).not.toBe(200);
      expect(http['anon.decide'].status).not.toBe(200);
    });
  });

  // ── §7 — the writes the door could not check ───────────────────────────────

  /**
   * 🔴 **The half of AC4 that is about the moderator, and the only thing that
   * grades the Post page's wiring.**
   *
   * TPL-001 §11's first finding is that the MCP door does not verify a
   * connection to a component-instance port, an `in-*`/`out-*` on a
   * `CloudFunction2`, or a `prop-*` on a records node. This page is nothing but
   * those: five `prop-*` wires across two `NewDbModelProperties` nodes, plus a
   * `JavaScriptFunction` that stamps `postedAt` and fires `store`. A typo in any
   * of them writes a row with a missing field, or writes nothing, and the door
   * says the same thing either way. So this is typed, submitted and read back —
   * first by the page itself, then by a **different person** in a later visit.
   */
  describe('§7 a moderator posts by typing into the form the template ships', () => {
    it('the form is offered to the moderator', () => {
      expect(buttons['moderator.post']).toEqual(
        expect.arrayContaining(['Post it', 'Add it to the diary'])
      );
      expect(visits['moderator.post'].text).not.toContain('Only a moderator can post here.');
    });

    /**
     * 🔴 **The control pair D14 was found by, kept as a spec.**
     *
     * Both halves are needed and neither alone says anything. The confirmations
     * are `Condition` gates on a constant `true`, and *"wiring `eval` does not
     * stop the node testing on value change"* — so before D14 was fixed they
     * evaluated on the first frame and the Post page greeted a moderator with
     * **"Posted. Members can see it now."** before they had typed anything.
     *
     * ⚠️ And the spec that was supposed to catch that was passing: it clicked
     * "Post it" and then **navigated back to `/post`**, so it read a freshly
     * booted page. Showing the confirmation on boot is precisely the defect, so
     * the spec passed *because of* the bug — and went red when it was fixed.
     * `lookHere` reads in place, which is what grades the click.
     */
    it('does NOT say so before anything is posted — the D14 arm', () => {
      expect(visits['moderator.post'].text).not.toContain('Posted. Members can see it now.');
      expect(visits['moderator.post'].text).not.toContain('Added. Members can see it now.');
    });

    it('says so after the announcement is posted', () => {
      expect(visits['moderator.posted'].text).toContain('Posted. Members can see it now.');
    });

    it('and after the meeting is added', () => {
      expect(visits['moderator.added'].text).toContain('Added. Members can see it now.');
    });

    it('🔴 the announcement reaches a member with the words that were typed into it', () => {
      // Read by Mo, in a later visit, in a different session. A `prop-*` wire
      // that never landed shows up here as a row with an empty body.
      expect(visits['member.members'].text).toContain(TYPED.title);
      expect(http.member.titles).toEqual(expect.arrayContaining([TYPED.title]));
    });

    it('🔴 and so does the meeting, with its date, place and details', () => {
      expect(visits['member.meetings'].text).toContain(TYPED.meeting);
      expect(visits['member.meetings'].text).toContain(TYPED.place);
    });

    it('the typed row carries every field the form collected', async () => {
      // The page shows a title and a place; the row is where a dropped
      // `prop-body` or `prop-details` would still be invisible.
      const rows = await client.get<Rows>('/classes/Announcement', as(tokens.member));
      const typed = rows.json.results.find((r) => r.title === TYPED.title);
      expect(typed).toBeDefined();
      expect(typed?.body).toBe(TYPED.body);
      expect(typeof typed?.postedAt).toBe('string');

      const diary = await client.get<Rows>('/classes/Meeting', as(tokens.member));
      const added = diary.json.results.find((r) => r.title === TYPED.meeting);
      expect(added).toBeDefined();
      expect(added?.when).toBe(TYPED.when);
      expect(added?.place).toBe(TYPED.place);
      expect(added?.details).toBe(TYPED.details);
    });
  });

  // ── §6 — AC5 ───────────────────────────────────────────────────────────────

  describe('§6 AC5 — a moderator approves, and that person can read', () => {
    it('the moderator sees who is waiting, by name', () => {
      expect(visits['moderator.requests'].text).toContain(JOINER.name);
      expect(visits['moderator.requests'].text).toContain(PENDING.name);
    });

    it('the approval was made by clicking Approve in that person’s own row', () => {
      expect(approvedInBrowser).toBe(true);
    });

    it('and the queue no longer lists them, while the undecided one remains', () => {
      expect(visits['moderator.requestsAfter'].text).not.toContain(JOINER.name);
      expect(visits['moderator.requestsAfter'].text).toContain(PENDING.name);
    });

    it('the approved person signs in and reads the announcements', () => {
      expect(typeof sessions.member).toBe('string');
      expect(visits['member.members'].text).toContain(ANNOUNCEMENT.title);
    });

    it('and sees the diary too', () => {
      expect(visits['member.meetings'].text).toContain(MEETING.title);
    });

    it('🔴 while the person nobody approved is still refused — the pair that makes it about the approval', () => {
      // Same run, same instrument, same moment: one was approved and one was
      // not, and the only difference between the two readings is that click.
      expect(`${http.member.status}/${http.member.rows}`).toBe('200/2');
      expect(http.pending.status).not.toBe(200);
    });
  });

  // ── §8 — the member directory ──────────────────────────────────────────────

  /**
   * TPL-001 §3's *"see the member list"*, built on Richard's ruling of
   * 2026-08-28 and driven here for the first time.
   *
   * 🔴 **The load-bearing reading is the COUNT.** Two rows means two different
   * writers both worked: `claimAssociation` wrote the founding moderator's own
   * row at setup, and `decideMembership` wrote Mo's on the grant. One row would
   * pass a "the directory draws people" assertion and hide whichever of the two
   * never fired — and the setup one is the row a fresh install depends on, since
   * the moderator is the only person on it.
   */
  describe('§8 the directory lists who this app admitted, to moderators only', () => {
    it('the moderator is shown both people, by name', () => {
      const seen = visits['moderator.directory'].text;
      // D22 (s8): the founder's NAME, not their address. This spec pinned the
      // defect — setup had no name to write, so it filed the row under the
      // email and the directory showed the same string twice.
      expect(seen).toContain(MODERATOR.name);
      expect(seen).toContain(JOINER.name);
    });

    it('🔴 and the server agrees there are exactly two — the two writers both fired', () => {
      expect(`${http['moderator.directory'].status}/${http['moderator.directory'].rows}`).toBe('200/2');
      expect([...http['moderator.directory'].titles].sort()).toEqual([JOINER.name, MODERATOR.name].sort());
    });

    it('says what each of them is, in English rather than in role names', () => {
      // The column holds `member` / `moderator`; the row renders `STANDING_LABELS`.
      // P75's lesson on a surface a person reads: never draw the machine word.
      const seen = visits['moderator.directory'].text;
      expect(seen).toContain('Moderator');
      expect(seen).toContain('Member');
      expect(seen).not.toContain('role:admin');
    });

    it('🔴 and says what the list is NOT, because a projection that omits people silently is worse', () => {
      expect(visits['moderator.directory'].text).toContain('Somebody given access directly on the backend');
    });

    it('a member reaching it by URL is refused by name, not shown an empty list', () => {
      expect(visits['member.directory'].text).toContain('Only a moderator can see the member list');
    });

    it('🔴 with no member’s name anywhere in their document, painted or hidden', () => {
      // `outerHTML`, not `innerText`: `innerText` reports only what was painted,
      // so it would pass on a document that carried the name and hid it (§13).
      expect(visits['member.directory'].html).not.toContain(MODERATOR.email);
    });

    it('🔴 and the server refuses the read outright, beside a moderator’s that succeeds', () => {
      // The pair is the point. A refused query and an empty table are the same
      // `[]` to a browser and the opposite fix, so the moderator's 200/2 above
      // is what makes this 403 a refusal.
      expect(http['member.directory'].status).toBe(403);
      expect(http['anon.directory'].status).toBe(403);
    });
  });
});
