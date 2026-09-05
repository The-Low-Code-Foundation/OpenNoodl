# Defects building spine lesson 3 found

**Opened 2026-09-05 while building [SYL-006](SYL-006-LESSON-3-POKE-IT.md).** Every row is a finding
about the *product or the lesson tooling*, not about lesson 3 — lesson 3 works around each one and
ships. Rows carry an **owner or `NONE`**; `NONE` means nobody is doing this and it will be
rediscovered at full price by whoever writes lesson 4.

⚠️ None of these blocked an acceptance criterion, so none was fixed here. The standing rule is build
the tasks, not farm the defects. Lesson 2's register is
[DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) and its five rows are all still open.

| # | severity | owner | one line |
|---|---|---|---|
| E1 | 🔴 high | `NONE` | a **Button** cannot be put on the design system from the properties panel |
| E2 | ⚠️ medium | `NONE` | `Color Blend` yields `#NaNNaNNaN` for every `var(--token)` colour, silently |
| E3 | ⚠️ medium | `NONE` | a new wire does not pull its source's value — it carries only what was already cached |
| E4 | low | `NONE` — ⚠️ **runner half fixed s9** | the curriculum's lesson 6 names a node called **Timer**; the product calls it **Delay** |

---

## E1 🔴 — a Button cannot be put on the design system from the properties panel

**The shape.** `net.noodl.controls.button` has two ways to get a background:

- **`backgroundColor`** — a `color` port in the **Style** group, `default: '#000000'`
  ([`button.ts:41`](../../../packages/noodl-viewer-react/src/nodes/controls/button.ts#L41)).
- **`variant`** — the port whose `primary` value paints a `--primary` ground with
  `--primary-foreground` text, described in that file's own comments. It is declared
  **`allowConnectionsOnly: true`**, so it does not appear as a settable field at all.

So the only background a learner can choose by hand is a raw colour, and the port they *can* reach
opens on a hard-coded black that no token in the project produces.

**Measured, not reasoned about.** `measure-from-disk.js` at 1280x900 over lesson 3's solution draws
the `Poke` button as `#000000` with white text, beside a `--primary` blue circle and a `--surface`
card. The project carries 192 shipped token defaults and the button uses none of them.

🔴 **Why this one matters more than it looks.** Every project the MCP authoring tools produce is
token-based, and `get_style_vocabulary`'s standing instruction is *"set colour params as
`var(--token)`, never raw hex"*. A Button is the first interactive node in the spine, so the first
button a learner ever adds is off-palette **and the on-system route is not offered to them**. That
is not a lesson working around a wart — it is the product teaching the opposite of its own rule.

⚠️ **Lesson 3 leaves it black deliberately.** Painting the answer's button and not the learner's
would break the rule that every parameter on a node a lesson creates is one a step asks for. The
wart is visible in the shipped answer on purpose.

**What a fix looks like.** Either give `variant` an enum the panel can render, or default
`backgroundColor` to `var(--primary)`. The second is the smaller edit and the first is the right
one. Same family as
[[a-second-copy-of-a-palette-drifts-silently]] — two mechanisms for one property, and the
load-bearing one is the one that ignores the design system.

## E2 ⚠️ — `Color Blend` yields `#NaNNaNNaN` for every token colour, silently

`setRGB` does `parseInt(hex.substring(1,3), 16)` three times
([`colorblend.ts:20-25`](../../../packages/noodl-viewer-react/src/nodes/std-library/colorblend.ts#L20)).
Handed `var(--primary)` it parses `"ar"`, `"--"` and `"pr"` — all `NaN` — and `rgbToHex` returns the
string `#NaNNaNNaN`. No warning, no fallback, no console error.

The node's own `result` description already says *"the inputs must be 6-digit hex, since any other
notation yields nonsense"*, so this is **known and documented at the port level** — but it is
documented where an author reads ports, not where a project convention is written, and the two say
opposite things. `Color Blend` is unusable in any project built by the authoring tools.

⚠️ **This changed lesson 3's design.** The corpus's own idiom for a smooth interaction
(`anim-hover-highlight`) is `Switch → Animate To Value → Color Blend → backgroundColor`, and it was
the first design tried. It was dropped for `opacity` because of this row, which is why the lesson
animates transparency rather than colour.

**What a fix looks like.** Resolve `var(--…)` against the project's tokens before parsing, or refuse
the value with a graph warning. A silent `#NaNNaNNaN` is the worst of the three options.

## E3 ⚠️ — a new wire does not pull its source's value

`connectInput` reads `sourcePort.value` — the port's **cached** value — and sends nothing when it is
`undefined` ([`node.ts:544-554`](../../../packages/noodl-runtime/src/node.ts#L544)). An output
backed by a getter has no cached value until something has called `flagOutputDirty` on it, so
connecting a wire to a node that has not yet emitted leaves the target holding its **own parameter**
while the graph reads as though it is being driven.

**It works in lesson 3 by initialisation order, not by design.** `Switch.onFromStart` has
`default: false` and its setter calls `flagOutputDirty('state')`, which caches `false`; that reaches
`Animate To Value.targetValue`, which caches `0` on `currentValue`; and only then does
`Reaction.opacity` receive `0`. Break any link in that chain and the lesson ships with `Ouch!`
visible on load.

🔴 **No gate can see it.** F4 renders the solution and passes either way — a visible word draws
perfectly well. It was caught by rendering the solution and looking at the picture, which is the
only instrument that disagrees. See
[[verify-the-consequence-not-just-the-mechanism]].

**Not necessarily a bug** — pull-on-connect has real costs, and edge-triggered ports must not be
replayed. But it is undocumented, and a lesson that teaches wiring is exactly where it surfaces.

## E4 low — the curriculum names a node the product does not have

`curriculum.json`'s spine lesson 6, *"It gets demanding"*, lists `nodes: ["Timer", "And", "Or",
"Inverter"]`. The type name is `Timer`, but its **displayName is `Delay`**, it sits under
**Utilities** rather than a time category, and it has **no value output at all** — only signals
(`start`, `stop`, `restart` in; `timerFinished`, `timerStarted` out).

Two consequences for whoever writes lesson 6: the prose must say **Delay**
([the two vocabularies](../../../packages/noodl-mcp/src/lessons)), and any design that wanted a
progress number out of it has to come from somewhere else. Checked while looking for a
signal-to-value bridge for lesson 3, and worth writing down before it costs a design.


---

## ⚠️ E4 — NARROWED, not closed (2026-09-05, session 9)

The **editor-facing half is fixed**: the lesson runner's *"Looking for…"* line used to repeat the
internal type id back at the learner, so a step grading a `Timer` told them to look for a "Timer"
while the picker offers **Delay**. That sentence now resolves through the node picker's own label
function — see [D2](DEFECTS-LESSON-2-FOUND.md), fixed in the same pass, which turned out to be the
same defect wearing a different hat for eight node types.

🔴 **The row itself stays open.** What E4 is about is the **curriculum entry**, whose text lives
in the other repo and still names a node called `Timer`. Nothing in this pass touched it, and the
prose a learner reads in the lesson body is unchanged. Owner still `NONE`.
