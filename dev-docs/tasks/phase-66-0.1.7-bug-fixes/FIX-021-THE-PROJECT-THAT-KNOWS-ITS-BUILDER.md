# FIX-021 — The project that knows its builder

**Report 16** · Tier: **brainstorm + two small slices** · Effort **S** (slice A) + **M** (slice B); the loop is the open design

> *"Why don't we have a CLAUDE.md file at the level of each individual project, and a global
> CLAUDE.md file at the editor level?"*

## What already exists — more than the report assumes

- **Every project already gets a `CLAUDE.md`** (BST-005, both creation paths) — but it is a
  test-enforced **signpost, not a memory**: `agentConfig.ts:134-143` forbids it restating the
  server briefing, nothing in the product ever reads it back, and it is never overwritten
  ("the user's to own").
- **The project-docs substrate is unusually complete:** `docs/` with BRIEF / ARCHITECTURE /
  CONVENTIONS / `decisions/`, arbitrary user docs with per-file front matter
  (`inject: always|pull`, `when:` hints), caps, atomic writes, a 2s external-edit poll (editing
  in VS Code changes the next build live), the DocsPanel UI with per-turn token-cost disclosure,
  and MCP tools (`list_project_docs` / `get_project_doc` / `write_project_doc`) — *"Claude Code
  and the editor are equally well briefed rather than one being a second-class citizen."*
- The internal AI injects BRIEF + CONVENTIONS + every `inject: always` doc each turn, with a
  precedence ladder already stated ("a project rule beats your habit").
- **What does NOT exist, anywhere:** any global user-scoped document; any user profile
  (experience level, Function-vs-Visual-Function preference, deploy target, go-to backend —
  stored nowhere); any write-back loop that distils a session into a doc. `DocProposalStore`
  stages AI doc edits as accept/reject diffs — and its header carries the standing
  counter-argument this task must engage head-on: *"An assistant that rewrites ARCHITECTURE.md
  after every component lands produces changelog sludge nobody reads and, within a fortnight,
  nobody trusts."*

## 🔴 A concrete defect to fix regardless of the brainstorm (slice 0, S)

