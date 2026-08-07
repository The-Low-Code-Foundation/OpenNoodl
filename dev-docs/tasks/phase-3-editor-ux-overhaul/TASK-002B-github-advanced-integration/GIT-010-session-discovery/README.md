# GIT-010: Session Discovery & Joining

## Overview

**Priority:** High  
**Estimated Hours:** 50-70  
**Dependencies:** GIT-007, GIT-009  
**Status:** 🔴 Not Started

Streamline the session discovery and joining experience with deep linking, quick join flows, session previews, and favorites.

---

## Strategic Context

This task focuses on reducing friction for joining collaboration sessions:

- **Deep links** - Share `opennoodl://` links that open directly in the app
- **Quick join** - One-click joining from invites
- **Session preview** - See what you're joining before committing
- **History** - Remember past sessions for easy rejoin
- **Favorites** - Bookmark sessions you join frequently

---

## Technical Requirements

### 1. Deep Link Protocol

Register `opennoodl://` protocol handler for session joining:

```
Examples:
opennoodl://session/abc123
opennoodl://session/abc123?audio=true&video=false
opennoodl://community/add?repo=user/my-community
opennoodl://component/install?repo=user/repo&component=DataGrid
```

**Protocol Handlers:**

| Path                | Description                 |
| ------------------- | --------------------------- |
| `session/{roomId}`  | Join collaboration session  |
| `community/add`     | Add community by repo URL   |
| `component/install` | Install component from repo |

### 2. DeepLinkHandler Service

**File:** `packages/noodl-editor/src/editor/src/utils/DeepLinkHandler.ts`

```typescript
class DeepLinkHandler {
  // Register handlers for different paths
  register(path: string, handler: (params: any) => void): void;

  // Parse and handle incoming URL
  handleUrl(url: string): void;

  // Generate shareable link
  generateLink(path: string, params?: Record<string, string>): string;
}
```

**Electron Integration:**

- Register protocol on app startup
- Handle `app.on('open-url')` for links when app is running
- Handle `process.argv` for links that launch the app

### 3. Session Preview

Before joining, show session details:

```
┌─────────────────────────────────────────┐
│ Join Collaboration Session          ✕   │
├─────────────────────────────────────────┤
│                                         │
│   [Avatar] Alice is hosting             │
│                                         │
│   📌 Building a User Dashboard          │
│   Working on the main dashboard layout  │
│   and navigation components.            │
│                                         │
│   ┌─────────┬─────────┬─────────┐       │
│   │ 👥 4/10 │ 📁 Proj │ 🕐 45m  │       │
│   └─────────┴─────────┴─────────┘       │
│                                         │
│   Features:                             │
│   🎤 Audio Chat  🖥️ Screen Share        │
│                                         │
│   Participants:                         │
│   [A] [B] [C] [D]                       │
│                                         │
│   ┌────────────────────────────────┐    │
│   │ ☑ Join with audio enabled      │    │
│   │ ☐ Join with video enabled      │    │
│   └────────────────────────────────┘    │
│                                         │
│   [Cancel]              [Join Session]  │
└─────────────────────────────────────────┘
```

### 4. Quick Join Widget

Floating widget for incoming invites:

```
┌─────────────────────────────────────┐
│ 👥 Collaboration Invite      [−] [✕]│
├─────────────────────────────────────┤
│ [Avatar] Alice invited you          │
│                                     │
│ "Building a User Dashboard"         │
│                                     │
│ 👥 4 participants  🎤 Audio         │
│                                     │
│ [Decline]          [Join Now]       │
└─────────────────────────────────────┘
```

### 5. Session History Manager

**File:** `packages/noodl-editor/src/editor/src/services/SessionHistoryManager.ts`

```typescript
interface SessionHistoryEntry {
  sessionId: string;
  roomId: string;
  title: string;
  host: {
    userId: string;
    name: string;
    avatar?: string;
  };
  joinedAt: Date;
  leftAt?: Date;
  duration: number;
  isFavorite: boolean;
}

class SessionHistoryManager {
  // Add entry when joining session
  addEntry(session: any): void;

  // Update entry when leaving
  updateEntry(sessionId: string, updates: Partial<SessionHistoryEntry>): void;

  // Toggle favorite
  toggleFavorite(sessionId: string): void;

  // Get all history
  getHistory(): SessionHistoryEntry[];

  // Get favorites only
  getFavorites(): SessionHistoryEntry[];
}
```

---

## User Flows

### Joining via Deep Link

1. User clicks `opennoodl://session/abc123` link
2. App opens (or focuses if already open)
3. Session preview dialog appears
4. User configures join options
5. Click "Join Session"
6. WebRTC connection established

### Joining via Invitation

