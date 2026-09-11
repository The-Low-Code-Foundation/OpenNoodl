import { difference } from 'underscore';

import { NodeLibrary } from '@noodl-models/nodelibrary/nodelibrary';
import {
  NodeLibraryData,
  NodeLibraryDataNodeType,
  NodeLibraryModuleFailure,
  RuntimeType,
  RuntimeTypes
} from '@noodl-models/nodelibrary/NodeLibraryData';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import cloudNodeLibrary from './cloud-node-library.json';

/**
 * WFA-001 — the client id the generated cloud node library registers under.
 *
 * It is a client like any other as far as `ClientCollection` is concerned; it
 * simply never disconnects.
 */
const STATIC_CLOUD_CLIENT_ID = '__cloud_node_library__';

/**
 * WFA-004 — the client id the workflow step-kind library registers under.
 *
 * There is one, not one per backend: the workflow canvas targets one backend at
 * a time, and a union of two backends' catalogs would be a vocabulary neither
 * of them can execute.
 */
const WORKFLOW_CLIENT_ID = '__workflow_step_kinds__';

/**
 * CN-014 — has a runtime's report of a node actually changed?
 *
 * `runtimeTypes` is excluded because it is the editor's own bookkeeping: it is
 * written onto the stored node and never present on an incoming one, so a naive
 * comparison would call every node changed on every import.
 *
 * Key order is stable in practice (both sides are parsed from the same
 * generator's JSON), and the failure direction if it ever were not is a
 * redundant library reload rather than a missed one.
 */
function nodeDataDiffers(existing: NodeLibraryDataNodeType, incoming: NodeLibraryDataNodeType): boolean {
  const { runtimeTypes: _ignored, ...existingData } = existing;
  return JSON.stringify(existingData) !== JSON.stringify(incoming);
}

/**
 * Keep track of all the clients and their nodes.
 *
 * This is so we can make sure we always give the user the correct information
 * on what nodes are available to them.
 *
 * Because the viewers can connect/disconnect at any times, we keep a cache around to.
 * So when you get all the node names you will always get for all kinds of viewers runtimes.
 */
class ClientCollection {
  // NOTE: Made public for labbing with ConnectionInspector
  public _clients: {
    [clientId: string]: {
      runtimeTypes: Set<RuntimeType>;
      nodes: Set<string>;
    };
  } = {};

  private _cache: {
    [key: string]: Set<string>;
  } = {};

  public get count(): number {
    return Object.keys(this._clients).length;
  }

  public getNodeNames() {
    const taken = new Set<RuntimeType>();

    // Get all the nodes of the viewers we have
    let nodes = Object.entries(this._clients).flatMap(([_clientId, item]) => {
      item.runtimeTypes.forEach((runtimeType) => taken.add(runtimeType));
      return [...item.nodes];
    });

    // Check if we are missing any runtime types
    if (taken.size !== RuntimeTypes.length) {
      const missing = difference(RuntimeTypes, Array.from(taken.keys()));
      missing.forEach((runtimeType) => {
        if (this._cache[runtimeType]) {
          nodes = nodes.concat(Array.from(this._cache[runtimeType].keys()));
        } else {
          // console.error('[nodelib] Missing runtime type: ', runtimeType);
        }
      });
    }

    return new Set<string>(nodes);
  }

  public import(clientId: string, runtimeType: RuntimeType, nodetypes: NodeLibraryDataNodeType[]): void {
    if (!this._clients[clientId]) {
      this._clients[clientId] = {
        runtimeTypes: new Set(),
        nodes: new Set()
      };
    }

    this._clients[clientId].runtimeTypes.add(runtimeType);

    // Update the node set
    this._clients[clientId].nodes.clear();
    nodetypes.forEach((node) => {
      this._clients[clientId].nodes.add(node.name);
    });

    this._cache[runtimeType] = this._clients[clientId].nodes;
  }

  public remove(clientId: string) {
    delete this._clients[clientId];
  }

  public clear() {
    this._clients = {};
    this._cache = {};
  }
}

/**
 * Handle merging of node libraries between different runtimes.
 */
