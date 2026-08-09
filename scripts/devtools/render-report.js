#!/usr/bin/env node
/**
 * Render a v2 project headless and **measure** it. The eyes, as a module.
 *
 * `render-from-disk.js` serves the project; this drives a headless Chrome over
 * CDP, reads the DOM at each viewport, captures screenshots and returns one
 * report. Two clients import it: `measure-from-disk.js` (the CLI, for humans and
 * for the driving harnesses that found every real defect in phases 54 and 55)
 * and the `render_report` MCP tool (for agents, which additionally get the
 * screenshots back as image content so a multimodal model can *look*).
 *
 * ## Why this exists
 *
 * A graph is a claim, a render is evidence. Phase 55's audit measured the gap:
 * a strong model improvised most of a verification loop through sandboxed Bash,
 * curl-verified sixteen image URLs, and still shipped a photograph of a
 * motorcycle for a bud vase — because HTTP 200 is not looking. A mid-tier model
 * improvised nothing at all and shipped four cards reading the literal word
 * "Text". Neither failure is visible in the graph, and neither is reachable
 * through any other tool on the surface.
 *
 * ## Plain JS on purpose
 *
 * Everything here depends on repo layout — the sibling `render-from-disk.js`,
 * the built viewer bundle, the generated node catalog. A bundled artifact could
 * not run it anyway, so there is nothing to gain from compiling it and something
 * to lose: the CLI must keep working in a fresh checkout with no build step, the
 * way it did throughout the two phases that produced it. The MCP server locates
 * this file at runtime and reports its absence as an actionable error.
 *
 * @module scripts/devtools/render-report
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const RENDER_SCRIPT = path.join(__dirname, 'render-from-disk.js');
const VIEWER_BUNDLE = path.join(REPO, 'packages/noodl-editor/src/external/viewer/noodl.viewer.js');
const CATALOG_JSON = path.join(REPO, 'packages/noodl-types/src/node-catalog.json');
const WS_MODULE = path.join(REPO, 'node_modules', 'ws');

/** The two viewports phases 54–55 measured at. Phone is device emulation — Chrome will not open a real window under ~500px. */
const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true }
];

/** A viewport at least this wide is expected to lay content out in more than one column. */
const DESKTOP_WIDTH = 1024;

/**
 * When a stack of look-alike siblings is worth mentioning, and when it is a
 * footer.
 *
 * Calibrated against the three measured builds (2026-08-08), because the first
 * predicate — "≥3 identical siblings sharing one left edge" — fired on every
 * footer link list and every three-line paragraph block: 5 hits on
 * `ecommerce-example` and 4 on the replay this phase calls *correct*, against 2
 * true ones. What separates a grid that failed from a list that is a list is
 * that the items are big enough to have sat side by side:
 *
 * | build | group | verdict |
 * |---|---|---|
 * | haiku | 4 × `.column-item` 1248×450 | the defect |
 * | haiku | 3 × `.column-item` 1248×261 | the defect |
 * | haiku | 3 × 1168×**56** text rows | a paragraph — height |
 * | sonnet | 6 × 240×**17** in a 240px parent | footer links — height |
 * | ecommerce | 5 × 252×**15** in a 252px parent | footer links — height |
 * | sonnet | 3 × 1152×300 category banners | stacked **on purpose** — info only |
 *
 * So a `Columns` node that produced one column is a warning (the author asked
 * for a grid in the one node that makes grids, and did not get one), while
 * look-alike siblings are info at most: full-bleed banners stacked down the page
 * are a real design, and a warning that fires on one is a warning an agent
 * learns to ignore.
 */
const GRID_ITEM_MIN_HEIGHT = 120;
const GRID_ITEM_MIN_WIDTH = 300;
/** An item narrower than this share of its parent was never trying to be a column. */
const GRID_ITEM_PARENT_SHARE = 0.6;
/** A parent narrower than this share of the viewport is itself already a column. */
const GRID_PARENT_VIEWPORT_SHARE = 0.5;

// ── Placeholder strings, from the catalog rather than from memory ────────────

/**
 * Port names whose value is what the user reads on the page.
 *
 * The *defaults* come from the generated catalog; this set is the harness's own
 * judgement about which ports render as visible text, and it is the one thing
 * here that is not derived. Keep it small: a false member turns a legitimate
 * value ("none", "auto") into a reported defect.
 */
const TEXT_BEARING_PORTS = /^(text|label|placeholder|title|caption|heading)$/i;

/**
 * The strings a visual node shows when nobody told it what to say.
 *
 * Currently `Text` (Text.text), `Label` (six control nodes) and `Type here...`
 * (two text inputs). A page full of them is the signature of a component whose
 * instances set parameters that reach no input — the same defect
 * `interfaceless-instance` reports from the graph side, seen from the render
 * side, which is why {@link summarise} names that code in the finding.
 */
function placeholderStrings(catalogPath = CATALOG_JSON) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const found = new Set();
  for (const node of catalog.nodes || []) {
    if (!node.isVisual) continue;
    for (const port of node.inputs || []) {
      if (!TEXT_BEARING_PORTS.test(port.name)) continue;
      if (typeof port.default === 'string' && port.default.trim()) found.add(port.default.trim());
    }
  }
  return [...found];
}

// ── List probes: content the graph declares, looked for on the page ─────────

/**
 * LAS-012 §3 — the half of the report that could not see an empty list.
 *
 * Every other finding here is about content that is **present and wrong**: a
 * dead placeholder, a broken image, a box with a border and nothing in it. A
 * repeater that instantiates nothing emits no elements, so there is nothing to
 * count and nothing to judge. Haiku's session-6 build reported `0 errors` with
 * three of its five sections missing, and qwen's reported *"Rendered clean"* on
 * a page carrying one text element.
 *
 * ## What this can and cannot do, honestly
 *
 * Relating a DOM element to the graph node that produced it is not possible
 * today: the viewer stamps no node id on anything it renders, and
 * `window.Noodl` exposes only `_viewerReact.renderDeployed` — no runtime handle
 * to ask. Both routes are viewer changes plus a bundle rebuild, which is a
 * bigger and riskier task than this one, and the general check ("this `For Each`
 * produced zero children") waits for it.
 *
 * What is possible without either is to relate by **content**, which is what a
 * human checking the page does: when the graph says a list's rows contain the
 * words "Handmade Ceramic Bowl", those words must be somewhere on the page.
 *
 * So a probe is only built where the item data is knowable off disk and its
 * rendering is not conditional:
 *
 *  - an inline `items` array on the `For Each` itself — what a model writes when
 *    it has no backend, and all three of haiku's;
 *  - a `Static Data` node wired **directly** into `items`, its `json` parsed —
 *    the recipe library's shape and sonnet's.
 *
 * Anything through a `Filter Collection` or `Map Collection` is deliberately not
 * probed: a filter that matches nothing is a legitimately empty list and a map
 * may rewrite every string, so a probe there would report a working page as
 * broken. A query-fed repeater is not probed either, for the same reason. The
 * check abstains rather than guesses, and says so in the report's shape by
 * simply producing no probe.
 */
/**
 * A probe string has to be **distinctive**, and that is the whole difficulty.
 *
 * Measured on haiku's build: matching any readable item value found "Ceramics"
 * and "Coffee" in the section's own static copy and "Home" and "Shop" in the
 * nav, so two of three genuinely empty lists reported as rendered. A single
 * common word is not evidence that a list drew — it is evidence that the word is
 * on the page.
 *
 * Multi-word, or long. `"Handmade Ceramic Bowl"` and `"Medium roast, single
 * origin"` qualify; `"Shop"`, `"Home"` and `"£35.00"` do not. A probe with
 * nothing distinctive left **abstains** — it produces no probe at all rather
 * than a guess, which is why haiku's category and footer lists are not reported
 * here even though they are equally empty. The gate (`repeater-with-visual-
 * children`) is what catches those; this is the backstop for a list that passes
 * the gate and still draws nothing.
 */
