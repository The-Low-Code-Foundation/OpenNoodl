# Defects SYL-003 found — session 12 (2026-09-05)

Building the avatar picker (SYL-003) touched three surfaces outside the lessons, and each one had
something wrong with it. **These are not lesson defects**, which is why they are in their own file
rather than in one of the five per-lesson registers.

Two were caused by this task and fixed inside it — they are written up in
[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md#two-defects-this-task-found-and-fixed) as D-A
(`ModelProxy` had no `label`) and D-B (`.iconpicker-icon` clipped the tiles), and are **closed**.
The rows below are the ones that are still open.

| row | severity | surface | owner | state |
|---|---|---|---|---|
| **K1** | 🔴 high | MCP `delete_component` | ✅ **FIXED 2026-09-06 (s14)** `2a0d29d9` | CLOSED |
| **K2** | ⚠️ medium | `scripts/devtools/cdp.js` | ✅ **FIXED 2026-09-06 (s14)** | CLOSED |

---

## K1 🔴 — `delete_component` unregisters a page from the registry but NOT from the router

**Observed.** `create_component` on `Pages/SvgProbe` reported
`registeredPages: { router: "App", added: ["/Pages/SvgProbe"] }` — it edits the `Router` node's
`pages.routes` for you, which is the documented and helpful behaviour. `delete_component` on the
same path then reported:

```
"removedFiles": [component.json, nodes.json, connections.json],
"registry": "updated"
```

and **left `/Pages/SvgProbe` in the router's `routes` array** in `components/App/nodes.json`. The
component's three files and its registry entry were gone; the route pointing at them was not.

**Why it matters.** The create side owns the router edit, so the delete side has to as well —
otherwise every created-then-deleted page leaves a route aimed at a component that does not exist.
A project accumulates them silently: nothing in the delete result mentions the router, and the
registry says `updated`, so the reasonable reading of that response is that the removal was
complete. It was found here only because the deletion was a probe being cleaned up and the tree was
checked afterwards with `grep -rl`.

⚠️ **The blast radius is unmeasured and should be measured before it is fixed.** What a dangling
route does at runtime — whether the router skips it, renders blank, or throws — was NOT tested; the
route was removed by hand and the project restored. *"It is probably harmless"* is a hypothesis
here, not a finding.

**Repro.** `create_component` a page, `delete_component` it, then
`grep -n '<name>' <project>/components/App/nodes.json`.

**Where.** The MCP server's `delete_component`, which already knows the path is a page — the
create path's `registeredPages` logic is the thing to mirror.

---

## K2 ⚠️ — `cdp network offline` does not survive the CDP client disconnecting

**Observed.** Run as two commands:

```
$ npm run cdp -- network offline
network: offline
$ npm run cdp -- eval "fetch('https://dicebear.com/favicon.ico').then(()=>'REACHED').catch(()=>'BLOCKED')"
REACHED THE NETWORK
```

`network` sets `Network.emulateNetworkConditions` and then calls `client.close()`. The emulation is
scoped to that CDP session, so it is torn down before the next command connects. The same is almost
certainly true of `blockurl`, which closes its client the same way (**not** verified — do not record
that as measured).

**Why it matters.** This is an instrument that reads as armed and is not, on exactly the claim it
exists to support. Any offline test written the obvious way — go offline in one command, measure in
the next — measures the **online** application and passes. SYL-003 AC2 is a
*"prove it with the network actually off"* criterion; taken that way it would have been a false
pass, and the only reason it was not is that a `fetch` control was run first and came back
`REACHED`.

✅ **The way round it**, until this is fixed: do the emulation and the measurement in **one** CDP
session, and read a `fetch` control on both sides of the drive. `scratchpad/offline-in-app.js` in
session 12 is a worked example, and its output is quoted in
[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md#ac2-is-the-one-worth-reading).

**Where.** `scripts/devtools/cdp.js:687` (`network`) and `:707` (`blockurl`). A fix has to keep the
session open — a `--then=<expr>` argument, or a persistent mode — because there is nothing to set
that outlives the connection.


---

## ✅ K1 — FIXED 2026-09-06 (session 14), `2a0d29d9`

**Blast radius measured first, as the row asked.** Lesson 1's solution with `/Pages/Ghost` appended
to the App router's routes, rendered on the harness beside an untouched control: both arms boot and
draw the start page, `consoleErrors: []` on every viewport, `placeholders: 0`; asking the harness for
the ghost route itself is refused by name. So a dangling route is a **silent accumulation**, not a
crash — the kind nobody finds. What a *runtime navigation* to the ghost route does was not measured.

**The fix reuses the editor's decision** — `pagesAfterComponentRemoved` (REL-009b, kept import-free
for exactly a second caller) — through `editor-deps`, applied per route spelling with the same
`isSamePage` tolerance `registerPages` has; a start page naming the deleted component is cleared.
Reported as `unregisteredPages` on the delete result. 4 specs in `tests/pageRegistration.test.ts`,
three red with the call disabled; the control (a non-listed component) stays green.

⚠️ Found on the way: `tools/author.ts` held **six raw NUL bytes** in a template literal, which made
`grep` skip the whole file as binary for everyone (`grep -a` finds it). They are `\u0000` now.

## ✅ K2 — FIXED 2026-09-06 (session 14)

`network` and `blockurl` take `--eval="<expr>"` (measured inside the same session, value printed)
and `--hold=<seconds>` (session kept open so other `cdp.js` commands run against the emulated
state); with neither, a stderr note says the emulation is closing with the command. **Measured
live on `dev:debug`, four arms**: two commands → `REACHED` (the symptom, unchanged, now warned);
`--eval` → `BLOCKED`; `--hold=20` with a separate `eval` inside the window → `BLOCKED`, and
`REACHED` after the hold ended; `network online` resets. The `blockurl` half is the same code
path and was **not** driven separately.
