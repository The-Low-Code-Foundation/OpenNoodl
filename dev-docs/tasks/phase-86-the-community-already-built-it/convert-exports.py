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

Usage:
    ./convert-exports.py <outdir> [corpus-dir]

`corpus-dir` defaults to this phase's vendored `corpus/components`.

## §2 — what this may and may not change

A connection whose endpoint did not survive the flatten is DROPPED, never repaired, because
repairing it would invent a wiring the community never wrote and the gate would then certify OUR
guess. Currently drops zero.

Beyond the reshape, exactly three kinds of change are made, and all three are declared per graph in
[`graphs.py`](graphs.py) with a reason attached — never inferred here:

    rename_ports      re-points a wire at the port its target was renamed TO (COM-003 AC4)
    drop_parameters   removes a parameter the gate has PROVED the runtime never reads
    requires_modules  declares a module-provided node type (COM-003 AC3)

plus one mechanical conversion that needs no per-graph judgement:

## §3 — spacing is CONVERTED, not imported (COM-003 AC2)

The corpus predates the token scale and writes spacing as raw pixels. Importing those verbatim
would seed the artefacts an agent imitates with the exact defect P81 exists to remove, so every
spacing literal that has an EXACT token becomes that token.

🔴 **The scale is read out of the product, not copied into this file.** `parameterValues.ts` already
holds `SPACING_PORTS` and `SPACE_TOKEN_BY_PX`, and its own header records why a second copy is
dangerous: *"a second copy of a palette drifts silently, so it is graded rather than trusted."* A
third copy here would drift the same way and nothing would grade it. {@link load_spacing_rules}
parses them at run time and REFUSES TO RUN if it cannot — an empty table would silently convert
nothing and report success.

⚠️ **Exact matches only.** `paddingTop: 13` has no token that means 13px and is left alone, exactly
as the rule itself is narrowed: *"telling an author to tokenise it would be telling them to invent
one."* Off-scale values are reported at the end rather than rounded, because rounding is the one
change here that would alter what the graph renders.

⚠️ **Order matters: inert parameters are dropped BEFORE spacing is tokenised.** Otherwise a port
the runtime never consults gets a tidy `var(--space-5)` written into it, which reads as on-system
and is a worse artefact than the raw literal it replaced. `community-web-rtc-video-record` has
exactly one such port and is the reason this is written down.
"""

import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CORPUS = os.path.join(HERE, 'corpus', 'components')
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PARAMETER_VALUES_TS = os.path.join(
    REPO_ROOT, 'packages', 'noodl-editor', 'src', 'editor', 'src', 'validation', 'parameterValues.ts'
)

sys.path.insert(0, HERE)
from graphs import GRAPHS  # noqa: E402


def load_spacing_rules():
    """`(SPACING_PORTS, {px: token})`, parsed from the product's own rule.

    🔴 Raises rather than returning an empty table. A converter that silently tokenises nothing
    reports the same "0 raw literals left" as one that worked.
    """
    try:
        src = open(PARAMETER_VALUES_TS, encoding='utf-8').read()
    except IOError as err:
        raise SystemExit('cannot read the spacing rule at %s: %s' % (PARAMETER_VALUES_TS, err))

    ports_block = re.search(r'const SPACING_PORTS = new Set\(\[(.*?)\]\)', src, re.S)
    scale_block = re.search(r'const SPACE_TOKEN_BY_PX: Record<number, string> = \{(.*?)\n\};', src, re.S)
    if not ports_block or not scale_block:
        raise SystemExit(
            'parameterValues.ts no longer exposes SPACING_PORTS / SPACE_TOKEN_BY_PX in the shape '
            'this parser expects. Fix the parser — do not hardcode the scale here.'
        )

    ports = set(re.findall(r"'([A-Za-z]+)'", ports_block.group(1)))
    scale = {int(px): token for px, token in re.findall(r'(\d+):\s*\'(--space[\w-]*)\'', scale_block.group(1))}
    if not ports or not scale:
        raise SystemExit('parsed an EMPTY spacing rule from parameterValues.ts — refusing to run.')
    return ports, scale


SPACING_PORTS, SPACE_TOKEN_BY_PX = load_spacing_rules()


def spacing_px(value):
    """The pixel value of a spacing parameter, or None if it is not a plain pixel length.

    Mirrors the rule's own two accepted shapes: a bare number, and the `{value, unit}` object the
    property panel writes. A `var()`, a `%` or a `"16px"` string is None — the first is already on
    system and the other two are a different finding.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, dict) and value.get('unit') == 'px' and isinstance(value.get('value'), (int, float)):
        return value['value']
    return None


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

    example_id = 'community-' + slug(title)
    declared = GRAPHS.get(example_id, {})

    example = {
        'id': example_id,
        'title': declared.get('title', title),
        'description': declared.get('description', 'Community-contributed graph, imported from the phase-86 corpus.'),
        # Computed from what is actually present, so it cannot drift the way a hand-kept list does.
        'demonstrates': sorted(types),
        'components': [{'name': title, 'nodes': flat, 'connections': conns}],
    }
    if declared.get('requires_modules'):
        example['requiresModules'] = [
            {'module': m['module'], 'nodes': sorted(m['nodes'])} for m in declared['requires_modules']
        ]
    return example, dropped, declared


