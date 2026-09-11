/**
 * §2 of `NOTES-UNOWNED-NODE-WORK.md` — YouTube and Vimeo, under Richard's 2026-09-04 ruling:
 * **URL parameters only, no third-party player SDK.**
 *
 * 🔴 **The point of this file is that the ruling's COST is asserted, not just its capability.**
 * Vimeo has no end parameter; YouTube's `loop` does nothing without a self-referencing playlist;
 * an unmuted autoplay is refused by every current browser. Each of those is a thing the ports
 * cannot promise, and a test that only checked the happy parameters would let a later change
 * quietly claim otherwise.
 */
import { EMBED_LIMITS, resolveVideoEmbed } from '../src/video-embed';

const params = (url: string) => new URLSearchParams((url.split('?')[1] ?? '').split('#')[0]);

/** The embed URL, or a failing assertion naming what came back instead. */
function embedUrl(src: string, options = {}): string {
  const embed = resolveVideoEmbed(src, options);
  if (embed.kind !== 'iframe') throw new Error(`expected an iframe embed for ${src}, got ${embed.kind}`);
  return embed.url;
}

describe('NAT-VIDEO-002 §1 — a pasted link is recognised, in the shapes people paste', () => {
  const YOUTUBE = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ'
  ];

  for (const url of YOUTUBE) {
    it(`recognises ${url}`, () => {
      const embed = resolveVideoEmbed(url);
      expect(embed.kind === 'iframe' && embed.provider).toBe('youtube');
      expect(embedUrl(url)).toContain('/embed/dQw4w9WgXcQ');
    });
  }

  it('recognises Vimeo in both shapes', () => {
    for (const url of ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871']) {
      const embed = resolveVideoEmbed(url);
      expect(embed.kind === 'iframe' && embed.provider).toBe('vimeo');
      expect(embedUrl(url)).toContain('/video/76979871');
    }
  });

  it('uses the privacy-preserving YouTube host', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('https://www.youtube-nocookie.com/');
  });

  it('🔴 leaves everything else on the <video> path, so nothing that worked changes', () => {
    for (const url of [
      'https://cdn.test/clip.mp4',
      '/assets/clip.webm',
      'https://vimeo.com/about',
      'https://www.youtube.com/watch?v=',
      '',
      undefined
    ]) {
      expect(resolveVideoEmbed(url as never).kind).toBe('file');
    }
  });
});

describe('NAT-VIDEO-002 §2 — the options that URL parameters CAN carry', () => {
  const YT = 'https://youtu.be/dQw4w9WgXcQ';

  it('passes a start time', () => {
    expect(params(embedUrl(YT, { startTime: 30 })).get('start')).toBe('30');
  });

  it('passes an end time to YouTube', () => {
    expect(params(embedUrl(YT, { startTime: 10, endTime: 40 })).get('end')).toBe('40');
  });

  it('🔴 floors a fractional second rather than rounding it up', () => {
    // Rounding 9.6 to 10 starts the clip after the moment the author picked.
    expect(params(embedUrl(YT, { startTime: 9.6 })).get('start')).toBe('9');
  });

  it('🔴 reads a start time out of the pasted link itself', () => {
    // "Share at current time" produces these, and a person who pastes one means it.
    expect(params(embedUrl('https://youtu.be/dQw4w9WgXcQ?t=90')).get('start')).toBe('90');
    expect(params(embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).get('start')).toBe('90');
  });

  it('🔴 the Start Time port beats a time in the URL — it is the control the author can see', () => {
    expect(params(embedUrl('https://youtu.be/dQw4w9WgXcQ?t=90', { startTime: 5 })).get('start')).toBe('5');
  });

  it('drops an end that is not after the start, as the mp4 path does', () => {
    expect(params(embedUrl(YT, { startTime: 40, endTime: 10 })).has('end')).toBe(false);
  });

  it('passes controls=0 only when controls are explicitly off', () => {
    expect(params(embedUrl(YT, { controls: false })).get('controls')).toBe('0');
    expect(params(embedUrl(YT, { controls: true })).has('controls')).toBe(false);
  });
});

describe('NAT-VIDEO-002 §3 — 🔴 what the ruling costs, asserted', () => {
  const YT = 'https://youtu.be/dQw4w9WgXcQ';
  const VIMEO = 'https://vimeo.com/76979871';

  it('🔴 Vimeo gets NO end parameter, because its embed has none', () => {
    expect(embedUrl(VIMEO, { endTime: 40 })).not.toContain('end');
    expect(EMBED_LIMITS.vimeo.end).toBe('unsupported');
  });

  it('Vimeo takes its start as a fragment, which is the only place it accepts one', () => {
    expect(embedUrl(VIMEO, { startTime: 30 }).endsWith('#t=30s')).toBe(true);
  });

  it('🔴 autoplay forces mute, because an unmuted autoplay is simply refused', () => {
    // And there is no player API on this path to report that it was refused — which is precisely
    // the capability the ruling declines, so the alternative is a video that silently never starts.
    expect(params(embedUrl(YT, { autoplay: true, muted: false })).get('mute')).toBe('1');
    expect(params(embedUrl(VIMEO, { autoplay: true, muted: false })).get('muted')).toBe('1');
    expect(EMBED_LIMITS.youtube.autoplayRequiresMuted).toBe(true);
  });

  it('🔴 YouTube loop carries a self-referencing playlist, or it does nothing at all', () => {
    // `loop=1` alone loops a PLAYLIST. For one video the documented way is a one-item playlist
    // of itself; without it the parameter is accepted and ignored.
    expect(params(embedUrl(YT, { loop: true })).get('loop')).toBe('1');
    expect(params(embedUrl(YT, { loop: true })).get('playlist')).toBe('dQw4w9WgXcQ');
  });

  it('emits no query string at all when nothing was asked for', () => {
    expect(embedUrl(YT)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});
