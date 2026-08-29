# Phase 80 — next session

## State: DEF-001 closed, DEF-002 half-built, and one blocker that is bigger than its task

**s1 (2026-08-29)** was the first session that *fixed* rather than recorded. Richard: *"Let's start
fixing the defects found in phases 76, 77 and 78."*

| commit | what |
|---|---|
| `30eb92b2` | DEF-001 — the palette and the three control borders |
| `51675d31` | DEF-001 closing section |
| `1bc1cb8a` | DEF-002 §1(a) — a wire to a component-instance port |
| `95be7b4c` | DEF-002 §3 — a signal into a value port |

Gates at close: `test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the
floor, unmoved through four runs) · `test:main` **6287/6287** · MCP **891/891** · `typecheck:editor`
and `typecheck:mcp` clean.

---

## 🔴 FIRST JOB — the ruling DEF-002 needs, because it blocks all thirteen

**`validate_component` and `validate_project` run the `SemanticValidator` and stop.** The entire
**precondition layer — all 13 checks — is invisible to them.** Only the write gate
(`validateCandidate`) composes them.

| door | what it runs |
|---|---|
| `create_component` / `update_component` / `apply_plan` → `validateCandidate` | `SemanticValidator` **+ 13 preconditions** |
| **`validate_component`** / **`validate_project`** → `validateOnDisk` | `SemanticValidator`, and stops |

🔴 **An agent calling `validate_project` to check its work gets a strictly weaker answer than the door
that let the work in.** `checkNavigation`, `checkInstanceInterfaces`, `checkParameterValues`,
`checkFunctionNodePorts`, `checkRepeaterTemplate` and the rest never run there. A clean
`validate_project` does not mean what a reader takes it to mean, **and adding rules to that layer
will never change it** — which is why DEF-002's AC6 cannot be closed by writing more rules.

⚠️ **Do not just switch them on.** Several of those checks were deliberately calibrated *against
graphs an agent just wrote* — their own headers say so at length — and `validate_project` also runs
over hand-authored projects. **It is one calibration pass over the corpus, and that pass answers it
for all thirteen at once.** `AUTHORED_BLOCKING_WARNINGS` is the existing seam if the answer is
"surface, but do not block".

---

## 🔴 SECOND JOB — DEF-002's remaining three parts

| part | state | note |
|---|---|---|
| 1(a) component instance | ✅ | `validation/connectionTargets.ts`, 12 specs |
| **1(b)** `CloudFunction2` `in-*`/`out-*` | ⬜ | needs an index of endpoint request/response params, built off the **same `views`** `componentInterfaces()` and `declaredUrlPaths()` already use |
| **1(c)** `RouterNavigate` `pm-*` | ⬜ | same views; target page's `PageInputs.pathParams` + the `{braces}` in `Page.urlPath` |
| **2** `failure-reaches-nothing` | ⬜ | see the warning below |
| 3 signal → value port | ✅ | `rules/signalIntoValuePort.ts`, 9 specs |

🔴 **Rule 2's gap is real but it was concluded from the wrong file.** DEF-002 read
`noodl-mcp/src/validate.ts`, found no "failure" rule, and stopped. **The rules do not live there** —
they are `noodl-editor/src/editor/src/validation/rules/`. Checked at HEAD: `unwiredOutcome` fires on a
different shape entirely (`unchanged` declared, `done` **and** `failure` wired, neither `unchanged`
nor `completed`), so the hole stands. **That is the third row in this family diagnosed from a caller
list instead of the caller.**

---

## 🔴 The three lessons this session paid for

- **Derive the population; a hand-written list is an exclusion list that cannot fail.** DEF-001 named
  **2** rows. Walking `ElementConfigRegistry` and `STYLE_COMPOSITIONS` instead found **62 failing
  readings across 9 pairs**, including two controls (Checkbox, Button/outline) the write-up never
  mentioned and whose worst reading — `--border` over `--accent` at **1.04:1** — nobody had seen.
- **A stale comment that names its own expiry condition is worth its weight.** `outlineButton` said
  `--border-control` did not exist and *"if it is ever added, this is the line to change."* It had
  been added. That comment turned a re-derivation into a one-line edit.
- 🔴 **A relayed mechanism decays even when the defect is real.** D10's *"runs once, with false"* is
  not what HEAD does (`SIGNAL_PULSE`, one entry, played `true`→`false` in one pass — the port
  **settles** at `false`). The defect was real; the explanation was a measurement of an older
  runtime, and it would have shipped in a user-facing message.

## Traps carried

- ⚠️ **`projectOwnsBackend` is the concurrent-suite canary and it fired once here.** A lone red in
  the MCP suite is a flake until re-run alone. It passed 12/12 on its own and 891/891 on the retry.
- ⚠️ **Two contrast gates now exist in `noodl-editor` and they are not duplicates.**
  `nat-001/palette-contrast` reads `colors.css` and grades the **editor's chrome**;
  `def-001/design-token-contrast` reads `DefaultTokens`/the presets and grades **what a built app
  ships a visitor**. Both headers say so. Do not delete either as a duplicate of the other.
- ⚠️ **DEF-001's AC1 has an owed last inch.** Nothing observed a **rendered** button — the token
  reaches `:root` and the config stamps `var(--primary)`, but both halves are source-text claims.
  Folded into **DEF-008**'s re-drive.
- ⚠️ Peers were committing into this checkout throughout (HEAD moved `596dda0d` → `f9367dc7`
  under four `test:ci` runs). **Pathspec commits only.**

## Rulings still open (unchanged from TASKS.md)

DEF-005 (may a browser read its own roles), P76 F8 (`contactRecipient` in a world-readable row, open
since s4), DEF-009 (`rateLimit` default), and whether this phase exists or folds into 0.2.1.
✅ **DEF-001's ruling was given and is spent:** *`--primary` moves, white text stays.*
