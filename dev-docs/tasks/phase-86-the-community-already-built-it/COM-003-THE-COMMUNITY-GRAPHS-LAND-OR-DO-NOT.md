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
