/**
 * Text Accumulator node (AGENT-007).
 *
 * Collects stream fragments into growing text, and — when a delimiter is set — into
 * complete messages. This is the node that turns an AI token stream into something a
 * Text node can display: wire `SSE.data -> chunk` and `SSE.onMessage -> add`, leave
 * the delimiter empty, and `accumulated` is the response as it is being written.
 *
 * The parsing itself is `splitDelimited` in stream-parsers.ts; this file is ports,
 * bounds and reporting.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import { splitDelimited, truncateHead, utf8ByteLength } from './stream-parsers';

interface AccumulatorInternal {
  pendingChunk: string;
  buffer: string;
  messages: string[];
  lastMessage: string;
  delimiter: string;
  maxLength: number;
  maxMessages: number;
  droppedCharacters: number;
  droppedMessages: number;
}

function internalOf(node: NodeInstance): AccumulatorInternal {
  return node._internal as unknown as AccumulatorInternal;
}

const TextAccumulatorNode: NodeDefinitionOptions = {
  name: 'net.noodl.TextAccumulator',
  displayNodeName: 'Text Accumulator',
  shortDesc: 'Accumulates stream fragments into text, and splits complete messages off a delimiter.',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/text-accumulator',
  searchTags: ['stream', 'accumulate', 'buffer', 'chunk', 'tokens', 'concat', 'agent', 'ai', 'streaming'],

  initialize(this: NodeInstance) {
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
  },

  getInspectInfo(this: NodeInstance) {
    const internal = internalOf(this);
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
      group: 'Data',
      set(this: NodeInstance, value: unknown) {
        // Anything stringifiable is accepted: a stream carrying JSON frames will feed
        // this from a `*` output, and silently dropping non-strings would look like
        // the accumulator was broken.
        internalOf(this).pendingChunk = value === undefined || value === null ? '' : String(value);
      }
    },

    delimiter: {
      type: 'string',
      default: '\n',
      displayName: 'Delimiter',
      group: 'Config',
      tooltip: 'Message boundary. Leave empty to accumulate everything without splitting — the mode a token stream wants.',
      set(this: NodeInstance, value: string) {
        internalOf(this).delimiter = value === undefined || value === null ? '' : String(value);
      }
    },

    maxLength: {
      type: 'number',
      default: 1024 * 1024,
      displayName: 'Max Length (characters)',
      group: 'Config',
      tooltip: 'Cap on the pending buffer. Overflow drops the oldest characters and is reported on Dropped Characters.',
      set(this: NodeInstance, value: number) {
        internalOf(this).maxLength = Number(value) > 0 ? Number(value) : 0;
      }
    },

    maxMessages: {
      type: 'number',
      default: 1000,
      displayName: 'Max Messages',
      group: 'Config',
      tooltip: 'Cap on retained complete messages; the oldest are dropped first. 0 keeps them all, which grows forever.',
      set(this: NodeInstance, value: number) {
        internalOf(this).maxMessages = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    add: {
      displayName: 'Add',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).addChunk();
      }
    },

    clear: {
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).clearBuffer();
      }
    }
  },

  outputs: {
    accumulated: {
      type: 'string',
      displayName: 'Accumulated',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).buffer;
      }
    },
    messages: {
      type: 'array',
      displayName: 'Messages',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).messages;
      }
    },
    lastMessage: {
      type: 'string',
      displayName: 'Last Message',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).lastMessage;
      }
    },
    messageCount: {
      type: 'number',
      displayName: 'Message Count',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).messages.length;
      }
    },
    characterCount: {
      type: 'number',
      displayName: 'Character Count',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    byteCount: {
      type: 'number',
      displayName: 'Byte Count (UTF-8)',
      group: 'Status',
      get(this: NodeInstance) {
        return utf8ByteLength(internalOf(this).buffer);
      }
    },
    droppedCharacters: {
      type: 'number',
      displayName: 'Dropped Characters',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).droppedCharacters;
      }
    },
    droppedMessages: {
      type: 'number',
      displayName: 'Dropped Messages',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).droppedMessages;
      }
    },

    messageReceived: { type: 'signal', displayName: 'Message Received', group: 'Events' },
    changed: { type: 'signal', displayName: 'Changed', group: 'Events' },
    cleared: { type: 'signal', displayName: 'Cleared', group: 'Events' },
    overflowed: { type: 'signal', displayName: 'Overflowed', group: 'Events' }
  },

  methods: {
    addChunk(this: NodeInstance) {
      const internal = internalOf(this);
      const chunk = internal.pendingChunk;
      if (chunk === '') {
        // An empty chunk is a no-op, not an error: a stream's keep-alive frames are
        // empty and should not fire Changed on every heartbeat.
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
    },

    clearBuffer(this: NodeInstance) {
      const internal = internalOf(this);
      internal.buffer = '';
      internal.messages = [];
      internal.lastMessage = '';
      internal.droppedCharacters = 0;
      internal.droppedMessages = 0;

      this.flagOutputDirty('accumulated');
      this.flagOutputDirty('messages');
      this.flagOutputDirty('lastMessage');
      this.flagOutputDirty('messageCount');
      this.flagOutputDirty('characterCount');
      this.flagOutputDirty('byteCount');
      this.flagOutputDirty('droppedCharacters');
      this.flagOutputDirty('droppedMessages');
      this.sendSignalOnOutput('cleared');
    }
  }
};

export = {
  node: TextAccumulatorNode
};
