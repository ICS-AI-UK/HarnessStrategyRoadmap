// Smoke test for the Netlify deployment, run locally: `npm run test:netlify`.
// Starts Netlify's own local Blobs server (from @netlify/blobs), points the Netlify Function at it exactly as Netlify
// would, and drives the function with real requests: sign-in, seeding, saving, many saves at once, photos,
// versions with saved exports, backup and restore. Uses a temporary folder that is deleted afterwards.
import { BlobsServer } from '@netlify/blobs/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(path.join(tmpdir(), 'harness-blobs-'));
const token = 'local-test-token';
const server = new BlobsServer({ directory: dir, token });
const { port } = await server.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}`, siteID: 'local-test-site', token })).toString('base64');
process.env.APP_PASSWORD = 'test-password-123';
delete process.env.ALLOW_NO_PASSWORD;

await import('./build-netlify.mjs');
const fn = (await import('../netlify/functions/app.mjs')).default;
const base = 'https://plan.example.netlify.app';
let cookie = '', failures = 0;
const call = async (method, p, { body, type, ip = '203.0.113.7', headers = {} } = {}) => {
  const h = new Headers(headers);
  if (cookie) h.set('cookie', cookie);
  if (type) h.set('content-type', type);
  if (method !== 'GET') h.set('origin', base);
  return fn(new Request(base + p, { method, headers: h, body }), { ip });
};
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`); };

try {
  let r = await call('GET', '/');
  check('signed-out page goes to sign-in', r.status === 302 && r.headers.get('location').startsWith('/login'));
  r = await call('GET', '/api/data');
  check('signed-out data call refused', r.status === 401);
  r = await call('POST', '/login', { body: 'password=wrong', type: 'application/x-www-form-urlencoded' });
  check('wrong password refused', r.status === 401);
  r = await call('POST', '/login', { body: 'password=test-password-123&name=Test+Person&next=%2F', type: 'application/x-www-form-urlencoded' });
  const set = r.headers.getSetCookie();
  check('right password signs in with a Secure cookie', r.status === 303 && set.some(c => c.startsWith('harness_session=') && /HttpOnly/.test(c) && /Secure/.test(c)));
  cookie = set.map(c => c.split(';')[0]).join('; ');

  r = await call('GET', '/');
  check('plan page served', r.status === 200 && (await r.text()).includes('/adapter.js'));
  r = await call('GET', '/api/me'); const me = await r.json();
  check('signed-in name used', me.name === 'Test Person' && me.storage === 'netlify-blobs', me.storage);
  r = await call('GET', '/api/data'); const data = await r.json();
  check('empty store seeded with the draft plan', (data.actions || []).length >= 48 && (data.versions || []).length >= 1, `${(data.actions || []).length} actions`);

  const revs0 = await (await call('GET', '/api/revs')).json();
  r = await call('PUT', '/api/c/todos/t1', { body: JSON.stringify({ text: 'first', done: false }), type: 'application/json' });
  const revs1 = await (await call('GET', '/api/revs')).json();
  check('save works and the change signal moves', r.status === 200 && revs1.todos && revs1.todos !== revs0.todos);

  await Promise.all(Array.from({ length: 10 }, (_, n) => call('PUT', `/api/c/todos/p${n}`, { body: JSON.stringify({ text: 'parallel ' + n }), type: 'application/json' })));
  const todos = await (await call('GET', '/api/c/todos')).json();
  check('ten saves at once: none lost', todos.length === 11, `${todos.length} of 11`);

  r = await call('PATCH', '/api/c/todos/t1', { body: JSON.stringify({ done: true }), type: 'application/json' });
  const t1 = await (await call('GET', '/api/c/todos/t1')).json();
  check('update merges fields', r.status === 200 && t1.done === true && t1.text === 'first');

  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  r = await call('POST', '/api/assets', { body: png, type: 'image/png' }); const asset = await r.json();
  r = await call('GET', '/_blob/' + asset.id);
  check('photo upload and download', r.status === 200 && r.headers.get('content-type') === 'image/png' && Buffer.from(await r.arrayBuffer()).equals(png));

  r = await call('POST', '/api/c/versions', { body: JSON.stringify({ version: '9.9', date: '2026-10-20', by: 'Test', notes: 'test' }), type: 'application/json' });
  const vid = (await r.json()).id; const v = await (await call('GET', '/api/c/versions/' + vid)).json();
  r = v.snapshot ? await call('GET', '/exports/' + v.snapshot) : { status: 0 };
  check('recording a version saves a read-only export', r.status === 200 && (await r.text()).includes('window.SNAPSHOT'), v.snapshot);

  r = await call('GET', '/api/backup'); const backup = await r.text();
  await call('DELETE', '/api/c/todos/t1');
  r = await call('POST', '/api/restore?confirm=replace-everything', { body: backup, type: 'application/json' });
  const after = await (await call('GET', '/api/c/todos')).json();
  check('backup and restore', r.status === 200 && after.length === 11);

  for (let n = 0; n < 10; n++) await call('POST', '/login', { body: 'password=nope', type: 'application/x-www-form-urlencoded', ip: '198.51.100.9' });
  r = await call('POST', '/login', { body: 'password=test-password-123', type: 'application/x-www-form-urlencoded', ip: '198.51.100.9' });
  check('lockout after repeated wrong passwords (kept in storage)', r.status === 429);
} catch (e) {
  failures++; console.error('ERROR', e);
} finally {
  await server.stop();
  await rm(dir, { recursive: true, force: true });
  await rm(path.join(root, 'src', 'assets.gen.js'), { force: true });
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
