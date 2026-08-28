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
