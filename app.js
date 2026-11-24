import {
  DEMO_ACCOUNTS, STORE_KEY, LEGACY_STORE_KEY, OLDEST_STORE_KEY, SEED_DATA, escapeHtml, getSession,
  idForNewMemorial, initials, loadData, normalizePerson, saveData, setSession, yearsLabel,
  saveVideoBlob, getVideoBlob, deleteVideoBlob, clearVideoBlobs
} from './store.js';



const app = document.getElementById('app');
const toastNode = document.getElementById('toast');
let data = loadData();
let session = getSession();
let route = 'login';
let routeId = '';
let loginMode = 'login';
let stagedPhoto = '';
let stagedVideoData = '';
let stagedVideoBlob = null;
let stagedVideoPreviewUrl = '';
let stagedVideoName = '';
let clearVideoOnSave = false;
let chatMode = 'demo';
let chatStatusLoading = false;
let chatStatusLoaded = false;
const chatHistory = new Map();
const chatConsentIds = new Set();
const chatExpandedIds = new Set();
const remembranceLines = ['Remembered with love', 'Always in your heart', 'Held close, always', 'A light that stays'];
const pendingChats = new Set();
const videoObjectUrls = new Map();

let toastTimer;

function readLocation() {
  const queryId = new URLSearchParams(location.search).get('memorial');
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash) {
    const parts = hash.split('/').map(decodeURIComponent);
    route = parts[0] || (session ? 'home' : 'login');
    routeId = parts[1] || '';
    return;
  }
  if (queryId) {
    route = 'memorial';
    routeId = queryId;
    if (!session) {
      session = { role: 'guest', name: 'Guest visitor', email: '' };
      setSession(session);
    }
  } else {
    route = session?.role === 'admin' ? 'admin' : session ? 'home' : 'login';
    routeId = '';
  }
}
readLocation();

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 3000);
}

function persist(message = 'Saved in this browser.') {
  if (!saveData(data)) {
    toast('The browser storage limit was reached. Try smaller media files or remove unused media.');
    return false;
  }
  if (message) toast(message);
  return true;
}

function currentMemberEmail() {
  return session?.role === 'member' ? String(session.email || '').toLowerCase() : '';
}

function memberFavorites() {
  const email = currentMemberEmail();
  if (!email) return [];
  if (!Array.isArray(data.favorites[email])) data.favorites[email] = [];
  return data.favorites[email];
}

function personById(id) {
  return data.people.find((person) => person.id === id);
}

