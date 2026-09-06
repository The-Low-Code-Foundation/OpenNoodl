# Phase 18 Progress — Code Export v2

**Created:** 2026-07-22 · **Re-scoped:** 2026-08-28 (session 32)
**Objective:** an app built in NodeGX today — picker nodes, MCP-written custom nodes, a deployed
NodeGX backend — exports to a React repo that **builds, runs, and still works**. See
[README.md](./README.md).

## 🔴 The headline number

```
npm run export-ledger:picker
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 117 of 127 placeable nodes export (92.1%)** — 2026-09-05 s90, `export-ledger:picker` exit 0 (was 51 on 2026-08-28, 81 on 2026-09-01 s69, 90 on 2026-09-03 s76, 94 on 2026-09-03 s80, 116 on 2026-09-05 s89). **No `scheduled` row remains: the 10 that do not export are each `deliberately out of scope`.**

**Do not report the corpus number as progress.** `coverage-audit.ts` reads 85.00% (93.38% over
components a route reaches) across ~40 old drive fixtures. It is a **regression detector** and a
good one. Sessions 20–31 used it as a priority oracle and it cost the phase twelve sessions —
README §*What went wrong* has the mechanism.

## Tasks

| ID | Title | Status |
|---|---|---|
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | ✅ **Built and PUBLISHED 2026-09-01** — `@nodegx/core@0.1.0` is on npm (MIT, no deps, React an optional peer), 2.8 KB gzipped against an 8 KB budget, gated. **The export's `npm install` instruction is now true**: `Deadline Desk` exported, installed from the public registry, `tsc -b && vite build` exit 0. ⚠️ The old note here — *"EXP-002 emits zero imports of it, by design"* — is **stale**: [`state.ts`](../../../packages/nodegx-export/src/emit/state.ts) imports `collection`/`store`/`value`/`channel` and [`component.ts:2693`](../../../packages/nodegx-export/src/emit/component.ts#L2693) imports the React hooks, so the dep is earned by real projects (`Deadline Desk` and `Reading Shelf` carry it; `members-area` and `Puppy test 3` do not). 🔴 Four `0.1.1` rows remain — LICENSE file, `repository`, `prepublishOnly`, and a CI gate that installs from the registry |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | 🟡 **In progress, re-aimed.** 51 picker nodes translate. `packages/nodegx-export`: 504 tests, 40/40 corpus projects typecheck. Remaining work moved to EXP-011 |
| [EXP-003](./EXP-003-AI-LOGIC-TRANSLATION.md) | AI logic translation + trace harness | ⚪ Not started. **Reconsider the sizing** — it was scoped against corpus JS-node counts, most of which are in the unplaced prefab kit |
| [EXP-004](./EXP-004-EXPORT-REPORT-UX.md) | Export report & honesty UX | 🟡 **Every scope line an author can reach is built (§19–§22).** `EXPORT-REPORT.md` ships **inside the exported app** (§19); **in-code markers** put a `TODO(export)` on the element at whichever end of a dropped wire renders (§20); the **pre-flight** is exact, not estimated (§21); and the **exported `README.md`** now arrives with **every** export carrying EXP-004's **ordered next steps** — it used to be emitted for one project in seven (§22). 🔴 Left: the **in-editor report**, still **blocked** — `@nodegx/export` has **no consumer anywhere in the product**, so there is no post-export moment to attach it to. Owner **`NONE`**; see §21.1. ⚠️ Also unchecked and **not blocked**: the in-code marker does not carry the original node source, and the **comprehension test needs a person** who did not write the prose |
| [EXP-005](./EXP-005-MULTIFRAMEWORK-PIPELINE.md) | Multi-framework pipeline | ⚪ Not started |
| [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | ⚪ Not started |
| [EXP-007](./EXP-007-EXPORT-PROVENANCE.md) | Export provenance & regeneration safety | ⚪ Not started |
| [EXP-008](./EXP-008-EXPORT-COVERAGE-LEDGER.md) | Coverage ledger & contributor gate | ✅ **Built**, + picker ratchet 2026-08-28. ⚠️ 96 of 101 `deferred` entries share one auto-generated exemption sentence — EXP-011 §4 rewrites them |
| [EXP-009](./EXP-009-BACKEND-CONNECTION.md) | **Exported app talks to its deployed backend** | 🟢 **Built + driven s33; AC4 (`Cloud Function`) built s69 via EXP-011 §41 — typechecked, not driven** |
| [EXP-010](./EXP-010-CUSTOM-NODES-AND-MODULES.md) | **Custom nodes, modules and prefabs export** | 🔴 **Not started.** `parseProject` never opens `noodl_modules` |
| [EXP-012](./EXP-012-THE-EDITOR-EXPORT-COMMAND.md) | **The editor export command** | 🟢 **BUILT + DRIVEN s67 (2026-09-01).** Settings → Project → *Export as React code…*: exact pre-flight modal, folder dialog, inside-project refusal, non-empty confirm, write + toast. Byte-identical to `emit-app.ts`. `@nodegx/export` has its **first product consumer**; EXP-004's §21.1 block is over. Rides 0.2.2 if Richard says so |
| [EXP-011](./EXP-011-PICKER-COVERAGE.md) | **Close the picker gap, ranked by what apps need** | 🟡 **117/127 (92.1%) — s95: §73 the one-liners four registers left (the `Set Variable` Set as table measured enum by enum — Empty string writes `''`, Boolean `!!value` (nothing typed = `false`), Number/Date/Any UNTOUCHED where the gate had refused them, Object/Array refused; a listed payload key nothing wires is `unknown`; the naming pin by type; the ledger's `§` was ALREADY normalised by `1f0e11a9` — closed by measurement); 90 rows, 10/10 arms. s94, FOUR lanes in parallel worktrees, all merged + driven: §70 a `Global Store Set`'s typed-in Value is written on every Set (the fourth sibling; the refusal had dropped the button in front; cheer grows `Make it stormy`; 32 rows, 12/12 arms); §71 an `Object` node's OWN typed-in `prop-*` values are a per-mount write (measured in the runtime first — `modelnode2.ts` writes every `prop-*` setter at creation; the export had dropped them SILENTLY, no note, no refusal; new fixture `notice-desk`; 63 rows, 13/13 arms); §72 a variable with no statically-known source is `unknown`, not `string` (0 fixtures moved; the record family now coerces an `unknown` Id `String(x ?? '')` where the type alone was 3× TS2345 in the built app; 33 rows, 14/14 arms); §66.5 #1 MEASURED in the runtime — an unwritten Variable never reaches a setter (`node.ts sendValue` drops `undefined`), so Enabled boots ON where the export booted OFF; fixed at `has()` in all four stream libs, live-desk wires the shape (10/11 arms, one equivalent). Whole package 79/2990, editor tsc 0, test:ci at the floor. s93 §69: a `Set Variable`'s typed-in `Value` is written on every Do (the third sibling of §67/§68; the literal types the variable; under a wire shadowed; the `setWith` gate in front; an expression stays refused) — §67.5 row 3 / §68.5 row 2 CLOSED; the old refusal had dropped the WHOLE Save chain in front of the Set (the reverted arm emits the Save button with no `onClick`); profile-desk re-authored with the value typed in, output byte-identical; 51 rows, 10/10 arms, driven. The fourth sibling, `Global Store Set`'s typed-in Value, registered §69.5. s92 §68: a `Set Object Properties`' typed-in `prop-<key>` value is written on every Do (one entry in the patch, in list order; the literal types the key; under a wire shadowed; an unlisted key filtered; the acting selectors refuse it as a wire); the §60.5 register's second EXP-011 row CLOSED — profile-desk's `since` drives `2026` on Save where the old export dropped it silently; 43 rows, 11/11 arms. s91 §67: a `Variable`'s authored Value is the runtime's per-mount write (`useEffect(() => note.set('First note'), [])` in the host; the literal types the variable; a wire into Value, a non-primitive parameter refused by name); the §60.5 divergence CLOSED — panel-desk boots `First note` where s88's drive read `''`; 18 rows, 13/13 arms. s90 — §66 `Subscribe To Changes`, Tier 3.11 row 3 and the LAST scheduled node (the tier's ceiling reached; the 10 left are all `deliberately out of scope`): `src/lib/realtime.ts` transcribing the runtime's realtime layer for the built-in backend — RealtimeSubscription (one reconnection funnel, the confirmation deadline, fatal-as-data, the 1s→30s backoff), the NodeGX SSE dialect (GET /realtime with the session token, the hello, POST /realtime/subscriptions read by its body, `change`/`resync`) and the shared connection pool — riding EXP-009's client (`ENDPOINT` now exported); the Class and Enabled as options, the five signals as listeners, every Realtime output a live getter; a project with no backend, a second Backend and an authored Filter refused by name; fixture `live-desk` (the live-feed shape), 41 rows, 21/21 arms killed, driven against a fake /realtime (a dropped stream reconnects with Last-Event-ID, re-registers under the new clientId and delivers the hub's resync — predicted, observed). s89 — 116/127 (91.3%): §65 `WebSocket`, Tier 3.11 row 2: the streaming table's fifth member, `src/lib/websocket.ts` transcribing websocket-connection.ts (reconnection with equal-jitter backoff, the heartbeat, the FIFO send queue and its three policies) and the node's rebuild policy, the three Actions as verbs with Send carrying the Message read at the pulse, the six Events and outcomes as listeners; fixture `socket-desk` (the live-chat shape), 37 rows, 17/17 arms killed, driven against a fake ws server (a manual Stop then Connect fires On Reconnect — predicted, observed); `Subscribe To Changes` is the last scheduled node. s88 — 115/127 (90.6%): §64 `Server-Sent Events`, Tier 3.11 row 1: the streaming table's fourth member, `src/lib/sse.ts` transcribing sse-connection.ts (both transports, the backoff, the dedupe window, Last-Event-ID) with the two Actions as verbs, the Events and outcomes as listeners, every Status/Data output a live getter; fixture `token-desk` (the streaming-LLM shape: Text → a Text Accumulator's Chunk, On Message → Add), 35 rows, driven against a fake event stream; s87 drove §60/§62/§63 and fixed the Drag wrapper's stretch; s86 — four Tier 2.8 rows built in parallel worktrees, all four merged: §61 the component-stack trio (`src/lib/pageStack.ts` transcribes navigation-handler/navigate/navigate-back — a push printed as the runtime's own call with the back channel as its callback, a pop as a two-arm return on a reserved `pageStackEntry` prop, the stack a visual role rendering the top entry only; transitions and `useRoutes` refused by name; fixture `wizard-desk`, 50 rows, 15/15 arms), §60 the component-object trio (own record = local state, the parent pair = React context), §62 the relation pair (the record verbs' api-call with a Pointer on the wire), §63 `Drag` (a wrapper that drags, `useDrag`); §61 the component-stack trio in flight. s85 — §57 `Repeater Item`, §58 the streaming trio, §59 `Hash`/`Random Bytes`/`Screen Resolution` (105). s84 §56 `Filter Records` (98); s83 §55 `Create New Array`; s82 §54 `On App Error`; s81 §53 `Run Tasks`.** Earlier: 94/127 (74.0%) s80 — §52 built `Script` (Tier 2.8 row 2): hosted, not re-hosted — `src/lib/script.ts` transcribes the runtime's three DSL generations and the viewer lifecycle, the author's code goes verbatim into its own `// @ts-nocheck` file under `src/scripts/`, and the page calls `useScript(definition, inputs, listeners)`; refused only what the app cannot supply (`Noodl.`, `Component.`, createComponent, `import()`, Use External File, a port set the editor has not written). s79 — §51 built `Component Children` (Tier 2.8 row 1): the wrapper declares `children?: ReactNode` and renders `{children}` where the marker sits; an instance passes its placed children as JSX children, in order; a target with no marker drops them with a note and an in-file marker, as the runtime never draws them. Measured first: the placed children were dispositioned `static` and silently never emitted.** s77 — §49 built the animation pair, `States` and `Animate To Value` (Tier 3.8): `src/lib/animate.ts` (the scheduler's frame engine, the ease curves, the bezier solver, `useAnimatedValue`) and `src/lib/states.ts` (the whole node as a machine plus `useStates`), graded frame by frame against the interpreter's own files, and the wired style sink (`opacity`/`color`/`backgroundColor` inline) that no wire could reach before**. §48 `CSS Definition` + the CSS Class fold + the `Date` column (90); §47 the named Object (89); §45–§46 the files (88); §41–§44 Cloud Services (81→84). Next (§50's order): `Script`, `Run Tasks`, `On App Error`, … |

