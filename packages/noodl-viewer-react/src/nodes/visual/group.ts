import { Group } from '../../components/visual/Group';
import { flexDirectionValues } from '../../constants/flex';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { createTooltip } from '../../tooltips';

const GroupNode: ReactNodeDefinition = {
  name: 'Group',
  docs: 'https://docs.noodl.net/nodes/basic-elements/group',
  connectionPanel: {
    groupPriority: ['General', 'Style', 'Events', 'Mounted', 'Hover Events', 'Pointer Events', 'Focus', 'Scroll']
  },
  initialize() {
    this._internal = {
      scrollElementDuration: 500,
      scrollIndexDuration: 500,
      scrollIndex: 0
    };
    this.props.layout = 'column';
  },
  getReactComponent() {
    return Group;
  },
  noodlNodeAsProp: true,
  visualStates: [
    { name: 'neutral', label: 'Neutral' },
    { name: 'hover', label: 'Hover' }
  ],
  defaultCss: {
    display: 'flex',
    position: 'relative',
    flexDirection: 'column'
  },
  inputs: {
    flexDirection: {
      //don't rename for backwards compat
      index: 12,
      displayName: 'Layout',
      group: 'Layout',
      description: 'How children are stacked: None positions them absolutely, Vertical stacks them down, Horizontal across',
      type: {
        name: 'enum',
        enums: [
          { label: 'None', value: 'none' },
          { label: 'Vertical', value: 'column' },
          { label: 'Horizontal', value: 'row' }
        ]
      },
      default: 'column',
      set(value) {
        this.setLayout(value);

        if (value !== 'none') {
          this.setStyle({ flexDirection: value });
        } else {
          this.removeStyle(['flexDirection']);
        }

        // NDA-012 (Visual) B2. This was `editorConnection.sendWarning`, which exists only in
        // the editor — so an invalid Layout was diagnosed while building and silent once
        // deployed, which is the whole of defect class B. It goes on the runtime error bus now
        // (`FAILURE-CONTRACT.md`); the editor still shows it, because `sendWarning` is one of
        // the bus's subscribers.
        const code = 'group/layout-not-a-flex-direction';
        if (value !== 'none' && !flexDirectionValues.includes(value)) {
          this.raiseRuntimeError(
            code,
            `Layout is ${JSON.stringify(value)}, which is not a flex-direction — expected one of ${flexDirectionValues
              .map((v) => JSON.stringify(v))
              .join(', ')}, or "none"`
          );
        } else if (this.context.editorConnection && this.context.editorConnection.clearWarning) {
          // The bus has no "un-raise", so the editor's clear path stays: without it a Layout
          // that was briefly wrong while being typed would leave a warning for the session.
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, code);
        }

        this.forceUpdate();
      }
    },
    'scrollToIndex.do': {
      displayName: 'Scroll To Index - Do',
      description: 'Scrolls to the child at Index. \u26a0\ufe0f There is no signal for when the scroll finishes',
      group: 'Scroll To Index',
      type: 'signal',
      index: 505,
      valueChangedToTrue() {
        // NDA-012 (Visual) A3. Both scroll actions used to test `innerReactComponentRef`, and
        // at *different times* — this one inside `scheduleAfterInputsHaveUpdated`, its sibling
        // before scheduling — so a `Do` in the frame the Group mounts was honoured by one and
        // dropped by the other. Neither placement worked: the ref commits after the graph
        // update either way. `withInnerComponent` waits for the ref itself.
        //
        // The scheduling stays. It is not the guard — it is what lets `Index` and `Duration`
        // land in the same frame as the `Do` that reads them.
        this.scheduleAfterInputsHaveUpdated(() => {
          const childIndex = this._internal.scrollIndex;
          const duration = this._internal.scrollIndexDuration;
          this.withInnerComponent((inner) => {
            // B2: the component returns why it did nothing, and that reaches a deployed app.
            const reason = inner.scrollToIndex(childIndex, duration);
            if (typeof reason === 'string') {
              this.raiseRuntimeError('group/scroll-to-index-failed', `Scroll To Index did nothing: ${reason}`);
            }
          });
        });
      }
    },
    'scrollToElement.do': {
      displayName: 'Scroll To Element - Do',
      description: 'Scrolls to the element on Element; fired in the same frame the Group mounts, it is held until the Group exists rather than dropped',
      group: 'Scroll To Element',
      type: 'signal',
      index: 500,
      valueChangedToTrue() {
        this.scheduleAfterInputsHaveUpdated(() => {
          const element = this._internal.scrollElement;
          const duration = this._internal.scrollElementDuration;
          this.withInnerComponent((inner) => {
            const reason = inner.scrollToElement(element, duration);
            if (typeof reason === 'string') {
              this.raiseRuntimeError('group/scroll-to-element-failed', `Scroll To Element did nothing: ${reason}`);
            }
          });
        });
      }
    },
    'scrollToElement.element': {
      displayName: 'Scroll To Element - Element',
      description: 'Which element to scroll to, taken from another node\'s DOM Element output',
      group: 'Scroll To Element',
      type: 'reference',
      index: 501,
      set(value) {
        this._internal.scrollElement = value;
      }
    },
    'scrollToElement.duration': {
      displayName: 'Scroll To Element - Duration',
      description: 'How long the scroll animation takes, in milliseconds; 0 jumps',
      group: 'Scroll To Element',
      type: 'number',
      default: 500,
      index: 502,
      set(value) {
        this._internal.scrollElementDuration = value;
      }
    },
    'scrollToIndex.index': {
      displayName: 'Scroll To Index - Index',
      description: 'Zero-based index of the child to scroll to',
      group: 'Scroll To Index',
      type: 'number',
      default: 0,
      index: 506,
      set(value) {
        this._internal.scrollIndex = value;
      }
    },
    'scrollToIndex.duration': {
      displayName: 'Scroll To Index - Duration',
      description: 'How long the scroll animation takes, in milliseconds; 0 jumps',
      group: 'Scroll To Index',
      type: 'number',
      default: 500,
      index: 507,
      set(value) {
        this._internal.scrollIndexDuration = value;
      }
    },
    focus: {
      displayName: 'Focus',
      type: 'signal',
      description: 'Gives this group keyboard focus, so key events reach it',
      group: 'Focus',
      valueChangedToTrue() {
        this.context.setNodeFocused(this, true);
      }
    }
  },
  inputProps: {
    clip: {
      index: 19,
      displayName: 'Clip Content',
      description: 'Hides any child that overflows the group instead of letting it spill out',
      type: 'boolean',
      group: 'Layout',
      default: false
    },
    scrollEnabled: {
      index: 54,
      group: 'Scroll',
      displayName: 'Enable Scroll',
      description: 'Lets the user scroll the children when they do not all fit',
      type: 'boolean',
      default: false
    },
    scrollSnapEnabled: {
      index: 55,
      displayName: 'Snap',
      description: 'Makes scrolling settle on item boundaries rather than anywhere',
      group: 'Scroll',
      type: 'boolean',
      default: false
    },
    scrollSnapToEveryItem: {
      index: 56,
      displayName: 'Snap To Every Item',
      description: 'Snaps to each item in turn instead of allowing a fast flick past several',
      group: 'Scroll',
      type: 'boolean',
      default: false
    },
    showScrollbar: {
      index: 57,
      displayName: 'Show Scrollbar',
      description: 'Shows a scrollbar rather than scrolling invisibly',
      group: 'Scroll',
      type: 'boolean',
      default: false
    },
    scrollBounceEnabled: {
      index: 58,
      displayName: 'Bounce at boundaries',
      description: 'Lets the content overscroll and spring back at the ends',
      group: 'Scroll',
      type: 'boolean',
      default: true
    },
    nativeScroll: {
      index: 60,
      group: 'Scroll',
      displayName: 'Native platform scroll',
      description: 'Uses the browser\'s own scrolling, which is smoother; turn it off to get snapping and the Scroll To actions',
      type: 'boolean',
      default: true
    },
    as: {
      index: 100000,
      group: 'Advanced HTML',
      displayName: 'Tag',
      description: 'HTML element to render as, which changes nothing visually but matters for screen readers and SEO',
      type: {
        name: 'enum',
        enums: [
          { label: '<div>', value: 'div' },
          { label: '<section>', value: 'section' },
          { label: '<article>', value: 'article' },
          { label: '<aside>', value: 'aside' },
          { label: '<nav>', value: 'nav' },
          { label: '<header>', value: 'header' },
          { label: '<footer>', value: 'footer' },
          { label: '<main>', value: 'main' },
          { label: '<span>', value: 'span' }
        ]
      },
      default: 'div'
    }
  },
  inputCss: {
    alignItems: {
      index: 13,
      group: 'Align and justify content',
      displayName: 'Align Items',
      description: 'Where children sit across the layout direction',
      type: {
        name: 'enum',
        enums: [
          { label: 'Start', value: 'flex-start' },
          { label: 'End', value: 'flex-end' },
          { label: 'Center', value: 'center' }
        ],
        alignComp: 'align-items'
      },
      default: 'flex-start'
    },
    justifyContent: {
      index: 14,
      group: 'Align and justify content',
      displayName: 'Justify Content',
      description: 'Where children sit along the layout direction when they do not fill it',
      type: {
        name: 'enum',
        enums: [
          { label: 'Start', value: 'flex-start' },
          { label: 'End', value: 'flex-end' },
          { label: 'Center', value: 'center' },
          { label: 'Space Between', value: 'space-between' },
          { label: 'Space Around', value: 'space-around' },
          { label: 'Space Evenly', value: 'space-evenly' }
        ],
        alignComp: 'justify-content'
      },
      default: 'flex-start',
      applyDefault: false
    },
    flexWrap: {
      index: 15,
      displayName: 'Multi Line Wrap',
      description: 'Lets children wrap onto another line when they do not fit on one',
      group: 'Layout',
      type: {
        name: 'enum',
        enums: [
          { label: 'Off', value: 'nowrap' },
          { label: 'On', value: 'wrap' },
          { label: 'On Reverse', value: 'wrap-reverse' }
        ]
      },
      default: 'nowrap',
      onChange(value) {
        this.props.flexWrap = value;
        this.forceUpdate(); //scroll direction needs to be recomputed
      },
      applyDefault: false
    },
    alignContent: {
      index: 16,
      group: 'Layout',
      displayName: 'Align Content',
      description: 'Where the wrapped lines sit as a group; only applies once Multi Line Wrap is on',
      type: {
        name: 'enum',
        enums: [
          { label: 'Start', value: 'flex-start' },
          { label: 'End', value: 'flex-end' },
          { label: 'Center', value: 'center' },
          { label: 'Space Between', value: 'space-between' },
          { label: 'Space Around', value: 'space-around' },
          { label: 'Space Evenly', value: 'space-evenly' }
        ],
        alignComp: 'align-content'
      }
      // default: 'flex-start'
    },
    rowGap: {
      index: 17,
      displayName: 'Vertical Gap',
      description: 'Space between children on the vertical axis',
      group: 'Layout',
      type: {
        name: 'number',
        units: ['px', '%', 'em'],
        defaultUnit: 'px'
      },
      default: 0,
      applyDefault: false
    },
    columnGap: {
      index: 18,
      displayName: 'Horizontal Gap',
      description: 'Space between children on the horizontal axis',
      group: 'Layout',
      type: {
        name: 'number',
        units: ['px', '%', 'em'],
        defaultUnit: 'px'
      },
      default: 0,
      applyDefault: false
    },
    backgroundColor: {
      index: 201,
      displayName: 'Background Color',
      description: 'Fill colour behind the children',
      group: 'Style',
      type: 'color',
      default: 'transparent',
      applyDefault: false,
      allowVisualStates: true
    }
  },
  outputProps: {
    onScrollPositionChanged: {
      displayName: 'Scroll Position',
      description: 'How far the content is scrolled, in pixels from the start',
      type: 'number',
      group: 'Scroll'
    },
    onScrollStart: {
      displayName: 'Scroll Start',
      type: 'signal',
      group: 'Scroll',
      description: 'Fires when the user starts scrolling'
    },
    onScrollEnd: {
      displayName: 'Scroll End',
      type: 'signal',
      group: 'Scroll',
      description: 'Fires when scrolling settles, including after a flick has coasted to a stop'
    }
  },
  outputs: {
    focused: {
      displayName: 'Focused',
      type: 'signal',
      group: 'Focus',
      description: 'Fires when this group takes keyboard focus'
    },
    focusLost: {
      displayName: 'Focus Lost',
      type: 'signal',
      group: 'Focus',
      description: 'Fires when keyboard focus leaves this group'
    }
  },
  dynamicports: [
    {
      condition: 'flexDirection != none',
      inputs: ['scrollEnabled']
    },
    {
      condition: 'flexDirection != none AND scrollEnabled = true',
      inputs: ['nativeScroll']
    },
    {
      condition: 'flexDirection != none AND scrollEnabled = true AND nativeScroll = false',
      inputs: [
        'scrollBounceEnabled',
        'scrollSnapEnabled',
        'showScrollbar',
        'scrollToElement.do',
        'scrollToElement.element',
        'scrollToElement.duration',
        'scrollToIndex.do',
        'scrollToIndex.index',
        'scrollToIndex.duration'
      ]
    },
    {
      condition: 'flexDirection != none AND scrollEnabled = true AND scrollSnapEnabled = true',
      inputs: ['scrollSnapToEveryItem']
    },
    {
      condition: 'flexDirection != none',
      inputs: ['flexWrap']
    },
    {
      condition: 'flexWrap = wrap OR flexWrap = wrap-reverse',
      inputs: ['alignContent']
    },
    {
      condition: 'flexDirection = row OR flexWrap = wrap OR flexWrap = wrap-reverse',
      inputs: ['columnGap']
    },
    {
      condition: 'flexDirection = column OR flexWrap = wrap OR flexWrap = wrap-reverse',
      inputs: ['rowGap']
    }
  ],
  methods: {
    _focus() {
      this.sendSignalOnOutput('focused');
    },
    _blur() {
      this.sendSignalOnOutput('focusLost');
    }
  }
};

