# Live Collaboration & Multi-Community System
## Task Documentation: GIT-5 through GIT-11

**Series**: GitHub Integration (Advanced Phase)  
**Total Estimated Hours**: 431-572 hours  
**Dependencies**: GitHub OAuth (GIT-1 through GIT-4)

---

## Overview

This series transforms Nodegx into a collaborative platform with multi-community support, live real-time collaboration (Google Docs for visual programming), and persistent notification system. Users can participate in the official Nodegx community or fork and operate their own private communities with self-hosted infrastructure.

### Strategic Goals

1. **Community Ownership**: BYOB philosophy applied to communities - users can fork, self-host, and control their own spaces
2. **Live Collaboration**: Real-time multi-user editing with audio/video via WebRTC (industry first for desktop visual dev tools)
3. **Persistent Notifications**: Cross-session notification system for community events and collaboration invites
4. **Network Effects**: Component sharing, tutorial discovery, and collaboration sessions drive user engagement
5. **Enterprise Ready**: Private communities for companies using Nodegx as internal tooling

### Key Features

- Multi-community management (join multiple communities simultaneously)
- Live collaboration sessions with audio/video chat
- Public and private collaboration sessions
- Direct user invitations with persistent notifications
- Community template repository (forkable)
- Self-hosted infrastructure (signaling, sync, relay servers)
- Real-time presence (see who's online, what they're working on)
- Component library discovery across communities
- Tutorial and showcase feeds
- Job board integration

---

## GIT-5: Community Infrastructure & Template Repository

**Priority**: High  
**Estimated Hours**: 60-80  
**Dependencies**: GIT-1 (GitHub OAuth)

### Purpose

Create the foundational community infrastructure that enables users to fork and operate their own Nodegx communities. This includes the community template repository structure, server deployment templates, and community management system.

### Technical Requirements

#### 1. Community Template Repository

Create a new repository: `nodegx-community` that serves as the template for all communities.

**Repository Structure:**

```
nodegx-community/
├── .github/
│   ├── workflows/
│   │   ├── validate-community.yml      # Validates community.json schema
│   │   ├── sync-discussions.yml        # Syncs discussion metadata
│   │   ├── update-feeds.yml            # Updates tutorial/showcase feeds
│   │   └── publish-sessions.yml        # Updates public session list
│   └── ISSUE_TEMPLATE/
│       ├── component-submission.yml
│       ├── tutorial-submission.yml
│       └── session-request.yml
│
├── community.json                      # Community metadata (CRITICAL)
├── README.md                           # Community home page
├── CODE_OF_CONDUCT.md                 # Community guidelines
├── CONTRIBUTING.md                     # How to contribute
│
├── components/
│   ├── README.md                       # Component library guide
│   ├── featured.json                   # Curated components
│   └── registry.json                   # All registered components
│
├── tutorials/
│   ├── README.md                       # Learning resources hub
│   ├── beginner/
│   │   └── index.json                  # Beginner tutorials metadata
│   ├── intermediate/
│   │   └── index.json
│   └── advanced/
│       └── index.json
│
├── showcase/
│   ├── README.md                       # Featured projects
│   ├── projects.json                   # Project submissions
│   └── templates/
│       └── project-template.json
│
├── jobs/
│   ├── README.md                       # Job board guide
│   └── listings.json                   # Current listings (PRs to add)
│
├── collaboration/
│   ├── README.md                       # Collaboration guide
│   ├── public-sessions.json            # Active public sessions
│   └── session-template.json           # Template for session metadata
│
└── config/
    ├── servers.json                    # Server endpoints
    ├── features.json                   # Feature flags
    └── notifications.json              # Notification settings
```

#### 2. Community Metadata Schema

**File: `community.json`**

This file is the single source of truth for community configuration.

```json
{
  "$schema": "https://nodegx.org/schemas/community.v1.json",
  "version": "1.0.0",
  "community": {
    "id": "nodegx-official",
    "name": "Nodegx Official Community",
    "description": "The official Nodegx visual programming community",
    "type": "public",
    "owner": {
      "github": "nodegx",
      "name": "Visual Hive",
      "website": "https://visualhive.com",
      "contact": "community@visualhive.com"
    },
    "repository": "https://github.com/nodegx/nodegx-community",
    "createdAt": "2025-01-18T00:00:00Z",
    "updatedAt": "2025-01-18T00:00:00Z"
  },
  "servers": {
    "signaling": {
      "url": "wss://signal.nodegx.com",
      "healthCheck": "https://signal.nodegx.com/health"
    },
    "sync": {
      "url": "wss://sync.nodegx.com",
      "healthCheck": "https://sync.nodegx.com/health"
    },
    "turn": {
      "urls": ["turn:relay.nodegx.com:3478"],
      "username": "nodegx",
      "credentialType": "password"
    },
    "notifications": {
      "url": "wss://notify.nodegx.com",
      "healthCheck": "https://notify.nodegx.com/health"
    }
  },
  "features": {
    "discussions": true,
    "components": true,
    "tutorials": true,
    "showcase": true,
    "jobs": true,
    "collaboration": {
      "enabled": true,
      "publicSessions": true,
      "privateSessions": true,
      "maxSessionSize": 10,
      "audioEnabled": true,
      "videoEnabled": false,
      "screenShareEnabled": true,
      "requireAuth": true
    },
    "notifications": {
      "enabled": true,
      "channels": ["discussions", "sessions", "components", "invites"],
      "persistDays": 30
    }
  },
  "branding": {
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "logo": "https://nodegx.com/community-logo.png",
    "favicon": "https://nodegx.com/favicon.ico",
    "customCSS": null
  },
  "moderation": {
    "moderators": ["richardthompson", "visualhive"],
    "requireApproval": {
      "components": false,
      "tutorials": true,
      "showcaseProjects": true,
      "jobs": false
    },
    "autoModerationEnabled": true,
    "bannedUsers": []
  },
  "integrations": {
    "github": {
      "org": "nodegx",
      "discussionsRepo": "nodegx/nodegx-community",
      "issuesRepo": "nodegx/nodegx"
    },
    "discord": {
      "enabled": false,
      "webhookUrl": null,
      "serverId": null
    },
    "slack": {
      "enabled": false,
      "webhookUrl": null
    }
  },
  "limits": {
    "maxComponentsPerUser": 50,
    "maxSessionsPerUser": 5,
    "maxInvitesPerSession": 20,
    "rateLimit": {
      "sessionsPerHour": 10,
      "invitesPerHour": 50
    }
  }
}
```

#### 3. GitHub Actions Workflows

**File: `.github/workflows/validate-community.yml`**

```yaml
name: Validate Community Configuration

on:
  push:
    paths:
      - 'community.json'
      - 'components/**'
      - 'collaboration/**'
  pull_request:
    paths:
      - 'community.json'
      - 'components/**'
      - 'collaboration/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate community.json schema
        run: |
          npx ajv-cli validate \
            -s https://nodegx.org/schemas/community.v1.json \
            -d community.json
      
      - name: Validate component registry
        run: |
          node scripts/validate-components.js
      
      - name: Validate collaboration sessions
        run: |
          node scripts/validate-sessions.js
      
      - name: Check server health
        run: |
          node scripts/check-server-health.js
```

**File: `.github/workflows/sync-discussions.yml`**

```yaml
name: Sync GitHub Discussions

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Fetch latest discussions
        run: |
          node scripts/sync-discussions.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Update discussions metadata
        run: |
          git config user.name "Nodegx Bot"
          git config user.email "bot@nodegx.com"
          git add discussions/
          git diff --quiet && git diff --staged --quiet || \
            (git commit -m "Update discussions metadata" && git push)
```

#### 4. Validation Scripts

**File: `scripts/validate-community.js`**