A project scoped by the **launcher wizard** gets a `CLAUDE.md` with **no summary and no mention of
`docs/`** — `LocalProjectsModel.writeAgentConfigFor` passes no `hasDocs`/`summary`, and the wizard
writes `docs/` *afterwards*. The MCP-created twin gets both. This violates BST-005's own
acceptance ("same two files, same content shape"). Fix the ordering or re-render after the docs
land. (Pairs naturally with FIX-008's backfill-on-open.)

## Slice A — project-level memory (~zero new machinery, S)

A `docs/LEARNINGS.md` (or preferences doc) is *already expressible today*: created from
`newDocTemplate` in the DocsPanel, `inject: always` front matter, picked up by
`projectAlwaysDocs()`, listed to Claude Code by `list_project_docs`, pointed at by one new line in
`renderClaudeMd`'s "Where the decisions are" bullets. The only new work: seed it at creation,
and decide who updates it.

## Slice B — the global doc (genuinely new, M)

`<userData>/PREFERENCES.md` (a real markdown file — the doc *is* the UI, plus an "Open
preferences" button in settings): seeded from a question-template; a `currentGlobalPrefs.ts`
provider mirroring `currentDocs.ts` exactly; a capped (~2k chars) `globalPreferences()` handout
appended **last** in the reference blocks (cache-tail-only, absent-means-omitted — the
`bld-011/cacheSafety` discipline); a precedence sentence: **global ranks below project
conventions, above model defaults**. MCP reads it via the path baked into `.mcp.json` `env` at
registration (the BST-004 "front door, never guess" pattern) — ⚠️ this deliberately breaks the
server's every-path-inside-projectDir invariant and needs its own read-only containment note.

## The brainstorm — six questions that decide the product

1. **Who writes updates, when?** End-of-session distillation via `DocProposalStore` diffs / a
   user-triggered "remember this" affordance / human-authored only. Each is a different product;
   the DocProposals sludge argument must be answered, not sidestepped.
2. **One file or a set?** NodeGX already has BRIEF/ARCHITECTURE/CONVENTIONS/decisions — where does
   "learnings" not overlap CONVENTIONS? Two overlapping taxonomies = two sources of truth, the
   exact failure the docs tooling warns about. Possibly the answer is *no new project doc*, just
   better seeding + prompting into CONVENTIONS.
3. **Does `CLAUDE.md` become the memory or stay the signpost?** Memory-in-`docs/` keeps one
   system and Claude Code auto-loads CLAUDE.md pointing at it; making CLAUDE.md itself the memory
   conflicts with never-overwrite and needs a reader.
4. **Privacy and the shared-repo boundary:** `docs/` is committed — "I prefer Visual Functions"
   is about *me*, not the project. Does a third scope exist: `.nodegx/preferences.md`
   (gitignored, per-user, per-project)?
5. **`always` vs `pull` cost:** a global always-doc is a per-turn cost on every project forever;
   `when:` hints are hard to write for preferences. Cap and placement?
6. **Structured settings vs prose:** deploy target / go-to backend map onto real settings
   (`ai.role.*` keys are precedent) the product can *act on*; keep the prose doc only for what a
   model must interpret. This split sharply shrinks the doc and makes it defensible.

## Acceptance for this task

1. Slice 0 fixed: launcher-scoped and MCP-scoped projects produce byte-equivalent-shape
   `CLAUDE.md`s (the BST-005 acceptance re-verified).
2. The six rulings recorded with rejected options named; slices A/B built only as ruled.
3. If slice B ships: a fresh project's Build-panel opening turn shows the global block **last**,
   absent when the file is empty (cache-safety spec extended, not weakened).


## Slice 0 — CLOSED (2026-08-16, session 34, `00f5c629`)

The defect reproduced exactly as described: `LocalProjectsModel.writeAgentConfigFor` passes no
`hasDocs`/`summary`, and `ProjectsPage.finishScopedProject` writes `docs/` afterwards — deliberately,
because *"a failure here costs the docs, never the project."* So the launcher's `CLAUDE.md` went out
with **no summary and no "Where the decisions are" section** while the `create_project` twin got both.

✅ **Fixed by re-rendering after the docs land, not by reordering** — the ordering is deliberate and
worth keeping. `upgradeAgentConfigForDocs` re-renders the *as-created* variant (`hasDocs: false`, no
summary) and rewrites **only when the bytes on disk match it exactly**.

⚠️ **That guard is the interesting half.** `CLAUDE.md` is *"the user's to own"* — the rule that makes
`installAgentConfig` never rewrite one, and it is right. A template's own `CLAUDE.md`, a user edit of
a **single character**, or any future change to the template is left alone and reported
`kept-existing`. The only file this can replace is one it can prove it wrote.

7 specs in the shared MCP suite, including the acceptance criterion **as a byte equality** — after
the upgrade the launcher's file and the `create_project` twin's file are the same bytes — plus the
single-character-edit negative control, idempotence, and that `.mcp.json` is not reconsidered.

🔴 **Slices A and B, and the six memory rulings, are untouched.** This was the *"concrete defect to
fix regardless of the brainstorm"*, and only that.


## Slice 0 — DRIVEN (2026-08-16, session 42, dev stack)

Built at s34 with 7 specs; never run in the app until now. **Acceptance criterion 1 closes on the
real product**, not only in the suite.

The drive was the actual launcher wizard, start to finish: *New project* → **Start with AI** → name +
location → preset → **one real scoping turn against the configured provider** (a reading-list app;
the model came back with a summary, one page and one record) → Continue → **Create project**.

| project | how it was made | `# summary` line | `## Where the decisions are` | bytes |
|---|---|---|---|---|
| `fix021-drive-ai` | launcher, **AI mode** | ✅ the scoped summary | ✅ | **1401** |
| `fix021-drive-ai` (twin) | **`create_project`** (MCP) | ✅ same | ✅ | **1401** |
| `fix021-drive-plain` | launcher, **Quick Start** | — | — | 963 |

✅ **`diff` of the launcher's file against the MCP twin: identical bytes.** Same project name, same
summary handed to both paths — which is the criterion as written (*"the same two files, same content
shape"*), measured on disk rather than through the installer's own test host.

✅ **The control is the third row and it separates.** A Quick Start project writes no `docs/`, so
`result.written.length > 0` is false, the upgrade never runs, and its `CLAUDE.md` has **neither**
block. Had that file also carried them, the drive would have measured nothing — the two blocks would
have been coming from somewhere other than slice 0.

⚠️ **What this drive does *not* cover.** The `kept-existing` guard — the interesting half — was never
exercised, because a freshly created project's `CLAUDE.md` is by construction the one the installer
just wrote. The user-edit and template-`CLAUDE.md` refusals remain **spec-only**. Driving them means
editing the file in the window between creation and `writeScopeDocs` returning, which is a few hundred
milliseconds; a fixture-level drive of `upgradeAgentConfigForDocs` against a doctored file is the
cheaper instrument if anyone wants it covered.

### 🔴 Incidental, and not FIX-021's — the wizard has no default location

Found while driving, verified in code and in the app: `ProjectCreationWizard` is rendered with **no
`initialState`** (`ProjectsPage.tsx:1278-1286`), `WizardProvider` defaults `location: ''`
(`WizardContext.tsx:116-124`), and the Location field is `isReadonly`
(`ProjectBasicsStep.tsx:63-70`) — so it can only be filled by **`Browse…` and a native folder
dialog**. Measured: with a name typed and no location, **`Next` is disabled**
(`isStepValid('basics')` requires `location.length > 0`); it enabled the instant a location was set.

⚠️ **`LocalProjectsModel.newProject` already has the fallback** — `platform.getDocumentsPath() + name`
(`LocalProjectsModel.ts:300`) — and the wizard can never reach it, because the wizard always supplies
`path`. So every new project in every mode costs a native dialog that a sensible default would spare.
**Not fixed here** (it is a change to the creation UI, outside this task's scope) — wants its own
task, or a ruling that the explicit choice is deliberate.

## ✅ RULED 2026-08-16 (session 42)

**The wizard's missing default location → (B), last-used.** Seed `location` from the last folder the
user chose, falling back to `platform.getDocumentsPath()` on first run; `Browse…` still overrides.
Rejected: **(a)** documents-always (ignores where this user actually keeps projects) and **(c)**
deliberate-every-time (the friction teaches nothing).

**Slices A/B → GREEN, and the shape is a USER PROFILE, not project learnings.** Richard: *"I want a
NodeGX user profile for the AI to use, even stuff like 'the user speaks casually but avoids swear
words' or 'User isn't comfortable with pure javascript and we should prefer inbuilt nodes'."*

That settles three of the six brainstorm questions at once:

- **Q4 (privacy / shared-repo boundary)** — it is about the **person**, not the project, so it does
  **not** go in committed `docs/`. The third scope the question floated is the answer: **per-user and
  gitignored**.
- **Q3 (does `CLAUDE.md` become the memory?)** — no. It stays the **signpost**; the profile is a
  separate document, which keeps the never-overwrite rule intact.
- **Q1 (who writes updates?)** — seeded and human-authored to begin with. The automatic write-back
  loop stays a later question, and `DocProposalStore`'s changelog-sludge argument still stands
  against distilling every session.

🔴 **Still open: Q2** (one file or a set — where does this not overlap CONVENTIONS?), **Q5** (`always`
vs `pull`, and the per-turn cost of a global always-doc), **Q6** (structured settings vs prose — the
split that makes the doc defensible).

⚠️ **Note the coupling, because it decides where a rule lives.** Richard's own example —
*"prefer inbuilt nodes"* — is **FIX-006's ruling**. A preference like that belongs in the profile,
where this user can change it, rather than hard-coded into the system prompt for everybody.

## ✅ BUILT 2026-08-16 (session 44) — the wizard's default location

Ruling (B) built. Three files, one of them new:

| file | what changed |
|---|---|
| `pages/ProjectsPage/projectLocationMemory.ts` | **new.** `LAST_PROJECT_LOCATION_KEY` (`projects.lastCreateLocation`) and `pickProjectLocation` — the whole rule, and nothing else |
| `ProjectsPage.tsx` | writes the key in `handleChooseLocation`; reads it into `initialWizardLocation`, re-derived every time the modal opens |
| `ProjectCreationWizard.tsx` | new `initialLocation` prop → `WizardProvider`'s `initialState` |

**The rule module imports nothing.** That is what makes it gradeable: `tests-unit` is a plain-Node
runner and can reach neither `EditorSettings` nor `@noodl/platform`, so the three things the reader
needs — the remembered value, `platform.getDocumentsPath()`, and `filesystem.exists` — are passed in
by `ProjectsPage`, which already imports all three.

🔴 **The guard is the part worth keeping: a remembered folder that no longer exists must not be
seeded.** `isStepValid('basics')` checks only `location.length > 0`, so a path on a volume that has
since been unmounted would **enable `Next`** and then fail at creation — later, and naming a folder
the user never typed. The invariant the module holds is **"either the empty string, or a folder that
exists"**, and empty is exactly the field the wizard had before.

⚠️ **Recorded on Browse, not on Create.** That is the moment the user chose a folder; abandoning the
wizard afterwards does not make the choice less real, and a creation that failed is precisely when
they will be back.

### Gates, taken at session 44 on a checkout carrying peers' uncommitted work

| gate | reading |
|---|---|
| `noodl-editor` `test:main` | ✅ **221 suites / 3403 tests, 0 failed** (s43: 220 / 3396 — the delta is exactly this task's one suite and seven tests) |
| `noodl-core-ui` jest | ✅ 25 suites / 444 tests |
| `typecheck:core-ui` | 44 errors, **none in any file this task touches**, and `--listFiles` confirms all three *are* in the compile |
| `lint:ci` ratchet | ✅ exit 0 — 876 errors against a 3916 baseline |

**`test:ci` not run, as a claim rather than an omission:** two `.ts`/`.tsx` files under `src/`, one
new `.ts`, one `tests-unit` spec. No `.jsx`, nothing under `packages/noodl-editor/tests/`. The
jasmine suite's `ProjectCreationWizard.test.ts` imports `WizardContext` only — `getStepSequence` and
`isStepValid` are untouched, and the component file is not in that bundle. ⚠️ A peer was launching an
editor throughout, which reaps a running `test:ci` anyway.

### ✅ The spec was checked against two mutants, because green is not a measurement

`tests-unit/fix-021/projectLocationMemory.spec.ts` — 7 tests. Each mutant was applied to the real
module and reverted inside a single shell call; the file was diffed back to byte-identical after.

| mutant | what it models | result |
|---|---|---|
| drop the `remembered` branch | the seed that ignores the memory — always documents | **1 failed, 6 passed** — only *"prefers the remembered folder"* dies |
| drop `&& exists(remembered)` | the seed with no guard, i.e. the version I would have written without thinking about unmounted volumes | **3 failed, 4 passed** — the gone-folder row, the empty-result row **and the matrix invariant** |

The second is the one that matters: the guard is not merely asserted somewhere, it is asserted by a
row that fails when it is removed. The matrix test walks 7 × 3 × 4 combinations rather than the cases
that happened to occur to me, and it is what catches the guard being removed *somewhere I did not
write a named row for*.

### ✅ DRIVEN 3/3 (session 44, `npm run dev:debug`, launcher only)

Predictions written before the drive; all three read out of the **rendered panel**, from
`[class*=ProjectBasicsStep-module]`, on *New project → Quick Start*.

| arm | `projects.lastCreateLocation` | Location field | |
|---|---|---|---|
| **A** first run | **absent** (the real state of this profile) | `/Users/richardosborne/Documents` | ✅ the fallback reaches the field |
| **B** remembered | `/Users/richardosborne/vscode_projects` | `/Users/richardosborne/vscode_projects` | ✅ and it **differs from A**, so the pair separates |
| **C** control | `/Volumes/an-ejected-disk/projects` (verified absent) | `/Users/richardosborne/Documents` | 🔴 **the guard, driven** |

🔴 **Arm C is the row worth having.** The existence check is the half `pickProjectLocation`'s spec can
only assert against an injected `exists`; here it ran against the real `filesystem.exists` in the real
renderer, and the dead path was refused. ✅ **And A vs B is what makes A meaningful** — had both shown
Documents, the drive would have proved only that *something* fills the field.

⚠️ **The write half is still undriven.** `handleChooseLocation` records the folder, and reaching it
needs the native folder dialog, which CDP cannot drive (the trap this task recorded at s42). Each arm
was set by writing the key into `editorSettings.json` and reloading — the same value by the same key,
but **not** the same code path. So *"Browse records what you chose"* remains spec-level.

⚠️ **Instrument note, and it would have produced a confident false negative.** A readonly `TextInput`
renders as a **`<div>`**, not an `<input>` — `TextInput-module__is-div`. My first reading queried
`document.querySelectorAll('input')`, found only the launcher's search box, and looked exactly like a
Location field that had not rendered at all. **Read the rendered text of the row, never the input
list.**

⚠️ `~/Library/Application Support/NodeGX/editorSettings.json` is Richard's live settings file. It was
backed up before the first write and restored **byte-identical** afterwards, verified with `diff`;
the key is absent again, which is where it started.

### ⚠️ Incidental — a dead fallback that would be wrong if it ever woke up

`LocalProjectsModel.ts:300` builds its no-`path` fallback as `platform.getDocumentsPath() + name` —
**string concatenation, no separator**, and unlike `getTempPath`/`getAppPath` the electron platform
does **not** put a trailing slash on `_documentsPath` (`platform-electron.ts:29-31`). So that branch
would produce `…/Documentsmyproject`. It is unreachable: `ProjectsPage` is the only caller and it
always passes `path`. **Left alone** — but this task now makes the documents folder the *usual*
answer, so anyone who deletes the wizard's `path` argument as redundant will land straight on it.

## ✅ BUILT 2026-08-18 (session 58) — slice B, the global user profile

`<userData>/PREFERENCES.md`: one markdown file per person, per machine, read before the AI builds
anything, in every project. Richard's s42 ruling is the whole shape — *"a NodeGX user profile for the
AI to use"* — and the three questions that ruling settled (Q1 human-authored, Q3 `CLAUDE.md` stays
the signpost, Q4 per-user and outside git) are the three this build leans on.

| file | what it is |
|---|---|
| `models/UserProfile/profileText.ts` | **new.** The format: template, cap, section parsing, rendering. Imports **one** function |
| `models/UserProfile/currentProfile.ts` | **new.** The synchronous provider seam — a carbon copy of `ProjectDocs/currentDocs`, for the identical reason |
| `models/UserProfile/install.ts` | **new.** The only part that touches a disk: path, seeding, and the poll |
| `models/UserProfile/index.ts` | **new.** Barrel, carrying the same "headless consumers import the submodule" warning as `ProjectDocs` |
| `SettingsPanel/sections/UserProfileSection.tsx` | **new.** "About you" — where the file is, what it is costing, and a button that opens it |
| `prompts/authoring.ts` | `globalPreferencesBlock`, appended **last** in `referenceBlocks`, carrying the precedence sentence |
| `ContextBuilder.ts` | `globalPreferences()`, charged under its own `user-profile` source |
| `AuthoringSession.ts` | resolves the provider once per session, exactly as it resolves `projectDocs` |
| `EditorSettingsTab.tsx` / `router.setup.ts` | the section, and the boot install beside `installProjectDocs()` |

### 🔴 The empty-file rule is the build, and it is what makes the feature defensible

A global always-doc is a charge on **every turn of every project, forever** — the objection Q5 raises
and the one thing that could make this feature a tax rather than a convenience. The answer built here
is mechanical rather than a policy:

- **Guidance lives in HTML comments,** which are stripped before anything is sent. They render as
  nothing in a markdown preview and they are unambiguously *not* the user's answer, so no heuristic
  has to guess which lines are the form and which are the reply.
- **A heading with nothing under it is dropped.** You pay for the words you wrote and for no others.
- **A file that says nothing renders `undefined`,** and the block is omitted entirely.

So a freshly seeded `PREFERENCES.md` — headings, prompts and all — costs **zero prompt bytes**, and a
user who never opens the settings section sends turns byte-identical to before this shipped. The
settings panel prints the number that goes out, beside the button that changes it: a user who cannot
see the cost cannot consent to it.

⚠️ **Prose written above the first heading is kept, unheaded.** Somebody who ignores the four prompts
and writes a paragraph must not have it silently discarded; that is the one failure a format like
this cannot have.

### The three open brainstorm questions — answered as assumptions, and overturnable

🔴 **Richard has not ruled Q2, Q5 or Q6.** Slice B is built on the reading below, and each is a
sentence to overturn rather than a rewrite.

- **Q5 (`always` vs `pull`, and the cost) → `always`, capped at 2,000 characters, and free when
  empty.** `when:` hints are unwritable for preferences (there is no request-shaped trigger for
  *"I speak casually"*), so `pull` would mean the profile arrives only when the model thinks to ask,
  which is the same as not having one. The cost objection is answered by the empty-file rule above
  instead. Cap is deliberately a third of `DEFAULT_DOC_CAP`: a project doc is about a body of work
  and earns its bytes; this rides along on everything.
- **Q6 (structured settings vs prose) → prose only, for now.** Richard's own examples are both
  interpretation, not action — *"speaks casually but avoids swear words"*, *"isn't comfortable with
  pure javascript"*. **Rejected:** splitting deploy-target and go-to-backend into `ai.role.*`-style
  keys *in this slice*. That split is right eventually and it shrinks the doc, but it needs a second
  UI and a second precedence story, and building it before anyone has written a profile is guessing
  at which fields matter.
- **Q2 (one file or a set) → ONE file, and NO second project-level document.** This is the one that
  changed what got built: **slice A is deliberately NOT built.** A per-project `.nodegx/preferences.md`
  alongside `docs/CONVENTIONS.md` is two overlapping taxonomies and two sources of truth — the exact
  failure the docs tooling warns about — and nothing in the s42 ruling asks for it. A per-project
  rule already has a home; what had no home was the person.

### Gates, taken at session 58

| gate | reading |
|---|---|
| `noodl-editor` `test:main` (jest) | ✅ **239 suites / 3658 tests, 0 failed** |
| `tests-unit/fix-021/` | ✅ **3 suites / 28 tests** (7 inherited + 21 new) |
| `typecheck:editor` | ✅ exit 0 — and `--listFiles` confirms all five new files **are** in the compile |
| `typecheck:editor-tests` | ✅ exit 0 |
| root `npm run typecheck` | ✅ exit 0 |
| `lint:ci` ratchet | ✅ **877** against a 3916 baseline — the same figure as s55, so this task adds **zero** lint debt |

### 🔴 Two specs that were green and measured nothing, both caught by a mutant

Every mutant was applied to the real module and reverted in a single shell call, with an
apply-guard (`grep` for the mutated text before running) and a `diff` back to byte-identical after.
**One mutant run had to be thrown away** — its `perl` failed on a delimiter clash, and the "13
passed" it printed was against unmutated source, which looks exactly like a spec that catches
nothing. The guard is what turned that into a re-run instead of a conclusion.

| mutant | result |
|---|---|
| comments no longer stripped | **5 failed** — the seeded-file row, the comments-only row, and the matrix |
| an empty section no longer dropped | **6 failed** — including the matrix |
| the cap ignored | **1 failed** — the cap row, and only it |
| the block placed first instead of last | **1 failed** — *"lands AFTER the project docs"* |
| the precedence sentence dropped | **1 failed** — and only it |

🔴 **`isFileTitle` — a row that named a branch it never exercised.** *"Treats only the FIRST level-1
heading as the file's title"* passed against a mutant that deleted the branch outright, because both
arms of the example had **empty** sections, which are dropped either way. Rewritten with prose under
both headings; it now dies on that mutant alone.

🔴 **"Absent means omitted" could not see a block emitted unconditionally, and this is the more
transferable of the two.** The row compared a turn built *without* the argument against one built
*with* `''` — but **both arms are built by the same code**, so a mutant that ignores the argument
puts the block in both and the equality holds perfectly. It is a control pair that varies the
argument when the claim is about the feature. Fixed by asserting the absence outright
(`not.toContain(MARKER)`), which is only meaningful because the rows below it show that same marker
firing when there *is* a profile.

### ⚠️ What slice B does NOT include, named rather than implied

- ✅ 🆕 **The MCP half is BUILT (s60, `d1a3f6ec`).** See §"The MCP half" at the foot of this file.
  It was indeed a second package, a second security argument and a registration change — and the
  security argument turned out to be larger than the sentence predicted. **Claude Code now reads the
  profile through `get_project_info`.**
- ⚠️ **The planning turn does not carry the profile** — only the authoring turn does, which is what
  slice B specified (*"appended last in the reference blocks"*). It is arguably the wrong line to
  draw: *"prefer built-in nodes"* is a decision a **planner** makes, and a plan that ignores it costs
  the author a fight later. Cheap to add (`planningUserMessage` takes a 5th parameter), but a
  planning turn has no `cacheBoundary` and is not cached, so it is a real per-plan cost and belongs
  with Q5 rather than under it.
- ⚠️ **Undriven.** Nothing here has been seen in the running app. The panel half needs no API credit
  and is drivable; the prompt half is graded by the specs above precisely because its failure mode is
  an invoice and not a symptom.

---

## ✅ DRIVEN 2026-08-18 (session 59) — slice B in the running editor

Dev stack, `fix021b-drive` (a scratch copy of `fix013-drive`, opened via the recents store).
All four pre-registered observations were written down **before** launching, and are in
`s59-predictions.md`. Three passed as written; one was corrected **before** measuring, from source.

| # | observation | result |
|---|---|---|
| R1 | "About you" present in Settings → **Editor**, below the AI keys | ✅ between `AI docs` and `Connect an AI agent`, exactly where `EditorSettingsTab.tsx:79` puts it |
| R2 | no file ⇒ *"You have no preferences file yet. Nothing about you is being sent."* + **"Create and open preferences"** | ✅ **verbatim**, and the panel prints the real path |
| R3 | click ⇒ file seeded, caption ⇒ *"…you have not written in it yet, so nothing is being sent."* | ✅ **1,193 bytes on disk, ZERO characters charged** |
| R4 | one line written from **outside** ⇒ count goes non-zero without reopening the panel | ✅ **55 characters**, within ≤7s |

### 🔴 R1 was WRONG as inherited, and the correction is the transferable part

The handover said only *"the section is present"*. The source says
`<CollapsableSection title="About you" isClosed>` — and `Collapsible` unmounts children **only**
when `disableTransition && isCollapsed`, which `CollapsableSection` never passes. So the body is
**mounted at height 0** while collapsed.

Measured: `collapsibleHeight: 0`, `bodyMounted: true`, `bodyTextLen: 471`.

🔴 **A `textContent` read would therefore have found the caption, in full, on a section no user can
see.** The obvious instrument passes on a section that is unreachable, invisible and — because
`overflow:hidden` clips hit-testing — unclickable. **The reading that proves reachability is the
HEIGHT, not the text.** Corrected before measuring, not after; the drive expanded the section by
clicking its header and re-measured (`212`) before believing anything below it.

### 🔴 R3 is the row worth having, and R4 is the one that grades the stripping

R3: a **1,193-byte** file that is byte-identical to `PROFILE_TEMPLATE` (checked against the source
literal, not by eye) charges **nothing** — the branch prints no number at all. A seeded file
reporting a non-zero count would have meant the comment-stripping never ran against the real
template. It ran.

R4 is stronger than "the number moved", because the number was **predicted before the write**:
one line under the first heading should render `## How I like to be talked to\nPlain English, no
jargon.` = **55 characters**. The panel read **55**. So the file went 1,193 → 1,220 bytes on disk
while the charge went 0 → 55: comments stripped, three empty headings dropped, the title dropped.
✅ **A count that merely became non-zero would not have distinguished "stripping works" from
"stripping is skipped and the whole 1,220 bytes went out".**

✅ **Bonus, unplanned: the poll is bidirectional.** Restoring the template returned the caption to
*"…nothing is being sent."* — so it is a genuine content-comparing re-read, not a one-shot latch.

### ⚠️ What this drive did NOT show

- **Nothing here proves the model receives the block.** That is the specs' job (`userProfilePrompt.spec.ts`),
  and deliberately so — its failure mode is an invoice, not a symptom.
- **The MCP half remains unbuilt**, so Claude Code still does not read the profile.
- ⚠️ **`shell.openPath` fires on the button** and opens the file in the user's markdown editor. It
  was not driven by keystroke, so focus loss could not invalidate any reading above.

### ⚠️ Housekeeping

`~/Library/Application Support/NodeGX/PREFERENCES.md` is **left seeded and pristine** (1,193 bytes,
byte-identical to the template, charging nothing) — that is the product's own behaviour. The test
line was removed: a preference Richard did not write must not ride on every turn. The recents store
was backed up, and the drive entry removed after `dev:stop` (46 → 47 → 46).


---

## The MCP half — BUILT s60, commit `d1a3f6ec`

Slice B named this in one sentence: *"MCP reads it via the path baked into `.mcp.json` `env` at
registration (the BST-004 'front door, never guess' pattern) — ⚠️ this deliberately breaks the
server's every-path-inside-`projectDir` invariant and needs its own read-only containment note."*
Every clause of that survived contact. One thing it did not name turned out to be the bigger half.

### The chain, end to end

1. **Main resolves the path** — `mcpFrontDoor.js`'s `userProfilePath()`, from
   `app.getPath('userData')`. It is the only process that can ask, which is the whole of "front
   door, never guess" for this fact: the renderer cannot ask Electron, and the server must not
   derive it from `HOME`.
2. **The front door reports it**, so the renderer can render it.
3. **The renderer emits it in BOTH renderings** — `withUserProfile()` applies the pair to the
   `ChosenRuntime`, not to the registration, because `claudeMcpAdd` builds the displayed `-e` flags
   and every caller builds the registration's `env` from that same list. Adding it to one output
   is how the pasted command and the written config would silently disagree.
4. **The server reads `NODEGX_USER_PREFERENCES`** — `src/userProfile.ts`.
5. **`get_project_info` carries it**, with its precedence sentence.
6. **`selfRegistration` propagates it**, so a project created by `create_project` inherits it.

### 🔴 The containment note, which is the module's header

Three narrower rules replace the one it cannot keep:
**the path is given, never derived** (absent variable ⇒ absent feature, silently — an older
editor's registration simply has none); **read-only, and reachable by no tool argument**; and
**the path is never echoed**, only the rendered content — an absolute `userData` path contains a
home directory, and naming it would put an account name in a transcript for no gain.

### 🔴 What the sentence did not predict: `env` was an unchecked trust boundary

`rejectUntrustedRegistration` validates `command` and `args` against what main independently
resolves — its own comment calls it *"a trust boundary and not a formality"* — and passed `env`
straight through. Harmless while NodeGX emitted exactly one variable and the renderer could not add
another. **Not harmless once a path round-trips through the renderer:** the approved registration is
written into the user's real `~/.claude.json` and later spawned by their agent, so a surviving key
is a key in somebody's process. `NODE_OPTIONS=--require …` is the shape.

Fixed in two places, not one: the boundary **whitelists env keys** (whitelist, not denylist — the
rule `command` and `args` already follow), and the connect handler **overwrites** the profile path
with main's own, so what the renderer sends is convenience and never authority.

✅ **`rejectUntrustedRegistration` had no tests at all before this.** It has four, and the refusals
sit beside an acceptance built the same way. **Mutation-verified:** widening the whitelist to admit
`NODE_OPTIONS`/`LD_PRELOAD` turns exactly the two refusal rows red and leaves the acceptance green.

### Judgements a later session should check rather than inherit

- 🔴 **The profile rides in a tool RESULT, not `instructions`.** Not a preference — arithmetic. The
  resident surface has **57 tokens** of headroom against 8,280 and the cap on this file is 2,000
  characters. A new resident tool would not have fitted either. `get_project_info` is the tool the
  instructions already name as "call this first", and its *result* costs the budget nothing.
  ✅ **Re-measured after: 8,223 / 57 under, unchanged.**
- ⚠️ **Not gated on `allowWrites`**, unlike `authoringDoctrine` and `designDoctrine` beside it.
  Those are authoring instructions; this file's first heading is *"how I like to be talked to"*.
  **A defensible line drawn the other way — worth Richard's eye, not blocking.**
- ✅ **One renderer.** `renderProfileForPrompt` is re-exported through `editor-deps` with the same
  containment note the doctrine modules carry.

### ⚠️ Carried out, uncosted

🔴 **`claudeMcpAdd` does not quote its `-e` pairs.** Pre-existing, and it matters more now that one
carries a path: on a machine whose user data sits under a directory with a space, the **displayed**
command needs the user to quote it. The written registration is JSON and is unaffected.
**Wants its own task.**

### Still undriven

⚠️ **Nothing here has been seen in a running editor.** The specs grade the chain at both ends and
the mutation grades the security check, but no session has clicked Connect and read a real
`~/.claude.json`. **That is the drive this task still owes.**

---

## ✅ Q2, Q5, Q6 AND THE `allowWrites` JUDGEMENT — CONFIRMED by Richard, 2026-08-18 (session 61)

All four were built on assumptions and are now ruled. **Every one is confirmed as built**, so
nothing changes in the code — what changes is that a later session may stop treating them as open.

- ✅ **Q2 → ONE file, and NO second project-level document.** 🔴 **This is the one that decided what
  got built: slice A stays deliberately unbuilt.** Confirming it means slice A is not deferred work —
  it is work that was ruled out. A future session proposing it is proposing to overturn a ruling.
- ✅ **Q5 → `always`, capped at 2,000 characters, free when the file is empty.** **Rejected:** `pull`.
  The empty-file rule is what makes a global always-doc affordable, and it is now driven at both
  ends — the editor's panel (s59) and the MCP server's `get_project_info` (s60).
- ✅ **Q6 → prose only.** **Rejected in this slice:** `ai.role.*`-style structured keys.
- ✅ 🆕 **The MCP half is NOT gated on `allowWrites`** — confirmed as built. Unlike `authoringDoctrine`
  and `designDoctrine` beside it, which are authoring instructions a read-only client cannot apply,
  this file's first heading is *"how I like to be talked to"*. A read-only server still has that
  conversation.

🔴 **Everything slice B must keep doing is unchanged by these confirmations** — guidance stays in
HTML comments; an empty section stays dropped; the block stays last and ahead of `cacheBoundary`;
the precedence sentence stays *in* the block; `globalPreferences()` charges nothing for an empty
profile; `ensureUserProfileSeeded` writes only when there is no file. And on the MCP side:
`NODEGX_USER_PREFERENCES` is a wire contract across four files, the `env` whitelist stays a
whitelist, and main keeps overwriting the profile path rather than trusting the renderer's.

⚠️ **FIX-021 still owes ONE thing: the drive of the MCP half.** See §4 of the phase handover.
