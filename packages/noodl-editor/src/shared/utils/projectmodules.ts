/**
 * The single noodl_modules scanner (LIB-003).
 *
 * Modules are folders under `<projectDir>/noodl_modules/<name>/`, each with a
 * `manifest.json` (and usually an `index.js`). This file is the one place that
 * reads that directory, parses + validates each manifest, and turns the results
 * into either:
 *   - inject-shaped modules for the preview/deploy HTML (`scanProjectModules` /
 *     `injectIntoHtml`), consumed by web-server, the deploy HtmlProcessor, the
 *     headless noodl-preview loader (via HtmlProcessor), ViewerConnection and —
 *     since CN-001 — `scripts/devtools/render-from-disk.js`; or
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
 * ⚠️ **That core no longer lives in this file.** As of CN-001 (phase 69) it is
 * `@nodegx/module-inject` — a no-build workspace package — and this file
 * re-exports it. Still one scanner; it just no longer *owns* the code. The move
 * happened because `scripts/devtools/render-from-disk.js`, the server half of
 * `render_report`, is plain JS that must run in a fresh checkout with no build
 * step, so it could not require this TypeScript module, and reimplementing the
 * scan there would have made the third scanner LIB-003 existed to end. If you
 * are looking for the scan, the schema, the `runtimes` filter or the tag
 * strings, they are in `packages/nodegx-module-inject/src/index.js`.
 *
 * Loud, never silent: a manifest that cannot be read or parsed is skipped from
 * the output *with a console warning naming the module*, and one that parses but
 * fails the schema is kept (best-effort, to never regress a working project)
 * *with a warning naming the module*. Nothing is dropped in silence.
 *
 * This file is required from the Electron main process (`web-server.js`, via
 * `.default`) and imported from the renderer; it deliberately depends only on
 * `fs` + `@nodegx/module-inject` (+ Node's built-in `vm`/`http`/`https` for the
 * ERG-002 additions below), all available in both.
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
import {
  buildInjectionTags,
  injectIntoTemplate,
  scanModuleManifests,
  toInjectModules
} from '@nodegx/module-inject';
import type { InjectModule, ModuleManifest } from '@nodegx/module-inject';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as vm from 'vm';

// ─── Types ───────────────────────────────────────────────────────────────────
//
// Re-exported, not restated. `export type { X } from '…'` would leave this
// file's own consumers importing a type that no longer exists here; a plain
// re-export keeps every `import { ModuleManifest } from '…/projectmodules'`
// in the tree working unchanged, which is the point — the extraction must not
// be visible to a caller.

export type {
  InjectModule,
  InjectionTags,
  ModuleBrowserManifest,
  ModuleManifest,
  ScannedModule
} from '@nodegx/module-inject';

// The scan itself, re-exported so `projectmodel.modules.ts` and the ERG-002
// surface below both keep calling `scanModuleManifests` from here.
export { scanModuleManifests };

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

// ─── CN-006: scaffold a node kit ─────────────────────────────────────────────

/** What the caller gets back about a kit it just asked for. */
export interface CreateNodeKitResult {
  ok: boolean;
  message: string;
  /** The directory under `noodl_modules/`, on success. */
  moduleName?: string;
  /** Project-relative path of the kit's `index.js`, on success — what the editor opens. */
  indexPath?: string;
  /** The node type the example node registers, e.g. `weather-kit.StatTile`. */
  nodeType?: string;
}

/**
 * Write a node kit scaffold into a project — the editor's half of ✅ **D1**.
 *
 * Deliberately a thin wrapper over `@nodegx/kit-scaffold`'s `writeKitScaffold`,
 * which is the *same* generator `create_node_kit` calls on the MCP side. That is
 * the whole reason the generator is its own package: two entry points onto one
 * file set, so the editor and the agent cannot drift into teaching different
 * things about what a good kit looks like.
 *
 * ⚠️ It refuses rather than overwrites — `writeKitScaffold` returns a
 * `kit-exists` failure — which is CN-006's AC5 and matters more here than on the
 * MCP side: a mis-typed name in a text field is a much easier way to land on an
 * existing kit than a tool call is.
 *
 * 🔴 **This file is bundled by webpack in the renderer.** That is not incidental:
 * the scaffold reads the published `.d.ts` at call time through
 * `require.resolve`, which webpack rewrites to a module id, and every scaffold
 * from the editor threw `ENOENT` until `resolvePublishedPackageJson` was taught
 * to verify its own answer. `nodegx-kit-scaffold/tests/webpack-caller.test.js`
 * is the gate; do not "simplify" that resolver back to one call.
 */
