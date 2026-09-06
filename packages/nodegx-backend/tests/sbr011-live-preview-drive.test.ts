/**
 * SBR-011 — **the open site follows the owner's changes**, driven end to end.
 *
 * The person sentence: *"with the site open in one tab and the admin panel in
 * another, publishing a change updates the open site without a reload."* This
 * file is that sentence, on the shipped template against an enforcing backend:
 * one anonymous browser sits on a published page and **never navigates again**,
 * while the owner writes over HTTP from outside it.
 *
 * ## 🔴 "Without a reload" is the claim, so it is the thing that is proven
 *
 * Every arm below reads the page **in place** — `readHere`, not `readVisit` —
 * and that alone would not settle it: a page that reloaded itself also shows the
 * new value, and from the reader's side the two are identical. So the browser is
 * stamped once, before any change (`window.__sbr011`, a value the app cannot
 * produce), and **every** arm re-reads that stamp beside its finding. A reload
 * destroys it. The stamp is what makes "the nav gained the link" mean "the open
 * document gained the link" rather than "a fresh document has one".
 *
 * ## The negative, and why it is worth more than the positives
 *
 * AC4 asks for silence: an anonymous subscriber must not receive
 * draft/unpublished payloads. An absence is the cheapest thing in the world to
 * measure wrongly — a dead subscription, a wrong slug, a page that never
 * connected, all read as "no draft leaked". So the draft arm and its
 * known-firing twin are **the same record, on the same open page, over the same
 * connection**: the draft is created (silence, asserted over a generous window),
 * and then that record's ACL is opened (the link appears). One edit apart. The
 * silence means something only because the noise that follows it came down the
 * same wire.
 *
 * ## Three oracles, because they fail differently
 *
 *  1. **The hub, directly** — an anonymous `openStream` + subscription, checked
 *     before the browser runs at all. If this is silent the finding is about the
 *     backend and nothing downstream is worth reading.
 *  2. **The browser** — what a person sees, which is the person sentence.
 *  3. **The fetch counter** — §4's second trap. `window.fetch` is wrapped on the
 *     open page, so "the query re-ran" is a COUNT and not an impression. Two
 *     producers meet on these nodes (the cloud-store subscription for our own
 *     writes, the SSE hub for everyone else's) and a doubled fetch per event is
 *     invisible in the rendering — the screen is simply correct twice.
 *
 * ## The mutant
 *
 * 🔴 Per this phase's rule the mutant **restores the defect** rather than
 * repairing anything: the same project with `realtime` stripped from the three
 * queries — counted, `removed:3` — which is the state the template shipped in
 * for the ten sessions before this task. The same owner write against the same
 * open page then changes nothing. Without it, "the nav gained the link" and
 * "because this task wired a subscription" are one reading, and the second does
 * not follow from the first: `readHere` polls, and a page that re-fetched for
 * any other reason would look the same.
 *
 * ⚠️ **What this instrument cannot see.** It runs one browser against one
 * backend over a loopback proxy. It says nothing about a slow or lossy network,
 * about the hub's reconnect/`resync` path, or about many simultaneous visitors.
 * ⚠️ It used to add *"and `SseTransport` opens one connection per subscription,
 * so the last of those is a real cost this file does not price"* — the cost was
 * then priced, on this drive's own Resource Timing, and it was D46: at six open
 * streams the browser stops sending anything else to that origin. It is fixed
 * (`SseConnectionPool`), and the arm that counts streams below is the reading.
 *
 * @see sbr011LivePreview.test.ts — the structural half, over the same artefact.
 * @see sbr011-hub-unreachable-drive.test.ts — AC5, which needs a refusing hub.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { openStream } from './helpers/sse';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  PUBLIC_ACL,
  RenderedPage,
  SITE_SECURITY,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'sbr011-live-token-4d17ba';
const OWNER_EMAIL = 'owner@sbr011live.test';
const OWNER_PASSWORD = 'drive-pass-live';

/** The page the visitor is sitting on, and never leaves. */
const HOME_TITLE = 'The workshop';
const HOME_SLUG = 'workshop';

