#!/usr/bin/env node
/**
 * VFN-011 — how wide a sentence actually is, without a renderer.
 *
 * ## Why this exists
 *
 * The Logic Builder's run strip is a flex row whose note is a single
 * `text-overflow: ellipsis` line. Whether a sentence survives at a given window width is a
 * question about *pixels*, and every cheap answer to it is wrong in a way this register has
 * already been burned by:
 *
 * - counting characters treats `i` and `W` as the same width, which they are not — the ratio
 *   between the narrowest and widest lowercase glyph in this font is over 3;
 * - `scrollWidth > clientWidth` in a live renderer is integer-rounded and reports a false 1 px
 *   overflow (VFN-002 §"a correction to this file's stated instrument");
 * - and a live renderer is not available to a worktree that must not launch the editor.
 *
 * So this reads the **advance widths out of the font file the app actually renders with** —
 * `--font-family` resolves to `-apple-system` on macOS, which is `/System/Library/Fonts/SFNS.ttf`
 * — and sums them. `cmap` for the glyph ids, `hmtx` for the advances, `head` for `unitsPerEm`.
 *
 * ## What it deliberately does not model
 *
 * **Kerning.** SF's pair adjustments live in `GPOS`, not in a `kern` table, and they are small and
 * almost always *negative* — so an unkerned sum is a slight **over**-estimate of the rendered
 * width. For a fits/does-not-fit question that is the safe direction: this tool will never call
 * something clipped that is not.
 *
 * **Optical size.** SFNS is a variable font and `hmtx` carries its default instance. At 11 px the
 * renderer would pick the Text optical size, whose advances differ from the default by a low
 * single-digit percentage. Treat readings as ±5%, which is why the budget derived from them is
 * set with room rather than at the measured edge.
 *
 * Usage:
 *   node scripts/devtools/text-advance.js 11 "some sentence"     # → px
 *   node scripts/devtools/text-advance.js --self-test
 */

const fs = require('fs');

const DEFAULT_FONT = '/System/Library/Fonts/SFNS.ttf';

function readFont(file) {
  const buffer = fs.readFileSync(file);

  const tag = buffer.readUInt32BE(0);
  // 0x00010000 (TrueType), 'true', or 'OTTO' (CFF). A `ttcf` collection is not handled — SFNS.ttf
  // is not one, and guessing which face inside a collection the system picked would be a fiction.
  if (tag !== 0x00010000 && tag !== 0x74727565 && tag !== 0x4f54544f) {
    throw new Error(`${file}: not a single-face sfnt (tag 0x${tag.toString(16)})`);
  }

  const numTables = buffer.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16;
    const name = buffer.toString('ascii', at, at + 4);
    tables[name] = { offset: buffer.readUInt32BE(at + 8), length: buffer.readUInt32BE(at + 12) };
  }

  for (const required of ['head', 'hhea', 'hmtx', 'cmap', 'maxp']) {
    if (!tables[required]) throw new Error(`${file}: missing ${required} table`);
  }

  const unitsPerEm = buffer.readUInt16BE(tables.head.offset + 18);
  const numGlyphs = buffer.readUInt16BE(tables.maxp.offset + 4);
  const numberOfHMetrics = buffer.readUInt16BE(tables.hhea.offset + 34);

  const advance = (glyphId) => {
    if (glyphId < numberOfHMetrics) return buffer.readUInt16BE(tables.hmtx.offset + glyphId * 4);
    // Past the metrics array every glyph repeats the last advance — the standard `hmtx` tail.
    return buffer.readUInt16BE(tables.hmtx.offset + (numberOfHMetrics - 1) * 4);
  };

  return { buffer, tables, unitsPerEm, numGlyphs, advance };
}

/**
 * Unicode code point → glyph id, from the best `cmap` subtable present.
 *
 * Format 12 first (full Unicode), then format 4 (BMP). Format 6/0 are not read: no modern system
 * font ships only those, and a silent wrong answer from a half-understood subtable is worse than
 * a loud missing one.
 */
