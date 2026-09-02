/**
 * TPL-001 — the members' area, as the arguments the MCP door is given.
 *
 * The shape follows `sb00{4,5,6}Components.ts`: a flat list of components, each
 * one the `nodes`/`connections` payload of a single `create_component` call.
 * `tpl001Template.ts` is the composition that authors them in order, and
 * `tpl001Cloud.ts` is the half that has to run where a caller cannot reach it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 One rule shapes every screen below: nothing loads until the server says who you are
 *
 * A members' area is defined by what a non-member cannot see, and the browser
 * cannot work that out for itself — `_Role` is unreachable from any browser node
 * (`isSystemCollection`: every `_`-prefixed class is `nobody` *regardless of
 * config*), and the obvious substitute is a trap: **a refused query publishes
 * `[]` exactly as an empty one does**. "You are not a member" and "nobody has
 * posted anything yet" are the same reading with opposite screens.
 *
 * So `Members/Standing` asks the server (`myStanding`, in `tpl001Cloud.ts`), and
 * every query in the template is triggered by its answer rather than by the page
 * loading. That is not a UI nicety: with `NO_LOAD_TIME_FETCH` and no other
 * trigger, **a query that never learns you are a member never runs at all**,
 * which is AC2's "not even a flash of content" made structural rather than
 * promised.
 *
 * The server-side refusal is still the boundary — the policy is what makes it
 * true — and every screen here is the polite half in front of it.
 *
 * ## The wiring rules, restated because they bite here too
 *
 * 1. A JavaScript node declares its **signal** outputs in `ports`; values need
 *    no declaration.
 * 2. A value and the signal that acts on it come from the **same node** wherever
 *    one update pass separates them; where two producers are unavoidable, the
 *    consumer opens with a readiness guard on `undefined`.
 * 3. A `Text` whose `text` is wired still carries a standing `text: ''`
 *    parameter — `Text` declares `default: 'Text'`, and a default applies until
 *    the port is set, so a wired-but-unpublished Text renders the literal word
 *    **Text**.
 * 4. A signal cannot drive a `mounted` port: one entry per input name in the
 *    drain queue means a `true`/`false` pair coalesces, so a signal arrives once
 *    as `false`. Every reveal goes through a `Condition` node, whose `result` is
 *    a value.
 * 5. 🔴 **Every gate is `mounted`, never `visible`.** `visible` renders as
 *    `visibility: hidden` (`node-shared-port-definitions.ts`), which *keeps the
 *    box* — so a hidden moderator form left ~500px of nothing on the Post page,
 *    and every gated subtree was still shipped in the document of the person it
 *    was gated against (D7/D16). `mounted: false` keeps the node out of the tree
 *    entirely. The wire shape is identical — both are boolean value ports — so
 *    rule 4 governs `mounted` exactly as it governed `visible`.
 *
 *    ⚠️ The safety of this rests on a fact worth keeping written down: a node
 *    unmounted this way is **not destroyed**. It stays in the graph and its
 *    inputs keep arriving, so a `For Each` inside a gated group still receives
 *    rows published while it is away — `foreach.tsx` either applies them
 *    immediately or queues them and replays on `didMount`. In this template the
 *    question never arises: every query is a parentless logic node triggered
 *    *by* the same standing signal that mounts the group, so the group is
 *    always mounted first.
 *
 * @module noodl-mcp/tests/tpl001Components
 */
import {
  ALREADY_A_MEMBER_HINT,
  ANNOUNCEMENT_SORT,
  CLAIM_REFUSED_TEXT,
  CONFIRM_REMOVE_NO,
  CONFIRM_REMOVE_TEXT,
  CONFIRM_REMOVE_YES,
  REMOVE_ANNOUNCEMENT_LABEL,
  REMOVE_FAILED_TEXT,
  REMOVE_MEETING_LABEL,
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_ASSOCIATION,
  COLLECTION_MEETING,
  COLLECTION_MEMBER,
  COLLECTION_REQUEST,
  FN_CLAIM,
  FN_DECIDE,
  FN_MY_NOTIFY,
  FN_MY_STANDING,
  FN_NOTIFY_MEMBERS,
  FN_REQUEST_ACCESS,
  FN_SET_NOTIFY,
  FN_UNSUBSCRIBE,
  NOTIFY_FAILED_LEAD,
  NOTIFY_NOBODY_TEXT,
  NOTIFY_OPT_IN_LABEL,
  NOTIFY_OPT_IN_NOTE,
  NOTIFY_SAVED_OFF_TEXT,
  NOTIFY_SAVED_ON_TEXT,
  NOTIFY_SAVE_FAILED_TEXT,
  NOTIFY_SENT_PREFIX,
  NOTIFY_SENT_SUFFIX_MANY,
  NOTIFY_SENT_SUFFIX_ONE,
  NOTIFY_NONE_SENT_TEXT,
  NOTIFY_PARTIAL_PREFIX,
  NOTIFY_PARTIAL_SUFFIX,
  NOTIFY_POSTED_LEAD,
  UNSUBSCRIBED_TEXT,
  UNSUBSCRIBE_FAILED_TEXT,
  MEETING_SORT,
  DIRECTORY_PROJECTION_NOTE,
  MEMBERS_READ_RULES,
  NO_ANNOUNCEMENTS_TEXT,
  NO_MEMBERS_TEXT,
  NO_LOAD_TIME_FETCH,
  NO_MEETINGS_TEXT,
  NO_REQUESTS_TEXT,
  STANDING_LABELS,
  PENDING_TEXT,
  REQUEST_REFUSED_TEXT,
  REQUEST_SENT_TEXT,
  ROUTER,
  STANDING_MEMBER,
  STANDING_MODERATOR,
  STANDING_PENDING,
  STANDING_UNKNOWN,
  STANDING_UNKNOWN_TEXT,
  STANDING_VISITOR,
  UPCOMING_FILTER
} from './tpl001Vocabulary';

import { composition, VOCABULARY } from './tpl001Theme';

export { ROUTER };

/** One component, in the shape `create_component` takes. */
export interface Tpl001Component {
  path: string;
  nodes: unknown[];
  connections: unknown[];
  /**
   * Ids of connections that cannot be written on the create pass because they
   * name a component authored later. SB-012's problem: a set of pages that link
   * to each other has genuine reference cycles and no topological order exists,
   * so the create pass omits these and an `update_component` restores them.
   */
  deferred?: string[];
}

/** The one component instance every gated screen places. */
export const STANDING_COMPONENT = '/Members/Standing';
export const CHROME_COMPONENT = '/Members/Chrome';
/** The one node in the runtime that reflows — see `moderatorButtons`. */
const COLUMNS_NODE = 'net.noodl.visual.columns';
export const INSIDE_TILE_COMPONENT = '/Members/InsideTile';
/**
 * The *"what members can see"* band — three photographed tiles on `--surface`.
 *
 * 🔴 **A component since REL-010, and it used to be nine nodes inline on
 * `Pages/Landing`.** The reason is the row's own §2.2, which is VIB-013's
 * finding about the page Richard rated: that page *"is good partly because 129
 * nodes were not hand-written — the compositions were declared once and
 * composed, and every defect its renders caught was in the ~10% written outside
 * that vocabulary."* **The lift is a composition job, not a hand-styling job.**
 *
 * The measurement said the same thing from the other end. After the display
 * tier landed, nine of the thirteen pages read clean and the four that did not
 * were the four doors, all four for `no-imagery` — and the template's only
 * photographed band was sitting on one page, unable to be placed on another
 * because it was not a thing that could be placed.
 *
 * ⚠️ **No `Component Inputs`, deliberately, and the rule is the one
 * `Members/Footer` states**: a component without one *"renders identically
 * however many times you place it"*, which is correct here — the three tiles
 * name three screens that every copy of this template ships, so nothing about
 * them varies per install or per page. The moment one of them did, this would
 * need ports.
 */
export const INSIDE_BAND_COMPONENT = '/Members/InsideBand';
/**
 * The closing prompt — one line and one button on the accent, as a full band.
 *
 * 🔴 **It is the fourth ground on a door page, and it is a real band rather
 * than a repaint.** REL-010 AC4 asks the four public pages for four distinct
 * grounds. Measured after the display tier, `/sign-in` and `/setup` read **2**
 * (the hero's scrim and the footer's `--muted`) and the cheap way to a third
 * was to paint `PAGE_GROUND` with `--background` — which is the colour that
 * ground already appears to be, so it would have moved the number and **changed
 * no pixel**. That is the board's own hazard 2 run backwards, and it is the
 * definition of designing for the instrument.
 *
 * So the fourth ground has to be something a person can see, and there was one
 * already owed: `/sign-in` ended in *"Not a member yet?"* and a button sitting
 * loose on the page ground under the form, which is the weakest way a page can
 * end. `ui-landing-page` closes on a `ClosingCta` band and this is that, at the
 * scale a door page deserves.
 */
export const PROMPT_COMPONENT = '/Members/Prompt';
/**
 * The foot of every page — REL-002c item 4.
 *
 * 🔴 **A COMPONENT rather than four nodes repeated thirteen times, and the
 * reason is §E-ii rather than tidiness.** The two lines in it are `EDIT ME —`
 * placeholders that the association installing this template has to visit and
 * replace. Written inline on each page they would be twenty-six strings to
 * find; as one component they are two, and the editor's node tree lists them
 * once.
 */
export const FOOTER_COMPONENT = '/Members/Footer';

/** The repeater templates, named once so a page and its row cannot drift apart. */
export const ANNOUNCEMENT_ROW = '/Members/AnnouncementRow';
export const MEETING_ROW = '/Members/MeetingRow';
export const REQUEST_ROW = '/Members/RequestRow';
export const MEMBER_ROW = '/Members/MemberRow';

/** Page path parameters, spelled once for the `urlPath` and the `PageInputs`. */
const ANNOUNCEMENT_PARAM = 'announcementId';
const MEETING_PARAM = 'meetingId';
/** TPL-002 — the query parameter the unsubscribe link carries. */
const UNSUBSCRIBE_PARAM = 'token';

// ── The look, from the product's own vocabulary ──────────────────────────────
//
// 🔴 Every set below is `composition(id)` — the parameters `get_style_vocabulary`
// reports, not a typed copy of them. See `tpl001Theme.ts` on why the difference
// matters: a copy agrees with the design system until the first change to
// either, and then the template wears a look the product no longer has while
// every spec stays green.
//
// ⚠️ Only parameters a composition uses for that node type are set. The
// vocabulary is the product's statement of what is legal per element — `Text`
// carries the type ramp and `Group` carries the surfaces — and a `backgroundColor`
// on a `Text` would be a parameter the runtime never reads, which is
// indistinguishable from a style that did not apply.

/** The card shell and its padded body, merged: a row IS the card here. */
const CARD = composition('card');
const CARD_BODY = composition('cardBody');

/**
 * The type ramp. One `H_HERO` in the whole app, on the landing page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 REL-010 — the display tier, and the template had been OVERRIDING the fix
 *
 * Measured 2026-09-02 on `vib001-members.poverty.look.ts`: **twelve of the
 * thirteen pages topped out at 30px and the thirteenth at 48**, against the
 * VIB-006 page Richard called *"fucking pro"* at **94px**. `no-display-type`
 * fired on twelve of them. It is README §2's tell verbatim and the single
 * biggest measured gap in the row.
 *
 * 🔴 **And the cause was one parameter, in this file.** `displayHeadline`
 * already carries `fontSize: 'var(--display-lg)'` — VIB-002 / register V13
 * replaced the fixed `--text-6xl` with a `clamp()` precisely because *"the
 * members-area hero is 48px, exactly the ceiling, and reads as a paragraph that
 * got bigger rather than as a hero"*. The product was fixed. **This line then
 * overrode the fix back down to the ceiling it was written to lift**, and every
 * session since graded the result against a page carrying the same override.
 *
 * The three tiers below are the three fluid tokens, and nothing else:
 *
 * | | token | 390px | 1280px | worn by |
 * |---|---|---|---|---|
 * | `H_HERO` | `--display-lg` | 44px | **94px** | `/` — the one hero |
 * | `H_DOOR` | `--display-md` | 36px | **72px** | `/sign-in` `/join` `/setup` |
 * | `H_PAGE` | `--display-sm` | 30px | **48px** | the nine app-chrome pages |
 *
 * ⚠️ **Three tiers rather than one, because "as good as the homepage" is not
 * "looks like the homepage".** Richard ruled §3.1 on 2026-09-02 — *density and
 * decision, not billboards* — so a settings page gets a heading that operates
 * as display type and not a heading that operates as a marketing hero.
 *
 * ⚠️ **`--display-sm` lands on exactly 48px at 1280 and the floor is `< 48`**
 * ([`nodegx-render-measure/src/index.js:945`](../../nodegx-render-measure/src/index.js#L945)),
 * so it clears by nothing at all. That is deliberate and it is a statement about
 * the TOKEN, not a number fitted to the gate: `--display-sm`'s ceiling is
 * `3rem`, the rubric's threshold is the same 48px, and both were chosen from
 * README §2 independently. A tier picked to beat the gate by a margin would be
 * a tier picked by the gate.
 */
const H_HERO = composition('displayHeadline');
const H_DOOR = { ...composition('displayHeadline'), fontSize: 'var(--display-md)' };
const H_PAGE = {
  ...composition('sectionHeading'),
  fontSize: 'var(--display-sm)',
  // ⚠️ The pair `DefaultTokens.ts` says to pair a display token with, and the
  // reason is in its own comment: *"at 96px the normal line height and tracking
  // are what make large type look like enlarged body copy instead of set display
  // type."* `sectionHeading` ships `--leading-tight`, which is right for 30px
  // and slack at 48.
  lineHeight: 'var(--leading-none)'
};
/**
 * The heading of a BAND on the landing page — *"About us"*, *"What members can
 * see"*. Deliberately **not** promoted with the three tiers above.
 *
 * 🔴 **Measured on the benchmark rather than reasoned about.** A font-size
 * census of the VIB-006 page (`docs/node-catalog/examples/ui-landing-page.json`,
 * the artefact Richard rated) reads: **one `--display-lg`, one `--display-md`,
 * four `--text-3xl`, one `--text-xl`, and eighteen `--text-sm`.** Its section
 * headings are 30px — the *same size the members-area's already were*.
 *
 * So the gap this row is closing is the **top of the ramp, not the ramp**. Both
 * pages set their sections at 30px; VIB-006 then runs to **94**, and the
 * members-area ran to **30**. A ramp with a range of 1:1 is what README §2 means
 * by *"type ramp reading as two sizes"*, and promoting the section heads too
 * would have flattened it again one tier higher up — an edit that moves the
 * measured number and makes the page worse.
 *
 * ⚠️ **This is the reading that stopped `H_PAGE` being applied here by
 * accident.** These two nodes wore `H_PAGE`, because a landing band's heading
 * and a page's heading had never needed telling apart. They do now.
 */
const H_BAND = composition('sectionHeading');
const H_SECTION = composition('cardTitle');
const T_CARD_TITLE = composition('cardTitle');
const T_LEAD = composition('lead');
const T_META = composition('meta');
const T_BODY = composition('body');

/**
 * The small uppercase line above the hero — `--primary` at **7.36:1** on
 * `--background`, measured, and one of the at-most-three places the accent
 * colour is spent.
 *
 * ⚠️ **It is a literal where the name and blurb are records, and the split is
 * deliberate.** "Members' area" is a fact about *this template* — every install
 * of it is one — whereas the association's name is a fact about the *recipient*,
 * which is why that one comes out of a row a person can edit without opening the
 * editor. A template that hard-codes the first is honest; one that hard-codes
 * the second needs a developer to rename a church.
 */
const T_EYEBROW = composition('eyebrow');

/**
 * The words inside a notice, toned to the box they sit in.
 *
 * Every pair is measured against the surface it actually lands on rather than
 * against the page — a notice's text sits on `--surface` or `--accent`, never on
 * `--background`, and grading it against the wrong ground is how a legible
 * number gets recorded for an illegible screen.
 *
 * | text | on | ratio | floor |
 * |---|---|---|---|
 * | `--muted-foreground` | `--surface` | **6.62** | 4.5 |
 * | `--accent-foreground` | `--accent` | **6.45** | 4.5 |
 * | `--destructive` | `--surface` | **5.96** | 4.5 |
 */
const T_NOTICE = { ...T_META };
const T_NOTICE_ACCENT = { ...T_META, color: 'var(--accent-foreground)' };
const T_REFUSED = { ...T_META, color: 'var(--destructive)' };

/**
 * A confirmation that lives INSIDE a panel, and so is coloured rather than boxed.
 *
 * ⚠️ The reason it is not a `notice()` like every other confirmation: the two on
 * `Pages/Post` sit inside the form panel they confirm, and a card inside a card
 * has no edge. `--accent-foreground` on `--surface` is **6.95:1**.
 */
const T_CONFIRM = { ...T_META, color: 'var(--accent-foreground)' };

// ── The surfaces a page is made of ───────────────────────────────────────────
//
// 🔴 **The four repeater rows were the only cards in the app.** Every notice,
// every empty state, every refusal and every form sat as bare text directly on
// the page ground, and **31 `Text` nodes carried no type ramp at all** — no
// size, no colour, nothing. The appearance ratchet was green over all of it,
// because it asks whether the design system was opened (`> 0`), not whether it
// was finished. That is the gap §4 of this file's gate now closes by name.
//
// ⚠️ **A section that HOLDS cards does not get a card.** `card` fills with
// `--surface`, so a list wrapped in one puts `--surface` rows on a `--surface`
// ground: the row borders measure **1.26:1** against it and the list reads as
// one block with hairlines through it rather than as separate cards. The
// sections below are transparent on purpose, and that is a measurement rather
// than a preference.

/** A notice: one sentence a person is meant to read, in a box that says so. */
const NOTICE = { ...CARD, ...CARD_BODY };

/**
 * The "you are on your way" notice — waiting to be approved, request received.
 *
 * ⚠️ The accent was introduced for exactly this and had no reader until now:
 * `tpl001Theme.ts` describes it as *"the primary at a whisper, for the eyebrow
 * and the pending notice"*, and the pending notice was plain grey text.
 */
const NOTICE_ACCENT = { ...NOTICE, backgroundColor: 'var(--accent)' };

/**
 * A form's panel. A wider gap than a card body carries, because these hold
 * labelled controls rather than lines of prose.
 */
const PANEL = { ...CARD, ...CARD_BODY, rowGap: 'var(--space-4)' };

/**
 * The hero's words, as the one group the vocabulary already had a name for.
 *
 * 🔴 `sectionHead` was listed in `USED_COMPOSITIONS` and used by nothing — see
 * the note there. It is exactly this: eyebrow, headline and lead stacked at
 * `--space-3`, with the air before the content built into its own padding.
 *
 * ⚠️ **Its `paddingBottom` is overridden, and the reason is a measurement.** At
 * the composition's `--space-10` the rendered page put **60px above the two
 * buttons and 21px below them**, so they read as the heading of the section
 * beneath rather than as the hero's call to action — the closer thing wins, and
 * the closer thing was the wrong one. `--space-6` puts them 44px under the blurb
 * against 68px above "What members can see". The composition is right for a
 * section head whose content is a block; these buttons belong to the head.
 */
const HERO_HEAD = { ...composition('sectionHead'), paddingBottom: 'var(--space-6)' };

// ── §D — the hero stands on a photograph, and everything on it turns light ───
//
// 🔴 **The template contained no images at all**, and *"no imagery and no
// iconography anywhere"* is a fired tell on the landing page's baseline verdict
// (README §2). Richard ruled photographs on the two public pages, icons only
// inside the gated area (§D of `RICHARD-RULINGS-2026-09-01.md`).
//
// ✅ **It costs the template zero bytes.** `STARTER_ASSETS` installs the 44 CC0
// photographs into every project as `noodl_modules/starter-imagery/`, and the
// template submission's excluded-files list is derived from that same constant —
// so this REFERENCES a file every install already has, and ships none of it.
//
// ⚠️ **`people-meeting` is chosen by SUBJECT, which is the rule the corpus
// states**: *"a page whose every image is the same abstract is decorated, not
// designed"*. A members' area is people in a room; a texture would have been
// decoration.

/**
 * The photograph a landing hero stands on, with the scrim that keeps type legible.
 *
 * ⚠️ **`people-coffee-shop`, and `people-meeting` was tried first and rendered
 * wrong.** The catalogue lists both under subject `people`; the first is a room
 * full of people sitting together, the second is a desk with a bag, a tablet and
 * two pairs of hands. A members' area is a group of people who belong somewhere,
 * so the room is the subject and the desk is stock photography. Graded by
 * rendering both, which is the only way this is gradeable.
 *
 * ⚠️ **`justifyContent` is the composition's own `flex-end` and an override back
 * to `center` was wrong.** The scrim is a VERTICAL gradient, darkest at the
 * foot — that is what `imageGround`'s description says it is for. Copy centred
 * in the frame sits in the weakest part of it, which is what the first render
 * showed: legible, but only because the panel carried its own glass.
 */
const HERO_GROUND = {
  ...composition('imageGround'),
  backgroundImage: 'noodl_modules/starter-imagery/people-coffee-shop.webp',
  height: { value: 560, unit: 'px' }
};

/**
 * A shell inside an `imageGround`.
 *
 * 🔴 **`sizeMode: 'contentHeight'` is not optional and the corpus records why**
 * (register V1, in `imageGround`'s own tool description): without it the shell
 * takes the runtime's 100%×100% default, becomes `flexGrow: 100` in a column,
 * fills the whole band — and the band's `justifyContent` then has nothing left
 * to justify, so the copy sits silently at the top with the scrim's dark end
 * empty below it.
 */
const HERO_SHELL = {
  ...composition('shell'),
  sizeMode: 'contentHeight',
  alignX: 'center',
  rowGap: 'var(--space-5)'
};

/**
 * The SECOND public page's photograph, and the band it stands in.
 *
 * 🔴 **`/join` is the other half of §D and it had nothing.** Richard's ruling is
 * *"photographs on `/` (hero ground) and `/join`"*; session 7 built the first and
 * left the second, so a stranger who clicked *Ask to join* went from a
 * photographed hero to a bare white form — the one transition on this template
 * where the two public pages are seen back to back.
 *
 * ⚠️ **`people-meeting`, and the landing's own comment argues AGAINST it — for
 * a different page.** Session 7 rejected it as a hero because *"a members' area
 * is a group of people who belong somewhere, so the room is the subject and the
 * desk is stock photography"*. That judgement is about a 560px hero whose job is
 * to say what the association IS. This band's job is to say what THIS PAGE is,
 * and the page is one person asking two others to let them in: a notebook, two
 * coffees and four hands across a table is that, exactly.
 *
 * ⚠️ **`people-market` was built first and rendered wrong, which is how the
 * shape of the band picked the picture.** Cropped to 300px it is a pair of hands
 * and a heap of limes with no readable subject at all — the catalogue's `says`
 * (*"a market seller weighing limes"*) describes the FULL 4:3 tile, and a third
 * of a tile is a different photograph. `people-meeting`'s subject runs
 * horizontally across the table, so a 300px band keeps all of it.
 *
 * ⚠️ **The two public pages must not share a picture** — a form page repeating
 * the hero's own photograph reads as a page that failed to load its own.
 *
 * ⚠️ **300px, not the hero's 560.** This band is the page's orientation and not
 * its content: the content is the form below it, and a half-viewport photograph
 * above a form pushes the first field under the fold at 900px tall — measured on
 * the `preview` viewport, which is the shortest of the four.
 */
const JOIN_GROUND = {
  ...composition('imageGround'),
  backgroundImage: 'noodl_modules/starter-imagery/people-meeting.webp',
  height: { value: 300, unit: 'px' }
};

/**
 * The ground a PUBLIC page's bands stand on.
 *
 * 🔴 **Lifted from `Pages/Landing`'s `landingGround` rather than copied by
 * hand**, and the reason is the third item in session 7's carry-out list:
 * `height: 100%` is inert everywhere in this template because the parent chain
 * ends at a `Router`, which sizes itself to its content. `minHeight` is the one
 * dimension port that takes `vh`
 * ([`node-shared-port-definitions.ts:1227`](../../noodl-viewer-react/src/node-shared-port-definitions.ts#L1227)),
 * so it floors a page at the viewport without asking anybody. A `/join` built on
 * `PAGE_GROUND` would have ended in a strip of bare white under the form for
 * exactly the reason the landing page did.
 */
const BAND_PAGE_GROUND = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  minHeight: { value: 100, unit: 'vh' },
  flexDirection: 'column',
  // 🔴 **`space-between`, and `flex-start` was rendered first and was wrong.**
  // The floor is `minHeight: 100vh`, so in the DOOR state — where every band but
  // the hero and the footer is unmounted — `flex-start` stacked a 560px
  // photograph and a footer directly under it and left **270px of bare
  // `--muted` below a finished footer**. That is the exact defect session 7's
  // footer band was added to end, moved down the page by one element rather than
  // fixed. `space-between` pins the last band to the foot whenever there is
  // slack, and is a no-op the moment the content is taller than the viewport,
  // which is every living state.
  justifyContent: 'space-between',
  backgroundColor: 'var(--muted)'
};

/**
 * Type on the scrim.
 *
 * ⚠️ Every one of these overrides a colour that is correct on `--background` and
 * illegible on a photograph. `--primary-foreground` is `#ffffff`, which is what
 * `ui-landing-page` puts on its own scrim.
 */
const ON_SCRIM = { color: 'var(--primary-foreground)' };

/**
 * The secondary action, ON A PHOTOGRAPH.
 *
 * 🔴 **`outlineButton` is invisible here and that is a contrast fact, not a
 * preference.** It paints `transparent` behind `--foreground` text inside a
 * `--border-control` hairline — three values all chosen against `--background`.
 * On the scrim the text is near-black on near-black. The glass tokens are the
 * kit's own answer to a control on a picture: `--surface-glass` behind
 * `--primary-foreground`, edged in `--border-glass`.
 */
function onScrimBtn(label: string): Record<string, unknown> {
  return {
    label,
    ...withoutInertBorderWidth(composition('outlineButton')),
    backgroundColor: 'var(--surface-glass)',
    borderColor: 'var(--border-glass)',
    color: 'var(--primary-foreground)'
  };
}

/**
 * A panel that sits ON the hero photograph — the two states a stranger can meet
 * before the association exists.
 *
 * 🔴 **§F: `waitingCard` wears this, and it is the literal first frame of a
 * fresh install.** `mounted` defaults to `true`
 * (`react-component-node.ts:1900`), and this is the only node in the template
 * that keeps the default — so it is what a person sees before any query has
 * answered. It used to be a grey `--muted` box in the middle of a white page;
 * as a glass panel on the photograph it is a designed state rather than the
 * absence of one.
 */
const SCRIM_PANEL = {
  ...composition('glassPanel'),
  flexDirection: 'column',
  alignItems: 'flex-start',
  rowGap: 'var(--space-3)',
  maxWidth: { value: 640, unit: 'px' },
  paddingTop: 'var(--space-6)',
  paddingBottom: 'var(--space-6)',
  borderRadius: 'var(--radius-xl)'
};

/**
 * One tile in "what members can see".
 *
 * ⚠️ **The fill is not what makes it read as a tile.** `--surface` on
 * `--background` measures **1.06:1** — invisible. The hairline does the work at
 * **1.33:1**, which is the ratio `tpl001Theme.ts` already describes as
 * deliberate for `--border`. Recorded because "I added a background and it looks
 * like a card" is a conclusion the numbers here do not support; the edge is
 * load-bearing and removing it would leave three unpainted paragraphs.
 *
 * ⚠️ **Two `Text` children, and that is load-bearing for the gate.** §2 of the
 * ratchet counts a `Group` wrapping *exactly one* `Text` as a notice box and
 * pins the total at 17. A tile is a title and a line, so it is not one — but a
 * tile that lost its second `Text` would silently become an 18th notice and
 * redden a spec that is about something else entirely.
 */
const TILE = { ...CARD, ...CARD_BODY };

/**
 * A section that groups things on the page ground — **no fill, on purpose**.
 * See the note above on why a card inside a card has no visible edge.
 */
const SECTION = {
  width: { value: 100, unit: '%' },
  flexDirection: 'column',
  rowGap: 'var(--space-4)'
};

/**
 * One card in a list.
 *
 * 🔴 **The gap is the whole difference between a list of cards and a block.**
 * `For Each` renders its rows as siblings inside itself, so a `rowGap` on the
 * section above never reaches between them — the row has to carry its own.
 * Without it every announcement card's border sat flush against the next one's.
 */
const ROW_CARD = { ...CARD, ...CARD_BODY, marginBottom: 'var(--space-4)' };

/**
 * One row in a LIST — a hairline under it, and no fill at all.
 *
 * 🔴 **B3, and the defect it ends was that every list was a stack of cards.**
 * Eight announcements, six meetings and a directory of members each rendered as
 * a boxed object 175–200px tall carrying one line of information, so a
 * noticeboard read as eight things rather than as one list of eight. The cause
 * was in the kit rather than in this template: of eighteen compositions exactly
 * **two** carried a content fill and both were `--surface`, so `card` was the
 * only way to say "this is a thing". P80 C1 added the second surface and this
 * row, both lifted from `ui-data-table`.
 *
 * ⚠️ **The card was never doing the work its fill claimed.** `--surface` on
 * `--background` measures **1.06:1** — invisible, as `TILE` already records. A
 * card here was read entirely by its hairline, which is exactly what `ruled` is:
 * the same amount of visual information at a quarter of the height, and without
 * the "separate object" reading that a box carries whether or not you can see
 * its fill.
 *
 * 🔴 **No `marginBottom`, and that is the opposite of `ROW_CARD`'s.** A card
 * needs the gap or its border sits flush against the next one's (§13). A ruled
 * row needs the rows to TOUCH: the hairlines are what make eight of them one
 * list, and air between them would make eight underlined paragraphs.
 *
 * ⚠️ The gap is this template's, not the composition's — `ruled` carries none,
 * and `laidOut` is what keeps it the one the runtime reads: `group.ts:473-482`
 * makes `columnGap` conditional on `flexDirection = row`, so a `rowGap` here
 * would be a parameter nothing reads.
 */
const RULED_ROW = laidOut('row', { ...composition('ruled') }, 'var(--space-4)');

/**
 * A ruled row with an ACTION at its far edge — and only ever an action.
 *
 * 🔴 **A sentence cannot go on the right of one of these, and that is a
 * measurement rather than a preference.** The directory row was built this way
 * first, with the standing against the right edge, and at 390px it broke the
 * addresses mid-word: `ada@example.invali / d`. This runtime gives a child of a
 * row exactly two behaviours — a percentage width becomes `flexGrow` **and
 * opts back into shrinking**, and anything else is content-sized with
 * `flexShrink: 0` (`layout.ts:79-88`). There is no third. So a content-sized
 * right-hand child takes its full width out of the row at every viewport and
 * the growing column absorbs the whole squeeze.
 *
 * A button survives that because it is short and its width does not depend on
 * the record; `Member · since 29 August 2026` measured **197px of a 342px row**
 * and left 129px for a name and an address. Same family as D28, one step out:
 * there the content-sized child ignored the box `Columns` handed it, here it
 * ignores the room the row has left.
 *
 * ⚠️ `space-between` and the gap are the pair `Members/Chrome`'s `topRow`
 * already carries, for the reason recorded there: `space-between` puts air
 * between two things only while there IS air, and at 390px the gap is what
 * stops the words running under the button.
 */
const RULED_ROW_SPLIT = { ...RULED_ROW, justifyContent: 'space-between' };

/**
 * The words in a ruled row: what the row is, and what it says about itself.
 *
 * 🔴 **It has to grow, and there is no `grow` port — a PERCENTAGE WIDTH is how
 * this runtime spells it.** `layout.ts:83-88`: inside a `row` parent a
 * percentage width becomes `flexGrow` and re-enables shrinking, which is the
 * mechanism `card`'s own description means by *"width 100% lets the column size
 * it"*. That is the whole of it — the width is the load-bearing half.
 *
 * ⚠️ **`sizeMode` is a choice here, not a requirement, and the first draft of
 * this comment had that wrong.** It claimed `contentHeight` was what made the
 * column grow. Sabotaged by deleting it and re-rendered: the row measured
 * **identically**, 612px beside an 84px button. A `Group` defaults to
 * `explicit` (`node-shared-port-definitions.ts:755`), which assigns the width
 * too, so growth survives its absence. `contentHeight` stays because it is the
 * true statement about this column — it is as tall as its lines — and because
 * `explicit` would also hand it a height it has no business declaring. What
 * would really stop it growing is `contentSize` or `contentWidth`, the two modes
 * that never write a width at all, and §7 of the ratchet is about those.
 *
 * ⚠️ **Never fewer than two `Text` children.** §2 of the ratchet counts a
 * `Group` wrapping exactly one `Text` as a notice box and pins the total; a row
 * whose second line was dropped would silently become an extra notice and redden
 * a spec about something else entirely. Same trap `TILE` records.
 */
