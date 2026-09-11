/**
 * ProjectTemplate
 *
 * Defines the structure for project templates that can be used
 * to create new projects with pre-configured components and settings.
 *
 * @module noodl-editor/models/template
 */
import { StyleTokensData } from '../StyleTokensModel/TokenCategories';

/**
 * A markdown document a template ships into the new project's `docs/` folder
 * (the door's `get_project_doc` surface — any file under `docs/` is listed and
 * pull-injectable, per `ProjectDocs/docsText.ts`).
 */
export interface TemplateDoc {
  /** Project-relative, forward-slashed, inside `docs/` — see `assertTemplateDocPath`. */
  path: string;
  /** The file's full markdown content, front matter included. */
  content: string;
}

/**
 * SBR-003 — refuse a template doc path that could land outside `docs/`.
 *
 * The provider's `securityPolicy` comment rules that a template must never be
 * a general "extra files" channel: a template installs a project somebody else
 * may have written. Docs keep that boundary — one known directory, markdown
 * only, every segment a plain name. Throwing (rather than skipping) means a
 * bad path cannot ship silently doc-less.
 */
export function assertTemplateDocPath(docPath: string): void {
  const segments = docPath.split('/');
  const insideDocs = segments[0] === 'docs' && segments.length > 1;
  const plainSegments = segments.every((s) => s !== '' && s !== '.' && s !== '..' && !s.includes('\\'));
  if (!insideDocs || !plainSegments || !docPath.endsWith('.md')) {
    throw new Error(`template doc path must be a .md file inside docs/: "${docPath}"`);
  }
}

/**
 * Represents a complete project template structure
 */
export interface ProjectTemplate {
  /** Unique identifier for the template */
  id: string;

  /** Display name of the template */
  name: string;

  /** Description of what the template provides */
  description: string;

  /**
   * Category for grouping templates.
   *
   * 🔴 **THE PLATFORM'S VOCABULARY IS CANONICAL, INCLUDING HERE** — ruled 2026-08-26 between
   * FB-005 T4 and phase 76. One of `starter`, `data-app`, `dashboard`, `site`, `form`,
   * `integration`, matching `0020`'s `project_template_category_known` in `nodegx-community`.
   *
   * ⚠️ The type cannot say so — this is a plain `string`, and the vocabulary is a CHECK
   * constraint in another repository. `EMBEDDED_TEMPLATE_CATEGORIES` in
   * `tests-unit/fb-005/template-shelf.test.ts` is what enforces it, and it is the copy that can
   * drift; see its comment for what a drift costs.
   *
   * **Why it matters at all**, given nothing branches on it: FB-005 T3's picker draws embedded and
   * platform templates in **one list**. This was free text until the ruling, and `hello-world`
   * said *"Getting Started"* — so a category facet bar (T4) would have shown a prose title beside
   * six slugs, as a facet of exactly one row.
   */
  category: string;

  /** Template version (semver) */
  version: string;

  /** Optional thumbnail/icon URL for UI display */
  thumbnail?: string;

  /** The actual project content */
  content: ProjectContent;

  /**
   * SB-015 — the backend security policy this template's graphs assume, written
   * into a new project as `nodegx.security.json`.
   *
   * 🔴 **Why a template needs this at all.** A template that ships graphs whose
   * whole product is *what a stranger cannot see* was shipping them onto
   * `defaultSecurityConfig()`, and SB-015's drive measured both halves of what
   * that costs: locally `devOpen: true` disables row-level ACL entirely so every
   * draft renders to every visitor; deployed with `devOpen: false` and nothing
   * else, collection reads fall back to `authenticated` so the public site serves
   * the public nothing — while the *function* gate falls back the other way and
   * hands a stranger the site's admin verbs (SB-016). Each failure looks like the
   * other's fix.
   *
   * The shape is exactly a backend's `security.json`, validated by the same
   * `validateSecurityConfig` at the moment provisioning applies it. A template
   * that omits this field behaves exactly as every template did before it
   * existed — the absence is the no-op, which is what makes the mechanism opt-in
   * rather than a migration.
   *
   * ⚠️ **Deliberately not a general "extra files" channel.** A template installs
   * a project somebody else may have written, and a hook that let one write
   * arbitrary paths into a directory is a larger decision than the one that was
   * ruled. This writes one known filename with one validated grammar.
   *
   * ⚠️ **A recipient did not write this.** The file lands at the project root
   * where it can be opened, diffed and deleted, and provisioning refuses to
   * overwrite a backend policy that already exists — but it is a policy that
   * arrived with somebody else's project, and `projectPolicy.ts`'s header states
   * exactly what that does and does not bound.
   */
  securityPolicy?: Record<string, unknown>;

