/**
 * ERG-001 §3 — `Treat Unchanged as`, the contract's one sanctioned setting.
 *
 * ```
 * Treat Unchanged as:  Unchanged (default) | Done | Failure
 * ```
 *
 * Rule 3 is **"prefer a port over a setting whenever both would work"**, and it lists three
 * measured reasons not to reach for configuration: every option multiplies the test surface
 * and the AI authoring loop's search space; a default is a hidden behaviour; and wires are
 * visible while settings are not. This is the one place the contract says a setting *is*
 * right — a project whose whole idiom is "a duplicate is a bug" genuinely wants a different
 * answer, and it is one option on one port rather than a panel of signal-routing switches.
 *
 * The behaviour lives in `Node.prototype.reportOutcome`, so a node adopting it needs no code
 * of its own beyond spreading `outcomeInputs()` into its inputs. That is deliberate: the
 * clearest structural finding of phase 30 is that a rule implemented per node diverges.
 *
 * ## What is covered where
 *
 * The **Variables family** — the first home the spec names — is exercised in
 * `erg-001-variable-outcomes.test.ts`, including the A-D1 trap and the two-option enum. It has
 * no `Failure` port, so it cannot reach the `failure` remap at all.
 *
 * This file covers what no shipped node can yet: a node that *does* declare `Failure`, so the
 * third option exists and the remap can be driven. It uses a synthetic definition built from
 * the same `outcomeInputs`/`outcomeOutputs` helpers a real node would use, which is what makes
 * it a test of the mechanism rather than of a fixture.
 *
 * ⚠️ **`Failure` is a policy choice here, not a fault**, and the reason it carries a distinct
 * code (`outcome/unchanged-as-failure`) with a message naming the setting is that a bare "the
 * action could not be performed" would send an author hunting for a bug in a graph doing
 * exactly what they configured — the failure channel doing more damage than the thing it
 * reports.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { createNode, pulse, type DrivenNode } from '../helpers/node-harness';

import { outcomeInputs, outcomeOutputs } from '../../src/outcome';

/** A node that can both change something and legitimately do nothing, and can also fail. */
const CAN_NOOP = {
  done: 'Fires when it did something',
  unchanged: 'Fires when there was nothing to do',
  failure: 'Fires when it could not be done'
};

interface ProbeInstance extends NodeInstance {
  _internal: NodeInstance['_internal'] & { nextOutcome?: 'done' | 'unchanged' | 'failure' };
}

const ProbeModule: NodeModule = {
  node: {
    name: 'corpus.OutcomeProbe',
    category: 'Corpus',
    inputs: {
      /** Chooses what the action's *own* logic concluded, before any policy is applied. */
      concluded: {
        type: 'string',
        set: function (this: ProbeInstance, value: 'done' | 'unchanged' | 'failure') {
          this._internal.nextOutcome = value;
        }
      },
      ...outcomeInputs(CAN_NOOP),
      do: {
        type: 'signal',
        valueChangedToTrue: function (this: ProbeInstance) {
          const token: OutcomeToken = this.beginOutcome();
          this.reportOutcome(token, this._internal.nextOutcome || 'unchanged');
        }
      }
    },
    outputs: { ...outcomeOutputs(CAN_NOOP) }
  }
};

function probe(): DrivenNode<ProbeInstance> {
  return createNode<ProbeInstance>(ProbeModule, 'corpus.OutcomeProbe');
}

function errorsOn(v: DrivenNode<ProbeInstance>): string[] {
  const raised: string[] = [];
  v.context.errorBus.subscribe((event: { code: string }) => raised.push(event.code));
  return raised;
}

describe('ERG-001 §3: Treat Unchanged as', () => {
  it('offers all three options when the node has a Failure port to route to', () => {
    const type = (ProbeModule.node.inputs as Record<string, { type: { enums: Array<{ value: string }> } }>)
      .treatUnchangedAs.type;
    expect(type.enums.map((e) => e.value)).toEqual(['unchanged', 'done', 'failure']);
  });

  it('declares no setting at all on a node that cannot no-op', () => {
    // "A node that cannot be a no-op gets no `Unchanged` port", and a node with no `Unchanged`
    // has nothing to reinterpret. Adding a dead setting to it is exactly the test-surface
    // multiplication Rule 3's first warning is about.
    expect(outcomeInputs({ done: 'x', failure: 'y' })).toEqual({});
    expect(outcomeInputs()).toEqual({});
  });

  /**
   * ⚠️ The A-D1 trap, at the mechanism rather than on one node. A declared `default` does not
   * run its setter, so the stored value is `undefined` until an author touches the panel. The
   * remap is written as "only 'done'/'failure' remap" so that `undefined` lands on the default
   * without anything having run.
   */
  it('defaults to Unchanged with the setter never having run', () => {
    const v = probe();
    v.node.setInputValue('concluded', 'unchanged');
    pulse(v.node, 'do');

    expect(v.signals).toEqual(['unchanged', 'completed']);
  });

  it('reports Done when set to Done', () => {
    const v = probe();
    v.node.setInputValue('treatUnchangedAs', 'done');
    v.node.setInputValue('concluded', 'unchanged');
    pulse(v.node, 'do');

    // Exactly one outcome — `unchanged` is not sent alongside. "Exactly one" is the
    // load-bearing half of Rule 1, and a setting must not turn it into "at least one".
    expect(v.signals).toEqual(['done', 'completed']);
  });

  it('reports Failure when set to Failure, with a code that names the setting', () => {
    const v = probe();
    const raised = errorsOn(v);
    v.node.setInputValue('treatUnchangedAs', 'failure');
    v.node.setInputValue('concluded', 'unchanged');
    pulse(v.node, 'do');

    expect(v.signals).toEqual(['failure', 'completed']);
    // ⚠️ Not `outcome/unspecified-failure`. This is a configured reinterpretation, not a
    // fault, and the reason on the channel has to say so.
    expect(raised).toEqual(['outcome/unchanged-as-failure']);
  });

  it('(control) leaves Done and Failure alone whatever the setting says', () => {
    for (const policy of ['unchanged', 'done', 'failure']) {
      const onDone = probe();
      onDone.node.setInputValue('treatUnchangedAs', policy);
      onDone.node.setInputValue('concluded', 'done');
      pulse(onDone.node, 'do');
      expect(onDone.signals).toEqual(['done', 'completed']);

      const onFailure = probe();
      onFailure.node.setInputValue('treatUnchangedAs', policy);
      onFailure.node.setInputValue('concluded', 'failure');
      pulse(onFailure.node, 'do');
      expect(onFailure.signals).toEqual(['failure', 'completed']);
    }
  });

  /**
   * ⚠️ The reason `Completed` is the one port with no exemption: it is the wire whose meaning
   * does not move when somebody edits this setting.
   */
  it('(control) Completed fires last whatever the setting is', () => {
    for (const policy of ['unchanged', 'done', 'failure']) {
      const v = probe();
      v.node.setInputValue('treatUnchangedAs', policy);
      v.node.setInputValue('concluded', 'unchanged');
      pulse(v.node, 'do');

      expect(v.signals.length).toBe(2);
      expect(v.signals[1]).toBe('completed');
    }
  });
});
