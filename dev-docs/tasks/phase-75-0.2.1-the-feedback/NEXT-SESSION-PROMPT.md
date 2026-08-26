# Phase 75 — next session

**State as of 2026-08-26 (session 50).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session:** queue item 1 — **the platform half is DEPLOYED**. `nodegx-community@6460e1a`
is live on nexus-1, stamped `2026-08-26T19:30:30Z`, with migration `0023` applied.

## ✅ The s49 ordering obligation is DISCHARGED

s49 opened with a red warning: the editor must not ship before the platform, or a new editor
sharing a project with a font would file a submission with the binaries **silently dropped**.

**That is now closed.** `0023` and the routes that read it are live, verified by the deploy's own
readback (`✅ 6460e1a83f52 on main`) and by `already applied: 22 / applied: 0023_…`. 🔴 **The editor
half is no longer blocked by ordering** — 0.2.1 can ship whenever it is otherwise ready.

Deploy health, all from the run itself: neighbours `200 → 200` on all three
(`nodegx.io`, `nexus.digitalbricks.io`, `digitalbricks.io`); site `200` over real TLS; sign-in
`302 → github.com`; capture hosting ✅; off-site backup ✅ 19.5h old with a ✅ restore check from
08-23; outbox drain ✅ with an empty backlog.

## ✅ Both s50 decisions are TAKEN and SHIPPED — nothing is owed here

Richard ruled on both open items the same session. Live commit is **`fab1aac`**.

### 1. The `deploy.sh` fallback was REVERTED

`ops/deploy.sh` is **byte-identical to `2609137`** (md5 `0659d394…`, checked rather than assumed).
The laptop is the source of truth again, so deleting a key from the secrets file is once more how
a key is revoked from the host.

⚠️ **Why it was ever added:** a measurement said the laptop carried **0 of 5** `HETZNER_S3_*` keys.
It carries **4 of 5**. The probe was `grep -oE '^[A-Z_]+='` — a character class with **no digits**,
against keys that all contain a `3`. ✅ The case is still covered, pinned the *other* way, and the
spec **fails against the fallback build**, so it discriminates.

### 2. 🔴 The off-site dumps were UNENCRYPTED — now fixed AND proven

Three separate defects, each hiding the next:

1. **`install-backup.sh` blanked the passphrase on every deploy.** It branches on whether *S3
   credentials* were passed; the laptop had the keys but no passphrase, so it took the
   credentials-**present** branch and rewrote `backup.env` whole. Its preserve branch — cited in
   its own header as proof it *"NEVER DESTROYS A CONFIGURED DESTINATION"* — was **unreachable** for
   that value. ✅ The passphrase is now recovered *before* the branching, independent of the S3 keys.
2. **No test had ever executed one line of that script.** The `ssh` stub answered
   `*install-backup.sh*` with a canned `"backup wiring: ok"`. ✅ It now runs for real.
3. 🔴 **Turning encryption on then BROKE the backup, worse than the bug.** `ProtectHome=true` /
   `ProtectSystem=strict` meant gpg could not create `~/.gnupg`; the dump succeeded, gpg died, and
   **the upload never happened** — `offsite: "none"`. `restore-check.sh` had the identical flaw.
   ✅ Both now set `GNUPGHOME` somewhere writable.

✅ **Proven end to end on the live host, by hand, not inferred:**

| | |
|---|---|
| backup service | ✅ `encrypted: true`, `offsite: ok`, object `…202119.dump.**gpg**` |
| restore check, from the **encrypted off-site copy** | ✅ **56 tables restored vs 56 live** |

⚠️ 🔴 **THE PASSPHRASE IS THE ONLY THING THAT CAN DECRYPT THESE DUMPS.** It is in
`~/nodegx-community-deploy.env` (backed up to `…env.bak-20260826`) and on the host. **It belongs in
a password manager.** Losing it makes every encrypted backup unrecoverable — a worse failure than
the one just fixed.

⚠️ **`origin/main` is far behind local `main`** on `nodegx-community` (now 16 commits). Production
tracks the *working tree*, not the remote, so *deployed* and *pushed* remain independent facts.

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **Publish a curated batch** | **S–M** | 🧭 **needs Richard**: which templates, and the 3-of-8 category gap (`pixel-game`, `interactive-fiction`, `shared-canvas` are none of the six). This is what makes T3/T4/AC2 real for a user — **the machinery is now live and holds nothing** |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 3 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling.** Precondition is closer — the queue is live — but nothing has been submitted |