const ROW_LINES = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  flexDirection: 'column',
  rowGap: 'var(--space-1)'
};

/**
 * The page's one action gets the filled button; everything else is the outline.
 *
 * 🔴 **`variant` is connection-only on this node**, which the `primaryButton`
 * composition says in its own description — so a template cannot ask for
 * "primary" by name and must set the concrete parameters. That is exactly the
 * kind of thing a generator skips and a person notices.
 *
 * ⚠️ Keyed on the label already written on the button rather than on a new id,
 * so there is one place a button's words live. A label not listed here is the
 * outline, which is the safe default: a screen with two filled buttons has no
 * primary action at all.
 */
const PRIMARY_LABELS: ReadonlySet<string> = new Set([
  'Members sign in',
  'Sign in',
  'Set it up',
  'Send my request',
  'Set up this members\u2019 area',
  'Post it',
  'Add it to the diary',
  'Approve',
  // s8. `Pages/Members` had FIVE buttons and every one of them was the outline,
  // so the busiest screen in the template had no main action at all.
  //
  // ⚠️ **Correcting this file's own framing**: the fix is not "every page gets a
  // filled button". Five of eleven pages have no primary and four of those are
  // right to — `Meetings`, `Directory` and the two detail pages are for reading,
  // and a filled button on a page whose job is to be read invents an urgency
  // that is not there. `Pages/Members` was the real one: a moderator arrives to
  // post something, and that action looked exactly like "Who belongs".
  'Post something'
]);

/**
 * 🔴 **And one defect in the composition itself, repaired at the point of use.**
 *
 * `primaryButton` ships `borderStyle: 'none'` AND `borderWidth: 0`, and the door
 * warns on every single instance: *"borderWidth only applies when borderStyle is
 * solid or dashed or dotted, so this parameter is never read."* Twelve warnings
 * on the first run — from following the design system's own recipe verbatim.
 *
 * Dropping the inert parameter is stated as a RULE rather than as a special case
 * on `primaryButton`, so it stops applying by itself the day the composition is
 * fixed, and so a second composition with the same shape is covered without
 * anyone noticing it needed to be. Recorded in the phase's defect log — the
 * composition is the product's, not this template's.
 */
/**
 * A `Condition` used purely to turn a signal into a value — with its own
 * value-change trigger turned OFF.
 *
 * 🔴 **The defect this ends was shipped and visible.** Seven `Condition` nodes
 * in this template carry a constant `condition: true` and are triggered by
 * `eval`. Wiring `eval` does NOT stop the node testing on value change — the
 * port's own description says so: *"This is additional to Condition re-testing
 * on change; untick it under Run On Value Change to stop that."* So the constant
 * parameter arriving at load counted as a change, every gate evaluated true
 * before anything had happened, and every `mounted: false` it governs was
 * overridden on the first frame.
 *
 * ⚠️ **What that looked like to a person**: the setup page greeted them with
 * *"This members' area cannot be set up with those details"* before they had
 * typed a character. Found by rendering the artefact and looking at the picture
 * — 41 byte-identity specs, 45 drive specs and two typechecks were green over
 * it, and the artefact on disk is correct: `mounted: false` is right there on
 * the node. Only the running app disagrees.
 *
 * ⚠️ **Set explicitly rather than left to the migration.** A load-time migration
 * writes `runOnChange-*: false` where the control signal is wired, but it is a
 * migration — it runs where projects are loaded, and the render harness that
 * caught this reads the artefact from disk without it. A template must be
 * correct as written, not correct once something has fixed it.
 *
 * 🔴 Same family as the two guard nodes fixed last session (`Run` is ADDITIVE,
 * so a readiness-guarded JavaScript node fires again on the run signal). Third
 * time this shape has bitten this template.
 */
/**
 * A form field with an edge you can see.
 *
 * ⚠️ **Not a composition, because the vocabulary does not ship one** — it has
 * `primaryButton` and `outlineButton` and nothing for the control a person
 * actually types into, which is seventeen nodes in this template. Written here
 * rather than invented per page so there is one field in the app.
 *
 * 🔴 **`--border-control`, not `--border`.** The vocabulary's own `textinput`
 * `default` variant is `{ borderColor: var(--border) }`, and `--border` measures
 * **1.33:1** against the background — under the 3:1 that WCAG 1.4.11 requires of
 * a control boundary. The `outlineButton` composition already documents this
 * exact trap for buttons (*"a control border needs 3:1 and no --border* token
 * reaches it"*) and reaches for a darker token; nobody carried the fix across to
 * inputs. `--border-control` measures **5.49:1**. Recorded in the defect log.
 */
const FIELD = {
  // 🔴 `width` is INERT without this, and the door refused the write and said so
  // in one sentence with the repair in it: *"it only applies when sizeMode is
  // explicit or sizeMode is contentHeight"*. `contentHeight` rather than
  // `explicit` because a field should still be as tall as its own content —
  // `explicit` would demand a height here as well.
  sizeMode: 'contentHeight',
  width: { value: 100, unit: '%' },
  backgroundColor: 'var(--background)',
  borderStyle: 'solid',
  borderWidth: 'var(--border-1)',
  borderColor: 'var(--border-control)',
  borderRadius: 'var(--radius-md)',
  paddingLeft: 'var(--space-3)',
  paddingRight: 'var(--space-3)',
  paddingTop: 'var(--space-2)',
  paddingBottom: 'var(--space-2)',
  fontSize: 'var(--text-base)',
  color: 'var(--foreground)'
};

const CONDITION_GATE = { condition: true, 'runOnChange-condition': false };

// ── §D — iconography, and it lives INSIDE the gate ────────────────────────────
//
// 🔴 **Richard's §D ruling has two halves and only one of them was built.**
// *"Photographs on the public pages, icons only inside the gated area."* Session
// 7 put the photograph on `/`; the eight signed-in screens stayed entirely
// typographic, which is *"no imagery and no iconography anywhere"* — a fired
// disqualifying tell on the VIB-001 baseline — still true of two thirds of the
// template.
//
// ✅ **Zero template bytes, exactly as the photograph was.** `STARTER_ASSETS`
// installs `noodl_modules/lucide-icons/` into every project, and the submission's
// excluded-files list derives from that same constant. This references a font
// every install already has.
//
// 🔴 **Three fields, and the third is what makes it a glyph rather than the
// glyph's NAME in 24px type.** `IconGlyph.tsx` branches on `codeAsClass`: true
// puts the code among the element's classes, anything else puts it in the
// element's *text*. VIB-003 filed the whole defect — `{class, code}` alone is
// two thirds of a correct value and renders the string `icon-users`.
//
// ⚠️ **Every name below is in the CURATED 215**, not merely in the font. Lucide's
// manifest `_note` is right that the bundled font carries all 1,998 and
// `styles.css` has a rule for each — `icon-megaphone` and `icon-handshake` were
// the first two picks and both draw — but the door validates against the
// manifest's list, and a name outside it is a refusal waiting for the next
// person who regenerates. Checked, name by name, against
// `noodl_modules/lucide-icons/manifest.json`.
function glyph(code: string): Record<string, unknown> {
  return { class: 'lucide', code: `icon-${code}`, codeAsClass: true };
}

/**
 * The glyph a page head wears, in the tinted square that stops it reading as a
 * stray mark.
 *
 * 🔴 **Different glyph per screen, and that is the difference between
 * iconography and decoration.** The corpus states the rule for photographs —
 * *"a page whose every image is the same abstract is decorated, not designed"* —
 * and it holds identically here: a newspaper repeated on eight screens says
 * nothing, where eight distinct glyphs say which screen this is before the
 * heading is read. That is also why the glyphs are NOT on the list rows: eight
 * announcements each wearing the same mark is the decorated case exactly.
 *
 * ⚠️ `--accent` behind `--accent-foreground` measures **6.45:1** (`tpl001Theme.ts`),
 * so the square is a legible pairing rather than a tint chosen by eye. It is the
 * same pair the pending notice already wears, so the app has one accent idea and
 * not two.
 */
const HEAD_BADGE = {
  sizeMode: 'explicit',
  width: { value: 44, unit: 'px' },
  height: { value: 44, unit: 'px' },
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--accent)',
  borderRadius: 'var(--radius-lg)'
};

/**
 * The row a badged page head sits on.
 *
 * 🔴 **A wrapper AROUND `{id}Head`, never a third child INSIDE it, and the gate
 * is what dictates that.** §5 of the ratchet reads a page's eyebrow as *the head
 * Group's first child* — `component.nodes.find(n => n.type === 'Group' &&
 * /Head(-\d+)?$/.test(n.id))`, then `children[0]`. A glyph inserted into the head
 * would have moved the eyebrow to index 1 and reported all eight badged pages as
 * carrying the eyebrow `''`, which the spec compares against a hand-written
 * table. The wrapper's id ends in `Row`, so it is not what §5 matches, and the
 * head it holds is unchanged.
 *
 * ⚠️ **`alignItems: center`, not `featureItem`'s `flex-start`.** That
 * composition centres a glyph on the first line of a title because its body is a
 * paragraph that can run to four lines. A page head is two short lines of known
 * height, and a 44px square top-aligned against them sits above the eyebrow
 * rather than beside the pair.
 *
 * ⚠️ **`paddingBottom` moves OUT of the head and onto this row**, because §6
 * counts a Group as a "section" when it has no `paddingBottom`, more than one
 * child and `flexDirection: column`. Leaving the padding on the inner head is
 * correct for §6 (which excludes it) but leaves the row itself as a `row`, which
 * §6 also excludes. Both are excluded either way; the padding stays on the head
 * so an UNBADGED page and a badged one keep the same air under their heading.
 */
const HEAD_ROW = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  flexDirection: 'row',
  alignItems: 'center',
  columnGap: 'var(--space-4)'
};

/**
 * DEF-006 (a) / AC5 — proof that {@link withoutInertBorderWidth} has nothing
 * left to remove, exported so the suite can assert it rather than the comment
 * claim it.
 *
 * Every composition the vocabulary ships, not the ones this template happens to
 * apply: "the workaround is a no-op over what we use" and "the product no longer
 * needs the workaround" are different sentences, and only the second is what
 * lapsing means.
 */
export function compositionsStillNeedingInertBorderWidthRemoval(): string[] {
  return (VOCABULARY.compositions as Array<{ id: string; parameters: Record<string, unknown> }>)
    .filter((c) => Object.keys(withoutInertBorderWidth(c.parameters)).length !== Object.keys(c.parameters).length)
    .map((c) => c.id);
}

/**
 * ✅ **DEF-006 (a) — this has lapsed, which is what it was written as a rule to
 * do.** It repaired `primaryButton` at the point of use because the composition
 * shipped `borderStyle: 'none'` beside a `borderWidth`, and `borderWidth` is
 * declared `borderStyle = solid OR dashed OR dotted` — so applying the design
 * system verbatim earned an `inactive-conditional-parameter` per button. That
 * was one template's workaround for a defect every agent had.
 *
 * The composition no longer carries it, nor does `ui-split-hero`, which is where
 * the value was copied from. This is now a no-op over every composition the
 * vocabulary ships, and `tpl001Template.test.ts` asserts that rather than taking
 * this comment's word for it.
 *
 * 🔴 **Kept, not deleted.** It is a rule about a shape, not a patch on one
 * value: a composition added tomorrow that sets a width under a `none` border
 * would be caught here as well as by the vocabulary's own gate. Deleting it
 * would also delete the evidence that the product fix landed.
 */
export function withoutInertBorderWidth(params: Record<string, unknown>): Record<string, unknown> {
  if (params.borderStyle !== 'none') return params;
  const { borderWidth, ...rest } = params;
  return rest;
}

/**
 * Lay a surface out in one direction, carrying only the gap that direction reads.
 *
 * 🔴 **Same family as `withoutInertBorderWidth`, and the same defect.**
 * `group.ts:473-482` makes `columnGap` conditional on `flexDirection = row` and
 * `rowGap` conditional on `flexDirection = column`, so the wrong one of the pair
 * is a parameter the runtime never reads — which is indistinguishable from a gap
 * that did not apply. `PANEL` carries a `rowGap`, so spreading it onto a row of
 * buttons would have shipped exactly that.
 *
 * Written as a rule over the direction rather than fixed at the one call site
 * that needed it, so a Group that later changes direction cannot keep a stale
 * gap behind it.
 */
function laidOut(
  direction: 'row' | 'column',
  params: Record<string, unknown>,
  gap: string
): Record<string, unknown> {
  const { rowGap, columnGap, ...rest } = params;
  return direction === 'row'
    ? { ...rest, flexDirection: 'row', columnGap: gap }
    : { ...rest, flexDirection: 'column', rowGap: gap };
}

/**
 * The one date format in the template, as a snippet every site embeds.
 *
 * 🔴 **There were three, and two of them were machine formats.** D25: the rows
 * and both detail pages rendered `26/08/2026` (`toLocaleDateString()` with no
 * options), the directory rendered `2026-08-29` (an ISO slice), and the meeting
 * form's own label read `Date (YYYY-MM-DD)`. Three formats, one app.
 *
 * ⚠️ **The locale stays the reader's** — that was right and is kept. What
 * changes is the options: a long month is what a person writes on a
 * noticeboard, and it is the part that made the old output look like a
 * timestamp rather than a date.
 *
 * 🔴 **The `YYYY-MM-DD` branch is a real bug fix, not tidying.** `Meeting.when`
 * is a date-only string, and `new Date('2026-09-14')` parses as **UTC
 * midnight** — so in any negative-offset timezone `toLocaleDateString` rendered
 * *the day before*. Every meeting in the diary was a day early for anybody west
 * of Greenwich, and it renders correctly here only because this machine is not.
 * The branch builds a local date from the parts instead. Anchored to `$` so a
 * full ISO timestamp still takes the ordinary path.
 */
const HUMAN_DAY_FN =
  'function humanDay(raw) {\n' +
  "  if (raw === undefined || raw === null) return '';\n" +
  '  var s = String(raw);\n' +
  "  if (s === '') return '';\n" +
  '  var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s);\n' +
  '  var at = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);\n' +
  "  if (isNaN(at.getTime())) return '';\n" +
  "  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });\n" +
  '}\n';

function btn(label: string): Record<string, unknown> {
  return {
    label,
    ...withoutInertBorderWidth(composition(PRIMARY_LABELS.has(label) ? 'primaryButton' : 'outlineButton'))
  };
}

/**
 * A control in the band, which is **never** the filled button.
 *
 * 🔴 **It does not go through `btn()`, and that is the point.** `btn()` keys
 * the variant on the words, so the moment the band carried an item labelled
 * `Post something` it would have inherited `primaryButton` from
 * `PRIMARY_LABELS` — a filled button in the header of **every** page, including
 * `Pages/Post`, whose own submit is filled. Two filled buttons on a screen is
 * the state `PRIMARY_LABELS`' own comment calls "no primary action at all",
 * and here it would have been shipped on eleven screens at once.
 *
 * ⚠️ So emphasis is a property of the PLACE rather than of the label: a page
 * may emphasise one action, the band emphasises nothing. The two controls
 * reading `Post something` on `Pages/Members` are the same destination in the
 * same words, one of them emphasised, which is the ordinary shape of a nav
 * beside a call to action.
 */
/**
 * A control that is a CHILD OF A `Columns`, made to fit the box it is given.
 *
 * 🔴 **`outlineButton` and `primaryButton` both pin `sizeMode: 'contentSize'`,
 * and inside a `Columns` that is an overlap.** `calcAutoFit` divides the
 * container into equal boxes and hands each child one; a content-sized button
 * ignores the box and keeps its own width, so at 1280 the five-column band drew
 * "Announcements" straight across the left edge of "Meetings". **Found by
 * rendering it and looking** — every gate in this repository was green over it,
 * and it is invisible at 390px, where two wider columns happen to fit the words.
 *
 * ⚠️ **Written as a rule over the PLACE, not fixed on the one node that showed
 * it.** `Pages/Members`' three moderator actions have been in a `Columns` since
 * s8 and are the same defect: "Requests to join" measures ~163px of content in
 * a 165px box at 390px, so it clears by two pixels and reads as correct. A fix
 * applied only where the symptom appeared would have left that one to surface
 * on somebody else's font.
 *
 * ⚠️ `contentHeight` rather than `explicit`: the width comes from the column,
 * the height must still come from the label. `width` is INERT without one of
 * those two and the door says so.
 */
function inColumn(params: Record<string, unknown>): Record<string, unknown> {
  return {
    ...params,
    sizeMode: 'contentHeight',
    width: { value: 100, unit: '%' },
    // A control in a column is not a pill standing on its own: the compositions'
    // `--space-6` sides cost the label the room it needs inside a 142px box.
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)'
  };
}

function navBtn(label: string): Record<string, unknown> {
  return inColumn({ label, ...withoutInertBorderWidth(composition('outlineButton')) });
}

/**
 * A notice and the box it lives in, as the two nodes they have to be.
 *
 * 🔴 **The GROUP keeps the notice's id; the `Text` takes `<id>Text`.** That is
 * the whole reason this is a function. A `Text` cannot carry a surface — the
 * vocabulary is explicit that `Group` carries the fills and `Text` carries the
 * type ramp — so every notice needs a wrapper, and the wrapper is the node that
 * must leave the tree when the notice is hidden. Had the wrapper taken a new id,
 * **twenty `mounted` connections would have had to be repointed by hand**, and a
 * single missed one is a card that never hides: a permanent empty box on a page,
 * green in every spec here. Keeping the id on the Group means not one of those
 * connections changes.
 *
 * ⚠️ **A wired `text` is the exception** and must name `<id>Text`, because that
 * is the node with the port. Two notices in this template are wired that way
 * (`Pages/Setup`'s "which box is empty" and `Pages/SignIn`'s refusal) and both
 * are repointed at their call sites.
 *
 * ⚠️ `mounted` is passed rather than inferred: a notice with no gate is one that
 * is always on screen, which is right for a standing hint and wrong for a
 * refusal, and the difference is not derivable from anything else here.
 */
function notice(
  id: string,
  label: string,
  parent: string,
  text: string,
  opts: { tone?: 'neutral' | 'accent' | 'refused'; gated?: boolean; atFormMeasure?: boolean } = {}
): unknown[] {
  const tone = opts.tone ?? 'neutral';
  const box: Record<string, unknown> = { ...(tone === 'accent' ? NOTICE_ACCENT : NOTICE) };
  if (opts.gated !== false) box.mounted = false;
  // REL-002c s13: a notice that belongs to a form column keeps the form's
  // measure rather than the §C 1200 the page ground now carries. See
  // `AT_FORM_MEASURE` for the ruling and for why this is on the children.
  if (opts.atFormMeasure) Object.assign(box, AT_FORM_MEASURE);
  const words = tone === 'accent' ? T_NOTICE_ACCENT : tone === 'refused' ? T_REFUSED : T_NOTICE;
  return [
    { id, type: 'Group', label, parent, parameters: box, children: [`${id}Text`] },
    { id: `${id}Text`, type: 'Text', label: `${label} \u2014 the words`, parent: id, parameters: { text, ...words } }
  ];
}

/**
 * The wrapper `pageHead()` puts its two lines in.
 *
 * ⚠️ **`paddingBottom` overridden from the composition's `--space-10`.** That
 * 40px is the air before a section whose head carries a lead paragraph; this
 * head is two short lines, and 40px on top of `PAGE_GROUND`'s own 20px `rowGap`
 * put 60px between a page's title and its first card while the cards sat 16px
 * apart. `--space-2` makes it 28px, which is more than the gap between siblings
 * and less than the gap before a new section.
 */
const PAGE_HEAD = {
  ...composition('sectionHead'),
  rowGap: 'var(--space-1)',
  paddingBottom: 'var(--space-2)'
};

/**
 * A `Group` that fills its page and stacks its children — now CENTRED and
 * CAPPED.
 *
 * 🔴 **This one constant is most of what "it doesn't look like a website" was.**
 * Eleven pages share it, and it used to be `width: 100%` with 24px of side
 * padding: a single full-bleed column, on every screen, at every viewport width.
 * The `shell` composition's own description names the symptom — *"content that
 * touches the viewport edge is the loudest sign nobody designed the page"*.
 *
 * ⚠️ **`alignX` is set on the CHILD, not on the parent.** `layout.ts:150-160`
 * resolves `alignX: 'center'` inside a column parent to `alignSelf: center` on
 * this element, which is what lets a shared constant centre itself without every
 * one of the eleven `Page` nodes having to agree to align its children.
 *
 * 🔴 **1200px, and the 760 it replaced was the wrong reading of the right
 * instinct.** Richard ruled the measure on 2026-09-01 (§C of
 * `RICHARD-RULINGS-2026-09-01.md`): *"the structural page divs have a max width
 * and are centred… white space to the left and right equally"*, at the
 * composition's own 1200 and matching `ui-landing-page`.
 *
 * The old comment here argued 760 because *"1200 would put a two-word heading on
 * one line and leave the rest of the row empty"*. That is true, and it is an
 * argument about **what the shell contains**, not about how wide the shell is —
 * the fix for a two-word heading in a wide row is content that uses the row
 * (`PROSE` below, tiles in a `gridAutoFit`, a list whose rows have a right-hand
 * action), not a narrower page. Capping the page instead put every one of the
 * thirteen screens in a 760px strip and left 1140px of white at 1900, which is
 * V15 — *"the page uses ~37% of the width, the rest dead"*.
 *
 * ⚠️ **`alignX` is what centres it, and it is set on the CHILD.**
 * `layout.ts:150-160` resolves `alignX: 'center'` inside a column parent to
 * `alignSelf: center` on this element, which is what lets a shared constant
 * centre itself without every one of the thirteen `Page` nodes having to agree
 * to align its children.
 */
const PAGE_GROUND = {
  ...composition('shell'),
  // 🔴 **`contentHeight`, and it used to be `explicit` at `height: 100%`.** That
  // was believed inert — see `PAGE_SHELL` — and it is not: a percentage height
  // in a column parent becomes `flexGrow` (`layout.ts:98`). It did nothing only
  // because nothing above it had a height to spare. The moment REL-002c item 4
  // gave the page a floor, the slack went INTO the ground and was shared out
  // among its children, which put 150px between `/sign-in`'s heading and its
  // form and stretched the form panel by as much again. A page ground is as
  // tall as what is on the page.
  sizeMode: 'contentHeight',
  alignX: 'center',
  rowGap: 'var(--space-5)',
  paddingTop: 'var(--space-12)',
  paddingBottom: 'var(--space-12)'
};

/**
 * The measure a LINE OF PROSE is read at, inside a shell that is wider than it.
 *
 * 🔴 **This is the half of §C that stops 1200 making the pages worse.** A shell
 * at 1200 is right for a list with a right-hand action and wrong for a
 * paragraph: 1200px of running text is ~150 characters a line, roughly double
 * the measure anything is comfortably read at, and widening the page without
 * this would have traded dead white space for unreadable prose and called it
 * progress.
 *
 * 🔴 **It goes on a GROUP that wraps the prose, never on the `Text` itself.**
 * That is V29's ruled mechanism restated: a `maxWidth` on the type inside a
 * left-aligned shell strands all the leftover width on one side, which is the
 * thing Richard called *"weird"*. A wrapper is a shell — it can be given an
 * alignment and own its white space — where a `Text` with a cap is a ragged
 * column with a hole beside it.
 *
 * ⚠️ **640px, and `ch` was tried first and is not available.** The measure that
 * matters is counted in characters, but every dimension port in the runtime
 * declares `units: ['px', '%']`
 * ([`node-shared-port-definitions.ts:387`](../../noodl-viewer-react/src/node-shared-port-definitions.ts#L387)),
 * so a `ch` cap would have been silently inert rather than wrong-looking. 640px
 * at `--text-base` is ~78 characters — beside the kit's own `lead`, which caps
 * itself at 560.
 */
/**
 * The ground a page whose content is A FORM stands on.
 *
 * 🔴 **This is the one place REL-002c departs from the literal §C, and the
 * departure is what §C's own stated criterion asks for.** Richard's words are
 * *"the structural page divs have a max width and are centred… white space to
 * the left and right **equally** — not just on one side, that's weird."* The
 * criterion is EQUAL white space. On a form page the two ways to read the
 * ruling disagree:
 *
 * | reading | at 1280 | equal white? |
 * |---|---|---|
 * | shell at 1200, form fills it | a 1100px-wide password field | yes, and unusable |
 * | shell at 1200, form capped and left-aligned inside | ~480px of white on the right only | **no — this is the "weird" he named** |
 * | **ground at 720, centred** | a 720px form, 280px either side | **yes** |
 *
 * 🔴 **The first of those is not hypothetical — it is what the widening
 * produced and it was rendered before this constant existed.** `/setup` at
 * 1280 came out as six stacked 1100px inputs. That is worse than the 760
 * baseline it replaced, so shipping it would have been the measure making the
 * template worse and calling it §C.
 *
 * ⚠️ **Flagged for Richard rather than decided quietly.** It is a real
 * departure from *"maxWidth 1200 on every structural shell"* as written, on six
 * of the thirteen pages. If he wants 1200 literally everywhere, the answer is
 * not this constant — it is a two-up split that fills 1200 with the form on one
 * side and what the form is for on the other, which is more work and a better
 * page. See the handoff.
 */
const FORM_GROUND = { ...PAGE_GROUND, maxWidth: { value: 720, unit: 'px' } };

/**
 * REL-002c s13 — **the form's own measure, on a page that already has a band.**
 * 🔴 **RULED BY RICHARD, 2026-09-01**: *"head on 1200, form panels capped at 720."*
 *
 * The §C departure (`TASKS.md`) weighed 720-centred against 1200 and chose 720
 * — but it weighed it on the four DOOR pages, which carry no `Members/Chrome`
 * above them and are therefore self-consistent at any measure. `Pages/Post` and
 * `Pages/Account` are not door pages. They sit under a band and above a footer
 * that are both the §C 1200, and `FORM_GROUND` on the ground between them put
 * **three different left edges on one page**: at 1280 the association's name at
 * x=64, the page's own heading at x=304, the footer back at x=64. At 988 — the
 * editor preview's default, the first render of every project — 24 / 160 / 24.
 *
 * 🔴 **`Members/Chrome` had already stated the rule and stated it as satisfied**:
 * *"the band must agree with `PAGE_GROUND` or the nav and the content it heads
 * are two different columns; they are now the same 1200."* It was true of six of
 * the eight signed-in pages and nobody had rendered the other two.
 *
 * ✅ **Applied to the form CHILDREN, not by wrapping them.** A wrapper would be a
 * full-width column `Group` with no fill and more than one child — a SECTION by
 * §6's stated shape — and on `Pages/Post` it would enclose `tools`, which is
 * already one, making `tools` a second section that owes a hairline it should
 * not have. Capping the children moves no census.
 *
 * ⚠️ **No `sizeMode`, and that is checked rather than assumed.** `FIELD`'s note
 * records the door refusing `width` on a `net.noodl.controls.textinput` without
 * one — but that is a fact about that node type, not a rule about `Group`s:
 * `SECTION` has carried `width: 100%` and no `sizeMode` since it was written and
 * the panels it lays out are full-bleed in every render. Adding one here would
 * be `explicit`/`contentHeight` guesswork over a working default. **Verified in
 * the render, not from this comment** — the door raised the same 110
 * diagnostics before and after, and `/post` and `/account` were re-photographed
 * at all four widths.
 *
 * ⚠️ The neighbouring hazard still applies and is why this is only a WIDTH: a
 * `Group` with no `sizeMode` is `flex-grow: 100`, which does nothing here only
 * because `PAGE_GROUND` is `contentHeight` and has no slack to share out.
 */
const AT_FORM_MEASURE = {
  width: { value: 100, unit: '%' },
  maxWidth: { value: 720, unit: 'px' }
};

/**
 * The full-height box a page's own ground stands in — REL-002c item 4.
 *
 * 🔴 **Eleven of the thirteen pages had no bottom edge, and the change list's
 * proposed fix for it would have changed no pixel.** Item 4 said to put
 * `minHeight: 100vh` on `PAGE_GROUND`, on the reading that its `height: 100%`
 * is inert. Measured in the artefact, `ground` carries no `backgroundColor` at
 * all — so growing that box paints nothing, and `/setup` would have ended in
 * exactly the same white. A page has a bottom edge when something is AT the
 * bottom; the landing page has had one since s7 and it is a footer.
 *
 * 🔴 **`height: 100%` is not inert, and knowing why is what makes this work.**
 * `layout.ts:98-100` turns a percentage height inside a COLUMN parent into
 * `flexGrow` — *"along the parent's flex direction it becomes `flexGrow` (so
 * siblings share the space proportionally)"* — so `PAGE_GROUND`'s 100% has
 * always meant `flex-grow: 100`, not a percentage of anything. It did nothing
 * only because the parent chain ended at a `Router`, which sizes itself to its
 * content, so there was never any free space to grow into. This shell is that
 * free space: it floors the page at the viewport, `ground` grows into whatever
 * is left, and the footer is pushed to the foot without a `justifyContent`
 * anybody has to reason about.
 *
 * 🔴 **`space-between` over exactly TWO children, which is why `pageBody`
 * exists.** With three — the band, the ground and the footer — the slack splits
 * in two and opens a gap UNDER THE HEADER, which is the one place on these
 * pages nothing may move. Wrapping the band and the ground in one
 * content-height box makes it the two-band case `BAND_PAGE_GROUND` already
 * solves: everything the page says at the top, the foot at the foot.
 *
 * ⚠️ **EVERY `Group` in this template without a `sizeMode` is
 * `flex-grow: 100`.** `addDimensions` defaults `sizeMode` to `explicit` and
 * `height` to `100%`, and the percentage becomes `flexGrow` — so any container
 * given real slack shares it out among its unpinned children rather than
 * keeping it at the bottom. That is a property of the runtime, not of this
 * template, and it is why `pageBody` is pinned to `contentHeight` and why the
 * ground below it now is too.
 *
 * ⚠️ **`vh` is available on `height` too** (`units: ['%', 'px', 'vw', 'vh']`,
 * [`node-shared-port-definitions.ts:1183`](../../noodl-viewer-react/src/node-shared-port-definitions.ts#L1183)),
 * so the note on `BAND_PAGE_GROUND` calling `minHeight` *"the one dimension port
 * that takes `vh`"* overstates it. `minHeight` is still what this wants: a floor
 * that a long page grows past, not a height a long page has to scroll inside.
 */
/**
 * A DOOR page's band ground — REL-002c item 6, widened by Richard 2026-09-01.
 *
 * 🔴 **Three pages had no identity of any kind**, and item 6 named only
 * `/setup`. Read out of the artefact in s11 and confirmed against renders in
 * s12: `/setup`, `/sign-in` and `/unsubscribe` all carried no `backgroundImage`
 * and no band, against `/` and `/join` which do. Two of the three are the
 * highest-traffic doors in the template — the owner's first ever screen and the
 * returning member's — and the pictures showed worse than the audit did:
 * `/sign-in` had **~280px of dead white above its footer** and `/unsubscribe`
 * **~530px**, which is the same void item 1 fixed on the landing page, still
 * sitting on three pages nobody had photographed.
 *
 * ⚠️ **300px, and the reason is `JOIN_GROUND`'s, not a new one.** A
 * half-viewport photograph over a form pushes the first field under the fold on
 * the `preview` viewport, which is the shortest of the four.
 *
 * ⚠️ **The picture is per page and the pages must not share one.**
 * `JOIN_GROUND` records why: a form page repeating the hero's own photograph
 * reads as a page that failed to load its own.
 */
const bandGround = (image: string) => ({
  ...composition('imageGround'),
  backgroundImage: `noodl_modules/starter-imagery/${image}`,
  height: { value: 300, unit: 'px' }
});

const PAGE_SHELL = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  minHeight: { value: 100, unit: 'vh' },
  flexDirection: 'column',
  justifyContent: 'space-between'
};

/** Everything above the foot: the band if the page has one, and its ground. */
const PAGE_BODY = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  flexDirection: 'column'
};

/**
 * A page's outer three: the band if it has one, the ground, and the foot.
 *
 * 🔴 **Written as a helper because it is eleven identical edits**, and the half
 * that is easy to get wrong is invisible — a page that keeps `chrome` as a
 * direct child of `Page` puts the band OUTSIDE the full-height box, so the
 * shell overflows the viewport by the height of the band and every page gains a
 * scrollbar with nothing under the fold.
 *
 * ⚠️ **The two public band pages do not use it.** `Pages/Landing` and
 * `Pages/Join` are built from bands on `BAND_PAGE_GROUND`, which already floors
 * at `100vh`, and both place the footer component themselves as their last band.
 *
 * 🔴 **This note used to end *"and `/join` ends on a form panel with `--muted`
 * beneath it that is its own bottom edge"*, and the render disproved it.**
 * `BAND_PAGE_GROUND`'s `space-between` over two children pins the form band to
 * the foot, so the `--muted` that argument depends on never appears: `/join`
 * simply stopped in white, and was the only page in the template with no footer
 * at all. s12 gave it one. Recorded because the false half was load-bearing —
 * it is the reason nobody added the footer for five sessions.
 */
