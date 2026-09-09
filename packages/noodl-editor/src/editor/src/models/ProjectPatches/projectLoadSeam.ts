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
 *
 * 🔴 **That scan had a hole the shape of this defect, and HLS-003 closed it.** It could only see a
 * reader that constructs a `ProjectModel` — so the exporter, the MCP server and template
 * generation, the three readers most likely to be wrong, were carried as prose that nothing could
 * fail on. {@link GRAPH_READER_SITES} is the second scan: every shipped file that reads a
 * component graph off disk, with the disposition it was given and a test that fails on a new one.
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
  | 'inherits'
  /**
   * **Produces** a project rather than consuming one. It owes the opposite obligation — state the
   * governed values explicitly, because an absent key means *ticked* to a file reader and
   * *pre-§2 author* to the migration. See {@link GraphReaderDisposition} for the longer form.
   */
  | 'authors';

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
/**
 * What a graph reader does with the parameters it reads — the axis that decides whether the seam
 * can reach it at all (HLS-003).
 */
export type GraphReaderDisposition =
  /** Runs the patch pass, or reads a project something else already patched. Sees the canvas's graph. */
  | 'applies'
  /**
   * Reads stored parameters and acts on what they mean at runtime, without the patch pass.
   * 🔴 This is the side the defect lives on, and the list of these should only ever shrink.
   */
  | 'does-not-apply'
  /**
   * Reads project files but never asks what a parameter *means* — it moves them, diffs them,
   * validates their shape, or lists them.
   *
   * ⚠️ **This is a claim about behaviour, not a smaller version of `does-not-apply`.** The
   * migration rewrites the value of `runOnChange-<input>`; a reader that never branches on that
   * value cannot give a different answer because of it. The day one of these starts interpreting
   * a parameter it becomes `does-not-apply` and has to be decided, which is what the scan is for.
   */
  | 'does-not-interpret'
  /**
   * **Writes** graph files rather than consuming them. Its output is read by everybody else, so it
   * owes the opposite obligation: state the governed values explicitly, because an absent key
   * means *ticked* to a file reader and *pre-§2 author* to the migration. See DEF-007 §3.2's
   * `pinRunOnValueChangeDefaults` and the DEF-038 gate over the generated templates.
   */
  | 'authors';

export interface GraphReaderSite {
  /** Repo-relative path, as the scan globs it. */
  readonly file: string;
  readonly disposition: GraphReaderDisposition;
  readonly note: string;
}

/**
 * Every shipped source file that reads a project's **component graph** off disk.
 *
 * ## 🔴 Why this exists, when `PROJECT_LOAD_SITES` already did
 *
 * That list is found by scanning for `ProjectModel.fromJSON`, and the test that enforces it said
 * so about itself: *"It cannot see a reader that never constructs a `ProjectModel`"*. The three
 * readers that matter most — the exporter, the MCP server, template generation — are all in
 * exactly that blind spot, and were carried as prose in {@link NON_FROMJSON_READERS} where nothing
 * could fail on them. HLS-003 is what that cost: the exporter sat on the wrong side of the seam
 * for as long as the row describing it was a sentence.
 *
 * So this list is enforced. `def007-project-load-seam.test.ts` scans shipped source for reads of
 * the component graph files and fails on a file that is not registered here — and on a registered
 * file that has disappeared.
 *
 * ⚠️ **Registering a file is a decision, not a formality.** If the scan sent you here, the
 * question is which of the four dispositions is true of the reader you added, and `does-not-apply`
 * is an admission rather than a default.
 */
