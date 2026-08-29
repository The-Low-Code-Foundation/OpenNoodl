/**
 * SB-005's six browser components — the admin panel — as the arguments the MCP
 * door is given.
 *
 * Data, not a suite, for the same reason `sb004Components.ts` is: SB-008's drive
 * has to boot **this** panel rather than a hand-written twin of it, and a second
 * copy becomes a twin on the first edit that reaches only one of them.
 *
 * The draft-ACL constant is imported from SB-004 rather than restated. That is
 * the point of acceptance 2: the panel must write the *same* rule the cloud
 * worker writes, and two spellings of "admin only" that drift apart is exactly
 * the failure the criterion is guarding against.
 *
 * ── What crosses the runtime boundary, and what does not ─────────────────────
 *
 * `BACKEND_DOCTRINE_MD` §"Five things a deployed graph does not do the way the
 * canvas does" is about the *cloud* runtime. SB-005 §2 tabled which of its four
 * rules apply here; three measurements taken while building this file sharpen
 * that table, and each one changed a graph below.
 *
 * 🔴 **Rule 1 (declare a code node's signal outputs) applies to every
 * `JavaScriptFunction` here, deployed or not.** The derivation is in a `setup()`
 * that returns unless `context.editorConnection.isRunningLocally()`, and a
 * deployed browser bundle has no editor connection either. Every `Outputs.x()`
 * below therefore carries `{ name: 'out-x', plug: 'output', type: 'signal' }`.
 *
 * ✅ **Rule 2 (a signal is not a promise that the values arrived) does NOT bite
 * `CloudFunction2` or `Query Records`, because both defer their own work.**
 * `scheduleCall` (`cloudfunction2.ts:225-236`) and `scheduleFetch`
 * (`dbcollectionnode2.ts:816-826`) each hand the actual request to
 * `scheduleAfterInputsHaveUpdated`, and `Node.update` runs those callbacks
 * *after* the inner loop has drained one queued value from every input name
 * (`node.ts:626-656`). So a `Call` and its `in-*` values arriving in one pass
 * produce a call that has them. F11 bit SB-004 because the *producer* — a
 * Request node — emitted `receive` and `pm-pageId` in two different passes of
 * its own, so the signal reached the query in a pass where the value did not
 * exist yet. That is a hazard about where a wire comes from, not about signals
 * in general, and it is why nothing below drives a consumer's trigger and its
 * value from two different producers.
 *
 * 🔴 **Rule 3's shape does NOT transfer whole, and the reason is a measurement.**
 * SB-004 pinned a filtered query as `runOnChange-*: false` **and no `Do` wire`*,
 * the second half being what left "the filter value arriving" as the only
 * trigger. A cloud function runs once; a panel has to refresh after a write, and
 * the obvious trick — re-emit the same id from the holding node — **cannot
 * work**: `simplejavascript.ts:162` publishes an output only when the value
 * *changes* (`if (value !== this._internal.outputValues[prop])`), so writing the
 * same `pageId` again flags nothing and schedules no fetch. A refresh therefore
 * has to be a `storageFetch` wire. It is safe here, and the safety is a property
 * of *where it comes from*: every one below is a record write's `done`, which
 * cannot fire until the user has acted on a page whose `qp-pageId` landed long
 * before. What survives from rule 3 unchanged is the half that actually caused
 * F12 — `runOnChange-collectionName: false` and `runOnChange-querySettings:
 * false`, which is what stops the load-time UNFILTERED fetch that no wire can
 * be early enough to narrow.
 *
 * ⚠️ Rule 4 (`points to` widens instead of failing) is still **unmeasured** in
 * the browser. `Section.pageId` is a String, so nothing here filters on a
 * Pointer and the question stays open. SB-005 §2 says do not record it answered.
 *
 * ── Two panel-specific rules the invariant needs ─────────────────────────────
 *
 * 🔴 **1. `Create Record` for `Page` and `Section` carries the admin rule.** An
 * absent ACL reads as public (`model.ts:701-718`), so a draft born without it is
 * world-readable from the instant `Page.find` goes public.
 *
 * 🔴 **2. `Update Record` for `Page` and `Section` carries NO access rules — and
 * that is load-bearing, not an omission.** `_getACL` returns `undefined` when a
 * node has no rules (`dbmodelcrudbase.ts:945`), the adapter puts that on the
 * body as `{ ACL: undefined }`, and `JSON.stringify` drops it
 * (`ParseWireAdapter.ts:545`, `:272`) — so a save with no rules leaves the
 * stored ACL alone. Add rules to one of these nodes and the opposite happens:
 * editing the title of a **published** page would rewrite its ACL to the
 * draft-only rule, revoking the world's read while `published` stayed `true`.
 * That is the publication invariant broken in the one direction its mirror
 * cannot show, by a node whose author was only trying to save a title.
 */

import { ADMIN_ONLY_RULES } from './sb004Components';

/**
 * The three cloud functions the panel calls. `CloudFunction2` stores the target
 * **without** the `/#__cloud__/` prefix (`cloudfunction2.ts` runtimeBehavior),
 * and mints `in-<name>` / `out-<name>` from the target's Request/Response
 * `params` lists.
 */
export const FN_CLAIM = 'claimSite';
export const FN_PUBLISH = 'publishPage';
export const FN_DUPLICATE = 'duplicatePage';

/** The Router the template's `App` component hosts; `RouterNavigate.router` names it. */
export const ROUTER = 'Main';

/**
 * 🔴 **Every admin page is at least two URL segments deep, and that is a
 * requirement rather than a naming convention.** Measured in SB-006, which is
 * where it bites.
 *
 * The public site is one catch-all page component at `{slug}` — a site builder's
 * whole point is that `/about` is a record. The Router matches by splitting both
 * sides on `/` and comparing segment by segment, `{name}` matching any segment
 * (`router.tsx:747-757`), then keeps the page with the smallest
 * `|patternParts − pathParts|`, **first one winning a tie** (`:775-783`, the
 * guard is `>` and not `>=`). A one-segment admin path therefore ties with
 * `{slug}` on its own URL, and the winner is whichever the Router's `pages` list
 * names first — which is the order the components happened to be written in.
 *
 * Two segments removes the tie rather than relying on it: `{slug}` still matches
 * `/admin/pages`, but at distance 1, and distance is read before order. These
 * paths were `setup` / `admin` / `theme` / `page/{pageId}` until SB-006 measured
 * that; `sb006PublicSite.test.ts` asserts it over both panels at once by
 * re-implementing the Router's own rule.
 */
export const ADMIN_PATH_PREFIX = 'admin';

/**
 * SBR-006 §4 / SBR-004 AC1. **The admin set had none of this**, and the census
 * that found it is the reason it is here: applying `sb006PublicSite.test.ts`'s
 * own `findGrowingNodes` rule to the shipped artefact reported **eleven** growing
 * nodes across the admin screens, against two on the public site — and both of
 * those two are the named, legitimate ones. `/Admin/PageRow` alone had four: its
 * title, slug and status each defaulted to `width: 100%` along the row, and the
 * row itself defaulted to `height: 100%` along the list's column, so the rows
 * divided the page between them instead of stacking.
 *
 * The rule (`layout.ts:83-98`) is that a percentage size ALONG the parent's
 * direction becomes `flexGrow`, and every node's size on that axis defaults to
 * `100` with `defaultUnit: '%'`. So the opt-out depends on which way the parent
 * stacks, and using the wrong one is silent:
 *
 * - child of a **column** ⇒ {@link STACKED} (`contentHeight` stops assigning
 *   height, keeps assigning width, so the child still spans the column);
 * - child of a **row** ⇒ {@link IN_A_ROW} (`contentSize` assigns neither —
 *   `contentHeight` is NOT the answer here, because `assignsWidth` is true for
 *   it, `sb006PublicSite.test.ts:1680`).
 *
 * 🔴 `STACKED` is `sb006Components.ts`'s `STACKED_IN_A_COLUMN` value, held
 * separately because that module already imports `ROUTER` from this one and the
 * reverse edge would be a cycle. A second copy of a constant drifts silently, so
 * `sb006PublicSite.test.ts` asserts the two are equal rather than trusting this
 * comment.
 */
export const STACKED = { sizeMode: 'contentHeight' } as const;

/** The row-direction twin of {@link STACKED}. See there for why they differ. */
export const IN_A_ROW = { sizeMode: 'contentSize' } as const;

/**
 * The admin rail's width. A raw dimension, in the same shape and for the same
 * reason as `sb006Components.ts`'s `RAW_DIMENSION_EXEMPTIONS`: a fixed rail has
 * no token because the token vocabulary is the SITE's contract (a client themes
 * their public site, not the admin chrome they were given), and an unstated
 * width here does not mean "auto" — it means 100% along the frame's row, which
 * `Layout.size` turns into a sidebar that eats half the screen.
 *
 * 🔴 **The object form is not decoration.** The door refuses a bare `240` with
 * `unitless-dimension`: these ports are read as a PERCENTAGE when no unit is
 * given, so `width: 240` is `240%` — a rail two and a half screens wide. The
 * bare number was authored, refused, and corrected here.
 */
export const SIDEBAR_WIDTH = { value: 240, unit: 'px' } as const;

/**
 * The dialog card's width. Raw for the same reason as {@link SIDEBAR_WIDTH}: the
 * token contract is the client's SITE theme, and the admin chrome they were
 * handed is not part of it.
 */
export const DIALOG_WIDTH = { value: 420, unit: 'px' } as const;

/**
 * The admin nodes that are SUPPOSED to take the space their parent gives them —
 * an exemption list, not a relaxation, in the same shape as
 * `FILL_THE_PARENT_EXEMPTIONS` and keyed by **label** for the same reason (the
 * door reallocates ids, SB-004 F9). Adding a growing node reds the gate until
 * someone writes down why it grows.
 */
export const ADMIN_FILL_EXEMPTIONS: ReadonlyArray<{ component: string; label: string; why: string }> = [
  {
    component: 'Admin/Shell',
    label: 'Admin frame',
    why: 'the shell IS the admin page ground — it is meant to be the whole viewport'
  },
  {
    component: 'Admin/Shell',
    label: 'Admin content',
    why: 'the content column takes whatever width the fixed rail leaves, which is the point of a rail'
  },
  {
    component: 'Admin/PageRow',
    label: 'Name and slug',
    why: 'the name column takes the width the pill and the two buttons leave — the fixed cells state their size, this one absorbs the rest'
  }
];

/**
 * Growing nodes that are **defects, not exemptions** — measured, named, and owned
 * by another task. They are here rather than in {@link ADMIN_FILL_EXEMPTIONS}
 * because an exemption list that absorbs everything cannot fail, and the reason
 * column is the only thing separating "this is meant to fill" from "nobody has
 * got to this yet". The gate asserts this list EXACTLY, so fixing one of these
 * without deleting its row reds just as loudly as adding a new one.
 *
 * All four were found by running `sb006PublicSite.test.ts`'s own rule over the
 * shipped artefact for the first time: the admin screens had never been walked
 * by it, and had **eleven** growing nodes to the public site's two.
 */
export const ADMIN_LAYOUT_OWED: ReadonlyArray<{ component: string; label: string; owner: string }> = [
  // 🔴 **SBR-007 paid its three rows and they are DELETED, not ticked.** The
  // gate asserts this list exactly, so leaving a fixed row here would red just
  // as loudly as adding a new one — which is the property that makes the list
  // mean something. The three were `Admin/SectionRow | One section`,
  // `Pages/PageEditor | Editor` and `Pages/PageEditor | Add a section`; all
  // three now carry `STACKED` and the census counts 1 growing node, not 4.
  { component: 'Pages/Setup', label: 'Form', owner: 'SBR-002 — the claim screen is driven and passing; changing its size mode without re-driving it would be a blind edit to another task’s verified AC' }
];

/** One `Text` in the sidebar rail: same shape three times, so it is written once. */
function navItem(id: string, text: string) {
  return [
    {
      id,
      type: 'Text',
      label: text,
      parent: 'sidebar',
      parameters: {
        // Child of the rail's COLUMN, so `contentHeight` — and it keeps assigning
        // width, which is what makes the whole rail width the hit area.
        ...STACKED,
        text,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        // 🔴 Authored, even though `navStyle` wires both. SB-018 (3)'s rule
        // generalised: a port whose ONLY source is a wire renders the node's own
        // default until that wire first publishes, and `active` arrives as a
        // component input. Without these two the sidebar flashes the `Text`
        // default before it settles.
        color: 'var(--foreground)',
        fontWeight: 'var(--font-normal)',
        // 🔴 Margins, not padding, and the door is what settled it: `Text`
        // declares NO `paddingTop`/`paddingBottom`/`paddingLeft` and no
        // `borderRadius` — all four came back as `unknown-parameter`, "so this
        // parameter is never read". A padded pill-shaped hit area on a bare
        // `Text` is not authorable; it would need a wrapping `Group`, and the
        // current item is distinguished by colour and weight instead.
        marginTop: 'var(--space-1)',
        marginBottom: 'var(--space-1)'
      }
    }
  ];
}

/**
 * The filtered query's shape, and only the half that transfers — see the module
 * header. Both boxes off kills the load-time unfiltered fetch; the `Do` wire is
 * a separate decision made per query, at its wire.
 */
export const NO_LOAD_TIME_FETCH = {
  'runOnChange-collectionName': false,
  'runOnChange-querySettings': false
};

/**
 * "The sections of this page" — the same rule SB-004 authored, restated rather
 * than imported because the panel filters through its own `qp-pageId` port and
 * the shared constant is the cloud side's.
 *
 * `equal to` on a String, never `points to` on a Pointer: SB-004 F13.
 */
export const SECTIONS_OF_PAGE_FILTER = {
  combinator: 'and',
  rules: [{ property: 'pageId', operator: 'equal to', input: 'pageId' }]
};

// ── 1. Admin/PageRow — one row of the page list ──────────────────────────────

/**
 * The repeater item. Its interface is `Component Inputs`, and the names are not
 * arbitrary: `For Each` sets an input called `id` (or `Id`) to `model.getId()`
 * and every other declared input to the field of the same name
 * (`foreach.tsx:586-597`). An undeclared field is simply not delivered, so this
 * port list *is* what the row can see.
 *
 * 🔴 **No record-write node lives here, deliberately.** Publish and unpublish
 * are two `CloudFunction2` instances of `publishPage`, distinguished by a
 * constant `in-publish` — which works with no wire and no declared port because
 * `NodeScope.setNodeParameters` calls `registerInputIfNeeded` on the parameter
 * path too (`nodescope.ts:203`), and `cloudfunction2.ts:210-223` mints `in-*` on
 * demand. That is what keeps acceptance 3 true by construction: there is no
 * `Set Record Properties` in this component to point at `published`.
 */
