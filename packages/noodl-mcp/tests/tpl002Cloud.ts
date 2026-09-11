/**
 * TPL-002 — the four endpoints that turn "somebody posted" into an email.
 *
 * `tpl001Cloud.ts` is the members' area's own four; these are the notification
 * half, split out because they answer a different question and because one of
 * them is shaped by a product defect rather than by the domain.
 *
 * | endpoint | why it cannot be a browser graph |
 * |---|---|
 * | `myNotifySetting` | reads the caller's `Member` row, which `find: role:admin` hides |
 * | `setNotifySetting` | writes it, and `Member` is `create/update: nobody` |
 * | `unsubscribe` | runs with **no session at all** — the token is the authority |
 * | `notifyMembers` | reads every opted-in member's address, and sends mail |
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The pump, and the defect it is shaped around (D33)
 *
 * The obvious fan-out — take the rows, set `To`, pulse `Do`, repeat — **sends one
 * email and reports N successes.** Measured, s14, with a control pair:
 *
 * | arm | pulses | `_noodl_send_email` calls | outcomes |
 * |---|---|---|---|
 * | three addresses, one pass | 3 | **1** (the last) | `done ×3` |
 * | three addresses, one pass each | 3 | 3 | `done ×3` |
 *
 * `sendemail.ts`'s `scheduleSend` returns early while a send is already
 * scheduled — correct for "set the fields, then press Do", catastrophic when the
 * address changes between pulses. And there is no loop node to put a pass
 * boundary in with: `For Each` is `noodl-viewer-react`'s visual repeater and the
 * cloud runtime does not register it.
 *
 * So the fan-out here is a **serial pump**. `plan` builds the queue; `pump`
 * publishes exactly one address and one `Do`; `Send Email`'s `done` **and**
 * `failure` both come back round to advance it. The mailer resolves
 * asynchronously, so every pulse lands in its own pass — the control arm above,
 * built on purpose.
 *
 * 🔴 **`failure` advancing the pump is AC6, not tidiness.** *"A send failure for
 * one recipient does not lose the announcement or stop the other 23."* Wire only
 * `done` and one bad address stops the loop dead, with the announcement posted
 * and nobody told.
 *
 * ## 🔴 Why the moderator's browser supplies the site address
 *
 * Every email carries an unsubscribe link, and a link needs an absolute URL. A
 * cloud function **cannot find out what the app's own public address is**:
 * `EmailConfigState.effectiveBaseUrl` exists and the product's own password-reset
 * route uses it, but nothing exposes it to a graph, and the Request node's
 * `Headers` are set on a model with no output port. See D34.
 *
 * So `notifyMembers` takes `siteUrl` from the caller, and the caller is the
 * moderator's own browser publishing `location.origin` — which is, by
 * construction, where this members' area is served from. `plan` keeps only the
 * scheme and host of what it is given: a caller-supplied string that reaches
 * twenty-four inboxes should not be able to carry a path, a query or a fragment.
 *
 * ## The rules carried over from `tpl001Cloud.ts`, unchanged
 *
 * 1. A JavaScript node declares its signal OUTPUTS in `ports`.
 * 2. The port carrying a value and the port firing the action come from the SAME
 *    node; where two producers are unavoidable the consumer opens with a
 *    readiness guard on `undefined`.
 * 3. Every refusal path answers ONE response with ONE message.
 *
 * @module noodl-mcp/tests/tpl002Cloud
 */
import type { Tpl001CloudComponent } from './tpl001Cloud';
import {
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_MEMBER,
  FN_MY_NOTIFY,
  FN_NOTIFY_MEMBERS,
  FN_SET_NOTIFY,
  FN_UNSUBSCRIBE,
  MEMBER_FIELD_NOTIFY,
  MEMBER_FIELD_UNSUBSCRIBE_TOKEN,
  NO_LOAD_TIME_FETCH,
  NOTIFY_FILTER
} from './tpl001Vocabulary';

/**
 * The query that finds one `Member` row by the id of the account that owns it.
 *
 * 🔴 **The value comes from `req.userId` and nowhere else.** This is what makes
 * "a member may change their own row and nobody else's" structural: there is no
 * parameter naming a row, so there is no parameter to tamper with.
 */
const MINE_FILTER = {
  combinator: 'and',
  rules: [{ property: 'userId', operator: 'equal to', input: 'userId' }]
};

/** The unsubscribe query, by the opaque token the email carried. */
const BY_TOKEN_FILTER = {
  combinator: 'and',
  rules: [{ property: MEMBER_FIELD_UNSUBSCRIBE_TOKEN, operator: 'equal to', input: 'token' }]
};

