/**
 * The shared half of the four user-administration nodes (CWF-015).
 *
 * ## ⚠️ Cloud only, deliberately — the second family registered here for the reason
 *
 * These are registered in `noodl-viewer-cloud/src/nodes/index.ts` beside Request,
 * Response and Secret, and NOT in `@noodl/runtime`'s shared list. That list
 * reaches every runtime, so a node put there by mistake silently becomes browser
 * vocabulary — which is how AIX-005 leaked fourteen nodes into the cloud. Here
 * the mistake runs the other way and is worse: **a node that creates accounts,
 * shipped in a browser bundle, is account creation in the hands of everyone who
 * opens the page.** The generated catalog records `availableIn: ["cloud"]`; if it
 * ever says `browser`, the registration moved.
 *
 * The seven session-shaped user nodes the browser has — Sign Up, Log In, Log Out,
 * Verify Email, Reset Password, Sign In With, Magic Link — are still absent
 * server-side and stay absent. Each of them sets *the browser's current session*
 * as a side effect, and "the server is now logged in as bob" is meaningless in a
 * process answering many requests at once. Nothing here touches the runtime's
 * current user: every operation addresses a row by id, and the `Request` node's
 * per-request `UserService.forScope` scope is left exactly alone.
 *
 * ## What the graph carries
 *
 * A `Password` port and a `Token` port are `allowConnectionsOnly`, so the
 * property panel offers no field to type one into (`propertyeditor/DataTypes/
 * Ports.ts` filters them out) and the semantic validator errors on a parameter
 * for one. That is the Secret node's "the graph carries a name, never a value"
 * property applied to the two credentials these nodes handle: neither can be
 * frozen into the project file a deploy ships.
 *
 * Nothing here logs. The backend end (`nodegx-backend/users/SystemUsers.ts`)
 * audits *keys*, never values, and the execution-history scrubber already
 * replaces any request-body key matching `pass(word|wd)?|…|token` before a run
 * record is written (`execution-history/scrub.ts` `SENSITIVE_KEY_PATTERN`) — so
 * a function whose Request node names its parameter `password` or `token` is
 * covered by the rule that already exists, without a second one being invented
 * here.
 */

import { reportOutcomes } from '@noodl/runtime/src/outcome';

/** What `_noodl_system_users` answers with — see nodegx-backend `users/SystemUsers.ts`. */
export interface SystemUserResult {
  outcome: 'done' | 'unchanged' | 'failure';
  code?: string;
  error?: string;
  userId?: string;
  username?: string;
  valid?: boolean;
  sessionsRevoked?: number;
}

/** The message every one of these nodes gives when it is not running in a backend. */
export const NO_BACKEND_MESSAGE =
  'no user store is available. This node only works inside a nodegx-backend cloud function ' +
  '(CWF-015) — it is not usable in the browser viewer, where creating accounts is what Sign Up is for.';

/**
 * The `properties` stringlist port, shared by Create User and Update User.
 *
 * The same `namedports/list` idiom Request and Response use for their parameter
 * ports, rather than Set User Properties' schema-discovered `prop-<column>`
 * ports. Two reasons, both checkable: those ports are discovered from the
 * `_User` schema through an editor connection the cloud runtime never has, and
 * an explicit list is what makes "these are the columns this function writes"
 * legible on the canvas — which is the whole difference between this family and
 * the node that writes to whoever is signed in.
 */
export const propertiesInput = {
  group: 'Properties',
  displayName: 'Properties',
  type: { name: 'stringlist', allowEditOnly: true },
  description:
    'Names of the user columns this node writes, each becoming an input to supply the value. ' +
    'A name the backend refuses — objectId, ACL, password, sessionToken, or anything starting with "_" — ' +
    'is a Failure naming the key, never a silent drop',
  set: function (this: NodeLike, value: unknown) {
    this._internal.properties = value;
  }
};

