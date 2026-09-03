/**
 * SB-006's five browser components — the public site — as the arguments the MCP
 * door is given.
 *
 * Data, not a suite, for the same reason `sb004Components.ts` and
 * `sb005Components.ts` are: SB-008's drive has to boot **this** site rather than
 * a hand-written twin, and a second copy becomes a twin on the first edit that
 * reaches only one of them.
 *
 * ── What the admin panel and this site agree on ──────────────────────────────
 *
 * Two contracts run between `sb005Components.ts` and this file, and neither is
 * expressible in a type. Both are asserted across the two files by
 * `sb006PublicSite.test.ts`, because a contract nothing checks is a contract
 * that drifts on the first edit that reaches one side.
 *
 *  1. **The theme keys.** SB-005's `buildTokens` writes exactly the
 *     `THEME_TOKEN_FIELDS` keys (SBR-003's twelve-field contract, single-sourced
 *     in the editor's `siteTheme.ts` and re-exported below as `THEME_KEYS`) into
 *     `Theme.tokens`; `applyTheme` reads those keys and nothing else.
 *  2. **The section payload.** SB-005's `Admin/SectionRow` edits exactly
 *     `data.body` and `data.image` (a `cloudfile`, rendered through its `url`),
 *     so those two are all a section view may read. Anything else would be a
 *     field with no author.
 *
 * ── What crosses from the doctrine, and from SB-005 ──────────────────────────
 *
 * SB-005 §2 tabled which of `BACKEND_DOCTRINE_MD`'s four rules bite in a
 * browser, and §7 corrected two of them on measurements. All of that applies
 * here unchanged; three things this file adds are new.
 *
 * 🔴 **1. A third query shape, and it is the one this site is mostly made of.**
 * SB-005 asserted two: a *port-filtered* query (both `runOnChange-*` boxes off,
 * because a load-time fetch with no `qp-` value is F12's unfiltered fetch) and
 * an *unfiltered* one (boxes left on, because with them off there is no
 * parameter left to trigger it — s4's `claimSite` defect). The navigation query
 * is neither: it is filtered by a **literal**, and a literal is on the node from
 * the moment it is built. `visualQueryToNeutral` reads `query.value` when a rule
 * has no `input` (`saved.ts:271`), and `collectFilterParameters` mints no port
 * for such a rule (`queryutils.ts:204-208`) — so the graph-build fetch is
 * already correctly narrowed, and there is no parameter for anything to set.
 * **Boxes ON, exactly like the unfiltered one, and for exactly the same reason.**
 * The precondition SB-004's fix carries is about the *port*, not about the
 * filter.
 *
 * 🔴 **2. A `Query Records` node's own `fetched` is ordering-safe with its own
 * values, and this site depends on that four times.** `setCollection` flags
 * `items`/`isEmpty`/`count` and `sendSignalOnOutput('fetched')` runs in the same
 * synchronous block (`dbcollectionnode2.ts:891-894`); both go through the
 * receiver's input queue (`outputproperty.ts:141-168`, `:182-210`), and
 * `Node.update` drains one entry per input name in one pass (`node.ts:626-656`).
 * So a code node wired from a query's `fetched` **and** its `items` sees this
 * fetch's rows. F11 was a producer emitting in two passes of its own; this
 * producer emits in one.
 *
 * ── `mounted`, not `visible`, for anything conditionally shown ──────────────
 *
 * 🔴 **SBR-004's drive found this and it is the difference between a shape and a
 * shape with a hole in it.** `visible: false` sets `visibility: hidden`, and the
 * port's own description says what that means: *"Hides the element while keeping
 * the space it occupies in the layout"*
 * (`node-shared-port-definitions.ts:215-228`). Measured in the preview at 360px
 * on an unclaimed site: the hidden contact-form wrapper was **365px tall**, an
 * empty band between the nav and the only thing on the page.
 *
 * Every visual node also has `mounted` — *"Removes the element from the page
 * entirely when false, unlike Visible which leaves its space behind"*
 * (`react-component-node.ts:1835-1857`). That is the port this template wanted
 * everywhere a surface is shown *conditionally*: the contact wrapper, the
 * empty-screen card, a section's image and body, and the form's two answers.
 * A `richText` section was reserving a 320px image band it never draws, on every
 * page — the same defect, repeated once per row.
 *
 * ⚠️ The reasoning the old `visible: false` carried transfers unchanged: the
 * authored `false` still stands until a code node publishes, and it is still
 * only a code node that may reveal these. What changed is whether a hidden thing
 * costs the reader 365 pixels.
 *
 * `visible` is right for something whose space should be *held* — this template
 * has no such surface, which is why the word does not appear on one any more.
 *
 * 🔴 **3. `isEmpty` is true before the first fetch, by contract**
 * (`dbcollectionnode2.ts:410-419`, in its own description). A "page not found"
 * panel wired from `isEmpty` is therefore visible to every visitor until the
 * query answers — and on a port-filtered query the first fetch waits for the
 * slug, so that is not a flash. Every not-found state below is computed in a
 * code node triggered by `fetched`, whose output does not exist until a fetch
 * has happened, so the authored `visible: false` stands until then.
 *
 * ── Two things a code node in a browser must guard ───────────────────────────
 *
 * `JavascriptNodeParser.createNoodlAPI` returns `window.Noodl` **or `{}`**
 * (`javascriptnodeparser.js:497-501`), and the SSR/SSG entries render this
 * bundle with no `document`. This is the template most likely to be deployed
 * server-rendered — it is the SEO surface — so every code node that touches
 * `document` or `Noodl.SEO` below tests for it first. An unguarded one throws on
 * the server and takes the page's render with it.
 */

/**
 * The theme keys — SBR-003's contract, imported rather than restated.
 *
 * The values are CSS custom properties from the project's own style vocabulary
 * (`get_style_vocabulary`) plus the one custom token the template mints
 * (`--site-measure`) — not invented names, so a component authored with
 * `var(--primary)` follows the record. The map lives in the editor's
 * `siteTheme.ts` beside the `designTokens` floor and the presets, because a
 * second copy of a palette drifts silently.
 *
 * ⚠️ The old `fontFamily` special case is now `fontUi`: the vocabulary DOES
 * have family tokens (`--font-sans`/`--font-serif`), and POL-006's floor in
 * `TokenResolver.generateCss` stamps `body { font-family: var(--font-sans) }`
 * on every stamped surface — so overriding the token IS overriding the base
 * face there. `applyTheme` writes the token and, belt-and-braces, mirrors the
 * value onto the document element's inline `font-family` for any surface the
 * stamp never reached (a declared token default alone never runs a setter).
 */
import {
  THEME_TOKEN_FIELDS,
  buildThemeApplierScript
} from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import {
  DEFAULT_SECTION_KIND,
  FIELD,
  PRIMARY_BUTTON,
  ROUTER,
  SECTION_KINDS,
  SECTION_SORT
} from './sb005Components';

export const THEME_KEYS = THEME_TOKEN_FIELDS;

/**
 * The Router the template's `App` component hosts — **imported, not restated**.
 * Two spellings of one router name is a site whose links navigate nowhere, and
 * nothing would report it.
 */
export { ROUTER } from './sb005Components';
// 🔴 D30 — one copy, shared with `/Pages/PageEditor`'s query. Re-exported so this
// module's own consumers are unaffected by where it is defined.
export { SECTION_SORT } from './sb005Components';

/** The public site's one page component, as `RouterNavigate.target` names it. */
export const SITE_PAGE = '/Pages/Site';

/**
 * SBR-004 AC2 — the app-wide variable carrying the slug the page is currently
 * showing, written once by `/Pages/Site` and read by every nav link.
 *
 * 🔴 **A variable rather than a component input, and that is a measurement.**
 * `For Each` sets `id` and the model's own fields on each item and nothing else
 * (`foreach.tsx:586-597`), so a value that is *constant across items* cannot
 * reach a repeated component as a port — the same limit that put the contact
 * form outside the section list. `Noodl.Variables` is a `Noodl.Object` proxy
 * over the `'--ndl--global-variables'` model (`noodl-js-api.ts:28`), so a write
 * through it goes through `Model.set` and every `Variable` node reading the name
 * is notified. That is the platform's own answer to this exact shape.
 *
 * ⚠️ The name is deliberately site-prefixed: variables are app-wide, and the
 * admin panel runs in the same app.
 */
export const SITE_CURRENT_SLUG_VAR = 'siteCurrentSlug';

/**
 * SBR-004 AC3 / SBR-012's seed — the dimensions in this template that are NOT a
 * token, each with the reason it cannot be one.
 *
 * An **exemption list, not a relaxation** (the `REMOVED_BY_SB018` pattern): the
 * suite scans the five component sets for raw style values and every hit must be
 * named here, so adding a raw value reds the gate until someone writes down why.
 *
 * ✅ **SBR-012 built the widening this comment promised.** `TEMPLATE_DIMENSION_EXEMPTIONS`
 * (`siteBuilderStyleScan.ts`) covers the whole generated artefact — nine entries,
 * of which these four are the SB-006 half, imported by key rather than retyped so
 * the reasons below have one copy. 🔴 **This list is no longer the whole story:**
 * a raw dimension outside `/Site/*` and `/Pages/Site` is named there, not here,
 * and the template-wide keys carry a component because several components hold a
 * node labelled `Heading` and only one sets a raw width.
 *
 * 🔴 Colour, radius, gap, face and font size have **no** entries and must not
 * gain any — the vocabulary covers all five, so a raw one there is a defect
 * rather than a gap.
 */
export const RAW_DIMENSION_EXEMPTIONS: ReadonlyArray<{ label: string; port: string; why: string }> = [
  // 🔴 SBR-005 retired `Section image`. The single 320px band is gone with the
  // one-node section view; the two entries that named it are replaced by the two
  // the gallery tile needs, because an exemption matching nothing reads exactly
  // like a raw value that was never introduced (SBR-012's both-directions rule).
  {
    label: 'Gallery tile',
    port: 'height',
    why: 'A gallery tile is a picture crop, not a rhythm step — the spacing scale tops out at 96px and this is 180px. No vocabulary token names a media height.'
  },
  {
    label: 'Gallery tile',
    port: 'width',
    why: '48% is a layout instruction ("two of these fit a row, one fits a phone"), not a measurement. There is no token for a fraction of a row and there should not be — a spacing token here would be a fixed width that stops being two-up the moment the measure changes.'
  },
  {
    label: 'Page ground',
    port: 'minHeight',
    why: '100vh is a viewport relation; the vocabulary is deliberately viewport-free, and this is what keeps a one-section page from ending halfway down the screen.'
  },
  {
    label: 'Page shell',
    port: 'width',
    why: 'Same as the image width: 100% under a max-width IS the centred-measure idiom, and the measure itself is --site-measure.'
  }
];

/**
 * 🔴 Keyed by **label**, not by the `id` authored above, and that is SB-004 F9:
 * the door reallocates node ids to be unique across the project, so `image` can
 * land as `image-2` and an exemption keyed on the sent id would silently stop
 * matching — an exemption that matches nothing reads exactly like a raw value
 * that was never introduced.
 */
export const exemptionKey = (label: string, port: string): string => `${label} | ${port}`;

/**
 * 🔴 **The catch-all, and the reason SB-005's page paths changed.**
 *
 * The public site is one page component at `{slug}`, because a site builder's
 * whole point is that `/about` is a record and not a component. The Router
 * matches a URL by splitting both sides on `/` and comparing segment by segment,
 * where `{name}` matches any segment (`router.tsx:747-757`); it then picks the
 * page whose pattern has the smallest `|patternParts − pathParts|`, keeping the
 * **first** on a tie (`:775-783`, the guard is `>` and not `>=`).
 *
 * So `{slug}` matches `/admin` at distance 0 and so does a page whose path is
 * `admin` — a tie broken by whichever the Router's `pages` list happens to name
 * first, which is the order the components were written in. Two segments on the
 * admin side removes the tie entirely: `{slug}` still *matches* `/admin/pages`,
 * but at distance 1, and distance is read before order. That is what
 * `ADMIN_PATH_PREFIX` is for, and `sb006PublicSite.test.ts` asserts it over the
 * union of both panels' pages by re-implementing the Router's own rule.
 */
export const SITE_URL_PATH = '{slug}';

/**
 * "The page with this slug", and "the sections of this page" — both filtered
 * through a `qp-` port, so both carry `NO_LOAD_TIME_FETCH`.
 */
export const NO_LOAD_TIME_FETCH = {
  'runOnChange-collectionName': false,
  'runOnChange-querySettings': false
};

/**
 * 🔴 **SBR-011 — the three queries that hold a subscription open, and the two
 * that deliberately do not.**
 *
 * `realtime` is `Query Records`' own checkbox (`dbcollectionnode2.ts:1264`,
 * displayed as *Subscribe To Changes*), and its documented behaviour is the one
 * this task needs: on a server-pushed create/update/delete it **re-runs the
 * query** (`handleRealtimeChange:772`). That is a different node from
 * `SubscribeToChanges`, which fires signals and publishes the changed row but
 * states in its own header that it does **not** re-query — *"Query Records'
 * checkbox stays as the query-refreshing form and the two are not
 * alternatives"* (`subscribetochanges.ts:14-16`). README §2 promises "live
 * preview via `Subscribe to Changes`" and the port carrying that name is this
 * one; wiring the standalone node here would have been the name matching and
 * the mechanism not.
 *
 * ⚠️ **`runOnChange-records` is stated rather than left to its default.** The
 * default is `true` (`run-on-value-change.ts:188` — `state[inputName] !== false`),
 * so ticking `realtime` alone would work today. It is written out because this
 * phase has already registered an unstated `runOnChange-*` with an effect as a
 * defect: the box is the difference between "re-queries" and "fires signals
 * only", and a template should not leave the load-bearing half implicit.
 *
 * ## 🔴 Why three queries and not five — this is a budget, not an oversight
 *
 * `SseTransport` opens **one `EventSource` per subscription, deliberately**
 * (`SseTransport.ts:38-44`): both servers' subscription POST *replaces* the set
 * for a `clientId`, so two subscriptions sharing a stream would clobber each
 * other. The cost is one HTTP connection per subscribing node, and a browser
 * gives an HTTP/1.1 origin about six — shared with every `fetch` the page still
 * has to make. Five subscribing queries on one page would spend the whole pool
 * on streams that are idle by design and leave the queries themselves queued.
 *
 * So the three that earn a stream are the three an acceptance criterion names:
 * `sections` (AC2), `theme` (AC3), and the nav's `pages` (AC1). `pageQuery` and
 * `settings` are left static: a visitor whose *current* page record or site
 * settings change sees it on their next navigation, which is the pre-SBR-011
 * behaviour and not a regression. `sbr011LivePreview.test.ts` asserts the count
 * is exactly three, so a fourth is a decision somebody has to make on purpose.
 */
