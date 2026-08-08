# BLD-010 — The acceptance pass

**Status:** 📋 not started · **Track A** · after everything · closes the phase

## Why this is a task and not a checkbox

This repo's own history is the argument. A green check has proved nothing about a panel more than
once: the Roboto font picker went green **twice** while shipping the wrong font; `_variant` was inert
while its tests passed; a "muted button" was 1.00:1 at 143 call sites with no gate noticing; and a
stylesheet fix passed a stylesheet check and **changed nothing on screen** because a second class
outranked it (POL-007's own `is-growing` note,
[AiAuthoringPanel.module.scss:120-130](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.module.scss#L120)).

Every visual claim in this phase gets driven live, in the real app, and measured.

## The matrix

Every row driven in the running editor, screenshotted, at **both widths** (400px panel, expanded
document) and in **both themes**.

| # | State | Asserted |
|---|---|---|
| 1 | Empty thread | Suggestions present; no scope tabs; no banner interrupt |
| 2 | Component build, in flight | Heartbeat alive; activity collapsed to one strip; Stop present |
| 3 | Component build, stream killed | **Heartbeat stops within 2s**; words explain it (BLD-004) |
| 4 | Staged, preview document open | **Exactly one Accept on screen** (BLD-003) |
| 5 | Staged, preview document closed | Exactly one Accept, now on the card |
| 6 | Accepted | Receipt present; **the whole conversation still readable** (BLD-006) |
| 7 | Plan proposed, 7 operations | All 7 listed; Drop works; nothing authored |
| 8 | Run in flight, scrolled to the bottom | **Run header still visible** (BLD-005) |
| 9 | Run, ≥ 2 ops complete | Estimate shown, labelled; not before |
| 10 | Docs interview, question 1 | Question is the loudest element; guess pre-filled |
| 11 | Docs interview, resumed after leaving | Same question, prior answers intact (BLD-008) |
| 12 | Reopened editor | Thread present with outcomes (BLD-006) |
| 13 | Composer with 4 references | Chips, per-turn cost, cached share (BLD-011) |
| 14 | `@` menu open | Five kinds grouped; keyboard-navigable |
| 15 | Capture returned | Screenshot **and** findings; age shown (BLD-014) |
| 16 | Capture gone stale | Greyed, offers refresh, **not silently re-sent** (rule 7) |
| 17 | Text-only provider + an image reference | **Declared** degradation, visible in the chip (BLD-012) |
| 18 | Search result | Citations carry source and read-time (BLD-015) |

## Measured, not felt

- [ ] **Controls live at once ≤ 4** in every state (from 8 in panel + 4 in document).
- [ ] **Zero duplicated actions** across panel and document, in every state.
- [ ] Every text role ≥ 4.5:1 **on the background it actually sits on**, both themes. ⚠️ `bg-2` and
      `bg-3` are not `bg-1`; measure per surface, not per token.
- [ ] No horizontal scroll at 400px in any state (POL-007's property, re-verified after BLD-005 and
      BLD-011 both added content to rows it fought to fit).
- [ ] Keyboard: the composer, the `@` menu and every card action are reachable and have a visible
      focus state.

## Driving traps — read before starting

- **The editor is a queue.** If another session is using it, wait ~5 minutes and poll. Do not
  `dev:stop` — it kills by checkout and takes their run down.
- **`--target=editor` attaches to the PREVIEW.** Never `cdp reload`.
- **Occluded Electron clamps timers ~1000×** — pace drivers with `MessagePort`. This matters
  particularly for rows 3, 8 and 9, which are all about time.
- **A property-panel select opened by `.click()` never closes** (portalled options); a text input
  commits on **blur/Enter only**. Relevant to driving the composer and the `@` menu.
- **Verify WHICH project opened first.** More than one live-QA pass has measured the wrong app.
- **A fake is an unchecked claim.** Five ways a driver fakes a pass are catalogued in the phase-38
  closing notes; re-read them before writing the driver, not after.

## Acceptance

- [ ] All 18 rows driven and screenshotted, both widths, both themes.
- [ ] The phase exit test (README) completed end-to-end in **one continuous session**.
- [ ] Anything found and not fixed gets a row in this register with its blocker named — the LAS-005
      F22 precedent. **Filed-not-fixed is an acceptable outcome; silent is not.**

## Register

| # | Finding | State |
|---|---|---|
| | | |