function navigate(nextRoute, id = '', replace = false) {
  if (nextRoute.startsWith('admin') && session?.role !== 'admin') {
    toast('That workspace is available to the administrator demo account.');
    nextRoute = session?.role === 'guest' ? 'discover' : 'home';
    id = '';
  }
  if (['home', 'favorites'].includes(nextRoute) && session?.role === 'guest') {
    toast('Sign in as a family member to use that feature.');
    nextRoute = 'discover';
    id = '';
  }
  route = nextRoute;
  routeId = id;
  const hash = `#/${nextRoute}${id ? `/${encodeURIComponent(id)}` : ''}`;
  const url = `${location.pathname}${hash}`;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navButton(label, page, active, iconText = '') {
  return `<button class="nav-link${active ? ' active' : ''}" type="button" data-page="${page}">${iconText ? `<span aria-hidden="true">${iconText}　</span>` : ''}${label}</button>`;
}

function brandMarkup() {
  return `<button class="brand" type="button" data-page="${session?.role === 'admin' ? 'admin' : session?.role === 'guest' ? 'discover' : 'home'}" aria-label="Lumen home"><span class="brand-mark" aria-hidden="true">L</span><span class="brand-word">Lumen</span></button>`;
}

function renderHeader() {
  const role = session?.role;
  let nav = '';
  if (role === 'admin') {
    nav = navButton('Overview', 'admin', route === 'admin', '⌂') +
      navButton('Memorials', 'admin-memorials', route === 'admin-memorials' || route === 'admin-edit' || route === 'admin-media', '✧') +
      navButton('Settings', 'admin-settings', route === 'admin-settings', '⚙');
  } else if (role === 'member') {
    nav = navButton('Home', 'home', route === 'home', '⌂') +
      navButton('Find a loved one', 'discover', route === 'discover' || route === 'memorial' || route === 'map' || route === 'qr', '⌕') +
      navButton('My loved ones', 'favorites', route === 'favorites', '♡');
  } else {
    nav = navButton('Explore memorials', 'discover', route === 'discover' || route === 'memorial' || route === 'map' || route === 'qr', '⌕');
  }
  const account = role === 'guest'
    ? `<span class="role-chip">Guest access</span><button class="button secondary compact" type="button" data-action="show-login">Sign in</button>`
    : `<span class="role-chip">${role === 'admin' ? 'Administrator' : 'Family member'}</span><span class="avatar-mini" aria-hidden="true">${escapeHtml(initials(session?.name || ''))}</span><button class="plain-icon" type="button" data-action="logout" aria-label="Sign out" title="Sign out">↗</button>`;
  return `<header class="topbar"><div class="topbar-inner">${brandMarkup()}<nav class="topnav" aria-label="Main navigation">${nav}</nav><div class="topbar-user">${account}</div></div></header>`;
}

function renderFooter() {
  return `<footer class="site-footer"><strong>Lumen</strong><span>A respectful digital place for remembrance.</span></footer>`;
}

function renderLogin() {
  const signup = loginMode === 'signup';
  return `<main class="auth-screen"><section class="auth-form-wrap"><form class="auth-form" id="auth-form" novalidate>
    <div class="brand"><span class="brand-mark" aria-hidden="true">L</span><span class="brand-word">Lumen</span></div>
    <p class="eyebrow">A place for the stories that stay</p>
    <p class="script-line remembrance-glow" data-remembrance-tagline aria-live="off">Remembered with love</p>
    <h1 class="auth-title">${signup ? 'Create a family account' : 'Welcome back'}</h1>
    <p class="auth-description">${signup ? 'Save the people and stories your family carries.' : 'Sign in to find and honour someone you love.'}</p>
    ${signup ? `<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required placeholder="Your name"></div>` : ''}
    <div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="username" required placeholder="name@example.com"></div>
    <div class="field"><label for="auth-password">Password</label><div class="password-wrap"><input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required placeholder="At least 6 characters"><button class="password-toggle" type="button" data-action="toggle-password">Show</button></div></div>
    <p class="error-text" id="auth-error" aria-live="polite"></p>
    <button class="button primary block" type="submit">${signup ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span></button>
    <button class="auth-switch" type="button" data-action="toggle-auth-mode">${signup ? 'Already have an account? Sign in' : 'Create a family account'}</button>
    ${!signup ? `<button class="auth-switch" type="button" data-action="guest">Continue as guest — view public memorials</button>` : ''}
    <div class="demo-logins"><div class="demo-logins-heading"><p>Quick demonstration access</p><span>These shortcuts skip the demo sign-in form.</span></div><p class="demo-credential">Administrator login: <strong>admin@lumen.demo / admin123</strong></p><div class="demo-logins-row"><button class="demo-shortcut demo-admin" type="button" data-demo="admin"><span>Open administrator panel</span><small>Demo shortcut · no password</small></button><button class="demo-shortcut demo-family" type="button" data-demo="member"><span>Open family account</span><small>Sample family account</small></button></div></div>
    <p class="auth-terms">For a family account, use an account you have registered. Guest access lets you view public memorials.</p>
  </form></section><aside class="auth-visual" aria-label="A peaceful cemetery photograph"><div class="auth-visual-copy"><p class="script-line">A piece of heaven in your hand</p><h2>Keep their stories<br>close to you.</h2><p>Find a place, remember a life, and share the moments that made someone yours.</p></div><span class="auth-credit">Photograph: Pexels search result · “Tombstones on a Cemetery”</span></aside></main>`;
}

function renderWelcome() {
  const favs = memberFavorites();
  const savedPeople = data.people.filter((person) => favs.includes(person.id) && person.public !== false);
  return `<section class="page">
    <div class="welcome-hero"><div class="welcome-copy"><p class="eyebrow">Your family space</p><h1>Keep their stories close.</h1><p>Find a memorial, revisit the places that matter, and keep the small details of a life within reach.</p><div class="button-row"><button class="button gold" type="button" data-page="discover">Find a loved one <span aria-hidden="true">→</span></button></div></div></div>
    <div class="home-tools"><div class="search-hero"><p class="section-label">Search the memorial archive</p><div class="search-line"><input class="search-input" id="home-search" placeholder="Enter a name or cemetery" aria-label="Search a name or cemetery"><button class="button primary compact" type="button" data-action="search-from-home">Search</button></div></div><div class="card quick-card"><div><p class="section-label">Family account</p><h2 class="section-title" style="margin:0 0 2px">Signed in as ${escapeHtml(session?.name || 'family member')}</h2><span class="small-text muted">Save memorials to your loved-ones list. Data stays in this browser.</span></div><span class="quick-symbol" aria-hidden="true">♡</span></div></div>
    <div class="page-heading" style="margin-top:35px"><div><p class="eyebrow">A few lives to remember</p><h2 class="section-title" style="font-size:34px;margin:0">Memorial archive</h2></div><button class="text-button" type="button" data-page="discover">Browse all memorials →</button></div>
    ${renderPeopleCards(data.people.filter((person) => person.public !== false).slice(0, 3))}
    <section style="margin-top:32px"><div class="page-heading"><div><p class="eyebrow">Your saved people</p><h2 class="section-title" style="font-size:30px;margin:0">My loved ones</h2></div><button class="text-button" type="button" data-page="favorites">See all saved →</button></div>${savedPeople.length ? renderPeopleCards(savedPeople) : `<div class="empty-state"><strong>A space for the people you love</strong>Save a public memorial to keep it close to your family page.</div>`}</section>
  </section>`;
}

function renderPeopleCards(people) {
  if (!people.length) return `<div class="empty-state"><strong>No memorials found</strong>Try a different name or search term.</div>`;
  return `<div class="memorial-grid">${people.map((person) => {
    const cover = person.photo ? ' photo' : '';
    const photoStyle = person.photo ? ` style="background-image:url('${escapeHtml(person.photo)}')"` : '';
    const plotInfo = [person.section ? `Section ${person.section}` : '', person.plot ? `Plot ${person.plot}` : ''].filter(Boolean).join(' · ') || 'Plot details not recorded';
    return `<article class="memorial-card"><div class="memorial-card-top${cover}"${photoStyle}><div class="portrait-mark">${escapeHtml(initials(person.name))}</div></div><div class="person-card-body"><button class="open-card" type="button" data-person="${escapeHtml(person.id)}"><h3 class="person-card-name">${escapeHtml(person.name)}</h3></button><div class="person-card-years">${escapeHtml(yearsLabel(person))}</div><p class="person-card-location">${escapeHtml(person.cemetery)} · ${escapeHtml(plotInfo)}</p><div class="person-card-bottom"><span class="small-text muted">${person.public === false ? 'Private' : 'Public memorial'}</span><button class="tiny-link" type="button" data-person="${escapeHtml(person.id)}">View memorial →</button></div></div></article>`;
  }).join('')}</div>`;
}

function visiblePeople() {
  return session?.role === 'admin' ? data.people : data.people.filter((person) => person.public !== false);
}

function renderDiscover() {
  const people = visiblePeople();
  return `<section class="page"><p class="eyebrow">Find a place to remember</p><div class="page-heading"><div><h1 class="page-title small">Find your loved one</h1><p class="page-lead">Search by name, cemetery, section, or plot. Public memorials are available to everyone.</p></div>${session?.role === 'admin' ? `<button class="button primary" type="button" data-page="admin-edit">＋ Add memorial</button>` : ''}</div><div class="search-toolbar"><input class="search-input" id="memorial-search" placeholder="Start typing a name or cemetery…" aria-label="Search memorials"><span id="result-count" class="result-count">${people.length} memorial${people.length === 1 ? '' : 's'}</span></div><div id="discover-grid">${renderPeopleCards(people)}</div><div class="empty-state search-empty" id="search-empty"><strong>No matches yet</strong>Try a shorter name, a different spelling, or the cemetery name.</div></section>`;
}

function mediaSource(person) {
  if (person.videoData) return person.videoData;
  return validDirectMediaUrl(person.videoUrl);
}

function hasVideo(person) {
  return Boolean(person.videoData || person.videoBlobId || validDirectMediaUrl(person.videoUrl));
}

function hasVideoAccess() {
  if (session?.role === 'admin') return true;
  const email = currentMemberEmail();
  return Boolean(email && data.videoSubscriptions?.[email]);
}

function videoPlayerMarkup(person) {
  const source = mediaSource(person);
  const blobAttribute = person.videoBlobId ? ` data-video-blob-id="${escapeHtml(person.videoBlobId)}"` : '';
  return `<section class="media-panel video-panel"><p class="section-label">Video memory · maximum 60 seconds</p><video class="media-video"${source ? ` src="${escapeHtml(source)}"` : ''}${blobAttribute} controls preload="metadata" aria-label="Video memory for ${escapeHtml(person.name)}"></video><p class="small-text muted">${escapeHtml(person.videoName || 'Family-approved video memory')}</p>${session?.role === 'admin' ? '' : '<p class="field-help">Video access demo active · no payment was taken.</p>'}</section>`;
}

function videoGateMarkup(person) {
  const action = session?.role === 'member'
    ? `<button class="button primary" type="button" data-action="subscribe-video-demo">Unlock video access · demo</button>`
    : `<button class="button primary" type="button" data-action="show-login">Sign in to try video access</button>`;
  return `<section class="video-gate"><p class="eyebrow">Video access</p><h2 class="section-title">Photos stay free to view.</h2><p class="small-text">This family-approved video is limited to 60 seconds and is available with the single Video Access demo. The button only unlocks this browser demo; it does not create a real subscription or charge.</p>${action}</section>`;
}

function renderMemoryChat(person) {
  if (person.public === false) return '';
  const id = escapeHtml(person.id);
  if (!chatExpandedIds.has(person.id)) return `<section class="memory-chat-launch"><button class="button primary talk-button" type="button" data-action="toggle-memory-chat" data-id="${id}">Talk to them <span aria-hidden="true">→</span></button><p class="chat-opening-note">An AI companion can help you reflect. It is not ${escapeHtml(person.name)} and cannot speak for them.</p></section>`;
  const history = chatHistory.get(person.id) || [];
  const messages = history.map((message) => { const user = message.role === 'user'; const notice = message.role === 'error'; return `<div class="chat-message ${user ? 'user' : notice ? 'notice' : 'assistant'}"><span class="chat-avatar" aria-hidden="true">${user ? 'Y' : notice ? '!' : 'L'}</span><div class="chat-bubble"><span class="chat-speaker">${user ? 'You' : notice ? 'Connection notice' : 'Memory Companion · AI'}</span><p>${escapeHtml(message.content)}</p></div></div>`; }).join('');
  const status = chatMode === 'live' ? '<span class="chat-mode live">AI replies · uses project credits</span>' : '<span class="chat-mode">Guided scripted demo</span>';
  const consent = chatConsentIds.has(person.id);
  const disabled = pendingChats.has(person.id);
  return `<section class="memory-chat" aria-labelledby="memory-chat-title"><div class="memory-chat-heading"><div><p class="eyebrow">A gentle place to reflect</p><h2 class="section-title" id="memory-chat-title">Memory Companion</h2></div><div class="chat-heading-actions">${status}<button class="chat-close" type="button" data-action="toggle-memory-chat" data-id="${id}" aria-label="Close conversation">Close</button></div></div><p class="chat-disclosure"><strong>This is an AI companion, not ${escapeHtml(person.name)}.</strong> It cannot contact them or know what they would have said. Replies use the memorial details shared here and your messages; they may be wrong.</p><div class="chat-transcript" id="chat-transcript-${id}" role="log" aria-live="polite" aria-relevant="additions text"><div class="chat-message assistant"><span class="chat-avatar" aria-hidden="true">L</span><div class="chat-bubble"><span class="chat-speaker">Memory Companion · AI</span><p>I’m here to help you reflect on what’s shared here. I’m not the person remembered, and I won’t invent what they might say. What memory would you like to revisit?</p></div></div>${messages}${disabled ? '<p class="chat-thinking" role="status">Taking a moment to respond…</p>' : ''}</div><label class="chat-consent"><input type="checkbox" data-chat-consent="${id}"${consent ? ' checked' : ''}><span>I agree that my message and this memorial’s public name, dates, epitaph, and story may be sent to the AI service for a reply. Chat is not saved. I will not share sensitive details.</span></label><form class="chat-form" id="memory-chat-form" data-memorial-id="${id}"><label class="sr-only" for="chat-input-${id}">Write a message to the AI memory companion</label><textarea id="chat-input-${id}" name="message" maxlength="600" required placeholder="Share a memory or ask about the details listed here…"${!consent || disabled ? ' disabled' : ''}></textarea><button class="button primary" type="submit"${!consent || disabled ? ' disabled' : ''}>Send</button></form><p class="field-help">${chatMode === 'live' ? 'Live replies use project AI credits.' : 'Guided scripted replies are active; live AI is not connected.'}</p></section>`;
}

const cemeteryLocations = [
  { key: 'azimpur', name: 'Azimpur Graveyard', address: '154 New Polton Lane, Dhaka 1205', lat: 23.729521, lon: 90.382014 },
  { key: 'jurain', name: 'Jurain Graveyard', address: 'Jurain Kobor Stan Road, Ward 83, Dhaka', lat: 23.697264, lon: 90.429209 },
  { key: 'banani', name: 'Banani Graveyard', address: 'Banani, Dhaka 1213', lat: 23.79957, lon: 90.40397 }
];
function cemeteryLocation(name) {
  const value = String(name || '').toLowerCase();
  return cemeteryLocations.find((place) => value.includes(place.key));
}

async function hydrateVideoPlayers() {
  const players = [...app.querySelectorAll('video[data-video-blob-id]')];
  for (const player of players) {
    const id = player.dataset.videoBlobId;
    if (!id || player.dataset.hydrated === 'true') continue;
    try {
      let url = videoObjectUrls.get(id);
      if (!url) {
        const blob = await getVideoBlob(id);
        if (!blob) {
          player.insertAdjacentHTML('afterend', '<p class="field-help media-error">This saved video is missing from this browser. Re-upload it from the administrator editor.</p>');
          continue;
        }
        url = URL.createObjectURL(blob);
        videoObjectUrls.set(id, url);
      }
      if (player.isConnected) {
        player.src = url;
        player.dataset.hydrated = 'true';
        player.load();
      }
    } catch {
      if (player.isConnected) player.insertAdjacentHTML('afterend', '<p class="field-help media-error">This browser could not read the saved video.</p>');
    }
  }
}

async function refreshChatMode() {
  if (chatStatusLoading || chatStatusLoaded) return;
  chatStatusLoading = true;
  try {
    const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const status = await response.json();
      chatMode = status.mode === 'live' ? 'live' : 'demo';
    }
  } catch {
    chatMode = 'demo';
  }
  chatStatusLoaded = true;
  chatStatusLoading = false;
  if (route === 'memorial') render();
}

