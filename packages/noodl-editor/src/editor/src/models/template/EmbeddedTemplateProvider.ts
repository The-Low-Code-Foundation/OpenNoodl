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
import { ProjectTemplate } from './ProjectTemplate';
import { helloWorldTemplate } from './templates/hello-world.template';

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
        projectURL: `embedded://${id}`,
        useCloudServices: false,
        cloudServicesTemplateURL: undefined
      });
    }

    return items;
  }

  /**
   * Check if this provider can handle the given URL
   * @param url - The template URL to check
   * @returns True if URL starts with "embedded://"
   */
  async canDownload(url: string): Promise<boolean> {
    return url.startsWith('embedded://');
  }

  /**
   * "Download" (copy) the template to the destination directory
   *
   * Note: For embedded templates, we write the project.json directly
   * rather than copying files from disk.
   *
   * @param url - Template URL (e.g., "embedded://hello-world")
   * @param destination - Destination directory path
   * @returns Promise that resolves when template is written
   */
  async download(url: string, destination: string): Promise<void> {
    // Extract template ID from URL
    const templateId = url.replace('embedded://', '');

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Unknown embedded template: ${templateId}`);
    }

    // Get the template content (which will have its name overridden by the caller)
    const projectContent = template.content;

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
