/**
 * The extraction's own tests — the half `projectmodules.ts` used to own.
 *
 * These are deliberately *not* a restatement of the editor's existing
 * `tests/utils/projectmodules.test.ts`. That suite is the extraction's control:
 * it exercises `scanModuleManifests` and `injectIntoHtml` through the editor's
 * public surface and must pass **unchanged**, because if it doesn't, the
 * extraction changed behaviour and the extraction is wrong. What is here is the
 * seam that suite cannot reach — `buildInjectionTags` on its own, which is the
 * function CN-001 added so a devtool could emit the same tags without a
 * template.
 */
const path = require('path');

const {
  buildInjectionTags,
  injectIntoTemplate,
  scanModuleManifests,
  toInjectModules,
  DEPENDENCIES_PLACEHOLDER,
  MAIN_PLACEHOLDER
} = require('../src/index.js');

// The fixture lives in the editor package because that is where CN-001's
// harness test needs it too, and one project used by both tests is one project
// that can drift out of step with neither.
const KIT_PROJECT = path.resolve(__dirname, '../../noodl-editor/tests-unit/cn-001/fixtures/kit-project');

describe('scanModuleManifests', () => {
  it('reads every module directory, and reports no warnings for well-formed ones', async () => {
    const scanned = await scanModuleManifests(KIT_PROJECT);
    const names = scanned.map((s) => s.name).sort();

    expect(names).toEqual(['cloud-only-kit', 'demo-iconset', 'demo-kit']);
    expect(scanned.every((s) => s.manifest !== null)).toBe(true);
    expect(scanned.flatMap((s) => s.warnings)).toEqual([]);
  });

  it('resolves a missing noodl_modules folder to an empty list, not an error', async () => {
    const noModules = path.resolve(__dirname, '../../noodl-editor/tests-unit/cn-001/fixtures/no-modules-project');
    await expect(scanModuleManifests(noModules)).resolves.toEqual([]);
  });

  it('resolves an absent project directory to an empty list', async () => {
    await expect(scanModuleManifests(undefined)).resolves.toEqual([]);
  });
});

describe('buildInjectionTags', () => {
  let tags;

  beforeAll(async () => {
    tags = buildInjectionTags(toInjectModules(await scanModuleManifests(KIT_PROJECT)), '/');
  });

  it("emits a module's main as a script tag under the given prefix", () => {
    expect(tags.modulesMain).toContain('<script type="text/javascript" src="/noodl_modules/demo-kit/index.js"></script>');
  });

  describe('the module-name marker (CN-003)', () => {
    // 🔴 Why this needs its own tests: every assertion in this describe block
    // uses `toContain`, so the marker could have been added — or silently
    // dropped again — without a single one of them noticing. The defect it
    // fixes was invisible for the same reason one layer up: the runtime names a
    // module from the object a kit passes to `Noodl.defineModule`, no kit sets
    // a name there, and so every kit node in the editor reported
    // `module: 'Unknown Module'` while the manifest held the answer.

    it('sets the manifest name immediately before the module’s own script', () => {
      // Order is the whole mechanism — scripts run in document order, and a
      // marker after the script tells `defineModule` nothing. Asserted as one
      // adjacent string rather than two `toContain`s, which would pass on any
      // ordering at all.
      expect(tags.modulesMain).toContain(
        '<script type="text/javascript">window.__noodl_module_name = "Demo Kit";</script>\n' +
          '<script type="text/javascript" src="/noodl_modules/demo-kit/index.js"></script>'
      );
    });

    it('emits no marker for a module with no script of its own', () => {
      // The iconset is stylesheet-only. A marker with no script after it would
      // leave the *previous* kit's name standing for whatever ran next.
      expect(tags.modulesMain).not.toContain('demo-iconset');
    });

    it('escapes a name that would otherwise close the script tag', () => {
      // A manifest is project-supplied and this string reaches a deployed page.
      const hostile = buildInjectionTags(
        [{ index: 'noodl_modules/x/index.js', dependencies: [], runtimes: ['browser'], name: '</script><b>x' }],
        '/'
      );
      expect(hostile.modulesMain).not.toContain('</script><b>');
      expect(hostile.modulesMain).toContain('\\u003c/script>');
    });

    it('falls back to the directory name when a manifest omits one', () => {
      const unnamed = toInjectModules([
        { name: 'some-dir', dirPath: 'noodl_modules/some-dir', manifest: { main: 'index.js' }, warnings: [] }
      ]);
      expect(unnamed[0].name).toBe('some-dir');
    });
  });

  it('emits a stylesheet-only module as a link and nothing else', () => {
    expect(tags.dependencies).toContain('<link href="/noodl_modules/demo-iconset/styles.css" rel="stylesheet">');
    expect(tags.modulesMain).not.toContain('demo-iconset');
  });

  it('drops a module whose runtimes exclude browser', () => {
    // Without this filter a cloud-only module's script reaches the browser and
    // fails there. It is the one piece of policy in an otherwise mechanical
    // function, so it gets its own assertion.
    expect(tags.modulesMain + tags.dependencies).not.toContain('cloud-only-kit');
  });

  it('honours a non-root prefix', () => {
    const prefixed = buildInjectionTags(
      [{ dependencies: [], runtimes: ['browser'], index: 'noodl_modules/k/index.js' }],
      '/preview/'
    );
    expect(prefixed.modulesMain).toContain('src="/preview/noodl_modules/k/index.js"');
  });

  it('leaves an http(s) dependency absolute', () => {
    // A CDN-hosted dependency (ERG-002's whole point) must not be prefixed into
    // a path that resolves against the project.
    const remote = buildInjectionTags(
      [{ dependencies: ['https://cdn.example.com/lib.js'], runtimes: ['browser'] }],
      '/'
    );
    expect(remote.dependencies).toContain('src="https://cdn.example.com/lib.js"');
    expect(remote.dependencies).not.toContain('/https://');
  });

  it('emits nothing at all for no modules', () => {
    expect(buildInjectionTags(undefined, '/')).toEqual({ dependencies: '', modulesMain: '' });
  });
});

describe('injectIntoTemplate', () => {
  it('fills both placeholders', () => {
    const out = injectIntoTemplate(`<head>${DEPENDENCIES_PLACEHOLDER}</head><body>${MAIN_PLACEHOLDER}</body>`, {
      dependencies: '<link>',
      modulesMain: '<script></script>'
    });
    expect(out).toBe('<head><link></head><body><script></script></body>');
  });

  it('leaves a template with no placeholders untouched', () => {
    expect(injectIntoTemplate('<html></html>', { dependencies: 'X', modulesMain: 'Y' })).toBe('<html></html>');
  });
});
