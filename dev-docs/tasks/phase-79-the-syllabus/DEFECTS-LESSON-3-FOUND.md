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
| E2 | ⚠️ medium | ✅ **FIXED 2026-09-05 (s9)** — ⚠️ see E5, the export's copy | `Color Blend` yields `#NaNNaNNaN` for every `var(--token)` colour, silently |
| E3 | ⚠️ medium | `NONE` | a new wire does not pull its source's value — it carries only what was already cached |
| E4 | low | `NONE` — ⚠️ **runner half fixed s9** | the curriculum's lesson 6 names a node called **Timer**; the product calls it **Delay** |
| E5 | 🔴 high | ✅ **FIXED 2026-09-05 (s9)**, same session that caused it | the code export carries E2's defect in its own copy, and the two have now diverged |

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


---

## ✅ E2 — FIXED 2026-09-05 (session 9)

`setRGB` is gone. A `parseColor` reads `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`/`rgba()` and
`var(--token)` — the last resolved against `getComputedStyle(document.documentElement)`, which is
the only honest source: a token can be redefined per theme, per component, per media query, and
only the browser knows which definition won. A token resolving to another token is followed
(bounded at 8, so a self-referential definition cannot hang a render), and `var(--x, #fff)` uses
the author's own fallback the way CSS would.

🔴 **A colour it still cannot read no longer produces a colour at all.** It shows the **nearest
authored endpoint, verbatim** — a colour the author chose, which the DOM may itself resolve — and
raises `color-blend/unreadable-color`, deduped per distinct value. The dedupe is not a detail: this
node re-blends on every frame an animation touches it, so an undeduped report would emit an event
per frame and drown the channel it is reporting on (NDA-004's lesson on the Expression node).

⚠️ **Three-digit hex was broken in the same function and no row had recorded it.** `#abc` read
`ab`, `c` and `""`, so the blue channel alone came back `NaN` — a colour that is *wrong* rather
than absent, which is the harder kind to see. Fixed in the same pass and gated separately.

The `result` port's description used to document the defect — *"the inputs must be 6-digit hex,
since any other notation yields nonsense"* — and now describes what the node does.

`packages/noodl-viewer-react/tests/syl-e2-colorblend-tokens.test.ts`, 12 rows including three
controls. The reverted arm (the blind substring parse, restored verbatim) reddens 8 and leaves all
three controls green. Full `noodl-viewer-react` suite: **1283 passed, 0 failed**, 97 suites.

## 🔴 E5 — NEW, owner **P18**: the export has its own copy, and I have just made them disagree

`nodegx-export`'s emitted `blendColor` (`src/emit/utilLib.ts`) is, in its own words, *"a
transcription of colorblend.ts, **holes and all**"* — the same
`parseInt(hex.substring(at, at + 2), 16)`, and a doc comment that deliberately preserves the
nonsense, citing the very port description this session rewrote.

So **before** today both copies were wrong and agreed; **now** the runtime resolves tokens and the
export does not. Every exported app still paints `#NaNNaNNaN` where a token is blended. That is
worse than the state I found, for the export's users, and it is recorded here rather than quietly
left:

- 🔴 **I did not fix it, deliberately.** A peer was editing `nodegx-export/src/emit/` throughout
  this session (`sseLib.ts` ten minutes before this was written). Editing a sibling file in that
  directory would collide with live work and redden their suite mid-session, and the emitted-code
  goldens would move under them.
- **What the fix is:** port `parseColor` into `utilLib.ts`'s emitted source and update the two
  doc comments that currently promise the defect. The emitted copy has no error bus, so the
  fallback-to-nearest-endpoint half applies and the warning half does not.
- ⚠️ **The parity question is the real row.** Two hand-maintained transcriptions of one node will
  drift again; E5 is the second sighting this session, after G1's (where the export was the copy
  that was *right*). Whoever owns export/runtime parity should know the count is two.


---

## ✅ E5 — FIXED 2026-09-05, later the same session

`nodegx-export/src/emit/utilLib.ts` now emits a `readColor` alongside `blendColor` — the same
notations the runtime reads, `var()` resolved against the document the same way. A colour it still
cannot read falls back to the nearest authored endpoint; the exported app has no error bus, so the
fallback is the whole of the behaviour there and the doc comment says so.

The package was **re-checked before starting, not assumed**: the P18 peer had committed their
session-88 hand-off and `git status` over `packages/nodegx-export` was clean, so the collision
risk the hand-off warned about had gone. `tests/small-utilities.test.ts` **20/20**, full package
**2780/2780 across 76 suites**.

## 🔴 What this actually exposed, which is worse than E5 and is the thing to remember

**The E2 commit left `nodegx-export`'s suite RED, and I did not know for forty minutes.**

`small-utilities.test.ts` §A does not compare the emitted helper against a description of the
runtime — it **loads `colorblend.ts` from source and runs it**. So it is a real parity gate, and it
did its job immediately: the moment the runtime changed, it failed. I simply never ran that
package, because I had reasoned that Color Blend lived in `noodl-viewer-react` and had run
`noodl-viewer-react`.

🔴 **A node's blast radius is not its package.** Two other packages compile or execute
`colorblend.ts`: `nodegx-export` grades against it, and the catalogs are generated from its port
descriptions. Both were broken by one commit, in two different ways, and neither is visible from
the directory the file sits in.

🔴 **And the failure was worse than the defect for a moment.** The suite failed with
`this.raiseRuntimeError is not a function` — the node is also loaded as a **bare definition
object**, with no `Node.prototype` under it, so the new report *threw* where the old code merely
returned nonsense. The report is now guarded: reporting must never be the thing that throws, and an
unreadable colour has to degrade to the fallback rather than take the render down. That guard is a
real fix, and it exists only because a suite I had not thought to run was watching.

⚠️ **The parity question is now answered in one direction only.** `Color Blend` and `Boolean To
String` have a gate that loads the interpreter's own source. `Expression` (G1) does **not** — the
export's correctness there was read off `plan.ts` by eye. That asymmetry is the row P18 should
still want.
