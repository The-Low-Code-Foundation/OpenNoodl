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
import { THEME_TOKEN_FIELDS } from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { ROUTER } from './sb005Components';

export const THEME_KEYS = THEME_TOKEN_FIELDS;

/**
 * The Router the template's `App` component hosts — **imported, not restated**.
 * Two spellings of one router name is a site whose links navigate nowhere, and
 * nothing would report it.
 */
export { ROUTER } from './sb005Components';

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
 * SBR-012 widens the same scan to the generated artefact and the other two
 * component sets.
 *
 * 🔴 Colour, radius, gap, face and font size have **no** entries and must not
 * gain any — the vocabulary covers all five, so a raw one there is a defect
 * rather than a gap.
 */
export const RAW_DIMENSION_EXEMPTIONS: ReadonlyArray<{ label: string; port: string; why: string }> = [
  {
    label: 'Section image',
    port: 'height',
    why: 'A section image band is a picture crop, not a rhythm step — the spacing scale tops out at 96px and this is 320px. No vocabulary token names a media height.'
  },
  {
    label: 'Section image',
    port: 'width',
    why: '100% is a layout instruction ("fill the column"), not a measurement — there is no token for "all of it" and there should not be.'
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

/** Sections render in `order`, which is what makes a page a page. */
export const SECTION_SORT = [{ property: 'order', order: 'ascending' }];

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

// ── 2. Site/SectionView — one section of the page being read ─────────────────

/**
 * One section, of whichever of SB-004 §2's five kinds it is.
 *
 * 🔴 **What it renders is bounded by what the panel can write, not by the kind
 * vocabulary.** `Admin/SectionRow` edits `data.body` and `data.image` and
 * nothing else, so a section view that read `data.heading` would be reading a
 * field with no author — a blank on every real page, and green in every spec.
 * The five kinds therefore differ in *which of those two show* and in how they
 * are set, not in what they carry:
 *
 *   | kind     | image | body | rendered as              |
 *   |----------|-------|------|--------------------------|
 *   | hero     | yes   | yes  | `h1`-scale band          |
 *   | richText | no    | yes  | body copy                |
 *   | gallery  | yes   | no   | image only               |
 *   | contact  | no    | yes  | the intro above the form |
 *   | cta      | no    | yes  | emphasised band          |
 *
 * ⚠️ **`cta` has no destination, and cannot have one** — `data` has no link
 * field and the panel has no control that would write one. It renders as an
 * emphasised block of copy. Recorded in the task file as a gap with two named
 * fixes, neither of them ours to pick.
 *
 * 🔴 **The contact FORM is not here**, and that is the second half of a
 * measurement rather than a layout preference: `submitContactForm` takes a
 * `pageSlug`, and a repeater item cannot be given a value that is constant
 * across items. `For Each` sets `id` and the model's own fields and nothing else
 * (`foreach.tsx:586-597`) — exactly the limit SB-004 §5 recorded for `Run
 * Tasks`. The form is a sibling of the list, in `Site/ContactForm`, where the
 * page can hand it the slug.
 */
export const SECTION_VIEW_NODES = [
  {
    id: 'section',
    type: 'Group',
    label: 'One section',
    // `as: 'section'` — this is the public HTML, and a site made of `div`s is
    // the thing a client's SEO consultant will complain about first.
    // SBR-004: the rhythm between sections is two steps of the spacing scale.
    // The values are the same 32/16 they were — what changed is where they come
    // from, so the look is unmoved and the provenance is single.
    parameters: {
      as: 'section',
      flexDirection: 'column',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)',
      rowGap: 'var(--space-4)'
    },
    children: ['image', 'body']
  },
  {
    id: 'image',
    type: 'Image',
    label: 'Section image',
    parent: 'section',
    // ⚠️ `sizeMode: 'explicit'` is not decoration: the door refuses `objectFit`
    // without it (`inert-dimension`, blocking) because the port is read in no
    // other mode. And both dimensions carry a unit — a bare number on a
    // dimension port is read as a **percentage** (`unitless-dimension`), so
    // `height: 320` would have been 320% of the section.
    //
    // SBR-004: both dimensions stay raw and both are named in
    // `RAW_DIMENSION_EXEMPTIONS` — a media crop is not a rhythm step. The
    // corner radius is a token, because that one the vocabulary does name.
    parameters: {
      sizeMode: 'explicit',
      objectFit: 'cover',
      width: { value: 100, unit: '%' },
      height: { value: 320, unit: 'px' },
      borderRadius: 'var(--radius-md)',
      mounted: false
    }
  },
  {
    id: 'body',
    type: 'Text',
    label: 'Section body',
    parent: 'section',
    // 🔴 SB-018 (3). Standing `text`, for the reason spelled out on
    // `/Pages/Site`'s headings: `Text` declares `default: 'Text'`, a default
    // applies until the port is set, and a node whose only `text` is a wire
    // renders the literal word **Text** until that wire publishes. Every other
    // wired `Text` in this template already carried one (`link`, `rowStatus`,
    // `notFound`); these were the four that did not, and s19's census over the
    // shipped artefact is what found them rather than the one the drive saw.
    //
    // SBR-004: `color` and `lineHeight` are authored because they are the same
    // for every kind. `fontSize`, `fontWeight` and `fontFamily` are NOT — the
    // kind decides all three and `unpack` below owns them, so authoring one here
    // would be a value that is overwritten on every row that renders.
    parameters: {
      as: 'p',
      mounted: false,
      text: '',
      color: 'var(--foreground)',
      lineHeight: 'var(--leading-relaxed)'
    }
  },
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
    label: 'What this kind shows',
    parameters: {
      // No custom signal outputs, so rule 1 has nothing to declare here.
      //
      // The two visibility booleans are computed rather than wired from
      // `Condition` nodes because the answer depends on both `kind` and whether
      // the field is actually filled — an empty `body` on a `hero` should leave
      // no empty paragraph behind.
      //
      // A `cloudfile` renders through its `url`; an unset one must not reach an
      // Image's `src` as the string "undefined".
      functionScript:
        "const kind = Inputs.kind || 'richText';\n" +
        'const d = Inputs.data || {};\n' +
        "const body = d.body || '';\n" +
        "const image = (d.image && d.image.url) || '';\n" +
        "Outputs.showImage = image !== '' && (kind === 'hero' || kind === 'gallery');\n" +
        "Outputs.showBody = body !== '' && kind !== 'gallery';\n" +
        'Outputs.body = body;\n' +
        'Outputs.image = image;\n' +
        // The weight is what tells a hero from a paragraph, and the door's
        // `monotone-typography` check is answered by setting one at all.
        "Outputs.weight = (kind === 'hero' || kind === 'cta') ? 'var(--font-bold)' : 'var(--font-normal)';\n" +
        "Outputs.size = kind === 'hero' ? 'var(--text-3xl)' : 'var(--text-base)';\n" +
        // SBR-004: a hero is the display face, body copy is the interface face.
        // Both are ROLE slots in the shipped vocabulary (siteTheme.ts's first
        // deliberate wrinkle) — Night puts a sans stack in `--font-serif` and
        // that is intended, so this reads "display" and not "serif".
        "Outputs.family = kind === 'hero' ? 'var(--font-serif)' : 'var(--font-sans)';"
    }
  }
];

