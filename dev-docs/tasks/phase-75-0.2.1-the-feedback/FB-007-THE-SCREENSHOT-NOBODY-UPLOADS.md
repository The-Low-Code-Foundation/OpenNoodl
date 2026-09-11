# FB-007 — the screenshot nobody uploads

**Filed:** 2026-08-22, from Richard's item 6. **Status: ⬜ open — the platform half is done, the
editor caller was never anyone's task.** Size: M.

> *"Right now in community in the launcher, you can't see the screen capture on the bench posts,
> even though it says there is one. Also on the community web page, it has a section for the
> screen capture but says 1976 × 626 — image not yet hosted."*

---

## What exists (swept 2026-08-22)

- **The platform half (67b's E7) is fully built**: `src/lib/objectstore.ts` (SigV4 by hand,
  driven against the real Hetzner bucket), `src/lib/captureupload.ts` (server-issued key + HMAC
  **grant**), `POST /api/v1/bench/captures`, capture intake on both bench write routes,
  `GET /api/v1/bench/attachments/:id/image` (served **by the app** — the visibility join is the
  point), and `Attachment.tsx` rendering.
- The string Richard saw is `Attachment.tsx:169` — `' — image not yet hosted'`, drawn when an
  attachment has dimensions but no image. **That is exactly what the editor publishes**: the
  capture is written to the user's own disk, not uploaded —
  `models/community/nodesharecontext.ts:19`: *"because there is nowhere to upload to…
  `saveCaptureNextTo` is the one function that becomes an upload."* There is now somewhere to
  upload to; nobody ever filed the caller. (23rd *build the caller*.)
- ⚠️ **Verify deployment first, don't inherit either claim**: one handover says nexus-1 is at
  `0cbd716` (pre-E7); the 08-21 record says `8d40b63` deployed. Read the stamp on the box. If
  E7 isn't live, `POST …/captures` answers 503 and no editor work can be driven against prod.

## Scope

1. **Editor upload**: `saveCaptureNextTo` becomes (or gains) the upload — POST the capture,
   receive `{key, grant}`, put both in the payload the composer already builds. Keep the local
   save as the offline/failure path — a failed upload must not eat the question.
2. **Editor display decision** — ⚠️ NAT-008 decided **this editor fetches no remote image at
   all** (badges are data URIs, `avatarUrl` declined). Showing captures in the mirror reverses
   that for one image class, fetched from the app's authenticated route. Either reverse it
   narrowly (capture images only, from `COMMUNITY_URL` only) or keep the mirror facet-only and
   say so in the thread UI ("view image on the web"). **Record whichever as the decision;
   don't drift into it.**

## Acceptance criteria

- AC1: composing a node question with a capture in the editor → the web thread renders the
  image; "image not yet hosted" never appears for a post made by the fixed editor.
- AC2: the upload path checks the grant (the E7 attack surface: a key you didn't earn renders a
  stranger's screenshot under your name — the spec that attacks this exists platform-side;
  the editor spec asserts it sends only keys it was granted).
- AC3: upload failure degrades to today's behaviour (facets + dimensions, no image) with the
  question still posted; the learner is told the image didn't attach.
- AC4: the editor display decision (2) is implemented and asserted — whichever way it goes.
- AC5: driven end to end: editor composer → prod (or local platform) → web thread shows the
  image → mirror shows whatever (2) decided.

## Traps

