#!/usr/bin/env node
/**
 * Score one replay's *design* against the DSG-006 §3 rubric.
 *
 * The structural half already has a scorer (`phase-55-.../measurements/score-run.js`,
 * which reads the graph). The design half was judged by eye and never scored, so
 * the phase cannot tell "prettier" from "not worse" between the times a human
 * looks. This is the missing instrument, built to the same contract: it reads
 * artefacts that are already on disk and prints numbers a later run can diff.
 *
 *   node dev-docs/tasks/phase-54-design-groundwork/measurements/score-design.js <project-dir> [--json]
 *
 * Two sources, deliberately:
 *
 *   - **render** — six criteria are render-time facts (DSG-004 §3), so they come
 *     from `renderReport`, which drives a headless Chrome over the project as
 *     served. It launches its own Chrome; it is not the editor and not the dev
 *     stack, so it is safe to run beside a session that owns the checkout.
 *   - **graph** — "empty state" and "real copy" are authoring facts. Rendering
 *     them would only prove that the strings survived a paint, which is not the
 *     question, so they are read straight off the component JSON.
 *
 * ⚠️ **One row per criterion, never a single verdict.** The phase-58 exit test
 * hid its one failing criterion behind one green summary; DSG-006 §3 exists
 * because of that. There is deliberately no total.
 *
 * All eight rows are live. `one accent` and `rhythm` needed two facts the render
 * report did not emit — it carried no colour at all, and no band geometry — so
 * `@nodegx/render-measure` now measures both (F36). Each still prints `no-data`
 * rather than a zero if its block is absent, because a criterion that is
 * silently missing reads as a criterion that passed.
 *
 * @module measurements/score-design
 */
const fs = require('fs');
const path = require('path');
const { renderReport } = require('../../../../scripts/devtools/render-report');

/** Generic copy a model reaches for when it has nothing to say. DSG-006 `§10`. */
const DEAD_COPY = [
  /lorem ipsum/i,
  /dolor sit amet/i,
  /welcome to our (store|site|shop)/i,
  /card (title|subtitle)/i,
  /(title|subtitle|heading|text) goes here/i,
  /your (text|title|content) here/i,
  /sample (text|title|content)/i,
  /^placeholder$/i,
  /^(button|link) text$/i,
  /^item \d+$/i,
  /^lorem$/i,
  /^(lorem|ipsum|foo|bar|baz|todo|tbd|xxx|asdf)$/i,
  /^(your|my|the) (product|company|brand|store|site) name$/i,
  // The `create_project` skeleton sentence. A project still carrying it never
  // wrote a word of its own. Kept in sync by hand with
  // `SKELETON_PLACEHOLDER_MARKER`, `noodl-mcp/src/tools/createProject.ts:90`.
  /nothing built yet\. Review the plan in docs\//i
];

/**
 * F40 — the structural noun a model types into a slot it means to fill later:
 * "Category", "Title", "Description", "Link", "£0", "0 pieces". These are the
 * shape of dead copy these models actually produce; the original `DEAD_COPY`
 * list was written from the doctrine's three named examples and caught none of
 * them, which is why the row passed 6/6 and carried no signal.
 *
 * Separate from `DEAD_COPY` because it must NOT apply to `placeholder`: a text
 * input whose placeholder reads "Name" or "Description" is a correctly labelled
 * field, not a template. Two real projects (`Puppy test`, `Puppy test 3`) are
 * false-positived by the single combined list.
 */
const STRUCTURAL_NOUN =
  /^(category|categories|section|feature|product|product name|item|link|heading|subheading|sub-?line|subtitle|title|description|body|caption|label|content|text|name|value|price|image|photo|icon)$/i;

/** A zero standing in for a value nobody has yet: `£0`, `$0.00`, `0 pieces`. */
const ZERO_VALUE = [/^[£$€]\s?0([.,]0{1,2})?$/, /^0\s+(pieces|items|products|results|reviews|rows)$/i];

/** Parameter names that carry author-written copy. */
const COPY_PARAM = /^(text|label|title|placeholder|.*Label|heading|subtitle|caption)$/;

/**
 * Nodes that gate a subtree on a condition — one half of how an empty branch is
 * built. Anchored type names rather than a substring sweep.
 *
 * ⚠️ The first version was `/condition|states$|net\.noodl\.logic|Switch/i`, and
 * two of its four alternatives were wrong: **`net.noodl.logic` matches none of
 * the 175 catalog types** (the real prefixes are `net.noodl.ArrayChanged`,
 * `net.noodl.ObjectChanged`, `net.noodl.DateCompare`), and `states$` matches
 * `States`, which is the animation node. Meanwhile it missed `Inverter` — the
 * node the doctrine's own empty-state mechanism needs, and the one a real
 * project on disk uses (`phase58-backend-deferred/Pages/StockCupboard`).
 */
