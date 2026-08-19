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
  deliberately — and 🔴 **`outbound_emails` has no drainer** (phase 67b). A write that queues mail
  nobody sends is a feature that silently does nothing.
- ⚠️ Some of these surfaces carry personal data (people, profiles, coaching bookings). D9 of
  phase 67 already put a retention, export and DPA obligation on the platform. An API that exposes
  a member directory to a desktop client is squarely inside it.
