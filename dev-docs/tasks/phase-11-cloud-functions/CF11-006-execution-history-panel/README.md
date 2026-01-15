# CF11-006: Execution History Panel UI

## Metadata

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **ID**             | CF11-006                                   |
| **Phase**          | Phase 11                                   |
| **Series**         | 2 - Execution History                      |
| **Priority**       | 🔴 Critical                                |
| **Difficulty**     | 🟡 Medium                                  |
| **Estimated Time** | 12-16 hours                                |
| **Prerequisites**  | CF11-004, CF11-005                         |
| **Branch**         | `feature/cf11-006-execution-history-panel` |

## Objective

Create a sidebar panel in the editor that displays workflow execution history, allowing users to view past executions, inspect node data, and debug failed workflows.

## Background

With execution data being captured (CF11-004, CF11-005), users need a way to:

- View all past executions for a workflow
- See execution status at a glance (success/error)
- Drill into individual executions to see node-by-node data
- Quickly identify where workflows fail

This is the primary debugging interface for workflow developers.

## Current State

- Execution data is stored in SQLite
- No UI to view execution history
- Users cannot debug failed workflows

## Desired State

- New "Execution History" panel in sidebar
- List of past executions with status, duration, timestamp
- Expandable execution detail view
- Node step list with input/output data
- Search/filter capabilities
- Delete/clear history options

## Scope

### In Scope

- [ ] ExecutionHistoryPanel React component
- [ ] ExecutionList component
- [ ] ExecutionDetail component with node steps
- [ ] Data display for inputs/outputs (JSON viewer)
- [ ] Filter by status, date range
- [ ] Integration with sidebar navigation
- [ ] Proper styling with design tokens

### Out of Scope

- Canvas overlay (CF11-007)
- Real-time streaming of executions
- Export/import of execution data

## Technical Approach

### Component Structure

```
ExecutionHistoryPanel/
├── index.ts
├── ExecutionHistoryPanel.tsx        # Main panel container
├── ExecutionHistoryPanel.module.scss
├── components/
│   ├── ExecutionList/
│   │   ├── ExecutionList.tsx        # List of executions
│   │   ├── ExecutionList.module.scss
│   │   ├── ExecutionItem.tsx        # Single execution row
│   │   └── ExecutionItem.module.scss
│   ├── ExecutionDetail/
│   │   ├── ExecutionDetail.tsx      # Expanded execution view
│   │   ├── ExecutionDetail.module.scss
│   │   ├── NodeStepList.tsx         # List of node steps
│   │   ├── NodeStepList.module.scss
│   │   ├── NodeStepItem.tsx         # Single step row
│   │   └── NodeStepItem.module.scss
│   └── ExecutionFilters/
│       ├── ExecutionFilters.tsx     # Filter controls
│       └── ExecutionFilters.module.scss
└── hooks/
    ├── useExecutionHistory.ts       # Data fetching hook
    └── useExecutionDetail.ts        # Single execution hook
```

### Main Panel Component

```tsx
// ExecutionHistoryPanel.tsx
import React, { useState } from 'react';

import { PanelHeader } from '@noodl-core-ui/components/sidebar/PanelHeader';

import { ExecutionDetail } from './components/ExecutionDetail';
import { ExecutionFilters } from './components/ExecutionFilters';
import { ExecutionList } from './components/ExecutionList';
import styles from './ExecutionHistoryPanel.module.scss';
import { useExecutionHistory } from './hooks/useExecutionHistory';

export function ExecutionHistoryPanel() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExecutionFilters>({
    status: undefined,
    startDate: undefined,
    endDate: undefined
  });

  const { executions, loading, refresh } = useExecutionHistory(filters);

  return (
    <div className={styles.Panel}>
      <PanelHeader title="Execution History" onRefresh={refresh} />

      <ExecutionFilters filters={filters} onChange={setFilters} />

      {selectedExecutionId ? (
        <ExecutionDetail executionId={selectedExecutionId} onBack={() => setSelectedExecutionId(null)} />
      ) : (
        <ExecutionList executions={executions} loading={loading} onSelect={setSelectedExecutionId} />
      )}
    </div>
  );
}
```

### Execution List Item

```tsx
// ExecutionItem.tsx

import { WorkflowExecution } from '@noodl-viewer-cloud/execution-history';
import React from 'react';

import { Icon } from '@noodl-core-ui/components/common/Icon';

import styles from './ExecutionItem.module.scss';

interface Props {
  execution: WorkflowExecution;
  onSelect: () => void;
}

export function ExecutionItem({ execution, onSelect }: Props) {
  const statusIcon =
    execution.status === 'success' ? 'check-circle' : execution.status === 'error' ? 'x-circle' : 'loader';

  const statusColor =
    execution.status === 'success'
      ? 'var(--theme-color-success)'
      : execution.status === 'error'
      ? 'var(--theme-color-error)'
      : 'var(--theme-color-fg-default)';

  return (
    <div className={styles.Item} onClick={onSelect}>
      <Icon icon={statusIcon} style={{ color: statusColor }} />
      <div className={styles.Info}>
        <span className={styles.Name}>{execution.workflowName}</span>
        <span className={styles.Time}>{formatRelativeTime(execution.startedAt)}</span>
      </div>
      <div className={styles.Meta}>
        <span className={styles.Duration}>{formatDuration(execution.durationMs)}</span>
        <span className={styles.Trigger}>{execution.triggerType}</span>
      </div>
    </div>
  );
}
```

### Execution Detail View

