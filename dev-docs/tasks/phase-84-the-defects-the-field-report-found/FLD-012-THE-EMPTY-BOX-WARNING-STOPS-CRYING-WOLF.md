# FLD-012 — The empty-box warning stops crying wolf

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
