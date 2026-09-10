#!/usr/bin/env python3
"""
COM-003's instrument — community clipboard-JSON -> catalog example format.

The community exports and `docs/node-catalog/examples/*.json` are NOT the same shape, and the
difference is the whole reason this file exists:

    exports   nested `children: [ {node}, ... ]`, UUID ids, x/y coordinates
    examples  flat node list, readable ids, `children: ["id"]` + `parent: "id"`, no coordinates

So this flattens, re-slugs every id from its label, drops the coordinates, and rewrites both ends of
every connection to the new ids. A connection whose endpoint did not survive is DROPPED, not
rewritten to a guess — see §2.

🔴 **This converts. It does not certify.** The output is a CANDIDATE. Score it with the gate that
already exists and never hand-inspect instead:

    npm run catalog:examples -- --dir <outdir>      # exit 0 = clean, 1 = diagnostics

Baseline measured 2026-09-10: 5 of 12 candidates clean. See MEASURED-2026-09-10.md.

Usage:
    ./convert-exports.py <outdir> [corpus-dir]

`corpus-dir` defaults to this phase's vendored `corpus/components`.
"""

import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CORPUS = os.path.join(HERE, 'corpus', 'components')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def convert(graph, title):
    """One export graph -> one example-format dict. Returns (example, dropped_connections)."""
    ids = {}
    flat = []
    types = set()
    seen = collections.Counter()

    def visit(nodes, parent=None):
        kids = []
        for node in nodes:
            # A label is what a person called it; the type tail is the fallback. Either way the id
            # is readable, because an example is read by a model that has no coordinates to look at.
            base = slug(node.get('label') or node['type'].split('.')[-1]) or 'node'
            seen[base] += 1
            nid = base if seen[base] == 1 else '%s-%d' % (base, seen[base])
            ids[node['id']] = nid
            kids.append(nid)
            types.add(node['type'])

            out = {'id': nid, 'type': node['type']}
            if node.get('label'):
                out['label'] = node['label']
            if parent:
                out['parent'] = parent
            if node.get('parameters'):
                out['parameters'] = node['parameters']
            if node.get('ports'):
                out['ports'] = node['ports']
            flat.append(out)

            children = visit(node.get('children', []), nid)
            if children:
                out['children'] = children
        return kids

    visit(graph['nodes'])

    # §2 — a connection whose endpoint is missing is dropped rather than repaired. Repairing it
    # would invent a wiring the community never wrote, and the gate would then certify OUR guess.
    conns, dropped = [], 0
    for c in graph.get('connections', []):
        if c['fromId'] in ids and c['toId'] in ids:
            conns.append({
                'fromId': ids[c['fromId']], 'fromProperty': c['fromProperty'],
                'toId': ids[c['toId']], 'toProperty': c['toProperty'],
            })
        else:
            dropped += 1

    return {
        'id': 'community-' + slug(title),
        'title': title,
        'description': 'Community-contributed graph, imported from the phase-86 corpus.',
        'demonstrates': sorted(types),
        'components': [{'name': title, 'nodes': flat, 'connections': conns}],
    }, dropped


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    outdir = sys.argv[1]
    corpus = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_CORPUS
    os.makedirs(outdir, exist_ok=True)

    graphs = snippets = links = 0
    for d in sorted(os.listdir(corpus)):
        p = os.path.join(corpus, d)
        if not os.path.isdir(p):
            continue
        for f in sorted(os.listdir(p)):
            if not f.endswith('.md'):
                continue
            text = open(os.path.join(p, f), encoding='utf-8').read()
            m = re.search(r'```[a-z]*\n?(.*?)```', text, re.S)
            body = m.group(1).strip() if m else text.split('-' * 29, 1)[-1].strip()

            graph = None
            try:
                parsed = json.loads(body)
                if isinstance(parsed, dict) and 'nodes' in parsed:
                    graph = parsed
            except ValueError:
                pass

            if graph is None:
                # The other two kinds in this corpus: a bare code snippet, or a URL to a payload
                # that lives somewhere else. Neither is a graph and neither is converted here.
                if body.startswith('http'):
                    links += 1
                else:
                    snippets += 1
                continue

            title = d.rsplit('_', 1)[0]
            example, dropped = convert(graph, title)
            with open(os.path.join(outdir, example['id'] + '.json'), 'w') as fh:
                json.dump(example, fh, indent=1)
            nodes = len(example['components'][0]['nodes'])
            conns = len(example['components'][0]['connections'])
            note = '  ⚠️ %d connection(s) dropped' % dropped if dropped else ''
            print('  %-38s %3d nodes %3d conns%s' % (example['id'], nodes, conns, note))
            graphs += 1

    print('\n%d graphs converted; %d code snippets and %d external links skipped (not graphs).'
          % (graphs, snippets, links))
    print('Now score them:  npm run catalog:examples -- --dir %s' % outdir)


if __name__ == '__main__':
    main()