function pageShell(
  opts: {
    chrome?: boolean;
    band?: string;
    /**
     * The id of the head node `pageHead()` roots, so the identity band can list
     * it as a child.
     *
     * ⚠️ **`headingHeadRow` on seven of the nine and `titleHeadRow` on two**, and
     * the difference is not cosmetic: `pageHead` roots at `${id}HeadRow` when it
     * is badged and at `${id}Head` when it is not, and the two record pages call
     * it with `title` because their heading is WIRED from the record — its own
     * note records why the id stays on the `Text` rather than on the wrapper.
     * Defaulting this would have silently put an empty band on those two pages.
     */
    headChild?: string;
    /**
     * REL-010. The *"what members can see"* band, under the page's own content
     * and above the foot. **Public pages only** — §3.1, ruled 2026-09-02.
     */
    inside?: boolean;
    /**
     * REL-010. The closing prompt band: what to do if this page is not the one
     * you wanted. `action` is the button's label; the click arrives back on the
     * page as `prompt`'s `clicked` output, which the page wires to its own
     * navigator.
     */
    prompt?: { heading: string; line: string; action: string };
  } = {}
): unknown[] {
  // 🔴 **Order is the reading order and it is stated here rather than at four
  // call sites.** Content first, then what else this page could be, then what
  // is behind the door, then the foot. `inside` last of the three because it is
  // the least specific to the page: a stranger who has decided is served by the
  // prompt, and a stranger who has not is served by the tiles.
  const tail = [...(opts.prompt ? ['prompt'] : []), ...(opts.inside ? ['inside'] : [])];
  const nodes: unknown[] = [
    {
      id: 'pageShell',
      type: 'Group',
      label: 'The page, floored at the viewport',
      parent: 'page',
      parameters: PAGE_SHELL,
      children: ['pageBody', 'pageFooter']
    },
    {
      id: 'pageBody',
      type: 'Group',
      label: 'Everything above the foot',
      parent: 'pageShell',
      parameters: PAGE_BODY,
      children: [
        ...(opts.chrome ? ['chrome', 'headBand'] : []),
        ...(opts.band ? ['heroBand'] : []),
        'ground',
        ...tail
      ]
    }
  ];
  if (opts.prompt) {
    nodes.push({
      id: 'prompt',
      type: PROMPT_COMPONENT,
      label: 'The closing prompt',
      parent: 'pageBody',
      parameters: { ...opts.prompt }
    });
  }
  if (opts.inside) {
    nodes.push({
      id: 'inside',
      type: INSIDE_BAND_COMPONENT,
      label: 'What members can see',
      parent: 'pageBody'
    });
  }
  if (opts.chrome) {
    nodes.push({ id: 'chrome', type: CHROME_COMPONENT, label: 'The band', parent: 'pageBody' });
  }
  // 🔴 **REL-010 AC4 — the page-identity band, on the nine app-chrome pages.**
  //
  // Measured after the display tier landed, every one of the nine read **exactly
  // two distinct grounds**: `--surface` (the chrome bar) and `--muted` (the
  // foot). Everything between them — the head, the notices, the lists, the forms
  // — stood on unpainted page. AC4 asks these pages for three.
  //
  // 🔴 **The cheap third ground was available and is refused here in writing.**
  // `PAGE_GROUND` could have been given `backgroundColor: 'var(--background)'`,
  // which is the colour that ground already appears to be, and the count would
  // have gone 2 → 3 while **not one pixel changed**. That is the board's hazard
  // 2 run backwards — *a fix's stated mechanism can paint nothing* — and it is
  // the definition of building for the instrument rather than for the page.
  //
  // So it is a band that does something: the eyebrow, the badge and the heading
  // move out of the content column into a zone of their own, and a page stops
  // being one undivided scroll from the nav to the foot. That is what §3.1's
  // *"density and decision, not billboards"* buys on a tool screen — the same
  // amount of structure the landing page gets, spent on hierarchy instead of on
  // marketing.
  //
  // ⚠️ **`--accent` is the THIRD thing this template spends the accent on**, and
  // `tpl001Theme.ts` names the other two — *"the primary at a whisper, for the
  // eyebrow and the pending notice"*. It is the same kind of use: the
  // association's own colour marking the part of the screen addressed to the
  // reader. Contrast is already on file — `--accent-foreground` on `--accent` is
  // **6.45:1**, and `--foreground` on `--accent` is higher.
  if (opts.chrome) {
    nodes.push(
      {
        id: 'headBand',
        type: 'Group',
        label: 'What this page is',
        parent: 'pageBody',
        parameters: {
          width: { value: 100, unit: '%' },
          // Pinned — hazard 1. A band is as tall as what is in it, and this one
          // sits inside `PAGE_SHELL`'s floored column beside a `ground` that is
          // also pinned.
          sizeMode: 'contentHeight',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'var(--accent)',
          borderBottomStyle: 'solid',
          borderBottomWidth: 'var(--border-1)',
          borderBottomColor: 'var(--border)',
          paddingTop: 'var(--space-8)',
          paddingBottom: 'var(--space-8)'
        },
        children: ['headBandShell']
      },
      {
        id: 'headBandShell',
        type: 'Group',
        label: 'Shell',
        parent: 'headBand',
        // ⚠️ **The same 1200 the chrome bar and `PAGE_GROUND` are capped at.**
        // `CHROME_NODES` records what happens when they disagree — *"the band
        // must agree with `PAGE_GROUND` or the nav and the content it heads are
        // two different columns"*. This band sits between the two of them, so it
        // is the one place a disagreement would be visible twice.
        parameters: { ...composition('shell'), sizeMode: 'contentHeight', alignX: 'center' },
        children: [opts.headChild ?? 'headingHeadRow']
      }
    );
  }
  // 🔴 **REL-002c item 6 — the band goes INSIDE `pageBody`, and that is the
  // whole reason these three pages reuse this helper instead of `/join`'s
  // shape.** `/join` is built on `BAND_PAGE_GROUND`, whose `space-between` over
  // two children pins the form band to the foot — which is why `/join` has no
  // footer and why the `--muted` bottom edge its own comment promises never
  // renders. Putting the band in `pageBody` keeps `PAGE_SHELL`'s two-child
  // `space-between` intact, so these pages get an identity AND keep the footer
  // every other page in the template has.
  if (opts.band) {
    nodes.push(
      {
        id: 'heroBand',
        type: 'Group',
        label: 'The photograph, and what this page is',
        parent: 'pageBody',
        parameters: bandGround(opts.band),
        children: ['heroShell']
      },
      {
        id: 'heroShell',
        type: 'Group',
        label: 'Shell',
        parent: 'heroBand',
        // 🔴 `sizeMode: 'contentHeight'` is not optional inside an
        // `imageGround` — register V1; `HERO_SHELL` carries the account.
        // ⚠️ Capped at the FORM's 720 for `/join`'s measured reason: with
        // `HERO_SHELL`'s 1200 the heading begins at x=64 and the panel beneath it
        // at x=304, which reads as a page whose head belongs to another template.
        parameters: { ...HERO_SHELL, maxWidth: { value: 720, unit: 'px' } },
        children: ['headingHead']
      }
    );
  }
  nodes.push({ id: 'pageFooter', type: FOOTER_COMPONENT, label: 'The foot of the page', parent: 'pageShell' });
  return nodes;
}

const PROSE = {
  width: { value: 100, unit: '%' },
  sizeMode: 'contentHeight',
  maxWidth: { value: 640, unit: 'px' },
  flexDirection: 'column',
  rowGap: 'var(--space-2)'
};

/**
 * The app shell: the Group that gives the Router a size, and the Router itself.
 *
 * 🔴 Copied in shape, not by import, from `sb007Template.ts`'s `APP_NODES`, and
 * for its two stated reasons — a `Router` sizes itself to its content, so at the
 * root on its own it renders the app as a strip a few pixels tall; and the door
 * reads a bare number on a dimension port as a **percentage** and refuses a
 * dimension without `sizeMode`, so `{ value, unit }` is a statement rather than
 * a coincidence.
 *
 * 🔴 **No `pages` list.** The door registers every page it writes into this
 * router; typing the list here would be a twin of that mechanism, agreeing with
 * it until the first page either side gains one.
 */
/**
 * A page's head: the eyebrow that says what KIND of screen this is, and the
 * heading, in the group the vocabulary already has for the pair.
 *
 * 🔴 **The `Text` keeps the id and the GROUP takes a derived one — the opposite
 * of `notice()`, for the same reason.** The rule in both places is that the id
 * stays on the node other things point at, and here that is the heading itself:
 * `Pages/Announcement` and `Pages/Meeting` wire `record.prop-title` into
 * `title.text`, so a wrapper that stole the id would have silently moved those
 * two connections onto a `Group`, which has no `text` port. A notice is gated
 * and so its Group is the referenced node; a heading is written into and so its
 * Text is.
 *
 * ⚠️ **What the eyebrow is allowed to say.** The band already carries
 * `Members' area` above the association's name on the seven pages that show it,
 * so a page eyebrow repeating that phrase would put the same words twice on one
 * screen. It names the thing the heading cannot: the audience on a tool screen,
 * and the record type on the two pages whose heading IS a record's title —
 * without it, "Autumn fete" gives a reader no way to tell an announcement from
 * a meeting.
 *
 * ⚠️ `rowGap` overridden from the composition's `--space-3`. 12px is the gap
 * for an eyebrow/heading/lead stack; this pair has no lead, and the band's own
 * identity block sets `--space-1` for the same eyebrow-over-title pairing. The
 * two eyebrow stacks in the app now agree.
 */
function pageHead(
  id: string,
  label: string,
  parent: string,
  eyebrow: string,
  text: string,
  opts: {
    /**
     * §D. The lucide name, WITHOUT its `icon-` prefix, or nothing on the pages
     * a person can reach without signing in.
     *
     * 🔴 **Absent on the public pages by ruling, not by omission.**
     * *"Photographs on the public pages, icons only inside the gated area."*
     * `/` and `/join` carry a photograph; a glyph badge on top of one would be
     * two decorative systems on the same screen. `/unsubscribe` has neither —
     * it is a page a mail client sends somebody to, and the eyebrow carrying
     * the association's name is the only orientation it needs.
     */
    icon?: string;
    /**
     * The head stands ON a photograph, so both its lines turn light.
     *
     * ⚠️ It overrides two colours that are correct on `--background` and
     * illegible on a picture: `T_EYEBROW`'s accent green and `H_PAGE`'s
     * `--foreground`. Same override `Pages/Landing`'s hero carries and for the
     * same reason — see `ON_SCRIM`.
     */
    onScrim?: boolean;
    /**
     * REL-010 AC2. `door` takes `H_DOOR` (`--display-md`, 72px at 1280) instead
     * of `H_PAGE` (`--display-sm`, 48px).
     *
     * 🔴 **Three pages, named rather than derived, and the distinction is
     * Richard's not the instrument's.** `onScrim` is nearly the same set and it
     * is NOT the same question: `/unsubscribe` also stands on a photograph and
     * is deliberately NOT a door — it is a page a mail client sends somebody to
     * once, and REL-010 AC2 asks `≥ 72px` of *"the four public pages"*, which
     * are `/`, `/join`, `/sign-in` and `/setup`. Keying the tier off `onScrim`
     * would have put a 72px headline on `/unsubscribe` because it happens to
     * share a background treatment, which is a layout fact standing in for an
     * audience one.
     */
    tier?: 'door';
  } = {}
): unknown[] {
  const { icon, onScrim, tier } = opts;
  const light = onScrim ? ON_SCRIM : {};
  const heading = tier === 'door' ? H_DOOR : H_PAGE;
  const head = [
    {
      id: `${id}Head`,
      type: 'Group',
      label: `${label} \u2014 the head`,
      parent: icon ? `${id}HeadRow` : parent,
      parameters: PAGE_HEAD,
      children: [`${id}Eyebrow`, id]
    },
    {
      id: `${id}Eyebrow`,
      type: 'Text',
      label: eyebrow,
      parent: `${id}Head`,
      parameters: { text: eyebrow, ...T_EYEBROW, ...light }
    },
    { id, type: 'Text', label, parent: `${id}Head`, parameters: { text, ...heading, ...light } }
  ];
  if (!icon) return head;
  return [
    {
      id: `${id}HeadRow`,
      type: 'Group',
      label: `${label} \u2014 the head, badged`,
      parent,
      parameters: HEAD_ROW,
      children: [`${id}Badge`, `${id}Head`]
    },
    {
      id: `${id}Badge`,
      type: 'Group',
      label: `${label} \u2014 the badge`,
      parent: `${id}HeadRow`,
      parameters: HEAD_BADGE,
      children: [`${id}Glyph`]
    },
    {
      id: `${id}Glyph`,
      type: 'net.noodl.visual.icon',
      label: `${label} \u2014 the glyph`,
      parent: `${id}Badge`,
      // ⚠️ `iconColor` and not `color`: the Icon node's colour arrives through
      // `addIconInputs`, and a `color` here would be a parameter nothing reads.
      // The glyph is 22px inside a 44px square, which is the half-and-half a
      // badge wants — 24px in 44 crowds the corners at `--radius-lg`.
      parameters: {
        iconIconSource: glyph(icon),
        iconSize: { value: 22, unit: 'px' },
        iconColor: 'var(--accent-foreground)'
      }
    },
    ...head
  ];
}

/**
 * A section that FOLLOWS another section on the same ground, and the hairline
 * that says where one ends and the next begins.
 *
 * 🔴 **Written as a rule over the PLACE, like `inColumn`.** The one page that
 * needs it today is `Pages/Members`, where a member's announcements and a
 * moderator's three tools were two `SECTION`s separated by nothing but the
 * ground's own 20px gap — the same gap that sits between a heading and a
 * notice, so the page read as one list of things rather than as two zones with
 * different audiences. A fix written onto that node alone would not have
 * covered the next page to stack two sections.
 *
 * ⚠️ **`--border` at 1.33:1 is deliberate and sufficient here** — it is the
 * hairline `tpl001Theme.ts` describes for exactly this, and a decorative
 * divider carries no contrast minimum. The token that does carry one is
 * `--border-control`, and this is not a control.
 *
 * ⚠️ It pairs with `mounted`, not `visible`: `moderatorTools` leaves the tree
 * entirely for a member, so the rule leaves with it rather than drawing a line
 * under a page with nothing beneath it.
 */
function afterSection(params: Record<string, unknown>): Record<string, unknown> {
  return {
    ...params,
    borderTopStyle: 'solid',
    borderTopWidth: 'var(--border-1)',
    borderTopColor: 'var(--border)',
    paddingTop: 'var(--space-6)'
  };
}

/**
 * A moderator's way to take a notice back down, as the block both detail pages
 * carry.
 *
 * 🔴 **The policy allowed this from the day it was written and no graph ever
 * offered it.** `nodegx.security.json` grants `role:admin` `delete` on both
 * `Announcement` and `Meeting`; the app placed a `Delete Record` exactly once,
 * server-side in `decideMembership`, and never in the browser. So a moderator
 * who posted the harvest supper on the wrong Saturday could correct it only by
 * opening the backend's own admin surface — which for §1's church secretary is
 * the same word as "no". See {@link REMOVE_ANNOUNCEMENT_LABEL}.
 *
 * ⚠️ **A function over the PLACE, like `inColumn` and `afterSection`.** Two
 * pages need it today and they are the two that reach a record by id; a third
 * would need every one of these eleven nodes correct, and the half that is easy
 * to get wrong is invisible — a missing `runOnChange` box, a gate that is a
 * signal rather than a `Condition`.
 *
 * ## The four things this shape is careful about
 *
 * 1. **`isModerator` comes from the BAND, not from a new call.** These two
 *    pages have no `Members/Standing` — the record read is their gate (see
 *    `ANNOUNCEMENT`) — so the band publishes the answer it already fetched.
 *    Since s13 that is how EVERY gated page reads it (D29, closed), and these
 *    two were simply the first: `Members/Chrome`'s `outputs` node has the whole
 *    story.
 * 2. **The confirm step is not decoration.** A delete cannot be undone, and the
 *    button sits under a notice a moderator reached by tapping a row. `Yes,
 *    remove it` and `Keep it` are both outline controls: `PRIMARY_LABELS` is
 *    for the one thing a screen is *for*, and emphasising the destructive half
 *    would put the filled button on the answer nobody should give by reflex.
 * 3. **Rule 2 — the id and the signal that acts on it leave the same node.**
 *    The id has been settled since the page mounted and the click is many
 *    passes later, so nothing would in fact race; `confirmed` is written that
 *    way regardless, because the shape that is safe by accident is the one the
 *    next edit breaks silently.
 * 4. **Rule 4 on every reveal.** Three `Condition` nodes, because a signal
 *    wired to `mounted` coalesces to a single `false` and reveals nothing.
 */
function removalBlock(opts: {
  parent: string;
  holdId: string;
  param: string;
  collectionName: string;
  label: string;
  listTarget: string;
}): { nodes: unknown[]; connections: unknown[] } {
  const nodes: unknown[] = [
    {
      id: 'removal',
      type: 'Group',
      label: 'Taking it down again',
      parent: opts.parent,
      // The moderator's zone under the member's, told apart by a rule rather
      // than by the ground's own gap — the same reading `Pages/Members` needed.
      parameters: { ...afterSection({ ...SECTION }), mounted: false },
      children: ['removeButton', 'confirm', 'removeFailed']
    },
    {
      id: 'removeButton',
      type: 'net.noodl.controls.button',
      label: opts.label,
      parent: 'removal',
      parameters: btn(opts.label)
    },
    /**
     * 🔴 **A `PANEL`, not a `notice()`, and the gate is what settled it.**
     *
     * §2 of the ratchet defines a notice box as a `Group` wrapping *exactly
     * one* `Text`, and says of `Pages/Landing`'s setup card that wrapping a
     * sentence AND a button "makes it a panel rather than a notice". This holds
     * a sentence and two buttons. Built with `notice()` it wore a notice's
     * styling while escaping the notice census on a technicality — passing the
     * spec for a reason nobody had stated. It is a panel, so it is one.
     *
     * ⚠️ The words keep `T_REFUSED`: `--destructive` on `--surface` is 5.96:1,
     * and the panel fills with `--surface`. `T_CONFIRM` is the neighbouring
     * case — a confirmation inside a panel that is *already* on screen — and
     * this one IS the panel.
     */
    {
      id: 'confirm',
      type: 'Group',
      label: 'Are you sure',
      parent: 'removal',
      parameters: { ...PANEL, mounted: false },
      children: ['confirmText', 'confirmRow']
    },
    {
      id: 'confirmText',
      type: 'Text',
      label: 'Are you sure \u2014 the words',
      parent: 'confirm',
      parameters: { text: CONFIRM_REMOVE_TEXT, ...T_REFUSED }
    },
    {
      id: 'confirmRow',
      type: 'Group',
      label: 'The two answers',
      parent: 'confirm',
      // 🔴 `laidOut`, or the `rowGap` this inherits is a gap the runtime never
      // reads: `group.ts:473-482` makes each gap conditional on the direction.
      parameters: laidOut('row', { sizeMode: 'contentSize' }, 'var(--space-3)'),
      children: ['confirmYes', 'confirmNo']
    },
    {
      id: 'confirmYes',
      type: 'net.noodl.controls.button',
      label: CONFIRM_REMOVE_YES,
      parent: 'confirmRow',
      parameters: btn(CONFIRM_REMOVE_YES)
    },
    {
      id: 'confirmNo',
      type: 'net.noodl.controls.button',
      label: CONFIRM_REMOVE_NO,
      parent: 'confirmRow',
      parameters: btn(CONFIRM_REMOVE_NO)
    },
    ...notice('removeFailed', 'It did not go', 'removal', REMOVE_FAILED_TEXT, { tone: 'refused' }),
    {
      id: 'confirmed',
      type: 'JavaScriptFunction',
      label: 'The id, and the go-ahead, from one node',
      ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
      parameters: {
        // 🔴 `Run` is ADDITIVE (`run-on-value-change.ts` §1): left on, this node
        // would also fire when the id arrives at page mount — which is to say
        // it would delete the record the moment a moderator opened it.
        [`runOnChange-in-${opts.param}`]: false,
        functionScript:
          `if (Inputs.${opts.param} === undefined || Inputs.${opts.param} === '') return;\n` +
          `Outputs.${opts.param} = Inputs.${opts.param};\n` +
          'Outputs.go();'
      }
    },
    {
      id: 'del',
      type: 'DeleteDbModelProperties',
      label: 'Remove it',
      parameters: { collectionName: opts.collectionName, idSource: 'explicit' }
    },
    { id: 'confirmGate', type: 'Condition', label: 'Ask before doing it', parameters: { ...CONDITION_GATE } },
    {
      id: 'confirmClear',
      type: 'Condition',
      label: 'Put the question away',
      // The `missingClear` shape from `Pages/Setup`: a constant `false` with its
      // own box off, so it hides only when asked.
      parameters: { condition: false, 'runOnChange-condition': false }
    },
    { id: 'removeFailedGate', type: 'Condition', label: 'Say it did not go', parameters: { ...CONDITION_GATE } },
    {
      id: 'toList',
      type: 'RouterNavigate',
      label: 'Back to the list it came from',
      parameters: { router: ROUTER, target: opts.listTarget }
    }
  ];

  const connections: unknown[] = [
    // The band already asked. See `Members/Chrome`'s `outputs`.
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'removal', toProperty: 'mounted' },

    { fromId: 'removeButton', fromProperty: 'onClick', toId: 'confirmGate', toProperty: 'eval' },
    { fromId: 'confirmGate', fromProperty: 'result', toId: 'confirm', toProperty: 'mounted' },
    { fromId: 'confirmNo', fromProperty: 'onClick', toId: 'confirmClear', toProperty: 'eval' },
    { fromId: 'confirmClear', fromProperty: 'result', toId: 'confirm', toProperty: 'mounted' },

    { fromId: opts.holdId, fromProperty: `out-${opts.param}`, toId: 'confirmed', toProperty: `in-${opts.param}` },
    { fromId: 'confirmYes', fromProperty: 'onClick', toId: 'confirmed', toProperty: 'run' },
    { fromId: 'confirmed', fromProperty: `out-${opts.param}`, toId: 'del', toProperty: 'modelId' },
    { fromId: 'confirmed', fromProperty: 'out-go', toId: 'del', toProperty: 'store' },

    // Gone means gone: the page it was on cannot render it any more, so the
    // moderator is put back on the list rather than left looking at a refusal
    // for a record they just removed on purpose.
    { fromId: 'del', fromProperty: 'done', toId: 'toList', toProperty: 'navigate' },
    { fromId: 'del', fromProperty: 'failure', toId: 'removeFailedGate', toProperty: 'eval' },
    { fromId: 'removeFailedGate', fromProperty: 'result', toId: 'removeFailed', toProperty: 'mounted' }
  ];

  return { nodes, connections };
}

export const APP_NODES = [
  {
    id: 'app_root',
    type: 'Group',
    label: 'App',
    parameters: {
      sizeMode: 'explicit',
      width: { value: 100, unit: '%' },
      height: { value: 100, unit: '%' }
    },
    children: ['app_router']
  },
  {
    id: 'app_router',
    type: 'Router',
    label: 'Main router',
    parent: 'app_root',
    parameters: { name: ROUTER }
  }
];

/** The shell has no wires — a Router needs none to route. */
export const APP_WIRES: unknown[] = [];

// ── 1. Members/Standing — the answer every gated screen waits for ────────────

/**
 * 🔴 **The one place the app asks the server who the person is, placed on every
 * screen that shows or offers anything.**
 *
 * It is a component rather than five copies of the same six nodes because the
 * copies would drift, and the thing they would drift on is the boundary: a page
 * whose gate fell one revision behind would reveal a moderator's form to a
 * member, and it would look exactly like the pages that do not.
 *
 * ⚠️ **Its outputs are values AND signals, deliberately.** The booleans drive
 * `mounted` (rule 4: a signal into a value port arrives once as `false`, so a
 * signal could never do this job); the signals trigger the queries, so that a
 * query has no other way to run. Both halves are needed and they are not
 * interchangeable.
 */
