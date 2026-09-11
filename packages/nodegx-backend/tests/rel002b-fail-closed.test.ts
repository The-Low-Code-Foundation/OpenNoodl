/**
 * REL-002b — does the members' gate **fail closed**, and does a first run with
 * no backend **say anything**?
 *
 * Phase 81 filed two register rows against this template and phase 82 owns
 * them:
 *
 * - **V3** — "the chrome gates on `done` only, so it fails open when no backend
 *   is bound: the gate's failure mode is to show the protected surface."
 * - **V4** — "no state for *the query was never answered*, so first run renders
 *   a bare eyebrow and two buttons."
 *
 * ## 🔴 V3's recorded MECHANISM was wrong, and the correction is the reason
 * ## this file measures a URL rather than a list of hidden things
 *
 * Measured at HEAD before anything was built: every gated group on all six
 * protected pages already carried `mounted: false`, so the member and moderator
 * CONTENT was never revealed by a failed standing read. "Fails open into the
 * protected surface" was not what the artefact did.
 *
 * What it did do was worse in a way the row had not named: with no backend
 * bound, all six protected screens **stayed at their own URL**, wearing the
 * full members' band — `Sign out`, the association slot, three nav buttons —
 * and five of the six said nothing whatever about why they were otherwise
 * empty. The content was hidden by six defaults; nothing had *refused*. That
 * distinction is not academic: a seventh page added by the person who installs
 * this template inherits the refusal if the refusal is a decision, and inherits
 * nothing if it was six defaults.
 *
 * So the observable here is **where the reader ends up**, which is a property of
 * the gate, and not **what is hidden**, which is a property of each page's
 * parameters. `Visit.url` cannot answer it — it echoes the URL that was
 * REQUESTED — so every arm reads `location.pathname` out of the live page.
 *
 * ## The four arms, and why each of the other three exists
 *
 * | arm | backend | session | what it establishes |
 * |---|---|---|---|
 * | **member** | real, complete | signed in, moderator | 🔴 the CONTROL |
 * | **visitor** | real, complete | none | the server's own refusal ejects |
 * | **unreadable** | real, `myStanding` NOT deployed | signed in, moderator | the *failure* ejects |
 * | **unbound** | none at all | none | V4: the first run has a screen |
 *
 * ## 🔴 Richard's judgement 4, 2026-09-04 — the destination is `/sign-in`
 *
 * This file originally asserted every refused arm landed on `/`. He was shown
 * that `/` and `/members` were byte-identical for an unauthenticated reader and
 * ruled *"send them to `/sign-in` instead"*: being handed the landing page is
 * no acknowledgement that you were moved, and the page a refused reader
 * actually needs is the one that lets them back in.
 *
 * ⚠️ **The gate did not change and neither did this file's claim.** Same
 * signal, same two producers, same six pages, same fail-closed. Only the
 * destination moved, so every `landed` assertion below moved with it — and
 * each is now paired with the door's own painted `Sign in` button, because a
 * pathname on its own would pass on a blank page.
 *
 * 🔴 **The member arm is what makes the other three mean anything.** Three arms
 * that all end on `/sign-in` are equally consistent with a template that ejects
 * everybody — a gate wired to refuse unconditionally would pass a
 * visitor-and-failure-only spec perfectly, and would also be a broken product.
 * So the member arm asserts the opposite outcome on the same page through the
 * same graph: it STAYS on `/members`, and it is offered the band. That is the
 * "known-firing signed-in read" the acceptance criterion asks the absence to be
 * read beside — without it, "the visitor was ejected" is equally good evidence
 * that `myStanding` is simply broken for everyone.
 *
 * 🔴 **The `unreadable` arm varies ONE thing** — `myStanding` is left out of the
 * deployed bundle, so the backend answers its call 404 while remaining a real,
 * enforcing backend that mints this person's account and session through the
 * product's own doors. Both facts are asserted over HTTP inside the run rather
 * than assumed: the function really is absent (404) and the session really is
 * good (`/functions/myNotifySetting` answers 200 for the same token on the same
 * backend). Without that pair, "ejected" is equally consistent with a session
 * that was never valid.
 *
 * ⚠️ **`unbound` is a different claim from the other three and is not evidence
 * about the gate.** With nothing bound, `DbCollection2` never fires `failure`
 * at all — the request 200s with the host page's HTML, `JSON.parse` throws
 * inside `ParseWireAdapter._makeRequest`, and the node hears nothing (filed as
 * an open defect; see the task file). That is exactly why the landing page's
 * waiting state is a mounted-by-default card taken DOWN by an answer, rather
 * than a card put up by `failure`: the second design would be dead in the only
 * case it exists for. §4's control is the half that proves the card is not
 * simply always on.
 */
