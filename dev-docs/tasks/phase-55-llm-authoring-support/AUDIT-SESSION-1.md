# Phase 55 — the audit, session 1

**Date:** 2026-08-08. **Status:** evidence gathered and classified; no design proposed beyond what
the evidence forces. Written against README §"The audit" questions A–E.

Everything below was verified in source or measured in a rendered DOM this session. Where a stated
fact from the handover turned out wrong, it has its own section, because the handover predicted it
would.

## Instruments built or used this session

| Instrument | What it does | Cost |
|---|---|---|
| `STOREFRONT-BRIEF.md` | The canonical brief — phase 54 never recorded one; "replay the brief" was an instruction with no fixture. Includes the cold-replay protocol and scoring table | new |
| Cold replay rig | `create_project` → fresh dir → `noodl-mcp --allow-writes` → headless `claude -p --strict-mcp-config --allowedTools "mcp__nodegx__*"`, full stream-json transcript | ~$0.50 and ~5 min per mid-tier run |
| `measure-project.js` (scratchpad, promote it) | `render-from-disk.js` + headless Chrome over CDP: renders any v2 project, measures the DOM at 1280×900 and 390×844 (device emulation — Chrome refuses real windows under ~500px), screenshots both | **7.5 s cold**, ~180 lines |

## A. Where exactly does it go wrong — measured

### The baseline, re-measured (Opus + heavy operator scaffolding, phase 54)

`ecommerce-example`: 5 components; `Pages/Home` = **66 nodes** (30 Group + 22 Text inlined), **1
connection**, **zero `Columns`**. `validate:project`: 3 `repeated-sibling-subtree` warnings — the
gate *diagnosed the exact failure* and nothing surfaced it. Rendered: desktop clean (4 font
weights, 0 overflow); at 390px the layout viewport is forced to **525px** — the page physically
cannot collapse, the zero-`Columns` signature.

### Cold replay, mid-tier hosted model (claude-haiku-4.5, this session)

42 turns, $0.53, 4.5 min, ran to completion unassisted. Result:

**The architecture came out RIGHT.** First `create_plan`: Header, Hero, InfoStrip, ProductCard,
FeaturedProducts, CategoryCard, BrowseCategories, Footer, page — a proper decomposition, produced
*before any nodes*, directly from `get_project_info.authoringDoctrine`. Final shape: 9 components,
`Pages/Home` = **7 nodes / 6 instances** (the best-practices ideal), ProductCard instantiated ×4
with per-instance parameters, `Columns` used for both grids, 0 validation errors, 2
`repeated-sibling-subtree` warnings (InfoStrip trio, Footer link columns).

**And the page renders as a corpse.** Full-page screenshot: header, hero, info strip and footer are
real; **every product card and every category card renders literal "Text" placeholders.** Cause
chain, all invisible to every gate:

1. ProductCard/CategoryCard have **no `Component Inputs` node** — the model set per-instance
   parameters (`name`, `price`, `image`…) on interfaces it *believed* into existence.
