/**
 * App-wide state discovery (EXP-002 step 5). Variables (Variable2 / Set Variable) and event
 * channels (Event Sender / Event Receiver) are app-global constructs: their identity is a
 * literal name parameter, not a wire — the interpreter holds every Variable as one property of
 * the shared `--ndl--global-variables` record, and events travel a channel-name-keyed global
 * bus. This pass walks the whole IR once and produces the registry the per-component planner
 * and the stores/events emitters share.
 *
 * Typing is inference over statically-known writes (EXP-002-STEP5-TARGET-OUTPUT.md §1): a text
 * input writes `string`; a payload key's type follows its senders' wires; a Variable read
 * follows that variable's own writers. A writer whose source cannot be typed makes the whole
 * variable `unknown` — and an `unknown` variable bound into rendered content defers rather than
 * emitting TypeScript that does not compile. Nodes with non-literal names defer entirely: a
 * computed variable or channel name is genuinely dynamic (EXP-003's territory).
 */

import { ComponentIR, ExportIR, NodeIR } from '../ir/types';
import { camelCase, lowerFirst, pascalCase } from '../emit/naming';
import { censusOf, LOGIC_BUILDER, workspaceOf } from './logicbuilder';

export interface VariableWriter {
  componentPath: string;
  nodeId: string;
  nodeType: string;
  label?: string;
  /**
   * EXP-011 §67. Set when the writer is a `Variable` node carrying an authored `Value`: the
   * runtime's `value` input setter runs at node creation with that parameter and schedules a
   * store (variablenode2.ts), so the node writes the variable on every mount of its component.
   */
  seed?: string | number | boolean;
}

export interface VariablePlan {
  /** The authored variable name — the shared-record key. */
  name: string;
  /** The identifier `src/stores/variables.ts` exports. */
  exportName: string;
  /** 'string' when every statically-known write is string-typed; 'unknown' otherwise. */
  tsType: 'string' | 'unknown';
  /** The writing constructs the graph names, for the module's doc comment. */
  writers: VariableWriter[];
}

export interface ChannelSender {
  componentPath: string;
  nodeId: string;
  label?: string;
}

/** A JSON-literal type, as far as a store key's TypeScript type can be read off one. */
export type StoreKeyTsType = 'string' | 'number' | 'boolean' | 'unknown';

export interface StoreKeyPlan {
  key: string;
  /** From the initial-state literal when present; else inferred over the key's Set writers. */
  tsType: StoreKeyTsType;
  /** Present (and `required`) when a declarer's initialState carries this key. */
  initial?: unknown;
  required: boolean;
}

export interface StorePlan {
  /** The authored store name — 'app' when every naming node used the default. */
  name: string;
  /** The identifier `src/stores/<exportName>.ts` exports. */
  exportName: string;
  /** `MoodState`. */
  interfaceName: string;
  /** Initial-state keys first (transcription order), then writer-discovered keys. */
  keys: StoreKeyPlan[];
  /** `net.noodl.GlobalStore` nodes naming this store. */
  declarers: VariableWriter[];
  /** `net.noodl.GlobalStore.Set` nodes writing this store. */
  writers: VariableWriter[];
  /** Set: the whole store defers (authored persist, unparseable initial state on every declarer). */
  deferred?: string;
  /** Merged initial states, ignored storageKeys — surfaced through the component notes. */
  notes: string[];
  /**
   * EXP-011 §47. Present when the store is a named **Object** — an `Object` node in "Specify
   * explicitly" mode with a literal Id, and the `Set Object Properties` nodes naming the same
   * Id — rather than a Global Store. The two are one construct in the exported app (`store()`
   * in `@nodegx/core` says so in its own doc comment) and two records in the runtime, where a
   * Global Store is the Model keyed `--ndl--global-store--<name>` and an Object is the Model
   * keyed by its Id; `objectCollisions` is where that difference is kept honest.
   */
  origin?: 'object';
}

export const GLOBAL_STORE = 'net.noodl.GlobalStore';
export const GLOBAL_STORE_SET = 'net.noodl.GlobalStore.Set';
export const GLOBAL_STORE_SUBSCRIBE = 'net.noodl.GlobalStore.Subscribe';

export function isGlobalStoreFamily(type: string): boolean {
  return type === GLOBAL_STORE || type === GLOBAL_STORE_SET || type === GLOBAL_STORE_SUBSCRIBE;
}

/** `Object` — displayed "Object", stored as `Model2` (modelnode2.ts). */
export const OBJECT_TYPE = 'Model2';
/** `Set Object Properties` (setmodelpropertiesnode.ts, over modelcrudbase.ts). */
export const SET_OBJECT_PROPERTIES_TYPE = 'SetModelProperties';

/**
 * EXP-011 §47. The Id an `Object` or `Set Object Properties` names **statically**, or undefined.
 *
 * Three facts of the runtime decide the shape: `idSource` defaults to `explicit` (an unset one
 * is explicit — `modelcrudbase.ts` declares the default, and the §5.1 gate has read it so since
 * Tier 1.1); in that mode the record is `Model.get(modelId)`, create-on-read, keyed by the Id
 * verbatim; and a wired Id is a runtime value (a Model, a plain object, or a string from
 * anywhere), which is exactly what no module can name. So: explicit or unset, an unwired
 * `modelId`, a non-empty literal string — else undefined, and the caller says which.
 */
export function objectIdOf(node: NodeIR, wiredPorts: Set<string>): string | undefined {
  const idSource = node.parameters.find((p) => p.name === 'idSource')?.value;
  if (idSource !== undefined && !(idSource.kind === 'literal' && idSource.value === 'explicit')) return undefined;
  if (wiredPorts.has(`${node.id}:modelId`)) return undefined;
  return literalString(node, 'modelId');
}

