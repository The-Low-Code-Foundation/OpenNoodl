# Headless Blockly probes (2026-08-12)

Three Node scripts that prove LGC-003 §2's `disableOrphans` defect **without an editor, a webpack
build or an Electron launch**. That matters: the editor's webpack build is the thing that OOMs
under memory pressure, and it OOM-killed a `test:ci` on the day these were written.

```bash
node dev-docs/tasks/phase-59-logic-seam/probes/orphan-probe.js          # MOVE path
node dev-docs/tasks/phase-59-logic-seam/probes/orphan-create-probe.js   # CREATE path
node dev-docs/tasks/phase-59-logic-seam/probes/byte-identical-probe.js  # the untouched case
```

They `require` Blockly by **absolute path** into this repo's `node_modules`, because Node resolves
modules from the *script's* directory, not the cwd. If the repo moves, fix the `R` constant.

## Expected output

| probe | result |
|---|---|
| `orphan-probe` | after one move: both blocks `DISABLED`, code `""`, `disabledReasons` serialised |
| `orphan-create-probe` | a freshly created top-level block is already `DISABLED`, code `""` |
| `byte-identical-probe` | `byte-identical with NO gesture: YES ✅` |

## Three things that make these lie if you change them

1. **Blockly fires change events on a `setTimeout`.** Reading `isEnabled()` straight after
   `Blockly.Events.fire(...)` returns `ENABLED` and looks like a pass. Every probe drains with
   `await new Promise(r => setTimeout(r, 50))` first.
2. **`isDragging` is a `WorkspaceSvg` method.** Headless `new Blockly.Workspace()` makes
   `disableOrphans` throw `b.isDragging is not a function`. Stubbed to `() => false`, which is the
   correct real-editor value at the moment it matters: a drag's `BlockMove` fires at drag *end*.
3. **The load must be wrapped in `Blockly.Events.disable()` / `enable()`**, exactly as
   `BlocklyWorkspace.tsx:198-206` does. Without the wrapper the deserialisation `BLOCK_CREATE` storm
   reaches the listener and the probe reports damage with *no user gesture* — which is wrong about
   the editor, and convincing. `byte-identical-probe.js` carries the wrapper for that reason.

The blocks are minimal stand-ins carrying the **same connection shape** as the real ones
(`setPreviousStatement` / `setOutput`), because that shape is the only thing `disableOrphans` keys
on. They are not the real `NoodlBlocks.ts` definitions, which need the editor bundle.

Full write-up: `../FINDING-2026-08-12-disableOrphans-kills-every-program.md`.
