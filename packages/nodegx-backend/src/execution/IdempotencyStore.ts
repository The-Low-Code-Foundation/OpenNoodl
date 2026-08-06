/**
 * CWF-016 — the same webhook, delivered twice.
 *
 * A durable claim table so that a second delivery of the same request does not
 * run the graph a second time. Every webhook provider retries; the correct
 * answer to the second delivery is the first delivery's answer, not a second
 * order.
 *
 * ## Why a table and not a Map
 *
 * The design (CWF-016 question 3) rules out an in-memory map explicitly. WF-001's
 * engine already runs in memory with no cross-restart resume, and repeating that
 * shape here means idempotency evaporates on exactly the deploy that most needs
 * it — the restart mid-retry-storm. "Survives a backend restart between the two
 * deliveries" is a stated acceptance bullet and it is what forces sqlite.
 *
 * It lives in `<dataDir>/executions.sqlite`, **the same file and the same
 * connection** as the execution history, for two reasons that are the same
 * reason: a second database file is a second thing to back up, and a second
 * connection to the same file is a second writer to a lock nobody is holding a
 * plan for. {@link ExecutionHistory} owns the handle; this store borrows it.
 *
 * ## Claim-then-run, and the claim is the row
 *
 * The naive implementation — check, then run, then record — passes every
 * sequential test and fails the only interesting one: two deliveries in flight
 * together both check, both miss, both run. So the row is inserted **first**,
 * under a PRIMARY KEY, and the insert is the claim:
 *
 *  - the winner's insert succeeds → it runs the graph;
 *  - every loser's insert fails on the constraint → it is handed the winner's
 *    claim id and waits for that run, then replays its answer.
 *
 * Nothing in JavaScript arbitrates this. The constraint does, which is what
 * makes it hold across two processes on one data directory as well as across two
 * awaits in one.
 *
 * ## ⚠️ A claim is PROVISIONAL until the run succeeds
 *
 * The task's trap says a 500 must not be cached, and the state that will exist
 * in production is the run that crashed mid-way. Decided, and built:
 *
 *  - a run that **succeeded** completes the claim, which is then replayed for
 *    the TTL;
 *  - a run that **failed, timed out or threw** releases the claim — the row is
 *    DELETED and the next delivery with that key runs the graph again;
 *  - a claim whose **process died** is released two ways: {@link releaseInFlight}
 *    at service start (the same doctrine as WF-001's interrupted-execution
 *    recovery), and a stale-claim takeover for the live process that somehow
 *    never settled.
 *
 * Replaying a failure forever is worse than running twice, and a claim that can
 * never be released is a key that can never be retried — the same defect with a
 * longer fuse.
 *
 * ## ⚠️ What is stored, and why it is NOT scrubbed
 *
 * The stored body is whatever the function returned. It goes through CWF-009 and
 * CWF-013's redaction question, and the answer here is deliberately different
 * from the `Log` node's: **nothing is scrubbed on the way in.**
 *
 *  - `redact()` is **key-based** — CWF-013 found that and said so in as many
 *    words — and a response body is a bare string whose field names we do not
 *    choose, so key-based redaction would not catch a secret in it anyway.
 *  - `SecretValueScrubber` (the value-based half) *would* catch one, and running
 *    it here would be **wrong**: a replay whose body differs from the original
 *    answer is not a replay. The first caller already received the unscrubbed
 *    bytes; handing the retry a different document would break the one promise
 *    this feature makes.
 *  - The replay is only ever handed to a caller who presented the same key on
 *    the same function and passed the same `call` gate — so it is not a new
 *    audience, and the row sits in the same machine-local `executions.sqlite`
 *    that already holds every execution's step payloads.
 *
 * The real mitigation is therefore the TTL and the fact that **nothing here ever
 * logs a body**. If a function returns a credential, that credential is at rest
 * in the execution history already; this table does not widen that, and pretending
 * to fix it with a scrubber that silently corrupts replays would.
 *
 * ## ⚠️ The hole this cannot cover: our own retries
 *
 * A workflow's `call-function` step **never reaches `POST /functions/:name`**. It
 * runs in process through `StepExecutor.invokeCloudFunction` →
 * `WorkflowRunner.invokeFunction` → `cloudRunner.run`, with literally
 * `headers: {}`. So a CWF-005 retry of a step is a genuine duplicate invocation
 * that this mechanism cannot see, let alone stop.
 *
 * That is a **documented limit, not a bug to route around.** Teaching the step to
 * send a key would turn a *deliberate* retry into a silent no-op, which is worse
 * than the duplicate. It generalises: no endpoint feature applies to a workflow
 * step, because a step is not a request.
 *
 * @module nodegx-backend/execution/IdempotencyStore
 */

