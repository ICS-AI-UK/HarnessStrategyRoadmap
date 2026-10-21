// Key-value storage on Netlify Blobs, with the same interface as src/kv/fs.js.
// Strong consistency, so a read straight after a write sees it; conditional writes (onlyIfMatch / onlyIfNew) let
// two people save at the same time without either change being lost.
//
// BLOBS_STORE  store name (default "harness-plan")
// BLOBS_REGION where the data is held (default "eu-central-1", Frankfurt; Netlify offers no UK region)
export async function netlifyKV(env = process.env) {
  const { getStore } = await import('@netlify/blobs');
  // The store handle carries the access token of the request it was made in, and that token expires. A function
  // instance stays warm across many requests, so a handle made once fails later with "Token expired". Each call
  // therefore makes a fresh handle (cheap: no network), which picks up the current request's token.
  const opts = { name: env.BLOBS_STORE || 'harness-plan', consistency: 'strong', region: env.BLOBS_REGION || 'eu-central-1' };
  const store = new Proxy({}, { get: (_, k) => { const s = getStore(opts); const v = s[k]; return typeof v === 'function' ? v.bind(s) : v; } });
  const cond = c => c.ifMatch ? { onlyIfMatch: c.ifMatch } : c.ifNew ? { onlyIfNew: true } : {};
  // Some Blobs endpoints (Netlify's local test server among them) do not return the ETag on a read, only on a
  // listing. Then the ETag is taken from a listing FIRST and the value read after it: if the value changes in
  // between, the ETag is older than the data, the conditional write is refused, and the caller retries. No change
  // can be lost that way, only retried.
  let etagOnRead = true;
  const etagFromList = async key => { const { blobs } = await store.list({ prefix: key }); const b = blobs.find(x => x.key === key); return b ? b.etag : null; };
  return {
    kind: 'netlify-blobs',
    async getJSON(key) {
      if (etagOnRead) {
        const r = await store.getWithMetadata(key, { type: 'json' });
        if (!r) return null;
        if (r.etag) return { data: r.data, etag: r.etag };
        etagOnRead = false;   // fall through to the list-then-read way, and use it from now on
      }
      const etag = await etagFromList(key);
      if (!etag) return null;
      const data = await store.get(key, { type: 'json' });
      return data === null ? null : { data, etag };
    },
    async setJSON(key, data, c = {}) {
      const r = await store.setJSON(key, data, cond(c));
      return { ok: r ? r.modified !== false : true };
    },
    async getBytes(key) {
      const r = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      return r && r.data ? { data: Buffer.from(r.data), meta: r.metadata || {} } : null;
    },
    async setBytes(key, data, meta = {}) {
      const buf = Buffer.from(data);
      await store.set(key, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { metadata: meta });
      return { ok: true };
    },
    async delete(key) { await store.delete(key); },
    async list(prefix = '') {
      const { blobs } = await store.list({ prefix });
      return blobs.map(b => b.key).sort();
    },
  };
}
