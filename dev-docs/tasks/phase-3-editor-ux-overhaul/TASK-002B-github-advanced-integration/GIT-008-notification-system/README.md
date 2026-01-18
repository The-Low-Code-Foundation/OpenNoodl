# GIT-008: Notification System

## Overview

**Priority:** High  
**Estimated Hours:** 50-70  
**Dependencies:** GIT-006 (Notification Server)  
**Status:** 🔴 Not Started

Implement persistent cross-session notification system for collaboration invites, community events, mentions, and updates.

---

## Strategic Context

Notifications bridge sessions - they ensure users don't miss:

- **Collaboration invites** - Someone wants to work with you
- **Mentions** - Someone referenced you in a discussion
- **Session updates** - Public session started by someone you follow
- **Component updates** - New component published in your community
- **System messages** - Important announcements

---

## Technical Requirements

### 1. NotificationManager Service

**File:** `packages/noodl-editor/src/editor/src/services/NotificationManager.ts`

```typescript
interface Notification {
  id: string;
  userId: string;
  fromUserId?: string;
  type: 'invite' | 'mention' | 'thread' | 'session' | 'component' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  expiresAt: Date;
  readAt?: Date;
  actions?: NotificationAction[];
}

interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
}
```

**Key Methods:**

| Method                                 | Description                    |
| -------------------------------------- | ------------------------------ |
| `initialize(userId)`                   | Connect to notification server |
| `getNotifications()`                   | Get all notifications          |
| `getUnreadCount()`                     | Get unread count               |
| `markAsRead(id)`                       | Mark notification as read      |
| `deleteNotification(id)`               | Delete a notification          |
| `sendNotification(userId, type, data)` | Send to another user           |
| `destroy()`                            | Disconnect and cleanup         |

### 2. Notification Types

| Type        | Trigger                            | Actions        |
| ----------- | ---------------------------------- | -------------- |
| `invite`    | Someone invites you to collaborate | Join, Decline  |
| `mention`   | Someone mentions you in discussion | View Thread    |
| `thread`    | New reply in discussion you follow | View Thread    |
| `session`   | Public session started             | Join Session   |
| `component` | New component in your community    | View Component |
| `system`    | System announcement                | Dismiss        |

### 3. Toast Notifications

Real-time toasts for new notifications:

```typescript
// Toast component structure
interface ToastProps {
  notification: Notification;
  onAction: (action: string) => void;
  onDismiss: () => void;
}

// Toast behavior
- Appears bottom-right of editor
- Auto-dismisses after 10 seconds
- Can be clicked for quick action
- Can be swiped to dismiss
- Queue system for multiple notifications
```

### 4. Notification Center

Panel/popover for viewing all notifications:

```
┌─────────────────────────────────┐
│ Notifications               ✕   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 👥 Collaboration Invite     │ │
│ │ Alice invited you to        │ │
│ │ "Building a Dashboard"      │ │
│ │ [Join] [Decline]      2m ago│ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📦 New Component            │ │
│ │ Bob published "DataGrid"    │ │
│ │ [View]                 1h ago│ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 💬 Discussion Reply         │ │
│ │ Charlie replied to your     │ │
│ │ question about routing      │ │
│ │ [View Thread]          3h ago│ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [Mark All Read]  [Clear All]    │
└─────────────────────────────────┘
```

### 5. Desktop Notifications

Leverage Electron's native notification API:

```typescript
// Show native notification
new Notification('Collaboration Invite', {
  body: 'Alice invited you to collaborate',
  icon: '/path/to/icon.png',
  tag: notification.id, // Prevents duplicates
  requireInteraction: notification.type === 'invite' // Stay until clicked
});

notification.onclick = () => {
  // Focus app and handle action
};
```

---

## User Flows

### Receiving Notification (Online)

1. Notification arrives via WebSocket
2. Toast appears in editor
3. Badge updates on notification bell
4. Desktop notification shows (if enabled)
5. User can act on toast or dismiss

### Receiving Notification (Offline)

1. Notification stored on server
2. User opens app
3. Notifications fetched on connect
4. Multiple notifications batch-displayed
5. Badge shows unread count

### Handling Notification Actions

**Invite:**

1. Click "Join" on invite notification
2. Session preview dialog opens
3. Confirm join options
4. Connect to collaboration session

**Mention/Thread:**

1. Click "View Thread"
2. Opens discussion in browser (GitHub Discussions)

