#!/usr/bin/env node
/**
 * LBR-003 — render every library entry and report what it actually draws.
 *
 * `library:check` proves an entry is *structurally* valid: it loads, its
 * references resolve, its fonts ship. It cannot tell you that a prefab draws
 * nothing, that its module never registers its node, or that the browser logs
 * an exception on mount. Nothing in `library/` had ever been rendered — the
 * whole shelf was verified by reading it.
 *
 * This is that missing half. For each entry it:
 *
 *   1. loads `project/` (legacy monolithic `project.json` or a v2 directory),
 *   2. materialises a scratch **v2** project — the only shape
 *      `render-from-disk.js` serves — carrying the entry's assets and its
 *      `noodl_modules` verbatim, so a module's own nodes register the way they
 *      do in a real viewer,
 *   3. adds a two-component **harness app** — an `/App` with a Router, and a
 *      `/Library Harness Page` holding a `Page` whose only child is an instance
 *      of the entry's showcase component. That is what a user does with a
 *      prefab, and it is the only shape in which the renderer's own
 *      blank-diagnosis means anything: rendering a bare component with no
 *      Router anywhere makes every entry report `no-start-page`, which is a
 *      fact about the harness and not about the entry,
 *   4. renders it headless and records elements drawn, texts, broken images,
 *      placeholder strings and the blank-diagnosis the harness already owns.
 *
 * Usage:
 *   node scripts/library/render-check.js                 # every entry
 *   node scripts/library/render-check.js prefabs/table    # one, or several
 *   node scripts/library/render-check.js --type modules
 *   node scripts/library/render-check.js --json > report.json
 *   node scripts/library/render-check.js --shots <dir>    # keep the PNGs
 *
 * Exit codes: 0 = every entry rendered something, 1 = at least one entry drew
 * nothing or threw, 2 = usage/IO error.
 *
 * ⚠️ Serial on purpose. Each entry starts its own headless Chrome; running
 * these in parallel on a dev box competes with whatever else holds the CPU.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { withRenderedPage } = require('../devtools/render-report');

/**
 * The probe, as a string because it runs in the page.
 *
 * ⚠️ **Why not `renderReport`'s own measurement.** It calls a page blank when it
 * finds no text and no images — a definition written for *pages*, and wrong for
 * this shelf: a Toggle Switch is two coloured boxes, a Progress Circle is an
 * SVG arc, a Rating is five glyphs. Measuring the library through it reports a
 * correct prefab as an error and teaches you to ignore the column. What a
 * component library needs measured is **ink**: did anything reach the DOM with
 * a size and a colour. So this counts painted boxes and their area, and keeps
 * texts and images as extra evidence rather than as the whole test.
 */
