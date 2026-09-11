# Next-session prompt — phase 21, Library & Import

Written 2026-09-11 at `902b224e5`, superseding the 2026-08-02 prompt (`368f4af3f`), which
described sprints A and B and predates sprint C entirely.

**Read [`PROGRESS.md`](./PROGRESS.md) first — it is authoritative.** This file is the ordered plan;
that one is the record.

---

## 🔴 FIRST JOB: LIB-007 is three steps from done and none of them is code

The machinery is built, reviewed and pushed. **Nothing is published.** The six parts 0.2.3 named
are still unreachable and the caveat in the release notes is still true, which is why it is still
there.

Read [`LIB-007-NOTES.md`](./LIB-007-NOTES.md) — it carries the measurements, the two things the
spec gets wrong, and why the credential is a deploy key rather than the PAT §4.2 named.

| # | Step | Who | Why it cannot be a session |
|---|---|---|---|
| 1 | Merge PR [#44](https://github.com/The-Low-Code-Foundation/NodeGX/pull/44) (`cline-dev` → `main`) | Richard | `main` is protected with `enforce_admins`. **And** GitHub registers `workflow_dispatch` only from the default branch, so the workflow cannot be dispatched at all until it lands — measured, `HTTP 404`, not a guess |
| 2 | Create `NODEGX_CONTENT_DEPLOY_KEY` | Richard | The auto-mode classifier denies `gh repo deploy-key add` **and** the equivalent `gh api -X POST .../keys`. Three commands, written out in [RELEASE-PROCESS.md §1e](../../guidelines/RELEASE-PROCESS.md) |
| 3 | Run **Publish library** (Actions → Run workflow, give a reason) | anyone | — |

**Step 3 closes AC1, AC3 and AC4-in-anger, and opens the AC2 baseline PR by itself.**

### Then, and only then — AC5, which IS a session's job

1. Delete the sentence *"searching the library for them today finds nothing"* (and the ⚠️ bullet
   around it) from the [v0.2.3 release notes](https://github.com/The-Low-Code-Foundation/NodeGX/releases/tag/v0.2.3).
   🔴 Those notes have **no source file in this repo** — they were written directly on GitHub, so
   the edit is `gh release edit`, not a commit. Do not go looking for the file; it does not exist.
2. Add the dated [PROGRESS.md](./PROGRESS.md) §Log entry naming the content-repo commit, following
   the 2026-09-05 entry's shape (counts before/after, which gates were run, a version table).
3. Merge the baseline PR the workflow opened, after writing the `$comment` — the script stamps
   `measuredOn` but **the WHY is yours**. If `unpublished` is now empty, say so there: that file has
   carried a backlog since 2026-08-22 and its emptiness is the whole point of the task.

### Verify it the way the task demands, not by reading the gate's summary

```bash
npm run library:verify-origin -- --require-published   # must exit 0, empty
curl -s https://the-low-code-foundation.github.io/nodegx-content/static/library/prefabs/index.json \
  | python3 -c "import json,sys; print([e['label'] for e in json.load(sys.stdin)])"
```

Advanced Columns, Format Date, Format Full Name, Sanitise Email in prefabs; Charts and Media
Recorder in modules.

---

## 🔴 One thing to carry, whoever touches the content repo next

`nodegx-content`'s `.github/workflows/pages.yaml` is **active**, triggers on every push to `main`,
and has **failed at `npm run build` on every run since 2025-12-06**. That failure is the only thing
keeping the site on its legacy Pages build — and therefore the only thing keeping the `/static`
suffix in `getContentEndpoint.ts` resolving. Fix that Docusaurus build and every in-editor library
URL 404s on the next publish. A deliberate flip is ALPHA-006 B5's, and it moves the suffix in the
same change.

---

## After LIB-007

**LIB-008** — [`LIB-008-THE-DOCS-ORIGIN-IS-A-404.md`](./LIB-008-THE-DOCS-ORIGIN-IS-A-404.md), still
**UNASSIGNED**. Same shape as LIB-007 — *an origin moved and only some callers were told* — but a
different origin: `getDocsEndpoint`, not `getContentEndpoint`. 🔴 Measuring the wrong one will tell
you the library is down when it is fine. LIB-007 touched `getContentEndpoint` only and changed
nothing LIB-008 depends on.

**Sprints A and B** are unchanged by this session. Their remaining residual is live-editor
verification and content work, described in PROGRESS.md.

---

## Adjacent hazard found in passing, owned by nobody here

`library/prefabs/form-fields/project/project.json` had an **uncommitted** edit in the shared
checkout on 2026-09-11 (phase 78's). It builds to a `form-fields-1.0.0.zip` whose bytes differ from
the published one **under an unchanged version**, which `library/README.md` forbids. CI publishes
from the committed ref so the workflow will not ship it — but whoever commits that edit owes the
version bump.
