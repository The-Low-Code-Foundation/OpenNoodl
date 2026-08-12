# 🔴 LGC-003 §2 — `disableOrphans` disables *every* Noodl program, and empties its generated code

**Found 2026-08-12, reproduced headlessly.** Severity: blocking. It destroys the user's saved
program on the first interaction, and it is on `cline-dev` now (merge `f32a9cd4`).

## The one sentence

`BlocklyWorkspace.tsx:232` registers `Blockly.Events.disableOrphans`, and because **there is no hat
block anywhere in `NoodlBlocks.ts`**, every top-level block in every Logic Builder program is an
orphan by Blockly's definition — so the first drag greys out the whole program, collapses
`generatedCode` to `""`, and serialises `disabledReasons: ["ORPHANED_BLOCK"]` into `project.json`.

## Why "no orphans" is not a case that exists

Handover question #11 records this as *"byte-identical on reopen is now true only for programs with
no orphans"*. That framing assumes orphans are an occasional subset. They are not. Every block
shape in `NoodlBlocks.ts`, enumerated:

| block | prev | next | output |
|---|---|---|---|
| `noodl_define_input` | ✅ | ✅ | — |
| `noodl_define_output` | ✅ | ✅ | — |
| `noodl_set_output` | ✅ | ✅ | — |
| `noodl_define_signal_input` | ✅ | ✅ | — |
| `noodl_define_signal_output` | ✅ | ✅ | — |
| `noodl_send_signal` | ✅ | ✅ | — |
| `noodl_set_variable` | ✅ | ✅ | — |
| `noodl_set_object_property` | ✅ | ✅ | — |
| `noodl_array_add` | ✅ | ✅ | — |
| `noodl_get_input` | — | — | ✅ |
| `noodl_get_variable` | — | — | ✅ |
| `noodl_get_object` | — | — | ✅ |
| `noodl_get_object_property` | — | — | ✅ |
| `noodl_get_array` | — | — | ✅ |
| `noodl_array_length` | — | — | ✅ |

**Hat blocks (next, but no previous and no output): NONE.**

Blockly 12.3.1's `disableOrphans`, read out of `blockly_compressed.js`:

```js
const d = a.getParent();
if (d && !d.hasDisabledReason(ORPHANED_BLOCK_DISABLED_REASON)) { /* re-enable descendants */ }
else if ((a.outputConnection || a.previousConnection) && !b.isDragging()) {
  do { a.setDisabledReason(true, ORPHANED_BLOCK_DISABLED_REASON); a = a.getNextBlock(); } while (a)
}
```

A parentless block with *either* a `previousConnection` or an `outputConnection` is disabled, along
with its entire `next` chain. Every Noodl block has one or the other. A Noodl program is a
free-floating statement stack, so **the top of every stack matches the `else if` every time**.

`disable-top-blocks`'s greying is designed for languages where runnable code hangs off a hat
(`controls_if` under an event block). We have no hat, so the predicate that means "unreachable
code" here means "the program".

## Reproduction — headless, no editor needed

`orphan-probe.js` / `orphan-create-probe.js` (scratchpad). Real Blockly 12.3.1 from
`node_modules`, minimal stand-in blocks carrying the *same connection shape* as the real ones.

**Path 1 — nudge an existing program:**

```
after load (no listener yet)       noodl_define_input=ENABLED   noodl_set_output=ENABLED
code after load: "/* define */\nOutputs.total = 0;\n"
after ONE move of the top block    noodl_define_input=DISABLED  noodl_set_output=DISABLED
code after move:   ""
serialised: {... "disabledReasons":["ORPHANED_BLOCK"] ... }
```

**Path 2 — the path a user hits first, dragging a block out of the toolbox:**

```
freshly created top-level block: DISABLED
code: ""
serialised: {... "disabledReasons":["ORPHANED_BLOCK"] ...}
```

⚠️ Two harness notes, so the next person does not lose the time twice:
- Blockly fires change events **on a timeout**, not synchronously. A state read straight after
  `Events.fire` shows `ENABLED` and looks like a pass. Drain with `await setTimeout(…, 50)`.
- `isDragging` exists only on `WorkspaceSvg`, so headless `disableOrphans` throws `b.isDragging is
  not a function`. Stubbed to `() => false`. That is the correct value for the real editor at the
  moment the listener matters: a drag's `BlockMove` fires at drag *end*, when `isDragging()` is
  false. The disable/enable and serialisation are model-level, so the conclusion transfers.

## What it breaks

1. **The program stops working.** A disabled block generates no code, so `generatedCode` empties and
   the node stops setting its outputs. Silent — nothing throws.
2. **It is written to disk.** `disabledReasons` is serialised, so it survives save/reopen.
3. **LGC-002 §2 and LGC-004 #13 cannot pass as written.** Both require the serialised `workspace` to
   be byte-identical after a close/reopen. Any program the user has touched carries
   `disabledReasons` on every top-level block.
4. **LGC-003 §2's static tell is inverted.** It is supposed to mark the blocks that *didn't run*.
   It marks all of them, including the ones that did.
5. **It is the opposite of the sibling half's own design rule.** `BlockValueBadges.ts:12` says the
   hollow mark is drawn rather than `setEnabled(false)` because *"disabling is model state"*. The
   static half writes precisely that model state, to the whole program.

## The fix, and why it is not one line back

Reverting `BlocklyWorkspace.tsx:232` removes the destruction and leaves §2's static half unbuilt.
That is the safe immediate move. Doing §2 properly needs one of:

- **Draw it, do not set it** — the same treatment as the dynamic hollow wash, which was designed to
  avoid exactly this. Handover #11 already names this option ("drawn like the hollow wash instead —
  a different feature"), and this finding upgrades it from a preference to the only correct route.
- **Give the language a hat**, so "orphan" starts meaning what Blockly assumes it means. That is a
  language change with a migration for every saved program, and it is not a §2-sized job.

**Recommendation:** revert the listener, keep the dynamic half, and re-file §2's static half against
the drawn treatment. 📋 **Richard's call** — it is his §2.

## What is NOT broken, measured rather than assumed

**Opening and closing a program without touching it is byte-identical. ✅** The load is wrapped in
`Blockly.Events.disable()` / `enable()` (`BlocklyWorkspace.tsx:198-206`), so deserialisation fires no
`BLOCK_CREATE` and `disableOrphans` never runs on open. `byte-identical-probe.js` confirms it:
`before === after`, no `disabledReasons`.

⚠️ **This is worth stating because a probe that omits the `Events.disable()` wrapper reports the
opposite**, and convincingly. A first version of that probe loaded the program without it and showed
`disabledReasons` appearing with **no user gesture at all** — because Blockly's events are
asynchronous, so a listener attached "after the load" in code order still receives the storm. That
made the mitigation comment look wrong. It is not wrong; the probe was. **Replicate the
`Events.disable()` wrapper or the measurement lies**, and the comment's stated reason ("registered
after the load") is doing less work than the `Events.disable()` a few lines above it, which is what
actually buys the result.

So the criterion is meetable for an untouched program, and unmeetable the moment anyone drags
anything. The task files' framing — *"byte-identical apart from blocks you actually made"* — is the
part that cannot hold.

## Not yet driven

This is proved at the model layer, not in a rendered editor. What a drive still adds: whether the
grey is *visible* as grey, and whether the first-open case (listener registered after the load, so
the deserialisation `BLOCK_CREATE` storm is missed by design) really leaves an untouched program
alone. The probes say the damage needs one user gesture, not an open.
