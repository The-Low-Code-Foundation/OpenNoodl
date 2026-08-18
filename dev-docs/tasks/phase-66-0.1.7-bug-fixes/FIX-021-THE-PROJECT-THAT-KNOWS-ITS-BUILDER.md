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

🔴 **STALE as of session 62 — read the section below before believing this sentence.** The MCP
**server** half is now driven 4/4. What remains is only the **editor** half (observations 1–3).

---

## ✅ DRIVEN 2026-08-18 (session 62) — the MCP server half, 4/4. ⛔ The editor half is BLOCKED

**Instrument:** `node packages/noodl-mcp/dist/noodl-mcp.cjs <projectDir> [--allow-writes]`, spoken to
over **real stdio with real JSON-RPC** (`initialize` → `notifications/initialized` →
`tools/call get_project_info`). 🔴 **Deliberately not a jest run of `tests/`** — the handover names
that distinction, and this is the client-shaped instrument.
**Tree:** working tree at `159718d2`, plus the step-zero rebuild below. **Project:** a scratch copy of
`Puppy test 3`.

### 🔴 STEP ZERO WAS REAL, AND IT WOULD HAVE FAKED A FAILURE

`dist/noodl-mcp.cjs` was s59's build (Aug 18 **10:33**) with **0** occurrences of
`NODEGX_USER_PREFERENCES`, exactly as s61 measured. Rebuilt with
`npm --prefix packages/noodl-mcp run build` → **13:17:37, count 1**. Every row below is against the
rebuilt bundle. ✅ **`packages/noodl-mcp/dist/` is gitignored and untracked** — the rebuild produces
no git noise and nothing a peer's commit can sweep, so it needs no commit and no pathspec care.

### The four rows — absence read FIRST, then the row that makes it mean something

| # | `NODEGX_USER_PREFERENCES` | profile file | `--allow-writes` | `userPreferences` |
|---|---|---|---|---|
| 1 | **unset** (an older registration) | — | yes | ⛔ **absent** |
| 2 | set | the **pristine seeded template**, every heading an HTML comment | yes | ⛔ **absent** |
| 3 | set | **two of four headings answered** | yes | ✅ **present** |
| 4 | set | two of four headings answered | **no — read-only** | ✅ **present** |

🔴 **Rows 1 and 2 are two DIFFERENT absences and both had to be taken.** "No variable" is an older
editor's registration; "variable pointing at an unanswered file" is a user who never opened the
panel. They have the same shape in the response and different causes, and only row 2 grades the
empty-file rule.

✅ **Row 3 is the known-firing signal that licenses rows 1 and 2.** Taken in the same run, same
instrument, same project. Without it the two absences are indistinguishable from a feature that
never shipped — which is precisely the failure step zero would have produced.

### ✅ What row 3 showed beyond "present"

- **The `note` travels with the text**, in full: *"Standing preferences this user wrote about
  themselves… This project's own conventions (docs/CONVENTIONS.md) outrank them in turn: where the
  two disagree, follow the project and say that you did."* 🔴 **Its absence was the failure worth
  catching** and it did not occur.
- 🆕 **Only the ANSWERED headings arrived.** The two headings left as HTML comments are **dropped**,
  not sent empty. That is slice B's "an empty section is dropped" rule, measured on the wire rather
  than in a spec.

### ✅ Row 4 confirms Richard's `allowWrites` ruling BY DRIVE, not by reading

The read-only server advertised **13 tools** and its payload carried **no** `authoringTraps`,
`authoringDoctrine` or `designDoctrine` — and **still carried `userPreferences` with its `note`**.
🔴 **This is the ruling's own reasoning made visible:** the authoring doctrine is correctly withheld
from a client that cannot author, and the profile is correctly not, because its first heading is
*"how I like to be talked to"*.

### ⚠️ STALE (s62) — the observations below WERE driven at s63. Kept as an environment measurement

**Nothing about the feature failed. The dev stack never produced a usable renderer**, across two
full launches and ~1h40m.

