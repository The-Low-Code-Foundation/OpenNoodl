/**
 * The project-scoped catalog overlay (CN-003, phase 69).
 *
 * ## The problem this exists for
 *
 * `node-catalog.json` is generated from the **live register of built-ins only**
 * (`scripts/node-catalog/extractor-entry.js`). A project's own kit nodes — the
 * ones under `noodl_modules/` — cannot be in it: the catalog is built at
 * repo-build time and kits exist per project, per machine. Every consumer of the
 * catalog is therefore uninformed about custom nodes in a way that reads as
 * approval: `unknown-node-type` warns, and then `parameterValues.ts` and the
 * port/connection rules **skip the node entirely** (CN-002 made that skip say so
 * out loud). Custom nodes are accepted but unverified.
 *
 * This package builds the missing half — catalog-shaped entries for the kit
 * nodes of one project — and merges it over the built-in catalog.
 *
 * ## Why the mapping starts from the node-library payload
 *
 * ⚠️ **This differs from CN-003's written spec and the difference is deliberate.**
 * The spec had the MCP server extract via `buildCatalog` (the built-in
 * generator's own shaping) and the editor map from what the viewer sent, which
 * is two mappings for one set of facts — the exact duplication the phase exists
 * to end, and a permanent source of the divergence D3 accepted as a risk.
 *
 * Both routes can produce the *same* input instead. `generateNodeLibrary`
 * (`@noodl/runtime/src/nodelibraryexport`) is what the viewer sends the editor
 * over `sendNodeLibrary`, and a headless extractor that registers a kit against
 * a live register can call the very same function. So:
 *
 * - **editor**: takes the payload it already holds (`NodeLibrary.instance`) —
 *   a read of existing state, not an execution, exactly as D3 requires.
 * - **MCP server**: executes the kit headlessly and calls `generateNodeLibrary`
 *   on the resulting register.
 * - **both**: hand that payload to {@link catalogNodesFromNodeLibrary} here.
 *
 * One mapping, one shape, and the agreement obligation D3 wrote into the ruling
 * narrows to the question that actually carries risk: *do the two registers
 * agree* — not *do two hand-written mappings agree*. {@link compareOverlays} is
 * that check, and it names what diverged rather than only failing.
 *
 * `buildCatalog` is left completely untouched, which is also how CN-003's
 * acceptance criterion 4 (`catalog:check` compares generated output
 * byte-for-byte) is met by construction rather than by care.
 *
 * ## What is knowingly not derived
 *
 * Two catalog fields cannot be recovered from the payload, and both are recorded
 * as knowingly-absent rather than guessed — the same reasoning as the
 * validator's `DynamicPortSkipped` and CN-002's `unknown-type-check-skipped`:
 *
 * - **`parameterEncoding`** — the built-in generator derives it by *driving* the
 *   node's dynamic-port hook with seed parameters (`derive-encoding.js`), which
 *   needs the raw definition and a running node. Overlay entries carry
 *   `{ known: false, reason }`. **CN-010 owns closing this.**
 * - **`ssr`** — `createNodeFromReactComponent` puts an `ssr` key in the register
 *   metadata but `generateNodeLibrary` does not export it, so the payload cannot
 *   say. Left absent, which for an overlay node means *not assessed*, never
 *   *safe*. **CN-013 owns it.**
 *
 * @module @nodegx/kit-catalog
 */

/**
 * `providedBy` for a node a project's own kit declares.
 *
 * The generated `CatalogNode['providedBy']` union covers the four shipped
 * sources only, and `node-catalog.d.ts` is a generated file. This value widens
 * it for overlay entries — ✅ **D1** wants provenance shown in the property
 * panel and CN-004 needs it to decide what `--strict` may fail on, so it has to
 * survive the merge rather than be flattened away.
 */
const KIT_PROVENANCE = 'project-kit';

/**
 * Port-type specs arrive either as a bare name (`"string"`) or as an object
 * (`{ name: 'string', allowEditOnly: true }`) — both shapes are in the cashflow
 * kit's payload. The catalog always stores the object form.
 *
 * ⚠️ Deliberately a private copy of `scripts/node-catalog/lib/sanitize.js`'s
 * `normalizeType` rather than an import: `scripts/` is outside every shipped
 * package's `files`/`build.files` (the open F4 hole P67 recorded), so a package
 * the MCP server depends on cannot reach into it. The copy is small and, more to
 * the point, it is **guarded** — if it ever drifts from the generator's, the two
 * routes produce different port types for the same node and
 * {@link compareOverlays} says so by name. That is the safety net this design
 * bought; do not silence it by making one side call the other.
 *
 * @param {unknown} type
 * @returns {{ name: string, [extra: string]: unknown }}
 */