function renderVideoPreview() {
  const holder = document.getElementById('video-preview');
  if (!holder) return;
  const person = routeId ? personById(routeId) : null;
  const url = validDirectMediaUrl(document.getElementById('person-video-url')?.value);
  holder.innerHTML = videoPreviewMarkup(person, url);
  void hydrateVideoPlayers();
}


function renderMemorial() {
  const person = personById(routeId);
  if (!person) return `<section class="page not-found"><p class="eyebrow">Memorial not found</p><h1 class="page-title small">This link may be out of date.</h1><button class="button secondary" type="button" data-page="discover">Return to the archive</button></section>`;
  if (person.public === false && session?.role !== 'admin') return `<section class="page not-found"><p class="eyebrow">Private memorial</p><h1 class="page-title small">This memorial is not public.</h1><p class="page-lead">Ask the memorial administrator for access.</p><button class="button secondary" type="button" data-page="discover">Return to the archive</button></section>`;
  const photo = person.photo || 'assets/serene-cemetery.jpg';
  const favorite = memberFavorites().includes(person.id);
  const videoAttached = hasVideo(person);
  const locationInfo = [person.section ? `Section ${person.section}` : '', person.plot ? `Plot ${person.plot}` : ''].filter(Boolean).join(' · ') || 'Plot details not recorded';
  const cemetery = cemeteryLocation(person.cemetery);
  const guest = session?.role === 'guest';
  const actions = guest
    ? `<button class="button secondary" type="button" data-action="show-login">Sign in to save</button>`
    : session?.role === 'member'
      ? `<button class="button ${favorite ? 'soft' : 'primary'}" type="button" data-action="toggle-favorite" data-id="${escapeHtml(person.id)}">${favorite ? '♥ Saved to my loved ones' : '♡ Save to my loved ones'}</button><button class="button secondary" type="button" data-action="leave-tribute" data-id="${escapeHtml(person.id)}">Leave a light · ${person.tributes}</button>`
      : `<button class="button secondary" type="button" data-page="admin-edit" data-id="${escapeHtml(person.id)}">Edit memorial</button>`;
  const story = escapeHtml(person.story || 'A story has not been added yet.');
  const videoArea = videoAttached ? (hasVideoAccess() ? videoPlayerMarkup(person) : videoGateMarkup(person)) : '';
  return `<section class="page"><button class="text-button" type="button" data-page="discover">← Back to the archive</button><div class="memorial-layout" style="margin-top:18px"><div><div class="memorial-photo-wrap"><img class="memorial-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(person.photo ? `Portrait or photograph for ${person.name}` : 'Peaceful cemetery grounds')}" onerror="this.src='assets/serene-cemetery.jpg'"><div class="photo-caption"><p class="eyebrow">A life remembered</p><span>${escapeHtml(person.cemetery)}</span></div></div><div class="stone-preview" role="img" aria-label="A realistic stone memorial preview for ${escapeHtml(person.name)}"><div class="stone-ground"></div><div class="stone-etching"><div class="stone-cross">✧</div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(yearsLabel(person))}</span></div></div><p class="small-text muted" style="text-align:center">Stone preview · a respectful, non-cartoon memorial style</p></div><div class="memorial-detail"><p class="eyebrow remembrance-glow" data-remembrance-tagline aria-live="off">Remembered with love</p><h1 class="memorial-name">${escapeHtml(person.name)}</h1><p class="memorial-years">${escapeHtml(yearsLabel(person))}</p><p class="epitaph">${escapeHtml(person.epitaph || 'A life that continues in the people who remember.')}</p><div class="memorial-meta"><div class="meta-box"><span>Resting place</span><strong>${escapeHtml(person.cemetery)}</strong></div><div class="meta-box"><span>Cemetery address</span><strong>${escapeHtml(cemetery?.address || 'Not confirmed')}</strong></div><div class="meta-box"><span>Section / plot</span><strong>${escapeHtml(locationInfo)}</strong></div></div><p class="memorial-story">${story}</p><div class="button-row" style="margin:22px 0 17px"><button class="button primary" type="button" data-page="map" data-id="${escapeHtml(person.id)}">View graveyard map</button><button class="button secondary" type="button" data-page="qr" data-id="${escapeHtml(person.id)}">Share QR code</button></div><div class="memorial-actions">${actions}</div>${videoArea}<p class="auth-terms" style="margin-top:22px">${person.sample ? 'Fictional sample memorial. Replace it with a record shared with permission.' : 'Please share photos, videos, and personal details only with permission.'}</p>${renderMemoryChat(person)}</div></div></section>`;
}


