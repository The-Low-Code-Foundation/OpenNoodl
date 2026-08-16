# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (fourteen rulings, **Blocker 1's six amendments, and the
2026-08-16 correction under the tool-surface entry** — a warning that turned out to be false), then
**`UNI-010-CRITERION-3-RUN.md`** §6, §8, §9 and §12, then
`UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md`, then `UNI-012-F4-ON-A-PACKAGED-INSTALL.md` (new,
scoped, unbuilt), then `UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`, then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue holds D15 and D16 only** (UNI-011: org-minor visibility; the never-empty
threshold). Both block *shipping*, neither blocks building. Do not re-litigate D1–D14. The four to
keep in your head:

- **D2** — the platform is **NodeGX Community**; University is its learning wing. Editor button:
  **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — ruled *against* the recommendation: a record-capped backend means UNI-008 holds end-user
  data. Five obligations; effort raised; still last.
- **D14** — the web is canonical, the **editor mirrors it via one API**. Bridge **editor-outbound
  only**.

## What happened on 2026-08-16 (twelfth session)

Three commits: `f04a4632` (docs that had been uncommitted for twelve hours), **`1332e0d1`
(`derive_starter`)**, and the docs commit this file is part of.

### ✅ `derive_starter` — UNI-010 slice 5, the handover's item 1

The starter is now **subtracted from the solution** instead of written beside it. The run supplied
the argument: **the ghostwriting refusal fired zero times in five lessons**, and §11 reads that as an
upper bound rather than a result, because every starter in the run was built by subtraction. A model
building both projects independently walks into it — the natural way to author a lesson is to build
the finished thing and describe it, at which point the starter you ship **is** the solution.

🔴 **The condition verb decides the granularity, and that is the whole design.** No amount of reading
the prose settles "add a Text" versus "type into the Text that is already there" — but the author
already chose a verb:

```
hasType · exists · hasLabel · hasPort   ->  the node is not in the starter
hasParams · paramsEqual                 ->  the node IS, with those parameters unset
connection                              ->  both nodes, no wire
routerLists                             ->  the page, listed by no router
metadata                                ->  the project setting unset
```

🔴 **The postcondition is MEASURED, and that is the point.** A derivation that guaranteed F2′ *by
construction* — and said so in its header — would make the gate's F2′ vacuous for every lesson
authored this way, and **a check that cannot fail is one nobody audits**. So every graded step is
replayed against the derived files through the real evaluator, and nothing is written if one still
holds. Both arms are in the spec.

### 🔴 Four things measured this session that were believed and wrong

1. **The handover's own cost premise.** It said *"unlike `routerLists`, this one really does cost
   surface — it is a tool, not a condition verb."* It costs **zero**: **8,223 tokens with and
   without**, 57 headroom either side. "The surface budget" was three budgets sharing a name —
   **a tool in an existing deferred group is free (0), a new group is ~25, a resident tool is its
   whole schema (276 for this one)**. ⚠️ So the constraint on CN-006/CN-009 is real but *narrower*:
   free if they extend an existing deferred group, and only a new group or a resident slot spends the
   57. Written up under RULINGS.md's tool-surface entry.
2. **My first measurement of it said 276** — because the harness registered the tool on the raw
   `server` rather than the `rec` proxy, **the exact mis-registration `toolDisclosure.test.ts`'s third
   property exists to catch**, walked into while measuring it. It came right only after registering
   through `recordTools` *and* re-running `applyPolicy`. **A measurement instrument has the same
   failure modes as the code it measures.**
3. **The `noodl-mcp` floor of 44/512 was stale** before this session started — the peer's `00f5c629`
   had already moved it to **44/519**. I measured it rather than quoting it, which is the only reason
   this slice's `+1 suite / +10 specs` is attributable.
4. **UNI-012's ruling is qualified by a fact nobody had** — see below.

### 🔴 The control run found two DEAD specs of my own — slice 4's finding, one slice later

The first disable-the-branch run had **11 of 15** failing. Two survivors:

- one asserted a refusal **indistinguishable from the mechanism being absent** (it asserted *that* it
  refused, not *why*);
- one asserted *"the solution is unchanged"*, which is true of a function that returns immediately.

