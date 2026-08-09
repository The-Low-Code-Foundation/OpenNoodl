# Phase 56 — handover after session 6 (2026-08-09)

**What ran:** **BEN-006's Live criteria**, all four, driven on the surface the ask actually names —
the **AI authoring preview** — with every rendered string read out of the sandbox webview's own DOM.
BEN-006 is closed. **Only BEN-007 remains.**

The build was session 1's and needed no repair. What the drive changed was the panel's *caption*,
and what it exposed was bigger than the task: the fixture it was driven on is an ordinary
`For Each` list, and **inference finds zero fields on one** — so the preview a user is asked to judge
an agent's work by renders five cards of the literal word `Text`. BEN-006 is what makes that
survivable, which is a better argument for the feature than the task file made for itself.

Read [HANDOVER-SESSION-5.md](HANDOVER-SESSION-5.md) first; B24 governed every click here.

✅ **No second session was live.** `git log --since="6 hours ago"` held only session 5's two commits
at the start, at the midpoint and before the commit, and every file in `git status` was this
session's. Every `git add` was pathspec-scoped anyway — **check again next session** rather than
inheriting this.

## What is on the branch

| Commit | What |
|---|---|
| (this one) | **BEN-006 Live** — `SandboxClass.inferred`, the honest caption, timestamps as bookkeeping, the no-columns note, 3 specs, register rows B25–B27 and this file |

## How to drive the AI preview at all — the part that cost the most

There is **no user route** into `AuthoringPreviewDocument` other than starting a session, and the
scripted-session harness ends by opening the *review* document over it (**B27**). The recipe that
works:

1. `node packages/noodl-editor/scripts/aix15-live/scripted-session.js --candidate=<path> --project=<copy>`
   — this installs the no-provider `AiClient` patch and opens the project;
2. close the review, click **Reject**, then re-fill the panel form and click **Update it** yourself.
   The patch survives, and this time nothing opens the review, so the preview document stays current.

⚠️ **Point `--project` at a copy.** The editor rewrites what it opens. A copy of *Puppy test 3* is in
the scratchpad; the tracked fixture was never opened.

⚠️ **The candidate does not have to be a recording.** `--candidate` takes a path to any
`ComponentFiles` JSON, and a component's three v2 files on disk are exactly that shape — so
`/Pages/Landing` was replayed through the real gate verbatim (36 nodes, update mode, 1 turn). That is
how this drive got a list component when no recorded candidate reads a collection at all.

## What the drive proved

Fixture: `/Pages/Landing` — `For Each` → `/Components/PuppyCard`, over `DbCollection2
collectionName=Puppy`.

| Claim | Evidence |
|---|---|
| The preview opens on inference alone | `Sample data — 5 Puppy, signed in as a sample user` + chip `Fields unknown` |
| ⚠️ **and inference found nothing** | **20** rendered leaves reading the literal `Text` — 5 cards × 4 text nodes (**B26**) |
| §3's invitation is on that class | *"Nothing here could be inferred from the graph — write a row and it will render."* |
| **Live 3** — filled by hand, renders populated | 3 rows typed as JSON → `Biscuit / Marlow / Pip` with breed, age, description; **0** literal `Text` left |
| §4 — Apply reloads, on purpose | marker `mk-2dn04i` → **null**, and the panel is still open on the other side |
| The strip says whose data it is | `Sample data — 3 Puppy (yours), …`, `Fields unknown` **gone** |
| **Live 1** — a table edit reaches the DOM | a **57-character** name typed into the `name` cell read back out of the sandbox DOM verbatim |
| **Live 2** — one row | row count `1` → `1 row` in the draft, **1** card rendered, **0** placeholders |
| **Live 4** — absent against a real backend | `Real backend` → Data *and* Sign out gone; an **open** panel unmounts with them |
| `dataOpen` survives the round trip | back to `Sample data` and the panel is showing again — a toggle click then *closes* it, which read as "it will not open" for one command |
| §6 — nothing is written | `userData` never leaves `useState`; no project file is touched on any path |

## What the drive changed (B25)

The panel captioned the sandbox's **own bookkeeping** as fields the graph reads — worst in exactly
the `unknownShape` case §3 exists for, because there they were the *only* columns:

```
before   Read by the graph: createdAt, updatedAt      2 columns, 10 editable cells
after    Read by the graph: — nothing inferable       0 columns,  0 cells
         No columns yet — switch to JSON and write a row like { "name": "…" }.
```

Two independent halves:

- `INTERNAL_FIELDS` did not strip `createdAt`/`updatedAt`, though `synthesizeRecords` stamps them on
  every record and `NOT_A_FIELD` excludes them from fields by construction. Every one of those ten
  cells was an edit that does nothing — `completeRecord` reassigns them whatever is typed.