```javascript
const fs = require('fs');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

async function validateCommunity() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  
  // Load schema
  const schema = JSON.parse(
    fs.readFileSync('./schemas/community.v1.json', 'utf8')
  );
  
  // Load community config
  const config = JSON.parse(
    fs.readFileSync('./community.json', 'utf8')
  );
  
  const validate = ajv.compile(schema);
  const valid = validate(config);
  
  if (!valid) {
    console.error('Community configuration is invalid:');
    console.error(validate.errors);
    process.exit(1);
  }
  
  console.log('✓ Community configuration is valid');
  
  // Additional validation
  await validateServers(config.servers);
  await validateModerators(config.moderation.moderators);
  
  console.log('✓ All validations passed');
}

async function validateServers(servers) {
  // Check if servers are reachable
  const checks = [
    fetch(servers.signaling.healthCheck),
    fetch(servers.sync.healthCheck),
    fetch(servers.notifications.healthCheck)
  ];
  
  const results = await Promise.allSettled(checks);
  
  results.forEach((result, index) => {
    const serverNames = ['signaling', 'sync', 'notifications'];
    if (result.status === 'rejected') {
      console.warn(`⚠ ${serverNames[index]} server health check failed`);
    }
  });
}

async function validateModerators(moderators) {
  // Verify moderators are valid GitHub users
  for (const username of moderators) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (!response.ok) {
        throw new Error(`User ${username} not found`);
      }
    } catch (err) {
      console.error(`Invalid moderator: ${username}`);
      process.exit(1);
    }
  }
}

validateCommunity();
```

#### 5. Editor Integration - Community Manager

**File: `packages/noodl-editor/src/editor/src/services/CommunityManager.ts`**

```typescript
import { Octokit } from '@octokit/rest';
import EventEmitter from 'events';

interface Community {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private';
  repository: string;
  config: CommunityConfig;
  isActive: boolean;
  lastSync: Date;
}

interface CommunityConfig {
  servers: {
    signaling: { url: string; healthCheck: string };
    sync: { url: string; healthCheck: string };
    turn: { urls: string[]; username: string };
    notifications: { url: string; healthCheck: string };
  };
  features: {
    collaboration: {
      enabled: boolean;
      publicSessions: boolean;
      privateSessions: boolean;
    };
    notifications: {
      enabled: boolean;
      channels: string[];
    };
  };
}

export class CommunityManager extends EventEmitter {
  private communities: Map<string, Community> = new Map();
  private activeCommunity: string | null = null;
  private octokit: Octokit;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(octokitInstance: Octokit) {
    super();
    this.octokit = octokitInstance;
  }

  async initialize() {
    // Load communities from user preferences
    const saved = this.loadSavedCommunities();
    
    // Add official Nodegx community by default
    await this.addCommunity('https://github.com/nodegx/nodegx-community');
    
    // Add user's saved communities
    for (const repoUrl of saved) {
      await this.addCommunity(repoUrl);
    }
    
    // Start background sync
    this.startBackgroundSync();
    
    this.emit('initialized');
  }

  async addCommunity(repoUrl: string): Promise<Community> {
    // Parse GitHub repo URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    
    const [, owner, repo] = match;
    
    try {
      // Fetch community.json from repo
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'community.json'
      });
      
      if (!('content' in data)) {
        throw new Error('community.json not found');
      }
      
      const content = Buffer.from(data.content, 'base64').toString();
      const config = JSON.parse(content);
      
      // Validate schema
      await this.validateCommunityConfig(config);
      
      // Check server health
      const serversHealthy = await this.checkServerHealth(config.servers);
      
      const community: Community = {
        id: config.community.id,
        name: config.community.name,
        description: config.community.description,
        type: config.community.type,
        repository: repoUrl,
        config,
        isActive: serversHealthy,
        lastSync: new Date()
      };
      
      this.communities.set(community.id, community);
      this.saveCommunities();
      
      this.emit('community-added', community);
      
      return community;
      
    } catch (err) {
      throw new Error(`Failed to add community: ${err.message}`);
    }
  }

  async removeCommunity(communityId: string) {
    const community = this.communities.get(communityId);
    if (!community) {
      throw new Error('Community not found');
    }
    
    // Can't remove official community
    if (communityId === 'nodegx-official') {
      throw new Error('Cannot remove official Nodegx community');
    }
    
    this.communities.delete(communityId);
    this.saveCommunities();
    
    this.emit('community-removed', communityId);
  }

  getCommunities(): Community[] {
    return Array.from(this.communities.values());
  }

  getActiveCommunity(): Community | null {
    if (!this.activeCommunity) return null;
    return this.communities.get(this.activeCommunity) || null;
  }

  setActiveCommunity(communityId: string) {
    const community = this.communities.get(communityId);
    if (!community) {
      throw new Error('Community not found');
    }
    
    this.activeCommunity = communityId;
    this.emit('active-community-changed', community);
  }

  async syncCommunity(communityId: string) {
    const community = this.communities.get(communityId);
    if (!community) return;
    
    const [, owner, repo] = community.repository.match(
      /github\.com\/([^\/]+)\/([^\/]+)/
    )!;
    
    try {
      // Re-fetch community.json
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'community.json'
      });
      
      if (!('content' in data)) return;
      
      const content = Buffer.from(data.content, 'base64').toString();
      const config = JSON.parse(content);
      
      // Update community config
      community.config = config;
      community.lastSync = new Date();
      
      // Re-check server health
      community.isActive = await this.checkServerHealth(config.servers);
      
      this.emit('community-synced', community);
      
    } catch (err) {
      console.error(`Failed to sync community ${communityId}:`, err);
    }
  }

  private async checkServerHealth(servers: CommunityConfig['servers']): Promise<boolean> {
    try {
      const checks = await Promise.all([
        fetch(servers.signaling.healthCheck),
        fetch(servers.sync.healthCheck),
        fetch(servers.notifications.healthCheck)
      ]);
      
      return checks.every(r => r.ok);
    } catch {
      return false;
    }
  }

  private async validateCommunityConfig(config: any) {
    // TODO: Use AJV to validate against schema
    if (!config.community || !config.servers) {
      throw new Error('Invalid community configuration');
    }
  }

  private startBackgroundSync() {
    // Sync all communities every 15 minutes
    this.syncInterval = setInterval(() => {
      this.communities.forEach((_, id) => {
        this.syncCommunity(id);
      });
    }, 15 * 60 * 1000);
  }

  private loadSavedCommunities(): string[] {
    // Load from user preferences
    const prefs = window.ProjectModel?.prefs;
    return prefs?.get('communities') || [];
  }

  private saveCommunities() {
    const repos = Array.from(this.communities.values())
      .filter(c => c.id !== 'nodegx-official')
      .map(c => c.repository);
    
    window.ProjectModel?.prefs.set('communities', repos);
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
```

### Implementation Tasks

- [ ] Create `nodegx-community` template repository with full structure
- [ ] Implement `community.json` schema and validation
- [ ] Create GitHub Actions workflows for validation and sync
- [ ] Implement `CommunityManager` service in editor
- [ ] Create community settings UI panel
- [ ] Add "Add Community" flow (paste GitHub URL)
- [ ] Add "Create Community" flow (fork template)
- [ ] Implement background sync for community configs
- [ ] Add server health monitoring
- [ ] Create community switcher UI component

### Verification Steps

- [ ] Can fork `nodegx-community` template and customize `community.json`
- [ ] GitHub Actions validate configuration on push
- [ ] Editor can add community by pasting GitHub URL
- [ ] Editor validates community config and checks server health
- [ ] Can switch between multiple communities
- [ ] Background sync updates community configs
- [ ] Invalid communities show error states
- [ ] Can remove communities (except official)

### Notes

- Official Nodegx community cannot be removed (hardcoded)
- Community configs are cached locally for offline access
- Server health checks run every sync cycle
- Failed health checks show warning but don't remove community

---

## GIT-6: Server Infrastructure (Signaling, Sync, Notifications)

