// Builds a read-only, self-contained HTML copy of the plan: the page itself, every plan document as it stands,
// people's photos embedded as data: URLs, and the browser adapter running in snapshot mode (no server, no
// editing). The result opens straight from disk or any static host.

const safeJson = v => JSON.stringify(v)
  .replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');

// Date and time of export in UK time, e.g. { date: '2026-10-20', time: '1432', label: '20 Oct 2026, 14:32 UK time' }.
export function ukStamp(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(x => [x.type, x.value]));
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}${p.minute}`, label: `${label} UK time` };
}

export function snapshotFileName(version, date = new Date()) {
  const v = String(version || 'current').replace(/[^0-9A-Za-z._-]+/g, '-').slice(0, 40) || 'current';
  const s = ukStamp(date);
  return `harness-plan-v${v}-${s.date}-${s.time}.html`;
}

export async function buildSnapshot({ pageHtml, adapterJs, store, version, exportedBy }) {
  const data = await store.all();
  const blobs = {};
  for (const p of data.people || []) {
    if (!p.photo || !/^[0-9a-f]{32}$/.test(p.photo)) continue;
    const [meta, bytes] = await Promise.all([store.assetMeta(p.photo), store.assetBytes(p.photo)]);
    if (meta && bytes) blobs[p.photo] = `data:${meta.type};base64,${bytes.toString('base64')}`;   // else the page shows initials
  }
  const lastEdit = (data.meta || []).find(d => d.id === 'lastEdit');
  const users = {};
  if (lastEdit && lastEdit.by) users[lastEdit.by] = { id: lastEdit.by, name: await store.userName(lastEdit.by) };
  const now = new Date(), stamp = ukStamp(now);
  const snap = { version: version || null, exportedAt: now.toISOString(), exportedAtLabel: stamp.label, exportedBy: exportedBy || '', data, users, blobs };
  const inject = `<script>window.SNAPSHOT = ${safeJson(snap)};</script>\n<script>\n${adapterJs}\n</script>`;
  let html = pageHtml.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${inject}`);
  const v = version ? ` v${String(version).replace(/[<&]/g, '')}` : '';
  html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t}${v} (exported ${stamp.label})</title>`);
  return html;
}
