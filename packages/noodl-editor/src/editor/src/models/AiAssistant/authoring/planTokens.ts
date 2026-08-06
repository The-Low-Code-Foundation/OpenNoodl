/**
 * AAQ-005 criterion 3 — the plan transaction's design-token channel.
 *
 * Criterion 3 is *"a page + two section components + a token write in one
 * changeset, applies atomically, and undoes as one group"*. Everything except
 * the token write already held: `applyAuthoredPlan` records every mutation into
 * ONE `UndoActionGroup` and pushes it once. **Measured before this was written**
 * (`tests/ai/authoring-multi-component.test.ts`): a three-component plan came
 * out as exactly one undo step, not three.
 *
 * A token write did not, and could not. `StyleTokensModel.setToken(…, { undo:
 * true })` mints and pushes its **own** `UndoActionGroup` per token, so a plan
 * that agreed a five-token palette would have left six undo steps behind and
 * "undo the build" would have undone the last colour. `applyPreset` — the seam
 * AAQ-009 is told to build on — takes no undo at all and is a straight bulk
 * mutation.
 *
 * ## The boundary with AAQ-009, stated rather than blurred
 *
 * AAQ-005's own decision record: *"`set_design_tokens` is DECLARED here and
 * IMPLEMENTED in AAQ-009 … the declaration is a vocabulary question and the
 * behaviour is a styling question."* This module is neither of those. It is the
 * **transaction** half — the thing that makes a token write part of one
 * changeset — which is the property criterion 3 names and the property this task
 * owns. Deliberately NOT here:
 *
 *  - the `set_design_tokens` **tool** (a vocabulary surface, and adding one to
 *    `authoringVocabulary.ts` re-renders `noodl-mcp`'s zod schemas — a package
 *    this slice was scoped out of);
 *  - **which** tokens a bespoke identity should carry, and how a model is asked
 *    for them (AAQ-009, on `applyPreset`);
 *  - any policy about a token the user has already customised. It is written,
 *    like every other token in the plan the user approved. ⚠️ That is a genuine
 *    open question — `applySettings` takes the opposite view for project
 *    settings, on the grounds that a decided value is a decision — and
 *    `StyleTokensModel.isOverridden(name)` is the hook if AAQ-009 wants the
 *    other answer. It is left open rather than guessed because a bespoke palette
 *    that declines to change the palette is not obviously right either.
 *
 * ## Why an injected writer rather than a direct call
 *
 * The same reason `PlanDocWriter` and `PlanBackendProvisioner` are injected:
 * `planStaging.ts` is the transaction and knows about `ProjectModel` and
 * `UndoActionGroup` and nothing else. A value import of `StyleTokensModel` there
 * would pull the styles model, its resolver and `EventDispatcher` into the
 * transaction. {@link TokenModelLike} is the three methods this needs.
 *
 * @module AiAssistant/authoring/planTokens
 */

import { STYLE_TOKENS_METADATA_KEY } from '../../StyleTokensModel/ProjectTokenCss';
import type { UndoActionGroup } from '../../undo-queue-model';
import type { PlanTokenWriter } from './planStaging';

/**
 * A design-token store as the transaction needs it. `StyleTokensModel`
 * satisfies it structurally — deliberately without its `{ undo }` arguments,
 * which are exactly what this module must not use: each one pushes its own
 * group onto the queue and the whole point here is that there is one.
 */
export interface TokenModelLike {
  getToken(name: string): { name: string; value: string } | undefined;
  setToken(name: string, value: string): void;
  /** Resets a default token to its default, or removes a fully-custom one. */
  deleteCustomToken(name: string): void;
}

/**
 * Where the token model persists — `ProjectModel` satisfies it structurally.
 *
 * ⚠️ **This exists because of a defect the criterion-3 drive found, and it is
 * worth stating rather than hiding behind a passing spec.** Restoring every
 * token to its previous *value* does not restore the *project*:
 * `StyleTokensModel._store()` writes `{ version, customTokens: [] }` under
 * `designTokens`, and a project that never had a custom token had no such key at
 * all. So write-then-undo left a project that was byte-different from the one
 * the user started with — which is exactly what `applyAuthoredPlan`'s criterion
 * 4 promises will never happen, and which `StyleTokensModel`'s own undo specs
 * cannot see because they only read values back out of the model.
 *
 * The transaction closes it here rather than in `StyleTokensModel`, because the
 * promise being kept ("one undo restores the project exactly") is the
 * transaction's, and because the model's own four undo paths are not this task's
 * to change. The metadata blob is snapshotted before the first token is written
 * and restored last.
 */
export interface TokenStoreLike {
  getMetaData(key: string): unknown;
  setMetaData(key: string, data: unknown): void;
}

/**
 * The editor's binding: write the plan's tokens, recording the exact inverse of
 * each into the caller's undo group.
 *
 * The inverse is captured per token **before** anything is written, and it is
 * two different actions depending on what was there: a token that already had a
 * value is set back to it; a token the plan **introduced** is deleted, because
 * setting it back to "" would leave a custom token holding an empty string that
 * `TokenResolver` would then resolve to nothing. `deleteCustomToken` is the
 * right inverse for both a brand-new custom token and a default one the plan
 * overrode — it resets the latter rather than removing it.
 *
 * ⚠️ The undo actions run in reverse and are recorded per token, so a plan that
 * writes the same token twice still ends where it started.
 */
export function createPlanTokenWriter(model: TokenModelLike, store?: TokenStoreLike): PlanTokenWriter {
  return {
    preflight(tokens) {
      for (const [name, value] of Object.entries(tokens)) {
        // Not cosmetic: a token name that is not a CSS custom property never
        // reaches a stylesheet, so it would be written, stored, and silently do
        // nothing — the phantom-field failure this phase keeps finding.
        if (!name.startsWith('--')) {
          throw new Error(`"${name}" is not a CSS custom property — a design token name must start with "--".`);
        }
        if (typeof value !== 'string' || value.trim() === '') {
          throw new Error(`Design token "${name}" has no value.`);
        }
      }
    },

    apply(tokens, undoGroup: UndoActionGroup): string[] {
      const written: string[] = [];
      // Pushed FIRST so it runs LAST: a group undoes in reverse, and this has
      // to land after every per-token inverse has finished rewriting the blob.
      // See {@link TokenStoreLike} for what it is repairing.
      if (store) {
        const metadataBefore = store.getMetaData(STYLE_TOKENS_METADATA_KEY);
        undoGroup.push({ undo: () => store.setMetaData(STYLE_TOKENS_METADATA_KEY, metadataBefore) });
      }
      for (const [name, value] of Object.entries(tokens)) {
        const before = model.getToken(name)?.value;
        if (before === value) continue; // Already this. Nothing to record.
        undoGroup.pushAndDo({
          do: () => model.setToken(name, value),
          undo: () => (before === undefined ? model.deleteCustomToken(name) : model.setToken(name, before))
        });
        written.push(name);
      }
      return written;
    }
  };
}
