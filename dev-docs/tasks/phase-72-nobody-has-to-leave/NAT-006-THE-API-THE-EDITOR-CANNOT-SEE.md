# NAT-006 — The API the editor cannot see

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | L |
| **Surface** | `platform` (`nodegx-community`) |
| **Rulings** | ✅ D3, D4 · 🔴 **D5 OPEN** (write auth) · 🔴 **D6 OPEN** (what stays browser-only) |
| **Depends on** | nothing on the editor side. 🔴 **Every Tier-3 task depends on this** |

## The job

This is the task that explains the whole review. The platform has **19 pages** and **15 API
routes**, and the editor's mirror is assembled from exactly two of them —
`/v1/community/home` and `/v1/community/threads`.

There is **no API at all** for:

| surface | page that exists | API |
|---|---|---|
| People | `/people` | ✗ |
| Profiles | `/u/[handle]` | ✗ |
| Jobs / RFPs | `/rfps`, `/rfps/[id]` | ✗ |
| Coaching | `/coaching` | ✗ |
| University | `/university` | ✗ |
| Tutorials | `/tutorials`, `/tutorials/[slug]` | ✗ (titles only, via `home`) |
| Replays | `/replays`, `/replays/[slug]` | ✗ (titles only, via `home`) |
| Orgs | `/orgs/*` | ✗ (D6) |

The launcher shows three sections because three is all the editor can see. Nobody under-scoped the
UI; the contract was never written. Write it.

## 🟡 Status — 2026-08-19 (phase 72, session 6): the READ surface is built and committed

`nodegx-community@126a0b6`. **AC1, AC2, AC3, AC4, AC6 and AC7 close. AC5 is specified and waits
on D5** — no write is built. Gates: `tsc --noEmit` clean, vitest **45 files / 1110 tests, 0
failures**.

| AC | State | Where |
|---|---|---|
| 1 — endpoints for the seven surfaces | ✅ | 10 routes under `/api/v1/community/` |
| 2 — one shape, declared once | ✅ | `src/lib/apishape.ts`, asserted over endpoints derived from disk |
| 3 — D15 per endpoint, 404, with a control | ✅ | verdicts in `tests/uni011-mirror-api.test.ts`; that sweep already carries the known-firing control |
| 4 — no wider than a signed-out browser | ✅ | `src/lib/apisurfaces.ts` + `tests/nat006-api-contract.test.ts` |
| 5 — writes specified, D5 answered first | 🟡 **specified, not built** | `docs/API.md` §6 — **D5 is the blocker and it is a ruling, not code** |
| 6 — rate limits and payload caps | ✅ | `src/lib/ratelimit.ts`, 120/min per caller per endpoint |
| 7 — a written contract lands with the code | ✅ | `docs/API.md` |

**The ten endpoints**, each reading through the function its page already calls: `people`,
`people/{handle}`, `rfps`, `rfps/{id}`, `coaching`, `tutorials`, `tutorials/{slug}`, `replays`,
`replays/{slug}`, `university`.

### 🔴 The finding worth carrying: the tidy implementation was the AC4 failure

Returning the shared read modules' own types is the obvious implementation and it **widens the
public surface**. `DirectoryEntry`, `PublicProfile`, `RfpListing` and `CoachingOffer` all carry an
internal **account UUID** that no page renders — a React Server Component emits HTML, so a field it
fetches and never prints leaves no trace, and the same field in JSON is published to every client.

So every surface is mapped in `apisurfaces.ts`, each mapper says what it drops, and the spec
asserts over **every endpoint** that no body contains a seeded account id — with a control that
feeds the check a leaky body and requires it to fire, and a second control asserting the bodies
were non-empty and the ids resolvable. ✅ **Ask of any read API: which fields does the page fetch
and not print?** That set is the leak, and nothing about it looks like a decision.

### 🔴 The second finding, which is not an API problem: a `Date` is sometimes a string

`personProfile` was written `b.earnedAt.toISOString()` because `HeldBadge.earnedAt` is declared
`Date`. It died in the D15 sweep on the value `2026-08-19 18:58:53.754123+00` — Postgres's own
text, unparsed.

🔴 **What decides it is the connection, not the query.** Reproduced deterministically: read badges
through the API pool (a `Date`), call `/v1/community/home` — which fans out enough concurrent
queries to make the pool open more connections — then read the same badges through a route (a
string). ⚠️ **The mechanism is NOT pinned down** and this file does not claim it is; postgres.js
resolves type parsers per connection and a connection that has not finished appears to return
values unparsed. The behaviour and its trigger are established, which is enough to code against.

⚠️ **The API did not introduce this.** `lists.ts` already wraps every date comparison in
`new Date(...)` and types one helper `Date | string` — somebody met this before and defended
locally **without writing down what they had met**. One site was still exposed: the `/people`
page's *"recently active"* sort called `.getTime()` on the raw value, which is a 500 on a live page
one pooled connection away. Fixed in the same commit.

🔴 **Still open, for whoever owns it:** `src/app/orgs/[slug]/assignments/page.tsx:32` does
`at.toISOString()` on a due date read the same way. Not touched — it is 67b/UNI-006 ground and this
task should not wander into it — but it is the same hazard and it is named here so the next reader
inherits the finding rather than the crash. The general repair is to make the driver's parsing
unconditional in `createSql`, and that needs its own measurement.