Both now assert the **reason** and the **work done**, and the control is **13 of 15 failing, all 98
pre-existing uni-010 specs passing**. ✅ **Budget the disable-the-branch run to grade the tests as
well as the feature** — that instruction was in the last handover and it paid on the first try.

### ✅ UNI-012 — Richard ruled "ship the harness with the sidecar". Scoped, NOT built.

**[UNI-012-F4-ON-A-PACKAGED-INSTALL.md](UNI-012-F4-ON-A-PACKAGED-INSTALL.md)** — four things have to
move and they are named there. It was **not built on purpose**: every part of it is verifiable only
against a packaged build, and a spec asserting *"`resolveRenderCli` prefers `Resources/…`"* passes
against a layout that never exists. **Build the caller — and here the caller is `electron-builder`.**

🔴 **Two facts measured while scoping it, and the first changes what the ruling delivers:**

1. **The harness needs a system Chrome** (`render-report.js:695-730` probes for one and refuses
   without it). So shipping it makes `allow_unrendered` **rare, not unnecessary** — and the option as
   put to Richard read as though it removed the need. **Both halves of the original either/or are
   probably wanted:** ship the harness *and* have the refusal say plainly what it cannot answer.
   ⚠️ Today's refusal text becomes actively wrong the moment the harness ships — it tells a user with
   no Chrome to *"run this server from a checkout"*.
2. **Rendering through the sidecar's own Electron is closed**, and it is the obvious cheap idea. The
   registration sets **`ELECTRON_RUN_AS_NODE=1`** (`mcpCommands.ts:222`), which makes the binary a
   plain Node process with no `BrowserWindow`. That variable is load-bearing and measured — without
   it the server *still serves stdio correctly*, so a probe that forgets it looks like a pass.

## What to do next — in the order I'd pick

**1. The disclosure hole, and it is an hour.** Nothing asserts that a deferred group's tools are
actually absent from `tools/list`. `toolDisclosure.test.ts` hand-lists `provision_backend` and
`create_project` and has never named the `lesson` group, so a tool registered after
`server.ts`'s single `applyPolicy()` call is **silently resident** unless it is large enough to
breach the bar alone. One manifest-derived assertion closes it — and it is what keeps the "a deferred
tool is free" property true for whoever arrives next.

**2. UNI-012**, with a packaged build budgeted. ⚠️ It wants a checkout nobody is mid-drive on.

**3. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**4. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

**5. UNI-011**, once D15/D16 are ruled. Building is unblocked; shipping is not.

## What UNI-010 still does NOT close

- **§8.2 — F4 renders the Router's `startPage` and nothing else.** Measured at the HTTP layer: `/` →
  200, **`/home` → 404** — the start page's own `urlPath`. So anything a lesson teaches about
  `urlPath` is unmeasurable, including on the start page. Belongs to **phase 69 / CN-001**, and it
  **survives CN-001** as landed. 🔴 **UNI-012 makes F4 _run_ on a packaged install; CN-001 makes it
  _see_.** Different holes, same class — do not let one be reported as closing the other.
- **The authoring gradient is still one-directional.** `derive_starter` did not fix it and made one
  more consequence of it: a lenient condition now produces a lenient *starter* as well as a lenient
  check — a starter that hands part of the answer over. The brief says so at the point of use. F6 is
  human by definition.
- **`derive_starter` has no per-step override**, deliberately: a step whose default subtraction is
  wrong is built by hand, which is exactly today's position. `isVisualRoot` is not retractable —
  clearing the project's root leaves a starter that renders nothing at all.

## Gates (2026-08-16, slice 5)

Run and quoted rather than claimed, and **attributable because the baseline was re-measured rather
than taken from the last handover**:

- **`test:main` — 209 suites / 3248 tests, all pass.** Baseline **208 / 3233**, measured by moving the
  new suite aside and re-running: **exactly +1 suite and +15 specs**.
