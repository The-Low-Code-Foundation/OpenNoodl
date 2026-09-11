import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { EventDispatcher } from '../../shared/utils/EventDispatcher';
import LessonTemplatesModel from './models/lessontemplatesmodel';
import PopupLayer from './views/popuplayer';
import '@noodl-utils/keyboardhandler';
import './utils/editorapi';
import { platform } from '@noodl/platform';

import { AiAssistantModel } from '@noodl-models/AiAssistant';
import { ProjectModel } from '@noodl-models/projectmodel';

import { installExternalProjectOpen } from './models/externalProjectOpen';
import { installSessionStatus } from './models/sessionStatus';
import { AppRoute } from './pages/AppRoute';
import { AppRouteOptions, AppRouter } from './pages/AppRouter';
import { EditorPage } from './pages/EditorPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DialogLayerContainer } from './views/DialogLayer';
import { installGitHubDeviceFlowDialog } from './views/DialogLayer/components/GitHubDeviceCodeDialog';
import { installReportProblemListener } from './views/DialogLayer/components/ReportProblemDialog';
import { ToastLayerContainer } from './views/ToastLayer';

// Store roots globally for HMR reuse
let toastLayerRoot: ReturnType<typeof createRoot> | null = null;
let dialogLayerRoot: ReturnType<typeof createRoot> | null = null;

function createToastLayer() {
  const toastLayer = document.createElement('div');
  toastLayer.classList.add('toast-layer');
  document.body.appendChild(toastLayer);

  toastLayerRoot = createRoot(toastLayer);
  toastLayerRoot.render(React.createElement(ToastLayerContainer));

  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('./views/ToastLayer', () => {
      // Reuse existing root instead of creating a new one
      if (toastLayerRoot) {
        toastLayerRoot.render(React.createElement(ToastLayerContainer));
      }
    });
  }
}

function createDialogLayer() {
  // ---
  // Add support for the BaseDialog, since that is using React Portals this have
  // to be added to the DOM now!
  const dialogLayerPortalTarget = document.createElement('div');
  dialogLayerPortalTarget.classList.add('dialog-layer-portal-target');
  document.body.appendChild(dialogLayerPortalTarget);

  // ---
  // Add the Dialog Layer
  const dialogLayer = document.createElement('div');
  dialogLayer.classList.add('dialog-layer');
  document.body.appendChild(dialogLayer);

  dialogLayerRoot = createRoot(dialogLayer);
  dialogLayerRoot.render(React.createElement(DialogLayerContainer));

  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('./views/DialogLayer', () => {
      // Reuse existing root instead of creating a new one
      if (dialogLayerRoot) {
        dialogLayerRoot.render(React.createElement(DialogLayerContainer));
      }
    });
  }

  // ALPHA-007: listen for `Help → Report a problem…`, and arm the error tail.
  // Here rather than in the dialog, because the tail has to be collecting
  // *before* the thing being reported goes wrong.
  installReportProblemListener();

  // F63: GitHub sign-in is a device flow, and the user code it produces has no
  // home in any one panel — three separate Connect buttons start the same
  // flow. Installed here so all of them get the dialog and none of them has to
  // own it.
  installGitHubDeviceFlowDialog();
}

export default class Router
  extends React.Component<
    {
      uri: string;
    },
    {
      route: any;
      routeArgs: any;
      routeName: string;
    }
  >
  implements AppRouter
{
  private _route: string;

  constructor(props) {
    super(props);

    //start at projects page
    this.state = {
      routeName: 'projects',
      route: ProjectsPage,
      routeArgs: { route: new AppRoute(this) }
    };

    console.log(`
  _   _                    _  _
 | \\ | |                  | || |
 |  \\| |  ___    ___    __| || |
 | . \` | / _ \\  / _ \\  / _\` || |
 | |\\  || (_) || (_) || (_| || |
 |_| \\_| \\___/  \\___/  \\__,_||_|

      version: ${platform.getFullVersion() || platform.getVersion()}

`);

    // Initialise models
    LessonTemplatesModel.instance.fetch();

    EventDispatcher.instance.on(
      'viewer-refresh',
      () => {
        ipcRenderer.send('viewer-refresh');
      },
      null
    );

    // HLS-009 — an agent on the relay can ask this window to open a project.
    //
    // Installed here because this class *is* the router, and routing is the half of the job that
    // cannot be done from a model. Once, in the constructor, for the life of the window — the
    // subscription has no other lifetime, and there is exactly one router.
    installExternalProjectOpen(this);

    // FLD-010 — and it can ask whether a person is in here and mid-edit.
    //
    // Beside HLS-009 rather than inside a model, for the same "once, for the life of the window"
    // reason and no other: unlike the open request this one needs nothing from the router, so it
    // takes no argument. If a second once-per-window install site is ever built, this belongs
    // there and `installExternalProjectOpen` does not.
    installSessionStatus();

    PopupLayer.instance = new PopupLayer();
    document.body.appendChild(PopupLayer.instance.render());

    createDialogLayer();
    createToastLayer();

    //close the viewer. Viewer is normally closed at this point, but can be open if we refresh the editor from the dev tools
    ipcRenderer.send('viewer-attach', {});

    if (import.meta.webpackHot) {
      import.meta.webpackHot.accept('./pages/EditorPage', () => {
        if (this._route === 'editor') {
          this.setState({ route: EditorPage });
        }
      });
      import.meta.webpackHot.accept('./pages/ProjectsPage', () => {
        if (this._route === 'projects') {
          this.setState({ route: ProjectsPage });
        }
      });
    }
  }

  route(args: AppRouteOptions) {
    if (!args) return;

    // console.log(`route, from: ${this._route}, to: ${args.to}`);
    if (this._route == args.to) {
      return;
    }

    this._route = args.to;

    // TODO: Store route specific data
    const route = new AppRoute(this);

    //Set the global singleton here (and only here) to load the active project for this route
    if (ProjectModel.instance && ProjectModel.instance !== args.project) {
      //new or no project, dispose old one
      const disposed = ProjectModel.instance;
      disposed.dispose();
      AiAssistantModel.instance.resetContexts();

      // HACK: Allow all react components to unmount un unregister the effectsbefore we delete the ProjectModel.
      //
      // Only clear the singleton if it is *still* the project we disposed. The
      // block below assigns `args.project` synchronously, so on a project ->
      // project route (open one project, go back, open another) this callback
      // used to run afterwards and null out the project that had just been
      // loaded — leaving the editor mounted against `ProjectModel.instance ===
      // undefined`, which throws in the `instanceHasChanged` listeners and
      // white-screens the window.
      setTimeout(() => {
        if (ProjectModel.instance === disposed) {
          ProjectModel.instance = undefined;
        }
      }, 0);
    }

    if (args.project && ProjectModel.instance !== args.project) {
      //set new project
      ProjectModel.instance = args.project;

      // Set read-only mode if specified (for legacy projects)
      if (args.readOnly !== undefined) {
        args.project._isReadOnly = args.readOnly;
      }
    }

    // Routes
    if (args.to === 'editor') {
      this.setState({
        route: EditorPage,
        routeArgs: { route, readOnly: args.readOnly }
      });
    } else if (args.to === 'projects') {
      this.setState({
        route: ProjectsPage,
        routeArgs: { route, from: args.from }
      });
    }
  }

  render() {
    const Route = this.state.route;
    return <>{Route ? <Route {...this.state.routeArgs} /> : null}</>;
  }
}
