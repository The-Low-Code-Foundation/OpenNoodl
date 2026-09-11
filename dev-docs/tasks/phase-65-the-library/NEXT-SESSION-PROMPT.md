# Next session — the shelf is published; now make the entries good

**Last session (2026-09-05, session 2) shipped.** Richard's ask was *"tackle more prefab and module
stuff, and then publish at the end, as much as we can fit into one session using sub agents"*. Eight
agents authored in parallel, the orchestrator verified serially, and **the shelf was published** —
content repo `02ad8a6`, live and confirmed by fetching the served index.

**Do not re-derive any of the rulings below.** Each cost a measured round.

---

## Board, re-derived from the files on 2026-09-05

| Gate | Command | State |
|---|---|---|
| Sources | `npm run library:check` | **72/72 clean, exit 0** (525 warnings, not gated) |
| Artefact | `library:build` + `library:verify-dist` | **exit 0**, installable-shaped |
| Icons | `npm run library:icons:check` | **72/72 have one** |
| Render | `npm run library:render` | see below — the numbers changed meaning |
| Harness | `npm run library:render:self-test` | **pass, bad floor still fails** |
| Behaviour | `npm run library:drive` | **5 drives, 0 failing checks** (was 3) |
| Origin | `npm run library:verify-origin` | **exit 0** — 42/42 prefabs, 30/30 modules |

**72 entries** — 42 prefabs + 30 modules. Published 2026-09-05: 8 new, 22 bumped.

### 🔴 STEP 0: commit before you start

Four to six peer sessions share this checkout and a sibling's `git commit -a` sweeps unstaged work.
Commit by pathspec, `git add` untracked directories first (a pathspec commit **skips untracked files
silently**). Last session found a peer editing `package.json` *during* the commit — a targeted `Edit`
merged cleanly where a wholesale write would have clobbered them.

---

## 🔴 The rule that made last session work

**Agents author. The orchestrator verifies. Rendering is SERIAL.**

Every render and drive starts its own headless Chrome; Richard has already ruled on this
(*"Stop fucking up the CPU"*). Eight authoring agents in parallel cost nothing. Give each a
**disjoint set of entry directories**, and keep for yourself: `package.json`, `library/README.md`,
both `AUDIT.md`, `dev-docs/tasks/phase-65-the-library/*`, `scripts/library/*`.

**Paste the trap list into every agent prompt.** It is in the previous version of this file in git
history, or reconstruct from the entry READMEs. Two additions from last session:

- **`Node.connectInput` copies the source output's current value into the target the moment the wire
  is made**, unless it is `undefined`. `options` seeds its value to its first item and `checkbox`
  seeds `checked=false` in `initialize`, so both read *defined* at connect time; `text-input` does
  not. Any node that mirrors live values will echo those seeded defaults back and never deliver the
  real record. This is what made `settings-page` open on "3 unsaved changes".
- **A repeated child component mounts BEFORE its parent Group's `Did Mount` fires**, so state a
  prefab initialises on the parent's `Did Mount` is `undefined` for the first value a child
  publishes.

### What agents got right that you should keep asking for

Three of eight **pushed back on my instructions and were correct**. That is the behaviour to
encourage, not suppress: tell them to report a measurement that contradicts the brief rather than
comply. Specifically — `filters`' "label" Text was the *filter-group heading*, so deleting it as
instructed would have deleted the filter's name; `user-menu` was told to use a Counter and correctly
used a `Switch` (the Counter trap is about *Functions*, and a parity count cannot express three ways
to close and one to open); and `table`'s column-width fix was **declined** as unverifiable on a code
path that has never executed.

---

## FIRST JOB: the render sweep now means something different — re-read it

`pickShowcase` used to filter on `roots.length > 0`, which counts **nodes, not ink**, so six
logic-only entries were reported "drew nothing" every sweep and for `media-query` and
`shake-detector` it *out-ranked a sibling that would have drawn*. It now narrows to components
holding a node the runtime reports as visual (`isVisual` in the generated
`packages/noodl-types/src/node-catalog.json` — never re-list those types by hand). An **unknown type
counts as visual**, deliberately: module node types are absent from the core catalog, and demoting a
real one to `no-visual` would *hide* a broken entry.

**So: run a full `library:render --shots <dir>` and READ THE NUMBERS AFRESH.** Entries with nothing
drawable now say `no-visual` (a fact) instead of `drew nothing` (which reads as a defect). The nine
previously-blank prefabs are already ruled in `library/prefabs/AUDIT.md` — **8 invisible-by-design,
1 (`tags`) broken and now fixed**. Do not re-rule them.

🔴 **And look at the PNGs.** Every defect that mattered last session was invisible to the counts:
`form` reported "3 controls" while one of them was a 4px black bar; `settings-page` reported clean
while the save bar shouted "3 unsaved changes" at load.

