# Phase 65 — next session

**State (2026-08-22, after the blitz):** the library is published and live — 65 entries
(35 prefabs + 30 modules) at the real origin, verified at payload level. Everything buildable
headlessly is built: LBR-001/002/005/006/007/008/009/0xx are done or built-not-driven. Read
[TASKS.md](TASKS.md) §"2026-08-22 — the blitz" for the ledger and the 10-point follow-up list.

**The one thing this phase still owes: the exercised half.**

Suggested prompt:

> Phase 65: run LBR-003/LBR-004 — the drive. Open prefabs and run modules from the LIVE origin in
> the real editor (fresh project, console-clean, both React pairings where relevant). Start with the
> per-entry drive asks in TASKS.md follow-up #1 (the 16 new entries have never been seen rendered)
> and the four modules nobody has ever run by any means (chart-js is the one the charting story
> leans on). Record verdicts per entry in the AUDIT files; anything broken gets fixed and
> republished (bump the version — the editor caches zips by URL forever).

Traps for that session (from memory, verified this session):
- Drive a COPY of any real project; opening a project writes 3 files and dirties every component.
- `NOODL_REMOTE_DEBUG_PORT` — a stray Chrome steals 9222; two editors cannot coexist.
- The editor-install proof for LBR-001's criterion 5 ("installs from the real origin, zero console
  errors, no DbConfig placeholder") folds into this drive.
- After any content fix: `library:build` → copy `library-dist/*` flat into
  `nodegx-content/static/library/{prefabs,modules}/` → push main (you have admin; Pages deploys in
  ~1–2 min; legacy build serves the tree verbatim). Then `library:verify-origin`.

Cheap high-value extras if the drive stalls: the verify-origin payload-hash check (follow-up #2),
the bespoke-icons pass (#5), docs-site pages for the 16 new slugs (#6).