- The caption read `klass.fields`, which is inference **plus every key the served records carry**. So
  it also read the user's own keys back at them once they had filled the class in. `SandboxClass`
  gains **`inferred`** and the caption comes from that alone — verified live, it still says
  `— nothing inferable` *after* the user supplied `name, breed, age, description`.

⚠️ **The fix opened a gap and had to close it**: with the timestamps gone, a shapeless class has a
table with nothing to type into. The invitation now names the JSON view.

## ⚠️ Filed, not fixed — read before BEN-007

- **B26 — a `For Each` over a query infers ZERO fields.** `componentClosure` collects components by
  matching `node.typename`, but a repeater names its template in a **`template` parameter**; and even
  in the closure it would contribute nothing, because discovery reads `prop-<field>` endpoints while a
  template reads the record through its **`Component Inputs` ports** (LAS-012: *the template is a
  PORT, not a child*). The fix is a fifth inference rule and belongs to AIX-008.
  ⭐ **This is almost certainly session 4's unexplained loose end** — `SiteHeader`'s six literal
  `Text` placeholders on the bench are the same fallback, arrived at the same way. BEN-007 should
  check that before treating it as a mystery.
- **B27 — the AI preview is one click from unreachable.** `AuthoringPreviewDocument` is opened in
  exactly one place (session start). *"Review changes"* covers it, the review's **Close** lands on the
  canvas, and nothing reopens it; `accept`/`reject` only navigate away. Since BEN-006 it also
  discards every record the user typed, because `userData` lives in that document's state. Consistent
  with R5, but the session a user has in mind is the authoring one, not the mount.

## ⚠️ Traps, for whoever drives next

- **B24 held everywhere.** One `element.click()` per `eval`, and never measure-then-click. Two evals
  that each toggle the same control leave it where it started — that is what cost a command when
  `dataOpen` turned out to have survived the Real-backend round trip.
- **HMR declines these files.** `[HMR] Nothing hot updated` in `.logs/dev.log` while the source had
  the fix — the same trap AIX-003 recorded for `SelectionActions.ts`. **Verify the running code, then
  `dev:stop` and relaunch.** A later HMR *did* apply and remounted the panel, which **closed the
  authoring document** and lost the staged session (a known AIX-008 note); expect to re-stage.
- **`npm run test:ci` output does not survive backgrounding.** The harness kept only a 3KB tail —
  four `FAILED:` lines and no `Jasmine:` line at all, which is unreadable as a verdict. Redirect to a
  file yourself (`npm run test:ci > <log> 2>&1 &`) and grep that. The count is the only thing that
  counts (B18).
- **A dumped `document.body.innerText` from the sandbox target is mostly inlined CSS** — tens of KB
  of it. Query `.ndl-visual-text` instead; that is the runtime's own text class and it reads like the
  page.

## Fixtures

Nothing tracked changed. The drive used a scratchpad copy of *Puppy test 3* and a candidate JSON
assembled from `/Pages/Landing`'s three v2 files — both reproducible in one command from the recipe
above, so neither is worth tracking. **`/Pages/Landing` in the real project is the fixture that
matters**: it is the corpus's only `For Each`-over-a-query list, which is what makes it the case
B26 is about.

## Gates

- `npm run test:ci`: **`Jasmine: 2574 specs, 6 failures`** against session 5's `2572 / 6`. **2 new
  specs, both mine, both passing** — confirmed by name in the run log, not inferred from the count —
  and the **same 6 inherited failures** (4 `AIX-006 style vocabulary`, 2 `AI model registry`), neither
  file in this diff. Compare the count, not the summary (B18).
  ⚠️ **+2, not +3.** The third acceptance line was closed by an assertion added to an *existing*
  spec, and a count that lands one short of what you expected is indistinguishable from B18 (a file
  that never ran) until you check which. Say what you added in `it()` blocks, not in criteria.
- `typecheck:editor`, `typecheck:editor-tests`: clean.
- `eslint` clean on all four changed source files.

## What to do next

1. **BEN-007**, last and live — the phase's exit test. It now has three saved scenarios and a
   defaultless `Ghost` port waiting on `BenchProbe` (session 5), a driven data editor on both
   surfaces, and **B26 as a ready-made explanation** for session 4's `SiteHeader` placeholders.
2. **Loose ends**, none blocking: B19 still cannot tell a genuine string `"undefined"` from an unset
   port; B3/B8 (`stretch` and the missing Group wrapper) are still unmeasured and are BEN-007 §A/4.
