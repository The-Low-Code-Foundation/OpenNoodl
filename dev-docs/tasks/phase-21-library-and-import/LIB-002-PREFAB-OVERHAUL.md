# LIB-002: Prefab Audit, Repair & Restyle

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-002 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium (breadth, judgment, and live verification rather than hard technique) |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | LIB-001 (tracked sources + `library:check`); RUN-001 far enough that the React runtime pairing is stable |
| **Recommended executor** | 🟠 **Opus 4.8** — the work is design judgment applied many times: what "not embarrassing" looks like per prefab, which bugs are the prefab's vs the runtime's. Escalate to Fable 5 only if a prefab needs genuine re-architecture. |

## Objective

Every prefab in the library installs cleanly into a fresh project, works, and looks like it belongs in a 2026 product. Broken-beyond-repair prefabs are retired explicitly rather than left to disappoint.

## Background

The prefabs (Date Picker, and whatever else the live index holds — the inventory is step 1 because no tracked list exists) date from upstream Noodl. They are functionally useful but buggy, and styled to defaults that predate the styles overhaul. Because LIB-001 turns each prefab into a tracked project directory, this task is ordinary project work: open, fix, restyle, re-save, `library:check`, publish.

Two format traps from prior work apply: first-save normalization rewrites projects on open+save (SUB-010), and the optional-parameters v2 open crash was fixed on the editor side but old zips may still carry odd shapes. Re-saving every prefab with the current editor launders both.

## Current State

- Prefab content exists only as live zips; count and quality unknown until inventoried.
- Prefabs are full projects whose components get copied in; colliding styles/resources/variants are silently dropped on install (modulelibrarymodel.ts:106–136) — so a prefab that *depends* on its bundled styles can arrive broken by design.
- No prefab has been opened in the current editor as part of any verification pass.

## Desired State

- A per-prefab audit record (one table in this task file or `library/prefabs/AUDIT.md`): works / fixed / restyled / retired, with notes.
- Every kept prefab: opens in the current editor, re-saved in current format, `library:check` clean, installs into a fresh project with zero console errors, renders correctly on the current React runtime pairing (18 and 19 per RUN-001's delivery).
- Restyled: uses the project style-token system (color/text styles) rather than hard-coded values where the styles system covers it, so imported prefabs adopt or expose their palette coherently; visual pass at both light defaults and a themed project.
- Naming/folder hygiene: consistent component folder structure per prefab (matters directly for the import tree UX in LIB-005).
- Each prefab's `library.json` carries honest tags, description, and a regenerated icon/screenshot.
- Retired prefabs: removed from the index with a line in the audit record saying why.

## Scope

### In Scope
- [ ] Inventory: enumerate the live prefab index; record it before touching anything
- [ ] Per-prefab: open, exercise, fix functional bugs, restyle, re-save, check, live-verify install
- [ ] The bundled-style dependency problem: prefabs must either carry uniquely-named styles or tolerate the silent-drop policy; prefer namespaced style names (`DatePicker/Accent`)
- [ ] Icons/screenshots regenerated (SUB-009 `noodl-preview` headless render where practical)
- [ ] Retirement decisions, recorded
- [ ] 2–4 **new** prefabs only if they are cheap wins surfaced during the audit (e.g. an existing example project worth promoting); net-new prefab design is not the sprint's job

### Out of Scope
- Install-pipeline changes (the silent-drop policy itself) — LIB-004 decides the new collision semantics
- Runtime/node bug fixes surfaced by prefabs — file them to the owning task family (RUN/DEBT); fix in-prefab workarounds only when the runtime fix won't land this phase
- Documentation-site pages per prefab beyond the index metadata

## Implementation Steps

1. Fetch the live index; write the inventory table with a triage guess per entry (keep / fix / retire).
2. Work the list one prefab at a time — open in the current editor (run-editor skill), exercise every interactive path, fix, restyle, re-save.
3. `library:check` per prefab; live install into a fresh project; console-clean check.
4. Regenerate icons/screenshots; update `library.json` metadata.
5. Publish a full library build via the LIB-001 pipeline; verify one end-to-end install from the published site.
6. Final audit table into the record; retire-list applied to the index.

## Success Criteria

- [ ] Audit record covers 100% of the pre-existing index — nothing silently dropped or silently kept
- [ ] Every kept prefab: check-clean, console-clean install, verified live on the current runtime pairing
- [ ] Every kept prefab passes a visual pass in a themed project (styles adopt or expose coherently)
- [ ] No prefab depends on silently-dropped styles to look right
- [ ] Published library rebuilt from tracked sources only

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Inventory is larger than expected | Triage first; retirement is a legitimate outcome, the bar is "trustworthy", not "everything survives" |
| A prefab exposes a real runtime bug | File to the owning family; workaround in-prefab; don't let this task become runtime surgery |
| Restyle taste drifts per-prefab | Do a style charter pass on the first two prefabs (spacing, radius, token usage), then apply it mechanically |
| React 19 pairing not settled when this starts | Verify on 18 (the current default); re-run the install check on 19 as a RUN-001 corpus item |

## References

- [README.md](./README.md) — pipeline findings; silent-drop policy location
- LIB-001 (pipeline), LIB-005 (folder hygiene consumer)
- SUB-010 notes — first-save normalization; optional-parameters v2 trap
- Phase 9 styles overhaul — the token system prefabs should speak
