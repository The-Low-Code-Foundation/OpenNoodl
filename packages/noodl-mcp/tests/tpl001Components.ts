/**
 * TPL-001 — the members' area, as the arguments the MCP door is given.
 *
 * The shape follows `sb00{4,5,6}Components.ts`: a flat list of components, each
 * one the `nodes`/`connections` payload of a single `create_component` call.
 * `tpl001Template.ts` is the composition that authors them in order.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The pending member is a role absence, not a status field
 *
 * This template's whole product is *what a non-member cannot see*, and the
 * backend already has the mechanism: `roles/RoleStore.ts` holds `_Role` and its
 * membership junction, and `roles/SystemRoles.ts` is the only way into it from a
 * graph — through the `_noodl_system_roles` process global, from inside a cloud
 * function. Beside it, `users/SystemUsers.ts` states the property that makes the
 * design work: a user it creates resolves to `roles: []`, so **"a node that can
 * create a user" is provably not "a node that can create an admin"**.
 *
 * So the four states are:
 *
 * | who | how it is expressed |
 * |---|---|
 * | a visitor | no session |
 * | a **pending** member | signed in, `roles: []` |
 * | a member | `role:member` |
 * | a moderator | `role:admin` |
 *
 * 🔴 **And that is exactly why no rule in `nodegx.security.json` may say
 * `authenticated`.** `authenticated` is true for the pending user — the person
 * who signed up ten seconds ago and whom nobody has approved. It is also the
 * value collection reads *fall back to* when a deployed backend has
 * `devOpen: false` and nothing else, which means the failure mode is not a typo
 * anyone would notice: it is the default. Every members-only rule here names
 * `role:member` or `role:admin`, never `authenticated`.
 *
 * @module noodl-mcp/tests/tpl001Components
 */

/** The router every page registers into. Cross-file contract — see `APP_NODES`. */
export const ROUTER = 'Main';

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

