/**
 * NDA-004 §2 — the Video node, which had two invisible failures rather than the one predicted.
 *
 * The register's triage reasoned Video was probably a ✅ on one count: `HTMLMediaElement.play()`
 * returns a promise that the browsers' autoplay policy **rejects**, and all three call sites
 * dropped it. A `Play` on a page the user has not yet interacted with therefore did nothing at
 * all — no warning, no signal, no console line — which is the single most common way this node
 * "is broken" and was entirely unobservable.
 *
 * Reading it found a second: the `<video>` element's own `error` event had **no listener**. A 404
 * source, or one the browser cannot decode, never fires `canplay`, so a `Play` sets `wantToPlay`
 * and waits for ever. Indistinguishable from a node nobody pressed Play on.
 *
 * ## The row that matters most is the silent one
 *
 * `AbortError` — `play()` superseded by a `pause()` or a new source — rejects on a graph that is
 * working exactly as written. Reporting it would fire `Failure` on the happy path, which the
 * contract names as worse than having no port at all. That discrimination is the point of this
 * file, not the two positive rows.
 *
 * ## Limitation, recorded rather than hidden
 *
 * The viewer's jest runs `testEnvironment: node`, so there is no DOM to mount a `<video>` into
 * and no real `error` event to dispatch. These rows drive the `Video` component class directly
 * with a stub element, and reach the error path through the handler on the element `render()`
 * returns. That is the boundary this node owns — everything past it is the browser's media
 * stack — and the dropped promise *is* the defect. Same call as `F2`/`F3` in the corpus README.
 */

/* eslint-env jest */

import type { ReactElement } from 'react';

import { Video, type VideoProps } from '../../src/components/visual/Video/Video';

interface RaisedError {
  code: string;
  message: string;
  detail?: unknown;
}

/** What the three reporting surfaces recorded. */
interface Recorded {
  raised: RaisedError[];
  failures: number;
  errors: string[];
}

/**
 * A `Video` component wired to a stub media element.
 *
 * `play` is whatever the row needs it to be — a rejected promise with a given `DOMException`
 * name, a resolved one, or `undefined` for the engines that predate the promise entirely.
 */
function videoWith(play: () => Promise<void> | undefined): { video: Video; recorded: Recorded } {
  const recorded: Recorded = { raised: [], failures: 0, errors: [] };

  const props = {
    dom: { src: 'video.mp4' },
    objectPositionX: '50%',
    objectPositionY: '50%',
    noodlNode: {
      raiseRuntimeError(code: string, message: string, detail?: unknown) {
        recorded.raised.push({ code, message, detail });
      },
      setDOMElement() {
        /* the node keeps a reference; nothing here reads it */
      }
    },
    onPlaybackFailure() {
      recorded.failures++;
    },
    playbackError(message: string) {
      recorded.errors.push(message);
    }
  } as unknown as VideoProps;

  const video = new Video(props);

  // The element the component would have been handed by its `innerRef`.
  video.video = { play, currentTime: 0, pause() {} } as unknown as HTMLVideoElement;
  video.canPlay = true;

  return { video, recorded };
}

/** A `play()` that rejects with a `DOMException` of the given `name`. */
function rejectsWith(name: string, message = 'rejected'): () => Promise<void> {
  return () => Promise.reject(Object.assign(new Error(message), { name }));
}

