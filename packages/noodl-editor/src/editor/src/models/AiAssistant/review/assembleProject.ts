/**
 * AIX-010 — project-scope context assembly.
 *
 * The spec offered a choice: extend Explain's `ExplainScope` with `'project'`,
 * or add a sibling assembler. This is the sibling, and the reason is that
 * `assembleContext` is a bounded expansion *outward from a selection* — roles,
 * neighbour depth, per-node parameter caps. A project review has no selection
 * and no centre; its bound is "which whole components can I afford", which is a
 * different algorithm wearing the same word. Bolting it into one function would
 * have produced a function whose options are half-meaningless in either mode.
 *
 * What it does reuse is the discipline, not by imitation but by *calling the
 * same code*: every handout goes through `AuthoringContextBuilder`, so a review
 * is charged, capped and logged by the same object an authoring turn is, and
 * full component reads are the same bounded `assembleContext` + `renderContext`
 * an explanation gets. There is no second budget to drift.
 *
 * Assembly order is the spec's, cheapest first:
 *
 *   1. project overview (every component, one line, interface included)
 *   2. the page map — see ./pageMap for why it is not the routes file
 *   3. backend: configured services and the real collections/fields
 *   4. style vocabulary
 *   5. full reads of the highest-signal components, under budget (./selection)
 *
 * Pure: no `ProjectModel`, no filesystem, no Electron. `noodl-mcp` bundles it.
 *
 * @module AiAssistant/review/assembleProject
 */

import { AuthoringContextBuilder } from '../authoring/ContextBuilder';
import type { ContextBudget } from '../authoring/types';
import type { ExplainGraph } from '../explain/types';
import { mergeNodeTypes, readComponentForReview, renderNodeVocabulary } from './componentReads';
import type { ComponentRead } from './componentReads';
import { buildPageMap, renderPageMap } from './pageMap';
import { rankComponents } from './selection';
import type {
  BackendSummary,
  CoverageRead,
  CoverageSkipped,
  CoverageSource,
  ProjectReviewContext,
  ProjectReviewCoverage,
  ProjectReviewSources,
  RankedComponent
} from './types';

/**
 * A review may read more components in full than an authoring turn, and is
 * allowed a larger total — it is a one-shot job producing three documents, not
 * a loop that will run again in thirty seconds. Still bounded, and still the
 * bound the user is shown.
 */
export const REVIEW_BUDGET: ContextBudget = {
  maxChars: 160_000,
  maxComponentReads: 8
};

export interface AssembleProjectReviewOptions {
  budget?: Partial<ContextBudget>;
  /**
   * Reserve for the prompts themselves — component reads stop this far short of
   * the budget so the last read cannot leave the drafting turn with nothing.
   */
  reserveChars?: number;
}

const DEFAULT_RESERVE = 8_000;
/** A component with this many nodes or fewer says nothing a one-line interface did not. */
const TRIVIAL_NODE_COUNT = 2;

export function assembleProjectReview(
  graph: ExplainGraph,
  sources: ProjectReviewSources = {},
  options: AssembleProjectReviewOptions = {}
): ProjectReviewContext {
  const budget: ContextBudget = { ...REVIEW_BUDGET, ...options.budget };
  const reserve = options.reserveChars ?? DEFAULT_RESERVE;
  const builder = new AuthoringContextBuilder(graph, budget, undefined, sources.styleVocabulary);

  const blocks: ProjectReviewContext['blocks'] = [];
  const coverageSources: CoverageSource[] = [];

  // 1 — every component, one line each. Never refused: this is the floor.
  blocks.push({ heading: 'PROJECT OVERVIEW', body: builder.projectOverview() });
  coverageSources.push({
    name: 'Component list and interfaces',
    status: 'included',
    detail: `${graph.components.length} component${graph.components.length === 1 ? '' : 's'}`
  });

  // 2 — the page map.
  const pageMap = buildPageMap(graph, sources.declaredRoutes);
  blocks.push({ heading: 'PAGES AND NAVIGATION', body: builder.reviewSource('page-map', renderPageMap(pageMap)) });
  coverageSources.push(pageMapCoverage(pageMap, Boolean(sources.declaredRoutes?.length)));

  // 3 — backend.
  const backendText = renderBackend(sources.backend);
  blocks.push({ heading: 'BACKEND AND DATA MODEL', body: builder.reviewSource('backend', backendText) });
  coverageSources.push(backendCoverage(sources.backend));

  // 4 — style vocabulary. Names only; the renderer already keeps it compact.
  if (sources.styleVocabulary) {
    blocks.push({ heading: 'STYLE VOCABULARY', body: builder.styleVocabulary() });
    coverageSources.push({ name: 'Style tokens and variants', status: 'included' });
  } else {
    coverageSources.push({
      name: 'Style tokens and variants',
      status: 'absent',
      detail: 'no style vocabulary was supplied'
    });
  }

  // 5 — full reads, highest signal first, until the budget says stop.
  const ranking = rankComponents(graph, pageMap, sources.rootComponent);
  const { read, notRead, reads } = readComponents(builder, graph, ranking, budget, reserve);

  // The node vocabulary is hoisted out of the reads and deduplicated — see
  // ./componentReads for the measurement that made this the right shape. It goes
  // BEFORE the reads: it is what makes them legible.
  if (reads.length > 0) {
    blocks.push({
      heading: 'NODE TYPES USED IN THIS PROJECT',
      body: builder.reviewSource('node-vocabulary', renderNodeVocabulary(mergeNodeTypes(reads)))
    });
    blocks.push({
      heading: 'COMPONENTS READ IN FULL',
      body: reads.map((r) => `### ${r.name} — ${r.reason}\n${r.body}`).join('\n\n')
    });
  }

  const coverage: ProjectReviewCoverage = {
    componentsTotal: graph.components.length,
    nodesTotal: graph.components.reduce((sum, c) => sum + c.nodes.length, 0),
    read,
    notRead,
    sources: coverageSources,
    charsUsed: builder.totalChars(),
    charsBudget: budget.maxChars,
    log: [...builder.log]
  };

  return { blocks, pageMap, ranking, coverage };
}