function renderMap() {
  const person = personById(routeId);
  if (!person || (person.public === false && session?.role !== 'admin')) return `<section class="page"><h1 class="page-title small">Location unavailable</h1><button class="button secondary" type="button" data-page="discover">Back to archive</button></section>`;
  const place = cemeteryLocation(person.cemetery);
  const plot = [person.section ? `Section ${escapeHtml(person.section)}` : '', person.plot ? `Plot ${escapeHtml(person.plot)}` : ''].filter(Boolean).join(' · ');
  if (!place) return `<section class="page"><button class="text-button" type="button" data-page="memorial" data-id="${escapeHtml(person.id)}">← Back to ${escapeHtml(person.name)}</button><h1 class="page-title small">${escapeHtml(person.cemetery)}</h1><div class="inline-notice"><strong>No verified cemetery map destination is available yet.</strong> No individual grave location has been entered.</div></section>`;
  const delta = 0.003;
  const bbox = `${place.lon-delta},${place.lat-delta},${place.lon+delta},${place.lat+delta}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${place.lat}%2C${place.lon}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat}%2C${place.lon}`;
  const plotNote = plot ? `<div class="plot-reference"><strong>Family-entered reference: ${plot}</strong><span>The pin and route lead to the cemetery only. This app has no surveyed internal plot map or grave coordinates.</span></div>` : `<div class="plot-reference"><strong>Individual grave location not recorded</strong><span>Ask the family or cemetery office for a verified section and plot. The animated pin marks the cemetery destination only.</span></div>`;
  return `<section class="page cemetery-map-page"><button class="text-button" type="button" data-page="memorial" data-id="${escapeHtml(person.id)}">← Back to ${escapeHtml(person.name)}</button><div class="page-heading" style="margin-top:17px"><div><p class="eyebrow">Cemetery directions</p><h1 class="page-title small">${escapeHtml(place.name)}</h1><p class="page-lead">For ${escapeHtml(person.name)} · cemetery-level location, not a verified grave pin.</p></div><span class="status-pill">Cemetery map reference</span></div><div class="card map-card"><div class="map-frame"><iframe title="Map of ${escapeHtml(place.name)} in Dhaka" src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer"></iframe><div class="map-destination-badge"><span class="map-pulse" aria-hidden="true"></span>Cemetery map pin</div></div><div class="map-card-details"><div><p class="section-label">Cemetery address</p><p class="map-address">${escapeHtml(place.address)}</p><p class="small-text muted">${place.lat}, ${place.lon} · OpenStreetMap</p></div><a class="button primary" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Get directions <span aria-hidden="true">↗</span></a></div>${plotNote}<p class="map-disclaimer">Directions open in Google Maps and route to this cemetery map reference, not a verified gate or grave. Confirm the entrance and individual grave location with the family or cemetery staff.</p></div></section>`;
}

function renderFavorites() {
  const people = data.people.filter((person) => memberFavorites().includes(person.id) && person.public !== false);
  return `<section class="page"><p class="eyebrow">Your family space</p><div class="page-heading"><div><h1 class="page-title small">My loved ones</h1><p class="page-lead">A private-to-this-browser list of memorials you have saved.</p></div><button class="button secondary" type="button" data-page="discover">Find another loved one</button></div>${people.length ? renderPeopleCards(people) : `<div class="empty-state"><strong>Your list is ready</strong>Open a public memorial and choose “Save to my loved ones.”</div>`}</section>`;
}

function renderAdminOverview() {
  const publicCount = data.people.filter((person) => person.public !== false).length;
  const mediaCount = data.people.reduce((total, person) => total + [person.photo, person.videoData || person.videoBlobId || person.videoUrl].filter(Boolean).length, 0);
  const latest = [...data.people].slice(-5).reverse();
  return `<section class="page"><p class="eyebrow">Administrator workspace</p><div class="page-heading"><div><h1 class="page-title small">The remembrance desk</h1><p class="page-lead">Manage memorial records, family accounts, photos, and videos in this browser.</p></div><button class="button primary" type="button" data-page="admin-edit">＋ Add a memorial</button></div><div class="stat-grid"><div class="stat-card"><div class="stat-caption">Total memorials</div><div class="stat-value">${data.people.length}</div><div class="stat-note">Public and private records</div></div><div class="stat-card"><div class="stat-caption">Public listings</div><div class="stat-value">${publicCount}</div><div class="stat-note">Visible in guest search</div></div><div class="stat-card"><div class="stat-caption">Family accounts</div><div class="stat-value">${data.members.length}</div><div class="stat-note">Local demo accounts</div></div><div class="stat-card"><div class="stat-caption">Media attached</div><div class="stat-value">${mediaCount}</div><div class="stat-note">Photos and videos</div></div></div><div class="page-heading" style="margin-bottom:13px"><div><p class="eyebrow">Recently added or updated</p><h2 class="section-title" style="margin:0">Memorial records</h2></div><button class="text-button" type="button" data-page="admin-memorials">Manage all →</button></div>${renderAdminTable(latest)}</section>`;
}


function renderAdminTable(people) {
  if (!people.length) return `<div class="empty-state"><strong>No records yet</strong>Create the first memorial record.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Dates</th><th>Location</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>${people.map((person) => { const plotInfo = [person.section ? `Section ${person.section}` : '', person.plot ? `Plot ${person.plot}` : ''].filter(Boolean).join(' · ') || 'Plot details not recorded'; return `<tr><td><strong>${escapeHtml(person.name)}</strong>${person.sample ? '<span class="small-text muted">Fictional sample placeholder</span>' : ''}</td><td>${escapeHtml(yearsLabel(person))}</td><td>${escapeHtml(person.cemetery)}<br><span class="muted">${escapeHtml(plotInfo)}</span></td><td><span class="status-pill${person.public === false ? ' private' : ''}">${person.public === false ? 'Private' : 'Public'}</span></td><td><div class="table-actions"><button class="tiny-link" type="button" data-action="edit-person" data-id="${escapeHtml(person.id)}">Edit</button><button class="tiny-link" type="button" data-action="media-person" data-id="${escapeHtml(person.id)}">Media</button><button class="tiny-link" type="button" data-action="qr-person" data-id="${escapeHtml(person.id)}">QR</button></div></td></tr>`; }).join('')}</tbody></table></div>`;
}

function renderAdminMemorials() {
  return `<section class="page"><p class="eyebrow">Administrator workspace</p><div class="page-heading"><div><h1 class="page-title small">Memorial records</h1><p class="page-lead">Add, revise, make public or private, and remove memorials.</p></div><button class="button primary" type="button" data-page="admin-edit">＋ Add memorial</button></div>${renderAdminTable(data.people)}</section>`;
}

function videoPreviewMarkup(person = null, urlOverride = '') {
  if (clearVideoOnSave) return '<p class="small-text muted">Video removed from this form. Save to apply.</p>';
  if (stagedVideoPreviewUrl) return `<video class="media-video" src="${escapeHtml(stagedVideoPreviewUrl)}" controls preload="metadata"></video><p class="field-help">${escapeHtml(stagedVideoName || 'Selected video')}</p>`;
  const url = validDirectMediaUrl(urlOverride) || validDirectMediaUrl(person?.videoUrl);
  if (stagedVideoData || person?.videoData || url) {
    const source = stagedVideoData || person?.videoData || url;
    return `<video class="media-video" src="${escapeHtml(source)}" controls preload="metadata"></video><p class="field-help">${escapeHtml(stagedVideoName || person?.videoName || 'Current video')}</p>`;
  }
  if (person?.videoBlobId) return `<video class="media-video" data-video-blob-id="${escapeHtml(person.videoBlobId)}" controls preload="metadata"></video><p class="field-help">${escapeHtml(person.videoName || 'Current uploaded video')}</p>`;
  return '<p class="small-text muted">No video has been attached.</p>';
}


