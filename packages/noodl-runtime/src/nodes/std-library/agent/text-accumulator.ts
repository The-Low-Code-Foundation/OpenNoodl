/**
 * Text Accumulator node (AGENT-007).
 *
 * Collects stream fragments into growing text, and — when a delimiter is set — into
 * complete messages. This is the node that turns an AI token stream into something a
 * Text node can display: wire `SSE.text -> chunk` and `SSE.onMessage -> add`, leave
 * the delimiter empty, and `accumulated` is the response as it is being written.
 *
 * `text` and not `data`: `data` is JSON-parsed when the payload is JSON, so for the
 * commonest agent shape it is an object, and an accumulator's job is text. A non-text
 * chunk is refused and reported on `error` rather than stringified — see the `chunk`
 * setter.
 *
 * The parsing itself is `splitDelimited` in stream-parsers.ts; this file is ports,
 * bounds and reporting.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

import type { AccumulatorInternal, TextAccumulatorNodeInstance } from './node-instances';
import { splitDelimited, truncateHead, utf8ByteLength } from './stream-parsers';

function internalOf(node: TextAccumulatorNodeInstance): AccumulatorInternal {
  return node._internal;
}

/** Warning key, so the canvas shows one warning per node rather than one per chunk. */
const CHUNK_WARNING = 'text-accumulator-chunk-not-text';

/** NDA-004 §2 — the matchable half of the failure pair. The bus keys by `code`. */
const CHUNK_ERROR_CODE = 'text-accumulator/chunk-not-text';

/**
 * Names what arrived, in the words of the port that should have been wired instead.
 *
 * The message has to be actionable: "expected text" tells an author nothing they did not
 * already know, whereas naming the mistake — a JSON-parsed `data` output wired into a text
 * input — is the whole content of the fix.
 */
function describeBadChunk(value: unknown): string {
  const shape = Array.isArray(value)
    ? 'an array'
    : value instanceof Date
    ? 'a Date'
    : typeof value === 'object'
    ? 'an object'
    : `a ${typeof value}`;
  return (
    `Chunk must be text, but ${shape} arrived, so nothing was appended. ` +
    "A stream's Data output is JSON-parsed and is an object for a payload like " +
    '{"delta":"Hi"} — wire the stream\'s Text output instead (set its Text Path for a JSON ' +
    'payload), or a Function node that picks the string field out of Data.'
  );
}

