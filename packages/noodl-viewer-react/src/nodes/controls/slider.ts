import { Slider } from '../../components/controls/Slider';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import Utils from './utils';

const thumbPopout = { group: 'thumb-styles', label: 'Thumb Styles' };
const trackPopout = { group: 'track-styles', label: 'Track Styles' };

const RangeNode = {
  name: 'net.noodl.controls.range',
  displayNodeName: 'Slider',
  docs: 'https://docs.noodl.net/nodes/ui-controls/slider',
  allowChildren: false,
  noodlNodeAsProp: true,
  connectionPanel: {
    groupPriority: [
      'General',
      'Style',
      'Actions',
      'Events',
      'States',
      'Mounted',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },
  initialize() {
    this.props.sizeMode = 'contentHeight';
    this.props.id = 'input-' + guid();

    this.props.value = this.props.min;
    this._internal.outputValue = 0;

    this.props._nodeId = this.id;

    //this is used by the range to communicate with the node whenever the range changes value
    this.props.updateOutputValue = (value: string | number) => {
      value = typeof value === 'string' ? parseFloat(value) : value;

      const valueChanged = this._internal.outputValue !== value;
      if (valueChanged) {
        this._internal.outputValue = value;
        this.flagOutputDirty('value');
        this._updateOutputValuePercent(value);
        this.sendSignalOnOutput('onChange');
      }

      // On first mount, output the initial percentage.
      if (!this._internal.valuePercent) {
        this._updateOutputValuePercent(value);
      }
    };

    this.props.updateOutputValue(this.props.value); // Set the value output to an initial value
  },
  getReactComponent() {
    return Slider;
  },
  inputs: {
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'General',
      description:
        'Moves the handle to this value, clamped to Min and Max; changing it from the graph does not fire Changed',
      index: 100,
      set(value) {
        this._setInputValue(value);
      }
    }
  },
  outputs: {
    value: {
      type: 'number',
      displayName: 'Value',
      group: 'States',
      description: 'The value the handle is currently at, between Min and Max, as a number',
      get() {
        return this._internal.outputValue;
      }
    },
    valuePercent: {
      type: 'number',
      displayName: 'Value Percent',
      group: 'States',
      description: 'Where the handle sits as a whole number from 0 to 100, regardless of Min and Max',
      get() {
        return this._internal.valuePercent;
      }
    },
    onChange: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when the user moves the handle; a value arriving on the Value input does not fire it'
    }
  },
  inputProps: {
    min: {
      type: 'number',
      displayName: 'Min',
      group: 'General',
      description: 'Value at the far left of the track; the current value is clamped up to it if it is below',
      default: 0,
      index: 100,
      onChange() {
        this._setInputValue(this.props.value);
      }
    },
    max: {
      type: 'number',
      displayName: 'Max',
      group: 'General',
      description: 'Value at the far right of the track; the current value is clamped down to it if it is above',
      default: 100,
      index: 100,
      onChange() {
        this._setInputValue(this.props.value);
      }
    },
    step: {
      type: 'number',
      displayName: 'Step',
      group: 'General',
      description: 'Smallest amount the handle can move by, so the value lands on multiples of it',
      default: 1,
      index: 100
    },
    width: {
      index: 11,
      group: 'Dimensions',
      displayName: 'Width',
      description: 'Overall width of the slider, which is the length of the track plus the handle',
      type: {
        name: 'number',
        units: ['%', 'px', 'vw'],
        defaultUnit: '%'
      },
      default: 100,
      allowVisualStates: true
    },
    // Styles
    thumbWidth: {
      group: 'Thumb Style',
      displayName: 'Width',
      description: 'Width of the handle the user drags',
      type: {
        name: 'number',
        units: ['px', 'vw', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 16,
      popout: thumbPopout,
      allowVisualStates: true
    },
    thumbHeight: {
      group: 'Thumb Style',
      displayName: 'Height',
      description: 'Height of the handle the user drags',
      type: {
        name: 'number',
        units: ['px', 'vh', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 16,
      popout: thumbPopout,
      allowVisualStates: true
    },
    thumbColor: {
      group: 'Thumb Style',
      displayName: 'Color',
      description: 'Fill colour of the handle',
      type: { name: 'color', allowEditOnly: true },
      default: '#000000',
      popout: thumbPopout,
      allowVisualStates: true
    },
    trackHeight: {
      group: 'Track Style',
      displayName: 'Height',
      description: 'Thickness of the bar the handle slides along',
      type: {
        name: 'number',
        units: ['px', 'vh', '%'],
        defaultUnit: 'px',
        allowEditOnly: true
      },
      default: 6,
      popout: trackPopout,
      allowVisualStates: true
    },
    trackColor: {
      group: 'Track Style',
      displayName: 'Inactive Color',
      description: 'Colour of the part of the track the handle has not reached yet',
      type: { name: 'color', allowEditOnly: true },
      default: '#f0f0f0',
      popout: trackPopout,
      allowVisualStates: true
    },
    trackActiveColor: {
      group: 'Track Style',
      displayName: 'Active Color',
      description: 'Colour of the part of the track between Min and the handle',
      type: { name: 'color', allowEditOnly: true },
      default: '#f0f0f0',
      popout: trackPopout,
      allowVisualStates: true
    }
  },
  methods: {
    _updateOutputValuePercent(value: number) {
      const min = this.props.min;
      const max = this.props.max;
      const valuePercent = Math.floor(((value - min) / (max - min)) * 100);
      const valuePercentChanged = this._internal.valuePercentChanged !== valuePercent;

      this._internal.valuePercent = valuePercent;
      valuePercentChanged && this.flagOutputDirty('valuePercent');
    },
    _setInputValue(newValue) {
      //make sure value never goes out of range
      const value = Math.max(this.props.min, Math.min(this.props.max, newValue || 0));

      const changed = value !== this.props.value;

      if (changed) {
        this.props.value = value;
        this.forceUpdate();
      }
    }
  }
};

//Add borders
function addBorderInputs(definition, opts) {
  opts = opts || {};
  const defaults = opts.defaults || {};
  const popout = opts.popout;

  defaults.borderStyle = 'none';
  defaults.borderWidth = 0;
  defaults.borderColor = '#000000';

  const prefixLabel = opts.propPrefix[0].toUpperCase() + opts.propPrefix.slice(1);

  function defineBorderTab(definition, suffix, tabName, indexOffset) {
    const styleName = opts.propPrefix + `Border${suffix}Style`;
    const widthName = opts.propPrefix + `Border${suffix}Width`;
    const colorName = opts.propPrefix + `Border${suffix}Color`;

    let orNotSet = defaults.borderStyle !== 'none' ? 'OR borderStyle NOT SET' : '';

    if (suffix) {
      if (defaults[styleName] && defaults[styleName] !== 'none') orNotSet += `OR ${styleName} NOT SET`;
      NodeSharedPortDefinitions.addDynamicInputPorts(
        definition,
        `${styleName} = solid OR ${styleName} = dashed OR ${styleName} = dotted OR borderStyle = solid OR borderStyle = dashed OR borderStyle = dotted ${orNotSet}`,
        [`${widthName}`, `${colorName}`]
      );
    } else {
      NodeSharedPortDefinitions.addDynamicInputPorts(
        definition,
        `${styleName} = solid OR ${styleName} = dashed OR ${styleName} = dotted ${orNotSet}`,
        [`${widthName}`, `${colorName}`]
      );
    }

    const tab = {
      group: opts.propPrefix + '-border-styles',
      tab: tabName,
      label: suffix
    };

    const editorName = (name) => `${prefixLabel} ${name} ${suffix ? '(' + suffix + ')' : ''}`;
    const index = 202 + indexOffset * 4;

    const groupName = prefixLabel + ' Border Style';

    // NDA-012 (Visual), check C1. These three generators produce ~60 of Slider's ports and are
    // private to this file, so the shared pass in NDA-005 §0 could not reach them — see DV-vi.
    const part = opts.propPrefix === 'thumb' ? 'the handle you drag' : 'the bar the handle slides along';
    const edge = suffix ? suffix.toLowerCase() : '';

    NodeSharedPortDefinitions.addInputProps(definition, {
      [styleName]: {
        index: index + 1,
        displayName: 'Border Style',
        editorName: editorName('Border Style'),
        description: suffix
          ? `Line style for the ${edge} edge of ${part} only, overriding ${prefixLabel} Border Style; None hides that edge`
          : `Line style for all four edges of ${part}; None hides the border and leaves its Width and Color inactive`,
        group: groupName,
        type: {
          name: 'enum',
          enums: [
            { label: 'None', value: 'none' },
            { label: 'Solid', value: 'solid' },
            { label: 'Dotted', value: 'dotted' },
            { label: 'Dashed', value: 'dashed' }
          ]
        },
        default: defaults[`border${suffix}Style`],
        tab,
        popout,
        allowVisualStates: true
      },
      [widthName]: {
        index: index + 2,
        displayName: 'Border Width',
        editorName: editorName('Border Width'),
        description: suffix
          ? `Thickness in pixels of the ${edge} edge of ${part}, which has no effect while that edge's Border Style is None`
          : `Thickness in pixels of the border around ${part}, which has no effect while ${prefixLabel} Border Style is None`,
        group: groupName,
        type: {
          name: 'number',
          units: ['px'],
          defaultUnit: 'px'
        },
        default: defaults[`border${suffix}Width`],
        tab,
        popout,
        allowVisualStates: true
      },
      [colorName]: {
        index: index + 3,
        displayName: 'Border Color',
        editorName: editorName('Border Color'),
        description: suffix
          ? `Colour of the ${edge} edge of ${part} only, overriding ${prefixLabel} Border Color`
          : `Colour of the border around ${part}, which has no effect while ${prefixLabel} Border Style is None`,
        group: groupName,
        type: 'color',
        default: defaults[`border${suffix}Color`],
        tab,
        popout,
        allowVisualStates: true
      }
    });
  }

  defineBorderTab(definition, '', 'borders-all', 0);
  defineBorderTab(definition, 'Left', 'borders-left', 1);
  defineBorderTab(definition, 'Top', 'borders-top', 2);
  defineBorderTab(definition, 'Right', 'borders-right', 3);
  defineBorderTab(definition, 'Bottom', 'borders-bottom', 4);
}

function addBorderRadius(definition, opts) {
  opts = opts || {};
  const defaults = opts.defaults || {};
  const popout = opts.popout;

  if (!defaults.borderRadius) defaults.borderRadius = 0;

  const prefixLabel = opts.propPrefix[0].toUpperCase() + opts.propPrefix.slice(1);

  function defineCornerTab(definition, suffix, tabName, indexOffset) {
    const editorName = (name) => `${prefixLabel} ${name} ${suffix ? '(' + suffix + ')' : ''}`;

    const tab = {
      group: opts.propPrefix + '-corners',
      tab: tabName,
      label: suffix
    };
    const radiusName = `Border${suffix}Radius`;
    const part = opts.propPrefix === 'thumb' ? 'the handle you drag' : 'the bar the handle slides along';
    const corner = suffix ? suffix.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : '';

    NodeSharedPortDefinitions.addInputProps(definition, {
      [opts.propPrefix + radiusName]: {
        index: 240 + indexOffset,
        displayName: 'Corner Radius',
        editorName: editorName('Corner Radius'),
        description: suffix
          ? `How rounded the ${corner} corner of ${part} is, overriding ${prefixLabel} Corner Radius`
          : `How rounded all four corners of ${part} are; half its width and height makes it a circle`,
        group: prefixLabel + ' Corner Radius',
        type: {
          name: 'number',
          units: ['px', '%'],
          defaultUnit: 'px'
        },
        default: defaults[`border${suffix}Radius`],
        tab,
        popout
      }
    });
  }

  defineCornerTab(definition, '', 'corners-all', 0);
  defineCornerTab(definition, 'TopLeft', 'corners-top-left', 1);
  defineCornerTab(definition, 'TopRight', 'corners-top-right', 2);
  defineCornerTab(definition, 'BottomRight', 'corners-bottom-right', 3);
  defineCornerTab(definition, 'BottomLeft', 'corners-bottom-left', 4);
}

function addShadowInputs(definition, opts) {
  opts = opts || {};
  const popout = opts.popout;
  const prefix = opts.propPrefix;

  NodeSharedPortDefinitions.addDynamicInputPorts(definition, `${prefix}BoxShadowEnabled = true`, [
    `${prefix}BoxShadowOffsetX`,
    `${prefix}BoxShadowOffsetY`,
    `${prefix}BoxShadowInset`,
    `${prefix}BoxShadowBlurRadius`,
    `${prefix}BoxShadowSpreadRadius`,
    `${prefix}BoxShadowColor`
  ]);

  const prefixLabel = opts.propPrefix[0].toUpperCase() + opts.propPrefix.slice(1);
  const editorName = (name) => `${prefixLabel} ${name}`;
  const part = opts.propPrefix === 'thumb' ? 'the handle you drag' : 'the bar the handle slides along';

  NodeSharedPortDefinitions.addInputProps(definition, {
    [`${prefix}BoxShadowEnabled`]: {
      index: 250,
      group: opts.group || 'Box Shadow',
      displayName: 'Shadow Enabled',
      editorName: editorName('Shadow Enabled'),
      description: `Draws a shadow behind ${part}; the rest of this group does nothing while it is off`,
      type: 'boolean',
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowOffsetX`]: {
      index: 251,
      group: opts.group || 'Box Shadow',
      displayName: 'Offset X',
      editorName: editorName('Offset X'),
      description: 'How far right the shadow sits from the element; negative values move it left',
      default: 0,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowOffsetY`]: {
      index: 252,
      group: opts.group || 'Box Shadow',
      displayName: 'Offset Y',
      editorName: editorName('Offset Y'),
      description: 'How far down the shadow sits from the element; negative values move it up',
      default: 0,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowBlurRadius`]: {
      index: 253,
      group: opts.group || 'Box Shadow',
      displayName: 'Blur Radius',
      editorName: editorName('Blur Radius'),
      description: 'How soft the shadow edge is; 0 gives a hard edge',
      default: 5,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowSpreadRadius`]: {
      index: 254,
      group: opts.group || 'Box Shadow',
      displayName: 'Spread Radius',
      editorName: editorName('Spread Radius'),
      description: 'Grows the shadow outwards before it is blurred; negative values shrink it',
      default: 2,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowInset`]: {
      index: 255,
      group: opts.group || 'Box Shadow',
      displayName: 'Inset',
      editorName: editorName('Inset'),
      description: 'Draws the shadow inside the element instead of behind it, for a recessed look',
      type: 'boolean',
      default: false,
      allowVisualStates: true,
      popout
    },
    [`${prefix}BoxShadowColor`]: {
      index: 256,
      group: opts.group || 'Box Shadow',
      displayName: 'Shadow Color',
      editorName: editorName('Shadow Color'),
      description: 'Colour of the shadow, usually a mostly-transparent black',
      type: 'color',
      default: '#00000033',
      allowVisualStates: true,
      popout
    }
  });
}

NodeSharedPortDefinitions.addAlignInputs(RangeNode);
NodeSharedPortDefinitions.addTransformInputs(RangeNode);
NodeSharedPortDefinitions.addMarginInputs(RangeNode);
NodeSharedPortDefinitions.addPaddingInputs(RangeNode);
NodeSharedPortDefinitions.addSharedVisualInputs(RangeNode);
addBorderInputs(RangeNode, { propPrefix: 'track', popout: trackPopout });
addBorderRadius(RangeNode, { propPrefix: 'track', popout: trackPopout });
addShadowInputs(RangeNode, {
  propPrefix: 'track',
  popout: trackPopout,
  group: 'Track Box Shadow'
});

addBorderInputs(RangeNode, { propPrefix: 'thumb', popout: thumbPopout });
addBorderRadius(RangeNode, { propPrefix: 'thumb', popout: thumbPopout });
addShadowInputs(RangeNode, {
  propPrefix: 'thumb',
  popout: thumbPopout,
  group: 'Thumb Box Shadow'
});

Utils.addControlEventsAndStates(RangeNode);

export default createNodeFromReactComponent(RangeNode);