const PROBE = `(() => {
  const ICON_CLASS = /\\b(material-icons|material-symbols|lucide|icon-[a-z0-9-]+|fa|fas|fab)\\b/;
  const root = document.getElementById('root') || document.body;
  const all = Array.from(root.querySelectorAll('*'));
  const seen = { elements: all.length, painted: 0, paintedArea: 0, texts: 0, images: 0,
                 brokenImages: 0, brokenSources: [], controls: 0, svg: 0, sample: [] };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const opaque = (c) => c && c !== 'transparent' && !/rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(c);
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    /**
     * An icon counts as ink even though it has no background, no border and no
     * text node: the glyph is a ::before rule on a webfont, so every test above
     * says the element is empty. Leaving it out made the Rating prefab measure
     * as drawing *nothing* at the exact moment its five stars started drawing
     * correctly — the fix read as a regression.
     */
    const isGlyph = ICON_CLASS.test(
      String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')
    );
    const inked =
      opaque(cs.backgroundColor) ||
      cs.backgroundImage !== 'none' ||
      (cs.borderStyle !== 'none' && parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0) ||
      cs.boxShadow !== 'none' ||
      (isGlyph && r.width > 0 && r.height > 0);
    if (inked && area > 0) { seen.painted++; seen.paintedArea += area; }
    if (el.tagName === 'IMG') {
      seen.images++;
      if (!el.complete || el.naturalWidth === 0) { seen.brokenImages++; seen.brokenSources.push(el.currentSrc || el.src); }
    }
    if (el.tagName === 'SVG' || el.tagName === 'svg') seen.svg++;
    if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(el.tagName)) seen.controls++;
    /**
     * The bounding box is of the *entry*, not of the harness page. A Group the
     * size of the viewport is the harness root (or a prefab's own full-bleed
     * wrapper, which tells you nothing either way), so anything covering
     * essentially the whole viewport is left out — otherwise every entry
     * measures 1280×900 and the column is a constant.
     */
    const fullBleed = r.width >= innerWidth * 0.98 && r.height >= innerHeight * 0.98;
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.nodeValue || '').trim()
    );
    if (area > 0 && !fullBleed && (inked || el.tagName === 'IMG' || hasOwnText)) {
      minX = Math.min(minX, r.left); minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right); maxY = Math.max(maxY, r.bottom);
    }
  }
  /**
   * An icon whose font never loaded does not disappear — the ligature falls
   * back to the literal glyph *name*, so a star renders as the word
   * "star_border". It is still "text on the page", so every count above reads
   * normal; only the width gives it away. A glyph is square-ish at its font
   * size, so anything more than three times as wide as it is tall is a word.
   */
  for (const el of all) {
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '');
    if (!ICON_CLASS.test(cls)) continue;
    const r = el.getBoundingClientRect();
    const text = (el.textContent || '').trim();
    seen.icons = (seen.icons || 0) + 1;
    if (r.height > 0 && r.width > r.height * 3 && /^[a-z0-9_-]{3,}$/i.test(text)) {
      seen.unrenderedIcons = seen.unrenderedIcons || [];
      if (seen.unrenderedIcons.length < 10) seen.unrenderedIcons.push({ cls: cls.slice(0, 40), text });
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    seen.texts++;
    if (seen.sample.length < 12) seen.sample.push(t.slice(0, 60));
  }
  seen.box = minX === Infinity ? null
    : { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
  return JSON.stringify(seen);
})()`;

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const TYPES = ['prefabs', 'modules'];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const shotsDir = valueOf('--shots');
const onlyType = valueOf('--type');
/** Render a named component instead of the entry's front door — an entry may ship several. */
const forceComponent = valueOf('--component');
const viewportSpec = valueOf('--viewports') || 'desktop';
const requested = argv.filter((a, i) => !a.startsWith('--') && !isValueOf(argv[i - 1]));

function valueOf(name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}
function isValueOf(a) {
  return ['--shots', '--type', '--viewports', '--component'].includes(a);
}
/** Human progress goes to stderr so `--json` stdout stays a single document. */
function note(msg) {
  if (!asJson) console.log(msg);
  else console.error(msg);
}

// ---------------------------------------------------------------------------
// Reading an entry — the two project shapes
// ---------------------------------------------------------------------------

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listEntries() {
  const out = [];
  for (const type of TYPES) {
    if (onlyType && type !== onlyType) continue;
    const dir = path.join(LIBRARY_DIR, type);
    if (!fs.existsSync(dir)) continue;
    for (const slug of fs.readdirSync(dir).sort()) {
      const entryDir = path.join(dir, slug);
      if (!fs.statSync(entryDir).isDirectory()) continue;
      if (!fs.existsSync(path.join(entryDir, 'library.json'))) continue;
      out.push({ type, slug, id: `${type}/${slug}`, dir: entryDir });
    }
  }
  if (requested.length === 0) return out;
  const wanted = new Set(requested.map((r) => r.replace(/\/+$/, '')));
  return out.filter((e) => wanted.has(e.id) || wanted.has(e.slug));
}

/**
 * Both project shapes reduced to one list of `{ name, roots, connections, ports }`,
 * where `roots` are NESTED legacy nodes. That is the shape the v2 writer below
 * flattens, and the shape `render-from-disk.js` re-nests on the other side —
 * so a legacy entry and a v2 entry reach the renderer identically.
 */
