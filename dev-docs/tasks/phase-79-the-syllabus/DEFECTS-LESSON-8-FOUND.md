# Defects building spine lesson 8 found

**Opened 2026-09-06 while building [SYL-011](SYL-011-LESSON-8-SNACKS.md).** Every row is a finding
about the *product or the lesson tooling*, not about lesson 8 — lesson 8 works around each one and
ships. Rows carry an **owner or `NONE`**; `NONE` means nobody is doing this and it will be
rediscovered at full price by whoever writes lesson 9 — which, being the first lesson with records,
will hit L1 again the moment it adds a component of its own.

⚠️ None of these blocked an acceptance criterion, so none was fixed here. The standing rule is build
the tasks, not farm the defects.

| # | severity | owner | one line |
|---|---|---|---|
| L1 | 🔴 high | ✅ **FIXED 2026-09-06 (s14)** `0b603a23` | `derive_starter` cannot subtract a **component** — a lesson whose learner creates one ships a starter the chain gate rejects, unless finished by hand |
| L2 | ⚠️ medium | `NONE` | the catalog's `category` is not the picker's category, so an author following `get_node_type` writes the wrong chrome into `detail` |
| L3 | ⚠️ medium | ✅ **FIXED 2026-09-06 (s14)** `ce4ee49a` — ⚠️ **re-diagnosed: it was never `dist/`** | `create_lesson` on the bound MCP server cannot find the render harness from `dist/`, and refuses with F4 unchecked |
| L4 | low | ✅ **FIXED 2026-09-06 (s14)** `67f67990` | the runner's *"Looking for…"* line prints a raw port name for `hasParams` (`csv set on “Pantry”`) |

---

## L1 🔴 — `derive_starter` leaves an empty component behind

**Observed.** With every node in `/Snack` graded (`hasType` ×4, `hasPort` ×2), `derive_starter`
wrote `components/Snack/nodes.json` as `{ "nodes": [], "visualRoots": [] }`, kept `component.json`,
and kept the registry entry. `npm run lessons:chain` then read the starter as adding *"a component
the learner never built"* — which is correct: an empty `/Snack` is not lesson 7's app.

**Why it matters.** The brief's own rule is *derive, do not write, the starter*. The first lesson
that asks a learner to create a component breaks that rule silently: the derivation succeeds, F1–F4
pass (F2 replays conditions and finds them unmet either way), and only the chain gate objects — and
only because SYL-002 built it. A lesson outside the spine, with no chain gate, would ship a starter
containing an empty, oddly-named component the learner is then told to create.

**Where.** `lessonstarter.ts` (`deriveLessonStarter`) models nodes, connections and metadata; a
component whose nodes were all subtracted should itself be dropped from `components`, and
`starterWriter.ts` should not copy its directory. The registry (D4) is the same family.

**Repro.** Any manifest with a `hasType` condition on every node of a component; derive; `ls
<starter>/components`.

## L2 ⚠️ — the catalog category and the picker category are two vocabularies

**Observed.** `get_node_type` reports `Static Data → category: Data` and `For Each → category:
Visual`. The picker files both under **Read & Write Data** (Static Array as *Read & Write Data ·
Array*). Its full category list is *UI Elements / Navigation & Popups / Logic & Utilities /
Component Utilities / Read & Write Data / Logic / Project components* — none of which is `Data` or
`Visual`.

**Why it matters.** The brief tells an author to use `get_node_type` rather than memory. An author
who does, and writes *"under **Data** in the picker"* into a `detail`, has written a sentence a
learner cannot follow. It happened here in two sentences and was caught only by driving. The same
two-vocabulary trap the brief documents for display names exists for categories, and the brief does
not mention it.

**Where.** Either the catalog gains a `pickerCategory`, or `get_node_type` reports the picker's
grouping beside `category`, or the brief says outright that `category` is not the picker's word.

## L3 ⚠️ — the bound MCP server cannot locate the render harness from `dist/`

**Observed.** `create_lesson` on `nodegx-puppy-test-3` returned F4 *not-checked* — *"The render
harness could not be located … From a source checkout, run this server from the checkout or set
NODEGX_RENDER_CLI"* — and refused to write. The server's cwd is the checkout root
(`lsof -d cwd`), and `resolveRenderCli` probes `<dist>/../../../scripts/devtools/measure-from-disk.js`,
which exists. Running `writeLessonBundle` from source with `NODEGX_RENDER_CLI` set answered F4 in one
run. SYL-004 hit the same wall in session 3 and went round it by *"running it from the server bound
to a source checkout"*.

**Why it matters.** This is the second lesson to lose a round trip to it, and the refusal's advice
(*set the variable*) cannot be followed for a server somebody else started. It is not measured
whether the bundle's `__dirname` resolves where `render.ts` assumes, or whether the probed list
would have shown a different path — the `probed` array is not surfaced in the tool result.

