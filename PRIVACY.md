# NodeGX Privacy Policy

**Applies to:** NodeGX 0.1.0 (alpha), the desktop application.
**Last updated:** 2026-08-06.

This document was written by reading the source, not by filling in a template.
Every claim below names the thing in the product that makes it true, so that a
future version which changes the behaviour also changes this file.

It has not been reviewed by a lawyer. It is an honest account of what the
software does, which is the thing a legal review would start from.

---

## The short answer

**If you never touch the AI features, nothing about your project leaves your
machine.** Your project files, the graphs you build, the data in your local
backend and the API keys you enter are never uploaded by NodeGX to anyone.

NodeGX does make a few network requests that have nothing to do with your
project content: it checks for updates, it fetches a changelog, and it downloads
library modules and project templates when you ask for them. Those requests
carry no project data — only what any HTTP request carries, including your IP
address. They are listed in full below.

We do not operate an analytics server. There is no account. We do not have a
copy of your work.

---

## 1. AI providers

### Which providers, and where the requests go

NodeGX has no AI service of its own. It talks directly to whichever provider
**you** configure in *Editor Settings → AI*, using **your** API key. There is no
NodeGX proxy in the middle; we never see the request or the response.

| Provider | Where requests go |
|---|---|
| Anthropic (Claude) | `https://api.anthropic.com` |
| OpenAI | `https://api.openai.com/v1` |
| OpenAI-compatible endpoint | the URL you enter — a gateway, a proxy, or a server on your own network |
| Ollama | `http://localhost:11434` by default — **on your own machine; nothing leaves it** |

AI is **disabled by default**. Until you pick a provider, no AI request is
possible.

### When something is actually sent

This is the part that matters, so it is specific.

**Opening a panel sends nothing.** Opening *Editor Settings → AI* performs no
network request at all; its only effect is to move older local settings into the
current format. The AI panels in the editor do not contact a provider on open.

A request is made only when you take one of these actions:

- **Pressing "Verify" in AI settings.** Sends the smallest possible request to
  confirm the key works — for Anthropic, a single-token message containing the
  word "Hi". No project content.
- **Running the authoring loop** (asking NodeGX to build or change a component).
- **Asking for an explanation** of a node or component.
- **Running a project review.**
- **Using an AI node on the canvas**, or the AI-assisted function and chart
  helpers.
- **Running the migration assistant.**

Nothing on that list happens on a timer, on startup, or in the background.

### What is sent

The amount of project content depends on which feature you used, and the limits
are enforced in code rather than by asking the model nicely.

- **Authoring** never sends your whole project. The context builder cannot hand
  out more than one component at a time by construction, and every handout is
  charged against a hard budget (currently 120,000 characters and at most six
  full component reads per session).
- **Explain** sends a bounded neighbourhood around what you selected.
- **Project review** sends the most, because it is a whole-project feature: a
  one-line summary of every component, a map of your pages, your style
  vocabulary, and full reads of the highest-signal components within the same
  budget.
- **Backend information**, when a review includes it, is your **schema** — the
  names of your collections and their fields — together with the type and URL of
  each configured backend service. **The rows in your database are not sent.**

Note that a backend service URL can itself identify your project or
organisation. If that matters to you, do not run a project review against a
provider you would not tell that URL to.

### What the provider does with it

That is between you and them, under their terms — not ours. Anthropic and OpenAI
both publish policies on whether API content is used for training; read the one
for the provider you chose. If you would rather nothing left your machine at
all, use Ollama, which runs locally.

---

## 2. Your API keys

Keys are stored on your machine and are **sent only to the provider they belong
to**, as the credential on that provider's own API request. They are never sent
to us, never written into a project directory, and never included in any log.

- **Where:** `ai-credentials.json`, in NodeGX's application-data directory (see
  §7). Deliberately not inside any project folder — a key that lands in a project
  gets committed and published.
- **How:** encrypted with your operating system's keychain (Keychain on macOS,
  Credential Manager on Windows) via Electron's `safeStorage`.
