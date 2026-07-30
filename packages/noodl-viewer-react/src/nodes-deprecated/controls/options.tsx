import React, { useEffect, useState } from 'react';
import type { CollectionLike, GraphModelLike, GraphNodeModel, ModelLike } from '@noodl/types';

import FontLoader from '../../fontloader';
import guid from '../../guid';
import Layout from '../../layout';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import {
  createNodeFromReactComponent,
  type ReactNodeDefinition,
  type ReactNodeInstance,
  type StyleObject
} from '../../react-component-node';
import type { Noodl } from '../../types';
import Utils from './utils';

interface OptionsProps extends Noodl.ReactProps {
  id?: string;
  enabled?: boolean;
  value?: string;
  /**
   * The option list. Each entry is read for `Value`, `Label` and `Disabled` — a Noodl
   * Array of records in practice, but a plain array of objects answers the same reads.
   */
  items?: CollectionLike;
  textStyle?: Noodl.TextStyle;
  onClick?: React.MouseEventHandler<HTMLSelectElement>;
  /** Installed by `initialize`, not by a port — this is how the control reports back. */
  valueChanged?: (value: string) => void;

  boxShadowEnabled?: boolean;
  boxShadowInset?: boolean;
  boxShadowOffsetX?: string;
  boxShadowOffsetY?: string;
  boxShadowBlurRadius?: string;
  boxShadowSpreadRadius?: string;
  boxShadowColor?: string;
}

/** `this` inside the Options node. */
interface OptionsNodeInstance extends ReactNodeInstance {
  _internal: {
    controlId?: string;
    enabled?: boolean;
    value?: string;
    /** The collection currently bound to `items`, kept so the listener can be removed. */
    items?: CollectionLike;
  };
  /** Installed by `initialize`; re-renders when the bound collection changes. */
  _itemsChanged(): void;
}

function Options(props: OptionsProps) {
  const [value, setValue] = useState(props.value);

  // Must update value output on both "mount" and when it's changed
  useEffect(() => {
    setValue(props.value);
  }, []);

  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  let style: StyleObject = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  if (props.textStyle !== undefined) {
    // Apply text style
    style = Object.assign({}, props.textStyle, style);
  }

  if (props.boxShadowEnabled) {
    style.boxShadow = `${props.boxShadowInset ? 'inset ' : ''}${props.boxShadowOffsetX} ${props.boxShadowOffsetY} ${
      props.boxShadowBlurRadius
    } ${props.boxShadowSpreadRadius} ${props.boxShadowColor}`;
  }

  // Hide label if there is no selected value, of if value is not in the items array
  const selectedIndex =
    value === undefined || value === ''
      ? -1
      : props.items === undefined
      ? -1
      : props.items.findIndex((i: ModelLike) => i.Value === value);

  const tagProps = { id: props.id, style: style, onClick: props.onClick };

  let className = 'ndl-controls-select';
  if (props.className) className = className + ' ' + props.className;

  return (
    <select
      className={className}
      ref={(el) => {
        if (el) el.selectedIndex = selectedIndex;
      }}
      {...tagProps}
      disabled={!props.enabled}
      value={value}
      {...Utils.controlEvents(props)}
      onChange={(e) => {
        setValue(e.target.value);
        props.valueChanged && props.valueChanged(e.target.value);
      }}
    >
      {props.items !== undefined
        ? props.items.map((i: ModelLike) => (
            <option
              value={i.Value as string}
              disabled={i.Disabled === 'true' || i.Disabled === true ? true : undefined}
              selected={i.Value === value}
            >
              {i.Label as React.ReactNode}
            </option>
          ))
        : null}
    </select>
  );
}

