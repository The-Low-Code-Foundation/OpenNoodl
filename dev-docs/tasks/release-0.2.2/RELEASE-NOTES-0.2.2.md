# NodeGX 0.2.2 — release notes

_Drafted 2026-09-01, phase 82 session 9, as row 8 preparation. **Numbers re-derived from the log
on the day, not carried over.** Richard cuts._

🔴 **Why 0.2.2 and not 0.2.1.** There is no `v0.2.1` tag and there never was —
`git tag -l 'v0.2.1'` returns nothing. 0.2.1 was an **internal cut, held back as too buggy to
ship**. The notes should say so plainly rather than leave a gap in the numbering that reads as a
lost release.

---

**573 commits since v0.2.0, over eleven days.** Measured `2026-09-01`:
`git log --oneline v0.2.0..HEAD | wc -l` → **573**. Of those, **164 features, 94 fixes**, and 300
documentation commits.

⚠️ **The published artefact's stat band is stale.** The
[NodeGX 0.2.2 full log](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)
reads **559 commits**; the handoff counted **567** on 09-01; the true figure at cut time is
**573** and rising. Re-read it against `git log` at the moment of tagging — and note its ship-gate
section still lists TPL-001 as unpublished, which row 7 changes.

📖 **[Read the full changelog, in plain language →](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)**
💬 **[Join us on Discord](https://discord.gg/hESuTU8nPM)** · 🌐 **[NodeGX Community](https://community.nodegx.io/)** · 🎥 **[Tutorials & updates on YouTube](https://www.youtube.com/@simple-rick-tutorials)**

---

## Les grandes lignes

Three headlines: **templates you can start from**, an **export that produces code you would keep**,
and a long pass of **fixing what real use found**.

### 🏛️ The first template on the shelf

A complete **members' area** — a landing page for an association, sign-in, ask-to-join, a
moderator queue that approves people, announcements, a diary and a directory, with the restriction
enforced by the backend and not merely hidden in the interface. Pick it in the wizard and you have
a working members-only site.

Alongside it, a **site builder** template and the admin shell that goes with it.

### 📤 Export that produces code you would keep

The largest single workstream in this release — **53 feature and fix commits** across `exp-002`,
`exp-004` and `exp-011`. Exported projects now carry their comments, keep the code of Functions
the export could not translate, and preserve fields that earlier passes silently dropped.

And the export is now **in the editor**: Settings → Project → **Export as React code…** shows you
exactly what will and will not translate before anything is written, asks where to put it, and
writes a Vite + React project with an `EXPORT-REPORT.md` that names every node it left out and why.

The one library that exported code depends on, `@nodegx/core`, is now **on npm** — so the
`npm install` the exported README tells you to run works, with nothing to fetch by hand.

**Code export is alpha, and says so.** 114 of the 127 nodes you can place from the picker export
today (89%). The other 13 are badged *Not exportable yet* on the picker card and in the property
panel, the pre-flight names every node it will leave out and what each one silences downstream, and
the same warning is written into the exported README with the day's number. Explore the code and
build on it; do not ship a production app from it yet. The next release moves the number.

### 🩹 What real use found

**29 defect commits** from driving the templates, **36** from the alpha feedback round, and **23**
from rescuing the site builder. This is the unglamorous half of the release and the reason the
0.2.1 cut was held.

### 📚 A node library the AI can see

The **shelf** — 65 catalogued entries readable at zero token cost, so the assistant can find the
right node instead of inventing one.

### 🎨 The look, measured rather than asserted

A render harness that photographs every page of a project and grades it, so "this looks finished"
became something with a reading behind it rather than an opinion.

---

## Installing

_Same as 0.2.0 — fill in from the finished draft's assets._

## Known and open

- ⚠️ **Four of the members' area's thirteen pages have never been photographed**
  (`Announcement`, `Meeting`, `Post`, `Unsubscribe`) — unmeasured, not unchanged.
- ⚠️ **Eleven pages of that template have no bottom edge** — a short page ends in bare ground.
  Known, one constant, deliberately not fixed before the cut.
- 🔴 **`Test (editor)` has a floor of failures that are expected** — see `PUBLISH-0.2.2.md` §1.
