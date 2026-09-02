# SBR-014 — The drive

**The phase's own acceptance run — the half SB-008 never did.** SB-008 proved consequences
over REST; *"nothing in this phase has clicked the panel's own UI"* was the recorded narrowing.
This task drives the whole story through the panel's UI, with a wizard-attached backend,
end to end. It runs LAST and it re-verifies every person sentence in the phase.

## 1. The story to drive (one session, in order)

1. Launcher → wizard → Site Builder template → project opens on `Pages/Setup` (SBR-001/002).
2. Claim the site (setup token path) → land in the admin shell (SBR-006).
3. Create a page in the dialog; author all five section kinds including a multi-image gallery
   via file drop (SBR-005/007); drag-reorder; save; publish.
4. Open the public site anonymously: nav, measure, footer, five kinds, Studio look (SBR-004).
5. Theme: pick Night, watch the local preview, save, watch the open site repaint live
   (SBR-009/011/003).
6. Submit the contact form anonymously → success sentence → owner reads it in Messages
   (SBR-005/010).
7. Deploy to a folder; on the deployed panel, retitle + save; the deployed site shows it
   (SBR-008).
8. The negative arcs: no-backend project shows its sentence (SBR-002); anonymous cannot see a
   draft, unsubscribe silence beside the firing twin (SBR-011).

## 2. Acceptance criteria

1. Every step above verified by its **consequence** on screen (visibleText / reachable per
   `elementFromPoint` / resolved styles), not by mechanism logs.
2. Each numbered step maps to the person sentence of its owning task; a step that cannot be
   driven is recorded as ⬜ against that task by name — never rounded off (the SB-008 lesson,
   verbatim).
3. Screenshots at steps 4, 5 and 7 land in the phase folder — the mind-blowing is visible or
   it isn't.

## 3. Traps (the full driving set — read the memory index before starting)

- Modal renders twice: stamp the copy not under `[class*=Measuring]`, click twice;
  `elementFromPoint` before every click; IIFE around every eval; a write is invisible in the
  same eval; keys need focus emulation on the same connection.
- Stray Chrome steals 9222 (`NOODL_REMOTE_DEBUG_PORT`); the launcher watchdog reaps —
  `npm run cdp -- health` before trusting the stack; announce launch AND teardown to peers.
