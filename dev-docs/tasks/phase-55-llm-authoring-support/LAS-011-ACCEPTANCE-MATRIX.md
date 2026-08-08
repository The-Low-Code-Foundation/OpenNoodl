# LAS-011 — The exit: the acceptance matrix

**Status:** 📋 open · **Track 4 (models)** · **the phase closes on this, not on green gates** ·
needs LAS-001…008 landed and LAS-010's rig; LAS-009 is optional for the matrix

## What this is

The phase-40 bench, extended by this phase's requirement: replay the storefront brief **cold** on
three models, score the artefacts mechanically, and put the rendered pages in front of Richard
beside a Claude artifact of the same brief. The success line is written in the README and does not
move:

> The mid-tier and open-weight runs must be *architecturally* correct — components with real
> interfaces, repeaters over data, states and signals, responsive — even where their visual taste
> is weaker than Opus's. If a weak model produces a well-architected app with mediocre spacing,
> the phase succeeded; if only a strong model produces a beautiful page, it did not.

## Protocol

1. **One run per model, no rescues, stalls are data** — STOREFRONT-BRIEF.md protocol, verbatim
   brief, fresh `create_project` each:
   - mid-tier hosted: haiku (claude CLI rig)
   - strong hosted: sonnet (claude CLI rig)
   - mid-tier open-weight: LAS-010's model and driver
2. Pin the stack: record the commit hash the replays run against; all of LAS-001…008 in, viewer
   bundle rebuilt (`render-from-disk` tests the last build otherwise — its own header's warning).
3. Score each run with the STOREFRONT-BRIEF.md table + `render_report` + `validate:project`.
   **Score the artefact, and read the transcript before classifying any failure** — the session-1
   rule (a model that was never told about a tool did not "fail to know" it).
4. Publish the before/after matrix against the session-1 baselines in AUDIT-SESSION-1.md:
   haiku (dead cards, 1-col grid, 5 broken images, 0 connections) and sonnet (blobs, motorcycle,
   zero Columns, 147 turns). The gates' effect should be legible run-to-run: F2 rejections →
   interfaces exist; F3 → grids actually multi-column; LAS-002/007 → fewer wasted turns, measured.
5. **Richard judges** the rendered pages side-by-side against a Claude artifact of the same brief.
   His verdict is recorded here in his words, not paraphrased.

## Reading the results

- A failure that survives the new gates gets classified (knowledge / ordering / capability /
  seam) with transcript citations and either spawns LAS-012+ or is **accepted with a written
  reason** — an unwritten acceptance is a premise for the next phase to trip over.
- Watch for the gates' failure mode, not just their success: a mid-tier model looping forever on
  a now-blocking rejection is a capability finding that argues for LAS-007's attachments or
  smaller turns — not for weakening the gate. Turn counts and cost per run go in the matrix for
  exactly this reason.
- If the open-weight model cannot reliably tool-call at all (LAS-010's fallback triggered), the
  matrix says so as a capability row — the phase's claim then honestly narrows to "any competent
  tool-calling LLM", and that wording lands in the README.

## The matrix (fill in)

| | haiku 4.5 (before → after) | sonnet 5 (before → after) | open-weight (first run) |
|---|---|---|---|
| components / page-own nodes | 9 / 7 → | 17 / 8 → | |
| Component Inputs where instances vary | ✗ → | ✓ → | |
| repeaters over data (For Each + source) | ✗ → | ✓ → | |
| Columns where layout must reflow | ✓(broken string) → | ✗ → | |
| connections / signals | 0 → | 102 ✓ → | |
| validate: errors / warnings | 0 / 2 → | 0 / 1 → | |
| render report clean (no dead text, no broken img, ≤390 min width) | ✗ → | ✗ (blobs) → | |
| turns / cost | 42 / $0.53 → | 147 / $7.86 → | |
| Richard's verdict vs artifact | — | — | — |

## Acceptance (of the phase itself)

- Matrix complete, all cells evidenced (screenshots in `measurements/`, transcripts kept).
- Mid-tier **and** open-weight rows architecturally correct with clean render reports, per the
  success line — or the shortfall classified, written up, and the follow-on tasks filed.
- README status updated to the outcome; HANDOVER.md for any successor phase names what was
  accepted-with-reason.

## Register

| # | Finding | State |
|---|---|---|
| — | | |
