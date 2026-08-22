# Confirm Dialog

A modal confirmation dialog that follows the ERG-001 outcome contract: every way
the user can finish with the dialog ends in exactly one of two distinct signals —
**Confirmed** or **Cancelled**. There is no ambiguous single `Closed` output.

## How to use it

1. Place the **Confirm Dialog** component near the root of the page (it renders
   an absolutely-positioned full-size layer, hidden until opened), ideally as
   the last child so it stacks above the page content.
2. Wire a signal (e.g. a delete button's Click) into **Open**.
3. Wire **Confirmed** into the action that needed confirming, and (optionally)
   **Cancelled** into any cleanup.

## Inputs

| Port | Type | Meaning |
|---|---|---|
| `Open` | signal | Shows the dialog |
| `Close` | signal | Hides the dialog programmatically. Deliberately **silent** — it emits neither Confirmed nor Cancelled, because the user never made a choice (the same policy as Show Popup's `Dismissed`, NDA-010 §3). Your own graph already knows it closed the dialog |
| `Title` | string | Heading text. Defaults to "Are you sure?" |
| `Message` | string | Body text. Defaults to "This action cannot be undone." |
| `Confirm Label` | string | Confirm button label. Defaults to "Confirm" |
| `Cancel Label` | string | Cancel button label. Defaults to "Cancel" |
| `Danger` | boolean | Destructive variant — restyles the confirm button with the `--destructive` token instead of `--primary`. Use it for deletes and other irreversible actions |

Unconnected inputs keep the defaults above — you only need to wire `Open` and
the outputs.

## Outputs

| Port | Type | Fires when |
|---|---|---|
| `Confirmed` | signal | The user clicked the confirm button. The dialog also closes |
| `Cancelled` | signal | The user clicked the cancel button **or** the scrim behind the dialog. The dialog also closes |

Exactly one of the two fires per user interaction, and each interaction closes
the dialog — no follow-up wiring needed to dismiss it.

## Styling

All colours are design-token references (`var(--surface-raised)`,
`var(--foreground)`, `var(--muted-foreground)`, `var(--border)`,
`var(--primary)` / `var(--destructive)`, `var(--ring)`), so the dialog picks up
the project's theme. Buttons show a `--ring` border in their focused state for
keyboard users. The title uses the shipped Inter Medium font.