/**
 * Read one `Member` row out of a `DbCollection2`'s `items`, defensively.
 *
 * ⚠️ `items` publishes `this._internal.collection` — a Collection, not an array —
 * and its rows are Models rather than plain objects. Both shapes are handled
 * because the one thing worse than reading it wrong is reading it wrong
 * silently: a `.map` on the wrong shape throws, which reaches `failure`, which
 * this template always wires.
 */
const ROWS_PRELUDE =
  'function tpl002Rows(raw) {\n' +
  '  const list = raw && raw.items ? raw.items : (Array.isArray(raw) ? raw : []);\n' +
  '  const out = [];\n' +
  '  for (let i = 0; i < list.length; i++) {\n' +
  '    const m = list[i];\n' +
  '    const data = m && m.data ? m.data : m;\n' +
  '    const id = m && typeof m.getId === "function" ? m.getId() : (data && (data.id || data.objectId));\n' +
  '    out.push({ id: id, data: data || {} });\n' +
  '  }\n' +
  '  return out;\n' +
  '}\n';

// ── 1. myNotifySetting — what the account screen draws the box from ──────────

/**
 * 🔴 **A member cannot read their own `Member` row.** `find`/`get` are
 * `role:admin`, deliberately: the row carries an email address, and widening the
 * collection so a person could read one row would let them read every row.
 * TPL-001's own finding applies unchanged — *a REFUSED query publishes `[]`
 * exactly as an EMPTY one does* — so the screen asks the server instead.
 *
 * ⚠️ **A member with no row answers `false`, not a failure.** The state exists:
 * a moderator minted by `claimAssociation` has a directory row, but so does
 * everyone `decideMembership` approved, and the two writes are in different
 * functions. "You are not signed up for emails" is true for somebody with no row
 * and is what the box should draw.
 */
