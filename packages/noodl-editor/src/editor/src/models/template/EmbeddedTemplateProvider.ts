/**
 * EmbeddedTemplateProvider
 *
 * Provides access to templates that are embedded directly in the application code.
 * These templates are bundled with the editor and work reliably in both
 * development and production (no file I/O or path resolution issues).
 *
 * @module noodl-editor/models/template
 */

import { ITemplateProvider, TemplateItem } from '../../utils/forge/template/template';
import { ProjectContent, NodeDefinition, ProjectTemplate } from './ProjectTemplate';
import { helloWorldTemplate } from './templates/hello-world.template';

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
    ['hello-world', helloWorldTemplate]
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
        projectURL: `embedded://${id}`
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

    // Ensure destination directory exists
    const { filesystem } = await import('@noodl/platform');

    // Create destination directory if it doesn't exist
    if (!filesystem.exists(destination)) {
      await filesystem.makeDirectory(destination);
    }

    // Write project.json to destination
    const projectJsonPath = filesystem.join(destination, 'project.json');
    await filesystem.writeFile(projectJsonPath, JSON.stringify(projectContent, null, 2));
  }

  /**
   * Turn a template's declarative content into a concrete, ready-to-save project:
   *  - deep-clones the content so the shared template object is never mutated;
   *  - regenerates every node id (recursively through children) and rewrites any
   *    connections that reference them, so two projects created from the same
   *    template don't share node UUIDs;
   *  - resolves the `rootComponent` name into a top-level `rootNodeId` pointing at
   *    that component's first root node, so the home component is set deterministically
   *    without depending on the NodeLibrary being loaded.
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
