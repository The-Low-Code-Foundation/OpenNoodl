# GitHub release body — v0.2.2

_Paste everything below the rule into the release description. **`852` commits since `v0.2.0`**,
re-derived 2026-09-06 at the tag itself: `git rev-list --count v0.2.0..v0.2.2` — **count the TAG, not
`HEAD`**, which is the ref this instrument used to name and is why the figure kept moving._

🔴 **851 was this count taken one commit early.** REL-004 recorded *"851 commits since `v0.2.0`"*,
which is the reading at `91b942df` — the commit **before** the one that was tagged. `10a6c147` was
then committed and tagged, and the count went with it. A count is a property of the ref it was
taken at, so name the ref beside the number: 849 at `613ee349`, 850 at `b1008698`, 851 at
`91b942df`, **852 at `10a6c147` = `v0.2.2`**, 853 at `a767e1f9`.

⚠️ **The "Installing" section needs the real asset names** once the draft has its 15 assets. The
0.2.0 release body is the model.

---

## NodeGX 0.2.2 — alpha

**The release where we stopped building NodeGX and started using it, and wrote down everything
that broke.** Three real applications built through the product's own doors, plus a fortnight
living inside the shipped editor. Almost everything here is a defect a builder would have hit,
fixed on the product surface rather than patched in the template that found it.

📖 **[Read the full changelog, in plain language →](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)**

> There is no 0.2.1. It was an internal cut, held back as too buggy to ship; its work rolled
> forward into this one.

### Three templates you can start from

- **A members' area** — a landing page for an association, sign-in, ask-to-join, a moderator queue
  that approves people, announcements, a diary and a directory, with the restriction enforced by
  the backend rather than merely hidden in the interface.
- **A site builder** — a content-managed website with pages and sections stored as records, an
  admin panel that writes them, a theme editor, and a public site that shows only what has been
  published.
- **Landing pages, with no backend at all** — three complete pages in one project (freelancer,
  local business, product launch) sharing a header, a footer and a contact form that opens the
  visitor's own mail app. Every string you have to change is named `EDIT —` and listed in a
  generated `START-HERE` note.

The launcher also grows a **Templates** tab reading the same shelf the create wizard reads.

### Your app leaves as code

Settings → Project → **Export as React code…** shows what will and will not translate *before*
anything is written, then writes a Vite + React project that talks to your deployed backend, with
a report naming every node it left out and why. `@nodegx/core` is on npm, so the `npm install` in
the exported README works.

**117 of the 127 nodes you can place export today (92%).** The other 10 are badged *Not
exportable* on the picker card and in the property panel. **Code export is alpha** — explore the
code and build on it; don't ship a production app out of it yet.

### What real use found

A **Dropdown** that no longer crashes when it has a selected value, ships with default items, and
lets you make an option by typing its label · a **Video** node that plays a pasted YouTube or Vimeo
link with start and end times · **Circle** grown into a **Shape** node with polygons, stars, corner
rounding and custom SVG · a text input whose placeholder is empty instead of *"Type here…"* · icons
that default to black · a `var()` value that survives being touched · eight guided **lessons that
ship inside the app** and seed themselves on first run · and a long list of contrast, border and
focus fixes across the editor.

Under that: the MCP door now refuses five classes of wiring that used to author cleanly and fail
silently at runtime, a render is mandatory before an agent may call a page done, and the look of a
page is graded against a written rubric from a real screenshot rather than asserted.

### Known and open

- **The members' area is served from the community shelf**, not built into the app — it appears
  once it has been published there.
- **The members' area ships at *passable*, not *worthy*.** Fifteen screens, graded three times;
  *worthy* is the V2 brief.
- **The Design Tokens panel is built and reachable by nobody** — it registers behind a flag that is
  undefined in every build. One line, and a decision about two other undriven panels.
- **Four site-builder screens are still open**: sections worth having, a theme editor that demos
  itself, messages, and live preview over the realtime hub.

### Installing

_Fill in from the draft's assets — same shape as 0.2.0._

---

🎥 [Intro to NodeGX](https://www.youtube.com/watch?v=fqmHH36ndc0) ·
[tutorials on YouTube](https://www.youtube.com/@simple-rick-tutorials) ·
🌐 [community.nodegx.io](https://community.nodegx.io/) ·
💬 [Discord](https://discord.gg/hESuTU8nPM)
