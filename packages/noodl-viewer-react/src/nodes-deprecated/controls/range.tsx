import React, { useEffect, useState } from 'react';

import guid from '../../guid';
import Layout from '../../layout';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition, type StyleObject } from '../../react-component-node';
import type { Noodl } from '../../types';
import Utils from './utils';

interface RangeProps extends Noodl.ReactProps {
  id?: string;
  /** The node's own id, used to give each instance its own generated class. */
  _nodeId?: string;
  enabled?: boolean;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  /** Installed by `initialize`, not by a port — this is how the control reports back. */
  valueChanged?: (value: string | number) => void;

  thumbWidth?: string;
  thumbHeight?: string;
  thumbColor?: string;
  thumbRadius?: string;
  trackHeight?: string;
  trackColor?: string;
}

function _styleTemplate(_class: string, props: Partial<RangeProps>) {
  return `
    .${_class}::-webkit-slider-thumb {
        width: ${props.thumbWidth};
        height: ${props.thumbHeight};
        background: ${props.thumbColor};
        border: 0;
        border-radius: ${props.thumbRadius};
        cursor: pointer;
        -webkit-appearance: none;
        margin-top:calc(${props.trackHeight}/2 - ${props.thumbHeight}/2);
    }
    
    .${_class}::-moz-range-thumb {
        width: ${props.thumbWidth};
        height: ${props.thumbHeight};
        background: ${props.thumbColor};
        border: none;
        border-radius: ${props.thumbRadius};
        cursor: pointer;
    }
    
    .${_class}::-ms-thumb {
        width: ${props.thumbWidth};
        height: ${props.thumbHeight};
        background: ${props.thumbColor};
        border: none;
        border-radius: ${props.thumbRadius};
        cursor: pointer;
        margin-top: 0px;
    }
    
    .${_class}::-webkit-slider-runnable-track {
        background: ${props.trackColor};
        border: none;
        width: 100%;
        height: ${props.trackHeight};
        cursor: pointer;
        margin-top:0px;
    }
    
    .${_class}:focus::-webkit-slider-runnable-track {
        background: ${props.trackColor};
    }
    
    .${_class}::-moz-range-track {
        background: ${props.trackColor};
        border: none;
        width: 100%;
        height: ${props.trackHeight};
        cursor: pointer;
    }
    
    .${_class}::-ms-track {
        background: transparent;
        border:none;
        color: transparent;
        width: 100%;
        height: ${props.trackHeight};
        cursor: pointer;
    }
    
    .${_class}::-ms-fill-lower {
        background: ${props.trackColor};
        border: none;
    }
    .${_class}::-ms-fill-upper {
        background: ${props.trackColor};
        border: none;
    }    
    `;
}

// --------------------------------------------------------------------------------------
// Range
// --------------------------------------------------------------------------------------
function Range(props: RangeProps) {
  const [value, setValue] = useState(props.value);

  // Report initial values when mounted
  useEffect(() => {
    setValue(props.value);
  }, []);

  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  const style: StyleObject = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  const tagProps = { id: props.id, min: props.min, max: props.max, step: props.step, style: style };

  Utils.updateStylesForClass('ndl-controls-range-' + props._nodeId, props, _styleTemplate);

  let className = 'ndl-controls-range-' + props._nodeId + ' ndl-controls-range';
  if (props.className) className = className + ' ' + props.className;

  return (
    <input
      className={className}
      {...Utils.controlEvents(props)}
      type="range"
      {...tagProps}
      value={value}
      disabled={!props.enabled}
      onChange={(e) => {
        setValue(e.target.value);
        props.valueChanged && props.valueChanged(e.target.value);
      }}
    ></input>
  );
}

