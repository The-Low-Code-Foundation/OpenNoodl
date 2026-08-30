/**
 * SBR-007 AC2 — the template's **own** drag, on the real page editor, end to end.
 *
 * s30 built the gesture and drove the *mechanism*: `ac2DragGestureDrive.test.ts` authors a probe
 * page through the MCP door, renders it, and moves a synthesised pointer over three deliberately
 * non-uniform rows. That answered "can a graph turn a pointer drag into the `toIndex`
 * `reorderSection` already takes" — and it answered it on a page written for the question.
 *
 * 🔴 **It never loaded `/Pages/PageEditor` against a backend with sections and dragged one**, and
 * s30's handoff states that gap rather than ticking it (§33.7). This file is that drive, and the
 * difference was not ceremony: everything between the card and the stored row is different here.
 * The rows come from a `DbCollection2` rather than a `Static Data` node, the drop travels
 * `For Each.itemOutput-DropIndex` → `CloudFunction2` → a deployed `reorderSection` rather than into
 * a `Text` node, and the container the arithmetic counts over is the template's `sectionRows`.
 *
 * ## 🔴 What running it found: the shipped screen cannot be dragged, for two reasons that are not
 * the gesture
 *
 *  1. **`/Pages/PageEditor`'s section query states no `visualSort`** while `/Pages/Site`'s does, so
 *     the panel draws its sections in whatever order the backend hands back rather than in `order`.
 *     `dropIndex` counts DOM siblings and `reorderSection` renumbers the list sorted by `order`;
 *     those are the same list only while the editor draws in `order`.
 *  2. **`/Admin/SectionRow`'s `merge` node re-runs on the value it writes**, so opening the editor
 *     on a page that has sections starts a cyclic loop that writes to the backend until the
 *     1200/min limiter refuses everything, and the client's sections then vanish from the screen.
 *
 * The second one makes the first undriveable on the shipped artefact — the page destroys itself
 * before a gesture can be graded — so the drag is driven on an arm that differs from the shipped
 * project by the parameters the editor's own NDA-017 migration would write. Stated plainly rather
 * than papered over: **AC2's gesture works on the real page editor, and the artefact a person
 * receives cannot show it.**
 *
 * ## The instrument
 *
 * SB-008's harness joined to the phase's fifth instrument:
 *
 *  - `helpers/site-drive.ts` — the whole template authored through the real MCP server, deployed
 *    to a real `BackendService` with the shipped `site-builder.security.json` and enforcement ON,
 *    and rendered by `render-from-disk.js` under headless Chrome.
 *  - `Input.dispatchMouseEvent` over the same CDP connection, with 🔴 **`buttons: 1` on every
 *    move** — `react-draggable` listens on the document and ignores a move without the button bit,
 *    so without it the press and the release both land, nothing moves, and the failure reads
 *    exactly like *"the runtime cannot drag"*.
 *  - 🔴 **One-edit mutants of the project on disk.** `render-from-disk.js` reads the v2 project
 *    files, so an arm can vary exactly one connection or one parameter bag of the shipped graph
 *    and nothing else. That is what turns "there is a loop" into "this is what closes it", and
 *    every edit is COUNTED — a mutant that varied nothing is an arm that measured nothing.
 *
 * ⚠️ **The oracle is the STORED ROW, never the response and never the screen.** s28 is what that
 * rule is for: 47 specs read the row the response named — always correct — while three junk rows
 * sat beside it for ten sessions. Every `order` assertion below is a `GET /classes/Section/<id>`
 * as the owner, over the ids this file created, and it is read **before** the editor is opened as
 * well as after — a page in the middle of a write storm refuses the harness's reads too, and a
 * reading taken during one comes back without the field.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
/**
 * ⚠️ Imported from `members-drive` rather than copied. The four helpers used here — a trusted
 * click, a typed field, a labelled button and the runtime's session store — are template-agnostic
 * and were written and graded there; a second copy of a control is the copy that goes stale.
 */
import { clickAt, clickButton, currentSession, fill } from './helpers/members-drive';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  makeSiteDataDir,
  RenderedPage,
  SITE_SECURITY,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

/** The shipped template artefact, read for the static half of finding 2. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SITE_TEMPLATE = require('../../noodl-editor/src/editor/src/models/template/templates/site-builder.content.json');

const SETUP_TOKEN = 'ac2pe-setup-token-9d41b7';
const CONTACT_TO = 'owner@example.invalid';
const OWNER_EMAIL = 'owner@ac2pe.test';
const OWNER_PASSWORD = 'drive-pass-ac2pe';

/** The three sections, in the order they are created and therefore in the `order` they start with. */
const SECTIONS = [
  { kind: 'hero', body: 'The hero section.' },
  { kind: 'richText', body: ['A rich text section.', 'It has several lines.', 'Three, in fact.'].join('\n') },
  { kind: 'gallery', body: 'A gallery.' }
];

/** How long each write-watch arm watches, and how often it looks. */
const WATCH_SAMPLES = 10;
const WATCH_INTERVAL_MS = 1000;
/**
 * The backend's data-request limiter is 1200/min. An arm that saturates it poisons the next one,
 * so the arms that need a working backend wait the window out first.
 */
const RATE_WINDOW_MS = 65000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

/** One card on the screen, as the DOM has it. */
interface Card {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The computed `transform`. `none` or the identity matrix is a card that snapped back. */
  transform: string;
  /** The card's own text, which begins with `kindText` — this is how a card names its section. */
  text: string;
}

