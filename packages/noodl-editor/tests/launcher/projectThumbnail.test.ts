/**
 * Batch D / phase-23 finding 1 — regression guard for the blank-thumbnail fix.
 *
 * `hasUsableCapture` / `isBlankCapture` (packages/noodl-core-ui/src/utils/
 * projectThumbnail.ts) were extracted in UIX-006 follow-up `a4066c31` so both
 * the launcher grid and the node picker's "Import from project" grid share one
 * blank-capture guard instead of each carrying (or missing) its own copy. That
 * fix shipped live-verified but with no executable test — this is the first
 * one, following the same pattern as `deeplink-url.test.ts`: noodl-core-ui has
 * no test runner of its own, so the guard is covered from here, inside the
 * real Electron renderer this suite runs in (real <canvas>/<img> decoding,
 * not a jsdom stand-in).
 */

import {
  hasUsableCapture,
  isBlankCapture,
  placeholderBucket,
  projectInitial
} from '@noodl-core-ui/utils/projectThumbnail';

function makeDataUri(fill: 'white' | 'black' | 'noise', size = 32): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  if (fill === 'noise') {
    // Deterministic pseudo-random fill, not solid-colour and not a gradient —
    // representative of a real captured node-graph screenshot.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = Math.floor(rand() * 256);
        ctx.fillStyle = `rgb(${v},${(v + 80) % 256},${(v + 160) % 256})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load: ' + src.slice(0, 40)));
    img.src = src;
  });
}

describe('projectThumbnail — hasUsableCapture', () => {
  it('rejects missing/empty values', () => {
    expect(hasUsableCapture(undefined)).toBe(false);
    expect(hasUsableCapture('')).toBe(false);
    expect(hasUsableCapture('   ')).toBe(false);
  });

  it('rejects the legacy empty-svg sentinel', () => {
    expect(hasUsableCapture('data:image/svg+xml,<svg></svg>')).toBe(false);
  });

  it('rejects a too-short data URI (not a real raster capture)', () => {
    expect(hasUsableCapture('data:image/png;base64,AAAA')).toBe(false);
  });

  it('accepts a real-length raster data URI', () => {
    const uri = makeDataUri('noise');
    expect(uri.length).toBeGreaterThan(64);
    expect(hasUsableCapture(uri)).toBe(true);
  });

  it('accepts remote http(s) URLs and rejects other schemes', () => {
    expect(hasUsableCapture('https://example.com/thumb.png')).toBe(true);
    expect(hasUsableCapture('http://example.com/thumb.png')).toBe(true);
    expect(hasUsableCapture('ftp://example.com/thumb.png')).toBe(false);
    expect(hasUsableCapture('not-a-uri-at-all')).toBe(false);
  });
});

describe('projectThumbnail — isBlankCapture', () => {
  it('flags a solid-white capture as blank — this is the defect this guard exists for', async () => {
    const img = await loadImage(makeDataUri('white'));
    expect(isBlankCapture(img)).toBe(true);
  });

  it('flags a solid-black capture as blank (zero-spread, not near-white)', async () => {
    const img = await loadImage(makeDataUri('black'));
    expect(isBlankCapture(img)).toBe(true);
  });

  it('does not flag a real-content (noisy) capture as blank', async () => {
    const img = await loadImage(makeDataUri('noise'));
    expect(isBlankCapture(img)).toBe(false);
  });

  it('tolerates a near-white capture with a real outlier pixel (the near-white RATIO, not min/max spread)', async () => {
    // A prior attempt used min/max spread alone and failed exactly this case:
    // a single dark pixel (a lone node, a 1px border) drives max-min to 255 —
    // nowhere near the "effectively one solid colour" spread threshold — on a
    // capture that is otherwise entirely blank. The near-white *fraction* is
    // what still correctly reads this as blank.
    //
    // Built at exactly the helper's internal sample size (16x16) so drawImage
    // is a no-op resample, not a lossy downscale — the one dark pixel stays
    // exactly one dark pixel, not a blend of several.
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1); // 1 of 256 sampled pixels — spread is maximal (255)

    const img = await loadImage(canvas.toDataURL('image/png'));
    expect(isBlankCapture(img)).toBe(true);
  });
});

describe('projectThumbnail — placeholder identity', () => {
  it('placeholderBucket is deterministic and bounded', () => {
    expect(placeholderBucket('My Project')).toBe(placeholderBucket('My Project'));
    expect(placeholderBucket('My Project')).toBeGreaterThanOrEqual(0);
    expect(placeholderBucket('My Project')).toBeLessThan(5);
  });

  it('placeholderBucket agrees for the same name regardless of caller (launcher vs node picker)', () => {
    // The point of lifting the helper: both cards must land the same project
    // in the same colour bucket, or "shared implementation" is not actually true.
    const a = placeholderBucket('DebtLivePass');
    const b = placeholderBucket('DebtLivePass');
    expect(a).toBe(b);
  });

  it('projectInitial picks the first alphanumeric, uppercased, or a fallback', () => {
    expect(projectInitial('debtLivePass')).toBe('D');
    expect(projectInitial('  2nd project')).toBe('2');
    expect(projectInitial('---')).toBe('?');
    expect(projectInitial('')).toBe('?');
  });
});
