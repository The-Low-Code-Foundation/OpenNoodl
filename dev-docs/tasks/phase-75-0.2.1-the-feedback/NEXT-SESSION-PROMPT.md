# Next session — phase 75

_Written 2026-08-27 at the end of session 56, which closed **FIX-025 bug 7's second cause** and
found that the note describing it was wrong in the two places that made it look expensive. Read
`TASKS.md` for the rest of the phase; this file is only about what that session left._

## What happened

The previous session committed Richard's FB-025/026/027 batch and left nothing carried over, so
this one took the cheapest item the index offered — **FIX-025 §5/§7/§12, "built, need the editor
drive"**. 🔴 **That index line was stale in all three places**, and checking it was most of the
value:

* **§12** had been **driven on 08-25**; the line had simply not been updated.
* **§5** is a deliberate park, not open work: the render decision is already specced, and the only
  unseen thing is the live signed-out launcher, which means signing out of Richard's live
  community session on this machine.
* **§7** was the only real item — and it was **not** the "decision rather than a patch" the note
  claimed.

**Two commits on `cline-dev`, neither pushed** (`63fb8b64` the fix, plus this handoff).

## Start here

**Nothing is carried over from §7.** The largest open items in `TASKS.md` are still FB-012
(tutorials + share/export) and FB-009 (a syllabus you can start), both waiting on content from
Richard, and FB-005's blocker is content too. **FB-013 has real buildable remainder**: C4 (the
launcher tab), C5, and **R-chat-mod** — the moderation-posture question the ruling required be
asked, with a recommendation already written in `FB-013-SCOPE.md` §8.

⚠️ **The one thing §7 still owes is a drive.** The strings and the wiring are graded from the
runner and the render spec walks the real component with the real composer, but nobody has looked
at the row in a running editor.

## 🔴 The harness trap that cost this session an hour — read this before you run `test:ci`

**`packages/noodl-editor/.webpack-cache` can enter a state where the test-ci build reports 44
unresolved-alias errors** (`@noodl-store/*`, `@noodl-versioning`, `@noodl-viewer-cloud/*`) plus 3
"TypeScript emitted no output" errors, on a tree that compiles perfectly. Every alias target exists
on disk, and `tsc -p packages/noodl-editor` reads **0** at the same moment.

🔴 **It reproduces at plain `HEAD` with your changes fully reverted** — that is the measurement
that settles it. `rm -rf packages/noodl-editor/.webpack-cache` made **both** arms compile cleanly
(63s cold, vs 13–22s poisoned-and-failing).

⚠️ **Two wrong attributions were one step away, and both were nearly published.** First a peer was
running three `webpack` watchers for a `dev:debug` stack, so *"contamination window = the webpack"*
fitted perfectly — I messaged them and took a hold they did not owe. Then a control build at HEAD
passed while the treatment failed, which read as *deterministically mine* — until the next HEAD
build failed too. **The held-constant was the cache, and it was not constant.** A reading that fits
is not one that excludes; here two different stories fitted in the same ten minutes.

✅ Clearing it is safe beside a peer's live editor: it is gitignored, and only `webpack.test.js` /
`webpack.test-ci.js` use it — `webpack.renderer.dev.js` is `cache: false`.

## What §7 actually was, and why the old note made it look bigger

The note said the platform *"sends `firstReplyMinutes: null` on a thread with `replyCount: 1`"*,
that an answered thread therefore *"reads unanswered on every surface, web included"*, and that it
was *"unowned, and a decision rather than a patch"*.

🔴 **The platform is not defective, and that is the finding.** `firstReplyMinutes` is computed by
`nodegx-community/src/lib/bench.ts` as the first post **by another account**, on purpose — D16's
threshold is about people coming back — and `uni015-bench.test.ts` has asserted exactly that since
UNI-015 (*"the first-reply clock ignores the asker answering themselves"*). `replyCount` counts
every visible post after the first, the asker's own included. The two disagree **precisely** when
somebody answers their own question, and **both are true**. There was no number to fix.

🔴 **And the web never drew it.** `firstReplyMinutes` appears nowhere under
`nodegx-community/src/app` or `src/components` — it feeds the threshold and nothing else. So there
was no second surface, and therefore no cross-surface decision to take.

✅ **What was left is one sentence**: `replyLatency` rendered a value about *replies by other
people* as a claim about *replies*. It now takes `replyCount` and says **"no reply from anyone else
yet"** when the asker has replied. ⚠️ The old note's one correct half is honoured — the row still
*speaks* in both null branches, because the launcher draws "N unreplied" off the same null.

## The measurements worth not repeating

