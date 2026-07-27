'use strict';

import type { GraphNodeModel, GraphPortModel, StateTransition } from '@noodl/types';

import EventSender = require('../eventsender');

/**
 * The authored node the editor persisted — the blueprint a live `NodeInstance` is built
 * from. Published as {@link GraphNodeModel} in `@noodl/types`; this is its implementation.
 *
 * The members below are the ones the published type does not name, because a node author
 * never touches them: `inputs`/`outputs` are the *connection* lists the graph model fills
 * in, and the port-mutation methods are the editor's write path.
 */
interface NodeModel extends GraphNodeModel {
  id: string;
  type: string;
  /** Connections into this node. Populated by `GraphModel`, not by this class. */
  inputs: unknown[];
  /** Connections out of this node. Populated by `GraphModel`, not by this class. */
  outputs: unknown[];
  /** The variant this node inherits parameters and transitions from, if any. */
  variant?: unknown;
  /** Set by `addChild` — a node's parent is always another `NodeModel`. */
  parent?: NodeModel;

  setParameter(name: string, value: unknown, state?: string): void;
  setParameters(parameters: Record<string, unknown>): void;
  setStateParameters(parameters: Record<string, Record<string, unknown>>): void;
  setStateTransitions(stateTransitions: Record<string, Record<string, StateTransition>>): void;
  setStateTransitionParamter(parameter: string, curve: StateTransition | undefined, state: string): void;
  setDefaultStateTransition(stateTransition: StateTransition, state: string): void;
  addInputPort(port: GraphPortModel): void;
  getInputPort(portName: string): GraphPortModel | undefined;
  getInputPorts(): Record<string, GraphPortModel>;
  removeInputPortWithName(portName: string): void;
  updateInputPortTypes(ports: Record<string, GraphPortModel>): void;
  addOutputPort(port: GraphPortModel): void;
  getOutputPort(portName: string): GraphPortModel | undefined;
  getOutputPorts(): Record<string, GraphPortModel>;
  removeOutputPortWithName(portName: string): void;
  updateOutputPortTypes(ports: Record<string, GraphPortModel>): void;
  addChild(child: NodeModel, index?: number): void;
  removeChild(child: NodeModel): void;
  reset(): void;
  setVariant(variant: unknown): void;
}

/** A node as it appears in a project's exported JSON. */
interface NodeExportData {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  stateParameters?: Record<string, Record<string, unknown>>;
  stateTransitions?: Record<string, Record<string, StateTransition>>;
  defaultStateTransitions?: Record<string, StateTransition>;
  ports?: GraphPortModel[];
  variant?: unknown;
}

interface NodeModelConstructor {
  new (id: string, type: string): NodeModel;
  prototype: NodeModel;
  createFromExportData(nodeData: NodeExportData): NodeModel;
}

const NodeModel = function NodeModel(this: NodeModel, id: string, type: string) {
  EventSender.call(this);

  this.id = id;
  this.type = type;

  this.inputs = [];
  this.outputs = [];
  this.children = [];
  this.parameters = {};
  this.inputPorts = {};
  this.outputPorts = {};
} as unknown as NodeModelConstructor;

NodeModel.prototype = Object.create(EventSender.prototype);

NodeModel.prototype.setParameter = function (this: NodeModel, name, value, state) {
  if (state) {
    if (!this.stateParameters) this.stateParameters = {};
    if (!this.stateParameters[state]) this.stateParameters[state] = {};

    if (value === undefined) {
      delete this.stateParameters[state][name];
    } else {
      this.stateParameters[state][name] = value;
    }
  } else {
    if (value === undefined) {
      delete this.parameters[name];
    } else {
      this.parameters[name] = value;
    }
  }

  this.emit('parameterUpdated', { name, value, state });
};

NodeModel.prototype.setParameters = function (this: NodeModel, parameters) {
  Object.keys(parameters).forEach((name) => {
    this.setParameter(name, parameters[name]);
  });
};

NodeModel.prototype.setStateParameters = function (this: NodeModel, parameters) {
  this.stateParameters = parameters;
};

NodeModel.prototype.setStateTransitions = function (this: NodeModel, stateTransitions) {
  this.stateTransitions = stateTransitions;
};

/**
 * DEFECT (PLAT-003 NOTES §29.3), left verbatim: the guard creates `stateTransitions` but
 * never `stateTransitions[state]`, so the write below throws a `TypeError` on the first
 * transition set for a state — unless `setStateTransitions` has already seeded it. Fixing
 * it means deciding whether an unseeded state should be created or ignored, which is a
 * behaviour decision, not a typing one. The spelling of the method name is the public API
 * and is left alone.
 */