export const LIVE_QUERY = {
  realtime: true,
  'runOnChange-records': true
};

/**
 * 🔴 **SBR-004 AC1, half B — what every band stacked down this page has to say
 * out loud, because the platform's default is against it.**
 *
 * `addDimensions` gives every visual node `height: 100` with **defaultUnit `%`**
 * (`node-shared-port-definitions.ts:830-846`) and `Group`'s `defaultSizeMode` is
 * `explicit` (`group.ts:492` takes the default), so **an unstyled `Group` is
 * `width:100%; height:100%`**. `Layout.size` then converts a percentage *along* the
 * parent's direction into `flexGrow` (`layout.ts:92-98`), so three unstyled bands in
 * a column do not stack — they divide the page between them. Measured on the built
 * template: nav **219** / header **218** / footer **219** in a 768px viewport, with
 * the control arm (`height: auto` on the three) reading **138 / 98 / 74** (§8.2 arm B).
 *
 * `contentHeight` keeps the width assignment (these bands do span the measure) and
 * stops assigning a height, which is the `auto` the control restored. `Group`'s
 * `defaultCss` carries no height (`group.ts:30-34`), so nothing is left behind.
 *
 * ⚠️ **Not a style, and not optional.** It goes on every Group that is *placed in a
 * column and sized by what is in it* — which on the public site is all of them. The
 * exceptions are deliberate and each says so where it is authored: `Page ground` and
 * `Page shell` are the two nodes that SHOULD fill, and `Section image` is `explicit`
 * because a crop has a stated height.
 *
 * 🔴 **`flex-grow: 0` is not this fix.** §8.2 measured that arm: grow verified 0 in
 * computed style, heights held at 219/218/219. The height comes from `height: 100%`,
 * so the size mode is the only lever that reaches it.
 */
export const STACKED_IN_A_COLUMN = { sizeMode: 'contentHeight' };

/**
 * The nodes on the public site that are SUPPOSED to take the space their parent
 * gives them — an **exemption list, not a relaxation**, in the same shape as
 * {@link RAW_DIMENSION_EXEMPTIONS} and for the same reason.
 *
 * `sb006PublicSite.test.ts` walks the whole placed tree (across component
 * boundaries, because a component's visual root is laid out by whatever placed
 * the instance) and reds on any `Group`/`Text`/`Image` whose size along its
 * parent's direction is still the defaulted percentage — which `Layout.size`
 * turns into `flexGrow`. Every legitimate one is here with the sentence that
 * makes it legitimate, so *adding* a growing node reds the gate until someone
 * writes down why it grows.
 *
 * 🔴 Keyed by **label**, not by the authored id, for SB-004 F9 — the door
 * reallocates ids to be unique across the project.
 */
export const FILL_THE_PARENT_EXEMPTIONS: ReadonlyArray<{ component: string; label: string; why: string }> = [
  {
    component: 'Pages/Site',
    label: 'Page ground',
    why: 'This is the themed ground and it must reach the bottom of the window — it is the node carrying --background and minHeight 100vh. A content-height ground is the "the page just stops" defect SBR-004 exists to end.'
  },
  {
    component: 'Pages/Site',
    label: 'Page shell',
    why: 'The centred measure column. It grows inside the ground so the ground has something spanning it; its own children are the bands, and those are all contentHeight.'
  }
];

export const PAGE_BY_SLUG_FILTER = {
  combinator: 'and',
  rules: [{ property: 'slug', operator: 'equal to', input: 'slug' }]
};

export const SECTIONS_OF_PAGE_FILTER = {
  combinator: 'and',
  rules: [{ property: 'pageId', operator: 'equal to', input: 'pageId' }]
};

/**
 * The navigation query's filter — the third shape.
 *
 * 🔴 **There is deliberately no `published` rule here.** SB-004 §3: the ACL *is*
 * the publication state, and `Page.find` is public, so the row-level predicate
 * has already removed every draft before this query sees anything. A
 * `published: true` rule would be a second, weaker copy of a permission boundary
 * — and the copy is the one that goes stale.
 *
 * ⚠️ The visible consequence, recorded rather than hidden: a signed-in admin
 * browsing the public site reads drafts, because that principal may. It reads as
 * a preview and it is the invariant working, not leaking.
 */
export const NAV_FILTER = {
  combinator: 'and',
  rules: [{ property: 'showInNav', operator: 'equal to', value: true }]
};

/** Published pages, in the order the admin asked for. SB-004 §2's derived nav. */
export const NAV_SORT = [{ property: 'navOrder', order: 'ascending' }];

/** The one thing a failed contact submission is allowed to say. */
export const CONTACT_REFUSAL_TEXT = 'That message could not be sent.';
/** And the one thing a successful one says. */
export const CONTACT_SUCCESS_TEXT = 'Thanks — your message has been sent.';
/**
 * What a visitor sees at a slug that is not a published page.
 *
 * 🔴 **SB-015 F27: this screen used to have three pixel-identical causes** — a
 * genuine 404, a read the policy refused, and a site nobody has claimed — and
 * they want three different fixes. The one an author reaches for first, on
 * seeing this text on their own home page, is turning the publication boundary
 * off, which is SB-015 §2's arm A. So the panel now says which of the three it
 * is, computed by `diagnoseNotFound` below.
 *
 * ⚠️ All three strings are read by **visitors**, not only by the author, so none
 * of them names a credential, a collection, a policy or a recovery step. The
 * author-facing instruction belongs in the editor (the Secrets panel, SB-015
 * §6.4a), not on a public page — a 404 that explains how the site is
 * administered is a different defect.
 */
export const NOT_FOUND_TEXT = 'That page could not be found.';

/**
 * SBR-004's footer link, and the only string on the public site that is authored
 * copy rather than a placeholder waiting for a record.
 *
 * ⚠️ "Home" and not the site name: the footer already carries the site name on
 * the line above it, and a link labelled with the same words as the text beside
 * it reads as a repetition rather than as a way back.
 */
export const FOOTER_HOME_TEXT = 'Home';

/**
 * The site has no `SiteSettings` row, i.e. nobody has completed setup.
 *
 * This is what F27 actually measured: with `claimSite` refused there is no
 * `SiteSettings` and no `Theme`, so there are no pages either and the *home*
 * page 404s. Saying "not found" there is true and useless; this says the thing
 * that is actually wrong.
 */
export const NOT_SET_UP_TEXT = 'This site has not been set up yet.';

/**
 * The page query was refused rather than answered (s11's F24).
 *
 * Deliberately NOT "not found": a refused read and an absent record are opposite
 * conditions with opposite fixes, and reporting one as the other is how a
 * policy problem gets diagnosed as a missing record.
 */
export const NOT_AVAILABLE_TEXT = 'This site’s pages are not available right now.';

/**
 * SBR-002 (finding 2) — nothing answered at all.
 *
 * 🔴 **This state has no signal of its own, and the drive proved it cannot get
 * one from the queries.** With no backend bound, the legacy store's endpoint is
 * `undefined`, the XHR goes to `undefined/classes/…` — a RELATIVE url — and the
 * editor's preview server answers it with the SPA fallback: **200 and HTML**.
 * `ParseWireAdapter.query`'s success handler then throws on
 * `response.results` (`response` is the failed JSON parse, `undefined`) inside
 * the XHR callback, so the query publishes neither `fetched` nor `error` —
 * measured 2026-08-28: `visibleText: 0`, three `undefined/classes/*` requests,
 * all 200, chain dead. F27's diagnoser abstains forever on a graph where
 * nothing answers, which is correct for "answer pending" and a white void here.
 *
 * So the state's signal is a DEADLINE, not a failure output: a Delay started at
 * page mount arms `diagnoseNotFound`'s watchdog arm, which speaks only when
 * NOTHING has answered — any real signal (rows, refusal, absence) beats it on
 * arrival, in both directions, because the diagnoser re-runs on every input
 * and overwrites its own outputs. A slow backend shows this sentence for a
 * moment and then the truth; that is the cost of saying anything at all on a
 * dead graph.
 *
 * ⚠️ Unlike the three strings above, this one names an editor surface — a
 * deliberate break from the visitor-string rule, because the state it reports
 * is an AUTHOR's: only a project run before a backend is attached (or deployed
 * without one) can reach it. A visitor on a healthy site can see refusals and
 * absences; they cannot see "no backend was ever configured".
 */
export const NO_BACKEND_TEXT =
  'No backend connected. This project needs a backend before it can store pages — add one from Backend Services.';

/**
 * How long the page waits for ANY answer before concluding nobody is there.
 * Long enough that a local backend's first answer (tens of ms, s2 measured
 * ~5ms probes) never races it; short enough that a person watching a white
 * page reads the sentence rather than closing the window.
 */
export const NO_BACKEND_DEADLINE_MS = 4000;

/** SB-004 §5's public endpoint. */
export const FN_CONTACT = 'submitContactForm';

// ── 1. Site/NavLink — one entry in the derived navigation ────────────────────

/**
 * The nav repeater's item.
 *
 * Its interface is `Component Inputs`, and the names are the `Page` fields it
 * wants: `For Each` sets an input called `id` to the record id and every other
 * *declared* input to the field of the same name (`foreach.tsx:586-597`). An
 * undeclared field is simply not delivered, so this port list is what the link
 * can see.
 *
 * 🔴 **`navigate` carries `pm-slug`, not the record id.** The public URL is the
 * slug — that is the entire product — and `RouterNavigate` registers `pm-<name>`
 * on the connection path (`router-navigate.ts:171`), so no port is declared.
 */
export const NAV_LINK_NODES = [
  {
    id: 'link',
    type: 'Text',
    label: 'Nav link',
    // `as: 'span'` inside the `nav` band: a heading level here would compete
    // with the page's own `h1`, which is the SEO surface this whole component
    // exists to serve.
    //
    // SBR-004: every value is a token. `color` and `fontWeight` are deliberately
    // NOT authored here — they arrive from `linkState` below, and that is the
    // whole of AC2. The standing `text` stays for SB-018 (3).
    parameters: {
      as: 'span',
      text: 'Page',
      // 🔴 **SBR-004 AC1, half A: without this the nav bar renders as a column.**
      // `Text`'s `defaultSizeMode` is `contentHeight` (`text.ts:149-152`), which
      // still assigns `width` — and `width` defaults to **100 with defaultUnit `%`**
      // (`node-shared-port-definitions.ts:812-828`). `Layout.size` converts a
      // percentage *along* the parent's direction into `flexGrow`
      // (`layout.ts:83-88`), and this node's parent is `Site/Nav`'s `flexWrap: wrap`
      // ROW. So every link claimed a whole line and three links stacked: measured
      // nav 219px, links at y=37/99/161 (§8.2 arm A).
      //
      // `contentSize` assigns neither axis, which is the `width: auto` the control
      // arm restored. 🔴 **`flex-grow: 0` is NOT the lever** and §8.2 spent an arm
      // proving it: grow reads 0 in computed style with the stack still stacked,
      // because the width is what wraps, not the grow.
      sizeMode: 'contentSize',
      // ⚠️ **No `maxWidth` here, and that is a measurement rather than an
      // omission.** `contentSize` leaves the link unshrinkable (`Layout.size`
      // sets `flexShrink: 0` and only opts back in on the percentage paths it has
      // just stopped taking), so the obvious guard is `maxWidth: 100%` to keep a
      // very long page TITLE from running past a phone screen. It was authored,
      // driven, and **removed**: on a `Text` the parameter never reaches the DOM.
      // Measured on the claimed site at 360px, same page load: the link's
      // `getComputedStyle(...).maxWidth` reads **`none`** with the parameter set,
      // while `Page ground`'s `minHeight` and `Page shell`'s `maxWidth` — the same
      // port family, same `{ value, unit }` shape — both render on their `Group`s.
      // Shipping it would have been a parameter nothing reads.
      //
      // ✅ AC4 holds without it, and that was measured too rather than assumed: at
      // 360px with a 51-character title the link's box overhangs by 63px but
      // `documentElement.scrollLeft` stays **0** (control: a planted 2000px
      // element reads 1640), so the page does not scroll sideways — the long link
      // is clipped, the same shape as §8.5's admin button. Recorded as SBR-006's
      // rather than papered over here. See SBR-004 §9.3.
      // ⚠️ MARGIN, not padding. `Text` is given `addMarginInputs` and NOT
      // `addPaddingInputs` (`text.ts:149-158`), so a `paddingTop` here is a port
      // that does not exist — the door refuses it and the runtime would discard
      // it. The vertical step is what gives the bar its height either way.
      marginRight: 'var(--space-6)',
      marginTop: 'var(--space-2)',
      marginBottom: 'var(--space-2)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The page record',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'title', type: 'string', plug: 'output' },
      { name: 'slug', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'currentSlug',
    type: 'Variable2',
    label: 'Which slug the page is showing',
    // 🔴 SBR-004 AC2, and the reason it is a Variable rather than a component
    // input. A `For Each` sets `id` and **the model's own fields** and nothing
    // else (`foreach.tsx:586-597`) — the same limit SB-004 §5 recorded for `Run
    // Tasks` and this file already records for the contact form's `pageSlug`. So
    // the one value every link needs, and which is constant across them, cannot
    // arrive as a port on a repeated component. `/Pages/Site`'s `resolveSlug`
    // writes it (see `SITE_CURRENT_SLUG_VAR`); this node is how a link notices.
    parameters: { name: SITE_CURRENT_SLUG_VAR }
  },
  {
    id: 'linkState',
    type: 'JavaScriptFunction',
    label: 'Is this the page being read',
    parameters: {
      // 🔴 **Both boxes are written explicitly, and the reason is not the panel
      // default — it is a migration that fires on this very graph.** NDA-017 §2 made
      // "run on value change" default to ticked, and `runOnValueChange` reads an
      // absent key as ticked (`run-on-value-change.ts:178-181`), so leaving these
      // out ought to be the same as writing `true`. It is not.
      //
      // `applyPatches` runs {@link applyRunOnValueChangeMigration} on every project
      // load (`applypatches.js:71`), and its rule is: for any node in the fifteen
      // families whose **control signal is connected**, write
      // `runOnChange-<input>: false` for the value inputs that signal used to
      // silence. This node wires `run` (from `currentSlug.changed`, below), so the
      // migration writes `false` on `in-slug` and `in-current` — turning off the
      // one behaviour AC2 depends on. Measured on the shipped artefact: **37 nodes
      // in a freshly created project carry a migrated `false` and not one carries a
      // `true`** (SBR-004 §8.1). The migration is for pre-§2 graphs and cannot tell
      // this one from those, because the project format has nowhere to record that
      // it already ran — an open question §2 recorded and did not close.
      //
      // ✅ **An already-present key is never touched, whatever its value** (the
      // migration's idempotence clause), so writing `true` here is the one thing
      // that survives the load. Absent does not.
      //
      // 🔴 And both, not one. The three producers arrive in an order this node does
      // not control — `slug` from the `For Each`, `current` from the Variable, `run`
      // from the Variable's `changed`. With only `in-current` ticked, a `current`
      // that lands before `slug` hits the guard on the first line and nothing ever
      // runs the body again. Two ticked inputs changing in one frame still produce
      // ONE run (NDA-017 constraint 3), so this costs nothing.
      'runOnChange-in-slug': true,
      'runOnChange-in-current': true,

      // 🔴 Two producers, and the second one is not redundant. `changed` fires
      // when the variable is written from anywhere, which covers "the link
      // existed before the page resolved its slug". The direct read covers the
      // other order — a link created AFTER the write, where nothing changes
      // again and no signal is owed. Neither alone is both.
      //
      // 🔴 Guarded for a server render like every other code node in this file:
      // `createNoodlAPI` returns `{}` when there is no `window.Noodl`
      // (`javascriptnodeparser.js:497-501`).
      //
      // The two answers are tokens, not colours — `--primary` against
      // `--muted-foreground` is the current//not-current pair the theme record
      // re-themes for free, and the weight step is what carries the distinction
      // where colour alone would not (SBR-012's own rule, and AA contrast).
      functionScript:
        'if (Inputs.slug === undefined) return;\n' +
        'let current = Inputs.current;\n' +
        // The template's one `Noodl` guard idiom (`seo` uses the same shape):
        // `createNoodlAPI` returns `{}` rather than undefined, so testing the
        // object and the property is the whole check.
        'if (current === undefined && Noodl && Noodl.Variables) {\n' +
        '  current = Noodl.Variables[' + JSON.stringify(SITE_CURRENT_SLUG_VAR) + '];\n' +
        '}\n' +
        "const isCurrent = current !== undefined && current !== null && current !== '' && String(current) === String(Inputs.slug);\n" +
        "Outputs.color = isCurrent ? 'var(--primary)' : 'var(--muted-foreground)';\n" +
        "Outputs.weight = isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)';\n" +
        'Outputs.current = isCurrent;'
    }
  },
  {
    id: 'goPage',
    type: 'RouterNavigate',
    label: 'To that page',
    parameters: { router: ROUTER, target: SITE_PAGE }
  }
];

export const NAV_LINK_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'link', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'slug', toId: 'goPage', toProperty: 'pm-slug' },
  { fromId: 'link', fromProperty: 'onClick', toId: 'goPage', toProperty: 'navigate' },

  // SBR-004 AC2. The record's slug is what this link IS; the variable is what
  // the page is showing; the state node compares them and owns both style ports.
  { fromId: 'inputs', fromProperty: 'slug', toId: 'linkState', toProperty: 'in-slug' },
  { fromId: 'currentSlug', fromProperty: 'value', toId: 'linkState', toProperty: 'in-current' },
  { fromId: 'currentSlug', fromProperty: 'changed', toId: 'linkState', toProperty: 'run' },
  { fromId: 'linkState', fromProperty: 'out-color', toId: 'link', toProperty: 'color' },
  { fromId: 'linkState', fromProperty: 'out-weight', toId: 'link', toProperty: 'fontWeight' }
];

