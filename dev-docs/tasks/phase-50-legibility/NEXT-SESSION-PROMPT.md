# Phase 50 — next session

**Written 2026-08-11**, at the end of a session that built **four LEG tasks in four parallel
worktrees** while two sibling sessions (phase 54 DSG, phase 60 SIG) held the primary checkout.

**4 of 7 are built. 0 are merged. None has seen the Jasmine suite.**
**The next session's first job is not a task — it is the merge and the gate.**

Built: **LEG-003** (reduced scope), **LEG-004**, **LEG-006**, **LEG-007**.
Open: **LEG-001**, **LEG-002**, **LEG-005**.

---

## 1. What exists, and where

Four branches, one commit each, all based on `80868946`. `cline-dev` advanced to `6759aa92` while
they ran (SIG-003 landed); **the four branches collide with none of those commits** — checked with
`comm -12` on the name lists.

| Branch | Commit | Files | Task | Self-verified? |
|---|---|---:|---|---|
| `leg-004` | `8cbcaf9b` | 13 | textconv driver + `.gitattributes` | ✅ all seven criteria **run**, not reasoned |
| `leg-006` | `4a7fe09a` | 16 | component `description` write path + MCP read | Mostly — see §4 |
| `leg-003` | `e44efc65` | 14 | Explain-panel half + headless diff coverage | §2 only; §1 **not claimed** |
| `leg-007` | `02acff1a` | 2 | paste regression spec | ❌ suite never run |

The worktrees are under
`/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/00e4253c-.../scratchpad/leg-00N`.
⚠️ **That is temp space and it will be swept.** The commits are safe in the object store; the agents'
NOTES were not, so they have been copied to **[`notes/`](notes/)** next to this file — five files,
1,390 lines, including the register text each task would have written and
[`NOTES-LEG-003-DRIVE.md`](notes/NOTES-LEG-003-DRIVE.md), the executable CDP drive for LEG-003 §1.
**They are untracked. Commit them.**

## 2. 🔴 The first job: merge, then gate

Trial-merge into a throwaway worktree before touching `cline-dev` — that is what caught a
merge-created defect in the phase-35 batch, and no single agent can see it.

```
git worktree add -b trial-leg <scratchpad>/wt-trial-leg cline-dev
# merge leg-004, leg-006, leg-003, leg-007 in that order (cheapest first)
```

**Two reconciliation points, both known in advance:**

1. **`packages/noodl-editor/tests/nodegraph/index.ts`** — `leg-007` appends exactly one line at the
   end. That file was uncommitted in the primary tree during the run, so it is a hand-merge, not a
   conflict to resolve mechanically. `leg-006` touches `tests/io/index.ts` instead; there is nothing
   to reconcile from that one.
2. **`ExplainPanel.tsx`** — the only pairwise overlap between the four branches (`leg-003` ×
   `leg-006`). Both surface the component description there. **Convergent, not a disagreement** —
   `leg-003` built the adapter to read both `description` and `metadata.description`, and `leg-006`
   shipped the top-level field. Take both.

Then the gates. **Do not inherit a green board** — re-run after any sibling commits over the tree.

- The `test:ci` baseline to compare against is phase 60's, recorded the same day:
  **`Jasmine: 2632 specs, 6 failures` at seed 72213**, confirmed **by name** (four
  `AIX-006 style vocabulary`, two `AI model registry`). Only the `Jasmine:` line counts; the exit code
  lies. `dev:stop` first, and never with a sibling's run live.
- **16 new specs to look for**, listed in [`NOTES-LEG-006.md`](notes/NOTES-LEG-006.md) §6.
- `leg-007`'s spec has **never been seen green or red**. Its red-proof is a four-row table in
  [`NOTES-LEG-007.md`](notes/NOTES-LEG-007.md) §5; the two that matter are deleting
  `label: this._label,` from `NodeGraphNode.toJSON`, and adding `|| key === 'comment'` to the filter
  at `codeHistoryMetadata.ts:33` — the second faithfully simulates the LEG-001-era regression and
  should turn exactly the three comment `it`s. **A guard never seen to fail is decoration.**
- ⚠️ `leg-006` ran its two Jasmine specs out-of-band under `@noodl/platform-node` instead of
  `platform-electron` (10/10 and 19/19). Neither subject touches the platform, but **the platform
  under test differs from CI's** — that is a signal, not a substitute.

## 3. Defects found and deliberately not fixed

All five were **verified at source by the orchestrator**, not taken on an agent's word.

1. 🔴 **`NodeGraphNode.toJSON` passes `metadata` by reference** (`NodeGraphNode.ts:~1590`) while
   deep-copying every other field. `NodeGraphNodeSet.clone()` is `fromJSON(toJSON())`, so **a pasted
   node shares its source's metadata bag**. `toJSON` then *writes into* that shared object
   (`json.metadata.merge.soureCodePorts.push(...)`) — and the `[...new Set(...)]` dedupe two lines
   down, commented *"fixes a bug where the soureCodePortss contained duplicated entries"*, is this
   same defect patched once at the symptom. **This blocks LEG-001**, which puts `comment` in that bag.
   Fix `clone()` first; it is one line, and `duplicateComponent` already shows the pattern.