NodeModel.prototype.setStateTransitionParamter = function (this: NodeModel, parameter, curve, state) {
  if (!this.stateTransitions) {
    this.stateTransitions = {};
  }

  if (curve) {
    this.stateTransitions[state][parameter] = curve;
  } else {
    delete this.stateTransitions[state][parameter];
  }
};

NodeModel.prototype.setDefaultStateTransition = function (this: NodeModel, stateTransition, state) {
  if (!this.defaultStateTransitions) {
    this.defaultStateTransitions = {};
  }
  this.defaultStateTransitions[state] = stateTransition;
};

NodeModel.prototype.addInputPort = function (this: NodeModel, port) {
  this.inputPorts[port.name] = port;
  this.emit('inputPortAdded', port);
};

NodeModel.prototype.getInputPort = function (this: NodeModel, portName) {
  return this.inputPorts[portName];
};

NodeModel.prototype.getInputPorts = function (this: NodeModel) {
  return this.inputPorts;
};

NodeModel.prototype.removeInputPortWithName = function (this: NodeModel, portName) {
  if (Object.prototype.hasOwnProperty.call(this.inputPorts, portName)) {
    const port = this.inputPorts[portName];
    delete this.inputPorts[portName];
    this.emit('inputPortRemoved', port);
  }
};

NodeModel.prototype.updateInputPortTypes = function (this: NodeModel, ports) {
  let changed = false;
  for (const key in ports) {
    if (this.inputPorts[key] !== undefined) {
      this.inputPorts[key].type = ports[key].type;
      changed = true;
    }
  }
  changed && this.emit('inputPortTypesUpdated');
};

NodeModel.prototype.addOutputPort = function (this: NodeModel, port) {
  this.outputPorts[port.name] = port;
  this.emit('outputPortAdded', port);
};

NodeModel.prototype.getOutputPort = function (this: NodeModel, portName) {
  return this.outputPorts[portName];
};

NodeModel.prototype.getOutputPorts = function (this: NodeModel) {
  return this.outputPorts;
};

NodeModel.prototype.removeOutputPortWithName = function (this: NodeModel, portName) {
  if (Object.prototype.hasOwnProperty.call(this.outputPorts, portName)) {
    const port = this.outputPorts[portName];
    delete this.outputPorts[portName];
    this.emit('outputPortRemoved', port);
  }
};

NodeModel.prototype.updateOutputPortTypes = function (this: NodeModel, ports) {
  let changed = false;
  for (const key in ports) {
    if (this.outputPorts[key] !== undefined) {
      this.outputPorts[key].type = ports[key].type;
      changed = true;
    }
  }
  changed && this.emit('outputPortTypesUpdated');
};

NodeModel.prototype.addChild = function (this: NodeModel, child, index) {
  child.parent = this;
  if (index === undefined) {
    this.children.push(child);
  } else {
    this.children.splice(index, 0, child);
  }
  this.emit('childAdded', child);
};

NodeModel.prototype.removeChild = function (this: NodeModel, child) {
  child.parent = undefined;
  const index = this.children.indexOf(child);
  this.children.splice(index, 1);
  this.emit('childRemoved', child);
};

NodeModel.prototype.reset = function (this: NodeModel) {
  this.removeAllListeners();
};

NodeModel.prototype.setVariant = function (this: NodeModel, variant) {
  this.variant = variant;
  this.emit('variantUpdated', variant);
};

NodeModel.createFromExportData = function (nodeData: NodeExportData): NodeModel {
  const node = new NodeModel(nodeData.id, nodeData.type);
  nodeData.parameters && node.setParameters(nodeData.parameters);
  nodeData.stateParameters && node.setStateParameters(nodeData.stateParameters);
  nodeData.stateTransitions && node.setStateTransitions(nodeData.stateTransitions);

  if (nodeData.defaultStateTransitions) {
    for (const state in nodeData.defaultStateTransitions) {
      node.setDefaultStateTransition(nodeData.defaultStateTransitions[state], state);
    }
  }

  nodeData.ports &&
    nodeData.ports.forEach(function (port) {
      //some ports are incorrectly named outputs instead of output, patch it here so
      //the rest of the code doesn't need to care
      if (port.plug === 'outputs') {
        port.plug = 'output';
      }

      if (port.plug === 'input' || port.plug === 'input/output') {
        node.addInputPort(port);
      }
      if (port.plug === 'output' || port.plug === 'input/output') {
        node.addOutputPort(port);
      }
    });

  nodeData.variant && node.setVariant(nodeData.variant);

  return node;
};

export = NodeModel;