export const STANDING_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'Ask',
    // The page's `didMount` is the trigger. A component cannot ask for itself:
    // it has no mount of its own to fire from, and asking on graph build would
    // race the session being restored from browser storage.
    ports: [{ name: 'Check', type: 'signal', plug: 'output' }]
  },
  { id: 'call', type: 'CloudFunction2', label: FN_MY_STANDING, parameters: { function: FN_MY_STANDING } },
  {
    id: 'decide',
    type: 'JavaScriptFunction',
    label: 'Turn the standing into what each screen needs',
    ports: [
      { name: 'out-member', plug: 'output', type: 'signal' },
      { name: 'out-moderator', plug: 'output', type: 'signal' },
      { name: 'out-visitor', plug: 'output', type: 'signal' },
      // REL-002b. `out-denied` is the refusal every protected page navigates
      // on; `out-signedIn` is what lets the band decide whether to offer the
      // furniture of a session. See the wires below for why both exist.
      { name: 'out-denied', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        'if (Inputs.standing === undefined) return;\n' +
        'const s = String(Inputs.standing);\n' +
        `const moderator = s === '${STANDING_MODERATOR}';\n` +
        `const member = moderator || s === '${STANDING_MEMBER}';\n` +
        'Outputs.standing = s;\n' +
        '// 🔴 A moderator IS shown the members’ content. The roles are flat and\n' +
        '// a moderator need not hold `member`, so every screen that asks "may\n' +
        '// this person read?" has to ask for both — in the graph here, and in\n' +
        '// the policy as a two-atom rule.\n' +
        'Outputs.isMember = member;\n' +
        'Outputs.isModerator = moderator;\n' +
        `Outputs.isPending = s === '${STANDING_PENDING}';\n` +
        'Outputs.isUnknown = false;\n' +
        '// REL-002b. Whether there is a session at all is a different question\n' +
        '// from whether this person may read anything, and the band needs the\n' +
        '// first one: a `Sign out` button offered to somebody with no session\n' +
        '// tells them they are signed in.\n' +
        `Outputs.isSignedIn = s !== '${STANDING_VISITOR}';\n` +
        'if (moderator) Outputs.moderator();\n' +
        'if (member) Outputs.member();\n' +
        `if (s === '${STANDING_VISITOR}') { Outputs.visitor(); Outputs.denied(); }`
    }
  },
  {
    id: 'failed',
    type: 'JavaScriptFunction',
    label: 'The roles could not be read',
    ports: [{ name: 'out-denied', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 Not `pending`, and not `member`. Reporting a failed roles read as
      // "you are not a member" tells a member something false about themselves;
      // reporting it as membership would load content for someone whose
      // standing is unproven. `unknown` says what happened, shows nothing, and
      // leaves the server-side refusal as the boundary it always was.
      //
      // 🔴 **REL-002b — and it now DENIES.** Showing nothing was still a page:
      // measured with no backend bound, all six protected screens stayed at
      // their own URL wearing the full members' band, `Sign out` included, and
      // five of the six said nothing at all about why they were empty. "The
      // content is hidden" is not the same claim as "the gate refused" — the
      // first is a property of six `mounted: false` defaults, the second is a
      // decision, and only the second survives somebody adding a seventh page.
      // So the unreadable case fires the same refusal a visitor gets.
      functionScript: `Outputs.standing = '${STANDING_UNKNOWN}';\nOutputs.isUnknown = true;\nOutputs.denied();`
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'What the screen may show',
    ports: [
      { name: 'standing', type: 'string', plug: 'input' },
      { name: 'isMember', type: 'boolean', plug: 'input' },
      { name: 'isModerator', type: 'boolean', plug: 'input' },
      { name: 'isPending', type: 'boolean', plug: 'input' },
      { name: 'isUnknown', type: 'boolean', plug: 'input' },
      { name: 'isSignedIn', type: 'boolean', plug: 'input' },
      { name: 'Member', type: 'signal', plug: 'input' },
      { name: 'Moderator', type: 'signal', plug: 'input' },
      { name: 'Visitor', type: 'signal', plug: 'input' },
      { name: 'Denied', type: 'signal', plug: 'input' }
    ]
  }
];

export const STANDING_WIRES = [
  { fromId: 'inputs', fromProperty: 'Check', toId: 'call', toProperty: 'call' },
  { fromId: 'call', fromProperty: 'out-standing', toId: 'decide', toProperty: 'in-standing' },
  { fromId: 'call', fromProperty: 'done', toId: 'decide', toProperty: 'run' },
  { fromId: 'call', fromProperty: 'failure', toId: 'failed', toProperty: 'run' },

  { fromId: 'decide', fromProperty: 'out-standing', toId: 'outputs', toProperty: 'standing' },
  { fromId: 'decide', fromProperty: 'out-isMember', toId: 'outputs', toProperty: 'isMember' },
  { fromId: 'decide', fromProperty: 'out-isModerator', toId: 'outputs', toProperty: 'isModerator' },
  { fromId: 'decide', fromProperty: 'out-isPending', toId: 'outputs', toProperty: 'isPending' },
  { fromId: 'decide', fromProperty: 'out-isUnknown', toId: 'outputs', toProperty: 'isUnknown' },
  { fromId: 'decide', fromProperty: 'out-member', toId: 'outputs', toProperty: 'Member' },
  { fromId: 'decide', fromProperty: 'out-moderator', toId: 'outputs', toProperty: 'Moderator' },
  { fromId: 'decide', fromProperty: 'out-visitor', toId: 'outputs', toProperty: 'Visitor' },
  { fromId: 'decide', fromProperty: 'out-isSignedIn', toId: 'outputs', toProperty: 'isSignedIn' },

  // 🔴 REL-002b — `Denied` has TWO producers on purpose, and they are the two
  // ways a page can be one a person may not read: the server said `visitor`,
  // or the server could not be asked. The old graph wired only the first to a
  // navigation, so the second — a backend that is down, absent, or half
  // deployed — left the reader sitting on the protected URL.
  { fromId: 'decide', fromProperty: 'out-denied', toId: 'outputs', toProperty: 'Denied' },

  // ⚠️ Two producers on two ports, and they are mutually exclusive by
  // construction: a `CloudFunction2` call answers `done` or `failure`, never
  // both. The failure branch publishes only what it knows.
  { fromId: 'failed', fromProperty: 'out-standing', toId: 'outputs', toProperty: 'standing' },
  { fromId: 'failed', fromProperty: 'out-isUnknown', toId: 'outputs', toProperty: 'isUnknown' },
  { fromId: 'failed', fromProperty: 'out-denied', toId: 'outputs', toProperty: 'Denied' }
];

// ── 2. Pages/Landing — the one page a stranger is allowed to see ─────────────

/**
 * ⚠️ **Deliberately a plain page component.** The site builder's section machine
 * is P77's, and phase 78 T4 is parked behind that work; reaching for it here
 * would put this template in the one place it was scoped to avoid.
 *
 * 🔴 **It is written first, and that is load-bearing.** SB-006 F17: the first
 * page written becomes the router's `startPage`. A members' area whose start
 * page is the sign-in form greets a stranger with a password box; this one opens
 * on what the association does.
 *
 * 🔴 **Its content is a record, not a literal.** The association's name and
 * blurb come from the `Association` row the setup flow writes — the one row in
 * the template the world may read. A template whose landing page said "St.
 * Anywhere Community Association" in a graph would need a person to open the
 * editor to change it, which is the thing this whole product exists not to be.
 */
const LANDING: Tpl001Component = {
  path: 'Pages/Landing',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Landing',
      parameters: { title: 'Welcome', urlPath: '' },
      // 🔴 **REL-002c: the page is BANDS now, not one capped column.** It used
      // to be a single `PAGE_GROUND` holding everything, which is why the
      // baseline verdict reads *"one background colour end to end"* and
      // *"content island floating in dead viewport space"*. A band is
      // full-bleed and owns its ground; the shell inside it is what carries the
      // measure. That is the shape `ui-landing-page` is built from and the
      // shape its own description argues for: *"a page with one background
      // colour end to end is the first thing that reads as a template, and no
      // amount of spacing rescues it."*
      children: ['landingGround']
    },
    {
      id: 'landingGround',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      // 🔴 **A ground under the bands, and the reason is what the fold looks
      // like on a fresh install.** The door state is the shortest this page ever
      // is — `inside` is gated on there being an association — so at 1280 the
      // hero and the footer together came 210px short of the viewport and the
      // page ended in a strip of bare white below a finished footer.
      //
      // ⚠️ **It has to be a Group.** `Page` carries no background port at all:
      // `addSharedVisualInputs` is commented out on the node
      // ([`page.ts:319`](../../noodl-viewer-react/src/nodes/navigation/page.ts#L319))
      // and only `addPaddingInputs` runs, so the obvious place to put this
      // colour does not have somewhere to put it.
      //
      // `--muted` is the footer's own ground, so the slack below the last band
      // reads as part of the footer rather than as the page running out.
      //
      // 🔴 **`minHeight: 100vh`, and `height: 100%` was tried first and did
      // nothing.** A percentage height resolves against the parent, and the
      // parent chain here ends at a `Router`, which sizes itself to its content
      // — `APP_NODES`' own comment says so. So `height: 100%` asked a
      // content-sized box how tall it was and got the answer back. `minHeight`
      // is the one dimension port in the runtime that takes viewport units
      // (`units: ['%', 'px', 'vw', 'vh']`,
      // [`node-shared-port-definitions.ts:1227`](../../noodl-viewer-react/src/node-shared-port-definitions.ts#L1227)),
      // so it floors the page at the viewport without asking anybody.
      //
      // ⚠️ This is worth knowing beyond this page: **every one of the other
      // twelve pages carries `height: 100%` through `PAGE_GROUND` and it is
      // inert there for the same reason.** It is invisible on them only because
      // they paint no background, so nobody could see where the box ended.
      //
      // ⚠️ **`BAND_PAGE_GROUND` now, and it used to be written out here.** The
      // join page needed the identical shape, and the two were about to be two
      // copies of a `minHeight: 100vh` argument that took a render to get right.
      // The constant carries the account; `justifyContent` in particular is not
      // what this page shipped in session 7 and the reason is recorded there.
      parameters: BAND_PAGE_GROUND,
      children: ['heroBand', 'about', 'inside', 'footer']
    },
    {
      id: 'heroBand',
      type: 'Group',
      label: 'The hero — a photograph, and whichever of the three states is true',
      parent: 'landingGround',
      // §D + §F. Every state a stranger can arrive in lands ON this picture:
      // the association (hero + actions), the fresh install (setupCard), and
      // the one that has not answered yet (waitingCard). The page therefore has
      // no frame in which it is blank.
      parameters: HERO_GROUND,
      children: ['heroShell']
    },
    {
      id: 'heroShell',
      type: 'Group',
      label: 'Shell',
      parent: 'heroBand',
      parameters: HERO_SHELL,
      children: ['hero', 'actions', 'setupCard', 'waitingCard']
    },
    {
      id: 'hero',
      type: 'Group',
      label: 'The hero',
      parent: 'heroShell',
      // 🔴 **`mounted: false`, which it was not before, and the reason is the
      // same one REL-002b found on `actions`.** This group holds the two texts
      // the record fills in. Left mounted by default it rendered an eyebrow
      // over two empty `Text` nodes on every unanswered load — the eyebrow and
      // the gap that V4 was filed from. It now arrives with the name in it, or
      // not at all.
      parameters: { ...HERO_HEAD, mounted: false },
      children: ['eyebrow', 'heading', 'tagline']
    },
    {
      id: 'eyebrow',
      type: 'Text',
      label: 'Members’ area',
      parent: 'hero',
      // A literal, unlike its two siblings — see T_EYEBROW on why.
      // ⚠️ `ON_SCRIM` overrides the accent green the composition carries: on the
      // photograph it is a dark colour on a dark ground.
      parameters: { text: 'Members’ area', ...T_EYEBROW, ...ON_SCRIM }
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Association name',
      parent: 'hero',
      // Rule 3: a standing empty text, so nothing renders the word "Text" while
      // the record is on its way.
      parameters: { text: '', ...H_HERO, ...ON_SCRIM }
    },
    {
      id: 'tagline',
      type: 'Text',
      label: 'The tagline',
      parent: 'hero',
      // 🔴 **§E-i — this was `blurb`, the association's whole paragraph, set on
      // a photograph directly under a `--text-5xl` name.** The two are different
      // shapes of writing and the hero only has room for one: a headline's
      // second line is a line, and "About the association" is prose. `/setup`
      // now collects both, so the hero takes the short one and the band below
      // takes the long one — and neither is a string somebody has to open the
      // editor to change.
      //
      // ⚠️ `lead` carries its own 560px cap, which is a measure on the TYPE. It
      // is kept here and it is not the thing V29 ruled against: this shell is
      // left-aligned, so the leftover width falls on one side because the text
      // starts at the left, not because the cap centred it oddly. The rule
      // Richard gave is about STRUCTURAL shells, and this is a paragraph.
      parameters: { text: '', ...T_LEAD, ...ON_SCRIM }
    },
    {
      id: 'actions',
      type: 'Group',
      label: 'Ways in',
      parent: 'heroShell',
      // ⚠️ Deliberately no surface: two buttons under a hero are the hero's, and
      // boxing them would put a card between the headline and the way in.
      //
      // 🔴 **REL-002b — `mounted: false`, and this was V4's whole mechanism.**
      // Every other group on this page already defaulted closed; `actions` was
      // the one that did not, so when the association query never answered it
      // was the only thing left standing. That is exactly the photograph V4 was
      // filed from: an eyebrow, a gap where the name should be, and two
      // buttons. The three states — never answered, answered and unclaimed,
      // answered and claimed — collapsed into one, and the one they collapsed
      // into was the state with no words on it.
      parameters: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 'var(--space-3)',
        mounted: false
      },
      children: ['signInButton', 'joinButton']
    },
    {
      id: 'signInButton',
      type: 'net.noodl.controls.button',
      label: 'Members sign in',
      parent: 'actions',
      parameters: btn('Members sign in')
    },
    {
      id: 'joinButton',
      type: 'net.noodl.controls.button',
      label: 'Ask to join',
      parent: 'actions',
      // 🔴 Not `btn()`. `outlineButton` is `--foreground` type inside a
      // `--border-control` hairline on `transparent` — three values chosen
      // against `--background`, all of them near-invisible on the scrim. See
      // `onScrimBtn`.
      parameters: onScrimBtn('Ask to join')
    },

    // ── §E-i — the association's own words, on a band of their own ───────────
    //
    // 🔴 **The blurb used to be the hero's second line and it was the wrong
    // shape there.** "About the association" is a paragraph a churchwarden
    // writes; a hero's second line is a line. Both are collected by `/setup`
    // now, so the two can go where each belongs instead of one string being
    // asked to do both jobs badly.
    //
    // ⚠️ **Gated on `hasAssociation`, like everything else the record fills.**
    // On a fresh install it would otherwise be a `--background` band containing
    // one empty `Text` — an unexplained white stripe between a photograph and a
    // footer.
    //
    // ⚠️ **`PROSE` inside the 1200 shell, not a 1200 paragraph.** §C's measure is
    // on the SHELL; 1200px of running text is ~150 characters a line, about
    // double what anything is read at. `PROSE` is the wrapper `PAGE_GROUND`'s
    // own note describes as the half of §C that stops 1200 making pages worse.
    {
      id: 'about',
      type: 'Group',
      label: 'What this association is',
      parent: 'landingGround',
      parameters: { ...composition('band'), backgroundColor: 'var(--background)', mounted: false },
      children: ['aboutShell']
    },
    {
      id: 'aboutShell',
      type: 'Group',
      label: 'Shell',
      parent: 'about',
      parameters: { ...composition('shell'), sizeMode: 'contentHeight', alignX: 'center', rowGap: 'var(--space-4)' },
      children: ['aboutHeading', 'aboutProse']
    },
    {
      id: 'aboutHeading',
      type: 'Text',
      label: 'About — heading',
      // ⚠️ A literal, and the one place in this template where that is right for
      // a heading: it names the SECTION rather than the association, so it is
      // the same words for every association that installs this. §E-ii's marker
      // is for strings that vary and were left generic; this one does not vary.
      parent: 'aboutShell',
      parameters: { text: 'About us', ...H_BAND }
    },
    {
      id: 'aboutProse',
      type: 'Group',
      label: 'About — the measure',
      parent: 'aboutShell',
      parameters: PROSE,
      children: ['aboutText', 'aboutJoinHint']
    },
    {
      id: 'aboutText',
      type: 'Text',
      label: 'About — the association’s own words',
      parent: 'aboutProse',
      // Rule 3: a standing empty text, so nothing renders the word "Text" while
      // the record is on its way.
      parameters: { text: '', ...T_BODY }
    },
    {
      id: 'aboutJoinHint',
      type: 'Text',
      label: 'About — who may join',
      // ⚠️ **A second `Text`, and §2 of the ratchet is why there has to be one.**
      // That census counts a `Group` wrapping exactly one `Text` as a notice box
      // and pins the total; a prose wrapper holding a single paragraph is
      // indistinguishable from an unpainted notice by that shape. It is also the
      // sentence the page was missing — a stranger who has just read what the
      // association is has nowhere to be told what happens if they ask to join.
      parent: 'aboutProse',
      parameters: { text: 'Membership is by request: ask to join and a moderator will approve you.', ...T_META }
    },

    // ── What is behind the door ──────────────────────────────────────────────
    //
    // 🔴 **UNGATED since REL-002c item 1, and the gate was answering the wrong
    // question.** It used to ride `hasAssociation` on the argument that it would
    // otherwise *"promise a diary and a directory to a person whose first job is
    // to create the association"*. Two things are wrong with that. The band sits
    // BELOW the hero, not above it, so it never sat over the setup card the way
    // the comment described — that was true when it was a section inside the old
    // single-column page and it stopped being true when it became a band. And
    // the promise it makes is about the PRODUCT, not about this install's
    // content: "Announcements / The diary / The directory" is true of every copy
    // of this template on the day it is unzipped, which is exactly why the three
    // sentences are literals rather than a query.
    //
    // 🔴 **What the gate actually did was leave a hole.** Photographed at HEAD
    // `60fe7e16`: the unconnected landing is a 560px photograph, a notice on its
    // scrim, then **190px of bare `--muted`** at 1280 and 330px at 1900, a
    // hairline, and the footer. Every band that could have filled it was closed
    // on a query that never answers. This one needs no backend and no
    // association, so it is the one that opens.
    //
    // ⚠️ **Third time this page's bottom edge has been fixed by moving the
    // hole** — s7 added the footer, s8 turned `flex-start` into `space-between`,
    // and both times the void reappeared one element away. It is not a layout
    // parameter: the page does not fill because it has nothing to fill it with.
    //
    // ⚠️ **The three sentences are literals on purpose, and they are claims this
    // template can keep**: `Pages/Members`, `Pages/Meetings` and
    // `Pages/Directory` are all shipped, so nothing here describes a screen that
    // is not in the artefact. `tpl001Template.test.ts` pins the page list, which
    // is what stops this becoming a promise a later edit quietly breaks.
    { id: 'inside', type: INSIDE_BAND_COMPONENT, label: 'What members can see', parent: 'landingGround' },

    // ── The foot of the page ─────────────────────────────────────────────────
    //
    // 🔴 **A COMPONENT since REL-002c item 4, and it used to be four nodes
    // written out here.** Eleven other pages ended in nothing at all; they place
    // this now, and the two `EDIT ME —` lines an association has to replace are
    // two strings in one place rather than twenty-six across thirteen pages.
    // See `FOOTER_NODES` for what is in it and why the copy is written to look
    // unfinished.
    //
    // ⚠️ **It stays the last band on `landingGround`.** This page is bands on
    // `BAND_PAGE_GROUND`, so it does not take `pageShell` — the ground already
    // floors at `100vh` and `space-between` already pins this to the foot.
    { id: 'footer', type: FOOTER_COMPONENT, label: 'The foot of the page', parent: 'landingGround' },

    {
      id: 'setupCard',
      type: 'Group',
      label: 'Nobody has set this up yet',
      parent: 'heroShell',
      // 🔴 AC6's other half. A template ships graphs, not rows, so the very
      // first person to open the installed app sees an association with no name
      // — and this is the screen that tells them what to do about it rather
      // than a blank page that looks broken.
      // 🔴 §F's other half. This was an `--accent` card on a white page; it is
      // now a glass panel on the photograph, so the fresh-install state is a
      // designed screen rather than a notice floating in an empty one.
      parameters: { ...SCRIM_PANEL, mounted: false },
      children: ['setupHeading', 'setupText', 'setupButton']
    },
    {
      id: 'waitingCard',
      type: 'Group',
      label: 'The association could not be read',
      parent: 'heroShell',
      // 🔴 **REL-002b — the third state, which had no screen.**
      //
      // This is the ONE group on the page that is mounted by DEFAULT, and that
      // is the design rather than an oversight. "The query has not answered" is
      // the state the page is in before anything happens, so it is the state
      // the page should start in; every other card here is mounted by a wire
      // that only fires once an answer arrives.
      //
      // ⚠️ It is deliberately NOT wired to `association.failure`. Measured this
      // session: with no backend bound at all, `DbCollection2` never fires
      // `failure` — the request 200s with the host page's HTML, `JSON.parse`
      // throws inside the adapter, and the node is left having heard nothing
      // (registered as an open defect against `ParseWireAdapter._makeRequest`).
      // A card hung off `failure` would therefore be dead in exactly the case
      // it exists for. Hanging it off the DEFAULT and taking it down on an
      // answer needs no failure signal, and cannot be silently disarmed by one
      // that does not fire.
      // 🔴 **§F — RULED as a first-class state, and this is what that means.**
      // It was a grey `--muted` box in the middle of a white page. It is now a
      // glass panel standing on the hero photograph, which is the same
      // treatment the other two states get: a person whose install has not
      // connected yet meets a designed screen, not the absence of one.
      parameters: { ...SCRIM_PANEL },
      children: ['waitingHeading', 'waitingText']
    },
    {
      id: 'waitingHeading',
      type: 'Text',
      label: 'Could not be read — the heading',
      parent: 'waitingCard',
      parameters: {
        text: 'This members’ area is not connected yet',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-semibold)',
        lineHeight: 'var(--leading-snug)',
        ...ON_SCRIM
      }
    },
    {
      id: 'waitingText',
      type: 'Text',
      label: 'Could not be read — the words',
      parent: 'waitingCard',
      // Both readers in one sentence each, because both of them land here: the
      // person who has just installed the template and bound no backend, and
      // the member the gate ejected because the backend stopped answering.
      parameters: {
        text:
          'The app cannot reach its backend, so it does not yet know which association this is or ' +
          'who you are. If you have just installed it, connect a backend and reload. If you are a ' +
          'member, this is usually temporary — please try again in a moment.',
        ...T_NOTICE,
        ...ON_SCRIM
      }
    },
    {
      id: 'setupHeading',
      type: 'Text',
      label: 'Not set up yet — the heading',
      parent: 'setupCard',
      // 🔴 A heading it did not have. The card was one grey sentence and a
      // button; beside `waitingCard`, which has always had a heading, it read
      // as the lesser of two states when it is in fact the one with something
      // to do on it.
      parameters: {
        text: 'Nobody has set this up yet',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-semibold)',
        lineHeight: 'var(--leading-snug)',
        ...ON_SCRIM
      }
    },
    {
      id: 'setupText',
      type: 'Text',
      label: 'Setup notice',
      parent: 'setupCard',
      parameters: {
        text:
          'Name your association and create the first moderator account. It takes a minute, and ' +
          'nothing else on this site works until it is done.',
        ...T_NOTICE,
        ...ON_SCRIM
      }
    },
    {
      id: 'setupButton',
      type: 'net.noodl.controls.button',
      label: 'Set it up',
      parent: 'setupCard',
      parameters: btn('Set it up')
    },
    {
      id: 'association',
      type: 'DbCollection2',
      label: 'The association',
      // ⚠️ **Keeps its load-time fetch, deliberately.** SB-005's correction:
      // with both boxes off and no filter parameter there is no trigger left at
      // all. This is the one query in the template a stranger is allowed to run,
      // and it must run the moment the page opens.
      parameters: { collectionName: COLLECTION_ASSOCIATION }
    },
    {
      id: 'read',
      type: 'JavaScriptFunction',
      label: 'The association, or the invitation to set one up',
      parameters: {
        // 🔴 `items` and not `isEmpty`: `isEmpty` is `true` before the first
        // query has run, so a node deciding on it would show the setup card to
        // every visitor for the length of one round trip.
        functionScript:
          'if (Inputs.rows === undefined) return;\n' +
          'const rows = Inputs.rows || [];\n' +
          'const row = rows.length > 0 ? rows[0] : undefined;\n' +
          "Outputs.name = row ? (row.name || '') : '';\n" +
          "Outputs.tagline = row ? (row.tagline || '') : '';\n" +
          "Outputs.blurb = row ? (row.blurb || '') : '';\n" +
          'Outputs.hasAssociation = rows.length > 0;\n' +
          'Outputs.needsSetup = rows.length === 0;\n' +
          '// REL-002b. Always `false`, and that is the point: this node runs\n' +
          '// only when the query answered, so publishing "the query has not\n' +
          '// answered = false" is what takes the waiting card down. There is\n' +
          '// deliberately no path that sets it back to `true` — a page that\n' +
          '// answered once has answered.\n' +
          'Outputs.unanswered = false;'
      }
    },
    {
      id: 'toSignIn',
      type: 'RouterNavigate',
      label: 'Go to sign in',
      parameters: { router: ROUTER, target: '/Pages/SignIn' }
    },
    {
      id: 'toJoin',
      type: 'RouterNavigate',
      label: 'Go to the join form',
      parameters: { router: ROUTER, target: '/Pages/Join' }
    },
    {
      id: 'toSetup',
      type: 'RouterNavigate',
      label: 'Go to setup',
      parameters: { router: ROUTER, target: '/Pages/Setup' }
    }
  ],
  connections: [
    { fromId: 'association', fromProperty: 'items', toId: 'read', toProperty: 'in-rows' },
    { fromId: 'association', fromProperty: 'fetched', toId: 'read', toProperty: 'run' },
    { fromId: 'read', fromProperty: 'out-name', toId: 'heading', toProperty: 'text' },
    { fromId: 'read', fromProperty: 'out-tagline', toId: 'tagline', toProperty: 'text' },
    { fromId: 'read', fromProperty: 'out-blurb', toId: 'aboutText', toProperty: 'text' },
    { fromId: 'read', fromProperty: 'out-needsSetup', toId: 'setupCard', toProperty: 'mounted' },
    // The two ways in are hidden until there is something to be a member of.
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'actions', toProperty: 'mounted' },
    // 🔴 **REL-002c, and the render is what found it missing.** `hero` was given
    // `mounted: false` so it could not paint an eyebrow over two empty `Text`
    // nodes — and for one render it had no wire to turn it back on, so the
    // living landing page showed a photograph and two buttons and NO
    // association name at all. A default-closed group without a wire is not a
    // gate, it is a deletion; the two edits are one edit and this is its other
    // half.
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'hero', toProperty: 'mounted' },
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'about', toProperty: 'mounted' },
    // 🔴 REL-002b — the only wire that can take the waiting card down, and it
    // fires only on an answer. See `waitingCard` for why this is the default
    // state rather than a `failure` branch.
    { fromId: 'read', fromProperty: 'out-unanswered', toId: 'waitingCard', toProperty: 'mounted' },

    { fromId: 'signInButton', fromProperty: 'onClick', toId: 'toSignIn', toProperty: 'navigate' },
    { fromId: 'joinButton', fromProperty: 'onClick', toId: 'toJoin', toProperty: 'navigate' },
    { fromId: 'setupButton', fromProperty: 'onClick', toId: 'toSetup', toProperty: 'navigate' }
  ],
  // None of the three pages exists yet on the create pass.
  deferred: ['toSignIn', 'toJoin', 'toSetup']
};

// ── 3. Pages/SignIn — the door ───────────────────────────────────────────────

/**
 * 🔴 **`Log In`'s outcome ports are `done` / `failure`, not `success`.** ERG-001
 * §4 renamed the family-wide wire name and there is deliberately no `Unchanged`
 * — `UserService.logIn` reaches the backend unconditionally, so there is no
 * "already signed in" no-op to fire.
 *
 * ⚠️ **A pending person signs in perfectly well**, and that is the design rather
 * than a hole: pending *is* an account. What they see when they arrive is the
 * one screen this template is really about, and it is on `Pages/Members`.
 */
const SIGN_IN: Tpl001Component = {
  path: 'Pages/SignIn',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Sign in',
      parameters: { title: 'Sign in', urlPath: 'sign-in' },
      children: ['pageShell']
    },
    // ⚠️ **`people-desk`, and `Pages/Landing` argues against it — for a
    // different page.** Session 7 rejected it as the HERO because *"a members'
    // area is a group of people who belong somewhere, so the room is the subject
    // and the desk is stock photography"*. That judgement is about a 560px hero
    // whose job is to say what the association IS. This band's job is to say what
    // THIS PAGE is, and the page is one person at their own machine coming back
    // to somewhere they already belong — which is what the picture shows.
    // 🔴 **REL-010 — the two bands, and what they replaced.** This page ended in
    // a `Text` reading *"Not a member yet?"* and a button, both sitting loose on
    // the page ground under the form. Measured, it read **2 distinct grounds**
    // (the hero's scrim, the footer's `--muted`) against AC4's four and against
    // the VIB-006 page's six, and **0 images and 0 icons** — the exact pair that
    // fires `no-imagery`.
    //
    // The two loose nodes ARE the prompt, so this is not a band bolted on: it is
    // the page's own last sentence given the ground it was always making a claim
    // about. `inside` then answers the question the prompt asks — a stranger
    // told to ask to join can see what they would be joining without leaving.
    ...pageShell({
      band: 'people-desk.webp',
      prompt: {
        heading: 'Not a member yet?',
        line: 'Membership is by request. Ask to join and a moderator will approve you.',
        action: 'Ask to join'
      },
      inside: true
    }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: { ...FORM_GROUND, alignX: 'center' },
      children: ['form', 'error']
    },
    ...pageHead('heading', 'Heading', 'heroShell', 'Members’ area', 'Members sign in', { onScrim: true, tier: 'door' }),
    {
      id: 'form',
      type: 'Group',
      label: 'The sign-in form',
      parent: 'ground',
      parameters: PANEL,
      children: ['email', 'password', 'submit']
    },
    {
      id: 'email',
      type: 'net.noodl.controls.textinput',
      label: 'Email',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Email', type: 'email' }
    },
    {
      id: 'password',
      type: 'net.noodl.controls.textinput',
      label: 'Password',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Password', type: 'password' }
    },
    {
      id: 'submit',
      type: 'net.noodl.controls.button',
      label: 'Sign in',
      parent: 'form',
      parameters: btn('Sign in')
    },
    // 🔴 **This notice had no gate at all**, and a box is what made that visible.
    // As bare text an empty string renders nothing, so "always mounted" and
    // "hidden until it has something to say" looked identical — right up until
    // the moment it was given padding and a border, when the page would have
    // carried a permanently empty card under the form. `Pages/Setup` gates its
    // refusal (`refusalGate`) and this one never did; the asymmetry was
    // invisible while both were unstyled.
    //
    // ⚠️ Its `text` is WIRED, so that connection names `errorText` while the new
    // `mounted` connection names `error`, which is the box.
    ...notice('error', 'Sign-in error', 'ground', '', { tone: 'refused' }),
    { id: 'login', type: 'net.noodl.user.LogIn', label: 'Log in' },
    { id: 'errorGate', type: 'Condition', label: 'Show the sign-in refusal', parameters: { ...CONDITION_GATE } },
    {
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Go to members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    },
    {
      id: 'toJoin',
      type: 'RouterNavigate',
      label: 'Go to the join form',
      parameters: { router: ROUTER, target: '/Pages/Join' }
    }
  ],
  connections: [
    { fromId: 'email', fromProperty: 'onTextChanged', toId: 'login', toProperty: 'username' },
    { fromId: 'password', fromProperty: 'onTextChanged', toId: 'login', toProperty: 'password' },
    { fromId: 'submit', fromProperty: 'onClick', toId: 'login', toProperty: 'login' },
    { fromId: 'login', fromProperty: 'error', toId: 'errorText', toProperty: 'text' },
    { fromId: 'login', fromProperty: 'failure', toId: 'errorGate', toProperty: 'eval' },
    { fromId: 'errorGate', fromProperty: 'result', toId: 'error', toProperty: 'mounted' },
    { fromId: 'login', fromProperty: 'done', toId: 'toMembers', toProperty: 'navigate' },
    // 🔴 **REL-010 — off the BAND's output, not off a button on this page.**
    // The button lives inside `Members/Prompt` now, and a component's click
    // reaches its host through a `Component Outputs` port. The navigator stays
    // here, which is what keeps every `RouterNavigate` in the template on the
    // page whose router it targets.
    { fromId: 'prompt', fromProperty: 'clicked', toId: 'toJoin', toProperty: 'navigate' }
  ],
  deferred: ['toMembers', 'toJoin']
};

// ── 4. The repeater rows ─────────────────────────────────────────────────────

/**
 * One announcement in the list.
 *
 * `For Each` sets an input called `id` to `model.getId()` and every other
 * declared input to the field of the same name (`foreach.tsx:586-597`). An
 * undeclared field is simply not delivered, so this port list *is* what the row
 * can see.
 */
export const ANNOUNCEMENT_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One announcement',
    parameters: { ...RULED_ROW_SPLIT },
    children: ['rowLines', 'readButton']
  },
  {
    id: 'rowLines',
    type: 'Group',
    label: 'What it is, when, and what it says',
    parent: 'row',
    parameters: { ...ROW_LINES },
    children: ['rowTitle', 'rowExcerpt', 'rowDate']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'rowLines',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  {
    id: 'rowExcerpt',
    type: 'Text',
    label: 'The first line of it',
    parent: 'rowLines',
    // 🔴 **REL-002c, the row family at 1200, and it is a CONTENT answer to a
    // LAYOUT complaint.** At `PAGE_GROUND`'s old 760 a title and a date filled
    // the row; at §C's 1200 the same two lines left about 900px of nothing
    // between "The roof appeal" and its `Read` button, which is what the handoff
    // records as the button being "a long way from its title".
    //
    // ⚠️ **The fix is not to move the button back.** `RULED_ROW_SPLIT` already
    // measured what a content-sized right-hand child costs at 390px
    // (`ada@example.invali / d`), so the two obvious rearrangements are both
    // regressions on a phone. What a wide row actually wants is something to be
    // wide ABOUT — and every announcement already has a body nobody was showing.
    //
    // ✅ **Free at the door.** `For Each` sets every DECLARED input from the
    // field of the same name (`foreach.tsx:586-597`), so declaring `body` below
    // is the entire mechanism; no query, no page and no policy rule changes.
    parameters: { text: '', ...T_BODY, color: 'var(--muted-foreground)' }
  },
  { id: 'rowDate', type: 'Text', label: 'Posted', parent: 'rowLines', parameters: { text: '', ...T_META } },
  {
    id: 'readButton',
    type: 'net.noodl.controls.button',
    label: 'Read',
    parent: 'row',
    parameters: btn('Read')
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The announcement',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'title', type: 'string', plug: 'output' },
      // See `rowExcerpt`: declaring it here is what makes `For Each` deliver it.
      { name: 'body', type: 'string', plug: 'output' },
      { name: 'postedAt', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'when',
    type: 'JavaScriptFunction',
    label: 'The date, as a person writes it',
    parameters: {
      // ⚠️ The reader's own locale, which for an association's noticeboard is the
      // only sensible answer and the one a hard-coded format would get wrong for
      // every association but one. See HUMAN_DAY_FN.
      functionScript:
        HUMAN_DAY_FN + 'if (Inputs.postedAt === undefined) return;\n' + 'Outputs.label = humanDay(Inputs.postedAt);'
    }
  },
  {
    id: 'firstLine',
    type: 'JavaScriptFunction',
    label: 'The first line of the body, and only the first',
    parameters: {
      // 🔴 **Truncated HERE rather than by CSS, because there is no CSS to reach
      // for.** A `Text` in this runtime has no line clamp, so a five-paragraph
      // announcement in an un-truncated row would draw five paragraphs and turn
      // a scannable list into a page of essays — the exact failure `ruled`
      // replaced `card` to end (§7, B3).
      //
      // ⚠️ **A word boundary, not `slice(0, 120)`.** Cutting mid-word reads as a
      // rendering fault rather than as an excerpt, and it is three lines to do
      // properly.
      'runOnChange-in-body': false,
      functionScript:
        'if (Inputs.body === undefined) return;\n' +
        "const flat = String(Inputs.body || '').replace(/\\s+/g, ' ').trim();\n" +
        'if (flat.length <= 120) {\n' +
        '  Outputs.line = flat;\n' +
        '  return;\n' +
        '}\n' +
        'const cut = flat.slice(0, 120);\n' +
        'const lastSpace = cut.lastIndexOf(" ");\n' +
        "Outputs.line = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '\u2026';"
    }
  },
  {
    id: 'goDetail',
    type: 'RouterNavigate',
    label: 'Open the announcement',
    // `target` is a component legacyName, never an invented URL path; the page
    // parameter rides on `pm-<name>`, which `registerInputIfNeeded` resolves to
    // `setPageParam` (`router-navigate.ts:171-175`).
    parameters: { router: ROUTER, target: '/Pages/Announcement' }
  }
];

export const ANNOUNCEMENT_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'rowTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'firstLine', toProperty: 'in-body' },
  { fromId: 'firstLine', fromProperty: 'out-line', toId: 'rowExcerpt', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'postedAt', toId: 'when', toProperty: 'in-postedAt' },
  { fromId: 'when', fromProperty: 'out-label', toId: 'rowDate', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'goDetail', toProperty: `pm-${ANNOUNCEMENT_PARAM}` },
  { fromId: 'readButton', fromProperty: 'onClick', toId: 'goDetail', toProperty: 'navigate' }
];

/** One meeting in the diary. */
export const MEETING_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One meeting',
    parameters: { ...RULED_ROW_SPLIT },
    children: ['rowLines', 'detailButton']
  },
  {
    id: 'rowLines',
    type: 'Group',
    label: 'What it is, when and where',
    parent: 'row',
    parameters: { ...ROW_LINES },
    children: ['rowTitle', 'rowWhen']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'rowLines',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  /**
   * 🔴 **One meta line, not two, and that is the ruled row's doing.** The card
   * stacked `when` and `place` as separate grey lines under the title, which was
   * three lines of column in a box 200px tall. A diary is scanned down its dates,
   * so the row keeps the date leading and hangs the place off it with the `·`
   * the directory row already uses for exactly this — one separator in the app,
   * not two.
   *
   * ⚠️ `rowPlace` is gone rather than emptied: a `Text` wired to nothing renders
   * an empty box that still takes its line-height, and the drive reads `place`
   * off `innerText`, which the joined line still carries.
   */
  { id: 'rowWhen', type: 'Text', label: 'When and where', parent: 'rowLines', parameters: { text: '', ...T_META } },
  {
    id: 'detailButton',
    type: 'net.noodl.controls.button',
    label: 'Details',
    parent: 'row',
    parameters: btn('Details')
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The meeting',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'title', type: 'string', plug: 'output' },
      { name: 'when', type: 'string', plug: 'output' },
      { name: 'place', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'whenLabel',
    type: 'JavaScriptFunction',
    label: 'The date, as a person writes it',
    parameters: {
      functionScript:
        HUMAN_DAY_FN +
        'if (Inputs.when === undefined) return;\n' +
        // The raw string rather than nothing when it will not parse: a row
        // reading `next Tuesday` is legible and a blank line is the bug that
        // hides whatever somebody actually typed.
        "var day = humanDay(Inputs.when);\n" +
        "var said = day === '' ? String(Inputs.when || '') : day;\n" +
        // ⚠️ The separator only appears when there is something on both sides of
        // it. A meeting with no place recorded would otherwise render a date
        // with a dangling `·`, which reads as a field that failed to load.
        "var where = Inputs.place === undefined || Inputs.place === null ? '' : String(Inputs.place);\n" +
        "Outputs.label = where === '' ? said : said + ' \u00b7 ' + where;"
    }
  },
  {
    id: 'goDetail',
    type: 'RouterNavigate',
    label: 'Open the meeting',
    parameters: { router: ROUTER, target: '/Pages/Meeting' }
  }
];

export const MEETING_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'rowTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'when', toId: 'whenLabel', toProperty: 'in-when' },
  { fromId: 'inputs', fromProperty: 'place', toId: 'whenLabel', toProperty: 'in-place' },
  { fromId: 'whenLabel', fromProperty: 'out-label', toId: 'rowWhen', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'goDetail', toProperty: `pm-${MEETING_PARAM}` },
  { fromId: 'detailButton', fromProperty: 'onClick', toId: 'goDetail', toProperty: 'navigate' }
];

/**
 * One person waiting to join, with the two buttons that decide.
 *
 * 🔴 **No record-write node lives here.** Approve and decline are two
 * `CloudFunction2` instances of `decideMembership`, told apart by a constant
 * `in-approve` — which works with no wire and no declared port because
 * `NodeScope.setNodeParameters` calls `registerInputIfNeeded` on the parameter
 * path too (`nodescope.ts:203`), and `cloudfunction2.ts:210-223` mints `in-*` on
 * demand. The row therefore has no way to write `MemberRequest` or `_Role` even
 * if the collection rules were widened by mistake: the only door is an endpoint
 * whose `call` rule is `role:admin`.
 */
