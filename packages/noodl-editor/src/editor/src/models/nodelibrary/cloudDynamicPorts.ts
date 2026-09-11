/**
 * The dynamic ports a **cloud** node has, derived in the editor — SB-017.
 *
 * ## Why this exists
 *
 * A node's *dynamic* ports have only ever reached the editor from a running
 * runtime client: the node module's `setup()` runs behind
 * `editorConnection.isRunningLocally()` and pushes them back over
 * `sendDynamicPorts`. **WF-007 deleted the hidden cloud-runtime window**
 * (`NodeLibraryImporter.ts:285` says so in as many words) and WFA-001 replaced
 * it with `cloud-node-library.json` — a *static* snapshot, which by
 * construction carries declared ports and nothing a node computes.
 *
 * So for a cloud component every dynamic-port family has been missing at once
 * since WF-007. That is not cosmetic: `exportComponent` drops any connection
 * `getConnectionHealth` calls unhealthy (`utils/exporter/util.ts:90`), and an
 * unresolved port is an `error`-level warning. On the shipped Site Builder
 * template it deleted **51 of 100** cloud connections on the way to the
 * backend, including `claimSite`'s `secret.done -> DbCollection2.storageFetch`
 * — the wire that starts the function — so every endpoint answered nothing and
 * timed out at 30 s (SB-017 §1, §2).
 *
 * WFA-009 already replaced one family this way (`pm-`, through
 * `dynamicPortRules.ts`'s `namedports/list` rule and `NamedPortsAdapter`). This
 * module is the rest of them, and it is code rather than a rule for the reason
 * `dynamicPortRules.ts`'s own header gives: a rule may expand one list
 * parameter, and *"a node whose ports depend on a database schema, on another
 * component, or on a parsed script writes a `NodeTypeAdapters` class instead"*.
 *
 * ## Every port here is one the runtime really registers
 *
 * This is not the editor inventing ports so the exporter will stop filtering.
 * Each family below is registered **on demand, by name** by the running node:
 *
 * | family | runtime |
 * |---|---|
 * | `in-*` / `out-*` | `simplejavascript.ts:637,684` |
 * | `prop-*` | `dbmodelcrudbase.ts:639` (`_addInputProperties`) |
 * | `acl-*` | `dbmodelcrudbase.ts:870` (`_addAccessControl`) |
 * | `qp-*` | `dbcollectionnode2.ts:1076` |
 * | `storageFetch` | `dbcollectionnode2.ts:1086` |
 *
 * and `NodeScope.createConnection` calls `registerInputIfNeeded` /
 * `registerOutputIfNeeded` on the wire's own ports before connecting it
 * (`nodescope.ts:149-150`). **The wire is the declaration** — which is why
 * `nodegx-backend/tests/helpers/authored-bundle.ts`, which drops nothing,
 * produces functions that work.
 *
 * ## 🔴 The one place the derivation reads connections, and why it has to
 *
 * `prop-<field>` is the Record family's schema-driven port set, and the runtime
 * builds it from the **introspected columns of the selected class**
 * (`record-ports.ts` `recordFieldPorts`). The editor cannot: measured on the
 * real drive project (`~/Documents/sb015-editor-drive/nodegx.project.json`, the
 * one SB-017 §1 called), the `dbCollections` metadata a live, bound, started
 * NodeGX backend produced is
 *
 * ```json
 * [{"name":"Page","columns":[],"createdAt":null}, …]
 * ```
 *
 * — three of the five classes, and **`columns: []` on every one**. That is not a
 * transient state: on this backend a column exists once something has written
 * it, and the graph that writes it is the graph whose ports are missing. So a
 * fresh site can never have the schema its own `prop-` ports would need, and
 * the schema route would not have worked before WF-007 either. (This answers
 * the question SB-017 §6.5 left open — why the `prop-`/`qp-` warnings survived
 * s15's live-backend control.)
 *
 * What the editor does know is what the author wired, and the runtime agrees
 * with it exactly: `registerInputIfNeeded` mints `prop-<anything>` on the wire.
 * So {@link recordPortsForNode} takes the field names from the node's own
 * `prop-*` parameters **and** from the `prop-*` endpoints of wires touching it.
 *
 * ⚠️ **The cost, stated rather than rounded off.** For this family, on these
 * node types, in a cloud component, a wire can no longer be reported as going
 * to a port that does not exist — because after this it does. A mistyped
 * `prop-titel` writes a `titel` column instead of warning. That is the runtime's
 * behaviour being reported accurately, not a check being weakened: nothing else
 * loses its warning, a `prop-` wire on a node type with no `prop-` family is
 * still dropped, and any port name outside these families is still dropped.
 * Two of `sb017-deploy-connection-parity.test.ts`'s cases are the controls.
 *
 * ## No imports, on purpose
 *
 * Like `dynamicPortRules.ts`: this is reached from `tests-unit/` (plain Node, no
 * renderer, no Electron, no editor singletons), which is the only runner in this
 * package that can grade this kind of logic without starting Electron. The two
 * places it restates something another package owns —
 * `JavascriptNodeParser.parseAndAddPortsFromScript`'s port grammar and
 * `queryutils.collectFilterParameters`'s filter walk — are pinned against those
 * originals by `tests-unit/sb-017/`, which *can* import them.
 *
 * @module models/nodelibrary/cloudDynamicPorts
 */

