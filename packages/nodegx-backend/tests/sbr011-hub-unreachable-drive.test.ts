/**
 * SBR-011 AC5 — **with the hub unreachable, the site still works.**
 *
 * *"Subscription failure degrades to the current refresh-to-see behaviour,
 * silently — not a broken page."* That is a claim about a failure, so the
 * failure has to be real, and it has to be the only thing that is different.
 *
 * ## 🔴 How the hub is made unreachable, and why not the obvious way
 *
 * Not by blocking a port, and not by pointing the page somewhere else: the
 * queries and the subscriptions share one base URL, so anything that reaches the
 * hub by address reaches the data routes too and the arm stops being about
 * realtime at all. The lever used here is the backend's own refusal path.
 * `rateLimit.realtimeMaxConnections` is the realtime tier's rate limit — *"a
 * request-rate bucket makes no sense for a connection that stays open for
 * hours"* — and at the cap `GET /realtime` is a plain **503 with `Retry-After`,
 * written before the stream headers go out** (`HttpServer.ts:2208-2218`). So
 * `ops.json` caps this backend at **one** stream and this test holds it. Every
 * subscription the page opens is then refused by the server, on the real code
 * path a visitor would hit, while `/classes/*` answers normally.
 *
 * 🔴 **That is a stronger instrument than a broken address**, because a
 * connection refused by TCP and a connection refused by the application are
 * different failures and the second is the one that ships: an operator who caps
 * a busy backend, or a tier that fills up, does exactly this.
 *
 * ## The two halves of "degrades silently"
 *
 *  - **Not a broken page.** The site renders completely from its own fetches:
 *    the nav, the section body, the page title. `Subscribe To Changes` failing
 *    is a `raiseRuntimeError` onto the error bus (`dbcollectionnode2.ts:791`),
 *    which is deliberately not a rendered overlay — this arm is what says so
 *    about the deployed viewer rather than about the editor.
 *  - **Refresh-to-see.** The owner's change does NOT arrive on the open page,
 *    and DOES arrive after a reload. Both halves: without the second, "nothing
 *    happened" could equally be a backend that never accepted the write.
 *
 * ⚠️ **The control that makes the cap mean something.** A capped backend that
 * was ALSO failing its queries would render the same empty page, so the arm
 * below asserts the cap is what it says it is: this test's own stream is open
 * and a second one is refused with 503. Without that, "the hub was unreachable"
 * is an assumption about a config file.
 *
 * @see sbr011-live-preview-drive.test.ts — AC1..AC4, on a hub that is reachable.
 */
import * as fs from 'fs';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { openStream, SseHandle } from './helpers/sse';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  makeSiteDataDir,
  PUBLIC_ACL,
  readHere,
  readVisit,
  RenderedPage,
  SITE_SECURITY,
  Visit,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'sbr011-capped-token-77f0a2';
const OWNER_EMAIL = 'owner@sbr011capped.test';
const OWNER_PASSWORD = 'drive-pass-capped';

const HOME_TITLE = 'The quiet page';
const HOME_SLUG = 'quiet';
const BODY_BEFORE = 'This sentence was here when the page loaded.';
const BODY_AFTER = 'This sentence arrived while nobody was listening.';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

const NO_VISIT: Visit = {
  url: 'ARM NEVER RAN',
  text: '',
  html: '',
  title: '',
  headings: [],
  nav: [],
  description: null,
  errors: []
};

