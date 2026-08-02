# Next-session prompt — ERG-001 §4, the remaining 48

**Replaces** the long-tail prompt. That session shipped three builds — the streaming pair
(`537b14aa`, `58c2dfb5`), the Repeater family (`f3a4a1a9`) and the Variables family
(`fcf52c14`), plus a sweep fix (`9b4cf2bd`).

**34 of §0's 82 actions satisfy the contract, measured** — not counted from prose. ⚠️ The
previous prompt's "27" was an arithmetic slip; the true figure before that session was 26.
Re-derive the number with the script at the bottom rather than trusting a running total.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **B — the long tail** | 48 actions by category, then §3 and §5 | Decided, large, **batchable** |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended: stream B, Cloud Services first.** All eleven already have `Success`/`Failure`, so
it is mostly a rename to `done` plus a real `completed` — one coherent family, one file set, no
design. Then Data (20, the largest block), leaving CustomCode last because `Logic Builder`'s
collision is live and silent.

⚠️ **Do §3 on the Variables family.** It already carries `Treat empty as` in exactly the shape
Rule 3 describes, and it now has the `Unchanged` that setting would govern.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.

⚠️ **There is a concurrent session.** Phase 36 (`OBS-001`…`OBS-004`, Track U) commits to this
same branch from this same checkout and spawns worktrees. **Never `git stash`, never
`git checkout .`, never `git add -A`.** Pathspec-scope every add and commit; if a file you did
not touch appears, read it and leave it alone.

