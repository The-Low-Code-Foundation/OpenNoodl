import json, subprocess, sys
import os as _os
# the repo root, derived from this file's location so it works in a worktree too
REPO = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..', '..'))

CAT='packages/noodl-types/src/node-catalog.json'
def sh(*a): return subprocess.run(a,capture_output=True,text=True,cwd=REPO)
log=sh('git','log','--all','--reverse','--format=%H|%ad|%s','--date=short','--',CAT).stdout.strip().split('\n')
commits=[l.split('|',2) for l in log if l]
def snap(sha):
    r=sh('git','show',f'{sha}:{CAT}')
    if r.returncode: return None
    try: d=json.loads(r.stdout)
    except Exception: return None
    types={}; ports={}
    for n in d.get('nodes',[]):
        tn=n.get('typeName')
        if not tn: continue
        types[tn]=n.get('displayName','')
        for side in ('inputs','outputs'):
            for p in n.get(side,[]) or []:
                if p.get('name'): ports[(tn,side,p['name'])]=(p.get('displayName',''),(p.get('description') or '')[:120])
    return types,ports
prev=None; found=[]
for sha,date,subj in commits:
    cur=snap(sha)
    if cur is None: continue
    if prev:
        pt,pp=prev; ct,cp=cur
        gone=set(pt)-set(ct); new=set(ct)-set(pt)
        for g in gone:
            for n in new:
                if pt[g] and pt[g]==ct[n]: found.append(('TYPE',date,sha[:8],g,n,pt[g],subj))
        # port name changes: same node, port gone + port added with identical description
        gp=set(pp)-set(cp); np=set(cp)-set(pp)
        for g in gp:
            for n in np:
                if g[0]==n[0] and g[1]==n[1] and pp[g][1] and pp[g][1]==cp[n][1] and g[2]!=n[2]:
                    found.append(('PORT',date,sha[:8],f'{g[0]}.{g[2]}',f'{n[0]}.{n[2]}',pp[g][0]+' / '+cp[n][0],subj))
    prev=cur
for f in found: print(f'{f[0]:5} {f[1]} {f[2]}  {f[3]}  ->  {f[4]}   [{f[5]}]')
print(f'\n{len(found)} identifier-level renames')
