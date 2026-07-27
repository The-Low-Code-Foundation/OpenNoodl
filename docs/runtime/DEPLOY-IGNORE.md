# What ends up in a deploy, and how to change it

When you deploy, NodeGX copies your **project folder** into the output
directory before it writes the built app on top. That copy is what puts your
images, fonts, `.htaccess`, `robots.txt` and anything else you keep beside your
project into the deployed site.

It also means that, unless something stops it, everything else in that folder
ships too — scratch notes, a client's PDF, a credentials file. This page is what
stops it, and how to adjust it.

## The short version

- A set of **default rules** is always applied. Your `docs/` folder, `.git/`,
  `node_modules/`, `.env` and a handful of others are never deployed.
- If you want more excluded, add a **`.noodlignore`** file to your project root.
  It uses **gitignore syntax**, exactly.
- Your file **extends** the defaults; it does not replace them. To un-ignore
  something the defaults exclude, write a `!` line.
- Before you pick a folder, the Deploy panel tells you how many files will be
  excluded and by which rule. After the deploy, the console lists every one.

## The defaults

Applied to every deploy, whether or not you have a `.noodlignore`.

| Rule | Why |
|---|---|
| `.noodlignore` | the ignore file itself |
| `.git/`, `.gitignore`, `.gitattributes`, `.gitmodules`, `.github/`, `.svn/`, `.hg/` | version control metadata |
| `.DS_Store`, `Thumbs.db`, `desktop.ini` | operating system metadata |
| `.vscode/`, `.idea/` | code editor settings |
| `.noodl/`, `.nodegx/` | the editor's own project state (build scripts, caches) |
| `node_modules/` | installed dependencies |
| `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.yaml` | container build files |
| `.env`, `.env.*`, `.npmrc` | environment / credential files |
| `project.json` | project source |
| `docs/` | your project documentation, not for publication |

For a **v2 project** (one with `nodegx.project.json` and a `components/`
folder), the project source is excluded too: `nodegx.project.json`,
`nodegx.routes.json`, `nodegx.styles.json` and `components/`. A legacy project's
`components/` folder is left alone — there it is just a folder you named.

Everything not on this list is deployed. `notes.txt` in your project root will
be on the internet after your next deploy unless you say otherwise.

### Why `docs/` is a default

The `docs/` folder is where NodeGX keeps your project's scoping notes, rejected
approaches, backend contracts and AI conventions. It is a normal visible folder
on purpose — so you read it, edit it in whatever editor you like, and commit it
to git. It is not written for your users, so it does not deploy.

## Writing a `.noodlignore`

Put it in your project root, next to `project.json`. It is read fresh on every
deploy — no restart, no setting.

```gitignore
# Anything ending in .psd, anywhere in the project
*.psd

# One specific file
notes.txt

# A whole folder
client-handover/

# …but keep one file from inside it
!client-handover/logo.png
```

The syntax is git's — see `man gitignore` or
<https://git-scm.com/docs/gitignore>. Everything git supports works here:
`*`, `?`, `**`, `[0-9]` character classes, `/` to anchor to the project root, a
trailing `/` to mean "directory only", `#` for comments, `!` to negate.

There is one gitignore rule people trip over often enough to repeat: **a
negation cannot rescue a file from inside an excluded directory.** This does
nothing —

```gitignore
!docs/architecture.md
```

— because `docs/` itself is excluded, so nothing under it is ever considered.
Re-include the directory first:

```gitignore
!docs/
```

### Overriding a default

The defaults are loaded first and your file second, and gitignore's last-match
-wins rule does the rest. So a short `.noodlignore` adds to the defaults rather
than wiping them, and un-ignoring a default is deliberate:

```gitignore
# Yes, I really do want to publish the project source
!nodegx.project.json
!components/
```

## Seeing what was excluded

**Before the deploy.** The *Deploy → Self Hosting* panel shows a line like

> 41 project files will be deployed. 6 will not: `docs/` (1), `node_modules/`
> (1), `.env` (1), `.gitignore` (1)… — No `.noodlignore` in this project —
> default rules only.

with a **Show excluded files** toggle listing each path and the rule that
excluded it.

**After the deploy.** The success toast carries the count, and the developer
console has the full list grouped by rule:

```
[deploy] /Users/me/site: 41 project file(s) copied. 6 project files excluded — docs/ (1), node_modules/ (1), .env (1)
[deploy]   1× excluded by default rule `docs/` — project documentation, not for publication
[deploy]       docs/
```

If an asset is missing from your deployed site, that list is the first place to
look: it distinguishes "my asset was dropped" from "my asset was ignored".

### If you deployed before these rules existed

Excluding a folder from *this* deploy does not delete the copy an *earlier*
deploy already wrote into the output. If you have deployed a project with a
`docs/` folder before, that folder is still sitting in the output directory —
and, if you have published it, still on the internet.

The deploy will not delete it for you: it cannot tell its own leftovers from
files you put there deliberately, and getting that wrong is unrecoverable. What
it does instead is fail loudly —

> Deploy successful, but 1 excluded path already existed in the output folder
> from an earlier deploy and were left in place. Delete them by hand — see the
> console.

— and print the absolute path of every one. Delete them yourself, and re-upload.

## What this does not do

- It does not filter the **built app bundle** — only the verbatim copy of your
  project folder. Assets referenced by your nodes are exported through a
  different path.
- It is not a secret scanner. Excluding `.env` by name is not the same as
  proving no credential is committed anywhere; the self-hosted deploy has a
  separate credential scan that fails the build. See
  [Self-hosting](./SELF-HOSTING.md).

## See also

- [Self-hosting](./SELF-HOSTING.md) — the packaged Compose deploy
- [Rendering modes](./RENDERING-MODES.md) — CSR, SSR and SSG deploy layouts