**Priority**: Critical  
**Estimated Hours**: 80-100  
**Dependencies**: GIT-5

### Purpose

Build the three core server components required for live collaboration and notifications: Signaling Server (WebRTC peer discovery), Sync Server (WebSocket fallback), and Notification Server (persistent cross-session notifications).

### Technical Requirements

#### 1. Signaling Server (WebRTC Peer Discovery)

Minimal WebSocket server that helps peers find each other for WebRTC connections.

**Repository: `nodegx-signaling-server`**

**File: `index.js`**

```javascript
/**
 * Nodegx Signaling Server
 * Helps WebRTC peers discover each other
 * NO project data passes through this server
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 4444;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_ROOM_SIZE = parseInt(process.env.MAX_ROOM_SIZE) || 20;

// Data structures
const rooms = new Map(); // roomId -> Set<PeerInfo>
const userToWs = new Map(); // userId -> WebSocket
const wsToUser = new Map(); // WebSocket -> userId

// Metrics
const metrics = {
  totalConnections: 0,
  activeConnections: 0,
  activeRooms: 0,
  messagesRelayed: 0,
  startTime: Date.now()
};

// HTTP server for health checks
const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      metrics: {
        ...metrics,
        activeRooms: rooms.size,
        roomDetails: Array.from(rooms.entries()).map(([id, peers]) => ({
          roomId: id,
          peerCount: peers.size
        }))
      }
    }));
  } else if (pathname === '/metrics') {
    // Prometheus-compatible metrics
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`
# HELP nodegx_signaling_connections Total connections
# TYPE nodegx_signaling_connections counter
nodegx_signaling_connections_total ${metrics.totalConnections}
nodegx_signaling_connections_active ${metrics.activeConnections}

# HELP nodegx_signaling_rooms Active rooms
# TYPE nodegx_signaling_rooms gauge
nodegx_signaling_rooms_active ${rooms.size}

# HELP nodegx_signaling_messages Messages relayed
# TYPE nodegx_signaling_messages counter
nodegx_signaling_messages_total ${metrics.messagesRelayed}
    `.trim());
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  metrics.totalConnections++;
  metrics.activeConnections++;
  
  let currentRoom = null;
  let peerInfo = null;
  
  // Heartbeat to detect dead connections
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(ws, msg);
    } catch (err) {
      sendError(ws, 'Invalid JSON');
    }
  });

  ws.on('close', () => {
    metrics.activeConnections--;
    
    if (currentRoom && peerInfo) {
      leaveRoom(currentRoom, peerInfo.peerId);
    }
    
    if (peerInfo) {
      userToWs.delete(peerInfo.userId);
      wsToUser.delete(ws);
    }
  });

  function handleMessage(ws, msg) {
    metrics.messagesRelayed++;
    
    switch (msg.type) {
      case 'join':
        handleJoin(ws, msg);
        break;
      case 'leave':
        handleLeave(ws, msg);
        break;
      case 'signal':
        handleSignal(ws, msg);
        break;
      case 'invite':
        handleInvite(ws, msg);
        break;
      default:
        sendError(ws, 'Unknown message type');
    }
  }

  function handleJoin(ws, msg) {
    const { room, peerId, userId, metadata } = msg;
    
    if (!room || !peerId || !userId) {
      return sendError(ws, 'Missing required fields');
    }
    
    // Create room if doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
      metrics.activeRooms++;
    }
    
    const roomPeers = rooms.get(room);
    
    // Check room size limit
    if (roomPeers.size >= MAX_ROOM_SIZE) {
      return sendError(ws, 'Room is full');
    }
    
    // Store peer info
    peerInfo = { peerId, userId, metadata, ws };
    currentRoom = room;
    roomPeers.add(peerInfo);
    
    userToWs.set(userId, ws);
    wsToUser.set(ws, userId);
    
    // Notify peer of successful join
    send(ws, {
      type: 'joined',
      room,
      peerId,
      peers: Array.from(roomPeers)
        .filter(p => p.peerId !== peerId)
        .map(p => ({
          peerId: p.peerId,
          userId: p.userId,
          metadata: p.metadata
        }))
    });
    
    // Notify other peers
    broadcast(room, {
      type: 'peer-joined',
      peerId,
      userId,
      metadata
    }, peerId);
  }

  function handleLeave(ws, msg) {
    if (currentRoom && peerInfo) {
      leaveRoom(currentRoom, peerInfo.peerId);
      currentRoom = null;
      peerInfo = null;
    }
  }

  function handleSignal(ws, msg) {
    const { to, signal } = msg;
    
    if (!to || !signal) {
      return sendError(ws, 'Missing required fields');
    }
    
    if (!currentRoom || !peerInfo) {
      return sendError(ws, 'Not in a room');
    }
    
    // Find target peer in same room
    const roomPeers = rooms.get(currentRoom);
    const targetPeer = Array.from(roomPeers).find(p => p.peerId === to);
    
    if (!targetPeer) {
      return sendError(ws, 'Target peer not found');
    }
    
    // Relay signal to target
    send(targetPeer.ws, {
      type: 'signal',
      from: peerInfo.peerId,
      signal
    });
  }

  function handleInvite(ws, msg) {
    const { targetUserId, roomId, sessionInfo } = msg;
    
    if (!targetUserId || !roomId) {
      return sendError(ws, 'Missing required fields');
    }
    
    // Find target user's WebSocket
    const targetWs = userToWs.get(targetUserId);
    
    if (targetWs) {
      // User is online, send direct invite
      send(targetWs, {
        type: 'invite',
        from: peerInfo.userId,
        roomId,
        sessionInfo
      });
      
      send(ws, {
        type: 'invite-sent',
        to: targetUserId,
        delivered: true
      });
    } else {
      // User is offline, notify sender
      send(ws, {
        type: 'invite-sent',
        to: targetUserId,
        delivered: false,
        reason: 'User offline'
      });
    }
  }

  function leaveRoom(room, peerId) {
    const roomPeers = rooms.get(room);
    if (!roomPeers) return;
    
    // Remove peer
    const peer = Array.from(roomPeers).find(p => p.peerId === peerId);
    if (peer) {
      roomPeers.delete(peer);
      
      // Notify others
      broadcast(room, {
        type: 'peer-left',
        peerId
      }, peerId);
      
      // Clean up empty room
      if (roomPeers.size === 0) {
        rooms.delete(room);
        metrics.activeRooms--;
      }
    }
  }

  function broadcast(room, message, excludePeerId = null) {
    const roomPeers = rooms.get(room);
    if (!roomPeers) return;
    
    roomPeers.forEach(peer => {
      if (peer.peerId !== excludePeerId) {
        send(peer.ws, message);
      }
    });
  }

  function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function sendError(ws, error) {
    send(ws, { type: 'error', error });
  }
});

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      const userId = wsToUser.get(ws);
      if (userId) {
        userToWs.delete(userId);
        wsToUser.delete(ws);
      }
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeat);
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
```

**File: `package.json`**

```json
{
  "name": "nodegx-signaling-server",
  "version": "1.0.0",
  "description": "WebRTC signaling server for Nodegx collaboration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

**File: `Dockerfile`**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 4444

CMD ["node", "index.js"]
```

**File: `railway.json`** (One-click deploy)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "startCommand": "node index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

#### 2. Sync Server (WebSocket Fallback)

Traditional WebSocket server using Yjs for CRDT synchronization.

**Repository: `nodegx-sync-server`**

**File: `index.js`**

