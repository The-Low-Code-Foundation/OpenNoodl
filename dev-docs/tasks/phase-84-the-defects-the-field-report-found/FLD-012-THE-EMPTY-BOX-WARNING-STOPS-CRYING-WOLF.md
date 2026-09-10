# FLD-012 — The empty-box warning stops crying wolf

> 🟢 **BUILT** — `packages/nodegx-render-measure/src/index.js`, session 6 (2026-09-10).
> **AC1–AC5 all met and measured.** Fixture `demo/fld-012`, four-arm driver `demo/fld-012-arms.js`,
> CI spec `packages/nodegx-render-measure/tests/emptyDecoratedBox.test.js` (13 specs, in
> `test:packages`). The numbers are in §6, and **§2 of this file was wrong in three places** — §7
> says how, because two of the three would have shipped a rule that suppressed everything.

*"I started ignoring the warning."* Noise in a signal this good is a real cost, and under the
reported case there is a blind spot that four other rules inherit.

## 1. The person sentence

**A page whose only "empty decorated boxes" are the controls the runtime drew reports no warning.**

## 2. What was reported, and what the code says

[#32](https://github.com/The-Low-Code-Foundation/NodeGX/issues/32): `empty-decorated-box` fires on a
24×24 radio and a 16×16 slider thumb. Five of ten pages carried it purely for containing a control.

The rule, measured 2026-09-09 — `nodegx-render-measure/src/index.js:167-173`:

```js
const emptyBoxes = visible.filter((el) => {
  if (el.children.length !== 0 || el.textContent.trim() !== '') return false;
  if (r.width <= 8 || r.height <= 8) return false;
  const cs = getComputedStyle(el);
  return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderStyle !== 'none';
});
```

🔴 **The suggested discriminator is half wrong, and the wrong half is the slider.**
`Slider.tsx:172-176` renders the thumb as a plain `<div style={thumbStyle} />` — **not an `<input>`,
no `appearance: none`, and no class at all**; its parent, the Slider root div, is also unclassed.
Only its `<input>` **sibling** carries `ndl-controls-range2`. So `closest('[class*="ndl-controls-"]')`
returns `null` for it, and neither the tag test nor the `appearance` test reaches it either. The
track div is the same shape.

The radio half **does** work as suggested: the 24×24 element is the `<input type="radio">`
(`RadioButton.tsx:87-95`), which is `opacity: 0; position: absolute` per `assets/style.css:86-90`,
and its parent **is** `.ndl-controls-pointer`.

🔴 **Under all of that is one blind spot worth more than the rule.** `visible` (`:124`) tests
`offsetParent !== null` and **ignores `opacity` and `visibility`**. Every rule built on it inherits
that: `elements-overflowing` (`:127-131`), the accent-area count (`:272-284`), the rhythm bands
(`:315-322`), `single-column-grid` (`:352-358`). **An `opacity: 0` element is being reported as a box
a person can see** — that is a correctness fix, not a suppression, and it removes the radio case for
free.

Other rules checked, so the next reader does not re-derive it: `accents` is guarded by `area >= 1000`
so the thumb and fill are excluded, but a 32×32 radio is not; `grounds` and `bands` require
`width >= vw * 0.6`, so only a **full-width Slider** qualifies and pollutes the rhythm spacings;
`text.elements` is safe.

## 3. Scope

- Fix `visible` first: exclude `opacity: 0` and `visibility: hidden`. Measure what that alone
  removes, before adding anything control-specific.
- Then the residue — the slider's unclassed track and thumb. The only predicate that reaches them is
  a parent that directly contains a range input. Keep it deliberately narrow.
- Skip form controls by tag and by `appearance: none`.
- Re-record any render baseline that has a control on the page, and say how many findings moved.

## 4. Acceptance criteria

1. **(person)** A page containing a Radio Button Group and a Slider and nothing else reports **no**
   `empty-decorated-box`.
2. 🔴 **A presence control on the same page:** an author's genuinely empty decorated box **is** still
   reported, on the same fixture, in the same run. Without it, AC1 is satisfied by deleting the rule.
3. The `visible` fix is asserted on its own: an `opacity: 0` element is absent from `visible`, and
   the count of findings it removes across the corpus is **recorded as a number**, per rule.
4. The four other rules built on `visible` are asserted for the change they inherit — at minimum,
   that their corpus counts moved in the direction expected and no rule went to zero. A rule that
   silently goes to zero is broken, not clean.
5. Reverted arm: restore `visible` and the slider predicate, and the warning returns on the AC1 page.

## 5. Traps

- 🔴 **A suppression that reads green because it suppresses everything is the failure mode here.**
  AC2 is not optional.
- ⚠️ `cs` is computed **after** the size check in the current code. Hoist it, or you will call
  `getComputedStyle` twice per element on every page.
- ⚠️ Skipping anything inside `.ndl-controls-*` also suppresses an author's own empty box nested in a
  Button. Small, real, and worth stating in the rule's own comment rather than discovering later.
- ⚠️ Changing finding counts invalidates recorded baselines. Re-record deliberately and diff; do not
  let a baseline refresh hide an unrelated regression.


---

## 6. What was measured (session 6, 2026-09-10)

### The instrument

🔴 **One render, four arms.** The change lives in an expression that runs *inside the page*, so a
before/after taken as two separate renders would be comparing two DOMs and calling the difference a
fix. `demo/fld-012-arms.js` renders each page **once** and evaluates four builds of the expression
against that one DOM:

| arm | what it is |
|---|---|
| `head` | the source as it stands |
| `no-visible` | the `visible` opacity/visibility correction reverted, the control skips kept |
| `no-empty` | the control skips reverted, the `visible` correction kept |
| `original` | both reverted — what shipped before FLD-012 |

The arms are built by applying the inverse patch **textually** to the module's own source (FLD-008's
shape), asserting each replacement is present exactly once first, so a source that has moved fails
loudly rather than grading nothing.

