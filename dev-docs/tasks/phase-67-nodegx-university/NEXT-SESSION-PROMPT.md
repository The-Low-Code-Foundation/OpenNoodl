# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's six amendments** —
the sixth is from 2026-08-15 and is not about a check, a feature, or a comment), then
`UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md` (slices 1–2 and the criterion 2 drive), then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`, then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY.** Do not re-litigate D1–D13 — if one is wrong, amend `RULINGS.md`
with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; University is its learning wing. Editor button:
  **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — ruled *against* the recommendation: a record-capped backend means UNI-008 holds end-user
  data. Five obligations; effort raised; still last.
- **D13** — coaching delivery (**LearnBook**) is **phase 68**, platform stack, after Tier 1 + UNI-004.

## ✅ UNI-010 criterion 2 DRIVEN 2026-08-15 (`58d5aa8e`) — 8 of 8, and one real finding

Eight consequences were written down **before** the producer ran and before the editor launched,
each phrased so it could not also be true of a broken feature. All eight passed.

Four bundles were derived from **one** producer run, so no arm could differ by accident:

| `authoredBy` | `solution/` | Outcome at the real launcher |
|---|---|---|
| `"ai"` — **stamped by the producer**, absent from the input manifest | yes | installed · **"Written locally"** |
| *line deleted* | yes | installed · **"From disk"** |
| `"ai"` | **no** | 🔴 **REFUSED**, naming F2 and F3 |
| *line deleted* | **no** | installed · **"From disk"** |
| `"curated"` | yes | installed · **"From disk"** — the claim ignored |

🔴 **The bottom pair is the result, not the labels.** `diff -rq` says the two directories differ in
one file; `diff` says that file differs by one line; **one is refused and the other installs.** That
is the trust asymmetry's *bite* — the three-class gate really does reject a bundle the one-class gate
accepts.

Grading was measured, not assumed: the AI arm and a non-AI twin with identical steps returned the
**same sentence**, and it is not a constant — adding `Text#Greeting` to the AI arm's live graph moved
it from *0 of 2, 1 element drawn* to *1 of 2, 2 elements drawn*, **both engines moving on one edit**.

Only the OS folder picker's return value was stubbed; the real "Install a lesson…" button was
clicked, so the shipped handler ran untouched.

### 🔴 THE FINDING TO CARRY: F4 is checked by nobody for a real user

Slice 2 recorded F4 as *"a hole at the installer, answered by the producer"*. Running the producer
returns:

> *"The render harness is not present in this installation — `render_report` needs the repo checkout
> (`scripts/devtools/measure-from-disk.js`)."*

And **UNI-007 had already written down why, one slice earlier, about this same file**: *"`scripts/`
is not in `build.files` … so that route works in this checkout and is dead for every real learner."*

> **Join them: on a packaged install, F4 — the class the prior arc predicted would DOMINATE — is
> checked by neither the installer nor the producer.**

Both sentences were true; each was local to its own slice; from either end the hole read as covered
by the other. **A hole recorded in two halves is not a recorded hole.** This is the sixth
"build the caller" instance and the first where the evidence already existed and was merely
unassembled.

⚠️ **NOT FIXED — it is a scope call and it is flagged to Richard**, not taken. The two options:
ship the render harness with the sidecar, or have `create_lesson` state plainly that a packaged
install cannot answer F4 and that `allow_unrendered` is then the *ordinary* case rather than a named
exception. **Do not quietly pick one.**

✅ Workaround when authoring from a checkout, and it works:
`NODEGX_RENDER_CLI=<repo>/scripts/devtools/measure-from-disk.js` — F4 then passes for real.

### ✅ The one code change: the asymmetry's precondition is now executable

The slice-3 author, reviewing slice 2, pointed out that honouring `authoredBy: "ai"` is safe **only
while `local-ai` is strictly the most demanding row** in `REQUIRED_CLASSES`. An AI fast-path
(*"the producer already scored F2, skip it at install"*) reverses the incentive and makes the field
worth forging — **and it would arrive in review looking like an optimisation.**

Two specs now hold it, and the guard was **proved to bite rather than assumed to**: setting
`'local-ai': ['F1']` fails five tests; reverting passes 18/18. ⚠️ Only the *structural* superset test
catches that mutation — the behavioural twin beside it guards a different regression (a provenance
branch inside `decideInstall`). Two tests, two failure modes, neither redundant.

## What to do next — in the order I'd pick

