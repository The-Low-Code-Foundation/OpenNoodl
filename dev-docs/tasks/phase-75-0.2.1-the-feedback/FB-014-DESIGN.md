# FB-014 — search that survives renames: design + measured prototype

**Written 2026-08-25 (session 38).** Answers scope items 1–5 and AC1–AC3 of
[FB-014](FB-014-SEARCH-THAT-SURVIVES-RENAMES.md). Everything below is measured on this
machine or read off nexus-1; the harness that produced it is `fb014/` beside this file.

---

## The headline, before any of the numbers

🔴 **The bench holds 3 posts.** Read off nexus-1 on 2026-08-25:

```
bench_threads | bench_posts | total body chars | mean post
      2       |      3      |      1,369       |    456
```

Richard's motivating case — *"find something from years ago that solves your problem"* — is
about a corpus that **does not exist yet**. Semantic search cannot be evaluated on the bench
today, and shipping it would improve recall over three documents.

So this task's own AC2 ("the prototype runs against a copy of real bench data") **cannot be met
as written**, and no amount of engineering fixes that. What follows measures the *mechanism*
against a real vocabulary change, so the decision is ready when the corpus is — and answers
whether the mechanism works at all, which turns out to be the interesting question.

⚠️ It also means **nothing here should ship now**. The recommendation at the bottom is
*build-and-park*, not *launch*.

---

## 1. Extension — pgvector on the dev box and on nexus-1

| | dev (`docker-compose.yml`) | nexus-1 (prod) |
|---|---|---|
| Postgres | `postgres:16-alpine`, port 55432 | **16.15**, Ubuntu package |
| OS | — | **Ubuntu 24.04.4 LTS (noble)**, amd64 |
| `vector` in `pg_available_extensions` | **no** | **no** |
| Route to getting it | change image to `pgvector/pgvector:pg16` | `apt install postgresql-16-pgvector` |
| Version available | 0.8.2 (image) | **0.6.0-1**, `noble/universe` via `mirror.hetzner.com` |

✅ **Prod needs no third-party repo.** `postgresql-16-pgvector` is already a candidate from the
Ubuntu universe pocket on the mirror the box is configured against — one `apt install`, no PGDG
addition, no pinning. That is a much smaller blast radius than the task feared, on a box that
also serves `nodegx.io`, `nexus.digitalbricks.io` and `digitalbricks.io`.

🔴 **But prod's 0.6.0 is two minor versions behind the image's 0.8.2, so the prototype could
have used features prod cannot run.** Rather than argue from a changelog, the whole DDL and the
retrieval query were **replayed on pgvector 0.5.1** (`ankane/pgvector`) — *older* than prod's
candidate. Everything ran: `vector(384)`, `hnsw ... vector_cosine_ops`, `<=>`, and the
best-chunk-per-document aggregate. Nothing in this design postdates what prod can install.
⚠️ That image is PG15, so it is a floor test on the *extension*, not on the PG version.

⚠️ **Switching the dev image is not free.** The current image is alpine (musl); `pgvector/pgvector:pg16`
is Debian (glibc). Same PG major, so the data directory is compatible, but glibc and musl sort
text differently — text indexes built under one can be subtly wrong under the other. The suite
DROPs and recreates schemas, so the fix is to recreate the volume rather than reuse it. Worth
one line in the compose comment when this lands.

---

## 2. Embeddings — which model, computed where, costing what

Two candidates were run end to end on the same corpus and the same queries.

| | `all-minilm` | `nomic-embed-text` |
|---|---|---|
| Dimensions | **384** | 768 |
| Model size | 45 MB | 274 MB |
| Embed, per 900-char chunk | **33 ms** | 48 ms |
| Embed, per query | **14 ms** | 22 ms |
| Storage, 296 chunks | 1160 kB + 600 kB index | 2536 kB |
| Rename-recall @10 (see §4) | **91 %** | 59 % |

✅ **`all-minilm` wins on this corpus on every axis** — smaller, faster, and substantially more
accurate. That is not the usual direction and is worth stating plainly: the 768-dimension model
is worse here, on short technical text dense with identifiers.

🔴 **The first run of this comparison was wrong, and the way it was wrong is the lesson.**
`nomic-embed-text` **requires a task prefix** (`search_document: ` on documents,
`search_query: ` on queries). Without it, it scored 27 %/50 % — and I was one edit away from
recording *"the bigger model is worse"* when what I had measured was **my own missing prefix**.
With the prefix it improves to 36 %/59 % and still loses. A model comparison is only a
comparison once each model is run the way its authors say to run it.

