# CMP-007 — The token that resolves to nothing

**Scoped:** 2026-09-11 (session 9), by promoting phase 85 README §7's first known gap, owner NONE.
**Status: AC1 ✅ AC2 ✅ AC3 ✅ — CLOSED.**

## 1. The person sentence

**An agent installing a part off the shelf is told which of its colours this project cannot draw —
at the moment it installs it, and before, if it asks.**

## 2. The defect, re-derived from the code before it was believed

§7 filed this as *"`install_prefab` never carries design-token OVERRIDES, and `export_to_library`
never writes them."* Re-measured at `f89f805ab`, and the mechanism is exactly as described — but the
useful defect is one step to the side of where §7 pointed, and the §7 sentence names the fix it
rejected rather than the hole that rejection left.

**Not carrying overrides is correct and stays.** `libraryExport`'s module comment argues it at
length and it is CMP-004 AC4's whole mechanism: a token resolves against the HOST project's theme,
which is what makes an installed part adopt project B's look instead of dragging project A's palette
along. Shipping A's values would make a part that looks right in exactly one project. This task
changes none of that.

🔴 **The hole that leaves is a token project B has never DEFINED.** `var(--brand-accent)` with no
`--brand-accent` on `:root` is not an error — it is an unset property. So the part installs, the
response says `componentsInstalled`, and the thing draws the wrong colour having reported nothing.

And the information to say so existed on both sides and reached neither:

| where the answer was | who read it |
|---|---|
| `export_to_library` response (`tokensUsed`, from `planEntry`) | one agent, on one turn, in project A |
| the generated `README.md` `## Theme` section | a human browsing the shelf |
| **`library.json`** | — **no tokens field existed** |
| **`get_library_entry`** | — could not relay what was never recorded |
| **`install_prefab`** | — named components, styles, assets, modules, and **nothing about tokens** |

§2's shape for the sixth time in this phase: **the answer existed and nobody measured whether it
arrived where it could be acted on.**

## 3. 🔴 The measurement that decided how this was built

Counted on `library/prefabs` before writing anything, and it is the reason the specs look the way
they do:

| | |
|---|---|
| entries on the shelf | **45** |
| entries whose graph reads `var(--…)` | **18** |
| distinct tokens read across all of them | **29** |
| **of those 29, outside `DEFAULT_TOKENS` (192 tokens)** | **0** |
| `library.json` files carrying any token field | **0 of 45** |

🔴 **So a gate written against the first-party shelf reads "0 unresolved" before the fix and "0
unresolved" after it.** Both arms zero, grading nothing — [[a-rule-reading-zero-in-both-arms-grades-nothing]].
The defect does not live on the shipped shelf; it lives on the path CMP-004 AC4 opened, where a part
is exported from a project that **invented** tokens with `set_project_tokens`. That is the community
shelf this whole phase is built on, so the fixture mints `--brand-accent` through that real door and
reads it from a real parameter, with `--foreground` in the same graph as the control.

The zero is not discarded: a spec re-derives it from the artefacts and is **labelled a measurement
rather than dressed as a gate**, so that the day a first-party prefab starts reading an invented
token, the number moves and somebody has to look at it.

## 4. Acceptance criteria

### AC1 ✅ — `get_library_entry` says what a part expects of a theme, before it is installed

`GetLibraryEntryResponse.tokens`, derived from the entry's shipped graph on every call, and asserted
to equal what `export_to_library` reported for the same part — two answers to one question that could
drift are worse than one.

### AC2 ✅ — `install_prefab` names the tokens THIS project cannot resolve

`InstallPrefabResponse.tokensUnresolved`, absent when everything resolves, plus a `next` sentence
naming each token and `set_project_tokens`. Placed ahead of the README and `validate_project` lines
because it is the one thing in the response that surfaces nowhere else — the part renders, it just
renders wrong.

🔴 **It is a REPORT, never a refusal.** A part whose tokens do not all resolve still installs; a spec
asserts `componentsInstalled` to hold that line, because "refuse the install" is the obvious next
thought and it would break every legitimate install into a project that styles differently.

🔴 **And the negative half is a spec of its own:** a token the project already defines must NOT be
listed. Without it the rule degrades to "list every token the part reads", which is noise on every
install and tells an agent nothing it must act on. Control arm B is that spec's reason for existing.

### AC3 ✅ — the report is derived from the GRAPH, and the reason is the 45 entries already on the shelf

