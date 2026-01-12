/**
 * IODetector
 *
 * Utility for detecting inputs, outputs, and signals from Blockly workspaces.
 * Scans workspace JSON to find Input/Output definition blocks and extracts their configuration.
 *
 * @module utils
 */

export interface DetectedInput {
  name: string;
  type: string;
}

export interface DetectedOutput {
  name: string;
  type: string;
}

export interface DetectedIO {
  inputs: DetectedInput[];
  outputs: DetectedOutput[];
  signalInputs: string[];
  signalOutputs: string[];
}

interface BlocklyBlock {
  type?: string;
  fields?: Record<string, string>;
  inputs?: Record<string, { block?: BlocklyBlock }>;
  next?: { block?: BlocklyBlock };
}

/**
 * Detect all I/O from a Blockly workspace JSON
 *
 * @param workspaceJson - Serialized Blockly workspace (JSON string or object)
 * @returns Detected inputs, outputs, and signals
 */
export function detectIO(workspaceJson: string | object): DetectedIO {
  const result: DetectedIO = {
    inputs: [],
    outputs: [],
    signalInputs: [],
    signalOutputs: []
  };

  try {
    const workspace = typeof workspaceJson === 'string' ? JSON.parse(workspaceJson) : workspaceJson;

    if (!workspace || !workspace.blocks || !workspace.blocks.blocks) {
      return result;
    }

    const blocks = workspace.blocks.blocks;

    for (const block of blocks) {
      processBlock(block, result);
    }
  } catch (error) {
    console.error('[IODetector] Failed to parse workspace:', error);
  }

  // Remove duplicates
  result.inputs = uniqueBy(result.inputs, 'name');
  result.outputs = uniqueBy(result.outputs, 'name');
  result.signalInputs = Array.from(new Set(result.signalInputs));
  result.signalOutputs = Array.from(new Set(result.signalOutputs));

  return result;
}

/**
 * Recursively process a block and its children
 */
function processBlock(block: BlocklyBlock, result: DetectedIO): void {
  if (!block || !block.type) return;

  switch (block.type) {
    case 'noodl_define_input':
      // Extract input definition
      if (block.fields && block.fields.NAME && block.fields.TYPE) {
        result.inputs.push({
          name: block.fields.NAME,
          type: block.fields.TYPE
        });
      }
      break;

    case 'noodl_get_input':
      // Auto-detect input from usage
      if (block.fields && block.fields.NAME) {
        const name = block.fields.NAME;
        if (!result.inputs.find((i) => i.name === name)) {
          result.inputs.push({
            name: name,
            type: '*' // Default type
          });
        }
      }
      break;

    case 'noodl_define_output':
      // Extract output definition
      if (block.fields && block.fields.NAME && block.fields.TYPE) {
        result.outputs.push({
          name: block.fields.NAME,
          type: block.fields.TYPE
        });
      }
      break;

    case 'noodl_set_output':
      // Auto-detect output from usage
      if (block.fields && block.fields.NAME) {
        const name = block.fields.NAME;
        if (!result.outputs.find((o) => o.name === name)) {
          result.outputs.push({
            name: name,
            type: '*' // Default type
          });
        }
      }
      break;

    case 'noodl_define_signal_input':
      // Extract signal input definition
      if (block.fields && block.fields.NAME) {
        result.signalInputs.push(block.fields.NAME);
      }
      break;

    case 'noodl_on_signal':
      // Auto-detect signal input from event handler
      if (block.fields && block.fields.SIGNAL) {
        const name = block.fields.SIGNAL;
        if (!result.signalInputs.includes(name)) {
          result.signalInputs.push(name);
        }
      }
      break;

    case 'noodl_define_signal_output':
      // Extract signal output definition
      if (block.fields && block.fields.NAME) {
        result.signalOutputs.push(block.fields.NAME);
      }
      break;

    case 'noodl_send_signal':
      // Auto-detect signal output from send blocks
      if (block.fields && block.fields.NAME) {
        const name = block.fields.NAME;
        if (!result.signalOutputs.includes(name)) {
          result.signalOutputs.push(name);
        }
      }
      break;
  }

  // Process nested blocks (inputs, next, etc.)
  if (block.inputs) {
    for (const inputKey in block.inputs) {
      const input = block.inputs[inputKey];
      if (input && input.block) {
        processBlock(input.block, result);
      }
    }
  }

  if (block.next && block.next.block) {
    processBlock(block.next.block, result);
  }
}

/**
 * Remove duplicates from array based on key
 */
function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const k = item[key];
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
}
