# Next-session prompt — ERG-001 §4, the remaining 21

**Replaces** the "remaining 29" prompt (which lived only in the handover message, never in this
file — the copy here was still the "remaining 37" one). That session shipped two builds —
`84a4fe9f` (the four single-verb Data nodes) and `d7aed297` (the four small multi-verb ones) — plus
three doc/test commits, **and cleared the live-QA debt for its own eight nodes and the previous
session's eight.**

**61 of §0's 82 actions satisfy the contract, measured** — not counted from prose. Re-derive with
the script at the bottom. ⚠️ The phase has had two arithmetic slips in handovers *and* one design
instruction that reading the source disproved. Generate the numbers, and read the code before
believing a shape.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **B — the long tail** | 21 actions, then §3 and §5 | Decided; **Data is down to its five big ones** |
| **C — the other Tier 1** | `ERG-002` external libraries | Independent; no decision outstanding |

**Recommended: stream B**, and open with the **non-Data remainder**, not the five big ones. Sixteen
of the twenty-one are outside Data, most are small, and three of them carry decisions worth making
while there is room to think: `States`' unguarded verbatim outputs, `Logic Builder`'s reserved
names, and `Condition`, which has no completion path at all today.

Then the five big Data nodes (`HTTP Request`, `Optimistic Update`, `Stream Buffer`,
`Text Accumulator`, `Run Tasks`) as one sub-build, then §3 and §5.

⚠️ **`Run Tasks` is the node the contract's own problem statement is about.** Read that paragraph
before touching it. Its empty-list case is **not** an `Unchanged` — `For Each`'s exemption is
recorded for exactly that reason, and `Pattern Extractor` took the same call last session for the
same reason.

⚠️ **`States` has unguarded verbatim output names** (§0.2 Result 4): `registerOutputIfNeeded` opens
with `if (this.hasOutput(name)) return;`, so a States node with a value called `done` silently loses
its value output to the contract's signal. It needs the `Logic Builder` treatment
(`RESERVED_OUTPUTS` + a reported collision) **before** the reserved names land on it. The concurrent
phase-36 session has been editing `states.ts` — read it fresh rather than from any note.

---

## The prompt

