# Next-session prompt — ERG-001 §4, the last three, then §3 and §5

**Replaces** the "remaining 21" prompt. That session shipped four builds — `a139a3ce` (the small
non-Data remainder), `c4d70555` (the Navigation remainder), `0b9671fb` (the script hosts,
`Condition` and `States`) and `f58fb5ab` (`Stream Buffer` and `Text Accumulator`) — eighteen nodes
in all. **It did not run live QA**, for a reason worth reading before you plan around it.

**79 of §0's 82 actions satisfy the contract, measured** — not counted from prose. Re-derive with
the script at the bottom. ⚠️ The phase has had two arithmetic slips in handovers, one design
instruction that reading the source disproved, and one ⚠️ warning that was simply **stale** by the
time it was read. Generate the numbers, and read the code before believing a shape.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **B — the last of §4** | 3 actions: `net.noodl.HTTP`, `net.noodl.OptimisticUpdate`, `RunTasks` | Decided; all Data, all multi-verb |
| **B′ — §3 and §5** | `Treat Unchanged as`, and the validator's dead-end check | Both still not started; §5 now has a long exemption list to respect |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |
| **D — the live-QA debt** | Eighteen nodes built and never seen in the editor | ⚠️ Blocked last session; see below |

**Recommended: open with the live-QA debt if `:8574` is free**, because it is eighteen nodes deep
and grows with every build. Then the last three Data nodes, then §3 and §5.

⚠️ **`Run Tasks` is the node the contract's own problem statement is about, and it is not the shape
the last three prompts assumed.** Its existing `done` output **already means `Completed`** — "fires
when the run has ended, whether it succeeded, failed or was aborted", and every terminal path sends
`success`/`failure`/`aborted` *and* `done`. That is the Variables slice's `Stored` situation again,
so adopting the contract is a **two-step rename** — `done` → `completed`, then `success` → `done` —
whose order the sweep must respect or the second step rewrites what the first just wrote. Its
empty-list case is already `Success` and must stay one: `For Each`'s and `Pattern Extractor`'s
exemptions are recorded for exactly that reason.

⚠️ **`Optimistic Update` has four signals that are probably all *later* events**, not one
invocation's outcome: `applied`, `committed`, `rolledBack`, `timedOut`. Run the grep before
renaming anything — it decided every one of the last eighteen nodes without a judgement call.

---

## The prompt

