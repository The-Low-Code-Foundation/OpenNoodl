# UNI-008 — online in one click, off in forty-five days

**Surface:** platform + editor · **Tier 3 (deliberately last)** · **Effort:** L · **Blocked on:** D9 (hosting scope + caps)

## Premise

The Bubble wow: "your app is already online and you can share it with whoever" — a school
project shown to grandma tonight. Richard's ruling (R7) shapes it as **ephemeral by default**:
free for **15 days**, then it stops; **manual restarts** allowed up to **~45 days total
lifetime**; after that, pay (a later tranche) or take the **self-host off-ramp** — clear advice
*and functionality* for publishing to your own Hetzner (or wherever) yourself. Ephemerality is
the abuse defence: nothing lives forever unless someone asks, and most abuse dies with the TTL.

## Scope (v1)

- **Editor: push-to-share.** One action on a signed-in editor: export (the existing exporter —
  🔴 which publishes by **allow-list**; this task must not widen `PUBLISHABLE_AUTH_FIELDS` or
  add fields to the artifact) → upload to the platform → back comes `https://<name>.<share-domain>`.
- **Platform: the share host.** Serves uploaded bundles on subdomains (Cloudflare in front),
  with the lifecycle: 15-day clock per push/restart, restart button on the user's dashboard,
  45-day cumulative cap per app, stopped apps show a friendly "this prototype is sleeping"
  page with the owner's restart path. A required "built with NodeGX" footer/badge per D9.
- **The off-ramp.** At cap (and on the dashboard anytime): a guided self-host flow — the same
  exported artifact, docs + a helper for Hetzner-style deployment. The off-ramp is a feature,
  not a punishment: it must be genuinely easier than figuring it out alone.
- **Abuse minimum:** report link on every shared app, admin kill switch, upload size caps,
  no custom HTML injection outside the exported app, D9's record/backend answer respected.

## D9's open core: does v1 host a backend?

Static frontend hosting is safe and cheap. The full Bubble dream needs data. Recommendation to
carry into the ruling: v1 ships **frontend + a record-capped multi-tenant instance of our own
light backend** *only if* the backend's isolation story survives a design review; otherwise v1
is static-only and data-hosting is its own later task. The wow survives either way — most
show-your-friends prototypes are UI-first.

## Acceptance criteria

1. Push from the editor → live URL in under a minute; the artifact byte-matches the allow-list
   exporter's output (spec-pinned — the submission/export discipline).
2. The lifecycle honours 15/45: expiry stops serving, restart resumes with the clock debited,
   the 46th cumulative day refuses politely and offers the off-ramp.
3. The off-ramp produces a working self-hosted deployment of the same app, following only the
   guidance we ship (tested by someone who didn't write it).
4. Admin kill switch and report flow work; a killed app's subdomain cannot be re-claimed by
   another account.

## Not in v1

Paid permanent hosting, custom domains (the Cloudflare-DNS dream — designed-for, deferred),
the showcase/remix gallery, backend data hosting if D9 rules it out.
