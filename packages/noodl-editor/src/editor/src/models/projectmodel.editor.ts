import { bugtracker } from '@noodl-utils/bugtracker';
import FileSystem from '@noodl-utils/filesystem';
import Model from '../../../shared/model';
import PopupLayer from '../views/popuplayer';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';
import { CloudServiceMetadata, CloudServiceMetadataDataFormat, ProjectModel } from './projectmodel';
import { applyPatches } from '@noodl-models/ProjectPatches/applypatches';
import { filesystem } from '@noodl/platform';
import { projectStructureService } from '../services/ProjectStructure';
import { isV2FormatEnabled } from '../services/ProjectStructure/featureFlags';

const supportedProjectVersion = 4;

export function projectFromDirectory(projectdir: string, callback: (project?: ProjectModel) => void, args?: TSFixme) {
  bugtracker.debug('ProjectModel.fromDirectory');

  // Turn a reconstructed legacy-shaped `content` object into a live ProjectModel.
  // Shared by the legacy (single-file) and v2 (decomposed) load paths — the v2
  // importer reconstructs exactly the same shape `fromJSON` and `applyPatches`
  // already consume, so everything downstream is format-agnostic.
  const openFromContent = (content: TSFixme, format: 'legacy' | 'v2') => {
    const openProject = () => {
      // Before opening the project, we need to patch it, if necessary
      applyPatches(content);

      // Disable model listeners while loading project, otherwise this will bog down large projects
      Model._listenersEnabled = false;
      const project = ProjectModel.fromJSON(content);
      Model._listenersEnabled = true;
      project._retainedProjectDirectory = projectdir;
      project._projectFormat = format;

      // Check if there are any packages
      project.readModules(() => {
        callback(project);
      });
    };

    //is project version incompatible?
    if (content.version > supportedProjectVersion) {
      ToastLayer.hideAll();
      PopupLayer.instance.showErrorModal({
        message:
          'This project was saved with a newer version of Noodl.<br/><a href="https://noodl.net" target="_blank">Click here to download</a>',
        title: 'Error opening project'
      });
      callback();
      return;
    }

    //do we need to upgrade the project?
    if (args && args.showUpgradeModal && content.version < supportedProjectVersion) {
      ToastLayer.hideAll();
      PopupLayer.instance.showConfirmModal({
        message:
          'This project was saved with an older version of Noodl.<br/>Projects saved with with this version of Noodl will be incompatible with older versions.<br/><br/>Do you want to open and upgrade the project?',
        title: 'Upgrade project?',
        confirmLabel: 'Upgrade',
        cancelLabel: 'Cancel',
        onConfirm: openProject,
        onCancel: () => callback()
      });
    } else {
      openProject();
    }
  };

  const readLegacy = () => {
    ProjectModel.readJSONFromDirectory(projectdir, function (content) {
      if (content) {
        openFromContent(content, 'legacy');
      } else {
        bugtracker.track('ProjectModel.fromDirectory readJSONFromDirectory failed', {
          dir: projectdir,
          dirContent: FileSystem.instance.readDirectorySync(projectdir)
        });
        callback(); // Failed to read project
      }
    });
  };

  // The v2 decomposed format is on by default; the flag is a kill switch. When it
  // has been turned off explicitly, behaviour reverts to legacy single-file reads
  // — except that a directory that IS a v2 project must not fail silently
  // (DEBT-009 / SUB-010: "the hand-off silently fails without it"). A v2 project
  // has only nodegx.project.json + components/, so the legacy read finds nothing
  // and the user gets a blank failure with no cause. Say what is wrong instead.
  if (!isV2FormatEnabled()) {
    const looksV2 = filesystem.exists(filesystem.join(projectdir, 'nodegx.project.json'));
    if (looksV2) {
      const message =
        'This project uses the v2 decomposed format, which has been turned off for this install. ' +
        'Clear the "formatV2.enabled" editor setting (or set localStorage nodegx.formatV2 = "true", ' +
        'or unset NODEGX_DISABLE_V2) and reopen the project.';
      console.error('[v2] ' + message, { dir: projectdir });
      ToastLayer.showError(message);
      callback(); // Still a failed open — but a loud, actionable one.
      return;
    }
    readLegacy();
    return;
  }

  projectStructureService
    .detectFormat(projectdir)
    .then((format) => {
      if (format !== 'v2') {
        readLegacy();
        return;
      }
      projectStructureService
        .loadProject(projectdir)
        .then(({ project: content, warnings }) => {
          if (warnings.length > 0) {
            console.warn(`[v2] project loaded with ${warnings.length} warning(s):`, warnings);
          }
          openFromContent(content, 'v2');
        })
        .catch((err) => {
          console.error('[v2] Failed to load v2 project, falling back to legacy read', err);
          readLegacy();
        });
    })
    .catch((err) => {
      console.error('[v2] Format detection failed, falling back to legacy read', err);
      readLegacy();
    });
}

// Extracts a zip into a directory and returns the project in a callback
// TODO: Replace partly with Filesystem.instance.unzipIntoDirectory
export async function unzipIntoDirectory(
  url: string,
  dirEntry: string,
  callback,
  args?: {
    noAuth?: boolean;
    skipLoad?: boolean;
  }
) {
  // Make sure the folder is empty
  const isEmpty = await filesystem.isDirectoryEmpty(dirEntry);
  if (!isEmpty) {
    callback({
      result: 'failure',
      message: 'Folder must be empty'
    });
    return;
  }

  // Load zip file from URL
  try {
    await filesystem.unzipUrl(url, dirEntry);
  }
  catch(e) {
    callback({
      result: 'failure',
      message: 'Failed to extract'
    });
    return;
  }

  if (args && args.skipLoad) {
    // Skip loading the project?
    callback({
      result: 'success',
      dirEntry: dirEntry
    });
    return;
  }

  // Project extracted successfully, load it
  projectFromDirectory(dirEntry, function (project) {
    if (!project) {
      callback({
        result: 'failure',
        message: 'Failed to load project'
      });
      return;
    }

    // Store the project again, this will make it a unique project by
    // forcing it to generate a project id
    project.id = undefined;
    //project.name = dirEntry.split('/').pop();
    project.toDirectory(project._retainedProjectDirectory, function (res) {
      if (res.result === 'success')
        callback({
          result: 'success',
          project: project
        });
      else
        callback({
          result: 'failure',
          message: 'Failed to clone project'
        });
    });
  });
}

export function setCloudServices(project: ProjectModel, b: CloudServiceMetadata) {
  project.setMetaData('cloudservices', <CloudServiceMetadataDataFormat>{
    instanceId: b.id,
    endpoint: b.endpoint || b.url,
    appId: b.appId,
    type: b.type
  });

  project.notifyListeners('cloudServicesChanged');
}

export function getCloudServices(project: ProjectModel): CloudServiceMetadata {
  const cloudServices = project.getMetaData('cloudservices');
  if (!cloudServices) {
    return {
      id: undefined,
      endpoint: undefined,
      appId: undefined
    };
  }

  return {
    id: cloudServices.instanceId,
    endpoint: cloudServices.endpoint,
    appId: cloudServices.appId,
    type: cloudServices.type
  };
}