function readComponents(projectDir) {
  const legacyFile = path.join(projectDir, 'project.json');
  const v2File = path.join(projectDir, 'nodegx.project.json');

  if (fs.existsSync(v2File)) {
    const project = readJSON(v2File);
    const componentsDir = path.join(projectDir, project.structure?.componentsDir || 'components');
    const registry = readJSON(path.join(componentsDir, '_registry.json'));
    const components = [];
    for (const key of Object.keys(registry.components)) {
      const dir = path.join(componentsDir, registry.components[key].path);
      const meta = readJSON(path.join(dir, 'component.json'));
      const nodesFile = readJSON(path.join(dir, 'nodes.json'));
      const connFile = fs.existsSync(path.join(dir, 'connections.json'))
        ? readJSON(path.join(dir, 'connections.json'))
        : { connections: [] };
      const flat = nodesFile.nodes || [];
      const byId = new Map(flat.map((n) => [n.id, n]));
      const childIds = new Set();
      flat.forEach((n) => (n.children || []).forEach((c) => childIds.add(c)));
      const nest = (node) => {
        const { parent, children, ...rest } = node;
        const kids = (children || []).map((id) => byId.get(id)).filter(Boolean).map(nest);
        return kids.length ? { ...rest, children: kids } : { ...rest };
      };
      components.push({
        name: meta.path || '/' + key,
        roots: flat.filter((n) => !childIds.has(n.id)).map(nest),
        connections: connFile.connections || [],
        ports: nodesFile.ports,
        metadata: nodesFile.metadata
      });
    }
    return { project, components, wasV2: true };
  }

  if (!fs.existsSync(legacyFile)) return null;
  const project = readJSON(legacyFile);
  const components = (project.components || []).map((c) => ({
    name: c.name,
    roots: (c.graph && c.graph.roots) || [],
    connections: (c.graph && c.graph.connections) || [],
    ports: c.ports,
    metadata: c.metadata
  }));
  return { project, components, wasV2: false };
}

// ---------------------------------------------------------------------------
// Writing the scratch v2 project
// ---------------------------------------------------------------------------

/** A component path is a directory path; only the leading slash has to go. */
function componentDirName(name) {
  return String(name).replace(/^\/+/, '');
}

/**
 * 🔴 The export contract for a Function node's ports, without which this whole
 * harness measures itself.
 *
 * A `JavaScriptFunction` node's `out-Foo` ports are **dynamic**. Three things
 * produce them and only one of them is in the file on disk:
 *
 *   - in the **editor**, `simplejavascript.ts`'s `setup()` parses the script and
 *     pushes the ports back — and it returns early unless
 *     `context.editorConnection.isRunningLocally()`, so it never runs here;
 *   - on **export**, `exportNode` writes `ports: exportPorts(node)` from that
 *     live editor session, and `cloudFunctions.ts`'s `withScriptPorts` is the
 *     backstop for when it has not run;
 *   - on **disk**, the project stores them as `dynamicports`, which
 *     `nodemodel.ts` does not read: a deployed node's `outputPorts` come only
 *     from `nodeData.ports`.
 *
 * Feed the stored graph to the runtime unchanged and every signal output is
 * missing, `_isSignalType` is false, no callable is installed, and
 * `Outputs.Changed()` throws `Outputs.Changed is not a function` — in a script
 * that has always been correct. That is the same failure `cloudFunctions.ts`
 * documents measuring live on 2026-08-29.
 *
 * The first sweep of this harness reported exactly that against four prefabs
 * (table, form, filters, pagination) and it was **this file's** defect, not
 * theirs: an A/B whose simplest arm was a Function calling `Outputs.Done()` on
 * its own run threw identically, and no library content can explain that.
 * `--self-test` re-runs that arm.
 */
