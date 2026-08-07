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
 * `fs` + `ajv` (+ Node's built-in `vm`/`http`/`https` for the ERG-002 additions
 * below), all available in both.
 *
 * ── ERG-002: external libraries in app config ───────────────────────────────
 *
 * The scan/inject plumbing above already did the right thing before this task
 * — see dev-docs/tasks/phase-35-authoring-ergonomics/ERG-002-EXTERNAL-LIBRARIES.md
 * §0. What was missing was surface: a way for an author to register a
 * third-party UMD/IIFE library (PocketBase, tinyMCE, …) without hand-writing a
 * folder, and a check that catches the single most common failure — a CDN
 * build that's an ES module rather than a browser global — at add time instead
 * of as a silent `undefined` an hour later.
 *
 * `verifyLibrarySource` is the "whole of Richard's pain" check (spec §2): it
 * runs the fetched source in a sandboxed `vm` context shaped like a browser
 * (`window`/`self`/`globalThis` all aliased to the sandbox) and checks whether
 * the declared global actually appears. `registerLibrary` / `listRegisteredLibraries`
 * / `removeLibrary` are the write/read/delete surface the "Libraries" settings
 * section calls; they reuse `scanModuleManifests` for reading and add a `kind:
 * 'external-library'` marker to manifests they write so listing/removal never
 * touches a hand-authored module (an icon set, say) by accident.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as vm from 'vm';

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
  /**
   * Which of NDA-007 §1's icon kinds this set ships. Absent means `'font'`, which is what every
   * set predating NDA-007 §2 is — the field is what lets a set be something other than a font
   * without a second registration mechanism.
   */
  iconSource?: 'font' | 'sprite';
  /** `sprite` sets only: module-relative path to the sheet, e.g. `"icons/sprite.svg"`. */
  sprite?: string;
  icons?: string[];
  iconClass?: string;
  /**
   * Font sets where each glyph is its own class rather than a codepoint. Read by the icon picker
   * since long before NDA-007 and never declared here — `additionalProperties: true` is why it
   * worked.
   */
  codeAsClass?: boolean;
  dependencies?: string[];
  runtimes?: string[];
  browser?: ModuleBrowserManifest;
  componentAnnotations?: Record<string, Record<string, unknown>>;
  previews?: unknown[];
  /**
   * ERG-002. Which noodl_modules producer wrote this manifest. Only
   * `'external-library'` is written by this file's `registerLibrary`; every
   * other value (including absent, e.g. hand-authored icon sets) is left
   * alone by `listRegisteredLibraries`/`removeLibrary` on purpose — those must
   * never touch a module they didn't create.
   */
  kind?: 'external-library' | string;
  /**
   * ERG-002. The `window`-attached global name this library is expected to
   * define, e.g. `"PocketBase"`. Not read by the injector (`injectIntoHtml`
   * only cares about `dependencies`/`browser`/`runtimes`) — it exists so the
   * editor can re-verify a library, surface it to the code editors and the AI
   * authoring loop's context, and warn when it's registered on an SSR/SSG
   * project (§3: a `window` global does not exist during server rendering).
   */
  global?: string;
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

// ─── ERG-002: verify on add ──────────────────────────────────────────────────

export interface LibraryVerifyResult {
  ok: boolean;
  /**
   * Human-facing: a confirmation on success, or — on failure — a message that
   * *names the likely cause*, per spec §2. Never a bare "false".
   */
  message: string;
  /** Every global the script defined that the sandbox didn't already have, minus the one asked for. */
  otherGlobalsDefined?: string[];
}

