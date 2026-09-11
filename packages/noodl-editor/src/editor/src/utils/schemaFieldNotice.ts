/**
 * DEF-036 AC1/AC2 — the sentence a data node says when it has no fields to show, and why.
 *
 * ## The defect
 *
 * A `Create Record`, `Set Record Properties`, `Record`, `User`, `Set User Properties` or
 * `Sign Up` node mints one `prop-<column>` port per column of its table, out of the schema
 * `SchemaHandler` caches. With no schema to read it mints **none** — and says nothing at all.
 * The panel is simply empty. DEF-036 §2 measured what that costs: the wires already attached
 * to those ports become `con-no-source-port` / `con-no-target-port`, both `level: 'error'`, and
 * DEF-034 established that an error is exactly what deletes a wire from an export. **271 wires
 * across 21 of the 118 corpus projects** leave a build that way, silently.
 *
 * 🔴 **Richard ruled Option B**: a wire must not mint a column on the accounts table, because
 * *"it'll create the bad habit of not thinking about the schema as a preamble"*. So this module
 * does not rescue the wires. It closes the person-sentence — *your sign-up form quietly stops
 * writing the fields you added to it* — by making the silence legible, which is the half of
 * DEF-036 that survives the ruling. The wires still leave the build, and that is intended.
 *
 * ## Why the reason is a code and the copy lives here
 *
 * `fetchBuiltInSchema` has drawn AC1's distinction since DEF-035 and threw it away one frame
 * later; `SchemaHandler.lastOutcome` now keeps it. What arrives here is a `cause`, never prose
 * to be matched — see {@link NotApplicableCause}'s note for why matching English substrings is
 * not allowed to be the discriminator.
 *
 * The panel calls this and renders what it returns. Nothing here touches the DOM, a singleton
 * or a project, for the reason `schemaCachePolicy.ts` and `portGate.ts` both state: a message
 * that exists only as a literal inside an unreachable view is graded by reading the file, which
 * passes just as well on a literal nothing renders.
 *
 * ## 🔴 What this deliberately does not detect
 *
 * - **A node with fields already.** `unavailable` leaves the previous schema in place on
 *   purpose (DEF-035), so a stopped backend often still has ports on the canvas. Warning there
 *   would tell an author their working node is broken. The test is *this node has no field
 *   ports*, not *the backend is unhappy*.
 * - **A node pointed at its own backend.** The Record family carries a `backendId` parameter
 *   (BCN-004 step 5) and can be aimed at a Directus or PocketBase backend whose schema comes
 *   from `backendServices`, not from `SchemaHandler`. `lastOutcome` is then an answer about a
 *   *different* backend, and "this project has no backend attached" would be a lie about a node
 *   that has one. Those nodes get nothing until somebody measures that path.
 * - **A backend that answered.** `status: 'schema'` means the read worked. A node with no
 *   fields then has some other cause — most often no table chosen yet, which the Class picker
 *   directly above already states — and a second, vaguer sentence about it would be noise.
 *   ⚠️ Including the case of a backend with genuinely zero tables: real, and not this row's.
 *
 * @module noodl-editor/utils/schemaFieldNotice
 */

import type { SchemaBackendRef, SchemaFetchOutcome } from './schemaCachePolicy';

/**
 * The nodes whose field list *is* the schema, and which plug carries it.
 *
 * 🔴 Derived from the port generators, not from the node categories. `prop-*` ports exist on a
 * Record-family node only where `DbModelCRUDBase.addInputProperties` is applied — which is
 * `NewDbModelProperties` and `SetDbModelProperties` and nothing else; `DeleteDbModelProperties`
 * and both relation nodes carry a records' *id*, never its columns, and say so in their own
 * source. `DbModel2` publishes the same family as outputs through `recordFieldPorts`. The User
 * family is two code paths, not one (DEF-036 §2): `user-ports.ts` serves `User` and
 * `SetUserProperties`, while `SignUp` runs an inline loop in a different package keyed on a
 * different metadata key — both are listed here because both go silent together.
 *
 * ⚠️ Keyed by **registered type name**, never display label, for `backendRequirement.ts`'s
 * reason: labels move, type names are in every saved project. `tests-unit` asserts every key
 * here is also a key of `NODES_REQUIRING_BACKEND`, which has its own completeness guard against
 * the catalog — a typo'd name would otherwise disable this quietly for one node.
 */
export const SCHEMA_FIELD_NODES: Readonly<Record<string, SchemaFieldNodeKind>> = Object.freeze({
  NewDbModelProperties: { plug: 'input', table: 'parameter' },
  SetDbModelProperties: { plug: 'input', table: 'parameter' },
  DbModel2: { plug: 'output', table: 'parameter' },
  'net.noodl.user.User': { plug: 'output', table: 'accounts' },
  'net.noodl.user.SetUserProperties': { plug: 'input', table: 'accounts' },
  'net.noodl.user.SignUp': { plug: 'input', table: 'accounts' }
});

