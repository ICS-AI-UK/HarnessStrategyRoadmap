// Copy a plan backup (from "Download backup") into the live Netlify site's storage, using your Netlify CLI sign-in:
//
//   node scripts/push-to-netlify.mjs <backup.json> [--site <site-id>] [--region eu-central-1] [--store harness-plan]
//
// It writes the plan in exactly the layout the app reads (see src/store.js), replacing every plan item on the site,
// the list of people who have used it and the photos in the backup. The site's sign-in secret, lockout counts and
// saved exports are left alone. Version links to exports the site does not have are dropped, as a restore does.
// Needs the Netlify CLI (npm install -g netlify-cli) signed in with `netlify login`.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const file = args.find(a => !a.startsWith('--') && !['--site', '--region', '--store'].includes(args[args.indexOf(a) - 1]));
const SITE = opt('site', 'b811730f-990f-4963-b713-517a07fef773');
const REGION = opt('region', 'eu-central-1');
const STORE = opt('store', 'harness-plan');
const COLLECTIONS = ['actions', 'inits', 'people', 'leave', 'todos', 'versions', 'meta', 'comments'];
const DOC_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
if (!file) { console.error('Usage: node scripts/push-to-netlify.mjs <backup.json>'); process.exit(1); }

const cli = (...a) => execFileSync(process.platform === 'win32' ? 'netlify.cmd' : 'netlify', a, { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
const common = ['--region', REGION, '--force'];
const backup = JSON.parse(await readFile(file, 'utf8'));
if (backup.app !== 'harness-plan' || backup.format !== 1) throw new Error('That file is not a Harness plan backup.');

console.log(`Linking to site ${SITE}…`);
cli('link', '--id', SITE);
const listKeys = () => { const out = cli('blobs:list', STORE, '--region', REGION, '--json'); const j = JSON.parse(out || '{}'); return (j.blobs || j || []).map(b => b.key).filter(Boolean); };
const existing = listKeys();
const exportsHere = new Set(existing.filter(k => k.startsWith('export/')).map(k => k.slice(7)));
console.log(`Site store has ${existing.length} entries now.`);

const tmp = await mkdtemp(path.join(tmpdir(), 'harness-push-'));
let n = 0;
// Each CLI call takes a few seconds, so several run at once.
const cliAsync = (...a) => promisify(execFile)(process.platform === 'win32' ? 'netlify.cmd' : 'netlify', a, { shell: process.platform === 'win32' });
const pool = async (items, limit, fn) => { let i = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) await fn(items[i++]); })); };
let done = 0, total = 0;
const put = async (key, data) => {
  const f = path.join(tmp, 'v' + (n++)); await writeFile(f, data);
  await cliAsync('blobs:set', STORE, key, '--input', f, ...common);
  console.log(`  ${++done}/${total}  ${key}`);
};
try {
  // People, leave, to-dos and photos first: they are what is missing on a freshly seeded site.
  const ORDER = ['people', 'leave', 'todos', 'inits', 'meta', 'versions', 'actions', 'comments'];
  const writes = [], wanted = new Set();
  for (const id of Object.keys(backup.photos || {})) if (/^[0-9a-f]{32}$/.test(id)) writes.push(['asset/' + id, Buffer.from(String(backup.photos[id].data || ''), 'base64')]);
  if (backup.users && typeof backup.users === 'object') writes.push(['sys/users', JSON.stringify(backup.users)]);
  for (const c of ORDER) {
    for (const d of Array.isArray(backup.collections[c]) ? backup.collections[c] : []) {
      if (!d || typeof d.id !== 'string' || !DOC_ID.test(d.id)) continue;
      const { id, ...body } = d;
      if (c === 'versions' && body.snapshot && !exportsHere.has(body.snapshot)) { delete body.snapshot; delete body.snapshotAt; }
      const key = `doc/${c}/${id}`; wanted.add(key);
      writes.push([key, JSON.stringify(body)]);
    }
  }
  total = writes.length;
  await pool(writes, 8, ([key, data]) => put(key, data));
  const stale = existing.filter(k => k.startsWith('doc/') && !wanted.has(k));
  await pool(stale, 8, k => cliAsync('blobs:delete', STORE, k, ...common));
  // New change tokens for every collection, so browsers that have the plan open reload it.
  await put('sys/revs', JSON.stringify(Object.fromEntries(COLLECTIONS.map(c => [c, crypto.randomBytes(6).toString('hex')]))));
  const count = c => (backup.collections[c] || []).length;
  console.log(`Done: ${wanted.size} plan items (${COLLECTIONS.map(c => `${c} ${count(c)}`).join(', ')}), ${Object.keys(backup.photos || {}).length} photos; removed ${stale.length} items not in the backup.`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
