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

import {
  SITE_THEME_PRESETS,
  SITE_THEME_PRESET_LABELS,
  THEME_TOKEN_FIELDS,
  ThemeField,
  buildThemeApplierScript
} from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
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
/**
 * SBR-007 AC2. The write half of reordering is cloud-only because it renumbers
 * SIBLINGS and the browser runtime has no loop node — see the endpoint's own
 * note in `sb004Components.ts`.
 */
export const FN_REORDER = 'reorderSection';

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

// ── The control treatments (REL-011a) ────────────────────────────────────────

/**
 * 🔴 **The template placed 53 interactive controls and dressed one of them.**
 * Phase 82's REL-011a; the census is `sbr014ControlStyleCensus.test.ts`, and it
 * was written to red at HEAD — **1 of 53** — before any of this existed.
 *
 * The controls are the only nodes in the template that arrive already painted,
 * and what they arrive painted as is the browser's idea of a form: an `<input>`
 * with `background-color: transparent` and `border-style: none`, and a `<button>`
 * that is `black` with `white` text and square corners. Every `Text` and `Group`
 * beside them was tokenised from the first commit; these were skipped because
 * they *looked* finished — a control with no parameters still renders something,
 * which is exactly what makes this defect survive a review.
 *
 * 🔴 **Rendered, a text input in this template is not there at all.** Confirmed
 * three independent ways before a line was changed: the node's own default
 * (`backgroundColor: 'transparent'`, border width 0), the runtime stylesheet
 * (`.ndl-controls-textinput { border-style: none; background-color: transparent }`),
 * and the photograph the row was opened on — *"Your name / Your email / Your
 * message"* over blank ground. Under the bar Richard set for 0.2.2 — *"you can
 * at least see the elements clearly and interact"* — that one fact is the whole
 * difference between SHITTY and PASSABLE.
 *
 * ⚠️ **The dropdown and the checkbox were NOT part of that defect**, and REL-011
 * §2's *"53 controls, 3 styled"* reads as though they were. Both draw a 2px box
 * at their own node defaults. They take the treatments below to join the
 * palette, not to become visible, and this comment is the record of that
 * difference so a later session does not cite them as evidence of the fix.
 *
 * ⚠️ **`fontFamily` is deliberately absent from all four.** `assets/style.css`
 * gives both classes `font-family: inherit` (P78 D18), so the controls already
 * render in the project's face; setting the port would restate a correct value
 * and move the census's number without moving a pixel. `fontSize` is here for
 * the opposite reason — the same stylesheet inherits family and, in its own
 * words, *deliberately not size*, so every control's text sits at the user
 * agent's ~13px beside a `Text` at `--text-base`.
 */
export const FIELD = {
  // 🔴 **Found by looking at the render, not by reasoning about it.** With the
  // border drawn, the first after-arm showed three ~205px fields adrift in a
  // 700px card — a `textinput` defaults to `contentSize`, so it had always been
  // that narrow and nobody could see it while it was invisible. `contentHeight`
  // stops the node assigning its own height but keeps it assigning width, which
  // is what lets the explicit 100% span the column (see {@link STACKED}).
  //
  // ✅ Not invented here: `templates/members-area` reached the same eleven-line
  // treatment independently — same background, border stack, radius, padding,
  // size and colour, down to the token names — and it is the template Richard
  // rates. Its `Pages/SignIn` field is the pattern this matches.
  //
  // ⚠️ **`sizeMode` alone, with NO `width`** — and that is a deliberate
  // departure from the members-area, which sets `width: 100%` beside it. Adding
  // the width here reddened `sbr012RawColourGate` with **26 new raw dimensions**
  // and `sb006PublicSite` with three more, and the only way to keep it would
  // have been twenty-six copies of one exemption reason. `contentHeight` stops
  // the node assigning its own HEIGHT and leaves it assigning WIDTH, so down a
  // column the field spans the column on its own (see {@link STACKED}). The
  // width was redundant; the render is what says so.
  sizeMode: 'contentHeight',
  // The card these sit on is `--surface`; the field is the step below it, and
  // the border is what actually draws the edge on a preset where the two are
  // close (Studio: #ffffff card, #fbfaf8 field, #e3ded4 border).
  backgroundColor: 'var(--background)',
  borderStyle: 'solid',
  borderWidth: 'var(--border-1)',
  borderColor: 'var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--foreground)',
  fontSize: 'var(--text-base)',
  // 🔴 The wrapper has no padding of its own, so without these the text would
  // sit against the border this treatment just drew.
  paddingLeft: 'var(--space-3)',
  paddingRight: 'var(--space-3)',
  paddingTop: 'var(--space-2)',
  paddingBottom: 'var(--space-2)'
} as const;

/**
 * The one action a screen is asking for: submit, save, publish, create.
 *
 * ⚠️ Padding is **not** set here. `.ndl-controls-button` already supplies
 * `5px 20px`, and overriding it is a change to every button's metrics that no
 * measurement asked for — the same reasoning the stylesheet's own comment gives
 * for not inheriting `font-size` there.
 */
export const PRIMARY_BUTTON = {
  backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--font-semibold)'
} as const;

/**
 * Everything a screen offers but is not asking for: cancel, back, move, edit.
 *
 * A bordered chip rather than a second filled colour — on an admin row the
 * ground is already `--surface`, so the border is what separates the control
 * from the card, and two filled colours side by side would make every row look
 * like it had two primary actions.
 */
export const SECONDARY_BUTTON = {
  backgroundColor: 'var(--surface)',
  color: 'var(--foreground)',
  borderStyle: 'solid',
  borderWidth: 'var(--border-1)',
  borderColor: 'var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)'
} as const;

/**
 * `Delete` alone. The shape of {@link SECONDARY_BUTTON} with the label in
 * `--destructive`, rather than a filled red block: the destructive action on a
 * section row is one of six controls in that row, and a filled red would make
 * it the loudest thing on a screen whose actual subject is the page's content.
 */
export const DESTRUCTIVE_BUTTON = {
  ...SECONDARY_BUTTON,
  color: 'var(--destructive)'
} as const;

/**
 * The one checkbox, `Show in navigation`.
 *
 * ⚠️ Three ports, not eleven, and the difference is the point: a checkbox draws
 * its own 32×32 box from node defaults (`solid`, 2px, `#000000`, radius 3) and
 * has no `color`/`fontSize` of its own — its text is the `<label>` beside it,
 * which inherits the page. So it was never invisible. This treatment moves it
 * off a raw black edge onto the palette and does nothing else.
 */
