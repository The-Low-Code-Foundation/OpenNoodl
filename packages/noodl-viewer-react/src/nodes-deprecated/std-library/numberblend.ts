'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import EaseCurves from '../../easecurves';

/** `this` inside the Number Blend node. */
interface NumberBlendNodeInstance extends NodeInstance {
  _internal: {
    /** One entry per numbered `input N` port, indexed by that number. */
    inputs: number[];
    blendValue: number;
    result: number;
    clamp: boolean;
  };
  updateResult(): void;
}

const NumberBlend: NodeDefinitionOptions = {
  name: 'Number Blend',
  docs: 'https://docs.noodl.net/nodes/interpolation/number-blend',
  category: 'Interpolation',
  deprecated: true,
  initialize: function (this: NumberBlendNodeInstance) {
    const internal = this._internal;
    internal.inputs = [];
    internal.blendValue = 0;
    internal.result = 0;
    internal.clamp = false;
  },
  getInspectInfo(this: NumberBlendNodeInstance): InspectInfo {
    // Wrapped as a value entry. Returning the bare number rendered as *nothing* in
    // the editor's inspector popup — the §13.3 defect, and the compiler will not
    // accept it now that the definition is annotated. Same correction DEBT-006
    // applied to `variablenode2`.
    return [{ type: 'value', value: this._internal.result }];
  },
  prototypeExtensions: {
    updateResult: function (this: NumberBlendNodeInstance) {
      const inputs = this._internal.inputs;

      if (inputs.length === 0) {
        return 0;
      }

      let index = Math.floor(this._internal.blendValue),
        t = this._internal.blendValue - index;

      if (index >= inputs.length - 1) {
        if (this._internal.clamp) {
          index = inputs.length - 1;
          t = 0;
        } else {
          t += index - (inputs.length - 1);
          index = inputs.length - 1;
        }
      } else if (index <= 0) {
        if (this._internal.clamp) {
          index = 0;
          t = 0;
        } else {
          t += index;
          index = 0;
        }
      }

      if (t === 0 || inputs.length === 1) {
        this._internal.result = inputs[index];
      } else if (index === inputs.length - 1 && t > 0) {
        this._internal.result = EaseCurves.linear(inputs[index - 1], inputs[index], t + 1);
      } else {
        this._internal.result = EaseCurves.linear(inputs[index], inputs[index + 1], t);
      }

      this.flagOutputDirty('result');
    }
  },
  numberedInputs: {
    input: {
      type: 'number',
      displayPrefix: 'Number',
      createSetter(index: number) {
        return function (this: NumberBlendNodeInstance, value: number) {
          const inputs = this._internal.inputs;

          if (inputs[index] === value) {
            return;
          }

          inputs[index] = value || 0;
          this.updateResult();
        };
      }
    }
  },
  inputs: {
    blendValue: {
      type: 'number',
      displayName: 'Blend Value',
      description: 'Position along the number list, where 1 is exactly Number 1 and 1.5 is halfway to Number 2',
      default: 0,
      set: function (this: NumberBlendNodeInstance, value: number) {
        this._internal.blendValue = value;
        this.updateResult();
      }
    },
    clamp: {
      type: 'boolean',
      displayName: 'Clamp',
      description: 'Holds Blend Value inside the list rather than extrapolating past either end',
      default: false,
      set: function (this: NumberBlendNodeInstance, value: unknown) {
        this._internal.clamp = value ? true : false;
        this.updateResult();
      }
    }
  },
  outputs: {
    result: {
      type: 'number',
      displayName: 'Result',
      description: 'The interpolated number',
      getter: function (this: NumberBlendNodeInstance) {
        return this._internal.result;
      }
    }
  }
};

const NumberBlendModule: NodeModule = {
  node: NumberBlend
};

export default NumberBlendModule;
