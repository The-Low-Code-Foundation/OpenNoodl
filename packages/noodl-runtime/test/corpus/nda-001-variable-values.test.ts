/**
 * NDA-001 corpus — reactivity row R7 and empty-value rows E1–E4 (defect classes A2, A3).
 *
 * A Variable node stores through `args.cast` and reports `changed` only when the cast result
 * differs from what it held (`variables/variablebase.ts:96-106`). Two consequences, and both
 * are in the corpus:
 *
 * - `initialize` seeds `currentValue` with `startValue`, so *setting* a Variable to its start
 *   value is a no-op and the author who wired "set to 0, then react" gets silence (R7);
 * - `cast` is `String` / `Number`, which have opinions about `null` and `undefined` that
 *   nobody chose: `String(null)` is the four-character text `"null"`, `Number(null)` is `0`
 *   and `Number(undefined)` is `NaN` — and `NaN !== NaN`, so once one lands the node reports
 *   `changed` on every subsequent set forever (E1–E4).
 *
 * These are single-node rows and run on `helpers/node-harness`. The graph-level empty-value
 * rows are in `nda-001-object-graph.test.ts`.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import './expected-failure';

import { createNode, type DrivenNode } from '../helpers/node-harness';

import NumberModule = require('../../src/nodes/std-library/variables/number');
import StringModule = require('../../src/nodes/std-library/variables/string');

/** A String Variable, freshly initialised (`startValue` is `''`). */
function stringVariable(): DrivenNode {
  return createNode(StringModule, 'String', 'corpus-string');
}

/** A Number Variable, freshly initialised (`startValue` is `0`). */
function numberVariable(): DrivenNode {
  return createNode(NumberModule, 'Number', 'corpus-number');
}

describe('NDA-001 R7: a Variable set to its start value', () => {
  test.failing('R7: setting a Variable to its startValue fires changed', () => {
    const variable = stringVariable();

    // `initialize` already put `''` in `currentValue`, so this write is indistinguishable
    // from "nothing happened" — even though an author explicitly sent a value.
    variable.node.setInputValue('value', '');

    expect(variable.out('savedValue')).toBe('');
    expect(variable.signals).toEqual(['changed']);
  });

  // ✅ Pinned: the ordinary case still reports, so a fix for R7 cannot be "always signal".
  test('R7 (pinned): a Variable set to a genuinely new value fires changed exactly once', () => {
    const variable = stringVariable();

    variable.node.setInputValue('value', 'hello');
    variable.node.setInputValue('value', 'hello');

    expect(variable.out('savedValue')).toBe('hello');
    expect(variable.signals).toEqual(['changed']);
  });
});

describe('NDA-001 E1–E4: what a Variable does with an empty value', () => {
  test.failing('E1: a String Variable fed null stores an empty value, not the text "null"', () => {
    const variable = stringVariable();

    variable.node.setInputValue('value', 'hello');
    variable.node.setInputValue('value', null);

    // Today: `"null"` — four visible characters in the UI, and truthy, so every downstream
    // Condition takes the wrong branch. Whatever NDA-003 decides "empty" is, it is not this.
    expect(variable.out('savedValue')).not.toBe('null');
    expect(variable.out('savedValue')).toBe('');
  });

  test.failing('E2: a String Variable fed undefined is left alone', () => {
    const variable = stringVariable();

    variable.node.setInputValue('value', 'hello');
    variable.node.setInputValue('value', undefined);

    // Today: `"undefined"` — nine characters of garbage, plus a spurious `changed`.
    expect(variable.out('savedValue')).toBe('hello');
    expect(variable.signals).toEqual(['changed']);
  });

  test.failing('E3: a Number Variable fed null is distinguishable from a real zero', () => {
    const cleared = numberVariable();
    const zero = createNode(NumberModule, 'Number', 'corpus-number-zero');

    cleared.node.setInputValue('value', 5);
    cleared.node.setInputValue('value', null);
    zero.node.setInputValue('value', 0);

    // Today both hold `0`. "The user cleared this field" and "the user typed zero" are the
    // same state, which is why a cleared numeric input reads as a real value downstream.
    expect(cleared.out('savedValue')).not.toBe(zero.out('savedValue'));
  });

  test.failing('E4: a Number Variable fed undefined is left alone', () => {
    const variable = numberVariable();

    variable.node.setInputValue('value', 5);
    variable.node.setInputValue('value', undefined);

    // Today: `NaN`.
    expect(variable.out('savedValue')).toBe(5);
  });

  test.failing('E4 (corollary): once NaN lands, changed stops meaning anything', () => {
    const variable = numberVariable();

    variable.node.setInputValue('value', undefined);
    const afterFirst = variable.signals.length;

    // `NaN !== NaN`, so `variablebase.ts:98` reports a change every time, for ever, on a
    // value that has not moved.
    variable.node.setInputValue('value', undefined);
    variable.node.setInputValue('value', undefined);

    expect(variable.signals.length).toBe(afterFirst);
  });
});
