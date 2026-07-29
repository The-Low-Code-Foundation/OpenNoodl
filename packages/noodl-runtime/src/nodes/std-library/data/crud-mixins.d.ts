/**
 * What the two CRUD mixin libraries add to a node.
 *
 * `modelcrudbase.ts` (local Objects) and `dbmodelcrudbase.ts` (backend Records) are not
 * node definitions. Each exports a set of functions that take a half-built {@link NodeModule}
 * and *mutate it in place*, folding in ports, methods and — in some cases — a `setup` that
 * wraps whatever `setup` the caller already had. Seven node files are assembled this way.
 *
 * The consequence is that the members a Record node's `methods` may call are contributed by
 * a different file, and until now were written down nowhere: each consumer's `this` was
 * whatever `NodeInstance` said, and every mixin-added method resolved through the index
 * signature as `unknown` and was therefore uncallable. These interfaces name that contract
 * once, per mixin, so a consumer declares `this` as the intersection of the mixins it
 * actually applies — which also means applying `addAccessControl` and calling `_getACL`
 * without it is now a compile error rather than a runtime one.
 *
 * There is no runtime counterpart to this file: it is types only, and the mixins install
 * these members dynamically via `Object.assign`.
 */

import type {
  GraphModelLike,
  GraphNodeModel,
  ModelLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

/**
 * A node module part-way through mixin assembly.
 *
 * `category` and `color` are set by `addBaseInfo`, not by the file that declares the node,
 * so the object literal a consumer writes is *not* a complete `NodeDefinitionOptions` at
 * the point it is written — it becomes one only after the mixin calls at the bottom of the
 * file have run. Annotating those literals as `NodeModule` therefore fails on a missing
 * `category` that is about to be supplied.
 *
 * `Partial` keeps the check where the value is: every property the literal *does* declare
 * is still checked against `NodeDefinitionOptions`, which is the whole point of annotating.
 * Only `name` stays required, because the mixins index on it.
 */
export interface MixinNodeModule {
  node: Partial<NodeDefinitionOptions> & Pick<NodeDefinitionOptions, 'name'>;
  setup?: NodeModule['setup'];
}

/** One `accessControl` proplist row, as the editor stores it. */
export interface AccessControlRuleRow {
  id: string;
  label: string;
}

/** The per-rule values assembled from the `acl-<id>-<field>` dynamic inputs. */
export interface AccessControlRuleValues {
  target?: 'user' | 'everyone' | 'role';
  userid?: string;
  role?: string;
  read?: boolean;
  write?: boolean;
}

/** A Parse-style ACL: `'*'`, a user id or `'role:<name>'` → read/write flags. */
export type AccessControlList = Record<string, { read: boolean; write: boolean }>;

/**
 * A module built by the Record mixins.
 *
 * `_additionalDynamicPorts` is the family's own extension point, and the only one:
 * `addBaseInfo`'s port builder calls it last, and `addAccessControl` *chains* onto whatever
 * is already there rather than replacing it, so several mixins can each contribute ports to
 * one node.
 */
export interface DbCrudNodeModule extends MixinNodeModule {
  _additionalDynamicPorts?(node: GraphNodeModel, ports: RuntimeDiscoveredPort[], graphModel: GraphModelLike): void;
}

/** Contributed by `dbmodelcrudbase.addBaseInfo` — the `failure`/`error` pair and warnings. */
export interface DbCrudBaseInstance extends NodeInstance {
  _internal: {
    error?: string;
    collectionId?: string;
    /** `scheduleOnce` writes `hasScheduled<Type>` flags here, one per operation kind. */
    [extra: string]: unknown;
  };
  /** Coalesces repeated triggers of one operation kind into a single deferred run. */
  scheduleOnce(type: string, cb: () => void): void;
  /** `false` — and an error already reported — when the node has no class name yet. */
  checkWarningsBeforeCloudOp(): boolean;
  /** Sets the `error` output, signals `failure`, and raises an editor warning. */
  setError(err: string): void;
  clearWarnings(): void;
}

/** Contributed by either library's `addModelId` — the record this node points at. */
export interface ModelIdInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    /** Latest `idSource`, so the explicit-target input knows whether it is the live mode. */
    idSource?: unknown;
    /** The `Repeater Component` input: an item component named explicitly (BINDING-CONTRACT §a). */
    repeaterComponent?: string;
    [extra: string]: unknown;
  };
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
  /** Resolves "the current Repeater item" through `foreachitem.ts` and binds to it. */
  bindToRepeaterItem(): void;
}

/** Additionally contributed by `dbmodelcrudbase.addModelId`. */
export interface DbModelIdInstance extends ModelIdInstance {
  setCollectionID(id: string): void;
}

/** Contributed by `dbmodelcrudbase.addInputProperties` — the `prop-*` dynamic inputs. */
export interface DbInputPropertiesInstance extends NodeInstance {
  _internal: {
    inputValues?: Record<string, unknown>;
    [extra: string]: unknown;
  };
  _setInputValue(name: string, value: unknown): void;
}

/** Contributed by `dbmodelcrudbase.addRelationProperty` — used by the two relation nodes. */
export interface RelationPropertyInstance extends NodeInstance {
  _internal: {
    targetModelId?: string;
    relationProperty?: string;
    [extra: string]: unknown;
  };
  setRelationProperty(value: string): void;
}

/** Contributed by `dbmodelcrudbase.addAccessControl` — the `acl-*` dynamic inputs. */
export interface AccessControlInstance extends NodeInstance {
  _internal: {
    accessControl?: Record<string, AccessControlRuleValues>;
    accessControlRules?: AccessControlRuleRow[];
    [extra: string]: unknown;
  };
  /** The assembled ACL, or `undefined` when no rule produced an entry. */
  _getACL(): AccessControlList | undefined;
  setAccessControl(name: string, value: unknown): void;
}
