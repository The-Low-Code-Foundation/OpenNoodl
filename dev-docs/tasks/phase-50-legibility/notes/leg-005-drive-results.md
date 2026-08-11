# LEG-005 — the drive, executed

**2026-08-12**, in the primary checkout, against a **copy** of `nodegx-qa-fixture` (71 nodes)
registered in the launcher's recent-projects store and opened cold. The source fixture was never
opened and is byte-untouched; the store was restored afterwards.

This executes [`leg-005-lane-notes.md`](leg-005-lane-notes.md) **§4** verbatim. The lane shipped
LEG-005 without ever painting it — *"nothing was ever painted"* was its own honest words. **It has
now been painted, and all eight steps pass.**

---

## 1. Result table

| § | Step | Result |
|---|---|---|
| 4.1 | Row renders for a node with **no** comment | ✅ `barPresent: true`, label `Comment`, placeholder exact |
| 4.1 | Height ≥ 48, mirror drives the box | ✅ `height: 48` **=** `sizerHeight: 48` at a 324px panel |
| 4.1 | Order: label → comment → tabs | ✅ `property-editor-label-and-buttons`, `property-comment-bar`, `Tabs-module__Root` |
| 4.2 | Type → commit → model holds it | ✅ accents survive `toJSON` |
| 4.3 | Stripe repaints with **no** reselect | ✅ **246** stripe pixels appeared with no paint call |
| 4.4 | One undo removes it, field resyncs | ✅ model cleared, field `""`, canvas back to baseline at **0** pixels diff, `ptr` −1 |
| 4.5 | Clearing matches the popup exactly | ✅ byte-identical shapes |
| 4.5 | Whitespace-only | ✅ stores nothing, field ends `""`, label `Remove node comment` |
| 4.6 | Save, close, reopen | ✅ survived a **full process restart** |
| 4.7 | Contrast, both themes | ✅ **all eight predictions confirmed by sampling** |
| 4.8 | The eyeball | ✅ placeholder wraps to two lines, fully visible, not clipped |

**Both of the lane's own "most likely to be wrong" candidates were refuted**, which is worth saying
plainly because they were the reason to drive this at all.

---

## 2. §4.7 — the contrast table, measured rather than computed

The lane's table was **arithmetic on `colors.css` token hexes, not samples**, and it said so. This
repo has a long record of a computed ratio being wrong about the element it claimed to be about, so
every pair below was sampled off the live element with `fg` and `bg` hex printed beside the ratio.

**Every predicted number was confirmed exactly.** The lane's arithmetic was right.

| Pair | Theme | fg / bg (sampled) | Measured | Predicted |
|---|---|---|---|---|
| Label `fg-default-shy` on `bg-1` | dark | `#8b95a1` / `#12161b` | **5.98:1** | 5.98 ✅ |
| Comment text `fg-default` on `bg-2` | dark | `#a6b0bb` / `#181d24` | **7.70:1** | 7.70 ✅ |
| Placeholder `fg-default-shy` on `bg-2` | dark | `#8b95a1` / `#181d24` | **5.57:1** | 5.57 ✅ |
| Field border on `bg-1` (3:1 floor) | dark | `#6b7682` / `#12161b` | **3.93:1** | 3.93 ✅ |
| Label | light | `#616c79` / `#ffffff` | **5.34:1** | 5.34 ✅ |
| Comment text | light | `#4a5663` / `#f7f9fb` | **7.10:1** | 7.10 ✅ |
| Placeholder | light | `#616c79` / `#f7f9fb` | **5.06:1** | 5.06 ✅ |
| Field border | light | `#7c8894` / `#ffffff` | **3.62:1** | 3.62 ✅ |

Type sizes: label **10.5px**, field **12px** — so AA's 4.5:1 normal-text floor applies, and every
text pair clears it in both themes. The border clears the 3:1 non-text floor in both.

`::placeholder` resolves to **exactly one** rule, as the structural spec requires:

