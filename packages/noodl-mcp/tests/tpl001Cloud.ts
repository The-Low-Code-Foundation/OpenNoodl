/**
 * TPL-001 — the four endpoints the members' area cannot be built without.
 *
 * `tpl001Components.ts` is the browser half; this is everything that has to run
 * where a caller cannot reach it. Each of the four is here for a reason that is
 * about *authority*, not convenience:
 *
 * | endpoint | why it cannot be a browser graph |
 * |---|---|
 * | `claimAssociation` | mints the first moderator, against a backend **secret** |
 * | `requestAccess` | creates an account, and files a row the browser may not write |
 * | `myStanding` | reads `_Role`, which no browser node can see |
 * | `decideMembership` | grants `role:member` — the one door into the members' area |
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The rule that decides all four: the `call` rule is the whole gate
 *
 * `BACKEND-AUTHORING-MODEL.md` §"Users": *"a cloud function runs as system (the
 * master key bypasses CLPs and ACLs), so that gate is the only boundary in front
 * of a privileged write. There is nothing behind it."* And
 * `effectiveFunctionRule` resolves the file's rule ahead of the Request node's
 * `Allow Unauthenticated` port whenever the file names the function — the port
 * is a *fallback*, not a second lock.
 *
 * Two consequences shape every graph below:
 *
 * - **`allowNoAuth` is set to agree with the policy rather than to enforce
 *   anything.** A port that says one thing while `nodegx.security.json` says
 *   another is a reader's trap, and the file wins.
 * - **A `public` endpoint that does something privileged must gate itself in the
 *   graph.** `claimAssociation` gates on a secret; `requestAccess` gates on the
 *   parameters it was actually given; `myStanding` tells a stranger only what
 *   the stranger already knows.
 *
 * ## The wiring rules carried over from SB-004, and why they are not style
 *
 * 1. **A JavaScript node declares its signal OUTPUTS in `ports`.** Value outputs
 *    need no declaration; signals do.
 * 2. **The port carrying a value and the port firing the action come from the
 *    SAME node wherever one pass separates them**, because a value queued on a
 *    consumer is drained one input at a time and an action can run with a value
 *    still in flight. Where two producers are unavoidable, the consumer opens
 *    with a readiness guard on `undefined` — `false` and `''` are real answers.
 * 3. **Every refusal path answers ONE response with ONE message.** Two
 *    distinguishable refusals on `claimAssociation` would answer "has this
 *    members' area been set up yet?" to anyone who asked; on `requestAccess`
 *    they would answer "is this person one of you?".
 *
 * @module noodl-mcp/tests/tpl001Cloud
 */
import {
  ASSOCIATION_RULES,
  CLAIM_REFUSED_TEXT,
  COLLECTION_ASSOCIATION,
  COLLECTION_REQUEST,
  FN_CLAIM,
  FN_DECIDE,
  FN_MY_STANDING,
  FN_REQUEST_ACCESS,
  MODERATOR_ONLY_RULES,
  NO_LOAD_TIME_FETCH,
  REQUEST_REFUSED_TEXT,
  ROLE_MEMBER,
  ROLE_MODERATOR,
  SETUP_TOKEN_SECRET,
  STANDING_MEMBER,
  STANDING_MODERATOR,
  STANDING_PENDING,
  STANDING_VISITOR
} from './tpl001Vocabulary';

/** One cloud component, in the shape `create_component` takes. */
export interface Tpl001CloudComponent {
  /** `create_component`'s `path` argument — the `#__cloud__/` spelling. */
  path: string;
  /** The registry key, which is also the directory under `components/`. */
  key: string;
  /** The legacy name; the field the deployers split the bundles on. */
  legacyName: string;
  nodes: unknown[];
  connections: unknown[];
}

// ── 1. claimAssociation — where the first moderator comes from ───────────────

/**
 * 🔴 **Without this endpoint the template does not work at all, and the reason
 * is worth stating because it is invisible until you look for it.**
 *
 * Every members-only rule names `role:admin` or `role:member`. A freshly
 * provisioned backend has neither role and nobody in them, so on a brand-new
 * members' area *there is no one who can approve anybody* — the approval queue
 * is admin-only and the association has no admin. `claimSite` solved the same
 * problem for the site builder with a setup token, and this is that flow with
 * one difference that matters:
 *
 * ⚠️ **This one creates the account itself rather than granting the caller.**
 * `claimSite` grants `role:admin` to `req.userId`, which requires the person to
 * have signed up in the browser first — and this template's policy sets
 * `signup: nobody`, deliberately, so that the association's own front door is
 * the only way an account exists. So the setup form hands over an email and a
 * password, and `Create User` mints the account inside the same request that
 * grants it.
 *
 * The gate is `claimSite`'s, including the constant-time compare, because this
 * is the one door in the template that mints a moderator.
 */