/**
 * A `Set Object Properties`' authored property list, split as the runtime splits it. The list
 * is load-bearing on the write side: `_pushInputValues` filters the keys it writes by this list
 * (`validProperties`), so a wired `prop-<x>` whose `x` is not listed is silently not written.
 */
export function setPropertiesOf(node: NodeIR): string[] {
  const raw = node.parameters.find((p) => p.name === 'properties')?.value;
  if (raw?.kind !== 'literal' || typeof raw.value !== 'string') return [];
  return raw.value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

/** One translated `NewModel → CollectionInsert` chain — the write side of a named array. */
export interface CollectionInserterRef {
  componentPath: string;
  newModelId: string;
  insertId: string;
  /** The NewModel's authored label. */
  label?: string;
}

export interface CollectionKeyPlan {
  key: string;
  /** Union over the key's statically-known insert sources; conflicting sources ⇒ 'unknown'. */
  tsType: StoreKeyTsType;
}

export interface CollectionPlan {
  /** The authored `collectionId` — the shared-array-table key. */
  name: string;
  /** The identifier `src/collections/<exportName>.ts` exports. */
  exportName: string;
  /** `NotesItem`. */
  interfaceName: string;
  /** Union of statically-known inserted property sets, first-seen order, all optional. */
  keys: CollectionKeyPlan[];
  /** `Collection2` nodes naming this array. */
  readers: VariableWriter[];
  /** Translated insert chains writing this array. */
  inserters: CollectionInserterRef[];
  /**
   * Array mutators naming this array — EXP-011 Tier 1.1's `Clear Array`.
   *
   * Registered here rather than folded into {@link readers} because the doc comment on the
   * emitted module is the only place an author can see who touches the array, and "named by"
   * and "emptied by" are different facts. ⚠️ Registration is what makes the module exist: an
   * array a `Clear Array` names and nothing else reads still needs a `src/collections/<x>.ts`
   * for the emitted `.clear()` to have a subject.
   */
  mutators: VariableWriter[];
  notes: string[];
}

/**
 * The array a Collection2/CollectionInsert names: the literal `collectionId`, undefined when
 * absent, empty, wired or non-literal. Unlike `storeName` there is no default — an unnamed
 * array is anonymous (per-node in the runtime), which nothing static can share.
 */
export function collectionNameOf(node: NodeIR, wiredPorts: Set<string>): string | undefined {
  if (wiredPorts.has(`${node.id}:collectionId`)) return undefined;
  return literalString(node, 'collectionId');
}

/** EXP-011 §55. `Create New Array` — the node whose `id` output is the only wire an Array Id port takes. */
export const COLLECTION_NEW_TYPE = 'CollectionNew';
/**
 * EXP-011 §55. Where a node's Array Id points: a literal name (a module, the named-array model) or a
 * `Create New Array`'s `id` **by wire** (a handle in the minting component's state — the id is never a
 * string in the emitted app; the wire is the name). One answer for every consumer of an Array Id —
 * `Array`, the three mutators, the repeater feed — so the two models cannot disagree about a wire.
 */
export type ArrayTarget =
  | { kind: 'named'; collectionName: string }
  | { kind: 'minted'; nodeId: string; wireKey: string };

export function arrayTargetOf(node: NodeIR, component: ComponentIR): ArrayTarget | { defer: string } {
  const wires = component.connections.filter((c) => c.toId === node.id && c.toProperty === 'collectionId');
  if (wires.length > 1) return { defer: 'two wires feed its Array Id — last-writer-wins is not statically ordered' };
  if (wires.length === 1) {
    const wire = wires[0];
    const from = component.nodes.find((n) => n.id === wire.fromId);
    if (from?.type === COLLECTION_NEW_TYPE && wire.fromProperty === 'id') return { kind: 'minted', nodeId: from.id, wireKey: wire.key };
    return {
      defer: `its Array Id is wired from ${from?.type ?? 'a missing node'}'s ${wire.fromProperty} — only a Create New Array's Id binds by wire; any other source is a runtime string this slice cannot resolve to an array`
    };
  }
  const collectionName = literalString(node, 'collectionId');
  if (collectionName === undefined) {
    return { defer: 'its Array Id is not a literal name — a runtime-addressed array has no emitted module' };
  }
  return { kind: 'named', collectionName };
}

/** One property of a translated insert chain: an authored literal, a wire, or (absent both) omitted. */
export interface InsertChainProperty {
  key: string;
  wire?: { connectionKey: string; fromId: string; fromProperty: string };
  literal?: string | number | boolean;
}

export interface InsertChain {
  /** The named array, or `''` when {@link minted} is set. */
  collectionName: string;
  /** EXP-011 §55. The `Create New Array` whose handle the insert writes — the chain is component-local then. */
  minted?: string;
  insertId: string;
  newModelId: string;
  /** The NewModel's `properties` list in authored order, omitted keys filtered out. */
  properties: InsertChainProperty[];
  /** Connection keys the chain consumes: id→modifyId, done→add, and every property wire. */
  consumes: string[];
}

/**
 * The `NewModel → CollectionInsert` chain analysis (COLLECTIONS-TARGET §2): one `.add({...})`
 * when (a) the properties are statically sourced, (b) the array id is literal, and (c) the
 * created object's outputs feed exactly this insert. Shared by the registry (key discovery and
 * typing) and the per-component planner (handler compilation) so the two cannot disagree.
 */
export function insertChainOf(
  component: ComponentIR,
  insertNode: NodeIR,
  nodeById: Map<string, NodeIR>,
  wiredPorts: Set<string>
): { chain: InsertChain } | { defer: string } {
  const target = arrayTargetOf(insertNode, component);
  // EXP-011 §55. An unwired, unnamed id keeps its sentence; a wire that is not a mint's `id` names its source.
  if ('defer' in target) return { defer: wiredPorts.has(`${insertNode.id}:collectionId`) ? target.defer : 'array id is not a literal' };
  const collectionName = target.kind === 'named' ? target.collectionName : '';

  const intoAdd = component.connections.filter((c) => c.toId === insertNode.id && c.toProperty === 'add');
  const intoModify = component.connections.filter((c) => c.toId === insertNode.id && c.toProperty === 'modifyId');
  if (intoAdd.length !== 1 || intoModify.length !== 1) {
    return { defer: 'the insert needs exactly one done→Do wire and one id→Object Id wire' };
  }
  const doneWire = intoAdd[0];
  const idWire = intoModify[0];
  const newModel = nodeById.get(doneWire.fromId);
  if (!newModel || newModel.type !== 'NewModel' || doneWire.fromProperty !== 'done') {
    return { defer: "Do is not driven by a Create New Object's done" };
  }
  if (idWire.fromId !== newModel.id || idWire.fromProperty !== 'id') {
    return { defer: 'Object Id is not the creating node’s id — inserting an existing object is Model2 territory' };
  }
  const extraConsumer = component.connections.some(
    (c) => c.fromId === newModel.id && c.key !== doneWire.key && c.key !== idWire.key
  );
  if (extraConsumer) {
    return { defer: "the created object's outputs are consumed beyond this insert — its identity outlives it (Model2 territory)" };
  }

  const propertiesParam = literalString(newModel, 'properties');
  const keys =
    propertiesParam === undefined
      ? []
      : propertiesParam
          .split(',')
          .map((key) => key.trim())
          .filter((key) => key.length > 0);
  const properties: InsertChainProperty[] = [];
  const consumes = [doneWire.key, idWire.key];
  for (const key of keys) {
    const typeParam = literalString(newModel, `type-${key}`);
    if (typeParam === 'array' || typeParam === 'object') {
      return { defer: `property "${key}" is ${typeParam}-typed — its coercion is not translated in this slice` };
    }
    const wire = component.connections.find((c) => c.toId === newModel.id && c.toProperty === `prop-${key}`);
    if (wire) {
      properties.push({ key, wire: { connectionKey: wire.key, fromId: wire.fromId, fromProperty: wire.fromProperty } });
      consumes.push(wire.key);
    } else {
      const literal = newModel.parameters.find((p) => p.name === `prop-${key}`)?.value;
      if (literal?.kind === 'literal') properties.push({ key, literal: literal.value });
      // Absent both: the key is omitted — the runtime's per-key abstain (undefined never writes).
    }
  }
  if (target.kind === 'minted') consumes.push(target.wireKey);
  return {
    chain: {
      collectionName,
      ...(target.kind === 'minted' ? { minted: target.nodeId } : {}),
      insertId: insertNode.id,
      newModelId: newModel.id,
      properties,
      consumes
    }
  };
}

export interface ChannelPlan {
  /** The authored channel name. */
  name: string;
  /** The identifier `src/events.ts` exports. */
  exportName: string;
  /** `CelebratePayload`, or null when no sender declares payload keys (the `T = void` channel). */
  payloadTypeName: string | null;
  /** Union of every matching sender's payload keys, first-seen order — exactly how the
   *  interpreter's receiver discovers its output ports. */
  payload: Array<{ key: string; tsType: 'string' | 'unknown' }>;
  senders: ChannelSender[];
}

export interface AppStateRegistry {
  /** Keyed by authored name, discovery order over D1-sorted components. */
  variables: Map<string, VariablePlan>;
  channels: Map<string, ChannelPlan>;
  stores: Map<string, StorePlan>;
  collections: Map<string, CollectionPlan>;
  /**
   * EXP-011 §47. Object Ids that are also Global Store names. In the runtime those are two
   * records (`--ndl--global-store--x` and `x`); in the exported app both would be `store('x')`,
   * one registry entry — so the Object side is refused by name rather than merged into the
   * Global Store's module, and the Global Store keeps translating as it did.
   */
  objectCollisions: Set<string>;
}

/** A value wire's source, kept as raw references for the type resolver. */
interface SourceRef {
  component: ComponentIR;
  fromNode: NodeIR | undefined;
  fromProperty: string;
  /** EXP-011 §67. An authored literal standing where a wire's source node would — no node, one value. */
  literal?: string | number | boolean;
}

export function collectAppState(ir: ExportIR): AppStateRegistry {
  const variables = new Map<string, VariablePlan>();
  const channels = new Map<string, ChannelPlan>();
  const variableSources = new Map<string, SourceRef[]>();
  const payloadSources = new Map<string, SourceRef[]>(); // `${channel} ${key}`

  const stores = new Map<string, StorePlan>();
  const storeKeySources = new Map<string, SourceRef[]>(); // same key shape as payloadSources

  const collections = new Map<string, CollectionPlan>();
  // Keyed by JSON.stringify([collectionName, key]) — no separator can collide with a name.
  const collectionKeySources = new Map<string, SourceRef[]>();
  const collectionKeyLiteralTypes = new Map<string, Set<StoreKeyTsType>>();
  const collectionKeyId = (name: string, key: string) => JSON.stringify([name, key]);

  // Which input ports carry a wire, per component — a wired storeName/key/initialState is
  // dynamic, and the node carrying it defers however plausible its parameter looks.
  const wiredPortsCache = new Map<ComponentIR, Set<string>>();
  const wiredPortsOf = (component: ComponentIR): Set<string> => {
    let ports = wiredPortsCache.get(component);
    if (!ports) {
      ports = new Set(component.connections.map((c) => `${c.toId}:${c.toProperty}`));
      wiredPortsCache.set(component, ports);
    }
    return ports;
  };

  const ensureVariable = (name: string): VariablePlan => {
    let plan = variables.get(name);
    if (!plan) {
      plan = { name, exportName: '', tsType: 'unknown', writers: [] };
      variables.set(name, plan);
      variableSources.set(name, []);
    }
    return plan;
  };
  const ensureChannel = (name: string): ChannelPlan => {
    let plan = channels.get(name);
    if (!plan) {
      plan = { name, exportName: '', payloadTypeName: null, payload: [], senders: [] };
      channels.set(name, plan);
    }
    return plan;
  };
  const ensureStore = (name: string): StorePlan => {
    let plan = stores.get(name);
    if (!plan) {
      plan = { name, exportName: '', interfaceName: '', keys: [], declarers: [], writers: [], notes: [] };
      stores.set(name, plan);
    }
    return plan;
  };
  // EXP-011 §47. Which names the two families claim, read over the whole project before either
  // family registers anything — so the answer does not depend on which component D1 sorts first.
  const globalStoreNames = new Set<string>();
  const objectIds = new Set<string>();
  for (const component of ir.components) {
    for (const node of component.nodes) {
      if (isGlobalStoreFamily(node.type)) {
        const name = storeNameOf(node, wiredPortsOf(component));
        if (name !== undefined) globalStoreNames.add(name);
      }
      if (node.type === OBJECT_TYPE || node.type === SET_OBJECT_PROPERTIES_TYPE) {
        const id = objectIdOf(node, wiredPortsOf(component));
        if (id !== undefined) objectIds.add(id);
      }
    }
  }
  const objectCollisions = new Set([...objectIds].filter((id) => globalStoreNames.has(id)));
  const ensureObjectStore = (id: string): StorePlan => {
    const plan = ensureStore(id);
    plan.origin = 'object';
    return plan;
  };
  const ensureStoreKey = (plan: StorePlan, key: string): StoreKeyPlan => {
    let entry = plan.keys.find((k) => k.key === key);
    if (!entry) {
      entry = { key, tsType: 'unknown', required: false };
      plan.keys.push(entry);
    }
    return entry;
  };
  const ensureCollection = (name: string): CollectionPlan => {
    let plan = collections.get(name);
    if (!plan) {
      plan = { name, exportName: '', interfaceName: '', keys: [], readers: [], inserters: [], mutators: [], notes: [] };
      collections.set(name, plan);
    }
    return plan;
  };
  const ensureCollectionKey = (plan: CollectionPlan, key: string): CollectionKeyPlan => {
    let entry = plan.keys.find((k) => k.key === key);
    if (!entry) {
      entry = { key, tsType: 'unknown' };
      plan.keys.push(entry);
    }
    return entry;
  };

  // Discovery: nodes declare the constructs; wires name the writers and payload sources.
  for (const component of ir.components) {
    const nodeById = new Map(component.nodes.map((n) => [n.id, n]));
    for (const node of component.nodes) {
      if (node.type === 'Variable2' || node.type === 'Set Variable') {
        const name = literalString(node, 'name');
        if (name === undefined) continue;
        const plan = ensureVariable(name);
        if (node.type === 'Set Variable') {
          plan.writers.push(writerRef(component, node));
          // EXP-011 §69. A value typed into the Set with nothing wired over it is what Do writes,
          // so it is a typed source of the variable exactly as §67's seed is (a number literal
          // makes the variable `unknown`). Under a wire the wire's source is registered below
          // instead and the literal is never read.
          const authored = literalPrimitive(node, 'value');
          if (authored !== undefined && !wiredPortsOf(component).has(`${node.id}:value`)) {
            variableSources.get(name)!.push({ component, fromNode: undefined, fromProperty: 'value', literal: authored });
          }
        }
        // EXP-011 §67. A Variable's authored Value is a writer — the runtime stores it at node
        // creation, per mount — and a typed source of the variable (a number literal makes the
        // variable `unknown`, as a number writer would). A wire into Value is the writer instead:
        // the wire's source is registered below, and the plan refuses the seed by name.
        const seed = node.type === 'Variable2' ? literalPrimitive(node, 'value') : undefined;
        if (seed !== undefined && !wiredPortsOf(component).has(`${node.id}:value`)) {
          plan.writers.push({ ...writerRef(component, node), seed });
          variableSources.get(name)!.push({ component, fromNode: undefined, fromProperty: 'value', literal: seed });
        }
      }
      /**
       * A Visual Function's block program can name a Variable that no `Variable` node in the
       * project declares — `tut003-log-a-thing-solution` does exactly that, minting
       * `lastEntryTitle` from the blocks alone. Without this the name would resolve to nothing
       * (`variableNameOf` answers `undefined` for an unregistered name) and the binding would
       * vanish silently.
       *
       * ⚠️ Read off the **workspace's** `noodl_get_variable`/`noodl_set_variable` fields, never
       * mined from the generated text: the workspace is the source of truth, and a mined
       * `Noodl.Variables[...]` cannot tell a literal key from an expression one.
       * LOGIC-BUILDER-TARGET §3.4.
       */
      if (node.type === LOGIC_BUILDER) {
        const census = censusOf(workspaceOf(node));
        for (const name of census.variableReads) ensureVariable(name);
        for (const name of census.variableWrites) {
          ensureVariable(name).writers.push(writerRef(component, node));
        }
      }
      if (node.type === 'Event Sender' || node.type === 'Event Receiver') {
        const name = literalString(node, 'channelName');
        if (name === undefined) continue;
        const plan = ensureChannel(name);
        if (node.type === 'Event Sender') {
          plan.senders.push({
            componentPath: component.path,
            nodeId: node.id,
            ...(node.authoredLabel !== undefined ? { label: node.authoredLabel } : {})
          });
          for (const key of payloadKeysOf(node)) {
            if (!plan.payload.some((p) => p.key === key)) plan.payload.push({ key, tsType: 'unknown' });
          }
        }
      }
      if (isGlobalStoreFamily(node.type)) {
        const storeName = storeNameOf(node, wiredPortsOf(component));
        if (storeName === undefined) continue; // dynamic name — the node defers in plan.ts
        const plan = ensureStore(storeName);
        if (node.type === GLOBAL_STORE) {
          plan.declarers.push(writerRef(component, node));
          if (literalBool(node, 'persist') === true || wiredPortsOf(component).has(`${node.id}:persist`)) {
            plan.deferred =
              plan.deferred ?? 'a declarer authors persist — browser-storage rehydration is not translatable';
          } else if (node.parameters.some((p) => p.name === 'storageKey')) {
            plan.notes.push(`declarer \`${node.id}\` sets storageKey without persist — inert, ignored`);
          }
          const initial = initialStateOf(node, wiredPortsOf(component));
          if (initial.kind === 'object') {
            for (const [key, value] of Object.entries(initial.value)) {
              const entry = ensureStoreKey(plan, key);
              if (!entry.required) {
                entry.required = true;
                entry.initial = value;
              } else if (JSON.stringify(entry.initial) !== JSON.stringify(value)) {
                plan.notes.push(
                  `two declarers give key "${key}" different initial values — first-seen wins (declarer \`${node.id}\` loses)`
                );
              }
            }
          } else if (initial.kind === 'bad') {
            plan.notes.push(`declarer \`${node.id}\` has a non-literal or non-object initialState — contributes nothing`);
          }
        }
        if (node.type === GLOBAL_STORE_SET) {
          const key = literalString(node, 'key');
          if (key !== undefined && !wiredPortsOf(component).has(`${node.id}:key`)) {
            plan.writers.push(writerRef(component, node));
            ensureStoreKey(plan, key);
          }
        }
      }
      /**
       * EXP-011 §47 — the named Object. An `Object` with a literal Id is the store's reader
       * (`declarers`, printed "Read by"); a `Set Object Properties` with the same Id is a writer.
       * Keys: every `prop-<key>` output wire off the Object (the runtime registers any `prop-*`
       * a wire asks for, `registerOutputIfNeeded`, so the `properties` stringlist does not gate a
       * read), and every wired `prop-<key>` the Set's own list admits. An Id that collides with
       * a Global Store name registers nothing here — plan.ts refuses those nodes by name.
       */
      if (node.type === OBJECT_TYPE || node.type === SET_OBJECT_PROPERTIES_TYPE) {
        const id = objectIdOf(node, wiredPortsOf(component));
        if (id !== undefined && !objectCollisions.has(id)) {
          const plan = ensureObjectStore(id);
          if (node.type === OBJECT_TYPE) {
            plan.declarers.push(writerRef(component, node));
            for (const wire of component.connections) {
              if (wire.fromId === node.id && wire.fromProperty.startsWith('prop-')) {
                ensureStoreKey(plan, wire.fromProperty.slice('prop-'.length));
              }
            }
          } else {
            plan.writers.push(writerRef(component, node));
            const listed = setPropertiesOf(node);
            const wired = wiredPortsOf(component);
            for (const wire of component.connections) {
              if (wire.toId !== node.id || !wire.toProperty.startsWith('prop-')) continue;
              const key = wire.toProperty.slice('prop-'.length);
              if (listed.includes(key)) ensureStoreKey(plan, key);
            }
            // EXP-011 §68. A listed key nothing wires but the author typed a value for is written
            // too: the runtime queues every authored parameter into the node at creation
            // (nodescope.ts `queueInput`, into `_setInputValue`), and `_pushInputValues` writes
            // every listed key whose value is not `undefined`. The literal is the key's source,
            // typed as itself — §67's rule for a Variable's Value, one construct over.
            for (const key of listed) {
              if (wired.has(`${node.id}:prop-${key}`)) continue;
              const literal = literalPrimitive(node, `prop-${key}`);
              if (literal === undefined) continue;
              ensureStoreKey(plan, key);
              const mapKey = `${id}\u0000${key}`;
              storeKeySources.set(mapKey, [...(storeKeySources.get(mapKey) ?? []), { component, fromNode: undefined, fromProperty: `prop-${key}`, literal }]);
            }
          }
        }
      }
      if (node.type === 'Collection2') {
        const name = collectionNameOf(node, wiredPortsOf(component));
        if (name !== undefined) ensureCollection(name).readers.push(writerRef(component, node));
      }
      /**
       * EXP-011 Tier 1.1. Discovery only — whether the node's `Do` reaches a translatable
       * trigger is `compileSink`'s question, and a mutator that defers there still belongs in
       * this list: the array it names is real either way, and an emitted module that exists
       * for a deferred node costs one file, while a missing one is a `!` assertion at emit.
       */
      if (node.type === 'CollectionClear') {
        const name = collectionNameOf(node, wiredPortsOf(component));
        if (name !== undefined) ensureCollection(name).mutators.push(writerRef(component, node));
      }
      if (node.type === 'CollectionInsert') {
        const name = collectionNameOf(node, wiredPortsOf(component));
        if (name !== undefined) ensureCollection(name); // the module exists; keys only from chains
        const result = insertChainOf(component, node, nodeById, wiredPortsOf(component));
        // EXP-011 §55. A chain into a minted array has no module — its keys live nowhere static.
        if ('chain' in result && result.chain.minted === undefined) {
          const chain = result.chain;
          const plan = ensureCollection(chain.collectionName);
          const newModel = nodeById.get(chain.newModelId)!;
          plan.inserters.push({
            componentPath: component.path,
            newModelId: chain.newModelId,
            insertId: chain.insertId,
            ...(newModel.authoredLabel !== undefined ? { label: newModel.authoredLabel } : {})
          });
          for (const property of chain.properties) {
            ensureCollectionKey(plan, property.key);
            const mapKey = collectionKeyId(chain.collectionName, property.key);
            if (property.wire) {
              const ref: SourceRef = {
                component,
                fromNode: nodeById.get(property.wire.fromId),
                fromProperty: property.wire.fromProperty
              };
              collectionKeySources.set(mapKey, [...(collectionKeySources.get(mapKey) ?? []), ref]);
            } else if (property.literal !== undefined) {
              const types = collectionKeyLiteralTypes.get(mapKey) ?? new Set<StoreKeyTsType>();
              types.add(jsonTsType(property.literal));
              collectionKeyLiteralTypes.set(mapKey, types);
            }
          }
        }
      }
    }

    for (const connection of component.connections) {
      const toNode = nodeById.get(connection.toId);
      if (!toNode) continue;
      const fromRef: SourceRef = {
        component,
        fromNode: nodeById.get(connection.fromId),
        fromProperty: connection.fromProperty
      };
      if (toNode.type === 'Variable2' && connection.toProperty === 'value') {
        const name = literalString(toNode, 'name');
        if (name === undefined) continue;
        ensureVariable(name);
        variableSources.get(name)!.push(fromRef);
        if (fromRef.fromNode) {
          ensureVariable(name).writers.push(writerRef(component, fromRef.fromNode));
        }
      }
      if (toNode.type === 'Set Variable' && connection.toProperty === 'value') {
        const name = literalString(toNode, 'name');
        if (name === undefined) continue;
        ensureVariable(name);
        variableSources.get(name)!.push(fromRef);
      }
      if (toNode.type === GLOBAL_STORE_SET && connection.toProperty === 'value') {
        const storeName = storeNameOf(toNode, wiredPortsOf(component));
        const key = literalString(toNode, 'key');
        if (storeName !== undefined && key !== undefined && !wiredPortsOf(component).has(`${toNode.id}:key`)) {
          ensureStoreKey(ensureStore(storeName), key);
          const mapKey = `${storeName}\u0000${key}`;
          storeKeySources.set(mapKey, [...(storeKeySources.get(mapKey) ?? []), fromRef]);
        }
      }
      // EXP-011 §47. A Set Object Properties' wired property is a writer of that key — typed
      // over its sources exactly as a Global Store key is, and only for a key the node's own
      // list admits (the runtime writes no other).
      if (toNode.type === SET_OBJECT_PROPERTIES_TYPE && connection.toProperty.startsWith('prop-')) {
        const id = objectIdOf(toNode, wiredPortsOf(component));
        const key = connection.toProperty.slice('prop-'.length);
        if (id !== undefined && !objectCollisions.has(id) && setPropertiesOf(toNode).includes(key)) {
          ensureStoreKey(ensureObjectStore(id), key);
          const mapKey = `${id}\u0000${key}`;
          storeKeySources.set(mapKey, [...(storeKeySources.get(mapKey) ?? []), fromRef]);
        }
      }
      if (toNode.type === 'Event Sender') {
        const channelName = literalString(toNode, 'channelName');
        if (channelName === undefined || !payloadKeysOf(toNode).includes(connection.toProperty)) continue;
        const key = `${channelName} ${connection.toProperty}`;
        payloadSources.set(key, [...(payloadSources.get(key) ?? []), fromRef]);
      }
    }
  }

  // Type inference, with a cycle guard: a self-fed variable resolves to 'unknown', never loops.
  const variableTypes = new Map<string, 'string' | 'unknown'>();
  const typeOfVariable = (name: string, visiting: Set<string>): 'string' | 'unknown' => {
    const memo = variableTypes.get(name);
    if (memo !== undefined) return memo;
    const guard = `v:${name}`;
    if (visiting.has(guard)) return 'unknown';
    visiting.add(guard);
    const sources = variableSources.get(name) ?? [];
    const resolved = sources.every((ref) => typeOfSource(ref, visiting) === 'string') ? 'string' : 'unknown';
    visiting.delete(guard);
    variableTypes.set(name, resolved);
    return resolved;
  };
  const typeOfPayloadKey = (channelName: string, key: string, visiting: Set<string>): 'string' | 'unknown' => {
    const guard = `c:${channelName} ${key}`;
    if (visiting.has(guard)) return 'unknown';
    visiting.add(guard);
    const sources = payloadSources.get(`${channelName} ${key}`) ?? [];
    const resolved = sources.every((ref) => typeOfSource(ref, visiting) === 'string') ? 'string' : 'unknown';
    visiting.delete(guard);
    return resolved;
  };
  // A store key's type: the initial-state literal decides when it exists; otherwise inference
  // over the key's statically-known Set writers, exactly as variables — with the same guard.
  const storeKeyTypes = new Map<string, StoreKeyTsType>();
  const typeOfStoreKey = (storeName: string, key: string, visiting: Set<string>): StoreKeyTsType => {
    const mapKey = `${storeName}\u0000${key}`;
    const memo = storeKeyTypes.get(mapKey);
    if (memo !== undefined) return memo;
    const entry = stores.get(storeName)?.keys.find((k) => k.key === key);
    if (entry?.required) {
      const resolved = jsonTsType(entry.initial);
      storeKeyTypes.set(mapKey, resolved);
      return resolved;
    }
    const guard = `s:${mapKey}`;
    if (visiting.has(guard)) return 'unknown';
    visiting.add(guard);
    const sources = storeKeySources.get(mapKey) ?? [];
    // EXP-011 §47. An Object key exists because a wire *reads* it, so it can have no writer at
    // all — and `[].every(…)` is true, which would type "nothing wrote this" as `string`. A key
    // with zero statically-known writers is `unknown`: the honest type, and the one whose read
    // is coerced at the sink rather than printed as a string the graph never promised.
    // EXP-011 §48. The same for a Global Store key: it exists because a Set names it, and a Set
    // whose `value` is unwired (the Set defers, the key stays) is exactly the zero-writer case
    // §47 fixed one origin over and registered for this one.
    const resolved =
      sources.length > 0 && sources.every((ref) => typeOfSource(ref, visiting) === 'string') ? 'string' : 'unknown';
    visiting.delete(guard);
    storeKeyTypes.set(mapKey, resolved);
    return resolved;
  };
  const typeOfSource = (ref: SourceRef, visiting: Set<string>): 'string' | 'unknown' => {
    // EXP-011 §67. An authored literal types as itself.
    if (ref.literal !== undefined) return typeof ref.literal === 'string' ? 'string' : 'unknown';
    const node = ref.fromNode;
    if (!node) return 'unknown';
    if (isTextInputType(node.type) && ref.fromProperty === 'onTextChanged') return 'string';
    if (node.type === 'Variable2' && ref.fromProperty === 'value') {
      const name = literalString(node, 'name');
      return name !== undefined ? typeOfVariable(name, visiting) : 'unknown';
    }
    if (node.type === GLOBAL_STORE_SUBSCRIBE && ref.fromProperty === 'value') {
      const storeName = storeNameOf(node, wiredPortsOf(ref.component));
      const keys = subscribeKeysOf(node);
      if (storeName === undefined || keys.length !== 1) return 'unknown';
      return typeOfStoreKey(storeName, keys[0], visiting) === 'string' ? 'string' : 'unknown';
    }
    // EXP-011 §47. An Object's `prop-<key>` read carries the key's writer-inferred type — the
    // Subscribe rule one construct over, so an Object read into a Set Variable types the variable.
    if (node.type === OBJECT_TYPE && ref.fromProperty.startsWith('prop-')) {
      const id = objectIdOf(node, wiredPortsOf(ref.component));
      if (id === undefined || objectCollisions.has(id)) return 'unknown';
      return typeOfStoreKey(id, ref.fromProperty.slice('prop-'.length), visiting) === 'string' ? 'string' : 'unknown';
    }
    if (node.type === 'Event Receiver' && ref.fromProperty !== 'eventReceived') {
      const channelName = literalString(node, 'channelName');
      const known = channelName !== undefined && channels.get(channelName)?.payload.some((p) => p.key === ref.fromProperty);
      return known ? typeOfPayloadKey(channelName!, ref.fromProperty, visiting) : 'unknown';
    }
    if (node.type === 'Component Inputs') {
      const port = node.declaredPorts.find((p) => p.name === ref.fromProperty && p.plug === 'output');
      if (port && port.kind === 'value' && (port.type === undefined || port.type === 'string')) return 'string';
      return 'unknown';
    }
    /**
     * A `String` value Variable's `savedValue` (EXP-011 Tier 1.4).
     *
     * 🔴 **A gap that slice left, found by building against it.** Tier 1.4 taught `resolveExpr`
     * to read the four value Variables, but not this function — so a Variable written by a
     * `String` node had no statically-typed writer, typed `unknown`, and *every read of it
     * dropped*. The graph is as ordinary as they come (a String constant into a Set Variable,
     * the variable rendered in a Text) and it exported a blank element with a note.
     *
     * Only `String`. Its three siblings are `Number`, `Boolean` and `Color`, and this function's
     * whole vocabulary is string-or-unknown — claiming `string` for a `Number` would be the
     * emitter asserting a cast the runtime does not perform.
     */
    if (node.type === 'String' && ref.fromProperty === 'savedValue') return 'string';
    /**
     * An `HTTP Request`'s `Error` output (EXP-011 Tier 1.2).
     *
     * 🔴 **The second consumer, written because Tier 1.4 left exactly this gap and only building
     * an app found it (EXP-011 §7.5).** A Variable written from a node's output types as
     * `unknown` unless this function knows the node, and a Variable typed `unknown` drops every
     * read of it — so "show the error message in a Text" would have exported a blank element
     * with a note, on a graph as ordinary as they come.
     *
     * Only `error`. `response` is whatever the server sent and `statusCode` is a number, and
     * this function's whole vocabulary is string-or-unknown — claiming `string` for either would
     * be the exporter asserting a cast the runtime does not perform.
     */
    if (node.type === 'net.noodl.HTTP' && ref.fromProperty === 'error') return 'string';
    /**
     * `Now`'s `ISO String` and `Date To String`'s `Date String` (EXP-011 Tier 1.3).
     *
     * 🔴 **The same gap, a third and fourth time, and found the same way — by building the app.**
     * §7.5 wrote the rule after Tier 1.4 missed it, §8.7 named it again after Tier 1.2 missed it,
     * and this slice missed it too: *"save the moment I pressed the button"* — a `Now` into a Set
     * Variable, the variable in a Text — exported a Text still showing its authored placeholder,
     * because the variable had no `string`-typed writer and Pass 4 drops every read of an
     * `unknown` one. The graph could not be more ordinary.
     *
     * The rule this keeps failing against is worth stating plainly: **a new readable node has at
     * least two consumers in this package, and `resolveExpr` is only the first.** The others are
     * this function, Pass 4f's predicate and Pass 4c's whitelist, and none of them errors when
     * missed — each just quietly renders nothing.
     *
     * Only the two string-typed outputs. `Now`'s `Date` is a `Date` and its `Timestamp` a number;
     * this function's whole vocabulary is string-or-unknown, and claiming `string` for either
     * would be the exporter asserting a cast the runtime does not perform.
     */
    if (node.type === 'net.noodl.Now' && ref.fromProperty === 'iso') return 'string';
    if (node.type === 'Date To String' && ref.fromProperty === 'currentValue') return 'string';
    return 'unknown';
  };

  for (const plan of variables.values()) {
    plan.tsType = typeOfVariable(plan.name, new Set());
  }
  for (const plan of channels.values()) {
    for (const entry of plan.payload) {
      entry.tsType = typeOfPayloadKey(plan.name, entry.key, new Set());
    }
    if (plan.payload.length > 0) plan.payloadTypeName = `${pascalCase(plan.name)}Payload`;
  }
  for (const plan of stores.values()) {
    for (const entry of plan.keys) {
      entry.tsType = typeOfStoreKey(plan.name, entry.key, new Set());
    }
    // Interface order: initial-state keys first (transcription order), then writer-discovered.
    plan.keys = [...plan.keys.filter((k) => k.required), ...plan.keys.filter((k) => !k.required)];
  }
  // A collection key's type: the union of its literal sources and wire sources — one agreed
  // type when every source says the same thing, 'unknown' on any conflict or untyped source.
  for (const plan of collections.values()) {
    for (const entry of plan.keys) {
      const mapKey = collectionKeyId(plan.name, entry.key);
      const candidates = new Set<StoreKeyTsType>(collectionKeyLiteralTypes.get(mapKey) ?? []);
      for (const ref of collectionKeySources.get(mapKey) ?? []) {
        candidates.add(typeOfSource(ref, new Set()));
      }
      entry.tsType = candidates.size === 1 ? [...candidates][0] : 'unknown';
    }
  }

  // Export names: variables first, then channels, then stores, all in one identifier space so a
  // component importing from several modules never collides (D5's first-wins numeric dedup).
  // `variables` is reserved before stores are named: a store named "variables" must not claim
  // the module `src/stores/variables.ts` already means.
  const used = new Set<string>();
  for (const plan of variables.values()) plan.exportName = dedupe(lowerFirst(camelCase(plan.name)), used);
  for (const plan of channels.values()) plan.exportName = dedupe(lowerFirst(camelCase(plan.name)), used);
  used.add('variables');
  const usedInterfaces = new Set<string>();
  for (const plan of stores.values()) {
    plan.exportName = dedupe(lowerFirst(camelCase(plan.name)), used);
    plan.interfaceName = dedupe(`${pascalCase(plan.name)}State`, usedInterfaces);
  }
  for (const plan of collections.values()) {
    plan.exportName = dedupe(lowerFirst(camelCase(plan.name)), used);
    plan.interfaceName = dedupe(`${pascalCase(plan.name)}Item`, usedInterfaces);
  }

  return { variables, channels, stores, collections, objectCollisions };
}

/** The sender's `payload` stringlist parameter, split — the payload port set, statically. */
export function payloadKeysOf(node: NodeIR): string[] {
  const raw = node.parameters.find((p) => p.name === 'payload')?.value;
  if (raw?.kind !== 'literal' || typeof raw.value !== 'string') return [];
  return raw.value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

export function isTextInputType(type: string): boolean {
  return type === 'net.noodl.controls.textinput' || type === 'Text Input';
}

/**
 * The store a node names: the literal `storeName`, `'app'` when absent or empty (all three
 * runtime nodes default exactly so), undefined when wired or non-literal — genuinely dynamic.
 */
export function storeNameOf(node: NodeIR, wiredPorts: Set<string>): string | undefined {
  if (wiredPorts.has(`${node.id}:storeName`)) return undefined;
  const param = node.parameters.find((p) => p.name === 'storeName')?.value;
  if (param === undefined) return 'app';
  if (param.kind !== 'literal' || typeof param.value !== 'string') return undefined;
  return param.value === '' ? 'app' : param.value;
}

/** A Subscribe node's authored key list, split as the runtime splits it (blank ⇒ all keys). */
export function subscribeKeysOf(node: NodeIR): string[] {
  const raw = node.parameters.find((p) => p.name === 'keys')?.value;
  if (raw?.kind !== 'literal' || typeof raw.value !== 'string') return [];
  return raw.value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

/**
 * A declarer's initialState, as far as it is statically knowable: a JSON-object parameter, or
 * JSON text that parses to a plain object (object-typed ports arrive as text when the author
 * typed JSON — the runtime's own `coerceState` rule). A wire, a non-object, or unparseable
 * text is 'bad'; the declarer contributes nothing and says so in the notes.
 */
export function initialStateOf(
  node: NodeIR,
  wiredPorts: Set<string>
): { kind: 'object'; value: Record<string, unknown> } | { kind: 'absent' } | { kind: 'bad' } {
  if (wiredPorts.has(`${node.id}:initialState`)) return { kind: 'bad' };
  const param = node.parameters.find((p) => p.name === 'initialState')?.value;
  if (param === undefined) return { kind: 'absent' };
  if (param.kind === 'json' && isPlainRecord(param.value)) return { kind: 'object', value: param.value };
  if (param.kind === 'literal' && typeof param.value === 'string') {
    if (param.value.trim() === '') return { kind: 'absent' };
    try {
      const parsed = JSON.parse(param.value);
      return isPlainRecord(parsed) ? { kind: 'object', value: parsed } : { kind: 'bad' };
    } catch {
      return { kind: 'bad' };
    }
  }
  return { kind: 'bad' };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonTsType(value: unknown): StoreKeyTsType {
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'unknown';
  }
}

function literalBool(node: NodeIR, paramName: string): boolean | undefined {
  const value = node.parameters.find((p) => p.name === paramName)?.value;
  return value?.kind === 'literal' && typeof value.value === 'boolean' ? value.value : undefined;
}

function writerRef(component: ComponentIR, node: NodeIR): VariableWriter {
  return {
    componentPath: component.path,
    nodeId: node.id,
    nodeType: node.type,
    ...(node.authoredLabel !== undefined ? { label: node.authoredLabel } : {})
  };
}

/** EXP-011 §67. An authored parameter as the primitive it is, or `undefined` for anything else. */
function literalPrimitive(node: NodeIR, paramName: string): string | number | boolean | undefined {
  const value = node.parameters.find((p) => p.name === paramName)?.value;
  if (value?.kind !== 'literal') return undefined;
  return typeof value.value === 'string' || typeof value.value === 'number' || typeof value.value === 'boolean' ? value.value : undefined;
}

function literalString(node: NodeIR, paramName: string): string | undefined {
  const value = node.parameters.find((p) => p.name === paramName)?.value;
  return value?.kind === 'literal' && typeof value.value === 'string' && value.value.length > 0
    ? value.value
    : undefined;
}

function dedupe(base: string, used: Set<string>): string {
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) candidate = `${base}${counter++}`;
  used.add(candidate);
  return candidate;
}
