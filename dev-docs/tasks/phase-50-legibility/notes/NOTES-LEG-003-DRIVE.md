# LEG-003 — the drive, written to be executed

Everything LEG-003 could not verify without a running editor, as a script. Written for someone who
has the editor **already up on a real project** and a CDP evaluate channel (the `run-editor` skill).
You should not need the spec open.

Two parts:

- **A — §1's acceptance:** the four change kinds, driven, and their sentences read off the panel.
- **B — §2's acceptance:** the authored card in the Explain panel, its verbatim rule, and its
  contrast in both themes.

Budget: ~45 minutes for A, ~30 for B. **Part B costs nothing** unless you take the optional last
step; part A costs nothing at all.

---

## 0. Preconditions and traps, read these first

1. **The project must be a git repository with at least one commit and a clean tree** before you
   start. The version-control panel diffs `HEAD` against the editor's **in-memory** project
   (`LocalChangesDiff.tsx:21` — `safeGraphDiff(localDiff.baseProject, ProjectModel.instance.toJSON())`).
2. ⚠️ **Make the four edits by hand, in the editor.** The diff reads the editor's memory, so an MCP
   write or a file edit on disk changes nothing the panel can see until the project is reopened.
   This is the standing "the editor holds the project in memory" trap.
3. **No save is needed.** In-memory is the target side. Saving is harmless.
4. ⚠️ **Never `cdp reload`.** Never `replaceChildren()` the popup layer. Prefer dispatching events on
   an element you found in the DOM over clicking at coordinates — a coordinate click lands on
   whatever the layout put there.
5. **Selectors that hold:** rail buttons carry `data-test="<panel-id>-panel"` —
   `versioncontrol-panel`, `explain-panel`. CSS-module classes are emitted as
   `[name]__[local]--[hash]` (`webpack.renderer.core.js:63`), so `[class*="ChangeRow"]` and
   `[class*="AuthoredNotes"]` are stable substring selectors. ⚠️ The exact `[name]` spelling for
   `AuthoredNotes.module.scss` was not observed in a running build — if
   `[class*="AuthoredNotes-module__Body"]` matches nothing, print the card's class list
   (`document.querySelector('[class*="AuthoredNotes"]').className`) and use whatever prefix it shows.
6. ⚠️ **`el.value = x` does not drive React.** For any text field use the native setter:
   ```js
   const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
   set.call(el, 'Place order');
   el.dispatchEvent(new Event('input', { bubbles: true }));
   ```
   (`HTMLTextAreaElement.prototype` for a textarea.)

Pick a component with a **Button**, a **Text Input**, a **Group**, a **Columns** and a **Text** in
it, or build one — the four edits below need those five nodes. Note the component's name; it is the
row you click in step A.6.

---

## A — the four change kinds

### A.1 Rename (`node-renamed`)

1. Click the **Button** on canvas. The property panel opens on it.
2. **Double-click the node name** in the property panel header (the tooltip says "Double-click to
   rename"), type a new label, press Enter.
3. Record the old and new labels. Expected sentence shape:
   `Renamed Button '<old>' to '<new>'` — **the old label is on the node reference**. That is correct;
   confirm it reads that way to you as a reviewer.

### A.2 Rewire (`connection-rewired`)

1. Find an existing connection into one input — e.g. **Button.onClick → Navigate.navigate**.
2. Drag a wire from a **different source** into the **same input port**: Text Input's `onEnter` (or
   any signal output) onto the same `navigate` input. Dropping onto an occupied input replaces what
   was there, which is what makes it a rewire rather than an add plus a remove.
3. Expected shape:
   `Rewired <target> '<label>'.<port> to come from <newsource> '<label>'.<port> (was <oldsource> '<label>'.<port>)`
4. ⚠️ If you instead delete the wire and draw a new one to a *different* port, the diff reports
   `connection-added` + `connection-removed`. That is not a defect — the rewire pairing needs the same
   target endpoint. Redo it if that is what you got.

### A.3 Reparent (`node-reparented`)

1. Drag the **Text** node out of its current parent and drop it inside the **Columns** node.
2. Expected shape: `Moved Text '<label>' from Group '<label>' into Columns '<label>'`.
3. ⚠️ Do not merely move it on the canvas — a position-only change is classified **cosmetic** and is
   folded away behind "Show N position changes". If you see nothing, that is what happened.

