const databaseName = 'haven-offline-v1';
const storeName = 'records';

function userScope() {
  try { const token = window.havenAccessToken || '', payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))); return String(payload.sub || 'anonymous'); } catch { try{return String(JSON.parse(localStorage.getItem('haven-offline-profile')||'{}').sub||'anonymous')}catch{return'anonymous'} }
}

function database() {
  return new Promise((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onupgradeneeded = () => request.result.createObjectStore(storeName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

async function transact(mode, action) {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const transaction = db.transaction(storeName, mode), store = transaction.objectStore(storeName), request = action(store); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
}

const scopedKey = key => `${userScope()}:${key}`;
export const getOfflineRecord = key => transact('readonly', store => store.get(scopedKey(key))).catch(() => null);
export const setOfflineRecord = (key, value) => transact('readwrite', store => store.put({ value, at: Date.now() }, scopedKey(key))).catch(() => null);

export async function cachedUserJson(key, loader, maxAge = 7 * 86400000) {
  try { const data = await loader(); await setOfflineRecord(key, data); return { data, stale: false, updatedAt: Date.now() }; }
  catch (error) { const record = await getOfflineRecord(key); if (record && Date.now() - record.at <= maxAge) return { data: record.value, stale: true, updatedAt: record.at, error }; throw error; }
}

async function queuedMutations() { return (await getOfflineRecord('mutation-queue'))?.value || []; }
async function saveQueue(queue) { return setOfflineRecord('mutation-queue', queue.slice(-100)); }

export async function requestOrQueue(url, options, label = 'change') {
  try { const response = await fetch(url, options); if (!response.ok) return response; return response; }
  catch (error) { if (navigator.onLine) throw error; const queue = await queuedMutations(); queue.push({ id: crypto.randomUUID(), url, method: options.method || 'POST', headers: Object.fromEntries(Object.entries(options.headers || {}).filter(([name]) => name.toLowerCase() !== 'authorization')), body: options.body || '', label, queuedAt: new Date().toISOString() }); await saveQueue(queue); return { ok: true, queued: true, status: 202, json: async () => ({ queued: true }) }; }
}

export async function flushOfflineMutations(authHeaders = {}) {
  if (!navigator.onLine) return { flushed: 0, remaining: (await queuedMutations()).length };
  const queue = await queuedMutations(), remaining = []; let flushed = 0;
  for (const item of queue) { try { const response = await fetch(item.url, { method: item.method, headers: { ...item.headers, ...authHeaders }, body: item.body }); if (!response.ok) remaining.push(item); else flushed += 1; } catch { remaining.push(item); } }
  await saveQueue(remaining); return { flushed, remaining: remaining.length };
}