export const REQUEST_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One request to join',
    parameters: { ...ROW_CARD },
    children: ['rowName', 'rowMessage', 'buttons']
  },
  {
    id: 'rowName',
    type: 'Text',
    label: 'Who',
    parent: 'row',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  { id: 'rowMessage', type: 'Text', label: 'Why', parent: 'row', parameters: { text: '', ...T_BODY } },
  {
    id: 'buttons',
    type: 'Group',
    label: 'Decide',
    parent: 'row',
    // 🔴 D24. This pair shipped with no gap, so approve and decline shared an
    // edge and read as one object — on the one screen in the template where the
    // two buttons mean opposite things. `Pages/Landing`'s pair had the gap all
    // along; this one was simply never given it.
    parameters: laidOut('row', { alignItems: 'center' }, 'var(--space-3)'),
    children: ['approveButton', 'declineButton']
  },
  {
    id: 'approveButton',
    type: 'net.noodl.controls.button',
    label: 'Approve',
    parent: 'buttons',
    parameters: btn('Approve')
  },
  {
    id: 'declineButton',
    type: 'net.noodl.controls.button',
    label: 'Decline',
    parent: 'buttons',
    parameters: btn('Decline')
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The request',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'name', type: 'string', plug: 'output' },
      { name: 'message', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'approve',
    type: 'CloudFunction2',
    label: `${FN_DECIDE}(approve: true)`,
    parameters: { function: FN_DECIDE, 'in-approve': true }
  },
  {
    id: 'decline',
    type: 'CloudFunction2',
    label: `${FN_DECIDE}(approve: false)`,
    parameters: { function: FN_DECIDE, 'in-approve': false }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Tell the queue something changed',
    // The page owns the query, so the row cannot refresh it — it says what
    // happened and the page decides. `For Each` republishes an item component's
    // signal output as `itemOutputSignal-<name>` (`foreach.tsx:1030-1037`),
    // which is the port name the page must use and not this one.
    ports: [{ name: 'Changed', type: 'signal', plug: 'input' }]
  }
];

export const REQUEST_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'name', toId: 'rowName', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'message', toId: 'rowMessage', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'approve', toProperty: 'in-requestId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'decline', toProperty: 'in-requestId' },
  { fromId: 'approveButton', fromProperty: 'onClick', toId: 'approve', toProperty: 'call' },
  { fromId: 'declineButton', fromProperty: 'onClick', toId: 'decline', toProperty: 'call' },
  // `done` and not `completed`: a refetch after a failure would redraw the same
  // rows for no reason, and the row is still on the queue.
  { fromId: 'approve', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'decline', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' }
];

/**
 * One person in the directory.
 *
 * 🔴 **It draws `STANDING_LABELS[standing]`, never `standing` itself.** The
 * column holds `member` / `moderator` because that is what the endpoints write
 * and what a spec can compare; a person reading the list is shown "Member" and
 * "Moderator". P75 found the cost of getting this backwards on a surface people
 * actually look at — a template card that drew the machine slug `starter` at a
 * builder.
 *
 * ⚠️ **No buttons.** Removing somebody is a `_Role` operation this template has
 * no node for, and a row offering it would be a control that cannot work. The
 * directory reads.
 */
export const MEMBER_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One member',
    // 🔴 **`RULED_ROW`, not `RULED_ROW_SPLIT`, and the difference was measured
    // rather than chosen.** This row has no action, so the only thing that could
    // sit at its far edge is the standing — and see `RULED_ROW_SPLIT`: a
    // content-sized sentence there does not shrink, so at 390px it took 197px of
    // a 342px row and broke every address mid-word. A directory reads down its
    // names; the hairline is what this row needed from `ruled`, not the split.
    parameters: { ...RULED_ROW },
    children: ['rowLines']
  },
  {
    id: 'rowLines',
    type: COLUMNS_NODE,
    label: 'Who they are, where to reach them, and what they are here',
    parent: 'row',
    // 🔴 **REL-002c, the row family at 1200 — and this is the ONE node type in
    // the runtime that could fix it.** At 760 three stacked lines filled the
    // row. At §C's 1200 the directory drew a 250px column of names down the left
    // and left ~950px of nothing beside it: the page that most looked like it
    // had not been designed for the measure it was given.
    //
    // 🔴 **A `Columns`, and the two obvious alternatives are both recorded
    // failures.** A `Group` row cannot reflow — *"no Group in the runtime has a
    // breakpoint"* — so a three-across Group would be three-across at 390 too;
    // and `RULED_ROW_SPLIT`'s own note measured what putting the standing at the
    // far edge of a Group row costs at 390px (`ada@example.invali / d`, because a
    // content-sized right-hand child takes its width out of the row at every
    // viewport). `smallBreakpoint` is the third answer neither of those has.
    //
    // ⚠️ **`layoutString` and not `autoFit`.** These three columns are not
    // interchangeable cells — a name, an address and a standing have different
    // natural widths and a fixed order — so `'2 2 1'` states the relationship.
    // `autoFit` would give them equal boxes and reflow the ORDER at narrow
    // widths, which for a directory row is nonsense.
    //
    // ⚠️ **700px is the same breakpoint `ui-icon-feature-strip` uses**, and it
    // matters that it is above the phone width and below the desktop one: at 390
    // and at the 988 editor preview this is one column and three columns
    // respectively, which are the two shapes the row is designed as.
    parameters: {
      ...composition('columnsTwoUp'),
      // ⚠️ **`'3 3 2'` and not `'2 2 1'`, which was rendered first.** At 1200 a
      // fifth of the row is ~200px and `Member \u00b7 since 1 September 2026`
      // measures ~197px, so every row in the directory wrapped its standing onto
      // a second line while the two columns beside it sat half empty. A quarter
      // is ~284px. Same measurement `RULED_ROW_SPLIT` records for this string,
      // used here to size a column rather than to rule one out.
      layoutString: '3 3 2',
      smallBreakpoint: { value: 700, unit: 'px' },
      smallLayout: '1'
    },
    children: ['cellName', 'cellEmail', 'cellStanding']
  },
  // 🔴 **Cells, and the door is what taught this** — the same finding
  // `Pages/Landing`'s three tiles carry. A `Columns` child must declare
  // `sizeMode` and `width`: `calcAutoFit` hands each child an equal box and a
  // content-sized child ignores it and draws across the next column. It is also
  // a gate: *"no child of a `Columns` is content-sized, anywhere in the
  // artefact"*.
  //
  // ⚠️ **`rowGap` on each cell, because at `smallLayout: '1'` the three cells
  // stack and become the three lines this row used to be.** Without it the
  // stacked form has no gap at all — the `ROW_LINES` gap it replaced lived on
  // the parent, and a `Columns` spaces its COLUMNS, not the rows it folds them
  // into.
  ...[
    { id: 'cellName', label: 'The name column', child: 'rowName' },
    { id: 'cellEmail', label: 'The address column', child: 'rowEmail' },
    { id: 'cellStanding', label: 'The standing column', child: 'rowStanding' }
  ].map((cell) => ({
    id: cell.id,
    type: 'Group',
    label: cell.label,
    parent: 'rowLines',
    parameters: {
      sizeMode: 'contentHeight',
      width: { value: 100, unit: '%' },
      flexDirection: 'column',
      rowGap: 'var(--space-1)'
    },
    children: [cell.child]
  })),
  {
    id: 'rowName',
    type: 'Text',
    label: 'Who',
    parent: 'cellName',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  { id: 'rowEmail', type: 'Text', label: 'Where to reach them', parent: 'cellEmail', parameters: { text: '', ...T_META } },
  {
    id: 'rowStanding',
    type: 'Text',
    label: 'What they are here',
    parent: 'cellStanding',
    parameters: { text: '', ...T_META }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The member',
    // The names are the `Member` columns: `For Each` publishes an item's
    // properties into the row's input ports by name, so a rename either side is
    // a blank line rather than an error.
    ports: [
      { name: 'name', type: 'string', plug: 'output' },
      { name: 'email', type: 'string', plug: 'output' },
      { name: 'joinedAt', type: 'string', plug: 'output' },
      { name: 'standing', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'describe',
    type: 'JavaScriptFunction',
    label: 'Say what they are, and since when, in English',
    parameters: {
      functionScript:
        HUMAN_DAY_FN +
        'if (Inputs.standing === undefined) return;\n' +
        'const LABELS = ' +
        JSON.stringify(STANDING_LABELS) +
        ';\n' +
        "const standing = Inputs.standing === null ? '' : String(Inputs.standing);\n" +
        '// ⚠️ An unknown standing falls back to the stored word rather than to\n' +
        '// an empty line: a row that says `trustee` is legible, and a row that\n' +
        '// says nothing at all is the bug that hides the new standing nobody\n' +
        '// added a label for.\n' +
        'const label = LABELS[standing] || standing;\n' +
        '// The column is a full ISO timestamp; the day is what a person wants —\n' +
        '// and D25: this was the one site rendering it as `2026-08-29`.\n' +
        'const day = humanDay(Inputs.joinedAt);\n' +
        "Outputs.description = day.length > 0 ? label + ' · since ' + day : label;"
    }
  }
];

export const MEMBER_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'name', toId: 'rowName', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'email', toId: 'rowEmail', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'standing', toId: 'describe', toProperty: 'in-standing' },
  { fromId: 'inputs', fromProperty: 'joinedAt', toId: 'describe', toProperty: 'in-joinedAt' },
  { fromId: 'describe', fromProperty: 'out-description', toId: 'rowStanding', toProperty: 'text' }
];

// ── 5. Pages/Members — the first page behind the door ────────────────────────

/**
 * 🔴 **The negative control AC2 is written about lives here, and it is
 * structural rather than promised.**
 *
 * The announcements query carries `NO_LOAD_TIME_FETCH` and has exactly one
 * trigger: the `Member` signal from `Members/Standing`. A visitor, a pending
 * member and a person whose roles could not be read all reach this page and
 * **no query runs at all** — not one that runs and is refused, not one that runs
 * and returns nothing. There is no flash of content because there is no fetch.
 *
 * The policy is still the boundary: `Announcement.find` names `role:member` and
 * `role:admin`, so the same request from a pending session is refused at the
 * server. This page is the polite half in front of that.
 */
const MEMBERS: Tpl001Component = {
  path: 'Pages/Members',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Members',
      parameters: { title: 'Members', urlPath: 'members' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['pendingNotice', 'unknownNotice', 'memberArea', 'moderatorTools']
    },
    // ⚠️ **"Announcements", not "Members", since s8.** The band above now says
    // whose members' area this is, so a page heading repeating the word
    // "Members" named the app twice and the screen not at all. This page IS
    // the noticeboard; `listHeading` used to say so underneath and is gone.
    //
    // ⚠️ Its eyebrow reads "For members" against the "For moderators" one
    // further down: this is the one page in the app with a zone for each
    // audience, and the two eyebrows are what say so.
    ...pageHead('heading', 'Heading', 'headBandShell', 'For members', 'Announcements', { icon: 'newspaper' }),
    // 🔴 AC3's screen. A pending member is refused exactly as a stranger is, and
    // this is the sentence that stops that refusal reading as a broken app — now
    // in the accent box the token was introduced for and nothing had ever read.
    ...notice('pendingNotice', 'Waiting to be approved', 'ground', PENDING_TEXT, { tone: 'accent' }),
    // ⚠️ `refused` rather than neutral: this one means the server could not be
    // asked, which is a failure — not a standing the person is in.
    ...notice('unknownNotice', 'Membership could not be checked', 'ground', STANDING_UNKNOWN_TEXT, {
      tone: 'refused'
    }),
    {
      id: 'memberArea',
      type: 'Group',
      label: 'What a member sees',
      parent: 'ground',
      // ⚠️ A SECTION, not a card: it holds the announcement cards, and a card
      // inside a card has no edge anybody can see (1.26:1 between the fills).
      parameters: { ...SECTION, mounted: false },
      // 🔴 **`meetingsButton` is gone since REL-002c item 2.** "What's coming
      // up" was a whole button whose destination is a nav pill three inches
      // above it, in the band, on this and every other signed-in page.
      children: ['list', 'emptyState']
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per announcement',
      parent: 'memberArea',
      // ✅ `template` IS checked at the door — `repeater-template-unresolved`,
      // blocking, with the available names listed. It is why the rows are
      // authored before the pages that place them.
      parameters: { templateType: 'explicit', template: ANNOUNCEMENT_ROW }
    },
    // 🔴 AC6 — a template ships graphs, not rows, so this is the first thing
    // every person who installs it sees, and that is why it is a designed box
    // rather than a grey line. Hidden until a query has actually answered:
    // `isEmpty` is true before the first fetch, so binding it straight to this
    // would show "nothing posted yet" to a member whose announcements are still
    // on their way.
    ...notice('emptyState', 'Nothing posted yet', 'memberArea', NO_ANNOUNCEMENTS_TEXT),
    {
      id: 'moderatorTools',
      type: 'Group',
      label: 'What only a moderator sees',
      parent: 'ground',
      // 🔴 AC4's first half. The second half — the write being refused at the
      // server — is `Announcement.create: role:admin` in the policy, and it is
      // the half that counts: UI-only enforcement fails that criterion.
      //
      // ⚠️ **No longer a panel, since s8.** Boxing these three made the page read
      // as five buttons of which three were in a card and two were not, for no
      // reason a reader could see — and the box was the same `--surface` card
      // the announcements above it wear, so it claimed to be the same kind of
      // thing as an announcement. An eyebrow says who they are for in a word,
      // which is what the box was trying and failing to say.
      // ⚠️ `afterSection`: this is the second zone on the page, and the hairline
      // is what makes it read as one. See that helper on why the rule belongs to
      // the PLACE rather than to this node.
      parameters: { ...afterSection(SECTION), mounted: false },
      children: ['moderatorEyebrow', 'postButton']
    },
    {
      id: 'moderatorEyebrow',
      type: 'Text',
      label: 'For moderators',
      parent: 'moderatorTools',
      parameters: { text: 'For moderators', ...T_EYEBROW }
    },
    {
      id: 'postButton',
      type: 'net.noodl.controls.button',
      label: 'Post something',
      parent: 'moderatorTools',
      // 🔴 **The page's ONE call to action, and it used to be one of four.**
      // REL-002c item 2: `Requests to join` and `Who belongs` were deleted
      // beside `What's coming up` above, because all three named a PLACE the
      // band's nav already names in the same word, three inches higher, on
      // every signed-in page. What is left under "For moderators" is the one
      // control that is an ACTION rather than a second copy of the navigation —
      // which is what makes that eyebrow mean something.
      //
      // ⚠️ **No longer `inColumn`, and no longer inside a `Columns`.** The
      // `moderatorButtons` grid existed so three buttons would reflow instead of
      // running off the right edge at 390px ("Who belongs" was one visible
      // letter). One button needs no grid, and a `Columns` with a single child
      // hands it the full container width — a full-bleed 1200px filled button.
      parameters: btn('Post something')
    },
    // ⚠️ No `signOutButton` here since s8: it lives in `Members/Chrome`, at the
    // top of every signed-in page, where a person looks for it. This page used
    // to be the only screen you could sign out from, so every other page ended
    // in "Back to the members area" for want of anywhere else to go.
    //
    // 🔴 **Those six back buttons are gone since s9**, and the band's nav is
    // why. Each of them was the page's only exit and every one of them led
    // here — so "navigation" in this template meant a round trip through the
    // noticeboard whatever you wanted next. ⚠️ The three buttons below STAY:
    // the band names PLACES in one word and this section names ACTIONS in a
    // moderator's own words, under an eyebrow saying who they are for, and it
    // carries the page's one filled button. A nav and a call to action are not
    // the same control.
    {
      id: 'announcements',
      type: 'DbCollection2',
      label: 'The announcements',
      // 🔴 The whole of AC2 in two parameters and one wire: no load-time fetch,
      // and the only trigger is the standing check saying `Member`.
      parameters: {
        collectionName: COLLECTION_ANNOUNCEMENT,
        ...NO_LOAD_TIME_FETCH,
        visualSort: ANNOUNCEMENT_SORT
      }
    },
    {
      id: 'emptyGate',
      type: 'JavaScriptFunction',
      label: 'Is the noticeboard really empty?',
      parameters: {
        functionScript: 'Outputs.empty = (Inputs.count || 0) === 0;'
      }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Back to the landing page',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    },
    // 🔴 **Three navigators went with the three buttons (REL-002c item 2).**
    // `toMeetings`, `toRequests` and `toDirectory` had exactly one driver each
    // and it was the button that was deleted; leaving them would have shipped
    // three `RouterNavigate` nodes nothing can ever fire, on the page a reader
    // of this template is most likely to open first.
    {
      id: 'toPost',
      type: 'RouterNavigate',
      label: 'To the posting form',
      parameters: { router: ROUTER, target: '/Pages/Post' }
    }
  ],
  connections: [
    { fromId: 'chrome', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'moderatorTools', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isUnknown', toId: 'unknownNotice', toProperty: 'mounted' },
    // 🔴 The only trigger the query has.
    { fromId: 'chrome', fromProperty: 'Member', toId: 'announcements', toProperty: 'storageFetch' },
    // 🔴 REL-002b — `Denied`, not `Visitor`. A visitor is sent back to the
    // front door, and so is a reader whose standing could not be READ: with no
    // backend bound this page used to keep them, because `Visitor` fires only
    // when the server answered and said so. A gate whose failure mode is to
    // stay on the protected page is not a gate. The refusal is still the
    // server's; the navigation is the courtesy, and now it is unconditional.
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'announcements', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'announcements', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'announcements', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    { fromId: 'postButton', fromProperty: 'onClick', toId: 'toPost', toProperty: 'navigate' }
    // ⚠️ Signing out moved to `Members/Chrome` in s8, and the Log Out node went
    // with the button that drove it. `toLanding` stays: it is still the
    // destination when the standing check answers `Visitor`.
  ],
  deferred: ['toPost']
};

// ── 6. Pages/Announcement — one notice, in full ──────────────────────────────

/**
 * ⚠️ **This page does not gate on standing, and that is the correct decision
 * rather than an omission.**
 *
 * The record read IS the gate: `Announcement.get` names `role:member` and
 * `role:admin`, so a stranger who types the URL gets a refusal from the server
 * and this page has nothing to render. Adding a standing check would put a
 * second, weaker copy of the boundary in front of the real one — and the copy is
 * the one that would drift.
 *
 * What the page owes the person is a sentence rather than a blank screen, which
 * is what the refusal notice is.
 */
const ANNOUNCEMENT_REMOVAL = removalBlock({
  parent: 'ground',
  holdId: 'hold',
  param: ANNOUNCEMENT_PARAM,
  collectionName: COLLECTION_ANNOUNCEMENT,
  label: REMOVE_ANNOUNCEMENT_LABEL,
  // `Pages/Members` IS the announcements list. Authored before this page, so no
  // deferred pass is needed for the navigator.
  listTarget: '/Pages/Members'
});

const ANNOUNCEMENT: Tpl001Component = {
  path: 'Pages/Announcement',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Announcement',
      // 🔴 Braces, not a colon (`router.tsx:614`, `:753`), and two segments so
      // no one-segment page can ever tie with it.
      parameters: { title: 'Announcement', urlPath: `announcements/{${ANNOUNCEMENT_PARAM}}` },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true, headChild: 'titleHeadRow' }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['readingBlock', 'refusal', 'removal']
    },
    ...pageHead('title', 'Title', 'headBandShell', 'Announcement', '', { icon: 'newspaper' }),
    /**
     * 🔴 **REL-002c s13 — `PROSE`, and this page is the reason the constant
     * exists.** The first render of this page ever taken (s13; it had never been
     * photographed in either state) put the announcement's body across the full
     * §C measure: at 1900 that is one line of about 210 characters. `PAGE_GROUND`'s
     * own note already says §C's 1200 is *"on the SHELL"* and that `PROSE` is
     * *"the half of §C that stops 1200 making pages worse"* — the landing's
     * `aboutProse` applies it and the two detail pages, which nothing had ever
     * rendered, did not. The decision was made once and never carried across.
     *
     * ⚠️ **It holds the date AND the body, and that is not an accident of the
     * gate.** §2 of `tpl001Template.test.ts` counts *a `Group` wrapping exactly
     * one `Text`* as a notice and demands a fill and an edge of it — a measure
     * wrapper around the body alone would be a notice that forgot to be one.
     * Holding both is also the better composition: `--space-2` between them
     * makes the posting date and the words it stamps read as one record rather
     * than two items `PAGE_GROUND` spaced 20px apart.
     */
    {
      id: 'readingBlock',
      type: 'Group',
      label: 'The announcement, at a reading measure',
      parent: 'ground',
      parameters: PROSE,
      children: ['date', 'body']
    },
    { id: 'date', type: 'Text', label: 'Posted', parent: 'readingBlock', parameters: { text: '', ...T_META } },
    { id: 'body', type: 'Text', label: 'Body', parent: 'readingBlock', parameters: { text: '', ...T_BODY } },
    ...notice('refusal', 'Not available', 'ground', 'This announcement is not available to you.', {
      tone: 'refused'
    }),
    { id: 'pageInputs', type: 'PageInputs', label: 'Which announcement', parameters: { pathParams: ANNOUNCEMENT_PARAM } },
    {
      id: 'hold',
      type: 'JavaScriptFunction',
      label: 'Hold the id',
      ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
      parameters: {
        // The id and the fetch leave from the same node — rule 2. The page's
        // mount is the one signal guaranteed to come after the Router has set
        // the parameters (`router.tsx:602`).
        functionScript:
          "if (Inputs.announcementId === undefined || Inputs.announcementId === '') return;\n" +
          'Outputs.announcementId = Inputs.announcementId;\n' +
          'Outputs.ready();'
      }
    },
    {
      id: 'record',
      type: 'DbModel2',
      label: 'The announcement',
      parameters: { collectionName: COLLECTION_ANNOUNCEMENT, idSource: 'explicit' }
    },
    {
      id: 'when',
      type: 'JavaScriptFunction',
      label: 'The date, as a person writes it',
      parameters: {
        functionScript:
          HUMAN_DAY_FN + 'if (Inputs.postedAt === undefined) return;\n' + 'Outputs.label = humanDay(Inputs.postedAt);'
      }
    },
    {
      id: 'refusalGate',
      type: 'Condition',
      label: 'Show the refusal',
      // Rule 4: a `Condition` with a constant `true` turns a signal into the
      // value a `mounted` port can read. A signal wired straight to `mounted`
      // arrives once as `false` and reveals nothing, ever.
      parameters: { ...CONDITION_GATE }
    },
    ...ANNOUNCEMENT_REMOVAL.nodes
  ],
  connections: [
    { fromId: 'pageInputs', fromProperty: `pm-${ANNOUNCEMENT_PARAM}`, toId: 'hold', toProperty: `in-${ANNOUNCEMENT_PARAM}` },
    { fromId: 'page', fromProperty: 'didMount', toId: 'hold', toProperty: 'run' },
    { fromId: 'hold', fromProperty: `out-${ANNOUNCEMENT_PARAM}`, toId: 'record', toProperty: 'modelId' },
    { fromId: 'hold', fromProperty: 'out-ready', toId: 'record', toProperty: 'fetch' },

    { fromId: 'record', fromProperty: 'prop-title', toId: 'title', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-body', toId: 'body', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-postedAt', toId: 'when', toProperty: 'in-postedAt' },
    { fromId: 'when', fromProperty: 'out-label', toId: 'date', toProperty: 'text' },

    { fromId: 'record', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'mounted' },
    ...ANNOUNCEMENT_REMOVAL.connections
  ]
};

// ── 7. Pages/Meetings — what is coming up ────────────────────────────────────

/**
 * The one filtered query in the browser half, and the filter is what makes the
 * page mean "upcoming" rather than "every meeting we ever had".
 *
 * 🔴 **The filter value IS the trigger.** With both `runOnChange` boxes off the
 * only trigger left is `setQueryParameter`, whose own checkbox is ticked
 * (`dbcollectionnode2.ts:1069`) — so the query cannot run before it knows what
 * today is, and it cannot run for a person the standing check never cleared,
 * because `today` is published by a node the `Member` signal fires.
 */
const MEETINGS: Tpl001Component = {
  path: 'Pages/Meetings',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Meetings',
      parameters: { title: 'What’s coming up', urlPath: 'meetings' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['pendingNotice', 'memberArea']
    },
    ...pageHead('heading', 'Heading', 'headBandShell', 'For members', 'What’s coming up', { icon: 'calendar-days' }),
    ...notice('pendingNotice', 'Waiting to be approved', 'ground', PENDING_TEXT, { tone: 'accent' }),
    {
      id: 'memberArea',
      type: 'Group',
      label: 'What a member sees',
      parent: 'ground',
      parameters: { ...SECTION, mounted: false },
      children: ['list', 'emptyState']
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per meeting',
      parent: 'memberArea',
      parameters: { templateType: 'explicit', template: MEETING_ROW }
    },
    ...notice('emptyState', 'Nothing in the diary', 'memberArea', NO_MEETINGS_TEXT),
    {
      id: 'today',
      type: 'JavaScriptFunction',
      label: 'Today, as an ISO day',
      parameters: {
        // 🔴 The value and the trigger from one node: publishing `today` is what
        // runs the query, so a query cannot be triggered by a node that does not
        // also carry its filter — SB-004's rule, and here it doubles as the
        // membership gate.
        functionScript: 'Outputs.day = new Date().toISOString().slice(0, 10);'
      }
    },
    {
      id: 'meetings',
      type: 'DbCollection2',
      label: 'Meetings that have not happened yet',
      parameters: {
        collectionName: COLLECTION_MEETING,
        ...NO_LOAD_TIME_FETCH,
        visualFilter: UPCOMING_FILTER,
        visualSort: MEETING_SORT
      }
    },
    {
      id: 'emptyGate',
      type: 'JavaScriptFunction',
      label: 'Is the diary really empty?',
      parameters: { functionScript: 'Outputs.empty = (Inputs.count || 0) === 0;' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'chrome', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'Member', toId: 'today', toProperty: 'run' },
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'today', fromProperty: 'out-day', toId: 'meetings', toProperty: 'qp-today' },
    { fromId: 'meetings', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'meetings', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'meetings', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },
  ]
};

// ── 8. Pages/Meeting — one meeting, in full ──────────────────────────────────

const MEETING_REMOVAL = removalBlock({
  parent: 'ground',
  holdId: 'hold',
  param: MEETING_PARAM,
  collectionName: COLLECTION_MEETING,
  label: REMOVE_MEETING_LABEL,
  listTarget: '/Pages/Meetings'
});

const MEETING: Tpl001Component = {
  path: 'Pages/Meeting',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Meeting',
      parameters: { title: 'Meeting', urlPath: `meetings/{${MEETING_PARAM}}` },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true, headChild: 'titleHeadRow' }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['readingBlock', 'refusal', 'removal']
    },
    ...pageHead('title', 'Title', 'headBandShell', 'Meeting', '', { icon: 'calendar-days' }),
    /**
     * 🔴 **REL-002c s13 — the detail page showed LESS than the row that links
     * to it, and only the first render of it ever taken said so.** `MeetingRow`
     * already rules this exact pair: *"one meta line, not two… a diary is
     * scanned down its dates, so the row keeps the date leading and hangs the
     * place off it with the `·` the directory row already uses"*. This page
     * stacked `when` and `place` as two separate unlabelled `T_META` lines —
     * the shape that ruling was written against — so a member who clicked
     * `Details` arrived at a **less** composed version of the two facts they
     * had just read.
     *
     * ✅ **The join moves into `whenLabel`, which is where the row does it**,
     * including the row's guard: the separator appears only with something on
     * both sides of it, or a meeting with no place recorded renders a date with
     * a dangling `·` that reads as a field which failed to load.
     *
     * ⚠️ **`place` is deleted, not emptied** — `MeetingRow`'s own note again: a
     * `Text` wired to nothing still renders an empty box and takes its
     * line-height. Nothing asserts on this node; the drive's `place` assertion
     * (`tpl001-members-drive.test.ts` §8) reads `member.meetings`, the LIST,
     * whose joined line still carries it.
     */
    {
      id: 'readingBlock',
      type: 'Group',
      label: 'The meeting, at a reading measure',
      parent: 'ground',
      // See `Pages/Announcement`'s twin: `PROSE` is §C's other half, and it
      // holds two children so §2's notice census does not match it.
      parameters: PROSE,
      children: ['when', 'details']
    },
    { id: 'when', type: 'Text', label: 'When and where', parent: 'readingBlock', parameters: { text: '', ...T_META } },
    { id: 'details', type: 'Text', label: 'Details', parent: 'readingBlock', parameters: { text: '', ...T_BODY } },
    ...notice('refusal', 'Not available', 'ground', 'This meeting is not available to you.', {
      tone: 'refused'
    }),
    { id: 'pageInputs', type: 'PageInputs', label: 'Which meeting', parameters: { pathParams: MEETING_PARAM } },
    {
      id: 'hold',
      type: 'JavaScriptFunction',
      label: 'Hold the id',
      ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
      parameters: {
        functionScript:
          "if (Inputs.meetingId === undefined || Inputs.meetingId === '') return;\n" +
          'Outputs.meetingId = Inputs.meetingId;\n' +
          'Outputs.ready();'
      }
    },
    {
      id: 'record',
      type: 'DbModel2',
      label: 'The meeting',
      parameters: { collectionName: COLLECTION_MEETING, idSource: 'explicit' }
    },
    {
      id: 'whenLabel',
      type: 'JavaScriptFunction',
      label: 'When and where, as a person writes it',
      parameters: {
        // 🔴 The same script as `Members/MeetingRow`'s, for the reason recorded
        // on `readingBlock` above: the row and the page it opens are the same two
        // facts and were composing them two different ways.
        functionScript:
          HUMAN_DAY_FN +
          'if (Inputs.when === undefined) return;\n' +
          "var day = humanDay(Inputs.when);\n" +
          "var said = day === '' ? String(Inputs.when || '') : day;\n" +
          // The separator only when there is something on both sides of it.
          "var where = Inputs.place === undefined || Inputs.place === null ? '' : String(Inputs.place);\n" +
          "Outputs.label = where === '' ? said : said + ' · ' + where;"
      }
    },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } },
    ...MEETING_REMOVAL.nodes
  ],
  connections: [
    { fromId: 'pageInputs', fromProperty: `pm-${MEETING_PARAM}`, toId: 'hold', toProperty: `in-${MEETING_PARAM}` },
    { fromId: 'page', fromProperty: 'didMount', toId: 'hold', toProperty: 'run' },
    { fromId: 'hold', fromProperty: `out-${MEETING_PARAM}`, toId: 'record', toProperty: 'modelId' },
    { fromId: 'hold', fromProperty: 'out-ready', toId: 'record', toProperty: 'fetch' },

    { fromId: 'record', fromProperty: 'prop-title', toId: 'title', toProperty: 'text' },
    // `prop-place` reaches the reader through `whenLabel` now, not through a
    // second grey line of its own — see the note on the `readingBlock` Group.
    { fromId: 'record', fromProperty: 'prop-place', toId: 'whenLabel', toProperty: 'in-place' },
    { fromId: 'record', fromProperty: 'prop-details', toId: 'details', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-when', toId: 'whenLabel', toProperty: 'in-when' },
    { fromId: 'whenLabel', fromProperty: 'out-label', toId: 'when', toProperty: 'text' },

    { fromId: 'record', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'mounted' },
    ...MEETING_REMOVAL.connections
  ]
};

// ── 9. Pages/Join — asking to join ───────────────────────────────────────────

/**
 * 🔴 **No `Sign Up` node, and that is the design.** The policy says
 * `signup: nobody`, so the backend's own signup route is closed and the only
 * door onto an account is `requestAccess` — a public endpoint that creates the
 * account holding no roles and files a row for the moderators. A `Sign Up` node
 * here would be refused at run time and green at every gate.
 *
 * ⚠️ **One answer, whether or not the address already had an account.** Telling
 * a stranger "you are already registered" tells them who belongs to this
 * congregation, which is the one fact the members' area exists to keep. The hint
 * line points a returning person at sign-in, said to everybody at once.
 */
