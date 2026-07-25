/**
 * InMemorySqliteFallback
 *
 * WF-006 engine note, path 2: a loudly-labeled, in-memory `SQLiteDatabase`
 * (see `execution-history/store.ts`) used only when `node:sqlite` is not
 * available in the current Node/Electron build. Data lives in process memory
 * for the lifetime of the app and is lost on restart — that tradeoff is
 * explicitly acceptable for observability data per the WF-006 spec, as long
 * as it is never presented as if it were durable.
 *
 * This is NOT a general SQL engine. `ExecutionStore` issues a small, fixed
 * set of statement shapes (see store.ts) and this class only needs to
 * understand those shapes — it pattern-matches the normalized SQL text and
 * operates on two in-memory row arrays. If `ExecutionStore` grows new query
 * shapes, this file needs a matching update (the unit tests catch that).
 */

import type { SQLiteDatabase } from '@noodl-viewer-cloud/execution-history';

type Row = Record<string, unknown>;

type ComparisonOp = '=' | '!=' | '>=' | '<=';

function compare(rowValue: unknown, op: ComparisonOp, paramValue: unknown): boolean {
  switch (op) {
    case '=':
      return rowValue === paramValue;
    case '!=':
      return rowValue !== paramValue;
    case '>=':
      return (rowValue as number) >= (paramValue as number);
    case '<=':
      return (rowValue as number) <= (paramValue as number);
    default:
      return false;
  }
}

export class InMemorySqliteFallback implements SQLiteDatabase {
  private executions: Row[] = [];
  private steps: Row[] = [];

