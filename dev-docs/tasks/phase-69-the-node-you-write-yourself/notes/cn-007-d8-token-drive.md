# CN-007 §D8 — the cashflow kit on tokens: the drive

**Written BEFORE the editor was launched, 2026-08-16, session 14.** D8's obligation is that the
cashflow kit must be on design tokens *before* CN-007 cites it as the worked example. The change is
made; this is what would be observably true of a working one, written down first so a pass cannot be
read into a broken one.

## What changed

Two things, and the second is a behaviour change reasoned from source rather than measured:

1. **Every colour port default became a token.** 8 distinct hex values + 2 `rgba()` → 10 distinct
   `var(--token)` references, all 10 resolved against `buildDefaultTokenMap()` (the shipped map the
   exporter and the preview injector both read). The resolver was mutation-proven: `--green-6000`
   makes it exit 1 and name the token, the real kit exits 0.
2. **The duplicated in-JSX fallbacks were removed** — `props.positiveColor || '#1F8A4C'` became
   `props.positiveColor`. The claim this rests on is `react-component-node.ts:905-919`: a plain
   (non-CSS) input's declared `default` **is** assigned to props at initialize, so the `||` arm was a
   second copy of the decision, not a live fallback.

🔴 **If claim 2 is wrong, every pill, band and banner renders with no background at all.** That is
the single most valuable thing this drive can find, and it is why source-reading is not enough.

## The observations

### O1 — the tokens resolve to their token values, not to the old hex

**Expected**, on a `nodegx.cashflow.Pill` with **no colour parameter set** (the project sets none —
censused: `project.json` carries 3 hex, none of them on a kit colour port), read in the running
viewer:

| what | expected | what it excludes |
|---|---|---|
| `getComputedStyle(el).backgroundColor` on a positive pill | **`rgb(22, 163, 74)`** (`--green-600` = `#16a34a`) | — |
| | *not* `rgb(31, 138, 76)` | the old `#1F8A4C` — i.e. the edit never reached the viewer |
| | *not* `rgba(0, 0, 0, 0)` / `transparent` | **claim 2 is wrong**: the default never reached props |

⚠️ **This is the discriminator, and it only works because the two greens differ.** `#1F8A4C` and
`#16a34a` are both "green"; an eyeball comparison of a screenshot would report success for either.
The observation has to name **the rgb triple**.

### O2 — the token is delivered, not merely referenced

Read `getComputedStyle(document.documentElement).getPropertyValue('--green-600')` in the same viewer.

| `--green-600` on `:root` | pill background | reading |
|---|---|---|
| `#16a34a` | `rgb(22,163,74)` | ✅ working |
| `#16a34a` | `rgba(0,0,0,0)` | claim 2 is wrong — the default never arrived |
| empty | `rgba(0,0,0,0)` | **token delivery** is broken, nothing to do with this change |

Without this row a missing token and a missing default produce the same `rgba(0,0,0,0)` and have
different fixes — CN-006's O2 hit exactly this and the discriminator earned its place.

### O3 — no `var(` leaks as literal text, and the sweep is not dead

The string `var(--` must appear **0** times in the viewer document's *computed* colour values. ⚠️ A
count of 0 is worthless on its own: the same sweep must also report a **non-zero** count of `var(--`
in the document's CSS text, or the instrument is not looking at anything.

### O4 — the banner's two arms, because only one is on screen at a time

`SafetyBanner` picks `safeColor`/`dangerColor` by a boolean. A drive that only ever sees the safe arm
says nothing about `--red-50`. Read both by flipping the driving value, or read the declared defaults
off the node's ports and confirm both arms' tokens resolve.

---

# THE RESULTS — written after the drive

🔴 **NOT DRIVEN IN s14. The observations above stand unmeasured.**

A peer's editor stack held port 9222 for the whole session (`dev-debug.js` pid `24529`, Electron
`. --dev` pid `27909`, launched ~1 minute before I first checked and still live 16 minutes later).
Two editors cannot coexist on this checkout even on a different port, so driving would have meant
evicting a peer mid-session. It was not worth that.

**What IS measured, and what is therefore still open:**

| claim | status |
|---|---|
| all 10 token names resolve in the shipped map | ✅ measured, mutation-proven (`--green-6000` ⇒ exit 1) |
| `color` ports carry no units, so a token default passes through | ✅ read in source, `react-component-node.ts:914-918` |
| every token is emitted to `:root` | ✅ read in source, `TokenResolver.generateCss` emits the whole map |
| **the pill actually renders `rgb(22,163,74)` in a browser** | 🔴 **UNMEASURED — this is the drive** |
| **removing the `\|\|` fallbacks did not blank every node** | 🔴 **UNMEASURED — this is the risk** |

⚠️ **The last two rows are the ones that matter**, and the reason is CN-006's O2: source-level
readings of exactly this kind were true while the rendered result was broken. Three green source
facts do not add up to a rendered pixel. **Do not report D8 as visibly closed without this drive.**

⚠️ **Free to check on the same drive:** whether the editor's colour picker renders sensibly for a
`color`-typed port whose value is a `var(--token)` string. The parameter panel shows a swatch; a
`var()` may not paint one. Nothing depends on it, but it is one eval away once the editor is open.
