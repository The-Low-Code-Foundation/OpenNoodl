/**
 * The `noodl_modules` scan, and the HTML injection it feeds.
 *
 * This is the core of the editor's **single `noodl_modules` scanner** (LIB-003),
 * moved out of `packages/noodl-editor/src/shared/utils/projectmodules.ts` so it
 * can be required by a plain-JS devtool as well as imported by the TypeScript
 * editor. `projectmodules.ts` still owns the public surface and still is the one
 * scanner — it no longer owns this code.
 *
 * ## Why it moved (CN-001, phase 69)
 *
 * `scripts/devtools/render-from-disk.js` — the server half of `render_report`,
 * the tool that exists so an agent can *look* rather than assume — built its own
 * `<head>` as a template literal with two hardcoded module stylesheets and never
 * called the injector. A project using a custom node (a `noodl_modules` kit)
 * therefore rendered **without that node**, and the report called it
 * *"Rendered clean"* with zero findings. Not a blank; worse than a blank. An
 * agent authoring correctly would have measured a green report on a page that
 * was missing its work.
 *
 * Two fixes were available and both were wrong. Requiring `projectmodules.ts`
 * from a devtool does not work — those scripts are plain JS on purpose and must
 * keep running "in a fresh checkout with no build step", and that file is
 * TypeScript inside the editor package. Reimplementing the scan there would have
 * made a **third** scanner, which is the regression LIB-003 existed to end. So
 * the pure half became a no-build workspace package, the pattern
 * `@nodegx/render-measure` (F22 / LAS-005) established for exactly this.
 *
 * ## What belongs here and what does not
 *
 * Here: reading `noodl_modules/`, parsing and validating manifests, the
 * `runtimes` filter, and the string work that turns modules into `<script>` /
 * `<link>` / `<style>` tags. Node's `fs` is fine — this package is Node-side.
 *
 * Not here: Electron, `@noodl/platform`, and the ERG-002 external-library
 * surface (`verifyLibrarySource`, `registerLibrary`, …), which needs `vm` /
 * `http` / `https` and stays in `projectmodules.ts` where its callers are.
 *
 * ## Loud, never silent
 *
 * A manifest that cannot be read or parsed is skipped from the output *with a
 * console warning naming the module*; one that parses but fails the schema is
 * kept (best-effort, to never regress a working project) *with a warning naming
 * the module*. Nothing is dropped in silence. This promise is `projectmodules.ts`'s
 * and it is kept here.
 *
 * @module @nodegx/module-inject
 */
const fs = require('fs');

const Ajv = require('ajv');

// ─── Manifest schema (runtime-validated) ─────────────────────────────────────
//
// Intentionally lenient: every field optional, `additionalProperties` open. Its
// job is to catch a *malformed* manifest (wrong-typed fields) and name it, not
// to reject unusual-but-valid ones — a false rejection would silently drop a
// working module, the exact regression LIB-003 forbids. A parsed manifest that
// fails validation is therefore warned about but still used.

const MANIFEST_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    main: { type: 'string' },
    type: { type: 'string', enum: ['iconset'] },
    iconSource: { type: 'string', enum: ['font', 'sprite'] },
    sprite: { type: 'string' },
    icons: { type: 'array', items: { type: 'string' } },
    iconClass: { type: 'string' },
    codeAsClass: { type: 'boolean' },
    dependencies: { type: 'array', items: { type: 'string' } },
    runtimes: { type: 'array', items: { type: 'string' } },
    kind: { type: 'string' },
    global: { type: 'string' },
    browser: {
      type: 'object',
      properties: {
        head: { type: 'array', items: { type: 'string' } },
        styles: { type: 'array', items: { type: 'string' } },
        stylesheets: { type: 'array' }
      },
      additionalProperties: true
    },
    componentAnnotations: { type: 'object' },
    previews: { type: 'array' }
  },
  additionalProperties: true
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateManifest = ajv.compile(MANIFEST_SCHEMA);

function warn(name, message) {
  const line = `[projectmodules] module "${name}": ${message}`;
  // eslint-disable-next-line no-console
  console.warn(line);
  return line;
}

// ─── Core scan ───────────────────────────────────────────────────────────────

/**
 * Read every module directory under `<projectDirectory>/noodl_modules`, parse
 * and validate each manifest. Returns one `ScannedModule` per directory (in
 * directory order); a missing `noodl_modules` folder (fresh project) resolves to
 * an empty list, never an error.
 *
 * @param {string | undefined} projectDirectory
 * @returns {Promise<import('./index').ScannedModule[]>}
 */
