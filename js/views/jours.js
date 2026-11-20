// Saisie rapide des jours de visite, de livraison et d'appel télévente, client par client, en un appui.
import { S, put } from '../db.js';
import { ZONE_NAMES } from '../ref.js';
import { $, $$, esc, norm, debounce, toast } from '../util.js';
import { dayPicker, dayValue, bindDayPickers, setDay, typeDot, zoneTag } from '../ui.js';
import { ic } from '../icons.js';

const F = { q: '', zone: '', manque: 'visite', tele: false };
const PAGE = 40;

export function render(main, ctx) {
  ctx.title('Jours des clients');
  main.innerHTML = `<div class="wrap narrow">
    <p class="muted" style="margin:0 2px 12px">Touche un jour pour le choisir, retouche-le pour l'effacer. Tout est enregistré immédiatement.</p>
    <div class="search"><div class="search-box">${ic('search', 20)}<input type="search" placeholder="Nom, commune, code tournée…" value="${esc(F.q)}" data-q></div></div>
    <div class="chips">${[['visite', 'Sans jour de visite'], ['livraison', 'Sans jour de livraison'], ['', 'Tous']].map(([k, l]) => `<button class="chip ${F.manque === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>
    <div class="filters">
      <select data-zone><option value="">Toutes les zones</option>${ZONE_NAMES.map(z => `<option ${F.zone === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" data-tele ${F.tele ? 'checked' : ''}> Afficher la télévente</label>
    </div>
    <div class="muted small" data-count style="margin:10px 4px"></div>
    <div class="card" style="padding:4px 16px" data-list></div>
    <button class="btn block" data-more style="margin-top:12px" hidden>Afficher plus</button>
  </div>`;

  const list = $('[data-list]', main);
  let rows = [], shown = 0;
  const filtered = () => {
    const words = norm(F.q).split(/\s+/).filter(Boolean);
    return S.clients.filter(c => !c.archive
      && (!F.zone || c.zone === F.zone)
      && (F.manque !== 'visite' || !c.jourVisite)
      && (F.manque !== 'livraison' || !dayValue(c, 'jourLivraison'))
      && (!words.length || words.every(w => norm([c.enseigne, c.nom, c.ville, c.tournee, c.numClient].join(' ')).includes(w))))
      .sort((a, b) => (a.ville || '').localeCompare(b.ville || '') || (a.enseigne || '').localeCompare(b.enseigne || ''));
  };
  const rowHtml = c => `<div class="jours-row" data-id="${c.id}">
      <div class="head">${typeDot(c.typeEtab)}<a href="#/clients/${c.id}">${esc(c.enseigne || c.nom)}</a><span class="muted small">${esc(c.ville || '')}${c.tournee ? ' · ' + esc(c.tournee) : ''}</span></div>
      <div class="jours-grid">
        <div><div class="lbl-like">Visite</div>${dayPicker('jourVisite', dayValue(c, 'jourVisite'))}</div>
        <div><div class="lbl-like">Livraison</div>${dayPicker('jourLivraison', dayValue(c, 'jourLivraison'))}</div>
        ${F.tele ? `<div><div class="lbl-like">Télévente</div>${dayPicker('jourAppel', dayValue(c, 'jourAppel'))}</div>` : ''}
      </div></div>`;
  const more = () => {
    list.insertAdjacentHTML('beforeend', rows.slice(shown, shown + PAGE).map(rowHtml).join(''));
    shown = Math.min(rows.length, shown + PAGE);
    $('[data-more]', main).hidden = shown >= rows.length;
  };
  const draw = () => {
    rows = filtered(); shown = 0;
    list.innerHTML = rows.length ? '' : `<div class="empty">${F.manque ? 'Tous les clients affichés ont déjà leur jour.' : 'Aucun client.'}</div>`;
    $('[data-count]', main).textContent = `${rows.length} client${rows.length > 1 ? 's' : ''}`;
    more();
  };

  bindDayPickers(list, async (key, n, box) => {
    const c = S.clients.find(x => x.id === box.closest('[data-id]').dataset.id);
    setDay(c, key, n); await put('clients', c);
    toast(`${c.enseigne || c.nom} : ${n ? 'enregistré' : 'effacé'}`, 1200);
  });
  $('[data-q]', main).oninput = debounce(e => { F.q = e.target.value; draw(); }, 200);
  $('[data-zone]', main).onchange = e => { F.zone = e.target.value; draw(); };
  $('[data-tele]', main).onchange = e => { F.tele = e.target.checked; draw(); };
  $$('[data-m]', main).forEach(b => b.onclick = () => { F.manque = b.dataset.m; $$('[data-m]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('[data-more]', main).onclick = more;
  draw();
}
