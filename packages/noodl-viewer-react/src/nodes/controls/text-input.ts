import { TextInput } from '../../components/controls/TextInput';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import type { EditorConnectionLike, GraphModelLike, GraphNodeModel, NodeContextLike } from '@noodl/types';

import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import Utils from './utils';
import { emptyValueForFieldType, outwardValueForFieldType, portTypeForFieldType } from './textInputValue';

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
      // REL-002a / register V14 — empty, not `'Type here...'`.
      //
      // 🔴 This default SHIPPED. Measured on `templates/members-area` at HEAD: 18 text inputs,
      // **one** of which sets `placeholder` explicitly, so seventeen fields across the setup
      // and join forms rendered *"Type here…"* — six on `/setup`, four on `/join`, every one
      // of them under a real label that already said what the field was for. A runtime default
      // that manufactures the rubric's own placeholder-grade-copy tell, on every shipped form,
      // and nothing fired on it: `render-report`'s placeholder finding derives its strings from
      // this very default, so the string it hunts for is one the product put there.
      //
      // ⚠️ A hint is still a good idea on a field whose format is not obvious, and authoring one
      // costs a parameter. What is not defensible is shipping the same six words on every field
      // of every form because nobody said otherwise. Empty is the honest unset: the label above
      // the field is what names it, which is what these forms already do.
      default: '',
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
        'Writes the current Value into the field now. This is additional to Value applying as it arrives; untick Value under Run On Value Change to stop that',
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
      // FB-026 — Richard: *"we should rename it to 'value' I think because it's not always
      // text"*. Display name only: `startValue` is the id in every saved `project.json` and in
      // `runOnValueChange.inputs` above, so it is frozen in the sense `name` is.
      displayName: 'Value',
      // `'*'` rather than `'string'`, and `updatePorts` narrows it per instance. The static
      // declaration is what a *deployed* viewer and the node catalog read, where no editor is
      // connected to narrow anything, and there the honest answer is "it depends on Type".
      type: '*',
      description:
        'The value to put in the field. Applied as it arrives, unless you untick it under Run On Value Change, in which case it waits for a Set pulse',
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

        // FB-026: `''` on a text field, `null` on a number one — see `emptyValueForFieldType`.
        const text = value === null ? emptyValueForFieldType(this.props.type) : value;
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
      // FB-026, display name only — `onTextChanged` is the port id in every saved project.
      displayName: 'Value',
      // See `startValue` above for why this is `'*'` statically and narrowed per instance.
      type: '*',
      description:
        'What the field currently contains, updated as the user types. A number when Type is Number, otherwise text',
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
      displayName: 'Value Changed',
      type: 'signal',
      group: 'General',
      description:
        'Fires whenever the Value output changes, so a graph can sequence off the new value rather than poll it',
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
      // FB-026 — the empty value is `null` on a Number field, so both halves of this comparison
      // have to ask what kind of field it is. Left as `''` it read "not empty" on every already
      // empty number field, and `Clear` reported `Done` for doing nothing.
      const empty = emptyValueForFieldType(this.props.type);
      const wasEmpty = this._internal.text === empty && this.outputPropValues['onTextChanged'] === empty;
      // NDA-012 (Visual), A1. This blanked `props.startValue` and the DOM and left the node's own
      // copy of the text holding the old string. `Set` reads `_internal.text`, so a later `Set`
      // pulse **restored text the author had explicitly cleared** — and it also did not flag
      // `onTextChanged` while unmounted, which `setText` immediately below is careful to do, so a
      // `Clear` before first mount left the `Text` output reading the old value.
      this._internal.text = empty;
      this.props.startValue = empty;

      if (this.innerReactComponentRef) {
        // Unconditional, unlike `setText`'s `hasFocus()` guard, and the asymmetry is deliberate:
        // `setText` must not fight the typist mid-edit, but an explicit `Clear` that skipped a
        // focused field would be a dead button for the person using it. The component's own
        // `setText` flags `onTextChanged` on the way through.
        this.innerReactComponentRef.setText('');
      } else if (this.outputPropValues['onTextChanged'] !== empty) {
        //text component isn't mounted yet, set the output manually — as `setText` does
        this.outputPropValues['onTextChanged'] = empty;
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
        // FB-026 — mounted, `TextInput.setText` converts on the way out; unmounted, nothing
        // does, so a Number field that was `Set` before it mounted published the raw string and
        // the two paths disagreed about the type of the same port.
        this.outputPropValues['onTextChanged'] = outwardValueForFieldType(this.props.type, text);
        this.flagOutputDirty('onTextChanged');
        return true;
      }
      return false;
    }
  }
};

NodeSharedPortDefinitions.addDimensions(TextInputNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Value'
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

/**
 * FB-026 — narrow the two value ports to what this instance's `Type` actually carries.
 *
 * The static declarations say `'*'`, which is the honest answer where nothing can be narrowed —
 * a deployed viewer, the node catalog, the docs site. Here, with an editor connected, the answer
 * is knowable per node: a **Number** field's `Value` really is a `number`, and every other Type
 * is a `string`.
 *
 * Why this exists at all: before it, both ports were hard-declared `string`, so an author who
 * set Type to Number got a `string` port carrying `5`, and FIX-025 dashed the wire into every
 * `number` input they connected. The wire was right and the port was lying. Publishing `'*'` and
 * stopping there would have silenced the warning by giving up the check instead of fixing it —
 * a Text field wired into a `number` port still deserves the dashed wire, and still gets it.
 *
 * ⚠️ These are **overrides of statically declared ports**, which is new. `NodeGraphNode.getPorts`
 * lets a dynamic port replace a static one of the same name and plug; before that change the two
 * concatenated and the panel would have shown `Value` twice. See the note there.
 */
function updatePorts(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const type = portTypeForFieldType(parameters.type);

  editorConnection.sendDynamicPorts(nodeId, [
    {
      name: 'startValue',
      type,
      plug: 'input',
      group: 'Text',
      index: 18,
      displayName: 'Value'
    },
    {
      name: 'onTextChanged',
      type,
      plug: 'output',
      group: 'General',
      index: 1,
      displayName: 'Value'
    }
  ] as never);
}

const TextInputModule = createNodeFromReactComponent(TextInputNode);

TextInputModule.setup = function (context: NodeContextLike, graphModel: GraphModelLike) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }

  graphModel.on('nodeAdded.net.noodl.controls.textinput', function (node: GraphNodeModel) {
    updatePorts(node.id, node.parameters, context.editorConnection);

    node.on('parameterUpdated', function (event: { name: string }) {
      if (event.name === 'type') {
        updatePorts(node.id, node.parameters, context.editorConnection);
      }
    });
  });
};

export default TextInputModule;
