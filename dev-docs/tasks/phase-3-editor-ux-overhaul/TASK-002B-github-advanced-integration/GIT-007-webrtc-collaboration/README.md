# GIT-007: WebRTC Collaboration Client

## Overview

**Priority:** Critical  
**Estimated Hours:** 100-130  
**Dependencies:** GIT-005, GIT-006  
**Status:** 🔴 Not Started

Implement the client-side WebRTC collaboration system that enables real-time multi-user editing, cursor sharing, audio/video chat, and seamless fallback to WebSocket sync.

This is the **core collaboration feature** - enabling "Google Docs for visual programming."

---

## Strategic Context

This task delivers the most visible and impactful feature of the collaboration system:

- **Real-time multi-user editing** - See changes as they happen
- **Presence awareness** - Cursors, selections, viewports of all participants
- **Audio/video chat** - Built-in communication (no need for separate apps)
- **Peer-to-peer** - Low latency, no server relay for data
- **Automatic fallback** - Falls back to WebSocket when P2P fails

---

## Technical Requirements

### 1. CollaborationManager Service

**File:** `packages/noodl-editor/src/editor/src/services/CollaborationManager.ts`

Central service managing all collaboration functionality:

```typescript
interface CollaborationSession {
  id: string;
  roomId: string;
  projectId: string;
  isHost: boolean;
  isPublic: boolean;
  title: string;
  description?: string;
  maxParticipants: number;
  participants: Map<string, Participant>;
  createdAt: Date;
}

interface Participant {
  peerId: string;
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { nodeId: string };
  viewport?: { x: number; y: number; zoom: number };
  audio: { enabled: boolean; stream?: MediaStream };
  video: { enabled: boolean; stream?: MediaStream };
  isHost: boolean;
  joinedAt: Date;
}
```

**Key Methods:**

| Method                       | Description                              |
| ---------------------------- | ---------------------------------------- |
| `startSession(options)`      | Start a new collaboration session (host) |
| `joinSession(roomId)`        | Join an existing session                 |
| `leaveSession()`             | Leave current session                    |
| `inviteUser(userId)`         | Invite a user to current session         |
| `updateCursor(x, y)`         | Broadcast cursor position                |
| `updateSelection(nodeId)`    | Broadcast node selection                 |
| `updateViewport(x, y, zoom)` | Broadcast viewport state                 |
| `toggleAudio(enabled?)`      | Toggle local audio                       |
| `toggleVideo(enabled?)`      | Toggle local video                       |

### 2. WebRTC Connection Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Peer A     │     │  Signaling Server │     │   Peer B     │
└──────┬───────┘     └────────┬─────────┘     └──────┬───────┘
       │                      │                      │
       │   1. join(room)      │                      │
       │─────────────────────>│                      │
       │                      │                      │
       │   2. joined(peers)   │                      │
       │<─────────────────────│                      │
       │                      │                      │
       │                      │   3. join(room)      │
       │                      │<─────────────────────│
       │                      │                      │
       │                      │   4. peer-joined     │
       │<─────────────────────│─────────────────────>│
       │                      │                      │
       │   5. signal(offer)   │                      │
       │─────────────────────>│─────────────────────>│
       │                      │                      │
       │                      │   6. signal(answer)  │
       │<─────────────────────│<─────────────────────│
       │                      │                      │
       │   7. P2P Connection Established            │
       │<═══════════════════════════════════════════>│
```

### 3. Yjs Integration (CRDT Sync)

Use Yjs for conflict-free replicated data types:

```typescript
// Document structure
const doc = new Y.Doc();
const yNodes = doc.getArray('nodes');
const yConnections = doc.getArray('connections');
const yProperties = doc.getMap('properties');

// Awareness (cursors, selections - not persisted)
const awareness = provider.awareness;
awareness.setLocalState({
  user: { name, color, avatar },
  cursor: { x, y },
  selection: { nodeId }
});
```

### 4. Connection Fallback Strategy

```
1. Try WebRTC P2P (y-webrtc)
   ↓ (if fails after 5 seconds)
2. Try WebSocket via Sync Server (y-websocket)
   ↓ (if fails)
3. Show error, allow retry
```

### 5. Media Handling (Audio/Video)

```typescript
// Initialize local media
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true },
  video: { width: 1280, height: 720 }
});

// Attach to peer connection
peer.addStream(stream);

