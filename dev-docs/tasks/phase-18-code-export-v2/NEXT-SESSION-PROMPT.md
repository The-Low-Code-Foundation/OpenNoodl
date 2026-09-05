# Next session — §66 `Subscribe To Changes` is BUILT and DRIVEN (session 90, 2026-09-05): Tier 3.11 row 3 of 3, the LAST scheduled node; picker 117/127 (92.1%). Tier 3.11 is complete and the ledger holds NO `scheduled` row. Next = the editor write path drive, then the residual registers

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 90 ran every gate sequentially behind a load gate
(`final-gates.sh`: `uptime` load < 8 AND no `jest-worker|vitest` of anyone's) — a peer's `tsc -p tsconfig.d58.tmp.json`
(P82's D58) held the load at 11–19 for stretches and the chain waited. Memory: `do-not-pile-cpu-work-on-a-shared-box`,
`parallel-worktree-traps`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 124 translated; floor + total held by `--check` |
| EXP-009 backend connection | 🟢 — `src/api/client.ts` now EXPORTS `ENDPOINT` (realtime.ts reads it; the golden moved by that word) |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — Tier 2.8 rows 1–13 built AND driven; **Tier 3.11 rows 1–3 (§64 SSE, §65 WebSocket, §66 Subscribe To Changes) built + driven — the tier is COMPLETE**; the 10 nodes left are every one `deliberately out of scope` (the §50 rulings); the editor write path is UNDRIVEN |
| EXP-012 | 🟢 — the alpha notice reads 117/92% off the ledger; the 0.2.2 release notes match (10 badged, none "yet") |
| EXP-013 "Not exportable yet" | 🟢 — **no scheduled row remains**: the editor badge spec's population row says so, its drawn scheduled badge is a literal; the reader's `scheduled` branch is live code with no live population |

## What session 90 did

1. **§66 `SubscribeToChanges`** (Tier 3.11 row 3; the last scheduled node): the sixth member of `STREAM_NODES`
   (`kind: 'subscription'`, `lib: 'realtime'`, no data port, no Actions, the Class through a new `param: 'collectionName'`
   field on the config entry + Enabled, five signals, seven values); `src/emit/realtimeLib.ts` → `src/lib/realtime.ts`
   (≈1,300 lines: the contract's types/timing/backoff, `RealtimeSubscription` verbatim, the `NODEGX_SSE` dialect +
   `SseTransport` verbatim, `SseConnectionPool` verbatim, then the node — `useSubscribeToChanges(source, { collection,
   enabled }, listeners, seams)`), generated from `realtime-lib-source.ts` + `gen-rtlib.py` (this session's scratchpad —
   **regenerate, never hand-edit the quoted array**). It imports `../api/client` (`ENDPOINT`, `readSession`) and `./errors`;
   `apiModules` counts a subscription as a backend use so client.ts ships for one alone. `streamPlanOf` refuses by name BEFORE
   the table's own gate: no backend, a second Backend (authored or wired), an authored Filter or a `qp-` wire.
   Fixture `live-desk` (a backend at 8584, class Contact, the node with a Class and nothing else — Enabled untouched ⇒ ON;
   the five signals → Set Variables on `last`/`pulse`; the seven Realtime outputs in Texts). Spec
   `tests/subscribe-to-changes.test.ts` 41 rows. Ledger 116 → 117 (124 translated), 14 floor pins moved (13 by sweep + the
   SSE spec's, which `grep -l` had SKIPPED AS BINARY — `-a`), the two `SubscribeToChanges` badge pins → undefined, EXP-013's
   editor badge spec re-shaped (§66.4 #5), PROGRESS + the release notes at 117/92%/10.
2. **Measured first**: the reverted arm (`probe-reverted.log`, a detached worktree at HEAD c58c2430 with the root
   `node_modules` symlinked in) — 22 refusals. Built: 17 files, 0 refusals.
3. **Gates before the final chain**: pkg tsc 0 · `typecheck-emitted` live-desk ✓ (red ONCE on `clearTimeout(unknown)` — the
   emitted tsconfig, §64.4's lesson, third transport in a row; fixed at the seam) · the spec 41/41 · `export-ledger:check`
   OK 124 · picker `--check` 117 exit 0 · **arms 21/21 KILLED** (`mut.py`; M11 hung the harness on the first run — an
   infinite render loop — the harness now caps at 100 settles; M22 survived first — the dialect reads `objectId` first — E3
   gained the edge row) · the four table specs 172/172 after two stale pins (the trio's catalog-set row: a config port with
   `param` is discovered, not declared; the SSE spec's floor).
4. **The drive** (`drive66.sh`, `fakert.js` on 8584 — the hub's measured wire, `EXPECTED66.md` FIRST): T1 the page subscribed
   at MOUNT with one anonymous GET and one union POST; T2–T4 create/update/delete landed with the record, the id, and the
   pulses; T5 a dropped stream ⇒ `interrupted` with NO error; T5b the browser reconnected with `Last-Event-ID: 4`, re-registered
   under `c2`, `subscribed`, and the hub's `resync` cleared the record outputs without pulsing created/updated/deleted; T6 a
   create on the new stream; T7 errs `[]`. **Every row matched the sheet.** Teardown 0 listeners.

## The final gate chain — READ on the final tree

`final-gates.sh` (s90 scratchpad `fb86e236-…`), each step behind a load gate: **whole pkg jest 78 files (78 on disk) 2894/2894 exit 0** (`whole.*`, 19:44–19:47; a FIRST run had read 2892/2894 — two stale pins, the trio's catalog-set row and the SSE spec's floor, fixed and re-run) · **editor tsc 0** (`editor-tsc.*`, exit 0, an empty log — s88/s89's shape) · **exp-012/013 157/157** (the chain's run read 156/157 on the badge spec's `deferred.length > 10` guard — §66 brought the population to exactly 10; now `>= 1`; re-run alone 157/157) · **editor `test:ci` 2943 specs, 5 failures = the known floor** (AIX-006 ×4 + SB-017 acceptance 6; seed 19064, HEAD 6101f96f — a peer's commit on top of mine; `test-results.json` fresh 19:51, 67 s; `.webpack-cache` cleared first; the enforced gate exits 1 on the floor, as in s88/s89).

## Uncommitted at hand-off

- Nothing of session 90's: the code (the lib, the table, the gates, the fixture, the spec, the ledger, 14 pins, the EXP-009 golden, the editor badge spec), the docs (EXP-011 §66, PROGRESS, this file) and the release-notes hunk (staged ALONE via `git apply --cached --unidiff-zero rn-mine.patch` — a PEER holds ~70 uncommitted lines in that file; never a pathspec commit there). `PUBLISH-0.2.2.md` and `EXP-001-NODEGX-CORE.md` carry a peer's edits, untouched.

## 🔴 Do this next

**Tier 3.11 is complete and the picker ceiling this phase scheduled is reached (117).** The remaining 10 are Richard's §50
out-of-scope rulings (Sign In With and the nine data/state utilities the picker lists under `export-ledger:picker`); moving any
of them is a RULING, not a build. So the phase's next work, in order:

1. **The editor write path on one fixture** — launch the editor on a COPY (`open-a-copy-of-a-real-project-in-the-editor`),
   export from Settings, compare bytes to `emitApp` (`live-desk` or `socket-desk`); EXP-012's command is specced, never driven.
2. **§60.5** the mount-write for an authored Variable value (owner EXP-011; drive-confirmed divergence: the export boots `''`
   where the runtime seeds the authored value) — a MOUNT WRITE in the host per mount, not a module-level seed.
3. **§66.5 #1** — measure in the RUNTIME whether a Variable nothing has written delivers `undefined` into `Enabled` at boot
   (⇒ OFF, as the export reads) or never runs the setter (⇒ ON). Only then a fixture may wire Enabled from a Variable.
4. The residual registers (§57.5–§66.5), each owner NONE unless named; and EXP-004's two Richard items.

🔴 **`typecheck-emitted.test.ts` before the first arm** — three transports, three reds there that nothing else caught.
🔴 **`grep -a` for a pin sweep** — the SSE spec was skipped as binary and its floor pin went stale; the whole-package run found
it, one run late. 🔴 **A compiled lib binds `react` ONCE** — two hooks on one lib need the dispatching harness
(subscribe-to-changes.test's `loadLib`); the WebSocket spec's is single-harness. 🔴 **Every exporter change owes the editor
`tsc` AND `test:ci`, run by YOU, alone; `rm -rf .webpack-cache` first.** 🔴 **`ts-node` on this package needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts`
REMOVES its output directory — copy `node_modules` in AFTER the emit.** 🔴 **A reverted arm = `git worktree add --detach`
+ `ln -s <repo>/node_modules` — never a stash.**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §66.5: Enabled from an unset Variable (measure the runtime first); an authored Filter (refused by name; the query row does
  not send its filter either); Changed Record is the wire's `objectId` record, not the client's `id` row; the token is a
  snapshot at reconfigure; the token rides the stream URL (the backend's contract); StrictMode's extra stream in dev; the
  drive is against a fake, not `nodegx-backend`'s hub; `Realtime Error` in a Text prints `[object Object]`.
- §65.5 / §64.5 / §63.5 / §61.5 / §62.5 / §57.5–§59.5 unchanged; §60.5 the `Variable2` mount write (owner EXP-011).

## Instruments

s90 scratchpad `fb86e236-c52b-4629-b3cb-9f877719af17`: `realtime-lib-source.ts` + `gen-rtlib.py` (the lib's source and
generator), `emit.ts` (takes `$R` for the package root), `drivelib.sh`, `drive66.sh`, `fakert.js`, `EXPECTED66.md`,
`probe-reverted.log` (from the `rev/` worktree — `git worktree remove` it when done), `probe-built.log`, `mut.py`,
`mut.log` (21 arms) + `mut-summary.txt` (the M11/M22 re-run), `spec-run1.log`, `whole-run1.log` (the run that found the two
stale pins), `final-gates.sh` + its `*.log/.exit/.start`, `rn-full.patch` / `rn-mine.patch` (the release-notes hunk, staged
alone), `live-desk-out` (the built app; `node_modules` copied from s88's `token-desk-b-out`), `live-desk-reverted-out`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (78 spec files now);
`grep -a`; absolute paths — **the shell cwd resets between calls**; `with open(...)` for every file write; **`vm_stat` + `ps` +
`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear servers down the moment the
drive is read.**
