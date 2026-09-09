# HLS-003 — what was built

**Session 4, 2026-09-09.** All five acceptance criteria closed. The exporter now reads the graph
the editor's load produces, says where it did so, and a second enforced scan makes a fourth
headless reader impossible to add silently.

## 1. The two decisions this task took, and why

### 1.1 The exporter settles, rather than refusing

The task file offered three options: the exporter applies the patches; the patches stop being a
load-time rewrite; or the export **refuses** when the two readings differ and names the nodes.

**It settles**, and the reason is what the disagreement turned out to cost.

🔴 **The un-migrated reading does not ship a subtly different app — it refuses work the exporter
could have done.** On the `cheer` fixture with `runOnChange-condition` absent, two `Condition`
nodes report *"Run On Value Change is ticked"*, which the analyser has no rule for, and the export
falls from *translated with nothing left over (9)* to *(7)*: two whole pages and four cascade nodes
refused, over a parameter the author never chose and cannot see on the canvas.

Refusing would therefore have made the export refuse **harder** on exactly the projects the seam
already damages — every shipped prefab among them. And the migration is not a guess: it is
deterministic, idempotent, and is *the definition of the graph the author looked at*. There was
nothing to be uncertain about at the point of refusal.

⚠️ **Nothing is written back to the project.** The settle is applied to the read, not the files. A
reader that repaired a user's project as a side effect of exporting it would be a worse defect than
the one this closes.

### 1.2 One copy of the migration, moved rather than duplicated

`@nodegx/export` cannot reach into `noodl-editor/src` and still be a package anyone can install —
the constraint HLS-001 already hit with the token vocabulary. So the migration **moved** to
`@nodegx/project-contract/run-on-value-change-migration`, with a re-export shim at the old editor
path so all eight existing importers keep working unchanged.

🔴 **Copying it would have been the defect the module documents, committed again.** The whole class
here is two readers each keeping their own answer to "what does a project on disk mean" until they
drift. The module is pure — zero imports — which is what made the move a `git mv`.

## 2. 🔴 The defect was bigger than the task file scoped it

**This was never CLI-specific.** `exportSequence.ts:169` calls `parseProject(projectDir, …)` — the
editor's own **File → Export React** reads the project files from disk, not the patched model the
canvas is built from. So both doors saw the unmigrated graph.

HLS-002 proved the two doors identical byte for byte. That proof is exactly consistent with **both
of them having been confidently wrong in the same way**, which is what the previous handoff warned
would happen and what the measurement found. Registered as **C49**.

The disagreement bites whenever a project has not been opened-and-saved by a current editor: a
shipped prefab, a generated template, anything an agent authored — which is this phase's entire
subject.

## 3. What was measured, with the instrument beside it

Every reading below carries `familyNodes` beside `writes`, because **a zero with no family nodes
found is a broken instrument rather than an absence**.

### 3.1 The corpus that exists

| corpus | projects | writes | familyNodes | signalDriven |
|---|---|---|---|---|
| v1 single-file (`project.json`) — the shipped prefabs users install | 107 | **172** across 22 projects | 799 | 141 |
| v2 decomposed (`nodegx.project.json`) — what the exporter reads | 105 | **11** across 4 projects | 402 | 87 |

The v1 heads are shipped prefabs: **Xano 16, Supabase 15, TOTP 15, Filters 10, OAuth2 9, Stripe 6,
crud-screen 6** — several carrying `Condition`, the type proved live below.

The four v2 projects: `project-examples/lessons/log-a-thing/solution` (a shipped lesson, 4, on a
`DbCollection2`), and the exporter's own fixtures `page-desk` (2) and `variable-dial` (1).

### 3.2 🔴 The consequence, which is not the same as the parameter count

Each of those three v2 projects was exported before and after stating the parameter by hand, and
the emitted code was diffed. **Zero difference in all three** — the exporter branches on a
different subset of governed inputs than those projects exercise.

That absence is worth nothing on its own, so it is reported beside the control that fires:

**Presence control** — the `cheer` fixture, which already states `runOnChange-condition`. Removing
it moves the export from *(9)* to *(7)*, refusing 2 `Condition` nodes and 4 cascade nodes. The
instrument sees this class of difference; the three zeros above are real zeros.

### 3.3 What changed in the corpus golden

**4 of 840 hashes**, all of them report entries — `page-desk` and `variable-dial`, `EXPORT-REPORT.md`
and `@report`. **No `src/` byte moved anywhere.** Predicted from the migration plan before the
golden was touched, and exactly those two projects moved. `cheer` correctly did *not* move: its
parameters are already stated, so nothing is settled.

## 4. The acceptance criteria

| AC | state | where |
|---|---|---|
| 1 — the export behaves the way the canvas behaved | 🟢 **mechanically closed** | `hls003…test.ts` — the `absent` and `false` arms emit byte-identical code; ⚠️ the *person* half is not driven, see §6 |
| 2 — measured on ≥3 real projects, each carrying its control | 🟢 | corpus sweep over the fixture corpus, `familyNodes` asserted non-zero |
| 3 — a presence control with the same instrument | 🟢 | the `true` arm, and the corpus assertion that ≥1 project reads non-zero |
| 4 — a mutant: the mechanism removed, the difference reappears | 🟢 | the `true` arm **is** the pre-HLS-003 exporter; verified by disabling the settle in the product — **5 of 7 tests red** |
| 5 — `def007` fails on a new undeclared headless reader | 🟢 | `GRAPH_READER_SITES` + the second scan; verified with a probe reader, which reddened it |

**The `true` arm is a faithful mutant, not merely a different project.** Reading an absent key
literally *is* reading it as ticked — so that arm is byte-for-byte what this exporter produced
before the settle existed. It doubles as the presence control and grades one more thing neither
would alone: that the settle **fills an absence and never overwrites the author**, because if it
clobbered a stated `true` the arm would collapse into the other two.

## 5. The seam, as it now stands

`GRAPH_READER_SITES` registers **17 files across 6 packages** — every shipped file that opens a
component graph — with a four-way disposition (`applies`, `does-not-apply`, `does-not-interpret`,
`authors`). The scan fails on an unregistered reader **and** on a registered one that vanished.

🔴 **Two readers remain on the wrong side**, asserted by name so that fixing one cannot hide adding
another:

- `packages/noodl-preview/src/loader.ts` — the headless render path. Phase 77 D5 is what this costs.
- `packages/noodl-mcp/src/project/ProjectStore.ts` — **and it must not be fixed the way the
  exporter was.** It reads *and writes*, so a settle there would repair the user's project as a
  side effect of an agent reading it. That is a different decision, not the same one applied again.

Template generation is closed and was already closed before this session — see **C51**.

## 6. What this does not leave you

- ⚠️ **AC1's person sentence is not literally driven.** No project was authored in the editor by
  hand and exported from the CLI with a person looking at the page. What is proved is stronger than
  a source-text assertion and weaker than a drive: the two readings emit identical bytes, and the
  `cheer` measurement shows what the difference costs when it bites.
- 🔴 **The v1 prefab corpus is measured but untouched.** 172 parameters across 22 shipped prefabs.
  A prefab is installed *into* a project, so the disagreement enters user projects that way — and
  nothing in this task changes what a prefab says on disk.
- 🔴 **`noodl-preview` and MCP's `ProjectStore` are still open**, now asserted rather than described.
- ⚠️ **C52** — two `noodl-mcp` browser-drive suites are red at HEAD, unowned, and unrelated to this
  change.
