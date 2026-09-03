'use strict';

import type { GraphModelLike, NodeVariant, RouterIndex, StateTransition } from '@noodl/types';

import ComponentModel = require('./componentmodel');
import NodeModel = require('./nodemodel');
import EventSender = require('../eventsender');

/** A component as it appears in a project's exported JSON. */
type ComponentExportData = Parameters<typeof ComponentModel.createFromExportData>[0];

/** One bundle in the export's component index. */
interface ComponentBundle {
  components: string[];
  dependencies: string[];
  [extra: string]: unknown;
}

/** The exported project the runtime boots from. */
interface GraphExportData {
  componentIndex?: Record<string, ComponentBundle>;
  routerIndex?: RouterIndex;
  variants?: NodeVariant[];
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  components: ComponentExportData[];
  rootComponent?: string;
}

/**
 * The whole authored project as the runtime sees it: components, settings, metadata,
 * variants and the bundle index. Published as {@link GraphModelLike} in `@noodl/types`;
 * this is its implementation.
 */
interface GraphModel extends GraphModelLike {
  components: Record<string, ComponentModel>;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  /** The export's bundle index — which components each bundle holds, and its dependencies. */
  componentIndex?: Record<string, ComponentBundle>;
  routerIndex?: RouterIndex;
  componentToBundleMap?: Map<string, string>;
  variants?: NodeVariant[];
  rootComponent?: string;

  importComponentFromEditorData(componentData: ComponentExportData): Promise<void>;
  getBundleContainingComponent(name: string): string | undefined;
  getBundlesContainingSheet(sheetName: string): string[];
  getBundleDependencies(bundleName: string): string[];
  importEditorData(exportData: GraphExportData): Promise<void>;
  setRootComponentName(componentName: string | undefined): void;
  getNodesWithType(type: string): NodeModel[];
  getComponentWithName(name: string): ComponentModel | undefined;
  getAllComponents(): ComponentModel[];
  getAllNodes(): NodeModel[];
  addComponent(component: ComponentModel): Promise<void>;
  removeComponentWithName(componentName: string): Promise<void>;
  renameComponent(componentName: string, newName: string): void;
  _addComponentPorts(node: NodeModel): void;
  _onNodeAdded(node: NodeModel): void;
  _onNodeRemoved(node: NodeModel): void;
  _onNodeWasRemoved(node: NodeModel): void;
  reset(): Promise<void>;
  isEmpty(): boolean;
  setSettings(settings: Record<string, unknown>): void;
  setAllMetaData(metadata: Record<string, unknown>): void;
  setMetaData(key: string, data: unknown): void;
  getMetaData(key?: string): unknown;
  getVariants(): NodeVariant[];
  getVariant(typename: string, name: string): NodeVariant | undefined;
  updateVariant(variant: NodeVariant): void;
  updateVariantParameter(
    variantName: string,
    variantTypeName: string,
    parameterName: string,
    parameterValue: unknown,
    state?: string
  ): void;
  updateVariantDefaultStateTransition(
    variantName: string,
    variantTypeName: string,
    transition: StateTransition,
    state: string
  ): void;
  updateVariantStateTransition(args: {
    variantTypeName: string;
    variantName: string;
    state: string;
    parameterName: string;
    curve: StateTransition;
  }): void;
  deleteVariant(typename: string, name: string): void;
}

interface GraphModelConstructor {
  new (): GraphModel;
  prototype: GraphModel;
}

const GraphModel = function GraphModel(this: GraphModel) {
  EventSender.call(this);
  this.components = {};

  this.settings = {};

  this.metadata = {};
} as unknown as GraphModelConstructor;

GraphModel.prototype = Object.create(EventSender.prototype);

GraphModel.prototype.importComponentFromEditorData = async function (this: GraphModel, componentData) {
  const componentModel = await ComponentModel.createFromExportData(componentData);
  // DEF-042: awaited. This is the only call site `addComponent` has, and it was the first of the
  // two breaks in an otherwise fully awaited chain — see `addComponent`'s header.
  await this.addComponent(componentModel);
};

GraphModel.prototype.getBundleContainingComponent = function (this: GraphModel, name) {
  return this.componentToBundleMap.get(name);
};

