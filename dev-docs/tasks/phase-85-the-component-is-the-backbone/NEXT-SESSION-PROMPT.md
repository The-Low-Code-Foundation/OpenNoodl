# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10 (session 4)

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ s2, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | OPEN — ten patterns written, ships nowhere |
| CMP-001 | AC3 four new corpus examples | OPEN |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **NEXT**, and unchanged: run it from its own brief, in a clean session |
| CMP-003 | AC1 the doctrine stops forbidding the named utility | ✅ s2, both copies |
| CMP-003 | AC2 P10 in the playbook | 🟡 half — written into CMP-001 §3, ships nowhere (blocked on CMP-001 AC2) |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-003 | AC4 the ledger column | ✅ s2 |
| CMP-004 | AC1 the shelf is in THE ORDER | ✅ s2 |
| CMP-004 | AC2 searchable by what a part does | ✅ **s4** — `list_library({query})`, 19 specs over the real library |
| CMP-004 | AC3 parts, not just prefabs | OPEN — 🔴 **the highest-leverage item left**, and CMP-005 AC5 is the same work |
| CMP-004 | AC4 the path is two-way | ✅ s3 — `export_to_library`, graded by round trip |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | AC1 node or part — the decision | ✅ **s4** — the node, additively; the part after, and exported |
| CMP-005 | AC2 the tokens an app needs | ✅ **s4** — 13 new tokens, asserted as rendered strings |
| CMP-005 | AC3 existing projects byte-identical | ✅ **s4** — golden table off the pre-change node, both branches |
| CMP-005 | AC4 the locale stops being hardcoded | ✅ **s4** — a `Locale` port, `''` → `en-US` |
| CMP-005 | AC5 reachable by someone who does not know | 🟡 **half** — the catalog example ships, the shelf entry does not |

Session 4 built two tasks and closed six ACs. Both commits are on `cline-dev`:
`b8f84fc85` (CMP-005) and `af5fbb9f0` (CMP-004 AC2).

## The first job

🔴 **CMP-004 AC3 and CMP-005 AC5 are ONE piece of work — do them together.** The shelf needs three
single-component entries, **one of them exported rather than hand-authored**, and CMP-005 needs a
part that demonstrates the new tokens. A small date-formatting component, built in a real project
and put on the shelf with `export_to_library`, is both. **Do not hand-author it** — that skips the
round trip AC4 exists to exercise, which is the only reason the entry is interesting.

⚠️ **And it has to say what it is NOT.** `intl-format` is already on the shelf and already formats
things (below). Two date entries that do not name each other means an author picks by whichever
they met first.

Then: **CMP-002**, which alone grades CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5 — three open ACs
across three tasks — and needs a session that has read only its brief.

## 🔴 THE FINDING OF SESSION 4: THE SHELF ALREADY HELD THE ANSWER, AND NOBODY COULD ASK FOR IT

