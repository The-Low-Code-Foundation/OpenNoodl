/**
 * VIB-007 / register **V32** — the render that rules the one corpus repair the gate demands.
 *
 * Switching `raw-color-literal` on in `catalog:examples` costs exactly one repair, and the repair
 * is only correct if a design token **survives a `Color` variable node**. `Color`'s `cast` is
 * `(value) => value` (`noodl-viewer-react/src/nodes/std-library/variables/color.ts`), which is a
 * reading of one file; §3's rule is that a reading is not a ruling.
 *
 * Three arms, built by `demo/build-vib007-v32.js`:
 *
 *  - **A** — a `Color` node holding `#3366ff`, wired to a `Text.color` and a `Group.backgroundColor`.
 *    The known-firing signal: without it, "B is not blue" is indistinguishable from "the connection
 *    never delivered".
 *  - **B** — the same wiring, `var(--primary)`. The repaired corpus shape.
 *  - **C** — a `Text` whose `color` PARAMETER is `var(--primary)`, no node in between. The
 *    sanctioned path the corpus already uses, and therefore what B must equal.
 *
 * 🔴 **B is compared against C, never against a literal.** A hard-coded `rgb(37, 99, 235)` would
 * make this a second copy of `DefaultTokens.ts` that reddens when the palette moves and nothing
 * breaks.
 *
 * ⚠️ No suite runs it — `.look.ts` is outside `jest.config.js`'s `testMatch`.
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib007-v32.look.ts
 */
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.join(REPO, 'scripts', 'devtools', 'render-report')) as {
  withRenderedPage: <T>(o: Record<string, unknown>, fn: (p: any) => Promise<T>) => Promise<T>;
};

jest.setTimeout(1800000);

const PROJECT_DIR = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-007-v32');

type Reading = { word: string; color: string; swatch: string };

describe('VIB-007 — V32 ruled by a render: does a design token survive a Color node?', () => {
  it('reads all three arms off one rendered page', async () => {
    const readings = await withRenderedPage({ projectDir: PROJECT_DIR }, async (page: any) => {
      // Read by the WORD each arm paints, not by a DOM id: the runtime owns the ids and a
      // selector written from the builder's node ids would be a guess about the renderer.
      const expression = `
        (() => {
          const out = [];
          for (const el of document.querySelectorAll('*')) {
            const word = (el.textContent || '').trim();
            if (!/^(HEX-THROUGH-NODE|TOKEN-THROUGH-NODE|TOKEN-IN-PARAMETER)$/.test(word)) continue;
            if (el.children.length) continue;
            const band = el.closest('div')?.parentElement;
            const swatch = band
              ? Array.from(band.querySelectorAll('div')).map((d) => getComputedStyle(d).backgroundColor)
                  .find((c) => c !== 'rgba(0, 0, 0, 0)') || 'none'
              : 'none';
            out.push({ word, color: getComputedStyle(el).color, swatch });
          }
          return JSON.stringify(out);
        })()
      `;
      const raw = await page.evaluate(expression);
      // eslint-disable-next-line no-console
      console.log('V32 RAW ' + raw);
      // eslint-disable-next-line no-console
      console.log('V32 consoleErrors ' + JSON.stringify(page.consoleErrors));
      return JSON.parse(raw) as Reading[];
    });

    // 🔴 Cardinality before the verdict — three arms drew, so an absence below is a real absence.
    expect(readings).toHaveLength(3);
    const by = (w: string) => readings.find((r) => r.word === w)!;
    const a = by('HEX-THROUGH-NODE');
    const b = by('TOKEN-THROUGH-NODE');
    const c = by('TOKEN-IN-PARAMETER');

    // Arm A is the known-firing signal: the Color node delivers over a connection at all.
    expect(a.color).toBe('rgb(51, 102, 255)');
    expect(a.swatch).toBe('rgb(51, 102, 255)');

    // Arm C is the sanctioned path resolving — asserted independently so a broken token file
    // fails HERE rather than making B look like the defect.
    expect(c.color).not.toBe(a.color);
    expect(c.color).toMatch(/^rgb\(/);

    // The ruling.
    expect(b.color).toBe(c.color);
    expect(b.swatch).toBe(c.color);
  });
});