export const PAGE_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One page',
    // Child of the list's COLUMN. 🔴 Without `STACKED` this row defaulted to
    // `height: 100%` along that column, so N rows divided the page between them
    // instead of stacking — one of the eleven the census found. See {@link STACKED}.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)'
    },
    children: ['titleCell', 'pill', 'editButton', 'menuButton', 'menu']
  },
  {
    id: 'titleCell',
    type: 'Group',
    label: 'Name and slug',
    parent: 'row',
    // The one node in the row that legitimately grows: the fixed things (pill,
    // buttons) state their size and the name column takes what is left.
    // `ADMIN_FILL_EXEMPTIONS` carries that sentence.
    parameters: { flexDirection: 'column' },
    children: ['rowTitle', 'rowSlug']
  },
  // 🔴 SB-018 (3). Standing `text`, for the reason spelled out on
  // `/Pages/Site`'s headings: `Text` declares `default: 'Text'`, a default
  // applies until the port is set, and a node whose only `text` is a wire
  // renders the literal word **Text** until that wire publishes.
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'titleCell',
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'rowSlug',
    type: 'Text',
    label: 'Slug',
    parent: 'titleCell',
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    // 🔴 SBR-015 AC1. The backend was taught to refuse in words; this is the
    // thing that says them. Before it, the row's three cloud calls wired `done`
    // only, so a 400 arriving in 19 ms produced — measured with a
    // `MutationObserver` over `document.body` for 47 s — **zero** text changes:
    // menu open, pill still `Draft`, nothing anywhere. The fix that made the
    // server speak did not change the person's experience at all.
    id: 'rowRefusal',
    type: 'Text',
    label: 'Why that did not work',
    parent: 'titleCell',
    parameters: {
      ...STACKED,
      // 🔴 `mounted`, never `visible`. A refusal that is absent must take no
      // space in the row — `visible: false` keeps the box (P78 D16 was exactly
      // that bug, in this template).
      mounted: false,
      // A standing value, for the reason `rowTitle` carries one: `Text`
      // declares `default: 'Text'`, so a node whose only `text` is a wire
      // renders the literal word **Text** until that wire publishes. Here it is
      // also the fallback if `error` ever arrives empty.
      text: 'That did not work.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--destructive)'
    }
  },
  {
    id: 'callState',
    type: 'States',
    label: 'Did the last call refuse?',
    // Same shape as `menuState` above, and for the same reason a `States` beats
    // a bare boolean here: it **resets**. A later call that succeeds returns the
    // row to `Quiet`, so a refusal cannot outlive the thing it was about.
    parameters: {
      states: 'Quiet,Refused',
      values: 'refused',
      'type-refused': 'boolean',
      'value-Quiet-refused': false,
      'value-Refused-refused': true
    }
  },
  {
    id: 'pill',
    type: 'Group',
    label: 'Status pill',
    parent: 'row',
    // Child of the row, so `contentSize` — `contentHeight` would still assign
    // width and the pill would eat the row.
    parameters: {
      ...IN_A_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-3)',
      paddingRight: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      marginRight: 'var(--space-4)',
      // Authored as well as wired, SB-018 (3): a draft row must not flash the
      // published colour before `status` first publishes.
      backgroundColor: 'var(--accent)'
    },
    children: ['rowStatus']
  },
  {
    id: 'rowStatus',
    type: 'Text',
    label: 'Draft or published',
    parent: 'pill',
    // Fed from `status`, below: the panel is the one reader `published` exists
    // for (SB-004 §3), and it reads the mirror rather than trying to infer the
    // ACL, which no browser query can see.
    parameters: {
      ...IN_A_ROW,
      text: 'Draft',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--muted-foreground)'
    }
  },
  { id: 'editButton', type: 'net.noodl.controls.button', label: 'Edit', parent: 'row', parameters: { label: 'Edit' } },
  {
    id: 'menuButton',
    type: 'net.noodl.controls.button',
    label: 'More actions',
    parent: 'row',
    // SBR-006 §2: publish/unpublish/duplicate move off the row and behind one
    // control, because four buttons per row IS the current design and the task
    // is to stop it being that.
    parameters: { label: 'More' }
  },
  {
    id: 'menu',
    type: 'Group',
    label: 'Row actions menu',
    parent: 'row',
    // 🔴 `mounted`, never `visible`. SBR-004's drive: `visible: false` is
    // `visibility: hidden` and HOLDS ITS SPACE — a hidden wrapper measured 365px
    // of empty page. A closed menu must take no room at all.
    parameters: {
      ...IN_A_ROW,
      mounted: false,
      flexDirection: 'column',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)'
    },
    children: ['publishButton', 'unpublishButton', 'duplicateButton']
  },
  {
    id: 'publishButton',
    type: 'net.noodl.controls.button',
    label: 'Publish',
    parent: 'menu',
    parameters: { label: 'Publish' }
  },
  {
    id: 'unpublishButton',
    type: 'net.noodl.controls.button',
    label: 'Unpublish',
    parent: 'menu',
    parameters: { label: 'Unpublish' }
  },
  {
    id: 'duplicateButton',
    type: 'net.noodl.controls.button',
    label: 'Duplicate',
    parent: 'menu',
    parameters: { label: 'Duplicate' }
  },
  {
    id: 'menuState',
    type: 'States',
    label: 'Menu open or closed',
    // `states[0]` is the start state when `startState` is unset
    // (`states.ts:243`), so the menu begins Closed without a second parameter
    // saying so. `menuOpen` is a value name and becomes an output port verbatim
    // — deliberately not one of `RESERVED_OUTPUTS` (`states.ts:119`), where a
    // value called `done` would silently resolve to the outcome contract's
    // signal and the author's output would simply not exist.
    parameters: {
      states: 'Closed,Open',
      values: 'menuOpen',
      'type-menuOpen': 'boolean',
      'value-Closed-menuOpen': false,
      'value-Open-menuOpen': true
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The page record',
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'title', type: 'string', plug: 'output' },
      { name: 'slug', type: 'string', plug: 'output' },
      { name: 'published', type: 'boolean', plug: 'output' }
    ]
  },
  {
    id: 'status',
    type: 'JavaScriptFunction',
    label: 'Draft or published, as a word and a colour',
    // Rule 1: no custom signal outputs on this node, so nothing to declare —
    // `Outputs.label` is a value and values need no port declaration.
    //
    // 🔴 `runOnChange-in-published: true` is authored for SBR-004 §9.2's reason:
    // the NDA-017 migration writes `runOnChange-<input>: false` on every value
    // input of a node whose control signal is wired, on every project load. An
    // explicit `true` survives it; an absent key does not.
    parameters: {
      'runOnChange-in-published': true,
      functionScript: [
        'const published = Inputs.published === true;',
        "Outputs.label = published ? 'Published' : 'Draft';",
        "Outputs.pillBackground = published ? 'var(--primary)' : 'var(--accent)';",
        "Outputs.pillColor = published ? 'var(--primary-foreground)' : 'var(--muted-foreground)';"
      ].join('\n')
    }
  },
  {
    id: 'publish',
    type: 'CloudFunction2',
    label: 'publishPage(publish: true)',
    // 🔴 The constant IS the parameter. See the component note: a `CloudFunction2`
    // dynamic input needs neither a wire nor a declared port, which is what makes
    // one endpoint serve two buttons.
    parameters: { function: FN_PUBLISH, 'in-publish': true }
  },
  {
    id: 'unpublish',
    type: 'CloudFunction2',
    label: 'publishPage(publish: false)',
    parameters: { function: FN_PUBLISH, 'in-publish': false }
  },
  {
    id: 'duplicate',
    type: 'CloudFunction2',
    label: 'duplicatePage',
    parameters: { function: FN_DUPLICATE }
  },
  {
    id: 'goEdit',
    type: 'RouterNavigate',
    label: 'Open the page editor',
    // `target` is a component legacyName, never an invented URL path; the page
    // parameter rides on `pm-pageId`, which `registerInputIfNeeded` resolves to
    // `setPageParam` (`router-navigate.ts:171-175`).
    parameters: { router: ROUTER, target: '/Pages/PageEditor' }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Tell the list something changed',
    // The list owns the query, so the row cannot refresh it — it says what
    // happened and the page decides. `For Each` republishes an item component's
    // Component Outputs signal as an output of its own, named
    // `itemOutputSignal-Changed` — SB-018 (1) is the five sessions this comment
    // was right and the wire below it named the port wrong.
    //
    // 🔴 §4's trap: this port name is what `/Pages/Admin`'s refresh wire is
    // derived from. Renaming `Changed` here silently orphans that wire, and
    // `the-list-refreshes-when-a-row-changes.test.ts` is the guard.
    ports: [{ name: 'Changed', type: 'signal', plug: 'input' }]
  }
];

export const PAGE_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'rowTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'slug', toId: 'rowSlug', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'published', toId: 'status', toProperty: 'in-published' },
  { fromId: 'status', fromProperty: 'out-label', toId: 'rowStatus', toProperty: 'text' },
  { fromId: 'status', fromProperty: 'out-pillBackground', toId: 'pill', toProperty: 'backgroundColor' },
  { fromId: 'status', fromProperty: 'out-pillColor', toId: 'rowStatus', toProperty: 'color' },

  { fromId: 'inputs', fromProperty: 'id', toId: 'publish', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'unpublish', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'duplicate', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'goEdit', toProperty: 'pm-pageId' },

  // The overflow menu. `toggle` moves to the next state and wraps
  // (`states.ts:288-300`), which for a two-state list is exactly "open/close".
  { fromId: 'menuButton', fromProperty: 'onClick', toId: 'menuState', toProperty: 'toggle' },
  { fromId: 'menuState', fromProperty: 'menuOpen', toId: 'menu', toProperty: 'mounted' },

  { fromId: 'publishButton', fromProperty: 'onClick', toId: 'publish', toProperty: 'call' },
  { fromId: 'unpublishButton', fromProperty: 'onClick', toId: 'unpublish', toProperty: 'call' },
  { fromId: 'duplicateButton', fromProperty: 'onClick', toId: 'duplicate', toProperty: 'call' },
  { fromId: 'editButton', fromProperty: 'onClick', toId: 'goEdit', toProperty: 'navigate' },

  // Every write the row can cause, reported once. `done` and not `completed`:
  // a refetch after a failure would redraw the same rows for no reason.
  { fromId: 'publish', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'unpublish', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'duplicate', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },

  // ...and the menu closes itself on the way out, so the row it belongs to is
  // readable again the moment the list redraws.
  { fromId: 'publish', fromProperty: 'done', toId: 'menuState', toProperty: 'to-Closed' },
  { fromId: 'unpublish', fromProperty: 'done', toId: 'menuState', toProperty: 'to-Closed' },
  { fromId: 'duplicate', fromProperty: 'done', toId: 'menuState', toProperty: 'to-Closed' },

  // 🔴 SBR-015 AC1 — the browser half of the defect SBR-015 fixed on the server.
  //
  // The three calls above wired `done` and nothing else, so every refusal was
  // discarded: the menu stayed open for as long as it was watched and no text
  // on the page changed. SBR-015's own gate could not see this, because it
  // derives its population as "a component holding a `noodl.cloud.request`" —
  // cloud endpoints — and this is a component that CALLS one. A checker's
  // population is part of the checker; the consumer of a fixed producer is the
  // first place to look next.
  //
  // ⚠️ `failure`, not `completed`: `completed` fires on every outcome, so it
  // would raise the refusal on success too.
  { fromId: 'publish', fromProperty: 'failure', toId: 'callState', toProperty: 'to-Refused' },
  { fromId: 'unpublish', fromProperty: 'failure', toId: 'callState', toProperty: 'to-Refused' },
  { fromId: 'duplicate', fromProperty: 'failure', toId: 'callState', toProperty: 'to-Refused' },

  // …and a later success clears it, so a refusal cannot outlive its subject.
  { fromId: 'publish', fromProperty: 'done', toId: 'callState', toProperty: 'to-Quiet' },
  { fromId: 'unpublish', fromProperty: 'done', toId: 'callState', toProperty: 'to-Quiet' },
  { fromId: 'duplicate', fromProperty: 'done', toId: 'callState', toProperty: 'to-Quiet' },

  { fromId: 'callState', fromProperty: 'refused', toId: 'rowRefusal', toProperty: 'mounted' },

  // 🔴 The server's own sentence, not a generic one. SBR-015 wrote these
  // deliberately and they are not interchangeable: duplicate answers *"This page
  // could not be duplicated. A partial copy may exist."* — because the copy is
  // written before the step that fails, so a message claiming nothing was made
  // would be a lie the admin can disprove by reloading. `error` carries it
  // (`cloudfunction2.ts:157`, *"Why the last call failed"*), and `rowRefusal`'s
  // own `text` parameter is the fallback if it ever arrives empty.
  { fromId: 'publish', fromProperty: 'error', toId: 'rowRefusal', toProperty: 'text' },
  { fromId: 'unpublish', fromProperty: 'error', toId: 'rowRefusal', toProperty: 'text' },
  { fromId: 'duplicate', fromProperty: 'error', toId: 'rowRefusal', toProperty: 'text' },

  // The second half of AC1's sentence — "and the menu stops being busy". It
  // stayed open on every refusal because only `done` closed it.
  { fromId: 'publish', fromProperty: 'failure', toId: 'menuState', toProperty: 'to-Closed' },
  { fromId: 'unpublish', fromProperty: 'failure', toId: 'menuState', toProperty: 'to-Closed' },
  { fromId: 'duplicate', fromProperty: 'failure', toId: 'menuState', toProperty: 'to-Closed' }
];

// ── 2. Admin/SectionRow — one section, with the image upload ─────────────────

/**
 * §3 surface 5 lives here rather than in a screen of its own: the file picker,
 * the upload and the preview are all about *one* section's `data`, and a
 * separate screen would need the section id passed to it for no gain.
 *
 * `data` is one Object column carrying the kind-specific payload (SB-004 §2), so
 * the row edits it as a whole: the body text and the uploaded image are merged
 * into it by `merge` below and written in one `prop-data`.
 *
 * 🔴 `save` and `remove` carry **no** access rules — see the module header's
 * second panel rule. A published section edited here must keep its world rule.
 */
