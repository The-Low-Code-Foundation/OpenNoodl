# Phase 62 — the cold start, and a checkout that is finally empty

**Written:** 2026-08-11 night, by a session that built nothing and landed everything. Phase 54 is
closed, phase 50 is four-sevenths in, and the working tree is clean for the first time in three days.

**This is the live prompt.** The phase-54 one is history — its §6 is fully struck off. What changed
tonight: **eleven commits of finished-but-uncommitted work landed**, the four LEG branches merged,
**one real data-loss regression came in with them and was fixed**, and a gate nobody runs turned out
to have been red since phase 54 closed.

---

## §0 — A green `test:ci` does not mean the gates are green

🔴 **`npm run test:ci` is not the gate. It is one gate.** The noodl-mcp suite is **red right now**
and has been since `89cf26cb` — DSG-003's recipe commit, which landed on the evening phase 54 was
declared closed, with `catalog:examples`, `catalog:tokens` and `catalog:merge:check` all green. None
of those reads the thing that broke.

```
cd packages/noodl-mcp && npx jest        # expect 1 failed / 366 passed of 367
```

**Run it after any commit that touches the catalog or the examples corpus.** Details in §3, F65.

🔴 **And when `test:ci` is red, compare the failure NAMES, never the count.** Tonight's first run
came back **12**, which the register has documented for two weeks as the order-dependent BEN-001
variant. It was not: BEN-001 did not fail at all. It was the documented six plus **six new ones** —
a real regression, found only because the list was read rather than the number. The one command:

```
grep -n "^  FAILED:" <log>
```

⚠️ The exit code lied again, for the third recorded time: the harness reported **exit 0** on a run
whose log said `Jasmine: 2670 specs, 12 failures`. **Only the `Jasmine:` line counts.**

⚠️ Unchanged and still true: `npm run dev:stop --list` **kills** (npm swallows the flag);
`node scripts/devtools/dev-processes.js --list` is a **silent no-op**; the one correct spelling is
`npm run dev:stop -- --list`.

## §1 — Where things stand

`cline-dev` is `3ba3e40a`. **The working tree is clean.** `origin/cline-dev` is **223 behind** and
has not been pushed.

| Gate | Result |
|---|---|
| `test:ci` | ✅ **`Jasmine: 2670 specs, 6 failures`, seed 67108** — the floor, same six by name |
| `typecheck:editor`, `typecheck:editor-tests` | ✅ clean |
| `@noodl/git` | ✅ 17/17 |
| `renderReportModule` | ✅ 41/41 |
| **noodl-mcp** | 🔴 **1 failed / 366 passed** — §0, and not caused by anything landed tonight |

⚠️ **The spec count is 2670. The delta is unknown, and this session did not measure it.** The two
most recent recorded counts disagree — the phase-54 prompt says **2607** (seed 46463), the register
says **2635** after ELO-001 — and the first run tonight was taken *after* everything had landed, so
there is no before. **Take 2670 as the number and do not compute a delta against either.**

Branches: **everything is merged into `cline-dev` except two.** `wt-trial54` is a stale trial branch
holding **zero** unlanded content (verified by tree diff, both directions) — it and the four `leg-*`
worktrees can be pruned. `nightly-to-main` is real and separate: one commit, a packaged nightly
workflow aimed at `main`, never merged anywhere. Somebody should decide about it.

| Phase | State |
|---|---|
| **54** — design groundwork | ✅ closed 7/7. Only §5's Richard items remain |
| **50** — legibility (LEG) | **4 of 7 in.** LEG-003/004/006/007 landed; LEG-001, 002, 005 open |
| **62** — cold start (BST) | 📋 specced, **not started**. Six tasks, nothing built |

## §2 — What landed, and the one thing that came with it

Eleven commits, `03e6d44a` … `3ba3e40a`. Ten were finished work that had been sitting uncommitted in
the main checkout for up to three days — the oldest stamped 08-09, on **no branch anywhere**.

| | |
|---|---|
| `03e6d44a` | phase-54's `render:scroll` probe and the `withRenderedPage()` refactor. **The register recorded F52 as closed; it existed only in the working tree** |
| `0be5fd8a` | extract to component asks for a name and a place |
| `69745a81` | Make Home and folder rename ran nothing — `pushAndDo` |
| `150504be` | the starter's App is a full-viewport Group, not a bare Router |
| `033de7ee` | the lint panel's selected row was white on near-white |
| `d8b0d36d` | a careful click in the connection popup selected nothing |
| `a5bf4638` | launcher window controls on Windows and Linux |
| `bab7e53a` | the phase-62 spec |
| `e0732dd1` | **merge of `trial-leg`** — LEG-003/004/006/007, ~4,100 lines |
| `389b5864` | phase-50 task states, which had read 📋 open on all seven for a day |
| `3ba3e40a` | **the regression the merge brought with it** |

### 🔴 The regression, because its shape will recur

`buildComponentV2Files` ([`ProjectExporter.ts`](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts))
carried `component.metadata` into `component.json`. **LEG-006 added `description`, `created` and
`modifiedBy` beside it by replacing that `if` block's body and reusing its closing brace** — so the
carry went with it. A save stopped writing `metadata` at all: `canvasSize`, `canvasPos` and the
legacy `created`, deleted on the first save of any project.

That is **LEG-006's own defect one field over**. The task exists because the first editor save after
an agent wrote a description deleted it; the fix for that started deleting something else.

🔴 **Reading the diff forward exonerates it.** The three new blocks are correct, individually
guarded, and each carries a careful comment — one of which sits exactly where the deleted line had
been, so the block looks complete. The bug is visible only as an absence. The check that found it,
in one command:

