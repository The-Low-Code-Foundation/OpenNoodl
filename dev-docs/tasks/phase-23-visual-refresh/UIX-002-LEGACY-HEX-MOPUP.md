# UIX-002: Legacy Hex Mop-up + Ratchet Gate

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-002 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 1 — foundation |
| **Priority** | 🟠 High (hard prerequisite for the light theme; makes every later restyle stick) |
| **Difficulty** | 🟢 Easy (mechanical, parallelizable, zero design authority) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-001 (needs the final token vocabulary) |
| **Branch** | `task/uix-002-legacy-hex-mopup` |
| **Recommended executor** | 🟢 **Sonnet 5** — high-volume mechanical substitution against a fixed mapping table; judgment escalates, doesn't improvise. |

## Objective

Eliminate hardcoded color values from the editor's and core-ui's stylesheets by mapping each to the nearest UIX-001 token, and land a CI ratchet so the count only goes down.

## Background

The token system is well adopted (~119 editor stylesheets consume `var(--theme-*)`) but a bounded tail bypasses it: the styling audit (2026-07-26) counted **~397 hardcoded hex occurrences across 44 files** in `packages/noodl-editor/src/editor/src/styles/` and co-located styles (concentrated in legacy globals: `nodegrapheditor.css`, `popuplayer.css`, `componentspanel.css`, `layoutpanel.css`, `createnewnodepanel.css`, `cloudservicespopup.css`, plus `mixins/`, `variables/`, `placeholders/`, `propertyeditor/`), and **~197 occurrences** across core-ui's `.scss/.css`. Every one of these is a patch of the app that UIX-001's re-palette did not move and that UIX-008's light theme cannot flip. PLAT-004 proved the pattern for paying down exactly this kind of debt: baseline count + ratchet + slices.

## Current State

- ~397 hex occurrences / 44 files in noodl-editor styles; ~197 in core-ui styles (rough `grep -cE '#[0-9a-fA-F]{3,8}\b'` counts — re-baseline precisely at task start, post-UIX-001).
- Also in scope conceptually: `rgba(...)` literals encoding *chrome* colors (shadows and genuine alpha-composites may stay as literals or become tokens — see rules below).
- No gate prevents new hardcoded colors.

## Desired State

- Every hardcoded color in stylesheets is one of: (a) replaced by a `var(--theme-*/--base-*)` token; (b) a documented exemption (see rules); (c) deleted along with dead CSS it lived in (delete-first is encouraged — much of the legacy tail styles elements that no longer exist; verify before deleting).
- **Mapping rules (fixed, so parallel agents converge):**
  1. Map to the *semantic* token (`--theme-color-*`) when the role is clear from context; fall back to the nearest `--base-color-*` scale step when it isn't.
  2. Nearest-value mapping is by eye-and-role, not raw ΔE — a `#1c1c1c` panel background maps to `bg-1` even if some other token is numerically closer.
  3. Reds: classify per UIX-001's rule — destructive/error → `danger`, otherwise `primary`.
  4. Allowed to remain literal: `transparent`, `currentColor`, pure black/white **inside** shadows, and colors that are *content* rather than chrome (e.g. syntax-highlight token colors — those belong to the CodeMirror theme, out of scope here).
  5. When a file is >50% dead selectors, prefer deleting the file's dead parts over tokenizing them; note deletions in CHANGELOG.
- **Ratchet gate:** a script (`scripts/` beside the PLAT-004 ratchet, same style) counts hardcoded color literals per package against a committed baseline; CI (or the existing check script chain that runs `catalog:check` etc.) fails on increase. Baseline re-committed as slices land, ending at (near-)zero with the exemption list documented in the script.

## Scope

### In Scope
- [ ] Precise re-baseline post-UIX-001 (counts + file list committed in NOTES.md)
- [ ] Ratchet script + gate wired into the existing check pipeline
- [ ] Slice 1: `packages/noodl-editor/.../styles/` legacy globals (the 44-file tail)
- [ ] Slice 2: core-ui `.scss` leaks (~197)
- [ ] Slice 3: co-located component styles anywhere else in the editor that grep finds
- [ ] Dead-CSS deletion where discovered (verified against live editor)
- [ ] Live-verify after each slice (run-editor; spot-check the panels the slice touched)

### Out of Scope
- Canvas/painter TS/JS color literals (UIX-005 owns those)
- `nodelibraryexport.js` palette (UIX-005)
- CodeMirror syntax theme (`noodl-core-ui/src/components/code-editor/codemirror-theme.ts`) — UIX-009 aligns it
- Any visual redesign — same-looking pixels through tokens is the whole job
- Inline styles in TSX (enumerate what grep finds into NOTES.md for UIX-009 triage; convert only trivial ones)

## Implementation Steps

1. Baseline script + counts; wire the ratchet (fail-on-increase) immediately so the number can't grow mid-task.
2. Slices by directory, each: map/replace per rules → build → live spot-check → re-baseline commit.
3. Final pass: exemption list reviewed, baseline at target, guideline doc updated with "never hardcode a color" + ratchet pointer.

## Success Criteria

- [ ] Ratchet gate runs in the standard check chain and fails on any new hardcoded color
- [ ] Editor styles: 0 unexempted hardcoded colors (target; document any stubborn remainder with reasons)
- [ ] core-ui styles: same
- [ ] No visible regression in touched panels (spot-check screenshots per slice)
- [ ] Exemption rules documented in the ratchet script header

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Same-value different-role mappings flatten distinctions (two different grays both "look like" bg-2) | Role-based rule 2; when a distinction seems intentional, keep it by choosing adjacent scale steps and note it |
| Dead-CSS deletion removes something actually used by a rare popup | Delete only what a repo-wide class-name grep + live check can't find; otherwise tokenize and move on |
| Ratchet counts noise (hex in data URLs, IDs) | Count only in style contexts; regex excludes `url(data:`; tune against the baseline before enforcing |
| Parallel slices conflict with UIX-003/004 restyles | Territory split is by file: this task never edits a file a Tier-2 task has claimed in its spec; coordinate via PROGRESS.md |

## References

- [PLAT-004](../phase-14-editor-platform-health/) — the ratchet pattern and its lessons (re-baselining vs live sessions is a treadmill; pristine control runs)
- [UIX-001](./UIX-001-DESIGN-TOKENS-FOUNDATION.md) — the token vocabulary and mapping authority
- Styling audit figures (2026-07-26) — the 44-file / ~397 + ~197 inventory

## Checklist

- [ ] Baseline + ratchet live before replacements start
- [ ] Editor legacy tail tokenized/deleted
- [ ] core-ui leaks tokenized
- [ ] Exemptions documented; final baseline ~0
- [ ] Per-slice live verification; CHANGELOG
