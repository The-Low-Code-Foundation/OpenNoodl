# HLS-009 — what was built

**Session 10, 2026-09-09.** `open_in_editor` over MCP: an agent asks the editor the person already
has open to open a project, and the editor does it.

**4 of 4 acceptance criteria closed.** The two driven ones were driven late in the session, after a
peer freed the box — §6 is the drive, including the reverted arm that makes AC2 mean something.

## 1. The acceptance criteria

| # | criterion | state |
|---|---|---|
| AC1 | (person) With the editor open on the projects screen, ask an agent to create a project. It appears — no click, no restart, no hand-edited file | ✅ **CLOSED — DRIVEN** (§6). 79 → 80 projects, one row |
| AC2 | Opening a project the person already has open does not open it twice, and does not lose unsaved work. Driven, not reasoned about | ✅ **CLOSED — DRIVEN, with a reverted arm** (§6) |
| AC3 | The recent-projects store has one writer after this task, not two. Cardinality | ✅ **CLOSED** — a two-sided gate, and it found a third reference I had missed |
| AC4 | #28's symptom is either fixed or explicitly still open with a reason | ✅ **CLOSED** — fixed, with the reason stated |

## 2. 🔴 What re-measuring §2 corrected — the third session in a row

The handoff said not to trust a task file's §2. Two of its three claims were wrong.

| §2 said | measured |
|---|---|
| no `--project <dir>` | ✅ **right.** `main.js:109` reads argv for `--dev`; `--textconv` and the merge driver are the only others |
| no registered `nodegx://` handler | 🔴 **wrong.** `main.js:241` calls `app.setAsDefaultProtocolClient('nodegx')` and `package.json:54` declares the scheme. The handler is registered and every `nodegx://` URI is then **dropped** — filed as **C71**. The renderer comment §2 quotes is about `Launcher.tsx`'s tab parsing, a third unrelated thing |
| the MCP server never touches the recent-projects store | 🔴 **wrong as written, right in substance.** `list_projects` **reads** it (`scanRecentProjects`), and `listProjects.ts:29` already documents *"Read it, never write it"* with the reason. The correct claim is **never writes** — and that turns AC3 from a thing to build into a thing to **pin** |

That last correction is the one that changed the work: the "one writer" property already held, by an
argument someone had already written down. AC3 became a gate over an existing invariant rather than
a mechanism, which is a much cheaper and much more durable thing to own.

## 3. Which of #38's three doors, and why

#38 offered `--project`, `nodegx://open?path=`, and an MCP tool. **The MCP tool**, and the argument
is not the one the task file gave.

- **`--project`** exists only at launch. The case that matters is an editor the person *already has
  open* — a flag cannot serve it.
- **`nodegx://open?path=`** is further along than §2 thought (C71) and further from shippable than
  it looks: **an OS-registered scheme has no credential.** Any web page the person visits can fire
  `nodegx://open?path=…`, and that is a stranger choosing which directory the editor opens — and
  writes two files into. This repo already refuses that exact string in another context
  (`aiMarkdownLinkPolicy.test.ts:58` rejects `nodegx://open?project=/tmp/evil`).
- **The relay** is loopback-only and token-gated as of HLS-006, and the token is a per-launch secret
  at mode 0600 in the user's own user-data directory. A caller that can read it is already running
  as that user. **HLS-006 is what made this door the cheap one**, which was not visible when the
  phase was scoped.

## 4. What was built

**Editor** — `openProject` is the only inbound relay command not gated on `type === 'viewer'`
(`ViewerConnection.ts`), because it does not come from the preview; the token is the
authorisation and re-checking it in a second place is how a gate acquires a hole.
`ViewerConnection` stays transport and emits; `models/externalProjectOpen/` owns the decision, and
its pure half (`decide.ts`) **imports nothing**, which is what puts four editor states inside a
plain-Node runner. `main-window-focus` IPC raises, restores and shows the window — `focus()` alone
leaves a minimised window minimised, which would report success against a window nobody can see.

