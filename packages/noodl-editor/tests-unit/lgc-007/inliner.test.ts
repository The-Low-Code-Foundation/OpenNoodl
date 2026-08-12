/**
 * LGC-007 — inlining at generation time, graded on the JavaScript that comes out.
 *
 * The register entry this task inherits is `render:report clean means nothing drawn`, and the
 * same trap is available here: an inliner can produce beautifully-shaped JSON that generates
 * an empty program, and every assertion about the JSON would still pass. So these specs do not
 * stop at the JSON. They load the expanded workspace into a **real headless Blockly
 * workspace**, run the **real** `NoodlGenerators`, and assert the JavaScript. Blockly runs
 * headless in Node, so this costs nothing and closes the loop that inspection cannot.
 *
 * What it still does not prove is in `LGC-007-MY-BLOCKS.md` under "Deferred verification":
 * nothing here drags a block, opens a second Visual Function, or writes a project file.
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { initBlocklyIntegration } from '../../src/editor/src/views/BlocklyEditor/initialize';
import type { BlocklyWorkspaceJson } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import {
  detachDefinition,
  expandWorkspace
} from '../../src/editor/src/views/BlocklyEditor/myblocks/expand';
import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { arithmetic, callStatement, callValue, getInput, number, sendSignal, setOutput, workspace } from './fixtures';

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** Expand, then generate the way `BlocklyWorkspace.flushSave` will once this is wired in. */
function generate(json: BlocklyWorkspaceJson, store: MyBlocksStore): string {
  initBlocklyIntegration();
  const expanded = expandWorkspace(json, store).workspace;
  const headless = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(expanded as never, headless);
    return javascriptGenerator.workspaceToCode(headless);
  } finally {
    headless.dispose();
  }
}

describe('LGC-007 — a value block drops mid-expression and generates', () => {
  it('inlines a saved expression into `a + …`, which is the whole point of the value shape', () => {
    const store = newStore();
    const half = store.save({
      name: 'Half',
      body: workspace(arithmetic('DIVIDE', getInput('n'), number(2))),
      scope: 'project'
    });
    expect(half.shape).toBe('value');

    const code = generate(workspace(setOutput('r', arithmetic('ADD', callValue(half.id), number(1)))), store);

    expect(code).toBe('Outputs["r"] = Inputs["n"] / 2 + 1;\n');
  });

  it('substitutes an argument into the hole the definition left open', () => {
    const store = newStore();
    // `? * 2` — the A socket is the hole, so the saved block gets one parameter.
    const double = store.save({ name: 'Double', body: workspace(arithmetic('MULTIPLY', undefined, number(2))), scope: 'project' });
    expect(double.params).toHaveLength(1);
    expect(double.params[0].hole).toEqual(['0', 'i:A']);

    const code = generate(workspace(setOutput('r', callValue(double.id, [getInput('x')]))), store);

    expect(code).toBe('Outputs["r"] = Inputs["x"] * 2;\n');
  });

  it('gives each call site its own copy, so two uses do not alias', () => {
    const store = newStore();
    const double = store.save({ name: 'Double', body: workspace(arithmetic('MULTIPLY', undefined, number(2))), scope: 'project' });

    const code = generate(
      workspace(
        setOutput(
          'r',
          arithmetic('ADD', callValue(double.id, [getInput('a')]), callValue(double.id, [getInput('b')]))
        )
      ),
      store
    );

    expect(code).toBe('Outputs["r"] = Inputs["a"] * 2 + Inputs["b"] * 2;\n');
  });

  it('inlines a definition that itself calls a definition', () => {
    const store = newStore();
    const double = store.save({ name: 'Double', body: workspace(arithmetic('MULTIPLY', undefined, number(2))), scope: 'project' });
    const quadruple = store.save({
      name: 'Quadruple',
      body: workspace(callValue(double.id, [callValue(double.id, [], ['n'])], ['n'])),
      scope: 'project'
    });

    const code = generate(workspace(setOutput('r', callValue(quadruple.id, [number(3)]))), store);

    expect(code).toBe('Outputs["r"] = 3 * 2 * 2;\n');
  });
});

