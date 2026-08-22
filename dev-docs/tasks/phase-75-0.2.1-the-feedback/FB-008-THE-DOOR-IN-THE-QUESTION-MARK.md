# FB-008 — the door in the question mark

**Filed:** 2026-08-22, from Richard's item 8. **Status: ✅ done 2026-08-22.** Size: S — the
smallest task in the phase.

> *"The community web page link should go into the question mark icon at the bottom right of the
> editor."*

---

## What exists (swept 2026-08-22)

- `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx:75–84` lists:
  Documentation, YouTube, **Discord**, Report a bug, Report a node behaving wrongly, Suggest a
  feature. No community entry — and the Discord it links is the thing the community wing exists
  to retire (UNI-011: *"the immediate goal behind it is Richard retiring the Discord"*).
- NAT-012 AC2 is an `openExternal` audit that would sweep this file eventually; no need to wait
  for it.

## Scope

Add "NodeGX Community" → `https://community.nodegx.io` to the help menu. Decide Discord's row in
the same edit: keep both during transition, or demote/remove Discord now — one line either way,
but removing it is Richard's call (default: keep it until he says).

## Acceptance criteria

- AC1: the ?-menu lists NodeGX Community and it opens externally via `openExternal` (the same
  path the other rows use — `linkActionFor` ignores non-http schemes, so a plain https URL).
- AC2: a spec asserts the entry exists (the HelpCenter list is enumerable; assert by label so
  the audit in NAT-012 AC2 finds it accounted for).
- AC3: Discord's fate recorded in the commit message — kept or removed, on whose word.

---

## Done — 2026-08-22

- **AC1** ✅ `NodeGX Community` sits above `Discord` in the `?` menu and opens `COMMUNITY_URL`
  through `platform.openExternal`. The origin is **imported from
  `@noodl-models/community/communityorigin`**, not added to `EXTERNAL_LINKS`: core-ui owns that
  constant and must not know about the platform, and the origin already has exactly one owner.
- **AC2** ✅ `tests-unit/fb-008/help-menu-destinations.test.ts`, 10 assertions. It grades the
  **table the component maps over**, not the rendered menu.
  🔴 **The menu could not be imported into a spec as it stood** — `HelpCenter.tsx` reaches
  core-ui's `Icon`, which calls webpack's `require.context`, and ts-jest rejects that at
  type-check time, so the suite failed to *run*. The list therefore moved to a sibling module,
  `views/HelpCenter/helpCenterLinks.ts`, whose only imports are two dependency-free constants.
  That is the same shape `tests-unit/support/renderElements.ts` already warns about.
  ⚠️ The spec's last test is the weaker source-level half — that the view still renders
  `HELP_CENTER_LINKS` rather than a list of its own.
  ✅ Mutation-checked: deleting the community row turns 2 of the 10 red.
- **AC3** ✅ **Discord kept.** The community wing exists to retire it (UNI-011), but retiring it
  is a move you make once the replacement has people in it, not the day you first list it —
  recorded in `helpCenterLinks.ts` beside the row, so the next reader finds it without the
  commit message. Reversing it is one line, on Richard's word.
- Side benefit for **NAT-012 AC2**: the `openExternal` audit now has one call site here instead
  of eight.
