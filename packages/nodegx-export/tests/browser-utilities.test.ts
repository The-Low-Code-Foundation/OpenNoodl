import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { CRYPTO_LIB_PATH, cryptoLibSource } from '../src/emit/cryptoLib';
import { SCREEN_LIB_PATH, screenLibSource } from '../src/emit/screenLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §59 — `Hash` (`net.noodl.Hash`), `Random Bytes` (`net.noodl.RandomBytes`) and `Screen Resolution`,
 * Tier 2.8 row 9: three browser APIs, two emitted libs.
 *
 * Built on `tests/fixtures/utility-desk`: a text input feeds a Variable that feeds Hash's Value; a button fires
 * Do (SHA-256, hex); Digest and Error are bound to Texts and the Done / Failure chains remember the digest or
 * the reason in two more Variables; a second button draws a 16-byte base64url nonce into a Text; a Screen
 * Resolution's three outputs are three Texts. Every refused shape lives here by mutation (§52.4.2's rule) and
 * asserts the NAMED sentence.
 *
 * 🔴 The reverted arm (`probe-reverted.log`, HEAD 042f221c) read the three nodes as `logic node (…)`, the two
 * Set Variables silenced behind Hash (asked from the value side, as §54.2 found), 13 refusals, no pathway. §F
 * pins what building it found: the text-sink fold's NINTH by-hand instance (`{hash}` rendered bare beside
 * `{hashError ?? ''}`), and a Variable feeding an input is read in the handler as `.get()`, not as the render local.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'utility-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const disconnect = (component: ComponentIR, predicate: (c: ConnectionIR) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const home = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
const refusalOf = (source: ExportIR, nodeId: string): string | undefined => planOf(source, HOME).refusals.find((r) => r.nodeId === nodeId)?.reason;

const HASH_RAISE = "raiseAppError({ code: 'hash/failed', message: hashResult.error, nodeId: 'hash', nodeType: 'net.noodl.Hash', componentName: '/Pages/Home' });";
const NONCE_RAISE = "raiseAppError({ code: 'random-bytes/failed', message: nonceResult.error, nodeId: 'nonce', nodeType: 'net.noodl.RandomBytes', componentName: '/Pages/Home' });";

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — Variable → Hash on a button, a nonce on a button, the viewport in three Texts', () => {
  const homePlan = project.plans.find((p) => p.path === HOME)!;

  test('A1 nothing refused: the only note is the router shell, 16 files, both libs among them', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(homePlan.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).whole).toEqual(['Pages/Home']);
    expect(Object.keys(app.files)).toHaveLength(16);
    expect(app.files[CRYPTO_LIB_PATH]).toContain('export async function tryHash(');
    expect(app.files[CRYPTO_LIB_PATH]).toContain('export function tryRandomBytes(');
    expect(app.files[SCREEN_LIB_PATH]).toContain('export function useScreenResolution(): ScreenResolution {');
    expect(home(app)).not.toContain('TODO(export)');
    for (const id of ['hash', 'nonce', 'screen']) expect(homePlan.dispositions[id]).toEqual({ kind: 'collapsed', into: HOME_FILE });
  });

  test('A2 the emitted app typechecks as a real program', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('A3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${d.messageText}`)).toEqual([]);
    }
  });

  test('A4 the imports — the two verbs, the raise, the hook — and the rows, each allocated by a read', () => {
    const src = home(app);
    expect(src).toContain("import { tryHash, tryRandomBytes } from '../lib/crypto';");
    expect(src).toContain("import { raiseAppError } from '../lib/errors';");
    expect(src).toContain("import { useScreenResolution } from '../lib/screen';");
    expect(src).toContain('const [hash, setHash] = useState<string | undefined>();');
    expect(src).toContain('const [hashError, setHashError] = useState<string | undefined>();');
    expect(src).toContain('const [nonce, setNonce] = useState<string | undefined>();');
    // The nonce's Error is read by nothing: no row, no clearing setter (§14.2's rule).
    expect(src).not.toContain('nonceError');
    expect(src).toContain('const viewport = useScreenResolution();');
    // The import block prints before the body: the imports are earned in the walkers, not in exprCode.
    expect(src.indexOf("from '../lib/crypto'")).toBeLessThan(src.indexOf('export function HomePage'));
  });

  test('A5 the Hash button: async, the await, the Variable read in the handler, the two arms in the runtime\'s order', () => {
    const src = home(app);
    expect(src).toContain(
      [
        '        onClick={async () => {',
        "          const hashResult = await tryHash(plaintext.get(), 'SHA-256', 'hex');",
        '          if (hashResult.ok) {',
        '            setHash(hashResult.digest);',
        '            setHashError(undefined);',
        '            lastDigest.set(hashResult.digest);',
        '          } else {',
        '            setHashError(hashResult.error);',
        `            ${HASH_RAISE}`,
        '            hashFailed.set(hashResult.error);',
        '          }',
        '        }}'
      ].join('\n')
    );
  });

  test('A6 the nonce button: synchronous, no chain, no Error row — and the Failure arm still raises', () => {
    const src = home(app);
    expect(src).toContain(
      [
        '        onClick={() => {',
        "          const nonceResult = tryRandomBytes(16, 'base64url');",
        '          if (nonceResult.ok) {',
        '            setNonce(nonceResult.value);',
        '          } else {',
        `            ${NONCE_RAISE}`,
        '          }',
        '        }}'
      ].join('\n')
    );
    expect(src).not.toContain('await tryRandomBytes');
  });

  test('A7 the bindings: the three maybe-undefined rows fold, the three viewport numbers print off the handle', () => {
    const src = home(app);
    expect(src).toContain("{hash ?? ''}");
    expect(src).toContain("{hashError ?? ''}");
    expect(src).toContain("{nonce ?? ''}");
    expect(src).toContain('{viewport.width}');
    expect(src).toContain('{viewport.height}');
    expect(src).toContain('{viewport.aspectRatio}');
  });

  test('A8 the ledger rows moved, so the three picker cards carry no badge; the floor is 105', () => {
    for (const type of ['net.noodl.Hash', 'net.noodl.RandomBytes', 'Screen Resolution']) {
      expect(ledgerEntryOf(type)?.status).toBe('translated');
      expect(exportBadgeOf(type)).toBeUndefined();
    }
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(111); // §60 the component-object trio + §62 the relation pair + §63 Drag (session 86); §57 + §58 + §59 (session 85)
  });
});

