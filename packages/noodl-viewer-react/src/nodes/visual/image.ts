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
  /**
   * FB-015 AC4 — report what is actually driving the image.
   *
   * 🔴 This used to `return this.props.dom.srcSet` and stop, so an author who had set Source Set
   * once and was now debugging Source saw only the srcset string — with no hint that Source was
   * set at all, and no preview. That is the wrong way round: Source Set is the field with no
   * picker, no validation and no affordance, so it is the one more likely to be a leftover.
   *
   * Both are reported when both are set, labelled, because both are true: the browser picks a
   * candidate out of `srcset` and falls back to `src`. Only `src` can be previewed — `srcset` is a
   * list of candidates plus the descriptors that choose between them, and which one the browser
   * took depends on the viewport and the device pixel ratio at the moment it decided.
   */
  getInspectInfo() {
    const srcSet = this.props.dom.srcSet;
    const src = this.props.dom.src ? this.props.dom.src.toString() : undefined;

    if (!srcSet && !src) return;

    const info = [];
    if (srcSet) info.push({ type: 'text', value: `Source Set: ${srcSet}` });
    if (src) info.push({ type: 'text', value: srcSet ? `Source: ${src}` : src });
    if (src) info.push({ type: 'image', value: src });

    return info;
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
      // FB-015 AC4 — the shape, in the empty field. A `srcset` is the one image port with a
      // syntax rather than a value, and the field gave no clue what went in it.
      placeholder: 'small.png 480w, large.png 1080w',
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
// DEF-029 — file drop, off until the author switches it on.
NodeSharedPortDefinitions.addFileDropPorts(ImageNode);
NodeSharedPortDefinitions.addBorderInputs(ImageNode);
NodeSharedPortDefinitions.addShadowInputs(ImageNode);

export default createNodeFromReactComponent(ImageNode);
