import { ic } from './icons.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const eur = (v, dec = false) => (dec ? eur2 : eur0).format(Math.round((v || 0) * 100) / 100);
export const num = v => nf.format(v || 0);
export const pct = v => (isFinite(v) ? Math.round(v) : 0) + ' %';

// Dates au format AAAA-MM-JJ (heure locale)
export function iso(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const today = () => iso(new Date());
export function addDays(dateStr, n) { const d = parseD(dateStr); d.setDate(d.getDate() + n); return iso(d); }
export function parseD(s) { if (s instanceof Date) return new Date(s); const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
export function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
export const ym = s => String(s).slice(0, 7);
export const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const JOURS_C = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export function dateFr(s, withDay = false) {
  if (!s) return '';
  const d = parseD(s);
  return (withDay ? JOURS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
}
export function relDays(s) {
  if (!s) return 'jamais';
  const n = daysBetween(s, today());
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n === -1) return 'demain';
  return n > 0 ? `il y a ${n} j` : `dans ${-n} j`;
}
export const monthLabel = k => { const [y, m] = k.split('-').map(Number); return MOIS_LONG[m - 1] + ' ' + y; };

// Heures en minutes depuis minuit
export const hm2min = s => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const min2hm = m => { m = Math.round(m); return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`; };
export const dur = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

export function haversine(a, b) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
export function groupBy(arr, f) { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

let toastT;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}

// Fenêtre modale. buttons: [{label, cls, onClick(body) -> false pour garder ouverte}]
export function modal({ title, body, buttons = [], onOpen, wide }) {
  const root = document.getElementById('modal-root');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${wide ? 'style="max-width:1100px"' : ''}>
    <header><h2>${esc(title)}</h2><button class="btn small ghost icon-only" data-x aria-label="Fermer">${ic('close', 22)}</button></header>
    <div class="body">${body}</div>
    ${buttons.length ? '<footer></footer>' : ''}</div>`;
  const close = () => back.remove();
  back.querySelector('[data-x]').onclick = close;
  back.addEventListener('click', e => { if (e.target === back) close(); });
  const bodyEl = back.querySelector('.body');
  const foot = back.querySelector('footer');
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.textContent = b.label;
    el.onclick = async () => { const r = b.onClick ? await b.onClick(bodyEl, close) : undefined; if (r !== false) close(); };
    foot.appendChild(el);
  }
  root.appendChild(back);
  if (onOpen) onOpen(bodyEl, close);
  return { close, body: bodyEl };
}

export function confirmBox(text, okLabel = 'Confirmer', danger = false) {
  return new Promise(res => {
    modal({
      title: 'Confirmer', body: `<p>${esc(text)}</p>`,
      buttons: [{ label: 'Annuler', onClick: () => res(false) }, { label: okLabel, cls: danger ? 'danger' : 'primary', onClick: () => res(true) }],
    });
  });
}

// Lit les champs [name] d'un conteneur en objet
export function formData(root) {
  const o = {};
  for (const el of $$('[name]', root)) {
    if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : +el.value;
    else o[el.name] = el.value.trim();
  }
  return o;
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Partage natif iOS (Mail, AirDrop, Fichiers…) ou téléchargement
export async function shareFile(blob, name, text) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  downloadBlob(blob, name);
}

export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const telHref = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
