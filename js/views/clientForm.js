// Création / modification d'une fiche, en rubriques claires :
// identité, adresse, coordonnées, organisation (jours de visite et de télévente, créneaux), fermetures, situation, suivi.
import { S, put } from '../db.js';
import { cfg, TYPE_NAMES, ZONE_NAMES, ETAPES, zoneOf, findCommune, TYPES, SITUATIONS, JOURS_SEMAINE } from '../ref.js';
import { $, $$, esc, uid, today, toast, JOURS, iso } from '../util.js';
import { client } from '../metrics.js';
import { geocode } from '../route.js';
import { addressAutocomplete, creneauxEditor, readCreneaux, creneauxTxt } from '../ui.js';
import { ic } from '../icons.js';

// Anciens « mois de fermeture » → périodes annuelles (mois consécutifs regroupés)
function moisVersPeriodes(mois) {
  const set = new Set((mois || []).map(Number));
  if (!set.size) return [];
  const y = new Date().getFullYear(), out = [];
  const debuts = [...set].filter(m => !set.has(m === 1 ? 12 : m - 1));
  for (const d of (debuts.length ? debuts : [1])) {
    let f = d; while (set.has(f === 12 ? 1 : f + 1) && (f === 12 ? 1 : f + 1) !== d) f = f === 12 ? 1 : f + 1;
    out.push({ du: `${y}-${String(d).padStart(2, '0')}-01`, au: iso(new Date(y, f, 0)), annuel: true, motif: 'Saison' });
  }
  return out;
}

const perRow = (p = {}) => `<div class="per">
  <input type="date" data-du value="${esc(p.du || '')}" aria-label="Du">
  <input type="date" data-au value="${esc(p.au || '')}" aria-label="Au">
  <input data-motif value="${esc(p.motif || '')}" placeholder="Motif (congés, saison, travaux…)">
  <div class="row"><label class="chk"><input type="checkbox" data-annuel ${p.annuel ? 'checked' : ''}> Chaque année</label>
  <button type="button" class="btn small ghost icon-only" data-rm-per aria-label="Supprimer la période">${ic('trash', 20)}</button></div></div>`;

