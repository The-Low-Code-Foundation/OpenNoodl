/**
 * AAQ-005 — this package's half of the one authoring vocabulary.
 *
 * The table lives in the editor's `validation/authoringVocabulary` (the layer
 * both packages already import); zod does not, and cannot — `noodl-editor` has no
 * zod dependency and should not grow one to describe a tool surface it renders as
 * JSON Schema. So the *declaration* is shared and each client keeps a small
 * renderer: `authoring/tools.ts` renders JSON Schema for `submit_component`, this
 * file renders zod for `create_component` / `update_component` / the plan tools.
 *
 * ⚠️ The asymmetry that matters when you edit the table: **here the schema is
 * enforcement.** zod rejects a malformed call before the handler runs, so making
 * a field `requiredIn: ['mcp']` hard-rejects external calls that work today. On
 * the editor side the same schema is instruction only — `toSubmitPayload` casts
 * unchecked. That is why `id` and `plug` are required in the editor's rendering
 * and optional here: converging the text is free, converging the enforcement is a
 * breaking change to a shipped API.
 *
 * Two behaviours this renderer preserves deliberately, because they were load-
 * bearing before it existed:
 *
 * - **Node and port objects are `.passthrough()`; connections are not.** An
 *   external agent doing read-modify-write hands back the graph it was given,
 *   including `stateParameters`, `stateTransitions` and `metadata` — which the
 *   storage schema allows and this package therefore must not strip. (The editor
 *   solves the same problem the other way, by carrying those fields over from the
 *   base node; see `CARRIED_NODE_FIELDS`.) A connection has exactly four fields
 *   an agent may *author*, and an unknown fifth is a mistake worth reporting.
 *
 *   ⚠️ **That last sentence used to end at "four fields", and by SIG-007 it was
 *   false in a way that lost data.** A connection has four *authorable* fields
 *   and, on disk, three more it does not: `label`, `labelT` (CAN-001/CAN-002)
 *   and `anchors` (SIG-007's hand-drawn routing). Because zod's default is
 *   **strip** rather than reject, read-modify-write silently returned graphs
 *   with all three gone — the schema was not reporting the mistake it claimed
 *   to. The rule is kept as written, because an agent still has no business
 *   authoring where a wire bends and the schema surface is already 27k tokens a
 *   turn; the three fields are **carried over from the baseline** instead. See
 *   `carryConnectionPresentation` in `tools/author.ts`.
 * - **`parameters` is `z.record(z.unknown())`**, not a bare object: parameter
 *   values are validated by the shared gate (AIB-001), not by the tool schema.
 */

import { z } from 'zod';

import {
  AUTHORED_COMMENT_FIELD,
  AUTHORED_CONNECTION_FIELDS,
  AUTHORED_NODE_FIELDS,
  AUTHORED_PAYLOAD_FIELDS,
  AUTHORED_PORT_FIELDS,
  describeFor,
  fieldsFor,
  isRequiredIn
} from './editor-deps';
import type { VocabField } from './editor-deps';

const CLIENT = 'mcp' as const;

interface Nested {
  node?: z.ZodTypeAny;
  connection?: z.ZodTypeAny;
  port?: z.ZodTypeAny;
}

function baseType(field: VocabField, nested: Nested): z.ZodTypeAny {
  switch (field.kind) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    // Parameter *values* are the shared gate's business, not the tool schema's.
    case 'object':
      return z.record(z.unknown());
    case 'enum':
      return z.enum([...(field.enumValues ?? [])] as [string, ...string[]]);
    case 'string-array':
      return z.array(z.string());
    case 'node-array':
      return z.array(nested.node ?? z.unknown());
    case 'connection-array':
      return z.array(nested.connection ?? z.unknown());
    case 'port-array':
      return z.array(nested.port ?? z.unknown());
  }
}

/**
 * One field as zod. `.min()` then `.optional()` then `.describe()` — the order
 * the hand-written schemas used, which is the order the MCP SDK's JSON-Schema
 * conversion was verified against.
 */
export function zodForField(field: VocabField, nested: Nested = {}): z.ZodTypeAny {
  let schema = baseType(field, nested);
  if (field.minItems !== undefined && schema instanceof z.ZodArray) schema = schema.min(field.minItems);
  if (!isRequiredIn(field, CLIENT)) schema = schema.optional();
  const description = describeFor(field, CLIENT);
  return description ? schema.describe(description) : schema;
}

