Screenshots land here.

This directory is deliberately empty on merge: PNL-005 ran in a worktree, and an
editor launched from a worktree executes MAIN-checkout code (`lerna exec` resolves
the package root there), so any capture taken from it would have been unrelated to
the diff. Faking the evidence was the alternative.

Fill it from the PRIMARY checkout with one command:

    node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs \
      --width 1400 --height 900 --json /tmp/pnl-005-chrome.json

It walks every registered rail panel in both themes, writes
`<panel>--<theme>.png` and `<panel>--<theme>--narrow240.png` here, and asserts the
chrome (one 44px header per panel, 13px/650 title, nothing past the panel edge,
section headers subordinate) — exits non-zero if any panel fails.

See PNL-005-NOTES.md for the prerequisites and the ordered live-QA checklist.