### Cost, and why it is not the deciding factor

The corpus token volume, projected from the **measured** mean bench post (456 chars) and the
**measured** worst-case tokenisation density on this product's text (1070 chars exceeded a
512-token window ⇒ ≤ 2.09 chars/token):

| corpus | chars | tokens (worst observed density) |
|---|---|---|
| 1,000 posts | 456 k | ~0.22 M |
| 10,000 posts | 4.56 M | ~2.18 M |
| 100,000 posts | 45.6 M | ~21.8 M |

At **any** per-token rate a hosted embeddings API plausibly charges, a full backfill of a
100,000-post bench is a **single-digit-dollar** one-off, and incremental embedding on post-create
is noise. ✅ **Cost does not decide this.** Which means the choice in §2 of the task collapses to
a question that was never really about money — see the option pair in AC3 below.

### Where it computes

Both models ran through Ollama on this laptop. On nexus-1 the constraint is real and measured:
**2 vCPU, 3819 MB RAM (3027 MB available), 33 GB free disk.** `all-minilm` at 45 MB resident is
comfortable; the per-chunk cost will be worse than 33 ms on two shared cores, and that number is
**not measured on the box** — installing an inference runtime on a host serving three live sites
is not something to do speculatively. ⚠️ Treat the box-side latency as **unmeasured**, and
measure it before committing to local inference in production.

---

## 3. Write path

Reuse UNI-007's projection-cache shape, unchanged, because it already solves the two problems
this has: **claim the row before calling the model**, and **never retry a failure automatically**.
Embedding on post-create is a side effect that must not be able to fail the post — a question
that did not save because an embedding call timed out is strictly worse than a question that is
not yet searchable by vector.

One `embeddings` table keyed by `(kind, ref_id, chunk_seq)`, per the task's scope item 5.

🔴 **`vector(n)` is a typed column, so one table cannot hold two models' output.** The dimension
is baked into the schema. That makes "which model" a **migration-level** decision, not a config
flag: changing model means a new column or table plus a **full re-embed** of the corpus. Worth
knowing before picking, not after.

### 🔴 Chunking is mandatory, and the reason is not the one you would guess

Embedding whole documents with `all-minilm` **fails on 6 of 155** with
`"the input length exceeds the context length"` — at **1070–2193 chars**, while a **6000-char**
document passes. The window is spent in **tokens**, and this product's text (port identifiers,
enum values, doc URLs) tokenises far worse per character than prose. **A character cap chosen by
eye would have let exactly these documents through and dropped others for no reason.**

Two of the six failures (`Open File Picker`, `Sign File URL`) are **ground-truth documents in the
eval**. Silently dropping a failed embed would have scored the retriever on a corpus with the
answers removed — green, and meaningless.

✅ 900-char windows with 150-char overlap: 155 documents → **296 chunks, zero failures**. A
document is scored by its **best** chunk, in SQL as well as in the harness.

---

## 4. Query — the rename-recall measurement

### The corpus is real, and that is the whole point

The eval corpus is the node catalog **as it stood at `1f31d24f^`** — before three real renames.
Every sentence in it was written by a real hand, shipped, and only later had its vocabulary
changed. A corpus of paraphrases I wrote myself would measure my own paraphrasing, which is
exactly what the task's *"not synthetic paraphrases"* rules out.

**29 real renames** were mined from the catalog's own 98-commit history:

- `Success → Done` across ~15 nodes (2026-08-02), plus `Sent`, `Stored`, `Generated`,
  `Created → Done` and `Failed → Failure`
- **`Logic Builder → Visual Function`** (2026-08-12) — the total rename, no shared surface
- `Create New Record → Create Record` (2026-08-01)

⚠️ **One rename was excluded deliberately.** `Set Record Properties → Update Record` collides
with an unrelated node, `noodl.byob.UpdateRecord`, that was *already* called Update Record. A
query for the new name has two honest answers, so it cannot grade a single ground truth. (That
the rename created a live name collision is a finding in its own right, filed below.)

### The control is what makes this mean anything