function normalizePortType(type) {
  if (typeof type === 'string') return { name: type };
  if (type && typeof type === 'object') {
    const t = /** @type {Record<string, unknown>} */ (type);
    return typeof t.name === 'string' ? { ...t, name: t.name } : { ...t, name: '*' };
  }
  return { name: '*' };
}

/**
 * One exported port → one `CatalogPort`.
 *
 * Field order matches `buildPort` in `scripts/node-catalog/lib/build-catalog.js`
 * so a reader diffing an overlay entry against a built-in entry is comparing
 * like with like.
 *
 * @param {import('./index').ExportedPort} port
 * @returns {import('./index').OverlayCatalogPort}
 */
function toCatalogPort(port) {
  const type = normalizePortType(port.type);
  /** @type {import('./index').OverlayCatalogPort} */
  const out = {
    name: port.name,
    plug: port.plug === 'output' ? 'output' : 'input',
    type,
    // A signal port is identified by its type, exactly as the generator does.
    isSignal: type.name === 'signal'
  };
  if (port.displayName !== undefined) out.displayName = port.displayName;
  if (port.editorName !== undefined) out.editorName = port.editorName;
  if (port.group !== undefined) out.group = port.group;
  if (port.default !== undefined) out.default = port.default;
  if (port.description !== undefined) out.description = port.description;
  if (port.index !== undefined) out.index = port.index;
  if (port.allowVisualStates !== undefined) out.allowVisualStates = port.allowVisualStates;
  return out;
}

/** Ports carry both plugs in one list; the catalog splits them and sorts by name. */
function splitPorts(ports) {
  const inputs = [];
  const outputs = [];
  for (const p of ports || []) {
    // 'input/output' exists in the export; it belongs in both lists.
    if (p.plug === 'output' || p.plug === 'input/output') outputs.push(toCatalogPort({ ...p, plug: 'output' }));
    if (p.plug === 'input' || p.plug === 'input/output') inputs.push(toCatalogPort({ ...p, plug: 'input' }));
  }
  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { inputs: inputs.sort(byName), outputs: outputs.sort(byName) };
}

/**
 * One exported `dynamicports` entry → the group shape the catalog stores.
 *
 * 🔴 **The two vocabularies do not match, and CN-004 was the first thing to
 * read the result.** `formatDynamicPorts` (`@noodl/runtime/nodelibraryexport`)
 * emits a conditional group as `{ name, condition, ports: [portObject] }`,
 * while the shipped catalog stores `{ condition, inputs: [name] }` and every
 * consumer reads the latter — `conditionForInput` filters on `g.inputs`,
 * `CatalogIndex.computePortNames` folds in `g.inputs`/`g.outputs`. Handing the
 * raw exported entry through meant a kit's conditions were never found, so
 * `InactiveConditionalParameter` and `InertDimension` could not fire on a kit
 * node at all. Translate here, once, where both shapes are in view.
 *
 * @param {Record<string, unknown>} entry
 * @returns {{ condition?: string, inputs?: string[], outputs?: string[] }}
 */
function toDeclaredPortGroup(entry) {
  /** @type {{ condition?: string, inputs?: string[], outputs?: string[] }} */
  const group = {};
  if (typeof entry.condition === 'string') group.condition = entry.condition;

  // The name-list form, when a kit already writes what the editor expects.
  const inputs = Array.isArray(entry.inputs) ? entry.inputs.filter((n) => typeof n === 'string') : [];
  const outputs = Array.isArray(entry.outputs) ? entry.outputs.filter((n) => typeof n === 'string') : [];

  // The exported form: one `ports` array carrying both plugs.
  for (const port of Array.isArray(entry.ports) ? entry.ports : []) {
    if (!port || typeof port.name !== 'string') continue;
    if (port.plug === 'output' || port.plug === 'input/output') outputs.push(port.name);
    if (port.plug === 'input' || port.plug === 'input/output' || port.plug === undefined) inputs.push(port.name);
  }

  if (inputs.length) group.inputs = inputs;
  if (outputs.length) group.outputs = outputs;
  return group;
}

