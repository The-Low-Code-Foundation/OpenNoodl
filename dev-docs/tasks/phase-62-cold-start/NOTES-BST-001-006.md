# BST-001 + BST-006 — built 2026-08-11

**What shipped:** a `noodl-mcp` that starts with no project directory and advertises four tools that
need no project, a briefing written for the agent that meets it, and `list_projects` so that agent
finds the app the user already has instead of building a second one.

Everything is in `packages/noodl-mcp`. **No editor file was touched**, so nothing in `test:ci`'s
scope changed.

## Gates

| Gate | Before | After |
|------|--------|-------|
| `cd packages/noodl-mcp && npx jest` | 1 failed / 366 passed of 367 | **1 failed / 405 passed of 406** |
| `npx tsc --noEmit` (src) | clean | **clean** |
| `npx tsc --noEmit` (tests) | 7 errors | 7 errors — **the same seven**, pre-existing |

The one failure is **F65** in both runs: `tools.test.ts` DEBT-009's 30,000-byte `get_node_type`
summary cap, at 30,365. Unchanged by this work and still open for Richard (§4 of the phase-62
handover). **+39 specs, zero regressions.**

⚠️ The seven `tests/` typecheck errors (`interfaceGate`, `stagingDiagnostics`,
`connectionPresentation`) are pre-existing and were confirmed so by stashing the `src/` changes and
re-running. They are not this task's and were not fixed here.

Also driven against the **real built binary** (`npm run build`, then a stdio client), not only in
jest: the banner, `initialize`, `tools/list`, `list_projects`, `find_tools`, `list_examples` and
`get_example` were all exercised through `dist/noodl-mcp.cjs`.

## The shape

- **`src/project/ProjectBinding.ts`** — the store, or the reason there isn't one. `require()` throws
  the one refusal; `peek()` is the non-throwing read for the banner and the suite. Registration is
  unconditional in both modes and the binding is passed where the store used to be.
- **`src/instructions.ts`** — both briefings, one module. The bound one moved out of `server.ts`
  verbatim, every explanatory comment with its paragraph.
- **`src/tools/listProjects.ts`** — reads the launcher's `electron-store` file, merges the product-name
  directories, verifies each entry, marks legacy, never writes.
- **`BOOTSTRAP_TOOLS`** in `toolGroups.ts`, applied as one more policy in `ToolDisclosure.applyPolicy`.

## 🔴 §2's trap, and the proof it is guarded

BST-001 §2 named the defect this task was most likely to ship: sixteen `register*Tools` functions
took `store` and closed over it, so a binding **resolved where the store was resolved** captures the
unbound state forever — tools register, and every one refuses.

It has exactly one observable consequence: a registration-time `require()` makes an unbound server
**throw during construction**. `tests/projectBinding.test.ts` is built on that, and it was **proved
red** rather than assumed: hoisting `const store = binding.require()` to the top of
`registerValidateTools` fails 2 of its 7 specs; restoring passes all 7. A guard that has never been
seen red is decoration.

The compiler did the enumeration, which is the method worth reusing: rename the parameter, then fix
what `tsc` names. It found 54 call sites across ten files and could not miss one.

## 🔴 Two judgement calls, both deliberate, neither smuggled

### 1. `find_tools` is a fifth advertised tool, against one acceptance line

BST-001's acceptance says `tools/list` answers with **"exactly the four bootstrap tools"**. Its §3
spends a paragraph designing what `find_tools` does *while unbound* — "it should report the bootstrap
set and say plainly that the rest arrive with a project". **Both cannot be true.**

This build takes §3. An absent `find_tools` answers a model that has met this server before with
*"unknown tool"* — a dead end that names no fix. A present one answers with the two exits. It carries
a mode-specific description (the bound one ends "one call away", which is a lie here) and returns
`groups: []` rather than a list of groups marked `advertised: false`, because that shape reads as
"ask again for one of these" — the exact turn the mode exists to save.

`tools/list` is therefore **five names**. Argued in full in `toolGroups.ts` above `BOOTSTRAP_TOOLS`,
and asserted in `tests/bootstrap.test.ts`.

### 2. `ProjectBinding.bind()` was **not** written

§1's sketch includes `bind(dir): ProjectStore  // BST-002`. It is not in this build. A `bind()` with
no caller would bind the store and leave the surface at four tools and the briefing at the bootstrap
text — a half-mechanism a future session could call and be misled by. The class header records where
it goes and why this shape makes it a one-object change, which is the property §2 wanted. **BST-002
adds it, with the disclosure half in the same commit.**

## ⚠️ What BST-002 must come back and change

Three places, and the third is the one that will be missed:

1. `ProjectBinding` — add `bind()`, and the disclosure reveal that goes with it.
2. `BOOTSTRAP_INSTRUCTIONS`' last sentence currently says *"the project is written to disk, and this
   server stays unbound"*. That is true today and BST-002 makes it false.
   **`tests/instructions.test.ts` asserts that sentence on purpose**, so BST-002 cannot land without
   meeting it. The rule it encodes: 🔴 **don't promise a bind this build does not perform** — an agent
   told the tools are coming stops and waits for tools that never arrive, which looks like a hang
   rather than an instruction.
3. `find_tools`' description is chosen **at registration** from the mode. A server that binds
   mid-session leaves a stale bootstrap description advertised; the SDK's `RegisteredTool.update()`
   is the mechanism, and BST-002 owns calling it.

## 🔴 The one acceptance line that was NOT run

BST-006's last acceptance is a **live model check**, not a spec:

> a fresh agent with only the unbound server connected, asked *"what can you do with NodeGX?"*,
> answers from these instructions — and asked *"open my app"*, calls `list_projects` rather than
> `create_project`. §2's ordering claim is testable and should be tested; if the model still reaches
> for `create_project` first, the copy is wrong and the copy is the deliverable.

**It has not been run.** What is asserted instead is the *mechanism*: `list_projects` is named
before `create_project` in the briefing, in `find_tools`' refusal, and in the tool description
itself. ⚠️ **That is not the same claim.** The acceptance is about what a model does; the specs are
about what the text says. Ordering is a *mitigation* for F30, and whether it works is a measurement
nobody has taken.

Running it needs two things that are decisions, not work:

- **`scripts/devtools/mcp-model-driver.js` requires `--project`** and spawns the server with it. It
  needs a no-project mode before it can drive this server at all — small, but it is a change to the
  rig the phase-55 baselines were measured with, so it wants doing carefully.
- **A drive costs money.** Left for Richard rather than spent unasked.

Until then: BST-006 is *built*, and its ordering claim is *unmeasured*. Do not read the green suite
as the acceptance passing — this is the same shape as phase 58's green cost row beside three failing
criteria.

## Register

| # | Finding | State |
|---|---|---|
| F70 | 🔴 **The README said the opposite of what now ships.** *"this server authors inside a project that already exists; it will not make you one"* — the one sentence a person reads before configuring a client. Found only because the tool tables were being checked for `list_projects`; nothing in the suite reads prose. **A structural change to what a server can do has a documentation half, and no gate covers it** | ✅ fixed — README now documents bootstrap mode, and `create_project` finally appears in the tool tables at all (it never did, since AIX-012) |
| F71 | ⚠️ **24 of the 30 projects on this machine are legacy.** `list_projects` against the real store: 6 v2, 24 legacy, 5 recorded directories gone. Verified on disk — `sig007-check`, `lib21-qa` and `nodegx-qa-fixture` really are monolithic `project.json`. **Marking rather than dropping them was the right call by a wide margin**: dropping would have answered "you have 6 projects" to a user with 30, and the omission reads as "you have never built anything" — the answer that produces a duplicate | 🟠 informational; the *design* is validated, the corpus is Richard's to migrate |
| F72 | ⚠️ **`--all-tools` had to be refused in bootstrap mode.** The flag exists for a client that ignores `list_changed`, and there is nothing to change into — so honouring it would advertise 89 project tools on a server with no project, which is this mode's entire failure delivered in one flag. Asserted in `bootstrap.test.ts` | ✅ handled |
| F73 | ⚠️ **The bound briefing is now pinned to a byte** against fixtures captured from the pre-move build (`tests/fixtures/boundInstructions.*.txt`, three modes). Every paragraph in it answers a measured phase-55 failure, and the replays that produced those numbers were run against that exact text; a "tidying" reword would invalidate them with nothing noticing. The fixtures are a record of a moment, not a spec — a deliberate change edits them in the same commit and the diff is the review | ✅ built |
| F74 | ⚠️ **`list_projects` must never return `thumbURI`.** Every row in the launcher's store carries a base64 PNG; a dozen is roughly a megabyte of tokens for a picture nothing in the loop can look at. Asserted, because the obvious implementation is to pass the row through | ✅ guarded |

## What is left of the phase

BST-002, 003, 004, 005 are untouched. The suggested order in [TASKS.md](TASKS.md) still holds, and
**BST-004 before BST-003** still matters — it decides the string BST-003 emits, and that string must
carry `--allow-writes` or it produces a server that starts, advertises and cannot act. The CLI now
refuses that combination out loud, so the failure is at least visible where somebody can read it.
