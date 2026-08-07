import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';

export interface VideoProps extends Noodl.ReactProps {
  objectPositionX: string;
  objectPositionY: string;

  dom: Exclude<CachedVideoProps, 'innerRef' | 'onCanPlay'>;

  onCanPlay?: () => void;
  videoWidth?: (value: number) => void;
  videoHeight?: (value: number) => void;
  onVideoElementCreated?: (video) => void;
  /** NDA-004 §2: the `Playback Failure` signal. */
  onPlaybackFailure?: () => void;
  /** NDA-004 §2: the `Error` string that must accompany it. */
  playbackError?: (message: string) => void;
}

/**
 * Which `play()` rejections are failures — NDA-004 §2.
 *
 * `HTMLMediaElement.play()` returns a promise, and three things reject it. Two are genuine
 * failures the author cannot otherwise see; the third is the author's own doing and must stay
 * silent, because "a `Failure` port that can fire on the happy path is worse than no port".
 *
 * | `DOMException.name` | Why | Reported? |
 * |---|---|---|
 * | `NotAllowedError` | The browser's autoplay policy refused. Needs a gesture, or `muted` | **yes** |
 * | `NotSupportedError` | Nothing in the source is playable | **yes** |
 * | `AbortError` | The play was superseded by a `pause()` or a new source | no |
 *
 * `AbortError` is the discrimination that matters. Wiring `Play` and then `Pause` — or letting
 * a `src` change land mid-play — rejects the outstanding promise every time, on a graph that is
 * working exactly as written. Reporting it would train authors to ignore the port.
 */
const SILENT_PLAY_REJECTIONS = ['AbortError'];

export interface CachedVideoProps {
  className?: string;
  style?: React.CSSProperties;

  muted?: boolean;
  loop?: boolean;
  volume?: number;
  autoplay?: boolean;
  controls?: boolean;
  src: string;

  innerRef: (video: HTMLVideoElement) => void;
  onCanPlay: () => void;
  /** The element's own `error` event — nothing listened for it before NDA-004 §2. */
  onError?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}

class CachedVideo extends React.PureComponent<CachedVideoProps> {
  video: HTMLVideoElement;

  componentDidUpdate() {
    if (this.video) {
      this.video.muted = this.props.muted;
      this.video.loop = this.props.loop;
      this.video.volume = this.props.volume;
      this.video.autoplay = this.props.autoplay;
      this.video.controls = this.props.controls;
    }
  }

  render() {
    let src = this.props.src ? this.props.src.toString() : undefined;

    if (src) {
      if (src.indexOf('#t=') === -1) {
        src += '#t=0.01'; //force Android to render the first frame
      }
      if (src.startsWith('/')) {
        const baseUrl = Noodl.Env['BaseUrl'];
        if (baseUrl) {
          src = baseUrl + src.substring(1);
        }
      }
    }

    return (
      <video
        {...this.props}
        playsInline={true}
        src={src}
        {...PointerListeners(this.props)}
        ref={(video) => {
          this.video = video;
          this.props.innerRef(video);
        }}
      />
    );
  }
}

export class Video extends React.Component<VideoProps> {
  wantToPlay: boolean;
  canPlay: boolean;
  video: HTMLVideoElement;

  constructor(props: VideoProps) {
    super(props);

    this.wantToPlay = false;
    this.canPlay = false;
  }

  componentWillUnmount() {
    this.canPlay = false;
  }

  setSourceObject(src) {
    if (this.video.srcObject !== src) {
      this.video.srcObject = src;
      this.canPlay = false; //wait for can play event
    }
  }

  /**
   * NDA-004 §2 — the one place a playback failure becomes observable.
   *
   * All three surfaces at once, per the Failure Contract: the runtime error channel (so it
   * reaches `On App Error` and a deployed console, not just the editor), the `Failure` signal
   * an author can branch on, and the `Error` string that stops a bare signal from reproducing
   * "no information" one level up.
   */
  reportFailure(code: string, message: string, detail?: unknown) {
    this.props.noodlNode?.raiseRuntimeError(code, message, detail);
    this.props.playbackError && this.props.playbackError(message);
    this.props.onPlaybackFailure && this.props.onPlaybackFailure();
  }

  /**
   * Start playback and, unlike every previous call site, look at what `play()` came back with.
   *
   * The returned promise was dropped at all three sites. Under the browsers' autoplay policy a
   * `Play` on a page the user has not interacted with rejects with `NotAllowedError` and nothing
   * happens at all — the single most common way a Video node "does nothing", and it was entirely
   * invisible: no warning, no signal, no console line. `play()` predates the promise, so older
   * engines return `undefined`; hence the guard rather than a bare `.catch`.
   */
  startPlayback() {
    const started = this.video.play();
    if (!started || typeof started.catch !== 'function') return;

    started.catch((error: DOMException) => {
      const name = error && error.name;
      if (SILENT_PLAY_REJECTIONS.indexOf(name) !== -1) return;

      this.reportFailure(
        'video/play-rejected',
        name === 'NotAllowedError'
          ? 'The browser blocked playback: autoplay needs a user gesture, or the video has to be muted'
          : 'Playback could not start: ' + (error && error.message ? error.message : name),
        { name, message: error && error.message }
      );
    });
  }

  play() {
    this.wantToPlay = true;
    if (this.canPlay) {
      this.startPlayback();
    }
  }

  restart() {
    this.wantToPlay = true;
    if (this.canPlay) {
      this.video.currentTime = 0;
      this.startPlayback();
    }
  }

  pause() {
    this.wantToPlay = false;
    this.video && this.video.pause();
  }

  reset() {
    this.wantToPlay = false;
    if (this.video) {
      this.video.currentTime = 0;
      this.video.pause();
    }
  }

  render() {
    const props = this.props;
    const style = {
      ...props.style
    };

    Layout.size(style, props);
    Layout.align(style, props);

    if (style.opacity === 0) {
      style.pointerEvents = 'none';
    }

    style.objectPosition = `${props.objectPositionX} ${props.objectPositionY}`;

    return (
      <CachedVideo
        {...props.dom}
        className={props.className}
        style={style}
        innerRef={(video) => {
          this.video = video;
          this.props.noodlNode?.setDOMElement(video);
          this.props.onVideoElementCreated && this.props.onVideoElementCreated(video);
        }}
        onCanPlay={() => {
          this.canPlay = true;
          if (this.wantToPlay) {
            this.startPlayback();
          }
          this.props.onCanPlay && this.props.onCanPlay();
          this.props.videoWidth && this.props.videoWidth(this.video.videoWidth);
          this.props.videoHeight && this.props.videoHeight(this.video.videoHeight);
        }}
        /**
         * The element's `error` event, which nothing listened for.
         *
         * A 404 source, or one the browser cannot decode, produced total silence: `onCanPlay`
         * never fires, so a `Play` sets `wantToPlay` and waits for ever. The node looked
         * identical to one nobody had pressed Play on.
         */
        onError={(event) => {
          const mediaError = (event.target as HTMLVideoElement).error;
          this.reportFailure(
            'video/media-error',
            mediaError && mediaError.message
              ? 'The video could not be loaded: ' + mediaError.message
              : 'The video could not be loaded — check the Source URL and format',
            { code: mediaError && mediaError.code, src: (event.target as HTMLVideoElement).currentSrc }
          );
        }}
      />
    );
  }
}