async function scanModuleManifests(projectDirectory) {
  if (!projectDirectory) return [];

  const modulesPath = projectDirectory + '/noodl_modules';

  let entries;
  try {
    entries = await fs.promises.readdir(modulesPath);
  } catch (error) {
    // No noodl_modules folder → no modules. Any other read error is genuine.
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return [];
    throw error;
  }

  const directories = entries.filter((f) => {
    try {
      const stats = fs.lstatSync(modulesPath + '/' + f);
      return stats.isDirectory() || stats.isSymbolicLink();
    } catch {
      return false;
    }
  });

  const scanned = [];

  for (const dir of directories) {
    const dirPath = 'noodl_modules/' + dir;
    const manifestPath = modulesPath + '/' + dir + '/manifest.json';
    const entry = { name: dir, dirPath, manifest: null, warnings: [] };

    let raw;
    try {
      raw = await fs.promises.readFile(manifestPath, 'utf8');
    } catch {
      entry.warnings.push(warn(dir, 'manifest.json is missing or unreadable — module skipped'));
      scanned.push(entry);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      entry.warnings.push(
        warn(dir, `manifest.json is not valid JSON (${e && e.message ? e.message : 'parse error'}) — module skipped`)
      );
      scanned.push(entry);
      continue;
    }

    if (!validateManifest(parsed)) {
      const detail = (validateManifest.errors || [])
        .map((err) => `${err.instancePath || '/'} ${err.message}`)
        .join('; ');
      // Kept, not skipped: JSON parsed, so best-effort use it — but loudly.
      entry.warnings.push(warn(dir, `manifest.json failed schema validation (${detail}) — using it anyway`));
    }

    entry.manifest = parsed;
    scanned.push(entry);
  }

  return scanned;
}

// ─── Inject-shaping layer ────────────────────────────────────────────────────

/**
 * Turn scanned modules into the inject shape: absolute-vs-relative dependency
 * paths resolved, `main` turned into an `index`, `runtimes` defaulted to
 * `browser`.
 *
 * @param {import('./index').ScannedModule[]} scanned
 * @returns {import('./index').InjectModule[]}
 */
function toInjectModules(scanned) {
  const modules = [];

  for (const s of scanned) {
    const manifest = s.manifest;
    if (!manifest) continue; // already warned by the core scan

    const m = {
      dependencies: [],
      browser: manifest.browser,
      runtimes: manifest.runtimes || ['browser'], // default to browser
      // 🔴 CN-003: **the manifest's name, carried through to the page.** Until
      // now it stopped here, and the consequence was measured in slice 3: the
      // runtime names a module from the object passed to `Noodl.defineModule`,
      // no kit sets a name there, so every kit node in the editor reported
      // `module: 'Unknown Module'` and the node picker's section for a project's
      // own nodes had the empty string for a heading. The manifest held the
      // answer the whole time and nothing gave it to the viewer.
      // The directory name is the fallback, because "material-icons" beats
      // "Unknown Module" and a manifest may legitimately omit `name`.
      name: manifest.name || s.name
    };

    if (manifest.main) {
      m.index = s.dirPath + '/' + manifest.main;
    }

    if (manifest.dependencies) {
      for (let j = 0; j < manifest.dependencies.length; j++) {
        let d = manifest.dependencies[j];
        // http(s)-URL dependencies are absolute — keep verbatim; only
        // project-relative paths get the module directory prefixed.
        if (!d.startsWith('http')) d = s.dirPath + '/' + d;
        m.dependencies.push(d);
      }
    }

    modules.push(m);
  }

  // Sort so the order is deterministic — helps the editor understand when node
  // libraries change, or are the same.
  const withIndex = modules.filter((m) => m.index);
  const withoutIndex = modules.filter((m) => !m.index);
  withIndex.sort((a, b) => a.index.localeCompare(b.index));

  return withIndex.concat(withoutIndex);
}

