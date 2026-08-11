/**
 * AAQ-005 — one authoring vocabulary, declared once.
 *
 * ## What this closes
 *
 * Slice 1 made both clients *judge* an authored candidate identically. Slice 2
 * made them *apply* one identically. Neither touched the thing the agent is
 * actually handed: the **schema of what it may say about a node**. That lived in
 * two hand-written places, in two schema languages —
 * `AiAssistant/authoring/tools.ts` (JSON Schema, for `submit_component`) and
 * `noodl-mcp/src/tools/author.ts` (zod, for `create_component`/
 * `update_component`) — and they had already drifted, in both directions:
 *
 * | field | editor | `noodl-mcp` |
 * |---|---|---|
 * | `children` | absent (derived from `parent`) | accepted and reconciled |
 * | `variant` | absent | accepted |
 * | `plug` on an instance port | declared, and required | **not declared at all** |
 * | `sample_data` | accepted | absent |
 * | `stateParameters` and friends | not expressible | reachable via `.passthrough()` |
 *
 * Some of those are deliberate and load-bearing; some are accidents nobody could
 * see, because the two files never had to agree about anything. This module is the
 * table both renderers read, so a field added to the vocabulary is added once.
 *
 * Two specs hold it up, and they check different things — do not look for either
 * in the other: `tests-unit/aaq-005/authoringVocabulary.test.ts` (editor, jest)
 * pins that `submit_component` renders byte-for-byte what its hand-written literal
 * did, that every divergence carries a reason, and that no field here is absent
 * from `schemas/nodes.schema.json`; `noodl-mcp/tests/vocabularyParity.test.ts`
 * reads both renderings back and fails when the two doors describe a shared field
 * differently.
 *
 * ## ⚠️ The two surfaces do not enforce alike, and this is a trap
 *
 * On the MCP side these schemas are **enforcement**: zod rejects the tool call
 * before any handler runs. On the editor side they are **instruction only** —
 * `toSubmitPayload` casts the model's arguments unchecked, and `buildCandidate`
 * re-derives the shape errors it actually cares about. So marking a field
 * `requiredIn: ['mcp']` makes a previously-valid external call fail hard, while
 * marking one `requiredIn: ['editor']` only changes a sentence the model reads.
 * That asymmetry is why several fields below are deliberately required in one
 * client and merely described in the other: converging the *text* is free, and
 * converging the *enforcement* is a breaking change to a shipped external API.
 * This is slice 2's lesson in a new dress — sharing a declaration moves its
 * consequences into a client that may not want them.
 *
 * ## What is deliberately NOT here
 *
 * The tool *set* — `update_component`'s `operations` dialect, `if_revision`, the
 * plan tools, the editor's read tools. Those are per-client tool shapes, and
 * AIX-002 rejected the delta dialect for the editor on purpose (the unit is the
 * whole component). See `SURFACE_DIVERGENCES` for the declared list of those,
 * which the parity spec also pins.
 *
 * Pure: no `fs`, no Electron, no editor model, no zod. It lives in `validation/`
 * for the same reason `authoredCandidate.ts` does — that is the layer both
 * packages already import, which is what makes "declared once" a fact.
 *
 * @module noodl-editor/validation/authoringVocabulary
 */

/** The two clients that bind this vocabulary. */
export type VocabClient = 'editor' | 'mcp';

export const VOCAB_CLIENTS: readonly VocabClient[] = ['editor', 'mcp'];

/**
 * Field value shapes. Deliberately coarse — this describes what an agent may
 * *say*, not the storage format (`schemas/nodes.schema.json` owns that, and
 * `tests-unit/aaq-005` checks every node field below exists there).
 */
export type VocabKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'enum'
  | 'string-array'
  | 'node-array'
  | 'connection-array'
  | 'port-array';

