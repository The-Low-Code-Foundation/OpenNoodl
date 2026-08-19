# NAT-005 — The tab that is a list of grey lines

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `core-ui`, `editor` |
| **Rulings** | ✅ D1 · inherits **P67 D15** and **D21** |
| **Depends on** | **NAT-002**, **NAT-003** (it renders on the fixed palette). Precedes the Tier-3 surfaces, which copy its shapes |

## The job

Fix the tokens and the launcher Community tab is still three headings and some rows. Read
[`Community.tsx`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx):
every visual decision is an inline `style` object, there are exactly two of them (`shy` and
`rowStyle`), the whole page is one column of 13px text, and the only structure is `marginBottom: 28`.

There is nothing wrong with it that a designer would call a bug and nothing about it that invites
you in. It reads as a status readout because that is literally what it is.

Give it the shape of a place: real hierarchy, cards that sit on the ground NAT-003 built, rows that
show *who* and *when* and not only a title, and a first screen that says what this is for.

⚠️ **This task is the pattern the Tier-3 surfaces are built from.** People, jobs, coaching and
University all need the same list/row/empty/error vocabulary. Build it once here, as components, or
four tasks will each invent it.

## Acceptance criteria

1. The four section states — `loading`, `items`, `empty`, `unreachable` — are all still distinct
   and all still reachable, and each is **rendered and looked at**. 🔴 UNI-011 paid for `loading`
   being its own case (an empty list for 300ms tells every user on every open that the community is
   dead); a redesign that collapses them re-buys that bug.
2. Rows carry the metadata the API already returns and the current UI throws away — `createdAt`,
   `firstReplyMinutes` on threads, `summary` and `kind` on articles, `heldOn` and `description` on
   replays. All of it is in the view model today and none of it is drawn.
3. `emptyLine` stays **required and per-section**, saying what the section is *for*. No shared
   default. The four honest empty states do not become one shrug.
4. The reusable pieces are extracted as core-ui components with stories, not left as inline styles.
   Storybook renders them with no editor present — the tab must still degrade to "not available in
   this preview" when `communityMirror` is absent.
5. **D15 is intact:** `surface: 'hidden'` draws **nothing** — not a heading, not a frame, not a
   skeleton. Asserted with a **not-hidden control beside it**, because an assertion that nothing
   was drawn passes just as well when the component never ran.
6. Every pair the new layout introduces is added to NAT-001's PAIRS table. A redesign that
   introduces a new grey without a row is the same bug in a nicer shape.
7. No `dangerouslySetInnerHTML`, anywhere. This file renders **text children only** — the launcher
   is `pages/ProjectsPage` inside the same `nodeIntegration: true` window as the editor.

## Traps

- 🔴 **`Community.tsx` lives in core-ui and is imported by the editor's rail panel too.** That path
  looks wrong and is deliberate: core-ui cannot import the editor, so the renderer owns the type.
  Two view models would be the defect. Anything extracted here must serve **both** surfaces.
- 🔴 **The health readout is a *readout*, not a gate** (D21 reversed D16 on 2026-08-19). Nothing may
  branch on it. It carries its `required` and its `n` because *"a median over three staff-answered
  threads is a true statement about nothing"* — a redesign that drops `n` to make the number look
  tidy deletes the only thing making it honest.
- ⚠️ **`BaseDialog` renders every dialog twice** — any spec that counts rendered nodes in this area
  must filter `:not([class*=MeasuringContainer])` or it double-counts.
- ⚠️ Do not add a "0 of 20 threads" progress bar. The threshold stopped being a gate; drawing it as
  one puts it back.
