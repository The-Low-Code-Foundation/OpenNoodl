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
 */
function applyTokenAction(rv: RepeatedValue, options: SuggestionActionHandlerOptions): boolean {
  const { tokenModel, onComplete } = options;
  const project = ProjectModel.instance;
  if (!project || !tokenModel) return false;

  const tokenName = rv.suggestedTokenName;
  const varRef = `var(${tokenName})`;

  // If a matching token already exists, skip creation — just replace references
  if (!rv.matchingToken) {
    tokenModel.setToken(tokenName, rv.value);
  }

  const resolvedRef = rv.matchingToken ? `var(${rv.matchingToken})` : varRef;

  // Replace every occurrence in the project
  let updated = 0;
  for (const ref of rv.elements) {
    const node = project.findNodeWithId(ref.nodeId);
    if (!node) continue;
    const current = node.getParameter(ref.property);
    if (current === rv.value) {
      node.setParameter(ref.property, resolvedRef);
      updated++;
    }
  }

  if (updated > 0) {
    onComplete?.();
  }

  return updated > 0;
}

// ─── Variant Creation ─────────────────────────────────────────────────────────

/**
 * Saves a node's custom overrides as a named variant on its element config.
 * The node itself has its variant param set to the new variant name.
 */
function applyVariantAction(vc: VariantCandidate, options: SuggestionActionHandlerOptions): boolean {
  const { onComplete } = options;
  const project = ProjectModel.instance;
  if (!project) return false;

  const node = project.findNodeWithId(vc.nodeId);
  if (!node) return false;

  // Store variant name on the node so the variant selector reflects it
  node.setParameter('_variant', vc.suggestedVariantName);

  onComplete?.();
  return true;
}