```tsx
// ExecutionDetail.tsx
import React from 'react';

import { JSONViewer } from '@noodl-core-ui/components/json-editor';

import { useExecutionDetail } from '../../hooks/useExecutionDetail';
import styles from './ExecutionDetail.module.scss';
import { NodeStepList } from './NodeStepList';

interface Props {
  executionId: string;
  onBack: () => void;
  onPinToCanvas?: () => void; // For CF11-007 integration
}

export function ExecutionDetail({ executionId, onBack, onPinToCanvas }: Props) {
  const { execution, loading } = useExecutionDetail(executionId);

  if (loading || !execution) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.Detail}>
      <header className={styles.Header}>
        <button onClick={onBack}>← Back</button>
        <h3>{execution.workflowName}</h3>
        {onPinToCanvas && <button onClick={onPinToCanvas}>Pin to Canvas</button>}
      </header>

      <section className={styles.Summary}>
        <div className={styles.Status} data-status={execution.status}>
          {execution.status}
        </div>
        <div>Started: {formatTime(execution.startedAt)}</div>
        <div>Duration: {formatDuration(execution.durationMs)}</div>
        <div>Trigger: {execution.triggerType}</div>
      </section>

      {execution.errorMessage && (
        <section className={styles.Error}>
          <h4>Error</h4>
          <pre>{execution.errorMessage}</pre>
          {execution.errorStack && (
            <details>
              <summary>Stack Trace</summary>
              <pre>{execution.errorStack}</pre>
            </details>
          )}
        </section>
      )}

      {execution.triggerData && (
        <section className={styles.TriggerData}>
          <h4>Trigger Data</h4>
          <JSONViewer data={execution.triggerData} />
        </section>
      )}

      <section className={styles.Steps}>
        <h4>Node Execution Steps ({execution.steps.length})</h4>
        <NodeStepList steps={execution.steps} />
      </section>
    </div>
  );
}
```

### Data Fetching Hooks

```typescript
// useExecutionHistory.ts

import { CloudService } from '@noodl-editor/services/CloudService';
import { WorkflowExecution, ExecutionQuery } from '@noodl-viewer-cloud/execution-history';
import { useState, useEffect, useCallback } from 'react';

export function useExecutionHistory(filters: ExecutionFilters) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const query: ExecutionQuery = {
        status: filters.status,
        startedAfter: filters.startDate?.getTime(),
        startedBefore: filters.endDate?.getTime(),
        limit: 100,
        orderBy: 'started_at',
        orderDir: 'desc'
      };
      const result = await CloudService.getExecutionHistory(query);
      setExecutions(result);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { executions, loading, refresh: fetch };
}
```

### Styling Guidelines

All styles MUST use design tokens:

```scss
// ExecutionItem.module.scss
.Item {
  display: flex;
  align-items: center;
  padding: var(--theme-spacing-3);
  background-color: var(--theme-color-bg-2);
  border-bottom: 1px solid var(--theme-color-border-default);
  cursor: pointer;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }
}

.Name {
  color: var(--theme-color-fg-default);
  font-weight: 500;
}

.Time {
  color: var(--theme-color-fg-default-shy);
  font-size: 12px;
}

// Status colors
[data-status='success'] {
  color: var(--theme-color-success);
}

[data-status='error'] {
  color: var(--theme-color-error);
}
```

## Implementation Steps

### Step 1: Create Panel Structure (3h)

1. Create folder structure
2. Create ExecutionHistoryPanel component
3. Register panel in sidebar navigation
4. Basic layout and header

### Step 2: Implement Execution List (3h)

1. Create ExecutionList component
2. Create ExecutionItem component
3. Implement useExecutionHistory hook
4. Add loading/empty states

### Step 3: Implement Execution Detail (4h)

1. Create ExecutionDetail component
2. Create NodeStepList/NodeStepItem
3. Implement useExecutionDetail hook
4. Add JSON viewer for data display
5. Handle error display

### Step 4: Add Filters & Search (2h)

1. Create ExecutionFilters component
2. Status filter dropdown
3. Date range picker
4. Integration with list

### Step 5: Polish & Testing (3h)

1. Responsive styling
2. Keyboard navigation
3. Manual testing
4. Edge cases

## Testing Plan

### Manual Testing

- [ ] Panel appears in sidebar
- [ ] Executions load correctly
- [ ] Clicking execution shows detail
- [ ] Back button returns to list
- [ ] Filter by status works
- [ ] Filter by date works
- [ ] Node steps display correctly
- [ ] Input/output data renders
- [ ] Error display works
- [ ] Empty state shows correctly

### Automated Testing

- [ ] useExecutionHistory hook tests
- [ ] useExecutionDetail hook tests
- [ ] ExecutionItem renders correctly
- [ ] Filter state management

## Success Criteria

- [ ] Panel accessible from sidebar
- [ ] Execution list shows all executions
- [ ] Detail view shows full execution data
- [ ] Node steps show input/output data
- [ ] Filters work correctly
- [ ] All styles use design tokens
- [ ] No hardcoded colors
- [ ] Responsive at different panel widths

## Risks & Mitigations

| Risk                       | Mitigation                     |
| -------------------------- | ------------------------------ |
| Large execution lists slow | Virtual scrolling, pagination  |
| JSON viewer performance    | Lazy load, collapse by default |
| Missing CloudService API   | Coordinate with CF11-005       |

## References

- [UI Styling Guide](../../../reference/UI-STYLING-GUIDE.md)
- [CF11-004 Storage Schema](../CF11-004-execution-storage-schema/README.md)
- [CF11-005 Logger Integration](../CF11-005-execution-logger-integration/README.md)
- [GitHubPanel](../../../../packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/) - Similar panel pattern
