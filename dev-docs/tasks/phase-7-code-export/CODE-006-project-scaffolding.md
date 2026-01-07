# CODE-006: Project Scaffolding Generator

## Overview

The Project Scaffolding Generator creates the complete React project structure from a Noodl project, including routing, entry point, build configuration, and package dependencies. This pulls together all the generated code into a runnable application.

**Estimated Effort:** 1-2 weeks  
**Priority:** HIGH  
**Dependencies:** CODE-001 through CODE-005  
**Blocks:** CODE-007 (CLI & Integration)

---

## Output Project Structure

```
my-app/
├── src/
│   ├── components/           # Generated React components
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Header.module.css
│   │   │   ├── Footer.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── Pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── ProductsPage.tsx
│   │   │   └── ContactPage.tsx
│   │   └── UI/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Modal.tsx
│   │
│   ├── stores/               # State management
│   │   ├── variables.ts
│   │   ├── objects.ts
│   │   ├── arrays.ts
│   │   ├── staticArrays.ts
│   │   └── index.ts
│   │
│   ├── logic/                # Function node code
│   │   ├── auth.ts
│   │   ├── api.ts
│   │   ├── validation.ts
│   │   └── index.ts
│   │
│   ├── events/               # Event channels
│   │   ├── types.ts
│   │   ├── channels.ts
│   │   ├── hooks.ts
│   │   └── index.ts
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── index.ts
│   │
│   ├── styles/               # Global styles
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── reset.css
│   │
│   ├── assets/               # Copied from Noodl project
│   │   ├── images/
│   │   ├── fonts/
│   │   └── icons/
│   │
│   ├── App.tsx               # Root component with routing
│   ├── main.tsx              # Entry point
│   └── vite-env.d.ts         # Vite types
│
├── public/
│   ├── favicon.ico
│   └── robots.txt
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── README.md
```

---

## Routing Generation

### Page Router Analysis

**Noodl Page Router Node:**
```json
{
  "type": "Page Router",
  "parameters": {
    "pages": [
      { "name": "Home", "path": "/", "component": "HomePage" },
      { "name": "Products", "path": "/products", "component": "ProductsPage" },
      { "name": "Product Detail", "path": "/products/:id", "component": "ProductDetailPage" },
      { "name": "Contact", "path": "/contact", "component": "ContactPage" }
    ],
    "notFoundPage": "NotFoundPage"
  }
}
```

### Generated Router

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { HomePage } from './components/Pages/HomePage';
import { ProductsPage } from './components/Pages/ProductsPage';
import { ProductDetailPage } from './components/Pages/ProductDetailPage';
import { ContactPage } from './components/Pages/ContactPage';
import { NotFoundPage } from './components/Pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

### Navigate Node Handling

**Noodl Navigate Node:**
```json
{
  "type": "Navigate",
  "parameters": {
    "target": "/products",
    "openInNewTab": false
  }
}
```

**Generated Code:**
```tsx
import { useNavigate } from 'react-router-dom';

function NavigateButton() {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate('/products')}>
      View Products
    </button>
  );
}
```

### Dynamic Routes with Parameters

**Noodl:**
```
[Navigate]
├─ target: "/products/{productId}"
└─ productId ← selectedProduct.id
```

**Generated:**
```tsx
const navigate = useNavigate();
const productId = selectedProduct.id;

<button onClick={() => navigate(`/products/${productId}`)}>
  View Details
</button>
```

### Route Parameters in Page Components

**Noodl Page Inputs:**
```json
{
  "type": "Page Inputs",
  "dynamicports": [
    { "name": "id", "type": "string" }
  ]
}
```

**Generated:**
```tsx
import { useParams } from 'react-router-dom';

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  // Use id to fetch product data
  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);
  
  return (/* ... */);
}
```

---

## Entry Point Generation

### main.tsx

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Global styles
import './styles/reset.css';
import './styles/variables.css';
import './styles/globals.css';

// Initialize stores (if needed for SSR-compatible hydration)
import './stores';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    
    <!-- From Noodl project settings -->
    <title>My App</title>
    <meta name="description" content="Built with Nodegx" />
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Build Configuration

### package.json

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nodegx/core": "^0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.56.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "prettier": "^3.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@logic': path.resolve(__dirname, './src/logic'),
      '@events': path.resolve(__dirname, './src/events'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          nodegx: ['@nodegx/core'],
        },
      },
    },
  },
  
  server: {
    port: 3000,
    open: true,
  },
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@stores/*": ["./src/stores/*"],
      "@logic/*": ["./src/logic/*"],
      "@events/*": ["./src/events/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@assets/*": ["./src/assets/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### tsconfig.node.json

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

---

## Global Styles Generation

### reset.css

```css
/* src/styles/reset.css */
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}

#root {
  isolation: isolate;
  min-height: 100vh;
}
```

### variables.css (from Noodl Project Settings)

```css
/* src/styles/variables.css */

