import { Image } from '../../components/visual/Image';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { resolveMediaSource } from './media-source';

const ImageNode: ReactNodeDefinition = {
  name: 'Image',
  docs: 'https://docs.noodl.net/nodes/basic-elements/image',
  noodlNodeAsProp: true,
  visualStates: [
    { name: 'neutral', label: 'Neutral' },
    { name: 'hover', label: 'Hover' }
  ],
  connectionPanel: {
    groupPriority: [
      'General',
      'Image',
      'Style',
      'Actions',
      'Events',
      'Mounted',
      'Pointer Events',
      'Hover Events',
      'Dimensions',
      'Margin and padding'
    ]
  },
  initialize() {
    this.props.default = '';
  },
  getReactComponent() {
    return Image;
  },
  getInspectInfo() {
    if (this.props.dom.srcSet) {
      return this.props.dom.srcSet;
    } else if (this.props.dom.src) {
      const src = this.props.dom.src.toString();
      return [
        { type: 'text', value: src },
        { type: 'image', value: src }
      ];
    }
  },
  allowChildren: false,
  defaultCss: {
    display: 'block',
    flexShrink: 0
  },
  inputCss: {
    objectFit: {
      displayName: 'Image Fit',
      description: 'How the image fills its box when the two have different proportions; only available with an explicit size',
      group: 'Dimensions',
      type: {
        name: 'enum',
        enums: [
          { label: 'Fill', value: 'fill' },
          { label: 'Contain', value: 'contain' },
          { label: 'Cover', value: 'cover' },
          { label: 'None', value: 'none' },
          { label: 'Scale Down', value: 'scale-down' }
        ]
      },
      default: 'contain',
      allowVisualStates: true
    }
  },
  dynamicports: [
    {
      condition: 'sizeMode = explicit',
      inputs: ['objectFit']
    }
  ],
  inputs: {
    // `propPath` is deliberately absent: this is an ordinary runtime input, and
    // `propPath` is only read from `inputProps`/`outputProps`. The `set` below
    // writes `props.dom` itself, which is what actually put the value there.
    src: {
      displayName: 'Source',
      group: 'Image',
      type: {
        name: 'image'
      },
      index: 30,
      allowVisualStates: true,
      description:
        'URL or project file to display; leave blank to show nothing rather than request a missing image',
      set(url) {
        this.props.dom.src = resolveMediaSource(url);
        this.forceUpdate();
      }
    }
  },
  inputProps: {
    srcSet: {
      displayName: 'Source Set',
      description: 'A srcset list letting the browser pick a resolution, e.g. "small.png 480w, large.png 1080w"',
      group: 'Image',
      propPath: 'dom',
      type: {
        name: 'string'
      },
      index: 31,
      allowVisualStates: true
    },
    alt: {
      // SIG-003 — the node's own subject heading, which `groupPriority` already
      // names, in preference to the `Values` kind heading. It sits with `Source`
      // and `Source Set`, which is where an author looking for it will look.
      group: 'Image',
      displayName: 'Alternate text',
      tooltip: "The alt text is used by screen readers, or if the image can't be downloaded or displayed",
      type: 'string',
      propPath: 'dom',
      index: 1000,
      default: ''
    }
  },
  outputProps: {
    onLoad: {
      displayName: 'On Load',
      propPath: 'dom',
      type: 'signal',
      group: 'Events',
      description: 'Fires once the image has finished downloading and is on screen'
    },
    /**
     * NDA-012 (Visual), checks B1/B2 — the port that existed and carried nothing.
     *
     * `FINDINGS.md` B-ii records, in passing, that *"`Image` has had an `On Error` port all
     * along; `Video` never got one"*, and NDA-004 §2 then built Video's failure surface
     * properly: a signal, an `Error` string beside it, and a `raiseRuntimeError` so the
     * diagnosis exists in a deployed app. **Image was left with the signal alone.** That is
     * B-xi's shape exactly — *"a bare signal reproduces 'no information' one level up"* — and
     * B-viii's lesson about a fix scoped by node rather than by shape, one file apart.
     *
     * `propPath` is deliberately gone. As a straight DOM forward this fired the element's own
     * `error` event and stopped there; the handler now lives in `Image.tsx` so the same event
     * can reach all three surfaces. The port keeps its name, so an existing wire is untouched.
     */
    onError: {
      displayName: 'On Error',
      type: 'signal',
      group: 'Events',
      description: 'Fires when the image could not be loaded, after the reason has been reported on Error'
    },
    imageError: {
      displayName: 'Error',
      type: 'string',
      group: 'Error',
      description: 'Why the image could not be loaded, naming the source that failed'
    }
  }
};

NodeSharedPortDefinitions.addDimensions(ImageNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Image'
});
NodeSharedPortDefinitions.addTransformInputs(ImageNode);
NodeSharedPortDefinitions.addMarginInputs(ImageNode);
NodeSharedPortDefinitions.addSharedVisualInputs(ImageNode);
NodeSharedPortDefinitions.addAlignInputs(ImageNode);
NodeSharedPortDefinitions.addPointerEventOutputs(ImageNode);
NodeSharedPortDefinitions.addBorderInputs(ImageNode);
NodeSharedPortDefinitions.addShadowInputs(ImageNode);

export default createNodeFromReactComponent(ImageNode);