| What | Measured |
|---|---|
| Launch 1 | 13:19 start; editor's **first compile took 998,081 ms (16.6 min)**; Electron launched **13:37:32** |
| The kill | A peer wrote `packages/noodl-editor/src/editor/src/validation/*.ts` at **13:45:47** — mid-drive — retriggering the compile |
| The wedge | `webpack-dev-middleware` logged **`wait until bundle finished: /src/editor/index.bundle.js`** indefinitely. `curl` of that URL returned **HTTP 000 after 60s** |
| Not transient | `reactMounted: false` through **14:17**, across **2 reloads** and **2 further successful compiles** (345,226 ms and 154,488 ms) |
| Launch 2 | 14:18, with **no peer source edits after 13:56:11** — first compile **still unfinished at 14:58 (40 min)**, then all three lerna children were reaped (`exited undefined`) and the stack died |
| Throughout | **load average 23–53**; `Virtualization.framework` ~50% CPU; **53 resident MCP servers** |

🔴 **The mechanism, and it will bite the next session too:** `start.ts` calls
`reapPreviousSession()`, so **a peer launching their own dev stack kills yours**. Combined with
`hot: true` — where any peer edit under `packages/noodl-editor/src` restarts a 16–40 minute
compile — a shared checkout at this load cannot reliably hold an editor open long enough to drive.

⚠️ **What was NOT concluded from this.** The renderer never mounted, so this says **nothing** about
whether Connect works. It is an environment measurement, not a verdict on the feature.

### ✅ Richard's files were left exactly as found

- **`Connect` was never clicked**, so it never wrote. Verified after teardown:
  `~/.claude.json`'s `nodegx.env` is still **`{"ELECTRON_RUN_AS_NODE":"1"}`** — no profile key.
- 🔴 **`~/.claude.json`'s hash DID change, and restoring the backup would have been the error.**
  A structural diff shows `mcpServers` **byte-identical** and only
  `cachedGrowthBookFeatures`, `cachedGrowthBookFeaturesAt`, `skillUsage`, `cachedExperimentData`
  different — **Claude Code's own cache, rewritten continuously by ~25 live sessions.** Restoring a
  90-minute-old copy of that file would have clobbered every one of them.
  ✅ **Compare the SECTION you touched, never the file hash.**
- `PREFERENCES.md` **unchanged** (`c3c8425…`, identical to the pre-drive copy).
- Stack down via `dev:stop`; **53 MCP servers survived** the sweep, as the `NEVER_SWEEP` shield promises.

### ✅ A carried item is now bounded rather than suspected

🔴 **`claudeMcpAdd`'s unquoted `-e` pairs cannot break the write.** `connectBootstrapServer`
registers via `spawnSync(exec, cliArgs(registration))` — an **argv array**, no shell — and
`cliArgs` (`connectBootstrapServer.js:193-196`) emits `-e` `KEY=value` as separate argv entries.
Richard's own profile path contains a space (`…/Application Support/NodeGX/…`) and is therefore the
worst case, and it is safe on both the CLI route and the JSON route. **The defect is confined to the
DISPLAYED, copy-pasteable string.** Still wants its own task; it is now a cosmetic one.


---

## ✅ THE EDITOR HALF, DRIVEN 2026-08-18 (s63) — FIX-021 IS CLOSED

**All three observations taken, plus a negative control s62 did not have.** The task is complete:
the server half was driven 4/4 at s62 (above), the editor half is driven 3/3 here.

### The instrument

Real `npm run dev:debug` stack, real renderer over CDP, real click on the real button, then the
**real `~/.claude.json`** read off disk. No stub, no spec, no in-process shim.

⚠️ **Step zero re-checked first:** `packages/noodl-mcp/dist/noodl-mcp.cjs` is gitignored, so it was
grepped before anything else — `NODEGX_USER_PREFERENCES` present. A stale bundle would have produced
an absence indistinguishable from the feature being broken.

✅ **The pre-state was recorded BEFORE the click**, which is what makes this a before/after rather
than an assertion: `mcpServers.nodegx.env` was **`{"ELECTRON_RUN_AS_NODE":"1"}` and nothing else.**

