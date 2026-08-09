/**
 * BEN-005 — the scenario rules, and the one rule that reaches disk.
 *
 * ⚠️ The **preview** canvas (`views/VisualCanvas`), not the node-graph canvas
 * the rest of this directory tests — same reason `bench-inputs.test.ts` lives
 * here.
 *
 * Scenarios are the single deliberate exception to R5 (nothing on this surface
 * persists), so what is under test is mostly the boundary of that exception:
 * what a save is allowed to write, what a stale scenario does to a component
 * that has moved on, and — the one that would actually destroy something — that
 * a value which cannot survive `JSON.stringify` is refused rather than stored
 * and silently changed.
 *
 * The bar's rendering and the live "save three, restart, reopen" round trip are
 * BEN-007's job, driven, because neither is decidable here.
 */

import type { BenchInterface } from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import {
  BENCH_SCENARIOS_KEY,
  applyBenchScenario,
  benchScenarioApplyNotice,
  benchScenarioFrame,
  benchScenarioFrom,
  benchScenarioIsModified,
  benchScenarioStore,
  moveBenchScenario,
  readBenchScenarios,
  removeBenchScenario,
  renameBenchScenario,
  uniqueBenchScenarioName,
  upsertBenchScenario,
  type BenchScenario
} from '../../src/editor/src/views/VisualCanvas/benchScenarios';

function iface(...names: string[]): BenchInterface {
  return { inputs: names.map((name) => ({ name, type: 'string' })), outputs: [], backwards: [] };
}

function scenario(overrides: Partial<BenchScenario> & { name: string }): BenchScenario {
  return { inputs: {}, ...overrides };
}

describe('BEN-005 what a scenario is allowed to store', () => {
  it('keeps the values a component can actually be fed', () => {
    const draft = benchScenarioFrom('Loaded', { title: 'Rex', count: 3, ready: true, tags: ['a', 'b'] });

    expect(draft.error).toBeUndefined();
    expect(draft.scenario.inputs).toEqual({ title: 'Rex', count: 3, ready: true, tags: ['a', 'b'] });
  });

  it('drops an undefined rather than storing the absence of a value', () => {
    // An absent key already means *unset* everywhere else in the bench, so a
    // stored `undefined` would be a second spelling of the same thing — and
    // `JSON.stringify` drops it anyway, so the stored form would disagree with
    // the in-memory one the moment the project was saved.
    const draft = benchScenarioFrom('Empty', { title: undefined, count: 0 });

    expect(draft.scenario.inputs).toEqual({ count: 0 });
    expect('title' in draft.scenario.inputs).toBe(false);
  });

  it('refuses a NaN instead of storing the null it would become', () => {
    // Phase-55 found a coercing port turning a bad value into a *deleted*
    // property with no message. `JSON.stringify(NaN)` is `"null"`, so storing
    // one would reload as a different value of a different type — the same
    // failure, one save later and much harder to see.
    const draft = benchScenarioFrom('Broken', { width: Number.NaN });

    expect(draft.scenario).toBeUndefined();
    expect(draft.error).toContain('width');
  });

  it('refuses an Infinity, a function and a Date for the same reason', () => {
    expect(benchScenarioFrom('a', { x: Number.POSITIVE_INFINITY }).scenario).toBeUndefined();
    expect(benchScenarioFrom('a', { x: () => null }).scenario).toBeUndefined();
    // A Date stringifies to something, but not to something that parses back
    // as a Date — so the scenario would apply a string next time.
    expect(benchScenarioFrom('a', { x: new Date() }).scenario).toBeUndefined();
  });

  it('refuses a cycle rather than throwing inside the Save handler', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;

    let draft;
    expect(() => (draft = benchScenarioFrom('Cyclic', { data: cyclic }))).not.toThrow();
    expect(draft.scenario).toBeUndefined();
    expect(draft.error).toContain('data');
  });

  it('names a nested bad value by the input it came in on', () => {
    const draft = benchScenarioFrom('a', { good: 'yes', payload: { rows: [{ n: Number.NaN }] } });

    expect(draft.scenario).toBeUndefined();
    expect(draft.error).toContain('payload');
    expect(draft.error).not.toContain('good');
  });

  it('refuses an unnamed scenario', () => {
    expect(benchScenarioFrom('   ', { a: 1 }).scenario).toBeUndefined();
    expect(benchScenarioFrom('   ', { a: 1 }).error).toBeTruthy();
  });

  it('records the frame, because “renders correctly at 320” is part of the claim', () => {
    const draft = benchScenarioFrom('Narrow', { title: 'x' }, { width: 320, stretch: false });

    expect(draft.scenario.frame).toEqual({ width: 320 });
    expect(draft.scenario.stretch).toBe(false);
  });
});

