import { TextInput } from '../../components/controls/TextInput';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
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
  // NDA-017 §2. `Set` is this family's control signal and `Text` the one value input it
  // silenced. Note the group ordering above: the checkbox lands in its own
  // "Run On Value Change" group, which is not in `groupPriority` and therefore sorts after
  // the named ones — correct for a configuration affordance nobody reaches for first.
  runOnValueChange: { controlSignal: 'set', inputs: ['startValue'] },
  getReactComponent() {
    return TextInput;
  },
  initialize() {
    this.props.startValue = '';
    this.props.id = this._internal.controlId = 'input-' + guid();

    // NDA-012 (Visual), the third `DV-ii` instance — and it is **not a defect**, for the same
    // reason Button's padding was not: `assets/style.css`'s `.ndl-controls-textinput::placeholder`
    // already carries `opacity: 0.5`, so the number the panel shows is the number that renders,
    // and `placeHolderOpacity`'s setter is the *override*, not the only writer.
    //
    // ⚠️ Measured, after a mirror had been written here and committed on the strength of reading
    // the source. Live, with both injected per-instance rules deleted from the document, the
    // computed `::placeholder` opacity is still 0.5. The mirror moved no pixels and made the same
    // number specified three times, so it is gone again. The worksheet's claim that an untouched
    // Text Input gets the browser's opacity is wrong.
    //
    // The duplication that *is* real is the one Button has: the value lives in the stylesheet and
    // in the port default, and only the stylesheet is load-bearing until an author touches the
    // port. Pinned in `nda-012-visual-declared-defaults.test.ts` so an edit to either copy fails.
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
      // NDA-017 §2. The old sentence is the trap written as advice: "connect it when you want
      // Text to apply on demand" is telling the author to change one port's behaviour by
      // wiring another.
      description:
        'Writes the current Text into the field now. This is additional to Text applying as it arrives; untick Text under Run On Value Change to stop that',
      type: 'signal',
      valueChangedToTrue() {
        const outcome = this.beginOutcome();
        this.scheduleAfterInputsHaveUpdated(() => {
          // ERG-001 §4 / DV-viii. `setText` abstains when the field has focus — it must not
          // fight the typist mid-edit — and abstains again when the field is unmounted and the
          // output already reads this text. Both were silent, and both are the author's `Set`
          // doing exactly nothing. `Unchanged`, not `Failure`: the field holds what was asked.
          this.reportOutcome(outcome, this.setText(this._internal.text) ? 'done' : 'unchanged');
        });
      }
    },
    startValue: {
      index: 18,
      displayName: 'Text',
      type: 'string',
      description:
        'The text to put in the field. Applied as it arrives, unless you untick it under Run On Value Change, in which case it waits for a Set pulse',
      group: 'Text',
      set(value) {
        // NDA-012 (Visual), G1. `null` used to pass straight through to `props.startValue` and
        // into the `<input>`'s `value` (`TextInput.tsx:66`), which makes a controlled input
        // uncontrolled — and `null` is an ordinary arrival from any query that matched nothing.
        //
        // A string port *has* a representable empty value, so `EMPTY-VALUE-CONTRACT.md` applies
        // directly: `null` clears (the `E1`/`E2` rule — a string set to `null` empties and does
        // not read `"null"`) and `undefined` abstains. That is deliberately *not* the treatment
        // `Drag` and `Slider` got in the same pass, where a position has no empty value to clear
        // to.
        if (value === undefined) return;

        const text = value === null ? '' : value;
        if (this._internal.text === text) return;

        this._internal.text = text;
        // NDA-017 §2. Was `if (this.isInputConnected('set') === false)`.
        //
        // ⚠️ This node's two modes are the ones NDA-012 warned about as a *fixture*
        // parameter: `Clear`'s defect lives in one and `startValue`'s in the other, and a
        // fixture that measured a single mode read three genuine controls as failures. The
        // modes still exist — they are now selected by the checkbox rather than by whether
        // `Set` happens to be wired, which means a test can select one without rewiring the
        // graph.
        if (this.shouldRunOnValueChange('startValue')) {
          this.setText(text);
        }
      }
    },
    clear: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Clear',
      description: 'Empties the field',
      valueChangedToTrue() {
        const outcome = this.beginOutcome();
        this.reportOutcome(outcome, this.clear() ? 'done' : 'unchanged');
      }
    },
    focus: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Focus',
      description: 'Puts the keyboard cursor in this field',
      valueChangedToTrue() {
        const outcome = this.beginOutcome();
        this.context.setNodeFocused(this, true);
        this.reportOutcome(outcome, 'done');
      }
    },
    blur: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Blur',
      description: 'Takes keyboard focus away from this field, which is what fires Blurred',
      valueChangedToTrue() {
        const outcome = this.beginOutcome();
        this.context.setNodeFocused(this, false);
        this.reportOutcome(outcome, 'done');
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
    },

    /**
     * ERG-001 §4 / DV-viii. Four action inputs — `Set`, `Clear`, `Focus`, `Blur` — and nothing
     * terminal on any of them. `Text Changed` is not that signal: it fires when the *value*
     * changes, from typing as much as from a `Set`, and it does not fire at all when a `Set` was
     * absorbed.
     *
     * No `Failure`: none of the four can fail. `Set` and `Clear` can legitimately do nothing,
     * which is `Unchanged`; `Focus` and `Blur` always report `Done`, because
     * `setNodeFocused` has no answer to give and "the field was already focused" is not a fact
     * this node holds.
     */
    ...outcomeOutputs({
      done: 'Fires when Set, Clear, Focus or Blur did something',
      unchanged:
        'Fires when a Set or Clear left the field as it was — most often a Set while the field ' +
        'has focus, which is deliberately absorbed so it cannot overwrite what is being typed'
    })
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
    /** @returns whether anything actually changed — ERG-001 §4 reports `Unchanged` when not. */
    clear() {
      const wasEmpty = this._internal.text === '' && this.outputPropValues['onTextChanged'] === '';
      // NDA-012 (Visual), A1. This blanked `props.startValue` and the DOM and left the node's own
      // copy of the text holding the old string. `Set` reads `_internal.text`, so a later `Set`
      // pulse **restored text the author had explicitly cleared** — and it also did not flag
      // `onTextChanged` while unmounted, which `setText` immediately below is careful to do, so a
      // `Clear` before first mount left the `Text` output reading the old value.
      this._internal.text = '';
      this.props.startValue = '';

      if (this.innerReactComponentRef) {
        // Unconditional, unlike `setText`'s `hasFocus()` guard, and the asymmetry is deliberate:
        // `setText` must not fight the typist mid-edit, but an explicit `Clear` that skipped a
        // focused field would be a dead button for the person using it. The component's own
        // `setText` flags `onTextChanged` on the way through.
        this.innerReactComponentRef.setText('');
      } else if (this.outputPropValues['onTextChanged'] !== '') {
        //text component isn't mounted yet, set the output manually — as `setText` does
        this.outputPropValues['onTextChanged'] = '';
        this.flagOutputDirty('onTextChanged');
      }

      return !wasEmpty;
    },
    /**
     * @returns whether the text actually reached the field — ERG-001 §4's `Done` vs `Unchanged`.
     *
     * ⚠️ `props.startValue` is written on every path, including the two that abstain, and that
     * is not a contradiction: it is the value a *later* mount will start from. What the return
     * value answers is the author's question — "did my Set land?" — and on both abstaining paths
     * the answer is no.
     */
    setText(text) {
      this.props.startValue = text;
      if (this.innerReactComponentRef) {
        //the text component is currently mounted, and will signal the onTextChanged output
        if (this.innerReactComponentRef.hasFocus() === false) {
          this.innerReactComponentRef.setText(text);
          return true;
        }
        return false;
      } else if (this.outputPropValues['onTextChanged'] !== text) {
        //text component isn't mounted yet, set the output manually
        this.outputPropValues['onTextChanged'] = text;
        this.flagOutputDirty('onTextChanged');
        return true;
      }
      return false;
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
