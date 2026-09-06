# REL-019 — The tabs left behind (Community and Learning, before 0.2.2)

**Opened 2026-09-06, session 59.** Richard, verbatim:

> 1. The community tab in the launcher STILL doesn't have the ability to add chat or add yourself
>    as a 'person', and it still looks like shit compared to the rest of the launcher
> 2. The learning tab has the lessons 'en vrac' without any numbering or ordering. The first lesson
>    is actually the LAST lesson of the spine. It needs to be better ordered and filterable, clear
>    which tutorial deals with what and why you should try it or not
> 3. The 'your path' tab still shows the spine with 'explain this to me' that doesn't work and you
>    can't actually click any of the spine steps to open the tutorial.
> 4. There's still nothing in the 'tutorials' tab, nothing in the 'replays' tab (we can add this
>    community meetup video: https://www.youtube.com/watch?v=k_dPltcIGrU and this is the tutorial
>    we should see: https://www.youtube.com/watch?v=fqmHH36ndc0
>
> Basically the community and learning tabs are sad, they've been left behind despite numerous
> times I asked them to get some TLC.

This is the **third** time two of these have been named (chat and the People button — s33 recorded
*"He noticed all eight"*). ✅ When the person paying names a thing twice, it is a ROW.

## 1. What was actually wrong — measured, not inherited

Every claim below was read off the running editor (signed in as `@richardosborne14`) and off
production, before anything was changed. Screenshots of the before state are in
`verdicts/rel-019/2026-09-06/` (see §5).

| # | Richard's words | The cause | Where |
|---|---|---|---|
| 1a | "can't add chat" | 🔴 **A missing wire.** `useCommunityChat` has composed `composer` and `reply` since `66b5f1df` (this morning), `CommunityChatView` has drawn them since `e39393c1` — and `ProjectsPage`'s host object never carried the one to the other. Two green gates on the ends of a chain, and no gate on the chain. | `ProjectsPage.tsx` chat pane |
| 1b | "can't add yourself as a person" | 🔴 **Production runs the 28 Aug build.** `/etc/nodegx-community/deployed.json` on nexus-1 stamps `91d8b0c`; `GET /api/v1/me/listing` (REL-015, `e5735d9`) answers **404 HTML** there, which the card draws as *"Could not check whether you are listed. The community may be unreachable."* The editor's card is built and green (`rel-015` 21/21); the route is not deployed. | nexus-1 |
| 1c | "looks like shit" | The head was 13px muted text with "Refresh" floating at the far edge; the readout was three sentences; the browser door was a lone button under everything. The Projects tab draws the same person as a card with an avatar. | `Community.tsx` + scss |
| 2 | "en vrac … the first lesson is the LAST" | `LearningFolderModel.list()` sorts by `installedAt` newest-first; the seed installs the eight bundles in directory order in one pass, so **Snacks** (spine 8) led and **Your creature, on screen** (spine 1) was last. `spine.json` ships beside the bundles and **nothing read it**. | `learningfolder.ts:447`, `lessonseed.ts:381` |
| 3a | "can't click any of the spine steps" | The step had no control at all — a `<li>` with text and one "Explain" button. The platform's steps and the shelf's cards carry the **same slugs** and no code joined them. | `LearnerPathSection.tsx` |
| 3b | "'explain this to me' doesn't work" | `POST /me/path/project` answers `unavailable` — *no projector is configured* on nexus-1 (`projector.ts:189`). The button stayed on all eleven steps after the first refusal, each saying the same sentence. | `useLearnerPath.ts` |
| 3c | *"None of them can be installed yet"* over eight lessons this build ships | `curriculum.json` still says `state: "in-writing"` for all thirteen spine lessons. The deployed build also predates lesson 2 (`it-breaks-on-a-phone`), so the path shows 11 steps, not 12. | community repo |
| 4a | "nothing in tutorials / replays" | Both tables are **empty in production** (`/api/v1/community/home` → `replays: [], articles: []`). Nothing was ever published. | production DB |
| 4b | (found while looking) | 🔴 The launcher opened a tutorial at `${COMMUNITY_URL}/articles/${slug}` — **the web has never served `/articles/`**; the route is `/tutorials/[slug]`. Every guide anybody clicked would have opened a 404. Same shape as `/bench/undefined` before NAT-007. | `ProjectsPage.tsx` |
| 4c | (found while looking) | A **video tutorial has no home on the platform**: `articles` has no video column and the tutorial page renders `body` as plain paragraphs (`paragraphsOf`), so a YouTube link would be dead text. Replays already embed via `splitVideoUrl` + `?play=1`. | community repo |

## 2. What was built — all in OpenNoodl, all driven

### 2.1 Community (items 1a, 1c, 4b)

