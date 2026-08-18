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
import { narrowCompletedDescription } from './outcome';
import { inputNameForRunOnChangePort, runOnChangeInputs } from './run-on-value-change';

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
    //
    //NDA-014: `string` is here for the *outbound* half of the object/array <-> string
    //typecasts (`node.ts` setInputValue, PORT-TYPE-CONTRACT.md §"object → string"). That
    //branch keys off `inputTypeName === 'string'`, so while `string` was absent from this
    //list it could never be true for a declared port and the cast was unreachable on every
    //graph — the editor's typecast table permitted the connection, the value arrived, and a
    //Text node rendered `[object Object]`. Found by wiring it in the running editor; there
    //was no corpus row, so nothing was measuring the half that had been written.
    const typesToSaveInInput = ['color', 'textStyle', 'array', 'object', 'string'];

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

/**
 * CN-015 — say *which* definition, in *which* kit, was rejected.
 *
 * 🔴 **Both throws below were anonymous, and the `category` one takes down the
 * whole preview.** `registerModule` does not catch, so one kit node missing one
 * field means `reactMounted: false` and `rootChildren: 0` — a blank app whose
 * only signal was `Error: Node must have a category`, naming no kit, no node
 * and no file. s27 hit it and read it as a dead renderer; the editor's node
 * library then reads empty *because the viewer died*, which looks like a second
 * fault and is not one.
 *
 * The names were already here. `registerModule` stamps `node.module` with the
 * manifest name **before** calling `registerNode`, so by the time a kit's
 * definition reaches this function both the kit and (in the `category` case)
 * the node are in `opts` — `opts.name` is literally the next check.
 *
 * ⚠️ **Degrades rather than guesses.** A built-in is defined with no `module`,
 * so it gets the node name alone; a definition missing `name` is called "a
 * definition" and `registerModule` adds its position in the kit's `nodes` list.
 * The prefix is kept verbatim (`Node must have a category`) because it is the
 * string the extractor surfaces and existing callers match on.
 */
function describeDefinition(opts: NodeDefinitionOptions): string {
  const parts: string[] = [];
  // A definition missing its `name` has nothing to be called; `registerModule`
  // supplies its position in the kit's `nodes` list, which is the only locator
  // left in exactly that case.
  parts.push(opts.name ? `node "${opts.name}"` : 'a definition');
  // 'Unknown Module' is `registerModule`'s own fallback for a kit whose
  // manifest name never arrived — passing it through says more than dropping it.
  if (opts.module) parts.push(`in kit "${opts.module}"`);
  return ` — ${parts.join(' ')}`;
}

/**
 * The consequence, stated only where it is true. A built-in throwing is a bug in
 * this repository, not something an author can act on, so it gets no advice.
 *
 * 🔴 **This sentence changed with ✅ D20 and had to.** It used to end *"and the
 * preview renders nothing at all"*, which was accurate: the throw aborted
 * `registerModule` mid-loop and the viewer never mounted. D20 made a kit's
 * failure cost the kit, so that clause became a confident wrong answer — the
 * exact shape of "shipping a capability turns a diagnostic into a lie". The
 * blast radius is now the kit, and the message says the kit.
 */
function definitionFixHint(opts: NodeDefinitionOptions, field: string): string {
  if (!opts.module) return '';
  return (
    ` Add a \`${field}\` to its definition: without one NONE of this kit's nodes register,` +
    ' so every node from it is missing from the app. The rest of the app still runs.'
  );
}