export const CLAIM_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'claimAssociation(setupToken, associationName, blurb, email, password)',
    parameters: {
      params: 'setupToken,associationName,blurb,email,password',
      'ptype-setupToken': 'string',
      'preq-setupToken': true,
      'ptype-associationName': 'string',
      'preq-associationName': true,
      'ptype-blurb': 'string',
      'preq-blurb': false,
      'ptype-email': 'string',
      'preq-email': true,
      'ptype-password': 'string',
      'preq-password': true,
      // Agrees with `functions.claimAssociation.call: "public"` in the policy.
      // There is nobody to authenticate: this call is what creates the first
      // account, and the token is the gate.
      allowNoAuth: true
    }
  },
  {
    id: 'secret',
    type: 'noodl.cloud.secret',
    label: SETUP_TOKEN_SECRET,
    parameters: { name: SETUP_TOKEN_SECRET }
  },
  {
    id: 'existing',
    type: 'DbCollection2',
    label: 'Has this members’ area been set up?',
    // 🔴 SB-013, verbatim in its reasoning. Both boxes off, so the explicit
    // `storageFetch` below is the only fetch — with them on, the node fetches
    // once at graph-build time and the gate decides on a pre-fetch `isEmpty`,
    // which reads "not set up" on a members' area that already has a moderator.
    // The gate's readiness guard on `items` is what makes that structural
    // rather than a race the load-time fetch happens to win.
    parameters: { collectionName: COLLECTION_ASSOCIATION, ...NO_LOAD_TIME_FETCH }
  },
  {
    id: 'gate',
    type: 'JavaScriptFunction',
    label: 'Token matches AND nobody has set this up yet',
    ports: [
      { name: 'out-ok', plug: 'output', type: 'signal' },
      { name: 'out-denied', plug: 'output', type: 'signal' }
    ],
    parameters: {
      // 🔴 `Run` is ADDITIVE (`run-on-value-change.ts` §1): wiring it adds a
      // trigger and unticks nothing. Off, this node decides when a query has
      // answered and at no other time.
      'runOnChange-in-expected': false,
      'runOnChange-in-supplied': false,
      'runOnChange-in-unclaimed': false,
      'runOnChange-in-rows': false,
      'runOnChange-in-name': false,
      'runOnChange-in-blurb': false,
      'runOnChange-in-email': false,
      'runOnChange-in-password': false,
      functionScript:
        // `items` is the only output here that separates "matched nothing" from
        // "no query has run" — `isEmpty` is `true` for both, so it is not safe
        // to decide on, and deciding early is what lets an outsider in.
        'if (Inputs.rows === undefined) return;\n' +
        'if (Inputs.expected === undefined || Inputs.supplied === undefined) return;\n' +
        "const expected = Inputs.expected || '';\n" +
        "const supplied = Inputs.supplied || '';\n" +
        '// Constant-time compare. A plain === leaks the matching prefix length\n' +
        '// through timing, and this is the one door in the template that mints\n' +
        '// a moderator — the three extra lines are cheaper than the argument.\n' +
        'let diff = expected.length ^ supplied.length;\n' +
        'const n = Math.max(expected.length, supplied.length);\n' +
        'for (let i = 0; i < n; i++) {\n' +
        '  diff |= (expected.charCodeAt(i) || 0) ^ (supplied.charCodeAt(i) || 0);\n' +
        '}\n' +
        '// An unprovisioned secret is never a match: an empty expected token\n' +
        '// must not let a caller in with an empty string.\n' +
        'const tokenOk = expected.length > 0 && diff === 0;\n' +
        'if (!tokenOk || Inputs.unclaimed !== true) {\n' +
        '  Outputs.denied();\n' +
        '  return;\n' +
        '}\n' +
        '// Rule 2: everything the rest of the graph needs leaves from HERE, so\n' +
        '// no node downstream can act on a value that is still in flight.\n' +
        'Outputs.username = Inputs.email;\n' +
        'Outputs.email = Inputs.email;\n' +
        'Outputs.password = Inputs.password;\n' +
        "Outputs.name = Inputs.name || 'Our association';\n" +
        "Outputs.blurb = Inputs.blurb || '';\n" +
        'Outputs.claimed = true;\n' +
        'Outputs.ok();'
    }
  },
  {
    id: 'create',
    type: 'noodl.cloud.createuser',
    label: 'Create the moderator’s account',
    // ⚠️ `emailVerified` deliberately unset: this account is created by someone
    // holding the backend's setup token, and making them go through a
    // verification email a fresh backend cannot send would lock the moderator
    // out of the members' area they just set up.
    parameters: { emailVerified: true }
  },
  {
    id: 'grant',
    type: 'noodl.cloud.addusertorole',
    label: 'Make them the moderator',
    parameters: {
      role: ROLE_MODERATOR,
      // 🔴 On, and this is one of the two nodes in the template that turns it
      // on: without it the very first call fails `role/not-found` on a backend
      // where the role has never existed, which is every backend this template
      // is deployed to.
      createRole: true
    }
  },
  {
    id: 'mark',
    type: 'NewDbModelProperties',
    label: 'Write the association row — the landing page’s content',
    parameters: {
      collectionName: COLLECTION_ASSOCIATION,
      // The world reads this row: it IS the public landing page.
      ...ASSOCIATION_RULES
    }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Set up', parameters: { params: 'claimed' } },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Refused',
    parameters: {
      status: 'failure',
      // Rule 3. "Wrong token" and "already set up" must not be distinguishable,
      // or this endpoint answers "does this association exist?" to anyone.
      errorMessage: CLAIM_REFUSED_TEXT
    }
  }
];

