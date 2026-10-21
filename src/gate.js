// Password gate with cookie sessions. Works the same on a local server and in a Netlify Function: requests are
// standard Request objects, and everything that must outlive one request (the signing secret, failed-attempt
// counts) is kept in storage, not memory.
//
// Signing in with the shared password (APP_PASSWORD) sets a session cookie: HttpOnly, SameSite=Lax, Secure over
// HTTPS, lasting SESSION_DAYS (default 14). The cookie holds only an expiry time and a signature, made with a key
// derived from a server secret and the password itself, so changing the password signs everyone out.
// The secret is SESSION_SECRET if set, otherwise generated once and kept in storage (sys/secret).
//
// After MAX_FAILS wrong passwords from one address within WINDOW_MS, that address is locked out for WINDOW_MS.
import crypto from 'node:crypto';

const COOKIE = 'harness_session';
const NAME_COOKIE = 'harness_name';
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const sha256 = s => crypto.createHash('sha256').update(String(s), 'utf8').digest();
const b64url = buf => Buffer.from(buf).toString('base64url');

export function parseCookies(headers) {
  const out = {};
  for (const part of String(headers.get('cookie') || '').split(';')) {
    const k = part.indexOf('='); if (k < 0) continue;
    const name = part.slice(0, k).trim(), value = part.slice(k + 1).trim();
    if (name) { try { out[name] = decodeURIComponent(value); } catch { out[name] = value; } }
  }
  return out;
}

// The name a person gave when signing in (shown on their changes). Untrusted input: cleaned and limited.
export const cleanName = n => String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 60);
export const signedInName = headers => cleanName(parseCookies(headers)[NAME_COOKIE]);

export async function createGate({ password, kv, days = 14, secret = '' }) {
  if (!password) return null;
  let base = secret;
  if (!base) {
    const cur = await kv.getJSON('sys/secret');
    base = cur && cur.data && cur.data.secret;
    if (!base) {
      await kv.setJSON('sys/secret', { secret: crypto.randomBytes(32).toString('hex') }, { ifNew: true });
      base = (await kv.getJSON('sys/secret')).data.secret;   // whichever instance won the race
    }
  }
  const key = crypto.createHmac('sha256', base).update('harness-plan-session:' + sha256(password).toString('hex')).digest();
  const sign = exp => b64url(crypto.createHmac('sha256', key).update(String(exp)).digest());
  const maxAge = Math.round(days * 86400);
  const failKey = ip => 'sys/fails/' + sha256(ip).toString('hex').slice(0, 24);
  const attrs = (secure, age) => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;

  return {
    // True when the request carries a valid, unexpired session cookie.
    ok(headers) {
      const v = parseCookies(headers)[COOKIE]; if (!v) return false;
      const [exp, sig] = v.split('.');
      if (!/^\d+$/.test(exp || '') || Number(exp) < Date.now() / 1000 || !sig) return false;
      const want = Buffer.from(sign(exp)), got = Buffer.from(sig);
      return want.length === got.length && crypto.timingSafeEqual(want, got);
    },
    // Compare in constant time (both sides hashed to the same length first).
    check(input) { return crypto.timingSafeEqual(sha256(input), sha256(password)); },
    async lockedFor(ip) {
      const f = await kv.getJSON(failKey(ip)); if (!f || !f.data.until) return 0;
      const left = f.data.until - Date.now();
      return left > 0 ? Math.ceil(left / 60000) : 0;
    },
    async recordFail(ip) {
      const k = failKey(ip);
      for (let i = 0; i < 5; i++) {
        const cur = await kv.getJSON(k), now = Date.now();
        let f = cur ? cur.data : null;
        if (!f || now - f.first > WINDOW_MS) f = { n: 0, first: now, until: 0 };
        f.n++; if (f.n >= MAX_FAILS) f.until = now + WINDOW_MS;
        if ((await kv.setJSON(k, f, cur ? { ifMatch: cur.etag } : { ifNew: true })).ok) return;
      }
    },
    async clearFails(ip) { await kv.delete(failKey(ip)).catch(() => {}); },
    sessionCookies(secure, name) {
      const exp = Math.floor(Date.now() / 1000) + maxAge;
      return [`${COOKIE}=${exp}.${sign(exp)}; ${attrs(secure, maxAge)}`,
        name ? `${NAME_COOKIE}=${encodeURIComponent(name)}; ${attrs(secure, maxAge)}` : `${NAME_COOKIE}=; ${attrs(secure, 0)}`];
    },
    clearCookies(secure) { return [`${COOKIE}=; ${attrs(secure, 0)}`, `${NAME_COOKIE}=; ${attrs(secure, 0)}`]; },
  };
}

// Only same-site paths are allowed as the place to return to after signing in.
export function safeNext(n) {
  const s = String(n || '');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') && !/[\r\n]/.test(s) ? s.slice(0, 500) : '/';
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function loginPage({ next = '/', error = '', name = '' } = {}) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Sign in · Harness Gen 3 ASE Plan</title>
<style>
:root { --bg: #f4f6f8; --surface: #fff; --ink: #14202b; --muted: #5a6875; --line: #d9e0e6; --accent: #0b6e72; --accent-ink: #fff; --bad: #b3261e; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f161c; --surface: #16212a; --ink: #e4ebf0; --muted: #94a3b0; --line: #2a3843; --accent: #4fc1c4; --accent-ink: #062224; --bad: #ff8a80; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; padding: 24px max(16px, env(safe-area-inset-left)); }
main { width: 100%; max-width: 380px; background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--accent); border-radius: 8px; padding: 28px 26px; display: grid; gap: 16px; }
.eyebrow { font-size: 11.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font-size: 24px; line-height: 1.2; }
p { margin: 0; color: var(--muted); font-size: 14px; }
label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; color: var(--muted); }
input { font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 5px; padding: 9px 11px; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button { font: inherit; font-weight: 600; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 5px; padding: 10px 14px; cursor: pointer; }
.err { color: var(--bad); font-size: 14px; font-weight: 600; }
.hint { font-weight: 400; font-size: 12px; }
</style></head><body><main>
<span class="eyebrow">ICS.ai · Internal</span>
<h1>Harness Gen 3 ASE Plan</h1>
<p>This plan is private. Enter the password to continue.</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/login" style="display:grid;gap:14px">
<input type="hidden" name="next" value="${esc(next)}">
<label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
<label>Your name <span class="hint">(optional, shown on the changes you make)</span><input type="text" name="name" maxlength="60" autocomplete="name" value="${esc(name)}"></label>
<button type="submit">Sign in</button>
</form></main>
<script>
// Browsers never send the #part of an address to the server, so carry it through sign-in here (e.g. #v-gantt).
document.querySelector('form').addEventListener('submit', function () {
  var n = document.querySelector('input[name=next]');
  if (location.hash && n.value.indexOf('#') < 0) n.value += location.hash;
});
</script></body></html>`;
}
