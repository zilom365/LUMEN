export const STORE_KEY = 'lumen.sar.demo.v3';
export const LEGACY_STORE_KEY = 'lumen.sar.demo.v2';
export const OLDEST_STORE_KEY = 'lumen.sar.demo.v1';
export const SESSION_KEY = 'lumen.sar.session.v1';

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@lumen.demo', password: 'admin123', name: 'Site administrator', role: 'admin' },
  member: { email: 'member@lumen.demo', password: 'lumen123', name: 'Family member', role: 'member' }
};

const makePerson = (id, name, cemetery, sample = false) => ({
  id, name, birth: '', death: '', cemetery, section: '', plot: '', epitaph: '', story: '', photo: '',
  videoData: '', videoBlobId: '', videoName: '', videoUrl: '',
  public: true, tributes: 0, sample
});

export const SEED_DATA = {
  people: [
    makePerson('mem-jannatul-ferdos-achol', 'Jannatul Ferdos Achol', 'Azimpur Graveyard (near Dhanmondi)'),
    makePerson('mem-mashrafi-rahman-efti', 'Mashrafi Rahman Efti', 'Azimpur Graveyard (near Dhanmondi)'),
    makePerson('mem-rahatul-ashekin-zidan', 'Rahatul Ashekin Zidan', 'Azimpur Graveyard (near Dhanmondi)'),
    makePerson('mem-abdul-muqtadir', 'A.S.M. Abdul Muqtadir', 'Jurain Graveyard'),
    makePerson('mem-kanij-fatema-mukti', 'Kanij Fatema Mukti', 'Jurain Graveyard'),
    makePerson('mem-sample-jurain', 'Sample Resident — Jurain', 'Jurain Graveyard', true),
    makePerson('mem-sample-banani-1', 'Sample Resident One — Banani', 'Banani Graveyard', true),
    makePerson('mem-sample-banani-2', 'Sample Resident Two — Banani', 'Banani Graveyard', true),
    makePerson('mem-sample-banani-3', 'Sample Resident Three — Banani', 'Banani Graveyard', true)
  ],
  members: [
    { email: DEMO_ACCOUNTS.member.email, password: DEMO_ACCOUNTS.member.password, name: DEMO_ACCOUNTS.member.name }
  ],
  favorites: { [DEMO_ACCOUNTS.member.email]: [] },
  videoSubscriptions: {},
  publicBaseUrl: ''
};

const OLD_BUILT_IN_IDS = new Set(['mem-anna-bell', 'mem-samuel-bell', 'mem-leila-rahman']);

function normalizeCollection(saved, replaceSamples = false) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const savedPeople = Array.isArray(source.people) ? source.people : [];
  const customPeople = savedPeople
    .filter((person) => person && typeof person === 'object' && !person.sample && !OLD_BUILT_IN_IDS.has(person.id))
    .map(normalizePerson);
  const seededPeople = replaceSamples ? structuredClone(SEED_DATA.people) : savedPeople.filter((person) => person && typeof person === 'object').map(normalizePerson);
  const people = replaceSamples ? [...seededPeople, ...customPeople] : seededPeople;
  const validIds = new Set(people.map((person) => person.id));
  const favorites = {};
  if (source.favorites && typeof source.favorites === 'object') {
    for (const [email, ids] of Object.entries(source.favorites)) {
      favorites[email.toLowerCase()] = Array.isArray(ids) ? ids.filter((id) => validIds.has(id)) : [];
    }
  }
  const videoSubscriptions = {};
  if (source.videoSubscriptions && typeof source.videoSubscriptions === 'object') {
    for (const [email, active] of Object.entries(source.videoSubscriptions)) {
      if (active === true) videoSubscriptions[email.toLowerCase()] = true;
    }
  }
  return {
    people,
    members: Array.isArray(source.members) ? source.members.filter((member) => member && typeof member === 'object') : structuredClone(SEED_DATA.members),
    favorites,
    videoSubscriptions,
    publicBaseUrl: typeof source.publicBaseUrl === 'string' ? source.publicBaseUrl : ''
  };
}

export function loadData() {
  try {
    const current = localStorage.getItem(STORE_KEY);
    if (current) return normalizeCollection(JSON.parse(current));
    for (const [key, replaceSamples] of [[LEGACY_STORE_KEY, false], [OLDEST_STORE_KEY, true]]) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalizeCollection(JSON.parse(legacy), replaceSamples);
      localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(key);
      return migrated;
    }
    return structuredClone(SEED_DATA);
  } catch (error) {
    console.warn('Could not read Lumen demo data; using the Bangladesh sample records.', error);
    return structuredClone(SEED_DATA);
  }
}

export function normalizePerson(person) {
  return {
    id: person.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: person.name || 'Untitled memorial', birth: person.birth || '', death: person.death || '',
    cemetery: person.cemetery || 'Cemetery not specified', section: person.section || '', plot: person.plot || '',
    epitaph: person.epitaph || '', story: person.story || '', photo: person.photo || '',
    videoData: person.videoData || '', videoBlobId: person.videoBlobId || '', videoName: person.videoName || '', videoUrl: person.videoUrl || '',
    public: person.public !== false, tributes: Number(person.tributes) || 0, sample: !!person.sample
  };
}

export function saveData(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Unable to persist Lumen demo data.', error);
    return false;
  }
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('This browser does not support local video storage.'));
    const request = indexedDB.open('lumen.sar.media.v1', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('videos')) request.result.createObjectStore('videos');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local video storage.'));
  });
}

export async function saveVideoBlob(id, blob) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(blob, String(id));
    transaction.oncomplete = () => { db.close(); resolve(String(id)); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not save the video in this browser.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Video storage was interrupted.')); };
  });
}

export async function getVideoBlob(id) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readonly');
    const request = transaction.objectStore('videos').get(String(id));
    request.onsuccess = () => { const blob = request.result || null; db.close(); resolve(blob); };
    request.onerror = () => { db.close(); reject(request.error || new Error('Could not read the saved video.')); };
  });
}

export async function deleteVideoBlob(id) {
  if (!id || !('indexedDB' in globalThis)) return;
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').delete(String(id));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not remove the saved video.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Video removal was interrupted.')); };
  });
}

export async function clearVideoBlobs() {
  if (!('indexedDB' in globalThis)) return;
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').clear();
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not clear local videos.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Video cleanup was interrupted.')); };
  });
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function initials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'LM';
}

export function yearsLabel(person) {
  if (person.birth && person.death) return `${person.birth} — ${person.death}`;
  if (person.birth) return `Born ${person.birth}`;
  if (person.death) return `Died ${person.death}`;
  return 'Dates not added';
}

export function idForNewMemorial() {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