def apply_corrections(example, declared):
    """The declared, reasoned deviations from the community's bytes. Returns a list of notes.

    ⚠️ Drops run BEFORE tokenisation — see the module header §3.
    """
    notes = []
    nodes = {n['id']: n for n in example['components'][0]['nodes']}

    for drop in declared.get('drop_parameters', []):
        node = nodes.get(drop['node'])
        if node is None or drop['parameter'] not in (node.get('parameters') or {}):
            raise SystemExit(
                'graphs.py declares a drop of %s.%s in %s, and it is not there. A correction that '
                'matches nothing is a correction aimed at a graph that has changed — re-measure '
                'before editing it away.' % (drop['node'], drop['parameter'], example['id'])
            )
        del node['parameters'][drop['parameter']]
        if not node['parameters']:
            del node['parameters']
        notes.append('dropped inert %s.%s' % (drop['node'], drop['parameter']))

    for ren in declared.get('rename_ports', []):
        hits = 0
        for c in example['components'][0]['connections']:
            if c['fromId'] == ren['node'] and c['fromProperty'] == ren['from']:
                c['fromProperty'] = ren['to']
                hits += 1
            if c['toId'] == ren['node'] and c['toProperty'] == ren['from']:
                c['toProperty'] = ren['to']
                hits += 1
        if not hits:
            raise SystemExit(
                'graphs.py declares a rename of %s.%s -> %s in %s and no wire uses it.'
                % (ren['node'], ren['from'], ren['to'], example['id'])
            )
        notes.append('re-pointed %d wire(s) %s.%s -> %s' % (hits, ren['node'], ren['from'], ren['to']))

    # §3 — spacing, mechanically, exact matches only.
    tokenised, off_scale = 0, []
    for node in example['components'][0]['nodes']:
        for name, value in list((node.get('parameters') or {}).items()):
            if name not in SPACING_PORTS:
                continue
            px = spacing_px(value)
            if px is None:
                continue
            token = SPACE_TOKEN_BY_PX.get(px if px == int(px) else -1)
            if token:
                node['parameters'][name] = 'var(%s)' % token
                tokenised += 1
            else:
                off_scale.append('%s.%s = %gpx' % (node['id'], name, px))
    if tokenised:
        notes.append('tokenised %d spacing literal(s)' % tokenised)
    return notes, off_scale


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    outdir = sys.argv[1]
    corpus = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_CORPUS
    os.makedirs(outdir, exist_ok=True)

    graphs = snippets = links = 0
    all_off_scale = []
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
            example, dropped, declared = convert(graph, title)
            notes, off_scale = apply_corrections(example, declared)
            all_off_scale += ['%s: %s' % (example['id'], o) for o in off_scale]

            with open(os.path.join(outdir, example['id'] + '.json'), 'w') as fh:
                json.dump(example, fh, indent=1)
                fh.write('\n')
            nodes = len(example['components'][0]['nodes'])
            conns = len(example['components'][0]['connections'])
            note = '  ⚠️ %d connection(s) dropped' % dropped if dropped else ''
            print('  %-38s %3d nodes %3d conns%s' % (example['id'], nodes, conns, note))
            for n in notes:
                print('  %-38s   ↳ %s' % ('', n))
            graphs += 1

    print('\n%d graphs converted; %d code snippets and %d external links skipped (not graphs).'
          % (graphs, snippets, links))
    if all_off_scale:
        # Reported, never rounded: rounding is the one change here that alters what renders.
        print('\n⚠️ %d spacing literal(s) are OFF the token scale and were left alone:' % len(all_off_scale))
        for o in all_off_scale:
            print('   ', o)
    print('Now score them:  npm run catalog:examples -- --dir %s' % outdir)


if __name__ == '__main__':
    main()