~~**Deploy the platform half**~~ ✅ **CLOSED s50.**

## 🔴 Findings worth carrying out of s50

1. **A hand-rolled character class is a bound that cannot report itself.** `[A-Z_]` excludes
   digits, and the keys it *did* return were exactly the digit-free names — so the output was
   short, tidy, internally consistent and **wrong**. Unlike `head -20` there is no truncation
   marker at all. ✅ **Run the complement** — `grep -vE '<pattern>' file` — before an inventory
   authorises work, and especially before it authorises overruling a deliberate decision. (Run on
   the secrets file afterwards: 4 unmatched lines, all comments. Two seconds.)
2. 🔴 **A stub that says `ok` is asserting an outcome; a stub that redirects paths is enabling an
   execution.** The canned `"backup wiring: ok"` meant `install-backup.sh` had **never run** under
   test, and a real production defect sat behind that one line. **The tell is grammatical.**
3. ⚠️ **Un-canning it went wrong twice, each time producing a green test of the WRONG path** —
   running `bash <script>` directly dropped the credentials `deploy.sh` passes as an env **prefix
   on the command string**, and `/etc/systemd/system` was hard-coded. ✅ Rewrite and `eval` the
   command string; never reconstruct the invocation.
4. 🔴 **Switching on a safety feature is a change, and its first run is a test.** Enabling
   encryption moved the failure from *"readable by whoever holds the bucket"* to *"there is no
   backup"* — and the deploy's verify section would not have said so, because it reports the
   **last** backup, which was 20h old and green. ✅ Force one run and read the **artefact**; then
   prove the **inverse** operation (restore), because a passphrase that encrypts but cannot decrypt
   looks identical to a working one until it is needed.
5. ⚠️ **`ops/deploy.sh` runs entirely over SSH, which auto mode's classifier hard-blocks.** A
   narrow allow rule lives in OpenNoodl's `.claude/settings.local.json` (gitignored): the SSH key
   is pinned, and the deploy script is pinned to `~/nodegx-community-deploy-clone/ops/deploy.sh`
   — **so deploy from that path**, re-cloned fresh each time, as the clean-tree refusal intends.

## Carried forward, unchanged

- ⚠️ **AC5's last mile is still unverified and still deliberately so.** The routes answer 200, but
  **nothing has been POSTed through the live path** — doing so files a real row on Richard's
  production queue with no withdraw route. 🔴 **The GET probe cannot stand in for it**: authorised
  and anonymous `GET /templates/submissions` both return `200 {"items":[]}`, so the empty set fits
  *"correctly scoped"* and *"wide open"* equally.
- The five defects the s46 drive found — the `Select`-in-a-`Modal` dismissal (**`BaseDialog`'s and
  still UNOWNED**), the document-global radio `name`, nested `.DS_Store`, the 44%-of-real-projects
  refusal, and the `absent` sentence that blamed an account for a deployment gap.
- The three `0021` findings, the licence-at-promotion defect, the contrast items
  (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1), and the share
  dialog's **693 px of content in a 525 px viewport**, which puts the licence question below the
  fold.
- ⚠️ **`MEMORY.md` is 20,030 units against a 17,510 budget** — 2,520 over, and growing across
  sessions. s50 added no index line and filed into an existing memory instead. **A collective sweep
  is owed.**

## Gates — session 50

| gate | result |
|---|---|
| `nodegx-community` full suite | ✅ **62 files, 1538 tests, `VITEST_EXIT=0`** — unpiped, so the exit code is the suite's own |
| `nodegx-community` `tsc --noEmit` | ✅ clean |
| revert spec vs the **fallback** build | ✅ **FAILS** — it discriminates |
| passphrase spec vs the **unfixed** script | ✅ **FAILS**, with nexus-1's exact state as its message |
| `ops/deploy.sh` end-to-end, real host | ✅ ×3, neighbours `200 → 200` every time |
| backup + restore-check, forced on the live host | ✅ encrypted, uploaded, restored, 56 = 56 |
| `npm run test:ci` (OpenNoodl) | ❌ **not run** — no OpenNoodl source changed; only meaningful **run alone on the machine**. Inherited from s47–s49 rather than paid here. |

🔴 **Two exit-code lessons this session, from opposite directions.** A suite piped to `tail`
reported **`tail`'s** exit 0, not vitest's — so every reading here came from the **summary line**.
And a `systemctl start` that returned cleanly still left `state: "failed"` in the status JSON, so
the backup was read from **the artefact**, never from the invocation.