const MY_NOTIFY_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: `${FN_MY_NOTIFY}()`,
    // No parameters at all: the only input is the session, which is the whole
    // point — a caller must not be able to ask about somebody else's setting.
    parameters: { allowNoAuth: false }
  },
  {
    id: 'who',
    type: 'JavaScriptFunction',
    label: 'Whose setting is this?',
    ports: [
      { name: 'out-ok', plug: 'output', type: 'signal' },
      { name: 'out-nobody', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        '// A blank id is an unauthenticated request. The policy already refuses\n' +
        '// one, so this branch is the belt to that braces — and it answers\n' +
        '// `false` rather than an error, because "not signed up" is true.\n' +
        "const id = Inputs.userId === undefined || Inputs.userId === null ? '' : String(Inputs.userId);\n" +
        'if (id.length === 0) {\n' +
        '  Outputs.notify = false;\n' +
        '  Outputs.nobody();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.userId = id;\n' +
        'Outputs.ok();'
    }
  },
  {
    id: 'mine',
    type: 'DbCollection2',
    label: 'My directory row',
    parameters: { collectionName: COLLECTION_MEMBER, ...NO_LOAD_TIME_FETCH, visualFilter: MINE_FILTER }
  },
  {
    id: 'read',
    type: 'JavaScriptFunction',
    label: 'Ticked or not',
    ports: [{ name: 'out-answered', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 Off, or this node answers once when `rows` arrives and again on the
      // explicit run — two responses on one request, which the Response node
      // reports as `response/already-sent`.
      'runOnChange-in-rows': false,
      functionScript:
        ROWS_PRELUDE +
        '// `rows` is the only output that separates "matched nothing" from "no\n' +
        '// query has run yet"; `isEmpty` is true for both.\n' +
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = tpl002Rows(Inputs.rows);\n' +
        `Outputs.notify = rows.length > 0 && rows[0].data['${MEMBER_FIELD_NOTIFY}'] === true;\n` +
        'Outputs.answered();'
    }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Your setting', parameters: { params: 'notify' } },
  {
    id: 'oops',
    type: 'noodl.cloud.response',
    label: 'Could not be read',
    parameters: { status: 'failure', errorMessage: 'Your email setting could not be read.' }
  }
];

const MY_NOTIFY_WIRES = [
  { fromId: 'req', fromProperty: 'userId', toId: 'who', toProperty: 'in-userId' },
  { fromId: 'req', fromProperty: 'receive', toId: 'who', toProperty: 'run' },

  { fromId: 'who', fromProperty: 'out-userId', toId: 'mine', toProperty: 'qp-userId' },
  { fromId: 'who', fromProperty: 'out-ok', toId: 'mine', toProperty: 'storageFetch' },

  { fromId: 'mine', fromProperty: 'items', toId: 'read', toProperty: 'in-rows' },
  { fromId: 'mine', fromProperty: 'fetched', toId: 'read', toProperty: 'run' },

  { fromId: 'read', fromProperty: 'out-notify', toId: 'res', toProperty: 'pm-notify' },
  { fromId: 'read', fromProperty: 'out-answered', toId: 'res', toProperty: 'send' },
  // Rule 2 again: the "no session" arm publishes its own value and its own send.
  { fromId: 'who', fromProperty: 'out-notify', toId: 'res', toProperty: 'pm-notify' },
  { fromId: 'who', fromProperty: 'out-nobody', toId: 'res', toProperty: 'send' },

  // D27's rule: every `failure` reaches somebody.
  { fromId: 'who', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'mine', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'read', fromProperty: 'failure', toId: 'oops', toProperty: 'send' }
];

// ── 2. setNotifySetting — the account screen's writer ────────────────────────

/**
 * 🔴 **`wanted: false` is a real answer**, so every guard here tests `undefined`
 * and never falsiness. This is `decideMembership`'s `approve` trap in a second
 * place: an untick read as "not ready yet" is a person who cannot turn the
 * emails off from the screen that offers to.
 *
 * ⚠️ **A member with no `Member` row is answered, not failed.** Nothing to write
 * is not an error the person can act on, and this endpoint's job is to leave the
 * flag in the state they asked for — which, with no row, it already is.
 */
const SET_NOTIFY_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: `${FN_SET_NOTIFY}(wanted)`,
    parameters: {
      params: 'wanted',
      'ptype-wanted': 'boolean',
      'preq-wanted': true,
      // The closest this port can come to `role:member`; `nodegx.security.json`
      // is what actually decides, and unticked would resolve to `authenticated`
      // — which in this template is *anybody who asked to join*.
      allowNoAuth: false
    }
  },
  {
    id: 'who',
    type: 'JavaScriptFunction',
    label: 'Hold the change until both are here',
    ports: [{ name: 'out-ok', plug: 'output', type: 'signal' }],
    parameters: {
      functionScript:
        'if (Inputs.wanted === undefined) return;\n' +
        "const id = Inputs.userId === undefined || Inputs.userId === null ? '' : String(Inputs.userId);\n" +
        'if (id.length === 0) return;\n' +
        'Outputs.userId = id;\n' +
        'Outputs.wanted = Inputs.wanted === true;\n' +
        'Outputs.ok();'
    }
  },
  {
    id: 'mine',
    type: 'DbCollection2',
    label: 'My directory row',
    parameters: { collectionName: COLLECTION_MEMBER, ...NO_LOAD_TIME_FETCH, visualFilter: MINE_FILTER }
  },
  {
    id: 'pick',
    type: 'JavaScriptFunction',
    label: 'The row to change, and what to put in it',
    ports: [
      { name: 'out-write', plug: 'output', type: 'signal' },
      { name: 'out-norow', plug: 'output', type: 'signal' }
    ],
    parameters: {
      'runOnChange-in-rows': false,
      'runOnChange-in-wanted': false,
      functionScript:
        ROWS_PRELUDE +
        '// Two producers — the query supplies the row, the request supplies the\n' +
        '// decision — so this opens with the readiness guard rule 2 prescribes.\n' +
        'if (Inputs.rows === undefined || Inputs.wanted === undefined) return;\n' +
        'const rows = tpl002Rows(Inputs.rows);\n' +
        'Outputs.notify = Inputs.wanted === true;\n' +
        'if (rows.length === 0 || !rows[0].id) {\n' +
        '  Outputs.norow();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.rowId = rows[0].id;\n' +
        'Outputs.write();'
    }
  },
  {
    id: 'row',
    type: 'SetDbModelProperties',
    label: 'Save the setting',
    // 🔴 `storeProperties: 'specified'` — the default, and it is load-bearing
    // here. `'all'` would write back every field this node's model holds,
    // including the email address and the unsubscribe token, on a request whose
    // caller may only change one flag.
    parameters: { collectionName: COLLECTION_MEMBER, idSource: 'explicit', storeProperties: 'specified' }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Saved', parameters: { params: 'notify' } },
  {
    id: 'oops',
    type: 'noodl.cloud.response',
    label: 'Could not be saved',
    parameters: { status: 'failure', errorMessage: 'Your email setting could not be saved.' }
  }
];

const SET_NOTIFY_WIRES = [
  { fromId: 'req', fromProperty: 'userId', toId: 'who', toProperty: 'in-userId' },
  { fromId: 'req', fromProperty: 'pm-wanted', toId: 'who', toProperty: 'in-wanted' },
  { fromId: 'req', fromProperty: 'receive', toId: 'who', toProperty: 'run' },

  { fromId: 'who', fromProperty: 'out-userId', toId: 'mine', toProperty: 'qp-userId' },
  { fromId: 'who', fromProperty: 'out-ok', toId: 'mine', toProperty: 'storageFetch' },
  { fromId: 'who', fromProperty: 'out-wanted', toId: 'pick', toProperty: 'in-wanted' },

  { fromId: 'mine', fromProperty: 'items', toId: 'pick', toProperty: 'in-rows' },
  { fromId: 'mine', fromProperty: 'fetched', toId: 'pick', toProperty: 'run' },

  { fromId: 'pick', fromProperty: 'out-rowId', toId: 'row', toProperty: 'modelId' },
  { fromId: 'pick', fromProperty: 'out-notify', toId: 'row', toProperty: `prop-${MEMBER_FIELD_NOTIFY}` },
  { fromId: 'pick', fromProperty: 'out-write', toId: 'row', toProperty: 'store' },

  { fromId: 'pick', fromProperty: 'out-notify', toId: 'res', toProperty: 'pm-notify' },
  { fromId: 'row', fromProperty: 'done', toId: 'res', toProperty: 'send' },
  // Nothing to write, and the answer is the setting they asked for.
  { fromId: 'pick', fromProperty: 'out-norow', toId: 'res', toProperty: 'send' },

  { fromId: 'who', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'mine', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'pick', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'row', fromProperty: 'failure', toId: 'oops', toProperty: 'send' }
];

// ── 3. unsubscribe — the door with no session behind it ─────────────────────

/**
 * 🔴 **This is the only endpoint in the whole template whose authority is a
 * value in a URL**, and it is that way because TPL-002 AC4 requires it: *from
 * the email itself, without asking anyone.* There is no session on the request,
 * so there is no role to check and no `userId` to filter by.
 *
 * What keeps it safe is that the token names the row and the caller never does:
 * the query is `unsubscribeToken equal to <token>`, and the only thing a caller
 * can do with a token they hold is turn off the emails it was minted for.
 *
 * ⚠️ **It only ever writes `false`.** An endpoint that took the value would be a
 * public door that could turn emails ON for somebody, and a stolen token would
 * then be a way to mail a person who had opted out.
 */
const UNSUBSCRIBE_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: `${FN_UNSUBSCRIBE}(token)`,
    parameters: {
      params: 'token',
      'ptype-token': 'string',
      'preq-token': true,
      // Agrees with `functions.unsubscribe.call: "public"`. The token is the gate.
      allowNoAuth: true
    }
  },
  {
    id: 'hold',
    type: 'JavaScriptFunction',
    label: 'Hold the token',
    ports: [
      { name: 'out-ok', plug: 'output', type: 'signal' },
      { name: 'out-blank', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        "const token = Inputs.token === undefined || Inputs.token === null ? '' : String(Inputs.token).trim();\n" +
        '// A blank token must never reach the query: `unsubscribeToken equal to\n' +
        '// ""` would match every row that never had one.\n' +
        'if (token.length === 0) {\n' +
        '  Outputs.blank();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.token = token;\n' +
        'Outputs.ok();'
    }
  },
  {
    id: 'holder',
    type: 'DbCollection2',
    label: 'Whose link is this?',
    parameters: { collectionName: COLLECTION_MEMBER, ...NO_LOAD_TIME_FETCH, visualFilter: BY_TOKEN_FILTER }
  },
  {
    id: 'pick',
    type: 'JavaScriptFunction',
    label: 'The row the token names',
    ports: [
      { name: 'out-write', plug: 'output', type: 'signal' },
      { name: 'out-nomatch', plug: 'output', type: 'signal' }
    ],
    parameters: {
      'runOnChange-in-rows': false,
      functionScript:
        ROWS_PRELUDE +
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = tpl002Rows(Inputs.rows);\n' +
        'if (rows.length === 0 || !rows[0].id) {\n' +
        '  Outputs.nomatch();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.rowId = rows[0].id;\n' +
        '// Never the caller’s value. This door turns emails off and does nothing else.\n' +
        'Outputs.off = false;\n' +
        'Outputs.write();'
    }
  },
  {
    id: 'row',
    type: 'SetDbModelProperties',
    label: 'Turn the emails off',
    parameters: { collectionName: COLLECTION_MEMBER, idSource: 'explicit', storeProperties: 'specified' }
  },
  { id: 'res', type: 'noodl.cloud.response', label: 'Turned off', parameters: {} },
  {
    id: 'nope',
    type: 'noodl.cloud.response',
    label: 'That link did not name anybody',
    // ⚠️ A distinguishable refusal, and the departure is argued in
    // `UNSUBSCRIBE_FAILED_TEXT`: a 128-bit token that only ever travelled to one
    // address is not an oracle worth protecting, and the person this reaches is
    // somebody whose mail client broke the URL.
    parameters: { status: 'failure', errorMessage: 'That unsubscribe link did not work.' }
  }
];

