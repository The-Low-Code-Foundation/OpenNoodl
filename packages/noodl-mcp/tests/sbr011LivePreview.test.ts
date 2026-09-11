/**
 * SBR-011 — live preview over the realtime hub.
 *
 * The person sentence is *"with the site open in one tab and the admin panel in
 * another, publishing a change updates the open site without a reload"*, and
 * that sentence is settled over a real backend in
 * `sbr011-live-preview-drive.test.ts`. This file grades the half that a drive
 * would otherwise re-derive by hand every run, over the **shipped artefact** --
 * `site-builder.content.json`, the file a person receives -- rather than over
 * the component sets that argue for it.
 *
 * ## 🔴 What is actually at risk here, and it is not "did somebody tick a box"
 *
 * Three things about this feature fail **silently and invisibly**, and each has
 * an arm below:
 *
 *  - **The subscription can be refused by the policy and the page still
 *    renders.** Subscription CREATION is gated on the collection's `find` CLP
 *    (`RealtimeHub.ts:24`), so tightening `Section.find` to `authenticated` in
 *    `site-builder.security.json` -- a plausible, well-meant edit in a file
 *    nobody would connect to this one -- stops an anonymous visitor's site being
 *    live and changes not one pixel of the first paint. The subscribed
 *    collections are therefore checked against the shipped policy, derived from
 *    it rather than retyped.
 *  - **A subscription costs a query, and it used to cost a whole HTTP
 *    connection.** 🔴 **That second half is no longer true and the correction is
 *    worth keeping**: `SseTransport` opened one `EventSource` per subscription
 *    deliberately, a browser gives an HTTP/1.1 origin about six connections, and
 *    at six open streams an ordinary same-origin request is **never sent** --
 *    measured, `queued 15007ms, waited 5ms`. That was D46, and the fix is
 *    `SseConnectionPool`: every unfiltered subscription on one backend now
 *    shares one stream and registers in one POST. So the count below is no
 *    longer a *connection* budget. It is still an assertion rather than an
 *    observation -- a fourth subscribing query is a fourth re-query per visitor
 *    per event, and a filtered one is still a stream of its own -- but the
 *    cliff it used to sit next to has gone.
 *  - **`runOnChange-records` is the difference between re-querying and firing
 *    signals into nothing** (`dbcollectionnode2.ts:772`). Its default is `true`,
 *    so leaving it unstated works -- until a migration or a bulk edit answers it
 *    `false` and the site quietly stops updating. This phase has already
 *    registered an unstated `runOnChange-*` with an effect as a defect.
 *
 * ⚠️ **Name what this instrument cannot see.** Every arm here reads parameters
 * on a graph. Nothing in this file proves an event ever arrives, that a re-query
 * returns different rows, or that the DOM changes -- and a subscription that
 * connects and delivers nothing looks identical from here. The drive carries all
 * of that; this file carries the claims the drive cannot re-derive cheaply.
 *
 * @see sbr011-live-preview-drive.test.ts -- AC1..AC5 against a real backend.
 * @see sb006Components.ts -- `LIVE_QUERY`, and why three queries and not five.
 */
import { readArtefact } from './siteBuilderStyleScan';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SITE_SECURITY = require('../../noodl-editor/src/editor/src/models/template/templates/site-builder.security.json') as {
  collections: Record<string, { permissions: Record<string, string> }>;
};

interface Node {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: Node[];
}

const content = readArtefact();

