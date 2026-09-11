import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { idLibSource } from '../src/emit/idLib';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR } from '../src/ir/types';

/**
 * EXP-011 §37 — the id pair: `Unique Id` and `net.noodl.UUID`.
 *
 * Three halves, `string-math-utilities.test.ts`'s shape.
 *
 * §A is a **differential test**, and it is exact rather than statistical. Both generators are
 * random, so "the output looks like an id" is the assertion that cannot fail — a `randomId` that
 * drew from the wrong alphabet, or a UUID with the version nibble in the wrong byte, passes every
 * shape check anyone would think to write. So the entropy source is **pinned** instead: a seeded
 * `Math.random` for one and a fixed `getRandomValues` for the other, and then the emitted module
 * and the interpreter's own code must produce the **same string, character for character**.
 *
 * 🔴 **And the comparison is proved able to fail** (`date-family.test.ts`'s rule): a deliberately
 * broken copy of the emitted module must disagree, or "the two agree" is a reading that fits
 * rather than one that excludes.
 *
 * §B is the translation: graphs in, emitted code out, with every deferral asserted **by its named
 * reason** — a gate that fires for the wrong reason passes the weaker test.
 *
 * §C is the fixture (AC3), typechecked whole.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const BADGE_DESK = path.join(__dirname, 'fixtures', 'badge-desk');
const RUNTIME_SRC = path.join(__dirname, '..', '..', 'noodl-runtime', 'src');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

// ---- §A the emitted module, against the interpreter it has to agree with --------------------

interface IdLib {
  randomId(): string;
  tryRandomUuid(): { ok: true; uuid: string } | { ok: false; error: string };
  initialUuid(): string | undefined;
}

/** Transpile-and-load, the shape the two sibling suites use. */
const loadModule = (source: string, require: (id: string) => unknown = () => ({})): Record<string, unknown> => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, require);
  return module.exports;
};

/**
 * The emitted module, compiled and loaded.
 *
 * 🔴 The **artefact that ships**, not a copy kept beside the generator: a test against a second
 * copy of the same logic asserts only that both copies say the same thing.
 */
const loadIdLib = (source = idLibSource()): IdLib => loadModule(source) as unknown as IdLib;

const lib = loadIdLib();

/**
 * The interpreter's own code, transpiled from `noodl-runtime/src`.
 *
 * ⚠️ Transpiled rather than imported, for the reason the two sibling suites record: these files
 * do not typecheck under *this* package's tsconfig, and ts-jest refuses the whole suite over one
 * of them. `transpileModule` erases types without checking them.
 */
const loadRuntime = (rel: string, require?: (id: string) => unknown): Record<string, unknown> =>
  loadModule(fs.readFileSync(path.join(RUNTIME_SRC, rel), 'utf8'), require);

const weakRegistry = loadRuntime('weak-registry.ts');
const runtimeModel = loadRuntime('model.ts', (id) => (id.includes('weak-registry') ? weakRegistry : {})) as unknown as {
  guid(): string;
};
const runtimeCrypto = loadRuntime('nodes/std-library/crypto/encoding.ts') as unknown as {
  randomUuid(): string;
};

