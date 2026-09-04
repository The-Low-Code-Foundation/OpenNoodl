/**
 * Logic Builder port detection.
 *
 * Reads a serialised Blockly workspace and reports the ports the block program
 * declares or uses. This is the single source of truth for Logic Builder's port
 * set: the editor calls it to publish dynamic ports, and the runtime node calls
 * it to decide whether a port a connection asks for is a value or a signal.
 *
 * It lives in `@noodl/runtime` rather than the editor for one reason, and it is
 * the reason the previous implementation was unreachable: dynamic ports are
 * announced from the *viewer* window, which cannot see anything the editor
 * window put on `window`. Only code that ships inside the runtime bundle can be
 * called from both sides. Nothing here imports Blockly — the workspace is plain
 * JSON, so parsing it needs no library.
 *
 * @see LEARNINGS-BLOCKLY.md §1 (editor/runtime window separation)
 */

/**
 * LGC-009 — the hat block's type id, and the reason it is declared *here* rather than in the
 * editor beside the block it names.
 *
 * The block is drawn by `NoodlBlocks.ts`, which lives in the editor window. `detectIO` runs in
 * the *viewer* window, which cannot see anything the editor put on `window` — the whole reason
 * this file exists at all. So the one string both halves have to agree on lives on the side
 * that cannot import the other, and the editor imports it from here.
 *
 * ⚠️ It is serialised into `project.json` the moment anyone saves a program, so it is frozen in
 * the same sense `name: 'Logic Builder'` is frozen.
 */
export const HAT_BLOCK_TYPE = 'noodl_when_signal';

/**
 * VFN-008 — the two My Blocks call block types, declared here for exactly HAT_BLOCK_TYPE's reason.
 *
 * The blocks are drawn by `MyBlocksBlocks.ts`, in the editor window. `detectIO` runs in the
 * *viewer* window and has to recognise them, so the strings both halves agree on live on the side
 * that cannot import the other, and `myblocks/references.ts` re-exports them from here.
 *
 * ⚠️ Serialised into `project.json` the moment anyone places a saved block, so frozen in the same
 * sense `HAT_BLOCK_TYPE` is frozen.
 */
export const MY_BLOCKS_CALL_VALUE = 'myblocks_call_value';
export const MY_BLOCKS_CALL_STATEMENT = 'myblocks_call_statement';
export const MY_BLOCKS_CALL_TYPES: readonly string[] = [MY_BLOCKS_CALL_VALUE, MY_BLOCKS_CALL_STATEMENT];

/**
 * The `extraState` key on a call block that carries the ports its definition's body contributes.
 *
 * 🔴 **This is what makes a call block audible to port detection, and the reason it is a key on
 * the block rather than a lookup into the shelves is the whole design of VFN-008's fix.** See
 * `callPortMentions` below.
 */
export const CALL_PORTS_STATE_KEY = 'ports';

/**
 * The signal a hat names when nothing else says otherwise: the node's own built-in `run` port.
 *
 * Lower case, and that is load-bearing twice over. `RESERVED_INPUTS` in `logic-builder.ts`
 * holds `'run'`, so a hat carrying this name publishes **no new port** — it names the port the
 * node already has. And `_executeLogic('run', …)` passes exactly this string as
 * `__triggerSignal__`, so the day a hat gates its body on the trigger (see NOTES-LGC-009) the
 * default hat is the one that matches. `'Run'` would fail both: it is not reserved, so it would
 * mint a second run-ish input port, and it would never equal the trigger string.
 */
export const DEFAULT_HAT_SIGNAL = 'run';

/**
 * Port names the Logic Builder node itself owns, and which a block program therefore cannot mint.
 *
 * ⚠️ **Moved here from `logic-builder.ts` by LGC-009, and the move is the point.** These are facts
 * about the *port set*, and the port set is what this file is for. `updatePorts` filters every
 * published port through them, so anything that has to answer *"would this name reach the
 * canvas?"* — the hat migration's "this publishes no new port" guarantee, and the spec that grades
 * it — reads the same list rather than repeating it. A second copy of a reserved-name list is
 * LGC-004's L11 with a different noun.
 *
 * @see logic-builder.ts, where the collisions these prevent are written up at length.
 */
export const RESERVED_INPUTS = ['workspace', 'generatedCode', 'run'];
export const RESERVED_OUTPUTS = ['error', 'success', 'failure', 'done', 'unchanged', 'completed'];