/**
 * The string half of the injector: modules in, two blobs of HTML out.
 *
 * Split from `injectIntoHtml` because the two consumers want different things.
 * The editor/preview/deploy path has a template carrying `<%modules_main%>` and
 * `<%modules_dependencies%>` placeholders and wants them filled. A devtool
 * building its own `<head>` wants the tags themselves. Both must produce
 * **byte-identical tags** or the harness stops being evidence about the product.
 *
 * `runtimes` is the filter that matters here: a module declaring only `cloud`
 * emits nothing into a browser page, which is a real distinction and not a
 * detail — see `libraryNeedsSsrWarning` in `projectmodules.ts` for the second,
 * independent question it does *not* answer.
 *
 * @param {import('./index').InjectModule[] | undefined} modules
 * @param {string} pathPrefix
 * @returns {{ dependencies: string, modulesMain: string }}
 */
/**
 * A JS string literal safe to drop into an inline `<script>`.
 *
 * 🔴 `JSON.stringify` is not sufficient on its own: a manifest name containing
 * `</script>` would close the tag and the rest would be parsed as HTML. The
 * escape of `<` covers that and the ` `/` ` pair covers the two
 * characters JSON leaves raw and JavaScript treats as line terminators. A
 * manifest is project-supplied, so it is untrusted input like any other.
 *
 * @param {string | undefined} value
 * @returns {string}
 */
