// Saisie rapide des jours de visite, de livraison et d'appel télévente :
// client par client, par commune ou par tournée (le jour choisi s'applique à tous les clients du groupe,
// et il est retenu pour les clients importés ou créés ensuite).
import { S, put, bulkPut } from '../db.js';
import { ZONE_NAMES, cfg, saveCfg, jourNom, codeTournee, livraisonsTournee, nomJour } from '../ref.js';
import { $, $$, esc, norm, debounce, toast, modal } from '../util.js';
import { dayPicker, dayValue, bindDayPickers, setDay, typeDot, communeDe } from '../ui.js';
import { ic } from '../icons.js';

const F = { mode: 'client', q: '', zone: '', manque: 'visite', tele: false, plus: false };
const PAGE = 40;
const NOM = { jourVisite: 'jour de visite', jourAppel: 'jour d\'appel télévente', jourLivraison: 'jour de livraison' };
const LBL = { jourVisite: 'Visite', jourAppel: 'Télévente', jourLivraison: 'Livraison' };
// Pour chaque mode de groupe : clé de regroupement, réglage mémorisé, jours affichés
const GROUPES = {
  commune: { cle: c => communeDe(c), regles: 'joursCommunes', jours: () => ['jourVisite', 'jourAppel', ...(F.plus ? ['jourLivraison'] : [])], plus: 'Afficher la livraison' },
  tournee: { cle: c => codeTournee(c.tournee) || null, regles: 'joursTournees', jours: () => ['jourLivraison', ...(F.plus ? ['jourVisite', 'jourAppel'] : [])], plus: 'Afficher visite et télévente' },
};

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

const INTRO = {
  client: 'Touche un jour pour le choisir, retouche-le pour l\'effacer. Tout est enregistré immédiatement.',
  commune: 'Choisis un jour pour une commune : il s\'applique à tous ses clients, et aux clients importés ou créés ensuite. Un client peut toujours avoir un autre jour sur sa fiche.',
  tournee: 'Choisis le ou les jours de livraison de chaque tournée (code GC, TP…). Chaque client est livré l\'un de ces jours, et sa visite est placée la veille (livré mercredi → visite mardi). Tu peux créer une tournée avant l\'import.',
};

