/**
 * BEN-004 / phase 82 `TESTING-PASS-2026-09-04.md` §3 — **the one fix from Richard's testing pass
 * that shipped with no gate at all.**
 *
 * Finding 6: *"create a component, open the workbench dropdown, it is not there."* Fixed in
 * `16f38e7963` by a `.slice()`, and deliberately left ungated with the reason written into the
 * commit: *"`@testing-library/react` is not installed, so the menu cannot be opened in a spec, and
 * a source-text assertion would pass on dead code."*
 *
 * 🔴 **The second half of that reason was right and the first half was the wrong instrument.**
 * `PreviewChrome.tsx` cannot be graded here for a blunter reason than the missing dependency —
 * it imports `@noodl-core-ui/components/common/Icon`, and ts-jest rejects that file's
 * `require.context` call outright (`Icon.tsx:207`, TS2339), so the module fails the suite *to
 * run*. Measured, not assumed. But **the decision was never in the rendering**: it is "what list
 * does the menu read when it opens", which is a function from a getter to an array. Moved to
 * `previewScope.readMenuComponents` — a module that imports one type constant and loads clean —
 * it is gradeable without a DOM, without React, and without opening a menu.
 *
 * So this file grades three separate things:
 *
 *   §1 the **premise** — a model shaped exactly like `ProjectModel` hands out its live array
 *   §2 the **fix** — the read is a snapshot with its own identity
 *   §3 the **symptom** — Richard's bug reproduced and then removed, through the real
 *      `benchTargets` behind a faithful `useMemo`
 *   §4 the **wire** — `open()` actually calls it, read off source with comments stripped
 *
 * ⚠️ §4 is the only source-level row and it is the one the commit warned about. It is written
 * over `stripComments()` on purpose: the fix's own prose names `.slice()` and `getComponents`
 * several times, so a raw text match would pass on the documentation of a change that had been
 * reverted. §1–§3 are what actually holds the behaviour; §4 only holds the two ends together.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { stripComments } from '../support/renderElements';
import { benchTargets, readMenuComponents, type BenchTarget } from '../../src/editor/src/views/VisualCanvas/previewScope';

/**
 * `ProjectModel`, in the two lines this decision depends on —
 * `getComponents() { return this.components; }` and `addComponent` doing
 * `this.components.push(component)`. Restated rather than imported because the real model drags
 * Electron, the node library and half the editor's singletons into a plain-Node runner.
 *
 * 🔴 **A restatement is not a reading of the thing it restates.** If `ProjectModel` ever starts
 * handing out a copy, this class carries on describing a world that has moved and §2 keeps passing
 * on a property the product no longer needs. That is what §1.3 is for: it reads the two lines off
 * `projectmodel.ts` itself, so the premise is checked rather than assumed.
 */
class LiveArrayModel {
  readonly components: Array<{ name: string }> = [];

  getComponents(): Array<{ name: string }> {
    return this.components;
  }

  addComponent(component: { name: string }): void {
    this.components.push(component);
  }
}

/**
 * React's `useMemo`, to its actual rule: recompute only when one dependency fails `Object.is`
 * against the previous render's. This is the mechanism the bug rode — `PreviewChrome` memoises
 * `benchTargets(components, query)` on `[components, query]` — and modelling it is what turns an
 * identity assertion into the sentence a person would say.
 */
class MemoOnIdentity<T> {
  private lastDeps: unknown[] = [Symbol('never'), Symbol('never')];
  private value: T | null = null;
  computations = 0;

  read(deps: unknown[], compute: () => T): T {
    const changed = deps.length !== this.lastDeps.length || deps.some((dep, i) => !Object.is(dep, this.lastDeps[i]));
    if (changed) {
      this.lastDeps = deps;
      this.value = compute();
      this.computations += 1;
    }
    return this.value as T;
  }
}

const names = (targets: BenchTarget[]) => targets.map((target) => target.name);

