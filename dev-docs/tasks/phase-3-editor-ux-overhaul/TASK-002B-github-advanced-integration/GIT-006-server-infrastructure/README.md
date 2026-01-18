# GIT-006: Server Infrastructure (Signaling, Sync, Notifications)

## Overview

**Priority:** Critical  
**Estimated Hours:** 80-100  
**Dependencies:** GIT-005 (Community Infrastructure)  
**Status:** 🔴 Not Started

Build the three core server components required for live collaboration and notifications:

1. **Signaling Server** - WebRTC peer discovery
2. **Sync Server** - WebSocket fallback for CRDT sync
3. **Notification Server** - Persistent cross-session notifications

---

## Strategic Context

These servers are the backbone of the collaboration system. They're designed to be:

- **Stateless** - Horizontally scalable
- **Self-hostable** - Community operators can run their own
- **Lightweight** - Minimal dependencies, easy to deploy
- **Observable** - Health checks, metrics, logging

---

## Technical Requirements

### 1. Signaling Server (WebRTC Peer Discovery)

Minimal WebSocket server that helps peers find each other for WebRTC connections. **No project data passes through this server.**

**Repository:** `opennoodl-signaling-server`

**Key Features:**

- Room-based peer management
- WebRTC signal relay (SDP, ICE candidates)
- Heartbeat for dead connection detection
- Invite forwarding for online users
- Prometheus-compatible metrics

**Protocol Messages:**

| Message Type  | Direction        | Description                 |
| ------------- | ---------------- | --------------------------- |
| `join`        | Client → Server  | Join a collaboration room   |
| `joined`      | Server → Client  | Confirmation with peer list |
| `peer-joined` | Server → Clients | New peer joined room        |
| `peer-left`   | Server → Clients | Peer left room              |
| `signal`      | Bidirectional    | WebRTC signaling data       |
| `invite`      | Client → Server  | Invite user to session      |
| `error`       | Server → Client  | Error notification          |

**Environment Variables:**

| Variable             | Default | Description             |
| -------------------- | ------- | ----------------------- |
| `PORT`               | 4444    | Server port             |
| `MAX_ROOM_SIZE`      | 20      | Maximum peers per room  |
| `HEARTBEAT_INTERVAL` | 30000   | Heartbeat interval (ms) |

**Endpoints:**

| Endpoint   | Method    | Description                 |
| ---------- | --------- | --------------------------- |
| `/health`  | GET       | Health check (returns JSON) |
| `/metrics` | GET       | Prometheus metrics          |
| `/`        | WebSocket | Signaling connection        |

---

### 2. Sync Server (WebSocket Fallback)

Traditional WebSocket server using Yjs for CRDT synchronization. Used when WebRTC peer-to-peer fails.

**Repository:** `opennoodl-sync-server`

**Key Features:**

- Yjs WebSocket provider compatibility
- Optional LevelDB persistence
- Automatic garbage collection
- Document isolation by room

**Environment Variables:**

| Variable             | Default  | Description                |
| -------------------- | -------- | -------------------------- |
| `PORT`               | 4445     | Server port                |
| `PERSIST_DIR`        | `./data` | Persistence directory      |
| `ENABLE_PERSISTENCE` | `true`   | Enable LevelDB persistence |

**Dependencies:**

- `yjs` - CRDT library
- `y-websocket` - WebSocket provider
- `y-leveldb` - Optional persistence

---

### 3. Notification Server (Persistent Notifications)

Server for managing cross-session notifications (invites, community events, mentions).

**Repository:** `opennoodl-notification-server`

**Key Features:**

- WebSocket-based real-time delivery
- Persistent storage (survives server restart)
- Automatic TTL-based cleanup
- Multi-device support (same user on multiple devices)
- Notification types: invite, mention, thread, session, component, system

**Protocol Messages:**

| Message Type          | Direction       | Description               |
| --------------------- | --------------- | ------------------------- |
| `authenticate`        | Client → Server | Authenticate with user ID |
| `authenticated`       | Server → Client | Auth confirmation         |
| `get-notifications`   | Client → Server | Request notification list |
| `notifications`       | Server → Client | List of notifications     |
| `notification`        | Server → Client | New notification          |
| `mark-read`           | Client → Server | Mark notification as read |
| `delete-notification` | Client → Server | Delete a notification     |
| `send-notification`   | Client → Server | Send to another user      |

**Environment Variables:**

| Variable   | Default                | Description                |
| ---------- | ---------------------- | -------------------------- |
| `PORT`     | 4446                   | Server port                |
| `DB_FILE`  | `./notifications.json` | Database file path         |
| `TTL_DAYS` | 30                     | Notification expiry (days) |

---

## Deployment Options

### Docker Compose (Recommended for Self-Hosting)

