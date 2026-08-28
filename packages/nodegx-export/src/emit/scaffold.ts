/**
 * Scaffolding generator — EXP-002 implementation step 3: "a project that builds with an empty
 * component proves the pipeline end to end."
 *
 * Emits everything around the components: package.json, Vite/TS config, entry point, the route
 * table derived from the project's Router node(s) + each page's `Page` node urlPath, the design
 * tokens as tokens.css, and a placeholder page per routed component so the output builds before
 * the visual generator exists. Placeholders are explicitly marked and are replaced file-for-file
 * as later generators land.
 *
 * Pure: ExportIR in, sorted { path → content } out. No filesystem access here — writing (and
 * EXP-007's provenance headers/hashes, which need the final bytes) happens in a separate step.
 */

import { ComponentIR, ExportIR } from '../ir/types';

/** Deliberately minimal provenance line until EXP-007 lands the full marker set. */
const GENERATED_TS = '// @nodegx:generated (scaffold — placeholder markers complete in EXP-007)\n';
const GENERATED_CSS = '/* @nodegx:generated (scaffold) */\n';

export interface ScaffoldPage {
  /** Component path form: "Pages/Landing". */
  componentPath: string;
  /** "ThankYou" — PascalCased last path segment, deduplicated. */
  fileBase: string;
  /** "ThankYouPage". */
  symbol: string;
  /** "/thank-you" — from the component's Page node urlPath parameter. */
  urlPath: string;
  isStart: boolean;
}

export function emitScaffold(ir: ExportIR): Record<string, string> {
  const pages = routedPages(ir);
  const files: Record<string, string> = {};

  files['package.json'] = packageJson(ir);
  files['vite.config.ts'] = viteConfig();
  files['tsconfig.json'] = tsConfig();
  files['index.html'] = indexHtml(ir);
  files['src/main.tsx'] = mainTsx();
  files['src/App.tsx'] = appTsx(pages);
  files['src/styles/tokens.css'] = tokensCss(ir);
  files['src/styles/base.css'] = baseCss();
  for (const page of pages) {
    files[`src/pages/${page.fileBase}.tsx`] = placeholderPage(page);
  }

  // Deterministic file order (D-rules): callers may iterate Object.entries directly.
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * The route table: the first Router node's `routes` in source order, joined with each target
 * component's `Page` node `urlPath`. Components a router lists but the project lacks are
 * skipped here — analysis reports them (nothing in emit is allowed to throw on content).
 */
export function routedPages(ir: ExportIR): ScaffoldPage[] {
  const router = ir.project.routers[0];
  if (!router) return [];

  const byLegacyPath = new Map<string, ComponentIR>();
  for (const component of ir.components) byLegacyPath.set(`/${component.path}`, component);

  const usedNames = new Set<string>();
  const pages: ScaffoldPage[] = [];
  for (const legacyPath of router.routes) {
    const component = byLegacyPath.get(legacyPath);
    if (!component) continue;
    const fileBase = dedupe(pascalCase(lastSegment(component.path)), usedNames);
    pages.push({
      componentPath: component.path,
      fileBase,
      symbol: `${fileBase}Page`,
      urlPath: `/${pageUrlPath(component)}`,
      isStart: legacyPath === router.startPage
    });
  }
  return pages;
}

function pageUrlPath(component: ComponentIR): string {
  const pageNode = component.nodes.find((n) => n.type === 'Page');
  const urlPath = pageNode?.parameters.find((p) => p.name === 'urlPath')?.value;
  if (urlPath?.kind === 'literal' && typeof urlPath.value === 'string' && urlPath.value.length > 0) {
    return urlPath.value;
  }
  return slug(lastSegment(component.path));
}

function packageJson(ir: ExportIR): string {
  // Dependencies are computed from the output, not declared up front (TARGET-OUTPUT §3):
  // the scaffold itself needs only React and the router. @nodegx/core joins this list the
  // moment a generated file imports it, and not before.
  return (
    JSON.stringify(
      {
        name: slug(ir.project.name),
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          preview: 'vite preview'
        },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'react-router-dom': '^7.1.0'
        },
        devDependencies: {
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          '@vitejs/plugin-react': '^4.3.4',
          typescript: '~5.7.2',
          vite: '^6.0.0'
        }
      },
      null,
      2
    ) + '\n'
  );
}

