# NAT-008 — The people are the product

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `editor`, `core-ui` |
| **Rulings** | ✅ D4 · inherits P67 **D9** (retention/export/DPA) |
| **Depends on** | **NAT-005**, **NAT-006** |

## 🟡 Status — 2026-08-20 (session 9): built, and driven against a platform run locally

`736af592` + `b19f2ec2`. **AC1, AC2, AC3, AC4 and AC5 close. AC6 closes as "there is no contact
route to offer", which is a finding rather than a build.** The directory and a profile open in
place on both surfaces, a post's author line opens the person behind it, and the whole reading
path was driven over real HTTP against a locally-run platform — because NAT-006's endpoints still
**404 in production**.

| AC | State | Where |
|---|---|---|
| 1 — a people surface, browse and search, four section states | ✅ 🟡 | `CommunityDirectoryView` + `composeDirectory`. 🔴 The search is **not** on the server — see below. **Driven in the launcher**; 🟡 the rail panel in situ was not |
| 2 — a profile, from the directory or an author line | ✅ | `CommunityProfileView`, `composeProfileView`; the six-branch order is `threadview`'s, one branch longer |
| 3 — badges through a CSS **mask**, not an `<img>` | ✅ | `badgeMarks.ts` — twelve marks bundled as data URIs; graded with the comments stripped |
| 4 — author lines are entry points | ✅ | `CommunityThreadView`'s author is a `button` when a host can open a profile, plain text when not |
| 5 — D15 per viewer, and never a member the web would hide | ✅ | Read off `me`, before anybody is fetched; `selectPeople` is the only inclusion rule and it never sees a session |
| 6 — contact affordances do what they say | ✅ **by drawing nothing** | 🔴 The platform publishes **no contact route** — see below. `contactFor` is the seam, and it returns `null` |

Gates on the committed tree: `typecheck:editor` and `typecheck:editor-tests` clean ·
`test:main` **280 suites / 4544 tests / 0 failures** · core-ui jest clean · NAT-001's PAIRS table
**245 assertions**, 14 new pairings in both themes. **71 new tests, verified red 14 of 14.**

### 🔴 The directory's search does not exist on the server, and a client that sent one would lie

Measured 2026-08-20 against the route handler on a real database, **with a control beside it**:

| request | answer |
|---|---|
| `?q=ada` over `[ada, grace, linus]` | **all three** — the keyword is dropped |
| `?q=zzzzzzzz` | **all three** again |
| `?offersCoaching=true` (the control) | `[linus]` — the route ran, and its own filters narrow |
| `?limit=3` over 7 rows | 3 items, `total: 7`, `nextOffset: 3` |
| `?limit=1000` | clamped to 100, and `page.limit` says so |

⚠️ **The control is what makes the first two rows mean anything** — *"the keyword is ignored"* and
*"the request never reached the route"* are otherwise the same measurement. This is the fifth
endpoint in this codebase found ignoring a keyword, and the four the earlier sweep found are named
in this task's own traps.

✅ So the narrowing is in the editor, over rows, **which is also what the web does** —
`facets.ts`'s `select()` filters `listDirectory`'s whole list in memory, and the endpoint's own
comment asks a client to *"filter the page it was given rather than have this route grow a second
filtering vocabulary."* `selectPeople` produces both the rows **and** every filter pill's count, so
a pill's number is not *related to* what clicking it gives you — it **is** what clicking it gives
you.

🔴 **But the endpoint also PAGES, and that is the half that would have been missed.** Filtering
the page you were given is only honest if you were given the whole thing: a local search over page
1 of 5 is the same silent lie in a nicer shape. `readDirectory` follows `nextOffset` to the end,
stops at a stated cap of ten pages, and the surface **says so** when it stopped early —
`boundLine`, drawn above the rows rather than under them, because a reader who stops at row eight
never sees a footnote. **A bounded query reports its bound.**

### 🔴 Four plausible rate-band keys, and all four were wrong