## What actually works today

51 picker nodes, built to a standard worth copying — hand-written target output first,
byte-for-byte goldens, mutation checks, a 40/40 corpus typecheck gate:

- **Visual:** Group, Text, Image, Columns (CSS Grid + container queries), Icon, Video, Circle,
  Button, Checkbox, Radio Button (+ Group), Slider, Dropdown, Text Input, Repeater, Page, Router
- **Data:** Query Records, Create/Update/Delete Record, Array, Static Array, Create New Object,
  Insert Object Into Array, Variable, Set Variable, Global Store (+ Set, Subscribe)
- **Logic:** Condition, And, Or, Inverter, Switch, Counter, String Format, Expression, Function,
  Visual Function
- **Structure:** Component Inputs, Component Outputs (callback props), Component Object
- **Flow:** Send/Receive Event, Navigate, Show/Close Popup
- **Auth:** Log In, Log Out, Sign Up, User

## What a gap looks like — and why EXP-004 is promoted

A deferred node is **invisible in the output**. Exported from `Puppy test 3`:

```jsx
<button className={styles.deleteBtn}>Delete Puppy</button>   {/* no onClick — chain deferred */}
<p className={styles.listText} />                            {/* empty — a Function fed it */}
```

No `TODO`, no comment, no marker; grep finds zero. ✅ **This was true through §19 and is closed at
§20.** A dropped wire now marks the element at whichever end of it renders — the sink when it
renders, else the source — so the button above carries a `TODO(export)` naming what it lost.
⚠️ **A refusal between two logic nodes still has no element to sit on**, which is why the report,
not the markers, remains the complete list.