**Where.** `packages/noodl-mcp/src/render.ts` `resolveRenderCli`; surface `probed` in the F4 note.

## L4 low — `hasParams` prose shows a port name

**Observed.** The negative arm's refusal reads *"Looking for a Static Array called “Pantry” on Home
and csv set on “Pantry”"*. `csv` is the port name; the panel says **CSV**. D2 fixed the type name in
this sentence; the port name in the `hasParams` branch was not covered.

**Where.** `describeCondition` in the runner — resolve the port's `displayName` as D2 did for the type.


---

## ✅ L1 — FIXED 2026-09-06 (session 14), `0b603a23`

`deriveLessonStarter` now ends with a pass over every component whose nodes were all subtracted.
**The reference decides it**: if nothing left in the draft refers to the component — no node whose
`type` is it, no parameter naming it (a Repeater's `template`), no router listing it — the
component is **dropped** and reported as a new retraction kind `remove-component`, and
`starterWriter` removes its directory and registry entry after the copy. If something still refers
to it, it is **kept empty** and the retraction names the reference, because *"build the Home page"*
(the router still lists it) is a lesson and wants exactly that starter — the existing spec
`leaves no dangling reference behind when it removes a subtree` already asserted it.

**Measured on the subject.** Deriving lesson 8's starter from its shipped solution and manifest now
produces `App` and `Pages/Home` `nodes.json`/`connections.json` **byte-equal** to the hand-finished
starter, no `Snack` directory, and a registry that matches it. The retraction lands against
step 6, the step that removed `/Snack`'s last node.

Specs: `tests-unit/syl-l1/lessonstarter-components.test.ts` (10; 6 red with the drop disabled) and
three in `noodl-mcp/tests/starterWriter.test.ts` (all 3 red on the reverted arm).

## ✅ L3 — FIXED 2026-09-06 (session 14), `ce4ee49a` — and the row's diagnosis was wrong

🔴 **The bound server was not `dist/`.** Calling `render_report` on `nodegx-puppy-test-3` returned
the refusal *with its `probed` list*, and the list began `/Applications/NodeGX.app/…` — it is the
**installed 0.2.0 app's sidecar**, registered in `~/.claude.json` by Connect as
`node …/Contents/Resources/noodl-mcp/noodl-mcp.cjs`. BST-004's decision 8 prefers `node <path>`
whenever the machine has Node. And `app.asar` **does** list `render-harness/measure-from-disk.js`
(asar listing: 9 entries). **Plain Node's `fs` cannot see into an asar**, so `existsSync` answered
false for a file that was there — exactly the caveat `render.ts`'s own comment carried — and every
`render_report` and every F4 on the install most people have refused with *"could not be located"*.

Both halves measured: `ELECTRON_RUN_AS_NODE=1 …/MacOS/NodeGX …/app.asar/render-harness/measure-from-disk.js`
renders a lesson project (full report, no error); `node` on the same entry cannot load the module.

**The fix** (`render.ts`): `resolveRenderCli` reads the asar's own directory (16 bytes of framing,
then the JSON header — no `asar` package) and, when the harness is in there and this process is not
Electron, spawns it with the app binary found beside it under `ELECTRON_RUN_AS_NODE=1`. The refusal
now names the plain-node case when no binary is found, and the **F4 note carries `probed`**, which
was the half of this row that was right. **Proved end to end**: the rebuilt bundle, run with plain
`node` from a synthetic app layout over the real 0.2.0 asar and binary, answers `render_report` with
*"Rendered, and the render is clean"*; the installed 0.2.0 bundle refuses. 7 specs on a hand-built
asar fixture (`noodl-mcp/tests/renderCli.test.ts`).

⚠️ **Still open, not this row's:** Connect's *preferred* registration form (`node`) and an
asar-only harness contradict each other on every packaged install, and the fix above makes the
sidecar cope rather than changing the registration. The installed app on this machine keeps the
old bundle until the next release; the three running checkout servers keep their old `dist/` until
restarted.

## ✅ L4 — FIXED 2026-09-06 (session 14), `67f67990`

`describeStepCheck` joins each `hasParams`/`paramsEqual`/`connection` port to the step's own
sibling `hasType` on that path and asks an injected `PortLabelResolver`; the view supplies the node
library's port `displayName`, the authority the panel reads. Lesson 8 step 2 now reads *"CSV set
on “Pantry”"* and step 4's wire *"(Items → Items)"*. No sibling, no resolver, or a runtime-minted
port: the name is shown as written. 5 specs in `tests-unit/fix-025`, with the no-resolver control.