// ── 2. The five section kinds — one component each ───────────────────────────

/**
 * SBR-005. **A gallery looks like a gallery, a hero looks like a poster, and the
 * call-to-action button goes somewhere when clicked.**
 *
 * ## What was here before, and why one node could not become five things
 *
 * `Site/SectionView` used to be **one `Image` + one `Text`** and a script whose
 * whole vocabulary was `showImage` / `showBody` / `weight` / `size` / `family`.
 * Phase 81 photographed the result and filed it as **register V16**: *the four
 * section kinds are ONE layout — dispatch changes only fontWeight, fontSize,
 * fontFamily and image visibility; `cta` emits no button.* That is the same
 * finding as this task's §1, reached from the other side, and it is the reason
 * the fix is five components rather than five more branches in one script.
 *
 * 🔴 **The old comment blamed the wrong thing, and the phase's own rule says so.**
 * It read: *"What it renders is bounded by what the panel can write"* — the panel
 * edits `data.body` and `data.image`, so a section view reading `data.heading`
 * would be reading a field with no author. True when written, and it is an
 * [an AC parked on "why it cannot"] that expired the moment somebody was willing
 * to change the panel. SBR-005 AC5 asks for exactly that, end to end, so
 * `Admin/SectionRow` grows the fields and this file spends them.
 *
 * ## The kinds, and what each one actually is on the page
 *
 *   | kind       | the object on the page                                       |
 *   |------------|--------------------------------------------------------------|
 *   | `hero`     | a photograph under `--gradient-scrim` with display type on it |
 *   | `gallery`  | a wrapping grid of ≥2 crops, one row per pair                 |
 *   | `cta`      | a `--gradient-brand` band ending in a button that navigates   |
 *   | `richText` | body copy on the page ground — the old behaviour, restyled    |
 *   | `contact`  | an intro and the form card, with its success and refusal      |
 *
 * ## Five components, not five branches
 *
 * 🔴 **A component instance has only the ports its `Component Inputs` node
 * declares** — no layout, style or lifecycle ports of its own
 * (`instance-unknown-parameter`, blocking: *"The value is discarded"*). It
 * decides the shape here: **`mounted` cannot go on the instance**, so each kind
 * is placed inside a one-child `Group` that carries it. Five wrappers is the
 * price of the dispatch.
 *
 * ⚠️ `/Pages/Site` used to carry the same wrapper around `/Site/ContactForm` and
 * was the place this rule was written down. SBR-005 removed it — see the note
 * where it stood — so the rule lives here now.
 *
 * ⚠️ **`mounted`, never `visible`** (SBR-005 AC4, and the module header's rule).
 * An unmounted kind is *absent from the DOM*; a `visible: false` one would still
 * hold its band's height, which is the defect the header records `richText`
 * reserving 320px for an image it never draws.
 *
 * 🔴 **Every item component declares its ports.** Phase 81 register **V22**,
 * ruled by a render: a `Component Inputs` node with connections out of it but no
 * `ports` array passes every gate and **delivers nothing** — `foreach.tsx:595`
 * iterates `itemNode._inputs`, which is the *declared* inputs. The repeater still
 * draws the right number of rows, so the page keeps its shape and loses its
 * content. `Site/GalleryTile` is the node that would have been bitten.
 *
 * ## Where the look comes from
 *
 * Phase 81's kit, not a second palette. `backgroundImage` and
 * `backgroundGradient` compose into **one** `background-image` declaration with
 * the **gradient first** (`node-shared-port-definitions.ts:1645-1655`), which is
 * the whole hero-over-a-photograph problem solved on one node instead of an
 * absolutely-positioned stack. `--display-sm` is a `clamp()` token, so the hero
 * headline scales with the viewport without a viewport-aware port existing.
 *
 * ⚠️ **`--gradient-scrim` is the one gradient token NOT written in terms of other
 * tokens** — it is a fixed black wash, by design, because a scrim's job is to
 * darken whatever photograph is under it. The corpus pairs it with
 * `var(--primary-foreground)` for the text (`ui-image-scrim-band`), and this
 * template follows the corpus rather than minting a rule of its own. But a site
 * `Theme` record can set `colorOnPrimary` to a **dark** value — the shipped
 * `night` preset does (`#191713`) — and dark text on a black scrim is
 * unreadable. That is measured, not assumed: `sbr005-sections.look.ts` reads the
 * rendered contrast at all three presets and the finding is filed where it lands.
 */

/**
 * The five kinds, in the order a page most often uses them.
 *
 * 🔴 Single-sourced in `sb005Components.ts` and re-exported here, exactly as
 * `SECTION_SORT` is and for the same reason: the panel's kind picker and this
 * file's dispatch script must be the same list, or an author can create a kind
 * the site cannot draw. `sbr005Sections.test.ts` asserts both name every member.
 */
export { SECTION_KINDS, DEFAULT_SECTION_KIND, SECTION_KIND_LABELS } from './sb005Components';
export type { SectionKind } from './sb005Components';

// ── 2a. Site/HeroSection — a photograph you can read words off ───────────────

/**
 * The poster.
 *
 * 🔴 **No code node here, and that is deliberate.** Everything conditional is
 * computed once in `Site/SectionView`'s dispatch script and arrives as a port,
 * so a kind component is a *layout* and nothing else. A second script per kind
 * would be five more places for the `richText`-reserves-320px class of defect to
 * live.
 *
 * ⚠️ **`sizeMode: contentHeight` and generous padding, rather than an explicit
 * height with `justifyContent: flex-end`.** The corpus recipe uses the second
 * form and phase 81 register **V17** is a session that shipped its failure mode
 * *after reading the diagnosis of it*: a shell with no `sizeMode` becomes
 * `flexGrow: 100`, fills the band, and the band's `justifyContent` has nothing
 * left to justify — copy at the top, empty photograph beneath. A band sized by
 * what is in it cannot have that defect at all, which is the cheaper answer
 * inside a 44rem measure.
 *
 * ⚠️ `backgroundColor` is the ground for a hero whose record has **no** picture.
 * Register **V33**'s exemption is the sanctioned reading: *a scrim over nothing
 * is still a designed ground*, so an empty `backgroundImage` here is not the
 * `unsourced-image` defect.
 */
export const HERO_SECTION_NODES = [
  {
    id: 'band',
    type: 'Group',
    label: 'Hero band',
    parameters: {
      ...STACKED_IN_A_COLUMN,
      flexDirection: 'column',
      rowGap: 'var(--space-3)',
      paddingTop: 'var(--space-16)',
      paddingBottom: 'var(--space-8)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      // The gradient paints OVER the picture — one declaration, gradient first.
      backgroundGradient: 'var(--gradient-scrim)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      // The ground under the scrim when the section carries no photograph.
      backgroundColor: 'var(--foreground)',
      borderRadius: 'var(--radius-md)'
    },
    children: ['heading', 'sub']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Hero heading',
    parent: 'band',
    // SB-018 (3): a standing `text`, because `Text` declares `default: 'Text'`
    // and a node whose only `text` is a wire renders the literal word until that
    // wire publishes.
    //
    // `--display-sm` is one of VIB-002's three fluid tokens — a `clamp()` whose
    // value goes verbatim into `:root`, so the headline scales 30px→48px with
    // the viewport and no responsive `fontSize` port has to exist.
    parameters: {
      as: 'h2',
      text: '',
      fontSize: 'var(--display-sm)',
      fontFamily: 'var(--font-serif)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'sub',
    type: 'Text',
    label: 'Hero sub-heading',
    parent: 'band',
    parameters: {
      as: 'p',
      mounted: false,
      text: '',
      fontSize: 'var(--text-lg)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What this hero shows',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'body', type: 'string', plug: 'output' },
      { name: 'showBody', type: 'boolean', plug: 'output' },
      { name: 'image', type: 'string', plug: 'output' }
    ]
  }
];

export const HERO_SECTION_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'sub', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showBody', toId: 'sub', toProperty: 'mounted' },
  { fromId: 'inputs', fromProperty: 'image', toId: 'band', toProperty: 'backgroundImage' }
];

// ── 2b. Site/GalleryTile — one crop in the grid ──────────────────────────────

/**
 * 🔴 **The port list below is the whole component.** Register **V22**: a
 * `Component Inputs` with no `ports` array passes `catalog:examples` strict and
 * every value an instance sets is discarded, because `foreach.tsx:595` iterates
 * the node's **declared** inputs. A gallery built that way draws the right
 * number of tiles and every one of them is empty — the shape survives and the
 * content does not, which is why no structural check would have caught it.
 *
 * ⚠️ **The width lives here, not on the instance.** A component instance takes
 * only its declared ports, so the tile's own root is the only node that can say
 * how wide a tile is. 48% + 48% + a `--space-3` gutter is two per row inside the
 * 44rem measure and one per row on a phone, with no media query and no
 * `Columns` node (whose `marginX` silently drops a `var()` — register **V28**).
 */
export const GALLERY_TILE_NODES = [
  {
    id: 'tile',
    type: 'Image',
    label: 'Gallery tile',
    // `sizeMode: 'explicit'` is not decoration: the door refuses `objectFit`
    // without it (`inert-dimension`, blocking), and a bare number on a dimension
    // port reads as a **percentage** (`unitless-dimension`).
    parameters: {
      sizeMode: 'explicit',
      objectFit: 'cover',
      width: { value: 48, unit: '%' },
      height: { value: 180, unit: 'px' },
      borderRadius: 'var(--radius-md)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'One image of the gallery',
    // The field name is the one `data.images` rows carry, because `For Each`
    // matches a model's own field names against the declared port names
    // (`foreach.tsx:595-597`).
    ports: [{ name: 'url', type: 'string', plug: 'output' }]
  }
];

export const GALLERY_TILE_WIRES = [{ fromId: 'inputs', fromProperty: 'url', toId: 'tile', toProperty: 'src' }];

// ── 2c. Site/GallerySection — more than one picture, in a grid ───────────────

/**
 * The kind the old view could not be: `data.image` is **one** reference, and a
 * gallery of one image is a photograph with a caption missing.
 *
 * 🔴 **The data-model half is `data.images`, an ordered array on the same
 * record** — not a `SectionImage` class. SBR-005 AC5 asks that the ACL treatment
 * *match the existing image path*, and the way to guarantee that is to put the
 * new pictures **where the old one already is**: inside the `Section` record's
 * own `data` column, under the `Section` row's own ACL. A second class would be
 * a second policy to keep in step, and SB-004 §4's rules would have to grow a
 * fourth entry that nothing but a gallery ever reads.
 *
 * ⚠️ A plain array is a legitimate `items` value — `foreach.tsx:137-140`, *"may
 * be a plain array"* — so no `Static Data` node and no model plumbing is needed
 * between the record and the grid.
 */
export const GALLERY_SECTION_NODES = [
  {
    id: 'band',
    type: 'Group',
    label: 'Gallery band',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['heading', 'grid']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Gallery heading',
    parent: 'band',
    parameters: {
      as: 'h2',
      mounted: false,
      text: '',
      fontSize: 'var(--text-2xl)',
      fontFamily: 'var(--font-serif)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'grid',
    type: 'Group',
    label: 'Gallery grid',
    parent: 'band',
    // A wrapping row rather than a column: the tiles are 48% wide, so the wrap
    // IS the grid. `Site/Nav` lays its links out the same way and for the same
    // reason — a row that must run onto a second line rather than off the screen.
    parameters: {
      ...STACKED_IN_A_COLUMN,
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)'
    },
    children: ['tiles']
  },
  {
    id: 'tiles',
    type: 'For Each',
    label: 'One tile per image',
    parent: 'grid',
    parameters: { templateType: 'explicit', template: '/Site/GalleryTile' }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What this gallery shows',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'showHeading', type: 'boolean', plug: 'output' },
      { name: 'images', type: '*', plug: 'output' }
    ]
  }
];

