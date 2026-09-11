# FB-023 — the pool that forgets how to read a date

**Filed:** 2026-08-23 (session 10), **found by driving FB-001's editor half**, which it blocked
for most of that session. **Status: ✅ FIXED AND DRIVEN, session 11.** Owner: platform
(`nodegx-community`).

> **Session 11 changed three of this file's claims.** The mechanism is no longer under-claimed —
> it is isolated, named, and reproducible in five lines. The population was **wrong**: three
> `/api/v1` routes poison the pool, not one, which made fix candidate #2 a **non-fix**. And the
> web is **not** immune for the reason given. The original text is kept below with corrections
> marked, because how it was wrong is the reusable part.

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

---

# ✅ SESSION 11 — the mechanism, isolated

## Root cause, in five lines

`drizzle-orm@0.36.4/postgres-js`'s `construct()` **mutates the client you hand it**:

```js
// node_modules/drizzle-orm/postgres-js/driver.js
const transparentParser = (val) => val;
for (const type of ['1184', '1082', '1083', '1114'])   // timestamptz, date, time, timestamp
  client.options.parsers[type] = transparentParser;
```

It does that deliberately — Drizzle maps dates itself and wants the raw string. But the mutation
lands on the **client**, permanently, so every later `` sql`…` `` on that client reads a
`timestamptz` as a `string`.

🔴 **And the second half is why it looked like flakiness.** postgres.js resolves
`parser: parsers[type]` **once**, when it Describes a statement, and caches the resolved function
on a **per-connection** statement cache (`connection.js` `RowDescription`, line 660;
`statements[query.signature]`, line 632). A statement a connection prepared *before* the mutation
keeps its good parser forever. Only statements first prepared *after* it come back wrong.

That is the whole of the "3-cycle", the `max=1` result that disproved the first model, and the
probes that "did not reproduce cleanly". Deterministic proof, one connection:

```
A  before drizzle      : Date
parsers[1184] before   : parse
parsers[1184] after    : transparentParser
A  after  drizzle      : Date     <- same query text: cached statement, unchanged
B  after  drizzle      : string   <- a query this connection had not prepared: POISONED
```

## 🔴 The population was wrong — and it killed fix candidate #2

The filed text says `/api/v1/community/home` is *"the **only** `/api/v1` route that wraps the
shared pool in Drizzle"*. It is not. `serveCommunityRead` (`apiread.ts:54`) hands **`apiSql()`** to
every read route, and `listArticles` / `getArticle` call `createDb` too. Driven against a built
server, each of the three on a **virgin pool**:

| poisoner (one GET), then 20 × `GET /bench/threads/:id` | 500s |
|---|---|
| *(control — no poisoner)* | **0/20** |
| `/api/v1/community/home` | **20/20** |
| `/api/v1/community/tutorials` | **20/20** |
| `/api/v1/community/tutorials/{slug}` | **20/20** |

⚠️ **The editor's Community panel draws TUT-004's installable tutorials**, so it calls the
tutorials route as well. Dropping Drizzle from `communityHome` alone — candidate #2 as written —
would have left the editor **exactly as broken** and looked like a fix.

## 🔴 20/20, not 13/20 — the original measurement's own control had inoculated the pool

Session 10 measured 13/20 because it ran *"20 thread reads BEFORE"* first, which prepared that
statement on every connection while the parsers were still good. Session 11 hit the same trap in
its first arm — tutorials read **0/20 failures** until the warm-up was removed, which read as
*"tutorials is innocent"*. ✅ **A warm-up control does not just observe this bug, it prevents it.**

## The old text, kept for the record

### The mechanism, as far as it was actually measured

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
| **the web** | ⚠️ **Right answer, wrong reason.** Every page calls `createSql()` at **module scope** — long-lived, not per request (20 of them). `bench/[threadId]/page.tsx` is immune because it has **its own** pool and never calls Drizzle on it. `src/app/page.tsx` and the two tutorials pages **do**, and their pools *were* poisoned — see AC4 below. |
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

## Acceptance criteria — all met, session 11

Commit: `nodegx-community` (see below). Driven against a **built** server (`next start -p 3200`)
on its own database, plus a regression file in the suite.

- ✅ **AC1** — after each of the **three** poisoning routes, 20 consecutive
  `GET /api/v1/bench/threads/:id` return **200** (table above; control 0/20, poisoned 20/20
  before the fix, 0/20 after all three).
