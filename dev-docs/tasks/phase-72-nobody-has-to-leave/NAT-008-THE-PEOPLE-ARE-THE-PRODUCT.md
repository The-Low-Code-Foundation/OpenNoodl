# NAT-008 — The people are the product

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `editor`, `core-ui` |
| **Rulings** | ✅ D4 · inherits P67 **D9** (retention/export/DPA) |
| **Depends on** | **NAT-005**, **NAT-006** |

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
