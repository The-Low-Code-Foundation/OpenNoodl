# POL-016 — the two findings POL-005 filed and nothing tracked

**Split out of** [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md)'s *"Three findings from the
layout pass — filed, not fixed"*, on 2026-08-04 (sixth session), after Richard noticed the register
was not telling him about them.

**Status:** ✅ **done** (2026-08-04, seventh session). Both halves built and verified live against a
running backend in both themes. **The framing below was wrong in one important way — see
*"What the survey found"*.**

## Why this file exists at all

POL-005's layout pass produced three findings. The first became
[POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md), was built and is done. The other
two were written into POL-005's prose and into one cell of the `PROGRESS.md` table, and **nothing
ever tracked them again** — they are invisible in the status line, in the task count, and in every
handover since. The phase was reported as "nothing open" while they sat there.

That is the actual defect being fixed here: *a finding recorded only as prose inside a done task is
a finding that has been lost.* Anything filed-not-fixed gets a row from now on.

## 1. "Save policy" is invisible as a button

On the Sign-in backend surface. Measured in the running editor during POL-005's drive:

- It is a real `PrimaryButton`, 90×30, `is-variant-muted`.
- Computed background `rgb(247, 249, 251)` against a panel that is essentially the same colour, with
  `border-width: 0`.
- So **the only save control on that surface reads as plain text**, in both themes.
- Every sibling surface uses an ordinary button for its action — "Add role", "Issue key", "Add
  provider".

**This one needs Richard's decision before it is built**, and the decision is not which colour:

- **(a) `muted` is wrong *here*.** One-line variant change on this button. Cheap, and leaves the
  variant alone everywhere else.
- **(b) `muted` is wrong *generally*.** A variant whose background is within a hair of every surface
  it sits on, with no border, cannot read as a control anywhere. That is a `PrimaryButton` fix and a
  sweep of its call sites — bigger, and it would want the same before/after treatment POL-013's
  census gave the icons.

Do **not** answer this by looking at the button in isolation. Count the `is-variant-muted` call sites
and look at two or three of the others first; if they are all sitting on `bg-2`, the variant is the
defect and (a) is a plaster.

## 2. Schema's header is bespoke

Six backend surfaces use icon + title + subtitle + X. Schema uses a plain title with a
`+ New Table / Refresh / Close` group and no backend subtitle. Cosmetic, pre-existing, and newly
conspicuous now that POL-005 made the surfaces the only thing in the panel.

Lowest priority in the phase. It is listed so it is a decision rather than an oversight: either
bring it onto the shared header, or write down that it is deliberate because Schema's actions do not
fit the shared one.

## Criteria

1. The Sign-in surface's save control reads as a control in both themes — measured, not asserted
   (contrast of the button against the panel it sits on, the way POL-003 measured the rail).
2. Whichever of (a)/(b) is chosen, the **reason** is written down, and if (b), the other
   `is-variant-muted` call sites are surveyed rather than assumed.
3. Schema's header is either on the shared header or has a recorded reason not to be.
4. Both are verified in the running editor against a real backend, not in a fixture — these are
   backend surfaces and POL-005's whole point was that they only exist when one is running.

## What the survey found — the (a)/(b) question was the wrong question

Counting the call sites first, as this file said to, is what moved the premise.

**"Add provider", "Add role" and "Issue key" are not ordinary buttons. They are the identical
`Muted` variant.** The three surfaces this file cited as evidence that `Save policy` was special all
use `PrimaryButtonVariant.Muted`, exactly as it does. What differs is only what is painted *behind*
them: those three sit inside a `.Section` (`bg-1`), and `Save policy` sits in `.RowActions` directly
on `.Body` → `.Root` (`bg-2`).

And `muted` **is** `bg-2`. So on that panel the button and its surface are literally the same token —
not low contrast, **exactly 1.00:1**, by construction. Measured live, before the fix:

| | dark | light |
|---|---|---|
| `Save policy` (muted on a bg-2 panel) | `#181d24` on `#181d24` = **1.00:1** | `#f7f9fb` on `#f7f9fb` = **1.00:1** |
| `Add provider` (muted on a bg-1 card) | `#181d24` on `#12161b` = **1.07:1** | `#f7f9fb` on `#ffffff` = **1.06:1** |
| `Send test email` (muted-on-low-bg) | `#222933` on `#12161b` = **1.24:1** | `#ecf0f4` on `#ffffff` = **1.15:1** |

A muted button's fill measures **1.00–1.24:1 against every surface it can land on, in both themes**.
None of them read as controls; only their *labels* ever had contrast. `Add provider` looked fine next
to `Save policy` the way anything looks fine next to something worse.

So the choice was never (a) *"wrong here"* versus (b) *"wrong generally"*. It was **wrong
everywhere**, and the reason is structural: `muted` paints a background token off the same elevation
ladder the surfaces beneath it use, so its contrast depends on a surface the call site does not know
and cannot see. **143 call sites** — 118 `Muted` plus 25 `MutedOnLowBg` — each got that right or wrong
by luck. The design system half-admits this already: `MutedOnLowBg` exists as a second shade for the
same problem, and it fails too.

