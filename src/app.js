// The Harness plan app as one request handler: (Request) -> Response, using only web-standard Request/Response.
// The local server (server.js) and the Netlify Function (netlify/functions/app.mjs) both call it, so the same code
// runs in both places; only the storage back end and how the page files are read differ.
import crypto from 'node:crypto';
import { openStore, COLLECTIONS } from './store.js';
import { loadAuthConfig, identify } from './identity.js';
import { buildSnapshot, snapshotFileName } from './snapshot.js';
import { seedIfEmpty } from './seed.js';
import { createGate, loginPage, safeNext, cleanName } from './gate.js';

const DOC_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const ASSET_ID = /^[0-9a-f]{32}$/;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_JSON = 256 * 1024;
const MAX_IMAGE = 4 * 1024 * 1024;       // Netlify Functions accept request bodies up to about 6 MB
const MAX_BACKUP = 5.5 * 1024 * 1024;
const SECURITY = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-robots-tag': 'noindex, nofollow', 'x-frame-options': 'DENY' };

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

function respond(status, body, headers = {}) {
  const h = new Headers({ ...SECURITY, 'cache-control': 'no-store', ...headers });
  if (body === null || body === undefined || status === 204) return new Response(null, { status, headers: h });
  if (typeof body === 'string' || body instanceof Uint8Array) {
    if (!h.has('content-type')) h.set('content-type', 'text/plain; charset=utf-8');
    return new Response(body, { status, headers: h });
  }
  h.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: h });
}
const redirect = (location, status = 302, cookies = []) => {
  const h = new Headers({ ...SECURITY, location, 'cache-control': 'no-store' });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status, headers: h });
};

async function readBytes(req, limit) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > limit) throw new HttpError(413, 'too_large', 'That is too large.');
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > limit) throw new HttpError(413, 'too_large', 'That is too large.');
  return buf;
}
async function readJson(req, limit = MAX_JSON) {
  let v;
  try { v = JSON.parse((await readBytes(req, limit)).toString('utf8') || 'null'); }
  catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'invalid_argument', 'The request body is not valid JSON.'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'invalid_argument', 'The document must be a JSON object.');
  return v;
}

/**
 * kv      storage back end (src/kv/fs.js or src/kv/netlify.js)
 * assets  { page(): Promise<string>, adapter(): Promise<string> } — the plan page and browser adapter source
 * env     settings (process.env)
 */
