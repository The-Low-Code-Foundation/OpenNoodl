# VFN-014 — The code nobody can read

**Status:** ✅ **BUILT 2026-08-13** (`8b243610` on `vfn-a-asks`; merged `c7af5581`) · ✅ **SPEC-PROVED**
— 19 specs; criterion 3 carries a control (a deliberately leaked generator turns the byte-identity
comparison red), criterion 4 proved by *running* both renderings and diffing outputs **and signal
order** · 🟡 **DRIVEN in part: criterion 5 was reproduced and closed live** · 🔴 **OWED: criteria 1
and 2 — one press of *View Code* in a driven editor**, including whether the 14 lint warnings go ·
**Tier 2** · ✅ mechanism pinned in source

## The report

> *"The generated code looks absolutely nutter butter, nothing we can do about that?"*

Reported 2026-08-13 from the first live test, with a screenshot of *View Code* showing:

```js
__s('[gNyr+^/5_1o]E+asz:^');
Outputs["result"] = __p("/=)cyD(u02h_,OvQCt0L", __p("sltVn~s%r1ar)hK^xD%m", 1) + __p("3XJ_sAbG+cMCOWCRl7r+", 2));

__s('setTotal000000000001');
Outputs["total"] = __p("mulBlock000000000001", __p("getPrice000000000001", Inputs["price"]) * __p("getQty00000000000001", Inputs["quantity"]));
```

**Yes, there is something we can do, and it is small.**

## The mechanism — two separate things, and only one of them is inherent

### 1. What is shown is the *instrumented* build, and it is the only one stored

[`BlocklyWorkspace.tsx:179-182`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx)
generates inside `withBlockProbes(...)`, and that result is what is written to the node's
`generatedCode` parameter. [`LogicBuilderWorkspaceType.onViewCodeClicked():131-133`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts)
reads that same parameter and shows it verbatim.

So every `__p(id, value)` and `__s(id)` on screen is **LGC-003's value tracing** — the thing that
makes the badges in VFN-013 possible. `__p` is an identity function and `__s` returns undefined, so
the program computes exactly what the clean one would; the instrumentation is not a bug and must not
be removed from what runs.

✅ **But `withBlockProbes` is SCOPED, not installed** ([`BlockProbes.ts:40`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockProbes.ts):
*"⚠️ Scoped, not installed. `withBlockProbes` restores the generator afterwards"*). Calling
`generateWithMyBlocks(...)` **outside** that wrapper yields the same program with no probes at all.
A readable rendering is therefore already one call away — no new generator, no second truth about
what the program does.

### 2. The gibberish identifiers are Blockly's block ids

`[gNyr+^/5_1o]E+asz:^` is a Blockly-generated block id. The ids that read sensibly
(`setTotal000000000001`, `getPrice000000000001`) are from the hand-authored QA fixture; anything a
user actually drags gets a random one. Those only appear *because* the probes quote them, so
removing the probes from the displayed build removes the gibberish with them. **Do not try to make
block ids readable** — they are Blockly's identity for the block and the probe pairing depends on
them.

## What to build

**Show the clean program by default; keep the instrumented one available.** Suggested shape:

- *View Code* renders a probe-free generation of the current workspace.
- A toggle — *Show tracing* / *Show what actually runs* — reveals the instrumented build, so the
  thing that is genuinely executed is never hidden, only defaulted away from.
- The "⚠️ 14 warnings" in the screenshot are the linter objecting to undefined `__p` / `__s`. They
  should disappear with the probes; if any survive, they are real and worth reading.

⚠️ **Do not change what is stored or what runs.** The node's `generatedCode` parameter stays the
instrumented build. This task is about the *display* seam only. A "cleaned" build that reached the
runtime would be exactly the second-truth-about-the-program that VFN-011's drift gate exists to
prevent.

## ✅ The `Outputs["result"]` question — REPRODUCED AND ANSWERED 2026-08-13

**It is the inlined body of a saved block, and it is not a defect. Neither filed candidate was
right, and the serious one is eliminated.**

Reproduced from disk artefacts alone — no drive needed. The real saved workspace from the `vfn64-qa`
fixture was fed through the real `expandWorkspace` with the real shelves as they exist on disk:

```
definitions on disk: test1 (mb_r945r1pzjmnx2ya8)
"result" appears in the SAVED WORKSPACE?      false
"result" appears in the BACKPACK DEFINITION?  true

expandWorkspace OK — expansions = 1
top-level stacks AFTER expansion:
  - noodl_when_signal#hat-defPrice000000000001 → … → noodl_send_signal#sendDone000000000001
  - noodl_get_input#jQd(f]*TtfjfC1@mF.IE
  - noodl_get_input#|V+e[@WlxS){0a5DhAxy
  - noodl_define_output#F+HyJIl5$!RXL;(_l:{O → noodl_set_output#[gNyr+^/5_1o]E+asz:^

NEGATIVE CONTROL (definition removed): MyBlocksMissingDefinitionError
```

That fourth stack is the screenshot, byte for byte: `[gNyr+^/5_1o]E+asz:^` is the id in
`__s('[gNyr+^/5_1o]E+asz:^')`, and `/=)cyD(u02h_,OvQCt0L` / `sltVn~s%r1ar)hK^xD%m` /
`3XJ_sAbG+cMCOWCRl7r+` are the `+`, the `1` and the `2`.

**Where it comes from.** The canvas carries a `myblocks_call_statement` at `(310, 50)` with
`extraState.defId = "mb_r945r1pzjmnx2ya8"`, label `test1`. That definition is on the **user
backpack** shelf (saved 09:12:24Z), and its body is `define output result (number)` → `set output
result to 1 + 2`. The call block is a *top-level statement*, so `inlineCall` correctly replaces it
with its body as a top-level stack.

