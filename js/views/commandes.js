// Commandes : liste + éditeur rapide (habituels +/-, recherche catalogue, nouveautés, suggestions), signature, PDF.
import { S, put, del, bulkPut, bulkDel } from '../db.js';
import { cfg } from '../ref.js';
import { $, $$, esc, uid, eur, num, pct, today, addDays, dateFr, toast, modal, confirmBox, norm, debounce, shareFile, sum } from '../util.js';
import { idx, client, clientName, topProduits, suggestions, nouveautes, semaine } from '../metrics.js';
import { pickClient, signaturePad, typeDot, prochaineLivraison } from '../ui.js';
import { bonDeCommande } from '../pdf.js';

let filtre = 'toutes';

export async function render(main, ctx) {
  const id = ctx.params[0];
  if (id === 'nouvelle') return nouvelle(ctx);
  if (id) return editeur(main, ctx, id);
  liste(main, ctx);
}

async function nouvelle(ctx) {
  let cid = ctx.query.client;
  if (!cid) cid = await pickClient({ title: 'Commande pour quel client ?' });
  if (!cid) { location.replace('#/commandes'); return; }
  // Reprend un brouillon du jour pour ce client s'il existe
  const draft = S.commandes.find(x => x.clientId === cid && x.statut === 'brouillon' && x.date === today());
  if (draft) { location.replace('#/commandes/' + draft.id); return; }
  const c = client(cid);
  const n = S.commandes.length + 1;
  const cmd = { id: uid(), numero: `${today().replace(/-/g, '').slice(2)}-${String(n).padStart(3, '0')}`, clientId: cid, date: today(), livraison: prochaineLivraison(c), lignes: [], totalHT: 0, marge: 0, statut: 'brouillon', note: '' };
  await put('commandes', cmd);
  location.replace('#/commandes/' + cmd.id);
}

