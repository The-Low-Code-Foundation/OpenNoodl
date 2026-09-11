# Card & Card Grid

Two components: a styled **Card** (optional media area, title, body text,
footer/actions strip, `Clicked` signal, hover affordance) and a responsive
**Card Grid** that repeats the Card over a data array.

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ░░ media ░░  │ │              │ │ ░░ media ░░  │
│ Title        │ │ Title        │ │ Title        │
│ Body text…   │ │ Body text…   │ │ Body text…   │
├──────────────┤ │              │ ├──────────────┤
│ Footer     → │ └──────────────┘ │ Footer     → │
└──────────────┘                  └──────────────┘
```

Out of the box the grid renders six sample cards, so you see it working the
moment you drop it on a page.

## Feeding it your data

Cards are plain data — an array of objects, one card per object:

| Property | Type | What it does |
|---|---|---|
| `Title` | string | Card heading |
| `Body` | string | Body text under the title |
| `Image` | string (URL or project file path) | Optional — when present, a media area (160px, cover-fit) appears on top |
| `Footer` | string | Optional — when present, a footer strip with the text and an action arrow appears |

Two ways to supply it:

1. **Connect the `Items` input** of the Card Grid to any array — records from
   a query, a REST response, a Function output, or your own Static Data node.
   A non-empty connected array wins over the built-in samples.
2. **Edit the samples**: inside the **Card Grid** component, the
   **Sample cards** Static Data node holds the demo JSON — replace it with
   your content if you don't want to wire anything.

Property names are matched to the Card's inputs automatically by the Repeater
(no mapping script needed), so keep the `Title`/`Body`/`Image`/`Footer` keys —
or add a mapping script on the Repeater if your data uses different names.

## Outputs

- **Card Clicked** — signal, fires when any card is clicked.
- **Clicked Title** — the `Title` of the clicked card.
- **Clicked Item Id** — the repeater item id of the clicked card (pair it with
  your source array to look the record up).

A standalone **Card** (you can place it outside the grid too — set its inputs
directly) emits its own `Clicked` signal and passes `Title` through as an
output.

## Responsive behaviour — and the wrap trap

Flex items wrap **before** they shrink, so a naive flex-wrap grid either
overflows or collapses. The grid instead uses CSS grid on the **Card grid**
Group's *CSS Style* property:

```
display: grid;
grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
gap: 16px;
align-items: stretch;
```

- Cards are never narrower than **240px** while more than one column fits.
- Columns are added/removed as the container resizes; cards stretch to share
  the row evenly.
- Below one card width the grid degrades to a **single full-width column**
  (the `min(240px, 100%)` guard) instead of overflowing horizontally.

To change the minimum card width or the gap, edit those two numbers in the
Group's *CSS Style* (Advanced HTML section).

## Customising the card

Open the **Card** component:

- The **Footer / actions** Group is a real container — drop buttons or icons
  into it for per-card actions (the arrow icon is just a hint; delete it if
  you add your own).
- Colours are design-system tokens (`var(--surface)`, `var(--border)`,
  `var(--foreground)`, `var(--muted-foreground)`, `var(--primary)` …), so the
  cards follow your project theme automatically. Hover raises the card via
  `var(--surface-raised)` / `var(--border-strong)`.
- Media height (160px) and paddings are ordinary node parameters.
