/**
 * What the save dialog *says* (LGC-007 §1).
 *
 * §1 asks for a dialog with "a name, the inferred shape and its plain-English reason". The
 * inference itself is `shape.ts` and is not reimplemented here; this module turns an
 * `InferredSignature` into sentences, and holds the one rule the name field has. Both are
 * decisions, both are worth grading, and neither needs Blockly — so they sit on this side of
 * the line the directory header draws, and the React component that shows them holds none of
 * them.
 *
 * ## Why the copy is a module and not a JSX literal
 *
 * The plain-English half is the feature. §1's whole argument is that Blockly's grammar already
 * teaches value-versus-statement and we are not to invent a visual language for it — which
 * leaves the *words* as the only thing doing the teaching. Words in a component are words no
 * spec can reach, and this repo has an entry about a mockup not being a measurement.
 *
 * ## Why a duplicate name is a warning and not a refusal
 *
 * The format's first design property is that identity is a uid and a name is display only, so
 * that two independently-authored libraries can be merged and "a name collision is cosmetic".
 * A save dialog that refused a duplicate name would contradict the format it is saving into,
 * and would do it at the one moment the builder is least able to see why. So it is said out
 * loud and allowed.
 *
 * @module BlocklyEditor/myblocks
 */

import type { BlocklyWorkspaceJson } from './format';
import { walkWorkspace } from './references';
import type { InferredSignature } from './shape';

/**
 * Long enough for a phrase, short enough to read on a block.
 *
 * The name is drawn *inside* the call block, so an unbounded one is not a database problem, it
 * is a block wider than the workspace.
 */
export const MAX_BLOCK_NAME_LENGTH = 40;

export interface SaveNameVerdict {
  /** May the save proceed? */
  ok: boolean;
  /** What to show under the field. Present on a refusal, and on an allowed-but-notable name. */
  message?: string;
  /** `true` when `ok` is also true: the name is usable and something is worth saying anyway. */
  isWarning?: boolean;
}

/**
 * Judge a proposed name.
 *
 * @param raw what is in the field, untrimmed — the caller must not pre-trim, because "  " and
 *   "" are the same refusal and the field should not have to know that.
 * @param taken every definition already on either shelf.
 * @param selfId when re-saving an existing definition, its own id — so a definition does not
 *   collide with itself.
 */
export function checkBlockName(
  raw: string,
  taken: readonly { id: string; name: string }[] = [],
  selfId?: string
): SaveNameVerdict {
  const name = (raw || '').trim();

  if (name.length === 0) {
    return { ok: false, message: 'Give it a name, so you can find it in the toolbox later.' };
  }

  if (name.length > MAX_BLOCK_NAME_LENGTH) {
    return {
      ok: false,
      message: `That is ${name.length} characters. Keep it under ${MAX_BLOCK_NAME_LENGTH} so it fits on the block.`
    };
  }

  const clash = taken.find((d) => d.id !== selfId && d.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) {
    return {
      ok: true,
      isWarning: true,
      message: `You already have a saved block called "${clash.name}". Both will be in the toolbox, looking the same.`
    };
  }

  return { ok: true };
}

/** The name that will actually be stored — the field's value, trimmed. */
export function normaliseBlockName(raw: string): string {
  return (raw || '').trim();
}

/**
 * How many blocks are going into the definition.
 *
 * Shown because the gesture takes more than the block that was clicked: everything inside it
 * and everything stacked below it comes too, and a builder who right-clicked the middle of a
 * stack has no other way to find that out before committing. Shadows are not counted — a
 * shadow is a default value the builder can see in the socket, not a block they placed.
 */
export function countSavedBlocks(body: BlocklyWorkspaceJson | undefined | null): number {
  let count = 0;
  walkWorkspace(body, ({ shadow }) => {
    if (!shadow) count++;
  });
  return count;
}

export interface ShapeDescription {
  /** The shape, as a noun phrase: "a value block". */
  shapeName: string;
  /** What the builder will be able to do with it, and what they will not. */
  consequence: string;
  /** Why it got that shape, in the builder's words rather than the grammar's. */
  reason: string;
  /** The sockets it will have. */
  inputs: string;
}

/**
 * Describe an inferred signature in sentences.
 *
 * The `consequence` sentence is the one §1 is really asking for. "Value block" is the toolkit's
 * word and means nothing to a builder who has not met it; "you can drop it into a calculation"
 * is the same fact stated as something they can try. Both are given, in that order, because the
 * word is what they will hear from anyone else.
 */
export function describeShape(signature: InferredSignature): ShapeDescription {
  const isValue = signature.shape === 'value';

  return {
    shapeName: isValue ? 'a value block' : 'a stacking block',
    consequence: isValue
      ? 'You can drop it into a calculation, anywhere a number or a piece of text would go.'
      : 'It stacks with your other blocks, and cannot be dropped inside a calculation.',
    reason: `Because ${joinPhrases(signature.reasons)}.`,
    inputs: describeParams(signature.params.map((p) => p.name))
  };
}

function describeParams(names: string[]): string {
  if (names.length === 0) return 'It has no sockets to fill in.';
  if (names.length === 1) return `It will have one socket: ${names[0]}.`;
  return `It will have ${names.length} sockets: ${joinPhrases(names)}.`;
}

/** `a`, `a and b`, `a, b and c`. Oxford comma deliberately absent; the editor is en-GB. */
export function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length === 0) return 'of what is in it';
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}
