# Phase 68 — the tasks (LB: LearnBook)

**Created:** 2026-08-14 out of [README.md](README.md) and phase 67's ruling
**[D13](../phase-67-nodegx-university/RULINGS.md)**. Read the README's diagram, the six decisions
(L1–L6) and the rulings queue (E1–E6) first. **Surface is the platform repo throughout** — no
editor code, no bridge, nothing on the user's machine.

🔴 **This phase does not start until phase 67's Tier 1 + UNI-004 exist** (accounts, profiles,
offers/bookings, and — for groups — UNI-005's roster). Scoping it now is deliberate: three UNI
tasks carry D13 notes so they are built reusable, and the vocabulary ruling (L3) is only free
before both products ship.

| Task | One line | Tier | Effort | Consumes / honours |
|---|---|---|---|---|
| [LB-001](LB-001-THE-TREE.md) ⭐ | Program → Module → Thread: the data model, done-rollup, and who-sees-what | **1** | M/L | L3 naming; UNI-001 accounts; UNI-004 booking reference |
| [LB-002](LB-002-THE-COMPOSER-AND-THE-THREAD.md) ⭐ | the exchange itself: WYSIWYG (images, tables), replies, cross-references | **1** | L | L1 (bought editor component, not built) |
| [LB-003](LB-003-NOTIFICATIONS.md) ⭐ | the notification subsystem: email + (flagged) PWA push, unread, digests, mutes | **1** | M/L | E6; D8 email discipline; **platform-wide, not LearnBook-only** |
| [LB-004](LB-004-GROUPS-ON-THE-ROSTER.md) | coaching groups as a use of the one roster; invite by email; composition | **1** | M | 🔴 UNI-005's roster — never a second group system |
| [LB-005](LB-005-VISIBILITY-PROGRESS-AND-SESSION-NOTES.md) | coach reveals modules (coachee notified); progress overview; private session notes | 2 | M | LB-001's visibility model; LB-003 |
| [LB-006](LB-006-ASSIGNMENTS-AND-LIVE-SESSIONS.md) | assignment threads (coach must validate) + live-session threads (URL + attendance) | 2 | M | 🔴 UNI-006's state machine, human grader — never a fork; L6 |
| [LB-007](LB-007-RICH-MEDIA.md) | audio/video recording, file attachments, object storage, quotas | 2 | L | E4; capped raw uploads, no transcoding (L6 spirit) |
| [LB-008](LB-008-TEMPLATES-AND-CLONING.md) | program templates: clone a tree to a coachee/cohort without rebuilding it | 2 | M | UNI-005 shelf for org-shared templates |
| [LB-009](LB-009-THE-PROGRAM-AS-A-SELLABLE.md) | Paddle purchase → space access; the booking→space attachment | 3 | M | 🔴 **blocked on E2** (extends D7); UNI-004's booking rows |
| [LB-010](LB-010-SAFEGUARDING-MODERATION-AND-EXIT.md) | report flows in threads, the org-minor gate, export and the exit window | 2 | M | L5 (default off), E3, E5; D10's data-inventory habit |

**Effort is per-v1-slice, not per-dream** — every task file carries a "not in v1" list.

## Suggested order, and why

**LB-001 + LB-002 are the product.** A tree you can't converse in is a filing cabinet; a thread
with no tree is a chat app. They land together as the walking skeleton: one coach, one coachee,
one program, text-only exchange, manual done-marking.

**LB-003 immediately after — and it is bigger than it looks.** Nothing else in the platform has
email/push infrastructure with unread state; UNI-004's relay is the only email machinery specced
anywhere. Build it as a *platform* subsystem (events in, channels out) — UNI-006's "notify the
member with feedback" and D8's relay want the same rails.

**LB-004 when UNI-005's roster exists; LB-010's gate ships with it.** The moment groups exist,
the org-minor question is live — L5's default-off gate is part of LB-004's acceptance, with
LB-010's fuller treatment following. Solo coach↔coachee pairs don't wait for this.

**LB-005 + LB-006 make it coaching rather than a forum.** Visibility pacing, progress overview,
session notes, and the assignment machine are what made LearnBook work as a practice.

**LB-007 and LB-008 are the quality-of-life pair.** Media makes the exchange rich; templates make
the coach's second cohort cheap. Both are separable from the skeleton on purpose — text-only
LearnBook is already usable for real coaching.

**LB-009 last among the buildables, blocked on E2.** Until then the UNI-004 v0 stands: booking
ends in an email, and the coach attaches the space by hand.

## The checks before starting any task here

1. **Phase 67 state**: are UNI-001/003/004 actually live, and UNI-005 if the task touches groups?
   The phase-67 lesson applies — read source and the deployed platform, not status columns.
2. **The E-queue**: E2 blocks LB-009; E3 blocks lifting the org-minor gate; E1/E4/E5/E6 have
   recommendations in [README.md](README.md) and can be ruled at the sitting where their task
   starts.
3. **The D13 notes landed in phase 67's tasks** (UNI-004/005/006) — verify the reusability they
   promise actually got built, before assuming it.
