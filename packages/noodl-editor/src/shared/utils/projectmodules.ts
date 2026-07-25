/**
 * The single noodl_modules scanner (LIB-003).
 *
 * Modules are folders under `<projectDir>/noodl_modules/<name>/`, each with a
 * `manifest.json` (and usually an `index.js`). This file is the one place that
 * reads that directory, parses + validates each manifest, and turns the results
 * into either:
 *   - inject-shaped modules for the preview/deploy HTML (`scanProjectModules` /
 *     `injectIntoHtml`), consumed by web-server, the deploy HtmlProcessor, the
 *     headless noodl-preview loader (via HtmlProcessor) and ViewerConnection; or
 *   - raw manifests for the editor's ProjectModel (`scanModuleManifests`,
 *     consumed by `projectmodel.modules.ts`).
 *
 * It used to be two parallel scanners — this `shared/utils/projectmodules.js`
 * (callback + node fs, drove injection) and `projectmodel.modules.ts` (async +
 * @noodl/platform, drove the editor model), the latter literally carrying a
 * `// TODO: Can we merge this with ProjectModules ?`. They are now one core:
 * `scanModuleManifests` does the read+parse+validate, and everything else is a
 * pure shaping layer on top.
 *
 * Loud, never silent: a manifest that cannot be read or parsed is skipped from
 * the output *with a console warning naming the module*, and one that parses but
 * fails the schema is kept (best-effort, to never regress a working project)
 * *with a warning naming the module*. Nothing is dropped in silence.
 *
 * This file is required from the Electron main process (`web-server.js`, via
 * `.default`) and imported from the renderer; it deliberately depends only on
 * `fs` + `ajv`, both available in both.
 */
import * as fs from 'fs';

import Ajv from 'ajv';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModuleBrowserManifest {
  head?: string[];
  styles?: string[];
  stylesheets?: (string | unknown)[];
}

/**
 * The on-disk `manifest.json` shape. Deliberately permissive
 * (`[key: string]: unknown`) — manifests carry extra, module-specific fields
 * (componentIndex, componentAnnotations, previews, …) that must survive.
 */
export interface ModuleManifest {
  name?: string;
  main?: string;
  type?: 'iconset';
  icons?: string[];
  iconClass?: string;
  dependencies?: string[];
  runtimes?: string[];
  browser?: ModuleBrowserManifest;
  componentAnnotations?: Record<string, Record<string, unknown>>;
  previews?: unknown[];
  [key: string]: unknown;
}

/** One scanned module directory. `manifest` is null only for a hard failure. */
export interface ScannedModule {
  /** Directory name under noodl_modules/, e.g. "material-icons". */
  name: string;
  /** Project-relative path to the module dir, e.g. "noodl_modules/material-icons". */
  dirPath: string;
  /** Parsed manifest, or null when the manifest is missing / not valid JSON. */
  manifest: ModuleManifest | null;
  /** Human-readable diagnostics for this module (also emitted to console.warn). */
  warnings: string[];
}

/** The inject-shaped module the HTML injector consumes. */
export interface InjectModule {
  dependencies: string[];
  browser?: ModuleBrowserManifest;
  runtimes: string[];
  index?: string;
}

// ─── Manifest schema (runtime-validated) ─────────────────────────────────────
//
// Intentionally lenient: every field optional, `additionalProperties` open. Its
// job is to catch a *malformed* manifest (wrong-typed fields) and name it, not
// to reject unusual-but-valid ones — a false rejection would silently drop a
// working module, the exact regression this task forbids. A parsed manifest that
// fails validation is therefore warned about but still used.

const manifestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    main: { type: 'string' },
    type: { type: 'string', enum: ['iconset'] },
    icons: { type: 'array', items: { type: 'string' } },
    iconClass: { type: 'string' },
    dependencies: { type: 'array', items: { type: 'string' } },
    runtimes: { type: 'array', items: { type: 'string' } },
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
const validateManifest = ajv.compile(manifestSchema);

function warn(name: string, message: string): string {
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
 */
export async function scanModuleManifests(projectDirectory: string | undefined): Promise<ScannedModule[]> {
  if (!projectDirectory) return [];

  const modulesPath = projectDirectory + '/noodl_modules';

  let entries: string[];
  try {
    entries = await fs.promises.readdir(modulesPath);
  } catch (error: any) {
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

  const scanned: ScannedModule[] = [];

  for (const dir of directories) {
    const dirPath = 'noodl_modules/' + dir;
    const manifestPath = modulesPath + '/' + dir + '/manifest.json';
    const entry: ScannedModule = { name: dir, dirPath, manifest: null, warnings: [] };

    let raw: string;
    try {
      raw = await fs.promises.readFile(manifestPath, 'utf8');
    } catch {
      entry.warnings.push(warn(dir, 'manifest.json is missing or unreadable — module skipped'));
      scanned.push(entry);
      continue;
    }

    let parsed: ModuleManifest;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
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

function toInjectModules(scanned: ScannedModule[]): InjectModule[] {
  const modules: InjectModule[] = [];

  for (const s of scanned) {
    const manifest = s.manifest;
    if (!manifest) continue; // already warned by the core scan

    const m: InjectModule = {
      dependencies: [],
      browser: manifest.browser,
      runtimes: manifest.runtimes || ['browser'] // default to browser
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
  withIndex.sort((a, b) => (a.index as string).localeCompare(b.index as string));

  return withIndex.concat(withoutIndex);
}

class ProjectModules {
  static instance: ProjectModules;

  /**
   * Back-compat callback API: hands the caller the inject-shaped module list
   * (or `undefined` when there are none), same contract as before the merge.
   */
  scanProjectModules(projectDirectory: string | undefined, callback: (modules?: InjectModule[]) => void): void {
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

  injectIntoHtml(
    projectDirectory: string | undefined,
    template: string,
    pathPrefix: string,
    callback: (injected: string) => void
  ): void {
    this.scanProjectModules(projectDirectory, function (modules) {
      let dependencies = '';
      let modulesMain = '';
      if (modules) {
        const browserModules = modules.filter((m) => m.runtimes.indexOf('browser') !== -1);
        for (let i = 0; i < browserModules.length; i++) {
          const m = browserModules[i];
          if (m.index) {
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
                  let path = sheets[j] as string;
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

      let injected = template.replace('<%modules_dependencies%>', dependencies);
      injected = injected.replace('<%modules_main%>', modulesMain);

      callback(injected);
    });
  }
}

ProjectModules.instance = new ProjectModules();

export default ProjectModules;
