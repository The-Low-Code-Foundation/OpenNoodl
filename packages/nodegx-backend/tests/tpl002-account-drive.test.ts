/**
 * TPL-002 — the box, and the link out of the email, in a browser.
 *
 * 🔴 **This is the reading TPL-002 §7 closed s14 owing.** Every endpoint behind
 * `Pages/Account` and `Pages/Unsubscribe` is measured over HTTP in
 * `tpl002-notifications.test.ts`, and both pages were authored, registered,
 * routed and gated — but *"nobody has ticked the box on the screen, and nobody
 * has opened the unsubscribe link in a page."* A graph is a claim; this is the
 * evidence. AC4's first half and AC1/AC2's box are graded here and nowhere else.
 *
 * | AC | what it says | § |
 * |---|---|---|
 * | 1 | the member ticks the box **on the screen** and it saves | §2, §3 |
 * | 2 | the box ships **unticked**, and the person who never ticks is silent | §1, §5 |
 * | 4 | the link works signed out, and the account page then agrees | §6, §7, §8 |
 *
 * ## The conditions that make it a measurement
 *
 * 🔴 **`devOpen: false`**, asserted from `started.security.enforced` before any
 * reading — the guard both sibling suites open with. `devOpenActive` disables
 * row-level ACL entirely, and `notifyByEmail` is the one field in this template
 * a member may write.
 *
 * 🔴 **The link is taken OUT OF THE MESSAGE BODY.** `notifyMembers`' pump writes
 * `origin + '/unsubscribe?token=' + encodeURIComponent(token)` into the text it
 * hands the mail server, and `siteUrl` here is the preview server's own origin,
 * so the URL this drive opens is byte-for-byte the one a member would click. A
 * URL composed in the harness from a token read out of the database would grade
 * the harness's idea of the link, and the whole surface between the pump and the
 * router — the query string, the encoding, `PageInputs.queryParams` — would go
 * unmeasured.
 *
 * 🔴 **Three people, because one control is not enough and they are different
 * controls.**
 * - **Mo** ticks the box on the screen and is the one whose link is opened.
 * - **Ann** never ticks it. Her silence is asserted **in the same send** as Mo's
 *   delivery — otherwise "Ann got nothing" is equally consistent with a mailer
 *   that was never reached.
 * - **Sam** ticks it through the endpoint. He is the reading that makes the
 *   unsubscribe informative: Ann is `false` before and after, which a token that
 *   did nothing would satisfy exactly, so the claim *"it turned off one person's
 *   flag"* needs somebody whose `true` had to **survive**.
 *
 * 🔴 **The link is graded by its CONSEQUENCE, not by its confirmation.** §7
 * reads the sentence the page paints; §8 posts a second announcement and reads
 * the transport again. A page that says "Done" and writes nothing would pass the
 * first and fail the second, and it is the second that is the acceptance
 * criterion.
 *
 * 🔴 **`checked` and `marked` are asserted separately.** The real `<input>` is
 * `opacity: 0`, so a box whose state is true and whose mark is absent renders as
 * an unticked box to the person looking at it — FB-020, which two users reported
 * as *"the box cannot be checked"*. See `readBox`.
 *
 * ⚠️ **The sentences are retyped, not imported from `tpl001Vocabulary`.** The
 * subject is the shipped artefact, and `tpl001Template.test.ts` already gates
 * the artefact against the generator. An imported constant would follow a
 * vocabulary change silently and go on passing; a retyped one goes red and asks
 * a person to look, which is the behaviour wanted at this boundary.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import {
  Box,
  bundleMembersCloud,
  clickBox,
  clickButton,
  copyTemplateProject,
  makeMembersDataDir,
  readBox,
  SETUP_TOKEN,
  signIn,
  signOut,
  currentSession
} from './helpers/members-drive';
import { bindProjectToBackend, readHere, readVisit, Visit, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
/** Ticks the box on the screen, and whose link is the one opened. AC1, AC4. */
const MO = { name: 'Mo Joiner', email: 'mo@example.invalid', password: 'pw-mo' };
/** Approved, never ticks it. AC2's silence, in the same send as Mo's delivery. */
const ANN = { name: 'Ann Other', email: 'ann@example.invalid', password: 'pw-ann' };
/** Ticks it through the endpoint. His `true` has to SURVIVE Mo's unsubscribe. */
const SAM = { name: 'Sam Reed', email: 'sam@example.invalid', password: 'pw-sam' };

