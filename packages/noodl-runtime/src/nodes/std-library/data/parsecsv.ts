'use strict';

/**
 * Parse CSV (CWF-012 slice 2) — a CSV that arrived at runtime, as records.
 *
 * ## Shared runtime, both surfaces
 *
 * Registered in `@noodl/runtime`'s own list, so the browser gets it too. That is deliberate and
 * the task says so: a browser app importing a spreadsheet wants this exactly as much as a cloud
 * function receiving a supplier's file does. There is no cloud guard, because there is nothing
 * here a browser must not have.
 *
 * ## Every cell is a string
 *
 * Inherited from the tokeniser and stated on the `Items` port: a column that looks numeric yields
 * `"42"`. Changing that is a compatibility decision with `Static Array`, not a tidy-up — see the
 * module comment on `src/csv.ts`.
 *
 * ## A malformed CSV fails loudly
 *
 * The Failure Contract's whole point. The tokeniser cannot throw — an unterminated quote just
 * stops it, and everything after that byte disappears — so "half my file arrived" is the natural
 * failure mode and the one this node exists to convert into a line number. `Items` is left as it
 * was on a failure rather than being replaced with a truncated array, which is the shape
 * `Static Array` already established for a bad parse.
 *
 * ## ⚠️ A large CSV meets the body limit long before it meets this node
 *
 * `POST /functions/:name` reads its body through `readJSONBody`, capped at **10 MB**
 * (`nodegx-backend/src/server/http-util.ts` `MAX_JSON_BODY`). A bigger upload is a 413 from the
 * HTTP layer and never reaches the graph, so a file that big has to go through
 * `POST /files` (50 MB) and be read from storage instead.
 */

import Collection = require('../../../collection');
import type { CollectionLike, InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { parseCSV, rowsToRecords } from '../../../csv';

/** The editor's warning key as well as the runtime error code. */
const PARSE_ERROR_CODE = 'parse-csv/parse-failed';

interface ParseCSVNodeInstance extends NodeInstance {
  _internal: {
    text?: string;
    /** Whether anything has ever arrived on `CSV`. The abstain — see `_parse`. */
    textSupplied?: boolean;
    hasHeader: boolean;
    delimiter: string;
    /** Records (header mode) or rows of cells. Replaced only on a successful parse. */
    items?: CollectionLike | string[][];
    count: number;
    lastError?: string;
    scheduled?: boolean;
  };
  _schedule(): void;
  _parse(): void;
}

const ParseCSVNode: NodeDefinitionOptions = {
  name: 'net.noodl.ParseCSV',
  displayNodeName: 'Parse CSV',
  docs: 'https://docs.noodl.net/nodes/data/array/parse-csv',
  category: 'Data',
  color: 'data',
  /**
   * ⚠️ A declared `default` never runs its setter, so these three lines are the real defaults —
   * `delimiter: ','` on the port is what the property panel shows, not what the node holds. The
   * setters below also fall back rather than trusting the value, because a port cleared to an
   * empty string arrives as `''` and `'' || ','` is the only thing that keeps the node working.
   */
  initialize: function (this: ParseCSVNodeInstance) {
    this._internal.hasHeader = true;
    this._internal.delimiter = ',';
    this._internal.count = 0;
  },
  getInspectInfo(this: ParseCSVNodeInstance): InspectInfo | void {
    if (this._internal.lastError) return this._internal.lastError;
    if (this._internal.items) return [{ type: 'value', value: this._internal.items }];
  },
  inputs: {
    text: {
      type: { name: 'string', codeeditor: 'text' },
      displayName: 'CSV',
      group: 'General',
      description:
        'The CSV text to parse. A leading byte-order mark — which is what Excel writes when it ' +
        'saves UTF-8 — is stripped, so the first column keeps its name',
      set: function (this: ParseCSVNodeInstance, value: string) {
        this._internal.textSupplied = value !== undefined && value !== null;
        this._internal.text = value;
        this._schedule();
      }
    },
    hasHeader: {
      type: 'boolean',
      displayName: 'Has Header',
      group: 'General',
      default: true,
      description:
        'When ticked the first row names the columns and Items is an array of records. Untick it ' +
        'and Items is an array of rows, each an array of cells',
      set: function (this: ParseCSVNodeInstance, value: boolean) {
        this._internal.hasHeader = !!value;
        this._schedule();
      }
    },
    delimiter: {
      type: 'string',
      displayName: 'Delimiter',
      group: 'General',
      default: ',',
      description: 'The character between cells. Use ; for a European export, or a tab for TSV',
      set: function (this: ParseCSVNodeInstance, value: string) {
        this._internal.delimiter = value || ',';
        this._schedule();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'Value',
      description:
        'The parsed rows — records when Has Header is ticked, arrays of cells when it is not. ' +
        'Every cell is a string, including columns that look numeric. Unchanged while the CSV ' +
        'cannot be parsed',
      getter: function (this: ParseCSVNodeInstance) {
        return this._internal.items;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'Value',
      description: 'How many rows the last successful parse produced, not counting the header row',
      getter: function (this: ParseCSVNodeInstance) {
        return this._internal.count;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires once Items and Count hold the freshly parsed CSV'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when the CSV could not be parsed, leaving Items and Count as they were'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the CSV could not be parsed, naming the line it gave up on; empty until a parse fails',
      getter: function (this: ParseCSVNodeInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    _schedule: function (this: ParseCSVNodeInstance) {
      // Three inputs arriving in one update pass are one parse, not three — the same guard
      // `Static Array` uses, and the reason a graph that sets Delimiter and CSV together does
      // not parse once with the old delimiter first.
      if (this._internal.scheduled) return;
      this._internal.scheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.scheduled = false;
        this._parse();
      });
    },
    _parse: function (this: ParseCSVNodeInstance) {
      // Nothing has arrived on CSV yet: abstain. Failure Contract §2 — an unset input is not an
      // error, and a node that reports one at load is a node whose Failure port gets ignored.
      if (!this._internal.textSupplied) return;

      const result = parseCSV(this._internal.text, this._internal.delimiter);

      if (result.error) {
        this._internal.lastError = result.error.message;
        this.flagOutputDirty('error');
        // Ungated by `editorConnection`, for the reason the Failure Contract opens by naming:
        // a warning that only exists on the canvas is total silence in a cloud function, which
        // is exactly where a CSV someone sent you arrives.
        this.raiseRuntimeError(PARSE_ERROR_CODE, result.error.message, { line: result.error.line });
        this.sendSignalOnOutput('failure');
        return;
      }

      this._internal.lastError = undefined;
      this.flagOutputDirty('error');

      if (this._internal.hasHeader) {
        const records = rowsToRecords(result.rows);
        // A Collection rather than a plain array, so the array family downstream sees records
        // with `.get()` — the same thing `Static Array` hands them.
        const collection = Collection.get();
        collection.set(records);
        this._internal.items = collection;
        this._internal.count = records.length;
      } else {
        // Rows of cells stay plain nested arrays: a row of strings is not a record, and turning
        // one into a Model would invent property names the file never had.
        this._internal.items = result.rows;
        this._internal.count = result.rows.length;
      }

      this.flagOutputDirty('items');
      this.flagOutputDirty('count');
      this.sendSignalOnOutput('changed');
    }
  }
};

const ParseCSVNodeModule: NodeModule = { node: ParseCSVNode };

export = ParseCSVNodeModule;
