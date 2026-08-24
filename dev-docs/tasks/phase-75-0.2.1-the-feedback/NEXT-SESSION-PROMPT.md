# Phase 75 — next session

**State as of 2026-08-24 (session 17).** Session 17 built, specced and **drove FB-007 over real
HTTP** — the editor now uploads the capture it has been taking all along, and the mirror draws it.
**FB-007 is closed**, and with it the whole Tier-1 *build-the-caller* family: FB-003, FB-010 and
FB-007 are all done. Richard ruled scope 2 (the display decision) at the start of the session.
Read *"What session 17 found"*, then session 16's notes, which still stand.

## What session 17 found

### ✅ FB-007 — BUILT, SPECCED, DRIVEN, CLOSED (`cdaddcbf`, editor repo only)

The 23rd *build the caller*, and **the first where every piece on both sides already worked**.
Nothing was broken and nothing needed fixing: E7's platform half was correct, deployed and
configured, and the editor wrote the PNG to the user's Documents folder because when that code
was written there was nowhere to upload to. The two halves had never been joined.

- ✅ **THE SWEEP SETTLED THE TASK FILE'S OWN WARNING FIRST.** *"Verify deployment, don't inherit
  either claim"* — `deployed.json` on nexus-1 stamps **`eaa19c6`** and the app env holds **4/4**
  `HETZNER_S3_*`, read **off the host**, which is the exact check `ops/deploy.sh` performs and
  the exact failure it was written for (the keys once reached `backup.env` and never the app).
- 🔴 **THE BUCKET HELD ZERO OBJECTS UNDER `attachments/captures/`.** Measured with a
  `ListObjectsV2`, and it is the independent confirmation of the diagnosis — not one capture had
  ever been hosted, because nothing had ever uploaded one. ⚠️ That prefix is in the **same bucket
  as the database dumps**, so anything done there is done by key and never by prefix.
- 🔴 **SCOPE 2 RULED BY RICHARD, 08-24: REVERSE NAT-008 NARROWLY.** Capture images only, from
  `COMMUNITY_URL` only. `peopleview.ts` still declines `avatarUrl` and its reasoning is unchanged
  — but that reasoning rests on *"a string a **stranger** put on their profile"*, and **every
  clause of it is false for a capture**: our own compile-time host, and a path built from the
  attachment's **id**, never from the sender's key. ✅ There is a **hostile row** proving an
  `image.key` of `https://evil.example/x.png` still yields our own URL, because *"no payload
  contributes to the URL"* is the whole basis of the ruling. ⚠️ **This is now the only remote
  image the editor fetches; a second class is a new decision**, to be argued in `attachmentImage`.
- 🔴 **`Buffer.from(str, 'base64')` RETURNS A VIEW INTO NODE'S SHARED POOL.** Handing `.buffer`
  to `fetch` uploads an **8 KB slab** — the wrong length, and whatever else was allocated near
  it. `uploadCapture` copies into an `ArrayBuffer` it owns. ✅ **Confirmed real rather than
  theoretical**: the mutation swapping the copy for `decoded.buffer` turns two rows red. It
  surfaced as a *type error*, which is the only reason it was looked at at all.
- 🔴 **A 200 CAN CARRY A KEY WITH NO GRANT, AND THE TEMPTING FIX COSTS THE QUESTION.** Defaulting
  a grant in reads as robustness; there is no value a client could invent that the platform's
  HMAC verifies, so the **whole post** is then refused with *"the image reference needs a key and
  a grant"*. Degrading costs the picture; passing it on costs the question. ✅ **Driven** — arm C.
- 🔴 **A SENTENCE OUTLIVED ITS BEHAVIOUR, ONE TASK AFTER FB-010 FOUND THE SAME SHAPE.** *"Capture
  saved to … — **drag it into your post**"* was complete while the picture could reach the web no
  other way; on the uploading route it tells somebody to do the same thing twice. Split, with the
  "drag it" half kept for the hand-off and the failure paths.
- ✅ **UNI-011 AC3 SURVIVES AND IS NOW ASSERTED** — *"nothing leaves the machine before the user
  posts."* The upload is on the post path only; `grabCapture` and `handOff` must contain no
  `uploadCapture`, and the file must hold exactly one call.
- ⚠️ **`--border-radius-sm` DOES NOT EXIST** and is defined nowhere in the repo — it would have
  rendered as no radius at all, silently, forever. Caught by grepping for the **definition**,
  not the usage. Session 16 paid for the same shape with `--site-fg-primary` in the other repo.
- ✅ **`.AttachmentImage` needs `max-width: 100%` AND `height: auto`** — the `<img>` carries the
  sender's intrinsic dimensions (Richard's report quotes **1976 × 626**), so one without the
  other either blows the panel out or squashes the picture. FB-010's `.avatar.sm` family.

### 🔴 THE FULL SUITE CAUGHT WHAT THE FEATURE SPEC COULD NOT — SECOND SESSION RUNNING

`fb-007/capture-upload.test.ts` was **26/26 with eight mutations red** before the corpus had seen
the change. The corpus then turned `uni-016/composer-sends-what-it-shows.test.ts` red: its row
*"the attachments come from the shared builder, not from a second derivation here"* asserted the
literal `attachments: artifacts`.

✅ **The guard working, and the honest question was whether `withCaptureImage(artifacts, uploaded)`
IS the second derivation it forbids.** It is not — not a rebuild, cannot touch what was shown,
total on null. So the row was **tightened rather than loosened**: the exact whole expression, plus
a new assertion that `buildNodeArtifacts` is called **exactly once**, plus a control proving a
rebuild is caught. ⚠️ A lazy `toContain('artifacts')` would have passed on
`attachments: rebuildFrom(artifacts)`, which is the actual defect.

