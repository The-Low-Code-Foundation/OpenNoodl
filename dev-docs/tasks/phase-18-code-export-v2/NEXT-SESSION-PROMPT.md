# Next session — §64 `Server-Sent Events` is BUILT and DRIVEN (session 88, 2026-09-05): Tier 3.11 row 1 of 3, picker 115/127 (90.6%). Next = Tier 3.11 rows 2–3 (`WebSocket`, `Subscribe To Changes`), then the editor write path drive

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Five Claude sessions were live in session 88; a peer's four-worker jest ran beside
this session's whole-package suite once because the load gate only looked at `uptime` — gate on `pgrep -f 'jest-worker|vitest'`
as well. Memory: `do-not-pile-cpu-work-on-a-shared-box`, `parallel-worktree-traps`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 122 translated; floor + total held by `--check` |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **115/127 (90.6%)** — Tier 2.8 rows 1–13 built AND driven (§60/§62/§63 this session, §61 s87, §57–59 s85); **Tier 3.11 row 1 `Server-Sent Events` built + driven (§64)**; rows 2–3 (`WebSocket`, `Subscribe To Changes`) are the only scheduled nodes left (ceiling 117); the editor write path is UNDRIVEN |
| EXP-012 | 🟢 — the alpha notice reads 115/91% off the ledger; the 0.2.2 release notes match (`a805a8c2`) |
| EXP-013 "Not exportable yet" | 🟢 — the badge spec's "scheduled" pin moved from `net.noodl.SSE` to `net.noodl.WebSocket` |

## What session 88 did