const SIGNAL_CALL = /Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/g;
const SIGNAL_CALL_INDEXED = /Outputs\s*\[\s*(?:'|")([A-Za-z0-9_]+)(?:'|")\s*\]\s*\(\s*\)/g;

function scriptSignalPorts(node) {
  if (node.type !== 'JavaScriptFunction' && node.type !== 'Javascript2') return [];
  const params = node.parameters || {};
  const script = params.functionScript || params.script || params.code;
  if (typeof script !== 'string') return [];
  const names = new Set();
  for (const m of script.matchAll(SIGNAL_CALL)) names.add(m[1]);
  for (const m of script.matchAll(SIGNAL_CALL_INDEXED)) names.add(m[1]);
  return [...names].map((name) => ({
    name: `out-${name}`,
    displayName: name,
    plug: 'output',
    type: 'signal',
    group: 'Outputs'
  }));
}

/** `ports` as an export would have written it: what is stored, plus what the script declares. */
function exportedPorts(node) {
  const have = new Map();
  for (const p of [...(node.ports || []), ...(node.dynamicports || [])]) {
    if (p && p.name) have.set(`${p.plug} ${p.name}`, p);
  }
  for (const p of scriptSignalPorts(node)) {
    const key = `${p.plug} ${p.name}`;
    // A stored port wins — including one the author retyped away from `signal`.
    if (!have.has(key)) have.set(key, p);
  }
  return [...have.values()];
}

function flatten(roots) {
  const flat = [];
  const walk = (nodes, parent) => {
    for (const node of nodes || []) {
      const { children, ...rest } = node;
      const out = { ...rest };
      const ports = exportedPorts(node);
      if (ports.length) out.ports = ports;
      if (parent !== undefined) out.parent = parent;
      if (children && children.length) out.children = children.map((c) => c.id);
      flat.push(out);
      if (children && children.length) walk(children, node.id);
    }
  };
  walk(roots, undefined);
  return flat;
}

/** Everything in the entry's `project/` that is not the graph itself. */
function copyAssets(from, to) {
  for (const name of fs.readdirSync(from)) {
    if (name === 'project.json' || name === 'nodegx.project.json' || name === 'components') continue;
    fs.cpSync(path.join(from, name), path.join(to, name), { recursive: true });
  }
}

const STARTER_MODULES = path.join(
  REPO_ROOT,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules'
);

/**
 * 🔴 The control that decides what a missing icon *means*.
 *
 * An entry is installed into somebody's project, and a project made by this
 * editor is not empty: `starterAssets.ts` seeds it with Inter and the Lucide
 * icon set (POL-006). Rendering an entry into a bare directory therefore fails
 * every icon in the library — Lucide and Material alike — and the report reads
 * "everything is broken", which is a fact about the harness.
 *
 * Seeding the starter modules first is what separates the two: a **Lucide**
 * glyph now resolves, so a glyph that still renders as its own ligature name is
 * an entry naming an icon set the user does not have. Without this line the
 * material-icons finding below would be unfalsifiable.
 *
 * The entry's own `noodl_modules` are copied *after* this, so an entry that
 * ships an icon set of its own still wins.
 */
function seedStarterModules(to) {
  if (!fs.existsSync(STARTER_MODULES)) return false;
  fs.cpSync(STARTER_MODULES, path.join(to, 'noodl_modules'), { recursive: true });
  return true;
}

/**
 * The entries a declared `dependencies` list pulls in, transitively.
 *
 * 🔴 **Why the render path needs this at all.** LBR-007 gave the library a real
 * `dependencies` field, resolved at build time and installed by
 * `ModuleLibraryModel._installWithDependencies`. That is the INSTALL path. This
 * harness builds its scratch project straight from the entry's own `project/`,
 * so without this it renders an entry as nobody will ever have it — and an
 * instance of a node type the dependency registers does not draw nothing, it
 * THROWS (`noderegister.ts`: "Unknown node type with name ..."). A gate blind to
 * the mechanism it is meant to protect is the hole shaped like the defect: it
 * would have reported `pdf-viewer` — the entry the whole mechanism exists for —
 * as broken forever, or passed it for the wrong reason.
 *
 * Resolution is deliberately tolerant here: a slug that does not exist on disk
 * is skipped rather than thrown on, because `build.js::resolveDependencies` is
 * the authority that FAILS on a bad slug, and a second copy of that rule in a
 * reporting tool would only drift. Cycles terminate on `seen`.
 */
function resolveEntryDependencies(entryDir) {
  const out = [];
  const seen = new Set();
  const queue = [entryDir];
  while (queue.length) {
    const dir = queue.shift();
    const meta = readJSON(path.join(dir, 'library.json'));
    for (const slug of (meta && meta.dependencies) || []) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const depDir = path.join(REPO_ROOT, 'library', slug);
      const depProject = path.join(depDir, 'project');
      if (!fs.existsSync(depProject)) continue;
      out.push({ slug, dir: depDir, project: depProject });
      queue.push(depDir);
    }
  }
  return out;
}

const HARNESS_PAGE = '/Library Harness Page';
const HARNESS_APP = '/App';

/**
 * The two components that turn a component library into an app: a Router that
 * selects one page, and a page whose only child is the entry under test. Both
 * carry ids nothing in `library/` can collide with.
 */
function harnessComponents(showcaseName) {
  return [
    {
      name: HARNESS_APP,
      roots: [
        {
          id: 'lrc-app-root',
          type: 'Group',
          label: 'Harness root',
          parameters: {
            sizeMode: 'explicit',
            width: { value: 100, unit: '%' },
            height: { value: 100, unit: '%' }
          },
          x: 40,
          y: 40,
          children: [
            {
              id: 'lrc-router',
              type: 'Router',
              label: 'Main',
              parameters: { name: 'Main', pages: { startPage: HARNESS_PAGE, routes: [HARNESS_PAGE] } },
              x: 40,
              y: 200
            }
          ]
        }
      ],
      connections: []
    },
    {
      name: HARNESS_PAGE,
      roots: [
        {
          id: 'lrc-page',
          type: 'Page',
          label: 'Harness',
          parameters: { title: 'Harness', urlPath: '' },
          x: 40,
          y: 40,
          children: [{ id: 'lrc-subject', type: showcaseName, label: 'Subject', x: 40, y: 200 }]
        }
      ],
      connections: []
    }
  ];
}

function writeV2Project({ project, components }, targetDir, rootNodeId) {
  fs.mkdirSync(targetDir, { recursive: true });
  const componentsDir = path.join(targetDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });

  const registry = { version: 1, components: {} };
  for (const c of components) {
    const key = componentDirName(c.name);
    const dir = path.join(componentsDir, key);
    fs.mkdirSync(dir, { recursive: true });
    const componentId = crypto.randomUUID();
    const flat = flatten(c.roots);
    const isCloud = /(^|\/)#?__cloud__(\/|$)/.test(c.name);

    fs.writeFileSync(
      path.join(dir, 'component.json'),
      JSON.stringify(
        {
          id: componentId,
          name: key.split('/').pop(),
          path: c.name,
          type: isCloud ? 'cloud' : 'visual',
          ...(c.metadata ? { metadata: c.metadata } : {})
        },
        null,
        2
      )
    );
    const nodesFile = { componentId, version: 1, nodes: flat };
    if (c.ports !== undefined) nodesFile.ports = c.ports;
    if (c.metadata !== undefined) nodesFile.metadata = c.metadata;
    fs.writeFileSync(path.join(dir, 'nodes.json'), JSON.stringify(nodesFile, null, 2));
    fs.writeFileSync(
      path.join(dir, 'connections.json'),
      JSON.stringify({ componentId, version: 1, connections: c.connections }, null, 2)
    );

    registry.components[key] = {
      path: key,
      type: isCloud ? 'cloud' : 'visual',
      nodeCount: flat.length,
      connectionCount: c.connections.length
    };
  }
  fs.writeFileSync(path.join(componentsDir, '_registry.json'), JSON.stringify(registry, null, 2));

  fs.writeFileSync(
    path.join(targetDir, 'nodegx.project.json'),
    JSON.stringify(
      {
        name: project.name || 'library entry',
        version: String(project.version || '4'),
        settings: project.settings || {},
        structure: { componentsDir: 'components', assetsDir: 'assets' },
        metadata: project.metadata || {},
        variants: project.variants,
        ...(rootNodeId ? { rootNodeId } : {})
      },
      null,
      2
    )
  );
}

