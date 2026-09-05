# Next session — finish the shelf, then ship it

**Richard's ask (2026-09-05, verbatim):** *"tackle more prefab and module stuff, and then publish at
the end, as much as we can fit into one session using sub agents"*.

So: **fan out on authoring, verify serially, and publish before you run out of session.** The
publish is not the stretch goal — it is the deliverable. Everything before it is "as much as fits".

---

## Board, re-derived from the files on 2026-09-05

| Gate | Command | State |
|---|---|---|
| Sources | `npm run library:check` | **68/68 clean, exit 0** — 500 warnings, not gated |
| Artefact | `npm run library:build` + `library:verify-dist` | **installable-shaped, exit 0** |
| Icons | `npm run library:icons:check` | **68/68 have one** |
| Render | `npm run library:render` | 33 drew · 10 drew nothing · 25 no visual surface · **0 unrendered icons** |
| Harness | `npm run library:render:self-test` | **pass** |
| Behaviour | `npm run library:drive` | **3 drives, 0 failing checks** |
| Origin | `npm run library:verify-origin` | coverage by label only; **nothing published since 2026-08-22** |

**68 entries** — 39 prefabs + 29 modules. Last session added `avatar` 2.0.0 (re-authored from a
module that was dead on React 19), `search-bar` 1.0.0, `accordion` 1.0.0, `stepper` 1.0.0, and
retired `modules/avatar`. Full record at the bottom of
[TASKS.md](TASKS.md); the two AUDIT.md banners carry the findings.

### 🔴 STEP 0, BEFORE ANY AGENT STARTS: commit the tree

**Last session's work is uncommitted** — ~70 files, four peer sessions on this checkout, and a
sibling's `git commit -a` sweeps unstaged work. Commit it first, by pathspec, `git add` the
untracked directories first because a pathspec commit **skips untracked files silently**:

```
git add library/prefabs/{avatar,search-bar,accordion,stepper} scripts/library
git commit library scripts/library package.json dev-docs/tasks/phase-65-the-library -m "..."
```

Then `git status --short -- library` must be empty. Do not start the fan-out until it is.

---

## 🔴 The one rule that decides whether this session works

**Agents author. The orchestrator verifies. Rendering is SERIAL.**

Every render and every drive starts its own headless Chrome. Twenty agents each calling
`library:render` is the CPU failure Richard has already ruled on
(*"Stop fucking up the CPU"* — one heavy job at a time, and there are peers on this box).

- ✅ **Parallel-safe, fan out freely:** reading entries, writing `project.json`, writing READMEs,
  writing `library.json`, writing fixer scripts, analysis.
- 🔴 **Serial, orchestrator only:** `library:render`, `library:drive`, `library:check`,
  `library:build`, `library:verify-dist`, anything that opens a browser.

So the shape is: **fan out to author → collect → orchestrator renders the changed set in one
batch → orchestrator drives → publish.** Tell every agent this in its prompt, or one of them will
helpfully "verify its work" and take the box down.

### File ownership — give each agent a disjoint set

One library entry is one directory, which is a clean boundary. **The orchestrator owns the shared
files** and no agent may touch them:

`package.json` · `library/README.md` · `library/prefabs/AUDIT.md` · `library/modules/AUDIT.md` ·
`dev-docs/tasks/phase-65-the-library/*` · `scripts/library/origin-baseline.json`

An agent that wants a line in an AUDIT returns the text; the orchestrator merges it. A wholesale
rewrite of a shared file by two agents is an unperformed merge and it has already cost this repo a
session.

### What every authoring agent must be told

Paste this into each prompt — it is what stops the same three traps being rediscovered at full
price, once per agent:

> Author only. **Do not run any render, drive, or gate command** — the orchestrator does that in one
> serial batch. Read `library/prefabs/card-grid/project/project.json` for the house pattern and
> `library/prefabs/{search-bar,accordion,stepper}/README.md` for the traps. Specifically:
> - **Icons are Lucide, and the source is three fields**: `{"class": "lucide", "code": "icon-x",
>   "codeAsClass": true}`. Omit `codeAsClass` and the glyph's *name* renders as visible text. Never
>   write `material-icons` — no project has it.
> - **`Timer`'s `Duration` is a plain number of milliseconds.** The `{value, unit}` shape every
>   *dimension* port takes silently becomes a zero-length timer.
> - **A Function with no input that ever arrives never runs at load**, so the first signal that runs
>   it is consumed as a boot run. Use a `Counter` (arrives at 0) rather than a remembered boolean.
> - **A Function that reads the Counter it increments re-runs on its own effect.** Untick *Run on
>   value change* — `"runOnChange-in-Foo": false` in `parameters`, and declare the matching port.
> - **`styleCss` takes CSS declarations, not rules.** A nested `> * + *` selector is dropped.
> - **`run` is connection-only**; a `"run": true` parameter is discarded.
> - Spacing and colour come from tokens: `"var(--space-4)"`, `"var(--muted-foreground)"`. Every
>   token you use must exist in `DefaultTokens.ts`.
> - Ship a **Static Data node of samples plus a "Choose items" Function where a connected non-empty
>   array wins**, so the entry shows what it is the moment it is placed.
> - Bump `version` in `library.json` for any content change, and write a `README.md`.