function defineNode(opts: NodeDefinitionOptions): NodeDefinition {
  if (!opts.category) {
    throw new Error(`Node must have a category${describeDefinition(opts)}.${definitionFixHint(opts, 'category')}`);
  }

  if (!opts.name) {
    throw new Error(`Node must have a name${describeDefinition(opts)}.${definitionFixHint(opts, 'name')}`);
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
    // D10: a kit's documentation URL, kept apart from `docs` because that field
    // is prose on a kit node and a URL on a shipped one.
    docsUrl: opts.docsUrl,
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
    const governedNames: string[] = [];
    const displayNames: Record<string, string> = {};

    (opts.runOnValueChange.inputs || []).forEach(function (name) {
      const governed = opts.inputs[name];
      if (!governed) {
        throw new Error(
          'Node ' + opts.name + ' declares runOnValueChange for input ' + name + ', which it does not have'
        );
      }
      governedNames.push(name);
      if (governed.displayName) displayNames[name] = governed.displayName;
    });

    // Sources are not ports, so there is nothing to check them against and nothing to borrow
    // a label from — see the field's documentation for why they exist at all.
    (opts.runOnValueChange.sources || []).forEach(function (source) {
      governedNames.push(source.name);
      displayNames[source.name] = source.displayName;
    });

    Object.assign(opts.inputs, runOnChangeInputs(governedNames, displayNames));
  }

  // FH-022. The outcome contract's `Completed` says so when it is the node's only outcome, and
  // this is the first point at which that is knowable: `outcomeOutputs` sees only its own
  // options, and four nodes declare `failure` beside the helper rather than through it. Applied
  // to `opts.outputs` rather than to `metadata`, so the definition and the metadata carry the
  // same sentence. Same shape as the `runOnValueChange` synthesis above — nothing downstream
  // has to know the wording was narrowed here.
  narrowCompletedDescription(opts.outputs);

  let inputs: SharedInputs = {};

  registerInputs(inputs, metadata, opts.inputs);
  registerOutputsMetadata(metadata, opts.outputs);
  function NodeConstructor(this: RuntimeNode, context: RuntimeNodeContext, id: string) {
    Node.call(this, context, id);
  }

  const prototypeExtensions: PrototypeExtensions = opts.prototypeExtensions;

  /**
   * The descriptor map, built fresh rather than by mutating `opts`.
   *
   * ⚠️ **Two bugs here, both surfaced by NDA-017 §2 and both older than it.**
   *
   * `Object.create` defaults a descriptor to non-writable and non-configurable, so a method
   * declared in `methods:` landed on the prototype frozen. Nothing wanted that — it is what
   * you get from hand-writing a descriptor and filling in only `value` — and it meant
   * `registerNumberedInput` and `makeNodeInert`, which both assign over
   * `registerInputIfNeeded`, worked only on nodes that did *not* declare one. These are
   * ordinary methods and now get ordinary method semantics.
   *
   * And this loop used to **mutate `opts.prototypeExtensions` in place**, replacing each
   * function with its descriptor. That made `defineNode` non-idempotent: a second call on the
   * same module object — which the corpus does whenever two graphs register the same node —
   * saw descriptors already in place, skipped the wrap, and reused the frozen ones. The
   * symptom was `Cannot redefine property` from a line six hundred lines away.
   *
   * ⚠️ And the same accident has a second spelling: `eventsender.ts` writes its
   * `registerInputIfNeeded` as a hand-rolled `{ value: fn }` descriptor rather than a bare
   * function. A data descriptor with only `value` is frozen for exactly the same reason, so
   * the flags are defaulted on those too — but only where the author did not state them, so a
   * deliberate freeze stays deliberate. Accessor descriptors are untouched.
   */
  const prototypeDescriptors: PropertyDescriptorMap = {};
  Object.keys(prototypeExtensions).forEach(function (propName) {
    const declared = prototypeExtensions[propName] as PropertyDescriptor;
    if (!declared.value) {
      prototypeDescriptors[propName] = { value: prototypeExtensions[propName], writable: true, configurable: true };
      return;
    }
    prototypeDescriptors[propName] = {
      ...declared,
      writable: declared.hasOwnProperty('writable') ? declared.writable : true,
      configurable: declared.hasOwnProperty('configurable') ? declared.configurable : true
    };
  });

  NodeConstructor.prototype = Object.create(Node.prototype, prototypeDescriptors);
  Object.defineProperty(NodeConstructor.prototype, 'name', {
    value: opts.name
  });

  if (opts.getInspectInfo) NodeConstructor.prototype.getInspectInfo = opts.getInspectInfo;
  if (opts.nodeScopeDidInitialize) NodeConstructor.prototype.nodeScopeDidInitialize = opts.nodeScopeDidInitialize;

  /**
   * NDA-017 §2 — claim `runOnChange-…` before the node's own dynamic-port handler sees it.
   *
   * ⚠️ **Found in the running editor, and it could not have been found anywhere else.** A
   * saved `runOnChange-a` parameter is applied to the node *before* the port it governs
   * exists, so it reaches `registerInputIfNeeded` — and Expression's override registers any
   * unrecognised name as a discovered expression input. The result on an Expression with one
   * box unticked:
   *
   * - the `false` landed in `_internal.scope` instead of `_runOnValueChange`, so the untick
   *   did nothing;
   * - `registerRunOnValueChangeInput` then found the name taken and returned, so the real
   *   checkbox was never registered either;
   * - and `_compileFunction` builds its argument list from `Object.keys(scope)`, so the
   *   Function constructor got `runOnChange-a` as a parameter name, threw, and **the node
   *   evaluated to 0 from then on**. Unticking a box broke the node outright.
   *
   * The corpus missed it because a test sets the checkbox with `setInputValue` on a graph
   * that has already been built, by which time the real port exists. Only a *saved project*
   * applies the parameter first.
   *
   * Wrapped rather than left to each node to remember, for the same reason
   * {@link registerNumberedInput} wraps: there are four dynamic-port families in the class
   * today and the next one would have to know about a rule nothing enforces.
   */
  // `defineProperty`, not assignment: `Object.create` above installs the node's own
  // `registerInputIfNeeded` from a descriptor with no `writable`, so plain assignment throws
  // `Cannot assign to read only property` on exactly the nodes that need wrapping.
  const declaredRegisterInputIfNeeded = NodeConstructor.prototype.registerInputIfNeeded;
  Object.defineProperty(NodeConstructor.prototype, 'registerInputIfNeeded', {
    value: function (this: RuntimeNode, name: string) {
      const governed = inputNameForRunOnChangePort(name);
      if (governed !== undefined) {
        this.registerRunOnValueChangeInput(governed);
        return;
      }
      declaredRegisterInputIfNeeded.call(this, name);
    },
    // Both flags are load-bearing, and leaving them off broke four suites at once.
    // `registerNumberedInput` and `makeNodeInert` both *assign* over
    // `registerInputIfNeeded` — on the instance and on the prototype respectively — and a
    // non-writable prototype property makes an instance assignment throw in strict mode.
    // The wrapper has to be as replaceable as the method it wraps.
    writable: true,
    configurable: true
  });

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
