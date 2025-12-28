# Multi-Target Deployment Initiative

**Initiative ID:** INITIATIVE-001  
**Priority:** HIGH  
**Estimated Duration:** 16-22 weeks  
**Status:** Planning  
**Last Updated:** 2025-12-28

## Executive Summary

Transform Noodl from a web-only visual programming platform into a true multi-target development environment. Users will be able to build once and deploy to:

- **Web** (current) - Static sites, SPAs, PWAs
- **Mobile** (Capacitor) - iOS and Android native apps with device APIs
- **Desktop** (Electron) - Windows, macOS, Linux apps with file system access
- **Browser Extension** (Chrome) - Extensions with browser API access

Additionally, this initiative introduces **BYOB (Bring Your Own Backend)**, enabling users to connect to any BaaS platform (Directus, Supabase, Pocketbase, Firebase, etc.) rather than being locked to a single provider.

## Core Insight

Noodl's visual graph is already target-agnostic in principle. The nodes define *what* happens, not *where* it runs. Currently, tooling assumes web-only deployment, but the architecture naturally supports multiple targets through:

1. **Target-specific node libraries** (Capacitor Camera, Electron File System, etc.)
2. **Conditional runtime injection** (Capacitor bridge, Node.js integration)
3. **Target-aware export pipelines** (different build outputs per target)

## Strategic Value

| Target | Value Proposition |
|--------|-------------------|
| **Capacitor** | Mobile apps without learning Swift/Kotlin. Hot-reload preview. |
| **Electron** | Desktop apps with file access, offline capability, local AI (Ollama). |
| **Chrome Extension** | Browser tools, productivity extensions, content scripts. |
| **BYOB** | No vendor lock-in. Use existing infrastructure. Self-hosted options. |

## Project Architecture

### Current State
```
Graph Definition → Single Runtime (React/Web) → Single Deployment (Static Web)
```

### Target State
```
                                    ┌─→ Web Runtime ─────→ Static Web / PWA
                                    │
Graph Definition → Target Adapter ──┼─→ Capacitor Runtime → iOS/Android App
                                    │
                                    ├─→ Electron Runtime ─→ Desktop App
                                    │
                                    └─→ Extension Runtime → Chrome Extension
                                    
                    ↓
            Backend Abstraction Layer
                    ↓
    ┌───────────┬───────────┬───────────┬───────────┐
    │ Directus  │ Supabase  │ Pocketbase│  Custom   │
    └───────────┴───────────┴───────────┴───────────┘
```

## Target Selection System

### Philosophy

The graph itself is largely target-agnostic—it's the *nodes available* and *deployment output* that differ. This enables maximum flexibility while maintaining focused UX.

### User Experience Flow