export const GRAPH_READER_SITES: readonly GraphReaderSite[] = [
  {
    file: 'packages/nodegx-export/src/parse/parseProject.ts',
    disposition: 'applies',
    note:
      'HLS-003. Settles each component with `applyRunOnValueChangeMigration` as it is read, so the ' +
      'export matches the canvas, and reports what it settled. Nothing is written back to the ' +
      "project. This is also the editor's own File → Export React path — `exportSequence.ts` " +
      'reaches `parseProject`, not the loaded model, so both doors were on the wrong side until now.'
  },
  {
    file: 'packages/noodl-preview/src/loader.ts',
    disposition: 'does-not-apply',
    note:
      '🔴 Still open. Renders a project from disk without the migration — the path phase 77 D5 ' +
      'measured: 37 nodes rewritten on load in a fresh project, and the site root rendering no ' +
      'page at all. Also in `PROJECT_LOAD_SITES`, which is how it was ever found.'
  },
  {
    file: 'packages/noodl-mcp/src/project/ProjectStore.ts',
    disposition: 'does-not-apply',
    note:
      '🔴 Still open, and the reason HLS-003 did not simply make the exporter agree and stop. It ' +
      'reads and writes the project files directly. Applying the migration on read would be wrong ' +
      'in a way the exporter\'s settle is not: this store writes back, so a settle here would ' +
      "repair the user's project as a side effect of an agent looking at it."
  },
  {
    file: 'packages/noodl-mcp/src/validate.ts',
    disposition: 'does-not-interpret',
    note: 'Write-gate shape validation (SUB-008). Checks that a parameter is well-formed, never what it means.'
  },
  {
    file: 'packages/noodl-mcp/src/tools/planTools.ts',
    disposition: 'authors',
    note: 'Stages and applies component writes. Its output is what everything else reads.'
  },
  {
    file: 'packages/noodl-mcp/src/renderVerdict.ts',
    disposition: 'does-not-interpret',
    note: 'Reads whether a page was rendered and whether it was clean. Never reads a node parameter.'
  },
  {
    file: 'packages/noodl-mcp/src/lessons/starterWriter.ts',
    disposition: 'authors',
    note: 'UNI-010. Writes the derived lesson starter to disk.'
  },
  {
    file: 'packages/noodl-editor/src/main/src/merge-driver.js',
    disposition: 'applies',
    note:
      'Patches `ours`, `theirs` and the ancestor before merging. Correct rather than merely ' +
      'harmless: the migration is deterministic and idempotent, so all three sides normalise the ' +
      'same way and it can only remove conflicts, never manufacture one.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/versioning/ProjectMerge.ts',
    disposition: 'does-not-interpret',
    note:
      'SUB-007. A three-way merge over the graph engine: it reads parameters to tell whether two ' +
      'sides changed the same one, and never asks what any of them means at runtime.'
  },
  {
    file: 'packages/noodl-git/src/merge-strategy.ts',
    disposition: 'does-not-interpret',
    note: 'Chooses which merge driver a path gets. Reads paths, not graphs.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/validate.ts',
    disposition: 'authors',
    note: 'AIX-002. The editor-side authoring loop\'s write gate — the same policy as `noodl-mcp/src/validate.ts`.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/types.ts',
    disposition: 'authors',
    note: 'AIX-002. The staged-file shapes the authoring loop writes.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/validation/loadV2Project.ts',
    disposition: 'does-not-interpret',
    note: 'SUB-006. Loads a project into the semantic validator\'s normalised model to check its shape.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/models/lessonbundleread.ts',
    disposition: 'does-not-interpret',
    note: 'UNI-010. Reads a lesson bundle\'s files into what the harness grades. Reads no node parameter.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/services/ProjectFileWatcher/decide.ts',
    disposition: 'does-not-interpret',
    note: 'REL-009b. Two pure decisions about which changed path means what. Never opens a graph.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/services/ProjectStructure/types.ts',
    disposition: 'does-not-interpret',
    note: 'SUB-001. The shared v2 structure types. Declarations only.'
  },
  {
    file: 'packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksRecentProjects.ts',
    disposition: 'does-not-interpret',
    note: 'VFN-010. Lists projects for the launcher. Reads names, not graphs.'
  }
];

/**
 * ⚠️ **Superseded as the safeguard by {@link GRAPH_READER_SITES}, and kept for the two entries a
 * file scan cannot express.** Template generation is not a file — it is a set of generators under
 * `noodl-mcp/tests/` whose artefacts are gated by `def038SettledTemplates.test.ts` — and the
 * snapshot path reaches `applyPatches` without touching a graph file.
 */
export const NON_FROMJSON_READERS: readonly Omit<ProjectLoadSite, 'file'>[] = [
  {
    entryPoint: 'Template generation (the artefact)',
    disposition: 'authors',
    note:
      'Not a file, so no scan can reach it: the generators live under `noodl-mcp/tests/` and what ' +
      'ships is their output. Written as JSON and never loaded, which is why phase 78 D14 requires ' +
      'a template to be correct *as written*. ✅ **Closed.** `pinRunOnValueChangeDefaults` states ' +
      'the governed values, and `def038SettledTemplates.test.ts` gates a **derived** population of ' +
      'artefacts rather than a named one — TPL-001 disagreed in 57 stored parameters for the whole ' +
      'time a hand-scoped gate read green, which is the reason that population is derived.'
  },
  {
    entryPoint: 'Version-control snapshot (`snapshotProject.ts`)',
    disposition: 'applies',
    note:
      'Calls `applyPatches` directly on the project JSON; reaches neither `fromJSON` nor a graph ' +
      'file, so neither scan can see it.'
  }
];
