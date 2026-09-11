#!/usr/bin/env node
/**
 * EXP-017 AC4 — a WOFF2 encoder this repository can run, with nothing installed.
 *
 * ## 🔴 Why this file exists at all
 *
 * `noodl_modules/inter/styles.css` has carried this sentence since POL-006:
 *
 * > *TTF rather than woff2 (which would be roughly a third of the size) because there is no woff2
 * > encoder in this repo, and a font nobody can regenerate is worse than a larger one.*
 *
 * That reasoning is right, and the premise was the fixable half. Four Inter faces at ~0.31 MB ship
 * inside **every project this product creates** and inside **every app anybody deploys from one** —
 * 1.24 MB of a deploy, before the app. As woff2 they are 0.47 MB.
 *
 * There is no woff2 encoder in `node_modules` and adding a dependency for four files that change
 * roughly never would be the wrong trade. So this is the encoder, in ~120 lines of `zlib`.
 *
 * ## 🔴 What it deliberately does NOT do: the glyf/loca transform
 *
 * A full WOFF2 encoder re-encodes the `glyf` and `loca` tables into the spec's compact form before
 * compressing. This writes them **untransformed** — WOFF2 provides for exactly that, as
 * `transformVersion = 3`, and every browser reads it. What that costs is a few per cent of the
 * final size; what it buys is that this file has no font-format logic in it at all. It rewrites a
 * container, it never touches a glyph, and a bug in it cannot produce a font that renders wrongly —
 * only one that fails to parse, which is loud.
 *
 * Measured on Inter-Regular: 309,828 B → 115,048 B (37.1%). The `woff2_compress` reference encoder
 * makes 106 KB of the same face; the transform is worth ~8 KB a face and is not worth owning.
 *
 * ## Usage
 *
 *     node scripts/library/ttf-to-woff2.js <in.ttf> [out.woff2]
 *     node scripts/library/ttf-to-woff2.js --check <file.woff2>   # re-read what was written
 *
 * `--check` decompresses the result and reconstructs the table directory, so a run can say it
 * produced a readable font rather than merely producing bytes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * The 63 table tags WOFF2 gives a 6-bit index to, **in spec order**. The index IS the position.
 *
 * ⚠️ Order is the whole content of this array — an entry moved by one writes a font whose `cmap`
 * is labelled `head`. It is the table in WOFF2 §5.2 and is not a set to be tidied.
 */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill'
];

/** The escape index that means "a four-byte tag follows". */
const ARBITRARY_TAG = 0x3f;

/** `glyf` and `loca` are the only tables with a transform, so they are the only ones that opt out. */
const NULL_TRANSFORM_FOR_GLYF_LOCA = 3;

/** WOFF2's variable-length integer: 7 bits a byte, big-endian, continuation bit set on all but the last. */
function uintBase128(value) {
  if (value < 0 || value > 0xffffffff) throw new Error(`UIntBase128 out of range: ${value}`);
  const septets = [];
  let remaining = value;
  do {
    septets.unshift(remaining & 0x7f);
    remaining = Math.floor(remaining / 128);
  } while (remaining > 0);
  const bytes = septets.map((septet, index) => (index === septets.length - 1 ? septet : septet | 0x80));
  return Buffer.from(bytes);
}

/** Read the sfnt table directory of a TTF/OTF. */
function readSfnt(buffer) {
  const sfntVersion = buffer.readUInt32BE(0);
  const numTables = buffer.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    tables.push({
      tag: buffer.toString('latin1', record, record + 4),
      offset: buffer.readUInt32BE(record + 8),
      length: buffer.readUInt32BE(record + 12)
    });
  }
  // 🔴 **Sorted by tag, and this is the whole of what browsers reject a file for.**
  //
  // Measured, not read. Inter's tables lie on disk as `glyf maxp loca head …`, and a WOFF2 written
  // in that order is a file `fontTools` opens happily — every table byte-identical to the source,
  // 2,547 glyphs, 2,505 cmap entries — and which **Chrome refuses outright**:
  //
  //     OTS parsing error: Failed to convert WOFF 2.0 font to SFNT
  //
  // and nothing more specific than that. A WOFF2 directory is not free ordering: a decoder
  // reconstructs the sfnt table directory in exactly this order, and an sfnt directory must be
  // sorted by tag. The bytes are identical either way; one of the two files loads.
  //
  // ⚠️ The lesson outlives the rule. The round-trip check below passed on the broken file, and so
  // did a third-party parse: a reader is only as good as the writer's understanding when it shares
  // it. The arm that found this was putting the font in a browser and measuring a rendered width.
  tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  return { sfntVersion, tables };
}

const round4 = (n) => (n + 3) & ~3;