#### 1. Project Creation
```
┌─────────────────────────────────────────────────────────────────────┐
│ Create New Project                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Project Name: [My App                              ]                │
│                                                                     │
│ Primary Target:                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ○ 🌐 Web Application                                            │ │
│ │   Static sites, SPAs, PWAs. Deploy anywhere.                    │ │
│ │                                                                 │ │
│ │ ● 📱 Mobile App (Capacitor)                        RECOMMENDED │ │
│ │   iOS and Android. Access camera, GPS, push notifications.     │ │
│ │                                                                 │ │
│ │ ○ 🖥️ Desktop App (Electron)                                     │ │
│ │   Windows, macOS, Linux. File system, local processes.         │ │
│ │                                                                 │ │
│ │ ○ 🧩 Browser Extension                                          │ │
│ │   Chrome extensions. Browser APIs, content scripts.            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ⓘ You can add more targets later in Project Settings               │
│                                                                     │
│                                    [Cancel]  [Create Project]       │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Adding Additional Targets (Project Settings)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Project Settings → Targets                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ PRIMARY TARGET                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📱 Mobile App (Capacitor)                            [Change]   │ │
│ │ Determines default node palette and preview mode                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ADDITIONAL TARGETS                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ☑ 🌐 Web Application                                            │ │
│ │ ☐ 🖥️ Desktop App (Electron)              [Configure...]         │ │
│ │ ☐ 🧩 Browser Extension                   [Configure...]         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ NODE COMPATIBILITY                                                  │
│ ⚠️ 3 nodes in your project are incompatible with some targets:     │
│   • Camera Capture - Only Capacitor, Electron                      │
│   • Push Notification - Only Capacitor                             │
│   • File System Read - Only Electron, Extension                    │
│                                                                     │
│ [View Compatibility Report]                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3. Node Palette with Compatibility Badges
```
┌─────────────────────────────────────────────────────────────────────┐
│ Node Palette                                         [🔍 Search]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ▼ DEVICE & PLATFORM                                                 │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 📷 Camera Capture              [📱] [🖥️]                    │   │
│   │ 📍 Geolocation                 [🌐] [📱] [🖥️] [🧩]          │   │
│   │ 🔔 Push Notification           [📱]                         │   │
│   │ 📁 File System Read            [🖥️] [🧩]                    │   │
│   │ 📁 File System Write           [🖥️]                         │   │
│   │ ⚙️ Run Process                  [🖥️]                         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ▼ BROWSER EXTENSION                                                 │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 🗂️ Extension Storage           [🧩]                         │   │
│   │ 📑 Browser Tabs                [🧩]                         │   │
│   │ 💬 Content Script Message      [🧩]                         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ▼ DATA & BACKEND                                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 📊 Query Records               [🌐] [📱] [🖥️] [🧩]          │   │
│   │ ➕ Create Record               [🌐] [📱] [🖥️] [🧩]          │   │
│   │ ✏️ Update Record               [🌐] [📱] [🖥️] [🧩]          │   │
│   │ 🌐 HTTP Request                [🌐] [📱] [🖥️] [🧩]          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Legend: [🌐] Web  [📱] Mobile  [🖥️] Desktop  [🧩] Extension        │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4. Duplicate as Different Target
```
┌─────────────────────────────────────────────────────────────────────┐
│ Duplicate Project                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Source: My Mobile App (Capacitor)                                   │
│                                                                     │
│ New Project Name: [My Mobile App - Web Version    ]                 │
│                                                                     │
│ New Primary Target:                                                 │
│ ● 🌐 Web Application                                                │
│ ○ 🖥️ Desktop App (Electron)                                        │
│ ○ 🧩 Browser Extension                                              │
│                                                                     │
│ COMPATIBILITY ANALYSIS                                              │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✅ 47 nodes are fully compatible                                │ │
│ │ ⚠️ 3 nodes need attention:                                      │ │
│ │                                                                 │ │
│ │   📷 Camera Capture                                             │ │
│ │   └─ Will use browser MediaDevices API (reduced features)      │ │
│ │                                                                 │ │
│ │   🔔 Push Notification                                          │ │
│ │   └─ Will use Web Push API (requires HTTPS, user permission)   │ │
│ │                                                                 │ │
│ │   📁 File System Read                                           │ │
│ │   └─ ❌ Not available in web. Will be disabled.                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                              [Cancel]  [Duplicate with Adaptations] │
└─────────────────────────────────────────────────────────────────────┘
```

### Technical Implementation

```typescript
// Project configuration model
interface NoodlProject {
  // Existing fields
  name: string;
  components: Component[];
  settings: ProjectSettings;
  
  // NEW: Target Configuration
  targets: TargetConfiguration;
  
  // NEW: Backend Configuration (BYOB)
  backends: BackendConfig[];
  activeBackendId: string;
}

interface TargetConfiguration {
  // Primary target determines default node palette and preview mode
  primary: TargetType;
  
  // Additional enabled targets
  enabled: TargetType[];
  
  // Per-target settings
  web?: WebTargetConfig;
  capacitor?: CapacitorTargetConfig;
  electron?: ElectronTargetConfig;
  extension?: ExtensionTargetConfig;
}

type TargetType = 'web' | 'capacitor' | 'electron' | 'extension';

interface WebTargetConfig {
  pwa: boolean;
  serviceWorker: boolean;
  baseUrl: string;
}

interface CapacitorTargetConfig {
  appId: string;           // com.example.myapp
  appName: string;
  platforms: ('ios' | 'android')[];
  plugins: string[];       // Enabled Capacitor plugins
  iosTeamId?: string;
  androidKeystore?: string;
}

interface ElectronTargetConfig {
  appId: string;
  productName: string;
  platforms: ('darwin' | 'win32' | 'linux')[];
  nodeIntegration: boolean;
  contextIsolation: boolean;
  permissions: ElectronPermission[];
}

interface ExtensionTargetConfig {
  manifestVersion: 3;
  name: string;
  permissions: string[];    // chrome.storage, chrome.tabs, etc.
  hostPermissions: string[];
  contentScripts?: ContentScriptConfig[];
  serviceWorker?: boolean;
}
```

