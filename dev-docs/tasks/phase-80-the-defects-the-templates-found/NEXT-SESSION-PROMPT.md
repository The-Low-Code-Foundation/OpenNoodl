# Phase 80 — next session

## The board, re-derived from TASKS.md this session

**37 rows. 33 ✅ · DEF-007 🟡 partial · 3 open — DEF-033 (P18's), DEF-036, DEF-037 (new, s35's).**

🔴 **Do not derive the board with `grep -av '✅'`.** The handoff has used that command for several
sessions and it is now wrong: a row whose *prose* contains a ✅ is filtered out even when its
status column says `⬜ open`. DEF-037 vanished from its own board the moment it was written.
✅ **Read the status COLUMN:**

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

s35 closed **DEF-034's AC5**, drove **DEF-031**, half-drove **DEF-029**, and registered **DEF-037**.
Commit `29a00c27`. **No source changed — no gate was run and none is claimed.**

---

## 🧭 IN FRONT OF RICHARD — still DEF-036, unchanged and unanswered

**Should a wire be allowed to declare a column on the *accounts* table, the way it already can on
an app table?** P77's SBR-008 accepted that cost for app tables (`recordWiredFieldPorts`: a
mistyped `prop-titel` writes a `titel` column instead of warning). DEF-036 asks for the same net on
`_User`. The alternative — what ships today — is a sign-up form that silently stops writing its
custom fields whenever the schema is cold. **271 wires across 21 of 118 corpus projects.**

s35 did not touch this. It remains a decision, not a fix to be guessed at.

---

## What s35 did

### 1. ✅ DEF-034 AC5 — closed, with a control that actually varied the thing

A copy of `LearnBook` in a real `dev:debug` editor; real
`exportToJSON(project, {useBundles:false})`. **`Pretty button` exported 19 of 19 wires including
`vertical gap -> rowGap`.**

🔴 **Presence in the artefact is not proof the fix acted** — it is equally consistent with "the
wire was never gated in this build". So both code paths ran over the same connections in the same
loaded editor: `getConnectionHealth(ref, {levels:['error']})` (ships today) vs
`getConnectionHealth(ref)` (exactly what shipped before DEF-034).

| | connections |
| --- | ---: |
| in the model | 2,719 |
| kept by **fixed** | **2,587** |
| kept by **pre-fix** | 2,577 |
| **saved by the fix** | **10**, in 9 components |
| dropped by **both** | **132** |

**Every saved wire is `level:'warning'`** (`con-target-port-gated` 5, `con-type-unconverted` 5 —
both keys the row named). **Every dropped wire is `level:'error'`** (`con-no-source-port` 101,
`con-no-target-port` 31), so **AC2 holds live**. ✅ **Two instruments, one number**: the export
reported 2,587 and an independent health loop counted 2,587. ✅ **AC3 seen on canvas** — the
`Vertical Gap` wire is still drawn dashed while the export keeps it.

Full readings: DEF-034 §6.

### 2. ✅ DEF-031 driven — and it produced DEF-037

On a genuine render the label goes **42px / 2 lines → 21px / 1 line**, computed
`ellipsis` + `nowrap` + `hidden`, **`scrollWidth` 1419 vs `clientWidth` 893**. The wrap arm's
computed `text-overflow` is `clip`, so **`wrap` never reaches the DOM** — AC3 in a browser.

### 3. 🔴 DEF-037 — the new row, and the reasoning that nearly went wrong

Setting **Text Overflow → Ellipsis** in a **running preview** put `text-overflow: ellipsis` on the
element and **left `white-space: pre-wrap`** — the label kept wrapping. That is character-for-character
the "property arrives and does nothing" shape DEF-031 §2 says the fix prevents.

⚠️ **It read as "the fix does not work."** It is not. `Text.tsx` cannot emit `ellipsis` beside
`pre-wrap` — the wrapping arm *deletes* `style.textOverflow`. **The impossibility of the
combination is what said the value had been patched on by a path that never ran the render.**

✅ **The control that named it**: `wordBreak`, the pre-existing sibling `inputCss` port on the same
node, set the same way in the same session, **applied live and immediately.** So it is not "style
ports don't update live" — it is **derivation**. `textOverflow` is the first `Text` style port
whose effect needs siblings (`white-space`, `overflow`, `overflow-wrap`) that only the render
computes. Inert in **both** directions until reload.

---

## The work, in the order it should be done

### 1. Four rows are built and undriven — still the phase's largest debt

DEF-034 and DEF-031 are off this list. What remains:

- **DEF-029** — 🔴 **the half that matters is owed**: no file has been dragged onto a running
  preview. Its ten ports **are** live in the editor's node library (s35 read them). ⚠️ Needs CDP
  `Input.dispatchDragEvent` with a real `DataTransfer`; **`scripts/devtools/cdp.js` does not expose
  it**, and a synthetic DOM event bypasses the `preventDefault`-on-`dragover` behaviour the row is
  about. Adding that subcommand is the actual first job here. ⚠️ Ports fold into **Advanced CSS**.
