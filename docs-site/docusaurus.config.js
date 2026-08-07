// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/**
 * ALPHA-006 §2. This site replaces `opennoodl-docs` (the fork of Noodl's own
 * Docusaurus site) as the source of NodeGX's user-facing documentation. It does
 * NOT replace what that repo hosts for the editor itself — the library index,
 * lesson templates, project templates, tutorials list and what's-new feed all
 * stay where they are; see `getContentEndpoint()` in the editor and ALPHA-006 §5.
 *
 * ⚠️ `url`/`baseUrl`/`organizationName`/`projectName` below are PROVISIONAL.
 * Where this actually publishes to, and what (if anything) still lives at
 * `the-low-code-foundation.github.io/opennoodl-docs` once it's no longer a docs
 * site, is B5 — a human decision on a 413 MB asset question, not something this
 * build step gets to assume. Read `dev-docs/tasks/phase-33-alpha-launch/
 * HUMAN-GATED-ITEMS.md` before changing these to something that ships.
 */

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'NodeGX',
  tagline: 'Documentation for the low-code editor',
  url: 'https://the-low-code-foundation.github.io',
  baseUrl: '/nodegx-docs/',
  onBrokenLinks: 'throw',
  favicon: 'img/favicon.svg',
  organizationName: 'The-Low-Code-Foundation',
  projectName: 'nodegx-docs',

  // §3's generated node pages carry the catalog's own prose verbatim, which
  // includes things like `<name>` placeholders and `{count}` template
  // fragments — both valid MDX-breaking syntax (an unclosed JSX tag, a bare
  // expression) if Docusaurus parsed `.md` files as MDX. 'detect' parses
  // `.md` as plain CommonMark and reserves MDX for actual `.mdx` files, none
  // of which this site has, so the generator never has to escape catalog text.
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw'
    }
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/The-Low-Code-Foundation/NodeGX/edit/main/docs-site/',
          breadcrumbs: true
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      })
    ]
  ],

  plugins: [
    // Carried over from opennoodl-docs, per ALPHA-006 §2: an offline-capable
    // local index rather than the old hardcoded Algolia `docs_2-9` client
    // ALPHA-006 §6 already deleted from the editor's Help Center.
    [
      '@easyops-cn/docusaurus-search-local',
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      ({
        hashed: true,
        indexDocs: true,
        indexPages: true,
        docsRouteBasePath: '/docs'
      })
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true
      },
      navbar: {
        title: 'NodeGX Docs',
        logo: {
          alt: 'NodeGX',
          src: 'img/logo-light.svg',
          srcDark: 'img/logo-dark.svg'
        },
        items: [
          {
            type: 'doc',
            docId: 'getting-started',
            position: 'left',
            label: 'Getting started'
          },
          {
            type: 'doc',
            docId: 'concepts/index',
            position: 'left',
            label: 'Concepts'
          },
          {
            type: 'doc',
            docId: 'nodes/index',
            position: 'left',
            label: 'Node reference'
          },
          {
            type: 'doc',
            docId: 'troubleshooting',
            position: 'left',
            label: 'Troubleshooting'
          },
          {
            href: 'https://github.com/The-Low-Code-Foundation/NodeGX',
            label: 'GitHub',
            position: 'right'
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting started', to: '/docs/getting-started' },
              { label: 'Concepts', to: '/docs/concepts' },
              { label: 'Node reference', to: '/docs/nodes' }
            ]
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/The-Low-Code-Foundation/NodeGX' },
              { label: 'Issues', href: 'https://github.com/The-Low-Code-Foundation/NodeGX/issues' }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} The Low Code Foundation.`
      },
      prism: {
        additionalLanguages: ['bash', 'json']
      }
    })
};

module.exports = config;
