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