- **DEF-028** — its own AC5, the two-takes-differ measurement. s34 narrowed it, did not close it.
- **DEF-031's panel half** — the rendered `Text Overflow` row has still not been read out of the
  property panel. ⚠️ **The graph is a single `<canvas>`**, so opening the panel needs a
  canvas-coordinate click; there is no DOM node to click and no `NodeGraphEditor.instance`.
- **DEF-005's `Roles` output**, **DEF-009's default**, **DEF-025's editor half** — all undriven.

### 2. DEF-037 — small, but sweep before fixing

AC4 is the one that matters: **the population is one port and unswept.** Whether any other
`inputCss` port on any node derives a sibling in render has not been measured. Do that first —
this row's own lesson is that a population named from an example is wrong three times out of three
on this board.

### 3. DEF-033 — do NOT take it without checking P18

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. **Registered by P18** at
`6f91ae2a`; its own text says the fix is a **decision**. 🔴 Check `phase-18-code-export-v2/` files
and mtimes first — a peer may be doing your exact task.

### 4. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6 measured.
**Measure one fully before starting the next.** ⚠️ **Next free id is `DEF-038`.**

---

## What DEF-007 still owes (unchanged from s34)

- ⚠️ **AC2 and AC4 are open.** AC2 needs a template published before it can be driven. AC4 is §6's
  table, which exists — someone should decide whether that discharges it.
- 🔴 **The pin is on the site-builder generator ONLY.** `tpl001Template.ts` is unmeasured and
  writes a **v2 directory**, so its graph needs assembling into legacy shape first. **Measure
  whether TPL-001 disagrees at all before porting anything.**
- 🔴 **§3.3's replacement is undecided** — refuse a missing home at publish, or resolve-and-warn at
  install. **6 of 97** projects carry no home. 🧭 A decision.

## Owed elsewhere

- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — the six `/Pages/ThemeEditor` rows** DEF-007 §3.2 armed. A `[runtime/cyclic-loop]`
  there is **D33 surfacing, not a regression**.

---

## Gates

🔴 **None were run, and none is claimed.** This session changed **no source** — the only writes
were to a disposable **copy** of `LearnBook` in the scratchpad. Floors carried forward from s33,
unverified at this HEAD: `test:ci` **4** (all AIX-006, by name), 2916 specs; `test:main` **5
pre-existing failures** (`sb-007`, `sb-018`, `aib-007`) that are **somebody's open work — do not
read them as this phase's floor and do not "fix" them**.

---

## The drive harness, which now works and is worth reusing

- **The webpack seam**: `window.webpackChunknoodl_editor.push([['<UNIQUE-ID>'],{},r=>window.__req=r])`
  then `__req.c['./src/editor/src/…'].exports`. ⚠️ **A reused chunk id returns `undefined`**, which
  looks exactly like the seam being unavailable. ⚠️ **The seam is lost on a launcher→editor
  navigation** — re-push with a new id.
- **Opening a project**: `LocalProjectsModel.instance.openProjectFromFolder(dir)` loads the model
  but **does not navigate** — `ProjectModel.instance` stays null. It *does* add the project to
  recents, so the real door is then a `cdp click` on its launcher card (stamp
  `[class*=LauncherProjectCard-module__Card]`, excluding `Ghost`).
- **Which build is under the drive**: read the function itself in the renderer
  (`exportComponent.toString()`), never the source file.
- **Two targets**: `--target=viewer` is the embedded preview webview. 🔴 **`cdp reload
  --target=viewer` destroyed the preview and dropped the editor back to the launcher** — reopen the
  project instead; parameters persist to `project.json`, so a reopen gives a genuine fresh render.

## Traps carried

- 🔴 **`grep -av '✅'` no longer derives this board.** Read the status column. (See top.)
- 🔴 **An impossible DOM/state combination is a signal about the PATH, not about the fix.** Reading
  it as "the fix is broken" would have reopened a correct row and hidden a real one.
- 🔴 **A control from the same family separates "this one" from "all of them."** Without `wordBreak`
  applying live, DEF-037 would have been filed as a platform-wide defect it is not.
- 🔴 **Presence is not proof.** A wire in an artefact is consistent with the fix working *and* with
  the defect never being present. Run both code paths over the same data in the same session.
- 🔴 **The default `exportToJSON` bundles lazily** — 4 components / 57 connections, and the fixture
  is not in it. `{useBundles:false}` is the whole-project arm.
- ⚠️ **Appending to a TASKS.md row puts text OUTSIDE the last cell.** Split on `|` and write into
  the description column, then check the column count is unchanged.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage tracked
  files — a sibling's commit sweeps them.
