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

## ✅ UNI-010 IS DONE AS AN EXPERIMENT — criterion 3 ran 2026-08-16

All three acceptance criteria are now met. The write-up is
[UNI-010-CRITERION-3-RUN.md](UNI-010-CRITERION-3-RUN.md), and its design was **committed before a
single lesson existed** (`897a2522`) so the decision rule could not be reshaped by the data.

> **KEEP on the pre-registered rule — 5 of 5 install and are completable, ≥3 clean on the human
> read. AND the same run produced positive evidence for the kill clause.** Both halves are the
> result. The rule's own parenthetical is the disposition: *fix the format or the brief **before
> shipping the feature***.

### 🔴 The two findings, and they are the reason this is not "shipped" yet

Both are about **F4** — the class the prior arc pre-registered as *the top defect* — and neither is
about a lesson being wrong. They are about the gate not being able to see that it was.

1. **F4's verdict throws away the render harness's own defect findings.** A lesson whose Repeater
   stamps three `dead-placeholder-text` rows scores **F1–F4 all pass** and writes. `rendered` is
   `drawnElementCount > 0`, so **one real heading vouched for three broken rows**, and the harness's
   error line sat unread in `findings`. 🔴 **The control pair is the sharp end:** the broken and
   fixed bundles differ by **one JSON key in one node** and their scorecards are
   **character-for-character identical**. `validate_project` also says 0 errors.
   ⚠️ This is one level *above* "clean can mean EMPTY": F4 correctly insists on a drawn count, and
   then a **project-level** count lets unrelated content vouch for a broken mechanism.
2. **F4 renders the Router's `startPage` and nothing else.** A lesson that *teaches building a second
   page* has its entire subject unscored — a dead placeholder there is invisible to F4 **and** to
   F2, and the bundle writes. Three variants of that solution all report `Rendered clean … 2 texts`,
   which is the direct evidence the page is never visited. 🔴 **Upstream of UNI-010** —
   `render_report` has the same blind spot. **Already written into
   [CN-001](../phase-69-the-node-you-write-yourself/CN-001-THE-EYES-MUST-SEE-KITS.md)**, which owns
   that file. It **survives CN-001**, measured, not assumed.

**§12 lists what to do about them.** Fix 1 is a verdict change, not new machinery — the information
is already in `WholeSolutionResult.findings`.

### 🔴 The human read's finding, which is structural rather than about my lessons

**Five steps across four lessons check LESS than their prose asks for**, and the leniency is always
in the same direction. The cause:

> **F2 punishes a condition that is too strong and nothing punishes one that is too weak.**

So the gradient an authoring model sits on points at under-checking, on *every* lesson, and F6 —
the class that would catch it — is human-only by definition. Two of the five have real consequences
(a `Static Array` left on `type: csv`; a page component created outside the Router's `pages` list,
which navigates nowhere). ⚠️ **The second one is a format gap:** there is no comfortable verb for
"the Router lists this component", and `paramsEqual` on a nested object with an array in it is not
one.

### ✅ Item 2 from the last list is CLOSED, and it did not need Richard

`create_lesson` **is** reachable over a real MCP stdio connection. A server spawned from the
checkout (`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`) is peer-safe and
touches nothing of Richard's, and every scorecard in the run came back through it.

🔴 **The `lesson` group is DEFERRED.** The first `tools/list` returns **20** tools and
`create_lesson` is not among them; `find_tools({group: "lesson"})` reveals the three and the next
list returns **23**. **Reaching the tool is a conversation, not a call** — a client that does not
refresh on `notifications/tools/list_changed` needs `--all-tools`, which the server says itself.

⚠️ Still open and still Richard's: his **registered** servers run a pre-slice-2 build and cannot
reach these tools. That needs a restart, or a **repackage** if one loads from `/Applications/…`.

## 🔴 A trap this run paid for, and it is not phase-specific

**A constraint checked at the START of a run is not discharged for the LENGTH of the run.**

The pre-registration checked phase 69's CN-001 ordering constraint, found phase 69 had no code, and
wrote "discharged". **CN-001 then landed mid-run** — `ed28a03c`, on disk at 00:26:13, between L3 and
L4 — so the dataset was split across two instruments, exactly what the constraint existed to
prevent. Nothing about the original check was wrong when it was made, which is precisely why it
stopped being re-examined. **In a shared checkout, re-check an ordering constraint at the END.**

