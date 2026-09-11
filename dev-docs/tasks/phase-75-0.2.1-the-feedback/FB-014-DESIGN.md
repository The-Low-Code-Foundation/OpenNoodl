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

Three candidates, all run end to end on the same corpus, the same chunking and the same queries.
**`BAAI/bge-m3` was Richard's suggestion (2026-08-25), hosted on DeepInfra**, and it wins.

| | `all-minilm` | `nomic-embed-text` | **`bge-m3`** |
|---|---|---|---|
| Where it runs | local (Ollama) | local (Ollama) | **hosted (DeepInfra)** |
| Dimensions | 384 | 768 | **1024** |
| Model size | 45 MB | 274 MB | ~2.2 GB (568 M params) |
| Context window | 512 tok | 8192 tok | **8192 tok** |
| Embed, per 900-char chunk | **33 ms** | 48 ms | 86 ms (batched 32) |
| **Per single query** | **14 ms** | 22 ms | 🔴 **843 ms** |
| Storage, 296 chunks | 1160 kB | 2536 kB | 4128 kB |
| Rename-recall, keyword @1 | 55 % | 36 % | **68 %** |
| Rename-recall, keyword @5 | 82 % | 50 % | **91 %** |
| **Conversational query @5** | 77 % | 45 % | **91 %** |
| Control (era's words) @5 | 91 % | 55 % | **100 %** |

✅ **`bge-m3` is better than both local models on every accuracy row**, and by a wide margin on the
one that matters most operationally: **conversational queries**. A person typing *"which output
fires when the http request is done"* gets **5 %** from the search we ship, **77 %** from
`all-minilm`, and **91 %** from `bge-m3`. It also scores **100 %** on the control — every
ground-truth document found, in its own vocabulary.

⚠️ **Between the two local models, the small one still wins** — `all-minilm` (384d, 45 MB) beats
`nomic-embed-text` (768d) on every row. Dimensionality is not quality here.

🔴 **But see the latency row, because it decides the shape of the design** — §2b.

🔴 **Task prefixes cut BOTH ways, and guessing is wrong in both directions.**
`nomic-embed-text` **requires** a prefix (`search_document: ` / `search_query: `); without it it
scored 27 %/50 %, and I was one edit from recording *"the bigger model is worse"* when what I had
measured was **my own missing prefix**. So for `bge-m3` I measured a prefixed arm too rather than
trusting its card — and the card was right: **the instruction prefix makes `bge-m3` worse**,
68 % → 55 % @1 on keyword queries and **91 % → 68 % @5 on conversational** ones.

✅ **So the rule is not "add a prefix", it is "run each model the way its own authors say to".**
One model needs one, the next is damaged by one, and the check costs two minutes.

## 2b. Latency — the row that actually shapes the design

🔴 **A single `bge-m3` query round trip is 843 ms** (median of 12, p95 874 ms, min 809 ms, from
this machine). `all-minilm` locally is **14 ms**. That is a **60× difference on the query path**,
and it is network and queueing rather than compute — batching 32 chunks amortised to 86 ms each,
so the ~800 ms is per-*request* overhead that a search box pays every time.

**This splits the decision in two, and the two halves have different answers:**

| | what it needs | verdict |
|---|---|---|
| **Write path** (embed on post-create, backfill) | throughput, batching, can be async and retried | ✅ **843 ms is irrelevant.** It is off the user's critical path entirely — the post is already saved. |
| **Query path** (someone types in the search box) | interactivity | 🔴 **843 ms is most of the budget.** Postgres contributes ~3 ms; the model contributes 99 % of the wait. |

✅ **The hybrid design absorbs this better than a vector-only one would**: FTS returns in **0.14 ms**
and can paint the page immediately, with vector results merged in when they land. That is a real
argument for RRF beyond the accuracy one — the fast half is also the cheap half.

⚠️ **Running `bge-m3` locally on nexus-1 is probably not the escape hatch.** It is **568 M
parameters (~2.2 GB fp32)** against a box with **3.0 GB available and 2 vCPU**, shared with three
live sites. **Unmeasured** — I did not install an inference runtime on a production host to find
out — but the parameter count alone makes it a poor fit, and CPU inference at that size would very
likely be slower than the 843 ms network call it was meant to avoid.

### Cost — now measured, not estimated

DeepInfra publishes **$0.010 / 1M tokens** for `bge-m3` (read off its model page 2026-08-25).
The endpoint returns exact token counts, so the density here is **measured, not a heuristic**:
**52,621 tokens over 175,193 chars = 0.300 tok/char**, i.e. **~137 tokens per mean bench post**.

| corpus | tokens | one-off backfill |
|---|---|---|
| 1,000 posts | 0.14 M | **$0.001** |
| 10,000 posts | 1.37 M | **$0.014** |
| 100,000 posts | 13.7 M | **$0.137** |

And on the query side: **14 tokens per search ⇒ 1,000,000 searches costs $0.14.**

✅ **Fourteen pence to embed a hundred thousand posts, and fourteen pence for a million searches.**
Cost is not a consideration at any scale this product will reach. ⚠️ It also means the earlier
character-based estimate in this doc's first draft (≤ 2.09 chars/token, a worst-case bound) was
**2.2× too pessimistic** — the measured figure is 3.33 chars/token.

### Where it computes

The two local models ran through Ollama on this laptop; `bge-m3` ran on DeepInfra. On nexus-1 the constraint is real and measured:
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

### All six arms, one table

Corpus 155 documents, 22 queries, k as shown. **`fts_today` is the search we ship: 18 % on keyword
queries in today's words, 5 % on conversational ones.**

| arm | kw @1 | kw @5 | hybrid @1 | **sentence @1** | **sentence @5** | sentence @10 | control kw @5 |
|---|---|---|---|---|---|---|---|
| `all-minilm` (384d, local) | 55 % | 82 % | 55 % | **55 %** | 77 % | 86 % | 91 % |
| `nomic-embed-text` (768d, local) | 36 % | 50 % | 41 % | 18 % | 45 % | 55 % | 55 % |
| **`bge-m3` (1024d, hosted)** | **68 %** | **91 %** | **73 %** | 41 % | **91 %** | **95 %** | **100 %** |
| `bge-m3` + instruction prefix | 55 % | 91 % | 55 % | 27 % | 68 % | 77 % | 100 % |
| `bge-m3` truncated to 512d | **68 %** | **91 %** | **73 %** | 41 % | **91 %** | 91 % | **100 %** |
| `bge-m3` truncated to 384d | **68 %** | **91 %** | **73 %** | 36 % | 77 % | 86 % | **100 %** |

⚠️ **`bge-m3` is not uniformly better, and the exception is worth naming: `all-minilm` ranks the
right answer FIRST more often on conversational queries** (55 % vs 41 % @1). `bge-m3` overtakes it
decisively by @5 (91 % vs 77 %) and @10 (95 % vs 86 %). **So the choice depends on the UI**: for a
search box showing five or ten results, `bge-m3`; for something that surfaces exactly one answer,
the gap closes and `all-minilm` is arguably ahead. This bench shows a result list, so `bge-m3`.

### Truncating `bge-m3` — a lever that turns out not to be worth pulling

The endpoint honours OpenAI's `dimensions` parameter (32–8192) and **re-normalises to unit length**
after truncating (measured: L2 = 1.0000 at 1024, 512 and 384), so cosine stays well-defined.

- **512d is free on accuracy** — identical to 1024d everywhere except sentence @10 (91 % vs 95 %).
- 🔴 **384d costs 14 points on conversational queries @5** (77 % vs 91 %) — right back to
  `all-minilm`'s number on the axis `bge-m3` was chosen for.

The reason to want 384d was storage, and **it does not survive contact with the TOAST threshold**:

| dims | bytes/vector | storage | measured |
|---|---|---|---|
| 384 | 1544 | **inline** | 480 kB main fork, 8 kB toast |
| **512** | **2056** | 🔴 **TOASTed — misses the ~2032 B threshold by 24 bytes** | 32 kB main, 848 kB toast |
| 1024 | 4104 | TOASTed | 32 kB main, 1648 kB toast |

✅ **So the only dimension that avoids TOAST is the one that costs real accuracy.** 512d halves the
TOAST volume without touching recall and is the sensible fallback if storage ever bites; **384d is
not worth it**. Default to **1024d**.

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

### Storage and build cost at 100k chunks — both dimensions, measured

| | **384d** (`all-minilm`) | **1024d** (`bge-m3`) |
|---|---|---|
| Heap + TOAST | 156 MB (all inline) | **533 MB** (6 MB heap, **527 MB TOAST**) |
| HNSW index | 195 MB | **781 MB** |
| **Total** | **~351 MB** | 🔴 **~1.31 GB** |
| Index build, single-threaded | **62 s** | **2 m 46 s** |
| Query latency via HNSW (plan-confirmed) | 2.93 ms | **2.41 ms** |

🔴 **1.31 GB is 43 % of nexus-1's available RAM (3.0 GB)** if you want the index in page cache —
on a box already serving three sites. Disk is fine (33 GB free); memory is the constraint. **At
100k posts, drop to 512d** (roughly halves it) rather than accepting a cold index.
⚠️ At the bench's *actual* size this is irrelevant: 296 chunks is **4 MB**.

⚠️ **Measure storage with `pg_total_relation_size`, not `pg_relation_size`.** The latter reports
only the main fork, and at 1024d the vectors are **all in TOAST** — it read **5888 kB** for a table
holding 533 MB. A 90× understatement that looks like a plausible number.

⚠️ **HNSW build warns past ~28,374 tuples** at a default `maintenance_work_mem` — *"hnsw graph no
longer fits into maintenance_work_mem ... Building will take significantly more time."* On a
3.8 GB box, an index build needs its memory raised for the session and is best done off-peak.

---

## 5. Bound

Bench posts only, one `embeddings` table keyed by `(kind, ref_id, chunk_seq)`. Chat is out of
scope until R-chat lands, and — given §0 — a second corpus that also does not exist yet is not
an argument for building either.

---

## AC3 — the option pair, for Richard

**Richard supplied a DeepInfra key for `BAAI/bge-m3` on 2026-08-25**, so option B is no longer
hypothetical — it has been measured on the same corpus as the others. That changed what the
question is about. **It is not cost** (14p per 100,000 posts) and it is **no longer accuracy in
doubt** (`bge-m3` wins). It is now **query latency vs a new data processor**.

🔴 **Anthropic does not sell a standalone embeddings endpoint** — the API surface is Messages,
Batches, Files, Token Counting and Models. So "reuse the key we have" was never available, and
prod holds no `ANTHROPIC_API_KEY` in any case.

### Option A — local `all-minilm` on nexus-1

- ✅ **No new data processor.** Bench text never leaves the box; D9's DPA posture and the
  data-inventory census are untouched.
- ✅ **14 ms per query.** Search feels instant.
- ✅ 45 MB model, ~351 MB at 100k chunks — comfortable on a 3.8 GB box.
- ⚠️ **13–14 points less accurate** (55 %/82 % vs 68 %/91 % on keyword queries), and **91 % → 77 %
  on conversational queries @5** — the ones people actually type.
- ⚠️ CPU on a shared box; the 33 ms/chunk figure is from this laptop, **not measured on nexus-1**.

### Option B — hosted `bge-m3` (DeepInfra)

- ✅ **The best results measured here by a clear margin**, and **100 % on the control** — every
  ground-truth document found in its own vocabulary.
- ✅ **$0.137 to embed 100,000 posts; $0.14 per million searches.** Measured, not estimated.
- ✅ 8192-token window, so chunking becomes a choice rather than a requirement.
- 🔴 **843 ms per query** (median of 12; p95 874 ms). Sixty times Option A. Postgres contributes
  ~2.4 ms of that — **the model is 99 % of the wait.**
- 🔴 **A new external processor for user-written content.** Every bench post — questions people
  write about their own projects — goes to a third party. That fires D9's DPA posture *and* the
  data-inventory census. ⚠️ **Note this eval sent no user data**: the corpus is the public node
  catalog, and the bench's 3 posts were never uploaded.
- ⚠️ A key to hold on a box that currently holds none, and a vendor whose outage degrades search.
- ⚠️ **1.31 GB at 100k chunks** (43 % of available RAM) unless truncated to 512d.

### The latency objection has a real answer, if you want one

✅ **Hybrid absorbs it.** FTS returns in **0.14 ms** and can paint results immediately; the vector
half merges in when it lands ~840 ms later. The user sees something instantly and sees it get
better — which is how a lot of search already behaves. That is an argument for RRF beyond accuracy.

⚠️ **Option C — `bge-m3` locally — is probably not the escape hatch.** 568 M parameters (~2.2 GB)
against 3.0 GB available and 2 vCPU, shared with three live sites. **Unmeasured** (I did not
install an inference runtime on a production host), but the size alone makes it likely to be
*slower* than the 843 ms call it would replace.

### My reading

**Option B, with hybrid rendering to hide the latency, and 1024d** — because the measurements
moved every objection except the data one: cost is pennies, accuracy is decisively better, and
the 843 ms is maskable. **The data-processor question is the only real question left, and it is a
commitment about other people's words, so it is yours and not mine.**

⚠️ If the answer is *"no third parties"*, Option A is a perfectly serviceable feature — 82 % @5 on
keyword queries against the 18 % we ship today is still a large improvement. Nothing here is
blocked on choosing B.

## Recommendation

**Build it behind a flag; do not launch it.** In order:

1. ⛔ **Do not deploy anything to nexus-1 yet.** Three posts.
2. ✅ Land the dev-side pieces when convenient — compose image swap (with the musl/glibc note),
   the `embeddings` table, the chunker, and the hybrid query — all behind a flag, all proven to
   run on a pgvector older than prod's.
3. 🧭 **One question for Richard, and it is not the one the task expected:** not *which model*
   (`bge-m3` wins on the numbers) and not *what it costs* (14p per 100k posts) — but **whether
   bench posts may go to a third-party processor at all.** See AC3.
4. ⏸ **Revisit when the bench has a corpus.** The trigger is content, not code. A reasonable
   threshold: when FTS starts *failing people* — which needs enough posts for a rename to hide
   one.

⚠️ **One thing IS worth doing now, and it is not this task**: the bench search matches **2/22 even
in perfect vocabulary** because `websearch_to_tsquery` ANDs bare terms. That defect is live, affects
the people using the bench today, needs no pgvector, and is a few lines.

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
- 🆕 🔴 **A task prefix is model-specific and guessing is wrong in both directions.**
  `nomic-embed-text` **needs** one; `bge-m3` is **damaged** by one (91 % → 68 % on conversational
  queries @5). The rule is *run each model the way its own authors say to*, and checking is minutes.
- 🆕 🔴 **`pg_relation_size` understated a 533 MB table as 5888 kB** — at 1024 dimensions every
  vector lives in TOAST, and the main fork is nearly empty. Use `pg_total_relation_size`.
- 🆕 ⚠️ **The TOAST threshold sits between 384 and 512 dimensions** (~2032 bytes; 384d = 1544 B
  inline, 512d = 2056 B TOASTed — it misses by **24 bytes**). So the only dimension that keeps
  vectors inline is also the only one that costs real accuracy.
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
  embed_deepinfra.py  the bge-m3 arm (hosted). READS DEEPINFRA_API_KEY FROM THE ENVIRONMENT.
                      BGE_DIMS=512 to test a truncated variant.
  evaluate.py   the four retrievers x six arms, the numbers above
```

Needs a pgvector Postgres on 55433 and Ollama with `all-minilm` and `nomic-embed-text`:

```
docker run -d --name fb014-pgvector -e POSTGRES_USER=nodegx -e POSTGRES_PASSWORD=nodegx \
  -e POSTGRES_DB=fb014 -p 55433:5432 pgvector/pgvector:pg16
ollama pull all-minilm && ollama pull nomic-embed-text
export DEEPINFRA_API_KEY=...        # for the bge-m3 arm only
```

🔴 **The key is read from the environment and is never written to disk or committed.** A key in a
repo is a key you have to rotate.

⚠️ **Deliberately its own container on 55433, not the community dev DB on 55432** — that one is
alpine (no pgvector) and a peer may be running the suite against it.