const RangeNode: ReactNodeDefinition = {
  name: 'Range',
  docs: 'https://docs.noodl.net/nodes/visual/range',
  allowChildren: false,
  noodlNodeAsProp: true,
  initialize() {
    this.props.sizeMode = 'explicit';
    this.props.id = this._internal.controlId = 'input-' + guid();
    this.props.enabled = this._internal.enabled = true;
    this._internal.value = this.props.value = this.props.min;
    this.props._nodeId = this.id;
    this.props.valueChanged = (value: string | number) => {
      value = typeof value === 'string' ? parseFloat(value) : value;
      const valueChanged = this._internal.value !== value;
      this._internal.value = value;

      this._updateValuePercent(value);

      if (valueChanged) {
        this.flagOutputDirty('value');
        this.sendSignalOnOutput('onChange');
      }
    };
    this.props.valueChanged(this.props.value); // Update initial values

    this.outputPropValues.hoverState = this.outputPropValues.focusState = this.outputPropValues.pressedState = false;
  },
  getReactComponent() {
    return Range;
  },
  inputs: {
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'General',
      default: true,
      set: function (value) {
        value = !!value;
        const changed = value !== this._internal.enabled;
        this.props.enabled = this._internal.enabled = value;

        if (changed) {
          this.forceUpdate();
          this.flagOutputDirty('enabled');
        }
      }
    },
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'General',
      set: function (value) {
        const changed = value !== this._internal.value;
        this.props.value = this._internal.value = value;
        this._updateValuePercent(value);

        if (changed) {
          this.forceUpdate();
          this.flagOutputDirty('value');
        }
      }
    }
  },
  outputs: {
    controlId: {
      type: 'string',
      displayName: 'Control Id',
      group: 'General',
      getter: function () {
        return this._internal.controlId;
      }
    },
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'States',
      getter: function () {
        return this._internal.enabled;
      }
    },
    value: {
      type: 'number',
      displayName: 'Value',
      group: 'States',
      getter: function () {
        return this._internal.value;
      }
    },
    valuePercent: {
      type: 'number',
      displayName: 'Value Percent',
      group: 'States',
      getter: function () {
        return this._internal.valuePercent;
      }
    },
    onChange: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    }
  },
  inputProps: {
    min: { type: 'number', displayName: 'Min', group: 'General', default: 0 },
    max: { type: 'number', displayName: 'Max', group: 'General', default: 100 },
    step: { type: 'number', displayName: 'Step', group: 'General', default: 1 },
    width: {
      index: 11,
      group: 'Dimensions',
      displayName: 'Width',
      type: {
        name: 'number',
        units: ['%', 'px', 'vw'],
        defaultUnit: '%'
      },
      default: 100
    },
    height: {
      index: 12,
      group: 'Dimensions',
      displayName: 'Height',
      type: {
        name: 'number',
        units: ['%', 'px', 'vh'],
        defaultUnit: '%'
      },
      default: 100
    },

    // Styles
    thumbWidth: {
      group: 'Thumb Style',
      displayName: 'Width',
      type: {
        name: 'number',
        units: ['px', 'vw', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 16
    },
    thumbHeight: {
      group: 'Thumb Style',
      displayName: 'Height',
      type: {
        name: 'number',
        units: ['px', 'vh', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 16
    },
    thumbRadius: {
      group: 'Thumb Style',
      displayName: 'Radius',
      type: {
        name: 'number',
        units: ['px', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 8
    },
    thumbColor: {
      group: 'Thumb Style',
      displayName: 'Color',
      type: { name: 'color', allowEditOnly: true },
      default: '#000000'
    },
    trackHeight: {
      group: 'Track Style',
      displayName: 'Height',
      type: {
        name: 'number',
        units: ['px', 'vh', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 6
    },
    trackColor: {
      group: 'Track Style',
      displayName: 'Color',
      type: { name: 'color', allowEditOnly: true },
      default: '#f0f0f0'
    }
  },
  inputCss: {
    backgroundColor: {
      index: 201,
      displayName: 'Background Color',
      group: 'Style',
      type: 'color'
    },

    // Border styles
    borderRadius: {
      index: 202,
      displayName: 'Border Radius',
      group: 'Style',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      default: 1,
      applyDefault: false
    },
    borderStyle: {
      index: 203,
      displayName: 'Border Style',
      group: 'Style',
      type: {
        name: 'enum',
        enums: [
          { label: 'None', value: 'none' },
          { label: 'Solid', value: 'solid' },
          { label: 'Dotted', value: 'dotted' },
          { label: 'Dashed', value: 'dashed' }
        ]
      },
      default: 'none',
      applyDefault: false
    },
    borderWidth: {
      index: 204,
      displayName: 'Border Width',
      group: 'Style',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      default: 1,
      applyDefault: false
    },
    borderColor: {
      index: 205,
      displayName: 'Border Color',
      group: 'Style',
      type: 'color',
      default: '#000000'
    }
  },
  outputProps: {},
  methods: {
    _updateValuePercent(value: number) {
      const min = this.props.min;
      const max = this.props.max;
      const valuePercent = Math.floor(((value - min) / (max - min)) * 100);
      // `valuePercentChanged` is never assigned anywhere — this reads `undefined`
      // every time, so the comparison is always true and `valuePercent` is flagged
      // dirty on every call. Kept verbatim: correcting it to `valuePercent` would
      // change how often the output fires.
      const valuePercentChanged = this._internal.valuePercentChanged !== valuePercent;

      this._internal.valuePercent = valuePercent;
      valuePercentChanged && this.flagOutputDirty('valuePercent');
    }
  }
};

NodeSharedPortDefinitions.addAlignInputs(RangeNode);
NodeSharedPortDefinitions.addTransformInputs(RangeNode);
NodeSharedPortDefinitions.addMarginInputs(RangeNode);
NodeSharedPortDefinitions.addSharedVisualInputs(RangeNode);
Utils.addControlEventsAndStates(RangeNode);

export default createNodeFromReactComponent(RangeNode);