### AC1 and AC2 — the fixture, in a real Chrome

`demo/fld-012` is a three-page project. Rebuild it with `node demo/build-fld-012.js`.

| page | before | after |
|---|---|---|
| `/Pages/Controls` — a Radio Button Group and a Slider, nothing else | **1** `empty-decorated-box` | **0** ✅ AC1 |
| `/Pages/Mixed` — the same controls **plus one genuinely empty decorated Group** | 2 | **1 — the author's box** ✅ AC2 |
| `/Pages/Deprecated` — the same two controls built from the deprecated node types | **2** | **0** |

**Total on the fixture: 3 findings → 1**, and the one that survives is the 320×120 box an author
left empty. AC2 is not a separate run: it is the same project, the same render, the same command.

### AC3 — the `visible` correction, on its own

`visible` now excludes `opacity: 0` and `visibility: hidden`, and the measurement reports two new
numbers so the claim can be checked directly: `visibleCount` (the size of the population every rule
is computed over) and `transparentExcluded` (how many elements the correction took out of it).

On the fixture: `visible` **51 → 45**, `transparentExcluded` **0 → 6** — the two `opacity: 0` radio
inputs on each of three pages.

**Across the corpus** — 20 projects (`templates/*`, `project-examples/lessons/*` and their
solutions), every routed page, desktop viewport:

> **The `visible` correction removes 4 findings. The control skips remove 0.**

All four are `flat-type-scale` (**18 → 14**), and the mechanism was measured rather than assumed:
that rule is gated on `v.text.elements >= 10`, and on `moods/solution` the start page counted
**10 text elements of which one was invisible** — 9 after the fix, below the gate. So the finding
was firing on a page whose tenth text element nobody could see. ⚠️ The flip side, stated because it
is real: a page with 9 visible texts and a genuinely flat scale is now silent. That is the
pre-existing gate, not something this change introduced.

**The control skips remove nothing on the corpus, and that is not a hole** — no corpus project puts
a Radio Button or a Slider on a page in a way that trips the rule. The fixture is what demonstrates
them, which is why the fixture exists.

### AC4 — the rules that inherit `visible`

