# Phase 77 — next session

## 🔴 STANDING HOLD — read before doing ANYTHING heavy

**Richard, 2026-08-28 (mid-s3): "avoid doing any CPU / RAM intensive testing until I
explicitly say to start again … Save the tests, we'll run them later and sweep up all the
work done at once."**

This line stays in this file until Richard explicitly clears it. Until then: no `test:ci`,
no full jest/vitest suites, no webpack builds, no editor stack (`dev:debug`/`dev`), no
backend fleets, and no `npm run template:site-builder` (it boots the door's validation
tree). Doc edits, code edits, small greps and single-file reads are fine. When he clears
it, run the **owed sweep** below first.

## The owed sweep (run when — and only when — the hold is lifted; IN THIS ORDER)

1. **`npm run template:site-builder`** — s4 (SBR-003) edited all three component sets
   (`applyTheme`, `buildTokens`, `readTheme`, `seedTheme`, two theme-editor wires) and the
   artefact was NOT regenerated under the hold. Until this runs, `sb007Template.test.ts`
   (byte gate) and `tests-unit/sbr-003/token-contract.test.ts`'s LAST spec ("shipped applier
   reads every contract field") are RED BY DESIGN. Expected after: id count stays 195 (no
   nodes added), sb017 helper total stays 101 (parameters aren't connections; no cloud
   nodes/wires changed).
2. **`typecheck:editor`** — expect **0 errors** (baseline gone since s3). New editor files:
   `siteTheme.ts`, `ProjectTemplate.ts`, `EmbeddedTemplateProvider.ts`,
   `site-builder.template.ts`, `tests-unit/sbr-003/`. Then **`typecheck:mcp`** (sb00x now
   import `siteTheme` cross-package — same pattern as `ProjectImporter`, but unproven).
3. **`test:ci` floor** — expect 2863+ specs (sbr-003 adds ~14) / 4 failures, all
   `AIX-006 style vocabulary` **by name**. Covers both s3's owed run (SBR-002) and s4's
   (SBR-003). P75's 11:47 run predates both and discharges neither.
4. **`test:main`** — s3 saw `2 failed, 371 passed` beside webpack builds (the
   two-suites-at-once flake pattern; only `"'siteBuilder' was also declared here."` survived
   a truncated log; suspects `require` `site-builder.content.json`:
   `sb-017/cloud-ports-agree-with-the-runtime.test.ts`, `sb-018/*`). Re-run clean; a repeat
   is real.
5. **mcp vitest** (`sb004Authoring`, `sb005AdminPanel`, `sb006PublicSite`, `sb007Template`)
   — s3's 33/33 on sb006 predates s4's applier/buildTokens extension; the acceptance-5
   key-agreement spec and its mutant derive both sides from the scripts and should extend
   themselves; the THEME_KEYS loop now iterates 12 entries.
6. **Backend suites** (`sb004-publication-invariant`, `sb008-public-site-drive`) — BUILD
   FIRST or real-HTTP skips; pins updated to the 12-key shape.
7. **SBR-002 AC4 drive** — unchanged from s3's writeup, still owed (three states, three
   on-screen answers, `elementFromPoint`-reachability, fresh wizard project; see s3's
   NEXT-SESSION-PROMPT section preserved in `TASKS.md` s3 log and SBR-002's task file).
8. **SBR-003 drive probes (§2)** — after the sweep, with an editor: (a) a dimension port fed
   `var(--site-measure)` actually constrains a rendered box, paired with an unknown-token
   control that does NOT; (b) `applyTheme` beats the `:root` floor live (write a Theme row
   flipping `colorPrimary`, observe a button/`--primary` read change in a SECOND cdp eval —
   a token flip is invisible in the same eval).

## Where SBR-003 stands (s4) — read `SBR-003-THE-TOKEN-CONTRACT.md` §5 for the full map

**Built + spec'd, NOTHING EXECUTED.** The contract is single-sourced in
`packages/noodl-editor/src/editor/src/models/template/templates/siteTheme.ts`:

- `THEME_TOKEN_FIELDS` — the final 12-field `Theme.tokens` list (AC deliverable):
  `colorPrimary → --primary`, `colorOnPrimary → --primary-foreground`,
  `colorBackground → --background`, `colorSurface → --surface`, `colorText → --foreground`,
  `colorTextSoft → --muted-foreground`, `colorBorder → --border`,
  `colorAccentSoft → --accent`, `radius → --radius-md`, `fontDisplay → --font-serif`,
  `fontUi → --font-sans`, `measure → --site-measure` (the ONE minted custom token).
- `SITE_THEME_PRESETS` — Studio/Press/Night, hexes verbatim from the screens artifact.
  Studio IS the floor: `buildSiteDesignTokens()` derives the template's `designTokens`
  block from it (+ 7 static companions), so "pick Studio" ≡ "delete the Theme row".
- Install writes `metadata.designTokens` + generated `docs/THEME.md`
  (`buildThemeDoc()`, front-matter `inject: pull`) — new `ProjectTemplate.designTokens`
  and `.docs` fields, docs validated by `assertTemplateDocPath` (throws on escapes).
- Overlay: sb006 `applyTheme` writes the same names on `documentElement.style`; companions
  are DERIVED (`color-mix`), never record fields; `fontUi` also mirrored inline.

**Person-ACs (AC1/2/4) cannot pass on visuals yet**: nothing consumes tokens until SBR-004
(public site) / SBR-006 (admin) author with `var(--token)`, and the preset row is SBR-009.
That is the artifact's own diagnosis ("nothing reads the tokens") — the contract is now
fixed, documented, and gated so those tasks build against it.

## Traps s4 confirmed or found

- 🔴 **`TokenResolver.generateCss` resolves a pure `var(--x)` token VALUE inline at stamp
  time** — a floor token defined as `var(--primary)` freezes to the hex and stops tracking
  overlays. Floor companions are static hexes on purpose; runtime derivations use
  `color-mix(...)`, which the resolver passes through verbatim and the browser keeps live.
- ✅ POL-006's floor (`body { font-family: var(--font-sans) }` in every stamped surface)
  means overriding the TOKEN is the effective font channel; `applyTheme`'s inline mirror
  only matters on unstamped surfaces.
- ⚠️ nodegx-backend tests only `require` JSON from the editor tree — the 12-key pin there is
  a deliberate literal; the seed↔contract binding lives in `sb004Authoring.test.ts` (which
  imports `siteTheme` like `sb007Template.ts` imports `ProjectImporter`).
- Standing s3 traps still live: sb017 helper total (101) moves only for cloud-component
  edits; `dev:debug` launcher exited unexpectedly 2× in s3 (read `.logs/dev.log` BEFORE
  deleting anything).

## After the sweep

SBR-002 closes on its AC4 drive. SBR-003's remaining §2 drive probes close its AC5; its
person-ACs verify with SBR-004/006/009. Then per build order: **SBR-004 (the public site
wears the theme)** — author `/Pages/Site` + `/Site/*` entirely from `var(--token)` against
the now-fixed contract (measure = `--site-measure`, radius = `--radius-md`, spacing =
`--space-*` steps); **SBR-008 (derive `prop-` ports in runtime)** stays independent and
unblocked.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written.
- Shared checkout: pathspec commits only (untracked ⇒ add+commit one chain); announce editor
  launches and teardowns to peers; `test:ci` alone; end the session by updating this file,
  TASKS.md s-log, and memory.
- Drive artefacts on this machine: "SBR Setup Drive" (backend `backend_mtcvrppkyv22t`:8590,
  hint verified), "SBR Drive Site" (s2, backend `backend_mtctpzoolycw4`:8589), "SBR Hello
  Control" (no hint, no backend), scratch "SBR No Backend" (pre-deadline graph — stale for
  AC4), all in `~/vscode_projects/NodeGX test projects/`. A peer's stopped backend on 8588
  ("sb015 site backend") is already claimed — not a clean fixture, deletable.