- **When the OS keychain is unavailable** — which happens on some Linux desktops
  without a keyring — the key is stored with the settings file's own encryption
  key instead. That is obfuscation, not security. The app can tell you which of
  the two applies on your machine rather than implying a guarantee it cannot
  make.
- Error messages and logs show keys redacted (`sk-a••••1234`), never in full.

Removing a key from AI settings deletes it from storage.

---

## 3. The local backend

NodeGX can run a backend for the app you are building. **It runs on your
machine, as a child process of the editor.** It is not a hosted service, we have
no access to it, and nothing in it is transmitted anywhere.

- **It binds to `127.0.0.1`** — loopback only — so it is not reachable from your
  network. If you deliberately bind it to a wider interface, it *requires* a
  bearer token before it will start.
- **Where it writes:** `~/.noodl/backends/<backend-id>/` for a backend the editor
  starts, or `~/.nodegx/backend/default/` for one you start from the command
  line.
- **What it writes there:**
  - `data/local.db` — a SQLite database holding every record your app creates:
    user accounts, uploaded file metadata, and your application data.
  - uploaded files, in a `files/` directory.
  - `secrets.json` — the backend's own admin token, and any credentials you
    configure (for example SMTP details for sending email).
  - `security.json`, `search.json`, `ops.json`, `config.json`, `triggers.json` —
    access rules, search settings, operational counters and configuration.
  - `executions.sqlite` and `workflows/` — the history of workflow and cloud
    function runs, including the step data those runs carried.
  - backups, if you configure them.

If your app collects personal data from *its* users, that data lives in the
SQLite file above, on your disk, and you are its controller. NodeGX neither sees
it nor sends it anywhere. When you deploy your app somewhere, the same
responsibility follows the data to wherever you deployed it.

`~/.noodl/execution-history.db` holds run history shared across projects.

---

## 4. Telemetry

There is **one** telemetry facility in NodeGX, it covers AI authoring only, it
is **off until you turn it on** in *Editor Settings → AI*, and **there is no
server to send it to**. Nothing is uploaded. Records are appended to a file you
can read and delete.

- **Where:** `telemetry/authoring-telemetry.jsonl` in the application-data
  directory (§7).
- **A single record, in full**, is one JSON line containing: a format version, a
  timestamp, an anonymous install identifier (a random UUID minted the first time
  a record is written — an install that never opts in never gets one), the app
  version, and one of three events:
  - `authoring-round` — the mode, whether it was an initial attempt or a
    refinement, the outcome, how many turns and submissions the session had, the
    cost in US dollars, and the duration in milliseconds;
  - `authoring-accept` — the mode, whether the result was accepted partially, and
    the number of nodes and connections accepted;
  - `authoring-reject` — the mode.
- **What a record never contains:** your prompt, your description, component or
  node names, file paths, your project content, your API key, your name, your
  email, or your IP address.

The vocabulary above is the complete vocabulary — it is a closed set of enums and
numbers, not free text.

Turning the setting off stops all writing. Deleting the file deletes the history.

There is no other analytics in the product. The editor contains a dormant
analytics interface left over from upstream Noodl; it is wired to a no-op
implementation that discards everything, and no code path ever replaces it.

---

## 5. Crash reporting and logs

**Nothing about a crash is transmitted.** NodeGX has no crash-reporting service.
There is no endpoint to send a crash to, and none is planned for the alpha. If
it breaks, we find out because you tell us.

Crashes and errors are recorded **on your machine only**, in the
application-data directory (§7), and you can open both places from the **Help**
menu.

### The diagnostic log — `debug/`

**Help → Open log folder.**

- `log-<date>.txt` — one file per NodeGX session, in released builds. It records
  **errors and warnings only**, each with a timestamp. It does not record
  everything the editor prints.

  File paths, web addresses, anything shaped like an API key or a token, and
  email addresses are **redacted as the line is written**, using the same
  redaction rules as "Report a problem" below. Your home directory becomes `~`
  and paths inside it are dropped rather than shortened. The intent is that this
  file is safe to attach to a public bug report — read it before you send it
  anyway, because you are the one sharing it.

  Each entry is capped, and the file stops at 2 MB with a line saying so.