/**
 * What one entry of {@link SCHEMA_FIELD_NODES} records.
 *
 * `plug` decides a word in the sentence: `Sign Up` has nothing to *write*, `User` has nothing
 * to *read*, and both are the same defect said to two different people.
 *
 * `table` is how the node names its table. The Record family has a Class dropdown, so the
 * answer is a parameter. The User family has none: its table *is* the accounts table, chosen by
 * the backend rather than the author.
 */
export interface SchemaFieldNodeKind {
  plug: 'input' | 'output';
  table: 'parameter' | 'accounts';
}

/** The Record family's Class dropdown, by parameter name — `schema-ports.ts`'s `collectionParam`. */
export const RECORD_TABLE_PARAMETER = 'collectionName';

/**
 * The accounts table of the built-in backend.
 *
 * ⚠️ A deliberate duplicate of `userCollectionName(undefined)` in
 * `noodl-runtime/…/user/user-ports.ts`, which maps a *backend type* to its accounts table and
 * answers `_User` for the Parse wire. Every caller of this constant is already gated on an
 * outcome of `status: 'schema'` from `fetchBuiltInSchema`, which returns that status only for a
 * backend whose endpoint type is `nodegx` — so the Parse-wire arm is the only one reachable
 * here, and importing the runtime's map into the editor to read one entry of it would be the
 * larger coupling. 🔴 If this module is ever asked about a Directus or PocketBase backend, this
 * is the line that is wrong, and `USER_COLLECTION_BY_BACKEND_TYPE` is what it should become.
 */
export const USER_ACCOUNTS_TABLE = '_User';

/**
 * The table this node's fields come from, or `undefined` if the author has not chosen one.
 *
 * 🔴 `undefined` is a real answer and AC4 turns on it: *"if no table is chosen, it must not
 * silently pick one."* A Create Record node with an empty Class dropdown has no schema editor
 * that could be the right one to open.
 */
export function schemaTableForNode(
  typename: string | undefined,
  getParameter: (name: string) => unknown
): string | undefined {
  const kind = typename ? SCHEMA_FIELD_NODES[typename] : undefined;
  if (!kind) return undefined;
  if (kind.table === 'accounts') return USER_ACCOUNTS_TABLE;

  const chosen = getParameter(RECORD_TABLE_PARAMETER);
  return typeof chosen === 'string' && chosen ? chosen : undefined;
}

/** What a caller has to know about the selected node to be told anything. */
export interface SchemaFieldSubject {
  /** The node's registered type name. */
  typename: string | undefined;
  /** The last answer `SchemaHandler` got, or `undefined` before the first attempt completes. */
  outcome: SchemaFetchOutcome | undefined;
  /** How many `prop-*` ports the node has right now, on either plug. */
  fieldPortCount: number;
  /**
   * The node's `backendId` parameter, verbatim and unjudged.
   *
   * 🔴 Passed raw rather than as a "does it have one" boolean, because the obvious boolean is
   * wrong. See {@link namesOwnBackend}.
   */
  backendIdParameter?: unknown;
}

/**
 * The Backend dropdown's default, and what it means.
 *
 * 🔴 `_active_` is **not** a backend. `resolveSchemaPortContext` reads it as *"whatever the
 * project's active backend is"* — `schema-ports.ts:490` treats it and an absent parameter as the
 * same value, on the same line. A node set to `Active Backend` is therefore described by
 * `SchemaHandler`'s outcome exactly like a node with no parameter at all.
 *
 * ⚠️ This is the shape that would have shipped broken and silent. `backendId` is a declared port
 * with `default: '_active_'`, so a `Boolean(getParameter('backendId'))` test reads **true** for
 * every Record node whose author has ever opened that dropdown and chosen the default — and this
 * whole feature would have switched itself off for them, with nothing on screen to say so and
 * every test still green, because the tests would have been written against the same boolean.
 */
export const ACTIVE_BACKEND_VALUE = '_active_';

/** Whether the node names a backend of its own rather than using the project's. */
export function namesOwnBackend(backendIdParameter: unknown): boolean {
  return typeof backendIdParameter === 'string' && backendIdParameter !== '' && backendIdParameter !== ACTIVE_BACKEND_VALUE;
}

/** One notice, ready to draw. `cause` is for tests and `data-test`, never for the reader. */
export interface SchemaFieldNotice {
  cause: string;
  /** The heading — what state the node is in. */
  title: string;
  /** What it means for this node, and what to do about it. */
  message: string;
}

/**
 * The two sentences AC1 requires, and the four more the outcome can already tell apart.
 *
 * 🔴 AC1's bar is that *no backend is attached* and *a backend is attached but is not running*
 * are **two different sentences with two different next actions**, and that one message covering
 * both is the defect restated. The extra arms below are not scope creep: each is a state
 * `fetchBuiltInSchema` genuinely distinguishes, and collapsing them would put an author who is
 * waiting three seconds for a backend to finish starting in front of a message telling them to
 * go and start it.
 *
 * ⚠️ `no-project`, `no-ipc` and `threw` are facts about **this editor**, not about the project,
 * and share a sentence that blames neither. Telling someone their project has no backend
 * because an IPC call threw is worse than saying nothing.
 */
