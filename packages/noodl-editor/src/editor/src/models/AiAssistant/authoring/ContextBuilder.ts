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

import type { NodeV2 } from '../../../schemas';
import { renderReportForAssistant } from '../../../utils/import-engine/legacy/report';
import type { ImportReport } from '../../../utils/import-engine/legacy/types';
import {
  CatalogIndex,
  loadDefaultCatalog,
  unfoldNodeComment,
  wireFormatHint,
  WIRE_FORMAT_LEGEND,
  type CatalogNode,
  type CatalogPort
} from '../../../validation';
import { enrichedNode, portDescription } from '../../../validation/enrichedCatalog';
// Pure ProjectDocs submodule, for the same reason as StyleVocabulary above —
// the barrel would drag ProjectModel and the platform filesystem in.
import {
  describeDoc,
  KNOWN_DOCS,
  renderDocForPrompt,
  type DiscoveredDoc,
  type ProjectDocsContent
} from '../../ProjectDocs/docsText';
// Pure StyleVocabulary submodule (never the StyleTokensModel barrel — it would
// pull ProjectModel/Electron into the headless harness bundle).
import {
  buildStyleVocabulary,
  renderStyleVocabulary,
  type StyleVocabulary
} from '../../StyleTokensModel/StyleVocabulary';
import { assembleContext, ExplainContextError } from '../explain/assemble';
import { renderBackendSchema, type SchemaCollectionInfo } from './backendSchema';
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

/**
 * CN-008 — the ports the **runtime** puts on every React kit node, which the
 * kit's author did not write and the model does not need told per node.
 *
 * Ground truth is `react-component-node.ts`'s standard `inputs`/`outputs`
 * blocks (`packages/noodl-viewer-react/src/react-component-node.ts:946-1078`),
 * plus `mounted` (omitted only by `mountedInput: false`) and `variant`
 * (`useVariants`). Subtracting them takes the demo kit's `Badge` from 12 inputs
 * and 9 outputs to the **8 and 1 its author actually declared**.
 *
 * 🔴 **Deliberately a named set and not an intersection over the catalog.**
 * Deriving "the ports every visual node has" from the shipped catalog yields
 * the **empty set** — `Component Children` is a visual node with zero inputs,
 * so it empties any intersection (measured). And an intersection over the
 * *project's* kit nodes is worse than useless: across the two demo-kit nodes it
 * would also swallow `radius`, which both authors declared and both meant.
 *
 * ⚠️ The gate that keeps this honest asserts **containment** — every name here
 * is present on every kit node in the recorded payload — which catches the
 * runtime dropping one. It cannot catch the runtime *adding* one; that surfaces
 * as a stray inherited port in the handout, not as a wrong answer.
 */
export const KIT_BASE_INPUT_PORTS = new Set(['cssClassName', 'styleCss', 'mounted', 'variant']);
export const KIT_BASE_OUTPUT_PORTS = new Set([
  'childIndex',
  'this',
  'screenPositionX',
  'screenPositionY',
  'boundingWidth',
  'boundingHeight',
  'didMount',
  'willUnmount'
]);

/** Ports named on one line of the kit handout before it defers to `get_node_types`. */
const MAX_KIT_PORTS_PER_PLUG = 14;

/**
 * How many kit node types the handout will name before it stops and says so.
 *
 * The two kits this phase has cost ~2 and ~5 nodes; the cap exists for the
 * 40-node kit the task asked us to decide about **before a user finds one**.
 * Overflow is stated in the text rather than dropped — a silently short list of
 * a project's own nodes is indistinguishable from a project that does not have
 * them, which is the exact failure this handout exists to fix.
 */
const MAX_KIT_NODES = 30;

/**
 * One port, as the agent is shown it.
 *
 * AIB-001 slice 2: the line carries the port's **wire format**, not only its
 * type name. A model reading `pathParams (stringlist)` emits a JSON array —
 * which is the correct reading of the words it was given, and which threw a
 * `TypeError` out of an adapter mid-apply and cost a user 44 authored nodes.
 * The format comes from the same table the validator enforces
 * (`wireFormatHint`), so what the agent is told and what the gate demands
 * cannot drift apart.
 *
 * Only the types whose format a name does not imply carry a hint, so `string`,
 * `boolean` and the rest pay no prompt bytes for this — the 249 `enum` ports,
 * whose legal options were previously pure guesswork, pay the most and are
 * worth the most.
 */