GraphModel.prototype.getBundlesContainingSheet = function (this: GraphModel, sheetName) {
  const bundles = new Set<string>();
  // Array.from rather than iterating the MapIterator: the viewer's ts-jest program
  // compiles this file at a pre-ES2015 target, where that is TS2802.
  for (const name of Array.from(this.componentToBundleMap.keys())) {
    const isOnDefaultSheet = name.indexOf('/#') !== 0;

    const isMatch =
      (isOnDefaultSheet && sheetName === 'Default') || (!isOnDefaultSheet && name.indexOf('/#' + sheetName) === 0);

    if (isMatch) {
      bundles.add(this.componentToBundleMap.get(name));
    }
  }
  return Array.from(bundles);
};

GraphModel.prototype.getBundleDependencies = function (this: GraphModel, bundleName) {
  const result = new Set<string>();

  const recurse = (name: string) => {
    const bundle = this.componentIndex[name];
    for (const dep of bundle.dependencies) {
      if (!result.has(dep)) {
        result.add(dep);
        recurse(dep);
      }
    }
  };

  recurse(bundleName);

  return Array.from(result);
};

GraphModel.prototype.importEditorData = async function (this: GraphModel, exportData) {
  this.componentIndex = exportData.componentIndex;
  this.routerIndex = exportData.routerIndex;

  this.componentToBundleMap = new Map();

  for (const bundleName in exportData.componentIndex) {
    const bundle = exportData.componentIndex[bundleName];

    for (const componentName of bundle.components) {
      this.componentToBundleMap.set(componentName, bundleName);
    }
  }

  this.variants = exportData.variants || [];

  exportData.settings && this.setSettings(exportData.settings);

  exportData.metadata && this.setAllMetaData(exportData.metadata);

  for (const component of exportData.components) {
    await this.importComponentFromEditorData(component);
  }

  this.setRootComponentName(exportData.rootComponent);
};

GraphModel.prototype.setRootComponentName = function (this: GraphModel, componentName) {
  this.rootComponent = componentName;
  this.emit('rootComponentNameUpdated', componentName);
};

GraphModel.prototype.getNodesWithType = function (this: GraphModel, type) {
  let nodes = [];

  const componentNames = Object.keys(this.components);
  for (let i = 0; i < componentNames.length; i++) {
    const component = this.components[componentNames[i]];
    nodes = nodes.concat(component.getNodesWithType(type));
  }
  return nodes;
};

GraphModel.prototype.getComponentWithName = function (this: GraphModel, type) {
  return this.components[type];
};

GraphModel.prototype.hasComponentWithName = function (this: GraphModel, type) {
  return this.components[type] ? true : false;
};

GraphModel.prototype.getAllComponents = function (this: GraphModel) {
  return Object.keys(this.components).map((name) => {
    return this.components[name];
  });
};

GraphModel.prototype.getAllNodes = function (this: GraphModel) {
  let nodes = [];

  const componentNames = Object.keys(this.components);
  for (let i = 0; i < componentNames.length; i++) {
    const component = this.components[componentNames[i]];
    nodes = nodes.concat(component.getAllNodes());
  }

  return nodes;
};