export function schemaFieldNotice(subject: SchemaFieldSubject): SchemaFieldNotice | undefined {
  if (!subject.typename || !(subject.typename in SCHEMA_FIELD_NODES)) return undefined;
  // A node with fields is a node whose author has nothing to explain. See the module note.
  if (subject.fieldPortCount > 0) return undefined;
  if (namesOwnBackend(subject.backendIdParameter)) return undefined;

  const outcome = subject.outcome;
  // Nothing has been asked yet. "Not yet known" is not an explanation, and a wrong explanation
  // is worse than the silence this row exists to remove.
  if (!outcome || outcome.status === 'schema') return undefined;

  const noun = SCHEMA_FIELD_NODES[subject.typename].plug === 'input' ? 'write' : 'read';

  switch (outcome.cause) {
    case 'no-endpoint':
      return {
        cause: outcome.cause,
        title: 'This project has no backend',
        message:
          `There is no database to read a schema from, so this node has no fields to ${noun} and ` +
          `any connection to one is dropped from your build. Create or attach a backend in Backend ` +
          `Services, then add the fields you need to its table.`
      };

    case 'external-endpoint':
      return {
        cause: outcome.cause,
        title: 'This backend’s schema cannot be read',
        message:
          `This project points at an external server that NodeGX holds no key for, so it cannot list ` +
          `the table’s fields here. The fields still exist on that server; this node cannot see them, ` +
          `and connections to them are dropped from your build.`
      };

    case 'not-running':
      return {
        cause: outcome.cause,
        title: 'This project’s backend is not running',
        message:
          `Its schema cannot be read while it is stopped, so this node has no fields to ${noun} and ` +
          `any connection to one would be dropped from a build taken now. Start it in Backend Services ` +
          `— the fields come back here on their own, without reopening the project.`
      };

    case 'not-registered-yet':
      return {
        cause: outcome.cause,
        title: 'This project’s backend is still starting',
        message:
          `Its schema has not been read yet, so this node has no fields to ${noun} for the moment. ` +
          `They appear here on their own once it is up. ⚠️ A build taken before then drops any ` +
          `connection to one.`
      };

    case 'unreadable-reply':
      return {
        cause: outcome.cause,
        title: 'This project’s backend did not answer with a table list',
        message:
          `It is running, but what it returned could not be read as a schema, so this node has no ` +
          `fields to ${noun} and connections to them are dropped from your build. Restarting it in ` +
          `Backend Services is the first thing to try.`
      };

    case 'no-project':
    case 'no-ipc':
    case 'threw':
      return {
        cause: outcome.cause,
        title: 'The database schema could not be read',
        message:
          `This editor could not reach the project’s backend to read its schema, so this node has no ` +
          `fields to ${noun}. Nothing is wrong with the project itself; a build taken now would drop ` +
          `any connection to one of those fields.`
      };
  }
}

/**
 * AC2/AC4 — where an **Add a field** control on this node would take the author, or nowhere.
 *
 * 🔴 One function, not a `canOffer` predicate beside a `resolveTarget` one. Two of those are two
 * places to decide the same thing, and the failure is silent in the worst direction: the button
 * draws because the predicate said yes, and the click goes nowhere because the resolver said no.
 * A caller draws the button if and only if this returns a destination.
 *
 * Every refusal below is a dead end AC2 names or a rider Richard gave:
 *
 * - **the schema was not read** ⇒ there is no schema editor to open, and the node is showing
 *   {@link schemaFieldNotice} instead. *"An Add button that cannot reach a schema editor is a
 *   second dead end."*
 * - **an external backend** ⇒ *"parts 1 and 2 are for our own internal DB"*, in as many words.
 *   Reached through the outcome: an endpoint we hold no key for never returns `status: 'schema'`.
 * - **no table chosen** ⇒ *"if no table is chosen, it must not silently pick one."*
 * - **no backend ref on the outcome** ⇒ we would be inventing the id we jump with; see
 *   {@link SchemaBackendRef}.
 * - **a node aimed at its own backend** ⇒ the module note's second non-detection.
 */
export function addFieldTarget(
  subject: SchemaFieldSubject & { selectedTable?: string }
): { backend: SchemaBackendRef; table: string } | undefined {
  if (!subject.typename || !(subject.typename in SCHEMA_FIELD_NODES)) return undefined;
  if (namesOwnBackend(subject.backendIdParameter)) return undefined;

  const outcome = subject.outcome;
  if (!outcome || outcome.status !== 'schema' || !outcome.backend) return undefined;
  if (!subject.selectedTable) return undefined;

  return { backend: outcome.backend, table: subject.selectedTable };
}
