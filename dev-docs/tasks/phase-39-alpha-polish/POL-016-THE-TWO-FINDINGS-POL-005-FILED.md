# POL-016 — the two findings POL-005 filed and nothing tracked

**Split out of** [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md)'s *"Three findings from the
layout pass — filed, not fixed"*, on 2026-08-04 (sixth session), after Richard noticed the register
was not telling him about them.

**Status:** ☐ filed, not started. One needs a decision before it can be built.

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

## Traps

- **These panels are transient.** `SidePanel` re-creates them on every activation, so a stale
  observation may be a re-mount. POL-005's own trap; it still applies.
- A backend has to be **running** for these surfaces to exist at all.
- POL-005 measured the button at `rgb(247, 249, 251)` in one theme. Read both before choosing a fix:
  a variant that is invisible in light and fine in dark is a different bug from one that is
  invisible in both.