export const SECTION_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One section',
    // 🔴 The third of SBR-007's `ADMIN_LAYOUT_OWED` rows, and the one that bit
    // hardest: `Group` defaults to `explicit`, so without `STACKED` every row
    // took `height: 100%` down the list's column and N sections DIVIDED the page
    // between them instead of stacking. That is the same defect `/Admin/PageRow`
    // carried before SBR-006 fixed it there — see {@link STACKED}.
    //
    // The card is §2's third bullet: a section has to read as a thing with an
    // edge, not as four more controls in the same scroll. The raw `8`s are gone
    // with it — spacing here is on the token scale like everything else.
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      rowGap: 'var(--space-3)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)'
    },
    children: ['kindText', 'bodyField', 'preview', 'pickButton', 'saveButton', 'deleteButton']
  },
  // SB-018 (3), same standing `text` as `/Admin/PageRow`'s two — see the note there.
  {
    id: 'kindText',
    type: 'Text',
    label: 'Kind',
    parent: 'row',
    // SB-018 (3), same standing `text` as `/Admin/PageRow`'s two — see the note
    // there. The type ramp is what makes the kind read as this card's heading.
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'bodyField',
    type: 'net.noodl.controls.textinput',
    label: 'Body',
    parent: 'row',
    parameters: { useLabel: true, label: 'Body', type: 'textArea' }
  },
  { id: 'preview', type: 'Image', label: 'Image preview', parent: 'row' },
  {
    id: 'pickButton',
    type: 'net.noodl.controls.button',
    label: 'Choose image',
    parent: 'row',
    parameters: { label: 'Choose image' }
  },
  { id: 'saveButton', type: 'net.noodl.controls.button', label: 'Save', parent: 'row', parameters: { label: 'Save' } },
  {
    id: 'deleteButton',
    type: 'net.noodl.controls.button',
    label: 'Delete',
    parent: 'row',
    parameters: { label: 'Delete' }
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
    label: 'Read the body and image out of data',
    parameters: {
      functionScript:
        'const d = Inputs.data || {};\n' +
        "Outputs.body = d.body || '';\n" +
        // A `cloudfile` renders through its `url`; an unset one must not become
        // the string "undefined" on an Image's `src`.
        "Outputs.image = (d.image && d.image.url) || '';"
    }
  },
  { id: 'picker', type: 'Open File Picker', label: 'Choose an image', parameters: { acceptedFileTypes: 'image/*' } },
  {
    id: 'upload',
    type: 'Upload File',
    label: 'Upload it',
    // ⚠️ `bucket`/`path` are Supabase-only and `collection`/`recordId`/`field`
    // are PocketBase-only (`Upload File` runtimeBehavior). This template targets
    // the built-in backend, so all five stay unset.
    parameters: {}
  },
  {
    id: 'merge',
    type: 'JavaScriptFunction',
    label: 'Fold the edits back into data',
    // Rule 1 — declared because `Outputs.built()` is otherwise dead once this
    // bundle is served without an editor attached.
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // Two producers reach this node — the record's own `data` and whatever the
      // author has changed since — so it guards, per rule 2. `body` and `image`
      // are legitimately empty strings, so the test is `undefined`.
      functionScript:
        'if (Inputs.data === undefined) return;\n' +
        'const next = Object.assign({}, Inputs.data);\n' +
        "if (Inputs.body !== undefined) next.body = Inputs.body;\n" +
        'if (Inputs.image !== undefined && Inputs.image !== null) next.image = Inputs.image;\n' +
        'Outputs.data = next;\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'save',
    type: 'SetDbModelProperties',
    label: 'Save this section',
    // 🔴 NO access rules. See the module header: adding them here would rewrite a
    // published section's ACL back to draft while `Page.published` stayed true.
    parameters: { collectionName: 'Section', idSource: 'explicit', storeProperties: 'specified' }
  },
  {
    id: 'remove',
    type: 'DeleteDbModelProperties',
    label: 'Delete this section',
    parameters: { collectionName: 'Section', idSource: 'explicit' }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Tell the editor something changed',
    ports: [{ name: 'Changed', type: 'signal', plug: 'input' }]
  }
];

export const SECTION_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'kind', toId: 'kindText', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'unpack', toProperty: 'in-data' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'bodyField', toProperty: 'startValue' },
  { fromId: 'unpack', fromProperty: 'out-image', toId: 'preview', toProperty: 'src' },

  { fromId: 'pickButton', fromProperty: 'onClick', toId: 'picker', toProperty: 'open' },
  { fromId: 'picker', fromProperty: 'file', toId: 'upload', toProperty: 'file' },
  // `done`, not `completed`: a cancelled picker must not start an upload of
  // nothing. `Upload File` defers nothing on this author's behalf, but both
  // wires leave the same node in the same pass and `file` is a value the picker
  // sets before it reports.
  { fromId: 'picker', fromProperty: 'done', toId: 'upload', toProperty: 'upload' },
  { fromId: 'upload', fromProperty: 'cloudFile', toId: 'merge', toProperty: 'in-image' },

  { fromId: 'inputs', fromProperty: 'data', toId: 'merge', toProperty: 'in-data' },
  { fromId: 'bodyField', fromProperty: 'onTextChanged', toId: 'merge', toProperty: 'in-body' },
  { fromId: 'saveButton', fromProperty: 'onClick', toId: 'merge', toProperty: 'run' },
  // An upload is a change to the section, so it folds and saves without a second
  // press — otherwise the picked image is lost the moment the row redraws.
  { fromId: 'upload', fromProperty: 'done', toId: 'merge', toProperty: 'run' },

  { fromId: 'inputs', fromProperty: 'id', toId: 'save', toProperty: 'modelId' },
  { fromId: 'merge', fromProperty: 'out-data', toId: 'save', toProperty: 'prop-data' },
  { fromId: 'merge', fromProperty: 'out-built', toId: 'save', toProperty: 'store' },

  { fromId: 'inputs', fromProperty: 'id', toId: 'remove', toProperty: 'modelId' },
  { fromId: 'deleteButton', fromProperty: 'onClick', toId: 'remove', toProperty: 'store' },

  { fromId: 'save', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'remove', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' }
];

// ── 3. Pages/Setup — the first-run claim screen ──────────────────────────────

/** The one thing a refused claim is ever allowed to say. */
export const CLAIM_REFUSAL_TEXT = 'This site cannot be claimed.';
/** And the one thing a refused signup is allowed to say — also a constant. */
export const SIGNUP_REFUSAL_TEXT = 'That account could not be created.';

/**
 * SB-004 F7's front. The owner signs up through the ordinary public signup —
 * `claimSite` never handles a password — and then calls the function with the
 * setup token.
 *
 * 🔴 **Every failure answers with a constant.** F7 made the backend's refusal
 * indistinguishable on purpose so the endpoint cannot be asked *"is this site
 * claimed yet?"*; a panel that rendered `claim.error`, or that split the refusal
 * by which signal fired, would hand that oracle straight back. So **no `error`
 * output of any node in this component is wired to anything**, and the two
 * messages below are parameters, not values. The signup message is separate
 * because a signup failure is about the caller's own credentials — something any
 * anonymous visitor can already learn by calling `signup` directly — and it says
 * nothing about the site's claim state.
 *
 * ⚠️ A `Text` whose `visible` is wired still draws before the first value
 * arrives, so both messages carry `visible: false` as a parameter as well.
 * `setNodeParameters` runs at graph build and the connection overrides it later
 * (`nodescope.ts:157-213`), so the parameter is the initial state rather than a
 * contradiction.
 */
export const SETUP_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Set up this site',
    parameters: { title: 'Set up this site', urlPath: `${ADMIN_PATH_PREFIX}/setup` },
    children: ['shell']
  },
  {
    id: 'shell',
    type: 'Group',
    label: 'Form',
    parent: 'page',
    parameters: { flexDirection: 'column', paddingTop: 24, paddingLeft: 24, paddingRight: 24 },
    children: ['heading', 'blurb', 'emailField', 'passwordField', 'tokenField', 'claimButton', 'claimRefusal', 'signupRefusal', 'toSignIn']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    // The door's `monotone-typography` check, answered: a page where nothing sets
    // a weight measures as unstyled, because it is.
    parameters: { text: 'Claim this site', fontWeight: 'var(--font-bold)' }
  },
  {
    id: 'blurb',
    type: 'Text',
    label: 'Blurb',
    parent: 'shell',
    parameters: {
      text: 'Create the owner account and enter the setup token from your backend configuration.'
    }
  },
  {
    id: 'emailField',
    type: 'net.noodl.controls.textinput',
    label: 'Email',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Email', type: 'email' }
  },
  {
    id: 'passwordField',
    type: 'net.noodl.controls.textinput',
    label: 'Password',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Password', type: 'password' }
  },
  {
    id: 'tokenField',
    type: 'net.noodl.controls.textinput',
    label: 'Setup token',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Setup token', type: 'password' }
  },
  {
    id: 'claimButton',
    type: 'net.noodl.controls.button',
    label: 'Claim',
    parent: 'shell',
    parameters: { label: 'Claim this site' }
  },
  {
    id: 'claimRefusal',
    type: 'Text',
    label: 'The one refusal',
    parent: 'shell',
    parameters: { text: CLAIM_REFUSAL_TEXT, visible: false }
  },
  {
    id: 'signupRefusal',
    type: 'Text',
    label: 'Signup refusal',
    parent: 'shell',
    parameters: { text: SIGNUP_REFUSAL_TEXT, visible: false }
  },
  { id: 'signup', type: 'net.noodl.user.SignUp', label: 'Create the owner account' },
  {
    id: 'hold',
    type: 'JavaScriptFunction',
    label: 'Hold the token until the account exists',
    // Rule 1.
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      // Rule 2's guard. The token is typed long before the account is created,
      // but an empty token must not be sent as a claim attempt — the backend
      // refuses it identically, and a request nobody meant to make is still a
      // request against the one door that mints an admin.
      functionScript:
        'if (Inputs.token === undefined || Inputs.token === null) return;\n' +
        'Outputs.token = Inputs.token;\n' +
        'Outputs.go();'
    }
  },
  { id: 'claim', type: 'CloudFunction2', label: 'claimSite', parameters: { function: FN_CLAIM } },
  {
    id: 'claimGate',
    type: 'Condition',
    label: 'Show the refusal',
    // `result` publishes the condition when `eval` fires; a constant `true`
    // parameter makes this "reveal on signal" without inventing a reason.
    parameters: { condition: true }
  },
  { id: 'signupGate', type: 'Condition', label: 'Show the signup refusal', parameters: { condition: true } },
  {
    id: 'goAdmin',
    type: 'RouterNavigate',
    label: 'Into the panel',
    parameters: { router: ROUTER, target: '/Pages/Admin' }
  },
  {
    id: 'toSignIn',
    type: 'Text',
    label: 'Already set up',
    parent: 'shell',
    // 🔴 SBR-017 §5's second trap, answered with a link rather than a guard, and
    // the reasoning is the whole scope call.
    //
    // The trap: a second signup against an already-claimed site **succeeds** —
    // 201, a real `_User` row, a session token — and `claimSite` then correctly
    // refuses it. So `/admin/setup` mints roleless accounts for anyone who finds
    // it. The obvious fix is to make Setup refuse *before* signing anyone up,
    // and it cannot be built: refusing early means asking "is this site claimed
    // yet?", which is exactly the oracle SB-004 F7 removed on purpose. There is
    // no endpoint that answers it and there must not be one.
    //
    // What is left is the half that actually helps the person: the owner who
    // lands here because it is the only screen that mentions their account now
    // has somewhere else to go, so the commonest way that second account gets
    // created stops happening. The account factory itself is a **backend**
    // setting (signup is open on this backend by default) and is recorded as
    // such rather than papered over here.
    parameters: {
      ...STACKED,
      text: 'Already set up? Sign in.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--primary)',
      marginTop: 'var(--space-4)'
    }
  },
  {
    id: 'goSignIn',
    type: 'RouterNavigate',
    label: 'To the sign-in screen',
    parameters: { router: ROUTER, target: '/Pages/SignIn' }
  }
];

export const SETUP_WIRES = [
  { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'signup', toProperty: 'email' },
  // The backend's own signup takes a username; using the address for both is
  // what makes "sign in with your email" true later.
  { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'signup', toProperty: 'username' },
  { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'signup', toProperty: 'password' },
  { fromId: 'claimButton', fromProperty: 'onClick', toId: 'signup', toProperty: 'signup' },

  { fromId: 'tokenField', fromProperty: 'onTextChanged', toId: 'hold', toProperty: 'in-token' },
  { fromId: 'signup', fromProperty: 'done', toId: 'hold', toProperty: 'run' },

  // Value and trigger from one producer, and `scheduleCall` defers the request
  // until this node's inputs have drained — see the module header on rule 2.
  { fromId: 'hold', fromProperty: 'out-token', toId: 'claim', toProperty: 'in-setupToken' },
  { fromId: 'hold', fromProperty: 'out-go', toId: 'claim', toProperty: 'call' },

  { fromId: 'claim', fromProperty: 'done', toId: 'goAdmin', toProperty: 'navigate' },

  // Both ways a claim can fail, into the one message. `claim.error` is
  // deliberately not read.
  { fromId: 'claim', fromProperty: 'failure', toId: 'claimGate', toProperty: 'eval' },
  { fromId: 'claimGate', fromProperty: 'result', toId: 'claimRefusal', toProperty: 'visible' },
  { fromId: 'signup', fromProperty: 'failure', toId: 'signupGate', toProperty: 'eval' },
  { fromId: 'signupGate', fromProperty: 'result', toId: 'signupRefusal', toProperty: 'visible' },

  // The way out for an owner who is already set up. Nothing on the claim path
  // moves — SBR-017 §5's first trap: `claimSite` is SBR-015's control.
  { fromId: 'toSignIn', fromProperty: 'onClick', toId: 'goSignIn', toProperty: 'navigate' }
];

// ── 4. Pages/Admin — the page list ───────────────────────────────────────────

/**
 * The unfiltered query, and the one surface that legitimately has one.
 *
 * 🔴 **`pages` deliberately does NOT carry `NO_LOAD_TIME_FETCH`.** SB-004's
 * correction, turned on: switching those boxes off on a query with no filter
 * parameter leaves it with no trigger at all, which is what made `claimSite`
 * read a claimed site as unclaimed. The page list wants exactly the load-time
 * fetch the filtered queries must suppress, and the pair of them is asserted
 * together for that reason.
 *
 * Draft and published pages come back together because the admin is in
 * `role:admin` and the row-level predicate lets that principal read both; the
 * rows are told apart by `published`, the mirror SB-004 §3 keeps for this reader.
 */
/**
 * What the page list says when the query came back with nothing.
 *
 * 🔴 **SBR-016 AC2.** Exported so the gate and the drive can both name it. The
 * old sentence for zero rows was "No pages, no published", which is a row count
 * rather than an answer — and before the fix above it was never rendered at all,
 * because the query never ran. Those two look identical on screen and they are
 * not the same claim: one says *we asked and there is nothing*, the other says
 * nothing whatsoever.
 */
export const EMPTY_PAGE_LIST_TEXT = 'No pages yet. Use New page to make your first one.';

/**
 * What the page list says when the query was refused.
 *
 * SBR-016 §2.2's third state. A signed-in principal who is not in `role:admin`
 * gets a refusal from the row-level predicate, and until this existed the screen
 * it produced was pixel-identical to an empty site. `--destructive` and
 * `mounted: false`, the same shape as `/Pages/SignIn`'s refusal, for the same
 * reason: a message about something that has not happened must take no space.
 */
export const PAGE_LIST_ERROR_TEXT = 'The page list could not be loaded. You may not have permission to manage this site.';