function buildCmap(font) {
  const { buffer, tables } = font;
  const base = tables.cmap.offset;
  const numSubtables = buffer.readUInt16BE(base + 2);

  let best = null;
  for (let i = 0; i < numSubtables; i++) {
    const at = base + 4 + i * 8;
    const platform = buffer.readUInt16BE(at);
    const encoding = buffer.readUInt16BE(at + 2);
    const offset = base + buffer.readUInt32BE(at + 4);
    const format = buffer.readUInt16BE(offset);

    const score =
      format === 12 && platform === 3 && encoding === 10
        ? 4
        : format === 12
          ? 3
          : format === 4 && platform === 3 && encoding === 1
            ? 2
            : format === 4
              ? 1
              : 0;
    if (score > 0 && (!best || score > best.score)) best = { score, format, offset };
  }

  if (!best) throw new Error('no usable cmap subtable (format 4 or 12)');

  if (best.format === 12) {
    const groups = buffer.readUInt32BE(best.offset + 12);
    return (code) => {
      let lo = 0;
      let hi = groups - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const at = best.offset + 16 + mid * 12;
        const start = buffer.readUInt32BE(at);
        const end = buffer.readUInt32BE(at + 4);
        if (code < start) hi = mid - 1;
        else if (code > end) lo = mid + 1;
        else return buffer.readUInt32BE(at + 8) + (code - start);
      }
      return 0;
    };
  }

  const segX2 = buffer.readUInt16BE(best.offset + 6);
  const segCount = segX2 / 2;
  const endAt = best.offset + 14;
  const startAt = endAt + segX2 + 2;
  const deltaAt = startAt + segX2;
  const rangeAt = deltaAt + segX2;

  return (code) => {
    if (code > 0xffff) return 0;
    for (let s = 0; s < segCount; s++) {
      if (buffer.readUInt16BE(endAt + s * 2) < code) continue;
      if (buffer.readUInt16BE(startAt + s * 2) > code) return 0;

      const rangeOffset = buffer.readUInt16BE(rangeAt + s * 2);
      const delta = buffer.readInt16BE(deltaAt + s * 2);
      if (rangeOffset === 0) return (code + delta) & 0xffff;

      const glyphAt = rangeAt + s * 2 + rangeOffset + (code - buffer.readUInt16BE(startAt + s * 2)) * 2;
      const glyphId = buffer.readUInt16BE(glyphAt);
      return glyphId === 0 ? 0 : (glyphId + delta) & 0xffff;
    }
    return 0;
  };
}

/**
 * A measurer for one font file.
 *
 * 🔴 `missing` is reported rather than swallowed. A glyph the font has no coverage for renders
 * from a *fallback* font at a width this file cannot know, and a sum that silently scored it as
 * `.notdef` would understate the sentence — which is the direction that turns a clipped string
 * into a passing one. `▶` (U+25B6) is exactly such a character in some faces, and it is in the
 * sentence this tool was written for.
 */
function measurer(file = DEFAULT_FONT) {
  const font = readFont(file);
  const lookup = buildCmap(font);

  return function measure(text, sizePx) {
    let units = 0;
    const missing = [];
    for (const character of text) {
      const code = character.codePointAt(0);
      const glyphId = lookup(code);
      if (glyphId === 0) {
        missing.push(character);
        continue;
      }
      units += font.advance(glyphId);
    }
    return {
      px: (units / font.unitsPerEm) * sizePx,
      missing,
      unitsPerEm: font.unitsPerEm
    };
  };
}

module.exports = { measurer, DEFAULT_FONT };

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    const measure = measurer();
    // A monospaced-ish control: 10 identical glyphs must be exactly 10× one of them, and a wide
    // glyph must beat a narrow one. If either fails the parser is not reading `hmtx`.
    const one = measure('i', 11).px;
    const ten = measure('iiiiiiiiii', 11).px;
    const wide = measure('W', 11).px;
    console.log(`i=${one.toFixed(3)}px  i×10=${ten.toFixed(3)}px  W=${wide.toFixed(3)}px`);
    console.log(`  linear: ${(Math.abs(ten - one * 10) < 1e-6 ? 'ok' : 'FAILED')}`);
    console.log(`  W > i:  ${(wide > one * 2 ? 'ok' : 'FAILED')}`);
    process.exit(0);
  }

  const size = Number(args[0]);
  const text = args.slice(1).join(' ');
  if (!Number.isFinite(size) || !text) {
    console.error('usage: text-advance.js <sizePx> <text>   |   text-advance.js --self-test');
    process.exit(1);
  }

  const result = measurer()(text, size);
  console.log(`${result.px.toFixed(2)}px   (${text.length} chars, unitsPerEm ${result.unitsPerEm})`);
  if (result.missing.length) console.log(`  ⚠️ no coverage for: ${[...new Set(result.missing)].join(' ')}`);
}