export const GALLERY_SECTION_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showHeading', toId: 'heading', toProperty: 'mounted' },
  { fromId: 'inputs', fromProperty: 'images', toId: 'tiles', toProperty: 'items' }
];

// ── 2d. Site/CtaSection — the band that goes somewhere ───────────────────────

/**
 * SBR-005 AC2, and the half of register **V16** that named a missing node
 * outright: *`cta` emits no button.*
 *
 * 🔴 **The destination exists now, and the mechanism is the one the nav already
 * uses.** `Site/NavLink` navigates with a `RouterNavigate` at `target:
 * SITE_PAGE` carrying `pm-slug`, because the public site is one catch-all page
 * component at `{slug}` — so "go to the about page" *is* "navigate to
 * `/Pages/Site` with slug `about`". A CTA pointing at a slug is that same call
 * with the slug coming out of the record instead of out of a nav row.
 *
 * ⚠️ **An external target is a different act and cannot use the router at all.**
 * `RouterNavigate.target` names a component; an `https://` string is not one, and
 * aiming it there is the `unresolved-navigation` refusal. So `route` below
 * branches: an absolute URL leaves through `window.open`, anything else is a
 * slug. That is the *only* code node in the five kinds, and it is here because
 * the branch is genuinely a decision and not a style.
 *
 * 🔴 **The value is set before the signal fires, and that ordering is load-
 * bearing.** `Outputs.slug = …` then `Outputs.go()`: both go through the
 * receiver's input queue and `Node.update` drains one entry per input name in a
 * single pass (`outputproperty.ts:141-210`, `node.ts:626-656`), so a `navigate`
 * that arrived before its `pm-slug` would route to the *previous* slug. The
 * module header records the same rule for `Query Records`, and `Admin/SectionRow`'s
 * `merge` is built to it.
 *
 * ⚠️ **`window` is guarded.** This is the template most likely to be deployed
 * server-rendered — it is the SEO surface — and an unguarded `window` in a code
 * node takes the whole server render with it (`javascriptnodeparser.js:497-501`).
 */
export const CTA_SECTION_NODES = [
  {
    id: 'band',
    type: 'Group',
    label: 'Call to action band',
    parameters: {
      ...STACKED_IN_A_COLUMN,
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-4)',
      paddingTop: 'var(--space-10)',
      paddingBottom: 'var(--space-10)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      // A themed gradient: every stop is another token, so the band follows the
      // Theme record through every preset instead of freezing one palette.
      backgroundGradient: 'var(--gradient-brand)',
      backgroundColor: 'var(--primary)',
      borderRadius: 'var(--radius-md)'
    },
    children: ['heading', 'body', 'button']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Call to action heading',
    parent: 'band',
    parameters: {
      as: 'h2',
      text: '',
      fontSize: 'var(--text-3xl)',
      fontFamily: 'var(--font-serif)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'body',
    type: 'Text',
    label: 'Call to action body',
    parent: 'band',
    parameters: {
      as: 'p',
      mounted: false,
      text: '',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'button',
    type: 'net.noodl.controls.button',
    label: 'Call to action button',
    parent: 'band',
    // The button is a visual node, so `mounted` is its own port — no wrapper
    // Group is needed here. The five wrappers above need one each because they
    // wrap a *component instance*, which has only its declared ports.
    //
    // The surface colours are the inverse of the band: a light chip on a brand
    // gradient is the one thing on the band a visitor is meant to press.
    parameters: {
      mounted: false,
      label: '',
      backgroundColor: 'var(--primary-foreground)',
      color: 'var(--primary)',
      fontWeight: 'var(--font-semibold)',
      borderRadius: 'var(--radius-md)',
      // REL-011a. The one control that was dressed, and the one port it was
      // missing: `.ndl-controls-button` inherits the project's family but, by
      // that stylesheet's own decision, not its size — so the CTA's label sat at
      // the user agent's ~13px on a band whose heading is `--text-4xl`.
      fontSize: 'var(--text-base)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What this call to action says and where it goes',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'body', type: 'string', plug: 'output' },
      { name: 'showBody', type: 'boolean', plug: 'output' },
      { name: 'linkLabel', type: 'string', plug: 'output' },
      { name: 'showLink', type: 'boolean', plug: 'output' },
      { name: 'linkTarget', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'route',
    type: 'JavaScriptFunction',
    label: 'Slug or the open web',
    // Rule 1: an undeclared signal output is dead once this bundle is served
    // without an editor attached (SB-004 F10).
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      // Rule 2's guard. `linkTarget` arrives on load and the click arrives
      // later, so this node must not act on the value alone — `run` is the only
      // trigger and the target is held until it comes.
      'runOnChange-in-target': false,
      functionScript:
        "const target = (Inputs.target || '').trim();\n" +
        "if (target === '') return;\n" +
        "if (/^https?:\\/\\//i.test(target)) {\n" +
        // A guarded `window`: the SSR/SSG entries render this bundle with no
        // document, and an unguarded reference throws on the server.
        "  if (typeof window !== 'undefined' && window.open) {\n" +
        "    window.open(target, '_blank', 'noopener');\n" +
        '  }\n' +
        '  return;\n' +
        '}\n' +
        // The value first, then the signal — see the note above this node.
        'Outputs.slug = target;\n' +
        'Outputs.go();'
    }
  },
  {
    id: 'goPage',
    type: 'RouterNavigate',
    label: 'To that page',
    parameters: { router: ROUTER, target: SITE_PAGE }
  }
];

export const CTA_SECTION_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'body', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showBody', toId: 'body', toProperty: 'mounted' },
  { fromId: 'inputs', fromProperty: 'linkLabel', toId: 'button', toProperty: 'label' },
  { fromId: 'inputs', fromProperty: 'showLink', toId: 'button', toProperty: 'mounted' },

  { fromId: 'inputs', fromProperty: 'linkTarget', toId: 'route', toProperty: 'in-target' },
  { fromId: 'button', fromProperty: 'onClick', toId: 'route', toProperty: 'run' },
  { fromId: 'route', fromProperty: 'out-slug', toId: 'goPage', toProperty: 'pm-slug' },
  { fromId: 'route', fromProperty: 'out-go', toId: 'goPage', toProperty: 'navigate' }
];

// ── 2e. Site/RichTextSection — the kind that was already right ───────────────

/**
 * The old behaviour, kept, and restyled under the tokens.
 *
 * ⚠️ **It gains a heading and loses nothing.** The old single view set
 * `fontWeight` / `fontSize` / `fontFamily` from the dispatch script on one `Text`
 * — which is register **V16**'s sentence exactly: *dispatch changes only
 * fontWeight, fontSize and fontFamily.* Here the values are authored, because
 * this kind's type ramp is a constant and a kind that no longer has to
 * impersonate a hero has no reason to compute one.
 */
export const RICH_TEXT_SECTION_NODES = [
  {
    id: 'band',
    type: 'Group',
    label: 'Rich text band',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', rowGap: 'var(--space-3)' },
    children: ['heading', 'body']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Rich text heading',
    parent: 'band',
    parameters: {
      as: 'h2',
      mounted: false,
      text: '',
      fontSize: 'var(--text-2xl)',
      fontFamily: 'var(--font-serif)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'body',
    type: 'Text',
    label: 'Rich text body',
    parent: 'band',
    parameters: {
      as: 'p',
      text: '',
      fontSize: 'var(--text-base)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--font-normal)',
      color: 'var(--foreground)',
      lineHeight: 'var(--leading-relaxed)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What this passage shows',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'showHeading', type: 'boolean', plug: 'output' },
      { name: 'body', type: 'string', plug: 'output' }
    ]
  }
];

export const RICH_TEXT_SECTION_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showHeading', toId: 'heading', toProperty: 'mounted' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'body', toProperty: 'text' }
];

// ── 2f. Site/ContactSection — the intro, and the form under it ───────────────

/**
 * 🔴 **This component exists because a documented "cannot" had expired, and the
 * refutation was eleven nodes up its own file.**
 *
 * The old note on `Site/SectionView` said the contact form *"is not here, and
 * that is the second half of a measurement rather than a layout preference:
 * `submitContactForm` takes a `pageSlug`, and a repeater item cannot be given a
 * value that is constant across items"* — `For Each` sets `id` and the model's
 * own fields and nothing else (`foreach.tsx:586-597`). Every word of that is
 * still true. What it does not follow from is *"so the form cannot live in a
 * section"*, because **SBR-004 already solved the identical problem for
 * `Site/NavLink`**: a value constant across repeated items reaches them through
 * `Noodl.Variables`, not through a port. `SITE_CURRENT_SLUG_VAR` is written once
 * by `/Pages/Site` and read by a `Variable2` node inside the repeated component.
 *
 * That is [an AC parked on "why it cannot" expires] with the fix sitting in the
 * same file as the excuse. The `Variable2` below is the whole of it.
 *
 * ⚠️ **`/Pages/Site`'s page-level contact form stays.** It is SBR-006's artefact,
 * driven by `Page.showContact`, and removing it is not this task's to do. An
 * author who turns the page toggle on *and* adds a `contact` section gets two
 * forms — a real wart, filed as a register row with an owner rather than fixed
 * by reaching into a neighbouring task's component.
 */
export const CONTACT_SECTION_NODES = [
  {
    id: 'band',
    type: 'Group',
    label: 'Contact band',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['heading', 'body', 'form']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Contact heading',
    parent: 'band',
    parameters: {
      as: 'h2',
      mounted: false,
      text: '',
      fontSize: 'var(--text-2xl)',
      fontFamily: 'var(--font-serif)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'body',
    type: 'Text',
    label: 'Contact intro',
    parent: 'band',
    parameters: {
      as: 'p',
      mounted: false,
      text: '',
      fontSize: 'var(--text-base)',
      color: 'var(--foreground)',
      lineHeight: 'var(--leading-relaxed)'
    }
  },
  { id: 'form', type: '/Site/ContactForm', label: 'The form itself', parent: 'band' },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What this contact section says',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'showHeading', type: 'boolean', plug: 'output' },
      { name: 'body', type: 'string', plug: 'output' },
      { name: 'showBody', type: 'boolean', plug: 'output' }
    ]
  },
  {
    id: 'currentSlug',
    type: 'Variable2',
    label: 'Which slug this form is on',
    // The value a repeater cannot carry as a port, read the way `Site/NavLink`
    // reads it. `/Pages/Site` writes this variable when its page query answers.
    parameters: { name: SITE_CURRENT_SLUG_VAR }
  }
];

export const CONTACT_SECTION_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showHeading', toId: 'heading', toProperty: 'mounted' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'body', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'showBody', toId: 'body', toProperty: 'mounted' },
  { fromId: 'currentSlug', fromProperty: 'value', toId: 'form', toProperty: 'pageSlug' }
];

// ── 2g. Site/SectionView — which of the five this row is ─────────────────────

/**
 * One section of the page being read, dispatched to one of the five kinds.
 *
 * 🔴 **What this component is now: a switch and five wrappers.** It draws
 * nothing itself. `unpack` reads the record once and publishes both halves of
 * the answer — *which kind* (five booleans onto five `mounted` ports) and *what
 * that kind needs* (the fields, already defaulted and already emptiness-tested).
 *
 * ⚠️ **The five booleans are mutually exclusive by construction**, and the spec
 * asserts it rather than trusting the script: exactly one is true for every kind
 * in `SECTION_KINDS`, and exactly one is true for a kind nobody has heard of
 * (`richText`, the documented fallback). Two true at once is two bands stacked
 * where the author asked for one, which is a defect nothing else would catch.
 *
 * 🔴 **`data` is read defensively at every level.** A `Section` written before
 * SBR-005 has no `heading`, no `images` and no `linkTarget`, and the site must
 * render it as the `richText` it has always been rather than as a hole. Every
 * new field is optional and every read has a floor.
 */