const TextAccumulatorNode: NodeDefinitionOptions = {
  name: 'net.noodl.TextAccumulator',
  displayNodeName: 'Text Accumulator',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/text-accumulator',
  searchTags: ['stream', 'accumulate', 'buffer', 'chunk', 'tokens', 'concat', 'agent', 'ai', 'streaming'],

  initialize(this: TextAccumulatorNodeInstance) {
    const internal = internalOf(this);
    internal.pendingChunk = '';
    internal.buffer = '';
    internal.messages = [];
    internal.lastMessage = '';
    internal.delimiter = '\n';
    internal.maxLength = 1024 * 1024;
    internal.maxMessages = 1000;
    internal.droppedCharacters = 0;
    internal.droppedMessages = 0;
    internal.error = '';
  },

  getInspectInfo(this: TextAccumulatorNodeInstance) {
    const internal = internalOf(this);
    if (internal.error) return { type: 'text', value: internal.error };
    return {
      type: 'value',
      value: {
        characters: internal.buffer.length,
        messages: internal.messages.length,
        lastMessage: internal.lastMessage,
        droppedCharacters: internal.droppedCharacters,
        droppedMessages: internal.droppedMessages
      }
    };
  },

  inputs: {
    chunk: {
      type: 'string',
      displayName: 'Chunk',
      description:
        'The next fragment of text to append; wire a stream Text output, not its Data output, which is JSON-parsed and is usually an object',
      group: 'Data',
      set(this: TextAccumulatorNodeInstance, value: unknown) {
        // Text and the primitives that read as text are accepted; anything else is
        // refused and named.
        //
        // This used to be `String(value)` for everything, on the reasoning that silently
        // dropping a chunk would look broken. It does look broken — but so does
        // `[object Object]`, and that is what the wiring the docs recommended actually
        // produced for an OpenAI-style stream, all the way through a live run without
        // anybody noticing. An accumulator handed an object has been mis-wired, and the
        // whole premise of these nodes is that a failure is visible rather than plausible.
        const internal = internalOf(this);
        const kind = typeof value;

        if (value === undefined || value === null) {
          internal.pendingChunk = '';
        } else if (kind === 'string') {
          internal.pendingChunk = value as string;
        } else if (kind === 'number' || kind === 'boolean' || kind === 'bigint') {
          // A number is text in every sense an author cares about, and a counter wired to
          // a log accumulator is a reasonable thing to build.
          internal.pendingChunk = String(value);
        } else {
          internal.pendingChunk = '';
          this.reportChunkError(describeBadChunk(value));
          return;
        }

        this.clearChunkError();
      }
    },

    delimiter: {
      type: 'string',
      default: '\n',
      displayName: 'Delimiter',
      description:
        'Message boundary to split complete messages off; leave empty to accumulate everything, which is what a token stream wants',
      group: 'Config',
      tooltip:
        'Message boundary. Leave empty to accumulate everything without splitting — the mode a token stream wants.',
      set(this: TextAccumulatorNodeInstance, value: string) {
        internalOf(this).delimiter = value === undefined || value === null ? '' : String(value);
      }
    },

    maxLength: {
      type: 'number',
      default: 1024 * 1024,
      displayName: 'Max Length (characters)',
      description:
        'Cap on the pending buffer in characters; overflow drops the oldest and is counted on Dropped Characters',
      group: 'Config',
      tooltip: 'Cap on the pending buffer. Overflow drops the oldest characters and is reported on Dropped Characters.',
      set(this: TextAccumulatorNodeInstance, value: number) {
        internalOf(this).maxLength = Number(value) > 0 ? Number(value) : 0;
      }
    },

    maxMessages: {
      type: 'number',
      default: 1000,
      displayName: 'Max Messages',
      description: 'Cap on retained complete messages, oldest dropped first; 0 keeps them all, which grows forever',
      group: 'Config',
      tooltip:
        'Cap on retained complete messages; the oldest are dropped first. 0 keeps them all, which grows forever.',
      set(this: TextAccumulatorNodeInstance, value: number) {
        internalOf(this).maxMessages = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    add: {
      displayName: 'Add',
      description:
        'Appends the current Chunk, which is retained between pulses, so a second Add with no new chunk appends it again',
      group: 'Actions',
      valueChangedToTrue(this: TextAccumulatorNodeInstance) {
        // ERG-001 §4. Only the ports mint; the `chunk` setter merely stores, and
        // `reportChunkError` fires from it, which is why `failure` stays a two-job port below.
        this.addChunk(this.beginOutcome());
      }
    },

    clear: {
      displayName: 'Clear',
      description: 'Empties the buffer, the messages and both dropped counts',
      group: 'Actions',
      valueChangedToTrue(this: TextAccumulatorNodeInstance) {
        this.clearBuffer(this.beginOutcome());
      }
    }
  },

  outputs: {
    accumulated: {
      type: 'string',
      displayName: 'Accumulated',
      description: 'Everything appended since the last Clear that has not yet been split off as a complete message',
      group: 'Data',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).buffer;
      }
    },
    messages: {
      type: 'array',
      displayName: 'Messages',
      description: 'Complete messages split off the delimiter, oldest first, capped at Max Messages',
      group: 'Data',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).messages;
      }
    },
    lastMessage: {
      type: 'string',
      displayName: 'Last Message',
      description: 'The most recent complete message, which is what a chat surface usually wants',
      group: 'Data',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).lastMessage;
      }
    },
    messageCount: {
      type: 'number',
      displayName: 'Message Count',
      description: 'How many complete messages are being retained, which is not how many have arrived',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).messages.length;
      }
    },
    characterCount: {
      type: 'number',
      displayName: 'Character Count',
      description: 'Length of Accumulated in characters',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    byteCount: {
      type: 'number',
      displayName: 'Byte Count (UTF-8)',
      description:
        'Length of Accumulated in UTF-8 bytes, which differs from Character Count for anything outside ASCII',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return utf8ByteLength(internalOf(this).buffer);
      }
    },
    droppedCharacters: {
      type: 'number',
      displayName: 'Dropped Characters',
      description: 'How many characters Max Length has discarded from the front since the last Clear',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).droppedCharacters;
      }
    },
    droppedMessages: {
      type: 'number',
      displayName: 'Dropped Messages',
      description: 'How many complete messages Max Messages has discarded since the last Clear',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).droppedMessages;
      }
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last chunk was refused; blank once a chunk of text arrives',
      group: 'Status',
      get(this: TextAccumulatorNodeInstance) {
        return internalOf(this).error;
      }
    },

    messageReceived: {
      type: 'signal',
      displayName: 'Message Received',
      description: 'Fires once per Add that completed at least one message, not once per message',
      group: 'Events'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      description: 'Fires whenever an Add appended something, which is the cue to redraw',
      group: 'Events'
    },
    cleared: {
      type: 'signal',
      displayName: 'Cleared',
      description: 'Fires once the buffer and the messages have been emptied',
      group: 'Events'
    },
    overflowed: {
      type: 'signal',
      displayName: 'Overflowed',
      description: 'Fires when Max Length or Max Messages has just discarded something',
      group: 'Events'
    },
    /**
     * NDA-012 / NDA-004 §2. A mis-wired `Chunk` used to reach an editor warning and the
     * `error` string, and nothing else — so `Add` after one returned silently (the refused
     * chunk is blanked, and a blank chunk is a deliberate no-op) and the graph had no branch
     * to take. Five siblings in this directory already carry `Failure`; this one did not.
     */
    /**
     * ERG-001 §4. `Message Received`, `Changed`, `Cleared` and `Overflowed` all stay: each is a
     * value-level announcement about a specific piece of state — `Overflowed` fires from inside
     * an `Add` that otherwise succeeded — and none is this invocation's outcome.
     *
     * ⚠️ `failure` is one port doing two jobs. It fires from `reportChunkError`, which is
     * reached from the **`chunk` input setter** — a mis-wired stream announces itself the moment
     * the value arrives, before any `Add`. So a port-driven run must not pulse it twice: where
     * there is a token `reportOutcome` owns the pulse, where there is none the setter's
     * announcement stands.
     *
     * `Unchanged` is earned twice: an `Add` whose chunk is empty (the source already called that
     * "a no-op, not an error" — a stream's keep-alive frames are empty), and a `Clear` with
     * nothing to clear. Neither raises.
     */
    ...outcomeOutputs({
      done: 'Fires once an Add or Clear you triggered has changed the buffer',
      unchanged: 'Fires when an Add had no text to append — an empty chunk, or one already refused — or a Clear found nothing to discard',
      failure:
        'Fires when a chunk was not text and nothing was appended, which usually means the wrong stream output is wired'
    })
  },

  methods: {
    /**
     * Puts a mis-wiring on `error` *and* on the canvas.
     *
     * Both, deliberately: `error` is the graph-visible channel this family promises, but an
     * author who has just wired the wrong port has not wired anything to `error` either, so
     * an editor warning is the only thing that reaches them unprompted.
     */
    reportChunkError(this: TextAccumulatorNodeInstance, message: string, token?: OutcomeToken) {
      const internal = internalOf(this);
      const isRepeat = internal.error === message;
      if (!isRepeat) {
        internal.error = message;
        this.flagOutputDirty('error');
      }

      // ⚠️ ERG-001 §4. The token settles **outside** the message dedup above: the dedup is about
      // the announcement — one mis-wired stream would otherwise report per chunk — while Rule 1
      // is per invocation. `failure` is not pulsed twice; see the port's own note.
      if (token) {
        this.reportOutcome(token, 'failure', { code: CHUNK_ERROR_CODE, message, raise: isRepeat ? false : undefined });
      }
      if (isRepeat) return;

      // The graph-visible half, which is what a deployed build has. `raiseRuntimeError` is
      // what reaches `On App Error`; the editor warning below is the *second* channel now
      // rather than the only one.
      if (!token) {
        this.sendSignalOnOutput('failure');
        this.raiseRuntimeError(CHUNK_ERROR_CODE, message);
      }

      const editorConnection = this.context && this.context.editorConnection;
      if (editorConnection && this.nodeScope && this.nodeScope.componentOwner) {
        editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, CHUNK_WARNING, {
          showGlobally: true,
          message
        });
      }
    },

    clearChunkError(this: TextAccumulatorNodeInstance) {
      const internal = internalOf(this);
      if (!internal.error) return;
      internal.error = '';
      this.flagOutputDirty('error');

      const editorConnection = this.context && this.context.editorConnection;
      if (editorConnection && this.nodeScope && this.nodeScope.componentOwner) {
        editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, CHUNK_WARNING);
      }
    },

    addChunk(this: TextAccumulatorNodeInstance, token?: OutcomeToken) {
      const internal = internalOf(this);
      const chunk = internal.pendingChunk;
      if (chunk === '') {
        // An empty chunk is a no-op, not an error: a stream's keep-alive frames are empty and
        // should not fire Changed on every heartbeat. ERG-001 §4 gave the no-op a name rather
        // than leaving it as the bare `return` it was — this is also the path an `Add` takes
        // after a chunk was refused, because the refused chunk is blanked.
        if (token) this.reportOutcome(token, 'unchanged');
        return;
      }

      internal.buffer += chunk;

      const capped = truncateHead(internal.buffer, internal.maxLength);
      internal.buffer = capped.text;
      if (capped.dropped > 0) {
        internal.droppedCharacters += capped.dropped;
        this.flagOutputDirty('droppedCharacters');
        this.sendSignalOnOutput('overflowed');
      }

      const split = splitDelimited(internal.buffer, internal.delimiter);
      internal.buffer = split.rest;

      if (split.messages.length > 0) {
        internal.messages = internal.messages.concat(split.messages);
        internal.lastMessage = split.messages[split.messages.length - 1];

        const max = internal.maxMessages;
        if (max > 0 && internal.messages.length > max) {
          const dropped = internal.messages.length - max;
          internal.messages = internal.messages.slice(dropped);
          internal.droppedMessages += dropped;
          this.flagOutputDirty('droppedMessages');
          this.sendSignalOnOutput('overflowed');
        }

        this.flagOutputDirty('messages');
        this.flagOutputDirty('lastMessage');
        this.flagOutputDirty('messageCount');
      }

      this.flagOutputDirty('accumulated');
      this.flagOutputDirty('characterCount');
      this.flagOutputDirty('byteCount');

      // Message Received fires once per Add that completed at least one message, not
      // once per message: a signal carries no payload, so N signals in a row would
      // leave a downstream node reading only the last value anyway.
      if (split.messages.length > 0) this.sendSignalOnOutput('messageReceived');
      this.sendSignalOnOutput('changed');

      // Last, after every value and every value-level announcement.
      if (token) this.reportOutcome(token, 'done');
    },

    clearBuffer(this: TextAccumulatorNodeInstance, token?: OutcomeToken) {
      const internal = internalOf(this);
      // Read before the reset, not after.
      const hadSomethingToClear =
        internal.buffer.length > 0 ||
        internal.messages.length > 0 ||
        internal.droppedCharacters > 0 ||
        internal.droppedMessages > 0 ||
        !!internal.error;
      internal.buffer = '';
      internal.messages = [];
      internal.lastMessage = '';
      internal.droppedCharacters = 0;
      internal.droppedMessages = 0;
      this.clearChunkError();

      this.flagOutputDirty('accumulated');
      this.flagOutputDirty('messages');
      this.flagOutputDirty('lastMessage');
      this.flagOutputDirty('messageCount');
      this.flagOutputDirty('characterCount');
      this.flagOutputDirty('byteCount');
      this.flagOutputDirty('droppedCharacters');
      this.flagOutputDirty('droppedMessages');
      this.sendSignalOnOutput('cleared');
      if (token) this.reportOutcome(token, hadSomethingToClear ? 'done' : 'unchanged');
    }
  }
};

export = {
  node: TextAccumulatorNode
};