export interface VocabField {
  readonly name: string;
  readonly kind: VocabKind;
  /**
   * The one description both clients show. Where the editor already had one it is
   * kept verbatim: `submit_component`'s wording is prompt surface for the
   * in-editor loop, and changing it is a behaviour change dressed as a refactor.
   */
  readonly description?: string;
  /** Clients that expose the field. Omitted means both. */
  readonly exposedTo?: readonly VocabClient[];
  /** Clients in which the field is mandatory. Omitted means optional everywhere. */
  readonly requiredIn?: readonly VocabClient[];
  /** Appended to the description for one client, where its behaviour genuinely differs. */
  readonly clientNotes?: Readonly<Partial<Record<VocabClient, string>>>;
  /**
   * Why this field is not identical across the two clients. **Required** whenever
   * `exposedTo`, `requiredIn` or `clientNotes` is partial — `undeclaredDivergences()`
   * returns the offenders and `tests-unit/aaq-005` asserts that list is empty, so
   * an undeclared divergence cannot be added quietly.
   */
  readonly divergence?: string;
  readonly enumValues?: readonly string[];
  readonly minItems?: number;
  /**
   * LEG-001 — where the field lives on disk, when that is not a top-level key of
   * the same name. Dotted, e.g. `metadata.comment`.
   *
   * The authored name is what an agent says; this is where the renderers put it.
   * Declared rather than implied because `tests-unit/aaq-005` checks every node
   * field against `schemas/nodes.schema.json` and would otherwise call a mapped
   * field a phantom — the `widthUnit` check is the reason that spec exists, and
   * "it is really `metadata.comment`" is exactly the excuse it must not accept
   * from an undeclared field.
   */
  readonly storedAs?: string;
}

/** A vocabulary surface: one named table of fields. */
export interface VocabSurface {
  readonly name: 'node' | 'port' | 'connection' | 'payload';
  readonly fields: readonly VocabField[];
}

// ─── The node ─────────────────────────────────────────────────────────────────

export const AUTHORED_NODE_FIELDS: readonly VocabField[] = [
  {
    name: 'id',
    kind: 'string',
    description: 'Unique id you invent; required to wire connections or parent nodes',
    requiredIn: ['editor'],
    clientNotes: { mcp: 'Generated when omitted' },
    // Both clients mint an id for a node that arrives without one (`newId()` in
    // candidate.ts, `ensureIds()` in author.ts), so this is a difference in what
    // the model is *told*, not in what happens. It stays a difference because the
    // editor's contract has no second call in which a generated id could be
    // handed back: a node it did not name can never be parented or wired, so the
    // instruction is worth the strictness. Requiring it in MCP's zod instead would
    // hard-reject external calls that are valid today.
    divergence:
      "`id` is required in the editor's schema and optional in MCP's. Both generate one when it is absent; " +
      'the editor states the requirement because its whole-candidate contract offers no way to learn a ' +
      'generated id, and MCP keeps it optional because zod enforcement there would break shipped callers.'
  },
  {
    name: 'type',
    kind: 'string',
    description: 'Exact catalog typeName ("Group"), or an existing component name ("/Pages/Home") to instantiate it',
    requiredIn: ['editor', 'mcp']
  },
  { name: 'label', kind: 'string', description: 'What this node is for, in this graph' },
  // LEG-001 — the other arm of a natural experiment this repo already ran.
  // `label` is in this table and 1,003 of 1,123 authored nodes (89.3%) carry
  // one; `metadata.comment` was not, and carried **1 in 2,045**. It was never
  // "the agent does not bother": through MCP the field reached disk only because
  // the node schema is `.passthrough()`, undeclared and undescribed, and in the
  // editor it was absent from the schema entirely — a model cannot write what
  // nothing names. This row is the sentence `label` got, written for the field
  // that never had one.
  //
  // Optional, deliberately: the 89.3% arm was optional, and `requiredIn: ['mcp']`
  // would hard-reject calls that are valid today (see the module header). The
  // judgement lives in the description because no validator can hold it — whether
  // a sentence restates the type is not checkable, so "omit when the type and
  // label already say it" goes where a model reads it before writing.
  {
    name: 'comment',
    kind: 'string',
    description:
      'Why this node is the way it is — a constraint, a rule, or a decision with an alternative. ' +
      'Omit when the type and label already say it.',
    // Flat here, `metadata.comment` on disk (CAN-004's stripe, tooltip and
    // context menu all read it there). The bag also holds `merge` and the
    // CED-001 code history, and an agent has no business knowing that: the
    // renderers fold the flat field in on the way to storage and surface it back
    // on the way out. See `foldNodeComment` / `unfoldNodeComment` below.
    storedAs: 'metadata.comment'
  },
  // No description, in either client, before or after. `x`/`y` are self-evident
  // and adding text here would change `submit_component`'s prompt surface for no
  // gain.
  { name: 'x', kind: 'number' },
  { name: 'y', kind: 'number' },
  {
    name: 'parent',
    kind: 'string',
    description: 'Id of the parent node in the visual tree; omit for roots and logic nodes'
  },
  {
    name: 'children',
    kind: 'string-array',
    description: 'Child ids in render order (kept consistent with parent fields)',
    exposedTo: ['mcp'],
    divergence:
      'The editor derives children from `parent` plus submission order (`candidate.ts`): double bookkeeping — ' +
      'parent fields AND children arrays — is exactly the consistency an LLM gets wrong, so its contract removes ' +
      'the choice. MCP accepts either or both and reconciles them (`reconcileHierarchy`), because an external ' +
      'agent doing read-modify-write hands back the graph it was given, children arrays included.'
  },
  { name: 'parameters', kind: 'object', description: 'Static input values keyed by exact port name' },
  {
    name: 'variant',
    kind: 'string',
    exposedTo: ['mcp'],
    divergence:
      "⚠️ A real gap, not a design choice on the editor's side. `variant` is one of `CARRIED_NODE_FIELDS`: on an " +
      'update the editor copies it from the base node so an AI revision cannot eat hand-tuned styling. But on a ' +
      '**create** there is no base, so a component the editor authors can never have a variant at all — while an ' +
      'external agent can set one. Filed as AAQ-011 F14 for AAQ-010 (the whole styling surface).'
  },
  {
    name: 'ports',
    kind: 'port-array',
    description:
      'Instance ports — only for "Component Inputs" (plug "output") and "Component Outputs" (plug "input") nodes'
  }
];

