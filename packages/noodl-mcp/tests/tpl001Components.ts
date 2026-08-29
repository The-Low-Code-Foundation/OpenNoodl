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
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_ASSOCIATION,
  COLLECTION_MEETING,
  COLLECTION_MEMBER,
  COLLECTION_REQUEST,
  FN_CLAIM,
  FN_DECIDE,
  FN_MY_STANDING,
  FN_REQUEST_ACCESS,
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

import { composition } from './tpl001Theme';

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
export const INSIDE_TILE_COMPONENT = '/Members/InsideTile';

/** The repeater templates, named once so a page and its row cannot drift apart. */
export const ANNOUNCEMENT_ROW = '/Members/AnnouncementRow';
export const MEETING_ROW = '/Members/MeetingRow';
export const REQUEST_ROW = '/Members/RequestRow';
export const MEMBER_ROW = '/Members/MemberRow';

/** Page path parameters, spelled once for the `urlPath` and the `PageInputs`. */
const ANNOUNCEMENT_PARAM = 'announcementId';
const MEETING_PARAM = 'meetingId';

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

/** The type ramp. One `H_HERO` in the whole app, on the landing page. */
const H_HERO = { ...composition('displayHeadline'), fontSize: 'var(--text-5xl)' };
const H_PAGE = composition('sectionHeading');
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
  'Approve'
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

