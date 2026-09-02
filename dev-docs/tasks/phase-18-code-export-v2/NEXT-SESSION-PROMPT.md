# Next session — 82/127 committed: §43 `Record` gated, mutated (10 arms), driven 72/72 and committed, with the client's `request()` wrap it found; next is the next Cloud Service

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

Session 70 was stopped for piling a suite, a tsc, Chrome, a backend and a preview on a 16 GB box
beside two peers. Session 71 ran everything **one job at a time** (`vm_stat` + `ps` first; the
drive runner tears its three servers down in a `trap`) and nothing died. Keep it that way.
Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 + README rows still uncommitted (theirs, 22:29 09-01) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 89 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); **s71: `request()` wraps network failure** (note appended) |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **82/127 committed** — §43 `Record` complete (§43.6) |
| EXP-012 | 🟢 |

## What session 71 did (all in EXP-011 §43.6)

1. **Gates, one at a time:** package tsc 0; `record.test.ts` 29/29 (the handoff's "30" was a
   miscount — 29 `it(` on disk); whole suite 54 files 1445/1445; editor tsc 0.
2. **Ten mutant arms, all kill** (`mut43b.py`/`runmut43b.sh`, s71 scratchpad): A2 B19 C12 D7 E4
   F5 G7 H2 I4 J1. C's 12 is the guard doubling as the TS narrowing. J's first shape was a TS7034
   ("not a kill" = measured nothing) — keep the declared type when deleting an initialiser.
3. **The drive:** first run D1–D7 as predicted, **D8 timed out** — and lost its D1–D7 snapshot.
   Observed pre-fix: with the backend down the Record's Error read Chrome's **"Failed to fetch"**.
   `callFunction()` wrapped that since §41; `request()` (every other verb) never did. **Fixed**
   in the client template, golden regenerated, a cardinality row added (2 sites, 2 wraps, 1
   sentence). Re-drive: **72 cells, 0 diffs**; six GETs at exactly the predicted steps.
4. **After the wrap:** suite 54 files **1446/1446**, editor tsc 0, ledger OK, picker holds 82.
5. Committed by pathspec (README left to its peer). Memory:
   `a-predicted-sentence-belongs-to-one-code-path`.

## 🔴 Do this next — BUILD (the defect farm is empty; 2 sessions have built §43, now build §44)

The next Cloud Service. s70's survey (§43.5 + its handoff):
- **`Set User Properties`** and **`Request Magic Link`** — session verbs on the user family's
  `api-call` machinery (`PUT /users/<objectId>` with the stored session rewritten;
  `POST /auth/magic-link {email, redirect}`). Cheapest, both ride the now-wrapped `request()`.
- `Cloud File` / `Sign File URL` need a `CloudFile` value type; `Upload File` needs the
  untranslated `Open File Picker`.
- `Subscribe To Changes` (SSE — the backend has no WebSocket) and `Sign In With` (a full-page
  redirect, the return leg in the client's constructor) — refuse-by-name candidates.
- Corpus: Record 22, Upload File 17, the rest 0 — rank by the product surface, not the corpus.

Same shape as §41–§43: the runtime file first, the expected answers written before any run,
the toll table, refusals by name, a fixture on disk, the mutant arms, the drive with a `trap`
teardown, then commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §43.3: the wired form's row is kept on an Id change (the runtime rebinds to an empty model).
- §41.3: `x-noodl-cloud-version` header.
- `EXP-009-CLIENT-TARGET-OUTPUT.md` describes `request()` without the wrap; the golden is truth.

## The numbers (last honest readings, s71)

```
packages/nodegx-export: tsc 0 · jest 54 files, 1446/1446, exit 0 · 10/10 arms kill
noodl-editor tsc: 0
export-ledger:check OK — 176 types, 89 translated · picker 82/127 (64.6%), floor 82
drive: 72/72 cells (EXPECTED43.md), 0 listeners left after teardown
```

## Instruments (s71 scratchpad `f7c7c982-10f0-4275-baf3-b4fea27cb602/scratchpad`)

`mut43b.py`, `runmut43b.sh`, `mut43-summary.txt`, `arm43-*-{tsc,jest}.log`, `drive43-run.sh`
(emit → build → backend → Chrome → preview → drive → trap teardown), `drive43.log` (the 72 cells),
`drive43-prefix-run.log` (the timeout), `d8only.{sh,mjs}` (the pre-fix cell, "Failed to fetch"),
`backend43*.log`, `regold.ts` (client golden regeneration), `jest-full*-s71.log`, `editor-tsc*-s71.log`.
s70's `EXPECTED43.md`, `control43.mjs`/`.log`, `backend-data43/`, `harness43/`, `drive43.mjs`
are in `144aedad-2384-404c-9007-e502f9633b8f/scratchpad` and still used by the runner.

## 🔴 What session 71 would tell you if it could only say three things

1. **Name the helper the driven node calls before writing its expected cell.** The sentence was
   real — for a different producer. Two `fetch` sites, one wrap, 1445 green rows around it.
2. **Print the snapshot before every `until`.** A timeout at D8 cost D1–D7; the backend's log
   had to stand in for them.
3. **A tsc-gated arm that fails tsc measured nothing** — re-shape it; "not a kill" is not a kill.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first; delete probe specs
before committing; reconcile the suite count against disk (54); `grep -a`; absolute paths;
**`vm_stat` + `ps` before any suite, never more than one of mine, tear servers down in a `trap`.**