// ─── An instance port ─────────────────────────────────────────────────────────

export const AUTHORED_PORT_FIELDS: readonly VocabField[] = [
  { name: 'name', kind: 'string', requiredIn: ['editor', 'mcp'] },
  {
    name: 'plug',
    kind: 'enum',
    enumValues: ['input', 'output'],
    requiredIn: ['editor'],
    // ⚠️ This one had a consequence. `NodeGraphNode.getPorts(filter)` selects on
    // `p.plug && p.plug.indexOf(filter) !== -1`, and `componentmodel`'s interface
    // derivation reads only `getPorts('input')` / `getPorts('output')` — so a
    // declared instance port with no `plug` lands in neither map and is **inert**:
    // the component silently has no such input or output. MCP's port schema was
    // `{ name }` with `.passthrough()`, so an external agent was never told the
    // field exists. Declaring it here tells both doors. Nothing yet *checks* it —
    // AAQ-011 F15.
    divergence:
      "`plug` is required in the editor's schema and optional in MCP's. It was absent from MCP's schema entirely " +
      'until this slice, and a port without it is inert in both clients (`getPorts` filters on it). Optional in ' +
      'MCP because requiring it would hard-reject calls that are accepted today; the missing check is AAQ-011 F15.'
  },
  { name: 'type', kind: 'string', description: 'Port value type; "*" when it does not matter' },
  { name: 'index', kind: 'number' }
];

// ─── A connection ─────────────────────────────────────────────────────────────

export const AUTHORED_CONNECTION_FIELDS: readonly VocabField[] = [
  { name: 'fromId', kind: 'string', requiredIn: ['editor', 'mcp'] },
  {
    name: 'fromProperty',
    kind: 'string',
    description: 'Output port name on the source node',
    requiredIn: ['editor', 'mcp']
  },
  { name: 'toId', kind: 'string', requiredIn: ['editor', 'mcp'] },
  {
    name: 'toProperty',
    kind: 'string',
    description: 'Input port name on the target node',
    requiredIn: ['editor', 'mcp']
  }
];

// ─── The submission payload ───────────────────────────────────────────────────
//
// The editor's `submit_component` and MCP's `create_component` — the two doors a
// whole component arrives through. `update_component`'s `set` branch reuses the
// same node/connection vocabulary; its `operations` branch is a deliberately
// MCP-only dialect (see SURFACE_DIVERGENCES).