- **The chat composer and reply box are wired** into the launcher's chat pane. Driven: a draft typed
  into the starter enables "Say something" (nothing was sent — a test post is visible to everyone).
- **The head is an identity card** in the account card's exact shape: 28px avatar with initials,
  handle, `N points · N badges`, and the actions (Sign in when signed out · Refresh · Open
  community.nodegx.io) on the right. The lone door at the page foot is gone.
- 🔴 **A signed-out reader has a door.** The head used to say *"sign in below to post"* and there was
  nothing below — the account card is on the Projects tab. `onSignIn` is the same device flow.
- **The health readout is three tiles** (value over label). ⚠️ The WORDS are unchanged — D21's
  readout is graded on them (`4 of 30 threads`, `(n=3, 1 unreplied)`, `target under 24h`).
- **Media rows carry a drawn poster** — a play mark on a gradient for a replay with a recording, a
  page glyph for a written guide, a dimmed mark for a call whose recording is not posted.
  🔴 **Drawn, never fetched**: the host's thumbnail is *"an image that behaves like a tracker"*
  (the platform's own replay page refuses it). Opening the tab asks no video host for anything.
- `CommunityArticleRow.videoUrl?` and `MirrorArticle.videoUrl?` — OPTIONAL, so today's platform
  (no column) draws a written guide and the patched one (§4) draws a video row with "Video" in the
  meta line.
- `/articles/` → `/tutorials/`.
- The chat starter reused `.ThreadReply`, built for the bottom of a thread pane: no gutter, a top
  rule, a card-wide `<select>`. Inside the card it sat 14px outside everything else — the exact
  defect the People search box had on 2026-08-20. Same fix: the control carries the card's gutter.

### 2.2 The shelf (item 2)

- **`models/lessonchain.ts`** reads `spine.json` from the shipped-lessons root (the seed's own
  resolver, split out as `defaultShippedPorts()`) and walks `needs` from the head. 🔴 **Read, not
  declared** — a second list of the eight slugs in the editor would be the copy that drifts, which
  is exactly what `spine.json`'s own note records catching in `curriculum.json` on 09-05.
- **`toLearningCards(entries, chain)`**: spine first in chain order with `position`, then
  standalone, then the rest as the register gave them. ⚠️ `EMPTY_CHAIN` reproduces the old shelf
  byte-for-byte in behaviour — asserted as the reverted arm.
- 🔴 **Two witnesses for "which lesson is this"**: the `shipped_<slug>` id, AND the title slug —
  because the seed **stands down** on a title collision (AC3), and Richard's own shelf has *Your
  creature, on screen* and *Log a thing* installed by hand with no shipped copy beside them. A shelf
  that numbered only shipped ids would have left lesson 1 unnumbered on exactly his machine.
- **The section draws**: the spine number in the same 22px disc "Your path" uses · `Spine · lesson
  N` / `Standalone · any time` · a **"Next on the spine"** block naming the first not-completed spine
  lesson with *Start here* (this is the "why you should try it" for the one card that has an answer)
  · a **Next up** chip on that card · `N of 8 on the spine done` in the head · a **filter row**
  (All · The spine · Standalone · In progress · Completed) with counts, pills with nothing behind
  them not offered. Filter state lives in `Learning.tsx` — the section is walked by specs and may
  not hold state.

### 2.3 Your path (item 3)

- **A step with an installed copy opens it** — the title is a button and there is a `Start this
  lesson` / `Continue` / `Open again` button under it. The join is `installedStepsFrom(lessons)`
  keyed by slug, computed once in `Learning.tsx`, the one place both lists are in hand.
- 🔴 **The installed copy's state outranks the platform's standing on screen** (`In progress · 40%`
  where *In writing* would sit) — a step saying "in writing" beside a button that opens it is a
  contradiction a learner cannot resolve.
- Under the platform's truth sentence (kept verbatim — it is the platform's to change and it is
  graded verbatim) the launcher adds its own: *"7 of these lessons are already installed on this
  machine — open them from the list below."* Drawn only while the platform counts `ready === 0`.
- **"Explain this for me" is withdrawn from every step** once the community answers `unavailable`
  or `refused` — those are decisions about the community/account, not the step, and eleven buttons
  saying the same sentence is what Richard met. Driven: 11 buttons → 0 after one click, note shown.

### 2.4 Readings, with exit statuses

- `tests-unit/rel-019/` — **6 files, 51 specs**: `lesson-chain` (walks the REAL `spine.json` and
  pins it to the directories on disk) · `shelf-order` · `shelf-render` · `path-open-render` ·
  `community-head-render` · `launcher-wiring` (source gates on the wires, because that is the layer
  that broke).
- With the neighbours (`fb-004 fb-006 nat-005 uni-007 fb-013 rel-015 nat-007 nat-008`): **26 suites
  / 487 EXIT=0** and **33 / 719 EXIT=0** on the earlier pass.