export class NodeLibraryImporter {
  public static instance = new NodeLibraryImporter();

  private currentNodeLibrary: NodeLibraryData = null;
  private clients = new ClientCollection();
  /** WFA-001: whether the generated cloud library is in `currentNodeLibrary`. */
  private hasStaticCloudLibrary = false;

  /**
   * WFA-004 — the workflow step-kind library, fetched from a running backend.
   *
   * Held rather than merged-and-forgotten because a workflow library is
   * *replaced*, not merged: two backends can serve different versions of the
   * same kind. Merging a second backend's catalog on top of the first would
   * leave the first backend's params in place under the second backend's name —
   * the exact drift the served registry exists to prevent. So the names
   * installed last time are remembered and removed first.
   *
   * ⚠️ **CN-014 changed the sentence this used to lean on.** `mergeUpdates` is
   * no longer purely additive — a runtime may now replace the data of a node it
   * owns. That does *not* make the remove-first dance redundant: a workflow
   * library never travels through `mergeUpdates` at all (it is pushed straight
   * into `nodetypes` by {@link applyWorkflowLibrary}), so nothing else would
   * ever evict the previous backend's kinds.
   */
  private workflowLibrary: NodeLibraryData | null = null;
  private workflowNodeNames = new Set<string>();

  /**
   * CN-014 — which runtime's report the *data* behind each node name came from.
   *
   * `runtimeTypes` on a node is a union: it answers "where can this node run?",
   * and after the generated cloud library merges, 84 of the browser library's
   * 177 names carry both Browser and Cloud. It therefore cannot answer the
   * question a refresh has to ask, which is "whose definition is this?".
   *
   * Precedence today is first-writer-wins: the browser client establishes the
   * library and the cloud merge only ever appends a runtime type. Keeping that
   * exactly as it is, while letting a runtime replace *its own* previous report,
   * is what this map is for — see {@link mergeUpdates}.
   */
  private dataOwner = new Map<string, RuntimeType>();

  constructor() {
    EventDispatcher.instance.on(
      'ProjectModel.instanceWillChange',
      () => {
        this.clients.clear();
        this.currentNodeLibrary = null;
        this.hasStaticCloudLibrary = false;
        this.workflowLibrary = null;
        this.workflowNodeNames.clear();
        this.dataOwner.clear();
      },
      this
    );
  }

  /**
   * Install (or clear, with `null`) the workflow step-kind node types.
   *
   * A no-op until some client has established a library — there is no canvas to
   * render into before that, and `assignNewLibrary` would otherwise make the
   * workflow catalog the base library, which carries no colours or project
   * settings. The pending library is applied on the next client import instead.
   */
  public importWorkflowLibrary(library: NodeLibraryData | null): void {
    this.workflowLibrary = library;
    this.applyWorkflowLibrary();
  }

  private applyWorkflowLibrary(): void {
    if (!this.currentNodeLibrary) return;

    let changed = false;

    // Remove exactly what was installed last time — by remembered name, so this
    // never reaches a node type some other runtime contributed.
    if (this.workflowNodeNames.size) {
      const before = this.currentNodeLibrary.nodetypes.length;
      this.currentNodeLibrary.nodetypes = this.currentNodeLibrary.nodetypes.filter(
        (n) => !this.workflowNodeNames.has(n.name)
      );
      changed = this.currentNodeLibrary.nodetypes.length !== before;
      this.workflowNodeNames.clear();
    }

    if (this.workflowLibrary) {
      const library = JSON.parse(JSON.stringify(this.workflowLibrary)) as NodeLibraryData;
      library.nodetypes.forEach((node) => {
        node.runtimeTypes = [RuntimeType.Workflow];
        this.currentNodeLibrary.nodetypes.push(node);
        this.workflowNodeNames.add(node.name);
      });

      // The picker's rail reads `nodeIndex.coreNodes`; replace the workflow
      // categories wholesale for the same reason the node types are replaced.
      const workflowCategories = new Set(library.nodeIndex.coreNodes.map((c) => c.name));
      this.currentNodeLibrary.nodeIndex.coreNodes = this.currentNodeLibrary.nodeIndex.coreNodes
        .filter((c) => !workflowCategories.has(c.name))
        .concat(library.nodeIndex.coreNodes);

      this.clients.import(WORKFLOW_CLIENT_ID, RuntimeType.Workflow, library.nodetypes);
      changed = true;
    } else {
      this.clients.remove(WORKFLOW_CLIENT_ID);
    }

    if (changed) this.updateIndex(true);
  }

