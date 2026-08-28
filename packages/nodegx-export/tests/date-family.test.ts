import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { dateLibSource } from '../src/emit/dateLib';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

import {
  addToDate,
  differenceBetween,
  isoWeek as runtimeIsoWeek,
  toDate as runtimeToDate,
  truncateTo,
  DateUnit,
  CompareGranularity
} from '../../noodl-runtime/src/nodes/std-library/date/datemath';

/**
 * EXP-011 Tier 1.3 — the date family.
 *
 * Two halves, and the first is the one that can actually catch a mistake.
 *
 * §A is a **differential test**: the emitted `src/lib/date.ts` is transpiled, loaded, and run
 * against the interpreter's own `datemath.ts` over a grid of dates, amounts and units — and
 * against `Date To String`'s real `_format`, reached through the node definition's `methods`.
 * A transcription is exactly the kind of work that goes subtly wrong while reading correctly, so
 * the test compares the two implementations rather than asserting what the transcription says.
 *
 * §B is the translation: graphs in, emitted code out, with every deferral asserted **by its named
 * reason** — a gate that fires for the wrong reason passes the weaker test.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

// ---- §A the emitted module, against the interpreter it has to agree with --------------------

/**
 * The emitted module, compiled and loaded.
 *
 * 🔴 This loads the **artefact that ships**, not a copy of it kept beside the generator. A test
 * against a second copy of the same logic is a test that both copies say the same thing, which is
 * true by construction and worth nothing.
 */
interface DateLib {
  toDate(value: unknown): Date | undefined;
  addToDate(date: Date, amount: number, unit: DateUnit): Date | undefined;
  differenceBetween(from: Date, to: Date, unit: DateUnit): number;
  truncateTo(date: Date, granularity: CompareGranularity): number;
  isoWeek(date: Date): number;
  dateAdd(value: unknown, amount: unknown, unit: DateUnit): Date | undefined;
  dateDifference(from: unknown, to: unknown, unit: DateUnit, absolute: unknown): number | undefined;
  dateCompare(a: unknown, b: unknown, g: CompareGranularity, answer: string): boolean | undefined;
  datePart(value: unknown, part: string): number | string | undefined;
  dateToString(value: unknown, format: unknown, timeZone: unknown): string | undefined;
}

const loadDateLib = (source = dateLibSource()): DateLib => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', js)(exported, module);
  return module.exports as unknown as DateLib;
};

const lib = loadDateLib();

/**
 * The `Date To String` node definition, loaded from source.
 *
 * ⚠️ **Transpiled rather than imported**, and not for convenience: `datetostring.ts` does not
 * typecheck under *this* package's tsconfig — its `_format` reads a `Date | undefined` as a
 * `Date`, which is the load-bearing throw the node's own catch depends on (§A below tests exactly
 * that behaviour). `noodl-runtime` compiles it under looser settings; ts-jest here refuses the
 * whole suite. `transpileModule` erases types without checking them, which is what running the
 * interpreter's real code from a stricter package requires.
 */
const runtimeDateToStringNode = (() => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'noodl-runtime', 'src', 'nodes', 'std-library', 'datetostring.ts'),
    'utf8'
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, () => ({}));
  return (module.exports as { node: unknown }).node as {
    initialize: (this: unknown) => void;
    inputs: Record<string, { set: (this: unknown, value: unknown) => void }>;
    outputs: Record<string, { getter?: (this: unknown) => unknown }>;
    methods: Record<string, (this: unknown) => void>;
  };
})();

/** The real `_format`, driven through the node's own setters. */
const runtimeFormat = (input: unknown, format: string, timeZone: string): string | undefined => {
  const mod = { node: runtimeDateToStringNode };
  const instance = {
    _internal: {} as Record<string, unknown>,
    flagOutputDirty: () => undefined,
    sendSignalOnOutput: () => undefined,
    _format: () => undefined
  };
  instance._format = mod.node.methods._format.bind(instance) as () => undefined;
  mod.node.initialize.call(instance);
  mod.node.inputs.formatString.set.call(instance, format);
  mod.node.inputs.timeZone.set.call(instance, timeZone);
  mod.node.inputs.input.set.call(instance, input);
  return mod.node.outputs.currentValue.getter!.call(instance) as string | undefined;
};

const UNITS: DateUnit[] = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
const GRANULARITIES: CompareGranularity[] = ['millisecond', 'second', 'minute', 'hour', 'day', 'month', 'year'];

