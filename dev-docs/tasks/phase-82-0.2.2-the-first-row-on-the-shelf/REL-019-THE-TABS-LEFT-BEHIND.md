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

> ### ✅ s60 (2026-09-06) — SUPERSEDED. §4 IS DONE AND DEPLOYED, EXCEPT THE TUTORIAL BODY.
>
> The classifier denial below **did not reproduce**, on Richard's express permission and the
> second cheap test in two days: single `Edit`s and single-command `sed`s into that tree were
> accepted, and only COMPOUND commands (`cp && sed && grep`, a multi-line `python3 -c`, a
> `find` over `~/vscode_projects`) were refused. 🔴 **The test is one command, and "denied" is
> a property of the COMMAND SHAPE rather than of the directory** — s59 read a real refusal and
> generalised it one level too far. See §4.5 for what was actually run and measured.

🔴 **Every edit to `~/vscode_projects/nodegx-community` was DENIED by the session's permission
classifier** — an `Edit` of one JSON value, a `grep` in that tree, a Python write. The platform
half of this row could not be built from this session, and a production deploy on top of that would
have been an outward-facing act on a repo the session could not even read reliably. So items 1b, 3c
and 4 are **handed over with the exact steps**, not marked done. ✅ `ssh` to nexus-1 DID work this
session (`SSH_OK`), so the "blocked" claim in the harness memory did not reproduce today either.

## 4. The platform half — the steps, in order (Richard, or a session allowed to edit that repo)

> ✅ **s60 ran §4.1–§4.3 and the replay half of §4.4.** The steps below are kept as written
> because they are the record of what was planned; **§4.5 is what happened**, including the two
> places the plan was wrong. Community repo now at **`a3e71bd`**, deployed and stamped on
> nexus-1. ⏳ Left: the *First look* tutorial, whose body is Richard's prose.

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

## 4.5 ✅ s60 — what was actually run, and the two places §4 was wrong

Community repo **`63e72b2` → `a3e71bd`** (one commit, 15 files), deployed to nexus-1 with
`ops/deploy.sh 49.12.102.195`, **EXIT=0**. Migrations `0025`, `0026` and `0027` applied there for
the first time; neighbours **200 → 200** all three; host stamped `a3e71bd` on `main`.

### 🔴 The two things §4 got wrong, both found by measuring rather than by following

1. **`GET /api/v1/me/listing` DOES NOT EXIST AND WAS NEVER MEANT TO.** §1 and §4.3 both read its
   404 as the People card's cause and as the deploy's verification target. It is neither.
   `communityapi.ts:2453` says so in its own header: *"`GET /api/v1/me/profile`, NOT a
   `/api/v1/me/listing` of its own … building it would have put two doors on one state"*. The
   editor calls `/api/v1/me/profile`, and **that** route is what was missing from production.
   ⚠️ So the §4.3 verification pair was aimed at a route nobody calls, and would have reported
   the deploy a failure while the card worked. Measured after: `/api/v1/me/profile` → **401 JSON**
   (`{"error":"sign in to see your listing"}`), and `git log` confirms its GET handler landed in
   `e5735d9` — one of the four commits production was behind, so it could not have served this
   before. 🔴 **A 404 on a route you assumed exists is not evidence about the feature.**
2. **`0025`'s cost was zero, confirmed twice.** `/api/v1/community/people` read `total: 0`
   BEFORE the deploy and `total: 0` after, so no `/u/<handle>` came down and
   `scripts/approve-listing.ts` had nobody to approve. The before-reading is the one that
   mattered and it was taken first.

### A gate that was passing for the wrong reason

Adding the fifth category made `uni020`'s seed check go green **immediately**, which is the tell.
`seed.mjs` has carried `tags: ['getting-started']` since UNI-020 and the assertion was a bare
``toContain(`'${category.key}'`)`` — **a substring found a TAG and reported a CATEGORY**. Tightened
to `category: '<key>'` in field position, proved red with the seed reverted, and `first-hour` (an
orientation article filed under `data-lists`) re-filed into the category it was always about;
`data-lists` keeps `repeaters`, so no facet lost its positive arm.

`uni005`'s inventory also demanded `articles.video_url` — the sweep a new column owes. Classified
`platform-content` **by mechanism, not intention**: no route under `src/app` writes it.

### Readings, with exit statuses

