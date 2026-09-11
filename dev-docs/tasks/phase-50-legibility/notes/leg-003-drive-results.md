# LEG-003 — the drive, executed

**2026-08-12.** `NOTES-LEG-003-DRIVE.md` run end to end against a running editor. §1's acceptance had
been outstanding since the lane shipped ("**§1's acceptance is NOT met**" — the lane could not launch
an editor). **It is met now.**

Fixture: `NodeGX test projects/leg003-drive`, a git-backed copy of `phase55-s8-kimi-k3-rerun`,
component `/Components/Footer` — 24 visual nodes, every one labelled, plus a `Component Outputs` root
and 10 connections. Chosen because it is the only component in the corpus carrying all five node
types the drive needs *and* real wiring.

## Result

| Step | Result |
|---|---|
| A.1–A.4, the four change kinds | ✅ all four render, in English |
| A.6 pass conditions (4 of 4) | ✅ |
| **L29 — dotted type names in dev** | ✅ **none**; degraded path proved separately |
| **L33 — which parameter hides behind `+N more`** | ✅ **alphabetical, not change-order** |
| B.2 verbatim rendering | ✅ **character-for-character, 82 = 82** |
| B.3 node link reaches canvas | ✅ |
| B.4 component description, **both keys** | ✅ |
| B.5 contrast, both themes | ✅ text pairs **exact**; two table rows corrected |
| B.6 the paid step | ✅ **the model quoted and attributed, it did not paraphrase** |

---

## A — the four sentences, verbatim

Pasted from `[class*="ChangeRow"]`, grouped under `WIRING` / `VALUES` / `LAYOUT`, section header
`What changed in …` present:

```
Rewired Component Outputs 'Footer signals out'.returnsClicked to come from Button 'FAQ link'.onClick (was Button 'Returns link'.onClick)
Changed Columns 'Footer columns' (alignX: (unset) → 'center', marginX: {"unit":"px","value":48} → {"unit":"px","value":64}, mediumLayout: '1 1' → '1 1 1', +1 more)
Renamed Button 'Ceramics link' to 'Ceramics'
Moved Text 'Blurb' from Group 'Brand column' into Columns 'Footer columns'
```

All four pass conditions hold: the rename names the **old** label before `to '<new>'`; the rewire
names the target input, the new source and the old one in brackets; the reparent names **both
containers by name**; the multi-parameter line shows three deltas and a `+1 more` tail.

### L33 — the hidden parameter

Changed in the order `marginX, mediumLayout, smallLayout, alignX`. Rendered
`alignX, marginX, mediumLayout, +1 more`. **`smallLayout` is the one behind `+1 more`.** The drive's
warning is confirmed and is not cosmetic: `alignX` was changed *last* and is printed *first*, so the
three spelled out are the first three **alphabetically** and a reviewer cannot assume the hidden one
is the least recent.

### L29 — no dotted type names, and the degraded path proved

No sentence carries a raw type name; every row reads `Button` / `Columns` / `Text` / `Group` /
`Component Outputs`. The failure mode was proved real rather than assumed absent, by calling
`DiffFormatter.nodeName` with both providers:

| provider | rendering |
|---|---|
| `catalogDisplayNames()` (healthy, resolves `net.noodl.controls.button` → `Button`) | `Button 'Ceramics link'` |
| `() => undefined` (the `catch` branch) | `net.noodl.controls.button 'Ceramics link'` |

So the check discriminates, and **dev passes it**.

### A.7 — the packaged half of L29, and it passes

The drive calls this "the check that matters most, and it must also be run against a packaged build,
not only a dev run", because `catalogDisplayNames()` resolves the catalog through a `require` inside a
`try`, and a packaged bundle resolves modules differently from a dev one.

A real package was built for this (`npm run build:editor` → `packages/noodl-editor/dist/mac-arm64/NodeGX.app`,
signed, running from `app.asar` — confirmed by the renderer URL) and launched with a debug port. The
fixture needed no re-editing: the four edits are **uncommitted on disk**, so opening the project
reproduces the same diff.

**The packaged sentences are byte-identical to the dev ones** — all four, same display names, `Button`
/ `Columns` / `Text` / `Group` / `Component Outputs`, same `WIRING` / `VALUES` / `LAYOUT` groups, same
`+1 more`. **No dotted type name anywhere. L29 is closed on both halves.**