const PROBE_MIN_WORDS = 2;
const PROBE_MIN_LENGTH = 8;
const PROBE_MIN_LENGTH_SINGLE_WORD = 12;
/** How many strings one probe carries. More is not more evidence. */
const PROBE_MAX_STRINGS = 6;

function isDistinctive(s) {
  if (/^[^A-Za-z]*$/.test(s)) return false; // prices, dates, ids
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words >= PROBE_MIN_WORDS) return s.length >= PROBE_MIN_LENGTH;
  return s.length >= PROBE_MIN_LENGTH_SINGLE_WORD;
}

/** A value a human would read on the page, rather than a URL, token or number. */
function readableStrings(items) {
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      if (typeof item === 'string' && isDistinctive(item.trim())) out.push(item.trim());
      continue;
    }
    for (const value of Object.values(item)) {
      if (typeof value !== 'string') continue;
      const s = value.trim();
      if (/^(https?:|data:|\/|#|var\()/.test(s)) continue;
      if (!isDistinctive(s)) continue;
      out.push(s);
    }
  }
  return [...new Set(out)];
}

/** A `Static Data` node's inline rows, or nothing if it holds none. */
function staticDataItems(node) {
  const p = node.parameters || {};
  if (Array.isArray(p.items)) return p.items;
  if (typeof p.json !== 'string' || !p.json.trim()) return null;
  try {
    const parsed = JSON.parse(p.json);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read a v2 project off disk once: the manifest, and every component's flat node
 * list with its connections and whatever `visualRoots` it declared.
 *
 * Both halves of this file want it — {@link listProbes} for the rows a repeater
 * declares, {@link blankDiagnosis} for the walk that answers *why* nothing is on
 * screen. Before AWP-003 only the first existed and read the project itself; a
 * second reader beside it would have been a second idea of what a component is,
 * which is the shape of defect this whole phase exists to close.
 *
 * `ok: false` for anything unreadable — an unreadable project is the render's
 * problem to report, not this function's.
 */
function readComponents(projectDir) {
  let project;
  try {
    project = JSON.parse(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf8'));
  } catch {
    return { ok: false, components: [] };
  }
  const componentsDir = path.join(projectDir, (project.structure && project.structure.componentsDir) || 'components');
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(path.join(componentsDir, '_registry.json'), 'utf8'));
  } catch {
    return { ok: false, project, components: [] };
  }

  const components = [];
  for (const key of Object.keys(registry.components || {})) {
    const dir = path.join(componentsDir, registry.components[key].path);
    try {
      const nodesFile = JSON.parse(fs.readFileSync(path.join(dir, 'nodes.json'), 'utf8'));
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'component.json'), 'utf8'));
      const connPath = path.join(dir, 'connections.json');
      components.push({
        name: meta.path || '/' + key,
        nodes: nodesFile.nodes || [],
        connections: fs.existsSync(connPath)
          ? JSON.parse(fs.readFileSync(connPath, 'utf8')).connections || []
          : [],
        // Absent and empty are different things and AWP-001 §3 turns on the
        // difference: `undefined` means nobody computed this, `[]` means a writer
        // did and found nothing. Carried through verbatim, decided in one place.
        declaredRoots: nodesFile.visualRoots
      });
    } catch {
      continue;
    }
  }
  return { ok: true, project, components };
}

/**
 * Read a v2 project off disk and build one probe per repeater whose rows are
 * knowable. Returns `[]` for anything it cannot read.
 */
function listProbes(projectDir) {
  const probes = [];

  for (const component of readComponents(projectDir).components) {
    const { name, nodes, connections } = component;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      if (node.type !== 'For Each') continue;
      const parameters = node.parameters || {};

      let items = Array.isArray(parameters.items) && parameters.items.length ? parameters.items : null;
      let source = 'inline items';
      if (!items) {
        // A Static Data node wired straight in — one hop, no transform.
        const feed = connections.find((c) => (c.toId ?? c.targetId) === node.id && (c.toProperty ?? c.targetPort) === 'items');
        const from = feed ? byId.get(feed.fromId ?? feed.sourceId) : undefined;
        if (from && from.type === 'Static Data') {
          items = staticDataItems(from);
          source = `Static Data "${from.label || from.id}"`;
        }
      }
      if (!items) continue;

      const strings = readableStrings(items).slice(0, PROBE_MAX_STRINGS);
      if (!strings.length) continue;

      probes.push({
        component: name,
        nodeId: node.id,
        label: node.label || node.id,
        rows: items.length,
        source,
        strings
      });
    }
  }
  return probes;
}

/**
 * AWP-004 §3 — the placeholders the catalog cannot know about.
 *
 * `placeholderStrings` covers the strings a *node type* shows when nobody set it:
 * `Text`, `Label`, `Type here...`. Kimi K3's page showed **Title / Body / Got
 * it**, `placeholders.count` was 0, and the reason is that none of the three is a
 * node-type default. Measured 2026-08-09: zero catalog defaults match any of
 * them. They are text the model hardcoded inside its own `NoticeDialog`
 * component.
 *
 * AWP-004 §3 assumed these were "the untouched defaults of a dialog component"
 * and that the catalog could answer for them. It cannot. **The project can**, and
 * the general form is sharper than the three strings:
 *
 * > a port that is hardcoded to a string **and** wired from `Component Inputs`
 *
 * has a value that is only ever seen when the input does not arrive. All three of
 * Kimi's are exactly that shape — `Component Inputs.title → Text.text` over a
 * hardcoded `"Title"`, and the same for `body` and `actionLabel`. So the strings
 * are derived from the graph rather than listed here, which is what §3 asks for
 * when it warns against over-fitting to the three it happened to name.
 *
 * This says nothing about *why* the input failed to arrive — that is the graph's
 * business, not the render's. It reports that the fallback is what a human sees.
 */
function overriddenDefaults(projectDir) {
  const found = new Map();
  for (const component of readComponents(projectDir).components) {
    const byId = new Map(component.nodes.map((n) => [n.id, n]));
    for (const conn of component.connections) {
      const from = byId.get(conn.sourceId ?? conn.fromId);
      const to = byId.get(conn.targetId ?? conn.toId);
      const port = conn.targetPort ?? conn.toProperty;
      if (!from || !to || from.type !== 'Component Inputs') continue;
      if (!TEXT_BEARING_PORTS.test(port)) continue;
      const hardcoded = (to.parameters || {})[port];
      if (typeof hardcoded !== 'string' || !hardcoded.trim()) continue;
      const key = hardcoded.trim();
      // Every site, not the first one seen: Kimi hardcodes "Title" in both
      // `TrustItem` and `NoticeDialog`, and a finding that named only one would
      // send an agent to fix a component that was never on screen.
      if (!found.has(key)) found.set(key, { sites: [] });
      found.get(key).sites.push({ component: component.name, nodeId: to.id, port });
    }
  }
  return found;
}

/** The sites of one overridden default, as a phrase a finding can end on. */
function describeSites(entry) {
  const sites = entry.sites || [];
  const named = sites.slice(0, 2).map((s) => `${s.port} in ${s.component}`);
  const rest = sites.length - named.length;
  return named.join(' and ') + (rest > 0 ? ` and ${plural(rest, 'other place', 'other places')}` : '');
}

// ── AWP-003: why is nothing on screen, answered from the graph ───────────────