```
git diff <base> <merge> | grep "^-" | grep -v "^---" | grep -vE "^-\s*(\*|//|$)"
```

Twenty lines, on one screen, and the deleted carry was in them. **Do this on every merge of
unattended agent work** — the additions are what got reviewed; the deletions are what nobody looked
at. It applies to any serialiser, `clone()` or constructor.

## §3 — Register, new this session

**F1–F63** are in the phase-54 files and
[NOTES-DSG-006.md](../phase-54-design-groundwork/NOTES-DSG-006.md) /
[NOTES-F38-F39-F40.md](../phase-54-design-groundwork/NOTES-F38-F39-F40.md); **F64** is in
[NOTES-SCROLL-PROBE.md](../phase-54-design-groundwork/NOTES-SCROLL-PROBE.md).

| # | Finding | State |
|---|---|---|
| F65 | 🔴 **The noodl-mcp suite has been red since `89cf26cb`, and is not in `test:ci`.** `tools.test.ts` DEBT-009 asserts a `get_node_type` **summary** for eight heavy types stays under 30,000 bytes; it is **30,365**. Bisected: green at `89cf26cb~1`, red at `89cf26cb` (DSG-003's five recipes). 🔴 **The mechanism is structural, not an overshoot** — summary mode does `s.examples = full.examples` verbatim, `{id, title}` pairs, 13 on `Group` and 14 on `Text`, **5,047 of the 30,365 bytes** across those eight types. Every recipe added to the corpus enlarges every summary referencing it, and the corpus is meant to grow. Raising the cap to 31,000 buys until the next recipe; bounding the list per type (first N plus a count, with `list_examples` for the rest) is the fix that holds | 🔴 **open — needs Richard.** It changes what the MCP surface returns, and that budget cost a session to get to 7.8k tokens/turn |
| F66 | 🔴 **A branch that adds fields beside an existing carry can delete the carry** — §2. The addition reviews clean; only the removed lines show it | ✅ fixed; the *habit* is the finding |
| F67 | 🔴 **`test:ci` at 12 failures is not automatically BEN-001.** The register has documented 6 → 12 as an order-dependent range since 2026-08-10, and tonight 12 meant a real regression with BEN-001 entirely absent. Two different routes to the same count; only the names separate them | ✅ recorded — §0 |
| F68 | ⚠️ **Ten pieces of finished work sat uncommitted in the main checkout, on no branch, for up to three days** — including work a register recorded as ✅ closed. A phase can be declared complete while its deliverable exists only as a dirty file | 🟠 filed — a habit |
| F69 | ⚠️ **`nightly-to-main` is one unmerged commit nobody has decided about** — a packaged nightly workflow aimed at `main`, not `cline-dev`, unmerged since it was written | 🟠 filed |

## §4 — What needs Richard, not a session

Carried forward from phase 54 §5, none of it started:

- **`§9`'s prose** — add identifiers, and fix the two copy-pasted wrong sentences
  (`03-INTERACTION-AND-STATE.md:73` has the same error). Small and testable.
- **F51** — a destructive-text token that passes AA. `--destructive` on `--surface` is 3.60:1 at
  14px. Same shape as the `--border-control` call.
- **The 25% accent ceiling** — the corpus cannot defend the number; `ACCENT_CEILING` in
  [`score-design.js`](../phase-54-design-groundwork/measurements/score-design.js) is the one line.
- **F33** — a copied project directory inherits its parent's id. Refuse-and-explain is plausible;
  re-minting may be wrong, because "duplicate this project, same data" is legitimate.
- **F65**, new tonight — the MCP byte cap above. Bound the list, or move the number.

## §5 — What a next session should pick up

**Phase 62, BST-001 + BST-006, together.** The phase's own [TASKS.md](TASKS.md) argues the order and
it is right: 001 is the only task that changes a contract two other packages read, it ships behind a
flag with no user-visible change, and 006 is the *only* thing a model reads before calling anything.
A four-tool server with a project-bound briefing is a worse first impression than no server.

⚠️ **Two standing constraints that will bite, both already read in source:**

- **`instructions` is fixed at `initialize`** and interpolates the project directory
  ([`server.ts:53-54`](../../../packages/noodl-mcp/src/server.ts#L53)). A server that binds
  mid-session **cannot rewrite its briefing**. Project-bound guidance must travel in tool results.
  This is the phase's most likely silent defect: the tools appear, the knowledge of how to use them
  does not — and no gate can see it.
- **`create_project` is inside `if (options.allowWrites)`**
  ([`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146)). The registration BST-003
  emits **must** carry `--allow-writes`, or it produces a server that starts, advertises, and cannot
  do the one thing it exists for.

🔴 **This phase deliberately reverses [TALK-004 decision 3](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md)
and re-opens decision 8.** Both are argued in the README. **Do not re-litigate them as oversights.**

### The alternatives, if 62 is not the priority

- **Finish phase 50.** Three left. **LEG-001 is blocked** and the blocker is recorded: `toJSON`
  passes `metadata` **by reference**, so a pasted node shares its source's bag and `toJSON` mutates
  the live node. Fix `clone()` before LEG-001 puts `comment` in there — and note that tonight's
  regression was in the same neighbourhood, which is not a coincidence.
- **F65**, if Richard has ruled on it. Half a day, and it un-reds a gate.
- **Housekeeping:** prune `wt-trial54` and the four `leg-*` worktrees (all fully merged, verified);
  decide about `nightly-to-main`; push `cline-dev`, which is 223 commits ahead of its remote.