function renderAdminForm() {
  const person = routeId ? personById(routeId) : null;
  if (routeId && !person) return `<section class="page"><h1 class="page-title small">Record not found</h1><button class="button secondary" data-page="admin-memorials">Back to memorials</button></section>`;
  stagedPhoto = person?.photo || '';
  stagedVideoData = person?.videoData || '';
  stagedVideoBlob = null;
  if (stagedVideoPreviewUrl) URL.revokeObjectURL(stagedVideoPreviewUrl);
  stagedVideoPreviewUrl = '';
  stagedVideoName = person?.videoName || '';
  clearVideoOnSave = false;
  const photoPreview = stagedPhoto ? `<img src="${escapeHtml(stagedPhoto)}" alt="Current memorial photo">` : `<div class="empty-state"><strong>No photo added</strong>Use a family-approved photograph.</div>`;
  const videoSourceValue = person?.videoUrl || '';
  return `<section class="page">
    <button class="text-button" type="button" data-page="admin-memorials">← Back to memorials</button>
    <p class="eyebrow" style="margin-top:16px">Administrator workspace</p>
    <h1 class="page-title small">${person ? 'Edit memorial' : 'Add a memorial'}</h1>
    <p class="page-lead">Use information shared by the family. Plot details are optional and should be added only when verified. Changes save in this browser.</p>
    <form id="memorial-form" class="card card-pad">
      <div class="field"><label for="person-name">Full name *</label><input id="person-name" name="name" required maxlength="100" value="${escapeHtml(person?.name || '')}" placeholder="Full name as the family would like it shown"></div>
      <div class="field-row"><div class="field"><label for="person-birth">Year of birth (optional)</label><input id="person-birth" name="birth" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(person?.birth || '')}" placeholder="Leave blank if unknown"></div><div class="field"><label for="person-death">Year of death (optional)</label><input id="person-death" name="death" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(person?.death || '')}" placeholder="Leave blank if unknown"></div></div>
      <div class="field"><label for="person-cemetery">Cemetery or memorial park</label><input id="person-cemetery" name="cemetery" maxlength="120" value="${escapeHtml(person?.cemetery || '')}" placeholder="Cemetery name"></div>
      <div class="field-row"><div class="field"><label for="person-section">Section or block (optional)</label><input id="person-section" name="section" maxlength="80" value="${escapeHtml(person?.section || '')}" placeholder="Leave blank until verified"></div><div class="field"><label for="person-plot">Plot or grave number (optional)</label><input id="person-plot" name="plot" maxlength="80" value="${escapeHtml(person?.plot || '')}" placeholder="Leave blank until verified"></div></div>
      <div class="field"><label for="person-epitaph">Epitaph or short remembrance (optional)</label><input id="person-epitaph" name="epitaph" maxlength="160" value="${escapeHtml(person?.epitaph || '')}" placeholder="A short line the family would like to share"></div>
      <div class="field"><label for="person-story">Their story (optional)</label><textarea id="person-story" name="story" maxlength="2400" placeholder="Share details only when the family has provided them.">${escapeHtml(person?.story || '')}</textarea><span class="field-help">Avoid adding private or sensitive information to this demonstration site.</span></div>
      <hr class="rule">
      <div class="field"><label for="person-photo">Memorial photo</label><input id="person-photo" type="file" accept="image/*"><span class="field-help">Choose a family-approved image. It will be resized before saving; photos are free to view.</span><div class="media-preview-box" id="photo-preview">${photoPreview}</div><button class="button secondary compact" type="button" data-action="clear-staged-photo">Remove photo</button></div>
      <div class="field"><label for="person-video">Video memory · up to 60 seconds</label><input id="person-video" type="file" accept="video/mp4,video/webm,video/quicktime"><span class="field-help">Upload one clip up to 60 seconds and 100 MB. Browser storage availability varies. Video viewing is restricted by the demo access gate.</span><div class="media-preview-box" id="video-preview">${videoPreviewMarkup(person, videoSourceValue)}</div><button class="button secondary compact" type="button" data-action="clear-staged-video">Remove video</button></div>
      <div class="field"><label for="person-video-url">Or use a direct HTTP or HTTPS video link</label><input id="person-video-url" name="videoUrl" type="url" value="${escapeHtml(videoSourceValue)}" placeholder="https://example.com/memory.mp4"><span class="field-help">Use a public direct MP4/WebM URL; the clip must be no longer than 60 seconds.</span></div>
      <div class="field"><label class="checkbox-row"><input id="person-public" name="public" type="checkbox"${person?.public !== false ? ' checked' : ''}><span>Make this memorial public in guest search and QR links.</span></label></div>
      <div class="button-row"><button class="button primary" type="submit">Save memorial</button><button class="button secondary" type="button" data-page="admin-memorials">Cancel</button>${person ? `<button class="button danger" type="button" data-action="delete-person" data-id="${escapeHtml(person.id)}">Delete memorial</button>` : ''}</div>
    </form>
  </section>`;
}

function renderAdminMedia() {
  const person = personById(routeId);
  if (!person) return `<section class="page"><h1 class="page-title small">Record not found</h1><button class="button secondary" data-page="admin-memorials">Back to memorials</button></section>`;
  const video = hasVideo(person);
  return `<section class="page"><button class="text-button" type="button" data-page="admin-memorials">← Back to memorials</button><p class="eyebrow" style="margin-top:16px">Administrator workspace · Media</p><h1 class="page-title small">${escapeHtml(person.name)}</h1><p class="page-lead">Review, replace, or remove attached photos and videos.</p><div class="media-admin-grid">
    <article class="card card-pad"><h2 class="section-title">Photo</h2>${person.photo ? `<img class="media-image" src="${escapeHtml(person.photo)}" alt="Memorial photograph">` : `<div class="empty-state"><strong>No uploaded photo</strong>The public page uses a general cemetery photograph as its fallback.</div>`}<div class="button-row" style="margin-top:15px"><button class="button secondary" type="button" data-action="edit-person" data-id="${escapeHtml(person.id)}">Replace or edit photo</button>${person.photo ? `<button class="button danger compact" type="button" data-action="remove-photo" data-id="${escapeHtml(person.id)}">Remove photo</button>` : ''}</div></article>
    <article class="card card-pad"><h2 class="section-title">Video · 60 seconds max</h2>${video ? `${videoPreviewMarkup(person)}<p class="small-text muted">${escapeHtml(person.videoName || person.videoUrl || 'Uploaded video')}</p><button class="button danger compact" type="button" data-action="remove-video" data-id="${escapeHtml(person.id)}">Remove video</button>` : `<div class="empty-state"><strong>No video attached</strong>Upload a clip or add a direct video link from the edit form.</div>`}<div style="margin-top:15px"><button class="button secondary" type="button" data-action="edit-person" data-id="${escapeHtml(person.id)}">Add or edit video</button></div></article>
  </div></section>`;
}


function renderAdminSettings() {
  return `<section class="page"><p class="eyebrow">Administrator workspace</p><h1 class="page-title small">Share links & data</h1><p class="page-lead">Set the QR link address or move the browser demo to another laptop with a backup file.</p><div class="split-layout"><form class="card card-pad" id="settings-form"><h2 class="section-title">Phone QR links</h2><div class="field"><label for="public-base-url">Public base URL (optional)</label><input id="public-base-url" name="publicBaseUrl" type="url" value="${escapeHtml(data.publicBaseUrl || '')}" placeholder="https://your-hosted-site.example"><span class="field-help">Leave blank to use this page's address. For a phone on the same Wi-Fi, use your laptop's reachable network address and port.</span></div><button class="button primary" type="submit">Save QR link address</button><div class="settings-help">A phone on mobile data cannot reach a laptop connected to campus Wi‑Fi. Cross-network QR scans need a public HTTPS host; same-Wi‑Fi testing can use the laptop IP and port 5500.</div></form><div class="card card-pad"><h2 class="section-title">Move or restore demo data</h2><p class="small-text muted">Download the memorials, family demo accounts, favorites, and media references saved in this browser. Import the JSON on another laptop to continue the demo.</p><div class="button-row"><button class="button secondary" type="button" data-action="export-backup">Download JSON backup</button><button class="button secondary" type="button" data-action="choose-import">Import JSON backup</button><input id="import-backup" type="file" accept="application/json,.json" hidden></div><hr class="rule"><h3 class="section-title" style="font-size:23px">Restore initial records</h3><p class="small-text muted">This replaces local changes with the supplied Bangladesh records and clearly marked sample placeholders.</p><button class="button danger compact" type="button" data-action="reset-demo">Restore initial records</button><div class="inline-notice"><strong>Local-only:</strong> a backup file contains demo account data. Do not include real passwords or sensitive memorial information.</div></div></div></section>`;
}

