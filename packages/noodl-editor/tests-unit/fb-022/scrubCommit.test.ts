/**
 * FB-022 AC1 — a whole drag is one undo entry.
 *
 * ## What is real here and what is not
 *
 * `UndoQueue` and `UndoActionGroup` are the **real** ones, imported from the model. That is
 * the whole point: the trap this file exists to pin is a property of that class — a group
 * built the wrong way is pushed successfully, reads as an entry in the history panel, and
 * then does nothing when undone, because `UndoActionGroup.undo()` loops from `ptr - 1` and
 * the constructor's `do`/`undo` form leaves `ptr` at 0. A fake queue would accept every shape
 * equally and prove nothing.
 *
 * ⚠️ The **node** is a fake, because `NodeGraphNode` cannot be imported by this runner. It is
 * not, however, a *simplified* one where it counts.
 *
 * 🔴 **THE FIRST VERSION OF THIS FAKE HAD A HOLE SHAPED EXACTLY LIKE THE DEFECT.** Its
 * `setParameter(name, value)` ignored the third argument, so it could not tell a write that
 * asked for undo from one that did not — and the headline claim of this whole task, *the live
 * writes record nothing*, was true by construction and could not fail. A mutant that made
 * `writeScrubStep` push an undo entry on every pixel killed no row at all. So the fake now
 * mirrors the undo half of `NodeGraphNode.setParameter` (lines 715-792): if a caller asks for
 * undo, an entry lands in the real queue, and the assertion that none does becomes falsifiable.
 *
 * 🔴 **AND THE FAKE WAS STILL MORE CAPABLE THAN THE REAL OBJECT — THE DRIVE FOUND IT.** The
 * `model` a row actually holds is a **`ModelProxy`**, not a `NodeGraphNode`, and it did not have
 * `notifyListeners` at all. The fake did. So the "notifies the panel" arm below passed while the
 * shipped code threw `model.notifyListeners is not a function` on the first real undo — the
 * value reverted in the project and the field on screen kept showing the dragged number.
 *
 * The fix was to complete the proxy's facade. The guard against it happening again is
 * `describe('the target interface is one ModelProxy can satisfy')` at the bottom of this file,
 * which reads `modelProxy.ts` and checks the methods `commitScrub` calls are really there. A
 * fake can always be given a method; only the real source can say whether it exists.
 *
 * What is still left to the drive: that the panel visibly redraws when an entry is undone.
 */
import * as fs from 'fs';
import * as path from 'path';

import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { commitScrub, sameParameterValue, writeScrubStep } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/scrubCommit';

/**
 * A value store that mirrors the undo half of `NodeGraphNode.setParameter`. See the module note
 * — the mirroring is the point, not an accident of thoroughness.
 */
function fakeNode() {
  const parameters: Record<string, unknown> = {};
  const events: string[] = [];
  const node = {
    parameters,
    events,
    setParameter(name: string, value: unknown, args?: TSFixme) {
      let undoGroup: UndoActionGroup | undefined;
      if (args && args.undo && typeof args.undo !== 'object') {
        undoGroup = args.undo = new UndoActionGroup({ label: args.label || 'set parameter' });
      }

      let oldValue = parameters[name];
      if (value === undefined) delete parameters[name];
      else parameters[name] = value;

      if (args && args.undo) {
        const queue = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;
        if (args.oldValue) oldValue = args.oldValue;
        queue.push({
          label: args.label,
          do: () => node.setParameter(name, value),
          undo: () => node.setParameter(name, oldValue)
        });
        if (undoGroup) UndoQueue.instance.push(undoGroup);
      }
    },
    notifyListeners(event: string) {
      events.push(event);
      return undefined;
    }
  };
  return node;
}

/** One drag, start to finish, through the same two functions the rows call. */
function drag(model: ReturnType<typeof fakeNode>, name: string, from: unknown, values: unknown[]) {
  for (const value of values) writeScrubStep(model, name, value);
  return commitScrub({
    model,
    name,
    startValue: from,
    finalValue: values[values.length - 1],
    label: `change ${name}`
  });
}

beforeEach(() => UndoQueue.instance.clear());