  // NOTE: Made for labbing with ConnectionInspector
  public clientsWithRuntime(runtimeType: RuntimeType): string[] {
    return Object.keys(this.clients._clients).filter((key) => this.clients._clients[key].runtimeTypes.has(runtimeType));
  }

  public clear() {
    console.debug('[nodelib] Clear');

    this.clients.clear();
    this.currentNodeLibrary = null;
    this.hasStaticCloudLibrary = false;
    this.dataOwner.clear();
  }

  /**
   * Occurs when the client is disconnecting.
   *
   * @param clientId
   */
  public onClientDisconnect(clientId: string) {
    this.clients.remove(clientId);
    // CN-015: a failure was an observation made by *that page*. With the page
    // gone there is nothing standing behind the claim, so it goes too.
    const hadFailures = !!this.moduleFailures[clientId];
    delete this.moduleFailures[clientId];
    this.updateIndex(hadFailures);
  }

  /**
   * Occurs when the client is sending their node library.
   *
   * @param clientId
   * @param runtimeType
   * @param library
   * @returns
   */
  public onClientImport(clientId: string, runtimeType: RuntimeType, library: NodeLibraryData): void {
    let updated = this.importLibrary(clientId, runtimeType, library);

    /**
     * WFA-001 — merge the generated cloud node library alongside the real one.
     *
     * The editor learns its node types from connected viewer clients. The
     * browser types come from the preview window; the cloud types used to come
     * from the hidden cloud-runtime window WF-007 deleted, and since then there
     * have been **none** — a cloud function's canvas painted the Request and
     * Response nodes from its own starter template as unknown types, and the
     * node picker offered nothing that runs on a backend.
     *
     * It is merged *after* a real client rather than eagerly at boot so the
     * assign/merge order is exactly what it is today: the browser client still
     * establishes the library, and this only ever adds to it.
     */
    if (clientId !== STATIC_CLOUD_CLIENT_ID && !this.hasStaticCloudLibrary) {
      this.hasStaticCloudLibrary = true;
      // Deep-cloned: `assignNewLibrary`/`mergeUpdates` write `runtimeTypes` into
      // the node objects, and this one is a module singleton shared across every
      // project opened in this session.
      const cloudLibrary = JSON.parse(JSON.stringify(cloudNodeLibrary)) as NodeLibraryData;
      updated = this.importLibrary(STATIC_CLOUD_CLIENT_ID, RuntimeType.Cloud, cloudLibrary) || updated;
    }

    this.updateIndex(updated);

    // WFA-004: a workflow library fetched before any client had reported has
    // been waiting for a base library to merge into. This is where it lands.
    if (this.workflowLibrary && !this.workflowNodeNames.size) this.applyWorkflowLibrary();
  }

  /**
   * CN-015 — kit load failures, **per client and replaced on every import**.
   *
   * 🔴 Not merged into `currentNodeLibrary`, and that is the whole point.
   * `mergeUpdates` only ever walks `nodetypes`; a top-level field on a *second*
   * import would be silently ignored, so a failure list stamped there would
   * freeze at whatever the first client happened to report and go on claiming a
   * kit was broken after the author had fixed it. Keyed by client, it is
   * replaced when that viewer re-reports and dropped when it disconnects —
   * which is the honest lifetime, because the fact only exists while the page
   * that observed it is alive.
   */
  private moduleFailures: Record<string, NodeLibraryModuleFailure[]> = {};

