"""Build the eval corpus from the catalog AS IT WAS BEFORE the renames.

🔴 The point of using git rather than writing paraphrases: every sentence in here was
written by a real hand, shipped, and only later had its vocabulary changed. A corpus I
paraphrased myself would be measuring my own paraphrasing, which is the trap the task
names ("not synthetic paraphrases").

PRE = 1f31d24f^ — the parent of the earliest commit in the 2026-08-02 Success->Done sweep.
At that commit the catalog still says "Success"/"Sent"/"Generated"/"Stored" AND still says
"Logic Builder" (renamed 2026-08-12), so one snapshot carries both vocabulary eras.
"""
import json, subprocess, sys
import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
REPO = _os.path.abspath(_os.path.join(HERE, '..', '..', '..', '..'))
CAT='packages/noodl-types/src/node-catalog.json'
PRE='1f31d24f^'

r=subprocess.run(['git','show',f'{PRE}:{CAT}'],capture_output=True,text=True,cwd=REPO)
d=json.loads(r.stdout)
docs=[]
for n in d['nodes']:
    tn=n['typeName']; dn=n.get('displayName') or tn
    parts=[f"{dn}"]
    if n.get('category'): parts.append(f"Category: {n['category']}.")
    ports=[]
    for side in ('inputs','outputs'):
        for p in n.get(side,[]) or []:
            label=p.get('displayName') or p.get('name')
            desc=(p.get('description') or '').strip()
            kind='output' if side=='outputs' else 'input'
            if p.get('isSignal'): kind=f'signal {kind}'
            ports.append(f"{label} ({kind}){': '+desc if desc else ''}")
    if ports: parts.append("Ports: "+"; ".join(ports))
    body=" ".join(parts)
    docs.append({'id':tn,'title':dn,'body':body[:6000]})
print(json.dumps(docs,indent=0), file=open(HERE + '/corpus.json','w'))
print(f'{len(docs)} documents from catalog @ {PRE}', file=sys.stderr)
print(f'avg body {sum(len(x["body"]) for x in docs)//len(docs)} chars, total {sum(len(x["body"]) for x in docs)}', file=sys.stderr)
# sanity: the old vocabulary really is present
for term in ['Success','Sent','Generated','Stored','Logic Builder','Set Record Properties','Create New Record']:
    hits=[x['id'] for x in docs if term in x['body']]
    print(f'  old term {term!r}: {len(hits)} docs', file=sys.stderr)
for term in ['Visual Function','Update Record']:
    hits=[x['id'] for x in docs if term in x['body']]
    print(f'  NEW term {term!r}: {len(hits)} docs (want 0)', file=sys.stderr)