/**
 * AWP-003 — a blank page must be **diagnosed**, not guessed at.
 *
 * The message this replaces named the two causes its author knew about — no
 * `Page` node at the root, no Router listing the route. DeepSeek V4 Pro had
 * neither: a correct `Page` node and a Router that listed it. It spent turns
 * 42→60 on `urlPath`, `startPage`, `clip` and `flexDirection`, about 30% of its
 * run and roughly $1.70, and at turn 60 deleted the Group holding its six
 * sections. **The message did not merely fail to help; it aimed the model at the
 * wrong subsystem and held it there.**
 *
 * Worse, it poisons the standard bisection. Both session-8 models reached for the
 * same probe — drop a Text somewhere and see if anything draws. Kimi added its
 * probe to the existing page, saw it render and fixed the real fault in four
 * turns. DeepSeek created a *new* component to hold its probe, which in the
 * pre-AWP-001 world was born without visual roots too, so its control rendered
 * blank as well and it concluded the viewer bundle needed rebuilding. It reasoned
 * correctly from a poisoned control. A diagnostic that defeats the bisection is
 * worse than none, because it turns a solvable problem into a confident wrong
 * answer.
 *
 * So this walks the project in the order a bisection would and reports **the
 * cause it determined and the component it is about**. Everything it needs is on
 * disk before a browser opens.
 *
 * ## It only ever explains an observed blank
 *
 * Nothing here raises a finding on its own. {@link summarise} calls it after the
 * DOM has already come back with zero texts and zero images, and the job is to
 * explain that, not to predict it. That is what keeps the last check honest: on a
 * page that renders, "no content-bearing node under the page root" would be a
 * claim about layout; on a page that measurably drew nothing it is the answer.
 *
 * ## Abstention is a result
 *
 * Without the enriched catalog there is no way to know which types draw, so the
 * walk reports `ok: false` and the finding says only what was measured. LAS-012
 * established abstention as the honest third state and this keeps to it — a
 * diagnosis guessed from a missing catalog is exactly the failure being fixed.
 */
const ENRICHED_CATALOG_JSON = path.join(REPO, 'packages/noodl-types/src/node-catalog-enriched.json');

const visualTypesCache = new Map();

/**
 * The set of node types that draw, **read** from the enriched catalog rather than
 * restated here.
 *
 * `render-from-disk.js` reads the same field for the same reason, and its header
 * records what paraphrasing an export contract cost: two phases of certifying a
 * page the editor could not render. `null` when the catalog is absent, which is a
 * checkout without a generated catalog and means this walk must abstain.
 */
function visualTypeNames(catalogPath = ENRICHED_CATALOG_JSON) {
  if (visualTypesCache.has(catalogPath)) return visualTypesCache.get(catalogPath);
  let names;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    names = new Set((catalog.nodes || []).filter((n) => n.isVisual === true).map((n) => n.typeName));
    if (names.size === 0) names = null;
  } catch {
    names = null;
  }
  visualTypesCache.set(catalogPath, names);
  return names;
}

/**
 * The types that show something of their own — words, a picture — as opposed to
 * the containers that only arrange whatever is inside them.
 *
 * Derived from the catalog the same way {@link placeholderStrings} is: a visual
 * type with a port whose value is what a human reads or looks at. A `Group` has
 * none and is a container; a `Text` has `text`; an `Image` has `src`. This is the
 * distinction that lets the walk say "this page draws containers and nothing
 * else" without a hand-kept list of container types going stale.
 */
const CONTENT_BEARING_PORTS = /^(text|label|placeholder|title|caption|heading|src|source|icon)$/i;

const contentTypesCache = new Map();

function contentBearingTypeNames(catalogPath = ENRICHED_CATALOG_JSON) {
  if (contentTypesCache.has(catalogPath)) return contentTypesCache.get(catalogPath);
  let names;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    names = new Set(
      (catalog.nodes || [])
        .filter((n) => n.isVisual === true && (n.inputs || []).some((p) => CONTENT_BEARING_PORTS.test(p.name)))
        .map((n) => n.typeName)
    );
    if (names.size === 0) names = null;
  } catch {
    names = null;
  }
  contentTypesCache.set(catalogPath, names);
  return names;
}

/**
 * The editor's own root rule: a node with no parent.
 *
 * `unflattenNodes` pushes exactly `v2Node.parent === undefined` onto its roots
 * list ([ProjectImporter.ts:133](../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts#L133)),
 * and `NodeGraphModel.toJSON` derives `visualRoots` from that set. Restating it
 * in this file is a paraphrase, so `derivationParity` in the noodl-mcp suite runs
 * this against the real `deriveVisualRootIds` over every fixture component — the
 * day the two disagree is a failing spec rather than a blank page.
 */
function rootNodes(nodes) {
  return (nodes || []).filter((n) => n.parent === undefined);
}

/** Every node in the subtree under `ids`, following the v2 `children` id lists. */
function subtreeNodes(nodes, ids) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const seen = new Set();
  const out = [];
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    out.push(node);
    for (const child of node.children || []) stack.push(child);
  }
  return out;
}

/**
 * Answers "does a node of this type draw?" for one project, including instances.
 *
 * A node's type is either a catalog type or the legacyName of a project
 * component. An instance draws exactly when the component it points at has visual
 * roots of its own, so the question is recursive — memoised, and cycle-guarded
 * because a component that instantiates itself is already invalid and a walk that
 * overflows the stack reports nothing about the valid graph beside it.
 */
function projectVisualPredicate(components) {
  const catalogVisual = visualTypeNames();
  const byName = new Map(components.map((c) => [c.name, c]));
  const memo = new Map();
  const inFlight = new Set();

  const isVisual = (typeName) => {
    if (catalogVisual && catalogVisual.has(typeName)) return true;
    if (!byName.has(typeName)) return false;
    if (memo.has(typeName)) return memo.get(typeName);
    if (inFlight.has(typeName)) return false;
    inFlight.add(typeName);
    const draws = effectiveRoots(byName.get(typeName), isVisual).length > 0;
    inFlight.delete(typeName);
    memo.set(typeName, draws);
    return draws;
  };
  return isVisual;
}

/** What the runtime will actually render this component from — AWP-001 §3's rule. */
function effectiveRoots(component, isVisual) {
  if (component.declaredRoots !== undefined) return component.declaredRoots;
  return rootNodes(component.nodes)
    .filter((n) => isVisual(n.type))
    .map((n) => n.id);
}

/** Blank-page causes, as codes a message and a test can both name. */
const BlankCause = {
  Unreadable: 'project-unreadable',
  NoCatalog: 'no-catalog',
  NoStartPage: 'no-start-page',
  StartPageMissing: 'start-page-missing',
  PageNotRouted: 'page-not-routed',
  PageWithoutPageNode: 'page-without-page-node',
  PageWithoutVisualRoot: 'page-without-visual-root',
  PageHasNoContent: 'page-has-no-content',
  InstancesWithoutVisualRoot: 'instances-without-visual-root',
  Undetermined: 'undetermined'
};

/**
 * Walk the project and determine why nothing drew.
 *
 * Returns `{ ok, cause, message, evidence, checked }`. `checked` is the list of
 * facts established on the way, so the finding can say what it *ruled out* — the
 * two guesses the old message led with live there now, as checked facts rather
 * than as possibilities.
 */
