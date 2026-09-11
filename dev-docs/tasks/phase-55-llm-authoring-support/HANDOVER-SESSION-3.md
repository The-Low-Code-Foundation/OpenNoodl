# Phase 55 — the handover prompt for session 3

Paste the block below into a fresh session. Written to be read cold, by a model that has seen
neither phase 54 nor sessions 1–2.

---

You are continuing **Phase 55 — Any LLM can build in NodeGX**. Read
`dev-docs/tasks/phase-55-llm-authoring-support/README.md` and `TASKS.md` first, then
`dev-docs/best-practices/` — especially `05-WORKED-EXAMPLE-STOREFRONT.md`, which is Richard's own
architecture for the app this phase is calibrated against.

**Your session is (3) of the six in TASKS.md §Order: LAS-005 — `render_report`, the feedback loop as
a tool.** It is starred, it is independent of everything else in the phase, and it is the task the
audit called the weak-model equalizer: *the strong model brings the instinct; the surface must bring
the eyes.*

## The phase's rule, which has now paid for itself eleven times

**Read the mechanism in source before trusting any stated fact — including facts stated by this
phase's own task documents.** Phase 54 opened on three wrong premises. Session 1 found three more.
Session 2 was handed a note saying "assume a seventh exists" and found **five**, every one of them
inside the task documents for the very tasks it was doing:

1. LAS-001 said "one new validator rule (`validation/rules/`)". It cannot be one — `NormNode`
   carries no `parameters`, and the check needs a project-wide index besides. It is a precondition.
2. LAS-001 said to enumerate "the built-ins every instance carries — `mounted` etc. — from source,
   not memory". There are none. `ComponentInstanceNode` extends `Node`, not a visual node.
3. LAS-001 §2's stated predicate for interface-less variance ("≥2 instances whose parameter **sets**
   differ") scores **zero** on haiku's four cards — they carry identical parameter names and four
   different products. The task's own headline case would have passed its own rule.
4. LAS-004 said `ecommerce-example`'s Home holds "3 trios". It holds 2; the third is in
   `SiteFooter`.
5. LAS-004's doctrine threshold of ~25 page nodes would have nagged a legitimately dense login form.
   The corpus knee is at 40, and the task's own text says the corpus wins.

So: assume a twelfth exists, and expect it in LAS-005's own file. Note that the failure cuts both
ways — LAS-003 told session 1 to put its checks in the value layer, it second-guessed the doc, and
the compiler proved the doc right. **Verify, then follow.**

## What sessions 1–2 closed — do not rebuild it

| Task | Commit | What landed |
|---|---|---|
| **LAS-008** | `57895017` | `DESIGN_AUTHORING` rewritten from Richard's §7; paragraph-scoped tripwire over the exported prompt constants |
| **LAS-002** | `69257e87` | `stage_plan_operation` + `apply_plan` return diagnostic **objects** in a `validation` block |
| **LAS-003** | `5a35a1f8`, `631ae6bc` | `layoutString` grammar (error), unsized decorated absolute box (warning), raw colour literal (warning) |
| **LAS-001** ⭐ | `1b9e344a` | the interface gate — 3 codes, all authored-blocking; found F8 |
| **LAS-004** | `d7e06c00` | `repeated-sibling-subtree` promoted to authored-blocking; `oversized-page` info at 40 nodes |

Audit register rows **F1, F2, F3, F6, F7 are closed**. **F5 is your LAS-005.** F9 is yours too, and
it is the most important thing in this document.

## ⚠️ F9 — your harness lies, and LAS-005 is where it gets fixed

LAS-005 §1 says to promote `measurements/measure-project.js` into `scripts/devtools/` and to keep
**composing** `render-from-disk.js` rather than forking its splicing logic. That is right. But
`render-from-disk.js` contains a wrong derivation, found while calibrating LAS-001:

> A component **input** is a port on a `Component Inputs`/`Component Outputs` node whose own `plug`
> contains `"output"`.