✅ **The other half is closed.** Since §19 the sentences do survive into the artefact:
`EXPORT-REPORT.md` is written into the exported app, and it names itself as the complete list
precisely *because* the markers are not one. **The failure mode is a silently half-working app**,
which is worse than a loud one — it is now a half-working app that comes with a written account of
which half.

## The corpus, and its new job description

`projects.txt` + the 40 fixtures + `build-corpus.ts` (40/40 typecheck) stay. They caught real
defects in sessions 21–31 that no unit test did. **They tell you if you broke something. They do
not tell you what to build.** EXP-011 §2 adds picker-exercising projects built in the 0.2.0 editor
and by the MCP, which is what should be ranked against.

## Session history

Sessions 1–31 are recorded in the target-output docs, principally
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) §1–§21, which is
the phase's working log. §20 is the session-31 measurement that forced this re-scope; §21 marks
its own "what is left" lists void.

**Session 33 (2026-08-28, `b83161c5`) — EXP-009 built and driven.** The exported `Puppy test 3`
lists its real database rows in a headless browser (zero with the backend stopped); auth and
writes round-trip; no master key in the bundle. Design in
[EXP-009-CLIENT-TARGET-OUTPUT.md](./EXP-009-CLIENT-TARGET-OUTPUT.md), drive record in
[EXP-009 §8](./EXP-009-BACKEND-CONNECTION.md). Gates: 519/519 · corpus 40/40 · 85.00% unchanged
· picker ratchet holds 51/127. AC4 (cloud functions) waits on EXP-011's node translation.

**Session 34 (2026-08-28) — EXP-010 built and driven: custom nodes stop being holes.**
`parseProject` had **zero references to `noodl_modules`** — the directory was never opened, so
every node from a project's own kit fell out of the render tree and left the JSX with a gap and no
marker. Route B now ships each kit verbatim behind a one-file shim, with a typed React wrapper per
node type at every call site. `cn027-drive` — a real 25-component site — exports, builds
(`tsc -b && vite build`) and renders **all four** of its custom nodes in a headless browser.
Ports were driven in both directions, each path separately: an `outputProps` signal, an `outputs`
signal fired from `initialize` (the shape a partial reader loses), and a value output landing in a
bound element. A kit that throws, one with no `index.js`, an ES-module build and a plain library
each export the rest of the app and are named once with their own status; a node whose kit did not
load leaves a `TODO(export)` **in the file**. Icon-set stylesheets and their binary fonts now ship
verbatim and are linked, which quietly fixes the bundled Inter font and Lucide set in **24** corpus
projects. AC6 is settled as a decision, not a number, recorded in `coverage-ledger.json`'s
`$customNodesComment`. Details and the five near-misses in
[EXP-010 §7–§9](./EXP-010-CUSTOM-NODES-AND-MODULES.md). Gates: 554/554 · module-inject 31/31 ·
corpus sweep 47/47 emit clean · picker ratchet holds 51/127 · `export-ledger:check` OK.

