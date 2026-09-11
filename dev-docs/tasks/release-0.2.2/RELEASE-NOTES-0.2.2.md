# NodeGX 0.2.2 — release notes

_Drafted 2026-09-01, phase 82 session 9, as row 8 preparation. **Numbers re-derived from the log
on the day, not carried over.** Richard cuts._

_Re-derived 2026-09-05, session 45. Every count below was re-taken; the workstream counts now state
their instrument, because the previous ones did not and could not be reproduced. **Instrument:** the
scope declared in each commit's `type(scope):` prefix, split on `/` and `,`, de-duplicated per
commit — so a `feat(p18/exp-011)` counts once in the export row and not twice._

🔴 **Why 0.2.2 and not 0.2.1.** There is no `v0.2.1` tag and there never was —
`git tag -l 'v0.2.1'` returns nothing. 0.2.1 was an **internal cut, held back as too buggy to
ship**. The notes should say so plainly rather than leave a gap in the numbering that reads as a
lost release.

---

**760 commits since v0.2.0, over fifteen days.** Measured `2026-09-05`:
`git log --oneline v0.2.0..HEAD | wc -l` → **760**. Of those, **238 features, 126 fixes**, and 369
documentation commits. (`v0.2.0` is dated 2026-08-21; the tip measured here, 2026-09-05.)

⚠️ **The published artefact's stat band is stale.** The
[NodeGX 0.2.2 full log](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)
reads **559 commits**; the handoff counted **567** on 09-01, and these notes said **573** the same
day; the figure on 09-05 is **760** and still rising. Re-read it against `git log` at the moment of
tagging — and note its ship-gate section still lists TPL-001 as unpublished, which row 7 changes.

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
a working members-only site — once it is on the shelf, which is the paragraph below.

And beside it a **site builder**, compiled into the editor rather than fetched over the network: a
content-managed website, with pages and sections stored as records, an admin panel that writes them,
a theme editor, and a public site that shows only what has been published — the publication boundary
enforced by the backend, so a draft is not merely hidden from the page. It is the row the create
wizard and the Templates tab draw the day you install this release.

And a **landing pages** template with **no backend at all**, compiled into the editor beside the
site builder: three complete landing pages in one project — a freelancer's at `/`, a local
business's, a product launch's — sharing a header, a footer and a contact form that opens the
visitor's own mail app with the message written and addressed. Pick the look you want, delete the
other two, put your address in one node, publish. Every string you have to change is named `EDIT —`
and listed in a `START-HERE` note generated from the graph.

🔴 **The members' area comes from the community shelf, and it is not on it until you publish it.**
`hello-world` stays withheld — it *is* the blank project, and offering it as a template offered the
blank project twice — so a 0.2.2 tagged before `publish-project-template.ts` has been run shows the
site builder and the landing pages and nothing else. **Publish before you tag** — see
`PUBLISH-0.2.2.md` §6.

And the launcher grows a **Templates** tab that lists the same shelf the create wizard reads — one
source, two surfaces — instead of the *"this feature is coming soon"* placeholder it showed before.

### 📤 Export that produces code you would keep

The largest single workstream in this release — **92 feature and fix commits** scoped `p18` or
`exp-*`. Exported projects now carry their comments, keep the code of Functions
the export could not translate, and preserve fields that earlier passes silently dropped.

And the export is now **in the editor**: Settings → Project → **Export as React code…** shows you
exactly what will and will not translate before anything is written, asks where to put it, and
writes a Vite + React project with an `EXPORT-REPORT.md` that names every node it left out and why.

The one library that exported code depends on, `@nodegx/core`, is now **on npm** — so the
`npm install` the exported README tells you to run works, with nothing to fetch by hand.

**Code export is alpha, and says so.** 117 of the 127 nodes you can place from the picker export
today (92%). The other 10 are badged *Not exportable* on the picker card and in the property
panel — each a deliberate decision the ledger names, none merely "not yet" — the pre-flight names every node it will leave out and what each one silences downstream, and
the same warning is written into the exported README with the day's number. Explore the code and
build on it; do not ship a production app from it yet. The next release moves the number.

### 🩹 What real use found

**54** feature and fix commits from driving the templates, **37** from the alpha feedback round, and
**55** from rescuing the site builder. This is the unglamorous half of the release and the reason the
0.2.1 cut was held.

A further **57** came from the 0.2.2 round itself, and those are the ones you meet first: a
**Dropdown** that no longer crashes when it has a selected value, ships with default items, and lets
you make an option by typing its label; a **Video** node that plays a pasted YouTube or Vimeo link
and takes a start and end time; **Circle** grown into a **Shape** node with squares, triangles,
polygons, stars, corner rounding and a custom SVG source; a text input whose placeholder is empty
instead of *"Type here…"*; icons that default to black; checkboxes and radio buttons that draw only
when they are on; a workbench dropdown that sees a component you created a moment ago; *Open project
folder* that reveals the folder; a Visual Function that no longer errors on its own default; and a
`var()` value that survives being touched in the property panel.

### 📖 Lessons that come with the app

Eight guided lessons (`project-examples/lessons`) now ship **inside** the application and seed
themselves on a clean first run, so the Learning tab has something in it before you have a network
connection or an account.

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

_Re-measured 2026-09-05. **Two items that stood here on 09-01 are struck**, because they were fixed
rather than carried: all thirteen members'-area pages have been photographed (120 shots, both arms,
`phase-81/verdicts/vib-001/2026-09-03/`), and every one of the thirteen now places `Members/Footer`,
so none of them ends in bare ground._

- 🔴 **The members' area is not on the shelf until it is published to it.** A 0.2.2 tagged before
  `publish-project-template.ts` has been run ships a create wizard and a Templates tab showing the
  **site builder alone** — while these notes lead on both. **Publish first.**
- ⚠️ **`/unsubscribe` has ~220px of space above its footer.** Ruled acceptable on 2026-09-04 with the
  measurement in hand — recorded so it reads as a decision rather than as something nobody saw.
- 🔴 **`Test (editor)` has a floor of failures that are expected** — see `PUBLISH-0.2.2.md` §1.
