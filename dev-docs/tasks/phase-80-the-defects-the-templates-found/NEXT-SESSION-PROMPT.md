# Phase 80 — next session

## The board, re-derived from TASKS.md this session

**37 rows. 33 ✅ · DEF-007 🟡 partial · 3 open — DEF-033 (P18's), DEF-036, DEF-037.**

🔴 **The phase is closer to done than previous handoffs implied** — see §1 below: three of the
four rows carried as "built and undriven" are in fact **closed**. What is genuinely left is
**two decisions for Richard, one buildable row (DEF-037), DEF-033 (check P18 first), and two
small drives that share a single blocker.**

🔴 **Do not derive the board with `grep -av '✅'`** — a row whose *prose* contains a ✅ is filtered
out even when its status column says open. ✅ **Read the status COLUMN:**

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

s36 drove **DEF-029**'s remaining half and closed **DEF-037 AC4**. Commit `048505d4`.
**No product source changed — no gate was run and none is claimed.**

---

## 🧭 ✅ **ALL FOUR DECISIONS RULED 2026-08-31 — read
[RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) FIRST. None are built.**

| row | ruling |
| --- | --- |
| **DEF-036** | ❌ **Option B — a wire must NOT declare a column on the accounts table.** Overruled on product shape, not cost. **New scope instead**: an "Add a field" button on the data node; an explicit *no backend attached / not running* warning; and a wire to a deleted field that **stays on canvas, dotted, and errors**. 🔴 Do not re-open by re-arguing the 271 wires |
| **DEF-007** | ✅ **Refuse at publish.** 🆕 **Plus a new item**: scream when someone tries to **delete** a home page |
| **DEF-033** | ✅ **Show the truth** — panel shows `-1`, behaviour unchanged. 🔴 **P18 builds it** |
| **DEF-037** | ❌ **Option B — derive it.** *"The preview is supposed to be a true, live, auto updating view of what's in the node canvas at all times."* 🔴 **AC3 now contradicts the ruling — rewrite it** |

🔴 **Two of the four went AGAINST the recommendation** (DEF-036 and DEF-037), both on principle
rather than on cost. The rulings file records *why*, and the why is what stops the next session
re-arguing them.

🧭 **Still genuinely open and unanswered: DEF-007 AC4** — see the work list below.

---

## What s36 did

### 1. ✅ DEF-029 — a file was actually dropped on a running preview

`scripts/devtools/cdp.js` gained **`dropfile`**, the subcommand the row said was missing:

```
cdp dropfile "<selector|x,y>" <file>[,...] [--probe=<expr>] [--leave-to=<sel|x,y>] [--no-drop]
```

🔴 **`drag` could never have done this.** A mouse drag is an in-page HTML5 drag begun by a
mousedown on a `draggable` element. A file drag has **no mousedown in the page at all** and arrives
with `dataTransfer.files` already populated by the browser process. `--probe` exists because
drag-over state cannot be read by a second command — it evaluates *between* the `dragOver` and the
`drop`, on the same connection.

| run | zone | file | hover | File Name | Type | Size | Dropped | Rejected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accepted | png | `drop-me.png` | **true** | `drop-me.png` | `image/png` | **78** | **true** | false |
| rejected | png | `reject-me.pdf` | — | *unchanged* | *unchanged* | *unchanged* | false | **true** |
| **control** | **off** | `drop-me.png` | **false** | *unchanged* | *unchanged* | *unchanged* | — | — |

**78 is the file's real byte count on disk** — Chromium opened it. Full readings: DEF-029 §7.

### 2. ✅ DEF-037 AC4 — the sweep, and it moved the row's own mechanism

🔴 **The mechanism is not "the live-preview path".** It is `react-component-node.ts` `setStyle()`,
generated for **every** `inputCss` port, which force-updates React only for a hard-coded allowlist
and **skips that allowlist entirely when a `styleTag` is set**. So a **wire** driving such a port
hits this in a **deployed app** too — §4's "editor feedback-loop, not correctness" needs correcting.

✅ **The fix already ships.** Six ports carry `onChange(){ this.forceUpdate(); }` for exactly this
reason. **Three more are unfixed**, the sharpest being that **Checkbox's `Width`/`Height` are
declared identically to Radio Button's — and only Radio Button carries the `onChange`.**

---

## The work, in the order it should be done

### 1. Built-and-undriven — 🔴 **the inherited list was THREE-FIFTHS WRONG; re-derived s36**

The handoff has carried "**4 BUILT+UNDRIVEN**" for several sessions. Checked against the row files:

| claimed owed | actually |
| --- | --- |
| DEF-028's AC5 | 🔴 **there is no AC5.** AC1–AC4 all ✅; §6 was discharged by registering DEF-034 + DEF-035, **both now closed**. Row owes nothing |
| DEF-009's default | 🔴 **closed.** AC4 *was* the default question — **Richard ruled it 2026-08-30 and it was built the same day** (§6) |
| DEF-025's editor half | 🔴 **closed.** Door half s17, default-flip half s25, both doors built. Status cell is a bare `✅` |
| DEF-005's `Roles` output | ✅ **genuinely owed** — undriven in a real editor (file line 158) |
| DEF-031's panel half | ✅ **genuinely owed** — *"That half of the AC is still owed"* (file line 136) |

🔴 **Relayed conclusions decayed here for at least three sessions, and s36 relayed them once more
before checking.** Re-derive an owed-list from the ROW FILES, never from the previous handoff.

**So the real undriven debt is two items, and they share one blocker:**

- **DEF-031's panel half** and **DEF-029's panel half** — both need the property panel read out of
  the DOM. ⚠️ **The graph is a single `<canvas>`**, so opening the panel needs a canvas-coordinate
  click; there is no DOM node to click and no `NodeGraphEditor.instance`. **Solve it once and both
  close.** (DEF-029's question: is the `File Drop` group folded into **Advanced CSS**? s35 read the
  node library, a peer reported the fold; neither is the panel.)
- **DEF-005's `Roles` output** — undriven in a real editor.

### 2. DEF-037 — the sweep is done, so this is now buildable

Three new instances named in §7.3 with file:line. ⚠️ **They are read from source, not driven** —
drive one before fixing four. Radio Button's `width`/`height` are the known-firing control.

### 3. DEF-033 — do NOT take it without checking P18

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. **Registered by P18** at
`6f91ae2a`; its own text says the fix is a **decision**. 🔴 Check `phase-18-code-export-v2/` files
and mtimes first — a peer may be doing your exact task.

### 4. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — now **seven**. §1 disproved; §6
measured. 🆕 **§7 (new): a `connections.json` with unknown field names loads silently, crashes
export with a `TypeError` naming nothing, and is written back to disk as eight empty objects.**
⚠️ §7's first measurement is the one that decides its rank: *does an unresolvable id — a real
field name pointing at a deleted node — take the same crash?* That case is reachable without
hand-editing anything. **Measure one row fully before starting the next.** ⚠️ Next free id is
`DEF-038`.

---

## What DEF-007 still owes (unchanged since s34)

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

🔴 **None were run, and none is claimed.** The only source file changed is
`scripts/devtools/cdp.js`, which is harness code — **no suite covers it** (checked), and
`node --check` passes. Everything else this session was task documents and a disposable scratch
project. Floors carried forward from s33, unverified at this HEAD: `test:ci` **4** (all AIX-006,
by name), 2916 specs; `test:main` **5 pre-existing failures** (`sb-007`, `sb-018`, `aib-007`) that
are **somebody's open work — do not read them as this phase's floor and do not "fix" them**.

---

## The drive harness — now with file drops, and one new landmine

- 🆕 **`cdp dropfile`** — see above. `--probe` reads state mid-drag; `--leave-to` walks the drag out
  of the element. ⚠️ **`--no-drop` (`dragCancel`) delivers NO `dragleave` to the page**, so hover
  state stays set. That is the *instrument*, not a defect — use `--leave-to` to test release.
- 🔴 **A hand-authored v2 `connections.json` uses `fromId`/`fromProperty`/`toId`/`toProperty`.**
  Any other names load silently and then crash the export. See unowned §7.
- 🔴 **`nodes.json` needs BOTH sides of every parent link** — `children` on the parent *and*
  `parent` on the child. Writing only `children` gave a 16-root graph that loaded without complaint.
- **The webpack seam**: `window.webpackChunknoodl_editor.push([['<UNIQUE-ID>'],{},r=>window.__req=r])`
  then `__req.c['./src/editor/src/…'].exports`. ⚠️ A reused chunk id returns `undefined`. ⚠️ **The
  seam is lost on every editor reload** — re-push with a new id.
- **Opening a project**: `LocalProjectsModel.instance.openProjectFromFolder(dir)` loads the model
  but **does not navigate**. It adds the project to recents, so the real door is then a `cdp click`
  on its launcher card (stamp `[class*=LauncherProjectCard-module__Card]`, excluding `Ghost`).
  ⚠️ The card can be **7000px down the list** — `scrollIntoView({behavior:'instant'})`, then
  re-measure in a **separate** eval before clicking.

## Traps carried

- 🔴 **`grep -av '✅'` no longer derives this board.** Read the status column.
- 🔴 **Run the control AFTER a known-firing signal, never before.** DEF-029's off-zone control reads
  as "nothing happened" — which is exactly what a broken harness reads as. Only the accepted drop
  running first made the zero mean anything.
- 🔴 **Rule out your instrument before reporting a defect.** `Is Dragging Over` stuck true after
  `dragCancel` looked like a real bug; a genuine drag-out released it correctly. The honest verdict
  is **unmeasured**, not clean and not broken.
- 🔴 **Validate an extractor against an answer you already know.** The `inputCss` port extractor
  silently dropped the first key of every object literal. It was caught only because `opacity` and
  the `textOverflow`/`wordBreak` pair were known by hand to exist and came back missing.
- 🔴 **Two sibling nodes can carry opposite rules** — Checkbox and Radio Button declare the same
  ports the same way and only one got the fix. Read the writer, not the sibling.
- ⚠️ **`cd` persists between Bash calls.** A relative `git status <pathspec>` from the wrong
  directory reports **nothing changed**, which reads exactly like a sibling having swept your work.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage tracked
  files — a sibling's commit sweeps them.