2. **Nothing validates instance parameters against the component's actual interface.** 0 errors
   reported. (AIB-010's family: a name-typed parameter is never checked for resolving.)
3. `layoutString: "1fr 1fr 1fr 1fr"` — CSS Grid dialect; the runtime silently fails to parse it
   and renders **one column even at desktop**. No value-format check exists.
4. All 5 image URLs were invented Unsplash IDs; all 404. (Doctrine §5 said "an unverified image
   URL is an unchecked claim" — prose, unenforced, unfollowable anyway: no MCP tool can look.)
5. At phone width the layout viewport is forced to 768px (something carries a fixed min width) —
   overflow despite the `Columns` nodes.
6. **Zero connections in the whole project.** No click signals, no navigation, no hover beyond
   defaults — the brief's "when clicked it should go somewhere" clause simply dropped.

**Transcript facts that decide the fixes:** haiku read the doctrine (its plan proves it) but
**never called `list_examples`, `get_example`, or any project doc**. The recipes that show the
Component-Inputs-plus-instance pattern exist and were never retrieved. It also burned ~7 of 42
turns on parameter-encoding rejections (`"100%"` string vs `{value, unit}`, string `iconSize`,
invented `flexGrow` port) — the write-gate caught all of those and its diagnostics ("did you mean
`flexWrap`?") let a mid-tier model self-correct. **The gate that exists worked; the failures that
shipped are exactly the gates that don't exist.**

### Cold replay, strong hosted model (claude-sonnet-5, same protocol)

147 turns (grazed the 150 cap), $7.86, 22 min. Result: **the closest thing yet to the phase-40
bar, cold, with no operator.**

- **17 components, 8 pages.** Home = 8 nodes / 6 instances. It built the whole nav out — every
  destination page exists, sharing one parameterised `ComingSoon` section — so every click goes
  somewhere real. 102 connection endpoints; click signals as Component Outputs.
- **It found `Static Data`** (the primitive "nobody finds") via `get_example`, and drove the
  product grid For Each from a 6-row array with per-row `bestseller`/`compareAtPrice`/`reviews` —
  struck-through was-prices and "No reviews yet" all data-driven, exactly best-practices 02.
- **Real `Component Inputs`** on Product Card, Category Card, ComingSoon. The interface mechanism
  haiku missed entirely, sonnet used correctly — after ~75 tool calls of reading examples, node
  types and project docs before planning anything.
- `validate:project`: 0 errors, **1 warning** — the InfoStrip quartet is four identical sibling
  subtrees (the same rule, still only whispering).
- Rendered: 4 weights, 8 sizes, real photography, real copy ("thrown, glazed and fired in our
  Bristol studio"). **At 390px: zero overflow, scrollWidth = 390, the page genuinely reflows**
  (height 3777 → 6482) — achieved with *zero `Columns` nodes*, via fixed/percentage-width cards in
  wrapped rows. It works, but it is the fragile desktop-trick shape the doctrine warns about, and
  it collapses by luck of the chosen widths rather than by construction.
- **Two systematic defects a render report would have caught in seconds:** (1) every badge pill is
  a `position: absolute` Group with **no width/height** — Group dimensions default to `%`, so each
  pill fills its parent: giant `--primary` ellipses over 4 of 6 product photos, and the basket
  count stretched across the full navbar. (2) Two verified-200 images are the **wrong subject** —
  a motorcycle for "Turned Oak Bud Vase", gold bullion for the "Home" category.

**Methodological note, and what it proves:** the rig's allowlist did not block sandboxed read-only
Bash, and sonnet exploited it — it **curl-verified all 16 image URLs** (re-picking the 404s) and
verified every icon name against the CDN. Haiku tried Bash once, was rebuffed, never returned. So
the verification *instinct* exists in the strong model with no tool support — it verified the one
thing HTTP can say (status 200) and still shipped a motorcycle, because nothing on any surface
lets an agent LOOK at what it built. The strong model improvises 80% of a feedback loop; the
mid-tier model improvises none of it. That asymmetry is F5's entire case.

### Open-weight model — honest gap

Not run. What exists today: ollama is installed with only `llama3.2:3b` (22 months old, below
mid-tier); the editor's provider layer already speaks ollama and any OpenAI-compatible endpoint
zero-code (`providers/ollama.ts`, 322 lines, tested; `openai-compatible` + `baseUrl`), and
`models.ts` accepts unregistered model ids permissively. **But no MCP-capable client for an
open-weight model exists on this machine** — the cold-replay rig runs on `claude` CLI, and the
phase-15 headless harnesses (`aix002-measure`, `aix15-live`, which do take `--provider=ollama`)
drive the *in-editor* loop, are phase-15 vintage, and likely need build repair. Recipe for the next
session: `ollama pull qwen2.5-coder:32b` (~20 GB — ask Richard first), then either repair
`aix15-live` or write a ~200-line ollama-MCP driver.

### The failure classification (README §A taxonomy)

| Failure | Class | Evidence | The fix class |
|---|---|---|---|
| No `Component Inputs` on a component instantiated with varying parameters | **knowledge + missing gate** | haiku, above | a validator rule (see C) — this is the highest-value single gate the phase can add |
| Instance parameters naming nonexistent interface ports pass silently | **seam/gate** | `validate:project` = 0 errors on a project whose cards are all dead | same rule, other half |
| `layoutString` in CSS dialect parses to nothing | **knowledge + missing value check** | `"1fr 1fr 1fr 1fr"` → one column | value-format check on one parameter |
| Invented image URLs | **knowledge + unfollowable doctrine** | 5/5 broken | the render→measure loop (E) is the only honest check |
| No connections/signals at all | **capability or ordering** — plan intents never mentioned interaction, so authoring turns never built it | 0 endpoints checked | plan-shape: an operation intent that must state inputs/outputs (the planning doctrine asks; nothing checks) |
| Repeated trios inside InfoStrip/Footer | **ordering, caught late** | 2 warnings post-apply; during staging the agent saw `warnings: 1` with **no text** (phase-54 F6, confirmed at [planTools.ts:504](../../../packages/noodl-mcp/src/tools/planTools.ts#L504)) | surface warning text at staging |
| Encoding retries (`"100%"`, `flexGrow`) | **knowledge, self-corrected** | 7 turns of rejection→fix | working as designed; cheaper if the node schema carried encodings inline |
| 66-node inlined page | **ordering** (the baseline's failure, absent from both cold replays that used `create_plan`) | baseline vs replays | the plan step, when taken, fixes the order — see B |

**The one-sentence verdict for §A:** with the doctrine readable and the plan tools used, *ordering
is no longer the dominant failure* — the dominant failures are (1) the interface mechanism
(`Component Inputs`) being both unknown and unvalidated, and (2) everything interactive being
optional prose that a cold model drops first.

## B. What the tool surface makes easy and hard — verified in source

- **88 tools** on a write-mode server; ~50 are backend admin. No progressive disclosure. A model
  must find the 8 that matter.
- The server `instructions` prescribe: read pattern → `get_node_type` → `get_style_vocabulary` →
  `create_component`. **Decomposition appears nowhere in the instructions**; plans are introduced
  as a staging mechanism ("nothing touches disk until the one apply"), not as the required first
  artefact. `create_component` — the bag-of-nodes door — is always open and is the first authoring
  tool named.
- `create_plan` is the nearest thing to a "declare the tree" step and it worked (both cold replays
  used it unprompted — the doctrine text sold it). But it is **flat** (no parent/child, no "what
  repeats", no interface fields — just kind/target/intent prose), **optional**, and a plan of one
  66-node page operation validates fine.
- Doctrine delivery: ~13k chars of markdown inside the `get_project_info` JSON response, once,
  write-mode only. It demonstrably works when read (haiku's plan) — and nothing re-surfaces it at
  the moment of authoring a specific operation.
- The blocking set (`AUTHORED_BLOCKING_WARNINGS`,
  [authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149))
  is `UnknownParameter`, `UnitlessDimension`, `UnresolvedNavigation`, `PageWithoutPageNode` — all
  wiring-level. `RepeatedSiblingSubtree` never blocks anything, and through the plan door its text
  is invisible (F6). **The only architecture gate in the system is advisory through every door and
  mute through the main one.**
- **No render/measure/screenshot tool exists on the MCP surface.** Doctrine §11 ("you have not
  finished until you have looked at it") is *unfollowable* for an external agent. The loop that
  found every real defect in phase 54 is not reachable from the surface agents actually use.

## C. Prompt → structure inventory (structure > gate > example > prose)

| Doctrine rule | Enforcement today | Could be |
|---|---|---|
| Components first / tree before nodes | prose + optional `create_plan` | **structure**: plan-first (write doors require a plan or a declared exemption), plan gains `children`/`repeats`/`inputs`/`outputs` fields |
| Never three siblings | warning, non-blocking, text invisible at staging | **gate**: block authored output like the other four; fix F6 so staging returns diagnostics |
| Instance params must match the component interface | **nothing** | **gate** — the missing rule this session found; also the inverse: instantiated-with-varying-params ⇒ must have Component Inputs |
| `layoutString` format | nothing | **value check** (phase 38's "nothing validates parameter VALUES" still has this hole) |
| Multi-column must be `Columns` | prose | **gate**: a row Group with ≥3 visual children and no Columns ancestor → warning (README candidate 6) |
| Page ≤ ~25 nodes | prose | **gate**: page component over N nodes → warning |
| Interactive ⇒ hover + signal | prose (best-practices 03) | **gate** (interactive node, no hover state, no output signal) + **example** auto-attached |
| Tokens not raw hex | prose | **gate**: trivial regex on colour-typed parameters |
| Images: real box + real URL | prose; URL truth is unfollowable | **loop**: the E instrument; a `render_report` MCP tool |
| ≥3 font weights, one accent, bands/shell | prose | **loop**: measurable in the DOM report, not statically |
| Real copy, empty states | prose | stays prose (taste) — acceptable |
| Encoding rules (`{value,unit}` etc.) | gate (works — measured self-correction) | cheaper: put encoding in the node schema the model reads |

## D. What a weak model needs that a strong one does not — from transcripts

1. **Push, not pull.** Haiku read what was pushed (doctrine in `get_project_info`) and acted on it
   correctly; it retrieved nothing optional (`list_examples`, docs) even when stuck. Sonnet
   retrieved everything. Auto-attaching the relevant `ui-*` recipe to a staging rejection or to
   `get_node_type` output is worth more than any amount of "call get_example" advice.
2. **Rejections with fixes work at mid-tier.** Every hard rejection with a "did you mean" was
   self-corrected. The failures that shipped are the ones nothing rejected. More gates, not more
   prose.
3. **Structured fields beat prose intents.** The plan's `intent` strings never mentioned
   interfaces, so no downstream turn built them. A plan schema with required `inputs`/`outputs`/
   `repeats` per operation converts doctrine into form-filling — the thing weak models do well.
4. **Turn economy matters.** 7/42 turns on encoding retries; a weak model with a smaller budget
   dies there. (Sonnet's opposite failure mode: 72+ calls of exploration before any plan.)

## E. The feedback loop — costed

`measure-project.js`: **7.5 s cold** per project for serve + boot + two viewports + screenshots +
the numeric report (overflow, min layout width, weights, sizes, broken images, empty boxes). The
loop that found every phase-54 defect is a **sub-10-second, ~180-line, zero-LLM** operation. There
is no reason it cannot run: (a) as an MCP tool (`render_report`) so agents can obey §11, (b) after
every `apply_plan` automatically, (c) in CI over the example projects. Promote the script from
scratchpad into `scripts/devtools/`, parameterise ports, and it is done.

## The predicted "fourth wrong premise" — found, twice

1. **"Phase 40 built a Strands TS harness."** It did not. AAQ-006 is `Status: open`; no strands
   dependency exists anywhere; the memory index's phrasing ("Strands TS harness, one substrate")
   records a *decision*, not a build. What exists: phase-15 headless harnesses (provider-pluggable,
   incl. ollama, likely build-rotted) and the phase-38/40 scripted no-provider CDP drivers.
2. **The per-turn `DESIGN_AUTHORING` preamble still teaches the wrapped-row percentage-width
   pattern** ([design.ts:246-252](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts#L246))
   with no mention of `Columns` — the exact guidance HANDOVER premise 3 says was caught and
   corrected in §7/§8. It ships in every in-editor authoring turn via
   [authoring.ts:164](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/authoring.ts#L164).

## Verdicts on the README's seven candidate directions

| # | Direction | Verdict from evidence |
|---|---|---|
| 1 | Scaffolding step before authoring | **Yes, strengthened not invented**: `create_plan` already carries the behaviour; make it structured (interfaces, repeats) and make the direct doors ask for it |
| 2 | Starter architectures | Defer — both cold replays decomposed fine from doctrine alone; skeletons solve a problem the evidence no longer shows |
| 3 | Component-tree critic | Partially subsumed by gates; a cheap static critic at `create_plan` time (one giant op, no repeats declared) is worth it; an LLM critic is not yet justified |
| 4 | Progressive disclosure of the catalog | Mild yes for weak models (88 tools, 175 types), but no replay failure traces to catalog overload; low priority |
| 5 | Retrieval instead of recall | **Yes — the clearest weak-model finding.** Auto-attach recipes to rejections and `get_node_type` |
| 6 | More gates | **Yes — the single highest-value track.** Priority order from measured failures: instance-params-vs-interface, layoutString format, warning text at staging (F6), multi-column-Group, raw hex, interactive-without-signal, page size |
| 7 | Smaller authoring vocabulary | No evidence it invites flat graphs; the vocabulary was not the failure. Drop |

## Richard's addition (this session): design/plan/act per-role model choice

Requested mid-session: let the user map models to the design, plan and act steps, as modern tools
do. **The seam already exists and is unused:** every `AiChatRequest` honours an explicit `model`
([AiClient.ts:157-160](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L157))
and `getProvider(providerId)` takes an override
([AiClient.ts:135](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L135));
no session passes either today, so everything rides the one global pair. The feature is: three
settings keys (`ai.model.role.design|plan|act`, falling back to the global), the scoping/planning/
authoring sessions each passing theirs, and one settings-panel row. Cross-provider mixing (Opus
plans, local qwen acts) is *mostly* plumbed via the provider override; credentials per provider
already exist.

One caution the replay data adds: the intuitive mapping (strong=design, weak=act) may be backwards
— planning was the step haiku did *well*; acting (encoding, interfaces, wiring) is where it needed
either strength or better structure. Ship the control, let the benchmark decide the default.

## Register

| # | Finding | State |
|---|---|---|
| F1 | `DESIGN_AUTHORING` per-turn preamble teaches the deprecated wrapped-row pattern, no `Columns` | 🔴 OPEN — one-paragraph fix in `design.ts` |
| F2 | Instance parameters against a component with no/mismatched interface: **no check anywhere**; renders as dead "Text" placeholders with 0 errors | 🔴 OPEN — the highest-value gate found this session |
| F3 | `layoutString` value format unvalidated; CSS dialect silently renders one column | 🔴 OPEN |
| F4 | "Strands TS harness" never existed (AAQ-006 open); memory phrasing misleads | 🟠 documented here; fix the memory |
| F5 | No render/measure on the MCP surface; doctrine §11 unfollowable externally | 🔴 OPEN — promote `measure-project.js`, add `render_report` |
| F6 | (phase-54 F6, re-confirmed) staging returns warning counts, no text | 🔴 still OPEN |
| F7 | An absolutely-positioned Group with no explicit size fills its parent (dimensions default to `%`) — the badge-pill trap; rendered giant accent ellipses over 4/6 product photos and a full-navbar basket count in the sonnet replay, prose-only today | 🔴 OPEN — candidate gate: absolute Group without explicit width/height |