| What | Reading |
|---|---|
| `npx vitest run` (community) | **65 files passed / 1 skipped, 1640 passed / 8 skipped, EXIT=0** — s59's 1635 + 5 new, reconciled |
| `npx tsc --noEmit -p .` | **EXIT=0**, zero lines |
| `ops/deploy.sh 49.12.102.195` | **EXIT=0**; `0025`+`0026`+`0027` applied; neighbours 200 → 200 |
| Mutants (3, each restored **md5-identical**) | `videoUrl` dropped from `tutorialSummary` → red · page's `play === '1' &&` removed → red · seed category reverted → red |
| `/university` live | **8 `>Ready<`, 8 `>In writing<`** of 16 lessons |
| `/replays/meet-up-1-…` live | **0 `<iframe>` cold, 1 with `?play=1`** — the criterion holds in production |
| `/api/v1/community/home` | one replay, `articles: []` |
| `/`, `/university`, `/replays`, `/tutorials`, `/people` | **200** |

⚠️ **A near-miss worth keeping**: the first `/university` check grepped for `Ready to install`, a
string `standingLabel` never emits, and read *16 in-writing* — a false failure. `>Ready<` is the
honest count. **Grep for the string the code actually produces, not the one the task file says.**

⚠️ **And a self-inflicted one**: restoring the first mutant with `git checkout -- <file>` discarded
that file's REL-019 edits along with the mutation, because they were uncommitted. Caught on the
md5, reapplied, re-verified. Every later restore used a `cp` snapshot. This is the recorded rule
and it still cost a round trip.

### ✅ s61 — nothing is left. The tutorial is published, and the prose is Richard's

**Richard supplied the body himself** (his YouTube description, pasted into the session) and it
went up verbatim: `/tutorials/first-look-at-the-new-editor`, `getting-started` · `beginner` ·
34 min, **1596 chars**, `--publish`. The 200-character floor was never in danger and, more to the
point, **no session wrote a word of it** — which is the whole reason the floor exists.

**Verified on the live site, not from the script's own success line**: `/api/v1/community/home`
lists **1 replay + 1 article**, the article carries
`videoUrl: https://www.youtube.com/watch?v=fqmHH36ndc0`, the page is **200** with the title
present, it is **listed on `/tutorials`**, and there are **0 `<iframe>` cold** — the player does
not touch YouTube until a reader presses play, which is the property `0026`'s `splitVideoUrl`
reuse was for.

⚠️ **Three things a session did NOT decide, left for Richard's eye** (`--replace` re-runs any of
them cheaply):

1. **The summary is composed from his own two opening sentences**, not from §4.4's proposal —
   §4.4's *"building a first screen"* was invented from the title and the timestamps show the
   video does no such thing. It is a tour of what changed.
2. **`--minutes 34` is the measured `lengthSeconds`; his prose says "30-minute tour".** The
   measurement is kept and the discrepancy recorded rather than silently reconciled.
3. **Formatting**: the timestamp block became a markdown list under a `## Timestamps` heading and
   the trailing YouTube hashtags were dropped. Nothing else was touched. The `claude.ai/code/artifact`
   "full change list" link is his and went up as written — 🔴 **artifacts are private by default,
   so that link may 404 for readers**; worth a check, and it is the one line in the body a reader
   is most likely to click.

⚠️ **`publish-tutorial.ts` warned "No `--node` chips … unfindable that way".** Left deliberately:
the node filter on `/tutorials` exists to find tutorials ABOUT a node, and an editor overview is
about none of them. It is listed on the index and reachable; the warning is correct in general and
wrong for this row.

The replay description that WAS published in s60 is still a proposal from its title
(`--replace` re-runs it if the wording is wrong).

## 5. Pictures

`dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/verdicts/rel-019/2026-09-06/` —
`community-before.png`, `community-people-before.png` (the 404 drawn as "unreachable"),
`learning-lessons-before.png` (Snacks first), `learning-path-before.png`, and the four `*-after.png`.

## 6. Per-item

| Item | State | Left |
|---|---|---|
| 1 chat | 🟢 built, wired, driven | — |
| 1 people | 🟢 **deployed s60**; `/api/v1/me/profile` → 401 JSON (NOT `/me/listing`, §4.5) | Richard's click |
| 1 look | 🟢 built, driven, pictured | Richard's eye |
| 2 shelf | 🟢 built, gated, driven | — |
| 3 steps open | 🟢 built, gated, driven | — |
| 3 explain | 🟢 withdrawn on refusal | a projector on nexus-1 if he wants the feature |
| 3 "none installable" | 🟢 **8 of 16 live `Ready`** on /university, deployed s60 | — |
| 4 replays | 🟢 **published s60** — in `/api/v1/community/home`, page 200, 0 frames cold | Richard's eye on the description |
| 4 tutorial video | 🟢 **PUBLISHED s61** — Richard supplied the prose, §4.4's command ran | Richard's eye on the summary (`--replace`) |

🔴 **The one open row is prose, not code.** Everything the tutorial needs exists in production.