// Declaration order is render order in both clients, and each client's slice of
// it is the order its tool already had: `path`/`type` first for MCP (a caller
// names the target before describing it), `nodes` first for the editor (whose
// session already knows the target).
export const AUTHORED_PAYLOAD_FIELDS: readonly VocabField[] = [
  {
    name: 'path',
    kind: 'string',
    description: 'New component path, e.g. "Pages/Settings" (parent path segments need not exist)',
    exposedTo: ['mcp'],
    requiredIn: ['mcp'],
    divergence:
      'The editor opens an authoring session *for* one component — the target comes from the plan, not from the ' +
      'agent — so `submit_component` has nowhere to put a path and no authority to accept one.'
  },
  {
    name: 'type',
    kind: 'enum',
    enumValues: ['page', 'visual', 'logic', 'cloud'],
    description: 'Component type; inferred from the path when omitted ("Pages/…" → page)',
    exposedTo: ['mcp'],
    divergence: "Same reason as `path`: the editor's session already carries `componentType` in its request."
  },
  { name: 'nodes', kind: 'node-array', minItems: 1, requiredIn: ['editor', 'mcp'] },
  { name: 'connections', kind: 'connection-array' },
  {
    name: 'visual_roots',
    kind: 'string-array',
    description: 'Ids of the canvas root nodes (the visual root container for pages/visual components)'
  },
  { name: 'description', kind: 'string', description: 'One or two sentences: what this component is and does' },
  {
    name: 'sample_data',
    kind: 'object',
    description:
      'Optional. Example records the preview should display, keyed by the collection name this component ' +
      'queries — up to 5 per collection, realistic values, no real data. Only for components that read a backend.',
    exposedTo: ['editor'],
    divergence:
      "AIX-008: `sample_data` is never written anywhere. It exists so the editor's sandbox preview shows a book " +
      'list full of books instead of "Title 1", and is discarded with the preview. MCP has no preview sandbox, so ' +
      'the field would be an instruction to produce output nothing consumes.'
  },
  {
    name: 'allow_unknown_types',
    kind: 'boolean',
    description:
      'Permit node types the catalog does not know (module-provided nodes). Default: unknown types reject the write.',
    exposedTo: ['mcp'],
    divergence:
      "The editor validates against the running editor's own catalog, which by construction knows every type the " +
      'project can use. MCP may be pointed at a project whose modules its bundled catalog has never seen.'
  }
];

export const AUTHORING_SURFACES: readonly VocabSurface[] = [
  { name: 'node', fields: AUTHORED_NODE_FIELDS },
  { name: 'port', fields: AUTHORED_PORT_FIELDS },
  { name: 'connection', fields: AUTHORED_CONNECTION_FIELDS },
  { name: 'payload', fields: AUTHORED_PAYLOAD_FIELDS }
];

/**
 * Divergences that are not about a field: whole tool shapes one client has and
 * the other deliberately does not. Declared here so the parity spec can pin the
 * list, and so the next person to notice one finds the reason instead of
 * assuming an oversight.
 */
export const SURFACE_DIVERGENCES: readonly { readonly what: string; readonly why: string }[] = [
  {
    what: "`update_component`'s `operations` delta dialect (add_node/update_node/remove_node/…) is MCP-only",
    why:
      'AIX-002 rejected incremental mutation for the in-editor loop: the unit is the whole component, which is what ' +
      'makes the diff-review UX and the compiler-loop repair shape possible. An external agent editing one ' +
      'parameter of a 60-node page should not have to resend the page, so MCP keeps both.'
  },
  {
    what: '`if_revision` optimistic concurrency is MCP-only',
    why:
      "The editor's session holds the project model it is authoring against and stages through a ChangeSet; there " +
      'is no window in which another writer could land. An MCP server shares a directory with a running editor.'
  },
  {
    what: 'The plan tools (`create_plan`/`stage_plan_operation`/`apply_plan`) are MCP-only as *tools*',
    why:
      "The editor reaches the same transaction through `PlanRun` and the Build panel rather than through a tool the " +
      'model calls. Both bind the same `authoring/plan` module, and since slice 2 both perform the same ' +
      'project-level effects (page registration, `bodyScroll`, provisioning).'
  },
  {
    what: 'MCP node and port schemas are `.passthrough()`; the editor drops unknown node fields',
    why:
      '⚠️ The consequence is asymmetric and worth knowing: `stateParameters`, `stateTransitions` and the rest of ' +
      '`metadata` reach disk through MCP (the storage schema allows additional properties) and cannot be expressed ' +
      'in the editor at all, where `CARRIED_NODE_FIELDS` carries them over from the base instead. Both solve "an AI ' +
      'revision must not eat hand-tuned work"; only one of them lets an agent author it in the first place. Same ' +
      'gap as `variant` above — AAQ-011 F14. **One key of that bag is now an exception**: LEG-001 declares ' +
      '`comment` as a flat authored field on both doors and maps it onto `metadata.comment`, because a field ' +
      'reachable only by knowing the storage format got written once in 2,045 nodes.'
  },
  {
    what: 'These schemas are enforcement in MCP and instruction in the editor',
    why:
      "zod rejects a malformed MCP tool call before the handler runs. The editor's `toSubmitPayload` casts unchecked " +
      'and `buildCandidate` re-derives the shape errors it needs, so a `required` here is a sentence the model reads. ' +
      'See the module header: this is why several fields are required in one client only.'
  }
];

