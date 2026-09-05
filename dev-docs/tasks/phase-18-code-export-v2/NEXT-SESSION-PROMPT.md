# Next session — §65 `WebSocket` is BUILT and DRIVEN (session 89, 2026-09-05): Tier 3.11 row 2 of 3, picker 116/127 (91.3%). Next = Tier 3.11 row 3 (`Subscribe To Changes`, the LAST scheduled node), then the editor write path drive

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 89 ran every gate sequentially behind a load gate
(`final-gates.sh`: `uptime` load < 8 AND no `jest-worker|vitest` of anyone's) — the load sat at 10 for minutes between
steps because peers were running theirs. Memory: `do-not-pile-cpu-work-on-a-shared-box`, `parallel-worktree-traps`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 123 translated; floor + total held by `--check` |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **116/127 (91.3%)** — Tier 2.8 rows 1–13 built AND driven; **Tier 3.11 rows 1–2 (`Server-Sent Events` §64, `WebSocket` §65) built + driven**; row 3 `Subscribe To Changes` is the ONLY scheduled node left (ceiling 117); the editor write path is UNDRIVEN |
| EXP-012 | 🟢 — the alpha notice reads 116/91% off the ledger; the 0.2.2 release notes match (11 badged) |
| EXP-013 "Not exportable yet" | 🟢 — the badge spec's "scheduled" pin moved from `net.noodl.WebSocket` to `SubscribeToChanges` |

## What session 89 did

1. **§65 `net.noodl.WebSocket`** (Tier 3.11 row 2; ranked by the product surface — the live-chat / agent app): the node
   joined `STREAM_NODES` as its fifth member (`kind: 'websocket'`, `lib: 'websocket'`, data port `message` carried by the
   `send` verb only — `socket.send(message.get())`); `src/emit/websocketLib.ts` → `src/lib/websocket.ts` (≈1,050 lines:
   websocket-connection.ts verbatim — reconnection with equal-jitter backoff, the heartbeat with dead-connection detection,
   the FIFO send queue and its three When Disconnected policies, teardown — plus the node's setters, rebuild policy and
   outcome tokens; `useWebSocket(source, options, on, env)`), generated from a plain source (`websocket-lib-source.ts` +
   `gen-wslib.py` in the s89 scratchpad — **regenerate, never hand-edit the quoted array**). It imports `./errors` ONLY — a
   socket alone does not ship streaming.ts. Fixture `socket-desk` (a WebSocket with a URL and nothing else authored — **Auto
   Connect is the node's DEFAULT, so the page connects at mount**; Connect / Stop / Send; a Text Input written through a
   `message` Variable into Message; On Open / On Close / On Reconnect / Failure → a `status` Variable; six Status/Data
   Texts). Spec `tests/websocket.test.ts` 37 rows. Ledger 115 → 116, 13 pins moved, the two catch-all pins that used
   WebSocket as "a node nothing translates" re-pointed (relation-verbs → `net.noodl.PatternExtractor`, unreported-deferrals →
   an unwired `RunTasks`), EXP-013's pin → `SubscribeToChanges`, PROGRESS + the release notes at 116/91%/11 badged.
2. **Measured first**: the reverted arm (`probe-reverted.log`, HEAD af752b95) — 21 refusals. **The first built emit refused
   the fixture's own shape**: a text input's `onTextChanged` straight into Message reads `input-text`, legal only inside that
   input's own onChange (the exporter's standing rule) — the fixture writes through a Variable like every other; A9 pins it
   (§65.4 #1, owner NONE — a table-wide decision, not this row's).
3. **Gates before the final chain**: pkg tsc 0 · `typecheck-emitted` socket-desk ✓ (run BEFORE the first arm, §64's lesson) ·
   websocket 37/37 · streaming-trio 60 · sse 35 · relation-verbs + unreported-deferrals ✓ · `export-ledger:check` OK 123 ·
   picker `--check` 116 exit 0 · **arms 17/17 KILLED on the first run** (`mut.py`, `mut-summary.txt`, sources md5-identical).
4. **The drive** (`drive65.sh`, `fakews.js` on 8583 using the repo's `ws`, `EXPECTED65.md` written FIRST): T1 the page
   connected at MOUNT with nothing pressed; T2 Send echoed; T3 Stop closed 1000 `Client disconnect`; T4 a Send while closed
   queued (Queue `1`, no server line); T5 Connect flushed the queue AFTER the open on connection 2 and **status read
   `reconnected` — predicted**: `disconnect()` does not dispose, so the same connection's next open is "an open after the
   first" (the runtime does the same); T6 a server 1011 ⇒ `reconnecting`, `reconnecting in 617ms` (jitter inside
   [500, 1000]); T6b the retry opened on connection 3; T7 errs `[]`. Written up as §65.6. Teardown 0 listeners.

## The final gate chain — READ on the final tree

`final-gates.sh` (s89 scratchpad `a220657e-…`), each step behind a load gate: **whole pkg jest 77 files (77 on disk) 2835/2835 exit 0**
(`whole.*`) · **editor tsc 0** (`editor-tsc.*`, exit 0, an empty log — the same shape s88 read) · **exp-012/013 157/157** (`exp0123.*`) ·
**editor `test:ci` 2943 specs, 5 failures = the known floor** (AIX-006 ×4 + SB-017 acceptance 6 "Expected 39 to be 38"; seed 16782,
HEAD b2d68b51 — a peer's commit on top of mine; `test-results.json` fresh at 18:26; `.webpack-cache` cleared first; the enforced gate
exits 1 on the floor, as it did in s88).

## Uncommitted at hand-off

- Nothing of session 89's. The code (`b2a87e68`: the lib, the table, the fixture, the spec, the ledger, 13 pins, the two re-pointed
  catch-all pins, EXP-013's badge spec), the docs (EXP-011 §65, PROGRESS, this file) and the release-notes hunk (staged ALONE via
  `git apply --cached --unidiff-zero rn-mine.patch` — a PEER still holds ~55 uncommitted lines in that file; never a pathspec commit
  there) are all in. MEMORY.md is 24.3k UTF-16 units against a 17,510 budget — it was over before this session; my line was trimmed
  to net-neutral, the rest is a peer's to file.

## 🔴 Do this next

**Tier 3.11 row 3 — `Subscribe To Changes`** (`data/subscribetochanges.ts`, 690 lines; the ledger's exemption: "a live
subscription to one backend class — a `useEffect` around EventSource on GET /realtime plus one POST /realtime/subscriptions,
firing created/updated/deleted with the record"). Read the runtime's `api/backends/realtime/` first — `RealtimeSubscription.ts`,
`SseTransport.ts`, `SseConnectionPool.ts`, `ParseLiveQueryTransport.ts`, `DirectusWebSocketTransport.ts`, `UnavailableTransport.ts`
— a PEER held `RealtimeSubscription.ts` uncommitted in sessions 88 AND 89 (`git status packages/noodl-runtime/src/api/backends/realtime/`
— read the WORKING TREE, not HEAD, and say which you transcribed). It is NOT a streaming-table member: its inputs are a class
name + filters, its outputs are records, and it needs the backend client (EXP-009's `src/api/client.ts` — the session token,
the base URL) — so it is a hook of its own beside the query row (`useSubscribeToChanges(client, collection, options, on)`),
fixture beside `search-desk`/`roster-desk`'s backend shape, a fake `/realtime` SSE + POST server for the drive (fakesse.js's
skeleton + fakebe.js's Parse shapes). **When it lands, the badge spec needs a scheduled node that is not being translated —
or its pin becomes "no scheduled rows remain"**, and the ceiling (117) is reached: the phase's next work is the 10 out-of-scope
rulings, the editor write path, and the residual registers.

Then: the editor write path on one fixture (launch the editor on a COPY, export from Settings, compare bytes to `emitApp`); the
§60.5 mount-write for an authored Variable value (owner EXP-011, drive-confirmed).

🔴 **`typecheck-emitted.test.ts` before the first arm** — the emitted app's tsconfig is stricter than the package's (`Required<>`
the config; `?? null` the seam reads; a non-null cast where the runtime relies on its callers). 🔴 **Every exporter change owes
the editor `tsc` AND `test:ci`, run by YOU, alone; `rm -rf .webpack-cache` first.** 🔴 **`ts-node` on this package needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts` REMOVES
its output directory before writing — copy `node_modules` in AFTER the emit, not before.** 🔴 **A text input's value cannot feed
a hook's data port — write it through a Variable in the fixture (the runtime's own idiom in this exporter).**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §65.5: a text input straight into Message (the table-wide `input-text` rule); a binary frame end to end in a drive; the
  heartbeat against an answering server; `wss://` + a negotiated subprotocol; StrictMode's dev double-mount; a re-render per
  message. §64.5 / §63.5 / §61.5 / §62.5 / §57.5–§59.5 unchanged; §60.5 the `Variable2` mount write (owner EXP-011).

## Instruments

s89 scratchpad `a220657e-7179-4575-a456-17007ea3f847`: `websocket-lib-source.ts` + `gen-wslib.py` (the lib's source and
generator), `emit.ts`, `planprobe.ts`, `drivelib.sh`, `drive65.sh`, `fakews.js`, `EXPECTED65.md`, `probe-reverted.log`,
`probe-built.log`, `mut.py`, `mut-summary.txt`, `mut.log`, `final-gates.sh` + its `*.log/.exit/.start`, `rn-mine.patch`
(the release-notes hunk, staged alone), `socket-desk-out` (the built app; `node_modules` copied from s88's `token-desk-b-out`).

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (77 spec files now);
`grep -a`; absolute paths — **the shell cwd resets between calls**; `with open(...)` for every file write; **`vm_stat` + `ps` +
`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear servers down the moment the
drive is read.**
