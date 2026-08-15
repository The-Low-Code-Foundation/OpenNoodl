# Phase 68 — LearnBook (Track LB): the coaching space

**Created:** 2026-08-14, from phase 67 ruling **D13**
([../phase-67-nodegx-university/RULINGS.md](../phase-67-nodegx-university/RULINGS.md)). This phase
is **scoped now, built after phase 67's Tier 1 + UNI-004 land** — it consumes their accounts,
profiles, offers, roster and assignment machinery, none of which exists yet. Like phase 67's
platform tasks, almost nothing here lives in this repo: **the surface is the platform repo**
([The-Low-Code-Foundation/nodegx-community](https://github.com/The-Low-Code-Foundation/nodegx-community),
D1 stack — Next.js + Postgres + Drizzle, Docker on Hetzner). No editor-side code, no bridge.

## The premise, in one paragraph

Phase 67's D7 made **coaching sessions the only sellable at launch**, and UNI-004 built the
transaction: offer → booking → confirmation. This phase builds the **delivery**: a space where a
coach and a coachee (or a coaching group) do the actual work, synchronously and asynchronously.
The design is Richard's **LearnBook** — an app he built and used for real coaching, where it
worked. Rebuilt on the Community spine, it is available to *anyone* coaching or mentoring through
NodeGX Community (the R3 "open to anyone, Richard listed first" posture), not only to him.

## The shape, in one diagram

```
Program                      (a coach's offer, delivered; was "lesson" in LearnBook)
├─ Module
│  ├─ Thread                 (coach-started; a comment-tree exchange; was "section")
│  │   ├─ post: rich text (WYSIWYG, images, tables), audio/video, files,
│  │   │        references to other programs/modules/threads
│  │   └─ replies …          (coachee or coach)
│  ├─ Assignment thread      (coachee must reply, coach must VALIDATE — else nothing
│  │                          above it can complete; reuses UNI-006's state machine)
│  └─ Live-session thread    (video call URL + attendance marks)
└─ done-state rolls UP:      thread → module → program
   visibility flows DOWN:    coach reveals modules/programs; coachee is notified
```

**The mockup (2026-08-14):** [MOCKUP.html](MOCKUP.html) — a self-contained, static mockup of the
coaching space (also published as an artifact:
[claude.ai/code/artifact/f8bda33e…](https://claude.ai/code/artifact/f8bda33e-ddb5-4719-937a-5a3e8ee748ae)).
It draws only what this phase scopes: the tree with all three thread types, the exchange with rich
media, the progress/assignment/session rail, and a **coach ↔ coachee view toggle** demonstrating
LB-001/LB-005's visibility model. A legend at its foot maps every region to its LB task (LB-004
groups honestly not pictured — solo pair shown), and a "deliberately not in the picture" section
lists the L6/no-realtime/no-marketplace exclusions. Illustrative only — E1 may rename the surface,
and build still waits on phase 67 Tier 1 + UNI-004.

🔴 **The vocabulary is a ruling (D13), not a preference: Program → Module → Thread.** LearnBook
called these lesson/module/section. "Lesson" is **reserved** for UNI-007's editor-lesson format —
two products sharing that word is the two-vocabulary failure phase 67 spent a day cleaning up.
"Section" loses to "Thread" because the thing *is* a comment thread and the name should say so.

## The principles (inherited from phase 67, restated because they bind here)

1. **The login gates nothing in the editor.** LearnBook is a platform surface; it adds, never
   subtracts. A coachee's NodeGX account works everywhere else exactly as before.
2. **Monetisation is services** — LearnBook is the delivery rail for a service someone bought or
   was invited into. The platform's take-rate conversation stays where UNI-004 left it: later,
   and not for v1.
3. **Reuse the spine, never fork it.** One roster (UNI-005), one assignment state machine
   (UNI-006), one relay-grade email discipline (D8), one merchant of record (D7). A LearnBook-only
   duplicate of any of these is a defect, not a convenience.

## Decisions already made (2026-08-14 — do not re-litigate; amend D13 or this file instead)

| # | Decision |
|---|---|
| L1 | **Built on the D1 stack in the platform repo — not in NodeGX.** Three reasons recorded in D13: the spine is already there; D9's backend is a capped demo tier, not production storage; the feature list (WYSIWYG, MediaRecorder, attachments, push) sits exactly on the node library's gaps. 10× argument accepted |
| L2 | **The dogfooding is inverted, not discarded** — see "The second act" below |
| L3 | **Vocabulary: Program → Module → Thread**; "lesson" reserved for UNI-007's format |
| L4 | **Sequenced after phase 67 Tier 1 + UNI-004.** Dependencies: UNI-001 accounts, UNI-003 profiles, UNI-004 offers/bookings, UNI-005 roster, UNI-006 state machine, plus the notification subsystem this phase builds (LB-003) |
| L5 | **Org-minor accounts cannot enter coaching spaces at launch** — default-off, the D9-obligation-5 posture, until E3 is ruled. An adult in private threaded exchange with a minor is a safeguarding surface, and we do not open it casually |
| L6 | **Bought, not built:** the video call itself (any URL — Meet/Zoom/Whereby), calendar automation (Cal.com, per UNI-004). LearnBook stores the URL and the attendance marks, never runs the call |

## The rulings queue (Richard, one sitting — none blocks scoping, E2/E3 block their tasks)

- **E1 — the product name.** Is it "LearnBook" inside NodeGX Community, or does the surface get a
  Community-native name ("Coaching", "Spaces")? Copywriting, no architecture. Decide before LB UI
  copy is written, same as D3's currency name.
- **E2 — the sellable shape** *(blocks LB-009)*. D7 says coaching **sessions** are the sellable. Is
  a **program** (multi-session, space included) a Paddle product too, and does a purchase grant
  space access? Recommendation: yes — a program is the natural unit coaches actually sell — as a
  D7 amendment, not a workaround.
- **E3 — the org-minor posture** *(blocks lifting L5)*. If schools want coached programs: what
  visibility does the org admin get into a minor's coaching threads, and is one-to-one
  adult↔minor exchange allowed at all, or group-only? Needs the same seriousness as D10. Until
  ruled, L5 holds: off.
- **E4 — media quotas and retention.** Per-space storage cap, max clip length, whether recordings
  transcode or store raw, and what happens to media when a program is deleted. Recommendation:
  cap raw uploads (no transcoding pipeline in v1), quota per space, media lives as long as the
  space plus the E5 export window.
- **E5 — the exit window.** When a coaching relationship ends (completion, or either side leaves),
  how long does the coachee keep read+export access? ECO-004's "users' work must remain theirs and
  retrievable" reaches this data (D9 obligation 2 set the precedent). Recommendation: read access
  indefinitely, export always; deletion only on request.
- **E6 — notification channels for v1.** Email is certain; is PWA push v1 or the second tranche?
  Recommendation: email first (the infrastructure D8's relay already needs), push behind a flag —
  LB-003 is built channel-agnostic either way.

## What is deliberately NOT in this phase

- 🔴 **The second act — the NodeGX rebuild.** Recorded here so it is a plan, not a loss: once the
  node library gains the pieces LearnBook exposes as missing (rich-text editor, recorder,
  uploader, comment thread), the **coachee-facing frontend is rebuilt as a flagship NodeGX
  export** against the same platform API, and each missing piece ships as a **published prefab**
  on the shelf (UNI-005), earning Building badges (UNI-002). *Trigger, pre-registered:* the prefab
  gaps exist on the public shelf and one real coaching cohort has completed a program on the
  classic frontend. Not before — a janky rebuild demonstrates the ceiling, which is
  anti-marketing.
- **Real-time anything** — no live cursors, no presence, no in-app video. The exchange is
  async-first; the live session is a URL. (The ECO-001 lesson: phase 67 already parked real-time
  once.)
- **Marketplace features** — program discovery/browse, ratings, take-rate. Programs are reached
  from a coach's UNI-003 profile and UNI-004 offer, full stop.
- **LMS interop** (SCORM/LTI), same deferral as UNI-006.
- **Transcoding/streaming infrastructure** — raw capped uploads in v1 (E4).
- **Search** across programs/threads — v2; the tree is small enough to browse in v1.

## Standing constraints inherited

- Everything in phase 67's "Standing constraints" that touches the platform repo: the D8
  double-blind email discipline (no address leaks in headers, reply-to, bounces), D10's
  no-child-PII data inventory habit, append-only ledgers where events feed UNI-002 points.
- **GDPR posture:** coaching threads are personal data of both parties; media doubly so. Every LB
  task with storage carries an explicit retention/export answer (E4/E5) in its acceptance
  criteria — the D9 lesson: state the obligation at scoping time, don't discover it later.
- Editor-repo constraints (git discipline, gates) apply only if an LB task unexpectedly touches
  this repo; none is scoped to.
