# NOTES — LEG-005, the comment row

**Branch:** `leg-005-lane`, off `fc36d61a`. **Date:** 2026-08-11. Built in a worktree with **no
running editor** — the lane could not drive the app (`lerna exec` from a worktree resolves the
package root to the primary checkout, and the machine's editor was contended). So:

- everything except the live drive is **done and gated here**;
- the live drive and the contrast measurement are **§4 of this file**, written to be executed by
  someone who has never seen the diff.

---

## 1. What was built, and where

| File | What |
|---|---|
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/NodeComment/nodeCommentCommit.ts` | **new.** The placeholder copy, the two undo labels, and the two pure decisions (`resolveCommentCommit`, `isCommentChanged`). No imports at all, so it is reachable from the plain-Node runner. |
| `.../components/NodeComment/NodeComment.tsx` | **new.** The row. |
| `.../components/NodeComment/index.ts` | **new.** Barrel. |
| `.../propertyeditor/index.tsx` | Mounts `<NodeComment>` between `<NodeLabel>` and `<Tabs>`. |
| `packages/noodl-editor/src/editor/src/styles/propertyeditor/propertyeditor.css` | `.property-comment-*` rules appended after `.property-panel-header-edit-bar`. |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor/ModelBindings.ts` | `bindNodeModel` now also binds `commentChanged` → `repaint()`. |
| `packages/noodl-editor/tests-unit/leg-005/nodeCommentRow.test.ts` | **new.** 20 specs, behavioural + structural. |

### The four things §2 said decide whether it works

1. **Present when empty.** `{Boolean(props.model) && <NodeComment model={props.model} />}` — the
   condition is the *panel having a node*, never `hasComment()`. There is a structural spec that
   fails if that ever changes, and it was **proved red** by temporarily rewriting the condition to
   `Boolean(props.model?.hasComment())` (see §3).
2. **Above the ports, below the label.** Between `NodeLabel` and `Tabs`, i.e. outside the tab strip
   rather than inside the Properties tab. Reasoning: a comment describes the **node**, and the
   `Ports` tab is about the same node — a row that vanished when you switched tabs would be
   conditional in a second way. A spec asserts the source order `NodeLabel < NodeComment < Tabs`.
3. **Multiline, and it commits.** A real `<textarea>`. **Blur is the single commit path.** Escape
   reverts then blurs; Cmd/Ctrl+Enter commits *by blurring*, so there is one write, not two.
   ⚠️ **No `onEnter` is bound, on either core-ui control.** `TextArea.onEnter` is Shift+Enter
   (`TextArea.tsx:123` — `ev.shiftKey && ev.key === 'Enter'`), `TextInput.onEnter` is plain Enter;
   binding either would have meant a comment where the natural newline gesture submits. Enter
   inserts a newline. A spec fails if `onEnter` ever appears in the file.
4. **Undo through the existing path.** `model.setComment(value, { undo: true, label })` and nothing
   else. No `UndoActionGroup` anywhere in the row; a spec asserts its absence.

### Clearing — parity with the popup

`showCommentEditPopup` (`NodeGraphEditorNode.ts:606-611`) does
`model.setComment(newComment || undefined, { undo: true, label: newComment ? 'Edit node comment' : 'Remove node comment' })`.
The row reproduces that: `resolveCommentCommit` returns `undefined` for empty **and** whitespace-only,
with the popup's own two label strings (asserted against the popup's source, so a rename there fails
here). `setComment` stores `comment?.trim() || undefined` and `toJSON` runs the metadata bag through
`JSON.stringify`, which **drops** an `undefined` — so the key leaves disk and `hasComment()` goes
false. An empty string would have persisted as `comment: ""`; that is why the value is `undefined`
and not `''`.