export const SECTION_VIEW_WIRES = [
  { fromId: 'inputs', fromProperty: 'kind', toId: 'unpack', toProperty: 'in-kind' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'unpack', toProperty: 'in-data' },

  { fromId: 'unpack', fromProperty: 'out-image', toId: 'image', toProperty: 'src' },
  { fromId: 'unpack', fromProperty: 'out-showImage', toId: 'image', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'body', toProperty: 'text' },
  { fromId: 'unpack', fromProperty: 'out-showBody', toId: 'body', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-weight', toId: 'body', toProperty: 'fontWeight' },
  { fromId: 'unpack', fromProperty: 'out-size', toId: 'body', toProperty: 'fontSize' },
  { fromId: 'unpack', fromProperty: 'out-family', toId: 'body', toProperty: 'fontFamily' }
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
    children: ['heading', 'nameField', 'emailField', 'messageField', 'sendButton', 'sent', 'refused']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Contact heading',
    parent: 'form',
    parameters: {
      as: 'h2',
      text: 'Get in touch',
      fontWeight: 'var(--font-bold)',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-xl)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'nameField',
    type: 'net.noodl.controls.textinput',
    label: 'Your name',
    parent: 'form',
    parameters: { useLabel: true, label: 'Your name' }
  },
  {
    id: 'emailField',
    type: 'net.noodl.controls.textinput',
    label: 'Your email',
    parent: 'form',
    parameters: { useLabel: true, label: 'Your email', type: 'email' }
  },
  {
    id: 'messageField',
    type: 'net.noodl.controls.textinput',
    label: 'Your message',
    parent: 'form',
    parameters: { useLabel: true, label: 'Your message', type: 'textArea' }
  },
  {
    id: 'sendButton',
    type: 'net.noodl.controls.button',
    label: 'Send',
    parent: 'form',
    parameters: { label: 'Send' }
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
      // Rule 2's guard, and here it is also the validation: five producers reach
      // this node (four fields and the page), and an empty submission is a row
      // in someone's inbox that nobody meant to send. Returning is safe —
      // `runOnValueChange` defaults to ticked, so a late value re-runs it.
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
  {
    id: 'sentGate',
    type: 'Condition',
    label: 'Show the confirmation',
    parameters: { condition: true }
  },
  {
    id: 'refusedGate',
    type: 'Condition',
    label: 'Show the refusal',
    parameters: { condition: true }
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
    children: ['nav', 'header', 'sectionList', 'contactWrap', 'notFoundCard', 'footer']
  },
  { id: 'nav', type: '/Site/Nav', label: 'Navigation', parent: 'shell' },
  {
    id: 'header',
    type: 'Group',
    label: 'Header',
    parent: 'shell',
    parameters: { as: 'header', flexDirection: 'column', rowGap: 'var(--space-1)', paddingTop: 'var(--space-8)' },
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
    parent: 'shell',
    parameters: { templateType: 'explicit', template: '/Site/SectionView' }
  },
  {
    id: 'contactWrap',
    type: 'Group',
    label: 'Contact form, when the page asked for one',
    parent: 'shell',
    // 🔴 The wrapper is load-bearing, and the reason is a measurement the door
    // made: **a component instance has only the ports its `Component Inputs`
    // node declares** — no layout, style or lifecycle ports of its own
    // (`instance-unknown-parameter`, blocking: *"The value is discarded"*). So
    // `visible` cannot go on the instance, and a graph that put it there would
    // have shown the contact form on every page.
    parameters: { flexDirection: 'column', mounted: false },
    children: ['contact']
  },
  { id: 'contact', type: '/Site/ContactForm', label: 'Contact form', parent: 'contactWrap' },
  {
    id: 'notFoundCard',
    type: 'Group',
    label: 'The empty-screen card',
    parent: 'shell',
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
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER,
      // Without this a page's sections come back in whatever order the backend
      // returns them, which is what `Section.order` exists to stop.
      visualSort: SECTION_SORT
    }
  },
  {
    id: 'readSections',
    type: 'JavaScriptFunction',
    label: 'Is there a contact section',
    parameters: {
      // The form is shown when the page asked for one. It is a page-level answer
      // because the form is a page-level node — a repeater item cannot be handed
      // the slug it needs (see `Site/SectionView`).
      functionScript:
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = Inputs.rows || [];\n' +
        'Outputs.hasContact = rows.some(function (r) {\n' +
        '  const d = r.data || r;\n' +
        "  return d.kind === 'contact';\n" +
        '});'
    }
  },
  {
    id: 'theme',
    type: 'DbCollection2',
    label: 'Theme (one row)',
    // Unfiltered singleton: boxes ON, same reason as `settings`.
    parameters: { collectionName: 'Theme' }
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
      functionScript:
        "if (typeof document === 'undefined') return;\n" +
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        'const t = first.tokens || {};\n' +
        'const root = document.documentElement;\n' +
        'if (t.colorPrimary) {\n' +
        "  root.style.setProperty('--primary', t.colorPrimary);\n" +
        "  root.style.setProperty('--primary-hover', 'color-mix(in srgb, ' + t.colorPrimary + ' 82%, black)');\n" +
        "  root.style.setProperty('--ring', t.colorPrimary);\n" +
        "  root.style.setProperty('--accent-foreground', t.colorPrimary);\n" +
        '}\n' +
        "if (t.colorOnPrimary) root.style.setProperty('--primary-foreground', t.colorOnPrimary);\n" +
        "if (t.colorBackground) root.style.setProperty('--background', t.colorBackground);\n" +
        'if (t.colorSurface) {\n' +
        "  root.style.setProperty('--surface', t.colorSurface);\n" +
        "  root.style.setProperty('--surface-raised', t.colorSurface);\n" +
        '}\n' +
        "if (t.colorText) root.style.setProperty('--foreground', t.colorText);\n" +
        "if (t.colorTextSoft) root.style.setProperty('--muted-foreground', t.colorTextSoft);\n" +
        'if (t.colorBorder) {\n' +
        "  root.style.setProperty('--border', t.colorBorder);\n" +
        "  root.style.setProperty('--border-subtle', 'color-mix(in srgb, ' + t.colorBorder + ' 45%, var(--background))');\n" +
        "  root.style.setProperty('--border-strong', 'color-mix(in srgb, ' + t.colorBorder + ' 65%, var(--foreground))');\n" +
        '}\n' +
        "if (t.colorAccentSoft) root.style.setProperty('--accent', t.colorAccentSoft);\n" +
        "if (t.radius) root.style.setProperty('--radius-md', t.radius);\n" +
        "if (t.fontDisplay) root.style.setProperty('--font-serif', t.fontDisplay);\n" +
        'if (t.fontUi) {\n' +
        "  root.style.setProperty('--font-sans', t.fontUi);\n" +
        '  root.style.fontFamily = t.fontUi;\n' +
        '}\n' +
        "if (t.measure) root.style.setProperty('--site-measure', t.measure);"
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
  { fromId: 'sections', fromProperty: 'items', toId: 'readSections', toProperty: 'in-rows' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'readSections', toProperty: 'run' },
  { fromId: 'readSections', fromProperty: 'out-hasContact', toId: 'contactWrap', toProperty: 'mounted' },
  // The value a repeater could not carry.
  { fromId: 'readPage', fromProperty: 'out-slug', toId: 'contact', toProperty: 'pageSlug' },

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
  {
    path: 'Site/SectionView',
    key: 'Site/SectionView',
    legacyName: '/Site/SectionView',
    isPage: false,
    nodes: SECTION_VIEW_NODES,
    connections: SECTION_VIEW_WIRES
  },
  {
    path: 'Site/ContactForm',
    key: 'Site/ContactForm',
    legacyName: '/Site/ContactForm',
    isPage: false,
    nodes: CONTACT_FORM_NODES,
    connections: CONTACT_FORM_WIRES
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
