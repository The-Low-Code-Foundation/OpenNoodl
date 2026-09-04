/**
 * The outline instrument, graded without a browser.
 *
 * `documentOutline.ts` is the probe four drives now share, and a shared probe
 * that is wrong is worse than four inline copies that are wrong differently:
 * every drive agrees, and they are all agreeing about nothing. So the three
 * parts that can fail silently are graded here, in milliseconds, rather than
 * only inside a 118-second drive that would blame the template.
 *
 * ## 🔴 Why the expression is EXECUTED here rather than pattern-matched
 *
 * `READ_LANDMARKS` is a string. Nothing typechecks it, and a typo inside it
 * surfaces in a drive as a thrown `Runtime.evaluate` — attributed, at that
 * distance, to the page. Running it against a hand-built stub `document` is
 * what makes it code rather than a comment: the stub answers a fixed set of
 * selectors, so the assertions below are about the probe's LOGIC (the
 * `mains === 1` guard, and asking the `<main>` rather than the document for
 * what is inside it) and not about any real page.
 *
 * ⚠️ This is deliberately NOT a substitute for the browser arms. The stub
 * cannot say whether `as: 'main'` reaches the DOM — that is exactly the claim
 * `sb008` §6 and `sbr010` §7 exist to make, and it needs a real runtime.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  Landmarks,
  NO_LANDMARKS,
  outlineFault,
  READ_LANDMARKS,
  stripOutlineTags
} from './documentOutline';

/** A document that answers `querySelectorAll` for a fixed tag census. */
function stubDocument(spec: {
  mains: number;
  h1s: number;
  /** `<h1>`s the FIRST `<main>` contains — only consulted when there is one main. */
  h1sInsideFirstMain?: number;
  navs?: number;
  navsInsideFirstMain?: number;
}) {
  const inMain = {
    querySelectorAll: (sel: string) => ({
      length: sel === 'h1' ? (spec.h1sInsideFirstMain ?? 0) : sel === 'nav' ? (spec.navsInsideFirstMain ?? 0) : 0
    })
  };
  return {
    querySelectorAll: (sel: string) => {
      if (sel === 'main') return { length: spec.mains, 0: spec.mains > 0 ? inMain : undefined };
      if (sel === 'h1') return { length: spec.h1s };
      if (sel === 'nav') return { length: spec.navs ?? 0 };
      return { length: 0 };
    }
  };
}

const runProbe = (doc: unknown): Landmarks =>
  // eslint-disable-next-line no-new-func
  new Function('document', `return ${READ_LANDMARKS};`)(doc) as Landmarks;