// ---------------------------------------------------------------------------------------------------
// §B — the crypto verbs under node, against the REAL WebCrypto (node has globalThis.crypto.subtle and
// getRandomValues). Pinned answers are the standard vectors; the failure sentences are encoding.ts's own.
// ---------------------------------------------------------------------------------------------------
type CryptoLib = {
  tryHash: (value: unknown, algorithm: unknown, encoding: unknown) => Promise<{ ok: true; digest: string } | { ok: false; error: string }>;
  tryRandomBytes: (length: unknown, encoding: unknown) => { ok: true; value: string } | { ok: false; error: string };
};
const loadCrypto = (): CryptoLib => {
  const js = ts.transpileModule(cryptoLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as CryptoLib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(() => ({}), module, module.exports);
  return module.exports;
};
/** Swap `globalThis.crypto` for the duration of `fn` — the lib reads it at call time (`hostCrypto`). */
const withCrypto = async <T>(replacement: unknown, fn: () => Promise<T> | T): Promise<T> => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { value: replacement, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
};
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('§B tryHash — hash.ts `_run` and encoding.ts, graded on digests', () => {
  const { tryHash } = loadCrypto();

  test('B1 SHA-256("abc") in the three encodings', async () => {
    expect(await tryHash('abc', 'SHA-256', 'hex')).toEqual({ ok: true, digest: SHA256_ABC });
    expect(await tryHash('abc', 'SHA-256', 'base64')).toEqual({ ok: true, digest: 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=' });
    expect(await tryHash('abc', 'SHA-256', 'base64url')).toEqual({ ok: true, digest: 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0' });
  });

  test('B2 SHA-384 and SHA-512 are the other two algorithms', async () => {
    const sha384 = await tryHash('abc', 'SHA-384', 'hex');
    const sha512 = await tryHash('abc', 'SHA-512', 'hex');
    expect(sha384).toMatchObject({ ok: true });
    expect(sha512).toMatchObject({ ok: true });
    expect((sha384 as { digest: string }).digest).toMatch(/^cb00753f45a35e8b[0-9a-f]{80}$/);
    expect((sha512 as { digest: string }).digest).toMatch(/^ddaf35a193617aba[0-9a-f]{112}$/);
  });

  test('B3 the fallbacks are `||`: an unset or cleared field is the default, and the empty string hashes as the empty string', async () => {
    expect(await tryHash('abc', undefined, undefined)).toEqual({ ok: true, digest: SHA256_ABC });
    expect(await tryHash('abc', '', '')).toEqual({ ok: true, digest: SHA256_ABC });
    expect(await tryHash('', 'SHA-256', 'hex')).toEqual({ ok: true, digest: SHA256_EMPTY });
    expect(await tryHash(undefined, 'SHA-256', 'hex')).toEqual({ ok: true, digest: SHA256_EMPTY });
    // A number over a wire is its decimal text, as TextEncoder would read it.
    expect(await tryHash(123, 'SHA-256', 'hex')).toEqual(await tryHash('123', 'SHA-256', 'hex'));
  });

  test('B4 UTF-8, not UTF-16: a non-ASCII value hashes its UTF-8 bytes (0xC3 0xA9) — node\'s own createHash is the second instrument', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as { createHash: (a: string) => { update: (s: string, enc: string) => { digest: (e: string) => string } } };
    const expected = nodeCrypto.createHash('sha256').update('é', 'utf8').digest('hex');
    expect(expected).toBe('4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c');
    expect(await tryHash('é', 'SHA-256', 'hex')).toEqual({ ok: true, digest: expected });
    // The same string hashed as UTF-16 code units would differ — the control that says the row measures encoding.
    expect(nodeCrypto.createHash('sha256').update('é', 'utf16le').digest('hex')).not.toBe(expected);
  });

  test('B5 an algorithm WebCrypto has not got is a failure, not a default — MD5 and SHA-1 stay absent', async () => {
    const md5 = await tryHash('abc', 'MD5', 'hex');
    expect(md5.ok).toBe(false);
    expect((md5 as { error: string }).error.length).toBeGreaterThan(0);
  });

  test('B6 an unknown encoding is encoding.ts\'s own sentence', async () => {
    expect(await tryHash('abc', 'SHA-256', 'binary')).toEqual({ ok: false, error: 'Unknown encoding "binary". Use hex, base64 or base64url.' });
  });

  test('B7 no crypto.subtle: the secure-context sentence, verbatim, from the synchronous throw', async () => {
    const answer = await withCrypto({ getRandomValues: () => new Uint8Array(0) }, () => tryHash('abc', 'SHA-256', 'hex'));
    expect(answer).toEqual({
      ok: false,
      error:
        'WebCrypto is not available here. In a browser, crypto.subtle only exists in a secure context — serve the page over HTTPS (or from localhost). In a cloud function it is always present.'
    });
    const none = await withCrypto(undefined, () => tryHash('abc', 'SHA-256', 'hex'));
    expect(none.ok).toBe(false);
  });

  test('B8 a rejected digest lands as the failure too (the promise path, not the synchronous one)', async () => {
    const rejecting = { subtle: { digest: () => Promise.reject(new Error('digest refused')) } };
    expect(await withCrypto(rejecting, () => tryHash('abc', 'SHA-256', 'hex'))).toEqual({ ok: false, error: 'digest refused' });
  });
});

describe('§B′ tryRandomBytes — randombytes.ts `_generate` and encoding.ts, graded on blocks', () => {
  const { tryRandomBytes } = loadCrypto();

  test('B9 16 bytes is 32 hex characters; two draws differ', () => {
    const a = tryRandomBytes(16, 'hex');
    const b = tryRandomBytes(16, 'hex');
    expect(a).toMatchObject({ ok: true });
    expect((a as { value: string }).value).toMatch(/^[0-9a-f]{32}$/);
    expect((a as { value: string }).value).not.toBe((b as { value: string }).value);
  });

  test('B10 only "never set" takes the default of 32 — `undefined`, not a falsy Length', () => {
    const answer = tryRandomBytes(undefined, undefined);
    expect((answer as { value: string }).value).toMatch(/^[0-9a-f]{64}$/);
    expect(tryRandomBytes(0, 'hex')).toEqual({ ok: false, error: 'Random Bytes: Length must be a whole number from 1 to 4096, and was 0.' });
  });

  test('B11 the range gate: 4097, 1.5, NaN and a coerced non-number all fail with the sentence; 1 and 4096 pass', () => {
    expect(tryRandomBytes(4097, 'hex')).toEqual({ ok: false, error: 'Random Bytes: Length must be a whole number from 1 to 4096, and was 4097.' });
    expect(tryRandomBytes(1.5, 'hex')).toEqual({ ok: false, error: 'Random Bytes: Length must be a whole number from 1 to 4096, and was 1.5.' });
    expect(tryRandomBytes(Number('abc'), 'hex')).toEqual({ ok: false, error: 'Random Bytes: Length must be a whole number from 1 to 4096, and was NaN.' });
    expect((tryRandomBytes(1, 'hex') as { value: string }).value).toMatch(/^[0-9a-f]{2}$/);
    expect((tryRandomBytes(4096, 'hex') as { value: string }).value).toMatch(/^[0-9a-f]{8192}$/);
  });

  test('B12 base64 keeps its padding, base64url drops it and swaps the two URL-unsafe characters', () => {
    const b64 = (tryRandomBytes(16, 'base64') as { value: string }).value;
    const url = (tryRandomBytes(16, 'base64url') as { value: string }).value;
    expect(b64).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(url).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // `|| 'hex'`: an unset or cleared Encoding is hex; an unknown one is the sentence.
    expect((tryRandomBytes(8, '') as { value: string }).value).toMatch(/^[0-9a-f]{16}$/);
    expect(tryRandomBytes(8, 'binary')).toEqual({ ok: false, error: 'Unknown encoding "binary". Use hex, base64 or base64url.' });
  });

  test('B13 no getRandomValues: encoding.ts\'s sentence, verbatim — never Math.random()', async () => {
    const answer = await withCrypto({}, () => tryRandomBytes(16, 'hex'));
    expect(answer).toEqual({
      ok: false,
      error: 'No cryptographic random source is available here (crypto.getRandomValues is missing). This node will not fall back to Math.random().'
    });
  });
});

// ---------------------------------------------------------------------------------------------------
// §C — the viewport hook under node: a fake React (useState + useEffect, the effect run after the render
// that declared it) and a fake window whose listeners the test fires.
// ---------------------------------------------------------------------------------------------------
type Viewport = { width: number; height: number; aspectRatio: number };
type ScreenLib = { useScreenResolution: () => Viewport };
interface FakeWindow {
  innerWidth: number;
  innerHeight: number;
  listeners: Map<string, Set<() => void>>;
  addEventListener(name: string, fn: () => void): void;
  removeEventListener(name: string, fn: () => void): void;
  resize(width: number, height: number): void;
}
const makeWindow = (width: number, height: number): FakeWindow => {
  const w: FakeWindow = {
    innerWidth: width,
    innerHeight: height,
    listeners: new Map(),
    addEventListener(name, fn) {
      if (!w.listeners.has(name)) w.listeners.set(name, new Set());
      w.listeners.get(name)!.add(fn);
    },
    removeEventListener(name, fn) {
      w.listeners.get(name)?.delete(fn);
    },
    resize(nextWidth, nextHeight) {
      w.innerWidth = nextWidth;
      w.innerHeight = nextHeight;
      for (const fn of w.listeners.get('resize') ?? []) fn();
    }
  };
  return w;
};
interface ScreenHarness {
  render(): Viewport;
  unmount(): void;
  renders: number;
}
const loadScreen = (fakeWindow: FakeWindow): { lib: ScreenLib; harness: ScreenHarness } => {
  const slots: unknown[] = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: () => void }> = [];
  let cursor = 0;
  let pending: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }> = [];
  let dirty = false;
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    useState: (init: unknown) => {
      const i = cursor++;
      if (slots[i] === undefined) slots[i] = { value: typeof init === 'function' ? (init as () => unknown)() : init };
      const slot = slots[i] as { value: unknown };
      return [
        slot.value,
        (next: unknown) => {
          slot.value = next;
          dirty = true;
        }
      ];
    },
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
      pending.push({ slot: cursor++, fn, deps });
    }
  };
  const js = ts.transpileModule(screenLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as ScreenLib };
  // The lib reads the global `window`; the sandbox supplies it as a parameter, shadowing node's absence of one.
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', 'window', js)(
    (name: string) => {
      if (name !== 'react') throw new Error(`unexpected import ${name}`);
      return React;
    },
    module,
    module.exports,
    fakeWindow
  );
  const harness: ScreenHarness = {
    renders: 0,
    render() {
      let out!: Viewport;
      do {
        dirty = false;
        cursor = 0;
        pending = [];
        harness.renders++;
        out = module.exports.useScreenResolution();
        for (const e of pending) {
          const prev = effects[e.slot];
          if (prev !== undefined && same(prev.deps, e.deps)) continue;
          prev?.cleanup?.();
          const cleanup = e.fn();
          effects[e.slot] = { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
        }
      } while (dirty);
      return out;
    },
    unmount() {
      for (const e of effects) e?.cleanup?.();
    }
  };
  return { lib: module.exports, harness };
};