:root {
  /* Colors - extracted from Noodl project */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-secondary: #64748b;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  
  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  
  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Dark mode (if enabled in Noodl project) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0f172a;
    --color-surface: #1e293b;
    --color-text: #f1f5f9;
    --color-text-muted: #94a3b8;
    --color-border: #334155;
  }
}
```

### globals.css

```css
/* src/styles/globals.css */

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: var(--color-background);
}

/* Focus styles */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Button base styles */
button {
  cursor: pointer;
  border: none;
  background: none;
}

/* Link base styles */
a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Scrollbar styling (optional) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-surface);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
```

---

## Asset Copying

### Asset Types

| Noodl Location | Output Location | Handling |
|----------------|-----------------|----------|
| `/assets/images/` | `/src/assets/images/` | Direct copy |
| `/assets/fonts/` | `/src/assets/fonts/` | Copy + @font-face |
| `/assets/icons/` | `/src/assets/icons/` | Copy or SVG component |
| `/noodl_modules/` | N/A | Dependencies → npm |

### Image References

Update image paths in generated components:

```tsx
// Before (Noodl)
<Image src="/assets/images/hero.jpg" />

// After (Generated)
<img src="/src/assets/images/hero.jpg" alt="" />

// Or with import (better for bundling)
import heroImage from '@assets/images/hero.jpg';
<img src={heroImage} alt="" />
```

### Font Loading

```css
/* src/assets/fonts/fonts.css */
@font-face {
  font-family: 'CustomFont';
  src: url('./CustomFont-Regular.woff2') format('woff2'),
       url('./CustomFont-Regular.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'CustomFont';
  src: url('./CustomFont-Bold.woff2') format('woff2'),
       url('./CustomFont-Bold.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

---

## README Generation

```markdown
<!-- README.md -->
# My App

This application was exported from Nodegx.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

\`\`\`bash
npm run build
\`\`\`

The build output will be in the \`dist\` folder.

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Project Structure

\`\`\`
src/
├── components/     # React components
├── stores/         # State management (@nodegx/core)
├── logic/          # Business logic functions
├── events/         # Event channels
├── hooks/          # Custom React hooks
├── styles/         # Global styles
└── assets/         # Images, fonts, icons
\`\`\`

## Technologies

- React 19
- TypeScript
- Vite
- React Router
- @nodegx/core (reactive primitives)

## Notes

This code was automatically generated. Some manual adjustments may be needed for:

- API integrations (see \`// TODO\` comments in \`logic/\`)
- Authentication setup
- Environment variables

## License

[Your License]
```

---

## Export Report

After export, generate a summary report:

```typescript
interface ExportReport {
  success: boolean;
  outputDir: string;
  stats: {
    components: number;
    pages: number;
    stores: {
      variables: number;
      objects: number;
      arrays: number;
    };
    events: number;
    functions: number;
  };
  warnings: ExportWarning[];
  todos: ExportTodo[];
  nextSteps: string[];
}

interface ExportWarning {
  type: 'unsupported-node' | 'complex-logic' | 'external-dependency';
  message: string;
  location?: string;
}

interface ExportTodo {
  file: string;
  line: number;
  description: string;
}
```

```
┌──────────────────────────────────────────────────────────────┐
│                     Export Complete ✅                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Output: ./my-app-export/                                    │
│                                                              │
│  Statistics:                                                 │
│  ──────────────────────────────────────                      │
│  Components:        23                                       │
│  Pages:             5                                        │
│  Variables:         12                                       │
│  Objects:           4                                        │
│  Arrays:            3                                        │
│  Event Channels:    8                                        │
│  Logic Functions:   15                                       │
│                                                              │
│  ⚠️  Warnings (2):                                           │
│  ──────────────────────────────────────                      │
│  • Cloud Function node not supported - see logic/api.ts     │
│  • Query Records node not supported - see logic/db.ts       │
│                                                              │
│  Next Steps:                                                 │
│  ──────────────────────────────────────                      │
│  1. cd my-app-export && npm install                          │
│  2. Review TODO comments (3 found)                           │
│  3. Set up environment variables                             │
│  4. npm run dev                                              │
│                                                              │
│  📖 See README.md for full documentation                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

### Project Structure

- [ ] All folders created correctly
- [ ] Files in correct locations
- [ ] Imports resolve correctly
- [ ] No circular dependencies

### Build

- [ ] `npm install` succeeds
- [ ] `npm run dev` starts dev server
- [ ] `npm run build` produces bundle
- [ ] `npm run preview` serves production build
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

### Routing

- [ ] All routes accessible
- [ ] Route parameters work
- [ ] Navigation works
- [ ] 404 page shows for unknown routes
- [ ] Browser back/forward works

### Assets

- [ ] Images load correctly
- [ ] Fonts load correctly
- [ ] Icons display correctly

---

## Success Criteria

1. **Runnable** - `npm install && npm run dev` works first try
2. **Complete** - All components, stores, events present
3. **Clean** - No TypeScript or ESLint errors
4. **Documented** - README explains setup and structure
5. **Modern** - Uses current best practices (Vite, ESM, etc.)
