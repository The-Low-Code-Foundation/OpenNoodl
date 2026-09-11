# SBR-013 — The doctrine rule

**The root-cause fix.** Eighteen honest tasks produced an unusable app because no acceptance
criterion was ever written from the user's side of the screen, and nothing in the MCP's
guidance asks for a design before a graph. 🧭 Richard extended the rule beyond this template:
*"the MCPs should follow that rule too."* This is the task that stops the next template
arriving the same way.

## 1. The person sentence

**The next person (or agent) who builds an app through the door is told to establish the token
set and the screens before authoring components — and every template task file they write
carries a sentence a person could verify.**

## 2. Scope

- **MCP authoring doctrine**: the project-server instructions and the authoring-order guidance
  ("THE ORDER, FOR ANYTHING BIGGER THAN A TWO-NODE FIX") gain the design-first steps: settle
  tokens (get_style_vocabulary / set_project_tokens), sketch the screens, THEN plan components.
  Style-from-tokens is already taught; the *ordering* and the *screens-before-components* rule
  are not.
  ⚠️ `instructions` are fixed at `initialize` and the tool surface has **three token-budget
  gates** — measure the addition on the wire, not in the source.
- **The task template** (dev-docs conventions): a required "person sentence" acceptance
  criterion. Add it where task files are actually seeded from (find the template/checklist that
  exists rather than inventing a new doc nobody reads — and if none exists, the phase README
  convention is the carrier).
- **The lesson content**: if the authoring brief / lessons surface (`lessons/authoringBrief.ts`)
  teaches component-first, correct it to design-first.

## 3. Acceptance criteria

1. The doctrine text ships on the wire within budget (measured — the budget gate stays green,
   and the measurement is quoted in the task file).
2. A cold authoring session against a fresh project, asked to "build a small site", is
   observably steered: its first tool calls include the style vocabulary before the first
   `create_component` (drive one session and read the transcript — the consequence, not the
   text).
3. The task-template change exists and phase-77's own files already comply (this phase is the
   first consumer of its own rule).

## 4. Traps

- 🔴 A ruling names a place; ruling ≠ checking it — grep for every seam where authoring
  guidance is emitted (instructions, tool descriptions, briefs, lessons) before declaring the
  doctrine landed; an instruction added in one of three surfaces is a third of a rule.

---

## 5. Verdict — **BUILT, s41, 2026-09-02.** All three ACs met

Graded by `packages/noodl-mcp/tests/sbr013Doctrine.test.ts` (10 specs, the wire and the
conventions) and `packages/noodl-editor/tests-unit/sbr-013/doctrineOrder.test.ts` (12 specs, the
six prompt constants and the two composed prompts). **Both were mutant-graded against committed
HEAD**: 8/10 and 10/12 red with the change reverted. The four that stayed green are the two
non-regression guards and `DESIGN_PLANNING`, which is the finding below.

### 🔴 The measurement that changed the shape of the work

The trap said *"an instruction added in one of three surfaces is a third of a rule"*. Counted before
touching anything, there are **six** doctrine strings that reach a model, and **exactly one** already
stated the order: `DESIGN_PLANNING`, the in-editor planner's — *"Decide the project's identity ONCE,
before the pages"*, shipped in phase 54.

**The five an EXTERNAL agent reads did not.** `DESIGN_DOCTRINE_MD` and `DECOMPOSITION_DOCTRINE_MD`
are what `get_project_info` hands an MCP client, and the bound `instructions` string opened
*"THE ORDER … decide the component tree FIRST with create_plan"* and named `get_style_vocabulary`
**only** in the per-component sentence three clauses later. So the rule was present where it could
be read from inside the editor and absent on the door phase 77's own template came through — and
"the doctrine says design first" was true of the repo and false of the product.

### AC1 — on the wire, within budget ✅

