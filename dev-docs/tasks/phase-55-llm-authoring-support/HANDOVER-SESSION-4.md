# Phase 55 — the handover prompt for session 4

Paste the block below into a fresh session. Written to be read cold, by a model that has seen
neither phase 54 nor sessions 1–3.

---

You are continuing **Phase 55 — Any LLM can build in NodeGX**. Read
`dev-docs/tasks/phase-55-llm-authoring-support/README.md` and `TASKS.md` first, then
`dev-docs/best-practices/` — especially `05-WORKED-EXAMPLE-STOREFRONT.md`, which is Richard's own
architecture for the app this phase is calibrated against.

**Your session is (4) of the six in TASKS.md §Order: LAS-006 (structured plans) + LAS-007 (push
retrieval).** LAS-006 §3 needs LAS-001, which is done. LAS-007 attaches examples to the rejections
Tracks 1 and 3 now produce — all of which exist.

## The phase's rule, which has now paid for itself fourteen times

**Read the mechanism in source before trusting any stated fact — including facts stated by this
phase's own task documents, and including facts stated by this handover.** Phase 54 opened on three
wrong premises. Session 1 found three more. Session 2 was told "assume a seventh exists" and found
five. Session 3 was told "assume a twelfth exists, and expect it in LAS-005's own file" — and found
it in the *handover*, which is worse, because a handover reads as settled fact rather than as a
plan:

> **F15.** The session-3 handover said `ecommerce-example` "renders *only* under the harness that
> rewrites the plug" and that fixing the plug derivation would make it "start rendering as dead
> cards". Both false. A/B measured — old derivation vs new, same Chrome, same project —
> **byte-identical**: 49 text leaves, 4 images, 0 broken, 2373px. `ProductCard` is never
> instantiated anywhere; its only reference in the whole project is a `For Each`'s `template`
> parameter. The fix was still right and still landed. Its measured blast radius across all three
> builds was **zero**.

The lesson is not "handovers lie". It is that a claim about *consequences* is a different kind of
claim from a claim about *mechanism*, and the second one being verified does not carry the first.
F9's mechanism (the plug inversion) was exactly right and documented from source. What nobody had
done was render the project both ways and diff the numbers. That took four minutes.

So: assume a fifteenth exists. **The cheapest check that would have caught eleven of the fourteen is
running the thing and comparing two numbers.**

## What sessions 1–3 closed — do not rebuild it

| Task | Commit | What landed |
|---|---|---|
| **LAS-008** | `57895017` | `DESIGN_AUTHORING` rewritten from Richard's §7; paragraph-scoped tripwire over the exported prompt constants |
| **LAS-002** | `69257e87` | `stage_plan_operation` + `apply_plan` return diagnostic **objects** in a `validation` block |
| **LAS-003** | `5a35a1f8`, `631ae6bc` | `layoutString` grammar (error), unsized decorated absolute box (warning), raw colour literal (warning) |
| **LAS-001** ⭐ | `1b9e344a` | the interface gate — 3 codes, all authored-blocking; found F8 |
| **LAS-004** | `d7e06c00` | `repeated-sibling-subtree` promoted to authored-blocking; `oversized-page` info at 40 nodes |
| **LAS-005** ⭐ | `9c3e3ce7`, `a4d204b9`, `464c5cd3` | `render_report` — the eyes. Plus the harness's own two lies, fixed |

Audit register rows **F1, F2, F3, F5, F6, F7, F9 are closed.** Open: **F10** (a third plug-blind
reader in `explain/graph.ts`, deliberately untouched), **F14** (`validate:project` runs rules only),
**F16** (`ecommerce-example`'s empty product band), **F21** (`noodl-mcp`'s red unwatched `tsc`),
**F22** (LAS-005 §5, the editor client).

## What you now have that sessions 1–3 did not: eyes

`render_report` is on the MCP surface, read-only and registered unconditionally. It renders the
project headless in ~7.7 s and returns the numeric report **and** each viewport's full-page
screenshot as MCP image content.

```
npm run render:report -- "<project-dir>"                   # human-readable
node scripts/devtools/measure-from-disk.js <dir> --json     # the whole report
node scripts/devtools/render-from-disk.js <dir> --print-project   # the reconstructed export, no browser
```

Measured on the three calibration builds, and these numbers are pinned in
`packages/noodl-mcp/tests/renderReportModule.test.ts` against recorded fixtures, so if you change a
threshold the specs will tell you which build you broke:

| Build | errors | warnings | what it said |
|---|---|---|---|
| `phase55-replay-haiku` | 4 | 3 | 29× "Text", 5/5 images broken, a 4-item Columns grid one column wide, a 768px floor |
| `phase55-replay-sonnet` | 0 | 0 | clean; one info observation |
| `ecommerce-example` | 0 | 1 | will not collapse below 525px |

**Use it on your own work.** LAS-006 and LAS-007 both change what gets built; a before/after render
report is now the cheapest evidence in this repo that a change helped.

⚠️ Two things about it that will otherwise bite you:

- **`apply_plan` renders by default** whenever a plan wrote anything visual (~8 s). The jest suite
  turns this off in `tests/setupEnv.js` (`NODEGX_RENDER_DISABLED=1`). If you add a plan spec that
  suddenly takes eight seconds, that is why.
