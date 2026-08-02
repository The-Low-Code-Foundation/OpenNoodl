/**
 * LIB-006: the legacy assessment core — pure.
 *
 * Given a source project's data and a catalog, classify every construct into the
 * four outcomes of the taxonomy (`types.ts`) and return the findings. No disk,
 * no Electron, no editor singletons — `apply.ts`'s shell supplies the catalog
 * and the code scanner, and `tests-unit/lib-006/` exercises this without either.
 *
 * The classification rules, and the evidence for each, are committed in
 * `dev-docs/tasks/phase-21-library-and-import/LIB-006-LEGACY-CONSTRUCT-INVENTORY.md`.
 * If a rule here and that table disagree, the table is right and this is a bug.
 *
 * @module noodl-editor/utils/import-engine/legacy/assess
 */

import type { ProjectData, ProjectComponentData, RawNode } from '../types';
import {
  CARRIED_BACKEND_METADATA,
  DROPPED_PROJECT_FIELDS,
  HTTP_TYPE,
  REST_SCRIPT_PARAMETERS,
  REST_TO_HTTP_PORTS,
  REST_TYPE,
  REST_UNCARRIED_PARAMETERS,
  removedType
} from './constructs';
import type { CatalogTypeQuery, LegacyFinding, LegacyLocation } from './types';

/** Parameters that hold user-authored code, by node type. */
const CODE_PARAMETERS: Record<string, string> = {
  JavaScriptFunction: 'functionScript',
  Javascript2: 'code',
  Expression: 'expression',
  'CSS Definition': 'style'
};

/** How many places an aggregated finding names before it stops listing them. */
const MAX_SAMPLE_LOCATIONS = 5;

/**
 * A user-code pattern matcher. Injected so the core stays pure: the shell passes
 * `models/migration/ProjectScanner`'s `LEGACY_PATTERNS`, which already own the
 * React 18→19 delta. LIB-006 does not restate those patterns.
 */
export interface LegacyCodePattern {
  name: string;
  description: string;
  test(code: string): boolean;
}

export interface AssessInput {
  sourceDir: string;
  project: ProjectData;
  catalog: CatalogTypeQuery;
  /**
   * Full names of the components actually being imported. Omit to assess the
   * whole project. Scoping matters: a report that flags constructs in components
   * the user did not import is a report they learn to ignore.
   */
  componentNames?: string[];
  /**
   * Whether at least one `noodl_modules` module travels with this import.
   *
   * This is the hinge of the whole node classification, and it is a genuine
   * judgement call. A module registers its node types at load time and nothing
   * static can enumerate them — `manifest.json` declares assets, not types. So
   * an unresolved type with a module travelling alongside is classified
   * `converted` on the assumption the module provides it, and the report states
   * the assumption. The alternative — placeholder everything unresolved — would
   * mark 47 working `Avatar` nodes in this repo's own corpus as broken.
   */
  modulesTravelWithImport: boolean;
  /** User-code patterns to flag. Omit to skip the user-code pass entirely. */
  codePatterns?: LegacyCodePattern[];
}

export interface AssessResult {
  findings: LegacyFinding[];
  /** Every construct the assessment looked at — the coverage denominator. */
  constructsAssessed: number;
  /** Nodes in the assessed set, for the verdict's size term. */
  nodeCount: number;
}

// ─── Node walking ────────────────────────────────────────────────────────────

/**
 * Flatten a component's root tree.
 *
 * NB: the callback body is braced deliberately. An implicit-return arrow whose
 * body is `out.push(node)` returns a number, and the codebase has a recursive
 * walker (`forEachRecursive`) that reads a truthy return as "stop" — that
 * mismatch has produced a false data-loss report and three investigations. This
 * walker does not have that contract, but the shape stays braced so nobody has
 * to check which walker they are reading.
 */