const UNSUBSCRIBE_WIRES = [
  { fromId: 'req', fromProperty: 'pm-token', toId: 'hold', toProperty: 'in-token' },
  { fromId: 'req', fromProperty: 'receive', toId: 'hold', toProperty: 'run' },

  { fromId: 'hold', fromProperty: 'out-token', toId: 'holder', toProperty: 'qp-token' },
  { fromId: 'hold', fromProperty: 'out-ok', toId: 'holder', toProperty: 'storageFetch' },

  { fromId: 'holder', fromProperty: 'items', toId: 'pick', toProperty: 'in-rows' },
  { fromId: 'holder', fromProperty: 'fetched', toId: 'pick', toProperty: 'run' },

  { fromId: 'pick', fromProperty: 'out-rowId', toId: 'row', toProperty: 'modelId' },
  { fromId: 'pick', fromProperty: 'out-off', toId: 'row', toProperty: `prop-${MEMBER_FIELD_NOTIFY}` },
  { fromId: 'pick', fromProperty: 'out-write', toId: 'row', toProperty: 'store' },

  { fromId: 'row', fromProperty: 'done', toId: 'res', toProperty: 'send' },

  { fromId: 'hold', fromProperty: 'out-blank', toId: 'nope', toProperty: 'send' },
  { fromId: 'pick', fromProperty: 'out-nomatch', toId: 'nope', toProperty: 'send' },
  { fromId: 'hold', fromProperty: 'failure', toId: 'nope', toProperty: 'send' },
  { fromId: 'holder', fromProperty: 'failure', toId: 'nope', toProperty: 'send' },
  { fromId: 'pick', fromProperty: 'failure', toId: 'nope', toProperty: 'send' },
  { fromId: 'row', fromProperty: 'failure', toId: 'nope', toProperty: 'send' }
];

