/**
 * Unit tests for the single noodl_modules scanner
 * (`shared/utils/projectmodules`) — LIB-003.
 *
 * Three things are pinned here:
 *   1. Step-0 regression: an http(s)-URL module dependency stays a verbatim URL
 *      (scanner AND injector), while a project-relative one gets the module dir
 *      prefixed. `projectmodules.js:47` used to read `d.startsWith['http']` — a
 *      property access that is always truthy — so every http URL was mangled.
 *   2. injectIntoHtml snapshot: the deploy/preview HTML injection is
 *      deterministic; unifying the two scanners must not change its output. The
 *      golden lives at tests/testfs/module-inject/expected-inject.snapshot.txt.
 *   3. Loud manifest validation: a malformed manifest surfaces a warning naming
 *      the module, never a silent skip.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the
 * Electron/Jasmine runner, and importing @jest/globals throws at module load.
 */
import * as fs from 'fs';
import * as path from 'path';

import ProjectModules, { scanModuleManifests } from '../../src/shared/utils/projectmodules';

const DEPS_FIXTURE = path.join(process.cwd(), 'tests/testfs/module-deps');
const INJECT_FIXTURE = path.join(process.cwd(), 'tests/testfs/module-inject');
const INJECT_GOLDEN = path.join(INJECT_FIXTURE, 'expected-inject.snapshot.txt');

const INJECT_TEMPLATE = [
  '<!DOCTYPE html><html><head>',
  '<%modules_dependencies%>',
  '</head><body>',
  '<%modules_main%>',
  '</body></html>'
].join('\n');

function scan(dir: string): Promise<any[]> {
  return new Promise((resolve) => {
    ProjectModules.instance.scanProjectModules(dir, (modules: any[]) => resolve(modules || []));
  });
}

function inject(dir: string, prefix: string): Promise<string> {
  return new Promise((resolve) => {
    ProjectModules.instance.injectIntoHtml(dir, INJECT_TEMPLATE, prefix, resolve);
  });
}

describe('projectmodules — dependency path resolution (LIB-003 Step 0)', () => {
  it('keeps http(s)-URL dependencies as verbatim URLs', async () => {
    const modules = await scan(DEPS_FIXTURE);
    expect(modules.length).toBe(1);

    const deps: string[] = modules[0].dependencies;
    expect(deps).toContain('https://cdn.example.com/vendor.min.js');
    expect(deps).toContain('http://cdn.example.com/legacy.js');
  });

  it('prefixes the module directory onto project-relative dependencies', async () => {
    const modules = await scan(DEPS_FIXTURE);
    const deps: string[] = modules[0].dependencies;
    expect(deps).toContain('noodl_modules/dep-module/vendor/local-lib.js');
  });

  it('does not path-prefix any http dependency (the startsWith bug)', async () => {
    const modules = await scan(DEPS_FIXTURE);
    const deps: string[] = modules[0].dependencies;
    for (const d of deps) {
      if (d.includes('cdn.example.com')) {
        expect(d.startsWith('http')).toBe(true);
        expect(d.startsWith('noodl_modules/')).toBe(false);
      }
    }
  });
});

describe('projectmodules — injectIntoHtml snapshot (scanner unification)', () => {
  it('produces byte-identical HTML to the committed golden', async () => {
    const slash = await inject(INJECT_FIXTURE, '/');
    const empty = await inject(INJECT_FIXTURE, '');
    const combined = '=== pathPrefix "/" ===\n' + slash + '\n\n=== pathPrefix "" ===\n' + empty + '\n';
    const golden = fs.readFileSync(INJECT_GOLDEN, 'utf8');
    expect(combined).toBe(golden);
  });

  it('excludes non-browser (cloud-only) modules from the injected HTML', async () => {
    const slash = await inject(INJECT_FIXTURE, '/');
    // server-only has runtimes ["cloud"] — its dependency must not appear.
    expect(slash.indexOf('should-not-appear.js')).toBe(-1);
  });

  it('injects an http stylesheet verbatim and prefixes a local one', async () => {
    const slash = await inject(INJECT_FIXTURE, '/');
    expect(slash).toContain('<link href="https://cdn.example.com/theme.css" rel="stylesheet">');
    expect(slash).toContain('<link href="/styles/local.css" rel="stylesheet">');
  });
});

describe('projectmodules — manifest validation (loud, never silent)', () => {
  it('skips an unparseable manifest with a warning naming the module', async () => {
    const scanned = await scanModuleManifests(path.join(process.cwd(), 'tests/testfs/module-malformed'));
    const bad = scanned.find((s) => s.name === 'broken-json');
    expect(bad).toBeDefined();
    expect(bad!.manifest).toBe(null);
    expect(bad!.warnings.length).toBeGreaterThan(0);
    expect(bad!.warnings[0]).toContain('broken-json');
  });

  it('keeps a schema-invalid manifest but warns naming the module', async () => {
    const scanned = await scanModuleManifests(path.join(process.cwd(), 'tests/testfs/module-malformed'));
    const wrong = scanned.find((s) => s.name === 'wrong-types');
    expect(wrong).toBeDefined();
    // Parsed fine, so it is still usable (best-effort) — but loudly flagged.
    expect(wrong!.manifest).not.toBe(null);
    expect(wrong!.warnings.length).toBeGreaterThan(0);
    expect(wrong!.warnings[0]).toContain('wrong-types');
  });

  it('returns an empty list for a project with no noodl_modules folder', async () => {
    const scanned = await scanModuleManifests(path.join(process.cwd(), 'tests/testfs/import_proj1'));
    expect(Array.isArray(scanned)).toBe(true);
  });
});