function portLine(typeName: string, port: CatalogPort): string {
  const type = CatalogIndex.portTypeName(port) ?? '*';
  const signal = port.isSignal ? ', signal' : '';
  const format = wireFormatHint(port);
  const description = port.description ?? portDescription(typeName, port.name);
  const defaultValue =
    port.default !== undefined && port.default !== null && port.default !== ''
      ? ` [default: ${JSON.stringify(port.default)}]`
      : '';
  return `  - ${port.name} (${type}${format ? ` — ${format}` : ''}${signal})${
    description ? `: ${description}` : ''
  }${defaultValue}`;
}

/**
 * CN-008 — a kit author's own sentence about a node, or `undefined`.
 *
 * 🔴 **`docs` is one field name over two vocabularies, and the task's spec
 * assumed the wrong one.** CN-008 asked for "the `docs` string authors already
 * write". On a **shipped** catalog node `docs` is a *URL*: 158 of 175 built-ins
 * carry one and **158 of 158 of those are `https://docs.noodl.net/…`** — zero
 * are prose. On a **kit** node it is prose, because that is what the runtime's
 * definition shape means by it (`'A labelled badge that can show a
 * percentage.'`). Reading the field without splitting the two would put a
 * docs.noodl.net URL where a summary goes on 158 node types, and teach the
 * model to cite links instead of describing behaviour.
 *
 * So callers gate on provenance — and this rejects a URL anyway, so that a
 * caller which forgets cannot emit one. Both halves are asserted.
 *
 * ⚠️ **Nothing produces this string on the path the phase sends authors down.**
 * `@nodegx/kit-scaffold` emits no `docs` key at all (measured in s15, still
 * true), so a scaffolded node has no purpose line here and its picker preview
 * reads "No documentation yet." The cashflow kit has one on all five nodes only
 * because it was hand-written. Absent is therefore the *common* case and is
 * rendered as omission, never as an empty sentence — see the note in
 * [CN-008](../../../../../../../dev-docs/tasks/phase-69-the-node-you-write-yourself/CN-008-THE-AI-CAN-USE-YOUR-NODES.md).
 */
