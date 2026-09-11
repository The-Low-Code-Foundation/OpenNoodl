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
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildInjectionTags,
  injectIntoTemplate,
  scanModuleManifests,
  scanModuleManifestsSync,
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

describe('scanModuleManifestsSync (EXP-010)', () => {
  // 🔴 The claim the sync twin is allowed to exist on is that it is the *same scanner*, not a
  // second one — LIB-003 merged two `noodl_modules` readers precisely because two had drifted.
  // These grade that claim directly: same answer, same order, same warnings, on every input the
  // async one is tested against above. Anything less and the twin is the third scanner.
  it('gives byte-identical results to the async scan', async () => {
    expect(scanModuleManifestsSync(KIT_PROJECT)).toEqual(await scanModuleManifests(KIT_PROJECT));
  });

  it('agrees on a project with no noodl_modules folder', async () => {
    const noModules = path.resolve(__dirname, '../../noodl-editor/tests-unit/cn-001/fixtures/no-modules-project');
    expect(scanModuleManifestsSync(noModules)).toEqual(await scanModuleManifests(noModules));
    expect(scanModuleManifestsSync(noModules)).toEqual([]);
  });

  it('agrees on an absent project directory', () => {
    expect(scanModuleManifestsSync(undefined)).toEqual([]);
  });

  it('reports the same warnings for a malformed manifest', async () => {
    // ⚠️ The warning path is the one a shared core is most likely to lose: it is the branch a
    // refactor takes for granted. Both readers must name the module and both must keep the
    // best-effort manifest rather than skipping it.
    const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'module-inject-sync-'));
    fs.mkdirSync(path.join(broken, 'noodl_modules', 'bad-json'), { recursive: true });
    fs.writeFileSync(path.join(broken, 'noodl_modules', 'bad-json', 'manifest.json'), '{ not json');
    fs.mkdirSync(path.join(broken, 'noodl_modules', 'no-manifest'), { recursive: true });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const sync = scanModuleManifestsSync(broken);
      const async_ = await scanModuleManifests(broken);
      expect(sync).toEqual(async_);
      expect(sync.map((s) => s.name)).toEqual(['bad-json', 'no-manifest']);
      expect(sync[0].warnings[0]).toContain('is not valid JSON');
      expect(sync[1].warnings[0]).toContain('missing or unreadable');
    } finally {
      warn.mockRestore();
      fs.rmSync(broken, { recursive: true, force: true });
    }
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

  describe('the load-failure capture (CN-015)', () => {
    // 🔴 Why this exists at all: a kit's `index.js` that throws, fails to parse
    // or 404s is reported to a console nobody reads, and the node just never
    // appears — which reads to the author as a typo in the type name. The fact
    // exists only while the page is loading, so if these tags are not emitted
    // there is nothing to recover afterwards.
    //
    // ⚠️ These assert the *tags*. That they actually catch all three failures in
    // a browser is measured separately, in Chromium, against the output of this
    // very function — a string assertion cannot show that an event fires.

    it('opens the capture before the first kit script', () => {
      // Order is the mechanism, exactly as for the name marker: a listener
      // installed after the script that threw sees nothing.
      const preambleAt = tags.modulesMain.indexOf('__noodl_module_loading = true');
      const firstMarkerAt = tags.modulesMain.indexOf('__noodl_module_name');
      expect(preambleAt).toBeGreaterThanOrEqual(0);
      expect(preambleAt).toBeLessThan(firstMarkerAt);
    });

    it('registers the listener in the capture phase', () => {
      // 🔴 Load-bearing, and the reason is not stylistic: a script that 404s
      // fires an error on the ELEMENT, which does not bubble. Bubble-phase and
      // the missing-file case goes silently unreported — the exact failure this
      // task exists to end.
      expect(tags.modulesMain).toContain('}, true);');
    });

    it('closes the capture after the last kit script', () => {
      const closeAt = tags.modulesMain.indexOf('__noodl_module_loading = false');
      const lastScriptAt = tags.modulesMain.lastIndexOf('<script type="text/javascript" src=');
      expect(closeAt).toBeGreaterThan(lastScriptAt);
    });

    it('bounds attribution with a flag rather than by clearing the module name', () => {
      // ⚠️ Clearing `__noodl_module_name` would also have bounded it — and would
      // have broken CN-003 for a kit that defers its `defineModule` into a
      // callback, which is the case that mechanism's own comment calls out.
      expect(tags.modulesMain).not.toContain('__noodl_module_name = undefined');
      expect(tags.modulesMain).not.toContain('__noodl_module_name = null');
    });

    it('emits nothing at all for a project whose modules have no scripts', () => {
      // A stylesheet-only iconset gets no marker (asserted below), so it must
      // get no capture either: the page has to stay byte-identical to what it
      // was before this feature for every project that cannot use it.
      const iconsetOnly = buildInjectionTags(
        [{ dependencies: [], runtimes: ['browser'], name: 'Icons', browser: { styles: ['.a{}'] } }],
        '/'
      );
      expect(iconsetOnly.modulesMain).toBe('');
    });

    it('opens the capture once however many kits there are', () => {
      const opens = tags.modulesMain.split('__noodl_module_loading = true').length - 1;
      const closes = tags.modulesMain.split('__noodl_module_loading = false').length - 1;
      expect(opens).toBe(1);
      expect(closes).toBe(1);
    });
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