### A.4 Multi-parameter (`node-parameters-changed`)

1. Select the **Columns** node and change **four** parameters in the property panel — e.g.
   `layoutString`, `gutter`, `alignY`, `paddingLeft`.
2. Expected shape:
   `Changed Columns '<label>' (a: x → y, b: x → y, c: x → y, +1 more)`
3. ⚠️ **The three spelled out are the first three alphabetically, not the first three you changed.**
   Check which one landed behind `+1 more` and write it down — this is register L33.

### A.5 Open the panel

```js
document.querySelector('[data-test="versioncontrol-panel"]').click();
```

### A.6 Select the changed component and read the sentences

```js
// Click the component row in the "Components" section.
const NAME = 'Home';                       // <- your component's name as listed
const row = [...document.querySelectorAll('[class*="ListItem"]')]
  .find(el => el.innerText.trim() === NAME);
row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
```

then, after a beat:

```js
JSON.stringify({
  section: [...document.querySelectorAll('*')]
    .map(el => el.innerText || '')
    .find(t => t.startsWith('What changed in ')) ? 'present' : 'MISSING',
  groups:   [...document.querySelectorAll('[class*="GroupTitle"]')].map(e => e.innerText.trim()),
  sentences:[...document.querySelectorAll('[class*="ChangeRow"]')].map(e => e.innerText.trim())
}, null, 2);
```

**Pass condition.** `sentences` contains one line per change, and all four of these hold:

- the rename line names the **old** label before `to '<new>'`;
- the rewire line names the target input, the new source and, in brackets, the old one;
- the reparent line names **both containers by name**, not by id;
- the multi-parameter line shows three deltas and a `+N more` tail.

**Fail conditions, each of which looks like success:**

- 🔴 Any sentence contains a raw type name — `net.noodl.controls.button`, `net.noodl.visual.columns`.
  That is register **L29**: `catalogDisplayNames()` swallowed a failed `require` and every row is
  silently degraded. **This is the check that matters most, and it must also be run against a
  packaged build, not only a dev run.**
- ⚠️ A node whose label happens to equal its type name renders as bare `Button` with no quoted label
  (register L30). Expected; note it, do not file it.
- The section header reads `What changed in <component>` — if it is missing, you clicked the wrong
  row or the graph diff threw (look for `Failed to compute the semantic graph diff` in the console).

Paste the `sentences` array verbatim into the LEG-003 register. **Text, not a screenshot.**

### A.7 The packaged-build half of L29

Repeat A.5–A.6 against a **packaged** build with the same project. Only the last selector block is
needed. If `sentences` is full of dotted type names there, the panel is degraded in the shipped app
and the fix is in `catalogDisplayNames()` — its `catch` returns `() => undefined` for everything.

---

## B — the authored card in the Explain panel

### B.1 Give a node a comment

1. Right-click the **Button** on canvas → **Add comment** (single-select only).
2. Type a comment with **two lines and a distinctive token**, e.g.:
   ```
   Retry twice, not three times.
   PSP-4412: a third attempt inside 60s reads as fraud.
   ```
3. Confirm the canvas shows the comment gutter stripe in the node's titlebar.

### B.2 Read it in Explain — with no provider and no request

```js
document.querySelector('[data-test="explain-panel"]').click();
```

The Button must still be selected. **Do not press "Explain this node".** The card renders from the
project, not from a model.

```js
JSON.stringify({
  card:        !!document.querySelector('[class*="AuthoredNotes"]'),
  header:      document.querySelector('[aria-label="Written by the author"]')?.innerText,
  attribution: [...document.querySelectorAll('[class*="AuthoredNotes-module__Attribution"]')].map(e => e.innerText),
  body:        [...document.querySelectorAll('[class*="AuthoredNotes-module__Body"]')].map(e => e.innerText)
}, null, 2);
```

**Pass condition:**

- `card` is `true` **before any explanation has been requested**;
- `body[0]` is **character-for-character** what you typed, including the line break — compare
  lengths, do not eyeball it;
- `attribution[0]` reads `Note on Button '<your label>'`;
- the header sentence is *"Written by the author — shown exactly as typed, not generated"*.

