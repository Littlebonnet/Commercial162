// Onglet Plus : prospection (kanban), rappels, catalogue, import/export, rapport hebdo, sauvegarde, réglages.
import { S, put, del, kv, setKV } from '../db.js';
import { cfg, saveCfg, ETAPES, TYPE_NAMES, ZONE_NAMES, TYPES, DEFAULT_CFG, zoneColor } from '../ref.js';
import { $, $$, esc, eur, num, pct, today, addDays, dateFr, relDays, toast, modal, confirmBox, norm, debounce, shareFile, JOURS, MOIS_LONG, iso, downloadBlob } from '../util.js';
import { idx, clientName, prospects, semaine, activite, thisMonth, shiftMonth, objectifMois } from '../metrics.js';
import { geocode } from '../route.js';
import { rappelForm, typeDot, applyTheme, creneauxEditor, readCreneaux, addressAutocomplete } from '../ui.js';
import { produitManuel } from './commandes.js';
import { rapportHebdo } from '../pdf.js';
import * as IO from '../io.js';
import { chargerDemo, effacerDemo } from '../demo.js';

const PAGES = {
  prospection: ['Prospection', '★', 'Pipeline : à contacter → gagné'],
  rappels: ['Rappels', '⏰', 'Relances datées'],
  catalogue: ['Catalogue', '▦', 'Produits, prix, nouveautés, promos'],
  import: ['Import / export', '⇅', 'Excel, CSV : clients, ventes, catalogue'],
  rapport: ['Rapport hebdo', '▤', 'PDF pour mon manager'],
  sauvegarde: ['Sauvegarde', '☁', 'Fichier JSON vers iCloud Drive'],
  reglages: ['Réglages', '⚙', 'Domicile, horaires, zones, objectifs, prime, thème, démo'],
};

export async function render(main, ctx) {
  const p = ctx.params[0];
  if (!p) return menu(main, ctx);
  const page = PAGES[p];
  if (!page) { location.replace('#/plus'); return; }
  ctx.title(page[0]);
  return ({ prospection, rappels, catalogue, import: importPage, rapport, sauvegarde, reglages })[p](main, ctx);
}

function menu(main, ctx) {
  ctx.title('Plus');
  const lastBk = kv('lastBackup');
  const dus = S.rappels.filter(r => !r.fait && r.date <= today()).length;
  main.innerHTML = `<div class="wrap">
    ${!lastBk || lastBk < addDays(today(), -7) ? `<a class="alert" href="#/plus/sauvegarde"><div class="grow"><b>Pense à sauvegarder</b><div class="small">${lastBk ? 'Dernière sauvegarde ' + relDays(lastBk) : 'Aucune sauvegarde pour l\'instant'} : un clic suffit.</div></div></a>` : ''}
    <div class="grid g3 tiles">${Object.entries(PAGES).map(([k, [t, ico, s]]) => `<a class="card tile" href="#/plus/${k}"><span class="ico">${ico}</span><div><div class="t">${t}${k === 'rappels' && dus ? ` <span class="tag red">${dus}</span>` : ''}${k === 'prospection' ? ` <span class="tag">${prospects().length}</span>` : ''}</div><div class="muted small">${s}</div></div></a>`).join('')}</div>
    <p class="muted small center" style="margin-top:24px">Tournée Alpagel · données stockées uniquement sur cet appareil · ${S.clients.length} fiches, ${S.produits.length} produits, ${S.ventes.length} lignes de ventes</p>
  </div>`;
}

