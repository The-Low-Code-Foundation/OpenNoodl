# CF11-007: Canvas Execution Overlay

## Metadata

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **ID**             | CF11-007                                    |
| **Phase**          | Phase 11                                    |
| **Series**         | 2 - Execution History                       |
| **Priority**       | 🟡 High                                     |
| **Difficulty**     | 🟡 Medium                                   |
| **Estimated Time** | 8-10 hours                                  |
| **Prerequisites**  | CF11-004, CF11-005, CF11-006                |
| **Branch**         | `feature/cf11-007-canvas-execution-overlay` |

## Objective

Create a canvas overlay that visualizes execution data directly on workflow nodes, allowing users to "pin" an execution to the canvas and see input/output data flowing through each node.

## Background

The Execution History Panel (CF11-006) shows execution data in a list format. But for debugging, users need to see this data **in context** - overlaid directly on the nodes in the canvas.

This is similar to n8n's execution visualization where you can click on any past execution and see the data that flowed through each node, directly on the canvas.

This task builds on the existing HighlightOverlay pattern already in the codebase.

## Current State

- Execution data viewable in panel (CF11-006)
- No visualization on canvas
- Users must mentally map panel data to nodes

## Desired State

- "Pin to Canvas" button in Execution History Panel
- Overlay shows execution status on each node (green/red/gray)
- Clicking a node shows input/output data popup
- Timeline scrubber to step through execution
- Clear visual distinction from normal canvas view

## Scope

### In Scope

- [ ] ExecutionOverlay React component
- [ ] Node status badges (success/error/pending)
- [ ] Data popup on node click
- [ ] Timeline/step navigation
- [ ] Integration with ExecutionHistoryPanel
- [ ] "Unpin" to return to normal view

### Out of Scope

- Real-time streaming visualization
- Connection animation showing data flow
- Comparison between executions

## Technical Approach

### Using Existing Overlay Pattern

The codebase already has `HighlightOverlay` - we'll follow the same pattern:

```
packages/noodl-editor/src/editor/src/views/CanvasOverlays/
├── HighlightOverlay/           # Existing - reference pattern
│   ├── HighlightOverlay.tsx
│   ├── HighlightedNode.tsx
│   └── ...
└── ExecutionOverlay/           # New
    ├── index.ts
    ├── ExecutionOverlay.tsx
    ├── ExecutionOverlay.module.scss
    ├── ExecutionNodeBadge.tsx
    ├── ExecutionNodeBadge.module.scss
    ├── ExecutionDataPopup.tsx
    ├── ExecutionDataPopup.module.scss
    └── ExecutionTimeline.tsx
```

### Main Overlay Component

```tsx
// ExecutionOverlay.tsx

import { useCanvasCoordinates } from '@noodl-hooks/useCanvasCoordinates';
import { ExecutionWithSteps } from '@noodl-viewer-cloud/execution-history';
import React, { useMemo } from 'react';

import { ExecutionDataPopup } from './ExecutionDataPopup';
import { ExecutionNodeBadge } from './ExecutionNodeBadge';
import styles from './ExecutionOverlay.module.scss';
import { ExecutionTimeline } from './ExecutionTimeline';

interface Props {
  execution: ExecutionWithSteps;
  onClose: () => void;
}

export function ExecutionOverlay({ execution, onClose }: Props) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(execution.steps.length - 1);

  const nodeStepMap = useMemo(() => {
    const map = new Map<string, ExecutionStep>();
    for (const step of execution.steps) {
      if (step.stepIndex <= currentStepIndex) {
        map.set(step.nodeId, step);
      }
    }
    return map;
  }, [execution.steps, currentStepIndex]);

  const selectedStep = selectedNodeId ? nodeStepMap.get(selectedNodeId) : null;

  return (
    <div className={styles.Overlay}>
      {/* Header bar */}
      <div className={styles.Header}>
        <span className={styles.Title}>Execution: {execution.workflowName}</span>
        <span className={styles.Status} data-status={execution.status}>
          {execution.status}
        </span>
        <button className={styles.CloseButton} onClick={onClose}>
          × Close
        </button>
      </div>

      {/* Node badges */}
      {Array.from(nodeStepMap.entries()).map(([nodeId, step]) => (
        <ExecutionNodeBadge
          key={nodeId}
          nodeId={nodeId}
          step={step}
          onClick={() => setSelectedNodeId(nodeId)}
          selected={nodeId === selectedNodeId}
        />
      ))}

      {/* Data popup for selected node */}
      {selectedStep && <ExecutionDataPopup step={selectedStep} onClose={() => setSelectedNodeId(null)} />}

      {/* Timeline scrubber */}
      <ExecutionTimeline steps={execution.steps} currentIndex={currentStepIndex} onIndexChange={setCurrentStepIndex} />
    </div>
  );
}
```