- ✅ **AC2** — the `PATCH` arm, asserted as **accepted**, not as "not 500":

  | | before the fix | after the fix |
  |---|---|---|
  | control, no poisoner | `200 {"editedAt":…}` | `200` |
  | after `/community/home` | **`400 "that could not be posted"`** | **`200`** |
  | after `/community/tutorials` | **`400 "that could not be posted"`** | **`200`** |

  🔴 The 400 was **re-measured on the reverted code**, so the instrument is known-firing rather
  than assumed to be.
- ✅ **AC3** — `tests/fb023-drizzle-poisons-the-pool.test.ts`, 8 rows. **Mutation-verified: 7 of 8
  go red on the reverted code.** Every row is a *sequence on one pool* — each function is correct
  alone, so any row that reset between the two halves would be green on the broken code.
  - ⚠️ **The first draft had a vacuous row.** *"the date survives as a Date"* read the test's own
    `freshDb()` client — a client no route ever poisons — and so **passed on the broken code while
    appearing to assert the mechanism**. Repointed at `apiSql()`; it now goes red. Same family as
    session 10's `loaded` column: *ask what else produces this reading*.
  - The one row that stays green on broken code is deliberate: *"nothing outside `src/db/index.ts`
    constructs Drizzle"* guards the **next** regression, not this one.
- ✅ **AC4** — the sweep. Every raw Date read on a poisoned client returns a `string`, silently:

  ```
  A clean pool       rfp= Date   | thread= Date   | raw created_at= Date
  B after createDb   rfp= string | thread= string | raw created_at= string
  ```

  So the population is not "some columns" — it is **every Date column on any client Drizzle has
  touched**. `threadById` was merely the one that called `.getTime()` and therefore threw.
  - 🔴 **The web's own pools were in it too.** All 20 pages call `createSql()` at **module scope**;
    `src/app/page.tsx` (`homeRails`) and the two tutorials pages then call Drizzle on that pool, so
    their raw readers — `listThreads`, `listRfps`, `callDatesFrom`, `listDirectory` — were reading
    strings from the first request onward.
  - ✅ **And the consequence there was nil, which is worth recording rather than assuming.** Five
    pages (`/`, `/bench`, `/rfps`, `/replays`, `/tutorials`) rendered **byte-identical** before and
    after the fix — the only diff on each was Next's build id, 2 lines. ⚠️ **Bound:** five pages,
    signed out, one seed. Nobody has checked a signed-in render or the org pages.

## The fix, as shipped

**Candidate #1, in its structural form: `createDb()` takes no client at all.**

```ts
// src/db/index.ts
export function createDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!cachedDb) { drizzleSql = createSql(); cachedDb = drizzle(drizzleSql, { schema }); }
  return cachedDb;
}
export async function resetDb(): Promise<void> { … }   // freshDb() calls it
```

Why not just hand Drizzle a second client at the four call sites: **the trap is the parameter.**
Four call sites already existed and three of them had fallen into it. A `createDb` that cannot be
given a pool cannot poison one, and the guard row above keeps `drizzle()` itself in one file.

🔴 **Candidate #4 (coerce in `toPost`) would have been the worst outcome available** — it fixes
the one call site that throws and leaves the whole AC4 population silently wrong, with the only
alarm switched off.

⚠️ **Cost, stated plainly:** a second pool of `max: 4`, so the API surface can hold 8 connections
rather than 4. Drizzle is never inside a `sql.begin` transaction anywhere in this codebase
(checked: `profiles`, `coaching`, `notifications`, `bench` — all raw), so splitting the pool
cannot split a transaction.

⚠️ **`resetDb()` is not optional in tests.** `resetSchema` drops the enum OIDs this pool's
connections resolved at connect time, which is the `XX000 cache lookup failed` trap `resetApiSql`
already documents. `freshDb()` calls both.

## Gates

- Community suite on the fixed tree: **55 files / 1321 specs / 0 failures** (session 9 was
  54 / 1313 — reconciles as +1 file / +8 specs, this file). `npm run typecheck` clean.
- ⚠️ **Not deployed.** nexus-1 is still `8d40b63`; this now joins `9ecec25`, `fd695ae` and
  `080a4f1` as unshipped. **Richard's call.**