function nodesOf(componentName: string): Node[] {
  const component = content.components.find((c) => c.name === componentName);
  if (!component) throw new Error(`no component ${componentName} in the shipped artefact`);
  const out: Node[] = [];
  const walk = (n: Node) => {
    out.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  for (const root of component.graph.roots as Node[]) walk(root);
  return out;
}

/** Every `DbCollection2` in the artefact, as `component::id` rows. */
function everyQuery(): { where: string; component: string; node: Node }[] {
  const rows: { where: string; component: string; node: Node }[] = [];
  for (const component of content.components) {
    for (const node of nodesOf(component.name)) {
      if (node.type !== 'DbCollection2') continue;
      rows.push({ where: `${component.name} ${node.id}`, component: component.name, node });
    }
  }
  return rows;
}

const subscribing = () => everyQuery().filter((q) => q.node.parameters?.realtime === true);

describe('SBR-011 — the queries that hold a subscription open', () => {
  it('is exactly three, and they are the three an acceptance criterion names', () => {
    // 🔴 Cardinality, not membership. Three subscribing queries is a re-query
    // budget (header, point 2); a fourth is not a worse version of this feature,
    // it is a different trade that has to be argued for. ⚠️ It stopped being a
    // *connection* budget when D46 was fixed — the three now share one stream —
    // so a diff that adds a fourth is no longer walking towards a cliff, and
    // this arm should be read as the smaller claim it now makes.
    expect(subscribing().map((q) => q.where).sort()).toEqual([
      '/Pages/Site sections', // AC2 -- a section edit reaches the open page
      '/Pages/Site theme', //    AC3 -- a theme save repaints it
      '/Site/Nav pages' //       AC1 -- a published page grows the nav link
    ]);
  });

  it('CONTROL: the site has queries that are deliberately NOT live, so three is a choice', () => {
    // A count of three means nothing if three is all there are. These two are the
    // ones left static on purpose: a visitor whose current page record or site
    // settings change sees it on their next navigation, which is the behaviour
    // that shipped before this task and is not a regression.
    const staticOnSite = nodesOf('/Pages/Site')
      .filter((n) => n.type === 'DbCollection2' && n.parameters?.realtime !== true)
      .map((n) => n.id)
      .sort();
    expect(staticOnSite).toEqual(['pageQuery', 'settings']);
  });

  it('every subscribing query states runOnChange-records rather than inheriting it', () => {
    // `handleRealtimeChange` re-queries only `if (this.shouldRunOnValueChange('records'))`
    // (`dbcollectionnode2.ts:772`). Unstated it reads `true`, so this arm is not
    // about today's behaviour -- it is about the parameter surviving the next
    // bulk edit with its meaning attached.
    for (const q of subscribing()) {
      expect(`${q.where}: ${String(q.node.parameters?.['runOnChange-records'])}`).toBe(`${q.where}: true`);
    }
    expect(subscribing().length).toBeGreaterThan(0);
  });

  it('subscribes only to collections this template ships as publicly findable', () => {
    // 🔴 Derived from the shipped policy, not retyped beside it. Subscription
    // CREATION is gated on the collection's `find` CLP (`RealtimeHub.ts:24`), so
    // a subscription to a collection an anonymous visitor cannot `find` is
    // refused -- and refused subscriptions are invisible on a page that renders
    // correctly from its first fetch.
    const subscribed = [...new Set(subscribing().map((q) => String(q.node.parameters?.collectionName)))].sort();
    expect(subscribed).toEqual(['Page', 'Section', 'Theme']);

    for (const collection of subscribed) {
      const find = SITE_SECURITY.collections[collection]?.permissions?.find;
      expect(`${collection}.find=${find}`).toBe(`${collection}.find=public`);
    }
  });

  it('CONTROL: the policy this is derived from does refuse something, and ContactMessage is not subscribed', () => {
    // The presence control for the arm above: `find: public` on three
    // collections is only evidence if this policy is capable of saying anything
    // else. It is -- and the collection it refuses is the one an anonymous
    // subscription would be rejected for.
    expect(SITE_SECURITY.collections.ContactMessage.permissions.find).toBe('role:admin');

    const messageSubscriptions = subscribing().filter((q) => q.node.parameters?.collectionName === 'ContactMessage');
    expect(messageSubscriptions.map((q) => q.where)).toEqual([]);
  });

  it('the public site holds three subscriptions and the admin panel holds none', () => {
    // The budget as a visitor actually pays it: `/Pages/Site` plus the
    // components it places. `/Site/Nav` is where the third one lives, which is
    // why counting `/Pages/Site` alone would read two and be wrong.
    //
    // ⚠️ **Three subscriptions, one stream** since D46 — the old title of this
    // arm said "opens three streams" and was measuring the same three
    // parameters, which is a good reminder that a title can outlive its
    // mechanism without a single assertion going red.
    const placed = new Set<string>(['/Pages/Site']);
    for (let changed = true; changed; ) {
      changed = false;
      for (const name of [...placed]) {
        for (const node of nodesOf(name)) {
          if (!node.type.startsWith('/')) continue;
          if (placed.has(node.type)) continue;
          if (!content.components.some((c) => c.name === node.type)) continue;
          placed.add(node.type);
          changed = true;
        }
      }
    }
    expect([...placed].sort()).toContain('/Site/Nav');

    const onPublicSite = subscribing().filter((q) => placed.has(q.component));
    expect(onPublicSite.length).toBe(3);

    // And every subscribing query is on the public site: nothing an admin screen
    // places holds a stream open. The admin panel is a person watching their own
    // writes, which the cloud-store subscription already covers without a socket.
    expect(subscribing().length).toBe(onPublicSite.length);
  });
});