### Node Badge Component

```tsx
// ExecutionNodeBadge.tsx

import { useCanvasNodePosition } from '@noodl-hooks/useCanvasNodePosition';
import { ExecutionStep } from '@noodl-viewer-cloud/execution-history';
import React from 'react';

import styles from './ExecutionNodeBadge.module.scss';

interface Props {
  nodeId: string;
  step: ExecutionStep;
  onClick: () => void;
  selected: boolean;
}

export function ExecutionNodeBadge({ nodeId, step, onClick, selected }: Props) {
  const position = useCanvasNodePosition(nodeId);

  if (!position) return null;

  const statusIcon = step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '⋯';

  return (
    <div
      className={styles.Badge}
      data-status={step.status}
      data-selected={selected}
      style={{
        left: position.x + position.width + 4,
        top: position.y - 8
      }}
      onClick={onClick}
    >
      <span className={styles.Icon}>{statusIcon}</span>
      <span className={styles.Duration}>{formatDuration(step.durationMs)}</span>
    </div>
  );
}
```

### Data Popup Component

```tsx
// ExecutionDataPopup.tsx

import { ExecutionStep } from '@noodl-viewer-cloud/execution-history';
import React from 'react';

import { JSONViewer } from '@noodl-core-ui/components/json-editor';

import styles from './ExecutionDataPopup.module.scss';

interface Props {
  step: ExecutionStep;
  onClose: () => void;
}

export function ExecutionDataPopup({ step, onClose }: Props) {
  return (
    <div className={styles.Popup}>
      <header className={styles.Header}>
        <h4>{step.nodeName || step.nodeType}</h4>
        <span className={styles.Status} data-status={step.status}>
          {step.status}
        </span>
        <button onClick={onClose}>×</button>
      </header>

      <div className={styles.Content}>
        {step.inputData && (
          <section className={styles.Section}>
            <h5>Input Data</h5>
            <JSONViewer data={step.inputData} />
          </section>
        )}

        {step.outputData && (
          <section className={styles.Section}>
            <h5>Output Data</h5>
            <JSONViewer data={step.outputData} />
          </section>
        )}

        {step.errorMessage && (
          <section className={styles.Error}>
            <h5>Error</h5>
            <pre>{step.errorMessage}</pre>
          </section>
        )}

        <section className={styles.Meta}>
          <div>Duration: {formatDuration(step.durationMs)}</div>
          <div>Started: {formatTime(step.startedAt)}</div>
        </section>
      </div>
    </div>
  );
}
```

### Timeline Scrubber

```tsx
// ExecutionTimeline.tsx

import { ExecutionStep } from '@noodl-viewer-cloud/execution-history';
import React from 'react';

import styles from './ExecutionTimeline.module.scss';

interface Props {
  steps: ExecutionStep[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function ExecutionTimeline({ steps, currentIndex, onIndexChange }: Props) {
  return (
    <div className={styles.Timeline}>
      <button disabled={currentIndex <= 0} onClick={() => onIndexChange(currentIndex - 1)}>
        ← Prev
      </button>

      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={currentIndex}
        onChange={(e) => onIndexChange(Number(e.target.value))}
      />

      <span className={styles.Counter}>
        Step {currentIndex + 1} of {steps.length}
      </span>

      <button disabled={currentIndex >= steps.length - 1} onClick={() => onIndexChange(currentIndex + 1)}>
        Next →
      </button>
    </div>
  );
}
```

