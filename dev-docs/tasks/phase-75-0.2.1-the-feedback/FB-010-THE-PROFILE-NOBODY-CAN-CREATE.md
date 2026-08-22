# FB-010 — the profile nobody can create

**Filed:** 2026-08-22, from Richard's item 10. **Status: ⬜ open.** Size: M. 24th *build the
caller*.

> *"When you click on your username at the top right, it comes up to
> community.nodegx.io/u/richardosborne14 and a 404 page. It would be nice to personalise your
> profile with an avatar (maybe some default ones to choose from if that exists as OSS), your
> bio, experience, badges etc."*

---

## What exists (swept 2026-08-22)

- **The page is built and the 404 is by design for a profile that doesn't exist** — UNI-003:
  `src/app/u/[handle]/page.tsx` calls `publicProfile()` and `notFound()` on null, deliberately
  indistinguishable across private/hidden/never-created (no enumeration leak). **Keep that.**
- **`upsertProfile` in `src/lib/profiles.ts` has no caller.** There is no `/settings`, no
  `/account` route at all (`src/app` holds auth, bench, coaching, orgs, people, replays, rfps,
  tutorials, u, university, unsubscribe). A signed-up account **cannot become public**, so every
  `/u/<handle>` 404s by construction — including the header's own link to your profile, which is
  the broken promise Richard clicked.
- **Badges are done**: UNI-013 slice 4 — twelve SVGs, CSS-mask painted, theme-correct. The coach
  queue lens already shows on public profiles (UNI-017).
- Recorded adjacent gap (`phase-72/TASKS.md:21`): *"this platform has no account page"* — the
  editor's 30-day grant can only be revoked from the editor. Same missing page.

## Scope

One `/settings` (or `/account`) page for a signed-in account:

1. **Profile**: create/edit — display name, bio, experience line, visibility (public/hidden).
   Saving calls `upsertProfile`; the header link stops 404ing the moment visibility is public.
2. **Avatar**: a fixed set of bundled defaults, OSS. Candidates: DiceBear (MIT, can pre-generate
   static SVGs — do NOT add it as a runtime dependency; this repo's production dependency list
   is five packages and that is a defended number) or hand-drawn marks in the badge style.
   **Pre-generated static assets in the repo, licence text alongside.** No uploads in v1 — an
   upload is a moderation surface (D7) and an object-store key; defaults are neither.
3. **Sessions**: list active grants (web + editor device-flow) with revoke — closes the
   editor-only-revocation gap NAT-007 documented.
4. Badges render on your own settings page as they do publicly — read-only, no new machinery.

## Acceptance criteria

- AC1: a signed-in account creates a profile, sets visibility public → `/u/<handle>` 200s and
  the header link works; setting hidden → 404 again, same shape as never-created.
- AC2: avatar chosen from defaults renders on `/u/<handle>`, `/people`, and bench author lines —
  wherever `PersonProfile` already draws the disc. ⚠️ The editor mirror fetches no remote
  images (NAT-008's decision): the mirror keeps its flat disc unless FB-007's display decision
  reverses that; don't reverse it here as a side effect.
- AC3: an editor grant revoked from the web stops working in the editor (driven), and
  `nat007-device-consent.test.tsx`'s assertion of the *absence* of web revocation is updated —
  that spec asserting an absence is the one this task makes false, on purpose.
- AC4: bio/experience are free-text columns → data-inventory census classification; the route
  gets a D15 verdict; envelope contract; byte-capped writes.

## Traps

- Do not weaken UNI-003's three-states-one-404 property while making the page reachable.
- The header's profile link should point at settings when no public profile exists, not at a
  404 — the 404 stays correct for *strangers*, not for yourself.
