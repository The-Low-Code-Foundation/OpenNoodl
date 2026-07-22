import path from 'node:path';
import { filesystem } from '@noodl/platform';

import FileSystem from '../../../filesystem';
import { ITemplateProvider, TemplateItem, TemplateListFilter } from '../template';

/**
 * Provides access to locally bundled project templates.
 * This provider is used for templates that ship with the editor.
 */
export class LocalTemplateProvider implements ITemplateProvider {
  get name(): string {
    return 'local-templates';
  }

  async list(_options: TemplateListFilter): Promise<readonly TemplateItem[]> {
    // Return only the Hello World template
    return [
      {
        title: 'Hello World',
        category: 'Getting Started',
        desc: 'A simple starter project to begin your Noodl journey',
        iconURL: './assets/template-hello-world-icon.png',
        projectURL: 'local://hello-world',
        cloudServicesTemplateURL: undefined
      }
    ];
  }

  canDownload(url: string): Promise<boolean> {
    // Handle local:// protocol
    return Promise.resolve(url.startsWith('local://'));
  }

  async download(url: string, destination: string): Promise<void> {
    if (url === 'local://hello-world') {
      // The template is in project-examples folder at the repository root
      // Use process.cwd() which points to repository root during development
      const repoRoot = process.cwd();
      const sourcePath = path.join(repoRoot, 'project-examples', 'version 1.1.0', 'template-project');

      if (!filesystem.exists(sourcePath)) {
        throw new Error('Hello World template not found at: ' + sourcePath);
      }

      // Copy the template folder to destination
      // The destination is expected to be where unzipped content goes
      // So we copy the folder contents directly
      FileSystem.instance.copyRecursiveSync(sourcePath, destination);
    } else {
      throw new Error(`Unknown local template: ${url}`);
    }
  }
}
