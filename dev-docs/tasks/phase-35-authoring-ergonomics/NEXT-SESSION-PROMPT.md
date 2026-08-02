# Next-session prompt — ERG-001 §4, the navigation slice

**Replaces** the "starting with the rename" prompt. That work is discharged: the rename is
finished across all six nodes, DV-viii is five-ninths closed, §0.3's `Unchanged` register is
half closed, and **criterion 8 is met in full** including the running-preview half that had
been owed since §2 (`a6a56ed2` → `541f14c7`).

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

**20 of §0's 82 actions satisfy the contract.** What remains splits three ways:

| Stream | Contents | State |
|---|---|---|
| **A — navigation** | `Router` / `Page Stack` `Reset`, `RouterNavigate`, `Page`, `State History` | Decided; needs real design, one shared file set |
| **B — the long tail** | ~57 actions by category, then §3 and §5 | Decided, large, batchable |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended first slice: stream A.**

It is the last of DV-viii and the last of §0.3's register, so finishing it closes both of the
two named debts the contract was written to answer — after which stream B is a genuine sweep
with no design left in it. It is also the only remaining group that needs *thought* rather than
throughput, which makes it the wrong thing to leave for a batch worker.

⚠️ **It is not a sweep.** See the prompt.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip `541f14c7`, clean tree, one worktree. **An uncommitted file is orphaned work, not another
session's — read it, then commit or discard it deliberately.**

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec. Note **"the one real
   exception"**: navigation destroys the graph that would observe the signal, so these nodes emit
   on the paths that *do not* navigate and document the successful path as terminal. That
   paragraph is this slice's whole design brief.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — **the §4 section at
   the bottom is more current than this prompt**, and its closing register says what remains and
   why each item was left.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.reportOutcome` in
   `packages/noodl-runtime/src/node.ts` — the one implementation. Do not add a second.
4. Reference implementations, by shape:
   - *synchronous* — `collectionnode-insert.ts`
   - *deferred through a scheduler* — `modelcrudbase.scheduleStore`
   - *queued per action* — `undonode.ts` (`queued: {action, outcome}[]`)
   - *deferred until a React ref exists* — `react-component-node.ts#outcomeOnInnerComponent`

### Build — the navigation slice

| Node | Signal input | The shape |
|---|---|---|
| `Router` — Page Router | `Reset` | `done` rebuilt · `unchanged` already on that page · `failure` ×4 |
| `Page Stack` — Component Stack | `Reset` | same shape, `navigation-stack.tsx` |
| `RouterNavigate` — Navigate | `Navigate` | §0.3: `router.tsx:401-410` returns bare on a no-op re-selection |
| `Page` — Page Ready | `Page Ready` | emits only an internal `SSR_PageReady` (`page.ts:93`) |
| `net.noodl.StateHistory` — State History | `Clear History` | `statehistorynode.ts:177-181`, silent; `unchanged` when empty |

⚠️ **Three things make the Router half genuinely hard, and none is visible from the port list.**

1. **`reset()` is called on mount, not only from the `Reset` input.** `router-handler.ts:83` and
   `navigation-handler.ts:90,106` both call it so the start page is created. That is *not* an
   invocation of the author's `Reset` port and must report **nothing** — a mount that fired
   `Done` would pulse every chain in the app at boot. The token has to be optional and travel
   from `scheduleReset` only.
2. **It is async through an `asyncQueue`.** `reset()` enqueues `resetAsync`, which awaits
   `nodeScope.createNode`. The token must survive that, which is exactly why `beginOutcome`
   returns a token rather than setting a flag on the node.
3. **`resetAsync` has four raise-and-return paths already** (`router/no-pages`,
   `no-start-page`, `page-not-found`, `component-is-not-a-page`). Each becomes `failure` with
   the code it already raises — pass the code through `reportOutcome` and delete the separate
   `raiseRuntimeError`, or you will raise twice.

⚠️ **`Navigate`'s successful path is the contract's named exception.** It leaves the page, so
there may be no downstream node left to hear anything. Emit on the paths that do not navigate —
the no-op re-selection (`Unchanged`) and the failures — and *document the successful path as
terminal in the port description*. Do not quietly give it a `Done` that sometimes reaches nobody.

### Then, if it fits — stream B by category

§0's 82-row table is the scope and §4 of `ERG-001-OUTCOME-CONTRACT.md` says how to batch it
(disjoint file sets per worker; catalog and enrichment taken away from workers and merged
centrally). Highest value first:

1. **`net.noodl.WebSocket` and `net.noodl.SSE`** — §0.3 names only their disconnect-when-not-
   connected path, but Rule 1 covers every action, so `Connect` and `Send` need deciding at the
   same time. ⚠️ Both are async. Do not adopt one input and leave the siblings — that is the
   per-node divergence `outcome.ts`'s docstring exists to prevent.
2. **`For Each` / `For Each Actions`** — §0's "emits nothing at all" table, not yet read.
3. Everything else, by category.

Then **§3** (`Treat Unchanged as`, following NDA-003's shape on the Variables nodes — ⚠️ a
declared `default` does not run its setter, FINDINGS **A-D1**) and **§5** (the validator's
dead-end check; `description` is already present on every port §4 has added).

### Two open items §4 recorded rather than settled