- `main-errors.txt` — NodeGX itself failing, rather than something inside the
  editor. Redacted harder than the session log: every file path and every web
  address is removed outright, leaving the error, the function names and the
  line numbers.

- `git-*-merge-*.json` — written only when a Git merge of a project fails. These
  are copies of the conflicting versions of your project, so they **do contain
  your project content and are not redacted**. Do not attach one to a public
  issue without reading it.

A `README.txt` in that directory repeats the two paragraphs above, so the
distinction is visible to anyone who opens the folder.

**How long it is kept.** NodeGX deletes files in `debug/` that are older than
**14 days**, and keeps the directory under **40 files and 20 MB** by deleting the
oldest first. The sweep runs once each time the app starts. Deleting the whole
directory yourself is safe; it is recreated on the next launch.

### Native crash dumps — `crashDumps/`

**Help → Open crash report folder**, where the platform provides one.

When NodeGX itself crashes rather than merely erroring, the operating system
writes a minidump — a snapshot of the program's memory at the moment it died.
NodeGX enables this capture with uploading explicitly **switched off**, so the
dumps are written to your disk and go nowhere. They are kept for **30 days**.

A minidump is a memory image, so it can contain fragments of whatever the app
was holding, including parts of your project. Treat one as private. If you want
us to see it, attach it to a report yourself.

### Development builds

A build run from source does not write `log-<date>.txt`. It still writes
`git-*-merge-*.json` if a project merge fails, and it still writes crash dumps.

### "Report a problem"

**Help → Report a problem…** does not transmit anything either. It writes a
report folder under `reports/` in the same application-data directory (§7),
containing a screenshot of the editor window, the description you typed, and a
block of diagnostics — version, operating system, and *counts* of the things in
your project. It never includes your project's content, node settings,
component or page names, file contents, API keys, or the address of any backend
you have configured.

It then opens GitHub's new-issue form **in your web browser** with all of that
already filled in. Nothing is filed until you read it and press Submit, under
your own GitHub account. If you close the browser instead, nothing has left your
machine and the folder is still there for you to delete.

---

## 6. Other network connections

These are every remaining request NodeGX makes, and none of them carries project
content.

| What | When | Where | What it reveals |
|---|---|---|---|
| **Update check** | At launch, and repeatedly while running. macOS and Windows only — the Linux build never checks. | The project's GitHub releases | Your IP, app version, platform |
| **Changelog** | When you open a project | The project's documentation site, on GitHub Pages | Your IP |
| **Library modules, prefabs and project templates** | When you browse the library or templates, and when you install one | Same documentation site | Your IP, and which module you chose |
| **GitHub** | Only if you connect a GitHub account, and then only when you use version control | `api.github.com` | See §8 |
| **Your own services** | When your app or backend uses them | Wherever you pointed them | Whatever you configured |

**None of these sends anything you typed.** Until this release the Help Center
had a "Quick search docs" box that sent every keystroke to Algolia, a hosted
search service, to query an index of Noodl 2.9's documentation — a different
product. That search box has been removed along with the Algolia client, so
there is no longer any request from NodeGX carrying text you entered.

The node help shown inside the editor — the property panel, the node picker's
preview pane and the connection popup — is read from a catalog that ships inside
the application. It makes **no network request at all** and works offline.

The update check can be disabled by starting NodeGX with the environment
variable `autoUpdate=no`.

Opening the documentation, the guides, the release notes, an issue form or
**Report a problem** (§5) — whether from the Help menu or from the Help Center
inside the editor — opens them in **your web browser**, at which point that
site's own privacy policy applies. NodeGX itself makes no request in any of
those cases. Searching the documentation now happens on the website, in your
browser, rather than in the application.

---

## 7. Where NodeGX keeps things on your machine

The application-data directory referred to above is:

- **macOS:** `~/Library/Application Support/NodeGX/`
- **Windows:** `%APPDATA%\NodeGX\`
- **Linux:** `~/.config/NodeGX/`

It holds `editorSettings.json` (your editor preferences, in plain text — never
credentials), the credential files described in §2 and §8, the telemetry file
(§4), the debug logs, the crash dumps and any "Report a problem" folders (§5),
together with the standard caches any Electron application keeps.

Your **projects** live wherever you chose to put them, and NodeGX does not copy
them anywhere else.

Deleting this directory resets NodeGX to a first-run state. It does not delete
your projects and it does not delete your local backend data (§3).

---

## 8. GitHub

Connecting GitHub is optional; version control works without it, against local
repositories or any remote you configure by hand.

If you do connect it, NodeGX uses GitHub's web OAuth flow. Authorisation happens
on github.com in your own browser — NodeGX never sees your GitHub password.

- **Scopes requested:** `repo`, `read:org`, `read:user`, `user:email`.
  **`repo` is broad**: it grants full control of your repositories, including
  private ones. GitHub does not offer a narrower scope that still allows the
  push, pull and issue operations the editor performs. The authorisation screen
  lets you choose which organisations to grant.
- **The callback is `noodl://github-callback`.** The scheme is `noodl`, not
  `nodegx`, and it stays that way because it is bound to a redirect URI
  registered with GitHub before the project was renamed; changing it would break
  the flow for everyone.
- **What is stored, and where:** your access token, your GitHub username, your
  email address as GitHub reports it, and the list of installations you granted —
  in `github-credentials.json` in the application-data directory (§7).
- **How it is stored:** with the store's own built-in encryption key. Note that
  this key is embedded in the application, so this is obfuscation rather than
  real protection — treat the file as you would treat a token in plain text.
  This is weaker than the OS-keychain protection used for AI keys (§2), and it
  is a known gap we intend to close.
- Disconnecting GitHub in the editor deletes the stored token. It does not
  revoke it — do that at
  <https://github.com/settings/applications> if you want it gone entirely.

---

## 9. Children

NodeGX is a developer tool and is not directed at children. We do not knowingly
collect anything from anyone, of any age, because we do not operate a service
that collects.

## 10. Your rights over your data

There is no server-side copy of your work to request, correct or delete, because
there is no server. Everything this policy describes is a file on your own
machine, and every one of those files is named above so you can read or delete it
yourself.

Where your project's *own* users are concerned, you are the data controller and
NodeGX is simply the tool you built with.

## 11. Changes to this policy

This file is versioned in the repository alongside the code it describes. Its
history is the change log. Substantive changes will be called out in the release
notes for the version that carries them.

## 12. Contact

<!-- TODO(ALPHA-005): Richard to supply the publishing entity and a contact
     address before the first public build. Everything above is verified
     against the code; this section is the only part awaiting a decision. -->

Questions about this policy, or a correction to it, should go to the project's
issue tracker on GitHub.

---

## Appendix: reading this against the code

If you want to check any claim above rather than take it on trust, the relevant
source is:

| Claim | Source |
|---|---|
| Provider list and endpoints | `packages/noodl-editor/src/editor/src/models/AiAssistant/client/` |
| Key storage and encryption | `.../src/store/AiCredentials.ts` |
| Authoring never sends the whole project | `.../models/AiAssistant/authoring/ContextBuilder.ts` |
| What a project review sends | `.../models/AiAssistant/review/assembleProject.ts` |
| Telemetry record shape and opt-in | `.../models/AiAssistant/telemetry.ts` |
| The local debug log | `.../src/utils/bugtracker.ts` |
| The analytics no-op | `.../src/utils/tracker/` |
| Update check | `packages/noodl-editor/src/main/src/autoupdater.js` |
| The Help menu links out, and searches nothing | `.../src/views/HelpCenter/HelpCenter.tsx` |
| Node help comes from a bundled catalog, not the network | `.../src/editor/src/utils/nodeDocs.ts` |
| GitHub OAuth scope and callback | `packages/noodl-editor/src/main/github-oauth-handler.js` |
| Backend data directory and binding | `packages/nodegx-backend/src/config.ts` |