- ❌ **Candidate 1 — the inliner emitting a definition at top level "rather than at its call site"**
  — wrong in its premise. `expandWorkspace` only ever splices a body **at** a call site; it never
  adds a root. Here the call site *was* the top level.
- ❌ **Candidate 2 — stale `generatedCode`** — **eliminated.** Regenerating from the saved workspace
  plus the on-disk shelves reproduces the stored program exactly. The app is not running a program
  the canvas no longer shows.

⚠️ **The reason nothing named `result` is on the canvas is that the canvas shows the call block, not
the definition's body.** That is the feature working. It is also, precisely, the comprehension
defect this task exists to fix — see the criterion added below.

🔴 **One trap, logged because it nearly produced a false finding.** The definition looks absent from
both shelves if you read `~/Library/Application Support/OpenNoodl Editor/` or `…/Noodl Editor/`.
Neither is live. The editor's userData directory is **`~/Library/Application Support/NodeGX/`** since
the rebrand, and the shelf key is nested under `.settings`. Reading the wrong two files gave a clean,
confident, entirely wrong "the definition was never persisted → generation has been declining →
the code is stale" — the register's *"a 'not there' finding can be a grep of the wrong surface"*,
hit exactly. It was caught by searching the disk for the definition id rather than trusting the path.

## Acceptance criteria

1. *View Code* on the QA fixture shows a program with **no `__p` or `__s`**, and no lint warnings
   about them.
2. The instrumented build is still reachable in one gesture, and still labelled as what runs.
3. The node's stored `generatedCode` parameter is **byte-identical** before and after this change —
   asserted, because this task must not touch what executes.
4. The clean rendering and the instrumented one describe the **same program**: same outputs assigned,
   same signals sent, same order. This is a spec, and it is the one that stops the display seam
   drifting into a second truth.
5. ✅ **DONE 2026-08-13.** The `Outputs["result"]` question is reproduced and answered above:
   inlined saved-block body, `generatedCode` is not stale, neither filed candidate was right.
6. 🔴 **New, and it is the finding criterion 5 actually produced.** A reader of *View Code* can tell
   which lines came from a saved block and which they wrote. Richard could not find `result` on the
   canvas because it is not on the canvas — it is inside `test1` — and the code said nothing about
   that. Removing the probes makes those four lines *legible*; it does not make them *findable*.
   A comment marking each inlined region with the definition's name is the cheap answer:

   ```js
   // test1
   Outputs["result"] = 1 + 2;
   ```

   ⚠️ This is a **display-seam** criterion like the rest of the task — the stored, instrumented
   build must stay byte-identical (criterion 3). If a marker is worth having in what runs too, that
   is a separate decision and a separate spec, not a quiet widening of this one.


---

## ✅ What was built, 2026-08-13

- 🆕 [`readableCode.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/readableCode.ts)
  — `renderReadableCode(saved, source)` loads the node's saved `workspace` into a headless
  workspace and calls **the same `generateWithMyBlocks` the flush calls**, simply outside
  `withBlockProbes`. No second generator, and criterion 4 is what forbids one ever appearing.
- `withBlockOrigins(origins, body)` — the marker pass, built the way `withBlockProbes` is built and
  for its reasons: `blockToCode` is the one funnel every block goes through. It **refuses to run
  inside a probed generation**, because comments in that string would reach `project.json`.
- `expandWorkspace` now returns `origins`: head block id → definition name. It is the only thing
  that knows — by the time the generator runs there are no call blocks left.
- The modal leads with the readable build and keeps *Show tracing* one press away, labelled
  **"What runs"**. `Copy Code` copies whichever is on screen. If the readable render declines, the
  instrumented build is shown **with the reason in the info bar** — a refusal must not publish its
  silence as an empty editor.

What *View Code* now shows for the reported fixture:

```js
// test1
Outputs["result"] = 1 + 2;

Outputs["total"] = Inputs["price"] * Inputs["quantity"];
```

### Where each criterion stands

| # | State | How |
|---|---|---|
| 1 | ✅ headless · 🔴 one live press owed | No `__p` / `__s`, asserted **beside** the instrumented build in the same test so "no probes" cannot pass by generating nothing. The lint-warning half needs the real CodeMirror |
| 2 | ✅ built · 🔴 live owed | One press, labelled "Show tracing", header reads "What runs · Read-Only" |
| 3 | ✅ **with a negative control** | instrumented → readable render → instrumented, byte-identical; then again twice. 🔴 **The control installs a wrapper that forgets to restore `blockToCode` and requires that comparison to fail** — the generator is a module-level singleton shared with `DoIt` and My Blocks' shape inference, so a leak here changes what the *next flush* writes to disk |
| 4 | ✅ | Both renderings **executed** with the identity probe pair; outputs *and* the order of assignments and signals compared. Diffing strings would have proved nothing, since the probes compute nothing |
| 5 | ✅ closed 2026-08-13 | Above |
| 6 | ✅ | `// test1` above a statement region; `/* test1 */` inside a value one, because `//` mid-expression would comment out the rest of the line. One marker per region, not per block. A definition name cannot close the comment it is inside (a name containing `*/` is proved harmless by executing the result) |

### ⚠️ Notes for whoever drives it

- `expandWorkspace` runs **twice** per press — once for the region names, once inside
  `generateWithMyBlocks`. It is a pure transform over at most 400 blocks on a button press. The
  alternative was growing `generateWithMyBlocks`' signature with an out-parameter for a display
  feature.
- The readable render always goes through a headless workspace, whereas the flush's fast path
  (no saved blocks) generates from the **live** one. Criterion 4's spec is what holds those two in
  step; if they ever diverge, that is the test that says so.