describe('BEN-005 what reaches setMetaData', () => {
  it('stores the list under one key', () => {
    const store = benchScenarioStore([scenario({ name: 'Loaded' })]);

    expect(store).toEqual({ scenarios: [{ name: 'Loaded', inputs: {} }] });
    expect(BENCH_SCENARIOS_KEY).toBe('bench.scenarios');
  });

  it('stores undefined when the last scenario is deleted, leaving no key behind', () => {
    // `setMetaData(key, undefined)` is how the component goes back to having
    // never carried scenarios at all — an empty `{ scenarios: [] }` would be a
    // permanent diff for a feature the user stopped using.
    expect(benchScenarioStore([])).toBeUndefined();
  });

  it('round-trips through the stored shape', () => {
    const saved: BenchScenario[] = [
      { name: 'Empty', inputs: {} },
      { name: 'Loaded', inputs: { title: 'Rex', count: 3 }, frame: { width: 320 }, stretch: true }
    ];

    expect(readBenchScenarios(benchScenarioStore(saved))).toEqual(saved);
  });
});

describe('BEN-005 reading scenarios off a component that has been edited by hand', () => {
  it('reads nothing out of anything that is not the stored shape', () => {
    expect(readBenchScenarios(undefined)).toEqual([]);
    expect(readBenchScenarios(null)).toEqual([]);
    expect(readBenchScenarios('scenarios')).toEqual([]);
    expect(readBenchScenarios({ scenarios: 'Loaded' })).toEqual([]);
    expect(readBenchScenarios({})).toEqual([]);
  });

  it('drops the entries it cannot use and keeps the rest', () => {
    const scenarios = readBenchScenarios({
      scenarios: [null, 'Loaded', { inputs: { a: 1 } }, { name: '  ' }, { name: 'Good', inputs: { a: 1 } }]
    });

    expect(scenarios).toEqual([{ name: 'Good', inputs: { a: 1 } }]);
  });

  it('drops a duplicate name, because the name is the identity', () => {
    const scenarios = readBenchScenarios({
      scenarios: [
        { name: 'Loaded', inputs: { a: 1 } },
        { name: 'Loaded', inputs: { a: 2 } }
      ]
    });

    expect(scenarios.length).toBe(1);
    expect(scenarios[0].inputs).toEqual({ a: 1 });
  });

  it('gives a scenario with no inputs an empty set rather than leaving it undefined', () => {
    expect(readBenchScenarios({ scenarios: [{ name: 'Empty' }] })).toEqual([{ name: 'Empty', inputs: {} }]);
    expect(readBenchScenarios({ scenarios: [{ name: 'Odd', inputs: [1, 2] }] })).toEqual([{ name: 'Odd', inputs: {} }]);
  });

  it('ignores a frame that is not a width', () => {
    const scenarios = readBenchScenarios({
      scenarios: [{ name: 'a', inputs: {}, frame: { width: 'wide' }, stretch: 'yes' }]
    });

    expect(scenarios[0].frame).toBeUndefined();
    expect(scenarios[0].stretch).toBeUndefined();
  });
});

describe('BEN-005 a scenario meeting a component that has moved on', () => {
  it('applies what still resolves and names what did not', () => {
    // The BEN-001 §2 rule: a parameter aimed at a port that does not exist
    // renders nothing and reports nothing. A scenario is the one place a value
    // can outlive the port it was written for, so it is the place that rule has
    // to hold hardest.
    const applied = applyBenchScenario(
      scenario({ name: 'Loaded', inputs: { title: 'Rex', subtitle: 'gone', count: 3 } }),
      iface('title', 'count')
    );

    expect(applied.inputs).toEqual({ title: 'Rex', count: 3 });
    expect(applied.missing).toEqual(['subtitle']);
  });

  it('says so in words the user can act on', () => {
    expect(benchScenarioApplyNotice([])).toBeUndefined();
    expect(benchScenarioApplyNotice(['subtitle'])).toContain('subtitle');
    expect(benchScenarioApplyNotice(['a', 'b'])).toContain('are no longer');
  });

  it('applies whole when the interface is not derived yet', () => {
    // The first render happens before `getPorts` has been read. Emptying the
    // apply there would look exactly like a scenario that had lost its values.
    const applied = applyBenchScenario(scenario({ name: 'Loaded', inputs: { title: 'Rex' } }), undefined);

    expect(applied.inputs).toEqual({ title: 'Rex' });
    expect(applied.missing).toEqual([]);
  });

  it('takes the frame from the scenario, and the current one when it has none', () => {
    const current = { width: 768, stretch: false };

    expect(benchScenarioFrame(scenario({ name: 'a', frame: { width: 320 }, stretch: true }), current)).toEqual({
      width: 320,
      stretch: true
    });
    expect(benchScenarioFrame(scenario({ name: 'a' }), current)).toBe(current);
  });
});