export async function createNodeKit(
  projectDirectory: string | undefined,
  name: string
): Promise<CreateNodeKitResult> {
  if (!projectDirectory) return { ok: false, message: 'No project is open.' };

  // Required lazily so the main process — which requires this module for
  // `injectIntoHtml` — does not pay for the generator it never calls.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { writeKitScaffold } = require('@nodegx/kit-scaffold');

  let result;
  try {
    result = await writeKitScaffold(projectDirectory, { name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `The kit could not be written: ${message}` };
  }

  if (!result.ok) return { ok: false, message: result.message };

  return {
    ok: true,
    message: `Created "${result.kit.displayName}" with an example node, a README and a copy of the kit types.`,
    moduleName: result.kit.dirName,
    indexPath: `noodl_modules/${result.kit.dirName}/index.js`,
    nodeType: result.kit.nodeType
  };
}

// ─── CN-006b: the kits surface ───────────────────────────────────────────────

/**
 * One node kit installed in a project, shaped for the settings list.
 *
 * 🔴 **There is no node count here, deliberately.** ✅ **D3** puts node
 * definitions in the running viewer's gift: what a kit registers is known only
 * once its `index.js` has executed, and this function reads disk. A count
 * derived from the manifest would be a guess that reads exactly like a fact —
 * the caller joins `nodeIndex.moduleNodes` on `displayName` instead, which is
 * the same name `NoodlRuntime.registerModule` stamps onto every node it
 * registers.
 */
export interface ProjectNodeKit {
  /** The `noodl_modules/` folder name. The identity — what removal takes. */
  dirName: string;
  /**
   * Manifest `name`, falling back to the folder name.
   *
   * ⚠️ Also the **join key into the node library**: `nodelibraryexport.ts`
   * groups `moduleNodes` by `metadata.module`, which is this string (CN-018).
   * Two kits sharing a display name would share a group; the folder names still
   * differ, so this list still shows both rows.
   */
  displayName: string;
  /**
   * Manifest `version`, when the kit declares one.
   *
   * 🔴 **Measured 2026-08-17: not one kit in any of the 29 real projects
   * declares a version**, the scaffold writes none, and `MANIFEST_SCHEMA` in
   * `@nodegx/module-inject` has no `version` property (its `additionalProperties`
   * is open, so one is *allowed*, just never produced). CN-016 owns what a kit
   * version means for install and compat gating. This reads what is there and
   * omits the field when it is not — it does not invent one.
   */
  version?: string;
  /** The `@nodegx/node-kit-types` version the scaffold stamped, when present. */
  nodeKitTypes?: string;
  /** Manifest `main` — the script the runtime loads. */
  main: string;
}

/**
 * Is this scanned module a node kit?
 *
 * 🔴 **There is no `kind: 'node-kit'` marker to test, and this was measured
 * rather than assumed.** A census of every `manifest.json` in the 29 test
 * projects finds exactly four shapes: an iconset (`type: 'iconset'`), an asset
 * module such as the bundled Inter font (`browser`, no `main`), an ERG-002
 * library (`kind: 'external-library'`), and a kit (`main`, no marker of its
 * own). So the rule is subtractive: **a module with a `main` that is not one of
 * the two things we can positively identify as something else.**
 *
 * ⚠️ **Deliberately inclusive at the boundary.** A hand-authored module that
 * runs a `main` and registers no nodes lands in this list showing zero nodes,
 * rather than being silently hidden. That is `projectmodules`' standing
 * "loud, never silent" contract: a folder an author put in `noodl_modules/` and
 * cannot see anywhere in the product is the exact complaint CN-006b exists to
 * answer, and hiding an unrecognised one would reproduce it.
 */
function manifestLooksLikeKit(m: ModuleManifest | null): boolean {
  if (!m) return false;
  if (typeof m.main !== 'string' || !m.main) return false;
  if (m.kind === 'external-library') return false;
  if (m.type === 'iconset') return false;
  return true;
}

/** Every node kit installed in a project, in folder order. */
export async function listNodeKits(projectDirectory: string | undefined): Promise<ProjectNodeKit[]> {
  const scanned = await scanModuleManifests(projectDirectory);
  const kits: ProjectNodeKit[] = [];

  for (const s of scanned) {
    const m = s.manifest;
    if (!manifestLooksLikeKit(m)) continue;

    const kit: ProjectNodeKit = {
      dirName: s.name,
      displayName: typeof m.name === 'string' && m.name ? m.name : s.name,
      main: String(m.main)
    };

    // Present-only, never defaulted: `version: '—'` or `version: '0.0.0'` would
    // put a number on screen that no kit on disk has ever said.
    const version = (m as Record<string, unknown>).version;
    if (typeof version === 'string' && version) kit.version = version;

    const typesVersion = (m as Record<string, unknown>).nodeKitTypes;
    if (typeof typesVersion === 'string' && typesVersion) kit.nodeKitTypes = typesVersion;

    kits.push(kit);
  }

  return kits;
}

/**
 * Delete a kit's `noodl_modules/` folder.
 *
 * Mirrors `removeLibrary`'s refusal exactly, and for the same reason: this is a
 * recursive delete driven by a name from a list, and the one failure that must
 * be impossible is removing something the list had no business offering. An
 * iconset, an ERG-002 library or a module with no `main` is refused **by name**
 * rather than skipped.
 */
export async function removeNodeKit(
  projectDirectory: string | undefined,
  dirName: string
): Promise<{ ok: boolean; message: string }> {
  if (!projectDirectory) return { ok: false, message: 'No project is open.' };
  if (!dirName || dirName.includes('/') || dirName.includes('\\') || dirName.includes('..')) {
    return { ok: false, message: `"${dirName}" is not a module folder name — refusing to delete it.` };
  }

  const dirPath = projectDirectory + '/noodl_modules/' + dirName;
  const manifest = await readManifestIfPresent(dirPath + '/manifest.json');
  if (!manifestLooksLikeKit(manifest)) {
    return { ok: false, message: `"${dirName}" is not a node kit — refusing to delete it.` };
  }

  await fs.promises.rm(dirPath, { recursive: true, force: true });
  return { ok: true, message: `"${dirName}" removed. Reload the preview to take its nodes out of the picker.` };
}

/**
 * Join the kits on disk to the nodes a *running* runtime has registered.
 *
 * The two halves answer different questions and neither can answer the other's:
 * disk knows every kit that is installed, including one that has never run; the
 * library knows every node that exists, and nothing about a kit that registered
 * none. A kit with `nodes: []` is therefore **installed but not yet loaded**,
 * not broken, and the surface must say which.
 *
 * ⚠️ Groups in `moduleNodes` with no kit on disk are returned as `orphans`
 * rather than dropped. It is a real state — a kit deleted from disk while its
 * runtime is still live registers nodes that are still in the picker — and it
 * is precisely the state AC3 asks about.
 */
export function joinKitNodes(
  kits: ProjectNodeKit[],
  moduleNodes: Array<{ name: string; items: unknown[] }> | undefined | null
): { kits: Array<ProjectNodeKit & { nodes: string[] }>; orphans: Array<{ name: string; nodes: string[] }> } {
  const byName = new Map<string, string[]>();
  for (const group of moduleNodes || []) {
    if (!group || typeof group.name !== 'string') continue;
    const items = (group.items || []).filter((i): i is string => typeof i === 'string');
    // Two groups with one name would be one kit's nodes split in two — union
    // them rather than letting the later one replace the earlier.
    const existing = byName.get(group.name);
    if (existing) existing.push(...items);
    else byName.set(group.name, items);
  }

  const claimed = new Set<string>();
  const joined = kits.map((kit) => {
    claimed.add(kit.displayName);
    return { ...kit, nodes: byName.get(kit.displayName) || [] };
  });

  const orphans = Array.from(byName.entries())
    .filter(([name]) => !claimed.has(name))
    .map(([name, nodes]) => ({ name, nodes }));

  return { kits: joined, orphans };
}

/**
 * §3's SSR/SSG trap: `globalThis.__noodl_modules` (read by
 * `packages/noodl-viewer-react/static/ssr/index.js:68`) is populated only by
 * `Noodl.defineModule` calls (`runtime-globals.js:33-36`). A library
 * registered through this file only ever assigns a `window` global — it never
 * calls `defineModule` — so it is invisible to every render that happens
 * server-side, regardless of what `runtimes` says. `runtimes` still gates
 * *whether the injector emits the script tag at all* — that filter is now
 * `buildInjectionTags` in `@nodegx/module-inject`; this is a second,
 * independent question — given that the tag IS emitted for this render, will
 * the code that reads the global work.
 */
export function libraryNeedsSsrWarning(lib: Pick<RegisteredLibrary, 'runtimes'>, deployRenderingMode: unknown): boolean {
  const isServerRendered = deployRenderingMode === 'ssr' || deployRenderingMode === 'ssg';
  return isServerRendered && lib.runtimes.includes('browser');
}

// ─── Inject-shaping layer ────────────────────────────────────────────────────
//
// The shaping and the tag strings are `@nodegx/module-inject`'s now (CN-001).
// This class stays because it is the *published* surface — `web-server.js` reaches
// it as `require(…).default.instance`, and the deploy HtmlProcessor and
// ViewerConnection both go through `instance.injectIntoHtml`. Its methods are
// the same two, with the same signatures and the same callback contract; only
// the bodies moved.

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
      callback(injectIntoTemplate(template, buildInjectionTags(modules, pathPrefix)));
    });
  }
}

ProjectModules.instance = new ProjectModules();

export default ProjectModules;