/**
 * Pages/Landing — the one page a stranger is allowed to see.
 *
 * ⚠️ **Deliberately a plain page component.** The site builder's section machine
 * is P77's, and phase 78 T4 is parked behind that work; reaching for it here
 * would put this template in the one place it was scoped to avoid.
 *
 * 🔴 **It is written first, and that is load-bearing.** SB-006 F17: the first
 * page written becomes the router's `startPage`. A members' area whose start
 * page is the sign-in form greets a stranger with a password box; this one opens
 * on what the association does.
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
      parameters: {
        sizeMode: 'explicit',
        width: { value: 100, unit: '%' },
        height: { value: 100, unit: '%' },
        paddingTop: { value: 48, unit: 'px' },
        paddingLeft: { value: 24, unit: 'px' },
        paddingRight: { value: 24, unit: 'px' },
        alignX: 'center'
      },
      children: ['heading', 'blurb', 'signin_button']
    },
    {
      id: 'heading',
      type: 'Text',
      label: 'Association name',
      parent: 'ground',
      parameters: { text: 'St. Anywhere Community Association' }
    },
    {
      id: 'blurb',
      type: 'Text',
      label: 'What we do',
      parent: 'ground',
      parameters: {
        text: 'We meet on the first Tuesday of every month. Members can sign in to read announcements and see what is coming up.'
      }
    },
    {
      id: 'signin_button',
      type: 'net.noodl.controls.button',
      label: 'Members sign in',
      parent: 'ground',
      parameters: { label: 'Members sign in' }
    },
    {
      id: 'to_signin',
      type: 'RouterNavigate',
      label: 'Go to sign in',
      parameters: { router: ROUTER, target: '/Pages/SignIn' }
    }
  ],
  connections: [
    { fromId: 'signin_button', fromProperty: 'onClick', toId: 'to_signin', toProperty: 'navigate' }
  ],
  // `Pages/SignIn` does not exist yet on the create pass.
  deferred: ['to_signin']
};


/**
 * Pages/SignIn — the door.
 *
 * 🔴 **`Log In`'s outcome ports are `done` / `failure`, not `success`.** ERG-001
 * §4 renamed the family-wide wire name and there is deliberately no `Unchanged`
 * — `UserService.logIn` reaches the backend unconditionally, so there is no
 * "already signed in" no-op to fire.
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
      parameters: {
        sizeMode: 'explicit',
        width: { value: 100, unit: '%' },
        height: { value: 100, unit: '%' },
        paddingTop: { value: 48, unit: 'px' },
        paddingLeft: { value: 24, unit: 'px' },
        paddingRight: { value: 24, unit: 'px' },
        alignX: 'center'
      },
      children: ['heading', 'email', 'password', 'submit', 'error']
    },
    { id: 'heading', type: 'Text', label: 'Heading', parent: 'ground', parameters: { text: 'Members sign in' } },
    {
      id: 'email',
      type: 'net.noodl.controls.textinput',
      label: 'Email',
      parent: 'ground',
      parameters: { label: 'Email' }
    },
    {
      id: 'password',
      type: 'net.noodl.controls.textinput',
      label: 'Password',
      parent: 'ground',
      parameters: { label: 'Password', type: 'password' }
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
    { id: 'login', type: 'net.noodl.user.LogIn', label: 'Log in' },
    {
      id: 'to_members',
      type: 'RouterNavigate',
      label: 'Go to members area',
      parameters: { router: ROUTER, target: '/Pages/Members' }
    }
  ],
  connections: [
    { fromId: 'email', fromProperty: 'text', toId: 'login', toProperty: 'username' },
    { fromId: 'password', fromProperty: 'text', toId: 'login', toProperty: 'password' },
    { fromId: 'submit', fromProperty: 'onClick', toId: 'login', toProperty: 'login' },
    { fromId: 'login', fromProperty: 'error', toId: 'error', toProperty: 'text' },
    { fromId: 'login', fromProperty: 'done', toId: 'to_members', toProperty: 'navigate' }
  ],
  deferred: ['to_members']
};

/**
 * Pages/Members — the first page behind the door.
 *
 * ⚠️ Scaffolding for the vertical slice: it proves a signed-in person lands
 * somewhere and can leave again. The announcements and meetings that make it
 * worth arriving at are the next component sets.
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
      parameters: {
        sizeMode: 'explicit',
        width: { value: 100, unit: '%' },
        height: { value: 100, unit: '%' },
        paddingTop: { value: 48, unit: 'px' },
        paddingLeft: { value: 24, unit: 'px' },
        paddingRight: { value: 24, unit: 'px' }
      },
      children: ['heading', 'empty_state', 'signout']
    },
    { id: 'heading', type: 'Text', label: 'Heading', parent: 'ground', parameters: { text: 'Members' } },
    {
      // 🔴 TPL-001 AC6 — a template ships graphs, not rows, so this is the first
      // thing every person who installs it sees. A designed screen, not a blank list.
      id: 'empty_state',
      type: 'Text',
      label: 'Empty state',
      parent: 'ground',
      parameters: { text: 'Nothing has been posted yet. When a moderator posts an announcement it will appear here.' }
    },
    {
      id: 'signout',
      type: 'net.noodl.controls.button',
      label: 'Sign out',
      parent: 'ground',
      parameters: { label: 'Sign out' }
    },
    { id: 'logout', type: 'net.noodl.user.LogOut', label: 'Log out' },
    {
      id: 'to_landing',
      type: 'RouterNavigate',
      label: 'Back to the landing page',
      parameters: { router: ROUTER, target: '/Pages/Landing' }
    }
  ],
  connections: [
    // 🔴 `login`, on the Log Out node, is not a typo. `logout.ts:67` states why:
    // *"Named `login` rather than `logout`: the port name is persisted in every
    // project that uses this node, so it cannot be corrected without breaking
    // them."* It is displayed as "Do". The door refuses `logout` and suggests
    // this, which is how it was found.
    { fromId: 'signout', fromProperty: 'onClick', toId: 'logout', toProperty: 'login' },
    { fromId: 'logout', fromProperty: 'done', toId: 'to_landing', toProperty: 'navigate' }
  ]
};

/**
 * Author-order matters and is stated here rather than at the call site.
 *
 * 1. **Landing** — first page written wins `startPage` (above).
 * 2. **SignIn**, then **Members** — and the deferred pass closes the cycle
 *    between them once every page exists.
 */
export const TPL001_COMPONENTS: Tpl001Component[] = [LANDING, SIGN_IN, MEMBERS];

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
