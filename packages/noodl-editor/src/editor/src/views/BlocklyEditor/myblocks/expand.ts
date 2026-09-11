/**
 * The inliner (LGC-007 §"the two mechanisms", §3, §4).
 *
 * Register L20 is settled and is not reopened here: a call block cannot become a call into the
 * node graph, because signals are asynchronous and expressions are not, so `a + myFunc(b)`
 * has no meaning as a signal round trip. Inlining is the only mechanism available, and the
 * single-definition semantics the spec wants come from the *link*, not from the copy: the
 * saved definition is stored once, the call block references it by id, and the code is
 * regenerated from the definition every time.
 *
 * ## Why it inlines the JSON and not the blocks
 *
 * The obvious implementation is a Blockly generator for the call block that deserialises the
 * definition into a headless workspace and generates it. This does not do that. It rewrites
 * the serialised workspace — replacing each call block with a copy of the definition's body —
 * and hands the result to the existing generator untouched.
 *
 * Three things follow, and they are the reason:
 *
 * 1. **The guard runs where it can be tested.** §3's failure mode is a hung renderer inside a
 *    300 ms debounce tick. A cycle check living inside a Blockly generator can only be
 *    verified by driving an editor; here it is a plain function over plain JSON.
 * 2. **No generator has to change.** `NoodlGenerators.ts` does not learn about saved blocks at
 *    all; by the time it runs, there are no call blocks left.
 * 3. **The same code path serves §4's detach.** "Inline and detach" is this transform, scoped
 *    to one definition id — not a second implementation of the same idea that can drift.
 *
 * ## The two backstops
 *
 * A cycle is not the only way to hang this. An acyclic graph can still expand exponentially:
 * a definition that calls the one below it twice, ten deep, is 1024 copies, and nothing about
 * that is a cycle. So there are two limits, and both are errors rather than truncations —
 * quietly generating half a program is worse than refusing to generate one.
 *
 * @module BlocklyEditor/myblocks
 */

import { cloneJson, type BlocklyBlockJson, type BlocklyWorkspaceJson, type MyBlockDefinition } from './format';
import { MyBlocksCycleError, MyBlocksMissingDefinitionError } from './cycles';
import { argInputName, callDefinitionId, resolveHole } from './references';

/** Anything that can resolve a definition id. `MyBlocksStore` satisfies this structurally. */
export interface DefinitionSource {
  get(id: string): MyBlockDefinition | undefined;
}

/**
 * How many block copies one generate may produce.
 *
 * 400 is far past anything a person builds — the scale research this task is promoted on puts
 * the median App Inventor project at 54 blocks — and far short of anything that stalls a
 * renderer. It exists to convert a pathological *acyclic* graph from a freeze into a message.
 */
export const MAX_EXPANSIONS = 400;

/** How deep the call chain may go. A separate limit, because deep and wide fail differently. */
export const MAX_DEPTH = 24;

export class MyBlocksBudgetError extends Error {
  readonly limit: number;

  constructor(message: string, limit: number) {
    super(message);
    this.name = 'MyBlocksBudgetError';
    this.limit = limit;
  }
}

/**
 * A call block whose shape no longer matches the definition it points at.
 *
 * This is a real state, not a defensive branch: §4 lets a definition be edited after a
 * reference to it exists, and adding a `send signal` to a value definition turns it into a
 * statement. The reference is then a value plug asking for something that cannot be an
 * expression, and there is no honest code to emit for it.
 */
export class MyBlocksShapeError extends Error {
  readonly definitionId: string;

  constructor(message: string, definitionId: string) {
    super(message);
    this.name = 'MyBlocksShapeError';
    this.definitionId = definitionId;
  }
}

export interface ExpandOptions {
  /** Expand only these definition ids. Used by the detach path; omit to expand everything. */
  only?: string[];
  maxExpansions?: number;
  maxDepth?: number;
}