⚠️ The module-access trick used throughout the dev drive does **not** work in the packaged build:
`webpackChunknoodl_editor` exists but `__webpack_require__.c` reads **0 entries**, so there is no model
API to call. Everything in a packaged drive has to go through the UI. That is survivable here only
because the diff panel reads uncommitted disk state — a drive that needs to *make* changes in a
packaged app has no such shortcut.

### ⚠️ New — a value delta prints as raw JSON

`marginX: {"unit":"px","value":48} → {"unit":"px","value":64}`. Every other delta on that line is
human-readable (`'1 1' → '1 1 1'`, `(unset) → 'center'`). A unit-value parameter is rendered by
`JSON.stringify`, so the one change kind a designer is most likely to make — a spacing tweak — is the
one that reads like a machine. Not predicted by the drive; filed as **L37**. It is a legibility defect
inside the phase about legibility, and it is a formatter change, not a model one.

---

## B — the authored card

### B.2 — verbatim, before any model call

Comment set on Button `FAQ link`, two lines and a distinctive token:

```
Retry twice, not three times.
PSP-4412: a third attempt inside 60s reads as fraud.
```

| check | result |
|---|---|
| card present **before any explanation requested** | ✅ `true` |
| body vs typed text | **82 chars = 82 chars, `identical: true`**, newline preserved |
| header sentence | ✅ `Written by the author — shown exactly as typed, not generated` |
| 2px left rule, pencil icon | ✅ both present |

### 🔴 The drive's own B.2 pass condition contradicts its instruction

B.2 says **"Do not press 'Explain this node'"**, then requires `attribution[0]` to read
`Note on Button '<label>'`. **It cannot read that on the path B.2 puts you on**, and the panel is
right, not broken. `ExplainPanel.tsx:165-185` has **two sources**, and its comment says so:

> Once a session exists the assembled context is the truth (**it knows catalog display names**…);
> before one does, the live component is read directly, so a comment reaches the reader without a
> provider, a token or a click.

`fromComponentModel` carries no catalog `displayName`, and `subjectForNode` deliberately shows the
label alone rather than doubling `net.noodl.controls.button 'Button'`. Verified for free by calling
`collectAuthoredNotes` directly:

| input | subject |
|---|---|
| no `displayName` (**pre-session — what B.2 reaches**) | `FAQ link` |
| with `displayName: 'Button'` (**post-session**) | `Button 'FAQ link'` |
| `label === displayName` | `Button` — not doubled (**L30 confirmed**) |

**Then B.6 confirmed it live**: after the paid explanation created a session, the same card's
attribution changed to **`Note on Button 'FAQ link'`** with no other edit. So this is one behaviour
with two correct renderings, and **the drive's expected string belongs to B.6, not B.2**. Filed as
**L38**; the fix is to the drive, not the panel.

### B.3 — the link reaches the canvas

`revealCitedNode` → `switchToComponent('/Components/Footer', { node: 'help_faq', pushHistory: true })`,
captured by spying on the call. Hover fires `highlightCitedNode` and **navigates nothing** (0 calls).

⚠️ Two traps for the next person. The link is a `<button>` that renders at **0×0** whenever its side
panel is not the visible one, so a coordinate click silently hits nothing and reads as a dead handler
— **assert `getBoundingClientRect().width > 0` before clicking**. And the reveal itself hides the
Explain panel, so the second click of a pair always misses; reopen the panel between clicks.

### B.4 — both description keys render

The fixture already carried a **top-level** `description` (LEG-006's key, which now survives the
save), and it renders at component scope attributed `What this component is for — /Components/Footer`,
**above** the node comments. The `metadata.description` fallback was tested in memory through
`fromComponentModel`:

| state | rendered description |
|---|---|
| top-level only | the top-level text ✅ |
| `metadata.description` only | the metadata text ✅ |
| both present | **top-level wins** — matches `authoredDescription(component.description, component.metadata?.['description'])` |

So LEG-006's ⚠️ is satisfied: the adapter reads both, and both show.

### B.5 — contrast, measured on the live elements, both themes

Every ratio computed from sampled `getComputedStyle`, with the foreground and background hex printed,
and **refusing to measure while the card's width was 0**.

