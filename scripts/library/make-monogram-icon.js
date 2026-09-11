#!/usr/bin/env node
/**
 * The placeholder card icon a new library entry needs before it can ship.
 *
 * ## Why this exists as a file
 *
 * `library:verify-dist` **fails** any entry whose `library.json` has no usable
 * `icon` — `ModuleCard` destructures it unguarded, so an entry without one
 * takes the picker down rather than showing a blank card. The fifteen entries
 * added in the phase-65 blitz all carry generated monogram placeholders, but
 * the generator was never committed: the shape was in somebody's session and
 * the next person to add an entry had a failing gate and no way to satisfy it.
 * This is that generator, written from the committed output — 680×384, the
 * brand purple, white blocky initials, and the corner shade the existing set
 * has.
 *
 * ## Why it draws its own PNG
 *
 * No image library is a dependency of this repo and adding one for placeholder
 * art would be a poor trade. `zlib` is built in and a PNG is a header plus one
 * deflated block of filtered scanlines, so the encoder below is about thirty
 * lines. The letterforms are a 5×7 bitmap font scaled to whole blocks, which is
 * also what gives the existing icons their look — they are not a typeface being
 * imitated, they are blocks.
 *
 * These are **placeholders**. A bespoke icon beats a monogram on a shelf a
 * person browses; this exists so that "no icon at all" is never the reason an
 * entry cannot ship.
 *
 * Usage:
 *   node scripts/library/make-monogram-icon.js prefabs/accordion
 *   node scripts/library/make-monogram-icon.js prefabs/accordion --text AC
 *   node scripts/library/make-monogram-icon.js --all-missing
 *   node scripts/library/make-monogram-icon.js --check      # exit 1 if any entry has none
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');

const WIDTH = 680;
const HEIGHT = 384;
const GROUND = [0x58, 0x36, 0xf5];
const SHADE = [0x45, 0x27, 0xd9];
const INK = [0xff, 0xff, 0xff];

/**
 * 5×7, one string per row, `#` is ink. Only the characters a monogram can
 * contain — A–Z and 0–9 — because an initial comes from a label and a label
 * that starts with punctuation has bigger problems than its icon.
 */
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['#####', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.']
};

/** "Card & Card Grid" → CG, "Accordion" → AC, "3D Viewer" → 3V. */
function initialsFor(label) {
  const words = String(label)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    // "&", "AND", "THE" are not what the entry is called.
    .filter((w) => !['AND', 'THE', 'A', 'OF', 'TO'].includes(w));
  if (words.length === 0) return '??';
  if (words.length === 1) return (words[0] + words[0])[0] + words[0][1] || words[0][0];
  return words[0][0] + words[1][0];
}

// --- the PNG, from scratch ------------------------------------------------

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `pixels` is RGB, row-major. Filter 0 on every scanline — these are flat blocks. */
function encodePng(width, height, pixels) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function render(text) {
  const px = Buffer.alloc(WIDTH * HEIGHT * 3);
  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 3;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // The corner shade: a 45° wedge out of the bottom-right, as the
      // committed set has. Purely decorative, and it is what stops a row of
      // monograms reading as flat swatches.
      const inWedge = x + y > WIDTH + HEIGHT / 2 - 90;
      put(x, y, inWedge ? SHADE : GROUND);
    }
  }

  const glyphs = [...String(text).toUpperCase()].slice(0, 2).map((ch) => GLYPHS[ch]).filter(Boolean);
  if (glyphs.length === 0) return encodePng(WIDTH, HEIGHT, px);

  const block = 32;
  const gap = block; // one blank column between the two letters
  const glyphW = 5 * block;
  const totalW = glyphs.length * glyphW + (glyphs.length - 1) * gap;
  const originX = Math.round((WIDTH - totalW) / 2);
  const originY = Math.round((HEIGHT - 7 * block) / 2);

  glyphs.forEach((rows, gi) => {
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== '#') return;
        const x0 = originX + gi * (glyphW + gap) + rx * block;
        const y0 = originY + ry * block;
        for (let y = 0; y < block; y++) for (let x = 0; x < block; x++) put(x0 + x, y0 + y, INK);
      });
    });
  });

  return encodePng(WIDTH, HEIGHT, px);
}

// --- entries --------------------------------------------------------------

function entries() {
  const out = [];
  for (const type of ['prefabs', 'modules']) {
    const dir = path.join(LIBRARY_DIR, type);
    if (!fs.existsSync(dir)) continue;
    for (const slug of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, slug, 'library.json');
      if (!fs.existsSync(file)) continue;
      out.push({ id: `${type}/${slug}`, dir: path.join(dir, slug), file, lib: JSON.parse(fs.readFileSync(file, 'utf8')) });
    }
  }
  return out;
}

function hasIcon(entry) {
  const name = entry.lib.icon;
  return Boolean(name) && fs.existsSync(path.join(entry.dir, name));
}

function write(entry, text) {
  const png = render(text);
  fs.writeFileSync(path.join(entry.dir, 'icon.png'), png);
  if (entry.lib.icon !== 'icon.png') {
    entry.lib.icon = 'icon.png';
    fs.writeFileSync(entry.file, JSON.stringify(entry.lib, null, 2) + '\n');
  }
  console.log(`${entry.id}  ${text}  (${png.length} bytes)`);
}

function main() {
  const argv = process.argv.slice(2);
  const all = entries();

  if (argv.includes('--check')) {
    const missing = all.filter((e) => !hasIcon(e));
    for (const e of missing) console.error(`no icon: ${e.id}`);
    console.log(`${all.length - missing.length}/${all.length} entries have an icon.`);
    process.exit(missing.length ? 1 : 0);
  }

  const textArg = argv[argv.indexOf('--text') + 1];
  const targets = argv.includes('--all-missing')
    ? all.filter((e) => !hasIcon(e))
    : all.filter((e) => argv.includes(e.id) || argv.includes(e.id.split('/')[1]));

  if (targets.length === 0) {
    console.error('Nothing to do. Name an entry ("prefabs/accordion"), or pass --all-missing.');
    process.exit(2);
  }
  for (const e of targets) write(e, argv.includes('--text') ? textArg : initialsFor(e.lib.label));
}

main();
