// Accueil du matin : tournée du jour, CA vs objectif, prime, relances, alertes, activité.
import { S, put } from '../db.js';
import { cfg } from '../ref.js';
import { $, $$, esc, eur, pct, today, dateFr, JOURS, MOIS_LONG, min2hm, dur, num } from '../util.js';
import { moisEnCours, objectifMois, prime, rappelsDus, alertes, activite, nouveauxClients, clientName, clients, thisMonth } from '../metrics.js';
import { getTournee, rappelForm, typeDot } from '../ui.js';

export function render(main, ctx) {
  ctx.title('Accueil');
  const c = cfg();
  const d = new Date();
  const t = today();
  const tour = getTournee(t);
  const m = moisEnCours();
  const obj = objectifMois();
  const p = prime();
  const rap = rappelsDus();
  const al = alertes();
  const act = activite(28);
  const nv = nouveauxClients();
  const visitesFaites = tour ? tour.order.filter(id => S.visites.some(v => v.clientId === id && v.date === t)).length : 0;
  const evo = m.caN1 ? (m.ca - m.caN1) / m.caN1 * 100 : null;
  const att = obj ? m.ca / obj * 100 : 0;
  const dow = d.getDay();
  const zonesJour = (c.joursZones[dow] || []).join(' + ') || 'pas de zone';
  const empty = !S.clients.length;

  main.innerHTML = `<div class="wrap">
    <div class="hello"><div><div class="muted">${esc(JOURS[dow])} ${d.getDate()} ${esc(MOIS_LONG[d.getMonth()])}</div>
      <div class="big">Bonjour${c.nom ? ' ' + esc(c.nom.split(' ')[0]) : ''} 👋</div></div></div>
    ${empty ? `<div class="card hero-empty"><h2>Bienvenue !</h2><p>Pour commencer, importe ton fichier clients (Excel ou CSV) ou charge le jeu de démonstration pour essayer l'application.</p>
      <div class="btn-row"><a class="btn primary" href="#/plus/import">Importer mes données</a><a class="btn" href="#/plus/reglages">Charger la démo</a><a class="btn" href="#/clients/nouveau">Créer un client</a></div></div>` : ''}
    <div class="grid g2">
      <div class="card tour-card">
        <h2>➤ Tournée du jour <span class="right muted">${esc(zonesJour)}</span></h2>
        ${tour && tour.order.length ? `
          <div class="kpis3">
            <div><div class="val">${tour.order.length}</div><div class="lbl">visites</div></div>
            <div><div class="val">${visitesFaites}</div><div class="lbl">faites</div></div>
            <div><div class="val">${tour.fin != null ? min2hm(tour.fin) : '—'}</div><div class="lbl">retour prévu</div></div>
          </div>
          <div class="progress ${visitesFaites === tour.order.length ? 'ok' : ''}"><div style="width:${tour.order.length ? visitesFaites / tour.order.length * 100 : 0}%"></div></div>
          <p class="muted small">${tour.km ? Math.round(tour.km) + ' km · ' : ''}${tour.travel ? dur(tour.travel) + ' de route' : ''}</p>
          <div class="list compact">${tour.order.slice(0, 4).map((id, i) => { const x = S.clients.find(y => y.id === id); return x ? `<a class="item" href="#/clients/${id}"><span class="num ${S.visites.some(v => v.clientId === id && v.date === t) ? 'done' : ''}">${i + 1}</span><div class="main"><div class="t">${esc(x.enseigne || x.nom)}</div><div class="s">${esc(x.ville || '')}${tour.heures && tour.heures[id] ? ' · ' + min2hm(tour.heures[id]) : ''}</div></div></a>` : ''; }).join('')}
          ${tour.order.length > 4 ? `<div class="muted small" style="padding:6px 4px">… et ${tour.order.length - 4} autres</div>` : ''}</div>
          <a class="btn primary block" href="#/tournee">${visitesFaites ? 'Continuer la tournée' : 'Démarrer la tournée'}</a>`
        : `<p class="muted">Pas encore de tournée pour aujourd'hui.</p><a class="btn primary block" href="#/tournee">Proposer ma tournée du jour</a>`}
      </div>

      <div class="card">
        <h2>€ CA du mois <span class="right muted">${esc(MOIS_LONG[d.getMonth()])}</span></h2>
        <div class="row" style="align-items:flex-end;justify-content:space-between">
          <div><div class="kval">${eur(m.ca)}</div><div class="muted small">marge ${eur(m.marge)} (${m.ca ? pct(m.marge / m.ca * 100) : '—'})</div></div>
          <div class="right"><div class="muted small">N-1 même période</div><div style="font-weight:700">${eur(m.caN1)} ${evo !== null ? `<span class="${evo >= 0 ? 'up' : 'down'}">${evo >= 0 ? '▲' : '▼'} ${pct(Math.abs(evo))}</span>` : ''}</div></div>
        </div>
        ${obj ? `<div class="progress ${att >= 100 ? 'ok' : ''}"><div style="width:${Math.min(100, att)}%"></div></div>
          <div class="row small"><span class="grow">Objectif ${eur(obj)} · <b>${pct(att)}</b></span><span class="muted">reste ${eur(Math.max(0, obj - m.ca))}</span></div>`
        : '<p class="muted small">Aucun objectif défini. <a href="#/plus/reglages">Le fixer dans Réglages</a></p>'}
        <div class="hr"></div>
        <div class="row"><div class="grow"><div class="muted small">Prime estimée</div><div class="kval sm">${eur(p.total)}</div>
          <div class="muted small">palier ${eur(p.fixe)} + variable ${eur(p.variable)}</div></div>
          <div class="right small" style="max-width:55%">${p.next ? `Encore <b>${eur(Math.max(0, p.manque))}</b> pour le palier ${p.next.seuil} % (<b>${eur(p.next.montant)}</b>)` : (obj ? '<span class="up">Palier maximum atteint 🎉</span>' : '')}</div></div>
        <div class="muted small" style="margin-top:8px">Nouveaux clients ce mois : <b>${nv.length}</b> / ${c.objectifNouveaux}</div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card">
        <h2>☎ Relances dues <span class="right"><button class="btn small" data-add-rap>+ Rappel</button></span></h2>
        ${rap.length ? `<div class="list">${rap.slice(0, 12).map(r => `<div class="item" data-rap="${r.id}">
          <button class="check" data-done="${r.id}" aria-label="Marquer fait">✓</button>
          <div class="main"><div class="t">${esc(r.clientId ? clientName(r.clientId) : (r.texte || 'Rappel'))}</div><div class="s">${esc(r.texte || '')}</div></div>
          <div class="end ${r.date < today() ? 'down' : ''}">${dateFr(r.date)}</div></div>`).join('')}</div>
          ${rap.length > 12 ? `<a class="btn ghost block" href="#/plus/rappels">Voir les ${rap.length} rappels</a>` : ''}`
        : '<div class="empty">Aucune relance due 👍</div>'}
      </div>
      <div class="card">
        <h2>⚠ Alertes <span class="right muted small">${al.length}</span></h2>
        ${al.length ? `<div class="scroll-y" style="max-height:420px">${al.slice(0, 25).map(a => { const x = S.clients.find(y => y.id === a.id); return `<a class="alert ${a.niveau}" href="#/clients/${a.id}">${typeDot(x?.typeEtab)}<div class="grow"><b>${esc(clientName(a.id))}</b> <span class="muted small">${esc(x?.ville || '')}</span><div class="small">${esc(a.txt)}</div></div></a>`; }).join('')}</div>`
        : '<div class="empty">Rien à signaler</div>'}
      </div>
    </div>

    <div class="section-title">Activité · 4 dernières semaines</div>
    <div class="grid g4">
      <div class="card kpi"><div class="lbl">Visites / jour</div><div class="val">${num(act.parJour)}</div><div class="sub">${act.visites} visites sur ${act.joursTravailles} j</div></div>
      <div class="card kpi"><div class="lbl">Visite → commande</div><div class="val">${pct(act.tauxVisiteCommande)}</div><div class="sub">${act.commandes} commandes saisies</div></div>
      <div class="card kpi"><div class="lbl">Panier moyen</div><div class="val">${eur(act.panier)}</div><div class="sub">HT par commande</div></div>
      <div class="card kpi"><div class="lbl">Transformation prospects</div><div class="val">${act.transfo === null ? '—' : pct(act.transfo)}</div><div class="sub">${act.won} gagnés · ${act.lost} perdus</div></div>
    </div>
  </div>`;

  $$('[data-done]', main).forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const r = S.rappels.find(x => x.id === b.dataset.done);
    r.fait = true; r.faitLe = today(); await put('rappels', r); ctx.refresh();
  });
  $$('[data-rap]', main).forEach(it => it.onclick = e => {
    if (e.target.closest('[data-done]')) return;
    const r = S.rappels.find(x => x.id === it.dataset.rap);
    if (r.clientId) location.hash = '#/clients/' + r.clientId; else rappelForm(r, ctx.refresh);
  });
  $('[data-add-rap]', main).onclick = () => rappelForm({}, ctx.refresh);
}