2. 🔴 **`ProjectModel.duplicateComponent` (`projectmodel.ts:335`) constructs the copy from `name`,
   `graph` and `id` only** — the component's whole metadata bag is dropped, **and so is `leg-006`'s
   new top-level `description`**, because that branch does not touch `projectmodel.ts`. The graph
   *is* deep-copied, so node-level metadata in a duplicate is independent. Two agents reported these
   as contradictory findings; they are not, they are different scopes. **When adding a field to
   `ComponentModel` the seams are four, not two: importer, model, exporter, `duplicateComponent`.**
3. ⚠️ **`@noodl/git`'s 17 new tests never run in CI.** Root `package.json`'s `test:packages` lists
   ten `--scope` flags and that package is not one of them. One word.
4. ⚠️ **`nodegx.project.json` matches none of the four `.gitattributes` patterns** — the v2 manifest
   gets neither `merge=noodl` nor `diff=noodl`. The `merge` half predates LEG-004. Its own task:
   adding `merge=noodl` would route a manifest into `mergeProject`.
5. ⚠️ **A multi-parameter sentence names three changed parameters chosen alphabetically.**
   `paramDeltas` (`GraphDiff.ts`) iterates `[...keys].sort()`, and `DiffFormatter.ts:84` takes
   `.slice(0, 3)` of that — so `+N more` always hides the alphabetically-last changes, whatever their
   significance. Every parameter named *is* a real change; the defect is the selection, not the
   contents. Pre-existing, not new work, and it interacts with LEG-004's one-fact-per-line rule.

Also filed by `leg-006`, unverified here: `displayName`, `category`, `tags`, `dependencies` and
`settings` are declared on `ComponentV2File` and carried by nothing. **Same seam, same class — any of
them is the next silent deletion.**

⚠️ **Review one gate change before merging.** `leg-006` retired stale allow-list entries in AWP-002's
`writePathConformance.test.ts` (A13 `component.description`, A12 `created`, `modifiedBy` — each
marked *"filed not fixed, the fix is in ProjectExporter"*) and replaced them with a positive
assertion. That is correct now that the fix exists, but it is a change to someone else's gate. A14
(`component.type`) is still live.

## 4. What none of them could verify

The live and serial list, in priority order:

- **`npm run dev:stop && npm run test:ci`** from the primary checkout, for all four branches.
- **LEG-003 §1** — the four change kinds driven in the running editor. The script is written:
  [`NOTES-LEG-003-DRIVE.md`](notes/NOTES-LEG-003-DRIVE.md), with selectors
  (`[data-test="versioncontrol-panel"]`, `[data-test="explain-panel"]`, `[class*="ChangeRow"]`).
  **§1's acceptance is not met and must not be recorded as met.**
- **The authored-notes card rendered.** Its contrast was computed from the token files, not sampled:
  the card fill is **1.07:1** against the panel — a wash cannot carry the distinction, so it is
  carried by a 2px rule (5.98:1), an icon and a header sentence. And `--theme-color-primary` is
  **4.33:1** on `bg-2` in light, under AA at 12px, so the node link is underlined rather than tinted.
- **LEG-006's picker and Explain surfaces**, and the `metadata.description` → `ComponentModel` hop.
- **LEG-004 on a packaged/asar build and on Windows** — the `ENV=1 cmd` prefix needs Git's bundled
  `sh` and is the most likely break point. Worth gating a release on.

## 5. The three that remain, and the order

Unchanged from [TASKS.md](TASKS.md) except where this session's findings bear on it:

1. **LEG-001** — the flagship, `metadata.comment` into the authoring vocabulary. **Do §3 item 1
   first**, or the aliasing becomes user-visible for the first time through this field.
2. **LEG-005** with it or immediately after — LEG-001 gives the agent a way to write a comment,
   LEG-005 gives a human a way to find one. Shipping either alone leaves half a channel.
   ⚠️ These two share three files with each other **and `NodeGraphEditorNodePainter.ts` with SIG-006**.
   One agent, and not while SIG-006 is live.
3. **LEG-002** — late, and **advisory both ways**. The measurement inverts the specced polarity:
   agents label at 89%, humans at 20%.

**LEG-006's own §4 premise was wrong** and the correction generalises: `list_components` had returned
the description since SUB-008; the column read empty only because the write path destroyed the data
first. **Check whether the read path is already right before building one.** Three of seven tasks in
this phase turned out smaller than budgeted for exactly this reason.

## 6. Carried from this session

- **The manual worktree recipe worked 4/4 again** — `git worktree add -b <n> <path> cline-dev`, then
  a *real* `node_modules` of per-entry symlinks (minus `@noodl`) plus a *real* `@noodl/` pointing at
  the worktree's own `packages/*`. Verified before launch with
  `node -e "require.resolve('@noodl/runtime/package.json',{paths:['<wt>']})"` — it must return a path
  **inside** the worktree. Never `isolation: "worktree"`: the harness roots those at `origin/main`.
- **The phase-50 specs were untracked**, so the worktrees could not see them and they had to be
  copied in. Commit specs before spawning agents against them.
- **The base moved under the batch.** `cline-dev` gained four commits mid-run. Harmless here, but
  compute overlap from `git merge-base`, not from the branch name — `git diff cline-dev..<branch>`
  reported ~140 files for every branch and the true numbers were 13–16.
- 🔴 **Do not take an agent's finding at face value.** Two of them reported flatly contradictory
  things about `duplicateComponent`; both were right about different scopes, and the resolution
  (§3 item 2) is worth more than either report. A third's central claim was that a premise in its own
  spec was false, and it was.