  /**
   * Every connected client's kit load failures, deduplicated by kit name.
   *
   * ⚠️ Empty means *no connected viewer reported a failure* — which includes
   * "no viewer is connected at all". It is not evidence that the kits are
   * healthy, and the surfaces that render it must not say so.
   */
  public getModuleFailures(): NodeLibraryModuleFailure[] {
    const byModule = new Map<string, NodeLibraryModuleFailure>();
    for (const failures of Object.values(this.moduleFailures)) {
      for (const failure of failures) {
        if (failure && typeof failure.module === 'string') byModule.set(failure.module, failure);
      }
    }
    return Array.from(byModule.values());
  }

  /** The assign-or-merge half of {@link onClientImport}, without the reload. */
  private importLibrary(clientId: string, runtimeType: RuntimeType, library: NodeLibraryData): boolean {
    this.clients.import(clientId, runtimeType, library.nodetypes);

    // CN-015. A changed failure list forces the index update on its own: a kit
    // that registers no nodes even when healthy can break without any node
    // appearing or disappearing, and then nothing else here would report a
    // change and the panel would keep showing the stale answer.
    const incomingFailures = Array.isArray(library.modulefailures) ? library.modulefailures : [];
    const failuresChanged =
      JSON.stringify(this.moduleFailures[clientId] || []) !== JSON.stringify(incomingFailures);
    if (incomingFailures.length) this.moduleFailures[clientId] = incomingFailures;
    else delete this.moduleFailures[clientId];

    console.debug('[nodelib] Received', runtimeType, ` (nodes: ${library.nodetypes.length})`);

    // Assign or update the new library into our current version.
    if (!this.currentNodeLibrary) {
      this.assignNewLibrary(runtimeType, library);
      return true;
    }

    return this.mergeUpdates(runtimeType, library) || failuresChanged;
  }

