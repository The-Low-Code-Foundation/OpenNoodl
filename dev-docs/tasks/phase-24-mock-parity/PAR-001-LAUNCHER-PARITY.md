# PAR-001: Launcher Parity

**Spec:** [nodegx-launcher-mock.html](../phase-23-visual-refresh/mocks/nodegx-launcher-mock.html) — every value below is lifted from its CSS and is normative. Open the mock in a browser next to the app while working.

## Objective

Rebuild the launcher's presentation to match the mock down to the last detail. UIX-006 got the concepts (wordmark, cards, chips, placeholders); this task closes the structural/density gap: unified 52px titlebar, 224px sidebar, mock type scale, mock card anatomy, mock toast.

## The gap (real screenshot vs mock, 2026-07-26)

- macOS traffic lights **overlap the brand mark** — no reserved lights region; brand is a logo glyph instead of the mock's coral-dot + "NodeGX" wordmark.
- Everything is one size-step too big: heading, search field, cards, paddings.
- Missing: `⌘K` kbd hint in search (and the working Cmd+K focus binding), "Last opened" sort select styling, avatar chip, `FOLDERS` side-label, ghost "Open project…" button, sentence-case Bricolage h1.
- Footer links carry external-link icons; mock has plain text links.

## Normative details (from mock CSS)

**Titlebar** (52px, bg-1, border-b border-1, padding 0 20px, gap 16px):
- Lights region: reserved 120px width (real traffic lights: position them via Electron `trafficLightPosition` ≈ {x:20,y:20} so they sit inside the 52px bar; the wordmark starts after the reserved width — never under the lights).
- Wordmark: 9px coral (`--brand`) dot + "NodeGX", Bricolage 600 17px, letter-spacing -.01em, gap 7px.
- Tabs (Projects/Learn/Templates/GitHub): margin-left 28px, full-height hit area, padding 0 14px, 13px/500 fg-3 → fg-1 when current, 2px accent underline inset 12px left/right, radius 2px top.
- Right: `Connect GitHub` **secondary** button (bg-2, border border-2, 13px/500, GitHub mark 15px, padding 7px 13px, radius 7) + 28px avatar circle (gradient `135deg #7C5CFF → #4DA3FF`, 11px/600 initials; if no user identity exists, use a neutral person glyph on the same gradient — do not invent initials).

**Sidebar** (224px, bg-1, border-r, padding 16px 10px):
- `FOLDERS` side-label: 10.5px/600, letter-spacing .07em, uppercase, fg-3, padding 4px 10px 8px.
- Items: 13px/500 fg-2, padding 7px 10px, radius 7, folder icon 15px stroke-1.5; hover bg-3/fg-1; current = accent-soft bg + accent text; count right-aligned 11.5px/400 fg-3 (accent at .75 when current).
- "New folder" pinned to bottom (flex grow spacer), fg-3, plus icon.

**Main column** (padding 28px 32px 20px):
- Head row (margin-bottom 20px): h1 "Recent projects" (sentence case) Bricolage 600 24px letter-spacing -.015em; spacer; `Open project…` ghost button (no border, fg-2, hover bg-3); `New project` primary (accent bg, 13px/500... mock .btn is 500 weight, padding 7px 13px, radius 7, plus icon 14px stroke-1.8).
- Toolbar row (gap 10, margin-bottom 22): search flex max-width 380px (bg-1, border-1, radius 8, padding 8px 12px, 14px search icon, 13px input, `⌘K` kbd chip: mono 10.5px, bg-3, border-1, radius 4, padding 1.5px 5px). **Wire Cmd/Ctrl+K to focus it.** Sort select: same box treatment, "Last opened" 13px/500 fg-2 + 12px chevron — bind to the existing sort state (keep existing options).
- Grid: 3 columns, gap 18px.

**Card** (bg-1, border-1, radius 10, shadow-card; hover translateY(-2px) + shadow-card-hover + border-2, transition .14s behind `prefers-reduced-motion`):
- Thumb `aspect-ratio: 16/9.2`; placeholder = existing UIX-006 gradient + ghost initial restyled to mock: Bricolage 600 96px, `rgba(255,255,255,.16)`, positioned right -8px / bottom -26px.
- Meta: padding 12px 14px 13px, gap 10; name 13.5px/600 fg-1 ellipsized; sub row 12px fg-3 gap 6 wrap: "Edited …" + chips inline. Chips: 10.5px/600 letter-spacing .02em radius 5 padding 2px 7px; `Local only` neutral (bg-3, fg-3, weight 500); warning chip amber (warning-bg/warning) with 10px triangle. Kebab 26px, radius 6, fg-3, hover bg-3.
- Whole card is one button; keep dblclick/open/kebab behaviors.

**Footer** (42px, bg-1, border-t, padding 0 20px, gap 18px): plain 12px fg-3 links (no external-link icons), hover fg-1; right: `NodeGX 0.1.0` mono 11px.

**Toast** (absolute right 20 / bottom 58, width 340, bg-1, border-1, radius 10, shadow-toast, padding 13px 14px, gap 11px): 28px radius-8 icon square (error-bg/error for errors — amber pair for warnings), 13px/600 title, 12.5px fg-2 message with `code` chips (mono 11px bg-3), action row margin-top 8: accent 12.5px/600 primary action + quiet fg-3 secondary, 22px close button. Migrate the UIX-003/006 toast component to this anatomy (icon square + title + body + actions), don't fork a second toast.

## Checklist

- [ ] Titlebar unified 52px; traffic lights inset, never overlapping the wordmark (verify on macOS)
- [ ] Wordmark = coral dot + Bricolage "NodeGX" (logo glyph retired from titlebar)
- [ ] Tabs, Connect GitHub secondary, avatar per mock
- [ ] Sidebar 224px with FOLDERS label, item/count/current styling, New folder pinned
- [ ] Head row + search (with working ⌘K) + sort select per mock
- [ ] Card anatomy/hover/chips/ghost-initial per mock; behaviors preserved
- [ ] Footer + toast per mock
- [ ] Hex ratchet holds; both themes verified (mock defines both palettes)
- [ ] No feature lost (folder CRUD, sort, search, kebab menu, project open/rename/delete)