```yaml
version: '3.8'

services:
  signaling:
    build: ./opennoodl-signaling-server
    ports:
      - '4444:4444'
    environment:
      - PORT=4444
      - MAX_ROOM_SIZE=20
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4444/health']
      interval: 30s
      timeout: 10s
      retries: 3

  sync:
    build: ./opennoodl-sync-server
    ports:
      - '4445:4445'
    environment:
      - PORT=4445
      - ENABLE_PERSISTENCE=true
      - PERSIST_DIR=/data
    volumes:
      - sync-data:/data
    restart: unless-stopped

  notifications:
    build: ./opennoodl-notification-server
    ports:
      - '4446:4446'
    environment:
      - PORT=4446
      - DB_FILE=/data/notifications.json
      - TTL_DAYS=30
    volumes:
      - notification-data:/data
    restart: unless-stopped

volumes:
  sync-data:
  notification-data:
```

### One-Click Deploy Options

Each server includes configuration for:

- **Railway** (`railway.json`)
- **Render** (`render.yaml`)
- **Fly.io** (`fly.toml`)

---

## Implementation Tasks

### Signaling Server

- [ ] Create `opennoodl-signaling-server` repository
- [ ] Implement WebSocket server with room management
- [ ] Implement peer join/leave handling
- [ ] Implement signal relay
- [ ] Implement invite forwarding
- [ ] Add heartbeat for dead connection detection
- [ ] Add health check endpoint
- [ ] Add Prometheus metrics endpoint
- [ ] Create Dockerfile
- [ ] Create one-click deploy configs
- [ ] Write deployment documentation

### Sync Server

- [ ] Create `opennoodl-sync-server` repository
- [ ] Implement Yjs WebSocket provider integration
- [ ] Add optional LevelDB persistence
- [ ] Add health check endpoint
- [ ] Create Dockerfile
- [ ] Create one-click deploy configs

### Notification Server

- [ ] Create `opennoodl-notification-server` repository
- [ ] Implement WebSocket authentication
- [ ] Implement notification storage (LowDB initially)
- [ ] Implement notification delivery
- [ ] Implement mark-read/delete operations
- [ ] Implement TTL-based cleanup
- [ ] Add multi-device support
- [ ] Add health check endpoint
- [ ] Create Dockerfile
- [ ] Create one-click deploy configs

### Deployment

- [ ] Deploy official signaling server
- [ ] Deploy official sync server
- [ ] Deploy official notification server
- [ ] Configure SSL certificates
- [ ] Set up monitoring (Grafana/Prometheus)
- [ ] Set up alerting
- [ ] Load testing

---

## Verification Steps

- [ ] Signaling server helps peers find each other
- [ ] Sync server synchronizes Yjs documents
- [ ] Notification server stores and delivers notifications
- [ ] Health endpoints return 200 OK
- [ ] Metrics endpoints expose data
- [ ] Docker Compose brings up all services
- [ ] One-click deploy works on Railway/Render
- [ ] Servers handle connection failures gracefully
- [ ] Old notifications are cleaned up automatically
- [ ] Servers restart automatically after crash

---

## Security Considerations

1. **No sensitive data in signaling** - Only relay WebRTC signals, no content
2. **Rate limiting** - Prevent abuse of all servers
3. **Authentication** - Notification server requires user auth
4. **CORS** - Properly configured for cross-origin requests
5. **WSS only** - Require secure WebSocket connections in production

---

## Scaling Notes

| Server        | Bottleneck            | Scaling Strategy                    |
| ------------- | --------------------- | ----------------------------------- |
| Signaling     | Memory (room state)   | Horizontal with sticky sessions     |
| Sync          | Storage (persistence) | Shard by room prefix                |
| Notifications | Storage               | Replace LowDB with Redis/PostgreSQL |

---

## Files to Create

```
External repositories (separate from OpenNoodl):

opennoodl-signaling-server/
├── index.js
├── package.json
├── Dockerfile
├── railway.json
├── render.yaml
├── fly.toml
└── README.md

opennoodl-sync-server/
├── index.js
├── package.json
├── Dockerfile
└── README.md

opennoodl-notification-server/
├── index.js
├── package.json
├── Dockerfile
└── README.md
```

---

## Notes

- All servers designed to be stateless (horizontally scalable)
- Sync server can optionally persist data with LevelDB
- Notification server uses LowDB initially (can upgrade to Redis/PostgreSQL for scale)
- All servers include CORS headers for cross-origin requests
- WebSocket connections include heartbeat/ping-pong for dead connection detection

---

## Related Tasks

- **GIT-005**: Community Infrastructure (defines server URLs in community.json)
- **GIT-007**: WebRTC Collaboration Client (consumes these servers)
- **GIT-008**: Notification System (client for notification server)