  private updateIndex(forceUpdate: boolean): void {
    if (!this.currentNodeLibrary) {
      // @ts-ignore
      window.NodeLibraryData = {};
      return;
    }

    const nodeNames = this.clients.getNodeNames();

    // Remove all the nodes that we don't have anymore
    const removedNodes = [];
    this.currentNodeLibrary.nodetypes = this.currentNodeLibrary.nodetypes.filter((node) => {
      if (!nodeNames.has(node.name)) {
        removedNodes.push(node);
        return false;
      }
      return true;
    });

    /*
     * 🔴 **s29 — the picker's per-kit groups were never pruned, and the panel said so out loud.**
     *
     * `nodetypes` above is filtered against `nodeNames`; `nodeIndex.moduleNodes` was not, and
     * `mergeInByName` only ever replaces-by-name or pushes. So a kit that stopped registering —
     * a syntax error, or D20 rolling a kit back — kept its group here forever. Measured live: the
     * node library reported **no** `nodegx.broken.*` type while this index still listed
     * `nodegx.broken.Intact`.
     *
     * ⚠️ **It is not a cosmetic drift, it inverts a diagnostic.** `KitsSection` feeds these names
     * to `kitDiagnostics` as *"what this kit registered"*, so `registeredSomething` was true for a
     * kit that had registered nothing and Settings → Kits told the author the kit was *"only
     * PARTIALLY registered — nodes defined before the failure are available"*. With D20 the same
     * row then contradicted itself in one sentence: *"NONE of this kit's nodes register"* followed
     * by *"It is only PARTIALLY registered"*. The `partial` branch is **kept**, not deleted — a
     * script that throws after some `defineModule` calls really is half-registered, and that is
     * the alarming case CN-015 named. What changes is that its input is now true.
     *
     * ✅ Pruned against **the same `nodeNames`** the node types use, deliberately: two views of one
     * fact that *can* disagree eventually will, and this is the pair that did.
     */
    const removedModuleNodes: string[] = [];
    const moduleGroups = this.currentNodeLibrary.nodeIndex && this.currentNodeLibrary.nodeIndex.moduleNodes;
    if (moduleGroups) {
      const kept: typeof moduleGroups = [];
      for (const group of moduleGroups) {
        /*
         * ⚠️ **Only the shape the producer actually emits is judged.** `generateNodeLibrary` builds
         * `moduleNodes` as `{ name, items: string[] }` — flat, one entry per kit, items being
         * registered type names (`nodelibraryexport.ts`, the `moduleNodesByKit` map). `coreNodes` is
         * the one that carries `subCategories`, and `NodeLibraryData` types `items` as `TSFixme[]`,
         * so nothing here is guaranteed by the compiler.
         *
         * 🔴 A group whose `items` is not an array is therefore passed through untouched rather
         * than normalised or dropped. `tests-unit/cn-014` builds exactly such a group — a
         * `subCategories`-shaped `moduleNodes` entry the producer cannot emit — and a first draft of
         * this pass crashed on it. Dropping a kit's picker group because this code did not
         * recognise its shape would be a worse bug than the stale one being fixed.
         */
        if (!Array.isArray(group.items)) {
          kept.push(group);
          continue;
        }

        const items = group.items.filter((item) => {
          // Same reasoning one level down: only a plain type-name string can be checked.
          if (typeof item !== 'string' || nodeNames.has(item)) return true;
          removedModuleNodes.push(item);
          return false;
        });

        if (items.length === group.items.length) {
          kept.push(group);
        } else if (items.length > 0) {
          kept.push({ ...group, items });
        }
        // else: every name this kit registered is gone, so the group goes with them. That is
        // exactly what a kit the editor has never seen looks like, and `joinKitNodes` already
        // renders it as "installed, not yet loaded" beside the failure diagnostic saying why.
      }
      this.currentNodeLibrary.nodeIndex.moduleNodes = kept;
    }

    /*
     * ⚠️ **No extra republish trigger, and that is a measurement rather than an omission.** A group
     * item can only be pruned when its name has left `nodeNames` — and `nodetypes` is filtered
     * against the same set two blocks up, from a list the runtime builds from the same register
     * (`nodelibraryexport.ts`). So a prune here always coincides with `removedNodes.length > 0`.
     * A `|| removedModuleNodes.length > 0` clause was written first and then removed: no test could
     * reach it, which makes it a branch that only ever passes.
     */
    if (forceUpdate || removedNodes.length > 0) {
      // Send the node library to our NodeLibrary
      const exportJSON = JSON.parse(JSON.stringify(this.currentNodeLibrary));

      // @ts-ignore
      window.NodeLibraryData = exportJSON;

      // Reload as soon as any client has delivered a library. This used to
      // wait for two clients (browser viewer + the hidden cloud-runtime
      // sandbox), but WF-007 removed the cloud sandbox — with the gate in
      // place the library never loaded and every node graph painted blank.
      // If a cloud runtime ever reconnects, its import merges and triggers
      // another reload here.
      console.debug('[nodelib] Loaded new node library');
      if (removedNodes.length > 0) console.debug('[nodelib] Removed nodes: ', removedNodes);
      if (removedModuleNodes.length > 0) console.debug('[nodelib] Removed kit nodes: ', removedModuleNodes);
      NodeLibrary.instance.reload();
    }
  }

  private assignNewLibrary(runtimeType: RuntimeType, library: NodeLibraryData) {
    // Use the new library if we have none already.
    this.currentNodeLibrary = library;

    // Add what runtime the nodes are from.
    this.currentNodeLibrary.nodetypes.forEach((node) => {
      node.runtimeTypes = [runtimeType];
      // CN-014: this runtime established the data, so it is the one allowed to
      // replace it later.
      this.dataOwner.set(node.name, runtimeType);
    });

    // Make sure the data structure is what we expect
    if (!this.currentNodeLibrary.nodeIndex.coreNodes) {
      this.currentNodeLibrary.nodeIndex.coreNodes = [];
    }

    if (!this.currentNodeLibrary.nodeIndex.moduleNodes) {
      this.currentNodeLibrary.nodeIndex.moduleNodes = [];
    }
  }

