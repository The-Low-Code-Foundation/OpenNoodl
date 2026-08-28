# Phase 78 — next session

## Where it stands

**TPL-001 (the members' area) has a working, committed generation pipeline and a vertical
slice through it.** Nothing is published and nothing has been driven.

| | |
|---|---|
| built | `App`, `Pages/Landing`, `Pages/SignIn`, `Pages/Members` |
| source of truth | `packages/noodl-mcp/tests/tpl001Components.ts` |
| composition | `packages/noodl-mcp/tests/tpl001Template.ts` |
| generator | `npm run template:members` → `templates/members-area/` |
| proven | 3 pages registered, `startPage: /Pages/Landing`, importer clean, **two runs byte-identical** |

Read **TPL-001 §9 (Findings)** before touching any of it — four of the five cost a measurement.

## Next, in order

1. **Grow the component set** — announcements and meetings (list + detail), the moderator's
   post form, and approve-a-member. The last one is a cloud function using `Add User To Role`
   (`noodl.cloud.addusertorole`); 🔴 its `call` rule must be `role:admin` — `SystemRoles.ts`
   warns that a `public` function holding that node is the whole security model gone.
2. **`nodegx.security.json`, hand-authored** (never generated — the site-builder's is
   hand-edited for the same reason). 🔴 No rule may say `authenticated`; see §9.
3. **The drift gate** — a spec that regenerates and asserts byte-identity, the way
   `sb007Template.test.ts` does. Note it must exclude the hand-authored policy file: the
   artefact and the policy are two populations.
4. **The drive** (needs the editor seat, by appointment — P77 is driving SBR-004). AC2/AC3 are
   the ones that matter: signed out sees **nothing**, and a **pending** member is refused
   exactly as a stranger is, each beside a known-firing signed-in read.
5. **TPL-002** (email) only after TPL-001 stands on its own.

## Standing

- Delivery is **curated**: build a directory, Richard publishes. Touches no editor source, so
  no collision with P77. **T3 and T4 stay parked** behind P77.
- Shared checkout: commit by pathspec, untracked ⇒ add+commit one chain. `test:ci` alone.
  Announce editor launches **and** teardowns.
