# Phase D: Chrome Extension Target

## Overview

Chrome extensions are web applications with special capabilities - they can inject content into other websites, run persistent background scripts, and access browser APIs. Since Noodl already exports HTML/CSS/JS, the core export is straightforward. The complexity lies in handling the unique execution contexts and APIs.

**Timeline:** 2-3 weeks  
**Priority:** Lowest (niche use case, but quick win)  
**Prerequisites:** Phase E (Target System Core)

## Value Proposition

- Build browser extensions without learning the extension API
- Visual node-based approach to content injection
- Hot-reload development workflow
- Package for Chrome Web Store distribution

## Chrome Extension Architecture

### Extension Components

```
my-extension/
├── manifest.json           # Extension configuration
├── popup/                  # Toolbar popup (standard web page)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/             # Service worker (persistent logic)
│   └── service-worker.js
├── content/                # Scripts injected into web pages
│   └── content-script.js
├── options/                # Settings page
│   ├── options.html
│   └── options.js
└── assets/
    └── icons/
```

### Manifest V3 (Required for Chrome)

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Built with Noodl",
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  
  "background": {
    "service_worker": "background/service-worker.js"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content-script.js"],
    "css": ["content/content-styles.css"]
  }],
  
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  
  "host_permissions": [
    "https://*.example.com/*"
  ]
}
```

## Execution Contexts

Chrome extensions have three distinct execution contexts, each with different capabilities:

### 1. Popup Context (Standard Noodl)

The popup is a standard HTML page that appears when clicking the extension icon. This is the most familiar context - essentially a small web app.

**Characteristics:**
- Standard DOM access
- Runs when popup is open, terminates when closed
- No persistent state (use chrome.storage)
- Can communicate with background and content scripts

**Noodl Mapping:** Default Noodl web export works here directly.

### 2. Background Context (Service Worker)

A service worker that runs persistently (with limitations in MV3). Handles events, manages state, coordinates between contexts.

**Characteristics:**
- No DOM access
- Event-driven (wakes on events, sleeps when idle)
- Has access to most chrome.* APIs
- Can communicate with all other contexts

**Noodl Mapping:** Requires special "Background" components that compile differently - no visual nodes, only logic nodes.

### 3. Content Script Context (Injected)

Scripts injected into web pages. Can read/modify the page DOM but run in an isolated environment.

**Characteristics:**
- Full DOM access to the host page
- Isolated JavaScript context (can't access page's JS)
- Limited chrome.* API access
- Must communicate with background for most operations

**Noodl Mapping:** Special "Content Script" components that inject into pages.

## Node Definitions

### Storage Nodes

#### Storage Get Node

Access extension storage (synced across devices or local only).

```typescript
interface StorageGetNode {
  category: 'Chrome Extension';
  displayName: 'Storage Get';
  docs: 'Retrieves a value from extension storage';
  
  inputs: {
    get: Signal;                         // Trigger retrieval
    key: string;                         // Storage key
    storageArea: 'sync' | 'local';       // sync = across devices, local = this browser
    defaultValue: any;                   // Value if key doesn't exist
  };
  
  outputs: {
    value: any;                          // Retrieved value
    found: boolean;                      // Whether key existed
    fetched: Signal;                     // Fires when retrieval completes
    failed: Signal;                      // Fires on error
    error: string;                       // Error message
  };
}
```

**Implementation:**
```typescript
chrome.storage[storageArea].get([key], (result) => {
  if (chrome.runtime.lastError) {
    outputs.error = chrome.runtime.lastError.message;
    outputs.failed();
  } else {
    outputs.value = result[key] ?? defaultValue;
    outputs.found = key in result;
    outputs.fetched();
  }
});
```

#### Storage Set Node

```typescript
interface StorageSetNode {
  category: 'Chrome Extension';
  displayName: 'Storage Set';
  
  inputs: {
    set: Signal;
    key: string;
    value: any;
    storageArea: 'sync' | 'local';
  };
  
  outputs: {
    saved: Signal;
    failed: Signal;
    error: string;
  };
}
```

#### Storage Watch Node

```typescript
interface StorageWatchNode {
  category: 'Chrome Extension';
  displayName: 'Storage Watch';
  docs: 'Watches for changes to storage values';
  
  inputs: {
    key: string;                         // Key to watch (empty = all keys)
    storageArea: 'sync' | 'local' | 'both';
  };
  
