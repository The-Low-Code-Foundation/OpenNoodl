# Phase 66 — the tasks (FIX: 0.1.7 bug fixes → 0.1.8 alpha)

**Created:** 2026-08-14 out of [README.md](README.md) and ten research lanes over the 16-item
user-test report. Every row's mechanism was read in source on 2026-08-14; the task files carry the
file:line evidence.

**Built so far (2026-08-14):** FIX-007 (docs + write-time gate), FIX-020, FIX-010 — code complete
and gated. Gates green: `tsc --noEmit`, catalog trio + `catalog:examples` 62/62 + `docs:nodes:check`,
`cloud-library:check`, MCP suite 458/458, `test:main` 188 suites / 2866, `test:ci` 2726/6 (all six
inherited by name).

**Driven (2026-08-14, session 2):** **FIX-020 and FIX-010 are CLOSED** — 3/3 criteria each, driven
live. **FIX-007** is driven for criteria 2 and 3 and for criterion 1's MCP half; criterion 1's
internal-AI half is *paid* and awaits Richard, and criterion 4 is **blocked on its own fix 4, which
is not built** — not on the drive. 🔴 The drive also found the MCP sidecar `dist/` two days stale, so
the gate was reaching the editor door but **not** the MCP door until it was rebuilt; a running server
needs a restart to pick it up. See [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) § 3.

**States:** built → spec-proved → driven (the phase-64 discipline: a spec proves the decision;
only a drive proves the pixels).

| Task | One line | Report | Tier | Effort | Blocked on a ruling? |
|---|---|---|---|---|---|
| FIX-001 ⭐ | the explainer reads live values, warnings, and the backward walk | 1a–c | **1** | M (+M/L for 1c) | minor (snapshot/truncation) |
| FIX-002 | the Explain composer becomes a real multiline input with a Send button | 1d | **1** | S | 🔴 the send key |
| FIX-003 | AI text is selectable and links click, app-wide | 1bis | **1** | S→M | opt-in vs invert (rec: opt-in) |
| FIX-004 | conversion + log blocks; free toolbox adds; objects-as-data | 2 | 2 | S+XS+M | block shape (minor) |
| FIX-005 | dropdown contrast fixed; category name ruled | 3 | 2 | S–M | 🔴 naming (reverses VFN-012) |
| FIX-006 | the AI picks the right code node and writes 2026 JavaScript | 4a–b | 2 | S+S+M | Script demotion (minor) |
| FIX-007 ✅ | the `in-`/`out-` prefix truth reaches the catalog, the validator, and the write path | 4c | **1** | S+M | no |
| FIX-008 ⭐ | Connect is idempotent; every opened project gets its `.mcp.json` | 5 | **1** | S+S/M (+M for scope split) | backfill posture (minor) |
| FIX-009 | Components/Properties/PortEditor share one stored width | 6 | 2 | S | PortEditor inclusion (rec: yes) |
| FIX-010 ✅ | a query change re-anchors the picker to its top result | 7 | 2 | S | no (one test updated deliberately) |
| FIX-011 | the bench frame gets a height, handles, and a per-component default | 8a | 2 | M (symptom fix S) | 🔴 persistence (R5 exception) |
| FIX-012 | a None row; Reset all stops lying | 8b | 2 | S | None semantics (rec: clear) |
| FIX-013 | the Data maze is removed; the bench is inputs and outputs | 8c | 2 | S–M | 🔴 zero-rows / AI-preview parity |
| FIX-014 | logic nodes get their own column, by prompt and by a layout pass | 9 | 2 | S+M | x/y authority (rec: authoritative) |
| FIX-015 | style tokens: rulings session → a new phase | 10 | brainstorm | session | 🔴 all eight |
| FIX-016 | Signal offered at add time; declared-vs-called mismatch diagnosed | 11 | 3 | S+S | signal-input semantics (for the M–L half only) |
| FIX-017 | completions at an empty position; `Noodl.Records.` answers; TASKS.md reconciled | 12 | 3 | S+M+S | no |
| FIX-018 | a component card says it opens; context menu says so too | 13 | 2 | S–M | ✅ **RULED 2026-08-14: option C** (chip + stacked card) — buildable now |
| FIX-019 | "Show in workbench"; the canvas admits when it left the benched component | 14 | 2 | S+S–M | chip direction (minor) |
| FIX-020 ✅ | one stylesheet stops fighting the other; five popups uncrop | 15 | 2 | S | no |
| FIX-021 | project + global memory docs: slice 0 defect now, brainstorm for the loop | 16 | 3 / brainstorm | S+M+session | 🔴 the six memory rulings |

## Suggested order, and why

**Tier 1 first — each is a daily-use papercut or an AI-trust breaker, and none depends on a big
ruling.** FIX-007 (the prefix) and FIX-008 (the binding) are the two that make the AI story look
broken to an outside user; both have small, fully-pinned first slices. FIX-001/002/003 turn the
"explain this node" feature from a demo into the beginner tool the report describes — 002 and 003
are small and can land while 001's live-value layer is built. FIX-020 and FIX-010 are afternoon
fixes with screenshots for acceptance; do them early for momentum and because the popup clip
touches five surfaces users hit constantly.

**Then the bench trio (FIX-011/012/013) as one sitting.** They share files, share the chrome
strip's 30px (011 and 019 both want it — decide the strip once), and 013's rulings shape what 011
has to lay out. FIX-019 rides along.

**The Blockly pair (FIX-004/005) as one sitting** — same package, same specs, and FIX-004's
dropdown-shaped conversion block wants FIX-005's readable dropdowns.

**FIX-006/014 together** — both edit the authoring prompts and both are graded by re-running the
same live build request.

**FIX-009, 016, 017 anywhere** — independent, small-to-medium, no cross-coupling.

**The two brainstorm tasks (FIX-015, FIX-021) need Richard, not an agent.** Schedule the
rulings sittings from the README's queue; the style-token session is the long one and its output
is a new phase, not code in this one. FIX-021's slice 0 (the degraded launcher CLAUDE.md) is an
ordinary S fix and should not wait for the brainstorm.

**FIX-018 is ruled and buildable now:** Richard validated **option C (chip + stacked card)** from
the mockup artifact on 2026-08-14 — it can join Tier 1's early wins.

## Two things to check before starting any task here

1. 🔴 **Reproduce the report.** Five of sixteen premises were wrong or already-built (README §
   "premises found FALSE"). Three tasks carry an explicit reproduce-first / verify-live step
   (FIX-007's artefact grep, FIX-010's devtools read, FIX-016's drive) — do it before coding.
2. ⚠️ **Gates before and after:** `test:main` + `test:ci` (compare names, read
   `tests/test-results.json`), `tsc --noEmit`, and for anything touching the catalog (FIX-007)
   the catalog trio + the MCP suite. One live session owns the editor at a time.