export const CLAIM_WIRES = [
  // The secret first, so an unprovisioned backend never reaches the query.
  { fromId: 'req', fromProperty: 'receive', toId: 'secret', toProperty: 'fetch' },
  { fromId: 'secret', fromProperty: 'done', toId: 'existing', toProperty: 'storageFetch' },
  { fromId: 'secret', fromProperty: 'value', toId: 'gate', toProperty: 'in-expected' },

  { fromId: 'req', fromProperty: 'pm-setupToken', toId: 'gate', toProperty: 'in-supplied' },
  { fromId: 'req', fromProperty: 'pm-associationName', toId: 'gate', toProperty: 'in-name' },
  { fromId: 'req', fromProperty: 'pm-blurb', toId: 'gate', toProperty: 'in-blurb' },
  { fromId: 'req', fromProperty: 'pm-email', toId: 'gate', toProperty: 'in-email' },
  { fromId: 'req', fromProperty: 'pm-password', toId: 'gate', toProperty: 'in-password' },

  { fromId: 'existing', fromProperty: 'isEmpty', toId: 'gate', toProperty: 'in-unclaimed' },
  { fromId: 'existing', fromProperty: 'items', toId: 'gate', toProperty: 'in-rows' },
  { fromId: 'existing', fromProperty: 'fetched', toId: 'gate', toProperty: 'run' },

  { fromId: 'gate', fromProperty: 'out-username', toId: 'create', toProperty: 'username' },
  { fromId: 'gate', fromProperty: 'out-email', toId: 'create', toProperty: 'email' },
  { fromId: 'gate', fromProperty: 'out-password', toId: 'create', toProperty: 'password' },
  { fromId: 'gate', fromProperty: 'out-ok', toId: 'create', toProperty: 'create' },

  { fromId: 'create', fromProperty: 'userId', toId: 'grant', toProperty: 'userId' },
  { fromId: 'create', fromProperty: 'done', toId: 'grant', toProperty: 'add' },
  // ⚠️ `unchanged` too: a setup that created the account and then failed to
  // grant the role leaves an account with no roles and an association nobody
  // owns. Retrying with the same email must finish the job rather than refuse,
  // and `User Id holds the EXISTING user` is that branch's stated contract.
  { fromId: 'create', fromProperty: 'unchanged', toId: 'grant', toProperty: 'add' },

  { fromId: 'gate', fromProperty: 'out-name', toId: 'mark', toProperty: 'prop-name' },
  { fromId: 'gate', fromProperty: 'out-blurb', toId: 'mark', toProperty: 'prop-blurb' },
  { fromId: 'grant', fromProperty: 'done', toId: 'mark', toProperty: 'store' },
  { fromId: 'grant', fromProperty: 'unchanged', toId: 'mark', toProperty: 'store' },

  { fromId: 'gate', fromProperty: 'out-claimed', toId: 'res', toProperty: 'pm-claimed' },
  { fromId: 'mark', fromProperty: 'done', toId: 'res', toProperty: 'send' },
  // ⚠️ …and the association row's FAILURE answers `res` as well, not `deny`.
  // By this point the account exists and holds `role:admin`: the members' area
  // IS set up, and telling the caller otherwise sends a moderator away
  // believing they are not one, with no second setup possible.
  { fromId: 'mark', fromProperty: 'failure', toId: 'res', toProperty: 'send' },

  // Every way this can refuse, into the one indistinguishable answer.
  { fromId: 'secret', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'existing', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'gate', fromProperty: 'out-denied', toId: 'deny', toProperty: 'send' },
  { fromId: 'create', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'grant', fromProperty: 'failure', toId: 'deny', toProperty: 'send' }
];

