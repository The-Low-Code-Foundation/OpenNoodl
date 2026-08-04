# AAQ-011 — Found along the way

The phase's register, in the AIB-009 tradition: anything filed-not-fixed gets a ROW (the pol-013
lesson — a register that loses rows is lying). Worked opportunistically beside the numbered tasks.

| # | Filed | Report | Mechanism | Status |
|---|---|---|---|---|
| F1 | 2026-08-04 | Finding #10 — dragging a component from the component menu in **light mode** renders a dark pill with dark text; the label is unreadable while dragging. | Unverified. Suspect the drag-ghost styling is hardcoded to dark-theme tokens or reads editor chrome tokens outside the themed scope. | open |
| F2 | 2026-08-04 | Finding #12 — the custom CSS property row's label clips to "CSS …" in the props panel, and the popup CSS editor opens **downward**, overflowing the panel bottom so it cannot be used for nodes low in the panel. | Unverified. Two defects: a label truncation (width/ellipsis on the property row) and a popup placement that never flips upward when there is no room below. | open |
| F3 | 2026-08-04 | The scoping wizard's `record_scope` tool result *"Recorded. Now answer the user in prose."* produces a visibly redundant second answer even after AAQ-004 keeps the first one — evaluate whether the second turn should be suppressed from the transcript when it adds nothing. | Design question, not a defect; decide inside AAQ-004's fix review. | open |

## Register rules

- A row is closed by a commit hash and a one-line mechanism, or explicitly downgraded with a reason.
- Anything discovered during AAQ work that doesn't belong to a numbered task lands here first —
  including new silent-discard mechanisms, which additionally get called out in the phase README if
  they change its counts.
- Never close a row on "couldn't reproduce" without recording the drive that failed to reproduce it
  (a driver that swallows a click failure reports the absence of a defect).
