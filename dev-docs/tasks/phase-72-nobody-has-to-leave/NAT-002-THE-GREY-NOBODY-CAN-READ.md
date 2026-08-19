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

---

## Done — 2026-08-19

**Gate:** `tests-unit/nat-001/palette-contrast.spec.ts` — **123 passed, 123 total**. It was
[observed red at 22 failures](NAT-001-THE-CONTRAST-FLOOR-THE-EDITOR-NEVER-HAD.md) on the
unmodified palette first; that observation is what this entry is measured against.

### AC2 — D9 answered

🔴 **`fg-muted` is retired, not raised.** Richard's ruling, against this file's own recommendation:
it is now `var(--theme-color-fg-default-shy)`. The ~217 `color:` declarations that name it keep
working and every one of them gets AA. The "quieter than shy" step is gone, and that was accepted
explicitly rather than by silence.

The value it held did not vanish — it was already carried deliberately by two other tokens, which
is the part that made the retirement safe:

| token | dark | light | why it keeps `neutral-600` |
|---|---|---|---|
| `--theme-color-fg-disabled` | `#6b7682` | `#7c8894` | AC3. It used to **alias** `fg-muted`, so retiring that token would have silently made disabled text as loud as secondary text. Now chosen. |
| `--theme-color-border-control` | `#6b7682` | `#7c8894` | POL-016 already added it for 1.4.11 boundaries. 🔴 **It existed the whole time** — the launcher's ghost button was using `bg-3` (1.32:1) while the right token sat unused. |

### AC1 — the pairs, before → after

| pair | dark | light |
|---|---|---|
| launcher tab body copy | 4.18 → **7.28** | 3.19 → **5.31** |
| launcher "Try again" | 7.37 → 7.37 | 4.03 → **5.20** |
| launcher button border | 1.32 → **4.18** | 1.01 → **3.19** |
| composer Shy copy (bg-4) | 4.09 → **4.67** | 4.33 → **4.88** |
| composer sign-in error (bg-4) | 4.46 → **6.40** | 3.92 → **5.33** |
| `fg-muted` on bg-3 | 3.17 → **5.86** | 3.16 → **5.62** |
| link on bg-3 | 5.58 → 5.58 | 3.99 → **5.14** |
| success on bg-2 | 8.10 → 8.10 | 3.81 → **6.16** |

### 🔴 Two rulings this task had to raise before it could finish

The scoping pass framed this as one token. It is three. **D11** (accent) and **D12** (status) are
recorded in [README §4](README.md); both were settled by Richard on the measurements above.
Neither is reachable by fixing `fg-muted` — the accent fails in a theme the review never looked at,
and `danger` fails in *dark*, which contradicts the whole "too dark" framing the review started
from.

### One token added, and one half-step

- `--theme-color-node-category-default` — the canvas painted an **uncategorised node** with
  `fg-muted`, a foreground borrowed as a category hue. Retiring `fg-muted` would have lightened
  every uncategorised node card on the graph as a side effect of a *text* fix. Both themes keep
  exactly the colour they had.
- `--base-color-neutral-750: #95a0ac` — the ramp had no tone between "secondary" and "body" that
  clears 4.5:1 on **bg-4**, and bg-4 is what `BaseDialog` paints, so it is the ground of *every*
  dialog in the editor. `fg-default-shy` measured 4.09 there and had to move, because D9 made it
  the target of everything `fg-muted` used to carry.
  ⚠️ The step from `fg-default` narrows 1.38 → **1.21** (dark) and 1.40 → **1.25** (light). Still
  a visible hierarchy, and now asserted as one so a later raise cannot quietly collapse it.

### AC4/AC5 — the platform half

`npm run tokens:sync` run in `nodegx-community`; `uni013-token-drift` **22/22**, `uni013-contrast`
**150/150** after two fixes *on that side*:

1. 🔴 **Its known-bad control had rotted the same way mine did.** `fails the pair that was actually
   wrong — fg-muted on the light page ground` started **failing because the palette got better**
   (3.19 → 5.31). Replaced with a self-calibrating control that cannot rot: measure a passing pair,
   then demand 0.01 more than it scores.
