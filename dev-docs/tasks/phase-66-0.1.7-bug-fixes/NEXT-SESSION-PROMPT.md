# Phase 66 — next session

**Written 2026-08-14, session 5 (rulings + build + drive + a paid drive).** **The seven-ruling
sitting is done** — seven tasks unblocked in one go, and one of them (FIX-003) went *bigger* than
its recommendation. **FIX-007 is CLOSED**: fix 4 built and driven, and Richard authorised the paid
run that closed criterion 1's internal-AI half. Two more premises were checked and **did not
survive**: fix 3 is redundant, and the ⚠️ rider is not a defect. This file is rewritten at the end
of **every** session — read §0 for how, and replace it rather than appending.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session (the phase-57/60/61 convention).
It carries exactly four things and nothing else:

1. **Built vs. driven**, per task, as a table — the phase-64 discipline. *Built* is code plus gates;
   *driven* is the app doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with the rulings still owed by Richard called out
   separately from the work an agent can do alone.

Learnings that outlive the phase go to memory, not here. This file is the phase's working state;
memory is the repo's. Both get written at the end of a session — the memory index line is what makes
a learning findable six phases later.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-020** | ✅ | ✅ **3/3** | five popups, both themes — **CLOSED** |
| **FIX-010** | ✅ | ✅ **3/3** | picker anchors + stickiness survives — **CLOSED** |
| **FIX-018** | ✅ | ✅ **5/5** | chip + stacked edge + freed icon slot + menu — **CLOSED** |
| **FIX-007** fixes 1, 2 | ✅ | ✅ | docs + write-time gate, through the real MCP door |
| **FIX-007** fix 4 | ✅ | ✅ | **76 ms vs 2017 ms**, with its control in the same run |
| **FIX-007** fix 3 | 🔴 **struck** | n/a | premise false twice over — do **not** rebuild it |
| **FIX-007** rider | ✅ **closed** | n/a | not a defect; a guard spec already pins it |
| **FIX-007** crit 1 | ✅ | ✅ **both halves** | internal AI wrote `in-items`/`out-text`, **right first time** |
| **FIX-008** A, B, E | ✅ | ✅ | idempotent Connect, backfill on open, bound directory |
| **FIX-008** C, D | 📋 **not built** | — | C stops it recurring; D removes the class |
| FIX-002/003/009/011/012/014/019 | 📋 open | — | ✅ **all seven now RULED** — buildable by an agent alone |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

✅ **FOUR tasks closed — FIX-020, FIX-010, FIX-018 and now FIX-007 (4/4 criteria).** Nothing built
is waiting on a drive, and nothing in the phase is waiting on a paid request.

---

## 2. Gate readings

| Gate | Reading (2026-08-14, session 5, on top of `8b8c25d4`) |
|---|---|
| `test:ci` | ✅ **2748 total / 6 failed, seed 04814** — all six inherited, by name |
| `test:main` (jest: `tests-main` + `tests-unit`) | ✅ **188 suites / 2880 tests, 0 failed** |
| MCP suite (`packages/noodl-mcp`, jest) | ✅ **41 suites / 467 tests, 0 failed** |
| `tsc -p packages/noodl-editor/tsconfig.json --noEmit` | ✅ **0 errors** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ **0 errors** |
| catalog trio, `cloud-library:check` | unchanged — **no catalog, node or library file touched** |

The six `test:ci` failures, by name: `AIX-006 style vocabulary` ×4 · `AI model registry` ×2 — the
same six as sessions 2, 3 and 4, now confirmed on a **different seed** (34417 → 04814), so they are
not seed-dependent.

✅ **`test:ci` 2736 → 2748 is exactly the 12 new specs** in
`tests/nodegraph/urgent-health-pass.spec.ts`. `test:main` is unchanged at 2880, which is correct:
this session added jasmine specs only.

⚠️ **Read `packages/noodl-editor/tests/test-results.json` — and check its mtime.** Session 4 read it
before its own run finished and got the previous session's numbers back, seed and all. A results
file is only yours if it is younger than your run. (Baseline this session was 19:39; the real
reading was 20:38.)

---

## 3. What this session settled — do not re-derive

### The seven rulings, all made

Six went to the written recommendation. **One did not:**

🔴 **FIX-003 — Richard ruled "invert the global `user-select` rule NOW"**, against the
opt-in-per-surface recommendation. That **enlarges the task from S→M into M/L**: the drag-surface
test plan that was going to be deferred is now in scope, and the acceptance criteria gain a control
(dragging still works on canvas nodes, panel tree rows and the sidebar divider). Enumerate the
opt-*out* list before flipping `style.css:205`, and delete the three now-redundant opt-*ins*.

The other six, in one line each: **FIX-002** Enter=send / Shift+Enter=newline in both composers
(this changes `TextArea`, so **re-drive BLD-010** and grep every consumer); **FIX-009** `PortEditor`
joins the width group, three panels only; **FIX-011** per-component size persists behind the
explicit "Set as default size" gesture, default height = fill the stage; **FIX-012** None clears to
derived defaults and resets the frame, Delete keeps its values; **FIX-014** model `x`/`y` is
authoritative, the pass fills gaps and resolves collisions only; **FIX-019** back-to-benched with an
assertive chip that appears only on divergence.

Each is written into its own task file under a `✅ RULED 2026-08-14` heading, and into the README's
queue. 🟡 **One sub-ruling was NOT asked and is still owed:** FIX-019 14(a) — is the surface called
"the workbench" *everywhere*, or only in that menu item?

### FIX-007 fix 4 — what had to be true

