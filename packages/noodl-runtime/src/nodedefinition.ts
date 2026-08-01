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
import { runOnChangeInputs } from './run-on-value-change';

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
    //array and object are for supporting eval:ing strings — both are edited as a literal
    //in the property panel, so the value that reaches setInputValue is the typed text
    const typesToSaveInInput = ['color', 'textStyle', 'array', 'object'];

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
    // NDA-005. `description` and `tooltip` are two documents for two readers and neither can
    // stand in for the other: `tooltip` is the editor's hover popup — a heading, paragraphs and
    // sometimes images — while `description` is the one sentence the catalog, the semantic
    // validator and the AI authoring loop read. Flattening the popup into a sentence is what
    // `tooltipToText` does, and the result reads like a heading glued to prose ("Clip content
    // Controls if elements that are too big to fit will be clipped Enabled Disabled").
    //
    // The field was **declared on both port types and copied nowhere**, so the three
    // descriptions NDA-003 wrote on the Variables nodes — about the very contract that task
    // established — reached no reader at all. Same shape as this phase's other inert fields.
    description: input.description,
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
      exportToEditor: output.hasOwnProperty('exportToEditor') ? output.exportToEditor : true,
      /** NDA-005 — see the note on the input side. Outputs have no `tooltip` at all, so this
       *  is the only documentation an output port can carry. */
      description: output.description
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

/**
 * True only for the SSR server's render context. The browser never sets the
 * flag, and neither does the cloud runtime — "no window" alone is NOT the
 * signal, because cloud functions also run this code in Node.js and must run
 * nodes for real. The flag is set by the SSR entry's platform args
 * (noodl-viewer-react.js createArgs, window-undefined branch).
 */
function isSSRServerContext(context: RuntimeNodeContext): boolean {
  const platform = context && (context as { platform?: { isSSRServer?: () => boolean } }).platform;
  return !!(platform && typeof platform.isSSRServer === 'function' && platform.isSSRServer());
}

/**
 * A `client-only` node on the SSR server is created inert instead of run:
 * ports exist so connections resolve, but authored code never executes —
 * initialize is skipped, setters are no-ops, outputs read undefined. Without
 * this, a node touching `window`/`document` in its load path throws and takes
 * the whole server render down to the CSR fallback. The browser creates the
 * node normally, so its logic runs after hydration.
 */
function makeNodeInert(
  node: RuntimeNode,
  context: RuntimeNodeContext,
  opts: NodeDefinitionOptions,
  sharedInputs: SharedInputs
) {
  const noop = () => {};

  node._inputs = {};
  Object.keys(opts.inputs).forEach(function (name) {
    // Keep the type the shared entry saved (color/array coercion in
    // setInputValue reads it); the authored setter is what must not run.
    node._inputs[name] = { set: noop, type: sharedInputs[name] && sharedInputs[name].type };
  });

  Object.keys(opts.outputs).forEach(function (name) {
    const output = opts.outputs[name];
    node.registerOutput(name, { type: output.type, getter: () => undefined });
  });

  // Dynamic ports (numbered inputs, runtime-discovered): accept any input a
  // connection targets rather than running the author's registration code.
  node.registerInputIfNeeded = function (inputName: string) {
    if (!node.hasInput(inputName)) {
      node.registerInput(inputName, { set: noop });
    }
  };

  // Authored lifecycle must not run either (it is load-path code).
  if (node.nodeScopeDidInitialize) {
    node.nodeScopeDidInitialize = noop;
  }

  node._ssrDeferred = true;

  const ctx = context as { _ssrDeferredNodeTypes?: Set<string> };
  const seen = (ctx._ssrDeferredNodeTypes = ctx._ssrDeferredNodeTypes || new Set());
  if (!seen.has(opts.name)) {
    seen.add(opts.name);
    console.warn(
      `SSR: node type "${opts.name}" is client-only; instances render default values server-side and run in the browser after hydration.`
    );
  }
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
    searchTags: opts.searchTags,
    ssr: opts.ssr
  };

  opts._internal = opts._internal || {};

  //prototypeExtensions - old API
  //methods - new API
  opts.prototypeExtensions = opts.methods || opts.prototypeExtensions || {};
  opts.inputs = opts.inputs || {};
  opts.outputs = opts.outputs || {};
  opts.initialize = opts.initialize || function () {};

  // NDA-017 §2. Synthesised before `registerInputs` so the checkboxes are ordinary declared
  // inputs from here on — nothing downstream (metadata, the editor export, the catalog) has
  // to know they were generated. The governed port's own `displayName` is reused as the
  // checkbox's label, so the panel reads as a list of this node's inputs rather than as a
  // list of internal port names.
  if (opts.runOnValueChange) {
    const displayNames: Record<string, string> = {};
    opts.runOnValueChange.inputs.forEach(function (name) {
      const governed = opts.inputs[name];
      if (!governed) {
        throw new Error(
          'Node ' + opts.name + ' declares runOnValueChange for input ' + name + ', which it does not have'
        );
      }
      if (governed.displayName) displayNames[name] = governed.displayName;
    });
    Object.assign(opts.inputs, runOnChangeInputs(opts.runOnValueChange.inputs, displayNames));
  }

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

    if (metadata.ssr && metadata.ssr.compat === 'client-only' && isSSRServerContext(context)) {
      makeNodeInert(node, context, opts, inputs);
      node.nodeScope = nodeScope;
      initializeDefaultValues(node._inputValues, metadata.inputs);
      return node;
    }

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
