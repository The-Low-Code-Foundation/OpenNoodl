import { Circle } from '../../components/visual/Circle';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

const CircleNode: ReactNodeDefinition = {
  name: 'Circle',
  docs: 'https://docs.noodl.net/nodes/basic-elements/circle',
  connectionPanel: {
    groupPriority: [
      'General',
      'Fill',
      'Stroke',
      'Dimensions',
      'Style',
      'Actions',
      'Events',
      'Mounted',
      'Margin and padding',
      'Pointer Events',
      'Hover Events'
    ]
  },
  getReactComponent() {
    return Circle;
  },
  noodlNodeAsProp: true,
  allowChildren: false,
  defaultCss: {
    flexShrink: 0,
    position: 'relative',
    display: 'flex'
  },
  inputProps: {
    size: {
      displayName: 'Size',
      description: 'Diameter of the circle in pixels; it sets both width and height',
      default: '100',
      group: 'Dimension',
      type: {
        name: 'number'
      },
      index: 10,
      allowVisualStates: true
    },
    fillEnabled: {
      group: 'Fill',
      displayName: 'Fill',
      description: 'Draws the inside of the circle; turn it off for an outline only',
      default: true,
      type: 'boolean',
      index: 20,
      allowVisualStates: true
    },
    fillColor: {
      group: 'Fill',
      displayName: 'Fill Color',
      description: 'Colour of the inside of the circle, which has no effect while Fill is off',
      default: 'red',
      type: 'color',
      index: 21,
      allowVisualStates: true
    },
    strokeEnabled: {
      index: 23,
      group: 'Stroke',
      default: false,
      displayName: 'Stroke',
      description: 'Draws an outline around the circle; the two ports below do nothing while it is off',
      type: 'boolean',
      allowVisualStates: true
    },
    strokeWidth: {
      index: 24,
      group: 'Stroke',
      displayName: 'Stroke Width',
      description: 'Thickness of the outline in pixels, drawn centred on the circle edge',
      default: 10,
      type: {
        name: 'number'
      },
      allowVisualStates: true
    },
    strokeColor: {
      index: 25,
      group: 'Stroke',
      displayName: 'Stroke Color',
      description: 'Colour of the outline',
      type: 'color',
      default: 'black',
      allowVisualStates: true
    },
    strokeLineCap: {
      index: 26,
      group: 'Stroke',
      displayName: 'Line Cap',
      description: 'Shape of the outline ends when Start and End Angle make an arc rather than a full circle',
      type: {
        name: 'enum',
        enums: [
          { label: 'Butt', value: 'butt' },
          { label: 'Round', value: 'round' }
        ]
      },
      default: 'butt',
      allowVisualStates: true
    },
    startAngle: {
      displayName: 'Start Angle',
      description: 'Where the arc begins, in degrees clockwise from the top',
      type: 'number',
      default: 0,
      group: 'Style',
      index: 198,
      allowVisualStates: true
    },
    endAngle: {
      displayName: 'End Angle',
      description: 'Where the arc ends, in degrees clockwise from the top; 360 is a full circle',
      type: 'number',
      default: 360,
      group: 'Style',
      index: 199,
      allowVisualStates: true
    }
  }
};

NodeSharedPortDefinitions.addTransformInputs(CircleNode);
NodeSharedPortDefinitions.addMarginInputs(CircleNode);
NodeSharedPortDefinitions.addSharedVisualInputs(CircleNode);
NodeSharedPortDefinitions.addAlignInputs(CircleNode);
NodeSharedPortDefinitions.addPointerEventOutputs(CircleNode);

export default createNodeFromReactComponent(CircleNode);
