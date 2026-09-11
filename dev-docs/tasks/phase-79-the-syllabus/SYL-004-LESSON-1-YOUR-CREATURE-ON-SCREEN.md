# SYL-004 — lesson 1, "Your creature, on screen"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/your-creature-on-screen` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) |
| **State** | 🟢 **Built, gated and driven 2026-08-28.** ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 1. A card with a creature and a name, built from **Group, Circle, Text** — and
**no connections at all**. Four graded steps between an intro and an outro popup.

```
Page "Home"
  └ "Page shell"  (Group)   ungraded furniture, already in the starter
      └ "Card"    (Group)   ← step 2 adds it, step 3 sets sizeMode + a colour
          ├ "Creature" (Circle)  ← step 4
          └ "Name"     (Text)    ← step 5
```

## Where the content came from

Richard's own curriculum entry supplied four of the five brief lines verbatim — the end state
("a card with a picture, a name and a coloured frame"), the ideas (`teaches: elements, hierarchy,
properties`), and the node list. **The fifth line was his and only his**, given in conversation:
the five places beginners get stuck. Mapped against the spine, only **one** of the five is lesson
1's — *"using groups to place visual elements with the user's desired formatting, dimensions"* —
and it splits, with sizing going to the new lesson 2.

🔴 **That mapping is worth keeping**, because the other four say where the curriculum's weight
should be: components/signals-across-canvases is **spine lesson 10 of 12**, and Richard named it
first. See [NEXT-SESSION-PROMPT](NEXT-SESSION-PROMPT.md).

## 🔴 The one property graded by value, and why

`sizeMode: contentSize` on the Card, via `paramsEqual`.

Verified from the catalog, not assumed: **Group's `width` and `height` both default to `100`, unit
`%`**, and `backgroundColor` defaults to `transparent`. So a brand-new Group swallows the screen.
That is Richard's stuck point #3 in one property, and teaching it is *not* the same as teaching
responsive sizing — which is deliberately left to `it-breaks-on-a-phone` at spine position 2.

Everything else the learner chooses is graded with **`hasParams`, on purpose**: the colour, the
circle's size and fill, the creature's name. The brief warns that a condition weaker than its prose
is the failure that ships silently and that the pressure only points one way — so the rule applied
here is: **if the body names a value, `paramsEqual`; if it genuinely does not, `hasParams`, and say
so in the step text.** Step 3's `detail` tells the learner in as many words that any colour will do.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 4 graded steps. 🔴 **`allow_unrendered` NOT used** — F4 ("the solution draws nothing") is the class that matters most for a purely visual lesson. |
| `lessons:check` | **exit 0, 2 bundles, 10 components, 37 nodes.** `your-creature-on-screen — clean (starter 2c/3n, solution 2c/6n)`. |
| the subtraction, arithmetically | solution **6** nodes − starter **3** = the three the learner builds: `Card`, `Creature`, `Name`. |
| `render_report` | 0 findings, desktop **and** phone, screenshots looked at. The card hugs its contents at both sizes. |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed. The only spec touching the corpus, `tut-004/the-real-bundle-installs.test.ts`, is pinned to `log-a-thing` by path. |

## ✅ The drive, with a control pair

Driven in the running editor through real CDP clicks.

| | reading |
|---|---|
| lesson installs and lists | title, description, "Not started 0%" |
| step 2 opens | body renders, **`<details open>` with summary "Show me how"** — SYL-001's field, live |
| the condition renders as prose | *"Looking for a Group called "Card" on Home."* |
| 🔴 **negative control** — check my work on the **untouched** starter | **not complete.** The lesson does not tick itself. |
| 🔴 **positive** — Card added, check again | **step 1 `completed`, runner auto-advanced to step 2** |
| step 3's conditions render | *"Looking for "Card" with sizeMode set to "contentSize" and backgroundColor set on "Card""* — **both verbs surfaced** |

⚠️ **What the drive did NOT cover, stated rather than implied:** the *install-from-a-folder* path.
The bundle was placed in `Learning/` and registered in `learning_folder.json` directly, because the
real installer goes through a **native file dialog CDP cannot drive**. That path is already specced
by `tut-004/the-real-bundle-installs.test.ts`. What was driven is the half nothing else covers —
the runner reading a learner's live project and grading it.

## 🔴 A product defect the drive found

**Pressing "Check my work" on an incomplete step removes the instructions.** The popup — body *and*
the `detail` disclosure — is taken out of the DOM entirely (`details: 0`, `[data-template=popup]:
0`), and the only way back is knowing to click the step in the timeline, which restores it.

It is the **runner's** behaviour, not this lesson's, so it applies to `log-a-thing` too. And the
check produced **no new visible feedback** — the "Looking for…" line was already on screen before
the click — so from the learner's side, pressing the button loses your instructions and tells you
nothing. ⬜ **Not fixed here.** Raised as work, per the standing rule that defects found while
building go in the next-session prompt.

## ⬜ What is Richard's

1. 🔴 **The step prose.** Six bodies and four `detail` blocks, drafted so he is editing rather than
   staring at a blank page. The workshop's own split says the words that ship are his.
2. **The `description`** — currently the curriculum entry's sentence with "picture" changed to
   "creature", because there is no picture yet (see [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)).
3. **The badge**, currently `First Light`.
4. ⬜ **Does the creature get eyes?** One Circle today. Eyes need absolute positioning, which is
   lesson 2's subject — so this is a real call, not a detail.

## Traps carried out

- ⚠️ **`detail` prose that names editor chrome must be checked against the editor.** The panel
  group names used here (**Dimensions**, **Style**) are not invented — they came back from
  `get_node_type` as each port's `group`. The node-picker sentence in step 2's `detail` is the one
  line describing an interaction rather than a verified label, and it is the line to check first
  if the editor's picker ever moves.
- 🔴 **`create_lesson` refuses on an *unchecked* class, not only a failed one.** The first call
  returned `F4: not-checked` and wrote nothing, because that server could not find the render
  harness. Running it from the server bound to a source checkout answered F4 and it wrote. **Do not
  reach for `allow_unrendered` to clear this** — it converts "unanswered" into "unanswerable".
- ⚠️ **`${PIPESTATUS[0]}` is empty in zsh**, so `npm run lessons:check | tail` reports no exit code
  at all. Redirect to a file and read `$?` instead.
- ⚠️ **The header comment on `tut-004/the-real-bundle-installs.test.ts` says `log-a-thing` "is the
  only" bundle.** As of this task that is false. Not edited — it is another task's file — but it
  will mislead whoever reads it next.
