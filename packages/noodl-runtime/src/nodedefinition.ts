import type {
  ConditionalPortGroup,
  InputPortDefinition,
  InputPortMetadata,
  NodeDefinition,
  NodeDefinitionOptions,
  NodeMetadata,
  NumberedInputDefinition,
  OutputPortDefinition,
  PortType,
  PrototypeExtensions
} from '@noodl/types';

import type { RuntimeNode, RuntimeNodeContext } from './internal';

import Node = require('./node');
import EdgeTriggeredInput = require('./edgetriggeredinput');

/**
 * The setter table shared between every instance of one node type.
 *
 * Instances get their own object with this as prototype, so stateless setters cost nothing
 * per instance — only signal inputs, which close over per-instance edge state, are copied
 * onto the instance itself.
 */
type SharedInputs = Record<string, InputPortDefinition>;

function registerInput(object: SharedInputs, metadata: NodeMetadata, name: string, input: InputPortDefinition) {
  if (object.hasOwnProperty(name)) {
    throw new Error('Input property ' + name + ' already registered');
  }

  if (!input.set && !input.valueChangedToTrue) {
    input.set = () => {};
  }

  if (input.set) {
    object[name] = {
      set: input.set
    };

    //types to keep in the input on the node instances
    //color and textStyles are used for style updates
    //array is for supporting eval:ing strings
    const typesToSaveInInput = ['color', 'textStyle', 'array'];

    typesToSaveInInput.forEach((type) => {
      if (input.type && (input.type === type || (input.type as PortType).name === type)) {
        object[name].type = type;
      }
    });
  }

  if (input.setUnitType) {
    object[name].setUnitType = input.setUnitType;
  }

  metadata.inputs[name] = {
    displayName: input.displayName,
    editorName: input.editorName,
    group: input.group,
    type: input.type,
    default: input.default,
    index: input.index,
    exportToEditor: input.hasOwnProperty('exportToEditor') ? input.exportToEditor : true,
    inputPriority: input.inputPriority || 0,
    tooltip: input.tooltip,
    tab: input.tab,
    popout: input.popout,
    allowVisualStates: input.allowVisualStates,
    nodeDoubleClickAction: input.nodeDoubleClickAction
  };

  if (input.valueChangedToTrue) {
    metadata.inputs[name].type = {
      name: 'signal',
      allowConnectionsOnly: true
    };
  }
}

function registerInputs(object: SharedInputs, metadata: NodeMetadata, inputs: Record<string, InputPortDefinition>) {
  Object.keys(inputs).forEach(function (inputName) {
    registerInput(object, metadata, inputName, inputs[inputName]);
  });
}

function registerNumberedInputs(node: RuntimeNode, numberedInputs: Record<string, NumberedInputDefinition>) {
  for (const inputName of Object.keys(numberedInputs)) {
    registerNumberedInput(node, inputName, numberedInputs[inputName]);
  }
}

/**
 * Installs the `numbered-inputs` dynamic-port mechanism on one instance.
 *
 * `registerInputIfNeeded` is wrapped rather than replaced, so several numbered families
 * can coexist on the same node — each wrapper delegates to the one before it.
 */
function registerNumberedInput(node: RuntimeNode, name: string, input: NumberedInputDefinition) {
  const oldRegisterInputIfNeeded = node.registerInputIfNeeded;

  node.registerInputIfNeeded = function (inputName: string) {
    if (oldRegisterInputIfNeeded) {
      oldRegisterInputIfNeeded.call(node, inputName);
    }

    if (node.hasInput(inputName) || !inputName.startsWith(name)) {
      return;
    }

    const index = Number(inputName.slice(name.length + 1)); // inputName is "nameOfInput xxx" where xxx is the index

    node.registerInput(inputName, {
      type: input.type,
      set: input.createSetter.call(node, index)
    });
  };
}

function registerOutputsMetadata(metadata: NodeMetadata, outputs: Record<string, OutputPortDefinition>) {
  Object.keys(outputs).forEach(function (name) {
    var output = outputs[name];

    metadata.outputs[name] = {
      displayName: output.displayName,
      editorName: output.editorName,
      group: output.group,
      type: output.type,
      index: output.index,
      exportToEditor: output.hasOwnProperty('exportToEditor') ? output.exportToEditor : true
    };
  });
}

