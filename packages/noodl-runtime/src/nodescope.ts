'use strict';

import type { RuntimeNode, RuntimeNodeContext } from './internal';
import type { NodeRunContext } from './runcontext';

import guid = require('./guid');

/**
 * A node instance as the scope handles it.
 *
 * Beyond the core {@link RuntimeNode}, the scope reaches for members that only some node
 * kinds have — the visual tree (`addChild`/`getChildren`/`parent`), and the component
 * plumbing (`nodeScope`/`parentNodeScope`) that component instances carry. They are
 * optional here rather than assumed, because that is the truth: a logic node has none of
 * them, and the scope tests for each before using it.
 */
type ScopedNode = RuntimeNode & {
  parent?: any;
  children?: any[];
  nodeScope?: NodeScope;
  parentNodeScope?: NodeScope;
  addChild?(child: ScopedNode, index: number): void;
  removeChild?(child: ScopedNode): void;
  getChildren?(): ScopedNode[];
  nodeScopeDidInitialize?(): void;
};

/** How far an event travels from the scope that sent it. */
type EventPropagation = 'parent' | 'children' | 'siblings' | null | undefined;

interface NodeScope {
  context: RuntimeNodeContext;
  nodes: Record<string, ScopedNode>;
  /** Component Instance that owns this NodeScope. Absent for scopes created standalone. */
  componentOwner: any;
  componentInstanceChildren: Record<string, ScopedNode>;
  componentModel?: any;
  /**
   * Attached by the cloud runtime, which gives every request its own `Model.Scope` so
   * concurrently-running cloud functions cannot see each other's objects. Unused in the
   * browser viewer.
   */
  modelScope?: any;
  /**
   * Per-run services (CWF-013), attached by the cloud runtime to the scope it creates for one
   * request and inherited by every component instance below it — the same propagation
   * `modelScope` gets, and for the same reason: two cloud functions run concurrently in one
   * process, so anything belonging to *this* request cannot live on a module-level global.
   * Unset in the browser viewer, which is what lets the `Log` node have one name and two
   * destinations without asking which runtime it is in.
   */
  runContext?: NodeRunContext;

  addConnection(connectionData: ConnectionData): void;
  setNodeParameters(node: ScopedNode, nodeModel: any): void;
  createNodeFromModel(nodeModel: any, updateOnDirtyFlagging?: boolean): Promise<ScopedNode | undefined>;
  insertNodeInTree(nodeInstance: ScopedNode, nodeModel: any): void;
  getNodeWithId(id: string): ScopedNode;
  hasNodeWithId(id: string): boolean;
  createPrimitiveNode(name: string, id?: string, extraProps?: Record<string, unknown>): ScopedNode;
  createNode(name: string, id?: string, extraProps?: Record<string, unknown>): Promise<ScopedNode>;
  getNodesWithIdRecursive(id: string): ScopedNode[];
  getNodesWithType(name: string): ScopedNode[];
  getNodesWithTypeRecursive(name: string): ScopedNode[];
  getAllNodesRecursive(): ScopedNode[];
  getAllNodesWithVariantRecursive(variant: unknown): ScopedNode[];
  onNodeModelRemoved(nodeModel: any): void;
  removeConnection(connectionModel: ConnectionData): void;
  setComponentModel(componentModel: any): Promise<void>;
  reset(): void;
  deleteNode(nodeInstance: ScopedNode): void;
  sendEventFromThisScope(
    eventName: string,
    data: unknown,
    propagation: EventPropagation,
    sendEventInThisScope?: boolean,
    _exclude?: unknown
  ): boolean | undefined;
}

interface ConnectionData {
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
}

interface NodeScopeConstructor {
  new (context: RuntimeNodeContext, componentOwner?: any): NodeScope;
  prototype: NodeScope;
}

/**
 * The set of node instances belonging to one component instance.
 *
 * Scopes nest: a component instance inside this scope owns a scope of its own, which is
 * why the `*Recursive` lookups exist and why event propagation has to walk both ways.
 */
const NodeScope = function NodeScope(this: NodeScope, context: RuntimeNodeContext, componentOwner?: any) {
  this.context = context;
  this.nodes = {};
  this.componentOwner = componentOwner; //Component Instance that owns this NodeScope
  this.componentInstanceChildren = {};
} as unknown as NodeScopeConstructor;

function verifyData(data: Record<string, unknown>, requiredKeys: string[]) {
  requiredKeys.forEach(function (key) {
    if (!data[key]) {
      throw new Error('Missing ' + key);
    }
  });
}