export const SECTION_VIEW_NODES = [
  {
    id: 'section',
    type: 'Group',
    label: 'One section',
    // `as: 'section'` — this is the public HTML, and a site made of `div`s is
    // the thing a client's SEO consultant will complain about first.
    // SBR-004: the rhythm between sections is two steps of the spacing scale.
    parameters: {
      ...STACKED_IN_A_COLUMN,
      as: 'section',
      flexDirection: 'column',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)'
    },
    children: ['heroWrap', 'galleryWrap', 'ctaWrap', 'richWrap', 'contactWrap']
  },

  // 🔴 The five wrappers. `mounted` cannot go on a component instance — an
  // instance has only the ports its `Component Inputs` declares
  // (`instance-unknown-parameter`, blocking) — so the switch lands on a Group
  // holding one instance each — the rule is stated in full in this component's
  // own header.
  {
    id: 'heroWrap',
    type: 'Group',
    label: 'Hero, when this section is one',
    parent: 'section',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', mounted: false },
    children: ['hero']
  },
  { id: 'hero', type: '/Site/HeroSection', label: 'Hero', parent: 'heroWrap' },
  {
    id: 'galleryWrap',
    type: 'Group',
    label: 'Gallery, when this section is one',
    parent: 'section',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', mounted: false },
    children: ['gallery']
  },
  { id: 'gallery', type: '/Site/GallerySection', label: 'Gallery', parent: 'galleryWrap' },
  {
    id: 'ctaWrap',
    type: 'Group',
    label: 'Call to action, when this section is one',
    parent: 'section',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', mounted: false },
    children: ['cta']
  },
  { id: 'cta', type: '/Site/CtaSection', label: 'Call to action', parent: 'ctaWrap' },
  {
    id: 'richWrap',
    type: 'Group',
    label: 'Passage, when this section is one',
    parent: 'section',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', mounted: false },
    children: ['rich']
  },
  { id: 'rich', type: '/Site/RichTextSection', label: 'Passage', parent: 'richWrap' },
  {
    id: 'contactWrap',
    type: 'Group',
    label: 'Contact, when this section is one',
    parent: 'section',
    parameters: { ...STACKED_IN_A_COLUMN, flexDirection: 'column', mounted: false },
    children: ['contact']
  },
  { id: 'contact', type: '/Site/ContactSection', label: 'Contact', parent: 'contactWrap' },

  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The section record',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'kind', type: 'string', plug: 'output' },
      { name: 'order', type: 'number', plug: 'output' },
      { name: 'data', type: '*', plug: 'output' }
    ]
  },
  {
    id: 'unpack',
    type: 'JavaScriptFunction',
    label: 'Which kind this is, and what it needs',
    parameters: {
      // No custom signal outputs, so rule 1 has nothing to declare here.
      //
      // The five `show*` booleans are computed rather than wired from `Condition`
      // nodes because the answer depends on the kind AND on whether the field is
      // filled — an empty `body` on a hero should leave no empty paragraph behind,
      // and an empty `images` array should not draw a heading over nothing.
      //
      // A `cloudfile` renders through its `url`; an unset one must not reach an
      // Image's `src`, or a Group's `backgroundImage`, as the string "undefined".
      functionScript:
        "const kind = Inputs.kind || " +
        JSON.stringify(DEFAULT_SECTION_KIND) +
        ';\n' +
        'const d = Inputs.data || {};\n' +
        "const heading = d.heading || '';\n" +
        "const body = d.body || '';\n" +
        "const image = (d.image && d.image.url) || '';\n" +
        // Only rows carrying a usable url survive: a half-uploaded entry would
        // otherwise draw an empty tile that looks exactly like a broken picture.
        'const images = (Array.isArray(d.images) ? d.images : [])\n' +
        "  .map(function (row) { return { url: (row && (row.url || (row.image && row.image.url))) || '' }; })\n" +
        "  .filter(function (row) { return row.url !== ''; });\n" +
        "const linkLabel = d.linkLabel || '';\n" +
        "const linkTarget = d.linkTarget || '';\n" +
        '\n' +
        // 🔴 Exactly one of the five, always. An unknown kind falls back to the
        // one that renders any record at all rather than to nothing.
        "const known = " +
        JSON.stringify(SECTION_KINDS as unknown as string[]) +
        ';\n' +
        'const k = known.indexOf(kind) === -1 ? ' +
        JSON.stringify(DEFAULT_SECTION_KIND) +
        ' : kind;\n' +
        "Outputs.isHero = k === 'hero';\n" +
        "Outputs.isGallery = k === 'gallery';\n" +
        "Outputs.isCta = k === 'cta';\n" +
        "Outputs.isRichText = k === 'richText';\n" +
        "Outputs.isContact = k === 'contact';\n" +
        '\n' +
        'Outputs.heading = heading;\n' +
        "Outputs.showHeading = heading !== '';\n" +
        'Outputs.body = body;\n' +
        "Outputs.showBody = body !== '';\n" +
        'Outputs.image = image;\n' +
        'Outputs.images = images;\n' +
        'Outputs.linkLabel = linkLabel;\n' +
        // The button is the CTA's whole point, so it needs both halves: a label
        // to press and somewhere to land. Either one missing is no button.
        "Outputs.showLink = linkLabel !== '' && linkTarget !== '';\n" +
        'Outputs.linkTarget = linkTarget;'
    }
  }
];

export const SECTION_VIEW_WIRES = [
  { fromId: 'inputs', fromProperty: 'kind', toId: 'unpack', toProperty: 'in-kind' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'unpack', toProperty: 'in-data' },

  // The switch — five booleans onto five wrappers, never onto an instance.
  { fromId: 'unpack', fromProperty: 'out-isHero', toId: 'heroWrap', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isGallery', toId: 'galleryWrap', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isCta', toId: 'ctaWrap', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isRichText', toId: 'richWrap', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isContact', toId: 'contactWrap', toProperty: 'mounted' },

  // Hero
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'hero', toProperty: 'heading' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'hero', toProperty: 'body' },
  { fromId: 'unpack', fromProperty: 'out-showBody', toId: 'hero', toProperty: 'showBody' },
  { fromId: 'unpack', fromProperty: 'out-image', toId: 'hero', toProperty: 'image' },

  // Gallery
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'gallery', toProperty: 'heading' },
  { fromId: 'unpack', fromProperty: 'out-showHeading', toId: 'gallery', toProperty: 'showHeading' },
  { fromId: 'unpack', fromProperty: 'out-images', toId: 'gallery', toProperty: 'images' },

  // Call to action
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'cta', toProperty: 'heading' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'cta', toProperty: 'body' },
  { fromId: 'unpack', fromProperty: 'out-showBody', toId: 'cta', toProperty: 'showBody' },
  { fromId: 'unpack', fromProperty: 'out-linkLabel', toId: 'cta', toProperty: 'linkLabel' },
  { fromId: 'unpack', fromProperty: 'out-showLink', toId: 'cta', toProperty: 'showLink' },
  { fromId: 'unpack', fromProperty: 'out-linkTarget', toId: 'cta', toProperty: 'linkTarget' },

  // Passage
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'rich', toProperty: 'heading' },
  { fromId: 'unpack', fromProperty: 'out-showHeading', toId: 'rich', toProperty: 'showHeading' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'rich', toProperty: 'body' },

  // Contact
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'contact', toProperty: 'heading' },
  { fromId: 'unpack', fromProperty: 'out-showHeading', toId: 'contact', toProperty: 'showHeading' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'contact', toProperty: 'body' },
  { fromId: 'unpack', fromProperty: 'out-showBody', toId: 'contact', toProperty: 'showBody' }
];

// ── 3. Site/ContactForm — the one surface a visitor writes through ───────────

/**
 * SB-004 §5's public endpoint, from the outside.
 *
 * 🔴 **`ContactMessage.create` is `nobody`** (SB-004 §4), so this form cannot be
 * a `Create Record` and there is nothing to decide: the only door is the cloud
 * function, which runs as system and is the one authority that writes the class.
 * A `NewDbModelProperties` here would be refused by the backend at run time and
 * accepted by every gate, so its **absence is asserted** rather than assumed.
 *
 * ⚠️ **F8 is Richard's and it is about the recipient, not about this form.**
 * `site/ContactRecipient` currently prefers a `SiteSettings` field over a
 * `Secret`, and `SiteSettings` is world-readable — so where the mail *goes* is
 * unresolved. Nothing on this side names a recipient, so the browser half is not
 * blocked by it; what F8 blocks is the claim that a submitted message reaches
 * anyone, which is SB-004 §7's territory and still open.
 *
 * The two answers are constants, and there is only one of each. A form that told
 * a rejected address apart from a failed send would be reporting the backend's
 * internals to an anonymous caller for no gain to the visitor.
 */
export const CONTACT_FORM_NODES = [
  {
    id: 'form',
    type: 'Group',
    label: 'Contact form',
    // SBR-004: the form is the one card on the page — a raised surface with the
    // shared border and radius, so it reads as a thing you fill in rather than
    // as more of the article. Every value is a token, `--surface` included, so
    // the card follows the Theme record like everything else.
    parameters: {
      // AC1 half B — see `STACKED_IN_A_COLUMN`.
      ...STACKED_IN_A_COLUMN,
      as: 'section',
      flexDirection: 'column',
      rowGap: 'var(--space-3)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)'
    },
    // 🔴 REL-011c residual 2: no `heading` here. The card used to open with a
    // fixed `h2` reading "Get in touch", one line below `Site/ContactSection`'s
    // own heading — which is the one the AUTHOR writes, and which a person
    // naturally fills in with those same three words. The photograph of
    // `/contact-only` showed them stacked
    // (`sbr-005/2026-09-03/site-builder-living/kind-contact-*`). An unauthorable
    // second heading is the defect: the section already carries a heading slot,
    // mounted on `showHeading` when the record has one, so the card's job is the
    // fields. A contact section left without a heading now shows the card with
    // no title, which is what "no heading" asks for.
    children: ['nameField', 'emailField', 'messageField', 'sendButton', 'sent', 'refused']
  },
  {
    id: 'nameField',
    type: 'net.noodl.controls.textinput',
    label: 'Your name',
    parent: 'form',
    parameters: { ...FIELD, useLabel: true, label: 'Your name' }
  },
  {
    id: 'emailField',
    type: 'net.noodl.controls.textinput',
    label: 'Your email',
    parent: 'form',
    parameters: { ...FIELD, useLabel: true, label: 'Your email', type: 'email' }
  },
  {
    id: 'messageField',
    type: 'net.noodl.controls.textinput',
    label: 'Your message',
    parent: 'form',
    parameters: { ...FIELD, useLabel: true, label: 'Your message', type: 'textArea' }
  },
  {
    id: 'sendButton',
    type: 'net.noodl.controls.button',
    label: 'Send',
    parent: 'form',
    parameters: { ...PRIMARY_BUTTON, label: 'Send' }
  },
  {
    id: 'sent',
    type: 'Text',
    label: 'The one confirmation',
    parent: 'form',
    // SBR-004: both answers are `--foreground` and not a green/red pair. The
    // vocabulary's `--destructive` would be a second palette on a page whose
    // whole colour story is one primary, and a refusal a visitor can do nothing
    // about does not earn an alarm colour.
    parameters: {
      text: CONTACT_SUCCESS_TEXT,
      mounted: false,
      color: 'var(--foreground)',
      fontSize: 'var(--text-sm)'
    }
  },
  {
    id: 'refused',
    type: 'Text',
    label: 'The one refusal',
    parent: 'form',
    parameters: {
      text: CONTACT_REFUSAL_TEXT,
      mounted: false,
      color: 'var(--foreground)',
      fontSize: 'var(--text-sm)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'Which page this was sent from',
    // The value a repeater cannot carry, handed over by the page instead.
    ports: [{ name: 'pageSlug', type: 'string', plug: 'output' }]
  },
  {
    id: 'gather',
    type: 'JavaScriptFunction',
    label: 'Hold the message until it is complete',
    // Rule 1: `Outputs.go()` is dead once this bundle is served without an
    // editor attached unless the port is declared (SB-004 F10).
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 **D41. THE FORM USED TO SEND ITSELF, AND THE SENTENCE THAT STOOD HERE
      // IS WHAT MADE IT.**
      //
      // It read: *"Returning is safe — `runOnValueChange` defaults to ticked, so
      // a late value re-runs it."* Every word true, and it is an argument for
      // re-running the **guard**, not for re-running the **send**. This node's
      // last statement is `Outputs.go()`, wired to `send.call` — so the moment
      // the third field stopped being empty, the cloud function was called with
      // nobody having pressed anything, and every keystroke after that called it
      // again. A visitor typing a forty-character message posts forty enquiries.
      //
      // Measured, anonymously, in a real browser (`sbr005-sections.look.ts`):
      // three fields filled, **nothing clicked**, and the page already said
      // *"Thanks — your message has been sent."*
      //
      // ⚠️ It is the third unstated-`runOnChange` defect in this template
      // (**D31** on `/Admin/SectionRow`, **D39** two nodes below this one) and
      // the second in THIS component. `sb007Template.test.ts` listed all four of
      // these inputs in its `runsOnValue` population for five sessions; that
      // census grades *write-back cycles*, and a node that calls a cloud function
      // writes nothing it reads, so it was correctly silent.
      //
      // `sendButton.onClick` is the only trigger now, which is what a Send button
      // is. The guard below is unchanged and still does its job: it runs on the
      // press, and refuses an incomplete form.
      'runOnChange-in-name': false,
      'runOnChange-in-email': false,
      'runOnChange-in-message': false,
      'runOnChange-in-pageSlug': false,
      // Rule 2's guard, and here it is also the validation: five producers reach
      // this node (four fields and the page), and an empty submission is a row
      // in someone's inbox that nobody meant to send.
      functionScript:
        'const name = Inputs.name || "";\n' +
        'const email = Inputs.email || "";\n' +
        'const message = Inputs.message || "";\n' +
        "if (name === '' || email === '' || message === '') return;\n" +
        'Outputs.name = name;\n' +
        'Outputs.email = email;\n' +
        'Outputs.message = message;\n' +
        "Outputs.pageSlug = Inputs.pageSlug || '';\n" +
        'Outputs.go();'
    }
  },
  {
    id: 'send',
    type: 'CloudFunction2',
    label: 'submitContactForm',
    parameters: { function: FN_CONTACT }
  },
  // 🔴 **BOTH ANSWERS WERE ON THE PAGE BEFORE ANYBODY PRESSED SEND, AND ONLY A
  // BROWSER COULD SAY SO — D39.**
  //
  // These two gates existed with `condition: true` and no `runOnChange-condition`
  // key. Absent reads as **ticked** (`run-on-value-change.ts:178-181`), so the
  // parameter's own value lands at load, the Condition evaluates, publishes
  // `result: true`, and BOTH `mounted` wires fire. Every visitor to every page
  // with a contact form read *"Thanks — your message has been sent."* and *"That
  // message could not be sent."* stacked under the Send button, before typing a
  // word.
  //
  // ⚠️ **Every gate in the repository was green**, and they are the gates that
  // look like they cover exactly this: `sb006PublicSite.test.ts` asserts both
  // Texts are authored `mounted: false` AND wired to a decider — true, and beside
  // the point, because an authored default only stands *until something
  // publishes*. The module header says so in its own words about `isEmpty`; what
  // nothing checked was whether the decider publishes on load.
  //
  // 🔴 It is the same family as **D14** (a gate that fires on load rather than on
  // the act) and the same family as **D31** three components away — an unstated
  // `runOnChange-*` doing something nobody asked for — and it survived every
  // session of this phase because **the contact form had never been driven**.
  // SBR-005 AC3 is the first acceptance criterion that submits the form.
  //
  // `false` on both: `eval` is the only trigger, which is what the `send.done` /
  // `send.failure` wires below already are.
  {
    id: 'sentGate',
    type: 'Condition',
    label: 'Show the confirmation',
    parameters: { condition: true, 'runOnChange-condition': false }
  },
  {
    id: 'refusedGate',
    type: 'Condition',
    label: 'Show the refusal',
    parameters: { condition: true, 'runOnChange-condition': false }
  }
];