/**
 * Read down the ranking until the read cap or the char budget bites, then record
 * every remaining component as explicitly not read — with the reason, so
 * "budget" and "too small to matter" stay distinguishable in the review UI.
 */
function readComponents(
  builder: AuthoringContextBuilder,
  graph: ExplainGraph,
  ranking: readonly RankedComponent[],
  budget: ContextBudget,
  reserve: number
): { read: CoverageRead[]; notRead: CoverageSkipped[]; reads: ComponentRead[] } {
  const read: CoverageRead[] = [];
  const notRead: CoverageSkipped[] = [];
  const reads: ComponentRead[] = [];
  let stopped: string | undefined;

  for (const component of ranking) {
    if (stopped) {
      notRead.push({ name: component.name, reason: stopped });
      continue;
    }
    if (component.nodeCount <= TRIVIAL_NODE_COUNT) {
      notRead.push({
        name: component.name,
        reason: `only ${component.nodeCount} node(s) — the interface line says it all`
      });
      continue;
    }
    if (reads.length >= budget.maxComponentReads) {
      stopped = `not read — the ${budget.maxComponentReads}-component read limit was reached above it`;
      notRead.push({ name: component.name, reason: stopped });
      continue;
    }
    if (builder.totalChars() + reserve >= budget.maxChars) {
      stopped = 'not read — the context budget ran out at a higher-ranked component';
      notRead.push({ name: component.name, reason: stopped });
      continue;
    }

    const result = readComponentForReview(graph, component.name);
    if (!result) {
      notRead.push({ name: component.name, reason: 'the component could not be assembled' });
      continue;
    }

    // Charged through the builder like every other handout, so one log and one
    // budget cover the whole review. `charge` logs a refusal with `chars: 0` and
    // returns the budget message instead of the text, so a zero charge is the
    // refusal — no need to inspect what came back.
    const before = builder.totalChars();
    builder.reviewSource(`component:${result.name}`, result.body);
    const chars = builder.totalChars() - before;
    if (chars === 0) {
      stopped = 'not read — the context budget ran out at a higher-ranked component';
      notRead.push({ name: component.name, reason: stopped });
      continue;
    }
    reads.push({ ...result, reason: component.reason });
    read.push({ name: result.name, reason: component.reason, chars });
  }

  return { read, notRead, reads };
}

// ── Backend ───────────────────────────────────────────────────────────────────

/**
 * Configured services and the real schema. When the schema could not be read at
 * all, this says so in those words: "no collections" and "we could not look" are
 * different facts, and only one of them licenses a sentence about the data model.
 */
