/**
 * NDA-004 §2 — the failure surface shared by the three Array mutators.
 *
 * `Insert Object Into Array`, `Remove Object From Array` and `Clear Array` are the Array
 * family's action nodes: each takes an author `Do`, resolves an array by id, and changes it.
 * Each had its own answer to "what happens when there is nothing to change", and all three
 * answers were wrong in a different way — Insert warned the editor and returned, Remove
 * returned twice with no diagnosis at all, and Clear called `set([])` on `undefined` and threw
 * a `TypeError` out of a scheduled callback.
 *
 * This is one implementation rather than three copies on purpose. FINDINGS B-iv is the phase's
 * standing lesson on the subject: `setError` "the shared helper" turned out to be 22 separate
 * near-identical definitions, and the divergence between copies was itself the defect. Three
 * sibling nodes that must agree about the same failure get one place to agree in.
 *
 * The mixin is opt-in for the same reason `modelcrudbase.addFailure` is: `Create New Array`
 * builds its own collection (`Collection.get()` with no name) and therefore cannot fail to find
 * one. A `Failure` output on a node that cannot fail is worse than no output at all — see
 * `dev-docs/reference/FAILURE-CONTRACT.md`, "what counts as a failure" — so it does not apply
 * this and a corpus row pins the absence.
 */

import Collection from '@noodl/runtime/src/collection';
import type { CollectionLike, NodeDefinitionOptions, NodeInstance, OutcomeToken } from '@noodl/types';

/** A node definition part-way through assembly, as the three call sites hand it over. */
type FailableCollectionDef = Partial<NodeDefinitionOptions> & Pick<NodeDefinitionOptions, 'name'>;

/** `this` inside a node that has had {@link addCollectionFailure} applied. */
export interface FailableCollectionInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
    modifyId?: string;
    error?: string;
  };
  setCollection(collection: CollectionLike | undefined): void;
  /** The array to act on could not be resolved. */
  _failNoCollection(token: OutcomeToken, action: string): void;
  /** The object to insert or remove was never supplied. */
  _failNoObjectId(token: OutcomeToken, action: string): void;
  /** The Object Id names a record this runtime has never loaded. */
  _failUnknownObjectId(token: OutcomeToken, action: string, id: string): void;
  /** A `Do` that succeeded sheds whatever the last one raised. */
  _clearCollectionFailure(): void;
}

/**
 * Bind an Array Id to a collection **without** minting one when the id is missing.
 *
 * `Collection.get(undefined)` is the anonymous tier (`collection.ts:721-727`): it returns a
 * *fresh, differently-named* collection on every call, registered weakly and reachable by
 * nothing. Handing an unresolved id straight to it is exactly the trap `Set Parent Component
 * Object Properties` fell into with `Model.get(undefined)` — the node then holds a real-looking
 * collection, the `=== undefined` guard below passes, the mutation lands in a throwaway and the
 * node reports `Done`. A completion signal for work that went nowhere is the one thing the
 * Failure Contract says must never happen, and it is invisible from the graph.
 *
 * Empty string is deliberately *not* funnelled here. `Collection.get('')` returns a stable named
 * collection, so an Insert followed by a read of the same empty id at least agrees with itself —
 * odd, but not the silent-success defect. `undefined` is the only value that produces a
 * different array every time it is asked for.
 */
export function resolveCollectionId(id: string | undefined): CollectionLike | undefined {
  if (id === undefined) return undefined;
  return Collection.get(id);
}

/**
 * `set` for an `Array Id` input. Both empty values unbind, and that is a deliberate departure
 * from the Empty-Value Contract's default reading — worth the paragraph, because the first
 * attempt got it the other way round.
 *
 * The contract says `undefined` abstains: an upstream with no opinion leaves the target as it
 * was, which is the call `collectionnode2.ts`'s `items` makes and the contract explicitly
 * blesses. That reasoning does not transfer to *this* port, because a connection can never
 * deliver `undefined` to it. `Node.prototype.sendValue` (`node.ts:635-637`) drops `undefined`
 * before it reaches any receiver, so "the upstream has not produced a value yet" is not a state
 * this setter can observe.
 *
 * The one sender that *can* pass `undefined` is a parameter reset:
 * `NodeModel.setParameter(name, undefined)` deletes the parameter and
 * `_onNodeModelParameterUpdated` queues the port's default, which for `Array Id` is `undefined`
 * (`node.ts:871-882`). In other words `undefined` here means exactly one thing — **an author
 * cleared the Array Id field** — and honouring that as "no opinion" would leave the node acting
 * on an array the author has just removed from it. Unbinding is what the author asked for, and
 * the next `Do` then says so out loud instead of writing to a stale target.
 *
 * `null` is an explicit clear and unbinds for the ordinary contract reason; unlike `undefined`
 * it *can* arrive on a wire.
 */
export function setCollectionIdInput(
  this: FailableCollectionInstance,
  value: string | CollectionLike | null | undefined
) {
  if (value === undefined || value === null) {
    this.setCollection(undefined);
    return;
  }
  if (value instanceof Collection) value = (value as CollectionLike).getId();
  this.setCollection(resolveCollectionId(value as string));
}

