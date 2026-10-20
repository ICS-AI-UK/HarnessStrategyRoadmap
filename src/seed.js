// First run only: when storage is empty, load the draft plan bundled in the page (window.SEED) so the app starts
// with every action, the version history and the plan owner.
import vm from 'node:vm';

export function readSeed(pageHtml) {
  const m = pageHtml.match(/window\.SEED = (\{[\s\S]*?\r?\n\});\r?\n<\/script>/);
  if (!m) throw new Error('Could not find window.SEED in public/plan.html');
  return vm.runInNewContext(`(${m[1]})`, Object.create(null), { timeout: 1000 });
}

export async function seedIfEmpty(store, pageHtml, log = console.log) {
  if (!(await store.isEmpty())) return false;
  const S = readSeed(pageHtml);
  const actions = {}, versions = {};
  for (const a of S.actions) {
    actions[a.id] = { init: a.init, t: a.t, why: a.why || '', start: a.start, end: a.end || a.start, demo: !!a.demo,
      status: 'planned', progress: 0, owner: '', deps: a.deps || [], ...(a.stream ? { stream: a.stream } : {}) };
  }
  for (const v of S.versions || []) versions['v' + v.version.replace(/\./g, '-')] = { ...v };
  await store.replaceCollections({ actions, versions, people: { 'lee-englestone': { name: 'Lee Englestone', role: 'Strategy and plan owner' } } });
  log(`Seeded empty storage with ${S.actions.length} actions and ${(S.versions || []).length} versions.`);
  return true;
}