/** A port as the node library, `getPorts()` and `setDynamicPorts()` all speak it. */
export interface GeneratedPort {
  name: string;
  displayName?: string;
  plug?: string;
  type?: unknown;
  group?: string;
  index?: number;
  [extra: string]: unknown;
}

/**
 * The slice of a node this module reads. Structural rather than `NodeGraphNode`
 * so nothing here imports the renderer.
 */
export interface PortNodeLike {
  id?: string;
  parameters?: Record<string, unknown>;
}

/** A wire, in the shape `NodeGraphModel.connections` holds. */
export interface ConnectionLike {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** Node types whose script the editor parses for `in-*` / `out-*`. */
export const SCRIPT_PORT_TYPES: readonly string[] = ['JavaScriptFunction'];

/**
 * Node types with `prop-*` **input** ports and `acl-*` rules —
 * `dbmodelcrudbase.addInputProperties` + `addAccessControl`. Delete Record
 * applies neither and is deliberately absent (`deletedbmodelpropertiesnode.ts:83`).
 */
export const RECORD_WRITE_TYPES: readonly string[] = ['NewDbModelProperties', 'SetDbModelProperties'];

/** The Record node — the same fields, plugged `output` (`dbmodelnode2.ts:532`). */
export const RECORD_READ_TYPES: readonly string[] = ['DbModel2'];

/** Query Records — `qp-*` and the dynamic `Do`. */
export const QUERY_TYPES: readonly string[] = ['DbCollection2'];

/** Every node type this module has a derivation for. */
export function typeHasCloudDynamicPorts(typename: string | undefined): boolean {
  if (!typename) return false;
  return (
    SCRIPT_PORT_TYPES.includes(typename) ||
    RECORD_WRITE_TYPES.includes(typename) ||
    RECORD_READ_TYPES.includes(typename) ||
    QUERY_TYPES.includes(typename)
  );
}

// ── JavaScriptFunction: `in-*` / `out-*` ─────────────────────────────────────

/** One entry of the `scriptInputs` / `scriptOutputs` proplists. */
interface ScriptPortSpec {
  id?: string;
  label?: string;
}

function proplist(parameters: Record<string, unknown>, name: string): ScriptPortSpec[] {
  const value = parameters[name];
  return Array.isArray(value) ? (value as ScriptPortSpec[]) : [];
}

/**
 * The port names a Function's script declares by using them.
 *
 * The four matches are `JavascriptNodeParser.parseAndAddPortsFromScript`'s, in
 * its order, so that a name it finds is a name this finds and with the same
 * type: an `Outputs.Done()` call is a `signal`, every other mention is `'*'`.
 * Restated rather than imported because that module `require`s four more of the
 * runtime's own files, and this package does not depend on `@noodl/runtime`.
 * `tests-unit/sb-017/script-ports-agree-with-the-runtime.test.ts` runs both over
 * the same corpus.
 */
export function scriptPortsFromSource(script: string | undefined): GeneratedPort[] {
  const ports: GeneratedPort[] = [];
  if (typeof script !== 'string') return ports;

  const add = (names: Iterable<RegExpMatchArray>, plug: string, type: unknown, prefix: string) => {
    const seen: Record<string, boolean> = {};
    for (const match of names) {
      const name = match[1];
      if (name === undefined || seen[name]) continue;
      seen[name] = true;
      if (ports.some((p) => p.name === prefix + name && p.plug === plug)) continue;
      ports.push({
        name: prefix + name,
        displayName: name,
        plug,
        type,
        group: plug === 'input' ? 'Inputs' : 'Outputs'
      });
    }
  };

  add(script.matchAll(/Inputs\.([A-Za-z0-9_]+)/g), 'input', '*', 'in-');
  // `plug: 'inputs'` in the original — a typo it has always had, and one that
  // matters: the port it makes is not an input port, so a wire to a name that
  // ONLY appears in `Inputs["x"]` form is dropped by the runtime's own editor
  // half too. Restated exactly, so the two agree.
  add(script.matchAll(/Inputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]/g), 'inputs', '*', 'in-');
  add(script.matchAll(/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/g), 'output', 'signal', 'out-');
  add(script.matchAll(/Outputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]\(\s*\)/g), 'output', 'signal', 'out-');
  add(script.matchAll(/Outputs\.([A-Za-z0-9_]+)/g), 'output', '*', 'out-');
  add(script.matchAll(/Outputs\s*\[\s*"([^"]*)"\s*\]/g), 'output', '*', 'out-');

  return ports;
}

