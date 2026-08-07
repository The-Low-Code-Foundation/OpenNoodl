# AIX-012 — As-Built Notes

_Executor: Fable 5, parallel worktree, 2026-07-27. One slice: the whole spec._

Describe an app at the launcher, talk the scope through, and get a documented
project with a plan nobody has run.

---

## What the spec got wrong

**The "Current state" table is stale on the one row that mattered most.**

> | The modal lives in core-ui, previewable in isolation | `…/CreateProjectModal/` |

`CreateProjectModal` is no longer the creation path. `ProjectsPage` renders
`ProjectCreationWizard`, a four-mode wizard, and its first screen —
`EntryModeStep` — **already carried an "AI Project Builder" card, hardcoded
`isDisabled` with a "Coming soon" badge and a `mode: 'ai'` whose step sequence
was a copy of guided mode's**. The spec's §1 warns against shipping the option
"present and silently inert" and cites `IconSize` as the standing reminder; the
inert version had already shipped. That is now the thing this task deleted
rather than the thing it avoided.

Everything else in the table held: `ProjectsPage.tsx:382` really is the creation
call, `projectTemplate: ''` really is unused, AI settings really do live only in
the editor's panel system.

**A second stale premise, in §5.** The spec says `ProjectStore` "currently
requires an existing v2 project directory … creation is a genuinely new
capability there". True, and worse than stated: `createServer` constructs the
store *before registering any tool*, so `create_project` can never operate on
the server's own directory. It necessarily creates a project somewhere else, and
takes the target directory as an argument. That is not a workaround — it is the
right shape for "Claude Code, start me a new project over there".

---

## What shipped

| Piece | Where | Role |
|---|---|---|
| The scope model | `models/AiAssistant/scoping/scope.ts` | THE vocabulary: `ProjectScope`, `mergeScope`, `planFromScope`, and the four document renderers. Pure — no `AiClient`, no filesystem, no `ProjectModel` — and imported verbatim by `noodl-mcp` |
| The conversation | `scoping/ScopingSession.ts` + `scoping/prompts.ts` | Turn-by-turn dialogue; one tool (`record_scope`); the scope is complete after every turn |
| The disk half | `scoping/scopeDocs.ts` | Writes the four documents through AIX-009's `ProjectDocsModel` (atomic, contained, drift-checked). Collects failures rather than throwing |
| The handover | `scoping/pendingPlan.ts` | Module state across the launcher→editor navigation, mirroring `setPendingPresetId` |
| Entry card | `core-ui/…/steps/EntryModeStep.tsx` | "Start with AI", gated on real availability; when unavailable it states the reason and offers the route |
| The step | `core-ui/…/steps/ScopingStep.tsx` | Presentational chat. Owns a draft string and nothing else |
| Review | `core-ui/…/steps/ReviewStep.tsx` | The agreed scope and the plan, listed before creation, labelled "not started" |
| Wiring | `pages/ProjectsPage/ProjectsPage.tsx` | Owns the session; availability; the settings dialog; docs after `newProject` |
| MCP parity | `noodl-mcp/src/tools/createProject.ts` (+2 additive lines in `server.ts`) | `create_project`: v2 skeleton + the same four documents + a validated plan, returned unrun |

Specs: `packages/noodl-editor/tests/ai/project-scoping.test.ts` (+27, registered
in `tests/ai/index.ts` — the spec-barrel trap), two more in
`tests/models/ProjectCreationWizard.test.ts`, and
`noodl-mcp/tests/createProject.test.ts` (+7, jest). Editor total 1573 → 1602.

---

## The properties that must not break — and how they are enforced

### "It is not allowed to build"

Not a prompt line. Three structural facts, each spec-asserted:

1. **`ProjectScope` cannot express a graph.** It has a summary, an audience,
   objects, pages, out-of-scope items, a backend sentence, conventions,
   rejections and open questions. There is no field that can hold a node, a
   connection, a port or a parameter. A spec greps `record_scope`'s JSON schema
   for `"nodes"`, `"connections"`, `"ports"`, `"parameters"` and
   `"visual_roots"` and fails if any appears — so widening the schema toward a
   graph fails here rather than in production.
2. **`ScopingSession` has no call path to a write.** It imports `AiClient`, its
   prompts and `scope.ts`. Not `AuthoringSession`, not `PlanRun`, not
   `staging`, not `planStaging`, not `candidate`, not `ProjectModel`. A model
   that calls `submit_component` gets "there is no such tool here, nothing can
   be built" and the turn continues — asserted.
