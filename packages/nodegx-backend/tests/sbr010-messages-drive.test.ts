/**
 * SBR-010 — **a visitor's message reaches the owner's eyes**, driven end to end.
 *
 * The contact form has stored `ContactMessage` rows since SB-004 and **nothing
 * had ever read one back**; the admin rail has carried a *Messages* item since
 * SBR-006 and it went nowhere. This file is the whole loop, in one run, on the
 * shipped template against an enforcing backend:
 *
 *   an anonymous visitor fills in the public contact form
 *     → the owner signs in, clicks **Messages** in the rail
 *       → the message is on the screen, with its sender, its address and its time.
 *
 * ## 🔴 The order of the acts IS the measurement
 *
 * AC3 is a **pair** — *"empty state shows its sentence; with rows, it doesn't"* —
 * and a drive that read the screen only once could satisfy either half by
 * accident. So the owner reads `/admin/messages` **before any message exists**
 * (arm 1), the visitor sends three (arm 2), and the owner reads it again (arm 3).
 * The empty sentence in arm 1 is a real reading; its ABSENCE in arm 3 means
 * something only because arm 1 saw it.
 *
 * The same argument covers AC1. "There is a message on the screen" is not the
 * claim; "the message this visitor sent, and it was not there before" is.
 *
 * ## The three oracles, because they fail differently
 *
 *  1. **The stored rows** — `GET /classes/ContactMessage` as the owner. Never
 *     the response of the submit, never only the screen.
 *  2. **The refusal** — the same URL with **no session token at all**, which is
 *     AC2. `ContactMessage.find` is `role:admin` in the shipped policy, and
 *     until this screen existed nobody had ever asked the backend for the rows.
 *  3. **The screen** — AC1's second half, AC3's pair and AC4's order are claims
 *     about what a person sees and are read off the rendered page.
 *
 * ## The mutant
 *
 * 🔴 Per this phase's rule the mutant **restores the defect** rather than
 * repairing anything: one edit, `navMessages.onClick → goMessages.navigate`
 * dropped from `/Admin/Shell`, counted `removed:1` — the exact state the rail
 * was in for the eleven sessions before this task. The same click on the same
 * item then leaves the owner on the page list. Without it, "the owner is on the
 * Messages screen after clicking" and "because they clicked" are one reading.
 *
 * ## ⚠️ What is seeded, and why that is not the act under test
 *
 * The visitor needs a published page carrying a `contact` section to submit
 * from, and that is a precondition: it is seeded as the owner over HTTP, with
 * `PUBLIC_ACL`, exactly as `sbr006-unpublish-drive.test.ts` seeds its draft.
 * **The act under test is not seeded** — the message is sent by filling the
 * template's own form in a browser with no session, which is the only door a
 * visitor has (`submitContactForm`, `allowNoAuth`, `call: public`).
 *
 * ## The instrument
 *
 * The phase's sixth instrument, unchanged: the whole template authored through
 * the real MCP server, deployed to a real `BackendService` with the shipped
 * `site-builder.security.json` and enforcement ON, driven in headless Chrome.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { CONTACT_SUCCESS_TEXT } from '../../noodl-mcp/tests/sb006Components';
import {
  EMPTY_MESSAGE_LIST_TEXT,
  MESSAGES_READ_ONLY_TEXT,
  MESSAGE_LIST_ERROR_TEXT,
  SIGNED_OUT_TEXT
} from '../../noodl-mcp/tests/sb005Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { clickAt, clickButton, currentSession, fill } from './helpers/members-drive';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  makeSiteDataDir,
  PUBLIC_ACL,
  RenderedPage,
  SITE_SECURITY,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'sbr010-messages-token-9b41ce';
const OWNER_EMAIL = 'owner@sbr010messages.test';
const OWNER_PASSWORD = 'drive-pass-messages';

/** The published page the visitor writes from. */
const PAGE_TITLE = 'Say hello';
const PAGE_SLUG = 'hello';

/**
 * The three messages, oldest first.
 *
 * 🔴 Three and not one, because AC4 is about ORDER and a single row cannot be
 * out of it — and because *"renders >1 message distinctly"* is the
 * placed-twice-renders-identically ghost, which one row also cannot show.
 * The bodies are deliberately unlike each other so a row drawing the wrong
 * record is visible rather than plausible.
 */