**Component:**

1. Click "View Component"
2. Opens component in community panel

---

## Implementation Tasks

### Phase 1: Core Service (15-20 hours)

- [ ] Create `NotificationManager.ts` service
- [ ] Implement WebSocket connection to notification server
- [ ] Implement authentication flow
- [ ] Implement notification fetching
- [ ] Implement notification parsing/typing
- [ ] Implement mark as read
- [ ] Implement delete notification
- [ ] Implement send notification
- [ ] Add reconnection logic
- [ ] Add offline support (local storage cache)

### Phase 2: Toast UI (10-15 hours)

- [ ] Create `NotificationToast.tsx` component
- [ ] Create toast container/queue
- [ ] Implement auto-dismiss
- [ ] Implement action buttons
- [ ] Implement swipe-to-dismiss
- [ ] Add animations
- [ ] Style according to notification type

### Phase 3: Notification Center (15-20 hours)

- [ ] Create `NotificationCenter.tsx` component
- [ ] Create `NotificationItem.tsx` component
- [ ] Implement notification list with grouping
- [ ] Implement "Mark All Read"
- [ ] Implement "Clear All"
- [ ] Add notification badge to header
- [ ] Implement search/filter (optional)

### Phase 4: Desktop Notifications (5-10 hours)

- [ ] Implement Electron notification API
- [ ] Add notification settings (enable/disable)
- [ ] Handle notification click → focus app
- [ ] Add notification sound (optional)
- [ ] Test on Windows, Mac, Linux

### Phase 5: Integration (5-10 hours)

- [ ] Connect to existing authentication
- [ ] Integrate with collaboration system
- [ ] Add to editor layout
- [ ] Test end-to-end flows
- [ ] Performance optimization

---

## Verification Steps

- [ ] Notifications persist across sessions
- [ ] Toast appears when notification received
- [ ] Can mark notifications as read
- [ ] Can delete notifications
- [ ] Unread count displays correctly
- [ ] Actions trigger correct behavior
- [ ] Desktop notifications work (Electron)
- [ ] Reconnects after connection loss
- [ ] Offline notifications cached and shown on reconnect
- [ ] Expired notifications cleaned up

---

## Files to Create

```
packages/noodl-editor/src/editor/src/services/
├── NotificationManager.ts           # Main notification service
├── NotificationTypes.ts             # TypeScript interfaces

packages/noodl-editor/src/editor/src/views/
├── NotificationCenter/
│   ├── NotificationCenter.tsx       # Main panel/popover
│   ├── NotificationCenter.module.scss
│   ├── NotificationItem.tsx         # Individual notification
│   ├── NotificationBadge.tsx        # Unread count badge
│   └── NotificationEmpty.tsx        # Empty state
├── NotificationToast/
│   ├── NotificationToast.tsx        # Toast component
│   ├── NotificationToast.module.scss
│   └── ToastContainer.tsx           # Toast queue manager

packages/noodl-editor/src/editor/src/hooks/
├── useNotifications.ts              # Hook for notification state
└── useNotificationActions.ts        # Hook for notification actions
```

---

## Notification Message Format

```typescript
// Incoming notification from server
interface ServerNotification {
  id: string;
  userId: string;
  fromUserId?: string;
  type: 'invite' | 'mention' | 'thread' | 'session' | 'component' | 'system';
  data: {
    // Type-specific data
    sessionId?: string;
    sessionTitle?: string;
    threadUrl?: string;
    componentId?: string;
    componentName?: string;
    message?: string;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: string; // ISO date
  expiresAt: string; // ISO date
}
```

---

## Settings

| Setting                    | Default | Description                  |
| -------------------------- | ------- | ---------------------------- |
| `notifications.enabled`    | `true`  | Enable notifications         |
| `notifications.desktop`    | `true`  | Enable desktop notifications |
| `notifications.sound`      | `true`  | Play sound on notification   |
| `notifications.invites`    | `true`  | Show collaboration invites   |
| `notifications.mentions`   | `true`  | Show mentions                |
| `notifications.sessions`   | `true`  | Show public sessions         |
| `notifications.components` | `true`  | Show component updates       |

---

## Related Tasks

- **GIT-006**: Server Infrastructure (notification server)
- **GIT-007**: WebRTC Collaboration Client (sends invites)
- **GIT-009**: Community Tab UI (displays community notifications)
