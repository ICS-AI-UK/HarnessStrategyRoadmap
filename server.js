// Harness plan web app — local server.
//
//   npm start            then open http://localhost:4730   (loads settings from .env)
//
// This file only adapts Node's HTTP server to the app in src/app.js, which is the same code the Netlify Function
// runs (netlify/functions/app.mjs). Locally the plan is stored as files under DATA_DIR/kv; on Netlify it is stored
// in Netlify Blobs. Settings: APP_PASSWORD, PORT, DATA_DIR, AUTH_MODE, EDITORS, READ_ONLY, LOCAL_USER, SESSION_DAYS,
// SESSION_SECRET. See README.md.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';
import { fsKV } from './src/kv/fs.js';
import { openStore } from './src/store.js';
import { migrateFromSqlite } from './src/migrate.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4730;   // deliberately not 3000, which many other dev servers use
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PAGE = path.join(ROOT, 'public', 'plan.html');
const ADAPTER = path.join(ROOT, 'public', 'adapter.js');

await mkdir(path.join(DATA_DIR, 'kv'), { recursive: true });
const kv = fsKV(path.join(DATA_DIR, 'kv'));
await migrateFromSqlite(openStore(kv), DATA_DIR);   // one-time move from the original SQLite storage, if present

let app;
try {
  // Page files are read on each request, so edits to them show up without a restart.
  app = await createApp({ kv, assets: { page: () => readFile(PAGE, 'utf8'), adapter: () => readFile(ADAPTER, 'utf8') } });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(`http://${req.headers.host || 'localhost:' + PORT}${req.url}`, {
      method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? 'half' : undefined,
    });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const response = await app.handle(request, { ip });
    const out = {};
    response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(response.status, out);
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Something went wrong on the server.');
  }
});
server.listen(PORT, () => console.log(`Harness plan running at http://localhost:${PORT}  (storage: files in ${path.join(DATA_DIR, 'kv')})`));