CMP-004 AC2's worked example is *"is there a date formatter?"*. The first thing the new query
returned is **`intl-format`** — a module of locale-aware formatting nodes: `Relative Time` ("3 hours
ago", with auto-refresh), `Format Number`, `Format List`, `Pluralize`, each with a Locale input.

**CMP-005 walked past it twice in one day.** Its §1 records *"relative time — no token"* as an open
product gap and its §4 rules it out of scope as *"a node with a timer in it"* — which is right, and
is exactly the node that was sitting on the shelf. Those node names are written in **one place**,
the entry's description, and until AC2 nothing read descriptions.

✅ **This is the phase's own thesis landing on the phase**, and it is worth carrying: before you
record a product gap, ask the shelf. `list_library({query: "..."})` now answers.

## 🔴 Traps — session 4's, then the standing ones

- 🔴 **A SPEC THAT PASSES WITH THE FEATURE DISABLED GRADES NOTHING, and one did.** The first
  "matches a component name an entry ships" assertion picked a distinctive word out of a component
  name and asserted the entry came back — and it came back **off its label**. Blanking the entire
  component list turned **nothing** red. Rewritten around `filters`, whose components include
  `/Filters/Date Filter` while `date` appears nowhere in its label, slug, tags or description;
  `matchedIn` is now asserted to be exactly `['component']`, and the control reddens it. ✅ **Run
  the control on the field you think you are grading, not on the feature as a whole.**
- 🔴 **A MATCHER'S FALSE POSITIVE BEAT ITS TRUE POSITIVE, and only a ranked assertion caught it.**
  A word-prefix rule with no bound on the remainder let the tag `Form` match the term `formatter`;
  a tag outscores a description, so `date-picker` came back as the **best** answer to "is there a
  date formatter?". `toContain('intl-format')` passed the whole time — it was `expect(found[0])`
  that failed. **Assert the rank, not the membership**, whenever an answer is a ranked list.
- 🔴 **THE THING YOU ARE CHANGING MAY SHIP TWICE.** `Date To String` is re-implemented as emitted
  source in `nodegx-export/src/emit/dateLib.ts` — an array of quoted lines that becomes
  `src/lib/date.ts` in every exported app. Editing only the runtime node would have made exported
  apps render a different date from the editor preview, silently, and no AC would have noticed.
  ✅ What makes it trustworthy is not that both were edited: `tests/date-family.test.ts` drives the
  **emitted library** and the **runtime node's own `_format`** over the same inputs and asserts
  they agree. Grep for a second implementation before editing a node.
- ⚠️ **A byte-identity gate over 840 emitted files went red, correctly.**
  `nodegx-export/tests/hls001-corpus-identity.test.ts`. Its own header says: count the artefact
  BEFORE regenerating. The count was predicted from `grep -rl '"Date To String"' tests/fixtures`
  (two projects) and came back 4 of 840. `HLS001_REGENERATE=1 npx jest hls001-corpus`, then write
  what you counted into that file's header, where its two previous regenerations are recorded.
- 🔴 **AN INERT PARAMETER IN A CORPUS EXAMPLE TEACHES A LIE.** The one shipped example that set a
  date format set `"HH:mm:ss"` — moment syntax this node cannot read, rendering as the literal
  letters. It **validated clean**: the example gate checks that `formatString` is a real PORT, never
  that its value means anything. Fixed and asserted.
- ⚠️ **`git log <range> -- <pathspec>` resolves the pathspec against your CWD.** Run from
  `packages/noodl-mcp`, `-- packages/noodl-mcp` matches nothing and reads as "no peer touched it".
  Run range queries from the repo root.
- 🔴 **`npm run docs:nodes` wipes and rewrites the whole directory**, and **28 pages were already
  stale at HEAD** plus one untracked new page from somebody's uncommitted work. Snapshot the dir,
  regenerate, restore everything but your own page — and do it AGAIN if you re-run `catalog:merge`
  afterwards, because that makes your page stale a second time.
- ✅ **`catalog:generate` was up to date at HEAD.** Measured by restoring HEAD's version of the node
  and re-running `catalog:check` before regenerating, so the whole diff is provably yours. Do that
  before regenerating any shared artefact.
- ⚠️ **A pipe eats the exit code and the failure.** `npx jest | tail -6` reported `exited with code
  0` for a run with a failing suite, and discarded the ● block naming it. Redirect to a log and
  echo `JEST_EXIT=$?` into it.
- 🔴 Session 3's still stand: **run the suite you are citing AFTER your last edit to it** (the
  phase's own grading suite was committed one `});` short and could not compile, while three
  documents cited it); **a sibling package's in-flight edits redden a typecheck** — filter by path;
  **a blocker's removal can invalidate an AC, not just unblock it**.
- Session 1's still stand: two obvious metrics were **green before the work** (mean ports, variant
  port — do not reintroduce them), and **a session that has read this phase cannot grade a build of
  it**.

## Numbers, measured this session

- `noodl-mcp`: **3 failed / 1484 passed / 1487 total**. The three are the two pre-existing `*Drive`
  suites (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`), which reproduce identically and
  reference nothing in this phase. ⚠️ **Do not subtract from session 3's "1442"** — that figure was
  *derived* (s2's measured 1428 plus 14 new specs), not measured, so the delta will not reconcile.
  What is measured: this session added **26** specs (19 + 7) and a peer's FLD-013 added **11**.
- `noodl-runtime`: **2704 passed, 13 skipped, 0 failed** (158 suites).
- `nodegx-export`: **3400 passed / 1 failed** before the golden regeneration, **green** after.
- The shelf is **72 entries**, not the 42 CMP-004 §2 recorded on 2026-09-09. Re-count it.
- Resident tool budget: `toolDisclosure.test.ts` green — `list_library` is deferred in `explore`,
  so its longer description costs nothing resident.
