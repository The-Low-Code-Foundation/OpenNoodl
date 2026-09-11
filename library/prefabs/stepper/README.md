# Stepper

A numbered progress rail with Back / Next, a **Finish** on the last step, and a
tick on everything behind you.

## It does not hold your steps, on purpose

The stepper publishes `Current Step` (0-based) and a `Completed` signal. Your
step content stays where you put it, as ordinary Groups with `Mounted` wired to
a comparison against `Current Step`:

```
Stepper.Current Step ──> Expression "n === 0" ──> Group "Your details".Mounted
                    └──> Expression "n === 1" ──> Group "Delivery".Mounted
```

A stepper that owned the content would have to mount and unmount whatever you
gave it, and a `Component Children` slot renders **all** its children at once —
so the container version would either show every step or need a hidden
per-child protocol. One number is the honest contract, and it composes with
`form-fields` directly: one fieldset per step.

| Input | What it does |
|---|---|
| `Steps` | Array of `{ Title }`. Empty falls back to four sample steps. |

| Output | When |
|---|---|
| `Current Step` | 0-based index, on every move. |
| `Completed` | **Finish** was pressed on the last step. Once. |

## The trap this was built around

`Advance` reads the Counter it increments. Leave *Run on value change* ticked
on its `Count` input and the node re-runs on its own effect: one click walks the
stepper to the last step and fires `Completed`. On screen that still looks like
a stepper — the rail fills in, the buttons work — which is why the drive counts
steps **per click** rather than checking where it ended up. Both boxes on
`Advance` are unticked, and that is load-bearing.

The Counter's own `Limits` stop `Back` at zero, so `Back` needs no such guard.
