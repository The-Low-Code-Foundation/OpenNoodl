/**
 * LEG-004 — the textconv renderer.
 *
 * `textconv` is not a diff renderer. Git invokes it on ONE file at a time, with
 * no base and no sibling files, and diffs the two resulting texts itself. So
 * this module cannot emit `formatChange` sentences ("Connected A.click → B.nav")
 * — those are a function of two versions. What it emits instead is a stable,
 * line-oriented rendering of a single file whose *textual* diff reads well.
 *
 * Four rules follow from that, and every formatting decision below is one of
 * them:
 *
 *  1. **One fact per line.** A node's name, its type, and each of its
 *     parameters change independently, so none of them may share a line.
 *     In particular the label appears exactly once per node — on the node's
 *     header line — and never in the prefix repeated on its detail lines.
 *     Renaming a node therefore reddens exactly one line, which is LEG-004's
 *     sharpest acceptance criterion and the one a naive renderer fails.
 *
 *  2. **Deterministic order that is not file order.** v2 writes nodes as a flat
 *     array whose order is incidental — parent/`children` carry the real tree —
 *     and every writer reorders it. So the array order is discarded entirely:
 *     children follow their parent's declared `children` order, and anything
 *     with no declared order is sorted by (type, id).
 *
 *  3. **Positions excluded.** `x`/`y` change on every canvas nudge and mean
 *     nothing to a reviewer. This is the same policy as the change-review
 *     panel's `FormatOptions.includeCosmetic`, which also defaults to false.
 *
 *  4. **Ids present but not leading.** `Group ~card_root` — a reviewer can grep
 *     an id (they have to: `connections.json` can only name nodes by id, see
 *     below) without having to read one first.
 *
 * ⚠️ The rendering is a pure function of the file's bytes, deliberately. Git
 * hands textconv a TEMP file for anything that is not the worktree copy, so
 * `connections.json` cannot reach `nodes.json` to resolve a node's name. It
 * would be possible to read siblings in the one case where the path happens to
 * be the real worktree file — and that would be much worse than not doing it,
 * because the same blob would then render two different ways and every line of
 * a diff between them would be spurious.
 *
 * ⚠️ Never throw, never exit non-zero: git treats a failing textconv as an
 * error on an otherwise ordinary `git log`. Unparseable or unrecognised input
 * falls through to the raw bytes. `safeGraphDiff` applies the same policy in
 * the panel for the same reason.
 */

'use strict';

/** Node fields the renderer handles itself; the rest are rendered generically. */
const NODE_STRUCTURAL_KEYS = new Set([
  'id',
  'type',
  'label',
  'children',
  'parent',
  // Cosmetic — rule 3.
  'x',
  'y'
]);

/** Written by older diff/merge code; never content. Mirrors GraphSnapshot. */
const NODE_TRANSIENT_KEYS = new Set(['conflicts', 'annotation', 'diffData', '_parent', '_sort']);

/** Keyed collections: rendered by an element's own key, not by array index, so
 * that reordering the array produces no diff. */
const KEYED_ARRAYS = {
  ports: 'name',
  dynamicports: 'name',
  inputs: 'name',
  outputs: 'name'
};

const INDENT = '  ';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function quote(text) {
  return JSON.stringify(String(text));
}

/** A short, stable handle for a node. Human-authored ids (`card_root`) are kept
 * whole; a 36-character uuid is cut to its first group, which is unique in any
 * graph a person will read and still greps against the stored JSON. */
function shortId(id) {
  const text = String(id);
  if (text.length <= 12) return text;
  return text.slice(0, 8);
}

/**
 * The node's designator: everything about it that is *not* its label. This is
 * what gets repeated on every detail line, and the reason a rename costs one
 * line rather than one per parameter.
 */
function designator(node, displayName) {
  const type = displayName(node.type) || node.type || '(no type)';
  return `${type} ~${shortId(node.id)}`;
}

// ---------------------------------------------------------------------------
// Value rendering
// ---------------------------------------------------------------------------