export const ADMIN_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Pages',
    parameters: { title: 'Pages', urlPath: `${ADMIN_PATH_PREFIX}/pages` },
    children: ['shell']
  },
  {
    id: 'shell',
    type: '/Admin/Shell',
    label: 'Admin shell',
    parent: 'page',
    // 🔴 AC5, and the half a shell can fail silently: `active` is what makes the
    // two placements of this component render differently. `/Pages/ThemeEditor`
    // places the same component with `active: 'theme'`.
    parameters: { active: 'pages' },
    // The screen's own body goes INSIDE the instance and arrives at the shell's
    // `Component Children` (`nodescope.ts:217`). The shell owns the chrome, this
    // component owns the page.
    children: ['body']
  },
  {
    id: 'body',
    type: 'Group',
    label: 'Pages body',
    parent: 'shell',
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['headerRow', 'countLine', 'listError', 'list']
  },
  {
    id: 'headerRow',
    type: 'Group',
    label: 'Pages header',
    parent: 'body',
    parameters: { ...STACKED, flexDirection: 'row', alignItems: 'center' },
    children: ['heading', 'newButton']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'headerRow',
    // Child of a ROW, so `contentSize` and not `contentHeight` — the latter
    // still assigns width and the heading would push the one primary action off
    // the screen. This is the distinction {@link STACKED} exists to keep straight.
    parameters: {
      ...IN_A_ROW,
      text: 'Pages',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'newButton',
    type: 'net.noodl.controls.button',
    label: 'New page',
    parent: 'headerRow',
    // ⚠️ SBR-006 §8.5 / SBR-004: at 360px this button's centre was off-screen
    // and a click landed on nothing. It now sits in a row with one heading
    // rather than after two text fields, which is what put it there.
    parameters: { label: 'New page', marginLeft: 'var(--space-6)' }
  },
  {
    id: 'countLine',
    type: 'Text',
    label: 'How many pages',
    parent: 'body',
    // §2's last bullet: derived, cheap, and it proves the query returned
    // something. Standing `text` per SB-018 (3).
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'listError',
    type: 'Text',
    label: 'The page list was refused',
    parent: 'body',
    // SBR-016 §2.2's third state, given words. `mounted: false` and not
    // `visible: false`, so an error that has not happened takes no space —
    // the rule `/Pages/SignIn`'s refusal is built on.
    parameters: {
      ...STACKED,
      mounted: false,
      text: PAGE_LIST_ERROR_TEXT,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--destructive)'
    }
  },
  {
    id: 'list',
    type: 'For Each',
    label: 'One row per page',
    parent: 'body',
    // ✅ `template` IS checked at the door — measured, not assumed:
    // `repeater-template-unresolved`, blocking, with the available names listed.
    parameters: { templateType: 'explicit', template: '/Admin/PageRow' }
  },
  {
    id: 'pages',
    type: 'DbCollection2',
    label: 'Every page, draft and published',
    parameters: {
      // 🔴 **SBR-016. The explicit `true` is the whole fix, and it is not
      // decoration.** This node wants the load-time fetch — the comment above
      // says so, and it deliberately omits {@link NO_LOAD_TIME_FETCH} to get it.
      // It did not get it. `storageFetch` is wired (twice, below), so the NDA-017
      // migration writes `runOnChange-collectionName: false` into this bag on
      // **every project load**, and `setCollectionName`
      // (`dbcollectionnode2.ts:564`) then schedules nothing. The panel's only
      // remaining triggers were a create and a row edit, so an admin who merely
      // *arrived* saw an empty list — measured on two backends, with the same
      // session reading the row over HTTP in 2 ms while the screen showed
      // nothing (SBR-016 §2, SBR-017 §6.4).
      //
      // The migration never touches a key that is already present, whatever its
      // value, so an authored `true` is how a graph written *after* NDA-017 §2
      // says "I meant the new default". Same idiom as `count` below.
      'runOnChange-collectionName': true,
      collectionName: 'Page'
    }
  },
  {
    id: 'count',
    type: 'JavaScriptFunction',
    label: 'The row-count sentence',
    // 🔴 `runOnChange-in-rows: true` authored — SBR-004 §9.2. The NDA-017
    // migration silences value inputs on any node whose control signal is wired,
    // every load; an explicit `true` survives, an absent key does not. This node
    // HAS a wired control signal (`fetched`), so it is squarely in that
    // population and the parameter is doing real work.
    parameters: {
      'runOnChange-in-rows': true,
      functionScript: [
        'const rows = Array.isArray(Inputs.rows) ? Inputs.rows : [];',
        'const published = rows.filter((r) => r && r.published === true).length;',
        "const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];",
        'const word = (n) => (n < WORDS.length ? WORDS[n] : String(n));',
        "const pages = rows.length === 1 ? 'page' : 'pages';",
        // 🔴 SBR-016 AC2. Zero is a different sentence, not the count sentence
        // with a zero in it. This line only ever runs because the query now runs
        // — `fetched` fires on a successful query whatever the row count
        // (`dbcollectionnode2.ts:895`), so an empty site says so out loud.
        'if (rows.length === 0) {',
        `  Outputs.sentence = ${JSON.stringify(EMPTY_PAGE_LIST_TEXT)};`,
        '} else {',
        "  Outputs.sentence = word(rows.length) + ' ' + pages + ', ' + word(published).toLowerCase() + ' published';",
        '}'
      ].join('\n')
    }
  },
  {
    id: 'create',
    type: 'NewDbModelProperties',
    label: 'Create a draft page',
    parameters: {
      collectionName: 'Page',
      // 🔴 Acceptance 2. Born a draft: the admin rule and nothing else, so the
      // row is unreadable to the world until `publishPage` adds the world rule.
      // An absent ACL would mean public.
      ...ADMIN_ONLY_RULES,
      // The mirror's initial value, written once at creation. Every LATER move of
      // it belongs to `publishPage` alone — see acceptance 3.
      'prop-published': false,
      'prop-showInNav': true,
      'prop-navOrder': 0
    }
  },
  {
    id: 'newPageDialog',
    type: 'NavigationShowPopup',
    label: 'Ask for a title and a slug',
    parameters: { target: '/Admin/NewPageDialog' }
  },
  {
    id: 'queryState',
    type: 'States',
    label: 'Did the last query refuse?',
    // `States`, not a `Condition`, for the reason `/Pages/SignIn`'s
    // `attemptState` is one: it **resets**. A refusal that is later succeeded by
    // a good fetch must not outlive it — otherwise the message stands beside a
    // populated list, which is a worse screen than the one this replaces.
    parameters: {
      states: 'Quiet,Refused',
      values: 'refused',
      'type-refused': 'boolean',
      'value-Quiet-refused': false,
      'value-Refused-refused': true
    }
  }
];

export const ADMIN_WIRES = [
  { fromId: 'pages', fromProperty: 'items', toId: 'list', toProperty: 'items' },

  { fromId: 'pages', fromProperty: 'items', toId: 'count', toProperty: 'in-rows' },
  { fromId: 'pages', fromProperty: 'fetched', toId: 'count', toProperty: 'run' },
  { fromId: 'count', fromProperty: 'out-sentence', toId: 'countLine', toProperty: 'text' },

  // The dialog replaces the two bare inputs. `closeResult-*` are Show Popup's
  // OUTPUTS (`showpopup.ts:342`) — the mirror of Close Popup's `result-*`
  // inputs — and they are up to date before `closeAction-create` fires
  // (`showpopup.ts:204-210`), so the store below never runs on an empty title.
  { fromId: 'newButton', fromProperty: 'onClick', toId: 'newPageDialog', toProperty: 'show' },
  { fromId: 'newPageDialog', fromProperty: 'closeResult-title', toId: 'create', toProperty: 'prop-title' },
  { fromId: 'newPageDialog', fromProperty: 'closeResult-slug', toId: 'create', toProperty: 'prop-slug' },
  { fromId: 'newPageDialog', fromProperty: 'closeAction-create', toId: 'create', toProperty: 'store' },

  // The refresh, and both of its sources are write completions. See the module
  // header: on an UNFILTERED query this is unremarkable, because there is no
  // filter for the fetch to be early for.
  { fromId: 'create', fromProperty: 'done', toId: 'pages', toProperty: 'storageFetch' },
  // 🔴 SB-018 (1), fixed s19. This wire read `Changed` for five sessions and there
  // is no such port on `For Each` in any runtime, so it was dead — and it is NOT
  // the redundant second trigger SB-018 first called it: `create.done` beside it
  // covers creation only, and publish/unpublish/duplicate happen in the ROW.
  // `For Each` republishes an item component's signal outputs under
  // `itemOutputSignal-<name>` (`foreach.tsx:1030-1037`), derived from the template
  // component's own output ports, so the port the author wanted exists — under a
  // name they did not use. Measured through the real module, not read off it.
  { fromId: 'list', fromProperty: 'itemOutputSignal-Changed', toId: 'pages', toProperty: 'storageFetch' },

  // 🔴 SBR-016 §2.2. `failure`, never `error`-as-a-trigger and never `fetched`
  // for both arms: the two outcomes drive the two states, so the refusal cannot
  // be raised by a successful query and cannot survive one either.
  { fromId: 'pages', fromProperty: 'failure', toId: 'queryState', toProperty: 'to-Refused' },
  { fromId: 'pages', fromProperty: 'fetched', toId: 'queryState', toProperty: 'to-Quiet' },
  { fromId: 'queryState', fromProperty: 'refused', toId: 'listError', toProperty: 'mounted' }

  // 🔴 The "Theme and settings" button is GONE from this screen, and that is the
  // point of SBR-006: it was reachable only from a button at the bottom of the
  // page list. It is now a permanent sidebar item in `/Admin/Shell`, on every
  // admin screen.
];

// ── 5. Pages/PageEditor — one page, and its sections ─────────────────────────

/**
 * The filtered query lives here, and this is where rule 3 half-applies.
 *
 * `pageId` arrives as a page parameter: `Page Inputs` declares it in
 * `pathParams` and registers `pm-pageId` on demand
 * (`page-inputs.ts:64-73`), the Router delivers it through `_setPageParams`
 * (`router.tsx:602-605`), and `Page.urlPath` carries it as `{pageId}` — braces,
 * not a colon (`router.tsx:614`, `:753`). All three halves are wire- or
 * parameter-driven, so none of them needs the editor-only `setup()` that F10 was
 * about.
 *
 * 🔴 `save` carries **no** access rules — the module header's second panel rule —
 * and writes **no** `prop-published`: that boolean is `publishPage`'s alone.
 */
