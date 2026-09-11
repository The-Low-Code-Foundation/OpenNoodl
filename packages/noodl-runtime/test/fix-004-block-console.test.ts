/**
 * FIX-004 redaction ruling (b): the `console` a block program gets.
 *
 * ## What this suite grades and what it deliberately does not
 *
 * The split is the same one CWF-013 used for the `Log` node, for the same reason. This package
 * holds **destination selection** — does a block's `console.log` go to the run's sink or to the
 * real console — because that is the whole of the mechanism that lives here. The **scrubbing** is
 * graded in `nodegx-backend/tests/cloud-logic-builder-log.test.ts`, end to end through a real
 * service with a real provisioned secret, because the scrubber lives there and nothing in this
 * package can see a secret value.
 *
 * ⚠️ Every routing claim below is a **pair**: sink and no-sink. A one-armed version of the first
 * test would pass just as happily on a `console` that had been broken outright — "the global
 * console was not called" is true both when the line was routed and when no line was written at
 * all. The no-sink arm is what tells those apart.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import { createBlockConsole, describeArgument } from '../src/nodes/std-library/logic-builder-console';
import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');

interface Sunk {
  level: string;
  message: string;
  data?: unknown;
  nodeId?: string;
}

/**
 * A Logic Builder node, optionally with a run sink attached the way the cloud runner attaches one.
 *
 * ⚠️ `nodeScope` is assigned **after** the node is created and **before** `run` fires, because the
 * node reads the sink per run inside `_createExecutionContext` rather than caching it at
 * construction — which is the property that makes a per-request sink work at all.
 */
function createNode(
  generatedCode: string,
  opts: { withSink?: boolean; workspace?: string; inputs?: string[] } = {}
) {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(LogicBuilderModule.node));

  const node = context.nodeRegister.createNode('Logic Builder', 'lb-1');
  const sunk: Sunk[] = [];

  if (opts.withSink) {
    (node as unknown as { nodeScope: Record<string, unknown> }).nodeScope = {
      runContext: { log: (entry: Sunk) => sunk.push(entry), requestId: 'req-1' }
    };
  }

  // Order matters: the workspace decides how a later port is registered.
  if (opts.workspace !== undefined) node.setInputValue('workspace', opts.workspace);
  node.setInputValue('generatedCode', generatedCode);

  /**
   * ⚠️ An input port on this node exists because something asked for it. In a real graph that
   * something is a **connection** — `registerInputIfNeeded` is the node's answer to "a connection
   * wants an input port" — so a test that only sets a value is not reproducing anything:
   * `setInputValue` on an unregistered port is dropped, and `Inputs["secret"]` then reads
   * `undefined`. That is what this row did on its first run, and it looked exactly like a broken
   * console rather than a missing wire.
   */
  for (const name of opts.inputs || []) {
    (node as unknown as { registerInputIfNeeded(portName: string): void }).registerInputIfNeeded(name);
  }

  return { node, sunk };
}