/**
 * The signal output name a freshly dragged block carries, for both `⚡ Define signal output` and
 * `⚡ send signal`.
 *
 * 🔴 **It exists because the previous default was `'done'`, which is on `RESERVED_OUTPUTS` two
 * lines up.** Dragging the block and pressing Run — accepting the default, the one thing every
 * first-time author does — raised `logic-builder/reserved-port-name` and put the node in its error
 * style. A default that cannot be used is worse than no default: it teaches the author that the
 * block is broken rather than that the name is theirs to choose.
 *
 * ⚠️ **The two blocks share this on purpose.** The define and the send are a pair, so a program
 * assembled entirely from defaults must actually run; two different placeholders would send to a
 * port nothing declared. `reserved-default-names.spec.ts` holds both halves — that this value is
 * absent from `RESERVED_OUTPUTS`, and that every block default in the editor's palette is.
 */
export const DEFAULT_SIGNAL_OUTPUT = 'Output1';

export interface DetectedPort {
  name: string;
  /** A Noodl port type name, or `'*'` when the blocks do not declare one. */
  type: string;
}

export interface DetectedIO {
  inputs: DetectedPort[];
  outputs: DetectedPort[];
  signalInputs: string[];
  signalOutputs: string[];
}

/** A value port carries data; a signal port carries a pulse and has no type. */
export type DetectedPortKind = 'value' | 'signal';

/**
 * One row of a Visual Function's signature (LGC-004).
 *
 * The same port set `detectIO` reports, with the two facts a *display* of the signature needs
 * and the four-list shape cannot carry: which side of the node it is on, and whether a block
 * states it or merely uses it.
 */
export interface InterfacePort {
  name: string;
  kind: DetectedPortKind;
  /**
   * For a value port: exactly what `typeOfPort` returns for it, `'*'` included — so anything
   * displaying this shows the type the node **actually registers**, not a better guess.
   * For a signal port: always `'signal'`.
   */
  type: string;
  /**
   * `true` when some `Define …` block in the workspace states this port; `false` when it exists
   * only because a `get input` / `set output` / `send signal` uses it.
   *
   * ⚠️ **This is a display fact, not a validity one.** An undeclared port is a working port —
   * `detectIO` counting uses is the property that lets a program run before anyone declares its
   * interface, and it is deliberate (LGC-004 §3, register L12). Nothing may read this flag to
   * decide whether a port exists.
   *
   * ⚠️ It is also independent of `type`. A workspace whose bare `get input count` is serialised
   * *above* its `Define input count type number` reports `declared: true` with `type: '*'`,
   * because `detectIO` resolves a type clash in document order and this field does not
   * second-guess it. That combination is honest: the node's port really is `'*'` in that
   * workspace. See the LGC-004 register.
   */
  declared: boolean;
}

/** Every port a Visual Function offers, split by the side of the node it appears on. */
export interface DetectedInterface {
  inputs: InterfacePort[];
  outputs: InterfacePort[];
}

/** The shape of one entry in Blockly's `workspaces.save()` output. */
interface BlocklyBlock {
  type?: string;
  fields?: Record<string, string>;
  /** Blockly's bag for a block whose shape is built at load time. A call block's whole identity. */
  extraState?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocklyBlock; shadow?: BlocklyBlock }>;
  next?: { block?: BlocklyBlock };
}

/**
 * One block's mention of one port, in the order the workspace serialises.
 *
 * 🔴 **This is the single traversal, and both public readers are projections of it.** `detectIO`
 * (what the node registers) and `detectInterface` (what a display of the signature shows) must
 * never disagree about which blocks mean which ports, and the only way to guarantee that is for
 * there to be one place that knows — LGC-004 register L11, which is about one fact having two
 * sources. Adding a block type here reaches both readers at once; adding it to one of them would
 * be exactly the defect.
 */
interface PortMention {
  name: string;
  plug: 'input' | 'output';
  kind: DetectedPortKind;
  /** The type this mention states, or `null` when it merely uses the port. */
  declaredType: string | null;
}

/**
 * Detect every port a Blockly workspace implies.
 *
 * Both the explicit `Define input`/`Define output` blocks and the implicit uses
 * (`get input`, `set output`, `send signal`) count, so a program works whether
 * or not its author bothered to declare its interface up front. A declaration
 * wins on type because it is the only place a type is stated.
 *
 * Never throws: unparseable or absent input yields an empty result, because the
 * caller is a port-registration path where throwing would take out the node.
 */