export const PAGE_EDITOR_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Edit page',
    parameters: { title: 'Edit page', urlPath: `${ADMIN_PATH_PREFIX}/page/{pageId}` },
    children: ['shell']
  },
  {
    id: 'shell',
    type: '/Admin/Shell',
    label: 'Admin shell',
    parent: 'page',
    // 🔴 **SBR-007. This was the one admin screen that did not place the shell**,
    // and it is the screen a client spends their time in. SBR-006 moved "Theme
    // and settings" into a permanent sidebar item *"on every admin screen"* — but
    // the sidebar, that link and `Sign out` all vanished the moment the client
    // opened a page to edit it, and came back when they left. Measured over the
    // shipped artefact: of the four admin pages, this was the only one whose tree
    // contained no `/Admin/Shell`.
    //
    // `active: 'pages'` — editing a page is still the Pages section, so the rail
    // must not go dark. That parameter is also what SBR-006 AC5 grades: the third
    // placement of the shell, and the second that says `pages`.
    parameters: { active: 'pages' },
    // The screen's own body goes INSIDE the instance and arrives at the shell's
    // `Component Children`, exactly as `/Pages/Admin` does it.
    children: ['body']
  },
  {
    id: 'body',
    type: 'Group',
    label: 'Editor',
    parent: 'shell',
    // 🔴 `STACKED`, and this is one of the three `ADMIN_LAYOUT_OWED` rows SBR-007
    // owns. Without it this Group defaulted to `explicit` — `height: 100%` down
    // the shell's column — which is the same defect the page rows had. The old
    // raw `paddingTop: 24` / `paddingLeft: 24` are gone with it: the shell owns
    // the page's padding now, and a raw dimension here had no token reason.
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['headerRow', 'fieldsCard', 'sectionsPanel', 'backButton']
  },

  // ── The header row — §2's second bullet ─────────────────────────────────────
  //
  // "Editing · <title>", the publish state, whether there is anything unsaved,
  // and the two actions. Save used to sit *below five fields and above the
  // section list*, so on a page with sections it was off-screen while editing.
  {
    id: 'headerRow',
    type: 'Group',
    label: 'Editor header',
    parent: 'body',
    // 🔴 **D18 — `flexWrap` is the lever, and `layout.ts:82` is the reason.**
    // Every node starts `flexShrink: 0`; only a percentage size ALONG the
    // parent's direction opts back in to shrinking. All five children below are
    // `IN_A_ROW` (`contentSize`), which assigns a percentage on NEITHER axis —
    // so they cannot shrink, and under the default `nowrap` they overflowed and
    // were CLIPPED, not scrolled: the row's right edge measured 1001px at every
    // viewport while `#root` tracked 1440/988/600, and `scrollWidth ===
    // innerWidth` throughout, so no gesture reached `Save page` below 897px.
    //
    // 🔴 `flex-grow` is NOT the lever here either, confirming SBR-004 §8.2:
    // growing a child that already cannot shrink does nothing about overflow.
    // Wrapping moves the actions onto a second line instead, so the row stays
    // one line wherever it fits and stays REACHABLE where it does not.
    //
    // `rowGap` means nothing until wrap is on — `group.ts:478` gates the port on
    // exactly that condition — so the two are authored together, never apart.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)'
    },
    children: ['heading', 'pill', 'dirtyMark', 'previewButton', 'saveButton']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'headerRow',
    // 🔴 **D20 — a percentage width is the ONLY way to make a `Text` legible when
    // it is longer than its row**, and it takes TWO runtime branches at once:
    //
    //  - `layout.ts:82` starts every node `flexShrink: 0`; only a percentage size
    //    along the parent's direction opts back in (`flexShrink: 1` + `flexGrow`).
    //  - `Text.tsx:60` sets `whiteSpace: 'pre'` — i.e. NOWRAP — for `contentSize`
    //    and `contentWidth`, and `pre-wrap` for everything else.
    //
    // `IN_A_ROW` (`contentSize`) fails both, which is why the heading measured
    // **965px at 1920/1440/1200/1024/800/600 alike** with a 57-character title,
    // right edge pinned at 1237 and `scrollWidth === innerWidth`, so the overflow
    // was CLIPPED and no gesture reached it. D18's `flexWrap` cannot help: wrap
    // moves whole children onto a new line and does nothing to one child that is
    // itself too wide.
    //
    // 🔴 The two are INSEPARABLE in this runtime — `layout.ts` assigns `flexGrow`
    // and `flexShrink` in the SAME branch — so opting the heading into shrinking
    // necessarily opts it into growing, which is why the actions now sit right
    // rather than clustered beside the title. That is a real visual change and it
    // was not free.
    //
    // 60% and not 100%: at 100% the heading owns its line at EVERY width, so the
    // actions drop to a second row even at 1920 where they fit today. 60% keeps
    // the one-line header wherever it fits and clips nothing anywhere.
    // ⚠️ Dimension ports take `{value, unit}` — a bare `'60%'` string is accepted
    // in silence and renders at content width (P77 D8 / P76 F15's family).
    //
    // Standing `text: ''` per SB-018 (3): `Text` declares `default: 'Text'`, so a
    // node whose only source is a wire renders the literal word "Text" until the
    // record first publishes.
    parameters: {
      sizeMode: 'contentHeight',
      width: { value: 60, unit: '%' },
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'pill',
    type: 'Group',
    label: 'Status pill',
    parent: 'headerRow',
    // The same pill `/Admin/PageRow` carries, for the same reason and fed by the
    // same three-output function: §2 asks for the publish state to be visible
    // *while editing*, and the list's pill is two screens away.
    parameters: {
      ...IN_A_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-3)',
      paddingRight: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      // Authored as well as wired, SB-018 (3): a draft must not flash the
      // published colour before `status` first publishes.
      backgroundColor: 'var(--accent)'
    },
    children: ['pillText']
  },
  {
    id: 'pillText',
    type: 'Text',
    label: 'Draft or published',
    parent: 'pill',
    parameters: {
      ...IN_A_ROW,
      text: 'Draft',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'dirtyMark',
    type: 'Text',
    label: 'Unsaved changes',
    parent: 'headerRow',
    // 🔴 **Acceptance 5**, and `mounted`, never `visible` — SBR-004's drive
    // measured `visible: false` as `visibility: hidden`, which HOLDS ITS SPACE.
    // A clean form would otherwise reserve a gap where this sentence goes.
    parameters: {
      ...IN_A_ROW,
      mounted: false,
      text: 'Unsaved changes',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'previewButton',
    type: 'net.noodl.controls.button',
    label: 'Preview',
    parent: 'headerRow',
    parameters: { label: 'Preview' }
  },
  {
    id: 'saveButton',
    type: 'net.noodl.controls.button',
    label: 'Save',
    parent: 'headerRow',
    parameters: { label: 'Save page' }
  },

  // ── The fields, in a card, grouped — §2's first bullet ──────────────────────
  {
    id: 'fieldsCard',
    type: 'Group',
    label: 'Page details',
    parent: 'body',
    // The card is what makes this screen stop being "everything left aligned in
    // one column" — `backgroundColor` and `borderRadius` are two of
    // `templateAppearance`'s `STRUCTURE_PARAMS`, and this page was the LAST bare
    // page in the template when that census was run at HEAD.
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      rowGap: 'var(--space-4)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['nameRow', 'seoField', 'navRow']
  },
  {
    id: 'nameRow',
    type: 'Group',
    label: 'Title and slug',
    parent: 'fieldsCard',
    // Two-up. ⚠️ The two `textinput`s need no size mode of their own: only
    // `Group`, `Text` and `Image` carry a `DEFAULT_SIZE_MODE` in
    // `findGrowingNodes`, so a control is not graded and does not need an
    // exemption row to sit in a row.
    parameters: { ...STACKED, flexDirection: 'row', columnGap: 'var(--space-4)' },
    children: ['titleField', 'slugField']
  },
  {
    id: 'titleField',
    type: 'net.noodl.controls.textinput',
    label: 'Title',
    parent: 'nameRow',
    parameters: { useLabel: true, label: 'Title' }
  },
  {
    id: 'slugField',
    type: 'net.noodl.controls.textinput',
    label: 'Slug',
    parent: 'nameRow',
    parameters: { useLabel: true, label: 'Slug' }
  },
  {
    id: 'seoField',
    type: 'net.noodl.controls.textinput',
    label: 'SEO description',
    parent: 'fieldsCard',
    parameters: { useLabel: true, label: 'Search description', type: 'textArea' }
  },
  {
    id: 'navRow',
    type: 'Group',
    label: 'Navigation',
    parent: 'fieldsCard',
    // §2: nav order and show-in-navigation are one decision and belong together.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-4)'
    },
    children: ['navOrderField', 'showInNavBox']
  },
  {
    id: 'navOrderField',
    type: 'net.noodl.controls.textinput',
    label: 'Nav order',
    parent: 'navRow',
    parameters: { useLabel: true, label: 'Navigation order', type: 'number' }
  },
  {
    id: 'showInNavBox',
    type: 'net.noodl.controls.checkbox',
    label: 'Show in navigation',
    parent: 'navRow',
    parameters: { useLabel: true, label: 'Show in navigation' }
  },

  // ── The sections — §2's third bullet ───────────────────────────────────────
  {
    id: 'sectionsPanel',
    type: 'Group',
    label: 'Sections',
    parent: 'body',
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-3)' },
    children: ['sectionsHeader', 'sectionList']
  },
  {
    id: 'sectionsHeader',
    type: 'Group',
    label: 'Add a section',
    parent: 'sectionsPanel',
    // The second of SBR-007's three `ADMIN_LAYOUT_OWED` rows: this Group was the
    // bare `addRow` and defaulted to filling its parent.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-3)'
    },
    children: ['sectionsHeading', 'kindPicker', 'addButton']
  },
  {
    id: 'sectionsHeading',
    type: 'Text',
    label: 'Sections heading',
    parent: 'sectionsHeader',
    parameters: {
      ...IN_A_ROW,
      text: 'Sections',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'kindPicker',
    type: 'net.noodl.controls.options',
    label: 'Section kind',
    parent: 'sectionsHeader',
    // 🔴 `items` is NOT a comma list, and the door cannot say so — it is a static
    // `array` port, so no `dynamic-port-skipped` info covers it and a string
    // lands as a green graph that throws in `Select.tsx:116` the moment the page
    // renders. The control wants an array of `{ Label, Value }` objects
    // (`Select.tsx:116-119` reads exactly those two keys), which is what
    // `kindItems` below supplies.
    parameters: { useLabel: true, label: 'Kind' }
  },
  {
    id: 'addButton',
    type: 'net.noodl.controls.button',
    label: 'Add',
    parent: 'sectionsHeader',
    parameters: { label: 'Add section' }
  },
  {
    id: 'sectionList',
    type: 'For Each',
    label: 'One row per section',
    parent: 'sectionsPanel',
    parameters: { templateType: 'explicit', template: '/Admin/SectionRow' }
  },
  {
    id: 'backButton',
    type: 'net.noodl.controls.button',
    label: 'Back',
    parent: 'body',
    parameters: { label: 'Back to pages' }
  },
  {
    id: 'kindItems',
    type: 'Static Data',
    label: 'The five section kinds',
    // SB-004 §2 fixed the discriminator's vocabulary; this is that list, in the
    // shape the Dropdown reads. `Static Data.items` hands over a Collection
    // (`staticdata.ts:134`), and `Array.prototype` carries `.items`/`.size`
    // globally (`collection.ts:436-458`), so either shape satisfies `Select`.
    parameters: {
      type: 'json',
      json: JSON.stringify([
        { Label: 'Hero', Value: 'hero' },
        { Label: 'Rich text', Value: 'richText' },
        { Label: 'Gallery', Value: 'gallery' },
        { Label: 'Contact', Value: 'contact' },
        { Label: 'Call to action', Value: 'cta' }
      ])
    }
  },
  { id: 'pageInputs', type: 'PageInputs', label: 'Which page', parameters: { pathParams: 'pageId' } },
  {
    id: 'hold',
    type: 'JavaScriptFunction',
    label: 'Hold the page id',
    // Rule 1.
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // The filter value and everything driven by it leave from HERE, so the
      // query cannot be triggered by a node that does not also carry its filter.
      functionScript:
        "if (Inputs.pageId === undefined || Inputs.pageId === '') return;\n" +
        'Outputs.pageId = Inputs.pageId;\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'record',
    type: 'DbModel2',
    label: 'The page being edited',
    parameters: { collectionName: 'Page', idSource: 'explicit' }
  },
  {
    id: 'save',
    type: 'SetDbModelProperties',
    label: 'Save the page fields',
    // 🔴 No access rules, and no `prop-published`. Both omissions are the
    // invariant, not an oversight — see the module header and acceptance 3.
    parameters: { collectionName: 'Page', idSource: 'explicit', storeProperties: 'specified' }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    parameters: {
      // 🔴 The half of rule 3 that transfers: no load-time fetch, so the query
      // cannot run before its filter exists and return every Section on the site.
      ...NO_LOAD_TIME_FETCH,
      // 🔴 **SBR-016's second instance, and the one that had to be checked
      // rather than assumed.** With the two boxes above off, *the filter value
      // arriving* is this query's only unprompted trigger — the wire comment
      // below says exactly that. But `storageFetch` is wired from the two write
      // completions, so the NDA-017 migration also silences the discovered
      // `qp-` ports (`RUN_ON_CHANGE_FAMILIES.DbCollection2.discoveredPrefixes`),
      // and `runOnChange-qp-pageId: false` removes the one trigger the author
      // left. Editing a page then showed no sections until you added one.
      //
      // ⚠️ The repair here CANNOT be the one `/Pages/Admin` uses. Turning
      // `runOnChange-collectionName` back on would fetch every Section on the
      // site before `pageId` exists — F12, the defect `NO_LOAD_TIME_FETCH` is
      // for. The trigger has to be the filter value, and this is how it survives.
      'runOnChange-qp-pageId': true,
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER
    }
  },
  {
    id: 'addSection',
    type: 'NewDbModelProperties',
    label: 'Add a section to this page',
    parameters: {
      collectionName: 'Section',
      // 🔴 Acceptance 2 again. A section born without the admin rule is
      // world-readable the instant `Section.find` goes public, even though the
      // page it belongs to is still a draft.
      ...ADMIN_ONLY_RULES
    }
  },
  {
    id: 'goBack',
    type: 'RouterNavigate',
    label: 'Back to the list',
    parameters: { router: ROUTER, target: '/Pages/Admin' }
  },
  {
    id: 'headline',
    type: 'JavaScriptFunction',
    label: 'Which page is being edited',
    // Rule 1: `Outputs.headline` is a value, so there is no signal port to declare.
    //
    // 🔴 `runOnChange-in-title: true` for SBR-004 §9.2's reason, the same one
    // `/Admin/PageRow`'s `status` carries: the NDA-017 migration writes
    // `runOnChange-<input>: false` over every value input on every project load,
    // and an explicit `true` is what survives it. An absent key does not.
    parameters: {
      'runOnChange-in-title': true,
      functionScript: [
        // ⚠️ Guarded before `.trim()`. An unconnected or not-yet-published input
        // arrives as `undefined` and carries NO default, so `.trim()` on it
        // throws and takes the whole function with it.
        'if (Inputs.title === undefined) return;',
        "const title = String(Inputs.title === null ? '' : Inputs.title).trim();",
        // A page genuinely can have no title — `/Pages/Admin` creates rows before
        // anyone names them — and "Editing · " with nothing after it reads as a
        // rendering fault rather than as an unnamed page.
        "Outputs.headline = title === '' ? 'Editing · Untitled page' : 'Editing · ' + title;"
      ].join('\n')
    }
  },
  {
    id: 'status',
    type: 'JavaScriptFunction',
    label: 'Draft or published, as a word and a colour',
    // The same three outputs `/Admin/PageRow` derives, deliberately duplicated
    // rather than shared: they are two components, and a `Component Inputs` hop
    // to share four lines of string arithmetic would cost a placement.
    parameters: {
      'runOnChange-in-published': true,
      functionScript: [
        'const published = Inputs.published === true;',
        "Outputs.label = published ? 'Published' : 'Draft';",
        "Outputs.pillBackground = published ? 'var(--primary)' : 'var(--accent)';",
        "Outputs.pillColor = published ? 'var(--primary-foreground)' : 'var(--muted-foreground)';"
      ].join('\n')
    }
  },
  {
    id: 'dirty',
    type: 'JavaScriptFunction',
    label: 'Is there anything unsaved?',
    // ── Acceptance 5, and why this is a COMPARISON and not a `States` node ────
    //
    // The obvious build is `States(Clean,Dirty)` with every field's `textChanged`
    // signal driving `to-Dirty` and `save.done` driving `to-Clean`. It does not
    // work, and the reason is measurable in `text-input.ts`: `startValue.set`
    // calls `setText`, `setText` flags `onTextChanged`, and `onTextChanged`'s
    // `onChange` fires the `textChanged` SIGNAL (`text-input.ts:272`). So the
    // record merely *loading* marks the form dirty, and the only repair is to
    // land a `to-Clean` after five `to-Dirty`s that arrive in the same pass —
    // which is sequencing on drain order, the exact thing this task's third trap
    // says is not a guarantee (P75 measured that order as an accident).
    //
    // A comparison is order-independent: it is a pure function of (loaded,
    // current), so it gives the same answer whenever it runs. It also makes the
    // marker CORRECT rather than merely present — typing a character and typing
    // it back out again leaves the form clean, which a signal counter cannot do.
    parameters: {
      'runOnChange-in-title': true,
      'runOnChange-in-slug': true,
      'runOnChange-in-seo': true,
      'runOnChange-in-navOrder': true,
      'runOnChange-in-showInNav': true,
      'runOnChange-in-loadedTitle': true,
      'runOnChange-in-loadedSlug': true,
      'runOnChange-in-loadedSeo': true,
      'runOnChange-in-loadedNavOrder': true,
      'runOnChange-in-loadedShowInNav': true,
      functionScript: [
        // Before the record has arrived there is nothing to be different FROM,
        // and "no answer" is the honest reading — not "clean", which would be a
        // claim about a form nobody has loaded yet.
        'if (Inputs.loadedTitle === undefined) return;',
        // `null`, `undefined` and `''` are the same emptiness to a person, and a
        // number field publishes `12` where the record holds `"12"`. Comparing as
        // trimmed strings is what stops a freshly loaded form reading dirty.
        "const same = (a, b) => String(a === undefined || a === null ? '' : a).trim() === String(b === undefined || b === null ? '' : b).trim();",
        'Outputs.dirty =',
        '  !same(Inputs.title, Inputs.loadedTitle) ||',
        '  !same(Inputs.slug, Inputs.loadedSlug) ||',
        '  !same(Inputs.seo, Inputs.loadedSeo) ||',
        '  !same(Inputs.navOrder, Inputs.loadedNavOrder) ||',
        // A checkbox is a boolean on both sides, so it compares as one — an
        // absent column reads `undefined`, which is `false` to a person.
        '  (Inputs.showInNav === true) !== (Inputs.loadedShowInNav === true);'
      ].join('\n')
    }
  },
  {
    id: 'preview',
    type: 'RouterNavigate',
    label: 'Preview the public page',
    // 🔴 A COMPONENT target and a page parameter, never a built URL string.
    // SBR-006's own fix (`8661ce83`) was exactly this defect on "View site": a
    // target with no slug landed the visitor on the literal `{slug}`.
    // `/Pages/Site`'s `urlPath` is `{slug}`, so `pm-slug` is what fills it.
    //
    // ⚠️ Fed from the RECORD's slug, not the slug FIELD: previewing a slug that
    // has only been typed would open a page that does not exist yet. The preview
    // is of what is saved, which is also what a visitor would get.
    parameters: { router: ROUTER, target: '/Pages/Site' }
  }
];

