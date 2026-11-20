// Accueil du matin : tournée du jour, CA du mois, prime, relances, télévente du jour, alertes, activité.
import { S, put } from '../db.js';
import { cfg } from '../ref.js';
import { $, $$, esc, eur, pct, today, dateFr, JOURS, MOIS_LONG, min2hm, dur, num } from '../util.js';
import { rappelsDus, alertes, activite, clientName, clients } from '../metrics.js';
import { getTournee, rappelForm, typeDot, situationTag } from '../ui.js';
import { ic } from '../icons.js';

export function render(main, ctx) {
  ctx.title('Accueil');
  const c = cfg();
  const d = new Date();
  const t = today();
  const tour = getTournee(t);
  const rap = rappelsDus();
  const al = alertes();
  const act = activite(28);
  const dow = d.getDay();
  const tele = clients().filter(x => +x.jourAppel === dow && !x.archive);
  const faites = tour ? tour.order.filter(id => S.visites.some(v => v.clientId === id && v.date === t)).length : 0;
  const zonesJour = (c.joursZones[dow] || []).join(' + ');
  const empty = !S.clients.length;

  main.innerHTML = `<div class="wrap">
    <div class="page-head"><div><div class="muted">${esc(JOURS[dow][0].toUpperCase() + JOURS[dow].slice(1))} ${d.getDate()} ${esc(MOIS_LONG[d.getMonth()])}</div>
      <div class="big">Bonjour${c.nom ? ' ' + esc(c.nom.split(' ')[0]) : ''}</div></div>
      ${zonesJour ? `<div class="muted">Zone du jour : <b style="color:var(--text)">${esc(zonesJour)}</b></div>` : ''}</div>

    ${empty ? `<div class="card hero-empty"><h2>${ic('info')}Pour commencer</h2><p class="muted" style="margin-top:0">Importe ton fichier clients (Excel ou CSV), ou charge la démonstration pour essayer.</p>
      <div class="btn-row"><a class="btn primary" href="#/plus/import">${ic('upload', 20)}Importer mes données</a><a class="btn" href="#/plus/reglages">Charger la démo</a><a class="btn" href="#/clients/nouveau">${ic('plus', 20)}Créer un client</a></div></div>` : ''}

    <div class="grid g2">
      <div class="card tour-card">
        <h2>${ic('route')}Tournée du jour</h2>
        ${tour && tour.order.length ? `
          <div class="kpis3">
            <div><div class="val">${tour.order.length}</div><div class="lbl">visites</div></div>
            <div><div class="val">${faites}</div><div class="lbl">faites</div></div>
            <div><div class="val">${tour.fin != null ? min2hm(tour.fin) : '—'}</div><div class="lbl">retour prévu</div></div>
          </div>
          <div class="progress ${faites === tour.order.length ? 'ok' : ''}"><div style="width:${tour.order.length ? faites / tour.order.length * 100 : 0}%"></div></div>
          <p class="muted small" style="margin:4px 0 12px">${tour.km ? Math.round(tour.km) + ' km · ' : ''}${tour.travel ? dur(tour.travel) + ' de route' : ''}</p>
          <a class="btn primary block" href="#/tournee">${faites ? 'Continuer la tournée' : 'Démarrer la tournée'}</a>`
        : `<p class="muted">Pas encore de tournée pour aujourd'hui.</p><a class="btn primary block" href="#/tournee">${ic('route', 20)}Préparer ma tournée</a>`}
      </div>
      <div class="card">
        <h2>${ic('bell')}Relances <span class="right"><button class="btn small" data-add-rap>${ic('plus', 18)}Rappel</button></span></h2>
        ${rap.length ? `<div class="list">${rap.slice(0, 10).map(r => `<div class="item" data-rap="${r.id}">
          <button class="check" data-done="${r.id}" aria-label="Marquer comme fait">${ic('check', 20)}</button>
          <div class="main"><div class="t">${esc(r.clientId ? clientName(r.clientId) : (r.texte || 'Rappel'))}</div><div class="s">${esc(r.texte || '')}</div></div>
          <div class="end small ${r.date < today() ? 'down' : 'muted'}">${dateFr(r.date)}</div></div>`).join('')}</div>
          ${rap.length > 10 ? `<a class="btn ghost block" href="#/plus/rappels">Voir les ${rap.length} rappels</a>` : ''}`
        : `<div class="empty">${ic('check', 32)}Aucune relance aujourd'hui</div>`}
      </div>
      <div class="card">
        <h2>${ic('headset')}Télévente du jour <span class="right muted small">${tele.length}</span></h2>
        ${tele.length ? `<p class="muted small" style="margin-top:-6px">Clients appelés aujourd'hui par la télévendeuse.</p><div class="list compact">${tele.slice(0, 12).map(x => `<a class="item" href="#/clients/${x.id}">${typeDot(x.typeEtab)}<div class="main"><div class="t">${esc(x.enseigne || x.nom)}</div><div class="s">${esc(x.ville || '')}</div></div>${situationTag(x)}</a>`).join('')}</div>
          ${tele.length > 12 ? `<div class="muted small" style="padding:6px 4px">… et ${tele.length - 12} autres</div>` : ''}`
        : `<div class="empty">${ic('headset', 32)}Aucun appel de télévente prévu aujourd'hui</div>`}
      </div>
    </div>

    <div class="card mt">
      <h2>${ic('alert')}Alertes <span class="right muted small">${al.length}</span></h2>
      ${al.length ? `<div class="grid g2" style="gap:8px">${al.slice(0, 12).map(a => { const x = S.clients.find(y => y.id === a.id); return `<a class="alert ${a.niveau === 'red' ? 'red' : a.niveau === 'blue' ? 'blue' : ''}" href="#/clients/${a.id}" style="margin:0">${ic(a.type === 'contrat' ? 'calendar' : a.type === 'visite' ? 'clock' : 'alert', 20)}<div class="grow"><b>${esc(clientName(a.id))}</b> <span class="muted small">${esc(x?.ville || '')}</span><div class="small">${esc(a.txt)}</div></div></a>`; }).join('')}</div>
        ${al.length > 12 ? `<p class="muted small" style="margin-bottom:0">… et ${al.length - 12} autres alertes (voir la liste des clients, filtre « En retard »).</p>` : ''}`
      : '<div class="empty">Rien à signaler</div>'}
    </div>

    <div class="section-title">Activité · 4 dernières semaines</div>
    <div class="grid g4">
      <div class="card kpi"><div class="lbl">Visites par jour</div><div class="val">${num(act.parJour)}</div><div class="sub">${act.visites} visites sur ${act.joursTravailles} jours</div></div>
      <div class="card kpi"><div class="lbl">Relances en attente</div><div class="val">${rap.length}</div><div class="sub">rappels dus aujourd'hui ou avant</div></div>
      <div class="card kpi"><div class="lbl">Clients vus</div><div class="val">${act.clientsVus}</div><div class="sub">sur ${clients().length} clients</div></div>
      <div class="card kpi"><div class="lbl">Prospects transformés</div><div class="val">${act.transfo === null ? '—' : pct(act.transfo)}</div><div class="sub">${act.won} gagnés · ${act.lost} perdus</div></div>
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
