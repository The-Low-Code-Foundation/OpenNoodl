#!/usr/bin/env ts-node
/**
 * LIB-001 — npm run library:verify-dist
 *
 * `library:check` grades the *sources* under `library/`. This grades the
 * *artefact* under `library-dist/`: it serves the built tree over HTTP exactly
 * where the editor expects to find it and then walks the editor's own install
 * path against it, headlessly.
 *
 * Why this exists: `library:build` succeeding proves the zips were written, not
 * that the editor could install one. Those are different claims — the index is
 * consumed by `ModuleLibraryModel.fetchModules` and `ModuleCard`, whose URL
 * construction, `type` keying and version tolerance live nowhere near
 * `build.js` and have drifted from it before.
 *
 * What it checks, per entry, mirroring the real call chain:
 *   1. `GET {endpoint}/library/{type}/index.json` — the exact URL
 *      `fetchModules` builds — is 200 and parses to an **array**.
 *   2. Every entry satisfies the `IModule` contract the cards destructure
 *      (`label`/`desc`/`project`/`icon`/`docs`/`tags`), so no card can throw on
 *      a missing field.
 *   3. `type` is the singular of the tab it was served from, and the legacy
 *      `project.includes('/prefab')` fallback in `ModuleCard` agrees with it —
 *      an entry where the two disagree would install down the wrong path on
 *      one editor version and the right one on another.
 *   4. `version`/`minEditorVersion`/`runtimeVersion` are semver triples, and
 *      `isModuleCompatible` — imported from the editor's own module, not
 *      re-implemented here — says the entry is installable by this editor.
 *   5. The `project` and `icon` URLs, resolved by `ModuleCard`'s own rule
 *      (`startsWith('http') ? url : endpoint + '/' + url`), are 200.
 *   6. The zip unpacks (via JSZip, as `filesystem.unzipUrl` does), contains a
 *      `project.json` where `getModuleTemplateRoot`'s recursive search would
 *      find one, and that directory loads through the SUB-006 project loader.
 *
 * The server also answers `/{major.minor}/version.json` with
 * `{"kind":"noodl-docs"}`, which is what `main.js` probes on 127.0.0.1:3000 to
 * decide to use a local docs endpoint. Run with `--port 3000 --serve` and this
 * script *is* the local docs stub a live editor needs for LIB-001's
 * Success Criterion 5.
 *
 * Usage:
 *   npm run library:verify-dist
 *   ts-node -P ./scripts/tsconfig.json ./scripts/library/verify-dist.ts [--dist <dir>] [--port <n>] [--serve] [--json]
 *
 * Exit codes: 0 = clean, 1 = a check failed, 2 = usage/IO error.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import JSZip from 'jszip';

import { loadProject } from '../../packages/noodl-editor/src/editor/src/validation/loadV2Project';
// ✅ CN-016 item 2. The editor's OWN kit lister and manifest scanner, called
// over each unpacked entry — not a twin of `manifestLooksLikeKit`, which is the
// mistake this repo has made before with fetch/parse contracts. Both import
// cleanly under plain Node (`projectmodules.ts` reaches only
// `@nodegx/module-inject`, `fs`, `http`, `https`, `vm` — no Electron, no
// webpack aliases), so what is reported below is literally what the Kits list
// will show after the entry is installed.
import { listNodeKits } from '../../packages/noodl-editor/src/shared/utils/projectmodules';
import { scanModuleManifests } from '@nodegx/module-inject';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODEL_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts');

const TYPES = ['prefabs', 'modules'] as const;
type LibraryType = (typeof TYPES)[number];

const argv = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
const DIST_DIR = path.resolve(argValue('--dist') || path.join(REPO_ROOT, 'library-dist'));
const PORT = Number(argValue('--port') || 0);
const SERVE_ONLY = argv.includes('--serve');
const AS_JSON = argv.includes('--json');

const EDITOR_VERSION: string = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'packages/noodl-editor/package.json'), 'utf8')
).version;

// ---------------------------------------------------------------------------
// The editor's own version logic, not a twin of it.
// ---------------------------------------------------------------------------

interface IModuleLike {
  label: string;
  desc: string;
  project: string;
  icon: string;
  docs: string;
  tags: string[];
  type?: 'prefab' | 'module';
  version?: string;
  minEditorVersion?: string;
  runtimeVersion?: string;
}

/** The env var the bundled `getDocsEndpoint` stub reads, set once the server is up. */
const ENDPOINT_ENV = 'NODEGX_LIBRARY_VERIFY_ENDPOINT';

