// Drive the EDITOR's own sync functions against the live rig, end to end.
import { parseSchemaResponse, parseRelationsResponse, applyRelationsToSchema, relationEndpointFor, schemaRequestPath, parsePocketbaseSchema } from './parsers2.mjs';
import { withoutEditorOnlyCredentials } from './publishsafe.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra='') => {
  let ok = false;
  try { ok = typeof cond === 'function' ? cond() : cond; } catch (e) { ok = false; extra = String(e).slice(0,90); }
  if (ok) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name, extra); }
};

async function syncBackend({ type, url, schemaPath, headers }) {
  const data = await (await fetch(url + schemaPath, { headers })).json();
  const schema = parseSchemaResponse(type, data);
  const relPath = relationEndpointFor(type);
  let relData;
  if (relPath) {
    const r = await fetch(url + relPath, { headers });
    relData = r.ok ? await r.json() : undefined;
    console.log(`  (${type}: ${relPath} -> ${r.status})`);
  }
  applyRelationsToSchema(schema, parseRelationsResponse(type, data, relData));
  return schema;
}

// Directus
const dTok = (await (await fetch('http://localhost:8055/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@example.com',password:'directus-admin-pw'})})).json()).data.access_token;
console.log('\n=== DIRECTUS ===');
const d = await syncBackend({ type:'directus', url:'http://localhost:8055', schemaPath:'/fields', headers:{Authorization:`Bearer ${dTok}`} });
check('relations stored', Array.isArray(d.relations), JSON.stringify(d.relations?.length));
const dM2M = (d.relations||[]).find(r=>r.collection==='bcn005_articles'&&r.field==='tags');
check('M2M under the parent alias "tags"', () => !!dM2M, JSON.stringify((d.relations||[]).filter(r=>r.collection==='bcn005_articles')));
check('M2M junction named', () => dM2M?.write?.collection==='bcn005_articles_tags');
check('M2M two-hop readPath', () => dM2M?.readPath==='tags.tag_id');
check('alias field enriched', () => d.collections.find(c=>c.name==='bcn005_articles').fields.find(f=>f.name==='tags')?.relationTarget==='bcn005_tags');
check('reverse O2M stored', () => (d.relations||[]).some(r=>r.collection==='bcn005_authors'&&r.field==='articles'));
check('no invented column for the reverse O2M', () => !d.collections.find(c=>c.name==='bcn005_authors').fields.some(f=>f.name==='articles'));
// negative control: relation metadata WITHOUT the admin token
const anon = await fetch('http://localhost:8055/relations');
console.log('  (negative control: /relations unauthenticated ->', anon.status + ')');
check('unauthenticated relation fetch is refused (so it MUST be stored at sync time)', anon.status === 403, String(anon.status));

// PostgREST
console.log('\n=== POSTGREST ===');
const s = await syncBackend({ type:'supabase', url:'http://localhost:8056', schemaPath:'/', headers:{} });
check('relations stored', () => Array.isArray(s.relations) && s.relations.filter(r=>r.collection.startsWith('bcn005')).length===4, JSON.stringify(s.relations?.map(r=>r.collection+'.'+r.field)));
const sM2M = (s.relations||[]).find(r=>r.collection==='bcn005_articles'&&r.field==='bcn005_tags');
check('junction M2M idempotent (pair is the PK)', () => sM2M?.write?.idempotent===true);
check('no invented embed column', () => !s.collections.find(c=>c.name==='bcn005_articles').fields.some(f=>f.name==='bcn005_tags'));

