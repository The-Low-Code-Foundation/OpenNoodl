import { RadioButton } from '../../components/controls/RadioButton';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import Utils from './utils';

const RadioButtonNode = {
  name: 'net.noodl.controls.radiobutton',
  displayName: 'Radio Button',
  docs: 'https://docs.noodl.net/nodes/ui-controls/radio-button',
  allowChildren: false,
  noodlNodeAsProp: true,
  usePortAsLabel: 'label',
  nodeDoubleClickAction: {
    focusPort: 'label'
  },
  connectionPanel: {
    groupPriority: [
      'General',
      'Style',
      'Fill Style',
      'Actions',
      'Events',
      'States',
      'Mounted',
      'Label',
      'Label Text Style',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },
  initialize() {
    this.props.sizeMode = 'explicit';
    this.props.id = 'input-' + guid();

    this._internal.checked = false;

    this.props.checkedChanged = (checked) => {
      const changed = this._internal.checked !== checked;
      this._internal.checked = checked;
      if (changed) {
        this.flagOutputDirty('checked');
        this._updateVisualState();
      }
    };

    this.props.styles.fill = {};
  },
  getReactComponent() {
    return RadioButton;
  },
  inputs: {
    fillColor: {
      index: 19,
      displayName: 'Fill Color',
      description: 'Colour of the dot shown inside this button while it is selected',
      group: 'Fill Style',
      type: 'color',
      allowVisualStates: true,
      styleTag: 'fill',
      set(value) {
        this.setStyle({ backgroundColor: value }, 'fill');
      }
    }
  },
  inputProps: {
    value: {
      type: 'string',
      displayName: 'Value',
      description: 'What this button contributes to its Radio Button Group when selected; the group reports it as its own Value',
      group: 'General',
      index: 100
    },
    fillSpacing: {
      displayName: 'Fill Spacing',
      description: 'Gap between the dot and the button edge, so a larger value makes a smaller dot',
      group: 'Fill Style',
      type: {
        name: 'number',
        units: ['px', 'vw', 'vh'],
        defaultUnit: 'px'
      },
      allowVisualStates: true,
      default: 2
    }
  },
  inputCss: {
    width: {
      index: 11,
      group: 'Dimensions',
      displayName: 'Width',
      description: 'Width of the button; the label sits beside it and is sized separately',
      type: {
        name: 'number',
        units: ['px', '%', 'vw', 'vh'],
        defaultUnit: 'px'
      },
      default: 32,
      allowVisualStates: true,
      styleTag: 'radio',
      onChange() {
        this.forceUpdate();
      }
    },
    height: {
      index: 12,
      group: 'Dimensions',
      displayName: 'Height',
      description: 'Height of the button',
      type: {
        name: 'number',
        units: ['px', '%'],
        defaultUnit: 'px'
      },
      default: 32,
      allowVisualStates: true,
      styleTag: 'radio',
      onChange() {
        this.forceUpdate();
      }
    },
    backgroundColor: {
      index: 201,
      displayName: 'Background Color',
      description: 'Fill colour of the button itself, behind the dot',
      group: 'Style',
      type: 'color',
      allowVisualStates: true,
      styleTag: 'radio',
      default: 'transparent',
      applyDefault: false
    }
  },
  outputs: {
    checked: {
      type: 'boolean',
      displayName: 'Checked',
      group: 'States',
      description: 'Whether this button is the one selected in its Radio Button Group',
      get() {
        return this._internal.checked;
      }
    }
  }
};

NodeSharedPortDefinitions.addAlignInputs(RadioButtonNode);
NodeSharedPortDefinitions.addTransformInputs(RadioButtonNode);
NodeSharedPortDefinitions.addMarginInputs(RadioButtonNode);
NodeSharedPortDefinitions.addPaddingInputs(RadioButtonNode);
NodeSharedPortDefinitions.addIconInputs(RadioButtonNode);
NodeSharedPortDefinitions.addLabelInputs(RadioButtonNode, {
  enableSpacing: true,
  styleTag: 'label'
});
NodeSharedPortDefinitions.addSharedVisualInputs(RadioButtonNode);
NodeSharedPortDefinitions.addBorderInputs(RadioButtonNode, {
  defaults: {
    borderStyle: 'solid',
    borderWidth: 2,
    borderRadius: 16
  },
  styleTag: 'radio'
});
NodeSharedPortDefinitions.addShadowInputs(RadioButtonNode, {
  styleTag: 'radio'
});
Utils.addControlEventsAndStates(RadioButtonNode, { checked: true });

export default createNodeFromReactComponent(RadioButtonNode);
