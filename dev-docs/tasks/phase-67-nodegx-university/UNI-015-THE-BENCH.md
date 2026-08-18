# UNI-015 — the Bench: ask, read, answer, accept

**Surface:** platform · **Tier 1** · **Effort:** L · 🔴 **NOT BUILT.** Blocked on **UNI-014**
(delivery) for its notification half; the rest is unblocked.

> **D19** ([RULINGS.md](RULINGS.md)): built, not bought. **The pitch this was scoped from is an
> artifact — ["Questions Made of Nodes"](https://claude.ai/code/artifact/7ac9fdff-757c-4cd0-8a94-879ba5fa1509),
> with rendered specimens of the thread and the queue in full CSS.**
> 🔴 **Read it before writing markup.** UNI-013 lost a session to building from a task file's prose
> when the design was an artifact; this note exists so it does not happen twice.

## Premise

Four surfaces make this usable by a stranger: **ask · read · answer · accept.** Everything else in
the D19 tranche is an improvement to something that already works. This task is those four, and
nothing else.

⚠️ **It is deliberately the least distinctive task in the tranche.** The reason to build rather than
buy is UNI-016's artifact posts — but you cannot render a node inside a thread that does not exist.
Build this, then build the thing that justifies it, and **do not ship this one alone to strangers**:
plain-text Q&A on our own stack is strictly worse than Discourse, and shipping it on its own is the
one outcome that would prove the buy case right.

## Scope

- **`bench_threads` / `bench_posts`** — modelled on `relay_threads` / `relay_messages`, which
  already carry the shape: thread, author FK, body length constraint, `(thread, created_at)` index.
  🔴 **`created_at` is not an ordering key** — two rows in one transaction share `now()` to the
  microsecond. Follow `submission_gradings.seq` and add a `bigserial`.
- **Bodies are `Block[]`**, never markup. See §"The three-copy trap" — this is the sharpest reuse
  question in the task.
- **Accept an answer** → UNI-002's ledger **in the same transaction**, selected by `event_key`.
  🔴 Never a `switch (slug)`: UNI-002 AC4 is proved by a challenge invented at runtime, and a
  slug-cased consumer breaks it.
- **Report** → `content_reports` + `moderation.ts`, which are already generic and were never named
  for a surface.
- **D15 gate** via `communityGate` — an org-minor with `read_only` reads and cannot post; with the
  default they get a 404 and no explanation, per D15.
- **Reading works signed out** (D14 consequence 4), including a single thread's own URL.
- **Search**: Postgres full-text over bodies. Honestly worse than Discourse's ranking; UNI-016's
  facets are what buy it back.
- **A small fixed set of sections** — help, showcase, meetups. Not user-creatable (D19's chosen
  absences).

## 🔴 The three-copy trap — read this before reusing `parsePostBody`

`parsePostBody` → `Block[]` is built, specced against a 15-payload hostile corpus, and **lives in
the editor checkout** (`models/community/postbody.ts`). The platform needs the same grammar to
render what the editor sends.

This is the third instance of one pattern in this phase, and the previous two both bit:

| | The shared thing | What went wrong |
|---|---|---|
| UNI-006 | `LessonEvidence` allow-list | **Three copies, no test in either repo sees both** — recorded as a named, open gap |
| UNI-011 s1 | `renderMarkdown` vs `parsePostBody` | Safety rested on **a property of the consumer** (React's `setAttribute`), the exact thing the design existed to eliminate |

✅ **The call: the parser is PLATFORM-side and canonical, and the editor's copy is checked against
it by a shared golden corpus committed to both repos.** A copy is acceptable; an *unwitnessed* copy
is not. 🔴 **The corpus file must be byte-identical in both checkouts and a spec in each must assert
its hash** — the token-drift test UNI-013 shipped is the pattern, and its known hole is the lesson:
compare **every entry and its expected output**, never a count.

## 🔴 The Discourse decommission — 11 files, inventoried so nobody finds them later

Measured on `nodegx-community` at `201a71a`:

```
src/app/api/webhooks/discourse/route.ts     the receiver           → delete
src/lib/discourse-webhook.ts                signature + parse      → delete
tests/uni002-discourse-webhook.test.ts      its specs              → delete
src/db/sql/0001_init.sql                    forum_threads          → superseded, see below
src/db/sql/0002_uni002_contribution_engine  discourse event_keys   → re-point, keep the rows
src/lib/challenge-catalogue.json            challenge event_keys   → re-point
src/lib/contribution.ts                     award path             → caller changes, engine does not
src/lib/mirror.ts                           reads forum_threads    → re-point
src/app/api/v1/community/threads/route.ts   serves the mirror      → re-point
tests/uni011-mirror-api.test.ts             route sweep            → verdicts change
tests/uni005-data-inventory.test.ts         free-text census       → floor moves, see UNI-016
```

🔴 **`forum_threads` is not a forum and never was** — six columns (`external_id`, `title`,
`created_at`, `first_reply_minutes`) existing solely so D16's threshold had something to read.
**Do not migrate it. Re-point the threshold at the real tables and drop it.**

🔴 **AND THE MEANING OF ONE D16 BRANCH CHANGES.** UNI-011 slice 1 shipped
`{forum: 'absent'}` — a 200, distinct from `{threads: []}` — because `forum_threads` was written
only by the webhook receiver, so its emptiness was a fact about *our deployment* rather than about
the forum. **Once we own the forum, `absent` has no referent**: an empty Bench is empty, not
unconfigured. That branch must be **removed, not left unreachable**, and its spec must fail if
someone re-adds it. ⚠️ A branch nothing can produce is the shape of a check that cannot fail, which
this phase has now found four times.

## Acceptance criteria

1. **A stranger can read a thread with no session**, at its own URL, and an org-minor on D15's
   default gets a 404 with no reason in the body — both driven over HTTP, consequences written
   first, beside a known-firing control (a `read_only` minor gets 200).
2. **Accepting an answer awards points in the same transaction as the accept**, proved by a control
   that makes the award fail and asserts the accept rolled back with it. 🔴 The engine must not be
   modified — UNI-002's own *"twelve badges reachable"* and *"challenge invented at runtime"* specs
   must pass **unchanged**, which is what proves this is a new caller and not a new mechanism.
3. **The `Block[]` grammar is identical in both repos**, asserted by the shared corpus in each, with
   a control that mutating one copy fails the other's spec.
4. **No Discourse artefact survives.** A sweep asserts the eleven paths above are gone or re-pointed,
   and that `grep -ril discourse` over `src/` returns nothing. 🔴 The `absent` branch is asserted
   **removed**, with a spec that fails if it returns.
5. **Every pre-D19 spec passes unchanged.** Count by name against the 548-spec floor at `201a71a` —
   do not copy that total, re-measure it before you start.

## Not in v1

Everything in D19's chosen-absence list. Plus: no realtime, no typing indicators, no drafts, no edit
history beyond a `updated_at`, no per-section moderation roles.

## ⚠️ Sequencing

UNI-014 first (or alongside) for the notification half. **UNI-016 immediately after** — see the
warning at the top about shipping this alone.