export const CONTACT_FORM_WIRES = [
  { fromId: 'nameField', fromProperty: 'onTextChanged', toId: 'gather', toProperty: 'in-name' },
  { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'gather', toProperty: 'in-email' },
  { fromId: 'messageField', fromProperty: 'onTextChanged', toId: 'gather', toProperty: 'in-message' },
  { fromId: 'inputs', fromProperty: 'pageSlug', toId: 'gather', toProperty: 'in-pageSlug' },
  { fromId: 'sendButton', fromProperty: 'onClick', toId: 'gather', toProperty: 'run' },

  // Every value and the trigger leave from one node in one pass, and
  // `scheduleCall` defers the request until this node's inputs have drained
  // (`cloudfunction2.ts:225-236`) — see the module header on rule 2.
  { fromId: 'gather', fromProperty: 'out-name', toId: 'send', toProperty: 'in-name' },
  { fromId: 'gather', fromProperty: 'out-email', toId: 'send', toProperty: 'in-email' },
  { fromId: 'gather', fromProperty: 'out-message', toId: 'send', toProperty: 'in-message' },
  { fromId: 'gather', fromProperty: 'out-pageSlug', toId: 'send', toProperty: 'in-pageSlug' },
  { fromId: 'gather', fromProperty: 'out-go', toId: 'send', toProperty: 'call' },

  { fromId: 'send', fromProperty: 'done', toId: 'sentGate', toProperty: 'eval' },
  { fromId: 'sentGate', fromProperty: 'result', toId: 'sent', toProperty: 'mounted' },
  // `send.error` is deliberately not read: it is the backend's words, and this
  // caller is anonymous.
  { fromId: 'send', fromProperty: 'failure', toId: 'refusedGate', toProperty: 'eval' },
  { fromId: 'refusedGate', fromProperty: 'result', toId: 'refused', toProperty: 'mounted' }
];

// ── 4. Site/Nav — the navigation, derived and never stored ───────────────────

/**
 * SB-004 §2's "navigation is derived, never stored", as a graph.
 *
 * 🔴 **The third query shape** (module header): the filter is a literal, so the
 * node has no `qp-` port and the graph-build fetch is already narrowed. Both
 * `runOnChange-*` boxes stay ON — switching them off here would leave the query
 * with nothing to trigger it and a site with no navigation, which is s4's
 * `claimSite` defect in a second place.
 */
export const NAV_NODES = [
  {
    id: 'bar',
    type: 'Group',
    label: 'Navigation',
    // SBR-004: a bar with a bottom rule, and `flexWrap` is AC4's half of it —
    // a row of links on a 375px screen must run onto a second line rather than
    // overflow the page sideways. `borderBottomWidth`/`Color` are dynamic ports
    // gated on `borderBottomStyle` being a real line style
    // (`node-shared-port-definitions.ts:1096-1101`), so the style is authored
    // first and not as decoration.
    //
    // 🔴 **No `columnGap`, and the door is what settled it.** A wrapped row
    // around a Repeater WITH a gutter is `uncollapsible-multi-column` arm B
    // (`responsiveArrangement.ts:238-256`) — and the gutter is the whole
    // discriminator there, because a Group-level gutter is how the corpus's
    // three real defects were authored. The spacing between links belongs to the
    // link anyway: `NavLink` carries its own `marginRight`/`marginTop`, which is
    // also what separates the rows once the bar wraps. Adding a gutter back here
    // reds the create call.
    parameters: {
      // AC1 half B — see `STACKED_IN_A_COLUMN`.
      ...STACKED_IN_A_COLUMN,
      as: 'nav',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)'
    },
    children: ['links']
  },
  {
    id: 'links',
    type: 'For Each',
    label: 'One link per page in the nav',
    parent: 'bar',
    parameters: { templateType: 'explicit', template: '/Site/NavLink' }
  },
  {
    id: 'pages',
    type: 'DbCollection2',
    label: 'Pages in the navigation',
    parameters: {
      // SBR-011 AC1: the owner publishes a page and the open site grows the link.
      ...LIVE_QUERY,
      collectionName: 'Page',
      visualFilter: NAV_FILTER,
      visualSort: NAV_SORT
    }
  }
];

export const NAV_WIRES = [{ fromId: 'pages', fromProperty: 'items', toId: 'links', toProperty: 'items' }];

// ── 5. Pages/Site — the catch-all, and everything a visitor sees ─────────────

/**
 * One page component for the whole public site.
 *
 * 🔴 **One, not two**, and that is a measurement rather than a simplification. A
 * separate home page at `''` and a catch-all at `{slug}` are both one segment,
 * both match the root URL at distance 0, and the Router keeps whichever its
 * `pages` list names first (`router.tsx:775-783`). An empty slug meaning "the
 * home page" removes the tie instead of relying on it.
 *
 * 🔴 **The document title cannot come from the `Page` node.** `Page.title` is a
 * real input — `registerInputIfNeeded` handles it (`page.ts:201-205`) and
 * `NodeScope` reaches that hook from the parameter path too — but nothing reads
 * `_internal.title` after export: the Router sets the title from
 * `routerIndex.pages[].title` (`router.tsx:584`), which the exporter copies out
 * of the *parameter* at build time. A records-driven site therefore has one
 * static title for every page unless a code node sets it, and `seo` below is
 * that node.
 *
 * ✅ **The meta description is different, and does work from the port.** `Page`
 * forwards its metatag props to `Noodl.SEO.setMeta` on every update
 * (`Page.tsx:162-168`), so `description` is wirable and live. Both halves are
 * asserted, because the two look identical from the outside and only one of them
 * is.
 */
