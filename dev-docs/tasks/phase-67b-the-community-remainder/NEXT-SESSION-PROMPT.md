# Phase 67b — next session

**Written 2026-08-19 (session 41), replacing session 40's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **A phase-72 session (NAT-006, the community API) was live in `nodegx-community` at 21:00 and
had NOT committed.** Its work in the tree: `src/app/api/v1/community/{people,rfps,coaching,
tutorials,replays,university}/`, `src/lib/{apiread,apishape,apisurfaces,ratelimit}.ts`,
`tests/nat006-api-contract.test.ts`, and edits to `src/lib/{apiviewer,articles,lists}.ts` and
`tests/uni011-mirror-api.test.ts`. **Check whether it landed before touching any of those.**
⚠️ **Check for a live peer yourself — that is a per-session fact, not this file's to assert.**

---

## 1. ✅ E7 IS DONE, AND THE LINE IT WAS WAITING ON WAS A LIVE BUG

`nodegx-community@e7bae87`. Session 40 left the two libraries with nothing calling them; this
session built the three surfaces, the intake check and the `deploy.sh` line.

| | |
|---|---|
| `POST /api/v1/bench/captures` | raw PNG in, `{key, grant}` out |
| intake | `acceptCaptureImages` in **both** bench POST routes; the grant is **stripped** before storage |
| `GET /api/v1/bench/attachments/:id/image` | serves through the app, never a public object URL |
| `Attachment.tsx` | draws the image; a capture without one still says *"image not yet hosted"* |
| `ops/deploy.sh` | the env line **plus** a `==> capture hosting (E7)` readout |
| gates | **18** route specs + **5** render specs, all green, incl. the **real-bucket round trip** |

🔴 **The `deploy.sh` line was a shipped bug that every readout vouched for.** `install-backup.sh`
wrote `HETZNER_S3_*` into `backup.env`; the daily `pg_dump` read them, worked, and printed a
healthy off-site backup on **every deploy** — while the **app** reads a different file, so
`objectStoreConfig()` returned `null` on the live site. A working backup vouching for a broken
feature. ✅ The test asserts the env file **on the fake host**, not the secrets file the harness
wrote: the inputs were never the problem, so an input-side assertion would have passed for the
whole time the bug was live.

## 1b. 🔴 THE BOX IS STILL BEHIND `main`, AND THE NEXT DEPLOY IS STILL NOT A NO-OP

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7's libraries, and now E7's
surfaces — is undeployed. **Session 40's warning stands unchanged and is not repeated here in
full**: read §1b of the git history's previous version of this file, or `ops/deploy.sh:324`.

The short of it: the next deploy **installs phase 72's mail timer**, and the first drain will
**refuse** because the outbox backlog is older than `MAIL_DRAIN_MAX_AGE_DAYS` (7). 🔴 **That
refusal is the guard working — do not route around it.** Releasing weeks-old mail is Richard's
decision, not a flag you add to get a clean log.

✅ **New, and it changes what a deploy is worth:** E7 now needs one. `POST .../captures` answers
**503 on the live site** until the env line ships, and every capture still renders *"image not yet
hosted"*. That is correct degrading behaviour, not breakage — but it means E7 is **built and
undeployed**, which is the distinction this phase keeps insisting on.

✅ **Deploy from a pristine clone of a named commit** — `git clone` to `/tmp`, `git checkout main`
(the **branch**, not the bare sha, or the stamp records `branch: HEAD`), run `ops/deploy.sh` there.

## 2. 🔴 Three things that cost this session time

1. 🔴 **A CREDENTIAL WITH NO ISSUER AND NO VERIFIER READS AS A WORKING ONE.** `grantFor` and
   `verifyGrant` were written, thoroughly tested and green in session 40 — and nothing minted a
   grant, nothing checked one. Every assertion was the two functions agreeing with each other.
   **This is *build the caller* for the fifteenth time in this phase**, and the instrument that hid
   it was a suite calling the functions directly. ✅ **The attack is now played through the route**:
   account B puts account A's key and A's grant into its own post. Verified red-then-green.
2. ⚠️ **A CHECK MUST AGREE WITH THE FUNCTION IT CHECKS.** The first `deploy.sh` readout counted
   **five** `HETZNER_S3_*` keys. `objectStoreConfig()` requires **four** — the region is derived
   from the endpoint host when unset — so a correctly configured deployment would have been
   reported broken.
3. ⚠️ **`update bench_threads set hidden_at = now()` IS REFUSED BY THE SCHEMA.**
   `bench_thread_hidden_has_reason` requires hiding and its reason together. ✅ Which forced the
   better test: the hidden-thread case now goes through **D8's real moderation path**
   (`reportContent` → `upholdReport`), so it proves the mechanism and not just the join.

✅ **AND THE TRICK WORTH REUSING.** A peer held the shared Postgres for most of the session.
`DATABASE_URL` overrides `src/db/index.ts`'s default, so this session created
**`nodegx_community_e7`** on the same 55432 container and ran every DB spec there —
`freshDb()`'s `drop schema public cascade` then touches only that database. **Neither session
waited.** The database still exists; drop it or reuse it.

```
DATABASE_URL='postgres://nodegx:nodegx@localhost:55432/nodegx_community_e7' npx vitest run <file>
```

## 3. Gate readings — 2026-08-19, `nodegx-community@e7bae87`

| Gate | Reading |
|---|---|
| `npx tsc --noEmit` | ✅ **0**, measured without a pipe |
| `tests/e7-capture-routes.test.ts` | ✅ **18/18**, incl. real bucket `nodegx`@`nbg1` (did **not** skip — checked) |
| `tests/e7-capture-render.test.tsx` | ✅ **5/5** |
| `tests/ops-deploy-provenance.test.ts` | ✅ **16/16**; E7's three verified **red** with the heredoc lines removed |
| `uni011` + `uni015` + `uni016` + `d15` | ✅ **135/135** (+ uni011 alone **21/21**, with the peer's routes on disk) |
| `npm run lint` | 🔴 **NOT A GATE** — no eslint configured; `next lint` drops into an interactive prompt |

⚠️ **`npm test` (the whole suite) was NOT run** — the peer held the shared DB, and the isolated
database was only migrated for the files above. Not a claim about the rest of the suite.

## 4. What to do next

### An agent alone — nothing needs Richard

1. **UNI-006 + UNI-007's intake as ONE tranche.** ⚠️ **NAT-006 was being built this evening** —
   check whether it landed. Its `src/lib/apisurfaces.ts` and `docs/API.md` are very likely the
   thing to build on, and NAT-011's editor-side client is the other half. 🔴 **Do not write a
   second community client in the editor** — that is the defect UNI-011 already paid for.
2. **UNI-008** (L+, carries a standing legal and ops burden — read D9 before starting).
3. **UNI-010's remainder**; **UNI-012** (needs a **packaged build** to verify anything).
4. ⚠️ **A deploy, whenever one is wanted** — see §1b. E7 is inert on the live site until then.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