The urgent lane is 50 ms, gated, and scoped. The load-bearing part was not the number:

🔴 **The old `if (this.evaluatehealthScheduled) return` swallowed the urgent request.** The graph is
almost always mid-debounce during load, which is *exactly* when ports arrive — so without replacing
the boolean with a tracked timer plus a deadline compare, the fix would have been dead code in the
only situation it exists for. There is a spec named for that.

The gate is `hasUnresolvedPortWarning`, and it reads **only** `con-no-source-port` /
`con-no-target-port` — deliberately not the `-type` keys, because a port appearing does not make a
type verdict stale. Without that distinction the gate degrades into "does this node have any
warning", which is nearly always true on a graph someone is fixing.

### 🔴 Two more false premises — that is 7 of 16 now

- **Fix 3 is redundant, twice over.** `getConnectionStatus` **does not check port existence**
  (`NodeGraphModel.ts:527-581` guards every branch on `sourcePort && targetPort`, so a missing port
  returns `connectable: true`); it never needed to, because its only two callers pass names drawn
  from an enumerated port list. And the gap it was meant to close is already closed at a better
  layer: `rules/nonexistentPort.ts:55-110` errors on a missing port for any **static** node type,
  abstaining only on dynamic ones — which is what fix 2 closed for Function nodes. Building it
  would also have put a port check in `fromJSON`'s bulk loop, which runs **before the node library
  loads**, when `getPorts()` returns `[]` for everything.
- **The ⚠️ rider is not a defect.** `add_connection` rebuilds from four fields but **refuses
  duplicates**, so it only ever appends a wire that does not exist — and a wire that does not exist
  has no label to drop. `operationsWritePath.test.ts` already pins this and says in its own comment
  that the door "was never broken".

### The paid drive — and what it revealed about which fix is load-bearing

One send against the real Anthropic provider, on a fresh 2-component project, thread provably empty.
The prompt **never mentioned ports or prefixes**. The AI wrote `in . items → fn . in-items` and
`fn . out-text → out . text`, with a script reading `Inputs.items` — zero warnings, all three nodes
present.

🔴 **The panel said "1 step · validated once".** No rejection, no resubmit: **the AI was right the
first time**, so fix 2's gate never fired. That means **fix 1 (the corrected catalog) is doing the
work and the gate is the backstop** — which is the right order, and was not knowable before this
run. Criterion 2 proved the gate *can* catch it; this proved the docs mean it usually will not have
to. Do not read the gate's silence as the gate being unnecessary.

### What the drive measured

Fixture **`fix007-c4-drive`** (scratch copy of `leg003-drive`; source verified untouched). Ports
removed → red at **2015–2026 ms**; ports restored → clear at **76 / 76 / 78 ms**. Same graph, same
node, same event — the only difference is whether a stale warning existed, which is the gate. Full
table in [FIX-007](FIX-007-THE-CONNECTOR-THE-AI-CANNOT-DRAW.md) § "DRIVEN … session 5".

---

## 4. What to do next

1. **Build the seven ruled tasks** — they are all unblocked and none needs Richard again.
   FIX-009 and FIX-012 are genuine S's; FIX-002 is S but drags BLD-010's re-drive with it;
   **FIX-003 is now the big one of the seven** and should not be treated as the S it was filed as.
   FIX-011 and FIX-019 want the 30px chrome strip laid out **once, together** — do them as a pair.
2. **FIX-008 fix C** (`--scope project`) if the report should stop recurring — `MCP_SCOPE` split,
   `McpSettingsSection.tsx:163`, `tests-unit/mcp-001`, and a cleanup hint for the stale user-scope
   entries. `nodegx-puppy-test-3` is **still** registered user-scope and visible in every folder.
3. **Repackage the app** (or say so out loud) if FIX-008 fix E is to reach the running servers —
   they run `/Applications/NodeGX.app/.../noodl-mcp.cjs`, not `packages/noodl-mcp/dist/`.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.
**Do not rebuild** FIX-007 fix 3 or re-file its rider; both are struck with evidence.

---

## 5. Rulings still owed by Richard

The batchable seven are **done**. What remains:

- 🟡 **FIX-019 14(a)** — "the workbench" everywhere, or only in that menu item? (Small, missed in
  this session's sitting.)
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a *measurement*, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. Check for a sibling session (`git log --since=…`, and read untracked files rather
than assuming they are yours — `VerifyFix3`/`VerifyFix4` in the test-projects folder are from
**July**, not from this phase, despite the names). **`dev:stop` kills Richard's MCP servers** — kill
the `scripts/start.ts` pid instead (done this session; all six survived). Restore
`recently_opened_project.json` after any launcher drive (done — 28 in, 29 during, 28 out).
⚠️ **Do not restore `~/.claude.json` from a backup.** Full list in the [README](README.md)
§ "Standing constraints inherited".

⚠️ **Three drive recipes went stale or bit this session**, all corrected in FIX-007's drive
sections: the editor lands on the **Launcher**, so the `props.route.router` fiber walk finds nothing
— open by clicking the card instead; `LocalProjectsModel.loadProject` **returns a Promise**, so the
callback form hangs forever and looks like a dead CDP connection; and
🔴 **`NodeGraphModel.forEachNode` stops on a truthy callback return** — it is `Array.some` wearing
`forEach`'s name, so `forEachNode(n => nodes.push(n))` reads **only the first node** and reports a
healthy 3-node graph as a 1-node one.

⚠️ **Before any paid drive, verify the provider from `editorSettings.json`, not localStorage** —
`ai.provider`, `ai.hasKey.anthropic`, `ai.verified.anthropic`. It was live on 2026-08-14.
