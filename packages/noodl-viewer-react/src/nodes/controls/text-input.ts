import { TextInput } from '../../components/controls/TextInput';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import Utils from './utils';

function _styleTemplate(className, props) {
  return `
    .${className}::placeholder {
        opacity: ${props.placeholderOpacity};
    }
    `;
}

const TextInputNode = {
  name: 'net.noodl.controls.textinput',
  displayName: 'Text Input',
  docs: 'https://docs.noodl.net/nodes/ui-controls/text-input',
  allowChildren: false,
  noodlNodeAsProp: true,
  usePortAsLabel: 'label',
  nodeDoubleClickAction: {
    focusPort: 'label'
  },
  connectionPanel: {
    groupPriority: [
      'General',
      'Text',
      'Style',
      'Actions',
      'Events',
      'States',
      'Mounted',
      'Text Style',
      'Label',
      'Label Text Style',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },
  getReactComponent() {
    return TextInput;
  },
  initialize() {
    this.props.startValue = '';
    this.props.id = this._internal.controlId = 'input-' + guid();
  },
  inputProps: {
    type: {
      displayName: 'Type',
      description: 'What kind of value the field accepts, which also changes the on-screen keyboard on touch devices',
      group: 'Text',
      index: 19,
      type: {
        name: 'enum',
        enums: [
          { label: 'Text', value: 'text' },
          { label: 'Text Area', value: 'textArea' },
          { label: 'Email', value: 'email' },
          { label: 'Number', value: 'number' },
          { label: 'Password', value: 'password' },
          { label: 'URL', value: 'url' }
        ]
      },
      default: 'text'
    },
    placeholder: {
      index: 22,
      group: 'Text',
      displayName: 'Placeholder',
      description: 'Greyed-out hint shown while the field is empty',
      default: 'Type here...',
      type: {
        name: 'string'
      }
    },
    maxLength: {
      group: 'Text',
      displayName: 'Max length',
      description: 'Largest number of characters the user can type; it does not truncate a value arriving on Text',
      type: 'number',
      index: 24
    }
  },
  inputs: {
    placeHolderOpacity: {
      index: 23,
      group: 'Text',
      displayName: 'Placeholder opacity',
      description: 'How faded the placeholder text is, from 0 to 1',
      type: 'number',
      default: 0.5,
      set(value) {
        const className = this._internal.controlId;
        Utils.updateStylesForClass(className, { placeholderOpacity: value }, _styleTemplate);
      }
    },
    set: {
      group: 'Actions',
      displayName: 'Set',
      description: 'Writes the current Text into the field; connect it when you want Text to apply on demand rather than immediately',
      type: 'signal',
      valueChangedToTrue() {
        this.scheduleAfterInputsHaveUpdated(() => {
          this.setText(this._internal.text);
        });
      }
    },
    startValue: {
      index: 18,
      displayName: 'Text',
      type: 'string',
      description: 'The text to put in the field. Applied immediately unless Set is connected, in which case it waits for a Set pulse',
      group: 'Text',
      set(value) {
        if (this._internal.text === value) return;

        this._internal.text = value;
        if (this.isInputConnected('set') === false) {
          this.setText(value);
        }
      }
    },
    clear: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Clear',
      description: 'Empties the field',
      valueChangedToTrue() {
        this.clear();
      }
    },
    focus: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Focus',
      description: 'Puts the keyboard cursor in this field',
      valueChangedToTrue() {
        this.context.setNodeFocused(this, true);
      }
    },
    blur: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Blur',
      description: 'Takes keyboard focus away from this field, which is what fires Blurred',
      valueChangedToTrue() {
        this.context.setNodeFocused(this, false);
      }
    },
    textAlignX: {
      group: 'Text Alignment',
      index: 13,
      displayName: 'Text Horizontal Align',
      description: 'Aligns the typed text within the field',
      type: {
        name: 'enum',
        enums: [
          { label: 'left', value: 'left' },
          { label: 'center', value: 'center' },
          { label: 'right', value: 'right' }
        ],
        alignComp: 'justify'
      },
      default: 'left',
      set(value) {
        switch (value) {
          case 'left':
            this.setStyle({ textAlign: 'left' }, 'input');
            break;
          case 'center':
            this.setStyle({ textAlign: 'center' }, 'input');
            break;
          case 'right':
            this.setStyle({ textAlign: 'right' }, 'input');
            break;
        }
      }
    }
  },
  inputCss: {
    backgroundColor: {
      index: 100,
      displayName: 'Background Color',
      description: 'Fill colour of the field',
      group: 'Style',
      type: 'color',
      default: 'transparent',
      allowVisualStates: true,
      styleTag: 'inputWrapper'
    }
  },
  outputProps: {
    // Value
    onTextChanged: {
      group: 'General',
      displayName: 'Text',
      type: 'string',
      description: 'What the field currently contains, updated as the user types',
      index: 1,
      onChange() {
        this.sendSignalOnOutput('textChanged');
      }
    },

    // Events
    onEnter: {
      group: 'Events',
      displayName: 'On Enter',
      description: 'Fires when the user presses Enter in the field, which is the usual place to submit',
      type: 'signal'
    }
  },
  outputs: {
    textChanged: {
      displayName: 'Text Changed',
      type: 'signal',
      group: 'General',
      description: 'Fires whenever the Text output changes, so a graph can sequence off the new value rather than poll it',
      index: 2
    }
  },
  methods: {
    _focus() {
      if (!this.innerReactComponentRef) return;
      this.innerReactComponentRef.focus();
    },
    _blur() {
      if (!this.innerReactComponentRef) return;
      this.innerReactComponentRef.blur();
    },
    clear() {
      this.props.startValue = '';
      if (this.innerReactComponentRef) {
        this.innerReactComponentRef.setText('');
      }
    },
    setText(text) {
      this.props.startValue = text;
      if (this.innerReactComponentRef) {
        //the text component is currently mounted, and will signal the onTextChanged output
        if (this.innerReactComponentRef.hasFocus() === false) {
          this.innerReactComponentRef.setText(text);
        }
      } else if (this.outputPropValues['onTextChanged'] !== text) {
        //text component isn't mounted yet, set the output manually
        this.outputPropValues['onTextChanged'] = text;
        this.flagOutputDirty('onTextChanged');
      }
    }
  }
};

