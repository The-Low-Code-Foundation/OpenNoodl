# Next-session prompt — ERG-001 §4, starting with the rename

**Replaces** the phase-30-remainder prompt that stood here. That work is discharged: stream A
closed, NDA-012 Visual closed, NDA-014 and NDA-017 closed, phase 30 bookkeeping closed
(`53434356`). Everything below is phase 35.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

`ERG-001` §0, §1 and §2 landed on 2026-08-02 (`b00c3d4a` → `5f94894c`). What remains splits three
ways:

| Stream | Contents | State |
|---|---|---|
| **A — finish the rename** | 6 nodes still carrying a misnamed `Done` | Decided, measured, **breaking**, small |
| **B — the adoption sweep** | §4 across the other ~72 actions, then §3 and §5 | Decided, large, batchable |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended first slice: stream A, then as much of B as fits.**

The rename is a breaking change to wire names, and the library is currently **half renamed** — the
Array family says `done` and six other nodes still say `stored` / `created` / `completed`. That
window is the worst state to leave it in: a project authored this week against
`SetModelProperties.stored` has to be migrated twice. Doing the six together closes it, and it is a
few hours' work rather than the sweep's several days.

⚠️ **Two of the six are not a pure rename** — see the prompt.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip `5f94894c`, clean tree, one worktree. **An uncommitted file is orphaned work, not another
session's — read it, then commit or discard it deliberately.**

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — the decision. Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — **§0's table is this
   task's scope.** Read §0.2 (the collision sweep) and the §1/§2 record at the bottom before
   touching anything. It is more current than this prompt.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.reportOutcome` in
   `packages/noodl-runtime/src/node.ts` — the one implementation. Do not add a second.
4. `packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-insert.ts` — the reference
   implementation, and `tests/corpus/erg-001-outcome-contract.test.ts` for the row style.

### Build 1 — finish the rename (6 nodes), re-derived from the catalog on 2026-08-02

| Node | Today | Becomes |
|---|---|---|
| `NewModel` — Create New Object | `created` | `done` |
| `SetModelProperties` — Set Object Properties | `stored` | `done` |
| `net.noodl.SetComponentObjectProperties` | `stored` | `done` |
| `net.noodl.SetParentComponentObjectProperties` | `stored` | `done` |
| `net.noodl.GlobalStore.Set` | `completed` | `done` **+ a real `completed`** |
| `net.noodl.ActionDispatcher` | `completed` | see below **+ a real `completed`** |

Richard decided both halves on 2026-08-02: unify the wire name on `done`, and rename the two
`Completed`-that-means-`Done` ports rather than exempting them from the contract.

⚠️ **The last two are not pure renames.** On both, `completed` fires *only* on success and is
mutually exclusive with `failure` (`globalstoresetnode.ts:178` vs `:190-195`;
`actiondispatchernode.ts:80-96`). So the existing port becomes `done` and a genuinely universal
`completed` is minted beside it. ⚠️ **`ActionDispatcher` is harder still**: its `completed` is
per-*action*, not per-invocation of the node's own `Dispatch` input, so the two are different
granularities and `actionDone` (or similar) may be the honest name. Decide it in the open and write
down why.

⚠️ **A rename has two sides, and §0's sweep only swept one.** It searched for the names being
*reserved*, not the names being *renamed away from*, and missed
`packages/noodl-editor/tests/testfs/git-repo-utf8/project.json` wiring `CollectionInsert.modified`
five times. `test:ci` went red. **Before renaming: grep every project JSON for `stored`, `created`
and `completed` as `fromProperty`/`toProperty` on these six types.** Known casualty:
`library/prefabs/supabase` wires `SetModelProperties.stored -> Component Outputs.Done`.

⚠️ **Edit large fixture JSON by line, not by `json.dump`.** Reformatting rewrote 27,000 lines for a
5-line change and had to be reverted.

### Build 2 — the adoption sweep, as far as it goes

§0's 82-row table is the scope; §4 of `ERG-001-OUTCOME-CONTRACT.md` says how to batch it (disjoint
file sets per worker, catalog and enrichment taken away from workers and merged centrally). Suggested
order, highest value first:

1. **The seven Visual nodes with no completion signal (DV-viii)** — `Router`, `Page Stack`, `Video`,
   `Drag`, `Text Input`, `Group`, `Checkbox`, plus `Page` and `State History`. These were held back
   through all of phase 30 *waiting for these port names*, and the names now exist. `Completed`-only
   for most; `Checkbox` also needs `Unchanged` (`checkbox.ts:77`, `:92` return silently when already
   in that state).
2. **The confirmed `Unchanged` register** in §0.3 — `Counter` at its limits, `Switch` already in
   state, `Timer.Start` on a running timer, `WebSocket`/`SSE` disconnect when not connected,
   `Undo`/`Redo` at the end of history, `Navigate` to the current page. Every one is **silent**
   today, so each is a dead chain as well as a missing outcome.
3. Everything else, by category.

Then **§3** (`Treat Unchanged as`, following NDA-003's shape on the Variables nodes — ⚠️ a declared
`default` does not run its setter, FINDINGS **A-D1**) and **§5** (the validator's dead-end check;
`description` on every new port).

### Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict which
  rows a revert reddens before running it**. Both reverts last session were run; one prediction
  missed and the reason is recorded — do the same rather than skipping the check.
- **`sendSignalOnOutput`, never `flagOutputDirty`**, on a signal output (FINDINGS **SR-v**). The
  helper already does this; do not bypass it.
- **The outcome is the last thing an action does.** Flag values dirty first.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op.** `Completed`
  has no exemption.

### Gates — measure all eight before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**94 suites, 1767 passing, 13 skipped**) · `packages/noodl-viewer-react`
jest (**51 suites, 598 passing**) · `typecheck:runtime` · viewer-react typecheck
(`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) · `typecheck:cloud` ·
`catalog:check` · `catalog:merge:check` · `cloud-library:check` · editor `test:ci` (**2007 specs**).

