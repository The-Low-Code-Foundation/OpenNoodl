# Phase 61 — next session

**Written 2026-08-12**, at the end of the first build session on this phase.

**4 of 9 built and merged. Zero of them have been seen to work in a running editor.** That sentence
is the whole point of this file: the code is in, the gates are green, and every acceptance criterion
that ends at *a working node* is still open.

---

## 1. What is in `cline-dev`

| Task | Commit | State |
|---|---|---|
| **FUN-001** — one notation, written down once | `f03eaece` + `8578534e` | ✅ built. §2 taken on the recommendation, **not signed by Richard** |
| **FUN-002** — never a blank page | `b3837c9d` | ✅ built. ⏳ never created in a running editor |
| **FUN-003** — the declared ports reach the editor | `5e95c8e1`, merged `70f8110e` | ✅ built, ships dark. ⏳ the A→close→B drive is unmeasured |
| **FUN-007** — the loop closes after the run | `1a20cff4`, merged `5d71f775` | ✅ §1/§3 built. 🔴 **§2's gutter rendering is NOT done** |
| Premise correction + worktree fix | `ccc2e74d` | ✅ |
| Phase status | `b150e787` | ✅ |

**Open: FUN-004, FUN-005, FUN-006, FUN-008, FUN-009.**

### Gates, measured on the merged tree this session

```
noodl-core-ui        npx jest      17 suites / 222 specs        PASS
noodl-runtime        npx jest      128 of 129 suites, 2349      PASS  (1 skipped)
noodl-editor         tests-unit/fun-002                7/7      PASS
                     npm run typecheck:editor      0 errors
```

🔴 **`test:ci` has NOT been run on this tree, and neither has `test:main` or the `noodl-mcp` suite.**
Four merges landed without it. That is the first thing to do when the checkout is quiet — `npm run
dev:stop -- --list` first, and remember the baseline is **6 failures at 2670 specs**, that 12 is
reachable by a real regression, and that only the `Jasmine:` line counts.

---

## 2. 🔴 The premise correction — do not re-litigate it as an oversight

The README now carries **premise correction 3**, and it moves the diagnosis the phase was built on.
It was measured twice: once by the FUN-007 lane, once independently in the primary checkout by
compiling the body the runtime compiles.

```
var Output_1 = Input_1;      → ReferenceError: Input_1 is not defined
Output_1 = Inputs.Input_1;   → runs clean, writes nothing, Success fires
```

**The observed code has always thrown.** Reading an undeclared identifier is a `ReferenceError` in
sloppy mode as well as strict, and the runtime injects only `Inputs`, `Outputs`, `Noodl` and
`Component` — never the port names. The user was warned **twice**: by a linter that did not know
`Input_1` was a port, and by a runtime failure delivered to `Error` and `Failure` ports that nothing
on the canvas draws attention to.

The silent case is the *next* thing they type. Every task still stands; only the sentence *"a
function that ran fine"* dies.

⚠️ **This changes FUN-004's acceptance**, which promises the observed bug verbatim. It is **two rows,
not one**, and they must be driven separately. **Use a fresh project**: implicit globals are shared
between Function nodes, so the first node to write a bare `Output_1` permanently disarms the
`ReferenceError` for every node after it — the second run of the same test lies.

**Fold this into FUN-004's file before a lane is pointed at it.** It was not done this session.

---

## 3. The traps this phase measured — every one of them is silent

All against the real `parseAndAddPortsFromScript`, 2026-08-12. Memory:
[[function-node-ports-are-mined-from-comments-too]].

| | |
|---|---|
| **Comments are mined** | The parser's comment-stripping line is commented out. FUN-002's *specced* seed body mints **four** ports because its comment spells `Inputs.Name` and `Outputs.Name`. Never write teaching copy containing a prefix followed by a name |
| **`Outputs.Done_1()` is a VALUE port** | The signal-by-dot pattern excludes `_`. `Outputs["Done_1"]()` types it correctly. `writeExpression` handles it; a hand-rolled `` `Outputs.${name}()` `` reintroduces it |
| **Two bracket reads on one line** | Greedy `(.*)` — `Inputs["My Value"] + Inputs["Other"]` mines one port named `My Value"] + Inputs["Other`. **A hard constraint on FUN-005's insert-at-cursor rail** |
| **Never blanket-strip `in-`/`out-`** | The prefix goes on when the port list is *assembled*; a proplist row's `label` is already the display name, and `Javascript2` applies no prefix at all. FUN-001 §1 and FUN-003 §3 both said to strip once — both were wrong, and the builders were corrected |
| **A `"` in a display name** | No expressible form at all. `canExpressPort()` says so; the honest answer is to rename the port |

