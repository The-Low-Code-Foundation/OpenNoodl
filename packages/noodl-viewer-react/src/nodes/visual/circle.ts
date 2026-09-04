import { Circle } from '../../components/visual/Circle';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

/**
 * §1 of `dev-docs/.../NOTES-UNOWNED-NODE-WORK.md` — Richard: *"if you turn the circle node into
 * an SVG node, with some premade SVGs like circle, square etc… you'd be a hero."*
 *
 * 🔴 **EXTENDED IN PLACE. `name: 'Circle'` NEVER CHANGES.** Five artefacts key off the registered
 * type string — a lesson's `hasType` check, two prefabs, three catalog examples, and the export
 * path — so a renamed twin (the Button/Checkbox/Options pattern) would break all five. Every saved
 * Circle has no `shape` parameter, and the port gate below reads `shape NOT SET` as `circle`, so
 * nothing already on disk changes: there is no migration.
 *
 * Stage 1 (this commit): `shape` gets three values, and the two arc-only ports gate on it. Square
 * and Triangle join the shape maths in `Circle.tsx`; the export path (`analyze/plan.ts`,
 * `emit/component.ts`) defers a literal non-circle shape with a named marker rather than emitting
 * an arc nobody asked for — see the note beside `visualDeferReason`'s circle branch.
 */
const CircleNode: ReactNodeDefinition = {
  name: 'Circle',
  displayName: 'Shape',
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
    shape: {
      displayName: 'Shape',
      description: 'Which outline this element draws inside its Size × Size box',
      default: 'circle',
      group: 'General',
      type: {
        name: 'enum',
        enums: [
          { label: 'Circle', value: 'circle' },
          { label: 'Square', value: 'square' },
          { label: 'Triangle', value: 'triangle' },
          { label: 'Polygon', value: 'polygon' },
          { label: 'Star', value: 'star' }
        ]
      },
      index: 5,
      allowVisualStates: true
    },
    points: {
      displayName: 'Points',
      description: 'How many sides a Polygon has, or how many points a Star has; the minimum is 3',
      default: 5,
      group: 'General',
      type: {
        name: 'number'
      },
      index: 6,
      allowVisualStates: true
    },
    cornerRadius: {
      displayName: 'Corner Radius',
      description:
        'Rounds the corners of the straight-edged shapes, in pixels; it stops at the roundest the shape can be',
      default: 0,
      group: 'General',
      type: {
        name: 'number'
      },
      index: 7,
      allowVisualStates: true
    },
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
  },
  /**
   * 🔴 **`shape NOT SET` reads as `circle`, not as "hidden".** Every Circle saved before this
   * change has no `shape` parameter, so without the `NOT SET` clause the two prefabs pinned to
   * it (`progress-circle`, `states-kit`) would lose Start/End Angle from the panel the moment
   * this ships — the exact trap `node-shared-port-definitions.ts`'s `sizeMode` gate already
   * carries, one node over.
   *
   * ⚠️ **The clause form, not `#js`.** `portGateReason.ts` returns no *"why is this hidden"*
   * sentence for a `#js` condition, and `validation/portConditions.ts` abstains from it — so an
   * author who set `startAngle` on a Triangle would get no diagnostic at all.
   */
  dynamicports: [
    {
      condition: 'shape = circle OR shape NOT SET',
      inputs: ['startAngle', 'endAngle', 'strokeLineCap']
    },
    {
      condition: 'shape = polygon OR shape = star',
      inputs: ['points']
    },
    /**
     * 🔴 **Every straight-edged shape is NAMED, rather than `shape != circle`.** `!=` compares
     * `'' + getParameter('shape')` against `'circle'`, and an unset parameter stringifies to
     * `'undefined'` — so `shape != circle` is TRUE on every Circle saved before stage 1, and Corner
     * Radius would appear on all of them offering to round a shape that has no corners. Naming the
     * four shapes leaves an unset `shape` matching nothing, which is the same reading the group
     * above gets from its explicit `NOT SET` clause.
     */
    {
      condition: 'shape = square OR shape = triangle OR shape = polygon OR shape = star',
      inputs: ['cornerRadius']
    }
  ]
};

NodeSharedPortDefinitions.addTransformInputs(CircleNode);
NodeSharedPortDefinitions.addMarginInputs(CircleNode);
NodeSharedPortDefinitions.addSharedVisualInputs(CircleNode);
NodeSharedPortDefinitions.addAlignInputs(CircleNode);
NodeSharedPortDefinitions.addPointerEventOutputs(CircleNode);
// DEF-029 — file drop, off until the author switches it on.
NodeSharedPortDefinitions.addFileDropPorts(CircleNode);

export default createNodeFromReactComponent(CircleNode);