## Phase Overview

| Phase | Name | Duration | Priority | Dependencies |
|-------|------|----------|----------|--------------|
| **A** | [BYOB Backend System](../01-byob-backend/README.md) | 4-6 weeks | 🔴 Critical | HTTP Node |
| **B** | [Capacitor Mobile Target](../02-capacitor-mobile/README.md) | 4-5 weeks | 🔴 High | Phase A |
| **C** | [Electron Desktop Target](../03-electron-desktop/README.md) | 3-4 weeks | 🟡 Medium | Phase A |
| **D** | [Chrome Extension Target](../04-chrome-extension/README.md) | 2-3 weeks | 🟢 Lower | Phase A |
| **E** | [Target System Core](../05-target-system/README.md) | 2-3 weeks | 🔴 Critical | Before B,C,D |

### Recommended Execution Order

```
Phase E (Target System Core) ─┬─→ Phase B (Capacitor) ─┐
                              │                        │
Phase A (BYOB Backend) ───────┼─→ Phase C (Electron) ──┼─→ Integration & Polish
                              │                        │
                              └─→ Phase D (Extension) ─┘
```

**Rationale:**
1. **Phase A (BYOB) and Phase E (Target System)** can proceed in parallel as foundation
2. **Phase B (Capacitor)** is highest user priority - mobile apps unlock massive value
3. **Phase C (Electron)** leverages existing `noodl-platform-electron` knowledge
4. **Phase D (Extension)** is most niche but relatively quick to implement

## Success Criteria

### MVP Success (Phase A + B complete)
- [ ] Users can configure Directus/Supabase as backend without code
- [ ] Data nodes work with configured backend
- [ ] Schema introspection populates dropdowns
- [ ] Capacitor preview with hot-reload works
- [ ] Can export iOS/Android-ready Capacitor project
- [ ] Camera, Geolocation, and Push nodes work in Capacitor

### Full Success (All phases complete)
- [ ] All four deployment targets working
- [ ] Seamless target switching in project settings
- [ ] Compatibility badges on all nodes
- [ ] Build-time validation prevents incompatible deployments
- [ ] "Duplicate as Target" feature works with adaptation analysis
- [ ] Multiple backends configurable per project

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Capacitor plugin complexity | Medium | High | Start with 3 core plugins, expand gradually |
| Backend abstraction leakiness | High | Medium | Accept platform-specific features won't abstract |
| Electron security concerns | Medium | High | Clear UI separation, sandboxed by default |
| Extension manifest v3 limitations | Medium | Medium | Document limitations, focus on popup use case |
| Scope creep | High | High | Strict phase gates, MVP-first approach |

## Related Documentation

- [BYOB Backend System](../01-byob-backend/README.md) - Extensive backend flexibility documentation
- [Capacitor Mobile Target](../02-capacitor-mobile/README.md) - Mobile app deployment
- [Electron Desktop Target](../03-electron-desktop/README.md) - Desktop app deployment
- [Chrome Extension Target](../04-chrome-extension/README.md) - Browser extension deployment
- [Target System Core](../05-target-system/README.md) - Node compatibility and target selection

## References

- Previous BYOB discussion: https://claude.ai/chat/905f39ae-973b-4c19-a3cc-6bf08befb513
- Existing deployment system: `packages/noodl-editor/src/editor/src/views/DeployPopup/`
- Existing preview system: `packages/noodl-editor/src/frames/viewer-frame/src/views/viewer.js`
- Platform abstraction: `packages/noodl-platform-electron/`
- TASK-002: Robust HTTP Node (prerequisite)
