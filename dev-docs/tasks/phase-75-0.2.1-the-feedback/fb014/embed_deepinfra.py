"""Third arm: BAAI/bge-m3 via DeepInfra's OpenAI-compatible embeddings endpoint.

Richard's suggestion, and he has used it before. Kept in its own file because it is the one
arm that leaves this machine — see the note at the bottom about what is and is not sent.

🔴 THE KEY IS READ FROM THE ENVIRONMENT AND IS NEVER WRITTEN TO DISK.
    export DEEPINFRA_API_KEY=...   then run this.
A key committed to a repo is a key you have to rotate, and this repo is not private forever.

🔴 SAME CHUNKING AS THE LOCAL ARMS (900/150), DELIBERATELY. bge-m3 has an 8192-token window
and would not need chunking at all — but changing the chunking between arms would confound
the model comparison with a chunking comparison. The larger window is a real advantage and is
recorded as its own finding rather than smuggled into these numbers.

⚠️ TWO QUERY FORMS ARE MEASURED, bare and instruction-prefixed. bge-m3's model card says no
instruction is needed for retrieval — but last session `nomic-embed-text` was scored without
the prefix it DOES need, and that nearly got published as a property of the model. Checking is
two minutes; assuming cost a wrong conclusion once already.
"""
import json, os as _os, os, sys, time, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from evalset import EVAL
from embed_all import windows          # identical chunker, not a copy of it

MODEL = 'BAAI/bge-m3'
# ⚠️ The endpoint honours OpenAI's `dimensions` parameter (32..8192). Truncating is worth
# testing rather than assuming: at 1024d every vector is TOASTed out of the heap (>2KB),
# at 384d it stays inline. If accuracy survives the cut, that is a free storage win.
DIMS = int(_os.environ['BGE_DIMS']) if 'BGE_DIMS' in _os.environ else None
URL = 'https://api.deepinfra.com/v1/openai/embeddings'
KEY = os.environ.get('DEEPINFRA_API_KEY')
BATCH = 32
# bge-m3's own card: no instruction needed for retrieval. Measured anyway, see docstring.
QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: '

def embed_batch(texts):
    if not KEY:
        raise SystemExit('DEEPINFRA_API_KEY is not set — export it, do not hardcode it.')
    payload = {'input': texts, 'model': MODEL, 'encoding_format': 'float'}
    if DIMS: payload['dimensions'] = DIMS
    body = json.dumps(payload).encode()
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json', 'Authorization': f'Bearer {KEY}'})
    for attempt in range(4):
        try:
            r = json.loads(urllib.request.urlopen(req, timeout=180).read())
            # the endpoint does NOT promise input order; sort by index rather than trust it
            rows = sorted(r['data'], key=lambda d: d['index'])
            return [d['embedding'] for d in rows], r['usage']['total_tokens']
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** attempt); continue
            raise SystemExit(f'{e.code}: {e.read().decode()[:300]}')

def main():
    out = f'{HERE}/emb-bge-m3.json' if not DIMS else f'{HERE}/emb-bge-m3-{DIMS}.json'
    if os.path.exists(out):
        print('bge-m3: cached'); return
    docs = json.load(open(f'{HERE}/corpus.json'))
    chunks, owner = [], []
    for d in docs:
        for w in windows(f"{d['title']}\n{d['body']}"):
            chunks.append(w); owner.append(d['id'])

    t0 = time.time(); vecs = []; tokens = 0
    for i in range(0, len(chunks), BATCH):
        v, tk = embed_batch(chunks[i:i + BATCH]); vecs.extend(v); tokens += tk
    corpus_ms = (time.time() - t0) * 1000

    dv = {}
    for ref, v in zip(owner, vecs):
        dv.setdefault(ref, []).append(v)

    # queries: bare and instruction-prefixed, both stored
    qtexts, qv, qv_instr = [], {}, {}
    for e in EVAL:
        for k in ('q_new', 'q_old', 'kw_new', 'kw_old'):
            if e[k] not in qtexts: qtexts.append(e[k])
    t1 = time.time(); qtok = 0
    for i in range(0, len(qtexts), BATCH):
        b = qtexts[i:i + BATCH]
        v, tk = embed_batch(b); qtok += tk
        for t, x in zip(b, v): qv[t] = x
        v2, tk2 = embed_batch([QUERY_INSTRUCTION + t for t in b]); qtok += tk2
        for t, x in zip(b, v2): qv_instr[t] = x
    q_ms = (time.time() - t1) * 1000

    json.dump({'docs': dv, 'queries': qv, 'queries_instr': qv_instr,
               'dims': len(vecs[0]), 'corpus_ms': corpus_ms, 'n_docs': len(docs),
               'n_chunks': len(chunks), 'corpus_tokens': tokens, 'query_tokens': qtok,
               'query_ms': q_ms, 'n_queries': len(qtexts)}, open(out, 'w'))
    print(f'bge-m3: dims={len(vecs[0])}  {len(docs)} docs -> {len(chunks)} chunks in '
          f'{corpus_ms/1000:.1f}s = {corpus_ms/len(chunks):.0f} ms/chunk (batched {BATCH}); '
          f'{len(qtexts)} queries x2 forms in {q_ms/1000:.1f}s')
    print(f'  MEASURED TOKENS: corpus {tokens:,}  queries {qtok:,}  '
          f'({tokens/len(chunks):.0f} tok/chunk, {tokens/sum(len(d["body"]) for d in docs):.3f} tok/char)')

if __name__ == '__main__':
    main()
