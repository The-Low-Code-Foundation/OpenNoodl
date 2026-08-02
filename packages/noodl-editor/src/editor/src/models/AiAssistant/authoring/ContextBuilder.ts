/**
 * AIX-002 — The Authoring Loop: context builder
 *
 * Everything the agent is allowed to see passes through here, and every handout
 * is charged against a hard budget and logged. There is deliberately no method
 * that returns more than one component — "the agent never receives the whole
 * project" is enforced by this class's surface, not by prompt discipline.
 *
 * Reuses AIX-004's bounded assembly (`assembleContext` + `renderContext`) for
 * full component reads, so a component the agent inspects is bounded the same
 * way an explanation is.
 *
 * @module AiAssistant/authoring/ContextBuilder
 */

import { CatalogIndex, loadDefaultCatalog } from '../../../validation';
import type { CatalogNode, CatalogPort } from '../../../validation';
import { enrichedNode, portDescription } from '../../../validation/enrichedCatalog';
import type { NodeV2 } from '../../../schemas';
// Pure StyleVocabulary submodule (never the StyleTokensModel barrel — it would
// pull ProjectModel/Electron into the headless harness bundle).
import { buildStyleVocabulary, renderStyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
import type { StyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
// Pure ProjectDocs submodule, for the same reason as StyleVocabulary above —
// the barrel would drag ProjectModel and the platform filesystem in.
import { KNOWN_DOCS, renderDocForPrompt } from '../../ProjectDocs/docsText';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import { assembleContext, ExplainContextError } from '../explain/assemble';
import { componentPorts, findComponent } from '../explain/graph';
import { renderContext } from '../explain/render';
import type { ExplainGraph } from '../explain/types';
import type { ComponentFiles, ContextBudget, ContextLogEntry, RegisteredLibraryInfo } from './types';

export const DEFAULT_BUDGET: ContextBudget = {
  maxChars: 120_000,
  maxComponentReads: 6
};

/** What the agent is told when a handout would blow the budget. */
const BUDGET_REFUSAL =
  '[context budget exhausted — no more project context is available; proceed with what you already have]';

const MAX_PORTS_PER_PLUG = 40;
const MAX_INTERFACE_PORTS = 12;

function portLine(typeName: string, port: CatalogPort): string {
  const type = CatalogIndex.portTypeName(port) ?? '*';
  const signal = port.isSignal ? ', signal' : '';
  const description = port.description ?? portDescription(typeName, port.name);
  const defaultValue =
    port.default !== undefined && port.default !== null && port.default !== ''
      ? ` [default: ${JSON.stringify(port.default)}]`
      : '';
  return `  - ${port.name} (${type}${signal})${description ? `: ${description}` : ''}${defaultValue}`;
}

function portSection(typeName: string, heading: string, ports: CatalogPort[]): string[] {
  if (ports.length === 0) return [];
  const shown = ports.slice(0, MAX_PORTS_PER_PLUG);
  const lines = [`${heading}:`, ...shown.map((p) => portLine(typeName, p))];
  if (ports.length > shown.length) {
    lines.push(`  … ${ports.length - shown.length} more ${heading.toLowerCase()} omitted`);
  }
  return lines;
}

export class AuthoringContextBuilder {
  readonly budget: ContextBudget;
  private readonly entries: ContextLogEntry[] = [];
  private componentReads = 0;

  /** The project's style vocabulary — tokens by category + element variants/sizes. */
  readonly styleVocab: StyleVocabulary;

  /** AIX-009: the project's `docs/` bodies. Empty object = project has no docs. */
  readonly docs: ProjectDocsContent;

  /** ERG-002: registered `noodl_modules` libraries — see `libraryOverview()`. */
  private readonly libraries: RegisteredLibraryInfo[];

  constructor(
    private readonly graph: ExplainGraph,
    budget: Partial<ContextBudget> = {},
    private readonly catalog: CatalogIndex = loadDefaultCatalog(),
    styleVocab?: StyleVocabulary,
    docs: ProjectDocsContent = {},
    libraries: RegisteredLibraryInfo[] = []
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    // Defaults-only when no project-aware vocabulary is injected: the token
    // NAMES the agent references are stable across projects; only overridden
    // values differ, and the agent emits names, not values.
    this.styleVocab = styleVocab ?? buildStyleVocabulary();
    this.docs = docs;
    this.libraries = libraries;
  }

  get log(): readonly ContextLogEntry[] {
    return this.entries;
  }

  totalChars(): number {
    return this.entries.reduce((sum, e) => sum + e.chars, 0);
  }

  /** Charge a handout against the budget; refuse (and log the refusal) when over. */
  private charge(source: string, text: string): string {
    if (this.totalChars() + text.length > this.budget.maxChars) {
      this.entries.push({ source, chars: 0, refused: true });
      return BUDGET_REFUSAL;
    }
    this.entries.push({ source, chars: text.length });
    return text;
  }

  // ── Handouts ────────────────────────────────────────────────────────────────

  /**
   * One line per component: name, size, interface. Enough to know what exists
   * and what can be instantiated — nothing about any component's interior.
   */
  projectOverview(): string {
    const lines: string[] = [`The project has ${this.graph.components.length} components:`];
    for (const component of this.graph.components) {
      const { inputPorts, outputPorts } = componentPorts(component);
      const parts = [`- ${component.name} — ${component.nodes.length} nodes`];
      if (inputPorts.length > 0) parts.push(`in: [${inputPorts.slice(0, MAX_INTERFACE_PORTS).join(', ')}]`);
      if (outputPorts.length > 0) parts.push(`out: [${outputPorts.slice(0, MAX_INTERFACE_PORTS).join(', ')}]`);
      lines.push(parts.join(' | '));
    }
    return this.charge('project-overview', lines.join('\n'));
  }

  /** Authorable node types grouped by category — names only; detail is on demand. */
  catalogOverview(): string {
    const byCategory = new Map<string, string[]>();
    for (const typeName of this.catalog.authorableTypeNames()) {
      const category = this.catalog.getNode(typeName)?.category ?? 'Other';
      const names = byCategory.get(category) ?? [];
      names.push(typeName);
      byCategory.set(category, names);
    }
    const lines: string[] = ['Available node types by category (call get_node_types for ports and usage):'];
    for (const category of [...byCategory.keys()].sort()) {
      lines.push(`- ${category}: ${byCategory.get(category)!.join(', ')}`);
    }
    return this.charge('catalog-overview', lines.join('\n'));
  }

  /**
   * ERG-002 §2, finding #5: "'Use PocketBase for this' is unanswerable
   * because the registered libraries are not in the context the loop reads."
   * One line per library registered via the Libraries settings section
   * (`registerLibrary`), naming the global it's safe to reference from a
   * Function/Script node — the same information §2 asks be surfaced to the
   * code editors, told here instead of inferred from a head-code string the
   * agent cannot reliably parse. Returns `undefined` (never charged) when the
   * project has none, matching `docHandout`'s convention for an absent
   * section rather than emitting an empty heading.
   */
  libraryOverview(): string | undefined {
    if (this.libraries.length === 0) return undefined;
    const lines: string[] = [
      'Registered external libraries (Settings → Libraries). Each is already loaded via a <script> tag; ' +
        'reference the global directly in a Function or Script node, no import/require:'
    ];
    for (const lib of this.libraries) {
      lines.push(`- ${lib.name} — global \`${lib.global}\``);
    }
    return this.charge('library-overview', lines.join('\n'));
  }

  /**
   * The project's style vocabulary — token names by category and the legal
   * variants/sizes per element — rendered compactly and charged like any
   * handout. Category summaries (names only, no resolved values) keep it inside
   * the structural budget; `elementTypes` spells out variant styles only for the
   * elements in play. AIX-006.
   */
  styleVocabulary(elementTypes?: string[]): string {
    return this.charge('style-vocabulary', renderStyleVocabulary(this.styleVocab, { elementTypes }));
  }

  /**
   * AIX-009 — `docs/CONVENTIONS.md`: the rules this project's assistant must
   * follow. Injected by default on every authoring turn, because a convention
   * the agent has to *ask* for is a convention it will not follow.
   *
   * Hard-capped ahead of the shared budget (`DOC_CAPS.conventions`) so prose can
   * never squeeze out component reads, and truncation is stated in the injected
   * text rather than dropped silently — a half-read rule is worse than a missing
   * one. Returns `undefined` when the project has no CONVENTIONS.md, so the
   * prompt omits the block entirely instead of carrying an empty heading.
   */
  projectConventions(): string | undefined {
    return this.docHandout('conventions', 'project-conventions');
  }

  /** AIX-009 — `docs/BRIEF.md`: what the app is, for whom, and what it is not. */
  projectBrief(): string | undefined {
    return this.docHandout('brief', 'project-brief');
  }

  /**
   * AIX-009 — `docs/ARCHITECTURE.md`, pull-only via `get_project_doc`.
   *
   * It is the largest of the three and is not needed on most turns. Making the
   * agent ask keeps the default turn cheap and — the reason it is not merely an
   * economy — keeps AIX-007's cache-stable prefix the same size on every turn of
   * every session in a project.
   */
  projectArchitecture(): string {
    return (
      this.docHandout('architecture', 'project-doc:ARCHITECTURE.md') ??
      'This project has no docs/ARCHITECTURE.md. Work from the project overview and the component interfaces.'
    );
  }

  /**
   * AIX-011 criterion 7 — an arbitrary doc body handed to the doc-authoring
   * turn as its subject rather than as reference material.
   *
   * Separate from `docHandout` because the caller has already capped it (a doc
   * being *edited* is capped by its own known cap, or by the doc session's cap
   * for a path the system does not know), and because it must be charged and
   * logged under its own path: the doc turn's cost belongs against the document
   * it rewrote, not against a generic 'project-doc' bucket.
   */
  docSource(path: string, rendered: string): string {
    return this.charge(`doc-source:${path}`, rendered);
  }

  /** Cap, render and charge one known doc. */
  private docHandout(kind: 'conventions' | 'brief' | 'architecture', source: string): string | undefined {
    const body = this.docs[kind];
    if (body === undefined || !body.trim()) return undefined;
    const doc = KNOWN_DOCS.find((d) => d.kind === kind)!;
    return this.charge(source, renderDocForPrompt(doc, body));
  }

  /** Full documentation for a batch of node types, in one charged handout. */
  nodeTypeDetails(typeNames: string[]): string {
    const sections = typeNames.map((name) => this.renderNodeType(name));
    return this.charge(`types:${typeNames.join(',')}`, sections.join('\n\n'));
  }

  private renderNodeType(typeName: string): string {
    const node: CatalogNode | undefined = this.catalog.getNode(typeName);
    if (!node) {
      const suggestion = this.catalog.suggestType(typeName);
      return `Unknown node type "${typeName}".${suggestion ? ` Did you mean "${suggestion}"?` : ''}`;
    }
    const enriched = enrichedNode(typeName)?.enrichment;
    const lines: string[] = [`### ${typeName}${node.category ? ` (${node.category})` : ''}`];
    if (node.isVisual) lines.push('Visual node — place it in the visual hierarchy via `parent`.');
    const summary = enriched?.summary;
    if (summary) lines.push(summary);
    if (enriched?.description && enriched.description !== summary) lines.push(enriched.description);
    if (enriched?.whenToUse) lines.push(`When to use: ${enriched.whenToUse}`);
    if (enriched?.runtimeBehavior) lines.push(`Runtime behavior: ${enriched.runtimeBehavior}`);
    lines.push(...portSection(typeName, 'Inputs', node.inputs));
    lines.push(...portSection(typeName, 'Outputs', node.outputs));
    const dynamicNote = this.catalog.dynamicPortNote(typeName);
    if (dynamicNote) lines.push(`Dynamic ports: ${dynamicNote}`);
    return lines.join('\n');
  }

  /**
   * The component under revision, rendered in the exact shape a submission
   * uses (`parent` fields, no children arrays; only submit-expressible node
   * fields) so the agent can start from it and keep ids verbatim. Charged
   * like every handout — an update begins by ingesting its own subject, and
   * that cost belongs in the log.
   */
  currentComponentSource(files: ComponentFiles): string {
    const nodes = files.nodes.nodes.map((n: NodeV2) => ({
      id: n.id,
      type: n.type,
      ...(n.label !== undefined ? { label: n.label } : {}),
      ...(n.x !== undefined ? { x: n.x } : {}),
      ...(n.y !== undefined ? { y: n.y } : {}),
      ...(n.parent !== undefined ? { parent: n.parent } : {}),
      ...(n.parameters && Object.keys(n.parameters).length > 0 ? { parameters: n.parameters } : {}),
      ...(n.ports && n.ports.length > 0 ? { ports: n.ports } : {})
    }));
    const source = JSON.stringify(
      {
        nodes,
        connections: files.connections.connections.map((c) => ({
          fromId: c.fromId,
          fromProperty: c.fromProperty,
          toId: c.toId,
          toProperty: c.toProperty
        })),
        ...(files.nodes.visualRoots?.length ? { visual_roots: files.nodes.visualRoots } : {}),
        ...(files.component.description ? { description: files.component.description } : {})
      },
      null,
      1
    );
    return this.charge('current-component', source);
  }

  /**
   * One existing component's bounded graph — the same rendering an explanation
   * gets. Capped in count as well as size: reading many components in full is
   * how a "bounded" loop quietly ingests the project.
   */
  componentContext(name: string): string {
    const component = findComponent(this.graph, name);
    if (!component) {
      this.entries.push({ source: `component:${name}`, chars: 0, refused: true });
      return `Unknown component "${name}". Component names are listed in the project overview.`;
    }
    if (this.componentReads >= this.budget.maxComponentReads) {
      this.entries.push({ source: `component:${component.name}`, chars: 0, refused: true });
      return (
        `[component read limit reached (${this.budget.maxComponentReads}) — ` +
        'work from the interfaces in the project overview]'
      );
    }
    try {
      const context = assembleContext(this.graph, { scope: 'component', componentName: component.name });
      const rendered = renderContext(context);
      this.componentReads++;
      return this.charge(`component:${component.name}`, rendered);
    } catch (error) {
      if (error instanceof ExplainContextError) {
        this.entries.push({ source: `component:${component.name}`, chars: 0, refused: true });
        return `Could not read component "${component.name}": ${error.message}`;
      }
      throw error;
    }
  }

  /**
   * AIX-011: the plan an operation belongs to — sibling operations' kinds,
   * targets and *intents* (rendered by `renderPlanContext`; never a graph).
   * Charged like every handout, so a plan's overhead shows in the log.
   */
  planContext(rendered: string): string {
    return this.charge('plan-context', rendered);
  }

  /**
   * AIX-010: one project-scope reference block (the page map, the backend
   * schema) rendered by the review assembler and charged here.
   *
   * Appended at the end of the class, and never called by any authoring or
   * planning path — the AIX-007 cache prefix is a property of the *order the
   * opening turn calls these methods in*, and the review turn is not that turn.
   * A review builds its own throwaway builder, so nothing it charges can
   * displace a byte of an authoring session's cached prefix.
   */
  reviewSource(source: string, text: string): string {
    return this.charge(`review:${source}`, text);
  }
}
