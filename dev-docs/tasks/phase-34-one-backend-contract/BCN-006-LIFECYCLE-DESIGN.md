# BCN-006 — The Token Lifecycle, in Prose

**Status:** 📋 **Drafted 2026-07-31, for review.** This is the deliverable BCN-006 step 1 asks for:
the design circulated *before* the machinery, because it is the expensive-to-reverse decision in the
task and the one with no precedent anywhere in this repo.

**Reviewer:** Richard.

**What it decides:** when a token is refreshed, who is allowed to refresh it, what happens to requests
caught in the middle, what a failure means, what two tabs do to each other, and what any of it means
during a server render.

---

## 0. Why this document exists at all

Everything else in phase 34 is a port. Data, files, filters, relations — the behaviour exists in this
codebase and the task is to put a seam under it. Auth is different in exactly one place, and it is not
the ten methods:

> Parse session tokens do not expire. Directus, Supabase and PocketBase all issue a short-lived access
> token with a refresh token beside it, and PocketBase and Supabase rotate the refresh token when you
> use it.

So there is no `refresh` to port. There is no scheduler to port, no queue, no lock, and no policy for
what a failed refresh means — because Parse never needed one and this codebase has only ever spoken to
Parse. Every line of it is new, and the failure modes are the kind that do not show up in testing:

- A 401-driven refresh works perfectly with one request in flight and fails the first time there are
  two, or the first time the network is slow.
- Two tabs refreshing a *rotating* refresh token invalidate each other, and the user is logged out at
  random, in a way nobody can reproduce, and it gets blamed on the backend.
- A refresh loop that treats a dropped wifi signal the same as a rejected token logs people out on
  trains.

None of those are caught by "does login work". They are caught by deciding the policy up front, which
is what this document is.

---

## 1. The shape of the answer

One controller, `TokenLifecycleController`, built once and driven by data.

BCN-001 already made this possible by declaring `TokenLifecycle` on the capability descriptor rather
than leaving it to be discovered per adapter. That decision is what stops this from becoming three
implementations inside three adapters that drift. This document is the other half of it: the
declaration says *what* a backend's tokens do; the controller is the single thing that *acts* on it.

```
       descriptor.tokenLifecycle          adapter
       {kind:'refresh', ttl, …}           performRefresh(session) -> Promise<AuthSession>
                    │                                    │
                    └──────────► TokenLifecycleController ◄────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
               SessionStore          scheduling            withSession(cb)
            (localStorage +          (a timer)             (the request gate)
             cross-tab events)
```

**The adapter never schedules anything.** It knows one thing the controller cannot: how to ask *its*
backend for a new token. It hands that over as a function and gets scheduling, single-flight, queueing,
retry, logout and cross-tab coordination for free. When BCN-004 lands the REST transport, adding
Directus is a `performRefresh` and a descriptor row — not a lifecycle.

**The controller never speaks a wire.** It has no idea what a refresh request looks like, which is the
only reason it can be unit-tested against injected timers with no network at all.

---

## 2. Scheduling: ahead of expiry, never on the 401

### The decision

Refresh is scheduled at `expiresAt - refreshBeforeExpiry`, from a timer armed the moment a session is
established. A 401 response is **never** a refresh trigger.

### Why

A 401-driven refresh means at least one user-visible request has already failed before anything is
done about it. It looks correct in testing because a single request retries cleanly. It fails as soon
as there are two requests in flight — one of them lost the race and there is nothing to retry it from
— and it fails on a slow connection, where the refresh does not land before the retry does.

Scheduling ahead turns a class of intermittent, un-reproducible bugs into nothing happening.

### Where `expiresAt` comes from

**The token is the authority; the declared TTL is a fallback.** Directus returns `expires`, Supabase
returns `expires_in` and `expires_at`, PocketBase returns a JWT whose `exp` claim is readable. If the
session carries an expiry, we use it. Only when it does not do we compute `now + accessTtlSeconds`
from the descriptor.

This matters because `accessTtlSeconds` in the descriptor is what the backend ships *by default*, and
every one of these backends lets an administrator change it. A declared TTL that overrode the token's
own would be wrong on precisely the instances that had been configured deliberately.

### Three things the clock does that a naive timer gets wrong

1. **`setTimeout` cannot express more than ~24.8 days.** A delay above `2^31-1` ms fires
   *immediately*, silently. PocketBase's 14-day default fits; a custom backend declaring 60 days does
   not. The controller clamps the delay and re-arms.