import { BackendService } from '../src/service';

import { bundleAuthoredComponents } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import {
  CLOUD_KEYS,
  bundleMembersCloud,
  controls,
  copyTemplateProject,
  makeMembersDataDir,
  offered,
  present,
  SETUP_TOKEN,
  signIn
} from './helpers/members-drive';
import { bindProjectToBackend, readVisit, Visit, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const MODERATOR = { name: 'Wren Alderley', email: 'mod@rel002b.invalid', password: 'pw-moderator' };
const ASSOCIATION = { name: 'The Harbour Trust', blurb: 'We look after the harbour.' };

/** Every protected screen the band is placed on. */
const PROTECTED = ['/members', '/meetings', '/post', '/requests', '/directory', '/account'];

/** The landing page's own words, so a redirect is legible as an arrival. */
const WAITING_HEADING = 'This members’ area is not connected yet';

/**
 * Where a refused reader is sent — Richard's judgement 4. `/Pages/SignIn`'s
 * `urlPath`, so this constant and the artefact say the same thing.
 */
const DOOR = '/sign-in';

/**
 * The door's own submit button. `Pages/Landing` offers `Members sign in` and
 * `Pages/SignIn` offers `Sign in`, and `buttons` holds whole labels, so this
 * distinguishes the two pages rather than merely finding the words.
 */
const DOOR_BUTTON = 'Sign in';

/** Where the page actually IS — `Visit.url` echoes the request, not `location`. */
const WHERE = `(function () { return location.pathname; })()`;

interface Landed {
  /** The URL asked for. */
  requested: string;
  /** `location.pathname` once the page settled. */
  landed: string;
  visit: Visit;
  /** Painted button text, so a dead page is distinguishable from a gated one. */
  buttons: string[];
  /** Button text present in the markup, painted or not — the stronger absence. */
  markup: string[];
}

describe('REL-002b — the members’ gate fails closed, and a first run has a screen', () => {
  /** `<arm>.<url>` → where that visit ended up. */
  const at: Record<string, Landed> = {};
  const services: BackendService[] = [];

  /** Sign in, go somewhere, and report where you actually ended up. */
  async function land(
    page: { evaluate(e: string): Promise<unknown> } & Parameters<typeof readVisit>[0],
    arm: string,
    url: string
  ): Promise<void> {
    const visit = await readVisit(page, url);
    // A navigation triggered by a signal can land after `readVisit` has settled
    // on the text of the page it is leaving, so the position is read separately
    // and after a beat.
    await new Promise((r) => setTimeout(r, 1200));
    const landed = String(await page.evaluate(WHERE));
    const cs = await controls(page, 'button');
    at[`${arm}.${url}`] = { requested: url, landed, visit, buttons: offered(cs), markup: present(cs) };
  }

  /** HTTP facts asserted inside the run, so an arm cannot be a broken session. */
  const http: Record<string, number> = {};
  /**
   * 🔴 What the BROWSER's own session was in each signed-in arm, and what the
   * server said about it.
   *
   * The first run of this file failed §1 with the member on `/`, which is
   * equally consistent with "the gate ejects everybody" and with "the browser
   * never signed in". Reading the token the product's own form put in storage —
   * and asking the server what standing it carries — is what tells the two
   * apart, and it is exactly the check `signIn`'s return value was offering and
   * this file was throwing away.
   */
  const session: Record<string, { token: string | null; standing: string | null; status: number; body: string }> = {};

  beforeAll(async () => {
    // ── Backend A — the real, complete one. Arms `member` and `visitor`. ─────
    const projectA = copyTemplateProject('rel002b-full');
    const dataA = makeMembersDataDir(bundleMembersCloud(projectA), 'rel002b-full');
    const serviceA = new BackendService({ dataDir: dataA, port: 0, backendId: 'rel002b-full', backendName: 'Full' });
    services.push(serviceA);
    const startedA = await serviceA.start();
    // 🔴 The precondition every drive in this directory opens with: with
    // `devOpen` on, row-level ACL is off and this measures a different app.
    expect(startedA.security.enforced).toBe(true);
    bindProjectToBackend(projectA, 'rel002b-full', startedA.listen.port);
    const clientA = httpClient(() => startedA.listen.url);

    http.claimOnA = await clientA
      .post('/functions/claimAssociation', {
        setupToken: SETUP_TOKEN,
        associationName: ASSOCIATION.name,
        blurb: ASSOCIATION.blurb,
        moderatorName: MODERATOR.name,
        email: MODERATOR.email,
        password: MODERATOR.password
      })
      .then((r) => r.status);
    // A session minted OUTSIDE the browser, so "the browser's token is not
    // accepted" can be told apart from "this account has no standing at all".
    const directA = await clientA
      .post<{ sessionToken: string }>('/login', { username: MODERATOR.email, password: MODERATOR.password })
      .then((r) => r.json.sessionToken);
    const directStanding = await clientA.post<{ result?: { standing?: string } }>(
      '/functions/myStanding',
      {},
      { 'x-parse-session-token': directA }
    );
    session.direct = {
      token: directA,
      standing: directStanding.json?.result?.standing ?? null,
      status: directStanding.status,
      body: JSON.stringify(directStanding.json).slice(0, 400)
    };

    // ── Arm 1: the CONTROL, in a browser of its own ─────────────────────────
    //
    // 🔴🔴 **THE ORDER OF THIS BLOCK AND BACKEND B's `start()` IS LOAD-BEARING.
    // DO NOT MOVE IT.**
    //
    // Measured, one variable at a time: with `serviceB.start()` ABOVE this
    // block, the browser signs in perfectly — localStorage holds a well-formed
    // `currentUser` with `roles: ["admin"]` and an `r:`-prefixed session token
    // — and then the backend calls that very token a **visitor**
    // (`myStanding` → `{"result":{"standing":"visitor"}}`) and answers a
    // member-only function **500**. A session minted seconds earlier over HTTP
    // against the SAME backend still reads `moderator`. Moving this block
    // above `serviceB.start()` and changing nothing else turns all eight of
    // those assertions green.
    //
    // So: **starting a second `BackendService` in the same process invalidates
    // sessions the first one issued.** That cost the better part of this task
    // and it presents as a template defect — a signed-in moderator ejected by
    // the gate — which is exactly what this file was built to grade. It is
    // registered as an open defect against the backend; see the task file.
    // Until it is fixed, a drive that needs two backends must finish with the
    // first before starting the second.
    //
    // 🔴 **A browser per arm, and that is not tidiness.** The first version of
    // this file took the visitor arm and the member arm on ONE page, visitor
    // first. The member arm then failed with the server calling the browser's
    // own token a `visitor` — and the token was not a valid session at all,
    // while a login minted over HTTP seconds earlier was. Signing in *after*
    // that page had been ejected six times produced a stored session the
    // server would not accept. Whatever that is, it is not what this file is
    // about, and an arm that carries it is measuring two things at once. It is
    // kept as its own arm below (`ejected-then-signed-in`) rather than
    // discarded, because it is a route a real person takes.
    await withRenderedPage({ projectDir: projectA, backendPort: startedA.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });

      const token = await signIn(page, MODERATOR.email, MODERATOR.password);
      // ⚠️ `/functions/:name` answers Parse-wire shape — `{ result: … }` — not
      // the function's own outputs at the top level. Reading `json.standing`
      // here returned `null` for a session the server was perfectly happy
      // with, which reads exactly like a refusal and is a fact about this line.
      const answered = await clientA.post<{ result?: { standing?: string } }>(
        '/functions/myStanding',
        {},
        token ? { 'x-parse-session-token': token } : {}
      );
      // Is the browser's token a valid SESSION at all, or merely a string?
      // `myNotifySetting` is member-only, so a 200 means the server accepted
      // it and the `visitor` answer would have to come from somewhere else.
      http.notifyOnA_browserToken = await clientA
        .post('/functions/myNotifySetting', {}, token ? { 'x-parse-session-token': token } : {})
        .then((r) => r.status);
      session.member = {
        token,
        standing: answered.json?.result?.standing ?? null,
        status: answered.status,
        body: JSON.stringify(answered.json).slice(0, 400)
      };
      for (const url of PROTECTED) await land(page, 'member', url);
      await land(page, 'member', '/');
    });

    // ── Arm 2: the visitor, in a browser that has never held a session ──────
    await withRenderedPage({ projectDir: projectA, backendPort: startedA.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });
      for (const url of PROTECTED) await land(page, 'visitor', url);
      await land(page, 'visitor', '/');
    });

    // ── Arm 2b: ejected first, THEN signed in — the route a person takes ────
    //
    // Somebody follows a link to `/members`, is bounced to the sign-in door,
    // signs in, and goes back. Recorded because the first draft of this file
    // hit it by accident; §5 grades it separately so a failure there does not
    // read as a failure of the gate.
    //
    // ⚠️ Judgement 4 shortened this route rather than changing it: `signIn`
    // navigates to `/sign-in` itself, so the arm drives identically whether the
    // bounce delivered the reader there or to `/`.
    await withRenderedPage({ projectDir: projectA, backendPort: startedA.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });
      await land(page, 'ejected', '/members');
      const token = await signIn(page, MODERATOR.email, MODERATOR.password);
      const answered = await clientA.post<{ result?: { standing?: string } }>(
        '/functions/myStanding',
        {},
        token ? { 'x-parse-session-token': token } : {}
      );
      session.ejected = {
        token,
        standing: answered.json?.result?.standing ?? null,
        status: answered.status,
        body: JSON.stringify(answered.json).slice(0, 400)
      };
      await land(page, 'ejected-after', '/members');
    });

    // ── Backend B — real and enforcing, with ONE function left undeployed. ──
    //
    // 🔴 Derived by SUBTRACTION from the same disk-derived list the complete
    // bundle uses, and asserted non-empty below. A hand-typed list of seven
    // would silently stop excluding anything the day a ninth function is added.
    const projectB = copyTemplateProject('rel002b-nostanding');
    const withoutStanding = CLOUD_KEYS.filter((k) => k !== '__cloud__/myStanding');
    expect(withoutStanding).toHaveLength(CLOUD_KEYS.length - 1);
    const dataB = makeMembersDataDir(bundleAuthoredComponents(projectB, withoutStanding), 'rel002b-nostanding');
    const serviceB = new BackendService({
      dataDir: dataB,
      port: 0,
      backendId: 'rel002b-nostanding',
      backendName: 'No standing'
    });
    services.push(serviceB);
    const startedB = await serviceB.start();
    expect(startedB.security.enforced).toBe(true);
    bindProjectToBackend(projectB, 'rel002b-nostanding', startedB.listen.port);
    const clientB = httpClient(() => startedB.listen.url);

    await clientB.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: ASSOCIATION.name,
      blurb: ASSOCIATION.blurb,
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    const tokenB = await clientB
      .post<{ sessionToken: string }>('/login', { username: MODERATOR.email, password: MODERATOR.password })
      .then((r) => r.json.sessionToken);

    // 🔴 The two facts that make arm `unreadable` a measurement of the GATE and
    // not of a broken login: the function really is gone, and this very token
    // really is good on this very backend.
    http.standingOnB = await clientB.post('/functions/myStanding', {}, { 'x-parse-session-token': tokenB })
      .then((r) => r.status);
    http.notifyOnB = await clientB
      .post('/functions/myNotifySetting', {}, { 'x-parse-session-token': tokenB })
      .then((r) => r.status);
    http.standingOnA = await clientA
      .post<{ standing?: string }>('/functions/myStanding', {}, {})
      .then((r) => r.status);

    // ── Arm 3: the same person, on a backend that cannot answer the gate ────
    await withRenderedPage({ projectDir: projectB, backendPort: startedB.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });
      await signIn(page, MODERATOR.email, MODERATOR.password);
      for (const url of PROTECTED) await land(page, 'unreadable', url);
    });

    // ── Arm 4: nothing bound at all. V4's own arm. ──────────────────────────
    //
    // ⚠️ A THIRD copy of the project, never passed through
    // `bindProjectToBackend`, so `metadata.cloudservices` is absent exactly as
    // it is in the shipped directory. Reusing A or B would measure a project
    // that has been bound and then pointed at nothing, which is a different
    // state and the one a person never has.
    const projectC = copyTemplateProject('rel002b-unbound');
    await withRenderedPage({ projectDir: projectC }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });
      for (const url of PROTECTED) await land(page, 'unbound', url);
      await land(page, 'unbound', '/');
    });
  });

  afterAll(async () => {
    for (const s of services) await s.stop();
  });

  describe('§0 the arms really differ, and the sessions are real', () => {
    it('🔴 CONTROL — the complete backend answers the standing call it is asked', () => {
      // A 200 here is what makes "the member stayed" a reading of the gate
      // rather than of a function that happens to answer everybody the same.
      expect(http.standingOnA).toBe(200);
    });

    it('🔴 the stripped backend really is missing that one function', () => {
      expect(http.standingOnB).toBe(404);
    });

    it('🔴 …and the SAME token on that SAME backend is accepted elsewhere', () => {
      // Without this, arm `unreadable` ejecting is equally consistent with a
      // session that was never valid — which would make it a measurement of
      // the login and not of the gate.
      expect(http.notifyOnB).toBe(200);
    });

    it('🔴 setup succeeded, so there IS a moderator account to sign in as', () => {
      expect(http.claimOnA).toBe(200);
    });

    it('🔴 and a session minted outside the browser reads as a moderator', () => {
      // Splits "the account has no standing" from "the browser's session was
      // not accepted" — two different defects with two different fixes.
      expect(session.direct.standing).toBe('moderator');
    });

    it('🔴 the CONTROL arm’s browser really did sign in, through the app’s own form', () => {
      // The half that says §1 is a reading of the gate. A null token here means
      // the member arm is a second visitor arm and proves nothing about
      // members.
      expect(session.member.token).toEqual(expect.any(String));
      expect(session.member.token).not.toHaveLength(0);
    });

    it('🔴 the browser’s token is a valid session on that backend', () => {
      // The half that says §1 grades the gate: the session the app's own form
      // put in storage is one the server accepts.
      expect(http.notifyOnA_browserToken).toBe(200);
    });

    it('🔴 …and the server calls that browser’s own session a moderator', () => {
      expect(session.member.status).toBe(200);
      expect(session.member.standing).toBe('moderator');
      // Printed on failure so the next reader sees the shape rather than a null.
      expect(session.member.body).toContain('moderator');
    });
  });

  describe('§1 🔴 CONTROL — a signed-in member is NOT ejected', () => {
    it.each(PROTECTED)('stays on %s', (url) => {
      expect(at[`member.${url}`].landed).toBe(url);
    });

    it('and is offered the band, so the page is alive rather than merely still', () => {
      // A page that ejected nobody because nothing ran at all would pass the
      // assertion above and fail this one.
      expect(at['member./members'].buttons).toEqual(expect.arrayContaining(['Sign out', 'Announcements']));
    });

    it('and the moderator’s own screens drew their moderator tools', () => {
      expect(at['member./post'].buttons.length).toBeGreaterThan(0);
    });
  });

  describe('§2 a visitor the server refuses is sent to the sign-in door', () => {
    it.each(PROTECTED)('%s ejects to /sign-in', (url) => {
      expect(at[`visitor.${url}`].landed).toBe(DOOR);
    });

    it('🔴 and the door it arrives at is PAINTED, not merely addressed', () => {
      // Judgement 4 is about what the reader is shown, so a pathname cannot
      // carry it: a blank page at `/sign-in` would pass the assertion above.
      for (const url of PROTECTED) {
        expect(at[`visitor.${url}`].buttons).toContain(DOOR_BUTTON);
      }
    });

    it('🔴 and is never offered `Sign out` — not painted, and not in the markup', () => {
      // The band used to render in full for anyone: an unauthenticated reader
      // was shown a Sign out button, which is a claim about them that was not
      // true. `markup` is the stronger half — absent, not merely unpainted.
      for (const url of PROTECTED) {
        expect(at[`visitor.${url}`].buttons).not.toContain('Sign out');
        expect(at[`visitor.${url}`].markup).not.toContain('Sign out');
      }
    });

    it('and the landing page a stranger asks for directly is the real one, not the waiting card', () => {
      // ⚠️ This reads the arm's OWN visit to `/`, not the ejection destination,
      // which since judgement 4 is `/sign-in`. It is still worth asserting: the
      // backend answered, so the association is known and a visitor who asks
      // for the front page gets the page a stranger is supposed to get.
      expect(at['visitor./'].visit.text).toContain(ASSOCIATION.name);
      expect(at['visitor./'].visit.text).not.toContain(WAITING_HEADING);
    });
  });

  describe('§3 🔴 THE ROW — a standing that cannot be READ ejects too', () => {
    it.each(PROTECTED)('%s ejects to /sign-in', (url) => {
      // This is V3. Before this task every one of these read as its own URL,
      // with the members' band on it.
      expect(at[`unreadable.${url}`].landed).toBe(DOOR);
    });

    it('and the reader is not left wearing a members’ band', () => {
      for (const url of PROTECTED) expect(at[`unreadable.${url}`].markup).not.toContain('Sign out');
    });
  });

  describe('§4 V4 — with nothing bound, the first run is a screen and not a shrug', () => {
    it('🔴 says what is wrong, in a sentence', () => {
      expect(at['unbound./'].visit.text).toContain(WAITING_HEADING);
    });

    it('🔴 CONTROL — and that card is GONE the moment a backend answers', () => {
      // Without this the card is satisfiable by being permanently on, which is
      // its own defect and would pass the assertion above on every arm.
      expect(at['visitor./'].visit.text).not.toContain(WAITING_HEADING);
      expect(at['member./'].visit.text).not.toContain(WAITING_HEADING);
    });

    it('🔴 and it no longer offers two buttons it cannot honour', () => {
      // The V4 photograph: an eyebrow, a gap, and `Members sign in` / `Ask to
      // join` — both of which lead to forms that cannot work. They are gated on
      // an association the page never learned about.
      expect(at['unbound./'].markup).not.toContain('Members sign in');
      expect(at['unbound./'].markup).not.toContain('Ask to join');
    });

    /**
     * 🔴 **REGISTERED, owner `NONE` — judgement 4 costs the unbound arm its
     * explanation, and this spec is where that is written down.**
     *
     * Before judgement 4 a refused reader landed on `/`, which with nothing
     * bound is the page carrying the waiting card §4 exists to prove. They now
     * land on `/sign-in`: a real, painted door whose form cannot work, because
     * there is no backend to answer it. The card is still there and still
     * correct — it is simply no longer on the page an ejection reaches.
     *
     * ⚠️ **This was NOT put to Richard.** His judgement was about a visitor
     * being handed the landing page with no acknowledgement, and the remedy is
     * the same one either way; splitting the destination by producer
     * (`decide` → the door, `failed` → the card) would reverse REL-002b's
     * "the refusal is unconditional" on a reading nobody asked for. Recorded
     * here rather than built.
     */
    it('and every protected screen lands at the door rather than on itself', () => {
      for (const url of PROTECTED) expect(at[`unbound.${url}`].landed).toBe(DOOR);
    });
  });

  describe('§5 the route a person takes: bounced, then signed in', () => {
    it('the bounce happens', () => {
      expect(at['ejected./members'].landed).toBe(DOOR);
    });

    it('🔴 and signing in afterwards lets them in', () => {
      // ⚠️ **This is the arm that found something.** Signing in on a page that
      // had already been ejected produced a stored session the server would
      // not accept, while a login minted over HTTP with the same credentials
      // seconds earlier was fine. If this reddens, read `session.ejected`
      // before touching the gate: `standing: 'visitor'` for a token the form
      // just wrote is a session defect, not a gating one, and the fix is not
      // in this template.
      expect(session.ejected.standing).toBe('moderator');
      expect(at['ejected-after./members'].landed).toBe('/members');
    });
  });
});
