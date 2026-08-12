# Phase 61 — next session

**Written 2026-08-12 afternoon**, at the end of the drive session. Replaces the morning handover.

**4 of 9 built. Three of them have now been driven, and they mostly work.** What the drives actually
produced is not a tick-list — it is **one defect that blocks the flagship task**, and it is not in any
of the code this phase wrote.

---

## 1. 🔴 Read this first — the gate does not discriminate

**`validationTypeForEditType` can never return `'expression'` or `'script'`.** It tests `type?.name`
— the *type's* name, which is `'string'` for every JavaScript code port — three lines below its own
comment saying *"the port name is the only signal available for that."* Both name-based branches are
dead code. Measured in the running editor:

| Node | Code port | `type.name` | Popout title |
|---|---|---|---|
| Function | `functionScript` | `string` | **FUNCTION** |
| Script (`Javascript2`) | `code` | `string` | **FUNCTION** |
| **Expression** | `expression` | `string` | **FUNCTION** |

**It is already a shipped, user-visible defect, with none of this phase's code involved.** `no-undef`
is disabled in `'expression'` mode on purpose, because a bare identifier in an Expression *becomes an
input port*. The mode never selects, so the rule runs:

```
total * 2   →   ⚠ 'total' is not defined.  eslint:no-undef     …and the port `total` is then created
```

The code is right, the port exists, and the editor underlines it. Read off the lint tooltip, then the
port read back off the node.

⚠️ **The fix is NOT "use the port name".** `TypeView.name` carries it, but `functionScript` contains
`script` and the Script node's port is `code` — switching **inverts** those two while fixing
Expression. The discriminator has to be *decided*.

**Filed in FUN-003 F17, FUN-004 §3, FUN-009. FUN-009 owns the fix** — it is the task that knows why
the two rules differ. **FUN-004 is blocked until it lands**, because all four of its messages would
fire inside Expression editors, which its own §3 calls *"actively destructive."*
Memory: [[every-js-code-port-opens-in-function-mode]].

---

## 2. Where the phase actually stands

| Task | State |
|---|---|
| **FUN-001** | ✅ built. §2 still **unsigned by Richard** — see §5.1 |
| **FUN-002** | ✅ built · ✅ **driven, 6 of 7**. One criterion open and it needs restating — §3 |
| **FUN-003** | ✅ built · ✅ **driven, every criterion of its own passes**. Found F17 |
| **FUN-007** | ✅ §1 built and **driven closed** · 🔴 §2 not built · 🔴 **F31 filed** — §3 |
| **FUN-004, 005, 006, 008, 009** | 📋 open |

Commit `1c77b8c7` carries all three drive records, in the task files under *"The drive, as run"*.

**Gates, measured on the merged tree before the drives:**

```
test:ci     Jasmine: 2692 specs, 6 failures    seed 64762 — all six the baseline NAMES
```

⚠️ The **+20** over the morning's 2672 is a **concurrent session's uncommitted `port-values.spec.ts`**,
whose barrel edit is live in the shared checkout. That run graded their work too. Do not read 2692 as
this phase's number.

🔴 **`test:main` and the `noodl-mcp` suite are still unrun on this tree**, and a large amount of
phase-59 work has landed since (HEAD is now a phase-59 merge, `f32a9cd4`). **Re-run `test:ci` before
believing any of the numbers above** — they predate every phase-59 commit.

---

## 3. The two defects the drives found, beyond F17

**F31 — a warning can strand and never clear.** Setting `scriptInputs`, `scriptOutputs` and
`functionScript` in one rapid batch left a node carrying *"…"Output_1" stayed empty…"* while
`scriptOutputs` was `[]` and the script was `Noodl.Variables.hits = 1;`. **Still there minutes
later**, in `WarningsModel` — not a rendering lag.

⚠️ **Be skeptical of my mechanism, not the observation.** It did **not** reproduce on a second node
given the identical batch, and every individual transition clears correctly. I called it a race
between the clear and a re-run scheduled against the previous script. **That is inference.** The
observation is solid; the cause is not. Reproduce before fixing. It belongs to **§2's lane**, which
already owns clearing.

**FUN-002's byte-identical criterion cannot be measured as written.** Opening a project rewrites
every component on disk, so *"the project file is byte-identical after open-and-close"* is false for
every project and has nothing to do with the seed. The file now carries the restatement:

1. open once, let the editor normalise — **that** is the baseline;
2. close, open again, close;
3. the two normalised states must match, **and** the Function node's `functionScript` must still be
   absent.

Clause 3 is the whole point and is **undriven** — it needs a project switch, which needs a restart.
The same gate *was* exercised from the other side: **paste does not re-seed an emptied node.**

---

## 4. What to do, in order

