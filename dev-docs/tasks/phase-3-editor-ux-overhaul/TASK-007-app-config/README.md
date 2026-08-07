# TASK-007: App Configuration & Environment System

## Overview

A new "App Setup" sidebar panel for defining app-wide configuration values (`Noodl.Config`), SEO metadata, PWA manifest generation, and an App Config node for accessing values without expressions.

**Estimated effort:** 64-86 hours  
**Priority:** High - Foundation for theming, SEO, PWA, and deployment features  
**Phase:** 3 (Editor UX Overhaul)

---

## Problem Statement

### Current Pain Points

1. **No central place for app metadata**: App name, description, and SEO values are scattered or missing
2. **Global variables require node clutter**: Users create Object/Variables nodes at App level and wire them everywhere, creating visual noise
3. **No PWA support**: Users must manually create manifest.json and configure service workers
4. **SEO is an afterthought**: No built-in way to set meta tags, Open Graph, or favicon
5. **Theming is manual**: No standard pattern for defining color palettes or configuration values

### User Stories

- *"I want to define my app's primary color once and reference it everywhere"*
- *"I want my app to appear correctly when shared on social media"*
- *"I want to add my app to home screen on mobile with proper icons"*
- *"I want a simple way to access config values without writing expressions"*

---

## Solution

### New Namespace: `Noodl.Config`

A **static, immutable** configuration namespace separate from `Noodl.Variables`:

```javascript
// Static - set once at app initialization, cannot change at runtime
Noodl.Config.appName        // "My Amazing App"
Noodl.Config.primaryColor   // "#d21f3c"
Noodl.Config.apiBaseUrl     // "https://api.example.com"
Noodl.Config.menuItems      // [{name: "Home", path: "/"}, ...]

// This is NOT allowed (throws or is ignored):
Noodl.Config.primaryColor = "#000000"; // ❌ Config is immutable
```

### Design Principles

1. **Config is static**: Values are "baked in" at app load - use Variables for runtime changes
2. **Type-aware editing**: Color picker for colors, array editor for arrays, etc.
3. **Required defaults**: Core metadata (name, description) always exists
4. **Expression + Node access**: Both `Noodl.Config.x` in expressions AND an App Config node
5. **Build-time injection**: SEO tags and PWA manifest generated during build/deploy

---

## Architecture

### Data Model

```typescript
interface AppConfig {
  // Required sections (non-deletable)
  identity: {
    appName: string;
    description: string;
    coverImage?: string;  // Path or URL
  };
  
  seo: {
    ogTitle?: string;      // Defaults to appName
    ogDescription?: string; // Defaults to description
    ogImage?: string;       // Defaults to coverImage
    favicon?: string;
    themeColor?: string;
  };
  
  // Optional section
  pwa?: {
    enabled: boolean;
    shortName?: string;
    startUrl: string;       // Default: "/"
    display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
    backgroundColor?: string;
    sourceIcon?: string;    // Single source, auto-scaled to required sizes
  };
  
  // User-defined variables
  variables: ConfigVariable[];
}

interface ConfigVariable {
  key: string;              // Valid JS identifier
  type: ConfigType;
  value: any;
  description?: string;     // Tooltip in UI
  category?: string;        // Grouping (defaults to "Custom")
  validation?: {
    required?: boolean;
    pattern?: string;       // Regex for strings
    min?: number;           // For numbers
    max?: number;
  };
}

type ConfigType = 'string' | 'number' | 'boolean' | 'color' | 'array' | 'object';
```

### Storage Location

Stored in `project.json` under metadata:

```json
{
  "metadata": {
    "appConfig": {
      "identity": {
        "appName": "My App",
        "description": "An amazing app"
      },
      "seo": {
        "themeColor": "#d21f3c"
      },
      "pwa": {
        "enabled": true,
        "display": "standalone"
      },
      "variables": [
        {
          "key": "primaryColor",
          "type": "color",
          "value": "#d21f3c",
          "category": "Theme"
        }
      ]
    }
  }
}
```

