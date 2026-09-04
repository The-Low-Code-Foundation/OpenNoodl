import { Select } from '../../components/controls/Select';
import guid from '../../guid';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import Utils from './utils';

/**
 * A freshly dragged Dropdown showed an empty select with nothing in the list — restoring this
 * is a "go back to how it used to work" from Richard, 2026-09-04 (see
 * `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md` §3).
 * A `default` on `items` alone does not reach the render: `items` has a custom `set` (below),
 * and the runtime only seeds `default` into `_inputValues` for an unauthored port — it never
 * calls the port's own `set`, so `props.items` (what `Select.tsx` reads) would stay `undefined`.
 * `initialize` below seeds `props.items` directly for that reason; `default` stays on the port
 * too, so the property panel's summary ("2 items" instead of "Empty list") matches what renders.
 */
const DEFAULT_ITEMS = [
  { Label: 'Option 1', Value: 'option-1' },
  { Label: 'Option 2', Value: 'option-2' }
];

const OptionsNode = {
  name: 'net.noodl.controls.options',
  displayName: 'Dropdown',
  docs: 'https://docs.noodl.net/nodes/ui-controls/dropdown',
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
  initialize: function () {
    this._itemsChanged = () => {
      this.forceUpdate();
    };

    /**
     * NDA-012 (Visual). `on`/`off` are installed on `Array.prototype` by `collection.ts`, so a
     * plain array carries them as well as a Collection does — but `null` does not, and neither
     * does anything that slipped past the `array` cast. Every subscribe and unsubscribe goes
     * through here so the guard cannot be applied on one side and forgotten on the other, which
     * is how the leak below survived.
     */
    this._unbindItems = () => {
      const items = this._internal.items;
      if (items && typeof items.off === 'function') items.off('change', this._itemsChanged);
    };

    // NDA-012 (Visual), check H1 — the `change` listener outlived the node: nothing ever removed
    // it, so a deleted Dropdown went on re-rendering whenever its collection changed. Same shape
    // and same remedy as `Drag`'s snap-timer leak.
    this.addDeleteListener(() => {
      this._unbindItems();
    });

    this.props.id = 'input-' + guid();
    this.props.items = DEFAULT_ITEMS.map((item) => ({ ...item }));

    this.props.valueChanged = (value) => {
      const changed = this._internal.value !== value;
      this._internal.value = value;
      if (changed) {
        this.flagOutputDirty('value');
        this.sendSignalOnOutput('onChange');
      }
    };
  },
  getReactComponent() {
    return Select;
  },
  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description:
        'Options to offer, as an array of objects with Label and Value properties; an empty value offers nothing',
      group: 'General',
      default: DEFAULT_ITEMS,
      /**
       * NDA-012 (Visual). Three defects lived in the eleven lines this replaces, and one rewrite
       * closes all three:
       *
       * - **`Items = null` threw.** `newValue.on('change', \u2026)` ran unconditionally, so a query
       *   that came back empty took the node down with a `TypeError`. Per
       *   `EMPTY-VALUE-CONTRACT.md`, `undefined` abstains and `null` clears \u2014 a cleared Dropdown
       *   offers no options, which `Select` already renders correctly (`!props.items`).
       * - **A re-sent collection left two `change` listeners.** The old `off` was conditional on
       *   `items !== newValue`, so re-sending the *same* collection skipped it \u2014 and then the
       *   `on` ran anyway. Each re-send added a listener and the node re-rendered once per
       *   duplicate. Identity-guarding the whole bind/unbind pair is the shape `ForEach` uses
       *   (`foreach.tsx:214`).
       * - **The listener was never removed on delete.** See `initialize`.
       */
      set: function (newValue) {
        // `undefined` means "no opinion": leave whatever is showing alone.
        if (newValue === undefined) return;

        if (this._internal.items !== newValue) {
          this._unbindItems();
          this._internal.items = newValue;
          if (newValue && typeof newValue.on === 'function') newValue.on('change', this._itemsChanged);
        }

        this.props.items = this._internal.items;

        this.forceUpdate();
      }
    },
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'General',
      description: 'Selects the option with this Value; a value matching no option deselects everything. Setting it from the graph does not fire Changed',
      set: function (value) {
        if (value !== undefined && typeof value !== 'string') {
          if (value?.toString !== undefined) value = value.toString();
          else return;
        }

        // // if value is passed in before the items, then items is undefined
        // if (this._internal.items) {
        //   //make sure this is a valid value that exists in the dropdown. If it doesn't, deselect all options
        //   value = this._internal.items.find((i) => i.Value === value) ? value : undefined;
        // }

        const changed = value !== this._internal.value;
        this.props.value = this._internal.value = value;

        if (changed) {
          this.forceUpdate();
          this.flagOutputDirty('value');
        }
      }
    }
  },
  inputProps: {
    placeholder: {
      displayName: 'Placeholder',
      description: 'Text shown while nothing is selected',
      type: 'string',
      group: 'Placeholder'
    },
    placeholderOpacity: {
      group: 'Placeholder',
      displayName: 'Placeholder opacity',
      description: 'How faded the placeholder text is, from 0 to 1',
      type: 'number',
      default: 0.5
    }
  },
  outputs: {
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'States',
      description: 'Value of the option currently selected',
      getter: function () {
        return this._internal.value;
      }
    },
    onChange: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when the user picks a different option; a value arriving on the Value input does not fire it'
    }
  },
  inputCss: {
    backgroundColor: {
      index: 100,
      displayName: 'Background Color',
      description: 'Fill colour of the closed dropdown; the open list is drawn by the browser and cannot be styled here',
      group: 'Style',
      type: 'color',
      default: 'transparent',
      styleTag: 'inputWrapper',
      allowVisualStates: true
    }
  }
};

NodeSharedPortDefinitions.addDimensions(OptionsNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Content'
});
NodeSharedPortDefinitions.addAlignInputs(OptionsNode);
NodeSharedPortDefinitions.addTextStyleInputs(OptionsNode);
NodeSharedPortDefinitions.addTransformInputs(OptionsNode);
NodeSharedPortDefinitions.addPaddingInputs(OptionsNode, {
  styleTag: 'inputWrapper'
});
NodeSharedPortDefinitions.addMarginInputs(OptionsNode);
NodeSharedPortDefinitions.addIconInputs(OptionsNode, {
  enableIconPlacement: true,
  defaults: { useIcon: false, iconColor: '#000000' }
});
NodeSharedPortDefinitions.addLabelInputs(OptionsNode, {
  enableSpacing: true,
  styleTag: 'label'
});
NodeSharedPortDefinitions.addSharedVisualInputs(OptionsNode);
NodeSharedPortDefinitions.addBorderInputs(OptionsNode, {
  defaults: {
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 5
  },
  styleTag: 'inputWrapper'
});

NodeSharedPortDefinitions.addShadowInputs(OptionsNode, {
  styleTag: 'inputWrapper'
});
Utils.addControlEventsAndStates(OptionsNode);

export default createNodeFromReactComponent(OptionsNode);