**Session 35 (2026-08-28) — EXP-011 Tier 1.4 built, driven and gated: the value Variables.**
`String`, `Number`, `Boolean` and `Color` export. They are one runtime definition
(`variablebase.createDefinition`), so they became one translation with a four-row cast table, and
which shape a node takes is decided by its wires rather than its type: nothing wired into `value`
or `Set` folds the read to a literal (String's `Length` folds with it); a wired `value` under Run
On Value Change becomes a `useState` plus a sync effect carrying `setValueTo`'s own table —
`undefined` abstains, `null` stores the `Treat empty as` coercion, otherwise `args.cast`, and
`NaN` is banned as a stored value because `NaN !== NaN` breaks the runtime's `changed` guard
permanently. A wired `Set` is **deliberately** outside the slice and says so in the author's terms:
it commits a *pending* value, which needs an abstain guard and a cast around an expression, and a
state write has room for neither. **Variable Dial** — authored through the MCP server, not by
hand-editing JSON — exports, builds and runs; a headless Chrome typed into it and watched
`Number("cake")` land on `0`, `Number("42")` land on `42`, the Boolean flag mount and unmount, and
the deferred latch stay honestly empty. The near-miss worth reading is
[EXP-011 §6.2](./EXP-011-PICKER-COVERAGE.md): a sync effect is referenced *unconditionally* at
emit, so pushing one where a **speculative** `resolveExpr` had resolved would have emitted a
`useState` and a `useEffect` nothing reads — the dead-`useSession` trap, one construct over.
**AC4 is also done:** all 97 deferred ledger entries now say *deliberately out of scope* (with the
reason) or *scheduled* (with the tier), where 95 said "pre-gate backlog" verbatim, and
`export-ledger:check` now enforces that shape — proved with a control pair before being believed.
Gates: **580/580** · module-inject 31/31 · corpus **41/41** · audit **85.27%** (from 85.00%) ·
picker ratchet **51 → 55 of 127 (43.3%)**.

**Session 36 (2026-08-28) — EXP-011 Tier 1.1 built, driven and gated: the client-side data
vocabulary.** `Object`, `Array Filter`, `Array Map` and `Clear Array` export; the other four of
Tier 1.1's eight defer on named mechanisms, and **three of those are blocked by something that is
not about them**. The shape of the slice is that a list became an ordinary **value expression**:
the collections slice could reach a named array only through a per-consumer field on the repeater,
and there are now three consumers that compose (`books → filter → map → For Each`). `Object` in
"From repeater" mode shipped **exactly as EXP-002-MODEL2-TARGET-OUTPUT §4 designed it** — the
child mints a prop per read, the parent binds `p={item.p}` — with two additions about names: the
prop is deduplicated and the row **field** is not, so both are carried; and minting happens in a
pre-pass, because `resolveExpr` runs speculatively and would declare props for reads that do not
survive. The filter keeps the runtime's **loose** `==`, whose own comment says why, and `Clear
Array` forks on `peek().length > 0` because `done` fires only when the array was not already
empty.

🔴 **The session opened by planning to mint an `id` on every inserted row so `Remove Object From
Array` could translate — and measuring first killed it.** The delete-a-row flow is blocked upstream
by the row-output relay (*"which row fired is not statically expressible"*), so the ids would have
bought nothing and changed a shipped slice's output.

🔴 **Three defects that only building and driving could find.** A `Clear Array` fork emitted
`}; else` — a **SyntaxError** that three `toContain` assertions passed on, because every substring
really was there; `tests/emitted-syntax.test.ts` now parses every emitted file of every fixture,
with a control pair, and the same latent join in `branch` went through the one shared helper. Two
**temporal dead zones** (`collectionReadEligible`, `wiredPorts` read from passes that run earlier)
crashed on the first real project while 626 tests passed, because **no fixture had a `Model2`
node**. And an `Array Map` naming a source property the array lacks emitted `row.nope`, which
**failed `tsc -b`** in the exported app — found by *sabotaging* the driven project, and the same
hole that had already been closed on the repeater side.

**Reading Shelf** — authored through the MCP server — exports with nothing dropped, builds, and
runs: a headless Chrome added two books and watched them come back **sorted** (the one added first
rendered second), added a third to a wishlist and watched the filter **exclude** it, then pressed
Clear twice and watched the `done` and `unchanged` arms answer differently. The wishlist button is
a **negative control** and the map was proved by a **mutant** — without either, both readings would
have been equally consistent with the translation never having been emitted. Also fixed, found by
building against it: `typeOfSource` was never taught about Tier 1.4's value Variables, so a
Variable written by a `String` node had no statically-typed writer and **every read of it dropped**
([EXP-011 §7.5](./EXP-011-PICKER-COVERAGE.md)). Gates: **636/636** · module-inject 31/31 · corpus
**42/42** typecheck · audit **85.45%** on session 35's own 40-project denominator (from 85.27%;
⚠️ that session's "41/41" label and its `4441` denominator described different sets) · picker
ratchet **55 → 59 of 127 (46.5%)**.

**Session 37 (2026-08-28) — EXP-011 Tier 1.2 built, driven and gated: `HTTP Request`.** The
largest node this phase has translated — 1,288 lines, nearly every port dynamic — and it was
tractable because almost all of that is **configuration rather than data**: the method, the body
type, the auth preset and the four string lists are `allowEditOnly`, so the translation reads a
configuration instead of solving one. Each node becomes one function in `src/api/http.ts`, with
authored values folded in and wired ones as parameters.

🔴 **The module throws only where no answer arrived, and returns `ok: false` where one did**, and
that split is the design. `processResponse` runs *before* `doFetch` reports `failure`, so a 404
publishes its body and status while `Failure` fires; a request that never reached the server
leaves `Response` and `Status Code` holding what they held. The record verbs' single throwing
shape reproduces one of those or the other, never both. The failure chain is emitted **twice**,
once per arm, and the copies are identical because both bind `message` first.

🔴 **Where a read is decides what it says.** Inside the node's own chain it is the chain's local;
anywhere else it is the state row. `setQuoteOut(answer)` does not change `quoteOut` inside the
closure that called it, so a state read in the `done` chain would deliver the *previous* request's
body — the chain-local snapshot rule reaching a construct that, unlike a pure Function, cannot
recompute itself.

🔴 **Four things were nearly wrong, and three of them are older than this slice.** A state row
minted from a node labelled "Error" would have been **read as the exception** inside
`catch (error)` — reachable only now that a failure arm carries the graph's own statements
(⚠️ and first "found" in the render locals, where the fix was **inert**: a handler reads a variable
through `.get()`, never through the render local). `collectExprUse` had **no case for the
asynchronous actions at all**, so nothing inside a `done` or `failure` chain earned its state row
or its import — the emitted page read an identifier it never declared, and the record verbs have
the same hole. The answer row is allocated by the *read*, which resolves two passes after the
action compiles, so `materialize` had to move to a verdict sweep — [§6.2](./EXP-011-PICKER-COVERAGE.md)'s
lesson from the other side. And `compileSink` has **no `default`**: an HTTP node reaching it
deferred as *"variable name is not a literal"*, a plausible answer about a different node type.

**Quote Desk** — authored through the MCP server — exports, builds under `tsc -b && vite build`,
and runs against a local server that **echoes what it received**: the quote and author arrive
through two compiled JSONPath accessors, the echo line proves the literal query parameter and
header actually left the app, a 404 fills the status line *and empties the quote* (the answer is
written for any answer), a 400 on the POST runs the failure chain into a Variable, and a later
success leaves the status line unchanged, because the runtime never clears `Error`. The `canceled`
wire — a port only `Cancel` can fire, and `Cancel` is unwired — stays empty throughout. Proved by
a **mutant**: one Output Field pointed at a field no body has and the header emptied, after which
exactly two readings changed.

🔴 **A defect found in the editor, not the export**: `updatePorts` published the pre-ERG-001
`success` port, so the HTTP Request node drew **both `Done` and a `Success` that could never
fire** — the runtime sends `done`. The export drops such a wire with that reason rather than
reproducing the silence. ✅ **Fixed in `httpnode.ts` at §19** (session 48); the export's arm stays,
because a project authored before the fix still has the wire saved.

⚠️ **A gap this slice found and did not close**: a Variable written from an HTTP output types as
`unknown`, and Pass 4 drops every read of a variable with no `string`-typed writer — so
*fetch → Set Variable → show it* exports a blank element. Not about HTTP; it blocks a Function
output in the same words. Gates: **658/658** · module-inject 31/31 · `tsc --noEmit` clean ·
picker ratchet **59 → 60 of 127 (47.2%)**.

## Session 38 — EXP-011 Tier 1.3: the date family, and Tier 1 closes (2026-08-29)

**60 → 66 of 127 (47.2% → 52.0%).** All six date nodes — `Now`, `Date To String`, `Date Add`,
`Date Compare`, `Date Difference`, `Date Parts` — translate. **Tier 1 is complete**, and this is
the only tier item that yielded every node it named. Full write-up: [EXP-011 §9](./EXP-011-PICKER-COVERAGE.md).

The organising split is not the picker's: **`Now` is stateful and the other five are pure**. The
five became one `date-call` expression kind that composes (`Now → Date Add → Date To String` is
one nested call), and `Now` became one action. `src/lib/date.ts` is a transcription of the
interpreter's own `datemath.ts` and `Date To String`'s `_format`, and — unlike `src/api/http.ts` —
it is the same text in every project, so it is a constant that ships only where something imports
it.

🔴 **`Now` is not a live clock, and the runtime said so rather than the export choosing.** Its
ports say the outputs *"hold the instant of the last Read"*, and `initialize` seeds them — which
is `useState<Date>(() => new Date())`, a **lazy** initializer read once per mount. The eager form
constructs on every render. A read inside the Read chain takes the bound local, not the row,
because `setClock` does not update the closure that called it (§8.2's rule, second construct) —
and because two bare `new Date()` calls in one chain can straddle a millisecond.

🔴 **The transcription is tested against the thing it transcribes.** §A of the test suite
transpiles the *emitted* module and runs it against the runtime's own `datemath.ts` over 896
date/amount/unit combinations, every ordered pair for the difference, and 400 consecutive days for
the ISO week — plus `Date To String`'s real `_format`, driven through the node definition's own
setters. **A deliberately broken copy of the emitted module must disagree, and does**; without
that control "they agree" is a reading that fits rather than one that excludes.

🔴 **The second-consumer rule failed twice more.** §7.5 wrote it, §8.7 repeated it, and this slice
still shipped six nodes that translated in `resolveExpr` and rendered nothing: **Pass 4c matches
on a whitelist and Pass 4f on a predicate, and neither errors when a type is missing.** Then
`typeOfSource` had no case either, so *save the clock → show it* exported a placeholder. Pass 4f's
predicate is now derived from the same tables `resolveExpr` dispatches on.

🔴 **Three defects only building and driving could find**: `const` is a statement, so `Now`'s Read
emitted `() => const clockRead = …`, which does not parse — and it survived a suite that parses
every emitted file, because every fixture wired the Read to a button that already had an action
(two actions take the block form; only a Read that is the *whole* handler breaks). Pass 4f dropped
the expression tree's own `consumes` and `collapses`, so the report claimed working wires were
dropped — **the app was right and the report was wrong, which is the worse way round**. And two
silent walkers (`exprTouchesSnap`, `snapExpr`) would have passed a stale chain-local read through:
of the eleven sites enumerating these unions, the compiler holds six.

**The drive.** `tests/fixtures/deadline-desk` — authored through the MCP, one routed page, nothing
dropped. Every expected answer was written down before it ran, and the anchor is 31 January 2024
because adding a month to it has two defensible answers: the page shows **Feb 29**, not Mar 02.
Two control *pairs* carry the measurement — the same two instants compared at `day` and at
`millisecond`, where the second panel must be absent, and the same device over the clock. Both use
`mounted`, not `visible`, because `visible` keeps the element in the DOM with its text intact.
**Sabotaged in three places, exactly three rows moved and eleven held.**

Gates: **704/704** · module-inject 31/31 · `tsc --noEmit` clean · `export-ledger:check` OK ·
picker ratchet **60 → 66 of 127 (52.0%)**.

### Session 48 — the report the markers pointed at, and a port that could never fire

**EXP-011 §19.** Two items from §18's list, neither of them a picker node — the ratchet holds at
**69/127 (54.3%)**.

**`httpnode.ts`'s dead `Success` port is gone** (§8.5's one line). `updatePorts` published the
pre-ERG-001 name while the node fires `done`, so the editor drew an output nothing could send and
a wire from it ran nothing. ⚠️ Deleting the port does not delete the wires a saved project already
has — the export's arm stays, and the editor now raises its existing `con-no-source-port` error,
which is the author-facing half of the same statement. The test asserts the **rule** (every signal
output published must be one the node declares), not the name.

**`EXPORT-REPORT.md` ships inside the exported app** — EXP-004's first half. Grouped from a
structured channel built beside `notes`, never parsed back out of it; leads with what worked;
carries every refusal with the exporter's own reason; and says plainly that nothing has been run,
replayed or compared, because EXP-003 does not exist.

🔴 **Three findings the build produced.** The data-access line was keyed on *"were any api files
emitted"* and told `quote-desk` — which has a working generated `fetch` and no backend — that its
reads answer empty and its writes throw; two predicates, one name, and the wrong one re-derived
beside the right one. Two green checkers had populations that had quietly grown (a backtick sweep
that meant *code* and now saw Markdown; a blast-radius assertion the report legitimately joins).
And the report's own closing paragraph implied every listed refusal leaves a `TODO(export)` marker
— it does not, `puppy-test-3` has none at all, and an overstatement there is the exact failure
this task exists to prevent.

**`scripts/emit-app.ts` dropped `copies`** — every `noodl_modules` asset that travels byte-for-byte
(fonts, icons, kit scripts). The defect `kits.ts` closed, one layer up, green throughout because no
test drives that script. Driven by hand: 17 files, **12 copied assets**, `dots.woff2` md5-identical.

**Twelve mutants, ten killed on the first pass; both survivors closed.** One was a real hole — kit
load failures could vanish from the report and all 910 tests passed — and one was weak and is
recorded as weak. The runner reads jest's summary line and exit code, never a `--json` key, and
byte-compares the tree against a snapshot after every mutant.

Gates: **911/911** · 39 suites · module-inject 31/31 · `tsc --noEmit` clean ·
`export-ledger:check` OK (175 types) · picker ratchet **69/127 (54.3%)** ·
`noodl-runtime` **2564 passed, 13 skipped, 144 suites**.

### Session 53 — the `Error` a node's own chain could not read (EXP-011 §24, 2026-08-29)

**The last unowned increment `External Link` and `Navigate To Path` were carrying since §14.4.** A
read of `Error` from inside either node's own outcome chains deferred, because the setter has been
called but React state does not change inside the closure that called it. `HTTP Request` has always
minted a chain-local for that shape; these two now do too, and **one construct closed both**.

🔴 **"The node's own chains" turned out to be three questions, not one.** The **Failure** arm reads
the `const` it declares. The **Done** arm reads the **state row** — there the previous failure's
message *is* the right answer, because the runtime never clears `_internal.lastError`, and the
`const` is not in scope in that arm anyway. `Navigate To Path`'s **Completed** chain **still
refuses**, and has to: it prints as a join beneath both arms, where the local is out of scope and
the row is still one failure behind. A slice that translated "any read from any of the node's own
chains" would have shipped the §8.2 bug into the one arm nobody was looking at.

🔴 **The most useful finding was about the suite, not the slice.** With every clause that earns an
`Error` row removed, the export emits `lastLinkError.set(helpError)` with **no `useState` above
it** — a component that cannot compile — and **all 1054 tests passed**. `expectParses` parses, and
an undeclared identifier is valid syntax. Two rows now assert the declaration; the general hole
(every emitted-code assertion in this package is a parse, not a typecheck) is recorded as open and
owned by **`NONE`**.

⚠️ **A redundant pair, taken apart rather than argued.** Two clauses earn that row; each survives
being removed alone, and only removing both breaks it. The first attempt at that measurement was
invalid — it left a third clause standing — and the reading fitted without excluding.

**The app was built and driven.** A project authored on the `cheer` fixture reads one `Error` from
all four places at once: the render, the Done arm, and the Failure arm through two sinks.
`tsc -b && vite build` exit 0, 68 modules. Driving it: a real url opens a tab and leaves the error
text empty; the cleared input navigates to **`/mood?msg=No link to open`**, which that message can
only reach if the ternary tested the link and the `const` carried it. Two sabotage arms moved D3
and nothing else — and the second one, the §8.2 bug, loses the message **entirely** in the running
app. 🔴 Three instrument faults preceded that reading and are written up in §24.5: the router's
catch-all erased the url, `i.value =` was swallowed by React's value tracker, and a fixed sleep
raced the rebuilt server so the **control stopped reproducing**, which looked exactly like the
sabotage working.

**Fifteen mutants, thirteen killed**; the two survivors are the redundant pair above. Two were only
killed after the suite was strengthened, and one came back NOT-APPLIED because its search text was
guessed rather than read off the file — corrected, re-run, never counted as a survivor.

Gates: **1054/1054** · 42 suites · `tsc --noEmit` clean · `export-ledger:check` OK (175 types) ·
picker ratchet **69/127 (54.3%)**, correctly unmoved — this is a fidelity increment on two nodes
the picker already counts, not a new type.

**Session 69 (2026-09-01) — EXP-011 §40: the order probe found three defects, two shipping.**
Built no node. §39.7's first item — one graph per family, chain wire first — showed **all six**
chain-owning families (External Link, Now, Unique Id, UUID, HTTP Request, Navigate To Path)
order-dependent; and a node fired only from a **reactive Condition** reported the false note in
*every* order. Behind it: (1) the **earn scan ran before the reactive-Condition and Value-Changed
passes** — an HTTP Request fired from a reactive arm was emitted as `await fetchRequest()` with no
module and no error row (`TS2304`), a Show Popup with no slot, and Now/ids/HTTP were named *"never
fired"* while their code was emitted; (2) a **branch arm holding a statement printed `if (c)
<statement>`** — an External Link's or Navigate To Path's Done chain landed *after* the `if` and
ran unconditionally, an HTTP Request in an arm `await`ed in a non-async arrow. Fixes: an
`OWN_CHAIN_OUTPUTS` table the attach pass skips; the two passes moved **into** the earn block with
their effects scanned; idle sweeps for the link/navigate pair and an idle-chain clause for
Now/ids; hoisted `actionIsStatement`/`blockBody`/`effectBody` (async IIFE) in the emitter. Graded
by `tests/chain-wire-order.test.ts` (28 rows) and eight mutant arms (23/4/6/8/3/3/2/1 kills, one
first-draft arm caught by the runner's tsc gate). Gates: pkg tsc 0 · editor tsc 0 · jest
**1360/1360 in 52** · ledger OK 176 · picker 80 unchanged. Memory filed: *a new producer owes every
consumer of the old one*. Left: typechecked not driven; a record verb in a reactive arm has no row.

**Session 69, second half — EXP-011 §41: `Cloud Function` translates. Picker 80 → 81 (63.8%).**
The first of the nine Cloud Services and EXP-009's AC4. One function per node in
`src/api/functions.ts` — the declared `in-*` ports as parameters (wired ones passed, authored ones
folded), the declared `out-*` ports as a typed results object — through a new `callFunction()` on
the EXP-009 client (`POST /functions/<name>`, app id, session token, `result` envelope, the
runtime's `_makeRequest` line for line) where the project declares a backend, and a stub that
throws the interpreter's own *"No cloud services defined in this project."* where it does not.
Done/Failure are a try/catch's two arms; `Error` is a row never cleared. Six refusals by name.
`tests/cloud-function.test.ts` (20 rows) and the fixture `tests/fixtures/call-desk` — the second
fixture with a backend, chain wires listed before the trigger — exported whole and typechecked;
nine mutant arms (§41.4). Gates: pkg tsc 0 · editor tsc 0 · jest **1396/1396 in 53** · ledger OK
176 (88 translated) · picker **81**, floor raised. ⚠️ Not driven against a live backend.

**Session 78, second half — EXP-013: "Not exportable yet", said where the node is placed. Picker 92, unchanged.**
Richard's ruling (§50) put this before any node. Measured first on a new fixture (`task-desk`: a
button → `Run Tasks` → `Cloud Function` → `Navigate`, and `Run Tasks` → `Set Variable` ← `String`,
read by a `Text` through a `Variable`): the committed exporter wrote seven notes and **none named the
Run Tasks node** — its id sat only inside wire keys, which the unreported-deferral sweep takes as
"reported" — and the five nodes behind it were refused as three different sentences, the `Variable`
and its `Text` binding among them. So the attribution is by graph, not by sentence: `RefusedNode`
rows built from `dispositions` at every plan exit, `causedBy` resolved to the roots through
intermediates; `cascadeOf`/`pathwayVerdict` read once by the pre-flight, the report, the README's
first step and the modal; `src/ledger.ts` reads the coverage ledger for the badge; the editor gets
the badge on the picker card (a dot — words were clipped on the first drive frame), the preview pane,
the property header, and a modal that leads with the verdict and *"1 node … and 5 more"*. Gates:
pkg tsc 0 · jest 62 files 1850 green (+ the 2 rows red on HEAD, fixed) · editor tsc 0 (**was red on
HEAD** — §49's `'defer' in x` narrowings, `isDefer()` now) · tests-unit/exp-013 147/147 · ledger OK ·
picker holds 92 · 6/6 arms killed. Driven on all three surfaces, screenshots in the s78 scratchpad.

**Session 80 (2026-09-03) — EXP-011 §52, Tier 2.8 row 2 `Script` (`Javascript2`), picker 93 → 94.** Read
`javascriptnodeparser.js` and `javascript.ts` and the 15 distinct bodies on disk first: the code runs once and
declares a lifecycle object, and every real body is stateful and browser-coupled — so the Function node's pure
wrapper is the wrong target. Built a host instead: `src/lib/script.ts` (the three DSL generations and the
viewer's lifecycle transcribed), the author's code verbatim in its own `// @ts-nocheck` file under
`src/scripts/`, `useScript(definition, inputs, listeners)` in the page, reads live off the handle, triggers as
one call. Refused only what the app cannot supply. The port set is the one on disk (the MCP writes none for
Script — registered P80 §10). tsc 0 · jest 64 files 1981 · editor tsc 0 · ledger OK (101 translated) · picker 94
floor 94 · 9/9 arms (M8 re-armed after `|| true` was killed by TS2872 alone). Drive: see §52.6.