`rateBandLabel` was first written as `day_400_600` / `day_600_plus` — the house style of every
other enum on the platform. The real keys are `under-400`, `400-700`, `700-plus` and
`not-for-hire`. **Found by curling the endpoint**, not by any test in this repository.

⚠️ **The failure mode is silent by design of the surrounding code.** An unknown key draws no chip
— deliberately, so a band added on the platform is a *missing* chip here rather than a *wrong* one
— and a blank band is **also** the correct rendering for somebody who did not answer. Every rate
in the directory would have vanished and nothing would have looked broken.

🔴 **A safe failure mode is not a substitute for reading the source.** The containment worked
exactly as intended, and it is also what would have kept this invisible for as long as nobody
looked. The same shape guards `badgeMark`, whose keys *were* checked against the wire — `learning`
/ `bronze`, three of three resolved on a real profile.

### 🔴 There is no contact route to offer, and AC6 closes by saying so

`PersonProfile` carries a handle, a bio, two flags, badges and the links somebody published. It
carries **no email address**, and the platform is deliberate about that: UNI-004's double-blind
relay exists precisely so responding to a brief does not hand anybody's address to anybody else,
and **D10 is open**.

So both tempting affordances are wrong today. A *"Message"* button that opened Chrome is the thing
AC6 names in as many words; a `mailto:` is an address this client does not have. The third — *"ask
them on the Bench"* — is a real route and it belongs to **NAT-009 and NAT-010**, which are writes.
✅ **D5 was settled on 2026-08-20**, so those writes are unblocked; `contactFor` is the seam and it
returns `null` until one of them ships. **A profile with no button beats a button that lies.**

### 🔴 No remote image is fetched, and that is this task's ruling rather than the web's

The trap says the editor's answer about remote images is *decided in this task rather than copied*.
It is: **this window makes no remote image request at all.**

- **Badges.** The platform serves twelve marks from `public/badges/`, so the copy-the-web answer is
  a mask URL pointing at `community.nodegx.io`. This renderer is `nodeIntegration: true,
  contextIsolation: false`; a remote request for a *decoration* is a fingerprinting surface, a
  mixed-content surface, and a thing that fails with the network — NAT-013 would then have to
  explain twelve holes in a profile read from cache. The marks are bundled as data URIs, keyed on
  `family` + `tier`, and an unknown key draws the platform's own **no-artwork branch**.
- **Avatars.** `avatarUrl` arrives and is **declined**. Every image fetched from it would tell
  whoever hosts it that this editor opened this profile, at this moment, from this IP. ⚠️ The cost,
  stated rather than hidden: somebody who uploaded a picture does not see it here. The initial-disc
  is what the web already draws for everybody who has not.

⚠️ **And the disc is FLAT where the web's is a gradient.** A gradient is a colour that changes
across the shape it fills, so the letter's contrast is one number at the top and another at the
bottom — the objection NAT-001's `over` column already raises against a wash. D15 forbids the
editor disagreeing with the web about **who is visible**; it says nothing about ornament.

### ⚠️ A spec that builds a view model cannot grade the function that builds it

Red-verification caught one hole in fourteen: replacing `postView`'s `authorHandle` with
`post.author.replace('@', '')` left **every render spec green**, because they all construct the
view by hand. The defect it would have shipped is a profile link on an anonymous post opening
`/people/someone`. ✅ Fixed by asserting on `threadDetailView`'s own output — one assertion per
half. **Worth generalising: the other three surfaces are about to copy these shapes.**

### ✅ Driven in the running editor — and it found a defect no spec could

The launcher tab was driven against a platform run locally on a seeded database (`COMMUNITY_URL`
pointed at `localhost:3100`, **reverted afterwards**). Five people, both pills carrying their real
counts (3 and 2), `5 people`, no bound line. Typing `coaching` → **`1 of 5 people`, one row**, and
the pills recomputed against the live query (`Available for work 0`). Typing `zzzzzzzz` → `0 of 5`
and *"Nobody here matches that yet"*. A row opened the profile **in place**, Back restored the
lists, and the badges measured **3 spans, 0 `<img>`, each 20×20 with a resolved mask URL and a
painted ink** — AC3 confirmed in the product rather than in a test.

