# Phase 83 — next session

**Session 7 (2026-09-09) built HLS-006.** 🔴 **Re-derive the board from the task FILES, not from
this table** — phase 77 hid seven unbuilt tasks for two sessions by carrying a status table
forward, and this table is only as honest as the moment it was written. `ls` the directory and
look for `*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

Read [README.md](README.md) first — **§2 carries rulings, not questions.** Do not re-derive §4's
findings; do re-measure any you are about to act on.

## 1. The board

| id | task | state |
|---|---|---|
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-001 | `@nodegx/export` is a package you can install | 🟢 **BUILT, 4/4 ACs** |
| HLS-002 | `nodegx export`, and the proof it is the same export | 🟢 **BUILT, 4/4 ACs** |
| HLS-003 | The graph the CLI exports is the graph the author saw | 🟢 **BUILT, 5/5 ACs** |
| HLS-004 | An export that builds | 🟢 **BUILT, 4/4 ACs** |
| HLS-005 | The report does not say "nothing left over" when something was | 🟢 **BUILT, 4/4 ACs** |
| HLS-006 | `nodegx serve`, on loopback, with a token | 🟢 **BUILT, 2/4 ACs + 2 halves** — [HLS-006-WHAT-WAS-BUILT.md](HLS-006-WHAT-WAS-BUILT.md) |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-009 | Something other than a mouse opens a project | ⬜ never built |
| HLS-010 | The deploy spike | ⬜ never built |
| HLS-013 | 🔴 Cloud functions deploy without a window | ⬜ never built |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**6 of 14 built. 23 acceptance criteria closed, 2 half-closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Three things waiting on Richard, and none is an agent's to do

Raise them once, at the top, then leave them alone. **None blocks the next build.**

1. **Post the HLS-012 replies** (or say he will not). Drafted, measured, cross-linked, and
   @dominikstohl has waited since 2025-04-16 — **a draft is not a reply**. 🔎 They are more
   answerable again: **#24, #23 and now #31 are all fixed**, so a reply can say the export builds,
   that a dropped binding is reported, and that the preview no longer listens on every interface.
2. **Merge [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is
   "merge it first". The exporter this phase publishes a `bin` from does not exist on
   `origin/main` at all.
3. 🔴 **New, and it is a security one.** The installed `/Applications/NodeGX.app` on Richard's
   machine **is listening on `*:8574` and `*:8575` right now**, and `GET http://<lan-ip>:8574/`
   from another machine returns a page containing that editor's live relay token. HLS-006 fixed
   the source; **a source fix is not a shipped fix**, and R1 (which release) is still unruled. Ask
   whether this wants a release ahead of R1's answer.

## 3. The next task to build: **HLS-013**

**Cloud functions deploy without a window.** README §1b: it is *independent of everything on this
board* and it is **the lifecycle's hard blocker** — the only deploy is
`WorkflowDocument.deployFunctions()` (`models/workflow/WorkflowDocument.ts:465`), reached from
exactly two call sites and **both are UI**, while the MCP server already provisions a backend. An
agent can create the backend and cannot put a function on it, so *any app with a backend cannot be
shipped headlessly today*.

🔴 **Re-measure those two call sites before building.** That finding is from session 1 (2026-09-09,
scoping) and has not been touched since. `grep -an` — 🔴 **and mean the `-a`**: this session watched
plain `grep` return **nothing** for `listen(` in a 2,411-line `.ts` file that contained it on line
1304 (register row C61). The listener registry would have shipped one row short and looked complete.

### The alternatives, if you have a reason to prefer one

- **HLS-007 (`nodegx render`)** — the smallest remaining CLI row, and it shares HLS-006's new
  `serve/access.ts` if it serves anything. ⚠️ Check register row **C40** first: `render_report`'s
  disk-writing defect is unowned and HLS-007 was scoped to check whether it lands on the way.
- **HLS-009** — closes #38 and #28 together, and it is the one that closes the agent/human loop.
- **The person halves of HLS-006 AC1 and AC4**, if a second device is to hand. Five minutes, two
  devices, and it is the only thing standing between HLS-006 and 4/4.

