# Phase 69 — ✅ **CLOSED. 20 of 20.**

**Written 2026-08-18, end of s32.** 🔴 **This file is a REWRITE, not an amendment** — the previous
version opened on a ruling that has since been made. The campaign is over: every task is built,
every ruling is made, the rulings queue is empty, and CN-016 — the last one — was closed with its
acceptance criteria driven in a live editor rather than argued from unit tests.

**Anything here that outlives the phase belongs in memory, not in this file.**

---

## 1. What the phase set out to do, and whether it did it

Two principles, both acceptance criteria in every task rather than sentiment:

- **P1 — a custom node is a node.** No *capability* gap between a node you wrote and one that ships
  with the product. Provenance may be *displayed*; it may not be a limitation.
- **P2 — ports are the product, JavaScript is the escape hatch.** Every decision an app-builder
  should be able to make is a port, not a line of code in someone's `index.js`.

Both hold. P1 was tested where it is easiest to break — the property panel's action buttons, the node
picker, the AI and MCP surfaces, validation, deploy and SSR — and the one real gap found (a kit node
had two header buttons where a built-in had three, because `getNodeDocs` reads a repo-build-time
catalog a kit type can never be in) was closed rather than documented. P2 is carried by the shipped
reference kit, whose every visual decision is a port with a design-token default, and by CN-007's
docs, which use the cashflow kit as the worked example — the obligation ✅ D5 created when it ruled
the shipped reference must stay minimal.

**20 tasks, all built. 21 rulings, all made.** The per-task record — with each task's own corrected
premises, which are the most useful paragraphs in the phase — is [TASKS.md](TASKS.md).

## 2. 🔴 What closing this phase does NOT mean

Read this before quoting "20/20" anywhere.

- **The library is not certified fit to publish.** P65's audit found **~9 shipped modules vendoring
  large third-party libraries with no licence text**, and **mapbox-gl v2+ is proprietary**. That is
  **LBR-007**, in phase 65. Nothing in this phase went near it, and no licence audit of the 29
  shipped modules was performed.
- **Nothing publishes `library/` yet.** ✅ D21 descoped CN-016's AC1 from "installs from the real
  origin" to "installs from a built artefact **plus a gate that fails the moment the origin and
  `library/` diverge**". The gate exists and is in CI. **The publish path is still LBR-001**, in
  phase 65, and until it lands the origin serves the old fleet under legacy names.
- **The divergence gate checks coverage, by label — not content.** It says so in its own output. A
  published zip could carry different code under a matching label and the gate would call it
  covered. Content equality is unassertable until a publish from `library/` has happened once.
- **Two defects found on the closing drive are recorded, not fixed** — see §4.

## 3. What is worth carrying out of here

Three things this phase learned the hard way, each of which cost more than one session:

**a. Run a new checker over the corpus that already exists, before shipping it.** CN-017 shipped a
kit verifier with 52 passing specs — all against fixtures and against this repo's own scaffold
output. One pass over the 29 real library modules found two defects in minutes: it read one of the
runtime's **two** node-declaration shapes, reporting **ten working kits as defining none**; and its
verdict **gated installation**, so four working library kits could not be installed at all. The
library was sitting in the repo the whole time.

**b. Ask what being WRONG costs before making a check block.** That second defect is the general
form: a check that **informs** costs a confusing line, one that **blocks** costs the user the
feature. CN-016 hit the same decision twice and both times chose to inform — its taxonomy findings
are notes that never touch an exit code, and `runtimeVersion` is deliberately ungated because the
editor has no runtime version to compare it against, and a comparison against an invented comparand
is a hazard wearing a check's clothes.

**c. Build the caller — and to *data*, not just to call sites.** Thirteen instances across this
phase. The closing drive found two more that no acceptance criterion would have caught.

## 4. The two defects the closing drive found, neither of them phase 69's

Both are written up in [notes/cn-016-drive-observations.md](notes/cn-016-drive-observations.md).

1. 🔴 **Every project import throws two uncaught `TypeError`s, and the write's error path is
   unreachable.** `writeImportReport` awaits a callback-style `FileSystem.writeFile` with no
   callback. The `await` is a no-op, so success is recorded before the write completes; the callback
   invocation throws asynchronously; and **the `try/catch` can never fire**, so a failed write would
   be reported as a successful one. Twelve more call sites are identical; one already calls `.then()`
   on the `undefined` return and is dead code. The honest fix — return a promise when no callback is
   passed — strictly improves all thirteen, but it changes a shared primitive in a `.js` file, which
   is invisible to every gate but `test:ci`. **It deserves its own task and its own run.**
2. ⚠️ **A deploy publishes the project's bookkeeping** — `CLAUDE.md`, `IMPORT-REPORT.md`,
   `import-report.json` and `noodl_modules/kit-provenance.json`, the last carrying the URL a kit came
   from and a consent timestamp. CN-017 was careful that a provenance record not travel with an
   *export*; a deploy is the more public of the two. A decision for whoever owns the exclusion list.

## 5. Gates, on tree `502400b8`

Re-measured in s32. 🔴 **Do not carry these forward — re-measure.** A handover's numbers decay, and
this phase burned a session on that specific mistake.

| Gate | Result |
|---|---|
| `test:main` | ✅ **3904 / 256 suites, zero failures** |
| `typecheck:editor` · `:editor-tests` · `:mcp` | ✅ 0 |
| `test:platform` | ✅ 22 passed, 3 skipped |
| `library:check` | ✅ **59/59 clean** (183 warnings, not gated) |
| `library:build` + `library:verify-dist` | ✅ **29 prefabs + 30 modules, 0 problems** |
| `library:verify-origin` | ✅ **matches the baseline** — prefabs 29/29, modules 26/30 |
| `test:ci` @ `NOODL_SPEC_SEED=39393` | see the closing handover — measured separately, alone |

🔴 **`test:ci` must be run with nothing else on this checkout.** s32 first ran it beside `test:main`
and three typechecks and it **timed out at 900s without reporting results** — which exits 1 and looks
exactly like the clean floor, since a clean floor also exits 1. **A run with no summary line is not a
measurement.** Delete `packages/noodl-editor/tests/test-results.json` first and require the summary,
not the exit code.

⚠️ **Compare the failures BY NAME, not by count.** The count moves as tests land; a new *name* is the
finding.

## 6. The map

- [TASKS.md](TASKS.md) — all 20, each with what was built and which of its own premises were false.
- [RULINGS.md](RULINGS.md) — all 21 (D1–D21). The queue is empty.
- `notes/` — the drive records. Each pairs an **expectations** file written before a launch with an
  **observations** file written after, which is the only arrangement that lets a drive report a
  surprise instead of a confirmation.
