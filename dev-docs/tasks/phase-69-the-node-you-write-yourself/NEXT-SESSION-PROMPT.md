# Phase 69 — next session

**Written 2026-08-16, session 9.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty. **CN-006's editor half is next, and its ground is already surveyed.**

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** … **CN-005** | ✅ | ✅ | Closed in sessions 4–8 |
| **CN-006** | ⚠️ **HALF** | ✅ for that half | `a5427aa7`. MCP + generator done and proven end-to-end. **The editor command is not built** — §3 |
| CN-006b … CN-017 | 📋 | — | CN-007 is the other half of the authoring arc |

---

## 1. Gate readings

All taken this session at HEAD.

| Gate | Reading |
|---|---|
| `packages/noodl-editor` jest (`test:main`) | ✅ **217 suites / 3369** — unchanged from s7/s8, as expected: no editor source was touched |
| `@noodl/mcp` jest | ✅ **50 suites / 585** — including the provisioning suites, which did **not** flake this run |
| `@noodl/noodl-viewer-react` jest | ✅ **71 suites / 910** |
| `@nodegx/kit-scaffold` jest | ✅ **4 suites / 58** (new) |
| `npx lerna run test --scope @nodegx/kit-scaffold` | ✅ runs — the gate reaches the new package |
| `noodl-mcp` `npx tsc --noEmit` | 🔴 **8 errors, unchanged.** Mine was one of nine briefly; fixed. Still in no CI job |

🔴 **A methodology mistake worth carrying, because it produced a false red.** `test:main` was first
run **in the background beside the 60-second viewer-react suite** and exited 1 with no jest summary
at all — an interrupted process, not a failure. Run sequentially it is exit 0, 217/3369. *A
concurrent run on a shared machine measures the machine.* Do not background one suite beside
another and read the exit code.

⚠️ **`test:packages` and `test:ci` were not run in full.** The editor was not touched and no editor
was launched, so no peer's suite was at risk; the four affected package suites were run individually
instead. ⚠️ **Baselines move. Re-measure; never subtract from this table.**

---

## 2. What this session settled

`@nodegx/kit-scaffold` + `create_node_kit`. Full write-up in
[CN-006](CN-006-SCAFFOLD-A-KIT.md); the four things that will bite someone else:

### 🔴 D8 landed on the one path that was still broken

AIB-001 guarded `var(--token)` on a units-typed port in `input.set` — the path a **set parameter**
takes. A port's declared **`default`** never goes through `set`. It was unit-fitted at definition
time and at instance time, so `default: 'var(--space-3)'` became `var(--space-3)px`: invalid CSS,
dropped by the browser with no error, while the property panel still read back the correct token.

D8 says the scaffold emits token defaults, so the ruling landed squarely on the broken half, and
**this task's own spec records the opposite premise as fact.**

⚠️ **What hid it: a colour port has no units.** The colour arm always worked. A scaffold reviewed by
eye, or a test asserting the *parameter value* rather than the style, reports "tokens working".

Two guards in `react-component-node.ts`, each mutation-proven against its own test, plus a third
mutation (dropping unit-fitting entirely) proving the controls bite rather than decorating.

### 🔴 A kit scaffolded mid-session was invisible to the server that scaffolded it

`installProjectOverlay` is idempotent per directory and runs **once at bind**. `create_node_kit`
writes into the bound project after that, so the tool reported four files written and the agent's
next `get_node_type` said **"Unknown node type"** — with an accurate success payload, because the
kit really was on disk. `refreshProjectOverlay` is now called from the one door that knows the kit
set changed. ✅ D3 is preserved: same process, no poll, no disk cache.

⚠️ **Expect the editor twin.** `ProjectModel.modules` is populated once by `readProjectModules`.
**Measure it, do not assume it** — the MCP side looked fine too.

### ✅ The MCP tool cost **zero** tokens, and CN-009 keeps all 57

| placement | surface | cost |
|---|---|---|
| baseline (re-measured, matches s8) | 8,223 | — |
| **`project` group** | **8,223** | **0** |
| a new `kit` group | 8,249 | 26 |
| resident | 8,464 | **184 over the bar on its own** |

🔴 **What it costs instead, stated rather than argued away:** `project`'s `purpose` line does not
mention kits, and that line is the only description a model reads before choosing a group.
`find_tools`' `query` matches tool **names**, so `query: "kit"` reveals it — asserted, **with a
control asserting that a subject query (`"custom node"`) finds nothing**. That control fails the day
somebody widens the purpose line, which is the point.

✅ The surface test now prints `[surface] N tokens … M under budget` **on a passing run** — its own
header had asked for exactly that in writing, and its absence is how 56 of LEG-001's 58 banked
tokens were spent by work that never knew it was spending them.

### 🔴 AC4 was a false pass, and the copy check caught a real staleness inside a day

