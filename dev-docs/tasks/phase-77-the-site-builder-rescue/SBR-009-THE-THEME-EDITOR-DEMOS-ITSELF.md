# SBR-009 — The theme editor demos itself

**Fixes finding 3's surface.** Screen 4 — "the demo the template exists to give". The screen
already writes a record and applies it to the document root; once SBR-003/004/006 land, its
writes become live. This task makes the screen worthy of being the product's best moment.

## 1. The person sentence

**A client can change their site's colour and see the site change** — the phase's root
sentence, on the screen built for it.

## 2. Scope

- **Grouped sections**: Site (name, home page — already save here), Colour (primary,
  background, text), Type & shape (heading font, corner rounding) — labelled, in cards.
- **Presets row**: Studio / Press / Night from SBR-003's data. Picking one fills the fields;
  Save writes the record. A client never faces an empty colour picker.
- **Live preview panel beside the fields** — a mini rendering (hero + button + card) that
  applies the *edited-but-unsaved* values locally, so a change is visible without leaving the
  screen. Local-only: this is not SBR-011's cross-app preview.
- The Theme record schema per SBR-003 (the wider subset), and `applyTheme` extended to write
  exactly that subset.

## 3. Acceptance criteria

1. **(person)** Changing primary and saving changes the public site AND the admin panel itself
   (both apps consume the same tokens) — driven, colour read back from a resolved style.
2. **(person)** Picking the Night preset restyles the preview panel immediately, before save;
   Cancel/never-saving leaves the site unchanged (negative control).
3. Deleting the Theme row falls back to Studio (SBR-003 AC4 driven from this screen's "reset"
   if one ships, or by direct record deletion).
4. The three prop- wires this screen owned (census: `/Pages/ThemeEditor` 3) save correctly on
   deploy once SBR-008 lands — re-read the chip, don't assume.

## 4. Traps

- 🔴 A token write is invisible in the same eval; smooth scroll zeroes `scrollTop` — drive with
  the second-call pattern.
- 🔴 The preview panel must consume the SAME token names, not a copied palette (the
  second-copy-drifts trap wearing a preview costume).