NodeSharedPortDefinitions.addDimensions(GroupNode);
NodeSharedPortDefinitions.addTransformInputs(GroupNode);
NodeSharedPortDefinitions.addSharedVisualInputs(GroupNode);
NodeSharedPortDefinitions.addPaddingInputs(GroupNode);
NodeSharedPortDefinitions.addMarginInputs(GroupNode);
NodeSharedPortDefinitions.addAlignInputs(GroupNode);
NodeSharedPortDefinitions.addPointerEventOutputs(GroupNode);
NodeSharedPortDefinitions.addBorderInputs(GroupNode);
NodeSharedPortDefinitions.addShadowInputs(GroupNode);

function defineTooltips(node) {
  node.inputProps.clip.tooltip = createTooltip({
    title: 'Clip content',
    body: 'Controls if elements that are too big to fit will be clipped',
    images: [
      { src: 'clip-enabled.svg', label: 'Enabled' },
      { src: 'clip-disabled.svg', label: 'Disabled' }
    ]
  });

  node.inputCss.flexWrap.tooltip = createTooltip({
    title: 'Multiline wrap',
    body: "Elements will wrap to the next line when there's not enough space",
    images: [
      { src: 'multiline-h.svg', body: 'Using a horizontal layout' },
      { src: 'multiline-v.svg', body: 'Using a vertical layout' }
    ]
  });
}

// The deploy bootstrap sets `Noodl.deployed` (static/deploy/index.js); the old
// `Noodl.runDeployed` read was never set anywhere, so editor-only tooltip HTML
// was built and shipped inside deployed apps (DEBT-006, PLAT-003 NOTES §11.3).
// eslint-disable-next-line no-undef
if (!Noodl.deployed) {
  defineTooltips(GroupNode);
}

export default createNodeFromReactComponent(GroupNode);
