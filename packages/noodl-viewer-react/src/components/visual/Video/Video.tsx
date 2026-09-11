import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { withMediaFragment } from '../../../media-fragment';
import { resolveVideoEmbed } from '../../../video-embed';
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
  /** §2 — seconds into the video to begin at. Composed into the `#t=` fragment. */
  startTime?: number;
  /** §2 — seconds at which to stop. Composed into the `#t=` fragment. */
  endTime?: number;

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
    // 🔴 Pulled OUT of the spread below, not just read from it. `{...this.props}` lands on the
    // `<video>` element, so a port named `startTime` would become an invalid DOM attribute and
    // React would warn about it on every render. They are inputs to the source string, not
    // attributes of the element.
    const { startTime, endTime, ...videoProps } = this.props;

    // §2 — the Android first-frame hack and the two ports are the same mechanism, resolved in
    // `withMediaFragment` rather than stacked here. With both ports unset this returns exactly
    // what this function used to build.
    let src = withMediaFragment(this.props.src ? this.props.src.toString() : undefined, startTime, endTime);

    if (src && src.startsWith('/')) {
      const baseUrl = Noodl.Env['BaseUrl'];
      if (baseUrl) {
        src = baseUrl + src.substring(1);
      }
    }

    return (
      <video
        {...videoProps}
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

    /**
     * §2 — a YouTube or Vimeo link plays in an `<iframe>` rather than failing in a `<video>`.
     *
     * 🔴 **Auto-detected from the Source rather than switched on by an enum.** The defect this
     * fixes is *pasting a link and getting a broken element*; a type the author must also remember
     * to change would leave that defect in place for exactly the person who hit it. Anything not
     * recognised returns `{ kind: 'file' }` and falls through to the path below unchanged.
     *
     * ⚠️ **The `<video>` element's whole API is absent here** — no `play()`, no `error` event, no
     * `videoWidth`. So `Play`/`Pause`/`Reset` and the failure ports do nothing for an embed, which
     * is a limit of URL-parameter embedding (Richard's ruling, 2026-09-04) and not a gap to be
     * papered over. `video.ts` says so on each affected port.
     */
    const embed = resolveVideoEmbed(props.dom?.src, {
      startTime: props.dom?.startTime,
      endTime: props.dom?.endTime,
      autoplay: props.dom?.autoplay,
      controls: props.dom?.controls,
      loop: props.dom?.loop,
      muted: props.dom?.muted
    });

    if (embed.kind === 'iframe') {
      return (
        <iframe
          className={props.className}
          style={{ ...style, border: 'none' }}
          src={embed.url}
          title={embed.title}
          // Only what a player needs. `allow` is an explicit grant list, so anything the provider
          // might reach for and is not named here stays denied.
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          ref={(element) => {
            // The drag node and `getDOMElement` expect *an* element; an iframe is the one this
            // node renders. Nothing that reads it as an HTMLVideoElement runs on this path.
            this.props.noodlNode?.setDOMElement(element as unknown as HTMLVideoElement);
          }}
          {...PointerListeners(this.props)}
        />
      );
    }

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
