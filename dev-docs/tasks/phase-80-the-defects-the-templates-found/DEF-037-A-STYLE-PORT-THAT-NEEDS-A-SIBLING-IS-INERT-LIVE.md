# DEF-037 — a style port whose effect needs a sibling property does nothing until the preview reloads

**Found by** DEF-031's drive, [§6.3](DEF-031-A-TEXT-CANNOT-BE-ELLIPSIZED.md). **Status ⬜ open.**
**Owner: NONE** — registered as work, not as notes on another row.

---

## 1. The person sentence

Someone sets **Text Overflow → Ellipsis** on a label that is wrapping onto a second line and
breaking their row alignment. **Nothing happens.** They set it back to **Wrap**. Nothing happens
either. The port is doing its job perfectly — but only after the preview is reloaded, and nothing
on screen says so.

## 2. The mechanism

`Text.tsx` decides three properties together (DEF-031 §2): a truncating `textOverflow` also forces
`white-space: nowrap` and supplies `overflow: hidden`; the wrapping arm instead sets
`white-space: pre-wrap` + `overflow-wrap: anywhere` and **deletes** `style.textOverflow`.

The live-preview path patches **the port's own declaration onto the element** and does not run the
render. So the derived siblings never change:

| set live | DOM afterwards | what the author sees |
| --- | --- | --- |
| `wrap → ellipsis` | `text-overflow: ellipsis` **+ `white-space: pre-wrap`** | still wraps — port looks broken |
| `ellipsis → wrap` | `text-overflow: ellipsis`, `nowrap`, `hidden` | still truncated — port looks stuck |

Both measured in a real editor's live preview, session 35.

## 3. ✅ The control — it is not "style ports don't update live"

`wordBreak`, the **pre-existing** sibling `inputCss` port on the same node, set the same way in the
same session, **applied immediately** (`word-break: break-all`). The live-patch path works.

🔴 **The difference is derivation, not liveness.** `wordBreak` *is* its own CSS declaration.
`textOverflow` only means something in company with properties the render computes. **It is the
first `Text` style port of that kind**, which is why nothing caught this before.

## 4. What is NOT known — say it before quoting this row

- ⚠️ **The population is one port, measured.** Whether any other `inputCss` port on any other node
  derives a sibling in render has **not been swept**. The obvious next measurement is to grep the
  visual components for style properties written outside the direct `inputCss` fold.
- ⚠️ **The reload does fix it**, and the parameter persists correctly (`"textOverflow": "ellipsis"`
  verified in `project.json`), so this is a feedback-loop defect, not a correctness one.
- ⚠️ **Not measured against the deployed/exported app at all** — only the editor's live preview.

## 5. Acceptance criteria

- **AC1** Setting a truncating `Text Overflow` in a running preview makes the label truncate
  without a reload.
- **AC2** Setting it back to `Wrap` restores wrapping in a running preview without a reload.
- **AC3** A control port that needs no sibling (`wordBreak`) still applies live — the fix must not
  be "re-render the whole preview on every style change".
- **AC4** The sweep in §4 is taken: every `inputCss` port whose effect depends on a property the
  render derives is named, or the absence is measured with a known-firing control beside it.
- **AC5** Driven in a real editor, both directions, without a reload.

## 6. Traps this row paid for

- 🔴 **An impossible DOM combination is a signal about the PATH, not the fix.** `ellipsis` beside
  `pre-wrap` cannot come out of `Text.tsx` — the wrapping arm deletes `textOverflow`. Reading that
  as "the fix does not work" would have reopened a correct row and hidden a real one.
- 🔴 **A control from the same family is what separates "this port" from "all ports".** Without
  `wordBreak` applying live, this row would have been filed as a platform-wide defect it is not.
