const VANILLA = {
  id: 'vanilla-official',
  title: 'Vanilla FNF',
  subtitle: 'Official web demo',
  description: 'The classic baseline. Hosted by the FNF creators.',
  kind: 'vanilla',
  url: 'https://ninja-muffin24.itch.io/funkin',
  source: 'Official itch.io web demo',
};

const state = {
  library: loadMetadata(),
  files: new Map(),
  active: null,
  currentUrl: '',
  muted: false,
  replaceId: null,
  modalTrigger: null,
};

const els = {
  grid: document.querySelector('#library-grid'),
  count: document.querySelector('#mod-count'),
  storage: document.querySelector('#storage-state'),
  importModal: document.querySelector('#import-modal'),
  helpModal: document.querySelector('#help-modal'),
  feedback: document.querySelector('#import-feedback'),
  player: document.querySelector('#player-overlay'),
  frame: document.querySelector('#game-frame'),
  playerName: document.querySelector('#player-name'),
  playerSource: document.querySelector('#player-source'),
  playerMessage: document.querySelector('#player-message'),
  muteLabel: document.querySelector('#mute-label'),
  toast: document.querySelector('#toast'),
};

function loadMetadata() {
  try {
    const saved = JSON.parse(localStorage.getItem('fnf-play-library') || '[]');
    return [VANILLA, ...saved.filter((item) => item && item.id !== VANILLA.id)];
  } catch {
    return [VANILLA];
  }
}

function persistMetadata() {
  const imported = state.library.filter((item) => item.kind !== 'vanilla').map(({ id, title, subtitle, description, kind, entry, fileCount, createdAt, url, source }) => ({ id, title, subtitle, description, kind, entry, fileCount, createdAt, url, source }));
  localStorage.setItem('fnf-play-library', JSON.stringify(imported));
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function renderLibrary() {
  els.count.textContent = state.library.length;
  els.storage.textContent = state.library.length > 1 ? 'METADATA SAVED' : 'IN-MEMORY FILES';
  els.grid.innerHTML = state.library.map((item, index) => {
    const isVanilla = item.kind === 'vanilla';
    const available = isVanilla || state.files.has(item.id) || item.kind === 'remote';
    return `<article class="mod-card ${isVanilla ? 'vanilla' : 'imported'}" tabindex="0">
      <div class="mod-top"><span class="mod-index">${String(index + 1).padStart(2, '0')} / ${isVanilla ? 'OFFICIAL' : 'IMPORTED'}</span><span class="mod-status ${item.kind === 'remote' ? 'remote' : ''}">${available ? (item.kind === 'remote' ? 'REMOTE' : 'READY') : 'RE-IMPORT'}</span></div>
      <div class="mod-content"><div class="mod-kicker">${escapeHtml(item.subtitle || 'HTML build')}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || `${item.fileCount || 0} files · ${item.entry || 'entry discovered'}`)}</p></div>
      <div class="mod-actions"><button class="small-button primary" data-action="play-mod" data-id="${item.id}">▶ Play</button>${isVanilla ? `<a class="small-button" href="${item.url}" target="_blank" rel="noreferrer">Official page ↗</a>` : `<button class="small-button" data-action="rename-mod" data-id="${item.id}">Rename</button><button class="small-button" data-action="replace-mod" data-id="${item.id}">Replace</button><button class="small-button" data-action="remove-mod" data-id="${item.id}">Remove</button>`}</div>
    </article>`;
  }).join('');
}

function setFeedback(message = '', type = 'info') {
  els.feedback.textContent = message;
  els.feedback.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--green)' : 'var(--yellow)';
}

function showModal(which) {
  state.modalTrigger = document.activeElement;
  which.hidden = false;
  document.body.style.overflow = 'hidden';
  const focusable = which.querySelector('button, input');
  setTimeout(() => focusable?.focus(), 30);
}

