# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's six amendments**),
then **`UNI-010-CRITERION-3-RUN.md`** (the experiment is finished — read its §6, §8, §9 and §12),
then `UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md`, then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`, then `TASKS.md`. `PRIOR-ART-RECONCILIATION.md` if
you have not read it before.

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

## ✅ UNI-010 is finished as an experiment. Criterion 3's own recommendation list is now empty.

All three acceptance criteria were met 2026-08-16 against a rule pre-registered and committed
**before a single lesson existed** (`897a2522`): **KEEP — 5 of 5 install and are completable, ≥3
clean on the human read** — *and* the same run produced positive evidence for the kill clause, which
is why slices 3 and 4 followed. **Both halves were the result, and both have now been acted on.**

### ✅ Slice 4 (2026-08-16) — §12.3 and §12.4, the run's last two items

**§12.4 — `routerLists`, the one hole better authoring could not have closed.** L4 told the learner
to create a page *from the Router's Pages list* and graded it by checking the page's Text — true of a
component created any other way, and a component created any other way is **unreachable**, so the
next step's navigation silently does nothing while every step ticks green. There was no verb for it:
`paramsEqual` on `pages` would have to restate the whole `{startPage, routes}` value, so it breaks
the moment the learner adds any other page, and it cannot express "contains".

```json
{ "routerLists": "/#__page__/About" }                          // any router lists it
{ "node": "App:%Router", "routerLists": "/#__page__/About" }   // that one does
```

**§12.3 — the brief now names the gradient out loud.** *"F2 punishes a condition that is too strong
and nothing punishes one that is too weak, so check what your prose asked for"*, with the question to
ask and the two shapes it took in the run. Not a gate — F6 is human by definition — and it is the
only lever there is. ⚠️ **The brief's F4 paragraph was stale in the same file** and is corrected: it
described the pre-slice-3 check and never said F4 renders **the start page only**.

🔴 **Four judgements inside slice 4 worth not re-deriving:**

1. **`node` is optional by design, not for convenience.** Unscoped, the verb asks what the learner's
   app cares about — *is this page reachable from anywhere*; scoped, it names one router, for a
   lesson teaching a Page Stack or nested routing. It compiles to **no `path` key at all**, never
   `path: ''`, which would resolve to no component and be a silent never-completes.
2. **The semantics are borrowed, not restated** — `ROUTER_NODE_TYPES`, `readRouterPagesValue` and
   `isSamePage` come from `pageRegistration.ts`, the module the editor's own apply path writes
   `routes` with.
3. 🔴 **The purity claim was MEASURED**, because RULINGS.md's fifth amendment is exactly about a
   module-header claim nobody could falsify: two sidecar builds back to back are **5,911,294 and
   5,911,848 bytes**, and `readRouterPagesValue` is already in the *control*. **554 bytes, no new
   dependency.** Do not accept a purity comment here — build it.
4. ✅ **It cost ZERO MCP tool surface.** `create_lesson` takes the manifest as an **opaque
   passthrough envelope**, so a condition verb never reaches a tool schema. **The 57 free tokens are
   still free and CN-006/CN-009 are not competing with this** — a `derive_starter` is what would
   spend them.

✅ **Graded as the control pair the finding actually was** — the finding was never *"a lesson was
wrong"*, it was *"two projects that differ in whether the learner's app works score identically"*.
Both arms are in the spec, the **old condition passes both** (asserted as the finding, not as a
guard), and re-run with the branch disabled **14 of 25 new specs fail and all 251 pre-existing pass**.

⚠️ **The control run also graded my own specs, and two were dead.** Both asserted `F2: 'fail'` alone
and **passed with the verb disabled**, because a condition false everywhere fails F2 too. *A failure
that would look identical if the mechanism were missing measures nothing.* Both now assert the
finding **code** — which is why the control's count went 12 → 14. **Budget the disable-the-branch run
to grade the tests as well as the feature.**

### 🔴 Slice 4 has NO commit of its own — read this before touching `43b2e521`

All nine files were staged and then swept into a **peer's** commit `43b2e521` *"feat(fix-004): the
Number() operator and the log block"*, between the `git add` and the `git commit`. **Nothing is lost
and the tree is correct** — the files there are byte-identical to what was written and reviewed.

- 🔴 **`43b2e521` cannot be reverted or re-authored without taking UNI-010 slice 4 with it.**
- **Deliberately not rewritten**: re-authoring a commit a live sibling made minutes earlier, on the
  checkout it is still working in, is a worse hazard than a mixed message. `2485bb2f` records it.
- ✅ **The habit that would have prevented it:** `git commit <pathspecs> -m …` — never stage at all.
  My `add && …` chain **died on a bad flag** (`git status --cached`), leaving the index open across
  two verification calls. **The step you add for safety is the window.**

## 🔴 What UNI-010 still does NOT close

- **§8.2 — F4 renders the Router's `startPage` and nothing else.** A lesson that *teaches* a second
  page has its subject unscored, and a dead placeholder there is invisible to F4 **and** F2 — and to
  slice 3's defect check, which can only see what the render rendered. 🔴 **Upstream of UNI-010**:
  `render_report` has the same blind spot, measured at the HTTP layer (`/` → 200, **`/home` → 404**,
  i.e. even the start page's own `urlPath`). Written into
  [CN-001](../phase-69-the-node-you-write-yourself/CN-001-THE-EYES-MUST-SEE-KITS.md), and it
  **survives CN-001**, measured rather than assumed. ⚠️ Slice 4 made this *more* visible, not less —
  the brief now tells authors of multi-page lessons to check their own subject by hand.
- **The F4 packaged-install scope call is STILL Richard's**, and it is now the only UNI-010 item
  waiting on a person. `scripts/` is not in `build.files`, so on a packaged install F4 is checked by
  **nobody** — and a sharper F4 that never runs is still a sharper F4 that never runs. Two options:
  ship the render harness with the sidecar, or have `create_lesson` say plainly that a packaged
  install cannot answer F4 and that `allow_unrendered` is then the *ordinary* case. ✅ CN-001 moved
  the pure half into a workspace package — the structural half of option one — so **put it in front
  of him with the call, not after it.** 🔴 **Do not quietly pick one.**
- **The authoring gradient is still one-directional.** Slice 4 gave an author a way to say the thing;
  nothing makes them say it. That is F6 and F6 is human by definition. The other four rows of §9's
  table are untouched on purpose — they are authoring choices better authoring *could* have made.

## What to do next — in the order I'd pick

**1. Ergonomics: `derive_starter`.** Now the obvious next slice with nothing ahead of it. The run
added the reason: every starter in it was built by *subtraction from the solution*, which is why the
already-complete-in-the-starter refusal fired **zero times in five lessons**. A model building two
projects independently is far more exposed to it. 🔴 **Budget it first** — 57 tokens free against a
bar renegotiated twice, and *"there should not be a third"* is written into the test. Phase 69's
CN-006/CN-009 compete for the same 57. If it does not fit, the sanctioned move is a `$ref`ed node
schema (inlined three times today). ⚠️ **Unlike `routerLists`, this one really does cost surface** —
it is a tool, not a condition verb.

**2. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**3. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

**4. UNI-011**, once D15/D16 are ruled. Building is unblocked; shipping is not.

## Gates (2026-08-16, slice 4)

Run and quoted rather than claimed. 🔴 **Two `test:main` numbers, and they answer different
questions** — the sweep split them, so do not merge them:

- **`test:main` on slice 4 alone — 206 suites / 3196 tests, all pass.** The floor was 205 / 3171;
  slice 4 added **exactly one file and 25 specs**, so both numbers are **predicted, not discovered**,
  and therefore attributable to this slice.
- **`test:main` on HEAD after the sweep — 207 / 3211, all pass**, re-run rather than inferred. The
  extra suite and 15 tests are the peer's `tests-unit/fix-004/blocks.spec.ts`.
- **`noodl-mcp` — 44 suites / 512 tests, all pass** (floor 44 / 510, plus this slice's 2 brief specs).
- **`typecheck:editor` and `typecheck:editor-tests` — clean.** ⚠️ `tsc --noEmit` inside
  `packages/noodl-mcp` still reports the **9 pre-existing errors** in files slice 3 and 4 never
  touched (`disclosure.ts`, `interfaceGate.test.ts`, `stagingDiagnostics.test.ts`,
  `connectionPresentation.test.ts`). **Not introduced here, not fixed here** — worth someone's time,
  because a typecheck nobody can run clean is a typecheck nobody runs.
- **`test:ci` was NOT run.** The floor to quote if you do: **6 failures by NAME** (4 ×
  `AIX-006 style vocabulary`, 2 × `AI model registry`) — **never by count**, `totalCount` drifts with
  whoever's specs are in the tree. 🔴 **Delete `packages/noodl-editor/tests/test-results.json`
  before a run and `stat` it after** — a reaped run and a broken build both exit 0 and write no file.
- ✅ **The MCP tool-surface budget test passes and its inputs are provably unchanged**:
  `git diff --stat` over `noodl-mcp/src/tools/` and `instructions.ts` is empty. Argued from the diff,
  **not re-measured** — say so if you quote it.

## ⚠️ Owed, small, and honest about it

- ⚠️ **The five lesson bundles live in a dead session's scratchpad.** Reproducible —
  `UNI-010-CRITERION-3-RUN.md` §2 has the five requests and §7 the verdicts — but the project specs
  and the `mkproject.js`/`mcpsession.js` helpers are gone. **If a slice wants a regression corpus,
  budget to rebuild them.** ✅ Neither slice 3 nor slice 4 needed them: the MCP adapter's recorded
  fixtures in `packages/noodl-mcp/tests/fixtures/render/` carry the same control pair, and slice 4's
  pair is a pure file-backed fixture in the spec itself.
- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A previous session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** Slices 3 and 4 were both headless and did not touch it.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it.
  One `git clean` from gone.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no known session.
  🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is droppable.
- ✅ **`scripts/devtools/dev-processes.js` is committed and clean** — checked 2026-08-16. It was on
  the owed list as "possibly uncommitted"; it is not. Nothing to do.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call (the
  Bash cwd persists). ✅ **Commit with `git commit <pathspecs>` and never stage** — the tree
  routinely holds two or three sessions' work, and slice 4 proved the index window is real.
- 🔴 **This checkout is SHARED** — 15 peer sessions were live on 2026-08-16. ⚠️ **Weigh announcing
  against Richard's 08-16 instruction to *"curb its enthusiasm"*:** peer messages are for
  **blocking or hazardous** things only, findings go to the task file. `test:main` is plain Node and
  collides only with another `test:main`, so slice 4 ran it **without** a 15-way broadcast — a
  judgement call, and one Richard can overrule. An **editor launch** or `test:ci` is a different
  matter and still wants the announcement, **and the teardown announced to exactly the set you
  announced the launch to.** ⚠️ **Re-list immediately before sending a teardown** — the roster moves
  in both directions inside two minutes. ⚠️ `SendMessage` rejects a bare peer name; send the ` [ref]`
  it quotes back.
- 🔴 **`pkill -f "OpenNoodl/node_modules/electron/dist"` is NOT a way to clear a stale editor** — a
  P66 session measured it 2026-08-16 at **13 matches, all 13 MCP servers, 0 editors**, and `pkill`
  bypasses `sweep()` so `NEVER_SWEEP` (which shields `noodl-mcp.cjs` **and a running
  `test:main`/`test:ci`**) never runs. The `run-editor` skill taught it; fixed in `300d7b47`.
- 🔴 **`dev:stop` kills by *checkout***, so here it kills a peer's editor and Richard's MCP servers.
  🔴 **Killing your launcher pid is NOT the safe alternative** — `dev-watchdog.js:44` runs the *same*
  sweep with **`protectAncestors: false`**. **A clean teardown is the shields, not the command.**
- Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.** The
  editor reads `node.ports` and so does the render harness's `liftInterface`. Get it wrong and the
  component has **no interface at all** — a Repeater stamps rows that render the placeholder
  `"Text"`. ✅ **F4 catches this since slice 3**; `validate_project` still reports 0 errors and
  F1–F3 still all pass, so F4 is the only thing standing between it and a learner.
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's
  **legacy name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`).
- 🔴 **`routerLists` is the ONE verb whose value is not a node path** — it takes a component's legacy
  name, the same string a `RouterNavigate.target` aims at, never a URL like `/about`. Writing a node
  path there is refused as `unmatchable-node-path`, because the two sit one line apart in the same
  object and that adjacency is what invites the mistake.
- ⚠️ **`%Page` in a path warns three times a lesson** — and it is the form the brief's own worked
  example teaches. The warning is correct and the example is fine; do not "fix" one against the other
  without deciding which should change.
- ⚠️ **`get_node_type` takes `type_names` (an array); `get_example` takes `id`.** Both reject the
  singular/obvious spelling with a zod error.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ zsh eats a bare `--include=*.ts`: quote it.
- 🔴 **The condition vocabulary is not guessable** — `hasParams: string[]`, **`paramsEqual`**,
  a bare `{ connection: {...} }`, **`previewRouteEquals`**, **`activeComponentEquals`**, and now
  **`routerLists`**. ✅ `CONDITION_EXAMPLES` in `noodl-mcp/src/lessons/authoringBrief.ts` is one
  typed example per verb, and a spec compiles every one of them through the real `compileConditions`.
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
