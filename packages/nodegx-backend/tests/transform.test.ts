/**
 * BAK-006: the sharp-optional transform module.
 *
 * `sharp` is an `optionalDependency`, so BOTH environments are legitimate and
 * this suite asserts the real behaviour of whichever one it runs in:
 *
 *   - sharp ABSENT  → loadTransformer() reports unavailable with a reason and
 *     renderThumbnail throws TransformUnavailableError (the loud-501 posture,
 *     proved with zero mocking). Our *usage* of sharp's API is then covered by
 *     a jest `virtual: true` mock, which is the only way to reach that code
 *     path when the module genuinely isn't there.
 *   - sharp PRESENT → the same paths are exercised against the real library on
 *     a real PNG, which is strictly better than the mock: no simulation of
 *     format selection, just the bytes sharp actually produces.
 *
 * What is deliberately NOT tested either way: sharp's own resize correctness.
 * That is not this codebase's to verify.
 */
import { loadTransformer, resetTransformerCacheForTesting, renderThumbnail, TransformUnavailableError } from '../src/storage/transform';

/** Is sharp actually installed here? */
const SHARP_AVAILABLE = (() => {
  try {
    require.resolve('sharp');
    return true;
  } catch {
    return false;
  }
})();

/** A real, tiny PNG (1x1 transparent) — decodable by real sharp. */
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082',
  'hex'
);

const describeWhenAbsent = SHARP_AVAILABLE ? describe.skip : describe;
const describeWhenPresent = SHARP_AVAILABLE ? describe : describe.skip;

describeWhenAbsent('transform: sharp genuinely absent in this environment', () => {
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

describeWhenPresent('transform: sharp genuinely present in this environment', () => {
  beforeEach(() => resetTransformerCacheForTesting());

  it('loadTransformer() reports available, and is cached', () => {
    const first = loadTransformer();
    expect(first.available).toBe(true);
    expect(loadTransformer()).toBe(first);
  });

  it('renders a real PNG and selects the output format from the source content type', async () => {
    const png = await renderThumbnail(PNG_BYTES, 'image/png', { width: 64, height: 64, fit: 'cover' });
    expect(png.contentType).toBe('image/png');
    expect(png.buffer.length).toBeGreaterThan(0);
    expect(png.buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // real PNG magic

    const jpeg = await renderThumbnail(PNG_BYTES, 'image/jpeg', { width: 32, height: 32, fit: 'contain' });
    expect(jpeg.contentType).toBe('image/jpeg');
    expect(jpeg.buffer.subarray(0, 2).toString('hex')).toBe('ffd8'); // JPEG SOI

    const webp = await renderThumbnail(PNG_BYTES, 'image/webp', { width: 10, height: 10, fit: 'cover' });
    expect(webp.contentType).toBe('image/webp');
    expect(webp.buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');

    // Unrecognized source content types default to a jpeg thumbnail (documented fallback).
    const other = await renderThumbnail(PNG_BYTES, 'application/pdf', { width: 10, height: 10, fit: 'cover' });
    expect(other.contentType).toBe('image/jpeg');
  });

  it('propagates a decode failure rather than returning a bogus image', async () => {
    await expect(
      renderThumbnail(Buffer.from('not a real image'), 'image/png', { width: 10, height: 10, fit: 'cover' })
    ).rejects.toBeTruthy();
  });
});

describeWhenAbsent('transform: with a (virtual, mocked) sharp present', () => {
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