// ---------------------------------------------------------------------------
// Which component is the entry's front door?
// ---------------------------------------------------------------------------

/**
 * A prefab ships one public component plus its parts; a module ships a demo
 * beside the node it registers. Rendering "whichever sorts first" measures a
 * sub-part — a Table's `Base Cell` draws one empty div and says nothing about
 * the Table. So the pick is, in order:
 *
 *   1. a component named for the entry's label ("Toggle Switch" → "/Toggle Switch"),
 *   2. an Example/Demo/Sample component — what a module ships to be looked at,
 *   3. the shallowest visual component that is not a child of another.
 *
 * `#`-prefixed folders are Noodl's convention for "hidden from the picker" and
 * `__cloud__` components have no visual surface at all; neither is a front door.
 */
/**
 * The node types the runtime itself reports as non-visual, read from the
 * generated structural catalog rather than re-listed here — a second copy of
 * "what draws" is the copy that goes stale, and this rule is what decides
 * whether an entry is reported as BLANK (a defect) or as having nothing to
 * draw (a fact about the entry).
 *
 * An UNKNOWN type counts as VISUAL. A module ships its own node types and they
 * are not in the core catalog, so filing an unknown as non-visual would demote
 * a real visual component to `no-visual` — that failure hides a broken entry,
 * which is the expensive direction to be wrong in. If the catalog cannot be
 * read at all the set is empty and the pick falls back to the old behaviour.
 */
