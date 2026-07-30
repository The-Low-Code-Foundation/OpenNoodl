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
    /**
     * NDA-012 (Math) — 1, not 0, and the port's declared `default` below has to agree.
     *
     * With both input endpoints at 0 the degenerate branch in `_calculateNewOutputValue` takes
     * `normalizedValue = 0`, so `Remapped Value` was `Output Minimum` for every input, forever, and
     * nothing said so. That is the Expression-returns-`0` shape — a failure value indistinguishable
     * from a legitimate answer — sitting in the **default** configuration, so every freshly dropped
     * node was in it.
     *
     * Reporting it instead would be the wrong repair: an unconfigured node is degenerate for the
     * whole boot path, so a `Failure` here would fire on a graph the author is still building. The
     * fix is a default that is not a lie — 0..1 onto the `Output Minimum`/`Output Maximum` defaults
     * of 0..1, i.e. a fresh node passes its input through (clamped) rather than flatlining.
     *
     * ⚠️ `initialize` is what decides this, not the `default:` on the port. A declared default does
     * not run its setter at construction (the control row in the Logic worksheet pins that), so the
     * runtime value of an unset port is whatever this function put there. The two are set together
     * only so the property panel and the running node agree.
     */
    internal._maxInputValue = 1;
    internal._minOutputValue = 0;
    internal._maxOutputValue = 1;
    internal._clampOutput = true;
  },
  getInspectInfo(this: NumberRemapperInstance): InspectInfo {
    // Wrapped as a value entry — a bare number renders as nothing in the
    // editor's inspector popup (DEBT-006, PLAT-003 NOTES §13.3).
    return [{ type: 'value', value: this._internal._remappedValue }];
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
      description: 'Number to remap, read against Input Minimum and Input Maximum',
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
      description: 'Value of Input Value that maps to Output Minimum',
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
      default: 1,
      displayName: 'Input Maximum',
      description:
        'Value of Input Value that maps to Output Maximum; set equal to Input Minimum and the result is pinned at Output Minimum for every input',
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
      description: 'Result when Input Value is at Input Minimum',
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
      description: 'Result when Input Value is at Input Maximum',
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
      description: 'Holds the result inside the output range when Input Value falls outside the input range, instead of extrapolating',
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
      description: 'Input Value rescaled from the input range onto the output range',
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
