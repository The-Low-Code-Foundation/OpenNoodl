# REL-001 — the submission, ready to run

_Written 2026-09-01, session 9, as row 7 preparation. **Richard executes this** — it is a
database-credential act and the credential is his._

## The command

```bash
cd /Users/richardosborne/vscode_projects/nodegx-community
DATABASE_URL=<the community DB url> \
  npx tsx scripts/publish-project-template.ts \
    members-area \
    /Users/richardosborne/vscode_projects/OpenNoodl/templates/members-area \
    starter \
    "members only site for a club, charity or church" \
    --title "Members' area" \
    --publish
```

Interface re-derived from
[`scripts/publish-project-template.ts`](/Users/richardosborne/vscode_projects/nodegx-community/scripts/publish-project-template.ts)
on 2026-09-01, not relayed:
`<slug> <projectDir> <category> "<summary>" [--publish] [--unpublish] [--title "…"]`.

- ⚠️ **`--publish` is opt-in and that is the point.** Without it the row is written as a **draft**,
  which is the right first run — publish once the draft row looks correct.
- 🔴 **A republish leaves visibility where it was.** Re-running without `--publish` against an
  already-published row does **not** unpublish it; `--unpublish` is the way to take one off.
- The script validates `category` against `TEMPLATE_CATEGORIES` before touching the database, so a
  typo fails loudly rather than writing a bad row.

## The metadata, all four fields ruled

| field | value | ruled |
|---|---|---|
| slug | `members-area` | — |
| category | **`starter`** | Richard, 2026-09-01 — 🔴 **not `data-app`** |
| title | **Members' area** | Richard, 2026-09-01 |
| summary | **members only site for a club, charity or church** | Richard, 2026-09-01 |
| delivery | **curated** | TPL-001 §1 |

✅ **TPL-001's prose was amended to match** this session — its header, AC8 and §7 all said
`data-app` and now say `starter`, with the superseded argument kept rather than deleted.

🔴 **No code literal had to move.** The previous handoff said this change "moves the literal in
`template-search.test.ts` and `template-install-over-http.test.ts`". **It does not.** Both files'
`data-app` literals belong to unrelated fixtures — `Starter CRM`, `Storefront`, `Membership Hub`,
and an intake answer in `uni-007`. The members' area has **no category literal anywhere in this
repo**; the category is an argument typed at publish time. Changing those fixtures would have
altered what those tests measure and published nothing.

## 🔴 AC8's excluded-files check, actually performed

TPL-001 AC8 asks for "an excluded-files list that is **read and checked** — this project has a
backend and auth, so the check is not a formality." Performed 2026-09-01 against the artefact at
HEAD (`27f127e9`, 91 files), and **re-performed 2026-09-01 session 10** after REL-002c items 1–4
changed the artefact (`8af2aeec`, **94 files** — `Members/Footer`'s three, nothing else):

**What is in the bundle.** Four things only: `components/`, `docs/START-HERE.md`,
`nodegx.project.json`, `nodegx.security.json`. ✅ **Still four after session 10** — the three added
files are `components/Members/Footer/{component,nodes,connections}.json`. No `.env`, no `*.key`, no `*.pem`, no file with
`secret`, `credential` or `token` in its name.

**Content scan.** Every `secret`-shaped hit is structural and correct: a `noodl.cloud.secret`
**node type** in `claimAssociation` (which *reads* a backend secret at run time and embeds
nothing), a constant-time token compare, and prose in `START-HERE.md` explaining that the setup
token is a backend secret. **No credential is carried.**

**So the excluded-files list is empty — and that is a fact about today, not a property of the
bundler.**

### 🔴 The hazard the list exists for, and it is real

[`readBundleDirectory`](/Users/richardosborne/vscode_projects/nodegx-community/scripts/readbundledirectory.ts)
was read in full (72 lines). It walks the tree **fully recursively with no skip list of any
kind** — no dotfile rule, no `.git` rule, no ignore file. Every file under the directory is read
and shipped, sorted only into `files` (UTF-8-clean) and `binaryFiles` (base64).

That is what makes `docs/START-HERE.md` travel, which is what we wanted. It is also what makes
this true:

🔴 **DO NOT OPEN `templates/members-area` IN THE EDITOR BEFORE PUBLISHING.** Since FIX-008 B,
opening a v2 project writes three files into it — `.mcp.json`, `CLAUDE.md`, and a three-line block
appended to `.gitignore`. `.mcp.json` carries **absolute paths from the machine that opened it**.
With no skip list, all three would be published to the shelf and installed into every person's
project.

✅ **Verified clean right now** — none of the three is present. The safe order is: publish from the
generated directory as it stands. If it has been opened since, delete all three before publishing,
and re-run `npm run template:members` to confirm the artefact is byte-identical (AC7).

⚠️ Opening it would also break AC7 independently: committed JSON must be byte-identical to a fresh
generate, and three new files are not.

## What this closes

- **REL-001 AC2** — a clean launcher picking "Members' area" through to a working landing page.
- **TPL-001 AC1**, which has never been gradeable because curated delivery means there is no picker
  row to pick until this runs.
- **P75's FB-005**, per the phase 82 run sheet.

🔴 **It does not need the 0.2.2 cut.** Richard's ruling G5a settled that the publish and the tag are
two moments; the shelf is a database row and the tag is a GitHub release.