⚠️ **Never `git checkout <path>` on a file you have edited but not committed** — it restores from
the index and silently discards the work. Copy to a backup before any revert experiment, or
commit first. That cost a full re-implementation of `websocket.ts` last session.

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — **the "§4, the long
   tail" section at the bottom is more current than this prompt**, and its closing register says
   what remains and why.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.beginOutcome` / `reportOutcome`
   in `packages/noodl-runtime/src/node.ts` — the one implementation. Do not add a second.
4. Reference implementations, by shape:
   - *synchronous* — `collectionnode-insert.ts`
   - *the answer already computed and thrown away* — `variables/variablebase.ts`
     (`setValueTo` returns the `changed` boolean)
   - *deferred through a scheduler* — `modelcrudbase.scheduleStore`
   - *queued per action* — `undonode.ts`; *coalescing tokens* — `foreach.tsx`
     (`pendingRefreshOutcomes` is an array because `scheduleRefresh` coalesces)
   - *async, optional token* — `router.tsx` / `router-navigate.ts`, and `websocket.ts`'s
     `pendingConnect` / `settleConnect`. **Those are the reference for anything async.**

### Build 1 — Cloud Services, all eleven together

`CloudFunction2`, `LogIn`, `LogOut`, `DbModel2`, `RequestMagicLink`, `SetUserProperties`,
`Sign File URL`, `SignInWith`, `SignUp`, `Upload File`, `User`.

⚠️ **`Record` and `User` also carry `Changed` and `Fetched`.** Those are value-level events — the
same relationship `Items Rendered` has to the Repeater's `Refresh`, and `Changed` to a Variable's
`Set`. **Do not fold them into the outcome.** Three separate slices have now hit this shape and
each time the honest answer was to leave the existing event alone and add the invocation's
outcome beside it.

⚠️ **`Upload File`'s `Progress Changed` is not an outcome either**, and an upload is async: the
token has to survive the transfer. `websocket.ts`'s `pendingConnect` is the shape.

### Build 2 — Data, the 20

`Action Handler`, `Add Record Relation`, `Array`, `Array Filter`, `Array Map`, `Create Record`,
`Delete Record`, `Filter Records`, `HTTP Request`, `JSON Stream Parser`, `Object`,
`Optimistic Update`, `Pattern Extractor`, `Remove Record Relation`, `Run Tasks`, `Set Variable`,
`State Snapshot`, `Stream Buffer`, `Text Accumulator`, `Update Record`.

Five are multi-action (`HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator`,
`Run Tasks`) and share one port set per node, as `WebSocket` does. The rest are single-action
renames. ⚠️ **`Run Tasks` is the node the contract's own problem statement is about** — read that
paragraph before touching it.

### Build 3 — the rest, then §3 and §5

Cloud (2), Component Utilities (2), Navigation (4), Animation/Events/Logic/String/Utilities (6),
CustomCode (3).

⚠️ `Close Popup` is NV-iii's original latch. ⚠️ `Condition` has no completion path at all today.
⚠️ **`Logic Builder` registers block names verbatim and the collision against its existing
`error`/`run` ports is already live and silent** — FINDINGS **SR-ix**. Read NDA-004 §3 first.

Then **§3** (`Treat Unchanged as`, on the Variables family first — ⚠️ a declared `default` does
not run its setter, FINDINGS **A-D1**) and **§5** (the validator's dead-end check).

⚠️ **§5 must not flag the contract's own exemptions.** Missing `Unchanged`: `Page Stack`,
`For Each`. Missing `Failure`: `net.noodl.StateHistory`, `For Each Actions`, and all four
Variables. Each is recorded with its reasoning and each has a corpus row asserting the port is
**absent**.

### One defect filed and not fixed, if you want it

**`Items Rendered` fires with zero item nodes existing after a `Refresh`** — measured, not
inferred. `_queueOperation(() => { this.refresh(); })` drops the promise, so `await op()` returns
immediately and the queue drains while the rebuild is still awaiting `addItem`. That is the
defect NDA-004 §3 added the port to prevent, still live on one of the two paths in. A corpus row
in `erg-001-repeater-outcomes.test.ts` pins the measured ordering. **The one-character fix is
`() => this.refresh()`** — it is a behaviour change (it moves when an existing signal fires), so
it wants its own decision, not a drive-by.

### Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict
  which rows a revert reddens before running it**. Seventeen reverts across the phase; sixteen
  predictions exact. ⚠️ The one miss is recorded in `erg-001-repeater-outcomes.test.ts` **with
  its miss intact** rather than rewritten to match — do the same, because *why* it was wrong was
  more informative than the prediction.
- **`sendSignalOnOutput`, never `flagOutputDirty`**, on a signal output (FINDINGS **SR-v**).
- **The outcome is the last thing an action does.** Flag values dirty first.
- **Only the port mints a token.** Every setter-driven or mount-path route into the same work
  must report nothing. This claim turns out to be load-bearing across a whole file, not just in
  the rows written to state it.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op.**
  `Completed` has no exemption. ⚠️ **The pinned controls are load-bearing** — one caught a
  `Failure` minted on `State History` and was right.
- **A rename has two sides, and *three* places to sweep.** Project `.json`, source, **and specs
  that build graphs inline in TypeScript** — that third one is what got missed last session and
  it cost five editor failures. Anchor on the source node's id, and ⚠️ **sanity-check the sweep
  against wires you know exist** before believing a zero: the on-disk keys are
  `fromId`/`fromProperty`, not `sourceId`/`sourcePort`.
- ⚠️ **`catalog:merge:check` does NOT catch a stale enrichment entry, in either direction.** Last
  session hit it twice: four files describing a port that had been removed, and one describing a
  port deliberately never added — the latter reached `node-catalog-enriched.json`. **Grep
  `docs/node-catalog/enrichment/` against the real port set both ways, by hand.**
- ⚠️ **Edit large fixture JSON by line, not by `json.dump`.**

### Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**99 suites, 1843 passing, 13 skipped**) ·
`packages/noodl-viewer-react` jest (**54 suites, 678 passing**) · `typecheck:runtime` ·
viewer-react typecheck (`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) ·
`typecheck:cloud` · `catalog:check` · `catalog:merge:check` · `cloud-library:check` ·
editor `test:ci` (**2007 specs**).

⚠️ **Capture the editor gate's summary line, not the tail.** An intermediate run was captured
with `tail -4`, which cut the `Jasmine: … failures` line off entirely — so a gate that had 5
failures read as green. Use `| grep -E "Jasmine:|FAILED"`.

⚠️ **The bar is 0 failures, and new console noise must be *accounted for*, not merely absent.**
`noodl-runtime`'s jest currently emits 250 `console.error` blocks; every line added must be an
NDA-004 failure a row explicitly asserts. Measure the delta rather than asserting "no new noise".
⚠️ `catalog:check` passes while the other two are stale — run all three. Regenerating is
`catalog:generate`, `catalog:merge`, `cloud-library:generate` (there is no `npm run catalog`).

