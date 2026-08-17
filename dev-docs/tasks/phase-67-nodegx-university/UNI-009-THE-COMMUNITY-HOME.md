# UNI-009 — the community home

**Surface:** platform · **Tier 1 (minimal cut — lands WITH UNI-001)** · **Effort:** S/M · ✅ **UNBLOCKED — D2 ruled 2026-08-14**

> **D2** ([RULINGS.md](RULINGS.md)): this task **is** the site. The platform is called **NodeGX
> Community**, served at `community.nodegx.io`, and **NodeGX University is one wing of it** —
> the learning section beside the forum, the RFP board, the prefab shelf and the replay library.
> The tutorials index is a card on this page, not the point of it.
> ✅ **AMENDED 2026-08-17.** This note used to read *"the domain is a choice this ruling makes, not a
> fact it records — `nodegx.dev` is not registered and still has to be acquired."* The host is
> **`community.nodegx.io`** and it **resolves** (A → nexus-1 `49.12.102.195`); `nodegx.io` was
> already registered and serving the landing page, so the ask was a subdomain record, not a
> purchase. ⚠️ **Nothing serves the host yet** — no Caddy site block, platform deployed nowhere.

## Premise

A login has to open onto something. The community home is the something: tutorials and tips,
the weekly meetup replay library, and a forum that isn't Discord ("Discord seems pretty dead
these days"). It is deliberately the least clever task in the phase — content pages and a
bought forum — and that's why its minimal cut ships first, alongside UNI-001.

## Scope (v1 — the minimal cut)

- **The home**: what NodeGX is, what the community offers, sign-in.
- **Replay library**: the weekly community meetup recordings, listed and watchable, newest
  first. (Chaptering and per-node deep links from the editor are the dream — deferred; a plain
  list is the v1.)
- **Tutorials & tips index**: the existing written material, organised. This is a content
  surface, not the UNI-007 lesson system — static articles until the lesson bridge exists.
- **The forum: Discourse, hosted, with SSO** against the NodeGX account (UNI-001's OIDC face).
  🔴 Bought, not built — building forum software is how solo founders die. Categories seeded
  (help, showcase, meetups, RFP chatter until UNI-004 exists), Richard + volunteers as mods.
  Discourse's webhooks later feed UNI-002 (accepted answer → points).
- **Q&A as an asset**: from day one, forum content is licensed/structured so answered questions
  can later feed the in-editor AI's retrieval (the flywheel from the 2026-08-14 brainstorm) —
  a licensing footnote now saves a migration later.

## Acceptance criteria

1. Sign in once (NodeGX account) → the forum session follows via SSO; sign-out kills both.
2. Replays and tutorials render and are reachable logged-out — the *content* gates nothing
   either; the account adds posting, progress, and (later) points.
3. A forum answer marked accepted fires a webhook we successfully receive (even if v1 only
   logs it — the UNI-002 hook is proven live).

## Not in v1

Chaptered replays with per-node deep links, the showcase gallery, search across all surfaces,
newsletter, the education-programme landing page (waits for UNI-005/006 to have something to
sell).