export const CHECKBOX = {
  backgroundColor: 'var(--background)',
  borderColor: 'var(--border)',
  borderRadius: 'var(--radius-md)'
} as const;

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
  },
  {
    component: 'Pages/ThemeEditor',
    label: 'Fields column',
    why: 'SBR-009 puts the preview beside the fields, and two filling columns in a row are a half each — an authored width here would be a raw PERCENTAGE, a proportion of a pane rather than a distance, which is the one quantity the token vocabulary has no name for'
  },
  {
    component: 'Pages/ThemeEditor',
    label: 'Preview column',
    why: 'the other half of the same split — it grows for the same reason and stating a width on one column and not the other would make the pair depend on which one was authored'
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

/**
 * Sections render in `order`, which is what makes a page a page.
 *
 * 🔴 **Defined here rather than in `sb006Components.ts` so that BOTH queries can
 * share one copy.** `/Pages/Site` and `/Pages/PageEditor` must sort the same way
 * or the editor draws a list nobody else uses — D30. sb006 already imports from
 * this module (`ROUTER`), and it uses `ROUTER` at module-eval time, so the
 * dependency cannot run the other way without a cycle; sb006 re-exports this the
 * same way it re-exports `ROUTER`, so its own consumers are unaffected.
 */
export const SECTION_SORT = [{ property: 'order', order: 'ascending' }];

/**
 * Messages come back newest first — SBR-010 AC4.
 *
 * `createdAt` is a field no component writes: Parse mints it on every row and
 * `_fromJSON` copies it onto the model like any other key. Sorting on it is
 * therefore free, and it is the only ordering a list of enquiries can have that
 * does not depend on the owner maintaining something.
 *
 * ⚠️ Held here beside {@link SECTION_SORT} rather than inline for the same
 * reason that one is: a sort a second reader copies is a sort that drifts. There
 * is one reader today and the constant is what keeps a second one honest.
 */
export const MESSAGE_SORT = [{ property: 'createdAt', order: 'descending' }];

/**
 * SB-004 §2's discriminator vocabulary, in the order a page most often uses it.
 *
 * 🔴 **SBR-005 gave every one of these a component of its own, so the list stopped
 * being a label and became a dispatch.** It lives here for the same reason
 * `SECTION_SORT` does — `sb006Components.ts` already imports from this module and
 * uses it at module-eval time, so the dependency cannot run the other way — and
 * sb006 re-exports it. The panel's kind picker and the public site's dispatch
 * script both read it, and `sbr005Sections.test.ts` asserts that both name every
 * member: a sixth kind that reached only one of them is a section an author can
 * create and the site cannot draw.
 */
export const SECTION_KINDS = ['hero', 'gallery', 'cta', 'richText', 'contact'] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/**
 * The kind a section falls back to when its record does not say one, or says one
 * nothing has heard of.
 *
 * 🔴 It is `richText` and not "nothing", because a `Section` written before
 * SBR-005 has no `kind` a dispatch would recognise and must still render as the
 * body copy it has always been. A fallback of "draw nothing" would silently
 * empty every page on the day the template shipped.
 */
export const DEFAULT_SECTION_KIND: SectionKind = 'richText';

/** The picker's rows: the vocabulary above, with the words an author reads. */
export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  hero: 'Hero',
  gallery: 'Gallery',
  cta: 'Call to action',
  richText: 'Rich text',
  contact: 'Contact'
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
  { id: 'editButton', type: 'net.noodl.controls.button', label: 'Edit', parent: 'row', parameters: { ...SECONDARY_BUTTON, label: 'Edit' } },
  {
    id: 'menuButton',
    type: 'net.noodl.controls.button',
    label: 'More actions',
    parent: 'row',
    // SBR-006 §2: publish/unpublish/duplicate move off the row and behind one
    // control, because four buttons per row IS the current design and the task
    // is to stop it being that.
    parameters: { ...SECONDARY_BUTTON, label: 'More' }
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
    parameters: { ...PRIMARY_BUTTON, label: 'Publish' }
  },
  {
    id: 'unpublishButton',
    type: 'net.noodl.controls.button',
    label: 'Unpublish',
    parent: 'menu',
    parameters: { ...SECONDARY_BUTTON, label: 'Unpublish' }
  },
  {
    id: 'duplicateButton',
    type: 'net.noodl.controls.button',
    label: 'Duplicate',
    parent: 'menu',
    parameters: { ...SECONDARY_BUTTON, label: 'Duplicate' }
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
  // ── SBR-007 AC2's gesture. It is a drag, and it is arithmetic in the graph ──
  //
  // 🔴 **This node is the whole of the runtime change AC2 needed, which is none.**
  // The row's visual root is a `Drag` wrapping the card; `Drag` renders no
  // element of its own (`Drag.tsx` delegates `draggableNodeRef` to
  // `children[0].getDOMElement()`), so the card is still the box that lays out
  // and still carries every style parameter below. Driven in a browser with a
  // synthesised pointer: `ac2DragGestureDrive.test.ts`.
  //
  // `axis: 'y'` because a list reorders on one axis. `useParentBounds: false`
  // is the value that was DRIVEN rather than the default — a row that escapes
  // the list mid-gesture snaps back, and pinning the gesture to a container
  // exactly as tall as its rows was what made the first drive read zero.
  //
  // ⚠️ **A `Drag` child loses its `cssClassName`** — `react-draggable` clones it
  // away. Nothing here sets one, but anyone adding a class to the card will find
  // it silently absent from the DOM. That is **D28**.
  {
    id: 'drag',
    type: 'Drag',
    label: 'Drag this section to reorder it',
    parameters: { axis: 'y', useParentBounds: false },
    children: ['row']
  },
  {
    id: 'row',
    type: 'Group',
    label: 'One section',
    parent: 'drag',
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
    children: [
      'kindText',
      'moveRow',
      'headingField',
      'bodyField',
      'linkLabelField',
      'linkTargetField',
      'preview',
      'galleryCount',
      'pickButton',
      'removeImageButton',
      'saveButton',
      'deleteButton'
    ]
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
  // ── The buttons, kept beside the drag rather than replaced by it ──────────
  //
  // 🔴 **The comment that stood here was wrong, and it was wrong in the way
  // that costs most.** It said "no node in the viewer reports its own rendered
  // geometry to the graph", filed that as **D23**, and turned an unbuilt
  // gesture into a product blocker nobody owned. All 27 box-drawing visual
  // nodes have carried four `Bounding Box` outputs the whole time, and D23 is
  // disproved and kept as evidence. Its proposed fix — a `domelement` output on
  // `Group` — would have shipped the product's second unconnectable port (D27).
  //
  // Its LAST clause was true and is the one that mattered: these rows are
  // genuinely not uniform, so there is no pitch to divide by. What `dropIndex`
  // below does instead is count the siblings whose centre is above the dragged
  // card's — which needs no pitch, and is therefore indifferent to the clause
  // that survived.
  //
  // ✅ **The buttons stay.** A drag is not reachable from a keyboard, and AC2
  // is about a client changing the order — not about the pointer they do it
  // with. Both routes hand the same endpoint the same `toIndex`.
  {
    id: 'moveRow',
    type: 'Group',
    label: 'Move this section',
    parent: 'row',
    parameters: { ...STACKED, flexDirection: 'row', columnGap: 'var(--space-2)' },
    children: ['moveUpButton', 'moveDownButton']
  },
  {
    id: 'moveUpButton',
    type: 'net.noodl.controls.button',
    label: 'Move up',
    parent: 'moveRow',
    parameters: { ...IN_A_ROW, ...SECONDARY_BUTTON, label: 'Move up' }
  },
  {
    id: 'moveDownButton',
    type: 'net.noodl.controls.button',
    label: 'Move down',
    parent: 'moveRow',
    parameters: { ...IN_A_ROW, ...SECONDARY_BUTTON, label: 'Move down' }
  },
  // ── SBR-005 AC5's authoring half ──────────────────────────────────────────
  //
  // 🔴 **The old comment on `Site/SectionView` said the five kinds could differ
  // only in which of `body` and `image` they show, "because a section view that
  // read `data.heading` would be reading a field with no author".** That was
  // true and it was a statement about THIS component, not about the product.
  // These four fields are the author it was missing.
  //
  // ⚠️ **Conditional through `mounted`, not `visible`** — the same rule the
  // public site follows, and for the stronger reason here: a `visible: false`
  // field still holds its row height, so a `richText` card would carry two empty
  // bands where a CTA's link fields would go.
  {
    id: 'headingField',
    type: 'net.noodl.controls.textinput',
    label: 'Heading',
    parent: 'row',
    parameters: { ...FIELD, useLabel: true, label: 'Heading' }
  },
  {
    id: 'bodyField',
    type: 'net.noodl.controls.textinput',
    label: 'Body',
    parent: 'row',
    parameters: { ...FIELD, useLabel: true, label: 'Body', type: 'textArea' }
  },
  {
    id: 'linkLabelField',
    type: 'net.noodl.controls.textinput',
    label: 'Button label',
    parent: 'row',
    // Only a `cta` has a button, so only a `cta` row offers the two fields that
    // describe one. `unpack` publishes the boolean.
    parameters: { ...FIELD, useLabel: true, label: 'Button label', mounted: false }
  },
  {
    id: 'linkTargetField',
    type: 'net.noodl.controls.textinput',
    label: 'Button goes to',
    parent: 'row',
    // The one control on this panel whose value is read by a *branch* rather
    // than displayed: `Site/CtaSection`'s `route` treats an `https://` value as
    // the open web and anything else as a page slug on this site.
    parameters: {
      ...FIELD,
      useLabel: true,
      label: 'Button goes to (a page slug, or an https:// address)',
      mounted: false
    }
  },
  {
    id: 'preview',
    type: 'Image',
    label: 'Image preview',
    parent: 'row',
    // 🔴 **REL-011c A2 — the page editor's whole horizontal overflow was this
    // node's EMPTY parameter bag.** `Image` defaults to `contentSize`
    // (`image.ts:176`), so the node took its SOURCE's intrinsic width and
    // `layout.ts:82` left it `flexShrink: 0`. The look harness's swatch is
    // 1200×600, so the card was 1216px wide at every viewport — and a client's
    // phone photograph is three times that.
    //
    // Measured on the deployed bundle at four widths before the fix
    // (`main` is `/Admin/Shell`'s `Admin content`, `body` the editor column):
    //
    //   1900 → main 1660, body 1596 — everything on screen
    //   1280 → main 1280, body 1216, document 1520 wide
    //    988 → main  988, body  924 holding 1217px of content
    //    390 → main  390, body  326 holding 1217px of content
    //
    // 🔴 The arithmetic that ties it together: `min-width: auto` on a flex item
    // is `min(its own stated width, its content minimum)`, and `Admin content`'s
    // content minimum was **1280** — 64px of its own padding plus this card's
    // 1216. Above 1280 the rail's 240px comes out of the content column
    // correctly; at or below it, `main` stops shrinking and the rail is pushed
    // off the right edge instead. That is why the fields DID narrow (763 → 573)
    // while `Save page` sat at x=1370 on a 1280px screen: two different boxes,
    // one of them clamped.
    //
    // The treatment is the one this template's other `Image` already carries
    // (`/Site/GalleryTile`), and `members-area`'s tile photograph independently:
    // an explicit box with `objectFit: 'cover'`.
    // ⚠️ The door refuses `objectFit` without `sizeMode: 'explicit'`
    // (`inert-dimension`, blocking), and a bare number on a dimension port reads
    // as a PERCENTAGE (`unitless-dimension`).
    //
    // 🔴 `mounted: false` with a wire raising it, and it is not tidiness: an
    // explicit 180px box draws 180px of empty ground on every section that has
    // no picture — which, before A5 below, was every gallery. `visible` would
    // keep the band; `mounted` is the rule the rest of this card already follows.
    parameters: {
      mounted: false,
      sizeMode: 'explicit',
      objectFit: 'cover',
      width: { value: 100, unit: '%' },
      height: { value: 180, unit: 'px' },
      borderRadius: 'var(--radius-md)'
    }
  },
  {
    id: 'galleryCount',
    type: 'Text',
    label: 'How many pictures',
    parent: 'row',
    // 🔴 SB-018 (3): a standing `text`. A `Text` whose only `text` is a wire
    // renders the literal word "Text" until that wire publishes.
    parameters: {
      ...STACKED,
      text: '',
      mounted: false,
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'pickButton',
    type: 'net.noodl.controls.button',
    label: 'Choose image',
    parent: 'row',
    parameters: { ...SECONDARY_BUTTON, label: 'Choose image' }
  },
  {
    id: 'removeImageButton',
    type: 'net.noodl.controls.button',
    label: 'Remove last picture',
    parent: 'row',
    // A gallery is the only kind that accumulates, so it is the only kind that
    // needs an undo. For every other kind the next upload replaces the picture.
    parameters: { ...SECONDARY_BUTTON, label: 'Remove last picture', mounted: false }
  },
  { id: 'saveButton', type: 'net.noodl.controls.button', label: 'Save', parent: 'row', parameters: { ...PRIMARY_BUTTON, label: 'Save' } },
  {
    id: 'deleteButton',
    type: 'net.noodl.controls.button',
    label: 'Delete',
    parent: 'row',
    parameters: { ...DESTRUCTIVE_BUTTON, label: 'Delete' }
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
    label: 'Read this section out of data, and decide which controls it needs',
    parameters: {
      // ⚠️ No `runOnChange-*` guards here, unlike `merge` below, and the
      // difference is which direction the node points. This one only READS the
      // record into the controls; it has to run when `data` arrives or the
      // fields never get their starting values. `merge` writes back, which is
      // what makes a load-time run a save loop (D31).
      functionScript:
        'const d = Inputs.data || {};\n' +
        "const kind = Inputs.kind || 'richText';\n" +
        // 🔴 **REL-011c A6.** The card's own heading used to be wired straight
        // from `inputs.kind`, so a section card was headed `richText` while the
        // `Kind` picker two lines above it offered `Rich text` — two vocabularies
        // for one thing, on one screen. The map is DERIVED from
        // {@link SECTION_KIND_LABELS} rather than retyped here, for the same
        // reason `kindItems` derives its list: a hand-written second copy offers
        // the author a word the site does not know on the first day they disagree.
        'const LABELS = ' +
        JSON.stringify(SECTION_KIND_LABELS) +
        ';\n' +
        'Outputs.kindLabel = LABELS[kind] || kind;\n' +
        "Outputs.heading = d.heading || '';\n" +
        "Outputs.body = d.body || '';\n" +
        "Outputs.linkLabel = d.linkLabel || '';\n" +
        "Outputs.linkTarget = d.linkTarget || '';\n" +
        '\n' +
        // SBR-005. The gallery's pictures live on the same record, in the same
        // `data` column, under the same row ACL as the single `image` — which is
        // the whole of AC5's "the ACL treatment must match the existing image
        // path". There is no second class and no second policy.
        'const images = Array.isArray(d.images) ? d.images : [];\n' +
        "const isGallery = kind === 'gallery';\n" +
        "const isCta = kind === 'cta';\n" +
        'Outputs.isGallery = isGallery;\n' +
        'Outputs.isCta = isCta;\n' +
        // 🔴 **REL-011c A5, and the picture was the half that was wrong.** The
        // preview was fed `d.image` for EVERY kind — and `absorb` below never
        // writes `image` on a gallery, it pushes onto `images`. So a gallery
        // built through the product showed **no picture at all** beside a count
        // that said `3 pictures`, and the seeded state the row was photographed
        // on (a legacy `image`, an empty `images`) showed the opposite: a
        // rendered picture over the words *"No pictures yet"*. One derivation
        // settles both — a gallery's picture is the LAST of `images`, which is
        // also the one `Remove last picture` takes back, so what is on the card
        // is what the button acts on.
        //
        // ⚠️ A `cloudfile` renders through its `url`; an unset one must not
        // become the string "undefined" on an Image's `src`.
        'const shown = isGallery ? images[images.length - 1] : d.image;\n' +
        "Outputs.image = (shown && shown.url) || '';\n" +
        // The preview box is explicit now, so "no picture" has to be an absent
        // node rather than an empty one — see the note on `preview`.
        "Outputs.hasImage = Outputs.image !== '';\n" +
        // Only a gallery accumulates, so only a gallery can have a last picture
        // to take back.
        'Outputs.canRemove = isGallery && images.length > 0;\n' +
        'Outputs.count =\n' +
        "  images.length === 0 ? 'No pictures yet' : images.length === 1 ? '1 picture' : images.length + ' pictures';"
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
      // 🔴 **D31, and the three keys are FIRST in the bag deliberately.**
      // `NodeScope.setNodeParameters` drains queued values in the bag's own key
      // order, so a `runOnChange-*` that landed AFTER the value it governs lets
      // the load-time run it exists to prevent happen once anyway.
      //
      // Absent reads as TICKED (`run-on-value-change.ts`), and ticked is a
      // cycle: `merge.out-built → save.store` writes the section,
      // `SetDbModelProperties` writes into the very model `For Each` feeds this
      // row's `data` from, and `merge` builds a FRESH object every run — so the
      // value always counts as changed and the node runs again. Opening the
      // page editor on a page with sections produced 115,755 write errors in
      // eleven seconds with nobody touching the screen, until the backend's
      // rate limiter refused the page's own section query too.
      //
      // `run` is left as the only trigger, which it already has
      // (`saveButton.onClick`, `upload.done`) — the same repair the queries and
      // the two planners in this file make, and exactly what the editor's
      // NDA-017 migration writes onto this node the first time the project is
      // opened. The artefact used to ship without them.
      // 🔴 **One key per value input, and SBR-005 is the session that proved the
      // list has to grow with them.** The three fields it added — `heading`,
      // `linkLabel`, `linkTarget` — shipped without their keys for one run and
      // `sb007Template.test.ts`'s D32 write-back arm named all three: *"writes
      // `Section` and is fed it AS A REPEATER ITEM"*. That is the 115,755-writes
      // cycle below, three new ways in, and no other gate in the repository saw
      // it. **A new value input on a repeater-item write-back node owes a key.**
      'runOnChange-in-data': false,
      'runOnChange-in-body': false,
      'runOnChange-in-heading': false,
      'runOnChange-in-linkLabel': false,
      'runOnChange-in-linkTarget': false,
      // Two producers reach this node — the record's own `data` and whatever the
      // author has changed since — so it guards, per rule 2. Every field is
      // legitimately an empty string, so the test is `undefined`.
      //
      // 🔴 **A MISSING `data` IS NOT A RECORD THAT HAS NOT ARRIVED — it is the
      // normal state of a section nobody has typed into yet, and the two were
      // the same test until SBR-014's drive (s46).** A `Section` row created by
      // the panel carries `order`, `pageId` and `kind` and nothing else, so
      // `Inputs.data` is `undefined`, the script returned before
      // `Outputs.built()`, and `store` never fired. The field that would create
      // the column was only ever written by the save that refused to run: five
      // sections, five `Save` clicks, **zero requests** — measured against the
      // same button firing a PUT the moment a `data` object existed.
      //
      // Every input here is only ever reached by the `run` signal
      // (`runOnChange-*` is false on all five), so there is no init pass to
      // guard against: treating an absent record as an empty one is safe and is
      // what lets the first save bootstrap the column.
      functionScript:
        'const next = Object.assign({}, Inputs.data || {});\n' +
        "if (Inputs.body !== undefined) next.body = Inputs.body;\n" +
        "if (Inputs.heading !== undefined) next.heading = Inputs.heading;\n" +
        "if (Inputs.linkLabel !== undefined) next.linkLabel = Inputs.linkLabel;\n" +
        "if (Inputs.linkTarget !== undefined) next.linkTarget = Inputs.linkTarget;\n" +
        'Outputs.data = next;\n' +
        'Outputs.built();'
    }
  },
  // ── SBR-005. The picture path, which is now two paths and one upload ───────
  //
  // 🔴 **The uploaded file is folded HERE and not in `merge`, and that is a
  // defect avoided rather than a preference.** `merge` runs on the save press
  // *and* on `upload.done`, and it held the uploaded `cloudFile` on a value
  // input — which is harmless while the fold is `next.image = file` (idempotent)
  // and is a bug the moment it becomes `images.push(file)`: every subsequent
  // save would append the same picture again. Splitting the append onto a node
  // whose only trigger IS the upload makes "a picture arrived" and "the author
  // pressed Save" two different events again.
  //
  // ⚠️ Which of the two fields it lands in is the kind's decision, and it is
  // made once, here. A `gallery` accumulates; every other kind replaces.
  {
    id: 'absorb',
    type: 'JavaScriptFunction',
    label: 'Fold an uploaded picture into this section',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // D31, exactly as on `merge`: this node writes into the very model
      // `For Each` feeds this row's `data` from, so a value-change run is a
      // save loop. `upload.done` is the only trigger.
      'runOnChange-in-data': false,
      'runOnChange-in-kind': false,
      'runOnChange-in-image': false,
      functionScript:
        // Same bootstrap as the text builder above: a section that has never
        // been saved has no `data`, and refusing to run here made the first
        // picture unaddable for the same reason the first heading was.
        'const file = Inputs.image;\n' +
        'if (file === undefined || file === null) return;\n' +
        'const next = Object.assign({}, Inputs.data || {});\n' +
        "if ((Inputs.kind || 'richText') === 'gallery') {\n" +
        '  const images = Array.isArray(next.images) ? next.images.slice() : [];\n' +
        // The row shape the gallery's `For Each` reads: a plain `{ url }`, so the
        // tile's declared `url` port matches a model field by name
        // (`foreach.tsx:595-597`).
        "  images.push({ url: (file && file.url) || '' });\n" +
        '  next.images = images;\n' +
        '} else {\n' +
        '  next.image = file;\n' +
        '}\n' +
        'Outputs.data = next;\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'dropLast',
    type: 'JavaScriptFunction',
    label: 'Take back the last picture',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      'runOnChange-in-data': false,
      functionScript:
        'if (Inputs.data === undefined) return;\n' +
        'const next = Object.assign({}, Inputs.data);\n' +
        'const images = Array.isArray(next.images) ? next.images.slice() : [];\n' +
        'if (images.length === 0) return;\n' +
        'images.pop();\n' +
        'next.images = images;\n' +
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
    id: 'dropIndex',
    type: 'JavaScriptFunction',
    label: 'Which position did this section land on',
    // 🔴 **The gesture's whole brain, and it needs nothing the runtime does not
    // already ship.** `Inputs.el` is the CARD's `this` — a `reference` output on
    // every visual node — and a `Function` node's author-declared input is `*`,
    // which `canCastPortTypes` accepts from anything. `getDOMElement()` on the
    // far side is the same accessor `Group.tsx`'s own `Scroll To Element` uses.
    //
    // 🔴 **`el.parentElement` must contain the rows and NOTHING ELSE**, which is
    // why `sectionRows` exists on the page editor. A `For Each` renders its items
    // into its visual parent's element, so with the For Each still sitting
    // directly under `sectionsPanel` this would have counted the header and the
    // refusal line as rows and reported an index two too high. The drive's `pc=`
    // reading is the control that catches exactly this.
    //
    // `runOnChange-in-el: false` for the same reason as the two planners below:
    // the element reference lands when the row mounts, and a script that ran on
    // arrival would fire on every redraw rather than on a release.
    ports: [
      { name: 'out-go', plug: 'output', type: 'signal' },
      { name: 'out-snap', plug: 'output', type: 'signal' }
    ],
    parameters: {
      'runOnChange-in-el': false,
      functionScript:
        'if (Inputs.el === undefined) return;\n' +
        'const el = Inputs.el.getDOMElement && Inputs.el.getDOMElement();\n' +
        'if (!el || !el.parentElement) return;\n' +
        // Snap first and unconditionally. `Drag` leaves the element translated
        // where the pointer dropped it and nothing in the runtime puts it back,
        // so a drop that does NOT move the section still owes the row its
        // position — otherwise the card stays where it was let go and the next
        // gesture measures from a lie.
        'Outputs.snap();\n' +
        'const kids = Array.prototype.slice.call(el.parentElement.children);\n' +
        'const mine = el.getBoundingClientRect();\n' +
        'const centre = mine.top + mine.height / 2;\n' +
        'const own = kids.indexOf(el);\n' +
        'let to = 0;\n' +
        'for (let i = 0; i < kids.length; i++) {\n' +
        '  if (kids[i] === el) continue;\n' +
        '  const r = kids[i].getBoundingClientRect();\n' +
        '  if (r.top + r.height / 2 < centre) to++;\n' +
        '}\n' +
        // A drag that ends where it started is not a request. Guarded return, so
        // neither `go` nor a write happens — the same discipline `moveUp` applies
        // to a row already at the top.
        'if (to === own) return;\n' +
        'Outputs.toIndex = to;\n' +
        'Outputs.go();'
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Tell the editor something changed',
    // 🔴 `MoveUp`/`MoveDown` leave the row rather than calling the endpoint
    // here, and that is the only place the call CAN live. A row knows its own
    // `order` and nothing about its siblings', so it cannot turn "up" into a
    // position — `order - 1` is only the row above when `order` happens to be
    // contiguous, which nothing guarantees (`addSection` writes `count`, and a
    // delete leaves a gap). The editor holds the whole sorted list; the row
    // does not. `For Each` carries both halves out together: it flags every
    // `itemOutput-…` dirty and THEN sends `itemOutputSignal-…`, in one
    // scheduled pass (`foreach.tsx:905-928`), so `itemActionItemId` has landed
    // by the time the signal arrives.
    ports: [
      { name: 'Changed', type: 'signal', plug: 'input' },
      { name: 'MoveUp', type: 'signal', plug: 'input' },
      { name: 'MoveDown', type: 'signal', plug: 'input' },
      // The drag's pair. `DropIndex` is a VALUE and `DropAt` is the signal, and
      // they must be that way round: `For Each` flags every `itemOutput-…` dirty
      // and THEN sends `itemOutputSignal-…`, in one scheduled pass
      // (`foreach.tsx:915-928`), so the index has landed by the time the call
      // fires. A single signal carrying the number could not exist.
      { name: 'DropAt', type: 'signal', plug: 'input' },
      { name: 'DropIndex', type: 'number', plug: 'input' }
    ]
  }
];

export const SECTION_ROW_WIRES = [
  // 🔴 REL-011c A6: the human word, not the discriminator. `unpack` runs the
  // moment either `kind` or `data` arrives (it carries no `runOnChange` guards,
  // deliberately — see its note), so the card is headed before it is painted;
  // `kindText`'s standing `text: ''` is what covers the gap, per SB-018 (3).
  { fromId: 'unpack', fromProperty: 'out-kindLabel', toId: 'kindText', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'unpack', toProperty: 'in-data' },
  { fromId: 'inputs', fromProperty: 'kind', toId: 'unpack', toProperty: 'in-kind' },
  { fromId: 'unpack', fromProperty: 'out-heading', toId: 'headingField', toProperty: 'startValue' },
  { fromId: 'unpack', fromProperty: 'out-body', toId: 'bodyField', toProperty: 'startValue' },
  { fromId: 'unpack', fromProperty: 'out-linkLabel', toId: 'linkLabelField', toProperty: 'startValue' },
  { fromId: 'unpack', fromProperty: 'out-linkTarget', toId: 'linkTargetField', toProperty: 'startValue' },
  { fromId: 'unpack', fromProperty: 'out-image', toId: 'preview', toProperty: 'src' },
  { fromId: 'unpack', fromProperty: 'out-hasImage', toId: 'preview', toProperty: 'mounted' },

  // SBR-005. Which controls this kind actually has — `mounted`, so an absent
  // control costs no row height and leaves nothing behind in the DOM.
  { fromId: 'unpack', fromProperty: 'out-isCta', toId: 'linkLabelField', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isCta', toId: 'linkTargetField', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-isGallery', toId: 'galleryCount', toProperty: 'mounted' },
  { fromId: 'unpack', fromProperty: 'out-count', toId: 'galleryCount', toProperty: 'text' },
  { fromId: 'unpack', fromProperty: 'out-canRemove', toId: 'removeImageButton', toProperty: 'mounted' },

  { fromId: 'pickButton', fromProperty: 'onClick', toId: 'picker', toProperty: 'open' },
  { fromId: 'picker', fromProperty: 'file', toId: 'upload', toProperty: 'file' },
  // `done`, not `completed`: a cancelled picker must not start an upload of
  // nothing. `Upload File` defers nothing on this author's behalf, but both
  // wires leave the same node in the same pass and `file` is a value the picker
  // sets before it reports.
  { fromId: 'picker', fromProperty: 'done', toId: 'upload', toProperty: 'upload' },

  // The words the author typed. `merge` no longer sees the uploaded file at all
  // — see the note on `absorb`.
  { fromId: 'inputs', fromProperty: 'data', toId: 'merge', toProperty: 'in-data' },
  { fromId: 'headingField', fromProperty: 'onTextChanged', toId: 'merge', toProperty: 'in-heading' },
  { fromId: 'bodyField', fromProperty: 'onTextChanged', toId: 'merge', toProperty: 'in-body' },
  { fromId: 'linkLabelField', fromProperty: 'onTextChanged', toId: 'merge', toProperty: 'in-linkLabel' },
  { fromId: 'linkTargetField', fromProperty: 'onTextChanged', toId: 'merge', toProperty: 'in-linkTarget' },
  { fromId: 'saveButton', fromProperty: 'onClick', toId: 'merge', toProperty: 'run' },

  // The picture. An upload is a change to the section, so it folds and saves
  // without a second press — otherwise the picked image is lost the moment the
  // row redraws. `absorb` is the only node the upload triggers.
  { fromId: 'inputs', fromProperty: 'data', toId: 'absorb', toProperty: 'in-data' },
  { fromId: 'inputs', fromProperty: 'kind', toId: 'absorb', toProperty: 'in-kind' },
  { fromId: 'upload', fromProperty: 'cloudFile', toId: 'absorb', toProperty: 'in-image' },
  { fromId: 'upload', fromProperty: 'done', toId: 'absorb', toProperty: 'run' },

  { fromId: 'inputs', fromProperty: 'data', toId: 'dropLast', toProperty: 'in-data' },
  { fromId: 'removeImageButton', fromProperty: 'onClick', toId: 'dropLast', toProperty: 'run' },

  // 🔴 Three producers, one record. Each sets `prop-data` and then fires
  // `store`, in that order, because both arrive through the receiver's input
  // queue and `Node.update` drains one entry per input name in a single pass
  // (`node.ts:626-656`) — a `store` that arrived before its `prop-data` would
  // write the PREVIOUS fold. The same rule the site's `route` node is built to.
  { fromId: 'inputs', fromProperty: 'id', toId: 'save', toProperty: 'modelId' },
  { fromId: 'merge', fromProperty: 'out-data', toId: 'save', toProperty: 'prop-data' },
  { fromId: 'merge', fromProperty: 'out-built', toId: 'save', toProperty: 'store' },
  { fromId: 'absorb', fromProperty: 'out-data', toId: 'save', toProperty: 'prop-data' },
  { fromId: 'absorb', fromProperty: 'out-built', toId: 'save', toProperty: 'store' },
  { fromId: 'dropLast', fromProperty: 'out-data', toId: 'save', toProperty: 'prop-data' },
  { fromId: 'dropLast', fromProperty: 'out-built', toId: 'save', toProperty: 'store' },

  { fromId: 'inputs', fromProperty: 'id', toId: 'remove', toProperty: 'modelId' },
  { fromId: 'deleteButton', fromProperty: 'onClick', toId: 'remove', toProperty: 'store' },

  { fromId: 'save', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'remove', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },

  // AC2. The button press IS the signal — there is nothing to fold first.
  { fromId: 'moveUpButton', fromProperty: 'onClick', toId: 'outputs', toProperty: 'MoveUp' },
  { fromId: 'moveDownButton', fromProperty: 'onClick', toId: 'outputs', toProperty: 'MoveDown' },

  // AC2's gesture. The release is the trigger and the card's own element is the
  // only other thing the arithmetic needs — no pitch, no sibling records, no
  // runtime change. `out-snap` returns the card to where it started, on every
  // release including the ones that ask for nothing.
  { fromId: 'row', fromProperty: 'this', toId: 'dropIndex', toProperty: 'in-el' },
  { fromId: 'drag', fromProperty: 'onStop', toId: 'dropIndex', toProperty: 'run' },
  { fromId: 'dropIndex', fromProperty: 'out-snap', toId: 'drag', toProperty: 'snapToPositionY.do' },
  { fromId: 'dropIndex', fromProperty: 'out-toIndex', toId: 'outputs', toProperty: 'DropIndex' },
  { fromId: 'dropIndex', fromProperty: 'out-go', toId: 'outputs', toProperty: 'DropAt' }
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
    // 🔴 SBR-012's first finding, and it was already half-fixed. These three
    // ports carried the literal `24` — the exact value of `--space-6` — and the
    // identical trio was removed from `/Pages/PageEditor`'s `Editor` group
    // during SBR-007 with the sentence *"a raw dimension here had no token
    // reason."* This one survived because nothing scanned it: SB-006's raw-value
    // gate reads the five SB-006 components only, and Setup is SB-005's.
    //
    // ⚠️ Not a rendering defect — `paddingTop` on a Group is `px`-only
    // (`node-catalog.json`: `defaultUnit: "px"`, `units: ["px"]`), so the bare
    // number rendered 24px and `UnitlessDimension` correctly stayed silent. It
    // is a spacing value written as a literal where the scale already names it,
    // which is why it takes the fix and NOT an exemption: the exemption list
    // says spacing, colour, radius, face and font size must gain no entries.
    parameters: {
      flexDirection: 'column',
      paddingTop: 'var(--space-6)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    children: ['heading', 'blurb', 'emailField', 'passwordField', 'tokenField', 'claimButton', 'claimRefusal', 'signupRefusal', 'toSignIn']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    // The door's `monotone-typography` check, answered: a page where nothing sets
    // a weight measures as unstyled, because it is.
    parameters: { as: 'h1', text: 'Claim this site', fontWeight: 'var(--font-bold)' }
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
    parameters: { ...FIELD, useLabel: true, label: 'Email', type: 'email' }
  },
  {
    id: 'passwordField',
    type: 'net.noodl.controls.textinput',
    label: 'Password',
    parent: 'shell',
    parameters: { ...FIELD, useLabel: true, label: 'Password', type: 'password' }
  },
  {
    id: 'tokenField',
    type: 'net.noodl.controls.textinput',
    label: 'Setup token',
    parent: 'shell',
    parameters: { ...FIELD, useLabel: true, label: 'Setup token', type: 'password' }
  },
  {
    id: 'claimButton',
    type: 'net.noodl.controls.button',
    label: 'Claim',
    parent: 'shell',
    parameters: { ...PRIMARY_BUTTON, label: 'Claim this site' }
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
      // 🔴 **REL-011c A7.** All twelve admin shots recorded `headings: []` while
      // every screen visibly had a title: the words are drawn by `Text` nodes,
      // which render a `<div>` unless told otherwise, so the screens had titles
      // and the document had no heading structure at all. `as` changes nothing
      // visually — it is the one port on this node that exists for a screen
      // reader. The public site has said `h1`/`h2` since SBR-004; the panel a
      // client works in every day never did.
      as: 'h1',
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
    parameters: { ...PRIMARY_BUTTON, label: 'New page', marginLeft: 'var(--space-6)' }
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
      as: 'h1',
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
    parameters: { ...SECONDARY_BUTTON, label: 'Preview' }
  },
  {
    id: 'saveButton',
    type: 'net.noodl.controls.button',
    label: 'Save',
    parent: 'headerRow',
    parameters: { ...PRIMARY_BUTTON, label: 'Save page' }
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
    //
    // 🔴 **REL-011c A1's second half: two-up STOPS being two-up on a phone.**
    // Once `/Admin/Shell` folds, this screen gets the whole 390 rather than the
    // ~86px it used to — and two 155px boxes side by side is legible-and-operable
    // in the sense that nothing is hidden and in no other. `flexDirection` is
    // wired from `fields` below.
    //
    // ⚠️ `flexWrap: 'wrap'` is authored so that `rowGap` is AUTHORABLE at all:
    // the port is gated on `flexDirection = column OR flexWrap = wrap`
    // (`group.ts:478`), and this Group is authored as a row, so without the wrap
    // the stacked form would have no gap between its two fields. It changes
    // nothing while the row is a row — both children carry a percentage width
    // along the axis, so they shrink rather than wrap.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 'var(--space-4)',
      rowGap: 'var(--space-4)'
    },
    children: ['titleField', 'slugField']
  },
  {
    id: 'titleField',
    type: 'net.noodl.controls.textinput',
    label: 'Title',
    parent: 'nameRow',
    parameters: { ...FIELD, useLabel: true, label: 'Title' }
  },
  {
    id: 'slugField',
    type: 'net.noodl.controls.textinput',
    label: 'Slug',
    parent: 'nameRow',
    parameters: { ...FIELD, useLabel: true, label: 'Slug' }
  },
  {
    id: 'seoField',
    type: 'net.noodl.controls.textinput',
    label: 'SEO description',
    parent: 'fieldsCard',
    parameters: { ...FIELD, useLabel: true, label: 'Search description', type: 'textArea' }
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
    parameters: { ...FIELD, useLabel: true, label: 'Navigation order', type: 'number' }
  },
  {
    id: 'showInNavBox',
    type: 'net.noodl.controls.checkbox',
    label: 'Show in navigation',
    parent: 'navRow',
    parameters: { ...CHECKBOX, useLabel: true, label: 'Show in navigation' }
  },

  // ── The sections — §2's third bullet ───────────────────────────────────────
  {
    id: 'sectionsPanel',
    type: 'Group',
    label: 'Sections',
    parent: 'body',
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-3)' },
    children: ['sectionsHeader', 'reorderRefusal', 'sectionRows']
  },
  {
    id: 'sectionRows',
    type: 'Group',
    label: 'The section rows',
    parent: 'sectionsPanel',
    // 🔴 **This Group exists for the drag, and it is not cosmetic.** A `For Each`
    // renders its items into its VISUAL PARENT's element — it draws no box of its
    // own — so with `sectionList` sitting directly under `sectionsPanel` the rows
    // were DOM siblings of `sectionsHeader` and `reorderRefusal`. `dropIndex`
    // counts `parentElement.children`, and it would have counted those two as
    // rows above every section, reporting an index two too high on every drop.
    //
    // It repeats the panel's own `flexDirection` and `rowGap` so the rendered
    // result is unchanged: this is a container the arithmetic needs, not a
    // layout change.
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-3)' },
    children: ['sectionList']
  },
  {
    id: 'reorderRefusal',
    type: 'Text',
    label: 'Why that move did not work',
    parent: 'sectionsPanel',
    // 🔴 `mounted`, never `visible` — an absent refusal must take no space above
    // the list. Same rule, same reason, as `/Admin/PageRow`'s `rowRefusal`.
    // The standing `text` is there because `Text` declares `default: 'Text'`,
    // so a node whose only `text` is a wire renders the literal word until that
    // wire publishes.
    parameters: {
      ...STACKED,
      mounted: false,
      text: 'Those sections could not be reordered.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--destructive)'
    }
  },
  {
    id: 'sectionsHeader',
    type: 'Group',
    label: 'Add a section',
    parent: 'sectionsPanel',
    // The second of SBR-007's three `ADMIN_LAYOUT_OWED` rows: this Group was the
    // bare `addRow` and defaulted to filling its parent.
    //
    // 🔴 **REL-011c A4 — a COLUMN now, and the heading is why.** The panel's
    // heading, the `Kind` picker and `Add section` used to share one centred
    // row, so `useLabel`'s *"Kind"* — which a control draws ABOVE its box —
    // landed beside the word *"Sections"* and read as a second heading of the
    // same rank. A label belongs over the control it names; that is the whole
    // finding, and it is a containment fix rather than a spacing one.
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-2)' },
    children: ['sectionsHeading', 'sectionsAddRow']
  },
  {
    id: 'sectionsAddRow',
    type: 'Group',
    label: 'Pick a kind and add it',
    parent: 'sectionsHeader',
    // ⚠️ `flex-end`, not `center`: the picker is a labelled control and the
    // button is not, so their boxes are different heights — centring them puts
    // `Add section` halfway up the field beside it. Aligned at the bottom the
    // two controls sit on one line, which is what they are.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      alignItems: 'flex-end',
      columnGap: 'var(--space-3)'
    },
    children: ['kindPicker', 'addButton']
  },
  {
    id: 'sectionsHeading',
    type: 'Text',
    label: 'Sections heading',
    parent: 'sectionsHeader',
    // ⚠️ `STACKED` and not `IN_A_ROW` — the parent is a column now, and
    // `contentSize` down a column is the size mode that assigns NEITHER axis.
    parameters: {
      ...STACKED,
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
    parent: 'sectionsAddRow',
    // 🔴 `items` is NOT a comma list, and the door cannot say so — it is a static
    // `array` port, so no `dynamic-port-skipped` info covers it and a string
    // lands as a green graph that throws in `Select.tsx:116` the moment the page
    // renders. The control wants an array of `{ Label, Value }` objects
    // (`Select.tsx:116-119` reads exactly those two keys), which is what
    // `kindItems` below supplies.
    //
    // 🔴 **REL-011c A8 — found by LOOKING at A4's own after-arm, and it is the
    // floor rather than taste.** With nothing selected and no placeholder,
    // `Select.tsx:125-130` renders `label = null`: the bordered wrapper has no
    // content at all, so it collapsed to its own padding — a **~16px empty
    // sliver 1450px wide**, with no word in it saying what would be added. It
    // was there before A4 too; giving `Kind` its own line is what made it the
    // first thing on the screen instead of a hairline beside a heading.
    //
    // ⚠️ `value` and not `placeholder`, and the difference is what the button
    // then does. A placeholder makes the control legible and leaves `prop-kind`
    // **undefined** on the first press — a `Section` with no kind, which the
    // site draws as `richText` by fallback without anyone choosing it. Starting
    // ON the fallback makes `Add section` honest: the picker says the word the
    // press will act on. `DEFAULT_SECTION_KIND`, not a fourth copy of the
    // string. ✅ Setting `value` from the graph does NOT fire `Changed`
    // (`options.ts:112`), so this cannot trigger anything on load.
    parameters: { ...FIELD, useLabel: true, label: 'Kind', value: DEFAULT_SECTION_KIND }
  },
  {
    id: 'addButton',
    type: 'net.noodl.controls.button',
    label: 'Add',
    parent: 'sectionsAddRow',
    parameters: { ...PRIMARY_BUTTON, label: 'Add section' }
  },
  {
    id: 'sectionList',
    type: 'For Each',
    label: 'One row per section',
    parent: 'sectionRows',
    parameters: { templateType: 'explicit', template: '/Admin/SectionRow' }
  },
  {
    id: 'backButton',
    type: 'net.noodl.controls.button',
    label: 'Back',
    parent: 'body',
    parameters: { ...SECONDARY_BUTTON, label: 'Back to pages' }
  },
  // ── REL-011c A1, this screen's half ─────────────────────────────────────────
  //
  // ⚠️ **Its own reading rather than one passed down from `/Admin/Shell`.** The
  // shell holds the fold that decides the rail, but handing that boolean across
  // would mean a `Component Outputs` on a component every admin screen places —
  // and a shell that reports its layout to its children is a shell that has to
  // be right about all of them. Two nodes here is cheaper than one contract.
  {
    id: 'viewport',
    type: 'Screen Resolution',
    label: 'How wide is the window'
  },
  {
    id: 'fields',
    type: 'JavaScriptFunction',
    label: 'Is there room for two fields side by side?',
    parameters: {
      // SBR-004 §9.2, as on every other value input in this file.
      'runOnChange-in-width': true,
      functionScript: [
        // Unmeasured leaves the authored two-up standing — see `/Admin/Shell`'s
        // `fold`, which guards for the same reason.
        'if (Inputs.width === undefined) return;',
        // The same 760 the shell folds at, and deliberately the same number: the
        // two decisions are one decision about whether this is a phone.
        "const roomy = Inputs.width >= 760;",
        "Outputs.fieldsDirection = roomy ? 'row' : 'column';",
        // 🔴 **`flexWrap` moves WITH the direction, and the render is what said
        // so.** `flexWrap: 'wrap'` is authored on `nameRow` only so that
        // `rowGap` is authorable at all — but two children whose flex-basis is
        // 100% each take their OWN LINE in a wrap container, at every width. The
        // first build of this fix left `wrap` on, and the 1280 and 1900
        // photographs came back with Title above Slug: the two-up was gone
        // everywhere, not restored below the fold. Wrapping is the phone's
        // shape and `nowrap` is the desktop's.
        "Outputs.fieldsWrap = roomy ? 'nowrap' : 'wrap';"
      ].join('\n')
    }
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
      // 🔴 Derived from {@link SECTION_KINDS}, not retyped beside it. The list
      // and the site's dispatch are the same list now that each kind is a
      // component, and a hand-written copy here would offer an author a kind the
      // site cannot draw on the first day the two disagreed.
      json: JSON.stringify(SECTION_KINDS.map((kind) => ({ Label: SECTION_KIND_LABELS[kind], Value: kind })))
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
      visualFilter: SECTIONS_OF_PAGE_FILTER,
      // 🔴 **D30.** The same sort `/Pages/Site` uses, and the SAME CONSTANT —
      // a second copy of a sort is the copy that drifts. Without it this panel
      // renders whatever the backend happens to return, and `dropIndex` counts
      // DOM siblings while `reorderSection` renumbers the list sorted by
      // `order`: the same list only while the editor draws in `order`. The
      // buttons predate the drag and were renumbering an unshown list too.
      visualSort: SECTION_SORT
    }
  },
  // ── AC2: turning "up" into a position, which only this component can do ────
  //
  // The row fires the signal; the editor holds the list. Both planners take the
  // same two inputs and differ by one character, and they are two nodes rather
  // than one because a `JavaScriptFunction` has exactly ONE input signal
  // (`run`) — `simplejavascript.ts` mints `in-<name>` for values only — so
  // there is no way to tell one script which direction was pressed.
  //
  // 🔴 **`runOnChange-in-…: false` on both, and it is load-bearing.**
  // `itemActionItemId` is set for EVERY item output signal a row sends,
  // `Changed` included (`foreach.tsx:911`). Ticked — and absent means ticked
  // (`run-on-value-change.ts`) — pressing **Save** on a row would land a new
  // `itemId`, re-run both scripts, and silently move the section the client had
  // just edited. `run` is left as the only trigger, which is the same repair
  // the queries in this file make for the same reason.
  {
    id: 'moveUp',
    type: 'JavaScriptFunction',
    label: 'Where does this section go if it moves up',
    // Rule 1 — a custom signal port must be declared.
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      'runOnChange-in-sections': false,
      'runOnChange-in-itemId': false,
      functionScript:
        'if (Inputs.sections === undefined || Inputs.itemId === undefined) return;\n' +
        // The same sort as the endpoint's, and for the same reason: `order` is
        // not guaranteed contiguous, so a position has to be READ rather than
        // computed from the row's own number. The id tie-break keeps two rows
        // sharing an `order` from resolving two ways on two presses.
        "const rows = (Inputs.sections || []).map((s) => ({ id: s.id, order: (s.data || s).order }));\n" +
        'rows.sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));\n' +
        'const from = rows.findIndex((r) => r.id === Inputs.itemId);\n' +
        // Already at the top is not an error and not a request: a guarded
        // return, which fires neither `failure` nor `go`.
        'if (from <= 0) return;\n' +
        'Outputs.sectionId = Inputs.itemId;\n' +
        'Outputs.toIndex = from - 1;\n' +
        'Outputs.go();'
    }
  },
  {
    id: 'moveDown',
    type: 'JavaScriptFunction',
    label: 'Where does this section go if it moves down',
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      'runOnChange-in-sections': false,
      'runOnChange-in-itemId': false,
      functionScript:
        'if (Inputs.sections === undefined || Inputs.itemId === undefined) return;\n' +
        "const rows = (Inputs.sections || []).map((s) => ({ id: s.id, order: (s.data || s).order }));\n" +
        'rows.sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));\n' +
        'const from = rows.findIndex((r) => r.id === Inputs.itemId);\n' +
        'if (from < 0 || from >= rows.length - 1) return;\n' +
        'Outputs.sectionId = Inputs.itemId;\n' +
        'Outputs.toIndex = from + 1;\n' +
        'Outputs.go();'
    }
  },
  {
    id: 'reorderState',
    type: 'States',
    label: 'Did the last move refuse?',
    // 🔴 This node is here because `failure` is a **signal** and `mounted` is a
    // value port, and a signal into a value port arrives ONCE, as `false` — so
    // wiring the two together directly gives a refusal that never appears. The
    // `States` node is the recorded repair, and it also **resets**: a later move
    // that works returns the panel to `Quiet`, so a refusal cannot outlive the
    // thing it was about. Same shape as `/Admin/PageRow`'s `callState`.
    parameters: {
      states: 'Quiet,Refused',
      values: 'refused',
      'type-refused': 'boolean',
      'value-Quiet-refused': false,
      'value-Refused-refused': true
    }
  },
  {
    id: 'reorder',
    type: 'CloudFunction2',
    label: 'reorderSection',
    // The constant IS the parameter — a `CloudFunction2` stores the target
    // without the `/#__cloud__/` prefix. See the note on `FN_CLAIM`.
    parameters: { function: FN_REORDER }
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
  // REL-011c A1: the title/slug pair stacks on a phone.
  { fromId: 'viewport', fromProperty: 'width', toId: 'fields', toProperty: 'in-width' },
  { fromId: 'fields', fromProperty: 'out-fieldsDirection', toId: 'nameRow', toProperty: 'flexDirection' },
  { fromId: 'fields', fromProperty: 'out-fieldsWrap', toId: 'nameRow', toProperty: 'flexWrap' },
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

  // ── AC2: the row says which way, the editor works out where ───────────────
  //
  // 🔴 The id and the trigger both leave `sectionList`, which is the rule
  // `publishPage`'s `prep` was written to obey — a value and the signal that
  // consumes it must come from the SAME node, or the script runs against the
  // previous row. `For Each` gives that for free here: it flags every
  // `itemOutput-…` dirty and sends the signal in one scheduled pass
  // (`foreach.tsx:915-927`).
  { fromId: 'sections', fromProperty: 'items', toId: 'moveUp', toProperty: 'in-sections' },
  { fromId: 'sectionList', fromProperty: 'itemActionItemId', toId: 'moveUp', toProperty: 'in-itemId' },
  { fromId: 'sectionList', fromProperty: 'itemOutputSignal-MoveUp', toId: 'moveUp', toProperty: 'run' },

  { fromId: 'sections', fromProperty: 'items', toId: 'moveDown', toProperty: 'in-sections' },
  { fromId: 'sectionList', fromProperty: 'itemActionItemId', toId: 'moveDown', toProperty: 'in-itemId' },
  { fromId: 'sectionList', fromProperty: 'itemOutputSignal-MoveDown', toId: 'moveDown', toProperty: 'run' },

  // `hold`, not `pageInputs` — the page id the query filtered on is the one the
  // endpoint must renumber within, and they have to be the same value.
  { fromId: 'hold', fromProperty: 'out-pageId', toId: 'reorder', toProperty: 'in-pageId' },
  { fromId: 'moveUp', fromProperty: 'out-sectionId', toId: 'reorder', toProperty: 'in-sectionId' },
  { fromId: 'moveUp', fromProperty: 'out-toIndex', toId: 'reorder', toProperty: 'in-toIndex' },
  { fromId: 'moveUp', fromProperty: 'out-go', toId: 'reorder', toProperty: 'call' },
  { fromId: 'moveDown', fromProperty: 'out-sectionId', toId: 'reorder', toProperty: 'in-sectionId' },
  { fromId: 'moveDown', fromProperty: 'out-toIndex', toId: 'reorder', toProperty: 'in-toIndex' },
  { fromId: 'moveDown', fromProperty: 'out-go', toId: 'reorder', toProperty: 'call' },

  // AC2's gesture reaches the SAME endpoint by a shorter road, because the row
  // that was dropped has already worked out where it landed — there is no
  // direction to turn into a position, so there is no third planner.
  //
  // 🔴 `itemActionItemId` is set for EVERY item output signal a row sends,
  // `Changed` included, so this wire updates `in-sectionId` on saves and deletes
  // too. That is harmless and it is worth saying why: the value only matters when
  // `call` fires, and `For Each` sets the id, flags the item outputs, and sends
  // the signal in one scheduled pass — so the id and the index that arrive with
  // `DropAt` are always the dropped row's.
  { fromId: 'sectionList', fromProperty: 'itemActionItemId', toId: 'reorder', toProperty: 'in-sectionId' },
  { fromId: 'sectionList', fromProperty: 'itemOutput-DropIndex', toId: 'reorder', toProperty: 'in-toIndex' },
  { fromId: 'sectionList', fromProperty: 'itemOutputSignal-DropAt', toId: 'reorder', toProperty: 'call' },

  // The list has to be re-read, not re-sorted in place: the endpoint renumbered
  // rows this browser never named, so the only true ordering is the stored one.
  //
  // ⚠️ `done`, and there is no `success` port to reach for — `CloudFunction2`
  // renamed it (`cloudfunction2.ts:143-156`, ERG-001 §4). `completed` would be
  // the wrong port for the SBR-015 reason: it fires whatever the outcome, so a
  // refused move would re-read the list as if it had worked.
  { fromId: 'reorder', fromProperty: 'done', toId: 'sections', toProperty: 'storageFetch' },

  // SBR-015's browser half. A refusal nobody renders is a client pressing the
  // button again. `error` is the node's own "why the last call failed"
  // (`cloudfunction2.ts:157`), so the message the endpoint chose is the one
  // shown — and the state, not the signal, is what mounts the Text.
  { fromId: 'reorder', fromProperty: 'failure', toId: 'reorderState', toProperty: 'to-Refused' },
  { fromId: 'reorder', fromProperty: 'done', toId: 'reorderState', toProperty: 'to-Quiet' },
  { fromId: 'reorderState', fromProperty: 'refused', toId: 'reorderRefusal', toProperty: 'mounted' },
  { fromId: 'reorder', fromProperty: 'error', toId: 'reorderRefusal', toProperty: 'text' },

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
 * §3 surface 4 — *"the demo the template exists to give"* — and the settings
 * form it shares a screen with.
 *
 * ## SBR-009 rebuilt this screen, and the reason is one sentence
 *
 * The phase's root person-sentence is **"a client can change their site's colour
 * and see the site change"**, and until SBR-009 this screen was eleven controls
 * in one flat column: four unlabelled colour boxes, no grouping, no starting
 * point, and no way to see anything until you saved and navigated to the public
 * site. Every part of it worked. None of it was a demo.
 *
 * Three things changed, and each is an acceptance criterion:
 *
 *  1. **Cards.** Site / Colour / Type & shape, each a titled card. A client
 *     never faces eleven equal boxes again.
 *  2. **A presets row.** Studio / Press / Night, from `SITE_THEME_PRESETS` —
 *     the same three the floor and `docs/THEME.md` are generated from. Picking
 *     one fills every field, including the seven this screen never shows
 *     (`colorOnPrimary`, `colorAccentSoft`, `fontUi`, …), which is what SBR-003
 *     §1 meant by *"the preset row writes the full record"*: a hand-editor
 *     cannot keep the companions coherent and is not asked to.
 *  3. **A live preview, beside the fields.** Edited-but-unsaved values, applied
 *     to a mini site — hero, card, button — **without touching the record**.
 *
 * ## 🔴 The preview consumes token NAMES, not a copied palette
 *
 * SBR-009 §4's trap, and it has a mechanism rather than a promise. The preview's
 * nodes are authored `var(--primary)`, `var(--surface)`, `var(--radius-md)` —
 * exactly like every other component in this template. What makes them show the
 * *edited* values is a **scope**: `previewScope` carries
 * `cssClassName: PREVIEW_SCOPE_CLASS`, and `previewCss` writes one rule
 * (`.ndl-theme-preview { --primary: …; … }`) into a `CSS Definition` node. A
 * custom property set on an ancestor wins for its subtree, so the same token
 * name resolves to the record inside the panel and to the floor outside it.
 *
 * The alternative — wiring the edited hexes straight into the preview's colour
 * ports — would have been fewer nodes and a second palette: the preview would
 * have shown *the fields*, not *the site*, and the day a component started
 * reading `--accent` the two would have disagreed with nobody noticing.
 *
 * ⚠️ The rule text is built from `THEME_TOKEN_FIELDS`, so a thirteenth field is
 * carried by the preview on the next regeneration and cannot be forgotten.
 *
 * ## 🔴 Where the preset hexes live, and the gate that allows exactly one
 *
 * `presets` carries the three preset objects serialised into its script. That is
 * the **one** raw-colour literal in the shipped artefact, and it is named in
 * `TEMPLATE_COLOUR_EXEMPTIONS` (`siteBuilderStyleScan.ts`) — which SBR-012's own
 * scope anticipated: *"the `designTokens`/preset-data blocks as the one allowed
 * home for literals"*. The exemption is not a relaxation: `sbr012RawColourGate`
 * asserts the hexes in that script are **`SITE_THEME_PRESETS` exactly**, so the
 * carve-out cannot hide a drifted second copy of the palette — which is the only
 * thing a colour exemption could ever be hiding.
 *
 * 🔴 The **source** file stays clean: the script is
 * `JSON.stringify(SITE_THEME_PRESETS)`, so `rawColoursInSource` still reads zero
 * here and the hexes exist in exactly one hand-written place in the repository.
 *
 * ## Two things about the fields that are not style
 *
 * 🔴 **`runOnChange-startValue: true` is authored on all five** editable token
 * fields. NDA-017's migration writes `runOnChange-<input>: false` on every value
 * input of a node whose control signal is wired, on every project load — and
 * `presets` wires `set` on all five. Without the explicit `true` the record's
 * own values would stop reaching the fields on load, silently, the first time
 * anyone opened the project (SBR-004 §9.2: an explicit `true` survives the
 * migration, an absent key does not).
 *
 * 🔴 **`set` is wired anyway, and it is not redundant.** `startValue`'s setter
 * returns early when the incoming text equals the one it last received
 * (`text-input.ts:184`), and typing does **not** update that copy. Pick Night,
 * type over the primary, pick Night again — without the `set` pulse the field
 * would keep the typed value and quietly disagree with the record about to be
 * saved.
 *
 * ⚠️ Both queries here are singletons and keep their load-time fetch, for the
 * reason `site/ContactRecipient` records: with the boxes off and no filter
 * parameter, nothing ever triggers them.
 *
 * ⚠️ **No `contactRecipient` field.** `SiteSettings` is world-readable (SB-004
 * §4 gives it `find`/`get: public`, because the public site reads `siteName`),
 * so the address cannot live in that row — SB-004 F8, which is Richard's and
 * blocks SB-006's contact section, not this form.
 */

/** The class the preview's token scope is keyed on — one name, two readers. */
export const PREVIEW_SCOPE_CLASS = 'ndl-theme-preview';

/**
 * A titled card: the container's parameters, so the three groups cannot drift
 * into three slightly different cards. Written once for the same reason
 * {@link navItem} is.
 */
const CARD = {
  ...STACKED,
  flexDirection: 'column',
  rowGap: 'var(--space-3)',
  backgroundColor: 'var(--surface)',
  borderStyle: 'solid',
  borderWidth: 'var(--border-1)',
  borderColor: 'var(--border)',
  borderRadius: 'var(--radius-md)',
  paddingTop: 'var(--space-5)',
  paddingBottom: 'var(--space-5)',
  paddingLeft: 'var(--space-5)',
  paddingRight: 'var(--space-5)'
} as const;

/** The heading inside a card — the word that tells a client what the box is for. */
const cardTitle = (id: string, parent: string, text: string) => ({
  id,
  type: 'Text',
  label: text,
  parent,
  parameters: {
    ...STACKED,
    text,
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-bold)',
    letterSpacing: 'var(--tracking-wide)',
    textTransform: 'uppercase',
    color: 'var(--muted-foreground)'
  }
});