/**
 * Flatten a value into `path = scalar` lines. Objects recurse by sorted key —
 * sorted because key order in JSON is a writer's whim, not content. Arrays
 * recurse by index, except the keyed collections above.
 *
 * A string containing newlines (a Function node's `functionScript`, a code
 * port) is emitted as one line per source line under a `|` continuation, so a
 * one-character edit inside 200 lines of JavaScript reddens one line and not
 * the whole parameter.
 */
function emitValue(out, prefix, path, value) {
  if (value === undefined) return;

  if (typeof value === 'string' && value.indexOf('\n') !== -1) {
    out.push(`${prefix}${path} = |`);
    const lines = value.split('\n');
    // A trailing newline would otherwise add an empty final element that reads
    // as a blank continuation line for no reason.
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) out.push(`${prefix}${path} | ${line}`);
    return;
  }

  if (value === null || typeof value !== 'object') {
    out.push(`${prefix}${path} = ${typeof value === 'string' ? quote(value) : String(value)}`);
    return;
  }

  if (Array.isArray(value)) {
    // An empty container is not a fact about the graph, it is a writer's habit:
    // `ports: []`, `metadata: {}` and `visualStateTransitions: []` sit on every
    // node of every legacy project and never change. Dropping them costs a diff
    // nothing (a value appearing still shows as an added line) and takes about a
    // third of the lines out of `git show`.
    if (value.length === 0) return;
    const keyField = KEYED_ARRAYS[path.split('.').pop().replace(/\[\d+\]$/, '')];
    if (keyField && value.every((item) => isPlainObject(item) && item[keyField] !== undefined)) {
      const sorted = value.slice().sort((a, b) => (String(a[keyField]) < String(b[keyField]) ? -1 : 1));
      for (const item of sorted) {
        emitValue(out, prefix, `${path}[${quote(item[keyField])}]`, item);
      }
      return;
    }
    value.forEach((item, index) => emitValue(out, prefix, `${path}[${index}]`, item));
    return;
  }

  const keys = Object.keys(value).sort();
  if (keys.length === 0) return; // see the note on empty arrays above
  for (const key of keys) emitValue(out, prefix, `${path}.${key}`, value[key]);
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function compareByTypeThenId(a, b) {
  const at = String(a.type || '');
  const bt = String(b.type || '');
  if (at !== bt) return at < bt ? -1 : 1;
  const ai = String(a.id || '');
  const bi = String(b.id || '');
  if (ai === bi) return 0;
  return ai < bi ? -1 : 1;
}

/**
 * Render one node and its subtree.
 *
 * `childrenOf(node)` returns the node's children already in the order the
 * caller decided is authoritative (rule 2).
 */
function emitNode(out, node, depth, scope, childrenOf, displayName) {
  const indent = INDENT.repeat(depth);
  const subject = designator(node, displayName);
  const head = scope ? `${indent}${scope} · ${subject}` : `${indent}${subject}`;

  // The label — the single line that carries the node's human name.
  out.push(node.label !== undefined && node.label !== null && node.label !== ''
    ? `${head} ${quote(node.label)}`
    : head);

  const detail = `${head} · `;

  if (isPlainObject(node.parameters)) {
    for (const key of Object.keys(node.parameters).sort()) {
      emitValue(out, detail, key, node.parameters[key]);
    }
  }

  for (const key of Object.keys(node).sort()) {
    if (key === 'parameters') continue;
    if (NODE_STRUCTURAL_KEYS.has(key)) continue;
    if (NODE_TRANSIENT_KEYS.has(key)) continue;
    if (key === 'dynamicports') {
      // Derived, not authored: the runtime regenerates these from the node's
      // script or its type, and `nodesSoftEqual` in GraphMerge already deletes
      // them before comparing two nodes for the same reason. Expanded they are
      // six lines per port — a third of a legacy project.json — and their
      // `index` field churns on every reorder. One line naming the interface
      // keeps the signal (a port appeared, a port went) at one line per change.
      const names = Array.isArray(node.dynamicports)
        ? node.dynamicports
            .filter(isPlainObject)
            .map((port) => String(port.name))
            .sort()
        : [];
      if (names.length > 0) out.push(`${detail}dynamicports = ${names.join(', ')}`);
      continue;
    }
    // `stateParamaters` is a legacy misspelling that still reaches disk; it is
    // normalised on read everywhere else, and normalising it here too keeps a
    // file written before the fix diffing cleanly against one written after.
    const name = key === 'stateParamaters' ? 'stateParameters' : key;
    emitValue(out, detail, name, node[key]);
  }

  for (const child of childrenOf(node)) {
    emitNode(out, child, depth + 1, scope, childrenOf, displayName);
  }
}