const GATE_TYPE = /^(Condition|Inverter|Switch|Expression|And|Or)$/;

/**
 * The other half, and the one the doctrine actually teaches: a collection's
 * emptiness driven straight into a `visible`/`mounted` port. `DbCollection2`
 * emits `isEmpty`; `Static Data`, `Collection2`, `DbCollection` and the array
 * filters emit `count`. No gate node is involved on the "hide the list" side.
 */
const EMPTY_SOURCE = /^(isEmpty|count)$/i;
const GATE_PORT = /^(visible|mounted)$/i;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Every component in the project, with its nodes and its connections.
 *
 * ⚠️ In the v2 format `children` is a list of node **ids**, not nested node
 * objects, and connections live in a sibling `connections.json`. An earlier
 * version of this walker recursed into `children` and so pushed bare strings
 * into the node list; they read as `{type: undefined}` and were counted. The
 * node array in a v2 `nodes.json` is already flat.
 */
function loadComponents(projectDir) {
  const root = path.join(projectDir, 'components');
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === 'nodes.json') {
        const doc = readJson(p, { nodes: [] });
        const flat = [];
        (function descend(nodes) {
          for (const n of nodes || []) {
            if (!n || typeof n !== 'object') continue;
            flat.push(n);
            descend(n.children);
          }
        })(doc.nodes);
        // v2: a sibling file. v1: inline on the same document.
        const sidecar = readJson(path.join(dir, 'connections.json'), null);
        const connections = (sidecar && sidecar.connections) || doc.connections || [];
        out.push({
          pathName: path.relative(root, dir).split(path.sep).join('/'),
          nodes: flat,
          connections: Array.isArray(connections) ? connections : []
        });
      }
    }
  })(root);
  return out;
}

// ── the eight criteria ───────────────────────────────────────────────────────
// Each returns {score: 0|1|null, value: string, evidence?: string}. `null` is
// no-data — the measurement does not exist yet, which is not the same as a zero.

/** `§3` — distinct font weights across text. A page all in 400 has no hierarchy. */
function typeHierarchy(vp) {
  const weights = Object.entries(vp.text?.fontWeights || {})
    .filter(([, n]) => n > 0)
    .map(([w]) => w)
    .sort();
  return {
    score: weights.length >= 3 ? 1 : 0,
    value: `${weights.length} distinct`,
    evidence: weights.join(', ') || 'none'
  };
}

/**
 * `§4` — one accent. Exactly one chromatic background colour, *and* that colour
 * has to behave like an accent: none means the page is wholly neutral, several
 * mean it is decorated rather than designed, and one that covers half the page
 * is the page's ground wearing an accent's name.
 *
 * ⚠️ F41 — the count alone was a tie between two pages nobody would call alike.
 * haiku and sonnet paint the SAME hue at the SAME count, at 52.4% and 1.3% of
 * the viewport: a full-bleed wash against an accent on a control.
 *
 * ⚠️ The ceiling is a DOCTRINE call, not a fitted one. The two runs that have
 * any accent at all sit at 0.524 and 0.013, so every threshold between about
 * 2% and 52% separates them equally well and the corpus cannot choose one.
 * A quarter of the page is where a colour stops reading as an accent and starts
 * reading as the surface it is painted on; if Richard wants it elsewhere, the
 * number to move is here and nothing else changes.
 */
const ACCENT_CEILING = 0.25;

function oneAccent(vp) {
  const n = vp.colors?.distinctAccents;
  if (n === undefined) return { score: null, value: 'no-data', evidence: 'report carries no colour block' };
  const accents = vp.colors.accents || [];
  const dominant = accents[0];
  // `share` postdates the first six replays; an older report scores on the
  // count alone rather than silently passing a wash it cannot measure.
  const share = dominant && typeof dominant.share === 'number' ? dominant.share : null;
  const restrained = share === null ? true : share <= ACCENT_CEILING;
  const pct = (s) => `${(100 * s).toFixed(1)}%`;
  return {
    score: n === 1 && restrained ? 1 : 0,
    value:
      n === 1 && share !== null
        ? `1 accent, ${pct(share)}`
        : `${n} accent${n === 1 ? '' : 's'}`,
    evidence:
      (n === 1 && !restrained
        ? `covers ${pct(share)} of the viewport, over the ${pct(ACCENT_CEILING)} ceiling — a ground, not an accent: `
        : '') +
      (accents
        .map((a) => `${a.color} (${a.area}px²${typeof a.share === 'number' ? `, ${pct(a.share)}` : ''})`)
        .join('; ') ||
        `no chromatic background; ${vp.colors.distinctNeutrals} neutral`)
  };
}

