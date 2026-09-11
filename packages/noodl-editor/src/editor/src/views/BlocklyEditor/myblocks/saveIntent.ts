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

import type { BlocklyWorkspaceJson, MyBlockParam, MyBlockShape } from './format';
import { collectVariableReferences, walkWorkspace } from './references';
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
 * The description that will actually be stored, or `undefined` when there is none.
 *
 * 🔴 `undefined` and never `''`. `MyBlockDefinition.description` is optional, and every
 * definition ever written before VFN-008 has it absent — so "no description" has to be *one*
 * value, not two. An empty string would make `definition.description !== undefined` true for a
 * field the builder left blank, and every reader downstream would then have to know that `''`
 * means the same thing as absent. This module has already paid for that distinction once, in
 * the generate seam, where a refusal published its silence as `''`.
 *
 * The field is optional on purpose: a required description on a save dialog is a field that
 * gets filled with `x`.
 */
export function normaliseBlockDescription(raw: string | undefined | null): string | undefined {
  const description = (raw || '').trim();
  return description.length > 0 ? description : undefined;
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

/**
 * The **ids** of those same blocks, in the same document order — what the outline draws.
 *
 * VFN-006. `Blockly.serialization.blocks.save` writes each block's live workspace id, and
 * `bodyFromBlocks` does not strip them, so the body the save is about to store carries the
 * identity of every block still on the workspace behind the dialog. That is what makes "these 5
 * blocks" pointable: the outline and the count are the same walk of the same body, so they
 * cannot disagree about which blocks are coming.
 *
 * ⚠️ It is the *same* filter as `countSavedBlocks` — shadows excluded — and the two are asserted
 * equal in `tests-unit/vfn-006`. They can differ only for a body whose blocks carry no `id`,
 * which is a hand-written fixture and never something Blockly produced; in that case the count
 * is still right and the outline is short, which is the safe direction to be wrong in.
 */
export function previewBlockIds(body: BlocklyWorkspaceJson | undefined | null): string[] {
  const ids: string[] = [];
  walkWorkspace(body, ({ block, shadow }) => {
    if (shadow) return;
    if (typeof block.id === 'string' && block.id.length > 0) ids.push(block.id);
  });
  return ids;
}

/* ============================================================================================
 * VFN-006 — the sentences that point at something.
 *
 * > *"The 'Save as a block' right click option is confusing. It's not clear which blocks are
 * > going to be saved. It explains 5 blocks but it'd make more sense if you like drag
 * > highlighted them or something no?"*
 *
 * The count was already right. What was wrong is that *"These 5 blocks become a value block"* is
 * **deictic** — it points — and the dialog is modal and centred, so there was nothing on screen
 * for it to point at. The outline is the other half of the answer and lives in
 * `MyBlocksSaveOutline.ts`; these are the words, and they are here rather than in the component
 * so a runner can grade them.
 * ========================================================================================== */

/**
 * What is being saved, said definitely rather than by pointing.
 *
 * 🔴 The plural clause is dropped entirely at one block, and that is not tidiness. *"This block
 * and everything inside it and stacked under it"* implicates that there **is** something inside
 * it and under it; said of a lone `math_number` it is a lie by implicature, and the builder's
 * next move is to go looking for the blocks it claimed.
 */
export function describeSaveSelection(blockCount: number, shapeName: string): string {
  return blockCount === 1
    ? `This block becomes ${shapeName}.`
    : `This block and everything inside it and stacked under it becomes ${shapeName}.`;
}

/**
 * The tally under it — the sentence that hands the number to the thing on screen.
 *
 * @param outlined whether the outline was actually drawn. 🔴 Passed rather than assumed: the
 *   overlay declines on a workspace with nothing rendered, and a dialog that says *"outlined
 *   behind this dialog"* over an un-outlined workspace is a worse lie than the deixis it
 *   replaced, because it sends the builder looking for something that is not there.
 */
export function describeOutlineTally(blockCount: number, outlined: boolean): string | undefined {
  if (blockCount === 1) return outlined ? 'Outlined behind this dialog.' : undefined;
  return outlined ? `${blockCount} blocks, outlined behind this dialog.` : `${blockCount} blocks.`;
}

/**
 * What a mid-stack right-click leaves behind, or `undefined` when it left nothing behind.
 *
 * The surprise the report is really about, and the one `MyBlocksSave.ts`'s header predicted: the
 * gesture takes everything *below* the clicked block, so clicking the middle of a stack silently
 * splits it. Nothing said so, and the count alone cannot — a builder who sees "5 blocks" over an
 * 8-block stack has no way to know which 5.
 */
export function describeBlocksLeftBehind(blocksAbove: number): string | undefined {
  if (!blocksAbove || blocksAbove < 1) return undefined;
  return blocksAbove === 1
    ? 'The block above this one stays where it is.'
    : `The ${blocksAbove} blocks above this one stay where they are.`;
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

/* ============================================================================================
 * VFN-008 — what a *saved* block says about itself, wherever it appears.
 *
 * > *"Once saved, it's not easy to know what your saved block actually does. If you put it on a
 * > canvas later on, how do you know what inputs and outputs it has? What it's supposed to do?"*
 *
 * The answer was already computed and then thrown away: `inferSignature` runs on every save and
 * stores `shape` and `params`, and the dialog showed a sentence about them once and dropped it.
 * Everything below is that answer, said in the three places a builder meets a saved block — the
 * save dialog, the call block's tooltip, and the My Blocks flyout — and it is all here rather
 * than in the components so that a runner can grade the words. §1's whole argument is that the
 * *words* are the only thing teaching value-versus-statement, and words in a JSX literal are
 * words no spec can reach.
 * ========================================================================================== */

/**
 * The glyph a saved block wears, in the flyout and on the workspace.
 *
 * Exported so the call block's own header and the save dialog's preview cannot drift: a preview
 * that showed a different mark from the block it is previewing would be a mockup, not a preview.
 */
export const MY_BLOCKS_BLOCK_GLYPH = '▣';

/**
 * The one fact with the largest blast radius, and it holds for every saved block whether or not
 * anyone described it.
 *
 * It is last in the tooltip rather than first because it is the sentence a builder needs *after*
 * they have worked out what the block is — but it is never dropped, because "editing this edits
 * it everywhere" is the property that makes a saved block worth having and the one that makes an
 * unwitting edit expensive.
 */
export const MY_BLOCKS_PROPAGATION_NOTE = 'Editing the saved block changes it everywhere.';

/** Enough for a sentence about what a block is for. Longer than that belongs in the block. */
export const MAX_BLOCK_DESCRIPTION_LENGTH = 200;

/** The parts of a definition every sentence below needs. Deliberately not the whole thing. */
export interface DescribableDefinition {
  name: string;
  shape: MyBlockShape;
  params: readonly Pick<MyBlockParam, 'name'>[];
  description?: string;
  /** Workspace variables the body reads or writes. See {@link describeVariableWarning}. */
  variables?: readonly string[];
}

/**
 * One line naming the block and its shape: *"Discount — takes price and rate, and gives a
 * value."*
 *
 * "Gives a value" rather than "is a value block": the toolkit's word is in the save dialog,
 * where there is room to teach it, and the tooltip is read by someone who is already holding the
 * block and wants to know what to do with it.
 */
export function describeSignatureLine(definition: DescribableDefinition): string {
  const name = (definition.name || '').trim() || 'This block';
  const ending =
    definition.shape === 'value' ? 'gives a value' : 'stacks with your other blocks';
  const names = definition.params.map((param) => param.name);

  return names.length === 0
    ? `${name} — ${ending}.`
    : `${name} — takes ${joinPhrases(names)}, and ${ending}.`;
}

/**
 * The warning about workspace variables, or `undefined` when there is nothing to warn about.
 *
 * VFN-008's fourth question, answered honestly at the moment it can still be acted on. A
 * definition body that uses a Blockly `variables_get` refers to a variable in the workspace it
 * was saved from; placed in a different Visual Function that variable does not exist, and
 * nothing remaps it.
 *
 * 🔴 The rejected alternative is worth keeping written down: **silently creating the variable in
 * the host workspace on placement**. That is a saved definition quietly authoring the program it
 * was dropped into, and it is not recoverable by undo in the way builders expect. An explicit
 * *"create the variables this block needs"* button is a possible later affordance; a silent one
 * is not.
 */
export function describeVariableWarning(variables: readonly string[] | undefined): string | undefined {
  if (!variables || variables.length === 0) return undefined;

  const quoted = variables.map((name) => `"${name}"`);
  const subject = variables.length === 1 ? 'the variable' : 'the variables';

  return `This uses ${subject} ${joinPhrases(quoted)}, which will not travel with the block.`;
}

/**
 * The call block's tooltip — every line it has, in reading order.
 *
 * A definition with a description gets its sentence; one without degrades to the shape line and
 * the standing warning rather than blanking, which is acceptance criterion 2 and is also the
 * state **every definition on disk today is in**, because nothing has ever asked for a
 * description.
 *
 * ⚠️ Tooltips are set in Blockly's `init()`, before `loadExtraState` has run and while the
 * block's state is still a stub. `MyBlocksBlocks` therefore hands `setTooltip` a *function*, so
 * this is called when the tooltip is shown rather than when the block is built.
 */
export function describeCallTooltip(definition: DescribableDefinition): string {
  return [
    describeSignatureLine(definition),
    normaliseBlockDescription(definition.description),
    describeVariableWarning(definition.variables),
    MY_BLOCKS_PROPAGATION_NOTE
  ]
    .filter((line): line is string => !!line)
    .join('\n');
}

/**
 * The label lines that sit above a definition's block in the My Blocks flyout.
 *
 * The flyout used to show `▣ Discount` and nothing else, so a builder browsing the category had
 * to drag a block out and read its sockets to learn anything about it. These are `kind: 'label'`
 * entries, the same mechanism the empty state already uses.
 *
 * ⚠️ The flyout is rebuilt on **every open**, so this is free to keep current and must not be
 * cached anywhere.
 */
export function describeFlyoutLabels(definition: DescribableDefinition): string[] {
  return [
    describeSignatureLine(definition),
    normaliseBlockDescription(definition.description),
    describeVariableWarning(definition.variables)
  ].filter((line): line is string => !!line);
}

/**
 * The face of the block the builder is about to get: `▣ Discount   price   rate`.
 *
 * Shown in the save dialog while the name is being typed, so the name is visibly being attached
 * to a signature rather than to an abstraction. The socket labels are the resolved parameter
 * names — the ones `rebuildInputs_` will actually render — not a restatement of the count.
 */
export function describeCallPreview(name: string, params: readonly Pick<MyBlockParam, 'name'>[]): string {
  const label = (name || '').trim() || 'your block';
  const sockets = params.map((param) => param.name);
  return sockets.length === 0
    ? `${MY_BLOCKS_BLOCK_GLYPH} ${label}`
    : `${MY_BLOCKS_BLOCK_GLYPH} ${label}   ${sockets.join('   ')}`;
}

/**
 * Everything a definition body says about itself, without a store or a workspace present.
 *
 * The convenience the three surfaces share: given a name, a signature and a body, work out the
 * variables and hand back the shape the sentence builders want.
 */
export function describableFrom(
  name: string,
  signature: Pick<InferredSignature, 'shape' | 'params'>,
  body: BlocklyWorkspaceJson | undefined | null,
  description?: string
): DescribableDefinition {
  return {
    name,
    shape: signature.shape,
    params: signature.params,
    description: normaliseBlockDescription(description),
    variables: collectVariableReferences(body)
  };
}
