# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10 (session 5)

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
| CMP-004 | AC2 searchable by what a part does | ✅ s4 — `list_library({query})` |
| CMP-004 | AC3 parts, not just prefabs | ✅ **s5** — three EXPORTED parts, and `size` on every row instead of a label |
| CMP-004 | AC4 the path is two-way | ✅ s3 — `export_to_library`, graded by round trip |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | AC1–AC4 | ✅ s4 |
| CMP-005 | AC5 reachable by someone who does not know | ✅ **s5** — the exported `format-date` entry; **CMP-005 is CLOSED** |

Session 5 closed CMP-004 AC3 and CMP-005 AC5 — one piece of work, as the last handoff said.
**Every AC left in this phase now needs CMP-002.**

## The first job

🔴 **CMP-002, and it is the only thing left that is not blocked on it.** It alone grades
CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5 — three open ACs across three tasks. It needs a session
that has read **only** its brief, so run it from a cleared session on
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md`.

⚠️ **You cannot grade it yourself if you have read this file.** Session 1's rule still stands and it
is now the binding constraint on the phase: *a session that has read this phase cannot grade a
build of it.*

The two that do not need CMP-002 are **CMP-001 AC2** (ten patterns written into CMP-001 §3, shipping
nowhere — the same "ships nowhere" shape AC3 just fixed for the shelf) and **CMP-001 AC3** (four
corpus examples). CMP-003 AC2 unblocks the moment CMP-001 AC2 lands.

## What session 5 built

Three single-component parts on the shelf, **all three exported rather than hand-authored**:
`format-date` (4 nodes), `format-full-name` (3), `sanitise-email` (3). Source project committed at
`parts-source/`; entries at `library/prefabs/<slug>/`. The shelf is **75 entries**.

`list_library` rows now carry **`size: { components, nodes }`** — and deliberately no part/prefab
label. Step 3 of THE ORDER says what the numbers are for.

## 🔴 Traps — session 5's, then the standing ones

- 🔴 **THE AC'S LITERAL CRITERION WAS GREEN BEFORE ANY WORK, AND ONLY COUNTING FOUND IT.** AC3 asked
  for *"at least three single-component entries"*. **Fourteen** entries already shipped exactly one
  component, **six of them prefabs** — so CMP-004 §2's *"Every entry is a whole prefab"* is false and
  the criterion graded nothing. The real gap was the UNIT: the smallest graph on the shelf was
  **4 nodes** and the median ~20. ✅ **Count the artefact against the AC's own words before building
  to them.** This is the FOURTH time in this phase a task file's premise did not survive contact.
- 🔴 **"ONE COMPONENT" DOES NOT SEPARATE A PART FROM A SCREEN.** `file-upload` is ONE component and
  **48** nodes; `toggle-switch` is ONE component and **7**. The obvious mechanical rule was the AC's
  own proposed unit and it fails on the shelf as it stands. Measure the discriminator before
  adopting it.
- 🔴 **A SPEC THAT PASSES WITH THE FIELD BLANKED GRADES NOTHING — session 4's finding, in the same
  task again.** *"Reachable by what it does"* asked the three natural questions and asserted each
  part came back; **blanking all three descriptions turned nothing red**, because every question
  matched the SLUG (`format-date`, `sanitise-email`, `format-full-name`). ✅ Pick a term that lives
  in exactly ONE field (`weekday`, `surname`, `domain`) and assert `matchedIn` is that field.
  **When the thing you are naming is named after its job, the name is the confound.**
- 🔴 **A GATE PINNED TO "THE BEST ANSWER" IS PINNED TO THE STATE OF THE WORLD.** Session 4 asserted
  `intl-format` ranked first for *"is there a date formatter?"*. Exporting a real date formatter
  turned that red — correctly. The literal was not bumped: both facts are asserted, and the two
  descriptions now name each other so the RANKING is not the decision.
- ✅ **A byte-identity gate is what makes "exported, not hand-authored" checkable.**
  `cmp004Parts.test.ts` re-runs `export_to_library` from the committed source and manifest into a
  temp shelf and diffs every byte, **file list first** — a diff over only the files found on both
  sides passes when a shipped entry has gained a file nobody exported. Controls run: one character
  in a README ✅ red; a hand-added file ✅ red; the bug reintroduced into a shipped script ✅ red.
- ⚠️ **TWO SPECS SURVIVED THE SIZE CONTROL BY READING ZERO IN BOTH ARMS.** A one-sided
  `nodes <= 4` passes when the count is broken, and a row-vs-derivation comparison agrees with
  itself at 0. Bound both sides, and put a known-firing signal beside any consistency check.
- ⚠️ **A tool in a deferred group is `disabled` until `find_tools` reveals it**, and the call comes
  back as protocol text, not a tool error — so a driver that only logs will report success while
  every call failed. `reveal(session, 'explore')` first; throw on `isError`.
- ⚠️ **A product defect, owner NONE:** the `Expression` node mints a phantom input port for every
  method name in a **chained** call (`email.trim().toLowerCase()` → ports `email` AND
  `toLowerCase`), plus a `runOnChange-` checkbox each. Measured against the real node; written up
  in `parts-source/README.md`. Harmless at runtime, but no string-manipulating `Expression` can be
  written without junk ports. It is why the three parts use `Function` nodes.
- ⚠️ **`intl-format`'s `Utilities` tag was deliberately NOT fixed.** The one-character change would
  make `list_library({tag: "Utility"})` correct and would delete the evidence AC2's decision rests
  on, which `cmp004LibraryQuery.test.ts` pins against the real library. Follow-up, owner NONE —
  and it needs that suite rewritten in the same commit.
- 🔴 Sessions 3 and 4's still stand: **run the suite you are citing AFTER your last edit to it**;
  **`npm run docs:nodes` wipes and rewrites the whole directory** and 28 pages were already stale at
  HEAD; **the thing you are changing may ship twice** (`nodegx-export/src/emit/dateLib.ts`);
  **an inert parameter in a corpus example teaches a lie**; **a pipe eats the exit code** — redirect
  to a log and echo the status into it; **`git log <range> -- <pathspec>` resolves against your CWD**.
- 🔴 Session 1's still stand: two obvious metrics were **green before the work** (mean ports, variant
  port — do not reintroduce them), and **a session that has read this phase cannot grade a build of
  it**.

## Numbers, measured this session

- `noodl-mcp`: **3 failed / 1508 passed / 1511 total**. The three are the two pre-existing `*Drive`
  suites (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`) — identical to session 4's, and
  they reference nothing in this phase. ✅ **The delta reconciles**: 1511 − 1487 = **24** new specs
  (21 in `cmp004Parts.test.ts`, 2 in `phase85Doctrine.test.ts`, 1 in `cmp004LibraryQuery.test.ts`).
- `noodl-runtime`: **2708 passed, 13 skipped, 0 failed** (158 suites). Three of the four added since
  session 4 are this session's `AC5` describe; the fourth is not ours.
- `npm run library:check`: **75/75 entries clean**; the three new entries carry **zero** warnings.
- Resident tool budget: **8,275 / 8,280**, unchanged — `list_library` is deferred in `explore`, so
  its longer description costs nothing resident.
- Full-shelf contents read, re-measured: **75 entries, 3.0 MB, 8.5 ms** (five runs, 8.4–8.9). This
  supersedes AC2's "~25 ms", which was never re-taken.
- ⚠️ **A peer was live in `packages/noodl-editor` all session** (`popuplayer.ts`, `popuplayer.css`,
  `main.js`, `package.json` — mtimes minutes before ours). The commit used pathspecs touching none
  of them; `design.ts` in that package IS ours.
