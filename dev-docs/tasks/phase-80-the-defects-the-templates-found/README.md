# Phase 80 — the defects the templates found

**Richard, 2026-08-29:** *"Part of the main objective of creating this template is to uncover bugs a
builder might experience using NodeGX and fix them."*

Phases 76, 77 and 78 did the uncovering. **This phase is the second half of that sentence.**

🧭 **The phase boundary is Richard's to move.** These tasks could equally be folded into 0.2.1's
bug-fix phase or split by codebase. What they must not do is stay inside a template phase, because
a template phase closes when its template ships and these outlive it — which is exactly how phase
76's F15 and phase 77's D8 ended up being the same unowned defect discovered twice.

## Where this came from

[THE-SWEEP-2026-08-29.md](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md) — every one
of the 54 findings across the three phases, re-measured at HEAD, with an owner column. The result
that produced this phase:

| | |
|---|---|
| findings recorded across phases 76+77+78 | **54** |
| still real, product-side, and **unowned** | **17** |
| already carrying an owning task | **3** |

**Phase 76 is the control that makes this a process failure rather than a backlog.** Its findings
were fixed continuously — F10, F12, F13, F18, F22, F27 either landed in the session that found them
or became SB-010/SB-011. Phases 77 and 78 wrote theirs down and moved on. Same people, same rigour
in the measuring, opposite outcome in the fixing.

## The rule this phase exists to enforce

🔴 **A template-scoped test does not close a row.** SBR-015 is the worked example: *a cloud
function's `Failure` must reach a Response* shipped as a spec in one template's own suite. That
protects one template and **no user**. `validate.ts` still ships the hole, and that hole is DEF-002.

Every task here is graded on **the product surface** — the door, the runtime, the editor, the
defaults — and never on a template being fixed downstream of it.

## Ranking

🔴 **Ranked by who it bites, not by what it costs.** The trap is on record: *rank by the product
surface, not by a corpus* cost phase 18 twelve sessions, and its template-shaped version is ranking
by "what unblocks my template" when the objective is "what unblocks a builder".

| id | task | bites |
|---|---|---|
| **DEF-001** | [The defaults fail on the two controls every app has](DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md) | every **end user** of every app built here |
| **DEF-002** | [The door does not check connections](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md) | every **agent-authored app**, silently, failing shut |
| **DEF-003** | [Three authoring acts with no honest surface](DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md) | every **author** |
| **DEF-004** | [When it goes wrong you cannot see where](DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md) | anyone **debugging**; DEF-004b also corrupts data |
| **DEF-005** | [Membership is a category the graph cannot express](DEF-005-MEMBERSHIP-IS-UNEXPRESSIBLE.md) | every **membership app** — a whole market |
| **DEF-006** | [The design system punishes the agent that uses it](DEF-006-THE-DESIGN-SYSTEM-PUNISHES-ITS-USER.md) | every **agent** told to style on-system |
| **DEF-007** | [A project means one thing on disk and another once loaded](DEF-007-DISK-AND-LOAD-DISAGREE.md) | the **next template**, and every path that reads from disk |
| **DEF-008** | [The measurement owed](DEF-008-THE-MEASUREMENT-OWED.md) | nobody yet — it is a re-drive, not a fix |

## House rules

- 🔴 **Every task's acceptance criteria include a person's sentence.** That absence is the root
  cause of the whole situation ([P76's closing ruling](../phase-76-the-site-builder/NEXT-SESSION-PROMPT.md)).
- 🔴 **Never scope by time.** Richard, 2026-08-28: *"don't start talking about time… don't do
  ANYTHING related to a time limit."* Scope by dependency only.
- 🔴 **Grade known-good against known-broken.** A gate whose two arms agree has measured nothing —
  five ways an instrument lies, all on record from P67.
- ⚠️ **If the platform cannot express what an AC asks for, say so and record the gap** rather than
  quietly substituting something it can.
