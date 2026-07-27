import { difference } from 'underscore';

import { NodeLibrary } from '@noodl-models/nodelibrary/nodelibrary';
import {
  NodeLibraryData,
  NodeLibraryDataNodeType,
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

  constructor() {
    EventDispatcher.instance.on(
      'ProjectModel.instanceWillChange',
      () => {
        this.clients.clear();
        this.currentNodeLibrary = null;
        this.hasStaticCloudLibrary = false;
      },
      this
    );
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
  }

  /**
   * Occurs when the client is disconnecting.
   *
   * @param clientId
   */
  public onClientDisconnect(clientId: string) {
    this.clients.remove(clientId);
    this.updateIndex(false);
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
  }

  /** The assign-or-merge half of {@link onClientImport}, without the reload. */
  private importLibrary(clientId: string, runtimeType: RuntimeType, library: NodeLibraryData): boolean {
    this.clients.import(clientId, runtimeType, library.nodetypes);

    console.debug('[nodelib] Received', runtimeType, ` (nodes: ${library.nodetypes.length})`);

    // Assign or update the new library into our current version.
    if (!this.currentNodeLibrary) {
      this.assignNewLibrary(runtimeType, library);
      return true;
    }

    return this.mergeUpdates(runtimeType, library);
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
      NodeLibrary.instance.reload();
    }
  }

  private assignNewLibrary(runtimeType: RuntimeType, library: NodeLibraryData) {
    // Use the new library if we have none already.
    this.currentNodeLibrary = library;

    // Add what runtime the nodes are from.
    this.currentNodeLibrary.nodetypes.forEach((node) => {
      node.runtimeTypes = [runtimeType];
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
        updated = true;
      } else {
        // TODO: Update the node data?

        // Create the array if it doesnt exist
        if (!this.currentNodeLibrary.nodetypes[index].runtimeTypes) {
          this.currentNodeLibrary.nodetypes[index].runtimeTypes = [];
        }

        // Insert the new runtime if we dont have it.
        if (!this.currentNodeLibrary.nodetypes[index].runtimeTypes.includes(runtimeType)) {
          this.currentNodeLibrary.nodetypes[index].runtimeTypes.push(runtimeType);
          updated = true;
        }
      }
    });

    // Merge replace by name function
    function mergeInByName(inputArray: { name: string }[], outputArray: { name: string }[]) {
      inputArray.forEach((inputItem) => {
        const index = outputArray.findIndex((_t) => inputItem.name === _t.name);
        if (index !== -1) {
          outputArray[index] = inputItem;
        } else {
          outputArray.push(inputItem);
          updated = true;
        }
      });

      // if (inputArray.length > 0) {
      //   updated = true;
      // }
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
