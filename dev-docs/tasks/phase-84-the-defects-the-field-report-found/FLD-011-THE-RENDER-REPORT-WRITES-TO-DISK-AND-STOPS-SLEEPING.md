# FLD-011 — The render report writes to disk and stops sleeping

🟢 **BUILT** — sessions 7 and 12, 2026-09-10 and 2026-09-11. Read
[FLD-011-WHAT-WAS-BUILT.md](./FLD-011-WHAT-WAS-BUILT.md). **All six ACs met.**

Session 7 built `out_dir` (AC1, AC5) and the settle budget (AC2, AC4-as-fixed-vs-settled). Session 12
built the third scope item — **parallelise by tab** — and with it **AC3 and AC6**, each with a
reverted arm: `tests/fld011ParallelTabs.test.ts`, 11 tests.

Measured end to end on #40's own eleven-page fixture, `templates/members-area`:
**53.8s (fixed timers) → 10.3s (settle budget) → 6.13s (four tabs) — 8.8x.** The corpus went
**205.1s → 55.0s** on the settle budget, and **20 of 20 projects report identical findings serial and
parallel**, both arms run twice.

🔴 **The honest reading of the tab work: 1.52x on the one many-page project in the corpus and 1.00x
on the other nineteen** — eighteen have no routed pages to sweep at all. Session 7 predicted exactly
this. The end-to-end number for a ten-page project is what makes it worth having.

🔴 **And building AC3's fixture found a defect nothing else could see: the report was DROPPING every
console error a page logged while loading**, because the attribution window opened after the
navigation. Thirteen `console-error` findings across three corpus projects had been invisible,
including one on **every page** of `members-area`. See §7(c) of the what-was-built — it has a
consequence that needs a decision, and it names it.

🔴 **And one thing this task did not know: the MCP tool surface had 7 tokens of headroom.** Adding
`out_dir` broke `toolDisclosure`'s 8280-token budget gate. It was paid for rather than waived, and
**FLD-014 does not fit at all** — see §4 of the what-was-built.

*"`render_report` is the best thing in the product… it caught every real bug I made. I ran it six
times in one session."* The complaint is that verifying is expensive, and the cost is almost entirely
fixed timers.

## 1. The person sentence

**An agent verifies ten pages, gets file paths back, reads only the two it needs, and waits seconds
rather than most of a minute.**

## 2. What was reported, and what the code says

[#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40): 37.0 s wall for ~5.3 s of CPU on
ten pages, and screenshots returned as base64 costing roughly half a megabyte of context.

Measured 2026-09-09:

- 🔴 **The settle waits are fixed timers; nothing observes the page.**
  `scripts/devtools/render-report.js:1195-1207` — `BOOT_MS = 3500`, `REFLOW_MS = 1200`,
  `PAGE_NAV_MS = 2000`, applied as bare `await wait(ms)` at `:1439`, `:1455`, `:1466`. No
  `Page.loadEventFired`, no network idle, no mutation quiescence. Ten pages × two viewports =
  **45.5 s of pure sleeping**, which brackets the reported figure.
- **`out_dir` is 90% built.** `scripts/devtools/measure-from-disk.js:96-105` already implements
  `--out <prefix>`: it writes `${out}-${shot.name}.png` **and** sets
  `report.viewports[name].screenshot` to the path. The report already has the field.
- Base64 is produced at `render-report.js:1604`, forwarded by `--inline-screenshots`
  (`noodl-mcp/src/render.ts:411`), and turned into image blocks at `tools/renderTools.ts:113`.
- **The page loop is serial and the shared state is one browser tab.** `render-report.js:1650-1690`.
  Blocking state, precisely: one CDP page target (`:1416-1418`);
  `Emulation.setDeviceMetricsOverride` is per session, so viewports serialise against that same tab;
  and `page.consoleErrors` is **one shared array** attributed by index slicing (`:1573`, `:1657`), so
  interleaving would misattribute every console error. The project server is a stateless
  `http.createServer` (`render-from-disk.js:528`) and does **not** block concurrency.
- ✅ **Parallelism does not break the orphan reaper.** `reapOrphanedRenderProcesses` (`:1270-1318`)
  kills only processes with `ppid === '1'`, and its own comment names concurrent drives as the thing
  that check protects.

⚠️ **One correction to the issue:** screenshots are captured **per viewport, not per page**
(`:1585-1605` runs only inside the subject-page viewport loop). A ten-page render returns **two**
images, not twenty. The reported context cost is right; the reason given is not.

## 3. Scope

- `out_dir` on the tool: when set, pass `--out` and **drop** `--inline-screenshots`, returning paths
  as text. ~15 lines, additive.
- A settle budget: replace the fixed waits with a quiescence check plus a ceiling.
- Parallelise **by tab**, not by process — `Target.createTarget`, a per-tab client and a **per-tab
  console buffer**, with a concurrency cap. One Chrome plus one server, N tabs.
- ⚠️ `out_dir` defaults **off**. The tool's own doctrine is *"LOOK AT THE SCREENSHOTS"*
  (`renderTools.ts:49-51`), and a default that hides them would quietly undo the feature's point.

## 4. Acceptance criteria

1. **(person)** An agent runs a ten-page report with `out_dir` set, receives paths, reads one image,
   and the response carries no base64.
2. Wall time on a ten-page fixture is **recorded before and after**, from the same fixture on the
   same machine. 🔴 A speed claim with one number is not a measurement.
3. Console errors are attributed to the correct page **under parallelism** — a fixture where page 3
   and page 7 each throw a distinct error asserts each lands on its own page. This is the arm the
   shared buffer will break, so it is the one that matters.
4. The findings are identical serial and parallel on the same fixture. A faster report that reports
   differently is a different report.
5. With `out_dir` unset, behaviour is byte-identical to HEAD. Asserted, so the default path cannot
   drift.
6. The orphan reaper still reaps: a deliberately orphaned render process is killed on the next run,
   under the parallel path.

## 5. Traps

- 🔴 **Do not parallelise by process on a shared box.** Each `withRenderedPage` spawns a Chrome plus a
  server at ~260 MB, by the reaper's own measurement. N processes is how you take the machine down.
- 🔴 **A settle budget that is too eager turns a real finding into a flake.** Any budget change must
  be graded against the corpus for finding stability, not just for speed.
- ⚠️ The reaper's `ppid === '1'` test is what makes concurrency safe. Do not "tidy" it into a
  name-based kill; that kills a peer's run.
- ⚠️ Page-level caching keyed on component revision is explicitly **out of scope** here. It is a
  correctness risk disguised as a speed win, and it needs its own task.
