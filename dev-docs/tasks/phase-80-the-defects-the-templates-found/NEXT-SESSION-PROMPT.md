# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, **014**, 016, 017 closed. **DEF-007 is 🟡 partial.**

**s10 (2026-08-29)** took **DEF-014** — the highest-bite open row — and closed all four acceptance
criteria, including the person-level drive. It is a **product source change** in
`noodl-runtime`'s SQLite adapter, so every gate was re-run; the readings are in §"What was run"
below and they are the ones to quote.

| commit | what |
|---|---|
| `77a82ddc` | **DEF-014 fixed at the cause** — `QueryBuilder.columnRef`, 30 adapter specs, the HTTP day-one spec, and one phase 77 spec inverted |
| `4d5289d3` | **AC1 driven** — `publishPage` 200 on a site with no sections; and the refusal used to come *after* the page went public |

---

## 🔴 The finding, in one paragraph

**A column here is only ever created by a write, so on the day an app is made every property it
filters on names a column that does not exist — and that was a 500, not an empty result.** The
site-builder's Publish refused every page on every new site because of it. Fixed in one seam:
`columnRef()` emits the SQL literal `NULL` when the table has no such column, so **an absent column
behaves exactly as a column present and null in every row** — an equivalence, asserted operator by
operator, because "returns nothing" is passed by an implementation that gets `$exists: false` and
`$ne` backwards. 🔴 **The task's own proposed mechanism had no population**: §3 said `_Schema`
separates a declared-but-unwritten property from a nonexistent one, and it cannot — `_Schema` is
written in the same call as the `ALTER TABLE`, so *declared but unwritten* is not a state that
exists here. That is **the second session running** that a task's named mechanism turned out to have
nothing behind it (s9 was `rootComponent`, 0 of 340).

## What to do next

**DEF-007's §3.2** is still the largest open piece and is still sequenced behind phase 77 —
`site-builder.content.json` was edited by a peer at **20:19 today**, mid-run. §6.1 prices it: **56
decisions, not a flag**, and §1.1 already forced the decision.

Also open: **DEF-008**, **DEF-009**, **DEF-015**, and the four carried from phase 76 by reference
(**DEF-010/011/012/013** — three say their fix needs a corpus sweep, and that sweep is shared work
to be done **once**). **DEF-005** is 🔒 on a Richard ruling.

⚠️ **DEF-015 is the natural next one** — it is the other row from the same SBR-015 drive, it is
small (a classifier in `LocalBackendCard`), and its traps are already written down.

🔴 **The standing instruction has now paid seven sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s4 deleted two of three
rows, s5 found a defect the file did not contain, s6 found it had been fixed the day before, s7
found the rule wrong about two of eleven cases, s8 found the recommended fix ships an accessibility
defect, s9 found a scope item with no population, **s10 found the proposed mechanism could not tell
apart the two things it was named to tell apart.**

## 🔴 What this session paid for, that the next one should not re-buy

- 🔴 **A tracking table written by the same call as the thing it tracks cannot answer "was this
  declared but not created".** `_Schema` and the SQL column are both written by `createTable` /
  `addColumn`, so the set they would distinguish is empty — and `addColumn` *skips* its `_Schema`
  update on a duplicate `ALTER`, so a column can exist, hold data, and be missing from the tracking
  table. ✅ **The instrument is `PRAGMA table_info` on the live connection.** Read fresh, not
  cached: **11.4 µs, 2.8% of a 200-row query**, and a stale cache would answer a *working* query
  with no rows — silently, which is worse than the defect being fixed.
- 🔴 **An assertion that the operation "did its work" must be one the failure would break — run the
  mutant against THAT assertion, not just the suite.** `expect(page.published).toBe(true)` was the
  obvious control for "the publish worked". Under the mutant it **still passed**, with the endpoint
  answering 400 — and so did the ACL reading. That is how the partial-write finding was found: the
  function writes the flag and opens the ACL, then fails. **Only the status code discriminates.**
- ✅ **The defect had already been paid for twice at call sites and once in a comment.**
  `service.ts::ensureSystemTables` pre-creates `_User`/`_Session` *with their columns* and its
  docstring gives this exact reason; `DataBrowser.tsx:252` carries POL-014's fix for the same shape.
  ✅ **Grep for the error string before believing a defect is one site wide** — three sightings
  turned "found in the site builder" into "the site builder is where it was noticed".
- ✅ **The equivalence is the spec, not the emptiness.** Two mutants: restoring the raise fails 25
  adapter specs + 2 HTTP + 2 drive; the *lazy fix* (short-circuit an absent-column query to empty)
  fails 7, all of them arms built for it. A spec that only asserted `results: []` would have passed
  the second.
- ⚠️ **`escapeColumn` strips non-alphanumerics**, so an existence check has to compare the
  *sanitized* name against `PRAGMA`'s. And the ephemeral in-memory mock answers no PRAGMA — the
  scope must read **unknown** there, not "no columns", or every query in that mode goes empty.
  Pinned as a control.

## Traps carried

- ✅ **`test:ci` — 2894 specs, 5 failures, seed 32101, at `2cbe1d2f`.** Four are the named
  **AIX-006 style vocabulary** floor. 🔴 **The fifth is SB-017 and it is a peer's, measured:**
  `site-builder.content.json` mtime **20:19** and their `sb-017` spec **20:26**, both *inside* the
  run window, and `sb017-deploy-connection-parity.test.ts` imports that artefact and nothing from
  the query path. **The floor is still 4 by name; do not read 5 as a new baseline.**
- ✅ `noodl-runtime` **2594 passed** / 145 suites (30 new), `nodegx-backend` **118/118 suites, 1391
  passed**, `tsc --noEmit` clean in both.
- 🔴 **`catalog:examples` is still a PR gate (`pr.yml:210`) and still RED**, 60/62, owner **`NONE`**,
  ~20 minutes. Unchanged and unmeasured this session.
- ⚠️ **`typecheck:mcp` red on one peer error** and 2 failures in `tpl001Template.test.ts` from a
  peer's uncommitted fixture, as recorded by s8. Not re-measured; neither is phase 80's.
- 🔴 **A pathspec commit ERRORS on an untracked file rather than skipping it** — `git add` the new
  specs first, then commit by pathspec in the same command. Two new spec files hit this.
- 🔴 **Do not reach for `git checkout --` to undo a mutant.** It would have discarded the whole
  fix in that file. Revert the mutant by its exact text and `diff` against a scratchpad copy.
- ⚠️ **The checkout was busy all session** — two peer sessions running full jest suites and one
  editing `site-builder.content.json` live. Suites were run serially; `test:ci` waited.
