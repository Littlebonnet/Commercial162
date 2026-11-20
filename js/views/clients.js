// Liste des clients : recherche, filtres (zone, type, tag, prospects, en retard), tri, liste ou carte.
import { S } from '../db.js';
import { TYPE_NAMES, ZONE_NAMES, typeColor, SITUATIONS, JOURS_SEMAINE } from '../ref.js';
import { ic } from '../icons.js';
import { $, $$, esc, norm, debounce, eur, relDays, today, addDays } from '../util.js';
import { idx, retard, caOf } from '../metrics.js';
import { makeMap, destroyMap, pin, clientLine, homeIcon } from '../ui.js';
import { cfg } from '../ref.js';

const F = { q: '', statut: 'tous', zone: '', type: '', tag: '', situation: '', jour: '', tri: 'nom', vue: 'liste' };

export function render(main, ctx) {
  ctx.title('Clients');
  ctx.actions([{ icon: 'plus', label: 'Nouveau', cls: 'primary', href: '#/clients/nouveau' }]);
  const tags = [...new Set(S.clients.flatMap(c => c.tags || []))].sort((a, b) => a.localeCompare(b));
  const I = idx();
  const from12 = addDays(today(), -365);
  const ca12 = new Map();
  for (const [id, ls] of I.ventesBy) ca12.set(id, caOf(ls.filter(l => l.date > from12)));

  main.innerHTML = `<div class="wrap">
    <div class="search"><div class="search-box">${ic('search', 20)}<input type="search" placeholder="Nom, commune, contact, n° client…" value="${esc(F.q)}" data-q></div></div>
    <div class="chips">${[['tous', 'Tous'], ['clients', 'Clients'], ['prospects', 'Prospects'], ['retard', 'En retard'], ['archives', 'Archivés']].map(([k, l]) => `<button class="chip ${F.statut === k ? 'on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
    <div class="filters">
      <select data-f="zone"><option value="">Toutes les zones</option>${ZONE_NAMES.map(z => `<option ${F.zone === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>
      <select data-f="type"><option value="">Tous les types</option>${TYPE_NAMES.map(z => `<option ${F.type === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>
      <select data-f="situation"><option value="">Toutes les situations</option><option value="alerte" ${F.situation === 'alerte' ? 'selected' : ''}>À surveiller (hors RAS)</option>${SITUATIONS.map(s => `<option value="${esc(s.k)}" ${F.situation === s.k ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
      <select data-f="jour"><option value="">Tous les jours</option>${JOURS_SEMAINE.map(([n, l]) => `<option value="v${n}" ${F.jour === 'v' + n ? 'selected' : ''}>Visite le ${l.toLowerCase()}</option>`).join('')}${JOURS_SEMAINE.map(([n, l]) => `<option value="a${n}" ${F.jour === 'a' + n ? 'selected' : ''}>Télévente le ${l.toLowerCase()}</option>`).join('')}</select>
      <select data-f="tag"><option value="">Toutes les étiquettes</option>${tags.map(z => `<option ${F.tag === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>
      <select data-f="tri">${[['nom', 'Tri : nom'], ['ville', 'Tri : ville'], ['retard', 'Tri : retard de visite'], ['ca', 'Tri : CA 12 mois'], ['recent', 'Tri : dernière visite']].map(([k, l]) => `<option value="${k}" ${F.tri === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="seg">${[['liste', 'Liste', 'list'], ['carte', 'Carte', 'map']].map(([k, l, i]) => `<button class="${F.vue === k ? 'on' : ''}" data-vue="${k}"><span class="row" style="gap:6px">${ic(i, 18)}${l}</span></button>`).join('')}</div>
    </div>
    <div class="muted small" data-count style="margin:8px 4px"></div>
    <div data-out></div></div>`;

  let map = null;
  ctx.onLeave(() => destroyMap(map));
  const out = $('[data-out]', main);

  const filtered = () => {
    const n = norm(F.q);
    let rows = S.clients.filter(c => {
      if (F.statut === 'archives') { if (!c.archive) return false; }
      else if (c.archive) return false;
      if (F.statut === 'clients' && c.statut === 'prospect') return false;
      if (F.statut === 'prospects' && c.statut !== 'prospect') return false;
      if (F.statut === 'retard' && (c.statut === 'prospect' || retard(c) <= 0)) return false;
      if (F.zone && c.zone !== F.zone) return false;
      if (F.type && c.typeEtab !== F.type) return false;
      if (F.tag && !(c.tags || []).includes(F.tag)) return false;
      if (F.situation === 'alerte' && !(c.situation && c.situation !== 'RAS')) return false;
      if (F.situation && F.situation !== 'alerte' && (c.situation || 'RAS') !== F.situation) return false;
      if (F.jour && +(F.jour[0] === 'v' ? c.jourVisite : c.jourAppel) !== +F.jour.slice(1)) return false;
      if (n) {
        const hay = norm([c.nom, c.enseigne, c.ville, c.cp, c.numClient, c.siret, c.tel, c.email, (c.tags || []).join(' '), (c.contacts || []).map(k => k.nom + ' ' + (k.tel || '')).join(' ')].join(' '));
        if (!n.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    });
    const nm = c => (c.enseigne || c.nom || '');
    const sorters = {
      nom: (a, b) => nm(a).localeCompare(nm(b)),
      ville: (a, b) => (a.ville || '').localeCompare(b.ville || '') || nm(a).localeCompare(nm(b)),
      retard: (a, b) => retard(b) - retard(a),
      ca: (a, b) => (ca12.get(b.id) || 0) - (ca12.get(a.id) || 0),
      recent: (a, b) => (I.lastVisit.get(b.id) || '').localeCompare(I.lastVisit.get(a.id) || ''),
    };
    return rows.sort(sorters[F.tri]);
  };

  const draw = () => {
    const rows = filtered();
    $('[data-count]', main).textContent = `${rows.length} fiche${rows.length > 1 ? 's' : ''}`;
    if (F.vue === 'carte') {
      if (!map) {
        out.innerHTML = '<div class="card"><div class="map tall" data-map></div><div class="leg">' + TYPE_NAMES.map(t => `<span><span class="dot" style="background:${typeColor(t)}"></span>${esc(t)}</span>`).join('') + '</div></div>';
        map = makeMap($('[data-map]', out));
        map._layer = L.layerGroup().addTo(map);
        L.marker([cfg().maison.lat, cfg().maison.lng], { icon: homeIcon() }).addTo(map);
      }
      map._layer.clearLayers();
      const pts = [];
      for (const c of rows) {
        if (c.lat == null) continue;
        pts.push([c.lat, c.lng]);
        L.marker([c.lat, c.lng], { icon: pin(typeColor(c.typeEtab), '', true, c.statut === 'prospect' ? 'ring' : '') }).addTo(map._layer)
          .bindPopup(`<b>${esc(c.enseigne || c.nom)}</b><br>${esc(c.ville || '')} · ${esc(c.typeEtab || '')}<br>Vu ${relDays(I.lastVisit.get(c.id))}<br><a href="#/clients/${c.id}">Ouvrir la fiche</a>`);
      }
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.1), { maxZoom: 14 });
      return;
    }
    if (map) { destroyMap(map); map = null; }
    const LIM = 400;
    out.innerHTML = rows.length ? `<div class="card" style="padding:4px 12px"><div class="list">${rows.slice(0, LIM).map(c => clientLine(c, ca12.get(c.id) ? `<div class="small">${eur(ca12.get(c.id))}</div>` : '')).join('')}</div>
      ${rows.length > LIM ? `<div class="empty">… ${rows.length - LIM} autres : affine la recherche</div>` : ''}</div>`
      : `<div class="card empty">Aucune fiche${S.clients.length ? ' pour ces filtres' : ''}.<br><br><a class="btn primary" href="#/clients/nouveau">Créer un client</a> <a class="btn" href="#/plus/import">Importer</a></div>`;
  };

  $('[data-q]', main).oninput = debounce(e => { F.q = e.target.value; draw(); }, 150);
  $$('[data-st]', main).forEach(b => b.onclick = () => { F.statut = b.dataset.st; $$('[data-st]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $$('[data-f]', main).forEach(s => s.onchange = () => { F[s.dataset.f] = s.value; draw(); });
  $$('[data-vue]', main).forEach(b => b.onclick = () => { F.vue = b.dataset.vue; $$('[data-vue]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}
