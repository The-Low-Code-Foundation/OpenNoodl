# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's six amendments**),
then **`UNI-010-CRITERION-3-RUN.md`** (the experiment is finished — read its §6, §8 and §12), then
`UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md`, then `UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`,
then `TASKS.md`. `PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue holds D15 and D16 only** (UNI-011: org-minor visibility; the never-empty
threshold). Both block *shipping*, neither blocks building. Do not re-litigate D1–D14 — if one is
wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; University is its learning wing. Editor button:
  **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — ruled *against* the recommendation: a record-capped backend means UNI-008 holds end-user
  data. Five obligations; effort raised; still last.
- **D14** — the web is canonical, the **editor mirrors it via one API**; editor-only features are the
  transition incentive.

## ✅ UNI-010's criterion 3 ran 2026-08-16, and finding (a) is now CLOSED

All three acceptance criteria are met; the write-up is
[UNI-010-CRITERION-3-RUN.md](UNI-010-CRITERION-3-RUN.md), pre-registered and committed **before a
single lesson existed** (`897a2522`) so the decision rule could not be reshaped by the data.
**KEEP on the rule — 5 of 5 install and are completable, ≥3 clean on the human read** — *and* the
same run produced positive evidence for the kill clause. Both halves are the result.

### ✅ Slice 3 (2026-08-16, `eff91029`) — §8.1 closed, and it was a verdict change as predicted

F4 discarded the render harness's own defect findings. A lesson whose Repeater stamped three
`dead-placeholder-text` rows beside one real heading scored F1–F4 all pass, because `rendered` is
`drawnElementCount > 0` and the harness's error line sat in `findings` as a **string**. Now
`renderDefectCodes()` sits beside `countDrawnElements` in `lessondrawncount.ts` — one rule, both
adapters — `WholeSolutionResult.renderDefects` carries the codes, and F4 fails as
**`solution-renders-broken`**. **14 specs**; `test:main` **205 / 3171**, `noodl-mcp` 44 / 510.

🔴 **Three judgements inside it worth not re-deriving:**

1. **It reads the harness's `error` severity, not the one code §8.1 named.** `empty-list`,
   `broken-image` and `content-not-visible` were in the identical hole. `blank-render` is excluded
   because `rendered` already answers it — one defect, one accusation.
2. **Absent `renderDefects` means "not reported", never "none found."** Same distinction
   `drawnElementCount` draws; an adapter that stays silent opts itself out, and
   `normaliseWholeSolutionResult` must never invent an empty list, which would turn every silent
   adapter into a clean bill of health.
3. **The learner's surface changed its SENTENCE and not its verdict.** `summariseGrade` printed
   *"…with no blocking problems"* over the same evidence; that is fixed, and `complete` is
   untouched. A learner mid-build legitimately has placeholders — failing them would be F3's
   first-draft mistake (a gate that rejects the correct answer) pointed at the one person who
   cannot argue with it. Two specs hold the pair.

✅ **Graded as a control pair both ways, because the finding *was* "two scorecards that should
differ are identical"** — a single broken case would pass against a gate that had started failing
everything. Re-run with the new branch disabled: **3 new specs fail, all 25 pre-existing pass.**
And pinned on *recorded* renders rather than invented ones: `phase55-replay-haiku` (68 drawn,
several the word "Text") reports two defects; `phase55-replay-sonnet`, the build phase 55 calls
correct, still reports none; `ecommerce-example`'s `minimum-layout-width` **warning** stays a
warning.

### 🔴 What slice 3 did NOT close

- **§8.2 — F4 renders the Router's `startPage` and nothing else.** A lesson that *teaches* a second
  page has its subject unscored, and a dead placeholder there is invisible to F4 **and** F2 — now
  including to slice 3's check, which can only see what the render rendered. 🔴 **Upstream of
  UNI-010**: `render_report` has the same blind spot, measured at the HTTP layer (`/` → 200,
  **`/home` → 404**, i.e. even the start page's own `urlPath`). **Already written into
  [CN-001](../phase-69-the-node-you-write-yourself/CN-001-THE-EYES-MUST-SEE-KITS.md)**, and it
  **survives CN-001**, measured rather than assumed.
- **The F4 packaged-install scope call is STILL Richard's.** `scripts/` is not in `build.files`, so
  on a packaged install F4 is checked by **nobody** — and a sharper F4 that never runs is still a
  sharper F4 that never runs. Two options: ship the render harness with the sidecar, or have
  `create_lesson` say plainly that a packaged install cannot answer F4 and that `allow_unrendered`
  is then the *ordinary* case. ✅ CN-001 moved the pure half into a workspace package — the
  structural half of option one — so **put it in front of him with the call, not after it.**
  🔴 **Do not quietly pick one.**
- **The human read's structural finding.** Five steps across four lessons check LESS than their
  prose asks, always leniently, because **F2 punishes a condition that is too strong and nothing
  punishes one that is too weak** — so the gradient an authoring model sits on points at
  under-checking, and F6 (the class that would catch it) is human-only by definition. Two have real
  consequences. ⚠️ One of them is a **format** gap: there is no verb for *"the Router lists this
  component"*, and `paramsEqual` on a nested object with an array in it is not one.

## What to do next — in the order I'd pick

**1. The brief's "weaker than the prose" pass** (§12.3). Not a gate — F6 is human by definition —
but the brief can name the gradient out loud: *"F2 punishes a condition that is too strong and
nothing punishes one that is too weak, so check what your prose asked for."* Cheap, and it is the
only lever on the run's one-directional finding.

**2. A verb for router registration** (§12.4) — closes the one hole in the run that better authoring
could not. ⚠️ Costs MCP surface if it reaches the tool schema; see the budget note below.

**3. Ergonomics: `derive_starter`.** Still the obvious next slice, and the run added a reason: every
starter in it was built by *subtraction from the solution*, which is why the
already-complete-in-the-starter refusal fired **zero times** in five lessons. A model building two
projects independently is far more exposed to it. 🔴 **Budget it first** — 57 tokens free against a
bar renegotiated twice, and *"there should not be a third"* is written into the test. Phase 69's
CN-006/CN-009 compete for the same 57. If it does not fit, the sanctioned move is a `$ref`ed node
schema (inlined three times today).

**4. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**5. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

## Gates (2026-08-16, slice 3)

Run and quoted rather than claimed:

- **`test:main` — 205 suites / 3171 tests, all pass.** The floor was **205 / 3157**; slice 3 authored
  **exactly 14** new specs and added no file, so both numbers are predicted rather than discovered.
  ✅ Plain Node — safe beside a live editor or a `test:ci`; only another `test:main` collides.
- **`noodl-mcp` — 44 suites / 510 tests, all pass.**
- **`typecheck:editor` and `typecheck:editor-tests` — clean.** ⚠️ `tsc --noEmit` inside
  `packages/noodl-mcp` reports **9 pre-existing errors** in files slice 3 never touched
  (`disclosure.ts`, `interfaceGate.test.ts`, `stagingDiagnostics.test.ts`,
  `connectionPresentation.test.ts`). **Not introduced here, and not fixed here** — worth someone's
  time, because a typecheck nobody can run clean is a typecheck nobody runs.
- **`test:ci` was NOT run.** The floor to quote if you do: **6 failures by NAME** (4 ×
  `AIX-006 style vocabulary`, 2 × `AI model registry`) — **never by count**, `totalCount` drifts with
  whoever's specs are in the tree. 🔴 **Delete `packages/noodl-editor/tests/test-results.json`
  before a run and `stat` it after** — a reaped run and a broken build both exit 0 and write no file.

## ⚠️ Owed, small, and honest about it

- ⚠️ **The five lesson bundles live in a dead session's scratchpad.** Reproducible —
  `UNI-010-CRITERION-3-RUN.md` §2 has the five requests and §7 the verdicts — but the project specs
  and the `mkproject.js`/`mcpsession.js` helpers are gone. **If a slice wants a regression corpus,
  budget to rebuild them.** ✅ Slice 3 did not need them: the MCP adapter's recorded fixtures in
  `packages/noodl-mcp/tests/fixtures/render/` carry the same control pair, and are already committed.
- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A previous session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** Slice 3 was headless and did not touch it.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it.
  One `git clean` from gone.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no known session.
  🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is droppable.
- 🔴 **`scripts/devtools/dev-processes.js`** — check whether it is still uncommitted. It is the only
  thing stopping an editor launch or teardown from reaping a running `test:ci`, it is on Richard's
  owed list, and one `git checkout --` on that path loses it silently.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call (the
  Bash cwd persists); **explicit pathspecs** — the tree routinely holds two or three sessions' work.
- 🔴 **This checkout is SHARED.** Announce over `SendMessage` before `test:main`, `test:ci` or an
  editor launch, **and announce the teardown to exactly the set you announced the launch to.**
  ⚠️ **Re-list immediately before sending a teardown** — a peer measured the roster moving in *both*
  directions inside two minutes, so the list you opened with is stale by the time you close.
  ⚠️ `SendMessage` rejects a bare peer name and asks for the ` [ref]`; send the ref it quotes back.
- 🔴 **`pkill -f "OpenNoodl/node_modules/electron/dist"` is NOT a way to clear a stale editor** — a
  P66 session measured it 2026-08-16 at **13 matches, all 13 MCP servers, 0 editors**, and `pkill`
  bypasses `sweep()` so `NEVER_SWEEP` (which shields `noodl-mcp.cjs` **and a running
  `test:main`/`test:ci`**) never runs. The `run-editor` skill taught it; fixed in `300d7b47`.
- 🔴 **`dev:stop` kills by *checkout***, so here it kills a peer's editor and Richard's MCP servers.
  🔴 **Killing your launcher pid is NOT the safe alternative** — `dev-watchdog.js:44` runs the *same*
  sweep with **`protectAncestors: false`**. **A clean teardown is the shields, not the command.**
- 🟡 **The render harness ran ~25 minutes beside a peer's live `--dev` stack on 2026-08-16 with no
  observed collision** — it spawns its own Chrome and does not take 9222. ⚠️ **Stated as the null it
  is:** there was no arm in which a collision *would* have shown. Announce it anyway.
- Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.** The
  editor reads `node.ports` and so does the render harness's `liftInterface`. Get it wrong and the
  component has **no interface at all** — a Repeater stamps rows that render the placeholder
  `"Text"`. ✅ **F4 now catches this** (slice 3); `validate_project` still reports 0 errors, and
  F1–F3 still all pass, so F4 is the only thing standing between it and a learner.
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's
  **legacy name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`).
