# Phase 83 — next session

**Session 4 (2026-09-09) built HLS-003.** 🔴 **Re-derive the board from the task FILES, not from
this table** — phase 77 hid seven unbuilt tasks for two sessions by carrying a status table
forward, and this table is only as honest as the moment it was written.

Read [README.md](README.md) first — **§2 carries rulings, not questions.** Do not re-derive §4's
findings; do re-measure any you are about to act on.

## 1. The board

| id | task | state |
|---|---|---|
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-001 | `@nodegx/export` is a package you can install | 🟢 **BUILT, 4/4 ACs** — [HLS-001-WHAT-WAS-BUILT.md](HLS-001-WHAT-WAS-BUILT.md) |
| HLS-002 | `nodegx export`, and the proof it is the same export | 🟢 **BUILT, 4/4 ACs** — [HLS-002-WHAT-WAS-BUILT.md](HLS-002-WHAT-WAS-BUILT.md) |
| HLS-003 | The graph the CLI exports is the graph the author saw | 🟢 **BUILT, 5/5 ACs** — [HLS-003-WHAT-WAS-BUILT.md](HLS-003-WHAT-WAS-BUILT.md) |
| HLS-004 | An export that builds | ⬜ never built |
| HLS-005 | The report does not say "nothing left over" when something was | ⬜ never built |
| HLS-006 | `nodegx serve`, on loopback, with a token | ⬜ never built |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-009 | Something other than a mouse opens a project | ⬜ never built |
| HLS-010 | The deploy spike | ⬜ never built |
| HLS-013 | 🔴 Cloud functions deploy without a window | ⬜ never built |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**3 of 14 built. 13 acceptance criteria closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Two things waiting on Richard, and neither is an agent's to do

Unchanged from sessions 2 and 3. Raise both once, at the top, then leave them alone.

1. **Post the HLS-012 replies** (or say he will not). They are drafted, measured and cross-linked.
   Until then HLS-012 is open — **a draft is not a reply**, and @dominikstohl has waited since
   2025-04-16.
2. **Merge [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is
   "merge it first". The exporter this phase now publishes a `bin` from does not exist on
   `origin/main` at all.

Neither blocks the next build.

## 3. The next task to build: **HLS-004**

**An export that builds.** It is the natural next question and HLS-003 made it a fair one: the
export now translates work it used to refuse, so there is more generated code than there was, and
nothing has ever compiled any of it. C43 is its subject and is already filed — a duplicate
`case 'collection-clear':` in `analyze/plan.ts` at lines 18617 and 18759, the second unreachable,
found by esbuild the moment the package acquired a bundler. **Find out which arm the export
actually takes before deleting the other.**

### The alternatives, if you have a reason to prefer one

- **HLS-013** — independent of everything on this board and the lifecycle's hard blocker. An agent
  can provision a backend over MCP and cannot put a cloud function on it.
- **HLS-005** — the report's "nothing left over" claim; C42 is its subject (an absolute filesystem
  path of the exporting machine written into `EXPORT-REPORT.md`).
- **The person half of HLS-003 AC1 and HLS-002 AC1**, together, in one drive with the `run-editor`
  skill. Both are the same shape — a sentence about a person that is currently proved one inch
  short of literally. HLS-003's would mean authoring a node with its control signal wired and its
  governed input unstated, exporting from the CLI, and opening the page.

## 4. What HLS-003 leaves you, and what it does not

**Leaves you:**

- **The exporter reads the graph the author saw.** `parse/parseProject.ts` settles each component
  with NDA-017's migration as it reads it — in memory, never written back — and the report says
  where it did (*"Where this export did not read your files literally"*, in the claims section,
  deliberately **not** in the attention list, because the settle is provenance and not a task).
- **One copy of the migration**, moved to `@nodegx/project-contract/run-on-value-change-migration`
  with a re-export shim at the old editor path. All eight importers unchanged.
- 🔴 **A second, enforced scan.** `GRAPH_READER_SITES` registers 17 files across 6 packages with a
  four-way disposition, and `def007-project-load-seam.test.ts` fails on a new reader — closing the
  hole that test documented about itself and that this defect lived in.
- **Seven gates** in `nodegx-export/tests/hls003-the-graph-the-author-saw.test.ts`, including a
  mutant arm that is byte-for-byte the pre-HLS-003 exporter.

**Does not leave you:**

- 🔴 **Two readers still on the wrong side**, now asserted by name so fixing one cannot hide adding
  another: `noodl-preview/src/loader.ts`, and `noodl-mcp/src/project/ProjectStore.ts`. ⚠️ **The
  MCP one must not be fixed the way the exporter was** — it reads *and writes*, so a settle there
  would repair a user's project as a side effect of an agent looking at it.
- 🔴 **The v1 prefab corpus, measured and untouched** — 172 parameters across 22 shipped prefabs
  (Xano 16, Supabase 15, TOTP 15, Stripe 6…). A prefab is installed *into* a project, which is how
  the disagreement reaches user projects. Nothing here changed what a prefab says on disk.
- ⚠️ **A drive.** See §3.
- ⚠️ **Anything published.** R1 is still unruled and nothing has been pushed to a registry.
- ⚠️ **A corpus that reaches Logic Builder** — unchanged since HLS-001.

## 5. Standing warnings for this phase specifically

- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- 🔴 **A green repo says nothing about the tarball, or about a job nobody wired up.** Both were
  found by *running* things, not by reading them.
- 🔴 **Measure the artefact, not the task file.** HLS-003's own task file said template generation
  had never had the settle pass and nobody had measured it. It had, days earlier, at 57 parameters
  (C51). Reading it instead of measuring would have spent the session on closed work.
- 🔴 **A count of stored parameters is not a count of consequences.** Three v2 projects disagree
  with the editor and their emitted code does not move at all; one fixture's two parameters move
  two whole pages. Diff the artefact.
- 🔴 **Do not let HLS-010 become the phase.** It is a spike that ends with a verdict.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C41, C44, C46–C50 are
CLOSED**; C51 is a recorded correction. 🔴 **C52 is OPEN and owned by `NONE`** — two `noodl-mcp`
browser-drive suites (`sbr009ThemeEditorDrive`, `def018-def020-layout-drive`, 3 failures) are red
at HEAD, stable across a re-run, and measured not to depend on HLS-003. Nine rows carried in from
the community issues remain, four with the literal owner `NONE` (C31b, C40, C12, C20 — C20 is R5,
awaiting Richard).

🔴 **Nothing in the register is the next session's first job.** C42 and C43 are HLS-005's and
HLS-004's subjects and belong to them. **Build HLS-004.**