**1. Criterion 3 — the five-lesson run.** This is the experiment the task exists for, it is the last
thing standing between UNI-010 and a verdict, and **everything it needs now exists.** Run it against
the pre-registered kill/keep criteria (≥3 of 5 install and are completable + worth completing).
Score F1–F4 mechanically per lesson (LEARN-009's harness output is the evidence; ≥3-of-5 is the
decision rule).

🔴 **Two traps that will bite this specifically:**

- **The harness refuses a lesson already complete in its starter** — *"This step is already complete
  in the project the learner opens, so it will tick itself the moment they arrive."* I hit this
  building a control. It matters because **the natural way to author a lesson is to build the
  finished thing and describe it**, at which point the starter you ship *is* the solution. A model
  told "write me a lesson" has every reason to return exactly that, so expect this to be a common
  rejection and count it honestly as an authoring-reliability data point, not as noise.
- **F4 will be `not-checked` unless you set `NODEGX_RENDER_CLI`.** If you run the five-lesson
  experiment without it you will be scoring the arc's *predicted top defect* as unmeasured, which
  would make the verdict much weaker than it looks.

**2. Drive `create_lesson` over the real stdio transport.** Still undriven. Richard's registered
servers run a pre-slice-2 build — confirmed rather than assumed: `find_tools`' group argument enum
is `backend|docs|explore|project|theme`, with no `lesson`. Reaching the three new tools needs a
restart, and if a server loads `/Applications/…` rather than the checkout it needs a **repackage**,
not `npm run build`. **Richard's call.**

**3. Ergonomics: two projects, one bound server.** `create_lesson` takes two project *directories*,
so the authoring model must produce starter and solution itself. A `derive_starter` step is the
obvious slice-3 candidate — and it would also make the already-complete-starter rejection above
mostly disappear, which is now a measured reason to build it rather than a guess.

**4. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**5. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

## Gates (2026-08-15, on the tree that became `58d5aa8e`)

| Gate | Result |
|---|---|
| `npm run test:main` | ✅ **203 suites / 3138 tests, 0 failures** — 🔴 **new floor** (was 203/3136; +2 are this commit's) |
| `npx tsc -p tsconfig.json --noEmit` (editor) | ✅ exit 0, no emit into `src/` |
| `npx eslint` on both touched files | ✅ clean |
| `npx jest tests-unit/uni-010` | ✅ 4 suites / **64 tests** |
| `npm run test:ci` | ✅ **DISCHARGED — at the floor.** `2840 / 6` at pinned seed 39393, `test-results.json` mtime **17:42:22** (checked, not inferred). Run by a phase-66 peer over a tree containing `58d5aa8e` |

✅ **`test:ci` was run by a phase-66 peer over a tree carrying this commit plus their own
uncommitted FIX-001 work, and the six failures are the documented floor by name** — 4 × `AIX-006
style vocabulary`, 2 × `AI model registry`, zero `BEN-001`. The `totalCount` delta (2840 − 2814 = 26)
is **exactly their new specs**, which is the coherent check for my half: my two specs live in
`tests-unit/`, which the electron suite does not run, so this commit was expected to move
`totalCount` by **zero** and did. What it *did* prove is the half I could not: **`58d5aa8e` compiles
under Electron**, which neither `tsc` nor `test:main` establishes.

⚠️ **Quote the floor by NAME (6), not by count.** `totalCount` drifts with whoever's specs are in the
tree — 2788, 2812, 2814 and 2840 have all been correct today. And remember **npm exits non-zero on
any failure, so a clean floor run looks failed at the shell**; **delete
`packages/noodl-editor/tests/test-results.json` before the run and `stat` it after** — a reaped run
and a broken build both exit 0 and write no file.

🔴 **A trap from that same run, and it is not phase-specific.** The peer's first `test:ci` exited 0
and wrote no results file — the broken-build signature — because one new spec used
`expect.arrayContaining`, a **jest** matcher, in `tests/`, which is **jasmine**. It had passed in
their scratch plain-Node jest config. The measurement that followed is worth having:

```
npx tsc -p tsconfig.json --noEmit --listFiles | grep -c "noodl-editor/tests/"   →  0
```

**The editor typecheck reads zero files under `tests/`** (`include` is `src/editor`, `src/shared`,
`src/main`). So a type-broken spec there is green in `tsc`, green in a scratch jest runner with the
wrong matchers, and reported by the only gate that covers it as an **exit 0**. If you use a scratch
jest config for fast feedback on `tests/`, use only matchers **both** runners have.

## ⚠️ Owed, small, and honest about it

- 🔴 **A measurement I spoiled, recorded rather than dropped.** D5 says a lesson must never enter the
  recents list. I backed up `recently_opened_project.json`, compared after, found it **differed**,
  and restored it **before diffing the entries** — so I cannot say whether that was my lessons or
  ordinary launcher churn. What I can say: the restored file (which already contained slice 4's
  lesson opens) has **zero entries referencing the Learning folder**. **Next drive: diff the entry
  ids before restoring.**
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it. One
  `git clean` from gone.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no session in today's
  conversations. 🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is
  droppable.
- 🔴 **`scripts/devtools/dev-processes.js` is still UNCOMMITTED** and is the only thing stopping an
  editor launch or teardown from reaping a running `test:ci`. Verified absent from `HEAD` by a peer
  at 17:20. It is on Richard's owed list; **it is not phase 67's to commit**, and one
  `git checkout --` on that path loses it silently.
- ⚠️ **The sweep fix is still UNPROVEN in the wild.** My launch and teardown ran with it loaded and
  reaped nothing — but **no suite was running**, so that shows only that it does not break a normal
  launch. Nobody has yet observed a live suite surviving a post-edit stack's shutdown.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call (the
  Bash cwd persists); **explicit pathspecs** — the tree routinely holds two or three sessions' work.
