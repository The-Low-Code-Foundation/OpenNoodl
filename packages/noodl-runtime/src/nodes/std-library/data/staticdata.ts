'use strict';

import Collection = require('../../../collection');
import type {
  CollectionLike,
  InspectInfo,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import { parseCSVRows, rowsToRecords } from '../../../csv';

/**
 * ⚠️ CWF-012 slice 1 — the tokeniser that used to live here now lives in `src/csv.ts`.
 *
 * It was a real CSV parser (quoted cells, embedded delimiters and newlines, doubled quotes) that
 * only ever ran at authoring time, because a Static Array's CSV is typed into the editor. CWF-012
 * needed the same parser at *runtime*, and copying it would have produced two behaviours on the
 * same file — with the fixed one always being the copy you are not using. So `Parse CSV`,
 * `To CSV` and this node now share one module, and this node's behaviour is unchanged: every cell
 * is still a string, a trailing newline still yields a trailing row, and the tolerant entry point
 * (`parseCSVRows`) is deliberately the one used here — an authored CSV that stops short is the
 * author looking at their own text, not a runtime failure to announce.
 */

/** `this` inside the Static Array node. */
interface StaticDataInstance extends NodeInstance {
  _internal: {
    type?: 'csv' | 'json';
    csv?: string;
    json?: string;
    /** Rebuilt from scratch on every *successful* parse — the id is not stable across edits. */
    collection?: CollectionLike;
    hasScheduledParseData?: boolean;
    /** Why the last parse failed; the `Error` output reads this. */
    lastError?: string;
    /** Last message actually raised, so a repeat is not re-announced. Array Filter's shape. */
    lastReportedError?: string;
  };
  scheduleParseData(): void;
  parseData(): void;
  reportFailure(code: string, message: string): void;
}

/** NDA-012 (Data) — also the editor's warning key; the bus files a warning under its `code`. */
const JSON_PARSE_ERROR_CODE = 'static-array/json-parse-failed';

const CSVNode: NodeDefinitionOptions = {
  name: 'Static Data',
  docs: 'https://docs.noodl.net/nodes/data/array/static-array',
  displayNodeName: 'Static Array',
  category: 'Data',
  color: 'data',
  nodeDoubleClickAction: [
    {
      focusPort: 'JSON'
    },
    {
      focusPort: 'CSV'
    }
  ],
  getInspectInfo(this: StaticDataInstance): InspectInfo | void {
    if (this._internal.collection) {
      return [
        {
          type: 'value',
          value: this._internal.collection.items
        }
      ];
    }
  },
  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'type = csv OR type NOT SET',
      inputs: ['csv']
    },
    {
      name: 'conditionalports/extended',
      condition: 'type = json',
      inputs: ['json']
    }
  ],
  inputs: {
    type: {
      type: {
        name: 'enum',
        enums: [
          { label: 'CSV', value: 'csv' },
          { label: 'JSON', value: 'json' }
        ],
        allowEditOnly: true
      },
      displayName: 'Type',
      description: 'Which of the two authoring formats below is read',
      group: 'General',
      default: 'csv',
      set: function (this: StaticDataInstance, value: 'csv' | 'json') {
        this._internal.type = value;
      }
    },
    csv: {
      type: { name: 'string', codeeditor: 'text', allowEditOnly: true },
      displayName: 'CSV',
      description:
        'Rows of comma-separated values whose first row names the properties; every cell is read ' +
        'as a string, so use JSON if numbers must stay numbers — ignored unless Type is CSV',
      group: 'General',
      set: function (this: StaticDataInstance, value: string) {
        this._internal.csv = value;
        this.scheduleParseData();
      }
    },
    json: {
      type: { name: 'string', codeeditor: 'json', allowEditOnly: true },
      displayName: 'JSON',
      description:
        'An array of objects authored inline; unlike CSV it keeps numbers and booleans as they ' +
        'are — ignored unless Type is JSON',
      group: 'General',
      set: function (this: StaticDataInstance, value: string) {
        this._internal.json = value;
        this.scheduleParseData();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description: 'The authored rows, as an array of records; unchanged while the JSON cannot be parsed',
      group: 'General',
      getter: function (this: StaticDataInstance) {
        return this._internal.collection;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      description: 'How many rows the last successful parse produced',
      group: 'General',
      get(this: StaticDataInstance) {
        return this._internal.collection ? this._internal.collection.size() : 0;
      }
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the authored JSON could not be parsed, leaving Items as it was',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the JSON could not be parsed, in one sentence; empty until a parse fails',
      group: 'Events',
      getter: function (this: StaticDataInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    /**
     * NDA-012 (Data) — the parse error existed and went only to the editor.
     *
     * `sendWarning` behind `if (this.context.editorConnection)` is the shape the Failure Contract
     * opens by naming: perfect diagnosis on the canvas, total silence in a deployed app, a cloud
     * function, SSR and an export. Measured: with malformed JSON the runtime error channel was
     * empty and the node had no `Failure` output at all.
     *
     * Ungated, for Array Filter's `filter-failed` reason: JSON that will not parse is wrong
     * whenever it arrives, and it is never a state the graph passes through on its way to working.
     * The editor still shows it — through the bus adapter, which files the warning under `code`.
     */
    reportFailure: function (this: StaticDataInstance, code: string, message: string) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      if (internal.lastReportedError === message) return;
      internal.lastReportedError = message;

      this.raiseRuntimeError(code, message);
      this.sendSignalOnOutput('failure');
    },
    scheduleParseData: function (this: StaticDataInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledParseData) {
        internal.hasScheduledParseData = true;
        this.scheduleAfterInputsHaveUpdated(this.parseData.bind(this));
      }
    },
    parseData: function (this: StaticDataInstance) {
      const internal = this._internal;

      internal.hasScheduledParseData = false;

      if (internal.type === undefined || internal.type === 'csv') {
        // Data is string, parse it as CSV
        const json = rowsToRecords(parseCSVRows(internal.csv));

        internal.collection = Collection.get();
        internal.collection.set(json);
        this.flagOutputDirty('items');
        this.flagOutputDirty('count');
      } else if (internal.type === 'json') {
        const editorConnection = this.context.editorConnection;
        if (editorConnection) {
          const componentName = this.nodeScope.componentOwner.name;
          editorConnection.clearWarning(componentName, this.id, JSON_PARSE_ERROR_CODE);
          // The legacy key, for an editor session that was already open when this landed.
          editorConnection.clearWarning(componentName, this.id, 'json-parse-warning');
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(internal.json);
        } catch (e) {
          /**
           * NDA-012 (Data). The collection used to be replaced with a fresh empty one *before*
           * the parse, so a failed parse left the node internally inconsistent: `Count` read 0
           * from the new empty collection while `Items` was never re-flagged and downstream still
           * held the previous one. Building it only on success is what makes the two agree, and
           * makes "unchanged while the JSON cannot be parsed" a sentence the `Items` description
           * can honestly carry.
           */
          this.reportFailure(JSON_PARSE_ERROR_CODE, 'The JSON could not be parsed: ' + (e as Error).message);
          return;
        }

        internal.lastReportedError = undefined;
        internal.collection = Collection.get();
        internal.collection.set(parsed as ArrayLike<Record<string, unknown>>);
        this.flagOutputDirty('items');
        this.flagOutputDirty('count');
      }
    }
  }
};

const CSVNodeModule: NodeModule = {
  node: CSVNode
};

export = CSVNodeModule;