import { randomUUID } from 'crypto';

/**
 * The slice of `node:sqlite` this store uses.
 *
 * Structural, and declared here rather than imported: `@types/node` at the
 * version this package pins has no `node:sqlite` declarations, and
 * {@link ExecutionHistory} already keeps the module a runtime `require` so the
 * cloud runtime does not enter this package's module graph. Naming the three
 * methods used is more honest than `any` and costs one interface.
 */
export interface SqlStatement {
  run(...params: unknown[]): { changes: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
}

/** A row as this module thinks of it, in camelCase rather than the table's snake. */
export interface IdempotencyRow {
  scope: string;
  key: string;
  state: 'running' | 'done';
  claimId: string;
  claimedAt: number;
  completedAt: number | null;
  statusCode: number | null;
  body: string | null;
  requestHash: string | null;
}

export type IdempotencyClaim =
  /** Nobody holds this key: run the graph, then `complete` or `release`. */
  | { outcome: 'claimed'; claimId: string }
  /** Someone else is running it right now. Wait on `claimId`, then claim again. */
  | { outcome: 'inflight'; claimId: string; claimedAt: number }
  /** It has already been answered. Send this, unchanged. */
  | { outcome: 'replay'; statusCode: number; body: string; completedAt: number }
  /** The store never opened (no sqlite). The caller must run the graph unprotected. */
  | { outcome: 'disabled' };

export interface IdempotencyOpenOptions {
  /**
   * Live TTL for a COMPLETED claim, read on every use so `PUT /admin/ops` takes
   * effect without a restart — the same late-binding as
   * `ExecutionHistory.getRetentionDays`. `0` = keep until something else removes
   * it (an operator opt-out, deliberately distinct from "unset").
   */
  getTtlMs?: () => number;
  /**
   * How long a `running` claim may sit before another delivery may take it over.
   *
   * This is the backstop for the claim whose process died between the insert and
   * the completion **without** a clean start (which {@link releaseInFlight}
   * handles) — a wedged event loop, a container paused mid-request. Generous on
   * purpose: taking over a claim whose winner is merely slow means running the
   * graph twice, which is the thing this table exists to prevent, so the window
   * must be comfortably longer than any function is allowed to run.
   */
  staleClaimMs?: number;
}

/** 24h, the industry default and CWF-016's decided TTL. */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 3_600_000;

/**
 * Ten minutes — twenty times `DEFAULT_FUNCTION_TIMEOUT_MS` and longer than any
 * timeout an operator is likely to declare. See {@link IdempotencyOpenOptions.staleClaimMs}
 * for why erring long is the safe direction here.
 */
export const DEFAULT_STALE_CLAIM_MS = 600_000;

/** How many times `claim` re-reads before giving up and reporting contention. */
const CLAIM_ATTEMPTS = 4;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope        TEXT    NOT NULL,
  idem_key     TEXT    NOT NULL,
  state        TEXT    NOT NULL,
  claim_id     TEXT    NOT NULL,
  claimed_at   INTEGER NOT NULL,
  completed_at INTEGER,
  status_code  INTEGER,
  body         TEXT,
  request_hash TEXT,
  PRIMARY KEY (scope, idem_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_state ON idempotency_keys (state, claimed_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_completed ON idempotency_keys (completed_at);
`;

function toNumber(changes: number | bigint): number {
  return typeof changes === 'bigint' ? Number(changes) : changes;
}

export class IdempotencyStore {
  private db: SqlDatabase | null = null;
  private getTtlMs: (() => number) | null = null;
  private staleClaimMs = DEFAULT_STALE_CLAIM_MS;
  private stmt: {
    insert: SqlStatement;
    select: SqlStatement;
    complete: SqlStatement;
    release: SqlStatement;
    dropDone: SqlStatement;
    takeover: SqlStatement;
    sweepDone: SqlStatement;
    sweepRunning: SqlStatement;
    releaseInFlight: SqlStatement;
    count: SqlStatement;
  } | null = null;

  /**
   * Attach to an already-open database and create the table.
   *
   * Takes a handle rather than a path because the handle is
   * {@link ExecutionHistory}'s — one file, one connection, one thing to back up.
   * Throwing here is the caller's to catch: the service treats a store that
   * would not open exactly as it treats execution history that would not open —
   * DISABLED with a loud line, never a silent fall back to memory, and never a
   * reason a real function call fails.
   */
  open(db: SqlDatabase, options: IdempotencyOpenOptions = {}): void {
    db.exec(SCHEMA);
    this.db = db;
    this.getTtlMs = options.getTtlMs || null;
    if (typeof options.staleClaimMs === 'number' && options.staleClaimMs > 0) {
      this.staleClaimMs = options.staleClaimMs;
    }
    this.stmt = {
      insert: db.prepare(
        `INSERT INTO idempotency_keys (scope, idem_key, state, claim_id, claimed_at, request_hash)
         VALUES (?, ?, 'running', ?, ?, ?)`
      ),
      select: db.prepare(`SELECT * FROM idempotency_keys WHERE scope = ? AND idem_key = ?`),
      complete: db.prepare(
        `UPDATE idempotency_keys SET state = 'done', completed_at = ?, status_code = ?, body = ?
         WHERE scope = ? AND idem_key = ? AND claim_id = ? AND state = 'running'`
      ),
      release: db.prepare(
        `DELETE FROM idempotency_keys WHERE scope = ? AND idem_key = ? AND claim_id = ? AND state = 'running'`
      ),
      dropDone: db.prepare(
        `DELETE FROM idempotency_keys WHERE scope = ? AND idem_key = ? AND claim_id = ? AND state = 'done'`
      ),
      takeover: db.prepare(
        `UPDATE idempotency_keys SET claim_id = ?, claimed_at = ?
         WHERE scope = ? AND idem_key = ? AND claim_id = ? AND state = 'running' AND claimed_at <= ?`
      ),
      sweepDone: db.prepare(`DELETE FROM idempotency_keys WHERE state = 'done' AND completed_at <= ?`),
      sweepRunning: db.prepare(`DELETE FROM idempotency_keys WHERE state = 'running' AND claimed_at <= ?`),
      releaseInFlight: db.prepare(`DELETE FROM idempotency_keys WHERE state = 'running'`),
      count: db.prepare(`SELECT COUNT(*) AS n FROM idempotency_keys`)
    };
  }

  /** Detach. The database handle belongs to `ExecutionHistory`, so this closes nothing. */
  close(): void {
    this.db = null;
    this.stmt = null;
  }

  get enabled(): boolean {
    return this.stmt !== null;
  }

  private ttlMs(): number {
    if (!this.getTtlMs) return DEFAULT_IDEMPOTENCY_TTL_MS;
    const value = this.getTtlMs();
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULT_IDEMPOTENCY_TTL_MS;
  }

  /** Read a row without touching it. Diagnostics, and the claim loop's re-read. */
  peek(scope: string, key: string): IdempotencyRow | null {
    if (!this.stmt) return null;
    const row = this.stmt.select.get(scope, key);
    if (!row) return null;
    return {
      scope: String(row.scope),
      key: String(row.idem_key),
      state: row.state === 'done' ? 'done' : 'running',
      claimId: String(row.claim_id),
      claimedAt: Number(row.claimed_at),
      completedAt: row.completed_at === null || row.completed_at === undefined ? null : Number(row.completed_at),
      statusCode: row.status_code === null || row.status_code === undefined ? null : Number(row.status_code),
      body: row.body === null || row.body === undefined ? null : String(row.body),
      requestHash: row.request_hash === null || row.request_hash === undefined ? null : String(row.request_hash)
    };
  }

  private isExpired(row: IdempotencyRow, now: number): boolean {
    const ttl = this.ttlMs();
    if (ttl <= 0 || row.completedAt === null) return false;
    return now - row.completedAt > ttl;
  }

  /**
   * Try to become the one delivery that runs the graph.
   *
   * The INSERT is the whole mechanism: it either succeeds (nobody held the key)
   * or it violates the primary key (somebody does). There is deliberately no
   * SELECT-then-INSERT anywhere in this method's happy path, because that is the
   * shape that loses the race.
   *
   * The loop exists for the two ways a re-read can be out of date — the row was
   * swept, or its stale claim was taken over by a third delivery, between the
   * failed insert and the select. It is bounded: contention that survives four
   * attempts is reported as in-flight, which makes the caller wait, rather than
   * as claimed, which would run the graph.
   */
  claim(scope: string, key: string, requestHash?: string): IdempotencyClaim {
    if (!this.stmt) return { outcome: 'disabled' };

    let insertError: unknown = null;
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
      const now = Date.now();
      const claimId = randomUUID();
      try {
        this.stmt.insert.run(scope, key, claimId, now, requestHash === undefined ? null : requestHash);
        return { outcome: 'claimed', claimId };
      } catch (e) {
        insertError = e;
      }

      const row = this.peek(scope, key);
      if (!row) {
        // The insert failed and there is no row: not contention. Something else
        // is wrong with the statement or the database, and swallowing it would
        // turn a broken table into "every request runs the graph twice".
        if (attempt === CLAIM_ATTEMPTS - 1) throw insertError;
        continue;
      }

      if (row.state === 'done') {
        if (this.isExpired(row, now)) {
          // Past its TTL and the write-driven sweep has not come round. Drop it
          // and go again — enforcing the TTL on read as well as on sweep is what
          // keeps "24h" from meaning "24h, or up to an hour more".
          this.stmt.dropDone.run(scope, key, row.claimId);
          continue;
        }
        return {
          outcome: 'replay',
          statusCode: row.statusCode === null ? 200 : row.statusCode,
          body: row.body === null ? '' : row.body,
          completedAt: row.completedAt === null ? 0 : row.completedAt
        };
      }

      if (now - row.claimedAt >= this.staleClaimMs) {
        const taken = toNumber(
          this.stmt.takeover.run(claimId, now, scope, key, row.claimId, now - this.staleClaimMs).changes
        );
        if (taken === 1) return { outcome: 'claimed', claimId };
        continue;
      }

      return { outcome: 'inflight', claimId: row.claimId, claimedAt: row.claimedAt };
    }

    const row = this.peek(scope, key);
    if (row) return { outcome: 'inflight', claimId: row.claimId, claimedAt: row.claimedAt };
    throw insertError;
  }

  /**
   * Turn a provisional claim into the answer everyone else replays.
   *
   * `claimId` is checked, so a holder that lost its claim to a stale-takeover
   * cannot overwrite the answer of whoever took it. Returns false in that case —
   * the caller still sends its own response to its own client, it simply does
   * not get to be the stored one.
   */
  complete(scope: string, key: string, claimId: string, statusCode: number, body: string): boolean {
    if (!this.stmt) return false;
    return toNumber(this.stmt.complete.run(Date.now(), statusCode, body, scope, key, claimId).changes) === 1;
  }

  /**
   * Give the key back. The row is DELETED rather than marked failed: "released"
   * has exactly one meaning — the next delivery with this key runs the graph —
   * and a tombstone row would be a second state to interpret at every read.
   */
  release(scope: string, key: string, claimId: string): boolean {
    if (!this.stmt) return false;
    return toNumber(this.stmt.release.run(scope, key, claimId).changes) === 1;
  }

  /**
   * Every `running` claim in the table belongs to a process that is gone; drop
   * them. Called once at service start, and the reasoning is WF-001's exactly:
   * a record left `running` across a restart means the run did not survive it,
   * so it becomes a loud, released claim rather than a phantom one nothing can
   * ever retry.
   *
   * ⚠️ This assumes ONE process per data directory, which is the documented
   * ownership of `executions.sqlite` (`ExecutionStore`'s module note). Two
   * backends started on one data directory would each release the other's live
   * claims — but they would also be fighting over the execution history, so the
   * fix is not here.
   */
  releaseInFlight(): number {
    if (!this.stmt) return 0;
    return toNumber(this.stmt.releaseInFlight.run().changes);
  }

  /**
   * Drop completed claims past the TTL and abandoned claims past the stale
   * window. Returns how many rows went.
   *
   * Driven by {@link ExecutionHistory.prune}, which is itself driven by writes
   * rather than a timer — see its note on why this service does not grow a
   * fourth timer next to the trigger scheduler, the backup scheduler and the
   * realtime heartbeat, one of which already hangs `server.close()`.
   */
  sweep(now: number = Date.now()): number {
    if (!this.stmt) return 0;
    const ttl = this.ttlMs();
    let removed = 0;
    if (ttl > 0) removed += toNumber(this.stmt.sweepDone.run(now - ttl).changes);
    removed += toNumber(this.stmt.sweepRunning.run(now - this.staleClaimMs).changes);
    return removed;
  }

  /** Rows currently held. Diagnostics and tests. */
  count(): number {
    if (!this.stmt) return 0;
    const row = this.stmt.count.get();
    return row ? Number(row.n) : 0;
  }
}