const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

/** `tpl001Vocabulary.NOTIFY_OPT_IN_LABEL`, on the screen. */
const OPT_IN_LABEL = 'Email me when a moderator posts an announcement';
/** `NOTIFY_OPT_IN_NOTE` — the two things to know before ticking it. */
const OPT_IN_NOTE =
  'Off unless you turn it on. Every email has a link that turns it off again, and you do not need to sign in to use it.';
/** `NOTIFY_SAVED_ON_TEXT` / `NOTIFY_SAVED_OFF_TEXT`. */
const SAVED_ON = 'Saved. We will email you when something is posted.';
const SAVED_OFF = 'Saved. We will not email you about new announcements.';
/** `UNSUBSCRIBED_TEXT`, on the page a mail client opens. */
const UNSUBSCRIBED =
  'Done. You will not receive any more emails about new announcements. You are still a member, and you can turn them back on from your account at any time.';
/** `UNSUBSCRIBE_FAILED_TEXT` — the one refusal in this template that distinguishes. */
const UNSUBSCRIBE_FAILED =
  'That link did not work. It may have been broken by your email program — try copying the whole address, or turn emails off from your account.';

/** One message as the mail server was handed it. */
interface Posted {
  to: string;
  subject: string;
  text: string;
}

interface Wrapped<T> {
  result?: T;
}

