import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { tsColumnType } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR } from '../src/ir/types';

/**
 * EXP-011 §48 — the `Date` column, registered by §46.3 and pinned as `string` by A5 there.
 *
 * On the wire a Date column is `{ __type: 'Date', iso }` (the backend's AdapterFacade `toWire`
 * wraps the stored ISO string; the runtime's cloudstore.js `_serializeObject` sends the same
 * envelope), and once the interpreter has read it, it is a JS `Date` (`_deserializeJSON(data,
 * 'Date')` → `new Date(data.iso)`). Before this slice the column typed `string`, `fromWire`
 * passed the envelope through, and a Text on the column printed `[object Object]` while
 * typechecking clean.
 *
 * Now: `tsColumnType('Date')` is `Date`, the client's `fromWire` unwraps the envelope on every
 * field (by shape — the envelope is unambiguous and the client has no schema), a Text on the
 * column takes the §43 non-string table (`String(x ?? '')`, the runtime Text's own cast), the
 * date family reads it bare (`toDate` takes a Date), and a `Now` into the column writes a Date
 * the wire serialises as its ISO string.
 *
 * §A the type and the client, §B the sinks and the write, §C the wire contract read from the
 * two sources it was transcribed from, §D the fixture `tests/fixtures/due-desk` whole.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'due-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (source: ExportIR = cloneIr()): ExportIR => {
  delete source.project.cloudservices;
  return source;
};
const retypeDue = (source: ExportIR, type: string | null): ExportIR => {
  const task = source.project.collections.find((c) => c.name === 'Task')!;
  if (type === null) task.columns = task.columns.filter((c) => c.name !== 'due');
  else task.columns.find((c) => c.name === 'due')!.type = type;
  return source;
};
const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const home = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Home.tsx');
const tasksApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/tasks.ts');
const client = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/client.ts');

const UNWRAP = [
  '/** The wire’s Date envelope (`{ __type: \'Date\', iso }`) on any field, as the interpreter reads it: a Date. */',
  'function fromWireValue(value: unknown): unknown {',
  "  if (value !== null && typeof value === 'object' && (value as { __type?: unknown }).__type === 'Date') {",
  '    const iso = (value as { iso?: unknown }).iso;',
  "    if (typeof iso === 'string') return new Date(iso);",
  '  }',
  '  return value;',
  '}'
].join('\n');

