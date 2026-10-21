// Connects the plan page to its data. The page asks for three things through window.claude.use(name):
//   "db"     plan documents (collections of JSON objects) with live updates
//   "user"   who is viewing and whether they may edit
//   "assets" photo uploads
// In the web app these come from the server (REST plus server-sent events). In an exported snapshot they come
// from window.SNAPSHOT, embedded in the file, and everything is read-only. Inside a Claude artifact this file is
// not loaded and Claude's own runtime provides the same three things.
(function () {
  'use strict';
  var SNAP = window.SNAPSHOT || null;
  window.HARNESS_APP = SNAP ? 'snapshot' : 'server';
  if (SNAP) window.HARNESS_BLOB_URL = function (id) { return (SNAP.blobs && SNAP.blobs[id]) || ''; };

  var cache = {}, listeners = {};

  function fail(code, message) { var e = new Error(message); e.code = code; return e; }
  // The session has expired or been signed out elsewhere: go to the sign-in page and come back to this page after.
  // At most once every 30 seconds: if the server keeps refusing a cookie the sign-in page accepts, going round again
  // would reload the page every few seconds, so instead the page stays put and offers a link to sign in again.
  // The return address keeps the view (#v-gantt) but not the query, so it never nests "?next=" inside itself.
  var leaving = false;
  function signIn() {
    if (leaving) return; leaving = true;
    var to = '/login?next=' + encodeURIComponent(location.pathname + location.hash), last = 0;
    try { last = Number(sessionStorage.getItem('harness-signin-at')) || 0; } catch (e) {}
    if (Date.now() - last < 30000) { stuck(to); return; }
    try { sessionStorage.setItem('harness-signin-at', String(Date.now())); } catch (e) {}
    location.href = to;
  }
  function stuck(to) {
    if (document.getElementById('harness-stuck')) return;
    var b = document.createElement('div'); b.id = 'harness-stuck'; b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:100;background:#b3261e;color:#fff;padding:10px 16px;border-radius:6px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)';
    b.innerHTML = 'The server did not accept your sign-in. Changes will not save. <a style="color:#fff" href="' + to.replace(/"/g, '&quot;') + '">Sign in again</a>';
    (document.body || document.documentElement).appendChild(b);
  }
  function snapshotOf(col) {
    var docs = (cache[col] || []).map(function (d) {
      var body = {}; for (var k in d) if (k !== 'id') body[k] = d[k];
      return { id: d.id, exists: true, data: function () { return body; }, metadata: { fromCache: false, hasPendingWrites: false } };
    });
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function emit(col) {
    (listeners[col] || []).forEach(function (fn) { try { fn(snapshotOf(col)); } catch (e) { console.error(e); } });
  }

  function api(method, url, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(url, opts).then(function (res) {
      if (res.status === 401) { signIn(); throw fail('unavailable', 'Signed out'); }
      if (res.status === 204) return null;
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw fail(j.code || (res.status === 403 ? 'invalid_argument' : 'unavailable'), j.message || res.statusText);
        return j;
      });
    });
  }
  function refresh(col) {
    return api('GET', '/api/c/' + col).then(function (list) { cache[col] = list; emit(col); });
  }

  var loaded = null;
  function loadAll() {
    if (!loaded) loaded = SNAP ? Promise.resolve(Object.assign(cache, SNAP.data || {})) : api('GET', '/api/data').then(function (d) { Object.assign(cache, d); });
    return loaded;
  }

  function readOnly() { return Promise.reject(fail('invalid_argument', 'This is a read-only snapshot: no permission to write.')); }
  function docUrl(col, id) { return '/api/c/' + col + '/' + encodeURIComponent(id); }
  function docRef(col, id) {
    return {
      id: id, path: col + '/' + id,
      get: function () { return loadAll().then(function () { var d = (cache[col] || []).filter(function (x) { return x.id === id; })[0]; var body = d ? Object.assign({}, d) : undefined; if (body) delete body.id; return { id: id, exists: !!d, data: function () { return body; } }; }); },
      set: function (d) { return SNAP ? readOnly() : api('PUT', docUrl(col, id), d).then(function () { return refresh(col); }); },
      update: function (d) { return SNAP ? readOnly() : api('PATCH', docUrl(col, id), d).then(function () { return refresh(col); }); },
      delete: function () { return SNAP ? readOnly() : api('DELETE', docUrl(col, id)).then(function () { return refresh(col); }); },
    };
  }
  function newId() { var a = new Uint8Array(10); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  var db = {
    doc: function (path) {
      var s = String(path).split('/');
      if (s.length !== 2 || !s[0] || !s[1]) throw new TypeError('A document path has two parts, such as "todos/abc".');
      return docRef(s[0], s[1]);
    },
    collection: function (col) {
      return {
        path: col,
        doc: function (id) { return docRef(col, id || newId()); },
        add: function (d) {
          if (SNAP) return readOnly();
          return api('POST', '/api/c/' + col, d).then(function (r) { return refresh(col).then(function () { return docRef(col, r.id); }); });
        },
        onSnapshot: function (next, onError) {
          (listeners[col] = listeners[col] || []).push(next);
          loadAll().then(function () { if (!cache[col]) cache[col] = []; next(snapshotOf(col)); }, function (e) { if (onError) onError(e); });
          return function () { listeners[col] = (listeners[col] || []).filter(function (f) { return f !== next; }); };
        },
      };
    },
  };

  var meP = SNAP ? Promise.resolve({ id: null, name: '', canWrite: false })
    : api('GET', '/api/me').catch(function () { return { id: null, name: '', canWrite: false }; });
  window.HARNESS_ME = meP;   // lets the page show "Sign out" when the app is behind its password
  var user = {
    can: function (name) { return meP.then(function (m) { return name === 'data.write' ? !!m.canWrite : false; }); },
    canEdit: function () { return meP.then(function (m) { return !!m.canWrite; }); },
    isOwner: function () { return Promise.resolve(false); },
    id: function () { return meP.then(function (m) { return m.id; }); },
    me: function () { return meP.then(function (m) { return { id: m.id, name: m.name || '', email: null, isOwner: false, canEdit: !!m.canWrite }; }); },
    profiles: function (ids) {
      ids = [].concat(ids || []);
      if (SNAP) { var out = {}; ids.forEach(function (id) { out[id] = { id: id, name: (SNAP.users && SNAP.users[id] && SNAP.users[id].name) || '' }; }); return Promise.resolve(out); }
      return api('GET', '/api/profiles?ids=' + encodeURIComponent(ids.join(','))).catch(function () { return {}; });
    },
  };

  var assets = {
    upload: function (blob, opts) {
      var type = (opts && opts.type) || blob.type;
      return fetch('/api/assets', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': type }, body: blob }).then(function (res) {
        if (res.status === 401) { signIn(); throw fail('upstream_auth', 'Signed out'); }
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok) throw fail(res.status === 413 ? 'too_large' : res.status === 415 ? 'unsupported_type' : (j.code || 'upstream_error'), j.message || res.statusText);
          return j;
        });
      });
    },
    delete: function (id) { return api('DELETE', '/api/assets/' + encodeURIComponent(id)); },
    list: function () { return Promise.resolve({ assets: [], usage: {} }); },
  };

  window.claude = {
    use: function (name) {
      if (name === 'db') return Promise.resolve(db);
      if (name === 'user') return Promise.resolve(user);
      if (name === 'assets') return SNAP ? Promise.resolve(null) : meP.then(function (m) { return m.canWrite ? assets : null; });
      return Promise.resolve(null);
    },
  };

  // Live updates: every 15 seconds this view asks which collections have changed (one small request) and reloads only
  // those. It pauses while the tab is hidden and checks straight away when the tab comes back. Polling works the
  // same locally and on Netlify, where a function cannot hold a connection open.
  if (!SNAP) {
    var revs = null, polling = false;
    var poll = function () {
      if (polling || document.visibilityState === 'hidden') return;
      polling = true;
      api('GET', '/api/revs').then(function (next) {
        if (revs) Object.keys(next).forEach(function (col) { if (next[col] !== revs[col] && listeners[col]) refresh(col).catch(function () {}); });
        revs = next;
      }).catch(function () {}).then(function () { polling = false; });
    };
    loadAll().then(poll);
    setInterval(poll, 15000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') poll(); });
  }
})();
