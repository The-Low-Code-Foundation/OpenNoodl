# LAS-004 — Promote the architecture warning, add the page-size backstop

**Status:** ✅ **DONE** 2026-08-08 (session 2) · **Track 1 (gates)**

## The evidence

`repeated-sibling-subtree` fired correctly on **every measured build** — 3 warnings on the Opus
baseline's exact failure, 2 on haiku's, 1 on sonnet's — and blocked nothing, anywhere. It is the
only architecture gate in the system and it is advisory through every door (verified:
`AUTHORED_BLOCKING_WARNINGS` at
[authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149)
is `UnknownParameter`, `UnitlessDimension`, `UnresolvedNavigation`, `PageWithoutPageNode` — all
wiring-level).

Meanwhile the audit's classification says hard rejections were self-corrected at a 100% rate even
by the mid-tier model. The gate that already speaks the right sentence needs to stop whispering.

## Build

### 1. Promote `RepeatedSiblingSubtree` to authored-blocking

- Add its code to `AUTHORED_BLOCKING_WARNINGS`. The corpus is untouched by construction — the
  authored policy never applies to `validate:project` (the file's own doc-comment, verified).
- **First**: sweep the AI-suite fixtures for hand-laid trios. The `PageWithoutPageNode` precedent
  is the governing lesson, in both directions: fixtures teaching a refused shape get corrected
  (they were asserting the wrong thing), and the correction is not a suppression. Expect hits —
  the fixtures predate the doctrine.
- The rule's message already offers both exits (one component instantiated N times, or a
  Repeater) — with LAS-002 landed, that text now actually reaches the staging agent, and with
  LAS-007 it carries the recipe. Sequence this task after LAS-002 so a newly-blocking gate arrives
  speaking.

### 2. New rule: the oversized page (info severity)

A **page** component (has a `Page` node / registered route) whose own graph exceeds a threshold →
**info**: "this page wanted to be several components" (doctrine §0's ~25-node line).

- **Info, not warning, deliberately.** The audit showed cold models already decompose when the
  doctrine reaches them; this is a backstop against the 66-node regression, not a pressure toward
  over-factoring (best-practices 01: "over-factoring is its own mess"). It must never block.
- Threshold from the corpus: run a node-count census of page components across the ~95 projects
  and pick the knee, recording the numbers — not the doctrine's prose number. If the corpus knee
  disagrees with ~25, the corpus wins and the doctrine gets a footnote.
- Count the page's **own** nodes (instances count as 1) — the whole point is that a page of six
  instances is the ideal.

## Acceptance

- `ecommerce-example`'s `Pages/Home` (66 nodes, 3 trios): rejects as authored output on the
  trios; draws the page-size info.
- The two cold-replay Homes (7 and 8 nodes): pass both checks untouched.
- Sonnet's `Sections/InfoStrip` (the 4-identical-siblings quartet): rejects as authored output.
- Editor jest count does not drop (fixture sweep done right — compare the passing COUNT, `Tests:
  0` is a compile failure); noodl-mcp suite green; corpus census recorded in the register.

## What was built

**§1** — `RepeatedSiblingSubtree` added to `AUTHORED_BLOCKING_WARNINGS`. Severity is unchanged
(`warning`), so the corpus is untouched by construction; only authored output is refused.

**§2** — `validation/rules/oversizedPage.ts`, a new `rules/` rule (structural only, so `NormNode`
is enough — unlike LAS-001's, which had to be a precondition). Info severity, `defaultEnabled`,
threshold **40** nodes, located on the page's `Page` node so the editor can navigate to it.

## The census, and why the threshold is not the doctrine's 25

`measurements/scan-page-size.js`, 2026-08-08, both corpora. A page is a component containing a
`Page` node — the runtime's own definition — and the count is its **own** flat nodes, with a
component instance counting as one.

```
51 page components · min 2 · median 6 · p75 19 · p90 36 · p95 66 · max 83
83, 71, 66, 66, 60, │ 36, 32, 31, 31, 26, 25, 21, 19, 16, 13, 12, 11, 10, 9, …
```

The only real gap in the distribution is **36 → 60**, so that is the knee and 40 sits inside it.

| Threshold | Pages over it | |
|---|---|---|
| 25 (the doctrine's) | 10 (19.6%) | includes a 31-node Supabase login form and a 31-node admin page — legitimately dense, mostly logic nodes, neither wanting to be three components |
| **40 (shipped)** | **5 (9.8%)** | the two copies of the 66-node reference Home, and three `agent-chat` pages at 60–83. Every one is a page a reader would agree is too big |

**The corpus disagreed with the doctrine and the corpus won**, per the task's own instruction. The
doctrine keeps ~25 as the target to aim at; 40 is the line at which it is worth saying so out loud.

## Acceptance, run against the real artefacts

`validate:project` on the three preserved projects:

| Project | Result |
|---|---|
| `ecommerce-example` | 3 × `repeated-sibling-subtree` + 1 × `oversized-page` info on the 66-node `/Pages/Home` ✅ |
| `phase55-replay-sonnet` | 1 × `repeated-sibling-subtree` on `/Sections/InfoStrip` (the 4-identical-siblings quartet) ✅ |
| `phase55-replay-haiku` | 2 × `repeated-sibling-subtree`; **no** `oversized-page` — its Home is 7 nodes ✅ |

## Register

| # | Finding | State |
|---|---|---|
| F12 | **The fixture sweep found exactly one population, and it was session 1's own.** Three specs in `noodl-mcp/tests/stagingDiagnostics.test.ts` staged a hand-laid trio and asserted the door **accepts** it — the `PageWithoutPageNode` lesson in miniature, a fixture teaching a shape the gate now refuses. Corrected, not relaxed: they pin the same text arriving in the *rejection* (the stronger claim), and LAS-002's actual contract — a non-blocking warning arrives as an object, not an integer — is now pinned on `raw-color-literal`, which is advisory everywhere. No other fixture in either suite laid a trio. | ✅ corrected |
| F13 | The task said `ecommerce-example`'s Home carries "3 trios". It carries **2**; the third is in `/Components/SiteFooter`. The count of 3 warnings for the project is right, the attribution was not. | ✅ noted, no action |
| F14 | **`validate:project` still runs rules only** — it has never applied the precondition checks (`checkParameterValues` and the rest), so LAS-001's three codes and every parameter-value diagnostic are invisible to `validate_project`, `review_project` and the CLI. `oversized-page` and `repeated-sibling-subtree` are rules and do appear. Deliberately not changed here: adding preconditions to `validateOnDisk` would introduce ~15 new **error**-severity classes across the whole 119-project corpus as a side effect of a gate task — the "regression bought with a refactor" `authoredCandidate.ts` warns about. It is a real coverage gap and deserves its own task. | 🔴 OPEN, filed |

## Gates at close

`catalog:examples` 57/57 · `catalog:check` · `catalog:merge:check` 175/175 · `typecheck:editor`
clean · editor jest **76 suites / 1029 specs** · noodl-mcp jest **20 suites / 208 specs**.
