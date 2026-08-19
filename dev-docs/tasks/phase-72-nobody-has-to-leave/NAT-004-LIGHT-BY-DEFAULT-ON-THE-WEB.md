# NAT-004 — Light by default on the web

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | S |
| **Surface** | `platform` (`nodegx-community`) |
| **Rulings** | ✅ **D2 — follow the OS, fall back to light** |
| **Depends on** | nothing. Independent of the token work — do it whenever |

## The job

Richard: *"Can we make dark mode light mode?"* On the site, this is a default, and the default is
currently dark.

`src/app/layout.tsx`'s `THEME_STAMP` runs before hydration and picks:
1. `localStorage['nodegx-theme']` if it is `light` or `dark`;
2. else `prefers-color-scheme: light` → light;
3. else **dark**;
4. and dark again in the `catch`.

D2 keeps (1) and (2), changes (3) to **light**, and keeps (4) as **dark** — because step 4 is the
no-JS/no-storage path and `:root` carries the dark values, so a document that never got a stamp is
dark whatever the stamp intended. Making them disagree would be a lie in the code.

There is also no visible way to change it. The site stores `nodegx-theme` and nothing writes it.

## Acceptance criteria

1. A first-time visitor whose OS expresses **no** preference gets **light**. Asserted, with a test
   that fakes `matchMedia` returning no match for either query — the case the current code sends to
   dark.
2. A visitor whose OS says dark still gets dark; a visitor with a stored choice still gets their
   stored choice. Both asserted. 🔴 These are the **controls** — a change that makes everyone light
   would also pass AC1.
3. A **visible theme toggle** ships in the site chrome, writes `nodegx-theme`, and takes effect
   without a reload. Today the storage key is read by nothing that can write it, which means a
   visitor who dislikes the default has no move at all.
4. The toggle's own control states meet 3:1 against the chrome in both themes, and it is reachable
   and operable by keyboard with its state exposed to assistive tech — it is a control that
   changes the whole page.
5. `suppressHydrationWarning` on `<html>` is still correct after the change and the stamp still
   runs before first paint. **No flash of the wrong theme** — checked by loading the page, not by
   reasoning about it.
6. The `catch` branch is still dark, with the comment saying why it deliberately differs from the
   new default.

## Traps

- 🔴 **`cookies()` in the root layout already makes every route dynamic** (documented at
  `layout.tsx`). Do not "fix" the theme with a cookie read on the server as though it were free —
  it is free *here* only because the session read already paid, and moving the theme server-side
  reintroduces the flash problem for anyone whose stored preference disagrees with their cookie.
- ⚠️ **The dark values live on bare `:root`; light is `:root[data-theme='light']`.** Changing the
  *default* must not tempt anyone into re-declaring light values under
  `@media (prefers-color-scheme: light)` — that is a second hand-made copy of the palette and the
  exact failure UNI-013's AC2 names.
- ⚠️ This task changes what most visitors *see* and therefore which theme the site's screenshots
  and any marketing material are of. Worth a heads-up before it lands, not after.
