# EL-001 — The project that knows its purpose

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `editor`, `mcp` |
| **Rulings** | **D1** (capability, stamped at creation) · **D4** (starter-assets install route) |
| **Depends on** | nothing; EL-002's kit must exist before the create flow can install it, but the stamp and gating can land first |

## The job

The opt-in seam, end to end:

- An **"eLearning course" card** in the project-creation wizard (behind `experimental.elearning`
  while the phase lands), offering the two templates (EL-003 deck, EL-004 scenario — **equal
  billing**, P3).
- Choosing it: provisions from the chosen template (`embedded://elearning-*`), stamps
  `metadata.projectType = 'elearning'`, and installs the learning kit via the D4 starter-assets
  route — conditional, so ordinary projects don't receive it.
- **One reader**: `isELearningProject(project)` is the only way any feature asks the question.
  The SCORM tab (EL-005), any eLearning panel, and the kit-install step all call it.
- **D1's second door**: a Project Settings control that stamps an *existing* project and points at
  the kit install (the `library/modules/` import route), so "I want a quiz in my existing app" is
  a toggle, not a migration.
- **The MCP door**: `create_project` writes its own v2 skeleton and never touches the editor's
  template registry, so eLearning creation lands **twice or once-shared**. Preferred: lift the
  template content into a shared module (the `editor-deps` / scoping-model precedent), which also
  fixes the existing asymmetry where MCP-created projects skip `installStarterAssets`. If the task
  instead defers MCP parity, it must say so in writing — an AI-created "eLearning project" that is
  silently missing the kit and stamp is the worst outcome.

## The seams (mapped 2026-08-18; verify on arrival)

- Wizard: `noodl-core-ui/.../ProjectCreationWizard/` — note it is **presentational and in another
  package**; the card and any `onConfirm` widening cross the package boundary.
- Funnel: `ProjectsPage.handleCreateProjectConfirm` currently hardcodes `projectTemplate: ''` —
  the template picker does not exist in the product today; this task introduces the first one.
- Provisioning: `LocalProjectsModel.newProject()` already routes a non-empty template URL through
  `templateRegistry.download()`; `installStarterAssets` already runs in exactly the right slot.
- Stamp: `ProjectModel.setMetaData` / `getMetaData` (serialized by `toJSON`; the in-source comment
  "set once at project creation" matches, and the top-level `lesson` / `isLesson()` field is the
  precedent for a project-kind discriminator that features branch on).
- Gate: `EditorSettingsTab.tsx`'s hardcoded experimental-features array.

## Acceptance criteria

1. With `experimental.elearning` off, the wizard is **byte-identical in behaviour** to today; with
   it on, the card appears. (The flag is the phase's landing shield, not a permanent state.)
2. Creating an eLearning project yields: template content on disk, stamp in `project.json`
   metadata, learning kit under `noodl_modules/` — verified on disk, not inferred from the UI.
3. Creating an **ordinary** project on the same build yields none of the three — the P1 control,
   driven, and asserted against the actual file tree (`noodl_modules/` contains `inter` and
   `lucide-icons` and nothing of ours).
4. `isELearningProject()` is the single reader: a grep for the metadata key across the repo finds
   the writer(s) and the helper, nothing else.
5. D1's second door works: an existing ordinary project gains the stamp via Project Settings, and
   the SCORM tab appears without an editor restart.
6. **Build the caller (MCP):** `create_project` produces an eLearning project whose next-door
   `get_project_info` / validation sees the stamp and the kit — or the written deferral exists and
   names the asymmetry.

## Traps

- ⚠️ **The wizard lives in `noodl-core-ui`** — presentational package, no editor imports. The
  card's data (template list, availability) must arrive as props from `ProjectsPage`.
- ⚠️ `STARTER_ASSETS` is today **unconditional** — making part of it conditional must not disturb
  the `inter`/`lucide-icons` copies every project relies on. Never-overwrite semantics are already
  the contract; keep them.
- ⚠️ Embedded templates go through `_adoptV2Format()` after load — the template author writes v1
  `project.json` shape and the converter owns the rest. Assert the round-trip, don't assume it.
- ⚠️ **Metadata vs settings**: the stamp is metadata (set-once semantics); do not additionally
  mirror it into `settings` "for convenience" — two readers of two copies is how vocabularies
  fork. D1's toggle *writes the same metadata key*, it does not introduce a settings twin.
- 🔴 The P66 lesson `opening-a-project-now-writes-three-files`: the create flow already has write
  paths with dirtying consequences; the kit-install step adds files **before first load**, which
  is the safe slot — do not move it later in the sequence.

## Out of scope

- The templates' content (EL-003, EL-004) and the kit's content (EL-002).
- The SCORM tab itself (EL-005) — this task only guarantees the tab's gating question has an
  answer.
- Any un-stamping / "convert back" flow — removing the stamp is manual `project.json` surgery
  until someone demonstrates a need.
