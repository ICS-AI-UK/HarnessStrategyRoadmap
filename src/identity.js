// Who is making this request, and may they change the plan?
//
// AUTH_MODE=none      (default) the shared password protects the app (src/gate.js). People are named by what they
//                     gave at sign-in, otherwise LOCAL_USER, and anyone signed in may edit.
// AUTH_MODE=easyauth  for Azure App Service with Authentication switched on: the platform signs people in with
//                     Microsoft Entra ID and passes who they are in X-MS-CLIENT-PRINCIPAL-* headers, which App
//                     Service strips from incoming requests, so they cannot be forged. Only use it behind that.
//
// EDITORS   comma-separated sign-in names (emails) allowed to edit, or * for everyone signed in (default).
// READ_ONLY set to 1 to make the whole app view-only.
import os from 'node:os';
import { signedInName } from './gate.js';

export function loadAuthConfig(env = process.env) {
  const mode = (env.AUTH_MODE || 'none').toLowerCase();
  if (!['none', 'easyauth'].includes(mode)) throw new Error(`AUTH_MODE must be "none" or "easyauth", not "${env.AUTH_MODE}"`);
  const editors = (env.EDITORS || '*').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let osUser = '';
  try { osUser = os.userInfo().username; } catch { /* no OS user available (e.g. serverless) */ }
  return { mode, editors, readOnly: env.READ_ONLY === '1', localUser: env.LOCAL_USER || osUser || 'Plan user' };
}

function principalName(headerValue) {
  if (!headerValue) return '';
  try {
    const p = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'));
    const claim = (p.claims || []).find(c => c.typ === 'name');
    return claim && typeof claim.val === 'string' ? claim.val : '';
  } catch { return ''; }
}

// headers: a standard Headers object.
export function identify(headers, cfg) {
  let id = null, name = '', login = '';
  if (cfg.mode === 'none') {
    const given = signedInName(headers);
    if (given) { id = 'name:' + given.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); name = given; login = id; }
    else { id = 'local'; name = cfg.localUser; login = 'local'; }
  } else {
    login = String(headers.get('x-ms-client-principal-name') || '');
    if (login) {
      id = String(headers.get('x-ms-client-principal-id') || login);
      name = principalName(headers.get('x-ms-client-principal')) || login;
    }
  }
  const allowed = cfg.editors.includes('*') || cfg.editors.includes(login.toLowerCase());
  return { id, name, login, signedIn: !!id, canWrite: !!id && !cfg.readOnly && (cfg.mode === 'none' || allowed) };
}