/** The five token fields a client edits by hand, and the label each carries. */
export const THEME_EDITOR_FIELDS: ReadonlyArray<{ id: string; field: ThemeField; label: string }> = [
  { id: 'primaryField', field: 'colorPrimary', label: 'Primary colour' },
  { id: 'backgroundField', field: 'colorBackground', label: 'Background colour' },
  { id: 'textField', field: 'colorText', label: 'Text colour' },
  { id: 'fontField', field: 'fontDisplay', label: 'Heading font' },
  { id: 'radiusField', field: 'radius', label: 'Corner rounding' }
];

/** `colorPrimary` → `primary`: the script/port name for a record field. */
const portOf = (field: ThemeField): string => field.replace(/^color(.)/, (_, c: string) => c.toLowerCase());

const themeField = (id: string, label: string, parent: string, placeholder: string) => ({
  id,
  type: 'net.noodl.controls.textinput',
  label,
  parent,
  parameters: {
    ...FIELD,
    useLabel: true,
    label,
    placeholder,
    // 🔴 See the module note above: `presets` wires `set`, and without this the
    // NDA-017 migration silences the record's own load-time fill.
    'runOnChange-startValue': true
  }
});

/** One preset chip placement — three of these, from one component. */
const presetChip = (id: string, name: keyof typeof SITE_THEME_PRESETS) => ({
  id,
  type: '/Admin/PresetChip',
  label: SITE_THEME_PRESET_LABELS[name],
  parent: 'presetsRow',
  parameters: { name, label: SITE_THEME_PRESET_LABELS[name] }
});

