# HLS-011 — The drive

> ✅ **BUILT + DRIVEN, session 13, 2026-09-10. 4 of 4 acceptance criteria.**
> [HLS-011-WHAT-WAS-BUILT.md](HLS-011-WHAT-WAS-BUILT.md) ·
> [the drive itself](../../../packages/nodegx-export/tests/hls011/) — `./run.sh`, one command.
> The headless half ran in `node:22-bookworm-slim` (no `DISPLAY`, no X socket, no browser, asserted
> before anything was measured); the comparison half ran here, in Chrome. **The viewer and the built
> React app say character-for-character the same thing on both pages.** The one divergence — a
> component input wired to a `width` — is named by `EXPORT-REPORT.md` and filed as **C75**;
> `npm ci` fails on a fresh export and is filed as **C76**. AC4's mutant is HLS-004's `scopeCast`
> removed, which brings issue #24's `TS18048` back on this drive's own app.

The whole story, end to end, on a machine with no display server. Last task; nothing closes the
phase without it.

## 1. The person sentence

**On a headless box, a shell creates an app, builds it and serves it — and what is served is what
the editor would draw for the same project.**

## 2. The route

1. Create a project (MCP `create_project`), no editor.
2. Author a handful of components and at least two pages — including **an `Expression` doing
   arithmetic on a component input** (HLS-004's shape) and **a component input wired to a `width`**
   (HLS-005's shape). These are in the drive on purpose.
3. `nodegx export` → `npm ci && npm run build`. It builds.
4. `nodegx serve`, and fetch a page over HTTP.
5. `nodegx render` the same project; compare against the built site.
6. 🔴 **The control the whole phase turns on:** open the same project in the editor and compare what
   it draws to what was served. This is HLS-003 verified from the far end.

## 3. Acceptance criteria

1. **(person)** Every step above, run by a person following this file on a machine with no display
   server, with nothing to invent and no undocumented flag.
2. The built site's pages are the authored pages, by content, not by count.
3. Step 6 agrees. Where it does not, the difference is named — and is either the export refusing out
   loud, or a defect row.
4. A mutant somewhere in the chain reddens the drive: the drive can fail.

## 4. Traps

- 🔴 **Verify the consequence, not the mechanism.** "The command exited 0" is not "the app works".
  Fetch the page and read what is on it.
- 🔴 **Observe before driving**, and re-run the original control before believing an absence. A
  post-drive reading reads the state the drive left.
- 🔴 **One heavy job at a time on a shared box.** This drive builds a Vite app and runs two servers;
  tear them down the moment it ends, and announce the teardown to everyone the launch was announced
  to.
- ⚠️ The drive must run where there is genuinely no display server, or it is not measuring the claim.
  A headless container, not a Mac with the window closed.