/**
 * `dynamicPorts` as far as the payload can say.
 *
 * The generator detects further mechanisms by inspecting the raw definition's
 * function sources; none of that survives into the payload. What does survive is
 * a node's *declared* `dynamicports` — and that list is **not one mechanism**.
 * `formatDynamicPorts` passes four entry shapes through:
 *
 * | Entry carries | What it means | Mechanism |
 * |---|---|---|
 * | `ports` / `inputs` / `outputs` + `condition` | a fixed, enumerable set switched on by a sibling parameter | `declared-port-groups` |
 * | `template` | ports minted per item at runtime — the names cannot be known | `runtime-discovered` |
 * | `port` | a single port whose *name* comes from another parameter's value | `runtime-discovered` |
 * | `channelPort` | a port named by a channel, and **excluded from the static `ports` list** by the exporter | `runtime-discovered` |
 *
 * 🔴 Calling all four `declared-port-groups`, as this did until CN-004,
 * inverts the carve-out `checkParameterValues` makes: `hasRuntimeDynamicPorts`
 * returns false, so a port the kit genuinely creates at runtime is reported as
 * `unknown-parameter` — **a warning on a correct kit**, and for the
 * `channelPort` shape a guaranteed one, since the exporter deliberately keeps
 * those out of `ports`. That is the "check that rejects sound input" half of the
 * two-ways-an-instrument-lies pair, and the population it cries wolf at is kit
 * authors, which is the population this whole phase exists to serve.
 *
 * A node may mix the two: the mechanisms list is a union, and a runtime entry
 * does not cost the enumerable entries their conditions.
 *
 * @param {import('./index').ExportedNodeType} nodeType
 * @returns {import('./index').OverlayDynamicPortInfo | null}
 */
function toDynamicPorts(nodeType) {
  const declared = nodeType.dynamicports;
  if (!Array.isArray(declared) || declared.length === 0) return null;

  const declaredPortGroups = [];
  let runtime = false;

  for (const entry of declared) {
    if (!entry || typeof entry !== 'object') continue;
    const e = /** @type {Record<string, unknown>} */ (entry);
    // Checked first and independently of the group shape: an entry may carry
    // both, and the runtime half is the one that must not be under-claimed.
    if (e.template !== undefined || e.port !== undefined || e.channelPort !== undefined) runtime = true;
    if (e.ports !== undefined || e.inputs !== undefined || e.outputs !== undefined) {
      const group = toDeclaredPortGroup(e);
      if (group.inputs || group.outputs) declaredPortGroups.push(group);
    }
  }

  const mechanisms = [];
  if (declaredPortGroups.length) mechanisms.push('declared-port-groups');
  if (runtime) mechanisms.push('runtime-discovered');
  // Every entry was a shape this mapping does not recognise. Reporting no
  // mechanisms would read as "this node has no dynamic ports", which is the one
  // thing the presence of `dynamicports` rules out — so claim the conservative
  // mechanism, which costs a skipped check rather than a false accusation.
  if (mechanisms.length === 0) mechanisms.push('runtime-discovered');

  return {
    mechanisms,
    description:
      'This node declares dynamic port groups. The names were read from the kit’s own ' +
      '`dynamicports` metadata; unlike built-in types they were not observed by driving the node.',
    ...(declaredPortGroups.length ? { declaredPortGroups } : {})
  };
}

/**
 * The runtimes a kit's nodes are actually loaded into, from its manifest's
 * `runtimes` declaration. **CN-012, and this is a correction, not a policy.**
 *
 * 🔴 `availableIn` on a *built-in* is a statement of fact — it is `runtimeTypes`,
 * the runtimes that really did register the type. This field used to copy a
 * kit's manifest `runtimes` verbatim, which turned the same field, for the same
 * reader, into a statement of *intent*. Measured (CN-012 M4): a kit declaring
 * `["cloud"]` is reported to an agent as `availableIn: ["cloud"]` and runs in
 * **no runtime at all** —
 *
 * - the browser is the only loader there is: `buildInjectionTags` emits a script
 *   tag only for a module whose `runtimes` contains `browser`, so a cloud-only
 *   kit is removed from the page;
 * - and nothing loads it server-side. `CloudRunner`'s constructor calls
 *   `registerNodes` and nothing else, and `load(exportData, projectSettings)`
 *   has no parameter a module could arrive through. Driven: the same cloud
 *   function answers `200` with a built-in `Counter` and **times out** with a
 *   kit node, and answers `200` again the moment `runtime.registerModule` is
 *   called by hand. The runtime is willing; there is simply no caller.
 *
 * ⚠️ So this is not "kits are browser-only by decree". It is: *today, the only
 * code path that loads a kit is the browser injector.* The day a cloud loader
 * exists, this function is the one place that has to learn about it — which is
 * why the fact lives here once rather than in each consumer's head.
 *
 * @param {string[] | undefined} declared manifest `runtimes`, if any
 * @returns {string[]} sorted, possibly empty
 */
