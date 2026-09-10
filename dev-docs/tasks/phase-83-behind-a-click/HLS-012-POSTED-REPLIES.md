# HLS-012 - the replies AS POSTED, 2026-09-10 (session 16)

🔴 **This is the posted text. It is NOT [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md)** - the s2
drafts had decayed, and three of their claims had been disproved by this phase's own tasks. That file
keeps the drafts as history and explains what went wrong with them.

Every reply opens with `Automated reply generated from Claude`, names **0.2.3** as the release, names
**no date**, and says plainly that nothing is on `main` or npm today. **None of the six issues was
closed** - see the drafts file for why.

---

## #11 - @dominikstohl, open since 2025-04-16

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/11#issuecomment-5618289591>

> Automated reply generated from Claude.
>
> You were not blind, and this should not have taken seventeen months to say.
>
> The `noodl build` command documented at `docs.noodl.net/2.9/cli/commands/build/` was **never part of what was open-sourced**. When you opened this issue there was no build or export CLI in the repository at all — four packages shipped a `bin` (`noodl-mcp`, `noodl-preview`, `nodegx-backend`, `nodegx-observe`) and none of them built an app. You went looking for something that genuinely was not there.
>
> One thing will have made the search worse: **`main` is still on the 0.1.x line.** The exporter is not on `main` even now — it lives on the development branch, along with several other packages. If you were reading `main`, the code was not there to find either. [#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) is the open PR that syncs them.
>
> ## What exists now
>
> There is a `nodegx` binary (`@nodegx/export`, `publishConfig.access: public`) with five subcommands:
>
> | command | what it does |
> |---|---|
> | `nodegx export <project> <out>` | emits a React + Vite app as **source** — you run `npm install && npm run build` and you own the code |
> | `nodegx deploy <project> <out>` | writes a **ready-to-host static site** running the interpreter — no build step, and a second deploy into the same folder is an update that removes what its own previous deploy left behind |
> | `nodegx serve <dir>` | serves a built folder. **Loopback by default**; `--host`/`--token` make sharing an explicit decision that prints a URL and a token |
> | `nodegx render <project> <out>` | screenshots the app per viewport, headlessly |
> | `nodegx live <url> [--against <folder>]` | reads the identity out of the **served** artefact, so "is the thing running the thing I built" has an answer |
>
> There is also an `export_react` MCP tool, so an agent can ship what it built without a person opening the editor.
>
> **Your case — continuous deployment — is `export`.** The pipeline is:
>
> ```
> nodegx export ./my-project ./exported
> cd exported && npm install && npm run build
> nodegx serve ./exported/dist
> ```
>
> That runs on a machine with no display server and no browser installed; it was driven end to end in a Linux container, and the built React app and the editor's own viewer were compared character-for-character on the same project.
>
> `--dry-run` touches the filesystem not at all and **exits 4** when something in the project cannot be translated, which is the behaviour you want in a pipeline — the job fails rather than shipping a quietly incomplete app.
>
> ## Two honest caveats
>
> 1. **Code export is in alpha: 117 of the 127 nodes you can place export today (92%).** The rest are **left out by name** — the export report names each one rather than dropping it silently. Explore it and build on it; don't ship a production app from it yet.
> 2. **None of this is released.** It is built and gated on the development branch, it is not on `main`, and `npm i nodegx` will 404 today. It ships in **0.2.3**. I'm not going to give you a date.
>
> The two defects that would have bitten you specifically are both fixed on that branch: [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24) (`npm run build` failing on an untouched export) and [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23) (component-input bindings dropped while the report claimed nothing was left over).
>
> [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) is the umbrella issue for this work — same core, asked from the agent angle. Thank you for the patience, and sorry for the silence.

---

## #36 - @dishant-kumar-thakur, the umbrella issue

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/36#issuecomment-5618293618>

> Automated reply generated from Claude.
>
> Taking this as the umbrella issue for the headless work. Your reading held up almost everywhere it could be checked from outside, and the two things a sourcemap could not show both made the job **bigger** rather than smaller. Everything in your table is now built.
>
> ## Your table, answered
>
> | you asked for | state |
> |---|---|
> | `nodegx export` | **built** — React + Vite source; `--dry-run` touches nothing and exits **4** when something cannot be translated |
> | `nodegx render` | **built** — headless screenshots per viewport |
> | `nodegx serve --host --token` | **built** — loopback by default; sharing is an explicit decision that prints a URL and a token. Same task as [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) from the other end |
> | `export_react` MCP tool | **built** |
> | `deploy` | **built** — but it is a different artefact from `export`, see below |
>
> Two you did not ask for, which the work turned out to need:
>
> - **`nodegx live <url> [--against <folder>]`** — reads the identity out of the **served** artefact and fetches the export it names, so "is the thing that is running the thing I built" is answerable without a person looking at a page.
> - **`nodegx deploy` into a folder it has deployed to before is an update**, not a second site beside the first.
>
> ## Where your correction was right, and where it was not
>
> **You were right that `deploy` belongs in the table.** An earlier draft of this reply argued that `deploy` was a different order of work from `export` and that nothing should promise a `deploy` command before a spike returned a verdict. The spike ran, the verdict was *yes — `deployToFolder` runs headlessly, no Electron*, and it was built. Your table was right that they sit side by side.
>
> **Where the table was wrong is that they are one shape.** They are two artefacts:
>
> - `export` gives you **React source** you build and own.
> - `deploy` gives you a **ready-to-host site running the interpreter** — no build step.
>
> Both are legitimate; a pipeline picks one.
>
> ## The two things the sourcemap could not show
>
> **1. `@nodegx/export` could not be published as it stood.** Beyond `"private": true` and no build script, two files reached *out* of the package by deep relative path — `DEFAULT_TOKENS` from the editor and `detectIO` from `noodl-runtime`. Both were shared truth rather than strays, so each needed a decision rather than a move. That is done: the package is public, builds to `dist/`, and ships `bin: { nodegx }`.
>
> **2. The exporter read the project file as written, not the graph the editor showed the author.** This is the one that mattered for your use case, and it was in neither issue. The editor applies a set of patches when it opens a project; readers that go straight to the files on disk do not. Every command in your table could ship green and the export could still disagree with the canvas — and in a CI job there is nobody to notice.
>
> **The exporter now applies that load, and says where it did so.** The reason it settles rather than refusing is worth recording: on one fixture the un-migrated reading did not ship a subtly different app, it **refused work the exporter could have done** — two `Condition` nodes reported a parameter the author never chose and cannot see on the canvas, and the export fell from *translated with nothing left over* by two whole pages and four cascade nodes. Refusing would have made the export refuse hardest on exactly the projects the seam already damages. A second enforced scan now makes a fourth headless reader impossible to add silently.
>
> ## One correction to a claim in this thread's scoping
>
> An earlier measurement here held that cloud functions had **no** headless door — that `WorkflowDocument.deployFunctions()` was the only path, reached from "exactly two call sites, both of them UI". **Re-measured, that was wrong on all three counts:** one caller, not two; and two *non-UI* triggers already existed (autosave, and backend start). The real subject was `services/CloudFunctionDeployer.ts`. Cloud functions now deploy with no editor running, which closes the actual hole — an agent could previously create a backend and then not put a function on it.
>
> ## Status, plainly
>
> **None of this is released.** It is built and gated on the development branch, it is not on `main` — [#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) syncs that — and `npm i nodegx` will 404 today. It ships in **0.2.3**. No date.
>
> **Code export is in alpha: 117 of the 127 placeable nodes export (92%)**, and the rest are left out **by name** rather than silently.
>
> Related and in scope with this one: [#11](https://github.com/The-Low-Code-Foundation/NodeGX/issues/11) (the same core from the CI angle, asked in April 2025), [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23), [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24), [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31), [#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38).
>
> Thanks for the measurements — the `--preflight` and injected-`fs` observations in particular saved the scoping sweep a day.

---

## #31 - the security report (workaround-led, by Richard's ruling)

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/31#issuecomment-5618294150>

> Automated reply generated from Claude.
>
> **Confirmed, and it is worse than this issue could have known. There is a mitigation you can apply today — that comes first, because the fix is not released yet.**
>
> ## What to do now, on 0.2.2
>
> The current released build listens on **all interfaces on both 8574 and 8575**. Until a release carries the fix:
>
> - **Do not run the editor on a network you do not trust** — a café, a conference, a shared office LAN.
> - If you need to work on such a network, **block inbound TCP 8574 and 8575 at the host firewall.** On macOS, enabling the firewall's "Block all incoming connections" is sufficient; the editor's own use of both ports is loopback and is unaffected.
>
> ## What was actually exposed
>
> You named one socket. There were two, and the second one is the worse of the pair:
>
> | socket | in 0.2.2 | why it matters |
> |---|---|---|
> | `web-server.js` — HTTP + relay, **8574** | bound to `::`, ungated | `GET http://<host>:8574/` **handed back the relay credential in the response body**, to anyone on the LAN, with `curl` |
> | `design-tool-import-server.js` — WebSocket, **8575** | bound to `::`, ungated | accepts connections from anywhere, and **has no sharing case at all** — there is no scenario in which this should be reachable off the machine |
>
> This issue could not name 8575, because its *default* was already what a reader would call correct — the problem was that it had no gate behind the default.
>
> ## The fix, which is built
>
> - **8574** is loopback until you explicitly share it, and once shared it requires a token of every non-loopback caller. A loopback caller is never challenged — gating loopback would break the editor's own use of the port for no security gain.
> - **8575** is loopback **unconditionally** and is not shareable.
> - The same `resolveAccess` / `authoriseRequest` pair now backs `nodegx serve`, so sharing is always an explicit decision that prints a URL and a token rather than a default that listens everywhere.
>
> A spec asserts the bound address by reading it off the **listening socket** rather than off the configuration, so "the address is 127.0.0.1" cannot pass on a machine that merely has no other interface.
>
> **Status:** built on the development branch, **not released**. It ships in **0.2.3**. No date. Deliberately leaving this issue open until a release actually carries the fix — a source fix is not a shipped fix, and closing it while every installed copy is still exposed would be the wrong signal.
>
> Thank you for reporting it.

---

## #24 - `npm run build` fails on an untouched export

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/24#issuecomment-5618295078>

> Automated reply generated from Claude.
>
> Fixed on the development branch. A freshly exported project now passes `npm run build`, and the build was **run** rather than reasoned about — the gate compiles the emitted app rather than asserting on its source text.
>
> The regression guard is a mutant: removing the fix brings this exact `TS18048` back, so the gate cannot quietly stop grading it.
>
> The whole pipeline is now driven end to end on a machine with no display server and no browser installed — `nodegx export`, then `npm install && npm run build`, then serve — and the built React app and the editor's own viewer were compared character-for-character on the same project.
>
> **Not released yet:** it is on the development branch, not on `main` ([#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) syncs that), and it ships in **0.2.3**. No date.
>
> In scope with [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36), the headless CLI umbrella.

---

## #23 - component-input bindings dropped silently

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/23#issuecomment-5618295659>

> Automated reply generated from Claude.
>
> Fixed on the development branch — and you were right that the report was the worse half of this bug.
>
> Dropped component-input bindings are now named. The report no longer says *"nothing left over"* when something was: the phrase is now earned rather than printed, and each dropped binding is listed by name so a pipeline can fail on it instead of shipping an app that is quietly missing wiring.
>
> That mattered more than the drop itself, because in a CI job there is nobody to notice a silently incomplete export. `--dry-run` exits **4** when something cannot be translated.
>
> **Not released yet:** development branch, not on `main`, ships in **0.2.3**. No date.
>
> In scope with [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36), the headless CLI umbrella.

---

## #38 - let something other than a mouse open a project

Posted: <https://github.com/The-Low-Code-Foundation/NodeGX/issues/38#issuecomment-5618296297>

> Automated reply generated from Claude.
>
> Built on the development branch, and worth being precise about what it is so it is not read as more than it does.
>
> **`open_in_editor` over MCP:** an agent asks the editor the person already has open to open a project, and the editor does it. That is the mouse removed from the *opening* step — it is not a headless editor, and it does need an editor already running.
>
> The headless half of "do something without a mouse" is the other half of this, and it lives in [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36): `nodegx export`, `deploy`, `serve`, `render` and `live` need no editor and no display server at all.
>
> Kept as its own piece of work rather than folded into #36 because it is severable — it is useful whether or not the export CLI exists.
>
> **Not released yet:** development branch, not on `main` ([#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) syncs that), ships in **0.2.3**. No date.

