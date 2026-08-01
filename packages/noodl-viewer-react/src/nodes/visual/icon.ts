import { Icon } from '../../components/visual/Icon';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

const IconNode: ReactNodeDefinition = {
  name: 'net.noodl.visual.icon',
  displayName: 'Icon',
  docs: 'https://docs.noodl.net/nodes/basic-elements/icon',
  allowChildren: false,
  noodlNodeAsProp: true,
  connectionPanel: {
    groupPriority: [
      'General',
      'Style',
      'Actions',
      'Events',
      'States',
      'Mounted',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },
  getReactComponent() {
    return Icon;
  }
};
NodeSharedPortDefinitions.addAlignInputs(IconNode);
NodeSharedPortDefinitions.addTransformInputs(IconNode);
// NDA-012 (Visual), DV-ii. This used to declare 5px on all four sides, and none of it ever
// reached the element: `addPaddingInputs` marks every padding port `applyDefault: false`, which
// blocks the `startStyle` route, and a declared `default` never runs its setter (FINDINGS DB-ii),
// which blocks the other. Driven live, an Icon computed `padding: 0px` while the property panel
// showed 5 — the panel was the only place the number existed.
//
// Unlike `Button`, Icon has no stylesheet rule to fall back on, which is why it is the node the
// defect actually cost. The declaration is deleted rather than made live: 0 is what Icon has
// always rendered, so this changes no pixels and stops the panel showing a number that does
// nothing. Padding is now the stylesheet's to set and the author's to override, one source each.
NodeSharedPortDefinitions.addPaddingInputs(IconNode);
NodeSharedPortDefinitions.addMarginInputs(IconNode);
NodeSharedPortDefinitions.addIconInputs(IconNode, {
  hideEnableIconInput: true,
  defaults: { useIcon: true }
});
NodeSharedPortDefinitions.addSharedVisualInputs(IconNode);

export default createNodeFromReactComponent(IconNode);