// ── 4. notifyMembers — the pump ─────────────────────────────────────────────

/**
 * One announcement, one email each, **one at a time**.
 *
 * 🔴 **`role:admin`, and the graph cannot substitute for it.** The Request node's
 * port cannot spell a role; unticked resolves to `authenticated`, which here is
 * any account that ever asked to join. This endpoint reads every opted-in
 * member's email address, so `authenticated` would be a member list behind a
 * sign-up form.
 *
 * ⚠️ **No `to:` with twenty-four addresses in it.** TPL-002 §6. The pump sends
 * one message per member and no recipient ever learns another exists.
 */
const NOTIFY_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: `${FN_NOTIFY_MEMBERS}(announcementId, siteUrl)`,
    parameters: {
      params: 'announcementId,siteUrl',
      'ptype-announcementId': 'string',
      'preq-announcementId': true,
      'ptype-siteUrl': 'string',
      'preq-siteUrl': false,
      allowNoAuth: false
    }
  },
  {
    id: 'hold',
    type: 'JavaScriptFunction',
    label: 'Hold the id and the address of this site',
    ports: [{ name: 'out-ok', plug: 'output', type: 'signal' }],
    parameters: {
      functionScript:
        "if (Inputs.announcementId === undefined || String(Inputs.announcementId).length === 0) return;\n" +
        'Outputs.announcementId = String(Inputs.announcementId);\n' +
        '// 🔴 Scheme and host only. This string reaches every opted-in inbox, so\n' +
        '// a caller must not be able to put a path, a query or a fragment in it —\n' +
        '// and `new URL` throwing on rubbish is a `failure`, which is wired.\n' +
        "let origin = '';\n" +
        'try {\n' +
        "  const u = new URL(String(Inputs.siteUrl || ''));\n" +
        "  if (u.protocol === 'http:' || u.protocol === 'https:') origin = u.protocol + '//' + u.host;\n" +
        '} catch (e) {\n' +
        "  origin = '';\n" +
        '}\n' +
        'Outputs.origin = origin;\n' +
        'Outputs.ok();'
    }
  },
  {
    id: 'record',
    type: 'DbModel2',
    label: 'The announcement being mailed',
    parameters: { collectionName: COLLECTION_ANNOUNCEMENT, idSource: 'explicit' }
  },
  {
    id: 'wanting',
    type: 'DbCollection2',
    label: 'Members who asked to be told',
    parameters: { collectionName: COLLECTION_MEMBER, ...NO_LOAD_TIME_FETCH, visualFilter: NOTIFY_FILTER }
  },
  {
    id: 'plan',
    type: 'JavaScriptFunction',
    label: 'Build the queue',
    ports: [
      { name: 'out-next', plug: 'output', type: 'signal' },
      { name: 'out-nobody', plug: 'output', type: 'signal' }
    ],
    parameters: {
      'runOnChange-in-rows': false,
      'runOnChange-in-title': false,
      'runOnChange-in-body': false,
      'runOnChange-in-origin': false,
      functionScript:
        ROWS_PRELUDE +
        '// Three producers — the query, the record and the request — so the\n' +
        '// readiness guard is on all of them. `title` may legitimately be blank;\n' +
        '// `undefined` is what "has not arrived" looks like.\n' +
        'if (Inputs.rows === undefined || Inputs.title === undefined) return;\n' +
        'const rows = tpl002Rows(Inputs.rows);\n' +
        'const queue = [];\n' +
        'let unmailable = 0;\n' +
        "let firstError = '';\n" +
        'for (let i = 0; i < rows.length; i++) {\n' +
        '  const d = rows[i].data;\n' +
        "  const to = d.email === undefined || d.email === null ? '' : String(d.email).trim();\n" +
        `  const token = d['${MEMBER_FIELD_UNSUBSCRIBE_TOKEN}'] === undefined || d['${MEMBER_FIELD_UNSUBSCRIBE_TOKEN}'] === null\n` +
        "    ? '' : String(d['" + MEMBER_FIELD_UNSUBSCRIBE_TOKEN + "']);\n" +
        '  if (to.length === 0) {\n' +
        '    unmailable++;\n' +
        "    if (!firstError) firstError = 'One member has no email address on their record.';\n" +
        '    continue;\n' +
        '  }\n' +
        '  // 🔴 An address with no unsubscribe key is NOT mailed. Sending somebody\n' +
        '  // mail they have no one-click way out of is the thing AC4 exists to\n' +
        '  // prevent, and skipping loudly is the only alternative to doing it.\n' +
        '  if (token.length === 0) {\n' +
        '    unmailable++;\n' +
        "    if (!firstError) firstError = 'One member’s record has no unsubscribe key, so they were not emailed.';\n" +
        '    continue;\n' +
        '  }\n' +
        '  queue.push({ to: to, token: token });\n' +
        '}\n' +
        "const title = Inputs.title === null ? '' : String(Inputs.title);\n" +
        "const body = Inputs.body === undefined || Inputs.body === null ? '' : String(Inputs.body);\n" +
        "const origin = Inputs.origin === undefined || Inputs.origin === null ? '' : String(Inputs.origin);\n" +
        '// 🔴 **Written WHOLE, every time, and `Component` is not per-request.**\n' +
        '// Measured, s14: a `planned` flag added here to stop a second plan\n' +
        '// re-entering made every LATER request return before it answered — four\n' +
        '// 30-second cloud-function timeouts — because `_componentScopes` is\n' +
        '// keyed by the component instance id and those are reused between\n' +
        '// invocations. So the scope survives the request that filled it, and\n' +
        '// the only safe use of it is state that is overwritten on the way in.\n' +
        '// See D35.\n' +
        'Component.tpl002 = {\n' +
        '  queue: queue, at: 0, sent: 0, failed: unmailable, firstError: firstError,\n' +
        '  title: title, body: body, origin: origin\n' +
        '};\n' +
        'if (queue.length === 0) {\n' +
        '  Outputs.sent = 0;\n' +
        '  Outputs.failed = unmailable;\n' +
        '  Outputs.error = firstError;\n' +
        '  Outputs.nobody();\n' +
        '  return;\n' +
        '}\n' +
        'Outputs.next();'
    }
  },
  {
    id: 'pump',
    type: 'JavaScriptFunction',
    label: 'One member, then the next',
    ports: [
      { name: 'out-send', plug: 'output', type: 'signal' },
      { name: 'out-finished', plug: 'output', type: 'signal' }
    ],
    parameters: {
      // 🔴 All off. This node is driven by three explicit signals — the plan, a
      // send that worked and a send that did not — and a value-change trigger
      // would advance the cursor a fourth time, skipping a member per round.
      'runOnChange-in-outcome': false,
      'runOnChange-in-error': false,
      functionScript:
        'const s = Component.tpl002;\n' +
        '// Nothing to pump. Reachable only if `plan` threw, which is wired.\n' +
        'if (!s) return;\n' +
        '// Record the send this run is the answer to. The FIRST run comes from\n' +
        '// `plan` and has no outcome to record, which is what `at === 0` means.\n' +
        'if (s.at > 0) {\n' +
        "  if (Inputs.outcome === 'sent') {\n" +
        '    s.sent++;\n' +
        '  } else {\n' +
        '    s.failed++;\n' +
        "    if (!s.firstError && Inputs.error) s.firstError = String(Inputs.error);\n" +
        '  }\n' +
        '}\n' +
        'if (s.at >= s.queue.length) {\n' +
        '  Outputs.sent = s.sent;\n' +
        '  Outputs.failed = s.failed;\n' +
        "  Outputs.error = s.firstError || '';\n" +
        '  Outputs.finished();\n' +
        '  return;\n' +
        '}\n' +
        'const row = s.queue[s.at];\n' +
        's.at++;\n' +
        '// The link is per-member, because the token is. `encodeURIComponent` is\n' +
        '// not decoration: a token is opaque and may hold anything.\n' +
        "const link = s.origin.length > 0\n" +
        "  ? s.origin + '/unsubscribe?token=' + encodeURIComponent(row.token)\n" +
        "  : '';\n" +
        "const tail = link.length > 0\n" +
        "  ? '\\n\\nTo stop receiving these emails, open this link — you do not need to sign in:\\n' + link\n" +
        // 🔴 The link cannot be built without an origin, and an email with no way
        // out must still say how to get out. The account page is the other door.
        "  : '\\n\\nTo stop receiving these emails, sign in and turn them off on your account page.';\n" +
        'Outputs.to = row.to;\n' +
        "Outputs.subject = s.title.length > 0 ? s.title : 'A new announcement';\n" +
        "Outputs.text = (s.title.length > 0 ? s.title + '\\n\\n' : '') + s.body + tail;\n" +
        '// Rule 2 in its sharpest form: the address and the `Do` leave from this\n' +
        '// node, in this order, so the mailer cannot be fired with the previous\n' +
        '// member’s address still in flight.\n' +
        'Outputs.send();'
    }
  },
  {
    id: 'mail',
    type: 'noodl.cloud.sendemail',
    label: 'One member',
    // No `template`: the stored templates are `passwordReset` and `verifyEmail`,
    // and an announcement is neither.
    parameters: {}
  },
  {
    id: 'sent',
    type: 'JavaScriptFunction',
    label: 'That one went',
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      // Rule 2: the outcome word and the advance leave from one node, so the
      // pump cannot count a round before it knows how the round ended.
      functionScript: "Outputs.outcome = 'sent';\nOutputs.error = '';\nOutputs.go();"
    }
  },
  {
    id: 'bad',
    type: 'JavaScriptFunction',
    label: 'That one did not',
    ports: [{ name: 'out-go', plug: 'output', type: 'signal' }],
    parameters: {
      'runOnChange-in-error': false,
      functionScript:
        "Outputs.outcome = 'failed';\n" +
        '// 🔴 Verbatim. When SMTP is unconfigured this string is\n' +
        '// `EmailConfigState.notConfiguredReason()`, which names the Backend\n' +
        '// Services panel — the one thing the moderator reading it has to open.\n' +
        '// A sentence of our own here would drift out of date with the product.\n' +
        "Outputs.error = Inputs.error === undefined || Inputs.error === null ? '' : String(Inputs.error);\n" +
        'Outputs.go();'
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'What happened',
    parameters: { params: 'sent,failed,error' }
  },
  {
    id: 'oops',
    type: 'noodl.cloud.response',
    label: 'The fan-out itself failed',
    parameters: { status: 'failure', errorMessage: 'The announcement was posted, but the emails could not be sent.' }
  }
];

