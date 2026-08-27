# Next session — phase 75

_Written 2026-08-27 at the end of the session that **committed** FB-025/026/027 and closed the two
items the drives had left. Read `TASKS.md` for the rest of the phase; this file is only about what
that session left._

## What happened

The previous two sessions built, gated and drove Richard's three bugs and committed **none** of
them. This session committed all of it and cleared both follow-ups. **Nothing from that batch is
outstanding.**

Six commits, all on `cline-dev`, none pushed:

| | |
|---|---|
| `27f16f8b` | **FB-025** — the drain order is stated instead of inherited |
| `26dcc51c` | **FB-026** — a Number-typed Text Input publishes a number |
| `c4ec2103` | **FB-027** — copy takes the stack, not one block |
| `b5a624a4` | the `TASKS.md` index says driven, because they are |
| `13499279` | **`Set Variable` measured** — it must stay `known: false` |
| `1eea0dd2` | **the docs gate can no longer grade a stale catalog** |

Gates before committing, one suite at a time: `noodl-runtime` **2555**, `noodl-viewer-react`
**1079**, editor `test:main` **5791**, `test:ci` **2856 specs / 4 failures** at `3697ebcd` — the
four by name, all `AIX-006 style vocabulary`, which is the documented floor.

## Start here

**There is no carried-over work from Richard's batch.** Pick the next thing from `TASKS.md`; the
largest open items are FB-012 (tutorials + share/export) and FB-009 (a syllabus you can start),
both waiting on content from Richard, and FB-005's blocker is content too. FIX-025 §5/§7/§12 are
built and need an editor drive, which is the cheapest real work on the list.

⚠️ **Nothing is pushed.** Six commits sit on `cline-dev`.

## The two follow-ups, and why neither ended where the last handoff expected

### 1. `Set Variable` — the last handoff was wrong, and the measurement is the finding

It said *"`Set Variable` is still misclassified (`known: false`), though `RESIDUE_REASONS` describes
it as exactly the shape FB-026 added `RETYPES_DECLARED_PORTS` for. One line plus a measurement."*

🔴 **It is not that shape, and adding the line would have published a lie.** `value` is **not a
declared port** — `setvariablenode.ts` declares `name`, `setWith` and `do`, and `value` is minted at
runtime by `registerInputIfNeeded`. Text Input declares both value ports as `'*'` and only
**narrows** them; this port has no static existence to narrow. Worse, with
`setWith === 'emptyString'` the hook publishes **no ports at all** — the port does not change type,
it **disappears**.

✅ **The measurement was the guard itself, not an argument**: the entry was added to
`RETYPES_DECLARED_PORTS`, `catalog:generate` was run, and `retypesEncoding` threw — *"its setup
published `value` — not in its static port list"*. `runtime-discovered` and `known: false` are both
telling the truth for this node. Recorded in `derive-encoding.js` where the open question used to
be, so nobody re-opens it.

### 2. `docs:nodes:check` — the hole was real, and narrower than described

The handoff said the check *"grades a stale input"*. True, and reproduced before fixing: mutating one
`docs` field in `node-catalog.json` and re-running printed **"clean. 194 generated files match 175
catalog nodes"**.

⚠️ **But `catalog:merge:check` caught the same mutation**, so the sweep as a whole was never blind —
the defect was a docs gate that only works while somebody remembers to run a different gate beside
it. That is what the guard replaces.

The comparison is exact rather than heuristic, because `merge.js` copies structural nodes through
verbatim as `{ ...n, enrichment }` — stripping `enrichment` must give back `node-catalog.json`
exactly. It runs in **both** modes: generating pages from a stale catalog is the worse half, because
it bakes the staleness in and `--check` then agrees with them. A missing or unparseable structural
catalog is an **error, not a skip**.

🔴 **8 rows in `tests-unit/alpha-006/docsCatalogFreshness.test.ts`, and the one that matters is the
negative control** — *"accepts a catalog that differs only by enrichment"*. Every other row is
satisfied by a guard that throws unconditionally. Two mutants prove they discriminate: disabling the
guard reddens 5, and forgetting to strip `enrichment` reddens **only** that one.

## The drive rig, still there, still worth not rebuilding

`NodeGX test projects/fb025-drive` — a Text Input into a Visual Function, plus a second Number-typed
Text Input into a declared `number` input. **`REBUILD-FIXTURE.py` sits beside it**; re-run it for a
clean copy, because driving FB-027 mangles the Blockly workspace.

🔴 **Authoring the `Run` connection before the value connection in `project.json` does NOT reproduce
FB-025.** A project *loaded from disk* gets the value port's queue key created first, so the graph is
correct even on the unfixed runtime — a drive that stops there records a pass on an arrangement that
was never broken.

✅ **What reproduces it is Richard's build order, performed live:** unwire the value port → reload
the viewer → type one character → wire the value port back **into the running graph**. Read the order
directly:

```js
Object.keys(vfNode._inputValuesQueue)   // ["workspace","generatedCode","run","x"] = the broken order
```

✅ **Reaching the viewer's live runtime** (there is no global): walk any rendered node's
`__reactFiber$` up to a fiber whose `memoizedProps.noodlRuntime` exists, then
`rt.rootComponent.nodeScope.getAllNodesRecursive()`.

✅ **`scripts/devtools/cdp.js` still has no right-click and no key command.** The ~90-line CDP helper
FB-027 needed — real `Input.dispatchMouseEvent` with `button:'right'`, and `Input.dispatchKeyEvent`
chords with `Emulation.setFocusEmulationEnabled` **on the same connection** — is still not folded
into `cdp.js`. It will be wanted a third time.

## Standing facts for this area

- `test:ci` floor is **4**, all `AIX-006 style vocabulary`. Measured this session at `3697ebcd`:
  2856 specs / 4 failures, seed 15442. **Quote the tree, not the seed.**
- The three suites, in order and **never two at once**: `noodl-runtime` (2555),
  `noodl-viewer-react` (1079), editor `test:main` (5791 + 8 new = 5799 mine), then `test:ci`.
- ⚠️ **A peer is live in the editor tree.** At 21:02 they were mid-edit on
  `site-builder.content.json`, which reddens `tests-unit/sb-007/site-template.test.ts`
  (*disjoint node ids* expects 192, got 193). **That red is theirs, not the tree's** — check
  `git status` and mtimes before attributing an editor red to your own change.
- ⚠️ `AskAboutNodeDialog.module.scss` has been uncommitted since **08-20** and belongs to nobody in
  this lane. Leave it; it is not ours to commit.