describe('§A — the type and the client', () => {
  test('A1 `tsColumnType`: Date is Date; the other four unchanged', () => {
    expect(tsColumnType('Date')).toBe('Date');
    expect(tsColumnType('File')).toBe('CloudFile');
    expect(tsColumnType('String')).toBe('string');
    expect(tsColumnType('Number')).toBe('number');
    expect(tsColumnType('Boolean')).toBe('boolean');
  });

  test('A2 the collection interface declares the column a Date, from the schema snapshot', () => {
    expect(tasksApi(app)).toContain('export interface Task {\n  id: string;\n  title?: string;\n  due?: Date;\n}');
  });

  test('A3 `fromWire` unwraps the Date envelope on every field, in one place, and every read goes through it', () => {
    expect(client(app)).toContain(UNWRAP.replace('’', "'"));
    expect(client(app)).toContain('for (const [key, value] of Object.entries(fields)) row[key] = fromWireValue(value);');
    // query (a map), fetchOne, create — every read that carries the wire's fields; update answers
    // the caller's own data plus the wire's `updatedAt`, so a Date the caller passed stays a Date.
    expect(client(app).match(/fromWire<T>\(/g)).toHaveLength(3);
    // Only the Date envelope is unwrapped: a File envelope IS the CloudFile the column declares (§46).
    expect(client(app)).not.toContain("__type: 'File'");
    expect(client(app).match(/__type === '/g)).toHaveLength(1);
  });

  test('A4 the unwrap is a pure function of its input: the shapes it accepts and the ones it leaves alone', () => {
    // Evaluate the emitted helper as written — the text is the artefact, so the text is what runs.
    const source = client(app);
    const start = source.indexOf('function fromWireValue');
    const end = source.indexOf('\n}\n', start) + 3;
    const fromWireValue = new Function(
      `${source.slice(start, end).replace(': unknown): unknown', ')').replace(/\(value as \{ [^}]+ \}\)/g, 'value')}; return fromWireValue;`
    )() as (value: unknown) => unknown;
    const date = fromWireValue({ __type: 'Date', iso: '2026-12-24T09:00:00.000Z' });
    expect(date).toBeInstanceOf(Date);
    expect((date as Date).toISOString()).toBe('2026-12-24T09:00:00.000Z');
    expect(fromWireValue({ __type: 'File', name: 'a', url: 'b' })).toEqual({ __type: 'File', name: 'a', url: 'b' });
    expect(fromWireValue('2026-12-24T09:00:00.000Z')).toBe('2026-12-24T09:00:00.000Z');
    expect(fromWireValue({ __type: 'Date' })).toEqual({ __type: 'Date' });
    expect(fromWireValue(null)).toBeNull();
    expect(fromWireValue(7)).toBe(7);
  });
});

describe('§B — the sinks and the write', () => {
  test('B1 a Text on the column takes the non-string table: `String(x ?? \'\')`, the runtime Text’s own cast', () => {
    expect(home(app)).toContain("<p className={styles.text}>{String(taskRow?.due ?? '')}</p>");
  });

  test('B2 Date To String reads the column bare — `toDate` takes a Date', () => {
    expect(home(app)).toContain("<p className={styles.text}>{dateToString(taskRow?.due, '{year}-{month}-{date}', '')}</p>");
  });

  test('B3 a Now into the column writes the Date local, and it typechecks against `due?: Date`', () => {
    expect(home(app)).toContain('await createTask({ title, due: clock });');
    expect(home(app)).toContain('const [clock, setClock] = useState<Date>(() => new Date());');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('B4 CONTROL — the same column declared a String: string type, bare Text, and the Now write no longer typechecks', () => {
    const built = emitApp(retypeDue(cloneIr(), 'String'), catalog);
    expect(tasksApi(built)).toContain('  due?: string;');
    expect(home(built)).toContain("<p className={styles.text}>{taskRow?.due ?? ''}</p>");
    expect(home(built)).toContain('await createTask({ title, due: clock });');
    // A Date into a string column is a type error in the export — loud, where the interpreter would
    // send the ISO string. Registered in §48.3; the row pins that it is loud rather than silent.
    expect(typecheckEmittedApp(built).join('\n')).toContain("Type 'Date' is not assignable to type 'string'");
  });

  test('B5 CONTROL — the column undeclared: the graph-written type is `unknown`, the read coerces, and it typechecks', () => {
    const built = emitApp(retypeDue(cloneIr(), null), catalog);
    expect(tasksApi(built)).toContain('  due?: unknown;');
    expect(home(built)).toContain("{String(taskRow?.due ?? '')}");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§C — the wire contract, read from its two sources', () => {
  const REPO = path.join(__dirname, '..', '..', '..');
  test('C1 the backend wraps a stored Date column as the envelope on the way out', () => {
    const facade = fs.readFileSync(path.join(REPO, 'packages', 'nodegx-backend', 'src', 'persistence', 'AdapterFacade.ts'), 'utf8');
    expect(facade).toContain("} else if (col && col.type === 'Date' && typeof value === 'string') {\n        out[key] = { __type: 'Date', iso: value };");
  });
  test('C2 the interpreter reads the envelope as a Date, and sends one back', () => {
    const cloudstore = fs.readFileSync(path.join(REPO, 'packages', 'noodl-runtime', 'src', 'api', 'cloudstore.js'), 'utf8');
    expect(cloudstore).toContain("} else if (type === 'Date' && data.__type === 'Date') {\n    return new Date(data.iso);");
    expect(cloudstore).toContain("iso: data[key] instanceof Date ? data[key].toISOString() : data[key]");
  });
});

describe('§D — the fixture whole', () => {
  test('D1 the schema declares `due` a Date, and the app typechecks with and without a backend', () => {
    expect(baseIr.project.collections.find((c) => c.name === 'Task')!.columns.find((c) => c.name === 'due')!.type).toBe('Date');
    expect(typecheckEmittedApp(app)).toEqual([]);
    expect(typecheckEmittedApp(emitApp(withoutBackend(), catalog))).toEqual([]);
  });
});