2. **A laptop that sleeps does not fire timers on schedule.** The timer is a hint, not a fact, so the
   callback re-reads the clock: if it fires early it re-arms, and every request also checks expiry
   before it goes out rather than trusting that the timer has already run.
3. **The system clock can move.** Same defence — the check is always "what does the clock say now",
   never "the timer said so".

---

## 3. Single-flight, and the request gate

### The decision

There is at most **one** refresh in flight per backend per tab. Requests that need a token while a
refresh is running **queue**; they do not each start their own.

The gate is `withSession(cb)`. Every request that carries a user's token goes through it.

### Why it is a callback and not a promise

`withSession` calls back **synchronously** when no refresh is needed. That is not a style preference,
it is the whole reason this can ship without changing Parse's behaviour: `ParseWireAdapter._makeRequest`
and `ParseAuthAdapter._makeRequest` are synchronous today, and on an `eternal` backend — Parse, the
built-in backend — the gate must be a pass-through with no observable change in ordering. A promise
would push every existing request onto a microtask and change the order in which twenty-five nodes see
their callbacks, in a task whose entire safety argument is that nothing moved.

So: **synchronous when there is nothing to wait for, deferred only when there genuinely is.** The
asymmetry is deliberate and is the single most load-bearing detail in the implementation.

### What "needs a refresh" means

| Situation | Gate behaviour |
|---|---|
| No session at all | call back immediately with no session — an anonymous request |
| `eternal` lifecycle | call back immediately, always |
| Session fresh (now < refresh-at) | call back immediately |
| Inside the refresh margin, token **still valid** | call back immediately **with the current token**, and start the refresh in the background if one is not already running |
| Token **expired**, no refresh running | start one, queue this caller |
| Token expired, refresh already running | queue this caller — **do not start a second** |
| Refresh just failed fatally | call back with no session; the session is gone |

The fourth row is the one worth arguing with, so it is stated rather than
implied: **a request inside the refresh margin does not wait.** The margin
exists precisely because the access token is still good throughout it, and only
the *refresh* token rotates — so holding a request back would add latency to buy
nothing. Queueing is what happens when there is genuinely no usable token, which
on a correctly scheduled lifecycle should be never.

### Why rotation makes this non-negotiable

With a rotating refresh token, using the refresh token invalidates it and mints a new one. Two
parallel refreshes therefore do not merely waste a request — the second one presents a token the first
one has already spent, the backend rejects it as invalid, and the honest reading of that rejection is
"this session is over". The user is logged out for no reason. Single-flight is not an optimisation
here; it is correctness.

---

## 4. Failure: what is a logout and what is not

### The decision

> **Only the backend can end a session. The network cannot.**

- The backend **rejects** the refresh — 400, 401, 403, or a body saying the refresh token is invalid
  or expired → **the session is over.** Clear it, emit `sessionLost`, fail whatever was queued with
  the backend's own reason.
- The refresh **could not be delivered** — offline, DNS, timeout, 5xx, a gateway page → **not a
  logout.** Retry with backoff.

### Why that line and not another

The refresh is scheduled ahead of expiry precisely so there is slack, and the whole point of slack is
to spend it on this. A user in a lift, on a train, or on a flaky hotel wifi has a perfectly valid
access token in hand; treating a failed *background* request as a reason to throw their session away
is the worst possible use of a margin that exists to absorb exactly that.

Retries back off (1s, 2s, 4s, 8s, capped) while the access token is still valid. Once the access token
has actually expired and a retry still cannot reach the backend, the session is unusable and it
becomes a logout — with a reason that says the backend could not be reached, not that the login was
rejected. Those are different sentences and a user can act on the difference.

### It must be observable, and it already is

A refresh failure surfaces through the `User` node's existing **`sessionLost`** output, which is a real
port today (`user.ts`) and is what the node already fires when a stored session turns out to be dead.
No new port, no new concept for a builder to learn: the app graph that already handles "your session
ended, go to the login screen" handles this too, and it never needed to know that the reason was a
rotation failure rather than a logout elsewhere.

### And a successful refresh emits nothing

Deliberate. `sessionGained` currently means "a stored session was checked and is alive", and graphs
wire re-fetches to it. Firing it every fifteen minutes would turn a Directus project into one that
re-queries the backend on a timer forever. A silent refresh is silent — that is what makes it a
refresh rather than an event.

---

## 5. Cross-tab: the storage-event lock