/**
 * Order a flat v2 node array into a forest.
 *
 * The `nodes` array order is discarded. A parent's declared `children` array is
 * the only order this trusts; siblings with no declared order (roots, or a
 * parent whose `children` key a writer omitted) sort by (type, id).
 */
function buildV2Forest(rawNodes) {
  const byId = new Map();
  for (const raw of rawNodes) {
    if (!isPlainObject(raw) || raw.id === undefined) continue;
    byId.set(String(raw.id), raw);
  }

  const declaredOrder = new Map(); // parentId -> [childId]
  const claimed = new Set();
  for (const raw of byId.values()) {
    if (!Array.isArray(raw.children)) continue;
    const ids = raw.children.map(String).filter((id) => byId.has(id));
    declaredOrder.set(String(raw.id), ids);
    for (const id of ids) claimed.add(id);
  }

  const childrenByParent = new Map();
  const roots = [];
  for (const raw of byId.values()) {
    const parentId = raw.parent !== undefined ? String(raw.parent) : undefined;
    if (parentId !== undefined && byId.has(parentId)) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(raw);
    } else if (!claimed.has(String(raw.id))) {
      roots.push(raw);
    } else {
      // Listed in some parent's `children` but carrying no `parent` of its own.
      const owner = [...declaredOrder.entries()].find(([, ids]) => ids.includes(String(raw.id)));
      if (owner) {
        if (!childrenByParent.has(owner[0])) childrenByParent.set(owner[0], []);
        childrenByParent.get(owner[0]).push(raw);
      } else {
        roots.push(raw);
      }
    }
  }

  const order = (parentId, siblings) => {
    const declared = declaredOrder.get(parentId);
    if (!declared) return siblings.slice().sort(compareByTypeThenId);
    const rank = new Map(declared.map((id, index) => [id, index]));
    return siblings.slice().sort((a, b) => {
      const ra = rank.has(String(a.id)) ? rank.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(String(b.id)) ? rank.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return compareByTypeThenId(a, b);
    });
  };

  const childrenOf = (node) => order(String(node.id), childrenByParent.get(String(node.id)) || []);
  return { roots: roots.slice().sort(compareByTypeThenId), childrenOf };
}

/** Legacy nested graphs carry their tree in nested `children` arrays, where the
 * array position IS the authored order, so it is kept. */
function legacyChildrenOf(node) {
  return Array.isArray(node.children) ? node.children.filter(isPlainObject) : [];
}

function emitComments(out, comments, scope) {
  if (!Array.isArray(comments) || comments.length === 0) return;
  const prefix = scope ? `${scope} · ` : '';
  const rendered = comments
    .filter(isPlainObject)
    .map((comment) => {
      const key = comment.id !== undefined ? `~${shortId(comment.id)}` : '';
      return { key, comment };
    })
    .sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      const at = String(a.comment.text || '');
      const bt = String(b.comment.text || '');
      return at === bt ? 0 : at < bt ? -1 : 1;
    });
  for (const { key, comment } of rendered) {
    const head = `${INDENT}${prefix}comment${key ? ` ${key}` : ''}`;
    emitValue(out, `${head} · `, 'text', comment.text === undefined ? '' : comment.text);
    for (const field of Object.keys(comment).sort()) {
      if (field === 'text' || field === 'id' || field === 'x' || field === 'y') continue;
      if (field === 'annotation' || field === 'diffData') continue;
      emitValue(out, `${head} · `, field, comment[field]);
    }
  }
}