NodeScope.prototype.addConnection = function (connectionData) {
  try {
    verifyData(connectionData as unknown as Record<string, unknown>, [
      'sourceId',
      'sourcePort',
      'targetId',
      'targetPort'
    ]);
  } catch (e) {
    throw new Error('Error in connection: ' + e.message);
  }

  try {
    var sourceNode = this.getNodeWithId(connectionData.sourceId),
      targetNode = this.getNodeWithId(connectionData.targetId);

    targetNode.registerInputIfNeeded(connectionData.targetPort);
    sourceNode.registerOutputIfNeeded(connectionData.sourcePort);
    targetNode.connectInput(connectionData.targetPort, sourceNode, connectionData.sourcePort);
  } catch (e) {
    console.error(e.message);
  }
};

NodeScope.prototype.setNodeParameters = function (node, nodeModel) {
  const variant = this.context.variants.getVariant(nodeModel.type, nodeModel.variant);

  if (variant) {
    //apply the variant (this will also apply the parameters)
    node.setVariant(variant);
  } else {
    const parameters = nodeModel.parameters;

    var inputNames = Object.keys(parameters);

    if (this.context.nodeRegister.hasNode(node.name)) {
      var metadata = this.context.nodeRegister.getNodeMetadata(node.name);
      inputNames.sort(function (a, b) {
        var inputA = metadata.inputs[a];
        var inputB = metadata.inputs[b];
        return (inputB ? inputB.inputPriority : 0) - (inputA ? inputA.inputPriority : 0);
      });
    }

    inputNames.forEach((inputName) => {
      node.registerInputIfNeeded(inputName);

      //protect against obsolete parameters
      if (node.hasInput(inputName) === false) {
        return;
      }

      node.queueInput(inputName, parameters[inputName]);
    });
  }
};

NodeScope.prototype.createNodeFromModel = async function (nodeModel, updateOnDirtyFlagging) {
  if (nodeModel.type === 'Component Children') {
    if (nodeModel.parent) {
      var parentInstance = this.getNodeWithId(nodeModel.parent.id);
      this.componentOwner.setChildRoot(parentInstance);
    }
    return;
  }

  var node: ScopedNode;
  try {
    node = await this.createNode(nodeModel.type, nodeModel.id);
    node.updateOnDirtyFlagging = updateOnDirtyFlagging === false ? false : true;
    node.setNodeModel(nodeModel);
  } catch (e) {
    console.error(e.message);
    if (this.context.editorConnection && this.context.isWarningTypeEnabled('nodescope')) {
      this.context.editorConnection.sendWarning(this.componentOwner.name, nodeModel.id, 'nodelibrary-unknown-node', {
        message: e.message,
        showGlobally: true
      });
    }
    return;
  }

  if (nodeModel.variant && node.setVariant) node.setVariant(nodeModel.variant);
  this.setNodeParameters(node, nodeModel);

  if (nodeModel.parent) {
    this.insertNodeInTree(node, nodeModel);
  }

  return node;
};

NodeScope.prototype.insertNodeInTree = function (nodeInstance, nodeModel) {
  var parentInstance = this.getNodeWithId(nodeModel.parent.id);
  var childIndex = nodeModel.parent.children.indexOf(nodeModel);

  if (!parentInstance.addChild) {
    throw new Error(
      'Node ' + parentInstance.id + ' of type ' + parentInstance.constructor.name + " can't have children"
    );
  }

  parentInstance.addChild(nodeInstance, childIndex);
};

NodeScope.prototype.getNodeWithId = function (id) {
  if (this.nodes.hasOwnProperty(id) === false) {
    throw new Error('Unknown node id ' + id);
  }
  return this.nodes[id];
};

NodeScope.prototype.hasNodeWithId = function (id) {
  return this.nodes.hasOwnProperty(id);
};

NodeScope.prototype.createPrimitiveNode = function (name, id, extraProps) {
  if (!id) id = guid();

  if (this.nodes.hasOwnProperty(id)) {
    throw Error('duplicate id ' + id);
  }

  const node = this.context.nodeRegister.createNode(name, id, this);
  if (extraProps) {
    for (const prop in extraProps) {
      node[prop] = extraProps[prop];
    }
  }

  this.nodes[id] = node;
  return node;
};

NodeScope.prototype.createNode = async function (name, id, extraProps) {
  if (!id) id = guid();

  if (this.nodes.hasOwnProperty(id)) {
    throw Error('duplicate id ' + id);
  }

  let node;

  if (this.context.nodeRegister.hasNode(name)) {
    node = this.context.nodeRegister.createNode(name, id, this);
    if (extraProps) {
      for (const prop in extraProps) {
        node[prop] = extraProps[prop];
      }
    }
  } else {
    node = await this.context.createComponentInstanceNode(name, id, this, extraProps);
    this.componentInstanceChildren[id] = node;
  }

  this.nodes[id] = node;
  return node;
};