export function detectIO(workspaceJson: string | object | undefined | null): DetectedIO {
  const mentions = collectMentions(workspaceJson);

  return {
    inputs: valuePorts(mentions, 'input'),
    outputs: valuePorts(mentions, 'output'),
    signalInputs: signalNames(mentions, 'input'),
    signalOutputs: signalNames(mentions, 'output')
  };
}

/**
 * The same ports `detectIO` reports, as one row per port with its side, its kind and whether a
 * block declares it — the shape a *display* of the signature needs (LGC-004 §1).
 *
 * 🔴 **Not a second detector.** It is a second projection of the one traversal `detectIO` also
 * projects, so a name that appears here appears there and carries the same type. Anything
 * rendering a signature must read this rather than parse the workspace again: a rail with its own
 * idea of the port set is register L11's defect with a different noun.
 *
 * Rows are in **document order of first mention**, values and signals interleaved, because that
 * is the one order derivable from the workspace without an editorial decision — and because it is
 * the order the blocks are actually in, which is where the author will look for them.
 *
 * Never throws, for `detectIO`'s reason.
 */
export function detectInterface(workspaceJson: string | object | undefined | null): DetectedInterface {
  const mentions = collectMentions(workspaceJson);

  return {
    inputs: interfacePorts(mentions, 'input'),
    outputs: interfacePorts(mentions, 'output')
  };
}

/**
 * Walk the workspace once and report every mention, in serialised order.
 *
 * Never throws: unparseable or absent input yields no mentions, because the callers are
 * port-registration and rendering paths where throwing would take out the node.
 */
function collectMentions(workspaceJson: string | object | undefined | null): PortMention[] {
  const mentions: PortMention[] = [];

  if (!workspaceJson) {
    return mentions;
  }

  let workspace: { blocks?: { blocks?: BlocklyBlock[] } };
  try {
    workspace = typeof workspaceJson === 'string' ? JSON.parse(workspaceJson) : (workspaceJson as typeof workspace);
  } catch {
    // An unreadable workspace means "no ports", not a crash — a half-written
    // parameter must not stop the node from being created.
    return mentions;
  }

  const blocks = workspace && workspace.blocks && workspace.blocks.blocks;
  if (!Array.isArray(blocks)) {
    return mentions;
  }

  for (const block of blocks) {
    processBlock(block, mentions);
  }

  return mentions;
}

/** The value ports on one side, first mention winning the type — `detectIO`'s own rule. */
function valuePorts(mentions: PortMention[], plug: 'input' | 'output'): DetectedPort[] {
  const ports: DetectedPort[] = [];
  const seen = new Set<string>();

  for (const mention of mentions) {
    if (mention.plug !== plug || mention.kind !== 'value' || seen.has(mention.name)) continue;
    seen.add(mention.name);
    ports.push({ name: mention.name, type: mention.declaredType || '*' });
  }

  return ports;
}

/** The signal port names on one side, in first-mention order. */
function signalNames(mentions: PortMention[], plug: 'input' | 'output'): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const mention of mentions) {
    if (mention.plug !== plug || mention.kind !== 'signal' || seen.has(mention.name)) continue;
    seen.add(mention.name);
    names.push(mention.name);
  }

  return names;
}

/**
 * One row per port on one side — **one row per port the node will have**, which is why it is
 * keyed by name alone.
 *
 * The type comes from the same first-mention rule `detectIO` uses, so the row states the type the
 * node registers. `declared` is an OR over **every** mention of the name, not just the first,
 * because "some block states this port" is true wherever that block sits in the file.
 *
 * ⚠️ A name used as both a value and a signal reads as a **signal**, because that is what the node
 * does: `registerInputIfNeeded` and `registerOutputIfNeeded` both consult `signalInputs` /
 * `signalOutputs` before falling through to a value port, so the node has one port of that name
 * and it is the signal. A row that showed the value here would describe a port that is not there.
 */
function interfacePorts(mentions: PortMention[], plug: 'input' | 'output'): InterfacePort[] {
  const ports: InterfacePort[] = [];
  const byName = new Map<string, InterfacePort>();

  for (const mention of mentions) {
    if (mention.plug !== plug) continue;

    const existing = byName.get(mention.name);
    if (existing) {
      existing.declared = existing.declared || mention.declaredType !== null;
      if (mention.kind === 'signal' && existing.kind === 'value') {
        existing.kind = 'signal';
        existing.type = 'signal';
      }
      continue;
    }

    const port: InterfacePort = {
      name: mention.name,
      kind: mention.kind,
      type: mention.kind === 'signal' ? 'signal' : mention.declaredType || '*',
      declared: mention.declaredType !== null
    };
    byName.set(mention.name, port);
    ports.push(port);
  }

  return ports;
}