| rule | original | head | |
|---|---|---|---|
| `single-ground` | 15 | 15 | unchanged, still firing |
| `flat-type-scale` | 18 | **14** | moved down by 4, still firing |
| `no-display-type` | 29 | 29 | unchanged, still firing |
| `broken-image` | 12 | 12 | unchanged, still firing |
| `no-imagery` | 2 | 2 | unchanged, still firing |
| `empty-decorated-box` | 1 | 1 | unchanged, still firing |
| `elements-overflowing` · `horizontal-overflow` · `single-column-grid` · `dead-placeholder-text` · `clipped-page` · `content-not-visible` | 0 | 0 | 🔴 **NOT EXERCISED by this corpus — grades nothing** |

**6 of 12 exercised, 0 regressed, none went to zero.** The six reading 0 in *both* arms are printed
as *not exercised* deliberately: a rule that was never firing is a control that was never armed, and
reading it as "the fix left it alone" is the mistake this table exists to prevent.

### AC5 — the reverted arm

Both halves revert independently, in the driver and in the CI spec. On the spec's fixture the
`original` arm reports **six** boxes — **five of them furniture the runtime drew** (the deprecated
radio input, the modern radio's transparent input, its checked fill, the slider track, the slider
thumb) and one the author left empty. That ratio is the whole of #32.

### Gates

`@nodegx/render-measure` is in **`test:packages`** (`pr.yml`), so
`tests/emptyDecoratedBox.test.js` is a real CI gate and not a suite run by hand.

---

## 7. 🔴 Three things §2 of this file got wrong

The task doc was researched but not infallible, and two of the three would have shipped a broken
rule. Each was found by measuring the artefact.

1. 🔴 **`appearance: none` is the COMPUTED DEFAULT of an ordinary `<div>` in Chrome.** §3 said
   *"skip form controls by tag and by `appearance: none`"*. Measured on the fixture: every plain
   div — including the author's empty box — computes `appearance: none`. Skipping on it would have
   suppressed **every finding on every page**, which is exactly the failure mode AC2 exists to
   catch, and it would have read as a clean pass. **It is not used.** The shipped predicate skips by
   tag only, and the spec asserts the author's box survives beside an element carrying it.

2. 🔴 **The `visible` fix does NOT "remove the radio case for free".** §2 says the 24×24 element is
   the `opacity: 0` input and that correcting `visible` takes it out. It does take it out of
   `visible` — measured, `transparentExcluded` counts it — but that input **never fired
   `empty-decorated-box` in the first place**: `.ndl-controls-radio-2` sets no background and no
   border, so the rule's last test rejects it anyway. The radio finding the reporter actually saw is
   reproduced by the **deprecated** `Radio Button` node, whose input is a styled
   `<input type="radio">` with a solid border (`nodes-deprecated/controls/radiobutton.tsx:62`,
   `assets/style.css:64`) — visible, opacity 1, and reachable only by the form-control skip.

3. 🔴 **The residue is not only the slider's track and thumb.** The element that survived the first
   version of the fix on the fixture was the modern Radio Button's **checked fill dot** — an
   unclassed, absolutely-positioned 16×16 div beside the radio input, drawn and visible. So the
   predicate is not slider-specific: it is *absolutely positioned **and** a direct sibling of a form
   control*, which reaches the track, the thumb and the fill alike. Both conditions are required,
   and the spec has an arm for each one alone.

⚠️ **And one more, smaller:** §2 lists "the rhythm bands (`:315-322`)" among the rules that inherit
`visible`. The bands **are** measured from `visible`, but **no finding consumes them** — `v.rhythm`
has no reader in `summarise`. There is no rhythm rule to move, and an AC4 list naming one would have
read 0 → 0 forever.

⚠️ **A trap for whoever builds the next render fixture:** the catalog carries **two** of each
control. `Radio Button` / `Range` are `isDeprecated: true, inNodePicker: false`; the node picker
offers `net.noodl.controls.radiobutton` / `net.noodl.controls.range`. They render different
components with different markup. The first version of this fixture used the deprecated pair by
accident and reproduced a real false positive — a *different* one from the reporter's. The fixture
now builds both, deliberately.