describe('documentOutline — the probe four drives share', () => {
  describe('READ_LANDMARKS, executed', () => {
    it('reads a well-formed page: one main, one h1 inside it, a nav outside', () => {
      expect(runProbe(stubDocument({ mains: 1, h1s: 1, h1sInsideFirstMain: 1, navs: 1, navsInsideFirstMain: 0 }))).toEqual(
        { mains: 1, h1s: 1, h1sInMain: 1, navsInDoc: 1, navsInMain: 0 }
      );
    });

    it('reads the reverted state: no landmarks at all', () => {
      expect(runProbe(stubDocument({ mains: 0, h1s: 0, navs: 0 }))).toEqual({
        mains: 0,
        h1s: 0,
        h1sInMain: 0,
        navsInDoc: 0,
        navsInMain: 0
      });
    });

    /**
     * 🔴 The `mains === 1` guard. With two `<main>`s, "inside the main" has no
     * referent, and answering about the first would report a tidy `1` for a
     * document that is already malformed — a wrong page reading as a right one.
     */
    it('🔴 refuses to answer "inside" when there is more than one <main>', () => {
      const two = runProbe(stubDocument({ mains: 2, h1s: 1, h1sInsideFirstMain: 1, navs: 1 }));
      expect(two.mains).toBe(2);
      expect(two.h1sInMain).toBe(0);
    });

    /**
     * 🔴 The containment reading must come from the `<main>`, not the document.
     * A probe that counted `document.querySelectorAll('h1')` for both would be
     * indistinguishable from this one on every well-formed page — and would
     * pass on a page whose `<h1>` sits OUTSIDE the `<main>`, which is precisely
     * the defect REL-011c's shortcut fix had.
     */
    it('🔴 an <h1> outside the <main> is seen as outside', () => {
      const outside = runProbe(stubDocument({ mains: 1, h1s: 1, h1sInsideFirstMain: 0, navs: 1 }));
      expect(outside.h1s).toBe(1);
      expect(outside.h1sInMain).toBe(0);
      expect(outlineFault(outside)).toBe('0 <h1> inside the <main>, expected 1');
    });

    /** The other shortcut: a `<main>` that swallowed the site navigation. */
    it('🔴 a <nav> inside the <main> is seen as inside', () => {
      const swallowed = runProbe(stubDocument({ mains: 1, h1s: 1, h1sInsideFirstMain: 1, navs: 1, navsInsideFirstMain: 1 }));
      expect(swallowed.navsInMain).toBe(1);
      expect(outlineFault(swallowed)).toBe('1 <nav> inside the <main>, expected 0');
    });
  });

  describe('outlineFault — which of the ways it is wrong', () => {
    const ok: Landmarks = { mains: 1, h1s: 1, h1sInMain: 1, navsInDoc: 1, navsInMain: 0 };

    it('says nothing about a good outline', () => {
      expect(outlineFault(ok)).toBeNull();
    });

    /**
     * 🔴 The reading that is NOT a defect in the page: an arm that never ran.
     * Zeroes are what a reverted arm is supposed to read, so a never-ran arm
     * leaving zeroes would be indistinguishable from a working negative
     * control — the control would pass by not happening.
     */
    it('🔴 tells a never-ran arm apart from a page with no landmarks', () => {
      expect(outlineFault(NO_LANDMARKS)).toBe('the arm never ran');
      expect(outlineFault({ ...ok, mains: 0, h1s: 0, h1sInMain: 0 })).toBe('0 <main>, expected 1');
      expect(outlineFault(undefined)).toBe('no reading was taken');
    });

    it('names each remaining fault distinctly', () => {
      expect(outlineFault({ ...ok, mains: 2 })).toBe('2 <main>, expected 1');
      expect(outlineFault({ ...ok, h1s: 3 })).toBe('3 <h1>, expected 1');
    });
  });

  describe('stripOutlineTags — the reverted arm’s edit', () => {
    let dir = '';

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-strip-'));
    });
    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    const write = (component: string, nodes: unknown) => {
      const d = path.join(dir, 'components', component);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'nodes.json'), JSON.stringify({ nodes }, null, 2));
    };
    const read = (component: string) =>
      JSON.parse(fs.readFileSync(path.join(dir, 'components', component, 'nodes.json'), 'utf-8')) as {
        nodes: unknown[];
      };

    /**
     * 🔴 This call is also the only thing that typechecks the signature against
     * the real `fs` and `path.join`. The backend drives that use it live in
     * `tests/**` of a package whose typecheck cannot complete on a 16GB box, so
     * a wrong parameter type there would reach CI unseen; here it is checked by
     * `npm run typecheck:mcp`.
     */
    it('removes every `as`, however deeply nested, and counts them', () => {
      write('Pages/Messages', [
        { id: 'col', parameters: { as: 'main', sizeMode: 'contentHeight' }, children: [{ id: 'h', parameters: { as: 'h1' } }] }
      ]);
      write('Admin/Shell', [{ id: 'rail', parameters: { as: 'nav' } }]);

      expect(stripOutlineTags(fs, path.join, dir, ['Pages/Messages', 'Admin/Shell'])).toBe(3);

      const messages = read('Pages/Messages').nodes as Array<{
        parameters: Record<string, unknown>;
        children: Array<{ parameters: Record<string, unknown> }>;
      }>;
      expect('as' in messages[0].parameters).toBe(false);
      expect('as' in messages[0].children[0].parameters).toBe(false);
      // 🔴 …and it removed ONLY the `as`. A strip that emptied `parameters`
      // would give the reverted arm a second difference, and every reading it
      // took would be about two changes at once.
      expect(messages[0].parameters).toEqual({ sizeMode: 'contentHeight' });
    });

    /**
     * 🔴 A strip that matched nothing returns 0, and the drive asserts the
     * count for exactly that reason: a reverted arm that changed no file reads
     * a perfectly good outline and would be scored as "the instrument cannot
     * see the defect" — the same numbers, the opposite conclusion.
     */
    it('🔴 returns 0 rather than throwing when there is nothing to strip', () => {
      write('Pages/Plain', [{ id: 'a', parameters: { sizeMode: 'contentHeight' } }, { id: 'b' }]);
      expect(stripOutlineTags(fs, path.join, dir, ['Pages/Plain'])).toBe(0);
    });

    it('skips a component directory that does not exist', () => {
      write('Pages/Real', [{ id: 'a', parameters: { as: 'main' } }]);
      expect(stripOutlineTags(fs, path.join, dir, ['Pages/Real', 'Pages/Absent'])).toBe(1);
    });
  });
});
