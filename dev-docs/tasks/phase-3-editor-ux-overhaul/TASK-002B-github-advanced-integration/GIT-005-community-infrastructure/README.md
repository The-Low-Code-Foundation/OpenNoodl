# GIT-005: Community Infrastructure & Template Repository

## Overview

**Priority:** High  
**Estimated Hours:** 60-80  
**Dependencies:** GIT-004A (GitHub OAuth)  
**Status:** 🔴 Not Started

Create the foundational community infrastructure that enables users to fork and operate their own OpenNoodl communities. This includes the community template repository structure, server deployment templates, and community management system.

---

## Strategic Context

This task is part of the **Live Collaboration & Multi-Community System** (GIT-5 through GIT-11), which transforms OpenNoodl into a collaborative platform with:

- Multi-community management (join multiple communities simultaneously)
- Live collaboration sessions with audio/video chat
- Component library discovery across communities
- Community template repository (forkable)
- Self-hosted infrastructure options

---

## Technical Requirements

### 1. Community Template Repository

Create a new repository: `opennoodl-community` that serves as the template for all communities.

**Repository Structure:**

```
opennoodl-community/
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

### 2. Community Metadata Schema

**File: `community.json`**

This file is the single source of truth for community configuration.

```json
{
  "$schema": "https://opennoodl.org/schemas/community.v1.json",
  "version": "1.0.0",
  "community": {
    "id": "opennoodl-official",
    "name": "OpenNoodl Official Community",
    "description": "The official OpenNoodl visual programming community",
    "type": "public",
    "owner": {
      "github": "The-Low-Code-Foundation",
      "name": "Low Code Foundation",
      "website": "https://opennoodl.org",
      "contact": "community@opennoodl.org"
    },
    "repository": "https://github.com/The-Low-Code-Foundation/opennoodl-community",
    "createdAt": "2026-01-18T00:00:00Z",
    "updatedAt": "2026-01-18T00:00:00Z"
  },
  "servers": {
    "signaling": {
      "url": "wss://signal.opennoodl.org",
      "healthCheck": "https://signal.opennoodl.org/health"
    },
    "sync": {
      "url": "wss://sync.opennoodl.org",
      "healthCheck": "https://sync.opennoodl.org/health"
    },
    "turn": {
      "urls": ["turn:relay.opennoodl.org:3478"],
      "username": "opennoodl",
      "credentialType": "password"
    },
    "notifications": {
      "url": "wss://notify.opennoodl.org",
      "healthCheck": "https://notify.opennoodl.org/health"
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
    "logo": "https://opennoodl.org/community-logo.png",
    "favicon": "https://opennoodl.org/favicon.ico",
    "customCSS": null
  },
  "moderation": {
    "moderators": ["community-admin"],
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
      "org": "The-Low-Code-Foundation",
      "discussionsRepo": "The-Low-Code-Foundation/opennoodl-community",
      "issuesRepo": "The-Low-Code-Foundation/OpenNoodl"
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

### 3. GitHub Actions Workflows

See `GIT-5-to-GIT-11-Live-Collaboration-Community-System.md` for complete workflow implementations.

### 4. Editor Integration - CommunityManager Service

**File: `packages/noodl-editor/src/editor/src/services/CommunityManager.ts`**

Key responsibilities:

- Load and validate community configurations from GitHub repos
- Manage multiple community memberships
- Background sync of community configs
- Server health monitoring
- Community switching

---

## Implementation Tasks

- [ ] Create `opennoodl-community` template repository with full structure
- [ ] Implement `community.json` schema and JSON Schema validation
- [ ] Create GitHub Actions workflows for validation and sync
- [ ] Implement `CommunityManager` service in editor
- [ ] Create community settings UI panel
- [ ] Add "Add Community" flow (paste GitHub URL)
- [ ] Add "Create Community" flow (fork template)
- [ ] Implement background sync for community configs
- [ ] Add server health monitoring
- [ ] Create community switcher UI component

---

## Verification Steps

- [ ] Can fork `opennoodl-community` template and customize `community.json`
- [ ] GitHub Actions validate configuration on push
- [ ] Editor can add community by pasting GitHub URL
- [ ] Editor validates community config and checks server health
- [ ] Can switch between multiple communities
- [ ] Background sync updates community configs
- [ ] Invalid communities show error states
- [ ] Can remove communities (except official)

---

## Files to Create

```
packages/noodl-editor/src/editor/src/services/
├── CommunityManager.ts              # Community management service
├── CommunityTypes.ts                # TypeScript interfaces
└── CommunityValidation.ts           # Schema validation

packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/
├── CommunitySettings.tsx            # Settings UI
├── CommunitySettings.module.scss
├── components/
│   ├── CommunitySwitcher.tsx        # Dropdown to switch communities
│   ├── AddCommunityDialog.tsx       # Add by URL dialog
│   └── CommunityHealthIndicator.tsx # Server health display
└── hooks/
    └── useCommunityManager.ts       # React hook for manager
```

---

## Notes

- Official OpenNoodl community cannot be removed (hardcoded)
- Community configs are cached locally for offline access
- Server health checks run every sync cycle (15 minutes)
- Failed health checks show warning but don't remove community

---

## Related Tasks

- **GIT-006**: Server Infrastructure (signaling, sync, notifications servers)
- **GIT-007**: WebRTC Collaboration Client
- **GIT-009**: Community Tab UI/UX
