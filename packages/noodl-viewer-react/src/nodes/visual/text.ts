import { Text } from '../../components/visual/Text';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { createTooltip } from '../../tooltips';

const TextNode: ReactNodeDefinition = {
  name: 'Text',
  docs: 'https://docs.noodl.net/nodes/basic-elements/text',
  visualStates: [
    { name: 'neutral', label: 'Neutral' },
    { name: 'hover', label: 'Hover' }
  ],
  allowChildren: false,
  noodlNodeAsProp: true,
  usePortAsLabel: 'text',
  portLabelTruncationMode: 'length',
  connectionPanel: {
    groupPriority: ['General', 'Text', 'Text Style', 'Style', 'Events', 'Mounted', 'Hover Events', 'Pointer Events']
  },
  nodeDoubleClickAction: {
    focusPort: 'text'
  },
  getReactComponent() {
    return Text;
  },
  getInspectInfo() {
    return this.props.text;
  },
  defaultCss: {
    position: 'relative',
    display: 'flex',
    // FIX: Text should size to content by default, not stretch to parent width
    width: 'auto'
  },
  inputProps: {
    text: {
      index: 19,
      group: 'Text',
      displayName: 'Text',
      description: 'The text to show; an empty value renders nothing rather than the words null or undefined',
      default: 'Text',
      type: {
        name: 'string',
        multiline: true
      }
    },
    as: {
      index: 100000,
      group: 'Advanced HTML',
      displayName: 'Tag',
      description:
        'HTML element to render the text as, which changes nothing visually but matters for screen readers and SEO',
      type: {
        name: 'enum',
        enums: [
          { label: '<div>', value: 'div' },
          { label: '<h1>', value: 'h1' },
          { label: '<h2>', value: 'h2' },
          { label: '<h3>', value: 'h3' },
          { label: '<h4>', value: 'h4' },
          { label: '<h5>', value: 'h5' },
          { label: '<h6>', value: 'h6' },
          { label: '<p>', value: 'p' },
          { label: '<span>', value: 'span' }
          // { label: '<a>', value: 'a' },
        ]
      },
      default: 'div'
    }
  },
  inputCss: {
    wordBreak: {
      index: 27,
      group: 'Text',
      displayName: 'Word Break',
      applyDefault: false,
      type: {
        name: 'enum',
        enums: [
          { label: 'Normal', value: 'normal' },
          { label: 'Break All', value: 'break-all' }
        ]
      },
      default: 'normal'
    },
    textOverflow: {
      index: 28,
      group: 'Text',
      displayName: 'Text Overflow',
      description:
        'What a line too long for its box does. Needs a width the text can exceed, so it has no effect while the size mode is content-sized',
      applyDefault: false,
      type: {
        name: 'enum',
        enums: [
          { label: 'Wrap', value: 'wrap' },
          { label: 'Clip', value: 'clip' },
          { label: 'Ellipsis', value: 'ellipsis' }
        ]
      },
      default: 'wrap'
    }
  },
  inputs: {
    textAlignX: {
      group: 'Text Alignment',
      index: 13,
      displayName: 'Text Horizontal Align',
      description: 'Aligns the text within its own box on the horizontal axis',
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
            this.setStyle({ textAlign: 'left', justifyContent: 'flex-start' });
            break;
          case 'center':
            this.setStyle({ textAlign: 'center', justifyContent: 'center' });
            break;
          case 'right':
            this.setStyle({ textAlign: 'right', justifyContent: 'flex-end' });
            break;
        }
      }
    },
    textAlignY: {
      group: 'Text Alignment',
      index: 14,
      displayName: 'Text Vertical Align',
      description: 'Aligns the text within its own box on the vertical axis, which is only visible when the box is taller than the text',
      type: {
        name: 'enum',
        enums: [
          { label: 'Top', value: 'top' },
          { label: 'Center', value: 'center' },
          { label: 'Bottom', value: 'bottom' }
        ],
        alignComp: 'vertical'
      },
      default: 'top',
      set(value) {
        switch (value) {
          case 'top':
            this.setStyle({ alignItems: 'flex-start' });
            break;
          case 'center':
            this.setStyle({ alignItems: 'center' });
            break;
          case 'bottom':
            this.setStyle({ alignItems: 'flex-end' });
            break;
        }
      }
    }
  }
};

NodeSharedPortDefinitions.addDimensions(TextNode, {
  defaultSizeMode: 'contentHeight',
  contentLabel: 'Text'
});
NodeSharedPortDefinitions.addTextStyleInputs(TextNode);
NodeSharedPortDefinitions.addAlignInputs(TextNode);
NodeSharedPortDefinitions.addTransformInputs(TextNode);
NodeSharedPortDefinitions.addMarginInputs(TextNode);
NodeSharedPortDefinitions.addSharedVisualInputs(TextNode);
NodeSharedPortDefinitions.addPointerEventOutputs(TextNode);
// DEF-029 — file drop, off until the author switches it on.
NodeSharedPortDefinitions.addFileDropPorts(TextNode);

function defineTooltips(node) {
  node.inputCss.wordBreak.tooltip = createTooltip({
    title: 'Word break',
    body: [
      'Control where line breaks are allowed',
      '- Normal: Break on spaces and other whitespace characters',
      '- Break All: Allow line breaks between any two characters, including inside words'
    ]
  });

  node.inputCss.textOverflow.tooltip = createTooltip({
    title: 'Text overflow',
    body: [
      'What a line too long for its box does',
      '- Wrap: Flow onto as many lines as it needs',
      '- Clip: Stay on one line and cut off at the edge',
      '- Ellipsis: Stay on one line and end in a \u2026 where it was cut',
      'Clip and Ellipsis need a width the text can exceed, so neither shows while the size mode is content-sized'
    ]
  });
}

// The deploy bootstrap sets `Noodl.deployed` (static/deploy/index.js); the old
// `Noodl.runDeployed` read was never set anywhere, so editor-only tooltip HTML
// was built and shipped inside deployed apps (DEBT-006, PLAT-003 NOTES §11.3).
// eslint-disable-next-line no-undef
if (!Noodl.deployed) {
  defineTooltips(TextNode);
}

export default createNodeFromReactComponent(TextNode);