// ---------------------------------------------------------------------------
// File kinds
// ---------------------------------------------------------------------------

/**
 * The kind is decided from the file's CONTENT, never its name — git hands
 * textconv a temp file called something like `.merge_file_a1b2c3`.
 */
function classify(doc) {
  if (!isPlainObject(doc)) return null;
  if (Array.isArray(doc.nodes)) return 'nodes';
  if (Array.isArray(doc.connections)) return 'connections';
  if (Array.isArray(doc.components)) return 'project';
  // component.json: identity plus interface, no graph. Keyed on `path`, which
  // the v2 exporter always writes and which `nodegx.project.json` — a manifest
  // with the same `$schema`/`id`/`name` shape — never does.
  if (typeof doc.path === 'string') return 'component';
  return null;
}

const FILE_KEYS_HANDLED = new Set(['$schema', 'componentId', 'nodes', 'connections', 'comments', 'components']);

function renderNodesFile(doc, displayName) {
  const out = [];
  out.push(`nodes of component ${doc.componentId === undefined ? '(unnamed)' : doc.componentId}`);
  for (const key of Object.keys(doc).sort()) {
    if (FILE_KEYS_HANDLED.has(key)) continue;
    emitValue(out, `${INDENT}`, key, doc[key]);
  }
  const { roots, childrenOf } = buildV2Forest(doc.nodes.filter(isPlainObject));
  for (const root of roots) emitNode(out, root, 1, '', childrenOf, displayName);
  emitComments(out, doc.comments, '');
  return out;
}

function renderConnectionsFile(doc) {
  const out = [];
  out.push(`connections of component ${doc.componentId === undefined ? '(unnamed)' : doc.componentId}`);
  for (const key of Object.keys(doc).sort()) {
    if (FILE_KEYS_HANDLED.has(key)) continue;
    emitValue(out, `${INDENT}`, key, doc[key]);
  }
  // ⚠️ Only ids are available here: see the note at the top of the file. The id
  // is the join key back to the `nodes.json` rendering, where the name is.
  const rendered = doc.connections
    .filter(isPlainObject)
    .map((connection) => ({
      key: [connection.fromId, connection.fromProperty, connection.toId, connection.toProperty]
        .map((part) => String(part))
        .join(' '),
      connection
    }))
    .sort((a, b) => (a.key === b.key ? 0 : a.key < b.key ? -1 : 1));

  for (const { connection } of rendered) {
    const head = `${INDENT}~${shortId(connection.fromId)}.${connection.fromProperty} → ~${shortId(
      connection.toId
    )}.${connection.toProperty}`;
    out.push(head);
    for (const key of Object.keys(connection).sort()) {
      if (key === 'fromId' || key === 'fromProperty' || key === 'toId' || key === 'toProperty') continue;
      if (key === 'annotation' || key === 'labelT') continue;
      emitValue(out, `${head} · `, key, connection[key]);
    }
  }
  return out;
}

function renderComponentFile(doc) {
  const out = [];
  const name = doc.path || doc.name || '(unnamed)';
  out.push(`component ${name}`);
  for (const key of Object.keys(doc).sort()) {
    if (key === '$schema' || key === 'path') continue;
    // `modified` is a wall-clock stamp rewritten on every save; it is the
    // single noisiest field in a v2 component and says nothing a commit date
    // does not already say.
    if (key === 'modified') continue;
    emitValue(out, `${INDENT}`, key, doc[key]);
  }
  return out;
}

