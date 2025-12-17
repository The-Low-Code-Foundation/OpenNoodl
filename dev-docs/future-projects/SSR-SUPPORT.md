# Future: Server-Side Rendering (SSR) Support

> **Status**: Planning  
> **Priority**: Medium  
> **Complexity**: High  
> **Prerequisites**: React 19 migration, HTTP node implementation

## Executive Summary

OpenNoodl has substantial existing SSR infrastructure that was developed but never shipped by the original Noodl team. This document outlines a path to completing and exposing SSR as a user-facing feature, giving users the choice between client-side rendering (CSR), server-side rendering (SSR), and static site generation (SSG).

## Why SSR Matters

### The Problem with Pure CSR

Currently, Noodl apps are entirely client-side rendered:

1. **SEO Limitations**: Search engine crawlers see an empty `<div id="root"></div>` until JavaScript executes
2. **Social Sharing**: Link previews on Twitter, Facebook, Slack, etc. show blank or generic content
3. **First Paint Performance**: Users see a blank screen while the runtime loads and initializes
4. **Core Web Vitals**: Poor Largest Contentful Paint (LCP) scores affect search rankings

### What SSR Provides

| Metric | CSR | SSR | SSG |
|--------|-----|-----|-----|
| SEO | Poor | Excellent | Excellent |
| Social Previews | Broken | Working | Working |
| First Paint | Slow | Fast | Fastest |
| Hosting Requirements | Static | Node.js Server | Static |
| Dynamic Content | Real-time | Real-time | Build-time |
| Build Complexity | Low | Medium | Medium |

## Current State in Codebase

### What Already Exists

The original Noodl team built significant SSR infrastructure:

**SSR Server (`packages/noodl-viewer-react/static/ssr/`)**
- Express server with route handling
- `ReactDOMServer.renderToString()` integration
- Browser API polyfills (localStorage, fetch, XMLHttpRequest, requestAnimationFrame)
- Result caching via `node-cache`
- Graceful fallback to CSR on errors

**SEO API (`Noodl.SEO`)**
- `setTitle(value)` - Update document title
- `setMeta(key, value)` - Set meta tags
- `getMeta(key)` / `clearMeta()` - Manage meta tags
- Designed specifically for SSR (no direct window access)

**Deploy Infrastructure**
- `runtimeType` parameter supports `'ssr'` value
- Separate deploy index for SSR files (`ssr/index.json`)
- Commented-out UI code showing intended deployment flow

**Build Scripts**
- `getPages()` API returns all routes with metadata
- `createIndexPage()` generates HTML with custom meta tags
- `expandPaths()` for dynamic route expansion
- Sitemap generation support

### What's Incomplete

- SEO meta injection not implemented (`// TODO: Inject Noodl.SEO.meta`)
- Page router issues (`// TODO: Maybe fix page router`)
- No UI for selecting SSR deployment
- No documentation or user guidance
- Untested with modern component library
- No hydration verification

## Proposed User Experience

### Option 1: Project-Level Setting

Add rendering mode selection in Project Settings:

```
Rendering Mode:
  ○ Client-Side (CSR) - Default, works with any static host
  ○ Server-Side (SSR) - Better SEO, requires Node.js hosting  
  ○ Static Generation (SSG) - Best performance, pre-renders at build time
```

**Pros**: Simple mental model, single source of truth  
**Cons**: All-or-nothing, can't mix approaches

### Option 2: Deploy-Time Selection

Add rendering mode choice in Deploy popup:

```
Deploy Target:
  [Static Files (CSR)]  [Node.js Server (SSR)]  [Pre-rendered (SSG)]
```

**Pros**: Flexible, same project can deploy differently  
**Cons**: Could be confusing, settings disconnect

### Option 3: Page-Level Configuration (Recommended)

Add per-page rendering configuration in Page Router settings:

```
Page: /blog/{slug}
  Rendering: [SSR ▼]
  
Page: /dashboard  
  Rendering: [CSR ▼]
  
Page: /about
  Rendering: [SSG ▼]
```

**Pros**: Maximum flexibility, matches real-world needs  
**Cons**: More complex, requires smarter build system

### Recommended Approach

**Phase 1**: Start with Option 2 (Deploy-Time Selection) - simplest to implement  
**Phase 2**: Add Option 1 (Project Setting) for default behavior  
**Phase 3**: Consider Option 3 (Page-Level) based on user demand

## Technical Implementation

### Phase 1: Complete Existing SSR Infrastructure

**1.1 Fix Page Router for SSR**
- Ensure `globalThis.location` properly simulates browser location
- Handle query parameters and hash fragments
- Support Page Router navigation events

**1.2 Implement SEO Meta Injection**
```javascript
// In ssr/index.js buildPage()
const result = htmlData
  .replace('<div id="root"></div>', `<div id="root">${output1}</div>`)
  .replace('</head>', `${generateMetaTags(noodlRuntime.SEO.meta)}</head>`);
```

**1.3 Polyfill Audit**
- Test all visual nodes in SSR context
- Identify browser-only APIs that need polyfills
- Create SSR compatibility matrix for nodes

### Phase 2: Deploy UI Integration

