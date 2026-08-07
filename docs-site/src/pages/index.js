import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const cards = [
  {
    title: 'Getting started',
    description: 'Build a real, working two-page app with data, in the editor, in one sitting.',
    to: '/docs/getting-started'
  },
  {
    title: 'Concepts',
    description:
      'The small set of ideas everything else assumes you already have — node, port, wire, and the signal/value split.',
    to: '/docs/concepts'
  },
  {
    title: 'Node reference',
    description: 'Every node in the picker: ports, defaults, behaviour, generated from the same catalog the editor reads.',
    to: '/docs/nodes'
  },
  {
    title: 'Troubleshooting',
    description: 'Known issues, harvested from real reports rather than guessed at.',
    to: '/docs/troubleshooting'
  }
];

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <header style={{ padding: '4rem 0 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem' }}>{siteConfig.title}</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8 }}>{siteConfig.tagline}</p>
      </header>
      <main>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
            maxWidth: '960px',
            margin: '0 auto',
            padding: '0 2rem 4rem'
          }}
        >
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              style={{
                display: 'block',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--ifm-color-emphasis-300)',
                color: 'inherit',
                textDecoration: 'none'
              }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{card.title}</h3>
              <p style={{ margin: 0, opacity: 0.8 }}>{card.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