NodeScope.prototype.getNodesWithIdRecursive = function (id) {
  //required lazily: componentinstance requires the scope back
  var ComponentInstanceNode = require('./nodes/componentinstance');

  function findNodesWithIdRec(scope: NodeScope, id: string, result: ScopedNode[]) {
    if (scope.nodes.hasOwnProperty(id)) {
      result.push(scope.nodes[id]);
    }

    var componentIds = Object.keys(scope.nodes).filter(function (nodeId) {
      return scope.nodes[nodeId] instanceof ComponentInstanceNode;
    });

    componentIds.forEach(function (componentId) {
      findNodesWithIdRec(scope.nodes[componentId].nodeScope, id, result);
    });
  }

  var result: ScopedNode[] = [];
  findNodesWithIdRec(this, id, result);
  return result;
};

NodeScope.prototype.getNodesWithType = function (name) {
  var self = this;
  var ids = Object.keys(this.nodes).filter(function (id) {
    return self.nodes[id].name === name;
  });
  return ids.map(function (id) {
    return self.nodes[id];
  });
};

NodeScope.prototype.getNodesWithTypeRecursive = function (name) {
  var ComponentInstanceNode = require('./nodes/componentinstance');

  var self = this;
  function findNodesWithTypeRec() {
    result = result.concat(self.getNodesWithType(name));

    var componentIds = Object.keys(self.nodes).filter(function (nodeId) {
      return self.nodes[nodeId] instanceof ComponentInstanceNode;
    });

    componentIds.forEach(function (componentId) {
      var res = self.nodes[componentId].nodeScope.getNodesWithTypeRecursive(name);
      result = result.concat(res);
    });
  }

  var result: ScopedNode[] = [];
  findNodesWithTypeRec();
  return result;
};

NodeScope.prototype.getAllNodesRecursive = function () {
  var ComponentInstanceNode = require('./nodes/componentinstance');

  let result: ScopedNode[] = [];

  const getAllNodesRec = () => {
    result = result.concat(Object.values(this.nodes));

    var componentIds = Object.keys(this.nodes).filter((nodeId) => {
      return this.nodes[nodeId] instanceof ComponentInstanceNode;
    });

    componentIds.forEach((componentId) => {
      var res = this.nodes[componentId].nodeScope.getAllNodesRecursive();
      result = result.concat(res);
    });
  };

  getAllNodesRec();
  return result;
};

NodeScope.prototype.getAllNodesWithVariantRecursive = function (variant) {
  const nodes = this.getAllNodesRecursive();
  return nodes.filter((node) => node.variant === variant);
};

NodeScope.prototype.onNodeModelRemoved = function (nodeModel) {
  var nodeInstance = this.getNodeWithId(nodeModel.id);

  if (nodeModel.parent) {
    var parentInstance = this.getNodeWithId(nodeModel.parent.id);
    parentInstance.removeChild(nodeInstance);
  }

  nodeInstance._onNodeDeleted();
  delete this.nodes[nodeInstance.id];
  delete this.componentInstanceChildren[nodeInstance.id];
};

NodeScope.prototype.removeConnection = function (connectionModel) {
  var targetNode = this.getNodeWithId(connectionModel.targetId);
  targetNode.removeInputConnection(connectionModel.targetPort, connectionModel.sourceId, connectionModel.sourcePort);
};

NodeScope.prototype.setComponentModel = async function (componentModel) {
  this.componentModel = componentModel;

  const nodes: ScopedNode[] = [];

  //create all nodes
  for (const nodeModel of componentModel.getAllNodes()) {
    const node = await this.createNodeFromModel(nodeModel, false);
    if (node) nodes.push(node);
  }

  componentModel.getAllConnections().forEach((conn: ConnectionData) => this.addConnection(conn));

  //now that all nodes and connections are setup, trigger the dirty flagging so nodes can run with all the connections in place
  nodes.forEach((node) => (node.updateOnDirtyFlagging = true));

  nodes.forEach((node) => {
    if (node._dirty) {
      node._performDirtyUpdate();
    }
  });

  componentModel.on('connectionAdded', (conn: ConnectionData) => this.addConnection(conn), this);
  componentModel.on('connectionRemoved', this.removeConnection, this);
  componentModel.on('nodeAdded', this.createNodeFromModel, this);

  var self = this;
  componentModel.on(
    'nodeParentWillBeRemoved',
    function (this: NodeScope, nodeModel: any) {
      if (nodeModel.type === 'Component Children') {
        if (nodeModel.parent) {
          this.componentOwner.setChildRoot(null);
        }
        return;
      }

      const nodeInstance = self.getNodeWithId(nodeModel.id);
      if (nodeInstance.parent) {
        nodeInstance.parent.removeChild(nodeInstance);
      }
    },
    this
  );

  componentModel.on(
    'nodeParentUpdated',
    function (this: NodeScope, nodeModel: any) {
      if (nodeModel.type === 'Component Children') {
        var parentInstance = this.getNodeWithId(nodeModel.parent.id);
        this.componentOwner.setChildRoot(parentInstance);
      } else {
        var nodeInstance = self.getNodeWithId(nodeModel.id);
        self.insertNodeInTree(nodeInstance, nodeModel);
      }
    },
    this
  );

  componentModel.on(
    'nodeRemoved',
    function (nodeModel: any) {
      if (nodeModel.type !== 'Component Children') {
        self.onNodeModelRemoved(nodeModel);
      }
    },
    this
  );

  for (const id in this.nodes) {
    const node = this.nodes[id];
    node.nodeScopeDidInitialize && node.nodeScopeDidInitialize();
  }
};