export function renderBackend(backend: BackendSummary | undefined): string {
  if (!backend) {
    return [
      'No backend information was available to this review.',
      'You cannot tell from here whether this project has a backend. Do not assert either way.'
    ].join('\n');
  }

  const lines: string[] = [];

  if (backend.cloud) {
    const kind =
      backend.cloud.type === 'nodegx'
        ? 'the built-in NodeGX backend'
        : backend.cloud.type === 'external'
          ? 'an external Parse-compatible backend'
          : 'a backend of unrecorded type';
    lines.push(`Cloud services: ${kind}${backend.cloud.endpoint ? ` at ${backend.cloud.endpoint}` : ''}.`);
  }

  for (const service of backend.services) {
    lines.push(`Backend service: "${service.name}" (${service.type})${service.url ? ` at ${service.url}` : ''}.`);
  }

  if (!backend.schemaAvailable) {
    lines.push(
      '',
      `The data model could not be read${backend.schemaNote ? ` — ${backend.schemaNote}` : ''}.`,
      'This is NOT evidence that the project has no collections. Anything you would say about the data model',
      'must be written as a TODO for the human to confirm.'
    );
  } else if (backend.collections.length === 0) {
    lines.push('', 'The backend reports no collections. This project stores nothing server-side.');
  } else {
    lines.push('', `Collections (${backend.collections.length}), with their real fields:`);
    for (const collection of backend.collections) {
      lines.push(`- ${collection.name}`);
      for (const field of collection.fields) {
        lines.push(`  - ${field.name}: ${field.type}${field.targetClass ? ` → ${field.targetClass}` : ''}`);
      }
    }
    lines.push(
      '',
      'These names and types are read from the live backend schema. Use them verbatim; do not invent fields.'
    );
  }

  if (lines.length === 0) return 'This project has no backend configured.';
  return lines.join('\n');
}

function backendCoverage(backend: BackendSummary | undefined): CoverageSource {
  if (!backend) {
    return { name: 'Backend and data model', status: 'absent', detail: 'not collected' };
  }
  if (!backend.schemaAvailable) {
    return { name: 'Backend and data model', status: 'refused', detail: backend.schemaNote ?? 'schema unavailable' };
  }
  const services = backend.services.length + (backend.cloud ? 1 : 0);
  return {
    name: 'Backend and data model',
    status: 'included',
    detail: `${backend.collections.length} collection(s), ${services} configured service(s)`
  };
}

function pageMapCoverage(pageMap: ReturnType<typeof buildPageMap>, hadRoutesFile: boolean): CoverageSource {
  if (pageMap.pages.length === 0 && pageMap.routers.length === 0) {
    return { name: 'Pages and navigation', status: 'absent', detail: 'this project declares no routing' };
  }
  const onlyGuessed = pageMap.sources.every((s) => s === 'name-convention');
  return {
    name: 'Pages and navigation',
    status: onlyGuessed ? 'inferred' : 'included',
    detail: hadRoutesFile
      ? `${pageMap.pages.length} page(s), from the declared routes file`
      : `${pageMap.pages.length} page(s), from ${onlyGuessed ? 'component names only' : 'Router and Page nodes'}`
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/** The reference material, in order, as one prompt block. */
export function renderProjectReviewContext(context: ProjectReviewContext): string {
  return context.blocks
    .map((block) => `--- ${block.heading} ---\n${block.body}\n--- END ${block.heading} ---`)
    .join('\n\n');
}

/**
 * Coverage as prompt text.
 *
 * This block is the reason criterion 3 is achievable at all. A model that
 * believes it has seen the project writes confident prose about it; a model told
 * "you read 8 of 55 components, and here are the 47 you did not" writes
 * `> TODO:` where it should. The same object renders for the user in the panel,
 * so the two audiences cannot be told different stories.
 */
export function renderCoverageForPrompt(coverage: ProjectReviewCoverage, maxListed = 25): string {
  const lines: string[] = [
    `This project has ${coverage.componentsTotal} components and ${coverage.nodesTotal} nodes in total.`,
    `You were given the interface of every component, and the full graph of ${coverage.read.length}.`
  ];

  if (coverage.read.length > 0) {
    lines.push('', 'Read in full:');
    for (const entry of coverage.read) lines.push(`- ${entry.name} (${entry.reason})`);
  }

  const meaningful = coverage.notRead;
  if (meaningful.length > 0) {
    lines.push('', `NOT read (${meaningful.length}) — you have only a one-line interface for these:`);
    for (const entry of meaningful.slice(0, maxListed)) lines.push(`- ${entry.name}: ${entry.reason}`);
    if (meaningful.length > maxListed) lines.push(`- … and ${meaningful.length - maxListed} more`);
  }

  const notable = coverage.sources.filter((s) => s.status !== 'included');
  if (notable.length > 0) {
    lines.push('', 'Material that was unavailable or inferred:');
    for (const source of notable) lines.push(`- ${source.name}: ${source.status}${source.detail ? ` — ${source.detail}` : ''}`);
  }

  lines.push(
    '',
    'Write nothing about a component you did not read as though you had read it. Where the answer depends on',
    'something in this list, write a TODO line asking the human instead of guessing.'
  );
  return lines.join('\n');
}

/** One line, for a panel header or a log. */
export function summariseCoverage(coverage: ProjectReviewCoverage): string {
  const notRead = coverage.componentsTotal - coverage.read.length;
  return (
    `Read ${coverage.read.length} of ${coverage.componentsTotal} components in full` +
    (notRead > 0 ? `; ${notRead} were not read` : '') +
    ` · ${coverage.charsUsed.toLocaleString()} of ${coverage.charsBudget.toLocaleString()} context characters used`
  );
}
