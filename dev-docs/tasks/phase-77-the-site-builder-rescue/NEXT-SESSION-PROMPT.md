# Phase 77 — next session

## ✅ No hold. Richard cleared the CPU freeze 2026-08-28 (s4): *"Freeze is off, go nuts."*

The s3/s4 owed sweep is **done and green** — do not re-run it as if it were owed. What follows
is the live state.

## Where the phase stands

| task | state |
|---|---|
| SBR-001 | ✅ closed s2, driven |
| SBR-002 | ✅ **closed s4** — AC4 driven, three states + controls; the drive found and fixed a real defect |
| SBR-003 | 🟡 built, swept, driven — AC1–4 live; **one probe owed, carried into SBR-004** |
| SBR-004…014 | ⬜ open |

**s4 gate readings (post-fix tree, for comparison — but see "re-run these first" below):**
`typecheck:editor` 0 · `typecheck:mcp` 0 · `test:ci` **2863 / 4 failures, all `AIX-006 style
vocabulary` by name** · `test:main` 6253/6254 → 6254/6254 after the sb-007 pin update · mcp
sb004/005/006/007 91/91 · backend 35/35 + 20/20.

## Re-run these first (cheap, and honestly owed)

`test:ci` and the full `test:main` ran **before** the watchdog fix regenerated the artefact a
second time. Re-verified after the fix: `sb006PublicSite` 33/33, `sb007Template` 22/22,
`tests-unit/sb-007` + `sbr-002` + `sbr-003` 36/36. So the exposure is small, but a full
`test:ci` + `test:main` on the current tree is the honest first move (~3 min, run `test:ci`
alone).

## The two things genuinely left from s4

1. **The `var(--token)` dimension-port probe** (SBR-003 §2, AC5's last row): a `maxWidth` fed
   `var(--site-measure)` actually constrains a rendered box in the viewer, paired with an
   unknown-token control that does **not**. Deliberately carried into **SBR-004**, which is the
   first task that puts a measure on a real box — probing it earlier would need a throwaway node.
2. **SBR-003's person-sentences** ("looks like Studio", "every surface changes") complete when
   SBR-004 (public site) and SBR-006 (admin) author from `var(--token)`, and SBR-009 ships the
   preset row. The contract itself is fixed, documented and gated.

## Next task: SBR-004 — the public site wears the theme

Everything visual depends on the now-settled contract in
`models/template/templates/siteTheme.ts`:

- 12 `Theme.tokens` fields → `--primary`, `--primary-foreground`, `--background`, `--surface`,
  `--foreground`, `--muted-foreground`, `--border`, `--accent`, `--radius-md`, `--font-serif`,
  `--font-sans`, `--site-measure`.
- Author **only** `var(--token)`: measure = `--site-measure`, radius = `--radius-md`, spacing =
  `--space-*` steps, faces = `--font-serif`/`--font-sans`. 🔴 No `var(--x, fallback)` — one
  default writer (`designTokens`), one overlay writer (`applyTheme`).
- Presets (`SITE_THEME_PRESETS`) are data and Studio IS the floor, so "pick Studio" ≡ "delete
  the Theme row" by construction.

## Traps s4 measured (all cost real time — read before driving)

- 🔴 **A signal into a VALUE port coalesces.** true-then-false arrives as **one** queue entry
  per input name, so the receiving script runs **once, with `false`**. Any guard of the form
  `Inputs.x === true` on a signal-fed value port **can never fire**. This shipped for a session
  behind green specs — the unit spec asserted the abstain-on-false design, so the spec and the
  defect agreed. Only the drive could see it.
- 🔴 **The editor preview is 988×313 until you pick a device size** (topbar `ZoomSelect` →
  "Mobile, big"). Probing reachability in the default pane is measuring the pane, not the page.
- 🔴 **`elementFromPoint` returning `null` means "below the fold", not "hidden"** — and an
  ancestor hit counts as reachable unless you require `hit === el || el.contains(hit)`. The
  honest hidden signal in this template is `getComputedStyle(el).visibility`.
- 🔴 **The wizard's template card**: click the `[class*=TemplateCard--]` **root** (a BUTTON) and
  verify `--selected` landed. Clicking the title span reports success and selects nothing — the
  Review step then says "Hello World" and would have created the wrong project.
- ⚠️ **`claimSite` fails closed on a missing `SITE_SETUP_TOKEN`.** Provision it through the
  backend's own **Secrets panel** (overflow "···" on the backend card → Secrets) — writing
  `~/.noodl/backends/<id>/secrets.json` by hand is blocked, and the panel is the real flow.
- ⚠️ The admin "New page" create form did not carry typed values into the record in the drive
  (rows landed with `title: null`). **Not investigated** — it is SBR-007's screen and may be the
  same `prop-` deploy defect SBR-008 owns. Worth a look before SBR-007.
- ⚠️ `publishPage` requires `{pageId, publish}` — `publish` missing is a 30s function timeout,
  not a validation error.

## Drive artefacts on this machine

`SBR AC4 Drive` (backend `backend_mtd2k32gtl3ee`:8591, claimed, owner `owner@sbr-ac4.test` /
`sbr-ac4-password-1`, setup token `sbr-ac4-drive-token`, one published `home` page, empty Theme
row) and `SBR AC4 Drive 2` (fresh, carries the fixed watchdog). Both bindings restored; both
have a `nodegx.project.json.sbr-backup` beside them, safe to delete. Older: `SBR Setup Drive`,
`SBR Drive Site`, `SBR Hello Control`, `SBR No Backend` (stale graphs — do not reuse for state
drives).

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written.
- Shared checkout: pathspec commits only (untracked ⇒ add+commit one chain); announce editor
  launches AND teardowns to peers; `test:ci` alone; end the session by updating this file,
  TASKS.md's s-log, and memory.
