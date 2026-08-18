# UNI-021 — replays you can actually watch

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §07 draws the poster grid, the duration badge and the chapter list. ⚠️ **Open it before writing
> markup.**

**Surface:** platform · **Tier 1** · **Effort:** S/M · ✅ **Blocked on nothing.**

# ✅ BUILT 2026-08-18, session 36

**The video library shows video, and a visitor who only scrolled past has asked nobody for
anything.** `0014` splits the URL into `provider`/`provider_id`, adds `duration_seconds`, and adds
`replay_topics`, `replay_speakers` and `replay_chapters`. `/replays` is a poster grid with duration
badges; **`/replays/[slug]` is new** and is where the player lives.

## 🔴 The activation is a NAVIGATION, and that is the whole mechanism

Pressing a poster goes to `/replays/<slug>?play=1`, and the iframe is rendered by the server on
that request and on no other. AC2 is therefore not a promise about a script's behaviour — it is a
fact about which HTML exists: **without `play`, there is no `<iframe>` in the document.**

⚠️ **The three alternatives were considered and are worse, and the first is the trap:**

- **a `<details>` facade** — browsers load an iframe inside a **closed** `<details>`, so the
  absence would be false while looking exactly like this;
- **a client component that swaps the frame in** — this site has one `"use client"` component and
  its one promise is that reading never asks for anything;
- **the provider's own thumbnail behind the play mark** — *"a thumbnail URL looks like an image and
  behaves like a tracker"*, which undoes the criterion without changing a word of it. There is a
  sweep asserting no source file mentions a thumbnail host.

✅ **And `?play=1` on a row with no provider renders nothing.** The page decides from the ROW, not
from the query.

## What each criterion cost

| AC | Result |
|---|---|
| 1 · both arms | ✅ in **one test**: a YouTube row embeds on `youtube-nocookie.com`; the `example.invalid` row renders `target="_blank" rel="noopener noreferrer ugc"` and no frame |
| 2 · no request on load | ✅ a sweep for `iframe`/`script`/`img`/`source`/`video`/`embed` with an off-site `src`, **plus two known-firing controls** — the same sweep over the playing page must come back non-empty, and over a hand-written embed |
| 3 · the columns render, the filter narrows | ✅ duration, topics, speakers and chapters on the page; the topic pill's count is true and the PAGE reads the whole query string |
| 4 · the bare row | ✅ `call-3` has no chapters, no speakers, no duration — asserted to draw with **no empty duration badge**, with the row that HAS one as the control |
| 5 · registered + seeded | ✅ in `MIGRATIONS`; the seed carries one row per branch and derives the provider with **the app's own recogniser** |
| 6 · presentation | ✅ the list archetype, no colour literal, four new contrast rows in both themes |

## 🔴 Three things worth carrying forward

**1 · `npm run db:seed` runs under `tsx` now.** The seed derives `provider`/`provider_id` by
calling `splitVideoUrl` — the same function the app reads with. A seed that parsed watch URLs
itself would be a **second recogniser**, and the copy living in a seed script is the one nobody
notices going stale. ⚠️ `scripts/provision-org.mjs` records the same cost and still pays it.

**2 · The replay block had to move down the seed file**, after the accounts: a speaker may *be*
somebody with an account here, so it reads `accounts` and cannot run before they exist. The
constraint caught it — `replay_speaker_is_an_account_or_a_name` refused two nulls — and the seed
now fails loudly on an unresolved handle rather than letting the CHECK explain a typo.

**3 · A replay has a page of its own, so the site now has NO same-page fragment links at all.**
`/replays#slug` was the only one. `tests/uni013-slice5.test.tsx` had a floor asserting at least one
fragment was checked; the **rule** survives (a fragment must land on an element) and the **floor**
is retired with the reason written in, because it could only ever fail from here.

**What the drive confirmed for this task:** `/replays` and a cold `/replays/<slug>` each contain
**zero** `<iframe>`; `?play=1` contains **exactly one**, on `youtube-nocookie.com`. The two
embeddable calls carry duration badges (52:08, 47:31) and posters linking to `?play=1`; the
`example.invalid` one carries **no badge** and links to its plain page. With the player on, the
embed plays a real video, the chapters render as `0:00 / 11:40 / 28:15` deep links, and the two
speaker branches both render — `@tom-teaches` as a link, *Richard Osborne* as plain text.


## ✅ DRIVEN OVER REAL HTTP, IN BOTH THEMES — and the drive found the one thing no gate could

`next build` + `npm start` on the seeded database, every page read back as **markup** and shot as a
**picture** in light and dark.

🔴 **THE FINDING: the house `⚠️` marker leaked into USER-FACING COPY.** `/university`'s closing
line read *"Every lesson above is being written. ⚠️ Nothing here is a download…"* — the marker is
the convention for a caution in a task file and a code comment, and it rendered as a literal
warning emoji mid-sentence on a public page. **Every suite was green, `check:css` was clean and
`tsc` was clean.** A page's copy is outside every gate this repository has; the browser look is the
only instrument that has ever caught this class, and this is its third catch in four sessions
(UNI-020's doubled level, UNI-013's unstyled-page trap, this).

⚠️ **AND THE THEME INSTRUMENT LIED THREE TIMES BEFORE IT WORKED**, which is worth more than the
screenshots:

| attempt | what it did | why it was wrong |
|---|---|---|
| `--blink-settings=preferredColorScheme=1` | `--dump-dom` reported `data-theme="light"` | the **screenshot from the same flag came back dark**, so one of the two readings was false and neither said which |
| hard-code `data-theme="light"` into a saved copy | page still dark | **the stamp script runs on load and overwrites it** — the test measured the stamp, not the CSS |
| delete the stamp from the saved copy | *"Application error: a client-side exception"* | React hydration replaced `<html>` and the page died — a third thing entirely |

✅ **What worked: CDP, seeding `localStorage['nodegx-theme']` before the document runs** — which is
exactly what a returning visitor has — **and reading the computed ground back out of the live page
in the same call as the screenshot**, so the image and the theme it claims are one measurement
rather than two. Light reports `data-theme=light` + `rgb(238,241,245)`; dark reports
`data-theme=dark` + `rgb(11,14,18)`. 🔴 **The light theme was fine all along** — the first three
instruments were the defect, and any one of them alone would have been written up as a bug.

---

## Premise

A video library that shows no video. Three rows of text, and the title is a bare
`<a href={r.videoUrl}>` with **no `target` and no `rel`** (`src/app/replays/page.tsx:23`) — so a
click replaces the page and hands the visitor to a third party with a referrer. ⚠️ **And the seeded
URLs are `example.invalid`**, so the click fails today regardless of the markup, which is how this
went unnoticed: the page has never been clicked successfully by anybody.

🔴 **It cannot be embedded, because the schema cannot say what to embed.** The whole table is
`slug, title, held_on, video_url, description, published_at` — a bare URL, with no provider, no id,
no duration and no topics. There is nothing to build a player out of and nothing to filter on.

⚠️ **UNI-009 deferred chaptering explicitly** (*"chaptered replays with per-node deep links … the
dream — deferred; a plain list is the v1"*). The plain list shipped and the deferral never got an
owner. **This task is that owner**, and chapters are the cheap half of it: one text column and a
timestamp, not a video pipeline.

## Scope (v1)

**The migration:**

- `replays.provider` + `replays.provider_id` — the URL split into the two things a player needs.
  ⚠️ Keep `video_url` as the canonical external link; the split is **derived and stored**, not a
  replacement, so an unrecognised host still lists and still links out.
- `replays.duration_seconds` — the badge on the poster.
- `replay_topics (replay_id, topic)` and `replay_speakers (replay_id, account_id | name)`.
- `replay_chapters (replay_id, ordinal, at_seconds, title)`.

**The page:**

- **A poster grid**, not a text list — the *list* archetype with a figure.
- **Click-to-load, in place.** The poster is ours; pressing play swaps in the provider's iframe.
  🔴 **Nothing is requested from a video host until somebody presses play** — a visitor who only
  scrolled past this page has made no request to anybody. This is the same posture as the
  double-blind relay in UNI-004, and it is also simply faster.
- **The poster is generated locally** — the dot grid and a gradient, no asset and no third-party
  thumbnail fetch. ⚠️ **Fetching the provider's thumbnail would undo the sentence above**, which is
  the trap: a thumbnail URL looks like an image and behaves like a tracker.
- **Chapters** under the player, each deep-linking to its timestamp.
- **Filters** by topic, plus text search — dimensions supplied here, bar owned by UNI-023.
- **Any remaining external link gets `target="_blank" rel="noopener noreferrer"`.**

## Acceptance criteria

1. **A replay with a recognised provider renders an embedded player after one activation, and a
   replay with an unrecognised host renders a link that opens in a new tab with `rel` set.** ⚠️
   **Both arms, in one test.** The second is the arm that will rot: it is the branch nobody looks
   at, and it is the one the seed hits today.
2. 🔴 **No request leaves for a video host on page load.** The assertion is over the **rendered
   HTML**: no `iframe`, no `script`, no `img` whose src points at a third-party origin, for a page
   listing N replays. ⚠️ Carry a **known-firing control** — a fixture that does embed on load must
   turn it red — because "no third-party request" is an absence, and an absence asserted with a
   broken instrument measures nothing.
3. **Duration, topics, speakers and chapters render from the database, and the topic filter narrows
   the page.** *Build the caller* — the filter must be reachable from the page, not only from a lib
   function's test.
4. **A replay with no chapters, no speakers and no duration renders cleanly.** 🔴 This is the row
   the seed will keep producing and the branch a poster grid breaks on first.
5. **The migration is registered in `MIGRATIONS`** (`src/db/migrate.ts`) — see UNI-020 AC4 — and the
   **seed carries at least one row per branch**: one embeddable with chapters, one unrecognised
   host, one with nothing but a title and a date.
6. **Presentation:** the list archetype (UNI-013 slice 5), no colour literal, per-theme contrast
   rows for any new role.

## Not in v1

- **No hosting our own video.** Provider embeds only.
- **No per-node deep links from the editor** — UNI-009 deferred it with chaptering; chapters land
  here, the editor half does not.
- **No transcripts and no captions.** Worth wanting; not this task.
- **No upload or admin UI.** Replays are seeded and inserted by hand.
- **No blob storage.** The poster is generated, precisely so this task does not wait on a decision
  nobody owns.

## Dependencies

| Needs | Why |
|---|---|
| nothing | 🔴 the generated poster is what keeps it that way — the alternative waits on blob storage, which is owned by nobody |
| **UNI-023** (soft) | the facet bar the topic filter hangs on |
| **UNI-013 slice 5** (soft) | the list archetype |
