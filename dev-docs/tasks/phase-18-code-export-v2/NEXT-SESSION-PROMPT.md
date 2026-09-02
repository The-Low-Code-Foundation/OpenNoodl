# Next session — 88/127 committed: §45 the files (Open File Picker, Upload File, Cloud File, Sign File URL) built, gated, mutated (15 arms), driven 88/88 and committed; Tier 2.6's buildable list is empty

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 73 ran every gate alone, waited out a peer's
drive specs and a peer's webpack before the suite / the editor tsc / the drive, and the drive
runner tore its three servers down in a `trap`. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 + README rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 95 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); `request()` now also carries a file body (§45) |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **88/127 committed** — §45 complete; Cloud Services: 2 left, both refused by name in the ledger |
| EXP-012 | 🟢 |

## What session 73 did (EXP-011 §45)

1. **Built** the four files nodes: one `file-out` expression kind with three families (pick /
   upload / sign), three actions (`pickFile()` in the util library with Done / Unchanged /
   Failure as three arms; `uploadFile` / `signFileUrl` in a new `src/api/files.ts` over two new
   client requests; `request()` takes a `file` body), `Cloud File` compiled away as a projection
   of the upload's row with `cloudFileName()` for its Name, the control-mint predicate grown for
   the family, a reserved-word guard on state names. Golden diff = `request()` + two functions.
2. **Five defects the build found:** a sibling handler's read of another node's row is compiled
   before the attach pass (the HTTP/Cloud/Record families never had one) — answered at compile
   time by "does it compile, is its trigger wired"; a checkbox labelled "Private" minted
   `const [private, …]`; the helper import earned in `exprCode` (after imports are decided) and
   declared below its walker (the §7.2 TDZ trap); the Cloud File's own sentences dying in a `ctx`
   nobody read until the node joined the pure-node sweep; the editor's TypeScript refusing an
   `in`-narrowing this package's accepts.
3. **Fixture** `tests/fixtures/photo-desk` (Log In, User, the four nodes, an Image on the stored
   url, a String node feeding the cancel note because the export's `Set Variable` needs a wire).
   **Spec** `tests/files.test.ts`, 40 rows.
4. **Gates one at a time:** tsc 0; 40/40; suite 56 files 1540/1540; editor tsc 0; ledger OK;
   picker 88 (floor raised). **Fifteen arms, all kill** after two rows (B15, B16) were written
   for the two that survived on the fixture alone.
5. **Drive** (`EXPECTED45.md` first): run 1 D1–D8 clean, then **D9 found a product defect** —
   the backend's CORS allow-list lacked `X-NodeGX-File-Private`, so every private upload from a
   cross-origin browser app has failed its preflight since BAK-006 and read as a network failure
   (same-origin previews never preflight — SBR-007 D21's hole, one header over). Fixed in
   `nodegx-backend/src/ops/headers.ts` + a row in `sbr007-auth-preflight.test.ts`; run 2
   **88/88, 0 diffs, VERIFY OK** (private url 403 anonymously / 200 with the token / its signed
   url 200 anonymously). Run 1 preserved as the control.
6. **Ledger:** `Sign In With` → *scheduled* (needs the client's OAuth return leg first),
   `Subscribe To Changes` → *deliberately out of scope* (SSE pub/sub, no static shape).
7. Committed by pathspec (README + EXP-001 left to their peer).

## 🔴 Do this next — BUILD (the defect farm is empty)

Tier 2.6's buildable list is empty. Rank the remaining 39 by the product surface, not the corpus
(`node scripts/export-ledger/picker-coverage.js` prints the gaps by category). Candidates, in
the order a person building an app hits them:
- **The file ↔ record pair** — a Cloud File into a record verb's `prop-*` / a `_User` column
  (an avatar), and a Cloud File node fed **from** a record's column; the wire serialises
  `{ __type: 'File', name, url }` (`cloudstore.js _serializeJSON`). One session; §45.6 names it.
- **`Sign In With`** if provider sign-in is wanted before that: the client's return leg
  (`_consumeAuthReturn`'s `?nodegx_auth` exchange written into the session) and then the node.
- **Data (21)** is the biggest bucket but mostly specialist; `Set Object Properties` and
  `Create New Array` are the two an ordinary page reaches.

Same shape as §41–§45: the runtime file first, the expected answers written before any run, the
toll table, refusals by name, a fixture on disk, the arms, the drive with a `trap` teardown,
then commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §45.3: a dev-open backend admits an anonymous upload (`checkAccess` returns before the files
  gate); the private-file gate holds. Owner NONE — loopback dev mode is by design.
- §45.3: an `Image` on a private file's url cannot render it (the browser's fetch has no session
  header) — true in the interpreter too; the signed url is the answer. Documented, not a defect.
- §45.6: `Error Status Code` and the progress family refused by name.
- §44.3: `ParseAuthAdapter.setUserProperties` copies `undefined` into the stored session — NONE.
- §44.6: Sign Up's §5.5 gate could lift on `UserProperties`. §43.3, §41.3 unchanged.
- `EXP-009-CLIENT-TARGET-OUTPUT.md` describes the client without §43–§45's functions; the
  golden is truth.

## The numbers (last honest readings, s73)

```
packages/nodegx-export: tsc 0 · jest 56 files, 1540/1540, exit 0 (80 s; B15/B16 graded after, 40/40) · 15/15 arms kill
noodl-editor tsc: 0 (third run, after two narrowings)
export-ledger:check OK — 176 types, 95 translated · picker 88/127 (69.3%), floor 88
nodegx-backend: sbr007-auth-preflight 3/3 (new row); dist rebuilt
drive: 88/88 cells (EXPECTED45.md), VERIFY OK, 0 listeners left after teardown
```

## Instruments (s73 scratchpad `23187039-bfef-49f1-93c9-744c2387e33e/scratchpad`)

`EXPECTED45.md`, `control45.mjs` (seed / verify — the verify asks the backend the five fetch
questions of the urls the drive left in `drive45-out.json`), `drive45.mjs` (file-chooser
interception, snapshot before every `until`, kills and respawns the backend), `drive45-run.sh`
(emit → build → backend → seed → Chrome → preview → drive → verify → trap teardown),
`drive45.log` + `*-run1.log` (the control), `backend45.log` (per request, with principals),
`photos45/` (two PNGs, 73 and 70 bytes, one name with a space), `mut45.py`/`runmut45.sh`/
`mut45-summary.txt`, `arm45-*-{tsc,jest}.log`, `jest-full-s73.log`, `editor-tsc-s73.log`,
`harness45/` (node_modules symlinked to s70's `harness43`), `backend-data45/`, `snap45/`.

## 🔴 What session 73 would tell you if it could only say three things

1. **A refused preflight reads as a network failure.** The client's one sentence covered a CORS
   refusal; the backend's log — an `OPTIONS` 204 with no request after it — is what told the
   truth. A custom header is a cross-origin request's own admission ticket; check the list.
2. **The attach test cannot answer for a read compiled from another handler.** Ask the question
   the compile pass can answer, and let the emitter's reference filter drop the rest.
3. **A surviving arm is a fixture with two earners.** Do not delete the arm — write the row that
   removes the other earner (B15, B16).

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (56); `grep -a`; absolute paths; **`vm_stat` + `ps`
before any suite, never more than one of mine, wait out a peer's, tear servers down in a `trap`.**