describe('FB-022 AC1 — the live writes record nothing', () => {
  it('applies a value without touching the history', () => {
    const model = fakeNode();
    for (let x = 0; x < 40; x++) writeScrubStep(model, 'width', { value: 100 + x, unit: 'px' });

    expect(model.parameters.width).toEqual({ value: 139, unit: 'px' });
    // 🔴 Falsifiable only because the fake honours `args.undo` — see the module note.
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  // The control that proves the arm above is measuring something. Same fake, same loop, one
  // difference: this caller asks for undo, and forty entries duly appear. Without this, "0"
  // is also what a fake that cannot record would report.
  it('and the same fake DOES record when a caller asks it to', () => {
    const model = fakeNode();
    for (let x = 0; x < 40; x++) {
      model.setParameter('width', { value: 100 + x, unit: 'px' }, { undo: true, label: 'typed' });
    }
    expect(UndoQueue.instance.getHistory().length).toBe(40);
  });
});

describe('FB-022 AC1 — the gesture records exactly one entry', () => {
  it('pushes one entry for a forty-sample drag', () => {
    const model = fakeNode();
    const samples = Array.from({ length: 40 }, (_, i) => ({ value: 100 + i, unit: 'px' }));

    expect(drag(model, 'width', { value: 100, unit: 'px' }, samples)).toBe(true);

    // 🔴 One. Not forty, and not zero. The forty is the defect this criterion names; the zero
    // is the defect the shape that avoids it slips into, because a group built the wrong way
    // pushes without error and simply never fires.
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    expect(UndoQueue.instance.getHistory()[0].label).toBe('change width');
  });

  it('undoes the whole drag in one step, back to where the press landed', () => {
    const model = fakeNode();
    drag(model, 'width', { value: 100, unit: 'px' }, [
      { value: 120, unit: 'px' },
      { value: 160, unit: 'px' },
      { value: 200, unit: 'px' }
    ]);

    UndoQueue.instance.undo();
    // Not 160, which is what an entry built from "the value before the last write" would give,
    // and not 200, which is what `setParameter`'s own falsy `oldValue` check would give.
    expect(model.parameters.width).toEqual({ value: 100, unit: 'px' });
  });

  it('redoes back to the end of the drag', () => {
    const model = fakeNode();
    drag(model, 'width', { value: 100, unit: 'px' }, [{ value: 200, unit: 'px' }]);

    UndoQueue.instance.undo();
    UndoQueue.instance.redo();
    expect(model.parameters.width).toEqual({ value: 200, unit: 'px' });
  });

  // 🔴 THE CASE `setParameter`'s OWN `args.oldValue` CANNOT EXPRESS. Its check is `if
  // (args.oldValue)` — falsy — so a drag that starts on a port with no parameter set falls
  // through to the current parameter, which by commit time is the dragged value. Undo would
  // restore the drag. This arm is why `commitScrub` builds its own group.
  it('undoes back to no parameter at all when the drag began on the default', () => {
    const model = fakeNode();
    expect(model.parameters.width).toBeUndefined();

    drag(model, 'width', undefined, [
      { value: 101, unit: 'px' },
      { value: 150, unit: 'px' }
    ]);
    expect(model.parameters.width).toEqual({ value: 150, unit: 'px' });

    UndoQueue.instance.undo();
    expect(model.parameters.width).toBeUndefined();
    expect('width' in model.parameters).toBe(false);
  });

  it('notifies the panel on both undo and redo, so the field redraws', () => {
    const model = fakeNode();
    drag(model, 'width', { value: 100, unit: 'px' }, [{ value: 200, unit: 'px' }]);

    UndoQueue.instance.undo();
    expect(model.events).toContain('modelParameterUndo');
    UndoQueue.instance.redo();
    expect(model.events).toContain('modelParameterRedo');
  });

  it('keeps one entry per gesture across several gestures', () => {
    const model = fakeNode();
    drag(model, 'width', { value: 100, unit: 'px' }, [{ value: 150, unit: 'px' }]);
    drag(model, 'width', { value: 150, unit: 'px' }, [{ value: 220, unit: 'px' }]);
    expect(UndoQueue.instance.getHistory().length).toBe(2);

    UndoQueue.instance.undo();
    expect(model.parameters.width).toEqual({ value: 150, unit: 'px' });
    UndoQueue.instance.undo();
    expect(model.parameters.width).toEqual({ value: 100, unit: 'px' });
  });
});

describe('FB-022 AC1 — a drag that changed nothing records nothing', () => {
  it('pushes no entry when the drag ends where it started', () => {
    const model = fakeNode();
    expect(
      drag(model, 'width', { value: 100, unit: 'px' }, [
        { value: 140, unit: 'px' },
        { value: 100, unit: 'px' }
      ])
    ).toBe(false);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  // 🔴 The unit-bearing rows rebuild `{ value, unit }` on every write, so a comparison by
  // reference says "changed" for a drag that ended exactly where it began — and the history
  // fills with entries that do nothing when undone.
  it('compares stored values structurally, not by reference', () => {
    expect(sameParameterValue({ value: 100, unit: 'px' }, { value: 100, unit: 'px' })).toBe(true);
    expect(sameParameterValue({ value: 100, unit: 'px' }, { value: 100, unit: '%' })).toBe(false);
    expect(sameParameterValue({ value: 100, unit: 'px' }, { value: 101, unit: 'px' })).toBe(false);
    expect(sameParameterValue(12, 12)).toBe(true);
    expect(sameParameterValue(12, 13)).toBe(false);
  });

  // Dimension stores a third field on the same parameter. Ignoring it would make a drag that
  // silently un-ticked `Fixed` look like no change at all, and record no way back.
  it('counts the Fixed flag as part of the value', () => {
    expect(
      sameParameterValue({ value: 100, unit: '%', isFixed: true }, { value: 100, unit: '%', isFixed: false })
    ).toBe(false);
    expect(sameParameterValue({ value: 100, unit: '%', isFixed: undefined }, { value: 100, unit: '%' })).toBe(true);
  });

  it('does not confuse an unset parameter with a zero', () => {
    expect(sameParameterValue(undefined, 0)).toBe(false);
    expect(sameParameterValue(undefined, undefined)).toBe(true);
  });

  it('records an entry for a drag off the default even though the start value is undefined', () => {
    const model = fakeNode();
    expect(drag(model, 'opacity', undefined, [0.5])).toBe(true);
    expect(UndoQueue.instance.getHistory().length).toBe(1);
  });
});


/**
 * 🔴 The guard for the defect the first drive found: a fake can be given any method, so the
 * only thing that can say whether `commitScrub`'s target really exists is the real source of
 * the object rows actually hold.
 *
 * `ModelProxy` cannot be imported here — it reaches `@noodl-models/nodegraphmodel` and the node
 * library — so its surface is parsed out of the file. That is weaker than calling it, and it is
 * the strongest thing available in this runner; the drive is what closes the gap.
 */
describe('FB-022 — the target interface is one ModelProxy can actually satisfy', () => {
  const PROXY_TS = path.join(
    __dirname,
    '../../src/editor/src/views/panels/propertyeditor/models/modelProxy.ts'
  );

  /** Method names declared on the class body, e.g. `setParameter(name, value, args = {}) {`. */
  function proxyMethods(): string[] {
    const source = fs.readFileSync(PROXY_TS, 'utf8');
    const body = source.slice(source.indexOf('export class ModelProxy'));
    const matches = body.match(/^ {2}(?:get )?([A-Za-z_]\w*)\s*\(/gm) || [];
    return Array.from(new Set(matches.map((m) => /([A-Za-z_]\w*)\s*\($/.exec(m.trim())[1])));
  }

  // A parser that matched nothing would make the assertion below pass on an empty set.
  it('parses a plausible method list off the real ModelProxy', () => {
    const methods = proxyMethods();
    expect(methods.length).toBeGreaterThan(5);
    expect(methods).toContain('setParameter');
    expect(methods).toContain('getParameter');
  });

  // 🔴 THE ARM THAT WAS MISSING. `notifyListeners` was absent from this class when FB-022
  // shipped its first build, and every spec in this file passed anyway.
  it('has every method commitScrub calls on its target', () => {
    const methods = proxyMethods();
    for (const required of ['setParameter', 'notifyListeners']) {
      expect(methods).toContain(required);
    }
  });
});
