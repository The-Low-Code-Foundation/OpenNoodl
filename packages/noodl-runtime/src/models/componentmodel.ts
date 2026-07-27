'use strict';

import type { ComponentModelLike, GraphPortModel } from '@noodl/types';

import NodeModel = require('./nodemodel');
import EventSender = require('../eventsender');

/** A connection between two ports, as the editor exported it. */
interface Connection {
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
  [extra: string]: unknown;
}

/** A node as it appears in a component's exported JSON, with its visual subtree. */
type ComponentNodeExportData = Parameters<typeof NodeModel.createFromExportData>[0] & {
  children?: ComponentNodeExportData[];
};

/** A component as it appears in a project's exported JSON. */
interface ComponentExportData {
  name: string;
  metadata?: Record<string, unknown>;
  ports?: GraphPortModel[];
  nodes?: ComponentNodeExportData[];
  connections?: Connection[];
  roots?: string[];
}

/**
 * One authored component: its node models, connections, roots and own ports. Published as
 * {@link ComponentModelLike} in `@noodl/types`; this is its implementation.
 *
 * `nodes` is declared — and published — as an array, but it is used as an id-keyed
 * dictionary throughout (`this.nodes[node.id] = node` with GUID ids), so its *elements*
 * are almost never populated. `getAllNodes` works because `Object.values` returns
 * string-keyed properties too. See the DEFECT note in `reset` for where the distinction
 * bites.
 */
interface ComponentModel extends ComponentModelLike {
  name: string;
  nodes: NodeModel[];
  connections: Connection[];
  roots: string[];
  inputPorts: Record<string, GraphPortModel>;
  outputPorts: Record<string, GraphPortModel>;
  metadata: Record<string, unknown>;

  addNode(node: NodeModel): Promise<void>;
  hasNodeWithId(id: string): boolean;
  getNodeWithId(id: string): NodeModel | undefined;
  getAllNodes(): NodeModel[];
  getNodesWithType(type: string): NodeModel[];
  addConnection(connection: Connection): void;
  removeConnection(connection: Connection): void;
  getConnectionsFromPort(nodeId: string, sourcePortName: string): Connection[];
  getConnectionsToPort(nodeId: string, targetPortName: string): Connection[];
  getConnectionsFrom(nodeId: string): Connection[];
  getConnectionsTo(nodeId: string): Connection[];
  addRootId(rootId: string): void;
  removeRootId(rootId: string): void;
  removeNodeWithId(id: string): Promise<boolean>;
  getAllConnections(): Connection[];
  addInputPort(port: GraphPortModel): void;
  addOutputPort(port: GraphPortModel): void;
  removeOutputPortWithName(portName: string): void;
  removeInputPortWithName(portName: string): void;
  updateInputPortTypes(ports: Record<string, GraphPortModel>): void;
  updateOutputPortTypes(ports: Record<string, GraphPortModel>): void;
  renameInputPortOnNodeWithId(id: string, oldName: string, newName: string): void;
  renameOutputPortOnNodeWithId(id: string, oldName: string, newName: string): void;
  setNodeParent(childModel: NodeModel, newParentModel: NodeModel | null, index?: number): void;
  importEditorNodeData(nodeData: ComponentNodeExportData, parentId?: string, childIndex?: number): Promise<void>;
  reset(): Promise<void>;
  rename(newName: string): void;
  setMetadata(key: string, data: unknown): void;
  getMetadata(key?: string): unknown;
}

interface ComponentModelConstructor {
  new (name: string): ComponentModel;
  prototype: ComponentModel;
  createFromExportData(componentData: ComponentExportData): Promise<ComponentModel>;
}

const ComponentModel = function ComponentModel(this: ComponentModel, name: string) {
  EventSender.call(this);

  this.name = name;
  this.nodes = [];
  this.connections = [];
  this.roots = [];
  this.inputPorts = {};
  this.outputPorts = {};
  this.metadata = {};
} as unknown as ComponentModelConstructor;

