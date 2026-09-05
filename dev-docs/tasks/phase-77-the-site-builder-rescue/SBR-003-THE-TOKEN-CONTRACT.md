# SBR-003 — The token contract

**Fixes finding 3's root.** The contract everything downstream (SBR-004..009, 011, 012)
depends on. **Settled at scoping (s1) — this task implements and verifies it.** The design
question "where do defaults live when a fresh site has no `Theme` row" is answered by the
platform, not by new machinery.

**The person sentence** — added by [SBR-013](SBR-013-THE-DOCTRINE-RULE.md) AC3, which requires this
phase to comply with the rule it wrote. Unnumbered on purpose: `SBR-003 §2` is cited from
[SBR-004](SBR-004-THE-PUBLIC-SITE-WEARS-THE-THEME.md#L136) and the sections must not renumber.

> **Someone who publishes a site and then wants it to look different changes the colour in ONE
> place and the whole site follows** — the theme editor, the public pages and the admin shell
> together — because every colour and every measure on it names a token rather than a value.

## 1. The contract, as ruled

1. 🧭 **The shipped 182-token vocabulary IS the contract**
   (`noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens.ts`). No new namespace.
   The screens artifact's `--m-*` table maps onto it:

   | screens artifact | shipped vocabulary |
   |---|---|
   | `--bg` / `--surface` | `--background` / `--surface` (+ `--surface-raised`) |
   | `--ink` / `--ink-soft` | `--foreground` / `--muted-foreground` |
   | `--primary` / `--on-primary` | `--primary` / `--primary-foreground` |
   | `--line` | `--border` (+ `-subtle`, `-strong`) |
   | `--radius` | `--radius-sm/md/lg…` (site uses one step consistently) |
   | `--space` | `--space-1…32` and `--space-xs…3xl` aliases |
   | `--font` / `--font-ui` | `--font-serif` / `--font-sans` |
   | error / success | `--destructive(-foreground)` / `--accent`, `--primary` |
   | `--maxw` | **new custom token** (name at implementer's choice, e.g. `--site-measure`) — custom tokens are supported (`StyleTokensModel` "Add a brand-new custom token") |

2. ✅ **Defaults = the Studio preset authored as project token overrides** in the template's
   project metadata (`STYLE_TOKENS_METADATA_KEY = 'designTokens'`,
   `ProjectTokenCss.ts:15-16`). `generateProjectTokenCss` stamps defaults+overrides as
   `:root {}` **into the deployed index.html** (`ProjectTokenCss.ts:50-60` — "This is what the
   exporter stamps"; editor preview goes through `PreviewTokenInjector`). **An unclaimed site
   with zero records renders the full Studio look.**

3. ✅ **The `Theme` record is a runtime overlay of the same names.** `applyTheme` (already in
   the template) writes tokens onto `document.documentElement.style` — element-level style wins
   over the `:root` stylesheet rule, so overrides beat defaults with no new mechanism. Extend
   the record schema from 3 fields to the subset a client may edit: primary, background,
   foreground, surface, border, radius step, display font, UI font, measure — final list is
   this task's deliverable, written down in the template's project doc.
   🔴 **No per-component `var(--x, fallback)` fallbacks** — that duplicates defaults into every
   component and is the second-copy-drifts trap. One default writer (`designTokens`), one
   overlay writer (`applyTheme`).

4. **Presets are data.** Studio / Press / Night live as rows or a JSON constant the theme
   editor offers (values from the screens artifact: Studio `#1e4d8c` on `#fbfaf8` serif r6;
   Press `#8c2f22` on `#f5efe6` serif r2; Night `#d9a441` on `#14161a` sans r10). Studio is
   what the shipped `designTokens` block carries; picking a preset writes the Theme record.

## 2. What must be verified, not assumed

- ⚠️ `{value,unit}` (dimension) ports accept `var(--token)` per `WIRE_FORMAT_LEGEND`
  (`validation/parameterValues.ts:395-420`) — **verify with a rendered probe** (a maxWidth from
  a token actually constrains a box in the viewer), not by quoting the legend.
- ⚠️ The template's `ProjectContent` metadata actually carries the `designTokens` block through
  `EmbeddedTemplateProvider.install`, and the **public-site deploy path** actually stamps the
  `:root` block (spec against the deployed artefact, not the editor preview).
- ⚠️ `applyTheme`'s writes visibly beat the `:root` defaults in the running viewer (flip
  primary, observe a button change).
- 🔴 A token flip is invisible in the same `cdp eval` call — read back in a second call.

## 3. Acceptance criteria

1. **(person)** A never-claimed, zero-record site already looks like Studio — colours, type,
   radius, spacing — in the editor preview AND in a folder deploy.
2. **(person)** Claiming the site and picking the Night preset changes the public site and the
   admin panel — every surface, not a stripe of it.
3. The Theme record's field list and the preset values are written into the template's project
   doc (the door's `get_project_doc` surface) so the next authoring session reads the contract
   instead of rediscovering it.
4. Deleting the Theme row falls the site back to Studio (defaults are the floor —
   `buildEffectiveTokens` semantics, mirrored at runtime).
5. The probe specs of §2 exist and are green — each one paired with a control that proves the
   instrument can fail (an unknown token does NOT constrain the box).

## 5. Status (s4, 2026-08-28 — BUILT, SWEPT AND DRIVEN; hold cleared mid-session)

**Built, specs written; hold cleared mid-session and everything ran (see §6).**

- **The contract module**: `models/template/templates/siteTheme.ts` — `THEME_TOKEN_FIELDS`
  (the final field list, 12 fields: `colorPrimary`, `colorOnPrimary`, `colorBackground`,
  `colorSurface`, `colorText`, `colorTextSoft`, `colorBorder`, `colorAccentSoft`, `radius`,
  `fontDisplay`, `fontUi`, `measure`), `SITE_THEME_PRESETS` (Studio/Press/Night, values
  verbatim from the screens artifact), `buildSiteDesignTokens()` (Studio + 7 static
  companions: `--primary-hover --ring --accent-foreground --surface-raised --border-subtle
  --border-strong --muted`), `buildThemeDoc()` (docs/THEME.md, generated). One source; the
  descriptor, the doc and the graphs all read it.
- **The floor**: `ProjectTemplate.designTokens` + `docs` fields; `EmbeddedTemplateProvider.
  install` writes `metadata.designTokens` (`STYLE_TOKENS_METADATA_KEY`) and validated
  `docs/*.md` files (`assertTemplateDocPath` — throws on any path outside docs/).
  `site-builder.template.ts` declares both.
- **The overlay**: `applyTheme` (sb006) reads the 12 keys, writes the same-name tokens onto
  `documentElement.style`, derives companions via `color-mix` (hover 82% black; border steps
  45%/65% toward `var(--background)`/`var(--foreground)`), mirrors `fontUi` onto inline
  `font-family` (belt-and-braces: the stamp's `body{font-family:var(--font-sans)}` floor —
  POL-006 — is the effective channel on stamped surfaces).
- **Writers**: `buildTokens` (sb005) writes all 12 (unwired inputs ⇒ `''` = no override;
  the font field now feeds `fontDisplay`); `seedTheme` (sb004) seeds all 12 empty.
- **Pins updated**: `sb004Authoring.test.ts` (seed bound to `THEME_TOKEN_FIELDS`),
  `sb004-publication-invariant.test.ts` (12-key literal, binding is on the mcp side),
  `sb008-public-site-drive.test.ts` (PUT body 12 keys).
- **New specs**: `tests-unit/sbr-003/token-contract.test.ts` — vocabulary resolution (+
  can-fail control), preset completeness/hex validity (+ non-hex control), floor = Studio,
  install writes metadata+doc for site-builder and NOT hello-world, doc path validator
  refusal table, `generateProjectTokenCss` stamps `#1e4d8c`/`6px`/`44rem` and DROPS
  `#3b82f6` (bare-project control keeps it, lacks `--site-measure`), and a post-regeneration
  gate: the shipped artefact's applier reads every contract field.

## 6. The sweep and the drive (s4, after Richard cleared the hold)

**Gates, in order, all green:** `template:site-builder` regenerated (19 components, 5 pages) ·
`typecheck:editor` **0** · `typecheck:mcp` **0** · `test:ci` **2863 specs / 4 failures, all four
`AIX-006 style vocabulary` by name** (floor exactly; fresh `test-results.json`) · `test:main`
**6253/6254** — the one red was this task's own doing (sb-007's *exhaustive* written-files pin
saw the new third write `docs/THEME.md`; pin updated deliberately, suite 12/12) · mcp
sb004/005/006/007 **91/91** · backend `sb004-publication-invariant` **35/35** and
`sb008-public-site-drive` **20/20** (built first).

**AC1 (floor, live):** wizard-created project's `nodegx.project.json` carries
`metadata.designTokens` (19 tokens, `--primary #1e4d8c`, `--radius-md 6px`,
`--site-measure 44rem`) beside `initialOpenComponent`, and `docs/THEME.md` lands on disk. The
running preview's `:root` carries the Studio values and `--site-measure`.

**AC2/AC4 (overlay and fallback, live):** wrote Night's `#d9a441 / #14161a / #eceae5` into the
real `Theme` row through the claimed site, reloaded, read back in a SECOND eval —
`documentElement` inline style carried `--primary`, `--primary-hover`
(`color-mix(in srgb, #d9a441 82%, black)` — resolved live by the browser, not frozen), `--ring`,
`--accent-foreground`, `--background`, `--foreground`. Deleted the row, reloaded: inline style
`null`, every token back at the Studio floor. **The deployed `claimSite` seeded exactly the
twelve contract keys** — the contract survives the door, the generator and a real backend.

**AC3:** `docs/THEME.md` ships and reads as the contract.

**AC5:** the spec probes are green. ⚠️ **Still owed: the `var(--token)` dimension-port rendered
probe** (a `--site-measure` maxWidth constrains a real box; unknown-token control does not).
Nothing consumes the measure token until SBR-004, so this probe belongs with it.

**Still true:** AC1/AC2's *person* sentences ("looks like Studio", "every surface changes") are
only half-verified — the tokens demonstrably reach `:root` and the overlay demonstrably beats
them, but no component reads them yet. SBR-004/006 make that visible; the contract is now fixed,
documented and gated for them.

**Owed after s4:** only the `var(--token)` dimension-port rendered probe (§2, first bullet) —
carried into SBR-004, which is the task that first uses the measure token.

**AC status:** AC3 done (doc ships, generated). AC5 half done (spec-able probes written;
drive probes owed). AC1/AC2/AC4 are person-sentence drives that CANNOT pass yet on visuals:
nothing in the template consumes tokens until SBR-004/006 author with `var(--token)` — the
artifact's own diagnosis ("nothing reads the tokens"). They verify after SBR-004 (public
site), SBR-006 (admin), SBR-009 (preset row picks Night). The contract they verify against
is now fixed and documented.

---

## 6. ✅ AC5 CLOSED — the owed rendered probe, built and read (s51, 2026-09-05)

**The last item SBR-003 was carrying.** §2's first bullet said the `{value,unit}` ports accept
`var(--token)` *per `WIRE_FORMAT_LEGEND`* and then refused to close on that: **"verify with a
rendered probe … not by quoting the legend."** At s4 nothing consumed the token, so the probe had
nowhere to stand. `/Pages/Site`'s `shell` consumes it now
([`sb006Components.ts:1918`](../../../packages/noodl-mcp/tests/sb006Components.ts)).

**Home:** `sb008-public-site-drive.test.ts` §7 — the drive that already boots a real backend and a
real browser over the shipped graph. Instrument:
[`noodl-mcp/tests/measureClamp.ts`](../../../packages/noodl-mcp/tests/measureClamp.ts).

### The reading — both arms, 1280×900, anonymous, enforcement on

| | `--site-measure` on `:root` | shell computed `max-width` | shell | frame | frame padding |
|---|---|---|---|---|---|
| **shipped graph** | `44rem` | **`704px`** | **704** | 1280 | 48 |
| **control: `var(--sbr003-no-such-token)`** | `44rem` | **`none`** | 1232 | 1280 | 48 |

✅ **A dimension port really does carry `var(--token)` into CSS, and the clamp BINDS** — 704 inside
a 1280 frame, so it is doing work rather than agreeing with a box that was that size anyway.
✅ **The control fires exactly as §2 predicted it should**: an unknown token does not constrain.

🔴 **What makes it a probe of the PORT and not of the token: `--site-measure` is defined on `:root`
in BOTH arms.** The control changes what the port *references*, never what the token *is*. Deleting
the definition instead would have produced the same two numbers for a reason that says nothing
about ports at all.

🔴 **Identification is derived, not a selector.** `shell` is the parent of the `<main>` REL-011c's
`siteMain` added, and §6 next door proves there is exactly one `<main>` per load; the arm asserts
the box it found holds the nav band and the `h1` and is not the `<main>`. A `#shell` literal is how
`sbr010`'s D42 went stale when a project-wide id pass renamed `#pick` to `pick-2`.

### 🔴 The first run was WRONG, and it was wrong in the shape of the defect being hunted

**Both arms came back identical — `max-width: none`, `--site-measure` empty.** That fits
*"the dimension port drops `var(--token)`"* perfectly, which is the exact thing §2 was written to
suspect. It is **a fact about the fixture**: `authorSiteTemplate` never performs the editor's
install step, and `render-from-disk` takes custom tokens from `metadata.designTokens` alone. Every
token the template *overrides* still resolved — the page looked correctly themed — and only the one
token it *mints* was missing. Registered as
**[D57](DEFECTS-THE-SITE-BUILDER-FOUND.md#d57)**; the seam is fixed
(`applyTemplateDesignTokens` exported from `helpers/site-drive.ts`, `vib001-site.look.ts` now
imports what was its private copy), the other twelve drives are a sweep with its own before/after
and are **not** done.

⚠️ **Two assertions were PREDICTED wrong and reconciled rather than edited to fit.** The control was
predicted to fill the frame at 1280 and measured **1232**; the pair was predicted at 576px and is
**528**. The prediction was wrong about the geometry, not the claim — `shell` states `width: 100%`
so unclamped it fills its parent's *content* box, and `frame` carries 48px of horizontal padding.
The probe gained a `framePaddingX` field so the control now asserts the **equation**
(`shell = frame − padding`) instead of a literal somebody could quietly re-fit later.

### Gates

- `sb008-public-site-drive.test.ts` — **31/31, EXIT=0** (24 pre-existing + 7 new), 41.5s.
  §7's readings are taken on **copies** of the project, so the 24 existing readings are byte-for-byte
  the ones they were: `customTokens` carries the whole Studio palette, and installing it into the
  shared project would have moved every colour the rest of the file reads.
- The five red arms are recorded, not just the green one: run 1 read **5 failed / 26 passed** with
  the fixture gap, run 2 **2 failed / 29 passed** with the two mis-predicted literals.
- `typecheck:mcp` — **EXIT=0, 0 errors** (it covers `tests/**/*.ts`, so it is what grades `measureClamp.ts`).
- `vib001-site.look.ts` loads and collects its 2 tests after the refactor. ⚠️ **Its photographs were
  NOT re-taken** — the change is import-only and its behaviour is identical, but that is an argument,
  not a render.
- ⚠️ **`typecheck:backend-tests` was not run**: it is unrunnable on this box (OOM through
  `noodl-mcp/src/server` via `helpers/site-drive.ts`, bisected under REL-011 §7), and ts-jest here
  runs `isolatedModules: true`, so **the green suite is not a typecheck** of the two backend-test
  files this touched.

**AC5 is met.** AC3 was already done. AC1/AC2/AC4 remain person-sentence drives.