function effectiveKitRuntimes(declared) {
  return declaredKitRuntimes(declared).indexOf('browser') !== -1 ? ['browser'] : [];
}

/**
 * The manifest's own `runtimes`, defaulted the way every other reader defaults
 * it — absent means `['browser']` (`module-inject`'s scanner, the extractor and
 * `projectmodules.ts` all agree on that, and disagreeing here would make an
 * unstated manifest look deliberate).
 *
 * @param {string[] | undefined} declared
 * @returns {string[]} sorted
 */
function declaredKitRuntimes(declared) {
  return declared && declared.length ? [...declared].sort() : ['browser'];
}

/** Two sorted runtime lists, same members? */
function sameRuntimeList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Map one runtime node-library entry to a catalog-shaped overlay node.
 *
 * Derivations mirror `buildCatalog` exactly where the payload allows it —
 * `isVisual` is `category === 'Visual'`, `allowAsChild`/`allowAsExportRoot`
 * follow from it, `displayName` falls back to the type name. `inNodePicker` is
 * true for every non-deprecated kit node because `buildCatalog`'s own rule is
 * `!deprecated && (inPickerIndex || !!module)` and `registerModule` stamps
 * `module` onto every node a module registers.
 *
 * @param {import('./index').ExportedNodeType} nodeType
 * @param {{ kitModule: string, availableIn?: string[] }} origin
 * @returns {import('./index').OverlayCatalogNode}
 */
function toOverlayNode(nodeType, origin) {
  const { inputs, outputs } = splitPorts(nodeType.ports);
  const isVisual = nodeType.category === 'Visual';
  const isDeprecated = !!nodeType.deprecated;

  /** @type {import('./index').OverlayCatalogNode} */
  const node = {
    typeName: nodeType.name,
    displayName: nodeType.displayNodeName || nodeType.name,
    category: nodeType.category,
    isVisual,
    isDeprecated,
    inNodePicker: !isDeprecated,
    availableIn: effectiveKitRuntimes(origin.availableIn),
    providedBy: KIT_PROVENANCE,
    kitModule: origin.kitModule
  };

  // 🔴 CN-012. Never lose the manifest's claim, and never restate it as fact.
  // `availableIn` above says where the node *runs*; this says what the manifest
  // *asked for*, and it is present only when the two differ — so a reader who
  // sees an empty `availableIn` can always find out why.
  const declared = declaredKitRuntimes(origin.availableIn);
  if (!sameRuntimeList(declared, node.availableIn)) node.declaredRuntimes = declared;

  if (nodeType.docs !== undefined) node.docs = nodeType.docs;
  if (nodeType.searchTags !== undefined) node.searchTags = nodeType.searchTags;
  if (nodeType.module !== undefined) node.module = nodeType.module;
  if (nodeType.shortDocs !== undefined) node.shortDesc = nodeType.shortDocs;
  if (nodeType.singleton) node.singleton = true;
  if (isVisual || nodeType.allowAsChild) node.allowAsChild = true;
  if (nodeType.allowChildrenWithCategory !== undefined) {
    node.allowChildrenWithCategory = nodeType.allowChildrenWithCategory;
  }
  if (nodeType.allowAsExportRoot !== undefined) node.allowAsExportRoot = nodeType.allowAsExportRoot;
  else if (isVisual) node.allowAsExportRoot = true;
  if (nodeType.useVariants) node.useVariants = true;
  if (nodeType.visualStates !== undefined) node.visualStates = nodeType.visualStates;

  node.inputs = inputs;
  node.outputs = outputs;
  node.dynamicPorts = toDynamicPorts(nodeType);
  // Knowingly not derived — see the module header. Never null-by-omission: a
  // gap must not be able to pass for "nothing to say".
  node.parameterEncoding = {
    known: false,
    reason:
      'Kit node. Parameter-key formulas are derived by driving the node’s dynamic-port hook, ' +
      'which the node-library payload cannot express (CN-010).'
  };

  return node;
}