ComponentModel.prototype = Object.create(EventSender.prototype);

ComponentModel.prototype.addNode = async function (this: ComponentModel, node) {
  node.component = this;
  this.nodes[node.id] = node;
  await this.emit('nodeAdded', node);
};

ComponentModel.prototype.hasNodeWithId = function (this: ComponentModel, id) {
  return this.getNodeWithId(id) !== undefined;
};

ComponentModel.prototype.getNodeWithId = function (this: ComponentModel, id) {
  return this.nodes[id];
};

ComponentModel.prototype.getAllNodes = function (this: ComponentModel) {
  return Object.values(this.nodes);
};

ComponentModel.prototype.getNodesWithType = function (this: ComponentModel, type) {
  const nodes = [];
  const self = this;
  Object.keys(this.nodes).forEach(function (id) {
    const node = self.nodes[id];
    if (node.type === type) {
      nodes.push(node);
    }
  });

  return nodes;
};

ComponentModel.prototype.addConnection = function (this: ComponentModel, connection) {
  this.connections.push(connection);
  this.emit('connectionAdded', connection);

  //emit an event on the target node model
  //used by numbered inputs
  if (connection.targetId) {
    const node = this.getNodeWithId(connection.targetId);
    if (node) {
      node.emit('inputConnectionAdded', connection);
    }
  }
};

ComponentModel.prototype.removeConnection = function (this: ComponentModel, connection) {
  const index = this.connections.findIndex((con) => {
    return (
      con.sourceId === connection.sourceId &&
      con.sourcePort === connection.sourcePort &&
      con.targetId === connection.targetId &&
      con.targetPort === connection.targetPort
    );
  });

  if (index === -1) {
    console.log("Connection doesn't exist", connection);
    return;
  }

  this.connections.splice(index, 1);
  this.emit('connectionRemoved', connection);

  //emit an event on the target node model
  //used by numbered inputs
  if (connection.targetId) {
    const node = this.getNodeWithId(connection.targetId);
    if (node) {
      node.emit('inputConnectionRemoved', connection);
    }
  }
};

ComponentModel.prototype.getConnectionsFromPort = function (this: ComponentModel, nodeId, sourcePortName) {
  return this.connections.filter(function (connection) {
    return connection.sourceId === nodeId && connection.sourcePort === sourcePortName;
  });
};

ComponentModel.prototype.getConnectionsToPort = function (this: ComponentModel, nodeId, targetPortName) {
  return this.connections.filter(function (connection) {
    return connection.targetId === nodeId && connection.targetPort === targetPortName;
  });
};

ComponentModel.prototype.getConnectionsFrom = function (this: ComponentModel, nodeId) {
  return this.connections.filter(function (connection) {
    return connection.sourceId === nodeId;
  });
};

ComponentModel.prototype.getConnectionsTo = function (this: ComponentModel, nodeId) {
  return this.connections.filter(function (connection) {
    return connection.targetId === nodeId;
  });
};

ComponentModel.prototype.addRootId = function (this: ComponentModel, rootId) {
  if (this.roots.indexOf(rootId) !== -1) {
    return;
  }
  this.roots.push(rootId);
  this.emit('rootAdded', rootId);
};

ComponentModel.prototype.removeRootId = function (this: ComponentModel, rootId) {
  const index = this.roots.indexOf(rootId);
  if (index !== -1) {
    this.roots.splice(index, 1);
    this.emit('rootRemoved', rootId);
  }
};

ComponentModel.prototype.getRoots = function (this: ComponentModel) {
  return this.roots;
};

