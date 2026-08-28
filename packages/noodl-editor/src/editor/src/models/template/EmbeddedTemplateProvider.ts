/**
 * EmbeddedTemplateProvider
 *
 * Provides access to templates that are embedded directly in the application code.
 * These templates are bundled with the editor and work reliably in both
 * development and production (no file I/O or path resolution issues).
 *
 * @module noodl-editor/models/template
 */

import { CLOUD_COMPONENT_PREFIX } from '../../validation/runtimeContext';
import { ITemplateProvider, TemplateItem } from '../../utils/forge/template/template';
import { INITIAL_OPEN_COMPONENT_METADATA_KEY } from './firstOpenComponent';
import { ProjectContent, NodeDefinition, ProjectTemplate } from './ProjectTemplate';
import { helloWorldTemplate } from './templates/hello-world.template';
import { siteBuilderTemplate } from './templates/site-builder.template';

/**
 * SBR-001 — does a project made from this template need a local backend?
 *
 * Derived from what the template ships, never declared beside it: a security
 * policy is a set of rules for a backend to enforce, and a `/#__cloud__/`
 * component is a function only a backend can run — either one without a backend
 * is a template that can do nothing at all (finding 1: Site Builder shipped
 * `devOpen: false` into a project with no backend attached). A hand-written
 * `requiresBackend:` flag would be a second statement of the same fact;
 * `lessonbackend.ts` records why that drifts.
 */
export function templateNeedsBackend(template: ProjectTemplate): boolean {
  if (template.securityPolicy) return true;
  return (template.content.components ?? []).some((c) => c.name?.startsWith(CLOUD_COMPONENT_PREFIX));
}

/**
 * Generate a fresh unique node id (UUID v4-ish, matching the editor's format).
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Provider for templates that are embedded in the application code
 */
export class EmbeddedTemplateProvider implements ITemplateProvider {
  /**
   * Registry of all embedded templates
   * New templates should be added here
   */
  private templates: Map<string, ProjectTemplate> = new Map([
    ['hello-world', helloWorldTemplate],
    // SB-007. ⚠️ Its `content` is a generated JSON blob — `npm run
    // template:site-builder` — not a hand-written graph like `hello-world`'s.
    ['site-builder', siteBuilderTemplate]
    // Add more templates here as they are created
  ]);

  get name(): string {
    return 'embedded-templates';
  }

  /**
   * List all available embedded templates
   * @returns Array of template items
   */
  async list(): Promise<ReadonlyArray<TemplateItem>> {
    const items: TemplateItem[] = [];

    for (const [id, template] of this.templates) {
      items.push({
        title: template.name,
        desc: template.description,
        category: template.category,
        iconURL: template.thumbnail || '',
        projectURL: `embedded://${id}`,
        needsBackend: templateNeedsBackend(template)
      });
    }

    return items;
  }

  /**
   * Check if this provider can handle the given URL
   * @param url - The template URL to check
   * @returns True if URL starts with "embedded://"
   */
  async canInstall(url: string): Promise<boolean> {
    return url.startsWith('embedded://');
  }