function renderQr() {
  const person = personById(routeId);
  if (!person) return `<section class="page"><h1 class="page-title small">Memorial not found</h1><button class="button secondary" type="button" data-page="discover">Back to archive</button></section>`;
  if (person.public === false && session?.role !== 'admin') return `<section class="page"><p class="eyebrow">Private memorial</p><h1 class="page-title small">This memorial is not public.</h1><p class="page-lead">Private memorial QR links are available only to the administrator. Ask for access if you believe you should be able to view it.</p><button class="button secondary" type="button" data-page="discover">Back to archive</button></section>`;
  const link = memorialLink(person);
  let svg = '';
  let warning = '';
  try {
    if (typeof window.qrcode !== 'function') throw new Error('QR generator unavailable');
    const qr = window.qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    svg = qr.createSvgTag(8, 4, `QR code linking to ${person.name}`);
  } catch (error) {
    warning = 'This link is too long to fit in a QR code. Shorten the public base URL in administrator settings.';
    console.error(error);
  }
  return `<section class="page"><button class="text-button" type="button" data-page="memorial" data-id="${escapeHtml(person.id)}">← Back to ${escapeHtml(person.name)}</button><p class="eyebrow" style="margin-top:16px">Share this memorial</p><h1 class="page-title small">A link they can scan.</h1><p class="page-lead">The QR code contains a direct link to this public memorial. Scan it with a phone camera after hosting the site or setting a reachable public base URL.</p><div class="qr-layout"><div class="card qr-panel"><p class="section-label">${escapeHtml(person.name)}</p>${svg ? `<div class="qr-frame" id="qr-frame">${svg}</div>` : `<div class="inline-notice">${escapeHtml(warning)}</div>`}<div class="url-box">${escapeHtml(link)}</div><div class="button-row" style="justify-content:center;margin-top:16px"><button class="button primary compact" type="button" data-action="copy-link" data-id="${escapeHtml(person.id)}">Copy link</button><button class="button secondary compact" type="button" data-action="download-qr-svg" data-id="${escapeHtml(person.id)}">Download SVG</button><button class="button secondary compact" type="button" data-action="download-qr-png" data-id="${escapeHtml(person.id)}">Download PNG</button></div></div><div class="card card-pad"><h2 class="section-title">Make the phone scan work</h2><p class="small-text muted">When this app is hosted on a public HTTPS address, QR links use that address automatically. In a local laptop demo, a phone cannot open the laptop's <em>localhost</em> address.</p><ol class="small-text muted" style="padding-left:19px;line-height:1.9"><li>For a hosted site, enter its public HTTPS address in Admin → Settings and create a fresh QR. A campus Wi‑Fi laptop address will not work from a phone on mobile data.</li><li>For a phone on the same Wi-Fi, use the laptop's reachable network address in Admin → Settings.</li><li>Keep the memorial public if guests should be able to scan and view it.</li></ol><div class="settings-help"><strong>Privacy:</strong> this QR contains the memorial link, not private data. Private records do not appear in guest browsing.</div></div></div></section>`;
}

function renderRoute() {
  switch (route) {
    case 'home': return renderWelcome();
    case 'discover': return renderDiscover();
    case 'memorial': return renderMemorial();
    case 'map': return renderMap();
    case 'favorites': return renderFavorites();
    case 'admin': return renderAdminOverview();
    case 'admin-memorials': return renderAdminMemorials();
    case 'admin-edit': return renderAdminForm();
    case 'admin-media': return renderAdminMedia();
    case 'admin-settings': return renderAdminSettings();
    case 'qr': return renderQr();
    default: return session?.role === 'admin' ? renderAdminOverview() : session?.role === 'guest' ? renderDiscover() : renderWelcome();
  }
}

function render() {
  if (!session) {
    route = 'login';
    app.innerHTML = renderLogin();
    return;
  }
  if (session.role !== 'admin' && route.startsWith('admin')) {
    route = session.role === 'guest' ? 'discover' : 'home';
    routeId = '';
  }
  if (session.role === 'admin' && ['login', 'home'].includes(route)) route = 'admin';
  if (session.role === 'guest' && ['login', 'home', 'favorites'].includes(route)) route = 'discover';
  try {
    app.innerHTML = `<div class="app-shell">${renderHeader()}<main class="main-content">${renderRoute()}</main>${renderFooter()}</div>`;
    if (route === 'discover') updateSearchResults('');
    void hydrateVideoPlayers();
    if (!chatStatusLoaded) void refreshChatMode();
  } catch (error) {
    console.error('Lumen route render failed.', error);
    app.innerHTML = `<div class="app-shell"><main class="main-content"><section class="page error-recovery"><p class="eyebrow">Workspace recovery</p><h1 class="page-title small">This page could not be opened.</h1><p class="page-lead">Your saved memorial data has not been erased. Try opening the page again, or sign out and return to the administrator account.</p><div class="button-row"><button class="button primary" type="button" data-action="retry-render">Try again</button><button class="button secondary" type="button" data-action="logout">Sign out</button></div></section></main></div>`;
  }
}


function updateSearchResults(query) {
  const grid = document.getElementById('discover-grid');
  const empty = document.getElementById('search-empty');
  const count = document.getElementById('result-count');
  if (!grid) return;
  const normalized = query.trim().toLowerCase();
  const cards = [...grid.querySelectorAll('.memorial-card')];
  let visible = 0;
  for (const card of cards) {
    const searchable = card.textContent.toLowerCase();
    const show = !normalized || searchable.includes(normalized);
    card.hidden = !show;
    if (show) visible++;
  }
  if (empty) empty.style.display = visible ? 'none' : 'block';
  if (count) count.textContent = `${visible} memorial${visible === 1 ? '' : 's'}`;
}

function startSession(nextSession, nextRoute) {
  session = nextSession;
  setSession(session);
  navigate(nextRoute, '', true);
  toast(`Signed in to the ${session.role === 'admin' ? 'administrator' : session.role === 'member' ? 'family member' : 'guest'} demo.`);
}

function handleLogin(form) {
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const error = document.getElementById('auth-error');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = 'Enter a valid email address.';
    return;
  }
  if (loginMode === 'signup') {
    const name = String(formData.get('name') || '').trim();
    if (!name || !email || password.length < 6) {
      error.textContent = 'Enter your name, a valid email, and a password with at least 6 characters.';
      return;
    }
    if (email === DEMO_ACCOUNTS.admin.email || data.members.some((member) => member.email.toLowerCase() === email)) {
      error.textContent = 'An account with this email already exists.';
      return;
    }
    const member = { email, password, name };
    data.members.push(member);
    data.favorites[email] = [];
    if (!persist('Family account created in this browser.')) return;
    startSession({ role: 'member', name, email }, 'home');
    return;
  }
  if (email === DEMO_ACCOUNTS.admin.email && password === DEMO_ACCOUNTS.admin.password) {
    startSession({ role: 'admin', name: DEMO_ACCOUNTS.admin.name, email }, 'admin');
    return;
  }
  const member = data.members.find((item) => item.email.toLowerCase() === email && item.password === password);
  if (member) {
    startSession({ role: 'member', name: member.name, email }, 'home');
    return;
  }
  error.textContent = 'Those sign-in details do not match. Use the administrator credentials, sign in to a registered family account, or create one.';
}

function publicBase() {
  const configured = String(data.publicBaseUrl || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (location.protocol === 'file:') return 'http://localhost:5500';
  return `${location.origin}${location.pathname}`.replace(/\/+$/, '');
}

function memorialLink(person) {
  return `${publicBase()}?memorial=${encodeURIComponent(person.id)}`;
}

function validDirectMediaUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : '';
  } catch {
    return '';
  }
}

