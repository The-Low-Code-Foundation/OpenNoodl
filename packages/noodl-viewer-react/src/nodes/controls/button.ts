import { Button } from '../../components/controls/Button';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent } from '../../react-component-node';
import Utils from './utils';

const ButtonNode = {
  name: 'net.noodl.controls.button',
  displayName: 'Button',
  docs: 'https://docs.noodl.net/nodes/ui-controls/button',
  allowChildren: true,
  noodlNodeAsProp: true,
  usePortAsLabel: 'label',
  portLabelTruncationMode: 'length',
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
      'Label',
      'Label Text Style',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },
  initialize() {
    this.props.layout = 'row'; //Used to tell child nodes what layout to expect
  },
  getReactComponent() {
    return Button;
  },
  inputCss: {
    backgroundColor: {
      index: 100,
      displayName: 'Background Color',
      description: 'Fill colour behind the label and icon',
      group: 'Style',
      type: 'color',
      default: '#000000',
      allowVisualStates: true
    }
  },
  outputProps: {
    onClick: {
      displayName: 'Click',
      group: 'Events',
      description: 'Fires when the button is clicked or tapped, and on Enter or Space while it has keyboard focus',
      type: 'signal'
    }
  }
};

NodeSharedPortDefinitions.addDimensions(ButtonNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Content'
});
NodeSharedPortDefinitions.addTextStyleInputs(ButtonNode);
NodeSharedPortDefinitions.addAlignInputs(ButtonNode);
NodeSharedPortDefinitions.addTransformInputs(ButtonNode);
// NDA-012 (Visual), DV-ii. Button's padding was specified twice, in two files, by two
// mechanisms — these declared defaults and `assets/style.css`'s `.ndl-controls-button
// { padding: 5px 20px 5px 20px }` — and **only the stylesheet was load-bearing**. The two copies
// carrying the same numbers is why it went unnoticed: change the declaration and nothing moved.
//
// ⚠️ Live QA disproved this finding's first version, which said a fresh Button renders with no
// padding. It does not; the stylesheet supplies exactly these numbers. Deleting the duplicate
// leaves one source for the base padding and keeps the ports as overrides, which is the honest
// half of the pair. The alternative — dropping `applyDefault: false` — would have made both
// copies live instead.
NodeSharedPortDefinitions.addPaddingInputs(ButtonNode);
NodeSharedPortDefinitions.addMarginInputs(ButtonNode);
NodeSharedPortDefinitions.addLabelInputs(ButtonNode, {
  defaults: { useLabel: true }
});
NodeSharedPortDefinitions.addIconInputs(ButtonNode, {
  enableIconPlacement: true,
  /**
   * 🔴 **The one node with NO icon colour default — it inherits the label's.**
   *
   * Every other node takes the shared `#000000`. A Button cannot: its default `primary` variant
   * paints a filled `--primary` ground with `--primary-foreground` text, where black is invisible;
   * `outline` and `ghost` are transparent with `--foreground` text, where white is invisible. No
   * constant is right for both, and the white this used to carry was simply the first of the two
   * wrong answers.
   *
   * Leaving it unset makes the icon inherit the button's own resolved text colour — see the note
   * in `Button.tsx`'s `_renderIcon`. Ruled by Richard, 2026-09-04: *"Same as label colour I'd
   * imagine."* It is also the only answer that stays correct for a variant nobody has written yet.
   */
  defaults: { useIcon: false, iconColor: undefined }
});
NodeSharedPortDefinitions.addSharedVisualInputs(ButtonNode);
NodeSharedPortDefinitions.addBorderInputs(ButtonNode);
NodeSharedPortDefinitions.addShadowInputs(ButtonNode);

Utils.addControlEventsAndStates(ButtonNode);

export default createNodeFromReactComponent(ButtonNode);
