# NodeGX 0.2.0 — alpha

The first release since 0.1.7 (13 August). 164 feature and fix commits.
This one is for testing: please install it, use it, and tell us what broke.

## The community is in the editor now

There is a **Community** entry in the rail. It is not a link to a website.

- **Ask about a node, then answer from the editor.** Right-click any node →
  *Ask about this node*. Threads open in the rail, render every post, and you
  can reply and accept an answer without a browser.
- **A people directory** — search members, open a profile, reach an author from
  the line under their post.
- **Tutorials you can install in one click.** A tutorial row with a bundle
  installs it as a project; no download, no unzip.
- Guides, call replays, and an honest readout of how the community is doing.

Sign in from the launcher to post. Reading works signed out.

## Custom node kits

You can build, package and install your own nodes.

- Scaffold a kit, install it four different ways, and get a real error when one
  is broken — a bad kit costs you the kit, not the app.
- Kits render server-side and in the cloud runtime.
- Kits carry provenance and their author's own description.
- The node picker tells you which kit a node came from.
- Compatibility gating that names *why* a kit was refused.

## Learning

- **The first tutorial** — *Log a thing* — teaches the composition ruling:
  async lives on the canvas, blocks are synchronous computation.
- **Backend Services shows the backend you are attached to**, not all forty on
  your machine. The rest are behind a finder that searches what is on disk.
- Lesson steps can now see data — a step can require a collection, its columns,
  or a row count, so a data tutorial can actually grade the data.

## Fixed from the first week of using it

The alpha was used in anger before it shipped, and these came out of that.

- **A data tutorial now gets its own database.** *Log a thing* grades against a
  real database, and the lesson makes one for you when you open it — you create
  the collection, which is the step. Previously the panel that could make one was
  hidden inside a lesson, so the tutorial could not be finished at all.
- **The dark theme's working text is no longer grey on grey.** Every ink passed
  contrast against its background and still read as *disabled*, because the whole
  set sat in the middle of the ramp with only one rung near white. Raised.
- **A step no longer reports a cap as a count.** "21 problems" was `min(N, 20) + 1`
  — the same number for 26 problems or a thousand — and the sentence blamed the
  learner for defects that ship inside the lesson.
- **A failed write says so.** The "explain this for me" button answered a 404 by
  drawing nothing at all.
- **Deleting a node a step is grading now asks first**, and names the step.
- **Inline `fx` expressions are no longer reported as invalid.** A parameter you
  switched to an expression was read against the port's plain type and reported
  as a defect, on projects that were working.
- **An OpenAI-compatible gateway is offered its own models.** The preselected
  model was `gpt-4.1`, an id a DeepInfra or vLLM endpoint does not serve.
- **A rejection names each problem once.** Two checks had begun reporting the
  same finding, so one mistake read as two and could exhaust a repair round.
- Opening a project lands on Components; the launcher opens on Projects; the
  Learning tab stops asking someone signed in to sign in.

## The editor is easier to look at

- Body text now clears 4.5:1 in both themes. The default grey did not.
- Cards no longer dissolve into the canvas — the dark elevation ramp was
  1.06:1 between the two lowest grounds and is now measurably open.
- The CodeMirror syntax palette was graded against the ground it actually
  paints on, including the active line.
- ~30 foreground/background pairings are now gated in CI, in both themes.

## Blocks, scripting and AI

- App Objects blocks return, with the `Number()` operator and a log block.
- A Script node is treated as a Script node, not a Function node with different
  words.
- App Variables is back, and the six locales have a gate for the first time.
- The AI planner decomposes less, the reuse cell reports honestly, and the
  editor tells the model who it is building for.
- The explainer can read the running app and look inside a component instance.

## Packaging and safety

- A zip entry that tries to escape its target is refused.
- The backend service and both MCP servers ship inside the app.
- The render harness ships inside the asar, so it works on a packaged install.

## Known limitations

- **Windows builds are not code-signed.** SmartScreen will warn. macOS is
  signed and notarised.
- **Auto-update downloads silently and installs on quit.** If you accept an
  update and nothing appears to happen, it is working — quit the app.
- Opening a project writes three files into it.
- The RFP/work board exists on the server but has no editor view yet.
- *State on a page* ships with diagnostics inside it; the step counter is honest
  about them now, but the lesson itself has not been cleaned up.
