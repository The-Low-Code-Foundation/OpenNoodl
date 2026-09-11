# LB-007 — rich media

**Surface:** platform · **Tier 2** · **Effort:** L · **Blocked on:** E4 (quotas/retention —
recommendations in [README.md](README.md)); LB-002's attachment slot

## Premise

The recorder is what made LearnBook exchanges *rich*: a coachee talks through their week on
camera, a coach replies with a five-minute voice note. This task is in-browser **audio/video
recording** (MediaRecorder), **file attachments**, and the object-storage layer under both — the
one LB task whose main cost is ops, which is why E4's numbers are ruled before it starts, not
discovered in production (the D9 lesson).

## Scope (v1)

- **Recorder in the composer**: record audio or video in-browser, preview, re-take, attach.
  Stored **as recorded** — 🔴 no transcoding pipeline in v1 (E4 recommendation): modern browsers
  produce webm/mp4 that other modern browsers play; a capped clip length (E4, suggest ≤ 10 min)
  keeps files sane. Playback is inline in the thread.
- **File attachments**: any type up to a per-file cap; images render inline (LB-002 already
  uploads images — same storage, one path), everything else is a download row with name/size.
  Executable-ish types delivered with content-disposition + nosniff, never inline.
- **Object storage**: platform-owned bucket (Hetzner object storage per D1's hosting posture);
  access only through authorised, expiring URLs — LB-002 criterion 4's rule generalised to all
  media.
- **Quotas (E4)**: per-space storage quota with a visible meter for the coach; upload fails
  gracefully at the cap with the number stated. Per-file and per-clip caps enforced server-side
  (the client check is UX, not the gate).
- **Retention**: media lives as long as its space plus E5's exit window; deleting a post deletes
  its media (actually deletes — a data-inventory claim LB-010 will audit); a virus/abuse takedown
  path exists as an admin action.

## Acceptance criteria

1. Record → attach → other party plays it inline: proved in the two mainstream browser engines
   (Chromium, WebKit), because recording formats are where they differ.
2. A logged-out or non-participant fetch of any media URL fails, and an expired URL fails —
   wire-level, per the D8/LB-002 standard.
3. The quota gate: an upload that would cross the cap is refused server-side even when the client
   check is bypassed with a raw request.
4. Deleting a post removes its blobs from storage (verified in the bucket, not inferred from the
   UI), while other posts' media survives.
5. A 100 MB junk file at the per-file cap neither times out the request path nor blocks other
   uploads (streaming/multipart, not memory-buffered).

## Not in v1

Transcoding/adaptive streaming, waveform/thumbnail generation, in-browser trimming, automatic
transcription (a genuinely good later feature for coaching review — noted for v2), external
storage integrations (Drive/Dropbox links work as plain links already).