// Handle remote streams
peer.on('stream', (remoteStream) => {
  // Display in participant's video element
});
```

---

## User Flows

### Starting a Session (Host)

1. Click "Start Collaboration" in editor toolbar
2. Fill in session details (title, description, public/private)
3. Configure options (audio, video, max participants)
4. Session starts, room ID generated
5. Copy link or invite users directly

### Joining a Session (Guest)

1. Receive invitation notification OR click session link
2. Preview session details
3. Configure join options (audio, video)
4. Click "Join"
5. WebRTC connection established
6. Project state synced

### During Session

- See other participants' cursors (colored)
- See other participants' selections (highlighted)
- See avatar thumbnails of participants
- Optionally see video feeds
- Changes to nodes sync in real-time
- Can toggle audio/video anytime

### Leaving a Session

1. Click "Leave Session"
2. Confirm if host (session continues or ends)
3. Cleanup: stop media, close connections
4. Return to solo editing mode

---

## Implementation Tasks

### Phase 1: Core Service (20-25 hours)

- [ ] Create `CollaborationManager.ts` service
- [ ] Implement session creation (host)
- [ ] Implement session joining (guest)
- [ ] Implement signaling server communication
- [ ] Implement WebRTC peer connections
- [ ] Implement graceful disconnection

### Phase 2: Yjs Integration (20-25 hours)

- [ ] Set up Yjs document structure
- [ ] Implement WebRTC provider (y-webrtc)
- [ ] Implement WebSocket fallback (y-websocket)
- [ ] Sync project nodes to Yjs
- [ ] Sync project connections to Yjs
- [ ] Handle remote changes in ProjectModel
- [ ] Implement conflict resolution UI

### Phase 3: Awareness (15-20 hours)

- [ ] Implement cursor position broadcasting
- [ ] Implement selection broadcasting
- [ ] Implement viewport broadcasting
- [ ] Create remote cursor renderer
- [ ] Create remote selection highlighter
- [ ] Add participant list UI

### Phase 4: Media (20-25 hours)

- [ ] Implement local audio capture
- [ ] Implement local video capture
- [ ] Implement audio/video toggle
- [ ] Display remote audio (spatial if possible)
- [ ] Display remote video feeds
- [ ] Handle media permission errors

### Phase 5: UI Components (15-20 hours)

- [ ] Create collaboration toolbar
- [ ] Create start session dialog
- [ ] Create join session dialog
- [ ] Create participant list panel
- [ ] Create video grid component
- [ ] Create session info panel

### Phase 6: Integration (10-15 hours)

- [ ] Integrate with existing editor
- [ ] Add collaboration indicators to canvas
- [ ] Handle undo/redo in collaboration mode
- [ ] Test with multiple participants
- [ ] Performance optimization

---

## Verification Steps

- [ ] Can start a collaboration session
- [ ] Can join a session via room ID
- [ ] WebRTC peers connect automatically
- [ ] Cursor positions sync in real-time
- [ ] Node changes sync across all peers
- [ ] Selections visible to all participants
- [ ] Audio chat works between peers
- [ ] Video feeds display correctly
- [ ] Falls back to WebSocket when WebRTC fails
- [ ] Can toggle audio/video during session
- [ ] Disconnections handled gracefully
- [ ] Session persists if host leaves temporarily
- [ ] Can invite users to session

---

## Files to Create

```
packages/noodl-editor/src/editor/src/services/
├── CollaborationManager.ts          # Main collaboration service
├── CollaborationTypes.ts            # TypeScript interfaces
├── CollaborationYjsAdapter.ts       # Yjs <-> ProjectModel adapter
└── CollaborationMediaManager.ts     # Audio/video handling

packages/noodl-editor/src/editor/src/views/
├── CollaborationToolbar/
│   ├── CollaborationToolbar.tsx
│   ├── CollaborationToolbar.module.scss
│   ├── StartSessionDialog.tsx
│   ├── JoinSessionDialog.tsx
│   └── SessionInfoPanel.tsx
├── CollaborationOverlay/
│   ├── RemoteCursors.tsx            # Render remote cursors on canvas
│   ├── RemoteSelections.tsx         # Render remote selections
│   └── ParticipantAvatars.tsx       # Show participant list
└── CollaborationVideo/
    ├── VideoGrid.tsx                # Video feed layout
    └── LocalVideo.tsx               # Self-view

packages/noodl-editor/src/editor/src/hooks/
├── useCollaboration.ts              # Hook for collaboration state
├── useRemoteCursors.ts              # Hook for cursor rendering
└── useMediaStream.ts                # Hook for audio/video
```

---

## Dependencies to Add

```json
{
  "yjs": "^13.6.0",
  "y-webrtc": "^10.2.0",
  "y-websocket": "^1.5.0",
  "simple-peer": "^9.11.0",
  "lib0": "^0.2.85"
}
```

---

## Performance Considerations

1. **Cursor throttling** - Don't broadcast every mouse move (throttle to 50ms)
2. **Viewport culling** - Don't render cursors outside visible area
3. **Yjs updates** - Batch updates where possible
4. **Media quality** - Adaptive bitrate based on network conditions
5. **Connection limits** - Max 10-20 participants for performance

---

## Security Notes

1. **Room IDs** - Use UUIDs, hard to guess
2. **Signaling** - Only relay WebRTC signals, no content
3. **Media** - Encrypted via SRTP (built into WebRTC)
4. **Project data** - Synced P2P, not through server (except fallback)

---

## Related Tasks

- **GIT-005**: Community Infrastructure (provides server URLs)
- **GIT-006**: Server Infrastructure (signaling, sync, notifications)
- **GIT-008**: Notification System (for session invites)
- **GIT-010**: Session Discovery (for finding public sessions)
