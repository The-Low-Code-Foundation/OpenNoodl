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


> 🔴 **AMENDED 2026-08-18 — D19 REVERSES THIS TASK'S FORUM DECISION.** The scope line below said
> *"the forum: Discourse, hosted, with SSO — bought, not built"*, and **AC1 and AC3 were written
> against it**. Both are **STRUCK** and rewritten below. The forum is now **built**, as the Q&A
> surface for NodeGX artifacts — see [D19](RULINGS.md) and **UNI-015** / **UNI-016**.
> ⚠️ **UNI-009 keeps everything else it always had** (the home, replays, tutorials index); it simply
> stops owning the forum, which is now five tasks of its own.

## Premise

A login has to open onto something. The community home is the something: tutorials and tips,
the weekly meetup replay library, and a forum that isn't Discord ("Discord seems pretty dead
these days"). It is deliberately the least clever task in the phase — content pages and an entry
point — and that's why its minimal cut ships first, alongside UNI-001. ⚠️ *(It was "content pages
and a bought forum" until D19; the forum left, the modesty stayed.)*

## Scope (v1 — the minimal cut)

- **The home**: what NodeGX is, what the community offers, sign-in.
- **Replay library**: the weekly community meetup recordings, listed and watchable, newest
  first. (Chaptering and per-node deep links from the editor are the dream — deferred; a plain
  list is the v1.)
- **Tutorials & tips index**: the existing written material, organised. This is a content
  surface, not the UNI-007 lesson system — static articles until the lesson bridge exists.
- ~~**The forum: Discourse, hosted, with SSO.** Bought, not built.~~ 🔴 **STRUCK 2026-08-18 by
  D19 — built, not bought.** The forum is **UNI-015** (ask/read/answer/accept) and **UNI-016**
  (artifact posts), with **UNI-014** as its condition. What survives from this line: the seeded
  sections (**help, showcase, meetups**), Richard + volunteers as mods, and the accepted-answer →
  points hook — which is now a call in the same transaction rather than a webhook, and is **simpler**
  for it. ⚠️ **This task keeps the entry point**: the home links to the Bench and lists recent
  threads. It no longer owns the forum itself.
- **Q&A as an asset**: from day one, forum content is licensed/structured so answered questions
  can later feed the in-editor AI's retrieval (the flywheel from the 2026-08-14 brainstorm) —
  a licensing footnote now saves a migration later.

## Acceptance criteria

1. ~~Sign in once → the forum session follows via SSO; sign-out kills both.~~ 🔴 **STRUCK by
   D19 — there is no second session to follow.** Replaced by: **the home's forum entry point shows
   real recent threads to a signed-out reader**, and shows the composer only to a viewer who may
   post (D15). ⚠️ Weaker-looking and strictly harder to fake: the old criterion could be met by two
   systems agreeing about a cookie, this one requires the forum to exist and have content.
   🆕 **OWNED 2026-08-18 by [UNI-019](UNI-019-NOTHING-ON-THE-HOME-PAGE-IS-A-LINK.md).** This
   criterion is the phase's close item **E3** and has been open since session 28 with no task
   behind it. 🔴 **The reason it is still unmet is worse than "the rail was not built": the home
   page has no links at all** — six `<section class="card">` with zero anchors — so the entry point
   this criterion is about does not exist as a clickable thing, and `/bench` is reachable from
   nowhere in the app.
2. Replays and tutorials render and are reachable logged-out — the *content* gates nothing
   either; the account adds posting, progress, and (later) points. *(Unchanged.)*
3. ~~A forum answer marked accepted fires a webhook we successfully receive.~~ 🔴 **STRUCK by D19
   — the webhook was the seam between two systems and there is now one system.** The criterion it
   existed to prove (*"the UNI-002 hook is live"*) moves to **UNI-015 AC2**, where it is stronger:
   the award happens **in the same transaction as the accept**, so a control can prove the accept
   rolls back with it. ⚠️ **Do not read this as a criterion being dropped** — it moved and got
   sharper.

## Not in v1

Chaptered replays with per-node deep links, the showcase gallery, search across all surfaces,
newsletter, the education-programme landing page (waits for UNI-005/006 to have something to
sell).

> 🆕 **AMENDED 2026-08-18 — two of these deferrals now have owners, and one deliberately does not.**
> A deferral with no owner is indistinguishable from an oversight, and both of these were being read
> as oversights by the time somebody looked at the running site.
>
> - **Chaptering** → **[UNI-021](UNI-021-REPLAYS-YOU-CAN-ACTUALLY-WATCH.md)**. ⚠️ Only the web half:
>   chapters are one table and a timestamp. **The per-node deep link from the editor stays deferred.**
> - **Search** → **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md)**, and 🔴 **only the per-list half.**
>   *"Search across all surfaces"* — one box over threads, tutorials, replays and people — **remains
>   deferred here**, because it needs an index rather than a `where`. ⚠️ Per-list search is not a
>   down-payment on it.
> - **Showcase gallery, newsletter, education landing page** — unchanged, still deferred, still
>   unowned by choice.
