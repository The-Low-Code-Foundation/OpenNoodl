# NAT-013 — What it does with no network

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `editor` |
| **Rulings** | ⚠️ **D8 OPEN** (caching policy — it is a privacy decision) |
| **Depends on** | **NAT-007** through **NAT-011**; specified early, verified last |

## The job

P3, made real. NodeGX's claim is local development — *"one of the only tools that truly promises
local and open source app building"*. This phase bolts a remote resource into the middle of that
tool. If pulling the ethernet cable makes the editor look broken, the phase has spent the promise
to buy the feature.

Every community surface states what it does with no network: what is cached, how stale it is, and
what simply is not available. And **nothing** presents an outage as an empty community.

## Acceptance criteria

1. **D8 is answered before anything persists**: what is cached, where on disk, for how long, and
   what a user does to clear it. This is user data on a local-first tool — a directory of people
   and a coaching booking are not the same decision as a list of tutorial titles.
2. Every surface renders a **distinct** offline state. 🔴 `unreachable` and `empty` never collapse:
   "nobody has posted" and "your wifi is off" are the same picture and opposite fixes, and UNI-011
   already bought this bug once at the `loading`/`empty` boundary.
3. Cached content **says it is cached and says when from**. A three-day-old thread presented as
   current is worse than no thread.
4. Every write path degrades honestly. A reply typed offline is **kept**, and the user is told it
   did not send. Nothing is silently queued into a thing with no drainer.
5. The editor **starts, opens a project and works normally with the community unreachable**. Driven
   with the network actually down — not with a mocked failure, because a mock cannot reproduce a
   hang, and a hang is the failure mode that makes an app feel broken.
6. No community fetch blocks editor startup or project open. Asserted by driving cold start with a
   black-holed endpoint (a *timeout*, not a refused connection — they are different failures and
   only one of them is slow).

## Traps

- 🔴 **A refused connection and a timeout are different measurements.** Testing only the fast
  failure proves the fast failure. The slow one is what users experience on a hotel network.
- 🔴 **Caching a directory of people to every user's laptop is a data-protection decision**, not a
  performance one — P67's D9 binds the platform to retention and export obligations, and a local
  cache is a copy outside them. NAT-008's trap and this one are the same trap seen from two sides.
- ⚠️ **`await filesystem.writeFile()` is a no-op with a dead error path** in this codebase — 13
  known sites, where a failed write reads as successful. A cache layer that uses it will report
  writing a cache it never wrote, and read misses will look like cold starts forever.
- ⚠️ D15's hidden viewer must stay hidden offline. A cached "you are refused" is still refused; a
  cache that falls back to the permitted shape when it cannot check has opened the door.