- Drive a wizard-created project (this phase's own flow) — not a hand-opened copy of a real
  one; opening a project writes three files and dirties every component.
- 🔴 Verify the consequence, not the mechanism: a drive can pass on a broken feature if you
  assert the call rather than the screen.

---

## 4. Run 1 — 2026-09-02 (s44). 🔴 Reached step 3 of 8; steps 3–8 ⬜

**Full record: [`notes/sbr014/SBR-014-DRIVE-2026-09-02.md`](notes/sbr014/SBR-014-DRIVE-2026-09-02.md).**
Driven through the panel's UI on a wizard-created project (`sbr014-drive`, backend on 8604).

| # | step | owner | state |
|---|---|---|---|
| 1 | wizard → Site Builder → opens on `Pages/Setup` | SBR-001/002 | ✅ driven |
| 2 | claim → admin shell | SBR-006 | 🟡 driven, **not by the person's path** — ⬜ **SBR-001** (D50) |
| 3 | create page, five kinds, reorder, save, publish | SBR-005/007 | 🔴 ⬜ **BLOCKED — SBR-008 AC1** |
| 4 | public site anonymously | SBR-004 | ⬜ not reached |
| 5 | theme → live repaint | SBR-009/011/003 | ⬜ not reached |
| 6 | contact form → Messages | SBR-005/010 | ⬜ not reached |
| 7 | deploy → retitle → save | SBR-008 | ⬜ not reached |
| 8 | negative arcs | SBR-002/011 | ⬜ not reached |

Unchanged and pre-known: **SBR-007 AC3** ⬜ (D15, no runtime drop-target capability).

### AC status

- **AC1 — not met.** Five of eight steps were never reached.
- **AC2 — met, and it is the only one.** Every unreached step is ⬜ against its task by name above;
  nothing was rounded off. This is the criterion the run exists to protect.
- **AC3 — not met.** Steps 4, 5 and 7 were never reached, so their screenshots do not exist. Four
  other pictures were taken (backend attached, admin shell, and two defects) — see the record.
  ⚠️ The preview window is **456×313 css px**; resize it before any run that owes a look.

### 🔴 The blocker, stated once

A page created through the New page dialog persists **no title and no slug**, and the page editor's
save then writes nothing (`updatedAt` did not move). Driven twice through two different input
methods. The `Page` table never gains the columns.

This is **not a new defect — it is [SBR-008](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md) AC1**,
already recorded unmet, in its worst form: in SBR-008's own drive `Title` saved because that
fixture already had the column, and only `seoDescription` was lost. On a wizard-fresh site there is
no column for anything, so the loss reaches the primary fields and there is no way out through the
UI — the only way to create the column is to write it, and the wire that writes it is the one being
dropped.

**Steps 3–8 cannot be driven until SBR-008 AC1 is met.** That makes it this phase's real distance
to done, ahead of SBR-014 itself.

---

## 5. Run 2 — 2026-09-02 (s46). 🟡 Reached step 6 of 8; steps 7–8 ⬜

**Full record: [`notes/sbr014/SBR-014-DRIVE-2026-09-02-s46.md`](notes/sbr014/SBR-014-DRIVE-2026-09-02-s46.md).**
Same wizard-created project, driven against the editor's live preview server on `:8574`.

| # | step | owner | state |
|---|---|---|---|
| 1 | wizard → Site Builder → opens on `Pages/Setup` | SBR-001/002 | ✅ driven s44 |
| 2 | claim → admin shell | SBR-006 | 🟡 driven s44, not by the person's path — ⬜ **SBR-001** (D50) |
| 3 | create page, five kinds, reorder, save, publish | SBR-005/007 | 🟡 **driven**, two exceptions below |
| 4 | public site anonymously | SBR-004 | ✅ **driven** |
| 5 | theme → Night → live repaint | SBR-009/011/003 | 🟡 **driven except the live half** — ⬜ **SBR-011** |
| 6 | contact form → Messages | SBR-005/010 | ✅ **driven** |
| 7 | deploy → retitle → save | SBR-008 | ⬜ **not reached** |
| 8 | negative arcs | SBR-002/011 | ⬜ **not reached** |

**Step 3's exceptions, ⬜ by name:** ⬜ **SBR-007 AC3** — no picture was added (`Choose image` opens
a native file picker; `DOM.setFileInputFiles` was not built this run), so **SBR-005 AC1 is 4 of 5**
and the gallery renders as a bare heading. ⚠️ **SBR-007 AC2** met by drag but see **D53**.
**Also ⬜:** SBR-005 AC3's failure-line negative control.

### AC status

- **AC1 — not met.** Six of eight steps driven.
- **AC2 — met**, and still the only one fully met. Nothing rounded off.
- **AC3 — 🟡 partly met for the first time.** Steps 4 and 5 have pictures at 1440×900/1700, with
  fonts and icons present. **Step 7's does not exist** — step 7 was not reached.

### 🔴 The blocker was real, and it was not the one the hand-off named

s44 named SBR-008 AC1; s45 fixed that and drove it green. Step 3 was **still** blocked, by a second
closed loop one layer up: `SectionRow`'s own script returned before `Outputs.built()` whenever the
section had no `data` field — which is every section the panel has ever created. Five sections,
five `Save` presses, **zero requests**, against the same button firing a `PUT` the moment a `data`
object existed. Registered and **fixed** as [D52](DEFECTS-THE-SITE-BUILDER-FOUND.md#d52); the
template's byte-equality gate passes (62/62).

🔴 **Three blockers, three closed loops, and each half looked correct alone.** The arm that found
all three was the same one: press the button, then read the **record** — never the input's echo.

### ⚠️ What still bounds this task

- **[D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) now bounds the drive itself.** The page editor does
  not scroll; at 1440×900, 3 of 5 section `Save` buttons are unreachable. This run continued at
  **1440×2600**, which a person cannot do. **A person on a laptop cannot author a five-section
  page.** s46 settled D40's harness-vs-product arm — it is the product.
- **SBR-007 AC3** ⬜ unchanged (D15), and now also the picker path.