```javascript
/**
 * Nodegx Sync Server
 * WebSocket-based CRDT sync using Yjs
 * Fallback when WebRTC P2P fails
 */

const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.PORT || 4445;
const PERSIST_DIR = process.env.PERSIST_DIR || './data';
const ENABLE_PERSISTENCE = process.env.ENABLE_PERSISTENCE !== 'false';

// Persistence (optional)
const persistence = ENABLE_PERSISTENCE 
  ? require('y-leveldb').LeveldbPersistence(PERSIST_DIR)
  : null;

// Metrics
const metrics = {
  activeConnections: 0,
  activeDocuments: 0,
  totalUpdates: 0
};

// HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      metrics
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  metrics.activeConnections++;
  
  // Yjs handles all the CRDT magic
  setupWSConnection(ws, req, {
    persistence,
    gc: true // Enable garbage collection
  });
  
  ws.on('close', () => {
    metrics.activeConnections--;
  });
});

server.listen(PORT, () => {
  console.log(`Sync server running on port ${PORT}`);
  console.log(`Persistence: ${ENABLE_PERSISTENCE ? 'enabled' : 'disabled'}`);
});
```

**File: `package.json`**

```json
{
  "name": "nodegx-sync-server",
  "version": "1.0.0",
  "description": "Yjs WebSocket sync server for Nodegx",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "ws": "^8.14.0",
    "yjs": "^13.6.0",
    "y-websocket": "^1.5.0",
    "y-leveldb": "^0.1.2"
  }
}
```

#### 3. Notification Server (Persistent Notifications)

Server for managing cross-session notifications (invites, community events, etc.).

**Repository: `nodegx-notification-server`**

**File: `index.js`**

```javascript
/**
 * Nodegx Notification Server
 * Persistent notifications across sessions
 * Stores invites, mentions, community events
 */

const WebSocket = require('ws');
const http = require('http');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const crypto = require('crypto');

const PORT = process.env.PORT || 4446;
const DB_FILE = process.env.DB_FILE || './notifications.json';
const NOTIFICATION_TTL_DAYS = parseInt(process.env.TTL_DAYS) || 30;

// Database setup
const adapter = new JSONFile(DB_FILE);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data ||= { notifications: [], users: {} };
  await db.write();
}

// Data structures
const userConnections = new Map(); // userId -> Set<WebSocket>

// HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      notificationCount: db.data.notifications.length,
      connectedUsers: userConnections.size
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  let userId = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      await handleMessage(ws, msg);
    } catch (err) {
      sendError(ws, 'Invalid message');
    }
  });

  ws.on('close', () => {
    if (userId) {
      const connections = userConnections.get(userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          userConnections.delete(userId);
        }
      }
    }
  });

  async function handleMessage(ws, msg) {
    switch (msg.type) {
      case 'authenticate':
        await handleAuth(ws, msg);
        break;
      case 'get-notifications':
        await handleGetNotifications(ws, msg);
        break;
      case 'mark-read':
        await handleMarkRead(ws, msg);
        break;
      case 'send-notification':
        await handleSendNotification(ws, msg);
        break;
      case 'delete-notification':
        await handleDeleteNotification(ws, msg);
        break;
    }
  }

  async function handleAuth(ws, msg) {
    userId = msg.userId;
    
    if (!userId) {
      return sendError(ws, 'Invalid userId');
    }
    
    // Add connection to user's set
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);
    
    send(ws, { type: 'authenticated', userId });
    
    // Send pending notifications
    const notifications = await getNotificationsForUser(userId);
    send(ws, {
      type: 'notifications',
      notifications
    });
  }

  async function handleGetNotifications(ws, msg) {
    if (!userId) return sendError(ws, 'Not authenticated');
    
    const notifications = await getNotificationsForUser(userId);
    send(ws, {
      type: 'notifications',
      notifications
    });
  }

  async function handleMarkRead(ws, msg) {
    if (!userId) return sendError(ws, 'Not authenticated');
    
    const { notificationId } = msg;
    
    await db.read();
    const notification = db.data.notifications.find(n => n.id === notificationId);
    
    if (notification && notification.userId === userId) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      await db.write();
      
      send(ws, {
        type: 'notification-updated',
        notification
      });
    }
  }

  async function handleSendNotification(ws, msg) {
    if (!userId) return sendError(ws, 'Not authenticated');
    
    const { targetUserId, type, data } = msg;
    
    const notification = {
      id: crypto.randomUUID(),
      userId: targetUserId,
      fromUserId: userId,
      type,
      data,
      read: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    };
    
    await db.read();
    db.data.notifications.push(notification);
    await db.write();
    
    // Send to target user if online
    const targetConnections = userConnections.get(targetUserId);
    if (targetConnections) {
      targetConnections.forEach(targetWs => {
        send(targetWs, {
          type: 'notification',
          notification
        });
      });
    }
    
    send(ws, {
      type: 'notification-sent',
      notificationId: notification.id
    });
  }

  async function handleDeleteNotification(ws, msg) {
    if (!userId) return sendError(ws, 'Not authenticated');
    
    const { notificationId } = msg;
    
    await db.read();
    const index = db.data.notifications.findIndex(
      n => n.id === notificationId && n.userId === userId
    );
    
    if (index !== -1) {
      db.data.notifications.splice(index, 1);
      await db.write();
      
      send(ws, {
        type: 'notification-deleted',
        notificationId
      });
    }
  }

  async function getNotificationsForUser(userId) {
    await db.read();
    
    const now = new Date();
    
    // Clean up expired notifications
    db.data.notifications = db.data.notifications.filter(n => {
      return new Date(n.expiresAt) > now;
    });
    await db.write();
    
    // Return user's notifications
    return db.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function sendError(ws, error) {
    send(ws, { type: 'error', error });
  }
});

// Cleanup expired notifications every hour
setInterval(async () => {
  await db.read();
  const before = db.data.notifications.length;
  const now = new Date();
  
  db.data.notifications = db.data.notifications.filter(n => {
    return new Date(n.expiresAt) > now;
  });
  
  if (db.data.notifications.length !== before) {
    await db.write();
    console.log(`Cleaned up ${before - db.data.notifications.length} expired notifications`);
  }
}, 60 * 60 * 1000);

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Notification server running on port ${PORT}`);
  });
});
```

**File: `package.json`**

```json
{
  "name": "nodegx-notification-server",
  "version": "1.0.0",
  "description": "Persistent notification server for Nodegx",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "ws": "^8.14.0",
    "lowdb": "^6.1.0"
  }
}
```

### Deployment Configuration

**File: `docker-compose.yml`** (All three servers)

```yaml
version: '3.8'

services:
  signaling:
    build: ./nodegx-signaling-server
    ports:
      - "4444:4444"
    environment:
      - PORT=4444
      - MAX_ROOM_SIZE=20
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4444/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  sync:
    build: ./nodegx-sync-server
    ports:
      - "4445:4445"
    environment:
      - PORT=4445
      - ENABLE_PERSISTENCE=true
      - PERSIST_DIR=/data
    volumes:
      - sync-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4445/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  notifications:
    build: ./nodegx-notification-server
    ports:
      - "4446:4446"
    environment:
      - PORT=4446
      - DB_FILE=/data/notifications.json
      - TTL_DAYS=30
    volumes:
      - notification-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4446/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  sync-data:
  notification-data:
