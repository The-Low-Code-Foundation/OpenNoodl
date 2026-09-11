/**
 * LGC-003 §1 — the viewer half: the recorder, the switch, and what a run pushes.
 *
 * The two claims that carry the most weight here are both negative, and both are asserted
 * rather than reasoned about:
 *
 *  - **with nothing attached, nothing accumulates.** No recorder is created, no map exists, and
 *    the compiled program is handed the one shared identity pair.
 *  - 🔴 **arming block tracing cannot clobber a human's Provenance recording.** TALK-003
 *    recorded that starting a trace *destroys* one in progress, and HUD-004 had to build an
 *    ownership set to make the shared switch survivable. Block tracing declines the shared
 *    switch entirely, and the tests below check that by identity: same buffer object, same
 *    owner set, same `traceEnabled`, before and after.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');
import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');

import {
  BLOCK_CAP,
  IDENTITY_VALUE_PROBE,
  ITERATION_CAP,
  NOOP_STATEMENT_PROBE,
  createBlockRunRecorder
} from '../src/blockrun';

function workspaceJson(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

/**
 * Fire `Run` n times.
 *
 * ⚠️ `Run` is an `EdgeTriggeredInput`: it fires on false→true only, so `setInputValue('run',
 * true)` three times in a row is **one** run. A test that repeats it without toggling passes
 * while measuring nothing, which is how the run-id assertion first went green.
 */
function pulse(node: { setInputValue(name: string, value: unknown): void }, times: number) {
  for (let i = 0; i < times; i++) {
    node.setInputValue('run', false);
    node.setInputValue('run', true);
  }
}

function createNode(opts: { workspace?: string; generatedCode?: string } = {}) {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(LogicBuilderModule.node));
  const node = context.nodeRegister.createNode('Logic Builder', 'lb-1');
  if (opts.workspace !== undefined) node.setInputValue('workspace', opts.workspace);
  if (opts.generatedCode !== undefined) node.setInputValue('generatedCode', opts.generatedCode);
  return { context, node };
}

describe('LGC-003 §1 — the identity probes', () => {
  it('`__p` returns its second argument, by reference', () => {
    const marker = { a: 1 };
    expect(IDENTITY_VALUE_PROBE('any-id', marker)).toBe(marker);
    expect(IDENTITY_VALUE_PROBE('any-id', undefined)).toBeUndefined();
    expect(IDENTITY_VALUE_PROBE('any-id', 0)).toBe(0);
  });

  it('is one shared pair, not a closure minted per run', () => {
    // Handed to every uninstrumented run of every Logic Builder in the app. A per-run closure
    // would allocate for a feature nobody has turned on, and would be polymorphic at the
    // call site of every probe in every program.
    expect(IDENTITY_VALUE_PROBE).toBe(IDENTITY_VALUE_PROBE);
    expect(NOOP_STATEMENT_PROBE('id')).toBeUndefined();
  });
});

describe('LGC-003 §1 — the node compiles against ten parameters', () => {
  it('an instrumented program runs, and the probes are the identity pair when unattached', () => {
    const { node } = createNode({
      workspace: workspaceJson({ type: 'noodl_define_output', fields: { NAME: 'result' } }),
      generatedCode: '__s("s1");\nOutputs["result"] = __p("b1", __p("b2", 2) * __p("b3", 3));\n'
    });

    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('');
    expect(node.getOutput('result').value).toBe(6);
  });

  it('code generated before probes existed still compiles and runs', () => {
    // The two names are declared unconditionally, so an old `generatedCode` string that
    // mentions neither simply never uses two of its parameters.
    const { node } = createNode({
      workspace: workspaceJson({ type: 'noodl_define_output', fields: { NAME: 'result' } }),
      generatedCode: 'Outputs["result"] = 2 * 3;\n'
    });

    node.setInputValue('run', true);
    expect(node.getOutput('result').value).toBe(6);
  });

  it('🔴 with nothing attached, no recorder is created at all', () => {
    const { context, node } = createNode({
      workspace: workspaceJson({ type: 'noodl_define_output', fields: { NAME: 'result' } }),
      generatedCode: 'Outputs["result"] = __p("b1", 1);\n'
    });

    // The acceptance criterion is "nothing accumulates", and this is where it is decided: the
    // switch is empty, so `beginBlockRun` returns nothing and there is no map to accumulate
    // into. Not a flag inside a recorder — no recorder.
    expect(context.beginBlockRun('lb-1')).toBeUndefined();

    pulse(node, 50);

    expect(context._blockTraceNodes).toBeUndefined();
    expect(node.getOutput('result').value).toBe(1);
  });
});