/**
 * `§1`,`§8` — vertical rhythm: how many distinct vertical spacings the page
 * uses, counting band gaps and band padding alike. The doctrine's own line is
 * that "a page with nine is not designed"; zero means nothing was spaced at all.
 */
function rhythm(vp) {
  const n = vp.rhythm?.distinctSpacings;
  if (n === undefined) return { score: null, value: 'no-data', evidence: 'report carries no rhythm block' };
  return {
    score: n >= 1 && n <= 6 ? 1 : 0,
    value: `${n} spacing${n === 1 ? '' : 's'}`,
    evidence: `${vp.rhythm.bands} bands; ${(vp.rhythm.spacings || []).map((s) => `${s.px}px×${s.count}`).join(', ') || 'none'}`
  };
}

/**
 * `§5` — imagery that actually loads. A broken URL is not imagery.
 *
 * ⚠️ **This counts rendered `<img>` elements, not authored `Image` nodes.**
 * `@nodegx/render-measure` builds its list from `document.querySelectorAll` and
 * filters on `offsetParent` (`index.js:124`,`:175`), so a project whose Image
 * node sits inside a Repeater that never ran reports `0` — and the evidence
 * string used to say *"0 Image nodes"*, which read as "none were authored".
 * F38 was filed on that reading and it was wrong: five of the six replays
 * author Image nodes and every one of them sets `sizeMode: "explicit"`.
 */
function imagery(vp) {
  const total = vp.images?.total || 0;
  const broken = vp.images?.broken || 0;
  const loading = total - broken;
  return {
    score: loading > 0 ? 1 : 0,
    value: `${loading} loading`,
    evidence: `${total} <img> rendered, ${broken} broken (DOM, not authored Image nodes)`
  };
}

/** `§7`,`§11` — the page survives 390px without a horizontal scrollbar. */
function narrowSurvives(phone) {
  if (!phone) return { score: null, value: 'no-data', evidence: 'no phone viewport rendered' };
  const overflow = phone.scrollWidth - phone.clientWidth;
  const count = phone.overflowingCount || 0;
  return {
    score: overflow <= 0 && count === 0 ? 1 : 0,
    value: overflow <= 0 && count === 0 ? 'fits' : `+${overflow}px`,
    evidence: `scrollWidth ${phone.scrollWidth} vs clientWidth ${phone.clientWidth}, ${count} overflowing`
  };
}

/** `§8`,`§11` — a grid lays items side by side; a column of full-width rows does not. */
function gridIsAGrid(vp) {
  const groups = (vp.repeatedGroups || []).filter((g) => (g.count || 0) >= 2);
  // `columns >= 2` matters as much as the width: three stacked lines of text are
  // each narrower than their parent and are not a grid.
  const multi = groups.filter(
    (g) => (g.columns || 0) >= 2 && g.itemWidth > 0 && g.parentWidth > 0 && g.itemWidth < g.parentWidth * 0.95
  );
  return {
    score: multi.length > 0 ? 1 : 0,
    value: `${multi.length}/${groups.length} multi-column`,
    evidence: multi.length
      ? multi.map((g) => `${g.cls || g.tag} ${g.columns}×${g.rows} ${g.itemWidth}/${g.parentWidth}px`).join('; ')
      : groups.map((g) => `${g.cls || g.tag} ${g.itemWidth}/${g.parentWidth}px`).slice(0, 3).join('; ') || 'no repeated groups'
  };
}

/**
 * `§9` — a list has a designed branch for having nothing in it.
 *
 * A list is gated when its host component either holds a gate node
 * ({@link GATE_TYPE}) or wires a collection's `isEmpty`/`count` straight into a
 * `visible`/`mounted` port ({@link EMPTY_SOURCE}). The second form is the one
 * the doctrine teaches and the first version could not see at all.
 */
function emptyState(components) {
  const hosts = components.filter((c) => c.nodes.some((n) => n.type === 'For Each' || n.type === 'DbCollection2'));
  const how = new Map();
  for (const c of hosts) {
    const gates = c.nodes.filter((n) => GATE_TYPE.test(n.type || '')).map((n) => n.type);
    const wires = c.connections
      .filter((x) => GATE_PORT.test(x.toProperty || '') && EMPTY_SOURCE.test(x.fromProperty || ''))
      .map((x) => `${x.fromProperty}→${x.toProperty}`);
    if (gates.length || wires.length) how.set(c, [...wires, ...gates].join(','));
  }
  return {
    score: hosts.length > 0 && how.size === hosts.length ? 1 : 0,
    value: `${how.size}/${hosts.length} lists gated`,
    evidence: hosts.length
      ? hosts.map((c) => `${c.pathName} (${how.get(c) || 'none'})`).join('; ')
      : 'no For Each or Query Records in the project'
  };
}