function flattenNodes(roots: RawNode[] | undefined): RawNode[] {
  const out: RawNode[] = [];
  function visit(node: RawNode): void {
    out.push(node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  }
  for (const root of roots ?? []) {
    visit(root);
  }
  return out;
}

/** A node type that names a component rather than a registered node type. */
function isComponentRef(type: string | undefined): boolean {
  return typeof type === 'string' && (type.startsWith('/') || type.startsWith('#'));
}

function nodeLabel(node: RawNode): string | undefined {
  const label = (node as Record<string, unknown>).label;
  return typeof label === 'string' && label.length > 0 ? label : undefined;
}

function locationOf(component: ProjectComponentData, node: RawNode): LegacyLocation {
  return { component: component.name, nodeId: node.id, nodeLabel: nodeLabel(node) };
}

/** Findings are addressed by id, so the id must not depend on array order. */
function findingId(parts: (string | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== '').join(':');
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// ─── The assessment ──────────────────────────────────────────────────────────

export function assess(input: AssessInput): AssessResult {
  const { project, catalog, modulesTravelWithImport } = input;
  const findings: LegacyFinding[] = [];
  let constructsAssessed = 0;
  let nodeCount = 0;

  const wanted = input.componentNames ? new Set(input.componentNames) : undefined;
  const components = (project.components ?? []).filter((c) => wanted === undefined || wanted.has(c.name));

  // Deprecated-type notes are aggregated per type, not per node.
  const deprecated = new Map<string, { count: number; samples: LegacyLocation[] }>();

  for (const component of components) {
    for (const node of flattenNodes(component.graph?.roots)) {
      const type = node.type;
      if (typeof type !== 'string' || type === '') {
        continue;
      }
      nodeCount += 1;
      constructsAssessed += 1;

      // A component instance resolves against the imported set, not the
      // catalog. LIB-004's closure already guarantees the referent travels with
      // it, and reporting on it would double-count the component itself.
      if (isComponentRef(type)) {
        continue;
      }

      const removed = removedType(type);
      if (removed) {
        findings.push({
          id: findingId(['node', component.name, node.id, type]),
          kind: 'node',
          outcome: 'placeholder',
          reason: 'type-removed',
          original: type,
          message: `"${removed.displayName}" (\`${type}\`) was removed from NodeGX and nothing provides it. The node is kept exactly as authored so you can see what was there, but it will not run.`,
          location: locationOf(component, node),
          equivalents: removed.equivalents,
          portChanges: removed.portChanges.length > 0 ? removed.portChanges : undefined,
          recommendation:
            removed.equivalents.length > 0
              ? `${removed.note} Replace it with \`${removed.equivalents[0]}\` and re-point the wires listed above by hand.`
              : `${removed.note} There is no node to convert to — delete this one and rebuild the behaviour.`
        });
        continue;
      }

      if (!catalog.hasType(type)) {
        if (modulesTravelWithImport) {
          // Assumed-resolvable. Stated, not silent — see AssessInput docs.
          findings.push({
            id: findingId(['node', component.name, node.id, type]),
            kind: 'module',
            outcome: 'converted',
            reason: 'type-module-provided',
            original: type,
            message: `\`${type}\` is not a built-in node type. A module is being imported alongside this project and is assumed to provide it — nothing can verify that before the module loads.`,
            location: locationOf(component, node),
            equivalents: [],
            recommendation:
              'Open the component after the import. If the node shows as an unknown type, the module did not register it and the node needs rebuilding.'
          });
        } else {
          findings.push({
            id: findingId(['node', component.name, node.id, type]),
            kind: 'node',
            outcome: 'placeholder',
            reason: 'type-unresolved',
            original: type,
            message: `\`${type}\` resolves to no node type in NodeGX and no module is being imported that could provide it. The node is kept exactly as authored so you can see what was there, but it will not run.`,
            location: locationOf(component, node),
            equivalents: catalog.relatedNodes(type),
            recommendation:
              'If this came from a module, install the module and re-import. Otherwise delete the node and rebuild the behaviour with a built-in type.'
          });
        }
        continue;
      }

      // ── REST2: the one mechanical conversion the inventory takes ──────────
      if (type === REST_TYPE) {
        const params = node.parameters ?? {};
        const hasScripts = REST_SCRIPT_PARAMETERS.some((p) => !isBlank(params[p]));
        if (hasScripts) {
          findings.push({
            id: findingId(['node', component.name, node.id, type]),
            kind: 'node',
            outcome: 'converted',
            reason: 'rest-has-scripts',
            original: REST_TYPE,
            message:
              'This REST node carries a request or response script. It is left as a REST node — REST still runs — because rewriting it to HTTP Request would discard that code, and HTTP Request has nowhere to put it.',
            location: locationOf(component, node),
            equivalents: [HTTP_TYPE, 'JavaScriptFunction'],
            recommendation:
              'To modernise by hand: an HTTP Request node for the call, and a Function node either side for what the scripts did.'
          });
        } else {
          const uncarried = REST_UNCARRIED_PARAMETERS.filter((p) => !isBlank(params[p]));
          findings.push({
            id: findingId(['node', component.name, node.id, type]),
            kind: 'node',
            outcome: 'converted-with-changes',
            reason: 'rest-to-http',
            original: REST_TYPE,
            converted: HTTP_TYPE,
            message:
              uncarried.length > 0
                ? `Converted from REST to HTTP Request. \`${uncarried.join(
                    '`, `'
                  )}\` has no HTTP Request equivalent and was not carried — check the request still does what you meant.`
                : 'Converted from REST to HTTP Request, which is a superset of what this node was doing declaratively.',
            location: locationOf(component, node),
            equivalents: [HTTP_TYPE],
            portChanges: [...REST_TO_HTTP_PORTS],
            recommendation:
              uncarried.length > 0
                ? `Set the method on the HTTP Request node, or add a header, to restore the \`${uncarried.join(
                    '`/`'
                  )}\` behaviour.`
                : undefined
          });
        }
        continue;
      }

      if (catalog.isDeprecated(type)) {
        const entry = deprecated.get(type) ?? { count: 0, samples: [] };
        entry.count += 1;
        if (entry.samples.length < MAX_SAMPLE_LOCATIONS) {
          entry.samples.push(locationOf(component, node));
        }
        deprecated.set(type, entry);
        continue;
      }

      // Current type: counted, not entered. `coverage.silentlyConverted` names
      // the difference so the omission is visible arithmetic, not a gap.
    }

    // ── User code ────────────────────────────────────────────────────────────
    if (input.codePatterns && input.codePatterns.length > 0) {
      for (const node of flattenNodes(component.graph?.roots)) {
        const parameter = typeof node.type === 'string' ? CODE_PARAMETERS[node.type] : undefined;
        if (!parameter) {
          continue;
        }
        const code = node.parameters?.[parameter];
        if (typeof code !== 'string' || code.trim() === '') {
          continue;
        }
        for (const pattern of input.codePatterns) {
          if (!pattern.test(code)) {
            continue;
          }
          constructsAssessed += 1;
          findings.push({
            id: findingId(['user-code', component.name, node.id, pattern.name]),
            kind: 'user-code',
            outcome: 'converted',
            reason: 'react19-user-code',
            original: pattern.name,
            message: `Code in this node uses ${pattern.name}, which the React 19 runtime removed. The code is carried across verbatim; it will fail at runtime if the project runs on React 19.`,
            location: { ...locationOf(component, node), parameter },
            equivalents: [],
            recommendation: pattern.description
          });
        }
      }
    }
  }

  // ── Deprecated types, one entry each ───────────────────────────────────────
  for (const [type, entry] of deprecated) {
    const equivalents = catalog.relatedNodes(type);
    findings.push({
      id: findingId(['type', type]),
      kind: 'node',
      outcome: 'converted',
      reason: 'type-deprecated',
      original: type,
      message:
        equivalents.length > 0
          ? `\`${type}\` is deprecated but still works, so it was imported unchanged. ${entry.count} instance${
              entry.count === 1 ? '' : 's'
            }. A current replacement exists.`
          : `\`${type}\` is deprecated but still works, so it was imported unchanged. ${entry.count} instance${
              entry.count === 1 ? '' : 's'
            }. The catalog knows of no replacement.`,
      occurrences: entry.count,
      sampleLocations: entry.samples,
      equivalents,
      recommendation:
        equivalents.length > 0
          ? `Optional. Replacing it with \`${equivalents[0]}\` is a behaviour change nobody asked for — do it deliberately, with the diff in front of you, not as part of the import.`
          : 'Optional. No replacement exists; if the node stops meeting your needs, rebuild the behaviour.'
    });
  }

  // ── Project-level fields ───────────────────────────────────────────────────
  for (const dropped of DROPPED_PROJECT_FIELDS) {
    if (!(dropped.field in project)) {
      continue;
    }
    constructsAssessed += 1;
    findings.push({
      id: findingId(['project-field', dropped.field]),
      kind: 'project-field',
      outcome: 'dropped',
      reason: 'field-not-carried',
      original: dropped.field,
      message: dropped.message,
      location: { field: dropped.field },
      equivalents: [],
      benign: dropped.benign,
      recommendation: dropped.recommendation
    });
  }

  if (typeof project.rootComponent === 'string' && project.rootComponent !== '') {
    constructsAssessed += 1;
    findings.push({
      id: findingId(['project-field', 'rootComponent']),
      kind: 'project-field',
      outcome: 'converted-with-changes',
      reason: 'root-component-to-node-id',
      original: 'rootComponent',
      converted: 'rootNodeId',
      message: `The project's home was recorded by component name ("${project.rootComponent}"). NodeGX records it by node id, so the field is rewritten on load.`,
      location: { field: 'rootComponent' },
      equivalents: [],
      recommendation: 'No action needed, unless the home page is wrong after the import.'
    });
  }

  const version = project.version;
  if (version !== undefined && String(version) !== '4') {
    constructsAssessed += 1;
    findings.push({
      id: findingId(['project-field', 'version']),
      kind: 'project-field',
      outcome: 'converted-with-changes',
      reason: 'project-version-upgraded',
      original: `version ${String(version)}`,
      converted: 'version 4',
      message: `The project was written in project format ${String(version)} and was upgraded to 4 on load.`,
      location: { field: 'version' },
      equivalents: [],
      recommendation: 'No action needed. The upgrade chain is well-trodden and runs on every open.'
    });
  }

  // ── Backend ────────────────────────────────────────────────────────────────
  const metadata = project.metadata as Record<string, unknown> | undefined;
  const cloudservices = metadata?.[CARRIED_BACKEND_METADATA[0]] as { endpoint?: string } | undefined;
  if (cloudservices && typeof cloudservices.endpoint === 'string' && cloudservices.endpoint !== '') {
    constructsAssessed += 1;
    findings.push({
      id: findingId(['backend', 'cloudservices']),
      kind: 'backend',
      outcome: 'converted',
      reason: 'external-backend-unverified',
      original: 'cloudservices',
      message: `The project points at an external backend (${cloudservices.endpoint}). The configuration is carried across and still resolves, but nothing here can check that the backend answers or that its schema still matches.`,
      location: { field: 'metadata.cloudservices' },
      equivalents: [],
      recommendation:
        'Open Backend Services after the import and confirm the endpoint. Every Record, Query and User node in the project depends on it.'
    });
  }

  return { findings, constructsAssessed, nodeCount };
}