// ── 2. requestAccess — the front door ────────────────────────────────────────

/**
 * A person asks to join: the account is created here, holding no roles, and a
 * row is filed for the moderators to act on.
 *
 * 🔴 **This is the only account-creating door, and it is why the policy says
 * `signup: nobody`.** With `signup: public` a stranger can mint an account
 * directly against the backend's own signup route, bypassing this graph
 * entirely — harmless while every rule names a role, and still an account nobody
 * asked for and no moderator can see. Closing it makes the queue complete: every
 * account that exists came through here or through setup.
 *
 * 🔴 **`unchanged` answers exactly like `done`, and files nothing.** `Create
 * User`'s `unchanged` means *a user with this username already exists*, and
 * answering it differently would tell a stranger whether an address belongs to
 * this congregation. The join page carries a standing line pointing a returning
 * person at sign-in, which is the honest way to say it to everybody at once.
 */
export const REQUEST_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'requestAccess(name, email, password, message)',
    parameters: {
      params: 'name,email,password,message',
      'ptype-name': 'string',
      'preq-name': true,
      'ptype-email': 'string',
      'preq-email': true,
      'ptype-password': 'string',
      'preq-password': true,
      'ptype-message': 'string',
      'preq-message': false,
      // Agrees with `functions.requestAccess.call: "public"`. Asking to join is
      // a thing a stranger does; the policy also rate-limits it, because this
      // endpoint creates accounts.
      allowNoAuth: true
    }
  },
  {
    id: 'prep',
    type: 'JavaScriptFunction',
    label: 'Hold the request until every field is here',
    ports: [
      { name: 'out-ready', plug: 'output', type: 'signal' },
      { name: 'out-refuse', plug: 'output', type: 'signal' }
    ],
    parameters: {
      // Rule 2. `receive` is documented to fire after every parameter output has
      // been updated — a promise about the Request node, not about a consumer
      // whose inputs drain one at a time. Everything downstream leaves from here.
      functionScript:
        'if (Inputs.email === undefined || Inputs.password === undefined) return;\n' +
        "const email = (Inputs.email || '').trim();\n" +
        "const password = Inputs.password || '';\n" +
        'if (email.length === 0 || password.length === 0) {\n' +
        '  Outputs.refuse();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.username = email;\n' +
        'Outputs.email = email;\n' +
        'Outputs.password = password;\n' +
        "Outputs.name = (Inputs.name || '').trim() || email;\n" +
        "Outputs.message = Inputs.message || '';\n" +
        'Outputs.ready();'
    }
  },
  {
    id: 'create',
    type: 'noodl.cloud.createuser',
    label: 'Create the account — with no roles, which is what pending means',
    // ⚠️ No `properties`, no `emailVerified`. This node cannot manufacture
    // privilege (`ACL`, `objectId` and every `_`-prefixed column are refused by
    // name), and the account it makes resolves to `roles: []` — which is
    // exactly the pending state the whole template is built around.
    parameters: {}
  },
  {
    id: 'stamp',
    type: 'JavaScriptFunction',
    label: 'Everything the request row needs, from one node',
    ports: [{ name: 'out-file', plug: 'output', type: 'signal' }],
    parameters: {
      // Rule 2 again, and here it decides whether a row is written with its
      // fields or without them: `userId` arrives from `create`, the rest from
      // `prep`, and the write is fired from this node once both are in.
      functionScript:
        'if (Inputs.userId === undefined || Inputs.email === undefined) return;\n' +
        'Outputs.userId = Inputs.userId;\n' +
        'Outputs.email = Inputs.email;\n' +
        "Outputs.name = Inputs.name || '';\n" +
        "Outputs.message = Inputs.message || '';\n" +
        '// Written here rather than by the backend: an ISO day string sorts and\n' +
        '// compares lexicographically, which is what the moderators’ queue orders by.\n' +
        'Outputs.requestedAt = new Date().toISOString();\n' +
        'Outputs.file();'
    }
  },
  {
    id: 'file',
    type: 'NewDbModelProperties',
    label: 'File the request for the moderators',
    parameters: {
      collectionName: COLLECTION_REQUEST,
      // 🔴 The row carries the moderator-only ACL as well as the collection
      // rule. A request row holds a person's name, address and a note about why
      // they want to join; if the collection rule ever widens, the ACL is what
      // keeps the row where it was put.
      ...MODERATOR_ONLY_RULES
    }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Request received', parameters: { params: 'received' } },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Refused',
    parameters: { status: 'failure', errorMessage: REQUEST_REFUSED_TEXT }
  },
  {
    id: 'received',
    type: 'JavaScriptFunction',
    label: 'The one success value',
    ports: [{ name: 'out-answer', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 Two edges reach this node — a filed request and an address that
      // already had an account — and they must be indistinguishable to the
      // caller. Routing both through one node is what makes that true by
      // construction rather than by two response nodes staying in step.
      functionScript: 'Outputs.received = true;\nOutputs.answer();'
    }
  }
];

