'use strict';

import type {
  NodeContextLike,
  NodeDefinition,
  NodeInstance,
  NodeMetadata,
  NodeScopeLike,
  PortTypeSpec
} from '@noodl/types';

/**
 * The per-context table of node types.
 *
 * Keys are canonical type names (`nodeDefinition.metadata.name`), values are the factories
 * `NodeDefinition.defineNode` produced. Lookups throw on an unknown type rather than
 * returning undefined: a missing type means the project references a node the runtime
 * cannot build, and failing quietly there yields a silently incomplete graph.
 */
interface NodeRegister {
  _constructors: Record<string, NodeDefinition>;
  context: NodeContextLike;

  register(nodeDefinition: NodeDefinition): void;
  createNode(name: string, id: string, nodeScope?: NodeScopeLike): NodeInstance;
  getNodeMetadata(type: string): NodeMetadata;
  hasNode(type: string): boolean;
  getInputType(type: string, inputName: string): PortTypeSpec | undefined;
}

interface NodeRegisterConstructor {
  new (context: NodeContextLike): NodeRegister;
  prototype: NodeRegister;
}

const NodeRegister = function NodeRegister(this: NodeRegister, context: NodeContextLike) {
  this._constructors = {};
  this.context = context;
} as unknown as NodeRegisterConstructor;

NodeRegister.prototype.register = function (nodeDefinition) {
  var name = nodeDefinition.metadata.name;

  this._constructors[name] = nodeDefinition;
};

NodeRegister.prototype.createNode = function (name, id, nodeScope) {
  if (this._constructors.hasOwnProperty(name) === false) {
    throw new Error('Unknown node type with name ' + name);
  }

  return this._constructors[name](this.context, id, nodeScope);
};

NodeRegister.prototype.getNodeMetadata = function (type) {
  if (this._constructors.hasOwnProperty(type) === false) {
    throw new Error('Unknown node type with name ' + type);
  }

  return this._constructors[type].metadata;
};

NodeRegister.prototype.hasNode = function (type) {
  return this._constructors.hasOwnProperty(type);
};

NodeRegister.prototype.getInputType = function (type, inputName) {
  const metadata = this.getNodeMetadata(type);
  return metadata.inputs[inputName] && metadata.inputs[inputName].type;
};

export = NodeRegister;