✅ **Production is the fixture, and it is a control pair.**
`curl https://community.nodegx.io/api/v1/community/threads` (2026-08-27, re-measured not relayed)
returns two threads with the same title and author, **both `firstReplyMinutes: null`**:

| thread | `replyCount` | `accepted` | drew before | draws now |
|---|---|---|---|---|
| `de14371e…` | 1 | **true** | *no reply yet* | *no reply from anyone else yet* |
| `2abd111a…` | 0 | false | *no reply yet* | *no reply yet* |

**Row 1 is Richard's bug, still live on production.** The pair is what makes the spec honest: they
used to render the identical string, so reading one field cannot tell them apart however it is
worded. ⚠️ This also re-confirms `replyCount` is **on the wire** — the scar in `communityapi.ts`
says a declared field must be verified there and not read off the platform's source.

✅ **A local Postgres reproduced the mechanism**, without Docker: brew `postgresql@16` is running
on **5432**, and a scratch database (`createdb`, then `DATABASE_URL=postgres://richardosborne@127.0.0.1:5432/<db>`)
runs the community suite fine. The repo's own default is port **55432** (the docker-compose one),
and **the Docker daemon is not running on this machine**. Staged printout: asked → asker
self-replies (`replyCount=1, firstReplyMinutes=null`) → that reply accepted (**the bug**) →
a stranger replies (`replyCount=2, firstReplyMinutes=0`, cleared).

## 🔴 The mutant that mattered

`replyCount` had to travel `ForumThread` → `composeBench` → `CommunityBenchRow` → the row. Severing
**only the last hop** — `replyLatency(thread.firstReplyMinutes, 0)` in `CommunityBenchView.tsx` —
reddens **2 render specs while all 29 unit specs stay green**. A correct function that nothing
hands the right argument to is the same screen as no fix at all, and the unit specs alone would
have shipped it.

**8 mutants, all killed**: revert (2 red) · over-correct to always-the-new-sentence (4) · `>= 0`
boundary (4) · go silent (2) · drop the wire guard (1) · sever the wiring (2 render) · pass `0` on
the detail page (1) · payload count instead of drawn answers (1).

⚠️ **Note the shape**: the **negative control** — *a question nobody answered still says "no reply
yet"* — is the only row that kills the over-correction. Every other assertion is satisfied by a
function that merely stopped saying the old sentence.

## Two smaller things this session established

- ✅ **`replyCount` is a REQUIRED parameter, not optional.** An optional one is a hole shaped like
  this defect: a caller that forgets it gets the wrong sentence silently, which is the state the
  function was already in. Required, the compiler names every call site.
- 🔴 **`tsc -p packages/noodl-editor` does NOT typecheck `tests-unit/`, but ts-jest does.** The
  typecheck read 0 while `uni-011/mirrorview.test.ts` held `ForumThread` literals missing the new
  field; `test:main` then reported **`Tests: 0 total`** for that file — a suite that failed to
  *run*, not to pass. ⚠️ `**/*.stories.tsx` is excluded from that tsconfig outright, so story call
  sites compile nowhere and must be fixed by hand.

## Standing facts for this area

- `test:ci` floor is **4**, all `AIX-006 style vocabulary`. ✅ **Confirmed on the COMMITTED tree,
  at a second seed, on a machine with nothing else running**: **2856 specs / 4 failures**, the same
  four by name, seed **72521**, `gitHead` **`b3d9ffba`**, readout mtime 22:13:43 read directly.
  ⚠️ `b3d9ffba` is a **peer's** docs-only commit that landed mid-run — but **both of this lane's
  commits are ancestors of it** (`git merge-base --is-ancestor`, checked), so the graded tree does
  contain the fix. An earlier run the same session read the identical 2856 / 4 at seed **57633**
  but stamped `gitHead 640bbfe3`, because the fix was still uncommitted when it ran — that is the
  documented caveat, and this reading is the one with real provenance. **Quote the tree, not the
  seed**, and check whose commit the tree is named after before quoting it.
- The suites, in order and **never two at once**: `noodl-runtime` (2555), `noodl-viewer-react`
  (1079), editor `test:main`, then `test:ci`. This session ran `test:main` (**354 / 5840 / 0**) and
  `noodl-core-ui` (**28 / 527 / 0**); runtime and viewer-react were untouched and not run.
- ⚠️ **A peer is active in this checkout** (P76 / SB-015, a `dev:debug` stack on CDP 9222 plus the
  sb015 backend on 8588). `test:main` really is safe beside it; the `test:ci` webpack scare above
  was **not** their doing.
- ⚠️ `AskAboutNodeDialog.module.scss` has been uncommitted since **08-20** and belongs to nobody in
  this lane. Still there. Leave it.
- ⚠️ **`nodegx-community` was not touched** and needs no deploy from this work.
