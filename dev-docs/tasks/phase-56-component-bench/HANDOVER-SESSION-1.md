# Phase 56 — handover after session 1 (2026-08-08)

**What ran:** BEN-006 §1–§6 and BEN-001, in that order (the order [TASKS.md](TASKS.md) suggested, and
it was the right one). **Nothing was driven in a live editor.** Everything below is a spec claim or a
typecheck claim; say so wherever you repeat it.

## What is on the branch

| Commit | What |
|---|---|
| `11909429` | the phase-56 task docs, committed unchanged — they arrived untracked from a parallel session |
| `67111552` | **BEN-006/1** — `userData`, the fourth data source, in `buildSandboxDataset` |
| `1dfa9803` | **BEN-001** — `componentBench.ts`, the synthetic harness |
| `b1ae9e82` | **BEN-006/2** — the Data panel + `sandboxDataDraft.ts` |
| (this one) | the plug-inversion fix + the corrections it forced into two task files |

## The finding that matters most

**The plug inversion is two inversions, and BEN-001 §2 and BEN-002 both describe one of them.**
Register **B5**.

1. A port **declared** on a `Component Inputs` node carries `plug: 'output'`. That is LAS-001, that is
   phase-55 F8/F23, and it is true.
2. `ComponentModel.getPorts()` then **republishes** it as `plug: 'input'`, because to an *instance* of
   the component it is an input.

Both task files say a component input is `plug: 'output'` **as `getPorts()` returns it**, which is
false. The first implementation followed them and shipped an inputs rail that came back empty while
the outputs rail filled up with the things you are meant to type into — 6 red specs, and the only
reason they were red is that the specs asserted against a real corpus component rather than against
the doc.

The runtime settles it and is the citation to use:
[`noodl-runtime/src/models/componentmodel.ts:478`](../../../packages/noodl-runtime/src/models/componentmodel.ts#L478)
reads the exported `ports` array — which is `getPorts()` verbatim — and calls `addInputPort` for
`plug === 'input'`. The fixture agrees: `Share Item` declares `Icon Src Set`/`Label` as `output` on
its Component Inputs node and `Click` as `input` on its Component Outputs node; `getPorts()` returns
the first two as `'input'` and `Click` as `'output'`.

**Anything else in this phase that reasons about `plug` must say which end it means.** BEN-002's rail
should not re-derive this at all — call `benchInterface()`, which is the only place that has to know.

## What each task actually has

### BEN-006 — 🟡 built end to end, driven nowhere

`buildSandboxDataset` gains `userData`, layered above the agent's `sample_data`, **per class**.
Within a class it replaces rather than merges. Three things worth knowing before you change it:

- an **agent** shipping `[]` still gets five synthesized rows (it has told us nothing); a **user**
  deleting every row gets zero. The empty state has never been previewable in this product.
- fields the user left out are still completed — a half-blank row is worse — but
  `SandboxClass.completed` names them so the panel can say which values are theirs.
- the toolbar summary marks overridden counts `(yours)`.

A spec pins that an absent `userData` produces a **byte-identical** dataset, with and without agent
data. This is additive exactly as the code scan was.

The panel (`SandboxDataEditor.tsx`) is behind a **Data** button gated the same way `Sign out` is. Its
value rules live in `sandboxDataDraft.ts` with 12 specs, deliberately outside the React: a rule about
values that only a driver can check is a rule that does not get checked.

**Every Live criterion in BEN-006 is open.** Nobody has clicked Apply.

### BEN-001 — 🟡 mechanism built, both Live criteria open

`buildBenchExport` gives a root-mounted component a parent, so its `Component Inputs` ports have a
source for the first time. The parameter set is built from the interface; a key naming no declared
input is dropped and named in the summary. A logic-only component mounts instead of being refused.
19 specs, including one pinning that `ProjectModel` is byte-identical after a build.

**§3's Group-wrapper frame was deliberately not built** — register **B3**. The frame is the size of
the surface, not a Group injected into the graph, because `sizeMode` silently voids `width`/`height`
and an unsized absolute Group fills its parent. `frame`/`stretch` ride out on the result for BEN-004
to apply. **Nothing about `stretch`'s rendered behaviour has been measured.**

## Gates

- `npx jest` in `noodl-editor` (tests-main + tests-unit): **80 suites, 1085 tests, all passing.**
  Compare the count, not the summary — a suite that will not compile reports `Tests: 0`.
- `npm run test:ci` (jasmine/Electron): see the table below. **Only the `Jasmine:` line counts.**
- `typecheck:editor`, `typecheck:editor-tests`, `typecheck:runtime`: clean.
- `eslint` on every new source file: clean.
- `catalog:examples` not run — nothing under `docs/node-catalog/` was touched.

| Run | `Jasmine:` line | Mine | Not mine |
|---|---|---|---|
| before the plug fix | `2455 specs, 12 failures` | **6**, all `BEN-001` | 6 |
| after the plug fix | `2466 specs, 6 failures` | **0** | 6 |

48 `BEN-*` specs ran in the second run and all 48 passed. The 11 extra specs between the two runs are
`sandbox-data-draft.test.ts`, written after the first build started. (The BEN-006/2 commit message
says 12 of them; there are 11.)

⚠️ **The 6 remaining failures were not measured at the base commit.** They are 4 in
`AIX-006 style vocabulary` (`tests/ai/authoring-style.test.ts`) and 2 in `AI model registry`
(`tests/ai/models.test.ts`). Neither file is in this session's diff, neither describe touches
`sandboxData` / `sandboxExport` / `componentBench` / `SandboxPreview`, and **both runs produced the
same 6 with byte-identical messages** while the BEN count went 6 → 0. That is strong, and it is still
an argument rather than a base measurement. The standing note says test:ci carries **4** inherited
failures; this shows 6, and the extra 2 look like LAS-009/LAS-011 registry work that landed after the
note was written. **Measure the base before blaming this phase for any of them.**

## Concurrency, this session

Another Claude session (PID 2545, started 2026-08-07) was live on the same checkout and is the one
that wrote the phase-56 task docs at 16:24–16:28. It had not committed them. They were committed
here unchanged. Every commit in this session was pathspec-scoped; nothing was stashed and nothing was
`add -A`'d. If that session is still going, **check `git log` before assuming any of the above is the
only phase-56 work on the branch.**

## What to do next, in order

1. **BEN-004.** It is the blocker for everything Live. BEN-001 and BEN-006 both have working
   mechanisms and no surface to prove them on, and B3's frame question cannot be settled without one.
2. **BEN-002**, using `benchInterface()` rather than re-deriving `getPorts()` — see B5. Decide B2
   (client targeting on `modelUpdate`) first and as its own commit, per that task's recommendation.
3. **BEN-003**, and answer its channel question in writing before any UI, as it asks.
4. **BEN-007** last, live. It is where B3, B4 and every Live checkbox above get settled.

Do not let anything close on "the code looks right". Four of five specs in phase 42bis were wrong
about their own mechanism, and one of the two mechanisms in this session was wrong about its own
`plug` until a spec said otherwise.