const NON_VISUAL_TYPES = (() => {
  try {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../packages/noodl-types/src/node-catalog.json'), 'utf8')
    );
    const out = new Set();
    for (const n of Object.values(catalog.nodes || {})) {
      if (n && n.isVisual === false && n.typeName) out.add(n.typeName);
    }
    return out;
  } catch {
    return new Set();
  }
})();

/** Does this component contain a node that can put ink on the page? */
function drawsSomething(component) {
  return flatten(component.roots).some((n) => !NON_VISUAL_TYPES.has(n.type));
}

function pickShowcase(components, label) {
  const candidates = components.filter(
    (c) => !/(^|\/)#?__cloud__(\/|$)/.test(c.name) && c.roots.length > 0
  );
  if (candidates.length === 0) return undefined;

  // `roots.length > 0` counts NODES, not ink: a component of pure
  // JavaScriptFunction/CloudFunction2 logic has roots and renders blank. That
  // is why six logic-only entries (oauth2, supabase, totp, xano, media-query,
  // shake-detector) were reported as "drew nothing" on every sweep, and why two
  // of them hid a component that WOULD have drawn. Narrow to components that
  // actually contain a drawable node; if none does, the entry genuinely has
  // nothing to render and `no-visual` says so honestly.
  const visual = candidates.filter(drawsSomething);
  if (visual.length === 0) return undefined;

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = norm(label);

  const byLabel = visual.find((c) => norm(c.name.split('/').pop()) === wanted);
  if (byLabel) return byLabel;

  const demo = visual
    .filter((c) => /(example|demo|sample|showcase)/i.test(c.name))
    .sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
  if (demo) return demo;

  // Depth first, then "not obviously a part of a sibling": a component whose
  // name is a prefix of another's is the parent of that part.
  const sorted = [...visual].sort(
    (a, b) => a.name.split('/').length - b.name.split('/').length || a.name.localeCompare(b.name)
  );
  return sorted.find((c) => !/^\/#/.test(c.name)) || sorted[0];
}

// ---------------------------------------------------------------------------
// One entry
// ---------------------------------------------------------------------------

async function checkEntry(entry, scratchRoot) {
  const result = { entry: entry.id, type: entry.type, slug: entry.slug };
  const library = readJSON(path.join(entry.dir, 'library.json'));
  result.label = library.label;
  result.version = library.version;

  const projectDir = path.join(entry.dir, 'project');
  if (!fs.existsSync(projectDir)) {
    result.status = 'error';
    result.reason = 'no project/ directory';
    return result;
  }

  const loaded = readComponents(projectDir);
  if (!loaded) {
    result.status = 'error';
    result.reason = 'project/ holds neither project.json nor nodegx.project.json';
    return result;
  }
  result.components = loaded.components.length;

  const showcase = forceComponent
    ? loaded.components.find((c) => c.name === forceComponent)
    : pickShowcase(loaded.components, library.label);
  if (forceComponent && !showcase) {
    result.status = 'error';
    result.reason = `no component named "${forceComponent}" — has ${loaded.components.map((c) => c.name).join(', ')}`;
    return result;
  }
  if (!showcase) {
    result.status = 'no-visual';
    result.reason = 'entry declares no visual component — nothing to render';
    return result;
  }
  result.showcase = showcase.name;

  const target = path.join(scratchRoot, `${entry.type}-${entry.slug}`);
  fs.rmSync(target, { recursive: true, force: true });
  // A dependency's components join the project, but NOT the showcase pick above:
  // the entry is what is being measured, not the thing it leans on.
  const deps = resolveEntryDependencies(entry.dir);
  const depComponents = [];
  for (const dep of deps) {
    const depLoaded = readComponents(dep.project);
    if (!depLoaded) continue;
    for (const c of depLoaded.components) {
      const clash = loaded.components.some((x) => x.name === c.name) || depComponents.some((x) => x.name === c.name);
      if (!clash) depComponents.push(c);
    }
  }
  if (deps.length) result.dependencies = deps.map((d) => d.slug);

  const withHarness = {
    project: loaded.project,
    components: [...loaded.components, ...depComponents, ...harnessComponents(showcase.name)]
  };
  writeV2Project(withHarness, target, 'lrc-app-root');
  result.starterModules = seedStarterModules(target);
  // After the starter set and before the entry's own: a dependency's nodes
  // register, and an entry that ships its own copy of something still wins.
  for (const dep of deps) {
    const mods = path.join(dep.project, 'noodl_modules');
    if (fs.existsSync(mods)) fs.cpSync(mods, path.join(target, 'noodl_modules'), { recursive: true });
  }
  copyAssets(projectDir, target);
  result.scratch = target;

  const started = Date.now();
  try {
    await withRenderedPage({ projectDir: target }, async (session) => {
      await session.setViewport({ width: 1280, height: 900 });
      const raw = await session.evaluate(PROBE);
      Object.assign(result, JSON.parse(raw));
      result.consoleErrors = session.consoleErrors.slice(0, 8);
      if (shotsDir) {
        const shot = await session.client.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true
        });
        fs.mkdirSync(shotsDir, { recursive: true });
        const file = path.join(shotsDir, `${entry.type}-${entry.slug}.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
        result.screenshot = file;
      }
    });
    result.status = 'ok';
    result.durationMs = Date.now() - started;
    result.drew = result.painted > 0 || result.texts > 0 || result.images > 0 || result.svg > 0;
  } catch (err) {
    result.status = 'threw';
    result.reason = err.message;
    result.problems = err.problems;
  }
  return result;
}

// ---------------------------------------------------------------------------
// --self-test — does this harness reproduce the export contract?
// ---------------------------------------------------------------------------

/**
 * Three Function nodes, one render, and the only question that matters before
 * believing any row above: when this harness hands the runtime a graph, do
 * signal outputs work?
 *
 * `immediate` and `deferred` must pass — they are correct scripts, and if they
 * throw then every `Outputs.X()` in the library reads as broken for a reason
 * that has nothing to do with the library. `undeclared` must throw: a probe
 * whose floor passes cannot tell a working signal from a missing one, and this
 * one did not, for a whole sweep.
 */
async function selfTest(scratchRoot) {
  const arm = (id, script, ports) => ({ id, script, ports });
  const sig = { name: 'out-Done', displayName: 'Done', plug: 'output', type: 'signal', group: 'Outputs' };
  const res = { name: 'out-Result', displayName: 'Result', plug: 'output', type: '*', group: 'Outputs' };
  const body = (id, call) => `
try { ${call} Outputs.Result = '${id}: OK'; }
catch (e) { Outputs.Result = '${id}: THREW ' + e.message; }
`;
  const arms = [
    arm('immediate', body('immediate', 'Outputs.Done();'), [sig, res]),
    arm(
      'deferred',
      `Noodl.Events.on('st', () => {${body('deferred', 'Outputs.Done();')}});\nsetTimeout(() => Noodl.Events.emit('st'), 300);`,
      [sig, res]
    ),
    // No signal port and — deliberately — no `Outputs.Done()` the parser could
    // find, so neither route can mint one. `Outputs['Do' + 'ne']()` is the call.
    arm(
      'undeclared',
      `Noodl.Events.on('st2', () => {${body('undeclared', "Outputs['Do' + 'ne']();")}});\nsetTimeout(() => Noodl.Events.emit('st2'), 300);`,
      [res]
    )
  ];

  const nodes = [{ id: 'page', type: 'Page', children: [], parameters: { title: 'Self test', urlPath: '' } }];
  const connections = [];
  for (const a of arms) {
    nodes.push({
      id: `fn-${a.id}`,
      type: 'JavaScriptFunction',
      label: a.id,
      parameters: { functionScript: a.script, run: true },
      dynamicports: a.ports
    });
    nodes.push({ id: `txt-${a.id}`, type: 'Text', parameters: { text: `${a.id}: (nothing arrived)` } });
    nodes[0].children.push(`txt-${a.id}`);
    connections.push({ sourceId: `fn-${a.id}`, sourcePort: 'out-Result', targetId: `txt-${a.id}`, targetPort: 'text' });
  }

  const target = path.join(scratchRoot, 'self-test');
  writeV2Project(
    {
      project: { name: 'render-check self test', version: '4' },
      components: [
        ...harnessComponents('/Self Test'),
        { name: '/Self Test', roots: nest(nodes), connections }
      ]
    },
    target,
    'lrc-app-root'
  );

  let lines = [];
  await withRenderedPage({ projectDir: target }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    lines = JSON.parse(
      await s.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('*'))
        .map((e) => (e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent.trim() : ''))
        .filter((t) => /^(immediate|deferred|undeclared):/.test(t)))`)
    );
  });

  const want = { immediate: 'OK', deferred: 'OK', undeclared: 'THREW' };
  let ok = true;
  for (const [id, expected] of Object.entries(want)) {
    const line = lines.find((l) => l.startsWith(id + ':')) || `${id}: (never rendered)`;
    const got = line.includes(': OK') ? 'OK' : line.includes(': THREW') ? 'THREW' : '?';
    const pass = got === expected;
    ok = ok && pass;
    console.log(`  ${pass ? 'pass' : 'FAIL'}  ${line}${pass ? '' : `   (expected ${expected})`}`);
  }
  console.log(
    ok
      ? '\nSelf test passed — signal outputs reach the runtime, and a missing one still fails.'
      : '\nSelf test FAILED — every Outputs.X() finding below would be this harness, not the library.'
  );
  return ok;
}

