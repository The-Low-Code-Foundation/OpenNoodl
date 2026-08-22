# FB-014 — search that survives renames

**Filed:** 2026-08-22, from Richard's item 13's second half. **Status: ⬜ open — design +
prototype only, not a launch.** Size: M. Independent of R-chat (the bench benefits regardless).

> *"Maybe consider Postgres vector DB stuff for quick and easy vector searching of posts in the
> future? For both the bench and the chat. Will make it way easier to find relevant posts even
> if the node names or key words have changed in the future, so you might find something from
> years ago that solves your problem thanks to embedding and semantic vector searching."*

---

## What exists (swept 2026-08-22)

- **pgvector / embeddings: zero hits** in either repo — no extension, no migration, no
  dependency. Search today is Postgres FTS (`0008_uni015_bench.sql:170`,
  `to_tsvector('english', body)`) plus client-side `searchable()` filtering in `lists.ts`.
- Richard's motivating case is real and specific to this product: node names and port
  vocabulary **have already churned** across releases; FTS on a 2026 term will miss a 2025
  thread that solves the same problem.

## Scope — answer these in a design doc with a measured prototype, then stop

1. **Extension**: pgvector on the compose Postgres (dev, port 55432) and nexus-1. Availability
   on the prod box's Postgres version is the first check — it's a shared box with three live
   sites; installing an extension there is not free-of-blast-radius.
2. **Embeddings**: which model, computed where, costing what. ⚠️ Prod has **no
   `ANTHROPIC_API_KEY`** today (carried decision) and Anthropic doesn't sell a standalone
   embeddings endpoint — realistic candidates are a local model (no per-call cost, CPU on a
   shared box) vs a hosted embeddings API (a **new external processor** for user content: D9's
   DPA posture and the data-inventory census both fire — this is a Richard decision, not a
   config default).
3. **Write path**: embed on post-create + a backfill job; the projection-cache pattern from
   UNI-007 (claim the row before calling the model, never retry a failure automatically) is the
   proven shape here — reuse it.
4. **Query**: hybrid — FTS for exactness, vector for recall, rank-fused; the facet bar's
   machinery stays the container. The prototype's measurement: **does a renamed-vocabulary
   query actually find the old thread?** Seed the eval set with real renames from the release
   notes (e.g. pre/post port-vocabulary changes), not synthetic paraphrases.
5. **Bound**: bench posts first; chat only if R-chat lands. One `embeddings` table keyed by
   (kind, id), not a column per content type.

## Acceptance criteria (for the design phase — the build gets its own ACs after)

- AC1: the doc answers 1–5 with measurements (extension present on a nexus-1-shaped Postgres;
  embed+query latency; the rename-recall eval with numbers).
- AC2: the prototype runs against a copy of real bench data, behind a flag, on the dev DB —
  nothing ships to prod in this task.
- AC3: the external-processor question (2) is put to Richard as a written option pair with
  costs, not decided by default.