/**
 * Build the overlay for one project from a runtime node-library payload.
 *
 * "Which entries are kit nodes" is decided by `module`, the field
 * `NoodlRuntime.registerModule` stamps on every node a module registers — not by
 * a name prefix and not by asking whether the built-in catalog already knows the
 * type. That matters for the collision case below.
 *
 * @param {import('./index').NodeLibraryPayload} payload
 * @param {{ builtinTypeNames?: Iterable<string>, moduleRuntimes?: Record<string, string[]> }} [options]
 * @returns {import('./index').Overlay}
 */
function catalogNodesFromNodeLibrary(payload, options = {}) {
  const builtins = new Set(options.builtinTypeNames || []);
  const moduleRuntimes = options.moduleRuntimes || {};
  const nodes = [];
  const collisions = [];

  for (const nodeType of (payload && payload.nodetypes) || []) {
    const kitModule = nodeType.module;
    if (!kitModule) continue; // a built-in; the shipped catalog already has it

    // 🔴 Built-ins keep priority **here, in the catalog**. A kit shadowing a
    // shipped type name is a *diagnostic*, not a silent override — a silent one
    // would let a kit change what `Text` means for every check in the editor,
    // and the author would never be told.
    //
    // ⚠️ **The runtime resolves this the other way and that is not a typo.**
    // `NodeRegister.register` is an unguarded assignment and `viewer.jsx`
    // registers built-ins before module nodes, so at runtime the *kit* wins.
    // Measured in CN-015 (`notes/cn-015-premise-census.md`). The consequence is
    // that validation describes the built-in while the app runs the kit's node,
    // which is why the collision is an **error** and not a note. Do not "fix"
    // this comment by deleting one half — both halves are true.
    if (builtins.has(nodeType.name)) {
      collisions.push({ typeName: nodeType.name, kitModule });
      continue;
    }

    nodes.push(
      toOverlayNode(nodeType, {
        kitModule,
        availableIn: moduleRuntimes[kitModule]
      })
    );
  }

  nodes.sort((a, b) => (a.typeName < b.typeName ? -1 : a.typeName > b.typeName ? 1 : 0));
  return { nodes, collisions };
}

/**
 * Merge an overlay over a catalog, returning a **new** catalog document.
 *
 * The input catalog is never mutated. That is not politeness: `defaultCatalog()`
 * hands out a module-level singleton, and an overlay that leaked into it would
 * make one project's kit visible to the next — which is precisely what CN-003's
 * acceptance criterion 1 tests for with its "and false for a project without the
 * kit" half.
 *
 * @param {import('./index').NodeCatalogLike} catalog
 * @param {import('./index').OverlayCatalogNode[]} overlayNodes
 * @returns {import('./index').NodeCatalogLike}
 */
function mergeOverlay(catalog, overlayNodes) {
  if (!overlayNodes || overlayNodes.length === 0) return catalog;

  const portTypeNames = new Set(catalog.portTypeNames || []);
  for (const node of overlayNodes) {
    for (const p of node.inputs.concat(node.outputs)) portTypeNames.add(p.type.name);
  }

  const nodes = catalog.nodes.concat(overlayNodes);
  nodes.sort((a, b) => (a.typeName < b.typeName ? -1 : a.typeName > b.typeName ? 1 : 0));

  return {
    ...catalog,
    portTypeNames: [...portTypeNames].sort(),
    nodes
  };
}

// ── The agreement check (D3's accepted risk, made falsifiable) ───────────────

/** Stable key → port, for set comparison. */
function portMap(ports) {
  const m = new Map();
  for (const p of ports) m.set(p.name, p);
  return m;
}

function comparePortSets(typeName, plug, a, b, out, labelA, labelB) {
  const ma = portMap(a);
  const mb = portMap(b);
  for (const name of ma.keys()) {
    if (!mb.has(name)) {
      out.push({ typeName, kind: 'port-missing', plug, port: name, detail: `present in ${labelA}, absent in ${labelB}` });
    }
  }
  for (const name of mb.keys()) {
    if (!ma.has(name)) {
      out.push({ typeName, kind: 'port-missing', plug, port: name, detail: `present in ${labelB}, absent in ${labelA}` });
    }
  }
  for (const [name, pa] of ma) {
    const pb = mb.get(name);
    if (!pb) continue;
    if (pa.type.name !== pb.type.name) {
      out.push({
        typeName,
        kind: 'port-type-differs',
        plug,
        port: name,
        detail: `${labelA} says "${pa.type.name}", ${labelB} says "${pb.type.name}"`
      });
    }
  }
}