/**
 * The check spec §2 calls "the whole of Richard's pain": run the fetched
 * source in a sandbox shaped like a browser tab (`window`/`self`/`globalThis`
 * all aliased to the sandbox object, since a plain `<script>` tag is exactly
 * how this file is loaded — no bundler, no module system) and confirm the
 * declared global actually appears afterward.
 *
 * Deliberately NOT a syntax-only check — a UMD build that runs cleanly but
 * assigns a *different* name than declared is exactly the class of bug this
 * exists to catch, same as a build that doesn't run at all.
 *
 * Runs in Node's `vm` module, not an Electron `BrowserWindow` — this keeps it
 * callable from a plain jest test (no renderer, no Electron) and from the
 * editor's main/renderer processes alike. The tradeoff: a library that
 * genuinely requires DOM APIs beyond `document`'s stub (canvas, layout, …) to
 * reach its top-level assignment will false-negative here. That's the same
 * shape of gap `scanForLegacyPatterns` (RUN-001) accepts for React 19
 * compatibility — informational, not a hard gate; §2 says the check converts a
 * *silent* runtime `undefined` into a named diagnosis, not that it is exhaustive.
 */
export function verifyLibrarySource(code: string, globalName: string): LibraryVerifyResult {
  const name = (globalName || '').trim();
  if (!name) {
    return { ok: false, message: 'A global variable name is required to verify a library.' };
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    return {
      ok: false,
      message: `"${name}" is not a valid JavaScript identifier, so it cannot be a global variable name.`
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sandbox: Record<string, any> = {
    console,
    // A UMD wrapper typically probes `typeof module`, `typeof exports`,
    // `typeof define`, then falls through to `window.X = factory()` — leaving
    // these undefined (not defined-as-empty-objects) is what makes that
    // fall-through happen instead of the CommonJS/AMD branch.
    navigator: { userAgent: 'node' },
    document: {
      createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
      createElementNS: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
      getElementsByTagName: () => [],
      head: { appendChild() {} },
      currentScript: null,
      addEventListener() {},
      removeEventListener() {}
    },
    location: { href: '', protocol: 'https:', host: '' },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const before = new Set(Object.keys(sandbox));

  const context = vm.createContext(sandbox);
  try {
    new vm.Script(code, { filename: 'library-source.js' }).runInContext(context, { timeout: 5000 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeEsm =
      /Unexpected token ['"`]?export['"`]?/i.test(message) ||
      /Cannot use import statement outside a module/i.test(message) ||
      /Unexpected token ['"`]?import['"`]?/i.test(message);
    const looksLikeCjs = /(module|exports) is not defined/i.test(message);

    if (looksLikeEsm) {
      return {
        ok: false,
        message: `"${name}" could not be loaded (${message}). This is usually an ES-module build — look for the UMD or "browser" build on the CDN (often "…/dist/${slugify(name)}.umd.js").`
      };
    }
    if (looksLikeCjs) {
      return {
        ok: false,
        message: `"${name}" could not be loaded (${message}). This looks like a CommonJS (Node) build, not a browser one — a plain <script> tag has no "module"/"exports". Look for the UMD or "browser" build on the CDN.`
      };
    }
    return { ok: false, message: `"${name}" failed to load: ${message}` };
  }

  const value = sandbox[name];
  if (value !== undefined) {
    return { ok: true, message: `"${name}" loaded and defined the global as expected.` };
  }

  const otherGlobalsDefined = Object.keys(sandbox).filter((k) => !before.has(k) && sandbox[k] !== undefined);
  if (otherGlobalsDefined.length > 0) {
    return {
      ok: false,
      message: `"${name}" loaded but defined no global called "${name}". It did define: ${otherGlobalsDefined.join(
        ', '
      )} — did you mean one of those?`,
      otherGlobalsDefined
    };
  }

  return {
    ok: false,
    message: `"${name}" loaded but defined no global called "${name}". This is usually an ES-module build — look for the UMD or "browser" build on the CDN (often "…/dist/${slugify(
      name
    )}.umd.js").`
  };
}

/** Lowercase-kebab, used only to shape the illustrative filename in a diagnosis message. */
function slugify(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch a library's source over http(s), following redirects (CDNs commonly
 * 301/302 a version-less URL to a pinned one). No new dependency — Node's
 * built-in `http`/`https` cover this without pulling `node-fetch` (a
 * dependency of `noodl-viewer-react`, not `noodl-editor`) into a package that
 * doesn't already have it.
 */
export function fetchUrlSource(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        fetchUrlSource(next, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`Fetching "${url}" failed with HTTP ${status}.`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error(`Fetching "${url}" timed out.`)));
  });
}

// ─── ERG-002: register / list / remove ───────────────────────────────────────

export interface RegisterLibraryParams {
  /** Display name — becomes the noodl_modules folder name (slugified). */
  name: string;
  /** Either a CDN URL, or source already read from a file the author dropped in. */
  source: { kind: 'url'; url: string } | { kind: 'file'; code: string; fileName: string };
  /** The `window`-attached global this library is expected to define. */
  globalName: string;
  /** Optional stylesheet URL — `browser.stylesheets`, e.g. tinyMCE's skin CSS. */
  stylesheetUrl?: string;
  /**
   * When true, the fetched/dropped source is written into the module folder
   * and referenced locally instead of the remote URL (spec §2 "offer to
   * vendor it locally" — `noodl_modules/` already ships verbatim on deploy,
   * so a vendored library needs no further work to survive one).
   */
  vendor?: boolean;
}

export interface RegisterLibraryResult {
  ok: boolean;
  message: string;
  moduleName?: string;
}

/** A registered library, shaped for the settings UI / AI context / SSR check — not the raw manifest. */
export interface RegisteredLibrary {
  /** noodl_modules folder name. */
  moduleName: string;
  /** Manifest `name`, when set (falls back to the folder name). */
  displayName: string;
  global: string;
  dependencies: string[];
  stylesheets: string[];
  runtimes: string[];
  /** True when the library's script was downloaded into the project rather than left as a remote URL. */
  vendored: boolean;
}

function slugifyModuleName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'library';
}

/**
 * Verify, then write a `noodl_modules/<slug>/manifest.json` (spec §2's "app
 * config Libraries section that writes a noodl_modules manifest, and verifies
 * it on the way in"). Refuses to overwrite a module this function didn't
 * create (guards a hand-authored module, e.g. an icon set, from being
 * clobbered by a name collision).
 */
export async function registerLibrary(
  projectDirectory: string,
  params: RegisterLibraryParams
): Promise<RegisterLibraryResult> {
  if (!projectDirectory) return { ok: false, message: 'No project is open.' };
  if (!params.name || !params.name.trim()) return { ok: false, message: 'A library name is required.' };

  let code: string;
  try {
    code = params.source.kind === 'url' ? await fetchUrlSource(params.source.url) : params.source.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Could not fetch the library source: ${message}` };
  }

  const verified = verifyLibrarySource(code, params.globalName);
  if (!verified.ok) return { ok: false, message: verified.message };

  const moduleName = slugifyModuleName(params.name);
  const dirPath = projectDirectory + '/noodl_modules/' + moduleName;
  const manifestPath = dirPath + '/manifest.json';

  const existing = await readManifestIfPresent(manifestPath);
  if (existing && existing.kind !== 'external-library') {
    return {
      ok: false,
      message: `"${moduleName}" already exists as a noodl_modules folder that ERG-002 didn't create — choose a different name.`
    };
  }

  const manifest: ModuleManifest = {
    name: params.name.trim(),
    kind: 'external-library',
    global: params.globalName.trim(),
    runtimes: ['browser'],
    dependencies: [],
    browser: params.stylesheetUrl ? { stylesheets: [params.stylesheetUrl] } : undefined
  };

  await fs.promises.mkdir(dirPath, { recursive: true });

  if (params.vendor) {
    const fileName =
      params.source.kind === 'file' ? params.source.fileName : params.source.url.split('/').pop() || 'index.js';
    await fs.promises.writeFile(dirPath + '/' + safeFileName(fileName), code, 'utf8');
    manifest.main = safeFileName(fileName);
  } else if (params.source.kind === 'url') {
    manifest.dependencies = [params.source.url];
  } else {
    // A dropped file that wasn't asked to be vendored still has to live
    // somewhere for the injector to find it — write it regardless, same file
    // either way. "vendor" only changes whether a *URL* source stays remote.
    const fileName = safeFileName(params.source.fileName);
    await fs.promises.writeFile(dirPath + '/' + fileName, code, 'utf8');
    manifest.main = fileName;
  }

  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { ok: true, message: verified.message, moduleName };
}

function safeFileName(name: string): string {
  const withoutQuery = name.split(/[?#]/)[0];
  const base = withoutQuery.split(/[\\/]/).pop() || 'index.js';
  return base.replace(/[^A-Za-z0-9._-]+/g, '-') || 'index.js';
}

async function readManifestIfPresent(manifestPath: string): Promise<ModuleManifest | null> {
  try {
    const raw = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Every library registered via `registerLibrary` — never a hand-authored module (icon sets, …). */
export async function listRegisteredLibraries(projectDirectory: string | undefined): Promise<RegisteredLibrary[]> {
  const scanned = await scanModuleManifests(projectDirectory);
  const libraries: RegisteredLibrary[] = [];

  for (const s of scanned) {
    const m = s.manifest;
    if (!m || m.kind !== 'external-library') continue;

    libraries.push({
      moduleName: s.name,
      displayName: typeof m.name === 'string' && m.name ? m.name : s.name,
      global: typeof m.global === 'string' ? m.global : '',
      dependencies: Array.isArray(m.dependencies) ? m.dependencies : [],
      stylesheets:
        m.browser && Array.isArray(m.browser.stylesheets)
          ? (m.browser.stylesheets.filter((x) => typeof x === 'string') as string[])
          : [],
      runtimes: Array.isArray(m.runtimes) ? m.runtimes : ['browser'],
      vendored: typeof m.main === 'string' && m.main.length > 0
    });
  }

  return libraries;
}

/** Deletes a library's noodl_modules folder. Refuses to touch a module this function didn't create. */
export async function removeLibrary(
  projectDirectory: string | undefined,
  moduleName: string
): Promise<{ ok: boolean; message: string }> {
  if (!projectDirectory) return { ok: false, message: 'No project is open.' };

  const dirPath = projectDirectory + '/noodl_modules/' + moduleName;
  const manifest = await readManifestIfPresent(dirPath + '/manifest.json');
  if (!manifest || manifest.kind !== 'external-library') {
    return { ok: false, message: `"${moduleName}" is not a library this feature registered — refusing to delete it.` };
  }

  await fs.promises.rm(dirPath, { recursive: true, force: true });
  return { ok: true, message: `"${moduleName}" removed.` };
}

/**
 * §3's SSR/SSG trap: `globalThis.__noodl_modules` (read by
 * `packages/noodl-viewer-react/static/ssr/index.js:68`) is populated only by
 * `Noodl.defineModule` calls (`runtime-globals.js:33-36`). A library
 * registered through this file only ever assigns a `window` global — it never
 * calls `defineModule` — so it is invisible to every render that happens
 * server-side, regardless of what `runtimes` says. `runtimes` still gates
 * *whether the injector emits the script tag at all* (`injectIntoHtml:285`);
 * this is a second, independent question — given that the tag IS emitted for
 * this render, will the code that reads the global work.
 */
export function libraryNeedsSsrWarning(lib: Pick<RegisteredLibrary, 'runtimes'>, deployRenderingMode: unknown): boolean {
  const isServerRendered = deployRenderingMode === 'ssr' || deployRenderingMode === 'ssg';
  return isServerRendered && lib.runtimes.includes('browser');
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