Every query is asked twice — in **today's** vocabulary and in **the era's** vocabulary — over the
same corpus, the same documents, the same k. A miss on today's words only proves the *rename*
hid the document if the era's words **find** it.

🔴 **The first version of this eval had a broken control** and would have overstated the result.
Conversational queries (*"which output fires when the http request is done"*) matched only
**2/22** even in the era's own vocabulary, because `websearch_to_tsquery` ANDs bare terms and a
9-word query matches almost nothing. That is a real property of the shipped search — but it is a
defect about **query parsing**, and crediting it to renames would have been wrong. Adding
keyword-style queries — what a search box actually receives — gave the control something to say.

### Results — `all-minilm`, keyword queries, 155-document corpus, 22 queries

| retriever | the era's words (**control**) | today's words |
|---|---|---|
| **`fts_today`** — what the bench ships (match, then order by recency) | **16/22 · 73 %** | **4/22 · 18 %** |
| `fts_ranked` — same matcher, `ts_rank_cd` order (a charitable upgrade) | 13/22 @1 · 16/22 @10 | 0/22 @1 · 4/22 @10 |
| `vector` — cosine over chunks, best chunk per document | 11/22 @1 · 20/22 @10 | 12/22 @1 · **20/22 @10 · 91 %** |
| `hybrid` — RRF (k=60) of the two | **17/22 @1 · 20/22 @10** | 12/22 @1 · 19/22 @5 · **20/22 @10** |

**Read the top row.** Same documents, same matcher, same corpus — only the vocabulary varied.
**73 % → 18 %.** That is the cost of the renames, isolated, and it is the number this task exists
to establish. Vectors recover it: **18 % → 91 % @10**.

✅ **And the control argues for hybrid over vector-only.** On the era's own words, hybrid finds
**17/22 at rank 1** where vector alone finds 11 — exact lexical matching is still the best answer
when the vocabulary *does* line up. Hybrid is not a hedge here; it wins both columns.

### Latency — Postgres is not the cost

| | median | p95 |
|---|---|---|
| FTS over 155 docs (gin) | 0.14 ms | 0.15 ms |
| Vector over 296 chunks (seq — too small to index) | 0.24 ms | 0.27 ms |
| **Vector over 100,000 chunks (HNSW index scan, plan-confirmed)** | **2.93 ms** | **6.88 ms** |
| Embedding the query (`all-minilm`, this laptop) | **14 ms** | — |

✅ **The database is ~3 ms and the embedding call is ~14 ms.** Query-time cost is dominated by
the model, not by Postgres — so the thing to optimise, if it ever needs optimising, is where
inference runs, not the index.

🔴 **The first version of that 100k row read 0.53 ms, and it was fiction.** The generator used an
uncorrelated scalar subquery, which Postgres hoisted and evaluated **once** — inserting 100,000
copies of a single vector. `count(distinct vec)` returned **1**. An HNSW index over one repeated
point measures nothing. Correlating the generator gave 100,000 distinct vectors and the honest
number is **5.5× higher**.

⚠️ **And the rebuild's own index build failed twice while reporting success** — once through a
backgrounded command that exited 0 with an empty log, once with Docker's 64 MB `/dev/shm`
starving the parallel build. Both times `EXPLAIN` said **Parallel Seq Scan** while I was about to
write down an HNSW number. **The plan line is the only proof the index was used.**

### Storage and build cost at 100k chunks (384 dimensions)

| | |
|---|---|
| Table | 156 MB |
| HNSW index | **195 MB** — larger than the table |
| Total | ~351 MB |
| Index build, single-threaded, `maintenance_work_mem=400MB` | **62 s** |

⚠️ **HNSW build warns past ~28,374 tuples** at a default `maintenance_work_mem` — *"hnsw graph no
longer fits into maintenance_work_mem ... Building will take significantly more time."* On a
3.8 GB box, an index build needs its memory raised for the session and is best done off-peak.

---

## 5. Bound

Bench posts only, one `embeddings` table keyed by `(kind, ref_id, chunk_seq)`. Chat is out of
scope until R-chat lands, and — given §0 — a second corpus that also does not exist yet is not
an argument for building either.

---

## AC3 — the external-processor question, for Richard

This is the one item the task says must **not** be decided by default, and the measurements have
changed its shape: **it is not a cost question.** A full backfill is single-digit dollars at any
plausible rate. Both options are affordable. They differ on where user-written text goes.