export const PAGE_EDITOR_WIRES = [
  { fromId: 'kindItems', fromProperty: 'items', toId: 'kindPicker', toProperty: 'items' },
  { fromId: 'pageInputs', fromProperty: 'pm-pageId', toId: 'hold', toProperty: 'in-pageId' },
  // The page node's mount is the one signal guaranteed to come after the Router
  // has set the parameters (`router.tsx:602`), and it is a different producer
  // from the value only in the sense that the value is already there.
  { fromId: 'page', fromProperty: 'didMount', toId: 'hold', toProperty: 'run' },

  { fromId: 'hold', fromProperty: 'out-pageId', toId: 'record', toProperty: 'modelId' },
  { fromId: 'hold', fromProperty: 'out-ready', toId: 'record', toProperty: 'fetch' },

  { fromId: 'record', fromProperty: 'prop-title', toId: 'titleField', toProperty: 'startValue' },
  { fromId: 'record', fromProperty: 'prop-slug', toId: 'slugField', toProperty: 'startValue' },
  { fromId: 'record', fromProperty: 'prop-seoDescription', toId: 'seoField', toProperty: 'startValue' },
  { fromId: 'record', fromProperty: 'prop-navOrder', toId: 'navOrderField', toProperty: 'startValue' },
  { fromId: 'record', fromProperty: 'prop-showInNav', toId: 'showInNavBox', toProperty: 'checked' },

  { fromId: 'hold', fromProperty: 'out-pageId', toId: 'save', toProperty: 'modelId' },
  { fromId: 'titleField', fromProperty: 'onTextChanged', toId: 'save', toProperty: 'prop-title' },
  { fromId: 'slugField', fromProperty: 'onTextChanged', toId: 'save', toProperty: 'prop-slug' },
  { fromId: 'seoField', fromProperty: 'onTextChanged', toId: 'save', toProperty: 'prop-seoDescription' },
  { fromId: 'navOrderField', fromProperty: 'onTextChanged', toId: 'save', toProperty: 'prop-navOrder' },
  { fromId: 'showInNavBox', fromProperty: 'checked', toId: 'save', toProperty: 'prop-showInNav' },
  { fromId: 'saveButton', fromProperty: 'onClick', toId: 'save', toProperty: 'store' },

  // 🔴 The filter value's arrival is the query's first and only unprompted
  // trigger. Nothing else is wired to `storageFetch` except the two write
  // completions below, neither of which can fire before a human has used a page
  // that already has its id.
  { fromId: 'hold', fromProperty: 'out-pageId', toId: 'sections', toProperty: 'qp-pageId' },

  { fromId: 'hold', fromProperty: 'out-pageId', toId: 'addSection', toProperty: 'prop-pageId' },
  { fromId: 'kindPicker', fromProperty: 'value', toId: 'addSection', toProperty: 'prop-kind' },
  { fromId: 'sections', fromProperty: 'count', toId: 'addSection', toProperty: 'prop-order' },
  { fromId: 'addButton', fromProperty: 'onClick', toId: 'addSection', toProperty: 'store' },

  { fromId: 'addSection', fromProperty: 'done', toId: 'sections', toProperty: 'storageFetch' },
  // SB-018 (1) again, same fix and same reason — see `/Pages/Admin` above.
  { fromId: 'sectionList', fromProperty: 'itemOutputSignal-Changed', toId: 'sections', toProperty: 'storageFetch' },

  { fromId: 'sections', fromProperty: 'items', toId: 'sectionList', toProperty: 'items' },
  { fromId: 'backButton', fromProperty: 'onClick', toId: 'goBack', toProperty: 'navigate' },

  // ── The header row: which page, what state, and what is unsaved ────────────
  { fromId: 'record', fromProperty: 'prop-title', toId: 'headline', toProperty: 'in-title' },
  { fromId: 'headline', fromProperty: 'out-headline', toId: 'heading', toProperty: 'text' },

  // The pill, wired exactly as `/Admin/PageRow` wires its own — same three
  // outputs onto the same three ports.
  { fromId: 'record', fromProperty: 'prop-published', toId: 'status', toProperty: 'in-published' },
  { fromId: 'status', fromProperty: 'out-label', toId: 'pillText', toProperty: 'text' },
  { fromId: 'status', fromProperty: 'out-pillBackground', toId: 'pill', toProperty: 'backgroundColor' },
  { fromId: 'status', fromProperty: 'out-pillColor', toId: 'pillText', toProperty: 'color' },

  // 🔴 Preview takes the RECORD's slug, not the field's — see the node's comment.
  { fromId: 'record', fromProperty: 'prop-slug', toId: 'preview', toProperty: 'pm-slug' },
  { fromId: 'previewButton', fromProperty: 'onClick', toId: 'preview', toProperty: 'navigate' },

  // ── Acceptance 5: the two sides of the comparison ─────────────────────────
  // What the record says…
  { fromId: 'record', fromProperty: 'prop-title', toId: 'dirty', toProperty: 'in-loadedTitle' },
  { fromId: 'record', fromProperty: 'prop-slug', toId: 'dirty', toProperty: 'in-loadedSlug' },
  { fromId: 'record', fromProperty: 'prop-seoDescription', toId: 'dirty', toProperty: 'in-loadedSeo' },
  { fromId: 'record', fromProperty: 'prop-navOrder', toId: 'dirty', toProperty: 'in-loadedNavOrder' },
  { fromId: 'record', fromProperty: 'prop-showInNav', toId: 'dirty', toProperty: 'in-loadedShowInNav' },
  // …and what the five controls currently hold. `onTextChanged` is the VALUE
  // output (`text-input.ts:262`, display name "Value"), not the signal — the
  // signal is `textChanged`, and using it here is the mistake the node's comment
  // describes.
  { fromId: 'titleField', fromProperty: 'onTextChanged', toId: 'dirty', toProperty: 'in-title' },
  { fromId: 'slugField', fromProperty: 'onTextChanged', toId: 'dirty', toProperty: 'in-slug' },
  { fromId: 'seoField', fromProperty: 'onTextChanged', toId: 'dirty', toProperty: 'in-seo' },
  { fromId: 'navOrderField', fromProperty: 'onTextChanged', toId: 'dirty', toProperty: 'in-navOrder' },
  { fromId: 'showInNavBox', fromProperty: 'checked', toId: 'dirty', toProperty: 'in-showInNav' },
  { fromId: 'dirty', fromProperty: 'out-dirty', toId: 'dirtyMark', toProperty: 'mounted' },

  // 🔴 **Re-read the row after a successful save, sequenced on `done`.** Two
  // things need it and neither is cosmetic: the comparison above is against the
  // record, so without a re-read the form stays "unsaved" forever after saving;
  // and acceptance 4 asks the screen to show the STORED row rather than the
  // input's own echo, which is only true if something goes back and asks.
  //
  // `done`, not `store`'s completion by wire order — this task's third trap.
  { fromId: 'save', fromProperty: 'done', toId: 'record', toProperty: 'fetch' }
];

// ── 6. Pages/ThemeEditor — the theme tokens and the site settings ────────────

/**
 * §3 surface 4, plus the settings form it shares a screen with.
 *
 * The token set is **fixed and small** rather than a free JSON editor, so the
 * public site can rely on the keys existing. Four is the useful minimum: two
 * colours the eye reads as the brand, one for text, and the face it is set in.
 *
 * ⚠️ **No `contactRecipient` field.** `SiteSettings` is world-readable (SB-004
 * §4 gives it `find`/`get: public`, because the public site reads `siteName`),
 * so the address cannot live in that row — SB-004 F8, which is Richard's and
 * blocks SB-006's contact section, not this form.
 *
 * ⚠️ Both queries here are singletons and keep their load-time fetch, for the
 * reason `site/ContactRecipient` records: with the boxes off and no filter
 * parameter, nothing ever triggers them.
 */
export const THEME_EDITOR_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Theme and settings',
    parameters: { title: 'Theme and settings', urlPath: `${ADMIN_PATH_PREFIX}/theme` },
    children: ['adminShell']
  },
  {
    id: 'adminShell',
    type: '/Admin/Shell',
    label: 'Admin shell',
    parent: 'page',
    // 🔴 AC5: the SECOND placement of `/Admin/Shell`, and the one that proves the
    // `Component Inputs` interface does something — same component as
    // `/Pages/Admin` places, different `active`, so the sidebar's current item
    // moves. A shell whose current item were hard-coded would render identically
    // here and nobody would notice until a person used it.
    parameters: { active: 'theme' },
    children: ['shell']
  },
  {
    id: 'shell',
    type: 'Group',
    label: 'Editor',
    parent: 'adminShell',
    // Child of the shell's content COLUMN now, so it stops assigning height —
    // and the paddings are gone because the shell supplies them; keeping both
    // would double the inset.
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['heading', 'siteNameField', 'homeSlugField', 'settingsButton', 'tokensHeading', 'primaryField', 'backgroundField', 'textField', 'fontField', 'themeButton', 'backButton']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    parameters: { text: 'Theme and settings', fontWeight: 'var(--font-bold)' }
  },
  {
    id: 'siteNameField',
    type: 'net.noodl.controls.textinput',
    label: 'Site name',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Site name' }
  },
  {
    id: 'homeSlugField',
    type: 'net.noodl.controls.textinput',
    label: 'Home slug',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Home page slug' }
  },
  {
    id: 'settingsButton',
    type: 'net.noodl.controls.button',
    label: 'Save settings',
    parent: 'shell',
    parameters: { label: 'Save settings' }
  },
  {
    id: 'tokensHeading',
    type: 'Text',
    label: 'Tokens heading',
    parent: 'shell',
    parameters: { text: 'Theme', fontWeight: 'var(--font-semibold)' }
  },
  {
    id: 'primaryField',
    type: 'net.noodl.controls.textinput',
    label: 'Primary colour',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Primary colour' }
  },
  {
    id: 'backgroundField',
    type: 'net.noodl.controls.textinput',
    label: 'Background colour',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Background colour' }
  },
  {
    id: 'textField',
    type: 'net.noodl.controls.textinput',
    label: 'Text colour',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Text colour' }
  },
  {
    id: 'fontField',
    type: 'net.noodl.controls.textinput',
    label: 'Font family',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Font family' }
  },
  {
    id: 'themeButton',
    type: 'net.noodl.controls.button',
    label: 'Save theme',
    parent: 'shell',
    parameters: { label: 'Save theme' }
  },
  {
    id: 'backButton',
    type: 'net.noodl.controls.button',
    label: 'Back',
    parent: 'shell',
    parameters: { label: 'Back to pages' }
  },
  { id: 'settings', type: 'DbCollection2', label: 'SiteSettings (one row)', parameters: { collectionName: 'SiteSettings' } },
  { id: 'theme', type: 'DbCollection2', label: 'Theme (one row)', parameters: { collectionName: 'Theme' } },
  {
    id: 'readSettings',
    type: 'JavaScriptFunction',
    label: 'Read the settings row',
    parameters: {
      functionScript:
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        "Outputs.siteName = first.siteName || '';\n" +
        "Outputs.homeSlug = first.homeSlug || 'home';"
    }
  },
  {
    id: 'readTheme',
    type: 'JavaScriptFunction',
    label: 'Read the theme tokens',
    parameters: {
      // SBR-003: all twelve contract fields come back out, so SBR-009's grouped
      // fields have a startValue to wire to as they land. Unread-by-any-field
      // outputs are just unwired ports until then.
      functionScript:
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        'const t = first.tokens || {};\n' +
        "Outputs.primary = t.colorPrimary || '';\n" +
        "Outputs.onPrimary = t.colorOnPrimary || '';\n" +
        "Outputs.background = t.colorBackground || '';\n" +
        "Outputs.surface = t.colorSurface || '';\n" +
        "Outputs.text = t.colorText || '';\n" +
        "Outputs.textSoft = t.colorTextSoft || '';\n" +
        "Outputs.border = t.colorBorder || '';\n" +
        "Outputs.accentSoft = t.colorAccentSoft || '';\n" +
        "Outputs.radius = t.radius || '';\n" +
        "Outputs.fontDisplay = t.fontDisplay || '';\n" +
        "Outputs.fontUi = t.fontUi || '';\n" +
        "Outputs.measure = t.measure || '';"
    }
  },
  {
    id: 'buildTokens',
    type: 'JavaScriptFunction',
    label: 'The theme tokens, as one object',
    // Rule 1.
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // The keys are SBR-003's contract with the public site (`THEME_KEYS` /
      // `siteTheme.ts`), so all twelve are written whether or not the author
      // filled every field — a missing key and an empty one are different
      // things to a reader that does `tokens.colorText`. Fields the current
      // screen does not yet expose arrive as `undefined` (an unconnected input
      // has NO default) and save as '' — "no override" — until SBR-009 wires
      // them and the preset row fills them.
      functionScript:
        'Outputs.tokens = {\n' +
        "  colorPrimary: Inputs.primary || '',\n" +
        "  colorOnPrimary: Inputs.onPrimary || '',\n" +
        "  colorBackground: Inputs.background || '',\n" +
        "  colorSurface: Inputs.surface || '',\n" +
        "  colorText: Inputs.text || '',\n" +
        "  colorTextSoft: Inputs.textSoft || '',\n" +
        "  colorBorder: Inputs.border || '',\n" +
        "  colorAccentSoft: Inputs.accentSoft || '',\n" +
        "  radius: Inputs.radius || '',\n" +
        "  fontDisplay: Inputs.fontDisplay || '',\n" +
        "  fontUi: Inputs.fontUi || '',\n" +
        "  measure: Inputs.measure || ''\n" +
        '};\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'saveSettings',
    type: 'SetDbModelProperties',
    label: 'Save the settings row',
    // No access rules: `claimSite` wrote this row's ACL (admin write, world
    // read) and the panel must not rewrite it — the module header's second rule
    // applies to `SiteSettings` too, and here the loss would be the PUBLIC read
    // the whole site depends on.
    parameters: { collectionName: 'SiteSettings', idSource: 'explicit', storeProperties: 'specified' }
  },
  {
    id: 'saveTheme',
    type: 'SetDbModelProperties',
    label: 'Save the theme row',
    parameters: { collectionName: 'Theme', idSource: 'explicit', storeProperties: 'specified' }
  },
  {
    id: 'goBack',
    type: 'RouterNavigate',
    label: 'Back to the list',
    parameters: { router: ROUTER, target: '/Pages/Admin' }
  }
];