🔴 **The headroom was SIX TOKENS.** Measured before the change: **8,274 against the 8,280 bar, 6
free** (`toolDisclosure.test.ts`'s `[surface]` line). An added paragraph costs ~30, so the honest
options were a third budget renegotiation — which that gate's own header says must not happen — or
not spending anything.

✅ **It spends nothing.** The instruction change is a MOVE, not an addition: `get_style_vocabulary`
came OUT of the per-component sentence and went to the front of THE ORDER, which is both the
ordering fix and where the characters came from.

| | tokens | free |
|---|---|---|
| before SBR-013 | 8,274 | 6 |
| **after** | **8,273** | **7** |

The briefing is **six characters shorter** than the one it replaces, and `sbr013Doctrine.test.ts`
pins that direction so the next edit to this paragraph is told the price rather than the refusal.

⚠️ **The reasons could not fit and did not need to.** The instruction carries the ORDER only. The
`why`, the two tools that actually SET the identity (`set_style_preset`, `set_project_tokens`) and
the `find_tools({group:"theme"})` door they sit behind ride in `get_project_info`'s `designDoctrine`
— a result field, outside the resident-surface budget entirely. 🔴 **Those two tools are deferred,
so naming them in `instructions` would have pointed at tools absent from `tools/list`** — a call, a
refusal and a turn spent. There is a spec asserting the briefing does not name them.

### AC2 — the cold drive, and the criterion had to be re-derived ✅

Full record: [`measurements/SBR-013-COLD-DRIVE-2026-09-02.md`](measurements/SBR-013-COLD-DRIVE-2026-09-02.md).
Two arms, same prompt, same model, differing only in the **built** `dist/noodl-mcp.cjs`.

🔴 **AC2 as written is green in BOTH arms.** "Its first tool calls include the style vocabulary
before the first `create_component`" was already true at HEAD — the control called
`get_style_vocabulary` third — and was already true of the phase-55 haiku baseline in August. Run
once, against the shipped build only, this drive would have certified the change by measuring
something the change did not cause.

What the arms disagree about is whether the identity was **written down**:

| | control (HEAD) | shipped |
|---|---|---|
| read the vocabulary before the first component | ✅ | ✅ |
| reached the deferred `theme` tools at all | ❌ never | ✅ `find_tools` |
| `set_style_preset` / `set_project_tokens` | ❌ neither | ✅ both, before `create_plan` |
| **`metadata.designTokens` on disk at the end** | **absent** | **present, 34 tokens** |

The control read the design system, kept it in its head, and expressed it one component at a time —
phase 77's failure, reproduced on demand in 394 seconds. ✅ **The criterion that discriminates is
the doctrine's own person sentence**: somebody can open the project and read back the accent, the
surface ramp and the page list before a single component exists. On the control there is nothing to
read back.

⚠️ **n = 1 per arm, one model, one brief.** A demonstration with a control, not a distribution.

### AC3 — the convention exists and this phase complies ✅

`dev-docs/TASK-TEMPLATE.md` gains a **required** `## The person sentence` section with a worked
right/wrong pair, and a Success Criteria rule that at least one criterion be person-verifiable —
because a task can carry a person sentence and still grade itself entirely with green suites, which
is what this phase did eighteen times.

Fifteen of the seventeen SBR files already had one. **SBR-003 and SBR-012 did not** and now do.
⚠️ Both were added as UNNUMBERED blocks: `SBR-003 §2` is cited from SBR-004 and `SBR-012 §1–§4`
from `sbr012RawColourGate.test.ts` and `TASKS.md`, so renumbering would have broken live
references. A spec asserts all seventeen comply, with a cardinality check in front of the loop.

### What landed, by seam

| seam | who reads it | change |
|---|---|---|
| `noodl-mcp/src/instructions.ts` | every MCP session, at `initialize` | THE ORDER now leads with the look and the screen list; six characters cheaper |
| `prompts/design.ts` → `DESIGN_DOCTRINE_MD` | an external agent, via `get_project_info` | new §"The order", with the tools, the door, the why, and the person sentence |
| `prompts/design.ts` → `DESIGN_PLANNING` | the in-editor planner | already had it; strengthened to name the screen list |
| `prompts/decomposition.ts` → `_DOCTRINE_MD` | an external agent, via `get_project_info` | opens with the order |
| `prompts/decomposition.ts` → `_PLANNING` | the in-editor planner | opens with the order |
| `prompts/decomposition.ts` → `_AUTHORING` | every authoring turn | the half a leaf can act on: THE LOOK IS NOT YOURS TO INVENT |
| `noodl-mcp/src/lessons/authoringBrief.ts` | a model writing a lesson's solution | build the solution in the app order |
| `dev-docs/TASK-TEMPLATE.md` | whoever writes the next task | the person sentence, required |

**Not done, and deliberately:** no tool DESCRIPTION was widened. A description is billed wherever
the tool is listed and there are 7 tokens of headroom; `create_plan`'s description still describes a
plan without mentioning what must precede one. Registered as
[D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48).
