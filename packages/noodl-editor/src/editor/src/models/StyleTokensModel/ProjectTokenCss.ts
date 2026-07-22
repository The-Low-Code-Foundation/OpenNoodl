/**
 * REV-009: building the effective token set without a StyleTokensModel instance.
 *
 * `StyleTokensModel` is a live, listener-bound editor model. The exporter needs
 * the same answer — "what does `:root` look like for this project?" — but at a
 * point where constructing and disposing a model would be all cost and no
 * benefit. These free functions are the shared, side-effect-free core; the model
 * builds its own token map on top of them.
 */

import { buildDefaultTokenMap } from './DefaultTokens';
import { StyleTokenRecord, StyleTokensData } from './TokenCategories';
import { TokenResolver } from './TokenResolver';

/** Project metadata key under which custom token overrides are persisted. */
export const STYLE_TOKENS_METADATA_KEY = 'designTokens';

/** The subset of ProjectModel this module needs — keeps it trivially testable. */
export interface MetaDataSource {
  getMetaData(key: string): unknown;
}

/**
 * Merge the shipped defaults with a project's stored overrides.
 * Unknown or malformed stored data is ignored — defaults are always the floor.
 */
export function buildEffectiveTokens(stored: StyleTokensData | null | undefined): Map<string, StyleTokenRecord> {
  const tokens = buildDefaultTokenMap();

  if (stored && Array.isArray(stored.customTokens)) {
    for (const customToken of stored.customTokens) {
      if (customToken && typeof customToken.name === 'string') {
        tokens.set(customToken.name, customToken);
      }
    }
  }

  return tokens;
}

/** Read and validate the stored override block from project metadata. */
export function readStoredTokens(project: MetaDataSource | null | undefined): StyleTokensData | null {
  if (!project) return null;
  const data = project.getMetaData(STYLE_TOKENS_METADATA_KEY);
  if (!data || typeof data !== 'object') return null;
  return data as StyleTokensData;
}

/**
 * Generate the `:root { ... }` block for a project — defaults plus its overrides.
 *
 * This is what the exporter stamps into the deployed index.html. In the editor
 * preview the equivalent CSS is pushed into the webview by PreviewTokenInjector,
 * so that both paths resolve the same `var(--token)` vocabulary.
 */
export function generateProjectTokenCss(project: MetaDataSource | null | undefined): string {
  const tokens = buildEffectiveTokens(readStoredTokens(project));
  return new TokenResolver(tokens).generateCss(tokens);
}
