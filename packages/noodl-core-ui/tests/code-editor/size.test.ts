/**
 * CED-001 (A6/A9). `parseInt('100%')` is `100`, so a consumer asking for a
 * full-width editor got a 100px one, then clamped up to the 400px minimum. The
 * Expression modal's editor was 400px wide however wide the modal was.
 */

import { isPixelSize, parseSizeProp } from '@noodl-core-ui/components/code-editor/utils/size';

describe('parseSizeProp', () => {
  it('passes numbers through', () => {
    expect(parseSizeProp(480, 800)).toBe(480);
    expect(parseSizeProp(0, 800)).toBe(0);
  });

  it('reads numeric and px strings as pixels', () => {
    expect(parseSizeProp('480', 800)).toBe(480);
    expect(parseSizeProp('480px', 800)).toBe(480);
    expect(parseSizeProp(' 480px ', 800)).toBe(480);
    expect(parseSizeProp('12.5px', 800)).toBe(12.5);
  });

  it('leaves every other CSS length as written', () => {
    expect(parseSizeProp('100%', 800)).toBe('100%');
    expect(parseSizeProp('70vh', 500)).toBe('70vh');
    expect(parseSizeProp('calc(100% - 2rem)', 800)).toBe('calc(100% - 2rem)');
    expect(parseSizeProp('auto', 800)).toBe('auto');
  });

  it('falls back when there is nothing usable', () => {
    expect(parseSizeProp(undefined, 800)).toBe(800);
    expect(parseSizeProp(null, 800)).toBe(800);
    expect(parseSizeProp('', 800)).toBe(800);
    expect(parseSizeProp(Number.NaN, 800)).toBe(800);
  });
});

describe('isPixelSize', () => {
  it('only calls a number a pixel size', () => {
    // Which is what decides whether a `minWidth: 400` floor is applied — imposing
    // one on a '100%' editor inside a narrow modal only overflows it.
    expect(isPixelSize(400)).toBe(true);
    expect(isPixelSize('100%')).toBe(false);
  });
});
