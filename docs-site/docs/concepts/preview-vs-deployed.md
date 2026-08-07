---
title: Preview vs deployed
sidebar_position: 5
---

*Describes NodeGX 0.1.0.*

NodeGX has two distinct ways to see your app running, and they answer different questions.

## Preview: is it working, right now, as I build it

The editor has a **Preview** mode, toggled from the same control as **Design** mode in the
top bar (there's a keyboard shortcut for it too). Flip into Preview and you get your app
actually running — a real viewer, connected live to the editor, that reflects the graph
exactly as it currently stands, not a snapshot or a rebuild step. You can pick a simulated
screen size and zoom level to check a layout at a phone or tablet width, and detach the
preview into its own window if you want it alongside the canvas instead of replacing it. For
a multi-page app, you can also choose which route the preview loads first. The status bar
shows **Preview live** whenever a viewer is connected.

Preview is for **you**, while you're building. Nobody else can see it — it only runs inside
your own editor.

## Deployed: what a real visitor sees

**Deploying** turns your project into a real, hosted application other people can open in
their own browser, independent of your editor being open at all. NodeGX supports exactly one
packaged deployment path today: **Docker Compose on a machine you control** — reached from
**Deploy → Self Hosting** in the editor. Deploying packages your app together with its
backend and an admin dashboard behind a single URL, and from that point on, that URL is what
"your app" means to everyone except you.

A couple of things are true of a deploy that are not true of preview, and are worth knowing
before you're surprised by them:

- **The backend endpoint is baked in at deploy time.** Before you deploy, set **Backend
  Services** to the address the deployment will actually be reached at — not your local
  development address — or the deployed app will load its shell and never fetch any data.
- **A deploy is a snapshot.** Once deployed, further edits in the editor don't reach the
  live site until you deploy again.
- You can also choose, per project, whether a deploy renders purely in the visitor's browser
  (the default), renders each page on the server first (better for search engines and public
  data that changes), or pre-renders every page to static files at build time (best for
  content that barely changes) — from **Deploy → Self Hosting → Rendering mode**.

## The short version

Preview answers "does this work" while you're still building it. Deploy answers "can someone
else use it" — and is the explicit, separate step that makes your app reachable by anyone who
isn't you.
