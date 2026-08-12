/**
 * LGC-002 — the viewer half of "Do It".
 *
 * Two things are graded here and the second is the one that matters:
 *
 *  1. the fragment is compiled and run against the same eight parameters the node's own
 *     `_compileFunction` uses, so a fragment sees exactly what the whole program sees;
 *  2. **`Inputs` is the node's live values.** A Do It that answers against defaults answers
 *     confidently and wrongly, which is worse than not answering — so the node-level test at
 *     the bottom sets an input, then probes, and asserts the value that arrived on the port.
 *
 * §4's rule has its own block: a fragment that will not compile and a fragment that throws
 * must both come back with a message. `_compileFunction` swallowing a `SyntaxError` into a
 * `console.error` is what made a broken block program silent, and a Do It that fails quietly
 * would repeat it at a smaller scale.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');
import { ProbeExecutionContext, evaluateFragment } from '../src/nodes/std-library/logic-builder-probe';

function context(overrides: Partial<ProbeExecutionContext> = {}): ProbeExecutionContext {
  return {
    Inputs: {},
    Outputs: {},
    Noodl: {},
    Variables: {},
    Objects: {},
    Arrays: {},
    sendSignalOnOutput: () => undefined,
    __triggerSignal__: '__doIt__',
    ...overrides
  };
}

describe('evaluateFragment', () => {
  it('returns the value of the fragment', () => {
    expect(evaluateFragment(context(), 'return (3 * 4);')).toEqual({ ok: true, value: '12' });
  });

  it('reads the live Inputs it is handed, not defaults', () => {
    const result = evaluateFragment(context({ Inputs: { price: 7, quantity: 3 } }), 'return (Inputs["price"] * Inputs["quantity"]);');

    expect(result).toEqual({ ok: true, value: '21' });
  });

  it('runs the generator prelude, so a block that needs a helper function resolves it', () => {
    // Blockly's `math_random_int` emits a call to `mathRandomInt` and the *definition* of
    // `mathRandomInt` comes out of `finish()`. A fragment generated without the prelude is a
    // ReferenceError for a block that works perfectly in the whole program.
    const code = 'function mathRandomInt(a, b) { return a + b; }\n\nreturn (mathRandomInt(2, 3));';

    expect(evaluateFragment(context(), code)).toEqual({ ok: true, value: '5' });
  });

  describe('the previewValue display dialect, which is not JSON', () => {
    it('quotes a string', () => {
      expect(evaluateFragment(context(), 'return ("hello");').value).toBe('"hello"');
    });

    it('distinguishes null from undefined', () => {
      expect(evaluateFragment(context(), 'return (null);').value).toBe('null');
      expect(evaluateFragment(context(), 'return (undefined);').value).toBe('undefined');
    });

    it('renders an object and an array in the dialect rather than as JSON', () => {
      // `JSON.stringify` would quote the keys. This is a display language and the repo has
      // already been caught treating it as JSON once.
      expect(evaluateFragment(context(), 'return ({a: 1, b: "two"});').value).toBe('{a:1,b:"two"}');
      expect(evaluateFragment(context(), 'return ([1, 2, 3]);').value).toBe('[1,2,3]');
    });

    it('caps the preview rather than shipping the whole value', () => {
      const result = evaluateFragment(context(), 'return (new Array(500).fill("x").join(""));', 40);

      expect(result.value.length).toBeLessThanOrEqual(41);
      expect(result.value.endsWith('…')).toBe(true);
    });

    it('survives a circular value', () => {
      const code = 'var a = {}; a.self = a; return (a);';

      expect(evaluateFragment(context(), code)).toEqual({ ok: true, value: '{self:[Circular]}' });
    });
  });

  describe('§4 — the failure balloon has something to say', () => {
    it('reports a syntax error as a compile failure', () => {
      const result = evaluateFragment(context(), 'return (1 +);');

      expect(result.ok).toBe(false);
      expect(result.errorPhase).toBe('compile');
      expect(result.error).toContain('The block could not be compiled');
      expect(result.error.length).toBeGreaterThan('The block could not be compiled: '.length);
    });

    it('reports a thrown error as a run failure', () => {
      const result = evaluateFragment(context(), 'return (nope.missing);');

      expect(result.ok).toBe(false);
      expect(result.errorPhase).toBe('run');
      expect(result.error).toMatch(/nope is not defined/);
    });

    it('reports a bare string throw, which has no `message`', () => {
      // `_fail`'s call site records this exact hole: `error.message` alone left a
      // `throw "some string"` reporting the empty string, on the node's only failure surface.
      const result = evaluateFragment(context(), 'throw "went wrong";');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('went wrong');
    });

    it('refuses an empty fragment with a reason rather than reporting undefined', () => {
      const result = evaluateFragment(context(), '   ');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('nothing to work out');
    });

    it('never throws, whatever it is handed', () => {
      expect(() => evaluateFragment(context(), undefined as unknown as string)).not.toThrow();
      expect(() => evaluateFragment(context(), 'while (false) {}')).not.toThrow();
    });
  });

  describe('the two side effects that are contained', () => {
    it('discards writes to Outputs', () => {
      const outputs: Record<string, unknown> = {};
      const result = evaluateFragment(context({ Outputs: outputs }), 'Outputs["total"] = 99; return (1);');

      // The write lands in the throwaway object the context carries, and nothing here flushes
      // it to the node's ports the way `_executeLogic` does — so the node's `total` output is
      // untouched. The object itself is the context's, so it does see the write.
      expect(result).toEqual({ ok: true, value: '1' });
      expect(outputs.total).toBe(99);
    });

    it('swallows a signal send and says that it did', () => {
      const sent: string[] = [];
      const result = evaluateFragment(
        context({ sendSignalOnOutput: (name: string) => sent.push(name) }),
        'sendSignalOnOutput("done"); return (1);'
      );

      // The context's own sender is never called: a probe that pulsed a real signal would run
      // whatever a graph has sequenced behind it.
      expect(sent).toEqual([]);
      expect(result.suppressedSignals).toEqual(['done']);
    });

    it('reports a swallowed signal even when the fragment then throws', () => {
      const result = evaluateFragment(context(), 'sendSignalOnOutput("done"); throw new Error("boom");');

      expect(result.ok).toBe(false);
      expect(result.suppressedSignals).toEqual(['done']);
    });

    it('does not claim to contain a Variables write, because it does not', () => {
      // Recorded as behaviour, not as a wish. `classifyBlockForDoIt` refuses `set variable`,
      // but a value block can nest something impure and this is what happens when one does.
      const variables: Record<string, unknown> = {};
      const result = evaluateFragment(context({ Variables: variables }), 'Variables["x"] = 5; return (Variables["x"]);');

      expect(result).toEqual({ ok: true, value: '5' });
      expect(variables.x).toBe(5);
    });
  });
});

describe('Logic Builder _probeFragment', () => {
  function createNode(workspace?: string) {
    const nodeContext = new NodeContext();
    nodeContext.nodeRegister.register(NodeDefinition.defineNode(LogicBuilderModule.node));

    const node = nodeContext.nodeRegister.createNode('Logic Builder', 'lb-1');
    if (workspace !== undefined) node.setInputValue('workspace', workspace);
    return node;
  }

  function workspaceWithInput(name: string) {
    return JSON.stringify({
      blocks: { languageVersion: 0, blocks: [{ type: 'noodl_define_input', fields: { NAME: name, TYPE: 'number' } }] }
    });
  }

  it('evaluates against the values that actually arrived on the ports', () => {
    // ⚠️ The acceptance criterion in one test. `_internal.inputValues` is filled by the port
    // setter, and `_createExecutionContext` hands that same object to the fragment as `Inputs`.
    const node = createNode(workspaceWithInput('price'));
    // A port exists once something connects to it — `registerInputIfNeeded` is that door.
    node.registerInputIfNeeded('price');
    node.setInputValue('price', 12);

    expect(node._probeFragment('return (Inputs["price"] * 2);')).toEqual({ ok: true, value: '24' });
  });

  it('sees a value that changed after the last run', () => {
    const node = createNode(workspaceWithInput('price'));
    node.registerInputIfNeeded('price');
    node.setInputValue('price', 1);
    node.setInputValue('price', 41);

    expect(node._probeFragment('return (Inputs["price"] + 1);').value).toBe('42');
  });

  it('reports `__triggerSignal__` as the probe, never as a signal input the graph fired', () => {
    // A block program can branch on which signal started the run. Nothing started this one,
    // and telling it `'run'` would make it take a branch the graph never asked for.
    const node = createNode();

    expect(node._probeFragment('return (__triggerSignal__);').value).toBe('"__doIt__"');
  });

  it('does not fire the node\'s real signal outputs', () => {
    const node = createNode();
    const fired: string[] = [];
    node.sendSignalOnOutput = (name: string) => fired.push(name);

    node._probeFragment('sendSignalOnOutput("go"); return (1);');

    expect(fired).toEqual([]);
  });

  it('leaves the node\'s outputs alone', () => {
    const node = createNode();

    node._probeFragment('Outputs["total"] = 5; return (5);');

    expect(node.hasOutput('total')).toBe(false);
  });

  it('reports a failing fragment rather than swallowing it', () => {
    const node = createNode();
    const result = node._probeFragment('return (missing.thing);');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

/**
 * The routing half.
 *
 * ⚠️ `found: false` is a **different answer from an error**, and the editor says something
 * different for each: "the app is running but this node is not in it" sends a builder to the
 * right place, while reporting it as a failure of the block sends them to the wrong one. The
 * request is broadcast to every viewer, so both answers are on the wire at once whenever a
 * second preview is attached — which is what makes the distinction load-bearing rather than
 * tidy.
 */
