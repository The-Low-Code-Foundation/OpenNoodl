# NAT-010 — Coaching without a browser

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `editor`, `core-ui`, `platform` |
| **Rulings** | ✅ D4 · 🔴 **D5 OPEN** · ⚠️ inherits P67 **D9** |
| **Depends on** | **NAT-005**, **NAT-006** |

## The job

`/coaching` exists, has no API, and — the platform's own note — was nearly linked from nowhere at
all; it survives in the site nav because a reachability test failed the route. A surface that the
*website* almost lost is certainly invisible from the editor.

Coaching is the highest-intent thing in the community: someone is stuck enough to ask a human for
time. That moment happens in the editor, in front of the graph that is not working.

## Acceptance criteria

1. Browse what coaching is offered, and by whom, in the editor — linked to NAT-008's profiles
   rather than restating who people are.
2. **Request a session from the editor** (🔴 D5), including whatever the web form collects, with
   the same validation. A request that succeeds in the editor and is rejected by the platform is
   worse than a link.
3. See your requested/booked sessions and their state.
4. Reaching a session — a call link, a calendar file — is where leaving the editor is **correct**
   and the UI says so plainly. P1's "footnote, not mechanism" rule cuts both ways: a video call is
   not something the editor should host, and pretending otherwise is worse than an honest hand-off.
5. Booking notifications actually send (same drainer trap as NAT-009).
6. D15, and the standard four states.

## Traps

- 🔴 **A coaching booking is a calendar event containing two people's availability and a topic** —
  personal data with a retention question attached (P67 D9). Do not cache it to disk by default;
  D8 covers this and it is the sharpest case in the phase.
- 🔴 **Coaching may be paid.** If it is, nothing about payment goes anywhere near the editor
  client in this task — the hand-off to the web is the whole answer for the money step, and that
  needs stating rather than discovering.
- ⚠️ **Timezones.** A booking surface in a desktop app in an unknown locale, rendering times the
  server computed. Every time shown states its zone, and the round trip is driven from a machine
  set to a non-UTC zone. This is not a detail; it is the defect this class of feature always ships.
- ⚠️ The relay path again — coaching is the other half of UNI-004's `'relayed'` outcome.
