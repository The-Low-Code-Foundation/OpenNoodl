# UNI-003 — the profile that follows you

**Surface:** platform · **Tier 1** · **Effort:** M · ✅ **BUILT 2026-08-16 (sixteenth session)** —
all four acceptance criteria met, **56 new specs** (plus 3 the drift suite generates for the new
tables — **164 total, baseline 105**), **thirteen control runs**, and the routes driven over HTTP
rather than only specced. Build record at the end of this file.

> **D8** ([RULINGS.md](RULINGS.md)): listing is **open to anyone** — R3 already said so — behind a
> **profile-completeness bar** (account + name + blurb + at least one published thing or lesson
> completion). Moderation is **reactive**: reported → reviewed → hidden, not approval-first, because
> an approval queue only one person can clear is a bottleneck that grows with success. The badge and
> point displays read D4's **(family, tier)** model, not a per-badge list.

## Premise

The profile is the connective tissue: it displays what UNI-002 records (points, badges), what the
prefab shelf publishes, and what UNI-004 sells (availability for work, coaching offers). Richard's
phrase: "the profile that follows you" — one identity visible across forum, RFPs, showcase, and
(later) certification.

## Scope (v1)

- **Private-by-default account page**: display name, avatar, bio, links. Public visibility is an
  explicit opt-in toggle.