  outputs: {
    changedKey: string;                  // Which key changed
    oldValue: any;                       // Previous value
    newValue: any;                       // New value
    changed: Signal;                     // Fires on any change
  };
}
```

### Tab Nodes

#### Get Active Tab Node

```typescript
interface GetActiveTabNode {
  category: 'Chrome Extension';
  displayName: 'Get Active Tab';
  
  inputs: {
    get: Signal;
  };
  
  outputs: {
    tabId: number;
    windowId: number;
    url: string;
    title: string;
    favIconUrl: string;
    incognito: boolean;
    pinned: boolean;
    fetched: Signal;
    failed: Signal;
  };
}
```

**Implementation:**
```typescript
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    const tab = tabs[0];
    outputs.tabId = tab.id;
    outputs.url = tab.url;
    outputs.title = tab.title;
    // ... other properties
    outputs.fetched();
  }
});
```

#### Query Tabs Node

```typescript
interface QueryTabsNode {
  category: 'Chrome Extension';
  displayName: 'Query Tabs';
  
  inputs: {
    query: Signal;
    url: string;                         // URL pattern (supports wildcards)
    title: string;                       // Title pattern
    currentWindow: boolean;
    active: boolean;
    pinned: boolean;
    audible: boolean;
  };
  
  outputs: {
    tabs: Tab[];                         // Matching tabs
    count: number;                       // Number of matches
    fetched: Signal;
    failed: Signal;
  };
}
```

#### Create Tab Node

```typescript
interface CreateTabNode {
  category: 'Chrome Extension';
  displayName: 'Create Tab';
  
  inputs: {
    create: Signal;
    url: string;
    active: boolean;                     // Whether to focus the tab
    pinned: boolean;
    index: number;                       // Position in tab bar (-1 = end)
    windowId: number;                    // Target window (-1 = current)
  };
  
  outputs: {
    tabId: number;
    created: Signal;
    failed: Signal;
  };
}
```

#### Update Tab Node

```typescript
interface UpdateTabNode {
  category: 'Chrome Extension';
  displayName: 'Update Tab';
  
  inputs: {
    update: Signal;
    tabId: number;                       // Target tab (-1 = active tab)
    url: string;
    active: boolean;
    pinned: boolean;
    muted: boolean;
  };
  
  outputs: {
    updated: Signal;
    failed: Signal;
  };
}
```

#### Close Tab Node

```typescript
interface CloseTabNode {
  category: 'Chrome Extension';
  displayName: 'Close Tab';
  
  inputs: {
    close: Signal;
    tabId: number;                       // Tab to close (-1 = active tab)
  };
  
  outputs: {
    closed: Signal;
    failed: Signal;
  };
}
```

#### Tab Events Node

```typescript
interface TabEventsNode {
  category: 'Chrome Extension';
  displayName: 'Tab Events';
  docs: 'Listen for tab lifecycle events';
  
  inputs: {
    // Configuration only, always listening
  };
  
  outputs: {
    // Created
    createdTabId: number;
    onCreated: Signal;
    
    // Updated
    updatedTabId: number;
    updatedUrl: string;
    updatedTitle: string;
    updatedStatus: 'loading' | 'complete';
    onUpdated: Signal;
    
    // Activated
    activatedTabId: number;
    onActivated: Signal;
    
    // Removed
    removedTabId: number;
    onRemoved: Signal;
  };
}
```

### Messaging Nodes

#### Send Message Node

Cross-context communication within the extension.

```typescript
interface SendMessageNode {
  category: 'Chrome Extension';
  displayName: 'Send Message';
  docs: 'Send message to other parts of the extension';
  
  inputs: {
    send: Signal;
    target: 'background' | 'popup' | 'content' | 'tab';
    tabId: number;                       // Required if target is 'tab' or 'content'
    action: string;                      // Message type identifier
    data: object;                        // Message payload
  };
  
  outputs: {
    response: any;                       // Response from recipient
    sent: Signal;
    responded: Signal;
    failed: Signal;
    error: string;
  };
}
```

**Implementation:**
```typescript
// To background or popup
if (target === 'background' || target === 'popup') {
  chrome.runtime.sendMessage({ action, data }, (response) => {
    outputs.response = response;
    outputs.responded();
  });
}

// To content script in specific tab
if (target === 'content' || target === 'tab') {
  chrome.tabs.sendMessage(tabId, { action, data }, (response) => {
    outputs.response = response;
    outputs.responded();
  });
}
```

#### Receive Message Node

```typescript
interface ReceiveMessageNode {
  category: 'Chrome Extension';
  displayName: 'Receive Message';
  
