/**
 * STYLE-005: SuggestionActionHandler
 *
 * Handles the "Accept" action for each suggestion type:
 *   - repeated-color / repeated-spacing → creates a token + replaces raw values
 *   - variant-candidate → saves overrides as a named variant
 *
 * All actions are undoable via the standard Noodl undo queue.
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { StyleTokensModel } from '@noodl-models/StyleTokensModel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import type { RepeatedValue, StyleSuggestion, VariantCandidate } from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SuggestionActionHandlerOptions {
  /** Instance of StyleTokensModel to mutate when creating tokens. */
  tokenModel: StyleTokensModel;
  /** Called after a successful action so the UI can refresh. */
  onComplete?: () => void;
}

/**
 * Executes the primary action for a given suggestion.
 * Returns true if the action was applied, false if it was a no-op.
 */
export function executeSuggestionAction(suggestion: StyleSuggestion, options: SuggestionActionHandlerOptions): boolean {
  switch (suggestion.type) {
    case 'repeated-color':
    case 'repeated-spacing':
      if (!suggestion.repeatedValue) return false;
      return applyTokenAction(suggestion.repeatedValue, options);

    case 'variant-candidate':
      if (!suggestion.variantCandidate) return false;
      return applyVariantAction(suggestion.variantCandidate, options);

    default:
      return false;
  }
}

// ─── Token Creation ───────────────────────────────────────────────────────────

/**
 * Creates a new design token from a repeated raw value and replaces all
 * occurrences in the project with the CSS variable reference.
 *
 * PLAT-005: the whole thing — the token write plus every parameter rewrite —
 * now lands in ONE `UndoActionGroup`. Previously neither half was undoable at
 * all: `setToken` was called without `{ undo: true }` and `setParameter`
 * without any `args`, so accepting a suggestion that rewrote thirty parameters
 * across a project was a one-way door. The task's success criterion is
 * "applying a suggestion is undoable", and one Ctrl+Z has to reverse the whole
 * accept, not one parameter of it.
 */
function applyTokenAction(rv: RepeatedValue, options: SuggestionActionHandlerOptions): boolean {
  const { tokenModel, onComplete } = options;
  const project = ProjectModel.instance;
  if (!project || !tokenModel) return false;

  const tokenName = rv.suggestedTokenName;
  const resolvedRef = rv.matchingToken ? `var(${rv.matchingToken})` : `var(${tokenName})`;

  const undoGroup = new UndoActionGroup({ label: 'apply style suggestion' });

  // If a matching token already exists, skip creation — just replace references
  if (!rv.matchingToken) {
    const previous = tokenModel.getToken(tokenName);
    tokenModel.setToken(tokenName, rv.value);
    undoGroup.push({
      do: () => tokenModel.setToken(tokenName, rv.value),
      undo: () => {
        // A token we invented has no default to fall back to, so it is deleted;
        // one that already existed under this name is restored to its old value.
        if (previous) tokenModel.setToken(previous.name, previous.value);
        else tokenModel.deleteCustomToken(tokenName);
      }
    });
  }

  // Replace every occurrence in the project
  let updated = 0;
  for (const ref of rv.elements) {
    const node = project.findNodeWithId(ref.nodeId);
    if (!node) continue;
    const current = node.getParameter(ref.property);
    if (current === rv.value) {
      node.setParameter(ref.property, resolvedRef, { undo: undoGroup, label: 'apply style suggestion' });
      updated++;
    }
  }

  if (updated === 0) {
    // Nothing was rewritten — undo the token we may have just created rather
    // than leaving an orphan behind and an empty entry on the undo queue.
    undoGroup.undo();
    return false;
  }

  UndoQueue.instance.push(undoGroup);
  onComplete?.();
  return true;
}

// ─── Variant Creation ─────────────────────────────────────────────────────────

/**
 * Pick a variant name that is free for this node's type.
 *
 * `ProjectModel.createNewVariant` returns early — silently, with no error — if
 * a variant of that name already exists for the type, so an un-uniquified name
 * turns "Save as Variant" into a no-op the second time it is used.
 */
export function uniqueVariantName(
  existingNames: readonly string[],
  base: string
): string {
  const taken = new Set(existingNames);
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Saves a node's custom overrides as a named, reusable, PERSISTED variant.
 *
 * PLAT-005 — what this used to do, and why it was wrong:
 *
 * The old body was a single line, `node.setParameter('_variant', name)`, under
 * a doc comment claiming it "saves a node's custom overrides as a named variant
 * on its element config". It did not. `_variant` is a marker parameter belonging
 * to the STYLE-002 `ElementConfigRegistry` — a module-level `Map` populated at
 * import time from four hardcoded config files
 * (`models/ElementConfigs/configs/*.ts`). Nothing can add to it at runtime and
 * nothing about it is written to the project, so there was no path by which the
 * "variant" could come into existence. The visible result was a node whose
 * variant picker displayed a name absent from its own options list, the node's
 * overrides still sitting inline on the node, and nothing at all after a
 * restart.
 *
 * The real variant system is `ProjectModel.variants` / `VariantModel`: created
 * through `NodeGraphNode.createNewVariant`, surfaced by the property panel's
 * Variants editor, and serialised into the project. Its semantics are exactly
 * what this suggestion promises — the node's parameters are copied onto a named
 * variant and then cleared from the node, so the node now inherits them. That
 * is the path used here, with `{ undo: true }` so a single Ctrl+Z reverses it.
 */
function applyVariantAction(vc: VariantCandidate, options: SuggestionActionHandlerOptions): boolean {
  const { onComplete } = options;
  const project = ProjectModel.instance;
  if (!project) return false;

  const node = project.findNodeWithId(vc.nodeId);
  if (!node || typeof node.createNewVariant !== 'function') return false;

  const nodeType = node.type;
  if (!nodeType) return false;

  const existing = project.findVariantsForNodeType(nodeType) ?? [];
  const variantName = uniqueVariantName(
    existing.map((v: { name: string }) => v.name),
    vc.suggestedVariantName
  );

  node.createNewVariant(variantName, { undo: true });

  // createNewVariant bails out silently on several paths (node not attached to
  // a project, name clash). Confirm rather than reporting a success we did not
  // verify — reporting one is how the original stub survived this long.
  if (!project.findVariant(variantName, nodeType)) return false;

  onComplete?.();
  return true;
}