  private mergeUpdates(runtimeType: RuntimeType, library: NodeLibraryData): boolean {
    let updated = false;

    // Loop over all the new node types
    library.nodetypes.forEach((node) => {
      const index = this.currentNodeLibrary.nodetypes.findIndex((x) => node.name === x.name);
      if (index === -1) {
        // Add the node, if it doesnt exist with the correct runtime
        node.runtimeTypes = [runtimeType];
        this.currentNodeLibrary.nodetypes.push(node);
        this.dataOwner.set(node.name, runtimeType);
        updated = true;
      } else {
        const existing = this.currentNodeLibrary.nodetypes[index];

        // Create the array if it doesnt exist
        if (!existing.runtimeTypes) {
          existing.runtimeTypes = [];
        }

        // Insert the new runtime if we dont have it.
        if (!existing.runtimeTypes.includes(runtimeType)) {
          existing.runtimeTypes.push(runtimeType);
          updated = true;
        }

        /**
         * CN-014 — a re-reporting runtime replaces its own node data.
         *
         * This used to be `// TODO: Update the node data?` and the answer was
         * "never", which is what froze a kit node's definition after its first
         * delivery: a viewer reload carries the author's edited `index.js`, but
         * the editor already knew the type name, so it took this branch and
         * discarded the new ports, dynamic ports and docs. A *new* node in the
         * same file arrived immediately (the branch above), so the author sees
         * the kit reload working and their edit ignored — which reads as "kit
         * dynamic ports are broken" rather than "the library did not refresh".
         *
         * Gated on ownership rather than done unconditionally. The generated
         * cloud library shares **all 84** of its names with the browser library
         * (`Expression`, `REST2`, `Model2`, …), and it merges on top of the
         * browser's report once per session — so an unconditional replace here
         * would silently hand 84 built-ins' definitions to the cloud library and
         * invert a precedence that has always been first-writer-wins.
         */
        if (this.dataOwner.get(node.name) === runtimeType && nodeDataDiffers(existing, node)) {
          // The union is the accumulated answer to "where can this run?" and is
          // not this report's to narrow: the cloud merge may already have added
          // itself to a node this runtime owns.
          node.runtimeTypes = existing.runtimeTypes;
          this.currentNodeLibrary.nodetypes[index] = node;
          updated = true;
        }
      }
    });

    // Merge replace by name function
    function mergeInByName(inputArray: { name: string }[], outputArray: { name: string }[]) {
      inputArray.forEach((inputItem) => {
        const index = outputArray.findIndex((_t) => inputItem.name === _t.name);
        if (index !== -1) {
          /**
           * CN-014 — replacing here has always happened; *saying so* has not.
           *
           * The replacement is real (this is how a kit's picker group is kept
           * current) but `updated` stayed false, so `updateIndex` published
           * nothing and `NodeLibrary.instance.reload()` never ran. The fresh
           * group sat in `currentNodeLibrary` and reached the picker only if
           * something else in the same import happened to flip the flag — which
           * is why adding a node to a kit refreshed its group and editing one
           * did not.
           *
           * The commented-out `if (inputArray.length > 0) updated = true` this
           * replaces was the right instinct in the wrong place: it fires on
           * every import, including the ones that change nothing.
           */
          if (JSON.stringify(outputArray[index]) !== JSON.stringify(inputItem)) {
            updated = true;
          }
          outputArray[index] = inputItem;
        } else {
          outputArray.push(inputItem);
          updated = true;
        }
      });
    }

    if (library.nodeIndex.coreNodes) {
      mergeInByName(library.nodeIndex.coreNodes, this.currentNodeLibrary.nodeIndex.coreNodes);
    }

    if (library.nodeIndex.moduleNodes) {
      mergeInByName(library.nodeIndex.moduleNodes, this.currentNodeLibrary.nodeIndex.moduleNodes);
    }

    // Do the same for project settings ports. WFA-001: guarded — a library
    // without a `projectsettings` block (the generated cloud one has none; the
    // cloud runtime has no project settings of its own) used to throw here.
    if (library.projectsettings && this.currentNodeLibrary.projectsettings) {
      mergeInByName(library.projectsettings.ports, this.currentNodeLibrary.projectsettings.ports);
      mergeInByName(library.projectsettings.dynamicports, this.currentNodeLibrary.projectsettings.dynamicports);
    }

    return updated;
  }
}
