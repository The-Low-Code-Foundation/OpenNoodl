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
 * 4. A signal cannot drive a `visible` port: one entry per input name in the
 *    drain queue means a `true`/`false` pair coalesces, so a signal arrives once
 *    as `false`. Every reveal goes through a `Condition` node, whose `result` is
 *    a value.
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
  COLLECTION_REQUEST,
  FN_CLAIM,
  FN_DECIDE,
  FN_MY_STANDING,
  FN_REQUEST_ACCESS,
  MEETING_SORT,
  MEMBERS_READ_RULES,
  NO_ANNOUNCEMENTS_TEXT,
  NO_LOAD_TIME_FETCH,
  NO_MEETINGS_TEXT,
  NO_REQUESTS_TEXT,
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

/** The repeater templates, named once so a page and its row cannot drift apart. */
export const ANNOUNCEMENT_ROW = '/Members/AnnouncementRow';
export const MEETING_ROW = '/Members/MeetingRow';
export const REQUEST_ROW = '/Members/RequestRow';

/** Page path parameters, spelled once for the `urlPath` and the `PageInputs`. */
const ANNOUNCEMENT_PARAM = 'announcementId';
const MEETING_PARAM = 'meetingId';

/** A `Group` that fills its page and stacks its children. */
const PAGE_GROUND = {
  sizeMode: 'explicit',
  width: { value: 100, unit: '%' },
  height: { value: 100, unit: '%' },
  paddingTop: { value: 48, unit: 'px' },
  paddingLeft: { value: 24, unit: 'px' },
  paddingRight: { value: 24, unit: 'px' },
  flexDirection: 'column'
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
 * `visible` (rule 4: a signal into a value port arrives once as `false`, so a
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
      children: ['heading', 'blurb', 'actions', 'setupCard']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Association name',
      parent: 'ground',
      // Rule 3: a standing empty text, so nothing renders the word "Text" while
      // the record is on its way.
      parameters: { text: '', fontWeight: 'var(--font-bold)' }
    },
    { id: 'blurb', type: 'Text', label: 'What we do', parent: 'ground', parameters: { text: '' } },
    {
      id: 'actions',
      type: 'Group',
      label: 'Ways in',
      parent: 'ground',
      parameters: { flexDirection: 'row', alignItems: 'center' },
      children: ['signInButton', 'joinButton']
    },
    {
      id: 'signInButton',
      type: 'net.noodl.controls.button',
      label: 'Members sign in',
      parent: 'actions',
      parameters: { label: 'Members sign in' }
    },
    {
      id: 'joinButton',
      type: 'net.noodl.controls.button',
      label: 'Ask to join',
      parent: 'actions',
      parameters: { label: 'Ask to join' }
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
      parameters: { flexDirection: 'column', visible: false },
      children: ['setupText', 'setupButton']
    },
    {
      id: 'setupText',
      type: 'Text',
      label: 'Setup notice',
      parent: 'setupCard',
      parameters: { text: 'This members’ area has not been set up yet.' }
    },
    {
      id: 'setupButton',
      type: 'net.noodl.controls.button',
      label: 'Set it up',
      parent: 'setupCard',
      parameters: { label: 'Set it up' }
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
    { fromId: 'read', fromProperty: 'out-needsSetup', toId: 'setupCard', toProperty: 'visible' },
    // The two ways in are hidden until there is something to be a member of.
    { fromId: 'read', fromProperty: 'out-hasAssociation', toId: 'actions', toProperty: 'visible' },

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
      children: ['heading', 'email', 'password', 'submit', 'error', 'joinHint', 'joinButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Members sign in', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'email',
      type: 'net.noodl.controls.textinput',
      label: 'Email',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Email', type: 'email' }
    },
    {
      id: 'password',
      type: 'net.noodl.controls.textinput',
      label: 'Password',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Password', type: 'password' }
    },
    {
      id: 'submit',
      type: 'net.noodl.controls.button',
      label: 'Sign in',
      parent: 'ground',
      parameters: { label: 'Sign in' }
    },
    {
      // Empty until a sign-in is refused — `Log In`'s `error` is "empty until one does".
      id: 'error',
      type: 'Text',
      label: 'Sign-in error',
      parent: 'ground',
      parameters: { text: '' }
    },
    {
      id: 'joinHint',
      type: 'Text',
      label: 'Not a member yet',
      parent: 'ground',
      parameters: { text: 'Not a member yet?' }
    },
    {
      id: 'joinButton',
      type: 'net.noodl.controls.button',
      label: 'Ask to join',
      parent: 'ground',
      parameters: { label: 'Ask to join' }
    },
    { id: 'login', type: 'net.noodl.user.LogIn', label: 'Log in' },
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
    { fromId: 'login', fromProperty: 'error', toId: 'error', toProperty: 'text' },
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
    parameters: { flexDirection: 'column', paddingTop: 8, paddingBottom: 8 },
    children: ['rowTitle', 'rowDate', 'readButton']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'row',
    parameters: { text: '', fontWeight: 'var(--font-semibold)' }
  },
  { id: 'rowDate', type: 'Text', label: 'Posted', parent: 'row', parameters: { text: '' } },
  {
    id: 'readButton',
    type: 'net.noodl.controls.button',
    label: 'Read',
    parent: 'row',
    parameters: { label: 'Read' }
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
    parameters: { flexDirection: 'column', paddingTop: 8, paddingBottom: 8 },
    children: ['rowTitle', 'rowWhen', 'rowPlace', 'detailButton']
  },
  {
    id: 'rowTitle',
    type: 'Text',
    label: 'Title',
    parent: 'row',
    parameters: { text: '', fontWeight: 'var(--font-semibold)' }
  },
  { id: 'rowWhen', type: 'Text', label: 'When', parent: 'row', parameters: { text: '' } },
  { id: 'rowPlace', type: 'Text', label: 'Where', parent: 'row', parameters: { text: '' } },
  {
    id: 'detailButton',
    type: 'net.noodl.controls.button',
    label: 'Details',
    parent: 'row',
    parameters: { label: 'Details' }
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
    parameters: { flexDirection: 'column', paddingTop: 8, paddingBottom: 8 },
    children: ['rowName', 'rowMessage', 'buttons']
  },
  {
    id: 'rowName',
    type: 'Text',
    label: 'Who',
    parent: 'row',
    parameters: { text: '', fontWeight: 'var(--font-semibold)' }
  },
  { id: 'rowMessage', type: 'Text', label: 'Why', parent: 'row', parameters: { text: '' } },
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
    parameters: { label: 'Approve' }
  },
  {
    id: 'declineButton',
    type: 'net.noodl.controls.button',
    label: 'Decline',
    parent: 'buttons',
    parameters: { label: 'Decline' }
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
      parameters: { text: 'Members', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'pendingNotice',
      type: 'Text',
      label: 'Waiting to be approved',
      parent: 'ground',
      // 🔴 AC3's screen. A pending member is refused exactly as a stranger is,
      // and this is the sentence that stops that refusal reading as a broken app.
      parameters: { text: PENDING_TEXT, visible: false }
    },
    {
      id: 'unknownNotice',
      type: 'Text',
      label: 'Membership could not be checked',
      parent: 'ground',
      parameters: { text: STANDING_UNKNOWN_TEXT, visible: false }
    },
    {
      id: 'memberArea',
      type: 'Group',
      label: 'What a member sees',
      parent: 'ground',
      parameters: { flexDirection: 'column', visible: false },
      children: ['listHeading', 'list', 'emptyState', 'meetingsButton']
    },
    {
      id: 'listHeading',
      type: 'Text',
      label: 'Announcements',
      parent: 'memberArea',
      parameters: { text: 'Announcements', fontWeight: 'var(--font-semibold)' }
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
    {
      id: 'emptyState',
      type: 'Text',
      label: 'Nothing posted yet',
      parent: 'memberArea',
      // 🔴 AC6 — a template ships graphs, not rows, so this is the first thing
      // every person who installs it sees. Hidden until a query has actually
      // answered: `isEmpty` is true before the first fetch, so binding it
      // straight to this would show "nothing posted yet" to a member whose
      // announcements are still on their way.
      parameters: { text: NO_ANNOUNCEMENTS_TEXT, visible: false }
    },
    {
      id: 'meetingsButton',
      type: 'net.noodl.controls.button',
      label: 'What is coming up',
      parent: 'memberArea',
      parameters: { label: 'What’s coming up' }
    },
    {
      id: 'moderatorTools',
      type: 'Group',
      label: 'What only a moderator sees',
      parent: 'ground',
      // 🔴 AC4's first half. The second half — the write being refused at the
      // server — is `Announcement.create: role:admin` in the policy, and it is
      // the half that counts: UI-only enforcement fails that criterion.
      parameters: { flexDirection: 'row', alignItems: 'center', visible: false },
      children: ['postButton', 'requestsButton']
    },
    {
      id: 'postButton',
      type: 'net.noodl.controls.button',
      label: 'Post something',
      parent: 'moderatorTools',
      parameters: { label: 'Post something' }
    },
    {
      id: 'requestsButton',
      type: 'net.noodl.controls.button',
      label: 'Requests to join',
      parent: 'moderatorTools',
      parameters: { label: 'Requests to join' }
    },
    {
      id: 'signOutButton',
      type: 'net.noodl.controls.button',
      label: 'Sign out',
      parent: 'ground',
      parameters: { label: 'Sign out' }
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
    }
  ],
  connections: [
    { fromId: 'page', fromProperty: 'didMount', toId: 'standing', toProperty: 'Check' },
    { fromId: 'standing', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'moderatorTools', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isUnknown', toId: 'unknownNotice', toProperty: 'visible' },
    // 🔴 The only trigger the query has.
    { fromId: 'standing', fromProperty: 'Member', toId: 'announcements', toProperty: 'storageFetch' },
    // A visitor is sent back to the front door rather than left on a page with
    // nothing on it. The refusal is the server's; this is the courtesy.
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'announcements', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'announcements', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'announcements', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'visible' },

    { fromId: 'meetingsButton', fromProperty: 'onClick', toId: 'toMeetings', toProperty: 'navigate' },
    { fromId: 'postButton', fromProperty: 'onClick', toId: 'toPost', toProperty: 'navigate' },
    { fromId: 'requestsButton', fromProperty: 'onClick', toId: 'toRequests', toProperty: 'navigate' },

    // 🔴 `login`, on the Log Out node, is not a typo. `logout.ts:67` states why:
    // *"Named `login` rather than `logout`: the port name is persisted in every
    // project that uses this node, so it cannot be corrected without breaking
    // them."* It is displayed as "Do". The door refuses `logout` and suggests
    // this, which is how it was found.
    { fromId: 'signOutButton', fromProperty: 'onClick', toId: 'logout', toProperty: 'login' },
    { fromId: 'logout', fromProperty: 'done', toId: 'toLanding', toProperty: 'navigate' }
  ],
  deferred: ['toMeetings', 'toPost', 'toRequests']
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
    { id: 'title', type: 'Text', label: 'Title', parent: 'ground', parameters: { text: '', fontWeight: 'var(--font-bold)' } },
    { id: 'date', type: 'Text', label: 'Posted', parent: 'ground', parameters: { text: '' } },
    { id: 'body', type: 'Text', label: 'Body', parent: 'ground', parameters: { text: '' } },
    {
      id: 'refusal',
      type: 'Text',
      label: 'Not available',
      parent: 'ground',
      parameters: { text: 'This announcement is not available to you.', visible: false }
    },
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: { label: 'Back to announcements' }
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
      // value a `visible` port can read. A signal wired straight to `visible`
      // arrives once as `false` and reveals nothing, ever.
      parameters: { condition: true }
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
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'visible' },

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
      parameters: { text: 'What’s coming up', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'pendingNotice',
      type: 'Text',
      label: 'Waiting to be approved',
      parent: 'ground',
      parameters: { text: PENDING_TEXT, visible: false }
    },
    {
      id: 'memberArea',
      type: 'Group',
      label: 'What a member sees',
      parent: 'ground',
      parameters: { flexDirection: 'column', visible: false },
      children: ['list', 'emptyState']
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per meeting',
      parent: 'memberArea',
      parameters: { templateType: 'explicit', template: MEETING_ROW }
    },
    {
      id: 'emptyState',
      type: 'Text',
      label: 'Nothing in the diary',
      parent: 'memberArea',
      parameters: { text: NO_MEETINGS_TEXT, visible: false }
    },
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: { label: 'Back to the members area' }
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
    { fromId: 'standing', fromProperty: 'isMember', toId: 'memberArea', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isPending', toId: 'pendingNotice', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'Member', toId: 'today', toProperty: 'run' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'today', fromProperty: 'out-day', toId: 'meetings', toProperty: 'qp-today' },
    { fromId: 'meetings', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'meetings', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'meetings', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'visible' },

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
    { id: 'title', type: 'Text', label: 'Title', parent: 'ground', parameters: { text: '', fontWeight: 'var(--font-bold)' } },
    { id: 'when', type: 'Text', label: 'When', parent: 'ground', parameters: { text: '' } },
    { id: 'place', type: 'Text', label: 'Where', parent: 'ground', parameters: { text: '' } },
    { id: 'details', type: 'Text', label: 'Details', parent: 'ground', parameters: { text: '' } },
    {
      id: 'refusal',
      type: 'Text',
      label: 'Not available',
      parent: 'ground',
      parameters: { text: 'This meeting is not available to you.', visible: false }
    },
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: { label: 'Back to the diary' }
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
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { condition: true } },
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
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'visible' },

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
      children: ['heading', 'nameField', 'emailField', 'passwordField', 'messageField', 'sendButton', 'sent', 'refusal', 'hint', 'signInButton']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Ask to join', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'nameField',
      type: 'net.noodl.controls.textinput',
      label: 'Your name',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Your name' }
    },
    {
      id: 'emailField',
      type: 'net.noodl.controls.textinput',
      label: 'Email',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Email', type: 'email' }
    },
    {
      id: 'passwordField',
      type: 'net.noodl.controls.textinput',
      label: 'Choose a password',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Choose a password', type: 'password' }
    },
    {
      id: 'messageField',
      type: 'net.noodl.controls.textinput',
      label: 'Why you would like to join',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Why you’d like to join', type: 'textArea' }
    },
    {
      id: 'sendButton',
      type: 'net.noodl.controls.button',
      label: 'Send',
      parent: 'ground',
      parameters: { label: 'Send my request' }
    },
    {
      id: 'sent',
      type: 'Text',
      label: 'Request received',
      parent: 'ground',
      parameters: { text: REQUEST_SENT_TEXT, visible: false }
    },
    {
      id: 'refusal',
      type: 'Text',
      label: 'The one refusal',
      parent: 'ground',
      parameters: { text: REQUEST_REFUSED_TEXT, visible: false }
    },
    { id: 'hint', type: 'Text', label: 'Already a member', parent: 'ground', parameters: { text: ALREADY_A_MEMBER_HINT } },
    {
      id: 'signInButton',
      type: 'net.noodl.controls.button',
      label: 'Sign in',
      parent: 'ground',
      parameters: { label: 'Sign in' }
    },
    { id: 'send', type: 'CloudFunction2', label: FN_REQUEST_ACCESS, parameters: { function: FN_REQUEST_ACCESS } },
    { id: 'sentGate', type: 'Condition', label: 'Show the confirmation', parameters: { condition: true } },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { condition: true } },
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
    { fromId: 'sentGate', fromProperty: 'result', toId: 'sent', toProperty: 'visible' },
    { fromId: 'send', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'visible' },

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
      children: ['heading', 'blurb', 'nameField', 'aboutField', 'emailField', 'passwordField', 'tokenField', 'claimButton', 'refusal']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Heading',
      parent: 'ground',
      parameters: { text: 'Set up this members’ area', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'blurb',
      type: 'Text',
      label: 'What this does',
      parent: 'ground',
      parameters: {
        text: 'Name your association and create the first moderator account. The setup token comes from your backend configuration.'
      }
    },
    {
      id: 'nameField',
      type: 'net.noodl.controls.textinput',
      label: 'Association name',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Association name' }
    },
    {
      id: 'aboutField',
      type: 'net.noodl.controls.textinput',
      label: 'About the association',
      parent: 'ground',
      parameters: { useLabel: true, label: 'About the association', type: 'textArea' }
    },
    {
      id: 'emailField',
      type: 'net.noodl.controls.textinput',
      label: 'Moderator email',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Your email', type: 'email' }
    },
    {
      id: 'passwordField',
      type: 'net.noodl.controls.textinput',
      label: 'Moderator password',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Choose a password', type: 'password' }
    },
    {
      id: 'tokenField',
      type: 'net.noodl.controls.textinput',
      label: 'Setup token',
      parent: 'ground',
      parameters: { useLabel: true, label: 'Setup token', type: 'password' }
    },
    {
      id: 'claimButton',
      type: 'net.noodl.controls.button',
      label: 'Set up',
      parent: 'ground',
      parameters: { label: 'Set up this members’ area' }
    },
    {
      id: 'refusal',
      type: 'Text',
      label: 'The one refusal',
      parent: 'ground',
      // One message for every refusal path, matching the endpoint's: "wrong
      // token" and "already set up" must not be distinguishable.
      parameters: { text: CLAIM_REFUSED_TEXT, visible: false }
    },
    { id: 'claim', type: 'CloudFunction2', label: FN_CLAIM, parameters: { function: FN_CLAIM } },
    { id: 'refusalGate', type: 'Condition', label: 'Show the refusal', parameters: { condition: true } },
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
    { fromId: 'claimButton', fromProperty: 'onClick', toId: 'claim', toProperty: 'call' },

    // The account exists but nothing has signed it in — `Create User` is a
    // server-side node and sets no browser session — so setup ends at the door
    // rather than inside.
    { fromId: 'claim', fromProperty: 'done', toId: 'toSignIn', toProperty: 'navigate' },
    { fromId: 'claim', fromProperty: 'failure', toId: 'refusalGate', toProperty: 'eval' },
    { fromId: 'refusalGate', fromProperty: 'result', toId: 'refusal', toProperty: 'visible' }
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
      parameters: { text: 'Post something', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'notAllowed',
      type: 'Text',
      label: 'Not a moderator',
      parent: 'ground',
      parameters: { text: 'Only a moderator can post here.', visible: false }
    },
    {
      id: 'tools',
      type: 'Group',
      label: 'The two forms',
      parent: 'ground',
      parameters: { flexDirection: 'column', visible: false },
      children: ['announcementForm', 'meetingForm']
    },
    {
      id: 'announcementForm',
      type: 'Group',
      label: 'An announcement',
      parent: 'tools',
      parameters: { flexDirection: 'column', paddingBottom: 24 },
      children: ['aHeading', 'aTitle', 'aBody', 'aButton', 'aDone']
    },
    {
      id: 'aHeading',
      type: 'Text',
      label: 'Announcement heading',
      parent: 'announcementForm',
      parameters: { text: 'Post an announcement', fontWeight: 'var(--font-semibold)' }
    },
    {
      id: 'aTitle',
      type: 'net.noodl.controls.textinput',
      label: 'Announcement title',
      parent: 'announcementForm',
      parameters: { useLabel: true, label: 'Title' }
    },
    {
      id: 'aBody',
      type: 'net.noodl.controls.textinput',
      label: 'Announcement body',
      parent: 'announcementForm',
      parameters: { useLabel: true, label: 'What you want to say', type: 'textArea' }
    },
    {
      id: 'aButton',
      type: 'net.noodl.controls.button',
      label: 'Post',
      parent: 'announcementForm',
      parameters: { label: 'Post it' }
    },
    {
      id: 'aDone',
      type: 'Text',
      label: 'Announcement posted',
      parent: 'announcementForm',
      parameters: { text: 'Posted. Members can see it now.', visible: false }
    },
    {
      id: 'meetingForm',
      type: 'Group',
      label: 'A meeting',
      parent: 'tools',
      parameters: { flexDirection: 'column' },
      children: ['mHeading', 'mTitle', 'mWhen', 'mPlace', 'mDetails', 'mButton', 'mDone']
    },
    {
      id: 'mHeading',
      type: 'Text',
      label: 'Meeting heading',
      parent: 'meetingForm',
      parameters: { text: 'Add a meeting', fontWeight: 'var(--font-semibold)' }
    },
    {
      id: 'mTitle',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting title',
      parent: 'meetingForm',
      parameters: { useLabel: true, label: 'Title' }
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
      parameters: { useLabel: true, label: 'Date (YYYY-MM-DD)' }
    },
    {
      id: 'mPlace',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting place',
      parent: 'meetingForm',
      parameters: { useLabel: true, label: 'Where' }
    },
    {
      id: 'mDetails',
      type: 'net.noodl.controls.textinput',
      label: 'Meeting details',
      parent: 'meetingForm',
      parameters: { useLabel: true, label: 'Details', type: 'textArea' }
    },
    {
      id: 'mButton',
      type: 'net.noodl.controls.button',
      label: 'Add',
      parent: 'meetingForm',
      parameters: { label: 'Add it to the diary' }
    },
    {
      id: 'mDone',
      type: 'Text',
      label: 'Meeting added',
      parent: 'meetingForm',
      parameters: { text: 'Added. Members can see it now.', visible: false }
    },
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: { label: 'Back to the members area' }
    },
    { id: 'standing', type: STANDING_COMPONENT, label: 'Who is this?' },
    {
      id: 'notModerator',
      type: 'JavaScriptFunction',
      label: 'Is this person not a moderator?',
      parameters: {
        // The negation is a node rather than an inverted wire because a `visible`
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
    { id: 'aDoneGate', type: 'Condition', label: 'Show the confirmation', parameters: { condition: true } },
    { id: 'mDoneGate', type: 'Condition', label: 'Show the confirmation', parameters: { condition: true } },
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
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'tools', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'aTitle', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-title' },
    { fromId: 'aBody', fromProperty: 'onTextChanged', toId: 'createAnnouncement', toProperty: 'prop-body' },
    { fromId: 'aButton', fromProperty: 'onClick', toId: 'stampAnnouncement', toProperty: 'run' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-postedAt', toId: 'createAnnouncement', toProperty: 'prop-postedAt' },
    { fromId: 'stampAnnouncement', fromProperty: 'out-go', toId: 'createAnnouncement', toProperty: 'store' },
    { fromId: 'createAnnouncement', fromProperty: 'done', toId: 'aDoneGate', toProperty: 'eval' },
    { fromId: 'aDoneGate', fromProperty: 'result', toId: 'aDone', toProperty: 'visible' },

    { fromId: 'mTitle', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-title' },
    { fromId: 'mWhen', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-when' },
    { fromId: 'mPlace', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-place' },
    { fromId: 'mDetails', fromProperty: 'onTextChanged', toId: 'createMeeting', toProperty: 'prop-details' },
    { fromId: 'mButton', fromProperty: 'onClick', toId: 'createMeeting', toProperty: 'store' },
    { fromId: 'createMeeting', fromProperty: 'done', toId: 'mDoneGate', toProperty: 'eval' },
    { fromId: 'mDoneGate', fromProperty: 'result', toId: 'mDone', toProperty: 'visible' },

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
      parameters: { text: 'Requests to join', fontWeight: 'var(--font-bold)' }
    },
    {
      id: 'notAllowed',
      type: 'Text',
      label: 'Not a moderator',
      parent: 'ground',
      parameters: { text: 'Only a moderator can see who is waiting to join.', visible: false }
    },
    {
      id: 'queue',
      type: 'Group',
      label: 'The queue',
      parent: 'ground',
      parameters: { flexDirection: 'column', visible: false },
      children: ['list', 'emptyState']
    },
    {
      id: 'list',
      type: 'For Each',
      label: 'One row per request',
      parent: 'queue',
      parameters: { templateType: 'explicit', template: REQUEST_ROW }
    },
    {
      id: 'emptyState',
      type: 'Text',
      label: 'Nobody waiting',
      parent: 'queue',
      parameters: { text: NO_REQUESTS_TEXT, visible: false }
    },
    {
      id: 'backButton',
      type: 'net.noodl.controls.button',
      label: 'Back',
      parent: 'ground',
      parameters: { label: 'Back to the members area' }
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
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'queue', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'isModerator', toId: 'notModerator', toProperty: 'in-isModerator' },
    { fromId: 'notModerator', fromProperty: 'out-no', toId: 'notAllowed', toProperty: 'visible' },
    { fromId: 'standing', fromProperty: 'Moderator', toId: 'requests', toProperty: 'storageFetch' },
    { fromId: 'standing', fromProperty: 'Visitor', toId: 'toLanding', toProperty: 'navigate' },

    { fromId: 'requests', fromProperty: 'items', toId: 'list', toProperty: 'items' },
    { fromId: 'requests', fromProperty: 'count', toId: 'emptyGate', toProperty: 'in-count' },
    { fromId: 'requests', fromProperty: 'fetched', toId: 'emptyGate', toProperty: 'run' },
    { fromId: 'emptyGate', fromProperty: 'out-empty', toId: 'emptyState', toProperty: 'visible' },

    // 🔴 `itemOutputSignal-Changed`, not `Changed`: `For Each` republishes an
    // item component's signal outputs under that prefix (`foreach.tsx:1030-1037`).
    // SB-018 (1) is five sessions of a wire that named the port the author
    // wanted, spelled the way the row spells it, doing nothing.
    { fromId: 'list', fromProperty: 'itemOutputSignal-Changed', toId: 'requests', toProperty: 'storageFetch' },

    { fromId: 'backButton', fromProperty: 'onClick', toId: 'toMembers', toProperty: 'navigate' }
  ]
};

// ── The set, in an order the door will accept ────────────────────────────────

/** The three repeater rows and the standing gate: components, not pages. */
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
  { path: 'Members/RequestRow', nodes: REQUEST_ROW_NODES, connections: REQUEST_ROW_WIRES }
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
  REQUESTS
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