---

## UI Design

### App Setup Panel

New top-level sidebar tab (migrating some project settings here):

```
┌─────────────────────────────────────────────────┐
│ App Setup                                   [?] │
├─────────────────────────────────────────────────┤
│                                                 │
│ APP IDENTITY                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ App Name        [My Amazing App          ]  │ │
│ │ Description     [A visual programming...  ]  │ │
│ │                 [that makes building easy ]  │ │
│ │ Cover Image     [🖼️ cover.png    ][Browse] │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ SEO & METADATA                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ OG Title        [                        ]  │ │
│ │                 └ defaults to App Name       │ │
│ │ OG Description  [                        ]  │ │
│ │                 └ defaults to Description    │ │
│ │ OG Image        [🖼️            ][Browse]   │ │
│ │                 └ defaults to Cover Image    │ │
│ │ Favicon         [🖼️ favicon.ico ][Browse]  │ │
│ │ Theme Color     [■ #d21f3c              ]   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ▶ PWA CONFIGURATION                    [Enable] │
│ ┌─────────────────────────────────────────────┐ │
│ │ Short Name      [My App                  ]  │ │
│ │ Display Mode    [Standalone           ▼ ]   │ │
│ │ Start URL       [/                       ]  │ │
│ │ Background      [■ #ffffff              ]   │ │
│ │ App Icon        [🖼️ icon-512.png][Browse]  │ │
│ │                 └ 512x512 PNG, auto-scaled   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ CONFIGURATION VARIABLES            [+ Add New]  │
│ ┌─────────────────────────────────────────────┐ │
│ │ ┌─ Theme ─────────────────────────────────┐ │ │
│ │ │ primaryColor    color   [■ #d21f3c  ][⋮]│ │ │
│ │ │ secondaryColor  color   [■ #1f3cd2  ][⋮]│ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ │ ┌─ API ───────────────────────────────────┐ │ │
│ │ │ apiBaseUrl      string  [https://... ][⋮]│ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ │ ┌─ Custom ────────────────────────────────┐ │ │
│ │ │ maxUploadSize   number  [10          ][⋮]│ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### App Config Node

```
┌──────────────────────────────┐
│ App Config                   │
├──────────────────────────────┤
│ Variables                    │
│ ┌──────────────────────────┐ │
│ │ ☑ primaryColor           │ │
│ │ ☑ apiBaseUrl             │ │
│ │ ☐ secondaryColor         │ │
│ │ ☑ menuItems              │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│              ○ primaryColor  │──→
│              ○ apiBaseUrl    │──→
│              ○ menuItems     │──→
└──────────────────────────────┘
```

---

## Subtasks

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| [CONFIG-001](./CONFIG-001-infrastructure.md) | Core Infrastructure | 14-18h | None |
| [CONFIG-002](./CONFIG-002-app-setup-panel.md) | App Setup Panel UI | 18-24h | CONFIG-001 |
| [CONFIG-003](./CONFIG-003-app-config-node.md) | App Config Node | 10-14h | CONFIG-001 |
| [CONFIG-004](./CONFIG-004-seo-integration.md) | SEO Build Integration | 8-10h | CONFIG-001, CONFIG-002 |
| [CONFIG-005](./CONFIG-005-pwa-manifest.md) | PWA Manifest Generation | 10-14h | CONFIG-001, CONFIG-002 |
| [CONFIG-006](./CONFIG-006-expression-integration.md) | Expression System Integration | 4-6h | CONFIG-001, TASK-006 |

**Total: 64-86 hours**

---

## Cloud Service Node UX Improvement

**Prerequisite cleanup task** (can be done as part of CONFIG-003 or separately):

### Problem
The existing "Config" node accesses Noodl Cloud Service (Parse Server) configuration. This will cause confusion with the new App Config system.

### Solution

1. **Rename existing node**: `Config` → `Noodl Cloud Config`
2. **Hide cloud nodes when no backend**: If no cloud service is connected, hide ALL nodes in the "Cloud Data" category from the node picker
3. **Show guidance**: Display "Please add a backend service" message in that category until a service is connected
4. **Preserve existing nodes**: Don't break legacy projects - existing nodes continue to work, just hidden from picker

### Files to modify:
- `packages/noodl-runtime/src/nodes/std-library/data/confignode.js` - Rename
- `packages/noodl-editor/src/editor/src/views/nodepicker/` - Category visibility logic
- `packages/noodl-runtime/src/nodelibraryexport.js` - Update node name in exports

---

## Integration Points

### With DEPLOY-003 (Environment Profiles)

DEPLOY-003 can **override** Config values per environment:

```
App Setup Panel          DEPLOY-003 Profiles
─────────────────        ───────────────────
apiBaseUrl: "dev"   →    Production: "https://api.prod.com"
                         Staging: "https://api.staging.com"
                         Development: (uses default)