/**
 * Look up the declared type of one detected value port.
 * Returns `'*'` for a port the workspace does not mention.
 */
export function typeOfPort(io: DetectedIO, plug: 'input' | 'output', name: string): string {
  const list = plug === 'input' ? io.inputs : io.outputs;
  const port = list.find((p) => p.name === name);
  return port ? port.type : '*';
}

/**
 * VFN-008 — the ports a placed saved block contributes to its host, read off the call block.
 *
 * ## The defect
 *
 * A saved block's body is *inlined* into the host program at generate time
 * (`generateWithMyBlocks` → `expandWorkspace`), so a definition containing `set output "total"`
 * makes the host node's program write `Outputs["total"]`. But **the expansion happens to a
 * different copy of the workspace**: `updatePorts` calls `detectIO` on the raw serialised
 * workspace — the string persisted as the node's `workspace` parameter — while the expanded copy
 * is discarded the moment the JavaScript is generated. This traversal had never heard of a call
 * block, so a call block contributed no mentions, and the program wrote an output that had no
 * port for anyone to wire. The program was right and the node was deaf.
 *
 * ## Why the call block states its ports, rather than this file resolving the definition
 *
 * 🔴 **The rejected route was to plumb the definition shelves through to port detection**, and it
 * is worth writing down why, because it is the obvious one.
 *
 * 1. **The backpack shelf does not exist in the viewer, and never will.** A definition lives on
 *    one of two shelves: the project's (`project.json` settings, which *does* reach the viewer
 *    through `GraphModel.setSettings`) or the builder's backpack (`EditorSettings`, machine-local
 *    by design — that is what "follows the builder between projects" means). Resolving
 *    definitions here would therefore publish ports for a project-scoped block and **not** for a
 *    backpack-scoped one, making a node's public interface depend on which machine has the editor
 *    open, and on which shelf a colleague happened to pick. The live artefact that produced this
 *    finding (VFN-014, `vfn64-qa`) uses a **backpack** definition, so the rejected route would not
 *    have fixed the case that was reported.
 * 2. **It would import the inliner's entire failure surface into a port-registration path.**
 *    Resolving definitions means cycles, missing definitions, shape mismatches and expansion
 *    budgets — every one of which `expandWorkspace` signals by *throwing*. `detectIO`'s contract
 *    is that it never throws, because its caller is where the node gets created. The alternative,
 *    a second weaker traversal that resolves definitions without the guards, is register L11 with
 *    a different noun.
 * 3. **`detectIO` would stop being a function of the workspace.** The workspace being the single
 *    source of truth for the port set is the property the whole file exists to hold. Reading a
 *    second store here is exactly what the other rejected route (expanding before the workspace
 *    parameter is written) was rejected for, arrived at from the opposite direction.
 *
 * ## What this is instead
 *
 * A call block is a **call site**, and a call site states the signature it was bound against —
 * the same relationship a header file has to a definition. `extraState` already carries the
 * definition's `label` and its argument names for precisely this reason (`MyBlocksBlocks.ts`: *"it
 * makes a saved body self-describing, so a definition that calls another definition can be
 * analysed with no store present"*), and `MyBlockDefinition` already caches `shape`, `params` and
 * `requires` derived from `body` under the rule *recomputed on every write, never trusted by a
 * guard*. This is one more field under both rules, and no new mechanism.
 *
 * The rows are whatever `detectInterface` returned for the definition's own body, so **this is not
 * a second detector**: it is the one traversal, run over the body, and cached at the call site.
 * A definition that calls another definition therefore carries the nested ports transitively, with
 * no expansion and no way to recurse forever.
 *
 * ⚠️ **The cost, stated plainly.** The rows are a cache and can go stale — a definition that grows
 * an output after a call block was placed leaves that call block understating its ports until it
 * is reloaded with the shelf present (`loadExtraState` re-derives) and the workspace is flushed
 * again. That is the same staleness `label` and `args` have always had, refreshed by the same
 * event; before this change the understatement was total and permanent. LGC-007 §4's regeneration
 * sweep is where it is properly repaired.
 *
 * Never throws, and validates every field: these rows come off disk and may have been written by
 * an older version, edited by hand, or truncated.
 */