  inputs: {
    actions: string[];                   // Filter by action type (empty = all)
  };
  
  outputs: {
    action: string;                      // Received action type
    data: any;                           // Message payload
    senderId: number;                    // Sender tab ID (if from content script)
    senderUrl: string;                   // Sender URL
    received: Signal;
    
    // Response mechanism
    respond: Signal;                     // Trigger to send response
    responseData: any;                   // Data to send back
  };
}
```

### Content Script Nodes

#### Inject Script Node

Programmatically inject scripts into pages.

```typescript
interface InjectScriptNode {
  category: 'Chrome Extension';
  displayName: 'Inject Script';
  contextWarning: 'Background/Popup only';
  
  inputs: {
    inject: Signal;
    tabId: number;                       // Target tab (-1 = active)
    scriptId: string;                    // Reference to content script component
    allFrames: boolean;                  // Inject into all frames
  };
  
  outputs: {
    injected: Signal;
    failed: Signal;
    error: string;
  };
}
```

#### Inject CSS Node

```typescript
interface InjectCSSNode {
  category: 'Chrome Extension';
  displayName: 'Inject CSS';
  contextWarning: 'Background/Popup only';
  
  inputs: {
    inject: Signal;
    tabId: number;
    css: string;                         // CSS code to inject
    allFrames: boolean;
  };
  
  outputs: {
    injected: Signal;
    failed: Signal;
  };
}
```

#### Page DOM Access Node

For content scripts - interact with host page DOM.

```typescript
interface PageDOMNode {
  category: 'Chrome Extension';
  displayName: 'Page DOM';
  contextWarning: 'Content Script only';
  
  inputs: {
    query: Signal;
    selector: string;                    // CSS selector
    action: 'get' | 'set' | 'click' | 'getAttribute' | 'setAttribute';
    property: string;                    // For get/set (innerHTML, textContent, value, etc.)
    value: string;                       // For set/setAttribute
    attributeName: string;               // For getAttribute/setAttribute
  };
  
  outputs: {
    element: HTMLElement;                // Found element (first match)
    elements: HTMLElement[];             // All matches
    count: number;                       // Number of matches
    value: string;                       // Retrieved value
    success: Signal;
    notFound: Signal;
    failed: Signal;
  };
}
```

### Context Menu Node

```typescript
interface ContextMenuNode {
  category: 'Chrome Extension';
  displayName: 'Context Menu';
  contextWarning: 'Background only';
  
  inputs: {
    create: Signal;
    id: string;
    title: string;
    contexts: ('page' | 'selection' | 'link' | 'image' | 'all')[];
    parentId: string;                    // For submenus
    enabled: boolean;
    visible: boolean;
  };
  
  outputs: {
    menuInfo: {
      menuItemId: string;
      selectionText: string;
      linkUrl: string;
      srcUrl: string;
      pageUrl: string;
    };
    clicked: Signal;
    created: Signal;
    failed: Signal;
  };
}
```

### Badge Node

Control the extension icon badge.

```typescript
interface BadgeNode {
  category: 'Chrome Extension';
  displayName: 'Badge';
  
  inputs: {
    update: Signal;
    text: string;                        // Badge text (4 chars max)
    backgroundColor: string;             // Hex color
    textColor: string;                   // Hex color
    tabId: number;                       // Per-tab badge (-1 = global)
  };
  
  outputs: {
    updated: Signal;
    failed: Signal;
  };
}
```

### Notification Node

```typescript
interface ExtensionNotificationNode {
  category: 'Chrome Extension';
  displayName: 'Notification';
  
  inputs: {
    show: Signal;
    clear: Signal;
    id: string;                          // For updating/clearing
    type: 'basic' | 'image' | 'list' | 'progress';
    title: string;
    message: string;
    iconUrl: string;
    imageUrl: string;                    // For 'image' type
    items: { title: string; message: string }[];  // For 'list' type
    progress: number;                    // For 'progress' type (0-100)
    buttons: { title: string }[];        // Max 2 buttons
    requireInteraction: boolean;
  };
  