export const REQUEST_WIRES = [
  { fromId: 'req', fromProperty: 'pm-name', toId: 'prep', toProperty: 'in-name' },
  { fromId: 'req', fromProperty: 'pm-email', toId: 'prep', toProperty: 'in-email' },
  { fromId: 'req', fromProperty: 'pm-password', toId: 'prep', toProperty: 'in-password' },
  { fromId: 'req', fromProperty: 'pm-message', toId: 'prep', toProperty: 'in-message' },
  { fromId: 'req', fromProperty: 'receive', toId: 'prep', toProperty: 'run' },

  { fromId: 'prep', fromProperty: 'out-username', toId: 'create', toProperty: 'username' },
  { fromId: 'prep', fromProperty: 'out-email', toId: 'create', toProperty: 'email' },
  { fromId: 'prep', fromProperty: 'out-password', toId: 'create', toProperty: 'password' },
  { fromId: 'prep', fromProperty: 'out-ready', toId: 'create', toProperty: 'create' },

  { fromId: 'create', fromProperty: 'userId', toId: 'stamp', toProperty: 'in-userId' },
  { fromId: 'prep', fromProperty: 'out-email', toId: 'stamp', toProperty: 'in-email' },
  { fromId: 'prep', fromProperty: 'out-name', toId: 'stamp', toProperty: 'in-name' },
  { fromId: 'prep', fromProperty: 'out-message', toId: 'stamp', toProperty: 'in-message' },
  { fromId: 'create', fromProperty: 'done', toId: 'stamp', toProperty: 'run' },

  { fromId: 'stamp', fromProperty: 'out-userId', toId: 'file', toProperty: 'prop-userId' },
  { fromId: 'stamp', fromProperty: 'out-email', toId: 'file', toProperty: 'prop-email' },
  { fromId: 'stamp', fromProperty: 'out-name', toId: 'file', toProperty: 'prop-name' },
  { fromId: 'stamp', fromProperty: 'out-message', toId: 'file', toProperty: 'prop-message' },
  { fromId: 'stamp', fromProperty: 'out-requestedAt', toId: 'file', toProperty: 'prop-requestedAt' },
  { fromId: 'stamp', fromProperty: 'out-file', toId: 'file', toProperty: 'store' },

  { fromId: 'file', fromProperty: 'done', toId: 'received', toProperty: 'run' },
  // 🔴 The non-enumerating branch: an address that already has an account files
  // NOTHING and answers exactly as a new one does.
  { fromId: 'create', fromProperty: 'unchanged', toId: 'received', toProperty: 'run' },
  { fromId: 'received', fromProperty: 'out-received', toId: 'res', toProperty: 'pm-received' },
  { fromId: 'received', fromProperty: 'out-answer', toId: 'res', toProperty: 'send' },

  { fromId: 'prep', fromProperty: 'out-refuse', toId: 'deny', toProperty: 'send' },
  { fromId: 'create', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // ⚠️ A filed-row failure IS a refusal here, unlike `claimAssociation`'s
  // association row: an account with no request behind it is invisible to every
  // moderator, so answering "received" would strand the person for ever.
  { fromId: 'file', fromProperty: 'failure', toId: 'deny', toProperty: 'send' }
];

// ── 3. myStanding — what the browser is not allowed to work out for itself ───

/**
 * 🔴 **The browser cannot see its own roles, and this is not an oversight to
 * work around — it is why this endpoint exists.**
 *
 * `_Role` is a system collection (`isSystemCollection`: every `_`-prefixed class
 * is `nobody`, *regardless of config*), the `User` node's outputs are the
 * columns of `_User` and roles are not one of them, and `noodl.cloud.getuserroles`
 * is cloud-only like the rest of its family. So a page that wants to show a
 * member something has exactly two options: ask the server, or infer membership
 * from whether a query came back empty.
 *
 * 🔴 **The second one is not available**, and that is the sharpest thing in this
 * file: a REFUSED query publishes `[]` exactly as an EMPTY one does. "You are
 * not a member" and "nobody has posted yet" are the same reading, with opposite
 * fixes and opposite screens. Everything the members' area shows is branched on
 * this endpoint's answer instead.
 *
 * ⚠️ **`unknown` is a fifth answer and it fails shut without lying.** A roles
 * read that fails must not be reported as `pending` (which tells a member they
 * are not one) nor as `member` (which would load content for someone whose
 * standing is unproven). The page shows a "we could not check" line and no
 * content — and the collection rules refuse the query anyway, which is the
 * known-firing half behind the polite one.
 */
export const STANDING_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'myStanding()',
    parameters: {
      // No parameters: the only input is the session the request carries, and a
      // caller must never be able to ask about somebody else's standing.
      // Agrees with `functions.myStanding.call: "public"` — a stranger is told
      // `visitor`, which they already knew.
      allowNoAuth: true
    }
  },
  {
    id: 'gate',
    type: 'JavaScriptFunction',
    label: 'Is anybody signed in?',
    ports: [
      { name: 'out-anonymous', plug: 'output', type: 'signal' },
      { name: 'out-known', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        '// `userId` is blank for an unauthenticated request — the Request node’s\n' +
        '// own contract — and a blank id is a Failure on the roles node, so the\n' +
        '// two cases are separated here rather than through an error branch.\n' +
        "const id = Inputs.userId === undefined || Inputs.userId === null ? '' : String(Inputs.userId);\n" +
        'if (id.length === 0) {\n' +
        `  Outputs.standing = '${STANDING_VISITOR}';\n` +
        '  Outputs.anonymous();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.userId = id;\n' +
        'Outputs.known();'
    }
  },
  {
    id: 'roles',
    type: 'noodl.cloud.getuserroles',
    label: 'What roles is this caller in?',
    // ⚠️ This is the resolver enforcement itself uses — `SecurityState.rolesForUser`,
    // the same call `role:member` is evaluated through. A node running its own
    // query could answer "member" while the rule disagreed; this cannot.
    parameters: {}
  },
  {
    id: 'decide',
    type: 'JavaScriptFunction',
    label: 'Moderator, member, or still waiting',
    ports: [{ name: 'out-answered', plug: 'output', type: 'signal' }],
    parameters: {
      functionScript:
        'const roles = Inputs.roles || [];\n' +
        '// A moderator is not implicitly a member: the roles are flat and\n' +
        '// separate, so the check is by name and `admin` is reported first\n' +
        '// because it is the standing that unlocks more.\n' +
        `Outputs.standing = roles.indexOf('${ROLE_MODERATOR}') !== -1\n` +
        `  ? '${STANDING_MODERATOR}'\n` +
        `  : roles.indexOf('${ROLE_MEMBER}') !== -1\n` +
        `    ? '${STANDING_MEMBER}'\n` +
        `    : '${STANDING_PENDING}';\n` +
        'Outputs.answered();'
    }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Your standing', parameters: { params: 'standing' } },
  {
    id: 'unknown',
    type: 'noodl.cloud.response',
    label: 'Could not be checked',
    // ⚠️ A `failure` status rather than a 200 carrying `unknown`: the browser
    // branches on `CloudFunction2.failure` for this, and a 200 whose body says
    // "we do not know" is a shape every caller has to remember to check.
    parameters: { status: 'failure', errorMessage: 'Your membership could not be checked.' }
  }
];

export const STANDING_WIRES = [
  { fromId: 'req', fromProperty: 'userId', toId: 'gate', toProperty: 'in-userId' },
  { fromId: 'req', fromProperty: 'receive', toId: 'gate', toProperty: 'run' },

  { fromId: 'gate', fromProperty: 'out-userId', toId: 'roles', toProperty: 'userId' },
  { fromId: 'gate', fromProperty: 'out-known', toId: 'roles', toProperty: 'read' },

  { fromId: 'roles', fromProperty: 'roles', toId: 'decide', toProperty: 'in-roles' },
  { fromId: 'roles', fromProperty: 'done', toId: 'decide', toProperty: 'run' },
  // 🔴 `Unchanged` is "in no roles at all" — the node's own contract, and the
  // branch a membership check wants. It is the PENDING person's edge, and
  // leaving it unwired is a members' area where nobody who has just asked to
  // join ever gets an answer.
  { fromId: 'roles', fromProperty: 'unchanged', toId: 'decide', toProperty: 'run' },

  { fromId: 'gate', fromProperty: 'out-standing', toId: 'res', toProperty: 'pm-standing' },
  { fromId: 'gate', fromProperty: 'out-anonymous', toId: 'res', toProperty: 'send' },
  { fromId: 'decide', fromProperty: 'out-standing', toId: 'res', toProperty: 'pm-standing' },
  { fromId: 'decide', fromProperty: 'out-answered', toId: 'res', toProperty: 'send' },

  { fromId: 'roles', fromProperty: 'failure', toId: 'unknown', toProperty: 'send' }
];

// ── 4. decideMembership — the door that mints members ────────────────────────

/**
 * One endpoint, two buttons: `approve` is a constant on the caller's side, the
 * way `publishPage` serves Publish and Unpublish from one function.
 *
 * 🔴 **`functions.decideMembership.call` must be `role:admin`, and nothing in
 * this graph can substitute for it.** The Request node's port cannot express a
 * role — unticked resolves to `authenticated`, which for this template is *any
 * account that asked to join*, i.e. exactly the person the queue exists to keep
 * out. A pending member calling this endpoint with their own request id would
 * approve themselves.
 *
 * ⚠️ **The user id comes from the request ROW, never from the caller.** An
 * admin could legitimately grant membership to anyone, so trusting a
 * caller-supplied id would not be an escalation — but reading it from the row
 * the moderators are looking at means the id that gets the role is the one
 * attached to the name on their screen.
 */
export const DECIDE_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'decideMembership(requestId, approve)',
    parameters: {
      params: 'requestId,approve',
      'ptype-requestId': 'string',
      'preq-requestId': true,
      'ptype-approve': 'boolean',
      'preq-approve': true,
      // The closest this port can come to `role:admin`; the policy is what
      // actually decides, and it names the rule this port cannot spell.
      allowNoAuth: false
    }
  },
  {
    id: 'prep',
    type: 'JavaScriptFunction',
    label: 'Hold the decision until both parameters are here',
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      functionScript:
        '// `approve: false` is a real answer, so the guard tests `undefined`\n' +
        '// and never falsiness — a decline read as "not ready yet" is a queue\n' +
        '// entry nothing ever removes.\n' +
        'if (Inputs.requestId === undefined || Inputs.approve === undefined) return;\n' +
        "if (String(Inputs.requestId).length === 0) return;\n" +
        'Outputs.requestId = Inputs.requestId;\n' +
        'Outputs.approve = Inputs.approve === true;\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'request',
    type: 'DbModel2',
    label: 'The request being decided',
    parameters: { collectionName: COLLECTION_REQUEST, idSource: 'explicit' }
  },
  {
    id: 'route',
    type: 'JavaScriptFunction',
    label: 'Grant, or simply remove',
    ports: [
      { name: 'out-grant', plug: 'output', type: 'signal' },
      { name: 'out-decline', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        '// Two producers — the row supplies the user id, the request supplies the\n' +
        '// decision — so this opens with the readiness guard rule 2 prescribes.\n' +
        'if (Inputs.userId === undefined || Inputs.approve === undefined) return;\n' +
        "const userId = Inputs.userId === null ? '' : String(Inputs.userId);\n" +
        'Outputs.userId = userId;\n' +
        'Outputs.approved = Inputs.approve === true;\n' +
        '// A row whose userId is missing cannot be approved into anything. It is\n' +
        '// still a queue entry a moderator asked to be rid of, so it declines.\n' +
        'if (Inputs.approve === true && userId.length > 0) {\n' +
        '  Outputs.grant();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.decline();'
    }
  },
  {
    id: 'grant',
    type: 'noodl.cloud.addusertorole',
    label: 'Make them a member',
    parameters: {
      role: ROLE_MEMBER,
      // 🔴 The second of the two nodes that turn this on, and for the same
      // reason: `member` is named by the policy but exists in `_Role` only once
      // somebody is in it, so the first approval on every backend would fail
      // `role/not-found` without it.
      createRole: true
    }
  },
  {
    id: 'remove',
    type: 'DeleteDbModelProperties',
    label: 'Take the request off the queue',
    // 🔴 The queue is the queue: an approved request leaves it, and the
    // membership lives in `_Role` and nowhere else. A `decided` column here
    // would be a second copy of a fact the roles already hold, and the copy is
    // what goes stale the first time a moderator changes a role by hand.
    parameters: { collectionName: COLLECTION_REQUEST, idSource: 'explicit' }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Decided', parameters: { params: 'approved' } },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Refused',
    parameters: { status: 'failure', errorMessage: 'That request could not be decided.' }
  }
];

