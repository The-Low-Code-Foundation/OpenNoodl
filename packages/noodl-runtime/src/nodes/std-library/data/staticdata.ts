'use strict';

import Collection = require('../../../collection');
import type {
  CollectionLike,
  InspectInfo,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/**
 * Splits CSV into rows of raw cell strings.
 *
 * Everything comes back as a string — there is no type inference here, so a Static Array
 * authored as CSV yields string properties even for columns that look numeric. The JSON
 * branch below does preserve types, which is the practical difference between the two.
 */
function CSVToArray(strData: string, strDelimiter?: string): string[][] {
  // Check to see if the delimiter is defined. If not,
  // then default to comma.
  strDelimiter = strDelimiter || ',';

  // Create a regular expression to parse the CSV values.
  const objPattern = new RegExp(
    // Delimiters.
    '(\\' +
      strDelimiter +
      '|\\r?\\n|\\r|^)' +
      // Quoted fields.
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      // Standard fields.
      '([^"\\' +
      strDelimiter +
      '\\r\\n]*))',
    'gi'
  );

  // Create an array to hold our data. Give the array
  // a default empty first row.
  const arrData: string[][] = [[]];

  // Create an array to hold our individual pattern
  // matching groups.
  let arrMatches: RegExpExecArray | null = null;

  let prevLastIndex: number | undefined;

  // Keep looping over the regular expression matches
  // until we can no longer find a match.
  while ((arrMatches = objPattern.exec(strData)) && prevLastIndex !== objPattern.lastIndex) {
    prevLastIndex = objPattern.lastIndex;

    // Get the delimiter that was found.
    const strMatchedDelimiter = arrMatches[1];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
      // Since we have reached a new row of data,
      // add an empty row to our data array.
      arrData.push([]);
    }

    let strMatchedValue: string;

    // Now that we have our delimiter out of the way,
    // let's check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[2]) {
      // We found a quoted value. When we capture
      // this value, unescape any double quotes.
      strMatchedValue = arrMatches[2].replace(new RegExp('""', 'g'), '"');
    } else {
      // We found a non-quoted value.
      strMatchedValue = arrMatches[3];
    }

    // Now that we have our value string, let's add
    // it to the data array.
    arrData[arrData.length - 1].push(strMatchedValue);
  }

  // Return the parsed data.
  return arrData;
}

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
        const data = CSVToArray(internal.csv);
        const json: Record<string, string>[] = [];
        const fields = data[0];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const obj: Record<string, string> = {};
          for (let j = 0; j < fields.length; j++) {
            obj[fields[j]] = row[j];
          }
          json.push(obj);
        }

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