// ─── Reading the table ────────────────────────────────────────────────────────

/** Fields this client exposes, in declaration order. */
export function fieldsFor(fields: readonly VocabField[], client: VocabClient): readonly VocabField[] {
  return fields.filter((f) => (f.exposedTo ?? VOCAB_CLIENTS).includes(client));
}

export function isRequiredIn(field: VocabField, client: VocabClient): boolean {
  return (field.requiredIn ?? []).includes(client);
}

/** The description one client shows: the shared sentence plus that client's note. */
export function describeFor(field: VocabField, client: VocabClient): string | undefined {
  const note = field.clientNotes?.[client];
  if (!field.description) return note;
  return note ? `${field.description} (${note})` : field.description;
}

export interface DeclaredDivergence {
  readonly surface: VocabSurface['name'];
  readonly field: string;
  /** What kind of difference: which clients see it, where it is required, per-client text. */
  readonly kinds: readonly ('exposure' | 'requirement' | 'note')[];
  readonly why: string;
}

/**
 * Every field-level divergence the table declares. The parity spec asserts this
 * equals an explicit expected list, so widening the gap between the two clients
 * takes a deliberate edit in two places.
 */
export function declaredDivergences(): DeclaredDivergence[] {
  const out: DeclaredDivergence[] = [];
  for (const surface of AUTHORING_SURFACES) {
    for (const field of surface.fields) {
      const kinds: DeclaredDivergence['kinds'][number][] = [];
      if (field.exposedTo && field.exposedTo.length !== VOCAB_CLIENTS.length) kinds.push('exposure');
      const required = field.requiredIn ?? [];
      const exposed = field.exposedTo ?? VOCAB_CLIENTS;
      // A field required in every client that exposes it, or in none, is uniform.
      if (required.length > 0 && required.length !== exposed.length) kinds.push('requirement');
      if (field.clientNotes && Object.keys(field.clientNotes).length > 0) kinds.push('note');
      if (kinds.length === 0) continue;
      out.push({ surface: surface.name, field: field.name, kinds, why: field.divergence ?? '' });
    }
  }
  return out;
}

/**
 * The invariant that makes the table trustworthy: a field that differs between
 * the clients must say why. Returns the offenders rather than throwing, so the
 * spec can name them.
 */
export function undeclaredDivergences(): DeclaredDivergence[] {
  return declaredDivergences().filter((d) => d.why.trim().length === 0);
}

// ─── LEG-001: the one field whose authored name is not its stored one ─────────
//
// `comment` is flat in the vocabulary and `metadata.comment` on disk. Both
// renderers describe the flat field; these two functions are the only place that
// knows about the bag, and every write path goes through them so the mapping
// cannot be half-applied.
//
// ⚠️ The bag is shared. It also holds `merge` (the SUB-007 merge driver's
// `soureCodePorts`) and, in projects saved before CED-001, `codeHistory_*` keys
// that `stripCodeHistoryMetadata` removes on the way in. Writing a comment must
// leave every other key exactly as it was — so these copy the bag and set one
// key, and never rebuild it.

/** The node field the vocabulary declares. */
export const AUTHORED_COMMENT_FIELD = 'comment';

/** Its key inside the stored node's metadata bag. */
export const STORED_COMMENT_KEY = 'comment';