- **`noodl-mcp` — 45 / 529, all pass.** Baseline **44 / 519 at HEAD** (which already includes the
  peer's `00f5c629`): **+1 suite, +10 specs**. 🔴 The handover's 44/512 predates that commit.
- **`typecheck:editor` and `typecheck:editor-tests` — clean.** ⚠️ `tsc --noEmit` inside
  `packages/noodl-mcp` still reports the **9 pre-existing errors** in files this slice never touched.
- **`eslint` on every changed file — clean.** ⚠️ `packages/noodl-mcp/src/` has **6 pre-existing**
  `ProjectStore is defined but never used` errors in `renderTools.ts`, `validateTools.ts` and one
  other. Not introduced here, not fixed here.
- **`test:ci` was NOT run.** The floor to quote if you do: **6 failures by NAME** (4 ×
  `AIX-006 style vocabulary`, 2 × `AI model registry`) — **never by count**. 🔴 **Delete
  `packages/noodl-editor/tests/test-results.json` before a run and `stat` it after** — a reaped run
  and a broken build both exit 0 and write no file.
- **The MCP tool-surface budget test passes**, and unlike last time its inputs **did** change and were
  **re-measured** rather than argued from the diff.

## ⚠️ Owed, small, and honest about it

- ⚠️ **The five lesson bundles are still in a dead session's scratchpad.** Reproducible from
  `UNI-010-CRITERION-3-RUN.md` §2 and §7; the project specs and helpers are gone. Slice 5 needed none
  of them — its fixtures are file-backed and in the specs.
- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** Slice 5 was headless.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it. One
  `git clean` from gone. ✅ Phase 67's own untracked file (UNI-011) was committed this session.
- ⚠️ `scripts/node-catalog/kit-extract-spike.js` is untracked and belongs to someone else — probably
  phase 69. Left alone.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no known session.
  🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is droppable.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **Commit with `git commit <pathspecs>` and never stage.** ⚠️ **An untracked file is the one case
  that needs `git add`** — put the add and the commit in **one chain** with the message **already
  written to a file**, so the commit cannot die on message syntax and leave the index open. That is
  the window `43b2e521` swept 674 lines through.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only —
  Richard's 08-16 *"curb its enthusiasm"*. Findings go in the task file. `test:main` and `npx jest`
  are plain Node and collide only with each other; an **editor launch** or `test:ci` still wants the
  announcement, **and the teardown announced to exactly the set you announced the launch to**.
  ⚠️ **Re-list immediately before sending a teardown.** ⚠️ `SendMessage` wants the socket the message
  arrived on, not the peer's name.
- 🔴 **`pkill -f "OpenNoodl/node_modules/electron/dist"` is NOT a way to clear a stale editor** —
  measured at **13 matches, all 13 MCP servers, 0 editors**, and it bypasses `sweep()` so
  `NEVER_SWEEP` never runs. Long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP
  servers** — never kill.
- 🔴 **`dev:stop` kills by *checkout***, and **killing your launcher pid is not gentler** —
  `dev-watchdog.js:44` runs the same sweep with `protectAncestors: false`.

## Things the next person will otherwise re-derive

- 🔴 **A tool registered after `disclosure.applyPolicy()` is silently resident**, whatever the
  manifest says. Registration order inside `registerLessonTools` is load-bearing.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.** ✅ F4
  catches this since slice 3; `validate_project` still reports 0 errors.
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's
  **legacy name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`). ⚠️ This
  bit slice 5's own fixture — a control assertion caught it, which is what control assertions are for.
- 🔴 **`routerLists` is the ONE verb whose value is not a node path** — a component's legacy name,
  never a URL like `/about`.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The condition vocabulary is not guessable** — `hasParams: string[]`, `paramsEqual`, a bare
  `{ connection: {...} }`, `previewRouteEquals`, `activeComponentEquals`, `routerLists`.
  ✅ `CONDITION_EXAMPLES` in `noodl-mcp/src/lessons/authoringBrief.ts` is one typed example per verb.
- 🔴 **The `lesson` group is DEFERRED.** First `tools/list` returns **20** tools; it now reveals
  **four**, not three. **Reaching the tool is a conversation, not a call.** ⚠️ Richard's *registered*
  servers still run an old build. A server spawned from the checkout
  (`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`) is peer-safe.
- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP.**
- `suggestedNodes` is still **dead** — no callers.
