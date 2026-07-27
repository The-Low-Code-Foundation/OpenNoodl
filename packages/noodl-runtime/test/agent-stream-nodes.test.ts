/**
 * AGENT-007 — the four stream utility nodes.
 *
 * The parsing is proved in agent-stream-parsers.test.ts; this suite is about the node
 * behaviour on top of it: signal edges, bounded buffers that report what they dropped,
 * and — for Stream Buffer, the only one of the four that owns a timer — that nothing
 * is left ticking after the node is deleted.
 */

import type { NodeInstance } from '@noodl/types';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

const accumulatorModule = require('../src/nodes/std-library/agent/text-accumulator');
const jsonParserModule = require('../src/nodes/std-library/agent/json-stream-parser');
const patternModule = require('../src/nodes/std-library/agent/pattern-extractor');
const bufferModule = require('../src/nodes/std-library/agent/stream-buffer');

function makeTimers() {
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  return {
    setTimeoutImpl: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeoutImpl: (id: number) => {
      timers.delete(id);
    },
    pending: () => timers.size,
    delays: () => Array.from(timers.values()).map((t) => t.ms),
    run: () => {
      const entries = Array.from(timers.values());
      timers.clear();
      entries.forEach((t) => t.fn());
    }
  };
}

/** Builds a node and records the signals it sends. */
function createNode(module: any, typeName: string) {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(module.node));
  const node = context.nodeRegister.createNode(typeName, typeName + '-1') as unknown as NodeInstance;

  const signals: string[] = [];
  const original = (node as any).sendSignalOnOutput.bind(node);
  (node as any).sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };

  return {
    node,
    signals,
    out: (name: string) => (node.getOutput(name) as any).value,
    metadata: context.nodeRegister.getNodeMetadata(typeName),
    /** Fires an edge-triggered input, resetting the edge first. */
    pulse: (name: string) => {
      node.setInputValue(name, false);
      node.setInputValue(name, true);
    }
  };
}

// ============================================================================