export async function createApp({ kv, assets, env = process.env, log = console.log }) {
  const auth = loadAuthConfig(env);
  // Fails closed: without APP_PASSWORD the app will not serve the plan, unless sign-in is handled by Azure App
  // Service Authentication (AUTH_MODE=easyauth) or ALLOW_NO_PASSWORD=1 is set deliberately for local use.
  if (!env.APP_PASSWORD && auth.mode !== 'easyauth' && env.ALLOW_NO_PASSWORD !== '1') {
    throw new Error('APP_PASSWORD is not set, so the plan would be open to anyone who can reach it. Set APP_PASSWORD and start again.');
  }
  const store = openStore(kv);
  const gate = await createGate({ password: env.APP_PASSWORD || '', kv, days: Number(env.SESSION_DAYS) || 14, secret: env.SESSION_SECRET || '' });
  let seeded = false;
  const ensureSeeded = async () => { if (!seeded) { await seedIfEmpty(store, await assets.page(), log); seeded = true; } };

  const requireWrite = who => { if (!who.canWrite) throw new HttpError(403, 'invalid_argument', 'You do not have permission to write to this plan.'); };
  const checkCol = c => { if (!COLLECTIONS.includes(c)) throw new HttpError(404, 'invalid_argument', `Unknown collection "${c}".`); };
  const checkId = id => { if (!DOC_ID.test(id) || id === '.' || id === '..') throw new HttpError(400, 'invalid_argument', 'That document id is not allowed.'); };

  const pageWithAdapter = async () => (await assets.page()).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script src="/adapter.js"></script>');
  const makeSnapshot = async (version, who) => buildSnapshot({ pageHtml: await assets.page(), adapterJs: await assets.adapter(), store, version, exportedBy: who.name });
  const uniqueExportName = async base => { let name = base, n = 2; while (await store.exportExists(name)) name = base.replace(/\.html$/, `-${n++}.html`); return name; };
  // Recording a version freezes a read-only HTML copy of the plan as it stands, and links it from that version.
  async function snapshotVersion(id, who) {
    const v = await store.get('versions', id);
    if (!v || v.snapshot) return;
    const file = await uniqueExportName(snapshotFileName(v.version));
    await store.saveExport(file, await makeSnapshot(v.version, who));
    await store.update('versions', id, { snapshot: file, snapshotAt: new Date().toISOString() });
  }

  async function route(req, ip) {
    const url = new URL(req.url);
    const p = url.pathname, m = req.method;
    const secure = url.protocol === 'https:' || String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https' || env.COOKIE_SECURE === '1';

    // Open to everyone: the health check, robots.txt, and signing in and out.
    if (m === 'GET' && p === '/healthz') return respond(200, { ok: true, storage: kv.kind });
    if (m === 'GET' && p === '/robots.txt') return respond(200, 'User-agent: *\nDisallow: /\n');
    if (gate && p === '/login') {
      if (m === 'GET') {
        if (gate.ok(req.headers)) return redirect(safeNext(url.searchParams.get('next')));
        return respond(200, loginPage({ next: safeNext(url.searchParams.get('next')) }), { 'content-type': 'text/html; charset=utf-8' });
      }
      if (m === 'POST') {
        const form = new URLSearchParams((await readBytes(req, 4096)).toString('utf8'));
        const next = safeNext(form.get('next')), name = cleanName(form.get('name'));
        const page = (status, error) => respond(status, loginPage({ next, error, name }), { 'content-type': 'text/html; charset=utf-8' });
        const locked = await gate.lockedFor(ip);
        if (locked) return page(429, `Too many wrong passwords. Try again in ${locked} minute${locked === 1 ? '' : 's'}.`);
        if (!gate.check(form.get('password') || '')) {
          await gate.recordFail(ip);
          await new Promise(r => setTimeout(r, 600));   // slow down guessing
          return page(401, 'That password is not right. Check it and try again.');
        }
        await gate.clearFails(ip);
        return redirect(next, 303, gate.sessionCookies(secure, name));
      }
    }
    if (gate && p === '/logout' && m === 'POST') return redirect('/login', 303, gate.clearCookies(secure));
    // Everything else needs a valid session cookie: pages go to the sign-in page, data calls get 401.
    if (gate && !gate.ok(req.headers)) {
      if (p.startsWith('/api/') || p.startsWith('/_blob/') || p.startsWith('/exports/')) return respond(401, { code: 'unauthenticated', message: 'Sign in to continue.' });
      return redirect('/login' + (p === '/' ? '' : '?next=' + encodeURIComponent(p + url.search)));
    }
    // Changes must come from this site's own pages (defence against cross-site requests).
    if (m !== 'GET' && m !== 'HEAD' && req.headers.get('origin')) {
      let same = false; try { same = new URL(req.headers.get('origin')).host === url.host; } catch { /* bad origin */ }
      if (!same) return respond(403, { code: 'invalid_argument', message: 'Changes must come from this site.' });
    }

    await ensureSeeded();
    const who = identify(req.headers, auth);
    if (who.id) await store.seen(who.id, who.name);

    if (m === 'GET' && (p === '/' || p === '/index.html' || p === '/plan.html')) return respond(200, await pageWithAdapter(), { 'content-type': 'text/html; charset=utf-8' });
    if (m === 'GET' && p === '/adapter.js') return respond(200, await assets.adapter(), { 'content-type': 'text/javascript; charset=utf-8' });
    if (m === 'GET' && p === '/api/me') return respond(200, { id: who.id, name: who.name, signedIn: who.signedIn, canWrite: who.canWrite, authMode: auth.mode, passwordGate: !!gate, storage: kv.kind });
    if (m === 'GET' && p === '/api/data') return respond(200, await store.all());
    // Live updates: browsers poll this small record and reload only the collections whose token changed.
    if (m === 'GET' && p === '/api/revs') return respond(200, await store.revs());
    if (m === 'GET' && p === '/api/profiles') {
      const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 64), users = await store.users();
      return respond(200, Object.fromEntries(ids.map(id => [id, { id, name: (users[id] && users[id].name) || '' }])));
    }

    // Plan documents: /api/c/<collection>[/<id>]
    const cm = p.match(/^\/api\/c\/([a-z]+)(?:\/([^/]+))?$/);
    if (cm) {
      const col = cm[1]; checkCol(col);
      const id = cm[2] !== undefined ? decodeURIComponent(cm[2]) : null;
      if (id !== null) checkId(id);
      if (m === 'GET' && id === null) return respond(200, await store.list(col));
      if (m === 'GET') { const d = await store.get(col, id); return d ? respond(200, { id, ...d }) : respond(404, { code: 'invalid_argument', message: 'Not found.' }); }
      requireWrite(who);
      if (m === 'POST' && id === null) {
        const body = await readJson(req), newId = crypto.randomBytes(10).toString('hex');
        await store.set(col, newId, body);
        if (col === 'versions') await snapshotVersion(newId, who);
        return respond(201, { id: newId });
      }
      if (m === 'PUT' && id !== null) {
        await store.set(col, id, await readJson(req));
        if (col === 'versions') await snapshotVersion(id, who);
        return respond(200, { id });
      }
      if (m === 'PATCH' && id !== null) {
        if (!(await store.update(col, id, await readJson(req)))) throw new HttpError(404, 'invalid_argument', 'That document does not exist.');
        return respond(200, { id });
      }
      if (m === 'DELETE' && id !== null) { await store.remove(col, id); return respond(204, null); }
      throw new HttpError(405, 'invalid_argument', 'That method is not allowed here.');
    }

    // Photos
    if (m === 'POST' && p === '/api/assets') {
      requireWrite(who);
      const type = String(req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(type)) throw new HttpError(415, 'unsupported_type', 'Upload a JPEG, PNG or WebP image.');
      const bytes = await readBytes(req, MAX_IMAGE);
      if (!bytes.length) throw new HttpError(400, 'invalid_request', 'The upload was empty.');
      const id = crypto.randomBytes(16).toString('hex');
      await store.addAsset(id, type, bytes);
      return respond(201, { id, url: '/_blob/' + id, sizeBytes: bytes.length, contentType: type });
    }
    const am = p.match(/^\/api\/assets\/([0-9a-f]{32})$/);
    if (m === 'DELETE' && am) { requireWrite(who); return respond(200, { deleted: await store.removeAsset(am[1]) }); }
    const bm = p.match(/^\/_blob\/([0-9a-f]{32})$/);
    if (m === 'GET' && bm) {
      const [meta, bytes] = await Promise.all([store.assetMeta(bm[1]), store.assetBytes(bm[1])]);
      if (!meta || !bytes) return respond(404, 'Not found');
      return respond(200, new Uint8Array(bytes), { 'content-type': meta.type, 'cache-control': 'private, max-age=31536000, immutable' });
    }

    // Read-only HTML exports
    if (m === 'GET' && p === '/api/export') {
      const cur = ((await store.list('versions')).sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true }))[0] || {}).version;
      const html = await makeSnapshot(cur ? `${cur}+` : null, who);
      return respond(200, html, { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="${snapshotFileName(cur ? `${cur}-latest` : 'current')}"` });
    }
    const em = p.match(/^\/exports\/([A-Za-z0-9._-]+\.html)$/);
    if (m === 'GET' && em) {
      const bytes = await store.exportBytes(em[1]);
      if (!bytes) return respond(404, 'Not found');
      return respond(200, new Uint8Array(bytes), { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="${em[1]}"` });
    }

    // Backup and restore: the whole plan (all collections, people who have used it, photos) as one JSON file.
    // Saved HTML exports are not included; their links are dropped on restore when the file is not there.
    if (m === 'GET' && p === '/api/backup') {
      const [collections, users, assetIds] = await Promise.all([store.all(), store.users(), store.assetIds()]);
      const photos = {};
      for (const id of assetIds) {
        const [meta, b] = await Promise.all([store.assetMeta(id), store.assetBytes(id)]);
        if (meta && b) photos[id] = { type: meta.type, data: b.toString('base64') };
      }
      const name = `harness-plan-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      return respond(200, JSON.stringify({ app: 'harness-plan', format: 1, exportedAt: new Date().toISOString(), collections, users, photos }), { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` });
    }
    if (m === 'POST' && p === '/api/restore') {
      requireWrite(who);
      if (url.searchParams.get('confirm') !== 'replace-everything') throw new HttpError(400, 'invalid_argument', 'Restoring replaces the whole plan; confirm to continue.');
      const b = await readJson(req, MAX_BACKUP);
      if (b.app !== 'harness-plan' || b.format !== 1 || !b.collections || typeof b.collections !== 'object') throw new HttpError(400, 'invalid_argument', 'That file is not a Harness plan backup.');
      const exportsHere = new Set(await store.exportNames());
      const cols = {};
      for (const c of COLLECTIONS) {
        const docs = {};
        for (const d of Array.isArray(b.collections[c]) ? b.collections[c] : []) {
          if (!d || typeof d.id !== 'string' || !DOC_ID.test(d.id)) continue;
          const { id, ...body } = d;
          if (c === 'versions' && body.snapshot && !exportsHere.has(body.snapshot)) { delete body.snapshot; delete body.snapshotAt; }
          docs[id] = body;
        }
        cols[c] = docs;
      }
      let photos = 0;
      for (const [id, ph] of Object.entries(b.photos || {})) {
        if (!ASSET_ID.test(id) || !IMAGE_TYPES.has(ph && ph.type)) continue;
        await store.addAsset(id, ph.type, Buffer.from(String(ph.data || ''), 'base64')); photos++;
      }
      if (b.users && typeof b.users === 'object') await store.replaceUsers(b.users);
      await store.replaceCollections(cols);
      const n = Object.values(cols).reduce((s, d) => s + Object.keys(d).length, 0);
      return respond(200, { restored: n, photos });
    }

    return respond(404, 'Not found');
  }

  return {
    store,
    async handle(req, { ip = 'unknown' } = {}) {
      try { return await route(req, ip); }
      catch (err) {
        // Only statuses this app sets on purpose reach the browser. Other errors (a storage failure can carry its own
        // 401) become 503: a 401 here would send a signed-in person to the sign-in page and round again.
        if (err instanceof HttpError || err.expose) return respond(err.status, { code: err.code || 'unavailable', message: err.message });
        log(err && err.stack || err);
        return respond(503, { code: 'unavailable', message: 'The plan could not be reached just now. Try again in a moment.' });
      }
    },
  };
}