2. Its pinned `--site-fg-secondary` values follow the raise (`#95a0ac`/`#5a6470`) — which is the
   alias working, and the reason that row is a pin rather than a range.

**AC5 — `--site-fg-secondary` stays, as a plain alias, and the file now says why.** ⚠️ It was
*never* a forked value — it has always been `var(--theme-color-fg-default-shy)`. The fork was in
the **usage**: the site refused `fg-muted` while the editor went on painting body copy with it.
D9 removes that at the source, so "one palette" is true again without deleting the role name. The
name earns its place the day the site needs a tone the editor does not have.

### 🔴 Remainder — the queue this task deliberately did not clear

**~99 files still paint words with a fill role** (`color: var(--theme-color-primary|success|
notice|danger)`, 202 declarations). NAT-002 migrated the **design system's text primitive**
(`Text.module.scss` — anchors and the three status types) and the community surfaces. The rest are
components that hand-rolled a colour instead of going through `Text`, and a grep cannot tell those
apart from `currentColor` icon fills.

⚠️ **They are sub-AA in light today and this task did not fix them.** Scaling that migration down
was a scoping decision, and it is recorded here rather than left to be discovered:
**NAT-005 should take the ones on the community surfaces; the rest want their own task with a
ratchet spec** (a count that may only go down), because nothing currently stops a hundredth.

### AC6 — driven and looked at

Editor launched 2026-08-19 (`dev:debug`), project opened, **both themes**, stack torn down after.

**Token values read out of the live renderer**, not the source file — because the spec grades
`colors.css` and only a running editor proves the cascade delivers it:

```
--theme-color-fg-muted          #95a0ac   (= fg-default-shy: the alias is live)
--theme-color-fg-default-shy    #95a0ac
--theme-color-fg-disabled       #6b7682   (kept its value, no longer an alias)
--theme-color-fg-accent         #4da3ff
--theme-color-fg-danger         #fda29b
--theme-color-border-control    #6b7682
--theme-color-node-category-default  #6b7682
```

**Rendered contrast, light theme, measured off composited pixels** (walking up for the real
ground rather than assuming one): panel viewer line **7.10:1**, list row title **7.10:1**, the
health readout — the `Shy` type, the one that moved — **5.70:1**. All clear.

**What was looked at:**
- 🔴 **The node canvas, both themes.** Node cards, the type line under each node name, and the
  category tint. `cardSubText` takes the raise (it is words, and it was 3.93:1); the category hue
  and the rect-select box are **pixel-identical** to before, which is what
  `node-category-default` and `border-control` were for. Confirmed the canvas *re-resolves* on a
  theme change rather than caching the first palette it saw.
- **The launcher's Community tab.** The line the whole task is about is legible, and 🔴 **the
  "Open community.nodegx.io" button now has a visible edge** — it had been drawing a 1.32:1
  border, so the control had no boundary at all. That is a defect the eye finds instantly and no
  spec had ever asked about.
- **The rail panel**, both themes.

**⚠️ Stated limits, because a drive that does not say what it skipped reads as full coverage:**
- The theme was flipped by setting `data-theme` directly, not through `ThemeManager`. That
  exercises the palette, which is what this task changed; it does **not** exercise the switch.
- The **composer dialog was not opened**. Its two failing pairs (`fg-default-shy` and `danger` on
  bg-4) are the same tokens verified above, but the surface itself was not seen. NAT-007 opens
  this dialog for real and should look.
- The remaining non-text `fg-muted` consumers outside the canvas — scrollbar thumbs on hover, the
  `Select` separator, a few icon fills — were **reasoned about and not driven**. All move in the
  same direction (more visible), so none is a contrast regression, but none was looked at.
- 🔴 **`bg-1` cards on `bg-0` remain 1.06:1.** Visible in both screenshots: the node cards and the
  page ground are one surface. This task did not touch it and NAT-003 owns it.