describe('TPL-002 — the box on the screen, and the link out of the email', () => {
  let projectDir = '';
  let dataDir = '';
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  const as = (token: string) => ({ 'x-parse-session-token': token });

  let enforced = false;
  const tokens: Record<string, string> = {};
  /** Every browser reading, taken once in `beforeAll` and asserted below. */
  const visits: Record<string, Visit> = {};
  /** Every reading of the one box. */
  const boxes: Record<string, Box> = {};
  /** What the transport was handed, per send. */
  const sends: Record<string, Posted[]> = {};
  /** What `myNotifySetting` answered, per person, per moment. */
  const settings: Record<string, boolean | undefined> = {};
  /** The URL the message body carried, and the session the browser held on it. */
  let link = '';
  /**
   * The way back off `/unsubscribe`, before and after it is pressed.
   *
   * ⚠️ Retyped, not imported — see this file's header. The label lives in
   * `tpl001Vocabulary.UNSUBSCRIBE_BACK_LABEL` and `tpl001Template.test.ts` §5
   * ties the artefact to it; a change there should redden HERE and ask a person
   * to look, rather than follow along silently.
   */
  const BACK_LABEL = 'Sign in to your account';
  const wayBack: Record<string, Visit> = {};
  /**
   * 🔴 **Why the press below is wrapped rather than left to throw.**
   * `clickButton` throws on a control it cannot find or cannot hit — which is
   * the behaviour wanted — but it runs inside `beforeAll`, and **a `beforeAll`
   * that throws runs no arm**: a missing button would redden all twenty-three
   * specs in this file and say nothing about the twenty-two that are not about
   * it. So the failure is CAUGHT and CARRIED, and §6b is the one spec that
   * reads it. The message is kept whole because `clickButton`'s own is the
   * useful one — it lists the buttons that WERE on the page.
   */
  let wayBackError = '';
  let sessionOnUnsubscribe: string | null = 'unread';
  /** `myStanding` requests the unsubscribe page's own load made. It carries no band. */
  let standingOnUnsubscribe = -1;

  let posted: Posted[] = [];

  /** `myNotifySetting`, through the endpoint the account page calls. */
  const mySetting = async (token: string): Promise<boolean | undefined> => {
    const res = await client.post<Wrapped<{ notify?: boolean }>>('/functions/myNotifySetting', {}, as(token));
    expect(res.status).toBe(200);
    return res.json?.result?.notify;
  };

  const postAnnouncement = async (title: string, body: string): Promise<string> => {
    const created = await client.post<{ objectId: string }>(
      '/classes/Announcement',
      { title, body, postedAt: '2026-08-29T10:00:00.000Z', ACL: MEMBERS_READ_ACL },
      as(tokens.moderator)
    );
    expect(created.status).toBe(201);
    return created.json.objectId;
  };

  beforeAll(async () => {
    projectDir = copyTemplateProject('tpl002-drive');
    dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl002-drive');
    /**
     * The state an association that HAS configured SMTP is in. `isConfigured()`
     * is what `Mailer.send` checks before it looks at a transport at all, so
     * without this file every send below would be §3's unconfigured arm — which
     * `tpl002-notifications.test.ts` grades, and which would make every reading
     * here about the wrong thing.
     */
    fs.writeFileSync(
      path.join(dataDir, 'email.json'),
      JSON.stringify({
        enabled: true,
        smtp: { host: 'smtp.example.invalid', port: 587, secure: false, username: 'assoc' },
        fromAddress: 'noreply@example.invalid',
        fromName: 'St Anywhere'
      })
    );

    service = new BackendService({ dataDir, port: 0, backendId: 'tpl002-drive', backendName: 'St Anywhere' });
    const started = await service.start();
    base = started.listen.url;
    enforced = started.security.enforced;
    // Nothing below means anything if this is false — see the header.
    expect(enforced).toBe(true);

    service.getMailerForTesting()!.setTransportForTesting({
      sendMail: async (opts: Record<string, unknown>) => {
        posted.push({ to: String(opts.to), subject: String(opts.subject || ''), text: String(opts.text || '') });
      }
    });

    bindProjectToBackend(projectDir, 'tpl002-drive', started.listen.port);

    // ── Everybody, through the doors the template ships ───────────────────────
    const claimed = await client.post<Wrapped<{ claimed?: boolean }>>('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      blurb: 'A congregation that meets on Sundays.',
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    expect(`claimed:${claimed.json.result?.claimed}`).toBe('claimed:true');

    for (const person of [MO, ANN, SAM]) {
      const asked = await client.post<Wrapped<{ received?: boolean }>>('/functions/requestAccess', {
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

    const queue = await client.get<{ results: Array<Record<string, unknown>> }>(
      '/classes/MemberRequest',
      as(tokens.moderator)
    );
    for (const person of [MO, ANN, SAM]) {
      const row = (queue.json?.results ?? []).find((r) => String(r.email) === person.email);
      expect(`${person.email} queued:${Boolean(row)}`).toBe(`${person.email} queued:true`);
      const decided = await client.post('/functions/decideMembership', { requestId: row!.objectId, approve: true }, as(tokens.moderator));
      expect(`${person.email} approved:${decided.status}`).toBe(`${person.email} approved:200`);
    }
    tokens.mo = await login(MO);
    tokens.ann = await login(ANN);
    tokens.sam = await login(SAM);

    // Sam opts in through the endpoint. Mo's box is ticked on the SCREEN below,
    // and Ann is never touched.
    const sam = await client.post('/functions/setNotifySetting', { wanted: true }, as(tokens.sam));
    expect(`sam set:${sam.status}`).toBe('sam set:200');

    settings['mo.beforeTick'] = await mySetting(tokens.mo);
    settings['ann.beforeTick'] = await mySetting(tokens.ann);
    settings['sam.beforeTick'] = await mySetting(tokens.sam);

    // ── The browser ───────────────────────────────────────────────────────────
    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      const origin = `http://127.0.0.1:${page.servePort}`;
      await page.setViewport({ width: 1280, height: 1000 });

      const countStanding = async (): Promise<number> =>
        Number(
          await page.evaluate(
            "performance.getEntriesByType('resource').filter(function (e) {" +
              " return e.name.indexOf('myStanding') !== -1; }).length"
          )
        );

      // ── §1 + §2 — Mo's account page, and the box as it ships ────────────────
      await signIn(page, MO.email, MO.password);
      visits['mo.account'] = await readVisit(page, '/account');
      boxes['mo.fresh'] = await readBox(page);


      /**
       * 🔴 Ticked where the person ticks it, and read **without navigating**.
       * The confirmation is state the click produced on the page in front of
       * them; `readVisit('/account')` would reload and grade the boot — the D14
       * mistake, which passed *because of* a bug and reddened when it was fixed.
       */
      await clickBox(page);
      visits['mo.ticked'] = await readHere(page, { until: SAVED_ON });
      boxes['mo.ticked'] = await readBox(page);
      settings['mo.afterTick'] = await mySetting(tokens.mo);
      settings['ann.afterTick'] = await mySetting(tokens.ann);

      await signOut(page);

      // ── §4 + §5 — one send, three approved members, two opted in ───────────
      const first = await postAnnouncement('The organ fund', 'A donor has offered to match what we raise by Christmas.');
      posted = [];
      const answered = await client.post<Wrapped<{ sent?: number; failed?: number }>>(
        '/functions/notifyMembers',
        { announcementId: first, siteUrl: origin },
        as(tokens.moderator)
      );
      sends.first = posted.slice();
      expect(`notify:${answered.status}`).toBe('notify:200');

      /**
       * The link Mo's own message carried. Matched by address rather than taken
       * as `posted[0]`: the pump's order is the query's, and a drive that opened
       * "the first link" would silently be opening Sam's the day that order
       * changes — and would then report that Mo's account page disagreed with a
       * link that was never Mo's.
       */
      const mine = sends.first.find((m) => m.to === MO.email);
      link = (mine?.text.match(/https?:\/\/\S+/) || [''])[0];

      // ── §6 + §7 — the link, opened by somebody with no session ─────────────
      //
      // 🔴 The session is read from the runtime's own store on the page that
      // opens the link, not assumed from having called `signOut`. "Signed out"
      // is the load-bearing half of AC4, and a stale session would make this
      // whole arm a member reading their own page.
      if (link) {
        visits['unsub.done'] = await readVisit(page, link.slice(origin.length));
        sessionOnUnsubscribe = await currentSession(page);
        standingOnUnsubscribe = await countStanding();
      }

      // The two refusals, on the same instrument as the confirmation above.
      visits['unsub.broken'] = await readVisit(page, '/unsubscribe?token=not-a-real-token');
      visits['unsub.none'] = await readVisit(page, '/unsubscribe');

      // ── §6b — THE WAY BACK, PRESSED ───────────────────────────────
      //
      // 🔴 **D39's link half, reversed by Richard 2026-09-04** after he ruled
      // this page SHITTY — its only sub-PASSABLE verdict in the members' area.
      // `tpl001Template.test.ts` §5 says the button and the navigate exist and
      // are wired to one another. **A wire is a claim; this is the press.**
      //
      // ⚠️ It is taken on the REFUSAL arm deliberately. The line above leaves
      // the page on `/unsubscribe` with no token, which is the state a person
      // reaches when their mail client mangles the link — the reader D39's own
      // text says is most likely to need a way out.
      //
      // ⚠️ `clickButton` refuses a control it cannot hit: it scrolls, then
      // reads `elementFromPoint`, so a button drawn behind something else
      // throws here instead of quietly passing. RENDERED is not REACHABLE.
      try {
        wayBack.before = await readHere(page);
        await clickButton(page, BACK_LABEL);
        wayBack.after = await readHere(page, { until: 'Members sign in' });
      } catch (e) {
        wayBackError = String((e as Error)?.message ?? e);
      }

      settings['mo.afterUnsub'] = await mySetting(tokens.mo);
      settings['ann.afterUnsub'] = await mySetting(tokens.ann);
      settings['sam.afterUnsub'] = await mySetting(tokens.sam);

      // ── §8 — the CONSEQUENCE: a second send, after the link ────────────────
      const second = await postAnnouncement('Churchyard tidy', 'Bring gloves. Tea and cake afterwards.');
      posted = [];
      await client.post('/functions/notifyMembers', { announcementId: second, siteUrl: origin }, as(tokens.moderator));
      sends.second = posted.slice();

      // ── §9 — back in, to see whether the box agrees with the link ──────────
      await signIn(page, MO.email, MO.password);
      visits['mo.accountAfter'] = await readVisit(page, '/account');
      boxes['mo.after'] = await readBox(page);

      // §10 — and back on again from the screen, which is the sentence the page
      // promises: "you can turn them back on from your account at any time".
      await clickBox(page);
      visits['mo.retick'] = await readHere(page, { until: SAVED_ON });
      boxes['mo.retick'] = await readBox(page);
      settings['mo.afterRetick'] = await mySetting(tokens.mo);

      // And off again from the screen, so the OFF sentence is read too.
      await clickBox(page);
      visits['mo.untick'] = await readHere(page, { until: SAVED_OFF });
      boxes['mo.untick'] = await readBox(page);
      settings['mo.afterUntick'] = await mySetting(tokens.mo);
    });
  });

  afterAll(async () => {
    if (service) await service.stop();
  });

  // ── §1 — the box as a person first meets it ────────────────────────────────

  it('§1 the account page draws one box, and its label and its note', () => {
    expect(boxes['mo.fresh'].present).toBe(true);
    expect(boxes['mo.fresh'].painted).toBe(true);
    expect(visits['mo.account'].text).toContain(OPT_IN_LABEL);
    expect(visits['mo.account'].text).toContain(OPT_IN_NOTE);
  });

  /**
   * 🔴 AC2 and Richard's opt-in ruling, on the screen rather than in the graph.
   * `tpl002-notifications.test.ts` reads `notifyByEmail` off the row; this reads
   * the control a person is actually shown, which is the thing that would have
   * to be wrong for somebody to be signed up without asking.
   */
  it('§1 it ships UNTICKED, and draws no tick', () => {
    expect(boxes['mo.fresh'].checked).toBe(false);
    expect(boxes['mo.fresh'].marked).toBe(false);
    expect(settings['mo.beforeTick']).toBe(false);
  });

  /**
   * The confirmation must not be on the page before anything is saved — it is
   * `mounted` off a Condition, so this is the reading that catches a regression
   * to a gate that fires on load.
   *
   * 🔴 **And it is read off `text`, NOT off `html`, which is a departure from
   * every other absence check in these drives and had to be.** `render-from-disk.js:452`
   * inlines the entire project as `window.projectData` in a `<script>` in the
   * body, so `document.documentElement.outerHTML` contains **every string the
   * template is authored out of** on every page it serves. An absence check on a
   * project sentence read off `html` therefore cannot pass, and — the direction
   * that actually costs something — a PRESENCE check on one cannot fail: it
   * would go green on a page that rendered nothing at all.
   *
   * ⚠️ The `outerHTML` discipline the sibling drives keep is untouched by this,
   * and deliberately so: every one of their `html` assertions is about **row
   * data** — an announcement's title, a member's address — which reaches the
   * document only by being fetched. Nothing authored into the project is
   * asserted absent from `html` anywhere but here, and this row is the reason it
   * is not asserted here either.
   */
  it('§1 no confirmation is shown before anything is saved', () => {
    expect(visits['mo.account'].text).not.toContain(SAVED_ON);
    expect(visits['mo.account'].text).not.toContain(SAVED_OFF);
    // The stronger claim — not merely unpainted but absent from the rendered
    // tree — is `readBox`'s and `sentence`'s to make, on the DOM rather than on
    // a string that carries the project source too.
    expect(visits['mo.account'].text).not.toContain('That could not be saved just now');
  });

  // ── §2 — ticking it ────────────────────────────────────────────────────────

  it('§2 a real click ticks it, and DRAWS a tick', () => {
    expect(boxes['mo.ticked'].checked).toBe(true);
    // FB-020: state and mark are two claims. A person cannot see `input.checked`.
    expect(boxes['mo.ticked'].marked).toBe(true);
  });

  it('§2 the page says it saved, and says which way', () => {
    expect(visits['mo.ticked'].text).toContain(SAVED_ON);
    expect(visits['mo.ticked'].text).not.toContain(SAVED_OFF);
  });

  /**
   * 🔴 The screen wrote the flag the endpoint reads. This is the second reading,
   * never the first: a spec that only asked the endpoint would pass on a page
   * whose box does nothing but a harness that called `setNotifySetting` itself.
   */
  it('§3 the tick reached the row, and touched nobody else', () => {
    expect(settings['mo.afterTick']).toBe(true);
    expect(settings['ann.afterTick']).toBe(false);
  });

  // ── §4/§5 — one send, and who was in it ────────────────────────────────────

  it('§4 the send went to the two who opted in, and to nobody else', () => {
    expect(sends.first.map((m) => m.to).sort()).toEqual([MO.email, SAM.email]);
  });

  /**
   * 🔴 AC2's negative control, in the same send off the same transport. Ann is
   * approved, in `role:member`, has an address on her row, and differs from Mo
   * in exactly one field — so her silence is about that field and not about a
   * mailer that was never reached.
   */
  it('§5 Ann, who never ticked it, was handed nothing — in the same send', () => {
    expect(sends.first.map((m) => m.to)).not.toContain(ANN.email);
    expect(sends.first.length).toBe(2);
  });

  // ── §6 — the link the message carried ──────────────────────────────────────

  /**
   * 🔴 **D39, half-reversed 2026-09-04, graded in a browser.**
   *
   * D39 (2026-08-29) was that `/unsubscribe` names no association and offers no
   * way back. On the 0.2.2 ruling sheet Richard ruled the page **SHITTY** and
   * answered its standing judgement with *"Allow a way back after all"*, so the
   * link half is now authorised and built. The expensive half — naming the
   * association, a round trip from a mail client — was never put to him and
   * stays declined; `tpl001Template.test.ts` §5 still asserts this page reads
   * nothing from the database.
   *
   * ⚠️ **What this adds over the graph gate.** §5 counts nodes and follows one
   * wire in the stored artefact. It cannot see a button that does not render, a
   * button nothing can click, or a navigate that lands somewhere else. All
   * three are the same picture to a census and three different screens to a
   * person.
   */
  it('§6b the way back is on the page, can be pressed, and lands on the sign-in page', () => {
    // 🔴 Read the caught failure FIRST, and print it. Without this the next
    // line reports `Cannot read properties of undefined`, which is a fact
    // about this spec rather than about the page.
    expect(wayBackError).toBe('');

    // It is THERE, and on the refusal arm — the reader most likely to want it.
    expect(wayBack.before.url).toBe('/unsubscribe');
    expect(wayBack.before.text).toContain(BACK_LABEL);

    // 🔴 The control that makes the line above mean something. `/unsubscribe`
    // is the page D39 emptied: if this drive were reading some other screen,
    // the refusal notice would not be on it either.
    expect(wayBack.before.text).toContain('That link did not work');

    // It was PRESSED — `clickButton` above throws on a control it cannot hit —
    // and it landed on the sign-in page rather than merely somewhere else.
    expect(wayBack.after.url).toBe('/sign-in');
    expect(wayBack.after.text).toContain('Members sign in');

    // And it LEFT the page it was on. A router that renders the new page
    // underneath the old one is a real failure mode in a single document, and
    // it reads as success on the url alone.
    expect(wayBack.after.text).not.toContain('That link did not work');
  });

  it('§6 Mo’s message carries an unsubscribe link, and it is Mo’s own', () => {
    expect(link).toMatch(/\/unsubscribe\?token=[0-9a-f]{32,}$/);
    // Per-member, because the token is. Sam's link is a different one.
    const sam = sends.first.find((m) => m.to === SAM.email);
    const samLink = (sam?.text.match(/https?:\/\/\S+/) || [''])[0];
    expect(samLink).not.toBe(link);
  });

  // ── §7 — opening it, signed out ────────────────────────────────────────────

  it('§7 the page was opened with NO session', () => {
    expect(sessionOnUnsubscribe).toBeNull();
  });

  it('§7 it says the emails have stopped', () => {
    expect(visits['unsub.done'].text).toContain(UNSUBSCRIBED);
    expect(visits['unsub.done'].text).not.toContain(UNSUBSCRIBE_FAILED);
  });

  /**
   * The page's own design claim: no band, so no `myStanding`. It is opened by
   * somebody not signed in, on a phone, from a mail client, and an auth round
   * trip on a page whose whole point is not needing one would be the defect.
   */
  it('§7 it made no standing request — it carries no band', () => {
    expect(standingOnUnsubscribe).toBe(0);
  });

  /**
   * 🔴 The refusals, on the same instrument as the confirmation. Without them
   * "the page said Done" is equally consistent with a page that says Done to
   * anything, and this is the one refusal in the template that distinguishes —
   * deliberately, because a token tells a guesser nothing they could act on.
   */
  it('§7 a broken token and a missing one are both refused, and say so', () => {
    for (const label of ['unsub.broken', 'unsub.none']) {
      expect(`${label}: ${visits[label].text.includes(UNSUBSCRIBE_FAILED)}`).toBe(`${label}: true`);
      expect(`${label}: ${visits[label].text.includes(UNSUBSCRIBED)}`).toBe(`${label}: false`);
    }
  });

  // ── §8 — what the link actually did ────────────────────────────────────────

  /**
   * 🔴 The consequence, not the confirmation. A page that paints "Done" and
   * writes nothing passes §7 and fails here, and it is this that AC4 is about.
   * Sam is the informative half: Ann was `false` before and after, which a token
   * that did nothing at all would satisfy exactly.
   */
  it('§8 the link turned off exactly one person’s flag', () => {
    expect(settings['mo.afterUnsub']).toBe(false);
    expect(settings['sam.afterUnsub']).toBe(true);
    expect(settings['ann.afterUnsub']).toBe(false);
  });

  it('§8 and the next send skipped Mo and still reached Sam', () => {
    expect(sends.second.map((m) => m.to)).toEqual([SAM.email]);
  });

  // ── §9 — the two surfaces read one flag ────────────────────────────────────

  /**
   * 🔴 AC4's second half. The account page and the unsubscribe link are two
   * surfaces over one field, and this is the only reading that says so: the box
   * is drawn from `myNotifySetting` on a fresh load, so an unticked box here is
   * the account page agreeing with a link that was opened by somebody with no
   * session at all.
   */
  it('§9 back in, the box is unticked — and draws no tick', () => {
    expect(boxes['mo.after'].checked).toBe(false);
    expect(boxes['mo.after'].marked).toBe(false);
  });

  it('§9 and the fresh load shows no stale confirmation', () => {
    expect(visits['mo.accountAfter'].text).not.toContain(SAVED_ON);
    expect(visits['mo.accountAfter'].text).not.toContain(SAVED_OFF);
  });

  // ── §10 — and back on again, from the screen ───────────────────────────────

  /**
   * The sentence on the unsubscribe page promises this: *"you can turn them back
   * on from your account at any time"*. A promise a template makes in prose is
   * an acceptance criterion.
   */
  it('§10 it can be turned back on from the account page', () => {
    expect(boxes['mo.retick'].checked).toBe(true);
    expect(boxes['mo.retick'].marked).toBe(true);
    expect(visits['mo.retick'].text).toContain(SAVED_ON);
    expect(settings['mo.afterRetick']).toBe(true);
  });

  it('§10 and off again, with the OFF sentence rather than the ON one', () => {
    expect(boxes['mo.untick'].checked).toBe(false);
    expect(boxes['mo.untick'].marked).toBe(false);
    expect(visits['mo.untick'].text).toContain(SAVED_OFF);
    expect(visits['mo.untick'].text).not.toContain(SAVED_ON);
    expect(settings['mo.afterUntick']).toBe(false);
  });

  // ── §11 — what a phone can actually hit ────────────────────────────────────

  /**
   * 🔴 **The box is the whole opt-in, and on a phone the only way to hit it is
   * the box itself.** `useLabel` defaults **false**
   * (`node-shared-port-definitions.ts:1440`), so a label drawn as a separate
   * `Text` node emits no `<label for>` and the sentence beside the box is not a
   * click target — the obvious thing to tap does nothing. WCAG 2.2 SC 2.5.8 puts
   * the floor at 24×24 CSS px, which the box meets exactly and only exactly.
   */
  it('§11 the sentence beside the box is a click target', () => {
    expect(boxes['mo.fresh'].labelIsTarget).toBe(true);
  });

  it('§11 and the box itself clears the 24px floor', () => {
    expect(boxes['mo.fresh'].width).toBeGreaterThanOrEqual(24);
    expect(boxes['mo.fresh'].height).toBeGreaterThanOrEqual(24);
  });

  // ── §12 — nothing was broken on the way ────────────────────────────────────

  it('§12 no page in this drive logged an error, except the two deliberate refusals', () => {
    for (const [label, visit] of Object.entries(visits)) {
      const unexpected = visit.errors.filter((e) => !e.includes('That unsubscribe link did not work'));
      expect(`${label}: ${JSON.stringify(unexpected)}`).toBe(`${label}: []`);
    }
  });
});
