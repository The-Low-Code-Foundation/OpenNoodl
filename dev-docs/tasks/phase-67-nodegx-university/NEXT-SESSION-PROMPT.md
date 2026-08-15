# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's five amendments** —
the fifth is from 2026-08-15 and is not about a check at all), then
`UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md` (slices 1 and 2), then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`, then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision.** Do not re-litigate D1–D13 — if
one is wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Editor
  button: **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — 🔴 ruled *against* the recommendation: a record-capped backend means UNI-008 holds
  end-user data. Five obligations; effort raised; still last.
- **D13** — coaching delivery (**LearnBook**) is **phase 68**, platform stack, after Tier 1 + UNI-004.

## 🎉 UNI-010 slice 2 SHIPPED 2026-08-15 (`8c5a9ef7`) — the gate is collected, the surface exists

Slice 1 built the F1–F4 harness and **nothing called it**: `LearningFolderModel.install()` still ran
the static check alone, so an AI-authored bundle was priced at four classes and charged at one. That
is now closed, and the MCP door a model reaches it through is built.

| Shipped | Where |
|---|---|
| **The install policy** — which classes each provenance must have *passed* | `models/lessoninstallpolicy.ts` |
| **The install gate**, widened from F1 to the whole scorecard; `install()` is **now `async`** | `models/learningfolder.ts` |
| **The authoring brief** — format, path grammar, the whole condition vocabulary | `noodl-mcp/src/lessons/authoringBrief.ts` |
| **Score-then-write** — writes nothing unless it passed | `noodl-mcp/src/lessons/bundleWriter.ts` |
| **`get_lesson_brief` / `create_lesson` / `check_lesson`**, a deferred `lesson` group | `noodl-mcp/src/tools/lessonTools.ts` |

**28 new tests** (16 editor in `tests-unit/uni-010/lessoninstallpolicy.test.ts`, 12 in
`noodl-mcp/tests/lessonTools.test.ts`).

### 🔴 D5's hard problem, and the asymmetry that answers it

The sidecar must not write launcher state, so `create_lesson` writes a **folder** and the learner
installs it through the launcher's ordinary picker — which passes `local`, because pointing at a
directory says nothing about who wrote what is in it. Slice 3 had assumed "the editor will have
watched the MCP write it". **It does not, and no channel would let it.**

The way out was already in slice 3's own rule, unnoticed: it is **asymmetric**. Provenance is the
caller's word *because a bundle declaring itself `curated` would be believed* — but declaring
`authoredBy: "ai"` **spends** trust, moving the bundle from a one-class gate to a three-class one.

> 🔴 **A claim may only tighten.** The one direction that costs the claimant is the one direction it
> is safe to honour.

One optional manifest field and one pure `resolveProvenance`. No bridge, no IPC, no sidecar write.

### 🔴 The gate is a policy TABLE, not slice 1's `installable`

`REQUIRED_CLASSES`: `curated`/`org`/`local` → F1; `local-ai` → F1, F2, F3. Plus **a `fail` in any
class blocks everyone**, which also makes curated bundles better checked than slice 3 left them.

Gating on `installable` ("every class checked and passed") was the obvious move and it is wrong:
**nothing in a packaged editor can render a solution directory.** Engine 2's editor adapter drives the
*running viewer*; the sidecar's spawns the harness out of `scripts/`, which is not in `build.files`.
So `installable` is unreachable in the shipped editor, and gating on it would mean **no AI-authored
lesson could ever install** — the fourth amendment's own failure, one slice later.

⚠️ **F4 is therefore required of nobody at install — a recorded hole, not a shrug.** It is the class
the prior arc predicted would *dominate*, and it is answered by the **producer** (`create_lesson`
refuses to write without it unless `allow_unrendered` is passed by name) and never by the installer.
**A model that hand-writes a bundle with its own file tools and installs it directly reaches a learner
with F4 unchecked.** That is the sharpest thing left open in this task.

### 🔴 The finding to carry: a lazy `require` defers execution, not resolution

The fifth "build the caller" instance, and the first about neither a check nor a feature — about a
**claim in a module header nobody could falsify until something depended on it.**

UNI-007 moved `ProjectModel` into a `require` **inside** `liveLessonEvalContext()` and recorded that
this "is what makes 'the same verifier, not a fork' achievable: UNI-010 runs this runner inside an MCP
sidecar". True of jest, which never evaluates the branch. **False of the sidecar, which is bundled** —
esbuild resolves a literal `require` path wherever it sits, so the first import from `noodl-mcp`
pulled in `projectmodel` → the node graph → React → `.scss`, and the build failed outright.

> 🔴 **"Loadable in plain Node" and "safe to bundle" are two different properties.** The check is to
> **build it**, not to read it — and `editor-deps.ts` is a whole barrel of purity claims that have
> only ever been checked by building.

Split to `views/lessons/lessonevalconditions.live.ts`, beside `lessonwholesolution.live.ts`.

### 🔴 And a gate that could not report its own margin

Adding a deferred tool group tripped AWP-006's 8,200-token surface budget. Measured, same fixture:
**8,198 with UNI-010 entirely absent** — LEG-001 banked 58 tokens of slack and **56 had been spent** by
work that never knew it was spending them, because `expect(tokens <= BUDGET)` says nothing at 8,197
and nothing at 8,199. *It reports the crossing and never the approach; the first person told is the
one who runs out.* Raised to 8,280 with the numbers written into the test.

⚠️ On the way in, the group exposed a live staleness bug: `find_tools`' `group` argument was a
**hand-written `z.enum`**, so the new group was advertised in the tool's own description and rejected
by its schema. Now derived from the manifest.

### ✅ The brief's examples are typed values, not prose

All eleven conditions it shows are real `LessonConditionDef`s in `CONDITION_EXAMPLES`, rendered into
the text, and the spec compiles every one through the real `compileConditions`. The worked manifest is
run through the harness and asserted to pass all four classes. *A doc that lies has examples that lie
too*, and this one cannot.

## What to do next — in the order I'd pick

**1. Criterion 2 — DRIVE it.** The provenance plumbing is unit-tested end to end and **nobody has
installed an MCP-written bundle through the real launcher.** Write the consequence list *first*, and
🔴 make sure at least one line could only be true of the AI route — "the lesson installed" is true of
a broken feature. Suggested: *"the card reads AI-authored, and the same bundle with `authoredBy`
removed installs as Local"* — one observation, both halves of the asymmetry.

**2. Criterion 3 — the five-lesson run**, against the pre-registered kill/keep criteria (≥3 of 5
install and are completable + worth completing). This is the experiment the task exists for and
everything it needs now exists.

**3. Ergonomics: two projects, one bound server.** `create_lesson` takes two project *directories*, so
the authoring model produces the starter and the solution itself. The MCP binds one project, so in
practice it authors the solution with the write tools and builds the starter alongside. It works and
it is clumsy; a `derive_starter` step is the obvious slice-3 candidate.

**4. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**5. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

## Gates as they stand (2026-08-15, on the tree that became `8c5a9ef7`)

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (editor) | ✅ exit 0 |
| `npm run test:main` | ✅ **203 suites / 3136 tests, 0 failures** — 🔴 **new floor** (was 202 / 3120; the delta is exactly this commit's +1 / +16, confirmed with the peer who shared the tree) |
| `npx jest` in `packages/noodl-mcp` | ✅ **44 suites / 506 tests, 0 failures** |
| `npx eslint` on every file touched | ✅ clean |
| `npm run test:ci` | ✅ **2812 / 9 at pinned seed 39393** — the 6-name floor + 3 of a peer's own new specs; **zero `tests/lessons/*` failures**. Run by a phase-66 peer over this tree, results file deleted 13:01 and written 13:14 |

✅ **`test:ci` DISCHARGED — and the evaluator split is GREEN, measured.** Run by a phase-66 peer over
this tree at the pinned seed, results file **deleted 13:01, written 13:14** — freshness proved rather
than inferred.

```
totalCount   2812      seed 39393
failedCount  9         = the 6-name floor + 3 of the peer's own new specs
```

🔴 **Zero `tests/lessons/*` failures, and nothing lesson-shaped anywhere in the list.** This was the
**first electron compile of the `lessonevalconditions` split**, since `test:main` never compiles
`views/`. All three of `lessonevalconditions.test.ts`, `lessonformat.test.ts` and
`worked-lesson.test.ts` passed, and neither `views/lessons` nor `models/lessoncheck` appears in any
failure. My import-read prediction was right and **is now a result rather than a prediction.**

Floor unchanged and confirmed by name: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`,
**zero `BEN-001`** — worth noting because the peer's 24 added specs shifted the permutation and the
seed-order cluster still did not appear. The other 3 failures are theirs and were spec-side.

⚠️ **Quote the floor as 2788 / 6, not 2812 / 9.** The tree measured carried the peer's uncommitted
phase-66 work; +24 specs and +3 failures are theirs, and both numbers move back when it lands
separately.

> 🔴 **It took three runs, and the two destroyed ones are the part to carry.** Both were reaped
> part-way; in each case **`test-results.json` was never written and npm exited 0.** That is the
> mirror of the stale-file trap the memory index warns about — not a stale file reproducing the floor
> count, names *and* seed, but **no file at all behind a zero exit**. One habit covers both: **delete
> the file before the run, then require a fresh mtime after.** "Read the JSON" catches neither.

⚠️ **Do not attribute a reaped suite to `dev:stop` on the "MCP spared, suite dead" signature.** I
wrote that into this handover on the first kill and it was wrong — a plausible explanation, adopted
early, exactly the failure this phase's own register warns about. Both kills came from a **dev
stack's lifecycle**: `start.ts`'s sweep at launch, and `dev-watchdog.js` sweeping with
`protectAncestors: false` when the launcher dies. **Both ends of a stack's life reap a suite**, and
by-pid teardown spares the MCP servers, which is what makes it look like `dev:stop`. The peer fixed
`dev-processes.js` and verified both directions. The operational rule is simply that **the checkout
must stay quiet for the whole ~15 minutes, not just the launch.**

Run it as `NOODL_SPEC_SEED=39393 npm run test:ci` (`tests/SpecRunner.html:41-42`), and 🔴 **delete
`packages/noodl-editor/tests/test-results.json` before the run or `stat` it after** — a stale file
reproduces the floor count, the floor *names* and the seed, because all three check content. Exit 0
with an unchanged mtime is what a broken webpack looks like. Floor at that seed is **6 failures** (4 ×
`AIX-006 style vocabulary`, 2 × `AI model registry`), zero `BEN-001`; **npm exits non-zero on any
failure, so a clean floor run looks failed at the shell.** Read the JSON.

## ⚠️ Owed, small, and honest about it

- ⚠️ **`MEMORY.md` compaction is PARTIALLY done and still owed.** A hook asks for it under 17.1KB; a
  previous session got it from 21.2KB to 20.1KB and stopped. The remaining bulk is ~152 markdown links
  whose URLs alone are ~4.4KB — cutting further means dropping entries or renaming memory files, and
  the rename would break cross-links while many sessions are live on this checkout.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it. One
  `git clean` from gone. Somebody should commit it.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no session in today's
  conversations. 🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is
  droppable.
- ⚠️ Richard's `noodl-mcp.cjs` servers still run an old build. **Slice 2 added three tools**, so
  reaching them needs a restart — and if a server loads `/Applications/…` rather than the checkout,
  it needs a **repackage**, not `npm run build`. His call.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call (the
  Bash cwd persists); **explicit pathspecs** — the tree routinely holds two or three sessions' work.
- 🔴 **This checkout is SHARED — 14 sessions were live on 2026-08-15.** Announce over `SendMessage`
  before `test:main`, `test:ci` or an editor launch, and again after. `ListAgents` finds peers; reply
  to a peer by copying its `from=` attribute as your `to`. ✅ **`test:main` is safe beside a running
  `test:ci`** — plain Node, no Electron, no renderer, no CDP port (done concurrently this session).
  ⚠️ **`git log` authorship separates nobody** — everyone commits as Richard.
- 🔴 **`dev:stop` kills by *checkout*, so here it kills a peer's editor and reaps a running suite.**
- ⚠️ A different `NOODL_REMOTE_DEBUG_PORT` does **not** let two editors coexist; 8080/8574/8577 fixed.
- Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  Never `grep -r` across `packages/noodl-editor/src/` without `--include` — it hits `*.bundle.js.map`
  and returns 33MB. ⚠️ And zsh eats a bare `--include=*.ts`: quote it.
- 🔴 **The condition vocabulary is not what you would guess** — `hasParams: string[]` (not a string),
  **`paramsEqual`** (not `paramsEq`), `{ connection: { from, to, fromPort, toPort } }` (no
  `hasConnection` key), **`previewRouteEquals`** and **`activeComponentEquals`**, which compile to the
  internal `viewerpatheq` / `activecomponentnameeq`. ✅ **You no longer have to remember this**:
  `CONDITION_EXAMPLES` in `noodl-mcp/src/lessons/authoringBrief.ts` is one typed example per verb and
  the spec compiles all of them.
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's **legacy
  name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`).
- ⚠️ **Test fixtures must not let those two agree.** A fixture whose component `path` equals its
  directory tests a project shape the editor never produces, and the harness passes over the one
  mistake it most needs to catch. Both new test files write them deliberately different.
- ⚠️ **Drive bundles are still staged** at `/tmp/claude-501/uni-007-drive-bundles/` — `bundle-good` and
  `bundle-bad`. Neither carries a `solution/`, so **neither will install as `local-ai` any more.**
  That is correct behaviour and it will look like a regression the first time somebody tries it.
- 🔴 **⌘C over any panel prose copies the selected canvas NODE instead** (phase-66). Not this phase's
  to fix.
- `suggestedNodes` is still **dead** — no callers. The brief tells authors not to rely on it.