/**
 * `modulelibrarymodel.ts` cannot be `require`d from Node: it resolves
 * `@noodl-utils/*` webpack aliases and pulls in the whole ImportFlow view tree.
 * Bundle it with every import replaced by a recursive no-op proxy — except the
 * three the checks actually depend on:
 *
 *   - `@noodl/platform` gets a real `getVersion`, so `isModuleCompatible`
 *     answers for the editor version this repo would ship;
 *   - `@noodl-utils/getContentEndpoint` **and** `@noodl-utils/getDocsEndpoint`
 *     point at this script's server, so `fetchModules` builds its URL from the
 *     local dist. 🔴 **Both, and that was a repair.** ALPHA-006 §5 split
 *     `getContentEndpoint` out of `getDocsEndpoint` (`307967a5`) and
 *     `fetchModules` moved to the new one; this stub list did not follow, so
 *     the real function fell through to the catch-all Proxy and
 *     `` `${endpoint}/library/…` `` threw *"Cannot convert object to primitive
 *     value"* on every entry. **The whole script had been failing since that
 *     split and nothing said so, because it is not in CI** — which is the
 *     argument for ✅ D21's divergence gate, demonstrated on this script itself;
 *   - `@noodl-utils/addHashToUrl` is the real one-liner, so the cache-buster
 *     is the editor's and not an approximation of it.
 *
 * Everything else is a proxy. Nothing in the module body runs at import time,
 * so the proxies are never touched — which is what makes it safe to call the
 * real `fetchModules` here instead of re-implementing its contract. The last
 * time this codebase kept a twin of a fetch/parse contract, the twin and the
 * original disagreed and only the twin was tested.
 */
function loadEditorModel(): {
  isVersionAtLeast(current: string, minRequired: string | undefined): boolean;
  isModuleCompatible(module: IModuleLike): boolean;
  ModuleLibraryModel: { prototype: { fetchModules(type: string): Promise<IModuleLike[]> } };
} {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-verify-'));
  const outfile = path.join(workDir, 'modulelibrarymodel.bundle.js');
  const stub = `
    // A plain function, not a class: a class's \`prototype\` is a non-writable
    // own property, and the proxy get-invariant then forbids returning the
    // stub for it. \`ModuleLibraryModel extends Model\` needs the stub to be
    // both constructible and freely gettable.
    const noop = new Proxy(function () {}, {
      get: () => noop,
      apply: () => noop,
      construct: () => new Proxy({}, { get: () => noop })
    });
    module.exports = new Proxy({ __esModule: true, default: noop }, {
      get: (target, key) => (key in target ? target[key] : noop)
    });
  `;
  const platformStub = `exports.platform = { getVersion: () => ${JSON.stringify(EDITOR_VERSION)} };`;
  // ESM, not `exports.default`: getDocsEndpoint is a default import, and
  // esbuild's CJS interop would hand back the exports object rather than the
  // function.
  const endpointStub = `export default () => process.env[${JSON.stringify(ENDPOINT_ENV)}];`;
  const hashStub = `exports.addHashToUrl = (url) => \`\${url}?\${new Date().getTime()}\`;`;

  // esbuild's JS API is only available in the repo root's node_modules; call it
  // through a tiny inline build script so this file stays ts-node-friendly.
  const buildScript = `
    const esbuild = require(${JSON.stringify(path.join(REPO_ROOT, 'node_modules/esbuild'))});
    // esbuild plugins require the async API.
    esbuild.build({
      entryPoints: [${JSON.stringify(MODEL_SRC)}],
      bundle: true, platform: 'node', format: 'cjs', outfile: ${JSON.stringify(outfile)},
      plugins: [{
        name: 'stub-all-but-entry',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === 'entry-point') return null;
            if (args.path === '@noodl/platform') return { path: args.path, namespace: 'stub-platform' };
            if (args.path === '@noodl-utils/getDocsEndpoint') return { path: args.path, namespace: 'stub-endpoint' };
            // ALPHA-006 §5 split this out of getDocsEndpoint and fetchModules
            // moved to it. Stubbing only the old name left the real one behind
            // the catch-all Proxy — see this function's header.
            if (args.path === '@noodl-utils/getContentEndpoint') return { path: args.path, namespace: 'stub-endpoint' };
            if (args.path === '@noodl-utils/addHashToUrl') return { path: args.path, namespace: 'stub-hash' };
            // ✅ CN-016 AC3. The compat RULE moved into this import-free leaf so
            // a plain-Node spec could reach it. Stubbing it would replace
            // isModuleCompatible's answer with a truthy Proxy — EVERY entry
            // would read as compatible and check 4 below would pass vacuously,
            // which is exactly how the getContentEndpoint stub failed silently.
            // Resolve it for real, and the self-test in main() proves it.
            if (/moduleCompatibility$/.test(args.path)) return null;
            return { path: args.path, namespace: 'stub-any' };
          });
          build.onLoad({ filter: /.*/, namespace: 'stub-platform' }, () => ({
            contents: ${JSON.stringify(platformStub)}, loader: 'js'
          }));
          build.onLoad({ filter: /.*/, namespace: 'stub-endpoint' }, () => ({
            contents: ${JSON.stringify(endpointStub)}, loader: 'js'
          }));
          build.onLoad({ filter: /.*/, namespace: 'stub-hash' }, () => ({
            contents: ${JSON.stringify(hashStub)}, loader: 'js'
          }));
          build.onLoad({ filter: /.*/, namespace: 'stub-any' }, () => ({
            contents: ${JSON.stringify(stub)}, loader: 'js'
          }));
        }
      }]
    }).catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
  `;
  execFileSync(process.execPath, ['-e', buildScript], { stdio: 'inherit' });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(outfile);
  if (
    typeof mod.isVersionAtLeast !== 'function' ||
    typeof mod.isModuleCompatible !== 'function' ||
    typeof mod.ModuleLibraryModel?.prototype?.fetchModules !== 'function'
  ) {
    throw new Error('bundled modulelibrarymodel did not export what the checks need');
  }
  return mod;
}

