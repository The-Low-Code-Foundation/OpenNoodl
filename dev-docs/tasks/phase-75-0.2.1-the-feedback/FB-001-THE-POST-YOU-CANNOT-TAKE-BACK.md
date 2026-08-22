# FB-001 — the post you cannot take back

**Filed:** 2026-08-22, from Richard's item 1a. **Status: 🔒 blocked on ruling D7.** Size: M.

> *"Right now in the community I can't edit or delete the questions I added to the bench."*

---

## What exists (swept 2026-08-22)

- **No mutation surface at all.** `nodegx-community/src/app/api/v1/bench/**` has no PATCH and no
  DELETE on threads or posts (only `same-here` has a DELETE). `src/lib/bench.ts` exports no
  edit/delete function.
- **The absence was chosen, twice.** `UNI-015-THE-BENCH.md` "Not in v1": *"no drafts, no edit
  history beyond an `updated_at`"*; P67 D19's Discourse exclusion list names *post revisions*.
- **The ruling that owns this is D7** (`phase-72-nobody-has-to-leave/README.md` ~200):
  *"Report/flag/delete-own — which of these ship."* Still open.

So this is not a regression — it is the chosen absence meeting its first real user. The task is
to answer D7 and then build the smallest honest version.

## Scope (proposed, pending D7)

1. **Edit own post body** — PATCH, author-only, stamps `updated_at`, no revision history (v1
   keeps D19's exclusion). The web thread shows "edited" from `updated_at`.
2. **Delete own thread** — only while it has **no answers from others**; after that it is part of
   someone else's record and the verb becomes *hide* or nothing (D7 decides). An accepted answer
   makes the thread definitively undeletable.
3. Editor mirror gets the same verbs or deliberately doesn't — **D15: both surfaces must agree**;
   shipping it web-only is a decision to record, not an accident.

## Acceptance criteria

- AC1: The author of a thread can edit their own question body; a non-author gets a tagged
  refusal, not a 404-shaped lie (D15 governs what a hidden thread reveals).
- AC2: The author can delete their own thread while it is unanswered; the list stops showing it;
  the refusal for an answered thread names why.
- AC3: Refusals follow the migration-tag pattern — and remember NAT-009's finding: **the refusal
  surface is bigger than its doc**; sweep the migration per function and state the bound in the
  spec.
- AC4: New routes comply with the `/v1` envelope (`tests/nat006-api-contract.test.ts` will
  enforce it) and get a route-inventory D15 verdict; writes go through the byte-capped
  `apiwrite.ts` path.

## Traps

- The four derived-from-disk platform gates fire on any new route; run the suite early, after
  `npm run build`.
- `updated_at` is the only history v1 keeps — do not quietly grow a revisions table; that
  reverses D19 and belongs in a ruling.