---

## Work packages

Ordered by value. **Take them in order and stop when the clock says publish** — a half-finished
wave is fine, an unpublished session is not.

### Wave 1 — the entries that are wrong today (4 agents, parallel)

| # | Job | Files it owns |
|---|---|---|
| 1.1 | **`form`, `tags`, `table` render blank on install.** All three are `For Each` over data with no samples, so a user installs them and sees nothing. Give each the `card-grid` contract. Highest visible return in the whole list | `library/prefabs/{form,tags,table}/` |
| 1.2 | **`pdf-viewer` fails at runtime** — `Can't find component model for module.inlineHtml`. It needs the standalone `custom-html` module and **nothing installs it**. This is phase-65 follow-up #3 (`schema.json` has no dependency field, nothing reads manifest `dependencies`). **Decide and implement:** a `dependencies` field the installer honours, or fold `custom-html` back in and accept the duplication. Write the reasoning down either way | `library/modules/pdf-viewer/`, `scripts/library/schema.json`, and the installer if it goes that way |
| 1.3 | **The 9 prefabs that drew nothing** — `confirm-dialog`, `media-query`, `oauth2`, `shake-detector`, `supabase`, `tags`, `toast`, `totp`, `xano`. Rule on each: *legitimately invisible at rest* (a dialog, a detector, a cloud connector) or *broken*. Most are the former — say so per entry so nobody re-derives it. `tags` is 1.1's | one line per entry, returned to the orchestrator for the AUDIT |
| 1.4 | **The small warning classes**: 11 `inert-dimension`, 4 `unsized-absolute-box`, 2 `label-not-a-click-target`, 1 `failure-reaches-nothing`, 14 `raw-color-literal`. Read them out of a `library:check --json` the orchestrator hands you. The colour ones are mostly alpha tints, which the style charter permits — only `#FFFFFF`, `#F53636`, `#C6C6C6` are real | the named entries only |

### Wave 2 — new content, Tier 2 (5–6 agents, parallel)

From [PROPOSED-CONTENT.md](PROPOSED-CONTENT.md), already vetted against the node catalog. **One
good entry beats five thin ones** — that constraint is Richard's and it still holds.

| # | Entry | Why it is worth a slot |
|---|---|---|
| 2.1 | **File Upload** (prefab) | `To CSV` exists and *nothing can download the result*. A genuine dead end sitting next to a node that implies otherwise. `Open File Picker` → `Upload File` → `Cloud File`, with preview, progress and error |
| 2.2 | **User Menu** (prefab) | Avatar + dropdown + sign out. Pairs with `auth-pages` and with the new `avatar`. ⚠️ There is still no cross-entry dependency mechanism, so it ships its own small avatar unless 1.2 builds one |
| 2.3 | **Settings Page** (prefab) | Sectioned form with dirty tracking and a save bar. Pairs with `form-fields` |
| 2.4 | **Keyboard Shortcuts** (module) | No dependency, small surface, and modules are under-represented in new content. Use `@nodegx/kit-scaffold`; read `library/modules/example-node-kit/` first |
| 2.5 | **Scroll Reveal** (module) | IntersectionObserver, no dependency, cheap polish |
| 2.6 | **Command Palette** (prefab) | ⌘K quick switcher. Differentiating, cheap over core nodes. Take it only if there is room |

**Every new entry needs a behavioural drive**, not just a render — see Wave 3. All three prefabs
built last session rendered correctly on the first try and **failed their first drive**.

### Wave 3 — verification (orchestrator, SERIAL, no agents)

In this order, and do not skip the first one:

1. `npm run library:render:self-test` — **if this fails, every `Outputs.X()` finding is about the
   harness, not the library.** It has a known-bad floor that must still fail; a probe whose floor
   passes cannot tell a working signal from a missing one, and this one could not, for a whole sweep.
2. `npm run library:check` — must be `N/N clean, exit 0`.
3. `npm run library:render --shots <dir>` over the changed set, then **look at the PNGs**. The
   ligature-name defect was invisible to every count and obvious in one screenshot.
