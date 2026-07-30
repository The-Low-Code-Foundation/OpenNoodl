'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Substring node.
 *
 * The result is computed lazily in the getter and cached, so `resultDirty` is what makes
 * the three setters cheap — they only mark, they never recompute.
 */
interface SubStringNodeInstance extends NodeInstance {
  _internal: {
    startIndex: number;
    /** `-1` means "to the end of the string", not "one before the end". */
    endIndex: number;
    cachedResult: string;
    inputString: string;
    resultDirty: boolean;
  };
}

const SubStringNode: NodeDefinitionOptions = {
  name: 'Substring',
  docs: 'https://docs.noodl.net/nodes/string-manipulation/substring',
  category: 'String Manipulation',
  initialize: function (this: SubStringNodeInstance) {
    const internal = this._internal;
    internal.startIndex = 0;
    internal.endIndex = -1;
    internal.cachedResult = '';
    internal.inputString = '';
    internal.resultDirty = false;
  },
  inputs: {
    start: {
      type: 'number',
      displayName: 'Start',
      description: 'Position of the first character to keep, counting from zero; a negative value counts back from the end',
      default: 0,
      set: function (this: SubStringNodeInstance, value: number) {
        this._internal.startIndex = value;
        this._internal.resultDirty = true;
        this.flagOutputDirty('result');
      }
    },
    end: {
      type: 'number',
      displayName: 'End',
      description: 'Position to stop before; leave it unset to run to the end of the string, since setting it to 0 yields nothing',
      default: 0,
      set: function (this: SubStringNodeInstance, value: number) {
        this._internal.endIndex = value;
        this._internal.resultDirty = true;
        this.flagOutputDirty('result');
      }
    },
    string: {
      type: {
        name: 'string'
      },
      displayName: 'String',
      description: 'Text to take the substring from; it must not be cleared to null, which raises an error rather than yielding an empty result',
      default: '',
      // `value.toString()`, not `String(value)`: the two differ on `null`/`undefined`,
      // where the original throws rather than yielding `"null"`. Typed as the structural
      // requirement so the call survives without widening what the port accepts.
      set: function (this: SubStringNodeInstance, value: { toString(): string }) {
        this._internal.inputString = value.toString();
        this._internal.resultDirty = true;
        this.flagOutputDirty('result');
      }
    }
  },
  outputs: {
    result: {
      type: 'string',
      displayName: 'Result',
      description: 'The section of String between Start and End',
      getter: function (this: SubStringNodeInstance) {
        const internal = this._internal;

        if (internal.resultDirty) {
          if (internal.endIndex === -1) {
            internal.cachedResult = internal.inputString.substr(internal.startIndex);
          } else {
            internal.cachedResult = internal.inputString.substr(
              internal.startIndex,
              internal.endIndex - internal.startIndex
            );
          }
          internal.resultDirty = false;
        }
        return internal.cachedResult;
      }
    }
  }
};

const SubStringNodeModule: NodeModule = {
  node: SubStringNode
};

export = SubStringNodeModule;
