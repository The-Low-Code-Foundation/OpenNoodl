**524 commits since v0.1.7, over eight days.** Three headlines: a **community** and a
**school** that live inside the editor rather than in a browser tab, **nodes you can
write yourself**, and a tutorial **your own Claude can author** into your Learning
folder.

Then two rounds of using NodeGX rather than building it — the first real user test
(**23 of 24 items closed**) and a week with the alpha — which is where most of the
fixes below come from.

📖 **[Read the full changelog, in plain language →](https://claude.ai/code/artifact/290e0f79-fc8f-486f-b850-0ea591c5c198)**
💬 **[Join us on Discord](https://discord.gg/hESuTU8nPM)** · 🌐 **[NodeGX Community](https://community.nodegx.io/)** · 🎥 **[Tutorials & updates on YouTube](https://www.youtube.com/@simple-rick-tutorials)**

---

## Les grandes lignes

### 🔑 One account, and it gates nothing
Sign in from the launcher — a device flow, deliberately, so the editor never opens a
listening socket for it. **NodeGX stays fully functional signed out, forever.** No
feature, node, panel or export is ever behind the account; signing in *adds* surfaces
and never subtracts one. Anonymous usage data is opt-**in**, scoped in the sentence
itself as *which nodes people ask about, never project content*.

### 💬 The community is in the editor
There is a **Community** entry in the rail, and it is not a link to a website.
Right-click any node → *Ask about this node*, and the question opens as a thread
already carrying which node you meant — you can reply, accept an answer, and share a
preview of what you are actually looking at, without a browser. There is a people
directory with real search, profiles you can reach an author from, guides, call
replays, and an honest readout of how the community is doing. Badges are twelve marks
generated from **four family shapes and one tier rule**, so the set cannot drift as it
grows.

### 🎓 A course beamed into the real editor
An **intake conversation** and then a path built around your answers, rather than
starting everyone at lesson one. A **tutor overlay** that sits over the work instead of
beside it. A **Learning folder** in the launcher that keeps lesson projects apart from
your real ones and carries their completion and score — and **a lesson can be installed
with no account at all**. **"Check my work"** grades locally using the same validation
and render tooling the AI uses, then hands the result in. Grading now runs in two
engines, and building the second one immediately found **six lesson steps passing a
check they should have failed**.

### 🤖 Your own Claude can write a tutorial
For people who skip the platform entirely, the MCP server can author a lesson into your
Learning folder — and the answer to *"what if it teaches the wrong thing"* is not trust.
`get_lesson_brief` teaches the condition vocabulary and names the four traps that make a
plausible lesson silently unfinishable. **`create_lesson` writes the bundle only if every
machine-checkable failure class passes**, and a refusal names the step, the class and
what to change. **`derive_starter` builds the starting project by *subtracting* the
lesson from its own solution**, then replays every graded step against the result — which
makes ghostwriting structurally hard rather than merely checked for, because the starter
cannot contain the answer. Generated lessons are labelled as AI-authored where you
install them.

### 📚 The first tutorial, and lessons that can see data
*Log a thing* teaches the composition ruling: async lives on the canvas, blocks are
synchronous computation. **Lesson steps can now see data** — a step can require a
collection, its columns, or a row count, so a data tutorial grades the data rather than
the shape of the graph. Community tutorials install in one action with no browser, and
the Learning folder refuses a lesson nobody could finish. Backend Services shows the
backend you are attached to, not all forty on your machine.

### 🧰 Nodes of your own
Twenty tasks, under two rules that were acceptance criteria in every one of them.
**A custom node is a node** — no capability gap against a built-in; provenance may be
displayed, never be a limitation. **Ports are the product, JavaScript is the escape
hatch.** Scaffold a kit and install it four ways behind one gate; **a broken kit costs
you the kit, not the app**, with an error naming which kit failed and why. Kits render
server-side and in the cloud runtime, carry provenance and their author's own
description, and the node picker tells you which kit a node came from. Compatibility
refusals name *why*. A CI gate fails the moment the published origin and the shipped
library diverge — and says in its own output that it checks coverage by label, not
content.

### 🔍 The first real user test — 23 of 24 closed
The finding that shaped the phase: most of it was **not missing features, but built
machinery the user could not reach.**
- **The explainer can read the running app.** Live port values were sitting there and it
  never asked for them. It can now also look inside a component instance, and stopped
  calling nodes it was never asked about "not mounted".
- **A composer you can type in** — multiline, a real Send button, and one send key
  everywhere: Enter sends, Shift+Enter starts a line. **AI text is selectable and
  clickable app-wide.**
- **The Signal output hidden in a nested row.** `Signal` was always available — the Type
  row is created *after* the port, so nobody found it. Offered at add time now.
- **The editor shows what you can type**, including at a position where you have typed
  nothing at all.
- **The connector the AI could not draw** — a port-name prefix the write path did not
  honour, so a wire the model correctly asked for never appeared.
- **Five popups stopped clipping their own buttons**; the node picker starts at its top
  result; a component card says it can be opened; the workbench says where you are, with
  a divergence chip and a way back; one width for the selection slot; a bench frame with
  a height; a way back to no scenario; the dropdown nobody could read — and the worse one
  above it, which had not been reported.
- **The AI stopped writing code from 2019**, a Script node is validated as a Script node,
  and logic gets its own column instead of everything piling into one.
- **The project knows who it is being built for** — a profile the editor and Claude Code
  both read. **Connect is idempotent and binds the right project.** **One typeless node no
  longer kills the server.**

⚠️ Five of the sixteen reports had a false premise, found by reading every claim in
source before building. And **the style-token editor is deliberately not in this
release** — it produced rulings and a successor phase instead of code.

### 🩹 Then a week with the alpha
- **A data tutorial now gets its own database.** *Log a thing* grades against a real
  database and the lesson makes one for you when you open it. Previously the only panel
  that could make one was hidden inside every lesson, so **the tutorial could not be
  finished at all.**
- **The dark theme's working text is no longer grey on grey.**
- **A step no longer reports a cap as a count.** "21 problems" was `min(N, 20) + 1` — the
  same number for 26 problems or a thousand.
- **Inline `fx` expressions are no longer reported as invalid** on projects that were
  working.
- **A failed write says so.** *Explain this for me* answered a 404 by drawing nothing.
- **Deleting a node a step is grading now asks first**, and names the step.
- **A rejection names each problem once**; **an OpenAI-compatible gateway is offered its
  own models** (the default was `gpt-4.1`, an id those endpoints do not serve);
  **release notes you can read, click and copy** in the update dialog.
- Opening a project lands on Components; the launcher opens on Projects; the Learning tab
  stops asking someone signed in to sign in.

### 🎨 Easier to look at, and measurably so
The review began with "it is too dark"; the measurement said something worse — **the
default body colour failed AA in both themes**, at 3.93 and 3.62 against the primary
ground. Retired. Cards no longer dissolve into the canvas: the dark elevation ramp was
**1.06:1** between its two lowest grounds. Accent and status colours now split fill from
text. The CodeMirror palette was graded against the ground it actually paints on,
including the active line. **~30 pairings are gated in CI in both themes — and every
second copy of the palette is checked too**, because the duplicate is where a fixed
colour goes to be un-fixed.

### 🔒 Safety, and what ships inside the app
This is the first release where installing content written by strangers — kits, lessons,
posts — is a normal thing to do, which changes which seams matter. **A zip entry that
tries to escape its target is refused.** **A lesson body could name `javascript:`, and
now cannot.** A style name is escaped before it reaches an HTML sink. App Objects blocks
return with the `Number()` operator and a log block; App Variables is back and the six
locales have a gate for the first time. The backend service and both MCP servers ship
inside the app, and the render harness ships inside the `asar`.

---

## Installing

| | |
|---|---|
| **macOS** | Signed and notarised — no Gatekeeper workaround needed. Apple Silicon and Intel builds. |
| **Windows** | Not code-signed yet, so SmartScreen warns on first run: **More info → Run anyway**. |
| **Linux** | AppImage and `.deb`, unsigned — normal for Linux desktop distribution. There is no in-app updater on Linux. |

**Updating.** An update downloads quietly and installs when you quit. If you accept one
and nothing appears to happen, it is working — quit the app and it will be there.

---

## Known and open

We write down what we found and did not fix.

- **Windows is unsigned.** The SmartScreen warning is about a real absence, not a false
  alarm — we have not bought the certificate yet. macOS needs no workaround.
- **The node library is not licence-audited.** Around nine shipped modules vendor large
  third-party libraries with no licence text, and one mapping dependency is proprietary
  from v2 onward. "Twenty tasks built" is not the same claim as "fit to publish".
- **The style-token editor is not in this release.** The tokens driving every colour and
  spacing value in your app still have no editing UI in any shipped build. The largest
  known gap here.
- **An update shows nothing while it downloads.** The events needed are available and
  unused.
- **No mail leaves the platform.** The outbox drainer is written and tested and is
  imported by two files, both tests — nothing calls it. *"Someone answered you"* has never
  been sent, so come back and look.
- **Opening a project writes three files into it** — a connection config and briefing
  files, so the next agent session is not cold.
- **The RFP/work board has no editor view yet.** It exists on the server and the editor's
  client is written; there is nothing to look at.
- **Two community surfaces are on but empty.** The tutorial directory answers correctly
  and lists nothing yet, and *Explain this for me* answers `unavailable` until a key is
  configured on our side. Both are served rather than shipped, so both can start working
  on an install you already have.
- ***State on a page* ships with diagnostics inside it.** The step counter is honest about
  them now, but the lesson has not been cleaned up.