export const THEME_EDITOR_WIRES = [
  { fromId: 'settings', fromProperty: 'items', toId: 'readSettings', toProperty: 'in-rows' },
  { fromId: 'settings', fromProperty: 'fetched', toId: 'readSettings', toProperty: 'run' },
  { fromId: 'readSettings', fromProperty: 'out-siteName', toId: 'siteNameField', toProperty: 'startValue' },
  { fromId: 'readSettings', fromProperty: 'out-homeSlug', toId: 'homeSlugField', toProperty: 'startValue' },

  { fromId: 'theme', fromProperty: 'items', toId: 'readTheme', toProperty: 'in-rows' },
  { fromId: 'theme', fromProperty: 'fetched', toId: 'readTheme', toProperty: 'run' },
  { fromId: 'readTheme', fromProperty: 'out-primary', toId: 'primaryField', toProperty: 'startValue' },
  { fromId: 'readTheme', fromProperty: 'out-background', toId: 'backgroundField', toProperty: 'startValue' },
  { fromId: 'readTheme', fromProperty: 'out-text', toId: 'textField', toProperty: 'startValue' },
  // SBR-003: the existing font field edits the DISPLAY face (SBR-009 groups it
  // as "heading font"); `fontUi` gets its own field there.
  { fromId: 'readTheme', fromProperty: 'out-fontDisplay', toId: 'fontField', toProperty: 'startValue' },

  // `firstItemId` is the singleton's id — the row `claimSite` wrote.
  { fromId: 'settings', fromProperty: 'firstItemId', toId: 'saveSettings', toProperty: 'modelId' },
  { fromId: 'siteNameField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-siteName' },
  { fromId: 'homeSlugField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-homeSlug' },
  { fromId: 'settingsButton', fromProperty: 'onClick', toId: 'saveSettings', toProperty: 'store' },

  { fromId: 'primaryField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-primary' },
  { fromId: 'backgroundField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-background' },
  { fromId: 'textField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-text' },
  { fromId: 'fontField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-fontDisplay' },
  { fromId: 'themeButton', fromProperty: 'onClick', toId: 'buildTokens', toProperty: 'run' },
  { fromId: 'theme', fromProperty: 'firstItemId', toId: 'saveTheme', toProperty: 'modelId' },
  { fromId: 'buildTokens', fromProperty: 'out-tokens', toId: 'saveTheme', toProperty: 'prop-tokens' },
  { fromId: 'buildTokens', fromProperty: 'out-built', toId: 'saveTheme', toProperty: 'store' },

  { fromId: 'backButton', fromProperty: 'onClick', toId: 'goBack', toProperty: 'navigate' }
];

// ── 7. Admin/Shell — the frame every admin screen sits inside ────────────────

/**
 * SBR-006 acceptance 5, and the reason it is a component rather than a copied
 * band of nodes: the phase brief asks for "no copy-paste shells", and a shell
 * that is placed twice is the only kind whose sidebar cannot disagree with
 * itself between two screens.
 *
 * The content of each screen arrives through `Component Children`
 * (`nodescope.ts:217`), so a screen places the shell and puts its own body
 * inside the instance — the shell owns the chrome, the screen owns the page.
 *
 * 🔴 **The `active` input is the AC5 half that a shell without one fails
 * silently.** The MCP guidance's ghost is "a component without a Component
 * Inputs renders identically however many times you place it", which is exactly
 * what a sidebar with a hard-coded current item does: it would say Pages on the
 * theme screen and nobody would notice until a person used it. `active` is read
 * by `navStyle` below and reaches the colour AND the weight of one item, so the
 * two placements are observably different renders of one component.
 */
/**
 * The one thing an admin screen says to somebody who is not signed in. A
 * constant because SBR-017 AC3 asserts **the words**, not the absence of rows —
 * the whole finding is that four different states were rendering as one blank
 * panel.
 */
export const SIGNED_OUT_TEXT = 'You are not signed in. Sign in to manage this site.';

export const ADMIN_SHELL_NODES = [
  {
    id: 'frame',
    type: 'Group',
    label: 'Admin frame',
    // The frame IS the page's ground — it is supposed to take the whole
    // viewport, which is why it is one of the two nodes here that legitimately
    // fill. See `ADMIN_FILL_EXEMPTIONS`.
    parameters: { flexDirection: 'row', backgroundColor: 'var(--background)' },
    children: ['sidebar', 'main']
  },
  {
    id: 'sidebar',
    type: 'Group',
    label: 'Sidebar',
    parent: 'frame',
    // 🔴 `width` is authored, and that is the point rather than a style choice:
    // a rail with no stated width defaults to 100% along its parent's ROW, which
    // `Layout.size` turns into `flexGrow` and the sidebar eats half the screen.
    // An authored size on the axis is what `findGrowingNodes` accepts as "the
    // author said a size out loud". `SIDEBAR_WIDTH` is a raw dimension with a
    // reason, in `ADMIN_RAW_DIMENSIONS`.
    parameters: {
      sizeMode: 'explicit',
      width: SIDEBAR_WIDTH,
      flexDirection: 'column',
      backgroundColor: 'var(--surface)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      rowGap: 'var(--space-1)',
      borderRightStyle: 'solid',
      borderRightWidth: 'var(--border-1)',
      borderRightColor: 'var(--border)'
    },
    children: ['brand', 'navPages', 'navTheme', 'navMessages', 'viewSite', 'signOut']
  },
  {
    id: 'brand',
    type: 'Text',
    label: 'Brand',
    parent: 'sidebar',
    parameters: {
      ...STACKED,
      text: 'Site admin',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-bold)',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--muted-foreground)',
      marginBottom: 'var(--space-4)'
    }
  },
  ...navItem('navPages', 'Pages'),
  ...navItem('navTheme', 'Theme & settings'),
  ...navItem('navMessages', 'Messages'),
  {
    id: 'viewSite',
    type: 'Text',
    label: 'View site',
    parent: 'sidebar',
    parameters: {
      ...STACKED,
      text: 'View site',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--primary)',
      marginTop: 'var(--space-6)'
    }
  },
  {
    id: 'main',
    type: 'Group',
    label: 'Admin content',
    parent: 'frame',
    // The other legitimate filler: the content column takes whatever the rail
    // leaves. Named in `ADMIN_FILL_EXEMPTIONS` with that sentence.
    parameters: {
      flexDirection: 'column',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)',
      paddingLeft: 'var(--space-8)',
      paddingRight: 'var(--space-8)'
    },
    children: ['signedOutNotice', 'slot']
  },
  {
    id: 'signedOutNotice',
    type: 'Text',
    label: 'Signed out notice',
    parent: 'main',
    // 🔴 SBR-017 §3's "a decision, not a default", decided here rather than on
    // each screen: **the shell says it, and a click on it goes to the sign-in
    // page.** Every admin screen places this component, so one sentence covers
    // all three and cannot disagree with itself between two of them — the same
    // argument that made the sidebar a component in the first place.
    //
    // A redirect was the alternative and was not taken: `/Pages/SignIn` does NOT
    // place this shell, so a redirect would fire from a component that is not
    // mounted on the screen it lands on, and a wrong `authenticated` reading
    // would take a signed-in admin away from work in progress. A sentence is
    // recoverable; a redirect loop is not.
    //
    // 🔴 The words are the AC, not the absence of rows. SBR-016's finding is
    // that a refused query, an empty collection and a collection that never
    // asked render the same empty screen; "signed out" is a **fourth** state
    // that used to render identically to all three, and this is the line that
    // separates it.
    parameters: {
      ...STACKED,
      mounted: false,
      text: SIGNED_OUT_TEXT,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--destructive)',
      marginBottom: 'var(--space-4)'
    }
  },
  {
    id: 'slot',
    type: 'Component Children',
    label: 'The screen that placed this shell',
    parent: 'main'
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'Which item is current',
    ports: [{ name: 'active', type: 'string', plug: 'output' }]
  },
  {
    id: 'navStyle',
    type: 'JavaScriptFunction',
    label: 'Colour and weight for the current item',
    parameters: {
      // 🔴 `runOnChange-in-active: true`, authored. SBR-004 §9.2: the NDA-017
      // back-compat migration writes `runOnChange-<input>: false` on every value
      // input of a node whose control signal is wired, on EVERY project load —
      // an explicit `true` survives it, an absent key does not. This node has no
      // wired control signal today, so the migration does not reach it; the
      // parameter is here so that wiring one later cannot silently unstyle the
      // sidebar.
      'runOnChange-in-active': true,
      functionScript: [
        "const active = Inputs.active || '';",
        "const colour = (k) => (active === k ? 'var(--primary)' : 'var(--foreground)');",
        "const weight = (k) => (active === k ? 'var(--font-semibold)' : 'var(--font-normal)');",
        'Outputs.pagesColor = colour("pages");',
        'Outputs.pagesWeight = weight("pages");',
        'Outputs.themeColor = colour("theme");',
        'Outputs.themeWeight = weight("theme");',
        'Outputs.messagesColor = colour("messages");',
        'Outputs.messagesWeight = weight("messages");'
      ].join('\n')
    }
  },
  {
    id: 'goPages',
    type: 'RouterNavigate',
    label: 'To the pages list',
    parameters: { router: ROUTER, target: '/Pages/Admin' }
  },
  {
    id: 'goTheme',
    type: 'RouterNavigate',
    label: 'To the theme editor',
    parameters: { router: ROUTER, target: '/Pages/ThemeEditor' }
  },
  {
    id: 'signOut',
    type: 'Text',
    label: 'Sign out',
    parent: 'sidebar',
    // ⚠️ SBR-017 §3's order, honoured: sign-out is added **with** sign-in and
    // never before it. A rail that can end a session on a template that cannot
    // start one is the defect this task exists to close, made one click easier
    // to reach.
    //
    // 🔴 `mounted: false` and the wire raises it — the opposite default from the
    // notice above, and deliberately: an admin who is signed out must not be
    // offered a way to sign out again, and the flash on the way in is a rail
    // item appearing rather than a wrong one being shown.
    parameters: {
      ...STACKED,
      mounted: false,
      text: 'Sign out',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)',
      marginTop: 'var(--space-2)'
    }
  },
  {
    id: 'user',
    type: 'net.noodl.user.User',
    label: 'Who is signed in',
    // `authenticated` is a getter over "is there a user model", flagged dirty
    // from `initialize` and again on every `loggedIn`/`loggedOut` — so it
    // publishes without anything wiring `Fetch`, and it publishes again when
    // `logOut` below lands. That is what makes one node serve both the rail item
    // and the notice.
  },
  {
    id: 'signedOut',
    type: 'Inverter',
    label: 'Nobody is signed in'
  },
  { id: 'logOut', type: 'net.noodl.user.LogOut', label: 'End the session' },
  {
    id: 'goSignIn',
    type: 'RouterNavigate',
    label: 'To the sign-in screen',
    // `deferred`, like `goPages` and `goTheme`: this component is written FIRST,
    // and `/Pages/SignIn` does not exist until the SB-005 create pass reaches it.
    parameters: { router: ROUTER, target: '/Pages/SignIn' }
  },
  {
    id: 'goSite',
    type: 'RouterNavigate',
    label: 'To the public site',
    // `/Pages/Site` belongs to the SB-006 set, which `buildSiteTemplateProject`
    // writes BEFORE this one — so the target resolves on the create pass and,
    // unlike the two above, needs no deferral.
    //
    // 🔴 That ordering used to be invisible to `sb005AdminPanel.test.ts`, which
    // authored the admin set into a project containing NOTHING else: the door
    // refused this component with `unresolved-navigation` and all twenty of that
    // file's other assertions failed with it. Two populations that disagreed
    // about what a component may name. The spec now writes the public site
    // first, exactly as the generator does, so it grades the admin panel in the
    // project the admin panel actually ships into.
    //
    // ⚠️ A path (`PageStackNavigateToPath`, `path: '/'`) was tried instead and is
    // ALSO refused: the door checks paths against the `urlPath` every Page
    // declares, and no page declares the bare root.
    // 🔴 `pm-slug: ''` is the whole fix, and the drive is what found it. With the
    // target alone the Router substituted nothing and the browser landed on the
    // LITERAL template: `location.pathname` read `/%7Bslug%7D` — `/{slug}` — and
    // the site answered "That page could not be found." A component target is
    // necessary and not sufficient; a page whose `urlPath` carries a parameter
    // needs that parameter supplied, exactly as `goEdit` supplies `pm-pageId`.
    //
    // The empty slug IS the site root, which is the page SBR-004 §11 drove.
    parameters: { router: ROUTER, target: '/Pages/Site', 'pm-slug': '' }
  }
];