describe('NodeContext.evaluateBlockFragment', () => {
  function contextWithNodes(nodes: unknown[]) {
    const nodeContext = Object.create(NodeContext.prototype);
    nodeContext.rootComponent = { nodeScope: { getAllNodesRecursive: () => nodes } };
    return nodeContext;
  }

  it('answers found:false when this viewer does not have the node', () => {
    const nodeContext = contextWithNodes([{ id: 'someone-else' }]);

    expect(nodeContext.evaluateBlockFragment('r1', 'lb-1', 'return (1);')).toEqual({
      requestId: 'r1',
      nodeId: 'lb-1',
      found: false
    });
  });

  it('answers found:false when there is no graph at all', () => {
    const nodeContext = Object.create(NodeContext.prototype);

    expect(nodeContext.evaluateBlockFragment('r1', 'lb-1', 'return (1);').found).toBe(false);
  });

  it('refuses a node that is not a blocks host, by capability rather than by type name', () => {
    const nodeContext = contextWithNodes([{ id: 'lb-1', model: { type: 'Logic Builder' } }]);

    expect(nodeContext.evaluateBlockFragment('r1', 'lb-1', 'return (1);').found).toBe(false);
  });

  it('delegates to the node and carries its answer back with the request id', () => {
    const probed: string[] = [];
    const nodeContext = contextWithNodes([
      {
        id: 'lb-1',
        _probeFragment: (code: string) => {
          probed.push(code);
          return { ok: true, value: '12' };
        }
      }
    ]);

    expect(nodeContext.evaluateBlockFragment('r7', 'lb-1', 'return (3 * 4);')).toEqual({
      requestId: 'r7',
      nodeId: 'lb-1',
      found: true,
      ok: true,
      value: '12'
    });
    expect(probed).toEqual(['return (3 * 4);']);
  });

  it('reports a throwing node rather than taking the editor channel down with it', () => {
    // The caller is a socket message handler. A throw here would kill the whole editor
    // connection — over a diagnostic the user reached for because something was already wrong.
    const nodeContext = contextWithNodes([
      {
        id: 'lb-1',
        _probeFragment: () => {
          throw new Error('the node itself broke');
        }
      }
    ]);

    const reply = nodeContext.evaluateBlockFragment('r1', 'lb-1', 'return (1);');

    expect(reply.found).toBe(true);
    expect(reply.ok).toBe(false);
    expect(reply.error).toContain('the node itself broke');
  });
});