### Styling

```scss
// ExecutionNodeBadge.module.scss
.Badge {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  z-index: 1000;

  &[data-status='success'] {
    background-color: var(--theme-color-success-bg);
    color: var(--theme-color-success);
  }

  &[data-status='error'] {
    background-color: var(--theme-color-error-bg);
    color: var(--theme-color-error);
  }

  &[data-status='running'] {
    background-color: var(--theme-color-bg-3);
    color: var(--theme-color-fg-default);
  }

  &[data-selected='true'] {
    outline: 2px solid var(--theme-color-primary);
  }
}
```

### Integration with ExecutionHistoryPanel

```tsx
// In ExecutionDetail.tsx, add handler:
const handlePinToCanvas = () => {
  // Dispatch event to show overlay
  EventDispatcher.instance.emit('execution:pinToCanvas', { executionId });
};

// In the main canvas view, listen:
useEventListener(EventDispatcher.instance, 'execution:pinToCanvas', ({ executionId }) => {
  setPinnedExecution(executionId);
});
```

## Implementation Steps

### Step 1: Create Overlay Structure (2h)

1. Create folder structure
2. Create ExecutionOverlay container
3. Add state management for pinned execution
4. Integration point with canvas

### Step 2: Implement Node Badges (2h)

1. Create ExecutionNodeBadge component
2. Position calculation using canvas coordinates
3. Status-based styling
4. Click handling

### Step 3: Implement Data Popup (2h)

1. Create ExecutionDataPopup component
2. JSON viewer integration
3. Positioning relative to node
4. Close handling

### Step 4: Add Timeline Navigation (1.5h)

1. Create ExecutionTimeline component
2. Step navigation logic
3. Scrubber UI
4. Keyboard shortcuts

### Step 5: Polish & Integration (2h)

1. Connect to ExecutionHistoryPanel
2. "Pin to Canvas" button
3. "Unpin" functionality
4. Edge cases and testing

## Testing Plan

### Manual Testing

- [ ] "Pin to Canvas" shows overlay
- [ ] Node badges appear at correct positions
- [ ] Badges show correct status colors
- [ ] Clicking badge shows data popup
- [ ] Popup displays input/output data
- [ ] Error nodes show error message
- [ ] Timeline scrubber works
- [ ] Step navigation updates badges
- [ ] Close button removes overlay
- [ ] Overlay survives pan/zoom

### Automated Testing

- [ ] ExecutionNodeBadge renders correctly
- [ ] Position calculations work
- [ ] Timeline navigation logic

## Success Criteria

- [ ] Pin/unpin execution to canvas works
- [ ] Node badges show execution status
- [ ] Clicking shows data popup
- [ ] Timeline allows stepping through execution
- [ ] Clear visual feedback for errors
- [ ] Overlay respects pan/zoom
- [ ] All styles use design tokens

## Risks & Mitigations

| Risk                         | Mitigation                               |
| ---------------------------- | ---------------------------------------- |
| Canvas coordinate complexity | Follow existing HighlightOverlay pattern |
| Performance with many nodes  | Virtualize badges, lazy load popups      |
| Data popup positioning       | Smart positioning to stay in viewport    |

## References

- [Canvas Overlay Architecture](../../../reference/CANVAS-OVERLAY-ARCHITECTURE.md)
- [Canvas Overlay Coordinates](../../../reference/CANVAS-OVERLAY-COORDINATES.md)
- [HighlightOverlay](../../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/HighlightOverlay/) - Pattern reference
- [CF11-006 Execution History Panel](../CF11-006-execution-history-panel/README.md)
