import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the String Mapper node.
 *
 * Two `numbered-inputs` families that must stay index-aligned: `inputs[n]` is the string
 * to match and `mappings[n]` is what it maps to, paired by position. The `index: 10` /
 * `index: 1001` port ordering is what keeps the two lists visually adjacent in the editor.
 */
interface StringMapperNodeInstance extends NodeInstance {
  _internal: {
    inputs: string[];
    mappings: string[];
    currentInputString?: string;
    defaultMapping?: string;
    mappedString?: string;
    hasScheduledFetch?: boolean;
  };
  doMapping(): void;
  scheduleMapping(): void;
}

const StringMapperNode: NodeDefinitionOptions = {
  name: 'String Mapper',
  docs: 'https://docs.noodl.net/nodes/string-manipulation/string-mapper',
  category: 'Utilities',
  initialize: function (this: StringMapperNodeInstance) {
    this._internal.inputs = [];
    this._internal.mappings = [];
  },
  getInspectInfo(this: StringMapperNodeInstance): InspectInfo {
    return this._internal.mappedString;
  },
  numberedInputs: {
    input: {
      type: 'string',
      displayPrefix: 'Input',
      group: 'Inputs',
      index: 10,
      createSetter(index: number) {
        return function (this: StringMapperNodeInstance, value: { toString(): string } | undefined) {
          this._internal.inputs[index] = value === undefined ? '' : value.toString();
          this.scheduleMapping();
        };
      }
    },
    output: {
      type: 'string',
      displayPrefix: 'Mapping',
      index: 1001,
      group: 'Mappings',
      createSetter(index: number) {
        return function (this: StringMapperNodeInstance, value: { toString(): string } | undefined) {
          this._internal.mappings[index] = value === undefined ? '' : value.toString();
          this.scheduleMapping();
        };
      }
    }
  },
  inputs: {
    inputString: {
      type: {
        name: 'string'
      },
      index: 1,
      displayName: 'Input String',
      description: 'The string to look up among the numbered inputs',
      set: function (this: StringMapperNodeInstance, value: { toString(): string } | undefined) {
        this._internal.currentInputString = value !== undefined ? value.toString() : undefined;
        this.scheduleMapping();
      }
    },
    defaultMapping: {
      type: 'string',
      displayName: 'Default',
      index: 1000,
      group: 'Mappings',
      description: 'Published when Input String matches none of the numbered inputs',
      set: function (this: StringMapperNodeInstance, value: string) {
        this._internal.defaultMapping = value;
        this.scheduleMapping();
      }
    }
  },
  outputs: {
    mappedString: {
      type: 'string',
      displayName: 'Mapped String',
      group: 'Value',
      description: 'The mapping paired with the input that matched, or Default when none did',
      getter: function (this: StringMapperNodeInstance) {
        return this._internal.mappedString;
      }
    }
  },
  prototypeExtensions: {
    doMapping: function (this: StringMapperNodeInstance) {
      this._internal.hasScheduledFetch = false;
      const idx = this._internal.inputs.indexOf(this._internal.currentInputString);
      if (idx !== -1) this._internal.mappedString = this._internal.mappings[idx];
      else this._internal.mappedString = this._internal.defaultMapping;

      this.flagOutputDirty('mappedString');
    },
    scheduleMapping: function (this: StringMapperNodeInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledFetch) {
        internal.hasScheduledFetch = true;
        this.scheduleAfterInputsHaveUpdated(this.doMapping.bind(this));
      }
    }
  }
};

const StringMapperNodeModule: NodeModule = {
  node: StringMapperNode
};

export = StringMapperNodeModule;
