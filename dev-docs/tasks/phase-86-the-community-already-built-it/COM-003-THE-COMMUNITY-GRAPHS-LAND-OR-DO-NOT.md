# COM-003 — The community graphs land through the gate, or they do not land

🔴 **Measured, not assumed: 5 of 12 pass. Seven do not.** The plan "import the community components
as examples" was tested before it was written down, and it fails on the majority.

## 1. The person sentence

**A field-proven wiring becomes an example an agent can imitate — only after the gate says it is
one.**

## 2. What was measured

```
./convert-exports.py <outdir>                  12 graphs, 0 connections dropped
npm run catalog:examples -- --dir <outdir>     EXIT=1
5/12 examples validate clean (strict, warnings-as-errors).
```

Clean: `ag-grid`, `csv-download`, **`seo-meta-tag-setter`**, `tinymce-text-editor`,
`tiptap-text-editor-r`. Failing: the other seven. Reconciliation, per-code counts and the full
diagnostic text: [`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md) §4.

🔴 **The headline defect:** the Dropzone graph wires `Open File Picker.success`, an output that does
not exist. Our own `file-upload` prefab wires `done` and is correct. **A graph can circulate in a
community for years and still be wrong**, and this task exists to make sure the gate is what decides.

## 3. Why these are worth the trouble at all

The 67 shipped examples were written by us, for the catalog. These 12 were written by people
solving their own problems, and several demonstrate patterns nothing in the current library shows —
notably the `Javascript2` lifecycle pair (`Node.Signals.DidMount` / `WillUnmount` adding and
removing DOM listeners on `Script.Inputs.element`), which the Dropzone graph does textbook-correctly
even while wiring a dead port elsewhere.

## 4. The instrument

[`convert-exports.py`](convert-exports.py). Flattens the nested export shape (UUID ids,
`children: [{node}]`, x/y) into the example shape (readable ids, `children: ["id"]` + `parent`, no
coordinates). 🔴 **It converts; it does not certify** — a connection whose endpoint did not survive
is dropped, never repaired, because repairing it would invent a wiring the community never wrote and
the gate would then certify our guess. Currently drops zero.

## 5. Acceptance criteria

**AC1 — the five clean graphs land, and the gate stays green.** They are added to
`docs/node-catalog/examples/`, cited from the `enrichment.examples` of the types they demonstrate,
and `npm run catalog:examples` **exits 0** over the whole library (67 + 5).

**AC2 — the spacing is converted, not imported.** 🔴 All 33 `raw-spacing-literal` diagnostics are
resolved to `var(--space-*)` tokens before anything lands. The corpus predates the token scale;
importing px verbatim seeds the artefacts an agent imitates with the exact defect P81 is about.
⚠️ The gate reports these as warnings and `--strict` makes them fatal — do not land with the strict
flag dropped.

**AC3 — the module-backed graphs get a declaration or a refusal.** `module.inlineHtml` (×2) and
`Markdown` (×1) are unknown to a catalog built from built-in types only. Either the example format
carries a module declaration, or those three are refused with that reason written down. 🔴 Not
silently dropped.

**AC4 — the Dropzone port defect gets an owner.** Either the community graph is corrected before
landing (and the correction noted), or a defect row is filed if `success` turns out to be a real
port that was renamed. ⚠️ **Re-measure before assuming which** — check the runtime, not this file.

**AC5 — the 14 code snippets are dispositioned.** Each becomes a dictionary row (COM-002), an
example, a library part, or an explicit discard. 🔴 A snippet with no disposition is invisible and
gets rediscovered at full price.

## 6. 🔴 The standing caution

**Circulation is not verification.** Every graph here has been downloaded and used by real people
for years, and 7 of 12 fail a gate that has been running since P55. Nothing in this corpus lands on
reputation, popularity, or the fact that it obviously works in someone's app.

## 7. What this does not own

Making these installable as library parts — that is CMP-004 AC3 (P85), which already names this
corpus as its seed. This task produces *examples*; COM-004/005 produce *library entries*; the shelf
that carries them is P85's.

---

# 🟢 BUILT — 2026-09-11, session 4. 5 of 5 ACs.

**All twelve graphs landed.** Not five — twelve. The gate went 5/12 → 12/12 without the gate being
loosened once: every graph that was failing was *converted* until it passed, and the two that needed
the gate to learn something new taught it a check that is **stricter** than what it replaced.

```
npm run catalog:examples        EXIT=0   101/101   (89 + 12)
npm run catalog:merge:check     EXIT=0   176/176 nodes documented, 101 examples
npm run docs:nodes:check        EXIT=0   clean. 195 generated files match 176 catalog nodes
npm run catalog:tokens          EXIT=0   1236 token references across 109 files all resolve
npm run catalog:check           EXIT=0
```

## AC1 ✅ — the graphs land, and the gate stays green

**101/101, exit 0**, over the whole library. 31 citations were added across 21 `enrichment.examples`
lists; the 21 regenerated node pages are exactly the 21 files cited from, which is the reconciliation.

⚠️ **`catalog:examples` passing is not the end of the pipeline.** `docs:nodes:check` read *clean*
with the twelve already landed, because `generate-node-docs.js` resolves examples out of the
**enriched** catalog with `.filter(Boolean)` — an example the catalog does not carry is silently
skipped, not reported. The real sequence is `catalog:merge` → `docs:nodes`, and running the second
without the first grades the previous state. That is where AC3's second gate was found.

## AC2 ✅ — the spacing is converted, not imported

**33 → 0.** 32 literals became `var(--space-*)`; the 33rd was dropped instead, because it sat on a
port the runtime never reads (below). The reconciliation is exact: 32 + 1 = the 33 diagnostics.

🔴 **The scale is parsed out of `parameterValues.ts` at run time, not copied.** That file's own
header says why — *"a second copy of a palette drifts silently, so it is graded rather than
trusted"* — and a third copy in a Python script would be graded by nothing. `load_spacing_rules()`
**refuses to run** if it cannot parse `SPACING_PORTS` and `SPACE_TOKEN_BY_PX`, because a converter
that silently tokenises nothing reports the same "0 literals left" as one that worked.

⚠️ **Exact matches only, and one literal is deliberately left raw.**
`community-strobe-blinking-bu`'s `marginBottom: 1200px` is off the scale, so there is no token that
means it, and rounding is the one change here that would alter what the graph renders. It is
**reported by the converter on every run** rather than fixed or forgotten. It never appeared among
the 33 because the product's own rule fires only on an exact match — the instrument and the gate
agree about the population, which is the check that they are measuring the same thing.

⚠️ **Order matters and is now written down.** Inert parameters are dropped **before** spacing is
tokenised. `community-web-rtc-video-record`'s `columnGap` was both inert and a raw `20px`;
tokenising first would have written a tidy `var(--space-5)` onto a port the runtime never consults —
an artefact that reads as on-system and is *worse* than the literal it replaced.

### The five non-spacing warnings, and why every one was dropped rather than resolved

3 `inactive-conditional-parameter` + 2 `inert-dimension`. The gate suggests *enabling* each one
(`useLabel: "true"`, `sizeMode: "explicit"`). **All five were removed instead**, and the rule is in
[`graphs.py`](graphs.py): removing a parameter the gate has **proved** is never read cannot change
what renders; setting the enabling parameter would add a label, an icon or a fixed height the
community's app never had. One is a conversion, the other is a guess about intent.

## AC3 ✅ — the module-backed graphs get a declaration, not a refusal

The either/or resolved to the better half, because the types are **real and this repo ships them**:
`module.inlineHtml` is `library/modules/custom-html` (already used by our own `pdf-viewer`), and
`Markdown` is `library/modules/markdown`. Refusing three graphs for using our own modules would have
been the wrong answer to a true statement.

`requiresModules: [{ module, nodes }]` is now part of the example format. 🔴 **It is checked, never
believed** — the module must ship, its `library.json` must say `type: "module"`, and its own
`index.js` must name each declared type. A declaration naming a module that does not register the
type is an **error**, and a louder one than the `unknown-node-type` it was trying to explain;
otherwise `requiresModules` would be a way to spell *"stop checking this node"*.

⚠️ **What it buys is "this type exists" and nothing else.** The `unknown-type-check-skipped` INFO
notices are deliberately **left in place** — 2 per module node, 6 in total — so the honest reading of
a declared example stays *"verified except for its module nodes"*. That is CN-002's whole point, and
the durable fix is the kit overlay (CN-003), at which point this should shrink to nothing.

**Armed before it was believed.** Four mutations, each 12/12 → 11/12:

| mutation | result |
|---|---|
| declare a module that does not exist | ✅ red |
| declare a node type the module does not register | ✅ red |
| declare a type no node in the example uses (stale) | ✅ red |
| declare the type against the *wrong* shipped module | ✅ red |

🔴 **The same question was being asked by a second pipeline, and it refused the same three
examples.** `catalog:merge` validates `demonstrates` against the catalog and failed ten minutes
after `catalog:examples` passed, with a different message from a different file. The rule therefore
lives **once**, in [`scripts/node-catalog/moduleNodeTypes.js`](../../../scripts/node-catalog/moduleNodeTypes.js),
and both gates read it. Two implementations of one rule drift, and the drift is invisible because
each gate stays green about its own half.

## AC4 ✅ — the Dropzone port defect gets an owner, and the task file's premise was wrong

🔴 **Re-measured, as the AC instructed — and it inverted the headline.** `success` was a **real
port** from the initial commit until `a139a3ce5` (ERG-001 §4, **2026-08-02**) renamed it to `done`.
The community graph was correct when it was written; **our own rename, six weeks ago, is what made
it wrong.** The phase's standing caution survives intact — 7 of 12 did fail a gate — but *this*
particular headline was the product's fault, not the community's.

The wire is re-pointed to `done` as a declared correction with the measurement attached, and the
defect row is filed: **[D1](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d1) — renaming a built-in node's
port ships no alias, no migration and no warning**, so every user project that wired `success`
(or `Send Event.sent`, `Unique Id.generated`, `Send Email.sent`/`failed` — four ports moved in that
one commit) holds a dead wire and is told nothing. **Nominated owner: the runtime.**

## AC5 ✅ — the 14 snippets are dispositioned

[`SNIPPETS-DISPOSITIONED.md`](SNIPPETS-DISPOSITIONED.md). **1 documented, 1 verified, 1 routed to
COM-005, 11 discarded with a reason each. Zero without a disposition.**

The one that earned an artefact named a real, useful, **undocumented** facility: `For Each`'s
`inputMappingScript` — a *dynamic* port, which is why the generated catalog never carried it and
nothing described it. It now has an enrichment note. ⚠️ The snippet itself **does not compile** (one
missing comma, [D3](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d3)) — found by executing it, and the same
run cleared it of a *second* accusation that was unfounded.

🔴 **The most valuable sentence in all fourteen files is one none of them contains**: three of them
use `_noodl_cloudservices.masterKey`, which exists **only** in a deployed cloud runtime. Pasted into
a client-side `Function` node they send `X-Parse-Master-Key: undefined` and Parse rejects them — and
the person reads that as a permissions problem with their data.

## What changed, in one line each

- [`graphs.py`](graphs.py) — **new.** The ledger: every authored title/description and every declared
  correction, each with a `why`. The prose lives here and not in the landed JSON because the landed
  JSON is **generated**, and a hand-edit there is deleted by the next run, silently.
- [`convert-exports.py`](convert-exports.py) — spacing tokenisation parsed from the product; declared
  corrections applied and reported; refuses to run on an unparseable scale, and refuses a correction
  that matches nothing.
- `scripts/node-catalog/moduleNodeTypes.js` — **new.** One verified answer to "is this module type
  real?", read by both gates that ask.
- `scripts/validate-examples.ts` / `scripts/node-catalog/merge.js` — honour a verified declaration.
- `docs/node-catalog/examples/community-*.json` — **12 new**, generated.
- 21 enrichment files — 31 citations; `for-each.json` also gains the `inputMappingScript` note.

⚠️ **Never hand-edit `docs/node-catalog/examples/community-*.json`.** Edit `graphs.py` and re-run
`./convert-exports.py docs/node-catalog/examples`, then `npm run catalog:merge && npm run docs:nodes`.

## A trap this session paid for

🔴 **An example's `description` is published.** `generate-node-docs.js` renders `**title**` and the
description verbatim onto the public node page. Three descriptions were written for a corpus reader
and referenced *"the corpus"*, *"the phase's standing caution"* and *"COM-004"* — all of which
shipped onto `docs-site/docs/nodes/**` before a grep caught them. `title` and `description` are also
**required** fields (`merge.js`), so the export's truncated 20-character directory name
("Simple audio recorde") would have been published as the title had it not been replaced.