export const SITE_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Site',
    // `title` is the static fallback the Router will actually use for the tab
    // until `seo` runs; `urlPath` is the catch-all.
    parameters: { title: 'Site', urlPath: SITE_URL_PATH },
    children: ['frame']
  },
  {
    id: 'frame',
    type: 'Group',
    label: 'Page ground',
    parent: 'page',
    // 🔴 SBR-004, and this node is the whole reason the theme is visible at all.
    // `TokenResolver.generateCss` stamps `:root { …tokens }` and
    // `body { font-family: var(--font-sans) }` — and **nothing else**
    // (`TokenResolver.ts:137`). So `--background` and `--foreground` are
    // declared on every deploy and read by no element: before this, a site with
    // Night selected still rendered black on white, because the record changed a
    // custom property that nothing consumed. The ground is a node, or it is not
    // there.
    //
    // Centring happens here (`alignItems`) and the measure lives on `shell`,
    // which is the one arrangement where the background spans the window and the
    // text does not.
    parameters: {
      flexDirection: 'column',
      alignItems: 'center',
      // ⚠️ `backgroundColor` only. A `Group` gets `addBorderInputs` and
      // `addPaddingInputs` but NOT `addTextStyleInputs` (`group.ts:492-500`), so
      // there is no inheritable text `color` port on a container here — every
      // `Text` on the page names its own colour, and that is why `--foreground`
      // appears on the leaves rather than once at the top.
      backgroundColor: 'var(--background)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      // Named in `RAW_DIMENSION_EXEMPTIONS`: a viewport relation, and the
      // vocabulary is deliberately viewport-free.
      minHeight: { value: 100, unit: 'vh' }
    },
    children: ['shell']
  },
  {
    id: 'shell',
    type: 'Group',
    label: 'Page shell',
    parent: 'frame',
    // 🔴 The reading measure, and it is the one custom token this template mints
    // (`--site-measure`, SBR-003 §2). A units-typed port takes a `var(--token)`
    // string first-class — `isTokenReference` in `react-component-node.ts:586`
    // is AIB-001's fix and the validator asks for exactly this form
    // (`parameterValues.ts:199`). The old `{ value: 960, unit: 'px' }` was
    // correct and unthemeable; this one moves when the record does.
    //
    // `width: 100%` under it is the centred-measure idiom, and is named in
    // `RAW_DIMENSION_EXEMPTIONS` for what it is: a layout instruction.
    parameters: {
      flexDirection: 'column',
      width: { value: 100, unit: '%' },
      maxWidth: 'var(--site-measure)',
      rowGap: 'var(--space-8)',
      paddingBottom: 'var(--space-12)'
    },
    children: ['nav', 'siteMain', 'footer']
  },
  { id: 'nav', type: '/Site/Nav', label: 'Navigation', parent: 'shell' },
  /**
   * 🔴 **REL-011c — the public page's `<main>`, and it is the one landmark on
   * this template that needed a NODE rather than a parameter.** The six admin
   * screens each hang a single content column off their shell and the landmark
   * goes straight onto it; `shell` here cannot take it, because `shell` also
   * holds `nav` and `footer` and a `main` that contained those would announce
   * the site's navigation and its colophon as this page's content. That is the
   * shortcut a "tag the outermost Group" fix takes, and it is why the gate
   * asserts both directions rather than only that a `main` exists.
   *
   * ⚠️ **It re-parents three children into one and the picture must not move.**
   * `shell` is a column with `rowGap: var(--space-8)`, and its five children
   * were evenly spaced by it; after this it has three, and the three that moved
   * are spaced by an identical `rowGap` one level down. The cross axis is
   * untouched — neither box states a width, so both stretch to `shell`, which is
   * where the `--site-measure` clamp lives. `sizeMode` is pinned for hazard 1:
   * a `Group` with none is `explicit` at `height: 100%`, which a column parent
   * turns into `flex-grow: 100` (`layout.ts:98`), and `frame`'s `minHeight:
   * 100vh` is exactly the ancestor slack that would then be shared out.
   * **The pictures are the check, not this paragraph.**
   */
  {
    id: 'siteMain',
    type: 'Group',
    label: 'The page',
    parent: 'shell',
    parameters: {
      as: 'main',
      // AC1 half B — see `STACKED_IN_A_COLUMN`.
      ...STACKED_IN_A_COLUMN,
      flexDirection: 'column',
      rowGap: 'var(--space-8)'
    },
    children: ['header', 'sectionList', 'notFoundCard']
  },
  {
    id: 'header',
    type: 'Group',
    label: 'Header',
    parent: 'siteMain',
    parameters: { ...STACKED_IN_A_COLUMN, as: 'header', flexDirection: 'column', rowGap: 'var(--space-1)', paddingTop: 'var(--space-8)' },
    children: ['siteName', 'pageTitle']
  },
  {
    id: 'siteName',
    type: 'Text',
    label: 'Site name',
    // 🔴 SB-018 (3). `text: ''` is not decoration and it is not a default being
    // restated: `Text` declares `default: 'Text'` (`visual/text.ts:41`), and a
    // default applies until the port is *set*, so a node whose only `text` is a
    // wire renders the literal word **Text** for as long as the wire has
    // published nothing. On a site nobody has claimed that is forever, which is
    // the `<h1>Text</h1>` s15 drove. The empty parameter sets the port at load,
    // and the wire then overrides a blank instead of filling one.
    //
    // ⚠️ Blank rather than a placeholder phrase on purpose. This is a heading on
    // a live page mid-load, so anything with words in it would be read as the
    // site's own copy and would be wrong for the fraction of a second before the
    // record lands.
    parent: 'header',
    // SBR-004: the site name is the small line ABOVE the page title — the
    // interface face, muted, uppercase-free. It is not the masthead; the page's
    // own `h1` is, and two competing large strings is the "column of controls"
    // look this task exists to end.
    parameters: {
      as: 'span',
      fontWeight: 'var(--font-semibold)',
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)',
      letterSpacing: 'var(--tracking-wide)'
    }
  },
  {
    id: 'pageTitle',
    type: 'Text',
    label: 'Page title',
    parent: 'header',
    // The page's one `h1`. `Page.title` cannot produce it (see the component
    // note) — this is a `Text` fed from the record. `text: ''` for SB-018 (3);
    // this is the node the drive caught, and `siteName` above is the same shape
    // caught with it rather than left to be found later.
    //
    // SBR-004: the display face and the tight leading are what make this read as
    // a masthead rather than as big body copy. `--font-serif` is the ROLE slot,
    // not a promise of serifs (siteTheme.ts's first wrinkle).
    parameters: {
      as: 'h1',
      fontWeight: 'var(--font-bold)',
      fontSize: 'var(--text-4xl)',
      text: '',
      fontFamily: 'var(--font-serif)',
      color: 'var(--foreground)',
      lineHeight: 'var(--leading-tight)'
    }
  },
  {
    id: 'sectionList',
    type: 'For Each',
    label: 'One view per section',
    parent: 'siteMain',
    parameters: { templateType: 'explicit', template: '/Site/SectionView' }
  },
  // 🔴 **SBR-005 removed the page-level contact form, and the reason is a
  // measurement the drive made rather than a tidy-up.**
  //
  // This page used to place `/Site/ContactForm` in a `contactWrap` mounted from
  // `readSections.out-hasContact` — which is `rows.some(r => r.kind ===
  // 'contact')`. That WAS the contact kind's rendering: the section itself drew
  // an intro and the page drew the form, because a repeater item could not be
  // handed the page slug the form needs.
  //
  // SBR-005 gave the kind its own form (`/Site/ContactSection`, which reads the
  // slug out of `SITE_CURRENT_SLUG_VAR` the way `Site/NavLink` always has). The
  // page-level copy then fired **on the identical predicate**, so every page with
  // a contact section drew the form TWICE — not "if an author turns on two
  // switches", but always, because there was only ever one switch and both
  // consumers read it.
  //
  // ⚠️ **No structural gate could see it and the first draft of this task's own
  // register row got it wrong**, filing it as a two-switch hazard with an owner.
  // The browser said 7 `<section>` elements on a five-section page, and the page
  // text carried "Get in touch / Your name / Your email / Your message / Send"
  // twice. `sb006PublicSite.test.ts`'s cross-component walk had been reporting
  // `Site/ContactForm`'s four nodes twice all along, and reading that as expected
  // is what a session does when it has not looked at the page.
  {
    id: 'notFoundCard',
    type: 'Group',
    label: 'The empty-screen card',
    parent: 'siteMain',
    // 🔴 SBR-004 moves the visibility wire from the Text to this wrapper, and
    // the contract it carries moves with it unchanged: `mounted: false` is the
    // authored default and must stay standing until a fetch has happened (see
    // the module header on `isEmpty`). Nothing wired can publish before
    // `pageQuery` has answered once, so an author who deletes the wire gets a
    // hidden card rather than a 404 on every page.
    //
    // A wrapper rather than styling the Text because the four states SBR-002
    // named are *panels* — a centred card on the surface colour is what tells a
    // visitor "this is the whole answer" instead of "this paragraph failed".
    parameters: {
      // AC1 half B — see `STACKED_IN_A_COLUMN`.
      ...STACKED_IN_A_COLUMN,
      flexDirection: 'column',
      alignItems: 'center',
      mounted: false,
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-12)',
      paddingBottom: 'var(--space-12)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['notFound']
  },
  {
    id: 'notFound',
    type: 'Text',
    label: 'Not found',
    parent: 'notFoundCard',
    // `text` keeps the plain 404 as its authored value so the node still reads
    // correctly with nothing wired; `diagnoseNotFound` overwrites it on the
    // three occasions it is wrong. No visibility port here at all — the card
    // owns it, and a node with two visibility owners is a node nobody can reason
    // about.
    parameters: {
      as: 'p',
      text: NOT_FOUND_TEXT,
      color: 'var(--muted-foreground)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      textAlignX: 'center'
    }
  },
  {
    id: 'footer',
    type: 'Group',
    label: 'Footer',
    parent: 'shell',
    // SBR-004's third piece of shape. Before this the page simply stopped —
    // the last section's bottom padding and then the window. A rule, the site's
    // name and a way back to the home page is the minimum that reads as a
    // published site rather than a fragment.
    parameters: {
      // AC1 half B — see `STACKED_IN_A_COLUMN`.
      ...STACKED_IN_A_COLUMN,
      as: 'footer',
      flexDirection: 'column',
      rowGap: 'var(--space-2)',
      paddingTop: 'var(--space-8)',
      borderTopStyle: 'solid',
      borderTopWidth: 'var(--border-1)',
      borderTopColor: 'var(--border)'
    },
    children: ['footerName', 'footerHome']
  },
  {
    id: 'footerName',
    type: 'Text',
    label: 'Footer site name',
    parent: 'footer',
    // SB-018 (3) again: standing `text: ''`, because the only writer is a wire
    // and `Text` defaults to the literal word "Text" until a port is set.
    parameters: {
      as: 'span',
      text: '',
      color: 'var(--muted-foreground)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)'
    }
  },
  {
    id: 'footerHome',
    type: 'Text',
    label: 'Back to home',
    parent: 'footer',
    // A standing value that is also the final one: this string is the same on
    // every page and comes from no record, so unlike every other `Text` here it
    // is authored copy rather than a placeholder.
    parameters: {
      as: 'span',
      text: FOOTER_HOME_TEXT,
      color: 'var(--primary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)'
    }
  },
  {
    id: 'goHome',
    type: 'RouterNavigate',
    label: 'To the home page',
    // 🔴 The target is the same catch-all component every link points at; what
    // makes it "home" is the `pm-slug` it carries, and that value comes from
    // `SiteSettings.homeSlug` rather than a hard-coded 'home' — the record is
    // what decides which page is the front door, and `claimSite` writes it.
    parameters: { router: ROUTER, target: SITE_PAGE }
  },
  {
    id: 'diagnoseNotFound',
    type: 'JavaScriptFunction',
    label: 'Which of the three empty screens is this?',
    parameters: {
      // 🔴 The guard is the same one `readPage` uses and for the same reason: a
      // JavaScript function runs when ANY input arrives (`Run` is additive), so
      // without it this node decides on a pre-fetch reading and publishes
      // `visible: true` over a page that is about to render.
      //
      // `error` is only ever set by `pageQuery.failure`, so its presence — not
      // its content — is the refusal signal. Nothing here reads the message,
      // because the message is for the author's console and not for a visitor.
      functionScript:
        'const pageRefused = Inputs.error !== undefined && Inputs.error !== null && Inputs.error !== "";\n' +
        'const settingsRefused = Inputs.settingsError !== undefined && Inputs.settingsError !== null && Inputs.settingsError !== "";\n' +
        // 🔴 THE ABSENCE NEEDS A KNOWN-FIRING SIGNAL BESIDE IT, and this is
        // where the drive caught the first version out. `claimed` is computed
        // from the settings query's `items`, and a REFUSED query publishes an
        // empty `items` exactly like an EMPTY one does — so `claimed === false`
        // alone cannot tell "nobody set this site up" from "you may not read
        // the settings". `sb015-default-policy-drive`'s arm C is the second
        // case and was reporting itself as the first.
        //
        // The settings query's `error` is the signal that separates them, so a
        // refused settings read is answered FIRST and never as "not set up".
        'if (settingsRefused) {\n' +
        '  Outputs.text = ' + JSON.stringify(NOT_AVAILABLE_TEXT) + ';\n' +
        '  Outputs.visible = true;\n' +
        '  return;\n' +
        '}\n' +
        // 🔴 ORDER IS LOAD-BEARING, and the drive is what established it. An
        // unclaimed site makes the Page query FAIL rather than come back empty
        // — nothing has created the collection, because `claimSite` is what
        // writes the first rows. So "nobody has set this site up" explains the
        // failure and must be read BEFORE it; with the two the other way round,
        // the state F27 measured reported itself as a refusal.
        //
        // `=== false` and not `!Inputs.claimed`: undefined means the settings
        // query has not answered, which is not the same as answering "no row".
        'if (Inputs.claimed === false) {\n' +
        '  Outputs.text = ' + JSON.stringify(NOT_SET_UP_TEXT) + ';\n' +
        '  Outputs.visible = true;\n' +
        '  return;\n' +
        '}\n' +
        'if (pageRefused) {\n' +
        '  Outputs.text = ' + JSON.stringify(NOT_AVAILABLE_TEXT) + ';\n' +
        '  Outputs.visible = true;\n' +
        '  return;\n' +
        '}\n' +
        // 🔴 SBR-002: the fourth cause, and the only one with NO signal of its
        // own — see NO_BACKEND_TEXT for the measurement. The deadline arm
        // speaks only when NOTHING has answered: every real signal above beats
        // it here by order, and any that arrives later overwrites it because
        // this node re-runs on every input. `=== true` because the Delay's
        // signal lands on a value port as true-then-false; the false pass
        // falls through to the abstain and the latched outputs stand.
        // 🔴 `!== undefined`, NOT `=== true` — measured in the s4 drive: a signal
        // into a value port writes true-then-false, and the input queue holds ONE
        // entry per input name, so the two writes coalesce and the script runs
        // ONCE, with `false`. The only writer of this port is the deadline, so
        // "defined at all" IS "the deadline passed"; an `=== true` guard is a
        // watchdog that can never bark.
        'if (Inputs.watchdog !== undefined && Inputs.claimed === undefined && Inputs.missing === undefined) {\n' +
        '  Outputs.text = ' + JSON.stringify(NO_BACKEND_TEXT) + ';\n' +
        '  Outputs.visible = true;\n' +
        '  return;\n' +
        '}\n' +
        // The abstain, and it is what keeps the authored `visible: false`
        // standing until something has actually answered.
        'if (Inputs.missing === undefined) return;\n' +
        'if (!Inputs.missing) {\n' +
        '  Outputs.visible = false;\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.text = ' + JSON.stringify(NOT_FOUND_TEXT) + ';\n' +
        'Outputs.visible = true;'
    }
  },

  {
    id: 'noBackendDeadline',
    type: 'Timer',
    label: 'The answer deadline',
    // SBR-002: started at page mount, it arms `diagnoseNotFound`'s watchdog
    // arm. It does NOT decide anything — the decider still owns the answer,
    // and any query signal beats the deadline whenever one exists. See
    // NO_BACKEND_TEXT for why a deadline is the only signal this state has.
    parameters: { duration: NO_BACKEND_DEADLINE_MS }
  },

  { id: 'pageInputs', type: 'PageInputs', label: 'The slug from the URL', parameters: { pathParams: 'slug' } },
  {
    id: 'settings',
    type: 'DbCollection2',
    label: 'SiteSettings (one row)',
    // Unfiltered singleton: boxes ON. With them off there is no filter parameter
    // left to trigger it and `homeSlug` never arrives — s4's `claimSite` defect.
    parameters: { collectionName: 'SiteSettings' }
  },
  {
    id: 'readSettings',
    type: 'JavaScriptFunction',
    label: 'Read the settings row',
    parameters: {
      functionScript:
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        "Outputs.siteName = first.siteName || '';\n" +
        // 🔴 SB-015 F27. A `SiteSettings` row is what `claimSite` mints, so its
        // absence IS "nobody has set this site up" — the state that used to
        // render as an ordinary 404 on the author's own home page.
        'Outputs.claimed = rows.length > 0;\n' +
        "Outputs.homeSlug = first.homeSlug || 'home';"
    }
  },
  {
    id: 'resolveSlug',
    type: 'JavaScriptFunction',
    label: 'The slug to show',
    // Rule 1.
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 **SBR-004 §9.2's finding, and it is the front door.** Same mechanism as
      // `NavLink`'s two boxes above and the same asymmetry — the NDA-017 migration
      // writes `runOnChange-<input>: false` on every load for the value inputs of
      // any node in the fifteen families whose control signal is wired, and this
      // node wires `run` (from `Page.didMount`). An already-present key is never
      // touched, so `true` survives the load and *absent* does not.
      //
      // 🔴 **Of the 33 nodes the migration silences in this template, this is the
      // one where it breaks a page.** Elsewhere the `run` wire is a real trigger
      // that fires after the values (`ContactForm/gather` runs on the send
      // button's click, and the button is clicked after the fields are typed).
      // Here `run` is `didMount` and `in-homeSlug` comes from a `SiteSettings`
      // fetch that answers whenever the backend answers. Passive, the guard on the
      // first line fires once at mount and nothing ever re-runs the body.
      //
      // Driven at the root URL `/` with both passive: `Noodl.Variables` held 0
      // keys, `siteCurrentSlug` was `undefined`, the `h1` was empty and the body
      // was the nav and the footer with no page between them. `/home` and `/about`
      // were fine, because a non-empty URL slug is the one case that does not need
      // `homeSlug` — and the empty one is what a first visitor types.
      //
      // ⚠️ **This is a re-run, not just a re-trigger, and that was checked rather
      // than assumed.** The body writes the app-wide current slug and its
      // `out-slug` is the only trigger `pageQuery` has (`qp-` sets call
      // `scheduleFetch`, `dbcollectionnode2.ts:1069`), so "runs again" means "the
      // page queries again". It costs nothing here: the guard means a run before
      // `homeSlug` publishes *nothing*, so the first run that reaches the body is
      // the first fetch, not a second one. `homeSlug` is published once per load by
      // a singleton read, and `slug` changing without a remount is precisely the
      // case that *should* re-query.
      //
      // 🔴 And both, not one — `NavLink`'s reason exactly. With only `in-homeSlug`
      // ticked, a settings row that answers *before* the Router has set the page
      // parameters runs the body against an undefined `slug`, resolves the home
      // slug, and nothing re-runs it when the real one arrives. Two ticked inputs
      // changing in one frame still produce ONE run (`scheduleRun`'s
      // `runScheduled` guard), so the pair is not two fetches.
      'runOnChange-in-slug': true,
      'runOnChange-in-homeSlug': true,

      // 🔴 Rule 2's guard, and it is doing real work: two producers reach this
      // node — the URL and the settings row — and an empty URL slug is the
      // ordinary case (the root), not a missing value. Acting before `homeSlug`
      // arrives would query for the empty slug and 404 the home page.
      //
      // Everything downstream of the slug leaves from HERE, so the filtered
      // query below cannot be triggered by a node that does not also carry its
      // filter value.
      functionScript:
        'if (Inputs.homeSlug === undefined) return;\n' +
        "const fromUrl = Inputs.slug === undefined || Inputs.slug === null ? '' : String(Inputs.slug);\n" +
        "const slug = fromUrl === '' ? Inputs.homeSlug : fromUrl;\n" +
        "if (slug === '') return;\n" +
        'Outputs.slug = slug;\n' +
        // 🔴 SBR-004 AC2. The one write of the app-wide current slug, here
        // because this is the node that decides what "the page being read"
        // means — the URL alone cannot, since an empty URL slug is the home
        // page and only `SiteSettings.homeSlug` says which record that is.
        //
        // `Noodl.Variables` is a `Noodl.Object` proxy (`noodl-js-api.ts:28`), so
        // this goes through `Model.set` and every `Variable` node reading the
        // name is notified. Guarded like every other code node here:
        // `createNoodlAPI` returns `{}` with no `window.Noodl`, and this bundle
        // is the one most likely to be server-rendered.
        'if (Noodl && Noodl.Variables) {\n' +
        '  Noodl.Variables[' + JSON.stringify(SITE_CURRENT_SLUG_VAR) + '] = slug;\n' +
        '}\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'pageQuery',
    type: 'DbCollection2',
    label: 'The page with this slug',
    parameters: {
      // Rule 3's transferring half: no load-time fetch, so the query cannot run
      // before its filter exists and return every Page on the site.
      ...NO_LOAD_TIME_FETCH,
      collectionName: 'Page',
      visualFilter: PAGE_BY_SLUG_FILTER
    }
  },
  {
    id: 'readPage',
    type: 'JavaScriptFunction',
    label: 'Read the page record',
    // Rule 1.
    ports: [{ name: 'out-found', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 `missing` is computed here rather than taken from the query's
      // `isEmpty` output, and that is the module header's third point: `isEmpty`
      // is `true` before the first fetch by contract, so a not-found panel wired
      // to it is visible to every visitor until the query answers. This node
      // publishes nothing until `rows` has arrived, so the authored
      // `visible: false` stands.
      //
      // `rows` and the `fetched` that triggers this leave the same query in one
      // synchronous block, so the guard is a guard and not a race (header, 2).
      functionScript:
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = Inputs.rows || [];\n' +
        'const row = rows[0];\n' +
        'const d = row ? row.data || row : undefined;\n' +
        'Outputs.missing = d === undefined;\n' +
        "Outputs.title = d ? d.title || '' : '';\n" +
        "Outputs.seoDescription = d ? d.seoDescription || '' : '';\n" +
        "Outputs.slug = d ? d.slug || '' : '';\n" +
        'if (d === undefined) return;\n' +
        "Outputs.pageId = row.getId ? row.getId() : (d.objectId || '');\n" +
        'Outputs.found();'
    }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    parameters: {
      ...NO_LOAD_TIME_FETCH,
      // SBR-011 AC2: an owner's section edit reaches an open site without a reload.
      ...LIVE_QUERY,
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER,
      // Without this a page's sections come back in whatever order the backend
      // returns them, which is what `Section.order` exists to stop.
      visualSort: SECTION_SORT
    }
  },
  // SBR-005: `readSections` went with the page-level form. Its single output was
  // `hasContact`, and a code node with no consumer is a node that runs on every
  // fetch to answer a question nobody asks.
  {
    id: 'theme',
    type: 'DbCollection2',
    label: 'Theme (one row)',
    // Unfiltered singleton: boxes ON, same reason as `settings`.
    // SBR-011 AC3: a theme save repaints every open site, which is what makes
    // SBR-009's editor a demo of itself rather than a form with a save button.
    parameters: { ...LIVE_QUERY, collectionName: 'Theme' }
  },
  {
    id: 'applyTheme',
    type: 'JavaScriptFunction',
    label: 'The theme record, as CSS variables',
    parameters: {
      // 🔴 The twelve keys are SBR-003's contract (`THEME_KEYS` /
      // `siteTheme.ts`), written by SB-005's `buildTokens` and read here and
      // nowhere else. Every custom property is a vocabulary name (plus the one
      // minted `--site-measure`), so a component authored with `var(--primary)`
      // follows the record; empty/absent values fall back to the `designTokens`
      // floor the deploy stamps into `:root` — Studio, by construction.
      //
      // 🔴 The companion writes are DERIVATIONS, not record fields: hover/ring/
      // accent-foreground follow the primary, raised follows the surface, the
      // border steps mix toward ground and ink (color-mix is resolved by the
      // browser — no colour math, no second palette to drift). And `fontUi` is
      // mirrored onto the element's inline font-family as well as the token:
      // the stamped CSS carries `body { font-family: var(--font-sans) }`
      // (POL-006's floor in `TokenResolver.generateCss`), so the token write is
      // the effective channel there — the mirror covers any surface the stamp
      // never reached, where a declared token default alone lands no family.
      //
      // 🔴 Guarded for a server render. This bundle is the one most likely to be
      // deployed SSR or SSG, and `document` does not exist there.
      //
      // 🔴 **The body moved to `siteTheme.ts` in SBR-009 and did not change.**
      // `/Admin/Shell` runs the same script now (AC1: the admin panel wears the
      // client's theme too), and two hand-written appliers are the
      // second-copy-of-a-palette trap in an admin costume — the derivations
      // above are exactly what would drift, because nobody edits two appliers on
      // the same day. Byte-identity of the regenerated artefact is what proves
      // the extraction changed nothing.
      functionScript: buildThemeApplierScript()
    }
  },
  {
    id: 'seo',
    type: 'JavaScriptFunction',
    label: 'The document title',
    parameters: {
      // 🔴 The Router sets the title from the exported `routerIndex`, not from
      // the `Page` node's input, so this is the only way a records-driven page
      // gets its own tab. `createNoodlAPI` returns `{}` when there is no
      // `window.Noodl` (`javascriptnodeparser.js:497-501`), so `Noodl.SEO` is
      // tested before it is used — unguarded, this throws on the SSR server and
      // takes the render with it.
      functionScript:
        "if (!Inputs.title) return;\n" +
        'if (!Noodl || !Noodl.SEO) return;\n' +
        'Noodl.SEO.setTitle(Inputs.title);'
    }
  }
];