function renderLegacyProject(doc, displayName) {
  const out = [];
  out.push(`project ${doc.name === undefined ? '(unnamed)' : doc.name}`);

  const components = doc.components.filter(isPlainObject).slice().sort((a, b) => {
    const an = String(a.name || a.id || '');
    const bn = String(b.name || b.id || '');
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.id || '') < String(b.id || '') ? -1 : 1;
  });

  for (const component of components) {
    const scope = String(component.name || component.id || '(unnamed)');
    out.push(`component ${scope}`);
    for (const key of Object.keys(component).sort()) {
      if (key === 'name' || key === 'graph') continue;
      emitValue(out, `component ${scope} · `, key, component[key]);
    }
    const graph = isPlainObject(component.graph) ? component.graph : {};
    const roots = Array.isArray(graph.roots) ? graph.roots.filter(isPlainObject) : [];
    // Legacy roots carry no `visualRoots` declaration, so their array order is
    // indistinguishable from incidental file order. Sorted, per rule 2 — the
    // cost is that reordering top-level siblings is not visible in the diff.
    for (const root of roots.slice().sort(compareByTypeThenId)) {
      emitNode(out, root, 1, scope, legacyChildrenOf, displayName);
    }
    if (Array.isArray(graph.connections)) {
      const rendered = graph.connections
        .filter(isPlainObject)
        .map((connection) => ({
          key: [connection.fromId, connection.fromProperty, connection.toId, connection.toProperty]
            .map(String)
            .join(' '),
          connection
        }))
        .sort((a, b) => (a.key === b.key ? 0 : a.key < b.key ? -1 : 1));
      for (const { connection } of rendered) {
        const from = findNode(roots, connection.fromId);
        const to = findNode(roots, connection.toId);
        const head =
          `${INDENT}${scope} · ` +
          `${from ? designator(from, displayName) : `~${shortId(connection.fromId)}`}.${connection.fromProperty}` +
          ` → ${to ? designator(to, displayName) : `~${shortId(connection.toId)}`}.${connection.toProperty}`;
        out.push(head);
        for (const key of Object.keys(connection).sort()) {
          if (key === 'fromId' || key === 'fromProperty' || key === 'toId' || key === 'toProperty') continue;
          if (key === 'annotation' || key === 'labelT') continue;
          emitValue(out, `${head} · `, key, connection[key]);
        }
      }
    }
    emitComments(out, graph.comments, scope);
    for (const key of Object.keys(graph).sort()) {
      if (key === 'roots' || key === 'connections' || key === 'comments') continue;
      emitValue(out, `component ${scope} · graph.`, key, graph[key]);
    }
  }

  for (const key of Object.keys(doc).sort()) {
    if (key === 'components' || key === 'name') continue;
    emitValue(out, '', key, doc[key]);
  }
  return out;
}

/**
 * Both endpoints of a legacy connection are in the same file, so unlike
 * `connections.json` the endpoint can be named. The naming rule is the one
 * `DiffFormatter.nodeName` uses — label first, catalog display name, raw type —
 * except that the label is deliberately NOT included here: it belongs to the
 * other node, and a rename must not redden this line (rule 1).
 */
function findNode(roots, id) {
  const wanted = String(id);
  const stack = roots.slice();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isPlainObject(node)) continue;
    if (String(node.id) === wanted) return node;
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} text  the file's contents
 * @param {{ displayName?: (typeName: string) => string | undefined }} [options]
 * @returns {string} the rendering, or `text` unchanged when it is not a graph
 *                   file this renderer understands.
 */
function renderGraphText(text, options) {
  const displayName = (options && options.displayName) || (() => undefined);
  const safeDisplayName = (typeName) => {
    try {
      return displayName(typeName) || undefined;
    } catch (error) {
      return undefined;
    }
  };

  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return text;
  }

  let lines;
  try {
    switch (classify(doc)) {
      case 'nodes':
        lines = renderNodesFile(doc, safeDisplayName);
        break;
      case 'connections':
        lines = renderConnectionsFile(doc);
        break;
      case 'component':
        lines = renderComponentFile(doc);
        break;
      case 'project':
        lines = renderLegacyProject(doc, safeDisplayName);
        break;
      default:
        return text;
    }
  } catch (error) {
    return text;
  }

  return lines.join('\n') + '\n';
}

module.exports = { renderGraphText, shortId };