🔴 **Anthropic does not sell a standalone embeddings endpoint** — the API surface is Messages,
Batches, Files, Token Counting and Models. So "use the key we already have" is not an option, and
prod has **no `ANTHROPIC_API_KEY`** anyway.

### Option A — local model on nexus-1

- ✅ **No new data processor.** Bench text never leaves the box. D9's DPA posture and the
  data-inventory census are untouched; nothing to add to either.
- ✅ No per-call cost, no API key to hold, no vendor to go down.
- ⚠️ **CPU on a shared box** — 2 vCPU serving three live sites. `all-minilm` is 45 MB and embeds
  a chunk in 33 ms *on this laptop*; the nexus-1 figure is **not measured** and must be before
  committing.
- ⚠️ ~350 MB more disk at 100k chunks, and an inference runtime to install and keep patched.

### Option B — hosted embeddings API

- ✅ No CPU or memory on the box; better models available than anything that fits in 45 MB.
- 🔴 **A new external processor for user-written content.** Every bench post — questions people
  write about their own projects — is sent to a third party. That fires D9's DPA posture *and*
  the data-inventory census, and it is a commitment about other people's words, not a config
  default.
- ⚠️ A new key to hold on a box that currently holds none, and a vendor whose outage degrades
  posting.

**The measured recommendation is Option A**, and the reason is that the usual argument for B —
better models — did not survive contact with this corpus: the 45 MB local model **beat** the
768-dimension one by 32 points. B buys quality this corpus does not appear to reward, at the
price of a data-protection commitment. ⚠️ But A's box-side latency is unmeasured, so the honest
form is: *A, subject to measuring it on nexus-1 first.*

**This is Richard's call, not mine.**

---

## Recommendation

**Build it behind a flag; do not launch it.** In order:

1. ⛔ **Do not deploy anything to nexus-1 yet.** Three posts.
2. ✅ Land the dev-side pieces when convenient — compose image swap (with the musl/glibc note),
   the `embeddings` table, the chunker, and the hybrid query — all behind a flag, all proven to
   run on a pgvector older than prod's.
3. 🧭 **Put the option pair above to Richard**, so the answer exists before it is needed.
4. ⏸ **Revisit when the bench has a corpus.** The trigger is content, not code. A reasonable
   threshold: when FTS starts *failing people* — which needs enough posts for a rename to hide
   one.

---

## Findings worth keeping, independent of whether this ships

- 🔴 **The renames cost the shipped search 55 points of recall (73 % → 18 %)** on keyword queries,
  measured against a working control. That is true **today**, on the corpus that exists, and it
  does not need pgvector to be worth knowing.
- 🔴 **`websearch_to_tsquery` ANDs bare terms**, so a conversational query matches **2/22** even in
  perfect vocabulary. Anyone who types a sentence into the bench search gets nothing. That is a
  **cheap** fix (OR-ing terms, or `plainto_tsquery` with ranking) and is entirely independent of
  this task.
- 🔴 **`Set Record Properties → Update Record` created a live name collision** with
  `noodl.byob.UpdateRecord`. Two nodes now answer to one name in the picker and the catalog.
  Unowned; filed here because the rename mining found it.
- 🔴 **Token length, not character length, is what breaks an embedding window** — and this
  product's identifier-dense text breaks it at **half** the character count of ordinary prose.

## Running the harness

```
dev-docs/tasks/phase-75-0.2.1-the-feedback/fb014/
  renames.py    mine real renames from the catalog's git history
  corpus.py     build the pre-rename corpus  (writes corpus.json)
  evalset.py    22 queries x 4 phrasings, with the old-vocabulary control
  embed_all.py  embed corpus + queries with both models (adaptive chunking)
  load.py       load into pgvector, build HNSW
  evaluate.py   the four retrievers, the numbers above
```

Needs a pgvector Postgres on 55433 and Ollama with `all-minilm` and `nomic-embed-text`:

```
docker run -d --name fb014-pgvector -e POSTGRES_USER=nodegx -e POSTGRES_PASSWORD=nodegx \
  -e POSTGRES_DB=fb014 -p 55433:5432 pgvector/pgvector:pg16
ollama pull all-minilm && ollama pull nomic-embed-text
```

⚠️ **Deliberately its own container on 55433, not the community dev DB on 55432** — that one is
alpine (no pgvector) and a peer may be running the suite against it.