NodeScope.prototype.reset = function () {
  if (this.componentModel) {
    this.componentModel.removeListenersWithRef(this);
    this.componentModel = undefined;
  }

  Object.keys(this.nodes).forEach((id) => {
    if (this.nodes.hasOwnProperty(id)) {
      this.deleteNode(this.nodes[id]);
    }
  });
};

NodeScope.prototype.deleteNode = function (nodeInstance) {
  if (this.nodes.hasOwnProperty(nodeInstance.id) === false) {
    console.error("Node doesn't belong to this scope", nodeInstance.id, nodeInstance.name);
    return;
  }

  if (nodeInstance.parent) {
    nodeInstance.parent.removeChild(nodeInstance);
  }

  //depth first
  if (nodeInstance.getChildren) {
    nodeInstance.getChildren().forEach((child) => {
      nodeInstance.removeChild(child);
      //the child might be created in a different scope
      //if the child is a component instance, we want its parent scope, not the inner scope
      const nodeScope = child.parentNodeScope || child.nodeScope;
      nodeScope.deleteNode(child);
    });
  }

  if (this.componentModel) {
    const connectionFrom = this.componentModel.getConnectionsFrom(nodeInstance.id);
    const connectionTo = this.componentModel.getConnectionsTo(nodeInstance.id);

    connectionFrom.concat(connectionTo).forEach((connection: ConnectionData) => {
      if (this.nodes.hasOwnProperty(connection.targetId) && this.nodes.hasOwnProperty(connection.sourceId)) {
        this.removeConnection(connection);
      }
    });
  }

  nodeInstance._onNodeDeleted();
  delete this.nodes[nodeInstance.id];
  delete this.componentInstanceChildren[nodeInstance.id]; //in case this is a component
};

NodeScope.prototype.sendEventFromThisScope = function (
  eventName,
  data,
  propagation,
  sendEventInThisScope,
  _exclude
) {
  if (sendEventInThisScope) {
    var eventReceivers = this.getNodesWithType('Event Receiver').filter(function (eventReceiver: any) {
      return eventReceiver.getChannelName() === eventName;
    }) as any[];

    for (var i = 0; i < eventReceivers.length; i++) {
      var consumed = eventReceivers[i].handleEvent(data);
      if (consumed) return true;
    }
  }

  if (propagation === 'parent' && this.componentOwner.parentNodeScope) {
    // Send event to parent scope
    //either the scope of the visual parent if there is one, otherwise the parent component
    const parentNodeScope: NodeScope = this.componentOwner.parent
      ? this.componentOwner.parent.nodeScope
      : this.componentOwner.parentNodeScope;
    if (!parentNodeScope) return;
    parentNodeScope.sendEventFromThisScope(eventName, data, propagation, true);
  } else if (propagation === 'children') {
    // Send event to all child scopes
    var nodes = this.nodes;
    for (var nodeId in nodes) {
      var children = nodes[nodeId].children;
      if (children)
        children.forEach((child) => {
          if (child.name && this.context.hasComponentModelWithName(child.name)) {
            // This is a component instance child
            var consumed = child.nodeScope.sendEventFromThisScope(eventName, data, propagation, true);
            if (consumed) return true;
          }
        });
    }
  } else if (propagation === 'siblings') {
    // Send event to all siblings, that is all children of the parent scope except this scope
    let parentNodeScope: NodeScope;
    if (this.componentOwner.parent) {
      parentNodeScope = this.componentOwner.parent.nodeScope;
    } else {
      parentNodeScope = this.componentOwner.parentNodeScope;
    }

    if (!parentNodeScope) return;

    var siblingNodes = parentNodeScope.nodes;
    for (var nodeId in siblingNodes) {
      var siblingChildren = siblingNodes[nodeId].children;
      if (siblingChildren) {
        var _c = siblingChildren.filter(
          (child) => child.name && this.context.hasComponentModelWithName(child.name) && child.nodeScope !== this
        );
        _c.forEach((child) => {
          var consumed = child.nodeScope.sendEventFromThisScope(eventName, data, null, true);
          if (consumed) return true;
        });
      }
    }
  }

  return false;
};

export = NodeScope;
