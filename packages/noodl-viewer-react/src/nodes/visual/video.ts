import { Video } from '../../components/visual/Video';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import { resolveMediaSource } from './media-source';

const VideoNode: ReactNodeDefinition = {
  name: 'Video',
  docs: 'https://docs.noodl.net/nodes/basic-elements/video',
  connectionPanel: {
    groupPriority: [
      'General',
      'Video',
      'Video Actions',
      'Style',
      'Actions',
      'Events',
      'Mounted',
      'Playback',
      'Pointer Events',
      'Hover Events',
      'Dimensions',
      'Margin and padding'
    ]
  },
  getReactComponent() {
    return Video;
  },
  allowChildren: false,
  noodlNodeAsProp: true,
  defaultCss: {
    display: 'block'
  },
  inputs: {
    srcObject: {
      displayName: 'Source Object',
      description: 'A live MediaStream to play, from a camera or screen capture, instead of a URL',
      group: 'Video',
      type: 'mediastream',
      default: null,
      set(value) {
        // Same treatment as the four actions below, and for the same reason: this is the only
        // path the source object takes, so one that arrives before mount used to be lost with
        // nothing to say so.
        this.withInnerComponent((inner) => inner.setSourceObject(value));
      }
    },
    play: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Play',
      description: 'Starts or resumes playback; fired before the element exists, it is held until the element exists rather than dropped',
      tooltip: {
        standard: 'Play the video'
      },
      valueChangedToTrue() {
        // NDA-012 (Visual) A3. Was `this.innerReactComponentRef && …`, which drops the action
        // when it arrives in the frame the node mounts — React's ref callback commits after
        // the graph update that delivered the signal. See `withInnerComponent`.
        //
        // ERG-001 §4 / DV-viii: and it now *says* it played. This node had twelve outputs and
        // not one of them could tell a graph a Video Action had finished.
        this.outcomeOnInnerComponent((inner) => inner.play(), { code: 'video/play-failed' });
      }
    },
    restart: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Restart',
      description: 'Seeks to the beginning and plays, then fires Done',
      tooltip: {
        standard: 'Restart the video from the beginning'
      },
      valueChangedToTrue() {
        this.outcomeOnInnerComponent((inner) => inner.restart(), { code: 'video/restart-failed' });
      }
    },
    /**
     * NDA-012 (Visual) check E1 — `pause` and `reset` are `signal`, like `play` and `restart`.
     *
     * They were declared `type: 'boolean'` and implemented with `valueChangedToTrue`, which is
     * the *signal* mechanism: the panel offered a toggle for something that is a pulse, and
     * setting `Pause` back to `false` did nothing at all — you had to use `Play`. Four ports,
     * one contract, two spellings, and the two spellings disagreed about what the port was.
     *
     * ⚠️ **Declaring `valueChangedToTrue` already replaces `type` with the signal type**
     * (`nodedefinition.ts`, `registerInput`), so the runtime and the catalog have always
     * called these signals. The `boolean` was only ever read by the *editor* panel, which is
     * exactly where the wrong affordance was being drawn. Saying `signal` here changes no
     * behaviour; it stops the declaration contradicting itself.
     */
    pause: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Pause',
      description: 'Pauses playback',
      valueChangedToTrue() {
        this.outcomeOnInnerComponent((inner) => inner.pause(), { code: 'video/pause-failed' });
      }
    },
    reset: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Reset',
      description: 'Stops playback and seeks to the beginning',
      valueChangedToTrue() {
        this.outcomeOnInnerComponent((inner) => inner.reset(), { code: 'video/reset-failed' });
      }
    },
    /**
     * NDA-012 (Visual), check G1 — see `media-source.ts`.
     *
     * A cleared Source used to be resolved to the literal path `/null`, which the browser
     * fetched, 404'd, and reported through NDA-004 §2's own `Playback Failure` port. So the
     * failure surface built in that pass was firing for an *empty* input as well as a broken
     * one — the Failure Contract's "must not raise on a legitimate empty result", reached from
     * the empty-value side rather than the failure side.
     */
    src: {
      displayName: 'Source',
      group: 'Video',
      type: 'string',
      description: 'URL or project file to play; leave blank to load nothing rather than fail on a missing source',
      set(src) {
        this.props.dom.src = resolveMediaSource(src);
        this.forceUpdate();
      }
    },
    poster: {
      displayName: 'Poster',
      group: 'Video',
      type: 'image',
      description: 'Still image shown until the video has enough data to play; leave blank to show nothing',
      set(src) {
        this.props.dom.poster = resolveMediaSource(src);
        this.forceUpdate();
      }
    }
  },
  inputProps: {
    autoplay: {
      displayName: 'Autoplay',
      description: 'Starts playing as soon as the video can; most browsers only allow this while Muted is on',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    controls: {
      displayName: 'Controls',
      description: 'Shows the browser\'s own play, seek and volume controls',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    volume: {
      displayName: 'Volume',
      description: 'Playback volume from 0 to 1',
      propPath: 'dom',
      group: 'Video',
      type: 'number',
      default: 1
    },
    muted: {
      displayName: 'Muted',
      description: 'Silences the video without changing Volume, and is what lets Autoplay work',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    loop: {
      displayName: 'Loop',
      description: 'Restarts the video automatically when it reaches the end',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    objectPositionX: {
      displayName: 'Video Position X',
      description: 'Which part of the video stays visible horizontally when Object Fit crops it',
      group: 'Video Layout',
      type: {
        name: 'number',
        units: ['%', 'px'],
        defaultUnit: '%'
      },
      default: 50
    },
    objectPositionY: {
      displayName: 'Video Position Y',
      description: 'Which part of the video stays visible vertically when Object Fit crops it',
      group: 'Video Layout',
      type: {
        name: 'number',
        units: ['%', 'px'],
        defaultUnit: '%'
      },
      default: 50
    }
  },
  inputCss: {
    objectFit: {
      displayName: 'Object Fit',
      description: 'How the video fills its box when the two have different proportions',
      group: 'Video Layout',
      type: {
        name: 'enum',
        enums: [
          {
            label: 'Contain',
            value: 'contain'
          },
          {
            label: 'Cover',
            value: 'cover'
          },
          {
            label: 'Fill',
            value: 'fill'
          },
          {
            label: 'None',
            value: 'none'
          }
        ]
      },
      default: 'contain'
    }
  },
  outputProps: {
    onCanPlay: {
      type: 'signal',
      group: 'Events',
      displayName: 'On Can Play',
      description: 'Fires once enough of the video has loaded to start playing'
    },
    onTimeUpdate: {
      group: 'Playback',
      displayName: 'Playback Position',
      description: 'How far into the video playback has reached, in seconds',
      type: 'number',
      propPath: 'dom',
      getValue(event) {
        return event.target.currentTime;
      }
    },
    onPlay: {
      group: 'Events',
      displayName: 'On Play',
      type: 'signal',
      propPath: 'dom',
      description: 'Fires when playback starts or resumes'
    },
    onPause: {
      group: 'Events',
      displayName: 'On Pause',
      type: 'signal',
      propPath: 'dom',
      description: 'Fires when playback pauses'
    },
    /**
     * NDA-004 §2. The register's triage predicted one failure here — `play()`'s rejected
     * promise under the autoplay policy — and reading the node found a second: the `<video>`
     * element's own `error` event had no listener at all, so a broken Source URL produced
     * nothing whatsoever. Both report through this one pair, with distinct codes on the
     * runtime channel (`video/play-rejected`, `video/media-error`).
     *
     * No `propPath`: these are called from `Video.tsx` rather than being DOM events forwarded
     * straight through, because each one also has to reach the runtime error channel — a
     * failure that only exists as a graph signal is invisible in a deployed app.
     */
    onPlaybackFailure: {
      type: 'signal',
      group: 'Events',
      displayName: 'Playback Failure',
      description: 'Fires when the video could not be loaded or played, after the reason has been reported on Error'
    },
    playbackError: {
      type: 'string',
      group: 'Events',
      displayName: 'Error',
      description: 'Why playback failed — either the browser refused to autoplay, or the source could not be decoded'
    },
    onVideoElementCreated: {
      type: 'domelement',
      displayName: 'DOM Element',
      description: 'The underlying video element, for a Group to scroll to or a script to reach'
    },
    videoWidth: {
      group: 'Playback',
      type: 'number',
      displayName: 'Video Width',
      description: 'Natural width of the video in pixels, known once it has loaded'
    },
    videoHeight: {
      group: 'Playback',
      type: 'number',
      displayName: 'Video Height',
      description: 'Natural height of the video in pixels, known once it has loaded'
    },
    /**
     * ERG-001 §4 / DV-viii. Seven of the eight Visual nodes with action inputs could not tell a
     * graph their action had finished; this is one of them. The ports are shared by every action
     * input on the node, which is the same shape `Run Tasks` and `Timer` already have.
     */
    ...outcomeOutputs({
      done: 'Fires once a Video Action has been carried out by the element',
      failure: 'Fires when the action never reached the element, because it has still not mounted'
    })
  }
};

NodeSharedPortDefinitions.addDimensions(VideoNode, {
  defaultSizeMode: 'contentSize',
  contentLabel: 'Video'
});
NodeSharedPortDefinitions.addTransformInputs(VideoNode);
NodeSharedPortDefinitions.addMarginInputs(VideoNode);
NodeSharedPortDefinitions.addSharedVisualInputs(VideoNode);
NodeSharedPortDefinitions.addAlignInputs(VideoNode);
NodeSharedPortDefinitions.addPointerEventOutputs(VideoNode);
NodeSharedPortDefinitions.addBorderInputs(VideoNode);

export default createNodeFromReactComponent(VideoNode);
