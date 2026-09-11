# FIX-015 — The tokens nobody can edit (the phase-9 resurrection)

**Report 10** · Tier: **brainstorm → its own phase** · Effort: rulings session here; build is phase-sized

> *"We need to ressurect the phase 9 style overhaul project, bring it up to date with the new
> editor and rescope."*

## 🔴 The headline that reframes the whole ask

Phase 9's substrate **shipped and is alive** — it was quietly annexed by the AI track (phase 54 /
AIX-006 / DSG-005). Today the token system is **an agent-facing API with no human-facing UI**:

- **182 default tokens** exist (`DefaultTokens.ts`) — including exactly what the report asks for:
  `--primary/-hover/-foreground`, `--secondary*`, `--shadow-none…2xl`, `--duration-*`, `--ease-*`.
- Storage (`metadata.designTokens`), merge, CSS generation, **preview injection and deploy
  injection are all live**; AI-authored projects on this disk carry real token overrides and
  hundreds of `var(--token)` parameter references.
- The AI can **read** (`get_style_vocabulary` — names, 4 element configs, DSG-005's 18
  compositions, 5 presets) and **write** (`set_project_tokens`, `set_style_preset`).
- **The user cannot see or edit a single token in any shipped build.** The Design Tokens panel is
  gated on `config.devMode` — which **has never been set in any build** (`router.setup.ts:357-374`;
  `bugtracker.ts:210-222` proves nothing requires `config-dev.js`). Even if registered it is
  read-only (`TokenPicker` has **zero call sites**), and its second tab is placeholder scaffolding
  (`'Another Action'` menu items). The colour picker knows nothing about tokens. Presets are
  selectable **once, at project creation**, never again.

**That inversion — the AI has a styling system the user can't touch — is the rescope.**

## The evidence-backed gap list (details + file:line in the lane report)

A. No human editing surface at all. B. "Level 2" (token override per property) never landed.
C. **Shadows are defined but unusable** — no `boxShadow` shorthand port exists; the vocabulary
*rewrites* any `boxShadow` into a bare `boxShadowEnabled: 'true'` and **drops the token**; the
`card` composition has no shadow. "What cards look like" is a **runtime-port hole**, not a UI
hole. D. **Hover styles are computed and thrown away** — element configs author `states`
referencing `--primary-hover`; `applyVariant` stamps only `baseStyles`; the runtime's
`visualStates('hover')` machinery exists and nothing connects them. E. **Group has no element
config** — the card/band/shell node is the one missing. F. **Import is token-blind** —
`DependencyKind` has no `'token'`; an imported component silently re-themes or falls back, no
closure entry, no diff row (the phase-21 ImportFlow's tri-state ClosurePane is exactly the right
host). G. The **in-editor** AI cannot write tokens (`set_design_tokens` declared, never
implemented — only external MCP agents can). H. Presets are creation-only, not user-authorable,
no dark-mode story. I. Two style systems coexist (legacy `metadata.styles` owns the picker UI and
import support and has zero real usage; `designTokens` has all the usage and none of those).
J. Logic-node style/animation outputs: nothing exists — but the **States node** already
interpolates colours/numbers over curves and is wired into `visualStates`; it is ~80% of a "hover
animation" node, just not token-aware.

## Proposed shape — rename it: *"the project's identity, editable by the person whose project it is"*

Dependency-ordered slices for the new phase (this task's deliverable is the **ruled scope**, not
the build):

1. **Make tokens visible and editable** (A, B, part of H) — un-gate the panel, editable rows via
   the already-built TokenPicker, a "Theme" home that is not an experimental dev panel.
2. **Make the expensive tokens usable** (C, D, E) — the shadow-port decision, hover states that
   survive `applyVariant`, a `GroupConfig` with card/band/surface variants agreeing with the
   compositions.
3. **Make tokens travel** (F) — `'token'` DependencyKind, `var(--…)` inventory scan, mapping UI
   in the existing import Review stage.
4. *(separable, most speculative)* **J** — token-reading style/animation outputs.

## 🔴 The eight rulings for the brainstorm session — these ARE the task

1. **Surface the existing 182-token schema, or redesign it?** A rename is a migration: the AI
   corpus, 18 compositions, and every project on disk are authored against current names.
2. **Where does editing live** — un-gated side panel, Project Settings tab, or a first-class
   Theme surface? Values only, or user-defined tokens too?
3. **Primary/secondary story:** user picks one colour and we *derive* hover/foreground
   (contrast-checked — kinder, one-field branding) vs sets all three?
4. **How do shadows reach the DOM** — a `boxShadow` shorthand port accepting `var(--shadow-md)`,
   compound tokens, or compositions setting the five component ports? **Load-bearing for cards.**
5. **Hover:** stamp variant states at author time (visible/editable in the panel) vs resolve live
   at runtime (invisible but re-themeable)? Different project-format footprints.
6. **Logic-node style outputs** — rule whether such a node *reads* tokens (safe) or *defines*
   styles (a second authority competing with tokens+variants+compositions — precisely the
   fragmentation phase 9 set out to end). The States node is the existing machinery either way.
7. **Import mapping offers:** bring the token in / map to an existing token (needs a new control)
   / inline the value / leave dangling — and per-token or per-reference?
8. **The two-system endgame:** deprecate legacy `metadata.styles`? "Deprecate" turns B into a
   *replacement* of the colour picker — materially bigger, but the only path that leaves one
   answer to "what colour is this".

Also carried from the lane: phase-65 dependency — the published CDN library is still 2024 content,
so library-delivered token-bearing components have a publish-path prerequisite.

## Acceptance for THIS task (the scoping session)

1. The eight rulings above each have a recorded decision with the rejected options named.
2. A new phase folder is scaffolded from those rulings (its own README/TASKS in the house shape).
3. Phase-9's old docs get a superseded banner pointing at the new phase — they describe a world
   that ended in July and anyone planning from `STYLE-004` will build against dead premises.

## ✅ RULED 2026-08-16 (session 42) — this becomes its own phase

Richard, on the headline (*the token system is an agent-facing API with no human-facing UI*):
*"Yep we need to look at that, and the panel is probably buggy AF because we never tested it."*

✅ **Green-lit as its own phase**, scoped from the eight rulings — which are still owed, in that
phase's scoping session, not here.

🔴 **One constraint that sentence adds, and it re-prices slice 1.** *"Un-gate the panel"* is the wrong
verb. The Design Tokens panel has **never run in any shipped or dev build** — `config.devMode` has
never been set — and `TokenPicker` has **zero call sites**, so flipping the flag exposes UI nobody
has ever exercised. Budget slice 1 as **build and test the panel**, not *reveal* it, and expect the
first drive to be a bug list rather than a confirmation.
