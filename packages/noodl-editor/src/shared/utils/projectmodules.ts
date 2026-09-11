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
  moduleRunsInCloud,
  readCloudModuleSources,
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
  CloudModuleSource,
  InjectModule,
  InjectionTags,
  ModuleBrowserManifest,
  ModuleManifest,
  ScannedModule
} from '@nodegx/module-inject';

// The scan itself, re-exported so `projectmodel.modules.ts` and the ERG-002
// surface below both keep calling `scanModuleManifests` from here.
export { scanModuleManifests };

// CN-013 — the cloud half of `runtimes`, through the same door. This file is
// still the one public surface (LIB-003); `moduleRunsInCloud` is the predicate
// `libraryNeedsSsrWarning` below is modelled on, and `readCloudModuleSources`
// is what `exporter/cloudFunctions.ts` puts in the cloud-function bundle.
export { moduleRunsInCloud, readCloudModuleSources };

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
 * The browser-shaped `vm` sandbox both source checks run in.
 *
 * 🔴 **Extracted, not copied.** `verifyLibrarySource` (ERG-002) and
 * `verifyKitSource` (CN-017) ask *different questions* of the same context, and
 * two hand-maintained copies of this object would drift exactly the way the two
 * `noodl_modules` scanners drifted before LIB-003 merged them — the second copy
 * would quietly lack whatever stub the first one grew.
 *
 * ⚠️ **This is a shape smoke test, not a security boundary.** A `vm` context is
 * not a sandbox in the security sense: `vm`'s own documentation says so, the
 * timeout is escapable, and nothing here stops a script that reaches the host
 * through a passed-in primordial. It exists to turn a *silent* `undefined` an
 * hour later into a named diagnosis at add time. No caller may describe a script
 * that survives it as safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createBrowserSandbox(): Record<string, any> {
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
  return sandbox;
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

  const sandbox = createBrowserSandbox();
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


// ─── CN-017: verifying a kit, and recording where it came from ───────────────

/**
 * What a kit source turned out to be. Distinguished shapes, not a boolean — the
 * same model as {@link LibraryVerifyResult}, and for the same reason: the useful
 * output of a check is *what went wrong and what to do*, and a caller that has
 * to regex a message string to find out is a caller that will get it wrong.
 */
export type KitVerifyOutcome =
  /** Ran, called `Noodl.defineModule`, and defined at least one node. */
  | 'defines-nodes'
  /** Ran cleanly and never called `Noodl.defineModule` — not a kit. */
  | 'no-define-module'
  /** Called `defineModule` with no `nodes` and no `reactNodes`. */
  | 'defines-no-nodes'
  /**
   * Never run. The module declares no local file to read — its code arrives from
   * a URL at runtime. 🔴 **Not a pass and not a failure**, and it has its own
   * name so that no surface can render it as either.
   */
  | 'not-checked'
  /** An ES-module build; a `<script>` tag cannot load it. */
  | 'es-module'
  /** A CommonJS (Node) build; a `<script>` tag cannot load it. */
  | 'commonjs'
  /** Threw while running. */
  | 'threw'
  /**
   * The manifest names a `main` that could not be read. 🔴 **The only outcome
   * that means there is no code to install** — every other failure is this
   * check's *opinion* about code that exists.
   */
  | 'unreadable';

export interface KitVerifyResult {
  ok: boolean;
  outcome: KitVerifyOutcome;
  /** Human-facing, and on failure it names the likely cause. Never a bare "false". */
  message: string;
  /** Node type names the script defined, in definition order. Empty on every failure. */
  nodes: string[];
}

/**
 * ✅ **D6 part 2, the kit-shaped half.** Run a kit's `index.js` in the browser
 * shaped sandbox and report what it actually defines.
 *
 * 🔴 **`verifyLibrarySource` cannot answer this question**, which was measured
 * rather than assumed: it requires a `globalName` (`'A global variable name is
 * required to verify a library.'`) and grades the script on whether that global
 * appeared. A kit declares no global at all — it calls `Noodl.defineModule` —
 * so every kit on earth fails that check for a reason that is not about the kit.
 *
 * 🔴 **The two evaluators that already run kit code cannot be called from here**,
 * also measured. `noodl-mcp/src/kitExtract/entry.js` is an esbuild *entry point*
 * for a child process (it `require`s `@noodl/runtime`, the viewer's node
 * register and a DOM shim, and bundles to `dist/kit-extract.cjs`) — there is no
 * function to import. `noodl-viewer-react/static/ssr/kit-modules.js` takes a
 * *deploy's `index.html`* and reads script tags out of it, which does not exist
 * at install time, and evaluates with a bare `new Function(source)()` in the
 * caller's own global scope — correct for a server render it controls, wrong for
 * a stranger's script inside the editor renderer.
 *
 * So what is reused is the *sandbox* ({@link createBrowserSandbox}, shared with
 * ERG-002 rather than copied) and the *question* — the `defineModule`-collecting
 * shim is `kitExtract/entry.js`'s, down to the recursive-noop `Proxy` base,
 * because kit code touches other members of the `Noodl` global at module scope.
 *
 * ⚠️ **`React` is a recursive noop here.** ✅ D19 put React in the runtime's gift
 * as a bare global, and the scaffold's own template opens with
 * `var h = React.createElement` — so without a stub every scaffolded kit would
 * fail verification with a `ReferenceError` that says nothing about the kit. The
 * cost is honest and worth stating: a kit that *calls* React at module scope and
 * depends on the result gets a noop, so this check grades **declaration shape,
 * not behaviour**.
 *
 * ⚠️ **This does not establish that a kit is safe, and no caller may say it
 * does.** A kit is arbitrary JavaScript with full page access; that is what makes
 * a custom node as capable as a built-in. What this buys is that the file is a
 * kit at all, in a browser build, and that its nodes can be named before the
 * user is asked to consent to any of it.
 */
export function verifyKitSource(code: string): KitVerifyResult {
  const sandbox = createBrowserSandbox();

  // The `kitExtract/entry.js` shim: everything on `Noodl` answers with a
  // recursive noop, except `defineModule`, which collects.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collected: any[] = [];
  const noop: unknown = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = { deployed: false, defineModule: (m: unknown) => collected.push(m) };
  sandbox.Noodl = new Proxy(base, { get: (t, k) => (k in t ? t[k as string] : noop) });
  sandbox.React = noop;

  const context = vm.createContext(sandbox);
  try {
    new vm.Script(code, { filename: 'kit-index.js' }).runInContext(context, { timeout: 5000 });
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
        outcome: 'es-module',
        message: `This kit could not be loaded (${message}). It looks like an ES-module build — a kit is loaded by a plain <script> tag, so it needs a browser (UMD/IIFE) build.`,
        nodes: []
      };
    }
    if (looksLikeCjs) {
      return {
        ok: false,
        outcome: 'commonjs',
        message: `This kit could not be loaded (${message}). It looks like a CommonJS (Node) build — a plain <script> tag has no "module"/"exports".`,
        nodes: []
      };
    }
    return {
      ok: false,
      outcome: 'threw',
      message: `This kit threw while loading: ${message}. It would register no nodes.`,
      nodes: []
    };
  }

  if (collected.length === 0) {
    return {
      ok: false,
      outcome: 'no-define-module',
      message:
        'This script ran but never called Noodl.defineModule, so it defines no nodes. It may be a plain library rather than a node kit.',
      nodes: []
    };
  }

  const nodes: string[] = [];
  for (const module of collected) {
    if (!module || typeof module !== 'object') continue;
    for (const list of [module.nodes, module.reactNodes]) {
      if (!Array.isArray(list)) continue;
      for (const definition of list) {
        // Named, never counted: a definition with no `name` cannot be registered
        // and a count would report it as though it could.
        const name = nodeDefinitionName(definition);
        if (name) nodes.push(name);
      }
    }
  }

  if (nodes.length === 0) {
    return {
      ok: false,
      outcome: 'defines-no-nodes',
      message:
        'This kit called Noodl.defineModule but defined no named nodes, so nothing would appear in the picker.',
      nodes: []
    };
  }

  return {
    ok: true,
    outcome: 'defines-nodes',
    message: `Defines ${nodes.length} node${nodes.length === 1 ? '' : 's'}: ${nodes.join(', ')}.`,
    nodes
  };
}