**One deliberate one-word divergence.** The popup picks its undo label off the *raw* field value, so
a field holding only spaces gets labelled `Edit node comment` while storing nothing. The row reads
the label off the trimmed value, so that case is labelled `Remove node comment`. The **stored result
is identical** either way. Documented in `nodeCommentCommit.ts`.

### The repaint, and why it is a model binding rather than a call

The gutter stripe is painted straight off `node.model.hasComment()`
(`NodeGraphEditorNodePainter.ts:302`). Before this task there was one writer — the popup — and it
called `owner.repaint()` by hand on the next line. There are now **three**: the popup, the row (which
has no `owner`), and **undo**, which calls `setComment` from inside the undo queue where no view is
involved at all. So `ModelBindings.bindNodeModel` now binds `commentChanged` → `repaint()`.
`repaint()` only, no `relayout()`: the stripe is filled inside the titlebar's existing box and
changes no measurement.

### Copy

Placeholder, **verbatim as fixed by the orchestrator**:

```
Why it's this way — a constraint, a rule, a decision
```

Asserted character-for-character in the suite. Row label is **`Comment`** — the editor's existing
word for this field (`NodeContextMenu.ts:287` says "Add comment" / "Edit comment") and the model key.
The label carries a tooltip that names the *use* and states where the comment shows up:
"Why this node is the way it is — the rule or decision the graph cannot state. Shown when you hover
the node on the canvas.", fine-type "⌘/Ctrl + Enter to save · Esc to cancel".

**No objection to the fixed copy.** It reads well at the field's width and it is the same sentence
as LEG-001's description, shortened, which is the point.

### Two implementation details worth knowing before you read the diff

- **The height is CSS-only.** A textarea's `scrollHeight` ignores its placeholder, so an empty field
  sizes to one line and would **clip a placeholder that wraps to two** — and the placeholder is the
  entire teaching surface. So `.property-comment-sizer` is a hidden mirror **in flow** carrying the
  text (or the placeholder when there is no text), and the real textarea is `position: absolute;
  inset 0` over it with identical box and type metrics. No measurement pass, no `ResizeObserver`
  (which a backgrounded Electron renderer does not run at all). Both elements state
  `box-sizing: border-box` for themselves — there is no global `border-box` in this repo. Capped at
  ten lines (`max-height: 184px`), past which the field scrolls rather than pushing the ports away.
- **The listener group is a `useRef({})`, not `this`.** `Model.off(group)` removes every listener
  whose `group ===` the argument, and in a module-scope function component `this` is `undefined` —
  so the `model.off(this)` idiom in `NodeLabel.tsx:104` unsubscribes **every** listener anyone
  registered without a group. That is a latent bug in `NodeLabel`, **left alone** as out of scope,
  but do not copy it.

---

