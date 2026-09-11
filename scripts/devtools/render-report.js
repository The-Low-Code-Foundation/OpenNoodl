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
  DISPLAY_TYPE_MIN_PX,
  MIN_DISTINCT_GROUNDS,
  POVERTY_MIN_TEXTS,
  POVERTY_FINDINGS,
  isPovertyFinding,
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
 * Currently `Text` (Text.text) and `Label` (six control nodes). `Type here...`
 * was a third until REL-002a: both text inputs defaulted `Placeholder` to it,
 * so the product manufactured the exact string this hunt looks for. That
 * default is now empty, and because the set is derived from the catalog rather
 * than listed here, it shrank without anyone editing this function.
 *
 * A page full of them is the signature of a component whose
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
 * `Text` and `Label` — and `Type here...` too, at the time this was measured,
 * until REL-002a emptied the text inputs' default. Kimi K3's page showed **Title / Body / Got
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
 *
 * ## 🔴 Except when an instance supplies the same string on purpose
 *
 * Found by VIB-007 AC3, measuring the phase's **only WORTHY page**: the VIB-006
 * landing page carries a `StatTile` whose fallback is `"0"` and a fourth
 * instance that legitimately sets `value: "0"` — *"0 air miles in the boxes"*,
 * a real statistic and the best line on the page. On screen the two are the
 * same pixel, and the finding this feeds asserts the stronger reading as
 * determined fact: *"That value is only ever visible when the input does not
 * arrive, so it did not arrive."* It did arrive.
 *
 * 🔴 The consequence was not cosmetic. `dead-placeholder-text` is `error`, and
 * VIB-007 M1 blocks `done` on exactly that severity — so the one page a person
 * has ruled WORTHY could never be certified, at either viewport, by the
 * mechanism built to certify it. **A refusal and a never-requested value are
 * the same picture and have opposite fixes**; the graph is what separates them,
 * and the graph is already on disk here.
 *
 * So a literal an instance supplies verbatim for the port that feeds it is
 * **ambiguous, and dropped** — a fallback is only evidence of an absent input
 * when nobody could have sent it. Per site, not per string: the same word can
 * be a genuine dead fallback in one component and deliberate content in
 * another.
 */