/** The `namedports/list` declaration that mints one `prop-<name>` input per listed name. */
export const propertyDynamicPorts = [
  {
    name: 'namedports/list',
    parameter: 'properties',
    port: {
      name: 'prop-{{*}}',
      displayName: '{{*}}',
      type: '*',
      plug: 'input',
      group: 'Properties'
    }
  }
];

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The subset of the runtime node instance these helpers touch. */
interface NodeLike {
  _internal: Record<string, any>;
  hasInput(name: string): boolean;
  registerInput(name: string, def: Record<string, any>): void;
  flagOutputDirty(name: string): void;
  scheduleAfterInputsHaveUpdated(cb: () => void): void;
  [key: string]: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** `registerInputIfNeeded` for the `prop-` family. Response's `pm-` shape, one prefix along. */
export function registerPropertyInput(this: NodeLike, name: string): void {
  if (this.hasInput(name)) return;
  if (!name.startsWith('prop-')) return;
  const key = name.substring('prop-'.length);
  this.registerInput(name, {
    set: (value: unknown) => {
      if (!this._internal.userProperties) this._internal.userProperties = {};
      this._internal.userProperties[key] = value;
    }
  });
}

/**
 * Publish on `Error` and settle every invocation in this batch as a failure.
 *
 * `tokens` is passed rather than read back from `_internal`, for the reason
 * ERG-001 §4 gives: an outcome must not be inferred from state a branch has
 * already changed.
 */
export function setError(this: NodeLike, code: string, message: string, tokens: unknown[]): void {
  this._internal.error = message;
  this.flagOutputDirty('error');
  reportOutcomes(this as never, (tokens || []) as never[], 'failure', { code, message });
}

/**
 * The one call into the backend, shared by all four nodes.
 *
 * ⚠️ **The result's `outcome` is reported verbatim.** "That username is taken",
 * "there is no such user" and "that token is not one of ours" are decided at the
 * end that knows — a node re-deriving them from a `code` string would be four
 * nodes each re-deriving them, and the first divergence would be a duplicate
 * signup reported as a hard failure on one node and a no-op on another.
 */
export function callSystemUsers(
  this: NodeLike,
  label: string,
  request: Record<string, unknown>,
  tokens: unknown[],
  onDone: (result: SystemUserResult) => void
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemUsers = (globalThis as any)._noodl_system_users;
  if (typeof systemUsers !== 'function') {
    // The same two-case split as Send Email and Secret: absent means "this
    // graph is not running inside nodegx-backend at all", which is a different
    // problem from "running here and the operation was refused".
    setError.call(this, 'user/no-backend', `${label}: ${NO_BACKEND_MESSAGE}`, tokens);
    return;
  }

  Promise.resolve(systemUsers(request))
    .then((result: SystemUserResult) => {
      if (!result || !result.outcome) {
        setError.call(this, 'user/no-answer', 'The backend gave no answer to this user operation.', tokens);
        return;
      }
      if (result.outcome === 'failure') {
        setError.call(this, result.code || 'user/failed', result.error || 'The user operation failed.', tokens);
        return;
      }
      this._internal.error = result.outcome === 'unchanged' ? result.error : undefined;
      this.flagOutputDirty('error');
      onDone(result);
      reportOutcomes(this as never, tokens as never[], result.outcome);
    })
    .catch((e: unknown) => {
      // Deliberately does NOT forward a thrown value's own shape: a store that
      // throws mid-write must not get to choose the message an author reads.
      setError.call(
        this,
        'user/failed',
        `The user operation failed: ${e instanceof Error ? e.message : String(e)}`,
        tokens
      );
    });
}

/**
 * The coalescing scheduler every one of these nodes uses for its action port.
 *
 * ⚠️ The pending array is created lazily rather than in `initialize`, for the
 * reason Send Email and Secret both record: several suites build a node as a bag
 * of bound methods and never call `initialize`, and an eager field is
 * `undefined` exactly where the first invocation reads it.
 *
 * The guard drops the second pulse's *work* in an update pass deliberately —
 * that is how "set the fields, then press Do" batches — but Rule 1 is per
 * invocation, so the second pulse's token is queued above it.
 */
export function scheduleAction(this: NodeLike, token: unknown, run: () => void): void {
  if (token) {
    if (!this._internal.pendingOutcomes) this._internal.pendingOutcomes = [];
    this._internal.pendingOutcomes.push(token);
  }
  if (this._internal.actionScheduled) return;
  this._internal.actionScheduled = true;
  this.scheduleAfterInputsHaveUpdated(() => {
    this._internal.actionScheduled = false;
    run();
  });
}

/**
 * Drain the batch into a local *before* the request starts, so a second `Do`
 * arriving mid-flight owns its own batch rather than being settled by this
 * request's answer.
 */
export function drainOutcomes(this: NodeLike): unknown[] {
  const tokens = this._internal.pendingOutcomes || [];
  this._internal.pendingOutcomes = undefined;
  return tokens;
}

/** The `Error` output, identical on all four nodes. */
export const errorOutput = {
  displayName: 'Error',
  type: 'string',
  group: 'Error',
  description: 'Why the last operation could not be performed. It never contains a password, a hash or a token',
  getter: function (this: NodeLike) {
    return this._internal.error;
  }
};
