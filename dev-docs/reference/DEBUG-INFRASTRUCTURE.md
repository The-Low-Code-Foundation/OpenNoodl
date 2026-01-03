# Debug Infrastructure

> **Purpose:** Documents Noodl's existing runtime debugging capabilities that the Trigger Chain Debugger will extend.

**Status:** Initial documentation (Phase 1A of VIEW-003)  
**Last Updated:** January 3, 2026

---

## Overview

Noodl has powerful runtime debugging that shows what's happening in the preview window:

- **Connection pulsing** - Connections animate when data flows
- **Inspector values** - Shows live data in pinned inspectors
- **Runtime→Editor bridge** - Events flow from preview to editor canvas

The Trigger Chain Debugger extends this by **recording** these events into a reviewable timeline.

---

## DebugInspector System

**Location:** `packages/noodl-editor/src/editor/src/utils/debuginspector.js`

### Core Components

#### 1. `DebugInspector` (Singleton)

Manages connection pulse animations and inspector values.

**Key Properties:**

```javascript
{
  connectionsToPulseState: {},  // Active pulsing connections
  connectionsToPulseIDs: [],    // Cached array of IDs
  inspectorValues: {},           // Current inspector values
  enabled: true                  // Debug mode toggle
}
```

**Key Methods:**

- `setConnectionsToPulse(connections)` - Start pulsing connections
- `setInspectorValues(inspectorValues)` - Update inspector data
- `isConnectionPulsing(connection)` - Check if connection is animating
- `valueForConnection(connection)` - Get current value
- `reset()` - Clear all debug state

#### 2. `DebugInspector.InspectorsModel`

Manages pinned inspector positions and persistence.

**Key Methods:**

- `addInspectorForConnection(args)` - Pin a connection inspector
- `addInspectorForNode(args)` - Pin a node inspector
- `removeInspector(inspector)` - Unpin inspector

---

## Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    RUNTIME (Preview)                         │
│                                                              │
│  Node executes → Data flows → Connection pulses             │
│                                                              │
│                       │                                      │
│                       ▼                                      │
│            Sends event to editor                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 VIEWER CONNECTION                            │
│                                                              │
│  - Receives 'debuginspectorconnectionpulse' command          │
│  - Receives 'debuginspectorvalues' command                   │
│  - Forwards to DebugInspector                                │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 DEBUG INSPECTOR                              │
│                                                              │
│  - Updates connectionsToPulseState                           │
│  - Updates inspectorValues                                   │
│  - Notifies listeners                                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│               NODE GRAPH EDITOR                              │
│                                                              │
│  - Subscribes to 'DebugInspectorConnectionPulseChanged'      │
│  - Animates connections on canvas                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Events Emitted

DebugInspector uses `EventDispatcher` to notify listeners:

| Event Name                                | When Fired              | Data        |
| ----------------------------------------- | ----------------------- | ----------- |
| `DebugInspectorConnectionPulseChanged`    | Connection pulse state  | None        |
| `DebugInspectorDataChanged.<inspectorId>` | Inspector value updated | `{ value }` |
| `DebugInspectorReset`                     | Debug state cleared     | None        |
| `DebugInspectorEnabledChanged`            | Debug mode toggled      | None        |

---

## ViewerConnection Bridge

**Location:** `packages/noodl-editor/src/editor/src/ViewerConnection.ts`

### Commands from Runtime

| Command                         | Content                  | Handler                   |
| ------------------------------- | ------------------------ | ------------------------- |
| `debuginspectorconnectionpulse` | `{ connectionsToPulse }` | `setConnectionsToPulse()` |
| `debuginspectorvalues`          | `{ inspectors }`         | `setInspectorValues()`    |

### Commands to Runtime

| Command                 | Content          | Purpose                          |
| ----------------------- | ---------------- | -------------------------------- |
| `debuginspector`        | `{ inspectors }` | Send inspector config to runtime |
| `debuginspectorenabled` | `{ enabled }`    | Enable/disable debug mode        |

---

## Connection Pulse Animation

Connections "pulse" when data flows through them:

1. Runtime detects connection activity
2. Sends connection ID to editor
3. DebugInspector adds to `connectionsToPulseState`
4. Animation frame loop updates opacity/offset
5. Canvas redraws with animated styling

**Animation Properties:**

```javascript
{
  created: timestamp,   // When pulse started
  offset: number,       // Animation offset (life / 20)
  opacity: number,      // Fade in/out (0-1)
  removed: timestamp    // When pulse ended (or false)
}
```

---

## For Trigger Chain Recorder

**What we can leverage:**

✅ **Connection pulse events** - Tells us when nodes fire  
✅ **Inspector values** - Gives us data flowing through connections  
✅ **ViewerConnection bridge** - Already connects runtime↔editor  
✅ **Event timing** - `performance.now()` used for timestamps

**What we need to add:**

❌ **Causal tracking** - What triggered what?  
❌ **Component boundaries** - When entering/exiting components  
❌ **Event persistence** - Currently only shows "now", we need history  
❌ **Node types** - What kind of node fired (REST, Variable, etc.)

---

## Next Steps (Phase 1B)

1. Investigate runtime node execution hooks
2. Find where to intercept node events
3. Determine how to track causality
4. Design TriggerChainRecorder interface

---

## References

- `packages/noodl-editor/src/editor/src/utils/debuginspector.js`
- `packages/noodl-editor/src/editor/src/ViewerConnection.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` (pulse rendering)