This is the classic way to log a user out at random, so the policy is written down rather than implied.

### The decision, in four rules

1. **The session lives in `localStorage`, so all tabs already share one.** Every tab reads the same
   session; nothing needs to be synchronised because there is only one copy.
2. **Only one tab refreshes at a time**, enforced by a lock key beside the session
   (`<sessionKey>.refresh-lock`) holding `{owner, expiresAt}`.
3. **A tab that does not get the lock does not refresh.** It waits for the winner to write the new
   session and adopts it.
4. **A tab that hears the session was cleared logs itself out**, which gives cross-tab logout
   propagation for nothing.

### How the lock works, and its honest limits

Acquisition is read → write → **read back**:

```
existing = read(lockKey)
if existing and existing.expiresAt > now and existing.owner != me:   → I am a follower
write(lockKey, {owner: me, expiresAt: now + 10s})
if read(lockKey).owner != me:                                        → I am a follower
→ I hold the lock; refresh
```

`localStorage` writes are serialised per origin, so in the racing case both tabs write and both read
back, and exactly one sees its own id. The loser discovers this **before issuing any request**,
because the whole sequence is synchronous with no `await` in it. That is what makes the residual risk
acceptable: the failure mode of a lost race is one tab doing nothing, not two tabs spending the same
refresh token.

It is not a mutex and this document does not claim it is. The residual risk is a same-millisecond
interleaving across processes on an implementation that does not serialise writes; the cost if it
happens is one wasted refresh, and the follower's wait-then-adopt behaviour means the user still ends
up with the session the winner wrote.

**The lock expires.** If the tab holding it is closed mid-refresh, the lock is stale after ten seconds
and the next tab to look takes it. A lock that could be held forever by a closed tab would be worse
than no lock.

### How followers hear the answer

The `storage` event. It fires in **other** tabs only — never in the tab that wrote — which is exactly
the semantics needed and is why this is preferred to `BroadcastChannel`: no echo to filter, no
availability question, and it comes free with the store already in use.

A follower waits for the new session up to the lock's TTL. If nothing arrives — the leader tab was
closed, or crashed — it tries the lock itself rather than waiting forever.

### What is deliberately *not* done

**No leader election.** No "one tab owns the session and the others proxy through it". It is more
machinery, it needs a heartbeat and a hand-over when the leader closes, and it buys nothing over a
short-lived lock for a job that happens four times an hour.

---

## 6. SSR: auth is a browser concept, and that is a decision

### The declaration

> **A server render always sees a logged-out user. The lifecycle never starts on a server.**

Under SSR (and inside the cloud runtime): the session store is empty and in-memory, `withSession`
always calls back synchronously with no session, no timer is ever armed, and no refresh is ever
attempted.

### Why declining is the right answer rather than a limitation

1. **RUN-002 ships one artifact that serves both SSR and SSG.** A server render that read a session
   and produced user-specific HTML would produce output that cannot be cached or pre-rendered — the
   two modes would stop being the same artifact, which is the property RUN-002 exists to preserve.
2. **The session lives in `localStorage`, not a cookie.** It is not sent to the server, by
   construction. Making it available to a server render means moving the session into a cookie, which
   is a security design (SameSite, CSRF, refresh-token exposure) and not a scheduling detail. Out of
   scope, and out of scope loudly rather than by omission.
3. **Timers in a server process leak.** A per-request lifecycle controller arming a fifteen-minute
   timer in a long-lived Node process is a memory leak with a user's refresh token in it.

This is not a new position — it is what the product already tells builders. The `User` node's own SSR
note reads *"Sessions live in browser storage; a server render always sees a logged-out user."* This
document ratifies that as the phase-34 rule for all five backends rather than a Parse-shaped accident.

**The consequence a builder can see:** a page whose server-rendered HTML depends on who is logged in
will flash the logged-out version first. That is the honest trade and the node help text should keep
saying so.

### The cloud runtime is the same rule for a different reason

In the cloud runtime each request has its own scope and a session arrives *with the request*
(`Request.UserId`), already validated. There is no persistent tab, nothing to schedule for, and the
next request will bring its own token. The rule is one sentence: **the lifecycle runs only where there
is a browser tab that outlives a request.**

---

## 7. `custom` — a *declared* lifecycle

Richard's 2026-07-31 answer to open question 4 made `custom` a **declared** backend: the user fills in
the capability descriptor themselves. BCN-001 recorded the consequence — BCN-006 must accept a
declared lifecycle, not only one of five known ones.