function jsString(value) {
  return JSON.stringify(String(value == null ? '' : value))
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * 🔴 CN-015 — the capture preamble, and why a kit failure needs one at all.
 *
 * A kit's `index.js` is a plain classic script. If it throws at import, or
 * fails to parse, or 404s, the browser reports it to a console nobody is
 * watching and the node simply never appears — which reads to the author as
 * *"I typed the type wrong"*, so they debug the wrong thing. Nothing
 * downstream can recover the fact afterwards either: a kit that threw is
 * indistinguishable, in every payload the editor receives, from a kit that
 * was never installed.
 *
 * So the fact has to be caught at the only moment it exists — while the page
 * is loading the kit scripts — and the marker CN-003 already emits is what
 * makes it attributable.
 *
 * **Measured in Chromium (Electron 24), not assumed** — all three failure
 * modes fire here with `window.__noodl_module_name` still holding the right
 * kit, because a classic script blocks the parser and the next marker has not
 * run yet:
 *
 * | Failure | Event | Attributed |
 * |---|---|---|
 * | `throw` at import | `error` on window, `ev.error` set | ✅ |
 * | syntax error | `error` on window, `SyntaxError` | ✅ |
 * | `index.js` 404s | `error` on the SCRIPT element | ✅ — **capture phase only** |
 *
 * 🔴 **The listener is registered with `capture: true` and that is
 * load-bearing.** A resource error does not bubble, so a bubble-phase listener
 * sees the first two and silently misses the third — a missing `main` would go
 * on being the silent failure this task exists to end. The two kinds are told
 * apart by `ev.target`, which is the element for a resource error and the
 * window for an exception.
 *
 * ⚠️ **`__noodl_module_loading` is a separate flag rather than a clear of
 * `__noodl_module_name`, deliberately.** Attribution has to stop when the kits
 * have finished loading, or the *last* kit gets blamed for every runtime error
 * the app throws afterwards. Clearing the name would have done that too — and
 * would also have broken CN-003 for a kit that defers its `defineModule` into
 * a callback, which is exactly the case that comment calls out. A second flag
 * bounds the window and leaves the name's meaning untouched.
 *
 * ⚠️ **Scope: a kit's own `main`, not its dependencies.** Dependency tags are
 * deduped across kits and carry no marker, so a failing dependency has no one
 * kit to name. It stays uncaptured rather than being attributed to a guess.
 */
const CAPTURE_PREAMBLE =
  '<script type="text/javascript">' +
  '(function(){' +
  'window.__noodl_module_failures = window.__noodl_module_failures || [];' +
  'window.__noodl_module_loading = true;' +
  'window.addEventListener("error", function(e){' +
  'if (!window.__noodl_module_loading) return;' +
  'var name = window.__noodl_module_name;' +
  'if (!name) return;' +
  'var t = e && e.target;' +
  'var isResource = !!(t && t !== window && t.tagName === "SCRIPT");' +
  'window.__noodl_module_failures.push({' +
  'module: name,' +
  'reason: isResource ? "script-not-loaded" : "threw",' +
  'message: isResource' +
  ' ? ("its script could not be loaded (" + ((t && t.src) || "") + ")")' +
  ' : ((e && e.message) || "it threw while loading")' +
  '});' +
  '}, true);' +
  '})();' +
  '</script>\n';

/** Closes the window the preamble opened. See {@link CAPTURE_PREAMBLE}. */
const CAPTURE_EPILOGUE =
  '<script type="text/javascript">window.__noodl_module_loading = false;</script>\n';

function buildInjectionTags(modules, pathPrefix) {
  let dependencies = '';
  let modulesMain = '';

  if (modules) {
    const browserModules = modules.filter((m) => m.runtimes.indexOf('browser') !== -1);
    for (let i = 0; i < browserModules.length; i++) {
      const m = browserModules[i];
      if (m.index) {
        // CN-015: opened before the first kit script and closed after the last,
        // so exactly the kit-loading window is attributable. Emitted lazily —
        // a project whose modules are all stylesheet-only gets no preamble at
        // all, and the page is byte-identical to what it was before this.
        if (!modulesMain) modulesMain += CAPTURE_PREAMBLE;

        // 🔴 CN-003 — the name marker, and why it is a separate tag rather than
        // an attribute. A kit's `index.js` calls `Noodl.defineModule({...})` and
        // has no idea what its own manifest says; the runtime then names the
        // module from that object and gets `undefined`. Scripts execute in
        // document order, so setting the global immediately before the kit's tag
        // is what tells `defineModule` which manifest is running.
        //
        // An attribute on the script tag would need `document.currentScript`,
        // which is null inside a callback and therefore unreliable for a kit
        // that defers its `defineModule` call. This is boring and works.
        //
        // ⚠️ Safe against an older deployed runtime: a `defineModule` that never
        // reads the global just sees a page that set one.
        modulesMain += '<script type="text/javascript">window.__noodl_module_name = ' + jsString(m.name) + ';</script>\n';
        modulesMain += '<script type="text/javascript" src="' + pathPrefix + m.index + '"></script>\n';
      }

      // Module javascript dependencies
      if (m.dependencies) {
        for (let j = 0; j < m.dependencies.length; j++) {
          const d = m.dependencies[j];
          // http(s)-URL deps are absolute; only project-relative get prefixed.
          const dSrc = d.startsWith('http') ? d : pathPrefix + d;
          const dTag = '<script type="text/javascript" src="' + dSrc + '"></script>\n';
          if (dependencies.indexOf(dTag) === -1) dependencies += dTag;
        }
      }

      // Browser modules
      if (m.browser) {
        if (m.browser.head) {
          const head = m.browser.head;
          for (let j = 0; j < head.length; j++) {
            dependencies += head[j] + '\n';
          }
        }

        if (m.browser.styles) {
          const styles = m.browser.styles;
          for (let j = 0; j < styles.length; j++) {
            dependencies += '<style>' + styles[j] + '</style>' + '\n';
          }
        }

        if (m.browser.stylesheets) {
          const sheets = m.browser.stylesheets;
          for (let j = 0; j < sheets.length; j++) {
            if (typeof sheets[j] === 'string') {
              let path = sheets[j];
              if (!path.startsWith('http')) {
                path = pathPrefix + path;
              }

              dependencies += '<link href="' + path + '" rel="stylesheet">';
            }
          }
        }
      }
    }
  }

  if (modulesMain) modulesMain += CAPTURE_EPILOGUE;

  return { dependencies, modulesMain };
}

/** The two placeholders every injectable template carries. */
const DEPENDENCIES_PLACEHOLDER = '<%modules_dependencies%>';
const MAIN_PLACEHOLDER = '<%modules_main%>';

/**
 * Fill a template's two placeholders. Single-replace, matching the original
 * `String.replace` semantics exactly — a template with two `<%modules_main%>`
 * only ever had its first filled, and changing that here would be a behaviour
 * change smuggled in under an extraction.
 *
 * @param {string} template
 * @param {{ dependencies: string, modulesMain: string }} tags
 * @returns {string}
 */
function injectIntoTemplate(template, tags) {
  let injected = template.replace(DEPENDENCIES_PLACEHOLDER, tags.dependencies);
  injected = injected.replace(MAIN_PLACEHOLDER, tags.modulesMain);
  return injected;
}

// ─── The cloud half of `runtimes` (CN-013 / D18) ─────────────────────────────

/**
 * Does this module run in the **cloud** runtime?
 *
 * The mirror of `buildInjectionTags`' `runtimes.indexOf('browser') !== -1`, and
 * deliberately in the same file: `runtimes` is one vocabulary and a second
 * reading of it somewhere else is how the field came to mean different things
 * in different places. `toInjectModules` has already defaulted a missing
 * `runtimes` to `['browser']`, so a kit that says nothing is **not** a cloud
 * kit — reaching the cloud is opt-in, by the field's own documented meaning.
 *
 * 🔴 Opt-in is a decision, not an oversight. D18 rules pure-JS logic kit nodes
 * into the cloud runtime and rules SDK dependencies out, and explicitly does
 * **not** re-open D6: a kit in the service process is third-party code beside
 * the database. "Every kit in the project is evaluated in the backend unless it
 * objects" is not a default this phase gets to set on the author's behalf.
 *
 * ⚠️ The consequence, measured as CN-012's M4b before this existed: a kit
 * declaring `["cloud"]` was removed from the page by the browser filter and
 * loaded by nothing else, so **the field's only positive value made the kit run
 * nowhere**. This predicate is the other half that makes it mean something.
 *
 * @param {Pick<import('./index').InjectModule, 'runtimes'>} m
 * @returns {boolean}
 */
function moduleRunsInCloud(m) {
  return !!m && Array.isArray(m.runtimes) && m.runtimes.indexOf('cloud') !== -1;
}

/**
 * Read every module's entry script off disk, tagged with whether it is a cloud
 * module, ready for the cloud-function bundle.
 *
 * Both halves are returned — cloud modules **with** their source, non-cloud
 * modules **without** it — because the two answer different questions and only
 * one of them costs anything. The source is what the cloud loader evaluates;
 * the names of the modules that are *not* enabled are what lets an unregistered
 * node type in a cloud function be reported as *"the kit exists and is not
 * cloud-enabled"* instead of as the hang CWF-018 had to bound.
 *
 * ⚠️ A module with no `main` (a stylesheet-only library) has no entry script and
 * is reported with `source: null` whatever its `runtimes` says. A module whose
 * entry script cannot be read is reported the same way, with the read error in
 * `error` — never dropped in silence, which is this file's standing promise.
 *
 * @param {string | undefined} projectDirectory
 * @returns {Promise<import('./index').CloudModuleSource[]>}
 */
async function readCloudModuleSources(projectDirectory) {
  if (!projectDirectory) return [];

  const modules = toInjectModules(await scanModuleManifests(projectDirectory));
  const out = [];

  for (const m of modules) {
    const entry = {
      name: m.name,
      runtimes: m.runtimes,
      cloud: moduleRunsInCloud(m),
      index: m.index || null,
      source: null,
      error: null
    };

    if (entry.cloud) {
      if (!m.index) {
        entry.error = 'the manifest declares the cloud runtime but has no "main" entry script';
      } else {
        try {
          entry.source = await fs.promises.readFile(projectDirectory + '/' + m.index, 'utf8');
        } catch (e) {
          entry.error = `could not read ${m.index} (${e && e.message ? e.message : 'read error'})`;
        }
      }
      if (entry.error) warn(entry.name, `${entry.error} — its nodes will not exist in the cloud runtime`);
    }

    out.push(entry);
  }

  return out;
}

/**
 * Scan a project's modules and hand back the inject-shaped list — or
 * `undefined` when there are none, which is the contract `injectIntoHtml`'s
 * callers have always had.
 *
 * @param {string | undefined} projectDirectory
 * @param {(modules?: import('./index').InjectModule[]) => void} callback
 */
function scanProjectModules(projectDirectory, callback) {
  scanModuleManifests(projectDirectory)
    .then((scanned) => {
      const modules = toInjectModules(scanned);
      callback(modules.length > 0 ? modules : undefined);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[projectmodules] scan failed', error);
      callback();
    });
}

/**
 * Scan, build tags, fill the template. The whole injection, as the editor,
 * the preview web-server, the deploy HtmlProcessor and (since CN-001) the
 * render harness all call it.
 *
 * @param {string | undefined} projectDirectory
 * @param {string} template
 * @param {string} pathPrefix
 * @param {(injected: string) => void} callback
 */
function injectIntoHtml(projectDirectory, template, pathPrefix, callback) {
  scanProjectModules(projectDirectory, function (modules) {
    callback(injectIntoTemplate(template, buildInjectionTags(modules, pathPrefix)));
  });
}

module.exports = {
  MANIFEST_SCHEMA,
  DEPENDENCIES_PLACEHOLDER,
  MAIN_PLACEHOLDER,
  scanModuleManifests,
  toInjectModules,
  buildInjectionTags,
  injectIntoTemplate,
  scanProjectModules,
  injectIntoHtml,
  moduleRunsInCloud,
  readCloudModuleSources
};