/**
 * `§10` — copy a person wrote, not copy a template shipped.
 *
 * ⚠️ **A literal that a connection overwrites is not copy.** Every replay
 * component driven by a Repeater carries defaults like `"Title"`, `"£0"`,
 * `"Category"` on the very ports its Component Inputs feed; none of them ever
 * reaches a screen. Counting them would fail sonnet — the one run Richard's
 * verdict clears — on thirteen strings nobody can see. The rule is therefore:
 * a `(node, param)` pair that is the target of a connection is exempt.
 */
function realCopy(components) {
  const hits = [];
  for (const c of components) {
    const driven = new Set(c.connections.map((x) => `${x.toId} ${x.toProperty}`));
    for (const n of c.nodes) {
      for (const [k, v] of Object.entries(n.parameters || {})) {
        if (typeof v !== 'string' || !COPY_PARAM.test(k)) continue;
        const t = v.trim();
        if (!t) continue;
        if (driven.has(`${n.id} ${k}`)) continue;
        const rules = k === 'placeholder' ? DEAD_COPY : [...DEAD_COPY, STRUCTURAL_NOUN, ...ZERO_VALUE];
        if (rules.some((re) => re.test(t))) hits.push(`${c.pathName} ${k}="${t.slice(0, 60)}"`);
      }
    }
  }
  return {
    score: hits.length === 0 ? 1 : 0,
    value: hits.length === 0 ? 'clean' : `${hits.length} generic`,
    evidence: hits.slice(0, 4).join('; ') || 'no generic copy found'
  };
}

const ROWS = [
  { key: 'type-hierarchy', doctrine: '§3', source: 'render' },
  { key: 'one-accent', doctrine: '§4', source: 'render' },
  { key: 'rhythm', doctrine: '§1,§8', source: 'render' },
  { key: 'imagery-present', doctrine: '§5', source: 'render' },
  { key: 'narrow-survives', doctrine: '§7,§11', source: 'render' },
  { key: 'grid-is-a-grid', doctrine: '§8,§11', source: 'render' },
  { key: 'empty-state', doctrine: '§9', source: 'graph' },
  { key: 'real-copy', doctrine: '§10', source: 'graph' }
];

async function scoreDesign(projectDir) {
  const { report } = await renderReport({ projectDir, screenshot: 'none' });
  const desktop = report.viewports?.desktop;
  const phone = report.viewports?.phone;
  const components = loadComponents(projectDir);

  const results = {
    'type-hierarchy': typeHierarchy(desktop || {}),
    'one-accent': oneAccent(desktop || {}),
    rhythm: rhythm(desktop || {}),
    'imagery-present': imagery(desktop || {}),
    'narrow-survives': narrowSurvives(phone),
    'grid-is-a-grid': gridIsAGrid(desktop || {}),
    'empty-state': emptyState(components),
    'real-copy': realCopy(components)
  };

  return {
    project: path.basename(projectDir),
    projectName: report.projectName,
    criteria: ROWS.map((r) => ({ ...r, ...results[r.key] }))
  };
}

function print(r) {
  const mark = (s) => (s === null ? '  —  ' : s ? ' PASS' : ' FAIL');
  const lines = [
    `project   ${r.project}  (${r.projectName || '?'})`,
    '',
    'criterion          doctrine  src      score  value                evidence',
    '─'.repeat(110)
  ];
  for (const c of r.criteria) {
    lines.push(
      [
        c.key.padEnd(18),
        c.doctrine.padEnd(9),
        c.source.padEnd(8),
        mark(c.score).padEnd(6),
        String(c.value).padEnd(20),
        c.evidence
      ].join(' ')
    );
  }
  const scored = r.criteria.filter((c) => c.score !== null);
  lines.push('─'.repeat(110));
  lines.push(
    `${scored.filter((c) => c.score).length}/${scored.length} scored criteria pass · ` +
      `${r.criteria.length - scored.length} not measurable (see evidence) · no total by design`
  );
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith('--'));
  if (!dir) {
    process.stderr.write('usage: score-design.js <project-dir> [--json]\n');
    process.exit(2);
  }
  const result = await scoreDesign(path.resolve(dir));
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : `${print(result)}\n`);
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  });
}

module.exports = { scoreDesign, ROWS };