**Fail conditions:** the text is trimmed, re-wrapped, sentence-cased, or the newline is gone; the
attribution reads `net.noodl.controls.button '<label>'` (the no-catalog fallback misfiring); the card
appears only after an explanation.

### B.3 The node link reaches the canvas

Click the node name inside the attribution line. The canvas should reveal and highlight that node.
Hovering it should highlight without navigating.

```js
document.querySelector('[class*="AuthoredNotes-module__Clickable"]')
  .dispatchEvent(new MouseEvent('click', { bubbles: true }));
```

### B.4 A component description at component scope

The top-level `description` key does not survive into `ComponentModel` yet — that is LEG-006. The
`metadata` bag **does** round-trip today, so drive it there:

1. Close the project.
2. In `components/<Your/Component>/component.json`, add to the `metadata` object (create it if
   absent):
   ```json
   "metadata": { "description": "The checkout page. Totals are computed server-side because the discount rules changed twice." }
   ```
3. Reopen the project, open the component, **deselect everything** (click empty canvas), open the
   Explain panel.

**Pass condition:** the card leads with that sentence, verbatim, attributed
`What this component is for — <component name>`, above the node comments. Re-run the B.2 selector
block; `attribution[0]` should now be the component line and `body[0]` the description.

⚠️ If LEG-006 has landed by the time you run this, also test the **top-level** `description` key —
the adapter reads both (`explain/graph.ts`, `authoredDescription`), and both must show.

### B.5 Contrast, on screen, both themes

Computed values are already in `NOTES-LEG-003.md`; this step is to confirm the elements actually
resolve to them.

```js
const hex = c => '#' + c.match(/\d+/g).slice(0,3).map(n => (+n).toString(16).padStart(2,'0')).join('');
const card = document.querySelector('[class*="AuthoredNotes-module__Root"]');
const body = document.querySelector('[class*="AuthoredNotes-module__Body"]');
const attr = document.querySelector('[class*="AuthoredNotes-module__Attribution"]');
const panel = card.parentElement;
JSON.stringify({
  theme:      document.documentElement.getAttribute('data-theme') || 'dark',
  cardBg:     hex(getComputedStyle(card).backgroundColor),
  panelBg:    hex(getComputedStyle(panel).backgroundColor),
  bodyFg:     hex(getComputedStyle(body).color),
  attrFg:     hex(getComputedStyle(attr).color),
  ruleColor:  hex(getComputedStyle(card).borderLeftColor),
  ruleWidth:  getComputedStyle(card).borderLeftWidth
}, null, 2);
```

Run it once in dark and once in light (Editor Settings → theme). Compute each ratio and **print the
foreground and background hex next to it**. Expected, from the token files:

| Pair | Dark | Light |
|---|---|---|
| body fg `#cbd3dc` / `#2e3945` on card `#181d24` / `#f7f9fb` | 11.20:1 | 11.13:1 |
| attribution `#8b95a1` / `#616c79` on card | 5.57:1 | 5.06:1 |
| left rule `#8b95a1` / `#616c79` on panel `#12161b` / `#ffffff` | 5.98:1 | 5.34:1 |
| ⚠️ card fill vs panel fill | 1.07:1 | 1.06:1 |

**Pass condition:** the first three clear 4.5:1 in both themes **and** the non-colour cues are all
present — a 2px left rule, the pencil icon, and the header sentence. The last row is expected to be
~1:1; it is why the other cues exist. If a measured value differs from the table, the element you
measured is not the element the table describes — say which element you measured.

### B.6 — optional, and it costs money

⚠️ A **real Anthropic provider is configured in this editor**. Only do this if you accept the spend.

With the Button selected and a comment on it, press **Explain this node**. Read the answer against
the card above it. **Pass condition:** the model does not restate or paraphrase the comment. It may
quote it exactly and attribute it; it may build on it; it must not rewrite it. Record the answer's
first paragraph either way.

---

## What to write down

1. The `sentences` array from A.6, verbatim → register **L32**.
2. Which parameter landed behind `+N more` → **L33**.
3. Whether any sentence carried a dotted type name, in **dev and in a packaged build** → **L29**.
4. The B.2 body/length comparison and the B.5 table with your measured hex → **L31**, **L35**.
5. Anything that surprised you. The three failures §1 named are all of the shape "the panel looks
   like it works".
