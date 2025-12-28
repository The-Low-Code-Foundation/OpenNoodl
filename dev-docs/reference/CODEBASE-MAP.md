# OpenNoodl Codebase Quick Navigation

## 🗺️ Package Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MONOREPO ROOT                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  package.json          → Workspace config, global scripts               │
│  lerna.json            → Monorepo management                            │
│  scripts/              → Build and CI scripts                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│ ⚡ EDITOR (GPL)   │    │   RUNTIME (MIT)   │    │   UI LIBRARY      │
│   noodl-editor    │    │   noodl-runtime   │    │   noodl-core-ui   │
│                   │    │                   │    │                   │
│ • Electron app    │    │ • Node engine     │    │ • React components│
│   (DESKTOP ONLY)  │    │ • Data flow       │    │ • Storybook (web) │
│ • React UI        │    │ • Event system    │    │ • Styling         │
│ • Property panels │    │                   │    │                   │
└───────────────────┘    └───────────────────┘    └───────────────────┘
        │                           │
        │                           ▼
        │               ┌───────────────────┐
        │               │  🌐 VIEWER (MIT)  │
        │               │ noodl-viewer-react│
        │               │                   │
        │               │ • React runtime   │
        │               │ • Visual nodes    │
        │               │ • DOM handling    │
        │               │   (WEB - Runs in  │
        │               │    browser)       │
        │               └───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                  ⚡ PLATFORM LAYER (Electron)                          │
├───────────────────┬───────────────────┬───────────────────────────────┤
│  noodl-platform   │ platform-electron │    platform-node              │
│  (abstraction)    │  (desktop impl)   │    (server impl)              │
└───────────────────┴───────────────────┴───────────────────────────────┘

⚡ = Electron Desktop Application (NOT accessible via browser)
🌐 = Web Application (runs in browser)
```

## 🖥️ Architecture: Desktop vs Web

**Critical Distinction for Development:**

| Component        | Runtime          | Access Method                         | Purpose                       |
| ---------------- | ---------------- | ------------------------------------- | ----------------------------- |
| **Editor** ⚡    | Electron Desktop | `npm run dev` → auto-launches window  | Development environment       |
| **Viewer** 🌐    | Web Browser      | Deployed URL or preview inside editor | User-facing applications      |
| **Runtime**      | Node.js/Browser  | Embedded in viewer                    | Application logic engine      |
| **Storybook** 🌐 | Web Browser      | `npm run start:storybook` → browser   | Component library development |

**Important for Testing:**

- When working on the **editor**, you're always in Electron
- Never try to open `http://localhost:8080` in a browser - that's the webpack dev server internal to Electron
- The editor automatically launches as an Electron window when you run `npm run dev`
- Use Electron DevTools (View → Toggle Developer Tools) for debugging the editor
- Console logs from the editor appear in Electron DevTools, NOT in the terminal

---

## 📁 Key Directories

### noodl-editor (Main Application)

```
packages/noodl-editor/src/
├── editor/src/
│   ├── models/              # 🎯 Business logic & data
│   │   ├── projectmodel.ts      → Project state
│   │   ├── nodegraphmodel.ts    → Graph structure
│   │   ├── componentmodel.ts    → Components
│   │   ├── nodelibrary/         → Node type registry
│   │   ├── AiAssistant/         → AI features
│   │   └── sidebar/             → Sidebar state
│   │
│   ├── views/               # 🖥️ UI components
│   │   ├── nodegrapheditor.ts   → Canvas/graph editor
│   │   ├── panels/              → Property panels
│   │   ├── NodePicker/          → Node creation UI
│   │   ├── documents/           → Document views
│   │   └── popups/              → Modal dialogs
│   │
│   ├── utils/               # 🔧 Utilities
│   │   ├── CodeEditor/          → Monaco integration
│   │   ├── filesystem.ts        → File operations
│   │   └── projectimporter.js   → Import/export
│   │
│   ├── store/               # 💾 Persistent state
│   │   └── AiAssistantStore.ts  → AI settings
│   │
│   └── pages/               # 📄 Page components
│       └── EditorPage/          → Main editor page
│
├── main/                    # ⚡ Electron main process
│   └── main.js                  → App entry point
│
└── shared/                  # 🔗 Shared utilities
    └── utils/
        └── EventDispatcher.ts   → Pub/sub system
```

### noodl-runtime (Execution Engine)

```
packages/noodl-runtime/
├── src/
│   ├── nodes/               # 📦 Node implementations
│   │   └── std-library/
│   │       ├── data/            → Data nodes (REST, DB, etc.)
│   │       ├── logic/           → Logic nodes
│   │       └── events/          → Event nodes
│   │
│   ├── node.js              # Base node class
│   ├── nodedefinition.js    # Node definition API
│   ├── noderegister.js      # Node registry
│   ├── nodescope.js         # Component scope
│   └── nodecontext.js       # Runtime context
│
└── noodl-runtime.js         # Main runtime entry
```

### noodl-viewer-react (React Runtime)

```
packages/noodl-viewer-react/src/
├── nodes/                   # 🎨 Visual nodes
│   ├── basic/                   → Group, Text, Image
│   ├── controls/                → Button, Input, Checkbox
│   ├── navigation/              → PageRouter, Page
│   └── std-library/             → Standard library nodes
│
└── react-component-node.js  # React node wrapper
```

### noodl-core-ui (Component Library)