3. **The plan is a function of the agreed pages.** `planFromScope` walks
   `scope.pages`; there is no path by which an operation for a page nobody
   agreed to can appear. That is the same move AIX-011 made with "no
   per-operation apply exists".

### "Exitable at any point"

- The AI step sequence is `basics → preset → scoping → review`. Name, folder and
  preset are collected **before** the conversation, which is what makes leaving
  it unconditional: from the first word of scoping onward, everything creation
  needs is already in hand.
- `isStepValid('scoping')` is `true`, always. Gating Continue on "the assistant
  says the scope is agreed" would turn a conversation into a form you cannot
  leave — the named risk.
- The scope is a plain value updated after every `record_scope`, and there is no
  "finish" call whose absence discards it. Abandoning is the absence of a
  further `send()`.
- A scope with no agreement still produces the project and all four documents,
  and `renderScopeRecord` says so in the file: *"This conversation was ended
  before a scope was agreed … nothing here was inferred to fill the gaps."*

### "No second creation path"

`handleCreateProjectConfirm` calls `LocalProjectsModel.newProject` with the same
arguments a blank project uses. Everything AIX-012 adds happens in
`finishScopedProject`, **after** the callback fires with a project — it writes
files into a folder that already exists. The no-Home regression lives inside
`newProject`/`EmbeddedTemplateProvider` and is untouched by anything here.

The MCP side cannot reuse that path (no Electron, no `ProjectModel`), so it is
the one place a skeleton is written from scratch — and
`project-v2.schema.json`'s own description names the trap: *"Without it the
export produces nothing and the app renders blank, so a tool authoring a project
from scratch must set it"*. `writeProjectSkeleton` sets `rootNodeId` to the
Router node's id, and a spec reads the file back and asserts the id names a node
that actually exists in `/App`.

---

## Decisions worth keeping

- **The documents are written at creation, not by the plan.** `planFromScope`
  emits **no `doc` operations**, deliberately. AIX-011's `DocSession` exists to
  author a doc body when nobody wrote one; here a human just agreed the contents
  minutes ago, and sending an agent to re-author `BRIEF.md` from that would turn
  a record of a conversation into a summary of a summary. The plan's operations
  are pages, full stop.

- **`> TODO:` everywhere something was not agreed.** Inherited from AIX-010, and
  applied to every heading in all four documents: no audience, no out-of-scope
  list, no data model, no conventions — each renders a marked TODO rather than a
  plausible sentence. `renderBrief` on a thin scope contains `> TODO:` and does
  **not** contain invented prose; asserted. Confident invented scope is this
  feature's failure mode and the cheapest place to stop it is the renderer.

- **CONVENTIONS.md is the template plus an attributed section.** The spec says
  it "is not invented wholesale". The template ships verbatim — including its
  visibly-marked `(example)` rules — and the rules the conversation actually
  established go in `## Established during scoping` with a pointer back to the
  record. A reader can always tell a rule someone chose from a rule a starter
  file shipped with.

- **What was rejected is above the fold.** In `000-initial-scope.md` the order
  is: what was asked → what was decided → **what was considered and rejected** →
  what is open → the plan → the transcript. The rejected section is the part
  with the longest shelf life and the part a summary would drop first, so it
  sits above a transcript that is allowed to be long.

- **Whole-field replacement in `mergeScope`.** Same contract as every other
  candidate in this phase. Element-wise merging would make "we dropped the
  Shelves page" inexpressible, and dropping things is exactly what a scoping
  conversation must be able to do — spec-asserted with a two-turn script that
  adds Shelves and then removes it, recording the rejection.

- **The launcher's route to AI settings is the real settings section in a
  dialog.** `AiSettingsSection` is the editor's own component writing the
  editor's own `EditorSettings`, so configuring at the launcher configures
  everywhere. A launcher-local copy of the credentials form would be a second
  source of truth for API keys, which is the last thing that should have two.
  Availability is re-read when the dialog closes, so the card updates without
  reopening the wizard.

- **Editor and MCP share the model, not the executor** — AIX-011's rule, applied
  again. The editor's executor is a conversation with a human; MCP's caller *is*
  the agent and hands over a scope it already agreed. `scope.ts` — the shape,
  the plan derivation, all four renderers — is one module, imported by relative
  path per the `editor-deps` pattern. A spec asserts byte parity between the
  three deterministic documents the MCP tool writes and the ones the editor
  renderers produce from the same scope.