- 🔴 **Two mutants, both red, both restored byte-identical by md5**: chapter rank zeroed →
  `shelf-order` 3 red; `composer:` line deleted from `ProjectsPage` → `launcher-wiring` 1 red.
- Renderer webpack (ts-loader, the editor's own typecheck path): **compiled successfully, 0 `tsl`
  errors** after the last edit.
- `test:main` (full editor jest, after the dev stack was torn down): **439 suites / 7287 tests,
  0 failed, "Ran all test suites."** (s39 read 432 / 7218 on the settled tree before this row).
- Driven in the real editor via CDP, signed in, before and after: chat draft enables the submit;
  explain buttons 11 → 0; path steps show `Installed`/`Start this lesson`; shelf opens on lesson 1
  with *Next on the spine*.

## 3. 🔴 What is NOT done, and why — read this before the board

🔴 **Every edit to `~/vscode_projects/nodegx-community` was DENIED by the session's permission
classifier** — an `Edit` of one JSON value, a `grep` in that tree, a Python write. The platform
half of this row could not be built from this session, and a production deploy on top of that would
have been an outward-facing act on a repo the session could not even read reliably. So items 1b, 3c
and 4 are **handed over with the exact steps**, not marked done. ✅ `ssh` to nexus-1 DID work this
session (`SSH_OK`), so the "blocked" claim in the harness memory did not reproduce today either.

## 4. The platform half — the steps, in order (Richard, or a session allowed to edit that repo)

All paths are in `~/vscode_projects/nodegx-community`, currently clean at `63e72b2`, four commits
ahead of what nexus-1 runs.

### 4.1 Mark the eight shipped lessons ready (item 3c)

In `src/lib/curriculum.json`, set `"state": "ready"` on exactly these eight (all in the `spine`
path): `your-creature-on-screen`, `it-breaks-on-a-phone`, `poke-it`, `it-forgets-you`,
`show-what-it-feels`, `moods`, `it-gets-demanding`, `snacks`. Leave the other five spine lessons and
both side paths `in-writing`. `standingOf` derives *needs X first* from the chain, so no other field
changes.

Two tests assert the old world and **were written to fail on this day** (their own words: *"When
somebody writes the first lesson this test fails — and the failure is the notice"*):

- `tests/uni022-syllabus.test.ts:215` — replace `all.every(l => l.state === 'in-writing')` with:
  the eight above are `ready`, every other lesson is `in-writing`, and no `ready` lesson `needs` an
  `in-writing` one (the chain is contiguous from the head).
- `tests/uni007-intake-and-pathing.test.ts:261` — `pathFor(VISUAL)` now has `ready === 8`, and
  `truth` matches `/8 of the \d+ lessons on your path are ready to install/` (`pathing.ts`'s
  middle branch, which has never run against real data).

### 4.2 Give a tutorial a video (item 4, the second link)

A written tutorial cannot carry the *"Noodl is back — First look"* video today (§1, 4c). Smallest
honest change, mirroring what replays already do:

1. `src/db/sql/0026_rel019_article_video.sql`:
   ```sql
   -- REL-019. A tutorial may be a recording. `video_url` stays the canonical value, exactly as
   -- `replays.video_url` does (0014); the provider split is derived at read time by `splitVideoUrl`
   -- rather than stored, because there is one recogniser and this column must not grow a second.
   alter table articles add column video_url text;
   ```
   and append `'0026_rel019_article_video.sql'` to `MIGRATIONS` in `src/db/migrate.ts:44`.
2. `src/db/schema.ts:470` — `videoUrl: text('video_url'),` beside `projectUrl`.
3. `src/lib/articles.ts` — `videoUrl: string | null` on `Article` (line 49) and `ArticleSummary`
   (line 118); select it in `listArticles` (line 147) and in `getArticle`'s row mapping (line 204).
4. `src/lib/apisurfaces.ts` — `videoUrl` on `TutorialSummary`/`TutorialDetail`, mapped in
   `tutorialSummary` (357) and `tutorialDetail` (386).
5. `src/lib/mirror.ts:147` — `videoUrl: string | null` on `MirrorArticle`, selected at line 205.
   **This is the field the launcher's Tutorials tab reads** (`MirrorArticle.videoUrl?` on the editor
   side is already there, optional).
6. `src/app/tutorials/[slug]/page.tsx` — when `splitVideoUrl(article.videoUrl)` gives a provider,
   draw the replay page's player block (`.player` / `.poster` / `?play=1` → `<iframe
   src={embedUrl(...)}>`, lines 66–120 of `src/app/replays/[slug]/page.tsx`). 🔴 Keep the replay
   page's criterion: **no `<iframe>` in the document without `?play=1`** — `uni021` grades that
   with a tag scan (line 107) and the same scan should be added to `uni020` for this page.
7. `scripts/publish-tutorial.ts` — a `--video <url>` flag written into `video_url` (it already
   validates category/level before any write; the flag rides the same transaction).
8. `tests/uni020-tutorials.test.tsx` — one corpus row with a `videoUrl`; assert the API surface
   carries it, the page draws no iframe without `play`, and does with it.

Then `npx tsc --noEmit -p .` and `npx vitest run` — the last session's readings for this repo were
**65 files / 1635 passed**.

### 4.3 Deploy (items 1b, 3c) — 🔴 read §6.7 of REL-015 first

```sh
cd ~/vscode_projects/nodegx-community && git status --short   # must be clean; commit 4.1/4.2 first
ops/deploy.sh 49.12.102.195
```

`deploy.sh` curls the three neighbours before and after, rsyncs the tree, builds ON THE HOST (the
slow part), runs `scripts/migrate.ts` (**0025 and 0026 apply here, for the first time**), restarts,
stamps `deployed.json`. ⚠️ **0025's visible cost**, measured today: `/api/v1/community/people` is
already `items: []` in production, so nobody comes OFF the directory — but under D4 every
currently-public `/u/<handle>` 404s until approved. Count first, as §6.7 says:
`select count(*) from profiles where visibility='public' and hidden_at is null;` and approve with
`scripts/approve-listing.ts` right after.

**Verify with two curls**, old and new (the harness memory's rule): `/api/v1/community/home` → 200
(old) and `/api/v1/me/listing` → **401 JSON, not 404 HTML** (new).

### 4.4 Publish the two videos (item 4) — through the tunnel

The credential is on nexus-1 only; `dev-docs/tasks/release-0.2.2/publish-members-area.sh` shows
the shape (read `DATABASE_URL` over ssh into a variable, forward 5432 to a local port, point the
script at the near end). The two commands, with the facts read off YouTube on 2026-09-06 (oEmbed
titles, `publishDate`, `lengthSeconds`):

```sh
# Replay — the meet-up. 6980 s = 1 h 56 min; held on the day it was published.
DATABASE_URL=… npx tsx scripts/publish-replay.ts \
  meet-up-1-presenting-the-alpha \
  "NodeGX community meet-up #1 — Presenting the alpha release" \
  2026-08-14 https://www.youtube.com/watch?v=k_dPltcIGrU \
  "The first community call: what NodeGX is, the alpha as it stood in August, and where it is going." \
  --duration 6980 --publish

# Tutorial — the first look. Needs 4.2 deployed first, and a BODY FILE Richard writes (≥ 200 chars;
# the script refuses less, because UNI-020 shipped `Placeholder body.` three times).
DATABASE_URL=… npx tsx scripts/publish-tutorial.ts \
  first-look-at-the-new-editor <bodyFile> logic \
  "Noodl is back — First look at the new editor (NodeGX Alpha)" \
  "A 34-minute walk through the new editor: the canvas, the viewer, and building a first screen." \
  --level beginner --minutes 34 --video https://www.youtube.com/watch?v=fqmHH36ndc0 --publish
```

⚠️ The replay description and the tutorial summary above are **proposals** written from the video
titles, not from watching them — Richard's word wins. The tutorial's `category` is a guess from the
closed four (`data-lists`, `logic`, `styling`, `backend`); none fits an overview and that is a gap in
UNI-020's vocabulary worth a fifth word (`getting-started`).

**Then verify on the live shelf, not from the runner's silence**: `curl
https://community.nodegx.io/api/v1/community/home` should list one replay and one article, and the
launcher's Replays tab should draw the poster row and open `/replays/meet-up-1-presenting-the-alpha`.

## 5. Pictures

`dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/verdicts/rel-019/2026-09-06/` —
`community-before.png`, `community-people-before.png` (the 404 drawn as "unreachable"),
`learning-lessons-before.png` (Snacks first), `learning-path-before.png`, and the four `*-after.png`.

## 6. Per-item

| Item | State | Left |
|---|---|---|
| 1 chat | 🟢 built, wired, driven | — |
| 1 people | 🟡 editor built (s33); **route not deployed** | §4.3 |
| 1 look | 🟢 built, driven, pictured | Richard's eye |
| 2 shelf | 🟢 built, gated, driven | — |
| 3 steps open | 🟢 built, gated, driven | — |
| 3 explain | 🟢 withdrawn on refusal | a projector on nexus-1 if he wants the feature |
| 3 "none installable" | 🟡 launcher says otherwise underneath | §4.1 + §4.3 |
| 4 replays | ⏳ launcher draws posters; **no row in production** | §4.4 (replay) |
| 4 tutorial video | ⏳ launcher draws video rows; **platform has no column** | §4.2 + §4.3 + §4.4 |