1. **The three drives session 86 owed** (`EXPECTED-60-62-63.md` first, every row graded; write-ups §60.6 / §62.6 / §63.6, commit `f23368a1`):
   panel-desk clean except the REGISTERED boot divergence (`note` reads `''` where the runtime seeds `First note` — §60.5, owner
   EXP-011, fix shape = a mount write in the host, per mount); link-desk 1 GET + 3 PUT exactly against a 30-line fake backend, the
   AddRelation / RemoveRelation Pointer bodies verbatim, the stale Error beside a later success being both worlds' behaviour;
   **board-desk: the Drag wrapper, an unstyled div in a column flex board, STRETCHED to 320 px around the 80 px card, so
   react-draggable's parent bound collapsed to one value and pinned x at −24 where the runtime lands at 50** — predicted by reading,
   confirmed by arm a, **fixed `3631c624`** (`width`/`height: fit-content` on the handle's style, drag.test F3), arm b read 50.
2. **§64 `net.noodl.SSE`** (Tier 3.11 row 1; 0 corpus uses — ranked by the product surface, the streaming-LLM app): the node joined
   `STREAM_NODES` as its fourth member (`kind: 'sse'`, `data?` optional, `lib` + `sourceFile` on the spec, `streamTypeOfKind`);
   `src/emit/sseLib.ts` → `src/lib/sse.ts` (≈1,250 lines: sse-connection.ts's two transports, backoff, dedupe window, Last-Event-ID;
   stream-parsers' SSE half; the node's methods; `useServerSentEvents(source, options, on, env)`), generated from a plain source
   (`sse-lib-source.ts` + `gen-sselib.py` in the s88 scratchpad — **regenerate, never hand-edit the quoted array**); component.ts groups
   hook imports by module; emitApp ships sse.ts and lets it earn streaming.ts + errors.ts. Fixture `token-desk` (SSE Text → a Text
   Accumulator's Chunk, On Message → Add; Connect / Stop; four Status texts). Spec `tests/sse.test.ts` 35 rows (a scripted fetch, a
   scripted EventSource and the runtime's own timer seam through the hook's 4th argument). Ledger 114 → 115, 12 pins moved, EXP-013's
   pin moved to WebSocket, PROGRESS + release notes at 115/91%.
3. **Gates on the s88 tree (before the final chain)**: pkg tsc 0 · sse 35/35 · streaming-trio 60/60 · typecheck-emitted 41/41
   (token-desk under the real tsc) · drag 52/52 · `export-ledger:check` OK 122 · picker `--check` 115 exit 0 · **arms 14/16 KILLED**,
   M15 EQUIVALENT (the setter's number coercion is re-guarded by `backoffDelay` — the runtime carries the same redundancy), M5 survived ⇒
   E6 gained the Auto-Connect-while-live row, **re-armed: KILLED (1 row)** — 15/16 killed, 1 equivalent. Earlier on the drag-fix tree:
   whole pkg jest 75/75 files 2725 · editor tsc 0 · exp-012/013 157/157.
4. **The drive** (`drive64.sh`, `fakesse.js` on 8582, `EXPECTED64.md` first): idle at boot with no request; Connect ⇒ an OPTIONS
   pre-flight (`Cache-Control` is not CORS-safelisted) then ONE GET with `Accept: text/event-stream` + `Cache-Control: no-store`; four
   tokens accumulated to `Hello, world!`; a clean end ⇒ `closed`, no reconnect; Stop when closed changes nothing; a fresh Connect ⇒ a
   fresh GET with no Last-Event-ID. Written up as §64.6.

## The final gate chain — READ on the final tree (commits `d11407c6` + `dcbea2e1` + `a805a8c2`)

`final-gates.sh` (s88 scratchpad `3407594e-…`), each step behind a load gate: **whole pkg jest 76 files (76 on disk) 2778/2778 exit 0**
(`whole2.*`; it started beside a peer's four-worker jest and still read clean) · **editor tsc 0** (`editor-tsc2.*`) · **exp-012/013
157/157** (`exp0123b.*`) · **editor `test:ci` 2943 specs, 5 failures = the known floor** (AIX-006 ×4 + SB-017 acceptance 6 "Expected 39
to be 38"; seed 88918, HEAD 9346e392 — a peer's commit on top of mine; `test-results.json` fresh at 15:58; `.webpack-cache` cleared
first).

## Uncommitted at hand-off

- Nothing of session 88's. The code (`d11407c6`), the docs (`dcbea2e1`) and the release-notes hunk (`a805a8c2` — staged alone with
  `git apply --cached --unidiff-zero` because a PEER holds 55 uncommitted lines in that file; never commit it by pathspec) are all in.

## 🔴 Do this next

**Tier 3.11 row 2 — `net.noodl.WebSocket`** (`agent/websocket.ts`, 861 lines; the ledger's exemption: "WebSocket in a hook with reconnect").
Same shape as §64: read the node's ports off the catalog, transcribe the connection machine, join `STREAM_NODES` (check whether it has a
data port — a Send verb probably carries one, which the table already supports), fixture `socket-desk`, spec with a scripted WebSocket
through an `env` seam, ≥8 arms, the ledger, move EXP-013's pin to `SubscribeToChanges`. **Then row 3 `Subscribe To Changes`**
(`data/subscribetochanges.ts`, 690 lines; EventSource on `/realtime` + one POST — read the runtime's `realtime/` transports, which a PEER
was editing uncommitted in session 88: `git status packages/noodl-runtime/src/api/backends/realtime/`). When both land, the badge spec
needs a scheduled node that is not being translated — or its pin becomes "no scheduled rows remain".

Then: the editor write path on one fixture (launch the editor on a COPY, export from Settings, compare bytes to `emitApp`); the §60.5
mount-write for an authored Variable value (owner EXP-011, drive-confirmed).

🔴 **`typecheck-emitted.test.ts` before the first arm** — the emitted app's tsconfig is stricter than the package's (`'x' in o ? o.x : …`
types `| undefined` there). 🔴 **Every exporter change owes the editor `tsc` AND `test:ci`, run by YOU, alone; `rm -rf .webpack-cache`
first.** 🔴 **`ts-node` on this package needs `-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.**
🔴 **The cascade sentence behind a refused TABLE member is `logic node (…)`, not the attach pass's — pin the observed.**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §64.5: an authored `Headers` object literal (no fixture); a POST body not driven; StrictMode's dev double-mount reopens once; a re-render
  per token. §63.5: the wrapper still relates a `flex-grow`/`align-self` child to itself (the stretch case is fixed). §60.5: the
  `Variable2` mount write (owner EXP-011). §61.5 / §62.5 / §57.5–§59.5 unchanged.

## Instruments

s88 scratchpad `3407594e-3307-473a-8213-e5fa30bd5815`: `drivelib.sh`, `drive60/62/63/63b/64.sh`, `fakebe.js`, `fakesse.js`, `emit.ts`,
`EXPECTED-60-62-63.md`, `EXPECTED64.md`, `probe-reverted.log`, `probe-built.log`, `sse-lib-source.ts`, `gen-sselib.py`, `mut.py`,
`mut-summary.txt`, `mut.log`, `final-gates.sh` + its `*.log/.exit/.start`, `editor-gates.sh` (the pre-stitch run), the `*-out` built apps.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (76 spec files now); `grep -a`;
absolute paths — **the shell cwd resets between calls**; `with open(...)` for every file write; **`vm_stat` + `ps` + `pgrep -f jest-worker`
before any suite, never more than one of mine, wait for a peer's suite, tear servers down the moment the drive is read.**
