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
  defaults: { useIcon: false }
});
NodeSharedPortDefinitions.addSharedVisualInputs(ButtonNode);
NodeSharedPortDefinitions.addBorderInputs(ButtonNode);
NodeSharedPortDefinitions.addShadowInputs(ButtonNode);

Utils.addControlEventsAndStates(ButtonNode);

export default createNodeFromReactComponent(ButtonNode);
