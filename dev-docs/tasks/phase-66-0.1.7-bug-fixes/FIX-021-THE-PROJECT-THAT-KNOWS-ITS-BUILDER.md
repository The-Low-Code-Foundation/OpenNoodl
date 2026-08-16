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