export interface ExpandResult {
  workspace: BlocklyWorkspaceJson;
  /** How many definition bodies were spliced in. Zero means the program used no saved blocks. */
  expansions: number;
  /**
   * VFN-014 criterion 6 — the **head** block of each spliced-in region → the definition's name.
   *
   * 🔴 This exists because of what the reproduce found. Richard read *View Code*, saw
   * `Outputs["result"] = …` and could find nothing called `result` on the canvas — because it is
   * not on the canvas. It is inside a saved block called `test1`, and the canvas shows the *call*,
   * not the body. Removing the probes makes those lines legible; it does not make them findable.
   * A reader needs to be told which lines came from a saved block, and this is the only place that
   * knows: by the time the generator runs there are no call blocks left.
   *
   * Only region heads are recorded, not every block in the body — one marker per inlined region
   * is a signpost, one per block is the grey wall this register keeps naming.
   *
   * ⚠️ **Ids are not unique across expansions.** A definition used twice splices its body twice,
   * ids and all (see `BlockValueBadgeLayer.paint`, which skips them for the same reason). Both
   * copies map to the same name, so the collision is harmless here — but it means this map cannot
   * be used to count regions.
   */
  origins: Map<string, string>;
}

interface Context {
  source: DefinitionSource;
  only: Set<string> | null;
  maxExpansions: number;
  maxDepth: number;
  expansions: number;
  stack: string[];
  variables: { name: string; id: string; type?: string }[];
  /** Body variable id → host variable id, per expansion pass. */
  variableRemap: Map<string, string>;
  /** VFN-014 — head block id → the name of the definition its region came from. */
  origins: Map<string, string>;
}

/**
 * Replace every call block in `workspace` with the body of the definition it names.
 *
 * The input is not modified. The result is a workspace the existing JavaScript generator can
 * consume with no knowledge that saved blocks exist.
 *
 * @throws MyBlocksCycleError when a definition is reached while it is already being expanded.
 * @throws MyBlocksMissingDefinitionError when a call points at a definition that is not there.
 * @throws MyBlocksShapeError when a call block's shape no longer matches its definition.
 * @throws MyBlocksBudgetError when the expansion exceeds the size or depth limit.
 */
export function expandWorkspace(
  workspace: BlocklyWorkspaceJson | undefined | null,
  source: DefinitionSource,
  options: ExpandOptions = {}
): ExpandResult {
  const result = cloneJson((workspace ?? {}) as BlocklyWorkspaceJson);

  const context: Context = {
    source,
    only: options.only ? new Set(options.only) : null,
    maxExpansions: options.maxExpansions ?? MAX_EXPANSIONS,
    maxDepth: options.maxDepth ?? MAX_DEPTH,
    expansions: 0,
    stack: [],
    variables: Array.isArray(result.variables) ? result.variables.slice() : [],
    variableRemap: new Map(),
    origins: new Map()
  };

  const roots = result.blocks?.blocks;
  if (Array.isArray(roots)) {
    const expanded: BlocklyBlockJson[] = [];
    for (const root of roots) {
      const replacement = expandBlock(root, context);
      if (replacement) expanded.push(replacement);
    }
    result.blocks.blocks = expanded;
  }

  if (context.variables.length > 0) {
    result.variables = context.variables;
  }

  return { workspace: result, expansions: context.expansions, origins: context.origins };
}

/**
 * §4's other half: rewrite a body so it no longer references `definitionId`, by inlining it.
 *
 * §4 says deleting a still-referenced definition must be refused *or* must offer to
 * inline-and-detach, and that a silent dangling reference is the worst outcome available.
 * This is the detach; `MyBlocksStore.remove(id, {force: true})` is the delete that follows it,
 * and `force` exists for no other caller.
 */
export function detachDefinition(
  workspace: BlocklyWorkspaceJson | undefined | null,
  definitionId: string,
  source: DefinitionSource
): BlocklyWorkspaceJson {
  return expandWorkspace(workspace, source, { only: [definitionId] }).workspace;
}

