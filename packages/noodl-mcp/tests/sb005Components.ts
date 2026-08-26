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
 * `BACKEND_DOCTRINE_MD` §"Four things a deployed graph does not do the way the
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
    parameters: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
    children: ['rowTitle', 'rowSlug', 'rowStatus', 'editButton', 'publishButton', 'unpublishButton', 'duplicateButton']
  },
  { id: 'rowTitle', type: 'Text', label: 'Title', parent: 'row', parameters: { fontWeight: 'var(--font-semibold)' } },
  { id: 'rowSlug', type: 'Text', label: 'Slug', parent: 'row' },
  {
    id: 'rowStatus',
    type: 'Text',
    label: 'Draft or published',
    parent: 'row',
    // Fed from `status`, below: the panel is the one reader `published` exists
    // for (SB-004 §3), and it reads the mirror rather than trying to infer the
    // ACL, which no browser query can see.
    parameters: { text: 'Draft' }
  },
  { id: 'editButton', type: 'net.noodl.controls.button', label: 'Edit', parent: 'row', parameters: { label: 'Edit' } },
  {
    id: 'publishButton',
    type: 'net.noodl.controls.button',
    label: 'Publish',
    parent: 'row',
    parameters: { label: 'Publish' }
  },
  {
    id: 'unpublishButton',
    type: 'net.noodl.controls.button',
    label: 'Unpublish',
    parent: 'row',
    parameters: { label: 'Unpublish' }
  },
  {
    id: 'duplicateButton',
    type: 'net.noodl.controls.button',
    label: 'Duplicate',
    parent: 'row',
    parameters: { label: 'Duplicate' }
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
    label: 'Draft or published, as a word',
    // Rule 1: no custom signal outputs on this node, so nothing to declare —
    // `Outputs.label` is a value and values need no port declaration.
    parameters: {
      functionScript: "Outputs.label = Inputs.published === true ? 'Published' : 'Draft';"
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
    // happened and the page decides. `For Each` forwards an item component's
    // Component Outputs signal as an output port of its own.
    ports: [{ name: 'Changed', type: 'signal', plug: 'input' }]
  }
];

export const PAGE_ROW_WIRES = [
  { fromId: 'inputs', fromProperty: 'title', toId: 'rowTitle', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'slug', toId: 'rowSlug', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'published', toId: 'status', toProperty: 'in-published' },
  { fromId: 'status', fromProperty: 'out-label', toId: 'rowStatus', toProperty: 'text' },

  { fromId: 'inputs', fromProperty: 'id', toId: 'publish', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'unpublish', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'duplicate', toProperty: 'in-pageId' },
  { fromId: 'inputs', fromProperty: 'id', toId: 'goEdit', toProperty: 'pm-pageId' },

  { fromId: 'publishButton', fromProperty: 'onClick', toId: 'publish', toProperty: 'call' },
  { fromId: 'unpublishButton', fromProperty: 'onClick', toId: 'unpublish', toProperty: 'call' },
  { fromId: 'duplicateButton', fromProperty: 'onClick', toId: 'duplicate', toProperty: 'call' },
  { fromId: 'editButton', fromProperty: 'onClick', toId: 'goEdit', toProperty: 'navigate' },

  // Every write the row can cause, reported once. `done` and not `completed`:
  // a refetch after a failure would redraw the same rows for no reason.
  { fromId: 'publish', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'unpublish', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' },
  { fromId: 'duplicate', fromProperty: 'done', toId: 'outputs', toProperty: 'Changed' }
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
    parameters: { flexDirection: 'column', paddingTop: 8, paddingBottom: 8 },
    children: ['kindText', 'bodyField', 'preview', 'pickButton', 'saveButton', 'deleteButton']
  },
  { id: 'kindText', type: 'Text', label: 'Kind', parent: 'row', parameters: { fontWeight: 'var(--font-semibold)' } },
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
    children: ['heading', 'blurb', 'emailField', 'passwordField', 'tokenField', 'claimButton', 'claimRefusal', 'signupRefusal']
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
  { fromId: 'signupGate', fromProperty: 'result', toId: 'signupRefusal', toProperty: 'visible' }
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
    type: 'Group',
    label: 'Panel',
    parent: 'page',
    parameters: { flexDirection: 'column', paddingTop: 24, paddingLeft: 24, paddingRight: 24 },
    children: ['heading', 'newRow', 'list', 'themeLink']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    parameters: { text: 'Pages', fontWeight: 'var(--font-bold)' }
  },
  {
    id: 'newRow',
    type: 'Group',
    label: 'New page',
    parent: 'shell',
    parameters: { flexDirection: 'row', alignItems: 'center' },
    children: ['newTitle', 'newSlug', 'newButton']
  },
  {
    id: 'newTitle',
    type: 'net.noodl.controls.textinput',
    label: 'New title',
    parent: 'newRow',
    parameters: { useLabel: true, label: 'Title' }
  },
  {
    id: 'newSlug',
    type: 'net.noodl.controls.textinput',
    label: 'New slug',
    parent: 'newRow',
    parameters: { useLabel: true, label: 'Slug' }
  },
  {
    id: 'newButton',
    type: 'net.noodl.controls.button',
    label: 'Create',
    parent: 'newRow',
    parameters: { label: 'New page' }
  },
  {
    id: 'list',
    type: 'For Each',
    label: 'One row per page',
    parent: 'shell',
    // ✅ `template` IS checked at the door — measured, not assumed:
    // `repeater-template-unresolved`, blocking, with the available names listed.
    // It is one of the two known-firing controls SB-009 names, so it is the
    // opposite of that task's finding rather than an instance of it; SB-009 is
    // about `RunTasks.taskTemplate` and the twelve other `component`-typed ports
    // with no owner.
    parameters: { templateType: 'explicit', template: '/Admin/PageRow' }
  },
  {
    id: 'themeLink',
    type: 'net.noodl.controls.button',
    label: 'Theme and settings',
    parent: 'shell',
    parameters: { label: 'Theme and settings' }
  },
  {
    id: 'pages',
    type: 'DbCollection2',
    label: 'Every page, draft and published',
    parameters: { collectionName: 'Page' }
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
    id: 'goTheme',
    type: 'RouterNavigate',
    label: 'To the theme editor',
    parameters: { router: ROUTER, target: '/Pages/ThemeEditor' }
  }
];

