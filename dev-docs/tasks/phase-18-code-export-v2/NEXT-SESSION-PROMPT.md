# Next session — 81/127 (63.8%): §40 closed the chain-wire defect class and §41 built `Cloud Function`; next by the same rule is the other eight Cloud Services, and the drive nobody has run

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Built, gated, **PUBLISHED 2026-09-01 — `@nodegx/core@0.1.0` on npm**. 4 rows left for `0.1.1`. ⚠️ The peer's uncommitted EXP-001 + README rows (22:29) are **still uncommitted** — theirs |
| EXP-002 deterministic generators | 🟡 in progress, re-aimed at the picker |
| EXP-003 AI logic translation | not started |
| EXP-004 report & honesty UX | 🟡 built and driven; drill-down panel + three lines that need Richard remain |
| EXP-005 / 006 / 007 | not started |
| EXP-008 coverage ledger + gate | ✅ Built — `export-ledger:check` OK, 176 types |
| EXP-009 backend connection | 🟢 built + driven; **AC4 built s69 (§41) — the client gained `callFunction()`; typechecked, NOT driven** |
| EXP-010 custom nodes & modules | 🟢 Route B built + driven |
| EXP-011 picker coverage | 🟡 **81/127 (63.8%)** — Tier 1, 2.5, 2.7 complete; §38–§39 the small non-pure nodes; **§40 (s69) fixed three defects under every translated node with a chain; §41 (s69) built `Cloud Function`, the first of the nine Cloud Services** |
| EXP-012 the editor export command | 🟢 built + driven s67, rides 0.2.2 |

## 🔴 What session 69 did — §40, then §41

### §41 — `Cloud Function` (`CloudFunction2`) translates. Picker 80 → 81.
One function per node in **`src/api/functions.ts`**: the declared `in-*` ports as parameters
(wired ones passed as `params.x`, authored ones folded into the body), the declared `out-*` ports
as a typed results object (`any` per port — they are `*`). **Connected**, it calls a new
**`callFunction(name, params)` on the EXP-009 client** — `POST /functions/<name>`, app id, session
token, JSON body, 200/201 carries `result`, anything else throws the backend's `error` or the
runtime's own sentence (`cloudfunction2.ts`'s `_makeRequest`, line for line; the client golden was
regenerated and the diff was exactly that block). **Unconnected**, the stub throws *"No cloud
services defined in this project."* — the interpreter's own Failure. In the component: an `async`
handler, `try { const answer = await callX({…}); [setXOut(answer)]; …done } catch (error) {
const message = …; setXError(message); …failure }` — HTTP's shape one node over (`cloud-call`
action, `cloud-out` expression, `cloudChainScope`, rows minted on first read, earned by attach).
Six refusals by name (wired `Function`; no function name; consumed `Completed`; an unknown
output; two wires into one parameter; a result read from the Failure chain). Graded by
`tests/cloud-function.test.ts` (20 rows: module, component, refusals, the §40 class rows for this
node, the fixture) and **`tests/fixtures/call-desk`** — the second fixture with a backend, chain
wires listed first — exported whole and typechecked; nine mutant arms (§41.4).

### §40 — the chain-wire defect class

Took §39.7's first item, *the order-dependence probe*, as one loop over six families, and the
false note turned out to be the visible end of **three defects, two of them in shipping code**:

1. **All six chain-owning families were wire-order dependent** (External Link, Now, Unique Id,
   UUID, HTTP Request, Navigate To Path) — and a node fired **only from a reactive Condition**
   reported the false "dropped" note in *every* order. Fix: an `OWN_CHAIN_OUTPUTS` table the
   attach pass skips (replaces s68's three `continue`s), plus idle sweeps so a node nothing fires
   is *named* (five of six were not, and an idle `Now` was disposed `collapsed` with nothing
   emitted).
2. 🔴 **The earn scan ran before the reactive-Condition and Value-Changed passes existed.** An
   HTTP Request fired from a reactive arm was emitted as `await fetchRequest()` with **no module
   and no error row** (`TS2304` ×3), a Show Popup with no slot, and Now/ids/HTTP were named
   *"never fired"* while their code was emitted. Fix: the two passes moved **into** the earn
   block, their effects scanned. No sweep moved.
3. 🔴 **A branch arm holding a statement printed `if (c) <statement>`** — an External Link's or
   Navigate To Path's Done chain landed *after* the `if` and **ran unconditionally**; an HTTP
   Request in an arm `await`ed inside a non-async arrow; `useEffect` callbacks cannot be async.
   Fix: hoisted `actionIsStatement`/`actionTakesNoTerminator`, shared `blockBody`, `effectBody`
   with an async IIFE, `actionsAwait` at depth. Expression arms keep the one-line goldens.

Graded by `tests/chain-wire-order.test.ts` — 28 rows in five groups — and **eight mutant arms**
(23/4/6/8/3/3/2/1 kills; one first-draft arm broke `tsc` and the runner's gate caught it). Full
write-up: EXP-011 §40. Memory filed: *a new producer owes every consumer of the old one*.

## 🔴 Read this before planning anything

0. 🔴 **`Cloud Function` is typechecked, NOT driven.** Nobody has called a real backend function
   from an exported app. The honest drive: start a local `nodegx-backend` with a project that
   declares `publishPage` (the corpus has three: `SBR-015 AC1 Refusal`, `SBR-004 AC1AC2 Drive`,
   `DEF-015 Card Drive`), export `call-desk` against its endpoint/appId, `vite build`, click
   Publish, read `published`/`pageId`/`Error`. Two known divergences to write down before
   driving: (a) a function that answers **no result** leaves the interpreter's previous results
   untouched, while the export sets the row to `{}`; (b) the runtime sends `x-noodl-cloud-version`
   when `deployVersion` is set — the client does not (the record verbs do not either).
1. 🔴 **Typechecked, not driven.** §40's shapes are graded by `typecheckEmittedApp` and parse. The
   honest drive is a fixture whose reactive Condition fires an HTTP Request — needs a stub server.
2. ⚠️ **A record verb (`api-call`) in a reactive arm inherits the earn fix and has no row** —
   `cheer` has no backend; the row belongs on `puppy-test-3`.
3. 🔴 **Before adding a second producer of anything, `grep` the consumers of the first** and put
   the new one where all of them run after it. That is what §40.2 cost.
4. 🔴 **The exporter is compiled twice** — run `tsc -p packages/noodl-editor/tsconfig.json
   --noEmit` after any exporter edit. Exit 0 s69.
5. ⚠️ A peer ran `jest tests-unit` (another package) during s69's mutant runs — no flake seen,
   but check `ps` before a suite.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1396/1396, 53 suites, 53 files on disk
cd ../noodl-editor && ../../node_modules/.bin/tsc -p tsconfig.json --noEmit   # exit 0
npm run export-ledger:picker                  # from the repo root — 81/127 (63.8%), floor 81
npm run export-ledger:check                   # OK — 176 types, 88 translated
```

## Do this next — in the order they are worth doing

### 1. The `Cloud Function` drive (item 0 above) — before building on it
Cheap if a local backend is up; it is the only thing that can find what the typecheck cannot.

### 2. The other eight Cloud Services — re-measure each against the EXP-009 client
`Record` (a `DbModel2` read/write by id — the record verbs' client calls exist), `Set User
Properties` (`PUT /users/me`?), `Sign In With` (provider auth — likely refused by name), `Request
Magic Link`, `Subscribe To Changes` (realtime — refuse by name, EXP-009 §9), `Upload File` /
`Cloud File` / `Sign File URL` (the `/files` wire). `compileCloudCall` + `functionsModule` are now
the precedent for "a client call with a typed answer". Count the toll first: `grep -n "'cloud-call'"`
lists the ten sites a new action kind owes in this package.

### 3. The controlled-state gap §38.3 found — a checkbox or slider writing a Variable
### 4. `Component Children` · 5. the animation pair (`States`, `Animate To Value`)
### 6. Carried, unstarted: the row-owned write (§34), EXP-004's drill-down panel, `Unique Id`'s
`Completed` (§37.4), §35.6's 36, §34.5, §33.3, §31.1 #2, the three EXP-004 lines for Richard,
§40.5's drive + the record-verb row.

## 🔴 What session 69 would tell you if it could only say three things

0. **A probe's console output carries jest's four display spaces.** Two rows in two suites were
   written with the wrong column from a probe's printout; the real column is the file's. Read the
   emitted file, not the log.
1. **Measure the class, not the member.** One loop over six families cost less than one hand-built
   row and found that the fix already made could never have been sufficient.
2. **A false note can hide a true one.** The dropped-wire note carried the node's id, and the
   unreported-deferral sweep took that as the node having been named.
3. **Typecheck the emitted app in every probe.** `fetchRequest()` with nothing declaring it reads
   as a `toContain` pass and a `TS2304` fail. The probe that found §40.2 was the one that typechecked.

## Instruments

s69 scratchpad `fd7c0048-…/scratchpad`: **`mut.py`** (§40 arms A–G + `restore` from
`snap-src-post/`), **`runmut.sh`** (tsc-gated loop, summary in `mut-summary.txt`), `runE.sh`;
**`mut41.py`** (§41 arms A–I, `restore` from `snap41-post/`), **`runmut41.sh`**
(`mut41-summary.txt`); `snap-src-pre/`, `snap-src-post/`, `snap41-pre/`, `snap41-post/`,
`jest-final.log`, `jest-41.log`, `arm-*-jest.log`, `arm41-*-jest.log`, `editor-tsc*.log`,
`client.new.ts` (the regenerated client golden). The
two probe specs (`zz-order-probe`, `zz-branch-probe`) were deleted before commit; their rows live
on in `tests/chain-wire-order.test.ts`.

s68 `db5d35cd-…` — `mut.py`, `harness/` (tick-desk emitted + built), `drive.mjs`, `EXPECTED.md`.
s66 `cae86ff3-…` — `harness/`, `corpus-harness/`. s62 `898de7ef-…` — the from-disk sweeps.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** — `grep -a`.

## The thirteen fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | a delete button in a list row (§30) |
| `relay-desk` | three wires an author drew wrong (§31, §32) |
| `deadline-desk` | all six date nodes, `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter → Map → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; **the only fixture with a backend** (`cloudservices`, `__cloud__/`) |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |
| `ticket-desk` | `Substring`, `String Mapper`, `Number Remapper` |
| `badge-desk` | the id pair, both Done chains, `UUID`'s `Error` |
| `mood-desk` | `Boolean To String` + `Color Blend` (§38) |
| `tick-desk` | `Delay`, `Log`, `Value Changed`, chain wires listed BEFORE their triggers (§39.3) |
| `call-desk` | **`Cloud Function`** (`publishPage`: a wired and an authored param, both results read, `Error` read, Done/Failure chains) with a backend declared; chain wires first (§41) |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a `Navigate To
Path`, an untyped store key, a wire into a port that already carries an authored value, a refused
script on a non-Function node, a `dynamicports` entry on a repeater (§33.3), a child authored inside
a component instance (§34.5), a deferred node with no wires (§35.5), a Delay driven from a reactive
Condition, **a reactive Condition firing an HTTP Request, a `Cloud Function` fired from a reactive
Condition, or any of the other eight Cloud Services**.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files; a *new* test
file is untracked and `git commit <pathspec>` **errors** on it — `git add` it and commit in the
same command. ✅ s69 did exactly this.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** — and
**reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 53 files, 53 suites.
⚠️ **A new fixture directory is picked up by two on-disk sweeps** (`emitted-syntax`,
`typecheck-emitted`) — the suite count grew by 36 rows for 20 written; that is why.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. 🔴 **`git log -5
-- <path>` and read the working tree before any P18 doc write** — the peer's EXP-001/README rows
were still uncommitted at the end of s69 and were NOT swept (pathspec commits).
⚠️ **`test:ci` was not run and was not needed** — nothing outside `packages/nodegx-export` and
`dev-docs/` was touched.

⚠️ **A bare `<<'EOF'` heredoc after a python `- <<'PYEOF'` block does NOT feed python's stdin** —
zsh prints it, and the file is written without the appended text. Write the text to a scratch
file first, then `cat >>`. (Cost s69 one re-do; the status line had changed and §40 had not.)
⚠️ **The shell's cwd is reset between calls and parallel `cd`s race** — absolute paths.
🔴 **A glob stored in a shell variable does not expand in zsh** (`${=VAR}` does).
🔴 **`cmd | head; echo $?` reads `head`'s exit code.** ⚠️ **`timeout` and `uniq -w` are not on this
machine.** ⚠️ **`sleep N` chained before another command is blocked** — background and poll.

## Mutating to prove a checker's reach

1. `cp -a src <scratchpad>/snap-src-pre/` first, and a **second** snapshot after the fix.
2. Mutate by asserting the anchor's uniqueness before replacing it.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** ✅ s69's
   `runmut.sh` gates on `tsc` first and reported arm E's first draft as *"tsc FAILED — not a kill"*.
   ⚠️ `false && x` is such a mutant: TS narrows what the guard protected.
4. Run **both** the new rows and the neighbours — s69 ran ten suites per arm — and name the killed
   rows with `--verbose`.
5. ✅ **A survivor is a finding, not a failure.**

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — v2 projects only.
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — it takes
  the **app**; use it on any row asserting emitted text, because **a `toContain` passes on dead
  code** (§24.3) **and on a call into nothing** (§40.2).
- Harness: `cp -a` a prepared harness, `rm -rf src dist tsconfig.tsbuildinfo`, emit into it.
- ⚠️ **A test-built node needs its parent's `children` array, not just a `parent`.**
- Serve with `npx vite preview --port 53xx --strictPort`; stop by port with `-sTCP:LISTEN`.
  `vite preview` binds `localhost`. 🔴 **Poll for readiness, never sleep.**
- 🔴 Click with `Input.dispatchMouseEvent`; a React input needs the native value setter + `input`.
- 🔴 **Write the expected answers down before the app runs**, then sabotage in separate arms.
- ⚠️ An error row is never cleared on `External Link`/`Navigate To Path`; `UUID` clears on success.

## Driving the editor, if the next question needs it

- 🔴 **Open a COPY, and rename its `name` field.** 🔴 `route({to:'editor', project})` does NOT
  swap an already-open project — reload between projects.
- ✅ `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then `__req('./src/…')`.
