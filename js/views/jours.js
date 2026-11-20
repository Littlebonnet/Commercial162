// Saisie rapide des jours de visite, de livraison et d'appel télévente :
// client par client, ou par commune (le jour choisi s'applique à tous les clients de la commune).
import { S, put, bulkPut } from '../db.js';
import { ZONE_NAMES, cfg, saveCfg, jourNom } from '../ref.js';
import { $, $$, esc, norm, debounce, toast, modal } from '../util.js';
import { dayPicker, dayValue, bindDayPickers, setDay, typeDot, communeDe } from '../ui.js';
import { ic } from '../icons.js';

const F = { mode: 'client', q: '', zone: '', manque: 'visite', tele: false, liv: false };
const PAGE = 40;
const NOM = { jourVisite: 'jour de visite', jourAppel: 'jour d\'appel télévente', jourLivraison: 'jour de livraison' };

// Petite fenêtre de choix : renvoie la valeur du bouton touché, ou null si on ferme
function choisir(titre, texte, options) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title: titre, body: `<p style="margin-top:0">${texte}</p>`,
      buttons: [{ label: 'Annuler', cls: 'ghost', onClick: () => { done = true; res(null); } },
        ...options.map(o => ({ label: o.label, cls: o.cls || '', onClick: () => { done = true; res(o.v); } }))],
    });
    new MutationObserver((_, ob) => { if (!m.body.isConnected) { ob.disconnect(); if (!done) res(null); } }).observe(document.getElementById('modal-root'), { childList: true });
  });
}