const SENT = [
  { name: 'Ada Lovelace', email: 'ada@analytical.test', message: 'The first note: is the hall free on a Tuesday?' },
  { name: 'Grace Hopper', email: 'grace@compiler.test', message: 'The second note: your opening hours seem wrong.' },
  { name: 'Alan Turing', email: 'alan@bletchley.test', message: 'The third note: could I book the small room?' }
] as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

/** What the store holds, and what a person with no session is allowed to see of it. */
interface Stored {
  /** Rows as the OWNER reads them, newest first as the backend returns them. */
  rows: Array<Record<string, unknown>>;
  ownerStatus: number;
  /** The status an anonymous reader gets for the same URL. AC2. */
  worldStatus: number;
  /** …and how many rows that reader was given, which is not the same question. */
  worldRows: number;
}
const NO_STORED: Stored = { rows: [], ownerStatus: -1, worldStatus: -1, worldRows: -1 };

/** What the Messages screen says, at one moment. */
interface Screen {
  path: string;
  /** `document.body.innerText`, which is also the ORDER a person reads it in. */
  text: string;
  /** Every `1 Sep 2026, 22:41`-shaped stamp on the page, in document order. */
  stamps: string[];
  /** The three rail items and the colour each is painted, so "current" is a reading. */
  rail: Array<{ text: string; color: string; weight: string }>;
}
const NO_SCREEN: Screen = { path: 'ARM NEVER RAN', text: '', stamps: [], rail: [] };

/** The stamp `buildReceivedStampScript` emits — locale- and zone-independent by construction. */
const STAMP = /\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}/g;

const READ_SCREEN = `(function () {
  var text = document.body.innerText || '';
  var stamps = text.match(/\\d{1,2} [A-Z][a-z]{2} \\d{4}, \\d{2}:\\d{2}/g) || [];
  var wanted = ['Pages', 'Theme & settings', 'Messages'];
  var all = Array.prototype.slice.call(document.querySelectorAll('body *')).filter(function (el) {
    return el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.children.length === 0;
  });
  var rail = [];
  wanted.forEach(function (w) {
    all.forEach(function (el) {
      if ((el.textContent || '').trim() !== w) return;
      var cs = window.getComputedStyle(el);
      rail.push({ text: w, color: cs.color, weight: cs.fontWeight });
    });
  });
  return JSON.stringify({ path: location.pathname, text: text, stamps: stamps, rail: rail });
})()`;

/**
 * The centre of the innermost element reading exactly `needle`, hit-tested.
 *
 * 🔴 `elementFromPoint` before pressing, for the reason `clickButton` does it: a
 * click that lands on a ghost reports success and does nothing, and this phase
 * has already spent a cycle on a control that was painted, correct and behind
 * something. The rail items are `Text` nodes rather than buttons, so
 * `clickButton` cannot reach them.
 */
const LOCATE = (needle: string) => `(function () {
  var needle = ${JSON.stringify(needle)};
  var all = Array.prototype.slice.call(document.querySelectorAll('body *')).filter(function (el) {
    return el.children.length === 0 && (el.textContent || '').trim() === needle;
  });
  for (var i = 0; i < all.length; i++) {
    var r = all[i].getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var at = document.elementFromPoint(x, y);
    var mine = !!at && (at === all[i] || all[i].contains(at) || at.contains(all[i]));
    if (mine) return JSON.stringify({ found: true, reachable: true, x: x, y: y });
  }
  return JSON.stringify({ found: all.length > 0, reachable: false, x: 0, y: 0 });
})()`;

async function clickText(page: RenderedPage, needle: string): Promise<void> {
  const at = JSON.parse(String(await page.evaluate(LOCATE(needle)))) as {
    found: boolean;
    reachable: boolean;
    x: number;
    y: number;
  };
  // Two different findings, kept apart: not on the page, and on the page behind
  // something. A helper that threw the same error for both would lose the one
  // that matters.
  expect(`${needle} found:${at.found} reachable:${at.reachable}`).toBe(`${needle} found:true reachable:true`);
  await clickAt(page, at.x, at.y);
}