/**
 * Register a component and announce it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **DEF-042 — `async`, and the emit is AWAITED. Until it was, a throwing listener took the
 * whole backend process down with no HTTP response.**
 *
 * `emit` is async and sequential. Called without `await`, a listener that throws rejects a promise
 * **nobody is holding**, which Node turns into an unhandled rejection and an unhandled rejection
 * ends the process. The listener in question is real and shipped:
 * `NoodlRuntime.registerGraphModelListeners` subscribes to `componentAdded` and calls
 * `NodeContext.registerComponentModel`, which throws `Duplicate component name` when two bundles
 * declare the same one. **Measured:** two projects deploying a cloud function of the same
 * component name to one backend — `PUT` 1 answered 200, `PUT` 2 answered nothing at all, the
 * service was gone (`ECONNREFUSED`) and every other project's functions with it.
 *
 * 🔴 **The guard for this has existed since WFA-001 and was STARVED, not missing.**
 * `WorkflowRunner.loadWorkflow` wraps `await candidateRunner.load(bundle)` in a try/catch written
 * for exactly this case — *"a failure leaves the previous runner serving and the previous file on
 * disk"* — and no `Failed to load workflow` line ever appeared before the crash. The reason was
 * two missing `await`s in this file: every other link of
 * `loadWorkflow → CloudRunner.load → NoodlRuntime.setData → importEditorData →
 * importComponentFromEditorData` was already `async` **and already awaited**. `addComponent` has
 * exactly ONE caller, twelve lines above, and it was already `async` — so the "ripple into the
 * shared runtime" this fix was feared to cause is one `await` on one line.
 *
 * ⚠️ **What this does NOT fix.** `graphmodel.ts` emits in 16 places and the other 15 are still
 * un-awaited, `_onNodeAdded`'s among them — reached from a `forEach` inside this very function.
 * `componentAdded` is the one a person has met; the class is narrowed, not closed. Awaiting the
 * rest changes node-registration ordering in the browser viewer and is deliberately a separate
 * decision. ⚠️ `editormodeleventshandler.ts` also calls `importComponentFromEditorData` without
 * awaiting, so on the editor's live-edit path a throw still detaches.
 *
 * ⚠️ **The ordering this buys is a strengthening, not a change of contract.** Callers now wait for
 * every `componentAdded` listener before the next component is imported. They previously did not
 * reliably — the first listener ran synchronously and the rest in microtasks that interleaved with
 * the caller's own `await` — so "registration has finished" was already being assumed without
 * being true.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
GraphModel.prototype.addComponent = async function (this: GraphModel, component) {
  this.components[component.name] = component;

  //nodes that are already added are missing component input/output ports if the component is registered after the nodes
  //now when we have the component info, add them to the node instance models
  this.getNodesWithType(component.name).forEach(this._addComponentPorts.bind(this));

  //emit the "nodeAdded" event for every node already in the component
  component.getAllNodes().forEach(this._onNodeAdded.bind(this));

  //emit the same event for future nodes that will be added
  component.on('nodeAdded', this._onNodeAdded.bind(this), this);

  //and for nodes that are removed
  component.on('nodeRemoved', this._onNodeRemoved.bind(this), this);
  component.on('nodeWasRemoved', this._onNodeWasRemoved.bind(this), this);

  // DEF-042: the second of the two breaks. Awaited, so a listener that throws rejects THIS
  // function's promise and travels the already-awaited chain to `loadWorkflow`'s catch.
  await this.emit('componentAdded', component);
};

GraphModel.prototype.removeComponentWithName = async function (this: GraphModel, componentName) {
  if (this.components.hasOwnProperty(componentName) === false) {
    console.error('GraphModel: Component with name ' + componentName + ' not in graph');
    return;
  }

  const component = this.components[componentName];
  await component.reset();

  component.removeAllListeners();
  delete this.components[component.name];

  this.emit('componentRemoved', component);
};

GraphModel.prototype.renameComponent = function (this: GraphModel, componentName, newName) {
  if (this.components.hasOwnProperty(componentName) === false) {
    console.error('GraphModel: Component with name ' + componentName + ' not in graph');
    return;
  }

  this.getNodesWithType(componentName).forEach(function (nodeModel) {
    nodeModel.type = newName;
  });

  const component = this.components[componentName];
  component.rename(newName);

  delete this.components[componentName];
  this.components[newName] = component;

  this.emit('componentRenamed', component);
};

GraphModel.prototype._addComponentPorts = function (this: GraphModel, node) {
  //check if this node is a known component and add port to the model
  if (this.components.hasOwnProperty(node.type)) {
    //a component was created, add component ports to model
    const component = this.components[node.type];

    const inputPorts = component.getInputPorts();
    const outputPorts = component.getOutputPorts();

    Object.keys(inputPorts).forEach((portName) => {
      node.addInputPort(inputPorts[portName]);
    });

    Object.keys(outputPorts).forEach((portName) => {
      node.addOutputPort(outputPorts[portName]);
    });
  }
};

GraphModel.prototype._onNodeAdded = function (this: GraphModel, node) {
  this._addComponentPorts(node);

  this.emit('nodeAdded', node);
  this.emit('nodeAdded.' + node.type, node);
};

GraphModel.prototype._onNodeRemoved = function (this: GraphModel, node) {
  this.emit('nodeRemoved', node);
  this.emit('nodeRemoved.' + node.type, node);
};

GraphModel.prototype._onNodeWasRemoved = function (this: GraphModel, node) {
  this.emit('nodeWasRemoved', node);
  this.emit('nodeWasRemoved.' + node.type, node);
};

GraphModel.prototype.reset = async function (this: GraphModel) {
  for (const componentName of Object.keys(this.components)) {
    await this.removeComponentWithName(componentName);
  }
  this.setSettings({});
};

GraphModel.prototype.isEmpty = function (this: GraphModel) {
  return Object.keys(this.components).length === 0;
};

GraphModel.prototype.setSettings = function (this: GraphModel, settings) {
  this.settings = settings;
  this.emit('projectSettingsChanged', settings);
};

GraphModel.prototype.getSettings = function (this: GraphModel) {
  return this.settings;
};

GraphModel.prototype.setAllMetaData = function (this: GraphModel, metadata) {
  for (const p in metadata) {
    this.setMetaData(p, metadata[p]);
  }
};

GraphModel.prototype.setMetaData = function (this: GraphModel, key, data) {
  //metadata changes can trigger lots of ports to evaluate (e.g. when a database model has been changed)
  //check if the data actually has been updated before since the editor can send the same data multiple times
  if (this.metadata[key] && JSON.stringify(this.metadata[key]) === JSON.stringify(data)) {
    return;
  }

  this.metadata[key] = data;
  this.emit('metadataChanged', { key, data });
  this.emit('metadataChanged.' + key, data);
};

GraphModel.prototype.getMetaData = function (this: GraphModel, key) {
  if (key) return this.metadata[key];
  return this.metadata;
};

GraphModel.prototype.getVariants = function (this: GraphModel) {
  return this.variants || [];
};

GraphModel.prototype.getVariant = function (this: GraphModel, typename, name) {
  return this.variants.find((v) => v.name === name && v.typename === typename);
};

GraphModel.prototype.updateVariant = function (this: GraphModel, variant) {
  const i = this.variants.findIndex((v) => v.name === variant.name && v.typename === variant.typename);
  if (i !== -1) this.variants.splice(i, 1);
  this.variants.push(variant);

  this.emit('variantUpdated', variant);
};

GraphModel.prototype.updateVariantParameter = function (
  this: GraphModel,
  variantName,
  variantTypeName,
  parameterName,
  parameterValue,
  state
) {
  const variant = this.getVariant(variantTypeName, variantName);
  if (!variant) {
    console.log("updateVariantParameter: can't find variant", variantName, variantTypeName);
    return;
  }

  if (!state) {
    if (parameterValue === undefined) {
      delete variant.parameters[parameterName];
    } else {
      variant.parameters[parameterName] = parameterValue;
    }
  } else {
    if (!variant.stateParameters.hasOwnProperty(state)) {
      variant.stateParameters[state] = {};
    }

    if (parameterValue === undefined) {
      delete variant.stateParameters[state][parameterName];
    } else {
      variant.stateParameters[state][parameterName] = parameterValue;
    }
  }

  this.emit('variantUpdated', variant);
};

/**
 * DEFECT (PLAT-003 NOTES §31), left verbatim: `defaultStateTransitions` is optional on a
 * variant (`NodeVariant` in `@noodl/types`, and the editor omits it until a transition is
 * set), and nothing here creates it — the same guards-the-wrong-level shape as
 * `NodeModel.setStateTransitionParamter` (NOTES §29.3). The write below throws a
 * `TypeError` on a variant that arrived without the field.
 */
