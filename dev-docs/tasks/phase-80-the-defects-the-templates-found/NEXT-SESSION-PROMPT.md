# Phase 80 — next session

## State: **no workable open row left — again, and this time the queue is empty of buildable candidates.**

DEF-001–004, 006, 008, 010, 011, 012, 014–024, 026 closed. DEF-007/009/025 🟡 partial;
DEF-005/013 🧭 await rulings.

**s22 (2026-08-30) closed DEF-012** — §2's leftover was the one workable candidate and it built
exactly as s15's finding specified. `query-fetches-before-its-filter` (`queryBeforeFilter.ts`,
advisory, both doors): a cloud `DbCollection2` with an authored collection name, a connected
filter parameter whose `qp-` port carries a real wire, and either run-on-change box not authored
`false`. The runtime half stays untouched on purpose: `dropUnresolvedConnected` makes *not yet
arrived* and *deliberately absent* indistinguishable there — the ordering is only decidable in
the authored graph.

- **Corpus** (`npm run calibrate:query-timing`, 178 projects): 625 Query Records nodes, 325
  with a wired filter parameter — **59 cloud firings in 12 projects, all legacy imports,
  sampled true from disk** (one is `fetched → response.send`: the caller receives every row in
  the class); 34 cloud queries already carry SB-004's workaround (silent); 180 browser
  instances at the default left alone, by decision with numbers.
- **Templates scanned before shipping**: site-builder ×3 + members-area ×3 filtered cloud
  queries all carry the workaround; no parity gate moved.
- 11 specs (incl. a traversal-parity arm against the runtime's `collectFilterParameters` —
  the duplicated-copy idiom), 7/7 mutants killed each by its own arm.

## What to do next

- **The phase is likely at its natural end.** The honest next move is the closing sweep the
  s21 prompt named: grade the README's own criteria against the table, re-read the
  "Findings this phase raised that nobody owns" register (rows with owner `NONE` — check each
  is still true at HEAD before re-filing), and write the phase's closing note. Do not invent
  rows to keep the phase alive.
- **DEF-007 §3.2** — 56 decisions on `site-builder.content.json`, still sequenced behind
  phase 77's active lane on that file. Check whether P77 is still mid-flight there
  (`git log -5 -- packages/noodl-editor/src/editor/src/models/template/templates/site-builder.content.json`
  + mtime) before considering it.
- **🧭 Richard queue** (unchanged): DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4
  (rateLimit default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending
  DEF-013's — the door's `components` now overlays unapplied plan ops).

## Traps carried

- ⚠️ **dist staleness (standing)**: a *running* MCP server answers without
  `query-fetches-before-its-filter` (and 018–024/026's codes) until rebuilt; the editor's
  `cloudruntime/sandbox.viewer.bundle.js` half stands. s22 touched no runtime behaviour, so
  viewer bundles owe nothing new.
- ⚠️ **Peer sessions run full backend suites back-to-back on this checkout** — s22 waited out
  two in one session. Check `ps -Ao pid,ppid,command | grep jest` and attribute by PPID
  before starting any suite; never run two package suites at once.
- 🔴 **A full-suite run piped to `tail` loses the failure names** — redirect the whole run to
  a file, then grep `^FAIL` / `●`.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only.
- ⚠️ **`grep` refused `HttpServer.ts` as binary (s18)** — `-a` on any grep over
  `nodegx-backend/src/server/`.

## Gates (s22, all fresh — detail in TASKS.md s22)

editor jest **6454/6458** (4 reds = the P77/P78 template lane's in-flight edits, mtimes inside
the run window; 6447 → 6458 = the 11 new specs) · noodl-mcp **993/994** (the 1 = the same lane's
sb007 string-pin vs the template's new `visualSort`) · typechecks ×3 clean · `catalog:examples`
62/62 strict · `catalog:check` clean · **`test:ci` 2905/4, all AIX-006 BY NAME, seed 87145,
fresh readout** — the floor. Trust TASKS.md s22 over this file if they disagree.
