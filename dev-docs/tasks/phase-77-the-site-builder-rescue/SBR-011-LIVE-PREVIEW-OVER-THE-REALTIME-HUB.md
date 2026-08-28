# SBR-011 — Live preview over the realtime hub

**Fixes finding 6.** 🧭 **Ruled s1: BUILD it** — against the assessment artifact's
recommendation to strike. The README §2 promise ("live preview via `Subscribe to Changes`, SSE
realtime hub — delivery gated by the same ACL predicate as queries") becomes true instead of
deleted.

## 1. The person sentence

**With the site open in one tab and the admin panel in another, publishing a change updates the
open site without a reload.**

## 2. Scope

- `Subscribe to Changes` into the public site's query chains: page/section/theme change events
  re-drive the affected queries (slug resolve, sections, nav, theme overlay).
- The admin panel's Preview (SBR-007) rides the same mechanism: an owner editing sees the
  preview move.
- Theme record changes propagate live: the SBR-009 demo becomes "watch the site repaint".
- Scope boundary: the SSE hub itself exists and is not this task's to modify — this is template
  wiring plus whatever thin gaps a real consumer flushes out (this template's whole job,
  historically: expect to find platform defects and file/fix them as they surface).

## 3. Acceptance criteria

1. **(person)** Two contexts open (anonymous site + owner admin); owner publishes a page; the
   site's nav gains the link without reload — driven, with the no-reload half proven (e.g. a
   stamped window property surviving the update).
2. Section edit on the currently-viewed page updates its rendering live.
3. Theme save repaints the open site live.
4. ACL predicate honoured: an anonymous subscriber does NOT receive draft/unpublished change
   payloads (drive the negative — subscribe, edit a draft, assert silence beside a known-firing
   signal for the published case).
5. With the hub unreachable, the site still works statically (subscription failure degrades to
   the current refresh-to-see behaviour, silently — not a broken page).

## 4. Traps

- 🔴 Asserting "no event arrived" needs the known-firing twin beside it, or the spec passes on
  a dead subscription.
- 🔴 `Run` is additive and a node can run on its own — wiring a re-query must not double-fetch
  (assert cardinality of fetches per event where two producers meet).