```

### Implementation Tasks

- [ ] Create `nodegx-signaling-server` repository
- [ ] Create `nodegx-sync-server` repository
- [ ] Create `nodegx-notification-server` repository
- [ ] Implement signaling server with room management
- [ ] Implement sync server with Yjs integration
- [ ] Implement notification server with persistence
- [ ] Add health check endpoints to all servers
- [ ] Add Prometheus metrics endpoints
- [ ] Create Docker images for all servers
- [ ] Create one-click deploy configs (Railway, Render, Fly.io)
- [ ] Add deployment documentation
- [ ] Deploy official servers for Visual Hive
- [ ] Test server failover and recovery

### Verification Steps

- [ ] Signaling server helps peers find each other
- [ ] Sync server synchronizes Yjs documents
- [ ] Notification server stores and delivers notifications
- [ ] Health endpoints return 200 OK
- [ ] Metrics endpoints expose data
- [ ] Docker Compose brings up all services
- [ ] One-click deploy works on Railway/Render
- [ ] Servers handle connection failures gracefully
- [ ] Old notifications are cleaned up automatically

### Notes

- All servers designed to be stateless (horizontally scalable)
- Sync server can optionally persist data with LevelDB
- Notification server uses LowDB (can be replaced with Redis/PostgreSQL for scale)
- All servers include CORS headers for cross-origin requests
- WebSocket connections include heartbeat/ping-pong for dead connection detection

---

## GIT-7: WebRTC Collaboration Client

**Priority**: Critical  
**Estimated Hours**: 100-130  
**Dependencies**: GIT-5, GIT-6

### Purpose

Implement the client-side WebRTC collaboration system that enables real-time multi-user editing, cursor sharing, audio/video chat, and seamless fallback to WebSocket sync.

### Technical Requirements

#### 1. Collaboration Manager Service

**File: `packages/noodl-editor/src/editor/src/services/CollaborationManager.ts`**

```typescript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import SimplePeer from 'simple-peer';
import EventEmitter from 'events';

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
  audio: {
    enabled: boolean;
    stream?: MediaStream;
  };
  video: {
    enabled: boolean;
    stream?: MediaStream;
  };
  isHost: boolean;
  joinedAt: Date;
}

interface CollaborationConfig {
  community: {
    id: string;
    servers: {
      signaling: string;
      sync: string;
      turn: { urls: string[]; username: string; credential?: string };
    };
  };
  session: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenShareEnabled: boolean;
  };
  fallback: {
    enableWebSocket: boolean;
    fallbackDelay: number; // ms
  };
}

export class CollaborationManager extends EventEmitter {
  private doc: Y.Doc;
  private webrtcProvider: WebrtcProvider | null = null;
  private websocketProvider: WebsocketProvider | null = null;
  private signalingWs: WebSocket | null = null;
  
  private currentSession: CollaborationSession | null = null;
  private localParticipant: Participant | null = null;
  
  private localAudioStream: MediaStream | null = null;
  private localVideoStream: MediaStream | null = null;
  
  private peers: Map<string, SimplePeer.Instance> = new Map();
  private config: CollaborationConfig;
  
  private fallbackTimeout: NodeJS.Timeout | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  constructor(config: CollaborationConfig) {
    super();
    this.config = config;
    this.doc = new Y.Doc();
  }

  /**
   * Start a new collaboration session (host)
   */
  async startSession(options: {
    projectId: string;
    title: string;
    description?: string;
    isPublic: boolean;
    maxParticipants: number;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  }): Promise<CollaborationSession> {
    
    const roomId = this.generateRoomId();
    const userId = await this.getUserId();
    const peerId = this.generatePeerId();
    
    this.currentSession = {
      id: crypto.randomUUID(),
      roomId,
      projectId: options.projectId,
      isHost: true,
      isPublic: options.isPublic,
      title: options.title,
      description: options.description,
      maxParticipants: options.maxParticipants,
      participants: new Map(),
      createdAt: new Date()
    };
    
    // Initialize local media if enabled
    if (options.audioEnabled || options.videoEnabled) {
      await this.initializeLocalMedia(
        options.audioEnabled || false,
        options.videoEnabled || false
      );
    }
    
    // Create local participant
    this.localParticipant = {
      peerId,
      userId,
      name: await this.getUserName(),
      avatar: await this.getUserAvatar(),
      color: this.generateUserColor(),
      isHost: true,
      audio: {
        enabled: options.audioEnabled || false,
        stream: this.localAudioStream || undefined
      },
      video: {
        enabled: options.videoEnabled || false,
        stream: this.localVideoStream || undefined
      },
      joinedAt: new Date()
    };
    
    this.currentSession.participants.set(peerId, this.localParticipant);
    
    // Connect to signaling server
    await this.connectToSignaling(roomId, peerId, userId);
    
    // Initialize WebRTC provider
    await this.initializeWebRTC(roomId);
    
    // Publish session if public
    if (options.isPublic) {
      await this.publishSession(this.currentSession);
    }
    
    this.emit('session-started', this.currentSession);
    
    return this.currentSession;
  }

  /**
   * Join an existing session
   */
  async joinSession(options: {
    roomId: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  }): Promise<CollaborationSession> {
    
    const userId = await this.getUserId();
    const peerId = this.generatePeerId();
    
    // Initialize local media if enabled
    if (options.audioEnabled || options.videoEnabled) {
      await this.initializeLocalMedia(
        options.audioEnabled || false,
        options.videoEnabled || false
      );
    }
    
    // Create local participant
    this.localParticipant = {
      peerId,
      userId,
      name: await this.getUserName(),
      avatar: await this.getUserAvatar(),
      color: this.generateUserColor(),
      isHost: false,
      audio: {
        enabled: options.audioEnabled || false,
        stream: this.localAudioStream || undefined
      },
      video: {
        enabled: options.videoEnabled || false,
        stream: this.localVideoStream || undefined
      },
      joinedAt: new Date()
    };
    
    // Connect to signaling server
    await this.connectToSignaling(options.roomId, peerId, userId);
    
    // Initialize WebRTC provider
    await this.initializeWebRTC(options.roomId);
    
    // Session details will be synced via Yjs
    this.currentSession = {
      id: crypto.randomUUID(),
      roomId: options.roomId,
      projectId: '', // Will be synced
      isHost: false,
      isPublic: false, // Will be synced
      title: '', // Will be synced
      maxParticipants: 10, // Will be synced
      participants: new Map(),
      createdAt: new Date()
    };
    
    this.currentSession.participants.set(peerId, this.localParticipant);
    
    this.emit('session-joined', this.currentSession);
    
    return this.currentSession;
  }

  /**
   * Leave current session
   */
  async leaveSession() {
    if (!this.currentSession) return;
    
    // Disconnect from signaling
    if (this.signalingWs) {
      this.signalingWs.send(JSON.stringify({
        type: 'leave',
        room: this.currentSession.roomId,
        peerId: this.localParticipant?.peerId
      }));
      this.signalingWs.close();
      this.signalingWs = null;
    }
    
    // Close all peer connections
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
    
    // Disconnect providers
    if (this.webrtcProvider) {
      this.webrtcProvider.destroy();
      this.webrtcProvider = null;
    }
    
    if (this.websocketProvider) {
      this.websocketProvider.destroy();
      this.websocketProvider = null;
    }
    
    // Stop local media
    this.stopLocalMedia();
    
    // Unpublish if public and host
    if (this.currentSession.isPublic && this.currentSession.isHost) {
      await this.unpublishSession(this.currentSession.id);
    }
    
    const sessionId = this.currentSession.id;
    this.currentSession = null;
    this.localParticipant = null;
    
    this.emit('session-left', sessionId);
  }

  /**
   * Connect to signaling server
   */
  private async connectToSignaling(roomId: string, peerId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const signalingUrl = this.config.community.servers.signaling;
      this.signalingWs = new WebSocket(signalingUrl);
      
      this.signalingWs.onopen = () => {
        this.signalingWs!.send(JSON.stringify({
          type: 'join',
          room: roomId,
          peerId,
          userId,
          metadata: {
            name: this.localParticipant?.name,
            avatar: this.localParticipant?.avatar,
            color: this.localParticipant?.color
          }
        }));
      };
      
      this.signalingWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleSignalingMessage(msg);
        
        if (msg.type === 'joined') {
          resolve();
        }
      };
      
