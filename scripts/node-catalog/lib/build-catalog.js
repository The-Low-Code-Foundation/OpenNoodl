/**
 * Turns captured live registrations into the catalog document.
 *
 * Everything here must be deterministic: no timestamps, no randomness, stable
 * sort orders, fixed key insertion order. Two runs over the same source tree
 * must produce byte-identical output.
 */
const { sanitize, normalizeType, tooltipToText, assignDefined } = require('./sanitize');
const { NOTES, EDITOR_ADAPTER_TYPES } = require('./dynamic-port-notes');
const { deriveEncoding } = require('./derive-encoding');

// 1.1.0 — SUB-013 adds `parameterEncoding` to every node with dynamic ports. Additive, so a
// minor bump: a reader written against 1.0.0 sees an unknown key and is otherwise unaffected.
const CATALOG_FORMAT_VERSION = '1.1.0';

// A node *defining* these methods services ports that are not in its static
// metadata (the runtime calls them when a connection targets an unknown port).
// Merely *calling* this.registerInputIfNeeded is not a signal — the shared
// visual-node variant machinery does that for every React node.
const DYNAMISM_METHOD_KEYS = new Set(['registerInputIfNeeded', 'registerOutputIfNeeded']);
const FUNCTION_SOURCE_DYNAMISM = /sendDynamicPorts/;
// `setup(context, graphModel)` hooks overwhelmingly exist to compute
// per-instance ports; helpers are usually module-level (`updatePorts(...)`),
// so match call sites rather than only the marker APIs.
//
// 🔴 **The trailing `\d*` is load bearing, and a second node with the same helper name is what
// found it.** The extractor reads the ESBUILD BUNDLE, not the source files, and esbuild renames
// a module-level function whose name another module already used — `updatePorts` in a second
// node became `updatePorts2`, which this pattern did not match. The consequence was silent and
// remote: `Text Input`, untouched, lost its `runtime-discovered` mechanism because `Dropdown`
// gained a helper with the same name. A detector that reads bundled text has to tolerate the
// bundler's renaming.
//
// ⚠️ The `s` is optional for the same reason: a hook that republishes exactly one port names its
// helper in the singular (`updateValuePort`), and a detector that only recognised the plural
// would call that node static. Widening it was measured, not assumed — the regenerated catalog
// moved no node other than the two this session touched.
const SETUP_SOURCE_DYNAMISM = /sendDynamicPorts|[\w$]*[Pp]orts?\d*\s*\(/;

/** Recursively collect (key, source) pairs of all functions reachable from a raw definition. */
function collectFunctionSources(value, key, depth, out) {
  if (depth > 6 || value === null || value === undefined) return out;
  if (typeof value === 'function') {
    out.push({ key, source: Function.prototype.toString.call(value) });
    // Also scan static members hung off the function (getters etc.)
    for (const k of Object.keys(value)) collectFunctionSources(value[k], k, depth + 1, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const v of value) collectFunctionSources(v, key, depth + 1, out);
  } else {
    for (const k of Object.keys(value)) {
      // Old-API prototype extensions wrap methods in property descriptors
      // ({ value: fn }); keep the method's own name in that case.
      const childKey = k === 'value' || k === 'get' || k === 'set' ? key : k;
      collectFunctionSources(value[k], childKey, depth + 1, out);
    }
  }
  return out;
}

function hasRuntimeDiscoveredPorts(rawDef) {
  const fns = collectFunctionSources(rawDef, null, 0, []);
  return fns.some(
    ({ key, source }) =>
      DYNAMISM_METHOD_KEYS.has(key) ||
      FUNCTION_SOURCE_DYNAMISM.test(source) ||
      (key === 'setup' && SETUP_SOURCE_DYNAMISM.test(source))
  );
}

function buildPort(name, portMeta, plug) {
  const type = normalizeType(portMeta.type);
  const port = { name };
  assignDefined(port, {
    displayName: portMeta.displayName,
    editorName: portMeta.editorName,
    group: portMeta.group,
    plug,
    type,
    isSignal: type.name === 'signal',
    default: sanitize(portMeta.default),
    /**
     * NDA-005 — an authored `description` wins; a flattened tooltip is the fallback.
     *
     * The two fields answer different questions. `tooltip` is the editor's hover popup, so it
     * opens with a heading that restates the display name and may carry image captions;
     * `tooltipToText` strips the tags and joins what is left, which is how the library's 142
     * "documented" ports came to read like *"Clip content Controls if elements that are too big
     * to fit will be clipped Enabled Disabled"*. Usable as a last resort, and not what a port
     * description should be.
     *
     * Keeping the fallback matters as much as adding the field: dropping it would take those
     * 142 to zero on the way to improving them.
     */
    description: portMeta.description || tooltipToText(portMeta.tooltip),
    index: portMeta.index,
    allowVisualStates: portMeta.allowVisualStates || undefined,
    hiddenInEditor: portMeta.exportToEditor === false ? true : undefined
  });
  return port;
}

function detectDynamism(typeName, metadata, rawDef) {
  const mechanisms = [];

  const declared = metadata.dynamicports && metadata.dynamicports.length ? sanitize(metadata.dynamicports) : undefined;
  if (declared) mechanisms.push('declared-port-groups');

  const rawNode = rawDef && rawDef.node ? rawDef.node : undefined;
  const numberedInputs = rawNode && rawNode.numberedInputs ? rawNode.numberedInputs : undefined;
  if (numberedInputs) mechanisms.push('numbered-inputs');

  if (metadata.haveComponentPorts) mechanisms.push('component-ports');

  const runtimeDiscovered = !!metadata.exportDynamicPorts || (rawDef && hasRuntimeDiscoveredPorts(rawDef));
  if (runtimeDiscovered) mechanisms.push('runtime-discovered');

  if (EDITOR_ADAPTER_TYPES[typeName]) mechanisms.push('editor-adapter');

  if (!mechanisms.length) return null;

  const genericDescriptions = {
    'declared-port-groups':
      'Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups).',
    'numbered-inputs':
      'Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.',
    'component-ports': 'Ports are defined by the user per instance (component input/output declarations).',
    'runtime-discovered':
      'Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.',
    'editor-adapter': 'The editor computes additional ports for this node from project context (NodeTypeAdapters).'
  };

  const result = {
    mechanisms,
    description:
      NOTES[typeName] ||
      mechanisms
        .map((m) => genericDescriptions[m])
        .filter(Boolean)
        .join(' ')
  };

  if (declared) result.declaredPortGroups = declared;

  if (numberedInputs) {
    result.numberedInputs = Object.keys(numberedInputs)
      .sort()
      .map((base) => {
        const ni = numberedInputs[base];
        const entry = { nameBase: base };
        assignDefined(entry, {
          displayPrefix: ni.displayPrefix,
          group: ni.group,
          type: normalizeType(ni.type),
          index: ni.index
        });
        return entry;
      });
  }

  if (EDITOR_ADAPTER_TYPES[typeName]) result.editorAdapter = EDITOR_ADAPTER_TYPES[typeName];

  return result;
}

/**
 * @param records Map<typeName, { metadata, rawDef, providedBy, environments:Set }>
 * @param extras { typecasts, packageVersions }
 */
function buildCatalog(records, extras) {
  const nodes = [];
  const portTypeNames = new Set();

  const typeNames = [...records.keys()].sort();
  for (const typeName of typeNames) {
    const { metadata, rawDef, providedBy, environments } = records.get(typeName);

    const inputs = Object.keys(metadata.inputs || {})
      .sort()
      .map((name) => buildPort(name, metadata.inputs[name], 'input'));
    const outputs = Object.keys(metadata.outputs || {})
      .sort()
      .map((name) => buildPort(name, metadata.outputs[name], 'output'));

    for (const p of inputs.concat(outputs)) portTypeNames.add(p.type.name);

    const isVisual = metadata.category === 'Visual';

    const node = {
      typeName,
      displayName: metadata.displayNodeName || typeName,
      category: metadata.category,
      isVisual,
      isDeprecated: !!metadata.deprecated,
      // Whether the editor's add-node picker offers this type (module nodes
      // are always offered via the module section). Types with false are
      // legacy/superseded or created through specialised flows — valid to
      // read from old projects, wrong to author into new ones unless no
      // picker-visible alternative exists.
      //
      // NDA-005: being *listed* in the curated index is not the same as being
      // *offered*. The picker builds its index through `createnodeindex.ts`,
      // which puts every listed name — core and module alike — through
      // `getCreateStatus`, and `componentmodel.ts:292-295` returns
      // `creatable: false` for anything deprecated. Five deprecated types are
      // nonetheless listed in `nodelibraryexport.ts`'s index (`REST2` and the
      // four `net.noodl.user.*` email nodes), so without this clause the
      // catalog reported them as pickable and the audit worksheets repeated it.
      inNodePicker: !metadata.deprecated && (extras.nodePickerTypes.has(typeName) || !!metadata.module),
      availableIn: [...environments].sort(),
      providedBy
    };

    // Server-side-rendering compatibility (RUN-002): declared on the node
    // definition (`ssr` in defineNode opts), absent means audited-safe.
    // Cloud-only types never render in a page, so the axis does not apply.
    if (environments.has('browser')) {
      node.ssr = metadata.ssr ? sanitize(metadata.ssr) : { compat: 'safe' };
    }

    // Mirror the effective child/parent rules the editor derives in
    // nodelibraryexport.js: Visual nodes may be placed as children and used
    // as export roots unless overridden; allowChildren implies Visual children.
    let allowChildrenWithCategory;
    if (metadata.allowChildren) allowChildrenWithCategory = ['Visual'];
    if (metadata.allowChildrenWithCategory) allowChildrenWithCategory = metadata.allowChildrenWithCategory;

    assignDefined(node, {
      docs: metadata.docs,
      searchTags: sanitize(metadata.searchTags),
      module: metadata.module,
      singleton: metadata.singleton || undefined,
      allowAsChild: isVisual || metadata.allowAsChild ? true : undefined,
      allowChildrenWithCategory: sanitize(allowChildrenWithCategory),
      allowAsExportRoot:
        metadata.allowAsExportRoot !== undefined ? metadata.allowAsExportRoot : isVisual ? true : undefined,
      useVariants: metadata.useVariants || undefined,
      visualStates: sanitize(metadata.visualStates)
    });

    node.inputs = inputs;
    node.outputs = outputs;
    node.dynamicPorts = detectDynamism(typeName, metadata, rawDef);
    // SUB-013 — what the dynamic ports are *called*. `dynamicPorts.description` says they exist;
    // without this an author has prose and no way to write a key. Null for nodes with no dynamic
    // ports; never absent for nodes that have them, so a gap cannot pass for "nothing to say".
    node.parameterEncoding = deriveEncoding(typeName, metadata, rawDef, node.dynamicPorts);

    nodes.push(node);
  }

  // The editor-side placeholder node that appears in project files but is not
  // in any runtime registry.
  nodes.push({
    typeName: 'Component Children',
    displayName: 'Component Children',
    category: 'Visual',
    isVisual: true,
    isDeprecated: false,
    inNodePicker: true,
    availableIn: ['browser'],
    providedBy: 'noodl-editor',
    ssr: { compat: 'safe' },
    shortDesc: 'Placeholder marking where children given to an instance of this component are inserted.',
    allowAsChild: true,
    inputs: [],
    outputs: [],
    dynamicPorts: null,
    parameterEncoding: null
  });
  nodes.sort((a, b) => (a.typeName < b.typeName ? -1 : a.typeName > b.typeName ? 1 : 0));

  return {
    catalogFormatVersion: CATALOG_FORMAT_VERSION,
    generatedBy: 'scripts/node-catalog/generate.js',
    schemaDocs: 'docs/node-catalog/SCHEMA.md',
    packages: extras.packageVersions,
    portTypeNames: [...portTypeNames].sort(),
    typecasts: sanitize(extras.typecasts),
    nodes
  };
}

module.exports = { buildCatalog, CATALOG_FORMAT_VERSION };
