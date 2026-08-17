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

✅ **DRIVEN 2026-08-17, session 15. O1, O2 and O4 MET. O3 turned out to be unmeasurable by
construction — see below, it is the most useful thing here.** Screenshot:
[cn007-d8-tokens-driven.png](cn007-d8-tokens-driven.png).

Driven on `NodeGX test projects/cn069-s15-drive`, a `cp -R` of `cashflow-command-centre` — ⚠️ the
**only** copy of the cashflow kit carrying the D8 change. The copies in `cn001-kit-drive` and
`cn019-drive` are pre-D8 (0 × `var(--`, 6 × live `#1F8A4C`); driving either would have measured the
old kit and reported a clean failure to see the change.

## O1 ✅ — `rgb(22, 163, 74)`, the discriminating value

Positive pills, no colour parameter set anywhere in the project, read in the running viewer:

| element | `backgroundColor` |
|---|---|
| `+£2,400` | **`rgb(22, 163, 74)`** |
| `+£1,800` | **`rgb(22, 163, 74)`** |
| distinct values across both | exactly one |

Not `rgb(31, 138, 76)` (the old `#1F8A4C`), so the edit reached the viewer. Not `rgba(0, 0, 0, 0)`,
which is the reading that would have meant claim 2 was wrong.

🔴 **So claim 2 is CONFIRMED, and that was the real risk of this change.** Removing
`props.positiveColor || '#1F8A4C'` did **not** blank the node: a plain (non-CSS) input's declared
`default` really is assigned to props at initialize. Negative pills corroborate on the other token —
`rgb(220, 38, 38)` = `--red-600`.

## O2 ✅ — the token is delivered, not merely referenced

`getComputedStyle(document.documentElement)` in the same viewer: `--green-600` = `#16a34a`,
`--red-600` = `#dc2626`, `--green-50` = `#f0fdf4`, `--red-50` = `#fef2f2`. So the `rgb(22,163,74)`
above is a delivered token resolving, not a coincidence — the row that separates "missing token" from
"missing default", both of which paint `rgba(0,0,0,0)`.

## 🔴 O3 — RETIRED. The sweep cannot fire, so its 0 was never evidence

O3 asked for `var(--` to appear **0** times in computed colour values, with a non-zero count of
`var(--` in the document's CSS text as its liveness control. Measured: **0 leaks, 2 CSS rules
containing `var(--`** — i.e. it "passed", control and all.

**It cannot fail.** Planting a deliberately unresolvable token proves it:

```js
probe.style.backgroundColor = 'var(--definitely-not-a-real-token)';
getComputedStyle(probe).backgroundColor  // → "rgba(0, 0, 0, 0)", NOT the literal string
```

CSS `var()` is substituted at computed-value time; a standard colour property never retains the
literal text, whether the token resolves or not. So *"0 `var(` in computed colour values"* is equally
true of a perfect page and of a page where **every** token is broken.

⚠️ **The liveness control I was told to use did not save it.** "The document's CSS text contains
`var(--` somewhere" is true of any tokenised stylesheet and says nothing about whether *this sweep*
could detect *this fault*. A control has to be a **known-broken input fed to the instrument itself**,
not a sign of life taken from somewhere nearby. This is the phase's "probe that silently exonerates"
in its purest form, and it was written into the observations *by* the practice meant to prevent it.

**O3's intent is already fully covered by O1 + O2**, which read the resolved triple and compare it
against the token's own value — a broken token shows up there as `rgba(0,0,0,0)`.

## O4 ✅ — both arms, by flipping the driving value

`dangerDay` is driven by a connection from the JS function's `out-DangerDay`, so a parameter set
alone does nothing. The connection was removed (passing the connection **object**, not a literal),
`dangerDay` set to 12, both arms read, then the connection restored and the safe arm confirmed back.

| arm | text | background | colour |
|---|---|---|---|
| safe | `✓ Nothing unaffordable this month.` | `rgb(240,253,244)` = `--green-50` | `rgb(22,163,74)` = `--green-600` |
| danger | `⚠ Short by +£0 on Wed 12 — move something.` | `rgb(254,242,242)` = `--red-50` | `rgb(220,38,38)` = `--red-600` |

Restored: 7 connections in, 6 during, 7 out, and the banner reads the safe arm again.

⚠️ **Still not checked, and still one eval away:** whether the editor's colour picker paints a swatch
for a `color` port whose value is a `var(--token)` string. I switched projects to re-record the
CN-003 fixture before getting to it. Nothing depends on it.