- 🔴 **This checkout is SHARED — 15 sessions were live on 2026-08-15.** Announce over `SendMessage`
  before `test:main`, `test:ci` or an editor launch, **and announce the teardown to exactly the set
  you announced the launch to.** A broadcast launch with a unicast close manufactures a phantom
  reservation that outlives the session holding it — that cost three sessions six hours today.
  Announce the **transition** too, if you are doing a drive *then* a suite.
- 🔴 **Announce your PIDs once the stack is up, not just your intent.** `nohup` reparents the tree to
  PID 1, so an editor stack is only ever attributable from its owner's announcement.
- 🔴 **`dev:stop` kills by *checkout***, so here it kills a peer's editor. **Kill your launcher pid
  instead** — that spared all 26 of Richard's `noodl-mcp.cjs` processes, verified either side.
- ✅ **`test:main` is safe beside a `test:ci` or a live editor** — plain Node. Only another
  `test:main` collides.
- Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP** — stubs and
  the `__wreq` handle both. The next click falls through to the real implementation and **looks
  exactly like the feature under test doing nothing.** Make the stub count its own calls and assert
  the counter; re-assert instrumentation before each measured step. This cost me one step and would
  have cost a false result if I had only re-read the DOM.
- 🔴 **`forEachNode` STOPS on a truthy return.** `forEachNode(n => arr.push(x))` returns `push`'s
  number and silently visits **one node**. Use a block body.
- 🔴 **A modal eats the check-my-work click at exactly `1166,715`** — the lesson intro popup
  (`.popup-layer dim`). `document.elementFromPoint(x, y)` is the check; dismiss with
  `button.lesson-next-button`. An **error toast is also sticky** and sits over the same button —
  close it via `[class*=ToastCard-module__Close]`.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ zsh eats a bare `--include=*.ts`: quote it.
- 🔴 **The condition vocabulary is not what you would guess** — `hasParams: string[]`,
  **`paramsEqual`**, `{ connection: { from, to, fromPort, toPort } }`, **`previewRouteEquals`**,
  **`activeComponentEquals`**. ✅ You no longer have to remember it: `CONDITION_EXAMPLES` in
  `noodl-mcp/src/lessons/authoringBrief.ts` is one typed example per verb and the spec compiles
  all of them.
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's
  **legacy name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`).
- ⚠️ **Deleting a node from a project file leaves its wires behind**, and the whole-solution grader
  correctly calls that `dangling-connection` / invalid. If you hand-build fixtures, prune
  connections whose `fromId`/`toId` no longer exist — the grader caught mine.
- ⚠️ The drive bundles at `/tmp/claude-501/uni-007-drive-bundles/` carry no `solution/`, so **neither
  installs as `local-ai` any more.** Correct behaviour; it looks like a regression. Mine, which do
  carry one, were scratch and are gone with the session.
- 🔴 **⌘C over any panel prose copies the selected canvas NODE instead** (phase-66). Not this
  phase's to fix.
- `suggestedNodes` is still **dead** — no callers. The brief tells authors not to rely on it.
