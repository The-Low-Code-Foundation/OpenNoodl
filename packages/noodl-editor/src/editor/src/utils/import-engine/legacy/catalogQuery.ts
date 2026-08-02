/**
 * LIB-006: the default {@link CatalogTypeQuery}, over the bundled catalogs.
 *
 * Kept out of `assess.ts` so the assessment core stays injectable and testable
 * without loading 153 node definitions — the same separation `validation/catalog.ts`
 * makes for the rule engine, and for the same reason.
 *
 * The replacement mapping comes from the **enriched** catalog's
 * `enrichment.relatedNodes`, which already carries every deprecated→replacement
 * pair. LIB-006 reads it; it does not keep a second copy that could go stale.
 *
 * @module noodl-editor/utils/import-engine/legacy/catalogQuery
 */

import { loadDefaultCatalog } from '../../../validation/catalog';
import { enrichmentFor } from '../../../validation/enrichedCatalog';
import type { CatalogTypeQuery } from './types';

/** A `CatalogTypeQuery` backed by the bundled node catalog and its enrichment. */
export function defaultCatalogQuery(): CatalogTypeQuery {
  const index = loadDefaultCatalog();
  return {
    hasType(typeName) {
      return index.hasType(typeName);
    },
    isDeprecated(typeName) {
      return index.getNode(typeName)?.isDeprecated === true;
    },
    relatedNodes(typeName) {
      return enrichmentFor(typeName)?.relatedNodes ?? [];
    }
  };
}
