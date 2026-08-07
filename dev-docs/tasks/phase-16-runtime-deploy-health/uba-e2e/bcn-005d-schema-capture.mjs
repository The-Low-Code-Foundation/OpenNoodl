// Capture the RAW schema payloads every editor parser is fed, from live servers.
import { writeFileSync } from 'node:fs';
const OUT = '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/68d1c7c7-cb68-4f0c-829f-802a51ab8fb8/scratchpad/bcn005d';
const save = (n, d) => { writeFileSync(`${OUT}/${n}.json`, JSON.stringify(d, null, 2)); console.log(`saved ${n}`); };

// ── Directus
const dLogin = await (await fetch('http://localhost:8055/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
})).json();
const dTok = dLogin.data.access_token;
console.log('directus token len', dTok.length);
save('directus-fields', await (await fetch('http://localhost:8055/fields', { headers: { Authorization: `Bearer ${dTok}` } })).json());
save('directus-relations', await (await fetch('http://localhost:8055/relations', { headers: { Authorization: `Bearer ${dTok}` } })).json());
// what does /relations answer WITHOUT the token?
const anon = await fetch('http://localhost:8055/relations');
console.log('directus /relations anon ->', anon.status);

// ── PostgREST
const pgRoot = await fetch('http://localhost:8056/');
console.log('postgrest / ->', pgRoot.status, pgRoot.headers.get('content-type'));
save('postgrest-root', await pgRoot.json());

// ── PocketBase
const pbLogin = await (await fetch('http://localhost:8091/api/collections/_superusers/auth-with-password', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
})).json();
const pbTok = pbLogin.token;
console.log('pocketbase token?', Boolean(pbTok), pbLogin.message || '');
const pbCols = await (await fetch('http://localhost:8091/api/collections?perPage=200', { headers: { Authorization: pbTok } })).json();
save('pocketbase-collections', pbCols);
console.log('pocketbase totalItems', pbCols.totalItems, 'items', (pbCols.items||[]).length);

// ── Parse
const pRes = await fetch('http://localhost:8092/schemas', {
  headers: { 'X-Parse-Application-Id': 'uba-e2e-app', 'X-Parse-Master-Key': 'uba-e2e-master-key' }
});
console.log('parse /schemas ->', pRes.status);
save('parse-schemas', await pRes.json());
