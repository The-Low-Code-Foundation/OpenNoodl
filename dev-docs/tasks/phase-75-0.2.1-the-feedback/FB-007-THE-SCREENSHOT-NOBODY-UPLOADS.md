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