**Session 79 (2026-09-03) — EXP-011 §51, Tier 2.8 row 1 `Component Children`, picker 92 → 93.** Read from the
runtime first: the marker is not a node (`nodescope.ts:217` sets its parent as the instance's child root),
and `setChildRoot` inserts the instance's placed children into that parent at the marker's index, in order —
React's `children`, rendered where the marker sits. Measured before building on `tests/fixtures/slot-desk`: the
placed children were dispositioned **`static`** and never emitted, no note, *0 refusals* — a vanish no
`dispositions`-based instrument can see. Built: role `slot`, `chooseChildSlot` (the runtime's last-marker /
first-position rule, one pure function read by BOTH sides so the wrapper declares `children` exactly when an
instance passes them), `{children}` at the marker, the instance's children as JSX children, a marker-less
target dropping them with a note and an in-element marker. Gates: pkg tsc 0 · jest 63 files 1889 · editor
tsc 0 · ledger OK (100 translated) · picker 93 floor 93 · 7/7 arms. Driven: the badge gone from the card by
itself, the pre-flight's 1 refusal named, the real write path through the dialog seam, `Panel.tsx` on disk
byte-identical to the golden.

**Session 84 (2026-09-04) — 0.2.2's alpha notice, then EXP-011 §56, Tier 2.8 row 6 `Filter Records`, picker 97 → 98.**
First the sentence the release needed: `exportCoverage()`/`alphaNotice()` read the ledger's floor and a new
`pickerCoverageTotal` (both held by `export-ledger:picker --check`), and the pre-flight modal, the settings section,
the emitted README and the 0.2.2 release notes all say *"Code export is in alpha. 98 of the 127 nodes you can place
export today (77%)… do not ship a production app from it yet"* — one wording, four readers, the gate's own number.
Then the node: Array Filter's twin, so a derived list with Array Filter's gates; the saved filter tree (both
generations) read statically with every connected condition resolved to its wired expression, the schema-bound
operators and the Date/File/Pointer/Relation columns refused by name; the runtime half — the connected-value drop,
the regex lowering, the loose matcher, sort/skip/limit in `scheduleFilter`'s order — transcribed into
`src/lib/filterRecords.ts`. A Query Records' state row became a readable list (`query-get`, typed off the declared
collection, allocated lazily), and a transform's Count a binding. Found and pinned: a read-time query mark kept a dead
fetch when the transform was refused after the read (E1); a text input's live text is not a render-time source, so the
search rides a Variable (E2). Gates: pkg tsc 0 · jest 68 files 2233 · editor tsc 0 · ledger OK 105 · picker 98 floor 98 ·
17/17 arms (two re-cuts recorded). Driven twice: the editor's write path 19/19 byte-identical with the alpha line in
settings and modal; the BUILT app against a mock backend 7/7 rows.

