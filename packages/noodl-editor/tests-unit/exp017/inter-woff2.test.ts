/**
 * EXP-017 AC4 — the four Inter faces every project and every deployed app carries.
 *
 * ## 🔴 The row that would have been missing, and what it cost to learn
 *
 * A WOFF2 file must be a multiple of four bytes long. Nothing says so out loud, a browser that
 * meets one that is not says only
 *
 *     OTS parsing error: Failed to convert WOFF 2.0 font to SFNT
 *
 * — and of Inter's four faces, **two came out 4-aligned by luck and loaded perfectly**. `Regular`
 * (114,688 B) and `Medium` (123,860 B) worked; `SemiBold` (124,643 B) and `Bold` (124,939 B) were
 * invisible on every page. A gate written against one face, or against "the font", would have been
 * green while three quarters of the fonts the encoder could produce were unusable. So every row
 * below runs over **all four**, and the alignment is asserted on each.
 *
 * ## What is asserted, and why it is not a round trip
 *
 * A reader built from the writer's own understanding shares its blind spots — `--check` passed on
 * the broken files, and so did `fontTools`. What is asserted here instead is the thing a round trip
 * cannot fake: the woff2's decompressed table data is compared **against the `.ttf` it came from**,
 * table by table, byte for byte. The container changed; nothing inside it may have.
 *
 * ⚠️ A browser is still the only instrument that grades the container itself, and no jest runner
 * has one. `scripts/library/ttf-to-woff2.js` carries what the browser said; these rows keep the
 * committed faces honest about being that script's output.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { encode, check, uintBase128 } = require('../../../../scripts/library/ttf-to-woff2.js');

const REPO = path.resolve(__dirname, '../../../..');
const TTF_DIR = path.join(REPO, 'packages/noodl-editor/src/assets/Inter');
const WOFF2_DIR = path.join(REPO, 'packages/noodl-editor/src/assets/starter-project/noodl_modules/inter');

/** The four the shipped Text, Button and Text Input defaults reference — POL-006's set. */
const WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'];

const ttf = (weight: string) => path.join(TTF_DIR, `Inter-${weight}.ttf`);
const woff2 = (weight: string) => path.join(WOFF2_DIR, `Inter-${weight}.woff2`);

/** Read an sfnt's table directory: tag → the bytes of that table. */
function sfntTables(buffer: Buffer): Map<string, Buffer> {
  const tables = new Map<string, Buffer>();
  const numTables = buffer.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const tag = buffer.toString('latin1', record, record + 4);
    const offset = buffer.readUInt32BE(record + 8);
    const length = buffer.readUInt32BE(record + 12);
    tables.set(tag, buffer.subarray(offset, offset + length));
  }
  return tables;
}

/**
 * Pull the table data back out of a WOFF2, parsing it the way a decoder does rather than the way
 * the encoder wrote it: header, directory, brotli block, then split by the declared lengths.
 */
function woff2Tables(buffer: Buffer): Map<string, Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require('zlib');
  const KNOWN: string[] = require('../../../../scripts/library/ttf-to-woff2.js').KNOWN_TAGS;

  expect(buffer.toString('latin1', 0, 4)).toBe('wOF2');
  const numTables = buffer.readUInt16BE(12);
  const totalCompressedSize = buffer.readUInt32BE(20);

  let cursor = 48;
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buffer[cursor++];
    const index = flags & 0x3f;
    let tag: string;
    if (index === 0x3f) {
      tag = buffer.toString('latin1', cursor, cursor + 4);
      cursor += 4;
    } else {
      tag = KNOWN[index];
    }
    let length = 0;
    for (;;) {
      const byte = buffer[cursor++];
      length = length * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    entries.push({ tag, length });
  }

  const stream: Buffer = zlib.brotliDecompressSync(buffer.subarray(cursor, cursor + totalCompressedSize));
  const tables = new Map<string, Buffer>();
  let offset = 0;
  for (const entry of entries) {
    tables.set(entry.tag, stream.subarray(offset, offset + entry.length));
    offset += entry.length;
  }
  expect(offset).toBe(stream.length);
  return tables;
}