/** One reading of the section list, taken in a single `Runtime.evaluate`. */
interface Listing {
  cardCount: number;
  /**
   * 🔴 The parent-boundary control, and the reason `sectionRows` exists at all. A `For Each` draws
   * no box and renders its items into its VISUAL parent's element, so a container holding anything
   * besides the rows makes every drop report an index too high — and the wires, the census and the
   * render are all correct in that arrangement. The real-screen twin of the mechanism drive's
   * `pc=probe-list`.
   */
  containerChildren: number;
  /** Whatever is in that container and is NOT a card, described so a failure names it. */
  strays: string[];
  cards: Card[];
  /** `document.body.innerText`, trimmed — the failure message when a card count is wrong. */
  bodyText: string;
}

/** An empty listing, so a skipped arm fails with a reading rather than a TypeError. */
const NO_LISTING: Listing = { cardCount: -1, containerChildren: -1, strays: ['ARM NEVER RAN'], cards: [], bodyText: '' };

/**
 * Everything about the section list, in one moment.
 *
 * One `evaluate`, not five: a report assembled from five reads is about none of them, and this
 * page refetches from a backend between them.
 *
 * The cards are found by `.react-draggable` because **D28** leaves a `Drag`'s child with no
 * authored class to find it by. That is a defect being routed around, and it is recorded as one.
 */
const READ_LIST = `(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.react-draggable'));
  var parent = cards.length ? cards[0].parentElement : null;
  var kids = parent ? Array.prototype.slice.call(parent.children) : [];
  var describe = function (el) {
    return el.tagName + '.' + String(el.className || '') + '|' +
      String(el.innerText || '').replace(/\\s+/g, ' ').slice(0, 40);
  };
  return JSON.stringify({
    cardCount: cards.length,
    containerChildren: kids.length,
    strays: kids.filter(function (k) { return cards.indexOf(k) < 0; }).map(describe),
    cards: cards.map(function (c) {
      var r = c.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        width: Math.round(r.width),
        height: Math.round(r.height),
        transform: getComputedStyle(c).transform,
        text: String(c.innerText || '').replace(/\\s+/g, ' ').slice(0, 60)
      };
    }),
    bodyText: String(document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 400)
  });
})()`;

/**
 * A real pointer drag, in frames, on the connection the page is already on.
 *
 * 🔴 `buttons: 1` on every move is load-bearing — see the header. Taken from
 * `ac2DragGestureDrive.test.ts`; the two must not drift into disagreeing about the gesture.
 */
async function dragBy(page: RenderedPage, x: number, fromY: number, dy: number, steps = 14): Promise<void> {
  const client = (page as unknown as { client: { send(m: string, p: unknown): Promise<unknown> } }).client;
  const send = (type: string, y: number, extra: Record<string, unknown> = {}) =>
    client.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: 1, ...extra });

  await send('mousePressed', fromY, { clickCount: 1 });
  await wait(60);
  for (let i = 1; i <= steps; i++) {
    await send('mouseMoved', fromY + (dy * i) / steps);
    await wait(25);
  }
  await send('mouseReleased', fromY + dy, { clickCount: 1 });
}

/** The vertical centre of a card. */
const centre = (c: Card): number => c.top + c.height / 2;

/**
 * A card is pressed in its own padding, never on a control.
 *
 * The card carries `paddingLeft: var(--space-4)`, so eight pixels in from its left edge is the card
 * itself rather than the textarea, the image or any of the four buttons — a press on the textarea
 * would also focus it, which is a different gesture with a different failure.
 */
const pressPoint = (c: Card): { x: number; y: number } => ({ x: c.left + 8, y: c.top + 10 });

/** The section kind a card names, which is the first word of its text (`kindText`). */
const kindOf = (c: Card): string => c.text.split(' ')[0];

/**
 * What `reorderSection` does, derived rather than typed out: put `id` at `toIndex` in the list
 * sorted by `order`, and renumber contiguously from zero.
 *
 * The drag arm's expectation is computed with this from the orders that were actually stored, so
 * the assertion is about the mechanism rather than about a guessed starting state. The endpoint's
 * own suite — `sb004-publication-invariant.test.ts` — drives the same three cases directly.
 */
function applyReorder(orders: Record<string, number>, id: string, toIndex: number): Record<string, number> {
  const sorted = Object.keys(orders).sort((a, b) => orders[a] - orders[b]);
  const without = sorted.filter((k) => k !== id);
  const at = Math.max(0, Math.min(toIndex, without.length));
  without.splice(at, 0, id);
  const out: Record<string, number> = {};
  without.forEach((k, i) => (out[k] = i));
  return out;
}