/**
 * A Function node's `in-*` / `out-*` ports: the two proplists first, then the
 * script — the order `simplejavascript.ts` builds them in, because the first
 * declaration of a name wins and the proplist carries the author's chosen type
 * (`intype-`/`outtype-`).
 */
export function scriptPortsForNode(node: PortNodeLike): GeneratedPort[] {
  const parameters = node.parameters || {};
  const ports: GeneratedPort[] = [];

  for (const spec of proplist(parameters, 'scriptOutputs')) {
    if (!spec.label) continue;
    ports.push({
      name: 'out-' + spec.label,
      displayName: spec.label,
      plug: 'output',
      type: (parameters['outtype-' + spec.label] as string) || '*',
      group: 'Outputs'
    });
  }

  for (const spec of proplist(parameters, 'scriptInputs')) {
    if (!spec.label) continue;
    ports.push({
      name: 'in-' + spec.label,
      displayName: spec.label,
      plug: 'input',
      type: (parameters['intype-' + spec.label] as string) || 'string',
      group: 'Inputs'
    });
  }

  for (const port of scriptPortsFromSource(parameters['functionScript'] as string | undefined)) {
    if (ports.some((p) => p.name === port.name && p.plug === port.plug)) continue;
    ports.push(port);
  }

  return ports;
}

// ── Record family: `prop-*` and `acl-*` ──────────────────────────────────────

/**
 * The `acl-<id>-*` ports one `accessControl` proplist declares.
 *
 * `dbmodelcrudbase.ts:788-865`, including the branch that decides between
 * `-role` and `-userid`: an unset Target means `user`, which is the reading the
 * runtime's own port builder has always taken.
 */
export function accessControlPortsForNode(node: PortNodeLike): GeneratedPort[] {
  const parameters = node.parameters || {};
  const rules = parameters['accessControl'];
  if (!Array.isArray(rules)) return [];

  const ports: GeneratedPort[] = [];
  for (const rule of rules as { id?: string; label?: string }[]) {
    if (!rule || !rule.id) continue;
    const prefix = 'acl-' + rule.id;
    const label = rule.label || rule.id;
    const group = label + ' Access Rule';

    ports.push({
      name: prefix + '-target',
      displayName: 'Target',
      editorName: label + ' | Target',
      plug: 'input',
      type: {
        name: 'enum',
        enums: [
          { value: 'user', label: 'User' },
          { value: 'everyone', label: 'Everyone' },
          { value: 'role', label: 'Role' }
        ],
        allowEditOnly: true
      },
      group,
      default: 'user',
      parent: 'accessControl',
      parentItemId: rule.id
    });

    const target = parameters[prefix + '-target'];
    if (target === 'role') {
      ports.push({
        name: prefix + '-role',
        displayName: 'Role',
        editorName: label + ' | Role',
        group,
        plug: 'input',
        type: 'string',
        parent: 'accessControl',
        parentItemId: rule.id
      });
    } else if (target === undefined || target === 'user') {
      ports.push({
        name: prefix + '-userid',
        displayName: 'User Id',
        editorName: label + ' | User Id',
        group,
        plug: 'input',
        type: { name: 'string', allowConnectionsOnly: true },
        parent: 'accessControl',
        parentItemId: rule.id
      });
    }

    for (const field of ['read', 'write']) {
      ports.push({
        name: prefix + '-' + field,
        displayName: field === 'read' ? 'Read' : 'Write',
        editorName: label + ' | ' + (field === 'read' ? 'Read' : 'Write'),
        group,
        plug: 'input',
        type: { name: 'boolean' },
        default: true,
        parent: 'accessControl',
        parentItemId: rule.id
      });
    }
  }

  return ports;
}

/** The `prop-<field>` names a node's own parameters and wires name. See the module docblock. */
export function recordFieldNames(node: PortNodeLike, connections: readonly ConnectionLike[]): string[] {
  const names: string[] = [];
  const add = (portName: string) => {
    if (!portName.startsWith('prop-')) return;
    const field = portName.substring('prop-'.length);
    if (field.length > 0 && !names.includes(field)) names.push(field);
  };

  for (const parameter of Object.keys(node.parameters || {})) add(parameter);
  for (const c of connections) {
    if (c.toId === node.id) add(c.toProperty);
    if (c.fromId === node.id) add(c.fromProperty);
  }

  return names;
}

