# VFN-014 — The code nobody can read

**Status:** 📋 open · **Tier 2** · ~half a day · ✅ **mechanism pinned in source, no reproduce needed**

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

## 🔴 One thing in that screenshot that is NOT explained by any of the above

Lines 1–2 assign **`Outputs["result"]`** from `1 + 2`, and nothing named `result` — and no literal
`1 + 2` — is anywhere on the canvas in the same screenshot. Lines 9–13 are explained (two orphan
`get input price` blocks are visible, and Blockly generates code for orphan top-level blocks). The
`result` pair is not.

**Reproduce this before building anything else here.** Two candidates worth separating:

- a **My Blocks** definition being inlined at top level by `expandWorkspace` rather than at its call
  site — which would be a sibling of the defect VFN-008 already filed, where a placed call block
  publishes no ports; or
- **stale `generatedCode`** on the node, i.e. the parameter not being rewritten when blocks are
  deleted.

The second would be the more serious: it means the app runs a program the canvas no longer shows.

## Acceptance criteria

1. *View Code* on the QA fixture shows a program with **no `__p` or `__s`**, and no lint warnings
   about them.
2. The instrumented build is still reachable in one gesture, and still labelled as what runs.
3. The node's stored `generatedCode` parameter is **byte-identical** before and after this change —
   asserted, because this task must not touch what executes.
4. The clean rendering and the instrumented one describe the **same program**: same outputs assigned,
   same signals sent, same order. This is a spec, and it is the one that stops the display seam
   drifting into a second truth.
5. The `Outputs["result"]` question above is reproduced and its answer written into this file.
