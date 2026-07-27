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
import { assembleContext, ExplainContextError } from '../explain/assemble';
import { componentPorts, findComponent } from '../explain/graph';
import { renderContext } from '../explain/render';
import type { ExplainGraph } from '../explain/types';
import type { ComponentFiles, ContextBudget, ContextLogEntry } from './types';

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

  constructor(
    private readonly graph: ExplainGraph,
    budget: Partial<ContextBudget> = {},
    private readonly catalog: CatalogIndex = loadDefaultCatalog(),
    styleVocab?: StyleVocabulary
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    // Defaults-only when no project-aware vocabulary is injected: the token
    // NAMES the agent references are stable across projects; only overridden
    // values differ, and the agent emits names, not values.
    this.styleVocab = styleVocab ?? buildStyleVocabulary();
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
   * The project's style vocabulary — token names by category and the legal
   * variants/sizes per element — rendered compactly and charged like any
   * handout. Category summaries (names only, no resolved values) keep it inside
   * the structural budget; `elementTypes` spells out variant styles only for the
   * elements in play. AIX-006.
   */
  styleVocabulary(elementTypes?: string[]): string {
    return this.charge('style-vocabulary', renderStyleVocabulary(this.styleVocab, { elementTypes }));
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
    const summary = enriched?.summary ?? node.shortDesc;
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
}
