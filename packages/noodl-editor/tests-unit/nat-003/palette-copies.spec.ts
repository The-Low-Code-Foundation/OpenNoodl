/**
 * NAT-003 — every second copy of a palette value, checked against the first.
 *
 * ## Why this exists
 *
 * `colors.css` is the canonical palette, and three separate places keep their own copy of bits of
 * it because they cannot read a stylesheet:
 *
 * - `CanvasTheme.ts` pairs every token with a `fallback:` hex, for headless paints.
 * - `tests/canvas/CanvasThemeNodeSchemes.test.ts` writes a token map onto `documentElement`,
 *   because the electron spec runner does not load the editor stylesheet.
 * - `nodelibraryexport.ts` ships a node-colour blob for consumers outside `CanvasTheme`.
 *
 * 🔴 **THIS CLASS OF COPY HAS DRIFTED TWICE AND NEITHER TIME DID ANYTHING GO RED.** NAT-002 found
 * the scheme test still holding `fg-muted` at a value the token had not carried since D9 — the
 * map was self-consistent, so every assertion in it passed while it graded a palette the product
 * no longer shipped. NAT-003 then moved eleven values and found the same file again. A comment
 * saying "keep this in sync" is what was there both times.
 *
 * So this is the checker, and it reads **the corpus that exists** rather than a fixture: it walks
 * the real source tree, finds every literal that claims to be a theme token's value, and compares
 * it to what `colors.css` actually says. A file that invents a new copy tomorrow is covered
 * without anybody remembering to add it here.
 *
 * ## What it deliberately does NOT do
 *
 * It does not require a copy to exist, and it does not object to a token being *absent* from a
 * copy — a partial map is a legitimate thing to write. It only ever says "this file states a
 * value for token X, and `colors.css` disagrees". ⚠️ It also cannot see a copy that stores a
 * colour without naming the token beside it: `nodelibraryexport.ts`'s node blob is exactly that
 * shape, and it is bound to the palette by `CanvasThemeNodeSchemes.test.ts` instead — in the
 * ELECTRON suite, which this one cannot reach.
 *
 * @module noodl-editor/tests-unit/nat-003/palette-copies
 */
import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, resolveToken, themeTokens } from '../support/themeTokens';

const REPO = path.join(__dirname, '../../../..');
const CANONICAL = path.join(REPO, 'packages/noodl-core-ui/src/styles/custom-properties/colors.css');

/** Source roots worth walking. `dist/` and `node_modules/` are build output, not claims. */
const ROOTS = [
  'packages/noodl-editor/src',
  'packages/noodl-editor/tests',
  'packages/noodl-editor/tests-unit',
  'packages/noodl-core-ui/src',
  'packages/noodl-runtime/src'
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|css|scss)$/.test(entry.name) && full !== CANONICAL) {
      out.push(full);
    }
  }
  return out;
}

type Claim = { file: string; line: number; token: string; hex: string };

/**
 * Two shapes, both of which mean "token X is this colour":
 *   `'--theme-color-bg-0': '#161c24'`      — a token map
 *   `{ css: '--theme-color-bg-0', fallback: '#161c24' }` — CanvasTheme's pairing
 *
 * ⚠️ A bare `--theme-color-x: #hex` DECLARATION is not a claim about the canonical value — it is
 * a component overriding a token for itself, which is legal. Only the two forms above assert
 * equality, so only those are collected.
 */
function claims(): Claim[] {
  const found: Claim[] = [];
  const map = /'(--theme-color-[a-z0-9-]+)'\s*:\s*'(#[0-9a-fA-F]{6})'/g;
  const fallback = /css:\s*'(--theme-color-[a-z0-9-]+)'\s*,\s*fallback:\s*'(#[0-9a-fA-F]{6})'/g;

  for (const root of ROOTS) {
    for (const file of walk(path.join(REPO, root))) {
      const source = fs.readFileSync(file, 'utf8');
      const lines = source.split('\n');
      for (const pattern of [map, fallback]) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source))) {
          const line = source.slice(0, match.index).split('\n').length;
          void lines;
          found.push({ file: path.relative(REPO, file), line, token: match[1], hex: match[2].toLowerCase() });
        }
      }
    }
  }
  return found;
}

const CLAIMS = claims();

describe('every copy of a palette value agrees with colors.css', () => {
  it('found copies at all — an empty sweep would pass silently', () => {
    // 🔴 The control this file needs most. A regex that matches nothing, a root that moved, a
    // `walk` that threw on the first directory: all three produce a green run that has checked
    // NOTHING. The count is quoted rather than "> 0" so a collapse is visible as a number.
    expect(CLAIMS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(CLAIMS.map((c) => c.file)).size).toBeGreaterThanOrEqual(2);
    expect(CLAIMS.some((c) => c.file.includes('CanvasTheme.ts'))).toBe(true);
    expect(CLAIMS.some((c) => c.file.includes('CanvasThemeNodeSchemes'))).toBe(true);
  });

  it('every claimed value is the value one of the two themes actually gives that token', () => {
    const wrong = CLAIMS.filter((claim) => {
      const actual = (['dark', 'light'] as ThemeName[]).map((theme) =>
        (resolveToken(themeTokens(theme), claim.token) || '').toLowerCase()
      );
      // A copy may be dark-only, light-only or either; it is wrong only when it matches NEITHER.
      return !actual.includes(claim.hex);
    });

    expect(
      wrong.map(
        (c) =>
          `${c.file}:${c.line} says ${c.token} is ${c.hex}; colors.css says ${(
            ['dark', 'light'] as ThemeName[]
          )
            .map((t) => `${t} ${resolveToken(themeTokens(t), c.token)}`)
            .join(', ')}`
      )
    ).toEqual([]);
  });

  it('🔴 CONTROL: a wrong value in the same shape is caught', () => {
    // Self-calibrating: take a REAL token, corrupt its value, and put it through the same
    // comparison. If this passes, the assertion above proved nothing about its own logic.
    const real = resolveToken(themeTokens('dark'), '--theme-color-bg-0')!;
    const corrupted = real === '#000000' ? '#ffffff' : '#000000';
    const matches = (['dark', 'light'] as ThemeName[]).map((t) =>
      (resolveToken(themeTokens(t), '--theme-color-bg-0') || '').toLowerCase()
    );
    expect(matches).toContain(real.toLowerCase());
    expect(matches).not.toContain(corrupted);
  });
});