export function addCollectionFailure(def: FailableCollectionDef, codePrefix: string) {
  Object.assign(def, { outputs: def.outputs || {} });

  /**
   * The two method bags are **not** additive, and picking the wrong one deletes the node's own
   * methods rather than adding to them: `nodedefinition.ts:266` reads
   * `opts.methods || opts.prototypeExtensions`, so a node that declares `prototypeExtensions`
   * and is then handed a `methods` loses every method it declared. Two of the three consumers
   * here use the old name. Merge into whichever bag the node already has.
   */
  const methods: Record<string, unknown> =
    def.methods || def.prototypeExtensions || (def.methods = {});

  /**
   * ⚠️ **`failure` is no longer declared here.** ERG-001 §1: the three outcome signals and
   * `Completed` come from one place, `outcomeOutputs()`, so a node cannot end up with a
   * `Failure` port whose name or description disagrees with the helper that fires it. This
   * mixin keeps the `Error` *string* — the readable half of the Failure Contract's pair — and
   * the three `_fail…` methods, which now report through the contract rather than pulsing the
   * port themselves.
   */
  Object.assign(def.outputs, {
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last attempt changed nothing, in one sentence; empty until something fails',
      group: 'Error',
      getter: function (this: FailableCollectionInstance) {
        return this._internal.error;
      }
    }
  });

  /**
   * The `Error` string is written and flagged *before* the outcome is reported, because
   * `reportOutcome` sends the pulse — a graph wiring `Failure -> show` must already be able to
   * read the reason when it lands. The raise on the runtime channel moved inside
   * `reportOutcome` so that every failure in the library carries its code the same way.
   */
  function raise(this: FailableCollectionInstance, token: OutcomeToken, code: string, message: string) {
    this._internal.error = message;
    this.flagOutputDirty('error');
    this.reportOutcome(token, 'failure', { code: codePrefix + '/' + code, message });
  }

  Object.assign(methods, {
    _failNoCollection: function (this: FailableCollectionInstance, token: OutcomeToken, action: string) {
      raise.call(
        this,
        token,
        'no-array',
        'Nothing to ' +
          action +
          ' — no array is bound. Set the Array Id input, or connect one, before triggering this node.'
      );
    },

    _failNoObjectId: function (this: FailableCollectionInstance, token: OutcomeToken, action: string) {
      raise.call(
        this,
        token,
        'no-object-id',
        'Nothing to ' + action + ' — no Object Id was supplied. Connect one before triggering this node.'
      );
    },

    /**
     * NDA-012 (Data) — the Object Id names a record this runtime has never loaded.
     *
     * `Model.get(id)` **mints a record on read** (`model.ts:232`), so handing an unknown id to
     * `collection.remove` builds a brand-new object and asks the array to remove *that*. By
     * identity it is not in the array, `Array.prototype.remove` finds `indexOf === -1` and
     * returns silently — and the node then sent `Done`.
     *
     * Measured: an array of size 1, removing an id that was never loaded, stays size 1 while the
     * node reports success. Identity is *not* the problem — `Model.get(id) === ` the record
     * already in the array when that record has been loaded, and `contains` is true — so the
     * mechanism works exactly when the record exists and can never work when it does not.
     *
     * That is the case this file's own header calls "the one thing the Failure Contract says must
     * never happen": a completion signal for work that went nowhere. The header guarded it for an
     * unresolved *array* and not for an unresolvable *object*.
     *
     * `Model.exists` covers both registry tiers — named and weakly-held anonymous
     * (`model.ts:249-253`) — so a record that exists only because something still holds it is not
     * mistaken for an absent one.
     */
    _failUnknownObjectId: function (this: FailableCollectionInstance, token: OutcomeToken, action: string, id: string) {
      raise.call(
        this,
        token,
        'unknown-object-id',
        `Nothing to ${action} — no record with the Id "${id}" has been loaded, so this would have ` +
          'done nothing. Connect the Id from a query, a Repeater item or an Object node rather than ' +
          'from a raw string.'
      );
    },

    /**
     * A successful `Do` sheds the previous failure.
     *
     * The editor's key is the raised **`code`** — `createEditorWarningSubscriber` files the
     * warning under `event.code`, not under a key the call site picks — so the clear has to
     * name the same strings the raises above do or the node accumulates a warning it can never
     * shed. That is FINDINGS B-iv's trap, and it is why raise and clear live in one file.
     *
     * The legacy `'insert-warning'` key goes too, for an editor session that was already open
     * when this landed and is still holding one.
     */
    _clearCollectionFailure: function (this: FailableCollectionInstance) {
      const editorConnection = this.context.editorConnection;
      if (!editorConnection) return;

      const componentName = this.nodeScope.componentOwner.name;
      editorConnection.clearWarning(componentName, this.id, codePrefix + '/no-array');
      editorConnection.clearWarning(componentName, this.id, codePrefix + '/no-object-id');
      // Added with `_failUnknownObjectId`, and it has to be added *here* or the node keeps a
      // warning it can never shed — the trap this file exists to make unrepeatable.
      editorConnection.clearWarning(componentName, this.id, codePrefix + '/unknown-object-id');
      editorConnection.clearWarning(componentName, this.id, 'insert-warning');
    }
  });
}
