# Phase 69 — next session

**Written 2026-08-16, session 11.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **CN-006 is closed on both halves and
now driven — §Owed is discharged.** The queue is empty and **CN-007 is next**, but read §2 before
picking it up: the drive produced two product defects that belong to nobody yet.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-005** | ✅ | — | Closed in sessions 4–8 |
| **CN-006** | ✅ both halves | ✅ **s11** | AC3 ✅, AC1 ⚠️ half, staleness twin 🔴 **real** — §1 |
| CN-006b … CN-017 | 📋 | — | **CN-007 is next.** §2's F1 is the thing CN-006b is built on |

s11 **wrote no product code**. It launched an editor, measured the four things s10 could not, and
found two defects outside this task's code.

---

## 1. What the drive settled

Full record, with the observations written **before** the launch:
[notes/cn-006-drive-observations.md](notes/cn-006-drive-observations.md).

✅ **AC3 closes.** A `StatTile` with no parameters set: `paddingLeft` **16px**, background
**rgb(255,255,255)**, radius **8px**, border **1px**, label **14px**, value **24px**. **`)px` occurs
0 times** in the viewer document and in 95,977 chars of CSS. The discriminator was run —
`--space-4` resolves on `:root`, so "tokens never delivered" is excluded, and the `)px` bug would
have read `0px`. **s10's guards hold in a browser.**

🔴 **The `ProjectModel.modules` staleness twin was REAL.** `createNodeKit()` called directly over CDP
(bypassing `KitsSection`) left the kit on disk and **absent from the model**; `readModules()` brought
it in. s10's call is load-bearing, not belt-and-braces.

✅ **`CodeFileDocument` mounts and renders** — identity `noodl_modules/drive-kit/index.js`, real bytes
in the buffer, checked on lines only that file has.

⚠️ **AC1 is half met.** Placeable ✅. *"Under its kit's name"* ❌ — see F1.

---

## 2. 🔴 Two defects the drive found, both outside CN-006, both wanting task numbers

### F1 — every kit collapses into one unnamed picker group

The picker files all kit nodes under **"External libraries"** in a subcategory named `''`. Two kits
each shipping a `Stat Tile` showed **two identical cards** — same name, same category, same `title`
tooltip — separable only by a `data-test` attribute.

✅ **One hard-coded line**, `packages/noodl-runtime/src/nodelibraryexport.ts:917-932`: the loop reads
`nodeMetadata.module` to decide a node *is* a module node, then emits `{ name: '', items }` and
throws the name away. `utils/createnodeindex.ts:115-131` renders it faithfully, as nothing.

⚠️ **Not CN-006's code** — the scaffold sets `module` correctly, which is why `NodeLibrary`'s type
record knows `module: 'drive-kit'` while the picker does not. 🔴 **This is the provenance CN-006b is
built on**, so it is worth doing before that task rather than inside it.

### F2 — the file editor shows a Function-node port hint

`CodeFileDocument` reuses `JavaScriptEditor` and inherits FUN-006's port bar, so a kit's `index.js`
renders *"This node has no ports yet. Type Inputs. — the name you use becomes an input port."*
(`JavaScriptEditor.tsx:316`, from `getCodeAuthoringContext().openNode` — ambient state unrelated to
the open file). The header also labels the file `SCRIPT`. **Not cosmetic**: it tells a new kit author
to use a mechanism that does not exist in the file this phase just sent them to.

---

## 3. ⚠️ One thing observed and deliberately NOT claimed

The kit reached the picker **without anyone clicking "reload the preview"**, which would make
`KitsSection`'s instruction unnecessary. **This is not reported as a finding.** Peers were editing
the tree and the log shows `_src_frames_viewer-frame_index.*.hot-update.json` — **HMR was reloading
the viewer frame for reasons unrelated to the drive**, and a reload I did not cause is
indistinguishable from a product that reloads itself. **Wants a re-run on an undisturbed tree**:
scaffold, then poll the viewer's `script[src]` list without touching anything.