/** Runs `fn` with `Math.random` replaced by a deterministic sequence, then puts it back. */
const withSeededRandom = <T>(seed: number, fn: () => T): T => {
  const real = Math.random;
  let x = seed >>> 0;
  Math.random = () => {
    // A plain LCG. Its quality is irrelevant — what matters is that two callers drawing the same
    // number of values in the same order see the same values.
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return x / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

/** Runs `fn` with `globalThis.crypto` replaced, then puts it back. */
const withCrypto = <T>(replacement: unknown, fn: () => T): T => {
  const target = globalThis as unknown as { crypto?: unknown };
  const real = target.crypto;
  Object.defineProperty(target, 'crypto', { value: replacement, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(target, 'crypto', { value: real, configurable: true, writable: true });
  }
};

/**
 * A `getRandomValues` that fills a fixed, byte-position-dependent pattern, and **no**
 * `randomUUID` — so both implementations take the CSPRNG fallback, which is the branch where all
 * the arithmetic lives. A host that has `randomUUID` runs three lines and can hide nothing.
 */
const fixedBytes = {
  getRandomValues: <T extends ArrayBufferView>(array: T): T => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) & 0xff;
    return array;
  }
};

describe('EXP-011 §37 §A — the emitted generators, against the interpreter', () => {
  /**
   * 🔴 The row this section exists for. Both draw ten characters from the same alphabet using the
   * same index arithmetic, so on the same `Math.random` sequence they must produce the **same
   * ten characters**. An alphabet reordered, a length changed, or `Math.floor((1 + r) * 0x10000)`
   * "tidied" to `Math.floor(r * chars.length)` all break this and none of them break a shape test.
   */
  it('randomId is Model.guid(), character for character, on the same random sequence', () => {
    for (const seed of [1, 7, 12345, 999983]) {
      const mine = withSeededRandom(seed, () => lib.randomId());
      const theirs = withSeededRandom(seed, () => runtimeModel.guid());
      expect(mine).toBe(theirs);
    }
  });

  it('randomId is ten characters of the interpreter’s alphabet — and is not a UUID', () => {
    const drawn = Array.from({ length: 200 }, () => lib.randomId());
    for (const id of drawn) expect(id).toMatch(/^[A-Za-z0-9]{10}$/);
    // The two nodes must not collapse into one generator, which is the likeliest way this slice
    // is wrong and the one a length check alone would miss in the other direction.
    expect(drawn.some((id) => id.includes('-'))).toBe(false);
  });

  /**
   * 🔴 The same device for the UUID, and here it pins the byte surgery: the version nibble in
   * byte 6, the variant bits in byte 8, and the four hyphen positions.
   */
  it('randomUuid is encoding.ts’s randomUuid, character for character, on the same bytes', () => {
    const mine = withCrypto(fixedBytes, () => lib.tryRandomUuid());
    const theirs = withCrypto(fixedBytes, () => runtimeCrypto.randomUuid());
    expect(mine.ok).toBe(true);
    expect(mine.ok && mine.uuid).toBe(theirs);
    expect(theirs).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('randomUUID is preferred where the host has one, exactly as the interpreter prefers it', () => {
    const host = { randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', ...fixedBytes };
    expect(withCrypto(host, () => lib.tryRandomUuid())).toEqual({
      ok: true,
      uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    });
  });

  /**
   * The failure the node's Error output exists to print. ⚠️ The message is asserted **verbatim
   * against the interpreter's**, not merely as "some string": it is the only sentence that port
   * can ever carry, and an export that reworded it would be putting different text on screen
   * from the app it was exported from.
   */
  it('no CSPRNG is the one failure, and the message is the interpreter’s own', () => {
    const theirMessage = withCrypto({}, () => {
      try {
        runtimeCrypto.randomUuid();
        return '(the interpreter did not throw)';
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    });
    const mine = withCrypto({}, () => lib.tryRandomUuid());
    expect(mine.ok).toBe(false);
    expect(mine.ok === false && mine.error).toBe(theirMessage);
    expect(theirMessage).toContain('crypto.getRandomValues is missing');
  });

  /** `initialize` swallows: a host with no CSPRNG boots the row `undefined` and says nothing. */
  it('initialUuid answers undefined rather than throwing, as initialize does', () => {
    expect(withCrypto({}, () => lib.initialUuid())).toBeUndefined();
    expect(withCrypto(fixedBytes, () => lib.initialUuid())).toBe(withCrypto(fixedBytes, () => runtimeCrypto.randomUuid()));
  });

  /**
   * 🔴 **The control that makes the four agreements above mean something.** A deliberately broken
   * copy of the emitted module — the version nibble left unset — must disagree with the
   * interpreter. Without this, "the two agree" is consistent with a comparison that cannot fail.
   */
  it('a broken copy of the emitted module disagrees, so the comparison can fail', () => {
    const broken = loadIdLib(idLibSource().replace('bytes[6] = (bytes[6] & 0x0f) | 0x40;', ''));
    const theirs = withCrypto(fixedBytes, () => runtimeCrypto.randomUuid());
    const mine = withCrypto(fixedBytes, () => broken.tryRandomUuid());
    expect(mine.ok && mine.uuid).not.toBe(theirs);
  });
});

// ---- §B the translation ---------------------------------------------------------------------

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
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

/** Every emitted file is parsed — the `}; else` floor. */
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

const withIds = (
  build: (ir: ExportIR, notes: ComponentIR) => void
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
  build(ir, notes);
  return { ir, app: emit(ir) };
};

/** A `Unique Id` whose Id renders and whose New is fired by the page's Add button. */
const uniqueIdGraph = (notes: ComponentIR) => {
  addNode(notes, { id: 'rowKey', type: 'Unique Id', authoredLabel: 'Row key' });
  connect(notes, 'rowKey', 'guid', 'notesHeading', 'text');
  connect(notes, 'addButton', 'onClick', 'rowKey', 'new', 'signal');
};

/** The same for a `UUID`. */
const uuidGraph = (notes: ComponentIR) => {
  addNode(notes, { id: 'recordId', type: 'net.noodl.UUID', authoredLabel: 'Record id' });
  connect(notes, 'recordId', 'uuid', 'notesHeading', 'text');
  connect(notes, 'addButton', 'onClick', 'recordId', 'generate', 'signal');
};

describe('EXP-011 §37 §B — the translation', () => {
  it('an unwired Unique Id is the id it constructed, seeded by a lazy initializer', () => {
    const { app } = withIds((_ir, notes) => {
      addNode(notes, { id: 'rowKey', type: 'Unique Id', authoredLabel: 'Row key' });
      connect(notes, 'rowKey', 'guid', 'notesHeading', 'text');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain("import { randomId } from '../lib/id';");
    expect(page).toContain('const [rowKey, setRowKey] = useState<string>(() => randomId());');
    expect(app.files['src/lib/id.ts']).toContain('export function randomId');
    // A project generating ids should not ship the date or string libraries.
    expect(app.files['src/lib/date.ts']).toBeUndefined();
    expect(app.files['src/lib/util.ts']).toBeUndefined();
  });

  /**
   * 🔴 **The lazy initializer, asserted as a lazy one.** `useState(randomId())` is a valid
   * program that renders the same id, so nothing observable in a driven app separates the two —
   * only the emitted text does. It is what the interpreter's once-per-construction `initialize`
   * is, and the eager form draws from the CSPRNG on every render.
   */
  it('the row boots lazily, never eagerly', () => {
    const { app } = withIds((_ir, notes) => uuidGraph(notes));
    const page = notesFile(app);
    expect(page).toContain('useState<string | undefined>(() => initialUuid())');
    expect(page).not.toContain('useState<string | undefined>(initialUuid())');
  });

  /**
   * 🔴 The chain-local, which is the row the driven app's sabotage arm B also grades. A read of
   * `Id` from the node's own Done chain must be the binding the action just made — `setRowKey`
   * does not change `rowKey` inside the closure that called it, so the row would deliver the
   * *previous* id, and a previous id is a real, plausible-looking id.
   */
  it('a read of Id from the Done chain is the chain-local, not the row', () => {
    const { app } = withIds((_ir, notes) => {
      uniqueIdGraph(notes);
      addNode(notes, {
        id: 'saveKey',
        type: 'Set Variable',
        authoredLabel: 'Save key',
        parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastKey' } }]
      });
      connect(notes, 'rowKey', 'done', 'saveKey', 'do', 'signal');
      connect(notes, 'rowKey', 'guid', 'saveKey', 'value');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('const rowKeyNew = randomId();');
    expect(page).toContain('setRowKey(rowKeyNew);');
    expect(page).toContain('lastKey.set(rowKeyNew);');
    expect(page).not.toContain('lastKey.set(rowKey);');
  });

  /**
   * The `UuidResult` branch. ⚠️ `.uuid` narrows to `string` only inside `if (…ok)`, which is why
   * the local binds the whole result rather than the id.
   */
  it('a UUID New branches on the result, and the Done arm reads .uuid', () => {
    const { app } = withIds((_ir, notes) => {
      uuidGraph(notes);
      addNode(notes, {
        id: 'saveRecord',
        type: 'Set Variable',
        authoredLabel: 'Save record',
        parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastRecord' } }]
      });
      connect(notes, 'recordId', 'done', 'saveRecord', 'do', 'signal');
      connect(notes, 'recordId', 'uuid', 'saveRecord', 'value');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('const recordIdNew = tryRandomUuid();');
    expect(page).toContain('if (recordIdNew.ok) {');
    expect(page).toContain('lastRecord.set(recordIdNew.uuid);');
  });

  /**
   * 🔴 **The clear, which the driven app cannot grade.** Sabotaging this line changed nothing in
   * the browser — the failure never fires where there is a CSPRNG — so the drive is silent about
   * it and this row is the only thing that grades it. `_generate` sets `_internal.error =
   * undefined` before reporting Done, and an export that only ever *wrote* the message would
   * leave a failure's text on screen through every subsequent success.
   *
   * ⚠️ This is where the node stops copying `External Link`, whose `lastError` is never cleared.
   */
  it('a successful New clears the Error row, unlike External Link’s', () => {
    const { app } = withIds((_ir, notes) => {
      uuidGraph(notes);
      // ⚠️ Added to the shell's `children` as well as given a `parent`. A node with only a
      // parent is not in the render tree, so the read lands in nothing, the row is never
      // allocated and this row would pass its `not.toContain` half while testing nothing.
      addNode(notes, { id: 'errorText', type: 'Text', authoredLabel: 'Problem', parent: 'notesShell' });
      notes.nodes.find((n) => n.id === 'notesShell')!.children!.push('errorText');
      connect(notes, 'recordId', 'error', 'errorText', 'text');
    });
    const page = notesFile(app);
    expect(page).toContain('setRecordIdError(undefined);');
    expect(page).toContain('setRecordIdError(recordIdNew.error);');
    // The Error row is named for what it holds, not `recordId2`.
    expect(page).toContain('const [recordIdError, setRecordIdError] = useState<string | undefined>();');
  });

  /**
   * 🔴 **The fold, as a control pair — and the pair is what makes it grade anything.** A `UUID`'s
   * Id row is `undefined` on a host with no CSPRNG and folds with `?? ''`; a `Unique Id`'s cannot
   * be, and must stay bare. Asserting only the first would pass on an emitter that folded every
   * id read, which is the same mistake in the other direction.
   *
   * ⚠️ Found by a surviving mutant. React renders `undefined` as nothing, so **no driven row and
   * no typecheck can see this** — dropping the fold is invisible until the same read reaches a
   * format, where it prints the text "undefined".
   */
  it('a UUID’s Id folds with ?? and a Unique Id’s does not', () => {
    const uuid = withIds((_ir, notes) => uuidGraph(notes));
    expect(notesFile(uuid.app)).toContain("{recordId ?? ''}");

    const unique = withIds((_ir, notes) => uniqueIdGraph(notes));
    const page = notesFile(unique.app);
    expect(page).toContain('{rowKey}');
    expect(page).not.toContain("{rowKey ?? ''}");
  });

  /** A UUID nobody asks a message from allocates no Error row, and clears nothing. */
  it('the Error row is allocated by a read, so the common shape has neither row nor clear', () => {
    const { app } = withIds((_ir, notes) => uuidGraph(notes));
    const page = notesFile(app);
    expect(page).not.toContain('setRecordIdError');
    expect(page).not.toContain('recordIdError');
  });

  /**
   * 🔴 §14/§24's rule, and the diagonal that makes this node different: in the **Failure** arm
   * `Id` was not written, so the faithful read is the row — and the local has no `.uuid` on it.
   */
  it('a read of Id from the Failure arm is the row, and Error there is the arm’s own binding', () => {
    const { app } = withIds((_ir, notes) => {
      uuidGraph(notes);
      addNode(notes, {
        id: 'saveFailure',
        type: 'Set Variable',
        authoredLabel: 'Save failure',
        parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastFailure' } }]
      });
      connect(notes, 'recordId', 'failure', 'saveFailure', 'do', 'signal');
      connect(notes, 'recordId', 'error', 'saveFailure', 'value');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('lastFailure.set(recordIdNew.error);');
    expect(page).not.toContain('lastFailure.set(recordIdNew.uuid.error);');
  });

  /**
   * 🔴 The refusal §37 added that `External Link` does not have. `_generate` clears the message
   * before Done fires, so a read of `Error` from the Done chain is *always* empty — and copying
   * §24's "read the stale row here" would print a message the running app has just erased.
   */
  it('a read of Error from the Done chain is refused, by name', () => {
    const { app } = withIds((_ir, notes) => {
      uuidGraph(notes);
      addNode(notes, {
        id: 'saveErr',
        type: 'Set Variable',
        authoredLabel: 'Save err',
        parameters: [{ name: 'name', value: { kind: 'literal', value: 'lastErr' } }]
      });
      connect(notes, 'recordId', 'done', 'saveErr', 'do', 'signal');
      connect(notes, 'recordId', 'error', 'saveErr', 'value');
    });
    expect(reportOf(app)).toContain(
      'its Error is read from its own Done chain — the node clears the message before Done fires, so that read is always empty'
    );
  });

  /**
   * `Completed` defers on both nodes, and with **different sentences**. `Unique Id` has one
   * outcome and its own catalog description says Completed and Done always fire together, so the
   * reason names the one-move fix instead of the generic join sentence.
   */
  it('Completed defers, and Unique Id’s reason names the one-move fix', () => {
    const unique = withIds((_ir, notes) => {
      uniqueIdGraph(notes);
      connect(notes, 'rowKey', 'completed', 'makeNote', 'new', 'signal');
    });
    expect(reportOf(unique.app)).toContain('wire the chain to Done instead and it translates unchanged');

    const uuid = withIds((_ir, notes) => {
      uuidGraph(notes);
      connect(notes, 'recordId', 'completed', 'makeNote', 'new', 'signal');
    });
    expect(reportOf(uuid.app)).toContain(
      'its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them'
    );
  });

  /** A pulse read as a value is not a value, on `Now`'s sentence. */
  it('Done read as a value defers, by name', () => {
    const { app } = withIds((_ir, notes) => {
      addNode(notes, { id: 'rowKey', type: 'Unique Id', authoredLabel: 'Row key' });
      connect(notes, 'rowKey', 'done', 'notesHeading', 'text');
    });
    expect(reportOf(app)).toContain('its Done output is consumed as a value — a pulse carries nothing to read');
  });

  /**
   * 🔴 **The row that grades whether the read is declared, not merely written** (§24.3). Every
   * other emitted-code assertion here is a parse, and an undeclared identifier is good syntax.
   */
  it('every emitted file typechecks, so a row that is read is also declared', () => {
    const { app } = withIds((_ir, notes) => {
      uniqueIdGraph(notes);
      uuidGraph(notes);
    });
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});

// ---- §C the fixture --------------------------------------------------------------------------

describe('EXP-011 §37 §C — badge-desk', () => {
  const app = emitApp(parseProject(BADGE_DESK, catalog), catalog);

  it('exports with nothing dropped beyond the router shell, and typechecks whole', () => {
    const attention = app.notes.filter((n) => !n.includes('router shell'));
    expect(attention).toEqual([]);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('emits both generators, and each node uses its own', () => {
    const page = app.files['src/pages/Badge.tsx'];
    expect(page).toContain("import { initialUuid, randomId, tryRandomUuid } from '../lib/id';");
    expect(page).toContain('const rowKeyNew = randomId();');
    expect(page).toContain('const recordIdNew = tryRandomUuid();');
    // 🔴 The two nodes must not collapse into one generator — the shape sabotage arm A produced.
    expect(page).not.toContain('const rowKeyNew = tryRandomUuid();');
  });
});
