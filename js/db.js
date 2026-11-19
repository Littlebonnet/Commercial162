// Stockage local (IndexedDB) + copie en mémoire pour des calculs instantanés.
// Tout reste sur l'appareil : rien n'est envoyé à un serveur.

const DB_NAME = 'tournee-alpagel';
const DB_VERSION = 1;
export const STORES = ['clients', 'visites', 'commandes', 'produits', 'ventes', 'rappels', 'fichiers', 'kv'];
const KEYS = { produits: 'ref', kv: 'k' };

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEYS[s] || 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

// Cache mémoire : S.clients, S.visites… (tableaux) et S.kv (objet)
export const S = { rev: 0, clients: [], visites: [], commandes: [], produits: [], ventes: [], rappels: [], kv: {} };

export async function loadAll() {
  for (const s of STORES) {
    if (s === 'fichiers') continue;
    const rows = await tx(s, 'readonly', os => os.getAll());
    if (s === 'kv') { S.kv = {}; for (const r of rows) S.kv[r.k] = r.v; }
    else S[s] = rows;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

function keyOf(store, obj) { return obj[KEYS[store] || 'id']; }

export async function put(store, obj) {
  S.rev++;
  await tx(store, 'readwrite', os => os.put(obj));
  if (store === 'fichiers') return obj;
  const arr = S[store];
  const k = keyOf(store, obj);
  const i = arr.findIndex(o => keyOf(store, o) === k);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  return obj;
}

export async function bulkPut(store, objs) {
  S.rev++;
  await tx(store, 'readwrite', os => { for (const o of objs) os.put(o); });
  if (store === 'fichiers') return;
  const idx = new Map(S[store].map((o, i) => [keyOf(store, o), i]));
  for (const o of objs) {
    const k = keyOf(store, o);
    if (idx.has(k)) S[store][idx.get(k)] = o; else { idx.set(k, S[store].length); S[store].push(o); }
  }
}

export async function del(store, key) {
  S.rev++;
  await tx(store, 'readwrite', os => os.delete(key));
  if (store === 'fichiers') return;
  S[store] = S[store].filter(o => keyOf(store, o) !== key);
}

export async function bulkDel(store, keys) {
  S.rev++;
  await tx(store, 'readwrite', os => { for (const k of keys) os.delete(k); });
  if (store === 'fichiers') return;
  const set = new Set(keys);
  S[store] = S[store].filter(o => !set.has(keyOf(store, o)));
}

export async function clear(store) {
  S.rev++;
  await tx(store, 'readwrite', os => os.clear());
  if (store === 'kv') S.kv = {};
  else if (store !== 'fichiers') S[store] = [];
}

export async function getFiles(clientId) {
  const all = await tx('fichiers', 'readonly', os => os.getAll());
  return clientId ? all.filter(f => f.clientId === clientId) : all;
}
export async function getFile(id) { return tx('fichiers', 'readonly', os => os.get(id)); }

export async function setKV(k, v) { S.rev++; S.kv[k] = v; await tx('kv', 'readwrite', os => os.put({ k, v })); }
export function kv(k, def) { return S.kv[k] !== undefined ? S.kv[k] : def; }