/** Let the rejection handler run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('NDA-004 §2: a Play the browser refused', () => {
  test('the autoplay policy blocking playback is reported on all three surfaces', async () => {
    const { video, recorded } = videoWith(rejectsWith('NotAllowedError'));

    video.play();
    await settle();

    // All three, because each covers a hole the others do not: the channel reaches a deployed
    // app and `On App Error`, the signal is what a graph branches on, and the message is what
    // stops the signal from reproducing "no information" one level up.
    expect(recorded.raised.map((e) => e.code)).toEqual(['video/play-rejected']);
    expect(recorded.failures).toBe(1);
    expect(recorded.errors[0]).toContain('autoplay needs a user gesture');
  });

  test('the message names the fix, not just the fault', async () => {
    const { video, recorded } = videoWith(rejectsWith('NotAllowedError'));

    video.play();
    await settle();

    // "or the video has to be muted" is the actionable half. An author who is told only that
    // playback was blocked has nowhere to go.
    expect(recorded.errors[0]).toContain('muted');
    expect(recorded.raised[0].detail).toEqual({ name: 'NotAllowedError', message: 'rejected' });
  });

  test('an unplayable source is reported too', async () => {
    const { video, recorded } = videoWith(rejectsWith('NotSupportedError', 'no supported source'));

    video.play();
    await settle();

    expect(recorded.raised.map((e) => e.code)).toEqual(['video/play-rejected']);
    expect(recorded.errors[0]).toContain('no supported source');
  });

  test('Restart reports as well — it was the second of three sites dropping the promise', async () => {
    const { video, recorded } = videoWith(rejectsWith('NotAllowedError'));

    video.restart();
    await settle();

    expect(recorded.failures).toBe(1);
  });
});

describe('NDA-004 §2: the rejections that must stay silent', () => {
  test('AbortError does not fire Failure — the author’s own pause superseded the play', async () => {
    const { video, recorded } = videoWith(rejectsWith('AbortError', 'interrupted by pause()'));

    video.play();
    await settle();

    // The row this file exists for. Wiring `Play` then `Pause`, or changing `src` mid-play,
    // rejects the outstanding promise every time on a perfectly correct graph. A port that
    // fires there is worse than no port, and this is what holds it shut.
    //
    // Verified discriminating both ways, which took two separate reverts: emptying
    // `SILENT_PLAY_REJECTIONS` fails this row on its assertion (1 failure, expected 0) with
    // every other row still green, and deleting the promise handling altogether fails it as an
    // unhandled rejection instead. Only the first of those is this row's job; the second is
    // worth knowing so a future reader does not read the stack trace as the assertion.
    expect(recorded.failures).toBe(0);
    expect(recorded.raised).toEqual([]);
  });

  test('pinned control: a play that starts reports nothing', async () => {
    const { video, recorded } = videoWith(() => Promise.resolve());

    video.play();
    await settle();

    // Without this, every assertion above could be satisfied by a node that reports on every
    // play. It is also the happy path the contract prices at "a method that is never called".
    expect(recorded.failures).toBe(0);
    expect(recorded.raised).toEqual([]);
  });

  test('an engine whose play() returns undefined neither throws nor reports', async () => {
    const { video, recorded } = videoWith(() => undefined);

    // `play()` predates the promise. `.catch` on `undefined` would be a TypeError thrown out of
    // an input setter — which is exactly the shape of the crash NDA-004 §3 found in `Response`.
    expect(() => video.play()).not.toThrow();
    await settle();

    expect(recorded.failures).toBe(0);
    expect(recorded.raised).toEqual([]);
  });

  test('a Play before the video can play is deferred, not failed', async () => {
    const { video, recorded } = videoWith(rejectsWith('NotAllowedError'));
    video.canPlay = false;

    video.play();
    await settle();

    // Absence of readiness is not failure (Empty-Value Contract's sibling clause in the Failure
    // Contract: "absence of opinion" must not raise). The play is remembered and runs from
    // `onCanPlay` — where it *is* reported if it then fails.
    expect(recorded.failures).toBe(0);
    expect(video.wantToPlay).toBe(true);
  });
});

describe('NDA-004 §2: the media error nobody was listening for', () => {
  /** The `onError` handler off the element `render()` produces — see the file header. */
  function errorHandler(video: Video): (event: unknown) => void {
    const element = video.render() as ReactElement<{ onError(event: unknown): void }>;
    return element.props.onError;
  }

  test('a source that cannot be loaded is reported', () => {
    const { video, recorded } = videoWith(() => Promise.resolve());

    errorHandler(video)({
      target: { error: { code: 4, message: 'MEDIA_ELEMENT_ERROR: Format error' }, currentSrc: 'broken.mp4' }
    });

    expect(recorded.raised.map((e) => e.code)).toEqual(['video/media-error']);
    expect(recorded.errors[0]).toContain('Format error');
    expect(recorded.raised[0].detail).toEqual({ code: 4, src: 'broken.mp4' });
  });

  test('and it still says something useful when the browser supplies no message', () => {
    const { video, recorded } = videoWith(() => Promise.resolve());

    errorHandler(video)({ target: { error: { code: 2, message: '' }, currentSrc: '' } });

    // `MediaError.message` is allowed to be empty, and several browsers leave it that way.
    // Falling through to the raw exception name would have printed nothing at all.
    expect(recorded.errors[0]).toContain('check the Source URL and format');
  });
});