## Then, in order

1. **Drives for the three new entries without one.** `settings-page`, `keyboard-shortcuts` and
   `avatar`/`accordion`-style coverage. Both new drives written last session passed first time, and
   the specs are already written by the agents that built the entries — `settings-page`'s sequence
   (clean on load → edit → bar appears → Discard reverts → **Save re-baselines** → second Discard
   still works) and `keyboard-shortcuts`' **leak arm** (navigate away and back 3×, press once,
   assert exactly one transition) are in this phase's task notes. Assert a **sequence**, not an end
   state.
2. **440 `raw-spacing-literal`** across older entries — `crud-screen` 70, `auth-pages` 57,
   `form-fields` 33, `states-kit` 32, `multi-select` 26. `var(--space-N)` is proven to resolve on
   node parameters. Write a fixer script, render before and after. **Do not hand-edit 440
   parameters.** Largest number on the board, least user-visible thing on it.
3. **41 entries have no README.** Good parallel fan-out for a quiet session.

## The product defects the shelf found — all `Owner: NONE`, all in the AUDITs

These are **product** work, not library work. They need owners or they get rediscovered at full
price:

- **`net.noodl.controls.options` collapses to a 4px black rule** when its `Value` matches none of its
  `Items` (`selectedIndex === -1` draws nothing, and the node opts into a default solid/2px/`#000000`
  border while every sibling defaults to `none`). A `Placeholder` makes the disagreement visible. A
  "dropdown with no declared height" diagnostic would catch it.
- **A throw inside a `Noodl.Events` listener is reported against the node that EMITTED**, because
  `emit` is synchronous (`events.js`, `ReflectApply`) and the listener frame unwinds into the
  emitter's `try/catch`. Cost two render rounds. The message should name the frame that threw, or
  say "via".
- **`table`'s column `Width` never reaches the cell** — the dimension port's setter *deletes* the
  prop for a value without `.value`, so `'1%'` is removed rather than ignored.
- **`check.ts`'s `providesNodes` is `fs.existsSync(project/noodl_modules)`**, which is why
  `pdf-viewer` keeps an otherwise-empty `noodl_modules/` holding only a README. **Load-bearing — do
  not tidy it away.** The honest rule is "provides nodes **or** declares dependencies".
- **The condition checker resolves against catalog defaults, not variants**, so a parameter set by a
  variant reads as an inactive-conditional false positive.

## The dependency mechanism (new, LBR-007) — and its one gap

`library.json` takes `dependencies: ["modules/custom-html"]`, resolved by
`build.js::resolveDependencies` (fails the build on unknown slug / self-ref / cycle) and installed by
`ModuleLibraryModel._installWithDependencies`. `pdf-viewer` 1.2.0 uses it and now renders with zero
console errors.

⚠️ **`user-menu` ships an inline avatar rather than declaring `dependencies: ["prefabs/avatar"]`.**
That was a deliberate call: at the time, `render-check` had no dependency awareness, so declaring it
would have shipped an entry the shelf's own gate could not grade. **`render-check` now resolves
dependencies transitively**, so that blocker is gone — the swap is one node subtree, and
`user-menu`'s README names the exact node ids and connections. Re-render and re-drive after.

## Publishing (repeatable, ~5 minutes)

`library:check` exit 0 → `library:build` → clone `The-Low-Code-Foundation/nodegx-content` (**not
checked out on this machine**; Richard is ADMIN, `gh` authenticated) → replace **only** the flat
files (`find <type> -maxdepth 1 -type f -delete`, then copy `library-dist/<type>/*`) → push `main` →
Pages deploys in ~60s.

🔴 **NEVER delete the per-entry legacy subdirectories** (29 under prefabs, 27 under modules) — the
docs site hotlinks their screenshots. Verify the count survives the copy.
🔴 **`verify-origin` compares COVERAGE BY LABEL ONLY.** Green there means "every entry has a
published counterpart", not "the published zip matches source". **Fetch the served `index.json` and
check the versions** — that is the stronger read and it takes one `curl`.
🔴 The editor caches zips by URL **forever**, which is why the version is in the filename. A
same-URL republish silently does nothing for existing users. **Bump the version for any content
change.**

## Still open (unchanged)

- `modules/material-icons` loads its font from `fonts.googleapis.com` at runtime; nobody has ruled on
  vendoring it. The two *prefabs* that did this were fixed.
- `verify-origin` payload-hash comparison — now buildable, since a publish from `library/` exists.
- 56 entries carry a `docsPath` and the docs site has no `library/` tree. Build the pages or drop the
  field.
- 15 monogram placeholder icons could be bespoke art.
- `noodl-mcp`'s `importReportTool` still assumes an `import-report.json` clean installs no longer
  leave.
- a11y: `drag-to-reorder` is pointer-only.