// PocketBase
console.log('\n=== POCKETBASE ===');
const pbTok = (await (await fetch('http://localhost:8091/api/collections/_superusers/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:'admin@example.com',password:'pocketbase-admin-pw'})})).json()).token;
const p = await syncBackend({ type:'pocketbase', url:'http://localhost:8091', schemaPath: schemaRequestPath('pocketbase', '/api/collections'), headers:{Authorization:pbTok} });
check('relations stored', () => p.relations?.length===2, JSON.stringify(p.relations));
const pa = p.collections.find(c=>c.name==='bcn005_articles');
check('relation field target resolved via collectionId', () => pa.fields.find(f=>f.name==='author')?.relationTarget==='bcn005_authors');
check('maxSelect 1 -> many-to-one', () => pa.fields.find(f=>f.name==='author')?.relationType==='many-to-one');
check('maxSelect 99 -> many-to-many', () => pa.fields.find(f=>f.name==='tags')?.relationType==='many-to-many');
const users = p.collections.find(c=>c.name==='users');
check('password field hidden', () => users.fields.find(f=>f.name==='password')?.hidden===true);
check('tokenKey hidden', () => users.fields.find(f=>f.name==='tokenKey')?.hidden===true);
check('email NOT hidden', () => users.fields.find(f=>f.name==='email')?.hidden===undefined);
// ⚠️ At the PARSER level, not just the sync level. Mutating the parser's own
// collectionId resolution left the sync green, because applyRelationsToSchema
// re-established the target from the contract's descriptor. The two agree — so only a
// check that never runs the enrichment can tell them apart.
const pbRaw = await (await fetch('http://localhost:8091/api/collections?perPage=500', { headers: { Authorization: pbTok } })).json();
const pbParsedOnly = parsePocketbaseSchema(pbRaw);
check('parser alone (no enrichment) resolves the relation target', () =>
  pbParsedOnly.collections.find(c=>c.name==='bcn005_articles').fields.find(f=>f.name==='author').relationTarget==='bcn005_authors');
check('parser alone reads cardinality from maxSelect', () =>
  pbParsedOnly.collections.find(c=>c.name==='bcn005_articles').fields.find(f=>f.name==='author').relationType==='many-to-one');
check('the schema request asks for the whole collection list, not page 1 of 30', () =>
  schemaRequestPath('pocketbase', '/api/collections') === '/api/collections?perPage=500' &&
  schemaRequestPath('directus', '/fields') === '/fields');
const pbPage = await (await fetch('http://localhost:8091/api/collections?perPage=5', { headers: { Authorization: pbTok } })).json();
console.log('  (negative control: ?perPage=5 ->', pbPage.items.length, 'of', pbPage.totalItems, 'collections)');
// ⚠️ Not `totalItems === 12`: the rig is SHARED and other workers add collections.
// A check coupled to another worker's fixture count fails for a reason that is not about this code.
check('PocketBase really does truncate a collection list', () => pbPage.items.length === 5 && pbPage.totalItems > 5);
const pbAnon = await fetch('http://localhost:8091/api/collections');
console.log('  (negative control: /api/collections unauthenticated ->', pbAnon.status + ')');
check('unauthenticated collection list is refused', pbAnon.status===401, String(pbAnon.status));

// Parse
console.log('\n=== PARSE ===');
const q = await syncBackend({ type:'parse', url:'http://localhost:8092/parse', schemaPath:'/schemas', headers:{'X-Parse-Application-Id':'uba-e2e-app','X-Parse-Master-Key':'uba-e2e-master-key'} });
const qRel = (q.relations||[]).find(r=>r.collection==='Bcn005Article'&&r.field==='tags');
check('Relation -> op write', () => qRel?.write?.kind==='op' && qRel.target==='Bcn005Tag', JSON.stringify(qRel));


// ── pure paths: the refusal, the O2M label, and the credential ──────────────
console.log('\n=== PURE ===');
check('a failed Directus relation fetch is undefined, not []',
  parseRelationsResponse('directus', {}, undefined) === undefined &&
  parseRelationsResponse('directus', {}, { errors: [] }) === undefined);
check('a reverse O2M is labelled one-to-many, not many-to-many', (() => {
  const sc = { version:'1', fetchedAt:new Date(), collections:[{name:'authors', primaryKey:'id', fields:[{name:'articles', displayName:'articles', type:'alias', nativeType:'alias', required:false}]}] };
  applyRelationsToSchema(sc, [{collection:'authors', field:'articles', target:'articles', cardinality:'many', write:{kind:'foreignKey', field:'author', on:'target'}}]);
  return sc.collections[0].fields[0].relationType === 'one-to-many';
})());
check('custom backends have no relation model', parseRelationsResponse('custom', [{name:'x'}]) === undefined);
const META = { backendServices: { backends: [ { id:'b1', auth: { method:'bearer', adminToken:'SECRET-ADMIN-TOKEN', publicToken:'pub' } }, { id:'b2', auth: { method:'basic', username:'admin', password:'hunter2' } } ] } };
const SAFE = withoutEditorOnlyCredentials(JSON.parse(JSON.stringify(META)));
check('admin token stripped from an export', !JSON.stringify(SAFE).includes('SECRET-ADMIN-TOKEN'), JSON.stringify(SAFE));
check('basic-auth pair stripped from an export', !JSON.stringify(SAFE).includes('hunter2'));
check('public token kept (published on purpose, disclosed on the card)', SAFE.backendServices.backends[0].auth.publicToken === 'pub');
check('the editor\'s own copy is not mutated', META.backendServices.backends[0].auth.adminToken === 'SECRET-ADMIN-TOKEN');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