function closeModals() {
  els.importModal.hidden = true;
  els.helpModal.hidden = true;
  document.body.style.overflow = '';
  state.replaceId = null;
  setFeedback('');
  state.modalTrigger?.focus?.();
  state.modalTrigger = null;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function normalizePath(path) {
  const parts = path.replaceAll('\\', '/').split('/');
  const clean = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') { clean.pop(); continue; }
    clean.push(part);
  }
  return clean.join('/');
}

function mimeFor(name) {
  const ext = name.toLowerCase().split('.').pop();
  return ({ html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', ico: 'image/x-icon', txt: 'text/plain', wasm: 'application/wasm' })[ext] || 'application/octet-stream';
}

function findEntry(files) {
  const candidates = [...files.keys()].filter((name) => /\.(html?|xhtml)$/i.test(name));
  if (!candidates.length) throw new Error('No HTML entry file found. Add index.html, game.html, or main.html to the build.');
  const preferred = candidates.find((name) => /(^|\/)(index|game|main)\.html?$/i.test(name));
  return preferred || candidates.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0];
}

function resolveAsset(fromPath, reference) {
  if (!reference || /^(?:data:|blob:|https?:|mailto:|#|javascript:)/i.test(reference)) return null;
  const clean = reference.split('#')[0].split('?')[0];
  if (!clean) return null;
  const path = clean.startsWith('/') ? normalizePath(clean.slice(1)) : normalizePath(`${fromPath.split('/').slice(0, -1).join('/')}/${clean}`);
  return path;
}

async function makePlayableUrl(files, entry) {
  const urls = new Map();
  for (const [path, value] of files) {
    const blob = value instanceof Blob ? value : new Blob([value], { type: mimeFor(path) });
    urls.set(path, URL.createObjectURL(blob));
  }
  const raw = await (files.get(entry) instanceof File ? files.get(entry).text() : new Blob([files.get(entry)]).text());
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');
  const attrs = ['src', 'href', 'poster', 'data-src', 'data-audio'];
  for (const element of doc.querySelectorAll('*')) {
    for (const attr of attrs) {
      if (element.matches('link[rel="stylesheet"]') && attr === 'href') continue;
      const original = element.getAttribute(attr);
      const resolved = resolveAsset(entry, original || '');
      if (resolved && urls.has(resolved)) element.setAttribute(attr, urls.get(resolved));
    }
    if (element.tagName === 'STYLE') element.textContent = rewriteCss(element.textContent || '', entry, urls);
    if (element.tagName === 'SCRIPT' && !element.getAttribute('src')) element.textContent = element.textContent || '';
  }
  for (const sheet of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const original = sheet.getAttribute('href');
    const resolved = resolveAsset(entry, original || '');
    if (resolved && files.has(resolved)) {
      const cssText = await blobText(files.get(resolved));
      const cssBlob = new Blob([rewriteCss(cssText, resolved, urls)], { type: 'text/css' });
      const cssUrl = URL.createObjectURL(cssBlob);
      sheet.setAttribute('href', cssUrl);
    }
  }
  const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
  return { url: URL.createObjectURL(new Blob([html], { type: 'text/html' })), urls };
}

function rewriteCss(text, cssPath, urls) {
  return text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, reference) => {
    const resolved = resolveAsset(cssPath, reference);
    return resolved && urls.has(resolved) ? `url("${urls.get(resolved)}")` : full;
  });
}

async function blobText(value) {
  if (value instanceof File || value instanceof Blob) return value.text();
  return new Blob([value]).text();
}

async function parseZip(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('This file does not look like a readable ZIP archive.');
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  let cursor = centralOffset;
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP directory is malformed or uses an unsupported layout.');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameSize = view.getUint16(cursor + 28, true);
    const extraSize = view.getUint16(cursor + 30, true);
    const commentSize = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameSize));
    const normalized = normalizePath(name);
    cursor += 46 + nameSize + extraSize + commentSize;
    if (!normalized || name.endsWith('/')) continue;
    if (method !== 0 && method !== 8) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameSize = view.getUint16(localOffset + 26, true);
    const localExtraSize = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameSize + localExtraSize;
    const compressed = buffer.slice(start, start + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else {
      if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack deflated ZIP files. Try a folder import instead.');
      content = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    }
    files.set(normalized, new Blob([content], { type: mimeFor(normalized) }));
  }
  if (!files.size) throw new Error(`The ZIP directory was empty. (${centralSize} bytes inspected)`);
  return files;
}