const JOIN: Tpl001Component = {
  path: 'Pages/Join',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Ask to join',
      parameters: { title: 'Ask to join', urlPath: 'join' },
      children: ['joinGround']
    },
    // ── §D — the second public page gets its photograph ────────────────
    //
    // 🔴 **BANDS, like the landing page, and for the same measured reason.** The
    // page was one 720px column on white from the top of the viewport to the
    // bottom of the form. Richard's §D ruling names this page explicitly, and a
    // stranger arrives here by clicking `Ask to join` on a photographed hero —
    // so it is the one transition in the template where two public pages are
    // seen one after the other.
    //
    // ⚠️ **The head moved ONTO the photograph and the form stayed at 720.** That
    // keeps the flagged `FORM_GROUND` departure (§C) a decision about ONE
    // constant: if Richard rules the literal 1200, this page's band structure is
    // already what a two-up split would be built on and only the form half moves.
    {
      id: 'joinGround',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: BAND_PAGE_GROUND,
      // 🔴 **`pageFooter`, and `/join` was the ONLY page in the template
      // without one.** Not noticed until s11's audit and confirmed against a
      // render in s12. `pageShell`'s own note recorded a decision here — *"`/join`
      // ends on a form panel with `--muted` beneath it that is its own bottom
      // edge"* — and the picture disproves it: `BAND_PAGE_GROUND`'s
      // `space-between` over two children pins the form band to the foot, so the
      // `--muted` that argument depends on never renders and the page simply
      // stops in white.
      //
      // ⚠️ **A third child does not reopen the gap `PAGE_SHELL` warns about.**
      // That warning is about slack splitting ABOVE the content and opening a gap
      // under a header; here the two bands above are content-height and the
      // footer is the last child, so `space-between` puts the slack between the
      // form and the foot — which is where this page's slack already was.
      // 🔴 **REL-010 — two bands between the form and the foot, and the
      // `space-between` note above still holds.** That note says the slack lands
      // between the last band and the footer because the footer is last; it
      // still is. What changed is that there is far less slack to place: this
      // page was a hero, a form and a foot, and it is now a hero, a form, what
      // to do if this is the wrong page, and what is behind the door.
      children: ['heroBand', 'formBand', 'prompt', 'inside', 'pageFooter']
    },
    {
      id: 'pageFooter',
      type: FOOTER_COMPONENT,
      label: 'The foot of the page',
      parent: 'joinGround'
    },
    {
      id: 'heroBand',
      type: 'Group',
      label: 'The photograph, and what this page is',
      parent: 'joinGround',
      parameters: JOIN_GROUND,
      children: ['heroShell']
    },
    {
      id: 'heroShell',
      type: 'Group',
      label: 'Shell',
      parent: 'heroBand',
      // 🔴 `sizeMode: 'contentHeight'` is not optional inside an `imageGround`
      // — register V1, and `HERO_SHELL` carries the whole account of why.
      // 🔴 **Capped at the FORM's measure, not the hero's 1200, and the first
      // render is what said so.** With `HERO_SHELL`'s 1200 the heading began at
      // x=64 and the form panel beneath it at x=304 — two measures on one page,
      // which reads as a page whose head belongs to a different template. The
      // rule is that a page has ONE measure; §C puts it at 1200 and the flagged
      // `FORM_GROUND` departure puts a form page at 720, so on this page the
      // head takes 720 too.
      //
      // ⚠️ If Richard rules the literal 1200 (see the handoff), this line is
      // where that page changes — the band structure below it is already what a
      // two-up split would be built on.
      parameters: { ...HERO_SHELL, maxWidth: { value: 720, unit: 'px' } },
      children: ['headingHead']
    },
    // ⚠️ `onScrim`: the eyebrow's accent green and the heading's `--foreground`
    // are both chosen against `--background` and both go dark-on-dark here.
    ...pageHead('heading', 'Heading', 'heroShell', 'Members’ area', 'Ask to join', { onScrim: true, tier: 'door' }),
    {
      id: 'formBand',
      type: 'Group',
      label: 'The form band',
      parent: 'joinGround',
      // ⚠️ `alignItems: center` on the BAND and `alignX: center` on the ground
      // inside it are not a duplicate: the first centres this band's own child,
      // the second is what `layout.ts:150-160` reads to write `alignSelf` on the
      // ground. Either alone leaves the 720 column against the left edge on one
      // of the two axes — `PAGE_GROUND` documents the second half.
      // ⚠️ **`--background`, so the `--surface` panel inside it has something to
      // be a panel ON.** The ground under the bands is `--muted` (#eef1ee) and
      // the form panel is `--surface` (#f4f6f4): 1.03:1, which is not a surface,
      // it is the same colour. `--surface` on `--background` is the pairing
      // every other card in this template is read by, and the `--muted` that is
      // left below this band is what gives the page a bottom edge.
      parameters: {
        width: { value: 100, unit: '%' },
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--background)',
        paddingBottom: 'var(--space-12)'
      },
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'The form column',
      parent: 'formBand',
      // ⚠️ `paddingTop` cut from `PAGE_GROUND`'s `--space-12`: that 48px is the
      // air under a band-less page's top edge, and here the photograph above is
      // already the page's top edge.
      parameters: { ...FORM_GROUND, alignX: 'center', paddingTop: 'var(--space-8)' },
      children: ['form', 'sent', 'refusal']
    },
    // 🔴 The fields were loose on the page ground, full-bleed down a single
    // column. A form is one thing a person fills in, and a panel is how a page
    // says so.
    {
      id: 'form',
      type: 'Group',
      label: 'The request',
      parent: 'ground',
      parameters: PANEL,
      children: ['nameField', 'emailField', 'passwordField', 'messageField', 'sendButton']
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
      label: 'Email',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Email', type: 'email' }
    },
    {
      id: 'passwordField',
      type: 'net.noodl.controls.textinput',
      label: 'Choose a password',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Choose a password', type: 'password' }
    },
    {
      id: 'messageField',
      type: 'net.noodl.controls.textinput',
      label: 'Why you would like to join',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Why you’d like to join', type: 'textArea' }
    },
    {
      id: 'sendButton',
      type: 'net.noodl.controls.button',
      label: 'Send',
      parent: 'form',
      parameters: btn('Send my request')
    },
    ...notice('sent', 'Request received', 'ground', REQUEST_SENT_TEXT, { tone: 'accent' }),
    ...notice('refusal', 'The one refusal', 'ground', REQUEST_REFUSED_TEXT, { tone: 'refused' }),

    // 🔴 **REL-010 — the footnote became the band, and the VIB-001 finding it
    // was written against still holds.** The node this replaces was an outline
    // `Sign in` under the form, and its comment records why it is an outline
    // rather than a `btn()`: *"two primary actions of equal weight on one page,
    // so the page does not say what it wants you to do"*, fixed by keying
    // emphasis on the PLACE rather than on the label.
    //
    // That reasoning is what makes the band correct rather than a promotion. The
    // place changed — a footnote under a form became the page's closing band —
    // and `Members/Prompt` keys its button off `outlineButton` for the same
    // reason the footnote did. The `Send my request` submit is still the only
    // filled control on the page.
    //
    // ⚠️ `ALREADY_A_MEMBER_HINT` stays the words. It is in `tpl001Vocabulary.ts`
    // because the spec holds the graphs and the policy to one spelling; moving
    // the node it sits on must not quietly fork the string.
    {
      id: 'prompt',
      type: PROMPT_COMPONENT,
      label: 'The closing prompt',
      parent: 'joinGround',
      parameters: {
        heading: ALREADY_A_MEMBER_HINT,
        line: 'Members sign in with the email and password they joined with.',
        action: 'Sign in'
      }
    },
    { id: 'inside', type: INSIDE_BAND_COMPONENT, label: 'What members can see', parent: 'joinGround' },
    { id: 'send', type: 'CloudFunction2', label: FN_REQUEST_ACCESS, parameters: { function: FN_REQUEST_ACCESS } },
    { id: 'sentGate', type: 'Condition', label: 'Show the confirmation', parameters: { ...CONDITION_GATE } },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } },
    {
      id: 'toSignIn',
      type: 'RouterNavigate',
      label: 'Go to sign in',
      parameters: { router: ROUTER, target: '/Pages/SignIn' }
    }
  ],
  connections: [
    { fromId: 'nameField', fromProperty: 'onTextChanged', toId: 'send', toProperty: 'in-name' },
    { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'send', toProperty: 'in-email' },
    { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'send', toProperty: 'in-password' },
    { fromId: 'messageField', fromProperty: 'onTextChanged', toId: 'send', toProperty: 'in-message' },
    { fromId: 'sendButton', fromProperty: 'onClick', toId: 'send', toProperty: 'call' },

    { fromId: 'send', fromProperty: 'done', toId: 'sentGate', toProperty: 'eval' },
    { fromId: 'sentGate', fromProperty: 'result', toId: 'sent', toProperty: 'mounted' },
    { fromId: 'send', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'mounted' },

    { fromId: 'prompt', fromProperty: 'clicked', toId: 'toSignIn', toProperty: 'navigate' }
  ]
};

// ── 10. Pages/Setup — where the first moderator comes from ───────────────────

/**
 * 🔴 **Without this screen a fresh members' area has no moderator, and therefore
 * nobody who can approve anybody.** Every rule names `role:admin` or
 * `role:member`; a provisioned backend has neither role and nobody in them. The
 * setup token is the one credential that exists before any account does.
 *
 * ⚠️ **The token is a backend secret, never a project value.** It is provisioned
 * as `ASSOCIATION_SETUP_TOKEN` in the backend's own `secrets.json` (or as
 * `NODEGX_SECRET_ASSOCIATION_SETUP_TOKEN`), which is machine-local and does not
 * travel with a deploy — so a template that shipped one would ship the same
 * token to every association that installed it.
 */
