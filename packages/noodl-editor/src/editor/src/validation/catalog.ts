/**
 * SUB-006 — Semantic Validator: default catalog loader
 *
 * Bundles the generated node catalog and wraps it in a `CatalogIndex`. Kept
 * separate from `CatalogIndex` so the rule engine stays pure (injectable) while
 * the editor service and CLI get a one-call default.
 *
 * @module noodl-editor/validation/catalog
 */

import type { NodeCatalog } from '../../../../../noodl-types/src/node-catalog';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import catalogJson from '../../../../../noodl-types/src/node-catalog.json';
import { CatalogIndex } from './CatalogIndex';

let cached: CatalogIndex | undefined;

/** The bundled node catalog, as data. */
export function defaultCatalog(): NodeCatalog {
  return catalogJson as unknown as NodeCatalog;
}

/** A `CatalogIndex` over the bundled catalog (memoised). */
export function loadDefaultCatalog(): CatalogIndex {
  if (!cached) cached = new CatalogIndex(defaultCatalog());
  return cached;
}
