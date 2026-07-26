/**
 * The `LocalSQLAdapter` surface these specs drive (PLAT-004).
 *
 * The adapter itself is untyped CommonJS in `@noodl/runtime` (PLAT-003's
 * territory, not this task's), and three specs each declared `let adapter: any`
 * because of it. `any` is the wrong conclusion: what those specs need is a
 * *description of the calls they make*, and that is knowable without the
 * adapter being typed at its source — the callback-style `{collection, data,
 * success, error}` contract is stable and documented where the adapter lives.
 *
 * Written down here, a misspelled `adaptor.creat(...)` is a compile error rather
 * than a spec that silently never asserts. It deliberately does NOT try to be
 * the adapter's whole API; adding a method as a spec needs it is the point.
 *
 * When PLAT-003 types the adapter for real, this should be deleted in favour of
 * the real type — it is a stand-in, and its docblock says so on purpose.
 */
import type { ChangeSource } from '../../src/realtime/ChangeBus';

export interface AdapterCallbacks<T = unknown> {
  success?: (result: T) => void;
  error?: (e: unknown) => void;
}

/**
 * `create`/`query` are generic over the record shape rather than fixed to
 * `Record<string, unknown>`. That is §11's `keyUnion` lesson applied: an
 * *interface* never satisfies `Record<string, unknown>` (interfaces get no
 * implicit index signature), so a fixed parameter type would force every spec
 * that declares its own `Rec` to cast — which is precisely the failure mode
 * this file exists to remove.
 */
export interface LocalSqlAdapter extends ChangeSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  create<T extends object = Record<string, unknown>>(
    args: { collection: string; data: object } & AdapterCallbacks<T>
  ): void;
  save(args: { collection: string; objectId: string; data: object } & AdapterCallbacks<unknown>): void;
  delete(args: { collection: string; objectId: string } & AdapterCallbacks<unknown>): void;
  query<T extends object = Record<string, unknown>>(
    args: { collection: string; where?: Record<string, unknown>; limit?: number } & AdapterCallbacks<T[]>
  ): void;
  /** Runs `fn` inside one transaction; ChangeBus events are held until commit. */
  transaction(fn: () => void): void;
}

/** Constructor shape of the `require`d CommonJS class. */
export type LocalSqlAdapterCtor = new (
  path: string,
  options: { engine: unknown; autoCreateTables?: boolean }
) => LocalSqlAdapter;
