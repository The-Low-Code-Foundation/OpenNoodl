# UNI-021 — replays you can actually watch

> 🔴 **THE DESIGN IS AN ARTIFACT, AND THIS FILE IS NOT IT.**
> **["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)**
> — §07 draws the poster grid, the duration badge and the chapter list. ⚠️ **Open it before writing
> markup.**

**Surface:** platform · **Tier 1** · **Effort:** S/M · ✅ **Blocked on nothing.**

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