async function importFiles(fileList, label = '') {
  if (!fileList?.length) return;
  setFeedback('Inspecting the build…');
  try {
    const first = fileList[0];
    let files;
    if (fileList.length === 1 && (first.name || '').toLowerCase().endsWith('.zip')) files = await parseZip(first);
    else {
      files = new Map();
      for (const file of fileList) {
        const path = normalizePath(file.webkitRelativePath || file.name);
        if (path && !path.endsWith('/')) files.set(path, file);
      }
    }
    const entry = findEntry(files);
    const id = state.replaceId || `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const old = state.library.find((item) => item.id === id);
    const title = old?.title || label || first.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    state.files.set(id, { files, entry, playable: null });
    const record = { id, title, subtitle: 'Local HTML build', description: `${files.size} files · entry: ${entry}`, kind: 'imported', entry, fileCount: files.size, createdAt: old?.createdAt || Date.now(), source: 'Current browser tab' };
    const existingIndex = state.library.findIndex((item) => item.id === id);
    if (existingIndex >= 0) state.library[existingIndex] = record;
    else state.library.push(record);
    persistMetadata();
    renderLibrary();
    closeModals();
    toast(`${title} is ready to play.`);
  } catch (error) {
    setFeedback(error.message || 'This build could not be imported.', 'error');
  }
}

function getMod(id) { return state.library.find((item) => item.id === id); }

async function playMod(id) {
  const mod = getMod(id);
  if (!mod) return;
  if (mod.kind === 'imported' && !state.files.has(id)) {
    state.replaceId = id;
    showModal(els.importModal);
    setFeedback('This browser tab no longer has the imported files. Choose the original ZIP or folder to restore it.', 'info');
    return;
  }
  state.active = mod;
  els.player.hidden = false;
  document.body.style.overflow = 'hidden';
  els.playerName.textContent = mod.title;
  els.playerSource.textContent = `Source: ${mod.source || 'current tab'}`;
  els.playerMessage.hidden = true;
  els.frame.removeAttribute('sandbox');
  if (mod.kind === 'imported') {
    try {
      const item = state.files.get(id);
      if (!item.playable) item.playable = await makePlayableUrl(item.files, item.entry);
      state.currentUrl = item.playable.url;
      els.frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-pointer-lock allow-modals allow-downloads');
      els.frame.src = state.currentUrl;
    } catch (error) {
      showPlayerError('This build needs a little more than the browser sandbox allows.', `${error.message} Try the original mod build or a different HTML export.`);
    }
  } else {
    state.currentUrl = mod.url;
    els.frame.src = mod.url;
  }
  window.setTimeout(() => els.frame.focus(), 80);
}

function showPlayerError(title, detail) {
  els.playerMessage.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}`;
  els.playerMessage.hidden = false;
}

function exitPlayer() {
  els.player.hidden = true;
  els.frame.src = 'about:blank';
  document.body.style.overflow = '';
  state.active = null;
  state.currentUrl = '';
}

function removeMod(id) {
  const mod = getMod(id);
  if (!mod || !confirm(`Remove ${mod.title} from your library?`)) return;
  const item = state.files.get(id);
  if (item?.playable) URL.revokeObjectURL(item.playable.url);
  state.files.delete(id);
  state.library = state.library.filter((entry) => entry.id !== id);
  persistMetadata(); renderLibrary(); toast(`${mod.title} removed.`);
}

function renameMod(id) {
  const mod = getMod(id);
  if (!mod) return;
  const next = prompt('Rename this build', mod.title);
  if (!next?.trim()) return;
  mod.title = next.trim(); persistMetadata(); renderLibrary(); toast('Build renamed.');
}

function openImport(replaceId = null) {
  state.replaceId = replaceId;
  showModal(els.importModal);
  setFeedback(replaceId ? 'Choose a replacement ZIP or folder for this build.' : '');
}

function switchTab(tab) {
  document.querySelectorAll('[data-import-tab]').forEach((button) => button.classList.toggle('active', button.dataset.importTab === tab));
  document.querySelectorAll('[data-import-panel]').forEach((panel) => { panel.hidden = panel.dataset.importPanel !== tab; });
}

async function addRemoteUrl() {
  const input = document.querySelector('#url-input');
  const url = input.value.trim();
  let parsed;
  try { parsed = new URL(url); } catch { setFeedback('Enter a complete http(s) URL.', 'error'); return; }
  if (!/^https?:$/.test(parsed.protocol)) { setFeedback('Only http(s) URLs can be embedded.', 'error'); return; }
  const id = `remote-${Date.now()}`;
  state.library.push({ id, title: parsed.hostname.replace(/^www\./, ''), subtitle: 'Remote HTML build', description: 'Loaded from a web URL · embedding depends on the host', kind: 'remote', url, source: url });
  persistMetadata(); renderLibrary(); input.value = ''; closeModals(); toast('Remote build added.');
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'open-import') openImport();
  if (action === 'open-help') showModal(els.helpModal);
  if (action === 'close-modal') closeModals();
  if (action === 'play-vanilla') playMod(VANILLA.id);
  if (action === 'play-mod') playMod(target.dataset.id);
  if (action === 'rename-mod') renameMod(target.dataset.id);
  if (action === 'remove-mod') removeMod(target.dataset.id);
  if (action === 'replace-mod') openImport(target.dataset.id);
  if (action === 'import-url') addRemoteUrl();
  if (action === 'exit-player') exitPlayer();
  if (action === 'reload-player') { if (els.frame.src) els.frame.src = els.frame.src; }
  if (action === 'mute-player') { state.muted = !state.muted; els.muteLabel.textContent = state.muted ? 'Unmute' : 'Mute'; els.frame.contentWindow?.postMessage({ type: state.muted ? 'FNF_PLAY_MUTE' : 'FNF_PLAY_UNMUTE' }, '*'); }
  if (action === 'fullscreen-player') { els.frame.requestFullscreen?.(); }
  if (action === 'open-current' && state.currentUrl) window.open(state.currentUrl, '_blank', 'noopener,noreferrer');
  if (action === 'scroll-library') document.querySelector('#library').scrollIntoView({ behavior: 'smooth' });
});

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-import-tab]');
  if (tab) switchTab(tab.dataset.importTab);
  if (event.target === els.importModal || event.target === els.helpModal) closeModals();
});

document.querySelector('#zip-input').addEventListener('change', (event) => importFiles([...event.target.files]));
document.querySelector('#folder-input').addEventListener('change', (event) => importFiles([...event.target.files]));

document.addEventListener('keydown', (event) => {
  const modal = [els.importModal, els.helpModal].find((candidate) => !candidate.hidden);
  if (modal && event.key === 'Tab') {
    const focusable = [...modal.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  if (event.key === 'Escape') { if (!els.player.hidden) exitPlayer(); else closeModals(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.mod-card')) event.target.querySelector('[data-action="play-mod"]')?.click();
});

els.frame.addEventListener('load', () => { els.playerMessage.hidden = true; });
els.frame.addEventListener('error', () => showPlayerError('The web build did not load.', 'The host may block embedding. Use “Open in new tab” or check the URL and try again.'));

renderLibrary();