export const ADMIN_WIRES = [
  { fromId: 'pages', fromProperty: 'items', toId: 'list', toProperty: 'items' },

  { fromId: 'newTitle', fromProperty: 'onTextChanged', toId: 'create', toProperty: 'prop-title' },
  { fromId: 'newSlug', fromProperty: 'onTextChanged', toId: 'create', toProperty: 'prop-slug' },
  { fromId: 'newButton', fromProperty: 'onClick', toId: 'create', toProperty: 'store' },

  // The refresh, and both of its sources are write completions. See the module
  // header: on an UNFILTERED query this is unremarkable, because there is no
  // filter for the fetch to be early for.
  { fromId: 'create', fromProperty: 'done', toId: 'pages', toProperty: 'storageFetch' },
  { fromId: 'list', fromProperty: 'Changed', toId: 'pages', toProperty: 'storageFetch' },

  { fromId: 'themeLink', fromProperty: 'onClick', toId: 'goTheme', toProperty: 'navigate' }
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
    type: 'Group',
    label: 'Editor',
    parent: 'page',
    parameters: { flexDirection: 'column', paddingTop: 24, paddingLeft: 24, paddingRight: 24 },
    children: ['heading', 'titleField', 'slugField', 'seoField', 'navOrderField', 'showInNavBox', 'saveButton', 'addRow', 'sectionList', 'backButton']
  },
  {
    id: 'heading',
    type: 'Text',
    label: 'Heading',
    parent: 'shell',
    parameters: { text: 'Edit page', fontWeight: 'var(--font-bold)' }
  },
  {
    id: 'titleField',
    type: 'net.noodl.controls.textinput',
    label: 'Title',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Title' }
  },
  {
    id: 'slugField',
    type: 'net.noodl.controls.textinput',
    label: 'Slug',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Slug' }
  },
  {
    id: 'seoField',
    type: 'net.noodl.controls.textinput',
    label: 'SEO description',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Search description', type: 'textArea' }
  },
  {
    id: 'navOrderField',
    type: 'net.noodl.controls.textinput',
    label: 'Nav order',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Navigation order', type: 'number' }
  },
  {
    id: 'showInNavBox',
    type: 'net.noodl.controls.checkbox',
    label: 'Show in navigation',
    parent: 'shell',
    parameters: { useLabel: true, label: 'Show in navigation' }
  },
  {
    id: 'saveButton',
    type: 'net.noodl.controls.button',
    label: 'Save',
    parent: 'shell',
    parameters: { label: 'Save page' }
  },
  {
    id: 'addRow',
    type: 'Group',
    label: 'Add a section',
    parent: 'shell',
    parameters: { flexDirection: 'row', alignItems: 'center' },
    children: ['kindPicker', 'addButton']
  },
  {
    id: 'kindPicker',
    type: 'net.noodl.controls.options',
    label: 'Section kind',
    parent: 'addRow',
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
    parent: 'addRow',
    parameters: { label: 'Add section' }
  },
  {
    id: 'sectionList',
    type: 'For Each',
    label: 'One row per section',
    parent: 'shell',
    parameters: { templateType: 'explicit', template: '/Admin/SectionRow' }
  },
  {
    id: 'backButton',
    type: 'net.noodl.controls.button',
    label: 'Back',
    parent: 'shell',
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
  { fromId: 'sectionList', fromProperty: 'Changed', toId: 'sections', toProperty: 'storageFetch' },

  { fromId: 'sections', fromProperty: 'items', toId: 'sectionList', toProperty: 'items' },
  { fromId: 'backButton', fromProperty: 'onClick', toId: 'goBack', toProperty: 'navigate' }
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
    children: ['shell']
  },
  {
    id: 'shell',
    type: 'Group',
    label: 'Editor',
    parent: 'page',
    parameters: { flexDirection: 'column', paddingTop: 24, paddingLeft: 24, paddingRight: 24 },
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
      functionScript:
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        'const t = first.tokens || {};\n' +
        "Outputs.primary = t.colorPrimary || '';\n" +
        "Outputs.background = t.colorBackground || '';\n" +
        "Outputs.text = t.colorText || '';\n" +
        "Outputs.font = t.fontFamily || '';"
    }
  },
  {
    id: 'buildTokens',
    type: 'JavaScriptFunction',
    label: 'The four tokens, as one object',
    // Rule 1.
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // The keys are the contract with the public site, so they are written here
      // whether or not the author filled every field — a missing key and an
      // empty one are different things to a reader that does `tokens.colorText`.
      functionScript:
        'Outputs.tokens = {\n' +
        "  colorPrimary: Inputs.primary || '',\n" +
        "  colorBackground: Inputs.background || '',\n" +
        "  colorText: Inputs.text || '',\n" +
        "  fontFamily: Inputs.font || ''\n" +
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
  { fromId: 'readTheme', fromProperty: 'out-font', toId: 'fontField', toProperty: 'startValue' },

  // `firstItemId` is the singleton's id — the row `claimSite` wrote.
  { fromId: 'settings', fromProperty: 'firstItemId', toId: 'saveSettings', toProperty: 'modelId' },
  { fromId: 'siteNameField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-siteName' },
  { fromId: 'homeSlugField', fromProperty: 'onTextChanged', toId: 'saveSettings', toProperty: 'prop-homeSlug' },
  { fromId: 'settingsButton', fromProperty: 'onClick', toId: 'saveSettings', toProperty: 'store' },

  { fromId: 'primaryField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-primary' },
  { fromId: 'backgroundField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-background' },
  { fromId: 'textField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-text' },
  { fromId: 'fontField', fromProperty: 'onTextChanged', toId: 'buildTokens', toProperty: 'in-font' },
  { fromId: 'themeButton', fromProperty: 'onClick', toId: 'buildTokens', toProperty: 'run' },
  { fromId: 'theme', fromProperty: 'firstItemId', toId: 'saveTheme', toProperty: 'modelId' },
  { fromId: 'buildTokens', fromProperty: 'out-tokens', toId: 'saveTheme', toProperty: 'prop-tokens' },
  { fromId: 'buildTokens', fromProperty: 'out-built', toId: 'saveTheme', toProperty: 'store' },

  { fromId: 'backButton', fromProperty: 'onClick', toId: 'goBack', toProperty: 'navigate' }
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
    path: 'Pages/Admin',
    key: 'Pages/Admin',
    legacyName: '/Pages/Admin',
    isPage: true,
    nodes: ADMIN_NODES,
    connections: ADMIN_WIRES
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