function overriddenDefaults(projectDir) {
  const { components } = readComponents(projectDir);

  // What every instance of every component actually sets, keyed
  // `componentName\u0000portName` -> Set of literal values. Built once, because
  // the alternative is a nested scan per connection.
  const suppliedByInstances = new Map();
  for (const component of components) {
    for (const node of component.nodes) {
      const params = node.parameters || {};
      for (const port of Object.keys(params)) {
        const value = params[port];
        if (typeof value !== 'string' || !value.trim()) continue;
        const key = node.type + '\u0000' + port;
        if (!suppliedByInstances.has(key)) suppliedByInstances.set(key, new Set());
        suppliedByInstances.get(key).add(value.trim());
      }
    }
  }

  const found = new Map();
  for (const component of components) {
    const byId = new Map(component.nodes.map((n) => [n.id, n]));
    for (const conn of component.connections) {
      const from = byId.get(conn.sourceId ?? conn.fromId);
      const to = byId.get(conn.targetId ?? conn.toId);
      const port = conn.targetPort ?? conn.toProperty;
      // The name of the component INPUT that feeds this port — what an instance
      // would set to override the fallback.
      const inputPort = conn.sourcePort ?? conn.fromProperty;
      if (!from || !to || from.type !== 'Component Inputs') continue;
      if (!TEXT_BEARING_PORTS.test(port)) continue;
      const hardcoded = (to.parameters || {})[port];
      if (typeof hardcoded !== 'string' || !hardcoded.trim()) continue;
      const key = hardcoded.trim();

      // 🔴 An instance of THIS component setting THIS input to THIS exact string
      // makes the picture ambiguous, so the finding must not claim it.
      const supplied = inputPort && suppliedByInstances.get(component.name + '\u0000' + inputPort);
      if (supplied && supplied.has(key)) continue;

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

/**
 * 🔴 Types whose content-shaped port draws nothing, so the derivation above must not count them.
 *
 * `Page` is the whole population and it arrived with DEF-003 (c), which declared `title` and
 * `urlPath` as real ports on the node — they had existed only as editor-pushed dynamic ports, so
 * the catalog had never seen them. `title` is in the regex above, and a `Page` is the *root* of a
 * page: the moment it counted as content-bearing, "this page draws containers and nothing else"
 * became underivable, because the empty container was itself the evidence of content. The AWP-003
 * fixture — DeepSeek V4 Pro's real turn-60 artefact, a page whose visual root is a bare `Page` —
 * went from `page-has-no-content` to `undetermined`, which is a blank page the tool can no longer
 * explain.
 *
 * ⚠️ A `Page`'s `title` is the **document** title. It reaches `Noodl.SEO.setTitle` and never the
 * screen, which is exactly why the regex's name test cannot decide this one. Any future type in
 * the same position — a content-shaped port whose value is metadata — belongs here and not in a
 * narrowed regex: `title` on a kit node that really does render it should still count.
 */
const CONTAINER_DESPITE_A_CONTENT_PORT = new Set(['Page']);

const contentTypesCache = new Map();

function contentBearingTypeNames(catalogPath = ENRICHED_CATALOG_JSON) {
  if (contentTypesCache.has(catalogPath)) return contentTypesCache.get(catalogPath);
  let names;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    names = new Set(
      (catalog.nodes || [])
        .filter(
          (n) =>
            n.isVisual === true &&
            !CONTAINER_DESPITE_A_CONTENT_PORT.has(n.typeName) &&
            (n.inputs || []).some((p) => CONTENT_BEARING_PORTS.test(p.name))
        )
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

/**
 * Which routed page the caller asked for — or a refusal that names the miss.
 *
 * ## EL-009 AC3 — the control this instrument did not have
 *
 * Until a caller could *name* a page there was no wrong answer to reject, and a
 * gate that cannot reject a wrong answer has measured nothing. The sweep added
 * in UNI-010 §8.2 visits every page the router registers, which is the right
 * default and is silent about the one case a human gets wrong most often:
 * typing the path. `--page quizz` on a project whose page is `quiz` must not
 * come back `Rendered clean` about some other page, and must not come back
 * clean about nothing.
 *
 * 🔴 The failure has to be **distinct from a clean render and from a crash**.
 * `renderReport` throws with `actionable` set, the same channel
 * {@link checkPrerequisites} uses, so `--json` callers get
 * `{error: {actionable: true, problems: [...]}}` and the MCP tool turns it into a
 * sentence. Returning an empty report would read as "that page has no defects".
 *
 * ⚠️ Accepts the shapes people actually type — `quiz`, `/quiz`, `#quiz`,
 * `/#quiz` — and the component's own name, because the report prints component
 * names (`pages: 2/3 measured — Pages/Home, Pages/Quiz`) and the obvious next
 * move is to paste one back in. `/` and the empty string mean the start page.
 *
 * @param {{pages: Array, startPage: string|undefined}} routes  from {@link routedPages}
 * @param {string} requested
 * @returns {{ok: true, page: object} | {ok: false, message: string}}
 */
function resolvePageRequest(routes, requested) {
  const raw = String(requested).trim();
  const normalised = raw.replace(/^\//, '').replace(/^#/, '').replace(/^\//, '');

  const registered = routes.pages
    .map((p) => `${p.isStart ? '/' : p.urlPath || '(no urlPath)'} (${p.component})`)
    .join(', ');

  if (!routes.pages.length) {
    return {
      ok: false,
      message:
        `Cannot render the page "${raw}": this project registers no pages at all. ` +
        'A page is reachable only when a Router node lists it in its `pages` parameter.'
    };
  }

  if (normalised === '') {
    const start = routes.pages.find((p) => p.isStart);
    if (start) return { ok: true, page: start };
  }

  const match =
    routes.pages.find((p) => p.urlPath === normalised) ||
    routes.pages.find((p) => p.component === raw || p.component === normalised);

  if (!match) {
    return {
      ok: false,
      message: `Cannot render the page "${raw}": no page registered at that path. Registered pages: ${registered}.`
    };
  }

  // Found, but this harness still cannot address it — and saying "no such page"
  // here would be a lie about a page that exists. The two refusals are kept
  // apart because they have different fixes: one is a typo, the other is a
  // missing `urlPath` or a route parameter nothing can choose a value for.
  if (!match.reachable) {
    return {
      ok: false,
      message: `The page "${raw}" is registered as ${match.component}, but this harness cannot address it: ${match.unreachable}.`
    };
  }

  return { ok: true, page: match };
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

/**
 * The settle rows as the two numbers a reader needs and one they must not skip.
 *
 * `savedMs` is measured against the ceilings THIS run used, not against a
 * remembered baseline: the saving is the budget that was not spent, and it is
 * arithmetic on rows this run produced rather than a comparison with a number
 * from another machine.
 */
function settleSummary(settles) {
  if (!settles || !settles.length) return undefined;
  const waited = settles.reduce((n, s) => n + s.waitedMs, 0);
  const ceiling = settles.reduce((n, s) => n + s.ceilingMs, 0);
  return {
    count: settles.length,
    waitedMs: waited,
    /** What the fixed timers would have slept for the same run. */
    fixedTimerMs: ceiling,
    savedMs: ceiling - waited,
    atCeiling: settles.filter((s) => !s.quiet).length,
    rows: settles
  };
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
 * How many tabs a routed-page sweep may drive at once.
 *
 * 🔴 **Tabs, never processes.** The reaper's own measurement puts one
 * `withRenderedPage` at ~260MB of Chrome plus server, and this repo routinely
 * has several sessions running one, so N drives is how a shared box goes down.
 * N tabs is N renderer processes inside ONE Chrome against ONE project server —
 * the server is a stateless `http.createServer` (`render-from-disk.js`) and does
 * not care.
 *
 * ⚠️ Four rather than "one per page": the settle budget already took the corpus
 * from 205s to 55s, so what is left to win is mostly on many-page projects, and
 * a lane that is starved of CPU settles slower, which spends the saving on
 * scheduling. Four is measured in FLD-011's what-was-built, §7.
 */
const PAGE_TABS = 4;

/**
 * FLD-011 — how long nothing may change before the page counts as settled.
 *
 * The three constants above are **ceilings now, not costs.** They were bare
 * `await wait(ms)`: on the ten-page report [#40] measured, that is 45.5s of
 * sleeping against 5.3s of CPU, and every millisecond of it was spent whether
 * the page had finished in 200ms or was still loading at the buzzer. Nothing
 * observed the page.
 *
 * 🔴 **The ceiling stays exactly what it was**, so this can never be slower
 * than the code it replaces, and at the ceiling it IS that code — a settle that
 * runs out of budget waits precisely as long as the fixed timer did and then
 * measures, which is the old behaviour, not a new failure.
 *
 * The floor is what needs defending. A budget that returns too early does not
 * report a faster number, it reports a DIFFERENT one: images that have not
 * finished loading read as broken, fonts that have not swapped read as the
 * fallback, and a real finding becomes a flake. So quiescence here is four
 * things and not one — the document loaded, the fonts ready, no image still in
 * flight, and then `QUIET_MS` with the DOM not changing.
 */
const QUIET_MS = 150;

/**
 * The gap between two polls of the quiet window.
 *
 * Small enough that `QUIET_MS` is not rounded up to something much larger than
 * itself, large enough not to be a busy loop competing with the render it is
 * waiting for.
 */
const SETTLE_POLL_MS = 25;

/**
 * Wait, in the page, until it stops changing — or until `ceilingMs` runs out.
 *
 * Runs as ONE `Runtime.evaluate` rather than a poll loop over CDP, because a
 * poll loop pays a round trip per sample and would put the thing doing the
 * measuring in the same order of magnitude as the thing being measured.
 *
 * ⚠️ `rafs` exists for the reflow case. A viewport change is often a pure CSS
 * relayout that mutates **nothing**, so mutation quiescence alone is satisfied
 * instantly and would measure a layout the browser has not performed yet. Two
 * animation frames put a real relayout between the resize and the read.
 *
 * @param {number} ceilingMs  Never wait longer than this. The old fixed timer.
 * @param {number} rafs       Animation frames to burn before the quiet window opens.
 */
function settleExpression(ceilingMs, rafs) {
  return `(async () => {
  const started = Date.now();
  const deadline = started + ${ceilingMs};
  const left = () => Math.max(0, deadline - Date.now());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reasons = [];

  // 1. The document. In hash routing a route change is not a document load at
  //    all, so this is already 'complete' and costs nothing — which is most of
  //    where PAGE_NAV_MS was going.
  if (document.readyState !== 'complete') {
    reasons.push('load');
    await Promise.race([
      new Promise((res) => window.addEventListener('load', res, { once: true })),
      sleep(left())
    ]);
  }

  // 2. Fonts. Measured text is compared against the font sets, and a page read
  //    mid-swap reports the fallback family as if the author had chosen it.
  try {
    if (document.fonts && document.fonts.status !== 'loaded') {
      reasons.push('fonts');
      await Promise.race([document.fonts.ready, sleep(left())]);
    }
  } catch (e) {
    /* no Font Loading API: fall through to the quiet window */
  }

  // 3. Images still in flight. \`broken-image\` is counted from naturalWidth, and
  //    an image that has not loaded YET is indistinguishable from one that never
  //    will — this is the finding a too-eager budget invents.
  const pending = () => Array.prototype.filter.call(document.images, (im) => !im.complete).length;
  if (pending()) reasons.push('images');
  while (left() > 0 && pending() > 0) await sleep(${SETTLE_POLL_MS});

  // 4. Two frames — which is also what lets step 5 see anything. A transition
  //    does not exist until the style recalc that starts it, so asking for the
  //    running animations before a frame has passed returns an empty list and
  //    the wait below is skipped on exactly the pages that need it.
  for (let i = 0; i < ${rafs} && left() > 0; i++) {
    // Raced against a sleep: a headless page that is never composited never
    // fires rAF, and an unraced await would burn the whole budget waiting for a
    // frame that is not coming — turning every settle back into the fixed timer.
    await Promise.race([new Promise((res) => requestAnimationFrame(() => res())), sleep(50)]);
  }

  // 5. 🔴 CSS transitions and animations, which are the reason this step exists.
  //
  //    MEASURED, not anticipated: \`project-examples/lessons/snacks\` at 390px has
  //    ONE element still at opacity 0 at 190ms and opaque at 1200ms. FLD-012's
  //    \`visible\` correctly excludes a transparent element, so the eager read
  //    counted 9 text elements where the fixed timer counted 10 — and
  //    \`flat-type-scale\` gates at **>= 10**. A settle budget with this step
  //    missing does not report a page differently; it DELETES a real finding and
  //    reports the page clean.
  //
  //    ⚠️ Only animations that will actually END are waited for. A spinner
  //    iterates forever, and \`await\`ing its \`finished\` would spend the entire
  //    budget on every page that has one — which is the fixed timer again, on the
  //    pages least able to afford it.
  try {
    const finite = (document.getAnimations ? document.getAnimations() : []).filter((anim) => {
      try {
        const timing = anim.effect.getComputedTiming();
        return Number.isFinite(timing.iterations) && Number.isFinite(timing.endTime);
      } catch (e) {
        return false;
      }
    });
    if (finite.length) {
      reasons.push('animations:' + finite.length);
      await Promise.race([Promise.allSettled(finite.map((anim) => anim.finished)), sleep(left())]);
    }
  } catch (e) {
    /* no Web Animations API: the quiet window is the only guard left */
  }

  // 6. And finally the quiet window.
  let lastChange = Date.now();
  const observer = new MutationObserver(() => {
    lastChange = Date.now();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true
  });
  try {
    while (left() > 0 && Date.now() - lastChange < ${QUIET_MS}) await sleep(${SETTLE_POLL_MS});
  } finally {
    observer.disconnect();
  }

  return {
    waitedMs: Date.now() - started,
    ceilingMs: ${ceilingMs},
    // 🔴 The honest field. \`false\` means the budget ran out and this is the OLD
    // fixed-timer behaviour — the same wait, and the same reading. A run where
    // this is false everywhere has not been sped up; it has been re-measured.
    quiet: Date.now() - lastChange >= ${QUIET_MS},
    waitedFor: reasons
  };
})()`;
}

/**
 * A booted page, handed to the body of {@link withRenderedPage}.
 *
 * @typedef {object} RenderedPage
 * @property {object} client                      Raw CDP client, for anything the helpers do not cover.
 * @property {string[]} consoleErrors             Appended to as they arrive; slice it around a step to attribute them.
 * @property {Array} settles                      FLD-011 — one row per settle performed, in order.
 * @property {() => string} serverLog             Everything `render-from-disk.js` has printed so far.
 * @property {(expression: string) => Promise<any>} evaluate  `Runtime.evaluate`, by value, throwing on exceptions.
 * @property {(viewport: object) => Promise<void>} setViewport  Set device metrics and let the reflow settle.
 * @property {(urlPath: string, ceilingMs: number) => Promise<void>} goto  Navigate with an explicit settle ceiling.
 * @property {(label?: string) => Promise<RenderedPage>} openTab  FLD-011 — another tab in the same
 *   Chrome, with its OWN console buffer and its OWN viewport. The returned object is page-shaped:
 *   `client`, `consoleErrors`, `evaluate`, `goto`, `navigate`, `setViewport`.
 * @property {(tab: object) => Promise<void>} closeTab  Give a tab back.
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
/**
 * The profile-directory prefix every drive's Chrome is given, and the string the
 * reaper below matches on. One constant so the two cannot drift.
 */
const RENDER_PROFILE_PREFIX = 'nodegx-render-';

/**
 * Kill the children a *previous* drive leaked, before this one spawns its own.
 *
 * 🔴 **Why this exists, measured.** `cleanup()` runs in a `finally`, which covers
 * a normal return and a thrown error and **nothing else**. A drive that is
 * SIGKILLed — an OOM, a `TaskStop`, a tool timeout, a `pkill` aimed at something
 * else — never runs it, and both children are reparented to init and **stay
 * there**. On 2026-09-02 that had accumulated two headless Chromes and a server
 * holding ~520MB between them; free pages went from 5,355 to 75,714 when they
 * were reaped. The suites they were starving were the ones being blamed.
 *
 * A `finally` cannot be made to survive SIGKILL, so the fix is not a better
 * handler — it is that **the next drive cleans up after the last one**. That
 * makes the harness self-healing with no configuration, in CI as much as on a
 * laptop, and it is why this runs at start rather than at exit.
 *
 * ⚠️ **`PPID === 1` is the whole safety of it.** A live drive's server and
 * Chrome are children of a running Node process; only an orphan has been
 * reparented to init. Matching on the command alone would kill a **concurrent**
 * drive — this repo routinely has several sessions running one — so the parent
 * check is not a refinement, it is the difference between a reaper and a
 * saboteur.
 */
function reapOrphanedRenderProcesses() {
  const reaped = [];
  try {
    const ps = require('child_process').execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    for (const line of ps.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
      if (!m) continue;
      const [, pid, ppid, command] = m;
      // Only orphans. See the warning above — this is load-bearing.
      if (ppid !== '1') continue;
      const isOurServer = command.includes(RENDER_SCRIPT);
      const isOurChrome = command.includes(`--user-data-dir=`) && command.includes(RENDER_PROFILE_PREFIX);
      if (!isOurServer && !isOurChrome) continue;
      try {
        process.kill(Number(pid), 'SIGKILL');
        reaped.push(`${pid} ${isOurServer ? 'render-from-disk' : 'chrome'}`);
      } catch {
        /* already gone, or not ours to kill */
      }
    }
  } catch {
    // No `ps` (or an unexpected platform): the reaper is an optimisation, never
    // a prerequisite. A drive must still run on a machine where it cannot look.
    return [];
  }

  // The abandoned profile directories too — each is a few MB and they never
  // expire on their own. Only ones with no live owner are left by the loop above.
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (!name.startsWith(RENDER_PROFILE_PREFIX)) continue;
      const dir = path.join(os.tmpdir(), name);
      try {
        // A profile still being written to belongs to a live drive; an hour is
        // far longer than any drive in this repo takes.
        if (Date.now() - fs.statSync(dir).mtimeMs < 60 * 60 * 1000) continue;
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* raced with its owner, or not ours */
      }
    }
  } catch {
    /* tmpdir unreadable — nothing to do */
  }

  if (reaped.length) console.error(`[render] reaped ${reaped.length} orphaned process(es): ${reaped.join(', ')}`);
  return reaped;
}

/**
 * Tell one tab it is visible and focused, whatever the browser thinks.
 *
 * 🔴 **This is the difference between a parallel sweep that works and one that
 * reports `blank-render`, and it was found by measuring, not by reading.** In a
 * single headless Chrome only ONE tab is foreground. The moment
 * `Target.createTarget` opens the second, the first is backgrounded: its
 * `requestAnimationFrame` stops being serviced, so the viewer never finishes
 * mounting, the settle waits out its whole ceiling and the page is measured
 * **empty**. The first arm of this measured `/business` as two `blank-render`
 * findings, in 2,953ms of navigation and two viewport settles at the ceiling,
 * against 308ms and a clean read on the same page in the same build with one
 * lane. A faster report that reads a rendered page as blank is not a faster
 * report.
 *
 * `setFocusEmulationEnabled` is the same call
 * [[cdp-keys-need-focus-emulation-on-the-same-connection]] records for keyboard
 * input, for the same underlying reason, and it has the same constraint: it is
 * **per session**, so it must be sent on the connection that does the measuring
 * and it dies with it.
 *
 * ⚠️ Best-effort on purpose. Both calls are optional-domain conveniences, and a
 * Chrome that refuses one must not take the drive down — the settle ceiling is
 * what catches a page that then fails to render, which is the behaviour this
 * whole function exists to avoid relying on.
 */
async function unthrottle(client) {
  for (const [method, params] of [
    ['Emulation.setFocusEmulationEnabled', { enabled: true }],
    ['Page.setWebLifecycleState', { state: 'active' }]
  ]) {
    try {
      await client.send(method, params);
    } catch {
      /* an older Chrome, or a target that does not take it */
    }
  }
}

/**
 * One CDP page session: its own client, its own console buffer, its own viewport.
 *
 * 🔴 **FLD-011 AC3 — the console buffer is per TAB, and that is the whole of why
 * parallelising the page sweep is safe.** This used to be one array closed over
 * by `withRenderedPage`, with errors attributed to pages by slicing it around
 * each measurement (`slice(loggedBefore)`). **Index slicing is a claim that
 * nothing else wrote to the array in between** — true of a serial loop, false
 * the moment two pages are live at once, and the failure is silent: page 7's
 * exception lands in page 3's row and both rows read plausibly. A buffer per tab
 * **removes** the shared state rather than locking it; there is no interleaving
 * left to attribute.
 *
 * ⚠️ `Emulation.setDeviceMetricsOverride` is per SESSION, not per document, which
 * is the other half of why tabs work where one tab could not: two pages being
 * measured at two viewports would otherwise be resizing each other.
 *
 * @param {object} o
 * @param {string} o.wsUrl        `webSocketDebuggerUrl` of the page target.
 * @param {number} o.servePort    The project server this tab navigates against.
 * @param {Array}  o.settles      The drive's settle log; every tab appends to it.
 * @param {string} [o.label]      Which tab a settle row came from. **Absent on the
 *   primary tab**, so a serial drive's rows are shaped exactly as they were.
 */
async function attachTab({ wsUrl, servePort, settles, label }) {
  const consoleErrors = [];
  const client = await connect(wsUrl, (msg) => {
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

  const settle = async (what, ceilingMs, rafs) => {
    const stat = await evaluate(client, settleExpression(ceilingMs, rafs));
    settles.push({ what, ...(label ? { tab: label } : {}), ...stat });
    return stat;
  };

  /**
   * Go somewhere and let it settle, with the ceiling the caller knows applies.
   *
   * 🔴 The ceiling is a **parameter** because a fresh tab's first navigation is a
   * document load and every later one is a `hashchange`. Handing a fresh tab
   * `PAGE_NAV_MS` would budget a whole viewer boot against a route change — the
   * settle would run out of budget rather than observe quiescence, and the page
   * would be measured mid-boot. That is a wrong reading, not a slow one.
   */
  const goto = async (urlPath, ceilingMs) => {
    await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}${urlPath}` });
    await settle(`navigate ${urlPath}`, ceilingMs, 2);
  };

  return {
    client,
    consoleErrors,
    settle,
    goto,
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
    navigate: (urlPath) => goto(urlPath, PAGE_NAV_MS),
    async setViewport(vp) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: Boolean(vp.mobile)
      });
      await settle(`viewport ${vp.name}`, REFLOW_MS, 2);
    },
    close() {
      try {
        client.close();
      } catch {
        /* already gone */
      }
    }
  };
}

async function withRenderedPage(options, fn) {
  const { projectDir, backendPort, editorTokens = false } = options;

  // Before anything else: take down what a killed drive left behind. See
  // `reapOrphanedRenderProcesses` for why this is at the start and not the end.
  reapOrphanedRenderProcesses();

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

  /**
   * The extra tabs `openTab` handed out, and the browser-level session that made
   * them. Declared out here, above `cleanup`, because a lane that throws mid-sweep
   * must not leak a socket: `cleanup` closes whatever is still open, and a caller
   * that never asks for a tab pays for neither.
   */
  const extraTabs = [];
  let browserClient;

  let cleanedUp = false;
  const cleanup = (client) => {
    if (cleanedUp) return;
    cleanedUp = true;
    for (const tab of extraTabs) tab.close();
    try {
      if (browserClient) browserClient.close();
    } catch {
      /* already gone */
    }
    try {
      if (client) client.close();
    } catch {
      /* already gone */
    }
    chrome.kill();
    server.kill();
    fs.rm(profile, { recursive: true, force: true }, () => {});
  };

  /**
   * The signals a `finally` does not see.
   *
   * ⚠️ **This does not cover SIGKILL and cannot** — nothing can. It closes the
   * gap for every *graceful* kill (Ctrl-C, a test runner shutting a worker down,
   * a `kill` with no `-9`), which is most of them; the reaper at the top of this
   * function is what covers the rest, one drive later. Two mechanisms because
   * the failure has two shapes, and neither alone leaves the machine clean.
   *
   * `once` per signal, and the handlers are removed in `finally`, so a caller
   * that runs many drives in one process does not accumulate listeners — that
   * would be this function leaking a different resource to fix a leak.
   */
  const onSignal = (signal) => () => {
    cleanup(undefined);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  const handlers = [
    ['SIGINT', onSignal('SIGINT')],
    ['SIGTERM', onSignal('SIGTERM')],
    ['SIGHUP', onSignal('SIGHUP')],
    ['exit', () => cleanup(undefined)]
  ];
  for (const [event, handler] of handlers) process.once(event, handler);
  const releaseHandlers = () => {
    for (const [event, handler] of handlers) process.removeListener(event, handler);
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

    const target = targets.find((t) => t.type === 'page');

    /**
     * FLD-011 — every settle this drive performed, so the speed claim can be
     * read rather than believed. `quiet: false` is a settle that ran out of
     * budget and therefore behaved exactly like the fixed timer it replaced.
     *
     * One array for the whole drive, including the tabs `openTab` hands out: a
     * per-tab log would make `report.settle` an account of the primary tab only,
     * and the sweep is where most of the waiting is. Rows from a helper tab carry
     * a `tab` field; rows from this one do not.
     */
    const settles = [];
    const main = await attachTab({ wsUrl: target.webSocketDebuggerUrl, servePort, settles });
    client = main.client;

    /**
     * Another tab in the SAME Chrome, against the SAME server.
     *
     * 🔴 **One Chrome, one server, N tabs — never N processes.** See `PAGE_TABS`.
     *
     * The browser-level session is opened **lazily**, on the first tab anybody
     * asks for, so a drive that never sweeps in parallel opens exactly the one
     * socket it always did.
     *
     * ⚠️ Each tab gets a `webSocketDebuggerUrl` of its own rather than a flat
     * `Target.attachToTarget` session on this socket. The flat protocol would put
     * every tab's `Runtime.consoleAPICalled` on one connection — which is the
     * shared state {@link attachTab} exists to remove, re-introduced one layer
     * down and harder to see.
     */
    const openTab = async (label) => {
      if (!browserClient) {
        const version = await httpJson(cdpPort, '/json/version');
        browserClient = await connect(version.webSocketDebuggerUrl);
        // 🔴 The primary tab too, and BEFORE the second tab exists. See
        // `unthrottle`: creating a tab is what backgrounds the one that was
        // there, and the first thing that happened to it was being measured.
        await unthrottle(main.client);
      }
      const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
      let described;
      for (let i = 0; i < 40 && !described; i++) {
        const list = await httpJson(cdpPort, '/json/list');
        described = list.find((t) => t.id === targetId && t.webSocketDebuggerUrl);
        if (!described) await wait(50);
      }
      if (!described) throw new Error('a tab was created and never appeared in /json/list with a debugger URL');
      const tab = await attachTab({ wsUrl: described.webSocketDebuggerUrl, servePort, settles, label });
      await unthrottle(tab.client);
      tab.targetId = targetId;
      extraTabs.push(tab);
      return tab;
    };

    /**
     * Give a tab back: close its session, then close the tab itself.
     *
     * A sweep that left its tabs open until `cleanup` would hold four renderer
     * processes for the rest of the drive — the screenshots, the summary and the
     * project read all happen after it — for no reason.
     */
    const closeTab = async (tab) => {
      tab.close();
      const at = extraTabs.indexOf(tab);
      if (at !== -1) extraTabs.splice(at, 1);
      try {
        if (tab.targetId) await browserClient.send('Target.closeTarget', { targetId: tab.targetId });
      } catch {
        /* the browser is going away anyway */
      }
    };

    await main.client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}/` });
    await main.settle('boot', BOOT_MS, 2);

    return await fn({
      client,
      consoleErrors: main.consoleErrors,
      settles,
      serverLog: () => serverLog,
      servePort,
      evaluate: main.evaluate,
      goto: main.goto,
      navigate: main.navigate,
      setViewport: main.setViewport,
      openTab,
      closeTab
    });
  } finally {
    cleanup(client);
    releaseHandlers();
  }
}

/**
 * Render `projectDir` and measure it.
 *
 * @param {object} options
 * @param {string} options.projectDir           v2 project directory.
 * @param {Array}  [options.viewports]          `[{name, width, height, mobile}]`.
 * @param {'full'|'viewport'|'none'} [options.screenshot='full']
 * @param {'start'|'all'} [options.screenshotPages='start'] Which pages to photograph. `start` is
 *   the historical behaviour and stays the default **on purpose**: `render_report` returns its
 *   screenshots to a model as image content, and turning this on by default would hand an agent
 *   ten pictures where it asked for two, for every project with five pages. HLS-007's `--out-dir`
 *   is the caller that wants `all`, and it writes them to disk rather than into a context window.
 * @param {number} [options.deviceScaleFactor=0.5]  Screenshot scale — 0.5 keeps a full page around 500KB.
 * @param {number} [options.backendPort]        Backend to proxy `/__backend` to, if the project has one.
 * @param {boolean}[options.editorTokens=false] Mirror a running editor's tokens (see render-from-disk.js).
 * @param {boolean}[options.renderRoutedPages=true] Visit every routed page, not only the start page
 *   (UNI-010 §8.2). Defaults to **on**: leaving it off by default would have shipped the fix and
 *   left every existing caller — F4 included — reading the same one-page report it always did.
 *   Each extra page costs one navigation plus one measurement per viewport.
 * @param {number} [options.concurrency=PAGE_TABS] FLD-011 — how many tabs the routed-page sweep may
 *   drive at once. `1` is the serial sweep this replaced, navigation for navigation, and is the
 *   baseline every speed claim on this function is measured against.
 * @param {string} [options.page]              Measure only this page, named by its `urlPath` (EL-009
 *   AC1/AC3) — `quiz`, `/quiz`, `#quiz` or the component name; `/` is the start page. A path no
 *   router registers is an **actionable throw**, never an empty report. Implies no sweep: the
 *   caller asked for one page and paying ~4.3s each for the rest is not what they asked.
 * @returns {Promise<{report: object, screenshots: Array<{name: string, page: string, isStart: boolean, mimeType: string, base64: string}>}>}
 *   `name` is the viewport; `page` is the component the picture is of; `subject` marks the page
 *   this report is *about* (the start page, or the `--page` one). With the default
 *   `screenshotPages: 'start'` every entry has `subject: true`, which is why `name` alone was
 *   enough to key a filename for two years and is not any more.
 */
async function renderReport(options) {
  const {
    projectDir,
    viewports = DEFAULT_VIEWPORTS,
    screenshot = 'full',
    screenshotPages = 'start',
    deviceScaleFactor = 0.5,
    backendPort,
    editorTokens = false,
    renderRoutedPages = true,
    page: requestedPage,
    concurrency = PAGE_TABS
  } = options;

  const started = Date.now();

  // 🔴 EL-009 AC3 — resolved BEFORE the browser starts, on purpose. A typo'd
  // path is a caller error that a disk read can settle, and `render.ts` records
  // what the other shape costs: a spec meaning to assert "no harness at all"
  // instead waited eight seconds for one. Refusing early also means the refusal
  // cannot be confused with a render that failed.
  const routes = routedPages(projectDir);
  let focus;
  if (requestedPage !== undefined) {
    const resolved = resolvePageRequest(routes, requestedPage);
    if (!resolved.ok) {
      const error = new Error(resolved.message);
      error.problems = [resolved.message];
      error.actionable = true;
      throw error;
    }
    focus = resolved.page;
  }

  return withRenderedPage({ projectDir, backendPort, editorTokens }, async (page) => {
    // AWP-004 §3 — the catalog's defaults, plus this project's own fallbacks on
    // ports a Component Inputs node feeds. Neither source can see the other's
    // strings, and Kimi's three were all in the second.
    const overridden = Object.fromEntries(overriddenDefaults(projectDir));
    const placeholders = [...new Set([...placeholderStrings(), ...Object.keys(overridden)])];

    // UNI-010 §8.2 — a probe is evidence about the page that can contain it.
    // See `reachableComponents`: project-wide probes measured against one page
    // is how a correct eight-page project scored 14 `empty-list` errors.
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

    // 🔴 EL-009 AC1 — the primary measurement is the page the caller NAMED.
    // Everything below it (viewports, screenshots, findings, the summary line)
    // describes `subject`, which is the start page unless `page` named another.
    // Measuring the start page as well and appending the requested one would
    // have been a smaller edit and the wrong product: the caller asked about one
    // page, and every extra page costs a navigation and a measurement per
    // viewport (~4.3s), on top of findings from a page nobody asked about.
    const subject = focus || routes.pages.find((pg) => pg.isStart);
    const subjectComponent = subject ? subject.component : routes.startPage;
    const focusedOffStart = Boolean(focus && !focus.isStart);
    if (focusedOffStart) await page.navigate(focus.url);

    const measured = {};
    const screenshots = [];

    /**
     * One PNG, of whatever is on screen now.
     *
     * HLS-007 — extracted so the routed-page sweep below captures through the
     * *same* call the start page does. Two capture sites with the same options
     * spelled twice is how the start page ends up with `captureBeyondViewport`
     * and page four ends up with a 900px crop of a 3,000px page, and neither
     * picture would look wrong on its own.
     *
     * 🔴 `name` stays the viewport name and nothing else, because that is what
     * `measure-from-disk.js --out` and `render_report`'s `--inline-screenshots`
     * have always read. `page` is additive: a caller that does not know about
     * it keeps the behaviour it had, and a caller that asks for every page
     * needs it to name the file.
     *
     * ⚠️ `subject` is NOT `isStart`, and the difference is `--page`. The subject
     * is whichever page this report is *about* — the start page normally, the
     * focused one under `--page quiz` — and it is the one `--out` has always
     * written. Calling the field `isStart` would have made it **false** for a
     * focused page and silently stopped `--out --page quiz` writing anything,
     * or **true** for a page that is not the start page. Neither is a thing to
     * be wrong about in a field a filename is keyed on.
     */
    const capture = async (vp, raw, component, subject, client = page.client) => {
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
      return { name: vp.name, page: component, subject, mimeType: 'image/png', base64: shot.data };
    };

    const expression = measureExpression(placeholders, probesFor(subjectComponent));

    /**
     * How far into the console buffer has already been attributed to a row.
     *
     * 🔴 **It starts at 0, and FLD-011 AC3 is why.** The comment this replaces said the first
     * viewport's window *"includes the boot, which is where it belongs"* — and the code read
     * `page.consoleErrors.length` at the top of the loop, which is the length **after** the boot, so
     * every error the boot produced was in neither row. The watermark also **closes** each window at
     * the read rather than leaving it open, so the windows are disjoint and every error lands in
     * exactly one of them: nothing is dropped and nothing is counted twice.
     *
     * ⚠️ This was invisible from the report and from the code, and it is a hole shaped like the
     * finding it hides: `console-error` is the one rule whose whole evidence is this array, and the
     * errors most worth reporting are the ones a page throws while it is loading. It took a fixture
     * that shouted on purpose to see it.
     */
    let loggedThrough = 0;
    for (const vp of viewports) {
      const loggedBefore = loggedThrough;
      await page.setViewport(vp);

      const raw = await page.evaluate(expression);
      loggedThrough = page.consoleErrors.length;
      measured[vp.name] = {
        requested: { width: vp.width, height: vp.height },
        ...raw,
        consoleErrors: page.consoleErrors.slice(loggedBefore, loggedThrough)
      };

      if (screenshot !== 'none') {
        screenshots.push(await capture(vp, raw, subjectComponent, true));
      }
    }

    // AWP-003 — computed only when something is blank, because it is an
    // explanation of an observed blank and never a prediction of one.
    const blank = Object.values(measured).some((v) => v && !v.error && v.text.elements === 0 && v.images.total === 0);
    // ⚠️ `blankDiagnosis` walks from the start page and every sentence it
    // produces names it, so a blank *other* page must not be explained by it —
    // the same reason the sweep below passes `undefined`. Attributing the start
    // page's causes to page three is a confident wrong answer, which is worse
    // than the "not determined" the message below says instead.
    const diagnosable = blank && !focusedOffStart;
    const { findings: rawFindings, summary } = summarise(
      measured,
      diagnosable ? blankDiagnosis(projectDir) : undefined,
      overridden
    );
    const findings = !focusedOffStart
      ? rawFindings
      : rawFindings.map((f) => ({
          ...f,
          page: subjectComponent,
          message:
            f.code === RenderFinding.BlankRender
              ? `The routed page "${subjectComponent}" rendered nothing at all — no text and no images. ` +
                'Only the start page is diagnosed against the graph, so the cause was not determined here.'
              : `On the routed page "${subjectComponent}": ${f.message}`
        }));

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
    /**
     * FLD-011 — how the sweep was driven, when there was one to drive. Absent on
     * a report that swept nothing, so `sweep` in a report always describes work
     * that happened; `tabs: 1` is the serial path saying so in the artefact.
     */
    let sweep;

    if (focus) {
      // Named-page mode: `pages` still carries a row, because a report whose
      // `pages` is empty reads as "this project has none" — which is what the
      // no-router control legitimately reports, and the two must not look alike.
      pageReports.push({ ...focus, measured: true, viewports: measured });
    } else if (renderRoutedPages) {
      /**
       * FLD-011 — the sweep, across tabs.
       *
       * 🔴 **Rows are filled BY INDEX and the findings flattened in index order
       * afterwards, so a parallel report is in route order exactly like a serial
       * one.** A faster report that lists its pages in finishing order is a
       * *different* report, and AC4 asks for the same one. The nondeterminism of
       * a race is not allowed to reach the artefact — only the wall clock.
       *
       * 🔴 **`concurrency: 1` takes lane 0 and nothing else**, which is the same
       * navigate/measure sequence on the same tab the serial loop performed. That
       * is what makes it the honest baseline for the speed claim: the arms differ
       * by the number of lanes and by nothing else.
       */
      const rows = new Array(routes.pages.length);
      const findingsByPage = new Array(routes.pages.length);
      const shotsByPage = new Array(routes.pages.length);
      const todo = [];
      routes.pages.forEach((p, i) => {
        if (p.isStart) {
          rows[i] = { ...p, measured: true, viewports: measured };
        } else if (!p.reachable) {
          // Reported, not dropped. A page this harness cannot address is a limit
          // of the instrument, and an instrument that hides its own blind spots
          // is what this whole section exists to correct.
          rows[i] = { ...p, measured: false };
        } else {
          todo.push({ p, i });
        }
      });

      /**
       * One routed page, on whichever tab is free.
       *
       * `firstInTab` is not a detail: a tab that has just been created is at
       * `about:blank`, so its first navigation is a document load and gets the
       * boot ceiling. Every later one is a `hashchange` and gets the route
       * ceiling. Lane 0 is the primary tab, which has already booted, so it is
       * never "first" — its first sweep navigation is the same route change the
       * serial loop performed.
       */
      const measureRoutedPage = async (p, i, tab, firstInTab) => {
        // 🔴 Read BEFORE the navigation, so the errors the page logs *while loading* belong to it.
        // Taken after, they belonged to nobody — see `loggedThrough` on the start page above, which
        // is the same defect on the same array, and the reason this fixture had to shout to be heard.
        let loggedThrough = tab.consoleErrors.length;
        await tab.goto(p.url, firstInTab ? BOOT_MS : PAGE_NAV_MS);
        const pageExpression = measureExpression(placeholders, probesFor(p.component));
        const pageMeasured = {};
        const shots = [];
        for (const vp of viewports) {
          // 🔴 The window is over THIS tab's buffer. See `attachTab`: one buffer
          // per tab is what makes this attribution true under parallelism, and
          // slicing a shared one is what made it false.
          const loggedBefore = loggedThrough;
          await tab.setViewport(vp);
          const raw = await tab.evaluate(pageExpression);
          loggedThrough = tab.consoleErrors.length;
          pageMeasured[vp.name] = {
            requested: { width: vp.width, height: vp.height },
            ...raw,
            consoleErrors: tab.consoleErrors.slice(loggedBefore, loggedThrough)
          };
          // HLS-007 / C40 — a picture of page four, which nothing produced before.
          if (screenshot !== 'none' && screenshotPages === 'all') {
            shots.push(await capture(vp, raw, p.component, false, tab.client));
          }
        }

        // No `blankDiagnosis` for these: that walk is a start-page walk and every
        // sentence it produces names the start page. Passing `undefined` would
        // make a blank routed page report "No project was available to diagnose
        // it against", which is false — a project was available. The message is
        // rewritten below instead, to say only what was actually established.
        const perPage = summarise(pageMeasured, undefined, overridden);
        findingsByPage[i] = perPage.findings.map((f) => ({
          ...f,
          page: p.component,
          message:
            f.code === RenderFinding.BlankRender
              ? `The routed page "${p.component}" rendered nothing at all — no text and no images. ` +
                'Only the start page is diagnosed against the graph, so the cause was not determined here.'
              : `On the routed page "${p.component}": ${f.message}`
        }));
        shotsByPage[i] = shots;
        rows[i] = { ...p, measured: true, viewports: pageMeasured, summary: perPage.summary };
      };

      if (todo.length) {
        const lanes = Math.max(1, Math.min(Math.floor(Number(concurrency)) || 1, todo.length));
        // A shared cursor rather than a slice per lane: the pages cost different
        // amounts (a blank one settles in milliseconds, a template's eleventh does
        // not), and a fixed split leaves the last lane holding the expensive half.
        let cursor = 0;
        const lane = async (tab, ownTab) => {
          let firstInTab = ownTab;
          for (;;) {
            const at = cursor++;
            if (at >= todo.length) return;
            await measureRoutedPage(todo[at].p, todo[at].i, tab, firstInTab);
            firstInTab = false;
          }
        };

        const helpers = [];
        try {
          for (let k = 1; k < lanes; k++) helpers.push(await page.openTab(`tab${k}`));
          await Promise.all([lane(page, false), ...helpers.map((tab) => lane(tab, true))]);
        } finally {
          // Handed back here rather than left to `cleanup`: everything after this
          // — the screenshots, the summary, the project read — would otherwise
          // hold four renderer processes for no reason. In a `finally` because a
          // lane that throws must not leak them either.
          for (const tab of helpers) await page.closeTab(tab);
        }
        sweep = { pages: todo.length, tabs: lanes };
      }

      for (const row of rows) if (row) pageReports.push(row);
      for (const list of findingsByPage) if (list) extraFindings.push(...list);
      for (const list of shotsByPage) if (list) screenshots.push(...list);

      if (pageReports.some((p) => p.measured && !p.isStart)) await page.navigate('/');
    }

    const allFindings = [...findings, ...extraFindings];
    // Recomputed, because the headline is the sentence most readers stop at and
    // "Rendered clean" over a broken fourth page is the exact failure this task
    // is closing. The shape half stays the start page's; the counts now cover
    // every page measured, and each borrowed finding names its page.
    let allSummary = extraFindings.length ? summaryLine(measured, allFindings) : summary;

    // 🔴 A summary must not out-claim its coverage — the rule the skip notice
    // below was added for, applied to the other direction. "Rendered clean" from
    // a run that looked at ONE named page is true of that page and false of the
    // app, and this is the sentence readers stop at.
    if (focus) {
      allSummary += ` (page "${focus.isStart ? '/' : focus.urlPath}" only — the rest of this project was not looked at.)`;
    }

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
        /**
         * FLD-011 — what the settle budget actually cost, beside what the fixed
         * timers it replaced would have.
         *
         * 🔴 `atCeiling` is the field that keeps the speed claim honest: those
         * settles waited the full old timer and read what the old code read. A
         * run where `atCeiling` equals `count` was not made faster at all, and
         * `savedMs` on such a run is zero rather than a number to quote.
         */
        settle: settleSummary(page.settles),
        ...(sweep ? { sweep } : {}),
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
  // Exported so a session-teardown hook, a CI step or a spec can reap without
  // starting a drive — the leak outlives the run that caused it.
  reapOrphanedRenderProcesses,
  routedPages,
  resolvePageRequest,
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
  // VIB-007 M3 — the poverty thresholds, so a spec reads README §2's number
  // rather than restating it.
  DISPLAY_TYPE_MIN_PX,
  MIN_DISTINCT_GROUNDS,
  POVERTY_MIN_TEXTS,
  POVERTY_FINDINGS,
  isPovertyFinding,
  checkPrerequisites,
  findChrome,
  freePort,
  // HLS-015 — the CDP pair, exported so a drive that boots something OTHER than a project
  // directory can still talk to a page. `withRenderedPage` boots the viewer against project
  // FILES; `nodegx deploy`'s output is a finished site with no project in it, so it needs the
  // plumbing without the booting. The alternative was a second copy of `connect` in a sibling
  // script, which is the thing the comment above `withRenderedPage` says not to do.
  connect,
  evaluate,
  httpJson,
  parseViewports,
  RenderFinding,
  DEFAULT_VIEWPORTS,
  DESKTOP_WIDTH,
  // FLD-011 — the default tab count, so a spec asserts the shipped number rather than restating it.
  PAGE_TABS,
  VIEWER_BUNDLE,
  RENDER_SCRIPT
};
