/**
 * TPL-002 — the opt-in notifications, against a real enforcing backend and a
 * captured transport.
 *
 * 🔴 **This is the only thing that can say the fan-out works, and the reason is
 * D33.** The obvious graph — set `To`, pulse `Do`, repeat — sends **one** email
 * and reports **N** successes, measured with a control pair in `s14`. So a spec
 * that asserted "the endpoint answered `sent: 3`" would pass on exactly the
 * defect this template was built around. Every reading below is taken off the
 * **transport**: what the mail server was actually handed, and for whom.
 *
 * | AC | what it says | §  |
 * |---|---|---|
 * | 1 | ticked ⇒ the member receives it | §2 |
 * | 2 | **not** ticked ⇒ nothing, in the SAME send | §2 |
 * | 3 | unconfigured SMTP says so at post time, configured is the control | §4 |
 * | 4 | the unsubscribe link works signed out, and the account agrees | §5 |
 * | 5 | a pending member who opted in receives nothing | §3 |
 * | 6 | one recipient failing does not stop the others | §6 |
 *
 * ## The conditions that make it a measurement
 *
 * 🔴 **`devOpen: false`**, asserted from `started.security.enforced` before any
 * reading is taken — the same guard `tpl001-members-drive.test.ts` opens with.
 *
 * 🔴 **Nobody is opted in by the harness.** The flag is set through
 * `setNotifySetting` as the member themselves, over HTTP, with their own session
 * — which is the endpoint the account page calls. A harness that wrote
 * `notifyByEmail` straight into the row would be grading a fan-out over data no
 * surface in this template can produce.
 *
 * 🔴 **Every absence sits beside a send known to have happened.** "Ann received
 * nothing" has a dozen causes with nothing to do with her setting — a broken
 * filter, an unbound query, a mailer that was never reached. Ann's silence is
 * asserted in the same send, off the same transport, as Mo's delivery.
 *
 * ⚠️ **The subject of every arm is `templates/members-area/`** — the artefact a
 * person receives, copied and bundled, not a re-authoring of it.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import { bundleMembersCloud, copyTemplateProject, makeMembersDataDir, SETUP_TOKEN } from './helpers/members-drive';

jest.setTimeout(300000);

const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
/** Ticks the box. AC1. */
const MO = { name: 'Mo Joiner', email: 'mo@example.invalid', password: 'pw-mo' };
/** Approved and does NOT tick it. AC2's negative control, in the same send. */
const ANN = { name: 'Ann Other', email: 'ann@example.invalid', password: 'pw-ann' };
/** Never approved. AC5. */
const PAT = { name: 'Pat Pending', email: 'pat@example.invalid', password: 'pw-pat' };

/** One message as the mail server was handed it. */
interface Posted {
  to: string;
  subject: string;
  text: string;
}

interface NotifyAnswer {
  sent?: number;
  failed?: number;
  error?: string;
}

/**
 * 🔴 **A cloud function answers `{ result: { … } }`, not the parameters bare.**
 * Read off the top level, every response parameter in this file was `undefined`
 * — eight rows red against a graph that was answering correctly. The shape was
 * settled by probing `/functions/myStanding`, which the shipped template has
 * always used, rather than by reading the Response node.
 */
interface Wrapped<T> {
  result?: T;
}

