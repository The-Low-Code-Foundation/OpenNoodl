# FIX-010 — The picker scrolls away from its answer

**Report 7** · Tier 2 · Effort **S**

> *"When I open the node picker and search 'CSS', the search results start offset Y downwards, so
> you don't see the CSS result unless you manually scroll up."*

## Mechanism — pinned (high confidence; verify live in one devtools read)

No virtualization; nothing ever resets `.Results`' `scrollTop` (grep: zero hits). The only scroll
authority is the cursored card scrolling **itself** into view
(`NodePickerCard.tsx:31-35`, `scrollIntoView({block:'nearest'})` on `isCursored`), combined with
the reducer's deliberately **sticky cursor** (`NodePicker.reducer.ts:88-89` keeps `cursorKey` if it
survives a re-rank — asserted by `NodePickerReducer.test.ts:35`).

The "CSS" sequence: the cursor starts on the first browse item; `matchNode` matches **port names**
(`NodePicker.search.ts:182-200`) and the head-of-list layout nodes carry `cssClassName`/`styleCss`
ports, so the cursored item *survives* the query — but a port match ranks `RANK_PORT = 2000`
(`:125`) vs ~0 for a name match, so it sits far **down** the search list. Group keys differ between
browse and search (`${cat}::${title}` vs `search::${cat}`, `:498`/`:441`), so every card remounts
on the first keystroke; the carried-over card mounts `isCursored`, its effect fires, and
`scrollIntoView` drags the pane down to it — leaving the actual CSS matches above the fold.
`scroll-behavior: smooth` (`NodeLibrary.module.scss:22`) turns it into an animation that can land
stale on later keystrokes.

## Fix direction

1. **Reducer (the fix):** clear `cursorKey` when the **query** changes (scope the stickiness to
   re-rank/category changes only). `SetResults` then re-anchors to `itemKeys[0]` — the top result —
   and scrolls it into view. Update `NodePickerReducer.test.ts:35-42` deliberately: keep-on-rerank
   stays asserted, keep-on-query-change is inverted.
2. **Hardening (optional):** `.Results` ref → `scrollTop = 0` on `[state.query]`; drop
   `scroll-behavior: smooth`; `overflow-anchor: none`.

🔴 **Verify first, one line in devtools:** with "css" typed, read the `.Results` element's
`scrollTop` and `state.cursorKey`. `scrollTop > 0` with the cursor on a port-match card confirms
the diagnosis as written.

## ✅ BUILT 2026-08-14

**Fix 1 (the reducer):** `SetQuery` now clears `cursorKey`, so `SetResults` re-anchors to
`itemKeys[0]`. `SetActiveCategory` deliberately untouched — keeping your node while you filter the
rail is the stickiness worth having, and it cannot scroll away from a better answer because the
ranking has not changed.

🔴 **The existing spec was the confusion in miniature.** `NodePickerReducer.test.ts:35` claimed to
keep the cursor "when the results are re-ranked" and its comment said *"another keystroke re-orders
the same three results"* — but it never dispatched `SetQuery`, so it asserted re-rank stickiness
while describing the keystroke case that is the bug. There was no keep-on-query-change assertion to
invert. Corrected the comment, and added two specs: re-anchor on a real query change (including the
case where the cursored node still matches — the "CSS" sequence), and no disturbance when a query is
re-set to the value it already had.

**Fix 2 (hardening):** dropped `scroll-behavior: smooth` from `.Results` and added
`overflow-anchor: none`. The smooth scroll is the part that makes it land *stale*: it is still
animating toward the previous keystroke's answer when the next one lands.

**Still open:** the devtools `scrollTop` read and acceptance criteria 1–2, which need the drive.

## Acceptance criteria

1. Open picker → type "css" → the top-ranked CSS result is visible at the top of the pane with no
   manual scroll. Driven.
2. Arrow-key to mid-list, change category rail → cursor keeps its node (the stickiness that must
   survive).
3. Reducer specs updated and green.
