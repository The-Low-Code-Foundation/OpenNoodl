import { Checkbox } from '../../components/controls/Checkbox';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import Utils from './utils';

const CheckBoxNode = {
  name: 'net.noodl.controls.checkbox',
  displayName: 'Checkbox',
  docs: 'https://docs.noodl.net/nodes/ui-controls/checkbox',
  allowChildren: false,
  noodlNodeAsProp: true,
  nodeDoubleClickAction: {
    focusPort: 'label'
  },
  usePortAsLabel: 'label',
  portLabelTruncationMode: 'length',
  connectionPanel: {
    groupPriority: [
      'General',
      'Style',
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
    this.props.checked = this._internal.checked = false;

    this.props.checkedChanged = (checked) => {
      const changed = this._internal.checked !== checked;
      // FB-020. The user-click path used to leave `props.checked` behind, unlike the `checked`
      // input setter and `setCheckedByAction`, which both write it. The tick then survived only
      // as the component's local state, so any remount re-seeded that state from a stale `false`
      // — and because `_internal.checked` was still true, the next click computed `changed` as
      // false and fired nothing at all. A box that had been ticked once could go quiet.
      this.props.checked = this._internal.checked = checked;
      if (changed) {
        this.flagOutputDirty('checked');
        this.sendSignalOnOutput('onChange');
        this._updateVisualState();
      }
    };
  },
  getReactComponent() {
    return Checkbox;
  },
  inputs: {
    checked: {
      type: 'boolean',
      displayName: 'Checked',
      group: 'General',
      description: 'Sets whether the box is ticked; setting it from the graph does not fire Changed',
      default: false,
      index: 100,
      set: function (value) {
        value = !!value;
        const changed = value !== this._internal.checked;
        this.props.checked = this._internal.checked = value;

        if (changed) {
          this.forceUpdate();
          this.flagOutputDirty('checked');
          this._updateVisualState();
        }
      }
    },
    check: {
      type: 'signal',
      displayName: 'Check',
      description: 'Ticks the box if it is not already ticked, then fires Done — or Unchanged if it already was. Does not fire Changed',
      group: 'Actions',
      valueChangedToTrue() {
        this.setCheckedByAction(true);
      }
    },
    uncheck: {
      type: 'signal',
      displayName: 'Uncheck',
      description: 'Unticks the box if it is ticked, then fires Done — or Unchanged if it already was. Does not fire Changed',
      group: 'Actions',
      valueChangedToTrue() {
        this.setCheckedByAction(false);
      }
    }
  },
  inputCss: {
    backgroundColor: {
      index: 201,
      displayName: 'Background Color',
      description: 'Fill colour of the box itself, behind the tick',
      group: 'Style',
      type: 'color',
      default: 'transparent',
      applyDefault: false,
      allowVisualStates: true,
      styleTag: 'checkbox'
    },
    width: {
      index: 11,
      group: 'Dimensions',
      displayName: 'Width',
      description: 'Width of the box; the label sits beside it and is sized separately',
      type: {
        name: 'number',
        units: ['px', 'vw', 'vh'],
        defaultUnit: 'px'
      },
      default: 32,
      allowVisualStates: true,
      styleTag: 'checkbox'
    },
    height: {
      index: 12,
      group: 'Dimensions',
      displayName: 'Height',
      description: 'Height of the box',
      type: {
        name: 'number',
        units: ['px', 'vw', 'vh'],
        defaultUnit: 'px'
      },
      default: 32,
      allowVisualStates: true,
      styleTag: 'checkbox'
    }
  },
  outputs: {
    checked: {
      type: 'boolean',
      displayName: 'Checked',
      group: 'States',
      description: 'Whether the box is currently ticked',
      getter: function () {
        return this._internal.checked;
      }
    },
    onChange: {
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when the user ticks or unticks the box; the Checked input and the Check/Uncheck actions do not fire it',
      type: 'signal'
    },

    /**
     * ERG-001 §4 / DV-viii, and the one Visual node in §0.3's `Unchanged` register.
     *
     * `Check` on an already-ticked box was `if (checked === true) return;` — a bare return, so
     * the graph got nothing at all. `Changed` deliberately does not fire for these actions
     * (it means "the *user* did it"), so there was no other signal either: the chain died, and
     * the state the author asked for was already true.
     *
     * Not `Failure`. The box is ticked, which is what `Check` asked for.
     */
    ...outcomeOutputs({
      done: 'Fires when Check or Uncheck actually flipped the box',
      unchanged: 'Fires when the box was already in that state, so nothing was flipped and Changed did not fire'
    })
  },
  methods: {
    /**
     * The one place `Check` and `Uncheck` differ is the value, so they share a body — the two
     * used to be near-identical blocks and the outcome contract would have made that three
     * near-identical blocks.
     */
    setCheckedByAction(next) {
      const outcome = this.beginOutcome();
      if (this._internal.checked === next) {
        this.reportOutcome(outcome, 'unchanged');
        return;
      }

      this.props.checked = this._internal.checked = next;

      this.forceUpdate();
      this.flagOutputDirty('checked');
      this._updateVisualState();
      // Last: the value is on the output before the pulse that describes it.
      this.reportOutcome(outcome, 'done');
    }
  }
};

NodeSharedPortDefinitions.addAlignInputs(CheckBoxNode);
NodeSharedPortDefinitions.addTransformInputs(CheckBoxNode);
NodeSharedPortDefinitions.addMarginInputs(CheckBoxNode);
NodeSharedPortDefinitions.addPaddingInputs(CheckBoxNode);
NodeSharedPortDefinitions.addIconInputs(CheckBoxNode);
NodeSharedPortDefinitions.addLabelInputs(CheckBoxNode, {
  enableSpacing: true,
  styleTag: 'label'
});
NodeSharedPortDefinitions.addSharedVisualInputs(CheckBoxNode);
NodeSharedPortDefinitions.addBorderInputs(CheckBoxNode, {
  defaults: {
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 3
  },
  styleTag: 'checkbox'
});
NodeSharedPortDefinitions.addShadowInputs(CheckBoxNode, {
  styleTag: 'checkbox'
});
Utils.addControlEventsAndStates(CheckBoxNode, { checked: true });

export default createNodeFromReactComponent(CheckBoxNode);