describe('§C useScreenResolution runs the way screenresolution.ts does (hook harness under node)', () => {
  test('C1 the mount read: width, height, and width divided by height', () => {
    const { harness } = loadScreen(makeWindow(1280, 800));
    expect(harness.render()).toEqual({ width: 1280, height: 800, aspectRatio: 1.6 });
  });

  test('C2 one resize listener per hook, subscribed after the first render, and every resize re-reads all three', () => {
    const w = makeWindow(1280, 800);
    const { harness } = loadScreen(w);
    harness.render();
    expect(w.listeners.get('resize')?.size).toBe(1);
    w.resize(400, 800);
    expect(harness.render()).toEqual({ width: 400, height: 800, aspectRatio: 0.5 });
    // A second render does not add a second listener (deps `[]`).
    harness.render();
    expect(w.listeners.get('resize')?.size).toBe(1);
  });

  test('C3 unmount removes the listener — NDA-012 H1, the leak the node fixed', () => {
    const w = makeWindow(1280, 800);
    const { harness } = loadScreen(w);
    harness.render();
    harness.unmount();
    expect(w.listeners.get('resize')?.size).toBe(0);
  });

  test('C4 the getter\'s arithmetic, not a guarded one: a zero-height viewport answers Infinity', () => {
    const { harness } = loadScreen(makeWindow(1280, 0));
    expect(harness.render().aspectRatio).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the refused shapes, by mutation — each sentence exact', () => {
  test('D1 Completed wired: UUID\'s sentence, and the node is refused whole', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'hash', 'completed', 'setLastDigest', 'do');
    expect(refusalOf(ir, 'hash')).toBe('its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them');
  });

  test('D2 Error read from its own Done chain: the node clears it before Done fires', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.fromId === 'hash' && w.fromProperty === 'digest' && w.toId === 'setLastDigest');
    connect(c, 'hash', 'error', 'setLastDigest', 'value', 'value');
    expect(refusalOf(ir, 'hash')).toBe('its Error is read from its own Done chain — the node clears the message before Done fires, so that read is always empty');
  });

  test('D3 an output the node has not got', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'nonce', 'bytes', 'nonceText', 'text', 'value');
    expect(refusalOf(ir, 'nonce')).toBe('its bytes output is not a port this node has');
  });

  test('D4 an input the node has not got', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'plainVar', 'value', 'nonce', 'salt', 'value');
    expect(refusalOf(ir, 'nonce')).toBe('its salt input is not a port this node has');
  });

  test('D5 two wires on one input — last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'lastDigestVar', 'value', 'hash', 'value', 'value');
    expect(refusalOf(ir, 'hash')).toBe('two wires feed its Value input — last-writer-wins is not statically ordered');
  });

  test('D6 Done consumed as a value: a pulse carries nothing to read', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.fromId === 'nonce' && w.fromProperty === 'value');
    connect(c, 'nonce', 'done', 'nonceText', 'text', 'value');
    // Decided from the sink's port kind BEFORE the chain compiles (§52.4): the first build let the chain compiler
    // name it first — "its done output drives no translatable action" — true of the wire, silent about the mistake.
    expect(refusalOf(ir, 'nonce')).toBe('its Done output is consumed as a value — a pulse carries nothing to read');
  });

  test('D7 Value read while nothing is wired to New: no random bytes are ever generated (§56 E1: a row nothing writes)', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (w) => w.toId === 'nonce' && w.toProperty === 'generate');
    expect(notesOf(ir)).toContain('its Value is read, but nothing fires its New — no random bytes are ever generated');
    expect(home(emitApp(ir, catalog))).not.toContain('setNonce');
  });

  test('D8 Digest read while nothing is wired to Do: no digest is ever computed — and the node is refused ONCE, with the first read\'s sentence', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (w) => w.toId === 'hash' && w.toProperty === 'hash');
    expect(refusalOf(ir, 'hash')).toBe('its Digest is read, but nothing fires its Do — no digest is ever computed');
    // The Error read that follows is dropped under the node's existing disposition, not re-explained.
    expect(planOf(ir, HOME).refusals.filter((r) => r.nodeId === 'hash')).toHaveLength(1);
    expect(home(emitApp(ir, catalog))).not.toContain('tryHash(');
  });

  test('D8b only the Error read, nothing wired to Do: the sentence names Error', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'hash');
    disconnect(c, (w) => w.fromId === 'hash' && w.fromProperty !== 'error');
    expect(refusalOf(ir, 'hash')).toBe('its Error is read, but nothing fires its Do — no digest is ever computed');
  });

  test('D9 Do wired from a trigger the attach pass cannot take: the attach pass names it first', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'hash');
    // A Delay nothing starts: its Finished is not a rendered element event or a receiver, and the attach pass
    // says so before any read can — the design predicted "never fired by a translatable trigger"; that sentence
    // is the COMPILED-but-unattached case, which D9b builds.
    addNode(c, { id: 'idle', type: 'Delay', parameters: [{ name: 'duration', value: { kind: 'literal', value: 100 } }] });
    connect(c, 'idle', 'finished', 'hash', 'hash');
    expect(refusalOf(ir, 'hash')).toBe('trigger idle.finished is not a rendered element event or a receiver');
    expect(home(emitApp(ir, catalog))).not.toContain('tryHash(');
  });

  test('D9b Do wired from a Value Changed nothing feeds: the Do compiled, nothing attached it, and every read says so', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'hash');
    addNode(c, { id: 'onChange', type: 'Value Changed', parameters: [] });
    connect(c, 'onChange', 'valueChanged', 'hash', 'hash');
    expect(refusalOf(ir, 'hash')).toBe('its Do is never fired by a translatable trigger');
    expect(refusalOf(ir, 'onChange')).toBe('nothing is wired into Input — the node never receives a value, so it never fires');
    expect(home(emitApp(ir, catalog))).not.toContain('tryHash(');
  });

  test('D10 a text input wired straight into Value: the read is legal only inside the input\'s own handler', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'value');
    connect(c, 'plainInput', 'text', 'hash', 'value', 'value');
    const reason = refusalOf(ir, 'hash');
    expect(reason).toBeDefined();
    expect(home(emitApp(ir, catalog))).not.toContain('tryHash(');
  });

  test('D11 Screen Resolution: a wire INTO it names the port it has not got', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'nonceBtn', 'onClick', 'screen', 'refresh');
    expect(refusalOf(ir, 'screen')).toBe('its refresh input is not a port this node has');
  });

  test('D12 Screen Resolution: a wire off a port it has not got refuses the node whole', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'screen', 'dpr', 'nonceText', 'text', 'value');
    expect(refusalOf(ir, 'screen')).toBe('its dpr output is consumed, and this node has no such port');
    expect(home(emitApp(ir, catalog))).not.toContain('useScreenResolution');
  });

  test('D13 Screen Resolution read by nothing: the date sweep\'s sentence, and no hook prints', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (w) => w.fromId === 'screen');
    expect(refusalOf(ir, 'screen')).toBe('its answer is read by nothing statically translatable');
    expect(home(emitApp(ir, catalog))).not.toContain('useScreenResolution');
    expect(emitApp(ir, catalog).files[SCREEN_LIB_PATH]).toBeUndefined();
  });

  test('D14 Screen Resolution read only by an unbindable sink: no hook, no lib — the read-time mark keeps nothing (§56 E1)', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.fromId === 'screen');
    // A logic sink nothing renders: the wire is dropped by the sweep, and the diagnostic resolve must not leave a hook behind.
    addNode(c, { id: 'orphanLog', type: 'Log', parameters: [] });
    connect(c, 'screen', 'width', 'orphanLog', 'value', 'value');
    const out = emitApp(ir, catalog);
    expect(planOf(ir, HOME).screenResolutions).toEqual([]);
    expect(home(out)).not.toContain('useScreenResolution');
    expect(out.files[SCREEN_LIB_PATH]).toBeUndefined();
  });

  test('D15 the corpus stays clean: no marker, no TODO on the fixture', () => {
    expect(home(app)).not.toContain('@nodegx:refused');
    expect(home(app)).not.toContain('TODO(export)');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E the shapes a wire changes — the inputs read where the setters read them', () => {
  test('E1 a wired Length prints inside Number(…) (the setter), a wired Encoding prints as the expression', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    addNode(c, { id: 'lenVar', type: 'Variable2', parameters: [{ name: 'name', value: { kind: 'literal', value: 'nonceLength' } }] });
    addNode(c, { id: 'encVar', type: 'Variable2', parameters: [{ name: 'name', value: { kind: 'literal', value: 'nonceEncoding' } }] });
    connect(c, 'lenVar', 'value', 'nonce', 'length', 'value');
    connect(c, 'encVar', 'value', 'nonce', 'encoding', 'value');
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain('const nonceResult = tryRandomBytes(Number(nonceLength.get()), nonceEncoding.get());');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('E2 nothing authored and nothing wired: the call takes the lib\'s own defaults (32 bytes, hex; SHA-256, hex)', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    dropParam(nodeOf(ir, HOME, 'nonce'), 'length');
    dropParam(nodeOf(ir, HOME, 'nonce'), 'encoding');
    dropParam(nodeOf(ir, HOME, 'hash'), 'algorithm');
    dropParam(nodeOf(ir, HOME, 'hash'), 'encoding');
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'value');
    const src = home(emitApp(ir, catalog));
    expect(src).toContain('const nonceResult = tryRandomBytes();');
    expect(src).toContain('const hashResult = await tryHash();');
  });

  test('E3 a wired Value with an authored Algorithm and a cleared Encoding: literal beside expression, the cleared field passed as the empty string', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'hash'), 'algorithm', { kind: 'literal', value: 'SHA-512' });
    setParam(nodeOf(ir, HOME, 'hash'), 'encoding', { kind: 'literal', value: '' });
    expect(home(emitApp(ir, catalog))).toContain("const hashResult = await tryHash(plaintext.get(), 'SHA-512', '');");
  });

  test('E4 the nonce\'s Error read from render: the row appears, cleared in the Done arm and written in the Failure arm', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'nonce', 'error', 'hashErrorText', 'text', 'value');
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(src).toContain('const [nonceError, setNonceError] = useState<string | undefined>();');
    expect(src).toContain(['            setNonce(nonceResult.value);', '            setNonceError(undefined);', '          } else {', '            setNonceError(nonceResult.error);', `            ${NONCE_RAISE}`].join('\n'));
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('E5 the Failure arm reads the row for the value — the node did not write one — and the local for the Error', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    // Remember the digest on FAILURE too: that read is the pre-write row.
    connect(c, 'hash', 'digest', 'setHashFailed', 'value', 'value');
    disconnect(c, (w) => w.fromId === 'hash' && w.fromProperty === 'error' && w.toId === 'setHashFailed');
    const src = home(emitApp(ir, catalog));
    expect(src).toContain('hashFailed.set(hash);');
    expect(src).toContain('lastDigest.set(hashResult.digest);');
  });

  test('E6 a Digest nobody reads outside the chain: no row, the Done arm reads the local, the Failure arm still raises', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.fromId === 'hash' && (w.toId === 'digestText' || w.toId === 'hashErrorText'));
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(src).not.toContain('setHash(');
    expect(src).not.toContain('useState<string | undefined>();\n  // Why "Hash" failed');
    expect(src).toContain('lastDigest.set(hashResult.digest);');
    expect(src).toContain(HASH_RAISE);
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('E7 the Hash fired from an effect prints inside an async IIFE — actionsAwait at any depth', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'hash');
    // A Value Changed on the plaintext Variable re-hashes on every keystroke: an effect, not a handler.
    addNode(c, { id: 'onChange', type: 'Value Changed', parameters: [] });
    connect(c, 'plainVar', 'value', 'onChange', 'value', 'value');
    connect(c, 'onChange', 'valueChanged', 'hash', 'hash');
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(planOf(ir, HOME).refusals).toEqual([]);
    expect(src).toContain('void (async () => {');
    expect(src).toContain('const hashResult = await tryHash(plaintext.get(), \'SHA-256\', \'hex\');');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F what building it found — pinned', () => {
  test('F1 the text-sink fold: a crypto row folds like every other maybe-undefined string read (the ninth by-hand instance)', () => {
    const src = home(app);
    expect(src).toContain("{hash ?? ''}");
    expect(src).not.toContain('{hash}');
    expect(src).toContain("{nonce ?? ''}");
  });

  test('F2 a Variable feeding an input is read in the handler as `.get()` — the value at the click, not the render local', () => {
    expect(home(app)).toContain("tryHash(plaintext.get(), 'SHA-256', 'hex')");
    expect(home(app)).not.toContain('useValue(plaintext)');
  });

  test('F3 a Variable written earlier in the same chain is read live: the set prints before the call, and the call reads `.get()`', () => {
    const ir = cloneIr();
    const c = componentOf(ir, HOME);
    // Off the nonce's Done: remember "seed" into plaintext, then hash — the read is the store at that moment.
    // (A Set Variable's own Done is not a chain this exporter owns — the first cut hung the Hash off it and the
    // attach pass refused the trigger; the Done that owns both is the nonce's.)
    addNode(c, { id: 'setPlain', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'plaintext' } }] });
    addNode(c, { id: 'seed', type: 'String', parameters: [{ name: 'value', value: { kind: 'literal', value: 'seed' } }] });
    connect(c, 'seed', 'savedValue', 'setPlain', 'value', 'value');
    disconnect(c, (w) => w.toId === 'hash' && w.toProperty === 'hash');
    connect(c, 'nonce', 'done', 'setPlain', 'do');
    connect(c, 'nonce', 'done', 'hash', 'hash');
    const out = emitApp(ir, catalog);
    const src = home(out);
    expect(planOf(ir, HOME).refusals).toEqual([]);
    const setAt = src.indexOf("plaintext.set('seed');");
    const hashAt = src.indexOf("const hashResult = await tryHash(plaintext.get(), 'SHA-256', 'hex');");
    expect(setAt).toBeGreaterThan(-1);
    expect(hashAt).toBeGreaterThan(setAt);
    // The nonce handler is async now — the awaited Hash sits inside its Done arm.
    expect(src).toContain('onClick={async () => {\n          const nonceResult = tryRandomBytes(16, \'base64url\');');
    expect(typecheckEmittedApp(out)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the ledger and the controls', () => {
  test('G1 each ledger row is translated with a note that names what is emitted and what is refused', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')) as { entries: Array<{ typeName: string; status: string; note?: string }> };
    for (const type of ['net.noodl.Hash', 'net.noodl.RandomBytes', 'Screen Resolution']) {
      const entry = ledger.entries.find((e) => e.typeName === type)!;
      expect(entry.status).toBe('translated');
      expect(typeof entry.note).toBe('string');
      expect((entry.note ?? '').length).toBeGreaterThan(40);
    }
  });

  test('G2 alarm-desk ships neither lib and no viewport hook — the libs are earned, not shipped by default', () => {
    const other = emitApp(parseProject(path.join(__dirname, 'fixtures', 'alarm-desk'), catalog), catalog);
    expect(other.files[CRYPTO_LIB_PATH]).toBeUndefined();
    expect(other.files[SCREEN_LIB_PATH]).toBeUndefined();
    expect(other.files['src/pages/Home.tsx']).not.toContain('useScreenResolution');
  });

  test('G3 the crypto lib does not export the throwing internals — only the two verbs and their types', () => {
    const lib = cryptoLibSource();
    expect(lib).toContain('export async function tryHash(');
    expect(lib).toContain('export function tryRandomBytes(');
    expect(lib).not.toContain('export function randomBytes');
    expect(lib).not.toContain('export function encodeBytes');
    expect(lib).not.toContain('export function requireSubtle');
  });
});
