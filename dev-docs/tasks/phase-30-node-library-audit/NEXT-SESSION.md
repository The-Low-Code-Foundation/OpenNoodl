# Phase 30 — next session

**Current to the `Logic Builder` audit commit.** Written 2026-07-30.

Work on `cline-dev`, commit directly to it, **explicit pathspecs on every commit**. End commit
messages with the Claude co-author line.

⚠️ If HEAD has moved past that commit, read PROGRESS.md's newest three log entries instead of this
file — they are always current; this file goes stale in one round.

## §0 — the state in four numbers

| | |
|---|---|
| NDA-012 | **15 of 17 categories, 80 of 155 nodes** |
| Defects found | **116**, in 67 nodes |
| Port documentation | **51.8%**, nodes at 0% **30** |
| Gates | runtime jest 1,243 · viewer 367 · cloud 57 · editor jasmine 1,894/0 · 3 typechecks clean · `catalog:check`, `catalog:merge:check` and `catalog:examples` all exit 0 |

**Only Data (46) and Visual (29) are left**, and they are the two the spec ranked first and third by
expected yield. **Every other category is complete and nothing is blocked.**

**NDA-004 §3 is CLOSED, 10 of 10.** `Logic Builder` was the last mute node in the library.

**The find rate went up.** CustomCode now leads at 2.80 per node, Animation second at 2.50; the
running average is 1.45 across 80 nodes. The one low score, Component Utilities' 0.63, has a *stated
cause* — four of its eight nodes had already been remediated twice — which is a different thing from
exhaustion. FINDINGS **SR-i**.

⚠️ **Read FINDINGS SR-viii before starting Data.** It carries a defect this session filed and did
not fix, in a Data node, and the reason it was missed for two days.

## §1 — do these, in this order

### 1. **`REST` (`REST2`), and it is a Data node — do it as the first slice of item 2**

Filed by the `Logic Builder` audit and **not fixed**, because it belongs to the category below.
`restnode.ts:178-184` and `:194-201` each compile an author script with `new Function` inside an
input setter and swallow the `SyntaxError` into a `console.log`. Worse than the three siblings that
had the same defect, because **the assignment is inside the `try`**: a broken edit to the Request or
Response script leaves the *previous* script installed and fetching, so the author watches a request
they have already changed. The fix is settled by three precedents — `expression.ts:189-196`,
`simplejavascript.ts:250-267`, `logic-builder.ts:271-283` — a `Failure` port, the message on an
error output, and a deduplicated `raiseRuntimeError`.

⚠️ **It is the fifth script host, and four consecutive passes counted four.** FINDINGS **SR-viii**
has the table and the two rules that fall out of it. Read it before you trust any other "the class
is these N nodes" claim in this phase — including one written the same day by the same pass.

### 2. **Data (46 nodes).** The last big one, and bigger than the node count suggests.