const SETUP: Tpl001Component = {
  path: 'Pages/Setup',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Set up',
      parameters: { title: 'Set up this members’ area', urlPath: 'setup' },
      children: ['pageShell']
    },
    // ⚠️ **`work-carpenter` — marking out a board — and NOT a photograph of
    // people, which every other band in this template is.** That is the one
    // honest constraint this page has: on first run the association does not
    // exist yet, has no members, and has not chosen anything. A picture of a room
    // full of people over a form that creates the very first account would be
    // showing the reader something that is not there. Somebody setting out a
    // piece of work before building it is exactly what this screen is.
    //
    // ⚠️ The subject runs horizontally across the board, which is the property
    // `JOIN_GROUND` records as the reason `people-meeting` survives a 300px crop
    // and `people-market` does not.
    // 🔴 **REL-010 — the same two bands `/sign-in` takes, and `/setup` needed
    // them for a reason of its own.** This is the owner's first ever screen, and
    // it measured `2 grounds, 0 images, 0 icons`: the page that has to convince
    // somebody this template was worth installing was the emptiest in it.
    //
    // ⚠️ **`inside` is not marketing here, it is the specification.** The three
    // tiles name the three screens the owner is about to create. A person part
    // way through a setup form has exactly one question — *what do I get when
    // this finishes* — and the answer was on a page they had already left.
    //
    // ⚠️ **The prompt is for the person who is on the WRONG page**, which on a
    // first-run screen is the commonest way to arrive: a member who followed an
    // old link, or the owner coming back to an association they already made.
    // Its click joins `claim.done` on `toSignIn` — two signals into one
    // navigator, both meaning the same thing.
    ...pageShell({
      band: 'work-carpenter.webp',
      prompt: {
        heading: 'Already set up?',
        line: 'If this association has been created, this page is not the one you want.',
        action: 'Sign in'
      },
      inside: true
    }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: { ...FORM_GROUND, alignX: 'center' },
      children: ['blurb', 'form', 'refusal', 'missing']
    },
    ...pageHead('heading', 'Heading', 'heroShell', 'First run', 'Set up this members’ area', { onScrim: true, tier: 'door' }),
    {
      id: 'blurb',
      type: 'Text',
      label: 'What this does',
      parent: 'ground',
      parameters: {
        text: 'Name your association and create the first moderator account. The setup token comes from your backend configuration.',
        ...T_LEAD
      }
    },
    {
      id: 'form',
      type: 'Group',
      label: 'The setup form',
      parent: 'ground',
      parameters: PANEL,
      children: [
        'nameField',
        'taglineField',
        'aboutField',
        'yourNameField',
        'emailField',
        'passwordField',
        'tokenField',
        'claimButton'
      ]
    },
    {
      id: 'nameField',
      type: 'net.noodl.controls.textinput',
      label: 'Association name',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Association name' }
    },
    {
      id: 'taglineField',
      type: 'net.noodl.controls.textinput',
      // 🔴 **§E-i, and this is the field the whole ruling turns on.** The landing
      // hero's one line under the association's name used to be the long
      // `blurb`, which is the wrong shape for a headline's second line and the
      // right shape for a paragraph. Splitting them is what lets the hero say
      // one thing and the page below say the rest — and it means neither is a
      // string somebody has to find in the editor.
      //
      // ⚠️ **The hint is the whole of §E-ii applied to a FORM.** A label reading
      // "Tagline" gets a tagline from somebody who knows what one is; the
      // parenthetical is for the churchwarden who does not, and it is an example
      // of the SHAPE rather than a sentence anybody would keep.
      label: 'Tagline',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'One line about the association (e.g. “Meeting on the green since 1894”)' }
    },
    {
      id: 'aboutField',
      type: 'net.noodl.controls.textinput',
      label: 'About the association',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'About the association', type: 'textArea' }
    },
    {
      id: 'yourNameField',
      type: 'net.noodl.controls.textinput',
      // 🔴 D22. Without this the founding directory row was filed under the
      // moderator's email address, so the first screen they open shows the same
      // string twice. It sits directly above the email box because the three
      // fields below it are all about the person, and the two above are about
      // the association.
      label: 'Your name',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Your name' }
    },
    {
      id: 'emailField',
      type: 'net.noodl.controls.textinput',
      label: 'Moderator email',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Your email', type: 'email' }
    },
    {
      id: 'passwordField',
      type: 'net.noodl.controls.textinput',
      label: 'Moderator password',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Choose a password', type: 'password' }
    },
    {
      id: 'tokenField',
      type: 'net.noodl.controls.textinput',
      label: 'Setup token',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Setup token', type: 'password' }
    },
    {
      id: 'claimButton',
      type: 'net.noodl.controls.button',
      label: 'Set up',
      parent: 'form',
      parameters: btn('Set up this members’ area')
    },
    // One message for every refusal path, matching the endpoint's: "wrong token"
    // and "already set up" must not be distinguishable.
    ...notice('refusal', 'The one refusal', 'ground', CLAIM_REFUSED_TEXT, { tone: 'refused' }),
    // Rule 3: a standing empty text — a wired-but-unpublished `Text` renders the
    // literal word "Text".
    // 🔴 Its `text` is WIRED, so that one connection names `missingText`; the two
    // `mounted` connections keep naming `missing`, which is now the box.
    ...notice('missing', 'Which box is empty', 'ground', '', { tone: 'refused' }),
    { id: 'claim', type: 'CloudFunction2', label: FN_CLAIM, parameters: { function: FN_CLAIM } },
    {
      id: 'check',
      type: 'JavaScriptFunction',
      label: 'Is anything still blank?',
      /**
       * 🔴 **The refusal that wasted Richard's drive, answered where it leaks
       * nothing.** Measured on a copy of his own backend: a correct token with a
       * blank association name and a WRONG token returned the identical 400 and
       * the identical sentence. The template was not broken, it was
       * undiagnosable — and the likely failure for the person holding the setup
       * token is a typo or an empty box, not an attack.
       *
       * ⚠️ **The endpoint's single message stays exactly as it is.** Rule 3 is
       * right for the server: *"wrong token"* and *"already set up"* must not be
       * distinguishable, or the endpoint answers "does this association exist?"
       * to anyone who asks. Those two are the only refusals that leak anything.
       * "You left the name box empty" leaks nothing at all — the person already
       * knows — so it is answered HERE, in the browser, before the call is made.
       *
       * ⚠️ `blurb` and `tagline` are absent on purpose: both are `preq: false`
       * at the door, so they are the two optional fields and demanding either
       * would refuse a form the server accepts.
       */
      ports: [
        { name: 'out-ready', plug: 'output', type: 'signal' },
        { name: 'out-blocked', plug: 'output', type: 'signal' }
      ],
      parameters: {
        // 🔴 `Run` is ADDITIVE, so without these the check would also fire on
        // every keystroke and scold a person for a box they have not reached yet.
        'runOnChange-in-associationName': false,
        'runOnChange-in-moderatorName': false,
        'runOnChange-in-email': false,
        'runOnChange-in-password': false,
        'runOnChange-in-setupToken': false,
        functionScript:
          'const blank = [];\n' +
          "if (!(Inputs.associationName || '').trim()) blank.push('the association’s name');\n" +
          // D22: `moderatorName` is `preq` at the door, so leaving it out here
          // would mean the browser said the form was complete and the server
          // refused it with the one message that deliberately explains nothing.
          "if (!(Inputs.moderatorName || '').trim()) blank.push('your name');\n" +
          "if (!(Inputs.email || '').trim()) blank.push('your email');\n" +
          "if (!(Inputs.password || '').trim()) blank.push('a password');\n" +
          "if (!(Inputs.setupToken || '').trim()) blank.push('the setup token');\n" +
          'if (blank.length === 0) {\n' +
          "  Outputs.problem = '';\n" +
          '  Outputs.ready();\n' +
          '  return;\n' +
          '}\n' +
          '// Rule 2: the sentence and the signal that reveals it leave from the\n' +
          '// same node, so nothing downstream can act on a value still in flight.\n' +
          "Outputs.problem = blank.length === 1\n" +
          "  ? 'Please fill in ' + blank[0] + '.'\n" +
          "  : 'Please fill in ' + blank.slice(0, -1).join(', ') + ' and ' + blank[blank.length - 1] + '.';\n" +
          'Outputs.blocked();'
      }
    },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } },
    { id: 'missingGate', type: 'Condition', label: 'Show what is blank', parameters: { ...CONDITION_GATE } },
    { id: 'missingClear', type: 'Condition', label: 'Hide it once the form is complete', parameters: { condition: false, 'runOnChange-condition': false } },
    {
      id: 'toSignIn',
      type: 'RouterNavigate',
      label: 'Sign in as the moderator',
      parameters: { router: ROUTER, target: '/Pages/SignIn' }
    }
  ],
  connections: [
    { fromId: 'nameField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-associationName' },
    { fromId: 'taglineField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-tagline' },
    { fromId: 'aboutField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-blurb' },
    { fromId: 'yourNameField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-moderatorName' },
    { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-email' },
    { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-password' },
    { fromId: 'tokenField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-setupToken' },
    // 🔴 The button no longer calls the endpoint directly — it asks the check,
    // and the check calls the endpoint. A form that reaches the server to be
    // told "those details" when a box is empty is a round trip spent to say
    // less than the page already knew.
    { fromId: 'claimButton', fromProperty: 'onClick', toId: 'check', toProperty: 'run' },
    { fromId: 'nameField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-associationName' },
    { fromId: 'yourNameField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-moderatorName' },
    { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-email' },
    { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-password' },
    { fromId: 'tokenField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-setupToken' },
    { fromId: 'check', fromProperty: 'out-ready', toId: 'claim', toProperty: 'call' },
    { fromId: 'check', fromProperty: 'out-problem', toId: 'missingText', toProperty: 'text' },
    { fromId: 'check', fromProperty: 'out-blocked', toId: 'missingGate', toProperty: 'eval' },
    { fromId: 'missingGate', fromProperty: 'result', toId: 'missing', toProperty: 'mounted' },
    // And it goes away again the moment the form is complete, rather than
    // sitting there contradicting a page the person has since filled in.
    { fromId: 'check', fromProperty: 'out-ready', toId: 'missingClear', toProperty: 'eval' },
    { fromId: 'missingClear', fromProperty: 'result', toId: 'missing', toProperty: 'mounted' },

    // The account exists but nothing has signed it in — `Create User` is a
    // server-side node and sets no browser session — so setup ends at the door
    // rather than inside.
    { fromId: 'claim', fromProperty: 'done', toId: 'toSignIn', toProperty: 'navigate' },
    // REL-010. The second producer of the same signal — see the prompt above.
    { fromId: 'prompt', fromProperty: 'clicked', toId: 'toSignIn', toProperty: 'navigate' },
    { fromId: 'claim', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'mounted' }
  ]
};

// ── 11. Pages/Post — the moderator's desk ────────────────────────────────────

/**
 * 🔴 **AC4 is graded on two things and this page is only one of them.** The
 * moderator's forms are hidden from a member here; the write is refused at the
 * server by `Announcement.create: role:admin` and `Meeting.create: role:admin`.
 * UI-only enforcement fails that criterion, and a screen that gated on standing
 * *instead of* the policy would be exactly that.
 *
 * ⚠️ **Every row is born with the members' ACL on it.** A record written with no
 * access control is readable by whatever the collection rule allows and nothing
 * narrower, so a later widening of `Announcement.find` would expose every notice
 * ever posted. The rules go on at creation, which is the only moment they are
 * cheap.
 */
const POST: Tpl001Component = {
  path: 'Pages/Post',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Post',
      parameters: { title: 'Post something', urlPath: 'post' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      // 🔴 `PAGE_GROUND`, not `FORM_GROUND`, and `AT_FORM_MEASURE` on the two
      // children below — Richard's ruling of 2026-09-01. The head now lines up
      // with the association's name in the band and with the footer; only the
      // forms are capped. See `AT_FORM_MEASURE`.
      parameters: PAGE_GROUND,
      children: ['notAllowed', 'tools']
    },
    ...pageHead('heading', 'Heading', 'headBandShell', 'For moderators', 'Post something', { icon: 'pencil' }),
    ...notice('notAllowed', 'Not a moderator', 'ground', 'Only a moderator can post here.', {
      tone: 'refused',
      atFormMeasure: true
    }),
    {
      id: 'tools',
      type: 'Group',
      label: 'The two forms',
      parent: 'ground',
      // A SECTION: it holds the two form panels, and a panel inside a panel has
      // no edge. This is also the node D7/D16 hang on — it is what leaves the
      // document entirely when the reader is not a moderator.
      parameters: { ...laidOut('column', SECTION, 'var(--space-6)'), ...AT_FORM_MEASURE, mounted: false },
      children: ['announcementForm', 'meetingForm']
    },
    {
      id: 'announcementForm',
      type: 'Group',
      label: 'An announcement',
      parent: 'tools',
      // ⚠️ `paddingBottom: 24` was a bare pixel count standing in for the gap
      // between the two forms. The gap belongs to the section that holds them.
      parameters: PANEL,
      children: ['aHeading', 'aTitle', 'aBody', 'aButton', 'aDone']
    },
    {
      id: 'aHeading',
      type: 'Text',
      label: 'Announcement heading',
      parent: 'announcementForm',
      parameters: { text: 'Post an announcement', ...H_SECTION }
    },
    {
      id: 'aTitle',
      type: 'net.noodl.controls.textinput',
      label: 'Announcement title',
      parent: 'announcementForm',
      parameters: { ...FIELD, useLabel: true, label: 'Title' }
    },
    {
      id: 'aBody',
      type: 'net.noodl.controls.textinput',
      label: 'Announcement body',
      parent: 'announcementForm',
      parameters: { ...FIELD, useLabel: true, label: 'What you want to say', type: 'textArea' }
    },
    {
      id: 'aButton',
      type: 'net.noodl.controls.button',
      label: 'Post',
      parent: 'announcementForm',
      parameters: btn('Post it')
    },
    {
      id: 'aDone',
      type: 'Text',
      label: 'Announcement posted',
      parent: 'announcementForm',
      // ⚠️ Coloured, not boxed: it sits INSIDE the form panel it confirms.
      parameters: { text: 'Posted. Members can see it now.', mounted: false, ...T_CONFIRM }
    },
    {
      id: 'meetingForm',
      type: 'Group',
      label: 'A meeting',
      parent: 'tools',
      parameters: PANEL,
      children: ['mHeading', 'mTitle', 'mWhen', 'mPlace', 'mDetails', 'mButton', 'mDone']
    },
    {
      id: 'mHeading',
      type: 'Text',
      label: 'Meeting heading',
      parent: 'meetingForm',
      parameters: { text: 'Add a meeting', ...H_SECTION }
    },
    {
      id: 'mTitle',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting title',
      parent: 'meetingForm',
      parameters: { ...FIELD, useLabel: true, label: 'Title' }
    },
    {
      id: 'mWhen',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting date',
      parent: 'meetingForm',
      // ⚠️ A plain field carrying `YYYY-MM-DD` rather than a date picker: the
      // upcoming filter compares this string lexicographically, which is exactly
      // right for an ISO day and wrong for every other format a picker might
      // hand over.
      //
      // 🔴 D25: the format is still required, but it was in the LABEL — a person
      // filling in a form was shown a storage format as the name of the field.
      // It moves to the placeholder, which is where an example belongs, and the
      // label becomes the word a person would use.
      parameters: { ...FIELD, useLabel: true, label: 'Date', placeholder: '2026-09-14' }
    },
    {
      id: 'mPlace',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting place',
      parent: 'meetingForm',
      parameters: { ...FIELD, useLabel: true, label: 'Where' }
    },
    {
      id: 'mDetails',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting details',
      parent: 'meetingForm',
      parameters: { ...FIELD, useLabel: true, label: 'Details', type: 'textArea' }
    },
    {
      id: 'mButton',
      type: 'net.noodl.controls.button',
      label: 'Add',
      parent: 'meetingForm',
      parameters: btn('Add it to the diary')
    },
    {
      id: 'mDone',
      type: 'Text',
      label: 'Meeting added',
      parent: 'meetingForm',
      parameters: { text: 'Added. Members can see it now.', mounted: false, ...T_CONFIRM }
    },
    {
      id: 'notModerator',
      type: 'JavaScriptFunction',
      label: 'Is this person not a moderator?',
      parameters: {
        // The negation is a node rather than an inverted wire because a `mounted`
        // port takes a value and there is nothing on the standing component that
        // publishes "not a moderator" — and inventing one there would put a
        // fifth boolean on a component whose whole job is to have few.
        functionScript: 'if (Inputs.isModerator === undefined) return;\nOutputs.no = Inputs.isModerator !== true;'
      }
    },
    {
      id: 'stampAnnouncement',
      type: 'JavaScriptFunction',
      label: 'When it was posted',
      ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
      parameters: {
        // Rule 2: the timestamp and the `Do` leave from one node, so the record
        // cannot be written with the field still in flight.
        functionScript: 'Outputs.postedAt = new Date().toISOString();\nOutputs.go();'
      }
    },
    {
      id: 'createAnnouncement',
      type: 'NewDbModelProperties',
      label: 'Post the announcement',
      parameters: { collectionName: COLLECTION_ANNOUNCEMENT, ...MEMBERS_READ_RULES }
    },
    {
      id: 'createMeeting',
      type: 'NewDbModelProperties',
      label: 'Add the meeting',
      parameters: { collectionName: COLLECTION_MEETING, ...MEMBERS_READ_RULES }
    },
    { id: 'aDoneGate', type: 'Condition', label: 'Show the confirmation', parameters: { ...CONDITION_GATE } },
    { id: 'mDoneGate', type: 'Condition', label: 'Show the confirmation', parameters: { ...CONDITION_GATE } },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    },
    // ── TPL-002 ──────────────────────────────────────────────────────────────
    {
      id: 'announce',
      type: 'JavaScriptFunction',
      label: 'Everything the fan-out needs, from one node',
      ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
      parameters: {
        // 🔴 Rule 2 in the place it matters most on this page. The record id
        // comes from the write; the site address comes from the browser. Two
        // producers on a `CloudFunction2` would let `call` fire with one of the
        // two parameters still in flight — and this endpoint mails everybody.
        'runOnChange-in-id': false,
        functionScript:
          "if (Inputs.id === undefined || String(Inputs.id).length === 0) return;\n" +
          'Outputs.announcementId = String(Inputs.id);\n' +
          '// 🔴 The app tells the server where the app is, because the server\n' +
          '// cannot find out. `EmailConfigState.effectiveBaseUrl` exists and the\n' +
          '// product’s own password-reset route uses it, but nothing exposes it\n' +
          '// to a graph — see D34. `location.origin` is, by construction, where\n' +
          '// this members’ area is served from, and the endpoint keeps only the\n' +
          '// scheme and host of whatever it is handed.\n' +
          "Outputs.siteUrl = typeof location !== 'undefined' && location.origin ? String(location.origin) : '';\n" +
          'Outputs.go();'
      }
    },
    { id: 'notify', type: 'CloudFunction2', label: FN_NOTIFY_MEMBERS, parameters: { function: FN_NOTIFY_MEMBERS } },
    {
      id: 'report',
      type: 'JavaScriptFunction',
      label: 'What to tell the moderator',
      parameters: {
        // 🔴 Off, or this draws a sentence from a `sent` count that arrived
        // before the endpoint said it was finished.
        'runOnChange-in-sent': false,
        'runOnChange-in-failed': false,
        'runOnChange-in-error': false,
        functionScript:
          '// TPL-002 §3, and the four cases are separately actionable: post it\n' +
          '// again, tell somebody another way, go and configure SMTP, or nothing.\n' +
          'if (Inputs.sent === undefined) return;\n' +
          'const sent = Number(Inputs.sent) || 0;\n' +
          'const failed = Number(Inputs.failed) || 0;\n' +
          "const error = Inputs.error === undefined || Inputs.error === null ? '' : String(Inputs.error);\n" +
          'if (sent === 0 && failed === 0) {\n' +
          `  Outputs.line = ${JSON.stringify(NOTIFY_NOBODY_TEXT)};\n` +
          '  return;\n' +
          '}\n' +
          'if (sent === 0) {\n' +
          '  // 🔴 The mailer’s own words, verbatim. With SMTP unconfigured this\n' +
          '  // is `notConfiguredReason()`, which names the Backend Services\n' +
          '  // panel — the one thing the person reading it has to go and open.\n' +
          `  Outputs.line = ${JSON.stringify(NOTIFY_FAILED_LEAD)} + (error || ${JSON.stringify(NOTIFY_NONE_SENT_TEXT)});\n` +
          '  return;\n' +
          '}\n' +
          `let line = ${JSON.stringify(NOTIFY_POSTED_LEAD)} + ${JSON.stringify(NOTIFY_SENT_PREFIX)} + sent +\n` +
          `  (sent === 1 ? ${JSON.stringify(NOTIFY_SENT_SUFFIX_ONE)} : ${JSON.stringify(NOTIFY_SENT_SUFFIX_MANY)});\n` +
          'if (failed > 0) {\n' +
          `  line += ${JSON.stringify(NOTIFY_PARTIAL_PREFIX)} + failed + ${JSON.stringify(NOTIFY_PARTIAL_SUFFIX)} + error;\n` +
          '}\n' +
          'Outputs.line = line;'
      }
    },
    {
      id: 'reportRefused',
      type: 'JavaScriptFunction',
      label: 'The fan-out itself was refused',
      parameters: {
        // 🔴 The announcement IS posted — `createAnnouncement.done` is what
        // fired this chain — so the sentence must say so before it says the
        // emails failed. A bare "that did not work" would send a moderator back
        // to post it a second time.
        functionScript:
          `Outputs.line = ${JSON.stringify(NOTIFY_FAILED_LEAD)} + ${JSON.stringify(NOTIFY_NONE_SENT_TEXT)};`
      }
    }
  ],
  connections: [
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'tools', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'aTitle', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-title' },
    { fromId: 'aBody', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-body' },
    { fromId: 'aButton', fromProperty: 'onClick', toId: 'stampAnnouncement', toProperty: 'run' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-postedAt', toId: 'createAnnouncement', toProperty: 'prop-postedAt' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-go', toId: 'createAnnouncement', toProperty: 'store' },
    { fromId: 'createAnnouncement', fromProperty: 'done', toId: 'aDoneGate', toProperty: 'eval' },
    { fromId: 'aDoneGate', fromProperty: 'result', toId: 'aDone', toProperty: 'mounted' },

    // ── TPL-002 ────────────────────────────────────────────────────────────
    // 🔴 The fan-out is fired by `done` and by nothing else. Firing it from the
    // button would mail everybody about an announcement the write then refused.
    { fromId: 'createAnnouncement', fromProperty: 'id', toId: 'announce', toProperty: 'in-id' },
    { fromId: 'createAnnouncement', fromProperty: 'done', toId: 'announce', toProperty: 'run' },
    { fromId: 'announce', fromProperty: 'out-announcementId', toId: 'notify', toProperty: 'in-announcementId' },
    { fromId: 'announce', fromProperty: 'out-siteUrl', toId: 'notify', toProperty: 'in-siteUrl' },
    { fromId: 'announce', fromProperty: 'out-go', toId: 'notify', toProperty: 'call' },

    { fromId: 'notify', fromProperty: 'out-sent', toId: 'report', toProperty: 'in-sent' },
    { fromId: 'notify', fromProperty: 'out-failed', toId: 'report', toProperty: 'in-failed' },
    { fromId: 'notify', fromProperty: 'out-error', toId: 'report', toProperty: 'in-error' },
    { fromId: 'notify', fromProperty: 'done', toId: 'report', toProperty: 'run' },
    // 🔴 The confirmation the page already showed is REPLACED, not added to. The
    // moderator reads one sentence about what happened, and the first version of
    // it — "Posted. Members can see it now." — is true the whole time.
    { fromId: 'report', fromProperty: 'out-line', toId: 'aDone', toProperty: 'text' },

    { fromId: 'notify', fromProperty: 'failure', toId: 'reportRefused', toProperty: 'run' },
    // D27: a throw while assembling the call is the same sentence, not silence.
    { fromId: 'announce', fromProperty: 'failure', toId: 'reportRefused', toProperty: 'run' },
    { fromId: 'report', fromProperty: 'failure', toId: 'reportRefused', toProperty: 'run' },
    { fromId: 'reportRefused', fromProperty: 'out-line', toId: 'aDone', toProperty: 'text' },

    { fromId: 'mTitle', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-title' },
    { fromId: 'mWhen', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-when' },
    { fromId: 'mPlace', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-place' },
    { fromId: 'mDetails', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-details' },
    { fromId: 'mButton', fromProperty: 'onClick', toId: 'createMeeting', toProperty: 'store' },
    { fromId: 'createMeeting', fromProperty: 'done', toId: 'mDoneGate', toProperty: 'eval' },
    { fromId: 'mDoneGate', fromProperty: 'result', toId: 'mDone', toProperty: 'mounted' },
  ]
};

// ── 12. Pages/Requests — the queue ───────────────────────────────────────────

/**
 * The moderators' queue, and the one screen where the pending state is visible
 * to anybody but the person in it.
 *
 * 🔴 **The query runs only on `Moderator`**, not on `Member`: a member who typed
 * this URL would otherwise fire a query for a collection whose `find` rule is
 * `role:admin`, and be refused — correctly, and with a `[]` that this page would
 * have to tell apart from an empty queue. Not running it is simpler and it is
 * the same rule the rest of the template follows.
 */
const REQUESTS: Tpl001Component = {
  path: 'Pages/Requests',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Requests',
      parameters: { title: 'Requests to join', urlPath: 'requests' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['notAllowed', 'queue']
    },
    ...pageHead('heading', 'Heading', 'headBandShell', 'For moderators', 'Requests to join', { icon: 'user-plus' }),
    ...notice('notAllowed', 'Not a moderator', 'ground', 'Only a moderator can see who is waiting to join.', {
      tone: 'refused'
    }),
    {
      id: 'queue',
      type: 'Group',
      label: 'The queue',
      parent: 'ground',
      // A SECTION: it holds the request cards.
      parameters: { ...SECTION, mounted: false },
      children: ['list', 'emptyState']
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per request',
      parent: 'queue',
      parameters: { templateType: 'explicit', template: REQUEST_ROW }
    },
    ...notice('emptyState', 'Nobody waiting', 'queue', NO_REQUESTS_TEXT),
    {
      id: 'notModerator',
      type: 'JavaScriptFunction',
      label: 'Is this person not a moderator?',
      parameters: {
        functionScript: 'if (Inputs.isModerator === undefined) return;\nOutputs.no = Inputs.isModerator !== true;'
      }
    },
    {
      id: 'requests',
      type: 'DbCollection2',
      label: 'People waiting to join',
      parameters: {
        collectionName: COLLECTION_REQUEST,
        ...NO_LOAD_TIME_FETCH,
        visualSort: [{ property: 'requestedAt', order: 'ascending' }]
      }
    },
    {
      id: 'emptyGate',
      type: 'JavaScriptFunction',
      label: 'Is the queue really empty?',
      parameters: { functionScript: 'Outputs.empty = (Inputs.count || 0) === 0;' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'queue', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'Moderator', toId: 'requests', toProperty: 'storageFetch' },
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'requests', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'requests', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'requests', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    // 🔴 `itemOutputSignal-Changed`, not `Changed`: `For Each` republishes an
    // item component's signal outputs under that prefix (`foreach.tsx:1030-1037`).
    // SB-018 (1) is five sessions of a wire that named the port the author
    // wanted, spelled the way the row spells it, doing nothing.
    { fromId: 'list', fromProperty: 'itemOutputSignal-Changed', toId: 'requests', toProperty: 'storageFetch' },
  ]
};

// ── 13. Pages/Directory — who belongs ────────────────────────────────────────

/**
 * The member list §3 asks for, built on the projection `COLLECTION_MEMBER`
 * documents.
 *
 * 🔴 **Requests-shaped, and deliberately identical to it in the part that
 * matters**: the query runs only on `Moderator`, so a member who types this URL
 * fires no query at all rather than one the policy refuses. `Member.find` is
 * `role:admin`, so the refusal exists either way — this page is the polite half
 * in front of it, exactly as `Pages/Members` is for announcements.
 *
 * ⚠️ **It carries `DIRECTORY_PROJECTION_NOTE` on the screen.** A list that
 * silently omits somebody given `role:member` by hand is worse than no list; the
 * sentence is where the moderator reading it will see it.
 */
const DIRECTORY: Tpl001Component = {
  path: 'Pages/Directory',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Directory',
      // 🔴 D23: this page and `Pages/Members` were both titled "Members" — in the
      // browser tab and as the on-page heading. "Who belongs" is the wording
      // already on the button that opens it.
      parameters: { title: 'Who belongs', urlPath: 'directory' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: PAGE_GROUND,
      children: ['notAllowed', 'directory']
    },
    ...pageHead('heading', 'Heading', 'headBandShell', 'For moderators', 'Who belongs', { icon: 'users' }),
    ...notice('notAllowed', 'Not a moderator', 'ground', 'Only a moderator can see the member list.', {
      tone: 'refused'
    }),
    {
      id: 'directory',
      type: 'Group',
      label: 'The list',
      parent: 'ground',
      // A SECTION: it holds the member cards.
      parameters: { ...SECTION, mounted: false },
      children: ['projectionNote', 'list', 'emptyState']
    },
    {
      id: 'projectionNote',
      type: 'Text',
      label: 'What this list is, and is not',
      parent: 'directory',
      parameters: { text: DIRECTORY_PROJECTION_NOTE, ...T_META }
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per member',
      parent: 'directory',
      parameters: { templateType: 'explicit', template: MEMBER_ROW }
    },
    ...notice('emptyState', 'Nobody admitted yet', 'directory', NO_MEMBERS_TEXT),
    {
      id: 'notModerator',
      type: 'JavaScriptFunction',
      label: 'Is this person not a moderator?',
      parameters: {
        functionScript: 'if (Inputs.isModerator === undefined) return;\nOutputs.no = Inputs.isModerator !== true;'
      }
    },
    {
      id: 'members',
      type: 'DbCollection2',
      label: 'Everybody this app admitted',
      parameters: {
        collectionName: COLLECTION_MEMBER,
        ...NO_LOAD_TIME_FETCH,
        // By name: a directory is read to find somebody, and `joinedAt` order
        // puts the person you are looking for wherever they happen to be.
        visualSort: [{ property: 'name', order: 'ascending' }]
      }
    },
    {
      id: 'emptyGate',
      type: 'JavaScriptFunction',
      label: 'Is the directory really empty?',
      parameters: { functionScript: 'Outputs.empty = (Inputs.count || 0) === 0;' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'directory', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    // 🔴 The only trigger the query has, and it is `Moderator` rather than
    // `Member`: this list is under the moderator's tools in §3.
    { fromId: 'chrome', fromProperty: 'Moderator', toId: 'members', toProperty: 'storageFetch' },
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'members', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'members', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'members', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },
  ]
};

/**
 * One "what members can see" tile — a component, because the door insisted.
 *
 * 🔴 **This shape was authored inline first and the door refused it**, with
 * `repeated-sibling-subtree`: *"3 sibling subtrees here are structurally
 * identical (3 nodes each, rooted at Group). Make one component and instantiate
 * it 3 times."* It is worth recording as a defect that did **not** happen — the
 * rule is right, it fired on the first attempt, and the message named the fix
 * rather than the symptom. Most of `DEFECTS-THE-TEMPLATES-FOUND.md` is the door
 * failing to say something; this is the door saying it.
 *
 * ⚠️ **Deliberately not a `notice()`,** though it shares the surface. A notice
 * is one sentence a person is meant to act on and is gated by something; a tile
 * is standing description with a title of its own — and the difference is the
 * thing §2 of the ratchet counts, so the two cannot share a shape. See `TILE`.
 *
 * ⚠️ **Placed by parameter, not by wire, and that is a measured choice.** D1 is
 * that the door checks a connection to a component-instance port not at all.
 * Parameters are the other half, and they ARE checked — verified here by
 * sabotage, not by reading: `titel` and `nonsenseXyz` on one of these three came
 * back `instance-unknown-parameter`, blocking, *"a component instance has only
 * the ports its Component Inputs node declares … and this one declares 2"*, and
 * nothing was written.
 *
 * ⚠️ **Ignore the six `info` lines this adds to the generation census.** Three
 * instances × two passes raise `unknown-type-check-skipped` — *"the parameter
 * values check did not run: type /Members/InsideTile is not in the node
 * catalog"* — which reads exactly like the hole above and is not one. The
 * catalog-driven check genuinely does not run; a **dedicated** check covers the
 * same ground and refuses. Recorded as D21, disproved, so the next reader does
 * not spend the session re-deriving it.
 */
export const INSIDE_TILE_NODES = [
  {
    id: 'tile',
    type: 'Group',
    label: 'One tile',
    // 🔴 **REL-010 AC3 — `CARD` alone now, and it used to be `TILE`.**
    // `TILE` is `{ ...CARD, ...CARD_BODY }`: the card's fill and edge and the
    // body's 20px padding merged onto ONE Group. That is right for a box of
    // text and wrong the moment a photograph goes in it — a full-bleed image
    // inside a padded box is an image with a 20px frame of `--surface` around
    // it, which reads as a mistake rather than as a card.
    //
    // So the two halves separate, exactly as `Components/BoxCard` on the
    // VIB-006 page does: the CARD owns the fill, the edge and `clip: true`, and
    // a BODY inside it owns the padding. `clip` is what rounds the photograph's
    // top corners to the card's `--radius-xl` — it comes from the `card`
    // composition and is the reason this split costs no new parameter.
    parameters: { ...CARD },
    children: ['tilePhoto', 'tileBody']
  },
  {
    id: 'tilePhoto',
    type: 'Image',
    label: 'The photograph',
    parent: 'tile',
    // 🔴 **The first real `Image` node in this template**, and REL-010 §2.1 is
    // why that sentence had to be checked rather than trusted. The row's
    // measured finding was `no-imagery` on five pages that *visibly show a
    // photograph* — `render-measure` counts `visible.filter(el => el.tagName
    // === 'IMG')` and cannot see a CSS `background-image`, so the hero's scrim
    // was invisible to it. The finding's wording was misleading and **the fact
    // underneath was worse than the finding**: across all thirty components the
    // template contained **zero `Image` nodes**, and its only photography was a
    // `backgroundImage` parameter on a hero Group. Photography was never
    // content here, only ground.
    //
    // ⚠️ **`sizeMode: 'explicit'` with a fixed height, and it is not
    // decoration.** Three tiles in a `gridAutoFit` are three columns of
    // different natural heights; a content-sized image makes the three cards
    // three different heights, which is the "nobody designed this" tell one
    // level down from the one this row is closing. 200px against `BoxCard`'s
    // 240 because these tiles carry two lines of text where a box card carries
    // three.
    //
    // ⚠️ `objectFit: 'cover'` — the starter photographs are 900×675 and these
    // boxes are ~360×200, so without it every one of them distorts.
    parameters: {
      sizeMode: 'explicit',
      objectFit: 'cover',
      width: { value: 100, unit: '%' },
      height: { value: 200, unit: 'px' },
      src: '',
      alt: ''
    }
  },
  {
    id: 'tileBody',
    type: 'Group',
    label: 'The words',
    parent: 'tile',
    parameters: { ...CARD_BODY, sizeMode: 'contentHeight' },
    children: ['tileTitle', 'tileLine']
  },
  { id: 'tileTitle', type: 'Text', label: 'What it is', parent: 'tileBody', parameters: { text: '', ...T_CARD_TITLE } },
  { id: 'tileLine', type: 'Text', label: 'What it holds', parent: 'tileBody', parameters: { text: '', ...T_NOTICE } },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The tile',
    ports: [
      { name: 'title', type: 'string', plug: 'output' },
      { name: 'line', type: 'string', plug: 'output' },
      // ⚠️ **`picture`, not `image`.** `Image` is a node type name in this
      // project and a port called `image` on an instance that contains one is
      // the kind of collision the door renames rather than refuses — see the
      // `record`/`DbModel2` id collision hazard on this row's board.
      { name: 'picture', type: 'string', plug: 'output' },
      // 🔴 **A separate port rather than a derived string.** An `alt` computed
      // from the filename would be `people-meeting` read aloud to somebody
      // using a screen reader. It is the one thing on a decorative photograph
      // that is not decorative.
      { name: 'alt', type: 'string', plug: 'output' }
    ]
  }
];

export const INSIDE_TILE_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'tileTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'line', toId: 'tileLine', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'picture', toId: 'tilePhoto', toProperty: 'src' },
  { fromId: 'inputs', fromProperty: 'alt', toId: 'tilePhoto', toProperty: 'alt' }
];

/**
 * The *"what members can see"* band, as a component — REL-010 AC3/AC4.
 *
 * 🔴 **Placed by the four PUBLIC pages, and by none of the nine gated ones.**
 * That split is Richard's §3.1 ruling of 2026-09-02 — *the public four take the
 * full VIB-006 section vocabulary; the signed-in nine get density and decision,
 * not billboards* — and it is also just true: a member reading `/account` does
 * not need to be told a directory exists, and a band promising one there would
 * be marketing shown to somebody who has already bought.
 *
 * 🔴 **The three photographs are what closed `no-imagery` on the doors.**
 * Measured after the display tier landed: the four door pages read
 * `images 0, icons 0`, which is the ONLY shape that fires the finding
 * ([`nodegx-render-measure/src/index.js:932`](../../nodegx-render-measure/src/index.js#L932)
 * — it needs BOTH to be zero). The gated nine never fired it, because
 * `pageHead`'s icon badge gives them one glyph each. So this band is not
 * decoration bolted on to move a number: it is the one photographed thing the
 * template owned, made placeable.
 *
 * ⚠️ **The band keeps the id `inside` on the pages that place it**, so the
 * landing page's `landingGround` children list is unchanged and no wire moved.
 */
export const INSIDE_BAND_NODES = [
  {
    id: 'inside',
    type: 'Group',
    label: 'What members can see',
    // 🔴 **`inside` is the BAND.** It was a section inside the page column; as
    // a band it owns a ground of its own (`--surface` with hairlines top and
    // bottom), which is what stops the page being one colour from the hero to
    // the fold. It carries no `mounted` at all now — see the note above.
    // 🔴 **Pinned, and the board's hazard 1 is why it had to be.** `bandSurface`
    // carries no `sizeMode`, and `addDimensions` defaults one to `explicit` at
    // `height: 100%`, which `layout.ts:98` turns into `flex-grow: 100` inside a
    // column parent. That was harmless while this band lived on `Pages/Landing`,
    // whose ground is always taller than the viewport. It stops being harmless
    // the moment the band is placed on `/sign-in` and `/setup`, which are short
    // pages inside `PAGE_SHELL`'s `minHeight: 100vh` — there the band would have
    // eaten every pixel of slack the floor created and rendered as a 400px-tall
    // strip of `--surface` with three tiles floating in the middle of it.
    parameters: { ...composition('bandSurface'), sizeMode: 'contentHeight' },
    children: ['insideShell']
  },
  {
    id: 'insideShell',
    type: 'Group',
    label: 'Shell',
    parent: 'inside',
    parameters: { ...composition('shell'), sizeMode: 'contentHeight', alignX: 'center', rowGap: 'var(--space-6)' },
    children: ['insideHeading', 'insideList']
  },
  {
    id: 'insideHeading',
    type: 'Text',
    label: 'What members can see — heading',
    parent: 'insideShell',
    // `sectionHeading` now, not `cardTitle`. It used to be the smaller ramp
    // because it sat 68px under a --text-5xl hero in the same column and
    // competed with it. It is in its own band on its own ground now, so the
    // thing it has to be is the head of a section.
    parameters: { text: 'What members can see', ...H_BAND }
  },
  {
    id: 'insideList',
    type: COLUMNS_NODE,
    label: 'The three tiles',
    parent: 'insideShell',
    // 🔴 **A `Columns`, and the comment this replaces was wrong twice.** It
    // read: *"`gridAutoFit` and `columnsTwoUp` … both live on `Columns`, a
    // node type this template does not use anywhere — and a Group row cannot
    // collapse"*. `Columns` HAS been used here since s8 (the moderator
    // actions on `Pages/Members`), and `Group` does carry a `flexWrap` port
    // ([`group.ts:311`](../../noodl-viewer-react/src/nodes/visual/group.ts#L311)).
    // Neither claim survived being checked, and between them they kept three
    // tiles stacked full-width in a 1200px shell.
    //
    // ⚠️ `minWidth: 300` is what makes it 3-up at 1200 and 1-up at 390:
    // `autoFit` fits as many columns as the container holds, so the reflow is
    // arithmetic on the container rather than a breakpoint anybody maintains.
    parameters: { ...composition('gridAutoFit'), minWidth: { value: 300, unit: 'px' } },
    // 🔴 **Cells, not the tiles themselves, and the door is what taught this.**
    // A `Columns` child must carry `sizeMode` and `width` — `calcAutoFit`
    // hands each child an equal box and a content-sized child ignores it. A
    // COMPONENT INSTANCE cannot carry either: *"a component instance has only
    // the ports its Component Inputs node declares — it carries no layout,
    // style or lifecycle ports of its own"*, and the door refuses the write
    // rather than discarding the values silently. So the thing in the column
    // is a Group that owns the box, and the tile sits in it.
    children: ['cellNews', 'cellDiary', 'cellPeople']
  },
  ...['News', 'Diary', 'People'].map((which) => ({
    id: `cell${which}`,
    type: 'Group',
    label: `The ${which.toLowerCase()} column`,
    parent: 'insideList',
    parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' }, flexDirection: 'column' },
    children: [`tile${which}`]
  })),
  // 🔴 **REL-010 AC3 — three photographs, and the choice of them is the
  // argument.** The starter library ships 44 CC0 photographs in six roles
  // (`starterAssetList.ts`), and the `people-*` role is described there as
  // *"people at work and in places"*. A members' area belongs to a church, a
  // club or a charity, so the three pictures are three rooms with people in
  // them rather than three abstractions — which is the same reasoning the
  // library's own `work-*` note gives: *"the category that stops a feature row
  // looking like a theme demo."*
  //
  // ⚠️ **Three DIFFERENT photographs, and none of them the hero's.**
  // `JOIN_GROUND` already records why a page must not repeat the hero's
  // picture — *"a form page repeating the hero's own photograph reads as a
  // page that failed to load its own"* — and three tiles wearing one picture
  // is that defect three times on one band. The hero is `people-coffee-shop`;
  // none of these is.
  //
  // ⚠️ **The `alt` text describes the PHOTOGRAPH, not the tile.** *"What the
  // moderators have posted"* is the tile's job and it is already on the screen
  // as text; a screen reader that heard it twice would learn nothing and lose
  // the picture.
  {
    id: 'tileNews',
    type: INSIDE_TILE_COMPONENT,
    label: 'Announcements',
    parent: 'cellNews',
    parameters: {
      title: 'Announcements',
      line: 'What the moderators have posted, newest first.',
      picture: 'noodl_modules/starter-imagery/people-cafe.webp',
      alt: 'Two people talking over a table in a cafe'
    }
  },
  {
    id: 'tileDiary',
    type: INSIDE_TILE_COMPONENT,
    label: 'The diary',
    parent: 'cellDiary',
    parameters: {
      title: 'The diary',
      line: 'Meetings and events, with the details and where to go.',
      picture: 'noodl_modules/starter-imagery/people-market.webp',
      alt: 'A busy market stall on a weekend morning'
    }
  },
  {
    id: 'tilePeople',
    type: INSIDE_TILE_COMPONENT,
    label: 'The directory',
    parent: 'cellPeople',
    parameters: {
      title: 'The directory',
      line: 'Who else is a member.',
      picture: 'noodl_modules/starter-imagery/work-potter.webp',
      alt: 'A member at work at the pottery bench'
    }
  }
];

/**
 * The closing prompt — REL-010 AC4, and the page's bottom edge before the foot.
 *
 * 🔴 **`--accent`, which is the third thing this template spends the accent
 * on**, and `tpl001Theme.ts` names the first two: *"the primary at a whisper,
 * for the eyebrow and the pending notice."* A third use needs saying out loud
 * rather than adding quietly. It earns it by being the same KIND of thing as
 * the other two — a moment where the association's own colour marks something
 * addressed to the person reading, not a decoration applied to a surface.
 *
 * Contrast, measured and already on file in `tpl001Theme.ts`:
 * `--accent-foreground` on `--accent` is **6.45:1** against a 4.5 floor, and
 * `--foreground` on `--accent` is higher still. The button keeps
 * `outlineButton`, whose edge reaches for `--muted-foreground` rather than
 * `--border` for the contrast reason that composition states itself.
 *
 * ⚠️ **Two `Text` nodes and not one**, for the reason `FOOTER_NODES` and
 * `aboutProse` both record: §2's notice census counts a `Group` wrapping exactly
 * one `Text` as a notice box and requires it to carry a fill and an edge. It is
 * also the better band — a prompt with a line of context under it reads as an
 * invitation, and a prompt with only a question reads as a form validation.
 *
 * ⚠️ **The line is a LITERAL and it varies per page**, so unlike
 * `INSIDE_BAND_NODES` this one does carry ports. `/sign-in` asks a stranger to
 * join and `/join` asks a member to sign in; the same band with the same words
 * on both would send each reader to the page they are already on.
 */
export const PROMPT_NODES = [
  {
    id: 'prompt',
    type: 'Group',
    label: 'The closing prompt',
    parameters: {
      ...composition('band'),
      backgroundColor: 'var(--accent)',
      // Pinned for the same reason `INSIDE_BAND_NODES`' root is — `band` carries
      // no `sizeMode` either, and this one lands on three floored pages.
      sizeMode: 'contentHeight',
      // ⚠️ `band` ships `--space-20` top and bottom, which is a full marketing
      // band. This one holds two lines and a button and sits directly above the
      // footer; at 80px either side it read as a second footer rather than as a
      // last invitation.
      paddingTop: 'var(--space-12)',
      paddingBottom: 'var(--space-12)',
      borderTopStyle: 'solid',
      borderTopWidth: 'var(--border-1)',
      borderTopColor: 'var(--border)'
    },
    children: ['promptShell']
  },
  {
    id: 'promptShell',
    type: 'Group',
    label: 'Shell',
    parent: 'prompt',
    // 🔴 **Capped at 720 and the type is CENTRED, and the first render is what
    // found it.** `alignItems: 'center'` centres a content-sized child and does
    // nothing to a full-width one — a `Text` fills its column and a `Button` does
    // not. So the band rendered with its heading and its line hard against the
    // shell's left edge and its button in the middle: **two alignments inside one
    // band**, which is the "three left edges" defect this row has already fixed
    // twice, at a smaller scale.
    //
    // ✅ **`textAlignX`, and it is NOT `textAlign`.** The runtime's port is
    // `textAlignX`; `textAlign` would have been a parameter nothing reads, which
    // is indistinguishable from a style that did not apply. Read off
    // `ui-landing-page`'s own `ClosingCta`, which is this band's ancestor and
    // does exactly this: a 720 shell, `alignItems: center`, and `textAlignX` on
    // the type.
    //
    // ⚠️ **720 rather than the shell's 1200** for the same reason `PROSE` exists:
    // a centred sentence set across 1200px is two alignments' worth of eye
    // travel between the end of one line and the start of the next.
    parameters: {
      ...composition('shell'),
      maxWidth: { value: 720, unit: 'px' },
      sizeMode: 'contentHeight',
      alignX: 'center',
      alignItems: 'center',
      rowGap: 'var(--space-3)'
    },
    children: ['promptHeading', 'promptLine', 'promptButton']
  },
  {
    id: 'promptHeading',
    type: 'Text',
    label: 'The question',
    parent: 'promptShell',
    parameters: { text: '', ...H_SECTION, color: 'var(--accent-foreground)', textAlignX: 'center' }
  },
  {
    id: 'promptLine',
    type: 'Text',
    label: 'The context',
    parent: 'promptShell',
    parameters: { text: '', ...T_META, color: 'var(--accent-foreground)', textAlignX: 'center' }
  },
  {
    id: 'promptButton',
    type: 'net.noodl.controls.button',
    label: 'The way on',
    parent: 'promptShell',
    parameters: { ...composition('outlineButton'), label: '' }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'What the prompt says',
    ports: [
      { name: 'heading', type: 'string', plug: 'output' },
      { name: 'line', type: 'string', plug: 'output' },
      { name: 'action', type: 'string', plug: 'output' }
    ]
  },
  /**
   * 🔴 **The click has to leave the component, and a `Component Outputs` is the
   * only way out.** A `RouterNavigate` inside this band would have to name a
   * page, and this band is placed on three pages that each go somewhere
   * different — so the navigation stays on the page and the band publishes the
   * signal. That also keeps every one of the template's navigators on the page
   * whose router they target, which is what the deferred pass is ordered by.
   */
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'The click',
    ports: [{ name: 'clicked', type: 'signal', plug: 'input' }]
  }
];

export const PROMPT_WIRES = [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'promptHeading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'line', toId: 'promptLine', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'action', toId: 'promptButton', toProperty: 'label' },
  { fromId: 'promptButton', fromProperty: 'onClick', toId: 'outputs', toProperty: 'clicked' }
];

/**
 * The foot of every page — REL-002c item 4.
 *
 * 🔴 **Eleven of the thirteen pages ended in undifferentiated white**, and the
 * two that did not are the two the landing footer was written for in s7. The
 * band is what gives a page a bottom edge: a `--muted` ground under a hairline,
 * so the slack below the last thing on the page reads as the foot of the site
 * rather than as the page running out. See `PAGE_SHELL` for the other half —
 * what pushes it down when a page is shorter than the viewport.
 *
 * 🔴 **§E-ii, and this is the template's worked example of it.** Neither line
 * can be data: there is no field on `Association` for a contact address and
 * inventing one would be scope. So both are written to be *obviously*
 * unfinished rather than plausibly finished, and their nodes carry the
 * `EDIT —` prefix that makes the editor's node tree list every string a person
 * still has to visit. *"Your contact details here"* is not copy anybody ships by
 * accident; *"St Anywhere Parish Council · hello@example.org"* is exactly what
 * somebody ships by accident.
 *
 * ⚠️ **Two lines, not one, and §2's notice census is why there has to be a
 * second.** That sweep counts a `Group` wrapping exactly one `Text` as a notice
 * box and requires it to carry a fill and an edge; a structural shell holding a
 * single line is indistinguishable from an unpainted notice by that shape. A
 * footer with one line was also thin — a club, charity or church footer carries
 * the registration line as well as the contact one.
 *
 * ⚠️ **No `Component Inputs`.** Nothing about it varies per page, and a
 * component without one *"renders identically however many times you place
 * it"* — which is the whole point here.
 */
export const FOOTER_NODES = [
  {
    id: 'footer',
    type: 'Group',
    label: 'The foot of the page',
    parameters: composition('footerBand'),
    children: ['footerShell']
  },
  {
    id: 'footerShell',
    type: 'Group',
    label: 'Shell',
    parent: 'footer',
    parameters: { ...composition('shell'), sizeMode: 'contentHeight', alignX: 'center', rowGap: 'var(--space-2)' },
    children: ['footerMark', 'footerEdit', 'footerEditSecond']
  },
  /**
   * REL-010 — **the wordmark, and it is what gives `/unsubscribe` a bottom edge
   * that is not two lines of `EDIT ME`.**
   *
   * 🔴 **It is also the honest fix for the last `no-imagery`.** After the tiles
   * band landed on the four public pages, twelve of thirteen read clean and the
   * survivor was `/unsubscribe` — measured `0 images, 0 icons`, the only pair
   * that fires the finding. That page is deliberately austere: Richard ruled
   * D39 on its slack (*"D39 stands, accept the slack"*), a person arrives on it
   * once from a mail client, and a *"what members can see"* band on a page
   * somebody reached in order to LEAVE would be the worst sentence in the
   * template.
   *
   * So the imagery had to come from something every page already carries, and be
   * worth carrying for its own sake. `ui-landing-page`'s `SiteFooter` opens with
   * exactly this — a glyph and a wordmark above the small print — and §3.1's
   * list for the public four names *"a real footer"* as one of the six things
   * the VIB-006 vocabulary has. This template's footer had no identity of any
   * kind on any page.
   *
   * ⚠️ **This means the door pages would now clear `no-imagery` from the footer
   * alone**, and the tiles band is therefore NOT what closes AC5 on them. It is
   * what closes **AC3** (two content images on each public page) and **AC4**
   * (four distinct grounds). Said plainly because the opposite claim — *"the
   * photographs fixed the imagery finding"* — is the one a later reader would
   * assume from the order the work was done in, and it is false.
   *
   * ⚠️ **`users` rather than a mark nobody chose.** The 212-glyph curated Lucide
   * manifest ships with every project; this is the members' area, and its own
   * `/directory` page already spends the same glyph on *"Who belongs"*.
   */
  {
    id: 'footerMark',
    type: 'Group',
    label: 'The wordmark',
    parent: 'footerShell',
    parameters: {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-2)',
      paddingBottom: 'var(--space-2)'
    },
    children: ['footerMarkGlyph', 'footerMarkText']
  },
  {
    id: 'footerMarkGlyph',
    type: 'net.noodl.visual.icon',
    label: 'The mark',
    parent: 'footerMark',
    // ⚠️ `iconColor`, not `color` — the Icon node's colour arrives through
    // `addIconInputs` and a `color` here would be a parameter nothing reads.
    // `--primary` on `--muted` is the same green the eyebrow is measured at.
    parameters: {
      iconIconSource: glyph('users'),
      iconSize: { value: 20, unit: 'px' },
      iconColor: 'var(--primary)'
    }
  },
  {
    id: 'footerMarkText',
    type: 'Text',
    label: 'The wordmark',
    parent: 'footerMark',
    // A literal, and the same one the hero's eyebrow carries — `T_EYEBROW`'s
    // note argues it: *"Members' area" is a fact about this TEMPLATE*, true of
    // every install, where the association's name is a fact about the recipient
    // and comes out of a row. The footer has no query on it and must not gain
    // one to say a thing that does not vary.
    parameters: { text: 'Members’ area', ...T_EYEBROW }
  },
  {
    id: 'footerEdit',
    type: 'Text',
    label: 'EDIT — who to contact',
    parent: 'footerShell',
    parameters: { text: 'EDIT ME — your association’s contact details go here.', ...T_NOTICE }
  },
  {
    id: 'footerEditSecond',
    type: 'Text',
    label: 'EDIT — the small print',
    parent: 'footerShell',
    parameters: { text: 'EDIT ME — registered charity number, or delete this line.', ...T_NOTICE }
  }
];

/**
 * The band across the top of every signed-in page.
 *
 * 🔴 **Cause 5 of "it feels like Bootstrap": the association's name appeared on
 * exactly one screen.** Sign in and you could be in any app — eleven pages, each
 * headed with a generic noun, two of them the same generic noun (D23). This puts
 * the identity on every page a member sees, which is the one thing no amount of
 * spacing work can substitute for.
 *
 * ⚠️ **It sits OUTSIDE the page ground, as a sibling of it.** `PAGE_GROUND` caps
 * content at 760px and centres it; a header inside that would be a 760px strip
 * floating on the page rather than a band across it. This is the vocabulary's
 * own `band` + `shell` shape — a full-width surface with a capped, centred row
 * inside — built here rather than composed from `band` because `band` carries
 * `--space-20` of vertical padding, which is a section's air and not a header's.
 *
 * ⚠️ **Two rows, not one, and that is a mobile decision.** The name and the way
 * out sit on one line with the nav beneath, because six pill buttons and a
 * heading on one 390px line is a wrap or an overflow and there is no `flexWrap`
 * on a Group.
 *
 * ⚠️ **The query keeps its load-time fetch**, exactly as `Pages/Landing`'s does:
 * `Association` is the one row the world may read, and with no trigger wired
 * there is no other moment for it to run.
 */
export const BAND_NAV: ReadonlyArray<{ id: string; nav: string; label: string; target: string; moderatorOnly?: true }> = [
  { id: 'navAnnouncements', nav: 'toAnnouncements', label: 'Announcements', target: '/Pages/Members' },
  { id: 'navMeetings', nav: 'toMeetingsNav', label: 'Meetings', target: '/Pages/Meetings' },
  { id: 'navPost', nav: 'toPostNav', label: 'Post', target: '/Pages/Post', moderatorOnly: true },
  { id: 'navRequests', nav: 'toRequestsNav', label: 'Requests', target: '/Pages/Requests', moderatorOnly: true },
  { id: 'navDirectory', nav: 'toDirectoryNav', label: 'Who belongs', target: '/Pages/Directory', moderatorOnly: true },
  // 🔴 TPL-002. Not moderator-only: the setting it leads to is every member's,
  // and a page with no route to it is a page nobody finds. It goes in the same
  // `gridAutoFit` as the other five rather than beside Sign out, because
  // `autoFit` is *designed* to wrap and a sixth item in a row that already
  // wraps is not a new layout mechanism — whereas a third child in the top row
  // would be, and D32 is what happens when one is added without looking.
  //
  // ⚠️ **Not yet looked at, and that is recorded rather than assumed.** Six
  // items at `minWidth: 132` in the 760px band fits five across and folds the
  // sixth — arithmetic, not a reading. Richard's rule is that appearance is
  // graded by looking; TPL-002 §7 carries this as owed.
  { id: 'navAccount', nav: 'toAccountNav', label: 'Your account', target: '/Pages/Account' }
];

export const CHROME_NODES = [
  {
    id: 'bar',
    type: 'Group',
    label: 'The band',
    parameters: {
      width: { value: 100, unit: '%' },
      // ⚠️ **Pinned, REL-002c item 4.** A `Group` with no `sizeMode` is
      // `explicit` at `height: 100%`, which a column parent turns into
      // `flex-grow: 100` — harmless while nothing above had height to spare, and
      // a header that swells to half the viewport the moment `PAGE_SHELL` gives
      // the page a floor. A band is as tall as what is in it.
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'var(--surface)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)'
    },
    children: ['inner']
  },
  {
    id: 'inner',
    type: 'Group',
    label: 'The capped column',
    parent: 'bar',
    parameters: {
      width: { value: 100, unit: '%' },
      sizeMode: 'contentHeight',
      // 🔴 §C, and this cap is also V15's whole mechanism. At 760 the six nav
      // items in `gridAutoFit` at `minWidth: 132` fit five across and folded
      // the sixth onto a second row — on every signed-in page, at every
      // viewport, including 1900 where there was 1140px of unused width beside
      // it. The band must agree with `PAGE_GROUND` or the nav and the content
      // it heads are two different columns; they are now the same 1200.
      maxWidth: { value: 1200, unit: 'px' },
      alignX: 'center',
      flexDirection: 'column',
      rowGap: 'var(--space-4)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['topRow', 'nav']
  },
  {
    id: 'topRow',
    type: 'Group',
    label: 'Who this is, and the way out',
    parent: 'inner',
    parameters: {
      width: { value: 100, unit: '%' },
      sizeMode: 'contentHeight',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // 🔴 Measured at 390px: without this the association name wraps to two
      // lines and runs under the Sign out button. `space-between` puts air
      // between them only while there IS air.
      columnGap: 'var(--space-4)',
      // 🔴 REL-002b. Closed until the server says there IS a session. Measured
      // with no backend bound: this row painted `Sign out` beside a blank
      // association name on all six protected screens, to a person who had
      // never signed in and could not have. A `Sign out` button is a claim
      // about the reader, and the band was making it before it had asked.
      mounted: false
    },
    children: ['identity', 'signOutButton']
  },
  {
    id: 'identity',
    type: 'Group',
    label: 'Whose members’ area this is',
    parent: 'topRow',
    parameters: { flexDirection: 'column', rowGap: 'var(--space-1)' },
    children: ['eyebrow', 'name']
  },
  {
    id: 'eyebrow',
    type: 'Text',
    label: 'Members’ area',
    parent: 'identity',
    parameters: { text: 'Members’ area', ...T_EYEBROW }
  },
  {
    id: 'name',
    type: 'Text',
    label: 'The association',
    parent: 'identity',
    // Rule 3: a standing empty text, so nothing renders the word "Text" while
    // the record is on its way.
    parameters: { text: '', ...T_CARD_TITLE }
  },
  {
    id: 'signOutButton',
    type: 'net.noodl.controls.button',
    label: 'Sign out',
    parent: 'topRow',
    parameters: btn('Sign out')
  },
  {
    id: 'nav',
    // 🔴 A `Columns`, for the reason `Pages/Members`' three moderator actions
    // are one: no `Group` in the runtime has a breakpoint, and five items in a
    // row is an overflow at 390px — the exact regression measured on three
    // buttons last session, with "Who belongs" reduced to one visible letter.
    //
    // ⚠️ `minWidth` overridden from the composition's 280px, which is sized for
    // CARDS. 132 fits all five across the 760px band on a desktop and folds to
    // two columns at 390px. A tokenised `minWidth` would disable `autoFit`
    // entirely (`Columns.tsx`), so it stays a literal `px` pair.
    type: COLUMNS_NODE,
    label: 'Where the band can take you',
    parent: 'inner',
    // REL-002b — same reason as `topRow`: navigation into the members' area is
    // furniture only a person who has one should be offered.
    parameters: { ...composition('gridAutoFit'), minWidth: { value: 132, unit: 'px' }, mounted: false },
    children: BAND_NAV.map((item) => item.id)
  },
  ...BAND_NAV.map((item) => ({
    id: item.id,
    type: 'net.noodl.controls.button',
    label: item.label,
    parent: 'nav',
    // ⚠️ `navBtn`, never `btn` — see its own note. `Post` would otherwise be
    // matched against `PRIMARY_LABELS` and filled on every page in the app.
    parameters: item.moderatorOnly ? { ...navBtn(item.label), mounted: false } : navBtn(item.label)
  })),
  ...BAND_NAV.map((item) => ({
    id: item.nav,
    type: 'RouterNavigate',
    label: `To ${item.label.toLowerCase()}`,
    parameters: { router: ROUTER, target: item.target }
  })),
  {
    id: 'association',
    type: 'DbCollection2',
    label: 'The association',
    parameters: { collectionName: COLLECTION_ASSOCIATION }
  },
  {
    id: 'read',
    type: 'JavaScriptFunction',
    label: 'Its name, once there is one',
    parameters: {
      functionScript:
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = Inputs.rows || [];\n' +
        "Outputs.name = rows.length > 0 ? (rows[0].name || '') : '';"
    }
  },
  // 🔴 **The one place this app asks the server who the person is.** Since s13
  // it is the ONLY `Members/Standing` on any signed-in screen: the band asks
  // once, from its own `Group`'s `didMount`, and publishes the answer through
  // `outputs` below for whatever page placed it.
  //
  // ⚠️ **It has to live here rather than on the page, and that is the whole
  // reason the band is the asker.** Three of the moderator's doors hang in this
  // component, so something in it must gate them — and **two of the seven pages
  // carrying the band have no standing gate at all**: `Pages/Announcement` and
  // `Pages/Meeting` gate on the record read instead, deliberately. Sourcing the
  // band's answer from the page would have given a moderator their navigation on
  // five screens and silently removed it on the two they reach by clicking a row.
  //
  // ✅ **D29, closed s13 and measured rather than reasoned.** It used to be one
  // of two: the five pages that owned a `Members/Standing` asked as well, so
  // every signed-in page load made two `myStanding` calls. The drive counts the
  // requests the browser actually made (§10 there) — 2 on those five before, 1
  // after, 0 on the landing page throughout as the control — and §2 to §9 are
  // what say the gates did not move while the wires did.
  { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
  /**
   * 🔴 **The band re-publishes the answer it already has, and every gated screen
   * in the app now reads it from here.**
   *
   * Added in s11 for the two detail pages — `Pages/Announcement` and
   * `Pages/Meeting` have no `Members/Standing` of their own, so their
   * moderator-only "Remove this" needed a source for `isModerator` and the
   * alternative was a third `myStanding` per detail page. **s13 finished the
   * job (D29):** the five pages that owned a standing gate dropped it and read
   * these ports instead, which is one call per page load rather than two.
   *
   * ⚠️ **The wires it replaced are the ones AC2, AC3 and AC4 rest on**, which is
   * why this half waited for a session that could run the drive. The gate that
   * grades it — `tpl001Template.test.ts` §"the members-only queries have no
   * trigger but the standing check" — does not accept any port on a chrome
   * instance: it first proves, from this component's own graph, which of these
   * ports the standing gate above actually drives. A band that forwarded
   * something else would not satisfy it.
   */
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Who the band knows this person to be',
    // 🔴 **Exactly the seven the pages read, and no eighth.** `Members/Standing`
    // also publishes `standing` (the raw string) and nothing on any page
    // consumes it — a port added here "for completeness" would be a dimension
    // that will never be read, which is the thing the door refuses elsewhere by
    // name (`inert-dimension`). The five values drive `mounted`; the three
    // signals trigger the queries. Rule 4 is why that split has to survive the
    // move: a signal into a value port arrives once as `false`.
    ports: [
      { name: 'isMember', type: 'boolean', plug: 'input' },
      { name: 'isModerator', type: 'boolean', plug: 'input' },
      { name: 'isPending', type: 'boolean', plug: 'input' },
      { name: 'isUnknown', type: 'boolean', plug: 'input' },
      { name: 'Member', type: 'signal', plug: 'input' },
      { name: 'Moderator', type: 'signal', plug: 'input' },
      { name: 'Visitor', type: 'signal', plug: 'input' },
      // REL-002b. `Denied` is what the six protected pages navigate on; it is
      // read by every one of them, so it is not the inert dimension the note
      // above refuses. `isSignedIn` stays inside the band — the pages have no
      // use for it, so it is NOT forwarded here.
      { name: 'Denied', type: 'signal', plug: 'input' }
    ]
  },
  { id: 'logout', type: 'net.noodl.user.LogOut', label: 'Log out' },
  {
    id: 'toLanding',
    type: 'RouterNavigate',
    label: 'Back to the public page',
    parameters: { router: ROUTER, target: '/Pages/Landing' }
  }
];

export const CHROME_WIRES = [
  { fromId: 'association', fromProperty: 'items', toId: 'read', toProperty: 'in-rows' },
  { fromId: 'association', fromProperty: 'fetched', toId: 'read', toProperty: 'run' },
  { fromId: 'read', fromProperty: 'out-name', toId: 'name', toProperty: 'text' },
  // 🔴 `login`, on the Log Out node, is not a typo — `logout.ts:67`: the port
  // name is persisted in every project that ever wired it, and renaming it would
  // break them. It is displayed as "Do".
  { fromId: 'signOutButton', fromProperty: 'onClick', toId: 'logout', toProperty: 'login' },
  { fromId: 'logout', fromProperty: 'done', toId: 'toLanding', toProperty: 'navigate' },
  // ⚠️ A `Group` carries `didMount` — it is one of the shared outputs every
  // visual node gets (`react-component-node.ts`) — so the band has a mount of
  // its own to ask from and does not need the page to hand it one.
  { fromId: 'bar', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
  ...BAND_NAV.map((item) => ({
    fromId: item.id,
    fromProperty: 'onClick',
    toId: item.nav,
    toProperty: 'navigate'
  })),
  // Rule 4 does not bite here: `isModerator` is a VALUE port on the standing
  // component, not a signal, so it may drive `mounted` directly.
  ...BAND_NAV.filter((item) => item.moderatorOnly).map((item) => ({
    fromId: 'standing',
    fromProperty: 'isModerator',
    toId: item.id,
    toProperty: 'mounted'
  })),
  // 🔴 REL-002b — the band's own two gates. `isSignedIn` is consumed HERE and
  // handed to nobody: it answers "is there a session", which is the band's
  // question, while the pages ask "may this person read", which is `isMember`.
  { fromId: 'standing', fromProperty: 'isSignedIn', toId: 'topRow', toProperty: 'mounted' },
  { fromId: 'standing', fromProperty: 'isSignedIn', toId: 'nav', toProperty: 'mounted' },
  // The same value the three moderator-only nav items are gated on, handed up
  // to whichever page placed the band. See `outputs` for why it is here and not
  // a third call on the two pages that want it.
  ...['isMember', 'isModerator', 'isPending', 'isUnknown', 'Member', 'Moderator', 'Visitor', 'Denied'].map((port) => ({
    fromId: 'standing',
    fromProperty: port,
    toId: 'outputs',
    toProperty: port
  }))
];

// ── The set, in an order the door will accept ────────────────────────────────

/** The four repeater rows and the standing gate: components, not pages. */
export const TPL001_PARTS: Tpl001Component[] = [
  { path: 'Members/Standing', nodes: STANDING_NODES, connections: STANDING_WIRES },
  {
    path: 'Members/AnnouncementRow',
    nodes: ANNOUNCEMENT_ROW_NODES,
    connections: ANNOUNCEMENT_ROW_WIRES,
    // `Pages/Announcement` does not exist yet, and cannot: the page places this
    // row, so one of the two has to be written into a project without the other.
    deferred: ['goDetail']
  },
  { path: 'Members/MeetingRow', nodes: MEETING_ROW_NODES, connections: MEETING_ROW_WIRES, deferred: ['goDetail'] },
  { path: 'Members/RequestRow', nodes: REQUEST_ROW_NODES, connections: REQUEST_ROW_WIRES },
  { path: 'Members/MemberRow', nodes: MEMBER_ROW_NODES, connections: MEMBER_ROW_WIRES },
  // Placed directly by `Pages/Landing` rather than by a `For Each`, so it is
  // here for the same reason the rows are: the page that places it is written
  // later, and a component must exist before something instantiates it.
  { path: 'Members/InsideTile', nodes: INSIDE_TILE_NODES, connections: INSIDE_TILE_WIRES },
  // 🔴 **After `Members/InsideTile` and before any page**, and the ordering is
  // the door's rule rather than a preference: this band INSTANTIATES the tile
  // three times, so the tile must exist first, and the four public pages
  // instantiate this, so it must exist before them. One component deeper than
  // anything else in the template, and the only place the order is transitive.
  { path: 'Members/InsideBand', nodes: INSIDE_BAND_NODES, connections: [] },
  // Placed by `/sign-in`, `/join` and `/setup`. Its click leaves through a
  // `Component Outputs` rather than a navigator, so it names no page and needs
  // no deferred pass — see `PROMPT_NODES`.
  { path: 'Members/Prompt', nodes: PROMPT_NODES, connections: PROMPT_WIRES },
  // REL-002c item 4. Placed by all thirteen pages, so it is authored before any
  // of them — a page naming a component that does not exist yet is refused at
  // the door, which is the same rule the rows above are ordered by.
  { path: 'Members/Footer', nodes: FOOTER_NODES, connections: [] },
  // The band across every signed-in page. `Pages/Landing` does not place it —
  // it has a hero carrying the same identity, and a stranger has nothing to
  // sign out of.
  {
    path: 'Members/Chrome',
    nodes: CHROME_NODES,
    connections: CHROME_WIRES,
    // Every destination in the band is a page authored after it, so all five
    // navigators wait for the deferred pass. `toLanding` always did.
    deferred: ['toLanding', ...BAND_NAV.map((item) => item.nav)]
  }
];

/**
 * Author-order matters and is stated here rather than at the call site.
 *
 * 1. **Landing** — the first page written wins `startPage` (SB-006 F17), and a
 *    members' area must open on what the association does, not on a password box.
 * 2. Everything else, with the deferred pass closing the cycles once every page
 *    exists.
 */
// ── 14. Pages/Account — TPL-002's one box ────────────────────────────────────

/**
 * TPL-002 §4. **One tick box, defaulting to off**, and the two sentences a person
 * needs before they tick it.
 *
 * 🔴 **The box is drawn from `myNotifySetting`, not from a query.** `Member` is
 * `find: role:admin` — a member cannot read their own row, deliberately, because
 * the row carries an email address and widening the collection so one person
 * could read one row would let them read every row. TPL-001's own finding then
 * applies unchanged: *a REFUSED query publishes `[]` exactly as an EMPTY one
 * does*, so a box drawn off a query would render unticked for a member whose
 * setting was on.
 *
 * ⚠️ **`checked` in and `Changed` out are deliberately asymmetric**, and the
 * asymmetry is what makes this page not loop: `checked` set from the graph
 * *"does not fire Changed"*, so loading the current setting into the box cannot
 * trigger a save of the value that was just loaded.
 */
const ACCOUNT: Tpl001Component = {
  path: 'Pages/Account',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Your account',
      parameters: { title: 'Your account', urlPath: 'account' },
      children: ['pageShell']
    },
    ...pageShell({ chrome: true }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      // 🔴 `PAGE_GROUND` + `AT_FORM_MEASURE` on the panel and the three notices —
      // the same ruling as `Pages/Post`. See `AT_FORM_MEASURE`.
      parameters: PAGE_GROUND,
      children: ['panel', 'savedOn', 'savedOff', 'failed']
    },
    ...pageHead('heading', 'Heading', 'headBandShell', 'Your account', 'Emails', { icon: 'mail' }),
    {
      id: 'panel',
      type: 'Group',
      label: 'The setting',
      parent: 'ground',
      // 🔴 Mounted only for a member. A pending person has no `Member` row and
      // no setting to change, and `mounted` leaves the subtree out of the
      // document entirely rather than hiding it — the s8 finding, unchanged.
      parameters: { ...PANEL, ...AT_FORM_MEASURE, mounted: false },
      children: ['box', 'note']
    },
    {
      id: 'box',
      type: 'net.noodl.controls.checkbox',
      label: 'Email me',
      parent: 'panel',
      /**
       * 🔴 **The words are the checkbox's OWN label, not a `Text` node beside
       * it, and a drive is what settled that.** `useLabel` defaults **false**
       * (`node-shared-port-definitions.ts:1440`), and with it off `Checkbox.tsx`
       * emits no `<label for>` at all — so a sentence drawn as a sibling `Text`
       * is not a click target, and the only way to opt in is to hit the box
       * itself. That box is 24×24: exactly WCAG 2.2 SC 2.5.8's floor and no more,
       * on a page whose whole product is one decision, read on a phone. Turning
       * the port on makes the sentence part of the control, which is both the
       * accessible behaviour and the one every person already expects.
       *
       * 🔴 `checked: false` is the shipped default and it is the legal one.
       * TPL-002 §4: consent in the UK and EU is opt-in, and a template that
       * shipped opt-out would teach every association that installed it to break
       * the law on its first day.
       *
       * ⚠️ No `sizeMode`: the door refused it — `net.noodl.controls.checkbox`
       * declares `width`/`height` and no size mode at all, and an unread
       * parameter is exactly what `unknown-parameter` is for.
       *
       * ⚠️ `labelSpacing` is a literal `px` pair where the rest of this template
       * spends tokens, for `minWidth`'s reason: the port is declared
       * `number` with `units: ['px']`, and a `var()` in it is not read. 12px is
       * `--space-3`, which is what the row it replaces used.
       */
      parameters: {
        checked: false,
        width: { value: 24, unit: 'px' },
        height: { value: 24, unit: 'px' },
        useLabel: true,
        label: NOTIFY_OPT_IN_LABEL,
        labelSpacing: { value: 12, unit: 'px' },
        labelfontSize: T_BODY.fontSize,
        labelcolor: T_BODY.color
      }
    },
    {
      id: 'note',
      type: 'Text',
      label: 'The two things to know first',
      parent: 'panel',
      parameters: { text: NOTIFY_OPT_IN_NOTE, ...T_META }
    },
    ...notice('savedOn', 'Saved, on', 'ground', NOTIFY_SAVED_ON_TEXT, { tone: 'accent', atFormMeasure: true }),
    ...notice('savedOff', 'Saved, off', 'ground', NOTIFY_SAVED_OFF_TEXT, { tone: 'accent', atFormMeasure: true }),
    ...notice('failed', 'Could not save', 'ground', NOTIFY_SAVE_FAILED_TEXT, {
      tone: 'refused',
      atFormMeasure: true
    }),
    { id: 'read', type: 'CloudFunction2', label: FN_MY_NOTIFY, parameters: { function: FN_MY_NOTIFY } },
    { id: 'write', type: 'CloudFunction2', label: FN_SET_NOTIFY, parameters: { function: FN_SET_NOTIFY } },
    {
      id: 'which',
      type: 'JavaScriptFunction',
      label: 'Which confirmation to show',
      ports: [
        { name: 'out-on', plug: 'output', type: 'signal' },
        { name: 'out-off', plug: 'output', type: 'signal' }
      ],
      parameters: {
        // 🔴 `runOnChange` off: the answer arrives as a value and the endpoint's
        // `done` is what says it is settled. On, this fires on the value alone
        // and confirms a save the server has not reported yet.
        'runOnChange-in-notify': false,
        functionScript:
          '// The one sentence is chosen by what was SAVED, not by what was\n' +
          '// clicked: an untick that the server refused must not draw "saved".\n' +
          'if (Inputs.notify === undefined) return;\n' +
          'if (Inputs.notify === true) {\n' +
          '  Outputs.on();\n' +
          '  return;\n' +
          '}\n' +
          'Outputs.off();'
      }
    },
    { id: 'onGate', type: 'Condition', label: 'Show "on"', parameters: { ...CONDITION_GATE } },
    { id: 'offGate', type: 'Condition', label: 'Show "off"', parameters: { ...CONDITION_GATE } },
    { id: 'failGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } },
    /**
     * 🔴 **Nothing ever put a confirmation away again, and a drive found it.**
     * A `Condition` only ever pushes its `result` true, so a person who ticked
     * the box and then unticked it was shown BOTH sentences at once — *"We will
     * email you when something is posted"* directly above *"We will not email
     * you about new announcements"* — with no way to tell which one had won.
     * Each of the three notices on this page is a different answer to one
     * question, so showing one has to mean hiding the other two.
     *
     * ⚠️ The shape is `Pages/Setup`'s `missingClear` and `Pages/Post`'s
     * `confirmClear`: a constant `false` fired by the path that should undo it,
     * on the same `mounted` input as the gate that set it. Two connections into
     * one input is what the runtime already does there — the later signal wins —
     * and it is why this needs no new node type.
     */
    { id: 'onClear', type: 'Condition', label: 'Put "on" away', parameters: { condition: false, 'runOnChange-condition': false } },
    { id: 'offClear', type: 'Condition', label: 'Put "off" away', parameters: { condition: false, 'runOnChange-condition': false } },
    { id: 'failClear', type: 'Condition', label: 'Put the refusal away', parameters: { condition: false, 'runOnChange-condition': false } },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    // 🔴 The read is fired by `Member`, not by `didMount`: the band's standing
    // gate is the one signal that means "this person is allowed to be here", and
    // firing on mount would ask the endpoint on behalf of a visitor.
    { fromId: 'chrome', fromProperty: 'Member', toId: 'read', toProperty: 'call' },
    { fromId: 'chrome', fromProperty: 'isMember', toId: 'panel', toProperty: 'mounted' },
    { fromId: 'chrome', fromProperty: 'Denied', toId: 'toLanding', toProperty: 'navigate' },

    // Loading the box. `checked` does not fire `Changed`, so this cannot loop.
    { fromId: 'read', fromProperty: 'out-notify', toId: 'box', toProperty: 'checked' },

    // The person ticks it. The box publishes the value and the signal, so the
    // endpoint cannot be called with the previous state still in flight.
    { fromId: 'box', fromProperty: 'checked', toId: 'write', toProperty: 'in-wanted' },
    { fromId: 'box', fromProperty: 'onChange', toId: 'write', toProperty: 'call' },

    { fromId: 'write', fromProperty: 'out-notify', toId: 'which', toProperty: 'in-notify' },
    { fromId: 'write', fromProperty: 'done', toId: 'which', toProperty: 'run' },
    { fromId: 'which', fromProperty: 'out-on', toId: 'onGate', toProperty: 'eval' },
    { fromId: 'onGate', fromProperty: 'result', toId: 'savedOn', toProperty: 'mounted' },
    { fromId: 'which', fromProperty: 'out-off', toId: 'offGate', toProperty: 'eval' },
    { fromId: 'offGate', fromProperty: 'result', toId: 'savedOff', toProperty: 'mounted' },

    { fromId: 'write', fromProperty: 'failure', toId: 'failGate', toProperty: 'eval' },
    // 🔴 A read that failed reaches the same sentence. The box is then showing
    // `false` because nothing loaded it, which is not the person's setting — so
    // the screen must not be silent about it.
    { fromId: 'read', fromProperty: 'failure', toId: 'failGate', toProperty: 'eval' },
    { fromId: 'failGate', fromProperty: 'result', toId: 'failed', toProperty: 'mounted' },

    // ── One answer on the screen at a time ────────────────────────────────
    //
    // Each path puts the other two away. `out-on` and `out-off` are the two
    // outcomes of one save, and a failure means neither of them happened.
    { fromId: 'which', fromProperty: 'out-on', toId: 'offClear', toProperty: 'eval' },
    { fromId: 'offClear', fromProperty: 'result', toId: 'savedOff', toProperty: 'mounted' },
    { fromId: 'which', fromProperty: 'out-off', toId: 'onClear', toProperty: 'eval' },
    { fromId: 'onClear', fromProperty: 'result', toId: 'savedOn', toProperty: 'mounted' },

    // A save that worked takes the refusal down — otherwise a person who failed
    // once and succeeded on the retry keeps being told it did not save.
    { fromId: 'write', fromProperty: 'done', toId: 'failClear', toProperty: 'eval' },
    { fromId: 'failClear', fromProperty: 'result', toId: 'failed', toProperty: 'mounted' },

    // And a refusal takes both confirmations down: "saved" beside "could not be
    // saved" is the same contradiction the other way round.
    { fromId: 'write', fromProperty: 'failure', toId: 'onClear', toProperty: 'eval' },
    { fromId: 'write', fromProperty: 'failure', toId: 'offClear', toProperty: 'eval' },
    { fromId: 'read', fromProperty: 'failure', toId: 'onClear', toProperty: 'eval' },
    { fromId: 'read', fromProperty: 'failure', toId: 'offClear', toProperty: 'eval' }
  ]
};

// ── 15. Pages/Unsubscribe — the one members-area page with no session ────────

/**
 * TPL-002 AC4. **Signed out, from the email, without asking anyone.**
 *
 * 🔴 **It carries no band.** `Members/Chrome` calls `myStanding` and draws
 * navigation for a member; this page is opened by somebody who is not signed in,
 * on a phone, from a mail client, and its whole job is one sentence. A band here
 * would be an auth round trip on a page whose entire point is not needing one.
 *
 * 🔴 **The token arrives as a QUERY parameter, not a path segment.** A path
 * segment would put an opaque credential in a route that the router registers
 * and that a person might share; a query string is what every unsubscribe link
 * on the internet uses, and `PageInputs.queryParams` reads it.
 */
const UNSUBSCRIBE_PAGE: Tpl001Component = {
  path: 'Pages/Unsubscribe',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Unsubscribe',
      parameters: { title: 'Email settings', urlPath: 'unsubscribe' },
      children: ['pageShell']
    },
    // 🔴 **`ground-shore`, and it is the one band in this template that is
    // deliberately NOT a photograph of people.** `pageHead`'s own note argued
    // this page needs no decoration at all; the render is what overturned that —
    // it was the emptiest page in the template, a red refusal box over ~530px of
    // bare white. But the register matters as much as the fix: somebody reaches
    // this page from a link in an email, often on their way OUT. A warm picture
    // of people enjoying each other's company over a button that turns emails
    // off would be the template arguing with the reader.
    //
    // ✅ **A `ground-*` file, and the module says why that is the right KIND.**
    // The starter imagery manifest records that `ground-*` and `texture-*` are
    // cropped as **16:9 band grounds** while everything else is a 4:3 tile — so
    // this is the one band on the template whose picture is already the shape it
    // is being asked to be, rather than a third of a tile.
    ...pageShell({ band: 'ground-shore.webp' }),
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'pageBody',
      parameters: FORM_GROUND,
      children: ['done', 'failed']
    },
    ...pageHead('heading', 'Heading', 'heroShell', 'Members’ area', 'Emails', { onScrim: true }),
    ...notice('done', 'Turned off', 'ground', UNSUBSCRIBED_TEXT, { tone: 'accent' }),
    ...notice('failed', 'That link did not work', 'ground', UNSUBSCRIBE_FAILED_TEXT, { tone: 'refused' }),
    // ⚠️ **REL-002c s12 tried to give this page a way out and a gate refused
    // it, correctly.** The reasoning was this row's own hazard 3 — after the band
    // went on, ~290px of void remained at 1280, and a layout complaint in this
    // row has four times had a content answer. The content answer here looked
    // obvious: both notices tell the reader to use their account and the page
    // offered no route to one.
    //
    // 🔴 **It is ruled against.** Richard's D39, 2026-08-29: the page names no
    // association and offers no way back. `tpl001Template.test.ts` §5 reads that
    // place, and its own note predicted this session exactly — *"a link back is
    // free… the cheap half is the one somebody adds without thinking about the
    // ruling at all."* A `net.noodl.controls.button` and a `RouterNavigate` were
    // added and removed again; the remaining slack below the notice is a
    // CONSEQUENCE OF THE RULING, not an unfixed defect, and reversing it is
    // Richard's call rather than a later session's.
    { id: 'pageInputs', type: 'PageInputs', label: 'The token', parameters: { queryParams: UNSUBSCRIBE_PARAM } },
    {
      id: 'hold',
      type: 'JavaScriptFunction',
      label: 'Hold the token until the router has set it',
      ports: [
        { name: 'out-ready', plug: 'output', type: 'signal' },
        { name: 'out-missing', plug: 'output', type: 'signal' }
      ],
      parameters: {
        // The token and the call leave from one node — rule 2 — and the page's
        // mount is the one signal guaranteed to come after the Router has set
        // the parameters.
        functionScript:
          `const token = Inputs.${UNSUBSCRIBE_PARAM} === undefined || Inputs.${UNSUBSCRIBE_PARAM} === null\n` +
          `  ? '' : String(Inputs.${UNSUBSCRIBE_PARAM}).trim();\n` +
          '// A link with no token at all never reaches the endpoint: the refusal\n' +
          '// is the same one either way, and not calling is one fewer public\n' +
          '// request from a URL somebody mistyped.\n' +
          'if (token.length === 0) {\n' +
          '  Outputs.missing();\n' +
          '  return;\n' +
          '}\n' +
          'Outputs.token = token;\n' +
          'Outputs.ready();'
      }
    },
    { id: 'call', type: 'CloudFunction2', label: FN_UNSUBSCRIBE, parameters: { function: FN_UNSUBSCRIBE } },
    { id: 'doneGate', type: 'Condition', label: 'Show the confirmation', parameters: { ...CONDITION_GATE } },
    { id: 'failGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } }
  ],
  connections: [
    { fromId: 'pageInputs', fromProperty: `pm-${UNSUBSCRIBE_PARAM}`, toId: 'hold', toProperty: `in-${UNSUBSCRIBE_PARAM}` },
    { fromId: 'page', fromProperty: 'didMount', toId: 'hold', toProperty: 'run' },
    { fromId: 'hold', fromProperty: 'out-token', toId: 'call', toProperty: `in-${UNSUBSCRIBE_PARAM}` },
    { fromId: 'hold', fromProperty: 'out-ready', toId: 'call', toProperty: 'call' },

    { fromId: 'call', fromProperty: 'done', toId: 'doneGate', toProperty: 'eval' },
    { fromId: 'doneGate', fromProperty: 'result', toId: 'done', toProperty: 'mounted' },

    { fromId: 'call', fromProperty: 'failure', toId: 'failGate', toProperty: 'eval' },
    { fromId: 'hold', fromProperty: 'out-missing', toId: 'failGate', toProperty: 'eval' },
    // D27: a throw in the hold is a refusal a person can see, not a blank page.
    { fromId: 'hold', fromProperty: 'failure', toId: 'failGate', toProperty: 'eval' },
    { fromId: 'failGate', fromProperty: 'result', toId: 'failed', toProperty: 'mounted' }
  ]
};

export const TPL001_PAGES: Tpl001Component[] = [
  LANDING,
  SIGN_IN,
  MEMBERS,
  ANNOUNCEMENT,
  MEETINGS,
  MEETING,
  JOIN,
  SETUP,
  POST,
  REQUESTS,
  DIRECTORY,
  // TPL-002. Both are written LAST, and that is load-bearing: SB-006 F17 says
  // the first page written becomes the router's `startPage`, and neither of
  // these is the screen a stranger should land on.
  ACCOUNT,
  UNSUBSCRIBE_PAGE
];

/**
 * Every browser component, in author order: the parts a page places, then the
 * pages.
 *
 * 🔴 **The rows come first because `For Each.template` IS checked at the door**
 * (`repeater-template-unresolved`, blocking, with the available names listed).
 * None of them is a page, so none of them can take `startPage` from the landing
 * page by being written earlier.
 */
export const TPL001_COMPONENTS: Tpl001Component[] = [...TPL001_PARTS, ...TPL001_PAGES];

/**
 * The create-pass payload for a component: the same nodes, minus the wires that
 * name something not yet authored.
 */
export function createPass(component: Tpl001Component): { nodes: unknown[]; connections: unknown[] } {
  if (!component.deferred?.length) return { nodes: component.nodes, connections: component.connections };
  const deferred = new Set(component.deferred);
  return {
    nodes: component.nodes.filter((n) => !deferred.has((n as { id: string }).id)),
    connections: component.connections.filter(
      (c) => !deferred.has((c as { fromId: string }).fromId) && !deferred.has((c as { toId: string }).toId)
    )
  };
}