```css
.property-comment-input::placeholder { color: var(--theme-color-fg-default-shy); opacity: 1; }
```

---

## 3. §4.3 / §4.4 — the stripe, and how it was actually measured

The stripe is `theme.commentIndicator` → `--theme-color-primary`, which resolves to **`#4da3ff`** —
identical to the painter's hardcoded fallback, so the token and the fallback cannot be told apart by
colour alone. Confirmed at `NodeGraphEditorNodePainter.ts:302`.

**Isolated witness, nothing selected:** **247 pixels** of exactly `rgb(77,163,255)` in a **4 × 64**
bounding box — at DPR 2 that is 2 × 32 CSS px, a thin vertical bar the height of the titlebar. One
stripe, on the one node with a comment.

- **The binding works.** Setting a comment and calling **no** paint produced 246 stripe pixels within
  3s. `ModelBindings.ts`'s `commentChanged` → `repaint()` is what makes undo and the row repaint the
  gutter; before LEG-005 the popup was the only writer and it called `owner.repaint()` by hand.
- **Undo returned the canvas to the baseline at a 0-pixel difference** — not "close", identical.

⚠️ **Two traps in measuring this, both of which produced a false negative first:**

1. **A tolerance of ±12 around `#4da3ff` misses the node icon at `#5ca9ff`** and, worse, invites the
   conclusion that nothing painted. Match the exact triplet.
2. 🔴 **Several nodes in this fixture sit stacked at the same `global` position**, so a stripe on one
   of them is overdrawn by another node's card and toggling it changes **zero** pixels. The first
   node the walk picked (`g`) was one of these, and it read exactly like *"the stripe never paints"*.
   **Pick a node with a unique screen position, or diff across all nodes at once.**

---

## 4. The one thing that looked like a defect and is not

Typing into the field and then switching node **loses the text** — *if* the switch is
`ed.selectNode()` from `cdp eval`. It is **not** a defect, and the reason matters:

🔴 **`el.focus()` / `el.blur()` dispatch no `blur`, `focusout` or `change` event at all when the
Electron window lacks OS focus.** `document.activeElement` still moves, so the drive looks correct
while React's `onBlur` never runs. Probed directly: `{eventsFired: [], hasFocus: false}`.

This is why the same technique committed correctly at 4.2 and silently stopped later — focus had
drifted, not code. **Check `document.hasFocus()` before believing a negative from a focus-driven
handler.**

Under real trusted input the commit is correct, including the case the lane called its
second-most-likely failure — **blur racing the panel remount**:

- real `cdp click` into the field → `document.hasFocus()` flips to `true`;
- native-setter write + `input` event;
- real `cdp click` **onto a different node** (panned under the canvas centre so the click lands on it);
- → the text lands on the node it was typed for, **nothing leaks onto the node clicked**, and the
  field resyncs to that node's value.

---

## 5. §4.6 — persistence, end to end

`commentChanged` **is** on `projectSaveTriggers` (`projectmodel.ts`), so the row's commit arms a
project save on its own. Verified all the way down:

1. commit → `getComment()` returns the sentence;
2. → `project.json` on disk carries `metadata.comment`, accents intact;
3. → **`npm run dev:stop`, full relaunch, cold reopen from the launcher** → `getComment()` still
   returns it, the row shows it, and the stripe is on the card.

⚠️ Grepping `'"comment":"'` finds nothing — the file is pretty-printed, so the colon is followed by a
space. Parse it, do not grep it.

---

## 6. Not verified, and one thing seen in passing

- **The canvas-tooltip half of the label's tooltip copy** — *"Shown when you hover the node on the
  canvas"* — was not exercised. It is pre-existing behaviour, not LEG-005's.
- **Redo** was not driven; only undo, which is what §4.4 asks for.
- Seen in passing, unrelated: the fixture raises *"Could not deploy cloud functions: TypeError: fetch
  failed"* on open, because it contains a `/#__cloud__/test` component and no backend is running.
  Nothing to do with LEG-005.