🔴 **THE DEFECT: the directory's controls broke out of the card's gutter.** Measured — the card
spanned 32→1328, the heading was inset to 47, and the search field ran **33→1327**. It is
structural rather than a missing value: `SectionHead` pads itself and `Body` pads itself, so a
component inserted **between** them inherits neither. ⚠️ **The screenshot did not look broken** —
14px is a card that reads as slightly wrong, and it was only visible once the numbers were read
off the boxes. Fixed (`e86cd31e`); everything now starts at 47.

⚠️ **`.Rows` still has no side padding and that stays** — a row carries its own so its hover fill
reaches the card's full width. The two are inset by *different mechanisms* on purpose.

### ⚠️ What was still NOT driven

- 🔴 **The rail panel itself.** It needs a project open, the launcher's recents did not list the
  copy made for the drive, and there is no editor global to open one programmatically — a native
  file dialog is not reachable from CDP. ✅ What *was* measured is the same component narrowed to
  **320px**: no horizontal overflow anywhere, chips wrapping to two lines, titles ellipsising
  rather than clipping, no page scroll. That is the wrap behaviour; it is **not** `BasePanel`'s
  chrome, `ScrollArea`, or `Panel` density in situ.
- ⚠️ **A thread with an author line was not clicked through to a profile** — the seeded threads
  render, but AC4's join was graded at the component and the producer rather than by a click.
- ⚠️ **D15's refusal over HTTP** — needs an `org_minor` session token. Graded at the composer and
  the component, each with a permitted control, and the platform's `d15-visibility.test.ts` sweeps
  the routes.

---

## The job

`/people` and `/u/[handle]` exist on the platform and are invisible to the editor. The whole
argument for a community inside a development tool is *"somebody here has done this before"* — and
today the editor cannot tell you that anybody exists.

Bring the directory and the profile into the editor: who is here, what they have built, what they
have answered, and how to reach them.

## Acceptance criteria

1. A **people** surface in the launcher tab: browse and search the directory, paged, with the same
   four section states NAT-005 defines.
2. A **profile** surface: open a member from the directory, from a thread's author line, or from
   an RFP response, and see the same substance the web profile shows — standing, badges, and their
   contributions.
3. 🔴 **Badges paint through a CSS mask.** The twelve badge SVGs carry **no colour** — an
   `<img>`-loaded SVG inherits none, and the profile paints them with `mask` so both themes are
   right by construction (UNI-013 slice 4). An editor profile that `<img>`s them renders twelve
   invisible or twelve black marks depending on the theme. Copy the mechanism, not the markup.
4. Author lines **everywhere** become entry points — a thread's poster, a tutorial's author, a
   replay's host. A directory nobody can reach from the content is a page nobody opens.
5. **D15 per viewer, and the directory is the sharpest case:** a refused viewer sees nothing, and
   a *permitted* viewer must not be shown members the platform would hide from them on the web.
   The web page is the specification of who is visible.
6. Contact affordances do exactly what they say. If reaching someone means email, it opens mail; if
   it means a thread, it opens a thread in the editor. Nothing labelled "message" that opens Chrome.

## Traps

- 🔴 **This is a member directory shipped to a desktop client, and that is personal data.** P67's
  D9 already binds the platform to retention, export and DPA obligations. Caching the directory to
  disk (NAT-013, D8) turns "the platform holds a directory" into "every user's laptop holds a
  directory". Decide it deliberately; do not inherit it from a cache layer.
- 🔴 **Search that silently ignores its keyword is a measured failure mode in this codebase** — four
  endpoints were found doing exactly that. **Control-test the directory search first**: a query
  that must return nothing, and a query that must return one known row. A search box that returns
  the unfiltered list looks like a working search box.
- ⚠️ Handles are user content. They reach the editor as text children only — same rule as posts.
- ⚠️ A profile is the most tempting place to put an avatar loaded from a remote URL. Remote images
  in the main window are a fingerprinting and a mixed-content surface; whatever the web does here,
  the editor's answer is decided in this task rather than copied.
