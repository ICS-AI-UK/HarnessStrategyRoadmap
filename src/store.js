// Plan storage on a key-value store (local files or Netlify Blobs; see src/kv/).
//
// Layout:
//   doc/<collection>/<id>   one record per plan item (an action, a person, a to-do, ...)
//   sys/revs                { <collection>: token }  changes whenever a collection changes; browsers poll it
//   sys/users               { <id>: { name, seen } }  people who have used the app, for "last change by"
//   asset/<id>              an uploaded photo (its type kept as metadata)
//   export/<file>           a saved read-only HTML export
//   sys/secret, sys/fails/<address>                   sign-in secret and failed-attempt counts (src/gate.js)
//
// Each plan item is its own record, so people editing different items never touch the same record and no change
// can be lost. Two people saving the same item at the same moment: the last save wins. Changes that must merge
// (field updates, the users list, the change tokens) read and write with a condition and retry on conflict.
import crypto from 'node:crypto';

export const COLLECTIONS = ['actions', 'inits', 'people', 'leave', 'todos', 'versions', 'meta'];
const token = () => crypto.randomBytes(6).toString('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function sniffImage(b) {
  if (!b || b.length < 12) return 'application/octet-stream';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

// Run fn over items with at most `limit` in flight (keeps hosted storage requests reasonable).
async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

export function openStore(kv) {
  // Apply fn to the current value of key and write the result, retrying if someone else wrote in between.
  async function mutate(key, empty, fn) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const cur = await kv.getJSON(key);
      const next = fn(cur ? cur.data : structuredClone(empty));
      if (next === undefined) return cur ? cur.data : empty;   // nothing to change
      const { ok } = await kv.setJSON(key, next, cur ? { ifMatch: cur.etag } : { ifNew: true });
      if (ok) return next;
      await sleep(20 + Math.random() * 80 * (attempt + 1));
    }
    throw Object.assign(new Error('The plan was busy; try again.'), { status: 503, code: 'unavailable' });
  }
  const docKey = (c, id) => `doc/${c}/${id}`;
  const bump = cols => mutate('sys/revs', {}, revs => { for (const c of cols) revs[c] = token(); return revs; });
  const idsOf = async c => (await kv.list(`doc/${c}/`)).map(k => k.slice(`doc/${c}/`.length));
  const readCol = async c => {
    const ids = await idsOf(c);
    const docs = await pool(ids, 24, id => kv.getJSON(docKey(c, id)));
    return ids.map((id, n) => docs[n] ? { id, ...docs[n].data } : null).filter(Boolean);
  };
  let usersCache = null;

  return {
    kv,
    list: readCol,
    async all() {
      const cols = await Promise.all(COLLECTIONS.map(readCol));
      return Object.fromEntries(COLLECTIONS.map((c, n) => [c, cols[n]]).filter(([, l]) => l.length));
    },
    async get(col, id) { const r = await kv.getJSON(docKey(col, id)); return r ? r.data : null; },
    async set(col, id, body) { await kv.setJSON(docKey(col, id), body); await bump([col]); },
    // Merge fields into an existing item. Returns false when it does not exist.
    async update(col, id, patch) {
      let found = false;
      await mutate(docKey(col, id), null, v => { if (!v) return undefined; found = true; return { ...v, ...patch }; });
      if (found) await bump([col]);
      return found;
    },
    async remove(col, id) {
      const had = !!(await kv.getJSON(docKey(col, id)));
      await kv.delete(docKey(col, id));
      if (had) await bump([col]);
      return had;
    },
    // Replace whole collections (first-run seeding, restore from backup): items not in `docs` are removed.
    async replaceCollections(map) {
      for (const [col, docs] of Object.entries(map)) {
        const keep = new Set(Object.keys(docs));
        await pool((await idsOf(col)).filter(id => !keep.has(id)), 16, id => kv.delete(docKey(col, id)));
        await pool(Object.entries(docs), 16, ([id, body]) => kv.setJSON(docKey(col, id), body));
      }
      await bump(Object.keys(map));
    },
    async isEmpty() { return (await kv.list('doc/actions/')).length === 0 && (await kv.list('doc/versions/')).length === 0; },
    async revs() { return ((await kv.getJSON('sys/revs')) || { data: {} }).data; },

    // People who have used the app (only written when a name is new or has changed).
    async seen(id, name) {
      if (!id) return;
      if (!usersCache) usersCache = ((await kv.getJSON('sys/users')) || { data: {} }).data;
      if (usersCache[id] && usersCache[id].name === name) return;
      usersCache = await mutate('sys/users', {}, u => { if (u[id] && u[id].name === name) return undefined; u[id] = { name: name || '', seen: new Date().toISOString() }; return u; });
    },
    async users() { return ((await kv.getJSON('sys/users')) || { data: {} }).data; },
    async userName(id) { const u = await this.users(); return (u[id] && u[id].name) || ''; },
    async replaceUsers(users) { usersCache = null; await mutate('sys/users', {}, () => users); },

    // Photos: bytes at asset/<id>, with their type kept as metadata.
    async addAsset(id, type, data) { await kv.setBytes('asset/' + id, data, { type, bytes: data.length, at: new Date().toISOString() }); },
    // The type comes from the stored metadata; photos written without it (e.g. by the Netlify CLI) are recognised
    // from their first bytes, so browsers still display them.
    async assetMeta(id) { const r = await kv.getBytes('asset/' + id); return r ? { type: (r.meta && r.meta.type) || sniffImage(r.data) } : null; },
    async assetBytes(id) { const r = await kv.getBytes('asset/' + id); return r ? r.data : null; },
    async removeAsset(id) { const had = !!(await kv.getBytes('asset/' + id)); await kv.delete('asset/' + id); return had; },
    async assetIds() { return (await kv.list('asset/')).map(k => k.slice(6)); },

    // Saved read-only exports.
    async saveExport(file, html) { await kv.setBytes('export/' + file, Buffer.from(html, 'utf8'), { type: 'text/html' }); },
    async exportBytes(file) { const r = await kv.getBytes('export/' + file); return r ? r.data : null; },
    async exportExists(file) { return (await kv.list('export/' + file)).includes('export/' + file); },
    async exportNames() { return (await kv.list('export/')).map(k => k.slice(7)); },
  };
}
