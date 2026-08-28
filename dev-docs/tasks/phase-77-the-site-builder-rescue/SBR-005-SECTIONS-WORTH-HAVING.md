# SBR-005 — Sections worth having

**Fixes finding 5.** Five section kinds in the model, one rendering in the graph: today
`Site/SectionView` is 1 Image + 1 Text and a script whose outputs are `showImage`, `showBody`,
`weight`, `size`. A gallery is one image; a CTA is bold text with nothing to click.

## 1. The person sentence

**A gallery looks like a gallery, a hero looks like a poster, and the call-to-action button
goes somewhere when clicked.**

## 2. Scope

- **hero** — image with an overlaid heading and sub-heading (overlay gradient for contrast).
- **gallery** — more than one image in a grid. ⚠️ Today a section stores a single image ref;
  the data model needs a multi-image shape for galleries (ordered refs), the section editor
  (SBR-007) needs to author it, and the ACL treatment must match the existing image path.
- **cta** — heading, body, and a real link/button with a target field (external URL or a page
  slug). A slug target navigates in-site; an anonymous visitor clicking it lands on the page.
- **richText** — the current behaviour, kept, restyled under tokens.
- **contact** — labelled fields in a card, and a **success state**: "Message sent — thanks."
  driven by the stored path's `{"received": true}` (fixed s19; the failure path answers the
  same shape with `false` — surface it as an error line, not silence).
- Section kind dispatch: five kinds, five visibly different renderings — however dispatched
  (conditional mounts per kind beats one node morphing).

## 3. Acceptance criteria

1. **(person)** A page carrying all five kinds reads as five different things — driven in the
   viewer, one screenshot per kind, and a DOM-level assertion each (e.g. gallery has ≥2 images
   in a grid; hero heading overlays its image).
2. **(person)** Clicking the CTA navigates (consequence: the destination page's content is on
   screen), anonymous.
3. **(person)** Submitting the contact form shows the success sentence; a failed submit shows
   the failure line — negative control: the success sentence is NOT shown on failure.
4. Conditional section UI goes through `mounted`, not `visible` (the conditional-UI rule), and
   hidden kinds are absent from the DOM, not stacked invisibly.
5. Data-model change (gallery refs) covered end to end: authored in the panel, stored, rendered,
   ACL-checked (anonymous reads only published pages' images).

## 4. Traps

- 🔴 A signal into a value port writes `true` THEN `false` in one drain — the s19 contact-flag
  lesson; keep state flags rising on `done` signals inside the owning chain.
- 🔴 `setDynamicPorts` replaces; a parameter is not a connection (export drops wires, copies
  parameters) — anything the deployed site needs must survive the export's health filter.
- 🔴 Regenerate the artefact; label-based wire assertions; standing values on all Text nodes.