export const SITE_WIRES = [
  // The settings singleton, and the two things the page needs from it.
  { fromId: 'settings', fromProperty: 'items', toId: 'readSettings', toProperty: 'in-rows' },
  { fromId: 'settings', fromProperty: 'fetched', toId: 'readSettings', toProperty: 'run' },
  { fromId: 'readSettings', fromProperty: 'out-siteName', toId: 'siteName', toProperty: 'text' },

  // The URL slug, and the home slug it falls back to.
  { fromId: 'pageInputs', fromProperty: 'pm-slug', toId: 'resolveSlug', toProperty: 'in-slug' },
  { fromId: 'readSettings', fromProperty: 'out-homeSlug', toId: 'resolveSlug', toProperty: 'in-homeSlug' },
  // The page's mount is the one signal guaranteed to come after the Router has
  // set the page parameters (`router.tsx:602-605`).
  { fromId: 'page', fromProperty: 'didMount', toId: 'resolveSlug', toProperty: 'run' },

  // 🔴 The filter value's arrival is this query's only trigger. Nothing is wired
  // to `storageFetch`: the public site never writes, so it never needs the
  // refresh SB-005's panel does.
  { fromId: 'resolveSlug', fromProperty: 'out-slug', toId: 'pageQuery', toProperty: 'qp-slug' },

  { fromId: 'pageQuery', fromProperty: 'items', toId: 'readPage', toProperty: 'in-rows' },
  { fromId: 'pageQuery', fromProperty: 'fetched', toId: 'readPage', toProperty: 'run' },

  { fromId: 'readPage', fromProperty: 'out-title', toId: 'pageTitle', toProperty: 'text' },
  // 🔴 SB-015 F27: `notFound` is no longer driven straight off `missing`. The
  // three causes reach `diagnoseNotFound`, which decides both the text and
  // whether the panel shows at all.
  { fromId: 'readPage', fromProperty: 'out-missing', toId: 'diagnoseNotFound', toProperty: 'in-missing' },
  { fromId: 'readSettings', fromProperty: 'out-claimed', toId: 'diagnoseNotFound', toProperty: 'in-claimed' },
  // The refusal arm. `error` publishes only when the query fails, so its
  // presence is the signal and nothing has to listen for `failure` separately.
  { fromId: 'pageQuery', fromProperty: 'error', toId: 'diagnoseNotFound', toProperty: 'in-error' },
  // The settings query's own refusal, which is what separates "not set up"
  // from "you may not read this" — see the node's script.
  { fromId: 'settings', fromProperty: 'error', toId: 'diagnoseNotFound', toProperty: 'in-settingsError' },
  // SBR-004: the visibility moved to the CARD (the Text is always visible
  // inside it); the text still lands on the Text. Two nodes, one decider.
  { fromId: 'diagnoseNotFound', fromProperty: 'out-visible', toId: 'notFoundCard', toProperty: 'mounted' },
  { fromId: 'diagnoseNotFound', fromProperty: 'out-text', toId: 'notFound', toProperty: 'text' },
  // SBR-002: the deadline. Mount starts the clock; its finish arms the
  // watchdog arm — a value port, so the signal's true-then-false COALESCES to a
  // single `false` delivery (one queue entry per input name, s4 drive), which
  // is why the decider guards on `!== undefined`, never `=== true`.
  { fromId: 'page', fromProperty: 'didMount', toId: 'noBackendDeadline', toProperty: 'start' },
  { fromId: 'noBackendDeadline', fromProperty: 'timerFinished', toId: 'diagnoseNotFound', toProperty: 'in-watchdog' },
  // ✅ The metatag half that DOES work from the port (`Page.tsx:162-168`).
  { fromId: 'readPage', fromProperty: 'out-seoDescription', toId: 'page', toProperty: 'description' },
  // 🔴 And the half that does not: the title goes through `Noodl.SEO`.
  { fromId: 'readPage', fromProperty: 'out-title', toId: 'seo', toProperty: 'in-title' },

  // Same shape again: the sections query's only trigger is its filter arriving,
  // and the filter leaves the same node as everything else about this page.
  { fromId: 'readPage', fromProperty: 'out-pageId', toId: 'sections', toProperty: 'qp-pageId' },
  { fromId: 'sections', fromProperty: 'items', toId: 'sectionList', toProperty: 'items' },

  { fromId: 'theme', fromProperty: 'items', toId: 'applyTheme', toProperty: 'in-rows' },
  { fromId: 'theme', fromProperty: 'fetched', toId: 'applyTheme', toProperty: 'run' },

  // SBR-004's footer. The name is the same one the header shows — one read of
  // the settings row feeds both — and the link's destination is the home slug
  // the record names, not a hard-coded 'home'.
  { fromId: 'readSettings', fromProperty: 'out-siteName', toId: 'footerName', toProperty: 'text' },
  { fromId: 'readSettings', fromProperty: 'out-homeSlug', toId: 'goHome', toProperty: 'pm-slug' },
  { fromId: 'footerHome', fromProperty: 'onClick', toId: 'goHome', toProperty: 'navigate' }
];

// ── The set, in an order the door will accept ────────────────────────────────

/** One component: what to send, and where it lands. */
export interface Sb006Component {
  /** `create_component`'s `path` argument. */
  path: string;
  /** The registry key, which is also the directory under `components/`. */
  key: string;
  /** The legacy name — an instance uses this as its node `type`, a Repeater as its `template`. */
  legacyName: string;
  /** True where the component must land with a `Page` root and register in the router. */
  isPage: boolean;
  nodes: unknown[];
  connections: unknown[];
  /**
   * Node ids that cannot exist on the **create** pass because they name a
   * component that does not exist yet — SB-012. Dropped (with every wire
   * touching them) from the create call and restored by an `update_component`.
   */
  deferred?: string[];
}

/**
 * 🔴 **SB-012 again, and this site is a second, independent instance of it.**
 *
 * `Site/NavLink` navigates to `/Pages/Site`, and `Pages/Site` places `Site/Nav`,
 * which repeats `Site/NavLink`. Both references are checked at the door and both
 * refusals block — `unresolved-navigation` and `repeater-template-unresolved` —
 * but only against what is **already on disk**. The cycle is genuine: a site
 * whose pages link to each other is what a site *is*.
 *
 * The order below resolves every forward reference; the one remaining edge is
 * the nav link's target, deferred to a second `update_component` pass. A
 * known-firing control in the suite proves the create pass really refuses it,
 * so "we authored in two passes" stays a measurement rather than a habit.
 */
export const SB006_COMPONENTS: Sb006Component[] = [
  {
    path: 'Site/NavLink',
    key: 'Site/NavLink',
    legacyName: '/Site/NavLink',
    isPage: false,
    nodes: NAV_LINK_NODES,
    connections: NAV_LINK_WIRES,
    // `/Pages/Site` does not exist yet, and cannot: it needs `/Site/Nav`, which
    // needs this component.
    deferred: ['goPage']
  },
  // SBR-005. The five kinds are authored BEFORE the view that dispatches to
  // them, and `Site/GalleryTile` before the gallery that repeats it: both edges
  // are checked at the door and both refusals block
  // (`repeater-template-unresolved`, `instance-component-not-found`).
  {
    path: 'Site/GalleryTile',
    key: 'Site/GalleryTile',
    legacyName: '/Site/GalleryTile',
    isPage: false,
    nodes: GALLERY_TILE_NODES,
    connections: GALLERY_TILE_WIRES
  },
  {
    path: 'Site/HeroSection',
    key: 'Site/HeroSection',
    legacyName: '/Site/HeroSection',
    isPage: false,
    nodes: HERO_SECTION_NODES,
    connections: HERO_SECTION_WIRES
  },
  {
    path: 'Site/GallerySection',
    key: 'Site/GallerySection',
    legacyName: '/Site/GallerySection',
    isPage: false,
    nodes: GALLERY_SECTION_NODES,
    connections: GALLERY_SECTION_WIRES
  },
  {
    path: 'Site/RichTextSection',
    key: 'Site/RichTextSection',
    legacyName: '/Site/RichTextSection',
    isPage: false,
    nodes: RICH_TEXT_SECTION_NODES,
    connections: RICH_TEXT_SECTION_WIRES
  },
  {
    path: 'Site/ContactForm',
    key: 'Site/ContactForm',
    legacyName: '/Site/ContactForm',
    isPage: false,
    nodes: CONTACT_FORM_NODES,
    connections: CONTACT_FORM_WIRES
  },
  // Places `/Site/ContactForm`, so it follows it.
  {
    path: 'Site/ContactSection',
    key: 'Site/ContactSection',
    legacyName: '/Site/ContactSection',
    isPage: false,
    nodes: CONTACT_SECTION_NODES,
    connections: CONTACT_SECTION_WIRES
  },
  // Its `RouterNavigate` names `/Pages/Site`, which cannot exist yet — the same
  // deferred edge `Site/NavLink` carries, and the same second pass closes it.
  {
    path: 'Site/CtaSection',
    key: 'Site/CtaSection',
    legacyName: '/Site/CtaSection',
    isPage: false,
    nodes: CTA_SECTION_NODES,
    connections: CTA_SECTION_WIRES,
    deferred: ['goPage']
  },
  {
    path: 'Site/SectionView',
    key: 'Site/SectionView',
    legacyName: '/Site/SectionView',
    isPage: false,
    nodes: SECTION_VIEW_NODES,
    connections: SECTION_VIEW_WIRES
  },
  {
    path: 'Site/Nav',
    key: 'Site/Nav',
    legacyName: '/Site/Nav',
    isPage: false,
    nodes: NAV_NODES,
    connections: NAV_WIRES
  },
  {
    path: 'Pages/Site',
    key: 'Pages/Site',
    legacyName: '/Pages/Site',
    isPage: true,
    nodes: SITE_NODES,
    connections: SITE_WIRES
  }
];

/** The create-pass payload: the component minus whatever it cannot name yet. */
export function createPass(c: Sb006Component): { nodes: unknown[]; connections: unknown[] } {
  if (!c.deferred || c.deferred.length === 0) return { nodes: c.nodes, connections: c.connections };
  const drop = new Set(c.deferred);
  return {
    nodes: (c.nodes as Array<{ id: string; children?: string[] }>)
      .filter((n) => !drop.has(n.id))
      .map((n) => (n.children ? { ...n, children: n.children.filter((id) => !drop.has(id)) } : n)),
    connections: (c.connections as Array<{ fromId: string; toId: string }>).filter(
      (w) => !drop.has(w.fromId) && !drop.has(w.toId)
    )
  };
}
