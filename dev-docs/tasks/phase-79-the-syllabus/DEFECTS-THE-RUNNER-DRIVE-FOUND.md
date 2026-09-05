# Defects the lesson-runner drive found

From [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md), session 8.
These are **runner and launcher** defects, not any one lesson's — which is why they are in their own
register rather than a per-lesson one. Every row is open and unowned.

| id | severity | owner | what |
|---|---|---|---|
| J1 | 🔴 high | ✅ **FIXED 2026-09-05 (s9)** | a markdown blockquote renders as a literal `>` in lesson prose — 5 of the 8 shipped lessons |
| J2 | 🔴 high | `NONE` | *Check my work* on an incomplete step removes the instructions and says nothing new |
| J3 | ⚠️ medium | ✅ **FIXED 2026-09-05 (s9)** | every shipped lesson is badged **Written locally** instead of **NodeGX** |
| J4 | ⚠️ medium | ✅ **FIXED 2026-09-05 (s9)** | a `paramsEqual` condition names the parameters it grades but not the values they must equal |

## ✅ 2026-09-05 (session 9) — J1 and J4 fixed, and J1 was two defects wearing one symptom

Gated by `packages/noodl-editor/tests-unit/syl-j1/lessonProse.test.ts` (23 rows) and the new
blocks in `tests-unit/fix-025/check-my-work-copy.test.ts` (53 rows). Every fix was mutant-checked
by reverting it alone and confirming only its own rows redden. 76/76 green across both dirs.

🔴 **J1's observation was exact and its diagnosis was wrong**, which is worth more than the fix.
The row said the blockquote *"falls through, taking its inline emphasis with it"* — one defect. It
is **three**, and only the first is about blockquotes. Re-measuring the shipped line at HEAD
reproduced the recorded text character for character *and* showed the emphasis failure has nothing
to do with the quote: it reproduces on `**bold with *nested* inside**` on its own. A symptom seen in
one place had been attributed to the construct it was standing next to.

⚠️ **The third was found by the corpus arm, not by the row**, and nobody had recorded it:
`moods` step 1 ships `` `min(96 + pokes * 8, 200)` `` — a multiplication inside a code span — and
emphasis was applied *after* code spans without knowing what one is. That `*` paired with the
`*how much*` after it, so the rendered HTML was

    <code>min(96 + pokes <em> 8, 200)</code> answered </em>how much<em>; … answers </em>yes or no*.

— an `<em>` opened inside the code and closed outside, mismatched tags, the code sample corrupted,
the italics on the wrong words. On the lesson that teaches the **Expression** node, about the
expression it teaches. It is filed as **J1(c)** rather than a new id because it was found and fixed
in the same pass, but it was never observed by the drive: the drive read `poke-it`, and this is in
`moods`.

| | what was wrong | where |
|---|---|---|
| **J1(a)** | `renderMarkdown` had no blockquote branch, so `> …` fell to the paragraph branch and `escapeHtml` made the marker a literal `&gt;` | `lessonformat.ts` `renderMarkdown` |
| **J1(b)** | the bold rule matched content with `[^*]+`, which forbids the character that opens a nested emphasis, so bold containing `*em*` never matched at all and the single-star rule then paired across the wrong spans | `lessonformat.ts` `inlineMarkdown` |
| **J1(c)** | emphasis was applied after code spans and did not treat them as opaque, so a `*` or `_` inside code paired with prose outside it | `lessonformat.ts` `inlineMarkdown` |

The shipped line now renders as its author wrote it:

    <blockquote><p><strong>An event is a pulse. It says <em>something just happened</em> and
    carries no value with it.</strong></p></blockquote>

`LessonLayerView.css` gains a `blockquote` rule (a rule down the side, not the browser's bare
indent) — there was none, because until now nothing could produce the element.

**J4** was the multi-key `paramsEqual` arm: the single-key arm had always named its value, so the
sentence got *less* useful the more the step asked for. It now names every value, and a dimension
renders as `560px` rather than `{"value":560,"unit":"px"}` — a shape the property panel never shows
and the learner cannot type.