**Standing traps:** run `noodl-runtime`'s jest from **inside the package** (`cd
packages/noodl-runtime && npx jest --reporters=summary`). Build `dist-types` first
(`npm run build:types`). ⚠️ **`graph-harness` does not call a module's `setup`.** ⚠️ **The
harness builds the *runtime's* NodeContext**, which has no `setNodeFocused` and no React.
⚠️ **A connection to a port the target does not declare is silently never made**, so a corpus
sink needs the input actually declared — that cost an hour on `tryRemove`'s handshake, which
took the no-connections branch and read as the node reporting the wrong outcome. Scope greps to
`packages/*/src`.

### Live QA

Owed for whatever this slice builds. The recipe that worked, in full:

```bash
npm run build --prefix packages/noodl-viewer-react   # or a deployed app keeps the old ports
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# read the real port names FIRST — see the trap below:
node ./scripts/devtools/cdp.js eval "window.NodeLibraryData.nodetypes.find(n=>n.name==='Counter').ports.map(p=>p.plug+':'+p.name).join(' ')"
# build a rig programmatically rather than through the picker:
#   window.__nodeGraphEditor.model.owner.owner        the ProjectModel
#   proj.addComponent(ComponentModel.fromJSON({name, id, graph:{roots,connections}}))
#   m.roots[0].constructor.fromJSON({id,type,x,y,parameters,ports,children})
#   m.addRoot(n) · n.addChild(c) · m.addConnection({fromId,fromProperty,toId,toProperty})
#   m.removeConnection(c) · m.removeConnectionsForNode(n) · m.removeNode(n)
#   proj.setRootComponent(comp)                       makes it home AND forces a preview reload
node ./scripts/devtools/cdp.js targets                       # the preview is a webview target
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
node ./scripts/devtools/cdp.js --target=viewer click "button.ndl-controls-button"
npm run dev:stop
```

⚠️ **`m.addConnection` accepting a wire proves NOTHING.** It silently accepts wires to ports that
do not exist — a rig wired `Counter.increaseCount` and `Counter.count`, neither of which exists
(they are `increase` and `currentCount`), and every call returned happily. The rig then read as
"the node reports nothing". **An earlier version of this prompt claimed acceptance was evidence
the port was connectable; it is not.** Read port names off `NodeLibraryData` first.
⚠️ **Wire a raw counter straight off the Button** and check it before believing any count — that
is what separated "the node is silent" from "the wires go nowhere".
⚠️ **A root component renders one visual root tree.** Hang everything visual off one `Group`.
⚠️ **`removeConnectionsForNode` is per node**, so rebuilding half a rig leaves the other half's
wires behind. To rewire wholesale:
`comp.graph.connections.slice().forEach(c => comp.graph.removeConnection(c))`.
⚠️ **Counters report on `currentCount`, and only when it changes** — a fresh rig shows `-` until
the first increment, which is not a failure.
⚠️ **A node parameter can decide the first outcome.** A `String` with `value` *and*
`runOnChange-value:false` as parameters wrote through before `Set` ever fired, so the first `Set`
reported `Unchanged` rather than `Done`. Same class as NDA-017's "a saved project applies a
parameter before the port exists". Change the value at runtime to see `Done`.
⚠️ **The editor routes the error bus to the warnings panel, not the console**, so a failure
*code* will not appear in `.logs/dev.log` during live QA. Confirm codes in the corpus; if you
need the panel, open it before probing. (This was left unverified last session and is still owed
for `repeater/*`, `websocket/*` and `sse/*`.)
⚠️ `--target=viewer` reaches the running preview; the unqualified target is the editor.
⚠️ `cdp click` takes a **CSS selector only** — for anything else, `eval` a `.click()`.
⚠️ `cdp eval` already declares `t` — name your variables anything else, and wrap in an IIFE.
⚠️ **`packages/noodl-editor/src/external/` holds stale duplicate folders `viewer 3/`, `deploy 2/`,
`ssr 3/` dated 2025-12-06 that no build writes to.** The live paths are `viewer/`, `deploy/`,
`ssr/`.
⚠️ Only one editor at a time (`lsof -i :8574`); launch detached; never `cdp reload`;
`npm run dev:stop` when done.

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
