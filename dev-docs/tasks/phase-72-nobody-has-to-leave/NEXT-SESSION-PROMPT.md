# Next session — phase 72

**Written 2026-08-19.** The phase was scoped this session out of a review conversation with
Richard. **Nothing has been built.**

## Read first, in this order

1. [README.md](README.md) §1 — the three findings. They are not what the review started from.
2. [README.md](README.md) §5 — **five open rulings**, each blocking a named task.
3. [TASKS.md](TASKS.md) — the order, and the proposed closing bar.

## What happened this session

A review of the community surfaces UNI-011 shipped. Richard's two asks were the UI ("it's still a
bit sad… too dark… dark on dark is really depressing") and full editor integration ("the fucking
thing just bumps you out to the browser page"). Investigation of **both** repos
(`OpenNoodl` and `~/vscode_projects/nodegx-community`) produced:

- **`--theme-color-fg-muted` fails AA in both themes** — 3.93 dark / 3.62 light on `bg-1`, worse at
  higher elevations — and it is the colour of nearly every word on the launcher's Community tab.
- **The platform already fixed this and did it by forking the palette**: `--site-fg-secondary`
  points at `fg-default-shy` and is gated by `tests/uni013-contrast.test.ts` (~30 pairs, both
  themes). The editor has no equivalent gate. UNI-013's "one palette" is currently false.
- **`bg-0` → `bg-1` is 1.06:1 in dark.** The elevation ramp the token file calls "deliberately
  distinct" is not distinct.
- **19 platform pages, 15 API routes, and no endpoint at all** for people, profiles, RFPs,
  coaching, University, tutorials or replays. That — not the launcher UI — is why the mirror has
  three sections.
- **Every community action in the editor is `platform.openExternal`** (`ProjectsPage.tsx:1325-1328`,
  `CommunityPanel.tsx:58`, `AskAboutNodeDialog.tsx:353`).

Richard settled four rulings in the conversation: **fix the shared tokens** (accepting the
whole-editor blast radius), **light fallback on the web**, **native read *and* reply** (not
read-only, not a webview), and **all four surfaces in scope**.

## Where to start

**NAT-001**, and 🔴 **observe it failing before touching a hex value** — the standing lesson about
measuring after a fix applies directly, and the specific numbers to capture are in NAT-002.

**NAT-006 can start in parallel** — it is a platform-only task with five tasks queued behind it.

## Before building anything user-visible

The five open rulings are not decoration. **D9** blocks NAT-002 (does `fg-muted` survive, or is it
kept and forbidden for text?). **D5** blocks every write in Tier 3 — the device-token flow was
scoped for identity, not for posting, and that is a decision with a consent step attached. Get them
in one sitting.

## Verification notes for this phase

- 🔴 A change to `colors.css` is **not done** until `npm run tokens:sync` has run in
  `nodegx-community` and both `uni013-token-drift` and `uni013-contrast` are green. Either side
  alone reads as finished.
- 🔴 D15 assertions need a **permitted control beside them** — "nothing was drawn" passes equally
  well when the component never ran.
- 🔴 The palette work must be **driven and looked at** on the node canvas. No spec knows what a wire
  is, and every spec can be green while the graph is unreadable.
