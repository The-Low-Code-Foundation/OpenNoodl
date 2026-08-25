"""Embed corpus + eval queries with both candidate models. Cached to disk.

🔴 CHUNKING IS NOT OPTIONAL, and the reason is measured rather than assumed. Embedding
whole documents with all-minilm fails on 6 of 155 with "the input length exceeds the
context length" — at 1070..2193 chars, while a 6000-char document passes. So the window is
spent in TOKENS, and this product's text (port identifiers, enum values, doc URLs) tokenises
far worse per character than prose. A character cap chosen by eye would have let exactly
these documents through and dropped others for no reason.

Two of the six failures (Open File Picker, Sign File URL) are ground-truth documents in the
eval. Dropping a failed embed silently would have scored this retriever on a corpus with the
answers removed.

Chunks overlap so a sentence split across a boundary still appears whole in one of them.
A document's score is its BEST chunk (max-sim), which is what the SQL does too.
"""
import json,urllib.request,urllib.error,time,os,sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
from evalset import EVAL

TARGET=900; OVERLAP=150   # chars; adaptive halving below handles the token blow-ups

# 🔴 nomic-embed-text REQUIRES a task prefix and is materially worse without one. The first
# run of this harness omitted it and scored nomic at half of all-minilm's recall — which
# would have been reported as "the bigger model is worse" when what was actually measured
# was my own missing prefix. all-minilm takes no prefix.
PREFIX={'nomic-embed-text':('search_document: ','search_query: ')}

def raw(model,text):
    r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:11434/api/embed',
        data=json.dumps({'model':model,'input':text}).encode(),
        headers={'Content-Type':'application/json'}),timeout=300)
    return json.loads(r.read())['embeddings'][0]

def embed_fit(model,text,depth=0):
    """Embed, halving on a context overflow. Returns list of vectors for this span."""
    try:
        return [raw(model,text)]
    except urllib.error.HTTPError as e:
        msg=e.read().decode()
        if 'context length' not in msg or len(text)<60 or depth>6:
            raise RuntimeError(f'{model}: {msg[:120]} (len {len(text)})')
        mid=len(text)//2
        return embed_fit(model,text[:mid],depth+1)+embed_fit(model,text[mid:],depth+1)

def windows(text):
    if len(text)<=TARGET: return [text]
    out=[];i=0
    while i<len(text):
        out.append(text[i:i+TARGET])
        if i+TARGET>=len(text): break
        i+=TARGET-OVERLAP
    return out

for model in ['all-minilm','nomic-embed-text']:
    out=f'{HERE}/emb-{model}.json'
    if os.path.exists(out):
        print(f'{model}: cached'); continue
    raw(model,'warmup')
    docs=json.load(open(f'{HERE}/corpus.json'))
    t0=time.time(); dv={}; nchunks=0; nsplit=0
    dpre,qpre=PREFIX.get(model,('',''))
    for d in docs:
        vecs=[]
        for w in windows(dpre+f"{d['title']}\n{d['body']}"):
            got=embed_fit(model,w)
            if len(got)>1: nsplit+=1
            vecs.extend(got)
        dv[d['id']]=vecs; nchunks+=len(vecs)
    corpus_ms=(time.time()-t0)*1000
    qv={}; t1=time.time()
    for e in EVAL:
        for k in ('q_new','q_old','kw_new','kw_old'):
            if e[k] not in qv: qv[e[k]]=raw(model,qpre+e[k])
    q_ms=(time.time()-t1)*1000
    json.dump({'docs':dv,'queries':qv,'dims':len(qv[next(iter(qv))]),'corpus_ms':corpus_ms,
               'n_docs':len(docs),'n_chunks':nchunks,'query_ms':q_ms,'n_queries':len(qv)},open(out,'w'))
    print(f'{model}: dims={len(qv[next(iter(qv))])}  {len(docs)} docs -> {nchunks} chunks '
          f'({nsplit} needed adaptive halving) in {corpus_ms/1000:.1f}s '
          f'= {corpus_ms/nchunks:.0f} ms/chunk; {len(qv)} queries {q_ms/len(qv):.0f} ms each')