export const ADMIN_SHELL_WIRES = [
  { fromId: 'inputs', fromProperty: 'active', toId: 'navStyle', toProperty: 'in-active' },

  { fromId: 'navStyle', fromProperty: 'out-pagesColor', toId: 'navPages', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-pagesWeight', toId: 'navPages', toProperty: 'fontWeight' },
  { fromId: 'navStyle', fromProperty: 'out-themeColor', toId: 'navTheme', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-themeWeight', toId: 'navTheme', toProperty: 'fontWeight' },
  { fromId: 'navStyle', fromProperty: 'out-messagesColor', toId: 'navMessages', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-messagesWeight', toId: 'navMessages', toProperty: 'fontWeight' },

  { fromId: 'navPages', fromProperty: 'onClick', toId: 'goPages', toProperty: 'navigate' },
  { fromId: 'navTheme', fromProperty: 'onClick', toId: 'goTheme', toProperty: 'navigate' },
  { fromId: 'viewSite', fromProperty: 'onClick', toId: 'goSite', toProperty: 'navigate' },

  // SBR-017. One reading of "is anybody signed in", two opposite consequences.
  { fromId: 'user', fromProperty: 'authenticated', toId: 'signOut', toProperty: 'mounted' },
  { fromId: 'user', fromProperty: 'authenticated', toId: 'signedOut', toProperty: 'value' },
  { fromId: 'signedOut', fromProperty: 'result', toId: 'signedOutNotice', toProperty: 'mounted' },

  // ⚠️ The Log Out node's trigger input is called `login`, not `logout` —
  // `logout.ts:69` declares it under that name with the display name `Do`. It is
  // read off the node, not guessed from the family.
  { fromId: 'signOut', fromProperty: 'onClick', toId: 'logOut', toProperty: 'login' },
  { fromId: 'logOut', fromProperty: 'done', toId: 'goSignIn', toProperty: 'navigate' },
  { fromId: 'signedOutNotice', fromProperty: 'onClick', toId: 'goSignIn', toProperty: 'navigate' }

  // 🔴 `navMessages` has NO navigate wire, and the gap is recorded rather than
  // papered over: `/Pages/Messages` is SBR-010's component and does not exist
  // yet, and `RouterNavigate.target` takes a component legacyName — aiming it at
  // an invented URL path is the mistake the MCP guidance names outright. The
  // item renders and takes the current-item styling like its siblings; SBR-010
  // adds the one wire and the `deferred` entry that carries it.
];

// ── 8. Admin/NewPageDialog — "New page", as a dialog ────────────────────────

/**
 * SBR-006 §2's third bullet. The two bare inputs that used to sit above the list
 * move in here, and the screen keeps one primary action instead of a form it
 * never asked for.
 *
 * 🔴 **The popup mechanism is real and was measured before this was authored**,
 * because §4 says not to invent one. `NavigationShowPopup` opens a component as
 * an overlay; the viewer installs the popup layer itself, unconditionally, in
 * its constructor (`viewer.jsx:174`), so this does not need a Page Stack and
 * works under a Router. ⚠️ `showPopup` opens with `if (!this.onShowPopup) return;`
 * (`nodecontext.ts:1166`) — a host without that layer drops the popup silently,
 * which is why the caller was checked rather than assumed.
 *
 * ✅ **The ordering that would have made this a repeat of SB-017 §11.1**: the
 * results land and are flagged dirty BEFORE the close action fires
 * (`showpopup.ts:204-210`), so `create` cannot be triggered by `closeAction-create`
 * while `prop-title` is still empty. Measured in the module, not assumed from the
 * port names — this phase has now been bitten twice by a value that arrives after
 * the signal that reads it.
 *
 * ⚠️ Note the two spellings, which are NOT the same port family: Close Popup
 * takes `result-<name>` INPUTS (`closepopup.ts:344`), Show Popup publishes
 * `closeResult-<name>` OUTPUTS (`showpopup.ts:342`).
 */
export const NEW_PAGE_DIALOG_NODES = [
  {
    id: 'layer',
    type: 'Group',
    label: 'Dialog layer',
    // `position: 'fixed'` — "stays put and takes no space"
    // (`node-shared-port-definitions.ts:549`). The runtime's own popup wrapper
    // carries the class `noodl-popup` and NOTHING styles it (grepped: the class
    // is stamped at `nodecontext.ts:1214` and appears in no stylesheet), so
    // centring the card is the author's job and not the layer's.
    parameters: { position: 'fixed', flexDirection: 'column' },
    children: ['card']
  },
  {
    id: 'card',
    type: 'Group',
    label: 'Dialog card',
    parent: 'layer',
    // `alignX`/`alignY` are the platform's centring ports
    // (`node-shared-port-definitions.ts:560-590`) — there are no `top`/`left`
    // offset ports to reach for.
    parameters: {
      ...STACKED,
      width: DIALOG_WIDTH,
      alignX: 'center',
      alignY: 'center',
      flexDirection: 'column',
      rowGap: 'var(--space-4)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['dialogHeading', 'titleField', 'slugField', 'actions']
  },
  {
    id: 'dialogHeading',
    type: 'Text',
    label: 'Dialog heading',
    parent: 'card',
    parameters: {
      ...STACKED,
      text: 'New page',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'titleField',
    type: 'net.noodl.controls.textinput',
    label: 'Title',
    parent: 'card',
    parameters: { useLabel: true, label: 'Title' }
  },
  {
    id: 'slugField',
    type: 'net.noodl.controls.textinput',
    label: 'Slug',
    parent: 'card',
    parameters: { useLabel: true, label: 'Slug' }
  },
  {
    id: 'actions',
    type: 'Group',
    label: 'Dialog actions',
    parent: 'card',
    parameters: { ...STACKED, flexDirection: 'row', alignItems: 'center' },
    children: ['cancelButton', 'createButton']
  },
  {
    id: 'cancelButton',
    type: 'net.noodl.controls.button',
    label: 'Cancel',
    parent: 'actions',
    parameters: { label: 'Cancel' }
  },
  {
    id: 'createButton',
    type: 'net.noodl.controls.button',
    label: 'Create page',
    parent: 'actions',
    parameters: { label: 'Create page' }
  },
  {
    id: 'close',
    type: 'NavigationClosePopup',
    label: 'Close, and say what happened',
    // Both stringlists declare dynamic ports: `results` mints `result-<name>`
    // inputs here and `closeResult-<name>` outputs on the Show Popup node,
    // `closeActions` mints `closeAction-<name>` on both. The host reacts to
    // `create` without knowing anything about this dialog's internals.
    parameters: { results: 'title,slug', closeActions: 'create,cancel' }
  }
];

export const NEW_PAGE_DIALOG_WIRES = [
  { fromId: 'titleField', fromProperty: 'onTextChanged', toId: 'close', toProperty: 'result-title' },
  { fromId: 'slugField', fromProperty: 'onTextChanged', toId: 'close', toProperty: 'result-slug' },
  { fromId: 'createButton', fromProperty: 'onClick', toId: 'close', toProperty: 'closeAction-create' },
  { fromId: 'cancelButton', fromProperty: 'onClick', toId: 'close', toProperty: 'closeAction-cancel' }
];

// ── 9. Pages/SignIn — the way back in ───────────────────────────────────────

/**
 * SBR-017. The template had one auth node in twenty-one components — `SignUp`,
 * on `/Pages/Setup` — and no `Log In` anywhere. An owner who claimed their site
 * and later lost the session had no screen that would take their password, and
 * the one screen that mentions their account cannot help them: `/admin/setup`
 * signs a *second* account up and then correctly refuses to claim an already
 * claimed site, leaving a roleless `_User` row and a locked door. Measured on
 * the drive backend — `POST /users` **201** with a session token, then
 * `POST /functions/claimSite` with that token **400 `This site cannot be
 * claimed.`**
 *
 * ⚠️ **Why three drives missed it.** `SignUp` logs the new user in, so claiming
 * a site and being signed into it were one act; every drive that ran in a single
 * browser session was signed in from its first click and never asked how it got
 * there.
 *
 * 🔴 **The refusal is a constant, and for a *different* reason than
 * {@link CLAIM_REFUSAL_TEXT}'s.** There, F7 made the backend's answer uniform so
 * `claimSite` cannot be asked whether a site is claimed. Here the backend
 * already answers uniformly — Parse returns `Invalid username/password.`
 * whichever half was wrong — so rendering `login.error` would leak nothing. It
 * is still a constant because a sign-in form is the one place where a message
 * that varies invites the reader to *interpret* the variation, and this screen
 * has nothing to say beyond "not these two". If a future backend starts
 * distinguishing the two halves, this parameter does not have to be revisited.
 */
export const SIGNIN_REFUSAL_TEXT = 'That email and password did not match.';

export const SIGN_IN_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Sign in',
    parameters: { title: 'Sign in', urlPath: `${ADMIN_PATH_PREFIX}/signin` },
    children: ['shell']
  },
  {
    id: 'shell',
    type: 'Group',
    label: 'Form',
    parent: 'page',
    // 🔴 `STACKED`, unlike `/Pages/Setup`'s twin of this group, which is in
    // `ADMIN_LAYOUT_OWED` precisely because it grows. A new component is not
    // owed anything: authoring the opt-out here is what keeps that list a
    // record of debt rather than a place new debt gets filed.
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)',
      paddingLeft: 'var(--space-8)',
      paddingRight: 'var(--space-8)',
      rowGap: 'var(--space-3)'
    },
    children: ['heading', 'blurb', 'emailField', 'passwordField', 'signInButton', 'refusal', 'toSetup']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    parameters: {
      ...STACKED,
      text: 'Sign in',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-2xl)',
      // The `monotone-typography` check, answered the same way `/Pages/Setup`
      // answers it: a screen where nothing states a weight measures as unstyled.
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'blurb',
    type: 'Text',
    label: 'Blurb',
    parent: 'shell',
    parameters: {
      ...STACKED,
      text: 'Sign in with the owner account you created when you set this site up.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'emailField',
    type: 'net.noodl.controls.textinput',
    label: 'Email',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Email', type: 'email' }
  },
  {
    id: 'passwordField',
    type: 'net.noodl.controls.textinput',
    label: 'Password',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Password', type: 'password' }
  },
  {
    id: 'signInButton',
    type: 'net.noodl.controls.button',
    label: 'Sign in',
    parent: 'shell',
    parameters: { label: 'Sign in' }
  },
  {
    id: 'refusal',
    type: 'Text',
    label: 'The refusal',
    parent: 'shell',
    parameters: {
      ...STACKED,
      // 🔴 `mounted`, not `visible` — a refusal that has not happened must take
      // no space. `visible: false` keeps the box and the form jumps when the
      // message arrives (P78 D16, in this same template).
      mounted: false,
      text: SIGNIN_REFUSAL_TEXT,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--destructive)'
    }
  },
  {
    id: 'toSetup',
    type: 'Text',
    label: 'Not set up yet',
    parent: 'shell',
    parameters: {
      ...STACKED,
      text: 'Not set up yet? Claim this site.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--primary)',
      marginTop: 'var(--space-4)'
    }
  },
  { id: 'login', type: 'net.noodl.user.LogIn', label: 'Sign in' },
  {
    id: 'attemptState',
    type: 'States',
    label: 'Did the last attempt refuse?',
    // `States` rather than a bare `Condition`, for the reason `/Admin/PageRow`'s
    // `callState` is one: it **resets**. A second attempt that succeeds returns
    // the form to `Quiet`, so a refusal cannot outlive the attempt it was about.
    // ⚠️ On this screen the success arm also navigates away, so the reset is
    // belt-and-braces — but a `Condition` here would leave the refusal standing
    // if navigation were ever made conditional, and that is a silent failure.
    parameters: {
      states: 'Quiet,Refused',
      values: 'refused',
      'type-refused': 'boolean',
      'value-Quiet-refused': false,
      'value-Refused-refused': true
    }
  },
  {
    id: 'goAdmin',
    type: 'RouterNavigate',
    label: 'Into the panel',
    parameters: { router: ROUTER, target: '/Pages/Admin' }
  },
  {
    id: 'goSetup',
    type: 'RouterNavigate',
    label: 'To the claim screen',
    parameters: { router: ROUTER, target: '/Pages/Setup' }
  }
];

export const SIGN_IN_WIRES = [
  // The address is both, exactly as `/Pages/Setup` signs up: `signup` is given
  // the address as its `username` as well as its `email`, and that is the whole
  // reason "sign in with your email" is true here.
  { fromId: 'emailField', fromProperty: 'onTextChanged', toId: 'login', toProperty: 'username' },
  { fromId: 'passwordField', fromProperty: 'onTextChanged', toId: 'login', toProperty: 'password' },
  { fromId: 'signInButton', fromProperty: 'onClick', toId: 'login', toProperty: 'login' },

  // 🔴 `failure`, never `completed`. `completed` fires on every outcome, so it
  // would raise the refusal on the successful sign-in too — the mistake
  // `completed-is-the-outcome-port-that-cannot-mean-success` names, and the one
  // that would make AC2's two paths the same screen.
  { fromId: 'login', fromProperty: 'failure', toId: 'attemptState', toProperty: 'to-Refused' },
  { fromId: 'login', fromProperty: 'done', toId: 'attemptState', toProperty: 'to-Quiet' },
  { fromId: 'attemptState', fromProperty: 'refused', toId: 'refusal', toProperty: 'mounted' },

  { fromId: 'login', fromProperty: 'done', toId: 'goAdmin', toProperty: 'navigate' },
  { fromId: 'toSetup', fromProperty: 'onClick', toId: 'goSetup', toProperty: 'navigate' }
];

// ── The set, in an order the door will accept ────────────────────────────────

/** One component: what to send, and where it lands. */
export interface Sb005Component {
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
   * component that does not exist yet — see `SB005_COMPONENTS`. They are dropped
   * (with every wire touching them) from the create call and restored by an
   * `update_component` afterwards.
   */
  deferred?: string[];
}

/**
 * 🔴 **The order is load-bearing, and no order is sufficient.**
 *
 * Measured s6 against a live server. Both `component`-typed references this
 * panel uses ARE resolved at the door, and both refusals block:
 *   - `For Each.template` → `repeater-template-unresolved`
 *   - `RouterNavigate.target` → `unresolved-navigation`, with a *did you mean*
 * That is welcome, and it is also why a real panel cannot be authored in one
 * pass by **either** door: an admin panel's pages navigate to each other, so the
 * dependency graph has genuine cycles (`PageRow → PageEditor → Admin → PageRow`,
 * and `Admin ⇄ ThemeEditor`). A topological order does not exist.
 *
 * 🔴 And the plan door does **not** rescue it, which is the finding worth
 * carrying: SB-004 §6 F6 measured that a helper named as a node **`type`** IS
 * resolved against an *unapplied sibling* in the same plan. A navigation target
 * is not — `stage_plan_operation` refuses `/Pages/B` while `Pages/B` sits
 * unstaged in the very same plan. So the same door treats three spellings of "a
 * component by name" three different ways: a node `type` resolves against
 * siblings, `RouterNavigate.target` and `For Each.template` resolve only against
 * what is already on disk, and `RunTasks.taskTemplate` is not resolved at all
 * (SB-009). Filed as **SB-012**.
 *
 * The order below is therefore the best one that exists — every forward link
 * resolves — and the two remaining edges are the cycle-closing back buttons,
 * deferred to a second `update_component` pass.
 */
export const SB005_COMPONENTS: Sb005Component[] = [
  {
    // FIRST: `/Pages/ThemeEditor` and `/Pages/Admin` both PLACE this component,
    // so it has to exist before either is written. Its own two nav targets point
    // the other way (at those same two pages), which is what `deferred` is for.
    path: 'Admin/Shell',
    key: 'Admin/Shell',
    legacyName: '/Admin/Shell',
    isPage: false,
    nodes: ADMIN_SHELL_NODES,
    connections: ADMIN_SHELL_WIRES,
    // `goSite` is NOT deferred: `/Pages/Site` belongs to the SB-006 set, which
    // `buildSiteTemplateProject` writes before this one.
    deferred: ['goPages', 'goTheme', 'goSignIn']
  },
  {
    path: 'Admin/SectionRow',
    key: 'Admin/SectionRow',
    legacyName: '/Admin/SectionRow',
    isPage: false,
    nodes: SECTION_ROW_NODES,
    connections: SECTION_ROW_WIRES
  },
  {
    path: 'Pages/PageEditor',
    key: 'Pages/PageEditor',
    legacyName: '/Pages/PageEditor',
    isPage: true,
    nodes: PAGE_EDITOR_NODES,
    connections: PAGE_EDITOR_WIRES,
    // `/Pages/Admin` does not exist yet, and cannot: it needs `/Admin/PageRow`,
    // which needs this component.
    deferred: ['goBack']
  },
  {
    path: 'Admin/PageRow',
    key: 'Admin/PageRow',
    legacyName: '/Admin/PageRow',
    isPage: false,
    nodes: PAGE_ROW_NODES,
    connections: PAGE_ROW_WIRES
  },
  {
    path: 'Pages/ThemeEditor',
    key: 'Pages/ThemeEditor',
    legacyName: '/Pages/ThemeEditor',
    isPage: true,
    nodes: THEME_EDITOR_NODES,
    connections: THEME_EDITOR_WIRES,
    deferred: ['goBack']
  },
  {
    // Before `/Pages/Admin`, which names it as a Show Popup target.
    path: 'Admin/NewPageDialog',
    key: 'Admin/NewPageDialog',
    legacyName: '/Admin/NewPageDialog',
    isPage: false,
    nodes: NEW_PAGE_DIALOG_NODES,
    connections: NEW_PAGE_DIALOG_WIRES
  },
  {
    path: 'Pages/Admin',
    key: 'Pages/Admin',
    legacyName: '/Pages/Admin',
    isPage: true,
    nodes: ADMIN_NODES,
    connections: ADMIN_WIRES
  },
  {
    // Before `/Pages/Setup`, so that Setup's "already set up? sign in" link
    // resolves on the create pass. The reverse edge — this screen's link back to
    // the claim screen — is the one that cannot, and it is `deferred`.
    path: 'Pages/SignIn',
    key: 'Pages/SignIn',
    legacyName: '/Pages/SignIn',
    isPage: true,
    nodes: SIGN_IN_NODES,
    connections: SIGN_IN_WIRES,
    deferred: ['goSetup']
  },
  {
    path: 'Pages/Setup',
    key: 'Pages/Setup',
    legacyName: '/Pages/Setup',
    isPage: true,
    nodes: SETUP_NODES,
    connections: SETUP_WIRES
  }
];

/** The create-pass payload: the component minus whatever it cannot name yet. */
export function createPass(c: Sb005Component): { nodes: unknown[]; connections: unknown[] } {
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

