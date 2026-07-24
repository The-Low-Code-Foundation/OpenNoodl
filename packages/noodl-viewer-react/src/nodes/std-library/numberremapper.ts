import type { InspectInfo, NodeDefinitionOptions, NodeInstance } from '@noodl/types';

interface NumberRemapperInstance extends NodeInstance {
  _internal: {
    _currentInputValue: number;
    _remappedValue: number;
    _minInputValue: number;
    _maxInputValue: number;
    _minOutputValue: number;
    _maxOutputValue: number;
    _clampOutput: boolean;
  };
  _calculateNewOutputValue(): void;
}

const NumberRemapperNode: NodeDefinitionOptions = {
  name: 'Number Remapper',
  docs: 'https://docs.noodl.net/nodes/math/number-remapper',
  category: 'Math',
  initialize: function (this: NumberRemapperInstance) {
    const internal = this._internal;
    internal._currentInputValue = 0;
    internal._remappedValue = 0;
    internal._minInputValue = 0;
    internal._maxInputValue = 0;
    internal._minOutputValue = 0;
    internal._maxOutputValue = 1;
    internal._clampOutput = true;
  },
  // Returns a bare number, which the editor's inspector popup renders as nothing —
  // see PLAT-003 NOTES §13. Kept as-is: correcting it changes what the editor shows.
  getInspectInfo(this: NumberRemapperInstance) {
    return this._internal._remappedValue as unknown as InspectInfo;
  },
  inputs: {
    inputValue: {
      group: 'Value to Remap',
      type: {
        name: 'number',
        allowConnectionOnly: true
      },
      default: 0,
      displayName: 'Input Value',
      set: function (this: NumberRemapperInstance, value: number) {
        this._internal._currentInputValue = value;
        this._calculateNewOutputValue();
      }
    },
    minInputValue: {
      group: 'Input Parameters',
      type: {
        name: 'number'
      },
      default: 0,
      displayName: 'Input Minimum',
      set: function (this: NumberRemapperInstance, value: number) {
        this._internal._minInputValue = value;
        this._calculateNewOutputValue();
      }
    },
    maxInputValue: {
      group: 'Input Parameters',
      type: {
        name: 'number'
      },
      default: 0,
      displayName: 'Input Maximum',
      set: function (this: NumberRemapperInstance, value: number) {
        this._internal._maxInputValue = value;
        this._calculateNewOutputValue();
      }
    },
    minOutputValue: {
      group: 'Output Parameters',
      type: {
        name: 'number'
      },
      default: 0,
      displayName: 'Output Minimum',
      set: function (this: NumberRemapperInstance, value: number) {
        this._internal._minOutputValue = value;
        this._calculateNewOutputValue();
      }
    },
    maxOutputValue: {
      group: 'Output Parameters',
      type: {
        name: 'number'
      },
      default: 1,
      displayName: 'Output Maximum',
      set: function (this: NumberRemapperInstance, value: number) {
        this._internal._maxOutputValue = value;
        this._calculateNewOutputValue();
      }
    },
    clamp: {
      group: 'Output Parameters',
      type: {
        name: 'boolean',
        allowEditOnly: true
      },
      default: true,
      displayName: 'Clamp Output',
      set: function (this: NumberRemapperInstance, value: unknown) {
        this._internal._clampOutput = value ? true : false;
        this._calculateNewOutputValue();
      }
    }
  },
  outputs: {
    remappedValue: {
      type: 'number',
      displayName: 'Remapped Value',
      group: 'Outputs',
      getter: function (this: NumberRemapperInstance) {
        return this._internal._remappedValue;
      }
    }
  },
  prototypeExtensions: {
    _calculateNewOutputValue: {
      value: function (this: NumberRemapperInstance) {
        let normalizedValue,
          _internal = this._internal;

        if (_internal._maxInputValue === _internal._minInputValue) {
          normalizedValue = 0;
        } else {
          normalizedValue =
            (_internal._currentInputValue - _internal._minInputValue) /
            (_internal._maxInputValue - _internal._minInputValue);
        }

        if (_internal._clampOutput) {
          normalizedValue = Math.max(0, Math.min(1, normalizedValue));
        }
        _internal._remappedValue =
          _internal._minOutputValue + normalizedValue * (_internal._maxOutputValue - _internal._minOutputValue);
        this.flagOutputDirty('remappedValue');
      }
    }
  }
};

export default {
  node: NumberRemapperNode
};