  /** Schema init is a no-op — the two tables are always the arrays above. */
  exec(_sql: string): void {
    // Nothing to do: tables already exist as in-memory arrays.
  }

  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  } {
    const normalized = sql.trim().replace(/\s+/g, ' ');

    return {
      run: (...params: unknown[]) => this.run(normalized, params),
      get: (...params: unknown[]) => this.select(normalized, params)[0],
      all: (...params: unknown[]) => this.select(normalized, params)
    };
  }

  // ===========================================================================
  // Test-only helpers
  // ===========================================================================

  /** Not part of SQLiteDatabase — used by the fallback's own unit tests. */
  _debugCounts(): { executions: number; steps: number } {
    return { executions: this.executions.length, steps: this.steps.length };
  }

  // ===========================================================================
  // WRITE STATEMENTS
  // ===========================================================================

  private table(name: string): Row[] {
    return name === 'execution_steps' ? this.steps : this.executions;
  }

  private cascadeDeleteSteps(executionId: unknown): void {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (this.steps[i].execution_id === executionId) {
        this.steps.splice(i, 1);
      }
    }
  }

  private run(sql: string, params: unknown[]): { changes: number } {
    let match: RegExpMatchArray | null;

    // INSERT INTO <table> (col, col, ...) VALUES (?, ?, ...)
    match = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/i);
    if (match) {
      const [, table, columnList] = match;
      const columns = columnList.split(',').map((c) => c.trim());
      const row: Row = {};
      columns.forEach((col, i) => {
        row[col] = params[i] ?? null;
      });
      this.table(table).push(row);
      return { changes: 1 };
    }

    // UPDATE <table> SET col = ?, col = ?, ... WHERE id = ?
    match = sql.match(/^UPDATE (\w+) SET (.+) WHERE id = \?$/i);
    if (match) {
      const [, table, setClause] = match;
      const columns = [...setClause.matchAll(/(\w+)\s*=\s*\?/g)].map((m) => m[1]);
      const id = params[params.length - 1];
      const row = this.table(table).find((r) => r.id === id);
      if (!row) return { changes: 0 };
      columns.forEach((col, i) => {
        row[col] = params[i] ?? null;
      });
      return { changes: 1 };
    }

    // DELETE FROM <table> WHERE id = ?
    match = sql.match(/^DELETE FROM (\w+) WHERE id = \?$/i);
    if (match) {
      const [, table] = match;
      const id = params[0];
      const arr = this.table(table);
      const idx = arr.findIndex((r) => r.id === id);
      if (idx === -1) return { changes: 0 };
      arr.splice(idx, 1);
      if (table === 'workflow_executions') this.cascadeDeleteSteps(id);
      return { changes: 1 };
    }

    // DELETE FROM workflow_executions WHERE started_at < ?
    match = sql.match(/^DELETE FROM workflow_executions WHERE started_at < \?$/i);
    if (match) {
      const cutoff = params[0] as number;
      let changes = 0;
      for (let i = this.executions.length - 1; i >= 0; i--) {
        if ((this.executions[i].started_at as number) < cutoff) {
          const id = this.executions[i].id;
          this.executions.splice(i, 1);
          this.cascadeDeleteSteps(id);
          changes++;
        }
      }
      return { changes };
    }

    // DELETE FROM workflow_executions WHERE workflow_id = ? AND id NOT IN (?, ?, ...)
    match = sql.match(/^DELETE FROM workflow_executions WHERE workflow_id = \? AND id NOT IN \([^)]*\)$/i);
    if (match) {
      const workflowId = params[0];
      const keepIds = new Set(params.slice(1));
      let changes = 0;
      for (let i = this.executions.length - 1; i >= 0; i--) {
        const row = this.executions[i];
        if (row.workflow_id === workflowId && !keepIds.has(row.id)) {
          const id = row.id;
          this.executions.splice(i, 1);
          this.cascadeDeleteSteps(id);
          changes++;
        }
      }
      return { changes };
    }

    // DELETE FROM workflow_executions WHERE id IN ( SELECT id FROM workflow_executions ORDER BY started_at ASC LIMIT ? )
    match = sql.match(
      /^DELETE FROM workflow_executions WHERE id IN \( SELECT id FROM workflow_executions ORDER BY started_at ASC LIMIT \? \)$/i
    );
    if (match) {
      const n = params[0] as number;
      const oldestFirst = [...this.executions].sort(
        (a, b) => (a.started_at as number) - (b.started_at as number)
      );
      const toDelete = new Set(oldestFirst.slice(0, n).map((r) => r.id));
      let changes = 0;
      for (let i = this.executions.length - 1; i >= 0; i--) {
        if (toDelete.has(this.executions[i].id)) {
          const id = this.executions[i].id;
          this.executions.splice(i, 1);
          this.cascadeDeleteSteps(id);
          changes++;
        }
      }
      return { changes };
    }

    return { changes: 0 };
  }

  // ===========================================================================
  // READ STATEMENTS
  // ===========================================================================

  private select(sql: string, params: unknown[]): Row[] {
    // SELECT DISTINCT workflow_id FROM workflow_executions
    if (/SELECT DISTINCT workflow_id FROM workflow_executions/i.test(sql)) {
      const ids = Array.from(new Set(this.executions.map((r) => r.workflow_id)));
      return ids.map((workflow_id) => ({ workflow_id }));
    }

    // getStats aggregate — has SUM(CASE WHEN ...)
    if (/SUM\(CASE WHEN/i.test(sql)) {
      const filterByWorkflow = /WHERE workflow_id = \?/i.test(sql);
      const rows = filterByWorkflow ? this.executions.filter((r) => r.workflow_id === params[0]) : this.executions;
      const durations = rows.map((r) => r.duration_ms).filter((d): d is number => typeof d === 'number');
      return [
        {
          total: rows.length,
          success_count: rows.filter((r) => r.status === 'success').length,
          error_count: rows.filter((r) => r.status === 'error').length,
          running_count: rows.filter((r) => r.status === 'running').length,
          avg_duration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
          min_duration: durations.length ? Math.min(...durations) : null,
          max_duration: durations.length ? Math.max(...durations) : null
        }
      ];
    }

    // SELECT COUNT(*) as count FROM workflow_executions
    if (/^SELECT COUNT\(\*\) as count FROM workflow_executions$/i.test(sql)) {
      return [{ count: this.executions.length }];
    }

    // Generic "SELECT ... FROM <table> [WHERE col OP ? [AND col OP ? ...]] [ORDER BY col DIR] [LIMIT ?] [OFFSET ?]"
    const fromMatch = sql.match(/FROM (\w+)/i);
    if (!fromMatch) return [];

    let rows = [...this.table(fromMatch[1])];
    let paramIdx = 0;

    const whereMatch = sql.match(/WHERE (.+?)(?: ORDER BY| LIMIT| GROUP BY|$)/i);
    if (whereMatch) {
      const conditions = [...whereMatch[1].matchAll(/(\w+)\s*(>=|<=|!=|=)\s*\?/g)];
      for (const [, col, op] of conditions) {
        const value = params[paramIdx++];
        rows = rows.filter((r) => compare(r[col], op as ComparisonOp, value));
      }
    }

    const orderMatch = sql.match(/ORDER BY (\w+) (ASC|DESC)/i);
    if (orderMatch) {
      const [, col, dir] = orderMatch;
      const sign = dir.toUpperCase() === 'DESC' ? -1 : 1;
      rows.sort((a, b) => {
        const av = a[col] as number | string;
        const bv = b[col] as number | string;
        if (av === bv) return 0;
        return av > bv ? sign : -sign;
      });
    }

    if (/LIMIT \?/i.test(sql)) {
      const limit = params[paramIdx++] as number;
      let offset = 0;
      if (/OFFSET \?/i.test(sql)) {
        offset = params[paramIdx++] as number;
      }
      rows = rows.slice(offset, offset + limit);
    }

    return rows;
  }
}