1. **`test:ci` on the current tree.** Four phase-61 merges plus a whole phase-59 landed since the last
   green run. `dev:stop -- --list` first; only the `Jasmine:` line counts; compare **names**, not the
   count.
2. **FUN-009 first, not FUN-004.** It was the smallest task in the phase and is now the one holding up
   the flagship. It has to decide the discriminator, and it is the task that understands the inverse
   rule well enough to write the sentence that goes with it.
3. **FUN-004 + FUN-008 in one lane**, after 009. §2's premise correction is already folded into
   FUN-004's acceptance — **two rows, driven separately, fresh project each** (implicit globals are
   shared between Function nodes, so the first bare `Output_1` disarms the `ReferenceError`
   project-wide). Start with **FUN-007 §2's gutter rendering**: same file, same knowledge, small first
   commit, and it unblocks FUN-007 drive steps 8 and 9.
4. **FUN-005 §1/§2** in a second lane. 🔴 **Adopt the sibling's `usePortValues.ts`, do not rebuild
   it** — it is FUN-005 §3's subject and it is still sitting uncommitted in the checkout. §3 is where
   the cost is; do not start it in the same lane.
5. **FUN-006** last of the editor work.

---

## 5. Decisions and debts

1. 🔴 **FUN-001 §2 is still unsigned.** `Inputs.`/`Outputs.` is the notation; `Noodl.Inputs` is
   supported forever and never written. Taken on the spec's own recommendation, asserted in a test, so
   reversing it is one module and one test file. **Ask Richard.**
2. 🔴 **FUN-007 §2 is not built.** The mapped `line`, `column` and `hint` are on the warning payload
   and the raised error's `detail`; nothing renders them. Drive steps 8 and 9 are blocked on it.
3. ⚠️ **FUN-003 F16 stands.** `ExpressionEditorModal`, `GeneratedCodeModal` and `AiChat` never write
   the open-node slot, and are correct only because nothing can be open when they mount. Nothing
   asserts that. **Gate every consumer on `validationType`, never on `openNode` being present** — and
   note F17 means that gate needs fixing first.
4. ⚠️ **`SEED_FUNCTION_BODY` differs from FUN-002's specced string on purpose.** Its comment writes
   bare `Value`/`Result`, never `Inputs.Value`, because **comments are mined into ports**. Do not
   "restore" the spec.
5. **The concurrent session is active in this checkout.** It committed a phase-59 merge this
   afternoon. Its PortsTab work is still uncommitted. Leave it alone, never `git stash`, never
   `git add -A`, and pathspec-scope both `git add` **and** `git commit`.

---

## 6. Mechanics worth not rediscovering

- **Reading the FUN-003 registry live.** The webpack chunk registry returns the **cached** module, not
  a second instance:
  ```js
  window.webpackChunknoodl_editor.push([['probe'], {probe:(m,e,req)=>{window.__req=req;}}, r=>r('probe')]);
  window.__req('../noodl-core-ui/src/components/code-editor/authoringContext.ts').getCodeAuthoringContext()
  ```
  🔴 Never `req()` `projectmodel.ts` this way — it re-evaluates and drops the editor to the launcher.
- **`ed.createNewNode` returns `void`** and leaves `ed.highlighted` set, so consecutive creations get
  **parented under the previous selection**. Three of mine became children of a `Router`, rendered
  nothing, and looked exactly like a product bug. **Set `ed.highlighted = null` between creations**,
  and read nodes back off `ed.model.roots`. Node *views* are `ed.roots`, not `ed.nodes`.
- **Mined ports are not synchronous.** In the same tick as `createNewNode` a seeded node has **no**
  `in-`/`out-` ports; they arrive after a sub-second round-trip. Not a defect, but a spec asserting it
  in the creating tick will fail.
- **`cdp.js` has no key dispatch.** ⌘Z needed a small `Input.dispatchKeyEvent` script. The keystroke
  does reach the renderer, and undo *does* fire — but the undo queue holds `create` and
  `seed function` as **separate entries**, and opening/closing a popout pushes `edit parameter`
  entries on top. Test "one ⌘Z" with nothing in between, and read `UndoQueue.instance.queue` before
  concluding anything.
- **The editor's preview cannot render a project outside the normal projects location** — it 404s on
  `index.json`. Use `node scripts/devtools/measure-from-disk.js <dir> --screenshot full --out <prefix>`
  and read the PNG. That is how "passes a value through when run" was proved, independent of the
  editor.
- ⚠️ **`cdp click` on a class selector hits the first match.** Mine opened a GitHub device-login page.
  **Tag the element with a unique `id` in an `eval` first**, every time.
- Registering a scratch project with the launcher and restarting works
  ([[open-a-copy-of-a-real-project-in-the-editor]]) — **back the store up and restore it afterwards**.
