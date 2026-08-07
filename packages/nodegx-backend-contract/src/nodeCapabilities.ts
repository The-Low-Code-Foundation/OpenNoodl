/**
 * Which node — and which port — needs which capability. BCN-010.
 *
 * ## Why this is a table and not a field on each node
 *
 * The obvious design is a `capability: 'auth.magicLink'` field beside
 * `displayName` in each node definition, exported through `nodelibraryexport.ts`
 * like every other piece of port metadata. That was the first plan and it is
 * wrong for three reasons, in increasing order of importance:
 *
 * 1. **It is not reviewable.** Richard's answer to open question 2 was "Claude
 *    drafts, Richard reviews" about the ~30 reason strings. The bindings are the
 *    same kind of artefact — a claim about what a node needs — and thirty claims
 *    spread across twenty-two files in three packages cannot be reviewed the way
 *    one table can.
 * 2. **Half the ports are dynamic.** `Subscribe To Changes` on Query Records is
 *    pushed by `dbcollectionnode2.ts`'s port builder, not declared in `inputs`,
 *    so a static field would have to be threaded through the generator anyway.
 * 3. ⚠️ **It would put the binding in another worker's territory.** The nodes
 *    that most need gating are the auth and file families, and those files are
 *    owned by other tasks in this batch. A table lets the binding land without
 *    touching a single node definition — which is also why nothing in this
 *    module changes the catalog.
 *
 * ## What a binding does and does not mean
 *
 * A binding says "this node, or this port, attempts this contract capability".
 * It does **not** say the node is useless without it: a bound *port* is disabled
 * with the reason on it, and a bound *node* is marked, not hidden. The rule from
 * the spec, kept verbatim because it is easy to get backwards:
 *
 * > An unsupported node stays *visible* rather than hidden. Hiding it answers
 * > the question "why can't I do X on Directus?" with silence; showing it
 * > disabled answers it in place.
 *
 * ## The bar for adding a row
 *
 * A row is a claim that this node calls this contract method. Every row below
 * was checked against the node's own implementation, and the ones that were
 * *not* checkable were left out rather than guessed — see
 * {@link DELIBERATELY_UNBOUND}.
 *
 * @module backend-contract/nodeCapabilities
 */

import type { CapabilityKey } from './capabilities';

/** One node type's capability requirements. */
export interface NodeCapabilityBinding {
  /**
   * The capability the node as a whole needs. When this is not usable the node
   * is marked in the picker and on the canvas, with the reason.
   */
  node?: CapabilityKey;
  /**
   * Per-input-port requirements, keyed by port name — including dynamically
   * declared ports, which is most of this family.
   */
  ports?: Readonly<Record<string, CapabilityKey>>;
}

/**
 * The bindings.
 *
 * Keyed by the registered type name, **not** the display label — labels move
 * (this very task moves two of them) and type names appear in every saved
 * project.
 */
export const NODE_CAPABILITIES: Readonly<Record<string, NodeCapabilityBinding>> = Object.freeze({
  // ── Data ────────────────────────────────────────────────────────────────
  //
  // The clearest case in the phase, and the one BCN-001's probe was written to
  // catch: PocketBase answers every aggregate spelling with HTTP 200 and
  // ordinary un-aggregated rows. An Aggregate Records node pointed at PocketBase
  // returns wrong numbers with nothing to catch — so the node carries the gate,
  // not one of its ports.
  'noodl.cloud.aggregate': Object.freeze({ node: 'data.aggregate' }),

  // Query Records. The node itself needs nothing beyond `data.query`, which
  // every backend in the descriptor supports, so there is no node-level row —
  // a gate that can never fire is noise on screen and a lie in a table.
  //
  // `realtime` is BCN-008's fold of Subscribe To Changes onto the query. The
  // port is declared whatever the backend is, deliberately (see the comment at
  // its push site), and this is what puts the reason under it.
  DbCollection2: Object.freeze({ ports: Object.freeze({ realtime: 'realtime.subscribe' }) }),

  // FH-021's standalone Subscribe To Changes. A **`node:`** row, not a `ports:` one, and
  // the difference is the whole reason both spellings exist: on Query Records realtime is
  // one optional port on a node that queries perfectly well without it, whereas this node
  // *is* the subscription — there is nothing left of it on a backend that cannot push. The
  // `noodl.cloud.aggregate` precedent above, for the same reason.
  //
  // ⚠️ This marks the node with a sentence; it does not hide it and it does not gate a
  // port. That is TALK-005's shipped correction, and the runtime says the same thing twice
  // over on purpose: `realtimeSupportFor` answers again at connect time and the reason
  // lands on `Realtime Error`, because a canvas warning is not reachable from a running app.
  SubscribeToChanges: Object.freeze({ node: 'realtime.subscribe' }),

  // Access Control Rules is a Parse-family idea. Directus has roles, Supabase
  // has RLS and PocketBase has API rules — all three configured in that
  // backend's own admin, none of them reachable from a per-record rule list.
  // The descriptor's reason says exactly that, per backend.
  NewDbModelProperties: Object.freeze({ ports: Object.freeze({ accessControl: 'data.acl' }) }),
  SetDbModelProperties: Object.freeze({ ports: Object.freeze({ accessControl: 'data.acl' }) }),

  // Relations. `addRemove` is `degraded` on Directus and Supabase rather than
  // unsupported — BCN-005 measured both, and a caveat is the right rendering:
  // the node works, but only against a join table shaped the way the reason
  // describes.
  AddDbModelRelation: Object.freeze({ node: 'relations.addRemove' }),
  RemoveDbModelRelation: Object.freeze({ node: 'relations.addRemove' }),

  // ── Files ───────────────────────────────────────────────────────────────
  //
  // ⚠️ The `files.*` descriptor **rows** belong to BCN-007. These are bindings
  // onto those rows, which is the other side of the seam: nothing here asserts
  // what a backend can do, only which node asks.
  'Upload File': Object.freeze({ node: 'files.upload' }),
  'Sign File URL': Object.freeze({ node: 'files.sign' }),

  // ── Auth ────────────────────────────────────────────────────────────────
  //
  // ⚠️ Same seam: the `auth.*` rows belong to BCN-006.
  //
  // Log Out, User and Set User Properties have no row. Ending a session is not
  // a capability any descriptor cell describes, and gating "who is signed in"
  // on a password cell would disable the node that reports *no one is* — which
  // is the state the gate is supposed to be reachable from.
  'net.noodl.user.LogIn': Object.freeze({ node: 'auth.password' }),
  'net.noodl.user.SignUp': Object.freeze({ node: 'auth.signUp' }),
  'net.noodl.user.RequestMagicLink': Object.freeze({ node: 'auth.magicLink' }),
  'net.noodl.user.SignInWith': Object.freeze({ node: 'auth.oauth' }),
  'net.noodl.user.VerifyEmail': Object.freeze({ node: 'auth.emailVerify' }),
  'net.noodl.user.SendEmailVerification': Object.freeze({ node: 'auth.emailVerify' }),
  'net.noodl.user.ResetPassword': Object.freeze({ node: 'auth.passwordReset' }),
  'net.noodl.user.RequestPasswordReset': Object.freeze({ node: 'auth.passwordReset' })
});

