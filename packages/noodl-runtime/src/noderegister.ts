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
  peek(name: string): NodeDefinition | undefined;
  restore(name: string, previous: NodeDefinition | undefined): void;
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

/**
 * ✅ **D20** — what a `register` under this name is about to displace.
 *
 * Paired with {@link restore} so `registerModule` can register a kit's nodes one at a time and
 * still undo all of them if the kit throws part-way. `undefined` means the name is free.
 */
NodeRegister.prototype.peek = function (name) {
  return this._constructors[name];
};

/**
 * ✅ **D20** — put back exactly what {@link peek} saw, including nothing.
 *
 * 🔴 **Restores rather than deletes, and that is the whole point.** Registration is
 * last-writer-wins and the viewer registers built-ins before kit nodes, so a kit is *allowed* to
 * shadow a built-in — `nodegx-kit-catalog`'s health check states that to authors as fact (D9).
 * A rollback that deleted the kit's names would take the shadowed built-in with them, and a
 * broken kit would silently cost the project a `Group`.
 */
NodeRegister.prototype.restore = function (name, previous) {
  if (previous === undefined) delete this._constructors[name];
  else this._constructors[name] = previous;
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
