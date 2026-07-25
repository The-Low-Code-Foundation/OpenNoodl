/**
 * Unit tests for the shared noodl_modules scanner (`shared/utils/projectmodules`).
 *
 * LIB-003 Step 0 regression: `projectmodules.js:47` read `d.startsWith['http']`
 * (a property access that is always truthy) instead of `d.startsWith('http')`,
 * so every http(s)-URL module dependency was wrongly rewritten to a
 * project-relative path. These specs pin the corrected semantics:
 *   - an http(s)-URL dependency stays a verbatim URL, and
 *   - a project-relative dependency gets the module directory prefixed.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the
 * Electron/Jasmine runner, and importing @jest/globals throws at module load.
 */
import * as path from 'path';

import ProjectModules from '../../src/shared/utils/projectmodules';

const FIXTURE = path.join(process.cwd(), 'tests/testfs/module-deps');

function scan(dir: string): Promise<any[]> {
  return new Promise((resolve) => {
    ProjectModules.instance.scanProjectModules(dir, (modules: any[]) => resolve(modules || []));
  });
}

describe('projectmodules — dependency path resolution (LIB-003 Step 0)', () => {
  it('keeps http(s)-URL dependencies as verbatim URLs', async () => {
    const modules = await scan(FIXTURE);
    expect(modules.length).toBe(1);

    const deps: string[] = modules[0].dependencies;
    expect(deps).toContain('https://cdn.example.com/vendor.min.js');
    expect(deps).toContain('http://cdn.example.com/legacy.js');
  });

  it('prefixes the module directory onto project-relative dependencies', async () => {
    const modules = await scan(FIXTURE);
    const deps: string[] = modules[0].dependencies;
    expect(deps).toContain('noodl_modules/dep-module/vendor/local-lib.js');
  });

  it('does not path-prefix any http dependency (the startsWith bug)', async () => {
    const modules = await scan(FIXTURE);
    const deps: string[] = modules[0].dependencies;
    for (const d of deps) {
      if (d.includes('cdn.example.com')) {
        expect(d.startsWith('http')).toBe(true);
        expect(d.startsWith('noodl_modules/')).toBe(false);
      }
    }
  });
});
