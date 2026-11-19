// Création / modification d'une fiche : auto-complétion d'adresse, zone déduite de la commune, créneaux, fermeture.
import { S, put } from '../db.js';
import { cfg, TYPE_NAMES, ZONE_NAMES, ETAPES, zoneOf, findCommune, TYPES } from '../ref.js';
import { $, $$, esc, uid, today, toast, JOURS, MOIS } from '../util.js';
import { client } from '../metrics.js';
import { geocode } from '../route.js';
import { addressAutocomplete, creneauxEditor, readCreneaux, creneauxTxt } from '../ui.js';

export function render(main, ctx) {
  const id = ctx.params[0];
  const existing = id ? client(id) : null;
  const c = existing ? structuredClone(existing) : { id: uid(), statut: ctx.query.prospect ? 'prospect' : 'client', etape: ctx.query.prospect ? 'À contacter' : undefined, typeEtab: 'Restaurant', contacts: [], tags: [], materiel: [], creneaux: [], fermeture: [], depuis: ctx.query.prospect ? '' : today() };
  ctx.title(existing ? 'Modifier la fiche' : (c.statut === 'prospect' ? 'Nouveau prospect' : 'Nouveau client'));
  const conf = cfg();
  const allTags = [...new Set(S.clients.flatMap(x => x.tags || []))].sort();
  const defCr = conf.creneauxType[c.typeEtab] || TYPES.Autre.creneaux;

  main.innerHTML = `<div class="wrap narrow"><form class="card form" data-form autocomplete="off">
    <div class="seg" style="margin-bottom:14px">${[['client', 'Client'], ['prospect', 'Prospect']].map(([k, l]) => `<button type="button" class="${c.statut === k ? 'on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
    <div class="grid g2">
      <label class="field"><span>Enseigne (nom affiché) *</span><input name="enseigne" value="${esc(c.enseigne || '')}" required></label>
      <label class="field"><span>Raison sociale</span><input name="nom" value="${esc(c.nom || '')}"></label>
      <label class="field"><span>Type d'établissement</span><select name="typeEtab">${TYPE_NAMES.map(t => `<option ${c.typeEtab === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field" data-etape-f ${c.statut === 'prospect' ? '' : 'hidden'}><span>Étape de prospection</span><select name="etape">${ETAPES.map(t => `<option ${c.etape === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    <h3>Adresse</h3>
    <label class="field"><span>Adresse (tape puis choisis dans la liste)</span><input name="adresse" value="${esc(c.adresse || '')}" placeholder="12 rue de la Gare, Crolles"></label>
    <label class="field"><span>Complément d'adresse</span><input name="adresse2" value="${esc(c.adresse2 || '')}" placeholder="Bâtiment, lieu-dit, nom de la station…"></label>
    <div class="grid g3">
      <label class="field"><span>Code postal</span><input name="cp" value="${esc(c.cp || '')}" inputmode="numeric"></label>
      <label class="field"><span>Commune</span><input name="ville" value="${esc(c.ville || '')}"></label>
      <label class="field"><span>Zone de tournée</span><select name="zone">${ZONE_NAMES.map(z => `<option ${c.zone === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
    </div>
    <div class="muted small" data-geo>${c.lat != null ? `📍 Géolocalisé (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})` : 'Pas encore géolocalisé : ce sera fait à l\'enregistrement.'}</div>
    <h3>Coordonnées</h3>
    <div class="grid g3">
      <label class="field"><span>Téléphone</span><input name="tel" type="tel" value="${esc(c.tel || '')}"></label>
      <label class="field"><span>Email</span><input name="email" type="email" value="${esc(c.email || '')}"></label>
      <label class="field"><span>N° client Alpagel</span><input name="numClient" value="${esc(c.numClient || '')}"></label>
      <label class="field"><span>Code tournée</span><input name="tournee" value="${esc(c.tournee || '')}" placeholder="GC, TP…"></label>
      <label class="field"><span>SIRET</span><input name="siret" value="${esc(c.siret || '')}" inputmode="numeric"></label>
      <label class="field"><span>Jour de livraison</span><select name="jourLivraison"><option value=""></option>${JOURS.slice(1).concat(JOURS[0]).map(j => `<option ${c.jourLivraison === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
      <label class="field"><span>Fin de contrat</span><input name="finContrat" type="date" value="${esc(c.finContrat || '')}"></label>
    </div>
    <p class="muted small">Les contacts (plusieurs par client), le matériel prêté et les photos s'ajoutent depuis la fiche.</p>
    <h3>Visites</h3>
    <div class="grid g3">
      <label class="field"><span>Fréquence de visite (jours)</span><input name="frequence" type="number" min="1" value="${c.frequence ?? ''}" placeholder="${conf.frequenceDefaut} (défaut)"></label>
      <label class="field"><span>Durée de visite (min)</span><input name="duree" type="number" min="5" step="5" value="${c.duree ?? ''}" placeholder="${conf.dureesType[c.typeEtab] || 30} (défaut du type)" data-duree></label>
      <label class="field"><span>Objectif CA mensuel (€)</span><input name="objectifMensuel" type="number" min="0" step="50" value="${c.objectifMensuel ?? ''}"></label>
    </div>
    <div class="field"><span class="lbl-like">Créneaux où je peux passer (jamais pendant le service). Vide = défaut du type : <b data-defcr>${esc(creneauxTxt(defCr))}</b></span>${creneauxEditor(c.creneaux)}</div>
    <div class="field"><span class="lbl-like">Fermé le</span><div class="days-check">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="chk"><input type="checkbox" data-ferm value="${d}" ${(c.fermeture || []).map(Number).includes(d) ? 'checked' : ''}> ${JOURS[d]}</label>`).join('')}</div></div>
    <div class="field"><span class="lbl-like">Fermé ces mois-là (saisonniers : jamais proposé en tournée)</span><div class="days-check">${MOIS.map((m, i) => `<label class="chk"><input type="checkbox" data-mf value="${i + 1}" ${(c.moisFermes || []).map(Number).includes(i + 1) ? 'checked' : ''}> ${m}</label>`).join('')}</div></div>
    <div class="grid g2" data-prosp ${c.statut === 'prospect' ? '' : 'hidden'}>
      <label class="field"><span>Prochain contact prévu</span><input name="prochainContact" type="date" value="${esc(c.prochainContact || '')}"></label>
      <label class="field"><span>Client depuis</span><input name="depuis" type="date" value="${esc(c.depuis || '')}"></label>
    </div>
    <h3>Tags & notes</h3>
    <label class="field"><span>Tags (séparés par des virgules)</span><input name="tags" value="${esc((c.tags || []).join(', '))}" placeholder="saisonnier, bio, terrasse…"></label>
    ${allTags.length ? `<div class="chips wrap-chips" style="margin:-4px 0 12px">${allTags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <label class="field"><span>Notes libres</span><textarea name="notes">${esc(c.notes || '')}</textarea></label>
    <div class="btn-row end"><a class="btn" href="${existing ? '#/clients/' + c.id : '#/clients'}">Annuler</a><button class="btn primary" type="submit">Enregistrer</button></div>
  </form></div>`;

  const form = $('[data-form]', main);
  const f = n => form.elements[n];
  let coords = c.lat != null ? { lat: c.lat, lng: c.lng } : null;
  let lastAddr = [c.adresse, c.cp, c.ville].join('|');
  addressAutocomplete(f('adresse'), a => {
    f('cp').value = a.cp || ''; f('ville').value = a.ville || '';
    coords = { lat: a.lat, lng: a.lng }; lastAddr = [a.adresse, a.cp, a.ville].join('|');
    f('zone').value = zoneOf(a.ville);
    $('[data-geo]', main).textContent = `📍 Géolocalisé : ${a.label}`;
  });
  f('ville').addEventListener('change', () => { const cm = findCommune(f('ville').value); if (cm) { f('zone').value = cm.zone; if (!f('cp').value) f('cp').value = cm.cp; } });
  f('typeEtab').addEventListener('change', () => {
    const t = f('typeEtab').value;
    $('[data-duree]', main).placeholder = (conf.dureesType[t] || 30) + ' (défaut du type)';
    $('[data-defcr]', main).textContent = creneauxTxt(conf.creneauxType[t] || TYPES.Autre.creneaux);
  });
  $$('[data-st]', main).forEach(b => b.onclick = () => {
    c.statut = b.dataset.st; $$('[data-st]', main).forEach(x => x.classList.toggle('on', x === b));
    $('[data-etape-f]', main).hidden = c.statut !== 'prospect'; $('[data-prosp]', main).hidden = c.statut !== 'prospect';
  });
  $$('[data-tag]', main).forEach(b => b.onclick = () => {
    const cur = f('tags').value.split(',').map(s => s.trim()).filter(Boolean);
    if (!cur.includes(b.dataset.tag)) cur.push(b.dataset.tag);
    f('tags').value = cur.join(', ');
  });

  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      for (const n of ['enseigne', 'nom', 'typeEtab', 'adresse', 'adresse2', 'cp', 'ville', 'zone', 'tel', 'email', 'numClient', 'tournee', 'siret', 'jourLivraison', 'finContrat', 'notes', 'prochainContact', 'depuis', 'etape']) {
        const v = f(n) ? f(n).value.trim() : '';
        c[n] = v || undefined;
      }
      if (!c.enseigne) { toast('Le nom est obligatoire'); return; }
      for (const n of ['frequence', 'duree', 'objectifMensuel']) c[n] = f(n).value === '' ? undefined : +f(n).value;
      c.tags = f('tags').value.split(',').map(s => s.trim()).filter(Boolean);
      c.creneaux = readCreneaux(form);
      c.fermeture = $$('[data-ferm]', form).filter(x => x.checked).map(x => +x.value);
      c.moisFermes = $$('[data-mf]', form).filter(x => x.checked).map(x => +x.value);
      if (c.statut === 'prospect') { c.etape = c.etape || 'À contacter'; if (!existing || existing.etape !== c.etape) c.etapeDate = today(); }
      else { if (existing && existing.statut === 'prospect') { c.etape = 'Gagné'; c.etapeDate = today(); c.depuis = c.depuis || today(); } }
      // Géolocalisation
      const addr = [c.adresse, c.cp, c.ville].join('|');
      if (coords && addr === lastAddr) { c.lat = coords.lat; c.lng = coords.lng; }
      else if (c.adresse || c.ville) {
        let g = null;
        try { if (navigator.onLine) g = await geocode([c.adresse, c.cp, c.ville].filter(Boolean).join(' '), c.cp); } catch (err) { }
        const cm = findCommune(c.ville);
        if (g && g.score > 0.4) { c.lat = g.lat; c.lng = g.lng; }
        else if (cm) { c.lat = cm.lat + (Math.random() - .5) * .004; c.lng = cm.lng + (Math.random() - .5) * .004; toast('Adresse approximative : centre de la commune'); }
        else if (!existing || existing.lat == null) { c.lat = undefined; c.lng = undefined; toast('Adresse introuvable : fiche non placée sur la carte'); }
      }
      if (!c.zone) c.zone = zoneOf(c.ville);
      c.modifie = today();
      await put('clients', JSON.parse(JSON.stringify(c)));
      toast('Fiche enregistrée ✓');
      location.replace('#/clients/' + c.id);
    } finally { btn.disabled = false; btn.textContent = 'Enregistrer'; }
  };
}
