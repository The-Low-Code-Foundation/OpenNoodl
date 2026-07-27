import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * `this` inside the String Format node.
 *
 * The port set is `runtime-discovered`: `registerInputIfNeeded` is overridden so every
 * `{placeholder}` in the format string becomes an input port. `setup` below mirrors the
 * same parse editor-side, which is what puts the ports on the node before it ever runs.
 */
interface StringFormatNodeInstance extends NodeInstance {
  _internal: {
    format: string;
    cachedResult: string;
    resultDirty: boolean;
    inputValues: Record<string, unknown>;
  };
  /** Note: lives on the instance, not in `_internal`, unlike the rest of this node's state. */
  formatScheduled?: boolean;
  formatValue(): string;
  scheduleFormat(): void;
}

const StringFormatDefinition: NodeDefinitionOptions = {
  name: 'String Format',
  docs: 'https://docs.noodl.net/nodes/string-manipulation/string-format',
  category: 'String Manipulation',
  usePortAsLabel: 'format',
  portLabelTruncationMode: 'length',
  initialize(this: StringFormatNodeInstance) {
    const internal = this._internal;
    internal.format = '';
    internal.cachedResult = '';
    internal.resultDirty = false;
    internal.inputValues = {};
  },
  getInspectInfo(this: StringFormatNodeInstance): InspectInfo {
    return this.formatValue();
  },
  inputs: {
    format: {
      type: { name: 'string', multiline: true },
      displayName: 'Format',
      set(this: StringFormatNodeInstance, value: string) {
        if (this._internal.format === value) return;

        this._internal.format = value;
        this._internal.resultDirty = true;
        this.scheduleFormat();
      }
    }
  },
  outputs: {
    formatted: {
      type: 'string',
      displayName: 'Formatted',
      get(this: StringFormatNodeInstance) {
        return this.formatValue();
      }
    }
  },
  methods: {
    formatValue(this: StringFormatNodeInstance) {
      const internal = this._internal;

      if (internal.resultDirty) {
        let formatted = internal.format;

        const matches = internal.format.match(/\{[A-Za-z0-9_]*\}/g);
        let inputs: string[] = [];
        if (matches) {
          inputs = matches.map(function (name) {
            return name.replace('{', '').replace('}', '');
          });
        }

        inputs.forEach(function (name) {
          const v = internal.inputValues[name];
          // `replace` with a string pattern substitutes the *first* occurrence only, so a
          // placeholder repeated in one format string fills only once. Kept verbatim.
          formatted = formatted.replace('{' + name + '}', v !== undefined ? String(v) : '');
        });

        internal.cachedResult = formatted;
        internal.resultDirty = false;
      }

      return internal.cachedResult;
    },
    registerInputIfNeeded(this: StringFormatNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    },
    scheduleFormat(this: StringFormatNodeInstance) {
      if (this.formatScheduled) return;

      this.formatScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.formatValue();
        this.flagOutputDirty('formatted');
        this.formatScheduled = false;
      });
    }
  }
};

function userInputSetter(this: StringFormatNodeInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  if (this._internal.inputValues[name] === value) return;

  this._internal.inputValues[name] = value;
  this._internal.resultDirty = true;
  this.scheduleFormat();
}

function updatePorts(id: string, format: string, editorConnection: EditorConnectionLike) {
  const inputs = format.match(/\{[A-Za-z0-9_]*\}/g) || [];
  const portsNames = inputs.map(function (def) {
    return def.replace('{', '').replace('}', '');
  });

  const ports = portsNames
    //get unique names
    .filter(function (value, index, self) {
      return self.indexOf(value) === index;
    })
    //and map names to ports
    .map(function (name) {
      return {
        name: name,
        type: 'string',
        plug: 'input'
      };
    });

  editorConnection.sendDynamicPorts(id, ports);
}

const StringFormatNodeModule: NodeModule = {
  node: StringFormatDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.String Format', function (node: GraphNodeModel) {
      if (node.parameters.format) {
        updatePorts(node.id, node.parameters.format as string, context.editorConnection);
      }
      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'format') {
          updatePorts(node.id, node.parameters.format as string, context.editorConnection);
        }
      });
    });
  }
};

export = StringFormatNodeModule;