/**
 * The type name a kit node definition declares, across **both** shapes the
 * runtime accepts.
 *
 * 🔴 **Measured against the shipped library, after a first version of this read
 * only the bare shape and reported 10 working kits as defining no nodes.** The
 * runtime's own signature is the authority:
 * `nodes?: Array<NodeDefinitionOptions | { node: NodeDefinitionOptions }>`
 * (`noodl-runtime.ts`) — so `{ node: { name: 'data_context.context' } }` is as
 * valid as `{ name: 'Bar Chart' }`, and it is the shape most of the real library
 * uses. Reading only the outer `name` yields `undefined` for every one of them.
 *
 * ⚠️ **A `function` is refused rather than read.** One shipped kit
 * (`nodegx-qrcode`) puts a bare function in `reactNodes`, and `Function.prototype.name`
 * is a string — so a naive `typeof d.name === 'string'` would have promoted a
 * minified component's function name into a node type name. A definition is an
 * object or it is nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeDefinitionName(definition: any): string | null {
  // `typeof` excludes functions as well as primitives, which is the point.
  if (!definition || typeof definition !== 'object') return null;

  const wrapped = definition.node;
  const target = wrapped && typeof wrapped === 'object' ? wrapped : definition;

  const name = target.name;
  return typeof name === 'string' && name ? name : null;
}

/**
 * Does this module contribute JavaScript that a page will execute?
 *
 * 🔴 **Wider than "is it a kit", deliberately.** {@link manifestLooksLikeKit} is
 * subtractive and excludes an ERG-002 library — but a library module injects a
 * `<script>` tag into the same page with the same reach, so a consent gate that
 * covered kits and waved libraries through would be a hole in the shape of its
 * own definition. An iconset or a font module declares no `main` and no
 * dependencies and is not gated: it contributes no code.
 */
