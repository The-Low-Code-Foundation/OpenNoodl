# REL-002c — what I would change

_Written 2026-09-01, session 9, after Richard ruled the row **FINE** and asked what I would change
rather than leaving me to guess at a fix. Read against the renders at HEAD `60fe7e16`, artefact
`27f127e9` — the same photographs as the
[proof sheet](https://claude.ai/code/artifact/137133e4-aa38-4f02-9251-bbc94124bef7)._

🔴 **These are mine, from looking at the pictures. Richard's own verdict may name none of them** —
if it does, his list wins and this one is a starting position, not a plan.

Ordered by how much they cost against how much they change.

---

## 1. The door landing is a photograph and then nothing — 🟢 small

**The symptom.** At 1280 the unconnected landing is: photograph, the "not connected yet" notice on
its scrim, then **~230px of bare `--muted` ground**, a hairline, and the footer. At 1900 it is
**~330px**. A stranger who opens an app that has not been connected sees a picture, an apology, and
a void.

🔴 **This is session 8's own lesson repeating one element further down.** S7 added the footer "so
the page has a bottom edge in every state"; s8 found the door state still ended in 270px of bare
ground below it and fixed that with `space-between`. `space-between` did not remove the hole — it
**moved it above the footer**. The page still does not fill.

**The change.** The living landing carries two bands the door state does not: "About us" and **"What
members can see"** (the three tiles). The tiles are **static copy that needs no backend and no
association** — "Announcements / The diary / The directory" is true of every install. Mounting that
band in the door state fills the page *and* answers the question a stranger actually has, which is
*what is this*.

**Cost.** One `mounted` parameter on a band that is already built, plus a render to grade.
🔴 **The two edits are one edit** — a default-closed group without the wire that opens it is a
deletion, which is exactly how the hero was lost in s7.

---

## 2. `/members` ends with four buttons that are all already in the nav — 🟢 small

**The symptom.** Below the announcements list: a `What's coming up` button, then a "FOR MODERATORS"
strip with `Post something`, `Requests to join`, `Who belongs`. The nav pills at the top of the same
page are `Announcements · Meetings · Post · Requests · Who belongs · Your account`. **Every one of
the four duplicates a pill three inches above it.**

**The change.** Keep `Post something` — it is the page's one real call to action and deserves to be
a filled button. Delete the other three. The "FOR MODERATORS" label then means something, because
what is under it is genuinely the moderator's action rather than a second copy of the nav.

**Cost.** Deleting three buttons. The risk is nil and the page gets shorter and clearer.

---

## 3. `/join`'s sign-in offer is made twice — 🟢 trivial

**The symptom.** Under the form: *"Already have an account? Sign in instead."* — which reads as a
link and is not — immediately followed by a separate outline **`Sign in`** button.

**The change.** *"Already have an account?"* and the button. One sentence, one control.

**Cost.** One string.

---

## 4. Eleven pages still have no bottom edge — 🟡 one constant, but it touches every page

**The symptom.** `/setup` ends at ~500px with white beneath; `/directory` is four rows and then
~230px of white. `PAGE_GROUND` carries an inert `height: 100%` — a percentage height resolving
against a `Router` that sizes to its content, so it has never done anything on any page.

**The change.** `minHeight: 100vh`, the one dimension port that takes `vh`. The landing and `/join`
already float on `BAND_PAGE_GROUND` and are unaffected.

**Cost.** One constant — but it changes all eleven, so it needs a render pass across the set to
grade rather than a spot check. This was deliberately left in s8 for exactly that reason.

⚠️ Doing 1 and 4 together is cheaper than doing them apart: they share a render.

---

## 5. `/directory` is a table with no headers and very wide gaps — 🟡 small-to-medium

**The symptom.** At 1200 the three columns land at roughly x=36, x=285 and x=537, so a name and its
email are separated by ~250px of nothing, and `Member · since 1 September 2026` runs on as one
string with no column to tell you what it is. There is no header row, so nothing names the columns.

**The change.** A header row — *Name · Email · Standing* — and tighter column proportions (roughly
40 / 35 / 25 rather than three equal thirds).

**Cost.** Medium only because of the fold: the row already collapses to one column under 700px, and
a header row has to disappear when it does. 🔴 **The census in §2 of the gate counts "a Group
wrapping exactly one Text" as a notice box** — three more such cells is exactly the shape s8 had to
correct the census for. Read the gate before choosing the tree.

---

## 6. `/setup` has no identity at all — 🟠 optional, and I would ask first

**The symptom.** `/` and `/join` both open on a photograph with the page's head on the scrim.
`/setup` — the owner's **first ever screen of the product** — is a bare form on white with a small
eyebrow. It is the least designed page in the template and it is the first one anybody sees.

**The change.** The `/join` band pattern, reused: a band photograph with `Set up this members' area`
on the scrim.

**Cost.** Small in mechanism — the pattern exists and `/join` is built on it. I list it last and
call it optional because it is the only item here that is **taste rather than defect**: a plain
setup form is a defensible choice, and a first-run page carrying a stock photograph before the
association has chosen anything is arguable in both directions. **Richard's call, not mine.**

---

## What I am NOT proposing

- ⚠️ **The `EDIT ME —` footer lines stay.** They look like placeholder copy because they are, but
  they are an instruction to the person installing the template and that is correct for a template.
- ⚠️ **The announcement row's remaining white space stays.** S8 added the excerpt for exactly this
  and recorded that every rearrangement of the row was a 390px regression. It is better than it was;
  it is not worth reopening.
- ⚠️ **`FORM_GROUND` stays at 720 centred** — ruled by Richard, 2026-09-01, this session.

## What is still unmeasured

🔴 **Four of the thirteen pages have never been photographed** — `Announcement`, `Meeting`, `Post`,
`Unsubscribe`. The harness asks for nine (`vib001-members.look.ts`, two shot lists), so their
absence is a fact about the request, **not** about how they look. If REL-002c is to mean all
thirteen pages, they need adding to the harness before the row can honestly close.