  /**
   * SBR-002 — the component the editor should land on the first time this
   * project opens, as a full component name (e.g. `/Pages/Setup`).
   *
   * Written into the new project's metadata at install and read by
   * `getDefaultComponent`, which is what `useSwitchToDefaultComponent` calls
   * unconditionally on every open — so the hint rides the switch that always
   * wins instead of racing it (a layered "restore" that ran *before* that
   * switch lost every time; `utils/launcher/launcherHandoff.ts` records the
   * post-mortem). A returning user's persisted `selectedComponentName`
   * (`EditorDocument`) is applied after and still wins.
   *
   * 🔴 NOT `content.rootComponent` — that is the runtime home/export root,
   * resolved to `rootNodeId` at install. Repointing it changes what the app
   * runs; this only changes what the editor shows first.
   *
   * Optional and self-healing: a name that matches no component is ignored and
   * the default chain (`/Main`, `/Start`, root, …) answers as before.
   */
  initialOpenComponent?: string;

  /**
   * SBR-003 — token overrides written into the new project's metadata under
   * `STYLE_TOKENS_METADATA_KEY` (`'designTokens'`) at install, exactly where
   * the style panel persists a user's own overrides.
   *
   * This is how a template ships a *look* rather than a stylesheet: the deploy
   * stamps defaults+overrides into `:root {}` of index.html
   * (`generateProjectTokenCss`), the editor preview injects the same CSS, and
   * a runtime `Theme` record overlays the same names on top. Rides the same
   * channel as `initialOpenComponent` and shares its property: a template
   * without the field writes a project.json byte-identical to before.
   */
  designTokens?: StyleTokensData;

  /**
   * SBR-003 — markdown docs written into the new project's `docs/` folder at
   * install, so an authoring session's door (`get_project_doc`) can read the
   * template's contracts instead of rediscovering them.
   *
   * ⚠️ Not a general file channel — see `assertTemplateDocPath`, which install
   * applies to every entry and which refuses anything outside `docs/`.
   */
  docs?: ReadonlyArray<TemplateDoc>;
}

/**
 * The core content structure of a Noodl project
 */
export interface ProjectContent {
  /** Project name (will be overridden by user input) */
  name: string;

  /** Name of the root component that serves as the entry point */
  rootComponent?: string;

  /**
   * Id of the root node (the "home"). Resolved from `rootComponent` at
   * instantiation time so the home component is set deterministically,
   * independent of NodeLibrary state. Present on serialized project.json.
   */
  rootNodeId?: string;

  /** Array of component definitions */
  components: ComponentDefinition[];

  /** Project-level settings */
  settings?: ProjectSettings;

  /** Project metadata */
  metadata?: ProjectMetadata;
}

/**
 * Definition of a single component in the project
 */
export interface ComponentDefinition {
  /** Component name (e.g., "App", "/#__page__/Home") */
  name: string;

  /** Component graph structure */
  graph?: ComponentGraph;

  /** Whether this is a visual component */
  visual?: boolean;

  /** Component ID (optional, will be generated if not provided) */
  id?: string;

  /** Port definitions for the component */
  ports?: PortDefinition[];

  /** Visual state transitions (for visual components) */
  visualStateTransitions?: unknown[];

  /** Component metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Component graph containing nodes and connections
 */
export interface ComponentGraph {
  /** Root nodes in the component */
  roots: NodeDefinition[];

  /** Connections between nodes */
  connections: ConnectionDefinition[];

  /** Comments in the graph (required by NodeGraphModel) */
  comments?: unknown[];
}

/**
 * Definition of a single node in the component graph
 */
export interface NodeDefinition {
  /** Unique node ID */
  id: string;

  /** Node type (e.g., "Group", "Text", "PageRouter") */
  type: string;

  /** X position on canvas */
  x: number;

  /** Y position on canvas */
  y: number;

  /** Node parameters/properties */
  parameters: Record<string, unknown>;

  /** Port definitions */
  ports?: PortDefinition[];

  /** Child nodes (for visual hierarchy) */
  children?: NodeDefinition[];

  /** Variant (for some node types) */
  variant?: string;

  /** State parameters (for state nodes) */
  stateParameters?: Record<string, unknown>;

  /** State transitions (for state nodes) */
  stateTransitions?: unknown[];
}

/**
 * Connection between two nodes
 */
export interface ConnectionDefinition {
  /** Source node ID */
  fromId: string;

  /** Source port/property name */
  fromProperty: string;

  /** Target node ID */
  toId: string;

  /** Target port/property name */
  toProperty: string;
}

/**
 * Port definition for components/nodes
 */
export interface PortDefinition {
  /** Port name */
  name: string;

  /** Port type (e.g., "string", "number", "signal") */
  type: string;

  /** Port direction ("input" or "output") */
  plug: 'input' | 'output';

  /** Port index (for ordering) */
  index?: number;

  /** Default value */
  default?: unknown;

  /** Display name */
  displayName?: string;

  /** Port group */
  group?: string;
}

/**
 * Project-level settings
 */
export interface ProjectSettings {
  /** Project settings go here */
  [key: string]: unknown;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  /** Project title */
  title?: string;

  /** Project description */
  description?: string;

  /** Other metadata fields */
  [key: string]: unknown;
}