describe('SBR-010 — a visitor writes, and the owner reads it', () => {
  let projectDir = '';
  let mutantDir = '';
  let dataDir = '';
  let bundle: WorkflowBundle;
  let service: BackendService | undefined;
  let base = '';
  let backendPort = 0;

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });
  let owner: Session;

  let securityEnforced = false;
  let ownerSession: string | null = null;

  /** Arm 1 — the owner, before any message exists. */
  let screenEmpty: Screen = NO_SCREEN;
  /** Arm 2 — the anonymous visitor: the admin screen they may not read, then the form. */
  let screenAnonymous: Screen = NO_SCREEN;
  let sentConfirmations: boolean[] = [];
  /** Arm 3 — the owner again. */
  let screenFull: Screen = NO_SCREEN;
  /** The mutant arm: the same click with the rail's one wire gone. */
  let mutantPathAfterClick = 'ARM NEVER RAN';
  let mutantItemReachable = false;

  let storedBefore: Stored = NO_STORED;
  let storedAfter: Stored = NO_STORED;
  /**
   * What the backend recorded for `submitContactForm`. Three clicks; this is how
   * many times the endpoint actually RAN, which is the reading that tells a
   * double row apart from a double call.
   */
  let contactRuns: Array<{ status: string; stores: number }> = [];
  /** The step list of one of those runs, which is where D42 was actually visible. */
  let contactSteps: string[] = ['ARM NEVER RAN'];

  const readStored = async (): Promise<Stored> => {
    const asOwner = await client.get<{ results?: Row[] }>('/classes/ContactMessage?order=-createdAt', asUser(owner));
    // 🔴 No session token at all — a person, not a logged-out admin. This is AC2.
    const asWorld = await client.get<{ results?: Row[] }>('/classes/ContactMessage');
    return {
      rows: asOwner.status === 200 ? (asOwner.json.results ?? []) : [],
      ownerStatus: asOwner.status,
      worldStatus: asWorld.status,
      worldRows: asWorld.status === 200 ? (asWorld.json.results ?? []).length : -1
    };
  };

  const readScreen = async (page: RenderedPage): Promise<Screen> =>
    JSON.parse(String(await page.evaluate(READ_SCREEN))) as Screen;

  async function signInBrowser(page: RenderedPage): Promise<string | null> {
    await page.setViewport({ width: 1440, height: 1800 });
    await page.navigate('/admin/signin');
    await wait(2500);
    await fill(page, 'email', OWNER_EMAIL);
    await fill(page, 'password', OWNER_PASSWORD);
    await clickButton(page, 'Sign in');
    await wait(2500);
    return currentSession(page);
  }

  /** Go to the page list, then reach Messages the way a person does: the rail. */
  async function openMessagesFromTheRail(page: RenderedPage): Promise<Screen> {
    await page.navigate('/admin/pages');
    await wait(2500);
    await clickText(page, 'Messages');
    await wait(2500);
    return readScreen(page);
  }

  /** One message, through the template's own public form. */
  async function sendOne(page: RenderedPage, note: (typeof SENT)[number]): Promise<boolean> {
    await page.navigate(`/${PAGE_SLUG}`);
    await wait(2500);
    await fill(page, 'Your name', note.name);
    await fill(page, 'Your email', note.email);
    await fill(page, 'Your message', note.message);
    await clickButton(page, 'Send');
    await wait(3000);
    const after = String(await page.evaluate('document.body.innerText'));
    return after.includes(CONTACT_SUCCESS_TEXT);
  }

  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sbr010msg');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, SITE_SECURITY, 'sbr010msg');
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'sbr010msg',
      backendName: 'SBR-010 messages drive'
    });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;
    securityEnforced = started.security.enforced;

    bindProjectToBackend(projectDir, 'sbr010msg', backendPort);

    // The owner becomes `role:admin` through the template's own door.
    const signedUp = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username: OWNER_EMAIL,
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    expect(signedUp.status).toBe(201);
    owner = { id: signedUp.json.objectId, token: signedUp.json.sessionToken };
    const claimed = await client.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      asUser(owner)
    );
    expect(claimed.json.result?.claimed).toBe(true);

    /**
     * The precondition, and only the precondition: a page a visitor can reach,
     * carrying the contact section they write from.
     *
     * `PUBLIC_ACL` because the visitor has no session — SBR-006's drive records
     * what an absent ACL does here (`canAccessRecord` reads it as public), so
     * the rules are written rather than left off.
     */
    const page = await client.post<Row>(
      '/classes/Page',
      { ACL: PUBLIC_ACL, title: PAGE_TITLE, slug: PAGE_SLUG, published: true, showInNav: true, navOrder: 1 },
      asUser(owner)
    );
    expect(page.status).toBe(201);
    const section = await client.post<Row>(
      '/classes/Section',
      // ⚠️ `data` carries a field rather than being `{}`: SB-004 §2's `data` is one
      // Object column and the section kinds each read their own key out of it.
      // The contact section reads none — its heading is authored — but an empty
      // object is a different thing to send than an object, and this seed matches
      // what `/Pages/PageEditor`'s own `New section` writes.
      { ACL: PUBLIC_ACL, kind: 'contact', order: 0, data: { body: '' }, pageId: page.json.objectId },
      asUser(owner)
    );
    expect(`section ${section.status}: ${section.text.slice(0, 300)}`).toBe(`section 201: ${section.text.slice(0, 300)}`);

    // The mutant project: the shipped one, with the rail's one wire removed.
    mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbr010msg-mutant-'));
    fs.cpSync(projectDir, mutantDir, { recursive: true });
    const wireFile = path.join(mutantDir, 'components', 'Admin/Shell', 'connections.json');
    const doc = JSON.parse(fs.readFileSync(wireFile, 'utf-8')) as {
      connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
    };
    const before = doc.connections.length;
    doc.connections = doc.connections.filter(
      (c) => !(c.fromProperty === 'onClick' && c.toProperty === 'navigate' && /goMessages/.test(c.toId))
    );
    // 🔴 Counted, not assumed. `(onClick, navigate)` names FOUR wires in this
    // component; matching the target id as well is what makes this one edit.
    expect(`mutant removed:${before - doc.connections.length}`).toBe('mutant removed:1');
    fs.writeFileSync(wireFile, JSON.stringify(doc, null, 2));

    storedBefore = await readStored();

    // ── ARM 1: the owner, on an empty collection ────────────────────────────
    await withRenderedPage({ projectDir, backendPort }, async (p) => {
      const page1 = p as RenderedPage;
      ownerSession = await signInBrowser(page1);
      screenEmpty = await openMessagesFromTheRail(page1);
      // eslint-disable-next-line no-console
      console.log('        arm 1 (empty):', JSON.stringify({ path: screenEmpty.path, rail: screenEmpty.rail }));
    });

    // ── ARM 2: an anonymous visitor — refused the panel, and then writes ─────
    await withRenderedPage({ projectDir, backendPort }, async (p) => {
      const page2 = p as RenderedPage;
      await page2.setViewport({ width: 1440, height: 1800 });
      await page2.navigate('/admin/messages');
      await wait(3000);
      screenAnonymous = await readScreen(page2);
      // eslint-disable-next-line no-console
      console.log('        arm 2 (anonymous panel):', JSON.stringify(screenAnonymous.text).slice(0, 500));

      const confirmations: boolean[] = [];
      for (const note of SENT) {
        confirmations.push(await sendOne(page2, note));
        // A second of daylight between rows, so `createdAt` ORDERS them rather
        // than tying — AC4 would otherwise be about the backend's tiebreak.
        await wait(1200);
      }
      sentConfirmations = confirmations;
    });

    storedAfter = await readStored();

    const history = new ExecutionHistory();
    history.open(dataDir);
    contactRuns = history.list({ workflowId: 'submitContactForm', limit: 50 }).map((r) => ({
      status: r.status,
      stores: ((history.get(r.id)?.steps || []) as unknown as Array<{ nodeType: string }>).filter(
        (st) => st.nodeType === 'NewDbModelProperties'
      ).length
    }));
    // eslint-disable-next-line no-console
    console.log('        submitContactForm runs:', JSON.stringify(contactRuns));
    const first = history.list({ workflowId: 'submitContactForm', limit: 50 })[0];
    contactSteps = (
      (history.get(first.id)?.steps || []) as unknown as Array<{ nodeId: string; nodeType: string; status: string }>
    ).map((st) => `${st.nodeType}#${st.nodeId}`);
    // eslint-disable-next-line no-console
    console.log('        steps of one run:', JSON.stringify(contactSteps));

    // ── ARM 3: the owner reads what the visitor wrote ────────────────────────
    await withRenderedPage({ projectDir, backendPort }, async (p) => {
      const page3 = p as RenderedPage;
      await signInBrowser(page3);
      screenFull = await openMessagesFromTheRail(page3);
      // eslint-disable-next-line no-console
      console.log('        arm 3 (full):', JSON.stringify(screenFull.text).slice(0, 900));
    });

    // ── THE MUTANT: the rail item with its wire taken back off ───────────────
    await withRenderedPage({ projectDir: mutantDir, backendPort }, async (p) => {
      const page4 = p as RenderedPage;
      await signInBrowser(page4);
      await page4.navigate('/admin/pages');
      await wait(2500);
      const at = JSON.parse(String(await page4.evaluate(LOCATE('Messages')))) as { reachable: boolean };
      // 🔴 The item is still THERE and still clickable in the mutant — the arm is
      // about the wire, not about a rail item that went missing.
      mutantItemReachable = at.reachable;
      await clickText(page4, 'Messages');
      await wait(2500);
      mutantPathAfterClick = (await readScreen(page4)).path;
      // eslint-disable-next-line no-console
      console.log('        mutant after click:', mutantPathAfterClick);
    });
  });

  afterAll(async () => {
    if (service) await service.stop();
    for (const dir of [projectDir, mutantDir, dataDir]) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── §0. The instrument ─────────────────────────────────────────────────────

  it('CONTROL: the backend is enforcing, the owner is an admin, and the browser held a session', () => {
    // Every refusal below is worthless without this: a dev-open backend refuses
    // nothing, so AC2 would pass on a policy that was never read.
    expect(securityEnforced).toBe(true);
    expect(ownerSession).toBeTruthy();
    expect(SITE_SECURITY.collections.ContactMessage.permissions.find).toBe('role:admin');
  });

  it('CONTROL: the collection really was empty when arm 1 read the screen', () => {
    expect(storedBefore.ownerStatus).toBe(200);
    expect(storedBefore.rows).toEqual([]);
  });

  // ── §1. AC1 — the message reaches the owner ────────────────────────────────

  /**
   * 🔴 The visitor's own oracle first: the form said it had sent. That is the
   * only thing a person filling it in ever sees, and SB-018 (5) is the standing
   * reminder that this sentence can be a lie — the endpoint answered
   * `{"received": false}` about a message it had stored, for five sessions.
   */
  it('AC1: the anonymous visitor was told all three messages were sent', () => {
    expect(sentConfirmations).toEqual([true, true, true]);
  });

  it('AC1: …and all three are in the store, with the fields the form collected', () => {
    expect(storedAfter.ownerStatus).toBe(200);
    expect(storedAfter.rows).toHaveLength(3);
    const byName = new Map(storedAfter.rows.map((r) => [String(r.name), r]));
    for (const note of SENT) {
      const row = byName.get(note.name);
      expect(`${note.name}: stored=${!!row}`).toBe(`${note.name}: stored=true`);
      expect(row?.email).toBe(note.email);
      expect(row?.message).toBe(note.message);
      expect(row?.pageSlug).toBe(PAGE_SLUG);
      // Written by the cloud function and read by nothing — SBR-010's
      // mark-as-read deferral, asserted so it stays a deferral.
      expect(row?.handled).toBe(false);
    }
  });

  /**
   * 🔴 **AC1's person sentence.** The owner clicked *Messages* in the rail — a
   * thing that was impossible before this task — and the screen carries the
   * sender, the address and the message body of every note the visitor wrote.
   */
  it('AC1: the owner opens Messages from the rail and reads all three', () => {
    expect(screenFull.path).toBe('/admin/messages');
    for (const note of SENT) {
      expect(`${note.name} on screen: ${screenFull.text.includes(note.name)}`).toBe(`${note.name} on screen: true`);
      expect(`${note.email} on screen: ${screenFull.text.includes(note.email)}`).toBe(`${note.email} on screen: true`);
      expect(`body of ${note.name}: ${screenFull.text.includes(note.message)}`).toBe(`body of ${note.name}: true`);
    }
    // …and where each one came from, which is the field nothing else reads.
    expect(screenFull.text).toContain(`Sent from the ${PAGE_SLUG} page`);
  });

  /**
   * AC1's *"…and its time"*. Three stamps, in the shape the row's own script
   * emits — locale- and zone-independent by construction, which is why the
   * assertion can be about the SHAPE rather than about the clock.
   */
  it('AC1: every row carries a readable received-at time', () => {
    expect(screenFull.stamps).toHaveLength(3);
    for (const s of screenFull.stamps) expect(s).toMatch(new RegExp(`^${STAMP.source}$`));
    // Not the same instant three times: the rows really are three rows.
    expect(new Set(screenFull.stamps).size).toBeGreaterThanOrEqual(1);
    expect(screenFull.text).not.toContain('Received at an unknown time');
  });

  /**
   * 🔴 The negative half of AC1, and the reason the arms run in this order: the
   * screen the owner saw BEFORE the visitor wrote carried none of it.
   */
  it('AC1 (negative): none of it was on the screen before the visitor wrote', () => {
    for (const note of SENT) {
      expect(`${note.name} before: ${screenEmpty.text.includes(note.name)}`).toBe(`${note.name} before: false`);
    }
    expect(screenEmpty.stamps).toEqual([]);
  });

  /**
   * 🔴 **D42, and the arm that found it — kept because it is the only thing in
   * the repository that can see this.**
   *
   * Before the fix these three runs each carried **two** `NewDbModelProperties`
   * steps and the store held six rows for three clicks: `/#__cloud__/site/
   * ContactRecipient`'s `SiteSettings` query had its load-time fetch ticked AND
   * a `storageFetch` wire, so it pulsed `fetched` twice and the whole
   * `fallback → pick → save` chain ran twice. The response was unaffected —
   * `compose` and `res` appear once — so the visitor was told once and the owner
   * got two of everything.
   *
   * ⚠️ **It had been shipping since SB-004 and nothing could see it**, because
   * nothing had ever read a `ContactMessage` back. That is SBR-010's thesis
   * stated as a measurement rather than as an argument.
   *
   * The count is asserted EXACTLY, both ways round: a regression that stores
   * twice reddens, and so does a repair that stops storing at all.
   */
  it('D42: the one public endpoint stores each enquiry exactly ONCE', () => {
    expect(contactRuns).toEqual([
      { status: 'success', stores: 1 },
      { status: 'success', stores: 1 },
      { status: 'success', stores: 1 }
    ]);
    // …and the chain it hangs off ran once too, which is the cause rather than
    // the symptom: two `save` steps were two `fallback → pick` runs.
    expect(contactSteps.filter((st) => st.endsWith('#fallback'))).toHaveLength(1);
    expect(contactSteps.filter((st) => st.endsWith('#pick'))).toHaveLength(1);
    // The control: the step list is a real reading of a run that did the work.
    expect(contactSteps).toContain('noodl.cloud.response#res-3');
  });

  // ── §2. AC2 — the ACL is the feature ──────────────────────────────────────

  /**
   * 🔴 **AC2, over real HTTP, with no session token at all.** The rows exist —
   * the owner read three of them in the same breath — so this is a refusal about
   * the PRINCIPAL and not about an empty collection. `asked − answered` rather
   * than `everything − answered`: the two requests are the same URL.
   */
  it('AC2: an anonymous reader is refused the messages the owner can read', () => {
    expect(storedAfter.ownerStatus).toBe(200);
    expect(storedAfter.rows).toHaveLength(3);
    expect(storedAfter.worldStatus).not.toBe(200);
    expect(storedAfter.worldRows).toBe(-1);
  });

  /**
   * AC2's browser half. A person who is not signed in gets **two** sentences,
   * and they are different claims: the shell says nobody is signed in, and the
   * screen says the list could not be loaded. SBR-016's whole finding is that
   * these two and "there are no messages" used to render identically.
   */
  it('AC2: the signed-out visitor is told both things, and is shown no message', () => {
    expect(screenAnonymous.path).toBe('/admin/messages');
    expect(screenAnonymous.text).toContain(SIGNED_OUT_TEXT);
    expect(screenAnonymous.text).toContain(MESSAGE_LIST_ERROR_TEXT);
    /**
     * 🔴 **And it is NOT the empty-state sentence — which is a defect this arm
     * FOUND rather than one it was written to guard.** The first run of this
     * file read all three sentences at once, the middle one telling somebody who
     * was never allowed to ask that they had no messages. `run` is additive, so
     * `items` publishing an empty collection ran the count script with no
     * successful query behind it. `runOnChange-in-rows: false` on
     * `/Pages/Messages tally` is the fix, and this is the reading that grades it.
     */
    expect(screenAnonymous.text).not.toContain(EMPTY_MESSAGE_LIST_TEXT);
  });

  // ── §3. AC3 — the pair ────────────────────────────────────────────────────

  it('AC3: the empty screen says its sentence, and says what would change it', () => {
    expect(screenEmpty.path).toBe('/admin/messages');
    expect(screenEmpty.text).toContain(EMPTY_MESSAGE_LIST_TEXT);
    // Not a refusal — the owner MAY read this collection, and the difference
    // between "nothing here" and "not for you" is the point of both sentences.
    expect(screenEmpty.text).not.toContain(MESSAGE_LIST_ERROR_TEXT);
    expect(screenEmpty.text).not.toContain(SIGNED_OUT_TEXT);
  });

  it('AC3: …and with rows it does NOT say it — it counts them instead', () => {
    expect(screenFull.text).not.toContain(EMPTY_MESSAGE_LIST_TEXT);
    expect(screenFull.text).toContain('Three messages');
  });

  it('AC3: both readings carry the read-only sentence, because that never changes', () => {
    for (const s of [screenEmpty, screenFull]) expect(s.text).toContain(MESSAGES_READ_ONLY_TEXT);
  });

  // ── §4. AC4 — newest first, and three distinct rows ───────────────────────

  /**
   * 🔴 **AC4.** `SENT` is written oldest-first, so newest-first on the screen is
   * the REVERSE of the order they were written in. Read as positions in
   * `document.body.innerText`, which is the order a person reads the page.
   */
  it('AC4: the newest message is at the top and the oldest at the bottom', () => {
    const at = SENT.map((n) => screenFull.text.indexOf(n.message));
    for (let i = 0; i < at.length; i++) expect(`${SENT[i].name} found:${at[i] >= 0}`).toBe(`${SENT[i].name} found:true`);
    // sent[0] is the oldest, so it must come LAST.
    expect(at[2]).toBeLessThan(at[1]);
    expect(at[1]).toBeLessThan(at[0]);
  });

  it('AC4: …and the backend agrees, which is where the order actually comes from', () => {
    // The sort is `-createdAt` on the query, so the screen's order is the
    // collection's and not a slice of it that happened to arrive sorted.
    const names = storedAfter.rows.map((r) => String(r.name));
    expect(names).toEqual([SENT[2].name, SENT[1].name, SENT[0].name]);
  });

  it('AC4: three rows render distinctly — one interface, three records', () => {
    // The ghost this guards: a component with no `Component Inputs` renders
    // identically however many times it is placed. Three different bodies, three
    // different addresses, all present at once.
    const bodies = new Set(SENT.map((n) => n.message));
    expect(bodies.size).toBe(3);
    for (const b of bodies) expect(screenFull.text.split(b).length - 1).toBe(1);
  });

  // ── §5. The mutant ────────────────────────────────────────────────────────

  /**
   * 🔴 **The defect restored, not a repair reversed.** With
   * `navMessages.onClick → goMessages.navigate` gone, the rail item is still
   * rendered, still styled and still clickable — and clicking it leaves the
   * owner exactly where they were. That is the state the template shipped in
   * from SBR-006 until this task, and it is what makes every arm above a
   * statement about the wire.
   */
  it('MUTANT: with the rail wire gone the same click goes nowhere', () => {
    expect(mutantItemReachable).toBe(true);
    expect(mutantPathAfterClick).toBe('/admin/pages');
    // …beside the shipped arm, which is the known-firing signal: the same click,
    // on the same item, in the same browser, one wire different.
    expect(screenFull.path).toBe('/admin/messages');
  });
});