`entryTokens()` lives beside `planEntry`'s `TOKEN` regex and shares it deliberately: the export
decides what counts as a token reference and the install decides which of those do not resolve. If
those two ever disagreed the install would report a **subset** and read exactly like a clean part —
an under-report is invisible in a way a crash is not.

## 5. 🔴 What the artefacts refused, and why a third of this fix was deleted

**The first build wrote `tokens` into `library.json`** so the record would outlive the export
response. It was written, it passed its spec, and then the artefacts refused it twice:

1. `scripts/library/schema.json` is **`additionalProperties: false`** — `library:check` rejects an
   unknown key outright, so every entry `export_to_library` wrote would have failed the gate.
2. `scripts/library/build.js` copies a **fixed set** of fields into `index.json`. A `tokens` key
   would reach no consumer at all.

That is an **inert field whose only reader is the test asserting it** — and the trap is recorded, in
that same schema file, in `runtimeVersion`'s own description: *"a schema field nothing can evaluate is
worse than an absent one: `library:check` would accept it while every consumer ignored it in silence."*
The schema had already learned this lesson and the fix walked into it anyway.

✅ **So the write was removed and both paths derive from the graph** — which is also the only thing
that works for the 45 entries that already exist, none of which carry such a field. A spec now
asserts `library.json`'s key set positively, so re-adding the field is a red rather than a discovery.

The note in `entryTokens`'s doc comment says when it becomes worth recording: the day the editor's
library card wants to warn **before** a download, when there is no graph to read yet.

## 6. Readings, 2026-09-11, at `f89f805ab` + this work

- `npx jest` in `packages/noodl-mcp`: **5 failed / 1555 passed / 1560 total, EXIT=1.**
  - ✅ **The delta reconciles: 1540 (s8) + 11 + 9 = 1560.** The 11 are `fld011ParallelTabs.test.ts`,
    added by **P84's `01ea605cc`** *after* s8 wrote its number; the 9 are this task's.
  - The reds are s7/s8's two pre-existing `*Drive` suites, plus **`projectOwnsBackend.test.ts`, which
    passes 12/12 in isolation** — it provisions real backend processes and races under a full
    parallel run. Measured, not assumed; it references nothing in this task.
- `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `npm run library:check`: **75/75 entries clean, EXIT=0** — the gate the deleted field would have
  broken.
- `toolDisclosure.test.ts`: **18/18, `[surface] 8272 tokens / 20 resident tools — 8 under`,
  UNCHANGED.** `install_prefab`, `get_library_entry` and `export_to_library` are all in the deferred
  `explore` group, whose only resident trace is `find_tools`' `(N tools)` — so the description and
  response changes here cost **zero** resident tokens. Measured before and after, not assumed.
- **Five control arms, 9 of 9 tests running in every arm, both sources restored md5-identical:**

| arm | change | result |
|---|---|---|
| A | install computes nothing | 3 red |
| B | install reports **every** token, not just unresolved | 3 red — incl. the negative half |
| C | 🔴 install trusts `library.json` instead of the graph | 3 red — the metadata path reports nothing |
| D | `get_library_entry` stops relaying | 1 red — AC1 |
| E | export writes the inert `tokens` field | 2 red — the schema-shape spec |

  Arms A and B red the same first spec and are distinguished by the second: A leaves the negative
  half green (nothing is reported), B reds it (everything is). Arm C is the one that matters — the
  obvious metadata-trusting implementation passes **every other spec in the file**.
- `dist/noodl-mcp.cjs` rebuilt **10:09:15**, carrying five anchors: s6's *"What goes on a component's
  interface"*, s7's *"A repeated row publishes to the repeater"*, s8's *"relatedNodes, patterns,
  antiPatterns"*, `comp-variant-badge-states`, and this task's *"set_project_tokens, or repoint those
  parameters"*.

## 7. What this does not do

- **It does not carry overrides**, and that is CMP-004 AC4's decision, not an omission. The report is
  what was missing.
- **It does not refuse an install.** See AC2.
- **It does not reach the editor's library browser.** A person clicking Install in the editor goes
  through `views/ImportFlow`, not through this tool, and still gets no warning. That is a real
  remaining gap and belongs to whoever next touches that flow — it is the same answer, one UI away.
- **It is not driven.** The round trip is graded through real MCP sessions over `InMemoryTransport`,
  which is the tool an agent calls; nothing here was watched rendering the wrong colour in a browser.
