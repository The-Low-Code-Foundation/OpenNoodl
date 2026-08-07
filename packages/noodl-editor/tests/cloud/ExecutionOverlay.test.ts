/**
 * CF11-007: Canvas Execution Overlay — Unit Tests
 *
 * Tests the pure utility functions used by the ExecutionOverlay components.
 * React component rendering and EventDispatcher integration require a running
 * Electron renderer — covered by manual testing.
 */

// ─── Utility functions under test (inlined to avoid React/IPC deps in test env) ───
// Note: prefixed with 'overlay_' to avoid name collision with ExecutionHistoryPanel.test.ts
// when both are imported into the same test bundle via tests/cloud/index.ts.

function overlay_formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'running':
      return '…';
    case 'skipped':
      return '–';
    default:
      return '?';
  }
}

interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  stepIndex: number;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'running' | 'success' | 'error' | 'skipped';
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Build a nodeId → step map for steps up to and including currentStepIndex.
 * Mirrors the useMemo logic in ExecutionOverlay.tsx.
 */
function buildNodeStepMap(steps: ExecutionStep[], currentStepIndex: number): Map<string, ExecutionStep> {
  const map = new Map<string, ExecutionStep>();
  for (const step of steps) {
    if (step.stepIndex <= currentStepIndex) {
      map.set(step.nodeId, step);
    }
  }
  return map;
}

/**
 * Calculate badge position (right edge of node + 4px, vertically centred).
 * Mirrors the positioning logic in ExecutionNodeBadge.tsx.
 */
function badgePosition(bounds: { x: number; y: number; width: number; height: number }) {
  return {
    left: bounds.x + bounds.width + 4,
    top: bounds.y + bounds.height / 2 - 10
  };
}

/**
 * Calculate popup position (right of badge area).
 * Mirrors the positioning logic in ExecutionDataPopup.tsx.
 */
function popupPosition(bounds: { x: number; y: number; width: number; height: number }) {
  return {
    left: bounds.x + bounds.width + 60,
    top: bounds.y
  };
}

// ─── Test helpers ───

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 'step-1',
    executionId: 'exec-1',
    nodeId: 'node-1',
    nodeType: 'noodl.logic.condition',
    stepIndex: 0,
    startedAt: Date.now(),
    status: 'success',
    ...overrides
  };
}

// ─── Tests: formatDuration ───

