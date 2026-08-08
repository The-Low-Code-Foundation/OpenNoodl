# Phase 56 — handover after session 3 (2026-08-08)

**What ran:** BEN-002, built and **driven**. Every one of its acceptance criteria is closed with a
measured number, and the drive found **two defects in my own Reset** that the gates could not see —
both of the same shape, and both the shape this phase exists to catch: *a mechanism that is exactly
right and has no consequence*.

Read [HANDOVER-SESSION-2.md](HANDOVER-SESSION-2.md) first. Its B9/B10 findings still govern, and
B10 has grown a third case.

## What is on the branch

| Commit | What |
|---|---|
| `bc82d9fd` | **BEN-002/1** — B2 decided; `sendModelUpdateToClient`, and the rail's rules as a pure module. 21 specs |
| `929617ef` | **BEN-002/2** — the inputs rail, and the empty state that says *why* it is empty. 5 specs |
| (this one) | the two Reset defects the drive found, the register rows, and this file |

## B2 is decided, and the task file had the wrong mechanism

BEN-002 proposed adding a `clientId` to `modelUpdate`'s `content` for the runtime to match, the way
the trace channel does. **No runtime change was needed.** The relay already routes any message
carrying a `target` to that socket alone and only broadcasts the ones without
([relay-server.js:154-163](../../../packages/noodl-editor/src/main/src/relay-server.js#L154-L163)) —
which is how `export` has always reached one sandbox client. `sendModelUpdateToClient` is four lines.

⚠️ Note what a broadcast would have done instead of failing loudly: **the runtime silently ignores a
delta naming a component it does not have.** Option 2 would have *looked* like it worked. The
crossing that does bite is two benches, which share the harness name `/#bench` and node id
`bench-subject`.

**Proven two-sided, live**, with a third relay client — the launch token at
`~/Library/Application Support/NodeGX/relay-token` lets anything register as a `viewer` (OBS-004's
own door):

- typing in the bench → **zero** messages at the spy;
- an ordinary project edit → `modelUpdate | target: (none) | parameterChanged | /Pages/Landing`.

## The two defects, both in Reset

### 1. Deleting a parameter does not put anything back (register B13)

Sending `parameterValue: undefined` is *exactly* the documented unset: the key is dropped by
`JSON.stringify`, `setParameter` deletes it, the runtime takes its reset-to-default branch. That
branch ends at `getDefaultValueForInput(this.model.type, name)` — and the type is a **component**,
whose input ports are declared by a user and carry no default. It queues `undefined` and nothing is
restored.

Measured: after Reset the rail was empty and correct while the component still showed **every** value
that had been set — text, colour, alignment and visibility all unchanged.

### 2. Rebuilding the export is not a remount either

The obvious fix — clear the values, rebuild — is *also* inert, and I shipped it before driving it. A
value set through a targeted update never entered the export, so rebuilding after clearing produces
**identical bytes**, `_exportToClient` drops it, and nothing reaches the runtime. Reset all cleared
the rail and changed nothing on screen, again.

**How it works now:** Reset sends the port's **derived default** where there is one, and reloads the
window (`useSandboxViewer`'s new `remountKey`) where there is not.

⚠️ **The remount branch is unexercised, and that is a finding rather than laziness.** A port wired to
anything inherits that port's type *and its default*, because the editor's `getParameter` falls back
to the port definition — so a defaultless port is one wired to nothing, which also renders nothing to
check. Two fixtures were built trying to reach it. The common path is driven; the fallback is code
with no live case.

## What the drive proved

Every number came out of the running editor.

| Claim | Evidence |
|---|---|
| The rail is generated from the real interface | `BenchProbe` reports **6 inputs, 0 outputs**; all six rows render, and every one derived the right type and control — `string→field, color→select, enum→select, boolean→toggle, number→field, signal→button` |
| An input reaches the component **without a reload** | `(no title)` → `Hello bench`, with a `window` global planted beforehand still holding the same value after. One marker survived a toggle, an enum pick, a colour pick, three pulses and a rejected number |
| A signal fires **and rearms** (B12) | Three clicks, counter `0 → 1 → 2 → 3` |
| An enum reaches the DOM | Picked `center`; the rendered element's computed `text-align` is `center`, its parent's is `start` |
| A colour token resolves | Inline `var(--primary)`, computed `rgb(24, 24, 27)` = the project's `#18181b`. Not a hex, not a deleted property |
| Junk is refused, not sent | `768320px oops` → *"…" is not a number* on the row, nothing at the spy, component unchanged |
| R5 — nothing touches the project | mtimes of all **44** project files before and after: **not one changed** |
| B4, again | `ProductCard` in `ecommerce-example` names all eleven backwards inputs in the rail's empty state. Its usage row is correctly absent — that component has **zero** instances anywhere in the project |

## ⚠️ Traps, for whoever drives next

- **Do not reload a preview webview to instrument it (B14).** `Page.reload` on the app-preview target
  left the editor alive and React mounted but took the *whole preview surface* with it — no
  `[data-preview-mode]`, zero `<webview>`s. POL-012's family. Use the relay-token spy instead.
- **The core-ui `Select` portals *and* double-renders (B10).** Its options are not children of the
  `OptionsContainer` you would inspect — query `[data-test=select-option]` document-wide — and a
  3-option enum returns **6** nodes. Click the second half. An empty `OptionsContainer` is what "the
  select will not open" looks like.
- **Verify which project opened.** `nth-of-type(1)` on a launcher card list matched the *first* card,
  not the one whose name I had found. Tag the element you mean (`setAttribute('data-qa', …)`) and
  click the tag.
- **There is no in-app way back to the launcher** that I found — switching projects means restarting
  the stack, ~3 minutes each time. Budget for it.
- **An MCP write does not reach the running editor**, and the running editor may hold a stale
  project. Stop the stack, write, relaunch. Both fixtures survived that order.

## Gates

- `npm run test:main`: **80 suites, 1085 tests, all passing** — unchanged.
- `npm run test:ci`: **`Jasmine: 2510 specs, 6 failures`** against session 2's `2484 / 6`. **26 new
  specs, all mine, all passing**, and the **same 6 inherited failures** — 4 `AIX-006 style
  vocabulary`, 2 `AI model registry`, neither file in this diff. Compare the count, not the summary.
- `typecheck:editor`, `typecheck:editor-tests`: clean. `eslint` clean on every file touched (the two
  `no-this-alias` errors in `ViewerConnection.ts` are at the same two aliases as at the base commit).

## What to do next, in order

1. **BEN-003**, the outputs read-out, and answer its channel question in writing before any UI, as it
   asks. `BenchProbe` has 0 outputs — a fixture with real ones will be needed, and the same lesson
   applies: the corpus does not contain the thing you want to test.
2. **BEN-005**, then **BEN-007** last and live.
3. **Two loose ends from this session**, neither blocking: the remount branch of Reset has no live
   case (B13), and `SiteHeader`'s six literal `Text` placeholders on the bench (session 2's
   observation) are still unexplained.

The headline is the same as session 2's and worth repeating because it caught me twice in one
session: **the code was right, the gates were green, and the feature did nothing.** Reset deleted the
parameter exactly as designed and the component ignored it; rebuilding the export was byte-identical
and was dropped. Neither is visible from the diff.