const OptionsNode: ReactNodeDefinition = {
  name: 'Options',
  // NDA-011 criterion 3. This node lives in `nodes-deprecated/` and has a modern
  // replacement (`net.noodl.controls.options`), but carried no `deprecated` flag — so it stayed
  // creatable, and it took the plain display name while the replacement's is set by
  // `displayName`. The picker therefore offered two entries reading the same word, and
  // the one an author was most likely to reach for was this one.
  deprecated: true,
  displayName: 'Options',
  docs: 'https://docs.noodl.net/nodes/visual/options',
  allowChildren: false,
  noodlNodeAsProp: true,
  initialize: function (this: OptionsNodeInstance) {
    this._itemsChanged = () => {
      this.forceUpdate();
    };

    this.props.id = this._internal.controlId = 'input-' + guid();
    this.props.enabled = this._internal.enabled = true;

    this.outputPropValues.hoverState = this.outputPropValues.focusState = this.outputPropValues.pressedState = false;

    this.props.valueChanged = (value: string) => {
      const changed = this._internal.value !== value;
      this._internal.value = value;
      if (changed) {
        this.flagOutputDirty('value');
        this.sendSignalOnOutput('onChange');
      }
    };
  },
  getReactComponent() {
    return Options;
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
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      set: function (this: OptionsNodeInstance, newValue: CollectionLike) {
        if (this._internal.items !== newValue && this._internal.items !== undefined) {
          this._internal.items.off('change', this._itemsChanged);
        }
        this._internal.items = newValue;
        this._internal.items.on('change', this._itemsChanged);

        this.props.items = this._internal.items;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'General',
      set: function (value) {
        if (value !== undefined && typeof value !== 'string') {
          if (value.toString !== undefined) value = value.toString();
          else return;
        }

        const changed = value !== this._internal.value;
        this.props.value = this._internal.value = value;

        if (changed) {
          this.forceUpdate();
          this.flagOutputDirty('value');
        }
      }
    },

    // Text style
    textStyle: {
      index: 20,
      type: 'textStyle',
      group: 'Text',
      displayName: 'Text Style',
      default: 'None',
      set(value) {
        this.props.textStyle = this.context.styles.getTextStyle(value);
        this.forceUpdate();
      }
    },
    fontFamily: {
      index: 21,
      type: 'font',
      group: 'Text',
      displayName: 'Font Family',
      set(value) {
        if (value) {
          let family = value;
          if (family.split('.').length > 1) {
            family = family.replace(/\.[^/.]+$/, '');
            family = family.split('/').pop();
          }
          this.setStyle({ fontFamily: family });
        } else {
          this.removeStyle(['fontFamily']);
        }

        if (this.props.textStyle) {
          this.forceUpdate();
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
      type: 'string',
      displayName: 'Value',
      group: 'States',
      getter: function () {
        return this._internal.value;
      }
    },
    onChange: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    }
  },
  inputCss: {
    fontSize: {
      index: 21,
      group: 'Text',
      displayName: 'Font Size',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      onChange() {
        if (this.props.textStyle) {
          this.forceUpdate();
        }
      }
    },
    color: {
      index: 24,
      group: 'Text',
      displayName: 'Color',
      type: 'color'
    },
    backgroundColor: {
      index: 100,
      displayName: 'Background Color',
      group: 'Style',
      type: 'color',
      default: 'transparent'
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
      default: 0,
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
      default: 'solid',
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
  inputProps: {
    // Box shadow
    boxShadowEnabled: {
      index: 250,
      group: 'Box Shadow',
      displayName: 'Shadow Enabled',
      type: 'boolean',
      default: false
    },
    boxShadowOffsetX: {
      index: 251,
      group: 'Box Shadow',
      displayName: 'Offset X',
      default: 0,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      }
    },
    boxShadowOffsetY: {
      index: 252,
      group: 'Box Shadow',
      displayName: 'Offset Y',
      default: 0,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      }
    },
    boxShadowBlurRadius: {
      index: 253,
      group: 'Box Shadow',
      displayName: 'Blur Radius',
      default: 5,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      }
    },
    boxShadowSpreadRadius: {
      index: 254,
      group: 'Box Shadow',
      displayName: 'Spread Radius',
      default: 2,
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      }
    },
    boxShadowInset: {
      index: 255,
      group: 'Box Shadow',
      displayName: 'Inset',
      type: 'boolean',
      default: false
    },
    boxShadowColor: {
      index: 256,
      group: 'Box Shadow',
      displayName: 'Shadow Color',
      type: 'color',
      default: 'rgba(0,0,0,0.2)'
    }
  },
  outputProps: {},
  dynamicports: [
    {
      condition: 'boxShadowEnabled = true',
      inputs: [
        'boxShadowOffsetX',
        'boxShadowOffsetY',
        'boxShadowInset',
        'boxShadowBlurRadius',
        'boxShadowSpreadRadius',
        'boxShadowColor'
      ]
    }
  ],
  methods: {}
};

NodeSharedPortDefinitions.addDimensions(OptionsNode, { defaultSizeMode: 'contentSize', contentLabel: 'Content' });
NodeSharedPortDefinitions.addAlignInputs(OptionsNode);
NodeSharedPortDefinitions.addTransformInputs(OptionsNode);
NodeSharedPortDefinitions.addPaddingInputs(OptionsNode);
NodeSharedPortDefinitions.addMarginInputs(OptionsNode);
NodeSharedPortDefinitions.addSharedVisualInputs(OptionsNode);
Utils.addControlEventsAndStates(OptionsNode);

const definition = createNodeFromReactComponent(OptionsNode);
definition.setup = function (_context, graphModel: GraphModelLike) {
  graphModel.on('nodeAdded.Options', function (node: GraphNodeModel) {
    if (node.parameters.fontFamily && (node.parameters.fontFamily as string).split('.').length > 1) {
      FontLoader.instance.loadFont(node.parameters.fontFamily as string);
    }
    node.on('parameterUpdated', function (event: { name: string; value: unknown }) {
      if (event.name === 'fontFamily' && event.value) {
        if ((event.value as string).split('.').length > 1) {
          FontLoader.instance.loadFont(event.value as string);
        }
      }
    });
  });
};

export default definition;