describe('ExecutionOverlay — formatDuration', () => {
  it('returns empty string for undefined', () => {
    expect(overlay_formatDuration(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(overlay_formatDuration(null as unknown as number)).toBe('');
  });

  it('formats 0ms', () => {
    expect(overlay_formatDuration(0)).toBe('0ms');
  });

  it('formats sub-second durations as ms', () => {
    expect(overlay_formatDuration(250)).toBe('250ms');
    expect(overlay_formatDuration(999)).toBe('999ms');
  });

  it('formats 1000ms as 1.0s', () => {
    expect(overlay_formatDuration(1000)).toBe('1.0s');
  });

  it('formats multi-second durations', () => {
    expect(overlay_formatDuration(3500)).toBe('3.5s');
    expect(overlay_formatDuration(60000)).toBe('60.0s');
  });
});

// ─── Tests: statusIcon ───

describe('ExecutionOverlay — statusIcon', () => {
  it('returns checkmark for success', () => {
    expect(statusIcon('success')).toBe('✓');
  });

  it('returns cross for error', () => {
    expect(statusIcon('error')).toBe('✗');
  });

  it('returns ellipsis for running', () => {
    expect(statusIcon('running')).toBe('…');
  });

  it('returns dash for skipped', () => {
    expect(statusIcon('skipped')).toBe('–');
  });

  it('returns question mark for unknown status', () => {
    expect(statusIcon('unknown')).toBe('?');
  });
});

// ─── Tests: buildNodeStepMap ───

describe('ExecutionOverlay — buildNodeStepMap', () => {
  it('returns empty map for empty steps', () => {
    const map = buildNodeStepMap([], 0);
    expect(map.size).toBe(0);
  });

  it('includes steps up to and including currentStepIndex', () => {
    const steps = [
      makeStep({ nodeId: 'node-1', stepIndex: 0 }),
      makeStep({ id: 'step-2', nodeId: 'node-2', stepIndex: 1 }),
      makeStep({ id: 'step-3', nodeId: 'node-3', stepIndex: 2 })
    ];

    const map = buildNodeStepMap(steps, 1);
    expect(map.size).toBe(2);
    expect(map.has('node-1')).toBe(true);
    expect(map.has('node-2')).toBe(true);
    expect(map.has('node-3')).toBe(false);
  });

  it('includes all steps when currentStepIndex is at max', () => {
    const steps = [
      makeStep({ nodeId: 'node-1', stepIndex: 0 }),
      makeStep({ id: 'step-2', nodeId: 'node-2', stepIndex: 1 }),
      makeStep({ id: 'step-3', nodeId: 'node-3', stepIndex: 2 })
    ];

    const map = buildNodeStepMap(steps, 2);
    expect(map.size).toBe(3);
  });

  it('excludes all steps when currentStepIndex is -1', () => {
    const steps = [makeStep({ nodeId: 'node-1', stepIndex: 0 })];
    const map = buildNodeStepMap(steps, -1);
    expect(map.size).toBe(0);
  });

  it('last-write-wins when same nodeId appears multiple times', () => {
    const steps = [
      makeStep({ id: 'step-1', nodeId: 'node-1', stepIndex: 0, status: 'running' }),
      makeStep({ id: 'step-2', nodeId: 'node-1', stepIndex: 1, status: 'success' })
    ];

    const map = buildNodeStepMap(steps, 1);
    expect(map.size).toBe(1);
    expect(map.get('node-1')!.status).toBe('success');
  });

  it('preserves step data in the map', () => {
    const step = makeStep({
      nodeId: 'node-42',
      stepIndex: 0,
      status: 'error',
      errorMessage: 'Something went wrong',
      durationMs: 150
    });

    const map = buildNodeStepMap([step], 0);
    const result = map.get('node-42');
    expect(result).toBeDefined();
    expect(result!.status).toBe('error');
    expect(result!.errorMessage).toBe('Something went wrong');
    expect(result!.durationMs).toBe(150);
  });
});

// ─── Tests: badgePosition ───

describe('ExecutionOverlay — badgePosition', () => {
  it('positions badge to the right of the node', () => {
    const bounds = { x: 100, y: 200, width: 120, height: 40 };
    const pos = badgePosition(bounds);
    expect(pos.left).toBe(224); // 100 + 120 + 4
  });

  it('vertically centres the badge on the node', () => {
    const bounds = { x: 100, y: 200, width: 120, height: 40 };
    const pos = badgePosition(bounds);
    expect(pos.top).toBe(210); // 200 + 40/2 - 10
  });

  it('handles zero-position nodes', () => {
    const bounds = { x: 0, y: 0, width: 80, height: 30 };
    const pos = badgePosition(bounds);
    expect(pos.left).toBe(84); // 0 + 80 + 4
    expect(pos.top).toBe(5); // 0 + 30/2 - 10
  });
});

// ─── Tests: popupPosition ───

describe('ExecutionOverlay — popupPosition', () => {
  it('positions popup further right than the badge', () => {
    const bounds = { x: 100, y: 200, width: 120, height: 40 };
    const badge = badgePosition(bounds);
    const popup = popupPosition(bounds);
    expect(popup.left).toBeGreaterThan(badge.left);
  });

  it('aligns popup top with node top', () => {
    const bounds = { x: 100, y: 200, width: 120, height: 40 };
    const pos = popupPosition(bounds);
    expect(pos.top).toBe(200);
  });
});