- ⚠️ **`%Page` in a path warns three times a lesson** — and it is the form the brief's own worked
  example teaches. The warning is correct and the example is fine; do not "fix" one against the other
  without deciding which should change.
- ⚠️ **`get_node_type` takes `type_names` (an array); `get_example` takes `id`.** Both reject the
  singular/obvious spelling with a zod error.
- 🔴 **`RouterNavigate.target` is a component legacy name** (`/#__page__/About`), never a URL path.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ zsh eats a bare `--include=*.ts`: quote it.
- 🔴 **The condition vocabulary is not guessable** — `hasParams: string[]`, **`paramsEqual`**,
  a bare `{ connection: {...} }`, **`previewRouteEquals`**, **`activeComponentEquals`**.
  ✅ `CONDITION_EXAMPLES` in `noodl-mcp/src/lessons/authoringBrief.ts` is one typed example per verb.
- 🔴 **The `lesson` group is DEFERRED.** The first `tools/list` returns **20** tools without
  `create_lesson`; `find_tools({group: "lesson"})` reveals the three and the next list returns **23**.
  **Reaching the tool is a conversation, not a call** — a client that does not refresh on
  `notifications/tools/list_changed` needs `--all-tools`. ⚠️ Richard's **registered** servers still
  run a pre-slice-2 build and cannot reach these tools; that needs a restart, or a **repackage** if
  one loads from `/Applications/…`. A server spawned from the checkout
  (`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`) is peer-safe.
- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP.** Make a stub
  count its own calls and assert the counter before each measured step.
- ⚠️ The drive bundles at `/tmp/claude-501/uni-007-drive-bundles/` carry no `solution/`, so **neither
  installs as `local-ai` any more.** Correct behaviour; it looks like a regression.
- `suggestedNodes` is still **dead** — no callers. The brief tells authors not to rely on it.
