import { ProjectItem, LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';

import Model from '../../../shared/model';
import { ImportFlowCancelled, openImportFlow } from '../views/ImportFlow';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';

export class ProjectLibraryModel extends Model {
  static instance: ProjectLibraryModel;

  constructor() {
    super();
  }

  /**
   * Import from another local project. LIB-005: one surface — browse, review
   * collisions inline, apply — instead of the two chained checkbox popups this
   * used to drive by hand.
   */
  async importProject(projectEntry: ProjectItem, onBeforePopup?: () => void, onAfterPopup?: () => void) {
    const dirEntry = await this.getProjectRootDir(projectEntry)
      .then((project) => project)
      .catch((err) => {
        console.log(err);
        return undefined;
      });

    // The engine needs a real source directory; a failed load must not fall
    // through into an import of `undefined`.
    if (!dirEntry) {
      ToastLayer.showError('Couldn’t load project to import');
      throw new Error('Could not load project to import');
    }

    try {
      const result = await openImportFlow({
        title: `Import from ${projectEntry.name ?? 'project'}`,
        subtitle: dirEntry,
        sourceDir: dirEntry,
        // ✅ CN-017: a project already on this machine. Local code — copied with
        // no verification step and no consent prompt, which is D6's first part
        // applied to the route that has always been local.
        origin: { kind: 'local-project' },
        onBeforePopup,
        onAfterPopup
      });
      if (result.result !== 'success') throw { message: result.message };
      return true;
    } catch (err) {
      if (err instanceof ImportFlowCancelled) throw { message: 'Cancelled import' };
      throw err;
    }
  }

  private async getProjectRootDir(projectItem: ProjectItem) {
    console.log(projectItem);
    const activityId = 'getting-root';

    ToastLayer.showActivity('Loading project', activityId);
    const project = await LocalProjectsModel.instance.loadProject(projectItem);
    ToastLayer.hideProgress(activityId);

    if (project) {
      return project._retainedProjectDirectory;
    } else {
      throw new Error('Couldnt load project');
    }
  }
}

ProjectLibraryModel.instance = new ProjectLibraryModel();