const NOTIFY_WIRES = [
  { fromId: 'req', fromProperty: 'pm-announcementId', toId: 'hold', toProperty: 'in-announcementId' },
  { fromId: 'req', fromProperty: 'pm-siteUrl', toId: 'hold', toProperty: 'in-siteUrl' },
  { fromId: 'req', fromProperty: 'receive', toId: 'hold', toProperty: 'run' },

  { fromId: 'hold', fromProperty: 'out-announcementId', toId: 'record', toProperty: 'modelId' },
  { fromId: 'hold', fromProperty: 'out-ok', toId: 'record', toProperty: 'fetch' },
  { fromId: 'hold', fromProperty: 'out-origin', toId: 'plan', toProperty: 'in-origin' },

  // 🔴 The query runs off the RECORD, not off the request: an announcement that
  // could not be read is one whose subject line would be blank, and mailing
  // twenty-four people an empty notice is worse than mailing nobody.
  { fromId: 'record', fromProperty: 'prop-title', toId: 'plan', toProperty: 'in-title' },
  { fromId: 'record', fromProperty: 'prop-body', toId: 'plan', toProperty: 'in-body' },
  // 🔴 **`done`, and NOT `fetched`.** Measured, s14: the first wiring here used
  // `fetched` and the fan-out mailed two of three members TWICE. `DbModel2`
  // documents `Fetched` as a *value-level announcement* — `setModel` fires it
  // straight from the `Id` input setter, where there is no invocation to have an
  // outcome — and the network response fires it again. So `fetched` arrives
  // twice per fetch, the member query ran twice, `plan` rebuilt the queue with
  // the cursor back at zero while the first pump was still walking it, and five
  // messages went to three people. `Done` is the invocation's outcome and fires
  // once. The two are one letter apart in a port list and opposite in meaning.
  { fromId: 'record', fromProperty: 'done', toId: 'wanting', toProperty: 'storageFetch' },

  { fromId: 'wanting', fromProperty: 'items', toId: 'plan', toProperty: 'in-rows' },
  { fromId: 'wanting', fromProperty: 'fetched', toId: 'plan', toProperty: 'run' },

  { fromId: 'plan', fromProperty: 'out-next', toId: 'pump', toProperty: 'run' },

  { fromId: 'pump', fromProperty: 'out-to', toId: 'mail', toProperty: 'to' },
  { fromId: 'pump', fromProperty: 'out-subject', toId: 'mail', toProperty: 'subject' },
  { fromId: 'pump', fromProperty: 'out-text', toId: 'mail', toProperty: 'text' },
  { fromId: 'pump', fromProperty: 'out-send', toId: 'mail', toProperty: 'send' },

  { fromId: 'mail', fromProperty: 'done', toId: 'sent', toProperty: 'run' },
  { fromId: 'mail', fromProperty: 'failure', toId: 'bad', toProperty: 'run' },
  { fromId: 'mail', fromProperty: 'error', toId: 'bad', toProperty: 'in-error' },

  { fromId: 'sent', fromProperty: 'out-outcome', toId: 'pump', toProperty: 'in-outcome' },
  { fromId: 'sent', fromProperty: 'out-error', toId: 'pump', toProperty: 'in-error' },
  { fromId: 'sent', fromProperty: 'out-go', toId: 'pump', toProperty: 'run' },
  // 🔴 AC6. A failure advances the pump exactly as a success does, or one bad
  // address stops the loop with the announcement posted and nobody told.
  { fromId: 'bad', fromProperty: 'out-outcome', toId: 'pump', toProperty: 'in-outcome' },
  { fromId: 'bad', fromProperty: 'out-error', toId: 'pump', toProperty: 'in-error' },
  { fromId: 'bad', fromProperty: 'out-go', toId: 'pump', toProperty: 'run' },

  { fromId: 'pump', fromProperty: 'out-sent', toId: 'res', toProperty: 'pm-sent' },
  { fromId: 'pump', fromProperty: 'out-failed', toId: 'res', toProperty: 'pm-failed' },
  { fromId: 'pump', fromProperty: 'out-error', toId: 'res', toProperty: 'pm-error' },
  { fromId: 'pump', fromProperty: 'out-finished', toId: 'res', toProperty: 'send' },

  // Nobody ticked the box. A real answer with real zeroes, not a refusal.
  { fromId: 'plan', fromProperty: 'out-sent', toId: 'res', toProperty: 'pm-sent' },
  { fromId: 'plan', fromProperty: 'out-failed', toId: 'res', toProperty: 'pm-failed' },
  { fromId: 'plan', fromProperty: 'out-error', toId: 'res', toProperty: 'pm-error' },
  { fromId: 'plan', fromProperty: 'out-nobody', toId: 'res', toProperty: 'send' },

  { fromId: 'hold', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'record', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'wanting', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'plan', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'pump', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'sent', fromProperty: 'failure', toId: 'oops', toProperty: 'send' },
  { fromId: 'bad', fromProperty: 'failure', toId: 'oops', toProperty: 'send' }
];

// ── The four, in the shape `create_component` takes ─────────────────────────

function cloudComponent(name: string, nodes: unknown[], connections: unknown[]): Tpl001CloudComponent {
  return {
    path: `#__cloud__/${name}`,
    key: `__cloud__/${name}`,
    legacyName: `/#__cloud__/${name}`,
    nodes,
    connections
  };
}

export const TPL002_CLOUD_COMPONENTS: Tpl001CloudComponent[] = [
  cloudComponent(FN_MY_NOTIFY, MY_NOTIFY_NODES, MY_NOTIFY_WIRES),
  cloudComponent(FN_SET_NOTIFY, SET_NOTIFY_NODES, SET_NOTIFY_WIRES),
  cloudComponent(FN_UNSUBSCRIBE, UNSUBSCRIBE_NODES, UNSUBSCRIBE_WIRES),
  cloudComponent(FN_NOTIFY_MEMBERS, NOTIFY_NODES, NOTIFY_WIRES)
];