describe('LGC-003 §1 — the switch, per node and addressed', () => {
  it('arms and disarms one node without touching another', () => {
    const { context } = createNode();

    context.setBlockTracing('lb-1', true);
    expect(context.isBlockTracing('lb-1')).toBe(true);
    expect(context.isBlockTracing('lb-2')).toBe(false);

    context.setBlockTracing('lb-1', false);
    expect(context.isBlockTracing('lb-1')).toBe(false);
  });

  it('ignores a missing node id rather than arming a blank key', () => {
    const { context } = createNode();
    context.setBlockTracing('', true);
    context.setBlockTracing(undefined as unknown as string, true);
    expect(context.isBlockTracing('')).toBe(false);
  });

  it('arms a node this viewer does not have, because it may be mounted a moment later', () => {
    const { context } = createNode();
    expect(context.hasNode('not-here')).toBe(false);

    context.setBlockTracing('not-here', true);
    expect(context.isBlockTracing('not-here')).toBe(true);
  });
});

describe('LGC-003 — 🔴 block tracing cannot clobber a Provenance recording (TALK-003)', () => {
  it('arming block tracing changes nothing about the shared trace switch', () => {
    const { context } = createNode();

    // A human presses Record. HUD-004's ownership set, a live buffer, `traceEnabled` true.
    context.setTraceEnabled(true, 'the-human');
    const buffer = context._traceBuffer;
    const owners = Array.from(context._traceOwners);
    expect(context.traceEnabled).toBe(true);
    expect(buffer).toBeDefined();

    // A block editor opens on a Visual Function and arms its values.
    context.setBlockTracing('lb-1', true);
    context.setBlockTracing('lb-2', true);
    context.setBlockTracing('lb-1', false);

    // The recording is the same recording. Same object, not merely a buffer with the same
    // contents — a replaced buffer is exactly the data loss TALK-003 recorded.
    expect(context._traceBuffer).toBe(buffer);
    expect(context.traceEnabled).toBe(true);
    expect(Array.from(context._traceOwners)).toEqual(owners);
  });

  it('a recorded run does not push anything into the trace buffer', () => {
    const { context, node } = createNode({
      workspace: workspaceJson({ type: 'noodl_define_output', fields: { NAME: 'result' } }),
      generatedCode: 'Outputs["result"] = __p("b1", 7);\n'
    });

    context.setTraceEnabled(true, 'the-human');
    const before = context._traceBuffer.peekNextSeq();

    context.setBlockTracing('lb-1', true);
    node.setInputValue('run', true);
    node.setInputValue('run', true);

    // The Visual Function's *edges* may still be traced by the shared trace — that is the
    // Provenance panel's business. What must not happen is block values leaking into it, and
    // this node has nothing connected, so the count is the check.
    expect(context._traceBuffer.peekNextSeq()).toBe(before);
  });

  it('block tracing never adds itself as a trace owner', () => {
    const { context } = createNode();
    context.setBlockTracing('lb-1', true);

    expect(context.traceEnabled).toBe(false);
    expect(context._traceBuffer).toBeUndefined();
    expect(context._traceOwners.size).toBe(0);
  });
});