/**
 * The grid. Month-ends and leap days are over-represented on purpose: the clamping rule and the
 * whole-calendar-step trim are the two behaviours in this family that a plausible-looking
 * transcription gets wrong, and both only show at a month boundary.
 */
const DATES = [
  new Date(2024, 0, 31, 13, 45, 30, 123), // 31 January, a leap year
  new Date(2024, 1, 29, 0, 0, 0, 0), // 29 February
  new Date(2023, 1, 28, 23, 59, 59, 999), // 28 February, not a leap year
  new Date(2024, 2, 31, 12, 0, 0, 0), // 31 March
  new Date(2024, 3, 30, 6, 30, 0, 0), // 30 April
  new Date(2025, 11, 31, 23, 0, 0, 0), // New Year's Eve
  new Date(2020, 6, 15, 9, 15, 45, 500), // an ordinary day
  new Date(1999, 8, 1, 0, 0, 0, 1)
];
const AMOUNTS = [-13, -12, -7, -3, -1, 0, 1, 2, 3, 7, 11, 12, 13, 25];

describe('EXP-011 Tier 1.3 §A — the emitted module against the interpreter', () => {
  it('the module the export ships parses and loads', () => {
    const sf = ts.createSourceFile('date.ts', dateLibSource(), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n')).toBe('');
    expect(typeof lib.dateAdd).toBe('function');
  });

  it('addToDate agrees with the interpreter on every date, amount and unit in the grid', () => {
    const disagreements: string[] = [];
    for (const date of DATES) {
      for (const amount of AMOUNTS) {
        for (const unit of UNITS) {
          const mine = lib.addToDate(date, amount, unit);
          const theirs = addToDate(date, amount, unit);
          if (mine === undefined || mine.getTime() !== theirs.getTime()) {
            disagreements.push(
              `${date.toISOString()} + ${amount} ${unit}: emitted ${mine?.toISOString()} vs runtime ${theirs.toISOString()}`
            );
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
    // 8 dates × 14 amounts × 8 units — stated so a grid that silently shrinks is visible.
    expect(DATES.length * AMOUNTS.length * UNITS.length).toBe(896);
  });

  it('differenceBetween agrees with the interpreter over every ordered pair of grid dates', () => {
    const disagreements: string[] = [];
    for (const from of DATES) {
      for (const to of DATES) {
        for (const unit of UNITS) {
          const mine = lib.differenceBetween(from, to, unit);
          const theirs = differenceBetween(from, to, unit);
          if (!Object.is(mine, theirs)) {
            disagreements.push(`${from.toISOString()} → ${to.toISOString()} in ${unit}: ${mine} vs ${theirs}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('truncateTo and isoWeek agree with the interpreter', () => {
    for (const date of DATES) {
      for (const g of GRANULARITIES) {
        expect(lib.truncateTo(date, g)).toBe(truncateTo(date, g));
      }
      expect(lib.isoWeek(date)).toBe(runtimeIsoWeek(date));
    }
    // A year of consecutive days, because the ISO week rule is a boundary rule.
    for (let day = 0; day < 400; day++) {
      const d = new Date(2024, 0, 1 + day);
      expect(lib.isoWeek(d)).toBe(runtimeIsoWeek(d));
    }
  });

  it('toDate agrees with the interpreter, including the shapes a JSON round trip produces', () => {
    const values: unknown[] = [
      undefined,
      null,
      '',
      'cake',
      '2024-02-29T12:00:00.000Z',
      '2024-02-29',
      1709208000000,
      0,
      NaN,
      Infinity,
      new Date(2024, 1, 29),
      new Date('nope'),
      true,
      {},
      []
    ];
    for (const value of values) {
      const mine = lib.toDate(value);
      const theirs = runtimeToDate(value);
      expect(mine === undefined ? undefined : mine.getTime()).toBe(theirs === undefined ? undefined : theirs.getTime());
    }
  });

  it('dateToString agrees with the real _format — tokens, blanks, and the number it will not parse', () => {
    const formats = [
      '{year}-{month}-{date}',
      '{date}/{month}/{yearShort}',
      '{monthShort} {date}, {year}',
      '{hours}:{minutes}:{seconds}',
      'no placeholders at all',
      '{year}{year}{year}'
    ];
    const inputs: unknown[] = [
      new Date(2024, 1, 29, 9, 5, 3),
      new Date(2020, 10, 1, 0, 0, 0),
      '2024-02-29T09:05:03',
      'cake',
      new Date('nope'),
      // 🔴 The number is the interesting one: this node does NOT read epoch milliseconds, where
      // the other four do. Both sides must answer the blank.
      1709197503000
    ];
    for (const format of formats) {
      for (const input of inputs) {
        expect(`${format} <- ${String(input)}: ${lib.dateToString(input, format, '')}`).toBe(
          `${format} <- ${String(input)}: ${runtimeFormat(input, format, '')}`
        );
      }
    }
  });

  it('dateToString agrees with the real _format in a named zone, and blanks on an unknown one', () => {
    const instant = new Date(Date.UTC(2024, 5, 1, 23, 30, 0));
    for (const zone of ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC', 'Not/AZone']) {
      expect(`${zone}: ${lib.dateToString(instant, '{year}-{month}-{date} {hours}:{minutes}', zone)}`).toBe(
        `${zone}: ${runtimeFormat(instant, '{year}-{month}-{date} {hours}:{minutes}', zone)}`
      );
    }
  });

  /**
   * 🔴 The control pair. The three tests above compare two implementations and would pass just as
   * happily if the comparison could not fail — so one deliberately broken copy of the emitted
   * module must make them fail, and here it is. Without this, "they agree" is a reading that fits
   * rather than one that excludes.
   */
  it('a sabotaged copy of the emitted module DISAGREES — so the comparison can fail', () => {
    const broken = loadDateLib(
      // The clamp, removed: shift the month without pinning to the 1st first, which is the
      // classic wrong answer (31 January + 1 month = 2 or 3 March).
      dateLibSource().replace('  result.setDate(1);', '  // result.setDate(1);')
    );
    const jan31 = new Date(2024, 0, 31);
    expect(addToDate(jan31, 1, 'months').getTime()).toBe(new Date(2024, 1, 29).getTime());
    expect(lib.addToDate(jan31, 1, 'months')!.getTime()).toBe(new Date(2024, 1, 29).getTime());
    expect(broken.addToDate(jan31, 1, 'months')!.getTime()).not.toBe(new Date(2024, 1, 29).getTime());
  });

  describe('the rules the nodes promise in their own descriptions', () => {
    it('months and years CLAMP rather than overflowing', () => {
      expect(lib.dateAdd(new Date(2024, 0, 31), 1, 'months')).toEqual(new Date(2024, 1, 29));
      expect(lib.dateAdd(new Date(2023, 0, 31), 1, 'months')).toEqual(new Date(2023, 1, 28));
      expect(lib.dateAdd(new Date(2024, 1, 29), 1, 'years')).toEqual(new Date(2025, 1, 28));
    });

    it('fixed units are exact and unrounded — 36 hours is 1.5 days', () => {
      const from = new Date(2024, 0, 1, 0, 0, 0);
      const to = new Date(2024, 0, 2, 12, 0, 0);
      expect(lib.dateDifference(from, to, 'days', false)).toBe(1.5);
      expect(lib.dateDifference(to, from, 'days', false)).toBe(-1.5);
      expect(lib.dateDifference(to, from, 'days', true)).toBe(1.5);
    });

    it('months and years count whole calendar steps that never overshoot', () => {
      expect(lib.dateDifference(new Date(2024, 0, 31), new Date(2024, 1, 29), 'months', false)).toBe(1);
      expect(lib.dateDifference(new Date(2024, 0, 31), new Date(2024, 1, 27), 'months', false)).toBe(0);
    });

    it('granularity is what makes Date Compare answer the question people ask', () => {
      const morning = new Date(2024, 4, 8, 9, 0, 0);
      const evening = new Date(2024, 4, 8, 21, 30, 0);
      expect(lib.dateCompare(morning, evening, 'millisecond', 'same')).toBe(false);
      expect(lib.dateCompare(morning, evening, 'day', 'same')).toBe(true);
      expect(lib.dateCompare(morning, evening, 'millisecond', 'before')).toBe(true);
      expect(lib.dateCompare(morning, evening, 'day', 'before')).toBe(false);
    });

    it('Month is 1-12 and Day of Week is JavaScript’s 0-6', () => {
      const d = new Date(2024, 0, 7); // a Sunday in January
      expect(lib.datePart(d, 'month')).toBe(1);
      expect(lib.datePart(d, 'dayOfWeek')).toBe(0);
      expect(lib.datePart(d, 'dayName')).toBe('Sunday');
      expect(lib.datePart(d, 'year')).toBe(2024);
    });

    it('every node answers undefined for a date it could not read', () => {
      expect(lib.dateAdd('cake', 1, 'days')).toBeUndefined();
      expect(lib.dateDifference('cake', new Date(), 'days', false)).toBeUndefined();
      expect(lib.dateCompare(new Date(), '', 'day', 'same')).toBeUndefined();
      expect(lib.datePart(null, 'year')).toBeUndefined();
      expect(lib.dateToString(undefined, '{year}', '')).toBeUndefined();
      // Arrived and unreadable is the blank, not the absence — the node's own catch.
      expect(lib.dateToString('cake', '{year}', '')).toBe('');
    });

    it('the value coercions are the interpreter’s setters, not tidying', () => {
      const d = new Date(2024, 0, 1);
      // `Number(value)`, then a non-finite Amount reads as 0.
      expect(lib.dateAdd(d, '3', 'days')).toEqual(new Date(2024, 0, 4));
      expect(lib.dateAdd(d, 'cake', 'days')).toEqual(d);
      // `!!value` on Absolute.
      expect(lib.dateDifference(new Date(2024, 0, 5), d, 'days', 'yes')).toBe(4);
      expect(lib.dateDifference(new Date(2024, 0, 5), d, 'days', '')).toBe(-4);
    });
  });
});

// ---- §B the translation ---------------------------------------------------------------------

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'signal'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const reportOf = (app: ReturnType<typeof emitApp>) => app.notes.join('\n');

/** Every emitted file is parsed — the `}; else` floor (§7.2). */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.ESNext,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

/** A date node feeding the Notes heading, which is the simplest rendered value sink there is. */
const withDates = (
  build: (ir: ExportIR, notes: ComponentIR) => void
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
  build(ir, notes);
  return { ir, app: emit(ir) };
};

describe('EXP-011 Tier 1.3 §B — the translation', () => {
  describe('the pure nodes are ordinary function calls', () => {
    it('Date To String over an authored date renders through the emitted helper', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'stamp',
          type: 'Date To String',
          authoredLabel: 'Stamp',
          parameters: [
            { name: 'input', value: literal('2024-02-29T09:05:03Z') },
            { name: 'formatString', value: literal('{monthShort} {date}, {year}') }
          ]
        });
        connect(notes, 'stamp', 'currentValue', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      expect(page).toContain("import { dateToString } from '../lib/date';");
      expect(page).toContain(`dateToString('2024-02-29T09:05:03Z', '{monthShort} {date}, {year}', '')`);
      // The module ships because something imports it.
      expect(app.files['src/lib/date.ts']).toContain('export function dateToString');
    });

    it('an unopened panel exports the value initialize wrote, not the declared default', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'stamp',
          type: 'Date To String',
          parameters: [{ name: 'input', value: literal('2024-02-29') }]
        });
        connect(notes, 'stamp', 'currentValue', 'notesHeading', 'text', 'value');
      });
      // `{year}-{month}-{date}` and `''` are what `initialize` assigns; a declared default never
      // runs its setter, so these are the values the interpreter is actually holding.
      expect(notesFile(app)).toContain(`dateToString('2024-02-29', '{year}-{month}-{date}', '')`);
    });

    it('the four datemath nodes each emit their own helper with the panel’s configuration', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'shift',
          type: 'net.noodl.DateAdd',
          parameters: [
            { name: 'input', value: literal('2024-01-31') },
            { name: 'amount', value: literal(1) },
            { name: 'unit', value: literal('months') }
          ]
        });
        addNode(notes, {
          id: 'gap',
          type: 'net.noodl.DateDifference',
          parameters: [
            { name: 'from', value: literal('2024-01-01') },
            { name: 'to', value: literal('2024-03-01') },
            { name: 'unit', value: literal('days') },
            { name: 'absolute', value: literal(true) }
          ]
        });
        addNode(notes, {
          id: 'sameDay',
          type: 'net.noodl.DateCompare',
          parameters: [
            { name: 'a', value: literal('2024-01-01T09:00:00Z') },
            { name: 'b', value: literal('2024-01-01T21:00:00Z') },
            { name: 'granularity', value: literal('day') }
          ]
        });
        addNode(notes, {
          id: 'parts',
          type: 'net.noodl.DateParts',
          parameters: [{ name: 'input', value: literal('2024-02-29') }]
        });
        const dayText = addNode(notes, { id: 'dayText', type: 'Text', parent: 'notesShell' });
        const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
        shell.children = [...(shell.children ?? []), dayText.id];
        connect(notes, 'gap', 'difference', 'notesHeading', 'text', 'value');
        connect(notes, 'parts', 'dayName', 'dayText', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      expect(page).toContain(`dateDifference('2024-01-01', '2024-03-01', 'days', true)`);
      expect(page).toContain(`datePart('2024-02-29', 'dayName')`);
      // Only the helpers something calls are imported.
      expect(page).toContain("import { dateDifference, datePart } from '../lib/date';");
    });

    it('a multi-answer node calls once per answer, with the answer as the last argument', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'cmp',
          type: 'net.noodl.DateCompare',
          parameters: [
            { name: 'a', value: literal('2024-01-01') },
            { name: 'b', value: literal('2024-06-01') },
            { name: 'granularity', value: literal('day') }
          ]
        });
        connect(notes, 'cmp', 'before', 'notesHeading', 'visible', 'value');
      });
      expectParses(app);
      expect(notesFile(app)).toContain(`dateCompare('2024-01-01', '2024-06-01', 'day', 'before')`);
    });

    it('they COMPOSE — Now into Date Add into Date To String is one nested expression', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        addNode(notes, {
          id: 'due',
          type: 'net.noodl.DateAdd',
          parameters: [
            { name: 'amount', value: literal(7) },
            { name: 'unit', value: literal('days') }
          ]
        });
        addNode(notes, {
          id: 'dueText',
          type: 'Date To String',
          parameters: [{ name: 'formatString', value: literal('{date} {monthShort}') }]
        });
        connect(notes, 'clock', 'date', 'due', 'input', 'value');
        connect(notes, 'due', 'result', 'dueText', 'input', 'value');
        connect(notes, 'dueText', 'currentValue', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      expect(notesFile(app)).toContain(`dateToString(dateAdd(clock, 7, 'days'), '{date} {monthShort}', '')`);
    });
  });

  describe('Now', () => {
    it('with nothing on Read it is the mount instant — a LAZY useState initializer', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        connect(notes, 'clock', 'iso', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      /**
       * 🔴 `useState(() => new Date())`, not `useState(new Date())`. The eager form constructs a
       * Date on every render; this is the "is Now a render read?" question, answered.
       */
      expect(page).toContain('useState<Date>(() => new Date());');
      expect(page).toContain('clock.toISOString()');
      // Never optional-chained: the row is seeded at mount, so there is no undefined to guard.
      expect(page).not.toContain('clock?.toISOString()');
    });

    it('a wired Read binds the instant to a local and writes the row', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        connect(notes, 'addButton', 'onClick', 'clock', 'read');
        connect(notes, 'clock', 'timestamp', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      expect(page).toContain('const clockRead = new Date()');
      expect(page).toContain('setClock(clockRead)');
      // The render read goes through the row, not the local.
      expect(page).toContain('clock.getTime()');
    });

    /**
     * 🔴 The chain-local rule, and the reason it exists. `setClock(...)` does not change `clock`
     * inside the closure that called it, so a read in the Read chain must be the local — and one
     * bound local rather than two `new Date()` calls, which could straddle a millisecond and make
     * Timestamp and ISO String disagree about which second it is.
     */
    it('reads INSIDE the Read chain take the local, and there is exactly one clock read', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        addNode(notes, {
          id: 'saveStamp',
          type: 'Set Variable',
          parameters: [{ name: 'name', value: literal('lastSeen') }]
        });
        connect(notes, 'addButton', 'onClick', 'clock', 'read');
        connect(notes, 'clock', 'done', 'saveStamp', 'do');
        connect(notes, 'clock', 'iso', 'saveStamp', 'value', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      const handler = page.slice(page.indexOf('onClick'));
      expect(handler).toContain('const clockRead = new Date()');
      expect(handler).toContain('clockRead.toISOString()');
      // One clock read in the chain, however many outputs it publishes.
      expect(page.match(/new Date\(\)/g)!.length).toBe(1);
    });

    /**
     * 🔴 The Read as the WHOLE handler, which is the shape that does not parse.
     *
     * `const` is a statement, and an arrow with an expression body cannot hold one. Every other
     * test here wires the Read to the fixture's Add button, which already carries an action — two
     * actions take the `{ a; b; }` block form and parse perfectly. So a suite that parses every
     * emitted file still shipped `() => const clockRead = new Date(); …` into a built app.
     * This is the case that fails without the `isStatement` clause, and it took building the
     * exported project to find.
     */
    it('a Read that is the ONLY action on a handler still takes the block form', () => {
      const { app } = withDates((_ir, notes) => {
        const button = addNode(notes, {
          id: 'refreshButton',
          type: 'net.noodl.controls.button',
          parent: 'notesShell',
          parameters: [{ name: 'label', value: literal('Refresh') }]
        });
        const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
        shell.children = [...(shell.children ?? []), button.id];
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        connect(notes, 'refreshButton', 'onClick', 'clock', 'read');
        connect(notes, 'clock', 'iso', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      expect(page).toContain('onClick={() => {');
      expect(page).toContain('const clockRead = new Date();');
      expect(page).not.toContain('=> const ');
    });

    it('a Read fired by nothing translatable defers the reads rather than freezing the app', () => {
      const { ir, app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        // A Router's own signal is not a rendered element event or a receiver.
        addNode(notes, { id: 'stray', type: 'RouterNavigate' });
        connect(notes, 'stray', 'navigated', 'clock', 'read');
        connect(notes, 'clock', 'iso', 'notesHeading', 'text', 'value');
      });
      expect(ir).toBeDefined();
      /**
       * The trigger's own reason is reported at the wire — that is where the attachment pass
       * rules, and it claims the node's disposition at the same time, so the date sweep does not
       * re-report it.
       *
       * 🔴 The load-bearing assertion is the second one. The interpreter re-reads this clock on
       * every navigation; the exported app cannot. Binding a row anyway would freeze the page at
       * its mount instant and show a plausible date forever, which is worse than showing nothing
       * — so no row is emitted and the read is left for the report.
       */
      expect(reportOf(app)).toContain('wire stray:navigated->clock:read dropped:');
      expect(notesFile(app)).not.toContain('new Date()');
      expect(notesFile(app)).not.toContain('setClock');
    });
  });

  describe('what defers, and the reason it gives', () => {
    it('a wired Unit defers, because the interpreter throws on a unit it does not know', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'shift',
          type: 'net.noodl.DateAdd',
          parameters: [{ name: 'input', value: literal('2024-01-01') }]
        });
        connect(notes, 'noteDraftVar', 'value', 'shift', 'unit', 'value');
        connect(notes, 'shift', 'result', 'notesHeading', 'text', 'value');
      });
      expect(reportOf(app)).toContain(
        'its unit is wired — that input is an editor-constrained list, and the interpreter throws on a value outside it rather than answering'
      );
    });

    it('a wired Amount does NOT defer — it has no throwing branch', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'shift',
          type: 'net.noodl.DateAdd',
          parameters: [
            { name: 'input', value: literal('2024-01-01') },
            { name: 'unit', value: literal('days') }
          ]
        });
        connect(notes, 'noteDraftVar', 'value', 'shift', 'amount', 'value');
        connect(notes, 'shift', 'result', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      expect(notesFile(app)).toContain(`dateAdd('2024-01-01', `);
      expect(reportOf(app)).not.toContain('its amount is wired');
    });

    it('a consumed Changed defers as a recomputation, not as an event', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'shift',
          type: 'net.noodl.DateAdd',
          parameters: [
            { name: 'input', value: literal('2024-01-01') },
            { name: 'unit', value: literal('days') }
          ]
        });
        connect(notes, 'shift', 'changed', 'notesHeading', 'text', 'value');
      });
      expect(reportOf(app)).toContain('that pulse announces a recomputation');
    });

    it('an Invalid Date consumed as a signal defers with the failure’s own reason', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'parts',
          type: 'net.noodl.DateParts',
          parameters: [{ name: 'input', value: literal('2024-01-01') }]
        });
        connect(notes, 'parts', 'failure', 'notesHeading', 'text', 'value');
      });
      expect(reportOf(app)).toContain('the node re-derives its answer on every arrival');
    });

    it('a node with nothing on its Date input and none authored defers, naming the abstain', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'parts', type: 'net.noodl.DateParts' });
        connect(notes, 'parts', 'year', 'notesHeading', 'text', 'value');
      });
      expect(reportOf(app)).toContain('so the node never produces an answer');
    });

    /**
     * The divergence this slice ships with, reported rather than hidden: a wire that can deliver
     * an empty puts the interpreter and the exported call one transition apart.
     */
    it('a date input that can go empty is reported, not silently pure', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'parts',
          type: 'net.noodl.DateParts',
          parameters: [{ name: 'input', value: literal('2024-01-01') }]
        });
        connect(notes, 'noteDraftVar', 'value', 'parts', 'input', 'value');
        connect(notes, 'parts', 'year', 'notesHeading', 'text', 'value');
      });
      expect(reportOf(app)).toContain(
        'the interpreter keeps its previous answer when that input goes away, and the exported call answers nothing instead'
      );
    });
  });

  /**
   * 🔴 §7.5 / §8.7's gap, closed for this family — and it was open again when this slice was
   * first built. `typeOfSource` is the second consumer of every readable node, and a Variable it
   * cannot type is `unknown`, which makes Pass 4 drop every read of it. "Save the moment I
   * pressed the button, then show it" is the first thing anyone would build.
   */
  describe('a Variable written from a date node is readable', () => {
    it('Now’s ISO String through a Variable renders, rather than leaving the placeholder', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, { id: 'clock', type: 'net.noodl.Now', authoredLabel: 'Clock' });
        addNode(notes, {
          id: 'saveStamp',
          type: 'Set Variable',
          parameters: [{ name: 'name', value: literal('lastRead') }]
        });
        addNode(notes, {
          id: 'lastReadVar',
          type: 'Variable2',
          parameters: [{ name: 'name', value: literal('lastRead') }]
        });
        connect(notes, 'addButton', 'onClick', 'clock', 'read');
        connect(notes, 'clock', 'done', 'saveStamp', 'do');
        connect(notes, 'clock', 'iso', 'saveStamp', 'value', 'value');
        connect(notes, 'lastReadVar', 'value', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      const page = notesFile(app);
      expect(page).toContain("from '../stores/variables';");
      expect(page).toContain('useValue(lastRead)');
      // `string | undefined` is the honest type: a variable boots unwritten. What matters is that
      // it is not `unknown`, which is what makes Pass 4 drop every read of it.
      expect(app.files['src/stores/variables.ts']).toContain('export const lastRead = value<string | undefined>');
    });

    it('a Date To String through a Variable is readable too', () => {
      const { app } = withDates((_ir, notes) => {
        addNode(notes, {
          id: 'stamp',
          type: 'Date To String',
          parameters: [{ name: 'input', value: literal('2024-02-29') }]
        });
        addNode(notes, {
          id: 'saveStamp',
          type: 'Set Variable',
          parameters: [{ name: 'name', value: literal('shownDate') }]
        });
        addNode(notes, {
          id: 'shownVar',
          type: 'Variable2',
          parameters: [{ name: 'name', value: literal('shownDate') }]
        });
        connect(notes, 'addButton', 'onClick', 'saveStamp', 'do');
        connect(notes, 'stamp', 'currentValue', 'saveStamp', 'value', 'value');
        connect(notes, 'shownVar', 'value', 'notesHeading', 'text', 'value');
      });
      expectParses(app);
      expect(app.files['src/stores/variables.ts']).toContain('export const shownDate = value<string | undefined>');
      expect(notesFile(app)).toContain('useValue(shownDate)');
    });
  });

  /**
   * §2's requirement: a picker-exercising project that exports, builds and runs.
   *
   * `tests/fixtures/deadline-desk` — **Deadline Desk**, authored through the MCP server rather
   * than by hand-editing JSON, one routed page, every node placed on it. The goldens below are
   * pinned to the exact files a headless Chrome executed (EXP-011 §9.5), so what the suite holds
   * is the artefact whose behaviour was watched rather than a re-derivation of it.
   *
   * 🔴 The project is built around answers that can be **written down before it runs**. The
   * anchor is 31 January 2024 because adding a month to it has two defensible answers and only
   * one of them is the interpreter's — a board built on today's date would show a plausible
   * result whether the arithmetic was right or wrong.
   */
  describe('Deadline Desk — the driven project', () => {
    const DESK = path.join(__dirname, 'fixtures', 'deadline-desk');
    const deskApp = emitApp(parseProject(DESK, catalog), catalog);
    const deskHome = deskApp.files['src/pages/Home.tsx'];

    it('reports nothing dropped beyond the router shell', () => {
      expect(deskApp.notes.filter((n) => !n.includes('router shell'))).toEqual([]);
    });

    it('parses, every file', () => expectParses(deskApp));

    /** The clamp, as the browser rendered it: "Feb 29, 2024", never "Mar 02, 2024". */
    it('nests Date Add inside Date To String for the review date', () => {
      expect(deskHome).toContain(
        `{dateToString(dateAdd('2024-01-31T12:00:00', 1, 'months'), '{monthShort} {date}, {year}', '')}`
      );
    });

    it('carries the zone through to the formatter', () => {
      expect(deskHome).toContain(
        `{dateToString('2024-06-01T23:30:00Z', '{year}-{month}-{date} {hours}:{minutes}', 'Asia/Tokyo')}`
      );
    });

    /**
     * The control pair, in the emitted source: the same two instants compared at two
     * granularities. The browser showed the first panel and not the second.
     */
    it('emits both halves of the granularity control pair', () => {
      expect(deskHome).toContain(`dateCompare('2024-05-08T09:00:00', '2024-05-08T21:30:00', 'day', 'same')`);
      expect(deskHome).toContain(`dateCompare('2024-05-08T09:00:00', '2024-05-08T21:30:00', 'millisecond', 'same')`);
    });

    /** The clock composed into a comparison, and the pair that reads it both ways. */
    it('reads the clock row into Date Compare, both answers', () => {
      expect(deskHome).toContain(`dateCompare(clock, '2024-06-01T12:00:00', 'day', 'after')`);
      expect(deskHome).toContain(`dateCompare(clock, '2024-06-01T12:00:00', 'day', 'before')`);
    });

    /**
     * 🔴 The whole of `Now`'s design in four lines: a lazy initializer, one clock read per press
     * bound to a local, the row written from that local, and the chain reading the local — not
     * the row, which `setClock` has not updated inside this closure.
     */
    it('emits the lazy seed, one bound read, and a chain that reads the local', () => {
      expect(deskHome).toContain('const [clock, setClock] = useState<Date>(() => new Date());');
      expect(deskHome).toContain('const clockRead = new Date();');
      expect(deskHome).toContain('setClock(clockRead);');
      expect(deskHome).toContain('lastRead.set(clockRead.toISOString());');
      // Exactly one clock read in the whole page: three outputs, one instant.
      expect(deskHome.match(/new Date\(\)/g)!.length).toBe(2); // the seed and the Read
    });

    /** Render reads go through the row, and need no guard — the row is seeded at mount. */
    it('renders the row unguarded, and the variable the chain wrote', () => {
      expect(deskHome).toContain('{clock.toISOString()}');
      expect(deskHome).toContain(`{dateToString(clock, '{hours}:{minutes}:{seconds}', '')}`);
      expect(deskHome).not.toContain('clock?.');
      expect(deskHome).toContain('const read = useValue(lastRead);');
    });

    it('imports only the five helpers the page calls', () => {
      expect(deskHome).toContain(
        "import { dateAdd, dateCompare, dateDifference, datePart, dateToString } from '../lib/date';"
      );
      expect(deskApp.files['src/lib/date.ts']).toBeDefined();
    });
  });

  describe('the module ships only where it is used', () => {
    it('a project with no date node emits no src/lib/date.ts', () => {
      const app = emit(JSON.parse(JSON.stringify(baseIr)));
      expect(app.files['src/lib/date.ts']).toBeUndefined();
    });

    /**
     * 🔴 The dead-module control. A date read that a later pass drops must not leave the app
     * shipping a `lib/date.ts` nothing imports — the dead-`useSession` trap, one construct over.
     */
    it('a date node whose read is dropped leaves no module behind', () => {
      const { app } = withDates((_ir, notes) => {
        const parts = addNode(notes, {
          id: 'parts',
          type: 'net.noodl.DateParts',
          parameters: [{ name: 'input', value: literal('2024-01-01') }]
        });
        setParam(parts, 'input', literal('2024-01-01'));
        // Read into a port that is not a translatable sink: the expression resolves speculatively
        // and is then dropped.
        connect(notes, 'parts', 'changed', 'notesHeading', 'text', 'value');
      });
      expect(app.files['src/lib/date.ts']).toBeUndefined();
    });
  });
});