- **Public profile page** (opted-in): badges, points, published prefabs/templates (wired when the
  shelf exists — placeholder section until UNI-005), showcase links, and the two professional
  flags:
  - **"Available for work"** — makes the profile discoverable from the RFP board (UNI-004).
  - **"Offers coaching"** — lists their coaching offer (UNI-004's booking rail).
- **Moderation minimum**: admin unpublish, a report button, display-name rules. D8 rules whether
  listing professionally requires anything (points floor, account age) beyond the toggle.

## Acceptance criteria

1. A fresh account has no public page; opting in creates one; opting out returns 404 (not a
   stub page).
2. Badges and points render from the UNI-002 ledger live — no copied denormalised state.
3. The two professional flags are independent of each other and of public visibility rules per
   D8's ruling.
4. Admin unpublish hides the page immediately and the owner sees why.

## Not in v1

Certification display, prefab install counts, endorsements/reviews of devs (a moderation
minefield — deliberately deferred), custom profile URLs.

---

# Build record — 2026-08-16 (sixteenth session)

**Where it lives:** `nodegx-community`, third commit. `src/db/sql/0003_uni003_profiles.sql`,
`src/lib/profiles.ts`, `src/app/u/[handle]/page.tsx`, `src/app/people/page.tsx`,
`tests/uni003-profiles.test.ts`.

**Gates:** **164 specs / 9 files, all pass** (baseline 105/8 — this task adds 56 specs of its own
and 3 the drift suite generates for the new tables). `tsc --noEmit` clean. `next build` succeeds, 8
routes. ⚠️ **`npm run lint` is still not a gate in that repo** — no ESLint config exists, so the
script drops into an interactive setup prompt. It has never run there and this task did not change
that.

## The four criteria, and where each is actually enforced

| AC | Met by | The thing that would otherwise rot |
|---|---|---|
| **1** — no page until opt-in; opting out **404s, not a stub** | `publicProfile()` returns `null` for private, hidden *and* never-created alike | 🔴 A caller holding a distinguishable *"hidden"* object eventually renders it, and a page reading *"this profile is hidden"* **is** the stub AC1 forbids. The route has nothing to render because the module returns nothing to render |
| **2** — badges and points **live from the ledger** | every number is a `contribution.ts` call at read time | `0003` has **no column** a balance or a badge could be cached in, asserted by a spec that greps `information_schema` — an absence needs a witness |
| **3** — the two flags independent of each other **and** of visibility | two optional fields, and no read of `visibility` anywhere in `setProfessionalFlags` | The **2×2 is written out**: a control pair proves what you varied and nothing about what both arms shared, so testing only "available on, coaching off" would leave two combinations reading as excluded when merely untested |
| **4** — admin unpublish hides **immediately**, owner sees **why** | `hidden_at`/`hidden_reason` as a **biconditional CHECK**, and `force-dynamic` on the route | 🔴 Hiding is deliberately **not** `visibility = 'private'`. If moderation reused the owner's own toggle, the owner could not tell their choice from someone else's decision about them — and *"sees why"* would have nowhere to live |

## D8's bar gates the **listing**, not the page and not the flags

This is the reading the task had to choose, so it is recorded rather than left implicit. D8's line is
*"**to list**: account + complete profile + ≥1 published thing or lesson completion"*, and AC1 and
AC3 are both literal about the toggle and the flags being unconditional. So:

```
opt in            ->  a public page exists                    (AC1, no bar)
set a flag        ->  the flag is set                         (AC3, no bar, either order)
public + flag + BAR  ->  appears in /people                   (D8)
```

🔴 **`profileBar()` returns its components, not a boolean** — D16's lesson applied one task early:
*"a threshold nobody can see the approach to is a threshold that gets crossed by rounding."* A bar
that answers only yes/no leaves the owner's page with nothing to say but "no".

⚠️ **The evidence half reads D4's taxonomy, not a slug list** — a live award into `building` or
`learning` — because a slug list breaks UNI-002 AC4 (the registry is editable without a deploy) the
day a second publishing challenge is added. The spec awards through a challenge **invented at
runtime** for the same reason.

## 🔴 The finding: a badge that vouched for something the challenge did not mean

UNI-002 predicted *"UNI-003 renders the profile and will be the first thing to notice"* about the
undrawn artwork. It noticed something else on the way, and it was load-bearing rather than cosmetic.

**`project-first-built`** — awarded on `project.first_saved`, for pressing save — carried
**(building, bronze)**, whose badge row reads, in D4's own words, **"Published — Published your first
prefab."**

- On the profile it renders as a claim about publishing that the holder never made.
- 🔴 **And it silently cleared D8's evidence bar.** The bar reads the taxonomy, so anyone who saved a
  project once would have qualified for professional listing on the RFP board. The defect was in
  UNI-002's *data* and only a consumer of that data could see it.

**Fixed as data, which is what AC4 was built for:** `project-first-built` keeps its 20 points and
awards no badge; a new once-only **`prefab-first-published`** (40 points, `prefab.published`,
`platform_event`) awards (building, bronze) beside the existing repeatable `prefab-published`, which
is the catalogue's own documented shape. 48 challenges now.

✅ **UNI-002's existing *"every one of D4's twelve badges is reachable"* spec is what made the fix
safe** — stripping the family without providing a replacement fails it, naming building/bronze. A
guard written one task earlier caught the second half of a change made in the next.

⚠️ **What no gate can check, and it should be said plainly:** nothing mechanically asserts that a
challenge's *meaning* matches the badge it awards into. Two specs now pin these two rows by hand.
A general check would need a machine-readable statement of what each badge means, which D4 gave in
prose.

## Thirteen control runs — every mechanism proved to bite

| Control | Result |
|---|---|
| the org-minor trigger never created | **2 fail** |
| the URL scheme allow-list dropped (links + avatar) | **6 fail** |
| the display-name rules dropped | **7 fail** |
| hide no longer needs its reason · review no longer needs its time · link cap dropped · report needs no reason | 2 · 1 · 1 · 1 |
| `publicProfile` stops excluding hidden · stops checking visibility | 4 · 3 |
| the directory stops applying D8's evidence half · `profileBar.meets` stops requiring it | 1 · 2 |
| the catalogue defect put back | **1 fails** — the spec written for it |
| 🔴 `badgesFor` stops excluding revoked awards | **2 fail — mine and UNI-002's own** |

The last one is the one worth keeping: it proves AC2's *"live, not copied"* spec has teeth on a
mechanism it does not own. ⚠️ The catalogue control reverts only half the fix (`prefab-first-published`
survives it), so 1 failure is the honest number, not a weak one.

## ✅ Driven over HTTP, against consequences written before the drive

Ten lines, each phrased so a broken build could not also produce it — the slice-4 discipline.
`/u/quiet-quentin` **404** with her bio string appearing **nowhere** in the response; `/u/nia-new`
**200 while `/people` omits her and includes ada** (the D8 seam in one reading); the two filters
disjoint; hiding ada made `/u/ada-builds` **404 on the very next request** and unhiding restored it;
`/` and `/replays` still 200 after the shared layout and CSS changed.

🔴 **The contribution line was checked against a second instrument**: the page says **105 points · 2
of 12 badges** and a `psql` sum over the ledger says **105 points, 2 badges**. ⚠️ It nearly went
unverified — the first two greps matched nothing because React interleaves `<!-- -->` between text
nodes, which reads exactly like a page that renders no number at all. *A silent grep is not a
measurement.*

## ⚠️ Cut deliberately, with the reason

- **No admin HTTP route**, exactly as UNI-002 cut one and for the same reason: an unpublish-anyone
  endpoint before sessions exist. `hideProfile()` takes an actor id and waits for UNI-001.
- **No owner-facing account page.** `ownProfile()` exists, is specced and returns the moderation
  reason — but a signed-in route needs a session, and there are none. **AC4's "the owner sees why" is
  met at the API and not yet at a URL**, which is the honest statement of it.
- **No moderation history** beyond the current state plus the report rows. An append-only moderation
  log is D3's posture and is worth having; it is not the "moderation minimum" this task scopes.
- 🔴 **The twelve badge artworks still do not exist.** The profile renders the **family mark and the
  tier colour** rather than a broken image — honest today, drop-in when the SVGs land. It is
  deliberately not a placeholder graphic pretending to be the badge. **Still Richard's, still design
  work, and nothing is blocked on it.**
- **The prefab section is a named placeholder** — UNI-005 owns the shelf.