### What that means concretely

`TokenLifecycle` is already data. A declared lifecycle is the *same shape*, supplied from the Backend
Services panel instead of from a frozen descriptor. The controller does not care which it came from.

What changes is **trust**. A descriptor lifecycle was written against a backend somebody probed; a
declared one was typed by a person into a form. So a declared lifecycle is validated before it is
armed:

| Rule | Why |
|---|---|
| `accessTtlSeconds` must be a positive finite number | a zero or `NaN` TTL means a timer that fires forever |
| `refreshBeforeExpirySeconds` must be ≥ 0 and < the TTL | a margin larger than the lifetime means refreshing continuously from the first second |
| `refreshEndpoint` must be a non-empty string | an empty path refreshes against the backend's root |

**An invalid declaration falls back to `eternal` and reports once.** It does not throw, and it does
not half-arm. This follows the rule `customDescriptor` already states for its default: assuming a
refresh loop against an endpoint that may not exist produces background 404s on every custom backend
that never needed one — the loudest possible failure for the least possible reason.

---

## 8. What this design does *not* cover

Stated so the boundary is a decision rather than an omission.

- **The refresh wires themselves.** Four backends, four request/response shapes. They arrive with
  BCN-004's REST transport as four `performRefresh` functions, and none of them changes anything in
  this document.
- **OAuth redirect shapes.** Four of those too, BCN-006 step 5. A provider round-trip ends by
  *establishing* a session; from that moment this design owns it and does not care how it was
  obtained.
- **Permissions.** Phase decision: authenticating a user is in scope, what that user may read is the
  backend's own model.
- **Session sharing between backends.** A project with two backends has two sessions and two
  independent lifecycles. Nothing here is a step towards single-sign-on across a user's unrelated
  services, and it should not be read as one.
- **Server-side sessions of any kind.** §6.

---

## 9. Decisions for you

Everything above is implementable as written; these are the six where a different answer is
defensible and the consequence is not local.

| # | Decision | What is proposed | The alternative, and its cost |
|---|---|---|---|
| 1 | **A network failure is not a logout** (§4) | Retry with backoff while the access token is still valid; only a backend *rejection*, or a retry that outlives the token, ends the session | Simpler: any failed refresh logs out. Costs: users on flaky connections get logged out with a valid token in hand |
| 2 | **A silent refresh emits nothing** (§4) | No node output fires on a successful refresh | Fire `sessionGained`. Costs: graphs that re-fetch on it re-query the backend every TTL, forever |
| 3 | **A `localStorage` lock, not leader election** (§5) | Ten-second lock, read-write-read acquisition, followers wait then adopt | Leader election is genuinely atomic but needs heartbeats and hand-over for a job that runs four times an hour |
| 4 | **SSR always sees a logged-out user** (§6) | Declared, and it is already what the `User` node's help text says | Cookie-based sessions readable during a server render. That is a security design, and it breaks the one-artifact SSR/SSG property |
| 5 | **The token's own expiry beats the declared TTL** (§2) | Use `expires`/`expires_at` when the backend sends one | Trust the descriptor. Costs: wrong on exactly the instances whose admin changed the TTL deliberately |
| 6 | **An invalid declared lifecycle degrades to `eternal`** (§7) | Validate, fall back, report once | Refuse to connect. Costs: a typo in an optional field breaks a backend that works fine without refresh |

---

## 10. What ships in this pass, and what does not

Recorded here rather than only in the notes, because a design document that describes more than exists
is how the next task inherits a wrong premise.

**Built and under test:** the controller, the scheduler, the gate and its queue, single-flight, the
failure policy, the retry/backoff, the cross-tab lock and adoption, the SSR/cloud-runtime refusal, and
declared-lifecycle validation — all against **injected timers, clock and storage**, the
`byob-realtime.ts` precedent, with no network anywhere.

**Wired live:** to Parse and the built-in backend, both `eternal`, where the gate is the synchronous
pass-through of §3 and the controller schedules nothing. That is the *entire* observable footprint in
this pass, and it is deliberately the one that cannot change behaviour.

**Not built:** every `performRefresh`. There is no live refresh anywhere in the product until BCN-004
gives the Directus, Supabase and PocketBase adapters a transport. Until then §2 through §5 are a
tested design and not a shipped experience, and success criterion "a logged-in user stays logged in
across an access-token expiry" **cannot be claimed** — it needs the live pass against a short-TTL
backend that BCN-006 step 8 owns.
