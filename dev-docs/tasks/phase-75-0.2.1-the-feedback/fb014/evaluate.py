"""The rename-recall measurement.

FOUR retrievers, because "FTS" is ambiguous and the ambiguity flatters one of them:

  fts_today   what the bench SHIPS: `body_tsv @@ websearch_to_tsquery` as a FILTER, then
              `order by t.seq desc` — recency, not relevance. So the only question it can
              answer is "did the document match at all". Reported as a hit/miss, no k.
  fts_ranked  the same matcher but ordered by ts_rank_cd — a charitable upgrade of today's
              search, so that vectors are not credited with a win that better ranking alone
              would have delivered.
  vector      cosine over chunk embeddings, a document scored by its BEST chunk.
  hybrid      reciprocal-rank fusion (k=60) of fts_ranked and vector.

Every query is run twice — q_new (today's words) and q_old (the document's own era). q_old
is the control: a miss on q_new only means the RENAME hid the document if q_old finds it.
"""
import json,os,subprocess,sys,time
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
from evalset import EVAL
K=10; RRF_K=60

def psql(sql):
    p=subprocess.run(['docker','exec','-i','fb014-pgvector','psql','-U','nodegx','-d','fb014',
                      '-tAF','\x1f','-v','ON_ERROR_STOP=1','-c',sql],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-400:])
    return [l.split('\x1f') for l in p.stdout.strip().split('\n') if l]

def lit(s): return "'"+s.replace("'","''")+"'"

def fts_all(qtext):
    """Every document today's matcher matches, ts_rank_cd order (fts_ranked); the SET is fts_today."""
    rows=psql(f"select id, ts_rank_cd(body_tsv, websearch_to_tsquery('english',{lit(qtext)})) r "
              f"from docs where body_tsv @@ websearch_to_tsquery('english',{lit(qtext)}) order by r desc, id")
    return [r[0] for r in rows]

def vec_all(table,qvec,limit=50):
    v="'["+",".join(f'{x:.6f}' for x in qvec)+"]'"
    rows=psql(f"select ref_id, min(vec <=> {v}::vector) d from {table} where kind='bench_post' "
              f"group by ref_id order by d asc limit {limit}")
    return [r[0] for r in rows]

def rrf(*lists):
    s={}
    for L in lists:
        for i,d in enumerate(L): s[d]=s.get(d,0)+1.0/(RRF_K+i+1)
    return [d for d,_ in sorted(s.items(),key=lambda kv:-kv[1])]

def rank_of(lst,target):
    return lst.index(target)+1 if target in lst else None

results={}
ARMS=[('all-minilm','emb_all_minilm',False),('nomic-embed-text','emb_nomic_embed_text',False),
      ('bge-m3','emb_bge_m3',False),('bge-m3 +instr','emb_bge_m3',True),
      ('bge-m3-512','emb_bge_m3_512',False),('bge-m3-384','emb_bge_m3_384',False)]
for model,table,use_instr in ARMS:
    emb=json.load(open(f'{HERE}/emb-{model.split()[0]}.json'))
    QK='queries_instr' if use_instr else 'queries'
    rows=[]
    for e in EVAL:
        row={'doc':e['doc'],'fam':e['fam'],'renamed':e['renamed']}
        for era in ('q_new','q_old','kw_new','kw_old'):
            qt=e[era]
            f=fts_all(qt); v=vec_all(table,emb[QK][qt]); h=rrf(f,v)
            row[era]={'fts_today': e['doc'] in f, 'fts_ranked':rank_of(f,e['doc']),
                      'vector':rank_of(v,e['doc']), 'hybrid':rank_of(h,e['doc']),
                      'fts_matched_n':len(f)}
        rows.append(row)
    results[model]=rows

def pct(n,d): return f'{100*n/d:.0f}%'
N=len(EVAL)
print(f'CORPUS 155 documents (node catalog @ 1f31d24f^, pre-rename) · {N} eval queries · k={K}\n')
for model,rows in results.items():
    print(f'══ {model} ' + '═'*(60-len(model)))
    for era,lab in (('kw_new','KEYWORD  today\'s words      '),('kw_old','KEYWORD  the era\'s words  ← CONTROL'),
                    ('q_new', 'SENTENCE today\'s words      '),('q_old', 'SENTENCE the era\'s words  ← CONTROL')):
        ft=sum(1 for r in rows if r[era]['fts_today'])
        def at(k,key): return sum(1 for r in rows if r[era][key] and r[era][key]<=k)
        print(f'  {lab}')
        print(f'    fts_today  matched at all : {ft:2}/{N}  {pct(ft,N)}')
        for key in ('fts_ranked','vector','hybrid'):
            print(f'    {key:10} @1 {at(1,key):2}/{N} {pct(at(1,key),N):>4} · '
                  f'@5 {at(5,key):2}/{N} {pct(at(5,key),N):>4} · @10 {at(10,key):2}/{N} {pct(at(10,key),N):>4}')
    print()
json.dump(results,open(f'{HERE}/results.json','w'),indent=1)
