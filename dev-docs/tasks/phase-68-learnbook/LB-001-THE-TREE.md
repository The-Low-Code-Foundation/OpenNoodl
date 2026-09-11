# LB-001 — the tree

**Surface:** platform · **Tier 1** · **Effort:** M/L · **Blocked on:** UNI-001 (accounts) existing;
UNI-004 (a booking row to reference — reference only, LB-009 does the attachment)

## Premise

The container everything else lives in: **Program → Module → Thread** (L3 — the naming is a
ruling; "lesson" is UNI-007's word, "section" became "thread" because the thing is one). A program
belongs to a coach and has participants (coachees, co-coaches). Threads are always
**coach-started**; replies are LB-002's job. Done-state rolls **up** (thread → module → program);
visibility flows **down** (LB-005 paces it). This task is the data model, the roll-up rules, and
the plain tree UI — deliberately boring, because everything later hangs off it.

## Scope (v1)

- **Program**: title, description, coach (owner), co-coaches, participants. A participant is a
  NodeGX account (UNI-001). A program *may* reference a UNI-004 booking row — nullable, reference
  only.
- **Module**: ordered within a program; title, optional description.
- **Thread**: ordered within a module; started by a coach; carries a `kind` —
  `discussion` (this task), `assignment`, `live-session` (both LB-006) — so LB-006 extends the
  enum rather than the schema.
- **Done-state**: a `discussion` thread can be marked done by coach or coachee at any time; a
  module is done when all its **visible** threads are; a program when all its visible modules
  are. `assignment` threads override this in LB-006 (validation-gated). Roll-up is **derived,
  never stored denormalised without an invalidation rule** — a reopened thread un-dones its
  ancestors.
- **Visibility flags** on module and program (hidden/visible), defaulting hidden — the *pacing*
  UX and notifications are LB-005; the flag lives here so nothing is retrofitted.
- **Tree UI**: coach view (full tree, hidden items marked) and coachee view (visible items only),
  with done-state shown at every level.

## Acceptance criteria

1. A coach creates program → modules → threads; a coachee sees exactly the visible subset, and a
   direct URL to a hidden thread 404s for them (not 403 — existence is also information).
2. Marking the last thread done cascades done up the tree; reopening it cascades back. Proved at
   the model layer with tests, not by UI inspection.
3. A second coach added as co-coach can do everything the owner can except delete the program or
   remove the owner.
4. A participant removed from a program loses access to every URL in it on next request.
5. The `kind` enum exists and `discussion` behaviour is the default path — LB-006 lands without a
   migration that rewrites existing rows.

## Not in v1

Reordering UX polish (drag-drop — buttons suffice), program archive/duplicate (LB-008), any
payment linkage (LB-009), cross-program moves.