/**
 * Nodes that look like they want a binding and deliberately do not have one.
 *
 * Recorded rather than omitted, because the next person to read the table will
 * otherwise re-derive each of these and add half of them. Exported so a test can
 * assert the two lists are disjoint — an entry that appears in both means
 * someone changed their mind in one place only.
 */
export const DELIBERATELY_UNBOUND: Readonly<Record<string, string>> = Object.freeze({
  'Cloud File':
    'It holds a file reference and reads its url. It does not upload, sign or delete, so no cell describes what it needs.',
  'net.noodl.user.LogOut': 'Ending a session is not a descriptor cell, and every backend with auth can do it.',
  'net.noodl.user.User': 'Reports who is signed in — including "no one", which is the state a gate must stay readable from.',
  'net.noodl.user.SetUserProperties':
    'Writes user columns through the same save path as any record; `auth.signUpProperties` is about sign-up, not later edits.',
  DbModel2: 'Fetch and save are `data.fetch`/`data.save`, supported on every backend in the descriptor.',
  DeleteDbModelProperties: '`data.delete` is supported on every backend in the descriptor.',
  FilterDBModels: 'Filters an in-memory collection; its per-operator gating is BCN-003b\'s, on the filter port.'
  // ⚠️ `DbConfig` had a row here until FH-025. The node type was deleted by
  // FH-018 and its last instances by FH-023, and the row outlived both — this
  // package cannot see the node catalog (it must not: a contract package that
  // imports the editor's catalog inverts BCN-001's dependency), so nothing here
  // could ever have said so. The guard that now does live in the editor, in
  // `tests-unit/aib-007/backendRequirement.test.ts`, which already imports both
  // this table and the catalog.
});

/** The binding for a type, or `undefined`. */
export function capabilitiesForNode(typeName: string): NodeCapabilityBinding | undefined {
  return Object.prototype.hasOwnProperty.call(NODE_CAPABILITIES, typeName)
    ? NODE_CAPABILITIES[typeName]
    : undefined;
}

/** The capability a node as a whole needs, or `undefined`. */
export function nodeCapabilityKey(typeName: string): CapabilityKey | undefined {
  return capabilitiesForNode(typeName)?.node;
}

/** The capability one input port needs, or `undefined`. */
export function portCapabilityKey(typeName: string, portName: string): CapabilityKey | undefined {
  const ports = capabilitiesForNode(typeName)?.ports;
  if (!ports) return undefined;
  return Object.prototype.hasOwnProperty.call(ports, portName) ? ports[portName] : undefined;
}

/** Every capability key any node binds, for a probe runner deciding what to ask. */
export function boundCapabilityKeys(): CapabilityKey[] {
  const keys = new Set<CapabilityKey>();
  for (const binding of Object.values(NODE_CAPABILITIES)) {
    if (binding.node) keys.add(binding.node);
    for (const key of Object.values(binding.ports || {})) keys.add(key);
  }
  return Array.from(keys).sort();
}
