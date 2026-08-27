import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitScaffold, routedPages } from '../src/emit/scaffold';
import { parseProject } from '../src/parse/parseProject';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);

describe('routedPages', () => {
  const pages = routedPages(ir);

  test('joins the router routes with each Page node urlPath', () => {
    const landing = pages.find((p) => p.componentPath === 'Pages/Landing');
    expect(landing).toBeDefined();
    expect(landing!.urlPath).toBe('/landing');
    expect(landing!.symbol).toBe('LandingPage');
    expect(landing!.isStart).toBe(true);

    const thankYou = pages.find((p) => p.componentPath === 'Pages/Thank You');
    expect(thankYou).toBeDefined();
    expect(thankYou!.urlPath).toBe('/thank-you');
    expect(thankYou!.fileBase).toBe('ThankYou');
  });

  test('covers every routed component that exists in the project', () => {
    // "#__page__" is the editor's home-page namespace; the leading slash strip keeps the "#".
    expect(pages.map((p) => p.componentPath)).toEqual([
      '#__page__/Home',
      'Pages/Landing',
      'Pages/Thank You',
      'Pages/Admin Login',
      'Pages/Admin'
    ]);
  });
});

describe('emitScaffold', () => {
  const files = emitScaffold(ir);

  test('emits the full scaffold file set', () => {
    const paths = Object.keys(files);
    for (const expected of [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'index.html',
      'src/main.tsx',
      'src/App.tsx',
      'src/styles/tokens.css',
      'src/styles/base.css',
      'src/pages/Landing.tsx',
      'src/pages/ThankYou.tsx',
      'src/pages/AdminLogin.tsx',
      'src/pages/Admin.tsx',
      'src/pages/Home.tsx'
    ]) {
      expect(paths).toContain(expected);
    }
  });

  test('the route table starts at the router startPage and maps urlPaths', () => {
    const app = files['src/App.tsx'];
    expect(app).toContain('<Route path="/" element={<LandingPage />} />');
    expect(app).toContain('<Route path="/thank-you" element={<ThankYouPage />} />');
    expect(app).toContain('<Route path="*" element={<Navigate to="/" replace />} />');
  });

  test('tokens.css carries every token with its description as a comment', () => {
    const tokens = files['src/styles/tokens.css'];
    expect(tokens).toContain('/* Main brand and action color */');
    expect(tokens).toContain('--primary: #18181b;');
    for (const token of ir.project.designTokens) {
      expect(tokens).toContain(`${token.name}: ${token.value};`);
    }
  });

  test('dependencies are computed from the output: no @nodegx/core until something imports it', () => {
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.name).toBe('puppy-test-3');
    expect(Object.keys(pkg.dependencies)).toEqual(['react', 'react-dom', 'react-router-dom']);
  });

  test('emission is deterministic: two runs are byte-identical (D6)', () => {
    const again = emitScaffold(ir);
    expect(again).toEqual(files);
    expect(JSON.stringify(again)).toBe(JSON.stringify(files));
  });
});