`componentmodel.getPorts()` reads `getPorts('output')` on the nodes carrying `haveComponentPorts`
and **republishes those as the component's inputs** — the inversion is real and it is what the
exporter writes and the runtime consumes. `render-from-disk.js` ignores plug entirely and forces
every `Component Inputs` port to `plug: 'input'`
([render-from-disk.js:110](../../../scripts/devtools/render-from-disk.js#L110)).

The consequence, measured: **`ecommerce-example` — phase 54's reference build, the prettiest page
this project has produced — has never worked in the editor.** All eleven of its `ProductCard`
"inputs" are declared `plug: "input"`, so they are component *outputs*: no instance can set them,
and the twelve connections drawn out of that node name an endpoint `getPorts('output')` never
returns, which `utils/exporter/util.ts` drops as unhealthy. It renders *only* under the harness that
rewrites the plug. The measuring instrument disagrees with the thing it measures.

**What this means for you, concretely:**

- Fix the derivation in `render-from-disk.js` as part of the promotion, or `render_report` will
  certify pages the editor cannot render — the exact failure class this phase exists to close.
- **When you fix it, `ecommerce-example` will start rendering as dead cards.** That is the truth
  arriving, not a regression you caused. Do not "fix" it by reverting the derivation. Say so
  plainly in the register, and consider whether repairing the fixture's plugs is in scope (it is a
  one-line-per-port edit to two projects, and `component-port-direction` now names every one).
- `phase55-replay-haiku` is **unaffected** by this — it declared its ports on a `Group`, so both
  derivations agree it has no interface. Your LAS-005 acceptance case is safe.
- There is a third reader with the same plug-blind bug: `explain/graph.ts::componentPorts` (F10,
  filed, deliberately untouched — its consumers describe a graph to a model rather than gate a
  write, and changing it changes what every explanation says). Do not widen into it without deciding
  that on purpose.

## Facts you will need for LAS-005

- **`measure-project.js` is 156 lines and hardcodes four things**, not the two §1 mentions:
  `REPO = '/Users/richardosborne/vscode_projects/OpenNoodl'` (an absolute path to Richard's
  machine), `SERVE_PORT = 8621`, `CDP_PORT = 9231`, and the Chrome binary at
  `/Applications/Google Chrome.app/...`. All four have to go before it is a repo script.
- **`render-from-disk.js`'s header is the map of traps** — six reverse-engineered export-contract
  facts (`componentIndex`, `rootComponent` as a NAME, the `routerIndex` shape, connections renamed
  `sourceId/sourcePort`, the interface lift, nested-not-flat children, tokens stamped by the editor
  and never the bundle). Read it before touching either script.
- **LAS-002 defined the response dialect and LAS-005 must not add a second.** `apply_plan` already
  returns `{ validation: { summary, diagnostics } }`, typed as the same `WriteValidationSummary` the
  author doors return, and omitted entirely when empty. §4's `render:` summary is a *sibling* block,
  not a second way to say the same thing.
- **The diagnostic set has grown by four codes** since the audit measured anything:
  `interfaceless-instance`, `instance-unknown-parameter`, `component-port-direction` (LAS-001, all
  authored-blocking) and `oversized-page` (LAS-004, info, never blocks). If `render_report`'s
  numbers overlap a diagnostic — dead-placeholder texts and `interfaceless-instance` are the same
  defect seen from two sides — say so in the report rather than inventing a second vocabulary.
- **`validate:project` runs rules ONLY** and has never applied the precondition checks (F14, filed
  in LAS-004's register). So every parameter-value and interface diagnostic is invisible to
  `validate_project` and `review_project` and reaches an agent only at a *write*. That is part of
  why a render report matters: it is the only whole-project truth an agent can ask for after the
  fact. Do not fix F14 inside LAS-005 — closing it adds ~15 error-severity classes across 119 corpus
  projects.
- **A corpus scan beats a hand inspection, and it must walk both corpora.** Legacy content is
  `project.json` with a nested `components[].graph.roots` tree; v2 is `components/*/nodes.json` with
  a flat array. Session 1's first scan read only legacy and reported 0 when the real hits were all
  in v2. Two working scanners now exist to copy from:
  `measurements/scan-interfaces.js` and `measurements/scan-page-size.js`.
- **Corpus sizes, measured 2026-08-08:** 107 legacy `project.json` + 12 v2 projects; 730 component
  instances carrying 810 parameters; 51 page components (median 6 nodes, max 83).
- **Calibrate before choosing a number.** It has changed a design in every session: LAS-003's
  unsized-box predicate went 151 hits → 29 once narrowed to *decorated* boxes; LAS-004's page
  threshold went from the doctrine's 25 to the corpus's 40. Record the numbers in the task's
  register.

## What LAS-005 depends on, and what depends on it

- **Independent.** Nothing in Tracks 1–3 blocks it and it blocks nothing except LAS-011's scoring.
- **LAS-007 will attach examples to rejections keyed on `code`.** If `render_report` grows its own
  finding codes, use the same `DiagnosticCode` vocabulary or explain in the module header why not.
- **§5 (the editor client) is explicitly descopable.** The task says so itself: if the AIX-008
  sandbox webview plumbing makes it a phase of its own, land the MCP + script halves and file the
  editor half as a register row **with its blocker named**. Do not hold the tool hostage. Anything
  filed-not-fixed gets a row.

## Gates for this session

`npm run catalog:examples`, `catalog:check`, `catalog:merge:check`, `typecheck:editor`, `npx jest`
in `packages/noodl-editor`, plus `npx jest` in `packages/noodl-mcp` (its suite is a gate).

**Compare the passing COUNT, not the colour.** At session-2 close:

- editor: **76 suites / 1029 specs** (74/1001 at session 1, 71/973 at phase-54 close)
- noodl-mcp: **20 suites / 208 specs** (19/200 at session 1)

`Tests: 0` is a compile failure, not a pass; only the `Jasmine:` line counts in the editor suite.
⚠️ `pr.yml` runs on push to `cline-dev` and `Lint` and `Test (editor)` are RED for pre-existing
reasons — check WHICH job before reading a red run as yours.

## Working habits that are not optional here

- **Write the check before the fix.** Six times across two sessions; each tripwire failed against
  the shipped code first, and the failure is recorded in the commit message. LAS-005's version of
  this is: **write the report, run it on `phase55-replay-haiku`, and confirm the numbers alone
  re-find all three defects the audit found by hand** — dead placeholder texts, the one-column grid,
  five broken images — *before* wiring the tool.
- **A graph is a claim, a render is evidence.** This whole task is that sentence.
- **Commit per slice**, and add the register rows in the same commit. Registers outlive their fixes.
- **Fixtures that teach a refused shape get corrected, not the gate weakened.** LAS-004's sweep
  found exactly one population and it was session 1's own specs, asserting that a door accepts a
  hand-laid trio. Corrected to pin the text arriving in the *rejection*.
- **Do not write to a project while a human has the editor open.** The editor holds the project in
  memory and pushes that to its preview; an MCP write reaches disk and is invisible to it.
- 🔴 **CORRECTED 2026-09-03 — the old wording of this bullet was WRONG, and it was relayed four times.**
  It said *"quitting the editor can flush its stale copy back over your work."* **A quit does not do
  that.** Driven in
  [REL-009 §2.1](../phase-82-0.2.2-the-first-row-on-the-shelf/REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md):
  on a v2 project the save is incremental and hash-baselined, so a real `app.quit()` with no pending
  human edit wrote **nothing at all** — 21/21 files byte-identical — and a component the human never
  touched is never in the change set. An MCP-**added** component survives, registry entry included.
  **The real exposure is narrower and it is about the COMPONENT, not the quit:** if the human edits
  *the same component* an agent wrote, the editor writes its whole in-memory copy over the file and
  the agent's change is gone — no conflict, no prompt, no diagnostic. The worst shape of it is a page
  the agent added being silently dropped from the router while its files and registry entry stay,
  so nothing on any surface looks wrong. ✅ **The practical rule is unchanged and the reason is now
  right: do not have both sides editing the same component. `render_report` is read-only and safe at
  any time, and an MCP write is still invisible to a running editor until the project is reopened.**
- Serialise register edits across parallel sessions — a pathspec commit can sweep a sibling's edit.

## Also live, in parallel

**LAS-010's model decision is settled** (recorded in the task file, 2026-08-08): hosted open-weight
via **DeepInfra**, not a local ollama pull. Richard's machine is a 16 GB M1 MacBook Air whose Metal
working set caps around 10.7 GB, and `qwen2.5-coder:32b` is ~20 GB at Q4. Richard supplies the API
key when that task runs — **do not ask for it before then, never commit it, read it from the
environment.** The matrix row must say "open weights, hosted (DeepInfra)".

## The bar

Richard's, unchanged since phase 40: *"legendary creations rivaling the best Opus landing page
artifacts."* Phase 55 adds the harder half — **the same architecture from a model that is not
Opus.** If a weak model produces a well-architected app with mediocre spacing, this phase succeeded.
If a strong model produces a beautiful 66-node page, it did not.

Tracks 1 and 3 are done: the gates now refuse the four shapes that shipped dead pages, and they
speak in sentences a repair round can act on. **What no gate can do is look.** Sonnet improvised
80% of a verification loop through sandboxed Bash, curl-verified sixteen image URLs, and still
shipped a photograph of a motorcycle for a bud vase — because HTTP 200 is not looking. Haiku
improvised nothing at all. That is your session.