---

## 4. 🔴 The cross-package golden: now PROVEN real, and still not mine

s10 left `projectmodules — injectIntoHtml snapshot … byte-identical HTML to the committed golden`
failing and attributed it to CN-003. Three sessions then repeated a second-hand story that it was
**test:ci contamination that would not reproduce on committed code**. **That story is false**, and it
was checked rather than relayed:

- reproduced in **plain Node**, no editor, no suite, every input at committed state
  (`git diff HEAD` empty for the injector, the golden and `projectmodules.ts`);
- generated output **26 lines**, committed golden **24** — one extra
  `<script>window.__noodl_module_name = "code-a";</script>` per prefix block;
- `git log -S "__noodl_module_name" -- packages/nodegx-module-inject` → **exactly one commit,
  `f7da52d1`** ("fix(cn-003): a kit can say its own name"), and it **is an ancestor of HEAD**;
- `f7da52d1` updated **that package's own tests** and **not** the editor's golden; the golden's last
  commit is `19ecdff7` (LIB-003).

**So `test:ci` should read 2843 / 7, and the seventh predates `9e76bae4`.** One-line fix, owned by
CN-003. ⚠️ **"Clean in the working tree" does not settle this** — it only excludes uncommitted edits.
It is an absence check on the wrong population; running it on committed code is what answers it.

✅ **And a second session found a natural experiment that nobody planned** — existing runs, taken
hours apart for unrelated reasons, bisect it on their own:

| when | what |
|---|---|
| 16:01 | run **2843 / 6** — 38 min *before* `f7da52d1` |
| 16:39 | **`f7da52d1` lands** |
| 20:37 | run **2843 / 7**, + the projectmodules golden |
| 20:43 | `9e76bae4` lands — **6 min after the failing run, so it cannot be the cause** |

The failure appears exactly across `f7da52d1` and nowhere else, and `9e76bae4` is ruled out on
timing alone. ⚠️ Worth keeping because CN-006's work was what got blamed, second-hand, three times.

---

## 5. Owed by Richard

Unchanged from s7–s10, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
3. **Should `project`'s `find_tools` purpose line name kits?** It costs resident tokens out of the
   same 57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, all wanting task numbers: 🔴 **F1 and F2 above** · 🔴 `render-from-disk.js`
answers `/` and `/index.html` and 404s everything else, including the start page's own `urlPath` ·
🔴 the `@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` is dead at both ends
(sends `cmd:'refresh'`, runtime emits `'reload'`, nothing listens) — which is *why* `KitsSection` has
to tell the author to reload, and §3 is unresolved partly because of it.

---

## 6. Checkout conditions

**19 peer sessions live** (≈40 MCP servers, ~2 per session — all with live parents, no orphans).

- ✅ **An editor WAS launched.** Announced to all 19 before launching and to all 19 (list re-taken)
  after `dev:stop`. 25 processes stopped, nothing left, 9222 free — verified independently by three
  peers.
- ⚠️ **Scope the teardown claim:** MCP servers were live across the sweep and none died, which
  exercises the MCP half of the shield. It says **nothing** about the suite half — no suite was
  running, and "the guard works" and "the guard was deleted" read identically then.
- 🔴 **A peer's edit to `esLintDiagnostics.ts` forced a full HMR reload mid-drive**, dropping the
  editor to the Launcher and wiping every injected CDP handle. Budget for it; do not assume a drive
  holds for its whole length.
- ✅ **No suite was run this session.** `9204` took the window immediately after the teardown.
- ✅ Fixture `cn006-drive` deleted, both its entries filtered out of NodeGX's
  `recently_opened_project.json` (2 → 0), source `cn001-kit-drive` verified untouched.
- ✅ **`git commit -F <file> -- <pathspecs>`, always. Never `git add -A`, never `git stash`.**
- Whoever you tell you are starting, tell you have stopped.