/**
 * The preset table, as the graph receives it.
 *
 * 🔴 `JSON.stringify(SITE_THEME_PRESETS)` and not a literal: this is the only
 * copy of those values that reaches a person, and the gate asserts it parses
 * back to the source object. `Outputs.picked()` is declared in `ports` (rule 1)
 * and fires last, after all twelve values have been published.
 */
function buildPresetPickerScript(): string {
  return [
    'const P = ' + JSON.stringify(SITE_THEME_PRESETS) + ';',
    // D54: the press arrives as `{ name }` from the chip that was pressed — see
    // the `/Admin/PresetChip` module note for why it is an object and not a name.
    "const t = P[(Inputs.pick || {}).name] || P.studio;",
    ...(Object.keys(THEME_TOKEN_FIELDS) as ThemeField[]).map(
      (field) => 'Outputs.' + portOf(field) + " = t." + field + " || '';"
    ),
    'Outputs.picked();'
  ].join('\n');
}

/**
 * The working set, as one object — every field, whether or not a box shows it.
 *
 * Three producers reach these inputs and the last one wins, which is exactly the
 * behaviour wanted: the record fills them on load, a preset replaces all twelve,
 * and typing replaces one. `runOnChange-in-*: true` is authored on all twelve
 * (see the module note) because this node has no control signal and must run as
 * values arrive — the preview is downstream of it.
 */
