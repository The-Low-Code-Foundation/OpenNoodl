/**
 * Hello World Template
 *
 * A simple starter project with:
 * - App component (root)
 * - Page Router configured
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
  category: 'Getting Started',
  version: '1.0.0',
  thumbnail: undefined,

  content: {
    name: 'Hello World Project',
    rootComponent: 'App',
    components: [
      // App component (root) — hosts the Page Router.
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