### The card, and the correction that got us to it

`[data-test=connect-agent-card]` on the **launcher**, exactly as s62 said — not the settings panel.
🆕 **The button has its own testId, `[data-test=connect-agent-connect]`**, which is a steadier handle
than the label s62 recorded. Pre-click state: card present and visible, button enabled and reading
`Connect Claude Code`, **no success or failure row** — the clean `idle` state. `useConnectAgent`
starts at `'idle'` and never inspects the existing registration, so an already-registered machine
still gets a live button.

### The three observations

| # | Observation | Result |
|---|---|---|
| 1 | `~/.claude.json` → `mcpServers.nodegx.env.NODEGX_USER_PREFERENCES` | ✅ **PASS** — `/Users/richardosborne/Library/Application Support/NodeGX/PREFERENCES.md`, and the file at that path exists |
| 2 | **THE CONTROL** — `ELECTRON_RUN_AS_NODE` still present beside it | ✅ **PASS** — env keys are **both**: `["ELECTRON_RUN_AS_NODE","NODEGX_USER_PREFERENCES"]` |
| 3 | a project's `.mcp.json` carries the same variable, same value | ✅ **PASS** — see the correction below |

🔴 **Observation 2 is the one that mattered and it is why both keys are asserted.** A registration
that *replaced* the env record instead of extending it passes any probe that checks only the new key,
and leaves a server booting a GUI app with a dock icon (BST-004/F80). The mechanism is visible in
`mcpFrontDoor.js`: `trusted.env` spreads `registration.env` minus the profile key, then re-adds the
**main-resolved** path — so the control key survives by construction, and the renderer's proposed
path is discarded.

✅ **The click's own report, on screen:** *"Claude Code can now build NodeGX apps… Registered as
`nodegx` in `/Users/richardosborne/.claude.json`."*

### 🔴 A CORRECTION TO THE BRIEF — scoped, after a peer pushed back and was right

The handover's §4 said *"open or create a project; read its `.mcp.json`"*. **The open half is wrong
for the MCP TOOL** — and the first way I wrote this up was itself too broad, so both corrections are
recorded here rather than only the tidy one.

🔴 **There are TWO `.mcp.json` writers, in two packages, with two different mechanisms.**

| Writer | Reached by | How it gets the profile path | This drive |
|---|---|---|---|
| `noodl-mcp` — `create_project` → `project/agentConfig.ts` | a model calling the tool | **inherits `process.env[NODEGX_USER_PREFERENCES]`** from the server it runs in | ✅ **driven here** |
| `noodl-editor` — backfill when the **editor** opens a project (`utils/LocalProjectsModel.ts:142` → `backfillAgentConfigFor:269` → `models/template/agentConfig.ts` `installAgentConfig:245`) | a user picking a project in the UI | `withUserProfile(…, frontDoor.userProfilePath)` (`mcpCommands.ts:287,468`) — **the front door, not the environment** | ⛔ not driven; **spec-covered** |

🔴 **My "exactly one caller" was a BOUNDED query reported as an absence.** The grep ran over
`packages/noodl-mcp/src` only, where it is true; the editor's writer lives in a *different package
and a second file also called `agentConfig.ts`. ⚠️ A second bounded-query slip followed in the same
session — searching `packages/noodl-editor/src` for the spec cover and concluding there was none,
when the spec is in `packages/noodl-editor/tests-unit/`. **Both times the bound, not the codebase,
produced the answer.**

