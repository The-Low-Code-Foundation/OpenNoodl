/**
 * CN-003 slice 4 — the vocabulary a lesson bundle is checked against, read from
 * **that bundle's own project files**.
 *
 * ## Why this can exist here and cannot exist in the editor
 *
 * The trap CN-003 has carried since it was written: *a lesson bundle is graded
 * at install, before its project exists, so its vocabulary must come from the
 * bundle's own files rather than from whatever project is open.* That is a
 * requirement with no implementation in the editor — ✅ **D3** puts kit
 * extraction in exactly one process and the editor is not it, and ✅ **D6** says
 * third-party kit code is not run before consent, which a gate cannot grant
 * itself.
 *
 * This process is the one that *can*. It is headless, it already owns
 * `extractProjectOverlay`, and a bundle is a project directory like any other —
 * `noodl_modules/` included. So the sanctioned route reaches the bundle's own
 * kits exactly where lesson bundles are actually written and scored (UNI-010's
 * `create_lesson` and `verify_lesson_bundle`), and the editor's install gate
 * stays honest about what it could not read.
 *
 * ## 🔴 Three outcomes, and only one of them is "no kits"
 *
 * `extractProjectOverlay` already keeps them apart and this module must not
 * flatten them — that flattening is CN-002's whole lesson:
 *
 * | outcome | what the vocabulary says |
 * |---|---|
 * | `skipped: 'no-modules-directory'` | complete. There are no kits. |
 * | nodes extracted | complete, **plus** those node types. |
 * | `unavailable`, or a kit that threw | **incomplete, and it says so** — an unknown type name may be that kit's. |
 *
 * The third row is the one worth the file. An extractor that failed to build
 * reports zero kit node types, which is indistinguishable from a bundle with no
 * kits unless something carries the difference forward.
 *
 * @module noodl-mcp/lessons/bundleVocabulary
 */

import { bundleLessonVocabulary, catalogWithOverlay } from '../editor-deps';
import type { CatalogIndex, LessonVocabulary, UnresolvedKits } from '../editor-deps';
import { extractProjectOverlay } from '../kitExtract/extract';
import type { ProjectKitOverlay } from '../kitExtract/extract';

export interface BundleVocabulary {
  /** For `VerifyLessonOptions.vocabulary` — the F1 type-name check. */
  vocabulary: LessonVocabulary;
  /**
   * For `buildLessonEvalContext`'s `catalog` option. 🔴 Pass it: the default is
   * the editor's `loadDefaultCatalog()`, and a kit node reconstructed without
   * its declared ports makes `hasPort` read false against a correct solution —
   * a *manufactured* F2 failure, the one output a gate must never produce.
   */
  catalog: CatalogIndex;
  /** What was found, verbatim, for a caller that wants to report it. */
  overlay: ProjectKitOverlay;
}

/** Why the bundle's kit types could not be read, or `undefined` when they could. */
function unresolvedFor(overlay: ProjectKitOverlay): UnresolvedKits | undefined {
  if (overlay.unavailable) {
    return { where: 'This bundle', reason: overlay.unavailable.reason };
  }
  if (overlay.failures.length > 0) {
    const names = overlay.failures.map((f) => `"${f.kitModule}"`).join(', ');
    return {
      where: 'This bundle',
      reason: `${names} failed to load, so the node types it declares are unknown here`
    };
  }
  return undefined;
}

/**
 * Read `bundleDir`'s own kits and build the vocabulary and catalog to check it
 * with.
 *
 * ⚠️ **Executes the bundle's kit code**, in a child process, exactly as binding a
 * project does. That is sound on this path and only on this path: the bundles
 * this server scores are ones the local agent is writing against the user's own
 * project. It is not a licence for the editor's install gate to do the same to a
 * bundle a user downloaded — see the module header.
 */
export function bundleVocabularyFor(bundleDir: string): BundleVocabulary {
  const overlay = extractProjectOverlay(bundleDir);
  const unresolved = unresolvedFor(overlay);
  // Nodes and `unresolved` are independent: a bundle with two kits, one of which
  // threw, contributes the working one's types *and* reports that it is partial.
  const { index } = catalogWithOverlay(overlay.nodes);

  return {
    vocabulary: bundleLessonVocabulary(overlay.nodes, unresolved),
    catalog: index,
    overlay
  };
}