- Sniff bytes, not headers; refuse keys outside the captures prefix (both are E7's own recorded
  traps — the platform enforces them; don't build an editor path that trips them).
- `COMMUNITY_URL` is a hardcoded constant with no env override — a local drive needs the
  one-line edit, reverted after.

---

# ✅ DONE — built, specced, mutation-checked and DRIVEN over real HTTP, 2026-08-24 (session 17)

**Status: closed.** The editor uploads the capture, the web thread renders it, and the mirror
draws it. The platform half needed no change: E7 was correct, deployed and configured, and had
simply never had a caller. **The 23rd *build the caller* in this phase, and the first where every
piece on both sides already worked.**

## The sweep, before anything was written

- ✅ **E7 IS LIVE, READ OFF THE HOST AND NOT OFF THIS LAPTOP** — the trap this file's own
  §"What exists" warned about. `grep -c '^HETZNER_S3_(BUCKET|ENDPOINT|ACCESS_KEY|SECRET_KEY)=..*'`
  on `/etc/nodegx-community/nodegx-community.env` answers **4**, and `deployed.json` stamps
  `eaa19c6`. Both handover claims (`0cbd716` / `8d40b63`) were stale; the box is ahead of both.
- 🔴 **THE BUCKET HAD ZERO OBJECTS UNDER `attachments/captures/`** — measured with a
  `ListObjectsV2`. That is the independent confirmation of the diagnosis: not one capture has
  ever been hosted, because nothing had ever uploaded one.

## What was built

| seam | file | what it is |
|---|---|---|
| transport | `communityapi.ts` → `uploadCapture` | the only method that does not send JSON |
| payload | `nodeartifact.ts` → `withCaptureImage` | puts the server's reference on the capture |
| composer | `AskAboutNodeDialog.tsx` → `postToBench` | disk, then upload, then post |
| mirror | `threadview.ts` → `attachmentImage` | AC4's ruling, and where it is argued |
| renderer | `CommunityThreadView.tsx` + `Community.module.scss` | the `<img>` and its size rule |

## Scope 2 — the display decision, RULED

🔴 **Richard ruled on 2026-08-24: reverse NAT-008 narrowly.** The editor now fetches capture
images, and only those, and only from `COMMUNITY_URL`.

The argument is recorded at `threadview.ts`'s `attachmentImage` rather than here, because that is
where somebody would go to undo it. In short: `peopleview.ts` declines `avatarUrl` because it is
*"a string a stranger put on their profile"* — arbitrary host, chosen by somebody else, fetched by
a `nodeIntegration: true` window. **Every clause of that is false for a capture**: the host is our
own compile-time constant, and the path is built from the attachment's **id**, never from the key
a sender supplied. ✅ There is a **hostile spec row** for that last point — a payload whose
`image.key` is `https://evil.example/x.png` still produces our own URL — because *"no payload
contributes to the URL"* is the entire basis of the ruling and deserves better than a comment.

⚠️ **This is now the only remote image the editor fetches. A second class is a new decision** and
must be argued in that function, not appended to it.

## What the work found

- 🔴 **`Buffer.from(str, 'base64')` RETURNS A VIEW INTO NODE'S SHARED POOL.** Handing `.buffer`
  to `fetch` uploads an 8 KB slab — the wrong length, and whatever else was allocated near it.
  `uploadCapture` copies into an `ArrayBuffer` it owns. ✅ **Confirmed real, not theoretical:**
  the mutation that swaps the copy for `decoded.buffer` turns two rows red.
- 🔴 **A 200 CAN CARRY A KEY WITH NO GRANT, AND THE TEMPTING FIX COSTS THE QUESTION.** A
  half-deployed platform or a proxy that dropped the field would produce a grantless reference;
  defaulting one in — which reads as robustness — makes the **whole post** refused with *"the
  image reference needs a key and a grant"*. `uploadCapture` degrades instead. ✅ **Driven**: arm
  C posts a forged grant and gets `refused — that image was not uploaded by this account`.
- 🔴 **A SENTENCE OUTLIVED ITS BEHAVIOUR, ONE TASK AFTER FB-010 FOUND THE SAME SHAPE.**
  *"Capture saved to … — drag it into your post"* was a complete instruction while the picture
  could reach the web no other way. On the uploading route it tells somebody to do the same thing
  twice. Split, with the "drag it" half kept for the hand-off and the failure paths.
- ✅ **UNI-011 AC3 SURVIVES AND IS ASSERTED** — *"nothing leaves the machine before the user
  posts."* The upload is on the post path only; `grabCapture` and `handOff` are read as source and
  must contain no `uploadCapture`, and the whole file must contain exactly one call.
- ✅ **`.AttachmentImage` HAS A SIZE RULE, AND WITHOUT IT THE PANEL BLOWS OUT.** The `<img>`
  carries the sender's intrinsic dimensions — Richard's report quotes **1976 × 626** — so
  `max-width: 100%` *and* `height: auto` are both load-bearing. Same family as FB-010's
  `.avatar.sm`: a rule that is complete until a new case exists.
- ⚠️ **`--border-radius-sm` DOES NOT EXIST.** It is the name that suggests itself, it is defined
  nowhere in the repo, and it would have rendered as no radius at all, silently, forever. Caught
  by grepping for the definition rather than for the usage. Same trap as session 16's
  `--site-fg-primary`, in the other repo.

## 🔴 THE FULL SUITE CAUGHT WHAT THE FEATURE SPEC COULD NOT — AGAIN

`fb-007/capture-upload.test.ts` was **26/26 with 8 mutations red** before the corpus had seen the
change. The corpus then turned **`uni-016/composer-sends-what-it-shows.test.ts`** red:
*"the attachments come from the shared builder, not from a second derivation here"* asserted the
literal `attachments: artifacts`.

✅ **That is the guard working, and the honest question it raised is whether
`withCaptureImage(artifacts, uploaded)` IS the second derivation it forbids.** It is not — it is
not a rebuild, it cannot touch what was shown, and it is total on null. So the row was **tightened
rather than loosened**: the expectation is now the exact whole expression, plus a new assertion
that `buildNodeArtifacts` is called **exactly once** (two calls being the rebuild), plus a negative
control proving a rebuild is caught. A lazy `toContain('artifacts')` would have passed on
`attachments: rebuildFrom(artifacts)`, which is the actual defect.

⚠️ Second session running in which a green feature spec said nothing about the corpus.

## AC5 — the drive (real HTTP, own database, the real bucket, no browser)

The caller was **the editor's own code** — `CommunityApiClient.uploadCapture`,
`buildNodeArtifacts`, `withCaptureImage`, `attachmentImage` — against `npx next start -p 3200` on
`nodegx_community_fb007drive`, with the real Hetzner bucket so E7 was genuinely exercised.

| arm | what happened |
|---|---|
| **A — happy path** | upload **ok** (`attachments/captures/202608/…png` + grant) → post **ok** → stored payload has the **grant stripped** → mirror src correct → image route **200 `image/png`, bytes identical to what was sent** → web page **no longer says "image not yet hosted"** and draws `<img class="capture-shot">` |
| **B — AC3** | a **real** refusal (`that is not a PNG`) → **question still posts** → mirror draws no image → web page says *"image not yet hosted"*, i.e. **exactly today's behaviour**, dimensions intact |
| **C — AC2** | a **forged** grant → the whole post **refused**: *"that image was not uploaded by this account"* |

- ✅ Arm B is the criterion, not a smoke test: *"capture hosting is not configured"* is a
  **supported state** on any deployment without a bucket, so the degrade is the ordinary path
  there — and it is what makes the local `saveCaptureNextTo` copy still worth keeping.
- ✅ **Cleaned up**: the four 70-byte objects the drive wrote were deleted and the prefix
  re-listed to **0**. The bucket is shared with the database dumps, so this was done by key and
  never by prefix.

## Acceptance criteria

- **AC1 ✅** driven — the web thread renders the image; *"image not yet hosted"* is gone for a post
  made by the fixed editor.
- **AC2 ✅** the reference has exactly one origin (the upload's answer); no constructor exists in
  the editor; driven with a forged grant.
- **AC3 ✅** driven on a real refusal — the question posts, and the learner is told, on the
  **success** state rather than as a competing failure.
- **AC4 ✅** ruled and implemented; argued at the seam; hostile row on the URL.
- **AC5 ✅** driven end to end.

## Deliberately left

- ⚠️ **Not driven in a browser.** The composer's wiring is read as source (this runner has no DOM
  or React), and the transport, payload, mirror and both routes are driven over real HTTP. The
  click itself is not — the same gap `uni-016` records, unchanged.
- ⚠️ **`apisurfaces.ts`' `personProfile` still has its flat disc.** FB-007 touched captures, not
  avatars; `avatarKey`/`experience` remain unpublished on the mirror's person shape. **That is
  still a decision nobody has made**, and it is not this task's — recorded so it does not get
  mistaken for a consequence of this ruling.
- ⚠️ **`COMMUNITY_URL` still has no env override**, so a local drive of the *dialog* needs the
  one-line edit this file's traps mention. The drive above did not need it, because the client
  takes a `baseUrl`.
- ⚠️ **Not deployed** — nothing here requires a deploy (the platform is unchanged), but the
  editor change ships with the next editor build.
