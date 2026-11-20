// Point d'entrée : routeur par hash, thème, bouton retour, service worker.
import { loadAll } from './db.js';
import { cfg } from './ref.js';
import { $, $$, esc, toast } from './util.js';
import { applyTheme } from './ui.js';
import { ic, LOGO } from './icons.js';
import * as accueil from './views/accueil.js';
import * as tournee from './views/tournee.js';
import * as clientsV from './views/clients.js';
import * as fiche from './views/fiche.js';
import * as clientForm from './views/clientForm.js';
import * as stats from './views/stats.js';
import * as plus from './views/plus.js';

// [motif, module, onglet, profondeur]
const ROUTES = [
  [/^accueil$/, accueil, 'accueil'],
  [/^tournee(?:\/(\d{4}-\d{2}-\d{2}))?$/, tournee, 'tournee'],
  [/^clients$/, clientsV, 'clients'],
  [/^clients\/nouveau$/, clientForm, 'clients', true],
  [/^clients\/([\w-]+)\/modifier$/, clientForm, 'clients', true],
  [/^clients\/([\w-]+)$/, fiche, 'clients', true],
  [/^stats$/, stats, 'stats'],
  [/^plus(?:\/([\w-]+))?$/, plus, 'plus'],
];

const main = $('#main');
// Logo, icônes de la barre d'onglets et du bouton retour
$('#brand-slot').innerHTML = LOGO;
$('#btn-back').innerHTML = ic('back', 26);
for (const a of $$('#tabbar a')) a.insertAdjacentHTML('afterbegin', ic(a.dataset.ic, 24));
let cleanup = [];
let current = null;
const scrollMem = new Map();

export function go(hash, replace = false) {
  if (!hash.startsWith('#')) hash = '#/' + hash.replace(/^\//, '');
  if (replace) { history.replaceState(null, '', hash); route(); }
  else location.hash = hash;
}
window.goTo = go;

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'accueil';
  const [path, qs] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function runCleanup() { for (const f of cleanup) { try { f(); } catch (e) { console.warn(e); } } cleanup = []; }

async function route(keepScroll = false) {
  const { path, query } = parseHash();
  let match = null;
  for (const r of ROUTES) { const m = path.match(r[0]); if (m) { match = { r, params: m.slice(1) }; break; } }
  if (!match) { go('#/accueil', true); return; }
  if (current && !keepScroll) scrollMem.set(current, main.scrollTop);
  const prevScroll = keepScroll ? main.scrollTop : (scrollMem.get(location.hash) || 0);
  runCleanup();
  current = location.hash;
  const [, mod, tab, sub] = match.r;
  for (const a of $$('#tabbar a')) a.classList.toggle('active', a.dataset.tab === tab);
  const isSub = sub || match.params.some(Boolean);
  $('#btn-back').hidden = !isSub;
  $('#btn-back').dataset.parent = '#/' + tab;
  $('#top-actions').innerHTML = '';
  document.body.dataset.view = tab;
  const ctx = {
    params: match.params, query,
    title: t => { $('#title').textContent = t; document.title = t + ' · Tournée Alpagel'; },
    actions: (btns) => {
      const box = $('#top-actions'); box.innerHTML = '';
      for (const b of btns) {
        const el = document.createElement(b.href ? 'a' : 'button');
        el.className = 'btn small ' + (b.cls || ''); el.innerHTML = (b.icon ? ic(b.icon, 20) : '') + (b.html || esc(b.label || ''));
        if (b.href) el.href = b.href; else el.onclick = b.onClick;
        if (b.aria) el.setAttribute('aria-label', b.aria);
        box.appendChild(el);
      }
    },
    onLeave: f => cleanup.push(f),
    refresh: () => route(true),
  };
  main.classList.remove('full');
  main.innerHTML = '';
  try {
    await mod.render(main, ctx);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Oups, une erreur</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="#/accueil">Retour à l'accueil</a></div>`;
  }
  main.scrollTop = prevScroll;
}
export const refresh = () => route(true);

// Bouton retour : historique si possible, sinon la page parente
$('#btn-back').onclick = () => {
  if (history.length > 1 && sessionStorage.getItem('navCount') > 1) history.back();
  else go($('#btn-back').dataset.parent);
};
window.addEventListener('hashchange', () => {
  try { sessionStorage.setItem('navCount', (+sessionStorage.getItem('navCount') || 0) + 1); } catch (e) { }
  route();
});
// Un deuxième appui sur l'onglet actif remonte en haut / revient à la racine
for (const a of $$('#tabbar a')) a.addEventListener('click', e => {
  if (location.hash === a.getAttribute('href')) { e.preventDefault(); main.scrollTo({ top: 0, behavior: 'smooth' }); }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

async function start() {
  try { await loadAll(); }
  catch (e) { main.innerHTML = `<div class="card"><h2>Stockage indisponible</h2><p>${esc(e.message)}</p><p class="muted">En navigation privée, Safari bloque le stockage local.</p></div>`; return; }
  applyTheme();
  if (!location.hash) history.replaceState(null, '', '#/accueil');
  route();
  // En développement local, pas de cache (sauf avec ?sw=1 pour tester le hors ligne)
  const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes('sw=1');
  if (dev && navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !dev) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nouvelle version installée : elle sera active au prochain lancement.', 4000);
        });
      });
    }).catch(e => console.warn('SW', e));
  }
  window.addEventListener('online', () => toast('Connexion retrouvée'));
  window.addEventListener('offline', () => toast('Hors connexion : trajets estimés, données OK'));
}
start();