function expandBlock(block: BlocklyBlockJson | undefined, context: Context): BlocklyBlockJson | undefined {
  if (!block || typeof block !== 'object' || typeof block.type !== 'string') return undefined;

  remapVariableFields(block, context);

  // Children first, so an argument that is itself a call is already inlined by the time it is
  // spliced into a hole — and so a cycle reached through an argument is caught at the same
  // depth as one reached through the body.
  if (block.inputs) {
    for (const key of Object.keys(block.inputs)) {
      const input = block.inputs[key];
      if (!input) continue;
      if (input.block) {
        const replacement = expandBlock(input.block, context);
        if (replacement) input.block = replacement;
        else delete input.block;
      }
      if (input.shadow) expandBlock(input.shadow, context);
      if (!input.block && !input.shadow) delete block.inputs[key];
    }
  }

  if (block.next?.block) {
    const replacement = expandBlock(block.next.block, context);
    if (replacement) block.next.block = replacement;
    else delete block.next;
  }

  const definitionId = callDefinitionId(block);
  if (!definitionId) return block;
  if (context.only && !context.only.has(definitionId)) return block;

  return inlineCall(block, definitionId, context);
}

function inlineCall(call: BlocklyBlockJson, definitionId: string, context: Context): BlocklyBlockJson | undefined {
  if (context.stack.indexOf(definitionId) !== -1) {
    const cycle = context.stack.slice(context.stack.indexOf(definitionId)).concat(definitionId);
    const name = (id: string) => context.source.get(id)?.name ?? id;
    throw new MyBlocksCycleError(
      `Saved block "${name(definitionId)}" uses itself. The loop is ${cycle.map(name).join(' → ')}. ` +
        `No code was generated.`,
      cycle
    );
  }

  const definition = context.source.get(definitionId);
  if (!definition) {
    throw new MyBlocksMissingDefinitionError(
      `This program uses a saved block that is not in this project (${definitionId}).`,
      definitionId
    );
  }

  const wantsValue = call.type === 'myblocks_call_value';
  if (wantsValue !== (definition.shape === 'value')) {
    throw new MyBlocksShapeError(
      `"${definition.name}" is now a ${definition.shape} block, but it is used here as a ` +
        `${wantsValue ? 'value' : 'statement'}. Replace the block to pick up the new shape.`,
      definitionId
    );
  }

  if (context.stack.length + 1 > context.maxDepth) {
    throw new MyBlocksBudgetError(
      `Saved blocks are nested more than ${context.maxDepth} deep at "${definition.name}". ` +
        `No code was generated.`,
      context.maxDepth
    );
  }

  const body = cloneJson(definition.body);
  const bodyRoots = body.blocks?.blocks;

  context.expansions++;
  if (context.expansions > context.maxExpansions) {
    throw new MyBlocksBudgetError(
      `Expanding the saved blocks in this program would produce more than ${context.maxExpansions} ` +
        `blocks. No code was generated.`,
      context.maxExpansions
    );
  }

  spliceArguments(call, definition, body);
  mergeVariables(body, context);

  if (!Array.isArray(bodyRoots) || bodyRoots.length === 0) {
    // An empty definition is a no-op, not an error: a statement call vanishes and its stack
    // closes up; a value call leaves the socket empty, which the generator already defaults.
    return wantsValue ? undefined : call.next?.block;
  }

  context.stack.push(definitionId);
  const expandedRoots: BlocklyBlockJson[] = [];
  for (const root of bodyRoots) {
    const replacement = expandBlock(root, context);
    if (replacement) expandedRoots.push(replacement);
  }
  context.stack.pop();

  if (expandedRoots.length === 0) return wantsValue ? undefined : call.next?.block;

  if (wantsValue) {
    // A value definition has exactly one root by construction (`inferSignature` refuses to
    // call anything else a value block), so the first root *is* the expression.
    const expression = expandedRoots[0];
    delete expression.x;
    delete expression.y;
    if (expression.id) context.origins.set(expression.id, definition.name);
    return expression;
  }

  const head = chainRoots(expandedRoots);
  delete head.x;
  delete head.y;
  // VFN-014 — the head of the spliced stack is where the region's marker goes. Recorded after
  // `chainRoots`, because a definition with several top-level stacks has one head, not several.
  if (head.id) context.origins.set(head.id, definition.name);
  // Whatever was stacked after the call block goes after the inlined stack.
  const tail = tailOf(head);
  if (call.next?.block) tail.next = { block: call.next.block };
  return head;
}

