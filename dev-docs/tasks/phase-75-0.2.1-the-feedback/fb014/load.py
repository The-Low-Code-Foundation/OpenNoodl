"""Load the corpus and both models' vectors into the prototype pgvector database.

The FTS half is a DELIBERATE COPY of what the bench ships today
(0008_uni015_bench.sql:170 + bench.ts:239): a generated `to_tsvector('english', body)`
column, a gin index, and `websearch_to_tsquery`. Copied rather than improved, because the
number this eval has to produce is "what does search do TODAY vs with vectors" — an FTS
side I quietly made better would flatter the baseline and understate the change.

⚠️ ONE TABLE PER MODEL, and that is a finding rather than laziness: `vector(n)` is a typed
column, so two models with different dims cannot share it. In production that means the
`embeddings` table declares ONE model's dimension and changing model is a migration plus a
full re-embed of the corpus.
"""
import json,os,subprocess,sys
HERE=os.path.dirname(os.path.abspath(__file__))
docs=json.load(open(f'{HERE}/corpus.json'))
def q(s): return "'"+s.replace("'","''")+"'"
sql=["drop table if exists docs cascade;",
     "create table docs (id text primary key, title text not null, body text not null);",
     "alter table docs add column body_tsv tsvector generated always as (to_tsvector('english', title || ' ' || body)) stored;",
     "create index docs_search_idx on docs using gin (body_tsv);"]
for d in docs:
    sql.append(f"insert into docs (id,title,body) values ({q(d['id'])},{q(d['title'])},{q(d['body'])});")
for model in ['all-minilm','nomic-embed-text','bge-m3','bge-m3-512','bge-m3-384']:
    e=json.load(open(f'{HERE}/emb-{model}.json')); dim=e['dims']; t='emb_'+model.replace('-','_')
    sql += [f"drop table if exists {t};",
            f"create table {t} (kind text not null, ref_id text not null, chunk_seq int not null, "
            f"vec vector({dim}) not null, primary key (kind,ref_id,chunk_seq));"]
    for ref,vecs in e['docs'].items():
        for i,v in enumerate(vecs):
            sql.append(f"insert into {t} values ('bench_post',{q(ref)},{i},'[{','.join(f'{x:.6f}' for x in v)}]');")
    # HNSW with cosine distance. 🔴 Both the index type and the operator class exist in
    # pgvector 0.5.1, so nothing here needs more than prod's 0.6.0 candidate.
    sql.append(f"create index {t}_hnsw on {t} using hnsw (vec vector_cosine_ops);")
sql.append("analyze;")
open(f'{HERE}/load.sql','w').write('\n'.join(sql))
p=subprocess.run(['docker','exec','-i','fb014-pgvector','psql','-U','nodegx','-d','fb014','-v','ON_ERROR_STOP=1','-q'],
                 stdin=open(f'{HERE}/load.sql'),capture_output=True,text=True)
print('load rc=',p.returncode, p.stderr[-500:] if p.returncode else '')
chk=subprocess.run(['docker','exec','fb014-pgvector','psql','-U','nodegx','-d','fb014','-tAc',
   "select (select count(*) from docs), (select count(*) from emb_all_minilm), (select count(*) from emb_nomic_embed_text)"],
   capture_output=True,text=True)
print('docs | minilm chunks | nomic chunks =',chk.stdout.strip())