GraphModel.prototype.updateVariantDefaultStateTransition = function (
  this: GraphModel,
  variantName,
  variantTypeName,
  transition,
  state
) {
  const variant = this.getVariant(variantTypeName, variantName);
  if (!variant) return;

  variant.defaultStateTransitions[state] = transition;
  this.emit('variantUpdated', variant);
};

/**
 * DEFECT (PLAT-003 NOTES §31), left verbatim: the guard creates `stateTransitions[state]`
 * but reads `variant.stateTransitions[state]` first — on a variant that arrived without
 * the optional `stateTransitions` field at all, that read throws before the guard can
 * help. Same shape as `updateVariantDefaultStateTransition` above.
 */
GraphModel.prototype.updateVariantStateTransition = function (this: GraphModel, args) {
  const { variantTypeName, variantName, state, parameterName, curve } = args;

  const variant = this.getVariant(variantTypeName, variantName);
  if (!variant) return;

  if (!variant.stateTransitions[state]) {
    variant.stateTransitions[state] = {};
  }

  variant.stateTransitions[state][parameterName] = curve;
};

GraphModel.prototype.deleteVariant = function (this: GraphModel, typename, name) {
  const i = this.variants.findIndex((v) => v.name === name && v.typename === typename);
  if (i !== -1) this.variants.splice(i, 1);
};

export = GraphModel;