⚠️ **Two controls worth keeping.** A `>` mid-sentence must stay escaped (without that row, "print
every `>` raw" passes every blockquote case), and the eight pre-existing `renderMarkdown`
assertions from `tests/lessons/lessonformat.test.ts` are restated in the cheap runner — that spec
only runs inside the webpack+Electron `test:ci` bundle, so a regression there could sit unseen for
a session. All eight still hold, as does the `javascript:` href refusal.

⚠️ **Not fixed, seen in passing:** `[click](javascript:alert(1))` renders as `click)` — the link
regex's `[^)]+` stops at the first `)` and leaves the second in the prose. Cosmetic, pre-existing,
and the scheme is still correctly refused. Unowned; not worth a row of its own unless a lesson
ever writes a link with brackets in the URL.

---

#### J1 🔴 — a blockquote renders as a literal `>`, in the line carrying the lesson's whole idea

**Measured.** In `Poke it` step 0 the DOM has `blockquotes: 0`, and the rendered text reads:

> `> *An event is a pulse. It says something just happened and carries no value with it.*`

Both the `>` and the `*…*` emphasis are literal. Bold (`**Poke**`) elsewhere in the same body
renders correctly, so the markdown renderer is fine generally — it is the blockquote construct that
falls through, taking its inline emphasis with it.

🔴 **Five of the eight shipped lessons are affected**, and in every one the blockquote is the
sentence the lesson exists to teach:

| lesson | the line |
|---|---|
| `poke-it` | *"An event is a pulse..."* |
| `it-forgets-you` | 1 block |
| `moods` | 1 block |
| `it-gets-demanding` | 1 block |
| `show-what-it-feels` | 1 block |

⚠️ **This includes lessons 6 and 7, which are recorded as driven.** They were driven by the
serve-and-click route, which exercises the app the lesson builds and **never renders lesson prose** —
so that route could not have seen this, and "driven" against it does not imply the prose was read.

**Fix is one of two, and they are not equivalent:** teach the popup's renderer blockquotes, or rule
blockquotes out in `LESSON-VOICE.md` and rewrite five lessons. The first is the honest one — the
authors used a blockquote because the format offers it.

#### J2 🔴 — *Check my work* on an incomplete step removes the instructions

**Already recorded against lesson 1 in [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md); this
is the second lesson it has been measured on, so it is the runner's, not lesson 1's.**

On `poke-it` step 1, before the click: `details: 1`, `[data-template=popup]: 1`. After:
**both `0`**. The step body and the *Show me how* disclosure leave the DOM entirely, and the only
route back is knowing to click the step in the timeline. The check produced **no new visible
feedback** — the *"Looking for…"* line was already on screen before the press.

So from the learner's side, pressing the button loses your instructions and tells you nothing.
That is the worst possible moment to do it: the learner pressed it *because* they were stuck.

⚠️ **Scope, honestly.** The clean before/after pair is `poke-it`. Lesson 2's post-check screen has
the same shape — instructions gone, only the "Looking for…" panel left — but no matching pre-check
capture was taken, so it corroborates rather than replicates.

#### J3 ⚠️ — every shipped lesson is badged "Written locally"

**Confirmed in source, both halves.** All 8 seeded entries carry `"provenance": "local-ai"` in the
register, and all 8 cards read **Written locally**.

- `LearningSection.tsx` `PROVENANCE_LABEL` maps provenance straight onto the badge:
  `curated: 'NodeGX'`, `'local-ai': 'Written locally'`.
- `lessonseed.ts:142` sets `SHIPPED_PROVENANCE = 'curated'` and `:409` installs with it — but the
  bundles carry `authoredBy: "ai"`, and `resolveProvenance` (`lessoninstallpolicy.ts:123`) rewrites
  that to `local-ai`.

🔴 **The field means two things and only one of them was intended here.**
`lessoninstallpolicy.ts` is explicit that the manifest's claim is *"not a promise the format makes to
the author, it is a downgrade switch"* — its documented job is to make the **gate** stricter, and
`lessonseed.ts:135-140` accepts that on purpose: *"Passing `curated` here does not buy a shipped
bundle a cheaper gate."* Nothing anywhere says the same switch should relabel the card. The seed's
own words for these lessons are *"they are editorial, and a person stands behind them"* — which is
precisely what the shelf now denies.

⚠️ **The fix is not to stop downgrading** — that buys the cheaper gate the seed deliberately refuses.
The badge needs an input of its own, separate from the gate's.

#### J4 ⚠️ — a condition names the parameters it grades but not the values

`it-breaks-on-a-phone` step 1 renders:

> *"Looking for a Group called “Board” on Home, “Board” with sizeMode, maxWidth set and paddingLeft
> and paddingRight set on “Board”."*

The learner is told **which** parameters are graded and not **what they must equal** — the step
needs `sizeMode: contentHeight` and `maxWidth: 560px`. Lesson 1's drive saw values rendered
(*"sizeMode set to "contentSize""*), and lesson 5's renders a full string value including braces, so
this is a **second rendering branch**, not a blanket omission — most likely the one that folds a
`hasParams` verb in beside a `paramsEqual`, where "set" swallows the equality.

Related to but distinct from [D2](DEFECTS-LESSON-2-FOUND.md) (raw type names). D2 is about the
*noun*; this is about the *value*.

---

## Also confirmed, not new

**[D2](DEFECTS-LESSON-2-FOUND.md) — a condition's prose shows the learner a raw type name.** Raised
from source against lesson 2; this drive is its **first observation on screen**:
`poke-it` step 1 renders *"Looking for a **net.noodl.controls.button** called “Poke” on Home"*.
The row needs no re-argument, only the note that it is now witnessed.


---

## ✅ J3 — FIXED 2026-09-05 (session 9)

The row's own prescription, followed exactly: *"the fix is not to stop downgrading — the badge
needs an input of its own, separate from the gate's."*

`LearningEntry` gains **`origin`**, the installing caller's word recorded *before*
`resolveProvenance` folds the manifest's claim into it. `provenance` is untouched and still
downgrades, so the stricter install gate the seed deliberately refuses to dodge is exactly as
strict as it was. Only the card moved.

🔴 **The migration is the part that would have been missed.** Writing `origin` at install fixes
nothing for the eight lessons already on a learner's shelf: the seed **skips an id it has already
installed**, so no future seed would ever rewrite them, and the badge would have stayed wrong for
every existing user while reading correct in a fresh profile. `badgeProvenance` therefore falls
back to `isShippedLessonId(entry.id)` — an id the seed mints and which `lessonseed` already asserts
against — before falling back to the gate class. Three inputs, in that order, each with its own
spec row and each independently mutant-checked.

Nothing in `noodl-core-ui` changed: the card's `provenance` field is read in exactly one place,
`PROVENANCE_LABEL`, so it *is* the badge input and the fix belongs on the editor side of the seam.

Gated by 5 new rows in `tests-unit/uni-007/learningstate.test.ts` (21 total). Reverting the whole
fix reddens 3; removing only the migration arm reddens 2; the 16 pre-existing rows stay green in
both arms. 1058/1058 across the 59 lesson-touching suites.

⚠️ **Left alone deliberately:** the platform install's confirmation dialog still shows the *folded*
provenance. That dialog is about which checks the bundle is being held to, so the gate class is the
right thing to show there.