export function moduleDeclaresExecutableCode(m: ModuleManifest | null): m is ModuleManifest {
  if (!m) return false;
  if (typeof m.main === 'string' && m.main) return true;
  if (Array.isArray(m.dependencies) && m.dependencies.length > 0) return true;
  return false;
}

/** One executable module found in a directory, with what verification made of it. */
export interface ScannedExecutableModule {
  /** The `noodl_modules/<dirName>` folder name — the join key for a copy. */
  dirName: string;
  /** The manifest's own name, which is what every surface displays. */
  displayName: string;
  /**
   * ⚠️ **Always present, and `outcome: 'not-checked'` is a value rather than an
   * absence.** An optional field would leave "we did not look" and "there was
   * nothing to look at" indistinguishable from a missing assignment, and a
   * renderer would show the same blank for all three.
   */
  verification: KitVerifyResult;
}

/**
 * Every module in a project directory that would execute code, verified.
 *
 * ⚠️ **A module with no local `main` comes back `'not-checked'`, which is not
 * the same as passing.** An ERG-002 library whose source stays at a remote URL
 * has nothing on disk to run; fetching it here would turn an install into a
 * network call and would still only grade whatever the URL served *at that
 * moment*. The consent surface must render that outcome as "not checked" rather
 * than as silence — see {@link ScannedExecutableModule.verification}.
 */