/**
 * LEG-001 — the `comment` argument on its own, rendered from the same row
 * `nodeSchema` renders, for the one place that needs it outside a whole node:
 * `update_node.set`. Re-deriving it there would be a second copy of the sentence,
 * which is the exact failure this module exists to prevent — and the throw is a
 * tripwire, because a `comment` row deleted from the table must not leave a delta
 * door quietly describing a field the doors no longer share.
 */
export const NODE_COMMENT_ARG: z.ZodTypeAny = (() => {
  const field = AUTHORED_NODE_FIELDS.find((f) => f.name === AUTHORED_COMMENT_FIELD);
  if (!field) throw new Error('The authoring vocabulary declares no `comment` field on a node (LEG-001).');
  return zodForField(field);
})();

/** A record of zod types, keyed by field name — what `registerTool` takes. */
export function zodShapeFor(fields: readonly VocabField[], nested: Nested = {}): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fieldsFor(fields, CLIENT)) shape[field.name] = zodForField(field, nested);
  return shape;
}

// ─── Keeping the write handlers typed ─────────────────────────────────────────
//
// ⚠️ Rendering a shape from a table produces `Record<string, ZodTypeAny>`, and
// zod then infers the tool's argument type as `{ [x: string]: any }`. Every write
// handler in `author.ts` and `planTools.ts` takes its arguments from that
// inference, so deriving the schemas *without* the shape types below silently
// turns the whole authoring write path into `any` — a real regression bought with
// a refactor, and exactly what slice 1 warned about. So the runtime values
// (names, optionality, descriptions, enum members) come from the one table, and
// the compile-time shape is stated here.
//
// The assertions below are checked, not assumed: `vocabularyParity.test.ts` reads
// each registered schema back at runtime — field names, optionality, descriptions,
// enum members — and compares them with the table, so a shape type that stops
// matching the table fails a spec rather than rotting.

type Opt<T extends z.ZodTypeAny> = z.ZodOptional<T>;

type PortShape = {
  name: z.ZodString;
  plug: Opt<z.ZodEnum<['input', 'output']>>;
  type: Opt<z.ZodString>;
  index: Opt<z.ZodNumber>;
};

export const portSchema = z
  .object(zodShapeFor(AUTHORED_PORT_FIELDS) as unknown as PortShape)
  .passthrough()
  .describe('Port definition; `name` required, other fields (type, displayName, plug, group…) pass through');

type NodeShape = {
  id: Opt<z.ZodString>;
  type: z.ZodString;
  label: Opt<z.ZodString>;
  // LEG-001. Flat here, `metadata.comment` on disk — `foldNodeComment` in
  // `tools/author.ts` and `graph.ts` does the mapping, so a caller never names
  // the bag. Declared in the shape type for the reason the block above gives:
  // without it the write handlers' inferred argument type loses the field.
  comment: Opt<z.ZodString>;
  x: Opt<z.ZodNumber>;
  y: Opt<z.ZodNumber>;
  parent: Opt<z.ZodString>;
  children: Opt<z.ZodArray<z.ZodString>>;
  parameters: Opt<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  variant: Opt<z.ZodString>;
  ports: Opt<z.ZodArray<typeof portSchema>>;
};

export const nodeSchema = z
  .object(zodShapeFor(AUTHORED_NODE_FIELDS, { port: portSchema }) as unknown as NodeShape)
  .passthrough();

type ConnectionShape = {
  fromId: z.ZodString;
  fromProperty: z.ZodString;
  toId: z.ZodString;
  toProperty: z.ZodString;
};

export const connectionSchema = z.object(
  zodShapeFor(AUTHORED_CONNECTION_FIELDS) as unknown as ConnectionShape
);

type CreateComponentShape = {
  path: z.ZodString;
  type: Opt<z.ZodEnum<['page', 'visual', 'logic', 'cloud']>>;
  nodes: z.ZodArray<typeof nodeSchema>;
  connections: Opt<z.ZodArray<typeof connectionSchema>>;
  visual_roots: Opt<z.ZodArray<z.ZodString>>;
  description: Opt<z.ZodString>;
  allow_unknown_types: Opt<z.ZodBoolean>;
};

/**
 * `create_component`'s argument shape. Passed straight to `registerTool`, so the
 * parity spec can read exactly what the server registers rather than a
 * reconstruction of it.
 */
export const CREATE_COMPONENT_SHAPE = zodShapeFor(AUTHORED_PAYLOAD_FIELDS, {
  node: nodeSchema,
  connection: connectionSchema,
  port: portSchema
}) as unknown as CreateComponentShape;