describe('createBlockConsole — destination selection (FIX-004 redaction b)', () => {
  it('hands back the REAL global console when there is no sink, not a shim that forwards to it', () => {
    // Identity, not behaviour. A forwarding shim would pass a behavioural test and still change
    // what devtools shows for `console.log({a: 1})` — an inspectable object becomes text. The
    // browser is the no-sink case, so "no wrapper at all" is the claim worth pinning.
    expect(createBlockConsole(undefined)).toBe(console);
    expect(createBlockConsole(undefined, 'lb-1')).toBe(console);
  });

  it('routes log to the sink at info, carrying the node id, and does NOT reach the global console', () => {
    const sunk: Sunk[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      createBlockConsole((entry) => sunk.push(entry as Sunk), 'lb-7').log('the thing happened');

      expect(sunk).toEqual([{ level: 'info', message: 'the thing happened', nodeId: 'lb-7' }]);
      // The other half of "routed": it went to the sink INSTEAD of, not as well as, stdout.
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps each levelled method to the level a logger means by it', () => {
    const sunk: Sunk[] = [];
    const blockConsole = createBlockConsole((entry) => sunk.push(entry as Sunk));

    blockConsole.log('a');
    blockConsole.info('b');
    blockConsole.debug('c');
    blockConsole.warn('d');
    blockConsole.error('e');

    // `log` and `info` both mean info — that is what they mean everywhere, and `log` is the only
    // one the block generator emits.
    expect(sunk.map((e) => e.level)).toEqual(['info', 'info', 'debug', 'warn', 'error']);
  });

  it('joins several arguments with a space, the way console itself prints them', () => {
    const sunk: Sunk[] = [];
    createBlockConsole((entry) => sunk.push(entry as Sunk)).log('order', 7, true);

    expect(sunk[0].message).toBe('order 7 true');
  });

  it('leaves a method it does not route still callable', () => {
    // A `console` that answers `log` and throws on `trace` would be a worse object than the global
    // it replaces. Generated code only emits `console.log`, but `generatedCode` is a plain string
    // input and robustness here costs one loop.
    const blockConsole = createBlockConsole(() => undefined);

    expect(typeof blockConsole.trace).toBe('function');
    expect(() => blockConsole.trace()).not.toThrow();
  });
});

describe('describeArgument — folding an argument into the one field that gets a value pass', () => {
  it('keeps a string as itself and stringifies primitives', () => {
    expect(describeArgument('plain')).toBe('plain');
    expect(describeArgument(7)).toBe('7');
    expect(describeArgument(false)).toBe('false');
    expect(describeArgument(null)).toBe('null');
    expect(describeArgument(undefined)).toBe('undefined');
  });

  it('serialises an object, so a secret nested inside one is still text the value scrubber sees', () => {
    // This is the reason objects are folded into `message` rather than passed as `data`: the sink
    // value-scrubs the message and key-redacts the data, and a console argument has no key.
    expect(describeArgument({ token: 'sk_live_abc' })).toBe('{"token":"sk_live_abc"}');
    expect(describeArgument([1, 'two'])).toBe('[1,"two"]');
  });

  it('survives a cycle rather than taking down the run it was describing', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;

    expect(() => describeArgument(cyclic)).not.toThrow();
    expect(typeof describeArgument(cyclic)).toBe('string');
  });

  it('survives an object whose own toString throws', () => {
    const hostile = {
      toJSON() {
        throw new Error('no');
      },
      toString() {
        throw new Error('also no');
      }
    };

    expect(describeArgument(hostile)).toBe('[unprintable]');
  });
});

describe('a block program`s console, through the real node', () => {
  it('sends a logged line to the run sink when one is attached', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const { node, sunk } = createNode(`console.log('FIX004-RUNTIME-PROBE');\n`, { withSink: true });
      node.setInputValue('run', true);

      expect(node.getOutput('error').value).toBe('');
      expect(sunk).toEqual([{ level: 'info', message: 'FIX004-RUNTIME-PROBE', nodeId: 'lb-1' }]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('reaches the real console when NO sink is attached, which is the browser and is unchanged', () => {
    // 🔴 The control for the row above, and the row that makes its `not.toHaveBeenCalled()` mean
    // something. A `console` parameter that arrived as `undefined` would throw; a shadowed console
    // that dropped lines on the floor would satisfy the sink test's absence assertion. This arm
    // fails in both of those worlds.
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const { node, sunk } = createNode(`console.log('FIX004-RUNTIME-PROBE');\n`);
      node.setInputValue('run', true);

      expect(node.getOutput('error').value).toBe('');
      expect(spy).toHaveBeenCalledWith('FIX004-RUNTIME-PROBE');
      expect(sunk).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('logs the value of an input, which is the shape that leaked', () => {
    // `console.log(Inputs["secret"])` is verbatim what a `noodl_log` fed from a value socket
    // generates, and verbatim the program FIX-004's drive measured printing a secret in the clear.
    const { node, sunk } = createNode(`console.log(Inputs["secret"]);\n`, {
      withSink: true,
      inputs: ['secret']
    });
    node.setInputValue('secret', 'sk_live_runtime_probe');
    node.setInputValue('run', true);

    // The wire is live: the message is the value, not `"undefined"`. Without this the row would
    // pass on a node that never received the input at all.
    expect(sunk).toEqual([{ level: 'info', message: 'sk_live_runtime_probe', nodeId: 'lb-1' }]);
  });

  /**
   * 🔴 The positional guard, and the reason it reads two parameters in one program.
   *
   * `_compileFunction`'s parameter list and `_executeLogic`'s argument list are positional. A
   * `console` added to one and not the other — or added anywhere but last — silently shifts every
   * argument after it, and `__triggerSignal__` has been through exactly that once already: it was
   * built into the context and then not passed, so it read as `undefined` inside every block
   * program ever run.
   *
   * Insert `console` before `__triggerSignal__` and this row fails twice over: the trigger reads as
   * a probe function, and `console` receives the trigger string so `console.log` is not a function.
   */
  it('binds console AND __triggerSignal__ at their own positions, so neither list has drifted', () => {
    const { node, sunk } = createNode(`console.log('trigger:' + __triggerSignal__);\n`, { withSink: true });
    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('');
    expect(sunk[0].message).toBe('trigger:run');
  });
});