/**
 * The strings the arms look for.
 *
 * Deliberately unlike each other and unlike anything the template says on its
 * own, so a reading is never satisfied by the chrome. `BODY_BEFORE` has to be on
 * the page first for `BODY_AFTER` replacing it to be a change rather than an
 * arrival.
 */
/** What the section is seeded with, so the warm-up has something to change. */
const SEEDED_BODY = 'Hours to be confirmed.';
const BODY_BEFORE = 'Open Tuesday to Saturday, ten until four.';
const BODY_AFTER = 'Now open seven days a week, nine until six.';
const NEW_PAGE_TITLE = 'Visit us';
const DRAFT_PAGE_TITLE = 'Unannounced course';
/** The throwaway page that proves the subscription is live before anything is measured. */
const WARMUP_TITLE = 'Warm up';
const THEME_PRIMARY = '#b5127c';
/** The colour the warm-up paints, so AC3's colour is a CHANGE and not an arrival. */
const WARMUP_PRIMARY = '#1d7a4f';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

/** One reading of the open document: what it says, how it is painted, and the stamp. */
interface Live {
  /** `document.body.innerText`. */
  text: string;
  /** The nav band's link text, in DOM order. */
  nav: string[];
  /** `--primary` as `applyTheme` set it on the root element. Empty until a Theme row exists. */
  primary: string;
  /** 🔴 The stamp. `''` means the document was replaced — i.e. a reload. */
  stamp: string;
  /** How many `/classes/<X>` reads this document has made since the counter went on. */
  fetches: Record<string, number>;
}
const NO_LIVE: Live = { text: 'ARM NEVER RAN', nav: [], primary: '', stamp: '', fetches: {} };

/**
 * Stamp the document and start counting queries.
 *
 * 🔴 `fetch` is wrapped rather than the backend's log being read, because the
 * question is *"how many times did THIS document ask"* — a server-side count
 * cannot tell the open page's request from the harness's own, and this file
 * makes plenty of its own (see the URL-filtered-capture trap: the `200` was my
 * own probe).
 */
const STAMP_AND_COUNT = (stamp: string) => `(function () {
  window.__sbr011 = ${JSON.stringify(stamp)};
  if (!window.__sbr011fetches) {
    window.__sbr011fetches = {};
    var count = function (url) {
      try {
        var text = String(url || '');
        var at = text.indexOf('/classes/');
        if (at === -1) return;
        var rest = text.slice(at + 9);
        var name = rest.split('/')[0].split('?')[0];
        if (name) window.__sbr011fetches[name] = (window.__sbr011fetches[name] || 0) + 1;
      } catch (e) { /* counting must never break the page */ }
    };
    var realFetch = window.fetch;
    window.fetch = function (input) {
      count((input && input.url) || input);
      return realFetch.apply(this, arguments);
    };
    // XHR as well as fetch, and this is a CORRECTION rather than thoroughness.
    // The first run of this drive counted fetch only and read {} -- ZERO queries
    // -- on a page that had visibly rendered its records. The store speaks the
    // Parse wire and that client uses XMLHttpRequest, so the counter was measuring
    // a transport this app does not use, and its zero was a fact about the
    // instrument. A control that can only read zero is worth reading first.
    var realOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      count(url);
      return realOpen.apply(this, arguments);
    };
  }
  return 'stamped';
})()`;

const READ_LIVE = `(function () {
  return JSON.stringify({
    text: document.body ? document.body.innerText : '',
    nav: Array.prototype.map.call(document.querySelectorAll('nav *'), function (n) {
      return n.innerText;
    }).filter(function (t) { return t && t.trim(); }),
    primary: document.documentElement.style.getPropertyValue('--primary').trim(),
    stamp: window.__sbr011 || '',
    fetches: window.__sbr011fetches || {}
  });
})()`;

