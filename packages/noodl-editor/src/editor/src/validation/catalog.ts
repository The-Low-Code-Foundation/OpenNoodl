/**
 * SUB-006 — Semantic Validator: default catalog loader
 *
 * Bundles the generated node catalog and wraps it in a `CatalogIndex`. Kept
 * separate from `CatalogIndex` so the rule engine stays pure (injectable) while
 * the editor service and CLI get a one-call default.
 *
 * ## CN-003 slice 3 — and the two accessors are no longer the same catalog
 *
 * The generated catalog holds **built-ins only**: it is produced at repo-build
 * time from the live register, and a project's kits exist per project, per
 * machine. `kitOverlay.ts` maps the node library the viewer already sent into
 * catalog-shaped entries; this module is where they are merged in, so that every
 * consumer of the *index* — `SemanticValidator` and therefore the Problems
 * panel, the AI authoring gate, `docLint`, the import engine — stops treating a
 * project's own node types as unknown.
 *
 * 🔴 **`defaultCatalog()` means the shipped catalog; `loadDefaultCatalog()`
 * means the catalog this project validates against.** They differ exactly by the
 * overlay, and the split is deliberate rather than an oversight:
 *
 * - The lesson vocabulary (`lessonverify.ts`) reads `defaultCatalog()` and must
 *   keep reading the shipped one. ⚠️ A lesson bundle is graded **at install,
 *   before its project exists** — its vocabulary has to be built from the
 *   bundle's own project files, not from whatever is open. Silently routing the
 *   open project's kits into it would answer about the wrong kit and look right.
 *   That routing is CN-003 slice 4, and it is a caller change, not this one.
 * - `renderCapture` / `livePreviewCapture` / `lessonwholesolution.live` read
 *   `defaultCatalog()` for the shipped vocabulary and are unaffected.
 *
 * ⚠️ **Everything derived from the index is a cache and must be dropped with
 * it.** A `SemanticValidator` built before the overlay arrived is a validator
 * that has never heard of the project's node types — silently, and only for the
 * checks it skips, which is indistinguishable from a project whose kits are
 * genuinely unknown. {@link catalogGeneration} is what long-lived holders
 * memoise against; both of the editor's two are wired to it.
 *
 * @module noodl-editor/validation/catalog
 */

import type { NodeCatalog } from '../../../../../noodl-types/src/node-catalog';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import catalogJson from '../../../../../noodl-types/src/node-catalog.json';
import { CatalogIndex } from './CatalogIndex';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeOverlay } = require('@nodegx/kit-catalog');
import type { NodeCatalogLike, OverlayCatalogNode } from '@nodegx/kit-catalog';

let overlayNodes: OverlayCatalogNode[] = [];
let generation = 0;

let cachedIndex: CatalogIndex | undefined;
let cachedMerged: NodeCatalog | undefined;
let cachedShippedIndex: CatalogIndex | undefined;

/**
 * The bundled node catalog, as data — **built-ins only, always**. See the
 * module header for why this one does not take the overlay.
 */
export function defaultCatalog(): NodeCatalog {
  return catalogJson as unknown as NodeCatalog;
}

/**
 * Install (or clear, with `[]`) the open project's kit node types.
 *
 * 🔴 Never mutates the bundled document — `mergeOverlay` returns a new one. The
 * bundled `nodes` array is a module singleton shared by every project opened in
 * this session, and one project's kits leaking into it is precisely what
 * CN-003's acceptance criterion 1 tests for with its "and false for a project
 * without the kit" half.
 *
 * Called on every node-library (re)load, which is also how the overlay is
 * *cleared*: closing a project empties `window.NodeLibraryData`, the reload maps
 * that to no kit nodes, and this is called with `[]`. There is no separate
 * teardown path to forget.
 */
export function setCatalogOverlay(nodes: OverlayCatalogNode[]): void {
  const next = nodes ?? [];
  // A no-op install is the common case — the library reloads for many reasons
  // that have nothing to do with kits — and bumping the generation for one would
  // rebuild every validator in the editor for no change.
  if (next.length === 0 && overlayNodes.length === 0) return;
  overlayNodes = next;
  cachedIndex = undefined;
  cachedMerged = undefined;
  generation++;
}

/** The overlay entries currently installed. Provenance for ✅ **D1**'s property panel. */
export function catalogOverlayNodes(): readonly OverlayCatalogNode[] {
  return overlayNodes;
}

/**
 * Bumped whenever the overlay changes. Anything that memoises something built
 * over {@link loadDefaultCatalog} must memoise against this number, not forever.
 */
export function catalogGeneration(): number {
  return generation;
}

/** The bundled catalog with the open project's kit entries merged in. */
export function projectCatalog(): NodeCatalog {
  if (!cachedMerged) {
    cachedMerged =
      overlayNodes.length === 0
        ? defaultCatalog()
        : (mergeOverlay(defaultCatalog() as unknown as NodeCatalogLike, overlayNodes) as unknown as NodeCatalog);
  }
  return cachedMerged;
}

/** A `CatalogIndex` over the catalog *including* this project's kits (memoised per generation). */
export function loadDefaultCatalog(): CatalogIndex {
  if (!cachedIndex) cachedIndex = new CatalogIndex(projectCatalog());
  return cachedIndex;
}

/**
 * A `CatalogIndex` over the **shipped** catalog, never the project's.
 *
 * For the one caller that pairs an index with `defaultCatalog()`'s *data* —
 * `defaultLessonVocabulary()`. Handing it `loadDefaultCatalog()` would give it
 * two halves that disagree (an index that resolves kit types over a display-name
 * map built without them), and memoised, so which halves it got would depend on
 * whether a project happened to be open the first time a lesson was verified.
 * Slice 4 routes a *project* vocabulary in deliberately, through
 * `VerifyLessonOptions.vocabulary`, built from the bundle's own project files.
 */
export function shippedCatalogIndex(): CatalogIndex {
  if (!cachedShippedIndex) cachedShippedIndex = new CatalogIndex(defaultCatalog());
  return cachedShippedIndex;
}