NodeSharedPortDefinitions.addDimensions(TextInputNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Text'
});
NodeSharedPortDefinitions.addIconInputs(TextInputNode, {
  enableIconPlacement: true,
  defaults: { useIcon: false, iconColor: '#000000' }
});
NodeSharedPortDefinitions.addLabelInputs(TextInputNode, {
  enableSpacing: true,
  styleTag: 'label',
  displayName: 'Label'
});

NodeSharedPortDefinitions.addTextStyleInputs(TextInputNode, {
  styleTag: 'input',
  portPrefix: '',
  portIndex: 18,
  popout: {
    group: 'input-text-style',
    label: 'Text Style',
    parentGroup: 'Text'
  }
});

NodeSharedPortDefinitions.addAlignInputs(TextInputNode);
NodeSharedPortDefinitions.addTransformInputs(TextInputNode);
NodeSharedPortDefinitions.addPaddingInputs(TextInputNode, {
  styleTag: 'inputWrapper'
});
NodeSharedPortDefinitions.addMarginInputs(TextInputNode);
NodeSharedPortDefinitions.addSharedVisualInputs(TextInputNode);
NodeSharedPortDefinitions.addBorderInputs(TextInputNode, {
  styleTag: 'inputWrapper'
});
NodeSharedPortDefinitions.addShadowInputs(TextInputNode, {
  styleTag: 'inputWrapper'
});
Utils.addControlEventsAndStates(TextInputNode);

export default createNodeFromReactComponent(TextInputNode);