describe('EXP-017 AC4 — the shipped Inter faces are woff2', () => {
  it('all four faces are present as woff2 and the module stylesheet names them', () => {
    const styles = fs.readFileSync(path.join(WOFF2_DIR, 'styles.css'), 'utf8');
    for (const weight of WEIGHTS) {
      expect(fs.existsSync(woff2(weight))).toBe(true);
      expect(styles).toContain(`./Inter-${weight}.woff2`);
      expect(styles).toContain("format('woff2')");
    }
    // 🔴 And no `.ttf` left in the rule set. A stylesheet naming both formats would publish both.
    expect(styles).not.toContain('.ttf');
  });

  it('every face is a multiple of four bytes long', () => {
    // The rule two of these four broke, silently, and which no reader here detects — see the
    // header of this file. Stated per face, with the face named, because "the font is misaligned"
    // is not something anybody can act on.
    for (const weight of WEIGHTS) {
      const bytes = fs.statSync(woff2(weight)).size;
      expect(`${weight}: ${bytes % 4}`).toBe(`${weight}: 0`);
    }
  });

  it('every face carries exactly the tables of the .ttf it came from, byte for byte', () => {
    for (const weight of WEIGHTS) {
      const source = sfntTables(fs.readFileSync(ttf(weight)));
      const published = woff2Tables(fs.readFileSync(woff2(weight)));

      expect([...published.keys()].sort()).toEqual([...source.keys()].sort());
      for (const [tag, data] of source) {
        // 🔴 The container is all that changed. A transform, a re-compile or a dropped table would
        // show here and nowhere else in this suite.
        expect(`${weight} ${tag}: ${published.get(tag)?.equals(data)}`).toBe(`${weight} ${tag}: true`);
      }
    }
  });

  it('the committed faces are exactly what the generator produces today', () => {
    // So a change to `ttf-to-woff2.js` that nobody re-ran is a red row rather than a discrepancy
    // between what is in the repo and what the script would write.
    for (const weight of WEIGHTS) {
      const regenerated: Buffer = encode(fs.readFileSync(ttf(weight)));
      expect(`${weight}: ${regenerated.equals(fs.readFileSync(woff2(weight)))}`).toBe(`${weight}: true`);
    }
  });

  it('they are smaller than the .ttf they replace, by the margin that justified the work', () => {
    const before = WEIGHTS.reduce((sum, w) => sum + fs.statSync(ttf(w)).size, 0);
    const after = WEIGHTS.reduce((sum, w) => sum + fs.statSync(woff2(w)).size, 0);

    // Measured 2026-09-11: 1,256,396 B → 488,132 B. The budget is loose because what it guards
    // against is a silent reversion to TTF, not a percent of drift.
    expect(before).toBeGreaterThan(1_200_000);
    expect(after).toBeLessThan(600_000);
  });

  it('the generator refuses to write a font a browser would refuse', () => {
    // The two rules `check` owns, armed. Both were live defects in this encoder, and both produce
    // the same single unhelpful sentence in a browser, which is why they are caught here instead.
    const good: Buffer = encode(fs.readFileSync(ttf('Regular')));
    expect(() => check(good)).not.toThrow();

    const misaligned = Buffer.concat([good, Buffer.alloc(1)]);
    misaligned.writeUInt32BE(misaligned.length, 8);
    expect(() => check(misaligned)).toThrow(/multiple of 4/);

    const truncated = good.subarray(0, good.length - 4);
    expect(() => check(truncated)).toThrow(/the header says/);
  });

  it('UIntBase128 has no leading zeros and continues correctly', () => {
    // The one piece of bit-level arithmetic in the encoder; everything else is a memcpy.
    expect([...uintBase128(0)]).toEqual([0]);
    expect([...uintBase128(127)]).toEqual([127]);
    expect([...uintBase128(128)]).toEqual([0x81, 0x00]);
    // 309,828 = 18·128² + 116·128 + 68 — the size of Inter-Regular.ttf, and a real `origLength`.
    expect([...uintBase128(309_828)]).toEqual([0x92, 0xf4, 0x44]);
  });
});
