# Avatar

A person, at any size, with or without a picture.

```
┌──────────────────────────────────────────────┐
│  (◕)(◕)(AT)(◕)(RP)  +3                       │
│   └── Avatar Group: overlapped, then a badge │
└──────────────────────────────────────────────┘
```

## Avatar

Drop it anywhere. It draws a photo when `Image` is set and the person's
initials when it is not, so a row of users never has a hole in it.

| Input | What it does |
|---|---|
| `Image` | Photo URL or project asset path. Empty falls back to initials. |
| `Name` | `"Ada Lovelace"` → **AL**, `"ada.lovelace"` → **AL**, `"Ada"` → **AD**, empty → **?** |
| `Size` | Diameter in px. The letters scale with it — you do not set a font size. Default 40. |
| `Ring Color` | The ring drawn around the circle. Defaults to the page background, which is what makes an overlapped stack readable. |
| `Overlap` | Left margin. **Avatar Group sets this per item** — you rarely set it by hand. |

## Avatar Group

Feed it an array of `{ Name, Image }` on `Items`. With nothing connected it
renders five sample people, so the component shows what it is the moment you
place it; a non-empty `Items` wins over the samples.

| Input | What it does |
|---|---|
| `Items` | Your array. Each item's `Name` and `Image` reach the Avatar by name. |
| `Max` | Show at most this many, then a `+N` badge for the rest. Unset shows all. |
| `Overlap` | Pixels each avatar slides back over the one before. Default 10. |

## Two things worth knowing before you change it

**The overlap is data, not CSS.** `styleCss` applies raw CSS *declarations* to
one element — it is not a stylesheet, so a nested `> * + * { margin-left: -10px }`
is silently dropped. The first build of this prefab did exactly that and drew
five avatars in a neat row with no overlap at all, looking perfectly correct in
the graph. The **Choose items** Function stamps an `Overlap` onto each row
instead, and the first row gets `0`.

**There is no Avatar node any more.** This replaces the `avatar` *module*, whose
prebuilt bundle reached into React's `ReactCurrentDispatcher` — removed in React
19, so the kit failed to load and every Avatar node rendered nothing. Everything
here is core nodes, so there is no bundle to go stale against a React release.