describe('net.noodl.TextAccumulator', () => {
  it('declares the documented ports', () => {
    const { metadata } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    expect(Object.keys(metadata.inputs).sort()).toEqual(
      ['add', 'chunk', 'clear', 'delimiter', 'maxLength', 'maxMessages'].sort()
    );
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'accumulated',
        'byteCount',
        'changed',
        'characterCount',
        'cleared',
        'droppedCharacters',
        'droppedMessages',
        'error',
        'lastMessage',
        'messageCount',
        'messageReceived',
        'messages',
        'overflowed'
      ].sort()
    );
  });

  it('accumulates tokens with no delimiter — the AI-chat case', () => {
    const { node, out, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('delimiter', '');

    for (const token of ['Hel', 'lo, ', 'world']) {
      node.setInputValue('chunk', token);
      pulse('add');
    }

    expect(out('accumulated')).toBe('Hello, world');
    expect(out('messages')).toEqual([]);
    expect(out('characterCount')).toBe(12);
    // Changed fires per chunk so a Text node can repaint; Message Received does not.
    expect(signals.filter((s) => s === 'changed').length).toBe(3);
    expect(signals).not.toContain('messageReceived');
  });

  it('splits complete messages off the delimiter and holds the partial tail', () => {
    const { node, out, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('chunk', 'one\ntwo\nthr');
    pulse('add');

    expect(out('messages')).toEqual(['one', 'two']);
    expect(out('lastMessage')).toBe('two');
    expect(out('messageCount')).toBe(2);
    expect(out('accumulated')).toBe('thr');
    expect(signals).toContain('messageReceived');

    node.setInputValue('chunk', 'ee\n');
    pulse('add');
    expect(out('messages')).toEqual(['one', 'two', 'three']);
    expect(out('accumulated')).toBe('');
  });

  it('reassembles a message split across chunk boundaries', () => {
    const { node, out, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    for (const piece of ['a', 'b', '\n', 'c']) {
      node.setInputValue('chunk', piece);
      pulse('add');
    }
    expect(out('messages')).toEqual(['ab']);
    expect(out('accumulated')).toBe('c');
  });

  it('ignores an empty chunk, so keep-alives do not fire Changed', () => {
    const { node, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('chunk', '');
    pulse('add');
    expect(signals).toEqual([]);
  });

  it('caps the buffer and reports what it dropped rather than dropping silently', () => {
    const { node, out, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('delimiter', '');
    node.setInputValue('maxLength', 5);
    node.setInputValue('chunk', 'abcdefgh');
    pulse('add');

    expect(out('accumulated')).toBe('defgh');
    expect(out('droppedCharacters')).toBe(3);
    expect(signals).toContain('overflowed');
  });

  it('caps retained messages, oldest first', () => {
    const { node, out, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('maxMessages', 2);
    node.setInputValue('chunk', 'a\nb\nc\nd\n');
    pulse('add');

    expect(out('messages')).toEqual(['c', 'd']);
    expect(out('droppedMessages')).toBe(2);
  });

  it('counts UTF-8 bytes separately from characters', () => {
    const { node, out, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('delimiter', '');
    node.setInputValue('chunk', 'a😀');
    pulse('add');
    expect(out('characterCount')).toBe(3); // one surrogate pair
    expect(out('byteCount')).toBe(5);
  });

  it('clears everything and says so', () => {
    const { node, out, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('chunk', 'a\nb\n');
    pulse('add');
    pulse('clear');

    expect(out('accumulated')).toBe('');
    expect(out('messages')).toEqual([]);
    expect(out('messageCount')).toBe(0);
    expect(signals).toContain('cleared');
  });

  // -- a chunk that is not text ---------------------------------------------
  //
  // The integration pass found `SSE.data -> chunk` — the wiring the enrichment, the
  // catalog example and the example project all recommended — rendering `[object Object]`
  // for an OpenAI-style stream, because `data` is JSON-parsed and this setter used to
  // `String()` whatever it was given.

  it('refuses an object chunk and names the mistake instead of appending [object Object]', () => {
    const { node, out, signals, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('delimiter', '');
    node.setInputValue('chunk', 'Hi');
    pulse('add');

    node.setInputValue('chunk', { delta: ' there' });
    pulse('add');

    expect(out('accumulated')).toBe('Hi');
    expect(out('accumulated')).not.toContain('[object Object]');
    expect(out('error')).toContain('Chunk must be text');
    // Names the port that should have been wired, since that is the whole fix.
    expect(out('error')).toContain('Text output');
    // Nothing was appended, so nothing repainted: exactly one Changed, from 'Hi'.
    expect(signals.filter((s) => s === 'changed').length).toBe(1);
  });

  it('refuses an array chunk too, and says which shape arrived', () => {
    const { node, out } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('chunk', ['a', 'b']);
    expect(out('error')).toContain('an array');
  });

  it('accepts numbers and booleans, which read as text', () => {
    const { node, out, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('delimiter', '');
    node.setInputValue('chunk', 42);
    pulse('add');
    node.setInputValue('chunk', true);
    pulse('add');

    expect(out('accumulated')).toBe('42true');
    expect(out('error')).toBe('');
  });

  it('clears the error on the next good chunk, and on Clear', () => {
    const { node, out, pulse } = createNode(accumulatorModule, 'net.noodl.TextAccumulator');
    node.setInputValue('chunk', { delta: 'x' });
    expect(out('error')).not.toBe('');

    node.setInputValue('chunk', 'ok');
    expect(out('error')).toBe('');

    node.setInputValue('chunk', { delta: 'x' });
    expect(out('error')).not.toBe('');
    pulse('clear');
    expect(out('error')).toBe('');
  });

  it('puts the mis-wiring on the canvas as a warning, not only on the output', () => {
    const context = new NodeContext();
    const warnings: { key: string; message: string }[] = [];
    (context as any).editorConnection = {
      // NodeContext asks this before it reports a sent value to the editor.
      isConnected: () => false,
      sendWarning: (_component: string, _id: string, key: string, warning: { message: string }) =>
        warnings.push({ key, message: warning.message }),
      clearWarning: (_component: string, _id: string, key: string) => {
        const index = warnings.findIndex((w) => w.key === key);
        if (index !== -1) warnings.splice(index, 1);
      }
    };
    context.nodeRegister.register(NodeDefinition.defineNode(accumulatorModule.node));
    const node = context.nodeRegister.createNode(
      'net.noodl.TextAccumulator',
      'accumulator-warning'
    ) as unknown as NodeInstance;
    (node as any).nodeScope = { componentOwner: { name: '/Chat' } };

    node.setInputValue('chunk', { delta: 'x' });
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain('Chunk must be text');

    node.setInputValue('chunk', 'fine now');
    expect(warnings.length).toBe(0);
  });
});

describe('net.noodl.JSONStreamParser', () => {
  it('declares the documented ports', () => {
    const { metadata } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    expect(Object.keys(metadata.inputs).sort()).toEqual(['chunk', 'clear', 'format', 'maxLength', 'parse'].sort());
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'cleared',
        'error',
        'errorCount',
        'failure',
        'isComplete',
        'parsed',
        'pendingCharacters',
        'success',
        'valueCount',
        'values'
      ].sort()
    );
  });

  it('parses NDJSON line by line and holds a partial line', () => {
    const { node, out, signals, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('chunk', '{"a":1}\n{"b":2}\n{"c":');
    pulse('parse');

    expect(out('values')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(out('parsed')).toEqual({ b: 2 });
    expect(out('valueCount')).toBe(2);
    expect(out('pendingCharacters')).toBe('{"c":'.length);
    expect(out('isComplete')).toBe(false);
    expect(signals).toContain('success');

    node.setInputValue('chunk', '3}\n');
    pulse('parse');
    expect(out('values')).toEqual([{ c: 3 }]);
    expect(out('valueCount')).toBe(3);
    expect(out('isComplete')).toBe(true);
  });

  it('reports a malformed NDJSON line without stopping the stream', () => {
    const { node, out, signals, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('chunk', '{"a":1}\nnot json\n{"b":2}\n');
    pulse('parse');

    expect(out('values')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(out('errorCount')).toBe(1);
    expect(out('error')).toMatch(/did not parse/);
    expect(signals).toContain('failure');
    expect(signals).toContain('success');
  });

  it('emits array elements as they arrive in stream format', () => {
    const { node, out, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('format', 'stream');
    node.setInputValue('chunk', '[{"i":1},{"i":2}');
    pulse('parse');
    expect(out('values')).toEqual([{ i: 1 }, { i: 2 }]);

    node.setInputValue('chunk', ',{"i":3}]');
    pulse('parse');
    expect(out('values')).toEqual([{ i: 3 }]);
    expect(out('valueCount')).toBe(3);
  });

  it('waits for the whole document in single format', () => {
    const { node, out, signals, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('format', 'single');

    node.setInputValue('chunk', '{"a":[1,2');
    pulse('parse');
    expect(out('values')).toEqual([]);
    expect(out('isComplete')).toBe(false);
    expect(signals).not.toContain('success');

    node.setInputValue('chunk', ',3]}');
    pulse('parse');
    expect(out('parsed')).toEqual({ a: [1, 2, 3] });
    expect(out('isComplete')).toBe(true);
    expect(signals).toContain('success');
  });

  it('gives up loudly on a runaway buffer rather than growing without bound', () => {
    const { node, out, signals, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('format', 'single');
    node.setInputValue('maxLength', 10);
    node.setInputValue('chunk', '{"a":"12345678901234567890"');
    pulse('parse');

    expect(out('error')).toMatch(/Gave up/);
    expect(out('pendingCharacters')).toBe(0);
    expect(signals).toContain('failure');
  });

  it('clears its buffer and counters', () => {
    const { node, out, signals, pulse } = createNode(jsonParserModule, 'net.noodl.JSONStreamParser');
    node.setInputValue('chunk', '{"a":1}\n{"b":');
    pulse('parse');
    pulse('clear');

    expect(out('valueCount')).toBe(0);
    expect(out('pendingCharacters')).toBe(0);
    expect(signals).toContain('cleared');
  });
});

describe('net.noodl.PatternExtractor', () => {
  it('declares the documented ports', () => {
    const { metadata } = createNode(patternModule, 'net.noodl.PatternExtractor');
    expect(Object.keys(metadata.inputs).sort()).toEqual(
      ['extract', 'extractAll', 'flags', 'pattern', 'text'].sort()
    );
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'error',
        'failure',
        'firstGroup',
        'found',
        'groups',
        'match',
        'matchCount',
        'matches',
        'namedGroups',
        'notFound'
      ].sort()
    );
  });

  it('extracts a progress percentage — the canonical stream case', () => {
    const { node, out, signals, pulse } = createNode(patternModule, 'net.noodl.PatternExtractor');
    node.setInputValue('text', 'Processing... 45% complete');
    node.setInputValue('pattern', '(\\d+)%');
    pulse('extract');

    expect(out('match')).toBe('45%');
    expect(out('firstGroup')).toBe('45');
    expect(signals).toEqual(['found']);
  });

  it('collects every match when asked', () => {
    const { node, out, pulse } = createNode(patternModule, 'net.noodl.PatternExtractor');
    node.setInputValue('text', 'a1 b2 c3');
    node.setInputValue('pattern', '[a-z]\\d');
    node.setInputValue('extractAll', true);
    pulse('extract');

    expect(out('matches')).toEqual(['a1', 'b2', 'c3']);
    expect(out('matchCount')).toBe(3);
  });

  it('exposes named groups', () => {
    const { node, out, pulse } = createNode(patternModule, 'net.noodl.PatternExtractor');
    node.setInputValue('text', 'tool=search');
    node.setInputValue('pattern', 'tool=(?<tool>\\w+)');
    pulse('extract');
    expect(out('namedGroups')).toEqual({ tool: 'search' });
  });

  it('separates "no match" from "bad pattern"', () => {
    const noMatch = createNode(patternModule, 'net.noodl.PatternExtractor');
    noMatch.node.setInputValue('text', 'nothing');
    noMatch.node.setInputValue('pattern', '\\d+');
    noMatch.pulse('extract');
    expect(noMatch.signals).toEqual(['notFound']);
    expect(noMatch.out('error')).toBe('');

    const badPattern = createNode(patternModule, 'net.noodl.PatternExtractor');
    badPattern.node.setInputValue('text', 'anything');
    badPattern.node.setInputValue('pattern', '([unclosed');
    badPattern.pulse('extract');
    expect(badPattern.signals).toEqual(['failure']);
    expect(badPattern.out('error')).not.toBe('');
  });

  it('applies flags', () => {
    const { node, out, pulse } = createNode(patternModule, 'net.noodl.PatternExtractor');
    node.setInputValue('text', 'ABC');
    node.setInputValue('pattern', 'abc');
    node.setInputValue('flags', 'i');
    pulse('extract');
    expect(out('match')).toBe('ABC');
  });
});

describe('net.noodl.StreamBuffer', () => {
  function createBuffer(seams: Record<string, unknown> = {}) {
    const created = createNode(bufferModule, 'net.noodl.StreamBuffer');
    (created.node._internal as any).seams = seams;
    return created;
  }

  it('declares the documented ports', () => {
    const { metadata } = createNode(bufferModule, 'net.noodl.StreamBuffer');
    expect(Object.keys(metadata.inputs).sort()).toEqual(
      ['add', 'clear', 'data', 'flush', 'flushInterval', 'flushSize', 'maxSize'].sort()
    );
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      ['buffer', 'bufferSize', 'cleared', 'droppedItems', 'flushCount', 'flushed', 'flushedData', 'overflowed'].sort()
    );
  });

  it('buffers items and flushes on demand', () => {
    const { node, out, signals, pulse } = createBuffer();
    for (const item of [1, 2, 3]) {
      node.setInputValue('data', item);
      pulse('add');
    }
    expect(out('bufferSize')).toBe(3);

    pulse('flush');
    expect(out('flushedData')).toEqual([1, 2, 3]);
    expect(out('bufferSize')).toBe(0);
    expect(out('flushCount')).toBe(1);
    expect(signals).toContain('flushed');
  });

  it('flushes automatically once Flush Size is reached', () => {
    const { node, out, pulse } = createBuffer();
    node.setInputValue('flushSize', 2);

    node.setInputValue('data', 'a');
    pulse('add');
    expect(out('bufferSize')).toBe(1);

    node.setInputValue('data', 'b');
    pulse('add');
    expect(out('flushedData')).toEqual(['a', 'b']);
    expect(out('bufferSize')).toBe(0);
  });

  it('flushes on an interval, and arms the timer only while items are waiting', () => {
    const timers = makeTimers();
    const { node, out, pulse } = createBuffer(timers);
    node.setInputValue('flushInterval', 250);

    expect(timers.pending()).toBe(0); // nothing buffered, nothing scheduled

    node.setInputValue('data', 'x');
    pulse('add');
    expect(timers.delays()).toEqual([250]);

    // A second Add reuses the running timer rather than stacking another.
    node.setInputValue('data', 'y');
    pulse('add');
    expect(timers.pending()).toBe(1);

    timers.run();
    expect(out('flushedData')).toEqual(['x', 'y']);
    expect(timers.pending()).toBe(0);
  });

  it('does not leave a stale timer when the interval changes', () => {
    const timers = makeTimers();
    const { node, pulse } = createBuffer(timers);
    node.setInputValue('flushInterval', 1000);
    node.setInputValue('data', 'x');
    pulse('add');
    expect(timers.delays()).toEqual([1000]);

    node.setInputValue('flushInterval', 100);
    expect(timers.delays()).toEqual([100]);
  });

  it('cancels the timer on a manual flush', () => {
    const timers = makeTimers();
    const { node, pulse } = createBuffer(timers);
    node.setInputValue('flushInterval', 500);
    node.setInputValue('data', 'x');
    pulse('add');
    expect(timers.pending()).toBe(1);

    pulse('flush');
    expect(timers.pending()).toBe(0);
  });

  it('does not flush an empty buffer', () => {
    const { signals, out, pulse } = createBuffer();
    pulse('flush');
    expect(signals).toEqual([]);
    expect(out('flushCount')).toBe(0);
  });

  it('hands out a detached array, so a later Add cannot mutate it', () => {
    const { node, out, pulse } = createBuffer();
    node.setInputValue('data', 1);
    pulse('add');
    pulse('flush');
    const flushed = out('flushedData');

    node.setInputValue('data', 2);
    pulse('add');
    expect(flushed).toEqual([1]);
  });

  it('caps the buffer and reports what it dropped', () => {
    const { node, out, signals, pulse } = createBuffer();
    node.setInputValue('maxSize', 2);
    for (const item of [1, 2, 3, 4]) {
      node.setInputValue('data', item);
      pulse('add');
    }
    expect(out('buffer')).toEqual([3, 4]);
    expect(out('droppedItems')).toBe(2);
    expect(signals).toContain('overflowed');
  });

  it('clears the timer and the buffer when the node is deleted', () => {
    const timers = makeTimers();
    const { node, out, pulse } = createBuffer(timers);
    node.setInputValue('flushInterval', 1000);
    node.setInputValue('data', 'x');
    pulse('add');
    expect(timers.pending()).toBe(1);

    (node as any)._onNodeDeleted();

    expect(timers.pending()).toBe(0);
    expect(out('bufferSize')).toBe(0);
  });

  it('runs the base Node teardown as well as its own', () => {
    const { node } = createBuffer();
    let baseRan = false;
    node.addDeleteListener(function () {
      baseRan = true;
    });
    (node as any)._onNodeDeleted();
    expect(baseRan).toBe(true);
  });

  it('is only partially SSR-capable, because an interval never fires on the server', () => {
    expect(bufferModule.node.ssr.compat).toBe('partial');
  });
});