function initializeDefaultValues(
  defaultValues: Record<string, unknown>,
  inputsMetadata: Record<string, InputPortMetadata>
) {
  Object.keys(inputsMetadata).forEach((name) => {
    const defaultValue = inputsMetadata[name].default;
    if (defaultValue === undefined) return;

    const type = inputsMetadata[name].type as PortType;

    if (type.defaultUnit) {
      defaultValues[name] = {
        unit: type.defaultUnit,
        value: defaultValue
      };
    } else {
      defaultValues[name] = defaultValue;
    }
  });
}

function defineNode(opts: NodeDefinitionOptions): NodeDefinition {
  if (!opts.category) {
    throw new Error('Node must have a category');
  }

  if (!opts.name) {
    throw new Error('Node must have a name');
  }

  const metadata: NodeMetadata = {
    inputs: {},
    outputs: {},
    category: opts.category,
    dynamicports: opts.dynamicports,
    exportDynamicPorts: opts.exportDynamicPorts,
    useVariants: opts.useVariants,
    allowChildren: opts.allowChildren,
    allowChildrenWithCategory: opts.allowChildrenWithCategory,
    singleton: opts.singleton,
    connectionPanel: opts.connectionPanel,
    allowAsChild: opts.allowAsChild,
    visualStates: opts.visualStates,
    panels: opts.panels,
    color: opts.color,
    usePortAsLabel: opts.usePortAsLabel,
    portLabelTruncationMode: opts.portLabelTruncationMode,
    name: opts.name,
    displayNodeName: opts.displayNodeName || opts.displayName,
    deprecated: opts.deprecated,
    haveComponentPorts: opts.haveComponentPorts,
    version: opts.version,
    module: opts.module,
    docs: opts.docs,
    allowAsExportRoot: opts.allowAsExportRoot,
    nodeDoubleClickAction: opts.nodeDoubleClickAction,
    searchTags: opts.searchTags
  };

  opts._internal = opts._internal || {};

  //prototypeExtensions - old API
  //methods - new API
  opts.prototypeExtensions = opts.methods || opts.prototypeExtensions || {};
  opts.inputs = opts.inputs || {};
  opts.outputs = opts.outputs || {};
  opts.initialize = opts.initialize || function () {};

  let inputs: SharedInputs = {};

  registerInputs(inputs, metadata, opts.inputs);
  registerOutputsMetadata(metadata, opts.outputs);
  function NodeConstructor(this: RuntimeNode, context: RuntimeNodeContext, id: string) {
    Node.call(this, context, id);
  }

  const prototypeExtensions: PrototypeExtensions = opts.prototypeExtensions;

  Object.keys(prototypeExtensions).forEach(function (propName) {
    if (!(prototypeExtensions[propName] as PropertyDescriptor).value) {
      prototypeExtensions[propName] = {
        value: prototypeExtensions[propName]
      };
    }
  });

  NodeConstructor.prototype = Object.create(Node.prototype, prototypeExtensions as PropertyDescriptorMap);
  Object.defineProperty(NodeConstructor.prototype, 'name', {
    value: opts.name
  });

  if (opts.getInspectInfo) NodeConstructor.prototype.getInspectInfo = opts.getInspectInfo;
  if (opts.nodeScopeDidInitialize) NodeConstructor.prototype.nodeScopeDidInitialize = opts.nodeScopeDidInitialize;

  const nodeDefinition = function (context: RuntimeNodeContext, id: string, nodeScope?: unknown) {
    const node: RuntimeNode = new (NodeConstructor as unknown as new (
      context: RuntimeNodeContext,
      id: string
    ) => RuntimeNode)(context, id);

    //create all inputs. Use the inputs object for setters that don't have state and can be shared
    node._inputs = Object.create(inputs);

    //all inputs that use the valueChangedToTrue have state and need to be instanced
    Object.keys(opts.inputs).forEach(function (name) {
      var input = opts.inputs[name];
      if (input.valueChangedToTrue) {
        node._inputs[name] = {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: input.valueChangedToTrue
          })
        };
      }
    });

    Object.keys(opts.outputs).forEach(function (name) {
      var output = opts.outputs[name];
      if (output.type === 'signal') {
        node.registerOutput(name, {
          getter: function () {
            //signals are always emitted as a sequence of false, true, so this getter is never used
            return undefined;
          }
        });
      } else {
        node.registerOutput(name, output);
      }
    });

    opts.numberedInputs && registerNumberedInputs(node, opts.numberedInputs);

    node.nodeScope = nodeScope;
    initializeDefaultValues(node._inputValues, metadata.inputs);

    opts.initialize.call(node);

    return node;
  } as unknown as NodeDefinition;

  nodeDefinition.metadata = metadata;

  if (opts.numberedInputs) registerSetupFunctionForNumberedInputs(nodeDefinition, opts.name, opts.numberedInputs);

  return nodeDefinition;
}