async function handleMemorialSubmit(form) {
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const birth = String(formData.get('birth') || '').trim();
  const death = String(formData.get('death') || '').trim();
  if (!name) return toast('Please add the memorial name.');
  if ((birth && !/^\d{4}$/.test(birth)) || (death && !/^\d{4}$/.test(death))) return toast('Years must use four digits.');
  const videoUrlInput = String(formData.get('videoUrl') || '').trim();
  const videoUrl = validDirectMediaUrl(videoUrlInput);
  if (videoUrlInput && !videoUrl) return toast('Use a complete HTTP or HTTPS video URL.');
  const old = routeId ? personById(routeId) : null;
  const id = old?.id || idForNewMemorial();
  const oldVideoBlobId = old?.videoBlobId || '';
  let videoBlobId = oldVideoBlobId;
  let videoData = old?.videoData || '';
  let videoName = old?.videoName || '';
  let newlySavedBlobId = '';
  if (videoUrlInput) {
    videoBlobId = '';
    videoData = '';
    videoName = old?.videoName || 'Video link';
  } else if (stagedVideoBlob) {
    newlySavedBlobId = `${id}-video-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await saveVideoBlob(newlySavedBlobId, stagedVideoBlob);
      videoBlobId = newlySavedBlobId;
      videoData = '';
      videoName = stagedVideoName || 'Uploaded video';
    } catch (error) {
      return toast(error.message || 'Could not save the video. Your memorial record was not changed.');
    }
  } else if (clearVideoOnSave) {
    videoBlobId = '';
    videoData = '';
    videoName = '';
  }
  const item = normalizePerson({
    ...old,
    id, name, birth, death,
    cemetery: String(formData.get('cemetery') || '').trim() || 'Cemetery not specified',
    section: String(formData.get('section') || '').trim(), plot: String(formData.get('plot') || '').trim(),
    epitaph: String(formData.get('epitaph') || '').trim(), story: String(formData.get('story') || '').trim(),
    photo: stagedPhoto, videoBlobId, videoData, videoName, videoUrl,
    public: document.getElementById('person-public').checked,
    sample: false
  });
  const previousData = data;
  const nextData = structuredClone(data);
  if (old) nextData.people = nextData.people.map((candidate) => candidate.id === old.id ? item : candidate);
  else nextData.people.unshift(item);
  data = nextData;
  if (!persist('Memorial saved in this browser.')) {
    data = previousData;
    if (newlySavedBlobId) void deleteVideoBlob(newlySavedBlobId).catch(() => {});
    return;
  }
  if (oldVideoBlobId && oldVideoBlobId !== videoBlobId) void deleteVideoBlob(oldVideoBlobId).catch(() => {});
  if (stagedVideoPreviewUrl) URL.revokeObjectURL(stagedVideoPreviewUrl);
  stagedVideoPreviewUrl = '';
  navigate('admin-memorials');
}

function handleSettingsSubmit(form) {
  const input = String(new FormData(form).get('publicBaseUrl') || '').trim();
  if (!input) {
    data.publicBaseUrl = '';
  } else {
    let url;
    try { url = new URL(input); } catch { return toast('Enter a complete public URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return toast('Use a public HTTP or HTTPS address without login details.');
    data.publicBaseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }
  persist('Public memorial link settings saved.');
  render();
}

function renderPhotoPreview() {
  const holder = document.getElementById('photo-preview');
  if (!holder) return;
  holder.innerHTML = stagedPhoto ? `<img src="${escapeHtml(stagedPhoto)}" alt="Photo preview">` : `<div class="empty-state"><strong>No photo added</strong>Use a family-approved photograph.</div>`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

async function shrinkImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This image could not be opened.')); });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5f2ea';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    if (!blob) throw new Error('This image could not be resized.');
    return await fileToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function removePerson(id) {
  const person = personById(id);
  if (!person || !confirm(`Delete the memorial for ${person.name}? This cannot be undone in this browser.`)) return;
  const previousData = data;
  const nextData = structuredClone(data);
  nextData.people = nextData.people.filter((candidate) => candidate.id !== id);
  for (const email of Object.keys(nextData.favorites)) nextData.favorites[email] = (nextData.favorites[email] || []).filter((savedId) => savedId !== id);
  data = nextData;
  if (!persist('Memorial deleted from this browser.')) { data = previousData; return; }
  if (person.videoBlobId) void deleteVideoBlob(person.videoBlobId).catch(() => {});
  navigate('admin-memorials');
}

function handleFavorite(id) {
  const person = personById(id);
  if (!person) return;
  const favorites = memberFavorites();
  const index = favorites.indexOf(id);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.push(id);
  persist(index >= 0 ? 'Removed from your loved ones.' : 'Saved to your loved ones.');
  render();
}

function downloadBlob(filename, contents, mimeType) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeQrSvg(person) {
  if (!person || typeof window.qrcode !== 'function') throw new Error('QR code generator unavailable');
  const qr = window.qrcode(0, 'M');
  qr.addData(memorialLink(person));
  qr.make();
  return qr.createSvgTag(10, 4, `QR code linking to ${person.name}`);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  toast('Memorial link copied.');
}

function downloadQrSvg(person) {
  const svg = makeQrSvg(person);
  downloadBlob(`lumen-${person.id}.svg`, svg, 'image/svg+xml;charset=utf-8');
  toast('Scannable QR code downloaded as SVG.');
}

function downloadQrPng(person) {
  const svg = makeQrSvg(person);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 28, 28, 844, 844);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return toast('Could not create PNG; download the SVG instead.');
      downloadBlob(`lumen-${person.id}.png`, blob, 'image/png');
      toast('Scannable QR code downloaded as PNG.');
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); toast('Could not render PNG; download the SVG instead.'); };
  image.src = url;
}

function saveImportedBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result));
      if (!incoming || !Array.isArray(incoming.people) || !Array.isArray(incoming.members)) throw new Error('This file does not look like a Lumen backup.');
      data = {
        people: incoming.people.map(normalizePerson),
        members: incoming.members,
        favorites: incoming.favorites && typeof incoming.favorites === 'object' ? incoming.favorites : {},
        videoSubscriptions: incoming.videoSubscriptions && typeof incoming.videoSubscriptions === 'object' ? incoming.videoSubscriptions : {},
        publicBaseUrl: typeof incoming.publicBaseUrl === 'string' ? incoming.publicBaseUrl : ''
      };
      if (persist('Browser data restored from backup.')) render();
    } catch (error) {
      toast(error.message || 'Could not import that JSON file.');
    }
  };
  reader.onerror = () => toast('Could not read that backup file.');
  reader.readAsText(file);
}

function handleClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.page) {
    const id = button.dataset.id || '';
    navigate(button.dataset.page, id);
    return;
  }
  if (button.dataset.person) {
    navigate('memorial', button.dataset.person);
    return;
  }
  if (button.dataset.demo) {
    const account = DEMO_ACCOUNTS[button.dataset.demo];
    if (!account) return;
    startSession({ role: account.role, name: account.name, email: account.email }, account.role === 'admin' ? 'admin' : 'home');
    return;
  }
  const action = button.dataset.action;
  if (!action) return;
  const id = button.dataset.id || routeId;
  if (action === 'guest') return startSession({ role: 'guest', name: 'Guest visitor', email: '' }, 'discover');
  if (action === 'show-login') {
    session = null;
    setSession(null);
    loginMode = 'login';
    route = 'login';
    history.pushState(null, '', location.pathname);
    return render();
  }
  if (action === 'logout') {
    session = null;
    setSession(null);
    loginMode = 'login';
    route = 'login';
    history.pushState(null, '', location.pathname);
    return render();
  }
  if (action === 'toggle-auth-mode') { loginMode = loginMode === 'login' ? 'signup' : 'login'; return render(); }
  if (action === 'toggle-password') {
    const input = document.getElementById('auth-password');
    if (input) { input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Show' : 'Hide'; }
    return;
  }
  if (action === 'search-from-home') {
    const input = document.getElementById('home-search');
    const query = input?.value.trim() || '';
    navigate('discover');
    const search = document.getElementById('memorial-search');
    if (search) { search.value = query; updateSearchResults(query); }
    return;
  }
  if (action === 'edit-person') return navigate('admin-edit', id);
  if (action === 'media-person') return navigate('admin-media', id);
  if (action === 'qr-person') return navigate('qr', id);
  if (action === 'delete-person') return removePerson(id);
  if (action === 'toggle-favorite') return handleFavorite(id);
  if (action === 'toggle-memory-chat') { if (chatExpandedIds.has(id)) chatExpandedIds.delete(id); else chatExpandedIds.add(id); return render(); }
  if (action === 'leave-tribute') {
    const person = personById(id);
    if (person) { person.tributes = (Number(person.tributes) || 0) + 1; if (persist('A light has been left.')) render(); }
    return;
  }
  if (action === 'clear-staged-photo') {
    stagedPhoto = '';
    const photoField = document.getElementById('person-photo');
    if (photoField) photoField.value = '';
    renderPhotoPreview();
    return toast('Photo removed from the form. Save to apply.');
  }
  if (action === 'retry-render') return render();
  if (action === 'subscribe-video-demo') {
    if (!data.videoSubscriptions) data.videoSubscriptions = {};
    const email = currentMemberEmail();
    if (!email) return toast('Sign in as a family member to try video access.');
    data.videoSubscriptions[email] = true;
    if (persist('Video access demo unlocked. No payment was taken.')) render();
    return;
  }
  if (action === 'clear-staged-video') {
    stagedVideoData = ''; stagedVideoBlob = null; stagedVideoName = ''; clearVideoOnSave = true;
    if (stagedVideoPreviewUrl) URL.revokeObjectURL(stagedVideoPreviewUrl);
    stagedVideoPreviewUrl = '';
    const videoField = document.getElementById('person-video');
    if (videoField) videoField.value = '';
    const urlField = document.getElementById('person-video-url');
    if (urlField) urlField.value = '';
    const preview = document.getElementById('video-preview');
    if (preview) preview.innerHTML = '<p class="small-text muted">Video removed from this form. Save to apply.</p>';
    return toast('Video removed from the form. Save to apply.');
  }

  if (action === 'remove-photo' || action === 'remove-video') {
    const person = personById(id);
    if (!person) return;
    const previousData = data;
    const nextData = structuredClone(data);
    const updated = nextData.people.find((candidate) => candidate.id === id);
    const oldVideoBlobId = updated.videoBlobId;
    if (action === 'remove-photo') updated.photo = '';
    else {
      updated.videoData = ''; updated.videoBlobId = ''; updated.videoName = ''; updated.videoUrl = '';
    }
    data = nextData;
    const label = action === 'remove-photo' ? 'Photo' : 'Video';
    if (persist(`${label} removed.`)) {
      if (action === 'remove-video' && oldVideoBlobId) void deleteVideoBlob(oldVideoBlobId).catch(() => {});
      render();
    } else data = previousData;
    return;
  }
  if (action === 'copy-link') { const person = personById(id); if (person) copyText(memorialLink(person)); return; }
  if (action === 'download-qr-svg') { try { const person = personById(id); if (person) downloadQrSvg(person); } catch { toast('Unable to generate QR code.'); } return; }
  if (action === 'download-qr-png') { try { const person = personById(id); if (person) downloadQrPng(person); } catch { toast('Unable to generate QR code.'); } return; }
  if (action === 'export-backup') return downloadBlob('lumen-sar-demo-backup.json', JSON.stringify(data, null, 2), 'application/json');
  if (action === 'choose-import') { document.getElementById('import-backup')?.click(); return; }
  if (action === 'reset-demo') {
    if (!confirm('Restore the initial Bangladesh memorial records? Your current browser demo data will be replaced.')) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LEGACY_STORE_KEY);
    localStorage.removeItem(OLDEST_STORE_KEY);
    void clearVideoBlobs().catch(() => {});
    for (const url of videoObjectUrls.values()) URL.revokeObjectURL(url);
    videoObjectUrls.clear();
    data = structuredClone(SEED_DATA);
    persist('Initial Bangladesh demo records restored.');
    return render();
  }
}

async function handleChatSubmit(form) {
  const id = form.dataset.memorialId;
  const person = personById(id);
  const input = form.querySelector('textarea[name="message"]');
  const message = String(input?.value || '').trim();
  if (!person || !message) return;
  if (!chatConsentIds.has(id)) return toast('Please read and accept the chat notice first.');
  if (message.length > 600) return toast('Please keep messages to 600 characters or fewer.');
  const history = chatHistory.get(id) || [];
  history.push({ role: 'user', content: message });
  chatHistory.set(id, history.slice(-8));
  pendingChats.add(id);
  render();
  scrollChatToLatest(id);
  try {
    const facts = { name: person.name, birth: person.birth, death: person.death, cemetery: person.cemetery, epitaph: person.epitaph, story: person.story };
    const messages = (chatHistory.get(id) || []).slice(-8);
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ consent: true, facts, messages })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.reply) throw new Error(payload?.error || 'The chat service returned no readable reply.');
    chatMode = payload.mode === 'live' ? 'live' : 'demo';
    const next = chatHistory.get(id) || [];
    next.push({ role: 'assistant', content: String(payload.reply).slice(0, 1500) });
    chatHistory.set(id, next.slice(-8));
  } catch (error) {
    const next = chatHistory.get(id) || [];
    const unreachable = error instanceof TypeError || error?.name === 'AbortError';
    const content = unreachable
      ? 'I could not reach the chat service. Your message remains visible in this page, but no reply arrived. Check that the Lumen server is running and connected, then try again.'
      : (error.message || 'The chat service could not reply. Please try again.');
    next.push({ role: 'error', content });
    chatHistory.set(id, next.slice(-8));
  } finally {
    pendingChats.delete(id);
    if (route === 'memorial' && routeId === id) { render(); scrollChatToLatest(id); }
  }
}

function scrollChatToLatest(id) {
  requestAnimationFrame(() => {
    const transcript = document.getElementById(`chat-transcript-${id}`);
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  });
}

function handleVideoMetadata(event) {
  const video = event.target;
  if (!(video instanceof HTMLVideoElement) || video.dataset.durationChecked === 'true') return;
  video.dataset.durationChecked = 'true';
  if (Number.isFinite(video.duration) && video.duration > 60.1) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.insertAdjacentHTML('afterend', '<p class="field-help media-error">This clip is longer than the 60-second demo limit. Choose a shorter video.</p>');
  }
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'auth-form') { event.preventDefault(); handleLogin(form); }
  if (form.id === 'memorial-form') { event.preventDefault(); void handleMemorialSubmit(form); }
  if (form.id === 'settings-form') { event.preventDefault(); handleSettingsSubmit(form); }
  if (form.id === 'memory-chat-form') { event.preventDefault(); void handleChatSubmit(form); }
}


async function measureVideoDuration(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('This video could not be opened.'));
    });
    return video.duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-chat-consent]')) {
    const id = target.dataset.chatConsent;
    if (target.checked) chatConsentIds.add(id);
    else chatConsentIds.delete(id);
    render();
    return;
  }
  if (target.id === 'person-photo' && target.files?.[0]) {
    const file = target.files[0];
    if (!file.type.startsWith('image/')) return toast('Choose an image file.');
    if (file.size > 15 * 1024 * 1024) return toast('Choose an image smaller than 15 MB.');
    toast('Resizing photo…');
    shrinkImage(file).then((result) => { stagedPhoto = result; renderPhotoPreview(); toast('Photo ready. Save the memorial to apply it.'); }).catch((error) => toast(error.message));
    return;
  }
  if (target.id === 'person-video' && target.files?.[0]) {
    const file = target.files[0];
    if (!file.type.startsWith('video/')) return toast('Choose a video file.');
    if (file.size > 100 * 1024 * 1024) return toast('Choose a video smaller than 100 MB.');
    toast('Checking video duration…');
    measureVideoDuration(file).then((duration) => {
      if (!Number.isFinite(duration) || duration > 60.1) throw new Error('Videos must be 60 seconds or shorter.');
      if (stagedVideoPreviewUrl) URL.revokeObjectURL(stagedVideoPreviewUrl);
      stagedVideoBlob = file;
      stagedVideoData = '';
      stagedVideoPreviewUrl = URL.createObjectURL(file);
      stagedVideoName = file.name;
      clearVideoOnSave = false;
      const urlField = document.getElementById('person-video-url');
      if (urlField) urlField.value = '';
      renderVideoPreview();
      toast('Video ready. Save the memorial to apply it.');
    }).catch((error) => toast(error.message || 'Could not read this video.'));
    return;
  }
  if (target.id === 'import-backup' && target.files?.[0]) {
    saveImportedBackup(target.files[0]);
    target.value = '';
  }
}


function handleInput(event) {
  if (event.target.id === 'memorial-search') updateSearchResults(event.target.value);
  if (event.target.id === 'person-video-url') {
    if (event.target.value.trim() && stagedVideoBlob) {
      stagedVideoBlob = null;
      stagedVideoData = '';
      if (stagedVideoPreviewUrl) URL.revokeObjectURL(stagedVideoPreviewUrl);
      stagedVideoPreviewUrl = '';
      stagedVideoName = '';
    }
    renderVideoPreview();
  }
}


app.addEventListener('click', handleClick);
app.addEventListener('submit', handleSubmit);
app.addEventListener('change', handleChange);
app.addEventListener('input', handleInput);
app.addEventListener('loadedmetadata', handleVideoMetadata, true);
window.addEventListener('popstate', () => { readLocation(); render(); });
window.addEventListener('hashchange', () => { readLocation(); render(); });
render();
let remembranceIndex = 0;
setInterval(() => {
  const items = document.querySelectorAll('[data-remembrance-tagline]');
  if (!items.length) return;
  remembranceIndex = (remembranceIndex + 1) % remembranceLines.length;
  items.forEach((item) => { item.classList.remove('tagline-change'); void item.offsetWidth; item.textContent = remembranceLines[remembranceIndex]; item.classList.add('tagline-change'); });
}, 3600);
void refreshChatMode();
