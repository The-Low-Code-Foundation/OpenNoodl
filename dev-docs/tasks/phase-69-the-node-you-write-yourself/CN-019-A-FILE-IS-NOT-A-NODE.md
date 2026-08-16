# CN-019 — A file is not a node

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | S |
| **Surface** | `editor` (`noodl-core-ui`) |
| **Rulings** | ✅ **D1a** — the file editor is a real surface, so it has to be right about what it is showing |
| **Depends on** | CN-006 s10 (`CodeFileDocument`). Nothing depends on this, but **CN-007 does in spirit** |
| **Status** | 📋 Open |

## Why this exists

Found by driving the editor in **CN-006 s11**. Open a kit's `noodl_modules/<kit>/index.js` through
the new file editor and it tells the author:

> **This node has no ports yet. Type `Inputs.` — the name you use becomes an input port.**

and labels the file **`SCRIPT`** in its toolbar.

**Neither is true.** The file is a whole module, not a node's body; it has no property panel, no
ports, and `Inputs.` is not injected into it. 🔴 **Not cosmetic** — this is the first file a new kit
author is sent to by CN-006's create command, and the first sentence it shows them points at a
mechanism that does not exist there. It teaches the wrong model at the exact moment the phase is
trying to teach the right one, which is also **CN-007's** whole job.

## The mechanism

`CodeFileDocument` reuses `JavaScriptEditor` from `noodl-core-ui` and inherits FUN-006's port bar.

```
KitsSection.tsx:92  openCodeFile(indexPath)
  → CodeFileDocument                                        CodeFileDocument.tsx:79
  → <JavaScriptEditor validationType="script" … />          CodeFileDocument.tsx:241-249
      → modeLabel('script') → "Script" → CSS-uppercased     JavaScriptEditor.tsx:387, modes.ts:19
      → portBarState(validationType, getCodeAuthoringContext().openNode, text)
                                                            JavaScriptEditor.tsx:316
        → barNoPortsMessage()                               portBar.ts:112, notation.ts:508
      → <div className={css['PortHint']} role="status">     JavaScriptEditor.tsx:465-478
```

Two independent causes, and **only the first is the obvious one**:

**(a) `'script'` turns both symptoms on.** `MODES_WITH_DECLARED_PORTS = ['function', 'script']`
(`declaredPorts.ts:167`), so `modeHasDeclaredPorts('script')` is `true` and `portBarState` never
reaches its silent branch. `CodeFileDocument` picked `'script'` deliberately and for a *different*
reason — a module has top-level statements and `'function'` would misparse it
(`CodeFileDocument.tsx:65-77`). Both meanings are riding on one field.

**(b) `openNode` is ambient module state.** `portBarState` takes it from
`getCodeAuthoringContext()` (`authoringContext.ts:241`), a module-level slot whose **only** producer
is the property panel's `CodeEditorType` (`CodeEditorType.ts:365-400`). `CodeFileDocument` never
calls `setOpenNodeContext` — grep returns only `CodeEditorType.ts`. So the bar's answer depends on
what the author last had open:

| ambient slot | what the file is told |
|---|---|
| cleared (a popout closed properly) | `no-ports` → *"Type `Inputs.`"* — **the observed case** |
| still holding a Function node | `unused-ports` → read **that unrelated node's** ports |

🔴 The second is worse than the first and would not be found by re-driving the observed path. The
contract file already warns about exactly this shape (`authoringContext.ts:181-185`: *"a live wrong
answer, not an empty one"*).

## ✅ The precedent is already in the tree, and it names this case

The lint pass met the same problem and solved it — `portDiagnostics.ts:634-641`:

```ts
if (validationType === 'script') {
  // ⚠️ Message 6 needs a node, because the sentence names the Script node's
  // API. 'script' is also `CodeFileDocument`'s mode for a kit's index.js
  // (a whole module, no ports, no property panel), and there `openNode` is
  // null — so that file gets plain `no-undef` on `Outputs`, which is the right
  // answer there and the wrong one to dress up as port advice.
  const onANode = getCodeAuthoringContext().openNode != null;
  if (!onANode) return base;
```

So one surface of this pair is already correct and the other is not. That is the finding in one
line.

⚠️ **But do not just copy the `openNode != null` guard into `portBarState`.** It fixes row 1 of the
table above and *keeps* row 2 — a stale Function node would still supply ports to a file that has
none. Inferring the subject from ambient state is the defect; a better inference is not the fix.

## What to build

**Make the consumer state what it is showing, rather than have the shared component guess.**

1. **An explicit opt-out on `JavaScriptEditor`** — the bar and the mode label are inline JSX inside
   its render (`JavaScriptEditor.tsx:387`, `:465`), so today there is no lever but `validationType`.
   Add one prop that means *"this is a file, not a node's code"*; `CodeFileDocument` sets it.
   - Port bar: silent. Not "empty" — **absent**.
   - Mode label: something true of a file. `SCRIPT` is the Script node's name; the file's own
     extension or a plain `JAVASCRIPT` is honest.
2. **`CodeFileDocument` must not inherit the ambient slot.** Whatever the prop does for rendering, a
   file document should also not be reading a node context it never set. Clearing on open is the
   cheap version; not consulting it at all when the prop is set is the correct one.
3. **Leave `validationType: 'script'` alone.** It is right for the reason it was chosen (parser
   permissiveness) and changing it to fix a label would break parsing to fix a string.

## Acceptance criteria

1. A kit's `index.js` opened through `openCodeFile` shows **no port hint**, with the ambient slot
   **cleared**.
2. A kit's `index.js` opened **immediately after closing a Function node's code popout** shows no
   port hint either. 🔴 **This is the case that separates a real fix from a copied guard** — write it
   before writing the fix.
3. A real Function node's popout still shows the hint, unchanged. *(Control: it is FUN-006's whole
   feature and this task must not retire it.)*
4. The file editor's toolbar does not call a kit module a `SCRIPT`.
5. **Driven, not just unit-tested** — `CodeFileDocument` is a mounted document and the hint is a
   `role="status"` div; assert on the rendered DOM.

## Traps

- 🔴 **Two tests already encode the current behaviour** and will need updating with a reason, not a
  deletion: `noodl-core-ui/tests/code-editor/portBar.test.ts:72` asserts the exact hint string, and
  `declaredPorts.test.ts:228` asserts `modeHasDeclaredPorts('script') === true`. The latter should
  probably stay true — `'script'` genuinely is a ports mode *for a Script node*.
- 🔴 **`BaseDialog` renders every dialog twice.** A DOM assertion for the hint must filter
  `:not([class*=MeasuringContainer])` or it double-counts.
- ⚠️ **`shouldShowBar` retires the bar after N successes and honours a dismissal**
  (`portBar.ts:227-232`). A drive on a machine that has already dismissed it reads as fixed. Assert
  on `portBarState`'s *kind*, or force it, before believing a clean screenshot.
- ⚠️ **The author sees two toolbars** — `CodeFileDocument`'s own `css.Topbar`
  (`CodeFileDocument.tsx:176-206`) sits above `JavaScriptEditor`'s. Worth a look while in here, but
  out of scope unless it is free.
