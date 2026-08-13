/**
 * VFN-009 — what an edit to a saved block changed about its *interface*.
 *
 * The propagation warning is allowed to make exactly three claims, and this file computes the two
 * that are about the edit rather than about the project:
 *
 * - the **shape** changed — `value` ⇄ `statement`. Not a guess: `expandWorkspace` already refuses
 *   a call block whose shape no longer matches its definition, by name (`MyBlocksShapeError`), so
 *   a warning about it is reporting a refusal that is real and about to happen.
 * - the **parameters** changed — a removed parameter leaves a socket with nowhere to go, an added
 *   one leaves an empty socket. Both come out of `inferSignature`, which already runs on every
 *   `store.save`, so this is reading the same answer rather than computing a second one.
 *
 * 🔴 **The third claim — that a flow is broken — is not here and must not be added.** Nothing in
 * this system knows what a program is *for*. A warning that guesses at behavioural breakage will
 * be believed, and being believed wrongly is worse than being silent. Semantic breakage waits for
 * the unit-testing phase, where a saved block can carry expectations and a change can be graded
 * against them. `libraryIntent.ts` holds the detector that keeps that boundary honest.
 *
 * @module BlocklyEditor/myblocks
 */

import type { BlocklyWorkspaceJson, MyBlockDefinition, MyBlockParam, MyBlockShape } from './format';
import { inferSignature, schemaWithCalls, type BlockSchema } from './shape';

export interface DefinitionChange {
  shapeBefore: MyBlockShape;
  shapeAfter: MyBlockShape;
  /**
   * `value` ⇄ `statement`. The one change that makes every existing call block refuse to
   * generate, which is why it is separated from the parameter changes rather than listed beside
   * them: the consequences are different in kind, not in degree.
   */
  shapeChanged: boolean;
  /** Parameter names present after the edit and not before, in signature order. */
  added: string[];
  /** Parameter names present before the edit and not after, in signature order. */
  removed: string[];
  /** Any of the above. `false` means the edit changed the body and nothing a caller can see. */
  changed: boolean;
}

/**
 * The signature of a body, as the store would compute it on save.
 *
 * Exported because the warning is shown *before* the edit is committed, so there is no saved
 * definition to read it off yet — the caller has a workspace in hand and nothing else.
 */
export function signatureOf(body: BlocklyWorkspaceJson | undefined | null, schema: BlockSchema = schemaWithCalls()) {
  const signature = inferSignature(body, schema);
  return { shape: signature.shape, params: signature.params };
}

/**
 * Compare a definition as it is stored against a body that is about to replace it.
 *
 * ⚠️ Parameters are matched **by name**, not by `id`. `inferSignature` mints a fresh `id` for every
 * parameter on every call (`newId('p')`), so an id comparison would report every parameter as both
 * added and removed on every save — a warning that cried wolf on an edit that changed nothing a
 * caller can see. The name is derived from the socket the hole sits in, which is the thing a
 * builder recognises on the call block's face.
 */
export function definitionChangeFor(
  before: Pick<MyBlockDefinition, 'shape' | 'params'> | undefined | null,
  afterBody: BlocklyWorkspaceJson | undefined | null,
  schema: BlockSchema = schemaWithCalls()
): DefinitionChange {
  const after = signatureOf(afterBody, schema);

  // No "before" means this is a create, not an edit. Nothing can be broken by a definition that
  // nothing has had the chance to call yet, so every field is the honest empty answer.
  const beforeShape = before?.shape ?? after.shape;
  const beforeParams = before?.params ?? after.params;

  const names = (params: readonly MyBlockParam[]) => params.map((p) => p.name);
  const beforeNames = names(beforeParams);
  const afterNames = names(after.params);

  const added = afterNames.filter((name) => beforeNames.indexOf(name) === -1);
  const removed = beforeNames.filter((name) => afterNames.indexOf(name) === -1);
  const shapeChanged = beforeShape !== after.shape;

  return {
    shapeBefore: beforeShape,
    shapeAfter: after.shape,
    shapeChanged,
    added,
    removed,
    changed: shapeChanged || added.length > 0 || removed.length > 0
  };
}