**Session 85 (2026-09-05) — EXP-011 §57 + §58 + §59, Tier 2.8 rows 7–9 in one session, three sub-agents in three
worktrees, picker 98 → 105 (82.7%).** Richard asked for parallel agents; each row ran in its own `make-worktree.sh`
worktree off `042f221c` (branches `p18-row7`, `p18-row8`, `p18-row9`) under a common brief (design note → EXPECTED →
fixture → reverted arm → build → spec with the real tsc → arms → ledger → commit), limited to package-level gates, and the
orchestrator merged the three branches sequentially (`09b6be63`, `149bfc2f`, `a94c8394`), reconciling the floor
(99 → 102 → 105), the six pins, and the additive hunks in `plan.ts` / `component.ts` / `emitApp.ts`. §57 `Repeater
Item` (type id `For Each Actions`): the row's Item Id as a string prop the host binds from `item.id`, Added as a
once-on-mount effect, the exit handshake refused by name — 29 rows, 15/15 arms. §58 the streaming trio: the three
runtime machines transcribed into `src/lib/streaming.ts` as pure cores plus hooks, the runtime's event order pinned
(a bare parse re-appends the retained chunk; Clear resets Flush Count) — 59 rows, 13/13 arms. §59 `Hash`, `Random
Bytes`, `Screen Resolution`: `src/lib/crypto.ts` (tryHash/tryRandomBytes, encoding transcribed, graded against the real
WebCrypto and node's createHash) and `src/lib/screen.ts` (`useScreenResolution`), a `crypto-call` action in UUID's
two-arm shape — 55 rows, 15/15 arms. Merge-found: three specs (and a fourth after the merge) had borrowed
`net.noodl.Hash` as "a node with no rule" — re-pointed to Pattern Extractor; a `x !== undefined && 'defer' in x`
narrowing typed in the package and not in the editor's non-strict tsc (EXP-012's trap, third recurrence) — split.
Gates on the merged tree: pkg tsc 0 · jest 71 files (71 on disk) 2443 · editor tsc 0 · exp-012/013 157/157 · ledger OK
112 translated · picker 105 floor 105 · editor `test:ci` 2943 specs, 4 failures = AIX-006 ×4 by name (the known floor; seed 75372, HEAD a94c8394, fresh `tests/test-results.json`). Driven once: the BUILT `utility-desk` export (npm install against the published core, `tsc -b` + vite 0, headless
Chrome) 6/6 rows against `EXPECTED20-drive.md` — SHA-256 of "" and of "abc" at the known vectors, the Done chain's Variable
following, two distinct 22-char base64url nonces, the viewport off `innerWidth`/`innerHeight`, zero console errors. The BUILT `stream-desk` export likewise 10/10 rows
against `EXPECTED21-drive.md` (the retained-chunk re-parse, the parse-failed line on the channel, the accumulator's split,
the buffer's drop and flush). The BUILT `roster-desk` 2/2 (three rows with their Item Ids, `lastAdded` = the last row's mount,
the relayed Remove). Owed: the editor write path only.