- **`create_project` refuses a non-empty directory.** There is no undo out
  there, and creating a project over someone's files is how a tool call loses
  work. The spec asserts the refusal and that the user's file is still the only
  thing in the folder afterwards.

---

## Defects and traps found

1. **The inert AI card had already shipped** — see "What the spec got wrong".
   It was reachable in the launcher, permanently disabled, with a badge that
   could not be acted on.

2. **`noodl-core-ui`'s typecheck project includes `ProjectsPage.tsx`** (it
   imports the launcher preview) **and does not carry the editor's path
   aliases.** Importing `@noodl-store/AiAssistantStore` added exactly one new
   `TS2307` to `npm run typecheck:core-ui` while `tsc -p packages/noodl-editor`
   stayed clean. The import is relative now, with a comment saying why. Anyone
   adding an editor-alias import to a file under `pages/ProjectsPage/` will hit
   this; the editor's own typecheck will not warn them.

3. **The `tsfixme` ratchet caught two `TSFixme`s** in the first draft of
   `ProjectsPage` (the project handed to the creation callback, and the
   component list). Both were knowable — `ProjectModel` and `ComponentModel` —
   and are typed. Worth recording that `newProject`'s callback parameter is
   still untyped upstream, so `TSFixme` there is *tempting* and unnecessary.

4. **An existing spec asserted the inert AI mode as correct behaviour.**
   `tests/models/ProjectCreationWizard.test.ts` had
   `it('ai mode uses same sequence as guided (V1 stub)')`. It did its job — it
   failed the moment the sequence became real — and is now updated to assert the
   scoping step, plus two new specs pinning the properties the ordering exists
   for: that `basics` and `preset` both precede `scoping`, and that
   `isStepValid('scoping')` is unconditionally true.

5. **The editor suite is red at the base commit in this worktree: 14 failures.**
   Proved by stashing the whole diff, rebuilding the test-CI bundle and running
   it: **1573 specs / 14 failures**, and the 14 are name-for-name the same 14
   that appear alongside this diff. They are:
   - 4 × `Project import and export unit tests` and 6 × `LIB-005 import apply
     path`, all `TypeError: invalid options argument` — one shared cause in the
     import path, untouched here;
   - 4 × Git merge/conflict specs — the known seed-dependent flake class, plus
     non-fast-forward push errors against throwaway fixture repos.

6. **A worktree has no `packages/node_modules`, and the editor resolves `dugite`
   through it.** Every Git spec fails with *"Git could not be found at the
   expected path: …/packages/node_modules/dugite/git/bin/git"* until that
   directory exists. Symlinking the main checkout's
   (`ln -s <root>/packages/node_modules <worktree>/packages/node_modules`) took
   the run from ~60 reachable specs to the full 1573. Worth knowing before
   concluding a worktree's suite is catastrophically broken. Not committed — it
   is a local build artefact.

7. **The Electron runner can exit 0 without finishing.** One run died after four
   specs with `GPU process exited unexpectedly` and still reported exit 0; the
   `Jasmine: N specs, M failures` line, not the exit code, is the signal. Re-run
   and check for that line.

8. **The worktree this agent was given was branched from `360cdc46`** — the
   pre-fork upstream OpenNoodl commit, ~300 commits behind — not from the
   `cline-dev` tip. `dev-docs/tasks/phase-15-ai-collaboration/` did not exist.
   Reset to `4d1d1294` before any work. This is the second time the parallel
   worktree trap has been paid for; checking `git log --oneline -1` against the
   expected base should be step zero.

---

## Verified

