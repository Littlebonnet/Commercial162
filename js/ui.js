// Composants partagés : carte, graphiques, sélecteur de client, compte rendu de visite, rappels, photos.
import { S, put, del, kv, setKV } from './db.js';
import { cfg, typeColor, TYPE_NAMES, RESULTATS, findCommune, zoneOf, situationOf, zoneColor, jourNom } from './ref.js';
import { ic } from './icons.js';
import { $, $$, esc, uid, modal, toast, today, addDays, norm, debounce, dateFr, relDays, eur, telHref, hm2min } from './util.js';
import { idx, clientName, retard } from './metrics.js';
import { suggestAdresses } from './route.js';

// ---------- Thème ----------
export function applyTheme() {
  const t = cfg().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = isDark();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0D171E' : '#1B6DB5');
  window.dispatchEvent(new Event('themechange'));
}
export function isDark() {
  const t = cfg().theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}
export const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ---------- Carte Leaflet ----------
export function makeMap(el, { center = [45.30, 5.95], zoom = 10 } = {}) {
  const map = L.map(el, { zoomControl: true, attributionControl: true, tap: true }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap',
  }).addTo(map);
  // La carte doit se recalculer quand son conteneur change de taille (rotation de l'iPad)
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);
  map._ro = ro;
  return map;
}
export function destroyMap(map) { if (!map) return; try { map._ro && map._ro.disconnect(); map.remove(); } catch (e) { } }
export function pin(color, label = '', small = false, extra = '') {
  return L.divIcon({
    className: '', iconSize: small ? [18, 18] : [30, 30], iconAnchor: small ? [9, 9] : [15, 15],
    html: `<div class="pin ${small ? 'small' : ''} ${extra}" style="background:${color}">${esc(label)}</div>`,
  });
}
export function homeIcon() {
  return L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="pin home">${ic('home', 18)}</div>` });
}

// ---------- Petits éléments ----------
export const typeDot = t => `<span class="dot" style="background:${typeColor(t)}" title="${esc(t)}"></span>`;
export function retardTag(c) {
  if (c.statut === 'prospect') return `<span class="tag amber">${esc(c.etape || 'Prospect')}</span>`;
  const r = retard(c);
  if (r >= 999) return '<span class="tag grey">jamais vu</span>';
  if (r > 0) return `<span class="tag red">+${r} j</span>`;
  if (r > -4) return '<span class="tag amber">à voir</span>';
  return '';
}
// Situation (RJ, compte bloqué…) : rien si RAS
export function situationTag(c) {
  const s = situationOf(c);
  return s.k === 'RAS' ? '' : `<span class="tag ${s.niveau || 'grey'}">${esc(s.label)}</span>`;
}
export const zoneTag = z => z ? `<span class="tag zone" style="--zc:${zoneColor(z)}">${esc(z)}</span>` : '';
export function clientLine(c, end = '') {
  const lv = idx().lastVisit.get(c.id);
  const jours = [c.jourVisite ? 'visite ' + jourNom(c.jourVisite).toLowerCase() : '', c.jourAppel ? 'télévente ' + jourNom(c.jourAppel).toLowerCase() : ''].filter(Boolean).join(' · ');
  return `<a class="item" href="#/clients/${c.id}">${typeDot(c.typeEtab)}
    <div class="main"><div class="t">${esc(c.enseigne || c.nom)}</div><div class="s">${esc(c.ville || '')} · ${esc(c.typeEtab || '')} · vu ${relDays(lv)}${jours ? ' · ' + jours : ''}</div></div>
    <div class="end">${end}<div>${situationTag(c)}${retardTag(c)}</div></div>${ic('next', 20, 'chev')}</a>`;
}

// ---------- Sélecteur de client ----------
export function pickClient({ title = 'Choisir un client', prospects = true } = {}) {
  return new Promise(resolve => {
    let done = false;
    const m = modal({
      title,
      body: `<input type="search" placeholder="Nom, ville, n° client…" data-q autofocus><div class="list" data-l style="margin-top:8px"></div>`,
      onOpen(body, close) {
        const q = $('[data-q]', body), l = $('[data-l]', body);
        const draw = () => {
          const n = norm(q.value);
          const rows = S.clients.filter(c => !c.archive && (prospects || c.statut !== 'prospect'))
            .filter(c => !n || norm([c.nom, c.enseigne, c.ville, c.numClient].join(' ')).includes(n))
            .sort((a, b) => (a.enseigne || a.nom).localeCompare(b.enseigne || b.nom)).slice(0, 60);
          l.innerHTML = rows.map(c => `<div class="item" data-id="${c.id}">${typeDot(c.typeEtab)}<div class="main"><div class="t">${esc(c.enseigne || c.nom)}</div><div class="s">${esc(c.ville || '')} · ${esc(c.typeEtab || '')}${c.statut === 'prospect' ? ' · prospect' : ''}</div></div></div>`).join('') || '<div class="empty">Aucun client</div>';
        };
        q.oninput = debounce(draw, 120); draw();
        l.onclick = e => { const it = e.target.closest('[data-id]'); if (it) { done = true; resolve(it.dataset.id); close(); } };
        setTimeout(() => q.focus(), 50);
      },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.body)) { obs.disconnect(); if (!done) resolve(null); } });
    obs.observe(document.getElementById('modal-root'), { childList: true });
  });
}

// ---------- Compte rendu de visite rapide (1 clic + note + rappel) ----------
export function visiteRapide(clientId, { date = today(), onSaved } = {}) {
  const c = idx().byId.get(clientId);
  const existing = S.visites.find(v => v.clientId === clientId && v.date === date);
  let v = existing ? { ...existing } : null;
  let changed = false;
  // 1 appui sur le résultat = visite enregistrée. La note et le rappel sont facultatifs et s'ajoutent après.
  const saveNote = async body => {
    if (!v) return;
    const note = $('[data-note]', body).value.trim();
    if (note !== (v.note || '')) { v.note = note; await put('visites', v); changed = true; }
  };
  const finish = async (body, close) => {
    await saveNote(body);
    const rd = $('[data-rd]', body).value;
    if (rd) { await put('rappels', { id: uid(), clientId, date: rd, texte: $('[data-rt]', body).value.trim() || ('Suite visite : ' + (v ? v.resultat : '')), fait: false, cree: today() }); toast('Rappel créé pour le ' + dateFr(rd)); changed = true; }
    close && close();
    if (changed) onSaved && onSaved(v);
  };
  modal({
    title: 'Visite · ' + clientName(clientId),
    body: `<p class="muted small" style="margin-top:0" data-hint>${v ? 'Visite déjà enregistrée : tu peux changer le résultat ou compléter.' : 'Touche le résultat : la visite est enregistrée aussitôt.'}</p>
      <div class="res-grid">${RESULTATS.map(r => `<button class="btn ${v && v.resultat === r ? 'primary' : ''}" data-r="${esc(r)}">${resIcon(r)}${esc(r)}</button>`).join('')}</div>
      <label class="field" style="margin-top:14px"><span>Note (facultatif)</span><textarea data-note placeholder="Ce qui s'est dit, besoin, concurrence…">${esc(v ? v.note : '')}</textarea></label>
      <div class="row wrap-r"><label class="field grow" style="margin:0"><span>Rappel le (facultatif)</span><input type="date" data-rd></label>
      <div class="chips" style="align-self:flex-end">${[[7, '+1 sem.'], [14, '+2 sem.'], [30, '+1 mois']].map(([d, l]) => `<button class="chip" data-plus="${d}">${l}</button>`).join('')}</div></div>
      <label class="field" style="margin-top:10px"><span>Objet du rappel</span><input data-rt placeholder="Rappeler pour…"></label>`,
    onOpen(body, close) {
      $$('[data-plus]', body).forEach(b => b.onclick = () => { $('[data-rd]', body).value = addDays(date, +b.dataset.plus); });
      $('[data-note]', body).addEventListener('input', debounce(() => saveNote(body), 600));
      $$('[data-r]', body).forEach(b => b.onclick = async () => {
        v = v || { id: uid(), clientId, date, heure: new Date().toTimeString().slice(0, 5) };
        v.resultat = b.dataset.r; v.note = $('[data-note]', body).value.trim();
        await put('visites', v); changed = true;
        if (c && c.statut === 'prospect' && (!c.etape || c.etape === 'À contacter')) { c.etape = 'RDV pris'; c.etapeDate = today(); await put('clients', c); }
        $$('[data-r]', body).forEach(x => x.classList.toggle('primary', x === b));
        $('[data-hint]', body).innerHTML = '<b class="up">Visite enregistrée.</b> Ajoute une note ou un rappel si besoin, puis « Terminer ».';
        toast('Visite enregistrée');
      });
      // Fermeture par ✕ ou en touchant à côté : on garde la note saisie
      const back = body.closest('.modal-back');
      new MutationObserver((_, o) => { if (!back.isConnected) { o.disconnect(); finish(body); } }).observe(document.getElementById('modal-root'), { childList: true });
    },
    buttons: [
      ...(existing ? [{ label: 'Supprimer la visite', cls: 'ghost', onClick: async () => { await del('visites', existing.id); v = null; changed = true; toast('Visite supprimée'); } }] : []),
      { label: 'Terminer', cls: 'primary', onClick: async (body, close) => { if (!v) { toast('Choisis d\'abord un résultat'); return false; } } },
    ],
  });
}
export const resIcon = (r, size = 20) => ic({ 'Commande prise': 'check', 'RAS': 'check', 'À rappeler': 'phone', 'Absent': 'ban', 'Problème': 'alert', 'Prospection': 'star' }[r] || 'info', size);

// ---------- Rappel ----------
export function rappelForm(r = {}, onSaved) {
  const isNew = !r.id;
  modal({
    title: isNew ? 'Nouveau rappel' : 'Rappel',
    body: `<label class="field"><span>Client (facultatif)</span><button class="btn block" data-pc style="justify-content:flex-start">${r.clientId ? esc(clientName(r.clientId)) : 'Choisir…'}</button></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${esc(r.date || addDays(today(), 7))}"></label>
      <label class="field"><span>Objet</span><textarea name="texte" placeholder="Rappeler pour…">${esc(r.texte || '')}</textarea></label>`,
    onOpen(body) {
      $('[data-pc]', body).onclick = async () => { const id = await pickClient(); if (id) { r.clientId = id; $('[data-pc]', body).textContent = clientName(id); } };
    },
    buttons: [
      ...(isNew ? [] : [{ label: 'Supprimer', cls: 'ghost', onClick: async () => { await del('rappels', r.id); onSaved && onSaved(); } }]),
      { label: 'Enregistrer', cls: 'primary', onClick: async body => {
        const date = $('[name=date]', body).value, texte = $('[name=texte]', body).value.trim();
        if (!date) { toast('Choisis une date'); return false; }
        await put('rappels', { ...r, id: r.id || uid(), date, texte, fait: !!r.fait, cree: r.cree || today() });
        toast('Rappel enregistré'); onSaved && onSaved();
      } },
    ],
  });
}

// ---------- Auto-complétion d'adresse (API Adresse) ----------
export function addressAutocomplete(input, onPick) {
  const box = document.createElement('div');
  box.className = 'ac-box'; box.hidden = true;
  input.parentNode.style.position = 'relative';
  input.parentNode.appendChild(box);
  let items = [];
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim();
    if (q.length < 4 || !navigator.onLine) { box.hidden = true; return; }
    try { items = await suggestAdresses(q); } catch (e) { items = []; }
    box.innerHTML = items.map((it, i) => `<div class="ac-it" data-i="${i}">${esc(it.label)}</div>`).join('');
    box.hidden = !items.length;
  }, 250));
  box.addEventListener('click', e => {
    const it = e.target.closest('[data-i]'); if (!it) return;
    const a = items[+it.dataset.i]; box.hidden = true;
    input.value = a.adresse;
    onPick(a);
  });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 250));
}

// ---------- Photos & documents ----------
export async function compressImage(file, max = 1600, q = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise(res => cv.toBlob(b => res(b || file), 'image/jpeg', q));
  } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
}

// ---------- Sélecteurs de créneaux ----------
export function creneauxEditor(list, placeholder = []) {
  const rows = (list && list.length ? list : []).concat([['', ''], ['', ''], ['', ''], ['', '']]).slice(0, 4);
  return `<div class="cren">${rows.map(([a, b], i) => `<div class="row"><span class="muted small">de</span><input type="time" data-ca="${i}" value="${esc(a || '')}" placeholder="${esc((placeholder[i] || [])[0] || '')}"><span class="muted small">à</span><input type="time" data-cb="${i}" value="${esc(b || '')}" placeholder="${esc((placeholder[i] || [])[1] || '')}"></div>`).join('')}</div>`;
}
export function readCreneaux(root) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = $(`[data-ca="${i}"]`, root)?.value, b = $(`[data-cb="${i}"]`, root)?.value;
    if (a && b && hm2min(b) > hm2min(a)) out.push([a, b]);
  }
  return out;
}
export const creneauxTxt = list => (list || []).map(([a, b]) => a.replace(':', 'h') + '–' + b.replace(':', 'h')).join(' · ');

// ---------- Tournées enregistrées ----------
export const getTournee = date => (kv('tournees', {})[date]) || null;
export async function setTournee(date, t) {
  const all = { ...kv('tournees', {}) };
  if (t) all[date] = t; else delete all[date];
  // On garde 60 jours d'historique
  const lim = addDays(today(), -60);
  for (const k of Object.keys(all)) if (k < lim) delete all[k];
  await setKV('tournees', all);
}

export { zoneOf, findCommune, TYPE_NAMES, eur, dateFr, telHref };