/**
 * Teaches the editor about a node type's numbered inputs.
 *
 * The visible port count is derived from what the project actually uses — the highest
 * index found among the node's parameters and incoming connections, plus one spare — so a
 * gap (input 4 set while input 3 is empty) still yields ports up to 4. Only runs against a
 * local editor; a deployed viewer has nobody to tell.
 */
function registerSetupFunctionForNumberedInputs(
  nodeDefinition: NodeDefinition,
  nodeType: string,
  numberedInputs: Record<string, NumberedInputDefinition>
) {
  const inputNames = Object.keys(numberedInputs);

  if (!inputNames.length) return;

  nodeDefinition.setupNumberedInputDynamicPorts = function (context: RuntimeNodeContext, graphModel: any) {
    const editorConnection = context.editorConnection;

    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function collectPorts(node: any, inputName: string, input: NumberedInputDefinition) {
      const connections = node.component.getConnectionsTo(node.id).map((c: any) => c.targetPort);

      const allPortNames = Object.keys(node.parameters).concat(connections);
      const portNames = allPortNames.filter((p: string) => p.startsWith(inputName + ' '));

      //Figure out how many we need to create
      //It needs to be the highest index + 1
      //Only parameters with values are present, e.g. input 3 can be missing even if input 4 is defined
      const maxIndex = portNames.length
        ? 1 + Math.max(...portNames.map((p: string) => Number(p.slice(inputName.length + 1))))
        : 0;
      const numPorts = maxIndex + 1;

      const ports = [];

      for (let i = 0; i < numPorts; i++) {
        const port: { name: string; displayName: string; type: unknown; plug: string; group?: string; index?: number } =
          {
            name: inputName + ' ' + i,
            displayName: (input.displayPrefix || inputName) + ' ' + i,
            type: input.type,
            plug: 'input',
            group: input.group
          };

        if (input.hasOwnProperty('index')) {
          port.index = input.index + i;
        }

        ports.push(port);
      }

      return ports;
    }

    function updatePorts(node: any) {
      const ports = inputNames.map((inputName) => collectPorts(node, inputName, numberedInputs[inputName])).flat();
      editorConnection.sendDynamicPorts(node.id, ports);
    }

    graphModel.on('nodeAdded.' + nodeType, (node: any) => {
      updatePorts(node);
      node.on('parameterUpdated', () => {
        updatePorts(node);
      });

      node.on('inputConnectionAdded', () => {
        updatePorts(node);
      });

      node.on('inputConnectionRemoved', () => {
        updatePorts(node);
      });
    });
  };
}

/**
 * Deep-merges `obj2` into `obj1`, in place.
 *
 * Three cases are special and node definitions rely on all of them: `initialize` functions
 * are *chained* rather than replaced, arrays present on both sides are concatenated, and
 * plain objects merge recursively. Anything else is overwritten.
 */
function extend(obj1: any, obj2: any) {
  for (var p in obj2) {
    if (p === 'initialize' && obj1.initialize) {
      var oldInit = obj1.initialize;
      obj1.initialize = function (this: RuntimeNode) {
        oldInit.call(this);
        obj2.initialize.call(this);
      };
    } else if (obj2[p] && obj2[p].constructor === Object) {
      obj1[p] = extend(obj1[p] || {}, obj2[p]);
    } else if (obj2[p] && obj2[p].constructor === Array && obj1[p] && obj1[p].constructor == Array) {
      obj1[p] = obj1[p].concat(obj2[p]);
    } else {
      obj1[p] = obj2[p];
    }
  }
  return obj1;
}

export = {
  defineNode: defineNode,
  extend: extend
};
