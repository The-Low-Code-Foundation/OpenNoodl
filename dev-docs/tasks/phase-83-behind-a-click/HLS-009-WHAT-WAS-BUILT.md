# HLS-009 — what was built

**Session 10, 2026-09-09.** `open_in_editor` over MCP: an agent asks the editor the person already
has open to open a project, and the editor does it.

**2 of 4 acceptance criteria closed, 2 left undriven** — and §6 says exactly why, and what it costs.

## 1. The acceptance criteria

| # | criterion | state |
|---|---|---|
| AC1 | (person) With the editor open on the projects screen, ask an agent to create a project. It appears — no click, no restart, no hand-edited file | ⬜ **NOT DRIVEN** — see §6 |
| AC2 | Opening a project the person already has open does not open it twice, and does not lose unsaved work. Driven, not reasoned about | 🟡 **HALF** — the decision is graded (13 assertions); the drive is not |
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

## 6. 🔴 What is NOT closed, and the honest reason

**AC1 and AC2's drives were not run, and the reason is not that they are hard.** A peer session held
the box for the whole of this session: its `scripts/start.ts` stack, three webpack builds, an editor
holding `127.0.0.1:8574` and CDP port 9222, working on phase-84's `Columns.tsx`. **Driving would
have opened a project in their window, mid-build.** A second editor is possible (`NOODLPORT` +
`NOODL_REMOTE_DEBUG_PORT` + its own user-data dir) but it is a second heavy job on a shared box.

🔴 **Do not read the 20 green assertions as the drive.** They grade the decision and the protocol.
What no test here has seen is the editor actually routing, the window actually coming forward, and
`.mcp.json`/`CLAUDE.md` actually appearing in the opened project.

### The recipe, so the next session pays minutes and not an hour

1. Confirm the box is free: `ps -eo pid,etime,command | grep -E "start\.ts|webpack"` and
   `lsof -nP -iTCP:8574 -sTCP:LISTEN`.
2. Launch the editor (`/run-editor`). 🔴 **It will use its own `--user-data-dir`, so its relay token
   is NOT at `~/Library/Application Support/NodeGX/relay-token`** — that is **C70**, and the
   default-path token will be a *stale* one that produces "the relay rejected this token".
   Export `NODEGX_RELAY_TOKEN` from the launched editor's user-data dir, and `NOODLPORT` if it is
   not 8574.
3. AC1: with the editor on the projects screen, call `open_in_editor` with a **copy** of a real
   project. Expect `disposition: "open"`, the window forward, the project on screen, and a new row
   in Recent projects. Then check `git status` in the copy for `.mcp.json` and `CLAUDE.md` — the
   tool's note promises them and nothing has watched it keep that promise.
4. AC2: call it **again** with the same directory. Expect `disposition: "already-open"` and, above
   all, **no reload**. Then make an edit, call within the one-second save debounce with a *different*
   project, and confirm the first project's edit reached disk (`disposition: "switch"`).

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