- **`GlobalStore.Set` has an unmeasured `Unchanged` candidate.** `setKey` ends in `Model.set`
  without `forceChange`, so re-writing a key with the value it already holds is a real no-op.
  Adding it means changing `setKey`'s `void` return and reasoning about `merge`. §0.3 never
  measured this node; deriving the verdict from the shape of the code is what that section
  exists to prevent. Decide it deliberately or leave it deliberately.
- **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
  §25). Left verbatim, because repairing it changes when `Count Changed` fires — a behaviour
  change dressed as a rename.

### Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict
  which rows a revert reddens before running it**. Four reverts were run last session and all
  four predictions were exact; hold that bar.
- **`sendSignalOnOutput`, never `flagOutputDirty`**, on a signal output (FINDINGS **SR-v**). The
  helper already does this; do not bypass it.
- **The outcome is the last thing an action does.** Flag values dirty first. ⚠️ Two
  `ActionDispatcher` handlers were incrementing their counts *after* the signal; that class is
  still live elsewhere.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op.**
  `Completed` has no exemption.
- **A rename has two sides.** Before renaming a port, sweep for the **old** name as well as the
  new one. ⚠️ And check the sweep is not silently broken: §0's script read `sourceId`/`sourcePort`
  where the on-disk keys are `fromId`/`fromProperty`, so it reported zero hits against 21 real
  ones. A clean sweep and a broken sweep look identical.
- ⚠️ **Edit large fixture JSON by line, not by `json.dump`.**

### Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**96 suites, 1789 passing, 13 skipped**) ·
`packages/noodl-viewer-react` jest (**52 suites, 627 passing**) · `typecheck:runtime` ·
viewer-react typecheck (`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) ·
`typecheck:cloud` · `catalog:check` · `catalog:merge:check` · `cloud-library:check` ·
editor `test:ci` (**2007 specs**).

⚠️ **The bar is 0 failures *and* no new noise.** ⚠️ `catalog:check` passes while the other two
are stale — run all three. Regenerating is `catalog:generate`, `catalog:merge`,
`cloud-library:generate` (there is no `npm run catalog`). The **enrichment files**
(`docs/node-catalog/enrichment/*.json`) name ports explicitly, so a rename reddens
`catalog:merge:check`, not `catalog:check`.

**Standing traps:** run `noodl-runtime`'s jest from **inside the package** (`cd packages/noodl-runtime
&& npx jest --reporters=summary`). Build `dist-types` first (`npm run build:types`). ⚠️
**`graph-harness` does not call a module's `setup`, and 45 of the 82 actions are dynamic-port
nodes.** ⚠️ **The harness builds the *runtime's* NodeContext**, which has no `setNodeFocused` and
no React — stub the first, and drive `timerScheduler.runTimers(t)` by hand if a row needs a timer
to actually be running (`Timer.start()` only queues; `_isRunning` is set inside `runTimers`).
Scope greps to `packages/*/src`.

### Live QA

Criterion 8 is **met** and does not need repeating. New live QA is owed for whatever this slice
builds — navigation is the one family where a corpus row genuinely cannot see the consequence,
because the whole point is that the page goes away.

The recipe that worked, in full:

```bash
npm run build --prefix packages/noodl-viewer-react   # or a deployed app keeps the old ports
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# build a rig programmatically rather than through the picker — far faster and repeatable:
#   window.__nodeGraphEditor.model                 the component's graph
#   .roots[0].constructor.fromJSON({id,type,x,y,parameters,ports,children})
#   m.addRoot(node) · node.addChild(child) · m.addConnection({fromId,fromProperty,toId,toProperty})
#   m.owner.owner.setRootComponent(m.owner)        makes it the home component so it renders
node ./scripts/devtools/cdp.js targets                       # the preview is a webview target
node ./scripts/devtools/cdp.js --target=viewer click "button"
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
npm run dev:stop
```

⚠️ `--target=viewer` reaches the running preview; the unqualified target is the editor.
⚠️ `cdp click` takes a **CSS selector only**. ⚠️ `cdp eval` already declares `t` — name your
variables anything else, and wrap in an IIFE. ⚠️ **`m.addConnection` accepting a wire is itself
evidence** the editor's node library carries the port as connectable, not merely as a catalog
row. ⚠️ `project.setRootComponent(undefined)` **throws** (`projectmodel.ts:163` dereferences
`.graph`), so you cannot un-set a home component this way; `bcn010-live` is currently left with
`/App` as home. ⚠️ **`packages/noodl-editor/src/external/` holds stale duplicate folders
`viewer 3/`, `deploy 2/`, `ssr 3/` dated 2025-12-06 that no build writes to** — grepping them
says a rebuild failed when it succeeded. The live paths are `viewer/`, `deploy/`, `ssr/`.
⚠️ Only one editor at a time (`lsof -i :8574`); launch detached; never `cdp reload`;
`npm run dev:stop` when done.

**Commit straight to `cline-dev`**, one commit per node or per coherent family, pathspec-scoped.
⚠️ **~865 commits exist only on this machine and Richard has said "leave it — I'll handle the
remote". Do not push; do not re-litigate it.**

**Update on the way out:** the §4 section at the bottom of `ERG-001-S0-MEASUREMENT.md`, and this
prompt. **Say how many of §0's 82 actions now satisfy the contract, and which remain.**
