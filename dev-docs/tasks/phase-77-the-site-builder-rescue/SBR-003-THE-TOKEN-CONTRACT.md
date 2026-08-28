# SBR-003 — The token contract

**Fixes finding 3's root.** The contract everything downstream (SBR-004..009, 011, 012)
depends on. **Settled at scoping (s1) — this task implements and verifies it.** The design
question "where do defaults live when a fresh site has no `Theme` row" is answered by the
platform, not by new machinery.

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