| Pair | fg / bg | Dark | fg / bg | Light |
|---|---|---:|---|---:|
| body on card | `#cbd3dc` / `#181d24` | **11.20** | `#2e3945` / `#f7f9fb` | **11.13** |
| attribution on card | `#8b95a1` / `#181d24` | **5.57** | `#616c79` / `#f7f9fb` | **5.06** |
| left rule on its backdrop | `#8b95a1` / `#181d24` | **5.57** | `#616c79` / `#f7f9fb` | **5.06** |
| card fill vs panel fill | `#181d24` / `#181d24` | **1.00** | `#f7f9fb` / `#f7f9fb` | **1.00** |

**Pass**: the first three clear 4.5:1 in both themes, and the 2px rule, pencil icon and header
sentence are all present.

🔴 **Two rows of the drive's table are wrong, and the same mistake makes both.** The table assumes the
card sits on a panel of `#12161b` (dark) / `#ffffff` (light), giving 5.98 / 5.34 for the rule and
1.07 / 1.06 for the fills. The card's actual backdrop is `BasePanel-module__Root`, which is
**`#181d24` / `#f7f9fb` — the card's own colour**. Per the drive's own instruction I am naming the
element I measured: `BasePanel-module__Root`, resolved by walking ancestors to the first non-transparent
background.

Consequences, and the second matters:
- the rule ratio is **5.57 / 5.06**, not 5.98 / 5.34 — lower, still comfortably passing;
- the card/panel fill ratio is **1.00, not 1.07** — the card fill is not *nearly* invisible against
  its panel, it is **exactly** invisible. The drive predicted "~1:1 and that is why the other cues
  exist"; the true value strengthens that conclusion. **The 2px left rule is the only thing separating
  the card from the panel**, so it is load-bearing and must not be softened. **L35** in the register is corrected to match.

### B.6 — the paid step: the model quoted, it did not paraphrase

One explanation request against the configured Anthropic provider, with the Button selected and the
comment on it. **Pass.** The answer's treatment of the note, quoted in full:

> The author's note on this node — *"Retry twice, not three times. PSP-4412: a third attempt inside
> 60s reads as fraud."* — describes a payment-retry policy that has nothing to do with an FAQ link's
> click signal; it reads as a note left on the wrong node, or carried over from elsewhere, and I won't
> try to reconcile it with what this button actually does here.

It **quoted the comment exactly and attributed it to the author**, did not rewrite or sentence-case
it, and declined to invent a reconciliation. That is the §2 rule ("quote, never paraphrase; never
contradict silently") behaving correctly under a deliberately mismatched note.

⚠️ Worth recording: the answer also read the graph correctly and caught the A.2 rewire unprompted —
*"clicking the button labelled 'FAQ' reports to the parent page that the returns link was clicked"*.
The card stayed present and verbatim above the answer throughout.

---

## Method note — how the four edits were made

The four change kinds were produced by calling the editor's own model APIs in the renderer
(`setLabel`, `removeConnection`/`addConnection`, `detachNode`/`attachNode`, `setParameter`) rather
than by mouse-dragging the canvas. The drive's constraint is that the change must be in the editor's
**in-memory** project — which the diff panel reads as
`safeGraphDiff(localDiff.baseProject, ProjectModel.instance.toJSON())` — and these are the same
mutations the canvas gestures perform. Stated plainly because it is a deviation from "by hand": what
is verified here is **the diff panel's rendering of four change kinds**, not the drag gestures that
can produce them.

⚠️ Two things cost real time and will cost yours:

1. **`removeConnection` needs the connection object, not a literal.** Passing an equal-shaped
   `{fromId, fromProperty, toId, toProperty}` removes nothing and returns no error — the connection
   count went 10 → **11** and the rewire silently became an add. Find it in `graph.connections` and
   pass that reference.
2. 🔴 **Opening a project rewrites every component on disk.** The tree was clean at launch; after the
   editor opened it, all 12 components showed as modified, and the version-control panel listed every
   one of them. A drive that reads "one component changed" as its pass condition will fail on a
   correctly-behaving editor. **Commit the editor's normalisation as the baseline, then make the
   edits** — that is what produced the single-component diff above.

Routing also has a trap worth knowing: `Router.route()` early-returns when `this._route == args.to`,
so opening a second project while already in the editor is a **silent no-op**. Route to `projects`
first, then to `editor`. Reading `ProjectModel.instance` after an apparently-successful open is the
check that catches it — it caught it here, after the panel had already been read once against the
wrong project.
