'use strict';

/**
 * To CSV (CWF-012 slice 3) — an array, as a CSV file.
 *
 * ## The correctness question is quoting, and it is the only one
 *
 * Any cell containing the delimiter, a quote or a newline has to be wrapped in quotes with its own
 * quotes doubled. Get that wrong and the output still *parses* — into a different shape, silently,
 * usually in someone else's system a week later. `csv.ts` owns the rule and `csv.test.ts` holds a
 * round trip over a fixture carrying all three hazards at once.
 *
 * ## Shared runtime
 *
 * Same reasoning as `Parse CSV`: a browser app offering "export to CSV" wants this as much as a
 * cloud function answering a supplier with one. No cloud guard.
 *
 * ## Reading an item
 *
 * The array family hands records as `Model`s, whose properties live under `.data` and are read
 * with `.get()`. A plain array of plain objects — what a Request node's parameter carries — works
 * too. What is deliberately NOT written is the record's `id`: it is minted by the runtime, it is
 * not a column the author put there, and a CSV with a surprise `id` column is a diff nobody asked
 * for. Name it in `Columns` if you actually want it.
 */

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import Model = require('../../../model');
import { rowsToCSV, toCSV, unionOfKeys } from '../../../csv';

interface ToCSVNodeInstance extends NodeInstance {
  _internal: {
    items?: ArrayLike<unknown>;
    itemsSupplied?: boolean;
    columns?: string;
    delimiter: string;
    includeHeader: boolean;
    text: string;
    scheduled?: boolean;
  };
  _schedule(): void;
  _render(): void;
}

/** A Model or a plain object, as a plain record. */
function toPlainRecord(item: unknown): Record<string, unknown> {
  if (item === null || item === undefined) return {};

  // ⚠️ `Model.instanceOf` first, and not a `typeof item.get === 'function'` probe: `Collection`
  // patches `get` onto `Array.prototype` (PLAT-003), so an array of cells would pass that probe
  // and be read as a record with numeric-ish keys.
  if (Model.instanceOf(item)) {
    return Object.assign({}, (item as { data: Record<string, unknown> }).data);
  }

  return Object.assign({}, item as Record<string, unknown>);
}

const ToCSVNode: NodeDefinitionOptions = {
  name: 'net.noodl.ToCSV',
  displayNodeName: 'To CSV',
  docs: 'https://docs.noodl.net/nodes/data/array/to-csv',
  category: 'Data',
  color: 'data',
  /** ⚠️ A declared `default` never runs its setter — these three lines are the real defaults. */
  initialize: function (this: ToCSVNodeInstance) {
    this._internal.delimiter = ',';
    this._internal.includeHeader = true;
    this._internal.text = '';
  },
  getInspectInfo(this: ToCSVNodeInstance): InspectInfo {
    return this._internal.text;
  },
  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      description: 'The array to write. Records become rows; an array of arrays is written cell for cell',
      set: function (this: ToCSVNodeInstance, value: ArrayLike<unknown>) {
        this._internal.itemsSupplied = value !== undefined && value !== null;
        this._internal.items = value;
        this._schedule();
      }
    },
    columns: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Columns',
      group: 'General',
      description:
        'Which properties to write, in order, comma separated. Leave it empty and every property ' +
        'found on the records is written, in the order they were first seen',
      set: function (this: ToCSVNodeInstance, value: string) {
        this._internal.columns = value;
        this._schedule();
      }
    },
    delimiter: {
      type: 'string',
      displayName: 'Delimiter',
      group: 'General',
      default: ',',
      description: 'The character between cells. Any cell containing it is quoted automatically',
      set: function (this: ToCSVNodeInstance, value: string) {
        this._internal.delimiter = value || ',';
        this._schedule();
      }
    },
    includeHeader: {
      type: 'boolean',
      displayName: 'Include Header',
      group: 'General',
      default: true,
      description: 'Write the column names as the first row',
      set: function (this: ToCSVNodeInstance, value: boolean) {
        this._internal.includeHeader = !!value;
        this._schedule();
      }
    }
  },
  outputs: {
    text: {
      type: 'string',
      displayName: 'CSV',
      group: 'Values',
      description:
        'The array as CSV text. Cells containing the delimiter, a quote or a newline are quoted ' +
        'and their quotes doubled, so this round-trips back through Parse CSV unchanged',
      getter: function (this: ToCSVNodeInstance) {
        return this._internal.text;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'Values',
      description: 'How many data rows were written, not counting the header row',
      getter: function (this: ToCSVNodeInstance) {
        return this._internal.items ? this._internal.items.length : 0;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires once CSV holds the freshly written text'
    }
  },
  methods: {
    _schedule: function (this: ToCSVNodeInstance) {
      if (this._internal.scheduled) return;
      this._internal.scheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.scheduled = false;
        this._render();
      });
    },
    _render: function (this: ToCSVNodeInstance) {
      // Nothing has arrived on Items yet: abstain, the same as Parse CSV. Writing an empty file
      // at load would announce a Changed nobody asked for.
      if (!this._internal.itemsSupplied) return;

      const source = this._internal.items;
      const length = source ? source.length : 0;
      const items: unknown[] = [];
      for (let i = 0; i < length; i++) items.push(source[i]);

      // ⚠️ A `stringlist` port carries ONE comma-separated string, not an array (phase 30). The
      // trim is what makes `name, team` mean the same as `name,team`.
      const declared = (this._internal.columns || '')
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      // Rows of cells — what `Parse CSV` produces with Has Header unticked — are written cell for
      // cell. Reading them as records would invent the column names `0,1,2`, which is a header row
      // the file never had and which `Parse CSV` would then read straight back as data.
      const isRowsOfCells = items.length > 0 && items.every((item) => Array.isArray(item));

      if (isRowsOfCells) {
        this._internal.text = rowsToCSV(items as unknown[][], { delimiter: this._internal.delimiter });
      } else {
        const records = items.map(toPlainRecord);
        this._internal.text = toCSV(records, {
          columns: declared.length ? declared : unionOfKeys(records),
          delimiter: this._internal.delimiter,
          includeHeader: this._internal.includeHeader
        });
      }

      this.flagOutputDirty('text');
      this.flagOutputDirty('count');
      this.sendSignalOnOutput('changed');
    }
  }
};

const ToCSVNodeModule: NodeModule = { node: ToCSVNode };

export = ToCSVNodeModule;