*(Count `PrimaryButtonVariant\.Muted\b` with the dot escaped and the word boundary on. `Muted` is a
prefix of `MutedOnLowBg`, so the obvious grep conflates the two — and an unescaped `.` over-matches
on top of that. This session's first number was 146 and it was wrong twice over.)*

**Richard's decision (answer 9): give the variant a border**, so it cannot be invisible, rather than
re-pointing one call site at the other shade.

### Why the ring is not `border-*`

None of the three border tokens can carry it. Against bg-1/bg-2/bg-3 they measure **1.01–1.73:1** —
correct for a hairline between two regions, and nowhere near the **3:1** WCAG 1.4.11 asks of anything
that has to be *identified* as a control. The lightest existing value that clears 3:1 on all three
surfaces in both themes is this theme's `fg-muted`, so a purpose-named
**`--theme-color-border-control`** carries it (dark `neutral-600`, light `#7c8894`) — 3.16:1 at its
worst measured point, 3.93:1 at its best. A divider tone and a control boundary are different jobs
and now have different names.

### Why an inset shadow rather than `border`

Nothing in this repo sets a global `box-sizing`, so a real 1px `border` would have grown all 143 call
sites by 2px in each dimension — the trap `BasePanel.module.scss` already records against itself. An
inset ring paints on the same edge and costs no layout: measured `border-width: 0px`, and the buttons
keep the size POL-005 recorded.

## Outcome

**Both halves done.**

1. `is-variant-muted` and `is-variant-muted-on-low-bg` carry a 1px inset ring in
   `--theme-color-border-control`. Restated on `:disabled`, which sets `box-shadow: none !important`
   for the CTA's drop shadow and would otherwise have taken the ring with it — leaving `Save policy`
   to vanish for exactly as long as it reads *"Saving…"*, the one moment a user is watching it.
2. Schema is on the shared header: `Database` icon chip, `Schema` title, backend + table-count
   subtitle, close `X`. Its `+ New Table` and `Refresh` moved to a `.Toolbar` row beneath — which is
   what `DataBrowser` already does, so this joins the family rather than inventing a third shape. The
   loading and error states render it too; they had their own copies of the bespoke one, which is how
   it drifted.

Measured by `scripts/pol39-live/pol016-button-contrast.js`, against a **real backend it creates and
starts over `backend:create`/`backend:start`** — criterion 4's "not a fixture". Both themes
throughout. **Two scopes, and they are not the same population**, so they are reported separately
rather than as one matched pair:

| scope | surfaces | muted visible | below 3:1 | worst |
|---|---|---|---|---|
| **before** — launcher, editor, 7 backend surfaces | 9 | 12 | **12 (all of them)** | 1.00:1 |
| **after** — same scope | 9 | 11 | **0** | 3.17:1 |
| **after** — widened: + 18 rail panels | 27 | 20 | **0** | 3.16:1 |

The muted count drops 12 → 11 at the same scope because Schema's `Close` became the shared header's
`IconButton` and is no longer a `PrimaryButton` at all. **The widened scope was never run against
`HEAD`**, so the 20 is an after-only figure — it says the ring reaches every muted button in the
editor, not that all 20 were measured broken first. The 12-of-12 is the matched before/after.

Eleven buttons beyond `Save policy` were equally invisible and nobody had reported any of them:
`Add provider`, `Add role`, `Issue key`, `Turn enforcement on`, `Add` (Triggers), `Send test email`,
three `Edit`s (Email), and Schema's `Refresh` and `Close`.

### The instrument had to be fixed before its output counted

The first wide run reported 7 failures that were the census's fault, not the editor's:

- **A transparent background is not black.** `rgba(0,0,0,0)` is what every unfilled button reports,
  and taking it at face value scored the `ghost` variant — deliberately transparent over a real
  border — at 1.24:1 in dark and 19.90:1 in light. Both nonsense, from the same bug.
- **A boundary is a real `border` OR an inset ring.** Checking only `box-shadow` made `ghost`, which
  draws `border: 1px solid var(--theme-color-primary)`, read as boundaryless. It measures 4.33:1.
- **WCAG 1.4.11 exempts inactive components**, and `:disabled` deliberately flattens a button to
  `bg-3` at 0.5 opacity. Counting those as failures would mean the floor could only be met by making
  disabled controls look enabled.

## Traps

- **These panels are transient.** `SidePanel` re-creates them on every activation, so a stale
  observation may be a re-mount. POL-005's own trap; it still applies.
- A backend has to be **running** for these surfaces to exist at all.
- POL-005 measured the button at `rgb(247, 249, 251)` in one theme. Read both before choosing a fix:
  a variant that is invisible in light and fine in dark is a different bug from one that is
  invisible in both.