ComponentModel.prototype.removeNodeWithId = async function (this: ComponentModel, id) {
  const node = this.getNodeWithId(id);

  if (!node) {
    console.warn('ERROR: Attempted to remove non-existing node with ID:', id);
    return false;
  }

  //remove children first
  while (node.children.length > 0) {
    const child = node.children[0];
    const childRemoved = await this.removeNodeWithId(child.id);
    if (!childRemoved) {
      // Workaround for corrupt node trees, should never happen, a remove should always be successful
      node.children.shift();
    }
  }

  const connections = this.getConnectionsTo(id).concat(this.getConnectionsFrom(id));

  for (let i = 0; i < connections.length; i++) {
    this.removeConnection(connections[i]);
  }

  this.setNodeParent(node, null);

  if (this.roots.indexOf(node.id) !== -1) {
    this.removeRootId(node.id);
  }

  await this.emit('nodeRemoved', node);

  node.removeAllListeners();
  delete this.nodes[id];

  await this.emit('nodeWasRemoved', node);
  return true;
};

ComponentModel.prototype.getAllConnections = function (this: ComponentModel) {
  return this.connections;
};

ComponentModel.prototype.getInputPorts = function (this: ComponentModel) {
  return this.inputPorts;
};

ComponentModel.prototype.getOutputPorts = function (this: ComponentModel) {
  return this.outputPorts;
};

ComponentModel.prototype.addInputPort = function (this: ComponentModel, port) {
  this.inputPorts[port.name] = port;
  this.emit('inputPortAdded', port);
};

ComponentModel.prototype.addOutputPort = function (this: ComponentModel, port) {
  this.outputPorts[port.name] = port;
  this.emit('outputPortAdded', port);
};

ComponentModel.prototype.removeOutputPortWithName = function (this: ComponentModel, portName) {
  if (this.outputPorts.hasOwnProperty(portName)) {
    const port = this.outputPorts[portName];
    delete this.outputPorts[portName];
    this.emit('outputPortRemoved', port);
  }
};

ComponentModel.prototype.removeInputPortWithName = function (this: ComponentModel, portName) {
  if (this.inputPorts.hasOwnProperty(portName)) {
    const port = this.inputPorts[portName];
    delete this.inputPorts[portName];
    this.emit('inputPortRemoved', port);
  }
};

ComponentModel.prototype.updateInputPortTypes = function (this: ComponentModel, ports) {
  let changed = false;
  for (const key in ports) {
    if (this.inputPorts[key] !== undefined) {
      this.inputPorts[key].type = ports[key].type;
      changed = true;
    }
  }
  changed && this.emit('inputPortTypesUpdated');
};

ComponentModel.prototype.updateOutputPortTypes = function (this: ComponentModel, ports) {
  let changed = false;
  for (const key in ports) {
    if (this.outputPorts[key] !== undefined) {
      this.outputPorts[key].type = ports[key].type;
      changed = true;
    }
  }
  changed && this.emit('outputPortTypesUpdated');
};

ComponentModel.prototype.renameInputPortOnNodeWithId = function (this: ComponentModel, id, oldName, newName) {
  //remove connections
  const connections = this.getConnectionsToPort(id, oldName);
  connections.forEach(this.removeConnection.bind(this));

  //get port before deleting it
  const nodeModel = this.getNodeWithId(id);
  const port = { ...nodeModel.getInputPort(oldName) };

  //remove old port
  if (port) {
    nodeModel.removeInputPortWithName(oldName);

    //rename and add new port
    port.name = newName;
    nodeModel.addInputPort(port as GraphPortModel);
  }

  //add new connection
  connections.forEach(function (connection) {
    connection.targetPort = newName;
  });

  connections.forEach(this.addConnection.bind(this));
};

ComponentModel.prototype.renameOutputPortOnNodeWithId = function (this: ComponentModel, id, oldName, newName) {
  //remove connections
  const connections = this.getConnectionsFromPort(id, oldName);
  connections.forEach(this.removeConnection.bind(this));

  //get port before deleting it
  const nodeModel = this.getNodeWithId(id);
  const port = { ...nodeModel.getOutputPort(oldName) };

  //remove old port
  nodeModel.removeOutputPortWithName(oldName);

  //rename and add new port
  port.name = newName;
  nodeModel.addOutputPort(port as GraphPortModel);

  //add new connection
  connections.forEach(function (connection) {
    connection.sourcePort = newName;
  });

  connections.forEach(this.addConnection.bind(this));
};