  /**
   * Write the template into the destination **project directory**.
   *
   * Nothing is fetched and nothing is unzipped: an embedded template is a
   * TypeScript object bundled with the editor, so this instantiates it and
   * writes one `project.json`. This method was called `download` until FB-005
   * T1, which is how it came to be driven by a registry that then tried to
   * unzip its output — see `ITemplateProvider` for the full account.
   *
   * @param url - Template URL (e.g., "embedded://hello-world")
   * @param destination - Destination project directory
   * @returns Promise that resolves when template is written
   */
  async install(url: string, destination: string): Promise<void> {
    // Extract template ID from URL
    const templateId = url.replace('embedded://', '');

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Unknown embedded template: ${templateId}`);
    }

    // Instantiate the template into concrete project content: regenerate node
    // ids so every new project is unique, and resolve `rootComponent` (a name)
    // into a concrete `rootNodeId`. The latter is critical: ProjectModel.fromJSON
    // only honours the `rootComponent` name hint by calling setRootComponent(),
    // which silently no-ops unless the NodeLibrary already has the root node's
    // type loaded (allowAsExportRoot). At project-creation time the editor is on
    // the launcher with an empty NodeLibrary, so that hint is lost and the
    // project is saved with no home component. A concrete `rootNodeId` is
    // resolved purely by id lookup, independent of the NodeLibrary.
    const projectContent = this.instantiateContent(template.content);

    // SBR-002: the first-open hint rides project metadata, where
    // `getDefaultComponent` reads it back. Set only when the template declares
    // one — every other template's project.json is byte-identical to before.
    // The name is NOT id-remapped: component names are stable through
    // `instantiateContent` (only node ids are regenerated).
    if (template.initialOpenComponent) {
      projectContent.metadata = {
        ...(projectContent.metadata || {}),
        [INITIAL_OPEN_COMPONENT_METADATA_KEY]: template.initialOpenComponent
      };
    }

    // Ensure destination directory exists
    const { filesystem } = await import('@noodl/platform');

    // Create destination directory if it doesn't exist
    if (!filesystem.exists(destination)) {
      await filesystem.makeDirectory(destination);
    }

    // Write project.json to destination
    const projectJsonPath = filesystem.join(destination, 'project.json');
    await filesystem.writeFile(projectJsonPath, JSON.stringify(projectContent, null, 2));

    // SB-015: and the policy the graphs assume, if this template carries one.
    //
    // 🔴 It is written UNINSTANTIATED — no id remapping, no clone-and-rewrite —
    // because a security policy names collections, functions and roles, and not
    // one node id. Running it through `instantiateContent`'s neighbourhood would
    // be a rewrite looking for ids in a document that has none, which is the
    // shape of near-miss SB-007 F22 already recorded (a string-matching rewrite
    // would have corrupted eight parameters whose values collide with ids).
    //
    // A template with no `securityPolicy` writes no file, which is every
    // template but one and is exactly today's behaviour.
    if (template.securityPolicy) {
      const policyPath = filesystem.join(destination, 'nodegx.security.json');
      await filesystem.writeFile(policyPath, JSON.stringify(template.securityPolicy, null, 2) + '\n');
    }
  }

  /**
   * Turn a template's declarative content into a concrete, ready-to-save project:
   *  - deep-clones the content so the shared template object is never mutated;
   *  - regenerates every node id (recursively through children) and rewrites
   *    **every** field that references one — connections and `graph.visualRoots`
   *    — so two projects created from the same template don't share node UUIDs;
   *  - resolves the `rootComponent` name into a top-level `rootNodeId` pointing at
   *    that component's first root node, so the home component is set deterministically
   *    without depending on the NodeLibrary being loaded.
   *
   * 🔴 **`visualRoots` was missed until SB-007, and it was missed because nothing
   * had one.** `hello-world` is a hand-written graph with no `visualRoots` at
   * all, and it was the only embedded template for the whole life of this class,
   * so the field had no population to be wrong about. Every component a v2 door
   * writes carries one (`reconstructLegacyComponent` restores it from
   * `nodes.json`), and the Site Builder template brought twelve of them at once —
   * measured as twelve dangling ids in an installed project before this loop
   * existed. `lessonstarter.ts:341` checks the same class of defect on a
   * different artefact, in the same words.
   *
   * ⚠️ **The rewrite is structural, and that is not fussiness.** A pass that
   * replaced any string matching an old id would corrupt eight parameters in this
   * one template: `as: 'section'`, `as: 'nav'`, `as: 'header'` and five
   * `flexDirection: 'row'` all collide with a node id, because the ids a graph
   * author picks and the HTML element names a Group takes come from the same
   * small vocabulary. Only fields that are *declared* to hold ids are touched.
   *
   * @param content - The template's declarative content
   * @returns A fresh project content object safe to serialize
   */
  private instantiateContent(content: ProjectContent): ProjectContent {
    const project: ProjectContent = JSON.parse(JSON.stringify(content));

    // Regenerate node ids, keeping an old->new map to fix up connections.
    const idMap = new Map<string, string>();
    const remapNode = (node: NodeDefinition) => {
      if (node.id) {
        const newId = generateId();
        idMap.set(node.id, newId);
        node.id = newId;
      }
      if (node.children) node.children.forEach(remapNode);
    };

    for (const component of project.components || []) {
      for (const root of component.graph?.roots || []) {
        remapNode(root);
      }
    }

    for (const component of project.components || []) {
      for (const connection of component.graph?.connections || []) {
        if (connection.fromId && idMap.has(connection.fromId)) connection.fromId = idMap.get(connection.fromId);
        if (connection.toId && idMap.has(connection.toId)) connection.toId = idMap.get(connection.toId);
      }

      // The second field that names node ids. `ComponentGraph` does not declare
      // it — it is canvas state that arrives through the v2 round trip — so it is
      // read off the graph rather than through the interface.
      const graph = component.graph as (typeof component.graph & { visualRoots?: string[] }) | undefined;
      if (graph?.visualRoots) {
        graph.visualRoots = graph.visualRoots.map((id) => idMap.get(id) ?? id);
      }
    }

    // Resolve rootComponent (a name) into a concrete rootNodeId.
    if (project.rootComponent) {
      const rootComp = (project.components || []).find((c) => c.name === project.rootComponent);
      const firstRoot = rootComp?.graph?.roots?.[0];
      if (firstRoot?.id) {
        project.rootNodeId = firstRoot.id;
      }
    }

    return project;
  }

  /**
   * Get a specific template by ID (utility method)
   * @param id - Template ID
   * @returns The template, or undefined if not found
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all template IDs (utility method)
   * @returns Array of template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }
}