- **`render-from-disk.js` no longer probes a running editor for design tokens** unless you pass
  `--editor-tokens` (F17). It used to, unconditionally, and the editor serves the tokens of
  whatever project **it** has open — which is why the audit's own `measurements/haiku-full.png` is
  in `ecommerce-example`'s terracotta while the replay project carries no `metadata` at all. Every
  colour judgement made from that image was made about the wrong palette.

## Facts you will need for LAS-006 and LAS-007

- **The diagnostic vocabulary is now eight codes larger than the audit measured.** LAS-001 added
  `interfaceless-instance`, `instance-unknown-parameter`, `component-port-direction` (all
  authored-blocking); LAS-003 added the `layoutString` grammar error plus two warnings; LAS-004
  added `oversized-page` (info). LAS-007's example table must cover the new ones, not the audit's
  list.
- **Render findings are a separate vocabulary on purpose**, and it is written down in
  `render-report.js`'s header: `dead-placeholder-text`, `broken-image`, `single-column-grid`,
  `minimum-layout-width`, `horizontal-overflow`, `flat-type-scale`, `empty-decorated-box`,
  `blank-render`, `console-error`. Where one describes the same defect as a `DiagnosticCode`, the
  finding carries `relatedDiagnostic` — `dead-placeholder-text` names `interfaceless-instance`.
  Key LAS-007 on that field, not on a third list.
- **`validate:project` runs rules ONLY** (F14). Every parameter-value and interface diagnostic is
  invisible to `validate_project` and `review_project` and reaches an agent only at a *write*. Do
  not fix it inside LAS-006/007: closing it adds ~15 error-severity classes across 119 corpus
  projects.
- **A corpus scan must walk both corpora.** Legacy is `project.json` with a nested
  `components[].graph.roots` tree; v2 is `components/*/nodes.json` with a flat array. Session 1's
  first scan read only legacy and reported 0 when every real hit was in v2. Copy from
  `measurements/scan-interfaces.js` or `scan-page-size.js`.
- **Corpus sizes, measured 2026-08-08:** 107 legacy `project.json` + 12 v2; 730 component instances
  carrying 810 parameters; 51 page components (median 6 nodes, max 83).
- **Calibrate before choosing a number, and record the calibration.** It has changed a design in
  every session: LAS-003's unsized-box predicate 151 hits → 29 once narrowed to *decorated* boxes;
  LAS-004's page threshold from the doctrine's 25 to the corpus's 40; LAS-005's grid rule from 9
  false positives across two good builds down to 0 (F18).
- **`ecommerce-example` is not a clean example to copy from** (F16). Its featured-products band
  renders its eyebrow, heading and blurb and then **nothing**: the `For Each` is fed by a
  `DbCollection2` over collection `Product` and the project has no `cloudservices` at all. Two
  phases of screenshots missed it because the reference shot is viewport-only and stops one band
  above the gap.

## Gates for this session

`npm run catalog:examples`, `catalog:check`, `catalog:merge:check`, `typecheck:editor`, `npx jest`
in `packages/noodl-editor`, plus `npx jest` in `packages/noodl-mcp` (its suite is a gate).

**Compare the passing COUNT, not the colour.** At session-3 close:

- editor: **76 suites / 1029 specs** (unchanged by LAS-005, which touched no editor code)
- noodl-mcp: **22 suites / 230 specs** (20/208 at session 2, 19/200 at session 1)

`Tests: 0` is a compile failure, not a pass; only the `Jasmine:` line counts in the editor suite.
⚠️ `packages/noodl-mcp`'s own `tsc --noEmit` is **red with 6 pre-existing errors** in session-2 test
files (F21) — `src/` is clean, and `jest.config.js` sets `diagnostics: false` so the suite never
sees them. It is not a gate today. Do not read it as yours.
⚠️ `pr.yml` runs on push to `cline-dev` and `Lint` and `Test (editor)` are RED for pre-existing
reasons — check WHICH job before reading a red run as yours.

## Working habits that are not optional here

- **Write the check before the fix.** Nine times across three sessions. LAS-005's version caught a
  defect in its own code before it shipped: `resolveRenderCli` had copied `resolveServiceEntry`'s
  fall-through, so an explicit `NODEGX_RENDER_CLI` pointing at nothing quietly reverted to
  auto-discovery — and in a checkout that fallback *exists*, so the spec meaning "no harness
  installed" spawned a real Chrome and timed out (F20).
- **A graph is a claim, a render is evidence.** You can now act on that sentence.
- **Measure the consequence, not just the mechanism** (F15). If a change is supposed to alter
  behaviour, run it both ways and diff the numbers before writing that it did.
- **Commit per slice**, and add the register rows in the same commit.
- **Fixtures that teach a refused shape get corrected, not the gate weakened.**
- **Do not write to a project while a human has the editor open.** The editor holds the project in
  memory and pushes that to its preview; an MCP write reaches disk and is invisible to it, and
  quitting the editor can flush its stale copy back over your work. `render_report` is read-only
  and safe at any time.
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

Tracks 1 and 3 refuse the four shapes that shipped dead pages. Track 2 now lets an agent look at
what it built. What is left is the ordering problem: haiku planned correctly and then built
something its plan never described, because the plan was prose and prose does not line up. That is
LAS-006. And it never once retrieved a recipe it was told existed, because retrieval advice does
nothing and attachment does. That is LAS-007. **Your session is the one that makes the right order
the easy order.**