ComponentModel.prototype.setNodeParent = function (this: ComponentModel, childModel, newParentModel, index) {
  if (this.roots.indexOf(childModel.id) !== -1) {
    this.removeRootId(childModel.id);
  }

  if (childModel.parent) {
    this.emit('nodeParentWillBeRemoved', childModel);
    childModel.parent.removeChild(childModel);
  }
  childModel.emit('parentUpdated', newParentModel);
  if (newParentModel) {
    newParentModel.addChild(childModel, index);
    this.emit('nodeParentUpdated', childModel);
  }
};

ComponentModel.prototype.importEditorNodeData = async function (this: ComponentModel, nodeData, parentId, childIndex) {
  const nodeModel = NodeModel.createFromExportData(nodeData);
  await this.addNode(nodeModel);

  if (parentId) {
    this.setNodeParent(nodeModel, this.getNodeWithId(parentId), childIndex);
  }

  if (nodeData.children) {
    for (let i = 0; i < nodeData.children.length; i++) {
      const child = nodeData.children[i];
      await this.importEditorNodeData(child, nodeModel.id, i);
    }
  }
};

ComponentModel.prototype.reset = async function (this: ComponentModel) {
  while (this.roots.length) {
    await this.removeNodeWithId(this.roots[0]);
  }

  /**
   * DEFECT (PLAT-003 NOTES §31), left verbatim: this loop can never remove anything.
   * `nodes` is an array used as an id-keyed dictionary, so `for…of` yields its *elements*
   * — none at all under GUID ids (the dictionary entries are not elements), or the node
   * objects themselves under numeric ids — never the id strings `hasNodeWithId` expects.
   * The comment below says `Object.keys(this.nodes)` runs this loop; the code does not.
   * Only roots and their descendants are actually removed by a reset.
   */
  for (const id of this.nodes) {
    //note: with an incomplete library there will be no roots
    //so some of the nodes will have children, which will be recursively removed by
    //removeNodeWithId(), so some IDs from the Object.keys(this.nodes) that runs this loop
    //will already have been removed, so check if they exist before removing
    if (this.hasNodeWithId(id as unknown as string)) {
      await this.removeNodeWithId(id as unknown as string);
    }
  }

  if (this.nodes.length > 0) {
    throw new Error('Not all nodes were removed during a reset');
  }

  if (this.connections.length > 0) {
    throw new Error('Not all connections were removed during a reset');
  }
};

ComponentModel.prototype.rename = function (this: ComponentModel, newName) {
  const oldName = this.name;
  this.name = newName;
  this.emit('renamed', { oldName: oldName, newName: newName });
};

ComponentModel.prototype.setMetadata = function (this: ComponentModel, key, data) {
  this.metadata[key] = data;
};

ComponentModel.prototype.getMetadata = function (this: ComponentModel, key) {
  if (!key) return this.metadata;
  return this.metadata[key];
};

ComponentModel.createFromExportData = async function (componentData: ComponentExportData): Promise<ComponentModel> {
  const componentModel = new ComponentModel(componentData.name);

  if (componentData.metadata) {
    for (const key in componentData.metadata) {
      componentModel.setMetadata(key, componentData.metadata[key]);
    }
  }

  componentData.ports &&
    componentData.ports.forEach(function (port) {
      if (port.plug === 'input' || port.plug === 'input/output') {
        componentModel.addInputPort(port);
      }
      if (port.plug === 'output' || port.plug === 'input/output') {
        componentModel.addOutputPort(port);
      }
    });

  if (componentData.nodes) {
    for (const node of componentData.nodes) {
      await componentModel.importEditorNodeData(node);
    }
  }

  componentData.connections &&
    componentData.connections.forEach((connection) => componentModel.addConnection(connection));
  componentData.roots && componentData.roots.forEach((root) => componentModel.addRootId(root));

  return componentModel;
};

export = ComponentModel;
