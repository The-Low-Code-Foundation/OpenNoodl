# Next-session prompt — ERG-001 §4, the long tail

**Replaces** the navigation-slice prompt. That work is discharged, and it shipped seven nodes
rather than the five it scoped: `Router`, `Page Stack`, `RouterNavigate`, `PageStackNavigate`,
`PageStackNavigateBack`, `Page`, `net.noodl.StateHistory` (`46be4922` onward).

**27 of §0's 82 actions satisfy the contract.** More importantly, **both named debts the contract
was written to answer are closed**: DV-viii's Visual table and §0.3's `Unchanged` register have
no entries left. Everything remaining in §4 is throughput.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **B — the long tail** | ~53 actions by category, then §3 and §5 | Decided, large, **batchable** |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended: stream B, batched.** There is no design left in it. §4 of
`ERG-001-OUTCOME-CONTRACT.md` says how to batch — disjoint file sets per worker, catalog and
enrichment taken away from workers and merged centrally.

The one part that still needs *thought* is `WebSocket`/`SSE`, because both are async and §0.3
measured only one of their inputs. Take that first, alone.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Clean tree, one worktree. **An uncommitted file is orphaned work, not another session's — read
it, then commit or discard it deliberately.**

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — **the "§4, the
   navigation slice" section at the bottom is more current than this prompt**, and its closing
   register says what remains and why.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.reportOutcome` in
   `packages/noodl-runtime/src/node.ts` — the one implementation. Do not add a second.
4. Reference implementations, by shape:
   - *synchronous* — `collectionnode-insert.ts`
   - *deferred through a scheduler* — `modelcrudbase.scheduleStore`
   - *queued per action* — `undonode.ts` (`queued: {action, outcome}[]`)
   - *deferred until a React ref exists* — `react-component-node.ts#outcomeOnInnerComponent`
   - *async, optional token, fanned-out callback* — `router.tsx` (`scheduleReset` / `_reportReset`)
     and `router-navigate.ts` (`PendingNavigation` / `settle`). **The navigation slice is the
     reference for anything async or callback-driven.**

### Build 1 — `net.noodl.WebSocket` and `net.noodl.SSE`, together

⚠️ **Do not adopt one input and leave the siblings.** §0.3 names only the
disconnect-when-not-connected path, but Rule 1 covers *every* action, so `Connect` and `Send`
need deciding at the same time. Adopting `Disconnect` alone is exactly the per-node divergence
`outcome.ts`'s docstring exists to prevent. Both are async: the token must survive the socket
handshake, which is the `PendingNavigation` shape from `router-navigate.ts`.

### Build 2 — `For Each` / `For Each Actions`

§0's "emits nothing at all" table, **still not read**. Read the source before deciding anything;
`Refresh` has an `Items Rendered` output that is not tied to the invocation, and
`foreachactions.ts:44` is an optional callback that is silent either way.

### Build 3 — the rest, by category

§0's 82-row table is the scope. Then **§3** (`Treat Unchanged as`, following NDA-003's shape on
the Variables nodes — ⚠️ a declared `default` does not run its setter, FINDINGS **A-D1**) and
**§5** (the validator's dead-end check).

⚠️ **§5 must not flag the contract's own exemptions.** `Page Stack` deliberately has no
`Unchanged` (its reset always rebuilds) and `net.noodl.StateHistory` deliberately has no
`Failure` (it is the tracker for its own store name). Both are recorded with their reasoning and
both have corpus rows asserting the port is **absent**.

### Two open items still recorded rather than settled

- **`GlobalStore.Set` has an unmeasured `Unchanged` candidate.** `setKey` ends in `Model.set`
  without `forceChange`, so re-writing a key with the value it already holds is a real no-op.
  Adding it means changing `setKey`'s `void` return and reasoning about `merge`. §0.3 never
  measured this node; deriving the verdict from the shape of the code is what that section exists
  to prevent. (⚠️ The navigation slice *did* change `stateHistoryManager.clearHistory` from
  `void` to a result — the difference is that its manager is internal to one pair of nodes and
  every caller is in the repo, which was never established for `setKey`.)
- **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
  §25). Left verbatim, because repairing it changes when `Count Changed` fires — a behaviour
  change dressed as a rename.

### Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict
  which rows a revert reddens before running it**. Eight reverts have been run across the phase
  and all eight predictions were exact; hold that bar.
- **`sendSignalOnOutput`, never `flagOutputDirty`**, on a signal output (FINDINGS **SR-v**). The
  helper already does this; do not bypass it.
- **The outcome is the last thing an action does.** Flag values dirty first.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op.**
  `Completed` has no exemption. ⚠️ **The pinned controls from NDA-004 are load-bearing here** —
  one of them caught a `Failure` minted on `State History` and was right. If a pinned control
  reddens, read its comment before "fixing" it.
