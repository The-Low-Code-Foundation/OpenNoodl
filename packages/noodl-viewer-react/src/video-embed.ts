/**
 * Recognise a YouTube or Vimeo link and turn it into an embeddable player URL.
 *
 * §2 of `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md`.
 *
 * > *"most people probably won't publish an mp4 with their project… the builder will add a hosted
 * > mp4 URL, or a Youtube or Vimeo video."* — Richard, 2026-09-04
 *
 * Before this, pasting a YouTube link produced a broken `<video>` element and a `video/media-error`
 * — a failure whose cause was invisible from the panel, because the port asked for a URL and a
 * YouTube link is a URL.
 *
 * ## 🔴 URL parameters only — Richard's ruling, 2026-09-04
 *
 * Nothing here loads a script. Both providers accept their playback options as query parameters on
 * the embed URL, so an `<iframe>` is the whole mechanism and a published app gains no third-party
 * JavaScript origin. **What that ruling costs is stated rather than hidden**: see
 * {@link EMBED_LIMITS}. A dependable `end` and reliable autoplay need each provider's player API,
 * and the ruling declines it, so the ports must promise only what parameters can deliver.
 *
 * ## Why the source port auto-detects instead of gaining a "type" enum
 *
 * The defect Richard hit is *pasting a link and getting a broken element*. An enum the author must
 * also remember to switch would leave that defect in place for exactly the person who hit it. A
 * link that is not recognised still falls through to the `<video>` path unchanged, so nothing that
 * worked before changes.
 *
 * @module video-embed
 */

/**
 * What a URL-parameter embed cannot do, per provider.
 *
 * 🔴 **Exported because the port descriptions and the tests both read it.** A limitation that
 * lives only in a comment gets promised away by the next person to write a description.
 */
export const EMBED_LIMITS = {
  youtube: {
    /** `end` is a URL parameter and is honoured, but the player rounds it to the nearest second. */
    end: 'approximate',
    /** Autoplay needs `mute=1`; browsers refuse an unmuted autoplay without a gesture. */
    autoplayRequiresMuted: true
  },
  vimeo: {
    /** 🔴 Vimeo's embed has NO end parameter at all. There is nothing to pass. */
    end: 'unsupported',
    autoplayRequiresMuted: true
  }
} as const;

export type VideoEmbed =
  | { kind: 'file' }
  | { kind: 'iframe'; provider: 'youtube' | 'vimeo'; url: string; title: string };

export interface EmbedOptions {
  startTime?: unknown;
  endTime?: unknown;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
}

/** A whole, non-negative number of seconds, or `undefined` for "not set". */
function seconds(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!isFinite(n)) return undefined;
  // ⚠️ Floored, not rounded: both providers take integer seconds, and rounding 9.6 up to 10 would
  // start the clip after the moment the author picked.
  return Math.max(0, Math.floor(n));
}

/**
 * The YouTube video id in a link, or `null`.
 *
 * Handles the three shapes a person actually pastes: a `watch?v=` page, a `youtu.be` short link,
 * and an `/embed/` URL somebody already prepared. ⚠️ The id charset is deliberately strict — a
 * `watch?v=` that does not carry a plausible id is left to the `<video>` path rather than turned
 * into an embed URL that would 404 inside an iframe with nothing to report.
 */
function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{6,})/i,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/i,
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|v|shorts)\/([A-Za-z0-9_-]{6,})/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** The Vimeo video id in a link, or `null`. */
function vimeoId(url: string): string | null {
  const patterns = [/player\.vimeo\.com\/video\/(\d+)/i, /vimeo\.com\/(?:channels\/[^/]+\/)?(\d+)/i];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * A start time the author typed into the URL itself (`?t=90`, `#t=1m30s`), so pasting a link
 * copied from "share at current time" does what the person expects.
 *
 * ⚠️ The Start Time port wins when both are present: it is the control the author can see.
 */
function startFromUrl(url: string): number | undefined {
  const match = url.match(/[?&#]t=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?\b/i) ?? url.match(/[?&]start=(\d+)/i);
  if (!match) return undefined;
  if (match.length === 2) return Number(match[1]);
  const [, h, m, s] = match;
  return (Number(h ?? 0) || 0) * 3600 + (Number(m ?? 0) || 0) * 60 + (Number(s) || 0);
}

/**
 * Decide how to play `src`, and build the player URL when it is an embed.
 *
 * Returns `{ kind: 'file' }` for anything that is not a recognised provider link — including an
 * empty source — so the caller's existing `<video>` path is reached unchanged.
 */
export function resolveVideoEmbed(src: string | undefined, options: EmbedOptions = {}): VideoEmbed {
  if (typeof src !== 'string' || src === '') return { kind: 'file' };

  const start = seconds(options.startTime) ?? startFromUrl(src);
  const end = seconds(options.endTime);
  const { autoplay, controls, loop, muted } = options;

  const yt = youtubeId(src);
  if (yt !== null) {
    const params: string[] = [];
    if (start !== undefined) params.push(`start=${start}`);
    // Dropped when it is not after the start — an empty range plays nothing, which reads as a
    // broken node. The same rule `media-fragment.ts` applies to the mp4 path.
    if (end !== undefined && (start === undefined || end > start)) params.push(`end=${end}`);
    if (autoplay) {
      params.push('autoplay=1');
      // 🔴 Not a preference. An unmuted autoplay is refused by every current browser without a
      // gesture, so an autoplaying embed that is not muted simply does not start — and there is no
      // API here to report that it didn't.
      params.push('mute=1');
    } else if (muted) {
      params.push('mute=1');
    }
    if (controls === false) params.push('controls=0');
    if (loop) {
      // ⚠️ YouTube's `loop` does nothing on its own for a single video: it loops a PLAYLIST, and
      // the documented way to loop one video is to make it a one-item playlist of itself.
      params.push('loop=1', `playlist=${yt}`);
    }
    return {
      kind: 'iframe',
      provider: 'youtube',
      // `youtube-nocookie.com` is YouTube's own privacy-preserving host and takes the identical
      // parameters. It is the better default for an embed a published app ships to its visitors.
      url: `https://www.youtube-nocookie.com/embed/${yt}${params.length ? `?${params.join('&')}` : ''}`,
      title: 'YouTube video player'
    };
  }

  const vimeo = vimeoId(src);
  if (vimeo !== null) {
    const params: string[] = [];
    if (autoplay) params.push('autoplay=1', 'muted=1');
    else if (muted) params.push('muted=1');
    if (controls === false) params.push('controls=0');
    if (loop) params.push('loop=1');
    // 🔴 No `end`. Vimeo's embed has no such parameter — see EMBED_LIMITS — and inventing one that
    // is silently ignored would be worse than the port saying so.
    const query = params.length ? `?${params.join('&')}` : '';
    const fragment = start !== undefined ? `#t=${start}s` : '';
    return {
      kind: 'iframe',
      provider: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeo}${query}${fragment}`,
      title: 'Vimeo video player'
    };
  }

  return { kind: 'file' };
}