Continue `ERG-001` (phase 35) on branch `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

⚠️ **There is a concurrent session and it was active all of last session.** Phase 36 (`OBS-00x`,
Track U) commits to this same branch from this same checkout, spawns worktrees, and its
`nodegx-observe` build holds an editor on `:8574`. **Never `git stash`, never `git checkout .`,
never `git add -A`.** Pathspec-scope every add and commit; if a file you did not touch appears, read
it and leave it alone. Last session's six commits interleaved cleanly with three of theirs — and
`node.ts` was transiently uncompilable for ten minutes mid-session because they were part-way
through an edit. That is normal; wait, do not "fix" it.

⚠️ **Never `git checkout <path>` on a file you have edited but not committed** — it restores from the
index and silently discards the work. Commit before running any revert experiment. That is what made
last session's twelve reverts safe.

⚠️ **A handover is a plan, not a measurement.** Last session's prompt instructed a rename that the
source disproved; the build that followed the source is right and the instruction was wrong. Before
adopting the contract on a node that already has a "did something" signal, **grep every caller of
the method that sends it**. If any caller is an input setter or a subscription callback, that signal
is a *value-level announcement*, the outcome goes **beside** it, and you do not rename. That
question has now been asked seven times and answered the same way every time.

**Read first, in this order:**

1. `dev-docs/reference/OUTCOME-CONTRACT.md` — Rules 1–4 are the whole spec.
2. `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` — the "§4, the long
   tail" section at the bottom is more current than this prompt.
3. `packages/noodl-runtime/src/outcome.ts` and `Node.prototype.beginOutcome` / `reportOutcome` in
   `node.ts` — the one implementation. Do not add a second.
4. **Reference implementations, by shape:**
   - *one funnel serving several nodes* — `dbmodelcrudbase.ts`: ports declared once via a `done`
     option, `setError(err, tokens?)`, `pendingOutcomes`/`takeOutcomes` on the base.
   - *a value-level announcement kept beside the outcome* — `filtercollectionnode.ts`'s `modified`
     and `foreach.tsx`'s `itemsRendered`. Both carry the reasoning in a comment.
   - *a token paired with a queued action* — `statesnapshotnode.ts`'s `queued: {action, token}[]`.
   - *an inline action needing no pending array* — `pattern-extractor.ts`, `actionhandlernode.ts`.
   - *an `Unchanged` that is genuinely earned* — `json-stream-parser.ts`'s empty-buffer branch, and
     the comment saying why a parse that merely advanced the buffer is `Done` instead.
   - *a port that is not an outcome* — `Fetched` on the three Fetch twins, `Progress Changed` on
     `uploadfile.ts`, `Items Rendered` on `foreach.tsx`, `Trigger` on `actionhandlernode.ts`.

### Build 1 — the non-Data remainder, smallest decisions first

`Send Event`, `Unique Id`, `Open File Picker`, `Response`, `Send Email`, `Component Object`,
`Parent Component Object`, then the four Navigation nodes, then `States`, `Condition`, `Expression`,
`JavaScriptFunction`, `Logic Builder`.

- ⚠️ `Component Object` / `Parent Component Object` have a `Fetch` and a `Fetched` — the question
  answered six times. Read the answer, do not re-derive it.
- ⚠️ `Close Popup` is NV-iii's original latch: it reports its first outcome again on every later use.
- ⚠️ `Condition` has no completion path at all today.
- ⚠️ `Logic Builder` registers block names verbatim and the collision against its existing
  `error`/`run` ports is already live and silent — FINDINGS **SR-ix**. Read NDA-004 §3 first.
- ⚠️ `Open File Picker`'s `success` is referenced by `upload-file`'s enrichment prose and by two
  `docs/node-catalog/examples` graphs. Sweep those if it is renamed.
- ⚠️ Navigation is the contract's **one real exception**: the successful path may destroy the graph
  that would observe the signal. Emit on the paths that do *not* navigate and document the rest.

### Build 2 — the five big Data nodes

`HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator`, `Run Tasks`. They share
one port set per node the way `WebSocket` does, so read all five before writing any.

### Build 3 — §3 and §5

§3 (`Treat Unchanged as`, **Variables family first** — ⚠️ a declared `default` does not run its
setter, FINDINGS **A-D1**) and §5 (the validator's dead-end check).

⚠️ **§5 must not flag the contract's own exemptions**, and the absent-`Unchanged` list grew by seven
last session: `Filter Collection`, `Map Collection`, `FilterDBModels`, `Set Variable`,
`net.noodl.ActionHandler`, `net.noodl.StateSnapshot`, `net.noodl.PatternExtractor`. On top of the
existing: `Page Stack`, `For Each`, all eleven Cloud Services actions, all five Record CRUD nodes
and all three `Fetch` twins. ⚠️ `net.noodl.JSONStreamParser` **does** have an `Unchanged` and must
not be flagged for lacking one. Absent `Failure`: `net.noodl.StateHistory`, `For Each Actions`, all
four Variables, `Collection2`, and `Variable2`'s `Fetch` (its `Failure` exists but belongs to the
`Value` setter — §5 must not credit it to `Fetch`).

## Rules that are not negotiable

- **Corpus rows before ports**, each red first with a green control beside it, and **predict which
  rows a revert reddens before running it.** Forty-seven reverts across the phase; thirty-four
  exact.
- ⚠️ **Predict per *fixture*, not per row.** Moving a mint into a scheduler reddened 10 where 5 was
  predicted, and 8 where 4 was — every row that binds a value and then pulses gains an outcome it
  never asserted. Three sessions have now made this same mistake.
- ⚠️ **A row's title is not an assertion.** Read what each row's body actually checks.
- ⚠️ **A row that asserts silence cannot detect a wrongly-minted token** — measured three times now.
  A token minted in a setter is never settled, so nothing is reported and the silence row stays
  green. What catches it is the next invocation draining the stale token and reporting twice. Write
  the counting row.
- ⚠️ **`failure` is often two things at once.** On the filter/map nodes and the JSON parser it is
  both an outcome and a value-level announcement, so a row about a *pulse's* failure must read from
  a mark taken before the pulse. `outcomesOf(graph, id, from)` in last session's files is the shape.
- ⚠️ **A message dedup swallows the *first* pulse's outcome too**, not just the repeat, when a
  value-driven run already announced the same message. Settle tokens outside the dedup.
- ⚠️ **An outcome must not be inferred from state the branch already reset.** `settleParse` read
  `internal.error` after the runaway-buffer branch had cleared the buffer and reported `Done` for a
  parse it had just given up on. Pass the outcome, do not derive it.
- ⚠️ **Some correct changes are unobservable, and that is worth predicting as zero.** Record the
  zero; do not invent a row that fakes discrimination.
- `sendSignalOnOutput`, never `flagOutputDirty`, on a signal output (FINDINGS **SR-v**).
- **The outcome is the last thing an action does.** Flag values dirty first, then any value-level
  announcement, then the outcome.
- **Only the port mints.** Every setter-driven or mount-path route into the same work reports
  nothing. The one recorded exception is `Sign In With`'s return leg.
- **No `Failure` on a node that cannot fail, no `Unchanged` on one that cannot no-op. `Completed`
  has no exemption.** ⚠️ The pinned controls are load-bearing — but note that a port-surface control
  asserting `hasOutput('unchanged') === false` does **not** catch a *report* routed to `unchanged`
  without the port; that only raises `outcome/missing-port`.
- ⚠️ **Create pending-token arrays lazily in the schedule/request method, not in `initialize`.**
- ⚠️ **Replace a `requested` boolean with the token array rather than running both.** "An author
  asked" is `tokens.length > 0`; two flags drift.
- ⚠️ `expect(...).not.toContain('<old port>')` passes **vacuously** once the port is gone. Assert the
  exact signal array.
- A rename has three places to sweep: project `.json`, source, and specs that build graphs inline in
  TypeScript — plus author-facing prose in `docs/node-catalog/examples/*.json` and
  `acceptance/*.json` descriptions, `docs/node-catalog/enrichment/*.json`, and
  `library/prefabs/*/project/project.json`. ⚠️ Connections come in two formattings; on-disk keys are
  `fromId`/`fromProperty`, editor-export keys are `sourceId`/`sourcePort`. Sanity-check any sweep
  against wires you know exist before believing a zero. ⚠️ Deliberately left, do not "fix":
  `packages/noodl-editor/tests/testfs/**` and `dev-docs/tasks/phase-15-…/measurements/live/**`.
- ⚠️ **`catalog:merge:check` is blind to a stale enrichment entry on a DYNAMIC node**, and 86 of 151
  nodes are dynamic. Grep `docs/node-catalog/enrichment/` against the real port set both ways, by
  hand. Last session found two stale entries this way that no gate could see — one of them a Rule-4
  statement that had been false since NDA-017 §2.
- ⚠️ Edit large fixture JSON **by line**, not by `json.dump`.

## Gates — measure all nine before you start and again at the end, and report both numbers

`packages/noodl-runtime` jest (**107 suites, 2008 passing, 13 skipped**) ·
`packages/noodl-viewer-react` jest (**59 suites, 801 passing**) · `typecheck:runtime` ·
viewer-react typecheck (`npx tsc -p packages/noodl-viewer-react --noEmit --skipLibCheck`) ·
`typecheck:cloud` · `catalog:check` · `catalog:merge:check` · `cloud-library:check` ·
editor `test:ci` (**2007 specs**).

⚠️ Capture the editor gate's summary line, not the tail — `| grep -E "Jasmine:|FAILED"`. It takes
~10 minutes; start it before you need it, and do not edit source while it builds.

⚠️ **The bar is 0 failures, and new console noise must be accounted for** — but ⚠️ **the absolute
`[noodl] raise` totals are unusable while two sessions share the branch.** Measure your own delta
**by exclusion**: full package run, minus a run with `--testPathIgnorePatterns "<your new file>"`.
Every line in the difference must be an NDA-004 failure a row explicitly asserts. Count lines
matching `^ +\[noodl\] ` — each raise prints two `[noodl]` occurrences, one being jest's echo of the
source line.

⚠️ `catalog:check` passes while the other two are stale — run all three. Regenerating is
`catalog:generate`, `catalog:merge`, `cloud-library:generate`.

**Standing traps:** run `noodl-runtime`'s jest from inside the package. Build `dist-types` first
(`npm run build:types`). ⚠️ `graph-harness` does not call a module's `setup`. ⚠️ A connection to a
port the target does not declare is silently never made. Scope greps to `packages/*/src`.

⚠️ When a node's test harness is a bag of bound methods, give it the **real**
`beginOutcome`/`reportOutcome` (`NodeCtor.prototype.X.bind(instance)`) and a `hasOutput` backed by
the definition's declared outputs. A blanket `false` turns every outcome into a spurious
`outcome/missing-port`; a blanket `true` hides a genuinely missing port. Five harnesses have needed
this; `signfileurl.test.ts` is the clearest model.

## ✅ Live QA — the debt is CLEAR, and the recipe is proven

Last session ran it: `:8574` was free, the rig went up in `/erg-rig`, and it settled the real port
set for **twelve** nodes, `Completed` counting equal to raw clicks (5 = 5), and `Object`'s new
`Failure` reaching the warnings chip with provenance. Nothing is owed for anything built before
`d7aed297`. **What you build is owed a run of its own.**

`lsof -i :8574` FIRST. If it is free:

```
npm run build --prefix packages/noodl-viewer-react   # or the editor shows the old ports
rm -f .logs/dev.log && nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done; sleep 30
npm run cdp -- health
npm run cdp -- click "[class*=Projects-module__Grid] > *:nth-child(1)"    # bcn010-live
# read the real port names FIRST — the corpus reads the definition, the editor reads what
# the node library actually published:
node ./scripts/devtools/cdp.js eval "window.NodeLibraryData.nodetypes.find(n=>n.name==='Model2').ports.filter(p=>p.plug==='output'&&(p.type==='signal'||(p.type&&p.type.name==='signal'))).map(p=>p.name).join(' ')"
# build a rig programmatically rather than through the picker:
#   window.__nodeGraphEditor.model.owner.owner        the ProjectModel
#   proj.components[0].constructor                    ComponentModel
#   proj.components[0].graph.roots[0].constructor     NodeModel
#   comp.graph.addRoot(n) · g.addChild(c)
#   comp.graph.addConnection({fromId,fromProperty,toId,toProperty})
#   proj.addComponent(comp) · proj.setRootComponent(comp)   makes it home AND reloads the preview
node ./scripts/devtools/cdp.js --target=viewer eval "document.body.innerText"
npm run dev:stop
```

⚠️ **`addConnection` accepting a wire proves NOTHING** — it silently accepts wires to ports that do
not exist. Read port names off `NodeLibraryData` first, and **wire a raw counter straight off the
trigger** so a rig that reads "the node is silent" can be told from one whose wires go nowhere.
⚠️ A root component renders **one** visual root tree; hang everything visual off one `Group`, whose
`flexDirection` takes `column`. ⚠️ `Text` has an `onClick` and is the simplest clickable — no need
to find a Button type name. ⚠️ `Counter` exposes `currentCount`; wire it to a `Text`'s `text` and
read `document.body.innerText` in the viewer. ⚠️ `--target=viewer` reaches the preview; the
unqualified target is the editor. `cdp click` takes a CSS selector only, and the eval context
**persists**, so a bare `const` redeclaration fails on the second call — wrap in an IIFE. Launch
detached; never `cdp reload`; `npm run dev:stop` when done. ⚠️ The rig lands in whatever project the
editor has open, which is outside the repo — but check `git status` on the way out anyway.

The warnings panel:

```
node ./scripts/devtools/cdp.js eval "document.querySelector('[class*=EditorTopbar-module__WarningsChip]').innerText"
npm run cdp -- click "[class*=EditorTopbar-module__WarningsChip]"
```

## Open items, carried forward

- ⚠️ `Items Rendered` fires with zero item nodes existing after a `Refresh` — measured, filed, not
  fixed. `_queueOperation(() => { this.refresh(); })` drops the promise; the one-character fix is
  `() => this.refresh()`. It moves when an existing signal fires, so it wants its own decision.
- ⚠️ `Update Record`'s `Local only` branch and `GlobalStore.Set` are unmeasured `Unchanged`
  candidates — `Model.set` suppresses an identical value but reports nothing back.
- ⚠️ `Counter`'s `Reset` guard reads `this.currentValue` and has never fired (PLAT-003 NOTES §25).
- ⚠️ `Array Map`'s `mapScript` `default` never compiles until an author touches it — FINDINGS
  **A-D1** in a node nobody had noticed it in. Filed, not fixed.

## Measuring "N of 82" — do this, do not count prose

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

**Commit straight to `cline-dev`, one commit per node family, pathspec-scoped.**
⚠️ ~875 commits exist only on this machine and Richard has said "leave it — I'll handle the remote".
Do not push; do not re-litigate it.

**Update on the way out:** the bottom section of `ERG-001-S0-MEASUREMENT.md`, and this prompt. Say
how many of §0's 82 actions now satisfy the contract, **measured with the script above**, and which
remain — per category, generated.
