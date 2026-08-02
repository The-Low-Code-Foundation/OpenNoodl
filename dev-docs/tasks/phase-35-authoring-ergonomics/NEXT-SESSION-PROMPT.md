# Next-session prompt — ERG-001 §4, the remaining 37

**Replaces** the "remaining 48" prompt. That session shipped one build, `d6dda7bf`: the whole
Cloud Services category, all eleven actions.

**45 of §0's 82 actions satisfy the contract, measured** — not counted from prose. Re-derive the
number with the script at the bottom rather than trusting a running total; the phase has already
had one arithmetic slip in a handover.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **B — the long tail** | 37 actions by category, then §3 and §5 | Decided, **Data is the obvious next block** |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended: stream B, Data.** Twenty of the thirty-seven, one coherent file set, and fifteen of
them are single-action renames of the same shape the eleven Cloud Services nodes just took. Do the
five multi-action ones (`HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator`,
`Run Tasks`) last, as one sub-build, because they share one port set per node the way `WebSocket`
does.

⚠️ **§3 still wants the Variables family first.** It already carries `Treat empty as` in exactly
the shape Rule 3 describes, and it has the `Unchanged` that setting would govern.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.

⚠️ **There is a concurrent session.** Phase 36 (`OBS-00x`, Track U) commits to this same branch
from this same checkout and spawns worktrees. **Never `git stash`, never `git checkout .`, never
`git add -A`.** Pathspec-scope every add and commit; if a file you did not touch appears, read it
and leave it alone. Last session's commit landed cleanly *between* two of theirs.

⚠️ **Never `git checkout <path>` on a file you have edited but not committed** — it restores from
the index and silently discards the work. **Commit before running any revert experiment**; that is
what made last session's six-revert discrimination check safe.

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — **the
   "§4, Cloud Services" section at the bottom is more current than this prompt**, and its closing
   register says what remains and why.
3. `packages/noodl-runtime/src/outcome.ts` (`outcomeOutputs`, and now `reportOutcomes`) and
   `Node.prototype.beginOutcome` / `reportOutcome` in `packages/noodl-runtime/src/node.ts` — the
   one implementation. Do not add a second.
4. Reference implementations, by shape:
   - *synchronous* — `collectionnode-insert.ts`
   - *the answer already computed and thrown away* — `variables/variablebase.ts`
   - *async with a coalescing guard* — **`user/login.ts`** is now the cleanest example: mint before
     the guard, drain into a local before the request goes out
   - *async, single invocation, no guard* — `uploadfile.ts` / `signfileurl.ts`
   - *async, optional token* — `router.tsx` / `websocket.ts`'s `pendingConnect` / `settleConnect`
   - *a port that is not an outcome* — `Fetched` on `dbmodelnode2.ts`, `Progress Changed` on
     `uploadfile.ts`, `Items Rendered` on `foreach.tsx`. **Three slices have now hit this shape and
     the answer has been the same every time: leave the existing event alone, add the outcome
     beside it.**

### Build 1 — Data, the fifteen single-action renames

`Action Handler`, `Add Record Relation`, `Array`, `Array Filter`, `Array Map`, `Create Record`,
`Delete Record`, `Filter Records`, `JSON Stream Parser`, `Object`, `Pattern Extractor`,
`Remove Record Relation`, `Set Variable`, `State Snapshot`, `Update Record`.

⚠️ **`Create Record` / `Update Record` / `Delete Record` and the two relation nodes share
`dbmodelcrudbase`.** That is one funnel for five nodes — the opposite of the Cloud Services shape,
where each node had its own. Change it once; do not let five nodes each grow a copy.

⚠️ §0.2 Result 2's other wire names are still live here: `created` (`NewDbModelProperties`),
`stored` (`SetDbModelProperties`), `relationAdded` / `relationRemoved`, `deleted`. All become
`done`. **A rename has three places to sweep** — see the sweep rules below.

### Build 2 — Data, the five multi-action nodes

`HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator`, `Run Tasks`.

⚠️ **`Run Tasks` is the node the contract's own problem statement is about** — "fired `Done` on one
of four terminal paths, so an empty list — the common case — stopped a graph dead". Read that
paragraph before touching it. ⚠️ The empty-list case is **not** an `Unchanged`: `For Each`'s
exemption is recorded for exactly this reason — putting the common empty case on a different wire
from the common non-empty one is the same defect with the sign flipped.

### Build 3 — the rest, then §3 and §5

Cloud (2), Component Utilities (2), Navigation (4), Animation/Events/Logic/String/Utilities (6),
CustomCode (3).

⚠️ `Component Object` / `Parent Component Object` have a `Fetch` and a `Fetched` — **the exact
Record/User question just answered**. Read that section before deciding.
⚠️ `Close Popup` is NV-iii's original latch. ⚠️ `Condition` has no completion path at all today.
⚠️ **`Logic Builder` registers block names verbatim and the collision against its existing
`error`/`run` ports is already live and silent** — FINDINGS **SR-ix**. Read NDA-004 §3 first.
⚠️ **`Open File Picker`'s `success` is referenced by `upload-file`'s enrichment prose and by two
`docs/node-catalog/examples` graphs.** Sweep those when it is renamed — last session left them
deliberately, and verified they were the picker's port and not a miss.