function blankDiagnosis(projectDir) {
  const { ok, project, components } = readComponents(projectDir);
  if (!ok || !components.length) {
    return {
      ok: false,
      cause: BlankCause.Unreadable,
      message: 'The project could not be read from disk, so there is nothing to diagnose against.',
      checked: []
    };
  }
  if (!visualTypeNames() || !contentBearingTypeNames()) {
    return {
      ok: false,
      cause: BlankCause.NoCatalog,
      message:
        'No generated node catalog in this checkout, so which node types draw is not knowable here and ' +
        'the cause was not determined.',
      checked: []
    };
  }

  const isVisual = projectVisualPredicate(components);
  const contentTypes = contentBearingTypeNames();
  const byName = new Map(components.map((c) => [c.name, c]));
  const checked = [];
  const done = (cause, message, evidence) => ({ ok: true, cause, message, evidence, checked });

  // 1. Routers and pages, read the way render-from-disk reads them.
  const routers = [];
  const pageComponents = new Set();
  for (const c of components) {
    for (const n of c.nodes) {
      if (n.type === 'Router') routers.push({ component: c.name, ...(n.parameters || {}) });
      if (n.type === 'Page') pageComponents.add(c.name);
    }
  }

  const routed = new Set();
  let startPage;
  for (const r of routers) {
    const pages = r.pages || {};
    for (const route of pages.routes || []) routed.add(route);
    if (!startPage && pages.startPage) startPage = pages.startPage;
  }

  if (!routers.length || !startPage) {
    return done(
      BlankCause.NoStartPage,
      routers.length
        ? `${plural(routers.length, 'Router', 'Routers')} in this project, and none names a startPage — ` +
            'nothing selects a page to show.'
        : 'No Router anywhere in the project, so no page is ever selected to be shown.',
      { routers: routers.map((r) => r.component) }
    );
  }
  checked.push(`a Router names "${startPage}" as its startPage`);

  const page = byName.get(startPage);
  if (!page) {
    return done(
      BlankCause.StartPageMissing,
      `The Router's startPage is "${startPage}" and no component of that name exists in the project.`,
      { component: startPage, known: [...byName.keys()] }
    );
  }

  if (!routed.has(startPage)) {
    return done(
      BlankCause.PageNotRouted,
      `"${startPage}" is the startPage but no Router lists it in its routes, so the route is never reached.`,
      { component: startPage, routes: [...routed] }
    );
  }
  checked.push('a Router lists it in its routes');

  if (!pageComponents.has(startPage)) {
    return done(
      BlankCause.PageWithoutPageNode,
      `"${startPage}" contains no Page node. A page component renders blank without one at its root.`,
      { component: startPage }
    );
  }
  checked.push('it has a Page node');

  // 2. The page's own visual roots.
  const pageRoots = effectiveRoots(page, isVisual);
  if (!pageRoots.length) {
    return done(
      BlankCause.PageWithoutVisualRoot,
      `"${startPage}" has no visual root — nothing in it is a node that draws, so the component renders nothing.`,
      { component: startPage }
    );
  }
  checked.push(`its visual root set is ${JSON.stringify(pageRoots)}`);

  // 3. Is there anything under those roots that shows something of its own? A
  //    tree of containers with no content is a page that draws no pixels, and it
  //    is the state DeepSeek's project was left in at turn 60.
  const drawn = subtreeNodes(page.nodes, pageRoots);
  const carriesContent = (node) =>
    contentTypes.has(node.type) || (byName.has(node.type) && componentDrawsContent(node.type));

  const seenComponents = new Set();
  function componentDrawsContent(name) {
    if (seenComponents.has(name)) return false; // cycle
    seenComponents.add(name);
    const c = byName.get(name);
    if (!c) return false;
    const nodes = subtreeNodes(c.nodes, effectiveRoots(c, isVisual));
    const answer = nodes.some((n) => contentTypes.has(n.type) || (byName.has(n.type) && componentDrawsContent(n.type)));
    seenComponents.delete(name);
    return answer;
  }

  if (!drawn.some(carriesContent)) {
    const only = drawn.map((n) => n.type);
    return done(
      BlankCause.PageHasNoContent,
      `Nothing under the visual root of "${startPage}" shows content of its own: it draws ` +
        `${plural(drawn.length, 'node', 'nodes')} (${[...new Set(only)].join(', ')}); nothing there is text, ` +
        'an image, or an instance that resolves to either. The page is an empty container.',
      { component: startPage, nodes: drawn.length, types: [...new Set(only)] }
    );
  }
  checked.push('it has content-bearing nodes under that root');

  // 4. F43's residual form: instances on the page that resolve to a component
  //    with nothing to draw. This is the check that was missing, and it must name
  //    the components — a finding that cannot say *which* forces exactly the
  //    manual bisection the old message sabotaged.
  const instanceTypes = [...new Set(drawn.filter((n) => byName.has(n.type)).map((n) => n.type))];
  const empty = instanceTypes.filter((t) => effectiveRoots(byName.get(t), isVisual).length === 0);
  if (empty.length) {
    return done(
      BlankCause.InstancesWithoutVisualRoot,
      `${plural(empty.length, 'component has', 'components have')} no visual root, so every instance of ` +
        `${empty.length === 1 ? 'it' : 'them'} on "${startPage}" renders nothing: ${empty.join(', ')}.`,
      { component: startPage, components: empty }
    );
  }

  return done(
    BlankCause.Undetermined,
    `Checked, and each held: ${checked.join('; ')}. The graph says this page should draw, so the cause is ` +
      'downstream of it — a runtime error, or content that reached the DOM and is not visible.',
    { component: startPage }
  );
}

// ── The browser-side measurement ────────────────────────────────────────────

/**
 * One expression, evaluated in the page. Returns raw numbers only — every
 * judgement about what they mean lives in {@link summarise}, on this side, where
 * it can be unit-tested without a browser.
 */
