// Key-value storage on the local file system: the same interface as Netlify Blobs (src/kv/netlify.js), so the app
// runs unchanged on your machine and on Netlify.
//
//   getJSON(key)                     -> { data, etag } | null
//   setJSON(key, data, { ifMatch | ifNew }) -> { ok }     (ok is false when the condition fails)
//   getBytes(key)                    -> { data: Buffer, meta } | null
//   setBytes(key, data, meta)        -> { ok }
//   delete(key), list(prefix)        -> keys
//
// Each key is a file under `dir` (slashes become folders; each part is percent-encoded so characters Windows does
// not allow in file names, such as ":", are safe). ETags are content hashes, and writes run one at a time within
// this process, so conditional writes behave like the hosted store.
import { readFile, writeFile, mkdir, unlink, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const enc = s => encodeURIComponent(s).replace(/\*/g, '%2A');
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };

export function fsKV(dir) {
  const fileOf = key => {
    const parts = String(key).split('/');
    if (!key || parts.some(s => !s || s === '.' || s === '..' || /[\u0000-\u001f]/.test(s))) throw new Error(`Bad storage key: ${key}`);
    return path.join(dir, ...parts.map(enc));
  };
  const etagOf = buf => crypto.createHash('sha1').update(buf).digest('hex');
  let queue = Promise.resolve();
  const serial = fn => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };
  const readRaw = async key => { try { return await readFile(fileOf(key)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
  const writeRaw = async (key, buf) => {
    const f = fileOf(key), tmp = f + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(tmp, buf); await rename(tmp, f);   // atomic replace: a reader never sees half a file
  };

  return {
    kind: 'files',
    async getJSON(key) {
      const buf = await readRaw(key); if (!buf) return null;
      return { data: JSON.parse(buf.toString('utf8')), etag: etagOf(buf) };
    },
    setJSON(key, data, cond = {}) {
      return serial(async () => {
        const cur = await readRaw(key);
        if (cond.ifNew && cur) return { ok: false };
        if (cond.ifMatch && (!cur || etagOf(cur) !== cond.ifMatch)) return { ok: false };
        await writeRaw(key, Buffer.from(JSON.stringify(data), 'utf8'));
        return { ok: true };
      });
    },
    async getBytes(key) {
      const buf = await readRaw(key); if (!buf) return null;
      const meta = await readRaw(key + '.meta.json');
      return { data: buf, meta: meta ? JSON.parse(meta.toString('utf8')) : {} };
    },
    setBytes(key, data, meta = {}) {
      return serial(async () => { await writeRaw(key + '.meta.json', Buffer.from(JSON.stringify(meta))); await writeRaw(key, Buffer.from(data)); return { ok: true }; });
    },
    delete(key) {
      return serial(async () => { for (const k of [key, key + '.meta.json']) await unlink(fileOf(k)).catch(e => { if (e.code !== 'ENOENT') throw e; }); });
    },
    async list(prefix = '') {
      const out = [];
      const walk = async (d, rel) => {
        let entries; try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const k = rel ? rel + '/' + dec(e.name) : dec(e.name);
          if (e.isDirectory()) await walk(path.join(d, e.name), k);
          else if (!e.name.endsWith('.meta.json') && !e.name.endsWith('.tmp') && k.startsWith(prefix)) out.push(k);
        }
      };
      await walk(dir, '');
      return out.sort();
    },
  };
}