Continue ERG-001 (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.

⚠️ **There is a concurrent session and it was active throughout the last one.** Phase 36
(OBS-00x, Track U) commits to this same branch from this same checkout, spawns worktrees, and its
`nodegx-observe` build **holds an editor on `:8574`**. Never `git stash`, never `git checkout .`,
never `git add -A`. Pathspec-scope every add and commit; if a file you did not touch appears, read
it and leave it alone. Last session's five commits interleaved cleanly with three of theirs.

⚠️ **Never `git checkout <path>` on a file you have edited but not committed** — it restores from
the index and silently discards the work. Commit before running any revert experiment. That is what
made last session's twenty-seven reverts safe.

⚠️ **A handover is a plan, not a measurement — and a ⚠️ can be stale rather than wrong.** The last
prompt warned that `States` had unguarded verbatim output names and needed the `Logic Builder`
treatment *before* the reserved names landed. Reading `states.ts` fresh — as the same prompt
instructed — showed the concurrent session had already done it. Read the file, then decide.

### Read first, in this order

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — the last section is
   more current than this prompt.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.beginOutcome` / `reportOutcome` in
   `node.ts` — the one implementation. Do not add a second.
4. Reference implementations, by shape:
   - **one funnel serving several nodes** — `dbmodelcrudbase.ts`.
   - **a value-level announcement kept beside the outcome** — `parentcomponentobject.ts`'s
     `fetched` is now the clearest, because it is the one where the grep is *decisive*.
   - **a token paired with a queued action** — `states.ts`'s `goToStateQueue`, whose entries carry
     `{state, token?}`.
   - **`failure` as one port doing two jobs** — `expression.ts`, `simplejavascript.ts`,
     `logic-builder.ts`, `states.ts`, `text-accumulator.ts`. All five split it the same way.
   - **an `Unchanged` that is genuinely earned** — `stream-buffer.ts`'s empty `Flush`.
   - **the contract's navigation exception in a non-navigation node** — `response.ts`.

### Build 1 — the last three Data nodes

`net.noodl.HTTP`, `net.noodl.OptimisticUpdate`, `RunTasks`. Read all three before writing any.

⚠️ Read the `Run Tasks` note above and the paragraph in `OUTCOME-CONTRACT.md`'s problem statement
before touching it.

### Build 2 — §3 and §5

§3 (`Treat Unchanged as`, Variables family first — ⚠️ a declared `default` does not run its setter,
FINDINGS **A-D1**) and §5 (the validator's dead-end check).

⚠️ **§5 must not flag the contract's own exemptions, and the list is now long.** Absent
`Unchanged`, all deliberate: `Page Stack`, `For Each`, all eleven Cloud Services actions, all five
Record CRUD nodes, all three Fetch twins, `Filter Collection`, `Map Collection`, `FilterDBModels`,
`Set Variable`, `net.noodl.ActionHandler`, `net.noodl.StateSnapshot`, `net.noodl.PatternExtractor`,
`Event Sender`, `Unique Id`, `net.noodl.ComponentObject`, `net.noodl.ParentComponentObject`,
`noodl.cloud.response`, `noodl.cloud.sendemail`, `NavigationClosePopup`, `NavigationShowPopup`,
`Condition`, `Expression`. ⚠️ `net.noodl.JSONStreamParser` **does** have one and must not be
flagged for lacking it. Absent `Failure`, all deliberate: `net.noodl.StateHistory`,
`For Each Actions`, all four Variables, `Collection2`, `Unique Id`, `net.noodl.ComponentObject`,
`Condition`, and `Variable2`'s `Fetch` (its `Failure` exists but belongs to the `Value` setter —
§5 must not credit it to `Fetch`).

### Rules that are not negotiable

- Corpus rows before ports, each red first with a green control beside it, and **predict which rows
  a revert reddens before running it**.
- ⚠️ **Predict per *node*, not per fixture and not per row.** Four of last session's nine misses
  were the prediction counting rows in the new file and forgetting the pre-existing suites that
  touch the same node — `completion-signals.test.ts`, `nda-010`, `mute-node-completion`,
  `response-node.test.ts`. Grep for every fixture that names the type.
- ⚠️ **`npx jest <fileA> <fileB>` is not verbose.** Jest prints per-test `✓`/`✕` only when a single
  path matches, so a multi-file revert run parses as **zero failures** and reads as a
  discrimination that is not there. Pass `--verbose`.
- ⚠️ **A revert that reddens nothing may be telling you the branch is unreachable, not that the row
  is weak.** `States`' already-in-that-state guard reddened nothing because `scheduleGoToState`'s
  pending-target guard catches the same request a frame earlier. Recorded as a measured
  non-discrimination rather than covered with a row that fakes one.
- ⚠️ **A row's title is not an assertion.** Read what each row's body actually checks.
- ⚠️ **A row that asserts silence cannot detect a wrongly-minted token** — measured four times now.
  A token minted in a setter is never settled, so nothing is reported and the silence row stays
  green. Write the counting row.
- ⚠️ **A message dedup swallows the first pulse's outcome too**, not just the repeat, when a
  value-driven run has already announced the same message. Settle tokens outside the dedup.
- ⚠️ **`failure` is often one port doing two jobs.** Where there are tokens `reportOutcome` owns the
  pulse (`raise: false`); where there are none the existing announcement stands. Never both.
- ⚠️ **An outcome must not be inferred from state the branch already reset.** Read the "was there
  anything to do" flag *before* the reset and pass it.
- ⚠️ Some correct changes are unobservable, and that is worth predicting as zero. Record the zero.
- `sendSignalOnOutput`, never `flagOutputDirty`, on a signal output (FINDINGS **SR-v**).
- The outcome is the last thing an action does. Flag values dirty first, then any value-level
  announcement, then the outcome.
- Only the port mints. Every setter-driven or mount-path route reports nothing. ⚠️ **And a bare
  method call is not an invocation either** — five `nda-010` rows drove `close()` directly and had
  to be moved onto the port.
- No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op. `Completed` has
  no exemption.
- ⚠️ Create pending-token arrays **lazily in the schedule method**, not in `initialize`.
- ⚠️ `expect(...).not.toContain('<old port>')` passes vacuously once the port is gone. Assert the
  exact signal array. ⚠️ **The same trap bites a `hasOutput` control**: `logic-builder-node.test.ts`
  asserted `hasOutput('done')` on a block-declared signal and passed vacuously the moment the
  contract declared the port.
- **A rename has three places to sweep**: project `.json`, source, and specs that build graphs
  inline in TypeScript — plus author-facing prose in `docs/node-catalog/examples/*.json` and
  `acceptance/*.json` descriptions, `docs/node-catalog/enrichment/*.json`, and
  `library/prefabs/*/project/project.json`. ⚠️ Connections come in two formattings *and* two
  layouts: on-disk keys are `fromId`/`fromProperty`, editor-export keys are `sourceId`/`sourcePort`,
  and the object may be on one line or five. **A rewriter that matches both keys on the same line
  silently skips every multi-line file** — that happened last session and reported `0 wire(s)` for
  three of five files. Track the enclosing object across lines, and sanity-check any zero against a
  control set you know is non-empty. ⚠️ Deliberately left, do not "fix":
  `packages/noodl-editor/tests/testfs/**` and `dev-docs/tasks/phase-15-…/measurements/live/**`.
- ⚠️ **Edit large fixture JSON by line, not by `json.dump`** — a two-word prose edit produced a
  106-line diff last session. If you have already dirtied the file, redo it forward from
  `git show HEAD:<path>` rather than reaching for `git checkout`.
- ⚠️ `catalog:merge:check` is blind to a stale enrichment entry on a **dynamic** node, and 86 of
  151 are dynamic. Grep `docs/node-catalog/enrichment/` against the real port set **both ways**, by
  hand — and read the *prose*, not just the `ports` block. Last session found six stale statements
  that way and no gate could see any of them; four were true when written and false by the time
  they were read, two of those being Rule 4's own worked example sitting in the docs as if it were
  the design.

### Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (108 suites, 2044 passing, 13 skipped) · `packages/noodl-viewer-react`
jest (62 suites, 847 passing) · `typecheck:runtime` · viewer-react typecheck
(`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) · `typecheck:cloud` ·
`catalog:check` · `catalog:merge:check` · `cloud-library:check` · editor `test:ci`
(**1995 specs** — it was 2007 until the concurrent session retired the Trigger Chain Debugger).

Also worth running though not one of the nine: `packages/noodl-viewer-cloud` jest (5 suites, 69
passing). It has real rows for `Response` and `Send Email` and is in no workflow.

⚠️ Capture the editor gate's summary line, not the tail — `| grep -E "Jasmine:|FAILED"`. It takes
~10 minutes; start it before you need it, and do not edit source while it builds.

⚠️ **The bar is 0 failures, and new console noise must be accounted for — but attribute before you
compare.** The editor spec count moved by 12 last session and none of it was ERG-001's. Measure
your own noise delta **by exclusion**: full package run, minus a run with
`--testPathIgnorePatterns "<your new file>"`, and read the differing lines rather than counting
them. Every line in the difference must be an NDA-004 failure a row explicitly asserts. ⚠️
Exclusion cannot isolate rows you add to a *pre-existing* file — say so rather than implying the
figure covers everything.

⚠️ `catalog:check` passes while the other two are stale — run all three. Regenerating is
`catalog:generate`, `catalog:merge`, `cloud-library:generate`, and `npm run build:types` first.

**Standing traps:** run `noodl-runtime`'s jest from inside the package. ⚠️ `graph-harness` does not
call a module's `setup`. ⚠️ A connection to a port the target does not declare is silently never
made. ⚠️ **Runtime-discovered inputs do not exist until something asks for them** — a
`setInputValue('to-B', …)` on a `States` node registers nothing and reads exactly like a node that
stayed silent; call `registerInputIfNeeded` first. Scope greps to `packages/*/src`.

⚠️ When a node's test harness is a bag of bound methods, give it the real
`beginOutcome`/`reportOutcome` (`NodeCtor.prototype.X.bind(instance)`) and a `hasOutput` backed by
the definition's declared outputs. A blanket `false` turns every outcome into a spurious
`outcome/missing-port`; a blanket `true` hides a genuinely missing port. Seven harnesses have needed
this now; `packages/noodl-viewer-cloud/tests/erg-001-cloud-node-outcomes.test.ts` is the newest and
clearest model.

### ⚠️ Live QA — the debt is EIGHTEEN NODES DEEP, and last session could not pay it

`lsof -i :8574` **FIRST.** It was held all of last session by an `Electron … --dev` process
belonging to the concurrent phase-36 session, so nothing from `a139a3ce`, `c4d70555`, `0b9671fb` or
`f58fb5ab` has been seen in the real editor.

⚠️ **Do not work around it by reading `NodeLibraryData` off their editor.** The bundle it is running
predates every port added last session, so it would report the old surface with complete confidence
— worse than no answer. And `npm run build --prefix packages/noodl-viewer-react` rewrites
`packages/noodl-editor/src/external/`, which is the same checkout that editor is serving from, so
rebuilding hot-reloads someone else's live preview mid-session.

**What is unverified for all eighteen:** that the new ports reach the node library as *connectable*
ports; that `Completed` counts equal raw invocation counts on real clicks; and that these eleven new
failure codes reach the warnings chip with provenance — `event-sender/no-channel`,
`open-file-picker/open-failed`, `parent-component-object/fetch-no-parent`,
`close-popup/no-popup-in-scope`, `external-link/blocked`, `navigate-to-path/no-path`,
`show-popup/no-target`, `show-popup/target-failed`, `states/no-states`, `states/unknown-state`,
`logic-builder/reserved-port-name`.

If `:8574` **is** free:

```
npm run build --prefix packages/noodl-viewer-react   # or the editor shows the old ports
rm -f .logs/dev.log && nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# read the real port names FIRST — the corpus reads the definition, the editor
# reads what the node library actually published:
node ./scripts/devtools/cdp.js eval "window.NodeLibraryData.nodetypes.find(n=>n.name==='States').ports.filter(p=>p.plug==='output'&&(p.type==='signal'||(p.type&&p.type.name==='signal'))).map(p=>p.name).join(' ')"
# build a rig programmatically rather than through the picker:
#   window.__nodeGraphEditor.model.owner.owner        the ProjectModel
#   proj.components[0].constructor                    ComponentModel
#   proj.components[0].graph.roots[0].constructor     NodeModel
#   comp.graph.addRoot(n) · g.addChild(c)
#   comp.graph.addConnection({fromId,fromProperty,toId,toProperty})
#   proj.addComponent(comp) · proj.setRootComponent(comp)   home AND reloads the preview
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
npm run dev:stop
```

⚠️ `addConnection` accepting a wire proves **nothing** — it silently accepts wires to ports that do
not exist. Read port names off `NodeLibraryData` first, and wire a raw counter straight off the
trigger so a rig that reads "the node is silent" can be told from one whose wires go nowhere.
⚠️ A root component renders one visual root tree; hang everything visual off one `Group`, whose
`flexDirection` takes `column`. ⚠️ `Text` has an `onClick` and is the simplest clickable.
⚠️ `Counter` exposes `currentCount`; wire it to a `Text`'s `text` and read `document.body.innerText`
in the viewer. ⚠️ `--target=viewer` reaches the preview; the unqualified target is the editor.
`cdp click` takes a CSS selector only, and the eval context persists, so a bare `const`
redeclaration fails on the second call — wrap in an IIFE. Launch detached; never `cdp reload`;
`npm run dev:stop` when done. ⚠️ The rig lands in whatever project the editor has open, which is
outside the repo — but check `git status` on the way out anyway.

The warnings panel:

```
node ./scripts/devtools/cdp.js eval "document.querySelector('[class*=EditorTopbar-module__WarningsChip]').innerText"
npm run cdp -- click "[class*=EditorTopbar-module__WarningsChip]"
```

### Open items, carried forward

- ⚠️ **`Items Rendered` fires with zero item nodes existing after a `Refresh`** — measured, filed,
  not fixed. `_queueOperation(() => { this.refresh(); })` drops the promise; the one-character fix
  is `() => this.refresh()`. It moves when an existing signal fires, so it wants its own decision.
- ⚠️ **`States`' `goToState` same-state guard is unreachable from any action port.** A revert of it
  reddened nothing, because `scheduleGoToState`'s pending-target guard catches the same request a
  frame earlier. Removing it is a behaviour question, not a rename.
- ⚠️ **`Update Record`'s `Local only` branch and `GlobalStore.Set` are unmeasured `Unchanged`
  candidates** — `Model.set` suppresses an identical value but reports nothing back.
- ⚠️ **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES §25).
- ⚠️ **`Array Map`'s `mapScript` default never compiles until an author touches it** — FINDINGS
  **A-D1**. Filed, not fixed.

### Measuring "N of 82" — do this, do not count prose

```python
python3 - <<'PY'
import json, re
doc = open('dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md').read()
table = doc.split('<!-- BEGIN GENERATED TABLE -->')[1].split('<!-- END GENERATED TABLE -->')[0]
nodes = {n['typeName']: n for n in json.load(open('packages/noodl-types/src/node-catalog.json'))['nodes']}
cat, cur, rows = {}, None, []
for line in table.split('\n'):
    m = re.match(r'^### (.+)$', line)
    if m: cur = m.group(1); continue
    m = re.match(r'^\| `([^`]+)` — ', line)
    if m and cur:
        t = m.group(1); rows.append(t)
        if 'completed' not in {o['name'] for o in (nodes.get(t, {}).get('outputs') or [])}:
            cat.setdefault(cur, []).append(t)
todo = sum(len(v) for v in cat.values())
print(f'{len(rows)-todo} of {len(rows)} done, {todo} remain')
for k in sorted(cat): print(f'  {k}: {len(cat[k])} — {", ".join(cat[k])}')
PY
```

Commit straight to `cline-dev`, one commit per node family, pathspec-scoped. ⚠️ ~880 commits exist
only on this machine and Richard has said "leave it — I'll handle the remote". Do not push; do not
re-litigate it.

**Update on the way out:** the bottom section of `ERG-001-S0-MEASUREMENT.md`, and this prompt. Say
how many of §0's 82 actions now satisfy the contract, measured with the script above, and which
remain — per category, generated.