// ---------- Prospection (kanban) ----------
function prospection(main, ctx) {
  ctx.actions([{ label: '+ Prospect', href: '#/clients/nouveau?prospect=1' }]);
  const all = S.clients.filter(c => !c.archive && (c.statut === 'prospect' || (c.etape === 'Gagné' && (c.etapeDate || '') >= addDays(today(), -90))));
  const a = activite(365);
  main.innerHTML = `<div class="wrap">
    <div class="grid g4" style="margin-bottom:14px">${ETAPES.map(e => `<div class="card kpi"><div class="lbl">${e}</div><div class="val">${all.filter(c => (c.etape || 'À contacter') === e).length}</div></div>`).slice(0, 4).join('')}
    </div>
    <p class="muted small">Transformation : <b>${a.transfo === null ? '—' : pct(a.transfo)}</b> (${a.won} gagnés, ${a.lost} perdus). « Gagné » fait passer la fiche en client.</p>
    <div class="kanban">${ETAPES.map((e, ie) => { const list = all.filter(c => (c.etape || 'À contacter') === e).sort((x, y) => (x.prochainContact || '9').localeCompare(y.prochainContact || '9'));
      return `<div class="col"><h3><span>${e}</span><span class="muted">${list.length}</span></h3>${list.map(c => `<div class="kcard">
        <a href="#/clients/${c.id}" class="row" style="gap:8px;color:inherit;text-decoration:none">${typeDot(c.typeEtab)}<b class="grow">${esc(c.enseigne || c.nom)}</b></a>
        <div class="muted small">${esc(c.ville || '')} · ${esc(c.typeEtab || '')}${c.prochainContact ? ` · <span class="${c.prochainContact <= today() ? 'down' : ''}">contact ${dateFr(c.prochainContact)}</span>` : ''}</div>
        <div class="row" style="margin-top:8px;gap:6px">${ie > 0 ? `<button class="btn small" data-mv="${c.id}" data-to="${ie - 1}">‹</button>` : ''}<span class="grow"></span>
        ${e !== 'Gagné' && e !== 'Perdu' ? `<button class="btn small" data-mv="${c.id}" data-to="4">Perdu</button><button class="btn small primary" data-mv="${c.id}" data-to="${ie + 1}">${ETAPES[ie + 1]} ›</button>` : ''}</div></div>`).join('') || '<div class="muted small center" style="padding:20px 0">—</div>'}</div>`; }).join('')}</div></div>`;
  $$('[data-mv]', main).forEach(b => b.onclick = async () => {
    const c = S.clients.find(x => x.id === b.dataset.mv);
    c.etape = ETAPES[+b.dataset.to]; c.etapeDate = today();
    if (c.etape === 'Gagné') { c.statut = 'client'; c.depuis = c.depuis || today(); toast('Prospect gagné : il devient client 🎉'); }
    else if (c.statut !== 'prospect') c.statut = 'prospect';
    await put('clients', c); ctx.refresh();
  });
}

// ---------- Rappels ----------
let rapF = 'avenir';
function rappels(main, ctx) {
  ctx.actions([{ label: '+ Rappel', onClick: () => rappelForm({}, ctx.refresh) }]);
  const t = today();
  const rows = S.rappels.filter(r => rapF === 'faits' ? r.fait : !r.fait).sort((a, b) => rapF === 'faits' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const group = r => r.fait ? 'Faits' : r.date < t ? 'En retard' : r.date === t ? "Aujourd'hui" : r.date <= addDays(t, 7) ? 'Cette semaine' : 'Plus tard';
  let last = '';
  main.innerHTML = `<div class="wrap narrow"><div class="chips">${[['avenir', 'À faire'], ['faits', 'Faits']].map(([k, l]) => `<button class="chip ${rapF === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="card" style="margin-top:12px">${rows.length ? rows.slice(0, 300).map(r => { const g = group(r); const h = g !== last ? `<div class="section-title" style="margin-top:12px">${g}</div>` : ''; last = g; return h + `<div class="item" data-r="${r.id}">
      <button class="check ${r.fait ? 'on' : ''}" data-done="${r.id}">✓</button>
      <div class="main"><div class="t">${esc(r.clientId ? clientName(r.clientId) : 'Rappel')}</div><div class="s">${esc(r.texte || '')}</div></div>
      <div class="end ${!r.fait && r.date < t ? 'down' : ''}">${dateFr(r.date)}</div></div>`; }).join('') : '<div class="empty">Aucun rappel</div>'}</div></div>`;
  $$('[data-f]', main).forEach(b => b.onclick = () => { rapF = b.dataset.f; ctx.refresh(); });
  $$('[data-done]', main).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = S.rappels.find(x => x.id === b.dataset.done); r.fait = !r.fait; r.faitLe = today(); await put('rappels', r); ctx.refresh(); });
  $$('[data-r]', main).forEach(el => el.onclick = () => rappelForm(S.rappels.find(x => x.id === el.dataset.r), ctx.refresh));
}