export const DECIDE_WIRES = [
  { fromId: 'req', fromProperty: 'pm-requestId', toId: 'prep', toProperty: 'in-requestId' },
  { fromId: 'req', fromProperty: 'pm-approve', toId: 'prep', toProperty: 'in-approve' },
  { fromId: 'req', fromProperty: 'receive', toId: 'prep', toProperty: 'run' },

  { fromId: 'prep', fromProperty: 'out-requestId', toId: 'request', toProperty: 'modelId' },
  { fromId: 'prep', fromProperty: 'out-ready', toId: 'request', toProperty: 'fetch' },

  { fromId: 'request', fromProperty: 'prop-userId', toId: 'route', toProperty: 'in-userId' },
  { fromId: 'prep', fromProperty: 'out-approve', toId: 'route', toProperty: 'in-approve' },
  { fromId: 'request', fromProperty: 'done', toId: 'route', toProperty: 'run' },

  { fromId: 'route', fromProperty: 'out-userId', toId: 'grant', toProperty: 'userId' },
  { fromId: 'route', fromProperty: 'out-grant', toId: 'grant', toProperty: 'add' },

  { fromId: 'prep', fromProperty: 'out-requestId', toId: 'remove', toProperty: 'modelId' },
  { fromId: 'grant', fromProperty: 'done', toId: 'remove', toProperty: 'store' },
  // ⚠️ Already in the role is the post-condition already holding — a moderator
  // clicking Approve twice must not leave the row on the queue for ever.
  { fromId: 'grant', fromProperty: 'unchanged', toId: 'remove', toProperty: 'store' },
  { fromId: 'route', fromProperty: 'out-decline', toId: 'remove', toProperty: 'store' },

  { fromId: 'route', fromProperty: 'out-approved', toId: 'res', toProperty: 'pm-approved' },
  { fromId: 'remove', fromProperty: 'done', toId: 'res', toProperty: 'send' },

  { fromId: 'request', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'grant', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // ⚠️ A grant that succeeded and a delete that failed answers `deny`, and that
  // is the honest direction: the person IS a member, and the moderator needs to
  // see the row still on the queue rather than a success that hides it.
  { fromId: 'remove', fromProperty: 'failure', toId: 'deny', toProperty: 'send' }
];

// ── The set, in an order the door will accept ────────────────────────────────

/**
 * ⚠️ **No ordering constraint among these four**, unlike SB-004's set: none of
 * them instantiates another as a component, and a `CloudFunction2` names its
 * endpoint by STRING rather than by reference. They are authored before the
 * pages only so that a reader meets the endpoints before the screens that call
 * them.
 */
export const TPL001_CLOUD_COMPONENTS: Tpl001CloudComponent[] = [
  {
    path: `#__cloud__/${FN_CLAIM}`,
    key: `__cloud__/${FN_CLAIM}`,
    legacyName: `/#__cloud__/${FN_CLAIM}`,
    nodes: CLAIM_NODES,
    connections: CLAIM_WIRES
  },
  {
    path: `#__cloud__/${FN_REQUEST_ACCESS}`,
    key: `__cloud__/${FN_REQUEST_ACCESS}`,
    legacyName: `/#__cloud__/${FN_REQUEST_ACCESS}`,
    nodes: REQUEST_NODES,
    connections: REQUEST_WIRES
  },
  {
    path: `#__cloud__/${FN_MY_STANDING}`,
    key: `__cloud__/${FN_MY_STANDING}`,
    legacyName: `/#__cloud__/${FN_MY_STANDING}`,
    nodes: STANDING_NODES,
    connections: STANDING_WIRES
  },
  {
    path: `#__cloud__/${FN_DECIDE}`,
    key: `__cloud__/${FN_DECIDE}`,
    legacyName: `/#__cloud__/${FN_DECIDE}`,
    nodes: DECIDE_NODES,
    connections: DECIDE_WIRES
  }
];