/**
 * Move each argument on the call block into the hole the definition recorded for it.
 *
 * A hole path that no longer resolves is skipped rather than thrown on: the path was recorded
 * against the body as it was at save time, and a body edited since can legitimately no longer
 * have that socket. Losing an argument is a visible wrong answer; refusing to generate the
 * whole program because one socket moved is a worse one.
 */
function spliceArguments(call: BlocklyBlockJson, definition: MyBlockDefinition, body: BlocklyWorkspaceJson): void {
  definition.params.forEach((param, index) => {
    const argument = call.inputs?.[argInputName(index)]?.block;
    if (!argument) return;

    const hole = resolveHole(body, param.hole);
    if (!hole) return;

    if (!hole.parent.inputs) hole.parent.inputs = {};
    hole.parent.inputs[hole.input] = { block: cloneJson(argument) };
  });
}

/**
 * Merge the definition's variables into the host workspace, by name.
 *
 * Two expansions of the same definition therefore share one variable, which is the same thing
 * that happens when you paste the same stack twice, and is what a builder reading the inlined
 * result would expect. ⚠️ It is also a real limitation: a saved block that uses a local
 * variable as scratch space will interfere with itself if one expansion is nested inside
 * another. Written down rather than papered over — proper α-renaming per expansion is the fix
 * and it is not in this version.
 */
function mergeVariables(body: BlocklyWorkspaceJson, context: Context): void {
  if (!Array.isArray(body.variables)) return;

  for (const variable of body.variables) {
    if (!variable || typeof variable.name !== 'string') continue;

    const existing = context.variables.find((v) => v.name === variable.name);
    if (existing) {
      if (existing.id !== variable.id) context.variableRemap.set(variable.id, existing.id);
      continue;
    }

    const idTaken = context.variables.some((v) => v.id === variable.id);
    const id = idTaken ? `${variable.id}_${context.variables.length}` : variable.id;
    if (id !== variable.id) context.variableRemap.set(variable.id, id);
    context.variables.push({ name: variable.name, id, type: variable.type });
  }
}

/** Follow `variableRemap` for any `{VAR: {id}}` field Blockly wrote. */
function remapVariableFields(block: BlocklyBlockJson, context: Context): void {
  if (context.variableRemap.size === 0 || !block.fields) return;

  for (const key of Object.keys(block.fields)) {
    const field = block.fields[key];
    if (!field || typeof field !== 'object') continue;
    const id = (field as Record<string, unknown>).id;
    if (typeof id === 'string' && context.variableRemap.has(id)) {
      (field as Record<string, unknown>).id = context.variableRemap.get(id);
    }
  }
}

/** Concatenate several top-level stacks into one, in the order they were saved. */
function chainRoots(roots: BlocklyBlockJson[]): BlocklyBlockJson {
  const head = roots[0];
  let tail = tailOf(head);
  for (let i = 1; i < roots.length; i++) {
    const root = roots[i];
    delete root.x;
    delete root.y;
    tail.next = { block: root };
    tail = tailOf(root);
  }
  return head;
}

function tailOf(block: BlocklyBlockJson): BlocklyBlockJson {
  let current = block;
  while (current.next?.block) current = current.next.block;
  return current;
}