```

The App Setup panel shows canonical/default values. DEPLOY-003 shows environment-specific overrides.

### With TASK-006 (Expression System)

The enhanced expression system will provide:
- `Noodl.Config.xxx` access in expressions
- Autocomplete for config keys
- Type hints

### With Phase 5 (Capacitor Deployment)

PWA icon generation will be reused for Capacitor app icons:
- Same 512x512 source image
- Generate iOS/Android required sizes
- Include in platform-specific builds

---

## Component Export Behavior

When exporting a component that uses `Noodl.Config.primaryColor`:

| Variable Type | Export Behavior |
|---------------|-----------------|
| **Custom variables** | Hard-coded to current values |
| **Default variables** (appName, etc.) | Reference preserved |

The importer is responsible for updating hard-coded values if needed.

---

## Testing Checklist

### Manual Testing

- [ ] App Setup panel appears in sidebar
- [ ] Can edit all identity fields
- [ ] Can edit SEO fields (with defaults shown)
- [ ] Can enable/disable PWA section
- [ ] Can add custom variables with different types
- [ ] Color picker works for color type
- [ ] Array editor works for array type
- [ ] Categories group variables correctly
- [ ] App Config node shows all custom variables
- [ ] Selected variables appear as outputs
- [ ] Output types match variable types
- [ ] `Noodl.Config.xxx` accessible in expressions
- [ ] SEO tags appear in built HTML
- [ ] manifest.json generated with correct values
- [ ] PWA icons auto-scaled from source

### Build Testing

- [ ] Export includes correct meta tags
- [ ] manifest.json valid and complete
- [ ] Icons generated at all required sizes
- [ ] Theme color in HTML head
- [ ] Open Graph tags render correctly

---

## Success Criteria

1. **Discoverable**: New users find App Setup easily in sidebar
2. **Complete**: SEO and PWA work without manual file editing
3. **Type-safe**: Color variables show color pickers, arrays show array editors
4. **Non-breaking**: Existing projects work, cloud nodes still function
5. **Extensible**: DEPLOY-003 can override values per environment

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Namespace name? | `Noodl.Config` |
| Static or reactive? | Static (immutable at runtime) |
| Panel location? | New top-level sidebar tab |
| PWA icons? | Single 512x512 source, auto-scaled |
| Categories required? | Optional, ungrouped → "Custom" |
| Loaded signal on node? | No, overkill for static values |
| ENV node name? | "App Config" |

---

## References

- Existing project settings: `views/panels/ProjectSettingsPanel/`
- Port type editors: `views/panels/propertyeditor/DataTypes/Ports.ts`
- HTML build processor: `utils/compilation/build/processors/html-processor.ts`
- Expression system: `TASK-006-expressions-overhaul/`
- Deploy settings: `TASK-005-deployment-automation/DEPLOY-003-deploy-settings.md`
- Cloud config node: `noodl-runtime/src/nodes/std-library/data/confignode.js`
