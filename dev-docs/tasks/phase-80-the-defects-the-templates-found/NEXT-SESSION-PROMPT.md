# Phase 80 — next session

## State: **32 rows. 22 ✅ · 10 open, and every one of them is now workable.**

Richard ruled all five blocked rows on 2026-08-30 and registered five more that had no home.
**Nothing in this phase is waiting on a person any more.**

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** The s22 handoff said
*"no workable open row left"* while the table held `DEF-027 | ⬜ open`, appended 32 minutes
earlier. Summaries drift; the table is the phase.

```
grep -E '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -v '✅'
```

🔴 **Read [RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) FIRST — it is captured,
NOT built.** Two rulings went **against** the recommendation put to Richard; a session that reads
the verdict and not the reason will rebuild the argument and get it wrong.

---

## The work, in the order it should be done

### 1. DEF-013 — re-drive before anything else *(may cost nothing)*

The **cheapest possible first act**, and it can delete its own row. SB-012 §1's table was measured
**2026-08-26**; the door's `components` list has since been rebuilt from `authoredProjectViews`,
**which overlays a plan's unapplied operations** — the exact gap the table records.

Re-drive on a live server built from `src`: two throwaway pages that navigate to each other,
staged into one plan. **If it stages clean, close DEF-013 with the measurement and move on.** If
not, option 1 (resolve `target`/`template` against unapplied siblings) is the presumptive fix —
and **option 2 is ruled out permanently**, see the rulings file.

### 2. DEF-032 and DEF-030 — the two gates, because they are why the rest shipped

🔴 **Fix the instruments before trusting them about anything else.**

- **DEF-032** (P77 D32) — `gradeMountTriggered` opens with a `continue` and reaches **1.5%** of
  `plan.writes`: one of sixty-five. It is the answer to *why D31 shipped past a suite that already
  knew about the migration.* ⚠️ **Do NOT "fix" it by making the template state all 65** — that
  changes what the migration is for and needs its own argument. **The gate is the gap.**
- **DEF-030** (P77 D16) — `templateAppearance` §4's `barePages()` walks the transitive closure of
  placed components, so a page passes by *placing* something styled. Sabotage at HEAD:
  `/Pages/PageEditor` reads *not bare* with **every one of its own structure parameters stripped**.
  ⚠️ The stricter own-tree rule is **not green today** and re-grades two other pages — that is part
  of the work, not a blocker.

✅ **A pass whose first line is a `continue` is not coverage until you have counted what it
REACHED.** The number that mattered in D32 was never the offender count — it was the `1`.

### 3. DEF-025 — flip at creation, in **both** doors

Editor palette **and** MCP door author `useLabel: true` onto newly placed `Checkbox` /
`Radio Button`, `STARTER`-params shape. No existing rendering moves; nobody's checkbox suddenly
says **"Label"**.

⚠️ **Check s17's catalog-flip spec arm still holds** — the rule reads the effective default from
the catalog, so it should fall silent on unset ports with **no second edit**. That arm is also the
only thing that makes the authored-bag-only mutant killable.

### 4. DEF-009 AC4 — `rateLimit` defaults to `{ ratePerMinute: 60, burst: 30 }`

Matching `auth` on the ladder the product already has (oauth-start 20/20 · **auth 60/30** ·
admin 300/100 · data 1200/400). Per key.

🔴 **This changes behaviour for every existing public writing function, so it owes a corpus check
before it lands.** The sweep already counted **27 unlimited public write doors across 23 projects,
all `submitContactForm`** — re-run it and confirm none legitimately bursts past 30. ⚠️ **Do not
measure the limiter by "the row did not appear"**: a refused write and a filtered read are the
same shape. ⚠️ `burst: 0` / `ratePerMinute: 0` is the existing *unlimited* convention — the default
must not collide with it.

### 5. DEF-005 — both halves, and AC3 is what makes (a) safe

**(a)** read-only `roles` output on the `User` node via `SecurityState.rolesForUser`;
**(b)** a cloud `List Users In Role` node.

🔴 **The cloud-only rule on the role WRITES survives intact** — that is the load-bearing half of
the ruling. 🔴 **AC3 is not optional**: a **negative control** asserting a user who edits the
output client-side is **still refused by the server**. Assert the refusal, not just the read, and
**beside a known-firing signal** — *"refused"* and *"never requested"* are identical readings with
opposite fixes.

⚠️ Both are a port and a node — **neither owes the UNI-001 four sweeps.** Keep it that way.

### 6. DEF-029 and DEF-031 — the two missing capabilities

Both are *a missing capability, not a missing wire*, and both were measured with known-firing
controls that earned their place.