      this.signalingWs.onerror = (error) => {
        reject(error);
      };
    });
  }

  /**
   * Handle messages from signaling server
   */
  private handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'joined':
        // Successfully joined room, existing peers listed
        msg.peers.forEach((peer: any) => {
          this.initiatePeerConnection(peer.peerId, true, peer);
        });
        break;
        
      case 'peer-joined':
        // New peer joined, wait for them to initiate
        const participant: Participant = {
          peerId: msg.peerId,
          userId: msg.userId,
          name: msg.metadata.name,
          avatar: msg.metadata.avatar,
          color: msg.metadata.color,
          isHost: false,
          audio: { enabled: false },
          video: { enabled: false },
          joinedAt: new Date()
        };
        this.currentSession?.participants.set(msg.peerId, participant);
        this.emit('participant-joined', participant);
        break;
        
      case 'peer-left':
        // Peer left
        const peer = this.peers.get(msg.peerId);
        if (peer) {
          peer.destroy();
          this.peers.delete(msg.peerId);
        }
        this.currentSession?.participants.delete(msg.peerId);
        this.emit('participant-left', msg.peerId);
        break;
        
      case 'signal':
        // WebRTC signal from peer
        const existingPeer = this.peers.get(msg.from);
        if (existingPeer) {
          existingPeer.signal(msg.signal);
        } else {
          // Peer doesn't exist yet, they're initiating
          this.initiatePeerConnection(msg.from, false);
          setTimeout(() => {
            this.peers.get(msg.from)?.signal(msg.signal);
          }, 100);
        }
        break;
        
      case 'invite':
        // Received collaboration invite
        this.emit('invite-received', {
          from: msg.from,
          roomId: msg.roomId,
          sessionInfo: msg.sessionInfo
        });
        break;
    }
  }

  /**
   * Initialize WebRTC peer connection
   */
  private initiatePeerConnection(peerId: string, initiator: boolean, metadata?: any) {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          ...this.config.community.servers.turn.urls.map(url => ({
            urls: url,
            username: this.config.community.servers.turn.username,
            credential: this.config.community.servers.turn.credential
          }))
        ]
      },
      stream: this.combineMediaStreams()
    });
    
    peer.on('signal', (signal) => {
      // Send signal via signaling server
      this.signalingWs?.send(JSON.stringify({
        type: 'signal',
        to: peerId,
        signal
      }));
    });
    
    peer.on('stream', (stream) => {
      // Received remote stream
      const participant = this.currentSession?.participants.get(peerId);
      if (participant) {
        // Determine if audio or video track
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        
        if (audioTrack) {
          participant.audio.stream = new MediaStream([audioTrack]);
        }
        if (videoTrack) {
          participant.video.stream = new MediaStream([videoTrack]);
        }
        
        this.emit('participant-updated', participant);
      }
    });
    
    peer.on('connect', () => {
      this.emit('peer-connected', peerId);
    });
    
    peer.on('close', () => {
      this.peers.delete(peerId);
      this.emit('peer-disconnected', peerId);
    });
    
    peer.on('error', (err) => {
      console.error(`Peer ${peerId} error:`, err);
    });
    
    this.peers.set(peerId, peer);
  }

  /**
   * Initialize WebRTC provider (Yjs)
   */
  private async initializeWebRTC(roomId: string) {
    this.webrtcProvider = new WebrtcProvider(roomId, this.doc, {
      signaling: [this.config.community.servers.signaling],
      maxConns: this.currentSession?.maxParticipants || 10,
      filterBcConns: true,
      peerOpts: {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            ...this.config.community.servers.turn.urls.map(url => ({
              urls: url,
              username: this.config.community.servers.turn.username,
              credential: this.config.community.servers.turn.credential
            }))
          ]
        }
      }
    });
    
    // Setup awareness (cursors, selections, viewport)
    this.setupAwareness();
    
    // Setup fallback timer
    if (this.config.fallback.enableWebSocket) {
      this.fallbackTimeout = setTimeout(() => {
        if (this.webrtcProvider!.connected === false) {
          console.log('WebRTC connection timeout, falling back to WebSocket');
          this.initializeWebSocketFallback(roomId);
        }
      }, this.config.fallback.fallbackDelay);
    }
    
    this.webrtcProvider.on('status', ({ connected }) => {
      if (connected) {
        this.connectionState = 'connected';
        if (this.fallbackTimeout) {
          clearTimeout(this.fallbackTimeout);
          this.fallbackTimeout = null;
        }
        this.emit('connection-established', 'webrtc');
      }
    });
    
    this.webrtcProvider.on('peers', ({ webrtcPeers, bcPeers }) => {
      this.emit('peers-changed', {
        webrtc: webrtcPeers,
        broadcast: bcPeers
      });
    });
    
    // Sync project data to Yjs doc
    this.syncProjectToYDoc();
  }

  /**
   * Initialize WebSocket fallback
   */
  private initializeWebSocketFallback(roomId: string) {
    this.websocketProvider = new WebsocketProvider(
      this.config.community.servers.sync,
      roomId,
      this.doc,
      { connect: true }
    );
    
    this.websocketProvider.on('status', ({ status }) => {
      if (status === 'connected') {
        this.connectionState = 'connected';
        this.emit('connection-established', 'websocket');
      }
    });
  }

  /**
   * Setup awareness for cursor/selection sharing
   */
  private setupAwareness() {
    if (!this.webrtcProvider) return;
    
    const awareness = this.webrtcProvider.awareness;
    
    // Set local state
    awareness.setLocalState({
      user: {
        peerId: this.localParticipant?.peerId,
        userId: this.localParticipant?.userId,
        name: this.localParticipant?.name,
        color: this.localParticipant?.color,
        avatar: this.localParticipant?.avatar
      },
      cursor: null,
      selection: null,
      viewport: null
    });
    
    // Listen for remote changes
    awareness.on('change', () => {
      this.renderRemoteAwareness();
    });
  }

  /**
   * Render remote cursors, selections, viewports
   */
  private renderRemoteAwareness() {
    if (!this.webrtcProvider) return;
    
    const awareness = this.webrtcProvider.awareness;
    const states = awareness.getStates();
    
    const remoteCursors: any[] = [];
    const remoteSelections: any[] = [];
    const remoteViewports: any[] = [];
    
    states.forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return; // Skip self
      
      if (state.cursor) {
        remoteCursors.push({
          user: state.user,
          cursor: state.cursor
        });
      }
      
      if (state.selection) {
        remoteSelections.push({
          user: state.user,
          selection: state.selection
        });
      }
      
      if (state.viewport) {
        remoteViewports.push({
          user: state.user,
          viewport: state.viewport
        });
      }
    });
    
    this.emit('awareness-updated', {
      cursors: remoteCursors,
      selections: remoteSelections,
      viewports: remoteViewports
    });
  }

  /**
   * Update local cursor position
   */
  updateCursor(x: number, y: number) {
    if (!this.webrtcProvider) return;
    
    const awareness = this.webrtcProvider.awareness;
    awareness.setLocalStateField('cursor', { x, y });
  }

  /**
   * Update local selection
   */
  updateSelection(nodeId: string | null) {
    if (!this.webrtcProvider) return;
    
    const awareness = this.webrtcProvider.awareness;
    awareness.setLocalStateField('selection', nodeId ? { nodeId } : null);
  }

  /**
   * Update local viewport
   */
  updateViewport(x: number, y: number, zoom: number) {
    if (!this.webrtcProvider) return;
    
    const awareness = this.webrtcProvider.awareness;
    awareness.setLocalStateField('viewport', { x, y, zoom });
  }

  /**
   * Sync project data to Yjs document
   */
  private syncProjectToYDoc() {
    const yNodes = this.doc.getArray('nodes');
    const yConnections = this.doc.getArray('connections');
    const yProperties = this.doc.getMap('properties');
    
    // Get current project data
    const project = window.ProjectModel?.toJSON();
    
    if (project) {
      // Sync nodes
      project.nodes?.forEach((node: any) => {
        yNodes.push([node]);
      });
      
      // Sync connections
      project.connections?.forEach((conn: any) => {
        yConnections.push([conn]);
      });
      
      // Sync global properties
      Object.entries(project.properties || {}).forEach(([key, value]) => {
        yProperties.set(key, value);
      });
    }
    
    // Listen for remote changes
    yNodes.observe((event) => {
      this.applyRemoteNodeChanges(event);
    });
    
    yConnections.observe((event) => {
      this.applyRemoteConnectionChanges(event);
    });
    
    yProperties.observe((event) => {
      this.applyRemotePropertyChanges(event);
    });
  }

  /**
   * Apply remote node changes to project
   */
  private applyRemoteNodeChanges(event: any) {
    event.changes.added.forEach((item: any) => {
      const node = item.content.getContent()[0];
      // Add node to project (via ProjectModel)
      window.ProjectModel?.addNode(node);
    });
    
    event.changes.deleted.forEach((item: any) => {
      const nodeId = item.content.getContent()[0].id;
      // Remove node from project
      window.ProjectModel?.removeNode(nodeId);
    });
    
    this.emit('project-updated', 'nodes');
  }

  /**
   * Apply remote connection changes
   */
  private applyRemoteConnectionChanges(event: any) {
    // Similar to nodes
    this.emit('project-updated', 'connections');
  }

  /**
   * Apply remote property changes
   */
  private applyRemotePropertyChanges(event: any) {
    // Similar to nodes
    this.emit('project-updated', 'properties');
  }

  /**
   * Local node changed - sync to Yjs
   */
  onLocalNodeChanged(node: any) {
    if (!this.doc) return;
    
    const yNodes = this.doc.getArray('nodes');
    
    // Find and update node
    const existingIndex = yNodes.toArray().findIndex((n: any) => n.id === node.id);
    
    if (existingIndex !== -1) {
      yNodes.delete(existingIndex, 1);
      yNodes.insert(existingIndex, [node]);
    } else {
      yNodes.push([node]);
    }
  }

  /**
   * Initialize local media (audio/video)
   */
  private async initializeLocalMedia(audio: boolean, video: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
        video: video ? { width: 1280, height: 720 } : false
      });
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      if (audioTracks.length > 0) {
        this.localAudioStream = new MediaStream(audioTracks);
      }
      
      if (videoTracks.length > 0) {
        this.localVideoStream = new MediaStream(videoTracks);
      }
      
      this.emit('local-media-initialized', {
        audio: !!this.localAudioStream,
        video: !!this.localVideoStream
      });
      
    } catch (err) {
      console.error('Failed to initialize media:', err);
      throw err;
    }
  }

  /**
   * Combine audio and video streams
   */
  private combineMediaStreams(): MediaStream | undefined {
    const combinedTracks: MediaStreamTrack[] = [];
    
    if (this.localAudioStream) {
      combinedTracks.push(...this.localAudioStream.getAudioTracks());
    }
    
    if (this.localVideoStream) {
      combinedTracks.push(...this.localVideoStream.getVideoTracks());
    }
    
    return combinedTracks.length > 0 ? new MediaStream(combinedTracks) : undefined;
  }

  /**
   * Stop local media
   */
  private stopLocalMedia() {
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(track => track.stop());
      this.localAudioStream = null;
    }
    
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach(track => track.stop());
      this.localVideoStream = null;
    }
  }

  /**
   * Toggle local audio
   */
  toggleAudio(enabled?: boolean) {
    if (!this.localAudioStream) return;
    
    const audioTrack = this.localAudioStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      if (this.localParticipant) {
        this.localParticipant.audio.enabled = audioTrack.enabled;
      }
      this.emit('audio-toggled', audioTrack.enabled);
    }
  }

  /**
   * Toggle local video
   */
  toggleVideo(enabled?: boolean) {
    if (!this.localVideoStream) return;
    
    const videoTrack = this.localVideoStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
      if (this.localParticipant) {
        this.localParticipant.video.enabled = videoTrack.enabled;
      }
      this.emit('video-toggled', videoTrack.enabled);
    }
  }

  /**
   * Invite user to session
   */
  async inviteUser(targetUserId: string) {
    if (!this.currentSession || !this.signalingWs) return;
    
    this.signalingWs.send(JSON.stringify({
      type: 'invite',
      targetUserId,
      roomId: this.currentSession.roomId,
      sessionInfo: {
        title: this.currentSession.title,
        description: this.currentSession.description,
        hostName: this.localParticipant?.name
      }
    }));
  }

  /**
   * Publish public session
   */
  private async publishSession(session: CollaborationSession) {
    // Add to community's collaboration/public-sessions.json via GitHub API
    const community = this.config.community;
    
    // This would use Octokit to update the file
    // Implementation depends on GitHub OAuth setup
  }

  /**
   * Unpublish session
   */
  private async unpublishSession(sessionId: string) {
    // Remove from community's public-sessions.json
  }

  // Utility methods
  private generateRoomId(): string {
    return `nodegx-${crypto.randomUUID()}`;
  }

  private generatePeerId(): string {
    return `peer-${crypto.randomUUID()}`;
  }

  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private async getUserId(): Promise<string> {
    // Get from GitHub OAuth
    return window.githubAuth?.user?.login || 'anonymous';
  }

  private async getUserName(): Promise<string> {
    return window.githubAuth?.user?.name || 'Anonymous';
  }

  private async getUserAvatar(): Promise<string | undefined> {
    return window.githubAuth?.user?.avatar_url;
  }

  destroy() {
    this.leaveSession();
  }
}
```

### Implementation Tasks

- [ ] Install WebRTC dependencies (y-webrtc, y-websocket, simple-peer)
- [ ] Implement `CollaborationManager` service
- [ ] Implement session creation (host)
- [ ] Implement session joining (guest)
- [ ] Implement WebRTC peer connections
- [ ] Implement signaling server communication
- [ ] Implement Yjs document synchronization
- [ ] Implement awareness (cursors, selections, viewports)
- [ ] Implement audio/video media handling
- [ ] Implement WebSocket fallback logic
- [ ] Implement user invitations
- [ ] Add public session publishing to GitHub
- [ ] Add connection state management
- [ ] Add error handling and recovery

### Verification Steps

- [ ] Can start a collaboration session
- [ ] Can join a session via room ID
- [ ] WebRTC peers connect automatically
- [ ] Cursor positions sync in real-time
- [ ] Node changes sync across all peers
- [ ] Audio chat works between peers
- [ ] Falls back to WebSocket when WebRTC fails
- [ ] Can invite users to session
- [ ] Can toggle audio/video
- [ ] Disconnections handled gracefully

### Notes

- WebRTC connections are peer-to-peer (no server relay)
- Signaling server only helps with initial connection
- TURN server used as fallback when P2P impossible
- Yjs handles conflict resolution automatically
- Awareness updates are lightweight (not stored in doc)

---

## GIT-8: Notification System

**Priority**: High  
**Estimated Hours**: 50-70  
**Dependencies**: GIT-6 (Notification Server)

### Purpose

Implement persistent cross-session notification system for collaboration invites, community events, mentions, and updates.

### Technical Requirements

**File: `packages/noodl-editor/src/editor/src/services/NotificationManager.ts`**

```typescript
import EventEmitter from 'events';

