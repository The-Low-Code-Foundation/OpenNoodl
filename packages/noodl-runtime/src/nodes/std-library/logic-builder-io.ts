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

/** The shape of one entry in Blockly's `workspaces.save()` output. */
interface BlocklyBlock {
  type?: string;
  fields?: Record<string, string>;
  inputs?: Record<string, { block?: BlocklyBlock; shadow?: BlocklyBlock }>;
  next?: { block?: BlocklyBlock };
}

function emptyIO(): DetectedIO {
  return { inputs: [], outputs: [], signalInputs: [], signalOutputs: [] };
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
  const result = emptyIO();

  if (!workspaceJson) {
    return result;
  }

  let workspace: { blocks?: { blocks?: BlocklyBlock[] } };
  try {
    workspace = typeof workspaceJson === 'string' ? JSON.parse(workspaceJson) : (workspaceJson as typeof workspace);
  } catch {
    // An unreadable workspace means "no ports", not a crash — a half-written
    // parameter must not stop the node from being created.
    return result;
  }

  const blocks = workspace && workspace.blocks && workspace.blocks.blocks;
  if (!Array.isArray(blocks)) {
    return result;
  }

  for (const block of blocks) {
    processBlock(block, result);
  }

  result.inputs = uniqueByName(result.inputs);
  result.outputs = uniqueByName(result.outputs);
  result.signalInputs = Array.from(new Set(result.signalInputs));
  result.signalOutputs = Array.from(new Set(result.signalOutputs));

  return result;
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

function processBlock(block: BlocklyBlock | undefined, result: DetectedIO): void {
  if (!block || !block.type) return;

  const fields = block.fields || {};

  switch (block.type) {
    case 'noodl_define_input':
      if (fields.NAME) {
        result.inputs.push({ name: fields.NAME, type: fields.TYPE || '*' });
      }
      break;

    case 'noodl_get_input':
      if (fields.NAME) {
        result.inputs.push({ name: fields.NAME, type: '*' });
      }
      break;

    case 'noodl_define_output':
      if (fields.NAME) {
        result.outputs.push({ name: fields.NAME, type: fields.TYPE || '*' });
      }
      break;

    case 'noodl_set_output':
      if (fields.NAME) {
        result.outputs.push({ name: fields.NAME, type: '*' });
      }
      break;

    case 'noodl_define_signal_input':
      if (fields.NAME) {
        result.signalInputs.push(fields.NAME);
      }
      break;

    case 'noodl_define_signal_output':
      if (fields.NAME) {
        result.signalOutputs.push(fields.NAME);
      }
      break;

    case 'noodl_send_signal':
      if (fields.NAME) {
        result.signalOutputs.push(fields.NAME);
      }
      break;
  }

  // Value inputs, statement inputs (`if`/loop bodies) and shadow blocks all
  // live under `inputs`; the rest of a stack hangs off `next`.
  if (block.inputs) {
    for (const key of Object.keys(block.inputs)) {
      const input = block.inputs[key];
      if (!input) continue;
      processBlock(input.block, result);
      processBlock(input.shadow, result);
    }
  }

  if (block.next) {
    processBlock(block.next.block, result);
  }
}

/**
 * First occurrence wins, so an explicit `Define …` block placed above a use
 * keeps its declared type instead of being flattened to `'*'`.
 */
function uniqueByName(ports: DetectedPort[]): DetectedPort[] {
  const seen = new Set<string>();
  return ports.filter((port) => {
    if (seen.has(port.name)) return false;
    seen.add(port.name);
    return true;
  });
}