function measureExpression(placeholders, probes = []) {
  return `(() => {
  const PLACEHOLDERS = ${JSON.stringify(placeholders)};
  const PROBES = ${JSON.stringify(probes)};
  const round = (n) => Math.round(n);
  const cls = (el) => String(el.className || '').trim().slice(0, 60);
  const all = [...document.querySelectorAll('body *')];
  const visible = all.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const overflowing = visible
    .map((el) => ({ el, w: el.getBoundingClientRect().width }))
    .filter((x) => x.w > vw + 1)
    .map((x) => ({ tag: x.el.tagName, cls: cls(x.el), width: round(x.w) }));

  // AWP-004 — what is on screen, as opposed to what is in the DOM. The page is
  // never scrolled when this runs, so a rect is already a document position.
  // Kimi K3's storefront was 83 texts in the DOM and about three on screen, and
  // the report called it clean because every check it had was about content
  // present and wrong rather than content present and unreachable.
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  };

  // Below the fold is fine — that is what scrolling is for. Below the *scrollable
  // extent* is not: no scroll reaches it, so it is on the page and can never be
  // seen. Measured directly rather than inferred from a visible-count ratio,
  // because a correct 82-text page also shows only ~19 at a time and a ratio
  // cannot tell the two apart.
  const pageBottom = document.documentElement.scrollHeight;
  const unreachable = (el) => el.getBoundingClientRect().top >= pageBottom - 1;

  const textEls = visible.filter((el) => el.children.length === 0 && el.textContent.trim().length > 0);
  const fontWeights = {};
  const fontSizes = {};
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    fontWeights[cs.fontWeight] = (fontWeights[cs.fontWeight] || 0) + 1;
    fontSizes[cs.fontSize] = (fontSizes[cs.fontSize] || 0) + 1;
  }

  const dead = textEls.filter((el) => PLACEHOLDERS.includes(el.textContent.trim()));
  const byText = {};
  for (const el of dead) {
    const t = el.textContent.trim();
    byText[t] = (byText[t] || 0) + 1;
  }

  const emptyBoxes = visible.filter((el) => {
    const r = el.getBoundingClientRect();
    if (el.children.length !== 0 || el.textContent.trim() !== '') return false;
    if (r.width <= 8 || r.height <= 8) return false;
    const cs = getComputedStyle(el);
    return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderStyle !== 'none';
  });

  const images = visible.filter((el) => el.tagName === 'IMG');
  const brokenImages = images.filter((el) => el.complete && el.naturalWidth === 0);

  // Repeated sibling sets — a card grid, seen from the DOM. Two kinds:
  //   'columns' — a Columns node's own item wrappers (.column-item), so the
  //               author asked for a grid explicitly and we know it.
  //   'siblings' — identical-looking children of one parent, which is what a
  //               hand-laid or repeated card row looks like.
  // Grouping by parent, and by an identity signature within the parent, is what
  // separates a grid from an ordinary stack of page sections.
  const byParent = new Map();
  for (const el of visible) {
    const p = el.parentElement;
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(el);
  }
  const groups = [];
  const record = (parent, kids, kind) => {
    if (kids.length < 3) return;
    const rects = kids.map((k) => k.getBoundingClientRect());
    if (rects[0].width < 100) return;
    groups.push({
      kind,
      count: kids.length,
      columns: new Set(rects.map((r) => round(r.left))).size,
      rows: new Set(rects.map((r) => round(r.top))).size,
      itemWidth: round(rects[0].width),
      itemHeight: round(rects[0].height),
      parentWidth: round(parent.getBoundingClientRect().width),
      tag: kids[0].tagName,
      cls: cls(kids[0])
    });
  };
  for (const [parent, kids] of byParent) {
    const items = kids.filter((k) => k.classList && k.classList.contains('column-item'));
    if (items.length >= 3) {
      record(parent, items, 'columns');
      continue;
    }
    const bySignature = new Map();
    for (const k of kids) {
      const sig = k.tagName + '|' + cls(k) + '|' + k.querySelectorAll('*').length;
      if (!bySignature.has(sig)) bySignature.set(sig, []);
      bySignature.get(sig).push(k);
    }
    for (const set of bySignature.values()) record(parent, set, 'siblings');
  }

  // LAS-012 §3. Content the graph declares for a list, looked for on the page.
  //
  // Built from the visible leaf text elements, NOT \`document.body.textContent\`
  // — measured, not assumed: render-from-disk injects the whole project as
  // \`window.projectData\` in a <script> inside <body>, so body text contains
  // every items array verbatim and the first version of this check found all
  // six of haiku's missing strings on a page showing none of them.
  //
  // \`textContent\` is unaffected by text-transform, so an uppercased heading
  // still matches its source string.
  const pageText = textEls.map((el) => el.textContent).join('\\n');
  const lists = PROBES.map((p) => {
    const found = p.strings.filter((s) => pageText.indexOf(s) !== -1);
    return { ...p, found: found.length, missing: p.strings.filter((s) => found.indexOf(s) === -1).slice(0, 3) };
  });

  // How far down the page anything was actually laid out. A page pinned to the
  // viewport height with content laid out past it is clipped; a page that is
  // simply short has nothing past it. That difference is the whole of
  // \`clipped-page\`, and neither number alone can tell them apart.
  const contentBottom = visible.reduce((lowest, el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > lowest ? r.bottom : lowest;
  }, 0);

  return {
    lists,
    layoutWidth: window.innerWidth,
    clientWidth: vw,
    clientHeight: vh,
    scrollWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    contentBottom: round(contentBottom),
    overflowing: overflowing.slice(0, 10),
    overflowingCount: overflowing.length,
    text: {
      elements: textEls.length,
      onScreen: textEls.filter(onScreen).length,
      unreachable: textEls.filter(unreachable).length,
      fontWeights,
      fontSizes,
      distinctFontSizes: Object.keys(fontSizes).length,
      bodyFontFamily: getComputedStyle(document.body).fontFamily.slice(0, 80)
    },
    placeholders: {
      count: dead.length,
      byText,
      samples: dead.slice(0, 8).map((el) => ({ text: el.textContent.trim(), tag: el.tagName, cls: cls(el) }))
    },
    images: {
      total: images.length,
      onScreen: images.filter(onScreen).length,
      unreachable: images.filter(unreachable).length,
      broken: brokenImages.length,
      brokenSources: brokenImages.slice(0, 8).map((el) => String(el.currentSrc || el.src).slice(0, 160))
    },
    emptyDecoratedBoxes: {
      count: emptyBoxes.length,
      samples: emptyBoxes.slice(0, 6).map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: cls(el), width: round(r.width), height: round(r.height) };
      })
    },
    repeatedGroups: groups.sort((a, b) => b.itemWidth * b.count - a.itemWidth * a.count).slice(0, 12)
  };
})()`;
}

// ── Findings: what the numbers mean ─────────────────────────────────────────

/**
 * Render-finding codes.
 *
 * Deliberately **not** `DiagnosticCode` values. Those name what is wrong with a
 * graph; these name what is wrong with a picture, and several have no graph
 * counterpart at all (an image that 404s, a page that will not reflow). Where
 * the two do describe one defect from opposite sides, the finding carries
 * `relatedDiagnostic` so LAS-007's example table can key on the same string
 * rather than on a second vocabulary.
 */
const RenderFinding = {
  BlankRender: 'blank-render',
  /**
   * LAS-012 §3 — a list whose rows the graph spells out, and the page does not
   * contain a single one of them. The one shape this report was structurally
   * unable to see: every other finding is about content present and wrong, and
   * a repeater that instantiates nothing emits no elements to judge.
   */
  EmptyList: 'empty-list',
  DeadPlaceholderText: 'dead-placeholder-text',
  BrokenImage: 'broken-image',
  /**
   * AWP-004 §2 — content on the page that no scroll can reach.
   *
   * The direct check for F45, and the one that generalises the other two: Kimi
   * K3's storefront put 83 texts and 10 images in the DOM and stranded 70 and 9
   * of them below a page that does not scroll, and the report called it
   * *"Rendered clean: 83 texts, 10 images"*.
   */
  ContentNotVisible: 'content-not-visible',
  /** The mechanism behind it: a page pinned to the viewport with content past the fold. */
  ClippedPage: 'clipped-page',
  /** Elements wider than the viewport inside a page that does not itself scroll sideways. */
  ElementsOverflowing: 'elements-overflowing',
  SingleColumnGrid: 'single-column-grid',
  MinimumLayoutWidth: 'minimum-layout-width',
  HorizontalOverflow: 'horizontal-overflow',
  FlatTypeScale: 'flat-type-scale',
  EmptyDecoratedBox: 'empty-decorated-box',
  ConsoleError: 'console-error'
};

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * AWP-004 — how far past its own scrollable extent a page may lay content out
 * before that content is stranded rather than rounded.
 *
 * Measured 2026-08-09: the two builds this phase calls correct put `contentBottom`
 * **exactly** on `pageHeight` (sonnet 3777/3777 and 6482/6482, ecommerce
 * 2373/2373 and 3080/3080), and Kimi's clipped build put it 4,392px past. There is
 * no middle ground in the corpus, so the slack only has to absorb sub-pixel
 * rounding.
 */
const CLIPPED_CONTENT_SLACK = 8;

function plural(n, one, many) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/**
 * AWP-003's wider rule, applied to the overflow findings: **name what was
 * measured, not what might be wrong.**
 *
 * Grepping the finding set for messages that enumerate possible causes rather
 * than reporting a determined one — which AWP-003 asks for explicitly, on the
 * grounds that `blank-render` was unlikely to be the only one — turned up
 * `minimum-layout-width` ending on *"Something inside carries a fixed width or a
 * non-collapsing row"*. Both halves of that guess were already answered by
 * `overflowing`, which the finding was attaching as evidence and not reading.
 *
 * Returns the widest offending element as a phrase, or `null` when nothing was
 * captured — in which case the finding says less rather than guessing.
 */
function widestOffender(v) {
  const widest = (v.overflowing || []).slice().sort((a, b) => b.width - a.width)[0];
  if (!widest) return null;
  const named = widest.cls ? `${widest.tag.toLowerCase()}.${widest.cls.split(/\s+/)[0]}` : widest.tag.toLowerCase();
  return `${named} at ${widest.width}px`;
}

/**
 * Turn the raw per-viewport measurements into findings and a one-line summary.
 *
 * Pure: measurements in, report out. Every threshold is a named constant and
 * every finding says what was measured, because a finding an agent cannot act on
 * is a finding it will ignore — the audit's central result was that rejections
 * carrying a concrete fix were self-corrected 100% of the time and prose was
 * dropped.
 */
function summarise(viewports, diagnosis, overridden = {}) {
  const findings = [];
  const add = (f) => findings.push(f);

  for (const [name, v] of Object.entries(viewports)) {
    if (!v || v.error) continue;
    const isDesktop = v.requested.width >= DESKTOP_WIDTH;

    if (v.text.elements === 0 && v.images.total === 0) {
      // AWP-003 — what was determined, never a list of what might be wrong. The
      // walk has the project; without one there is nothing to say beyond the
      // measurement, and saying less is the point of the task.
      add({
        code: RenderFinding.BlankRender,
        severity: 'error',
        viewport: name,
        message:
          'The page rendered nothing at all — no text and no images. ' +
          (diagnosis
            ? diagnosis.message
            : 'No project was available to diagnose it against, so the cause was not determined.'),
        ...(diagnosis && diagnosis.cause ? { cause: diagnosis.cause } : {}),
        ...(diagnosis && diagnosis.evidence ? { evidence: diagnosis.evidence } : {})
      });
      continue;
    }

    for (const list of v.lists || []) {
      if (list.found > 0) continue;
      add({
        code: RenderFinding.EmptyList,
        severity: 'error',
        viewport: name,
        relatedDiagnostic: 'repeater-without-template',
        message:
          `The Repeater "${list.label}" in ${list.component} has ${plural(list.rows, 'row', 'rows')} of ` +
          `${list.source}, and none of that content is on the page — so it built nothing. A For Each ` +
          'instantiates the component named on its "template" port once per item and inserts each copy as its ' +
          'own next sibling; with no template, or with the item markup nested underneath it instead, it ' +
          `renders nothing at all. Looked for: ${list.missing.map((s) => `"${s}"`).join(', ')}.`,
        evidence: { component: list.component, nodeId: list.nodeId, rows: list.rows, missing: list.missing }
      });
    }

    if (v.placeholders.count > 0) {
      // Two classes, two causes, two sentences. A node-type default on screen
      // means nobody set the port; a component's own hardcoded fallback on screen
      // means an input that *was* wired never arrived. Telling an agent the wrong
      // one aims it at the wrong subsystem, which is AWP-003's lesson applied to
      // the finding next door.
      const entries = Object.entries(v.placeholders.byText);
      const listing = (pairs) => pairs.map(([text, n]) => `${n}× "${text}"`).join(', ');
      const total = (pairs) => pairs.reduce((sum, [, n]) => sum + n, 0);
      const fromInput = entries.filter(([text]) => overridden[text]);
      const fromCatalog = entries.filter(([text]) => !overridden[text]);

      // AWP-004 §3 — the fallback a wired port shows when its input never came.
      if (fromInput.length) {
        const where = fromInput.map(([text]) => `"${text}" is ${describeSites(overridden[text])}`).join('; ');
        add({
          code: RenderFinding.DeadPlaceholderText,
          severity: 'error',
          viewport: name,
          relatedDiagnostic: 'interfaceless-instance',
          message:
            `${plural(total(fromInput), 'element shows', 'elements show')} the fallback hardcoded on a port ` +
            `that a Component Inputs node also feeds: ${listing(fromInput)}. That value is only ever visible ` +
            `when the input does not arrive, so it did not arrive — ${where}.`,
          evidence: v.placeholders.samples.filter((s) => overridden[s.text])
        });
      }

      if (fromCatalog.length) {
        add({
          code: RenderFinding.DeadPlaceholderText,
          severity: 'error',
          viewport: name,
          relatedDiagnostic: 'interfaceless-instance',
          message:
            `${plural(total(fromCatalog), 'element renders', 'elements render')} a node-type default instead ` +
            `of content: ${listing(fromCatalog)}. Nothing set those ports. The usual cause is a component ` +
            'instantiated with parameters its Component Inputs node does not declare, so every value is ' +
            'discarded — the graph-side name for it is interfaceless-instance.',
          evidence: v.placeholders.samples.filter((s) => !overridden[s.text])
        });
      }
    }

    if (v.images.broken > 0) {
      add({
        code: RenderFinding.BrokenImage,
        severity: 'error',
        viewport: name,
        message:
          `${plural(v.images.broken, 'image', 'images')} of ${v.images.total} failed to load — the element is ` +
          'in the DOM with naturalWidth 0. A URL that returns 200 can still be the wrong picture; this is only ' +
          'the half a number can see, so look at the screenshot for the rest.',
        evidence: v.images.brokenSources
      });
    }

    // ── AWP-004 §2 — is what is in the DOM also on screen? ──────────────────
    //
    // Only where it was measured. A recording made before these fields existed
    // cannot answer the question, and LAS-012 established abstention as the
    // honest third state rather than assuming the flattering answer.
    const measuredVisibility = typeof v.contentBottom === 'number' && typeof v.text.unreachable === 'number';

    if (measuredVisibility) {
      const strandedText = v.text.unreachable;
      const strandedImages = v.images.unreachable || 0;

      // The direct check. Deliberately NOT "counted text vastly exceeds visible
      // text" as AWP-004 §2 first proposed: measured on the corpus, a correct
      // 82-text page shows 19 of them at 1280×900 and 11 at 390×844 against
      // Kimi's 13 and 9, so a ratio cannot separate a clipped page from a long
      // one. Content below the page's own scrollable extent can — 70 on Kimi,
      // 0 on both builds this phase calls correct.
      if (strandedText > 0 || strandedImages > 0) {
        const parts = [];
        if (strandedText > 0) parts.push(`${strandedText} of ${v.text.elements} text elements`);
        if (strandedImages > 0) parts.push(`${strandedImages} of ${v.images.total} images`);
        add({
          code: RenderFinding.ContentNotVisible,
          severity: 'error',
          viewport: name,
          message:
            `${parts.join(' and ')} are laid out below ${v.pageHeight}px, which is as far as this page ` +
            `scrolls — no scroll reaches them, so they are on the page and cannot be seen. Content ` +
            `extends to ${v.contentBottom}px. ${v.text.onScreen} of ${v.text.elements} texts are on screen.`,
          evidence: {
            pageHeight: v.pageHeight,
            contentBottom: v.contentBottom,
            textElements: v.text.elements,
            textOnScreen: v.text.onScreen,
            textUnreachable: strandedText,
            imagesUnreachable: strandedImages
          }
        });
      }

      // The mechanism, when the page height is pinned to the viewport it was
      // asked for. The MCP server's own instructions already warn that the
      // default clips every page with no scrollbar and tell planners to pass
      // `scroll`; this is what makes that warning checkable.
      const pinned = Math.abs(v.pageHeight - v.requested.height) <= 1;
      if (pinned && v.contentBottom > v.pageHeight + CLIPPED_CONTENT_SLACK) {
        add({
          code: RenderFinding.ClippedPage,
          severity: 'warning',
          viewport: name,
          message:
            `The page is exactly ${v.pageHeight}px tall — the viewport height — and its content runs to ` +
            `${v.contentBottom}px, so it is clipped at the fold rather than scrolling. A root that clips to ` +
            'the viewport with no scrollbar is the default; a page of this length has to opt into scrolling.',
          evidence: { pageHeight: v.pageHeight, contentBottom: v.contentBottom, viewport: v.requested.height }
        });
      }
    }

    if (isDesktop) {
      for (const g of v.repeatedGroups) {
        if (g.count < 3 || g.columns !== 1) continue;
        if (g.itemWidth < g.parentWidth * GRID_ITEM_PARENT_SHARE) continue;
        if (g.kind !== 'columns') {
          if (g.itemHeight < GRID_ITEM_MIN_HEIGHT || g.itemWidth < GRID_ITEM_MIN_WIDTH) continue;
          if (g.parentWidth < v.requested.width * GRID_PARENT_VIEWPORT_SHARE) continue;
        }
        add({
          code: RenderFinding.SingleColumnGrid,
          severity: g.kind === 'columns' ? 'warning' : 'info',
          viewport: name,
          message:
            `${g.count} repeated items are stacked in one column at ${v.requested.width}px, each ` +
            `${g.itemWidth}×${g.itemHeight}px inside a ${g.parentWidth}px parent` +
            (g.kind === 'columns'
              ? '. They are a Columns node\u2019s items, so the layoutString asked for one column — "1 1 1" is ' +
                'three equal columns, and the count of numbers is the count of columns.'
              : '. If they are meant to be a grid, a Columns node is the only node that lays items out in one ' +
                'and collapses it on small screens; if they are meant to be full-width bands, this is right.'),
          evidence: g
        });
      }
    }

    if (v.layoutWidth > v.requested.width + 1) {
      add({
        code: RenderFinding.MinimumLayoutWidth,
        severity: 'warning',
        viewport: name,
        message:
          `The page cannot lay out below ${v.layoutWidth}px: asked for ${v.requested.width}px, the browser ` +
          `widened the layout viewport to ${v.layoutWidth}px and scaled the whole page down.` +
          (widestOffender(v)
            ? ` The widest element inside it is ${widestOffender(v)}.`
            : ' Nothing wider than the viewport was captured, so the element holding the floor was not identified.'),
        evidence: v.overflowing
      });
    } else if (v.scrollWidth > v.clientWidth + 1) {
      add({
        code: RenderFinding.HorizontalOverflow,
        severity: 'warning',
        viewport: name,
        message:
          `The page scrolls sideways at ${v.requested.width}px — content is ${v.scrollWidth}px wide in a ` +
          `${v.clientWidth}px viewport, with ${plural(v.overflowingCount, 'element', 'elements')} wider than it.`,
        evidence: v.overflowing
      });
    } else if (v.overflowingCount > 0) {
      // AWP-004 §2. `overflowingCount` has been computed since LAS-005 and had no
      // rule attached to it — register note A7, and the reason that note says to
      // check what is already measured before measuring anything new. The two
      // page-level checks above both passed on Kimi's phone render (the document
      // itself does not scroll sideways) while 43 elements overflowed inside it.
      add({
        code: RenderFinding.ElementsOverflowing,
        severity: 'warning',
        viewport: name,
        message:
          `${plural(v.overflowingCount, 'element is', 'elements are')} wider than the ${v.clientWidth}px ` +
          'viewport, while the page itself does not scroll sideways — so each is clipped by an ancestor ' +
          `rather than reachable${widestOffender(v) ? `; the widest is ${widestOffender(v)}` : ''}.`,
        evidence: v.overflowing
      });
    }

    if (v.text.elements >= 10) {
      const weights = Object.keys(v.text.fontWeights);
      if (weights.length <= 1 || v.text.distinctFontSizes <= 2) {
        add({
          code: RenderFinding.FlatTypeScale,
          severity: 'warning',
          viewport: name,
          message:
            `${v.text.elements} text elements render at ${plural(weights.length, 'font weight', 'font weights')} ` +
            `(${weights.join(', ')}) and ${plural(v.text.distinctFontSizes, 'font size', 'font sizes')}. ` +
            'Nothing is emphasised over anything else, which is what an unstyled page measures like.'
        });
      }
    }

    if (v.emptyDecoratedBoxes.count > 0) {
      add({
        code: RenderFinding.EmptyDecoratedBox,
        severity: 'warning',
        viewport: name,
        message:
          `${plural(v.emptyDecoratedBoxes.count, 'box has', 'boxes have')} a background or border and no ` +
          'content — a card whose contents never arrived, or a decorated Group used as a spacer.',
        evidence: v.emptyDecoratedBoxes.samples
      });
    }

    if (v.consoleErrors && v.consoleErrors.length) {
      add({
        code: RenderFinding.ConsoleError,
        severity: 'warning',
        viewport: name,
        message: `The runtime logged ${plural(v.consoleErrors.length, 'error', 'errors')} while rendering.`,
        evidence: v.consoleErrors.slice(0, 5)
      });
    }
  }

  // One page can hold three paragraph blocks with identical geometry; three
  // identical sentences is a report an agent skims rather than reads.
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.code}|${f.viewport}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { findings: unique, summary: summaryLine(viewports, unique) };
}

/**
 * One sentence an agent can act on without reading the JSON.
 *
 * ## AWP-004 \u00a74 \u2014 say what is on screen, not only what is in the DOM
 *
 * This line was *"Rendered clean: desktop 1280\u00d7900px, 83 texts, 10 images"* for a
 * page showing a dialog and nothing else. Every number in it was true and the
 * sentence was false, because "83 texts" is a fact about the DOM and the reader
 * takes it as a fact about the picture. `83 texts, 13 on screen` needs no finding
 * attached to tell a model something is wrong, which is why AWP-004 called this
 * the cheapest change here and probably the highest value.
 *
 * ## AWP-004 \u00a71 \u2014 "clean" is a claim, and it has to be earned
 *
 * *"Rendered clean"* used to mean "no check I own fired", which is how three
 * different broken pages across three sessions were certified. It now means the
 * report **affirmed** that something is on screen. Where visibility was not
 * measured at all \u2014 a recording made before those fields existed \u2014 it says so
 * instead of upgrading silence into a pass.
 */
function summaryLine(viewports, findings) {
  const count = (severity) => findings.filter((f) => f.severity === severity).length;
  const errors = count('error');
  const warnings = count('warning');
  const infos = count('info');
  const live = Object.entries(viewports).filter(([, v]) => v && !v.error);
  const shape = live
    .map(([name, v]) => {
      const counts =
        typeof v.text.onScreen === 'number'
          ? `${v.text.elements} texts, ${v.text.onScreen} on screen, ${v.images.total} images`
          : `${v.text.elements} texts, ${v.images.total} images`;
      return `${name} ${v.requested.width}\u00d7${v.pageHeight}px, ${counts}`;
    })
    .join('; ');
  if (!errors && !warnings) {
    const measured = live.filter(([, v]) => typeof v.text.onScreen === 'number');
    const observations = infos ? ` (${plural(infos, 'observation', 'observations')})` : '';
    if (measured.length !== live.length) {
      return `No findings${observations}, and visibility was not measured \u2014 not a claim the page is on screen: ${shape}.`;
    }
    if (measured.some(([, v]) => v.text.onScreen === 0 && v.images.onScreen === 0)) {
      return `No findings${observations}, but nothing is on screen at the top of the page: ${shape}.`;
    }
    return `Rendered clean${observations}: ${shape}.`;
  }
  const worst = [...new Set(findings.filter((f) => f.severity !== 'info').map((f) => f.code))].slice(0, 4).join(', ');
  return (
    `${plural(errors, 'error', 'errors')}, ${plural(warnings, 'warning', 'warnings')}` +
    `${infos ? `, ${plural(infos, 'observation', 'observations')}` : ''} (${worst}). ${shape}.`
  );
}

// ── Environment ─────────────────────────────────────────────────────────────

const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ]
};

/** A Chrome/Chromium binary, or null with everything probed — `CHROME_PATH` wins. */
function findChrome() {
  const probed = [];
  const check = (p) => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };
  if (process.env.CHROME_PATH) {
    const found = check(process.env.CHROME_PATH);
    if (found) return { chrome: found, probed };
  }
  for (const candidate of CHROME_CANDIDATES[process.platform] || []) {
    const found = check(candidate);
    if (found) return { chrome: found, probed };
  }
  return { chrome: null, probed };
}