function viteConfig(): string {
  return (
    GENERATED_TS +
    `import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()]
});
`
  );
}

function tsConfig(): string {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          isolatedModules: true,
          types: ['vite/client']
        },
        include: ['src']
      },
      null,
      2
    ) + '\n'
  );
}

function indexHtml(ir: ExportIR): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(ir.project.name)}</title>
${moduleStylesheetLinks(ir)}  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

/**
 * The `<link>` tags a project's `noodl_modules` stylesheets earn (EXP-010 AC5).
 *
 * 🔴 **Plain `<link>` against `public/`, not a bundler import**, and the reason is the icon font.
 * `lucide-icons/styles.css` carries `url(lucide.woff2)` relative to itself; an `import` would put
 * the stylesheet through Vite's asset pipeline, and while that *does* rewrite the URL it also
 * moves both files, which is exactly the "ships verbatim" contract `iconsets.ts` documents for a
 * deploy. Copying the folder untouched and linking it means the export and the deploy serve the
 * same bytes at the same paths, so an icon that renders in the preview renders here.
 *
 * A `http(s)` stylesheet (an ERG-002 library's CDN skin) is linked at its own URL — the export
 * cannot bundle it and inventing a local path would 404.
 */
function moduleStylesheetLinks(ir: ExportIR): string {
  const hrefs: string[] = [];
  for (const module of ir.project.modules) {
    // A module declaring only `cloud` contributes nothing to a browser page — the same
    // `runtimes` filter `buildInjectionTags` applies, so the export and the preview agree.
    if (!module.runtimes.includes('browser')) continue;
    for (const sheet of module.stylesheets) {
      hrefs.push(/^https?:\/\//.test(sheet) ? sheet : `/${sheet}`);
    }
  }
  if (hrefs.length === 0) return '';
  return hrefs.map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />\n`).join('');
}

function mainTsx(): string {
  return (
    GENERATED_TS +
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
  );
}

function appTsx(pages: ScaffoldPage[]): string {
  const imports = pages
    .map((p) => `import { ${p.symbol} } from './pages/${p.fileBase}';`)
    .sort()
    .join('\n');
  const start = pages.find((p) => p.isStart) ?? pages[0];
  const routes = [
    ...(start ? [`        <Route path="/" element={<${start.symbol} />} />`] : []),
    ...pages.map((p) => `        <Route path="${p.urlPath}" element={<${p.symbol} />} />`),
    ...(start ? [`        <Route path="*" element={<Navigate to="/" replace />} />`] : [])
  ].join('\n');

  return (
    GENERATED_TS +
    `import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

${imports}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
${routes}
      </Routes>
    </BrowserRouter>
  );
}
`
  );
}

function placeholderPage(page: ScaffoldPage): string {
  return (
    GENERATED_TS +
    `/**
 * TODO(export): placeholder for the "${page.componentPath}" component — replaced when the
 * visual-node generator (EXP-002 step 4) lands.
 */
export function ${page.symbol}() {
  return <div>${escapeHtml(page.componentPath)}</div>;
}
`
  );
}

function tokensCss(ir: ExportIR): string {
  const lines = ir.project.designTokens.flatMap((token) => [
    ...(token.description ? [`  /* ${token.description} */`] : []),
    `  ${token.name}: ${token.value};`
  ]);
  return GENERATED_CSS + ':root {\n' + lines.join('\n') + '\n}\n';
}

function baseCss(): string {
  // Deliberately minimal (TARGET-OUTPUT §3): box-sizing and the body font. Element resets are
  // per-class in the generated CSS modules, not global surprises.
  return (
    GENERATED_CSS +
    `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
`
  );
}

function lastSegment(componentPath: string): string {
  const segments = componentPath.split('/');
  return segments[segments.length - 1];
}

function pascalCase(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const joined = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return /^[0-9]/.test(joined) ? `Page${joined}` : joined || 'Component';
}

/** D5: collisions resolve first-wins with numeric suffixes, in iteration order. */
function dedupe(base: string, used: Set<string>): string {
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) candidate = `${base}${counter++}`;
  used.add(candidate);
  return candidate;
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'nodegx-export'
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