- **DEF-029** (P77 D15) — no file-drop anything: `onDrop`/`dataTransfer`/`dragover`/`dragenter` =
  **0** against a **39**-hit `onClick` control. SBR-007 AC3 is not authorable as written.
- **DEF-031** (P77 D22) — no `text-overflow` port: **0** hits, against `wordBreak` = 2 (a `Text`
  `inputCss` port that DOES exist) and 11 files carrying `inputCss` — the mechanism a new port
  would use.

### 7. DEF-028 — build determinism

P77 D13. The export health filter races the viewer's dynamic-port announcement, so **what a build
contains depends on when it was taken.** ⚠️ **SBR-008's fix removed the `prop-` family from the
filter's reach and left the filter unchanged** — every other dynamic-port family is still exposed.
🔴 **Do not read SBR-008's green specs as evidence**: they call `setup()` and read what it
announces; the debounced pass is not in them.

### 8. DEF-007 §3.2 — the template writes explicit values *(sequenced last, on purpose)*

Drive the **56 disagreements across 13 components** to zero by making template generation write
the values — phase 78 D14's choice, cheaper and narrower than teaching four packages to apply
migrations.

⚠️ **`site-builder.content.json` is phase 77's live lane.** They landed `505d9b38` during s23 and
their D30/D31 work touches the same generator. ✅ `git log -5 --` on that file and check its mtime
**before starting**; coordinate rather than race. That is why this is last.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together; either alone is the state the task exists to distinguish. **The byte
gate cannot help**: it compares the artefact to a fresh run of the same generator, so a field
neither side writes is a field both sides "agree" about. It passed over D9 exactly this way.

### 9. The five unowned rows that need measuring

See [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — `publishPage`'s ordering, the shared
backend that dies on a second deploy, the backend card that never looks again, `Record.Fetched`
firing on a bind, and the `domelement` port that cannot reach its own description.

**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-033`+ are free) and a person's sentence, or it is not a row. ✅ **Keep the disproved ones,
marked** — phase 78's D4 is the worked example of a reversal being the most valuable row in a
register.

---

## Traps carried

- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`, a **gitignored artifact**. A
  `noodl-viewer-react/src` change is invisible to any noodl-mcp drive until
  `cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
  (~40s). s23's first post-fix drive came back **9/9 RED** for this reason alone and read exactly
  like a broken fix. ⚠️ It is **shared and mutable on this checkout** — check for a running drive
  before rebuilding.
- 🔴 **D-numbers COLLIDE across registers.** P77 and P78 both have a `D22`, a `D25`, a `D32`. A
  bare `grep D32` over a task file proves nothing. **Qualify with the register**, or grep the
  anchor form `DEFECTS-THE-SITE-BUILDER-FOUND.md#d32`. s23's first sweep pass reported four rows
  as "carried" that were not, for exactly this reason.
- 🔴 **A regex with `[^.]` cannot match across a markdown link** — every path has dots in it. s23's
  second sweep pass then reported rows as *missing* that were plainly cited. **Run a control that
  finds a string you know is there** before believing any absence.
- 🔴 **Make the peer-check its own tool call and READ it before starting a suite.** s23 issued `ps`
  and the suite in one command, ran a viewer-react suite plus a webpack build beside a peer's
  backend suite, and paid with a BLD-004 flake that had to be re-run alone.
- 🔴 **A pathspec commit sweeps a sibling's edit** — s23's D28 update to phase 77's register went
  in under `505d9b38`, someone else's commit. Harmless (committed, not lost), but `git log <file>`
  will not show s23's message for it.
- 🔴 **Cite a package with a filename.** The register's `cloudFunctions.test.ts:85` is under
  `noodl-editor/tests/cloud/`, not `nodegx-backend/tests/`; the wrong guess reads as *"the gate
  was deleted"*.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only, md5
  parity after.
- 🔴 **A full-suite run piped to `tail` loses the failure names** — redirect to a file, grep
  `^FAIL` / `●`.

## Gates (s23 — full table in TASKS.md § *Gates — s23*)

4 typechecks clean · viewer-react **1100/1100** · noodl-mcp **994/994** · `ac2DragGestureDrive`
**9/9** both sides of the fix · `test:ci` **2905 specs, 4 failures, all AIX-006 by name — the
floor** · editor jest **6453/6458**, the five reds attributed (one flake, four a peer's uncommitted
template edits).

⚠️ **Nothing in this handoff is built.** The rulings are decisions; the five new rows are
registered by reference; the five measurement rows are written up. **All of it is the next
session's work.**
