# NAT-002 — The grey nobody can read

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `design-tokens`, `core-ui`, `editor`, `platform` |
| **Rulings** | ✅ D1 (fix the shared tokens) · 🔴 **D9 OPEN — does `fg-muted` survive?** |
| **Depends on** | **NAT-001** — the gate must exist and be seen failing first |

## The job

`--theme-color-fg-muted` is the design system's default secondary text colour and it fails AA in
both themes, at every elevation:

| on | dark (`#6b7682`) | light (`#7c8894`) |
|---|---|---|
| `bg-1` | 3.93 | 3.62 |
| `bg-2` | 3.66 | 3.43 |
| `bg-3` | 3.17 | 3.16 |

The platform already solved this for itself: `globals.css` defines
`--site-fg-secondary: var(--theme-color-fg-default-shy)` (5.98 / 5.34) and points every piece of
secondary copy at that instead. 🔴 **That is the fix, discovered and proven, sitting one repo away
and never brought upstream** — which is why the same content reads better on the web than in the
launcher that mirrors it.

Bring it home. Then delete the site's need for the override, so UNI-013's "one palette" is true
again rather than aspirational.

## Acceptance criteria

1. Every text pair in NAT-001's PAIRS table passes 4.5:1 in **both** themes. The specific rows
   above are quoted in the commit with their before and after ratios.
2. D9 is answered in the file, not by silence. If `fg-muted` is raised, the ramp keeps a distinct
   step between `fg-default-shy` and `fg-disabled` — a raise that collapses two tokens into the
   same colour has traded a contrast bug for a hierarchy bug, and the spec must assert they differ.
3. `--theme-color-fg-disabled` currently aliases `fg-muted` (`colors.css:462`). Whatever happens to
   `fg-muted`, disabled text ends up **deliberately** chosen rather than inheriting the decision.
   ⚠️ Disabled text is exempt from AA; that exemption is not a licence for the alias to keep
   carrying body copy.
4. `npm run tokens:sync` is run in `nodegx-community`, `tests/uni013-token-drift.test.ts` passes,
   and `tests/uni013-contrast.test.ts` **still** passes against the new values.
5. `--site-fg-secondary` is reconsidered in the same change: either it becomes a plain alias of the
   now-correct shared token, or the file states why the site still needs its own. A local override
   nobody re-examines is how the palette forked the first time.
6. The editor is **driven and looked at** after the change — not screenshotted for approval, but
   checked for the class of damage a global text-colour change causes: text that was
   deliberately quiet becoming loud, and any place that used `fg-muted` as a *border or icon*
   rather than text.

## Traps

- 🔴 **The blast radius is the entire editor**, and that is D1's accepted cost — but "accepted" is
  not "unmeasured". Grep every `fg-muted` consumer before changing it: some of them are borders,
  dividers and icon fills where the current value is correct and a raise is a visual regression.
  The token is doing two jobs and only one of them is broken.
- 🔴 **Measuring after the fix proves nothing.** NAT-001's gate must be observed red on the current
  palette, with the numbers recorded, before this task edits a single hex value.
- 🔴 **`colors.css` is vendored with a `source-sha256` in the header.** Changing the canonical file
  without re-running the sync leaves the platform on the old palette while every editor spec says
  the palette is fixed — a split that reads as "done" from either side alone.
- ⚠️ **Do not hand-edit the vendored copy** to test the site quickly. `tests/uni013-token-drift.test.ts`
  exists for that exact temptation and its failure message is the only thing standing between this
  and two palettes again.
- ⚠️ The light-theme `--theme-color-primary` (`#1570ef`) is **4.57:1** on white — it passes, by
  0.07. It is not this task's job to change it, but any tweak to the light ground puts it under the
  bar. If `bg-1` moves in light, re-measure the accent.