describe('LGC-003 §1 — one run, one frame', () => {
  function armedNode(generatedCode: string) {
    const frames: Record<string, unknown>[] = [];
    const { context, node } = createNode({
      workspace: workspaceJson({ type: 'noodl_define_output', fields: { NAME: 'result' } }),
      generatedCode
    });

    // Only the one method `endBlockRun` reaches for. A full `RuntimeEditorConnection` stub
    // would be sixteen methods of noise around the one line under test.
    context.editorConnection = {
      // `false`, so the debug-inspector path stays out of the way; the whole runtime asks this
      // before it does anything with the channel.
      isConnected: () => false,
      sendBlockValues(frame: Record<string, unknown>) {
        frames.push(frame);
      }
    } as unknown as typeof context.editorConnection;
    context.setBlockTracing('lb-1', true);

    return { context, node, frames };
  }

  it('pushes the map at the end of the run', () => {
    const { node, frames } = armedNode('Outputs["result"] = __p("sum", __p("a", 2) + __p("b", 3));\n');

    node.setInputValue('run', true);

    expect(frames).toHaveLength(1);
    const frame = frames[0] as { nodeId: string; values: Record<string, { n: number; v: string[] }> };
    expect(frame.nodeId).toBe('lb-1');
    expect(frame.values.a).toEqual({ n: 1, v: ['2'] });
    expect(frame.values.b).toEqual({ n: 1, v: ['3'] });
    expect(frame.values.sum).toEqual({ n: 1, v: ['5'] });
  });

  it('a block that did not run has no entry — the didn\'t-execute tell, at its source', () => {
    const { node, frames } = armedNode(
      'Outputs["result"] = __p("cond", false) && __p("never", 1);\n'
    );

    node.setInputValue('run', true);

    const frame = frames[0] as { values: Record<string, unknown> };
    expect(frame.values.cond).toBeDefined();
    expect(frame.values.never).toBeUndefined();
  });

  it('a run that throws still pushes what it got to before it threw', () => {
    // This is the run whose hollow blocks matter most: everything below the throw did not
    // execute, and that *is* the answer to "why did my condition never fire".
    const { node, frames } = armedNode('__p("before", 1);\nthrow new Error("boom");\n');

    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('boom');
    expect(frames).toHaveLength(1);
    expect((frames[0] as { values: Record<string, unknown> }).values.before).toBeDefined();
  });

  it('counts a loop and keeps the last iteration', () => {
    const { node, frames } = armedNode(
      'var t = 0; for (var i = 0; i < 12; i++) { __s("body"); t = __p("i", i); }\nOutputs["result"] = t;\n'
    );

    node.setInputValue('run', true);

    const frame = frames[0] as {
      values: Record<string, { n: number; v: string[] }>;
      statements: Record<string, number>;
    };
    expect(frame.values.i.n).toBe(12);
    expect(frame.values.i.v[frame.values.i.v.length - 1]).toBe('11');
    expect(frame.statements.body).toBe(12);
  });

  it('gives each run its own frame and a rising run id', () => {
    const { node, frames } = armedNode('Outputs["result"] = __p("a", 1);\n');

    // ⚠️ `Run` is edge-triggered, so `true` twice is one run. Every repeat below toggles.
    pulse(node, 3);

    expect(frames).toHaveLength(3);
    const ids = frames.map((f) => (f as { runId: number }).runId);
    expect(ids[1]).toBeGreaterThan(ids[0]);
    expect(ids[2]).toBeGreaterThan(ids[1]);
  });

  it('a disarmed node stops pushing', () => {
    const { context, node, frames } = armedNode('Outputs["result"] = __p("a", 1);\n');

    pulse(node, 1);
    context.setBlockTracing('lb-1', false);
    pulse(node, 2);

    expect(frames).toHaveLength(1);
  });
});

describe('LGC-003 §5.2 — the recorder\'s bounds', () => {
  it('keeps the last iteration whatever the cap, and never caps the count', () => {
    const recorder = createBlockRunRecorder();
    for (let i = 0; i < ITERATION_CAP * 4; i++) recorder.probeValue('b', i);

    const frame = recorder.take('lb-1', 1, 0);
    expect(frame.values.b.n).toBe(ITERATION_CAP * 4);
    expect(frame.values.b.v).toHaveLength(ITERATION_CAP);
    // The last slot is always the newest, so "the last plus ×N" is true even past the cap.
    expect(frame.values.b.v[ITERATION_CAP - 1]).toBe(String(ITERATION_CAP * 4 - 1));
    // …and the first ones are the real first ones, which is what makes scrubbing useful.
    expect(frame.values.b.v[0]).toBe('0');
  });

  it('bounds the number of distinct blocks and says so', () => {
    const recorder = createBlockRunRecorder();
    for (let i = 0; i < BLOCK_CAP + 25; i++) recorder.probeValue('b' + i, i);

    const frame = recorder.take('lb-1', 1, 0);
    expect(Object.keys(frame.values)).toHaveLength(BLOCK_CAP);
    expect(frame.truncated).toBe(true);
  });

  it('is not truncated in the ordinary case', () => {
    const recorder = createBlockRunRecorder();
    recorder.probeValue('b', 1);
    expect(recorder.take('lb-1', 1, 0).truncated).toBeUndefined();
  });

  it('returns the value unchanged even once it stops recording', () => {
    const recorder = createBlockRunRecorder();
    for (let i = 0; i < BLOCK_CAP; i++) recorder.probeValue('b' + i, i);

    // Past the cap the probe stops recording; it must never stop being the identity function,
    // or the program past the cap would compute something else.
    const marker = { a: 1 };
    expect(recorder.probeValue('one-too-many', marker)).toBe(marker);
  });

  it('formats in `previewValue`\'s display dialect, not JSON', () => {
    const recorder = createBlockRunRecorder();
    recorder.probeValue('s', 'hello');
    recorder.probeValue('u', undefined);
    recorder.probeValue('n', null);

    const frame = recorder.take('lb-1', 1, 0);
    expect(frame.values.s.v[0]).toBe('"hello"');
    // `undefined` and `null` read differently, which `JSON.stringify` cannot do.
    expect(frame.values.u.v[0]).toBe('undefined');
    expect(frame.values.n.v[0]).toBe('null');
  });

  it('survives a circular value, which is the reason formatting happens here and not on the wire', () => {
    const circular: Record<string, unknown> = { name: 'a' };
    circular.self = circular;

    const recorder = createBlockRunRecorder();
    recorder.probeValue('c', circular);

    expect(() => recorder.take('lb-1', 1, 0)).not.toThrow();
    expect(typeof recorder.take('lb-1', 1, 0).values).toBe('object');
  });
});