**MCP** — `open_in_editor` (`tools/openInEditor.ts`), deferred in the `project` group.

**A project switch goes back through the projects screen**, because `AppRouter.route()` opens with
`if (this._route == args.to) return;` — an editor → editor route is a **silent no-op**, and a switch
done that way would report success and leave the previous project on screen. The supported sequence
is the one a person performs, and `router.tsx` documents having already fixed it, disposal race
included. The pending save is flushed first: that `await` is AC2's "does not lose unsaved work".

### 🔴 The resident-surface budget, measured rather than predicted

C65 left **7 tokens** of headroom and a written *"there should not be a third"* renegotiation. So
resident was never available. Appending to the deferred `project` group costs **0** — the only
resident trace of a deferred group is `find_tools`' `(N tools)`, and *"5 tools"* and *"6 tools"* are
the same length.

```
[surface] 8273 tokens / 20 resident tools — 7 under the 8280 budget
```

**Identical to C65's reading.** The cost was zero, and that is read off the gate, not argued.

⚠️ What it costs, stated: the group's `purpose` does not mention the editor, so a model browsing
purposes will not meet this tool. The keywords are the door, and a test opens it rather than
assuming it.

## 5. AC4 — #28, and why it is closed rather than deferred

[#28] is "a project created through the MCP server never appears in Recent projects". It appears the
moment the editor opens it, through `openProjectFromFolder` — **the same call the "Open project…"
menu item makes**. So the launcher entry was never the missing thing; the missing thing was a way to
ask, and #28 read as a missing entry because there was no door to notice.

The bind result of `create_project` **and** `open_project` now names `open_in_editor` and the
`find_tools` query that reveals it. Said in a per-call payload, not the instructions, because of §4.

## 6. 🔴 The drive, and the arm that makes AC2 mean anything

**Run 2026-09-09 late in the session**, after a peer session tore down the stack it had held all
evening. Editor launched with `npm run dev:debug`, relay on `127.0.0.1:8574`. Driven through the
**MCP client**, not the tool function — the door a model actually has, `find_tools` included
(`packages/noodl-mcp/tests/hls009-drive.ts`, kept as a re-runnable instrument).

⚠️ **This launch used the default user-data directory, so C70's second clause did not bite.** It is
real — the peer's editor an hour earlier had `--user-data-dir=<scratchpad>/userdata` — and the drive
script reads the token off the **running editor's argv** rather than the default path for that
reason. 🔴 Its first run still failed on that parse: `--user-data-dir=(\S+)` truncated
`…/Library/Application Support/NodeGX` at the space and reported `ENOENT` on a path that has never
existed, which reads as *"no token"* rather than as *"bad parse"*.

### AC1 — observed **before**, then read as consequences

| | |
|---|---|
| before | projects screen, `Recent projects`, **79** projects, `HLS-009 Drive` **not** among them. `.mcp.json` and `CLAUDE.md` **deleted from the copy**, so the backfill has work to do |
| the call | `open_in_editor` → `ok: true`, `disposition: "open"`, `projectName: "Reading Shelf"` |
| after — screen | node graph present, `Reading Shelf` on screen, `document.hasFocus() === true` |
| after — launcher | **80** projects, **exactly one** row for the directory, written by the editor |
| after — disk | `.mcp.json` and `CLAUDE.md` **appeared** — the two files the tool's note promises |

🔴 **`ok: true` was read as the tool's report and not as the outcome.** Every row below the call is
a separate reading of the artefact — HLS-013's `res.ok` lesson applied rather than quoted.

### AC2 first half — the second ask does nothing

`disposition: "already-open"`, and the two things that must **not** have happened did not:

- **still exactly one row**, not two;
- **`latestAccessed` byte-identical** (`1788984823926` before and after) — the branch skips
  `touchProject`, so a store rewrite is the fingerprint of a reload, and there was none;
- a `window` marker set before the call **survived**, so the renderer never reloaded.

### AC2 second half — the flush, and 🔴 the reverted arm

**The obvious arm is worthless and it took a control to see it.** `scheduleProjectSave()` debounces
by **one second**. A drive that pays `ts-node`'s startup between the edit and the switch arrives
after the autosave has already written — the file would hold the edit **with the flush deleted**.
Self-healing, invisible to any arm that completes.

**Control first**, so the instrument is known to distinguish: `setMetaData` at T0, then read
`nodegx.project.json` — **absent at +0.3s** (the debounce is real), **present at +2.3s** (the
autosave fires). A control that reads zero at both times would have made everything below
meaningless.

Then the client was **armed before the edit** and released by a trigger file written from inside
the renderer, in the same `eval` as the edit, so the gap is milliseconds and not seconds:

| arm | edit → release | disposition | reported | project A's file |
|---|---|---|---|---|
| **as built** | `…983235` → `…983239` — **4 ms** | `switch`, `leaving: HLS-009 Drive` | `ok: true` | ✅ **edit present** |
| **flush disabled** | `…114226` → `…114229` — **3 ms** | `switch`, `leaving: HLS-009 Drive` | `ok: true` | 🔴 **edit GONE** |

**Same timing, same disposition, same success note. The report cannot see the difference; only the
file can.** That is HLS-010's finding met again in a new place, and it is why `await
flushPendingProjectSave()` now carries the measurement in a comment beside it rather than a claim.

The switch also survived the thing `router.tsx` warns about: after editor → projects → editor the
window showed `Deadline Desk` with `reactMounted: true` and a live graph — no white screen, and both
projects registered exactly once (**81** rows).

### What the drive did **not** cover

- **`--user-data-dir` on a non-default install** (C70's second clause) — real, measured on a peer's
  editor, not exercised here.
- **Two windows on one relay.** Unreachable by design (single-instance lock; a second editor needs
  its own `NOODLPORT` and therefore its own relay), so the fan-out's multi-window branch is
  argued, not driven. The *silent-peer* branch is driven, in the suite.

## 7. Suites

| suite | what it grades |
|---|---|
| `noodl-editor/tests-unit/hls009OpenDisposition.test.ts` (13) | the four dispositions, including the two a person will not reproduce: a vanished directory that is also the open one, and case-folding that must **not** apply on a case-sensitive filesystem |
| `noodl-editor/tests-unit/hls009RecentProjectsCardinality.test.ts` (2) | AC3, two-sided. 🔴 **It failed on its first run and was right to** — it found `noodl-mcp/tests/listProjects.test.ts:130` writing a fixture store, which my own hand grep had excluded by reflex. A grep with the exclusions baked in agrees with itself |
| `noodl-mcp/tests/hls009OpenInEditor.test.ts` (7) | the protocol, against the editor's **real** `relay-server.js`. A stub relay would fan messages the way I believe the real one does and pass whether or not the tool addresses anybody |

**Regression:** `noodl-editor` jest **444 suites / 7342 tests, all green**. `noodl-mcp` **97 of 99
suites green**; the two red are `sbr009ThemeEditorDrive` (2) and `def018-def020-layout-drive` (1) —
**C52 exactly, same suites, same split, unchanged**. `tsc --noEmit` clean for both packages.

## 8. Where the sharp edges are for whoever is next

- 🔴 **C71.** The `nodegx://` scheme is registered and inert. Finishing it owes a **credential**,
  not just a handler.
- 🔴 **C70.** The token is discoverable and the address is not, and the two compose into a wrong
  sentence. It is one write at `listening`, where the editor already knows both.
- ⚠️ **The fan-out is load-bearing.** `nodegx-observe` also registers as `type: 'editor'` — the peer
  type is a label, not a capability — so "the first editor peer" is as likely to be a sidecar as a
  window. The request goes to every `editor` peer; only a window answers. A test pins it.
