// Seeds a rich Directus schema covering the spec's "interesting cases":
// relations (M2O), enums (dropdown choices), files, timestamps, numbers, booleans.
const BASE = 'http://localhost:8055';
const j = (x) => JSON.stringify(x, null, 2);

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`login ${r.status}: ${j(b)}`);
  return b.data.access_token;
}
let TOKEN;
async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${typeof data === 'string' ? data : j(data)}`);
  return data;
}
async function collectionExists(name) {
  const r = await fetch(`${BASE}/collections/${name}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return r.ok;
}

async function main() {
  TOKEN = await login();
  console.log('seed: authenticated');

  // authors -----------------------------------------------------------------
  if (!(await collectionExists('authors'))) {
    await api('POST', '/collections', {
      collection: 'authors', schema: {}, meta: { icon: 'person' },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
        { field: 'name', type: 'string', meta: { interface: 'input', required: true } },
        { field: 'email', type: 'string', meta: { interface: 'input', options: { masked: false } } }
      ]
    });
    console.log('seed: created collection authors');
  } else console.log('seed: authors already exists');

  // articles ----------------------------------------------------------------
  if (!(await collectionExists('articles'))) {
    await api('POST', '/collections', {
      collection: 'articles', schema: {}, meta: { icon: 'article' },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
        { field: 'title', type: 'string', meta: { interface: 'input', required: true, options: { placeholder: 'Headline' } } },
        { field: 'body', type: 'text', meta: { interface: 'input-multiline' } },
        { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
          { text: 'Draft', value: 'draft' }, { text: 'Published', value: 'published' }, { text: 'Archived', value: 'archived' }
        ] } }, schema: { default_value: 'draft' } },
        { field: 'rating', type: 'integer', meta: { interface: 'input', options: { min: 0, max: 5 } } },
        { field: 'featured', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false } },
        { field: 'published_at', type: 'timestamp', meta: { interface: 'datetime' } }
      ]
    });
    console.log('seed: created collection articles');

    // M2O relation: articles.author -> authors
    await api('POST', '/fields/articles', {
      field: 'author', type: 'integer', meta: { interface: 'select-dropdown-m2o' }, schema: {}
    });
    await api('POST', '/relations', {
      collection: 'articles', field: 'author', related_collection: 'authors'
    });
    console.log('seed: created M2O articles.author -> authors');

    // File relation: articles.hero_image -> directus_files
    await api('POST', '/fields/articles', {
      field: 'hero_image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] }, schema: {}
    });
    await api('POST', '/relations', {
      collection: 'articles', field: 'hero_image', related_collection: 'directus_files'
    });
    console.log('seed: created file relation articles.hero_image -> directus_files');
  } else console.log('seed: articles already exists');

  // Make both collections publicly readable so unauth reads work if needed (optional; skipped).
  console.log('seed: DONE');
}
main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });
