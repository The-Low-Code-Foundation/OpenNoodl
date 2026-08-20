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

/**
 * UNI-012 — every data path this file reads now comes from the resolver, because
 * there are two layouts: a repo checkout and a packaged install's `app.asar`.
 * The `REPO = path.resolve(__dirname, '../..')` this replaced was correct in
 * exactly one of them, and silently correct-looking in the other.
 */
const HARNESS_PATHS = require('./harness-paths');

const RENDER_SCRIPT = path.join(__dirname, 'render-from-disk.js');
const VIEWER_DIR = HARNESS_PATHS.VIEWER_DIR.path;
const VIEWER_BUNDLE = VIEWER_DIR && path.join(VIEWER_DIR, 'noodl.viewer.js');
const CATALOG_JSON = HARNESS_PATHS.CATALOG_JSON.path;
const WS_MODULE = HARNESS_PATHS.WS_MODULE.path;

/**
 * F22 (LAS-005), decided 2026-08-10 — the pure half now lives in its own
 * no-build package so the **editor** can import it too.
 *
 * Nothing about this file's behaviour changes: it re-exports every name it used
 * to own (see `module.exports`), so `noodl-mcp` and `measure-from-disk.js` are
 * untouched. What changed is that `measureExpression` and `summarise` are no
 * longer trapped behind this module's `child_process` / `http` / `net` / `ws`
 * requires — which was the whole of why LAS-005 §5 was descoped.
 *
 * ⚠️ Resolved through the workspace, not by a relative path into `packages/`.
 * A relative `require('../../packages/…')` works in a checkout and breaks the
 * moment this script is invoked from anywhere else.
 */
const {
  DEFAULT_VIEWPORTS,
  DESKTOP_WIDTH,
  RenderFinding,
  SEVERITY_ORDER,
  CLIPPED_CONTENT_SLACK,
  measureExpression,
  summarise,
  summaryLine,
  plural,
  widestOffender,
  describeSites,
  TEXT_BEARING_PORTS,
  placeholderStringsFromCatalog
} = require('@nodegx/render-measure');


// ── Placeholder strings, from the catalog rather than from memory ────────────

/**
 * Port names whose value is what the user reads on the page.
 *
 * The *defaults* come from the generated catalog; this set is the harness's own
 * judgement about which ports render as visible text, and it is the one thing
 * here that is not derived. Keep it small: a false member turns a legitimate
 * value ("none", "auto") into a reported defect.
 */

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
  // The reading is all that is left here — the derivation moved to
  // `@nodegx/render-measure` so the editor, which bundles the catalog and has
  // no `fs`, applies the identical rule rather than a paraphrase of it.
  return placeholderStringsFromCatalog(JSON.parse(fs.readFileSync(catalogPath, 'utf8')));
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
const ENRICHED_CATALOG_JSON = HARNESS_PATHS.ENRICHED_CATALOG_JSON.path;

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
/**
 * Every page the project's routers can show, and how to reach each one by URL.
 *
 * ## UNI-010 §8.2 — the hole this closes
 *
 * Until 2026-08-20 this module rendered `/` and nothing else, so a defect on any
 * page but the start page was invisible **and the report said `Rendered clean`
 * about it**. Measured on a five-route project before the fix: the same
 * `dead-placeholder-text` scored 2 errors on the start page and produced a
 * character-identical clean report on a routed one. UNI-010's F4 grades through
 * this chain, so a lesson that *teaches building a second page* had its entire
 * subject unscored.
 *
 * 🔴 **The blindness was navigation, not serving.** CN-001 recorded the mechanism
 * as `render-from-disk.js` answering exactly one path and concluded that anything
 * driven by `urlPath` was unmeasurable. The serving half is real and is fixed
 * there — but it is not what blinded F4. The runtime's default
 * `navigationPathType` is `hash` (`router.tsx:_getLocationPath`), and a hash is
 * never sent to a server: `/#thank-you` was always served correctly and always
 * rendered the right page. What was missing is that nothing ever navigated.
 * Fixing only the 404 would have left every reading in this file unchanged.
 *
 * ⚠️ Routers are matched by `n.type === 'Router'`, the same test `blankDiagnosis`
 * uses, so the two cannot disagree about what a router is. A page's URL comes
 * from its own `Page` node's `urlPath`.
 *
 * @returns {{ok: boolean, pages: Array, startPage: string|undefined, pathType: string}}
 *   `pages` carries every routed component, `reachable` false ones included —
 *   a page skipped for want of a URL is reported, never silently dropped.
 */
/**
 * Every component a page can put on screen, itself included.
 *
 * ## UNI-010 §8.2 — why measuring more pages needed this too
 *
 * `listProbes` returns every knowable repeater in the **project**, and the
 * measurement asks the DOM whether each probe's rows are present. That was
 * sound while only one page was ever rendered and slightly wrong in a way
 * nothing could see. Rendering all of them made it visible and severe:
 * `phase55-replay-sonnet` — the build phase 55 calls **correct**, and a pinned
 * control that "still reports none" — came back with **14 `empty-list` errors**,
 * one per viewport per page, because its featured-products repeater lives on the
 * Home page and every other page was accused of failing to render it.
 *
 * 🔴 That is a gate rejecting the correct answer, and it would have been F4
 * failing sound lessons. A probe is only evidence about a page that could
 * contain it.
 *
 * ⚠️ The same shape already existed in the other direction and is fixed by the
 * same rule: a repeater on page four made the **start page** report `empty-list`,
 * because its probe was evaluated against a page that never had those rows.
 *
 * Instantiation is static: a node whose `type` is a component's name instantiates
 * it, and a `For Each` names its row component on `template`.
 */
function reachableComponents(startName, byName) {
  const seen = new Set();
  const queue = [startName];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const component = byName.get(name);
    if (!component) continue;
    for (const node of component.nodes) {
      if (byName.has(node.type)) queue.push(node.type);
      const template = (node.parameters || {}).template;
      if (typeof template === 'string' && byName.has(template)) queue.push(template);
    }
  }
  return seen;
}

function routedPages(projectDir) {
  const { ok, project, components } = readComponents(projectDir);
  if (!ok) return { ok: false, pages: [], startPage: undefined, pathType: 'hash' };

  const pathType = (project.settings && project.settings.navigationPathType) || 'hash';
  const byName = new Map(components.map((c) => [c.name, c]));

  const routes = [];
  let startPage;
  for (const c of components) {
    for (const n of c.nodes) {
      if (n.type !== 'Router') continue;
      const pages = (n.parameters || {}).pages || {};
      for (const route of pages.routes || []) if (!routes.includes(route)) routes.push(route);
      if (!startPage && pages.startPage) startPage = pages.startPage;
    }
  }

  const pages = routes.map((component) => {
    const c = byName.get(component);
    const pageNode = c && c.nodes.find((n) => n.type === 'Page');
    const params = (pageNode && pageNode.parameters) || {};
    const urlPath = typeof params.urlPath === 'string' ? params.urlPath : undefined;
    const isStart = component === startPage;

    // A page is reachable when we can address it. The start page needs no URL —
    // it is what `/` boots into — so it is reachable whatever its `urlPath` says.
    let unreachable;
    if (!c) unreachable = 'no component of that name exists in the project';
    else if (!pageNode) unreachable = 'the component has no Page node, so it has no URL of its own';
    else if (!isStart && !urlPath) unreachable = 'its Page node sets no urlPath, so there is no URL to navigate to';
    else if (!isStart && /[{}]/.test(urlPath))
      // `/product/{id}` needs a value this harness has no way to choose, and
      // inventing one would measure a page nobody asked for.
      unreachable = `its urlPath "${urlPath}" takes a route parameter, which this harness has no value for`;

    return {
      component,
      title: typeof params.title === 'string' ? params.title : undefined,
      urlPath,
      isStart,
      reachable: !unreachable,
      ...(unreachable ? { unreachable } : {}),
      url: isStart ? '/' : unreachable ? undefined : pathType === 'hash' ? `/#${urlPath}` : `/${urlPath}`
    };
  });

  return { ok: true, pages, startPage, pathType };
}

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
  if (!VIEWER_BUNDLE || !fs.existsSync(VIEWER_BUNDLE)) {
    problems.push(
      `The viewer bundle is missing. Build it first: ` +
        'cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js. ' +
        `Probed: ${HARNESS_PATHS.VIEWER_DIR.probed.join(', ')}`
    );
  }
  if (!WS_MODULE) {
    problems.push(
      `The "ws" package is missing. Run npm install at the repo root. ` +
        `Probed: ${HARNESS_PATHS.WS_MODULE.probed.join(', ')}`
    );
  }
  /**
   * 🔴 UNI-012 — the catalogs are a prerequisite, not a degradation.
   *
   * {@link visualTypeNames} and {@link contentBearingTypeNames} abstain to `null`
   * when the catalog cannot be read, and that abstention is right *inside* the
   * walk — a diagnosis guessed from a missing catalog is worse than none. But
   * abstention with nothing said is how a packaged install would report a page
   * "clean" using a strictly weaker rule than the checkout applied to the same
   * project, and F4's whole job is to say whether the solution draws. So the
   * absence is named here, once, where a refusal still means something.
   */
  if (!CATALOG_JSON) {
    problems.push(
      `The node catalog is missing. Probed: ${HARNESS_PATHS.CATALOG_JSON.probed.join(', ')}`
    );
  }
  if (!ENRICHED_CATALOG_JSON) {
    problems.push(
      `The enriched node catalog is missing. Probed: ` +
        `${HARNESS_PATHS.ENRICHED_CATALOG_JSON.probed.join(', ')}`
    );
  }
  const { chrome, probed } = findChrome();
  if (!chrome) {
    problems.push(
      'No Chrome or Chromium binary found. Install Google Chrome, or set CHROME_PATH to one. ' +
        'If you cannot install one, pass allow_unrendered to skip the render check rather than ' +
        'waiting on it. Probed: ' +
        probed.join(', ')
    );
  }
  return { ok: problems.length === 0, problems, chrome };
}

/**
 * `"desktop,phone"`, `"1280x900"`, or a mix, as viewport records.
 *
 * Lives here rather than in a CLI because both CLIs parse the same flag, and the
 * second copy is the one that drifts. Throws actionably — an unknown name lists
 * what is known, on the same principle as {@link checkPrerequisites}.
 *
 * @param {string} [spec]
 * @returns {Array<{name: string, width: number, height: number, mobile: boolean}>}
 */
function parseViewports(spec) {
  if (!spec) return DEFAULT_VIEWPORTS;
  const known = new Map(DEFAULT_VIEWPORTS.map((v) => [v.name, v]));
  return spec.split(',').map((token) => {
    const trimmed = token.trim();
    if (known.has(trimmed)) return known.get(trimmed);
    const m = /^(\d+)x(\d+)$/.exec(trimmed);
    if (!m) {
      const error = new Error(`Unknown viewport "${trimmed}". Use ${[...known.keys()].join(', ')} or WIDTHxHEIGHT.`);
      error.problems = [error.message];
      error.actionable = true;
      error.usage = true;
      throw error;
    }
    const width = Number(m[1]);
    return { name: trimmed, width, height: Number(m[2]), mobile: width < 500 };
  });
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
 * How long a route change gets to settle before it is measured.
 *
 * UNI-010 §8.2. Shorter than `BOOT_MS` because nothing boots — the viewer is
 * running and the router is swapping a subtree. Verified against the arm that
 * has to fail: the same `dead-placeholder-text` on a routed page is detected at
 * this value, which is the only reading that makes it long enough.
 */
const PAGE_NAV_MS = 2000;

/**
 * A booted page, handed to the body of {@link withRenderedPage}.
 *
 * @typedef {object} RenderedPage
 * @property {object} client                      Raw CDP client, for anything the helpers do not cover.
 * @property {string[]} consoleErrors             Appended to as they arrive; slice it around a step to attribute them.
 * @property {() => string} serverLog             Everything `render-from-disk.js` has printed so far.
 * @property {(expression: string) => Promise<any>} evaluate  `Runtime.evaluate`, by value, throwing on exceptions.
 * @property {(viewport: object) => Promise<void>} setViewport  Set device metrics and let the reflow settle.
 */

/**
 * Boot `projectDir` in a headless Chrome, hand the page to `fn`, tear it down.
 *
 * Extracted from {@link renderReport} when the scroll probe (phase 54 F52)
 * needed the same eight steps — spawn the server, spawn Chrome, wait for the
 * debugging port, connect, enable the two domains, navigate, let the runtime
 * settle, and kill all of it — and the alternative was a second copy of them in
 * a sibling script. What differs between the two tools is the measuring; putting
 * a page on the screen is not, and a duplicated copy of this is a copy that
 * drifts.
 *
 * @param {object} options
 * @param {string} options.projectDir          v2 project directory.
 * @param {number} [options.backendPort]       Backend to proxy `/__backend` to.
 * @param {boolean}[options.editorTokens=false]
 * @param {(page: RenderedPage) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withRenderedPage(options, fn) {
  const { projectDir, backendPort, editorTokens = false } = options;

  const pre = checkPrerequisites(projectDir);
  if (!pre.ok) {
    const error = new Error(pre.problems.join(' '));
    error.problems = pre.problems;
    error.actionable = true;
    throw error;
  }

  const servePort = await freePort();
  const cdpPort = await freePort();

  const serverArgs = [RENDER_SCRIPT, projectDir, '--port', String(servePort)];
  if (backendPort) serverArgs.push('--backend-port', String(backendPort));
  if (editorTokens) serverArgs.push('--editor-tokens');
  // UNI-012 — explicit for the same reason `render.ts` sets it: on a packaged
  // install `process.execPath` is the Electron binary, and only this variable
  // keeps the child a plain Node process that can read the asar it lives in.
  // Plain `node` in a checkout ignores it, so it costs nothing there.
  const server = spawn(process.execPath, serverArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
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

    return await fn({
      client,
      consoleErrors,
      serverLog: () => serverLog,
      servePort,
      evaluate: (expression) => evaluate(client, expression),
      /**
       * Go to another route and let it settle.
       *
       * UNI-010 §8.2. `PAGE_NAV_MS` rather than `BOOT_MS`: the runtime is already
       * booted, and in the default `hash` mode this is a `hashchange` the router
       * listens for rather than a document load. The viewport emulation set by
       * `setViewport` survives it — `Emulation.setDeviceMetricsOverride` is
       * per-session, not per-document — so a caller that has already sized the
       * page does not have to size it again.
       */
      async navigate(urlPath) {
        await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}${urlPath}` });
        await wait(PAGE_NAV_MS);
      },
      async setViewport(vp) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: Boolean(vp.mobile)
        });
        await wait(REFLOW_MS);
      }
    });
  } finally {
    cleanup(client);
  }
}

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
 * @param {boolean}[options.renderRoutedPages=true] Visit every routed page, not only the start page
 *   (UNI-010 §8.2). Defaults to **on**: leaving it off by default would have shipped the fix and
 *   left every existing caller — F4 included — reading the same one-page report it always did.
 *   Each extra page costs one navigation plus one measurement per viewport.
 * @returns {Promise<{report: object, screenshots: Array<{name: string, mimeType: string, base64: string}>}>}
 */
async function renderReport(options) {
  const {
    projectDir,
    viewports = DEFAULT_VIEWPORTS,
    screenshot = 'full',
    deviceScaleFactor = 0.5,
    backendPort,
    editorTokens = false,
    renderRoutedPages = true
  } = options;

  const started = Date.now();

  return withRenderedPage({ projectDir, backendPort, editorTokens }, async (page) => {
    // AWP-004 §3 — the catalog's defaults, plus this project's own fallbacks on
    // ports a Component Inputs node feeds. Neither source can see the other's
    // strings, and Kimi's three were all in the second.
    const overridden = Object.fromEntries(overriddenDefaults(projectDir));
    const placeholders = [...new Set([...placeholderStrings(), ...Object.keys(overridden)])];

    // UNI-010 §8.2 — a probe is evidence about the page that can contain it.
    // See `reachableComponents`: project-wide probes measured against one page
    // is how a correct eight-page project scored 14 `empty-list` errors.
    const routes = routedPages(projectDir);
    const allProbes = listProbes(projectDir);
    const { components: projectComponents } = readComponents(projectDir);
    const byName = new Map(projectComponents.map((c) => [c.name, c]));
    const reachBy = new Map(routes.pages.map((p) => [p.component, reachableComponents(p.component, byName)]));
    // Anything the walk cannot place on any page keeps its old home rather than
    // being dropped: a probe evaluated nowhere is a check that silently stopped
    // running, which is worse than the false positive this scoping removes.
    const unplaced = allProbes.filter((probe) => ![...reachBy.values()].some((set) => set.has(probe.component)));
    const probesFor = (pageComponent) => {
      const reach = reachBy.get(pageComponent);
      const own = reach ? allProbes.filter((probe) => reach.has(probe.component)) : allProbes;
      return pageComponent === routes.startPage ? [...own, ...unplaced] : own;
    };

    const expression = measureExpression(placeholders, probesFor(routes.startPage));
    const measured = {};
    const screenshots = [];

    for (const vp of viewports) {
      // Everything logged from here to the read belongs to this viewport; for
      // the first one that includes the boot, which is where it belongs.
      const loggedBefore = page.consoleErrors.length;
      await page.setViewport(vp);

      const raw = await page.evaluate(expression);
      measured[vp.name] = {
        requested: { width: vp.width, height: vp.height },
        ...raw,
        consoleErrors: page.consoleErrors.slice(loggedBefore)
      };

      if (screenshot !== 'none') {
        const shot = await page.client.send('Page.captureScreenshot', {
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

    // ── UNI-010 §8.2 — the other routed pages ────────────────────────────────
    //
    // Everything above measured `/`, which is the start page. A project's other
    // pages were never visited at all, so `Rendered clean` was a claim about one
    // page dressed as a claim about the app.
    //
    // 🔴 Findings from those pages are merged into the SAME top-level `findings`
    // array rather than parked in `pages[]`. That is the whole of why F4 gains
    // this for free: `renderDefectCodes` reads `report.findings`, so a defect on
    // page four now fails a lesson without one line changing in the grader. A
    // separate array would have been tidier and would have left every existing
    // consumer exactly as blind as before.
    const pageReports = [];
    const extraFindings = [];

    if (renderRoutedPages) {
      for (const p of routes.pages) {
        if (p.isStart) {
          pageReports.push({ ...p, measured: true, viewports: measured });
          continue;
        }
        if (!p.reachable) {
          // Reported, not dropped. A page this harness cannot address is a limit
          // of the instrument, and an instrument that hides its own blind spots
          // is what this whole section exists to correct.
          pageReports.push({ ...p, measured: false });
          continue;
        }

        await page.navigate(p.url);
        const pageExpression = measureExpression(placeholders, probesFor(p.component));
        const pageMeasured = {};
        for (const vp of viewports) {
          const loggedBefore = page.consoleErrors.length;
          await page.setViewport(vp);
          const raw = await page.evaluate(pageExpression);
          pageMeasured[vp.name] = {
            requested: { width: vp.width, height: vp.height },
            ...raw,
            consoleErrors: page.consoleErrors.slice(loggedBefore)
          };
        }

        // No `blankDiagnosis` for these: that walk is a start-page walk and every
        // sentence it produces names the start page. Passing `undefined` would
        // make a blank routed page report "No project was available to diagnose
        // it against", which is false — a project was available. The message is
        // rewritten below instead, to say only what was actually established.
        const perPage = summarise(pageMeasured, undefined, overridden);
        for (const f of perPage.findings) {
          extraFindings.push({
            ...f,
            page: p.component,
            message:
              f.code === RenderFinding.BlankRender
                ? `The routed page "${p.component}" rendered nothing at all — no text and no images. ` +
                  'Only the start page is diagnosed against the graph, so the cause was not determined here.'
                : `On the routed page "${p.component}": ${f.message}`
          });
        }

        pageReports.push({ ...p, measured: true, viewports: pageMeasured, summary: perPage.summary });
      }

      // Back to where the caller found us. A screenshot taken after this function
      // would otherwise be of whichever page happened to be measured last.
      if (pageReports.some((p) => p.measured && !p.isStart)) await page.navigate('/');
    }

    const allFindings = [...findings, ...extraFindings];
    // Recomputed, because the headline is the sentence most readers stop at and
    // "Rendered clean" over a broken fourth page is the exact failure this task
    // is closing. The shape half stays the start page's; the counts now cover
    // every page measured, and each borrowed finding names its page.
    let allSummary = extraFindings.length ? summaryLine(measured, allFindings) : summary;

    // 🔴 And a summary must not out-claim its own coverage. A project whose other
    // pages could not be addressed still gets "Rendered clean" from the line
    // above — the same sentence about a different blindness, which is precisely
    // what this task exists to stop. Say what was not looked at, in the sentence
    // people actually read.
    const skipped = pageReports.filter((p) => !p.measured);
    if (skipped.length) {
      allSummary +=
        ` ⚠️ ${skipped.length} of ${pageReports.length} routed ${skipped.length === 1 ? 'page was' : 'pages were'} ` +
        `not measured, so this says nothing about ${skipped.length === 1 ? 'it' : 'them'}: ` +
        skipped.map((p) => `${p.component} (${p.unreachable})`).join('; ') +
        '.';
    }
    const project = JSON.parse(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf8'));
    const log = page.serverLog();

    return {
      report: {
        project: projectDir,
        projectName: project.name,
        durationMs: Date.now() - started,
        tokens: (log.match(/\[render\] design tokens: (.*)/) || [])[1] || 'unknown',
        components: (log.match(/\[render\] rootComponent=\S+\s+(\d+) components/) || [])[1],
        viewports: measured,
        pages: pageReports,
        findings: allFindings,
        summary: allSummary
      },
      screenshots
    };
  });
}

module.exports = {
  renderReport,
  routedPages,
  reachableComponents,
  withRenderedPage,
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
  parseViewports,
  RenderFinding,
  DEFAULT_VIEWPORTS,
  DESKTOP_WIDTH,
  VIEWER_BUNDLE,
  RENDER_SCRIPT
};
