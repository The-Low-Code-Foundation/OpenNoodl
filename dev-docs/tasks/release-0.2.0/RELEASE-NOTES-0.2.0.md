**524 commits since v0.1.7, over eight days.** Two headlines: the community moved
inside the editor — ask about a node, find the person who wrote it, install a
tutorial in one click — and **you can now build and ship nodes of your own.**

Then we used the alpha in anger for a week. A tutorial that could not be
finished, a dark theme you could not read, and a step that reported a cap as a
count all came out of that, and all are fixed here.

📖 **[Read the full changelog, in plain language →](https://claude.ai/code/artifact/290e0f79-fc8f-486f-b850-0ea591c5c198)**
💬 **[Join us on Discord](https://discord.gg/hESuTU8nPM)** · 🎥 **[Tutorials & updates on YouTube](https://www.youtube.com/@simple-rick-tutorials)**

---

## Les grandes lignes

### 💬 The community is in the editor
There is a **Community** entry in the rail, and it is not a link to a website.
Right-click any node → *Ask about this node*, and the question opens as a thread
already carrying which node you meant. Threads render every post, and you can
reply and accept an answer without a browser. There is a people directory —
search members, open a profile, reach an author from the line under their post.
Tutorials with a bundle **install in one click**, as a project: no download, no
unzip. Plus guides, call replays, and an honest readout of how the community is
doing. Reading works signed out; sign in from the launcher to post.

### 🧰 Nodes of your own
Scaffold a kit and install it four different ways — and **a broken kit costs you
the kit, not the app**, with a real error naming what is wrong with it. Kits
render server-side and in the cloud runtime, so a custom node is not a
canvas-only illusion that vanishes when you deploy. They carry provenance and
their author's own description, the node picker tells you which kit a node came
from, and a kit refused for the wrong editor version **says why** instead of
failing to appear.

### 📚 A tutorial that grades what you actually built
*Log a thing* is the first one, and it teaches the composition ruling: async
lives on the canvas, blocks are synchronous computation. **Lesson steps can now
see data** — a step can require a collection, its columns, or a row count, so a
data tutorial grades the data rather than the shape of the graph. Backend
Services shows the backend you are attached to, not all forty on your machine.

### 🩹 What a week of real use found
- **A data tutorial now gets its own database.** *Log a thing* grades against a
  real database and the lesson makes one for you when you open it — you create
  the collection, which is the step. Previously the panel that could make one was
  hidden inside every lesson, so **the tutorial could not be finished at all.**
- **The dark theme's working text is no longer grey on grey.** Every ink passed
  contrast against its background and still read as *disabled*, because the whole
  set sat in the middle of the ramp with only one rung near white.
- **A step no longer reports a cap as a count.** "21 problems" was `min(N, 20) + 1`
  — the same number for 26 problems or a thousand — and the sentence blamed the
  learner for defects that ship inside the lesson.
- **Inline `fx` expressions are no longer reported as invalid.** A parameter you
  switched to an expression was read against the port's plain type and reported
  as a defect, on projects that were working.
- **A failed write says so.** *Explain this for me* answered a 404 by drawing
  nothing at all.
- **Deleting a node a step is grading now asks first**, and names the step.
- **A rejection names each problem once.** Two checks had begun reporting the
  same finding, so one mistake read as two.
- **An OpenAI-compatible gateway is offered its own models.** The preselected
  model was `gpt-4.1`, an id a DeepInfra or vLLM endpoint does not serve.
- Opening a project lands on Components; the launcher opens on Projects; the
  Learning tab stops asking someone signed in to sign in.

### 🎨 Easier to look at, and measurably so
Body text now clears 4.5:1 in both themes — the default grey did not. Cards no
longer dissolve into the canvas: the dark elevation ramp was **1.06:1** between
its two lowest grounds. The CodeMirror syntax palette was graded against the
ground it actually paints on, including the active line. And **~30
foreground/background pairings are now gated in CI**, in both themes — a
pairing, not a colour, because checking colours in isolation is what let that
ramp reach 1.06:1.

### 🧩 Blocks, scripting and AI
App Objects blocks return, with the `Number()` operator and a log block. A Script
node is treated as a Script node, not a Function node with different words. App
Variables is back, and the six locales have a gate for the first time. The
explainer **can read the running app** and look inside a component instance. The
planner decomposes less, the reuse cell reports honestly, and the editor tells
the model who it is building for.

### 🔒 Packaging and safety
A zip entry that tries to escape its target is refused — kits arrive as archives
from other people, which makes this the seam that matters most here. The backend
service and both MCP servers ship inside the app, and the render harness ships
inside the asar so it works on a packaged install.

---

## Installing

| | |
|---|---|
| **macOS** | Signed and notarised — no Gatekeeper workaround needed. Apple Silicon and Intel builds. |
| **Windows** | Not code-signed yet, so SmartScreen warns on first run: **More info → Run anyway**. |
| **Linux** | AppImage and `.deb`, unsigned — normal for Linux desktop distribution. There is no in-app updater on Linux. |

**Updating.** An update downloads quietly and installs when you quit. If you
accept one and nothing appears to happen, it is working — quit the app and it
will be there.

---

## Known and open

We write down what we found and did not fix.

- **Windows is unsigned.** The SmartScreen warning is about a real absence, not a
  false alarm — we have not bought the certificate yet. macOS needs no workaround.
- **An update shows nothing while it downloads.** The events needed to show
  progress are available and unused; wiring them is the fix and it is not here.
- **Opening a project writes three files into it** — a connection config and
  briefing files, so the next agent session is not cold. Worth knowing before you
  open something under version control.
- ***State on a page* ships with diagnostics inside it.** The step counter is
  honest about them now, but the lesson has not been cleaned up, so it reports
  real defects that are ours and not yours.
- **The RFP/work board exists on the server but has no editor view yet.**
- **Two community surfaces are on but empty.** The tutorial directory answers
  correctly and lists nothing yet, and *Explain this for me* answers
  `unavailable` until a key is configured on our side. Both are served rather
  than shipped, so both can start working on an install you already have.