| Gate | Result |
|---|---|
| `tsc -p packages/noodl-editor` | clean |
| `npm run typecheck:editor-tests` | clean |
| `npm run typecheck:core-ui` | **byte-identical error list to the base commit** (73 pre-existing errors, all in `noodl-viewer-react`/`noodl-runtime`; proved by stashing the diff and diffing the two error lists) |
| `noodl-mcp` `tsc --noEmit` | `src/` clean; 18 pre-existing errors in `tests/*.test.ts` (jest matchers vs leaked jasmine types) — the same 18 AIX-011 recorded |
| `noodl-mcp` jest, node 22.22 | **65 passed / 0 failures**, 29 env-gated skips. Baseline without this diff: 58 passed. The 29 skips are `backendTools`, gated on `packages/nodegx-backend/dist/cli.js` which is not built in this worktree — not a regression |
| `noodl-mcp` `node build.mjs` | green; `scope.ts` bundles into the standalone artifact (3.8 MB) |
| `webpack.test-ci.js` build | green (one pre-existing `canvas` resolution warning from `blockly`) |
| Editor Electron suite | **1602 specs / 14 failures** (seed 56977). Base commit, same bundle recipe, same worktree: **1573 specs / 14 failures** (seed 65956). The two `FAILED:` lists are **byte-identical** — this diff adds 29 specs and no failures |
| `npm run colors` | 16/16, holding |
| `npm run lint:ci` | green |
| `npm run tsfixme` | 540/336/17/0/79, holding on every marker |

---

## Residuals

**Needs a live provider** (nothing on these paths is asserted by the offline specs):

1. **The conversation's quality.** Every spec here drives a script. Whether a
   real model asks one question at a time, proposes instead of interrogating,
   actually pushes back on nine pages, and reliably calls `record_scope` after
   every exchange is unmeasured. The last of those is the one that matters most:
   the "exitable at any point" guarantee is only as good as the model's
   discipline about recording, and the prompt leans on it hard.
2. **Whether the model tries to build anyway.** The refusal path is asserted;
   how often it fires is not.
3. **Acceptance criterion 1 end-to-end** — "a reading list app where I track
   books and mark them finished" producing a Book data model. The mechanical
   half (documents at the four paths, a plan with one operation per agreed page,
   no components authored) is asserted; the *content* is the model's.
4. **Cost.** Scoping runs at effort `low` and is never measured. A conversation
   is many small turns and could plausibly cost more than one authoring turn.

**Needs a running editor / launcher** (worktree agents cannot drive it — `lerna
exec` runs the main checkout):

5. **The whole launcher flow**, once: entry card enabled and disabled, the
   settings dialog, the conversation, Continue mid-conversation, the review
   step's plan list, and the created project opening with a Home component and
   the chosen preset (criterion 3's live half — the mechanical half is that
   `newProject` is called unchanged).
6. **The `AiSettingsSection`-in-a-dialog styling.** It is a `CollapsableSection`
   built for a 380px side panel, rendered here in a 420px dialog. It should be
   fine and has not been looked at.

**Owned follow-up, and the one place this task stops short:**

7. **Nothing consumes `takePendingScopePlan()` yet.** The editor-side review UI
   for a plan is `views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx`, which
   is AIX-010's territory this wave and off limits. The consequence is bounded
   and deliberate rather than an inert feature: the plan is **also written into
   `docs/decisions/000-initial-scope.md`** under `## Proposed build plan`, and
   **shown in the wizard's review step** before creation — so a user who scopes
   a project can see the plan, keep it, and act on it without the panel. The
   module-state seam is the fast path, not the only path.

   The wiring is one hook in `AiAuthoringPanel`, on mount:

   ```ts
   const pending = takePendingScopePlan(ProjectModel.instance.id);
   if (pending) setScope('project'), setPlan(pending.plan);
   ```

   Whoever owns that panel next should add it; until then
   `takePendingScopePlan` is called only by specs, which is stated here rather
   than hidden.

8. **Criterion 6** (`docs/` never deploys) is DEP-008's interlock, not this
   task's. There is a spec for it in the editor suite already
   (`DEP-008 criterion 7 — the AIX-009 interlock`), and every document this task
   writes lands under `docs/`, so it inherits the guarantee rather than needing
   a new one. Not re-asserted here.

9. **Criterion 5's second half.** The mechanical half is asserted: the
   `CONVENTIONS.md` written at creation is read back through
   `ProjectDocsModel.content()` and handed to `AuthoringContextBuilder`, whose
   `projectConventions()` handout contains the rule the conversation agreed.
   Whether an executed plan's *components* then honour that rule is a live-model
   question, and is the AIX-011 residual it inherits.

10. **The review step's plan preview can disagree with the record** on exactly
    one thing: create-vs-update for a page named "Home". The preview uses a
    constant (`NEW_PROJECT_COMPONENTS`) because it renders before the project
    exists; the record and the handover are re-derived from the created
    project's real component list. If the embedded template changes, the preview
    is the one that goes stale, and the record is the one that counts.
