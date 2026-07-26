/**
 * BAK-006: the sharp-optional transform module.
 *
 * This worktree genuinely does NOT have `sharp` installed (it is an
 * `optionalDependency`, and new deps never land in a worktree's node_modules —
 * see BAK-006-NOTES §sharp-availability), which is exactly the environment the
 * loud-501 posture exists for. The FIRST describe block below proves that real
 * absence produces the documented result, with zero mocking.
 *
 * The SECOND block proves the render/caching plumbing (format selection,
 * buffer propagation) with a jest `virtual: true` mock standing in for a
 * present sharp — this tests OUR usage of sharp's API, not sharp's own resize
 * correctness (which is not this codebase's to verify).
 */
import { loadTransformer, resetTransformerCacheForTesting, renderThumbnail, TransformUnavailableError } from '../src/storage/transform';

describe('transform: sharp genuinely absent in this environment', () => {
  beforeEach(() => resetTransformerCacheForTesting());

  it('loadTransformer() reports unavailable with a reason, and is cached', () => {
    const first = loadTransformer();
    expect(first.available).toBe(false);
    if (!first.available) {
      expect(first.reason).toMatch(/sharp/i);
    }
    const second = loadTransformer();
    expect(second).toBe(first); // cached, not re-evaluated
  });

  it('renderThumbnail throws TransformUnavailableError rather than falling back to any resizer', async () => {
    await expect(
      renderThumbnail(Buffer.from('not a real image'), 'image/png', { width: 10, height: 10, fit: 'cover' })
    ).rejects.toBeInstanceOf(TransformUnavailableError);
  });
});

describe('transform: with a (virtual, mocked) sharp present', () => {
  beforeEach(() => {
    jest.resetModules();
    resetTransformerCacheForTesting();
  });

  it('renders through sharp\'s chainable API and selects the output format', async () => {
    jest.doMock(
      'sharp',
      () => {
        return (input: Buffer) => {
          const pipeline = {
            _format: 'jpeg',
            resize: jest.fn(function (this: unknown) {
              return pipeline;
            }),
            png: jest.fn(function (this: typeof pipeline) {
              pipeline._format = 'png';
              return pipeline;
            }),
            jpeg: jest.fn(function (this: typeof pipeline) {
              pipeline._format = 'jpeg';
              return pipeline;
            }),
            webp: jest.fn(function (this: typeof pipeline) {
              pipeline._format = 'webp';
              return pipeline;
            }),
            toBuffer: jest.fn(async () => Buffer.from(`rendered:${pipeline._format}:${input.length}`))
          };
          return pipeline;
        };
      },
      { virtual: true }
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../src/storage/transform');
    const loaded = mod.loadTransformer();
    expect(loaded.available).toBe(true);

    const png = await mod.renderThumbnail(Buffer.from('source-bytes'), 'image/png', { width: 64, height: 64, fit: 'cover' });
    expect(png.contentType).toBe('image/png');
    expect(png.buffer.toString('utf-8')).toBe('rendered:png:12');

    const jpeg = await mod.renderThumbnail(Buffer.from('xy'), 'image/jpeg', { width: 64, height: 64, fit: 'contain' });
    expect(jpeg.contentType).toBe('image/jpeg');

    const webp = await mod.renderThumbnail(Buffer.from('z'), 'image/webp', { width: 10, height: 10, fit: 'cover' });
    expect(webp.contentType).toBe('image/webp');

    // Unrecognized source content types default to a jpeg thumbnail (documented fallback).
    const other = await mod.renderThumbnail(Buffer.from('q'), 'application/pdf', { width: 10, height: 10, fit: 'cover' });
    expect(other.contentType).toBe('image/jpeg');
  });
});