- **A rename has two sides.** Sweep for the **old** name as well as the new one, **anchored on
  the source node's id**, and ⚠️ **sanity-check the sweep against wires you know exist** before
  believing a zero — §0's sweep read `sourceId`/`sourcePort` where the on-disk keys are
  `fromId`/`fromProperty` and reported zero against 21 real hits.
- ⚠️ **`catalog:merge:check` does NOT catch a rename.** It passed while two enrichment files
  still described a `navigated` port the nodes no longer had; an enrichment `ports` entry naming
  a non-existent port is accepted silently. Grep `docs/node-catalog/enrichment/` by hand.
- ⚠️ **Edit large fixture JSON by line, not by `json.dump`.**

### Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**97 suites, 1795 passing, 13 skipped**) ·
`packages/noodl-viewer-react` jest (**53 suites, 664 passing**) · `typecheck:runtime` ·
viewer-react typecheck (`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) ·
`typecheck:cloud` · `catalog:check` · `catalog:merge:check` · `cloud-library:check` ·
editor `test:ci` (**2007 specs**).

⚠️ **The bar is 0 failures *and* no new noise.** ⚠️ `catalog:check` passes while the other two
are stale — run all three. Regenerating is `catalog:generate`, `catalog:merge`,
`cloud-library:generate` (there is no `npm run catalog`).

**Standing traps:** run `noodl-runtime`'s jest from **inside the package** (`cd packages/noodl-runtime
&& npx jest --reporters=summary`). Build `dist-types` first (`npm run build:types`). ⚠️
**`graph-harness` does not call a module's `setup`.** ⚠️ **The harness builds the *runtime's*
NodeContext**, which has no `setNodeFocused` and no React — stub the first, and drive
`timerScheduler.runTimers(t)` by hand if a row needs a timer running. Scope greps to
`packages/*/src`.

⚠️ **For a node the corpus cannot stand up** (anything reaching `NoodlRuntime.instance` through a
handler singleton), the working pattern is the hand-built probe: bind the definition's real
methods onto a bag **first**, collaborators **after**, and attach the real
`Node.prototype.beginOutcome`/`reportOutcome` so "exactly one per invocation" is the real code
and not a fake. See `erg-001-navigation-outcomes.test.ts`.

### Live QA

Owed for whatever this slice builds. The recipe that worked, in full:

```bash
npm run build --prefix packages/noodl-viewer-react   # or a deployed app keeps the old ports
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# build a rig programmatically rather than through the picker:
#   window.__nodeGraphEditor.model.owner.owner        the ProjectModel
#   proj.addComponent(ComponentModel.fromJSON({name, id, graph:{roots,connections}}))
#   m.roots[0].constructor.fromJSON({id,type,x,y,parameters,ports,children})
#   m.addRoot(n) · n.addChild(c) · m.addConnection({fromId,fromProperty,toId,toProperty})
#   m.removeConnectionsForNode(n) · m.removeNode(n) · m.removeConnection(c)
#   proj.setRootComponent(comp)                       makes it home AND forces a preview reload
node ./scripts/devtools/cdp.js targets                       # the preview is a webview target
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
node ./scripts/devtools/cdp.js --target=viewer click "button.ndl-controls-button"
npm run dev:stop
```

⚠️ **A root component renders one visual root tree.** Five sibling visual roots put only the
first on screen, silently — hang everything visual off one `Group`.
⚠️ **`removeConnectionsForNode` is per node**, so rebuilding half a rig leaves the other half's
wires behind. Duplicate wires make one click look like two invocations. **Wire a raw counter
straight off the Button** before believing any count — that is what separated "the node reports
twice" from "the rig has two wires".
⚠️ **`Router` has no sizing ports**; use `styleCss` to stop its `flex: 1 1` squeezing its
siblings to nothing.
⚠️ `--target=viewer` reaches the running preview; the unqualified target is the editor.
⚠️ `cdp click` takes a **CSS selector only** — for anything else, `eval` a `.click()`.
⚠️ `cdp eval` already declares `t` — name your variables anything else, and wrap in an IIFE.
⚠️ **`m.addConnection` accepting a wire is itself evidence** the editor's node library carries
the port as connectable, not merely as a catalog row.
⚠️ **`packages/noodl-editor/src/external/` holds stale duplicate folders `viewer 3/`, `deploy 2/`,
`ssr 3/` dated 2025-12-06 that no build writes to** — grepping them says a rebuild failed when it
succeeded. The live paths are `viewer/`, `deploy/`, `ssr/`.
⚠️ Only one editor at a time (`lsof -i :8574`); launch detached; never `cdp reload`;
`npm run dev:stop` when done.

**Commit straight to `cline-dev`**, one commit per node or per coherent family, pathspec-scoped.
⚠️ **~865 commits exist only on this machine and Richard has said "leave it — I'll handle the
remote". Do not push; do not re-litigate it.**

**Update on the way out:** the bottom section of `ERG-001-S0-MEASUREMENT.md`, and this prompt.
**Say how many of §0's 82 actions now satisfy the contract, and which remain.**