/** A copy of the authored project, for an arm to vary by exactly one edit. */
function copyProject(projectDir: string, label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ac2pe-${label}-`));
  fs.cpSync(projectDir, dir, { recursive: true });
  return dir;
}

/** Remove one connection from one component of a project copy, and count the removal. */
function dropWire(dir: string, componentPath: string, fromProperty: string, toProperty: string, label: string): void {
  const file = path.join(dir, 'components', componentPath, 'connections.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    connections: Array<{ fromProperty: string; toProperty: string }>;
  };
  const before = doc.connections.length;
  doc.connections = doc.connections.filter((c) => !(c.fromProperty === fromProperty && c.toProperty === toProperty));
  expect(`${label} removed:${before - doc.connections.length}`).toBe(`${label} removed:1`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

/**
 * Write parameters onto exactly one node of a project copy, and count the match.
 *
 * 🔴 The new keys go **first** in the bag. That is not tidiness: `NodeScope.setNodeParameters`
 * drains queued values in the bag's own key order, so a `runOnChange-*` that landed *after* the
 * value it governs would let the load-time run it exists to prevent happen once anyway. The
 * editor's own NDA-017 migration rebuilds the bag for the same reason.
 */
function setParams(
  dir: string,
  componentPath: string,
  nodeLabel: string,
  params: Record<string, unknown>,
  label: string
): void {
  const file = path.join(dir, 'components', componentPath, 'nodes.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    nodes: Array<{ label?: string; parameters?: Record<string, unknown> }>;
  };
  const matched = doc.nodes.filter((n) => n.label === nodeLabel);
  expect(`${label} matched:${matched.length}`).toBe(`${label} matched:1`);
  const existing = matched[0].parameters || {};
  // 🔴 The keys must be ABSENT before the edit, or the arm varied nothing and the whole comparison
  // with the shipped arm is between two identical projects.
  expect(`${label} already set:${Object.keys(params).filter((k) => k in existing).join(',')}`).toBe(
    `${label} already set:`
  );
  matched[0].parameters = { ...params, ...existing };
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

/** One page's worth of seeded content. */
interface Seeded {
  pageId: string;
  /** The three section ids, in creation order. */
  sectionIds: string[];
}

/** What one write-watch arm saw. */
interface Watch {
  /** `updatedAt` for the three rows before the editor was ever opened, and after the window. */
  before: string[];
  after: string[];
  /** Whether any row's `updatedAt` moved — a write that LANDED, as opposed to one attempted. */
  landed: boolean;
  rowWrites: number;
  cyclic: number;
  queryFailed: number;
  total: number;
  /** The first few distinct messages, so a failure names what was raised rather than how much. */
  sample: string[];
  /** The card count at the end of the arm — a list that emptied itself is part of the finding. */
  cardsAtEnd: number;
}

const NO_WATCH: Watch = {
  before: [],
  after: [],
  landed: false,
  rowWrites: -1,
  cyclic: -1,
  queryFailed: -1,
  total: -1,
  sample: ['ARM NEVER RAN'],
  cardsAtEnd: -1
};

describe('SBR-007 AC2 — dragging a section on the REAL page editor, against an enforcing backend', () => {
  let projectDir = '';
  const mutantDirs: string[] = [];
  let dataDir = '';
  let bundle: WorkflowBundle;
  let service: BackendService | undefined;
  let base = '';
  let backendPort = 0;

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });
  let owner: Session;
  /** The page the gesture is driven on, and the page the loop is watched on. Two, so neither disturbs the other. */
  let gesturePage: Seeded;
  let watchPage: Seeded;

  // ── Everything the specs read, captured once in beforeAll ──────────────────
  let securityEnforced = false;
  /** The session the BROWSER ended up holding — "the form did something" is a different claim. */
  let browserSession: string | null = null;
  let boot: Listing = NO_LISTING;
  let afterDrag: Listing = NO_LISTING;
  /** What the STORED rows said at each point, keyed by section id. */
  let storedSeeded: Record<string, number> = {};
  let storedBoot: Record<string, number> = {};
  let storedAfterDrag: Record<string, number> = {};
  let storedAfterMoveUp: Record<string, number> = {};
  /** …and what they said after pressing `Move up` on the card a CLIENT sees at the bottom. */
  let storedAfterBottomMoveUp: Record<string, number> = {};
  /** The kind of the card that genuinely held the last stored position. */
  let movedUpKind = '';
  /** The expectation for the drag arm, computed from what was stored and what was dragged. */
  let expectedAfterDrag: Record<string, number> = {};
  /** Which section the gesture took hold of, and where it was asked to go. */
  let dragged = { kind: '', id: '', fromDomIndex: -1, toDomIndex: -1, dy: 0 };
  /** Where the press landed, hit-tested — a click that hits a ghost reports success and does nothing. */
  let pressHit = '';
  /** Whatever the page showed for a refusal — the template mounts one on `reorder.failure`. */
  let refusalText = '';
  let moveUpFound = { ok: false } as { ok: boolean; why?: string; card?: string; hits?: string };
  let watchShipped: Watch = NO_WATCH;
  let watchNoRefetch: Watch = NO_WATCH;
  let watchPassiveMerge: Watch = NO_WATCH;

  const readOrders = async (s: Seeded): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const id of s.sectionIds) {
      const row = await client.get<Row>(`/classes/Section/${id}`, asUser(owner));
      out[id] = row.json.order as number;
    }
    return out;
  };

  const readUpdatedAt = async (s: Seeded): Promise<string[]> => {
    const out: string[] = [];
    for (const id of s.sectionIds) {
      const row = await client.get<Row>(`/classes/Section/${id}`, asUser(owner));
      out.push(String(row.json.updatedAt));
    }
    return out;
  };

  /** Seed one page and its three sections, in the state a client leaves them after one `Save`. */
  async function seed(title: string, slug: string): Promise<Seeded> {
    const page = await client.post<Row>(
      '/classes/Page',
      { title, slug, published: false, showInNav: true, navOrder: 1 },
      asUser(owner)
    );
    expect(page.status).toBe(201);
    const sectionIds: string[] = [];
    for (const [i, s] of SECTIONS.entries()) {
      const created = await client.post<Row>(
        '/classes/Section',
        { kind: s.kind, order: i, data: { body: s.body }, pageId: page.json.objectId },
        asUser(owner)
      );
      expect(created.status).toBe(201);
      sectionIds.push(created.json.objectId);
    }
    return { pageId: page.json.objectId, sectionIds };
  }

  /** Sign the browser in through the template's own form, and report the session it holds. */
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

  const readListing = async (page: RenderedPage): Promise<Listing> =>
    JSON.parse(String(await page.evaluate(READ_LIST))) as Listing;

  /** Load one page's editor and wait for the sections query to land rather than for a clock. */
  async function openEditor(page: RenderedPage, s: Seeded): Promise<Listing> {
    await page.navigate(`/admin/page/${s.pageId}`);
    let listing = await readListing(page);
    for (let i = 0; i < 24 && listing.cardCount < SECTIONS.length; i++) {
      await wait(500);
      listing = await readListing(page);
    }
    return listing;
  }

  /**
   * Watch one page's editor for writes it was never asked to make.
   *
   * 🔴 **No pointer, no key, no click.** The whole arm is a page that was opened and looked at,
   * which is what makes a write that lands during it a write nobody asked for.
   *
   * Both readings are taken because they answer different questions. `updatedAt` says a write
   * **landed**; the error counts say how many were **attempted**. A loop whose writes are all
   * refused by the rate limiter moves no timestamp at all, and reading only the timestamp would
   * call that quiet.
   */
  async function watchForWrites(page: RenderedPage, s: Seeded, label: string): Promise<Watch> {
    const from = page.consoleErrors.length;
    const before = await readUpdatedAt(s);
    await openEditor(page, s);
    for (let i = 0; i < WATCH_SAMPLES; i++) await wait(WATCH_INTERVAL_MS);
    const cardsAtEnd = (await readListing(page)).cardCount;
    const errors = page.consoleErrors.slice(from);
    // Leave the page, so this arm's loop cannot run on into the next one's window.
    await page.navigate('/admin/pages');
    await wait(2000);
    const after = await readUpdatedAt(s);
    const watch: Watch = {
      before,
      after,
      landed: before.join('|') !== after.join('|'),
      rowWrites: errors.filter((e) => e.includes('SetDbModelProperties') && e.includes('SectionRow')).length,
      cyclic: errors.filter((e) => e.includes('cyclic-loop')).length,
      queryFailed: errors.filter((e) => e.includes('query-failed')).length,
      total: errors.length,
      sample: Array.from(new Set(errors)).slice(0, 3),
      cardsAtEnd
    };
    // eslint-disable-next-line no-console
    console.log(`        WATCH [${label}]:`, JSON.stringify({ ...watch, sample: watch.sample.length }));
    // eslint-disable-next-line no-console
    console.log(`        WATCH [${label}] raised:`, JSON.stringify(watch.sample));
    return watch;
  }

  beforeAll(async () => {
    projectDir = await authorSiteTemplate('ac2pe');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(
      bundle,
      { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
      SITE_SECURITY,
      'ac2pe'
    );
    service = new BackendService({ dataDir, port: 0, backendId: 'ac2pe', backendName: 'AC2 page editor drag' });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;
    securityEnforced = started.security.enforced;

    bindProjectToBackend(projectDir, 'ac2pe', backendPort);

    // The owner becomes `role:admin` through the template's own door, exactly as SB-008 does.
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

    gesturePage = await seed('The Drag Page', 'drag-page');
    watchPage = await seed('The Watched Page', 'watched-page');

    // ── The stored order is deliberately NOT the creation order ──────────────
    //
    // 🔴 Without this the drive would be measuring a coincidence. The editor states no sort, so
    // what it draws is whatever the backend returns — which for freshly created rows may happen to
    // agree with `order`. Moving one section through the endpoint first makes the two orders
    // differ by construction, so finding 1 is a reading rather than a lucky observation, and so
    // the drag has a position it can actually change.
    const moved = await client.post<{ result?: { order?: number } }>(
      '/functions/reorderSection',
      { pageId: gesturePage.pageId, sectionId: gesturePage.sectionIds[1], toIndex: 0 },
      asUser(owner)
    );
    expect(moved.status).toBe(200);
    storedSeeded = await readOrders(gesturePage);

    // ── ARM 1: the shipped project, watched with nothing touching it ─────────
    await withRenderedPage({ projectDir, backendPort }, async (page0) => {
      const page = page0 as RenderedPage;
      browserSession = await signInBrowser(page);
      watchShipped = await watchForWrites(page, watchPage, 'shipped');
    });

    // ── ARM 2: the editor's own refetch wire removed ─────────────────────────
    //
    // `sectionList.itemOutputSignal-Changed → sections.storageFetch` is the obvious candidate for
    // the cycle: a row's write reports `Changed`, the editor refetches, the refetch redelivers
    // `data`, and round it goes. This arm is what says whether that is the loop — and it is the
    // arm that turned out to be the control rather than the cause.
    await wait(RATE_WINDOW_MS);
    const noRefetch = copyProject(projectDir, 'norefetch');
    mutantDirs.push(noRefetch);
    dropWire(noRefetch, 'Pages/PageEditor', 'itemOutputSignal-Changed', 'storageFetch', 'refetch-on-Changed');
    await withRenderedPage({ projectDir: noRefetch, backendPort }, async (page0) => {
      const page = page0 as RenderedPage;
      await signInBrowser(page);
      watchNoRefetch = await watchForWrites(page, watchPage, 'no refetch-on-Changed');
    });

    // ── ARM 3: `merge` made passive, which is what closes it — and the gesture ──
    //
    // 🔴 The three parameters are not invented for this arm. `RUN_ON_CHANGE_FAMILIES` gives
    // `JavaScriptFunction` the control signal `run` and the discovered prefix `in-`, and
    // `merge.run` IS connected (`saveButton.onClick`, `upload.done`) — so the editor's NDA-017
    // migration writes exactly these three the first time the project is opened. They are the
    // repair the product already knows about, applied to the artefact that ships without them.
    await wait(RATE_WINDOW_MS);
    const passiveMerge = copyProject(projectDir, 'passivemerge');
    mutantDirs.push(passiveMerge);
    setParams(
      passiveMerge,
      'Admin/SectionRow',
      'Fold the edits back into data',
      { 'runOnChange-in-data': false, 'runOnChange-in-body': false, 'runOnChange-in-image': false },
      'passive merge'
    );
    await withRenderedPage({ projectDir: passiveMerge, backendPort }, async (page0) => {
      const page = page0 as RenderedPage;
      await signInBrowser(page);
      watchPassiveMerge = await watchForWrites(page, watchPage, 'passive merge');

      // ── The gesture, on the only arm where the screen holds still ──────────
      storedBoot = await readOrders(gesturePage);
      boot = await openEditor(page, gesturePage);
      // eslint-disable-next-line no-console
      console.log('        boot:', JSON.stringify(boot).slice(0, 800));
      // eslint-disable-next-line no-console
      console.log('        stored at boot:', JSON.stringify(storedBoot));

      if (boot.cardCount === SECTIONS.length) {
        // The LAST card, dragged to the TOP.
        //
        // 🔴 The choice is the measurement. Under finding 1 the drawn order and the stored order
        // disagree, and a drag of a card whose DOM position already matches its stored position
        // asks the endpoint for the place it holds — so "the call never fired" and "the call fired
        // and asked for nothing" would be the same reading. The last card is at DOM index 2 and,
        // after the pre-move above, no section is at stored index 2 and DOM index 2 at once.
        const fromIndex = boot.cards.length - 1;
        const source = boot.cards[fromIndex];
        const top = boot.cards[0];
        const press = pressPoint(source);
        const dy = centre(top) - 8 - centre(source);

        // 🔴 Hit-test the press point BEFORE pressing it. A click that lands on a measuring ghost
        // reports success and does nothing, and a drag that reads zero because the press never
        // reached the card is indistinguishable from "the runtime cannot drag".
        pressHit = String(
          await page.evaluate(`(function () {
            var el = document.elementFromPoint(${press.x}, ${press.y});
            if (!el) return 'NOTHING';
            return el.tagName + '.' + String(el.className || '') +
              (el.closest('.react-draggable') ? ' inCard:yes' : ' inCard:no');
          })()`)
        );

        // Which stored row is under that card. `kindOf` reads the card's own `kindText` and the
        // seeded kinds are distinct, so this is an identification rather than a guess.
        const kind = kindOf(source);
        const id = gesturePage.sectionIds[SECTIONS.findIndex((s) => s.kind === kind)];
        dragged = { kind, id, fromDomIndex: fromIndex, toDomIndex: 0, dy: Math.round(dy) };
        expectedAfterDrag = applyReorder(storedBoot, id, 0);

        await dragBy(page, press.x, press.y, dy);
        // The drop is a round trip: `DropAt` → `reorderSection` → `done` → `storageFetch`. Wait for
        // the STORED row to move rather than for a clock, but bounded — if it never moves, the
        // readings below are about a page that did nothing, which is a real outcome.
        for (let i = 0; i < 24; i++) {
          const now = await readOrders(gesturePage);
          if (now[id] !== storedBoot[id]) break;
          await wait(500);
        }
        await wait(1500);
        afterDrag = await readListing(page);
        storedAfterDrag = await readOrders(gesturePage);
        // eslint-disable-next-line no-console
        console.log('        dragged:', JSON.stringify(dragged));
        // eslint-disable-next-line no-console
        console.log('        after drag:', JSON.stringify(afterDrag).slice(0, 800));
        // eslint-disable-next-line no-console
        console.log(
          '        stored after drag:',
          JSON.stringify(storedAfterDrag),
          'expected',
          JSON.stringify(expectedAfterDrag)
        );

        refusalText = String(
          await page.evaluate(
            `(function () { var t = document.body ? document.body.innerText : ''; ` +
              `return t.indexOf('could not be reordered') >= 0 ? 'REFUSAL SHOWN' : 'no refusal'; })()`
          )
        );

        // ── AC2's other road, on the same screen, after the drag ─────────────
        //
        // Two presses, and the pair is a measurement rather than a retry.
        //
        // 🔴 The FIRST is on the card a client sees at the bottom of the list. Under finding 1
        // that card need not be the last section, and here it is the FIRST one — so `Move up`
        // correctly refuses (a row already at the top is the planner's guarded return) and the
        // client's press does nothing at all, on a button they can see and a row that visibly has
        // rows above it.
        //
        // The SECOND is on whichever card holds the last STORED position, and it is the one that
        // says the button road still works after the gesture was built on top of it.
        const findMoveUp = async (whichCard: string): Promise<typeof moveUpFound> =>
          JSON.parse(
            String(
              await page.evaluate(`(function () {
                var cards = Array.prototype.slice.call(document.querySelectorAll('.react-draggable'));
                var card = ${whichCard};
                if (!card) return JSON.stringify({ ok: false, why: 'no card' });
                var btn = Array.prototype.filter.call(card.querySelectorAll('button'), function (b) {
                  return (b.innerText || '').trim() === 'Move up';
                })[0];
                if (!btn) return JSON.stringify({ ok: false, why: 'no Move up in the card' });
                var r = btn.getBoundingClientRect();
                var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
                var at = document.elementFromPoint(x, y);
                return JSON.stringify({
                  ok: true, x: x, y: y, card: String(card.innerText || '').split('\\n')[0],
                  hits: at ? at.tagName + '.' + String(at.className || '') : 'NOTHING'
                });
              })()`)
            )
          ) as typeof moveUpFound;

        moveUpFound = await findMoveUp('cards[cards.length - 1]');
        // eslint-disable-next-line no-console
        console.log('        Move up on the card a client sees LAST:', JSON.stringify(moveUpFound));
        if (moveUpFound.ok) {
          await clickAt(page, (moveUpFound as { x: number }).x, (moveUpFound as { y: number }).y);
          await wait(3000);
        }
        storedAfterBottomMoveUp = await readOrders(gesturePage);
        // eslint-disable-next-line no-console
        console.log('        stored after that press:', JSON.stringify(storedAfterBottomMoveUp));

        // The card holding the LAST stored position, found by the kind it names.
        const lastStoredId = Object.keys(storedAfterBottomMoveUp).reduce((a, b) =>
          storedAfterBottomMoveUp[a] > storedAfterBottomMoveUp[b] ? a : b
        );
        const lastStoredKind = SECTIONS[gesturePage.sectionIds.indexOf(lastStoredId)].kind;
        movedUpKind = lastStoredKind;
        const found = await findMoveUp(
          `cards.filter(function (c) { return (c.innerText || '').indexOf(${JSON.stringify(lastStoredKind)}) === 0; })[0]`
        );
        // eslint-disable-next-line no-console
        console.log(`        Move up on the LAST STORED card (${lastStoredKind}):`, JSON.stringify(found));
        if (found.ok) {
          await clickAt(page, (found as { x: number }).x, (found as { y: number }).y);
          await wait(3000);
        }
        storedAfterMoveUp = await readOrders(gesturePage);
        // eslint-disable-next-line no-console
        console.log('        stored after Move up:', JSON.stringify(storedAfterMoveUp));
      }
    });
  });

  afterAll(async () => {
    await service?.stop();
    for (const dir of [dataDir, projectDir, ...mutantDirs]) if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Controls — each can go red on its own, and each names a different reason
  // the readings below would mean nothing.
  // ==========================================================================

  it('CONTROL — the backend enforced row-level ACL while all of this was measured', () => {
    // Without it the publication boundary is off, which is the one configuration in which this
    // template looks correct and serves every draft to anybody.
    expect(securityEnforced).toBe(true);
  });

  it('CONTROL — the browser signed in through the template’s own form and holds a session', () => {
    // "The form did something" and "there is a session" are two claims. This is the second.
    expect(browserSession).toEqual(expect.any(String));
    expect(String(browserSession).length).toBeGreaterThan(8);
  });

  it('CONTROL — the endpoint moved a section before any browser opened, so the two orders differ by construction', () => {
    // hero, richText, gallery were created 0,1,2 and richText was moved to 0 over HTTP.
    expect(gesturePage.sectionIds.map((id) => storedSeeded[id])).toEqual([1, 0, 2]);
  });

  it('CONTROL — the real page editor rendered three section cards', () => {
    expect(`cards:${boot.cardCount} body:${boot.bodyText.slice(0, 120)}`).toBe(
      `cards:${SECTIONS.length} body:${boot.bodyText.slice(0, 120)}`
    );
  });

  it('CONTROL — the rows’ container holds the rows and NOTHING else', () => {
    // 🔴 `sectionRows` exists for exactly this. With the repeater still under `sectionsPanel` the
    // rows would be DOM siblings of `sectionsHeader` and `reorderRefusal`, every drop would report
    // an index two too high, and the wires, the census and the render would all still be correct.
    expect(`strays:${JSON.stringify(boot.strays)} children:${boot.containerChildren}`).toBe(
      `strays:[] children:${SECTIONS.length}`
    );
  });

  it('CONTROL — the press landed inside a card, not on a ghost or an overlay', () => {
    expect(pressHit).toContain('inCard:yes');
  });

  it('CONTROL — every card was actually drawn', () => {
    const heights = boot.cards.map((c) => c.height);
    // eslint-disable-next-line no-console
    console.log('        card heights:', JSON.stringify(heights));
    // Not an assertion about uniformity: the body sits in a fixed-height textarea, so equal
    // heights are a fact about the template rather than a failure. What must hold is that a card
    // has a box at all — a zero-height card makes every centre comparison meaningless.
    expect(heights.every((h) => h > 0)).toBe(true);
  });

  // ==========================================================================
  // AC2's gesture, on the real page editor
  // ==========================================================================

  it('a real pointer drag on the REAL page editor reaches the endpoint and renumbers the STORED rows', () => {
    // The oracle is the stored row, read as the owner, over the ids this file created — and the
    // expectation is computed from what was stored and what was dragged rather than typed.
    // ⚠️ Driven on the arm where `merge` is passive; the shipped artefact cannot hold still long
    // enough to be dragged at all. See finding 2.
    expect(gesturePage.sectionIds.map((id) => storedAfterDrag[id])).toEqual(
      gesturePage.sectionIds.map((id) => expectedAfterDrag[id])
    );
  });

  it('and it did not raise the panel’s own refusal', () => {
    expect(refusalText).toBe('no refusal');
  });

  it('every card snapped back — no card is left translated where the pointer dropped it', () => {
    // 🔴 `Drag` keeps the transform and nothing in the runtime removes it. `out-snap` fires on
    // EVERY release, including the ones that ask for nothing, and this is the reading that says
    // the wire is real on the shipped template rather than only in the probe page.
    const identity = (t: string) => t === 'none' || /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(t);
    expect(afterDrag.cards.map((c) => c.transform).filter((t) => !identity(t))).toEqual([]);
  });

  it('a button inside the draggable card is still reachable after the drag', () => {
    // 🔴 The reading that licensed the build at all, taken here on the template's own card rather
    // than on a probe: `/Admin/SectionRow` is nothing but controls, `Drag` has no `handle` or
    // `cancel` port, and a row that is draggable OR usable is not a feature.
    expect(`${moveUpFound.ok} hits:${moveUpFound.hits}`).toContain('true hits:BUTTON');
  });

  it('`Move up` still renumbers after the drag — the buttons were not paid for the gesture', () => {
    // The press is on the card holding the LAST STORED position, so it is a move the endpoint can
    // make. Which section that is depends on the readings above, so the assertion is the shape:
    // the orders are still a contiguous permutation, and they moved.
    const before = gesturePage.sectionIds.map((id) => storedAfterBottomMoveUp[id]);
    const after = gesturePage.sectionIds.map((id) => storedAfterMoveUp[id]);
    // eslint-disable-next-line no-console
    console.log('        Move up moved:', movedUpKind, JSON.stringify(before), '->', JSON.stringify(after));
    expect([...after].sort()).toEqual([0, 1, 2]);
    expect(after).not.toEqual(before);
  });

  it('FINDING — but `Move up` on the card a client sees at the BOTTOM does nothing at all', () => {
    // 🔴 Finding 1 in the form a person meets it. The bottom card holds stored position 0, so the
    // planner's guarded return is correct and the press is legitimately refused — on a row that
    // visibly has two rows above it, with no message and no change. The button is real, reachable
    // and hit-tested; it is the LIST that is wrong.
    expect(`hits:${moveUpFound.hits} changed:${JSON.stringify(storedAfterBottomMoveUp) !== JSON.stringify(storedAfterDrag)}`).toBe(
      'hits:BUTTON.ndl-controls-button changed:false'
    );
  });

  // ==========================================================================
  // 🔴 FINDING 1 — the editor does not draw its sections in `order`
  // ==========================================================================

  /**
   * `/Pages/Site` sorts its sections (`SECTION_SORT` → `visualSort: [{ property: 'order' }]`).
   * `/Pages/PageEditor`'s `sections` query states no `visualSort` at all, so the panel renders
   * whatever the backend returns.
   *
   * 🔴 **It is the gesture's own foundation.** `dropIndex` counts DOM siblings and
   * `reorderSection` renumbers the list sorted by `order`. Those are the same list only while the
   * editor draws in `order`. Under this mismatch the index a drop produces is an index into a list
   * nobody else uses, so the section does not land where it was dropped — and on a list that
   * happens to come back reversed, dragging the top card to the bottom asks for the position it
   * already holds and reads as a drag that does nothing.
   *
   * ⚠️ It predates the drag. `Move up` and `Move down` have always renumbered a list the client was
   * never shown, and the ten stored-row cases in `sb004-publication-invariant.test.ts` grade the
   * endpoint — which is correct — rather than the screen.
   */
  it('FINDING — the shipped page editor states no sort on its section query, while the public site does', () => {
    /**
     * The artefact, not a paraphrase of it — and the two queries are found by the same label
     * because they genuinely carry the same one: *"This page's sections"*, once in `/Pages/Site`
     * and once in `/Pages/PageEditor`. That the pair shares a name and not a sort is the finding
     * in its shortest form.
     */
    const nodes: Array<{ label?: string; parameters?: Record<string, unknown> }> = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        if (typeof rec.label === 'string' && rec.parameters) {
          nodes.push(rec as { label: string; parameters: Record<string, unknown> });
        }
        Object.values(rec).forEach(walk);
      }
    };
    walk(SITE_TEMPLATE);
    const queries = nodes.filter((n) => n.label === "This page's sections");
    // The page editor's is the one whose filter value is a route parameter — `runOnChange-qp-pageId`
    // is unique to it across the four, which is what makes this an identification and not a guess.
    const editor = queries.filter((q) => q.parameters && 'runOnChange-qp-pageId' in q.parameters);
    const sorted = queries.filter((q) => q.parameters?.visualSort !== undefined);
    // eslint-disable-next-line no-console
    console.log(
      '        section queries in the template:',
      JSON.stringify(queries.map((q) => Object.keys(q.parameters ?? {})))
    );
    // Pinned rather than fixed here: the fix is a `visualSort` on one query and it belongs on a
    // register with an owner. Whoever fixes it should make this `editorSorted:true` — not delete it.
    expect(
      `queries:${queries.length} editor:${editor.length} anySorted:${sorted.length > 0} ` +
        `editorSorted:${editor[0]?.parameters?.visualSort !== undefined}`
    ).toBe('queries:4 editor:1 anySorted:true editorSorted:false');
  });

  it('FINDING — and on the screen, the drawn order is not the stored order', () => {
    const drawn = boot.cards.map(kindOf);
    const stored = gesturePage.sectionIds
      .map((id, i) => ({ kind: SECTIONS[i].kind, order: storedBoot[id] }))
      .sort((a, b) => a.order - b.order)
      .map((s) => s.kind);
    // eslint-disable-next-line no-console
    console.log('        drawn:', JSON.stringify(drawn), 'stored order:', JSON.stringify(stored));
    expect(drawn).not.toEqual(stored);
  });

  it('FINDING — so the section did not land where the client dropped it', () => {
    // The client dragged the last card to the top of the list they could see. What the stored rows
    // record is that card put at index 0 of a list in a DIFFERENT order, so the section it now sits
    // above is not the one it was dropped above.
    const storedAfter = Object.keys(storedAfterDrag).sort((a, b) => storedAfterDrag[a] - storedAfterDrag[b]);
    const drawnAfter = afterDrag.cards.map(kindOf);
    const storedKinds = storedAfter.map((id) => SECTIONS[gesturePage.sectionIds.indexOf(id)].kind);
    // eslint-disable-next-line no-console
    console.log('        after the drop — drawn:', JSON.stringify(drawnAfter), 'stored:', JSON.stringify(storedKinds));
    expect(drawnAfter).not.toEqual(storedKinds);
  });

  // ==========================================================================
  // 🔴 FINDING 2 — opening the shipped page editor writes, forever, unprompted
  // ==========================================================================

  /**
   * `/Admin/SectionRow`'s `merge` re-runs whenever a value lands on it — `runOnChange` reads absent
   * as **ticked** — and `merge.out-built → save.store` writes the section back. `SetDbModelProperties`
   * writes into the very model `For Each` feeds the row's `data` from, and `merge` builds a fresh
   * object every run, so the value always counts as changed and the node runs again.
   *
   * 🔴 **The three parameters that stop it are ones the product already knows about.** Eleven other
   * `JavaScriptFunction` nodes in this same template state `runOnChange-…: false`, three of them in
   * this very screen, and the editor's NDA-017 migration writes exactly these three onto any node
   * whose `run` is connected — which `merge`'s is. The artefact ships without them.
   *
   * 🔴 **Nothing in the suite could see it.** Every wire is individually right, the census counts
   * are right, the page renders, and the endpoint's own suite never opens a screen. It needs a
   * browser, a real backend, and a page that HAS sections — which is why it survived s22's drive of
   * this very screen: that page had none.
   */
  it('FINDING — a shipped page editor nobody is touching attempts writes on its own', () => {
    // No pointer, no key, no click — the arm is a page that was opened and looked at.
    expect(watchShipped.rowWrites).toBeGreaterThan(0);
  });

  it('FINDING — the runtime names it: a cyclic loop, in the row', () => {
    // Not this file's inference. `runtime/cyclic-loop` is the viewer's own diagnostic, raised
    // against `/Admin/SectionRow`.
    expect(watchShipped.cyclic).toBeGreaterThan(0);
  });

  it('FINDING — it does not stop: the backend’s rate limiter is what ends it', () => {
    // The limiter is 1200 data requests a minute. Reaching it from a page nobody is touching is
    // what makes this a loop rather than a redundant write on load.
    expect(watchShipped.rowWrites).toBeGreaterThan(50);
  });

  it('FINDING — and the page’s own section query starts being refused with it', () => {
    /**
     * The consequence, which is the half a person reports: the limiter does not distinguish the
     * loop's writes from the screen's reads, so the `DbCollection2` that draws the sections starts
     * failing on a page whose rows are all still in the database.
     *
     * ⚠️ **Asserted on the refusal, not on the empty list.** Whether the list is empty at the
     * moment this arm looks depends on which side of a failed fetch the window closes — it was
     * empty on two of the four runs of this file and populated on the others. The refusal itself
     * was present every time, and it is the thing that is true rather than the thing that was
     * true twice. The mutant arm below reads `queryFailed:0`, so this is not a constant.
     */
    // eslint-disable-next-line no-console
    console.log('        cards left on screen at the end of the shipped arm:', watchShipped.cardsAtEnd);
    expect(`queryFailed:${watchShipped.queryFailed > 0} mutantQueryFailed:${watchPassiveMerge.queryFailed}`).toBe(
      'queryFailed:true mutantQueryFailed:0'
    );
  });

  it('CONTROL — removing the editor’s refetch wire does NOT stop it: the cycle is inside the row', () => {
    // 🔴 The obvious suspect, excluded. `save.done → Changed → storageFetch` is a real edge and it
    // is not the one that closes the loop — which matters, because a fix aimed at the editor would
    // have been measured green by every gate and changed nothing.
    expect(watchNoRefetch.rowWrites).toBeGreaterThan(50);
  });

  it('CONTROL — making `merge` passive DOES stop it, on the same page and the same backend', () => {
    // 🔴 The arm that names the cause. Same template, same backend, same browser, same window,
    // same page — three parameters different, and the edit was counted.
    expect(`rowWrites:${watchPassiveMerge.rowWrites} cyclic:${watchPassiveMerge.cyclic}`).toBe(
      'rowWrites:0 cyclic:0'
    );
  });

  it('CONTROL — and that quiet arm still rendered the three rows, so it is quiet rather than broken', () => {
    // A mutant that rendered nothing would be quiet for the wrong reason.
    expect(watchPassiveMerge.cardsAtEnd).toBe(SECTIONS.length);
  });
});