/**
 * What is missing before this can run at all, as sentences naming the fix.
 *
 * An agent that gets "ENOENT" learns nothing; one that gets "build the viewer
 * with <command>" fixes it in one turn. Same reasoning as the rejection
 * diagnostics: the message is the repair instruction.
 */
function checkPrerequisites(projectDir) {
  const problems = [];
  if (!projectDir || !fs.existsSync(path.join(projectDir, 'nodegx.project.json'))) {
    problems.push(
      `Not a NodeGX v2 project directory (no nodegx.project.json): ${projectDir || '(none given)'}.`
    );
  }
  if (!fs.existsSync(VIEWER_BUNDLE)) {
    problems.push(
      `The viewer bundle is missing (${VIEWER_BUNDLE}). Build it first: ` +
        'cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js'
    );
  }
  if (!fs.existsSync(WS_MODULE)) {
    problems.push(`The "ws" package is missing (${WS_MODULE}). Run npm install at the repo root.`);
  }
  const { chrome, probed } = findChrome();
  if (!chrome) {
    problems.push(
      'No Chrome or Chromium binary found. Install Google Chrome, or set CHROME_PATH to one. Probed: ' +
        probed.join(', ')
    );
  }
  return { ok: problems.length === 0, problems, chrome };
}

/** A port nothing is listening on right now. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// ── CDP plumbing ────────────────────────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

function connect(wsUrl, onEvent) {
  const WebSocket = require(WS_MODULE);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
    let nextId = 0;
    const pending = new Map();
    ws.on('open', () =>
      resolve({
        send(method, params) {
          const id = ++nextId;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() {
          ws.close();
        }
      })
    );
    ws.on('error', reject);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method && onEvent) {
        onEvent(msg);
      }
    });
  });
}

async function evaluate(client, expression) {
  const r = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
  }
  return r.result.value;
}

// ── The loop ────────────────────────────────────────────────────────────────

/** How long to let the runtime boot and settle before the first read. */
const BOOT_MS = 3500;
/** How long to let a reflow settle after changing the device metrics. */
const REFLOW_MS = 1200;

/**
 * Render `projectDir` and measure it.
 *
 * @param {object} options
 * @param {string} options.projectDir           v2 project directory.
 * @param {Array}  [options.viewports]          `[{name, width, height, mobile}]`.
 * @param {'full'|'viewport'|'none'} [options.screenshot='full']
 * @param {number} [options.deviceScaleFactor=0.5]  Screenshot scale — 0.5 keeps a full page around 500KB.
 * @param {number} [options.backendPort]        Backend to proxy `/__backend` to, if the project has one.
 * @param {boolean}[options.editorTokens=false] Mirror a running editor's tokens (see render-from-disk.js).
 * @returns {Promise<{report: object, screenshots: Array<{name: string, mimeType: string, base64: string}>}>}
 */
async function renderReport(options) {
  const {
    projectDir,
    viewports = DEFAULT_VIEWPORTS,
    screenshot = 'full',
    deviceScaleFactor = 0.5,
    backendPort,
    editorTokens = false
  } = options;

  const pre = checkPrerequisites(projectDir);
  if (!pre.ok) {
    const error = new Error(pre.problems.join(' '));
    error.problems = pre.problems;
    error.actionable = true;
    throw error;
  }

  const started = Date.now();
  const servePort = await freePort();
  const cdpPort = await freePort();

  const serverArgs = [RENDER_SCRIPT, projectDir, '--port', String(servePort)];
  if (backendPort) serverArgs.push('--backend-port', String(backendPort));
  if (editorTokens) serverArgs.push('--editor-tokens');
  const server = spawn(process.execPath, serverArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-render-'));
  const chrome = spawn(
    pre.chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-gpu',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  const cleanup = (client) => {
    try {
      if (client) client.close();
    } catch {
      /* already gone */
    }
    chrome.kill();
    server.kill();
    fs.rm(profile, { recursive: true, force: true }, () => {});
  };

  let client;
  try {
    let targets;
    for (let i = 0; i < 40 && !targets; i++) {
      await wait(250);
      try {
        targets = await httpJson(cdpPort, '/json/list');
      } catch {
        /* not up yet */
      }
    }
    if (!targets) throw new Error(`Chrome never opened a debugging port (${pre.chrome}).`);

    const page = targets.find((t) => t.type === 'page');
    const consoleErrors = [];
    client = await connect(page.webSocketDebuggerUrl, (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        consoleErrors.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(
          msg.params.args
            .map((a) => String(a.value !== undefined ? a.value : a.description || ''))
            .join(' ')
            .slice(0, 300)
        );
      }
    });
    await client.send('Page.enable', {});
    await client.send('Runtime.enable', {});
    await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}/` });
    await wait(BOOT_MS);

    // AWP-004 §3 — the catalog's defaults, plus this project's own fallbacks on
    // ports a Component Inputs node feeds. Neither source can see the other's
    // strings, and Kimi's three were all in the second.
    const overridden = Object.fromEntries(overriddenDefaults(projectDir));
    const expression = measureExpression(
      [...new Set([...placeholderStrings(), ...Object.keys(overridden)])],
      listProbes(projectDir)
    );
    const measured = {};
    const screenshots = [];

    for (const vp of viewports) {
      // Everything logged from here to the read belongs to this viewport; for
      // the first one that includes the boot, which is where it belongs.
      const loggedBefore = consoleErrors.length;
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: Boolean(vp.mobile)
      });
      await wait(REFLOW_MS);

      const raw = await evaluate(client, expression);
      measured[vp.name] = {
        requested: { width: vp.width, height: vp.height },
        ...raw,
        consoleErrors: consoleErrors.slice(loggedBefore)
      };

      if (screenshot !== 'none') {
        const shot = await client.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: screenshot === 'full',
          optimizeForSpeed: true,
          ...(screenshot === 'full'
            ? {
                clip: {
                  x: 0,
                  y: 0,
                  width: vp.width,
                  // Chrome refuses beyond 16384px; a page taller than that is
                  // already the finding.
                  height: Math.min(raw.pageHeight, 16384),
                  scale: deviceScaleFactor
                }
              }
            : {})
        });
        screenshots.push({ name: vp.name, mimeType: 'image/png', base64: shot.data });
      }
    }

    // AWP-003 — computed only when something is blank, because it is an
    // explanation of an observed blank and never a prediction of one.
    const blank = Object.values(measured).some((v) => v && !v.error && v.text.elements === 0 && v.images.total === 0);
    const { findings, summary } = summarise(measured, blank ? blankDiagnosis(projectDir) : undefined, overridden);
    const project = JSON.parse(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf8'));

    return {
      report: {
        project: projectDir,
        projectName: project.name,
        durationMs: Date.now() - started,
        tokens: (serverLog.match(/\[render\] design tokens: (.*)/) || [])[1] || 'unknown',
        components: (serverLog.match(/\[render\] rootComponent=\S+\s+(\d+) components/) || [])[1],
        viewports: measured,
        findings,
        summary
      },
      screenshots
    };
  } finally {
    cleanup(client);
  }
}

module.exports = {
  renderReport,
  summarise,
  measureExpression,
  listProbes,
  readComponents,
  blankDiagnosis,
  overriddenDefaults,
  rootNodes,
  effectiveRoots,
  projectVisualPredicate,
  visualTypeNames,
  contentBearingTypeNames,
  BlankCause,
  placeholderStrings,
  checkPrerequisites,
  findChrome,
  freePort,
  RenderFinding,
  DEFAULT_VIEWPORTS,
  DESKTOP_WIDTH,
  VIEWER_BUNDLE,
  RENDER_SCRIPT
};
