/**
 * JSON Stream Parser node (AGENT-007).
 *
 * Turns a stream of text fragments into JSON values, in the three shapes an agent
 * backend actually emits:
 *
 * - **NDJSON** — one JSON value per line. Strict: a line that does not parse is
 *   reported rather than skipped silently.
 * - **Stream** — any concatenation of complete top-level values, including a JSON
 *   array arriving element by element. Chunk boundaries may fall anywhere, including
 *   inside a string.
 * - **Single** — buffer until the whole document is one complete value, then emit it.
 *
 * The scanning is `scanJsonValues` / `tryParseJson` in stream-parsers.ts, which is
 * where the correctness lives and where it is tested.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions } from '@noodl/types';

import type { JsonStreamFormat, JsonStreamParserNodeInstance, ParserInternal } from './node-instances';
import { scanJsonValues, splitDelimited, tryParseJson } from './stream-parsers';

function internalOf(node: JsonStreamParserNodeInstance): ParserInternal {
  return node._internal;
}

const JSONStreamParserNode: NodeDefinitionOptions = {
  name: 'net.noodl.JSONStreamParser',
  displayNodeName: 'JSON Stream Parser',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/json-stream-parser',
  searchTags: ['json', 'ndjson', 'stream', 'parse', 'chunk', 'agent', 'ai', 'streaming', 'jsonl'],

  initialize(this: JsonStreamParserNodeInstance) {
    const internal = internalOf(this);
    internal.pendingChunk = '';
    internal.buffer = '';
    internal.format = 'ndjson';
    internal.maxLength = 1024 * 1024;
    internal.parsed = undefined;
    internal.values = [];
    internal.totalValues = 0;
    internal.error = '';
    internal.errorCount = 0;
    internal.isComplete = false;
  },

  getInspectInfo(this: JsonStreamParserNodeInstance) {
    const internal = internalOf(this);
    return {
      type: 'value',
      value: {
        format: internal.format,
        pendingCharacters: internal.buffer.length,
        valuesThisParse: internal.values.length,
        totalValues: internal.totalValues,
        lastValue: internal.parsed,
        errors: internal.errorCount,
        lastError: internal.error
      }
    };
  },

  inputs: {
    chunk: {
      type: 'string',
      displayName: 'Chunk',
      description: 'The next fragment of the stream; boundaries may fall anywhere, including inside a string',
      group: 'Data',
      set(this: JsonStreamParserNodeInstance, value: unknown) {
        internalOf(this).pendingChunk = value === undefined || value === null ? '' : String(value);
      }
    },

    format: {
      type: {
        name: 'enum',
        enums: [
          { label: 'NDJSON (one per line)', value: 'ndjson' },
          { label: 'Stream (any complete values)', value: 'stream' },
          { label: 'Single document', value: 'single' }
        ]
      },
      default: 'ndjson',
      displayName: 'Format',
      description:
        'How values are framed on this stream: one per line, any concatenation of complete values, or one whole document',
      group: 'Config',
      set(this: JsonStreamParserNodeInstance, value: string) {
        internalOf(this).format = (value as JsonStreamFormat) || 'ndjson';
      }
    },

    maxLength: {
      type: 'number',
      default: 1024 * 1024,
      displayName: 'Max Pending (characters)',
      description:
        'Cap on unparsed text held while a value completes; exceeding it clears the buffer and reports an error rather than growing forever',
      group: 'Config',
      tooltip:
        'Cap on unparsed text held while waiting for a value to complete. Exceeding it clears the buffer and reports an error, rather than growing without limit on a malformed stream.',
      set(this: JsonStreamParserNodeInstance, value: number) {
        internalOf(this).maxLength = Number(value) > 0 ? Number(value) : 0;
      }
    },

    parse: {
      displayName: 'Parse',
      description:
        'Appends the current Chunk and emits every value that is now complete; the chunk is retained between pulses',
      group: 'Actions',
      valueChangedToTrue(this: JsonStreamParserNodeInstance) {
        this.doParse();
      }
    },

    clear: {
      displayName: 'Clear',
      description: 'Discards the pending text, the parsed values and the error counter',
      group: 'Actions',
      valueChangedToTrue(this: JsonStreamParserNodeInstance) {
        this.clearBuffer();
      }
    }
  },

  outputs: {
    parsed: {
      type: '*',
      displayName: 'Parsed',
      description: 'The last complete value the most recent Parse produced',
      group: 'Data',
      // The last complete value parsed. Several values in one chunk all appear on Values.
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).parsed;
      }
    },
    values: {
      type: 'array',
      displayName: 'Values',
      description: 'Every value completed by the most recent Parse, in order',
      group: 'Data',
      // Every value completed by the most recent Parse, in order.
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).values;
      }
    },
    valueCount: {
      type: 'number',
      displayName: 'Value Count',
      description: 'How many values have been parsed since the last Clear, across every Parse',
      group: 'Status',
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).totalValues;
      }
    },
    pendingCharacters: {
      type: 'number',
      displayName: 'Pending Characters',
      description:
        'Text held back because a value is not complete yet; persistently non-zero means Format does not match the stream',
      group: 'Status',
      // Text held back because a value is not complete yet. Persistently non-zero
      // means the selected format does not match the stream.
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    isComplete: {
      type: 'boolean',
      displayName: 'Is Complete',
      description: 'True when the last Parse left nothing pending, so every value so far was whole',
      group: 'Status',
      // True when the last Parse left nothing buffered: every value so far was whole.
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).isComplete;
      }
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last value or line would not parse; kept until the next failure or a Clear',
      group: 'Status',
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).error;
      }
    },
    errorCount: {
      type: 'number',
      displayName: 'Error Count',
      description: 'How many values have failed to parse since the last Clear',
      group: 'Status',
      get(this: JsonStreamParserNodeInstance) {
        return internalOf(this).errorCount;
      }
    },

    success: {
      type: 'signal',
      displayName: 'Success',
      description:
        'Fires when a Parse yielded at least one value, so a chunk that merely advanced an incomplete value stays quiet',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description:
        'Fires for each value or line that could not be parsed, and when the pending text exceeded Max Pending',
      group: 'Events'
    },
    cleared: {
      type: 'signal',
      displayName: 'Cleared',
      description: 'Fires once the pending text and the values have been discarded',
      group: 'Events'
    }
  },

  methods: {
    doParse(this: JsonStreamParserNodeInstance) {
      const internal = internalOf(this);
      const chunk = internal.pendingChunk;
      if (chunk !== '') internal.buffer += chunk;
      if (internal.buffer === '') return;

      if (internal.maxLength > 0 && internal.buffer.length > internal.maxLength) {
        // Dropping the buffer loudly beats accumulating a runaway one silently: at
        // this size the stream is not the format the author selected.
        internal.buffer = '';
        this.reportError(
          'Gave up on ' + internal.maxLength + '+ characters of unparsed text; check the Format setting'
        );
        return;
      }

      const values: unknown[] = [];
      const errors: string[] = [];

      if (internal.format === 'ndjson') {
        const split = splitDelimited(internal.buffer, '\n');
        internal.buffer = split.rest;
        for (const line of split.messages) {
          const trimmed = line.trim();
          if (trimmed === '') continue;
          const outcome = tryParseJson(trimmed);
          if (outcome.ok) values.push(outcome.value);
          else errors.push('Line did not parse as JSON: ' + outcome.error);
        }
      } else if (internal.format === 'single') {
        // One document: only emit once the whole buffer is a complete value.
        const scan = scanJsonValues(internal.buffer, { arrayFraming: false });
        if (scan.values.length > 0) {
          values.push(scan.values[0]);
          internal.buffer = scan.rest;
        }
        for (const e of scan.errors) errors.push(e);
      } else {
        const scan = scanJsonValues(internal.buffer, { arrayFraming: true });
        internal.buffer = scan.rest;
        for (const v of scan.values) values.push(v);
        for (const e of scan.errors) errors.push(e);
      }

      internal.isComplete = internal.buffer.length === 0;
      this.flagOutputDirty('isComplete');
      this.flagOutputDirty('pendingCharacters');

      if (values.length > 0) {
        internal.values = values;
        internal.parsed = values[values.length - 1];
        internal.totalValues += values.length;
        this.flagOutputDirty('parsed');
        this.flagOutputDirty('values');
        this.flagOutputDirty('valueCount');
      }

      for (const message of errors) this.reportError(message);

      // Success reports "this Parse yielded values", so a chunk that merely advanced
      // an incomplete value stays quiet rather than firing an empty success.
      if (values.length > 0) this.sendSignalOnOutput('success');
    },

    reportError(this: JsonStreamParserNodeInstance, message: string) {
      const internal = internalOf(this);
      internal.error = message;
      internal.errorCount++;
      this.flagOutputDirty('error');
      this.flagOutputDirty('errorCount');
      this.sendSignalOnOutput('failure');
    },

    clearBuffer(this: JsonStreamParserNodeInstance) {
      const internal = internalOf(this);
      internal.buffer = '';
      internal.values = [];
      internal.parsed = undefined;
      internal.error = '';
      internal.errorCount = 0;
      internal.totalValues = 0;
      internal.isComplete = false;

      this.flagOutputDirty('values');
      this.flagOutputDirty('valueCount');
      this.flagOutputDirty('pendingCharacters');
      this.flagOutputDirty('isComplete');
      this.flagOutputDirty('error');
      this.flagOutputDirty('errorCount');
      this.sendSignalOnOutput('cleared');
    }
  }
};

export = {
  node: JSONStreamParserNode
};