describe('TPL-002 — telling people something was posted', () => {
  let projectDir = '';
  let dataDir = '';
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  const as = (token: string) => ({ 'x-parse-session-token': token });

  /** Everything the transport was handed, in order, since the last `posted = []`. */
  let posted: Posted[] = [];
  /** Addresses the transport is told to refuse. AC6. */
  const refuse = new Set<string>();

  const sessions: Record<string, string> = {};
  let announcementId = '';

  /** What the fan-out answered, per arm, so §4's control pair reads off one instrument. */
  const answers: Record<string, NotifyAnswer> = {};

  /**
   * 🔴 The one place email is switched on, and it is written as a FILE rather
   * than through the admin route on purpose: this is the state an association
   * that has configured SMTP is in, and `isConfigured()` is what `Mailer.send`
   * checks before it looks at any transport at all. §4's unconfigured arm is
   * this file's absence, which is the state a fresh install is in.
   */
  function configureEmail(): void {
    fs.writeFileSync(
      path.join(dataDir, 'email.json'),
      JSON.stringify({
        enabled: true,
        smtp: { host: 'smtp.example.invalid', port: 587, secure: false, username: 'assoc' },
        fromAddress: 'noreply@example.invalid',
        fromName: 'St Anywhere'
      })
    );
  }

  function captureTransport(): void {
    service.getMailerForTesting()!.setTransportForTesting({
      sendMail: async (opts: Record<string, unknown>) => {
        const to = String(opts.to);
        // AC6's arm. A transport that throws for one address is exactly what a
        // mail server does for one bad mailbox, and `Mailer.send` turns it into
        // `{success:false}` rather than a rejection — which is what the pump has
        // to keep going through.
        if (refuse.has(to)) throw new Error('550 no such mailbox');
        posted.push({ to, subject: String(opts.subject || ''), text: String(opts.text || '') });
      }
    });
  }

  /** Post an announcement as the moderator and hand the id back. */
  async function post(title: string, body: string): Promise<string> {
    const created = await client.post<{ objectId: string }>(
      '/classes/Announcement',
      {
        title,
        body,
        postedAt: '2026-08-29T10:00:00.000Z',
        ACL: { 'role:admin': { read: true, write: true }, 'role:member': { read: true, write: false } }
      },
      as(sessions.mod)
    );
    return created.json.objectId;
  }

  async function notify(id: string, siteUrl = 'https://stanywhere.example.invalid'): Promise<NotifyAnswer> {
    const res = await client.post<Wrapped<NotifyAnswer>>(
      '/functions/notifyMembers',
      { announcementId: id, siteUrl },
      as(sessions.mod)
    );
    return (res.json?.result || {}) as NotifyAnswer;
  }

  /** The account page's read, through the endpoint the page calls. */
  async function mySetting(token: string): Promise<boolean | undefined> {
    const res = await client.post<Wrapped<{ notify?: boolean }>>('/functions/myNotifySetting', {}, as(token));
    expect(res.status).toBe(200);
    return res.json?.result?.notify;
  }

  beforeAll(async () => {
    projectDir = copyTemplateProject('tpl002');
    dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl002');
    configureEmail();
    service = new BackendService({ dataDir, port: 0, backendId: 'tpl002', backendName: 'St Anywhere' });
    const started = await service.start();
    base = started.listen.url;
    // 🔴 Before any reading. `devOpenActive` disables row-level ACL entirely,
    // and a members' area measured with it on looks like it works and is open.
    expect(started.security.enforced).toBe(true);
    captureTransport();

    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      blurb: 'A congregation.',
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    for (const p of [MO, ANN, PAT]) {
      await client.post('/functions/requestAccess', {
        name: p.name,
        email: p.email,
        password: p.password,
        message: 'Please.'
      });
    }
    sessions.mod = (
      await client.post<{ sessionToken: string }>('/login', {
        username: MODERATOR.email,
        password: MODERATOR.password
      })
    ).json.sessionToken;

    // Mo and Ann are approved through the real door; Pat is left on the queue.
    const queue = await client.get<{ results: Array<{ objectId: string; name?: string }> }>(
      '/classes/MemberRequest',
      as(sessions.mod)
    );
    for (const who of [MO, ANN]) {
      const row = queue.json.results.find((r) => r.name === who.name);
      expect(row).toBeDefined();
      const decided = await client.post(
        '/functions/decideMembership',
        { requestId: row?.objectId, approve: true },
        as(sessions.mod)
      );
      expect(`decide:${who.name}:${decided.status}`).toBe(`decide:${who.name}:200`);
    }

    for (const [key, who] of [
      ['mo', MO],
      ['ann', ANN],
      ['pat', PAT]
    ] as const) {
      sessions[key] = (
        await client.post<{ sessionToken: string }>('/login', { username: who.email, password: who.password })
      ).json.sessionToken;
    }
  });

  afterAll(async () => {
    if (service) await service.stop();
    for (const dir of [projectDir, dataDir]) if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §1 — the default, before anybody has been asked
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§1 the default', () => {
    /**
     * 🔴 TPL-002 §4, and the one default in this template with a legal reason
     * rather than a taste one: consent in the UK and EU is opt-in.
     */
    test('a newly approved member is signed up for nothing', async () => {
      expect(await mySetting(sessions.mo)).toBe(false);
    });

    /**
     * ⚠️ The `false` above could be a field that is simply absent, which reads
     * the same through the endpoint. It is written, and this is where that is
     * checked — the account page draws a checkbox from it, and a box bound to
     * `undefined` renders neither ticked nor unticked.
     */
    test('and the field is WRITTEN false, not merely absent', async () => {
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      const mo = rows.json.results.find((r) => r.email === MO.email);
      expect(mo).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(mo, 'notifyByEmail')).toBe(true);
      expect(mo?.notifyByEmail).toBe(false);
    });

    /** The key AC4's link is, minted at the one moment a `Member` row is born. */
    test('every member row is born with an unsubscribe key, and no two are alike', async () => {
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      const tokens = rows.json.results.map((r) => String(r.unsubscribeToken || ''));
      expect(tokens.length).toBe(3); // the founder, Mo, Ann
      expect(tokens.filter((t) => t.length >= 32)).toHaveLength(3);
      expect(new Set(tokens).size).toBe(3);
    });

    /**
     * 🔴 AC5, and the answer is structural rather than a rule somebody has to
     * keep correct: a pending person has no `Member` row, so there is nowhere
     * for the flag to live and nothing for the fan-out's query to match.
     */
    test('a pending member cannot opt in at all — there is no row to opt in on', async () => {
      const set = await client.post('/functions/setNotifySetting', { wanted: true }, as(sessions.pat));
      // The policy answers first: `call` is `role:member`/`role:admin`, and a
      // pending person holds neither.
      expect(set.status).toBe(403);
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      expect(rows.json.results.some((r) => r.email === PAT.email)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §2 — AC1 and AC2, in one send
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§2 one send, one recipient, one control', () => {
    beforeAll(async () => {
      const set = await client.post('/functions/setNotifySetting', { wanted: true }, as(sessions.mo));
      expect(`mo-opts-in:${set.status}`).toBe('mo-opts-in:200');
      posted = [];
      announcementId = await post('The harvest supper', 'Saturday the ninth, in the hall, from seven.');
      answers.normal = await notify(announcementId);
    });

    test('AC1 — the member who ticked the box was handed exactly one message', () => {
      expect(posted.map((p) => p.to)).toEqual([MO.email]);
    });

    /**
     * 🔴 AC2, and it is the reading that makes AC1 mean anything. Ann is
     * approved, is in `role:member`, and has an address on her row — she differs
     * from Mo in exactly one field.
     */
    test('AC2 — the member who did not tick it was handed nothing, in the same send', () => {
      expect(posted.filter((p) => p.to === ANN.email)).toEqual([]);
      expect(posted.filter((p) => p.to === PAT.email)).toEqual([]);
      expect(posted.filter((p) => p.to === MODERATOR.email)).toEqual([]);
    });

    test('the endpoint reports what the transport actually did', () => {
      expect(answers.normal.sent).toBe(1);
      expect(answers.normal.failed).toBe(0);
      expect(answers.normal.error || '').toBe('');
    });

    /** TPL-002 §6 — no `to:` with the whole membership in it. */
    test('the message names one address and nobody else’s', () => {
      expect(posted[0].to).toBe(MO.email);
      expect(posted[0].text).not.toContain(ANN.email);
      expect(posted[0].text).not.toContain(MODERATOR.email);
    });

    test('it says what was posted', () => {
      expect(posted[0].subject).toBe('The harvest supper');
      expect(posted[0].text).toContain('Saturday the ninth');
    });

    test('and carries a link that needs no sign-in', () => {
      expect(posted[0].text).toContain('https://stanywhere.example.invalid/unsubscribe?token=');
      expect(posted[0].text).toContain('you do not need to sign in');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §3 — D33: the reading a naive fan-out cannot produce
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§3 three members, three messages', () => {
    beforeAll(async () => {
      for (const key of ['ann'] as const) {
        const set = await client.post('/functions/setNotifySetting', { wanted: true }, as(sessions[key]));
        expect(`${key}-opts-in:${set.status}`).toBe(`${key}-opts-in:200`);
      }
      // The founding moderator is a `Member` row like everybody else.
      const set = await client.post('/functions/setNotifySetting', { wanted: true }, as(sessions.mod));
      expect(`mod-opts-in:${set.status}`).toBe('mod-opts-in:200');
      posted = [];
      answers.three = await notify(await post('The roof appeal', 'We have raised half of what the roof needs.'));
    });

    /**
     * 🔴 **The whole point.** D33's first arm — three pulses in one pass — sends
     * ONE message, to the last address, and reports three successes. Three
     * distinct addresses here is the serial pump working; two would be the
     * defect with a different count on it.
     */
    test('three opted-in members receive three distinct messages', () => {
      expect(posted).toHaveLength(3);
      expect(new Set(posted.map((p) => p.to))).toEqual(new Set([MO.email, ANN.email, MODERATOR.email]));
    });

    test('and each is addressed to one person', () => {
      for (const p of posted) expect(p.to.split(',')).toHaveLength(1);
    });

    /**
     * ⚠️ The token is per-member, so three links and not one repeated. This is
     * the reading that would go red if the pump ever published the address from
     * one row and the token from another.
     */
    test('each carries its own unsubscribe link', () => {
      const links = posted.map((p) => (p.text.match(/token=([^\s]+)/) || [])[1]);
      expect(links.filter(Boolean)).toHaveLength(3);
      expect(new Set(links).size).toBe(3);
    });

    test('the count the moderator is shown matches the count the server sent', () => {
      expect(answers.three.sent).toBe(3);
      expect(answers.three.failed).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §4 — AC6, then AC3 with its control
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§4 when a send fails', () => {
    beforeAll(async () => {
      refuse.add(ANN.email);
      posted = [];
      answers.oneBad = await notify(await post('The fete', 'On the green, in July.'));
      refuse.clear();
    });

    /** 🔴 AC6 — one bad mailbox must not cost the other two their email. */
    test('AC6 — the other two are still handed their messages', () => {
      expect(new Set(posted.map((p) => p.to))).toEqual(new Set([MO.email, MODERATOR.email]));
    });

    test('and the moderator is told both halves', () => {
      expect(answers.oneBad.sent).toBe(2);
      expect(answers.oneBad.failed).toBe(1);
      expect(answers.oneBad.error || '').toContain('550');
    });
  });

  describe('§5 AC3 — an unconfigured backend says so', () => {
    /**
     * 🔴 **The control pair, and it varies one thing: `email.json`.** The
     * configured arm is §2/§3 above, taken on this same instrument. This arm
     * removes the file and restarts, which is the state a fresh install is in —
     * TPL-002 §2: *"on a fresh install this feature is inert, and that is
     * correct. What is not correct is being inert silently."*
     */
    let unconfigured: NotifyAnswer = {};

    beforeAll(async () => {
      await service.stop();
      fs.rmSync(path.join(dataDir, 'email.json'), { force: true });
      service = new BackendService({ dataDir, port: 0, backendId: 'tpl002', backendName: 'St Anywhere' });
      const started = await service.start();
      base = started.listen.url;
      expect(started.security.enforced).toBe(true);
      captureTransport();
      posted = [];
      sessions.mod = (
        await client.post<{ sessionToken: string }>('/login', {
          username: MODERATOR.email,
          password: MODERATOR.password
        })
      ).json.sessionToken;
      unconfigured = await notify(await post('The carol service', 'Six o’clock, on the twenty-fourth.'));
    });

    test('nothing is queued', () => {
      expect(posted).toEqual([]);
    });

    test('every recipient is reported as failed rather than as sent', () => {
      expect(unconfigured.sent).toBe(0);
      expect(unconfigured.failed).toBe(3);
    });

    /**
     * 🔴 **The sentence is the product's own, verbatim.**
     * `EmailConfigState.notConfiguredReason()` names the Backend Services panel,
     * which is the one thing the moderator reading it has to go and open — and a
     * sentence of the template's own here would drift out of date with it.
     */
    test('AC3 — and the reason names what to do about it', () => {
      expect(unconfigured.error || '').toContain('Email is not configured for this backend');
      expect(unconfigured.error || '').toContain('Backend Services panel');
    });

    /**
     * ⚠️ The control on the control: §2 and §3 took the configured reading on
     * this same instrument, and they are not empty. Without this line "the
     * unconfigured arm sent nothing" is equally consistent with a transport that
     * never captured anything at all.
     */
    test('(control) the configured arm on this same instrument was not empty', () => {
      expect(answers.normal.sent).toBe(1);
      expect(answers.three.sent).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §6 — AC4, signed out
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§6 AC4 — turning it off from the email', () => {
    let token = '';

    beforeAll(async () => {
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      token = String(rows.json.results.find((r) => r.email === MO.email)?.unsubscribeToken || '');
      expect(token.length).toBeGreaterThan(31);
    });

    test('the link works with no session at all', async () => {
      const res = await client.post('/functions/unsubscribe', { token });
      expect(res.status).toBe(200);
    });

    /** 🔴 One flag, two doors: the account page then reads what the link wrote. */
    test('and the account page then reads the box as unticked', async () => {
      sessions.mo = (
        await client.post<{ sessionToken: string }>('/login', { username: MO.email, password: MO.password })
      ).json.sessionToken;
      expect(await mySetting(sessions.mo)).toBe(false);
    });

    /**
     * ⚠️ The negative control on the token: it must name ONE row. Without this,
     * "Mo is unsubscribed" is equally consistent with a query that matched
     * everybody.
     */
    test('(control) nobody else was unsubscribed by it', async () => {
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      const ann = rows.json.results.find((r) => r.email === ANN.email);
      expect(ann?.notifyByEmail).toBe(true);
    });

    test('a token nobody holds is refused, and changes nothing', async () => {
      const res = await client.post('/functions/unsubscribe', { token: 'not-a-real-token-000000000000000' });
      expect(res.status).not.toBe(200);
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      expect(rows.json.results.filter((r) => r.notifyByEmail === true)).toHaveLength(2);
    });

    /** 🔴 A blank token must never reach the query: it would match every row. */
    test('a blank token is refused before it reaches the query', async () => {
      const res = await client.post('/functions/unsubscribe', { token: '' });
      expect(res.status).not.toBe(200);
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/Member', as(sessions.mod));
      expect(rows.json.results.filter((r) => r.notifyByEmail === true)).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §7 — who may call what
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§7 the doors', () => {
    /** 🔴 The fan-out reads every opted-in member's address. */
    test('a member cannot run the fan-out', async () => {
      const res = await client.post('/functions/notifyMembers', { announcementId }, as(sessions.mo));
      expect(res.status).toBe(403);
    });

    test('and neither can a stranger', async () => {
      const res = await client.post('/functions/notifyMembers', { announcementId });
      expect(res.status).toBe(403);
    });

    test('a member still cannot read the member list directly', async () => {
      const res = await client.get('/classes/Member', as(sessions.mo));
      expect(res.status).toBe(403);
    });

    /**
     * 🔴 The endpoint takes no row id, so "somebody else's row" is not a request
     * that can be expressed. This asserts the shape rather than a guard: the
     * parameter list is `wanted` and nothing else.
     */
    test('setNotifySetting names no row, so there is no row to tamper with', () => {
      const nodes = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'components', '__cloud__', 'setNotifySetting', 'nodes.json'), 'utf-8')
      ) as { nodes: Array<{ type: string; parameters?: Record<string, unknown> }> };
      const req = nodes.nodes.find((n) => n.type === 'noodl.cloud.request');
      expect(req?.parameters?.params).toBe('wanted');
    });
  });
});