Then **§3** (`Treat Unchanged as`, Variables family first — ⚠️ a declared `default` does not run
its setter, FINDINGS **A-D1**) and **§5** (the validator's dead-end check).

⚠️ **§5 must not flag the contract's own exemptions, and the list grew by eleven.**
Missing `Unchanged`: `Page Stack`, `For Each`, **and all eleven Cloud Services actions**.
Missing `Failure`: `net.noodl.StateHistory`, `For Each Actions`, all four Variables. Each is
recorded with its reasoning and each has a corpus row asserting the port is **absent**.

### Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict which
  rows a revert reddens before running it**. Twenty-three reverts across the phase; twenty exact.
  ⚠️ **Record the misses with the reasoning intact** — last session's two misses were each more
  informative than a corrected prediction would have been, and one of them (`Sign In With`) showed
  the design was load-bearing for a path the prediction had not considered.
- ⚠️ **A row that asserts *silence* cannot detect a wrongly-minted token.** Measured: minting in
  `Record`'s `setModelID` does not redden "binding Id reports no outcome", because a token minted in
  a setter is never settled. What catches it is the *next* invocation reporting twice. Write the
  counting row, not just the silence row.
- **`sendSignalOnOutput`, never `flagOutputDirty`**, on a signal output (FINDINGS **SR-v**).
- **The outcome is the last thing an action does.** Flag values dirty first.
- **Only the port mints a token.** Every setter-driven or mount-path route into the same work must
  report nothing. The one recorded exception is `Sign In With`'s return leg, and it is documented as
  one.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op.** `Completed`
  has no exemption. ⚠️ **The pinned controls are load-bearing.**
- ⚠️ **Create pending-token arrays lazily in the `schedule` method, not in `initialize`.** Several
  suites build nodes as a bag of bound methods and never call `initialize`, so an eager field is
  `undefined` exactly where the first invocation reads it.
- ⚠️ **`expect(...).not.toContain('<old port>')` passes VACUOUSLY once the port is gone.** Assert
  the exact signal array instead. Two files in the repo had this shape; both are fixed, but a new
  rename can reintroduce it in a minute.
- ⚠️ **Do not poke a node's deferred inner method in a test.** Two rows called `doCall` directly,
  which ran the work with no invocation behind it — a state the product cannot be in. Drive the
  method the *port* reaches.
- **A rename has two sides and *three* places to sweep**: project `.json`, source, and specs that
  build graphs inline in TypeScript. ⚠️ Also **author-facing prose** in
  `docs/node-catalog/examples/*.json` descriptions and `docs/node-catalog/enrichment/*.json`, and
  ⚠️ **`library/prefabs/*/project/project.json`** — the shipped prefabs, which no slice before last
  session had had to touch (14 wires there).
  ⚠️ Connections come in **two formattings**: multi-line objects and single-line ones. A rewriter
  that handles only the first reports a clean run having missed a file. On-disk keys are
  `fromId`/`fromProperty`; the editor *export* format used by corpus graphs is
  `sourceId`/`sourcePort`. **Sanity-check any sweep against wires you know exist before believing a
  zero.**
- ⚠️ **`catalog:merge:check` catches a stale enrichment entry on a STATIC node and is silent on a
  DYNAMIC one.** Measured last session: four flagged by name, three missed. 86 of 151 nodes are
  dynamic. **Grep `docs/node-catalog/enrichment/` against the real port set both ways, by hand.**
- ⚠️ **Edit large fixture JSON by line, not by `json.dump`.**

### Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**102 suites, 1891 passing, 13 skipped**) ·
`packages/noodl-viewer-react` jest (**55 suites, 720 passing**) · `typecheck:runtime` ·
viewer-react typecheck (`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) ·
`typecheck:cloud` · `catalog:check` · `catalog:merge:check` · `cloud-library:check` ·
editor `test:ci` (**2007 specs**).

⚠️ **Capture the editor gate's summary line, not the tail** — `| grep -E "Jasmine:|FAILED"`.
⚠️ **The bar is 0 failures, and new console noise must be *accounted for*.** Count `[noodl]` raise
lines, **not** `console.error` blocks — jest echoes the source line, so the block count is double
and the phase's earlier "250" figure is that doubled count. Current: `noodl-runtime` **118**,
`noodl-viewer-react` **195**. Every added line must be an NDA-004 failure a row explicitly asserts.
⚠️ `catalog:check` passes while the other two are stale — run all three. Regenerating is
`catalog:generate`, `catalog:merge`, `cloud-library:generate`.

**Standing traps:** run `noodl-runtime`'s jest from **inside the package** (`cd
packages/noodl-runtime && npx jest --reporters=summary`). Build `dist-types` first
(`npm run build:types`). ⚠️ **`graph-harness` does not call a module's `setup`.** ⚠️ **The harness
builds the *runtime's* NodeContext.** ⚠️ **A connection to a port the target does not declare is
silently never made.** Scope greps to `packages/*/src`.

⚠️ **When a node's own test harness is a bag of bound methods, give it the REAL
`beginOutcome`/`reportOutcome`** (`NodeCtor.prototype.X.bind(instance)`) **and a `hasOutput` backed
by the definition's declared outputs.** A blanket `hasOutput: () => false` turns every outcome into
a spurious `outcome/missing-port`; a blanket `true` hides a genuinely missing port. Four harnesses
were converted last session — `signfileurl.test.ts` is the clearest model.

### Live QA

Owed for whatever this slice builds. The recipe that worked, in full:

```bash
npm run build --prefix packages/noodl-viewer-react   # or a deployed app keeps the old ports
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# read the real port names FIRST:
node ./scripts/devtools/cdp.js eval "window.NodeLibraryData.nodetypes.find(n=>n.name==='Counter').ports.map(p=>p.plug[0]+':'+p.name).join(' ')"
# build a rig programmatically rather than through the picker:
#   window.__nodeGraphEditor.model.owner.owner        the ProjectModel
#   proj.addComponent(ComponentModel.fromJSON({name, id, graph:{roots,connections}}))
#   m.roots[0].constructor.fromJSON({id,type,x,y,parameters,ports,children})
#   m.addRoot(n) · n.addChild(c) · m.addConnection({fromId,fromProperty,toId,toProperty})
#   proj.setRootComponent(comp)                       makes it home AND forces a preview reload
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
node ./scripts/devtools/cdp.js --target=viewer click "button"
npm run dev:stop
```

⚠️ **`m.addConnection` accepting a wire proves NOTHING** — it silently accepts wires to ports that
do not exist. Read port names off `NodeLibraryData` first, and **wire a raw counter straight off the
Button** so a rig that reads "the node is silent" can be told from one whose wires go nowhere.
⚠️ **A root component renders one visual root tree.** Hang everything visual off one `Group`.
⚠️ `Group`'s `flexDirection` takes `column`, not `vertical` — a wrong value raises a real warning
that turns up in the warnings-panel probe and is a rig bug, not a product defect.
⚠️ **A node parameter can decide the first outcome** — same class as NDA-017's "a saved project
applies a parameter before the port exists".
⚠️ `--target=viewer` reaches the running preview; the unqualified target is the editor.
⚠️ `cdp click` takes a **CSS selector only**; `cdp eval` already declares `t` — name variables
anything else and wrap in an IIFE.
⚠️ Only one editor at a time (`lsof -i :8574`); launch detached; never `cdp reload`;
`npm run dev:stop` when done.

**✅ The warnings-panel question is CLOSED and does not need re-verifying.** A failure's *message*
and provenance do render:

```bash
node ./scripts/devtools/cdp.js eval "document.querySelector('[class*=EditorTopbar-module__WarningsChip]').innerText"
npm run cdp -- click "[class*=EditorTopbar-module__WarningsChip]"
```

The chip's count equals the number of failures; the panel shows
`<message>` + `At node <Name> in component <Component>`. The **code** is the key the warning is
filed under, not something the panel displays. `.logs/dev.log` stays silent by design — in the
editor the bus routes to the editor subscriber rather than the console, which is why the corpus
asserts codes on the bus directly.

### One defect filed and not fixed, if you want it

**`Items Rendered` fires with zero item nodes existing after a `Refresh`** — measured, not inferred.
`_queueOperation(() => { this.refresh(); })` drops the promise, so `await op()` returns immediately
and the queue drains while the rebuild is still awaiting `addItem`. A corpus row in
`erg-001-repeater-outcomes.test.ts` pins the measured ordering. **The one-character fix is
`() => this.refresh()`** — it moves when an existing signal fires, so it wants its own decision.

### Measuring "N of 82" — do this, do not count prose

```bash
python3 - <<'PY'
import json, re
doc = open('dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md').read()
table = doc.split('<!-- BEGIN GENERATED TABLE -->')[1].split('<!-- END GENERATED TABLE -->')[0]
rows = re.findall(r'^\| `([^`]+)` — ', table, re.M)
nodes = {n['typeName']: n for n in json.load(open('packages/noodl-types/src/node-catalog.json'))['nodes']}
done = [r for r in rows if 'completed' in {o['name'] for o in (nodes.get(r, {}).get('outputs') or [])}]
print(f'{len(done)} of {len(rows)}')
for r in rows:
    if r not in done: print('  todo:', r)
PY
```

**Commit straight to `cline-dev`**, one commit per node family, pathspec-scoped.
⚠️ **~865 commits exist only on this machine and Richard has said "leave it — I'll handle the
remote". Do not push; do not re-litigate it.**

**Update on the way out:** the bottom section of `ERG-001-S0-MEASUREMENT.md`, and this prompt.
**Say how many of §0's 82 actions now satisfy the contract, measured with the script above, and
which remain.**