### The drive (real HTTP, own database, the REAL bucket, no browser)

The caller was **the editor's own code** — `CommunityApiClient.uploadCapture`,
`buildNodeArtifacts`, `withCaptureImage`, `attachmentImage` — against `npx next start -p 3200`.

| arm | what happened |
|---|---|
| **A — happy path** | upload **ok** → post **ok** → stored payload has the **grant stripped** → image route **200 `image/png`, bytes identical to what was sent** → web page **no longer says "image not yet hosted"** and draws `<img class="capture-shot">` |
| **B — AC3** | a **real** refusal (*"that is not a PNG"*) → **the question still posts** → mirror draws no image → web page shows **exactly today's behaviour**, dimensions intact |
| **C — AC2** | a **forged** grant → the whole post **refused**: *"that image was not uploaded by this account"* |

- ✅ **Arm B is the criterion, not a smoke test.** *"Capture hosting is not configured"* is a
  **supported state** on any deployment without a bucket, so the degrade is the ordinary path
  there — and it is what keeps the local `saveCaptureNextTo` copy worth having.
- ✅ **Cleaned up**: the drive's four 70-byte objects were deleted **by key** and the prefix
  re-listed to **0**.
- ⚠️ **A thread page is `/bench/<id>`, not `/community/bench/<id>`.** The wrong URL returns a page
  that simply lacks the strings you are asserting, which reads exactly like a broken feature.

## First moves, in order

1. **FB-011** — the ports render once (S/M, revises UNI-016's rendering pair). The last small
   item with no ruling attached, and the Tier-1 family above it is now empty.
2. **The FB-018 / FB-021 / FB-015 pair-up** (M each, all editor-side, no rulings): the binding
   chip and which value wins; gated ports rendering disabled with their reason; the image picker
   empty state. FB-017 (L) revives STYLE-004's deferral and is the one worth scoping before
   starting.
3. ⚠️ **FB-007's deliberate remainders**: the composer is **not driven in a browser** — the
   transport, payload, mirror and both routes are driven over real HTTP, but the click itself is
   source-read, which is the gap `uni-016` already records. And **`apisurfaces.ts`' `personProfile`
   still has its flat disc**: `avatarKey`/`experience` remain unpublished on the mirror's person
   shape. 🔴 **That is still nobody's decision, and it is NOT a consequence of this ruling** —
   FB-007 was about captures, not avatars.
4. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — seven days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- Editor `tests-unit`: **294 suites / 4817 specs / 0 failures** (s14: 293/4790 ⇒ **+1 suite /
  +27 specs** — 26 the new `fb-007/capture-upload.test.ts`, 1 the negative control added to
  `uni-016`. **Reconciles exactly.**)
- Full `test:main` (tests-unit + tests-main): **313 suites / 5081 specs / 0 failures.**
- `@noodl/noodl-core-ui`: **521 specs / 0 failures.**
- `typecheck:editor` and `typecheck:editor-tests` clean. **Eight mutations, all red**, listed in
  the task file.
- **Not run** — nothing touched them: `noodl-viewer-react`, `@noodl/runtime`, the community suite,
  `test:ci`. 🔴 **Re-measure rather than quoting this line.**
- ⚠️ **Nothing to deploy.** The platform is unchanged; FB-007 is entirely editor-side and ships
  with the next editor build. nexus-1 stays at `eaa19c6`.

## Session notes

- **Database left behind**: `nodegx_community_fb007drive` (migrated, one account `nia-fb007` with
  an editor-origin session, three driven threads). Reusable; rebuild rather than trusting it.
- ✅ **The drive harness is sessions 15/16's, and it works unchanged**: `npm run build`, then
  `npx next start -p 3200` against a `DATABASE_URL` of its own. ⚠️ Kill it with
  `lsof -ti :3200 -sTCP:LISTEN`, never the bare form. 🆕 **This session added one thing worth
  keeping**: running the drive as a **temporary jest file inside `tests-unit/`** gets the editor's
  own module resolution and path aliases for free, so the *editor's* client can be the caller
  against a real server. Delete the file afterwards — it was never committed.
- ⚠️ **`sessions.token_hash` is `text`, not `token_sha256` `bytea`.** Session 15's note about
  minting a session by hand is right in shape and wrong in column name; `origin` (FB-010's column)
  also wants setting to `'editor'` if you are pretending to be one.
- 🔴 **`signRequest` in `objectstore.ts` cannot sign a `ListObjectsV2`** — it signs one key path
  and takes no query string. Listing the bucket needs about forty lines of SigV4 of your own.
  Worth it: the zero-object reading is what turned the diagnosis from plausible into confirmed.
- A peer session (`opennoodl-78`) was live in this checkout and confirmed nothing of its own was
  running. It flagged the real coupling — `hooks/useCommunityThread.ts` and
  `tests-unit/fb-001/editverbs.test.ts` both import from `threadview`/`communityapi` — but that is
  the `edit`/`EditOffer` shape, and this session's change to `threadview` is **additive to the
  attachment view**, so the delete-confirmation blast radius was never entered.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted**, still belongs to
  neither session, and was **not touched again** — mtime remains `2026-08-20 15:41`, verified
  after committing. It sits in the very directory this session edited, so the commit was made by
  **explicit pathspec**, never `git add` on the directory. Richard's call.