interface Notification {
  id: string;
  userId: string;
  fromUserId?: string;
  type: 'invite' | 'mention' | 'thread' | 'session' | 'component' | 'system';
  title: string;
  message: string;
  data?: any;
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

export class NotificationManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private notifications: Map<string, Notification> = new Map();
  private userId: string | null = null;
  private notificationServerUrl: string;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(notificationServerUrl: string) {
    super();
    this.notificationServerUrl = notificationServerUrl;
  }

  async initialize(userId: string) {
    this.userId = userId;
    await this.connect();
    await this.loadNotifications();
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.notificationServerUrl);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        
        // Authenticate
        this.ws!.send(JSON.stringify({
          type: 'authenticate',
          userId: this.userId
        }));
        
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
        
        if (msg.type === 'authenticated') {
          resolve();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected');
        
        // Auto-reconnect
        this.scheduleReconnect();
      };
    });
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;
    
    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      try {
        await this.connect();
        await this.loadNotifications();
      } catch (err) {
        console.error('Reconnection failed:', err);
        this.scheduleReconnect();
      }
    }, 5000);
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'authenticated':
        // Connection established
        break;
        
      case 'notifications':
        // Initial notification list
        msg.notifications.forEach((n: any) => {
          const notification = this.parseNotification(n);
          this.notifications.set(notification.id, notification);
        });
        this.emit('notifications-loaded', Array.from(this.notifications.values()));
        break;
        
      case 'notification':
        // New notification
        const notification = this.parseNotification(msg.notification);
        this.notifications.set(notification.id, notification);
        this.emit('notification-received', notification);
        
        // Show toast
        this.showToast(notification);
        break;
        
      case 'notification-updated':
        // Notification marked read
        const updated = this.parseNotification(msg.notification);
        this.notifications.set(updated.id, updated);
        this.emit('notification-updated', updated);
        break;
        
      case 'notification-deleted':
        // Notification deleted
        this.notifications.delete(msg.notificationId);
        this.emit('notification-deleted', msg.notificationId);
        break;
    }
  }

  private parseNotification(data: any): Notification {
    return {
      id: data.id,
      userId: data.userId,
      fromUserId: data.fromUserId,
      type: data.type,
      title: this.getNotificationTitle(data),
      message: this.getNotificationMessage(data),
      data: data.data,
      read: data.read,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
      readAt: data.readAt ? new Date(data.readAt) : undefined,
      actions: this.getNotificationActions(data)
    };
  }

  private getNotificationTitle(data: any): string {
    switch (data.type) {
      case 'invite':
        return 'Collaboration Invite';
      case 'mention':
        return 'Someone mentioned you';
      case 'thread':
        return 'New discussion thread';
      case 'session':
        return 'Public session available';
      case 'component':
        return 'New component available';
      case 'system':
        return 'System notification';
      default:
        return 'Notification';
    }
  }

  private getNotificationMessage(data: any): string {
    switch (data.type) {
      case 'invite':
        return `${data.data.from} invited you to collaborate on "${data.data.sessionTitle}"`;
      case 'mention':
        return `${data.data.from} mentioned you in ${data.data.location}`;
      case 'thread':
        return `New thread in ${data.data.community}: "${data.data.threadTitle}"`;
      case 'session':
        return `${data.data.host} started a public session: "${data.data.sessionTitle}"`;
      case 'component':
        return `${data.data.author} published "${data.data.componentName}"`;
      case 'system':
        return data.data.message;
      default:
        return JSON.stringify(data.data);
    }
  }

  private getNotificationActions(data: any): NotificationAction[] {
    switch (data.type) {
      case 'invite':
        return [
          { label: 'Join', action: 'join', primary: true },
          { label: 'Decline', action: 'decline' }
        ];
      case 'session':
        return [
          { label: 'Join Session', action: 'join', primary: true }
        ];
      case 'thread':
        return [
          { label: 'View Thread', action: 'view', primary: true }
        ];
      case 'component':
        return [
          { label: 'View Component', action: 'view', primary: true }
        ];
      default:
        return [];
    }
  }

  private async loadNotifications() {
    if (!this.ws || !this.isConnected) return;
    
    this.ws.send(JSON.stringify({
      type: 'get-notifications'
    }));
  }

  async sendNotification(targetUserId: string, type: Notification['type'], data: any) {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to notification server');
    }
    
    return new Promise<void>((resolve, reject) => {
      const handler = (msg: any) => {
        if (msg.type === 'notification-sent') {
          this.ws!.removeEventListener('message', handler);
          resolve();
        }
      };
      
      this.ws!.addEventListener('message', (event) => {
        handler(JSON.parse(event.data));
      });
      
      this.ws.send(JSON.stringify({
        type: 'send-notification',
        targetUserId,
        type,
        data
      }));
    });
  }

  async markAsRead(notificationId: string) {
    if (!this.ws || !this.isConnected) return;
    
    this.ws.send(JSON.stringify({
      type: 'mark-read',
      notificationId
    }));
  }

  async deleteNotification(notificationId: string) {
    if (!this.ws || !this.isConnected) return;
    
    this.ws.send(JSON.stringify({
      type: 'delete-notification',
      notificationId
    }));
  }

  getNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getUnreadCount(): number {
    return Array.from(this.notifications.values())
      .filter(n => !n.read).length;
  }

  private showToast(notification: Notification) {
    // Emit event for UI to show toast
    this.emit('show-toast', notification);
  }

  destroy() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