**2.1 Add SSR Option to Deploy Popup**
```typescript
// DeployToFolderTab.tsx
<Select
  options={[
    { value: 'csr', label: 'Client-Side Rendering (Static)' },
    { value: 'ssr', label: 'Server-Side Rendering (Node.js)' },
    { value: 'ssg', label: 'Static Site Generation' }
  ]}
  value={renderingMode}
  onChange={setRenderingMode}
  label="Rendering Mode"
/>
```

**2.2 SSR Deploy Flow**
```typescript
if (renderingMode === 'ssr') {
  // Deploy SSR server files to root
  await compilation.deployToFolder(direntry, {
    environment,
    runtimeType: 'ssr'
  });
  // Deploy static assets to /public
  await compilation.deployToFolder(direntry + '/public', {
    environment,
    runtimeType: 'deploy'
  });
}
```

**2.3 SSG Build Flow**
```typescript
if (renderingMode === 'ssg') {
  // Deploy static files
  await compilation.deployToFolder(direntry, { environment });
  
  // Pre-render each page
  const pages = await context.getPages({ expandPaths: ... });
  for (const page of pages) {
    const html = await prerenderPage(page.path);
    await writeFile(`${direntry}${page.path}/index.html`, html);
  }
}
```

### Phase 3: Enhanced SEO Tools

**3.1 SEO Node**
Create a visual node for setting page metadata:

```
┌─────────────────────────────┐
│ SEO Settings                │
├─────────────────────────────┤
│ ► Title          [string]   │
│ ► Description    [string]   │
│ ► Image URL      [string]   │
│ ► Keywords       [string]   │
│ ► Canonical URL  [string]   │
│ ► Robots         [string]   │
└─────────────────────────────┘
```

**3.2 Open Graph Support**
Extend `Noodl.SEO` API:
```javascript
Noodl.SEO.setOpenGraph({
  title: 'My Page',
  description: 'Page description',
  image: 'https://example.com/image.jpg',
  type: 'website'
});

Noodl.SEO.setTwitterCard({
  card: 'summary_large_image',
  site: '@mysite'
});
```

**3.3 Structured Data**
```javascript
Noodl.SEO.setStructuredData({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "My Article",
  "author": { "@type": "Person", "name": "Author" }
});
```

### Phase 4: Hosting Integration

**4.1 One-Click Deploy Targets**
- Vercel (native SSR support)
- Netlify (serverless functions for SSR)
- Railway / Render (Node.js hosting)
- Docker container export

**4.2 Deploy Configuration Generation**
```javascript
// Generate vercel.json
{
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/public/(.*)", "dest": "/public/$1" },
    { "src": "/(.*)", "dest": "/server.js" }
  ]
}
```

## Component SSR Compatibility

### Compatibility Levels

**Level A: Full SSR Support**
- Text, Group, Columns, Image (static src)
- All layout nodes
- Style properties

**Level B: Hydration Required**
- Video, Animation
- Interactive components
- Event handlers

**Level C: Client-Only**
- Camera, Geolocation
- Local Storage operations
- WebSocket connections

### Handling Incompatible Components

```javascript
// In component definition
{
  ssr: {
    supported: false,
    fallback: '<div class="placeholder">Loading video...</div>'
  }
}
```

## Testing Strategy

### SSR Test Suite
1. **Render Tests**: Each node type renders correct HTML
2. **Hydration Tests**: Client picks up server state correctly
3. **SEO Tests**: Meta tags present in rendered output
4. **Error Tests**: Graceful fallback on component errors
5. **Performance Tests**: SSR response times under load

### Validation Checklist
- [ ] All visual nodes render without errors
- [ ] Page Router navigates correctly
- [ ] SEO meta tags injected properly
- [ ] Hydration completes without mismatch warnings
- [ ] Fallback to CSR works when SSR fails
- [ ] Build scripts continue to work
- [ ] Cloud functions unaffected

## Open Questions

1. **React 19 First?** Should we complete React 19 migration before SSR work? The SSR code uses React 17's `renderToString` - React 19 has different streaming APIs.

2. **Streaming SSR?** React 18+ supports streaming SSR with Suspense. Should we support this for better TTFB?

3. **Edge Runtime?** Should we support edge deployment (Cloudflare Workers, Vercel Edge) for lower latency?

4. **Partial Hydration?** Should we implement islands architecture for selective hydration?

5. **Preview in Editor?** Can we show SSR output in the editor for SEO debugging?

## Success Metrics

- **Adoption**: % of deploys using SSR/SSG modes
- **SEO Improvement**: User-reported search ranking changes
- **Performance**: Core Web Vitals improvements (LCP, FID, CLS)
- **Developer Experience**: Time to deploy with SSR enabled

## Related Work

- [React 19 Migration](./FUTURE-react-19-migration.md)
- [HTTP Node Implementation](./TASK-http-node.md)
- [Deploy Automation](./FUTURE-deploy-automation.md)

## References

- Original SSR code: `packages/noodl-viewer-react/static/ssr/`
- SEO API docs: `javascript/reference/seo/README.md`
- Build scripts: `javascript/extending/build-script/`
- Deploy infrastructure: `packages/noodl-editor/src/editor/src/utils/compilation/`