export function render(main, ctx) {
  ctx.title('Jours des clients');
  main.innerHTML = `<div class="wrap narrow">
    <div class="seg" style="margin-bottom:14px">${[['client', 'Par client', 'user'], ['commune', 'Par commune', 'map']].map(([k, l, i]) => `<button class="${F.mode === k ? 'on' : ''}" data-mode="${k}"><span class="row" style="gap:6px">${ic(i, 18)}${l}</span></button>`).join('')}</div>
    <p class="muted" style="margin:0 2px 12px" data-intro></p>
    <div class="search"><div class="search-box">${ic('search', 20)}<input type="search" placeholder="${F.mode === 'commune' ? 'Commune…' : 'Nom, commune, code tournée…'}" value="${esc(F.q)}" data-q></div></div>
    ${F.mode === 'client' ? `<div class="chips">${[['visite', 'Sans jour de visite'], ['livraison', 'Sans jour de livraison'], ['', 'Tous']].map(([k, l]) => `<button class="chip ${F.manque === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>` : ''}
    <div class="filters">
      <select data-zone><option value="">Toutes les zones</option>${ZONE_NAMES.map(z => `<option ${F.zone === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>
      ${F.mode === 'client' ? `<label class="chk"><input type="checkbox" data-tele ${F.tele ? 'checked' : ''}> Afficher la télévente</label>` : `<label class="chk"><input type="checkbox" data-liv ${F.liv ? 'checked' : ''}> Afficher la livraison</label>`}
    </div>
    <div class="muted small" data-count style="margin:10px 4px"></div>
    <div class="card" style="padding:4px 16px" data-list></div>
    <button class="btn block" data-more style="margin-top:12px" hidden>Afficher plus</button>
  </div>`;
  $('[data-intro]', main).textContent = F.mode === 'commune'
    ? 'Choisis un jour pour une commune : il s\'applique à tous ses clients, et aux nouveaux clients importés ensuite. Un client peut toujours avoir un autre jour sur sa fiche.'
    : 'Touche un jour pour le choisir, retouche-le pour l\'effacer. Tout est enregistré immédiatement.';

  const list = $('[data-list]', main);
  let rows = [], shown = 0;

  // ---------- Par client ----------
  const filteredClients = () => {
    const words = norm(F.q).split(/\s+/).filter(Boolean);
    return S.clients.filter(c => !c.archive
      && (!F.zone || c.zone === F.zone)
      && (F.manque !== 'visite' || !c.jourVisite)
      && (F.manque !== 'livraison' || !dayValue(c, 'jourLivraison'))
      && (!words.length || words.every(w => norm([c.enseigne, c.nom, c.ville, c.tournee, c.numClient].join(' ')).includes(w))))
      .sort((a, b) => (a.ville || '').localeCompare(b.ville || '') || (a.enseigne || '').localeCompare(b.enseigne || ''));
  };
  const clientRow = c => `<div class="jours-row" data-id="${c.id}">
      <div class="head">${typeDot(c.typeEtab)}<a href="#/clients/${c.id}">${esc(c.enseigne || c.nom)}</a><span class="muted small">${esc(c.ville || '')}${c.tournee ? ' · ' + esc(c.tournee) : ''}</span></div>
      <div class="jours-grid">
        <div><div class="lbl-like">Visite</div>${dayPicker('jourVisite', dayValue(c, 'jourVisite'))}</div>
        <div><div class="lbl-like">Livraison</div>${dayPicker('jourLivraison', dayValue(c, 'jourLivraison'))}</div>
        ${F.tele ? `<div><div class="lbl-like">Télévente</div>${dayPicker('jourAppel', dayValue(c, 'jourAppel'))}</div>` : ''}
      </div></div>`;

  // ---------- Par commune ----------
  const communes = () => {
    const m = new Map();
    for (const c of S.clients) {
      if (c.archive || (F.zone && c.zone !== F.zone)) continue;
      const k = communeDe(c);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    const words = norm(F.q).split(/\s+/).filter(Boolean);
    return [...m.entries()].filter(([k]) => !words.length || words.every(w => norm(k).includes(w)))
      .map(([nom, cl]) => ({ nom, cl })).sort((a, b) => a.nom.localeCompare(b.nom));
  };
  // Jour commun à tous les clients de la commune (sinon null) + description de l'état
  const etat = (cl, key) => {
    const vals = cl.map(c => dayValue(c, key));
    const set = new Set(vals.filter(Boolean));
    const sans = vals.filter(v => !v).length;
    if (set.size === 1 && !sans) return { v: [...set][0], txt: 'tous les clients' };
    if (!set.size) return { v: null, txt: 'aucun client' };
    return { v: null, txt: `${cl.length - sans}/${cl.length} clients, ${set.size > 1 ? 'jours différents' : 'les autres sans jour'}` };
  };
  const communeRow = ({ nom, cl }) => {
    const keys = ['jourVisite', 'jourAppel', ...(F.liv ? ['jourLivraison'] : [])];
    const lbl = { jourVisite: 'Visite', jourAppel: 'Télévente', jourLivraison: 'Livraison' };
    return `<div class="jours-row" data-commune="${esc(nom)}">
      <div class="head"><b>${esc(nom)}</b><span class="muted small">${cl.length} client${cl.length > 1 ? 's' : ''}</span></div>
      <div class="jours-grid">${keys.map(k => { const e = etat(cl, k); return `<div><div class="lbl-like">${lbl[k]} <span class="muted" style="font-weight:500">· ${esc(e.txt)}</span></div>${dayPicker(k, e.v)}</div>`; }).join('')}</div></div>`;
  };

  const more = () => {
    const html = F.mode === 'commune' ? rows.slice(shown, shown + PAGE).map(communeRow) : rows.slice(shown, shown + PAGE).map(clientRow);
    list.insertAdjacentHTML('beforeend', html.join(''));
    shown = Math.min(rows.length, shown + PAGE);
    $('[data-more]', main).hidden = shown >= rows.length;
  };
  const draw = () => {
    rows = F.mode === 'commune' ? communes() : filteredClients(); shown = 0;
    list.innerHTML = rows.length ? '' : `<div class="empty">${F.mode === 'client' && F.manque ? 'Tous les clients affichés ont déjà leur jour.' : 'Rien à afficher.'}</div>`;
    $('[data-count]', main).textContent = F.mode === 'commune' ? `${rows.length} commune${rows.length > 1 ? 's' : ''}` : `${rows.length} client${rows.length > 1 ? 's' : ''}`;
    more();
  };
  const redrawCommune = nom => {
    const r = communes().find(x => x.nom === nom), el = list.querySelector(`[data-commune="${CSS.escape(nom)}"]`);
    if (r && el) el.outerHTML = communeRow(r);
  };

  bindDayPickers(list, async (key, n, box) => {
    if (F.mode === 'client') {
      const c = S.clients.find(x => x.id === box.closest('[data-id]').dataset.id);
      setDay(c, key, n); await put('clients', c);
      toast(`${c.enseigne || c.nom} : ${n ? 'enregistré' : 'effacé'}`, 1200);
      return;
    }
    const nom = box.closest('[data-commune]').dataset.commune;
    const cl = communes().find(x => x.nom === nom)?.cl || [];
    let cibles = cl;
    if (n) {
      const autres = cl.filter(c => dayValue(c, key) && dayValue(c, key) !== n);
      if (autres.length) {
        const r = await choisir(nom, `${autres.length} client${autres.length > 1 ? 's ont' : ' a'} déjà un autre ${NOM[key]}. Appliquer le ${jourNom(n).toLowerCase()} :`,
          [{ label: 'Seulement aux autres', v: 'sans' }, { label: `À tous (${cl.length})`, v: 'tous', cls: 'primary' }]);
        if (!r) { redrawCommune(nom); return; }
        if (r === 'sans') cibles = cl.filter(c => !dayValue(c, key) || dayValue(c, key) === n);
      }
    } else {
      const r = await choisir(nom, `Effacer le ${NOM[key]} des ${cl.length} clients de ${esc(nom)} ?`, [{ label: 'Effacer', v: 'ok', cls: 'danger' }]);
      if (!r) { redrawCommune(nom); return; }
    }
    for (const c of cibles) setDay(c, key, n);
    await bulkPut('clients', cibles);
    // Règle mémorisée pour les clients importés ou créés plus tard dans cette commune
    const regles = { ...(cfg().joursCommunes || {}) };
    regles[nom] = { ...(regles[nom] || {}), [key]: n || undefined };
    await saveCfg({ joursCommunes: JSON.parse(JSON.stringify(regles)) });
    toast(`${nom} : ${cibles.length} client${cibles.length > 1 ? 's' : ''} ${n ? 'mis à jour' : 'effacé' + (cibles.length > 1 ? 's' : '')}`);
    redrawCommune(nom);
  });

  $$('[data-mode]', main).forEach(b => b.onclick = () => { F.mode = b.dataset.mode; F.q = ''; ctx.refresh(); });
  $('[data-q]', main).oninput = debounce(e => { F.q = e.target.value; draw(); }, 200);
  $('[data-zone]', main).onchange = e => { F.zone = e.target.value; draw(); };
  const tele = $('[data-tele]', main); if (tele) tele.onchange = e => { F.tele = e.target.checked; draw(); };
  const liv = $('[data-liv]', main); if (liv) liv.onchange = e => { F.liv = e.target.checked; draw(); };
  $$('[data-m]', main).forEach(b => b.onclick = () => { F.manque = b.dataset.m; $$('[data-m]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('[data-more]', main).onclick = more;
  draw();
}