function kitDocs(node: CatalogNode): string | undefined {
  const docs = (node as { docs?: unknown }).docs;
  if (typeof docs !== 'string') return undefined;
  const trimmed = docs.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
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

  /** LIB-006: the open project's import report — see `importReport()`. */
  private readonly report: ImportReport | undefined;

  /** AAQ-002 slice 4: the collections the agent may write against. */
  private readonly collections: SchemaCollectionInfo[];

  constructor(
    private readonly graph: ExplainGraph,
    budget: Partial<ContextBudget> = {},
    private readonly catalog: CatalogIndex = loadDefaultCatalog(),
    styleVocab?: StyleVocabulary,
    docs: ProjectDocsContent = {},
    libraries: RegisteredLibraryInfo[] = [],
    report?: ImportReport,
    collections: SchemaCollectionInfo[] = []
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    // Defaults-only when no project-aware vocabulary is injected: the token
    // NAMES the agent references are stable across projects; only overridden
    // values differ, and the agent emits names, not values.
    this.styleVocab = styleVocab ?? buildStyleVocabulary();
    this.docs = docs;
    this.libraries = libraries;
    this.report = report;
    this.collections = collections;
  }

  get log(): readonly ContextLogEntry[] {
    return this.entries;
  }

  /**
   * FIX-014 — the catalog's answer to "does a node of this type draw?", for
   * the layout pass. `false` for a component instance (the catalog has never
   * heard of one); the pass classifies those by tree membership instead.
   */
  isVisualType(typeName: string): boolean {
    return this.catalog.getNode(typeName)?.isVisual === true;
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
   * CN-008 — the node types **this project's own kits** provide, grouped and
   * named by kit.
   *
   * ## 🔴 What was actually missing, which is not what the task said
   *
   * CN-008's problem statement was that "the AI does not know the lane exists".
   * Measured before building: **it does.** A kit node is `inNodePicker`, so
   * `catalogOverview()` already names it, and `nodeTypeDetails()` already
   * renders its full ports, defaults and descriptions. What the loop could not
   * do was *tell it apart from a built-in*: `demo.kit.Meter` arrives buried in
   * an alphabetical run of ~30 names on the `- Visual:` line, with no kit named
   * anywhere in the prompt, no display name, and nothing saying the user wrote
   * it for this project.
   *
   * So this handout is about **salience and attribution, not existence** — and
   * that is why it names ports rather than describing them. Duplicating what
   * `get_node_types` already answers correctly for kit types would be paying
   * twice for the half that was never broken.
   *
   * ## The port list, and the clause that would have shipped an empty one
   *
   * 🔴 The task said to include "the inputs with no default". **That selector
   * matches zero ports on either kit in this phase** — a kit author declares a
   * `default` on essentially every port, and ✅ **D8** pushes them harder that
   * way by making token defaults the scaffold's norm. Following it literally
   * would have printed a heading, a kit name and a node name per node with an
   * empty port list under each, while `charge()` reported a cost and every
   * mechanical acceptance criterion passed. What discriminates instead is
   * {@link KIT_BASE_INPUT_PORTS} — the ports the *runtime* adds.
   *
   * ✅ **P1**: the text says these are ordinary nodes, because they are — the
   * one thing the model must not learn here is that a kit node is placed,
   * wired or parameterised differently. ✅ **P2**: it says to set ports and not
   * to touch the kit's JavaScript, which is the same rule the docs teach.
   *
   * Returns `undefined` (never charged) for a project with no kits, matching
   * `libraryOverview`'s absent-means-omitted convention — such a project sends
   * a byte-identical turn to before this existed.
   */
  nodeKitOverview(): string | undefined {
    const typeNames = this.catalog.projectKitTypeNames();
    if (typeNames.length === 0) return undefined;

    // Grouped by kit so the handout can attribute; a kit whose name the viewer
    // could not resolve keeps its own group rather than being merged into a
    // neighbour's, for the same reason CN-018 kept `'Unknown Module'` a real
    // group in the picker — merging invents an authorship claim.
    const byKit = new Map<string, string[]>();
    for (const typeName of typeNames.slice(0, MAX_KIT_NODES)) {
      const kit = this.catalog.kitModuleOf(typeName) ?? 'Unknown Module';
      const names = byKit.get(kit) ?? [];
      names.push(typeName);
      byKit.set(kit, names);
    }

    const lines: string[] = [
      "Node types this project's own kits provide. They are ordinary nodes: place, wire and parameterise " +
        'them exactly as you would a built-in, and call get_node_types for a full port list with defaults.',
      'Prefer one of these over rebuilding the same thing out of Group/Text — the user wrote them for this ' +
        "project. Configure them through their PORTS; never propose editing a kit's JavaScript."
    ];
    for (const kit of [...byKit.keys()].sort()) {
      lines.push('', kit);
      for (const typeName of byKit.get(kit)!) {
        lines.push(...this.kitNodeLines(typeName));
      }
    }
    if (typeNames.length > MAX_KIT_NODES) {
      lines.push(
        '',
        `… ${typeNames.length - MAX_KIT_NODES} further kit node types are installed but not listed here. ` +
          'They are in the node catalog above; call get_node_types for any of them.'
      );
    }
    return this.charge('node-kit-overview', lines.join('\n'));
  }

  /** One kit node: what it is, what it is for, and the ports its author declared. */
  private kitNodeLines(typeName: string): string[] {
    const node = this.catalog.getNode(typeName);
    if (!node) return [];
    const display = node.displayName && node.displayName !== typeName ? ` — "${node.displayName}"` : '';
    const kind = node.isVisual ? 'visual' : 'logic';
    // The kit author's own sentence about the node. See `kitDocs` for why this
    // field cannot be read the same way for a built-in.
    const purpose = kitDocs(node);
    const lines = [`- ${typeName}${display} (${kind})${purpose ? `. ${purpose}` : ''}`];
    const inputs = node.inputs.filter((p) => !KIT_BASE_INPUT_PORTS.has(p.name));
    const outputs = node.outputs.filter((p) => !KIT_BASE_OUTPUT_PORTS.has(p.name));
    const named = (ports: CatalogPort[]): string => {
      const shown = ports.slice(0, MAX_KIT_PORTS_PER_PLUG);
      const rendered = shown
        .map((p) => {
          const type = CatalogIndex.portTypeName(p) ?? '*';
          // A signal port's type name is already `signal`; `(signal, signal)`
          // is the reading of `portLine`'s rule that this line does not need.
          return `${p.name} (${type}${p.isSignal && type !== 'signal' ? ', signal' : ''})`;
        })
        .join(', ');
      return ports.length > shown.length ? `${rendered}, … ${ports.length - shown.length} more` : rendered;
    };
    if (inputs.length > 0) lines.push(`    inputs: ${named(inputs)}`);
    if (outputs.length > 0) lines.push(`    outputs: ${named(outputs)}`);
    return lines;
  }

  /**
   * AAQ-002 slice 4 — the backend's collections and their fields.
   *
   * Until this existed the context carried **no backend block at all**, so the
   * agent wrote `prop-<field>` parameters from the scope's prose. Returns
   * `undefined` (never charged) for a project with no backend and no planned
   * provision, matching `libraryOverview`'s absent-means-omitted convention, so
   * such a project sends a byte-identical turn to before.
   *
   * See `backendSchema.ts` for why the list has two sources and why the block
   * spells out `collectionName`.
   */
  backendSchema(): string | undefined {
    const rendered = renderBackendSchema(this.collections);
    if (!rendered) return undefined;
    return this.charge('backend-schema', rendered);
  }

  /**
   * LIB-006: what a legacy import could not convert, addressed to the agent.
   *
   * This is the wired half of `COMPATIBILITY-POLICY.md`'s escape hatch. The
   * policy accepts "the importing user's AI assistant fixes it" as an answer
   * only because the assistant can actually be told what broke — this is the
   * telling. Without it the sentence is a way of avoiding work rather than a
   * mechanism.
   *
   * Returns `undefined` (never charged) when the project was not imported or
   * when everything converted, matching `libraryOverview`'s absent-means-omitted
   * convention rather than emitting an empty heading. A clean project therefore
   * pays zero prompt bytes for this.
   */
  importReport(): string | undefined {
    if (!this.report) return undefined;
    const rendered = renderReportForAssistant(this.report);
    if (!rendered) return undefined;
    return this.charge('import-report', rendered);
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

  /**
   * BLD-007 — a doc the user wrote, fetched through `get_project_doc`.
   *
   * Charged under its own path rather than a shared bucket, so the context log
   * answers "what did this turn spend on prose" per document. Capped with
   * `DEFAULT_DOC_CAP` through the same heading-boundary truncator as the seed
   * docs — a silently short user doc is the failure the format exists to avoid,
   * and writing a second truncator is how the two drift.
   */
  projectExtraDoc(doc: DiscoveredDoc): string {
    return this.charge(`project-doc:${doc.path}`, renderDocForPrompt(describeDoc(doc.path, doc.body), doc.body));
  }

  /**
   * BLD-007 — the docs that declared `inject: always`, rendered for the
   * always-block.
   *
   * Empty for every project that has not opted in, which is what keeps the
   * cache-stable prefix identical for everyone else. The user has chosen a real
   * per-turn cost here; the Docs panel states it in tokens before they choose.
   */
  projectAlwaysDocs(): Array<{ path: string; title: string; text: string }> {
    const out: Array<{ path: string; title: string; text: string }> = [];
    for (const doc of this.docs.extra ?? []) {
      if (doc.inject !== 'always' || !doc.body.trim()) continue;
      const text = this.charge(`project-doc:${doc.path}`, renderDocForPrompt(describeDoc(doc.path, doc.body), doc.body));
      out.push({ path: doc.path, title: doc.title, text });
    }
    return out;
  }

  /** Cap, render and charge one known doc. */
  private docHandout(kind: 'conventions' | 'brief' | 'architecture', source: string): string | undefined {
    const body = this.docs[kind];
    if (body === undefined || !body.trim()) return undefined;
    const doc = KNOWN_DOCS.find((d) => d.kind === kind)!;
    return this.charge(source, renderDocForPrompt(doc, body));
  }

  /**
   * Full documentation for a batch of node types, in one charged handout.
   *
   * AIB-001 slice 2: led by the wire-format legend. It sits here rather than in
   * the system prompt because this is the handout the agent reads *immediately
   * before* writing parameters — the rules are adjacent to the ports they
   * govern, and a project whose agent never fetches a type never pays for them.
   */
  nodeTypeDetails(typeNames: string[]): string {
    const sections = typeNames.map((name) => this.renderNodeType(name));
    return this.charge(`types:${typeNames.join(',')}`, [WIRE_FORMAT_LEGEND, ...sections].join('\n\n'));
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
    // FIX-014 — logic nodes had silence where visual nodes had a placement
    // sentence, which is half of how everything landed in one column.
    else
      lines.push(
        'Logic node — no `parent`; it sits in the logic column to the right of the visual tree, beside the ' +
          'visual node it feeds.'
      );
    // CN-008 — a kit node can never have enrichment: `enrichedNode` reads a
    // catalog generated at repo-build time and keyed by type name, and a
    // project's kit types are by construction not in it. So the one sentence a
    // kit author *can* write about their node — the definition's `docs` — was
    // carried all the way into the overlay by `@nodegx/kit-catalog` and then
    // dropped here, and every kit node reached the model with a heading, a
    // placement line and no statement of what it is for.
    //
    // Gated on provenance because `docs` means something else entirely on a
    // shipped node; see `kitDocs`. A project with no kits is byte-identical.
    const summary = enriched?.summary ?? (this.catalog.isProjectKitType(typeName) ? kitDocs(node) : undefined);
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
    const nodes = files.nodes.nodes.map((raw: NodeV2) => {
      // LEG-001 — `comment` became submit-expressible, so this handout owes the
      // agent the ones the component already has: the sentence saying why a node
      // is the way it is, handed to the model most likely to change it for a
      // reason the sentence already answers. Unfolded from `metadata.comment`
      // rather than read out of the bag here, so the two doors keep one mapping.
      const n = unfoldNodeComment(raw);
      return {
      id: n.id,
      type: n.type,
      ...(n.label !== undefined ? { label: n.label } : {}),
      ...(typeof n.comment === 'string' ? { comment: n.comment } : {}),
      ...(n.x !== undefined ? { x: n.x } : {}),
      ...(n.y !== undefined ? { y: n.y } : {}),
      ...(n.parent !== undefined ? { parent: n.parent } : {}),
      ...(n.parameters && Object.keys(n.parameters).length > 0 ? { parameters: n.parameters } : {}),
      ...(n.ports && n.ports.length > 0 ? { ports: n.ports } : {})
      };
    });
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

  /**
   * AIX-011 criterion 7 — which project documents exist, for the PLAN step.
   *
   * The planning prompt gates a `doc` operation on the project's docs being
   * "listed in the overview material" — and until this method existed, nothing
   * listed them: `PlanningSession` built a context builder with no docs at all
   * and `projectOverview()` names only components. So the condition for
   * planning a doc operation was one the product could never satisfy, which is
   * why both live plan runs contained zero doc operations and criterion 7's
   * authoring turn had never once been seen against a real model.
   *
   * Paths and purposes only, never bodies: the plan step decides *whether* a
   * document should change, and the `DocSession` that follows is the turn that
   * reads it. Returns `undefined` when the project has no docs, so a project
   * without them sends a byte-identical planning turn to before.
   */
  docsOverview(): string | undefined {
    const present = KNOWN_DOCS.filter((doc) => {
      const body = this.docs[doc.kind];
      return body !== undefined && body.trim().length > 0;
    });
    const extra = (this.docs.extra ?? []).filter((doc) => doc.body.trim().length > 0);
    if (present.length === 0 && extra.length === 0) return undefined;
    const lines = ['This project keeps written documents. A doc operation may update one of these:'];
    for (const doc of present) {
      lines.push(`- ${doc.path} — ${doc.purpose} (${this.docs[doc.kind]!.length} chars today)`);
    }
    // BLD-007: the user's own documents are plannable subjects too. Without
    // this the plan step could propose a change to CONVENTIONS.md and never to
    // the doc the user wrote specifically to be acted on.
    for (const doc of extra) {
      lines.push(`- ${doc.path} — ${doc.title} (${doc.body.length} chars today)`);
    }
    return this.charge('docs-overview', lines.join('\n'));
  }
}