function withoutInertBorderWidth(params: Record<string, unknown>): Record<string, unknown> {
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

function btn(label: string): Record<string, unknown> {
  return {
    label,
    ...withoutInertBorderWidth(composition(PRIMARY_LABELS.has(label) ? 'primaryButton' : 'outlineButton'))
  };
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
  opts: { tone?: 'neutral' | 'accent' | 'refused'; gated?: boolean } = {}
): unknown[] {
  const tone = opts.tone ?? 'neutral';
  const box: Record<string, unknown> = { ...(tone === 'accent' ? NOTICE_ACCENT : NOTICE) };
  if (opts.gated !== false) box.mounted = false;
  const words = tone === 'accent' ? T_NOTICE_ACCENT : tone === 'refused' ? T_REFUSED : T_NOTICE;
  return [
    { id, type: 'Group', label, parent, parameters: box, children: [`${id}Text`] },
    { id: `${id}Text`, type: 'Text', label: `${label} \u2014 the words`, parent: id, parameters: { text, ...words } }
  ];
}

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
 * ⚠️ 760px rather than the composition's 1200px, deliberately. This is a
 * noticeboard of prose and short lists, not a marketing site with a grid; 1200
 * would put a two-word heading on one line and leave the rest of the row empty.
 */
const PAGE_GROUND = {
  ...composition('shell'),
  sizeMode: 'explicit',
  height: { value: 100, unit: '%' },
  maxWidth: { value: 760, unit: 'px' },
  alignX: 'center',
  rowGap: 'var(--space-5)',
  paddingTop: 'var(--space-12)',
  paddingBottom: 'var(--space-12)'
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
      { name: 'out-visitor', plug: 'output', type: 'signal' }
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
        'if (moderator) Outputs.moderator();\n' +
        'if (member) Outputs.member();\n' +
        `if (s === '${STANDING_VISITOR}') Outputs.visitor();`
    }
  },
  {
    id: 'failed',
    type: 'JavaScriptFunction',
    label: 'The roles could not be read',
    parameters: {
      // 🔴 Not `pending`, and not `member`. Reporting a failed roles read as
      // "you are not a member" tells a member something false about themselves;
      // reporting it as membership would load content for someone whose
      // standing is unproven. `unknown` says what happened, shows nothing, and
      // leaves the server-side refusal as the boundary it always was.
      functionScript: `Outputs.standing = '${STANDING_UNKNOWN}';\nOutputs.isUnknown = true;`
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
      { name: 'Member', type: 'signal', plug: 'input' },
      { name: 'Moderator', type: 'signal', plug: 'input' },
      { name: 'Visitor', type: 'signal', plug: 'input' }
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

  // ⚠️ Two producers on two ports, and they are mutually exclusive by
  // construction: a `CloudFunction2` call answers `done` or `failure`, never
  // both. The failure branch publishes only what it knows.
  { fromId: 'failed', fromProperty: 'out-standing', toId: 'outputs', toProperty: 'standing' },
  { fromId: 'failed', fromProperty: 'out-isUnknown', toId: 'outputs', toProperty: 'isUnknown' }
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: { ...PAGE_GROUND, alignX: 'center' },
      children: ['hero', 'actions', 'inside', 'setupCard']
    },
    {
      id: 'hero',
      type: 'Group',
      label: 'The hero',
      parent: 'ground',
      parameters: HERO_HEAD,
      children: ['eyebrow', 'heading', 'blurb']
    },
    {
      id: 'eyebrow',
      type: 'Text',
      label: 'Members’ area',
      parent: 'hero',
      // A literal, unlike its two siblings — see T_EYEBROW on why.
      parameters: { text: 'Members’ area', ...T_EYEBROW }
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Association name',
      parent: 'hero',
      // Rule 3: a standing empty text, so nothing renders the word "Text" while
      // the record is on its way.
      parameters: { text: '', ...H_HERO }
    },
    { id: 'blurb', type: 'Text', label: 'What we do', parent: 'hero', parameters: { text: '', ...T_LEAD } },
    {
      id: 'actions',
      type: 'Group',
      label: 'Ways in',
      parent: 'ground',
      // ⚠️ Deliberately no surface: two buttons under a hero are the hero's, and
      // boxing them would put a card between the headline and the way in.
      parameters: { flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)' },
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
      parameters: btn('Ask to join')
    },

    // ── What is behind the door ──────────────────────────────────────────────
    //
    // 🔴 **Gated on `hasAssociation`, the same signal as the two buttons.** On a
    // fresh install this section would otherwise sit above the "nobody has set
    // this up yet" card promising a diary and a directory to a person whose
    // first job is to create the association — an app describing itself in the
    // present tense before it exists.
    //
    // ⚠️ **The three sentences are literals on purpose, and they are claims this
    // template can keep**: `Pages/Members`, `Pages/Meetings` and
    // `Pages/Directory` are all shipped, so nothing here describes a screen that
    // is not in the artefact. `tpl001Template.test.ts` pins the page list, which
    // is what stops this becoming a promise a later edit quietly breaks.
    {
      id: 'inside',
      type: 'Group',
      label: 'What members can see',
      parent: 'ground',
      // No fill: it holds tiles, and a card holding cards has no visible edge.
      // The padding is the other half of the grouping fix described on
      // `HERO_HEAD` — it is what puts the buttons with the hero.
      parameters: { ...SECTION, paddingTop: 'var(--space-12)', mounted: false },
      children: ['insideHeading', 'insideList']
    },
    {
      id: 'insideHeading',
      type: 'Text',
      label: 'What members can see — heading',
      parent: 'inside',
      // `cardTitle` rather than `sectionHeading`: this sits under a --text-5xl
      // hero, and a --text-3xl second heading competes with it.
      parameters: { text: 'What members can see', ...H_SECTION }
    },
    {
      id: 'insideList',
      type: 'Group',
      label: 'The three tiles',
      parent: 'inside',
      // Stacked, not a row. `gridAutoFit` and `columnsTwoUp` are the vocabulary's
      // answer to this and both live on `Columns`, a node type this template does
      // not use anywhere — and a Group row cannot collapse, so three tiles side
      // by side at 390px would be three slivers.
      parameters: laidOut('column', { width: { value: 100, unit: '%' } }, 'var(--space-3)'),
      children: ['tileNews', 'tileDiary', 'tilePeople']
    },
    {
      id: 'tileNews',
      type: INSIDE_TILE_COMPONENT,
      label: 'Announcements',
      parent: 'insideList',
      parameters: { title: 'Announcements', line: 'What the moderators have posted, newest first.' }
    },
    {
      id: 'tileDiary',
      type: INSIDE_TILE_COMPONENT,
      label: 'The diary',
      parent: 'insideList',
      parameters: { title: 'The diary', line: 'Meetings and events, with the details and where to go.' }
    },
    {
      id: 'tilePeople',
      type: INSIDE_TILE_COMPONENT,
      label: 'The directory',
      parent: 'insideList',
      parameters: { title: 'The directory', line: 'Who else is a member.' }
    },

    {
      id: 'setupCard',
      type: 'Group',
      label: 'Nobody has set this up yet',
      parent: 'ground',
      // 🔴 AC6's other half. A template ships graphs, not rows, so the very
      // first person to open the installed app sees an association with no name
      // — and this is the screen that tells them what to do about it rather
      // than a blank page that looks broken.
      parameters: {
        ...laidOut('column', PANEL, 'var(--space-4)'),
        backgroundColor: 'var(--accent)',
        alignItems: 'flex-start',
        mounted: false
      },
      children: ['setupText', 'setupButton']
    },
    {
      id: 'setupText',
      type: 'Text',
      label: 'Setup notice',
      parent: 'setupCard',
      parameters: { text: 'This members’ area has not been set up yet.', ...T_NOTICE_ACCENT }
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
          "Outputs.blurb = row ? (row.blurb || '') : '';\n" +
          'Outputs.hasAssociation = rows.length > 0;\n' +
          'Outputs.needsSetup = rows.length === 0;'
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
    { fromId: 'read', fromProperty: 'out-blurb', toId: 'blurb', toProperty: 'text' },
    { fromId: 'read', fromProperty: 'out-needsSetup', toId: 'setupCard', toProperty: 'mounted' },
    // The two ways in are hidden until there is something to be a member of.
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'actions', toProperty: 'mounted' },
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'inside', toProperty: 'mounted' },

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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: { ...PAGE_GROUND, alignX: 'center' },
      children: ['heading', 'form', 'error', 'joinHint', 'joinButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Members sign in', ...H_PAGE }
    },
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
    {
      id: 'joinHint',
      type: 'Text',
      label: 'Not a member yet',
      parent: 'ground',
      parameters: { text: 'Not a member yet?', ...T_META }
    },
    {
      id: 'joinButton',
      type: 'net.noodl.controls.button',
      label: 'Ask to join',
      parent: 'ground',
      parameters: btn('Ask to join')
    },
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
    { fromId: 'joinButton', fromProperty: 'onClick', toId: 'toJoin', toProperty: 'navigate' }
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
    parameters: { ...ROW_CARD },
    children: ['rowTitle', 'rowDate', 'readButton']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'row',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  { id: 'rowDate', type: 'Text', label: 'Posted', parent: 'row', parameters: { text: '', ...T_META } },
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
      { name: 'postedAt', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'when',
    type: 'JavaScriptFunction',
    label: 'The date, as a person writes it',
    parameters: {
      // ⚠️ `toLocaleDateString` with no locale argument: the reader's own, which
      // for an association's noticeboard is the only sensible answer and the one
      // a hard-coded format would get wrong for every association but one.
      functionScript:
        "if (Inputs.postedAt === undefined) return;\n" +
        "const raw = Inputs.postedAt || '';\n" +
        'const at = new Date(raw);\n' +
        "Outputs.label = isNaN(at.getTime()) ? '' : at.toLocaleDateString();"
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
    parameters: { ...ROW_CARD },
    children: ['rowTitle', 'rowWhen', 'rowPlace', 'detailButton']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'row',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  { id: 'rowWhen', type: 'Text', label: 'When', parent: 'row', parameters: { text: '', ...T_META } },
  { id: 'rowPlace', type: 'Text', label: 'Where', parent: 'row', parameters: { text: '', ...T_META } },
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
        'if (Inputs.when === undefined) return;\n' +
        "const raw = Inputs.when || '';\n" +
        'const at = new Date(raw);\n' +
        'Outputs.label = isNaN(at.getTime()) ? raw : at.toLocaleDateString();'
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
  { fromId: 'whenLabel', fromProperty: 'out-label', toId: 'rowWhen', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'place', toId: 'rowPlace', toProperty: 'text' },
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
    parameters: { flexDirection: 'row', alignItems: 'center' },
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
    parameters: { ...ROW_CARD },
    children: ['rowName', 'rowEmail', 'rowStanding']
  },
  {
    id: 'rowName',
    type: 'Text',
    label: 'Who',
    parent: 'row',
    parameters: { text: '', ...T_CARD_TITLE }
  },
  { id: 'rowEmail', type: 'Text', label: 'Where to reach them', parent: 'row', parameters: { text: '', ...T_META } },
  { id: 'rowStanding', type: 'Text', label: 'What they are here', parent: 'row', parameters: { text: '', ...T_META } },
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
        "const joined = Inputs.joinedAt === undefined || Inputs.joinedAt === null ? '' : String(Inputs.joinedAt);\n" +
        '// The column is a full ISO timestamp; the day is what a person wants.\n' +
        "const day = joined.length >= 10 ? joined.slice(0, 10) : '';\n" +
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['heading', 'pendingNotice', 'unknownNotice', 'memberArea', 'moderatorTools', 'signOutButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Members', ...H_PAGE }
    },
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
      children: ['listHeading', 'list', 'emptyState', 'meetingsButton']
    },
    {
      id: 'listHeading',
      type: 'Text',
      label: 'Announcements',
      parent: 'memberArea',
      parameters: { text: 'Announcements', ...H_SECTION }
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
      id: 'meetingsButton',
      type: 'net.noodl.controls.button',
      label: 'What is coming up',
      parent: 'memberArea',
      parameters: btn('What’s coming up')
    },
    {
      id: 'moderatorTools',
      type: 'Group',
      label: 'What only a moderator sees',
      parent: 'ground',
      // 🔴 AC4's first half. The second half — the write being refused at the
      // server — is `Announcement.create: role:admin` in the policy, and it is
      // the half that counts: UI-only enforcement fails that criterion.
      // A panel rather than three buttons loose on the page. It holds no cards,
      // so it can carry a surface without swallowing anything.
      parameters: { ...laidOut('row', PANEL, 'var(--space-3)'), alignItems: 'center', mounted: false },
      children: ['postButton', 'requestsButton', 'directoryButton']
    },
    {
      id: 'postButton',
      type: 'net.noodl.controls.button',
      label: 'Post something',
      parent: 'moderatorTools',
      parameters: btn('Post something')
    },
    {
      id: 'requestsButton',
      type: 'net.noodl.controls.button',
      label: 'Requests to join',
      parent: 'moderatorTools',
      parameters: btn('Requests to join')
    },
    {
      id: 'directoryButton',
      type: 'net.noodl.controls.button',
      label: 'Who belongs',
      parent: 'moderatorTools',
      // ⚠️ Not "Members": this page is already called Members, and a button on
      // it leading to another screen with the same name is the kind of label
      // that only makes sense to whoever built it.
      parameters: btn('Who belongs')
    },
    {
      id: 'signOutButton',
      type: 'net.noodl.controls.button',
      label: 'Sign out',
      parent: 'ground',
      parameters: btn('Sign out')
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
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
    { id: 'logout', type: 'net.noodl.user.LogOut', label: 'Log out' },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Back to the landing page',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    },
    {
      id: 'toMeetings',
      type: 'RouterNavigate',
      label: 'To the diary',
      parameters: { router: ROUTER, target: '/Pages/Meetings' }
    },
    {
      id: 'toPost',
      type: 'RouterNavigate',
      label: 'To the posting form',
      parameters: { router: ROUTER, target: '/Pages/Post' }
    },
    {
      id: 'toRequests',
      type: 'RouterNavigate',
      label: 'To the queue',
      parameters: { router: ROUTER, target: '/Pages/Requests' }
    },
    {
      id: 'toDirectory',
      type: 'RouterNavigate',
      label: 'To the member list',
      parameters: { router: ROUTER, target: '/Pages/Directory' }
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'moderatorTools', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isUnknown', toId: 'unknownNotice', toProperty: 'mounted' },
    // 🔴 The only trigger the query has.
    { fromId: 'standing', fromProperty: 'Member', toId: 'announcements', toProperty: 'storageFetch' },
    // A visitor is sent back to the front door rather than left on a page with
    // nothing on it. The refusal is the server's; this is the courtesy.
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'announcements', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'announcements', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'announcements', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    { fromId: 'meetingsButton', fromProperty: 'onClick', toId: 'toMeetings', toProperty: 'navigate' },
    { fromId: 'postButton', fromProperty: 'onClick', toId: 'toPost', toProperty: 'navigate' },
    { fromId: 'requestsButton', fromProperty: 'onClick', toId: 'toRequests', toProperty: 'navigate' },
    { fromId: 'directoryButton', fromProperty: 'onClick', toId: 'toDirectory', toProperty: 'navigate' },

    // 🔴 `login`, on the Log Out node, is not a typo. `logout.ts:67` states why:
    // *"Named `login` rather than `logout`: the port name is persisted in every
    // project that uses this node, so it cannot be corrected without breaking
    // them."* It is displayed as "Do". The door refuses `logout` and suggests
    // this, which is how it was found.
    { fromId: 'signOutButton', fromProperty: 'onClick', toId: 'logout', toProperty: 'login' },
    { fromId: 'logout', fromProperty: 'done', toId: 'toLanding', toProperty: 'navigate' }
  ],
  deferred: ['toMeetings', 'toPost', 'toRequests', 'toDirectory']
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['title', 'date', 'body', 'refusal', 'backButton']
    },
    { id: 'title', type: 'Text', label: 'Title', parent: 'ground', parameters: { text: '', ...H_PAGE } },
    { id: 'date', type: 'Text', label: 'Posted', parent: 'ground', parameters: { text: '', ...T_META } },
    { id: 'body', type: 'Text', label: 'Body', parent: 'ground', parameters: { text: '', ...T_BODY } },
    ...notice('refusal', 'Not available', 'ground', 'This announcement is not available to you.', {
      tone: 'refused'
    }),
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to announcements')
    },
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
          'if (Inputs.postedAt === undefined) return;\n' +
          "const at = new Date(Inputs.postedAt || '');\n" +
          "Outputs.label = isNaN(at.getTime()) ? '' : at.toLocaleDateString();"
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
    {
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Back to the members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    }
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

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['heading', 'pendingNotice', 'memberArea', 'backButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'What’s coming up', ...H_PAGE }
    },
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
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to the members area')
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
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
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Back to the members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'Member', toId: 'today', toProperty: 'run' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'today', fromProperty: 'out-day', toId: 'meetings', toProperty: 'qp-today' },
    { fromId: 'meetings', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'meetings', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'meetings', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
  ]
};