const jourSelect = (name, val, vide) => `<select name="${name}"><option value="">${vide}</option>${JOURS_SEMAINE.map(([n, l]) => `<option value="${n}" ${+val === n ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

export function render(main, ctx) {
  const id = ctx.params[0];
  const existing = id ? client(id) : null;
  const c = existing ? structuredClone(existing) : { id: uid(), statut: ctx.query.prospect ? 'prospect' : 'client', etape: ctx.query.prospect ? 'À contacter' : undefined, typeEtab: 'Restaurant', contacts: [], tags: [], materiel: [], creneaux: [], fermeture: [], depuis: ctx.query.prospect ? '' : today() };
  ctx.title(existing ? 'Modifier la fiche' : (c.statut === 'prospect' ? 'Nouveau prospect' : 'Nouveau client'));
  const conf = cfg();
  const allTags = [...new Set(S.clients.flatMap(x => x.tags || []))].sort();
  const defCr = conf.creneauxType[c.typeEtab] || TYPES.Autre.creneaux;
  const periodes = [...(c.periodesFermeture || []), ...moisVersPeriodes(c.moisFermes)];
  const specifiques = !!(c.creneaux && c.creneaux.length);

  main.innerHTML = `<div class="wrap narrow"><form data-form autocomplete="off">
    <div class="card">
      <div class="seg" style="margin-bottom:18px">${[['client', 'Client'], ['prospect', 'Prospect']].map(([k, l]) => `<button type="button" class="${c.statut === k ? 'on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="grid g2">
        <label class="field"><span>Nom de l'établissement *</span><input name="enseigne" value="${esc(c.enseigne || '')}" required></label>
        <label class="field"><span>Raison sociale</span><input name="nom" value="${esc(c.nom || '')}"></label>
        <label class="field"><span>Type d'établissement</span><select name="typeEtab">${TYPE_NAMES.map(t => `<option ${c.typeEtab === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field" data-etape-f ${c.statut === 'prospect' ? '' : 'hidden'}><span>Étape de prospection</span><select name="etape">${ETAPES.map(t => `<option ${c.etape === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
    </div>

    <div class="card"><h2>${ic('pin')}Adresse</h2>
      <label class="field"><span>Adresse (tape puis choisis dans la liste)</span><input name="adresse" value="${esc(c.adresse || '')}" placeholder="12 rue de la Gare"></label>
      <label class="field"><span>Complément d'adresse</span><input name="adresse2" value="${esc(c.adresse2 || '')}" placeholder="Bâtiment, lieu-dit, nom de la station…"></label>
      <div class="grid g3">
        <label class="field"><span>Code postal</span><input name="cp" value="${esc(c.cp || '')}" inputmode="numeric"></label>
        <label class="field"><span>Commune</span><input name="ville" value="${esc(c.ville || '')}"></label>
        <label class="field"><span>Zone de tournée</span><select name="zone">${ZONE_NAMES.map(z => `<option ${c.zone === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
      </div>
      <div class="muted small" data-geo>${c.lat != null ? 'Position enregistrée sur la carte.' : 'La position sera calculée à l\'enregistrement.'}</div>
    </div>

    <div class="card"><h2>${ic('phone')}Coordonnées</h2>
      <div class="grid g3">
        <label class="field"><span>Téléphone</span><input name="tel" type="tel" value="${esc(c.tel || '')}"></label>
        <label class="field"><span>Email</span><input name="email" type="email" value="${esc(c.email || '')}"></label>
        <label class="field"><span>N° client</span><input name="numClient" value="${esc(c.numClient || '')}"></label>
        <label class="field"><span>Code tournée</span><input name="tournee" value="${esc(c.tournee || '')}" placeholder="GC, TP…"></label>
        <label class="field"><span>SIRET</span><input name="siret" value="${esc(c.siret || '')}" inputmode="numeric"></label>
      </div>
      <p class="hint">Les contacts, le matériel prêté et les photos s'ajoutent depuis la fiche.</p>
    </div>

    <div class="card"><h2>${ic('calendar')}Organisation</h2>
      <div class="grid g3">
        <label class="field"><span>Jour de visite</span>${jourSelect('jourVisite', c.jourVisite, 'Selon la zone du jour')}</label>
        <label class="field"><span>Jour d'appel de la télévendeuse</span>${jourSelect('jourAppel', c.jourAppel, 'Aucun')}</label>
        <label class="field"><span>Jour de livraison</span><select name="jourLivraison"><option value="">—</option>${JOURS.slice(1).concat(JOURS[0]).map(j => `<option ${c.jourLivraison === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
        <label class="field"><span>Visite tous les (jours)</span><input name="frequence" type="number" min="1" value="${c.frequence ?? ''}" placeholder="${conf.frequenceDefaut}"></label>
        <label class="field"><span>Durée de visite (min)</span><input name="duree" type="number" min="5" step="5" value="${c.duree ?? ''}" placeholder="${conf.dureesType[c.typeEtab] || 30}" data-duree></label>
      </div>
      <div class="lbl-like">Heures de passage</div>
      <div class="seg" style="margin-bottom:12px"><button type="button" data-cr="def" class="${specifiques ? '' : 'on'}">Horaires du type</button><button type="button" data-cr="spe" class="${specifiques ? 'on' : ''}">Créneaux spécifiques</button></div>
      <p class="hint" data-cr-def ${specifiques ? 'hidden' : ''}>Horaires par défaut pour ce type : <b data-defcr>${esc(creneauxTxt(defCr))}</b></p>
      <div data-cr-spe ${specifiques ? '' : 'hidden'}><p class="hint">Jusqu'à 4 créneaux, en dehors des heures de service.</p>${creneauxEditor(c.creneaux)}</div>
    </div>

    <div class="card"><h2>${ic('lock')}Fermetures</h2>
      <div class="lbl-like">Fermé chaque semaine le</div>
      <div class="days-check" style="margin-bottom:16px">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="chk"><input type="checkbox" data-ferm value="${d}" ${(c.fermeture || []).map(Number).includes(d) ? 'checked' : ''}> ${JOURS[d]}</label>`).join('')}</div>
      <div class="lbl-like">Périodes de fermeture (du … au …)</div>
      <div class="periodes" data-periodes>${periodes.map(perRow).join('')}</div>
      <button type="button" class="btn small" data-add-per>${ic('plus', 20)}Ajouter une période</button>
      <p class="hint" style="margin-top:10px">Pendant une période, le client n'est jamais proposé en tournée. « Chaque année » la répète (saison, congés annuels).</p>
    </div>

    <div class="card"><h2>${ic('info')}Situation</h2>
      <div class="grid g2">
        <label class="field"><span>Situation du client</span><select name="situation">${SITUATIONS.map(s => `<option value="${esc(s.k)}" ${(c.situation || 'RAS') === s.k ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label class="field"><span>Depuis le</span><input type="date" name="situationDate" value="${esc(c.situationDate || '')}"></label>
      </div>
      <label class="field"><span>Précisions</span><input name="situationNote" value="${esc(c.situationNote || '')}" placeholder="Mandataire, conditions de paiement…"></label>
      <p class="hint">Liquidation judiciaire et fermeture définitive retirent le client des tournées et des alertes.</p>
    </div>

    <div class="card"><h2>${ic('chart')}Suivi</h2>
      <div class="grid g3">
        <label class="field"><span>Objectif de CA mensuel (€)</span><input name="objectifMensuel" type="number" min="0" step="50" value="${c.objectifMensuel ?? ''}"></label>
        <label class="field"><span>Fin de contrat</span><input name="finContrat" type="date" value="${esc(c.finContrat || '')}"></label>
        <label class="field"><span>Client depuis</span><input name="depuis" type="date" value="${esc(c.depuis || '')}"></label>
        <label class="field" data-prosp ${c.statut === 'prospect' ? '' : 'hidden'}><span>Prochain contact</span><input name="prochainContact" type="date" value="${esc(c.prochainContact || '')}"></label>
      </div>
      <label class="field"><span>Étiquettes (séparées par des virgules)</span><input name="tags" value="${esc((c.tags || []).join(', '))}" placeholder="terrasse, gros potentiel…"></label>
      ${allTags.length ? `<div class="chips wrap-chips" style="margin:-4px 0 14px">${allTags.slice(0, 30).map(t => `<button type="button" class="chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      <label class="field"><span>Notes</span><textarea name="notes">${esc(c.notes || '')}</textarea></label>
    </div>

    <div class="save-bar"><div class="btn-row end"><a class="btn" href="${existing ? '#/clients/' + c.id : '#/clients'}">Annuler</a><button class="btn primary" type="submit">${ic('check', 20)}Enregistrer</button></div></div>
  </form></div>`;

  const form = $('[data-form]', main);
  const f = n => form.elements[n];
  let coords = c.lat != null ? { lat: c.lat, lng: c.lng } : null;
  let lastAddr = [c.adresse, c.cp, c.ville].join('|');
  let modeCr = specifiques ? 'spe' : 'def';
  addressAutocomplete(f('adresse'), a => {
    f('cp').value = a.cp || ''; f('ville').value = a.ville || '';
    coords = { lat: a.lat, lng: a.lng }; lastAddr = [a.adresse, a.cp, a.ville].join('|');
    f('zone').value = zoneOf(a.ville, a.lat, a.lng);
    $('[data-geo]', main).textContent = 'Adresse trouvée : ' + a.label;
  });
  f('ville').addEventListener('change', () => { const cm = findCommune(f('ville').value); if (cm) { f('zone').value = cm.zone; if (!f('cp').value) f('cp').value = cm.cp; } });
  f('typeEtab').addEventListener('change', () => {
    const t = f('typeEtab').value;
    $('[data-duree]', main).placeholder = conf.dureesType[t] || 30;
    $('[data-defcr]', main).textContent = creneauxTxt(conf.creneauxType[t] || TYPES.Autre.creneaux);
  });
  $$('[data-st]', main).forEach(b => b.onclick = () => {
    c.statut = b.dataset.st; $$('[data-st]', main).forEach(x => x.classList.toggle('on', x === b));
    $('[data-etape-f]', main).hidden = c.statut !== 'prospect'; $('[data-prosp]', main).hidden = c.statut !== 'prospect';
  });
  $$('[data-cr]', main).forEach(b => b.onclick = () => {
    modeCr = b.dataset.cr; $$('[data-cr]', main).forEach(x => x.classList.toggle('on', x === b));
    $('[data-cr-def]', main).hidden = modeCr !== 'def'; $('[data-cr-spe]', main).hidden = modeCr !== 'spe';
  });
  $('[data-add-per]', main).onclick = () => $('[data-periodes]', main).insertAdjacentHTML('beforeend', perRow());
  $('[data-periodes]', main).onclick = e => { const b = e.target.closest('[data-rm-per]'); if (b) b.closest('.per').remove(); };
  $$('[data-tag]', main).forEach(b => b.onclick = () => {
    const cur = f('tags').value.split(',').map(s => s.trim()).filter(Boolean);
    if (!cur.includes(b.dataset.tag)) cur.push(b.dataset.tag);
    f('tags').value = cur.join(', ');
  });

  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      for (const n of ['enseigne', 'nom', 'typeEtab', 'adresse', 'adresse2', 'cp', 'ville', 'zone', 'tel', 'email', 'numClient', 'tournee', 'siret', 'jourLivraison', 'finContrat', 'notes', 'prochainContact', 'depuis', 'etape', 'situation', 'situationDate', 'situationNote']) {
        const v = f(n) ? f(n).value.trim() : '';
        c[n] = v || undefined;
      }
      if (!c.enseigne) { toast('Le nom est obligatoire'); return; }
      if (c.situation === 'RAS') { c.situation = undefined; c.situationDate = undefined; }
      for (const n of ['frequence', 'duree', 'objectifMensuel', 'jourVisite', 'jourAppel']) c[n] = f(n).value === '' ? undefined : +f(n).value;
      c.tags = f('tags').value.split(',').map(s => s.trim()).filter(Boolean);
      c.creneaux = modeCr === 'spe' ? readCreneaux(form) : [];
      c.fermeture = $$('[data-ferm]', form).filter(x => x.checked).map(x => +x.value);
      c.periodesFermeture = $$('.per', form).map(r => ({ du: $('[data-du]', r).value, au: $('[data-au]', r).value, motif: $('[data-motif]', r).value.trim(), annuel: $('[data-annuel]', r).checked }))
        .filter(p => p.du && p.au).map(p => p.au < p.du && !p.annuel ? { ...p, du: p.au, au: p.du } : p);
      c.moisFermes = undefined;
      if (c.statut === 'prospect') { c.etape = c.etape || 'À contacter'; if (!existing || existing.etape !== c.etape) c.etapeDate = today(); }
      else if (existing && existing.statut === 'prospect') { c.etape = 'Gagné'; c.etapeDate = today(); c.depuis = c.depuis || today(); }
      // Position sur la carte
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
      if (!c.zone) c.zone = zoneOf(c.ville, c.lat, c.lng);
      c.modifie = today();
      await put('clients', JSON.parse(JSON.stringify(c)));
      toast('Fiche enregistrée');
      location.replace('#/clients/' + c.id);
    } finally { btn.disabled = false; }
  };
}