  outputs: {
    notificationId: string;
    shown: Signal;
    clicked: Signal;
    buttonIndex: number;                 // Which button was clicked
    buttonClicked: Signal;
    closed: Signal;
    failed: Signal;
  };
}
```

### Alarms Node

Schedule recurring or one-time events.

```typescript
interface AlarmNode {
  category: 'Chrome Extension';
  displayName: 'Alarm';
  contextWarning: 'Background only';
  
  inputs: {
    create: Signal;
    clear: Signal;
    name: string;
    delayMinutes: number;                // When to first fire
    periodMinutes: number;               // Repeat interval (0 = one-time)
  };
  
  outputs: {
    alarmName: string;
    created: Signal;
    fired: Signal;
    cleared: Signal;
    failed: Signal;
  };
}
```

### Permissions Node

Request additional permissions at runtime.

```typescript
interface PermissionsNode {
  category: 'Chrome Extension';
  displayName: 'Request Permissions';
  
  inputs: {
    request: Signal;
    check: Signal;
    permissions: string[];               // e.g., ['bookmarks', 'history']
    origins: string[];                   // e.g., ['https://example.com/*']
  };
  
  outputs: {
    granted: boolean;
    requestGranted: Signal;
    requestDenied: Signal;
    checked: Signal;
  };
}
```

## Preview Mode

### Extension Preview Challenges

Unlike web apps, extensions can't simply run in a browser tab. They need to be loaded as unpacked extensions.

### Preview Approach

1. **Popup Preview (Default)**
   - Simulate popup dimensions in Noodl preview (400px × 600px max)
   - Mock chrome.* APIs where possible
   - Show "extension-only" features with warning badges

2. **Live Extension Preview**
   - "Load as Extension" button exports to temp folder
   - Opens `chrome://extensions` with instructions
   - Developer enables "Developer mode" and loads unpacked
   - Changes in Noodl trigger reload (via extension reload API)

### Mock Chrome APIs

For popup preview, we mock chrome.* APIs:

```typescript
const mockChrome = {
  storage: {
    local: createMockStorage('local'),
    sync: createMockStorage('sync'),
  },
  
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.com', title: 'Mock Tab' }],
    create: async () => ({ id: 2 }),
    update: async () => ({}),
  },
  
  runtime: {
    sendMessage: async (msg) => {
      console.log('[Mock] Message sent:', msg);
      return { mocked: true };
    },
    onMessage: {
      addListener: (cb) => {
        console.log('[Mock] Message listener added');
      }
    }
  }
};

function createMockStorage(area: string) {
  const storage = new Map();
  return {
    get: (keys, cb) => {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach(k => {
        result[k] = storage.get(k);
      });
      cb(result);
    },
    set: (items, cb) => {
      Object.entries(items).forEach(([k, v]) => storage.set(k, v));
      cb?.();
    }
  };
}

// Inject mock in preview mode
if (isNoodlPreview) {
  window.chrome = mockChrome;
}
```

### Extension-Specific Preview UI

```
┌─────────────────────────────────────────────────────────────┐
│ Preview                                    [Popup ▾] [📦]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐                        │
│  │                                 │                        │
│  │     Popup Preview               │   ⚠️ Extension APIs   │
│  │     (400 × 600)                 │      are mocked       │
│  │                                 │                        │
│  │                                 │   [Load as Extension] │
│  │                                 │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
│  Context: Popup | Content Script | Background               │
└─────────────────────────────────────────────────────────────┘
```

## Export Pipeline