/**
 * Compare two overlays for the same project and **name** what differs.
 *
 * This is the obligation ✅ **D3** attached to letting the editor and the MCP
 * server derive the same facts by different routes: they can disagree, and a
 * user will find the disagreement before we do. A boolean would not be enough —
 * "when they diverge, the failure must name the divergence, not just fail" is
 * written into the task.
 *
 * ⚠️ What this can and cannot catch, stated plainly so nobody reads a pass as
 * more than it is: since both sides now run the *same* mapping over a payload,
 * an agreeing result says **the two registers agree**. It does not
 * independently verify the mapping — the fixture tests do that. A failure here
 * means a kit registered differently headlessly than it did in the viewer,
 * which is the failure mode that actually reaches users.
 *
 * @param {import('./index').OverlayCatalogNode[]} a
 * @param {import('./index').OverlayCatalogNode[]} b
 * @param {{ labelA?: string, labelB?: string }} [labels]
 * @returns {import('./index').OverlayComparison}
 */
function compareOverlays(a, b, labels = {}) {
  const labelA = labels.labelA || 'A';
  const labelB = labels.labelB || 'B';
  /** @type {import('./index').OverlayDivergence[]} */
  const divergences = [];

  const ma = new Map(a.map((n) => [n.typeName, n]));
  const mb = new Map(b.map((n) => [n.typeName, n]));

  for (const typeName of ma.keys()) {
    if (!mb.has(typeName)) {
      divergences.push({ typeName, kind: 'type-missing', detail: `declared in ${labelA}, absent from ${labelB}` });
    }
  }
  for (const typeName of mb.keys()) {
    if (!ma.has(typeName)) {
      divergences.push({ typeName, kind: 'type-missing', detail: `declared in ${labelB}, absent from ${labelA}` });
    }
  }

  for (const [typeName, na] of ma) {
    const nb = mb.get(typeName);
    if (!nb) continue;
    if (na.displayName !== nb.displayName) {
      divergences.push({
        typeName,
        kind: 'field-differs',
        field: 'displayName',
        detail: `${labelA} says "${na.displayName}", ${labelB} says "${nb.displayName}"`
      });
    }
    if (na.category !== nb.category) {
      divergences.push({
        typeName,
        kind: 'field-differs',
        field: 'category',
        detail: `${labelA} says "${na.category}", ${labelB} says "${nb.category}"`
      });
    }
    if (na.isVisual !== nb.isVisual) {
      divergences.push({
        typeName,
        kind: 'field-differs',
        field: 'isVisual',
        detail: `${labelA} says ${na.isVisual}, ${labelB} says ${nb.isVisual}`
      });
    }
    comparePortSets(typeName, 'input', na.inputs, nb.inputs, divergences, labelA, labelB);
    comparePortSets(typeName, 'output', na.outputs, nb.outputs, divergences, labelA, labelB);
  }

  divergences.sort((x, y) =>
    x.typeName === y.typeName ? (x.detail < y.detail ? -1 : 1) : x.typeName < y.typeName ? -1 : 1
  );

  return { agree: divergences.length === 0, divergences, labelA, labelB };
}

/**
 * One line per divergence, for a test failure message or a CLI.
 *
 * @param {import('./index').OverlayComparison} comparison
 * @returns {string}
 */
function describeComparison(comparison) {
  if (comparison.agree) {
    return `${comparison.labelA} and ${comparison.labelB} agree on every kit node type and port.`;
  }
  const lines = comparison.divergences.map((d) => {
    const where = d.port ? `${d.typeName}.${d.plug}:${d.port}` : d.field ? `${d.typeName}.${d.field}` : d.typeName;
    return `  - [${d.kind}] ${where} — ${d.detail}`;
  });
  return [
    `${comparison.labelA} and ${comparison.labelB} disagree about this project's kit nodes ` +
      `(${comparison.divergences.length} divergence${comparison.divergences.length === 1 ? '' : 's'}):`,
    ...lines
  ].join('\n');
}

// CN-015. Re-exported from here so there is one import site for consumers, and
// so the collision recorded by `catalogNodesFromNodeLibrary` above and the
// message that reports it cannot be picked up independently of each other.
const { kitDiagnostics, formatKitDiagnostic } = require('./health');

module.exports = {
  effectiveKitRuntimes,
  declaredKitRuntimes,
  KIT_PROVENANCE,
  normalizePortType,
  catalogNodesFromNodeLibrary,
  mergeOverlay,
  compareOverlays,
  describeComparison,
  kitDiagnostics,
  formatKitDiagnostic
};