/**
 * A Record-family node's `prop-*` ports, plus `acl-*` on the two that write.
 *
 * `plug` follows the node: the write nodes take values in, the Record node
 * publishes them out.
 */
export function recordPortsForNode(
  node: PortNodeLike,
  typename: string,
  connections: readonly ConnectionLike[]
): GeneratedPort[] {
  const plug = RECORD_READ_TYPES.includes(typename) ? 'output' : 'input';
  const ports: GeneratedPort[] = recordFieldNames(node, connections).map((field) => ({
    name: 'prop-' + field,
    displayName: field,
    // `'*'` rather than a guessed column type. The runtime's own port builder
    // reads the type off the introspected column, and there is no column — see
    // the module docblock. `'*'` is what it falls back to for every Parse type
    // it has no entry for, so it is this family's own "not narrowed" answer
    // rather than a new one.
    type: '*',
    plug,
    group: 'Properties'
  }));

  if (RECORD_WRITE_TYPES.includes(typename)) ports.push(...accessControlPortsForNode(node));

  return ports;
}

// ── Query Records: `qp-*` and the dynamic `Do` ───────────────────────────────

/**
 * The filter-parameter names a saved `visualFilter` needs ports for.
 *
 * `queryutils.collectFilterParameters(query, 'qp-')`, both saved shapes: a
 * project that has not been opened since BCN-003b still holds
 * `{combinator, rules}`, and the builder writes `{type, conditions}`. Restated
 * for the same reason as the script grammar above, and pinned the same way.
 */
export function filterParameterNames(query: unknown): string[] {
  const names: string[] = [];
  const push = (name: unknown) => {
    if (typeof name === 'string' && name.length > 0 && !names.includes(name)) names.push(name);
  };

  const isSavedGroup = (item: Record<string, unknown>) => item.type === 'and' || item.type === 'or';
  const isVisual = (value: Record<string, unknown>) =>
    !Array.isArray(value.conditions) &&
    (value.combinator !== undefined || value.property !== undefined || value.operator !== undefined);

  const walkVisual = (node: Record<string, unknown> | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.rules)) node.rules.forEach((r) => walkVisual(r as Record<string, unknown>));
    else push(node.input);
  };

  const walkSaved = (item: Record<string, unknown> | undefined) => {
    if (!item || typeof item !== 'object') return;
    if (isSavedGroup(item)) {
      const conditions = Array.isArray(item.conditions) ? item.conditions : [];
      conditions.forEach((c) => walkSaved(c as Record<string, unknown>));
      return;
    }
    if (item.valueSource !== 'connected' || typeof item.valuePortName !== 'string') return;
    push(item.valuePortName.startsWith('qp-') ? item.valuePortName.slice('qp-'.length) : item.valuePortName);
  };

  if (!query || typeof query !== 'object') return names;
  if (isVisual(query as Record<string, unknown>)) walkVisual(query as Record<string, unknown>);
  else walkSaved(query as Record<string, unknown>);
  return names;
}

/**
 * A Query Records node's derived ports.
 *
 * `storageFetch` — the `Do` signal — is pushed unconditionally by
 * `dbcollectionnode2.ts:1222`, and it is the wire that starts `claimSite`
 * (SB-017 §6.4). It is a *dynamic* port on a node with plenty of static ones,
 * which is exactly why it went unnoticed: everything else on that node resolved.
 */
export function queryPortsForNode(node: PortNodeLike): GeneratedPort[] {
  const parameters = node.parameters || {};
  const ports: GeneratedPort[] = [
    { name: 'storageFetch', displayName: 'Do', plug: 'input', type: 'signal', group: 'Actions' }
  ];

  for (const input of filterParameterNames(parameters['visualFilter'])) {
    ports.push({ name: 'qp-' + input, displayName: input, plug: 'input', type: '*', group: 'Query Parameters' });
  }

  return ports;
}

// ── The one entry point ──────────────────────────────────────────────────────

/**
 * Every dynamic port this module can derive for one node, or `[]` for a type it
 * has no derivation for.
 */
export function cloudDynamicPortsForNode(
  node: PortNodeLike,
  typename: string | undefined,
  connections: readonly ConnectionLike[]
): GeneratedPort[] {
  if (!typename) return [];
  if (SCRIPT_PORT_TYPES.includes(typename)) return scriptPortsForNode(node);
  if (RECORD_WRITE_TYPES.includes(typename) || RECORD_READ_TYPES.includes(typename)) {
    return recordPortsForNode(node, typename, connections);
  }
  if (QUERY_TYPES.includes(typename)) return queryPortsForNode(node);
  return [];
}