function buildWorkingTokensScript(): string {
  return [
    'Outputs.tokens = {',
    (Object.keys(THEME_TOKEN_FIELDS) as ThemeField[])
      .map((field) => '  ' + field + ': Inputs.' + portOf(field) + " || ''")
      .join(',\n'),
    '};'
  ].join('\n');
}

/**
 * The preview's scope rule.
 *
 * ⚠️ Values are stripped of `;{}<>` before they are pasted into a stylesheet. A
 * client typing `}` into the primary box would otherwise close the rule and
 * restyle the admin panel from inside its own preview — their own screen only,
 * but a surface that mangles on a keystroke is not a demo.
 */
function buildPreviewCssScript(): string {
  return [
    'const t = Inputs.tokens || {};',
    'const F = ' + JSON.stringify(THEME_TOKEN_FIELDS) + ';',
    'const decls = Object.keys(F)',
    '  .filter(function (k) { return t[k]; })',
    "  .map(function (k) { return F[k] + ': ' + String(t[k]).replace(/[;{}<>]/g, '') + ';'; })",
    "  .join(' ');",
    "Outputs.css = '." + PREVIEW_SCOPE_CLASS + " { ' + decls + ' }';"
  ].join('\n');
}

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
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-6)' },
    children: ['heading', 'presetsCard', 'columns']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    parameters: {
      ...STACKED,
      as: 'h1',
      text: 'Theme and settings',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },

  // ── The presets row ────────────────────────────────────────────────────────
  {
    id: 'presetsCard',
    type: 'Group',
    label: 'Presets card',
    parent: 'shell',
    parameters: CARD,
    children: ['presetsTitle', 'presetsHint', 'presetsRow']
  },
  cardTitle('presetsTitle', 'presetsCard', 'Start from a look'),
  {
    id: 'presetsHint',
    type: 'Text',
    label: 'Presets hint',
    parent: 'presetsCard',
    // The states rule: a surface that changes eleven values at once says so
    // before it does it, and says what has NOT happened yet.
    parameters: {
      ...STACKED,
      text: 'Picking one fills every field below, including the ones this screen does not show. Nothing is saved until you press Save theme.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'presetsRow',
    type: 'Group',
    label: 'Presets row',
    parent: 'presetsCard',
    parameters: { ...STACKED, flexDirection: 'row', columnGap: 'var(--space-3)' },
    children: ['presetStudio', 'presetPress', 'presetNight']
  },
  presetChip('presetStudio', 'studio'),
  presetChip('presetPress', 'press'),
  presetChip('presetNight', 'night'),

  // ── The two panes ──────────────────────────────────────────────────────────
  {
    id: 'columns',
    type: 'Group',
    label: 'Fields and preview',
    parent: 'shell',
    // 🔴 **REL-011c A9 — the shell folding is not enough for this screen.** With
    // A1 in, `/admin/theme` at 390 gets the whole width and then spends it on a
    // two-up split whose right-hand pane runs off the edge: the live preview is
    // a card with a real min-content width, so a half of 390 is not a half, it
    // is an overflow. Found by looking at A1's own after-arm rather than
    // reasoned about — the fold reduced this screen's unreachable pixels from
    // 362 to 102 and left the preview clipped, which no single number said.
    //
    // ⚠️ `flexWrap: 'wrap'` for the same reason as `/Pages/PageEditor`'s
    // `nameRow`: `rowGap` is gated on `flexDirection = column OR flexWrap =
    // wrap` (`group.ts:478`) and this Group is authored as a row, so without it
    // the stacked panes would have no gap. It changes nothing while the row is a
    // row — both children fill, so they shrink rather than wrap.
    parameters: {
      ...STACKED,
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 'var(--space-6)',
      rowGap: 'var(--space-6)',
      alignItems: 'flex-start'
    },
    children: ['fieldsCol', 'previewCol']
  },
  // REL-011c A9. The same two nodes `/Pages/PageEditor` carries, reading the
  // same number — see the note there for why each screen holds its own rather
  // than taking a boolean down from `/Admin/Shell`.
  {
    id: 'viewport',
    type: 'Screen Resolution',
    label: 'How wide is the window'
  },
  {
    id: 'panes',
    type: 'JavaScriptFunction',
    label: 'Is there room for the preview beside the fields?',
    parameters: {
      'runOnChange-in-width': true,
      functionScript: [
        'if (Inputs.width === undefined) return;',
        "const roomy = Inputs.width >= 760;",
        "Outputs.panesDirection = roomy ? 'row' : 'column';",
        // See `/Pages/PageEditor`'s `fields`: the authored `wrap` exists to make
        // `rowGap` authorable and would otherwise put the live preview under the
        // fields at 1900 as well as at 390. Measured, not reasoned about — the
        // first build of A9 did exactly that.
        "Outputs.panesWrap = roomy ? 'nowrap' : 'wrap';"
      ].join('\n')
    }
  },
  {
    id: 'fieldsCol',
    type: 'Group',
    label: 'Fields column',
    parent: 'columns',
    // 🔴 No `sizeMode`, deliberately, and named in `ADMIN_FILL_EXEMPTIONS`: two
    // filling columns in a row are a half each, which is the whole layout. An
    // authored width here would be a raw percentage — a proportion of a pane
    // rather than a distance, which is the one thing the token vocabulary has no
    // name for and `/Pages/PageEditor`'s Heading already pays an exemption for.
    parameters: { flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['siteCard', 'colourCard', 'typeCard', 'actions']
  },

  {
    id: 'siteCard',
    type: 'Group',
    label: 'Site card',
    parent: 'fieldsCol',
    parameters: CARD,
    children: ['siteTitle', 'siteNameField', 'homeSlugField', 'settingsButton']
  },
  cardTitle('siteTitle', 'siteCard', 'Site'),
  {
    id: 'siteNameField',
    type: 'net.noodl.controls.textinput',
    label: 'Site name',
    parent: 'siteCard',
    parameters: { ...FIELD, useLabel: true, label: 'Site name', placeholder: 'The name in the header and the tab' }
  },
  {
    id: 'homeSlugField',
    type: 'net.noodl.controls.textinput',
    label: 'Home slug',
    parent: 'siteCard',
    parameters: { ...FIELD, useLabel: true, label: 'Home page slug', placeholder: 'home' }
  },
  {
    id: 'settingsButton',
    type: 'net.noodl.controls.button',
    label: 'Save settings',
    parent: 'siteCard',
    parameters: { ...PRIMARY_BUTTON, label: 'Save settings' }
  },

  {
    id: 'colourCard',
    type: 'Group',
    label: 'Colour card',
    parent: 'fieldsCol',
    parameters: CARD,
    children: ['colourTitle', 'primaryField', 'backgroundField', 'textField']
  },
  cardTitle('colourTitle', 'colourCard', 'Colour'),
  themeField('primaryField', 'Primary colour', 'colourCard', 'The brand colour — buttons, links, the hero'),
  themeField('backgroundField', 'Background colour', 'colourCard', 'The page ground'),
  themeField('textField', 'Text colour', 'colourCard', 'Body text'),

  {
    id: 'typeCard',
    type: 'Group',
    label: 'Type and shape card',
    parent: 'fieldsCol',
    parameters: CARD,
    children: ['typeTitle', 'fontField', 'radiusField']
  },
  cardTitle('typeTitle', 'typeCard', 'Type & shape'),
  themeField('fontField', 'Heading font', 'typeCard', 'Georgia, serif'),
  themeField('radiusField', 'Corner rounding', 'typeCard', '6px'),

  {
    id: 'actions',
    type: 'Group',
    label: 'Theme actions',
    parent: 'fieldsCol',
    parameters: { ...STACKED, flexDirection: 'row', columnGap: 'var(--space-3)' },
    children: ['themeButton', 'backButton']
  },
  {
    id: 'themeButton',
    type: 'net.noodl.controls.button',
    label: 'Save theme',
    parent: 'actions',
    parameters: { ...PRIMARY_BUTTON, label: 'Save theme' }
  },
  {
    id: 'backButton',
    type: 'net.noodl.controls.button',
    label: 'Back',
    parent: 'actions',
    parameters: { ...SECONDARY_BUTTON, label: 'Back to pages' }
  },

  // ── The live preview ───────────────────────────────────────────────────────
  {
    id: 'previewCol',
    type: 'Group',
    label: 'Preview column',
    parent: 'columns',
    // The other half. See `fieldsCol`.
    parameters: { flexDirection: 'column', rowGap: 'var(--space-3)' },
    children: ['previewTitle', 'previewScope', 'previewNote']
  },
  cardTitle('previewTitle', 'previewCol', 'Live preview'),
  {
    id: 'previewScope',
    type: 'Group',
    label: 'Preview scope',
    parent: 'previewCol',
    // 🔴 `cssClassName` is the whole mechanism. `previewCss` writes
    // `.ndl-theme-preview { --primary: … }` into a `CSS Definition`, and every
    // node below resolves the SAME token names against this element rather than
    // against `:root`. Nothing here is wired to a colour.
    parameters: {
      ...STACKED,
      cssClassName: PREVIEW_SCOPE_CLASS,
      flexDirection: 'column',
      rowGap: 'var(--space-4)',
      backgroundColor: 'var(--background)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)'
    },
    children: ['previewHero', 'previewCard']
  },
  {
    id: 'previewHero',
    type: 'Group',
    label: 'Preview hero',
    parent: 'previewScope',
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      rowGap: 'var(--space-2)',
      backgroundColor: 'var(--primary)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)'
    },
    children: ['previewHeroTitle', 'previewHeroSub']
  },
  {
    id: 'previewHeroTitle',
    type: 'Text',
    label: 'Preview hero title',
    parent: 'previewHero',
    parameters: {
      ...STACKED,
      text: 'Your site, in this look',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'previewHeroSub',
    type: 'Text',
    label: 'Preview hero subtitle',
    parent: 'previewHero',
    parameters: {
      ...STACKED,
      text: 'The hero band, the type and the corners follow the fields on the left.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'previewCard',
    type: 'Group',
    label: 'Preview card',
    parent: 'previewScope',
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      rowGap: 'var(--space-3)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)'
    },
    children: ['previewCardTitle', 'previewCardBody', 'previewButton']
  },
  {
    id: 'previewCardTitle',
    type: 'Text',
    label: 'Preview card title',
    parent: 'previewCard',
    parameters: {
      ...STACKED,
      text: 'A section on a page',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'previewCardBody',
    type: 'Text',
    label: 'Preview card body',
    parent: 'previewCard',
    parameters: {
      ...STACKED,
      text: 'Body text in the reading colour, on the surface colour, inside the border colour.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'previewButton',
    type: 'Group',
    label: 'Preview button',
    parent: 'previewCard',
    // A Group and not a `net.noodl.controls.button`: this is a picture of a
    // button, and a real one would be a control a client could press to no
    // effect — the fourth state SBR-016 is about, in miniature.
    parameters: {
      ...IN_A_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'var(--primary)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)'
    },
    children: ['previewButtonLabel']
  },
  {
    id: 'previewButtonLabel',
    type: 'Text',
    label: 'Preview button label',
    parent: 'previewButton',
    parameters: {
      ...IN_A_ROW,
      text: 'Get in touch',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--primary-foreground)'
    }
  },
  {
    id: 'previewNote',
    type: 'Text',
    label: 'Preview note',
    parent: 'previewCol',
    parameters: {
      ...STACKED,
      text: 'Unsaved. The public site changes when you press Save theme.',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },

  // ── The logic ──────────────────────────────────────────────────────────────
  { id: 'settings', type: 'DbCollection2', label: 'SiteSettings (one row)', parameters: { collectionName: 'SiteSettings' } },
  {
    id: 'theme',
    type: 'DbCollection2',
    label: 'Theme (one row)',
    parameters: {
      // 🔴 **SBR-016's defect, one wire away from being re-introduced here.**
      // SBR-009 wires `storageFetch` (from `saveTheme.done`, so the panel
      // repaints on Save), and that alone makes NDA-017's migration write
      // `runOnChange-collectionName: false` into this bag on every project load
      // — which kills the LOAD-TIME fetch. The theme editor would then open with
      // eleven empty boxes on a themed site, and only after saving would it know
      // what the record said. The explicit `true` is what says "I meant the new
      // default"; the migration never touches a key that is already present.
      'runOnChange-collectionName': true,
      collectionName: 'Theme'
    }
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
        "Outputs.homeSlug = first.homeSlug || 'home';"
    }
  },
  {
    id: 'readTheme',
    type: 'JavaScriptFunction',
    label: 'Read the theme tokens',
    parameters: {
      // SBR-003: all twelve contract fields come back out. Five reach a field
      // and all twelve reach `buildTokens`, so opening this screen and pressing
      // Save re-writes the record it read — including the seven the screen does
      // not show. Before SBR-009 those seven were blanked on every save.
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
    id: 'presets',
    type: 'JavaScriptFunction',
    label: 'The three presets',
    // Rule 1.
    ports: [{ name: 'out-picked', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 **`false`, and the drive is what found it.** Three chips publish their
      // `name` at MOUNT — a `Component Inputs` constant per placement — and with
      // the box ticked this node ran three times before anybody touched
      // anything, last placement winning. The screen booted with the **Night**
      // palette in the preview and all five boxes pre-filled with Night's
      // values, having been picked by nobody. Measured in a browser
      // (`sbr009ThemeEditorDrive`), not reasoned.
      //
      // ⚠️ It is authored rather than left out because the box is not absent
      // here: DEF-007 §3.2's `pinRunOnValueChangeDefaults` writes `true` into the
      // artefact for every governed checkbox the source leaves unstated. In this
      // template "unstated" means `true`, so the only way to say "wait for the
      // signal" is to say it.
      //
      // 🔴 And `run` is ADDITIVE — wiring it does not stop a node running on its
      // own. The pair is the fix: `in-pick` is a value that must have LANDED, and
      // `run` is the moment a person chose.
      //
      // 🔴 D54: that pair was necessary and not sufficient. Three chips wired
      // a MOUNT-time constant into this one port, so the value that had landed
      // was always the last placement's — `night` — and the press only said
      // *now*, never *which*. The chip now publishes `{ name }` at the press.
      'runOnChange-in-pick': false,
      functionScript: buildPresetPickerScript()
    }
  },
  {
    id: 'buildTokens',
    type: 'JavaScriptFunction',
    label: 'The theme tokens, as one object',
    parameters: {
      // 🔴 All twelve `runOnChange-in-*` authored `true`. This node has no
      // control signal wired — the preview downstream of it has to move on every
      // keystroke — and an unstated box on a node whose value has to apply as it
      // arrives is one wired signal away from silently freezing (SBR-004 §9.2,
      // and three of s36's defects were this shape).
      ...Object.fromEntries(
        (Object.keys(THEME_TOKEN_FIELDS) as ThemeField[]).map((field) => [`runOnChange-in-${portOf(field)}`, true])
      ),
      // The keys are SBR-003's contract with the public site (`THEME_KEYS` /
      // `siteTheme.ts`), so all twelve are written whether or not the author
      // filled every field — a missing key and an empty one are different
      // things to a reader that does `tokens.colorText`.
      //
      // 🔴 No `Outputs.built()` any more, and the button no longer runs this
      // node. `SetDbModelProperties` stages `prop-tokens` as it arrives and
      // writes on `store`, so Save is one wire from the button to the write and
      // the object is always current — which is also what lets the preview read
      // it without a second builder.
      functionScript: buildWorkingTokensScript()
    }
  },
  {
    id: 'previewCss',
    type: 'JavaScriptFunction',
    label: 'The edited tokens, as a scoped rule',
    parameters: {
      // Same reason as `buildTokens` above: no control signal, must run as the
      // working set changes.
      'runOnChange-in-tokens': true,
      functionScript: buildPreviewCssScript()
    }
  },
  {
    id: 'previewStyle',
    type: 'CSS Definition',
    label: 'Preview token scope',
    // The stylesheet exists for as long as this screen does and is removed with
    // it — which is what makes the preview local in the sense that matters: the
    // pages list, opened next, is not wearing an unsaved theme.
    parameters: { style: '' }
  },
  {
    id: 'applyTheme',
    type: 'JavaScriptFunction',
    label: 'The saved theme, on this document',
    parameters: {
      // 🔴 AC1's second half. `/Admin/Shell` runs this same script on every admin
      // screen's load; this copy is what repaints the panel the moment Save
      // lands, without a reload — `saveTheme.done` re-fetches the singleton and
      // the fetch runs this. One script, `buildThemeApplierScript()`, shared with
      // the public site's applier.
      //
      // ⚠️ **No `runOnChange-in-rows` here, and that is measured rather than
      // forgotten.** s36's lesson — an unstated box on a script that ends in an
      // effect is a defect — does not bite inside THIS template: DEF-007 §3.2's
      // `pinRunOnValueChangeDefaults` writes every governed checkbox into the
      // artefact at generation time, `true` for anything the source leaves
      // unstated, and the migration never touches a key that is already there.
      // The shipped node therefore states `true`, exactly like the public site's
      // applier. An authored `false` here would have made this the one applier of
      // three that behaved differently, on purpose, for no reason.
      functionScript: buildThemeApplierScript()
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
  // REL-011c A9: the preview stacks under the fields on a phone.
  { fromId: 'viewport', fromProperty: 'width', toId: 'panes', toProperty: 'in-width' },
  { fromId: 'panes', fromProperty: 'out-panesDirection', toId: 'columns', toProperty: 'flexDirection' },
  { fromId: 'panes', fromProperty: 'out-panesWrap', toId: 'columns', toProperty: 'flexWrap' },
  { fromId: 'settings', fromProperty: 'items', toId: 'readSettings', toProperty: 'in-rows' },
  { fromId: 'settings', fromProperty: 'fetched', toId: 'readSettings', toProperty: 'run' },
  { fromId: 'readSettings', fromProperty: 'out-siteName', toId: 'siteNameField', toProperty: 'startValue' },
  { fromId: 'readSettings', fromProperty: 'out-homeSlug', toId: 'homeSlugField', toProperty: 'startValue' },

  { fromId: 'theme', fromProperty: 'items', toId: 'readTheme', toProperty: 'in-rows' },
  { fromId: 'theme', fromProperty: 'fetched', toId: 'readTheme', toProperty: 'run' },
  // The applier rides the same fetch — including the one `saveTheme.done`
  // triggers, which is what repaints the panel on Save.
  { fromId: 'theme', fromProperty: 'items', toId: 'applyTheme', toProperty: 'in-rows' },
  { fromId: 'theme', fromProperty: 'fetched', toId: 'applyTheme', toProperty: 'run' },

  // The record → the five boxes a client edits by hand.
  ...THEME_EDITOR_FIELDS.map((f) => ({
    fromId: 'readTheme',
    fromProperty: `out-${portOf(f.field)}`,
    toId: f.id,
    toProperty: 'startValue'
  })),
  // The record → all twelve of the working set. The seven with no box on this
  // screen travel by this route alone, and it is why Save no longer blanks them.
  ...(Object.keys(THEME_TOKEN_FIELDS) as ThemeField[]).map((field) => ({
    fromId: 'readTheme',
    fromProperty: `out-${portOf(field)}`,
    toId: 'buildTokens',
    toProperty: `in-${portOf(field)}`
  })),

  // A chip → the picker. The name is a constant the instance published at mount;
  // the signal arrives on click, long after — one producer, two ports, in that
  // order, which is the pairing SB-005's header says is safe.
  ...['presetStudio', 'presetPress', 'presetNight'].flatMap((chip) => [
    { fromId: chip, fromProperty: 'pick', toId: 'presets', toProperty: 'in-pick' },
    { fromId: chip, fromProperty: 'Picked', toId: 'presets', toProperty: 'run' }
  ]),

  // The picker → all twelve of the working set …
  ...(Object.keys(THEME_TOKEN_FIELDS) as ThemeField[]).map((field) => ({
    fromId: 'presets',
    fromProperty: `out-${portOf(field)}`,
    toId: 'buildTokens',
    toProperty: `in-${portOf(field)}`
  })),
  // … and → the five boxes, so a client sees what they picked.
  ...THEME_EDITOR_FIELDS.map((f) => ({
    fromId: 'presets',
    fromProperty: `out-${portOf(f.field)}`,
    toId: f.id,
    toProperty: 'startValue'
  })),
  // The `Set` pulse. See the module note: without it, re-picking a preset after
  // typing leaves the typed value in the box.
  ...THEME_EDITOR_FIELDS.map((f) => ({
    fromId: 'presets',
    fromProperty: 'out-picked',
    toId: f.id,
    toProperty: 'set'
  })),

  // Typing → the working set.
  ...THEME_EDITOR_FIELDS.map((f) => ({
    fromId: f.id,
    fromProperty: 'onTextChanged',
    toId: 'buildTokens',
    toProperty: `in-${portOf(f.field)}`
  })),

  // The working set → the preview, and → the write that is waiting for a click.
  { fromId: 'buildTokens', fromProperty: 'out-tokens', toId: 'previewCss', toProperty: 'in-tokens' },
  { fromId: 'previewCss', fromProperty: 'out-css', toId: 'previewStyle', toProperty: 'style' },

  // `firstItemId` is the singleton's id — the row `claimSite` wrote.
  { fromId: 'settings', fromProperty: 'firstItemId', toId: 'saveSettings', toProperty: 'modelId' },
  { fromId: 'siteNameField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-siteName' },
  { fromId: 'homeSlugField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-homeSlug' },
  { fromId: 'settingsButton', fromProperty: 'onClick', toId: 'saveSettings', toProperty: 'store' },

  { fromId: 'theme', fromProperty: 'firstItemId', toId: 'saveTheme', toProperty: 'modelId' },
  { fromId: 'buildTokens', fromProperty: 'out-tokens', toId: 'saveTheme', toProperty: 'prop-tokens' },
  { fromId: 'themeButton', fromProperty: 'onClick', toId: 'saveTheme', toProperty: 'store' },
  // The sanctioned refresh (module header, rule 3): a write's `done` re-fetching
  // the collection it wrote. Here it also carries AC1 — the re-fetch is what runs
  // `applyTheme` and repaints the admin panel the instant Save lands.
  { fromId: 'saveTheme', fromProperty: 'done', toId: 'theme', toProperty: 'storageFetch' },

  { fromId: 'backButton', fromProperty: 'onClick', toId: 'goBack', toProperty: 'navigate' }
];

// ── 6b. Admin/PresetChip — one preset, as a control ──────────────────────────

/**
 * A chip in the presets row: a button that knows which preset it is.
 *
 * 🔴 A component rather than three buttons and three one-line scripts, and the
 * reason is the same one that made `/Admin/Shell` a component: three copies of a
 * control are three controls that can disagree, and the `Component Inputs`
 * interface is what makes one component render three different chips.
 *
 * ## 🔴 D54: the name is published AT THE CLICK, and the mount-time version was wrong
 *
 * This component used to wire `inputs.name` straight to `outputs.name` and
 * `chip.onClick` straight to `outputs.Picked`, on the reasoning that a page
 * *"receives both from one producer, in that order"*. That is true of **one**
 * placement and false of three: all three chips publish their constant into the
 * SAME `presets.in-name` port at mount, **last placement wins**, and the picker
 * — which runs on the `run` signal, carrying no payload — then answered with
 * whatever landed last no matter which chip a person pressed. It was always
 * `night`, the third placement.
 *
 * That is what D54 recorded as *"the theme presets are dead on the deployed
 * site"*: they were never dead. They fired on every click and published the
 * wrong palette, and the screen it was measured on already held `night`'s
 * values — so *"0 of 7 fields changed"* was **the right preset arriving
 * twice**, not a chain that never ran. ⚠️ `runOnChange-in-name: false` on the
 * picker (SBR-009) removed the visible half of this — the screen no longer
 * *booted* wearing Night — and left the cause untouched.
 *
 * So `pick` publishes **the press itself** — `{ name }`, this chip's own — and
 * fires `Picked` after it, in one script run. The value goes first and the pulse
 * second, in the same invocation: the ordering contract the page's own picker
 * already relies on when it writes twelve values and then pulses the five boxes'
 * `set`.
 *
 * 🔴 **An OBJECT, and not the bare name, and the reason is a documented
 * runtime behaviour.** A Function's `Outputs` proxy publishes an output *only
 * when it changes* (`simplejavascript.ts`: *"Some Noodl projects rely on this
 * behavior"*). A chip republishing the string `'studio'` it last published sends
 * nothing, so the picker keeps whatever the chip pressed in between left in
 * `in-pick` — measured on the deployed bundle: Studio, Press, Night read
 * correctly and then **Studio again read Night**. A fresh object literal is
 * never `===` its predecessor, so a press always lands. ⚠️ This is the same
 * trap in a second costume: the first version of this fix was correct about
 * *which* chip and still wrong on the fourth press.
 *
 * ⚠️ `runOnChange-in-name: false` here for the same reason it is on the picker:
 * without it the constant arriving at mount would fire `Picked` on all three
 * chips before anybody pressed anything.
 */
export const PRESET_CHIP_NODES = [
  {
    id: 'chip',
    type: 'net.noodl.controls.button',
    label: 'Preset chip',
    parameters: {
      ...IN_A_ROW,
      // Authored as well as wired, SB-018 (3): a chip whose only label source is
      // a component input renders the Button default until that input first
      // publishes.
      label: 'Preset',
      backgroundColor: 'var(--surface)',
      color: 'var(--foreground)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'Which preset this chip is',
    ports: [
      { name: 'name', type: 'string', plug: 'output' },
      { name: 'label', type: 'string', plug: 'output' }
    ]
  },
  {
    id: 'pick',
    type: 'JavaScriptFunction',
    label: 'This chip, at the moment it is pressed',
    // Rule 1: a signal an author calls rather than assigns is declared, because
    // `Outputs.picked()` is a call and the script parser reads assignments.
    ports: [{ name: 'out-picked', plug: 'output', type: 'signal' }],
    parameters: {
      // See the module note above — the constant arrives at MOUNT, and a run on
      // arrival would fire all three chips' `Picked` before anybody pressed one.
      'runOnChange-in-name': false,
      // The value first, the pulse second — and the value is a fresh object so a
      // re-press of the same chip is not swallowed by the proxy's change check.
      functionScript: ['Outputs.pick = { name: Inputs.name };', 'Outputs.picked();'].join('\n')
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'The pick',
    ports: [
      // `*` and not `string`: this carries `{ name }`, for the reason in the
      // module note above.
      { name: 'pick', type: '*', plug: 'input' },
      { name: 'Picked', type: 'signal', plug: 'input' }
    ]
  }
];

export const PRESET_CHIP_WIRES = [
  { fromId: 'inputs', fromProperty: 'label', toId: 'chip', toProperty: 'label' },
  // D54. The name goes to `pick`, not to `outputs` — a constant published at
  // mount is the value that made every chip answer `night`.
  { fromId: 'inputs', fromProperty: 'name', toId: 'pick', toProperty: 'in-name' },
  { fromId: 'chip', fromProperty: 'onClick', toId: 'pick', toProperty: 'run' },
  // Value first, signal second, out of one run — the picker downstream stores
  // `in-pick` without running and then runs on `run`, so it reads THIS chip.
  { fromId: 'pick', fromProperty: 'out-pick', toId: 'outputs', toProperty: 'pick' },
  { fromId: 'pick', fromProperty: 'out-picked', toId: 'outputs', toProperty: 'Picked' }
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
    // 🔴 **REL-011c A1 — `flexDirection` is WIRED as well as authored.** The
    // authored `row` is the wide shape and the standing value; below the fold
    // (see `fold`) it becomes `column` and the rail stacks above the content.
    // `Group.flexDirection`'s setter calls `setLayout`, so the children's
    // `parentLayout` — and therefore every percentage size on them — is
    // recomputed rather than left describing the old axis.
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
    // reason, in `TEMPLATE_DIMENSION_EXEMPTIONS` (`siteBuilderStyleScan.ts`).
    // ⚠️ That name used to read `ADMIN_RAW_DIMENSIONS`, which never existed —
    // an exemption list named in a comment and never written, so the rail's
    // reason was unenforced until SBR-012 built the list it pointed at.
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
      // ⚠️ REL-011c A1: `borderRightStyle` is wired to `'none'` below the fold.
      // A rail rule down the left of a stacked band is a line in mid-air; the
      // `--surface` ground is what separates the two once they are stacked.
      // The style is AUTHORED as a real line because `borderRightWidth` and
      // `borderRightColor` are dynamic ports gated on exactly that
      // (`node-shared-port-definitions.ts:1096-1101`) — authoring `'none'` here
      // would make the other two unauthorable.
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
  // ── REL-011c A1 — the rail yields on a phone ────────────────────────────────
  //
  // 🔴 **The defect, measured on the deployed bundle rather than argued.** The
  // shell had no breakpoint of any kind: the rail kept all 240 of its pixels at
  // every viewport, and `Admin content` — which carries `width: 100%` — cannot
  // shrink below its own stated width, because `min-width: auto` on a flex item
  // is `min(its own stated width, its content minimum)`. So at 390 the frame was
  // 240 + 390 = 630px wide, the content column got the 390 it had asked for, and
  // the whole rail was pushed off the right-hand edge instead of coming out of
  // the content. Every admin screen was affected; `/admin/theme` reported 362px
  // unreachable and `/admin/page` 2379px.
  //
  // ⚠️ **`Columns` is the runtime's own breakpoint and it is the wrong tool
  // here.** `smallBreakpoint`/`smallLayout` live on `Columns` only
  // (`columns.ts:239`), and a `Columns` divides its width by a ratio — which
  // would turn the fixed 240px rail into a proportion of the viewport, growing
  // it to 380px at 1900. The rail is fixed on purpose (see `SIDEBAR_WIDTH`), so
  // the breakpoint has to come from somewhere that does not also resize it.
  {
    id: 'viewport',
    type: 'Screen Resolution',
    label: 'How wide is the window'
  },
  {
    id: 'fold',
    type: 'JavaScriptFunction',
    label: 'Is there room for the rail beside the content?',
    parameters: {
      // 🔴 `runOnChange-in-width: true`, authored, for SBR-004 §9.2's reason —
      // the same one `navStyle` above carries. The NDA-017 migration writes
      // `runOnChange-<input>: false` over every value input of a node whose
      // control signal is wired, on every project load; an explicit `true`
      // survives it and an absent key does not. `width` arriving IS this node's
      // only trigger, so losing it would freeze the shell in whichever shape it
      // first rendered.
      'runOnChange-in-width': true,
      functionScript: [
        // `Screen Resolution` is client-only (`screenresolution.ts:15`), so on a
        // server render the width is genuinely unknown — and the guarded return
        // leaves the AUTHORED wide shape standing, which is the right default
        // for a screen nobody has measured yet.
        'if (Inputs.width === undefined) return;',
        // 240 for the rail leaves under 500px of content below this, which is
        // narrower than the page editor's own two-up field row wants. Above it
        // the rail is affordable; below it, it is the only thing on the screen.
        'const roomy = Inputs.width >= 760;',
        "Outputs.frameDirection = roomy ? 'row' : 'column';",
        "Outputs.railSizeMode = roomy ? 'explicit' : 'contentHeight';",
        // ⚠️ A FRESH object each run, and that is load-bearing: a `Function`'s
        // `Outputs` proxy publishes only when the value CHANGES, so a shared
        // constant would be sent once and never re-sent after a resize back.
        // The three strings above are deliberately the opposite — they should
        // publish only at the crossing.
        "Outputs.railWidth = roomy ? { value: 240, unit: 'px' } : { value: 100, unit: '%' };",
        "Outputs.railRightBorder = roomy ? 'solid' : 'none';"
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
    id: 'goMessages',
    type: 'RouterNavigate',
    label: 'To the messages list',
    // 🔴 **SBR-010.** This node is the thing the sidebar item has been missing
    // since SBR-006 built the rail: `navMessages` rendered, took the current-item
    // styling like its siblings, and went nowhere. The gap was recorded in this
    // file rather than papered over, and the comment at the foot of
    // `ADMIN_SHELL_WIRES` is what has just been paid.
    //
    // `deferred`, like `goPages` and `goTheme`: `/Admin/Shell` is written FIRST
    // and `/Pages/Messages` does not exist until the SB-005 create pass reaches
    // it. A `RouterNavigate.target` is resolved AT THE DOOR — measured, s6:
    // `unresolved-navigation`, blocking, with a *did you mean* — so this is not
    // a precaution, it is the difference between the component being written and
    // being refused.
    parameters: { router: ROUTER, target: '/Pages/Messages' }
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
  },

  // ── SBR-009 AC1: the admin panel wears the client's theme too ──────────────
  {
    id: 'adminTheme',
    type: 'DbCollection2',
    label: 'Theme (one row)',
    // No `storageFetch` wire anywhere in this component, so the load-time fetch
    // survives the NDA-017 migration untouched and no `runOnChange-*` key is
    // owed here — unlike `/Pages/ThemeEditor`'s copy, which wires one and has to
    // say so out loud. The difference is worth the two sentences: it is the same
    // node, in the same template, correctly configured two different ways.
    parameters: { collectionName: 'Theme' }
  },
  {
    id: 'applyTheme',
    type: 'JavaScriptFunction',
    label: 'The saved theme, on this document',
    parameters: {
      // 🔴 **SBR-009 AC1, and the reason it lives in the SHELL.** Every admin
      // screen places this component, so one node themes all of them and cannot
      // disagree with itself between two — the same argument that made the
      // sidebar a component. Without it a client changed their site's colour and
      // the panel they changed it from stayed the shipped Studio blue, which
      // reads as "it did not work".
      //
      // The script is `buildThemeApplierScript()` — the SAME body the public
      // site's applier runs, extracted rather than retyped. Two appliers is the
      // second-copy-of-a-palette trap: the derived companions
      // (`--primary-hover`, `--ring`, the two border steps) are what would drift
      // first, and nobody edits two appliers on the same day.
      //
      // ⚠️ `runOnChange-in-rows` is unstated on all three appliers, and the
      // artefact still carries it — see `/Pages/ThemeEditor`'s copy for the
      // measurement.
      functionScript: buildThemeApplierScript()
    }
  }
];

export const ADMIN_SHELL_WIRES = [
  { fromId: 'adminTheme', fromProperty: 'items', toId: 'applyTheme', toProperty: 'in-rows' },
  { fromId: 'adminTheme', fromProperty: 'fetched', toId: 'applyTheme', toProperty: 'run' },

  { fromId: 'inputs', fromProperty: 'active', toId: 'navStyle', toProperty: 'in-active' },

  // REL-011c A1. Four ports, one reading, and they have to move together: a
  // stacked frame whose rail still states 240px is a 240px block with the
  // content beneath it, and a rail at 100% inside a ROW is the whole screen.
  { fromId: 'viewport', fromProperty: 'width', toId: 'fold', toProperty: 'in-width' },
  { fromId: 'fold', fromProperty: 'out-frameDirection', toId: 'frame', toProperty: 'flexDirection' },
  { fromId: 'fold', fromProperty: 'out-railSizeMode', toId: 'sidebar', toProperty: 'sizeMode' },
  { fromId: 'fold', fromProperty: 'out-railWidth', toId: 'sidebar', toProperty: 'width' },
  { fromId: 'fold', fromProperty: 'out-railRightBorder', toId: 'sidebar', toProperty: 'borderRightStyle' },

  { fromId: 'navStyle', fromProperty: 'out-pagesColor', toId: 'navPages', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-pagesWeight', toId: 'navPages', toProperty: 'fontWeight' },
  { fromId: 'navStyle', fromProperty: 'out-themeColor', toId: 'navTheme', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-themeWeight', toId: 'navTheme', toProperty: 'fontWeight' },
  { fromId: 'navStyle', fromProperty: 'out-messagesColor', toId: 'navMessages', toProperty: 'color' },
  { fromId: 'navStyle', fromProperty: 'out-messagesWeight', toId: 'navMessages', toProperty: 'fontWeight' },

  { fromId: 'navPages', fromProperty: 'onClick', toId: 'goPages', toProperty: 'navigate' },
  { fromId: 'navTheme', fromProperty: 'onClick', toId: 'goTheme', toProperty: 'navigate' },
  // 🔴 SBR-010. The third rail item finally goes somewhere. Every other wire in
  // this block predates it; this one is the whole of the shell's share of the
  // task, and `sbr010Messages.test.ts` asserts it by name because "the item is
  // in the sidebar" was true throughout the eleven sessions it did nothing.
  { fromId: 'navMessages', fromProperty: 'onClick', toId: 'goMessages', toProperty: 'navigate' },
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
    parameters: { ...FIELD, useLabel: true, label: 'Title' }
  },
  {
    id: 'slugField',
    type: 'net.noodl.controls.textinput',
    label: 'Slug',
    parent: 'card',
    parameters: { ...FIELD, useLabel: true, label: 'Slug' }
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
    parameters: { ...SECONDARY_BUTTON, label: 'Cancel' }
  },
  {
    id: 'createButton',
    type: 'net.noodl.controls.button',
    label: 'Create page',
    parent: 'actions',
    parameters: { ...PRIMARY_BUTTON, label: 'Create page' }
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
      as: 'h1',
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
    parameters: { ...FIELD, useLabel: true, label: 'Email', type: 'email' }
  },
  {
    id: 'passwordField',
    type: 'net.noodl.controls.textinput',
    label: 'Password',
    parent: 'shell',
    parameters: { ...FIELD, useLabel: true, label: 'Password', type: 'password' }
  },
  {
    id: 'signInButton',
    type: 'net.noodl.controls.button',
    label: 'Sign in',
    parent: 'shell',
    parameters: { ...PRIMARY_BUTTON, label: 'Sign in' }
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
// ── 10. Admin/MessageRow — one stored enquiry ───────────────────────────────

/**
 * SBR-010's repeater item, and the first thing in this template that ever reads
 * a `ContactMessage` back.
 *
 * 🔴 **The record shape is not invented here.** SB-004's `submitContactForm`
 * writes exactly four fields — `name`, `email`, `message`, `pageSlug` — plus
 * `handled: false` and `ADMIN_ONLY_RULES`, and the ports below are that list
 * (§4's first trap: read the cloud component, do not author a parallel class).
 * `createdAt` is the fifth thing a row carries and the one nobody wrote: Parse
 * mints it, `cloudstore.js`'s `_fromJSON` copies every key that is not
 * `objectId` or `ACL` onto the model, and `For Each` delivers any declared input
 * whose name matches a field (`foreach.tsx:594-596`). So "received-at" costs a
 * port and no schema change.
 *
 * ⚠️ **`createdAt` is typed `*` on purpose, because its runtime type is not one
 * thing.** `_deserializeJSON` turns it into a `Date` when the class schema has
 * been loaded and declares it `Date`, and leaves it the ISO **string** the wire
 * carried when it has not (`cloudstore.js:345-356` — the branch is keyed on the
 * schema, not on the value). A row rendered before the schema arrives and the
 * same row rendered after it would otherwise be two different types on the same
 * port. {@link buildReceivedStampScript} accepts both and is the only place that
 * has to know.
 *
 * 🔴 **No write node lives here**, and that is the scope rather than an
 * oversight: reply, delete and mark-read are named in {@link MESSAGES_DEFERRED}
 * and the screen says so out loud. `handled` is written once, by the cloud
 * function, and read by nothing — which is a promise this task deliberately does
 * not make.
 */

/**
 * The name a message is filed under when the visitor left the box empty.
 *
 * 🔴 The SAME words `submitContactForm`'s `compose` uses (`sb004Components.ts`:
 * *"New enquiry from " + (Inputs.name || "a visitor")*), because the owner reads
 * both: the mail that arrived in their inbox and the row on this screen are the
 * same event, and two different fallbacks would make them look like two.
 */
export const ANONYMOUS_SENDER = 'A visitor';

/**
 * `createdAt` and `pageSlug`, turned into the two sentences a person reads.
 *
 * 🔴 **The date is formatted here rather than by `toLocaleString()`**, and the
 * reason is that this screen is graded in a headless browser: `toLocaleString`
 * answers whatever the host's locale and time zone say, so the assertion would
 * be about the machine that ran it. `1 Sep 2026, 22:41` is the same string
 * everywhere and is still a date a person reads without decoding it.
 *
 * ⚠️ It is deliberately NOT relative ("2 hours ago"). A relative stamp is
 * computed once, at mount, and then quietly rots on a screen somebody leaves
 * open — the list has no clock and nothing re-runs this.
 */
export function buildReceivedStampScript(): string {
  return [
    "const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];",
    "const pad = (n) => (n < 10 ? '0' + n : String(n));",
    // Both shapes `createdAt` legitimately arrives in — see the module note.
    'const raw = Inputs.createdAt;',
    "const at = raw instanceof Date ? raw : typeof raw === 'string' && raw !== '' ? new Date(raw) : null;",
    'const known = at !== null && !isNaN(at.getTime());',
    "Outputs.when = known",
    "  ? at.getDate() + ' ' + MONTHS[at.getMonth()] + ' ' + at.getFullYear() + ', ' + pad(at.getHours()) + ':' + pad(at.getMinutes())",
    // 🔴 A time that is not known says so, rather than rendering an empty cell
    // that reads as "just now". SBR-016's rule, applied to one field.
    "  : 'Received at an unknown time';",
    "const name = typeof Inputs.name === 'string' ? Inputs.name.trim() : '';",
    `Outputs.who = name !== '' ? name : ${JSON.stringify(ANONYMOUS_SENDER)};`,
    // `pageSlug` is the ONE optional parameter of the four (`preq-pageSlug:
    // false`), so absent and empty are different facts about the request and
    // only the first hides the line.
    "const hasSlug = typeof Inputs.pageSlug === 'string';",
    "const slug = hasSlug ? Inputs.pageSlug.trim() : '';",
    'Outputs.hasSource = hasSlug;',
    // The empty slug IS the site root — the same fact `/Admin/Shell`'s `goSite`
    // encodes as `pm-slug: ''`.
    "Outputs.source = slug === '' ? 'Sent from the home page' : 'Sent from the ' + slug + ' page';"
  ].join('\n');
}

export const MESSAGE_ROW_NODES = [
  {
    id: 'row',
    type: 'Group',
    label: 'One message',
    // Child of the list's COLUMN, so `STACKED` — without it every row is
    // `height: 100%` along that column and N messages divide the screen between
    // them instead of stacking. `/Admin/PageRow` records the same trap.
    parameters: {
      ...STACKED,
      flexDirection: 'column',
      rowGap: 'var(--space-1)',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)'
    },
    children: ['head', 'addr', 'bodyText', 'source']
  },
  {
    id: 'head',
    type: 'Group',
    label: 'Who and when',
    parent: 'row',
    // ⚠️ `alignItems: 'center'` and not `'baseline'`, which is what was authored
    // first: the door refused it — `invalid-parameter-value`, with the four
    // options listed (`flex-start`, `flex-end`, `center`, `stretch`). The port is
    // an enum over Noodl's own alignment vocabulary, not CSS's.
    parameters: { ...STACKED, flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)' },
    children: ['who', 'when']
  },
  // 🔴 SB-018 (3) on all four: a `Text` whose only `text` is a wire renders the
  // literal word **Text** until that wire first publishes, because the node
  // declares `default: 'Text'` and a default applies until the port is set.
  {
    id: 'who',
    type: 'Text',
    label: 'Sender',
    parent: 'head',
    // Child of a ROW ⇒ `IN_A_ROW`, not `STACKED`: `contentHeight` still assigns
    // width, and the name would push the time off the row.
    parameters: {
      ...IN_A_ROW,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-semibold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'when',
    type: 'Text',
    label: 'Received',
    parent: 'head',
    parameters: {
      ...IN_A_ROW,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'addr',
    type: 'Text',
    label: 'Reply address',
    parent: 'row',
    // The one field that makes the read-only list useful: the owner replies from
    // their own mail client, which is what {@link MESSAGES_READ_ONLY_TEXT} says.
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--primary)'
    }
  },
  {
    id: 'bodyText',
    type: 'Text',
    label: 'The message',
    parent: 'row',
    parameters: {
      ...STACKED,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--foreground)',
      marginTop: 'var(--space-2)'
    }
  },
  {
    id: 'source',
    type: 'Text',
    label: 'Which page it came from',
    parent: 'row',
    // 🔴 `mounted`, never `visible`: a message whose request carried no
    // `pageSlug` must take no space, not leave a blank line. P78 D16 was exactly
    // that bug in this template.
    parameters: {
      ...STACKED,
      mounted: false,
      text: '',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The stored message',
    // `For Each` sets `id` to `model.getId()` and every OTHER declared input to
    // the field of the same name; an undeclared field is simply not delivered.
    // So this list is exactly what a row can see, and it is the shape
    // `submitContactForm` writes plus the two Parse mints.
    ports: [
      { name: 'id', type: 'string', plug: 'output' },
      { name: 'name', type: 'string', plug: 'output' },
      { name: 'email', type: 'string', plug: 'output' },
      { name: 'message', type: 'string', plug: 'output' },
      { name: 'pageSlug', type: 'string', plug: 'output' },
      // `*` — see the module note: `Date` or ISO string, depending on whether
      // the class schema had loaded when the row was deserialised.
      { name: 'createdAt', type: '*', plug: 'output' }
    ]
  },
  {
    id: 'stamp',
    type: 'JavaScriptFunction',
    label: 'The two derived sentences',
    parameters: {
      // 🔴 Authored `true`, and the reason is `/Admin/Shell`'s `navStyle`'s: this
      // node has NO wired control signal today, so the NDA-017 migration does not
      // reach it and `pinRunOnValueChangeDefaults` writes nothing here either.
      // The keys are present so that wiring a `run` later cannot silently stop
      // three component inputs from redrawing the row.
      'runOnChange-in-name': true,
      'runOnChange-in-createdAt': true,
      'runOnChange-in-pageSlug': true,
      functionScript: buildReceivedStampScript()
    }
  }
];

export const MESSAGE_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'name', toId: 'stamp', toProperty: 'in-name' },
  { fromId: 'inputs', fromProperty: 'createdAt', toId: 'stamp', toProperty: 'in-createdAt' },
  { fromId: 'inputs', fromProperty: 'pageSlug', toId: 'stamp', toProperty: 'in-pageSlug' },

  { fromId: 'stamp', fromProperty: 'out-who', toId: 'who', toProperty: 'text' },
  { fromId: 'stamp', fromProperty: 'out-when', toId: 'when', toProperty: 'text' },
  { fromId: 'stamp', fromProperty: 'out-source', toId: 'source', toProperty: 'text' },
  { fromId: 'stamp', fromProperty: 'out-hasSource', toId: 'source', toProperty: 'mounted' },

  // The two fields that need no derivation, straight off the record.
  { fromId: 'inputs', fromProperty: 'email', toId: 'addr', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'message', toId: 'bodyText', toProperty: 'text' }
];

// ── 11. Pages/Messages — the loop the product left open ─────────────────────

/**
 * SBR-010's person sentence: *"a visitor's message reaches the owner's eyes."*
 *
 * The contact form has stored rows since SB-004 and nothing has ever read one
 * back. The sidebar has carried a **Messages** item since SBR-006 and it went
 * nowhere. This is the screen at the other end of both.
 *
 * 🔴 **The query is unfiltered and wants its load-time fetch — the same case as
 * `/Pages/Admin`'s `pages`, with one difference that matters.** `pages` has to
 * author `runOnChange-collectionName: true` because it ALSO wires
 * `storageFetch` (a create and a row edit refresh it), and a wired control
 * signal is what puts a node in the NDA-017 migration's population. Nothing on
 * this screen writes a record, so nothing wires `storageFetch`, so the migration
 * never reaches this node and the absent key keeps its ticked default. The same
 * node, in the same template, correctly configured two different ways — exactly
 * as `/Admin/Shell`'s `adminTheme` is against `/Pages/ThemeEditor`'s copy.
 *
 * ⚠️ That is a real difference in behaviour and not only in bookkeeping: this
 * list does not refresh itself. A message that arrives while the owner is
 * looking at the screen appears on the next visit. Recorded in
 * {@link MESSAGES_DEFERRED} rather than left as a surprise.
 */

/**
 * What the list says when the query came back with nothing.
 *
 * 🔴 SBR-016's rule, and this screen is the one where it bites hardest: *nobody
 * has written to you yet* and *your form is broken* produce the same empty
 * column, and the owner of a new site has no way to tell which they are looking
 * at. The sentence says which, and says what would change it.
 */
export const EMPTY_MESSAGE_LIST_TEXT =
  'No messages yet. When somebody sends the contact form on your site, their message arrives here.';

/**
 * What the list says when the query was refused.
 *
 * `ContactMessage.find` is `role:admin` in `site-builder.security.json`, so a
 * signed-in principal who is not an admin gets a refusal — and until this
 * existed that refusal rendered pixel-identical to a site nobody has written to.
 * SBR-016 §2.2's third state, on the collection where the two are most different.
 */
export const MESSAGE_LIST_ERROR_TEXT =
  'Your messages could not be loaded. You may not have permission to manage this site.';

/**
 * What the screen tells the owner they can and cannot do here.
 *
 * 🔴 **§2's third bullet, on the screen rather than only in this file.** The
 * live-preview lesson is that undocumented dropping is the one state a promise
 * must not be in — and a list of enquiries with no Reply button is a promise
 * being dropped silently unless the screen says what to do instead. It names the
 * thing that DOES work: every row shows the sender's address.
 */
export const MESSAGES_READ_ONLY_TEXT =
  'Messages are read to here, not answered from here — reply from your own email using the address on the message.';

/**
 * What SBR-010 deliberately does not build, with the reason for each.
 *
 * 🔴 An exported list rather than a paragraph, because a deferral nobody can
 * enumerate is indistinguishable from an omission nobody noticed —
 * `sbr010Messages.test.ts` asserts the screen carries no node that would
 * implement one of these, so the list cannot quietly stop being true.
 */
export const MESSAGES_DEFERRED: ReadonlyArray<{ what: string; why: string }> = [
  {
    what: 'reply',
    why: 'a reply is an outbound email, which is a cloud function and a second recipient contract — SB-004 F8 has the address question open with Richard, and a Reply box that mailed from the site owner’s own server is a bigger promise than this task'
  },
  {
    what: 'delete',
    why: '`ContactMessage.delete` is `nobody` in site-builder.security.json — the policy already refuses it, and a button that could only ever fail is worse than no button'
  },
  {
    what: 'mark as read',
    why: '`handled: false` is written by submitContactForm and read by nothing; making it mean something needs a write from the panel, which is the ACL question this read-only screen deliberately does not open'
  },
  {
    what: 'live refresh',
    why: 'nothing on this screen writes a record, so nothing wires storageFetch — a message arriving while the owner watches appears on the next visit. SBR-011’s realtime hub is where that belongs, not here'
  }
];

export const MESSAGES_NODES = [
  {
    id: 'page',
    type: 'Page',
    label: 'Messages',
    parameters: { title: 'Messages', urlPath: `${ADMIN_PATH_PREFIX}/messages` },
    children: ['adminShell']
  },
  {
    id: 'adminShell',
    type: '/Admin/Shell',
    label: 'Admin shell',
    parent: 'page',
    // The THIRD placement of `/Admin/Shell`, and the third distinct `active`.
    // A shell with a hard-coded current item would render identically on all
    // three and nobody would notice until a person used it.
    parameters: { active: 'messages' },
    children: ['body']
  },
  {
    id: 'body',
    type: 'Group',
    label: 'Messages body',
    parent: 'adminShell',
    parameters: { ...STACKED, flexDirection: 'column', rowGap: 'var(--space-4)' },
    children: ['heading', 'readOnlyNote', 'tallyLine', 'listError', 'list']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'body',
    parameters: {
      ...STACKED,
      as: 'h1',
      text: 'Messages',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-bold)',
      color: 'var(--foreground)'
    }
  },
  {
    id: 'readOnlyNote',
    type: 'Text',
    label: 'What this screen does not do',
    parent: 'body',
    parameters: {
      ...STACKED,
      text: MESSAGES_READ_ONLY_TEXT,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--muted-foreground)'
    }
  },
  {
    id: 'tallyLine',
    type: 'Text',
    label: 'How many messages',
    parent: 'body',
    // Standing `text` per SB-018 (3), and empty rather than a guess: the two
    // things this line can say are both answers to a query that has returned,
    // and neither is true before it does.
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
    label: 'The message list was refused',
    parent: 'body',
    parameters: {
      ...STACKED,
      mounted: false,
      text: MESSAGE_LIST_ERROR_TEXT,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--destructive)'
    }
  },
  {
    id: 'list',
    type: 'For Each',
    label: 'One row per message',
    parent: 'body',
    parameters: { templateType: 'explicit', template: '/Admin/MessageRow' }
  },
  {
    id: 'messages',
    type: 'DbCollection2',
    label: 'Every message, newest first',
    parameters: {
      collectionName: 'ContactMessage',
      // 🔴 **AC4's first half, and it is a parameter rather than a sort in the
      // script.** `convertVisualSorting` lowers this to Parse's `-createdAt`
      // (`queryutils.ts:440`) and the BACKEND orders the page, so the order is
      // the same whatever subset comes back. A list sorted after the fetch would
      // be right only while every row fitted in one response.
      visualSort: MESSAGE_SORT
      // 🔴 No `runOnChange-collectionName` key, and the absence is the decision —
      // see the module note. Nothing here wires `storageFetch`, so the NDA-017
      // migration's population does not include this node and absent keeps the
      // ticked default that gives an unfiltered query its load-time fetch.
    }
  },
  {
    id: 'tally',
    type: 'JavaScriptFunction',
    label: 'The row-count sentence',
    parameters: {
      // 🔴 **`false`, and the browser is what settled it.** This started as
      // `true` — copied from `/Pages/Admin`'s `count`, where the reasoning is
      // that the NDA-017 migration would otherwise rewrite an absent key — and
      // the drive read the consequence on a signed-out visitor's screen:
      //
      //     You are not signed in. Sign in to manage this site.
      //     No messages yet. When somebody sends the contact form…
      //     Your messages could not be loaded. You may not have permission…
      //
      // **Three sentences, one of them a lie.** `run` is ADDITIVE — wiring it
      // does not stop a node running on its own — so `items` publishing an empty
      // collection ran this script with no successful query behind it, and the
      // screen told somebody who was never allowed to ask that they had no
      // messages. That is SBR-016's defect exactly, one state further along: the
      // task made *empty* distinguishable from *never asked*, and *refused* had
      // quietly joined them again.
      //
      // With the box off, `messages.fetched` is the only trigger and the line
      // stays at its standing `''` until a query has actually answered. The
      // value still ARRIVES — the `items` wire is untouched, and `Node.update`
      // drains one queued value from every input before running the callbacks
      // `fetched` scheduled, so the run that `fetched` triggers has the rows.
      // `/Pages/PageEditor`'s two planners are the same idiom for the same
      // reason.
      //
      // ⚠️ `/Pages/Admin`'s `count` is wired identically and states `true`, so
      // the page list is expected to carry the same defect. It is NOT changed
      // here: that screen is driven by three other tasks' acceptance criteria
      // and a blind edit to it would be a change to work that was verified
      // without re-verifying it. Registered as **D43**.
      'runOnChange-in-rows': false,
      functionScript: [
        'const rows = Array.isArray(Inputs.rows) ? Inputs.rows : [];',
        "const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];",
        'const word = (n) => (n < WORDS.length ? WORDS[n] : String(n));',
        // 🔴 AC3's pair, in one node. Zero is a different SENTENCE, not the count
        // sentence with a zero in it — and it only ever runs because `fetched`
        // fires on a successful query whatever the row count
        // (`dbcollectionnode2.ts:895`), which is the half SBR-016 had to fix
        // before an empty state could be told from a query that never asked.
        'if (rows.length === 0) {',
        `  Outputs.sentence = ${JSON.stringify(EMPTY_MESSAGE_LIST_TEXT)};`,
        '} else {',
        "  Outputs.sentence = word(rows.length) + (rows.length === 1 ? ' message' : ' messages');",
        '}'
      ].join('\n')
    }
  },
  {
    id: 'queryState',
    type: 'States',
    label: 'Did the last query refuse?',
    // `States` rather than a boolean for the reason `/Pages/Admin`'s copy is one:
    // it RESETS, so a refusal cannot outlive a later good fetch and stand beside
    // a populated list.
    parameters: {
      states: 'Quiet,Refused',
      values: 'refused',
      'type-refused': 'boolean',
      'value-Quiet-refused': false,
      'value-Refused-refused': true
    }
  }
];

export const MESSAGES_WIRES = [
  { fromId: 'messages', fromProperty: 'items', toId: 'list', toProperty: 'items' },

  { fromId: 'messages', fromProperty: 'items', toId: 'tally', toProperty: 'in-rows' },
  { fromId: 'messages', fromProperty: 'fetched', toId: 'tally', toProperty: 'run' },
  { fromId: 'tally', fromProperty: 'out-sentence', toId: 'tallyLine', toProperty: 'text' },

  // 🔴 The two outcomes drive the two states, so a refusal cannot be raised by a
  // successful query and cannot survive one either. `failure`, never `error`
  // as a trigger, and never `fetched` for both arms.
  { fromId: 'messages', fromProperty: 'failure', toId: 'queryState', toProperty: 'to-Refused' },
  { fromId: 'messages', fromProperty: 'fetched', toId: 'queryState', toProperty: 'to-Quiet' },
  { fromId: 'queryState', fromProperty: 'refused', toId: 'listError', toProperty: 'mounted' }
];

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
    deferred: ['goPages', 'goTheme', 'goMessages', 'goSignIn']
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
    // Before `/Pages/ThemeEditor`, which places it three times.
    path: 'Admin/PresetChip',
    key: 'Admin/PresetChip',
    legacyName: '/Admin/PresetChip',
    isPage: false,
    nodes: PRESET_CHIP_NODES,
    connections: PRESET_CHIP_WIRES
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
    // Before `/Pages/Messages`, which names it as a `For Each` template — and
    // that reference IS resolved at the door (`repeater-template-unresolved`,
    // blocking, measured s6), so this is an ordering the create pass enforces
    // rather than a convention.
    path: 'Admin/MessageRow',
    key: 'Admin/MessageRow',
    legacyName: '/Admin/MessageRow',
    isPage: false,
    nodes: MESSAGE_ROW_NODES,
    connections: MESSAGE_ROW_WIRES
  },
  {
    // 🔴 SBR-010. Nothing on this screen navigates anywhere, so unlike its three
    // sibling pages it has NO `deferred` list: the only names it uses are
    // `/Admin/MessageRow` above and `/Admin/Shell`, both already on disk. The
    // back-edge this page needs runs the OTHER way — `/Admin/Shell`'s
    // `goMessages`, which is why that component's `deferred` grew by one.
    path: 'Pages/Messages',
    key: 'Pages/Messages',
    legacyName: '/Pages/Messages',
    isPage: true,
    nodes: MESSAGES_NODES,
    connections: MESSAGES_WIRES
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