**File: `packages/noodl-editor/src/editor/src/components/NotificationToast.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { Notification } from '../services/NotificationManager';

interface NotificationToastProps {
  notification: Notification;
  onAction: (action: string) => void;
  onDismiss: () => void;
}

export function NotificationToast({
  notification,
  onAction,
  onDismiss
}: NotificationToastProps) {
  const [isVisible, = useState(true);
  
  useEffect(() => {
    // Auto-dismiss after 10 seconds
    const timeout = setTimeout(() => {
      onDismiss();
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [onDismiss]);
  
  if (!isVisible) return null;
  
  return (
    <div className="notification-toast">
      <div className="toast-header">
        <span className="toast-icon">{getIconForType(notification.type)}</span>
        <span className="toast-title">{notification.title}</span>
        <button className="toast-close" onClick={onDismiss}>×</button>
      </div>
      
      <div className="toast-body">
        <p>{notification.message}</p>
      </div>
      
      {notification.actions && notification.actions.length > 0 && (
        <div className="toast-actions">
          {notification.actions.map(action => (
            <button
              key={action.action}
              className={action.primary ? 'primary' : ''}
              onClick={() => onAction(action.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getIconForType(type: Notification['type']): string {
  switch (type) {
    case 'invite': return '👥';
    case 'mention': return '@';
    case 'thread': return '💬';
    case 'session': return '🎮';
    case 'component': return '📦';
    case 'system': return 'ℹ️';
    default: return '🔔';
  }
}
```

### Implementation Tasks

- [ ] Implement `NotificationManager` service
- [ ] Connect to notification server on app start
- [ ] Implement notification parsing and storage
- [ ] Implement toast notification UI component
- [ ] Add notification badge to launcher/editor
- [ ] Add notification center panel
- [ ] Implement mark as read functionality
- [ ] Implement delete functionality
- [ ] Add notification actions (join, view, etc.)
- [ ] Persist notification state locally
- [ ] Add notification sound (optional)
- [ ] Add desktop notifications (Electron)

### Verification Steps

- [ ] Notifications persist across sessions
- [ ] Toast appears when notification received
- [ ] Can mark notifications as read
- [ ] Can delete notifications
- [ ] Unread count displays correctly
- [ ] Actions trigger correct behavior
- [ ] Desktop notifications work (Electron)
- [ ] Reconnects after connection loss

---

*Due to character limits, I'll continue with GIT-9, GIT-10, and GIT-11 in a summary format. Would you like me to create a second file with the remaining tasks?*

---

## Summary of Remaining Tasks

### GIT-9: Community Tab UI/UX (80-100 hours)
- Browse communities (official + user-added)
- Discover public collaboration sessions
- Component library browser
- Tutorial and showcase feeds
- Job board integration
- Discussion thread viewer

### GIT-10: Session Discovery & Joining (50-70 hours)
- Public session list
- Join via room ID/link
- Session details preview
- Quick join flow
- Session history
- Favorites/bookmarks

### GIT-11: Integration & Polish (61-82 hours)
- End-to-end testing
- Performance optimization
- Documentation
- Demo videos
- Marketing materials
- Server deployment
- Monitor and analytics

**Total Series Hours: 431-572 hours**