describe('SBR-011 AC5 — the hub refuses every stream, and the site is still a site', () => {
  let projectDir = '';
  let dataDir = '';
  let bundle: WorkflowBundle;
  let service: BackendService | undefined;
  let base = '';
  let backendPort = 0;

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });
  let owner: Session;
  let securityEnforced = false;
  let sectionId = '';

  /** The single stream this test holds, which is what makes the cap bite. */
  let held: SseHandle | undefined;
  /** The status a SECOND stream gets — the control on the cap itself. */
  let secondStreamStatus = 'ARM NEVER RAN';

  /** The page as it first renders, with every subscription refused. */
  let firstPaint: Visit = NO_VISIT;
  /** The same open document after the owner's write — expected unchanged. */
  let afterWriteInPlace: Visit = NO_VISIT;
  /** …and after a reload, which is the "refresh to see" half. */
  let afterReload: Visit = NO_VISIT;

  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sbr011cap');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, SITE_SECURITY, 'sbr011cap');

    // 🔴 The whole lever, and it is one number. A partial ops.json merges over
    // the defaults section-wise (`mergeOpsOver`), so this changes the realtime
    // cap and nothing else about how this backend behaves.
    fs.writeFileSync(
      path.join(dataDir, 'ops.json'),
      // ⚠️ `version` is not optional even in a one-key file: `OpsState` validates
      // before merging and REFUSES TO START on `unsupported version undefined`,
      // which is the right posture (a config that would not be fully honoured is
      // never silently half-applied) and is not obvious from `mergeOpsOver`.
      JSON.stringify({ version: 1, rateLimit: { realtimeMaxConnections: 1 } }, null, 2)
    );

    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'sbr011cap',
      backendName: 'SBR-011 capped hub drive'
    });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;
    securityEnforced = started.security.enforced;

    bindProjectToBackend(projectDir, 'sbr011cap', backendPort);

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

    const home = await client.post<Row>(
      '/classes/Page',
      { ACL: PUBLIC_ACL, title: HOME_TITLE, slug: HOME_SLUG, published: true, showInNav: true, navOrder: 1 },
      asUser(owner)
    );
    expect(home.status).toBe(201);
    const section = await client.post<Row>(
      '/classes/Section',
      { ACL: PUBLIC_ACL, kind: 'richText', order: 0, data: { heading: 'Notice', body: BODY_BEFORE }, pageId: home.json.objectId },
      asUser(owner)
    );
    expect(section.status).toBe(201);
    sectionId = section.json.objectId;

    // ── Take the one slot, then prove it is taken ───────────────────────────
    held = await openStream(base);
    await held.waitFor('connected');
    secondStreamStatus = await openStream(base).then(
      (s) => {
        s.close();
        return 'a second stream was ACCEPTED';
      },
      (e: Error) => e.message
    );

    await withRenderedPage({ projectDir, backendPort }, async (p) => {
      const page = p as RenderedPage;
      await page.setViewport({ width: 1440, height: 1800 });
      firstPaint = await readVisit(page, `/${HOME_SLUG}`);

      const edited = await client.put<Row>(
        `/classes/Section/${sectionId}`,
        { data: { heading: 'Notice', body: BODY_AFTER } },
        asUser(owner)
      );
      expect(edited.status).toBe(200);

      // A window longer than any delivery would need. The claim is that nothing
      // arrives, so the arm has to outwait a slow success.
      await wait(15000);
      afterWriteInPlace = await readHere(page);

      // …and the refresh-to-see half, which is the behaviour AC5 says this
      // degrades TO.
      afterReload = await readVisit(page, `/${HOME_SLUG}`);
    });

    // eslint-disable-next-line no-console
    console.log(
      '        SBR-011 AC5:',
      JSON.stringify(
        {
          secondStreamStatus,
          firstPaint: { nav: firstPaint.nav, title: firstPaint.title, errors: firstPaint.errors.slice(0, 5) },
          inPlace: afterWriteInPlace.text.includes(BODY_AFTER) ? 'UPDATED' : 'unchanged',
          afterReload: afterReload.text.includes(BODY_AFTER) ? 'UPDATED' : 'unchanged'
        },
        null,
        1
      )
    );
  });

  afterAll(async () => {
    if (held) held.close();
    if (service) await service.stop();
  });

  it('CONTROL: the cap is real — this test holds the one stream and a second is refused', () => {
    expect(securityEnforced).toBe(true);
    // 🔴 The instrument's own calibration. `503` is the hub's refusal
    // (`HttpServer.ts:2216`); anything else and the page's subscriptions were
    // never actually refused, so every arm below is measuring something other
    // than an unreachable hub.
    expect(secondStreamStatus).toBe('stream status 503');
  });

  it('AC5a — the site renders completely: a refused subscription is not a broken page', () => {
    expect(firstPaint.text).toContain(BODY_BEFORE);
    expect(firstPaint.nav.some((n) => n.includes(HOME_TITLE))).toBe(true);
    // Silently: nothing on the page tells the visitor about a subscription, a
    // connection, or a retry. They are reading a website.
    for (const leak of ['realtime', 'subscription', 'Retry-After', '503', 'EventSource']) {
      expect(`${leak}: ${firstPaint.text.toLowerCase().includes(leak.toLowerCase())}`).toBe(`${leak}: false`);
    }
  });

  it('AC5b — it degrades to refresh-to-see, and both halves are read', () => {
    // The change did NOT arrive on the open page…
    expect(afterWriteInPlace.text).not.toContain(BODY_AFTER);
    expect(afterWriteInPlace.text).toContain(BODY_BEFORE);
    // …and DOES after a reload, which is what makes the line above a statement
    // about the subscription rather than about the write.
    expect(afterReload.text).toContain(BODY_AFTER);
  });
});
