/**
 * DEF-007 — what a project on disk means, and which readers agree.
 *
 * # The seam is one call
 *
 * `applyPatches(content)` immediately before `ProjectModel.fromJSON(content)`. `fromJSON` does
 * **not** apply patches — it calls `ProjectModel.upgrade` and nothing else — so **every path that
 * reaches `fromJSON` without going through `applyPatches` first sees the file exactly as written.**
 *
 * That matters because `applyPatches` does not only normalise old node shapes. It runs
 * {@link applyRunOnValueChangeMigration}, which **rewrites stored parameters**: for every node
 * whose control signal is wired it writes `runOnChange-<input>: false`. So a project can differ
 * from itself in a large number of stored parameters depending only on *who opened it*. The editor
 * sees one graph; a headless render, an export or the MCP server sees another.
 *
 * ⚠️ **This was measured at 56 writes on the shipped site-builder template, and that figure is now
 * ZERO** — re-measured 2026-08-31 at HEAD: `writes: 0, familyNodes: 82, signalDrivenNodes: 40,
 * preserved: 91`. It was 56 at `cdd842fc` and 65 two days later; DEF-007 §3.2 drove it to 0 by
 * making `toTemplateContent` state the values itself. 🔴 **A zero here does NOT mean the seam
 * closed.** It means this one template stopped exercising it. Any template that leaves a governed
 * input unstated still differs, and that is the case this registry exists to make findable —
 * which is why the count is quoted with `familyNodes` beside it, a zero with no family nodes
 * found being a broken instrument rather than an absence.
 *
 * # Why this list lives here and not in a task file
 *
 * 🔴 **Richard ruled on 2026-08-31 that the table move into the codebase *and* gain a test.** The
 * content was never the problem — a phase's task file is a record of that phase, and when the
 * phase closes nobody maintains it. Worse, this is a hand-maintained list of "which callers need
 * the special treatment", which is exactly the shape that decayed until `Checkbox` was missed
 * while its identical sibling `Radio Button` was fixed (DEF-037).
 *
 * ⚠️ **So the list is not the safeguard — `def007-project-load-seam.test.ts` is.** That test
 * enumerates the real `ProjectModel.fromJSON` call sites from disk and fails when one appears that
 * is not registered below. Adding a seventh load path without a decision is what it prevents.
 * **If you are here because that test failed, you are being asked to make a decision, not to
 * append a row to make it green.**
 */

/** Which side of the seam a call site sits on. */
export type SeamDisposition =
  /** Calls `applyPatches` before `fromJSON`. Sees the migrated graph. */
  | 'applies'
  /**
   * Reaches `fromJSON` with no patch pass. Sees the file as written.
   * 🔴 This is the side the defect lives on.
   */
  | 'does-not-apply'
  /**
   * Calls `fromJSON` on a project that is **already loaded** — `this.project.toJSON()`, or a
   * synthesised shell. Downstream of someone else's `applyPatches`, not a second opinion about it.
   */
  | 'inherits';

export interface ProjectLoadSite {
  /** Repo-relative path, as the test globs it. */
  readonly file: string;
  /** What this path is, in the words someone debugging would use. */
  readonly entryPoint: string;
  readonly disposition: SeamDisposition;
  /** Why it is on that side — a decision, or an unclosed gap. */
  readonly note: string;
}

/**
 * Every place `ProjectModel.fromJSON` is reached from **shipped source**.
 *
 * ⚠️ Tests, `scripts/`, and the prebuilt `src/external/*` bundles are deliberately out of scope:
 * a test harness building a fixture project is not a load path a user's project takes.
 */
export const PROJECT_LOAD_SITES: readonly ProjectLoadSite[] = [
  {
    file: 'packages/noodl-editor/src/editor/src/models/projectmodel.editor.ts',
    entryPoint: 'Opening a project in the editor',
    disposition: 'applies',
    note: 'The reference path. `applyPatches(content)` on the line before `fromJSON`.'
  },
  {
    file: 'packages/noodl-preview/src/loader.ts',
    entryPoint: 'Headless preview / SSR render',
    disposition: 'does-not-apply',
    note:
      'Renders a project from disk without the migration, so it can render a graph the editor ' +
      'would have rewritten. This is the path phase 77 D5 measured: 37 nodes rewritten on load ' +
      'in a fresh project, and the site root rendering no page at all.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/models/projectmodel.ts',
    entryPoint: '`fromLocalStorage` — rebuilding a project from a stored string',
    disposition: 'does-not-apply',
    note:
      'The one place a project is reconstructed from a string with no patch pass at all. Not ' +
      'downstream of a load, unlike the two `inherits` rows below.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/utils/compilation/compilation.ts',
    entryPoint: 'Compilation — clones the loaded project',
    disposition: 'inherits',
    note: '`fromJSON(this.project.toJSON())`. The project was patched when the editor opened it.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/utils/exportProjectComponents.ts',
    entryPoint: 'Component export — a synthesised project shell',
    disposition: 'inherits',
    note: 'Builds a shell around components taken from the already-loaded project.'
  }
];

/**
 * Paths that load or rewrite a project **without** reaching `ProjectModel.fromJSON` at all, and so
 * cannot be found by scanning for it.
 *
 * ⚠️ Kept here because the question this module answers is *"what does a project on disk mean?"*,
 * and these change the answer. They are **not** enforced by the scan — a reader adding to this
 * list is making a note, not passing a gate.
 */
export const NON_FROMJSON_READERS: readonly Omit<ProjectLoadSite, 'file'>[] = [
  {
    entryPoint: 'Code export (`packages/nodegx-export`)',
    disposition: 'does-not-apply',
    note: 'Reads the project files directly.'
  },
  {
    entryPoint: 'MCP authoring and validation (`packages/noodl-mcp`)',
    disposition: 'does-not-apply',
    note: 'Reads and writes the project files directly; never constructs a `ProjectModel`.'
  },
  {
    entryPoint: 'Template generation (the artefact)',
    disposition: 'does-not-apply',
    note:
      'Written as JSON and never loaded, which is why phase 78 D14 requires a template to be ' +
      'correct *as written*. Partly closed: `pinRunOnValueChangeDefaults` now writes the ' +
      'explicit values for the site-builder generator. `tpl001Template.ts` has not had the same ' +
      'pass and nobody has measured whether it disagrees.'
  },
  {
    entryPoint: 'Version-control snapshot (`snapshotProject.ts`)',
    disposition: 'applies',
    note: 'Calls `applyPatches` directly on the project JSON; does not go through `fromJSON`.'
  },
  {
    entryPoint: 'The git merge driver (`src/main/src/merge-driver.js`)',
    disposition: 'applies',
    note:
      'Patches `ours`, `theirs` and the ancestor before merging. Correct rather than merely ' +
      'harmless: the migration is deterministic and idempotent, so all three sides normalise the ' +
      'same way and it can only remove conflicts, never manufacture one.'
  }
];