describe('BEN-004 — the scope menu reads a list it can tell apart from the last one', () => {
  describe('§1 the premise: the model hands out the array it mutates', () => {
    it('getComponents returns the live array, so two reads around an add are one object', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });

      const before = model.getComponents();
      model.addComponent({ name: '/Cards/New' });
      const after = model.getComponents();

      // ⚠️ This says the STUB is shaped the way the bug needs. It cannot say anything about
      // `ProjectModel` — a stub does not notice when the thing it imitates changes. §1.3 is the
      // row that watches the real file.
      expect(Object.is(before, after)).toBe(true);
    });

    it('…and the read is fresh in CONTENT, which is why the bug looked impossible', () => {
      const model = new LiveArrayModel();
      const before = model.getComponents();
      model.addComponent({ name: '/Cards/New' });

      // The list a `console.log` in `open()` would print is correct. Nothing is stale in the
      // getter; what is discarded is the state write, one layer up.
      expect(before.map((c) => c.name)).toContain('/Cards/New');
    });

    /**
     * §1.3 — the premise, read off the real file rather than off the stub above.
     *
     * Returns `null` rather than asserting, for the same reason `openBody()` does: a helper that
     * asserts runs during collection, and a mutant that deletes its subject then produces
     * `Tests: 0 total` instead of a named red.
     */
    function projectModelBody(name: string): string | null {
      const source = stripComments(
        readFileSync(join(__dirname, '../../src/editor/src/models/projectmodel.ts'), 'utf8')
      );
      const start = source.indexOf(name);
      if (start === -1) return null;
      const end = source.indexOf('\n  }', start);
      if (end === -1) return null;
      return source.slice(start, end);
    }

    it('§1.3 ProjectModel still hands out the array it mutates — the reason .slice() is needed', () => {
      const getter = projectModelBody('getComponents(): ComponentModel[] {');
      const adder = projectModelBody('addComponent(component, args?: TSFixme) {');

      expect(getter).not.toBeNull();
      expect(adder).not.toBeNull();

      // If either of these moves, the hazard `readMenuComponents` exists for may have gone — read
      // this row's failure before changing anything, because the copy is cheap and harmless either
      // way, and a getter that starts copying is a change worth noticing rather than absorbing.
      expect(getter).toContain('return this.components;');
      expect(adder).toContain('this.components.push(component);');
    });
  });

  describe('§2 the fix: the menu reads a snapshot with its own identity', () => {
    it('is not the live array', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });

      const read = readMenuComponents(() => model.getComponents());

      expect(Object.is(read, model.components)).toBe(false);
      expect(read).toEqual(model.components);
    });

    it('gives each open a different identity', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });

      const first = readMenuComponents(() => model.getComponents());
      model.addComponent({ name: '/Cards/New' });
      const second = readMenuComponents(() => model.getComponents());

      expect(Object.is(first, second)).toBe(false);
    });

    it('and each snapshot is of the moment it was taken, not of now', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });

      const first = readMenuComponents(() => model.getComponents());
      model.addComponent({ name: '/Cards/New' });
      const second = readMenuComponents(() => model.getComponents());

      // Both halves matter: the earlier read must NOT have grown (or it is still the live array
      // under a new name), and the later one must have.
      expect(first.map((c) => c.name)).toEqual(['/Pages/Home']);
      expect(second.map((c) => c.name)).toEqual(['/Pages/Home', '/Cards/New']);
    });

    it('survives a getter that returns a fresh empty array, as the call site does when no project is open', () => {
      // `VisualCanvas.tsx` passes `() => ProjectModel.instance?.getComponents() ?? []`.
      const read = readMenuComponents(() => []);
      expect(read).toEqual([]);
    });
  });

  describe('§3 the symptom: what a person sees, through the real benchTargets', () => {
    it('🔴 reading the live array leaves the new component OUT of the menu — the reported bug', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });
      const memo = new MemoOnIdentity<BenchTarget[]>();

      const firstOpen = model.getComponents();
      memo.read([firstOpen, ''], () => benchTargets(firstOpen, ''));

      model.addComponent({ name: '/Cards/New' });

      const secondOpen = model.getComponents();
      const shown = memo.read([secondOpen, ''], () => benchTargets(secondOpen, ''));

      expect(memo.computations).toBe(1);
      expect(names(shown)).toEqual(['/Pages/Home']);
      expect(names(shown)).not.toContain('/Cards/New');
    });

    it('✅ reading through readMenuComponents puts it in', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });
      const memo = new MemoOnIdentity<BenchTarget[]>();

      const firstOpen = readMenuComponents(() => model.getComponents());
      memo.read([firstOpen, ''], () => benchTargets(firstOpen, ''));

      model.addComponent({ name: '/Cards/New' });

      const secondOpen = readMenuComponents(() => model.getComponents());
      const shown = memo.read([secondOpen, ''], () => benchTargets(secondOpen, ''));

      expect(memo.computations).toBe(2);
      expect(names(shown)).toContain('/Cards/New');
    });

    it('and a removal reaches the menu the same way', () => {
      const model = new LiveArrayModel();
      model.addComponent({ name: '/Pages/Home' });
      model.addComponent({ name: '/Cards/Old' });
      const memo = new MemoOnIdentity<BenchTarget[]>();

      const firstOpen = readMenuComponents(() => model.getComponents());
      memo.read([firstOpen, ''], () => benchTargets(firstOpen, ''));

      model.components.splice(1, 1); // `removeComponent` splices the same live array in place.

      const secondOpen = readMenuComponents(() => model.getComponents());
      const shown = memo.read([secondOpen, ''], () => benchTargets(secondOpen, ''));

      expect(names(shown)).toEqual(['/Pages/Home']);
    });
  });

  describe('§4 the wire: open() is what calls it', () => {
    /**
     * Returns `null` rather than asserting — a helper that asserts runs during collection, and a
     * mutant that deletes its subject then produces `Tests: 0 total` instead of a named red.
     */
    function openBody(): string | null {
      const source = stripComments(
        readFileSync(join(__dirname, '../../src/editor/src/views/VisualCanvas/PreviewChrome.tsx'), 'utf8')
      );
      const start = source.indexOf('function open() {');
      if (start === -1) return null;
      const end = source.indexOf('\n  }', start);
      if (end === -1) return null;
      return source.slice(start, end);
    }

    it('PreviewChrome still has an open() to read', () => {
      expect(openBody()).not.toBeNull();
    });

    it('open() reads the menu list through readMenuComponents', () => {
      expect(openBody()).toContain('setComponents(readMenuComponents(getComponents))');
    });

    it('open() does NOT hand the live array straight to setComponents', () => {
      // The reverted form, exactly. Comments are stripped first because the fix's own prose
      // quotes this line, and a raw match would pass on the explanation of a change that was undone.
      expect(openBody()).not.toContain('setComponents(getComponents())');
    });

    it('and readMenuComponents is imported from previewScope, not redefined locally', () => {
      const source = stripComments(
        readFileSync(join(__dirname, '../../src/editor/src/views/VisualCanvas/PreviewChrome.tsx'), 'utf8')
      );
      expect(source).toMatch(/readMenuComponents,?[\s\S]{0,400}from '\.\/previewScope'/);
      expect(source).not.toContain('function readMenuComponents');
    });
  });
});