### What a reader should know before extending this

- 🔴 **`listArticles` moved out of `lists.ts` into `articles.ts`.** It was the last page-side query
  copy on the platform, which is the trap this task calls its highest-value structural decision.
  The page and the endpoint now share it; a spec asserts they return the same slugs.
- ⚠️ **`/v1/community/home`, `/threads` and `/threshold` do not comply with the envelope** and are
  not retrofitted — the shipped editor parses their shapes. They are listed by name in
  `tests/nat006-api-contract.test.ts`, so **anything else added under `/v1/community` must comply**.
- ⚠️ **Search, facets and sorts are not on the wire.** `facets.ts` computes a pill's count from the
  same rows the pill returns (UNI-023); a second filtering vocabulary on the wire is a second thing
  to keep in step. A client with a page of rows can filter them.
- 🔴 **The gate lives in the wrapper** (`serveCommunityRead`), so a route cannot forget it — and
  the per-route sweep is still what would notice a route written without the wrapper. The wrapper
  makes the mistake hard; the sweep is the measurement.
- ✅ **Verified red first.** The envelope check, the account-id check and the rate limiter were each
  handed their defect back: **5 of 14 failed**. A green contract spec on an unbroken tree proves
  nothing about whether it can see a break.

### What is left

1. 🔴 **AC5 needs D5, and D5 needs Richard.** `docs/API.md` §6 specifies the three writes Tier 3
   needs and what holds whatever D5 decides. That is the whole of the remainder for this task.
2. ⚠️ **D6 still decides the long tail** — orgs, assignments, shelf, admin. Nothing was built for
   them and nothing was quietly dropped.
3. ⚠️ **NAT-007..011 can start on the read half now.** The reply path is the part that waits.

---

## Acceptance criteria

1. `/v1` list and detail endpoints for **people, profiles, RFPs, coaching, University, tutorials
   and replays**, each returning the fields its editor surface actually renders — decided by
   reading the corresponding page component, not guessed.
2. **One shape, declared once.** One pagination convention, one error envelope, one "you are not
   allowed to see this" answer, across all of them. Seven endpoints that each invented their own is
   seven client adapters in the editor.
3. 🔴 **D15 is enforced per endpoint, and it 404s.** A viewer the platform refuses does not get an
   empty list and does not get a 403 that names the resource — `apiviewer.ts` answers 404
   *precisely so a pupil is not told a door exists*. Asserted per endpoint, **beside a
   known-permitted control on the same route**, because "returned 404" and "the route does not
   exist" are indistinguishable from a single measurement.
4. **A signed-out reader gets what a signed-out browser gets** — no more, no less. The web pages
   are the specification of what is public; the API must not widen it because JSON felt internal.
5. Writes required by Tier 3 (post a reply, respond to an RFP, request coaching) are specified
   here even if built later, and **D5 is answered before any of them ship**: the device-token flow
   was scoped for identity, not for posting.
6. Rate limiting and payload caps exist on every new route before it is deployed. An editor that
   polls is a client that hammers.
7. A written contract document lands with the code — the editor is a second client and the next
   one will be written by somebody reading this, not reading route handlers.

## Traps

- 🔴 **The web pages read the database directly.** These are React Server Components; most of them
  query in the page body. Adding an API means the same question is answered in two places, and the
  page and the endpoint will drift. Extract the query into a shared module and have **both** call
  it — do not copy the SQL. This is the highest-value structural decision in the task.
- 🔴 **`/v1/community/home` deliberately excludes threads** (its own header: a home that fetches
  threads as part of its payload is a home that is slow for the one thing that changes most). Do
  not undo that reasoning by building the new endpoints as one fat `/v1/community/everything`.
- 🔴 **D6 is open and it decides how much of this table gets built.** Orgs, assignments and shelf
  items are 8 of the 19 routes and were not named in the review. Do not build API for them
  speculatively — and do not quietly drop them either; the recommendation is an explicit
  "opens in your browser" affordance, which is still a decision someone has to make.
- ⚠️ **`notify()` has a `'relayed'` outcome** meaning "UNI-004's relay already mails this, do not
  queue a second". Any new write path that triggers a notification must pick its outcome
  deliberately — and 🔴 **no queue on this platform is drained in production**: `drainOutbox` has
  no caller, `outbound_emails` has neither drainer nor transport. That is
  **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)**, which can run in parallel with this
  task. A write that queues mail nobody sends is a feature that silently does nothing.
- ⚠️ **Do not design phase 67b's UNI-017 out of the thread endpoints.** Triage for unanswered
  questions and a *"same here"* signal stay in 67b, but they are reads and a write on the same
  thread resources this task is shaping. Leaving room costs nothing now; retrofitting a signal onto
  a shipped endpoint costs a migration and a second version. ⚠️ Room, not implementation.
- ⚠️ Some of these surfaces carry personal data (people, profiles, coaching bookings). D9 of
  phase 67 already put a retention, export and DPA obligation on the platform. An API that exposes
  a member directory to a desktop client is squarely inside it.