### Export Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Export Chrome Extension                              [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Extension Name: [My Extension________________]             │
│  Version: [1.0.0____]                                       │
│  Description: [Built with Noodl______________]              │
│                                                             │
│  ── Icons ──────────────────────────────────────────────   │
│  16×16:  [icon16.png] [Browse]                              │
│  48×48:  [icon48.png] [Browse]                              │
│  128×128:[icon128.png][Browse]                              │
│                                                             │
│  ── Permissions ────────────────────────────────────────   │
│  ☑ Storage (used by Storage nodes)                          │
│  ☑ Tabs (used by Tab nodes)                                 │
│  ☐ Bookmarks                                                │
│  ☐ History                                                  │
│  ☐ Downloads                                                │
│                                                             │
│  ── Host Permissions ───────────────────────────────────   │
│  Pattern: [https://example.com/*_________] [+ Add]          │
│  • https://example.com/*                             [×]    │
│                                                             │
│  ── Content Scripts ────────────────────────────────────   │
│  Component: [ContentOverlay ▾]                              │
│  URL Match: [<all_urls>______________]                      │
│  Run At: [Document End ▾]                                   │
│                                                             │
│                                                             │
│                          [Export to Folder] [Package .zip]  │
└─────────────────────────────────────────────────────────────┘
```

### Generated Structure

```
my-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js              # Bundled Noodl runtime
│   └── popup.css
├── background/
│   └── service-worker.js     # From Background components
├── content/
│   ├── content-script.js     # From Content Script components
│   └── content-styles.css
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── _locales/                  # If internationalization used
    └── en/
        └── messages.json
```

### Manifest Generation

```typescript
function generateManifest(config: ExtensionConfig): ManifestV3 {
  const manifest: ManifestV3 = {
    manifest_version: 3,
    name: config.name,
    version: config.version,
    description: config.description,
    
    action: {
      default_popup: 'popup/popup.html',
      default_icon: config.icons,
    },
    
    permissions: detectPermissions(config.usedNodes),
    host_permissions: config.hostPermissions,
  };
  
  // Add background if Background components exist
  if (config.hasBackgroundComponents) {
    manifest.background = {
      service_worker: 'background/service-worker.js',
    };
  }
  
  // Add content scripts if configured
  if (config.contentScripts.length > 0) {
    manifest.content_scripts = config.contentScripts.map(cs => ({
      matches: cs.matches,
      js: [`content/${cs.componentId}.js`],
      css: cs.hasStyles ? [`content/${cs.componentId}.css`] : undefined,
      run_at: cs.runAt,
    }));
  }
  
  return manifest;
}

function detectPermissions(usedNodes: string[]): string[] {
  const permissions = new Set<string>();
  
  const nodePermissionMap = {
    'StorageGet': 'storage',
    'StorageSet': 'storage',
    'StorageWatch': 'storage',
    'GetActiveTab': 'tabs',
    'QueryTabs': 'tabs',
    'CreateTab': 'tabs',
    'TabEvents': 'tabs',
    'Alarm': 'alarms',
    'ContextMenu': 'contextMenus',
    'Notification': 'notifications',
    'Bookmarks': 'bookmarks',
    'History': 'history',
  };
  
  usedNodes.forEach(node => {
    if (nodePermissionMap[node]) {
      permissions.add(nodePermissionMap[node]);
    }
  });
  
  return Array.from(permissions);
}
```

### Component Type Handling

Different Noodl components compile to different extension contexts:

```typescript
interface ExtensionComponent {
  id: string;
  name: string;
  context: 'popup' | 'background' | 'content';
  // Popup: Default, runs in popup HTML
  // Background: Compiles to service worker
  // Content: Compiles to content script
}

function compileExtension(project: Project): ExtensionBundle {
  const components = project.getComponents();
  
  const popup = components.filter(c => c.extensionContext === 'popup');
  const background = components.filter(c => c.extensionContext === 'background');
  const content = components.filter(c => c.extensionContext === 'content');
  
  return {
    popup: {
      html: generatePopupHTML(popup),
      js: bundleComponents(popup, { includeDOM: true }),
      css: extractStyles(popup),
    },
    background: {
      js: bundleComponents(background, { 
        includeDOM: false, 
        wrapAsServiceWorker: true 
      }),
    },
    content: content.map(c => ({
      id: c.id,
      js: bundleComponents([c], { 
        includeDOM: true,
        isolatedExecution: true 
      }),
      css: extractStyles([c]),
    })),
  };
}
```

## Security Considerations

### Permission Minimization

- Auto-detect permissions from used nodes
- Warn users about broad permissions (e.g., `<all_urls>`)
- Explain each permission in UI

### Host Permission Patterns

```typescript
const hostPermissionWarnings = {
  '<all_urls>': 'Allows access to ALL websites. Consider using specific patterns.',
  '*://*/*': 'Same as <all_urls> - very broad access.',
  'http://*/*': 'Warning: HTTP sites are insecure.',
};

function validateHostPermission(pattern: string): ValidationResult {
  if (pattern in hostPermissionWarnings) {
    return { valid: true, warning: hostPermissionWarnings[pattern] };
  }
  
  // Validate pattern format
  const validPattern = /^(https?|ftp|\*):\/\/(\*|\*?\.[^\/\*]+|\[^\/\*]+)\/(.*)?$/;
  if (!validPattern.test(pattern)) {
    return { valid: false, error: 'Invalid URL pattern format' };
  }
  
  return { valid: true };
}
```

### Content Script Isolation

Content scripts run in an isolated world - they can't access the page's JavaScript but can access the DOM. This is a security feature.

```typescript
// Content scripts CAN:
document.querySelector('#element').textContent = 'Modified';

// Content scripts CANNOT:
window.pageGlobalVariable; // undefined
myPageFunction(); // undefined
```

### Chrome Web Store Requirements

For distribution, extensions must comply with:
- Single purpose policy
- Privacy policy requirement
- Minimal permissions
- Clear description of functionality

Generate compliance checklist in export:

```
□ Extension has a single, clear purpose
□ All permissions are necessary and explained
□ Privacy policy URL provided (if using user data)
□ Description accurately reflects functionality
□ Icons are appropriate and not misleading
```

## Implementation Phases

### Phase 1: Extension Export Foundation (3-4 days)

**Goal:** Generate valid extension structure from popup components

**Tasks:**
1. Create manifest.json generator
2. Bundle popup components to extension format
3. Export to folder functionality
4. Chrome extension loading instructions UI

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/
└── export/
    └── ExtensionExporter.ts

packages/noodl-editor/src/editor/src/views/
└── ExportExtensionDialog/
    ├── ExportExtensionDialog.tsx
    └── ExportExtensionDialog.module.css
```

**Verification:**
- [ ] Exported extension loads in Chrome
- [ ] Popup displays correctly
- [ ] Manifest contains correct metadata

### Phase 2: Extension-Specific Nodes (1 week)

**Goal:** Implement core chrome.* API nodes

**Tasks:**
1. Storage nodes (Get, Set, Watch)
2. Tab nodes (Query, Create, Update, Close, Events)
3. Messaging nodes (Send, Receive)
4. Badge node
5. Context Menu node
6. Notification node

**Files to Create:**
```
packages/noodl-runtime/src/nodes/
└── chrome-extension/
    ├── storage-get.ts
    ├── storage-set.ts
    ├── storage-watch.ts
    ├── tabs-query.ts
    ├── tabs-create.ts
    ├── tabs-events.ts
    ├── messaging-send.ts
    ├── messaging-receive.ts
    ├── badge.ts
    ├── context-menu.ts
    └── notification.ts
```

**Verification:**
- [ ] Storage persists across popup opens
- [ ] Tab operations work correctly
- [ ] Messaging between contexts works
- [ ] All nodes have proper error handling

### Phase 3: Preview Mode (3-4 days)

**Goal:** Mock chrome.* APIs for in-editor preview

**Tasks:**
1. Create mock chrome API implementation
2. Popup dimension simulation
3. Extension context indicator
4. "Load as Extension" quick action

**Files to Create:**
```
packages/noodl-runtime/src/
└── mocks/
    └── chrome-api-mock.ts

packages/noodl-editor/src/editor/src/views/viewer/
└── ExtensionPreviewFrame.tsx
```

**Verification:**
- [ ] Preview shows popup at correct dimensions
- [ ] Mock storage persists during session
- [ ] Clear indicators for mocked functionality

### Phase 4: Background & Content Scripts (4-5 days)

**Goal:** Support all extension contexts

**Tasks:**
1. Component context selector UI
2. Background component compilation (no DOM)
3. Content script compilation
4. Cross-context communication testing
5. Content script injection nodes

**Verification:**
- [ ] Background service worker runs correctly
- [ ] Content scripts inject into pages
- [ ] Messaging works across all contexts
- [ ] DOM nodes disabled in background components

## Dependencies

### From Target System Core (Phase E)

- Target compatibility system (nodes marked as extension-only)
- Build-time validation (prevent incompatible nodes)
- Context selector UI pattern

### External Dependencies

None required - Chrome extension APIs are built into the browser.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Manifest V3 complexity | Medium | Medium | Start with popup-only, add contexts incrementally |
| Service worker limitations | High | Low | Document MV3 restrictions clearly |
| Chrome Web Store review | Low | High | Generate compliance checklist |
| Cross-context messaging bugs | Medium | Medium | Comprehensive testing suite |
| Preview fidelity | High | Low | Clear "mocked" indicators |

## Success Metrics

**MVP Success:**
- Popup-only extensions export and load correctly
- Storage and Tab nodes work
- Users can submit to Chrome Web Store

**Full Success:**
- All three contexts supported
- Full node library (15+ nodes)
- Live reload development workflow
- One-click packaging for store submission

## Related Documentation

- [Chrome Extension Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
