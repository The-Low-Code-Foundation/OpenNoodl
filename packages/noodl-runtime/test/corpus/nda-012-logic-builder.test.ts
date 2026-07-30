/**
 * NDA-012 (CustomCode) — `Logic Builder`, the category's fifth node and NDA-004 §3's tenth and
 * last mute node.
 *
 * The audit is written up in `dev-docs/tasks/phase-30-node-library-audit/audit/customcode.md`.
 * What is here is the half that a citation could not settle: claims about what the node *does*
 * at runtime.
 *
 * Rows L1–L6 pin fixes made in this pass. Each was shown to redden with the fix reverted, and
 * the reverts are recorded in PROGRESS.md rather than left as an assertion nobody tried.
 *
 * Rows L7–L8 are `test.failing`: they reproduce defects this pass files rather than fixes,
 * per the corpus convention in `README.md` — the moment either is fixed the row fails loudly
 * and must be unmarked in the same commit.
 *
 * The signal rows go through a real receiver rather than the sender's own signal log, because
 * `flagOutputDirty` on a port declared `type: 'signal'` sends a *value* and a log kept on the
 * sender cannot tell that from a pulse (`node.ts:647-650`). That is the mistake NDA-012 found
 * on `Date To String`, and the reason these rows are wired the way they are.
 */

import type { NodeInstance } from '@noodl/types';

import { createGraph } from '../helpers/node-harness';
import { driveSetup } from './setup-harness';

import LogicBuilderModule = require('../../src/nodes/std-library/logic-builder');

/** Build a Blockly `workspaces.save()` payload from top-level blocks. */
function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>) {
  return { type, ...(fields ? { fields } : {}) };
}

/** A node whose `success`/`failure` are wired to a receiver that counts pulses. */
function wired(opts: { workspace?: string; generatedCode?: string } = {}) {
  const arrivals: string[] = [];

  const graph = createGraph(LogicBuilderModule, {
    node: {
      name: 'test.SignalSink',
      category: 'Test',
      inputs: {
        onSuccess: {
          type: 'signal',
          valueChangedToTrue: () => arrivals.push('success')
        },
        onFailure: {
          type: 'signal',
          valueChangedToTrue: () => arrivals.push('failure')
        }
      }
    }
  });

  const node = graph.make('Logic Builder', 'lb-1');
  const sink = graph.make('test.SignalSink', 'sink');

  sink.connectInput('onSuccess', node, 'success');
  sink.connectInput('onFailure', node, 'failure');

  // Order matters: the workspace decides how later ports are registered.
  if (opts.workspace !== undefined) node.setInputValue('workspace', opts.workspace);
  if (opts.generatedCode !== undefined) node.setInputValue('generatedCode', opts.generatedCode);

  const raised: { code: string; message: string }[] = [];
  graph.context.errorBus.subscribe((event: { code: string; message: string }) => {
    raised.push({ code: event.code, message: event.message });
  });

  return {
    node,
    arrivals,
    raised,
    run() {
      node.setInputValue('run', false);
      node.setInputValue('run', true);
      // Signals are queued per input port and drained on the receiving node's update; a pulse
      // that never gets drained is indistinguishable from one that was never sent.
      sink.update();
    },
    /** Drain the sink without sending anything — for rows that trigger a block-declared signal. */
    drain: () => sink.update(),
    error: () => node.getOutput('error').value
  };
}

describe('NDA-012 — Logic Builder failure surface', () => {
  it('L1: a block program that will not compile reports on all three channels', () => {
    // Before this pass, `_compileFunction` swallowed the SyntaxError into a `console.error`
    // and returned null, and `_executeLogic` bare-returned. `error` stayed empty, no signal
    // fired, and a graph sequenced behind the node stopped with no diagnosis anywhere. The
    // same defect NDA-004 §2 fixed on Expression and NDA-012 fixed on Function.
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'Outputs["a"] = ;;;('
    });

    h.run();

    expect(h.error()).toMatch(/could not be compiled/);
    expect(h.arrivals).toEqual(['failure']);
    expect(h.raised.map((e) => e.code)).toEqual(['logic-builder/code-not-compiled']);
  });

  it('L2: a node with no blocks yet stays silent — the control that makes L1 a defect', () => {
    // A freshly dropped node has nothing to run and nothing to say. If this row went red the
    // L1 fix would be reporting "failure" on every unconfigured node in every project.
    const h = wired();

    h.run();

    expect(h.error()).toBe('');
    expect(h.arrivals).toEqual([]);
    expect(h.raised).toEqual([]);
  });

  it('L3: Success fires once the run is through, after every output it wrote', () => {
    // NDA-004 §3's item: `Run` in, nothing out. Ordering is asserted rather than assumed —
    // the sink reads the output at the moment the pulse arrives.
    const seen: unknown[] = [];
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'Outputs["a"] = 42;\n'
    });

    h.node.registerOutputIfNeeded('a');
    h.run();
    seen.push(h.node.getOutput('a').value);

    expect(h.arrivals).toEqual(['success']);
    expect(seen).toEqual([42]);
    expect(h.error()).toBe('');
  });

  it('L4: a throw fires Failure, and a later clean run fires Success and clears Error', () => {
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'throw new Error("boom");'
    });

    h.run();
    expect(h.error()).toBe('boom');
    expect(h.arrivals).toEqual(['failure']);

    h.node.setInputValue('generatedCode', 'Outputs["a"] = 1;\n');
    h.run();

    expect(h.error()).toBe('');
    expect(h.arrivals).toEqual(['failure', 'success']);
  });

  it('L5: a bare-string throw reports the string, not the empty message', () => {
    // `error.message` alone left the node's only failure surface blank for a failure that
    // did happen. `simplejavascript.ts:327` had already made this choice.
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'throw "a bare string";'
    });

    h.run();

    expect(h.error()).toBe('a bare string');
    expect(h.arrivals).toEqual(['failure']);
  });

  it('L6: the raise is deduplicated by message, so an author mid-edit gets one event', () => {
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'throw new Error("boom");'
    });

    h.run();
    h.run();
    h.run();

    expect(h.arrivals).toEqual(['failure', 'failure', 'failure']);
    expect(h.raised).toHaveLength(1);
  });
});

