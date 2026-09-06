import type { EditorConnectionLike, GraphModelLike, GraphNodeModel, NodeContextLike } from '@noodl/types';

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
/**
 * ⚠️ **Value mirrors Label, and that is the whole point.** It was `option-1`/`option-2` until
 * Richard, 2026-09-06: *"the default value when placing a dropdown node is 'option-1' even though
 * the label is 'Option 1' which will further confuse the user."* A beginner meets these two rows
 * before they meet the idea that an option has a value at all; a default that already disagrees
 * with itself teaches the confusion on the first node they place. `listValueCodec`'s
 * `derivedValueForOption` makes the same choice for every option typed in Easy mode.
 */
const DEFAULT_ITEMS = [
  { Label: 'Option 1', Value: 'Option 1' },
  { Label: 'Option 2', Value: 'Option 2' }
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

    /**
     * Richard, 2026-09-04: *"The value input port should be by default set to the first item in the
     * default list when the node is placed … so the user immediately sees a dropdown in the preview
     * with a real option, not just a horizontally collapsed input."*
     *
     * 🔴 **The two default items above were not enough on their own, and this is why.** The visible
     * face of a Dropdown is the `<span>` in `Select.tsx`, not the native `<select>` — that is
     * `opacity: 0` and `position: absolute`, overlaid for interaction only. The span renders
     * `items[selectedIndex].Label`, and `selectedIndex` is `-1` whenever `value` is `undefined`. So
     * a freshly placed Dropdown drew an empty span, and at the `contentSize` default that node
     * measures its content: no content, no width. The options existed and nothing showed them.
     *
     * ⚠️ **Seeding BOTH `props.value` and `_internal.value` is load-bearing, not belt-and-braces.**
     * `Select`'s mount effect calls `valueChanged(props.value)`, and `valueChanged` fires
     * `onChange` when the incoming value differs from `_internal.value`. Seeding `props` alone
     * would make every placed Dropdown emit a spurious **Changed** signal on its first render —
     * the port's own description promises the opposite. `_internal.value` is also what the `value`
     * *output*'s getter returns, so seeding it is what keeps the graph agreeing with the screen.
     *
     * As with `items`, the port's `default` below cannot do this by itself: `value` has a custom
     * `set`, and the runtime never calls a port's `set` for an unauthored default.
     */
    this.props.value = this._internal.value = DEFAULT_ITEMS[0].Value;

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
      /**
       * §3 of NOTES-UNOWNED-NODE-WORK.md — Richard's chosen direction, 2026-09-04.
       *
       * 🔴 **`optionslist`, not `array`, and the difference is what an author has to know.** As an
       * `array` this port was a JSON blob: `Select.tsx` reads `i.Label` and `i.Value` on every
       * entry, so a beginner who typed the obvious `["Small", "Large"]` got three
       * `<option value="">` elements and nothing selectable — correct JSON, silently useless. The
       * `optionslist` codec mints `{ Label, Value }` from a bare label, so typing a label is
       * enough, and shows the object form only once an author overrides the derived value.
       *
       * ⚠️ **The stored shape changes and the decoder reads BOTH.** The old form was a string
       * holding a literal; a project carrying one still opens, because a port type that could not
       * read its own history would silently empty somebody's Dropdown.
       */
      type: 'optionslist',
      displayName: 'Items',
      description:
        'Options to offer. Type a label per option — the value it sends is the label — or switch the editor to Advanced and give an option its own Value when it must send something different',
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
      // Declared so the property panel shows the same selection the render does. `initialize`
      // is what actually seeds it — see the note there.
      default: DEFAULT_ITEMS[0].Value,
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
    /**
     * 🔴 Richard, 2026-09-06: *"no chevron down icon by default, to make it immediately look like
     * a 'normal' dropdown input."*
     *
     * ⚠️ **Not the `Icon` group, and deliberately not.** Those ports draw an author's decoration
     * from an installed icon set — a project that has installed none has nothing to point them at,
     * so a chevron defaulted through them would be a default that renders nothing in exactly the
     * new project that needs it most. The chevron is not decoration either: it is the affordance
     * that says *this control opens a list*, which every native `<select>` draws and this one
     * cannot, because the native element is `opacity: 0` and overlaid for interaction only
     * (`Select.tsx`). So it is drawn as inline SVG in `currentColor`, inherits the control's text
     * colour and size, and gets one port to turn it off.
     */
    showChevron: {
      displayName: 'Show Chevron',
      description: 'Draws the small downward arrow at the end of the control that marks it as a dropdown',
      type: 'boolean',
      default: true,
      group: 'Style',
      allowVisualStates: true
    },
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
/**
 * 🔴 Richard, 2026-09-06: *"The initial rendering of the dropdown has no padding at all between the
 * input border and contained option."* A 2px black border drawn hard against the selected label is
 * the one thing that made a placed Dropdown not read as an input at all.
 *
 * ⚠️ These are **applied**, not just declared — every other caller's padding default is inert by
 * design, and `addPaddingInputs` now applies only the sides a caller names. See the note there;
 * NDA-012's Icon defect was a declared padding no element ever received, and the property panel
 * showing 8 while the element computes 0 is the same defect wearing this node's name.
 */
NodeSharedPortDefinitions.addPaddingInputs(OptionsNode, {
  styleTag: 'inputWrapper',
  defaults: {
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6
  }
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

/**
 * The options this instance actually offers, read from the stored `items` parameter.
 *
 * ⚠️ **Editor-side only, and deliberately thinner than `listValueCodec.decodeOptionsList`.** That
 * codec lives in `noodl-core-ui` and this file is bundled into every viewer, so it is not
 * importable here. What is reproduced is the part this needs — a real array (the current stored
 * form) or a string holding JSON (the legacy `array` form) — and nothing else: a value it cannot
 * read yields no options, and {@link updateValuePort} then leaves the port a plain string rather than
 * offering a list that would be missing rows.
 */
function readItems(stored: unknown): { Label: string; Value: string }[] {
  let source: unknown = stored;

  if (typeof source === 'string') {
    if (source.trim() === '') return [];
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) return [];

  const out: { Label: string; Value: string }[] = [];
  for (const item of source) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const label = row.Label !== undefined ? row.Label : row.label;
      const value = row.Value !== undefined ? row.Value : row.value;
      if (label === undefined && value === undefined) continue;
      const labelText = String(label !== undefined ? label : value);
      out.push({ Label: labelText, Value: value !== undefined ? String(value) : labelText });
    } else {
      const labelText = String(item);
      out.push({ Label: labelText, Value: labelText });
    }
  }
  return out;
}

/**
 * 🔴 **Make `Value` a picker over the options this node actually has.** Richard, 2026-09-06:
 *
 * > *"The ideal would be the only values you can add in this field are from the list of dropdown
 * > items … I'd love to let the user have the dropdown selector on that field to choose one of the
 * > options they've created, and the value behind the option would be filled by default … But the
 * > default value field should really be a dropdown that has a live refreshed list of the options
 * > the user inputted in the json editor."*
 *
 * The port is declared `string` statically, because that is the only true answer where nothing can
 * be narrowed — a deployed viewer, the node catalog, the docs site. Here, with an editor
 * connected, the answer is knowable per node: it is this instance's own `items`. The enum's
 * **labels are the option Labels and its values are the option Values**, so an author who went to
 * Advanced mode and made `"Large"` send `l` still picks *"Large"* and still stores `l`.
 *
 * ⚠️ **The stored value is always among the choices, even when it is not one of the options.**
 * `EnumType` renders a value it cannot find as blank, and a Dropdown whose Value is fed from a
 * database — or was typed before the options were edited — would look empty while the parameter
 * still held it. So a value that matches nothing is offered back with a label that says so; it is
 * never rewritten, because only `onChange` writes and nothing here selects anything.
 *
 * ⚠️ **This REPLACES the static port rather than sitting beside it** — see `portOverrides.ts`
 * (FB-026). Keyed on name *and* plug, which is why `plug: 'input'` is exact: this node has a
 * `value` output too, and it must be left alone.
 *
 * ⚠️ **A connection is unaffected.** `string → enum` is a permitted cast that the runtime does not
 * have to convert, so wiring external data into this port neither warns nor changes — narrowing
 * the editor's picker was never allowed to make the port less connectable.
 */
function updateValuePort(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const items = parameters.items === undefined ? DEFAULT_ITEMS : readItems(parameters.items);

  // Nothing readable to offer: leave the static `string` port alone rather than replacing it with
  // an empty picker the author could not type into.
  if (items.length === 0) {
    editorConnection.sendDynamicPorts(nodeId, [] as never);
    return;
  }

  const enums = items.map((item) => ({ label: item.Label, value: item.Value }));

  const current = parameters.value;
  if (typeof current === 'string' && current !== '' && !enums.some((e) => e.value === current)) {
    enums.push({ label: `${current} (not in Items)`, value: current });
  }

  editorConnection.sendDynamicPorts(nodeId, [
    {
      name: 'value',
      type: { name: 'enum', enums },
      plug: 'input',
      group: 'General',
      displayName: 'Value',
      default: items[0].Value,
      description: OptionsNode.inputs.value.description
    }
  ] as never);
}

const OptionsModule = createNodeFromReactComponent(OptionsNode);

OptionsModule.setup = function (context: NodeContextLike, graphModel: GraphModelLike) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }

  graphModel.on('nodeAdded.' + OptionsNode.name, function (node: GraphNodeModel) {
    updateValuePort(node.id, node.parameters, context.editorConnection);

    node.on('parameterUpdated', function (event: { name: string }) {
      // `items` is the list itself; `value` is watched too so the "not in Items" fallback tracks
      // a value the author typed or a paste put there, rather than only appearing on reload.
      if (event.name === 'items' || event.name === 'value') {
        updateValuePort(node.id, node.parameters, context.editorConnection);
      }
    });
  });
};

export default OptionsModule;
