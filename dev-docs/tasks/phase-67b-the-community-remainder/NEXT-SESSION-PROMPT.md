# Phase 67b — next session

**Written 2026-08-19 (session 40), replacing session 39's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **A phase-72 session ran in parallel all afternoon and is IN `nodegx-community` now**, not just
in the editor checkout — NAT-014, the outbox drainer. It owns `ops/deploy.sh`, `ops/install-mail.sh`,
`ops/provision.sh`, `scripts/drain-outbox.ts`, `package.json` and `tests/nat014-*`. **Announce
before touching any of those.**

---

## 1. 🔴 THE ONE THING RICHARD WAS OWED IS DONE — the live site is current

`0015` is **deployed**. He said yes this session; it went out and was verified by its readings, not
its exit code. **Nothing in this phase is blocked on Richard any more.**

| | |
|---|---|
| migration | `already applied: 14` → `applied: 0015_uni017_queue_and_signal.sql` |
| stamp | ✅ `0cbd716fb011` on `main`, clean, read back **off the host** |
| neighbours | all three `200 → 200`, unmoved |
| backups | ✅ ok, 433,391 bytes, 49 tables off-site · restore check ✅ **49 tables restored from the object** |
| consequence | `POST …/same-here` → **401** live, while a nonexistent sibling → **404** |

## 2. What was built

| | |
|---|---|
| **A deploy can be named** | `ops/deploy.sh` refuses a dirty tree (`--allow-dirty` / `NODEGX_ALLOW_DIRTY=1`), stamps `/etc/nodegx-community/deployed.json`, prints what is live **before** replacing it and reads the new stamp **back off the host**. `tests/ops-deploy-provenance.test.ts` + `tests/helpers/deploy-stubs/` **run the script end to end** — `ops/` was outside every gate before this |
| **E7 — half** | `src/lib/objectstore.ts` (SigV4 by hand, **driven against the real bucket**) and `src/lib/captureupload.ts` (what may be stored, and whose it is). See README *"Also landing here"* |

## 3. 🔴 Four things that cost this session time, in the order they will cost the next one

1. **A stub more forgiving than the real binary hides the bug it was built to catch.** The deploy
   harness passed **13/13** and the first real deploy **died before pushing a byte**: the `ssh` stub
   answered `cat <missing file>` with *"print nothing, exit 0"*, which is not what `cat` does, so
   `cat x 2>/dev/null` and `… || true` were indistinguishable inside it. Under `pipefail` that is
   the difference between a deploy that works and one that dies. ✅ **The stubs now execute the
   rewritten command instead of answering it.** ⚠️ **The same shape had made the `🔴 NO BACKUP HAS
   EVER RUN` branch unreachable by the path that prints it.**
2. 🔴 **`git add <paths>` and `git commit -- <paths>` guard OPPOSITE hazards and neither guards
   both.** The second was used *believing it was the safe form* and swept ~74 lines of the peer's
   unstaged work into a commit titled as a one-line fix. **With a peer live in the same file, use
   the index technique** (`git show HEAD:<path>` → your hunks → `hash-object -w` → `update-index`).
3. ⚠️ **`NodeJS.ProcessEnv` is augmented here to REQUIRE `NODE_ENV`**, so a function taking it
   cannot be called with a literal bag of the values it reads. A typecheck error shipped in one
   commit because **`tsc` was run before the tests were written and not again before committing** —
   vitest uses esbuild and does not typecheck.
4. ⚠️ **`git status` clean at pre-flight is not clean at deploy.** The refusal's first catch was the
   peer saving files into the **shared checkout** between the two. ✅ **Deploy from a pristine
   `git clone` of a named commit** — it satisfies the refusal honestly where `--allow-dirty`
   silences it, and it is how `0015` went out.

## 4. What to do next

### An agent alone — nothing needs Richard

1. **Finish E7**, and it is one coherent DB-touching tranche, so do it in one go:
   - the **upload endpoint** (binary PNG in, `{ key, grant }` out — the 32 KB payload cap is why it
     cannot ride inside the attachment JSON),
   - the **image-serving route**, which **must apply the same visibility rules as the attachment it
     belongs to** — a capture is a screenshot of somebody's project, and a public object URL would
     bypass every rule this platform has,
   - `Attachment.tsx`, which still says *"image not yet hosted"*,
   - and 🔴 **the one line in `deploy.sh`** putting `HETZNER_S3_*` into the **app's** env file.
     `install-backup.sh` writes them to `backup.env`, which the *backup* reads and the *app* does
     not, so `objectStoreConfig()` returns `null` on the live site today. **Coordinate — `deploy.sh`
     is the NAT-014 session's.**
2. **UNI-006 + UNI-007's intake as ONE tranche.** ⚠️ **Check NAT-011 first — it was still unstarted
   at 18:00 today**, and its own dependency NAT-006 (the platform API) is unstarted too. The
   handover that said *"build on NAT-011's editor-side client"* describes a client **that does not
   exist yet**; building one here would be the second-client defect UNI-011 already paid for.
3. **UNI-008** (L+, and it carries a standing legal and ops burden — read D9 before starting),
   **UNI-010's remainder**, **UNI-012** (needs a **packaged build** to verify anything).

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014** and is being built now. UNI-018 is **NAT-015**;
UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