## 4. What HLS-006 leaves you, and what it does not

**Leaves you:**

- **One access policy, four consumers.** `packages/nodegx-export/src/serve/access.ts` decides the
  bind address and the token for the editor's web server, the editor's design-tool socket,
  `nodegx serve` and `@noodl/preview`. 🔴 **The editor reaches it through the `@nodegx/export`
  alias that already existed in all three of its resolvers** — tsconfig paths, jest
  moduleNameMapper, `webpack.shared.js` (which the *main*-process build merges, and which has a
  `ts-loader`). No new wiring. That path is worth knowing before anyone writes a second copy of
  anything.
- 🔴 **`tests/hls006-every-listener.test.ts` — a pinned population of every socket in the repo**,
  swept in both directions. **A new listener fails the suite until somebody writes down what it
  binds and why.** Ten rows. Add yours; do not delete the gate.
- **`nodegx serve <folder>`**, exit code 6, SPA fallback, resolved-path containment.
- **46 gates across three suites, with two reverted arms** (a bare `listen(0)` reading `::`; the
  relay double-attach reading 4).
- Suites: `nodegx-export` **94 / 3297**, `noodl-editor` `test:main` **441 / 7314**, `@noodl/preview`
  **14 / 14**. Root `npx tsc --noEmit` exit **0**.

**Does not leave you:**

- 🔴 **C59 — an arbitrary file write on port 8575**, at a path taken from the wire
  (`design-tool-import-server.js`). HLS-006 reduced it from LAN-reachable to loopback-only. **Do
  not read "loopback" as "closed."** Two lines to fix; nobody has driven the plugin protocol.
- 🔴 **C60 — the editor still multicasts its hostname, port and *project name* to the LAN** on every
  project open (`main.js` `broadcastNew()`), advertising a port nothing off-machine can now reach.
  Sharing being off ought to mean it is silent. Read from source; **not driven**.
- 🔴 **A driven share action.** The menu item was written and never clicked — CDP reaches the
  renderer and this is a native menu. The server beneath it is graded; the wiring is not.
- ⚠️ **Anything from a second machine.** Every "remote" measurement went over this machine's own
  LAN address. It proves the socket refuses a non-loopback peer; it says nothing about routing,
  firewalls or NAT.
- ⚠️ **Anything published.** R1 is still unruled and nothing has been pushed to a registry.

## 5. Standing warnings for this phase specifically

- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is. HLS-006's default had to be loopback even though
  that breaks somebody's LAN preview workflow.
- 🔴 **Writing the gate found five defects that reading the change did not — two of them in code
  this task had just written.** The worst (C53) was `getAccessStatus()` returning the *option*
  instead of the socket: the exact shape AC2 exists to reject, written while writing the fix for
  it. **Read the value off the artefact, then ask what you actually read.**
- 🔴 **A green gate can have a hole shaped like the defect** — fourth time this phase. C56 (four
  relays attached to one server) was invisible to a spec that never opened a WebSocket.
- 🔴 **`grep` lies. Use `-a`.** C61, met in the wild this session, mid-enumeration.
- 🔴 **Attribute a running process before believing what it tells you.** This session read `*:8574`
  off a live editor and nearly recorded it as "the fix did not work"; the process was
  `/Applications/NodeGX.app`, Richard's installed build, not the dev launch — which had died on
  the **single-instance lock**, not on the port. 🔎 `NOODL_USER_DATA_DIR` + `NOODLPORT` runs a
  second editor beside his without touching it.
- 🔴 **Do not let HLS-010 become the phase.** It is a spike that ends with a verdict.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C23, C24, C31, C41, C42,
C43, C44, C46–C50, C53–C58 and C61 are CLOSED or recorded**; C51 is a recorded correction. Still
OPEN and owned by `NONE`: **C52** (two `noodl-mcp` browser-drive suites red at HEAD — **not
re-measured for three sessions**, re-measure before inheriting it), **C59**, **C60**, plus the
community rows C31b, C40, C12 and C20 (C20 is R5, awaiting Richard).

🔴 **Nothing in the register is the next session's first job. Build HLS-013.**
