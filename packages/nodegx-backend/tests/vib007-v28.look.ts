/**
 * VIB-007 / register **V28** — the render that rules the silent half of the row.
 *
 * V28's second claim is a runtime one — *"a `var()` in a units-typed port, which is dropped
 * silently"* — and this phase has twice been handed a number by a document that came from the wrong
 * instrument. So it is measured rather than read.
 *
 * Four arms, built by `demo/build-vib007-v28.js`, identical but for `width`:
 * **A** explicit 200px (the known-firing signal), **B** `var(--space-16)` (the subject; the token's
 * value is exactly 64px), **C** no width at all (the default control), **D** the same token on
 * `paddingLeft`, the CSS pass-through port it is known to work on.
 *
 * 🔴 **C is what makes B's answer a measurement rather than an inference.** "The value was dropped"
 * and "the value resolved to something unexpected" are different verdicts, and only a rendered
 * no-width arm separates them.
 *
 * ⚠️ No suite runs it — `.look.ts` is outside `jest.config.js`'s `testMatch`.
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib007-v28.look.ts
 */
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.join(REPO, 'scripts', 'devtools', 'render-report')) as {
  withRenderedPage: <T>(o: Record<string, unknown>, fn: (p: any) => Promise<T>) => Promise<T>;
};

jest.setTimeout(1800000);

const PROJECT_DIR = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-007-v28');

type Reading = { word: string; boxWidth: number; innerLeftOffset: number };

describe('VIB-007 — V28 ruled by a render: what does a units-typed port do with a token?', () => {
  it('reads all four arms off one rendered page', async () => {
    const readings = await withRenderedPage({ projectDir: PROJECT_DIR }, async (page: any) => {
      // Found by the WORD each arm paints: the runtime owns the DOM ids, so a selector written
      // from the builder's node ids would be a guess about the renderer rather than a reading.
      const expression = `
        (() => {
          const out = [];
          for (const el of document.querySelectorAll('*')) {
            const word = (el.textContent || '').trim();
            if (!/^ARM-[A-D]-/.test(word)) continue;
            if (el.children.length) continue;
            const band = el.parentElement;
            const box = Array.from(band.children).find((c) => c !== el);
            const inner = box && box.firstElementChild;
            out.push({
              word,
              boxWidth: box ? Math.round(box.getBoundingClientRect().width) : -1,
              innerLeftOffset:
                box && inner
                  ? Math.round(inner.getBoundingClientRect().left - box.getBoundingClientRect().left)
                  : -1
            });
          }
          return JSON.stringify(out);
        })()
      `;
      const raw = await page.evaluate(expression);
      // eslint-disable-next-line no-console
      console.log('V28 RAW ' + raw);
      // eslint-disable-next-line no-console
      console.log('V28 consoleErrors ' + JSON.stringify(page.consoleErrors));
      return JSON.parse(raw) as Reading[];
    });

    // 🔴 Cardinality before the verdict — four arms drew.
    expect(readings).toHaveLength(4);
    const by = (p: string) => readings.find((r) => r.word.startsWith(p))!;
    const a = by('ARM-A');
    const b = by('ARM-B');
    const c = by('ARM-C');
    const d = by('ARM-D');

    // The known-firing signal: an explicit width is honoured.
    expect(a.boxWidth).toBe(200);

    // The token itself resolves — on the pass-through port, at exactly its 64px value. So whatever
    // arm B turns out to be, it is not "the token does not exist".
    expect(d.innerLeftOffset).toBe(64);

    // 🔴 The ruling. Written as a report rather than as an assertion of the expected answer,
    // because the register row's claim is what is under test.
    // eslint-disable-next-line no-console
    console.log(
      `V28 RULING: token-in-width=${b.boxWidth}px, no-width-at-all=${c.boxWidth}px, ` +
        `explicit-200=${a.boxWidth}px → ${b.boxWidth === c.boxWidth ? 'DROPPED (B == the default)' : b.boxWidth === 64 ? 'HONOURED (B == the token value)' : 'NEITHER — investigate'}`
    );
    expect([b.boxWidth === c.boxWidth, b.boxWidth === 64].some(Boolean)).toBe(true);
  });
});
