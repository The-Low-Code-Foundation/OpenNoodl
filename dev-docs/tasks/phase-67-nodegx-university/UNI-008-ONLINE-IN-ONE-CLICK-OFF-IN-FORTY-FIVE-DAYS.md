# UNI-008 — online in one click, off in forty-five days

**Surface:** platform + editor · **Tier 3 (deliberately last)** · **Effort:** **L+ (raised by D9)** · 🔴 ✅ **D9 RULED 2026-08-14 — against the recommendation**

> **D9: the hosted tier serves the exported frontend *and* a record-capped slice of the inbuilt
> backend.** The recommendation was static-only; Richard ruled for the backend. The feature is not
> wrong — it is the strongest version of the Bubble wow, and a data-driven app that works the moment
> it is pushed is the demo. But it converts this task from a **file-serving** problem into a
> **data-holding** one, and **five obligations follow that were not in this task's scope**:
>
> 1. **Expiry becomes a data-deletion event, not a file deletion.** R7's 15-day life and 45-day cap
>    now delete *end users'* records, not just the builder's bundle. That needs a stated retention
>    policy and a warning before it fires.
> 2. 🔴 **ECO-004's exit requirement now reaches the data.** *"Users' work must remain theirs and
>    retrievable"* — phase 18's project export is **no longer a sufficient answer**, because the
>    records are not in the project. **Records must be exportable before expiry**, and ECO-004 calls
>    that a hard requirement, not a nice-to-have.
> 3. **A free multi-tenant backend is an open write endpoint.** Record caps, rate limits,
>    bundle-size caps and a per-app kill switch are **v1 scope, not hardening**.
> 4. **A published app collecting personal data makes the builder a controller and us a processor**
>    — which needs a DPA. This is a *different* legal posture from D10: D10 covers **learners**,
>    this covers **the end users of learners' apps**.
> 5. 🔴 **D9 × D10 intersect.** A pupil on an org-minor account publishing an app that collects data
>    from other children is the case to think about before it happens. **Recommend the backend tier
>    be off by default for org-minor accounts**, matching the AI-projection default D10 already set.
>
> **Scheduling:** this **confirms** the deliberately-last placement rather than changing it, and it
> **raises the effort**. Do not pull this task earlier because the wow is tempting — it is now the
> only task in the phase carrying both a standing ops burden and a standing legal one.
> ⚠️ Unchanged: the exporter publishes by allow-list, and hosting **must never widen
> `PUBLISHABLE_AUTH_FIELDS`**.

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
