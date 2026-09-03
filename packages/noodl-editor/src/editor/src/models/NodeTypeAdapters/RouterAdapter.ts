import Utils from '../../utils/utils';
import { ComponentModel } from '../componentmodel';
import { NodeGraphModel } from '../nodegraphmodel';
import { ProjectModel } from '../projectmodel';
import { readNameList } from './nameListParameter.warnings';
import NodeTypeAdapter from './NodeTypeAdapter';
import { pagesAfterComponentRemoved } from './routerRouteRemoval';

export class RouterAdapter extends NodeTypeAdapter {
  events: Record<string, any>;

  constructor() {
    super('Router');

    this.events = {
      componentRemoved: this.componentRemoved.bind(this),
      componentRenamed: this.componentRenamed.bind(this),
      componentDuplicated: this.componentDuplicated.bind(this),
      projectLoaded: this.evaluateRoutersHelath.bind(this),
      'nodeAdded:Router': this.evaluateRoutersHelath.bind(this),
      'parametersChanged:Router': this.parametersChanged.bind(this)
    };
  }

  componentRemoved(e) {
    // 🔴 REL-009b: a reload from disk removes the component and adds the
    // replacement back under the same name, so this handler is asked to react
    // to a swap as if it were a deletion. The cost of guessing wrong here is
    // not cosmetic like the node graph's — it drops the page from every
    // router's `routes` and the next autosave writes that loss to disk. The
    // decision, and the measurement behind it, are in `routerRouteRemoval.ts`;
    // it lives apart because this file cannot be loaded outside Electron.
    const componentName = e.model.fullName;

    this.findAllNodes().forEach((r) => {
      const next = pagesAfterComponentRemoved(r.parameters['pages'], componentName, {
        reloadingFromDisk: e.reloadingFromDisk
      });
      if (next !== null) r.setParameter('pages', next, { undo: e.undo });
    });
  }

  componentRenamed(e) {
    const before = e.oldName;
    const after = e.model.fullName;

    // Note: No need to handle undo here as it will simply revert back to a new renamne
    // Find all routers that have this component in it's routes and rename
    const routers = this.findAllNodes();

    routers.forEach((r) => {
      const pages = r.parameters['pages'];
      if (pages !== undefined && pages.routes !== undefined) {
        const idx = pages.routes.indexOf(before);
        if (idx !== -1) {
          const _pages = JSON.parse(JSON.stringify(pages));
          _pages.routes[idx] = after;
          if (_pages.startPage === before) _pages.startPage = after;

          r.setParameter('pages', _pages);
        }
      }
    });
  }

  componentDuplicated(e) {
    // Is the duplicate a page
    const pages = e.duplicate.getNodesWithType('Page');
    if (pages !== undefined && pages.length > 0) {
      // Find all routers that have the original page and
      // add the duplicate to them
      const source = e.source.fullName;
      const duplicate = e.duplicate.fullName;

      const routers = this.findAllNodes();

      routers.forEach((r) => {
        const pages = r.parameters['pages'];
        if (pages !== undefined && pages.routes !== undefined) {
          const idx = pages.routes.indexOf(source);
          if (idx !== -1) {
            const _pages = JSON.parse(JSON.stringify(pages));
            _pages.routes.push(duplicate);

            r.setParameter('pages', _pages, { undo: e.undo });
          }
        }
      });
    }
  }

  evaluateRoutersHelath() {
    const routers = this.findAllNodes();

    // Check routers for name, and assign them one if they don't have one
    routers.forEach((r) => {
      if (r.parameters['name'] === undefined || r.parameters['name'] === '') {
        const routerNames = routers.map((r) => r.parameters.name);

        let name;

        //Check if the name "Main" is free
        if (routerNames.includes('Main') === false) {
          name = 'Main';
        } else {
          //Assign a name like "Router X"
          let i = 0;

          do {
            name = 'Router ' + i;
            i++;
          } while (routerNames.includes(name));
        }

        r.setParameter('name', name);
      }
    });
  }

  parametersChanged(e) {
    const node = e.model;

    if (e.args.name === 'pages') {
      const pages = node.parameters['pages'];
      if (pages !== undefined) {
        if (pages.startPage === undefined) {
          e.args.undo !== undefined &&
            e.args.undo.pushAndDo({
              do: () => {
                pages.startPage = pages.routes[0];
              },
              undo: () => {
                pages.startPage = undefined;
              }
            });
        }
      }
    }

    this.evaluateRoutersHelath();
  }

  static getPageInfoForComponents(components) {
    const pageInfo = [];
    components.forEach((c) => {
      const _c = ProjectModel.instance.getComponentWithName(c);
      if (_c === undefined) return;

      const pages = _c.getNodesWithType('Page');
      if (pages === undefined || pages.length === 0) return;

      const page = pages[0];
      let title = page.parameters['title'];
      if (title === undefined) {
        const titleParts = c.split('/');
        title = titleParts[titleParts.length - 1];
      }
      let urlPath = page.parameters['urlPath'] || title.replace(/\s+/g, '-').toLowerCase();

      const pageInputs = _c.getNodesWithType('PageInputs');
      const pathParams = [];
      pageInputs.forEach((pi) => {
        // AIB-001: `.split(',')` on the raw parameter — see `readNameList`.
        readNameList(pi, 'pathParams').forEach((p) => pathParams.indexOf(p) === -1 && pathParams.push(p));
      });

      pathParams.forEach((p) => {
        if (urlPath.indexOf('{' + p + '}') === -1) urlPath = urlPath + '/{' + p + '}';
      });

      pageInfo.push({
        path: urlPath,
        title: title,
        component: c
      });
    });

    return pageInfo;
  }

  static addPageToRouters(routerName, pageName, args) {
    const routers = ProjectModel.instance.getNodesWithType('Router');
    routers.forEach((r) => {
      if ((r.parameters['name'] || 'Main') === (routerName || 'Main')) {
        // Add this page to the router
        const pages = JSON.parse(JSON.stringify(r.getParameter('pages') || {}));
        if (pages.routes === undefined) pages.routes = [];
        pages.routes.push(pageName);

        r.setParameter('pages', pages, { undo: args.undo });
      }
    });
  }

  static getRouterNames() {
    const routers = ProjectModel.instance.getNodesWithType('Router');

    const _routers = [];
    routers.forEach((r) => {
      if (_routers.indexOf(r.parameters['name'] || 'Main') === -1) _routers.push(r.parameters['name'] || 'Main');
    });

    return _routers;
  }

  static getPageComponents() {
    const pages = ProjectModel.instance.getNodesWithType('Page');

    return pages.map((p) => p.owner.owner.name);
  }

  static createPageComponent(componentName) {
    const component = new ComponentModel({
      name: componentName,
      graph: NodeGraphModel.fromJSON(JSON.parse(JSON.stringify(_pageTemplate))),
      id: Utils.guid()
    });

    component.rekeyAllIds();

    return component;
  }
}

const _pageTemplate = {
  connections: [],
  roots: [
    {
      id: 'xxx',
      type: 'Page',
      x: 0,
      y: 0,
      parameters: {},
      ports: [],
      dynamicports: [],
      children: []
    },
    {
      id: 'yyy',
      type: 'PageInputs',
      x: -100,
      y: -50,
      parameters: {},
      ports: [],
      dynamicports: [],
      children: []
    }
  ]
};