✅ Corrected by **measuring** rather than by arguing that lesson projects carry no kits: all three
pre-CN-001 solutions were re-rendered on the new instrument and return identical readings, and both
findings were reproduced end-to-end post-CN-001. The conclusions are instrument-independent.

## What to do next — in the order I'd pick

**1. Close finding 1 (§8.1).** F4 should fail, or at minimum warn loudly, when the render's own
findings include `dead-placeholder-text`. Small, well-understood, and it is the difference between
UNI-010 being an experiment that passed and a feature that can ship. 🔴 **Build the caller** — this
phase is six for six on that, and a verdict change is exactly the shape that reads fine in review.

**2. The F4 packaged-install scope call is STILL Richard's and still open.** `scripts/` is not in
`build.files`, so on a packaged install F4 is checked by **nobody**. Two options: ship the render
harness with the sidecar, or have `create_lesson` say plainly that a packaged install cannot answer
F4 and that `allow_unrendered` is then the *ordinary* case. ✅ **CN-001 has now landed**, and it
moved the pure half into a workspace package — the structural half of option one — so **put it in
front of him with the call, not after it.** 🔴 **Do not quietly pick one.**

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

## Gates (2026-08-16)

This session wrote **no production code** — five docs commits and phase 69's CN-001 file. So no gate
was owed and none was run, and that is the honest statement rather than a claim of a clean tree.

⚠️ **The floor to quote if you do run one:** `test:ci` at **6 failures by NAME** (4 × `AIX-006 style
vocabulary`, 2 × `AI model registry`) — **never by count**, `totalCount` drifts with whoever's specs
are in the tree. `test:main` was **203 / 3138** on the tree that became `58d5aa8e`. 🔴 **Delete
`packages/noodl-editor/tests/test-results.json` before a run and `stat` it after** — a reaped run
and a broken build both exit 0 and write no file, and **npm exits non-zero on a clean floor run**.

## ⚠️ Owed, small, and honest about it

- ⚠️ **The five lesson bundles live in this session's scratchpad and will not survive it.** They are
  reproducible: `UNI-010-CRITERION-3-RUN.md` §2 has the five requests and §7 the verdicts, but the
  project specs and the `mkproject.js`/`mcpsession.js` helpers are gone with the session. **If the
  next slice wants a regression corpus, budget to rebuild them.**
- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A previous session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** This run was headless and did not touch it.
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
- 🔴 **`dev:stop` kills by *checkout***, so here it kills a peer's editor and Richard's MCP servers.
  🔴 **Killing your launcher pid is NOT the safe alternative** — `dev-watchdog.js:44` runs the *same*
  sweep with **`protectAncestors: false`**. **A clean teardown is the shields, not the command.**
  ⚠️ **This corrects an earlier version of this file**, which told you to kill by pid on a peer's
  2026-08-16 teardown; that peer retracted it themselves (`db8efa74`). Their `ps`-showed-zero
  measurement is still sound — it just measures *their stack died*, not *nothing else did*.
- ✅ **`test:main` is safe beside a `test:ci` or a live editor** — plain Node. Only another
  `test:main` collides.
- 🟡 **The render harness ran ~25 minutes beside a peer's live `--dev` stack on 2026-08-16 with no
  observed collision** — it spawns its own Chrome and does not take 9222. ⚠️ **Stated as the null it
  is:** there was no arm in which a collision *would* have shown, so this is "not seen to collide
  once", not "is safe". Announce it anyway.
- Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.** The
  editor reads `node.ports` and so does the render harness's `liftInterface`. Get it wrong and the
  component has **no interface at all** — a Repeater stamps rows that render the placeholder
  `"Text"` — and **nothing tells you**: F1–F4 all pass and `validate_project` reports 0 errors.
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
- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP.** Make a stub
  count its own calls and assert the counter before each measured step.
- ⚠️ The drive bundles at `/tmp/claude-501/uni-007-drive-bundles/` carry no `solution/`, so **neither
  installs as `local-ai` any more.** Correct behaviour; it looks like a regression.
- `suggestedNodes` is still **dead** — no callers. The brief tells authors not to rely on it.