/** Encode one sfnt buffer as WOFF2. */
function encode(input) {
  const { sfntVersion, tables } = readSfnt(input);

  const entries = [];
  const payloads = [];
  let totalSfntSize = 12 + tables.length * 16;

  for (const table of tables) {
    const data = input.subarray(table.offset, table.offset + table.length);
    payloads.push(data);
    totalSfntSize += round4(table.length);

    const known = KNOWN_TAGS.indexOf(table.tag);
    const index = known === -1 ? ARBITRARY_TAG : known;
    const transform = table.tag === 'glyf' || table.tag === 'loca' ? NULL_TRANSFORM_FOR_GLYF_LOCA : 0;

    const parts = [Buffer.from([(transform << 6) | index])];
    if (index === ARBITRARY_TAG) parts.push(Buffer.from(table.tag, 'latin1'));
    parts.push(uintBase128(table.length));
    // No `transformLength`: it is written only when a table IS transformed, and none here is.
    entries.push(Buffer.concat(parts));
  }

  const directory = Buffer.concat(entries);
  const compressed = zlib.brotliCompressSync(Buffer.concat(payloads), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: Buffer.concat(payloads).length
    }
  });

  // 🔴 **The whole file is padded to a 4-byte boundary, and `length` counts the padding.**
  //
  // Measured, and it cost four browser runs to find. WOFF2 blocks are 4-aligned, so a file whose
  // total length is not a multiple of 4 is refused — with the same unhelpful sentence every other
  // malformation gets:
  //
  //     OTS parsing error: Failed to convert WOFF 2.0 font to SFNT
  //
  // ⚠️ And it is **invisible on most inputs**, which is why it is worth this many words. Of Inter's
  // four faces, `Regular` (114,688 B) and `Medium` (123,860 B) came out 4-aligned by luck and
  // loaded perfectly; `SemiBold` (124,643 B) and `Bold` (124,939 B) did not and loaded nowhere. A
  // spec written against one face would have passed, and the encoder would have been wrong for
  // three quarters of the fonts anybody fed it. `exp017-woff2.test.ts` asserts the alignment on
  // every face for that reason, and not the two that happened to work.
  const padding = Buffer.alloc((4 - ((48 + directory.length + compressed.length) % 4)) % 4);

  const header = Buffer.alloc(48);
  const length = 48 + directory.length + compressed.length + padding.length;
  header.write('wOF2', 0, 'latin1');
  header.writeUInt32BE(sfntVersion, 4);
  header.writeUInt32BE(length, 8);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt16BE(0, 14); // reserved
  header.writeUInt32BE(totalSfntSize, 16);
  header.writeUInt32BE(compressed.length, 20);
  header.writeUInt16BE(1, 24); // majorVersion
  header.writeUInt16BE(0, 26); // minorVersion
  // metaOffset/metaLength/metaOrigLength/privOffset/privLength stay zero: no metadata, no private data.

  return Buffer.concat([header, directory, compressed, padding]);
}

/**
 * Read a WOFF2 back and say what is in it.
 *
 * 🔴 Not a checksum of the writer against itself: it parses the header and directory the way a
 * reader does, decompresses the stream, and checks that the table lengths in the directory add up
 * to exactly the bytes that came out. A writer that miscounts a `UIntBase128` or pads a table it
 * should not fails here with the arithmetic that is wrong, rather than in a browser with nothing.
 */
function check(buffer) {
  if (buffer.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  // 🔴 The structural reads come FIRST, before anything is decompressed. A truncated file fails
  // brotli with `unexpected end of file`, which names the symptom and not the fault.
  if (buffer.length % 4 !== 0) {
    throw new Error(`a WOFF2 file must be a multiple of 4 bytes long; this one is ${buffer.length}. Browsers refuse it`);
  }
  if (buffer.readUInt32BE(8) !== buffer.length) {
    throw new Error(`the header says ${buffer.readUInt32BE(8)} bytes and the file is ${buffer.length}`);
  }

  const numTables = buffer.readUInt16BE(12);
  const totalCompressedSize = buffer.readUInt32BE(20);

  let cursor = 48;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buffer[cursor++];
    const index = flags & 0x3f;
    let tag;
    if (index === ARBITRARY_TAG) {
      tag = buffer.toString('latin1', cursor, cursor + 4);
      cursor += 4;
    } else {
      tag = KNOWN_TAGS[index];
    }
    let origLength = 0;
    for (;;) {
      const byte = buffer[cursor++];
      origLength = origLength * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    tables.push({ tag, origLength });
  }

  const stream = zlib.brotliDecompressSync(buffer.subarray(cursor, cursor + totalCompressedSize));
  const expected = tables.reduce((sum, table) => sum + table.origLength, 0);
  if (stream.length !== expected) {
    throw new Error(`decompressed ${stream.length} bytes; the directory accounts for ${expected}`);
  }

  // The rule a browser enforces and a round trip does not — see `readSfnt`.
  for (let i = 1; i < tables.length; i++) {
    if (tables[i].tag <= tables[i - 1].tag) {
      throw new Error(
        `the table directory is not sorted by tag (${tables[i - 1].tag} then ${tables[i].tag}); browsers refuse this`
      );
    }
  }

  return { tables, uncompressed: stream.length };
}

function main(argv) {
  if (argv[0] === '--check') {
    const file = argv[1];
    const result = check(fs.readFileSync(file));
    console.log(`${file}: ${result.tables.length} tables, ${result.uncompressed} bytes uncompressed`);
    console.log(`  ${result.tables.map((t) => t.tag.trim()).join(' ')}`);
    return 0;
  }

  const [input, output] = argv;
  if (!input) {
    console.error('Usage: node scripts/library/ttf-to-woff2.js <in.ttf> [out.woff2]');
    console.error('       node scripts/library/ttf-to-woff2.js --check <file.woff2>');
    return 1;
  }
  const target = output ?? `${input.replace(/\.[ot]tf$/i, '')}.woff2`;
  const source = fs.readFileSync(input);
  const encoded = encode(source);
  check(encoded); // never write a file this process cannot read back
  fs.writeFileSync(target, encoded);

  const percent = ((encoded.length / source.length) * 100).toFixed(1);
  console.log(`${path.basename(input)} ${source.length} B → ${path.basename(target)} ${encoded.length} B (${percent}%)`);
  return 0;
}

module.exports = { encode, check, uintBase128, KNOWN_TAGS };

if (require.main === module) process.exit(main(process.argv.slice(2)));