⚠️ **The bar is 0 failures *and* no new noise.** ⚠️ `catalog:check` passes while the other two are
stale — run all three, and remember the **enrichment files** (`docs/node-catalog/enrichment/*.json`)
name ports explicitly; a rename reddens `catalog:merge:check`, not `catalog:check`.

**Standing traps:** run `noodl-runtime`'s jest from **inside the package** (`cd packages/noodl-runtime
&& npx jest --reporters=summary`) — a bare `npx jest` from the root reads 94 suites failing and means
nothing. Build `dist-types` first (`npm run build:types`). ⚠️ **`graph-harness` does not call a
module's `setup`, and 45 of the 82 actions are dynamic-port nodes** — a row that needs the real port
set has to register it another way. Scope greps to `packages/*/src`.

### Live QA is required, and one half is already owed

The editor half is done and recorded: picker and canvas both show `Done`/`Completed`/`Unchanged`.
**Owed: criterion 8's running-preview half** — one graph where a duplicate insert continues through
`Completed` and stops at `Done`. Fold it in.

```bash
npm run build --prefix packages/noodl-viewer-react   # or a deployed app keeps the old ports
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(8)"    # bcn010-live
npm run cdp -- click "[class*=EditorTopbar-module__is-padded-s] button[class*=IconButton-module__Root]"
npm run cdp -- type "input[placeholder*='Search nodes']" "Insert Object"
npm run dev:stop
```

⚠️ `cdp click` takes a **CSS selector only**. ⚠️ `cdp eval` already declares `t` — name your
variables anything else, and wrap in an IIFE. ⚠️ **`packages/noodl-editor/src/external/` holds stale
duplicate folders `viewer 3/`, `deploy 2/`, `ssr 3/` dated 2025-12-06 that no build writes to** —
grepping them says a rebuild failed when it succeeded. The live paths are `viewer/`, `deploy/`,
`ssr/`. ⚠️ Only one editor at a time (`lsof -i :8574`); launch detached; never `cdp reload`;
`npm run dev:stop` when done.

**Commit straight to `cline-dev`**, one commit per node or per coherent family, pathspec-scoped.
⚠️ **~860 commits exist only on this machine and Richard has said "leave it — I'll handle the
remote". Do not push; do not re-litigate it.**

**Update on the way out:** the §1/§2 record at the bottom of `ERG-001-S0-MEASUREMENT.md` (add a §4
section), and this prompt. **Say how many of §0's 82 actions now satisfy the contract, and which
remain.**