- **AC4** ("the generated kit validates clean") passed while `create_node_kit` was **deferred** and
  every call returned *"Tool create_node_kit disabled"*. "The same validator summary before and
  after" is trivially true when nothing happened. It now asserts the kit landed **before** grading
  its effect. *A failure indistinguishable from a missing mechanism measures nothing.*
- **`typesCopyStatus`** answers "is this kit's `.d.ts` the one we publish today" by comparing the
  **body**, not the stamp. It immediately found the cashflow kit's copy **not current** — it
  predated CN-005's own React-collision warning by one session. Refreshed and stamped; that kit
  still reports **0 diagnostics** through the language service.

---

## 3. Starting CN-006's editor half

Nothing is open. This is unbuilt work with its ground surveyed.

- ✅ **The generator is done and shared.** `writeKitScaffold(projectDir, { name })` from
  `@nodegx/kit-scaffold`. Its editor home is `shared/utils/projectmodules.ts`, beside ERG-002's
  `registerLibrary`; the UI home is `ProjectSettingsTab.tsx` beside `LibrariesSection`.
- 🔴 **D1's "writes the scaffold and opens `index.js` in the code editor" cannot mean the in-app
  editor without new work.** The editor's CodeMirror is bound to Function-node **parameters**, not to
  files on disk, and there is no file editor anywhere in the app. The only precedent for reaching a
  file is `shell.showItemInFolder` (3 uses). So the clause resolves to `shell.openPath` or
  `showItemInFolder` — **worth naming out loud rather than picking quietly**, since D1 is a ruling.
- ⚠️ The kits **list** is CN-006b, not this task.
- ⚠️ AC1 and AC3 are the two criteria the editor half closes: *placeable in the picker with no
  further edits*, and *the rendered result actually picks up the token — computed style, not the
  parameter value*. The style layer is asserted; a browser has not been asked.

---

## 4. Owed, and small

- ⚠️ **The cashflow kit's `types/node-kit.d.ts` was rewritten on disk** (refreshed + stamped). That
  kit is not under version control and its annotations are s8's; it reports 0 diagnostics.
- ⚠️ **Still owed from s7, untouched:** re-record
  `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` (needs a viewer
  build and a drive; `kitAgreement.test.ts` is a fossil in place until then), and the packaged
  `dist/noodl-mcp.cjs` still carries CN-004's pre-fix mapping **and now also lacks
  `create_node_kit`**. **18+ peer sessions have a server running out of that path**, so a rebuild was
  again deliberately not done.

---

## 5. Owed by Richard

Unchanged from s7/s8, both still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has exactly one
   production caller, so `validate:project` / `validate_project` check parameter values for **no node
   of any provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it
   when the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `npx tsc --noEmit` is red (8, unchanged, none
   in files touched here) and runs in no CI job; seven of eleven `typecheck:*` scripts run nowhere,
   and `scripts/` is in none of them.

New, and small: **should `project`'s `find_tools` purpose line name kits?** It costs resident tokens
out of the same 57 CN-009 wants, so it is a budget decision rather than a wording one. §2 has the
numbers and `tests/kitTools.test.ts` has the control that will fail when it changes.

Also open, not caused here, both wanting task numbers:
🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
start page's own `urlPath`. 🔴 **The `@noodl/mcp` provisioning flake** (did not reproduce this run —
absence of a flake is not its absence).

---

## 6. Checkout conditions

Several sessions share this checkout. At session start the tree carried three peer paths —
`dev-docs/tasks/phase-50-legibility/notes/leg-001-lane-notes.md`,
`dev-docs/tasks/phase-68-learnbook/README.md`, `scripts/library/check.ts` — plus untracked
`dev-docs/tasks/phase-65-the-library/`. **It carries exactly those four at handover**, byte-for-byte
unchanged, and no peer commit landed during the session.

- ✅ **`git commit -F <file> -- <pathspecs>`, always. Never `git add -A`, never `git stash`.**
- ✅ **No editor was launched** — everything is plain Node, so no drive negotiation was needed and no
  peer's `test:ci` was at risk. `ps` was walked at session start: 19 MCP servers, zero editors, zero
  webpack, zero `test:ci`.
- ⚠️ **`packages/noodl-viewer-react/src/react-component-node.ts` and
  `packages/noodl-mcp/src/{toolGroups.ts,tools/kitTools.ts}` were each edited briefly to
  mutation-prove a guard or measure a placement**, after checking `ps`. Every one was restored and
  verified byte-identical before anything else ran.
- ✅ **The lockfile was updated with `npm install --package-lock-only`** — it does not touch
  `node_modules`, so it cannot land under a sibling's running suite. The diff is **17 lines and
  contains nothing but this package**; read and confirmed.
- Whoever you tell you are starting, tell you have stopped.