// ---------- Catalogue ----------
const catF = { q: '', fam: '', flag: '' };
function catalogue(main, ctx) {
  ctx.actions([{ label: '+ Produit', onClick: () => produitManuel(ctx.refresh) }]);
  const fams = [...new Set(S.produits.map(p => p.famille).filter(Boolean))].sort();
  main.innerHTML = `<div class="wrap">
    <div class="search"><input type="search" placeholder="Rechercher parmi ${S.produits.length} références…" value="${esc(catF.q)}" data-q></div>
    <div class="filters"><select data-fam><option value="">Toutes les familles</option>${fams.map(f => `<option ${catF.fam === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <div class="chips">${[['', 'Tous'], ['nouveaute', 'Nouveautés'], ['promo', 'Promos'], ['inactif', 'Inactifs']].map(([k, l]) => `<button class="chip ${catF.flag === k ? 'on' : ''}" data-flag="${k}">${l}</button>`).join('')}</div>
      <a class="btn small" href="#/plus/import">Importer le catalogue</a></div>
    <div class="card" style="margin-top:10px;padding:4px 12px"><div class="list" data-l></div></div></div>`;
  const draw = () => {
    const words = norm(catF.q).split(/\s+/).filter(Boolean);
    const rows = S.produits.filter(p => (!catF.fam || p.famille === catF.fam) && (!catF.flag || (catF.flag === 'inactif' ? p.actif === false : p[catF.flag]))
      && (!words.length || words.every(w => norm(p.ref + ' ' + p.designation + ' ' + (p.famille || '') + ' ' + (p.ean || '')).includes(w))))
      .sort((a, b) => (a.famille || '').localeCompare(b.famille || '') || a.designation.localeCompare(b.designation));
    $('[data-l]', main).innerHTML = rows.slice(0, 200).map(p => `<div class="item" data-ref="${esc(p.ref)}"><div class="main"><div class="t">${esc(p.designation)} ${p.nouveaute ? '<span class="tag green">nouveau</span>' : ''}${p.promo ? '<span class="tag red">promo</span>' : ''}${p.actif === false ? '<span class="tag grey">inactif</span>' : ''}</div>
      <div class="s">${esc(p.ref)} · ${esc(p.famille || '')}${p.cond ? ' · ' + esc(p.cond) : ''}</div></div><div class="end"><b>${eur(p.prix, true)}</b>${p.achat != null && p.prix ? `<div class="muted small">marge ${pct((p.prix - p.achat) / p.prix * 100)}</div>` : ''}</div></div>`).join('')
      + (rows.length > 200 ? `<div class="empty">… ${rows.length - 200} autres : affine la recherche</div>` : '') || '<div class="empty">Aucun produit. Importe ton catalogue (Excel/CSV) ou ajoute-les un par un.</div>';
  };
  $('[data-q]', main).oninput = debounce(e => { catF.q = e.target.value; draw(); }, 120);
  $('[data-fam]', main).onchange = e => { catF.fam = e.target.value; draw(); };
  $$('[data-flag]', main).forEach(b => b.onclick = () => { catF.flag = b.dataset.flag; $$('[data-flag]', main).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('[data-l]', main).onclick = e => { const it = e.target.closest('[data-ref]'); if (it) produitManuel(draw, S.produits.find(p => p.ref === it.dataset.ref)); };
  draw();
}

// ---------- Import / export ----------
function importPage(main, ctx) {
  main.innerHTML = `<div class="wrap narrow">
    <div class="card"><h2>Importer un fichier Excel ou CSV</h2>
      <p class="muted">Clients, ventes / CA ou catalogue : l'application reconnaît le type de fichier et les colonnes toute seule. Tu pourras corriger avant de valider.</p>
      <label class="btn primary block">Choisir un fichier (.xlsx, .xls, .csv)<input type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt,.ods" hidden data-file></label>
      <div data-step style="margin-top:14px"></div></div>
    <div class="card" style="margin-top:14px"><h2>Modèle et export</h2>
      <p class="muted small">Le modèle contient 3 onglets (Clients, Ventes, Catalogue) avec les colonnes reconnues. L'export complet contient toutes tes données.</p>
      <div class="btn-row"><button class="btn" data-modele>⬇ Modèle Excel</button><button class="btn" data-export>⬇ Export Excel complet</button></div></div>
    <div class="card" style="margin-top:14px"><h2>Géolocalisation</h2><p class="muted small" data-geo-txt></p><button class="btn" data-geo>Géolocaliser les fiches sans coordonnées</button></div>
  </div>`;
  const noGeo = () => S.clients.filter(c => c.lat == null && (c.adresse || c.ville));
  $('[data-geo-txt]', main).textContent = `${noGeo().length} fiche(s) sans coordonnées (elles n'apparaissent pas sur la carte ni dans les tournées).`;
  $('[data-geo]', main).onclick = async () => {
    const b = $('[data-geo]', main); b.disabled = true;
    const n = await IO.geocoderTous(noGeo(), (i, tot) => { b.textContent = `Géolocalisation ${i} / ${tot}…`; });
    toast(`${n} fiche(s) géolocalisée(s)`); ctx.refresh();
  };
  $('[data-modele]', main).onclick = () => IO.downloadModele();
  $('[data-export]', main).onclick = () => IO.exportExcel();
  $('[data-file]', main).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const step = $('[data-step]', main);
    step.innerHTML = '<div class="spinner"></div>';
    try { const book = await IO.readFile(f); mappingStep(step, book, ctx); }
    catch (err) { console.error(err); step.innerHTML = `<div class="alert red">Lecture impossible : ${esc(err.message)}</div>`; }
    e.target.value = '';
  };
}

function mappingStep(step, book, ctx) {
  let sheet = book.sheets.find(s => s.rows.length > 1) || book.sheets[0];
  let kind = IO.detectKind(sheet.headers);
  let map = IO.autoMap(kind, sheet.headers);
  const draw = () => {
    const F = IO.FIELDS[kind];
    const opts = sel => `<option value="">— ignorer —</option>${sheet.headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h || 'Colonne ' + (i + 1))}</option>`).join('')}`;
    step.innerHTML = `
      ${book.sheets.length > 1 ? `<label class="field"><span>Onglet</span><select data-sheet>${book.sheets.map((s, i) => `<option value="${i}" ${s === sheet ? 'selected' : ''}>${esc(s.name)} (${s.rows.length} lignes)</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Type de données (détecté automatiquement)</span><select data-kind>${Object.entries(IO.KINDS).map(([k, l]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="small muted">${sheet.rows.length} lignes · en-têtes ligne ${sheet.headerRow + 1}. Vérifie la correspondance des colonnes :</p>
      <div class="map-grid">${F.map(fd => `<label class="field"><span>${esc(fd.label)}${fd.req ? ' *' : ''}</span><select data-map="${fd.k}">${opts(map[fd.k])}</select></label>`).join('')}</div>
      ${kind === 'ventes' ? `<label class="chk"><input type="checkbox" data-replace checked> Remplacer les ventes déjà importées sur la période du fichier (évite les doublons)</label>
        <label class="chk"><input type="checkbox" data-create checked> Créer les clients inconnus</label>` : ''}
      ${kind === 'clients' ? '<label class="chk"><input type="checkbox" data-geocode checked> Géolocaliser les adresses (connexion nécessaire)</label>' : ''}
      <h3>Aperçu</h3><div class="scroll-x"><table class="tbl small"><thead><tr>${F.filter(fd => map[fd.k] != null).map(fd => `<th>${esc(fd.label)}</th>`).join('')}</tr></thead>
      <tbody>${sheet.rows.slice(0, 5).map(r => `<tr>${F.filter(fd => map[fd.k] != null).map(fd => `<td>${esc(r[map[fd.k]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="btn-row end" style="margin-top:14px"><button class="btn primary" data-go>Importer ${sheet.rows.length} lignes</button></div><div data-prog class="muted small" style="margin-top:8px"></div>`;
    const s = $('[data-sheet]', step); if (s) s.onchange = () => { sheet = book.sheets[+s.value]; kind = IO.detectKind(sheet.headers); map = IO.autoMap(kind, sheet.headers); draw(); };
    $('[data-kind]', step).onchange = e => { kind = e.target.value; map = IO.autoMap(kind, sheet.headers); draw(); };
    $$('[data-map]', step).forEach(x => x.onchange = () => { map[x.dataset.map] = x.value === '' ? null : +x.value; });
    $('[data-go]', step).onclick = async () => {
      const miss = IO.FIELDS[kind].filter(fd => fd.req && map[fd.k] == null && !(fd.alt && fd.alt.some(a => map[a] != null)));
      if (miss.length) { toast('Colonne obligatoire manquante : ' + miss.map(m => m.label).join(', '), 4000); return; }
      const btn = $('[data-go]', step); btn.disabled = true;
      const prog = $('[data-prog]', step);
      try {
        const r = await IO.importRows(kind, sheet.rows, map, {
          replace: $('[data-replace]', step)?.checked, create: $('[data-create]', step)?.checked, geocode: $('[data-geocode]', step)?.checked,
        }, txt => { prog.textContent = txt; });
        step.innerHTML = `<div class="alert blue"><div><b>Import terminé ✓</b><div>${esc(r)}</div></div></div>`;
      } catch (err) { console.error(err); prog.innerHTML = `<span class="down">Erreur : ${esc(err.message)}</span>`; btn.disabled = false; }
    };
  };
  draw();
}

// ---------- Rapport hebdo ----------
function rapport(main, ctx) {
  const { lundi } = semaine();
  const weeks = [0, 1, 2, 3, 4].map(i => addDays(lundi, -7 * i));
  main.innerHTML = `<div class="wrap narrow"><div class="card"><h2>Rapport hebdomadaire PDF</h2>
    <p class="muted">Visites et comptes rendus, commandes, CA et marge de la semaine, avancement de l'objectif du mois, prime, prospects, indicateurs d'activité.</p>
    <label class="field"><span>Semaine</span><select data-w>${weeks.map((w, i) => `<option value="${w}">${i === 0 ? 'Cette semaine' : i === 1 ? 'Semaine dernière' : 'Semaine du ' + dateFr(w)} (${dateFr(w)} → ${dateFr(addDays(w, 6))})</option>`).join('')}</select></label>
    <div class="btn-row"><button class="btn primary" data-share>✉ Envoyer à mon manager</button><button class="btn" data-see>Voir le PDF</button></div></div></div>`;
  const make = () => rapportHebdo($('[data-w]', main).value);
  $('[data-see]', main).onclick = () => { const u = URL.createObjectURL(make()); window.open(u, '_blank'); };
  $('[data-share]', main).onclick = () => shareFile(make(), `Rapport hebdo ${$('[data-w]', main).value}.pdf`, 'Rapport hebdomadaire');
}

// ---------- Sauvegarde ----------
function sauvegarde(main, ctx) {
  const lastBk = kv('lastBackup');
  main.innerHTML = `<div class="wrap narrow">
    <div class="card"><h2>Sauvegarder</h2>
      <p>Crée un fichier unique avec <b>toutes</b> tes données (fiches, photos, visites, commandes, ventes, catalogue, réglages).</p>
      <p class="muted small">Sur iPad : touche « Sauvegarder », puis « Enregistrer dans Fichiers » → iCloud Drive. ${lastBk ? 'Dernière sauvegarde : ' + dateFr(lastBk) + ' (' + relDays(lastBk) + ').' : 'Aucune sauvegarde pour l\'instant.'}</p>
      <button class="btn primary block" data-bk>☁ Sauvegarder maintenant</button></div>
    <div class="card" style="margin-top:14px"><h2>Restaurer</h2>
      <p class="muted small">Remplace toutes les données de cet appareil par celles d'un fichier de sauvegarde. Utile pour changer d'iPad ou passer sur l'iPhone.</p>
      <label class="btn block">Choisir un fichier de sauvegarde (.json)<input type="file" accept=".json,application/json" hidden data-rs></label></div>
    <div class="card" style="margin-top:14px"><h2>Espace utilisé</h2><p class="muted small" data-usage>…</p></div></div>`;
  $('[data-bk]', main).onclick = async () => {
    const b = $('[data-bk]', main); b.disabled = true; b.textContent = 'Préparation…';
    try { const blob = await IO.backupBlob(); await shareFile(blob, `Sauvegarde tournee ${today()}.json`, 'Sauvegarde Tournée Alpagel'); await setKV('lastBackup', today()); toast('Sauvegarde prête ✓'); }
    finally { b.disabled = false; b.textContent = '☁ Sauvegarder maintenant'; }
  };
  $('[data-rs]', main).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmBox('Remplacer TOUTES les données de cet appareil par cette sauvegarde ?', 'Restaurer', true))) return;
    try { const n = await IO.restoreFile(f); applyTheme(); toast(`Restauration terminée : ${n} fiches`); location.hash = '#/accueil'; }
    catch (err) { toast('Fichier invalide : ' + err.message, 4000); }
  };
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(es => {
    const el = $('[data-usage]', main); if (el) el.textContent = `${(es.usage / 1048576).toFixed(1)} Mo utilisés sur ${(es.quota / 1048576 / 1024).toFixed(1)} Go disponibles pour l'application.`;
  });
}

// ---------- Réglages ----------
function reglages(main, ctx) {
  const c = cfg();
  const m0 = thisMonth();
  const mois = Array.from({ length: 12 }, (_, i) => shiftMonth(m0, i - 1));
  main.innerHTML = `<div class="wrap narrow"><form data-form>
    <div class="card"><h2>Moi</h2><div class="grid g3">
      <label class="field"><span>Nom</span><input name="nom" value="${esc(c.nom)}"></label>
      <label class="field"><span>Téléphone</span><input name="telephone" type="tel" value="${esc(c.telephone)}"></label>
      <label class="field"><span>Email</span><input name="email" type="email" value="${esc(c.email)}"></label></div>
      <label class="field"><span>Adresse du domicile (départ et retour des tournées)</span><input name="maisonAdresse" value="${esc(c.maison.adresse)}" placeholder="Tape ton adresse puis choisis"></label>
      <div class="muted small" data-home>📍 ${c.maison.lat.toFixed(4)}, ${c.maison.lng.toFixed(4)}${c.maison.adresse ? '' : ' (Crolles par défaut)'}</div></div>

    <div class="card"><h2>Journée type</h2><div class="grid g4">
      <label class="field"><span>Départ</span><input type="time" name="heureDebut" value="${c.heureDebut}"></label>
      <label class="field"><span>Retour au plus tard</span><input type="time" name="heureFin" value="${c.heureFin}"></label>
      <label class="field"><span>Pause à partir de</span><input type="time" name="pauseDebut" value="${c.pause.debut}"></label>
      <label class="field"><span>Pause au plus tard à</span><input type="time" name="pauseFin" value="${c.pause.fin}"></label>
      <label class="field"><span>Durée de pause (min)</span><input type="number" name="pauseDuree" value="${c.pause.duree}" min="0" step="5"></label>
      <label class="field"><span>Visites max / jour</span><input type="number" name="maxVisites" value="${c.maxVisites}" min="1"></label>
      <label class="field"><span>Fréquence de visite par défaut (j)</span><input type="number" name="frequenceDefaut" value="${c.frequenceDefaut}" min="1"></label>
      <label class="field"><span>Vitesse moyenne hors ligne (km/h)</span><input type="number" name="vitesseKmh" value="${c.vitesseKmh}" min="10"></label></div></div>

    <div class="card"><h2>Zones par jour</h2><p class="muted small">Les clients des zones cochées sont proposés en priorité ce jour-là.</p>
      <div class="zones-days">${[1, 2, 3, 4, 5, 6].map(d => `<div class="zd"><b>${JOURS[d]}</b><div class="chips wrap-chips">${ZONE_NAMES.map(z => `<label class="chip-chk"><input type="checkbox" data-zd="${d}" value="${esc(z)}" ${(c.joursZones[d] || []).includes(z) ? 'checked' : ''}><span style="--zc:${zoneColor(z)}">${esc(z)}</span></label>`).join('')}</div></div>`).join('')}</div></div>

    <div class="card"><h2>Durée et créneaux par type d'établissement</h2><p class="muted small">Utilisés quand la fiche n'a pas ses propres valeurs. Les créneaux évitent les heures de service.</p>
      <div class="types-grid">${TYPE_NAMES.map(t => `<div class="type-row" data-type="${esc(t)}"><div class="row" style="gap:8px"><span class="dot" style="background:${TYPES[t].color}"></span><b class="grow">${esc(t)}</b><input type="number" min="5" step="5" value="${c.dureesType[t]}" data-dt style="width:90px"> <span class="muted small">min</span></div>${creneauxEditor(c.creneauxType[t])}</div>`).join('')}</div></div>

    <div class="card"><h2>Alertes</h2><div class="grid g4">
      <label class="field"><span>Pas vu depuis (j)</span><input type="number" name="alerteSansVisite" value="${c.alerteSansVisite}"></label>
      <label class="field"><span>Ne commande plus depuis (j)</span><input type="number" name="alerteSansCommande" value="${c.alerteSansCommande}"></label>
      <label class="field"><span>Baisse CA 3 mois vs N-1 (%)</span><input type="number" name="alerteBaisse" value="${c.alerteBaisse}"></label>
      <label class="field"><span>Fin de contrat dans (j)</span><input type="number" name="alerteFinContrat" value="${c.alerteFinContrat}"></label></div></div>

    <div class="card"><h2>Objectifs</h2><p class="muted small">Objectif de CA mensuel. Laissé vide : somme des objectifs des fiches clients (actuellement ${eur(objectifMois('0000-00'))}).</p>
      <div class="grid g4">${mois.map(k => `<label class="field"><span>${MOIS_LONG[+k.slice(5) - 1]} ${k.slice(0, 4)}</span><input type="number" min="0" step="500" data-obj="${k}" value="${c.objectifs[k] ?? ''}"></label>`).join('')}</div>
      <label class="field" style="max-width:280px"><span>Nouveaux clients / mois</span><input type="number" name="objectifNouveaux" value="${c.objectifNouveaux}" min="0"></label></div>

    <div class="card"><h2>Prime</h2><p class="muted small">Prime = montant du palier atteint (selon % de l'objectif du mois) + un pourcentage du CA ou de la marge.</p>
      <div class="grid g3"><label class="field"><span>Variable calculée sur</span><select name="primeBase"><option value="ca" ${c.prime.base === 'ca' ? 'selected' : ''}>le CA</option><option value="marge" ${c.prime.base === 'marge' ? 'selected' : ''}>la marge</option></select></label>
      <label class="field"><span>Taux variable (%)</span><input type="number" step="0.1" min="0" name="primeTaux" value="${c.prime.taux}"></label>
      <label class="field"><span>TVA sur les bons (%)</span><input type="number" step="0.1" name="tva" value="${c.tva}"></label></div>
      <table class="tbl"><thead><tr><th>Atteinte de l'objectif ≥ (%)</th><th>Prime du palier (€)</th><th></th></tr></thead><tbody data-paliers>${(c.prime.paliers || []).map(p => palierRow(p)).join('')}</tbody></table>
      <button type="button" class="btn small" data-add-palier style="margin-top:8px">+ Palier</button></div>

    <div class="card"><h2>Affichage</h2><div class="seg">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button type="button" class="${c.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>

    <div class="card"><h2>Données de démonstration</h2>
      <p class="muted small">≈ 60 clients dans tes communes, 80 produits, 18 mois de ventes, visites et prospects, pour essayer l'application. Elles s'effacent sans toucher à tes vraies données.</p>
      <div class="btn-row">${c.demo ? '<button type="button" class="btn danger" data-demo-off>Effacer la démo</button>' : '<button type="button" class="btn primary" data-demo-on>Charger la démo</button>'}</div></div>

    <div class="card"><h2>Zone dangereuse</h2><button type="button" class="btn ghost danger-t" data-reset>Tout effacer sur cet appareil</button></div>
    <div class="save-bar"><button class="btn primary block" type="submit">Enregistrer les réglages</button></div>
  </form></div>`;

  const form = $('[data-form]', main);
  let home = { ...c.maison };
  addressAutocomplete(form.elements.maisonAdresse, a => { home = { adresse: a.label, lat: a.lat, lng: a.lng }; form.elements.maisonAdresse.value = a.label; $('[data-home]', main).textContent = '📍 ' + a.label; });
  $('[data-add-palier]', main).onclick = () => $('[data-paliers]', main).insertAdjacentHTML('beforeend', palierRow({ seuil: '', montant: '' }));
  $('[data-paliers]', main).onclick = e => { const b = e.target.closest('[data-rm-p]'); if (b) b.closest('tr').remove(); };
  $$('[data-theme]', main).forEach(b => b.onclick = async () => { await saveCfg({ theme: b.dataset.theme }); applyTheme(); $$('[data-theme]', main).forEach(x => x.classList.toggle('on', x === b)); });
  const on = $('[data-demo-on]', main), off = $('[data-demo-off]', main);
  if (on) on.onclick = async () => { on.disabled = true; on.textContent = 'Génération…'; await chargerDemo(); toast('Démo chargée ✓'); location.hash = '#/accueil'; };
  if (off) off.onclick = async () => { if (await confirmBox('Effacer toutes les données de démonstration ?', 'Effacer', true)) { await effacerDemo(); toast('Démo effacée'); ctx.refresh(); } };
  $('[data-reset]', main).onclick = async () => {
    if (!(await confirmBox('Effacer TOUTES les données de cet appareil ? Fais une sauvegarde avant.', 'Tout effacer', true))) return;
    await IO.toutEffacer(); toast('Données effacées'); location.hash = '#/accueil';
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const g = n => form.elements[n].value;
    const n = k => +g(k);
    if (g('maisonAdresse') && g('maisonAdresse') !== c.maison.adresse && home.adresse !== g('maisonAdresse')) {
      try { const r = await geocode(g('maisonAdresse')); if (r) home = { adresse: r.label, lat: r.lat, lng: r.lng }; } catch (err) { toast('Adresse du domicile non trouvée'); }
    }
    const joursZones = {};
    for (const d of [0, 1, 2, 3, 4, 5, 6]) joursZones[d] = $$(`[data-zd="${d}"]`, form).filter(x => x.checked).map(x => x.value);
    const dureesType = {}, creneauxType = {};
    for (const row of $$('[data-type]', form)) { dureesType[row.dataset.type] = +$('[data-dt]', row).value || 30; const cr = readCreneaux(row); creneauxType[row.dataset.type] = cr.length ? cr : TYPES[row.dataset.type].creneaux; }
    const objectifs = { ...c.objectifs };
    for (const el of $$('[data-obj]', form)) { if (el.value === '') delete objectifs[el.dataset.obj]; else objectifs[el.dataset.obj] = +el.value; }
    const paliers = $$('[data-paliers] tr', form).map(tr => ({ seuil: +$('[data-ps]', tr).value, montant: +$('[data-pm]', tr).value })).filter(p => p.seuil > 0).sort((a, b) => a.seuil - b.seuil);
    await saveCfg({
      nom: g('nom').trim(), telephone: g('telephone').trim(), email: g('email').trim(), maison: home,
      heureDebut: g('heureDebut'), heureFin: g('heureFin'), pause: { debut: g('pauseDebut'), fin: g('pauseFin'), duree: n('pauseDuree') },
      maxVisites: n('maxVisites'), frequenceDefaut: n('frequenceDefaut'), vitesseKmh: n('vitesseKmh') || 45,
      joursZones, dureesType, creneauxType,
      alerteSansVisite: n('alerteSansVisite'), alerteSansCommande: n('alerteSansCommande'), alerteBaisse: n('alerteBaisse'), alerteFinContrat: n('alerteFinContrat'),
      objectifs, objectifNouveaux: n('objectifNouveaux'), tva: n('tva'),
      prime: { base: g('primeBase'), taux: n('primeTaux'), paliers },
    });
    // Les tournées non commencées sont recalculées avec les nouveaux réglages
    const tours = { ...kv('tournees', {}) };
    for (const [d, t] of Object.entries(tours)) if (d >= today()) t.optimise = t.locked;
    await setKV('tournees', tours);
    toast('Réglages enregistrés ✓');
    ctx.refresh();
  };
}
const palierRow = p => `<tr><td><input type="number" min="0" step="5" data-ps value="${p.seuil}"></td><td><input type="number" min="0" step="50" data-pm value="${p.montant}"></td><td><button type="button" class="btn small ghost" data-rm-p>✕</button></td></tr>`;