4. Write a drive for each new entry in `scripts/library/drives/` (there is a shared
   `harness.js` — pass `{nodes, connections}` and it builds the fixture). Assert a **sequence**,
   not a final state: signals per keystroke, steps per click. All three existing drives are wrong
   at the end state and right in the middle, or were.
5. `npm run library:drive` — 0 failing checks.
6. `npm run library:icons` for anything new, then `library:build` + `library:verify-dist`.

### Wave 4 — the mechanical sweep (1 agent, only if there is room)

**440 `raw-spacing-literal`** across the older entries — `crud-screen` 70, `auth-pages` 57,
`form-fields` 33, `states-kit` 32, `multi-select` 26, `table` 21, `form` 20, `app-shell` 19,
`filters` 18, `stripe` 16. `var(--space-N)` **is proven to resolve on node parameters** (form-fields
renders correctly and the search-bar's drive passed unchanged after tokenising it), so this is
mechanical: write a fixer script like `scripts/library/remap-icons.js`, run it per entry, and have
the orchestrator render before and after. Do not hand-edit 440 parameters.

**Do this last.** It is the largest number on the board and the least user-visible thing on it.

---

## 🚢 Publish — start this with a third of the session left

Nothing has been published since 2026-08-22. Everything below is unchanged and repeatable.

**Preconditions:** `library:check` exit 0, `library:verify-dist` exit 0, every touched entry's
`version` bumped (the editor caches zips by URL **forever**, which is why the version is baked into
the filename — a same-URL republish silently does nothing for existing users), and the tree
committed.

1. `npm run library:build` → `library-dist/`.
2. Clone the content repo — **it is not checked out on this machine**. Richard is **ADMIN** on it
   and `gh` is authenticated:
   `gh repo clone The-Low-Code-Foundation/nodegx-content /tmp/nodegx-content`
3. Copy `library-dist/{prefabs,modules}/*` **FLAT** into
   `nodegx-content/static/library/{prefabs,modules}/`.
   - Delete the stale flat zips/pngs first.
   - 🔴 **NEVER** delete the legacy per-entry subdirectories — the docs site hotlinks their
     screenshots. The editor follows only `index.json`.
4. Push `main`. GitHub Pages deploys in ~60s.
5. `npm run library:verify-origin` — it fetches the live indexes through `getContentEndpoint()`.
   ⚠️ It compares **coverage by label only**, so a green here means "every entry has a published
   counterpart", not "the published zip matches the source". Update
   `scripts/library/origin-baseline.json` if the measured divergence legitimately changed.
6. Record the publish in
   [`dev-docs/tasks/phase-21-library-and-import/PROGRESS.md`](../phase-21-library-and-import/PROGRESS.md)
   under **Log**, naming which entries changed version.

**If the session is running out:** publish what is green and leave the rest uncommitted-but-noted.
A shelf that is one entry better and *shipped* beats six entries better and sitting in a working
tree — the whole reason last session's findings mattered is that users had been getting
`star_border` as text for six weeks.

---

## Still open after all of that

- **`modules/material-icons` loads its font from `fonts.googleapis.com`** at runtime. Inherent to
  that module, but nobody has ruled on vendoring it. The two *prefabs* that did this were fixed.
- **41 of 68 entries have no README.** Good fan-out work for a quiet session; low urgency.
- **`verify-origin` compares by label only** — follow-up #2. Now that a publish exists, the payload
  hash it asks for is buildable.
- **Docs-site pages**: 56 entries carry a `docsPath` and the docs site has no `library/` tree at
  all. Either build the pages or drop the field.
- **15 monogram placeholder icons** could be bespoke art. `scripts/library/make-monogram-icon.js`
  generates them; a person would do better.
- `noodl-mcp`'s `importReportTool` copy still assumes an `import-report.json` that clean installs no
  longer leave (follow-up #7).
- **a11y**: `drag-to-reorder` is pointer-only.

## The traps, and where they are written down

Do not re-derive these. Each cost a measurement last session:

| Trap | Written in |
|---|---|
| A Function's `out-*` ports never reach the runtime from disk — correct scripts throw `Outputs.X is not a function` | `scripts/library/render-check.js` header |
| Rendering into a bare directory fails *every* icon, Lucide included | same |
| `Timer.Duration` is a plain number of ms | `library/prefabs/search-bar/README.md` |
| A Function with no arriving input never runs at load | `library/prefabs/accordion/README.md` |
| A Function reading the Counter it increments re-runs on its own effect | `library/prefabs/stepper/README.md` |
| `styleCss` takes declarations, not rules | `library/prefabs/avatar/README.md` |
| `verify-dist` fails any entry with no icon (`ModuleCard` destructures it unguarded) | `library/README.md` |
