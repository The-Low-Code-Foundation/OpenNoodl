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

/**
 * 🔴 **The removal drives its OWN row, and that is not tidiness.**
 *
 * §9 deletes an announcement. Deleting `TYPED.title` instead would move the
 * population every other reading in this file is taken against — §2's
 * known-firing read, the HTTP arms, the member's noticeboard — so a green run
 * would be proving the harness had agreed with itself. This row is posted,
 * removed, and gone again inside the moderator's own session, and nothing
 * before or after it moves.
 */
const REMOVABLE = { title: 'Posted by mistake', body: 'This one should not have gone up.' };

/** What the confirm step says. `tpl001Vocabulary.CONFIRM_REMOVE_TEXT`, on the screen. */
const CONFIRM_TEXT = 'This cannot be undone. Members will no longer see it.';
const REMOVE_ANNOUNCEMENT = 'Remove this announcement';

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
  /** One page load's landmarks, counted in the rendered document. */
  interface Landmarks {
    mains: number;
    h1s: number;
    /** `<h1>`s that are DOM descendants of the one `<main>`. */
    h1sInMain: number;
    navsInDoc: number;
    /** `<nav>`s that are DOM descendants of the one `<main>` — must be zero. */
    navsInMain: number;
  }
  /**
   * What each reading OFFERED — rendered, painted, clickable — and what was
   * merely PRESENT in the document. Two different claims; see `Control`.
   */
  const buttons: Record<string, string[]> = {};
  const inDocument: Record<string, string[]> = {};
  /** Every HTTP reading, same idea. */
  const http: Record<string, Reading> = {};
  /**
   * 🔴 **How many times each page load asked the server who the person is.**
   *
   * D29's subject, measured rather than inferred from the graph. One
   * `Members/Standing` instance makes exactly one `myStanding` call when its
   * `Check` fires, so counting instances would be a proxy — this counts the
   * requests the browser actually made, which is the thing that costs a person
   * a round trip.
   *
   * ⚠️ Read from `performance.getEntriesByType('resource')`, whose buffer is
   * per-document. `look` navigates, so each reading covers that page load and
   * no other. `lookHere` does not navigate and would report the load it sits
   * on, so it deliberately does not record one.
   */
  const standingCalls: Record<string, number> = {};
  /**
   * 🔴 **§11 — the document outline as the BROWSER builds it, not as the
   * artefact declares it.** REL-002c §8.7 gates the `as` parameters on disk,
   * and a parameter is an intention: nothing in that gate says the runtime
   * turns `as: 'main'` on a `Group` into a `<main>` element, or that a child
   * node ends up a DOM descendant of its parent's element. This is the same
   * claim taken one layer down, on the pages this drive already visits.
   */
  const landmarks: Record<string, Landmarks> = {};
  /** What the browser held after each sign-in — a session, or nothing. */
  const sessions: Record<string, string | null> = {};
  let enforced = false;
  let signupStatus = -1;
  let approvedInBrowser = false;
  /** The ids §9 needs, read over HTTP because the URL is `/announcements/{id}`. */
  let removableId = '';
  let typedId = '';
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

  /**
   * The objectId of the announcement titled `title`, as the moderator.
   *
   * ⚠️ Over HTTP rather than scraped from a row's link, deliberately: the id in
   * the URL is the thing under test on the detail page, and reading it from the
   * page that builds that URL would make the navigation grade itself.
   */
  const idOfAnnouncement = async (title: string): Promise<string> => {
    const res = await client.get<Rows>('/classes/Announcement', as(tokens.moderator));
    const row = (res.json?.results ?? []).find((r) => String(r.title) === title);
    if (!row) throw new Error(`no announcement titled "${title}"`);
    return String(row.objectId);
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

      /**
       * The `myStanding` requests THIS document made, counted at the browser.
       *
       * ⚠️ Cross-origin — the backend is on its own port — so the entry carries
       * a name and no timing detail. The name is all this needs.
       */
      const countStanding = async (): Promise<number> =>
        Number(
          await page.evaluate(
            "performance.getEntriesByType('resource').filter(function (e) {" +
              " return e.name.indexOf('myStanding') !== -1; }).length"
          )
        );

      const look = async (label: string, url: string) => {
        visits[label] = await readVisit(page, url);
        const cs = await controls(page, 'button');
        buttons[label] = offered(cs);
        inDocument[label] = present(cs);
        standingCalls[label] = await countStanding();
        landmarks[label] = (await page.evaluate(
          '(function () {' +
            " var m = document.querySelectorAll('main');" +
            " var one = m.length === 1 ? m[0] : null;" +
            ' return {' +
            ' mains: m.length,' +
            " h1s: document.querySelectorAll('h1').length," +
            " h1sInMain: one ? one.querySelectorAll('h1').length : 0," +
            " navsInDoc: document.querySelectorAll('nav').length," +
            " navsInMain: one ? one.querySelectorAll('nav').length : 0 };" +
            '})()'
        )) as Landmarks;
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

      // ── §9 — the moderator takes something down again ──────────────────
      //
      // 🔴 On its own row, posted here and gone before §8 reads anything. See
      // `REMOVABLE`. It is driven in FOUR steps because three different claims
      // hang off them: that the control is offered at all, that the confirm is
      // a real gate in BOTH directions, and that the delete actually happened.
      await look('moderator.postRemovable', '/post');
      await fill(page, 'Title', REMOVABLE.title, 0);
      await fill(page, 'What you want to say', REMOVABLE.body);
      await clickButton(page, 'Post it');
      await lookHere('moderator.postedRemovable', 'Posted. Members can see it now.');

      removableId = await idOfAnnouncement(REMOVABLE.title);
      // The detail page: the removal is offered, and the question is not asked
      // until it is. Both readings come off the same visit.
      await look('moderator.announcement', `/announcements/${removableId}`);

      // 🔴 "Keep it" first. A confirm step that only works in the destructive
      // direction is not a confirm step — and the arm that would have caught
      // `confirmClear` being wired to the wrong condition is this one, not the
      // one that removes the row.
      await clickButton(page, REMOVE_ANNOUNCEMENT);
      await lookHere('moderator.confirmAsked', CONFIRM_TEXT);
      await clickButton(page, 'Keep it');
      await lookHere('moderator.confirmKept');
      await read('afterKeep', tokens.moderator);

      // …and now actually remove it.
      await clickButton(page, REMOVE_ANNOUNCEMENT);
      await lookHere('moderator.confirmAgain', CONFIRM_TEXT);
      await clickButton(page, 'Yes, remove it');
      // `del.done` navigates to the noticeboard, so the settled reading is the
      // list — which is also where the row's absence is legible to a person.
      await lookHere('moderator.removed', 'Announcements');
      await read('afterRemoval', tokens.moderator);

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
      // §9's negative arm, on the row that still exists: a member reading an
      // announcement in full is the known-firing signal that makes the absence
      // of the removal a refusal rather than a page that failed to render.
      typedId = await idOfAnnouncement(TYPED.title);
      await look('member.announcement', `/announcements/${typedId}`);
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
      // 🔴 **`Requests`, the band's pill — `Requests to join` no longer exists.**
      // REL-002c item 2 deleted that button and the two beside it: each named a
      // PLACE the band's nav already names in the same word, three inches above
      // it on the same page. The moderator-only affordances on `/members` are
      // now the section's one call to action and the band's three gated pills,
      // and this pair tests one of each.
      expect(buttons['pending.members']).not.toContain('Requests');
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
        // See the note on the pending arm above: `Requests to join` was deleted
        // by REL-002c item 2 and `Requests` is the band's moderator-only pill
        // that replaced it as the way to that page.
        expect.arrayContaining(['Post something', 'Requests'])
      );
    });

    it('the member is not offered them', () => {
      expect(buttons['member.members']).not.toContain('Post something');
      expect(buttons['member.members']).not.toContain('Requests');
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

    /**
     * 🔴 **The sentence changed, and what changed it is the evidence.** The page
     * still ships `Posted. Members can see it now.` as the confirmation's
     * standing text — and this reading is taken *after* TPL-002's fan-out has
     * answered and replaced it. Nobody in this drive ticked the opt-in box, so
     * the answer is the zero-recipient one, said out loud rather than left
     * silent (TPL-002 §3: a silent post is indistinguishable from one whose
     * emails all failed, and the moderator's next action differs completely).
     *
     * ⚠️ So this row now grades the whole Post-page chain in a real browser:
     * `createAnnouncement.done` → `announce` → `notifyMembers` → `report` →
     * the confirmation's `text`. It is the only reading in either suite that
     * proves the browser half of TPL-002 is wired at all — the endpoint's own
     * behaviour is graded in `tpl002-notifications.test.ts`, over HTTP, where no
     * page is involved.
     */
    it('says so after the announcement is posted, and says what the emails did', () => {
      expect(visits['moderator.posted'].text).toContain('Posted.');
      expect(visits['moderator.posted'].text).toContain('Nobody has asked to be emailed yet');
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

  // ── §9 — the removal ───────────────────────────────────────────────────────

  /**
   * 🔴 **The gap this closes was in the app, not in the policy.**
   * `nodegx.security.json` has granted `role:admin` `delete` on `Announcement`
   * and `Meeting` since it was written; no browser graph ever placed a `Delete
   * Record`, so a moderator who posted the harvest supper on the wrong Saturday
   * had to open the backend. Richard ruled on 2026-08-29 to close it and to
   * seed no sample content, the two being the same decision: examples you
   * cannot delete are worse than an empty noticeboard.
   *
   * ⚠️ **Everything here needs execution and nothing else can supply it.** The
   * reveal is `chrome.isModerator` — a component-instance port, published by
   * the band so the two detail pages need no standing check of their own.
   * `tpl001Template.test.ts` proves the port is declared and the wire names it;
   * only this proves the value arrives.
   *
   * 🔴 **`outerHTML` is the WRONG instrument for most of this block, and the
   * first draft used it on all four specs.** The file's standing rule is to
   * read absences off `html` because `innerText` would pass on content fetched
   * and merely unpainted. That rule is about **records**. A deployed page
   * carries the entire project graph in `window.projectData` inside a
   * `<script>`, so every *static* string in the app — every button label, every
   * notice — is in every visitor's document, including a stranger's. Three
   * specs here failed on exactly that, and each would have read as a leak.
   *
   * ⚠️ So the instrument is chosen per claim, and the rule is what the string
   * IS rather than which reading sounds stricter:
   *
   * | claim about | honest reading | why |
   * |---|---|---|
   * | a **record** (`REMOVABLE.title`) | `html` | in the document only if it was fetched |
   * | a **control** the graph declares | `inDocument` | `<button>` elements only — a `<script>` is not one |
   * | a **sentence** the graph declares | `text` | `body.innerText`; a `<script>` renders nothing |
   *
   * s8 learned the first half of this — §3 swapped `html` for `text` when a
   * tile's static word broke a proxy. This is the same finding, stated as a
   * rule rather than repaired at the one site that showed it.
   */
  describe('§9 a moderator can take an announcement down, and a member cannot', () => {
    it('the moderator is offered the removal on the detail page, and is not asked yet', () => {
      // The known-firing half: the page rendered the record it was opened for.
      expect(visits['moderator.announcement'].text).toContain(REMOVABLE.title);
      expect(visits['moderator.announcement'].text).toContain(REMOVABLE.body);
      expect(buttons['moderator.announcement']).toContain(REMOVE_ANNOUNCEMENT);

      // 🔴 …and the question is NOT on the page until it is asked — absent from
      // the document, not merely unpainted. `inDocument` is `textContent` over
      // the `<button>` elements, so an unpainted control would still count.
      expect(visits['moderator.announcement'].text).not.toContain(CONFIRM_TEXT);
      expect(inDocument['moderator.announcement']).not.toContain('Yes, remove it');
      expect(inDocument['moderator.announcement']).not.toContain('Keep it');
    });

    it('asking puts the question up, and "Keep it" takes it down again without deleting', () => {
      expect(visits['moderator.confirmAsked'].text).toContain(CONFIRM_TEXT);
      expect(buttons['moderator.confirmAsked']).toEqual(
        expect.arrayContaining(['Yes, remove it', 'Keep it'])
      );

      // 🔴 The arm that grades the confirm as a GATE rather than as a label.
      expect(visits['moderator.confirmKept'].text).not.toContain(CONFIRM_TEXT);
      expect(inDocument['moderator.confirmKept']).not.toContain('Yes, remove it');
      // …and the way back in is still offered, so "Keep it" put the question
      // away rather than the whole block.
      expect(buttons['moderator.confirmKept']).toContain(REMOVE_ANNOUNCEMENT);
      // And the row is still there — "Keep it" kept it.
      expect(http['afterKeep'].titles).toContain(REMOVABLE.title);
    });

    it('confirming removes the row and puts the moderator back on the noticeboard', () => {
      expect(visits['moderator.removed'].text).toContain('Announcements');
      // Gone from the page a person reads…
      expect(visits['moderator.removed'].html).not.toContain(REMOVABLE.title);
      // …and gone from the backend, which is the claim that matters. Read as
      // the moderator, whose read of the same collection returns the other
      // announcement — so an empty answer cannot be mistaken for a refusal.
      expect(http['afterRemoval'].status).toBe(200);
      expect(http['afterRemoval'].titles).not.toContain(REMOVABLE.title);
      expect(http['afterRemoval'].titles).toContain(TYPED.title);
    });

    it('🔴 a member reading the same kind of page is offered no way to remove it', () => {
      // The known-firing signal, in the same run on the same instrument: the
      // member's page rendered the announcement in full.
      expect(visits['member.announcement'].text).toContain(TYPED.title);
      expect(visits['member.announcement'].text).toContain(TYPED.body);

      // …and the removal is absent from their DOCUMENT, not merely unpainted.
      // `inDocument` is `textContent` over the buttons, so a control hidden by
      // a regression back to `visible` would still be counted here.
      expect(inDocument['member.announcement']).not.toContain(REMOVE_ANNOUNCEMENT);
      expect(visits['member.announcement'].text).not.toContain(CONFIRM_TEXT);
      // Beside a control that IS in their document, so the line above is a
      // measurement rather than an empty census.
      expect(inDocument['member.announcement']).toContain('Sign out');
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

  /**
   * §10 — D29. **Every signed-in page asks the server who you are exactly once.**
   *
   * Until s13 the five pages carrying their own `Members/Standing` asked twice:
   * once for the page's gates, once for the band's three moderator-only doors.
   * The band now publishes the answer it already has and those five read it, so
   * there is one call per page load and the gates did not move — §2 to §9 above
   * are the evidence for the second half of that sentence, and this section is
   * the evidence for the first.
   *
   * 🔴 **Counted at the browser, not inferred from the graph.** A spec that
   * counted `Members/Standing` instances would pass on a template that placed
   * one instance and called it twice, and would fail on one that placed two and
   * called neither — neither of which is what a person pays for. What costs
   * them a round trip is a request, so a request is what is counted.
   */
  /**
   * 🔴 **§11 — REL-002c §8.7, taken in the browser instead of on disk.**
   *
   * §8.7 in `tpl001Template.test.ts` reads the `as` parameters out of the
   * shipped JSON and asserts that each page's `h1` node is a descendant of its
   * `main` node. That is an assertion about what was AUTHORED. Two things it
   * cannot see: whether `as: 'main'` on a `Group` reaches the DOM as a `<main>`
   * element at all, and whether the node tree and the element tree agree. Both
   * were assumed by the change that moved the landmark onto `pageMain`, and an
   * assumption that a gate cannot see is the shape of every hole in one.
   *
   * ⚠️ **It grades the pages this drive ALREADY visits** — fifteen loads across
   * four signed-in states — rather than adding navigation for its own sake. The
   * pictures in `vib001-members.look.ts` cannot do this job: a landmark is
   * invisible by construction, and 200 of 200 PNGs were byte-identical across
   * the change that moved it.
   */
  describe('§11 the document outline the browser actually builds', () => {
    const loaded = () => Object.keys(landmarks).sort();

    it('control: there are page loads to grade, and every one recorded its landmarks', () => {
      // `every` over an empty list is vacuously true — the way this section
      // would go quietly green if `look` stopped taking the reading.
      expect(loaded().length).toBeGreaterThan(15);
      expect(loaded().filter((k) => typeof landmarks[k]?.mains !== 'number')).toEqual([]);
    });

    it('🔴 every rendered page has exactly one <main> and exactly one <h1>', () => {
      const wrong = loaded()
        .filter((k) => landmarks[k].mains !== 1 || landmarks[k].h1s !== 1)
        .map((k) => `${k}: ${landmarks[k].mains} main, ${landmarks[k].h1s} h1`);
      expect(wrong).toEqual([]);
    });

    it('🔴 and the <h1> is INSIDE the <main> — the defect §8.7 was written for', () => {
      // On disk this was twelve pages of thirteen. In the browser it is every
      // load this drive takes, and it is the reading that says the parameter
      // reached the element tree rather than merely the file.
      const wrong = loaded()
        .filter((k) => landmarks[k].h1sInMain !== 1)
        .map((k) => `${k}: ${landmarks[k].h1sInMain} h1 inside main`);
      expect(wrong).toEqual([]);
    });

    it('🔴 CONTROL — the band’s <nav> is in the document and NOT in the <main>', () => {
      // 🔴 **Without this the check above proves nothing about containment.**
      // A probe that answered "inside" for everything in the document would
      // pass it on every page. The band is the one landmark deliberately left
      // outside `pageMain`, so it is the reading that separates "in the
      // document" from "inside the main" — and it is taken where a `<nav>` is
      // known to exist, because a signed-out page has none (REL-002b gates
      // `navWrap` on `isSignedIn`, so the landmark leaves with its contents).
      const withNav = loaded().filter((k) => landmarks[k].navsInDoc > 0);
      expect(withNav.length).toBeGreaterThan(8);
      expect(withNav.filter((k) => landmarks[k].navsInMain !== 0).map((k) => `${k}: nav inside main`)).toEqual([]);

      // And the other arm of the same control: a signed-out load has no `<nav>`
      // at all, so "0 inside main" above is not simply "0 anywhere".
      expect(landmarks['anon.landing'].navsInDoc).toBe(0);
    });
  });

  describe('§10 D29 — one standing check per page, not two', () => {
    /** Every reading `look` took, i.e. every page load. `lookHere` records none. */
    const loads = () => Object.keys(standingCalls).sort();

    it('control: the landing page asks nobody, so a count of one below is a reading', () => {
      // 🔴 The negative control. Without it, "1" everywhere would be equally
      // consistent with an instrument that cannot tell requests apart at all.
      // The landing page carries no band and no standing gate, and reads 0.
      expect(standingCalls['anon.landing']).toBe(0);
    });

    it('control: there are page loads to grade, and every one of them was recorded', () => {
      // Guards the shape of the assertion below: `every` over an empty list is
      // vacuously true, which is the way this section could go quietly green.
      expect(loads().length).toBeGreaterThan(15);
      expect(loads().filter((k) => typeof standingCalls[k] !== 'number')).toEqual([]);
    });

    it('🔴 every page carrying the band asks exactly once', () => {
      const banded = loads().filter((k) => k !== 'anon.landing');
      const wrong = banded.filter((k) => standingCalls[k] !== 1).map((k) => `${k}=${standingCalls[k]}`);
      expect(wrong).toEqual([]);
    });

    it('🔴 including the two detail pages, which have no standing gate of their own', () => {
      // These two never had the second call — they gate on the record read and
      // take `isModerator` from the band. Stated separately because they are the
      // pages where a REGRESSION would show as a rise from one to two, and the
      // assertion above would report that in a list of fifteen.
      expect(standingCalls['member.announcement']).toBe(1);
      expect(standingCalls['moderator.announcement']).toBe(1);
    });
  });
});