**All notation copy lives in `packages/noodl-core-ui/src/components/code-editor/utils/notation.ts`**
and is exported from the `code-editor` barrel. Import it. A second copy of any of these strings is
the failure FUN-001 exists to prevent.

---

## 4. What to do first — the drives, not more building

Four tasks are built on evidence nobody has seen behave. Both lanes left step-by-step recipes:

- **FUN-003** — *"Open node A, close, open node B; B's editor never sees A's ports."* Recipe in the
  task file. **Assert the port types, not just the names** — a default leaking over a chosen type is
  the silent half. The close-clears step is the assertion that matters.
- **FUN-007** — recipe under *"The drive that closes the acceptance"*. Nine steps, and step 8 needs
  a **fresh project** for the reason in §2.
- **FUN-002** — not written as a recipe because it is three actions: drop a Function node, see three
  lines and two ports; wire it and run it; ⌘Z once and the body goes and stays gone. Then the one
  most likely to be skipped and worst to get wrong: **open an existing project containing a Function
  node with an empty script, close it, and diff the project file. It must be byte-identical.**

⚠️ Live verification belongs to the **primary checkout** — `lerna exec` resolves to primary even when
launched from a worktree, so a drive from a lane grades the wrong code.

---

## 5. The other session

**A second session was live in this checkout this morning** — commits to `cline-dev` at 08:59, files
written at 09:01, quiet since. Its uncommitted work is still in the tree:

```
M  .../propertyeditor/components/PortsTab/PortsTab.tsx, .module.scss
M  .../utils/provenance/TraceSession.ts
M  packages/noodl-editor/tests/nodegraph/index.ts        ← the spec barrel, shared
?? .../PortsTab/portValues.ts, usePortValues.ts
?? packages/noodl-editor/tests/nodegraph/port-values.spec.ts
```

**Check whether it is still live — do not inherit this paragraph.** Long-idle is not abandoned;
leave the files alone either way, never `git stash`, never `git add -A`, and pathspec-scope both
`git add` **and** `git commit`.

🔴 **It matters for FUN-005.** `usePortValues.ts` is live port values in the property panel — that is
FUN-005 §3's subject. **Adopt it; do not rebuild it.** Adopt > build has now been the right call
three times in two phases.

---

## 6. Decisions and debts

1. 🔴 **FUN-001 §2 is unsigned.** Taken on the spec's own recommendation: `Inputs.`/`Outputs.` is the
   notation, `Noodl.Inputs` is supported forever and never written. It is asserted in a test, so
   reversing it is one module and one test file. **Ask Richard.**
2. 🔴 **FUN-007 §2 is not built.** The mapped `line`, `column` and `hint` are on the warning payload
   and on the raised error's `detail`; nothing renders them. It needs `CodeEditorType.ts`, which was
   another lane's territory. **This is the natural first half of FUN-004's lane** — same file, same
   knowledge.
3. ⚠️ **FUN-003 F16.** `ExpressionEditorModal`, `GeneratedCodeModal` and `AiChat` never write the
   open-node slot. They are correct only because nothing can be open when they mount, and nothing
   asserts that. **Every consumer must gate on `validationType`, never on `openNode` being present.**
4. ⚠️ **`SEED_FUNCTION_BODY` differs from FUN-002's specced string on purpose.** The task file
   carries a red block saying so. Do not "restore" the spec.
5. **Two lane worktrees are still on disk** — `../OpenNoodl-worktrees/fun-003-lane` and
   `fun-007-lane`. Merged; remove them and keep the branches.

---

## 7. Suggested order

1. **`test:ci` on the merged tree**, once the checkout is quiet. Four merges are ungated.
2. **The three drives** in §4. They can all be done in one editor session; re-open the project
   defensively at the top of each, because a sibling commit full-reloads the renderer.
3. **FUN-004 + FUN-008 in one lane**, after §2's correction is folded into FUN-004's file. Start with
   FUN-007 §2's gutter rendering — same file, and it makes the lane's first commit a small one.
4. **FUN-005 §1/§2** in a second lane, adopting the sibling's port-values hook. §3 is where the cost
   is; do not start it in the same lane.
5. **FUN-006** last of the editor work — it wants 003 and 004 in place so it can narrate rather than
   become the whole help system.
6. **FUN-009** whenever the Expression copy is written, ideally with phase 59's LGC-001.

**Use `scripts/devtools/make-worktree.sh`** — never the harness's `isolation: "worktree"`. It now
links `noodl-runtime/dist-types`, without which five runtime suites silently fail to run and the
total drops 2349 → 2303 with zero failures. Verify a lane's suite **total** against primary's before
believing its board.
