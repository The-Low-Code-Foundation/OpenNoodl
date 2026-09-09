# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## Where session 1 left it (2026-09-09)

Scoped from Richard's field test of the shipped landing-page template. Nothing is built; four tasks
are written and one instrument is committed. **No code has been changed.**

Read `README.md` first — it carries the loop, the cadence and the four defects.

## State

| | |
|---|---|
| **Written, not built** | CMP-001 (playbook, 9 patterns, 3 floors), CMP-004 (the shelf) |
| **Measured, not written** | CMP-003 — the logic-component finding; the numbers are in README §2 row 3 |
| **NEXT** | CMP-002 — the graded baseline build, from its own brief, in a clean session |
| **Committed?** | 🔴 **No.** The whole folder is untracked on `cline-dev`. The weekly nudge routine reads the GitHub checkout, so until this is pushed it can only report "still uncommitted" |
| **Weekly nudge** | `trig_01MFceQCDiZvLy7cuSyeU877`, Fridays 09:00 Paris, first fire 2026-09-11 |

## The first job

**Commit and push this folder**, unless Richard has said otherwise. Everything else here is
downstream of it: the ledger, the nudge, and CMP-002's grading all assume the instrument is in the
repo. `measure-interfaces.py` must be committed **before** any arm is graded, or the two arms get
measured by two scripts.

After that, in order of leverage:

1. **CMP-004 AC1** — one sentence putting the shelf in the authoring order. ⚠️ The resident surface
   has 6 tokens of headroom; this rides in `get_project_info`'s doctrine channel, not
   `instructions.ts`.
2. **CMP-001 AC1** — the `States.currentState` port. One catalog/enrichment fix, and it unblocks the
   whole variant pattern. Smallest real change on the board.
3. **CMP-003** — write it up. The measurement is done; it needs the "when not to" correction and the
   tenth pattern.

## Ask Richard for

**The CSV of community logic and visual nodes.** He mentioned it and does not have it to hand. It is
the seed corpus for CMP-004 AC3 and that AC cannot close without it.

## Traps found in session 1

- 🔴 **Two obvious metrics were green before the work.** "Mean ports ≥ 3.5" and "carries a variant
  port" both fail to separate the shipped template from the reference library — the template scores
  3.4 and 14%. They are recorded as rejected in CMP-001 AC3. **Do not reintroduce them.**
- 🔴 **A session that has read this phase cannot grade a build of it.** The patterns are the answers.
- `MEMORY.md` was at 17,454/17,510 units. The P85 pointer was paid for by moving P69 and P65 into
  `older-phase-pointers.md` and tightening ten prose fragments. **14 units of headroom remain** —
  the next writer must free space before adding.
- A peer session rewrote the P83 index line mid-edit. Anchor on the heading, not on a neighbouring
  row, and re-read immediately before writing.