function callPortMentions(block: BlocklyBlock, mentions: PortMention[]): void {
  const state = block.extraState;
  if (!state || typeof state !== 'object') return;

  const ports = state[CALL_PORTS_STATE_KEY] as { inputs?: unknown; outputs?: unknown } | undefined;
  if (!ports || typeof ports !== 'object') return;

  pushDeclaredRows(ports.inputs, 'input', mentions);
  pushDeclaredRows(ports.outputs, 'output', mentions);
}

/** One side of a call block's stated interface, turned back into mentions. */
function pushDeclaredRows(rows: unknown, plug: 'input' | 'output', mentions: PortMention[]): void {
  if (!Array.isArray(rows)) return;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const port = row as Partial<InterfacePort>;
    if (typeof port.name !== 'string' || port.name === '') continue;

    const kind: DetectedPortKind = port.kind === 'signal' ? 'signal' : 'value';
    // `declared` is the row's own word for "some block inside the body states this port", and it
    // is the only thing that decides whether the type is a statement or a guess — exactly as it
    // does for a mention made by a block in this workspace.
    const declaredType = !port.declared
      ? null
      : kind === 'signal'
        ? 'signal'
        : typeof port.type === 'string' && port.type !== ''
          ? port.type
          : '*';

    mentions.push({ name: port.name, plug, kind, declaredType });
  }
}

function processBlock(block: BlocklyBlock | undefined, mentions: PortMention[]): void {
  if (!block || !block.type) return;

  const fields = block.fields || {};
  const name = fields.NAME;

  if (name) {
    switch (block.type) {
      case 'noodl_define_input':
        mentions.push({ name, plug: 'input', kind: 'value', declaredType: fields.TYPE || '*' });
        break;

      case 'noodl_get_input':
        mentions.push({ name, plug: 'input', kind: 'value', declaredType: null });
        break;

      case 'noodl_define_output':
        mentions.push({ name, plug: 'output', kind: 'value', declaredType: fields.TYPE || '*' });
        break;

      case 'noodl_set_output':
        mentions.push({ name, plug: 'output', kind: 'value', declaredType: null });
        break;

      case 'noodl_define_signal_input':
        mentions.push({ name, plug: 'input', kind: 'signal', declaredType: 'signal' });
        break;

      /**
       * LGC-009 — the hat, and the answer to *"a hat is a second declaration of a port"*.
       *
       * 🔴 **The hat is a mention, not a second store.** It pushes a mention identical in every
       * field to the one `noodl_define_signal_input` pushes above, and both projections then
       * key on the name: `signalNames` on a `Set`, `interfacePorts` on a `Map`. So a hat and a
       * `Define signal input` naming the same signal are one port, and they are one port
       * whichever of them the workspace serialises first.
       *
       * ⚠️ **That order-independence is the whole reason this shape was chosen**, and it is why
       * this is not L39 again. L39 (LGC-004's register) records that a *type* clash on a value
       * port resolves by document order, because `valuePorts` takes the first mention's type and
       * an author cannot see which mention is first. A signal port has no type, so the only
       * fact two declarations of it could disagree about does not exist — there is nothing to
       * tie-break, and therefore no invisible tie-break to get wrong. A precedence rule ("the
       * hat wins", "the declaration wins") would have manufactured one.
       */
      case HAT_BLOCK_TYPE:
        mentions.push({ name, plug: 'input', kind: 'signal', declaredType: 'signal' });
        break;

      case 'noodl_define_signal_output':
        mentions.push({ name, plug: 'output', kind: 'signal', declaredType: 'signal' });
        break;

      case 'noodl_send_signal':
        mentions.push({ name, plug: 'output', kind: 'signal', declaredType: null });
        break;
    }
  }

  // VFN-008. Outside the `if (name)` above, deliberately: a call block has no `NAME` field. Its
  // ports are a list on its `extraState`, not one name in a field.
  if (MY_BLOCKS_CALL_TYPES.indexOf(block.type) !== -1) {
    callPortMentions(block, mentions);
  }

  // Value inputs, statement inputs (`if`/loop bodies) and shadow blocks all
  // live under `inputs`; the rest of a stack hangs off `next`.
  if (block.inputs) {
    for (const key of Object.keys(block.inputs)) {
      const input = block.inputs[key];
      if (!input) continue;
      processBlock(input.block, mentions);
      processBlock(input.shadow, mentions);
    }
  }

  if (block.next) {
    processBlock(block.next.block, mentions);
  }
}