describe('SBR-011 — the open site follows the owner, without a reload', () => {
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

  let homePageId = '';
  let sectionId = '';

  /** Oracle 1 — the hub, before any browser exists. */
  let hubDelivered: string[] = ['ARM NEVER RAN'];

  /** Oracle 1b — SSE streams the hub holds while the page sits open. */
  let openStreams = -1;
  /** Whatever the open page logged as an error while it was booting. */
  let pageErrors: string[] = [];
  /** Whether the open page proved itself live before the acts began. */
  let warmedUp = false;
  /** Which of the three subscriptions proved itself live, by name. */
  let liveCollections: Record<string, boolean> = {};
  /** D45 — the browser's own Resource Timing for every `/realtime` request. */
  let subscribeTimings = '';
  let themeId = '';

  /** The open page, read once per act. */
  let atRest: Live = NO_LIVE;
  let afterPublish: Live = NO_LIVE;
  let afterSectionEdit: Live = NO_LIVE;
  let afterThemeSave: Live = NO_LIVE;
  let afterDraft: Live = NO_LIVE;
  let afterDraftPublished: Live = NO_LIVE;

  /** The mutant arm: the same act on a project with the three subscriptions gone. */
  let mutantAtRest: Live = NO_LIVE;
  let mutantAfterPublish: Live = NO_LIVE;
  let mutantRemoved = -1;

  const readLive = async (page: RenderedPage): Promise<Live> =>
    JSON.parse(String(await page.evaluate(READ_LIVE))) as Live;

  /**
   * Read the open page until `want` is true of it, or the deadline passes.
   *
   * ⚠️ A **bounded** wait for an asynchronous update, not a retry until the
   * wanted answer appears: on timeout it returns the real document and the
   * caller's assertion fails against what was actually on the screen. The
   * alternative is a fixed sleep, which is the same wait with a worse failure
   * mode and a worse message.
   */
  async function until(page: RenderedPage, want: (l: Live) => boolean, ms = 30000): Promise<Live> {
    const deadline = Date.now() + ms;
    let live = await readLive(page);
    while (!want(live) && Date.now() < deadline) {
      await wait(400);
      live = await readLive(page);
    }
    return live;
  }

  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sbr011live');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, SITE_SECURITY, 'sbr011live');
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'sbr011live',
      backendName: 'SBR-011 live preview drive'
    });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;
    securityEnforced = started.security.enforced;

    bindProjectToBackend(projectDir, 'sbr011live', backendPort);

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

    // ── The precondition: one published page with one section on it ─────────
    const home = await client.post<Row>(
      '/classes/Page',
      { ACL: PUBLIC_ACL, title: HOME_TITLE, slug: HOME_SLUG, published: true, showInNav: true, navOrder: 1 },
      asUser(owner)
    );
    expect(home.status).toBe(201);
    homePageId = home.json.objectId;

    const section = await client.post<Row>(
      '/classes/Section',
      { ACL: PUBLIC_ACL, kind: 'richText', order: 0, data: { heading: 'Hours', body: SEEDED_BODY }, pageId: homePageId },
      asUser(owner)
    );
    expect(`section ${section.status}: ${section.text.slice(0, 300)}`).toBe(`section 201: ${section.text.slice(0, 300)}`);
    sectionId = section.json.objectId;

    // ── ORACLE 1: does the hub itself deliver to an anonymous subscriber? ────
    //
    // Before any browser. If this arm is silent every reading below is about the
    // backend rather than about the template, and the drive should say so rather
    // than presenting a wiring finding.
    {
      const stream = await openStream(base);
      const hello = await stream.waitFor('connected');
      const subscribed = await client.post<{ accepted: unknown[]; rejected: unknown[] }>(
        '/realtime/subscriptions',
        { clientId: hello.data.clientId, subscriptions: [{ collection: 'Page' }] }
      );
      // 🔴 The body, not the status. This hub answers 200 to a subscription it
      // has REFUSED (`SseTransport.ts`, point 1), so `res.ok` would report a
      // live subscription that never delivers.
      expect(`accepted:${subscribed.json.accepted?.length} rejected:${subscribed.json.rejected?.length}`).toBe(
        'accepted:1 rejected:0'
      );

      const probe = await client.post<Row>(
        '/classes/Page',
        { ACL: PUBLIC_ACL, title: 'Hub probe', slug: 'hub-probe', published: true, showInNav: false, navOrder: 90 },
        asUser(owner)
      );
      expect(probe.status).toBe(201);
      await stream
        .waitFor('change', (d) => (d.record as { title?: string })?.title === 'Hub probe', 10000)
        .catch(() => undefined);
      hubDelivered = stream.changes().map((f) => String((f.data.record as { title?: string })?.title ?? '?'));
      stream.close();
      await client.del(`/classes/Page/${probe.json.objectId}`, asUser(owner));
    }

    // ── The mutant project: the shipped one with the three subscriptions gone ─
    mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbr011live-mutant-'));
    fs.cpSync(projectDir, mutantDir, { recursive: true });
    mutantRemoved = 0;
    const strip = (file: string) => {
      if (!fs.existsSync(file)) return;
      const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        nodes?: Array<{ type: string; parameters?: Record<string, unknown> }>;
      };
      const walk = (nodes: Array<{ type: string; parameters?: Record<string, unknown>; children?: unknown }>) => {
        for (const node of nodes) {
          if (node.type === 'DbCollection2' && node.parameters?.realtime === true) {
            delete node.parameters.realtime;
            mutantRemoved++;
          }
          const kids = (node as { children?: unknown }).children;
          if (Array.isArray(kids)) walk(kids as typeof nodes);
        }
      };
      walk(doc.nodes ?? []);
      fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    };
    strip(path.join(mutantDir, 'components', 'Site/Nav', 'nodes.json'));
    strip(path.join(mutantDir, 'components', 'Pages/Site', 'nodes.json'));
    bindProjectToBackend(mutantDir, 'sbr011live', backendPort);

    // ── The open page. One session, one navigation, five acts ───────────────
    await withRenderedPage({ projectDir, backendPort }, async (p) => {
      const page = p as RenderedPage;
      await page.setViewport({ width: 1440, height: 1800 });
      await page.navigate(`/${HOME_SLUG}`);
      // The site's chain is four sequential round trips before the subscriptions
      // are even opened; this is the settle, and the last navigation this
      // browser performs.
      await wait(6000);
      const settled = await until(page, (l) => l.text.includes(SEEDED_BODY));
      expect(settled.text).toContain(SEEDED_BODY);

      /**
       * 🔴 ORACLE 1b — how many streams this page actually holds, read off the
       * HUB rather than off the browser.
       *
       * The decisive reading, and the one the first run of this drive did not
       * take. "The nav did not update" has two completely different causes with
       * opposite fixes — the page never subscribed, or it subscribed and was not
       * delivered to — and from the browser's side those are the same picture.
       * The hub is in this process, so the count is direct.
       */
      /**
       * 🔴 ARM THE INSTRUMENT BEFORE MEASURING WITH IT.
       *
       * A subscription is not live when the page has rendered. Measured here:
       * the first attempt is **not confirmed within 15000ms**, the transport
       * retries, and the retry works — so a page is live roughly half a minute
       * after it loads, not immediately (D45). A drive that starts its acts on
       * the settle therefore measures the dead window and reads every
       * acceptance criterion as failing, which is exactly what the run before
       * this one did.
       *
       * So liveness is **established, not assumed**: one throwaway published
       * page, waited for until it appears in the open nav. Everything after this
       * line is measured on a page that has demonstrably received a change.
       * ⚠️ It is also why `atRest` is read AFTER the warm-up — the "before"
       * reading has to come from the same live page as the "after", or the pair
       * is comparing two different machines.
       */
      const warm = await client.post<Row>(
        '/classes/Page',
        { ACL: PUBLIC_ACL, title: WARMUP_TITLE, slug: 'warm-up', published: true, showInNav: true, navOrder: 9 },
        asUser(owner)
      );
      expect(warm.status).toBe(201);
      /**
       * 🔴 **The theme is a SINGLETON the applier reads at `rows[0]`, so this
       * has to UPDATE it and must not create a second row.**
       *
       * `claimSite` seeds a `Theme` row whose twelve tokens are deliberately
       * empty (`sb004Components.ts`, `seedTheme`), and
       * `buildThemeApplierScript` takes `rows[0]` and skips every token that is
       * falsy. An earlier version of this warm-up POSTed a *second* row
       * carrying `colorPrimary`: the subscription delivered, the query re-ran,
       * `rows[0]` stayed the empty seeded row, and `--primary` was never set.
       * That reads as `Theme: false` — **indistinguishable from a dead
       * subscription**, with the opposite fix — and it is what AC3 failed on
       * while `Page` and `Section` passed beside it.
       *
       * ⚠️ The cardinality assertion is the guard, not decoration: if the
       * template ever seeds a second `Theme` row this arm must go red rather
       * than quietly measure the wrong one again.
       */
      const themeRows = await client.get<{ results: Row[] }>('/classes/Theme', asUser(owner));
      expect(themeRows.status).toBe(200);
      expect(themeRows.json.results).toHaveLength(1);
      themeId = themeRows.json.results[0].objectId;
      const warmTheme = await client.put<Row>(
        `/classes/Theme/${themeId}`,
        { tokens: { colorPrimary: WARMUP_PRIMARY } },
        asUser(owner)
      );
      expect(warmTheme.status).toBe(200);
      const warmSection = await client.put<Row>(
        `/classes/Section/${sectionId}`,
        { data: { heading: 'Hours', body: BODY_BEFORE } },
        asUser(owner)
      );
      expect(warmSection.status).toBe(200);

      /**
       * 🔴 **One warm-up per SUBSCRIPTION, not one per page.** The run before
       * this warmed up on `Page` alone and read AC3 as failing — and AC3 is about
       * `Theme`, a different node holding a different stream. "The page is live"
       * was never the claim that could be made from one collection; each
       * subscription connects on its own and can fail on its own.
       */
      const warmed = await until(
        page,
        (l) =>
          l.nav.some((n) => n.includes(WARMUP_TITLE)) &&
          l.primary.toLowerCase() === WARMUP_PRIMARY &&
          l.text.includes(BODY_BEFORE),
        120000
      );
      warmedUp =
        warmed.nav.some((n) => n.includes(WARMUP_TITLE)) &&
        warmed.primary.toLowerCase() === WARMUP_PRIMARY &&
        warmed.text.includes(BODY_BEFORE);
      liveCollections = {
        Page: warmed.nav.some((n) => n.includes(WARMUP_TITLE)),
        Theme: warmed.primary.toLowerCase() === WARMUP_PRIMARY,
        Section: warmed.text.includes(BODY_BEFORE)
      };

      openStreams = (service as unknown as { realtime: { connectionCount: number } }).realtime.connectionCount;
      pageErrors = page.consoleErrors.slice(0, 8);

      /**
       * D45 — WHERE the 15 seconds go, read from the browser's own clock.
       *
       * The register's discriminating test cleared the proxy: timed in one run
       * against a direct client, the hello frame through `/__backend` is 8ms to
       * direct's 9ms (`d45-realtime-proxy-timing.test.ts` §1). So the delay is on
       * this side of the wire, and "the POST is slow" and "the POST never left"
       * are two different defects that the console message cannot tell apart.
       *
       * Resource Timing can. `fetchStart → requestStart` is the time the request
       * spent QUEUED in the browser before a byte went out — which is what a
       * per-origin connection limit looks like, and this page holds one
       * never-ending SSE stream per subscription against a single HTTP/1.1
       * origin. `requestStart → responseEnd` is the server actually taking that
       * long. The two have opposite fixes.
       */
      subscribeTimings = (await page.evaluate(`(function () {
        return JSON.stringify(
          performance
            .getEntriesByType('resource')
            .filter(function (e) { return e.name.indexOf('/realtime') !== -1; })
            .map(function (e) {
              return {
                url: e.name.replace(/^https?:\\/\\/[^/]+/, ''),
                startMs: Math.round(e.startTime),
                queuedMs: Math.round(e.requestStart - e.fetchStart),
                waitMs: Math.round(e.responseStart - e.requestStart),
                durationMs: Math.round(e.duration)
              };
            })
        );
      })()`)) as string;

      // The stamp goes on AFTER the warm-up, so "it never reloaded" is a claim
      // about the window the acts happen in.
      await page.evaluate(STAMP_AND_COUNT('open-and-never-reloaded'));
      atRest = await readLive(page);

      // ── AC1 — the owner publishes a page; the nav grows a link ────────────
      const second = await client.post<Row>(
        '/classes/Page',
        { ACL: PUBLIC_ACL, title: NEW_PAGE_TITLE, slug: 'visit', published: true, showInNav: true, navOrder: 2 },
        asUser(owner)
      );
      expect(second.status).toBe(201);
      afterPublish = await until(page, (l) => l.nav.some((n) => n.includes(NEW_PAGE_TITLE)));

      // ── AC2 — a section edit on the page being looked at ──────────────────
      const edited = await client.put<Row>(
        `/classes/Section/${sectionId}`,
        { data: { heading: 'Hours', body: BODY_AFTER } },
        asUser(owner)
      );
      expect(edited.status).toBe(200);
      afterSectionEdit = await until(page, (l) => l.text.includes(BODY_AFTER));

      // ── AC3 — a theme save repaints the open site ─────────────────────────
      const theme = await client.put<Row>(
        `/classes/Theme/${themeId}`,
        { tokens: { colorPrimary: THEME_PRIMARY } },
        asUser(owner)
      );
      expect(theme.status).toBe(200);
      afterThemeSave = await until(page, (l) => l.primary.toLowerCase() === THEME_PRIMARY);

      // ── AC4 — the negative, then its known-firing twin ────────────────────
      //
      // 🔴 The same record, one edit apart. A draft is created with an ACL that
      // does not admit `*`; the hub gates DELIVERY per event on `canReadRecord`
      // (`RealtimeHub.ts:12-15`), so an anonymous subscriber must be told
      // nothing at all — not a redacted row, nothing.
      const draft = await client.post<Row>(
        '/classes/Page',
        { ACL: DRAFT_ACL, title: DRAFT_PAGE_TITLE, slug: 'unannounced', published: false, showInNav: true, navOrder: 3 },
        asUser(owner)
      );
      expect(draft.status).toBe(201);
      // A generous window, and no early exit: the claim is that nothing arrives,
      // so this arm has to be willing to wait longer than a delivery would take.
      await wait(12000);
      afterDraft = await readLive(page);

      const published = await client.put<Row>(
        `/classes/Page/${draft.json.objectId}`,
        { ACL: PUBLIC_ACL, published: true },
        asUser(owner)
      );
      expect(published.status).toBe(200);
      afterDraftPublished = await until(page, (l) => l.nav.some((n) => n.includes(DRAFT_PAGE_TITLE)));
    });

    // ── The mutant: same acts, same backend, no subscriptions ───────────────
    await withRenderedPage({ projectDir: mutantDir, backendPort }, async (p) => {
      const page = p as RenderedPage;
      await page.setViewport({ width: 1440, height: 1800 });
      await page.navigate(`/${HOME_SLUG}`);
      await wait(6000);
      await page.evaluate(STAMP_AND_COUNT('mutant-open'));
      mutantAtRest = await readLive(page);

      const third = await client.post<Row>(
        '/classes/Page',
        { ACL: PUBLIC_ACL, title: 'Mutant link', slug: 'mutant-link', published: true, showInNav: true, navOrder: 4 },
        asUser(owner)
      );
      expect(third.status).toBe(201);
      /**
       * 🔴 **The same 90 seconds the live page was given to warm up**, and that
       * number is load-bearing rather than generous. D45 means a subscribing
       * page is not live for roughly half a minute after it loads, so a mutant
       * granted only the short wait would come back empty whether or not the
       * subscriptions had been stripped — the arm would pass because of the
       * timeout and read as if it had proved something about the wiring.
       */
      mutantAfterPublish = await until(page, (l) => l.nav.some((n) => n.includes('Mutant link')), 90000);
    });

    // eslint-disable-next-line no-console
    console.log(
      '        SBR-011:',
      JSON.stringify(
        {
          hubDelivered,
          openStreams,
          warmedUp,
          liveCollections,
          subscribeTimings: JSON.parse(subscribeTimings || '[]'),
          pageErrors,
          atRest: { nav: atRest.nav, primary: atRest.primary, stamp: atRest.stamp },
          afterPublish: { nav: afterPublish.nav, stamp: afterPublish.stamp },
          afterSectionEdit: { stamp: afterSectionEdit.stamp, fetches: afterSectionEdit.fetches },
          afterThemeSave: { primary: afterThemeSave.primary, stamp: afterThemeSave.stamp },
          afterDraft: { nav: afterDraft.nav, stamp: afterDraft.stamp },
          afterDraftPublished: { nav: afterDraftPublished.nav, stamp: afterDraftPublished.stamp },
          mutant: { removed: mutantRemoved, atRest: mutantAtRest.nav, after: mutantAfterPublish.nav }
        },
        null,
        1
      )
    );
  });

  afterAll(async () => {
    if (service) await service.stop();
  });

  it('CONTROL: the policy is enforced, and the hub itself delivers to an anonymous subscriber', () => {
    // Enforcement first: every claim about what an anonymous visitor may see is
    // vacuous against a backend that is not checking.
    expect(securityEnforced).toBe(true);
    // Oracle 1. If this is empty, nothing below is about the template.
    expect(hubDelivered).toContain('Hub probe');
  });

  it('the open page is demonstrably live before anything is measured on it', () => {
    // 🔴 The arm that separates "never subscribed" from "subscribed and never
    // delivered to" — two findings with opposite fixes that look identical from
    // the browser. It is read before any acceptance criterion because every one
    // of them is meaningless if this is false.
    // Named, so a partial warm-up says WHICH subscription is dead rather than
    // just "false" — that distinction is the whole finding of the previous run.
    expect(liveCollections).toEqual({ Page: true, Section: true, Theme: true });
    expect(`warmed up: ${warmedUp}`).toBe('warmed up: true');

    // 🔴 **The direction of this arm is reversed, and the reversal IS D46's
    // fix.** It used to read `>= 3`, on the reasoning that `SseTransport` opened
    // one `EventSource` per subscription deliberately, so three was the floor.
    // That floor was the defect: a browser gives an origin six connections, an
    // SSE stream never ends, and at six an ordinary same-origin request is never
    // sent — including the registration POSTs the streams are waiting for
    // (`queued 15007ms, waited 5ms`, measured here). `SseConnectionPool` now puts
    // every unfiltered subscription on this backend on ONE stream registering in
    // ONE POST, so three subscribing queries must cost one connection.
    //
    // ⚠️ Not `toBe(1)`: the hub counts the drive's own anonymous probe stream
    // (oracle 1) alongside the browser's, and a retry can leave a corpse the
    // server has not reaped. `< 3` is what discriminates — it is the assertion
    // the un-fixed code cannot satisfy, and the number itself is logged below.
    expect(openStreams).toBeLessThan(3);
    expect(openStreams).toBeGreaterThanOrEqual(1);
  });

  it('CONTROL: the mutant is exactly the three subscriptions, and nothing else', () => {
    expect(`mutant removed:${mutantRemoved}`).toBe('mutant removed:3');
  });

  it('the page under test is the one the visitor loaded, and it never reloaded', () => {
    // 🔴 The load-bearing control for every arm. Read first so a reload shows up
    // as its own failure rather than as five confusing ones.
    expect(atRest.text).toContain(BODY_BEFORE);
    expect([
      afterPublish.stamp,
      afterSectionEdit.stamp,
      afterThemeSave.stamp,
      afterDraft.stamp,
      afterDraftPublished.stamp
    ]).toEqual([
      'open-and-never-reloaded',
      'open-and-never-reloaded',
      'open-and-never-reloaded',
      'open-and-never-reloaded',
      'open-and-never-reloaded'
    ]);
  });

  it('AC1 — the owner publishes a page and the open site grows the nav link', () => {
    // Not on the page before, on it after: the pair is the claim.
    expect(atRest.nav.some((n) => n.includes(NEW_PAGE_TITLE))).toBe(false);
    expect(afterPublish.nav.some((n) => n.includes(NEW_PAGE_TITLE))).toBe(true);
  });

  it('AC2 — a section edit reaches the page being looked at', () => {
    expect(afterSectionEdit.text).toContain(BODY_AFTER);
    // And the old body is gone: a re-query that APPENDED would satisfy the line
    // above while showing the reader both versions of the opening hours.
    expect(afterSectionEdit.text).not.toContain(BODY_BEFORE);
  });

  it('AC3 — a theme save repaints the open site', () => {
    // A change, not an arrival: the page was already painted by the warm-up.
    expect(atRest.primary.toLowerCase()).toBe(WARMUP_PRIMARY);
    expect(afterThemeSave.primary.toLowerCase()).toBe(THEME_PRIMARY);
  });

  it('AC4 — a draft is not delivered to an anonymous subscriber, and the twin proves the wire was live', () => {
    // The silence…
    expect(afterDraft.nav.some((n) => n.includes(DRAFT_PAGE_TITLE))).toBe(false);
    expect(afterDraft.text).not.toContain(DRAFT_PAGE_TITLE);
    // …and the known-firing signal beside it: the SAME record, one ACL edit
    // later, down the SAME connection on the SAME document.
    expect(afterDraftPublished.nav.some((n) => n.includes(DRAFT_PAGE_TITLE))).toBe(true);
    expect(afterDraftPublished.stamp).toBe('open-and-never-reloaded');
  });

  it('§4 trap 2 — one event re-queries once, not twice', () => {
    // 🔴 Cardinality where two producers meet: the cloud-store subscription fires
    // on this browser's OWN writes and the hub fires on everyone else's, and both
    // are governed by the same `runOnChange-records` box. A doubled fetch per
    // event is invisible in the rendering — the screen is simply correct twice —
    // and costs a query per visitor per edit.
    //
    // ⚠️ **One, not two, and the counter is why.** It is installed after the
    // page has settled, so the load-time fetch is already spent and is not in
    // this number; what is counted is exactly the re-queries one edit caused.
    expect(`Section fetches: ${afterSectionEdit.fetches.Section ?? 0}`).toBe('Section fetches: 1');
  });

  it('MUTANT — with the three subscriptions gone, the same act changes nothing', () => {
    // The mutant loads correctly: this is a subscription finding, not a broken page.
    expect(mutantAtRest.text).toContain(BODY_AFTER);
    expect(mutantAfterPublish.nav.some((n) => n.includes('Mutant link'))).toBe(false);
  });
});