export async function scanExecutableModules(sourceDirectory: string): Promise<ScannedExecutableModule[]> {
  const scanned = await scanModuleManifests(sourceDirectory);
  const found: ScannedExecutableModule[] = [];

  for (const entry of scanned) {
    const m = entry.manifest;
    if (!moduleDeclaresExecutableCode(m)) continue;

    const displayName = typeof m.name === 'string' && m.name ? m.name : entry.name;
    const mainFile = typeof m.main === 'string' && m.main ? m.main : null;
    if (!mainFile) {
      found.push({
        dirName: entry.name,
        displayName,
        verification: {
          ok: false,
          outcome: 'not-checked',
          message: 'Not checked: this module loads its code from a URL at runtime, so there is no file here to read.',
          nodes: []
        }
      });
      continue;
    }

    let code: string;
    try {
      code = await fs.promises.readFile(sourceDirectory + '/noodl_modules/' + entry.name + '/' + mainFile, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      found.push({
        dirName: entry.name,
        displayName,
        verification: {
          ok: false,
          outcome: 'unreadable',
          message: `The manifest names "${mainFile}", which could not be read: ${message}`,
          nodes: []
        }
      });
      continue;
    }

    found.push({ dirName: entry.name, displayName, verification: verifyKitSource(code) });
  }

  return found;
}

// ─── CN-017: the provenance record ───────────────────────────────────────────

/**
 * Where a kit came from.
 *
 * 🔴 **A discriminated union, not a record with a `verified` flag beside a
 * `source` field.** CN-017's own trap: `{source: 'local', verified: false}` reads
 * as *suspicious* and `{source: 'local', verified: true}` reads as a *lie*, and
 * both are wrong about the same kit. Here a local kit has no verification field
 * to misread, and an installed one **cannot be constructed without one**. This is
 * the third surface in this repo to reach the same shape independently —
 * `AskAboutNodeDialog`'s `postState` and `CommunityAccountState` are the others.
 *
 * 🔴 **This does not live in the kit's own `manifest.json`.** That file arrives
 * inside the archive, authored by the party being vouched for, so a kit could
 * ship `origin: 'local'` and be believed. Phase 67 closed a defect of exactly
 * that shape (a forgeable link, E8). The record is the *installing project's*,
 * written by the editor, and it is deliberately not carried by an export.
 */
export type KitProvenance =
  /** Scaffolded in this project. There is no verification field on this arm. */
  | { module: string; origin: 'local'; createdAt: string }
  /** Copied in from another project on this machine. Local code, no gate, no consent. */
  | { module: string; origin: 'imported'; fromProject: string; importedAt: string }
  /** Unpacked from a URL. Cannot exist without a verification result and a consent stamp. */
  | {
      module: string;
      origin: 'installed';
      url: string;
      installedAt: string;
      verification: KitVerifyResult;
      consentedAt: string;
    };

/**
 * The provenance file's path inside a project.
 *
 * ⚠️ **A plain file under `noodl_modules/`, and that placement is load-bearing**
 * — measured, not assumed. The one scanner enumerates `readdir` entries and keeps
 * only `isDirectory() || isSymbolicLink()` (`module-inject/src/index.js:126-133`),
 * and the import engine's `listModules` keeps only entries carrying a
 * `manifest.json`, so this file is invisible to every existing reader and cannot
 * turn into a phantom module in a list or an import. It sits beside the kits it
 * describes, inside the project, and is therefore in the project's own git
 * history — LIB-006's `writeImportReport` reasoning, at a stable overwritten path
 * for the same reason.
 *
 * 🔴 **Nothing here writes outside the project.** CN-017's trap list names
 * `Connect` writing the real `~/.claude.json`; the module installer already
 * writes to `getUserDataPath()/library/`, which is a fact about the installer and
 * not about this record.
 */
export const KIT_PROVENANCE_FILE = 'noodl_modules/kit-provenance.json';

/**
 * Does this parsed object match one of {@link KitProvenance}'s arms *completely*?
 *
 * ⚠️ Written as three explicit shapes rather than a discriminator check plus
 * optional fields, because the whole point of the union is that an `installed`
 * record without a verification result **is not a record** — accepting a partial
 * one would put the contradiction back that the union exists to prevent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isKitProvenance(r: any): r is KitProvenance {
  if (!r || typeof r.module !== 'string' || !r.module) return false;
  if (r.origin === 'local') return typeof r.createdAt === 'string';
  if (r.origin === 'imported') return typeof r.fromProject === 'string' && typeof r.importedAt === 'string';
  if (r.origin === 'installed') {
    return (
      typeof r.url === 'string' &&
      typeof r.installedAt === 'string' &&
      typeof r.consentedAt === 'string' &&
      !!r.verification &&
      typeof r.verification.outcome === 'string' &&
      typeof r.verification.message === 'string'
    );
  }
  return false;
}

/** Every provenance record in a project. Missing, unreadable or malformed all read as none. */
export async function readKitProvenance(projectDirectory: string | undefined): Promise<KitProvenance[]> {
  if (!projectDirectory) return [];
  let raw: string;
  try {
    raw = await fs.promises.readFile(projectDirectory + '/' + KIT_PROVENANCE_FILE, 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[projectmodules] ${KIT_PROVENANCE_FILE} is not a list of records — ignoring it.`);
      return [];
    }
    // 🔴 Validated per ARM, not just "has a module and an origin". This file is
    // in the project's git history, so it goes through merges and hand-edits: an
    // `installed` record that lost its `verification` would crash
    // `describeKitOrigin` at render time, in a panel, on somebody else's machine.
    // A record that does not match its own arm is dropped with its name said.
    const kept: KitProvenance[] = [];
    for (const r of parsed) {
      if (isKitProvenance(r)) kept.push(r);
      else if (r && typeof r.module === 'string') {
        console.warn(`[projectmodules] ${KIT_PROVENANCE_FILE}: the record for "${r.module}" is malformed — ignoring it.`);
      }
    }
    return kept;
  } catch (error) {
    // Loud, never silent — this file's own contract, and the one shared by every
    // other reader in this module.
    console.warn(
      `[projectmodules] ${KIT_PROVENANCE_FILE} could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

/**
 * Record provenance for one or more modules, replacing any record they already had.
 *
 * ⚠️ **Last write wins per module, and never per file.** Reinstalling a kit from
 * a different URL must not leave the old origin standing beside the new one; and
 * a write that dropped the records of *other* kits would silently un-record them.
 */
export async function recordKitProvenance(
  projectDirectory: string | undefined,
  records: KitProvenance[]
): Promise<{ ok: boolean; message?: string }> {
  if (!projectDirectory) return { ok: false, message: 'No project is open.' };
  if (records.length === 0) return { ok: true };

  const existing = await readKitProvenance(projectDirectory);
  const replaced = new Set(records.map((r) => r.module));
  const next = [...existing.filter((r) => !replaced.has(r.module)), ...records];

  try {
    await fs.promises.mkdir(projectDirectory + '/noodl_modules', { recursive: true });
    await fs.promises.writeFile(
      projectDirectory + '/' + KIT_PROVENANCE_FILE,
      JSON.stringify(next, null, 2),
      'utf8'
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Drop the records for modules that are no longer on disk, and return what is left.
 *
 * ⚠️ Called by the surface that lists kits, so a kit removed and re-scaffolded
 * under the same name cannot inherit the origin of the kit it replaced.
 */
export function pruneKitProvenance(records: KitProvenance[], dirNamesOnDisk: string[]): KitProvenance[] {
  const onDisk = new Set(dirNamesOnDisk);
  return records.filter((r) => onDisk.has(r.module));
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

  /*
   * ✅ **CN-017 AC1, and the reason this line is a write and not a check.**
   * D6's first part is that a kit you scaffolded here runs with no prompt and no
   * gate, so nothing about this call may block, ask or verify. What it does do is
   * *say where the kit came from*, once, so the Kits panel can distinguish
   * "authored here" from "no record" instead of assuming the first.
   *
   * ⚠️ Best-effort on purpose: the kit is already on disk and correct, and a
   * failed record must never turn a successful scaffold into a reported failure.
   */
  const recorded = await recordKitProvenance(projectDirectory, [
    { module: result.kit.dirName, origin: 'local', createdAt: new Date().toISOString() }
  ]);
  if (!recorded.ok) {
    console.warn(`[projectmodules] could not record provenance for "${result.kit.dirName}": ${recorded.message}`);
  }

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
   * ✅ **CN-017 AC3.** Where this kit came from, when the project has a record of
   * it. Joined on {@link dirName}, which is what {@link KIT_PROVENANCE_FILE}
   * keys on — never on the display name, which two kits can share.
   *
   * ⚠️ **Absent is its own state and is not "local".** A kit that predates the
   * record, or one whose record was deleted, has no provenance; describing it as
   * locally authored would be a claim nothing on disk supports. See
   * {@link describeKitOrigin}, which is the only sanctioned way to put this on a
   * screen.
   */
  provenance?: KitProvenance;
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
   * Manifest `runtimes`, defaulted to `['browser']` when absent — the same
   * default the scanner, the injector and the headless extractor all apply.
   *
   * 🔴 Present so the Kits panel can say when a kit runs **nowhere**: this is the
   * one manifest field whose declaration can remove a kit from the only runtime
   * that loads kits (CN-012).
   *
   * ⚠️ **Optional on the type, always set by {@link listNodeKits}.** A row built
   * by hand — every test helper that fakes one — genuinely has nothing to say
   * here, and `effectiveKitRuntimes(undefined)` already resolves to the same
   * `['browser']` default this function writes. Absent therefore means "nobody
   * said", which `kitDiagnostics` treats as silence rather than as a fault.
   */
  runtimes?: string[];
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
function manifestLooksLikeKit(m: ModuleManifest | null): m is ModuleManifest {
  if (!m) return false;
  if (typeof m.main !== 'string' || !m.main) return false;
  if (m.kind === 'external-library') return false;
  if (m.type === 'iconset') return false;
  return true;
}

/** Every node kit installed in a project, in folder order. */
export async function listNodeKits(projectDirectory: string | undefined): Promise<ProjectNodeKit[]> {
  const scanned = await scanModuleManifests(projectDirectory);
  // CN-017 AC3. One read per listing, joined by folder name below.
  const provenanceByModule = new Map((await readKitProvenance(projectDirectory)).map((r) => [r.module, r]));
  const kits: ProjectNodeKit[] = [];

  for (const s of scanned) {
    const m = s.manifest;
    if (!manifestLooksLikeKit(m)) continue;

    const kit: ProjectNodeKit = {
      dirName: s.name,
      displayName: typeof m.name === 'string' && m.name ? m.name : s.name,
      main: String(m.main)
    };

    const provenance = provenanceByModule.get(s.name);
    if (provenance) kit.provenance = provenance;

    // Present-only, never defaulted: `version: '—'` or `version: '0.0.0'` would
    // put a number on screen that no kit on disk has ever said.
    const version = (m as Record<string, unknown>).version;
    if (typeof version === 'string' && version) kit.version = version;

    const typesVersion = (m as Record<string, unknown>).nodeKitTypes;
    if (typeof typesVersion === 'string' && typesVersion) kit.nodeKitTypes = typesVersion;

    // 🔴 CN-012. Carried because the Kits panel is where an author finds out that
    // a kit runs nowhere, and without this the panel cannot know: `runtimes` is
    // the only field on a manifest whose *declaration* removes the kit from the
    // one runtime that loads kits, and `kitDiagnostics` needs it to say so.
    //
    // ⚠️ Defaulted here, unlike `version` above, and the difference is deliberate:
    // an absent `version` is a number nobody stated, while an absent `runtimes`
    // has a settled meaning every other reader already applies — the scanner, the
    // injector and the extractor all read absent as `['browser']`.
    kit.runtimes = Array.isArray(m.runtimes) ? m.runtimes.map(String) : ['browser'];

    kits.push(kit);
  }

  return kits;
}


/**
 * How one screen should describe a kit's origin. **The only sanctioned renderer.**
 *
 * 🔴 **Shared because two surfaces showing the same kit two ways is the defect
 * CN-017 names against itself.** The property panel header and the Kits section
 * both put this on screen; if each phrased it, one of them would eventually say
 * something the record does not support.
 *
 * ⚠️ **Four states, all distinguishable, and none of them says "safe".** An
 * absent record renders as *"where this came from was not recorded"* rather than
 * as a locally-authored kit — collapsing those two is how a downloaded kit ends
 * up reading as one you wrote.
 *
 * ⚠️ **Attribution, never demotion** (P1, and CN-006b AC2's standing rule for
 * this row): nothing here is a warning, a badge or a caveat. It says where the
 * code came from, in the same voice as the rest of the byline.
 */
export function describeKitOrigin(provenance: KitProvenance | undefined): { label: string; title: string } {
  if (!provenance) {
    return {
      label: 'origin not recorded',
      title: 'This project has no record of where this kit came from. Kits installed before provenance was recorded, and kits added by hand, have none.'
    };
  }

  if (provenance.origin === 'local') {
    return { label: 'written here', title: `Scaffolded in this project on ${provenance.createdAt.slice(0, 10)}.` };
  }

  if (provenance.origin === 'imported') {
    return {
      label: 'imported from another project',
      title: `Copied in from ${provenance.fromProject} on ${provenance.importedAt.slice(0, 10)}.`
    };
  }

  // ⚠️ The verification line states what the check established and stops there.
  // "Verified" alone would be read as an assurance the check cannot give.
  const checked =
    provenance.verification.outcome === 'not-checked'
      ? 'Its code was not read before installing — it loads from a URL at runtime.'
      : `When installed, its code declared: ${provenance.verification.message}`;

  return {
    label: `installed from ${describeHost(provenance.url)}`,
    title: `Installed from ${provenance.url} on ${provenance.installedAt.slice(0, 10)}, with your agreement to run its code in this app. ${checked}`
  };
}

/** The host of a URL, for a byline that must fit on one line. Falls back to the whole string. */
function describeHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
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
