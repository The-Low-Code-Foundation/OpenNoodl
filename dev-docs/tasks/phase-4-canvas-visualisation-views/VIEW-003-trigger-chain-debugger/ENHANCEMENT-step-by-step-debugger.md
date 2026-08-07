# VIEW-003 Enhancement: Step-by-Step Debugger

**Status**: Proposed  
**Priority**: Medium  
**Estimated Effort**: 2-3 days  
**Dependencies**: VIEW-003 (completed)

## Overview

Add step-by-step execution capabilities to the Trigger Chain Debugger, allowing developers to pause runtime execution and step through events one at a time. This transforms the debugger from a post-mortem analysis tool into an active debugging tool.

## Current State

VIEW-003 currently provides:

- ✅ Real-time event recording
- ✅ Timeline visualization showing all captured events
- ✅ Click navigation to components
- ✅ Live updates during recording

However, all events are captured and displayed in bulk. There's no way to pause execution or step through events individually.

## Proposed Features

### Phase 1: Pause/Resume Control

**Runtime Pause Mechanism**

- Add pause/resume controls to the debugger panel
- When paused, buffer runtime events instead of executing them
- Display "Paused" state in UI with visual indicator
- Show count of buffered events waiting to execute

**UI Changes**

- Add "Pause" button (converts to "Resume" when paused)
- Visual state: Recording (green) → Paused (yellow) → Stopped (gray)
- Indicator showing buffered event count

**Technical Approach**

```typescript
class TriggerChainRecorder {
  private isPaused: boolean = false;
  private bufferedEvents: TriggerEvent[] = [];

  public pauseExecution(): void {
    this.isPaused = true;
    // Signal to ViewerConnection to buffer events
  }

  public resumeExecution(): void {
    this.isPaused = false;
    // Flush buffered events
  }
}
```

### Phase 2: Step Navigation

**Next/Previous Controls**

- "Step Next" button: Execute one buffered event and pause again
- "Step Previous" button: Rewind to previous event (requires event replay)
- Keyboard shortcuts: N (next), P (previous)

**Event Reveal**

- When stepping, reveal only the current event in timeline
- Highlight the active event being executed
- Gray out future events not yet revealed
- Show preview of next event in queue

**UI Layout**

```
┌─────────────────────────────────────┐
│ [Pause] [Resume] [Step ←] [Step →] │
│                                      │
│ Current Event: 3 / 15                │
│ ┌──────────────────────────────────┐│
│ │ 1. Button.Click → Nav          │ │
│ │ 2. Nav.Navigate → Page          │ │
│ │ ▶ 3. Page.Mount → ShowToast    │ │ <- Active
│ │ ? 4. [Hidden]                  │ │
│ │ ? 5. [Hidden]                   │ │
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Phase 3: Breakpoints (Optional Advanced Feature)

**Conditional Breakpoints**

- Set breakpoints on specific nodes or components
- Pause execution when event involves that node
- Condition editor: "Pause when component === 'MyComponent'"

**Breakpoint UI**

- Click node type/component to add breakpoint
- Red dot indicator on breakpoint items
- Breakpoint panel showing active breakpoints

## Implementation Details

### 1. Runtime Coordination

**Challenge**: The recorder runs in the editor process, but events come from the preview (separate process via ViewerConnection).

**Solution Options**:

**Option A: Event Buffering (Simpler)**

- Don't actually pause the runtime
- Buffer events in the recorder
- Reveal them one-by-one in the UI
- Limitation: Can't pause actual execution, only visualization

**Option B: Runtime Control (Complex)**

- Send pause/resume commands to ViewerConnection
- ViewerConnection signals the runtime to pause node execution
- Requires runtime modifications to support pausing
- More invasive but true step-by-step execution

**Recommendation**: Start with Option A (event buffering) as it's non-invasive and provides 90% of the value. Option B can be a future enhancement if needed.

### 2. State Management

```typescript
interface StepDebuggerState {
  mode: 'recording' | 'paused' | 'stepping' | 'stopped';
  currentStep: number;
  totalEvents: number;
  bufferedEvents: TriggerEvent[];
  revealedEvents: TriggerEvent[];
  breakpoints: Breakpoint[];
}

interface Breakpoint {
  id: string;
  type: 'node' | 'component' | 'event-type';
  target: string; // node ID, component name, or event type
  condition?: string; // Optional expression
  enabled: boolean;
}
```

### 3. New UI Components

**StepControls.tsx**

- Pause/Resume buttons
- Step Next/Previous buttons
- Current step indicator
- Playback speed slider (1x, 2x, 0.5x)

**BreakpointPanel.tsx** (Phase 3)

- List of active breakpoints
- Add/remove breakpoint controls
- Enable/disable toggles

### 4. Keyboard Shortcuts

| Key     | Action                                   |
| ------- | ---------------------------------------- |
| Space   | Pause/Resume                             |
| N or →  | Step Next                                |
| P or ←  | Step Previous                            |
| Shift+N | Step Over (skip to next top-level event) |
| B       | Toggle breakpoint on selected event      |

## User Workflow

### Example: Debugging a Button → Toast Chain

1. User clicks "Record" in Trigger Chain Debugger
2. User clicks "Pause" button
3. User clicks button in preview
4. Events are captured but not revealed (buffered)
5. User clicks "Step Next"
6. First event appears: "Button.Click"
7. User clicks "Step Next"
8. Second event appears: "Navigate"
9. User clicks "Step Next"
10. Third event appears: "Page.Mount"
11. ... continue until issue found

### Benefits

- See exactly what happens at each step
- Understand event order and timing
- Isolate which event causes unexpected behavior
- Educational tool for understanding Noodl execution

## Technical Risks & Mitigations

**Risk 1: Performance**

- Buffering many events could cause memory issues
- **Mitigation**: Limit buffer size (e.g., 100 events), circular buffer

**Risk 2: Event Replay Complexity**

- "Step Previous" requires replaying events from start
- **Mitigation**: Phase 1/2 don't include rewind, only forward stepping

**Risk 3: Runtime Coupling**

- Deep integration with runtime could be brittle
- **Mitigation**: Use event buffering approach (Option A) to avoid runtime modifications

## Success Criteria

- [ ] Can pause recording and buffer events
- [ ] Can step through events one at a time
- [ ] Timeline updates correctly showing only revealed events
- [ ] Active event is clearly highlighted
- [ ] Works smoothly with existing VIEW-003 features (click navigation, stats)
- [ ] No performance degradation with 100+ events

## Out of Scope

- Event replay / time-travel debugging
- Modifying event data mid-execution
- Recording to file / session persistence
- Remote debugging (debugging other users' sessions)

## Future Enhancements

- Export step-by-step recording as animated GIF
- Share debugging session URL
- Collaborative debugging (multiple developers viewing same session)
- AI-powered issue detection ("This event seems unusual")

## Related Work

- Chrome DevTools: Sources tab with breakpoints and stepping
- Redux DevTools: Time-travel debugging
- React DevTools: Component tree inspection with highlighting

## Resources Needed

- 1-2 days for Phase 1 (pause/resume with buffering)
- 1 day for Phase 2 (step navigation UI)
- 1 day for Phase 3 (breakpoints) - optional

**Total: 2-3 days for Phases 1-2**

---

**Notes**:

- This enhancement builds on VIEW-003 which provides the recording infrastructure
- The buffering approach (Option A) is recommended for V1 to minimize risk
- Can gather user feedback before investing in true runtime pause (Option B)