function liste(main, ctx) {
  ctx.title('Commandes');
  ctx.actions([{ label: '+ Nouvelle', href: '#/commandes/nouvelle' }]);
  const { lundi } = semaine();
  const m0 = today().slice(0, 7);
  const rows = S.commandes.filter(c => filtre === 'toutes' || (filtre === 'brouillons' ? c.statut === 'brouillon' : filtre === 'semaine' ? c.date >= lundi : c.date.startsWith(m0)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.numero || '').localeCompare(a.numero || ''));
  const tot = sum(rows.filter(r => r.statut !== 'brouillon'), r => r.totalHT);
  main.innerHTML = `<div class="wrap">
    <div class="chips">${[['toutes', 'Toutes'], ['brouillons', 'Brouillons'], ['semaine', 'Cette semaine'], ['mois', 'Ce mois']].map(([k, l]) => `<button class="chip ${filtre === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="muted small" style="margin:10px 4px">${rows.length} commande(s) · ${eur(tot)} HT validé</div>
    <div class="card" style="padding:4px 12px">${rows.length ? `<div class="list">${rows.slice(0, 300).map(c => { const cl = client(c.clientId); return `<a class="item" href="#/commandes/${c.id}">${typeDot(cl?.typeEtab)}
      <div class="main"><div class="t">${esc(clientName(c.clientId))}</div><div class="s">${dateFr(c.date, true)} · n° ${esc(c.numero || '')} · ${c.lignes.length} ligne(s)${c.livraison ? ' · livr. ' + dateFr(c.livraison) : ''}</div></div>
      <div class="end"><b>${eur(c.totalHT)}</b><br><span class="tag ${c.statut === 'brouillon' ? 'amber' : c.statut === 'envoyée' ? 'green' : ''}">${esc(c.statut)}</span></div></a>`; }).join('')}</div>`
      : `<div class="empty">Aucune commande.<br><br><a class="btn primary" href="#/commandes/nouvelle">Prendre une commande</a></div>`}</div></div>`;
  $$('[data-f]', main).forEach(b => b.onclick = () => { filtre = b.dataset.f; ctx.refresh(); });
}

// Prix de vente : catalogue, sinon dernier prix payé par le client
function prixPour(ref, clientId) {
  const p = idx().prod.get(ref);
  const last = (idx().ventesBy.get(clientId) || []).filter(l => l.ref === ref && l.qte).sort((a, b) => b.date.localeCompare(a.date))[0];
  const pu = p && p.prix ? p.prix : last ? last.ht / last.qte : 0;
  const pa = p && p.achat != null ? p.achat : last && last.marge != null ? (last.ht - last.marge) / last.qte : pu * 0.7;
  return { pu: Math.round(pu * 100) / 100, pa: Math.round(pa * 100) / 100, designation: p?.designation || last?.designation || ref, cond: p?.cond || '' };
}

function totaux(cmd) {
  cmd.totalHT = Math.round(sum(cmd.lignes, l => l.qte * l.pu) * 100) / 100;
  cmd.marge = Math.round(sum(cmd.lignes, l => l.qte * (l.pu - (l.pa || 0))) * 100) / 100;
}

// Une commande validée alimente les ventes (CA, marge, top produits)
async function syncVentes(cmd) {
  const old = S.ventes.filter(v => v.cmdId === cmd.id).map(v => v.id);
  if (old.length) await bulkDel('ventes', old);
  if (cmd.statut === 'brouillon') return;
  await bulkPut('ventes', cmd.lignes.filter(l => l.qte).map((l, i) => ({
    id: cmd.id + '-' + i, cmdId: cmd.id, clientId: cmd.clientId, date: cmd.date, ref: l.ref, designation: l.designation,
    qte: l.qte, ht: Math.round(l.qte * l.pu * 100) / 100, marge: Math.round(l.qte * (l.pu - (l.pa || 0)) * 100) / 100, source: 'commande',
  })));
}

function editeur(main, ctx, id) {
  const cmd = S.commandes.find(x => x.id === id);
  if (!cmd) { main.innerHTML = '<div class="card empty">Commande introuvable. <a href="#/commandes">Retour</a></div>'; return; }
  const c = client(cmd.clientId) || {};
  ctx.title('Commande · ' + clientName(cmd.clientId));
  const conf = cfg();
  let onglet = cmd.lignes.length ? 'habituels' : 'habituels';
  let q = '';
  const habituels = topProduits({ clientId: cmd.clientId, limit: 40, months: 12 });
  const sug = suggestions(cmd.clientId, 15);
  const nouv = nouveautes();
  const locked = cmd.statut !== 'brouillon';

  main.innerHTML = `<div class="wrap">
    <div class="card cmd-head">
      <div class="row wrap-r">
        <div class="grow"><a href="#/clients/${c.id}" class="cmd-client">${typeDot(c.typeEtab)} <b>${esc(clientName(cmd.clientId))}</b></a><div class="muted small">${esc(c.ville || '')} · n° ${esc(cmd.numero || '')}${c.numClient ? ' · client ' + esc(c.numClient) : ''}</div></div>
        <label class="field mini"><span>Date</span><input type="date" data-k="date" value="${cmd.date}"></label>
        <label class="field mini"><span>Livraison</span><input type="date" data-k="livraison" value="${cmd.livraison || ''}"></label>
        <span class="tag ${cmd.statut === 'brouillon' ? 'amber' : 'green'}" style="align-self:center">${esc(cmd.statut)}</span>
      </div>
    </div>
    <div class="split cmd-split">
      <div class="card">
        <div class="seg seg-full">${[['habituels', `Habituels (${habituels.length})`], ['catalogue', 'Catalogue'], ['nouveautes', `Nouveautés / promos (${nouv.length})`], ['suggestions', `Suggestions (${sug.length})`]].map(([k, l]) => `<button data-tab="${k}" class="${onglet === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div data-search-box style="margin-top:10px" hidden><input type="search" placeholder="Réf., désignation, famille… (plusieurs mots possibles)" data-q></div>
        <div class="list prod-list" data-prods style="margin-top:6px"></div>
        <button class="btn ghost block" data-manual style="margin-top:8px">+ Ajouter un produit hors catalogue</button>
      </div>
      <div class="card cart">
        <h2>Panier <span class="right muted small" data-nb></span></h2>
        <div class="list" data-cart></div>
        <div class="totals" data-totals></div>
        <label class="field" style="margin-top:10px"><span>Remarques (sur le bon)</span><textarea data-k="note" rows="2">${esc(cmd.note || '')}</textarea></label>
        <div class="sig-box">${cmd.signature ? `<img src="${cmd.signature}" alt="signature">` : '<span class="muted small">Pas de signature</span>'}<button class="btn small" data-sign>✍ ${cmd.signature ? 'Refaire la signature' : 'Faire signer'}</button></div>
        <div class="btn-row" style="margin-top:12px">
          ${cmd.statut === 'brouillon' ? '<button class="btn primary grow" data-valider>✓ Valider la commande</button>' : '<button class="btn grow" data-reouvrir>Modifier</button>'}
          <button class="btn primary grow" data-share>✉ Envoyer le bon (PDF)</button>
        </div>
        <div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-pdf>Voir le PDF</button><span class="grow"></span><button class="btn ghost danger-t" data-del>Supprimer</button></div>
      </div>
    </div>
    <div class="cart-sticky" data-sticky><span data-st-txt></span><button class="btn primary small" data-to-cart>Voir le panier ↓</button></div></div>`;

  const save = debounce(async () => { totaux(cmd); await put('commandes', cmd); if (!locked) return; await syncVentes(cmd); }, 250);
  const qteOf = ref => (cmd.lignes.find(l => l.ref === ref) || {}).qte || 0;
  const setQte = (ref, qte, info) => {
    if (cmd.statut !== 'brouillon') { toast('Commande validée : touche « Modifier » pour la changer'); return; }
    qte = Math.max(0, Math.round(qte * 100) / 100);
    let l = cmd.lignes.find(x => x.ref === ref);
    if (!l && qte > 0) { const p = info || prixPour(ref, cmd.clientId); l = { ref, designation: p.designation, cond: p.cond, pu: p.pu, pa: p.pa, qte: 0 }; cmd.lignes.push(l); }
    if (!l) return;
    l.qte = qte;
    if (!qte) cmd.lignes = cmd.lignes.filter(x => x !== l);
    save(); drawCart(); syncProdRow(ref);
  };

  const prodRow = (ref, designation, sub, badge = '') => {
    const p = idx().prod.get(ref);
    const pr = prixPour(ref, cmd.clientId);
    const qn = qteOf(ref);
    return `<div class="item prod ${qn ? 'in' : ''}" data-ref="${esc(ref)}">
      <div class="main"><div class="t">${esc(designation || p?.designation || ref)} ${badge}</div><div class="s">${esc(ref)}${p?.cond ? ' · ' + esc(p.cond) : ''} · ${pr.pu ? eur(pr.pu, true) : 'prix à saisir'}${p?.stock != null ? ' · stock ' + num(p.stock) : ''}${sub ? ' · ' + sub : ''}</div>${p?.infos ? `<div class="s">${esc(p.infos)}</div>` : ''}</div>
      <div class="qty"><button data-m="${esc(ref)}" aria-label="Moins">−</button><input type="number" inputmode="decimal" min="0" value="${qn || ''}" placeholder="0" data-qi="${esc(ref)}"><button data-p="${esc(ref)}" aria-label="Plus">+</button></div></div>`;
  };
  const syncProdRow = ref => {
    const row = main.querySelector(`[data-prods] [data-ref="${CSS.escape(ref)}"]`);
    if (row) { const qn = qteOf(ref); row.classList.toggle('in', !!qn); row.querySelector('[data-qi]').value = qn || ''; }
  };

  const drawProds = () => {
    const box = $('[data-prods]', main);
    $('[data-search-box]', main).hidden = onglet !== 'catalogue';
    let html = '';
    if (onglet === 'habituels') {
      html = habituels.length ? habituels.map(p => prodRow(p.ref, p.designation, `${num(p.qte)} en 12 mois · dernier ${dateFr(p.last)}`)).join('')
        : '<div class="empty">Pas encore d\'historique pour ce client : utilise le catalogue.</div>';
    } else if (onglet === 'catalogue') {
      const words = norm(q).split(/\s+/).filter(Boolean);
      const res = (words.length ? S.produits.filter(p => p.actif !== false && words.every(w => norm(p.ref + ' ' + p.designation + ' ' + (p.famille || '') + ' ' + (p.ean || '') + ' ' + (p.infos || '') + ' ' + (p.marque || '')).includes(w))) : S.produits.filter(p => p.actif !== false))
        .slice(0, 80);
      html = res.length ? res.map(p => prodRow(p.ref, p.designation, esc(p.famille || ''), p.nouveaute ? '<span class="tag green">nouveau</span>' : p.promo ? '<span class="tag red">promo</span>' : '')).join('')
        : `<div class="empty">${S.produits.length ? 'Aucun produit trouvé' : 'Catalogue vide : importe-le dans Plus → Import'}</div>`;
      if (!words.length && S.produits.length > 80) html = `<div class="muted small" style="padding:6px">Tape quelques lettres pour chercher parmi ${S.produits.length} références.</div>` + html;
    } else if (onglet === 'nouveautes') {
      html = nouv.length ? nouv.map(p => prodRow(p.ref, p.designation, p.promo ? `<b class="down">${esc(p.promoTexte || 'promo')}</b>` : 'nouveauté', p.nouveaute ? '<span class="tag green">nouveau</span>' : '<span class="tag red">promo</span>')).join('')
        : '<div class="empty">Aucune nouveauté ni promo. Coche-les dans le catalogue.</div>';
    } else {
      html = sug.length ? sug.map(p => prodRow(p.ref, p.designation, `pris par ${Math.round(p.taux)} % des ${esc(c.typeEtab || '')}s`)).join('')
        : '<div class="empty">Pas de suggestion (il faut des ventes chez des clients du même type).</div>';
    }
    box.innerHTML = html;
  };

  const drawCart = () => {
    totaux(cmd);
    $('[data-nb]', main).textContent = `${cmd.lignes.length} ligne(s)`;
    $('[data-st-txt]', main).innerHTML = `<b>${cmd.lignes.length}</b> ligne(s) · <b>${eur(cmd.totalHT, true)}</b> HT`;
    $('[data-cart]', main).innerHTML = cmd.lignes.length ? cmd.lignes.map((l, i) => `<div class="item cart-line">
      <div class="main"><div class="t">${esc(l.designation)}</div><div class="s">${esc(l.ref)} · PU <input class="pu" type="number" step="0.01" min="0" inputmode="decimal" value="${l.pu}" data-pu="${i}" ${locked ? 'disabled' : ''}> € · total <b>${eur(l.qte * l.pu, true)}</b></div></div>
      <div class="qty"><button data-cm="${i}">−</button><input type="number" inputmode="decimal" min="0" value="${l.qte}" data-cq="${i}" ${locked ? 'disabled' : ''}><button data-cp="${i}">+</button></div></div>`).join('')
      : '<div class="empty">Panier vide. Touche + sur les produits.</div>';
    const tva = cmd.totalHT * (conf.tva || 5.5) / 100;
    $('[data-totals]', main).innerHTML = `<div class="row"><span class="grow">Total HT</span><b class="big-n">${eur(cmd.totalHT, true)}</b></div>
      <div class="row small muted"><span class="grow">TVA ${conf.tva} % · TTC</span><span>${eur(cmd.totalHT + tva, true)}</span></div>
      <div class="row small"><span class="grow">Marge</span><span class="${cmd.marge >= 0 ? 'up' : 'down'}">${eur(cmd.marge, true)} · ${cmd.totalHT ? pct(cmd.marge / cmd.totalHT * 100) : '—'}</span></div>`;
  };

  // Événements produits (délégation)
  $('[data-prods]', main).addEventListener('click', e => {
    const p = e.target.closest('[data-p]'), m = e.target.closest('[data-m]');
    if (p) setQte(p.dataset.p, qteOf(p.dataset.p) + 1);
    if (m) setQte(m.dataset.m, qteOf(m.dataset.m) - 1);
  });
  $('[data-prods]', main).addEventListener('change', e => { const i = e.target.closest('[data-qi]'); if (i) setQte(i.dataset.qi, +i.value || 0); });
  $('[data-cart]', main).addEventListener('click', e => {
    const p = e.target.closest('[data-cp]'), m = e.target.closest('[data-cm]');
    if (p) { const l = cmd.lignes[+p.dataset.cp]; setQte(l.ref, l.qte + 1); }
    if (m) { const l = cmd.lignes[+m.dataset.cm]; setQte(l.ref, l.qte - 1); }
  });
  $('[data-cart]', main).addEventListener('change', e => {
    const qi = e.target.closest('[data-cq]'), pu = e.target.closest('[data-pu]');
    if (qi) { const l = cmd.lignes[+qi.dataset.cq]; setQte(l.ref, +qi.value || 0); }
    if (pu) { cmd.lignes[+pu.dataset.pu].pu = Math.max(0, +pu.value || 0); save(); drawCart(); }
  });
  $('[data-to-cart]', main).onclick = () => $('.cart', main).scrollIntoView({ behavior: 'smooth' });
  $$('[data-tab]', main).forEach(b => b.onclick = () => { onglet = b.dataset.tab; $$('[data-tab]', main).forEach(x => x.classList.toggle('on', x === b)); drawProds(); if (onglet === 'catalogue') $('[data-q]', main).focus(); });
  $('[data-q]', main).oninput = debounce(e => { q = e.target.value; drawProds(); }, 120);
  $$('[data-k]', main).forEach(el => el.onchange = () => { cmd[el.dataset.k] = el.value; save(); });
  $('[data-manual]', main).onclick = () => produitManuel(p => setQte(p.ref, 1, { designation: p.designation, cond: p.cond, pu: p.prix, pa: p.achat ?? p.prix * 0.7 }));
  $('[data-sign]', main).onclick = () => signaturePad(async d => { cmd.signature = d; await put('commandes', cmd); ctx.refresh(); });

  const valider = $('[data-valider]', main);
  if (valider) valider.onclick = async () => {
    if (!cmd.lignes.length) { toast('Le panier est vide'); return; }
    totaux(cmd); cmd.statut = 'validée'; cmd.valideLe = new Date().toISOString();
    await put('commandes', cmd); await syncVentes(cmd);
    // Prospect transformé + visite « commande prise » du jour
    if (c.statut === 'prospect') { c.statut = 'client'; c.etape = 'Gagné'; c.etapeDate = today(); c.depuis = c.depuis || today(); await put('clients', c); }
    const v = S.visites.find(x => x.clientId === c.id && x.date === cmd.date);
    if (!v) await put('visites', { id: uid(), clientId: c.id, date: cmd.date, resultat: 'Commande prise', note: `Commande ${eur(cmd.totalHT)}`, heure: new Date().toTimeString().slice(0, 5) });
    else if (v.resultat !== 'Commande prise') { v.resultat = 'Commande prise'; await put('visites', v); }
    toast('Commande validée ✓'); ctx.refresh();
  };
  const reouv = $('[data-reouvrir]', main);
  if (reouv) reouv.onclick = async () => { cmd.statut = 'brouillon'; await put('commandes', cmd); await syncVentes(cmd); ctx.refresh(); };
  const pdfName = () => `Bon de commande ${cmd.numero} - ${clientName(cmd.clientId)}.pdf`.replace(/[\\/:*?"<>|]/g, '');
  $('[data-pdf]', main).onclick = () => { totaux(cmd); const b = bonDeCommande(cmd); const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  $('[data-share]', main).onclick = async () => {
    if (!cmd.lignes.length) { toast('Le panier est vide'); return; }
    totaux(cmd);
    const blob = bonDeCommande(cmd);
    const email = c.email || (c.contacts || []).find(k => k.email)?.email || '';
    await shareFile(blob, pdfName(), `Bonjour,\nVeuillez trouver ci-joint le bon de commande n° ${cmd.numero} (${eur(cmd.totalHT, true)} HT).\nCordialement,\n${conf.nom || ''}`);
    if (cmd.statut === 'validée') { cmd.statut = 'envoyée'; cmd.envoyeLe = today(); await put('commandes', cmd); await syncVentes(cmd); }
    if (email) toast('Email du client : ' + email, 4000);
  };
  $('[data-del]', main).onclick = async () => {
    if (!(await confirmBox('Supprimer cette commande ? Ses lignes seront retirées des chiffres.', 'Supprimer', true))) return;
    cmd.statut = 'brouillon'; await syncVentes(cmd); await del('commandes', cmd.id);
    toast('Commande supprimée'); location.replace('#/commandes');
  };

  drawProds(); drawCart();
}

export function produitManuel(onDone, p = {}) {
  modal({
    title: p.ref ? 'Produit' : 'Nouveau produit',
    body: `<div class="grid g2">
      <label class="field"><span>Référence *</span><input name="ref" value="${esc(p.ref || '')}" ${p.ref ? 'readonly' : ''}></label>
      <label class="field"><span>Famille</span><input name="famille" value="${esc(p.famille || '')}" list="fam-list"></label></div>
      <datalist id="fam-list">${[...new Set(S.produits.map(x => x.famille).filter(Boolean))].map(f => `<option>${esc(f)}</option>`).join('')}</datalist>
      <label class="field"><span>Désignation *</span><input name="designation" value="${esc(p.designation || '')}"></label>
      <div class="grid g3"><label class="field"><span>Conditionnement</span><input name="cond" value="${esc(p.cond || '')}" placeholder="carton 6 × 2,5 L"></label>
      <label class="field"><span>Prix de vente HT</span><input name="prix" type="number" step="0.01" value="${p.prix ?? ''}"></label>
      <label class="field"><span>Prix d'achat HT</span><input name="achat" type="number" step="0.01" value="${p.achat ?? ''}"></label></div>
      <div class="row wrap-r"><label class="chk"><input type="checkbox" name="nouveaute" ${p.nouveaute ? 'checked' : ''}> Nouveauté</label>
      <label class="chk"><input type="checkbox" name="promo" ${p.promo ? 'checked' : ''}> Promo du mois</label>
      <label class="chk"><input type="checkbox" name="actif" ${p.actif === false ? '' : 'checked'}> Actif</label></div>
      <label class="field" style="margin-top:10px"><span>Texte promo</span><input name="promoTexte" value="${esc(p.promoTexte || '')}" placeholder="-15 % jusqu'au 31/12"></label>`,
    buttons: [{ label: 'Enregistrer', cls: 'primary', onClick: async body => {
      const g = n => $(`[name=${n}]`, body);
      const o = { ...p, ref: g('ref').value.trim(), designation: g('designation').value.trim(), famille: g('famille').value.trim(), cond: g('cond').value.trim(),
        prix: g('prix').value === '' ? 0 : +g('prix').value, achat: g('achat').value === '' ? null : +g('achat').value,
        nouveaute: g('nouveaute').checked, promo: g('promo').checked, actif: g('actif').checked, promoTexte: g('promoTexte').value.trim() };
      if (!o.ref || !o.designation) { toast('Référence et désignation obligatoires'); return false; }
      await put('produits', o); toast('Produit enregistré'); onDone && onDone(o);
    } }],
  });
}