**Measured 2026-07-30, before planning: 517 ports, 55 documented — 10.6%.** 29 of the 46 nodes are
at 0%. Data alone is **~19% of the library's ports and holds ~5% of its documentation**, so this
category is most of what remains of NDA-005 and will move the headline number more than the previous
four passes combined. Run it as **one pass, not two** — NDA-012's C1 *is* NDA-005 — and read
[`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md) first; it is normative and
settled.

It will not fit in one session. Split it **by helper, not alphabetically**:

| Family | Nodes | Members |
|---|---|---|
| Legacy Object/Variable/Collection (`modelcrudbase`) | ~17 | `Model2`, `Variable2`, `Collection2`, the `Collection*` verbs, `SetModelProperties`, `Static Data`, `Filter`/`Map Collection`, `For Each Actions` |
| Record family (`dbmodelcrudbase`) | 6 | `FilterDBModels`, `NewDbModelProperties`, `SetDbModelProperties`, `DeleteDbModelProperties`, `Add`/`RemoveDbModelRelation` |
| BYOB | 5 | `noodl.byob.{QueryData,CreateRecord,UpdateRecord,DeleteRecord,SubscribeToChanges}` |
| Agent/stream (`net.noodl.*`) | ~15 | `SSE`, `WebSocket`, `TextAccumulator`, `StreamBuffer`, `JSONStreamParser`, `PatternExtractor`, `ActionDispatcher`/`Handler`, `OptimisticUpdate`, `StateHistory`/`Snapshot`/`Undo`, `GlobalStore` ×3 |
| Misc | 3 | `RunTasks`, `net.noodl.HTTP`, `REST2` |

**Do the legacy families first and the agent/stream nodes last.** The 29 nodes at 0% are almost
entirely legacy; the `net.noodl.*` nodes are the newest code in the library — AIX-005 built them
*with* descriptions — and are the only Data nodes already partly documented. Highest yield per hour
is where the documentation is absent and the code is oldest.

Read the helper once and each node is minutes — but record a helper defect **once** with its sites
listed, or the register reports a usage count. This last batch had four such shapes and the
worksheets show the format.

⚠️ **A scope question to settle before writing 37 descriptions, not after.** Three of the 46 are
**deprecated *and* absent from the node picker** — `Collection` (Array, 17 ports), `Model` (Object,
11) and `Variable` (9). That is **37 of the 517 ports, 7% of the job, on nodes nobody can add to a
graph.** `REST2` is deprecated but *is* in the picker, so it stays in scope regardless. Decide
whether C1 covers unpickable deprecated nodes and write the decision into PROGRESS.md either way,
because it changes what the coverage percentage means. This is adjacent to §2 item 3 and is probably
worth putting to Richard alongside it.

Then **Visual (29)** last: only 1 node is at 0%, so its C1 work is nearly done and only the other
eleven checks remain.

### 3. Three questions that earned their place, and are not in the twelve checks

- **"And what happens the second time?"** Found `Animation`'s latched start value — the fourth site
  of the one-shot shape, after Navigation's two.
- **Read the module's `setup`.** [`test/corpus/setup-harness.ts`](../../../packages/noodl-runtime/test/corpus/setup-harness.ts)
  now exists: `driveSetup({module, type, nodes})` returns `portNames()`, `warnings`,
  `setParameter()`. Read its `importComplete`/`announceNodes` notes before concluding a node
  publishes nothing — a module that publishes nothing here has usually not been *driven*, and the
  fix is a flag rather than a defect report.
- **"Does a name in this port string round-trip?"** New last round, and it found two defects
  independently in one day. Anywhere the library concatenates author-chosen names into a flat port
  name and decodes with `split('-')`, a hyphen in the name breaks it silently. FINDINGS **SR-iii**.

### 4. ~~The three copies of the `setup` harness.~~ **Half done `12d6b5ae`.**

The triplicated `emitter()` is gone — `setup-harness.ts` owns it, and `FakeEmitter` gained
`listeners` so NDA-009 §1 can keep asserting the negative (a module gated on `isRunningLocally`
subscribes to nothing at all).

**What remains is not mechanical, which is why it was left.** NDA-009, NDA-010 and NDA-012's
Navigation test still build their own `graphModel` and `editorConnection` rather than going through
`driveSetup`. Each has its own warning-recording shape that its rows assert against, so converting
them changes what those rows *measure*. Do it as its own commit, one file at a time, and re-run each
suite between.

### 5. NDA-017 §2 — only if Richard has decided §1.

Do not start from the spec body; §0's correction is written into the spec in place.

## §2 — what needs Richard. Surface it; do not decide it.

Only the first blocks anything.

1. **NDA-017 §1, which BLOCKS §2.** Never-arrived detection vs. an upstream-pending notion in the
   runtime vs. making NDA-004 §3's completion-signal sequencing discoverable. The spec recommends
   A + C now, B separately; §0 added a constraint to A in place — the seed also reaches the graph
   with no `Run` at all, which a control-signal check cannot see.
2. **Two creatable nodes read "Delete Record"** — `DeleteDbModelProperties` (Parse-wire) vs
   `noodl.byob.DeleteRecord` (BYOB). Neither is deprecated, so the collision survives the fix that
   keyed `register.js`'s preserved verdicts on the rendered cell.
3. **NDA-004 §2's ⏳ item 9, the deprecated five. FIVE data points now and they still disagree.**
   `Script Downloader` does network I/O with no failure surface (easiest "yes"). `Number Blend` is
   deprecated and the healthier of its pair. The deprecated `Cloud Function` has a `Failure` signal
   with no reason port anywhere. `Signal To Index` is deprecated and its one alleged defect was
   unobservable. And **`Index To String` is deprecated and its signal ordering is *correct*** — more
   than several non-deprecated nodes manage. **Deprecation tracks age, not quality.**
4. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results.
5. **`Value Changed` cannot see an Object or Array being edited** — needs a decision, not a patch.
6. **The picker-integrity question, four members now.** `net.noodl.user.SignInWith` and
   `net.noodl.user.RequestMagicLink` cannot be added to a graph while four *deprecated* auth nodes
   can (CS-i); `On App Error` was registered and working but absent from the picker; `Page Inputs`
   was in the picker with no connectable ports (NV-i, live-verified fixed). Each was found by a
   different accident and **none by any check this phase runs.** A picker-integrity check would have
   caught all four and does not exist.
7. **Three of the four dynamic-port mechanisms carry no documentation channel at all** (FINDINGS
   **SR-ii**). `numberedInputs` writes no metadata entry, and the Port Editor panel writes none —
   which means `Component Inputs` and `Component Outputs`, the nodes that define **every
   component's public interface**, are undocumentable by any means the library has. NDA-005's
   coverage number measures one mechanism of four. Bug or scope boundary is Richard's call.
8. **The stringlist "New entry" popup renders the comment/code editor** — an 8-row textarea
   placeholdered `// Add your comment here...` — for a field that takes one identifier. Found live
   on `Page Inputs`; it affects every `stringlist` port in the library. Small, but it is a UI
   decision rather than an obvious fix, because the textarea is shared with the comment editor.

## §3 — carry these; they were learned the hard way

- ⚠️ **`git log --oneline -- <path>` before you believe a handover about who owns a file.** Nine
  handovers described `logic-builder.ts` as another session's in-progress rewrite to be stepped
  around. It was the missing half of a commit that had already landed **partial from a different
  worktree**. Two tells were available throughout: the path's own history, and a working-tree mtime
  (22:34) *earlier* than the commit (22:41). An inherited "do not touch" is a hypothesis too — the
  same rule as an inherited defect claim, applied to ownership.
- **The catalog substitution dance is no longer needed.** It existed solely because of that file.
  Regenerate normally: `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`,
  then `npm run catalog:check`, `npm run catalog:merge:check` and `npm run catalog:examples`.
- **Make the strong assertion.** Not "the catalog differs only in the ports I documented" but *strip
  the fields I added and the result is byte-identical to HEAD*. That is what surfaced the
  logic-builder delta in the first place, as a two-line diff that read as innocuous.
- **⚠️ Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back,
  then re-run the suite to prove the restore landed.
- **A discrimination check should predict its own failures before it runs.** Twice now. Reverting
  five fixes at once was expected to redden exactly 7 of 13 rows and leave 6 controls green; it did.
  The `Logic Builder` pass predicted **L1, L5, L6, L7, L8, L9, L11** red and **L2, L3, L4, L10**
  green from a six-part revert, and got exactly that. Stronger than reverting one at a time, because
  the *controls* are the claim — and L2 there ("a node with no blocks stays silent") is the one that
  stops the fix reporting failure on every unconfigured node in every project.
- **`flagOutputDirty` on a signal output sends a value, not a pulse** (`node.ts:647-650`,
  `outputproperty.ts:114-137`). Silent, typechecks, and the port never fires. Worth a repo-wide grep:
  `flagOutputDirty` on any port declared `type: 'signal'`.
- **A test asserting on the sender's own signal log cannot tell a pulse from a value.** Wire the port
  to a receiver with a signal input and count arrivals.
- **A low find rate needs a cause before it is evidence.** Twice now: Cloud Services' dip was sibling
  dilution, Component Utilities' was prior remediation. Neither was exhaustion, and neither was
  distinguishable from it by the number alone.
- ⚠️ **When you write "it is a grep", run the grep in the same breath.** FINDINGS SR-viii was about
  to claim a ten-second query would have caught the script-host class. Running it turned up a
  **fifth** host — `REST`, in Data, the worst of them — that four consecutive passes had missed. A
  rhetorical query is not a query, and the sentence had already been written twice.
- **When a fix's own message says "the identical defect X had already fixed on Y", that sentence is
  a query nobody has run.** Two nodes named in one commit message is the signal that a third exists.
  It happened four times in this phase, one node at a time, over two days.
- **A class named by its exemplars silently inherits their category.** "The script hosts" meant
  CustomCode to four passes, because the first two examples lived there; the fifth had been sitting
  in Data throughout. The defining property was `new Function`, not the folder.
- **Before accepting a stated cost of a change, check whether it is already being paid.** NDA-004 §3
  flagged a reserved-name collision as the price of adding a completion signal to `Logic Builder`.
  The collision was already live and silent against the node's *existing* ports; the new signal is
  simply what made someone look.
- **A well-commented field is not an exercised one.** `__triggerSignal__` was assembled on every
  execution, documented as "for conditional logic", and never passed to the compiled function — the
  parameter list stopped one short. It typechecked. Count the arguments at the call site against the
  parameters at the declaration.
- **"Blocked" is a hypothesis with a cost.** Nine handovers deferred `Logic Builder`; it took under
  an hour and held six defects, more than any other node in its category. The estimate that finally
  scheduled it was "~30 minutes", and the ordering heuristic had no signal at all for the one node
  nobody had read.
- **A sweep aimed at named nodes does not cover the class those nodes belong to.** NDA-004 fixed
  `Expression` and `Function` and never asked "what else hosts user code" — there were four, in
  three packages. Same shape as CS-ii.
- **A live suspicion can be pointed at the wrong component, not merely be wrong.** The Page Inputs
  panel was fine; the *popup inside it* renders a code editor.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher.
  `findNodeWithId` returns the **canvas view**, not the model — read `.model` for `parameters` and
  `dynamicports`. `node.type` is a bound type *object*, not a string. Wrap every eval in an IIFE.
  Never `cdp reload`.
- Run each jest suite **from inside its package**. **Bash cwd persists across calls.** The editor
  suite takes ~6 minutes; run it in the background.

## §4 — the tree still carries other sessions' work. Never commit it.

**`logic-builder*` is no longer on this list.** What remains, none of it Track O:

the whole `BlocklyEditor` directory (committed, but check before touching), `docs/research/`, icon
assets + `scripts/generate-icons.js`, core-ui `Icon`/`Logo`/`PrimaryButton` +
`icon-component/deploy.svg`, `CanvasTabs`, `EditorTopbar`, `main.js`, `ServiceSupervisor.js`,
`nodegx-backend/src/cli.ts`, `dev-docs/reference/TYPE-ESCAPE-HATCHES.md`, the phase-25 screenshots,
phase-18 PROGRESS/README, the untracked `OPS-010-LAUNCH-GUIDANCE.md`, and a dev-tooling set
(`package.json`, `scripts/start.ts`, `scripts/devtools/*`, `.claude/skills/run-editor/SKILL.md`).

Use the dev tooling freely — `npm run dev:debug`, `npm run dev:stop`, `npm run cdp` all work. Just
never commit it.