/** The inverse of `flatten` — a flat `parent`/`children` list back to nested roots. */
function nest(flat) {
  const byId = new Map(flat.map((n) => [n.id, n]));
  const childIds = new Set();
  flat.forEach((n) => (n.children || []).forEach((c) => childIds.add(c)));
  const build = (node) => {
    const { children, ...rest } = node;
    const kids = (children || []).map((id) => byId.get(id)).filter(Boolean).map(build);
    return kids.length ? { ...rest, children: kids } : { ...rest };
  };
  return flat.filter((n) => !childIds.has(n.id)).map(build);
}

// ---------------------------------------------------------------------------

async function main() {
  if (argv.includes('--self-test')) {
    const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'library-render-'));
    process.exit((await selfTest(scratchRoot)) ? 0 : 1);
  }
  const entries = listEntries();
  if (entries.length === 0) {
    console.error('No library entries matched.');
    process.exit(2);
  }
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'library-render-'));
  const results = [];

  for (const entry of entries) {
    note(`… ${entry.id}`);
    // Serial: one headless Chrome at a time. See the header.
    // eslint-disable-next-line no-await-in-loop
    const r = await checkEntry(entry, scratchRoot);
    results.push(r);
    if (!asJson) {
      const bits = [];
      if (r.status === 'ok') {
        bits.push(r.drew ? `${r.box ? r.box.w + '×' + r.box.h : '?'}` : 'DREW NOTHING');
        bits.push(`${r.painted} painted`, `${r.texts} texts`);
        if (r.controls) bits.push(`${r.controls} controls`);
        if (r.images) bits.push(`${r.images} images`);
        if (r.brokenImages) bits.push(`${r.brokenImages} BROKEN`);
        if (r.consoleErrors.length) bits.push(`${r.consoleErrors.length} console error(s)`);
      } else {
        bits.push(r.reason || '');
      }
      console.log(`${r.status.toUpperCase().padEnd(9)} ${entry.id.padEnd(42)} ${bits.join('  ')}`);
    }
  }

  if (asJson) {
    process.stdout.write(JSON.stringify({ results }, null, 2) + '\n');
  } else {
    const drew = results.filter((r) => r.drew);
    const nothing = results.filter((r) => r.status === 'ok' && !r.drew);
    const broke = results.filter((r) => r.status === 'threw' || r.status === 'error');
    const noisy = results.filter((r) => (r.consoleErrors || []).length);
    console.log(
      `\n${results.length} entries — ${drew.length} drew something, ${nothing.length} drew nothing, ` +
        `${broke.length} failed to render, ${noisy.length} logged a console error.`
    );
    if (nothing.length) console.log(`  drew nothing: ${nothing.map((r) => r.entry).join(', ')}`);
    if (broke.length) console.log(`  failed: ${broke.map((r) => r.entry).join(', ')}`);
    if (noisy.length) console.log(`  console errors: ${noisy.map((r) => r.entry).join(', ')}`);
  }
  process.exit(
    results.some((r) => r.status === 'threw' || r.status === 'error' || (r.status === 'ok' && !r.drew)) ? 1 : 0
  );
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(2);
});
