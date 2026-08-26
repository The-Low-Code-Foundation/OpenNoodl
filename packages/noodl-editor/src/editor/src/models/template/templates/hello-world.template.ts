/**
 * Hello World Template
 *
 * A simple starter project with:
 * - App component (root) — a full-viewport Group
 * - Page Router configured, inside that Group
 * - Home page with "Hello World" text
 *
 * @module noodl-editor/models/template/templates
 */

import { ProjectTemplate } from '../ProjectTemplate';

/**
 * Generate a unique ID for nodes
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hello World template
 * Creates a basic project with Page Router and a home page
 */
export const helloWorldTemplate: ProjectTemplate = {
  id: 'hello-world',
  name: 'Hello World',
  description: 'A simple starter project with a home page displaying "Hello World"',
  // 🔴 The platform's vocabulary, not a prose title — see `ProjectTemplate.category`.
  category: 'starter',
  version: '1.0.0',
  thumbnail: undefined,

  content: {
    name: 'Hello World Project',
    rootComponent: 'App',
    components: [
      // App component (root) — a full-viewport Group hosting the Page Router.
      //
      // The Group is not decoration. A Router sizes itself to its content, so on
      // its own at the root of the app it gives every page a height of whatever
      // that page happens to contain — a new project opens as a strip a few
      // pixels tall rather than a page. The Group is what gives the app a
      // viewport-sized canvas to lay pages out in, which is the shape every
      // Noodl project has had, and the one every layout tutorial assumes.
      //
      // Its dimensions are written out rather than left to the port defaults.
      // `addDimensions` declares 100% × 100% with `sizeMode: 'explicit'`, but a
      // declared default is a value the editor renders, not a setter the runtime
      // runs — stating them here means the template does not depend on that
      // distinction holding.
      {
        name: 'App',
        id: generateId(),
        visual: true,
        ports: [],
        visualStateTransitions: [],
        graph: {
          roots: [
            {
              id: generateId(),
              type: 'Group',
              x: 100,
              y: 100,
              parameters: {
                sizeMode: 'explicit',
                width: { value: 100, unit: '%' },
                height: { value: 100, unit: '%' }
              },
              ports: [],
              children: [
                {
                  id: generateId(),
                  type: 'Router',
                  x: 100,
                  y: 100,
                  // `name` is required: getRouterIndex() drops routers without one,
                  // so the router would find no pages. `pages` must be the
                  // { startPage, routes } shape the runtime and exporter expect —
                  // `routes` lists page components by name, `startPage` is the one
                  // shown first. See utils/exporter/router.ts.
                  parameters: {
                    name: 'Main',
                    pages: {
                      startPage: '/#__page__/Home',
                      routes: ['/#__page__/Home']
                    }
                  },
                  ports: [],
                  children: []
                }
              ]
            }
          ],
          connections: [],
          comments: []
        },
        metadata: {}
      },
      // Home page component — a Page node (what marks a component as a routable
      // page) with the "Hello World" Text nested inside it.
      {
        name: '/#__page__/Home',
        id: generateId(),
        visual: true,
        ports: [],
        visualStateTransitions: [],
        graph: {
          roots: [
            {
              id: generateId(),
              type: 'Page',
              x: 100,
              y: 100,
              parameters: {
                title: 'Home',
                urlPath: 'home'
              },
              ports: [],
              children: [
                {
                  id: generateId(),
                  type: 'Text',
                  x: 100,
                  y: 100,
                  parameters: {
                    text: 'Hello World!',
                    fontSize: { value: 32, unit: 'px' },
                    textAlign: 'center'
                  },
                  ports: [],
                  children: []
                }
              ]
            }
          ],
          connections: [],
          comments: []
        },
        metadata: {}
      }
    ],
    settings: {},
    metadata: {
      title: 'Hello World Project',
      description: 'A simple starter project'
    }
  }
};