interface CommentBearingNode {
  comment?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * The metadata bag with `comment` set — or cleared, when the text is empty after
 * trimming, which is `NodeGraphNode.setComment`'s rule and therefore the one the
 * editor's own context menu already applies.
 *
 * Returns `undefined` rather than `{}` when nothing is left: a node that never
 * had metadata must not gain a `"metadata": {}` key it did not have before, which
 * is a spurious diff on every save (F46) for no content.
 */
export function metadataWithComment(
  metadata: Record<string, unknown> | undefined,
  comment: string | undefined
): Record<string, unknown> | undefined {
  const text = typeof comment === 'string' ? comment.trim() : '';
  const next = { ...(metadata ?? {}) };
  if (text) next[STORED_COMMENT_KEY] = text;
  else delete next[STORED_COMMENT_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Authored → stored. Moves a flat `comment` into `metadata.comment`.
 *
 * Returns the node **unchanged and unaliased** when it carries no `comment` key,
 * so a graph written by an agent that never uses the field is byte-identical to
 * what it sent. Never mutates its argument — fc36d61a is the whole reason the
 * metadata bag is safe to write into at all.
 */
export function foldNodeComment<T extends CommentBearingNode>(node: T): T {
  if (!(AUTHORED_COMMENT_FIELD in node)) return node;
  const { comment, ...rest } = node;
  const metadata = metadataWithComment(node.metadata, typeof comment === 'string' ? comment : undefined);
  const out = rest as unknown as T;
  if (metadata) return { ...out, metadata };
  const cleared = { ...out };
  delete cleared.metadata;
  return cleared;
}

/**
 * Stored → authored. Surfaces `metadata.comment` as the flat field an agent knows
 * about, and removes it from the bag it hands back, so a read-modify-write round
 * trip is a fixed point rather than a graph carrying the same sentence twice.
 *
 * Unchanged when there is no comment to surface.
 */
export function unfoldNodeComment<T extends CommentBearingNode>(node: T): T {
  const stored = node.metadata?.[STORED_COMMENT_KEY];
  if (typeof stored !== 'string' || !stored.trim()) return node;
  const metadata = { ...node.metadata };
  delete metadata[STORED_COMMENT_KEY];
  const out: CommentBearingNode = { ...node, [AUTHORED_COMMENT_FIELD]: stored };
  if (Object.keys(metadata).length > 0) out.metadata = metadata;
  else delete out.metadata;
  return out as T;
}

// ─── Rendering: JSON Schema (the editor's tool surface) ───────────────────────

export interface JsonSchemaNode {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  minItems?: number;
  enum?: string[];
}

function scalarSchema(field: VocabField, client: VocabClient, nested: NestedSchemas): JsonSchemaNode {
  const description = describeFor(field, client);
  const base = (type: string, extra?: Partial<JsonSchemaNode>): JsonSchemaNode => ({
    type,
    ...(description ? { description } : {}),
    ...extra
  });
  switch (field.kind) {
    case 'string':
      return base('string');
    case 'number':
      return base('number');
    case 'boolean':
      return base('boolean');
    case 'object':
      return base('object');
    case 'enum':
      return base('string', { enum: [...(field.enumValues ?? [])] });
    case 'string-array':
      return base('array', { items: { type: 'string' } });
    case 'node-array':
      return base('array', { items: nested.node, ...(field.minItems ? { minItems: field.minItems } : {}) });
    case 'connection-array':
      return base('array', { items: nested.connection });
    case 'port-array':
      return base('array', { items: nested.port });
  }
}

interface NestedSchemas {
  node: JsonSchemaNode;
  connection: JsonSchemaNode;
  port: JsonSchemaNode;
}

/** Render one surface as a JSON Schema object. */
export function jsonSchemaForSurface(
  fields: readonly VocabField[],
  client: VocabClient,
  nested: NestedSchemas
): JsonSchemaNode {
  const properties: Record<string, JsonSchemaNode> = {};
  const required: string[] = [];
  for (const field of fieldsFor(fields, client)) {
    properties[field.name] = scalarSchema(field, client, nested);
    if (isRequiredIn(field, client)) required.push(field.name);
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
}

const EMPTY_NESTED: NestedSchemas = {
  node: { type: 'object' },
  connection: { type: 'object' },
  port: { type: 'object' }
};

/** The four rendered JSON Schemas for one client, nested as the tool needs them. */
export function jsonSchemasFor(client: VocabClient): NestedSchemas & { payload: JsonSchemaNode } {
  const port = jsonSchemaForSurface(AUTHORED_PORT_FIELDS, client, EMPTY_NESTED);
  const connection = jsonSchemaForSurface(AUTHORED_CONNECTION_FIELDS, client, EMPTY_NESTED);
  const node = jsonSchemaForSurface(AUTHORED_NODE_FIELDS, client, { ...EMPTY_NESTED, port });
  const payload = jsonSchemaForSurface(AUTHORED_PAYLOAD_FIELDS, client, { node, connection, port });
  return { node, connection, port, payload };
}