describe('NDA-012 — Logic Builder reserved port names', () => {
  it('L7: writing to one of the node\'s own outputs is reported, not discarded', () => {
    // Author-declared names are registered verbatim on this node, unlike `Function`'s
    // `'out-' + name`, so `set output "error"` used to hit `registerOutputIfNeeded`'s early
    // return and then flag the *built-in* `error` output — whose getter returns the last
    // execution error. The program's value went nowhere and nothing said so. This is the
    // collision NDA-004 §3 predicted would come with a built-in completion signal.
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'error' })),
      generatedCode: 'Outputs["error"] = "from the blocks";\n'
    });

    h.run();

    expect(h.error()).toMatch(/cannot be set from the blocks/);
    expect(h.arrivals).toEqual(['failure']);
    expect(h.raised.map((e) => e.code)).toEqual(['logic-builder/reserved-port-name']);
  });

  it('L8: outputs that can land still land, alongside one that cannot', () => {
    const h = wired({
      workspace: workspace(block('noodl_set_output', { NAME: 'ok' }), block('noodl_set_output', { NAME: 'success' })),
      generatedCode: 'Outputs["ok"] = 7;\nOutputs["success"] = true;\n'
    });

    h.run();

    expect(h.node.getOutput('ok').value).toBe(7);
    expect(h.arrivals).toEqual(['failure']);
  });

  it('L9: a reserved name is not published to the editor as a second port', () => {
    // Published, it produced two ports called `run` — and an author could wire a value into
    // what is really the built-in signal.
    const setup = driveSetup({
      module: LogicBuilderModule,
      type: 'Logic Builder',
      nodes: [
        {
          id: 'lb-1',
          parameters: {
            workspace: workspace(
              block('noodl_define_input', { NAME: 'run', TYPE: 'string' }),
              block('noodl_define_input', { NAME: 'amount', TYPE: 'number' }),
              block('noodl_set_output', { NAME: 'error' }),
              block('noodl_set_output', { NAME: 'total' })
            )
          }
        }
      ]
    });

    expect(setup.portNames('lb-1')).toEqual(['amount', 'total']);
  });

  it('L10: clearing the blocks retracts the ports they published', () => {
    const setup = driveSetup({
      module: LogicBuilderModule,
      type: 'Logic Builder',
      nodes: [{ id: 'lb-1', parameters: { workspace: workspace(block('noodl_define_input', { NAME: 'amount' })) } }]
    });

    expect(setup.portNames('lb-1')).toEqual(['amount']);

    setup.setParameter('lb-1', 'workspace', workspace());
    expect(setup.portNames('lb-1')).toEqual([]);
  });
});

describe('NDA-012 — Logic Builder execution context', () => {
  it('L11: the program can tell which signal input started the run', () => {
    // `__triggerSignal__` was built on every execution and then not passed to the compiled
    // function, whose parameter list stopped at `sendSignalOnOutput`. It read as `undefined`
    // inside every block program ever run, so a node with two signal inputs could not tell
    // them apart.
    const h = wired({
      workspace: workspace(
        block('noodl_define_signal_input', { NAME: 'start' }),
        block('noodl_set_output', { NAME: 'who' })
      ),
      generatedCode: 'Outputs["who"] = __triggerSignal__;\n'
    });

    h.node.registerInputIfNeeded('start');
    h.node.setInputValue('start', true);

    expect(h.node.getOutput('who').value).toBe('start');
  });
});

describe('NDA-012 — Logic Builder, filed and not fixed', () => {
  test.failing('L12: changing a block from value input to signal input retypes the live port', () => {
    // `_io()`'s memo is invalidated correctly — `workspace.set` clears both `ioSource` and
    // `io`. The defect is one layer down: `registerInputIfNeeded` early-returns on a port
    // that already exists, so a port registered as a value under the old blocks stays a
    // value under the new ones. The name is unchanged, so the editor does not retract the
    // connection, and the program simply never runs until the graph is rebuilt.
    //
    // Filed rather than fixed because the repair means deregistering a port that may have
    // connections, and `deregisterInput` throws on exactly that.
    const h = wired({
      workspace: workspace(block('noodl_define_input', { NAME: 'x', TYPE: 'number' })),
      generatedCode: 'Outputs["ran"] = true;\n'
    });

    h.node.registerInputIfNeeded('x');
    expect(h.node.getInput('x').type).toBe('number');

    h.node.setInputValue('workspace', workspace(block('noodl_define_signal_input', { NAME: 'x' })));
    h.node.registerInputIfNeeded('x');
    h.node.setInputValue('x', true);

    expect(h.node.hasOutput('ran')).toBe(true);
  });
});
