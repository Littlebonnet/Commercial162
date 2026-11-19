// Fiche client complète.
import { S, put, del, getFiles, getFile, bulkDel } from '../db.js';
import { cfg, zoneColor, ETAPES } from '../ref.js';
import { $, $$, esc, uid, eur, num, pct, today, addDays, dateFr, relDays, modal, toast, confirmBox, JOURS, telHref, sum, MOIS, ym, iso } from '../util.js';
import { idx, client, caOf, margeOf, topProduits, suggestions, produitsArretes, evolutionClient, prochaineVisite, retard, freqOf, monthRange, thisMonth, ventesEntre } from '../metrics.js';
import { dureeVisite, creneaux, wazeUrl, plansUrl, gmapsUrl } from '../route.js';
import { makeMap, destroyMap, pin, chart, fmtK, visiteRapide, rappelForm, compressImage, typeDot, retardTag, resIcon, getTournee, setTournee, creneauxTxt } from '../ui.js';
import { typeColor } from '../ref.js';

export async function render(main, ctx) {
  const c = client(ctx.params[0]);
  if (!c) { main.innerHTML = '<div class="card empty">Client introuvable. <a href="#/clients">Retour à la liste</a></div>'; return; }
  ctx.title(c.enseigne || c.nom);
  ctx.actions([{ label: 'Modifier', href: `#/clients/${c.id}/modifier` }]);
  const I = idx();
  const conf = cfg();
  const t = today();
  const lines = I.ventesBy.get(c.id) || [];
  const ca12 = caOf(lines.filter(l => l.date > addDays(t, -365)));
  const ca12n1 = caOf(lines.filter(l => l.date <= addDays(t, -365) && l.date > addDays(t, -730)));
  const mg12 = margeOf(lines.filter(l => l.date > addDays(t, -365)));
  const ev = evolutionClient(c.id);
  const [mFrom, mTo] = monthRange(thisMonth());
  const caMois = caOf(lines.filter(l => l.date >= mFrom && l.date <= mTo));
  const lv = I.lastVisit.get(c.id), lo = I.lastOrder.get(c.id);
  const nv = prochaineVisite(c);
  const top = topProduits({ clientId: c.id, limit: 20 });
  const arr = produitsArretes(c.id);
  const sug = suggestions(c.id);
  const visites = S.visites.filter(v => v.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const cmds = S.commandes.filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const rappels = S.rappels.filter(r => r.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date));
  const tel = c.tel || (c.contacts || []).find(k => k.tel)?.tel;
  const email = c.email || (c.contacts || []).find(k => k.email)?.email;
  const isProspect = c.statut === 'prospect';
  const tourT = getTournee(t);
  const inTour = tourT && tourT.order.includes(c.id);
  const ferm = (c.fermeture || []).map(d => JOURS[d]).join(', ');

  main.innerHTML = `<div class="wrap">
  <div class="card fiche-head">
    <div class="row wrap-r" style="align-items:flex-start">
      <div class="grow">
        <div class="row" style="gap:8px">${typeDot(c.typeEtab)}<span class="muted">${esc(c.typeEtab || '')}</span>
          <span class="tag" style="background:${zoneColor(c.zone)};color:#fff">${esc(c.zone || '')}</span>${retardTag(c)}${c.archive ? '<span class="tag grey">archivé</span>' : ''}</div>
        <h2 class="fiche-title">${esc(c.enseigne || c.nom)}</h2>
        ${c.enseigne && c.nom && c.nom !== c.enseigne ? `<div class="muted">${esc(c.nom)}</div>` : ''}
        <div>${esc(c.adresse || '')}${c.adresse ? ', ' : ''}${c.adresse2 ? esc(c.adresse2) + ', ' : ''}${esc(c.cp || '')} ${esc(c.ville || '')}</div>
        <div class="tags-line">${(c.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
      </div>
      ${isProspect ? `<div class="etape-box"><div class="muted small">Prospection</div><select data-etape>${ETAPES.map(e => `<option ${c.etape === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="btn-row big-actions">
      ${tel ? `<a class="btn" href="${telHref(tel)}">☎ Appeler</a>` : ''}
      ${c.lat != null ? `<a class="btn waze" href="${wazeUrl(c)}" target="_blank" rel="noopener">Waze</a><a class="btn" href="${plansUrl(c)}" target="_blank" rel="noopener">Plans</a>` : ''}
      ${email ? `<a class="btn" href="mailto:${esc(email)}">✉ Email</a>` : ''}
      <button class="btn primary" data-visite>✓ Visite faite</button>
      <a class="btn primary" href="#/commandes/nouvelle?client=${c.id}">🛒 Commande</a>
      <button class="btn" data-rappel>⏰ Rappel</button>
      <button class="btn" data-tour>${inTour ? '✓ Dans la tournée' : '➤ Ajouter à la tournée du jour'}</button>
    </div>
  </div>

  <div class="grid g4" style="margin-top:14px">
    <div class="card kpi"><div class="lbl">CA 12 mois</div><div class="val">${eur(ca12)}</div><div class="sub">N-1 : ${eur(ca12n1)} ${ca12n1 ? `<span class="${ca12 >= ca12n1 ? 'up' : 'down'}">${ca12 >= ca12n1 ? '▲' : '▼'} ${pct(Math.abs((ca12 - ca12n1) / ca12n1 * 100))}</span>` : ''}</div></div>
    <div class="card kpi"><div class="lbl">Marge 12 mois</div><div class="val">${eur(mg12)}</div><div class="sub">${ca12 ? pct(mg12 / ca12 * 100) + ' du CA' : '—'}</div></div>
    <div class="card kpi"><div class="lbl">Ce mois</div><div class="val">${eur(caMois)}</div><div class="sub">${c.objectifMensuel ? `objectif ${eur(c.objectifMensuel)} · ${pct(caMois / c.objectifMensuel * 100)}` : 'pas d\'objectif'}</div>
      ${c.objectifMensuel ? `<div class="progress ${caMois >= c.objectifMensuel ? 'ok' : ''}"><div style="width:${Math.min(100, caMois / c.objectifMensuel * 100)}%"></div></div>` : ''}</div>
    <div class="card kpi"><div class="lbl">Visites</div><div class="val">${lv ? relDays(lv) : 'jamais'}</div><div class="sub">tous les ${freqOf(c)} j · prochaine ${nv ? dateFr(nv) : 'à planifier'}<br>dernière commande ${lo ? relDays(lo) : '—'}</div></div>
  </div>

  <div class="split" style="margin-top:14px">
    <div class="col-stack">
      <div class="card">
        <h2>Informations</h2>
        <dl class="dl">
          ${row('Téléphone', c.tel ? `<a href="${telHref(c.tel)}">${esc(c.tel)}</a>` : '')}
          ${row('Email', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '')}
          ${row('N° client', esc(c.numClient || ''))}
          ${row('Code tournée', esc(c.tournee || ''))}
          ${row('SIRET', esc(c.siret || ''))}
          ${row('Livraison', esc(c.jourLivraison || ''))}
          ${row('Créneaux de visite', esc(creneauxTxt(creneaux(c).map(([a, b]) => [mm(a), mm(b)]))) + (c.creneaux && c.creneaux.length ? '' : ' <span class="muted small">(défaut du type)</span>'))}
          ${row('Durée de visite', dureeVisite(c) + ' min')}
          ${row('Fermé le', esc(ferm))}
          ${row('Fermé en', esc((c.moisFermes || []).map(m => MOIS[m - 1]).join(', ')))}
          ${row('Fin de contrat', c.finContrat ? dateFr(c.finContrat) + ' (' + relDays(c.finContrat) + ')' : '')}
          ${row('Client depuis', c.depuis ? dateFr(c.depuis) : '')}
          ${isProspect ? row('Prochain contact', c.prochainContact ? dateFr(c.prochainContact) : '') : ''}
        </dl>
        ${c.notes ? `<div class="notes">${esc(c.notes).replace(/\n/g, '<br>')}</div>` : ''}
      </div>

      <div class="card">
        <h2>Contacts <span class="right"><button class="btn small" data-add-contact>+ Contact</button></span></h2>
        ${(c.contacts || []).length ? `<div class="list">${c.contacts.map((k, i) => `<div class="item">
          <div class="main" data-edit-contact="${i}"><div class="t">${esc(k.nom || '')} ${k.role ? `<span class="muted small">· ${esc(k.role)}</span>` : ''}</div><div class="s">${esc([k.tel, k.email].filter(Boolean).join(' · '))}</div></div>
          ${k.tel ? `<a class="btn small" href="${telHref(k.tel)}">☎</a>` : ''}${k.email ? `<a class="btn small" href="mailto:${esc(k.email)}">✉</a>` : ''}</div>`).join('')}</div>` : '<div class="empty">Aucun contact</div>'}
      </div>

      <div class="card">
        <h2>Matériel prêté <span class="right"><button class="btn small" data-add-mat>+ Matériel</button></span></h2>
        ${(c.materiel || []).length ? `<table class="tbl"><thead><tr><th>Matériel</th><th>N° de série</th><th>Depuis</th></tr></thead><tbody>${c.materiel.map((m, i) => `<tr data-edit-mat="${i}" class="clickable"><td>${esc(m.designation || '')}${m.note ? `<div class="muted small">${esc(m.note)}</div>` : ''}</td><td><code>${esc(m.serie || '')}</code></td><td>${m.date ? dateFr(m.date) : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Aucun matériel prêté</div>'}
      </div>

      <div class="card">
        <h2>Photos & documents <span class="right"><label class="btn small">+ Ajouter<input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" multiple hidden data-file></label></span></h2>
        <div class="thumbs" data-thumbs><div class="muted small">Chargement…</div></div>
      </div>

      <div class="card">
        <h2>Rappels <span class="right"><button class="btn small" data-rappel2>+ Rappel</button></span></h2>
        ${rappels.length ? `<div class="list">${rappels.map(r => `<div class="item" data-rap="${r.id}"><span class="tag ${r.fait ? 'green' : r.date <= t ? 'red' : ''}">${r.fait ? 'fait' : dateFr(r.date)}</span><div class="main"><div class="t" style="font-weight:500">${esc(r.texte || '')}</div></div></div>`).join('')}</div>` : '<div class="empty">Aucun rappel</div>'}
      </div>

      ${c.lat != null ? `<div class="card"><h2>Localisation</h2><div class="map" style="height:260px" data-map></div><div class="btn-row" style="margin-top:10px"><a class="btn small" href="${gmapsUrl(c)}" target="_blank" rel="noopener">Google Maps</a></div></div>` : '<div class="card"><h2>Localisation</h2><p class="muted">Adresse non géolocalisée : <a href="#/clients/' + c.id + '/modifier">compléter l\'adresse</a> pour l\'inclure dans les tournées.</p></div>'}
    </div>

    <div class="col-stack">
      <div class="card"><h2>CA mensuel · N vs N-1</h2><div class="chart-box"><canvas data-chart></canvas></div></div>

      <div class="card">
        <h2>Top 20 produits <span class="right muted small">quantités · 12 mois</span></h2>
        ${top.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>Produit</th><th class="n">Qté</th><th class="n">CA</th><th class="n">Dernier</th></tr></thead><tbody>
        ${top.map((p, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(p.designation || p.ref)}<div class="muted small">${esc(p.ref)}</div></td><td class="n"><b>${num(p.qte)}</b></td><td class="n">${eur(p.ht)}</td><td class="n small">${dateFr(p.last)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Pas encore d\'historique de ventes</div>'}
      </div>

      ${arr.length ? `<div class="card"><h2>⚠ Produits arrêtés <span class="right muted small">pris avant, plus depuis 2 mois</span></h2><div class="list">${arr.slice(0, 10).map(p => `<div class="item"><div class="main"><div class="t">${esc(p.designation || p.ref)}</div><div class="s">${esc(p.ref)} · ${p.avant} commandes avant · dernier ${dateFr(p.last)}</div></div></div>`).join('')}</div></div>` : ''}

      ${sug.length ? `<div class="card"><h2>💡 Pris par les ${esc(c.typeEtab)}s similaires</h2><div class="list">${sug.map(p => `<div class="item"><div class="main"><div class="t">${esc(p.designation)}</div><div class="s">${esc(p.ref)}</div></div><div class="end"><span class="tag green">${Math.round(p.taux)} %</span></div></div>`).join('')}</div></div>` : ''}

      <div class="card">
        <h2>Historique <span class="right muted small">${visites.length} visites · ${cmds.length} commandes</span></h2>
        <div class="timeline">${[...visites.map(v => ({ d: v.date, h: `<b>${resIcon(v.resultat)} ${esc(v.resultat || 'Visite')}</b>${v.note ? `<div class="small">${esc(v.note)}</div>` : ''}`, id: v.id, k: 'v' })),
          ...cmds.map(x => ({ d: x.date, h: `<a href="#/commandes/${x.id}"><b>🛒 Commande ${eur(x.totalHT)}</b></a> <span class="tag ${x.statut === 'brouillon' ? 'amber' : 'green'}">${esc(x.statut)}</span><div class="small muted">${x.lignes.length} lignes</div>` }))]
          .sort((a, b) => b.d.localeCompare(a.d)).slice(0, 40).map(e => `<div class="tl" ${e.k === 'v' ? `data-v="${e.id}"` : ''}><div class="when">${dateFr(e.d)}</div><div class="grow">${e.h}</div></div>`).join('') || '<div class="empty">Aucun historique</div>'}</div>
      </div>

      <div class="card"><div class="btn-row">
        <button class="btn" data-archive>${c.archive ? 'Désarchiver' : 'Archiver'}</button>
        <button class="btn ghost danger-t" data-delete>Supprimer la fiche</button></div></div>
    </div>
  </div></div>`;

  // Graphique 24 mois
  const months = []; const k0 = ym(t);
  for (let i = 11; i >= 0; i--) { const d = new Date(+k0.slice(0, 4), +k0.slice(5, 7) - 1 - i, 1); months.push(ym(iso(d))); }
  const byM = new Map(); for (const l of lines) { const k = l.date.slice(0, 7); byM.set(k, (byM.get(k) || 0) + (l.ht || 0)); }
  const prevK = k => `${+k.slice(0, 4) - 1}${k.slice(4)}`;
  const ch = chart($('[data-chart]', main), {
    type: 'bar',
    data: { labels: months.map(k => MOIS[+k.slice(5) - 1]), datasets: [
      { label: 'N', data: months.map(k => byM.get(k) || 0), backgroundColor: '#1B6DB5', borderRadius: 4 },
      { label: 'N-1', data: months.map(k => byM.get(prevK(k)) || 0), backgroundColor: 'rgba(147,164,178,.55)', borderRadius: 4 },
    ] },
    options: { scales: { y: { ticks: { callback: fmtK } } }, plugins: { tooltip: { callbacks: { label: x => x.dataset.label + ' : ' + eur(x.raw) } } } },
  });
  ctx.onLeave(() => ch.destroy());

  if (c.lat != null) {
    const map = makeMap($('[data-map]', main), { center: [c.lat, c.lng], zoom: 14 });
    L.marker([c.lat, c.lng], { icon: pin(typeColor(c.typeEtab)) }).addTo(map);
    ctx.onLeave(() => destroyMap(map));
  }

  // Fichiers
  const drawFiles = async () => {
    const files = (await getFiles(c.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const box = $('[data-thumbs]', main); if (!box) return;
    const urls = [];
    box.innerHTML = files.length ? '' : '<div class="muted small">Aucun fichier. Ajoute des photos (vitrine, matériel, carte des menus…) ou des documents (contrat, devis).</div>';
    for (const f of files) {
      const el = document.createElement('div'); el.className = 'th';
      if (f.type && f.type.startsWith('image/') && f.blob) { const u = URL.createObjectURL(f.blob); urls.push(u); el.innerHTML = `<img src="${u}" alt="">`; }
      else el.innerHTML = `<div>📄<br>${esc(f.nom)}</div>`;
      el.onclick = () => openFile(f, drawFiles);
      box.appendChild(el);
    }
    ctx.onLeave(() => urls.forEach(u => URL.revokeObjectURL(u)));
  };
  drawFiles();
  $('[data-file]', main).onchange = async e => {
    for (const f of e.target.files) {
      const blob = await compressImage(f);
      await put('fichiers', { id: uid(), clientId: c.id, nom: f.name, type: blob.type || f.type, blob, date: today(), taille: blob.size });
    }
    toast('Fichier(s) ajouté(s)'); drawFiles();
  };

  // Actions
  const sel = $('[data-etape]', main);
  if (sel) sel.onchange = async () => {
    c.etape = sel.value; c.etapeDate = today();
    if (c.etape === 'Gagné') { c.statut = 'client'; c.depuis = c.depuis || today(); toast('Bravo : prospect transformé en client 🎉'); }
    await put('clients', c); ctx.refresh();
  };
  $('[data-visite]', main).onclick = () => visiteRapide(c.id, { onSaved: ctx.refresh });
  $('[data-rappel]', main).onclick = () => rappelForm({ clientId: c.id }, ctx.refresh);
  $('[data-rappel2]', main).onclick = () => rappelForm({ clientId: c.id }, ctx.refresh);
  $$('[data-rap]', main).forEach(el => el.onclick = () => rappelForm(S.rappels.find(r => r.id === el.dataset.rap), ctx.refresh));
  $$('[data-v]', main).forEach(el => el.onclick = () => { const v = S.visites.find(x => x.id === el.dataset.v); visiteRapide(c.id, { date: v.date, onSaved: ctx.refresh }); });
  $('[data-tour]', main).onclick = async () => {
    if (c.lat == null) { toast('Adresse à compléter pour la tournée'); return; }
    const tr = getTournee(t) || { order: [], locked: false };
    if (!tr.order.includes(c.id)) { tr.order.push(c.id); tr.locked = false; tr.optimise = false; await setTournee(t, tr); toast('Ajouté à la tournée du jour'); ctx.refresh(); }
    else location.hash = '#/tournee';
  };
  $('[data-add-contact]', main).onclick = () => contactForm(c, null, ctx.refresh);
  $$('[data-edit-contact]', main).forEach(el => el.onclick = () => contactForm(c, +el.dataset.editContact, ctx.refresh));
  $('[data-add-mat]', main).onclick = () => materielForm(c, null, ctx.refresh);
  $$('[data-edit-mat]', main).forEach(el => el.onclick = () => materielForm(c, +el.dataset.editMat, ctx.refresh));
  $('[data-archive]', main).onclick = async () => { c.archive = !c.archive; await put('clients', c); toast(c.archive ? 'Fiche archivée' : 'Fiche réactivée'); ctx.refresh(); };
  $('[data-delete]', main).onclick = async () => {
    if (!(await confirmBox(`Supprimer définitivement « ${c.enseigne || c.nom} » avec ses visites, rappels et fichiers ? (les ventes restent dans les chiffres)`, 'Supprimer', true))) return;
    await bulkDel('visites', S.visites.filter(v => v.clientId === c.id).map(v => v.id));
    await bulkDel('rappels', S.rappels.filter(v => v.clientId === c.id).map(v => v.id));
    await bulkDel('fichiers', (await getFiles(c.id)).map(f => f.id));
    await del('clients', c.id);
    toast('Fiche supprimée'); location.hash = '#/clients';
  };
}

const mm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';

function contactForm(c, i, done) {
  const k = i != null ? c.contacts[i] : {};
  modal({
    title: i != null ? 'Contact' : 'Nouveau contact',
    body: `<label class="field"><span>Nom</span><input name="nom" value="${esc(k.nom || '')}"></label>
      <label class="field"><span>Fonction</span><input name="role" value="${esc(k.role || '')}" placeholder="Gérant, chef, économe…"></label>
      <label class="field"><span>Téléphone</span><input name="tel" type="tel" value="${esc(k.tel || '')}"></label>
      <label class="field"><span>Email</span><input name="email" type="email" value="${esc(k.email || '')}"></label>`,
    buttons: [
      ...(i != null ? [{ label: 'Supprimer', cls: 'ghost', onClick: async () => { c.contacts.splice(i, 1); await put('clients', c); done(); } }] : []),
      { label: 'Enregistrer', cls: 'primary', onClick: async body => {
        const o = Object.fromEntries($$('[name]', body).map(e => [e.name, e.value.trim()]));
        if (!o.nom && !o.tel) { toast('Indique au moins un nom ou un téléphone'); return false; }
        c.contacts = c.contacts || [];
        if (i != null) c.contacts[i] = o; else c.contacts.push(o);
        await put('clients', c); done();
      } },
    ],
  });
}

function materielForm(c, i, done) {
  const m = i != null ? c.materiel[i] : { date: today() };
  modal({
    title: i != null ? 'Matériel prêté' : 'Nouveau matériel prêté',
    body: `<label class="field"><span>Matériel</span><input name="designation" value="${esc(m.designation || '')}" placeholder="Vitrine à glaces 10 bacs, congélateur coffre…" list="mat-list"></label>
      <datalist id="mat-list">${['Vitrine à glaces', 'Congélateur coffre', 'Congélateur armoire', 'Turbine', 'Présentoir cônes', 'Parasol', 'Enseigne / drapeau', 'Distributeur'].map(x => `<option>${x}</option>`).join('')}</datalist>
      <label class="field"><span>N° de série</span><input name="serie" value="${esc(m.serie || '')}"></label>
      <label class="field"><span>Date de mise en place</span><input name="date" type="date" value="${esc(m.date || '')}"></label>
      <label class="field"><span>Note</span><input name="note" value="${esc(m.note || '')}" placeholder="État, contrat de prêt…"></label>`,
    buttons: [
      ...(i != null ? [{ label: 'Supprimer', cls: 'ghost', onClick: async () => { c.materiel.splice(i, 1); await put('clients', c); done(); } }] : []),
      { label: 'Enregistrer', cls: 'primary', onClick: async body => {
        const o = Object.fromEntries($$('[name]', body).map(e => [e.name, e.value.trim()]));
        if (!o.designation) { toast('Indique le matériel'); return false; }
        c.materiel = c.materiel || [];
        if (i != null) c.materiel[i] = o; else c.materiel.push(o);
        await put('clients', c); done();
      } },
    ],
  });
}

async function openFile(f, done) {
  const full = await getFile(f.id);
  const url = full && full.blob ? URL.createObjectURL(full.blob) : null;
  const isImg = f.type && f.type.startsWith('image/');
  modal({
    title: f.nom, wide: true,
    body: isImg && url ? `<img src="${url}" style="max-width:100%;border-radius:10px">` : `<p>${esc(f.nom)} · ${Math.round((f.taille || 0) / 1024)} Ko</p>`,
    buttons: [
      { label: 'Supprimer', cls: 'ghost', onClick: async () => { if (await confirmBox('Supprimer ce fichier ?', 'Supprimer', true)) { await del('fichiers', f.id); done(); } } },
      ...(url ? [{ label: 'Ouvrir / partager', cls: 'primary', onClick: () => { window.open(url, '_blank'); return false; } }] : []),
    ],
  });
}