describe('BEN-005 the unsaved-changes dot', () => {
  const saved = scenario({ name: 'Loaded', inputs: { title: 'Rex', count: 3 } });

  it('is absent while the bench still holds what was saved', () => {
    expect(benchScenarioIsModified(saved, { title: 'Rex', count: 3 })).toBe(false);
  });

  it('ignores the order the rows were touched in', () => {
    // The rail writes keys in whatever order the user edited them. A whole-object
    // `JSON.stringify` comparison would show the dot for having set the same
    // values in a different order.
    expect(benchScenarioIsModified(saved, { count: 3, title: 'Rex' })).toBe(false);
  });

  it('appears for a changed, an added and a removed value', () => {
    expect(benchScenarioIsModified(saved, { title: 'Rexy', count: 3 })).toBe(true);
    expect(benchScenarioIsModified(saved, { title: 'Rex', count: 3, extra: 1 })).toBe(true);
    expect(benchScenarioIsModified(saved, { title: 'Rex' })).toBe(true);
  });

  it('does not appear for an undefined the save would have dropped anyway', () => {
    // Otherwise Save is offered for a change that saving cannot record, and
    // pressing it leaves the dot exactly where it was.
    expect(benchScenarioIsModified(saved, { title: 'Rex', count: 3, extra: undefined })).toBe(false);
  });

  it('appears when a value can no longer be saved at all', () => {
    expect(benchScenarioIsModified(saved, { title: Number.NaN })).toBe(true);
  });

  it('follows the frame only when the scenario recorded one', () => {
    const framed = scenario({ name: 'Narrow', inputs: {}, frame: { width: 320 }, stretch: false });

    expect(benchScenarioIsModified(framed, {}, { width: 320, stretch: false })).toBe(false);
    expect(benchScenarioIsModified(framed, {}, { width: 768, stretch: false })).toBe(true);
    expect(benchScenarioIsModified(framed, {}, { width: 320, stretch: true })).toBe(true);
    expect(benchScenarioIsModified(scenario({ name: 'a' }), {}, { width: 999, stretch: true })).toBe(false);
  });
});

describe('BEN-005 the list operations behind the overflow menu', () => {
  const list: BenchScenario[] = [
    scenario({ name: 'Empty' }),
    scenario({ name: 'Loaded', inputs: { a: 1 } }),
    scenario({ name: 'Error' })
  ];

  it('overwrites by name and keeps the position', () => {
    const next = upsertBenchScenario(list, scenario({ name: 'Loaded', inputs: { a: 2 } }));

    expect(next.map((s) => s.name)).toEqual(['Empty', 'Loaded', 'Error']);
    expect(next[1].inputs).toEqual({ a: 2 });
  });

  it('appends a name it has not seen', () => {
    expect(upsertBenchScenario(list, scenario({ name: 'Long name' })).map((s) => s.name)).toEqual([
      'Empty',
      'Loaded',
      'Error',
      'Long name'
    ]);
  });

  it('never returns a name that is already taken', () => {
    expect(uniqueBenchScenarioName(['Empty'], 'Loaded')).toBe('Loaded');
    expect(uniqueBenchScenarioName(['Loaded'], 'Loaded')).toBe('Loaded 2');
    expect(uniqueBenchScenarioName(['Loaded', 'Loaded 2'], 'Loaded')).toBe('Loaded 3');
    expect(uniqueBenchScenarioName([], '   ')).toBe('Scenario');
  });

  it('removes by name', () => {
    expect(removeBenchScenario(list, 'Loaded').map((s) => s.name)).toEqual(['Empty', 'Error']);
    expect(removeBenchScenario(list, 'nope').length).toBe(3);
  });

  it('renames in place, and refuses a collision rather than merging two states into one', () => {
    expect(renameBenchScenario(list, 'Loaded', 'Full').map((s) => s.name)).toEqual(['Empty', 'Full', 'Error']);
    expect(renameBenchScenario(list, 'Loaded', 'Error').map((s) => s.name)).toEqual(['Empty', 'Loaded', 'Error']);
    expect(renameBenchScenario(list, 'Loaded', '  ').map((s) => s.name)).toEqual(['Empty', 'Loaded', 'Error']);
  });

  it('reorders, clamped at both ends', () => {
    expect(moveBenchScenario(list, 'Error', -1).map((s) => s.name)).toEqual(['Empty', 'Error', 'Loaded']);
    expect(moveBenchScenario(list, 'Empty', -1).map((s) => s.name)).toEqual(['Empty', 'Loaded', 'Error']);
    expect(moveBenchScenario(list, 'Error', 1).map((s) => s.name)).toEqual(['Empty', 'Loaded', 'Error']);
    expect(moveBenchScenario(list, 'nope', 1)).toBe(list);
  });

  it('never mutates the list it was given', () => {
    const before = JSON.stringify(list);

    upsertBenchScenario(list, scenario({ name: 'Loaded', inputs: { a: 9 } }));
    removeBenchScenario(list, 'Loaded');
    renameBenchScenario(list, 'Loaded', 'Full');
    moveBenchScenario(list, 'Error', -1);

    expect(JSON.stringify(list)).toBe(before);
  });
});