✅ **The editor path is specced, including this drive's own control:** `tests-unit/mcp-001/
mcpCommands.test.ts:362` asserts `buildProjectRegistration(...).registration.env
.NODEGX_USER_PREFERENCES`, and the next case is literally *"keeps the Electron flag beside it rather
than replacing it."* ⚠️ **So one writer is driven and the other is specced but never driven** — that
is the honest state, not "both driven".
⚠️ **`withUserProfile` returns the runtime UNCHANGED when `userProfilePath` is falsy**, so the editor
path omits the key silently rather than failing. Nothing grades that branch end-to-end.

✅ **The MCP tool's silence is DELIBERATE, not a hole** (`openProject.ts:30-42`): *"Writing into a
directory because a model passed its path to a tool is a different act with a different consent
behind it."* It is therefore **not** a FIX-008 regression, and should not be "fixed".

Driven, in this order:

1. `open_project` over real stdio → **bound the project, `toolsRevealed` 18 tools, wrote no
   `.mcp.json` at all.** Not a failure of the feature; it is simply not that tool's job.
2. `create_project` → `.mcp.json` written, carrying **both** `ELECTRON_RUN_AS_NODE: "1"` and
   `NODEGX_USER_PREFERENCES` with the identical path.

⚠️ **A first attempt died on the fixture, not the feature:** the copy chosen was a **legacy V1
project**, and `open_project` correctly refused with `not-a-v2-project`. Same class as the
`cashflow-command-centre` trap — check the project format before reading anything into a refusal.

### ✅ THE NEGATIVE CONTROL — the arms disagree

The same server binary, same project shape, **`NODEGX_USER_PREFERENCES` stripped from the spawn env**:

| Arm | `.mcp.json` `env` |
|---|---|
| registration as written after Connect | `ELECTRON_RUN_AS_NODE: "1"` + `NODEGX_USER_PREFERENCES: <path>` |
| **control — variable stripped** | `ELECTRON_RUN_AS_NODE: "1"` **only; profile key ABSENT** |

🔴 **Without this arm, observation 3 proves nothing about causation** — a hardcoded path would look
identical. The two arms disagree, so the value in `.mcp.json` demonstrably tracks the registration
the Connect click wrote. ✅ A pre-FIX-021 specimen turned up by accident and says the same thing:
`cn012-drive`'s inherited `.mcp.json` carries `"env": {}`, empty.

### ✅ Richard's files, left correct

- **`PREFERENCES.md` never touched** — `sha1 c3c8425950`, 1193 bytes, mtime **10:28:36**, i.e.
  unchanged since before the session began. Observations 1 and 2 do not need it answered, so it was
  not written and did not need putting back. ⚠️ **s62's `c3c8425…` is a sha1** — `md5` gives
  `e48a5181…` and reproduces nothing; that cost a few minutes to resolve and is worth stating.
- **`~/.claude.json` NOT restored from the backup**, per s62's warning. Compared **section by
  section** instead: `nodegx-puppy-test-3` **IDENTICAL**, `nodegx-observe` **IDENTICAL**, `nodegx`
  **CHANGED** — which is precisely and only the change the drive was for.
- Fixtures created for the drive were removed; nothing was left in the projects directory.
- Stack down via `dev:stop`: **25 processes stopped, 29 MCP servers survived** the sweep.

### ⚠️ Two small things this drive turned up, neither owed by any criterion

- 🔴 **The success message says an earlier registration *"pointed somewhere else and was replaced"* —
  but `command` and `args` were byte-identical before and after.** Only `env` changed. The wording
  overstates what happened; a user reading it would think their server had been repointed. Cosmetic,
  unowned, worth a small task alongside the `claudeMcpAdd` display defect.
- ⚠️ The renderer's first compile took **208 s** at load ~7, against s62's **998 s** at load 23–53.
  The environment, not the code, is what decides whether this drive is possible.

### Still owed

✅ **NOTHING BY ANY ACCEPTANCE CRITERION. FIX-021 is CLOSED.** Both halves are driven: the MCP server
end 4/4 (s62), the editor end 3/3 plus a negative control (s63).

⚠️ **One honest remainder, carried rather than owed:** the **editor's** `.mcp.json` backfill (writer 2
in the table above) is **specced but never driven**. It reaches the profile path by a different
mechanism than the one driven here — the front door rather than the environment — and
`withUserProfile` drops the key silently when the front door has no path. No criterion asks for it;
it is a one-drive item for whoever next has an editor open, not a reason to hold the phase.