/**
 * `fetchModules` only reads module-scope imports, so it runs on a bare object.
 * Constructing a real ModuleLibraryModel would fire two background fetches and
 * race this script's own.
 */
function fetchModules(model: ReturnType<typeof loadEditorModel>, type: string): Promise<IModuleLike[]> {
  return model.ModuleLibraryModel.prototype.fetchModules.call({}, type);
}

// ---------------------------------------------------------------------------
// The static server: library-dist under /library, plus the local-docs marker.
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function startServer(): Promise<{ server: http.Server; endpoint: string }> {
  // `main.js` probes http://127.0.0.1:3000/<major.minor>/version.json and only
  // switches to the local endpoint when it answers kind === 'noodl-docs'.
  const docsMarkerPath = `/${EDITOR_VERSION.split('.').slice(0, 2).join('.')}/version.json`;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === docsMarkerPath) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ kind: 'noodl-docs', version: EDITOR_VERSION }));
      return;
    }

    // Two fixtures for the loud-failure self-test. A docs CDN answering 200
    // with an error body, or with a half-written file, are the two ways the
    // index can be "fetched successfully" and still be unusable.
    if (pathname === '/library/__notarray__/index.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'NoSuchKey' }));
      return;
    }
    if (pathname === '/library/__badjson__/index.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[{"label": "truncated"');
      return;
    }

    if (!pathname.startsWith('/library/')) {
      res.writeHead(404).end('not found');
      return;
    }

    // /library/<type>/<file>  ->  <dist>/<type>/<file>
    const rel = pathname.slice('/library/'.length);
    const file = path.join(DIST_DIR, rel);
    if (!file.startsWith(DIST_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'string' || addr === null) return reject(new Error('no address'));
      resolve({ server, endpoint: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const SEMVER = /^\d+\.\d+\.\d+$/;

interface EntryResult {
  type: LibraryType;
  label: string;
  problems: string[];
  /**
   * ✅ CN-016 item 2, and deliberately NOT `problems`. These are observations
   * about what an entry's payload turns out to be; none of them is grounds to
   * fail a build. CN-017 §9b is the cautionary case in this same area — a check
   * whose verdict blocked installs and false-negatived four working kits — and
   * the rule taken from it is that a check informs unless being wrong costs
   * less than being silent. Retyping library content is phase 65's LBR-006, not
   * this script's call to force.
   */
  notes: string[];
  /** What the payload actually contains, per the editor's own scanners. */
  payload?: { kits: number; iconsets: number; libraries: number; otherModules: number; components: number };
}

/** Mirrors `ModuleCard.handleDownload` / the icon style rule. */
function resolveUrl(endpoint: string, url: string): string {
  return url.startsWith('http') ? url : endpoint + '/' + url;
}

/** Mirrors `getModuleTemplateRoot.findProjectRoot`: the dir containing a project.json. */
function findProjectRoot(root: string): string | undefined {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    const names = fs.readdirSync(dir, { withFileTypes: true });
    if (names.some((d) => d.isFile() && d.name === 'project.json')) return dir;
    for (const d of names) if (d.isDirectory()) stack.push(path.join(dir, d.name));
  }
  return undefined;
}

/**
 * ✅ CN-016 item 2 — what an entry's payload actually IS, measured by calling
 * the editor's own scanners over the unpacked zip.
 *
 * `listNodeKits` is the function that populates Settings → Kits, so its answer
 * here is the answer the user will see after installing. `scanModuleManifests`
 * is `@nodegx/module-inject`'s own reader, so the iconset and ERG-002-library
 * counts come from the same manifests the editor reads rather than from a
 * second reading of the same files.
 */
async function describePayload(root: string, components: number): Promise<NonNullable<EntryResult['payload']>> {
  const kits = await listNodeKits(root);
  const scanned = await scanModuleManifests(root);
  let iconsets = 0;
  let libraries = 0;
  const kitDirs = new Set(kits.map((k) => k.dirName));
  let otherModules = 0;
  for (const s of scanned) {
    const m = s.manifest as { type?: string; kind?: string } | null;
    if (m?.type === 'iconset') iconsets++;
    else if (m?.kind === 'external-library') libraries++;
    else if (!kitDirs.has(s.name)) otherModules++;
  }
  return { kits: kits.length, iconsets, libraries, otherModules, components };
}

/**
 * 🔴 The one thing entry-level `type` actually decides, and why a `kit` value
 * would not belong in it.
 *
 * `type` in `library.json` is read in exactly one place — `ModuleCard`'s
 * `isPrefab` — and its sole behavioural consequence is
 * `keepExistingNonComponents` (`modulelibrarymodel.ts`), which is the DEFAULT
 * CONFLICT RESOLUTION for non-component collisions: a prefab install defaults
 * them to "keep yours", a module install defaults them to "overwrite". It is a
 * routing field, not a taxonomy field, and kit-ness is derived from the
 * payload's own manifests instead — see CN-016 item 2 for the full ruling.
 *
 * So the mistyping worth naming is not "a kit called a module". It is an entry
 * whose payload is components-only sitting in the modules tab, because that
 * entry installs with the overwrite default rather than the keep-yours one.
 */
function taxonomyNotes(entry: IModuleLike, payload: NonNullable<EntryResult['payload']>): string[] {
  const notes: string[] = [];
  const modules = payload.kits + payload.iconsets + payload.libraries + payload.otherModules;
  if (entry.type === 'module' && modules === 0 && payload.components > 0) {
    notes.push(
      `ships no noodl_modules/ at all — ${payload.components} component(s) and nothing else, which is ` +
        `prefab-shaped content in the modules tab. Its install therefore defaults non-component ` +
        `collisions to OVERWRITE rather than keep-yours (keepExistingNonComponents). ` +
        `Retyping library content is phase 65 LBR-006's call, not this gate's.`
    );
  }
  if (entry.type === 'prefab' && payload.kits > 0) {
    notes.push(
      `is typed "prefab" but its payload declares ${payload.kits} node kit(s) — installing it adds node ` +
        `types, which the "Clone" affordance does not suggest.`
    );
  }
  return notes;
}

async function checkEntry(
  endpoint: string,
  type: LibraryType,
  entry: IModuleLike,
  model: ReturnType<typeof loadEditorModel>
): Promise<EntryResult> {
  const problems: string[] = [];
  const notes: string[] = [];
  let payload: EntryResult['payload'];
  const label = entry.label || '(no label)';

  // 2. The fields the cards destructure unguarded.
  for (const field of ['label', 'desc', 'project', 'icon', 'docs'] as const) {
    if (typeof entry[field] !== 'string' || !entry[field]) {
      problems.push(`missing/empty "${field}" — ModuleCard destructures it unguarded`);
    }
  }
  if (!Array.isArray(entry.tags)) problems.push('"tags" is not an array');

  // 3. `type`, and agreement with the legacy substring fallback.
  const expected = type === 'prefabs' ? 'prefab' : 'module';
  if (entry.type !== expected) {
    problems.push(`"type" is ${JSON.stringify(entry.type)}, expected "${expected}" for the ${type} index`);
  }
  if (typeof entry.project === 'string') {
    const fallbackSaysPrefab = entry.project.includes('/prefab');
    if (fallbackSaysPrefab !== (expected === 'prefab')) {
      problems.push(
        `the legacy ModuleCard fallback (project.includes('/prefab')) disagrees with "type": ` +
          `fallback says ${fallbackSaysPrefab ? 'prefab' : 'module'}, type says ${expected}`
      );
    }
  }

  // 4. Version tolerance, via the editor's own helpers.
  for (const field of ['version', 'minEditorVersion', 'runtimeVersion'] as const) {
    const v = entry[field];
    if (v !== undefined && !SEMVER.test(v)) problems.push(`"${field}" is not an x.y.z triple: ${JSON.stringify(v)}`);
  }
  if (!entry.version) problems.push('no "version" — the cache-busting zip URL depends on it');
  if (!model.isModuleCompatible(entry as never)) {
    problems.push(
      `isModuleCompatible() is false for editor ${EDITOR_VERSION} ` +
        `(minEditorVersion ${entry.minEditorVersion}) — the card would render disabled`
    );
  }

  // 5. Asset URLs resolve.
  for (const field of ['project', 'icon'] as const) {
    if (typeof entry[field] !== 'string' || !entry[field]) continue;
    const url = resolveUrl(endpoint, entry[field]);
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) problems.push(`"${field}" URL ${url} -> ${res.status}`);
    else await res.arrayBuffer();
  }

  // 6. The zip unpacks to something the project loader accepts.
  if (typeof entry.project === 'string' && entry.project) {
    const res = await fetch(resolveUrl(endpoint, entry.project));
    if (res.ok) {
      const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-unzip-'));
      try {
        const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
        for (const name of Object.keys(zip.files)) {
          const file = zip.files[name];
          if (file.dir) continue;
          const dest = path.join(workDir, name);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, Buffer.from(await file.async('uint8array')));
        }
        const root = findProjectRoot(workDir);
        if (!root) {
          // getModuleTemplateRoot rejects with exactly this, and never installs.
          problems.push(
            'zip contains no project.json anywhere — getModuleTemplateRoot rejects "Not a valid component"'
          );
        } else {
          try {
            const project = loadProject(root);
            // A code module legitimately has zero components — it delivers node
            // types through noodl_modules/ instead. Only an entry with neither
            // is empty, and an empty entry installs "successfully" while adding
            // nothing to the project.
            const modulesDir = path.join(root, 'noodl_modules');
            const hasModules = fs.existsSync(modulesDir) && fs.readdirSync(modulesDir).length > 0;
            if (!project.components.length && !hasModules) {
              problems.push(
                'project loaded but has neither components nor noodl_modules/ — installing it adds nothing'
              );
            }
            payload = await describePayload(root, project.components.length);
            notes.push(...taxonomyNotes(entry, payload));
          } catch (err) {
            problems.push(`project failed to load: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        problems.push(`zip failed to unpack: ${(err as Error).message}`);
      } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }
  }

  return { type, label, problems, notes, payload };
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`No ${path.relative(REPO_ROOT, DIST_DIR)}/ — run \`npm run library:build\` first.`);
    process.exit(2);
  }

  const { server, endpoint } = await startServer();

  if (SERVE_ONLY) {
    console.log(`Serving ${path.relative(REPO_ROOT, DIST_DIR)}/ at ${endpoint}/library/`);
    console.log(`Local-docs marker at ${endpoint}/${EDITOR_VERSION.split('.').slice(0, 2).join('.')}/version.json`);
    console.log('The editor only probes 127.0.0.1:3000 — run with `--port 3000` for a live editor to pick this up.');
    console.log('Ctrl-C to stop.');
    return;
  }

  process.env[ENDPOINT_ENV] = endpoint;
  const model = loadEditorModel();
  const results: EntryResult[] = [];
  const indexProblems: string[] = [];

  try {
    // 0. The loud-failure self-test. LIB-001 step 0 replaced a silent `[]` with
    // loading/loaded/error + Retry; these two fixtures are the cases a plain
    // "did the fetch throw?" reading of that change would miss, so assert the
    // real fetchModules rejects on both. If it resolves, the search view sets
    // status 'loaded' with a non-array and renders nothing at all — no grid, no
    // spinner, no error, no Retry.
    for (const [fixture, what] of [
      ['__notarray__', '200 with a JSON object instead of an array'],
      ['__badjson__', '200 with truncated JSON']
    ] as const) {
      let rejection: unknown;
      let rejected = false;
      try {
        await fetchModules(model, fixture);
      } catch (err) {
        rejected = true;
        rejection = err;
      }
      if (!rejected) {
        indexProblems.push(`fetchModules resolved on ${what} — the library would render silently blank`);
      } else if (rejection instanceof TypeError) {
        // A rejection is only evidence if it came from the index. A TypeError
        // means the stubs are wrong and this "pass" would be vacuous — the
        // shape of green that looks identical to a real one.
        indexProblems.push(
          `self-test on ${what} rejected with a TypeError — the harness stubs are broken: ${rejection.message}`
        );
      }
    }

    // 0b. ✅ CN-016 AC3 — the compat helper must be DISCRIMINATING, not merely
    // present. `loadEditorModel` already asserts it is a function, which a
    // stubbed Proxy also satisfies while returning truthy for everything. An
    // absence assertion ("no entry is incompatible") is only worth reading
    // beside a signal known to fire, so make one fire.
    const impossible = { label: 'CN-016 self-test', minEditorVersion: '999.0.0' } as IModuleLike;
    if (model.isModuleCompatible(impossible)) {
      indexProblems.push(
        `self-test: isModuleCompatible() called an entry requiring editor 999.0.0 compatible with ` +
          `${EDITOR_VERSION} — the compat check is stubbed out and check 4 below is vacuous`
      );
    }
    if (!model.isModuleCompatible({ label: 'CN-016 self-test', minEditorVersion: '0.0.1' } as IModuleLike)) {
      indexProblems.push('self-test: isModuleCompatible() rejected an entry requiring editor 0.0.1 — the harness is wrong');
    }

    for (const type of TYPES) {
      // 1. The editor's own fetch+parse, against the local dist.
      let parsed: IModuleLike[];
      try {
        parsed = await fetchModules(model, type);
      } catch (err) {
        indexProblems.push(`${type}: fetchModules rejected: ${(err as Error).message}`);
        continue;
      }
      for (const entry of parsed) {
        results.push(await checkEntry(endpoint, type, entry, model));
      }
    }
  } finally {
    server.close();
  }

  const failed = results.filter((r) => r.problems.length > 0);

  if (AS_JSON) {
    console.log(JSON.stringify({ editorVersion: EDITOR_VERSION, indexProblems, results }, null, 2));
  } else {
    for (const type of TYPES) {
      const forType = results.filter((r) => r.type === type);
      console.log(
        `${type}: ${forType.length} entries, ${forType.filter((r) => r.problems.length).length} with problems`
      );
    }
    for (const p of indexProblems) console.log(`  INDEX  ${p}`);
    for (const r of failed) for (const p of r.problems) console.log(`  FAIL   [${r.type}] ${r.label}: ${p}`);
    // ✅ CN-016 item 2. Observations, not verdicts — they never touch the exit
    // code, and the census below is the whole population rather than a sample.
    for (const r of results) for (const n of r.notes) console.log(`  NOTE   [${r.type}] ${r.label}: ${n}`);
    const withPayload = results.filter((r) => r.payload);
    const census = {
      'declare node kits': withPayload.filter((r) => (r.payload as NonNullable<EntryResult['payload']>).kits > 0).length,
      'ship an iconset': withPayload.filter((r) => (r.payload as NonNullable<EntryResult['payload']>).iconsets > 0)
        .length,
      'ship both': withPayload.filter(
        (r) =>
          (r.payload as NonNullable<EntryResult['payload']>).kits > 0 &&
          (r.payload as NonNullable<EntryResult['payload']>).iconsets > 0
      ).length,
      'ship no modules at all': withPayload.filter(
        (r) =>
          (r.payload as NonNullable<EntryResult['payload']>).kits +
            (r.payload as NonNullable<EntryResult['payload']>).iconsets +
            (r.payload as NonNullable<EntryResult['payload']>).libraries +
            (r.payload as NonNullable<EntryResult['payload']>).otherModules ===
          0
      ).length
    };
    console.log(`\npayload census over all ${withPayload.length} entries (CN-016 item 2, by the editor's own scanners):`);
    for (const [what, n] of Object.entries(census)) console.log(`  ${String(n).padStart(3)}  ${what}`);
    console.log(
      indexProblems.length || failed.length
        ? `\nlibrary-dist is NOT installable-shaped.`
        : `\nlibrary-dist is installable-shaped for editor ${EDITOR_VERSION}: every index entry parses, ` +
            `resolves and unpacks to a loadable project.\n` +
            `This is NOT LIB-001 Criterion 5 — that needs a live editor install.`
    );
  }

  process.exit(indexProblems.length || failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(2);
});
