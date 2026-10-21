// Netlify Function serving the whole Harness plan app (every path), with the plan stored in Netlify Blobs.
// It runs the same code as the local server (src/app.js). The page files are bundled at build time into
// src/assets.gen.js by scripts/build-netlify.mjs, because a function cannot read the site's files at run time.
import { createApp } from '../../src/app.js';
import { netlifyKV } from '../../src/kv/netlify.js';
import { PAGE_HTML, ADAPTER_JS } from '../../src/assets.gen.js';

let ready = null;   // kept between requests while this function instance stays warm

export default async (req, context) => {
  try {
    ready ||= (async () => createApp({ kv: await netlifyKV(), assets: { page: async () => PAGE_HTML, adapter: async () => ADAPTER_JS } }))();
    const app = await ready;
    return await app.handle(req, { ip: (context && context.ip) || 'unknown' });
  } catch (e) {
    ready = null;   // try setting up again on the next request (e.g. after APP_PASSWORD is added)
    console.error(e);
    return new Response(/APP_PASSWORD/.test(String(e && e.message)) ? 'The plan is not configured yet: set APP_PASSWORD in the site\'s environment variables, then redeploy.' : 'Something went wrong on the server.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
};

// Every path goes through this function, so nothing in the plan is published as an open static file.
export const config = { path: ['/', '/*'] };
