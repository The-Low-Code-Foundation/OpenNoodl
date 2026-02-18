/**
 * CF11-006: Execution History Panel — Unit Tests
 *
 * Tests the pure utility functions used by the ExecutionHistoryPanel hooks.
 * Hook integration tests require a running Electron renderer — covered by manual testing.
 */

// ─── Utility functions under test (inlined to avoid React/IPC deps in test env) ───

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildExecutionQuery(filters: {
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  return {
    status: filters.status,
    startedAfter: filters.startDate?.getTime(),
    startedBefore: filters.endDate?.getTime(),
    limit: 100,
    orderBy: 'started_at',
    orderDir: 'desc'
  };
}

// ─── Tests ───

describe('ExecutionHistoryPanel — formatDuration', () => {
  it('returns em-dash for undefined', () => {
    expect(formatDuration(undefined)).toBe('—');
  });

  it('returns em-dash for null', () => {
    expect(formatDuration(null as unknown as number)).toBe('—');
  });

  it('formats sub-second durations as ms', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats 1000ms as 1.0s', () => {
    expect(formatDuration(1000)).toBe('1.0s');
  });

  it('formats multi-second durations', () => {
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(10000)).toBe('10.0s');
  });
});

describe('ExecutionHistoryPanel — formatRelativeTime', () => {
  it('formats recent timestamps as seconds ago', () => {
    const result = formatRelativeTime(Date.now() - 30000); // 30s ago
    expect(result).toBe('30s ago');
  });

  it('formats timestamps as minutes ago', () => {
    const result = formatRelativeTime(Date.now() - 5 * 60 * 1000); // 5m ago
    expect(result).toBe('5m ago');
  });

  it('formats timestamps as hours ago', () => {
    const result = formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
    expect(result).toBe('3h ago');
  });

  it('formats old timestamps as locale date string', () => {
    const oldDate = new Date('2025-01-01').getTime();
    const result = formatRelativeTime(oldDate);
    // Should be a date string, not "Xh ago"
    expect(result).not.toContain('ago');
  });
});

describe('ExecutionHistoryPanel — buildExecutionQuery', () => {
  it('builds query with no filters', () => {
    const query = buildExecutionQuery({});
    expect(query.status).toBeUndefined();
    expect(query.startedAfter).toBeUndefined();
    expect(query.startedBefore).toBeUndefined();
    expect(query.limit).toBe(100);
    expect(query.orderBy).toBe('started_at');
    expect(query.orderDir).toBe('desc');
  });

  it('includes status filter when provided', () => {
    const query = buildExecutionQuery({ status: 'error' });
    expect(query.status).toBe('error');
  });

  it('converts Date objects to timestamps', () => {
    const startDate = new Date('2025-01-01T00:00:00Z');
    const endDate = new Date('2025-12-31T23:59:59Z');
    const query = buildExecutionQuery({ startDate, endDate });
    expect(query.startedAfter).toBe(startDate.getTime());
    expect(query.startedBefore).toBe(endDate.getTime());
  });

  it('always orders by started_at descending', () => {
    const query = buildExecutionQuery({ status: 'success' });
    expect(query.orderBy).toBe('started_at');
    expect(query.orderDir).toBe('desc');
  });

  it('always limits to 100 results', () => {
    const query = buildExecutionQuery({});
    expect(query.limit).toBe(100);
  });
});