```
packages/noodl-core-ui/src/
├── components/
│   ├── common/              # 🧩 Basic components
│   │   ├── Icon/
│   │   └── ActivityIndicator/
│   │
│   ├── inputs/              # 📝 Form controls
│   │   ├── TextInput/
│   │   ├── PrimaryButton/
│   │   └── Checkbox/
│   │
│   ├── layout/              # 📐 Layout components
│   │   ├── Box/
│   │   ├── Container/
│   │   └── Tabs/
│   │
│   ├── popups/              # 💬 Dialogs & menus
│   │   ├── MenuDialog/
│   │   └── PopupToolbar/
│   │
│   └── ai/                  # 🤖 AI UI components
│       ├── AiChatBox/
│       └── AiChatMessage/
│
└── styles/                  # 🎨 Global styles
```

---

## 🔍 Finding Things

### Search Patterns

```bash
# Find a file by name
find packages/ -name "*NodeGraph*" -type f

# Find where a function is defined
grep -rn "function processNode" packages/

# Find where something is imported/used
grep -r "import.*from.*nodegraphmodel" packages/

# Find all usages of a component
grep -r "<NodeEditor" packages/ --include="*.tsx"

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME" packages/noodl-editor/src
```

### Common Search Targets

| Looking for...     | Search pattern                                       |
| ------------------ | ---------------------------------------------------- |
| Node definitions   | `packages/noodl-runtime/src/nodes/`                  |
| React visual nodes | `packages/noodl-viewer-react/src/nodes/`             |
| UI components      | `packages/noodl-core-ui/src/components/`             |
| Models/state       | `packages/noodl-editor/src/editor/src/models/`       |
| Property panels    | `packages/noodl-editor/src/editor/src/views/panels/` |
| Tests              | `packages/noodl-editor/tests/`                       |

---

## 🚀 Quick Commands

### Development

```bash
# Start everything
npm run dev

# Start just the editor (faster)
npm run start:editor

# Start Storybook (UI components)
npm run start:storybook

# Start viewer dev server
npm run start:viewer
```

### Building

```bash
# Build editor
npm run build:editor

# Create distributable package
npm run build:editor:pack

# Build cloud runtime
npm run build:cloud-runtime
```

### Testing

```bash
# Run all editor tests
npm run test:editor

# Run platform tests
npm run test:platform
```

### Code Quality

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint packages/noodl-editor/src

# Format
npx prettier --write "packages/**/*.{ts,tsx}"
```

---

## 🔗 Key Files Reference

### Configuration

| File            | Purpose               |
| --------------- | --------------------- |
| `package.json`  | Root workspace config |
| `lerna.json`    | Monorepo settings     |
| `tsconfig.json` | TypeScript config     |
| `.eslintrc.js`  | Linting rules         |
| `.prettierrc`   | Code formatting       |

### Entry Points

| File                                   | Purpose               |
| -------------------------------------- | --------------------- |
| `noodl-editor/src/main/main.js`        | Electron main process |
| `noodl-editor/src/editor/src/index.js` | Renderer entry        |
| `noodl-runtime/noodl-runtime.js`       | Runtime engine        |
| `noodl-viewer-react/index.js`          | React runtime         |

### Core Models

| File                | Purpose                  |
| ------------------- | ------------------------ |
| `projectmodel.ts`   | Project state management |
| `nodegraphmodel.ts` | Graph data structure     |
| `componentmodel.ts` | Component definitions    |
| `nodelibrary.ts`    | Node type registry       |

### Important Views

| File                 | Purpose             |
| -------------------- | ------------------- |
| `nodegrapheditor.ts` | Main canvas editor  |
| `EditorPage.tsx`     | Main page layout    |
| `NodePicker.tsx`     | Node creation panel |
| `PropertyEditor/`    | Property panels     |

---

## 🏷️ Type System

### Key Types (global.d.ts)

```typescript
// TSFixme - Type escape hatch (TO BE REMOVED)
type TSFixme = any;

// Node colors
type NodeColor = 'data' | 'visual' | 'logic' | 'component' | 'javascript';

// CSS modules
declare module '*.scss' {
  const styles: { readonly [key: string]: string };
  export default styles;
}
```

### Common Interfaces

```typescript
// Node graph structures (nodegraphmodel.ts)
interface NodeGraphNode {
  id: string;
  type: string;
  x: number;
  y: number;
  parameters: Record<string, any>;
}

interface Connection {
  fromId: string;
  fromPort: string;
  toId: string;
  toPort: string;
}

// Component structure (componentmodel.ts)
interface ComponentModel {
  name: string;
  graph: NodeGraphModel;
  metadata: Record<string, any>;
}
```

---

## 📝 Path Aliases

```typescript
// Configured in tsconfig.json
@noodl-models/       → packages/noodl-editor/src/editor/src/models/
@noodl-utils/        → packages/noodl-editor/src/editor/src/utils/
@noodl-contexts/     → packages/noodl-editor/src/editor/src/contexts/
@noodl-hooks/        → packages/noodl-editor/src/editor/src/hooks/
@noodl-constants/    → packages/noodl-editor/src/editor/src/constants/
@noodl-core-ui/      → packages/noodl-core-ui/src/
@noodl/platform      → packages/noodl-platform/src/
```

---

## 🚨 Common Issues

### Build Problems

```bash
# Clear caches
rm -rf node_modules/.cache
rm -rf packages/*/node_modules/.cache

# Reinstall dependencies
rm -rf node_modules
npm install
```

### TypeScript Errors

```bash
# Check for circular dependencies
npx madge --circular packages/noodl-editor/src
```

### Electron Issues

```bash
# Clear app data (macOS)
rm -rf ~/Library/Application\ Support/OpenNoodl/

# Rebuild native modules
npm run rebuild
```

---

_Quick reference card for OpenNoodl development. Print or pin to your IDE!_