export function render(main, ctx) {
  ctx.title('Jours des clients');
  const G = GROUPES[F.mode];
  main.innerHTML = `<div class="wrap narrow">
    <div class="lbl-like">Régler les jours</div>
    <div class="seg seg-full" style="margin-bottom:14px">${[['client', 'Par client', 'user'], ['commune', 'Par commune', 'map'], ['tournee', 'Par tournée', 'route']].map(([k, l, i]) => `<button class="${F.mode === k ? 'on' : ''}" data-mode="${k}"><span class="row" style="gap:6px;justify-content:center">${ic(i, 18)}<span class="seg-lbl">${l}</span></span></button>`).join('')}</div>
    <p class="muted" style="margin:0 2px 12px">${INTRO[F.mode]}</p>
    <div class="search"><div class="search-box">${ic('search', 20)}<input type="search" placeholder="${F.mode === 'client' ? 'Nom, commune, code tournée…' : F.mode === 'commune' ? 'Commune…' : 'Code tournée…'}" value="${esc(F.q)}" data-q></div></div>
    ${F.mode === 'client' ? `<div class="chips">${[['visite', 'Sans jour de visite'], ['livraison', 'Sans jour de livraison'], ['', 'Tous']].map(([k, l]) => `<button class="chip ${F.manque === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>` : ''}
    ${F.mode === 'tournee' ? `<div class="row" style="margin-top:4px"><input data-new placeholder="Nouvelle tournée : code (ex. GC)" style="max-width:260px"><button class="btn" data-add>${ic('plus', 20)}Créer</button></div>` : ''}
    <div class="filters">
      ${F.mode !== 'tournee' ? `<select data-zone><option value="">Toutes les zones</option>${ZONE_NAMES.map(z => `<option ${F.zone === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>` : ''}
      ${F.mode === 'client' ? `<label class="chk"><input type="checkbox" data-tele ${F.tele ? 'checked' : ''}> Afficher la télévente</label>` : `<label class="chk"><input type="checkbox" data-plus ${F.plus ? 'checked' : ''}> ${G.plus}</label>`}
    </div>
    <div class="muted small" data-count style="margin:10px 4px"></div>
    <div class="card" style="padding:4px 16px" data-list></div>
    <button class="btn block" data-more style="margin-top:12px" hidden>Afficher plus</button>
  </div>`;

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
        <div><div class="lbl-like">Visite${c.visiteAuto && c.jourVisite ? ' <span class="muted" style="font-weight:500">· veille de la livraison</span>' : ''}</div>${dayPicker('jourVisite', dayValue(c, 'jourVisite'))}</div>
        <div><div class="lbl-like">Livraison</div>${dayPicker('jourLivraison', dayValue(c, 'jourLivraison'))}</div>
        ${F.tele ? `<div><div class="lbl-like">Télévente</div>${dayPicker('jourAppel', dayValue(c, 'jourAppel'))}</div>` : ''}
      </div></div>`;

  // ---------- Par commune / par tournée ----------
  const groupes = () => {
    const m = new Map();
    for (const c of S.clients) {
      if (c.archive || (F.mode !== 'tournee' && F.zone && c.zone !== F.zone)) continue;
      const k = G.cle(c); if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    // Tournées créées ou importées sans client pour l'instant
    for (const k of Object.keys(cfg()[G.regles] || {})) if (!m.has(k) && F.mode === 'tournee') m.set(k, []);
    const words = norm(F.q).split(/\s+/).filter(Boolean);
    const regles = cfg()[G.regles] || {};
    return [...m.entries()].filter(([k]) => !words.length || words.every(w => norm(k + ' ' + (regles[k]?.libelle || '')).includes(w)))
      .map(([nom, cl]) => ({ nom, cl })).sort((a, b) => a.nom.localeCompare(b.nom));
  };
  // Jour commun à tous les clients du groupe (sinon null) + description de l'état
  const etat = (nom, cl, key) => {
    if (!cl.length) { const v = (cfg()[G.regles] || {})[nom]?.[key] || null; return { v, txt: v ? 'retenu pour les futurs clients' : 'pas encore de client' }; }
    const vals = cl.map(c => dayValue(c, key));
    const set = new Set(vals.filter(Boolean));
    const sans = vals.filter(v => !v).length;
    if (set.size === 1 && !sans) return { v: [...set][0], txt: 'tous les clients' };
    if (!set.size) return { v: null, txt: 'aucun client' };
    return { v: null, txt: `${cl.length - sans}/${cl.length} clients, ${set.size > 1 ? 'jours différents' : 'les autres sans jour'}` };
  };
  const etatTournee = (nom, cl) => {
    const jours = livraisonsTournee((cfg().joursTournees || {})[nom]);
    const par = new Map(); let sans = 0, autre = 0;
    for (const c of cl) { const d = dayValue(c, 'jourLivraison'); if (!d) sans++; else if (!jours.includes(d)) autre++; else par.set(d, (par.get(d) || 0) + 1); }
    const morceaux = [];
    if (!jours.length) morceaux.push('aucun jour choisi');
    else if (!cl.length) morceaux.push('retenu pour les futurs clients');
    else if (jours.length > 1) morceaux.push(...jours.filter(d => par.get(d)).map(d => `${par.get(d)} le ${nomJour(d)}`));
    else if (par.get(jours[0])) morceaux.push(`${par.get(jours[0])} client${par.get(jours[0]) > 1 ? 's' : ''} le ${nomJour(jours[0])}`);
    if (sans && jours.length) morceaux.push(`<b>${sans} à répartir</b>`);
    if (autre) morceaux.push(`${autre} livré${autre > 1 ? 's' : ''} un autre jour`);
    return { jours, txt: morceaux.join(' · '), aRepartir: jours.length > 1 ? sans : 0 };
  };
  const groupRow = ({ nom, cl }) => {
    const lib = F.mode === 'tournee' ? (cfg().joursTournees || {})[nom]?.libelle : '';
    return `<div class="jours-row" data-groupe="${esc(nom)}">
      <div class="head"><b>${esc(nom)}</b>${lib ? `<span>${esc(lib)}</span>` : ''}<span class="muted small">${cl.length} client${cl.length > 1 ? 's' : ''}</span>${F.mode === 'tournee' && !cl.length ? `<button class="btn small ghost icon-only" data-del="${esc(nom)}" aria-label="Supprimer la tournée ${esc(nom)}" style="margin-left:auto">${ic('trash', 18)}</button>` : ''}</div>
      <div class="jours-grid">${G.jours().map(k => {
        if (F.mode === 'tournee' && k === 'jourLivraison') {
          const t = etatTournee(nom, cl);
          return `<div style="grid-column:1/-1"><div class="lbl-like">Livraison <span class="muted" style="font-weight:500">· ${t.txt}</span></div>${dayPicker(k, t.jours, true)}
            ${t.aRepartir ? `<button class="btn small" data-repartir="${esc(nom)}" style="margin-top:8px">${ic('calendar', 18)}Choisir le jour de ${t.aRepartir} client${t.aRepartir > 1 ? 's' : ''}</button>` : ''}</div>`;
        }
        const e = etat(nom, cl, k); return `<div><div class="lbl-like">${LBL[k]} <span class="muted" style="font-weight:500">· ${esc(e.txt)}</span></div>${dayPicker(k, e.v)}</div>`;
      }).join('')}</div></div>`;
  };

  const more = () => {
    const html = F.mode === 'client' ? rows.slice(shown, shown + PAGE).map(clientRow) : rows.slice(shown, shown + PAGE).map(groupRow);
    list.insertAdjacentHTML('beforeend', html.join(''));
    shown = Math.min(rows.length, shown + PAGE);
    $('[data-more]', main).hidden = shown >= rows.length;
  };
  const draw = () => {
    rows = F.mode === 'client' ? filteredClients() : groupes(); shown = 0;
    list.innerHTML = rows.length ? '' : `<div class="empty">${F.mode === 'client' && F.manque ? 'Tous les clients affichés ont déjà leur jour.' : F.mode === 'tournee' ? 'Aucune tournée : importe tes clients avec leur code tournée, ou crée une tournée ci-dessus.' : 'Rien à afficher.'}</div>`;
    const unite = F.mode === 'client' ? 'client' : F.mode === 'commune' ? 'commune' : 'tournée';
    $('[data-count]', main).textContent = `${rows.length} ${unite}${rows.length > 1 ? 's' : ''}`;
    more();
  };
  const redrawGroupe = nom => {
    const r = groupes().find(x => x.nom === nom), el = list.querySelector(`[data-groupe="${CSS.escape(nom)}"]`);
    if (r && el) el.outerHTML = groupRow(r);
  };
  const memoriser = async (nom, key, n) => {
    const regles = { ...(cfg()[G.regles] || {}) };
    regles[nom] = { ...(regles[nom] || {}), [key]: n || undefined };
    await saveCfg({ [G.regles]: JSON.parse(JSON.stringify(regles)) });
  };

  bindDayPickers(list, async (key, n, box) => {
    if (F.mode === 'client') {
      const c = S.clients.find(x => x.id === box.closest('[data-id]').dataset.id);
      setDay(c, key, n); await put('clients', c);
      toast(`${c.enseigne || c.nom} : ${n ? 'enregistré' : 'effacé'}${key === 'jourLivraison' && c.visiteAuto ? ' · visite la veille' : ''}`, 1600);
      if (key === 'jourLivraison') { const el = box.closest('[data-id]'); el.outerHTML = clientRow(c); }
      return;
    }
    const nom = box.closest('[data-groupe]').dataset.groupe;
    const cl = groupes().find(x => x.nom === nom)?.cl || [];
    if (box.dataset.multi) { // jours de livraison d'une tournée
      const jours = n.slice().sort();
      const regles = { ...(cfg().joursTournees || {}) };
      const r = { ...(regles[nom] || {}) }; delete r.jourLivraison;
      r.livraisons = jours.length ? jours : undefined; regles[nom] = r;
      await saveCfg({ joursTournees: JSON.parse(JSON.stringify(regles)) });
      let cibles = [];
      if (jours.length === 1 && cl.length) {
        cibles = cl.filter(c => !dayValue(c, 'jourLivraison'));
        const autres = cl.filter(c => dayValue(c, 'jourLivraison') && dayValue(c, 'jourLivraison') !== jours[0]);
        if (autres.length) {
          const rep = await choisir(nom, `${autres.length} client${autres.length > 1 ? 's sont livrés' : ' est livré'} un autre jour. Les passer aussi au ${nomJour(jours[0])} ?`,
            [{ label: 'Non, les laisser', v: 'non' }, { label: 'Oui, tous', v: 'oui', cls: 'primary' }]);
          if (rep === 'oui') cibles = cibles.concat(autres);
        }
        for (const c of cibles) setDay(c, 'jourLivraison', jours[0]); // la visite passe à la veille
        if (cibles.length) await bulkPut('clients', cibles);
      }
      toast(!jours.length ? `${nom} : jours effacés` : cibles.length ? `${nom} : ${cibles.length} client${cibles.length > 1 ? 's' : ''} livré${cibles.length > 1 ? 's' : ''} le ${nomJour(jours[0])}, visite la veille`
        : jours.length > 1 ? `${nom} : livrée ${jours.map(nomJour).join(' et ')}` : `${nom} : livrée le ${nomJour(jours[0])}`, 2600);
      redrawGroupe(nom);
      return;
    }
    let cibles = cl;
    if (n && cl.length) {
      const autres = cl.filter(c => dayValue(c, key) && dayValue(c, key) !== n);
      if (autres.length) {
        const r = await choisir(nom, `${autres.length} client${autres.length > 1 ? 's ont' : ' a'} déjà un autre ${NOM[key]}. Appliquer le ${jourNom(n).toLowerCase()} :`,
          [{ label: 'Seulement aux autres', v: 'sans' }, { label: `À tous (${cl.length})`, v: 'tous', cls: 'primary' }]);
        if (!r) { redrawGroupe(nom); return; }
        if (r === 'sans') cibles = cl.filter(c => !dayValue(c, key) || dayValue(c, key) === n);
      }
    } else if (!n && cl.length) {
      const r = await choisir(nom, `Effacer le ${NOM[key]} des ${cl.length} clients de ${esc(nom)} ?`, [{ label: 'Effacer', v: 'ok', cls: 'danger' }]);
      if (!r) { redrawGroupe(nom); return; }
    }
    for (const c of cibles) setDay(c, key, n);
    if (cibles.length) await bulkPut('clients', cibles);
    await memoriser(nom, key, n);
    toast(cl.length ? `${nom} : ${cibles.length} client${cibles.length > 1 ? 's' : ''} ${n ? 'mis à jour' : 'modifié' + (cibles.length > 1 ? 's' : '')}` : `${nom} : jour retenu pour les futurs clients`);
    redrawGroupe(nom);
  });

  $$('[data-mode]', main).forEach(b => b.onclick = () => { F.mode = b.dataset.mode; F.q = ''; F.plus = false; ctx.refresh(); });
  $('[data-q]', main).oninput = debounce(e => { F.q = e.target.value; draw(); }, 200);
  const zone = $('[data-zone]', main); if (zone) zone.onchange = e => { F.zone = e.target.value; draw(); };
  const tele = $('[data-tele]', main); if (tele) tele.onchange = e => { F.tele = e.target.checked; draw(); };
  const plus = $('[data-plus]', main); if (plus) plus.onchange = e => { F.plus = e.target.checked; draw(); };
  const add = $('[data-add]', main);
  if (add) add.onclick = async () => {
    const code = codeTournee($('[data-new]', main).value);
    if (!code) { toast('Indique le code de la tournée'); return; }
    const regles = { ...(cfg().joursTournees || {}) };
    if (!regles[code]) { regles[code] = {}; await saveCfg({ joursTournees: regles }); }
    $('[data-new]', main).value = ''; F.q = ''; $('[data-q]', main).value = '';
    draw();
    list.querySelector(`[data-groupe="${CSS.escape(code)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Tournée ${code} créée : choisis son jour de livraison`);
  };
  list.addEventListener('click', async e => {
    const rp = e.target.closest('[data-repartir]');
    if (rp) { F.mode = 'client'; F.q = rp.dataset.repartir; F.manque = 'livraison'; F.zone = ''; ctx.refresh(); return; }
    const b = e.target.closest('[data-del]'); if (!b) return;
    const code = b.dataset.del;
    if (!(await choisir(code, `Supprimer la tournée ${esc(code)} et ses jours retenus ?`, [{ label: 'Supprimer', v: 'ok', cls: 'danger' }]))) return;
    const regles = { ...(cfg().joursTournees || {}) }; delete regles[code];
    await saveCfg({ joursTournees: regles }); toast(`Tournée ${code} supprimée`); draw();
  });
  $$('[data-m]', main).forEach(b => b.onclick = () => { F.manque = b.dataset.m; $$('[data-m]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('[data-more]', main).onclick = more;
  draw();
}
