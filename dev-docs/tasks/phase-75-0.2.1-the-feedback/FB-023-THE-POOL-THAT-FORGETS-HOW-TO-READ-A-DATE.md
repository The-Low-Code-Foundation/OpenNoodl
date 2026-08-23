# FB-023 — the pool that forgets how to read a date

**Filed:** 2026-08-23 (session 10), **found by driving FB-001's editor half**, which it blocked
for most of that session. **Status: ⬜ OPEN, not fixed.** Size: S to fix, but the choice of fix
is a ruling. Owner: platform (`nodegx-community`).

🔴 **This is not FB-001's defect.** It predates it and lives in the UNI-011 mirror API. FB-001
is merely the first task that drove the editor hard enough to meet it.

> **In one line:** once the editor's Community panel has loaded, the platform stops being able
> to read `timestamptz` on the shared pool — thread reads 500, and **edits are refused as if the
> user's text were bad**.

---

## The measurements

All taken on **committed code** (`080a4f1`), a production build (`next start`), one seeded
database, `apiSql()`'s pool at its default `max: 4`.

### Reads

```
20 thread reads BEFORE any /api/v1/community/home call
  → 200 ×20

… one GET /api/v1/community/home …

20 thread reads AFTER
  → 500 500 200  500 500 200  500 500 200  500 500 200  500 500 200  500 500 200  500 500
  → 13/20 FAIL, in a repeating 3-cycle
```

Server-side: `TypeError: a.updatedAt.getTime is not a function`, `src/lib/bench.ts:212`
(`threadById`'s `toPost`).

### Writes — and this arm is the serious one

Same request, same row, **one thing varied**: whether `/api/v1/community/home` ran first.

| | response |
|---|---|
| clean pool | `200 {"editedAt":"2026-08-23T09:12:58.394Z"}` |
| after one `/community/home` | **`400 {"error":"that could not be posted"}`** |

🔴 **The write path does not crash — it REFUSES.** The editor draws the platform's own sentence,
so the person is told *their post was not accepted*. They would rewrite it and it would fail
again, for as long as the pane stayed open. A 500 announces itself; this one blames the user.

⚠️ This is precisely the *failure-indistinguishable-from-refusal* shape `apiviewer.ts` warns
about in its own header — arriving **in production** this time rather than in a suite.
`refusalResponse` has a total default, so an unrecognised database error becomes a bare 400.

## The mechanism, as far as it was actually measured

**Using Drizzle on a postgres.js connection leaves later raw `` sql`…` `` queries on that same
connection reading `timestamptz` as a `string` instead of a `Date`.**

`/api/v1/community/home` is the **only** `/api/v1` route that wraps the shared pool in Drizzle
(`src/lib/mirror.ts:187`, `createDb(sql)`), and it issues its queries inside a `Promise.all`, so
it touches several pool connections at once. With `max: 4` and `/api/v1/me` having already used
one connection, the observed 3-cycle is what a partly-poisoned pool looks like.

⚠️ **UNDER-CLAIMED ON PURPOSE.** Probes under `tsx` did **not** reproduce cleanly — ordering that
poisoned a connection in one arm left it healthy in another, and an early "connections born under
Drizzle" model was **disproved** by a `max=1` run in which every arm failed. The exact
postgres.js/Drizzle interaction is **not isolated**. What is solid is the reproduction above and
the fix check below; treat the sentence in bold as the shape, not the root cause.

### The fix check (this is the strongest evidence)

Giving Drizzle its **own pool** — a one-line local change, `createDb(createSql())` — makes both
symptoms vanish together:

```
thread reads after /community/home : 200 ×12
PATCH        after /community/home : 200 {"editedAt":…}
```

That change was **reverted**; the repository is clean. It is a candidate, not a decision.

## Why nothing caught it

| population | why it is immune |
|---|---|
| **the web** | `bench/[threadId]/page.tsx` calls `createSql()` **per request** and never uses Drizzle beside a raw read. Same function, same rows, 200 every time. |
| **the vitest suite** | `freshDb()` + `resetApiSql()` mean no spec shares a Drizzle-touched connection with a later raw read. |
| **the editor** | ❌ **not immune.** It is the only client that calls `/community/home` *and* `/bench/threads/:id` against the same long-lived pool. |

✅ **The control that separated them was driving BOTH paths against the SAME thread.** The web
page 200'd and the API route 500'd on the same row, which is what ruled out the data and the
fixture and pointed at the pool.

## Blast radius

Any raw read of a Date column on the shared `apiSql()` pool after `/community/home` has run.
`threadById` is only the one that calls `.getTime()` and therefore **throws**; a Date that is
merely serialised would silently change type in the JSON the editor is handed, with no error
anywhere. **Nobody has swept for those.**

## Acceptance criteria

- AC1: After `GET /api/v1/community/home`, 20 consecutive `GET /api/v1/bench/threads/:id` on the
  same server return 200 — driven against a built server, not a spec calling handlers.
- AC2: The same, for a `PATCH` of a post body. 🔴 The arm that matters is that it is **not
  refused**: a spec asserting "not 500" would pass on the 400 that caused this to be filed.
- AC3: A regression test that would fail today. ⚠️ It must run against a **shared, long-lived
  pool** — a `freshDb()` spec cannot reproduce this, which is why the defect exists.
- AC4: The sweep the blast-radius section names: every Date column read raw off the shared pool.

## Fix candidates (a ruling, not a preference)

1. **Give Drizzle its own pool** — measured above, both symptoms gone. Cost: two pools.
2. **Drop Drizzle from `communityHome`** and use raw sql, as every other `/api/v1` route does.
   Removes the only mixed-mode caller rather than accommodating it.
3. Warm every connection before use. Fragile — depends on the internals nobody has isolated.
4. ❌ Coerce with `new Date(...)` in `toPost`. **Symptom only** — leaves every other Date field
   silently wrong and hides AC4's population.