## 2. Gates run, with numbers

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | **exit 0**, 0 errors |
| `npx tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | **exit 0**, 0 errors |
| `npx tsc -p packages/noodl-core-ui --noEmit` | exit 2, **82 error lines — identical to the baseline**. All `TS2307` alias failures (`@noodl/runtime`, `@noodl-versioning`, `@noodl-store/*`) in files this task does not touch. Verified by stashing the three modified tracked files and re-running: 82 lines both ways. |
| `npx jest` from `packages/noodl-editor` (whole `tests-main` + `tests-unit`) | **128 suites passed / 128, 1819 tests passed / 1819**, 50.8 s |
| `npx jest tests-unit/leg-005` | **20 passed / 20** |

**Not run, deliberately** (worktree rules): `npm run test:ci`, `npm run test:main` via lerna,
`npm run dev:*`, `npm install`. The Jasmine/Electron suite under `tests/` was not run and no spec was
added to it.

---

## 3. The two structural gates, proved red

Both were flipped, observed failing, and reverted:

| Mutation | Result |
|---|---|
| `Boolean(props.model)` → `Boolean(props.model?.hasComment())` on the mount | `✕ renders the row for a node with no comment` — 1 failed / 19 passed |
| `::placeholder { opacity: 1 }` → `opacity: 0.55` | `✕ dims the placeholder with a colour token, never with opacity` — 1 failed / 19 passed |

---

## 4. THE DRIVE — for the orchestrator, in the primary checkout

Everything below needs the editor **running on a real project** with at least a few nodes, and a CDP
evaluate channel (`run-editor` skill). You should not need this diff or the spec open.

### 4.0 Preconditions and traps

1. ⚠️ **`el.value = x` does not drive React.** Every text write below uses the native setter:
   ```js
   const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
   set.call(el, 'text'); el.dispatchEvent(new Event('input', { bubbles: true }));
   ```
   `HTMLTextAreaElement`, not `HTMLInputElement` — the row is a textarea.
2. ⚠️ **Never `cdp reload`.** Never `replaceChildren()` anything.
3. ⚠️ **Read the model, never the DOM, for every "did it commit" question.** The DOM is what this
   task changed; it cannot also be the witness.
4. `window.__nodeGraphEditor` is the one editor object on `window` (`nodegrapheditor.ts:320`).
   `ed.findNodeWithId(id)` gets a visual node; `ed.selectNode(visualNode)` selects it **and** opens
   the property panel on it (`SelectionActions.ts:136-155`).
5. **Selectors are plain global classes**, not CSS modules — no hash-substring guessing:
   `.property-comment-bar`, `.property-comment-label`, `.property-comment-sizer`,
   `.property-comment-input`.
6. ⚠️ `ed.repaint()` only schedules a `requestAnimationFrame`, which an occluded window clamps
   ~1000×. Use **`ed.layoutAndPaint()`** when you need a frame now.

### 4.1 Select a node that has no comment, and prove the row is there anyway

```js
const ed = window.__nodeGraphEditor;
// Pick the first root node that has no comment.
const walk = (ns, out = []) => (ns || []).forEach(n => (out.push(n), walk(n.children, out))) || out;
const all = walk(ed.roots);
const target = all.find(n => !n.model.hasComment());
ed.selectNode(target);
JSON.stringify({ id: target.model.id, label: target.model.label, comment: target.model.getComment() });
```

Then, after a tick:

```js
const bar = document.querySelector('.property-comment-bar');
const input = document.querySelector('.property-comment-input');
JSON.stringify({
  barPresent: !!bar,
  label: document.querySelector('.property-comment-label')?.textContent,
  placeholder: input?.placeholder,
  value: input?.value,
  // The row must be TALL ENOUGH FOR ITS PLACEHOLDER, not one line.
  height: input?.getBoundingClientRect().height,
  sizerHeight: document.querySelector('.property-comment-sizer')?.getBoundingClientRect().height
});
```

**Pass:** `barPresent: true`, `label: "Comment"`, `placeholder` exactly
`Why it's this way — a constraint, a rule, a decision`, `value: ""`, and `height` ≈ `sizerHeight`
and **≥ 48** (two wrapped lines) at a normal docked panel width. If `height` is ~31 and the
placeholder is visibly cut off, the mirror is not driving the box — say so, that is a real failure.

**Also check the order** — this is §2 item 2:

```js
const order = [...document.querySelectorAll('.property-header-bar, .property-comment-bar, [class*="Tabs"]')]
  .map(e => e.className.split(' ')[0]);
JSON.stringify(order);
```
**Pass:** header bar, then comment bar, then the tabs.

### 4.2 Type, commit, and read the model back

```js
const input = document.querySelector('.property-comment-input');
const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
input.focus();
set.call(input, 'Disabled for auto-entrepreneurs — décret 2019-1104 art. 3.');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.blur();                                   // ← blur is the commit
```

Then, in a **separate** eval:

```js
const ed = window.__nodeGraphEditor;
const n = ed.findNodeWithId('<the id from 4.1>');
JSON.stringify({ comment: n.model.getComment(), has: n.model.hasComment(), meta: n.model.metadata });
```
**Pass:** `comment` is the sentence, `has: true`.

Try the keyboard route too, on a second node — it must behave identically:

```js
input.focus();
set.call(input, 'Second node: kept synchronous because the caller retries.');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
```
**Pass:** the model has the text (the handler blurs, and blur commits).

### 4.3 The stripe repaints without a reselect

Do **not** click away and back. In the same session, right after 4.2:

```js
const ed = window.__nodeGraphEditor;
ed.layoutAndPaint();
```
Screenshot the canvas, or read the pixel column at the node's `x`, `y + 2`. The stripe's colour is
`CanvasTheme.commentIndicator`, which maps to **`--theme-color-primary`** (`CanvasTheme.ts:102`,
fallback `#4da3ff`) — so compare against
`getComputedStyle(document.documentElement).getPropertyValue('--theme-color-primary')`.
⚠️ The canvas is transparent where the ground shows through, so `getImageData` returns
`alpha 0` for background pixels; the stripe pixels themselves are real.

**Pass:** the stripe is now on the node you just edited, with no reselection. If it is not, the
`commentChanged` binding in `ModelBindings.ts` is the thing that failed.

### 4.4 One undo removes it

```js
// Use the app's own undo — the menu item or Cmd+Z with focus on the canvas.
// Then, in a separate eval:
const n = window.__nodeGraphEditor.findNodeWithId('<id>');
JSON.stringify({ comment: n.model.getComment(), fieldValue: document.querySelector('.property-comment-input').value });
```
**Pass:** `comment: undefined` **and** `fieldValue: ""` — the field resyncs from the
`commentChanged` event without a reselect. Also confirm the **stripe is gone** after
`ed.layoutAndPaint()`, and that it took **exactly one** undo.

### 4.5 Clearing matches the popup exactly

Set a comment on node A **through the row**, and on node B **through the context menu popup**
(right-click → Edit comment). Then clear each the same way it was set — the row by selecting all and
deleting then blurring, the popup by submitting empty — and compare:

```js
const ed = window.__nodeGraphEditor;
const A = ed.findNodeWithId('<A>'), B = ed.findNodeWithId('<B>');
JSON.stringify({
  a: { comment: A.model.getComment(), keyPresent: 'comment' in (A.model.metadata || {}), json: A.model.toJSON().metadata },
  b: { comment: B.model.getComment(), keyPresent: 'comment' in (B.model.metadata || {}), json: B.model.toJSON().metadata }
});
```
**Pass:** identical shapes. `getComment()` `undefined` for both, and **`toJSON().metadata` has no
`comment` key** for either (the in-memory bag keeps `comment: undefined`; `toJSON`'s
`JSON.parse(JSON.stringify(...))` is what drops it, which is why the assertion is on the `json`
field, not on `keyPresent`).

Also try **whitespace only**: type three spaces into the row and blur. **Pass:** `getComment()` is
`undefined` and the field ends up **empty**, not holding three spaces.

### 4.6 Save, close, reopen

Save the project, close it to the launcher, reopen, select node A. **Pass:** the row shows the
comment, the stripe is on the card, and `getComment()` returns the sentence.

### 4.7 CONTRAST — measured in both themes, hexes printed

Three pairs matter. Run this **twice**: once in dark, once in light.

To flip theme, prefer the real control in Settings. `document.documentElement.setAttribute('data-theme','light')`
is a legitimate shortcut **for this measurement specifically**, because every colour in the row comes
from a CSS custom property resolved off `:root[data-theme]` — there is no JS colour path here at all.
Flip back to `'dark'` afterwards.

```js
function lum(rgb){const v=rgb.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(x=>x/255)
  .map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));
  return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];}
function hex(rgb){const m=rgb.match(/\d+/g);return '#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join('');}
function ratio(f,b){const a=lum(f),c=lum(b);return ((Math.max(a,c)+0.05)/(Math.min(a,c)+0.05)).toFixed(2);}

const bar   = document.querySelector('.property-comment-bar');
const label = document.querySelector('.property-comment-label');
const input = document.querySelector('.property-comment-input');

// The bar itself is transparent — walk up to the first element that paints a ground.
function groundOf(el){let e=el;while(e){const bg=getComputedStyle(e).backgroundColor;
  if(bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; e=e.parentElement;} return 'rgb(0,0,0)';}

const barBg   = groundOf(bar);
const fieldBg = getComputedStyle(input).backgroundColor;          // --theme-color-bg-2
const labelFg = getComputedStyle(label).color;                    // --theme-color-fg-default-shy
const textFg  = getComputedStyle(input).color;                    // --theme-color-fg-default
// ⚠️ Chrome does not reliably return ::placeholder styles from getComputedStyle, so resolve the
// TOKEN the rule uses instead — and confirm the rule is still the one that wins:
const shy = getComputedStyle(document.documentElement).getPropertyValue('--theme-color-fg-default-shy').trim();

JSON.stringify({
  theme: document.documentElement.getAttribute('data-theme') || 'dark',
  label:       { fg: hex(labelFg), bg: hex(barBg),   ratio: ratio(labelFg, barBg) },
  commentText: { fg: hex(textFg),  bg: hex(fieldBg), ratio: ratio(textFg,  fieldBg) },
  placeholderToken: shy,
  fontSizes: { label: getComputedStyle(label).fontSize, input: getComputedStyle(input).fontSize },
  placeholderOpacity: 'read from the stylesheet below'
}, null, 1);
```

For the placeholder pair, compute `ratio(shyAsRgb, fieldBg)` — or simply confirm the token equals
the label's `fg`, since both rules use `--theme-color-fg-default-shy`, in which case the label ratio
against `fieldBg` is the placeholder ratio. **And confirm no opacity is dimming it:**

```js
[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
  .filter(r => r.selectorText && r.selectorText.includes('property-comment-input::placeholder'))
  .map(r => r.cssText);
```
**Pass:** exactly one rule, `color: var(--theme-color-fg-default-shy); opacity: 1;`.

#### What the numbers should be

Computed from the token hexes in `colors.css`. **These are predictions, not measurements** — the
drive's job is to confirm or refute them, and to print the observed hexes beside every ratio.

| Pair | Dark | Light |
|---|---|---|
| Label `fg-default-shy` on panel ground `bg-1` | `#8b95a1` on `#12161b` = **5.98:1** | `#616c79` on `#ffffff` = **5.34:1** |
| Comment text `fg-default` on field `bg-2` | `#a6b0bb` on `#181d24` = **7.70:1** | `#4a5663` on `#f7f9fb` = **7.10:1** |
| Placeholder `fg-default-shy` on field `bg-2` | `#8b95a1` on `#181d24` = **5.57:1** | `#616c79` on `#f7f9fb` = **5.06:1** |
| Field border `border-control` on `bg-1` (3:1 non-text floor) | `#6b7682` on `#12161b` = **3.93:1** | `#7c8894` on `#ffffff` = **3.62:1** |

Two rejected alternatives, for the record — both would have shipped a failure:

- `--theme-color-fg-muted`, which is what the neighbouring `.property-group-label` uses: **3.93:1**
  dark / **3.62:1** light on the panel ground. Under AA at this size, in both themes.
- leaving core-ui `TextArea`'s default `::placeholder` colour (`--base-color-grey-600` →
  `--base-color-neutral-400` → `#2c3540`): **1.36:1** in dark. Effectively invisible. This is also
  the main reason the row uses a native `<textarea>` rather than core-ui's `TextArea` — see §5.

### 4.8 The one thing to eyeball rather than measure

Whether a permanently-present ~50px row above the ports is worth its space on a node with nothing to
say. That is a judgement, it is the judgement the spec already made (L12), and if it reads as clutter
the answer is smaller type or a tighter bar — **not** making the row conditional, which is the defect.

---

## 5. Deviations, with reasoning

1. **A native `<textarea>` + global CSS, not core-ui `TextArea`.** Three reasons, in order of
   weight. (a) `TextArea.module.scss` sets `::placeholder { color: var(--base-color-grey-600) }`,
   which resolves to `#2c3540` — 1.36:1 in dark. Overriding it from the outside means `UNSAFE_className`
   on the *same element*, i.e. a specificity **tie** decided by stylesheet order — precisely the
   "a bare class loses to a descendant selector" trap in slower motion. (b) `.Input` carries
   `user-select: none`, which is wrong for a field a user is meant to select text in. (c) the
   height mechanism needs a sibling mirror with matching metrics, which the component does not
   expose. The row's classes live in `propertyeditor.css` alongside `.property-header-bar`, the file
   the panel already loads.
2. **The row sits above the tab strip, not inside the Properties tab.** A comment is about the node,
   and the `Ports` tab is about the same node. Inside the tab it would disappear when you switched —
   conditional in a second way. Stated in a comment at the mount site.
3. **Label reads `Comment`, not `Why`.** The editor already has a word for this field, in the
   context menu and in the model key, and LEG-001 uses it too. The *placeholder* carries the "why"
   framing, which is what §3 of the spec actually asks for.
4. **The label uses `fg-default-shy`, not the `fg-muted` its neighbouring `.property-group-label`
   uses.** `fg-muted` fails AA at this size in both themes (§4.7). The neighbour was left alone —
   fixing every micro-label is a different task.
5. **Undo label for a whitespace-only clear is `Remove node comment` where the popup would say
   `Edit node comment`.** Same stored result; the row's label is the accurate one. §1.
6. **`ModelBindings` change is repo-wide, not row-local.** It makes the popup's manual
   `owner.repaint()` redundant, and makes **undo** repaint the stripe — which it did not before this
   task. The popup's own call was left in place; it is idempotent.
7. **No spec added to the Jasmine `tests/` suite.** It cannot be run from a worktree, and a gate
   that cannot be proved red is not a gate. The runnable coverage is in `tests-unit/leg-005/`.

---

## 6. Could not verify

Everything here is an **honest gap**, not a claim.

- **The whole of §4.** Nothing in this lane was run in a live editor. In particular:
  - that the row renders at all (it typechecks and the JSX is asserted structurally; it has never
    been painted);
  - that the hidden-mirror height mechanism produces a box tall enough for the wrapped placeholder
    at a real panel width — this is the single most likely thing to be wrong, and §4.1 tests it
    first for that reason;
  - that blur-commit fires before any panel remount steals the blur (`SidebarModel.createPanel`
    rebuilds the component on every selection change, per `index.tsx:23-34`; clicking a *different
    node* while the field is focused is the case to try);
  - that Escape reaches the field rather than being eaten by the canvas or the global command layer.
- **Contrast.** All ratios in §4.7 are computed from `colors.css` token values, not sampled from a
  running renderer. They are arithmetic on the right hexes, but they assume the tokens resolve as
  written and that no other rule wins.
- **The stripe repaint.** The `commentChanged` binding is asserted to exist; that it produces a
  repainted stripe was not observed.
- **Save/reopen round trip.** Reasoned from `toJSON`'s `JSON.parse(JSON.stringify(metadata))` and
  asserted structurally against `setComment`'s normalisation. Not driven.
- **Multi-mount.** `useId` was used so a docked and a floating property panel cannot collide on the
  textarea's `id`. Whether both can be open at once was not established.
- **`NodeLabel.tsx:104`'s `model.off(this)`.** Believed to be a real latent bug (`this` is
  `undefined` in a module-scope function component, and `Model.off(undefined)` removes every
  group-less listener). Not fixed, not reproduced — filed here only.
