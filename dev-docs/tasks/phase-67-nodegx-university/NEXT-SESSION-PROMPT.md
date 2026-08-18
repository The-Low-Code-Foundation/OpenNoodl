# Next session — phase 67 (NodeGX Community)

**Written 2026-08-18 (session 36).** The visual tranche is done: **UNI-023, UNI-021, UNI-022 and
the twelve badge artworks all landed.** What is left of the phase is the close, and none of it is
code.

---

# Paste this

> Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`. **The visual
> tranche is finished — do not re-do it.** Read `README.md` §"the close" and
> `CLOSING-THE-PHASE-RICHARDS-LIST.md`; what remains is **E10 (the GitHub OAuth app — ten minutes,
> Richard's), a Brevo sending domain, and actually running the deploy in `ops/`.**
>
> 🔴 **Platform work is `/Users/richardosborne/vscode_projects/nodegx-community`** — a sibling
> directory, never nested. None of the OpenNoodl checkout's gates or traps apply there.
>
> **Before any code: take your own floor.** `npm test` in the platform repo and **quote the
> summary line**. Session 36 measured **32 files / 873 tests / exit 0** before its work and
> **35 files / 976 tests / exit 0** after (321s on a quiet machine) — but a number quoted from a handover is a number measured
> under somebody else's load.
>
> 🔴 **ONE VITEST PROCESS AT A TIME, and do not edit a file while a run is in flight.** Both cost
> session 36 real time: two overlapping runs give `type "profile_visibility" does not exist` and
> `duplicate key … pg_type_typname_nsp_index` bursts across unrelated files (every DB spec drops
> and rebuilds `public`, and `fileParallelism: false` does not help — it serialises files *within*
> one run). A mid-run edit produces a failure that does not reproduce.
>
> ⚠️ **Order is `npm test` → `npm run db:seed` → `npm start`.** The suite wipes the dev database,
> and a server left running across the wipe holds a pool against a dropped schema.

---

# 1. What landed, in one line each

| | |
|---|---|
| **UNI-023** | One facet engine (`src/lib/facets.ts`) serving six lists. Search is a `<form method="get">`, sorts are links, facets are multi-select — and **the rows and every pill's count come out of one function**, so a count cannot drift from what clicking returns. `0013` added `profiles.rate_band` and `profile_skills`. |
| **UNI-021** | `0014` splits the video URL into `provider`/`provider_id`, adds `duration_seconds`, `replay_topics`, `replay_speakers`, `replay_chapters`. **`/replays/[slug]` is new** and the player lives there: pressing a poster navigates to `?play=1`, and the iframe is server-rendered on that request and no other. |
| **UNI-022** | `/university` is the curriculum. `src/lib/curriculum.json` holds fifteen lessons in three paths; per-lesson state, node chips, derived progress. |
| **UNI-013 slice 4** | Twelve badge SVGs, generated from **four family marks and one tier rule** by `scripts/draw-badges.mjs`. |

---

# 2. 🔴 One thing needs Richard, and it is not blocking

**The four family marks.**
📐 **[The Twelve Marks](https://claude.ai/code/artifact/359b212c-b97d-4ee0-9b46-655a29d3a604)** —
the four marks at 92px, the tier rule, all twelve at the size a profile draws them, and a
light/dark pair. **Three questions at the end**, and none is about the twelve:

1. Do the four marks land? *Learning* is the one to argue about — a book is a different visual
   world from nodes and wires.
2. Is the tier rule quiet enough, or too quiet?
3. Anything to add to the vocabulary? A fifth family is a path definition and a re-run.

⚠️ **They are already shipped and rendering.** A change is four edits and
`node scripts/draw-badges.mjs`; nothing waits on the answer.

---

# 3. 🔴 What session 36 found that outlives its tasks

**A `max(timestamptz)` comes back as a STRING.** A plain `timestamptz` column comes back as a
`Date`. `lastActivity()` typed the aggregate as `Date` and a sort comparator died with
`b.lastActiveAt?.getTime is not a function` — **a page-level crash from a value that typechecked.**
Coerce at the boundary whenever the select is an aggregate.

**The ledger says A lesson was finished, not WHICH.** UNI-022's scope assumed per-lesson ticks were
derivable from `points_ledger`. `challenge_id`, `family`, `tier`, `delta` and a free-text `reason`
that defaults to the challenge title — **no lesson identity anywhere.** The count is derivable; the
ticks are not. ⚠️ **The fix is not a `lessons_completed` column**, it is a lesson identity on the
event — and **nothing calls `recordEvent` with `lesson.completed` at all** today, so the gap is in
front of the syllabus rather than behind it. The absence is asserted so nobody adds ticks they
cannot justify.

**A prose sweep cannot tell a prohibition from an offer.** D17's *"nothing here is a route a lesson
arrives through"* was first asserted by grepping the page for `download` — which found the page's
own comment saying there is none, then the **visible sentence** saying so. Twice. 🔴 **The natural
fix is to delete the sentence, which is the test editing the product.** A route is a link: sweep
`linksInPage` and the data's field names.

**A multi-select pill's ACTIVE href turns it off.** The natural round-trip assertion measures the
toggle, not the filter.

**A deferred scope row written as an ASSERTION fired the same day.** UNI-023 shipped `/replays`
with no topic legend and wrote `expect(replays.facets).toEqual([])`; UNI-021 added the column an
hour later and it turned red, naming exactly where the row had been waiting. Better than a TODO.

**The `⚠️` marker leaked into user-facing copy.** `/university` shipped *"Every lesson above is
being written. ⚠️ Nothing here is a download…"* — the marker is the house convention for a caution
in a **task file and a code comment**, and in JSX it is just text. Every suite green, `check:css`
clean, `tsc` clean. 🔴 **A page's copy is outside every gate here** — third catch of this class in
four sessions.

**🔴 The light-theme instrument lied three times before it worked, and the theme was fine.** Any
one of the three alone would have been written up as "the light theme is broken":

| attempt | why it was wrong |
|---|---|
| `--blink-settings=preferredColorScheme=1` | `--dump-dom` said light, the **screenshot said dark** |
| hard-code `data-theme="light"` into a saved copy | **the stamp runs on load and overwrites it** |
| delete the stamp from the copy | React hydration replaced `<html>`; *"Application error"* |

✅ **What works** (script in session 36's scratchpad as `shoot.mjs`): CDP on a **private port — not
9222**, `Page.addScriptToEvaluateOnNewDocument` seeding `localStorage['nodegx-theme']`, navigate
**twice** (localStorage is per-origin and `about:blank` is not it), and read
`getComputedStyle(document.body).backgroundColor` back **in the same call as the screenshot**, so
the image and the theme it claims are one measurement. Node 22 has a global `WebSocket`, so this
needs no dependency. Light is `rgb(238,241,245)`; dark is `rgb(11,14,18)`.

**A 120s tool timeout promotes a run to the background and reports exit 0 with an EMPTY log.** The
same command re-run gave **2 failed**. Never accept a pass from a run whose summary line you have
not read.

---

# 4. ⚠️ Two gates that will bite the next person

**New text columns need a data-inventory row AND a probe.** `tests/uni005-data-inventory.test.ts`
censuses every free-text column in the live schema and fails on anything unclassified — seven of
session 36's columns. A `minor-refused` row additionally needs an executed probe.

**New exports in an event module need a notification verdict.**
`tests/uni014-notifications.test.ts` reads the exports out of `contribution.ts`, `rfps.ts`,
`coaching.ts` and `assignments.ts` and fails on any that carry none.

---

# 5. What the close still needs

Unchanged from session 35, and none of it is in this tranche:

1. **E10 — the GitHub OAuth app.** Ten minutes, Richard's. Nobody on earth can make an account
   until it exists.
2. **A Brevo sending domain**, and the `openssl` command for the link secret.
3. **Run the deploy.** 🔴 **`ops/` EXISTS and has never been run** — nexus-1, systemd rather than
   Docker, and it curls three neighbouring sites and exits non-zero if any of them moves.

⚠️ **The close list stays at ten items.** UNI-020/021/022/023 and slice 4 are all built and **none
of them joined it** — they were the cheapest remaining things that make the site less of a
placeholder, not things the close needed.

---

# 6. ⚠️ Housekeeping

**`MEMORY.md` is over its 17,510-char budget** (~20k at the end of session 36, and it was ~19.5k at
the start). Session 36 added ~770 chars net and compressed one line rather than deleting anybody
else's traps. It needs a real pass by somebody willing to move detail down into the pointer files.