1. Notification appears (toast + notification center)
2. Click "Join Now" on toast OR
3. Open notification center, click invitation
4. Session preview dialog appears
5. Configure and join

### Joining from History

1. Open "Recent Sessions" panel
2. See list of past sessions
3. Click session to preview
4. If session still active, join option shown
5. Join or view details

### Managing Favorites

1. During/after session, click star icon
2. Session added to favorites
3. Favorites show in dedicated section
4. Quick access for frequently joined sessions

---

## Implementation Tasks

### Phase 1: Deep Link Handler (10-15 hours)

- [ ] Create `DeepLinkHandler.ts` service
- [ ] Implement protocol registration in Electron
- [ ] Handle `open-url` event
- [ ] Handle startup with URL argument
- [ ] Implement session handler
- [ ] Implement community handler
- [ ] Implement component handler
- [ ] Generate shareable links

### Phase 2: Session Preview (10-15 hours)

- [ ] Create `SessionPreview.tsx` dialog
- [ ] Fetch session info from signaling server
- [ ] Display host, participants, features
- [ ] Implement join options checkboxes
- [ ] Handle session not found
- [ ] Handle session full
- [ ] Implement "Join" action

### Phase 3: Quick Join Widget (8-12 hours)

- [ ] Create `QuickJoinWidget.tsx` component
- [ ] Implement minimize/close functionality
- [ ] Connect to notification manager
- [ ] Implement "Join Now" action
- [ ] Implement "Decline" action
- [ ] Add animations

### Phase 4: Session History (12-16 hours)

- [ ] Create `SessionHistoryManager.ts` service
- [ ] Implement local storage persistence
- [ ] Create `SessionHistory.tsx` panel
- [ ] Display recent sessions list
- [ ] Implement favorites toggle
- [ ] Create `SessionHistoryItem.tsx` component
- [ ] Implement rejoin from history
- [ ] Add "Clear History" option

### Phase 5: Integration (10-12 hours)

- [ ] Add session info API to signaling server
- [ ] Add "Copy Link" button to active sessions
- [ ] Add session history to Community panel
- [ ] Add favorites section
- [ ] Test cross-platform deep links
- [ ] Test with various link scenarios

---

## Verification Steps

- [ ] `opennoodl://` links open the app
- [ ] Session preview loads correctly
- [ ] Can join session from deep link
- [ ] Quick join widget appears for invites
- [ ] Can minimize/dismiss widget
- [ ] Session history saves correctly
- [ ] Can favorite sessions
- [ ] Can rejoin from history
- [ ] Copy link generates correct URL
- [ ] Works on Windows, Mac, Linux

---

## Files to Create

```
packages/noodl-editor/src/editor/src/utils/
├── DeepLinkHandler.ts               # Protocol handler

packages/noodl-editor/src/editor/src/services/
├── SessionHistoryManager.ts         # History persistence

packages/noodl-editor/src/editor/src/views/
├── SessionPreview/
│   ├── SessionPreview.tsx           # Preview dialog
│   └── SessionPreview.module.scss
├── QuickJoinWidget/
│   ├── QuickJoinWidget.tsx          # Floating invite widget
│   └── QuickJoinWidget.module.scss
├── SessionHistory/
│   ├── SessionHistory.tsx           # History panel
│   ├── SessionHistory.module.scss
│   └── SessionHistoryItem.tsx

packages/noodl-editor/src/main/
├── protocol-handler.js              # Electron protocol registration
```

---

## Signaling Server API Extension

Add endpoint for session info (without joining):

```
GET /session/{roomId}/info

Response:
{
  "roomId": "abc123",
  "title": "Building a User Dashboard",
  "description": "Working on dashboard layout",
  "host": {
    "userId": "alice",
    "name": "Alice Smith",
    "avatar": "https://..."
  },
  "participants": [
    { "userId": "bob", "name": "Bob", "avatar": "..." },
    ...
  ],
  "participantCount": 4,
  "maxParticipants": 10,
  "features": {
    "audioEnabled": true,
    "videoEnabled": false,
    "screenShareEnabled": true
  },
  "duration": 2700, // seconds
  "createdAt": "2026-01-18T10:00:00Z"
}

404 if session not found
```

---

## Platform-Specific Notes

### macOS

- Protocol registered via `app.setAsDefaultProtocolClient()`
- Already running app receives `open-url` event

### Windows

- Protocol registered in registry via `app.setAsDefaultProtocolClient()`
- Deep links passed via `process.argv`
- May require admin for first registration

### Linux

- Desktop file registration
- Varies by distribution
- Consider XDG protocol handler

---

## Related Tasks

- **GIT-007**: WebRTC Collaboration (provides joining mechanics)
- **GIT-008**: Notification System (delivers invites)
- **GIT-009**: Community UI (displays sessions)
