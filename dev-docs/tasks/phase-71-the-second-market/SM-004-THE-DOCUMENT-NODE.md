# SM-004 — The document node

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `runtime`, `backend` |
| **Rulings** | none |
| **Depends on** | 🔴 **P69's CN-012 binds: no kit nodes server-side.** This is a built-in node plus a backend capability, never a kit |

## The job

Ship PDF generation as a first-class capability. It is currently **absent** — the node library has a
file picker and an upload node, and nothing that produces a document.

**It is table stakes, not a nice-to-have, across every market that survived screening and several
that did not:**

- **Insurance and adviser tools** — policy documents, IPIDs, quote summaries and suitability reports
  are mandatory regulated artefacts, not conveniences.
- **Client and professional-services portals** — engagement letters, invoices, signed statements.
  Document handling *is* the portal's job.
- **Configurators** — the quote document is the deliverable the buyer actually receives.
- **Trades estimating** — the quote PDF is the product (this market was rejected, but on other
  grounds; the requirement is real).
- **eLearning (P70)** — completion certificates.
- **Interactive calculators** — ConvertCalculator gates PDFs at its top tier; Formstack's entire $299
  Suite is documents plus e-signature.

This is the single capability that unlocks the most markets per unit of work, which is why it sits in
Tier 1 rather than behind a vertical.

**Scope.** Server-side rendering of a document from project data and a template, returned as a file
the app can download, email or store. Not a design tool; not e-signature (note it as a likely
follow-on — Formstack, Roofr, Payaca and Unlatch all bundle it, so the two are commercially adjacent).

## Acceptance criteria

1. **A built-in node that produces a PDF from project data**, drivable from a graph, with the output
   reaching the browser as a download and the backend as a stored file.
2. **Rendered server-side.** A client-side print dialogue is not this task — the markets above need a
   file generated without a human at a screen, on a schedule or in response to a submission.
3. 🔴 **Not a kit node.** CN-012 is explicit: kit nodes do not exist server-side, and a cloud function
   using one hangs. Build the caller to prove it — a cloud function generating a document must work.
4. **Fonts, page size and pagination are deliberate**, not accidental. A quote that silently truncates
   at the page boundary is worse than no PDF.
5. **Non-Latin text and a right-to-left sample render correctly**, or the limitation is documented in
   the node's own `docs` prose. Quiet mojibake in a regulated document is the failure mode.
6. **The generated document is accessible** — tagged, with a document title and language — or the gap
   is recorded against SM-003. A PDF is content, and the same procurement gates apply to it.
7. **Build the caller**: a real project generates a real multi-page document from real data, and is
   the regression fixture.

## Traps

- 🔴 **CN-012 again, because it is the obvious mistake here.** A document node feels like kit
  material. It cannot be — the moment a cloud function needs it, a kit implementation hangs.
- 🔴 **`scripts/` is not in `build.files`.** If any part of this ships as a script, no gate catches
  the omission and only *runtime* dies.
- 🔴 **Test it bundled.** Webpack rewrites `require.resolve` to a module id; a PDF library resolved at
  runtime works by accident in plain-Node gates and fails in the bundle.
- ⚠️ **Do not scope-creep into e-signature.** It is commercially adjacent and technically separate.
  Note it, do not build it.
- ⚠️ **A headless browser is a deployment obligation, not just a dependency.** If the implementation
  reaches for one, say what that costs the self-hosted story before choosing it.