// ── 8. Pages/Meeting — one meeting, in full ──────────────────────────────────

const MEETING: Tpl001Component = {
  path: 'Pages/Meeting',
  nodes: [
    {
      id: 'page',
      type: 'Page',
      label: 'Meeting',
      parameters: { title: 'Meeting', urlPath: `meetings/{${MEETING_PARAM}}` },
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['title', 'when', 'place', 'details', 'refusal', 'backButton']
    },
    { id: 'title', type: 'Text', label: 'Title', parent: 'ground', parameters: { text: '', ...H_PAGE } },
    { id: 'when', type: 'Text', label: 'When', parent: 'ground', parameters: { text: '', ...T_META } },
    { id: 'place', type: 'Text', label: 'Where', parent: 'ground', parameters: { text: '', ...T_META } },
    { id: 'details', type: 'Text', label: 'Details', parent: 'ground', parameters: { text: '', ...T_BODY } },
    ...notice('refusal', 'Not available', 'ground', 'This meeting is not available to you.', {
      tone: 'refused'
    }),
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to the diary')
    },
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
      label: 'The date, as a person writes it',
      parameters: {
        functionScript:
          'if (Inputs.when === undefined) return;\n' +
          "const raw = Inputs.when || '';\n" +
          'const at = new Date(raw);\n' +
          'Outputs.label = isNaN(at.getTime()) ? raw : at.toLocaleDateString();'
      }
    },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { ...CONDITION_GATE } },
    {
      id: 'toMeetings',
      type: 'RouterNavigate',
      label: 'Back to the diary',
      parameters: { router: ROUTER, target: '/Pages/Meetings' }
    }
  ],
  connections: [
    { fromId: 'pageInputs', fromProperty: `pm-${MEETING_PARAM}`, toId: 'hold', toProperty: `in-${MEETING_PARAM}` },
    { fromId: 'page', fromProperty: 'didMount', toId: 'hold', toProperty: 'run' },
    { fromId: 'hold', fromProperty: `out-${MEETING_PARAM}`, toId: 'record', toProperty: 'modelId' },
    { fromId: 'hold', fromProperty: 'out-ready', toId: 'record', toProperty: 'fetch' },

    { fromId: 'record', fromProperty: 'prop-title', toId: 'title', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-place', toId: 'place', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-details', toId: 'details', toProperty: 'text' },
    { fromId: 'record', fromProperty: 'prop-when', toId: 'whenLabel', toProperty: 'in-when' },
    { fromId: 'whenLabel', fromProperty: 'out-label', toId: 'when', toProperty: 'text' },

    { fromId: 'record', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'mounted' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMeetings', toProperty: 'navigate' }
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: { ...PAGE_GROUND, alignX: 'center' },
      children: ['heading', 'form', 'sent', 'refusal', 'hint', 'signInButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Ask to join', ...H_PAGE }
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
    { id: 'hint', type: 'Text', label: 'Already a member', parent: 'ground', parameters: { text: ALREADY_A_MEMBER_HINT, ...T_META } },
    {
      id: 'signInButton',
      type: 'net.noodl.controls.button',
      label: 'Sign in',
      parent: 'ground',
      parameters: btn('Sign in')
    },
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

    { fromId: 'signInButton', fromProperty: 'onClick', toId: 'toSignIn', toProperty: 'navigate' }
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: { ...PAGE_GROUND, alignX: 'center' },
      children: ['heading', 'blurb', 'form', 'refusal', 'missing']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Set up this members’ area', ...H_PAGE }
    },
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
      children: ['nameField', 'aboutField', 'emailField', 'passwordField', 'tokenField', 'claimButton']
    },
    {
      id: 'nameField',
      type: 'net.noodl.controls.textinput',
      label: 'Association name',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'Association name' }
    },
    {
      id: 'aboutField',
      type: 'net.noodl.controls.textinput',
      label: 'About the association',
      parent: 'form',
      parameters: { ...FIELD, useLabel: true, label: 'About the association', type: 'textArea' }
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
       * ⚠️ `blurb` is absent on purpose: `preq-blurb` is `false`, so it is the
       * one optional field and demanding it would refuse a form the server
       * accepts.
       */
      ports: [
        { name: 'out-ready', plug: 'output', type: 'signal' },
        { name: 'out-blocked', plug: 'output', type: 'signal' }
      ],
      parameters: {
        // 🔴 `Run` is ADDITIVE, so without these the check would also fire on
        // every keystroke and scold a person for a box they have not reached yet.
        'runOnChange-in-associationName': false,
        'runOnChange-in-email': false,
        'runOnChange-in-password': false,
        'runOnChange-in-setupToken': false,
        functionScript:
          'const blank = [];\n' +
          "if (!(Inputs.associationName || '').trim()) blank.push('the association’s name');\n" +
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
    { fromId: 'aboutField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-blurb' },
    { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-email' },
    { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-password' },
    { fromId: 'tokenField', fromProperty: 'onTextChanged', toId: 'claim', toProperty: 'in-setupToken' },
    // 🔴 The button no longer calls the endpoint directly — it asks the check,
    // and the check calls the endpoint. A form that reaches the server to be
    // told "those details" when a box is empty is a round trip spent to say
    // less than the page already knew.
    { fromId: 'claimButton', fromProperty: 'onClick', toId: 'check', toProperty: 'run' },
    { fromId: 'nameField', fromProperty: 'onTextChanged', toId: 'check', toProperty: 'in-associationName' },
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['heading', 'notAllowed', 'tools', 'backButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Post something', ...H_PAGE }
    },
    ...notice('notAllowed', 'Not a moderator', 'ground', 'Only a moderator can post here.', {
      tone: 'refused'
    }),
    {
      id: 'tools',
      type: 'Group',
      label: 'The two forms',
      parent: 'ground',
      // A SECTION: it holds the two form panels, and a panel inside a panel has
      // no edge. This is also the node D7/D16 hang on — it is what leaves the
      // document entirely when the reader is not a moderator.
      parameters: { ...laidOut('column', SECTION, 'var(--space-6)'), mounted: false },
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
      // hand over. The label says the format because the query depends on it.
      parameters: { ...FIELD, useLabel: true, label: 'Date (YYYY-MM-DD)' }
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
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to the members area')
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
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
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Back to the members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'tools', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'aTitle', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-title' },
    { fromId: 'aBody', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-body' },
    { fromId: 'aButton', fromProperty: 'onClick', toId: 'stampAnnouncement', toProperty: 'run' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-postedAt', toId: 'createAnnouncement', toProperty: 'prop-postedAt' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-go', toId: 'createAnnouncement', toProperty: 'store' },
    { fromId: 'createAnnouncement', fromProperty: 'done', toId: 'aDoneGate', toProperty: 'eval' },
    { fromId: 'aDoneGate', fromProperty: 'result', toId: 'aDone', toProperty: 'mounted' },

    { fromId: 'mTitle', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-title' },
    { fromId: 'mWhen', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-when' },
    { fromId: 'mPlace', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-place' },
    { fromId: 'mDetails', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-details' },
    { fromId: 'mButton', fromProperty: 'onClick', toId: 'createMeeting', toProperty: 'store' },
    { fromId: 'createMeeting', fromProperty: 'done', toId: 'mDoneGate', toProperty: 'eval' },
    { fromId: 'mDoneGate', fromProperty: 'result', toId: 'mDone', toProperty: 'mounted' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
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
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['heading', 'notAllowed', 'queue', 'backButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Requests to join', ...H_PAGE }
    },
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
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to the members area')
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
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
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Back to the members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'queue', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'Moderator', toId: 'requests', toProperty: 'storageFetch' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'requests', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'requests', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'requests', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    // 🔴 `itemOutputSignal-Changed`, not `Changed`: `For Each` republishes an
    // item component's signal outputs under that prefix (`foreach.tsx:1030-1037`).
    // SB-018 (1) is five sessions of a wire that named the port the author
    // wanted, spelled the way the row spells it, doing nothing.
    { fromId: 'list', fromProperty: 'itemOutputSignal-Changed', toId: 'requests', toProperty: 'storageFetch' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
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
      parameters: { title: 'Members', urlPath: 'directory' },
      children: ['ground']
    },
    {
      id: 'ground',
      type: 'Group',
      label: 'Page ground',
      parent: 'page',
      parameters: PAGE_GROUND,
      children: ['heading', 'notAllowed', 'directory', 'backButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Members', ...H_PAGE }
    },
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
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: btn('Back to the members area')
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
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
      id: 'toMembers',
      type: 'RouterNavigate',
      label: 'Back to the members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    },
    {
      id: 'toLanding',
      type: 'RouterNavigate',
      label: 'Out of the members area',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'directory', toProperty: 'mounted' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'mounted' },
    // 🔴 The only trigger the query has, and it is `Moderator` rather than
    // `Member`: this list is under the moderator's tools in §3.
    { fromId: 'standing', fromProperty: 'Moderator', toId: 'members', toProperty: 'storageFetch' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'members', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'members', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'members', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'mounted' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
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
    parameters: { ...TILE },
    children: ['tileTitle', 'tileLine']
  },
  { id: 'tileTitle', type: 'Text', label: 'What it is', parent: 'tile', parameters: { text: '', ...T_CARD_TITLE } },
  { id: 'tileLine', type: 'Text', label: 'What it holds', parent: 'tile', parameters: { text: '', ...T_NOTICE } },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The tile',
    ports: [
      { name: 'title', type: 'string', plug: 'output' },
      { name: 'line', type: 'string', plug: 'output' }
    ]
  }
];

export const INSIDE_TILE_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'tileTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'line', toId: 'tileLine', toProperty: 'text' }
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
  { path: 'Members/InsideTile', nodes: INSIDE_TILE_NODES, connections: INSIDE_TILE_WIRES }
];

/**
 * Author-order matters and is stated here rather than at the call site.
 *
 * 1. **Landing** — the first page written wins `startPage` (SB-006 F17), and a
 *    members' area must open on what the association does, not on a password box.
 * 2. Everything else, with the deferred pass closing the cycles once every page
 *    exists.
 */
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
  DIRECTORY
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
