// One-time move from the original SQLite storage (data/plan.db, data/uploads/, data/exports/) to the key-value
// layout in src/store.js. Runs on a local start when plan.db exists and the new storage is still empty. Nothing is
// deleted: plan.db is renamed to plan.db.migrated-<date>, and the uploads and exports folders are left in place.
import { readFile, readdir, rename, access } from 'node:fs/promises';
import path from 'node:path';

export async function migrateFromSqlite(store, dataDir, log = console.log) {
  const dbFile = path.join(dataDir, 'plan.db');
  try { await access(dbFile); } catch { return false; }
  if (!(await store.isEmpty())) return false;
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const cols = {};
  for (const r of db.prepare('SELECT collection, id, data FROM docs').all()) (cols[r.collection] ||= {})[r.id] = JSON.parse(r.data);
  const users = {};
  for (const r of db.prepare('SELECT id, name, seen_at FROM users').all()) users[r.id] = { name: r.name, seen: r.seen_at };
  const assets = db.prepare('SELECT id, content_type, file FROM assets').all();
  db.close();

  let photos = 0, exports = 0;
  for (const a of assets) {
    try { await store.addAsset(a.id, a.content_type, await readFile(path.join(dataDir, 'uploads', a.file))); photos++; }
    catch { log(`  photo ${a.id} could not be read and was skipped`); }
  }
  try {
    for (const f of await readdir(path.join(dataDir, 'exports'))) {
      if (/^[A-Za-z0-9._-]+\.html$/.test(f)) { await store.saveExport(f, await readFile(path.join(dataDir, 'exports', f), 'utf8')); exports++; }
    }
  } catch { /* no exports folder */ }
  await store.replaceUsers(users);
  await store.replaceCollections(cols);   // last, so an interrupted run is retried (storage still looks empty)
  const kept = `plan.db.migrated-${new Date().toISOString().slice(0, 10)}`;
  await rename(dbFile, path.join(dataDir, kept));
  const n = Object.values(cols).reduce((s, d) => s + Object.keys(d).length, 0);
  log(`Moved ${n} plan records, ${Object.keys(users).length} people, ${photos} photos and ${exports} exports from plan.db to the new storage. The old database is kept as data/${kept}.`);
  return true;
}
