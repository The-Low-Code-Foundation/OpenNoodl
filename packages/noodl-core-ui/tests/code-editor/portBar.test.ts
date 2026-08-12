/**
 * FUN-006 — the bar that knows what is true.
 *
 * The task file is unusually direct: a static hint is *"worth nothing"* and
 * should not be built. What earns the space is a line that names **their** ports
 * and **retires itself the moment they succeed** — a bar that persists once the
 * user is winning is a bar that gets dismissed while it is still useful.
 *
 * Two things here are contracts rather than behaviour:
 *
 * - **The last row is the discipline.** Writing an output silences it, with no
 *   dismissal and no delay.
 * - **§3's split with FUN-004.** Both surfaces read the same two lists, and
 *   *"two components narrating the same fact in different words is how a help
 *   surface stops being believed."* The bar owns "you have not started"; FUN-004
 *   owns "you started and this specific thing is wrong". The predicate is
 *   `minesAnyPort`, and both sides test it — from opposite directions.
 */
import type { OpenNodeFact } from '@noodl-core-ui/components/code-editor/authoringContext';
import {
  isDismissed,
  minesAnyPort,
  portBarMessage,
  portBarState,
  recordSuccess,
  RETIRE_AFTER_SUCCESSES,
  setDismissed,
  shouldShowBar,
  successCount
} from '@noodl-core-ui/components/code-editor/utils/portBar';
import { unionPorts } from '@noodl-core-ui/components/code-editor/utils/unionPorts';

function node(inputs: string[], outputs: { name: string; type: string }[] = []): OpenNodeFact {
  return {
    nodeId: 'n1',
    typeName: 'JavaScriptFunction',
    declaredInputs: inputs.map((name) => ({ name, type: 'string' })),
    declaredOutputs: outputs
  };
}

function messageFor(code: string, fact: OpenNodeFact | null = null, mode = 'function' as const) {
  return portBarMessage(portBarState(mode, fact, code));
}

/** A localStorage that exists, for the dismissal half. `testEnvironment: 'node'`. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('what the bar says', () => {
  it('tells a blank node that mentioning a name is what makes a port', () => {
    expect(messageFor('')).toBe(
      'This node has no ports yet. Type Inputs. — the name you use becomes an input port.'
    );
  });

  it('names their actual ports when the code mentions none of them', () => {
    // The sentence that would have saved the originating session.
    const message = messageFor('', node(['Input_1'], [{ name: 'Output_1', type: 'string' }]));

    expect(message).toBe('Read Input_1 with Inputs.Input_1, write Output_1 with Outputs.Output_1 = ….');
  });

  it('says the consequence when inputs are read and nothing is written', () => {
    expect(messageFor('const a = Inputs.Value;')).toBe(
      'Nothing is written to an output, so this node produces nothing when it runs.'
    );
  });

  it('disappears the moment an output is written', () => {
    // ⚠️ The discipline. No dismissal, no delay, no threshold.
    expect(messageFor('Outputs.Result = 1;')).toBe(null);
    expect(messageFor('Outputs.Result = Inputs.Value;')).toBe(null);
  });

  it('disappears on a signal output too', () => {
    expect(messageFor('Outputs.Done();')).toBe(null);
  });

  it('writes a signal output as a call in the second row', () => {
    const message = messageFor('', node([], [{ name: 'Done', type: 'signal' }]));
    expect(message).toBe('write Done with Outputs.Done().');
  });

  it('uses bracket notation for a name the dot form would not mine', () => {
    expect(messageFor('', node(['My Value']))).toContain('Inputs["My Value"]');
  });

  it('says nothing in expression mode, where a bare name already is a port', () => {
    // A bar telling an Expression author to type `Inputs.` would be telling them
    // to create a port called `Inputs`.
    expect(messageFor('', node(['Input_1']), 'expression' as never)).toBe(null);
    expect(messageFor('', node(['Input_1']), 'json' as never)).toBe(null);
  });
});

describe('§3 — the bar and FUN-004 never state the same fact', () => {
  it('turns on exactly where minesAnyPort is false', () => {
    // FUN-004's message 4 stands down on the same predicate, from the other side.
    const fact = node(['Input_1']);

    const blank = unionPorts(fact, '');
    expect(minesAnyPort(blank)).toBe(false);
    expect(messageFor('', fact)).not.toBe(null);

    const started = unionPorts(fact, 'const a = Inputs.Other;');
    expect(minesAnyPort(started)).toBe(true);
  });

  it('hands over to FUN-004 as soon as the author uses the notation at all', () => {
    // The author has started. The bar's "you have not started" row is no longer
    // true, and FUN-004 names the specific port that got left behind.
    const message = messageFor('const a = Inputs.Other;', node(['Input_1']));
    expect(message).toBe('Nothing is written to an output, so this node produces nothing when it runs.');
    expect(message).not.toContain('Input_1');
  });
});

describe('§2 — dismissal and retiring', () => {
  const blank = portBarState('function', node(['Input_1']), '');
  const silent = portBarState('function', null, 'Outputs.Result = 1;');

  it('shows by default', () => {
    expect(shouldShowBar(blank, false)).toBe(true);
  });

  it('never shows when there is nothing to say, forced or not', () => {
    expect(shouldShowBar(silent, false)).toBe(false);
    expect(shouldShowBar(silent, true)).toBe(false);
  });

  it('stays dismissed across nodes — per user, not per node', () => {
    // "Dismissing it on one node and meeting it again on the next is the
    // behaviour that makes people hate these."
    setDismissed(true);
    expect(isDismissed()).toBe(true);
    expect(shouldShowBar(blank, false)).toBe(false);
  });

  it('comes back when explicitly asked for', () => {
    setDismissed(true);
    expect(shouldShowBar(blank, true)).toBe(true);
  });

  it('retires after the threshold, and the `?` still overrides it', () => {
    for (let i = 0; i < RETIRE_AFTER_SUCCESSES; i++) recordSuccess(`node-${i}`);

    expect(successCount()).toBe(RETIRE_AFTER_SUCCESSES);
    expect(shouldShowBar(blank, false)).toBe(false);
    expect(shouldShowBar(blank, true)).toBe(true);
  });

  it('counts nodes, not edits — one node succeeding repeatedly counts once', () => {
    // ⚠️ Otherwise the threshold is reached by a single node and the bar retires
    // for someone who has succeeded exactly once.
    for (let i = 0; i < 10; i++) recordSuccess('the-same-node');

    expect(successCount()).toBe(1);
    expect(shouldShowBar(blank, false)).toBe(true);
  });

  it('ignores a success with no node id', () => {
    recordSuccess(undefined);
    expect(successCount()).toBe(0);
  });

  it('survives a corrupt store rather than failing to open the editor', () => {
    localStorage.setItem('codeeditor_portbar_successes', '{not json');
    expect(successCount()).toBe(0);
    expect(() => shouldShowBar(blank, false)).not.toThrow();
  });

  it('survives no localStorage at all', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(() => shouldShowBar(blank, false)).not.toThrow();
    expect(successCount()).toBe(0);
  });
});