describe('LGC-007 — a statement block stacks and generates', () => {
  it('keeps what was stacked after the call block, after the inlined stack', () => {
    const store = newStore();
    const notify = store.save({
      name: 'Notify',
      body: workspace(setOutput('status', number(1), sendSignal('done'))),
      scope: 'project'
    });
    expect(notify.shape).toBe('statement');

    const code = generate(workspace(callStatement(notify.id, [], [], setOutput('after', number(9)))), store);

    expect(code).toBe('Outputs["status"] = 1;\nsendSignalOnOutput("done");\nOutputs["after"] = 9;\n');
  });

  it('concatenates a definition saved as several separate stacks, in order', () => {
    const store = newStore();
    const both = store.save({
      name: 'Both',
      body: workspace(setOutput('a', number(1)), setOutput('b', number(2))),
      scope: 'project'
    });

    const code = generate(workspace(callStatement(both.id)), store);

    expect(code).toBe('Outputs["a"] = 1;\nOutputs["b"] = 2;\n');
  });

  it('treats an empty definition as a no-op and closes the stack up around it', () => {
    const store = newStore();
    const empty = store.save({ name: 'Empty', body: workspace(), scope: 'project' });

    const code = generate(workspace(callStatement(empty.id, [], [], setOutput('after', number(1)))), store);

    expect(code).toBe('Outputs["after"] = 1;\n');
  });
});

describe('LGC-007 — the live definition link', () => {
  it('changes what a referencing program generates, without the reference being touched', () => {
    const store = newStore();
    const rate = store.save({ name: 'Rate', body: workspace(number(10)), scope: 'project' });
    const program = workspace(setOutput('total', arithmetic('MULTIPLY', getInput('qty'), callValue(rate.id))));

    expect(generate(program, store)).toBe('Outputs["total"] = Inputs["qty"] * 10;\n');

    // Edit the definition. The program is byte-for-byte the same object.
    store.save({ id: rate.id, name: 'Rate', body: workspace(number(20)), scope: 'project' });

    expect(generate(program, store)).toBe('Outputs["total"] = Inputs["qty"] * 20;\n');
  });

  it('leaves no call block behind, so no generator has to know saved blocks exist', () => {
    const store = newStore();
    const inner = store.save({ name: 'Inner', body: workspace(number(1)), scope: 'project' });
    const outer = store.save({ name: 'Outer', body: workspace(callValue(inner.id)), scope: 'project' });

    const expanded = expandWorkspace(workspace(setOutput('r', callValue(outer.id))), store).workspace;

    expect(JSON.stringify(expanded)).not.toContain('myblocks_call');
  });

  it('does not modify the workspace it was given', () => {
    const store = newStore();
    const inner = store.save({ name: 'Inner', body: workspace(number(1)), scope: 'project' });
    const program = workspace(setOutput('r', callValue(inner.id)));
    const before = JSON.stringify(program);

    expandWorkspace(program, store);

    expect(JSON.stringify(program)).toBe(before);
  });
});

describe('LGC-007 §4 — a definition whose shape changed under an existing reference', () => {
  it('refuses rather than emitting a signal call in the middle of an expression', () => {
    const store = newStore();
    const rate = store.save({ name: 'Rate', body: workspace(number(10)), scope: 'project' });
    const program = workspace(setOutput('total', callValue(rate.id)));
    expect(generate(program, store)).toBe('Outputs["total"] = 10;\n');

    // The builder adds a signal to the definition. It is now a statement block, and the
    // existing reference is a value plug asking for something that cannot be an expression.
    store.save({ id: rate.id, name: 'Rate', body: workspace(sendSignal('recalculated')), scope: 'project' });
    expect(store.get(rate.id).shape).toBe('statement');

    let error: Error;
    try {
      expandWorkspace(program, store);
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksShapeError');
    expect(error.message).toContain('Rate');
  });
});

describe('LGC-007 §4 — inline and detach', () => {
  it('inlines only the definition being deleted and leaves other references alone', () => {
    const store = newStore();
    const going = store.save({ name: 'Going', body: workspace(number(5)), scope: 'project' });
    const staying = store.save({ name: 'Staying', body: workspace(number(6)), scope: 'project' });

    const program = workspace(setOutput('r', arithmetic('ADD', callValue(going.id), callValue(staying.id))));
    const detached = detachDefinition(program, going.id, store);

    const asText = JSON.stringify(detached);
    expect(asText).not.toContain(going.id);
    expect(asText).toContain(staying.id);

    // And the detached program still generates the same thing it did before.
    expect(generate(detached, store)).toBe('Outputs["r"] = 5 + 6;\n');
  });

  it('lets the delete through once nothing references it any more', () => {
    const store = newStore();
    const going = store.save({ name: 'Going', body: workspace(number(5)), scope: 'project' });
    const caller = store.save({ name: 'Caller', body: workspace(setOutput('r', callValue(going.id))), scope: 'project' });

    // Refused first — §4 is explicit that a dangling reference is the worst outcome available.
    expect(() => store.remove(going.id)).toThrow(/still used by/);

    store.save({
      id: caller.id,
      name: 'Caller',
      body: detachDefinition(store.get(caller.id).body, going.id, store),
      scope: 'project'
    });
    store.remove(going.id, { force: true });

    expect(store.get(going.id)).toBeUndefined();
    expect(generate(store.get(caller.id).body, store)).toBe('Outputs["r"] = 5;\n');
  });
});
