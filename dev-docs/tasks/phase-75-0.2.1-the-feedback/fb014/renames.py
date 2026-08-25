"""Extract REAL vocabulary renames from the node catalog's own git history.

Not synthetic paraphrases: every pair below is a name this product actually shipped and
then actually changed, with the commit and date that changed it.
"""
import json, subprocess, sys, collections

import os as _os
# the repo root, derived from this file's location so it works in a worktree too
REPO = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..', '..'))

CAT = 'packages/noodl-types/src/node-catalog.json'

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, cwd=REPO)

# oldest -> newest
log = sh('git', 'log', '--all', '--reverse', '--format=%H|%ad|%s', '--date=short', '--', CAT).stdout.strip().split('\n')
commits = [l.split('|', 2) for l in log if l]
print(f'{len(commits)} commits touching the catalog', file=sys.stderr)

def vocab_at(sha):
    """{(typeName, 'node'): displayName, (typeName, 'in:portname'): displayName, ...}"""
    r = sh('git', 'show', f'{sha}:{CAT}')
    if r.returncode != 0:
        return None
    try:
        d = json.loads(r.stdout)
    except Exception:
        return None
    out = {}
    for n in d.get('nodes', []):
        tn = n.get('typeName')
        if not tn:
            continue
        if n.get('displayName'):
            out[(tn, 'node')] = n['displayName']
        for side in ('inputs', 'outputs'):
            for p in n.get(side, []) or []:
                pn, dn = p.get('name'), p.get('displayName')
                if pn and dn:
                    out[(tn, f'{side[:-1]}:{pn}')] = dn
    return out

renames = []          # (key, old, new, sha, date, subject)
prev = None
for sha, date, subj in commits:
    cur = vocab_at(sha)
    if cur is None:
        continue
    if prev is not None:
        for k, new in cur.items():
            old = prev.get(k)
            if old is not None and old != new:
                renames.append((k, old, new, sha[:8], date, subj))
    prev = cur

print(f'\n{len(renames)} display-name changes across the history\n')
for k, old, new, sha, date, subj in renames:
    print(f'{date} {sha}  {k[0]}.{k[1]}\n    "{old}"  ->  "{new}"\n    ({subj[:78]})')
