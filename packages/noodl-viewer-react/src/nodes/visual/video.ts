import { Video } from '../../components/visual/Video';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
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
      group: 'Video',
      type: 'mediastream',
      default: null,
      set(value) {
        this.innerReactComponentRef && this.innerReactComponentRef.setSourceObject(value);
      }
    },
    play: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Play',
      tooltip: {
        standard: 'Play the video'
      },
      valueChangedToTrue() {
        this.innerReactComponentRef && this.innerReactComponentRef.play();
      }
    },
    restart: {
      type: 'signal',
      group: 'Video Actions',
      displayName: 'Restart',
      tooltip: {
        standard: 'Restart the video from the beginning'
      },
      valueChangedToTrue() {
        this.innerReactComponentRef && this.innerReactComponentRef.restart();
      }
    },
    pause: {
      type: 'boolean',
      group: 'Video Actions',
      displayName: 'Pause',
      valueChangedToTrue() {
        this.innerReactComponentRef && this.innerReactComponentRef.pause();
      }
    },
    reset: {
      type: 'boolean',
      group: 'Video Actions',
      displayName: 'Reset',
      valueChangedToTrue() {
        this.innerReactComponentRef && this.innerReactComponentRef.reset();
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
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    controls: {
      displayName: 'Controls',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    volume: {
      displayName: 'Volume',
      propPath: 'dom',
      group: 'Video',
      type: 'number',
      default: 1
    },
    muted: {
      displayName: 'Muted',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    loop: {
      displayName: 'Loop',
      propPath: 'dom',
      group: 'Video',
      type: 'boolean'
    },
    objectPositionX: {
      displayName: 'Video Position X',
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
      displayName: 'On Can Play'
    },
    onTimeUpdate: {
      group: 'Playback',
      displayName: 'Playback Position',
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
      propPath: 'dom'
    },
    onPause: {
      group: 'Events',
      displayName: 'On Pause',
      type: 'signal',
      propPath: 'dom'
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
      displayName: 'Playback Failure'
    },
    playbackError: {
      type: 'string',
      group: 'Events',
      displayName: 'Error'
    },
    onVideoElementCreated: {
      type: 'domelement',
      displayName: 'DOM Element'
    },
    videoWidth: {
      group: 'Playback',
      type: 'number',
      displayName: 'Video Width'
    },
    videoHeight: {
      group: 'Playback',
      type: 'number',
      displayName: 'Video Height'
    }
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
