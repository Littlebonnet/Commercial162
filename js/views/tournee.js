// Tournée : proposition automatique, modification, réoptimisation, carte, horaires, navigation, « je suis en retard ».
import { S } from '../db.js';
import { cfg, typeColor, zoneColor, ZONE_NAMES } from '../ref.js';
import { $, $$, esc, today, addDays, parseD, JOURS, JOURS_C, dateFr, min2hm, dur, toast, modal, norm, debounce, telHref, iso, confirmBox } from '../util.js';
import { idx, clientName, retard } from '../metrics.js';
import { proposer, calculerTournee, candidats, traceRoute, wazeUrl, plansUrl, gmapsUrl, creneaux, dureeVisite, fermeLe } from '../route.js';
import { makeMap, destroyMap, pin, homeIcon, getTournee, setTournee, visiteRapide, typeDot, creneauxTxt, situationTag } from '../ui.js';
import { ic } from '../icons.js';
import { jourNom } from '../ref.js';

let mode = 'jour';
const traceCache = new Map();

function joursOuvres(from, n) {
  const out = []; let d = from;
  while (out.length < n) { const dow = parseD(d).getDay(); if (dow >= 1 && dow <= 5) out.push(d); d = addDays(d, 1); }
  return out;
}

export async function render(main, ctx) {
  ctx.title('Tournée');
  const t = today();
  const date = ctx.params[0] || t;
  const c = cfg();
  const dow = parseD(date).getDay();
  const zones = c.joursZones[dow] || [];
  let days = joursOuvres(t, 6);
  if (!days.includes(date)) days = [date, ...days].sort();
  ctx.actions([{ icon: mode === 'jour' ? 'calendar' : 'route', label: mode === 'jour' ? 'Semaine' : 'Jour', onClick: () => { mode = mode === 'jour' ? 'semaine' : 'jour'; ctx.refresh(); } }]);

  main.innerHTML = `<div class="wrap">
    <div class="chips day-chips">${days.map(d => `<a class="chip ${d === date ? 'on' : ''}" href="#/tournee/${d}">${d === t ? "Aujourd'hui" : esc(JOURS_C[parseD(d).getDay()] + ' ' + parseD(d).getDate())}</a>`).join('')}
      <label class="chip date-pick">${ic('calendar', 20)}Autre date<input type="date" value="${date}" data-date></label></div>
    <div data-body></div></div>`;
  $('[data-date]', main).onchange = e => { if (e.target.value) location.hash = '#/tournee/' + e.target.value; };
  const body = $('[data-body]', main);
  if (mode === 'semaine') return renderSemaine(body, date, ctx);

  if (c.maison.adresse === '' && !S.kv.maisonAvertie) {
    body.insertAdjacentHTML('beforebegin', `<div class="alert blue"><div class="grow">Le départ est fixé par défaut à Crolles. <a href="#/plus/reglages">Renseigne ton domicile dans Réglages</a> pour des horaires exacts.</div></div>`);
  }
  let tour = getTournee(date);
  if (!tour) {
    body.innerHTML = `<div class="card empty"><div class="spinner"></div><p>Je prépare la tournée de ${esc(JOURS[dow])} (${esc(zones.join(' + ') || 'aucune zone')})…</p></div>`;
    const ids = await proposer(date);
    tour = { order: ids, locked: false, auto: true };
    if (location.hash.replace(/^#\/tournee\/?/, '') !== (ctx.params[0] || '')) return;
    if (!ids.length) {
      body.innerHTML = `<div class="card empty"><p>Aucun client à proposer pour ce jour (zones : ${esc(zones.join(', ') || 'aucune')}).</p>
        <div class="btn-row" style="justify-content:center"><button class="btn primary" data-add>+ Ajouter des clients</button><a class="btn" href="#/plus/reglages">Zones par jour</a></div></div>`;
      $('[data-add]', body).onclick = () => ajouterClients(date, tour, ctx);
      return;
    }
  }
  await drawJour(body, date, tour, ctx);
}

async function compute(date, tour) {
  const isToday = date === today();
  const opts = { verrouille: true };
  if (tour.depart && isToday) { opts.depart = tour.depart; opts.heureDepart = tour.depart.heure; }
  const done = new Set(S.visites.filter(v => v.date === date).map(v => v.clientId));
  // Quand on repart de sa position, seuls les arrêts non faits sont replanifiés
  const ids = tour.depart && isToday ? tour.order.filter(id => !done.has(id)) : tour.order;
  let res;
  if (!tour.locked && !tour.optimise) {
    res = await calculerTournee(ids, { ...opts, verrouille: false });
    tour.order = tour.depart && isToday ? [...tour.order.filter(id => done.has(id)), ...res.order] : res.order;
    tour.optimise = true;
  } else res = await calculerTournee(ids, opts);
  const heures = {};
  res.plan.rows.forEach(r => { heures[res.stops[r.k].c.id] = r.start; });
  tour.fin = res.plan.finTour; tour.km = res.plan.km; tour.travel = res.plan.travel; tour.heures = heures;
  await setTournee(date, tour);
  return { res, done };
}

async function drawJour(body, date, tour, ctx) {
  body.innerHTML = `<div class="card empty"><div class="spinner"></div><p>Calcul des trajets et des horaires…</p></div>`;
  const { res, done } = await compute(date, tour);
  if (!body.isConnected) return; // l'utilisateur a changé de page pendant le calcul
  const c = cfg();
  const { plan, stops, source } = res;
  const isToday = date === today();
  const fromPos = tour.depart && isToday;
  const hors = plan.rows.filter(r => r.hors);
  const doneRows = tour.order.filter(id => fromPos && done.has(id));

  body.innerHTML = `
    <div class="tour-sum card">
      <div class="sum-grid">
        <div><div class="lbl">Visites</div><div class="v">${tour.order.length}</div></div>
        <div><div class="lbl">Départ</div><div class="v">${min2hm(res.opt.debut)}</div></div>
        <div><div class="lbl">Retour</div><div class="v ${plan.over > 0 ? 'down' : ''}">${min2hm(plan.finTour)}</div></div>
        <div><div class="lbl">Route</div><div class="v">${dur(plan.travel)}</div><div class="lbl">${Math.round(plan.km)} km</div></div>
        <div><div class="lbl">Attente</div><div class="v">${dur(plan.wait)}</div></div>
      </div>
      ${hors.length ? `<div class="alert red" style="margin:12px 0 0">${ic('alert')}<div>${hors.length} visite(s) hors créneau : ${hors.map(r => esc(clientName(stops[r.k].c.id))).join(', ')}. Retire un client ou laisse réoptimiser.</div></div>` : ''}
      ${plan.over > 0 ? `<div class="alert" style="margin:12px 0 0">${ic('clock')}<div>La journée dépasse l'heure de fin (${c.heureFin}) de ${dur(plan.over)}.</div></div>` : ''}
      ${hors.length || plan.over > 10 ? '<button class="btn block" data-drop style="margin-top:10px">Reporter les visites impossibles (elles restent proposées les jours suivants)</button>' : ''}
      <div class="muted small" style="margin-top:8px">${source === 'osrm' ? 'Temps de trajet réels (OSRM)' : 'Hors connexion : trajets estimés à vol d\'oiseau'}${tour.locked ? ' · ordre modifié à la main' : ' · ordre optimisé'}${fromPos ? ' · recalculé depuis ma position à ' + min2hm(tour.depart.heure) : ''}</div>
      <div class="btn-row" style="margin-top:12px">
        ${isToday ? `<button class="btn" data-late>${ic('clock', 20)}Je suis en retard</button>` : ''}
        <button class="btn primary" data-add>${ic('plus', 20)}Ajouter</button>
        <button class="btn" data-opt>${ic('refresh', 20)}Réoptimiser</button>
        <button class="btn" data-repropose>${ic('star', 20)}Nouvelle proposition</button>
        <button class="btn ghost" data-clear>Vider</button>
      </div>
    </div>
    <div class="split tour-split">
      <div class="card list-card"><div class="list stops" data-list></div></div>
      <div class="card map-card"><div class="map tall" data-map></div>
        <div class="leg">${[...new Set(stops.map(s => s.c.typeEtab))].map(t => `<span><span class="dot" style="background:${typeColor(t)}"></span>${esc(t)}</span>`).join('')}</div></div>
    </div>`;

  // ---- Liste des arrêts ----
  const L_ = [];
  const startLbl = fromPos ? 'Ma position' : 'Domicile';
  L_.push(`<div class="item home-row"><span class="num home">${ic('home', 18)}</span><div class="main"><div class="t">Départ · ${startLbl}</div><div class="s">${esc(fromPos ? '' : (c.maison.adresse || 'Crolles (à régler)'))}</div></div><div class="end"><b>${min2hm(res.opt.debut)}</b></div></div>`);
  doneRows.forEach(id => {
    const x = idx().byId.get(id); if (!x) return;
    L_.push(`<div class="item stop done-row"><span class="num done">${ic('check', 18)}</span><div class="main"><div class="t">${esc(x.enseigne || x.nom)}</div><div class="s">${esc(x.ville || '')} · visite faite</div></div></div>`);
  });
  let n = doneRows.length;
  let lunchShown = false;
  const lunchRow = () => `<div class="item lunch"><span class="num lunch">${ic('coffee', 18)}</span><div class="main"><div class="t">Pause déjeuner</div></div><div class="end">${min2hm(plan.lunch.start)}–${min2hm(plan.lunch.end)}</div></div>`;
  plan.rows.forEach((r, i) => {
    const s = stops[r.k], x = s.c;
    if (plan.lunch && !lunchShown && plan.lunch.start < r.start) { L_.push(lunchRow()); lunchShown = true; }
    n++;
    const isDone = done.has(x.id);
    const lo = plan.lunch ? Math.max(0, Math.min(r.start, plan.lunch.end) - Math.max(r.arr, plan.lunch.start)) : 0;
    const attente = r.start - r.arr - lo;
    const cr = creneaux(x).map(([a, b]) => min2hm(a) + '–' + min2hm(b)).join(' · ');
    L_.push(`<div class="stop-block ${isDone ? 'is-done' : ''}" data-id="${x.id}">
      <div class="leg-info muted small">${ic('car', 16)}${dur(r.trajet)} · ${r.kmIn.toFixed(1)} km${attente > 4 ? ` · <span class="amber-t">attente ${dur(attente)}</span>` : ''}</div>
      <div class="item stop">
        <span class="num ${isDone ? 'done' : ''}" style="${isDone ? '' : 'background:' + typeColor(x.typeEtab)}">${isDone ? ic('check', 18) : n}</span>
        <a class="main" href="#/clients/${x.id}"><div class="t">${esc(x.enseigne || x.nom)}</div>
          <div class="s">${esc(x.ville || '')} · ${esc(x.typeEtab || '')}${x.statut === 'prospect' ? ' · <b>prospect</b>' : ''}${x.jourAppel ? ' · télévente ' + esc(jourNom(x.jourAppel).toLowerCase()) : ''}</div>${situationTag(x) ? `<div>${situationTag(x)}</div>` : ''}
          <div class="s">Créneaux ${esc(cr)}${r.hors ? ' · <span class="down"><b>hors créneau</b></span>' : ''}</div></a>
        <div class="end"><div class="time">${min2hm(r.start)}</div><div class="muted small">→ ${min2hm(r.end)}</div></div>
      </div>
      <div class="stop-actions">
        <a class="btn small waze" href="${wazeUrl(x)}" target="_blank" rel="noopener">${ic('nav', 18)}Waze</a>
        ${x.tel || (x.contacts || []).some(k => k.tel) ? `<a class="btn small" href="${telHref(x.tel || x.contacts.find(k => k.tel).tel)}">${ic('phone', 18)}Appeler</a>` : ''}
        <button class="btn small ${isDone ? '' : 'primary'}" data-visite="${x.id}">${ic('check', 18)}${isDone ? 'Visite faite' : 'Visite faite'}</button>
        <span class="grow"></span>
        <button class="btn small ghost icon-only" data-up="${x.id}" aria-label="Monter">${ic('up', 20)}</button>
        <button class="btn small ghost icon-only" data-down="${x.id}" aria-label="Descendre">${ic('down', 20)}</button>
        <button class="btn small ghost icon-only" data-rm="${x.id}" aria-label="Retirer">${ic('close', 20)}</button>
      </div></div>`);
  });
  if (plan.lunch && !lunchShown) L_.push(lunchRow());
  L_.push(`<div class="item home-row"><span class="num home">${ic('home', 18)}</span><div class="main"><div class="t">Retour domicile</div><div class="s">${dur(plan.retourMin)} de route</div></div><div class="end"><b>${min2hm(plan.finTour)}</b></div></div>`);
  if (!plan.rows.length && !doneRows.length) L_.push('<div class="empty">Aucun arrêt. Ajoute des clients.</div>');
  $('[data-list]', body).innerHTML = L_.join('');

  // ---- Carte ----
  const mapEl = $('[data-map]', body);
  const map = makeMap(mapEl);
  ctx.onLeave(() => destroyMap(map));
  const start = fromPos ? tour.depart : c.maison;
  const pts = [[start.lat, start.lng]];
  L.marker([c.maison.lat, c.maison.lng], { icon: homeIcon() }).addTo(map).bindPopup('Domicile');
  if (fromPos) L.circleMarker([start.lat, start.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1B6DB5', fillOpacity: 1 }).addTo(map).bindPopup('Ma position');
  let k = doneRows.length;
  plan.rows.forEach(r => {
    const x = stops[r.k].c; k++;
    pts.push([x.lat, x.lng]);
    const isDone = done.has(x.id);
    L.marker([x.lat, x.lng], { icon: pin(isDone ? '#1F7A4C' : typeColor(x.typeEtab), isDone ? '✔' : String(k)) }).addTo(map)
      .bindPopup(`<b>${esc(x.enseigne || x.nom)}</b><br>${esc(x.ville || '')}<br>${min2hm(r.start)}–${min2hm(r.end)}<br><a href="#/clients/${x.id}">Fiche</a> · <a href="${wazeUrl(x)}" target="_blank">Waze</a>`);
  });
  for (const id of doneRows) { const x = idx().byId.get(id); if (x) L.marker([x.lat, x.lng], { icon: pin('#1F7A4C', '', true) }).addTo(map); }
  pts.push([c.maison.lat, c.maison.lng]);
  const fallback = L.polyline(pts, { color: '#1B6DB5', weight: 3, opacity: .55, dashArray: '6 8' }).addTo(map);
  map.fitBounds(L.latLngBounds(pts).pad(0.12));
  const tkey = pts.map(p => p.join(',')).join('|');
  const drawTrace = g => { if (!g) return; fallback.remove(); L.polyline(g, { color: '#1B6DB5', weight: 5, opacity: .8 }).addTo(map); };
  if (traceCache.has(tkey)) drawTrace(traceCache.get(tkey));
  else traceRoute(pts.map(([lat, lng]) => ({ lat, lng }))).then(g => { if (g) { traceCache.set(tkey, g); if (map._container && map._container.isConnected) drawTrace(g); } });

  // ---- Actions ----
  const save = async () => { await setTournee(date, tour); ctx.refresh(); };
  $$('[data-visite]', body).forEach(b => b.onclick = () => visiteRapide(b.dataset.visite, { date, onSaved: () => ctx.refresh() }));
  $$('[data-rm]', body).forEach(b => b.onclick = async () => { tour.order = tour.order.filter(id => id !== b.dataset.rm); tour.optimise = tour.locked; await save(); });
  const move = (id, d) => {
    const i = tour.order.indexOf(id), j = i + d;
    if (j < 0 || j >= tour.order.length) return;
    [tour.order[i], tour.order[j]] = [tour.order[j], tour.order[i]];
    tour.locked = true; save();
  };
  $$('[data-up]', body).forEach(b => b.onclick = () => move(b.dataset.up, -1));
  $$('[data-down]', body).forEach(b => b.onclick = () => move(b.dataset.down, 1));
  $('[data-opt]', body).onclick = async () => { tour.locked = false; tour.optimise = false; await save(); toast('Tournée réoptimisée'); };
  $('[data-add]', body).onclick = () => ajouterClients(date, tour, ctx);
  $('[data-clear]', body).onclick = async () => { if (await confirmBox('Vider la tournée de ce jour ?', 'Vider', true)) { await setTournee(date, { order: [], locked: false, optimise: true }); ctx.refresh(); } };
  $('[data-repropose]', body).onclick = async () => {
    if (!(await confirmBox('Remplacer la tournée par une nouvelle proposition automatique ?', 'Proposer'))) return;
    await setTournee(date, null); ctx.refresh();
  };
  const drop = $('[data-drop]', body);
  if (drop) drop.onclick = async () => {
    drop.disabled = true; drop.textContent = 'Calcul…';
    const n = await reporterImpossibles(date, tour, done);
    toast(n ? `${n} visite(s) reportée(s)` : 'Rien à reporter');
    ctx.refresh();
  };
  const late = $('[data-late]', body);
  if (late) late.onclick = () => jeSuisEnRetard(date, tour, ctx);
}

// Retire les arrêts qui ne tiennent plus (hors créneau ou fin de journée dépassée), en gardant les prioritaires
async function reporterImpossibles(date, tour, done) {
  const fromPos = tour.depart && date === today();
  const opts = fromPos ? { depart: tour.depart, heureDepart: tour.depart.heure } : {};
  let ids = tour.order.filter(id => !(fromPos && done.has(id)) && !done.has(id));
  const keep = tour.order.filter(id => done.has(id));
  const prio = new Map(candidats(date).map(x => [x.c.id, x.score]));
  let removed = 0;
  for (let guard = 0; guard < 30 && ids.length; guard++) {
    const r = await calculerTournee(ids, opts);
    const hors = r.plan.rows.filter(x => x.hors).map(x => r.stops[x.k].c.id);
    if (!hors.length && r.plan.over <= 10) { ids = r.order; break; }
    // On retire le moins prioritaire parmi les arrêts hors créneau (sinon parmi tous)
    const pool = hors.length ? hors : r.order;
    const worst = pool.slice().sort((a, b) => (prio.get(a) ?? -99) - (prio.get(b) ?? -99))[0];
    ids = r.order.filter(id => id !== worst); removed++;
  }
  tour.order = [...keep, ...ids]; tour.locked = false; tour.optimise = false;
  await setTournee(date, tour);
  return removed;
}

// Recalcule le reste de la journée depuis la position GPS et l'heure actuelle
function jeSuisEnRetard(date, tour, ctx) {
  if (!navigator.geolocation) { toast('GPS indisponible'); return; }
  toast('Localisation en cours…', 6000);
  navigator.geolocation.getCurrentPosition(async p => {
    const now = new Date();
    tour.depart = { lat: p.coords.latitude, lng: p.coords.longitude, heure: now.getHours() * 60 + now.getMinutes() };
    tour.locked = false; tour.optimise = false;
    await setTournee(date, tour);
    toast('Tournée recalculée depuis ta position');
    ctx.refresh();
  }, err => toast('Position introuvable : ' + (err.code === 1 ? 'autorise la localisation pour Safari' : err.message), 4500), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

// Ajout de clients : suggestions du jour (avec la raison) + recherche dans tout le fichier
function ajouterClients(date, tour, ctx) {
  const inTour = new Set(tour.order);
  const cands = candidats(date).filter(x => !inTour.has(x.c.id));
  const sel = new Set();
  modal({
    title: 'Ajouter à la tournée', wide: true,
    body: `<input type="search" placeholder="Rechercher un client ou un prospect…" data-q>
      <div class="chips" style="margin-top:10px">${['Suggérés', ...ZONE_NAMES].map((z, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-z="${esc(z)}">${esc(z)}</button>`).join('')}</div>
      <div class="list" data-l style="margin-top:6px"></div>`,
    onOpen(body) {
      let zone = 'Suggérés';
      const q = $('[data-q]', body), l = $('[data-l]', body);
      const draw = () => {
        const n = norm(q.value);
        let rows;
        if (n) rows = S.clients.filter(c => !c.archive && !inTour.has(c.id) && norm([c.nom, c.enseigne, c.ville, c.numClient].join(' ')).includes(n)).map(c => ({ c, why: [] }));
        else if (zone === 'Suggérés') rows = cands.filter(x => x.score > 0);
        else rows = cands.filter(x => x.c.zone === zone);
        l.innerHTML = rows.slice(0, 80).map(({ c, why }) => `<label class="item">
          <input type="checkbox" data-id="${c.id}" ${sel.has(c.id) ? 'checked' : ''}>${typeDot(c.typeEtab)}
          <div class="main"><div class="t">${esc(c.enseigne || c.nom)}</div><div class="s">${esc(c.ville || '')} · ${esc(c.typeEtab || '')}${c.lat == null ? ' · <span class="down">sans coordonnées</span>' : ''}${fermeLe(c, date) ? ' · <span class="down">fermé à cette date</span>' : ''}</div>
          ${why.length ? `<div class="s"><span class="tag">${why.map(esc).join('</span> <span class="tag">')}</span></div>` : ''}</div></label>`).join('') || '<div class="empty">Aucun client</div>';
      };
      q.oninput = debounce(draw, 150);
      $$('[data-z]', body).forEach(b => b.onclick = () => { zone = b.dataset.z; $$('[data-z]', body).forEach(x => x.classList.toggle('on', x === b)); draw(); });
      l.onchange = e => { const cb = e.target.closest('[data-id]'); if (cb) cb.checked ? sel.add(cb.dataset.id) : sel.delete(cb.dataset.id); };
      draw();
    },
    buttons: [{ label: 'Ajouter et réoptimiser', cls: 'primary', onClick: async () => {
      const ids = [...sel].filter(id => { const c = S.clients.find(x => x.id === id); return c && c.lat != null; });
      if (sel.size && !ids.length) { toast('Ces clients n\'ont pas de coordonnées : complète leur adresse'); return false; }
      tour.order = [...tour.order, ...ids]; tour.locked = false; tour.optimise = false;
      await setTournee(date, tour); ctx.refresh();
    } }],
  });
}

// ---------- Vue semaine par zones ----------
function renderSemaine(body, date, ctx) {
  const c = cfg();
  const d0 = parseD(date); const lundi = addDays(date, -((d0.getDay() + 6) % 7));
  const jours = [0, 1, 2, 3, 4].map(i => addDays(lundi, i));
  body.innerHTML = `<div class="row" style="margin:6px 0 12px"><button class="btn small" data-prev>‹ Semaine préc.</button><div class="grow center"><b>Semaine du ${dateFr(lundi)}</b></div><button class="btn small" data-next>Semaine suiv. ›</button></div>
    <div class="days">${jours.map(d => {
      const dow = parseD(d).getDay();
      const z = c.joursZones[dow] || [];
      const tour = getTournee(d);
      const cands = candidats(d).filter(x => x.score >= 40);
      const ids = tour ? tour.order : [];
      return `<div class="card day">
        <h2>${esc(JOURS[dow])} ${parseD(d).getDate()}<span class="right">${d === today() ? '<span class="tag green">aujourd\'hui</span>' : ''}</span></h2>
        <div>${z.map(x => `<span class="tag" style="background:${zoneColor(x)};color:#fff">${esc(x)}</span>`).join('') || '<span class="tag grey">pas de zone</span>'}</div>
        <p class="small muted">${tour ? `${ids.length} visites planifiées${tour.fin ? ' · retour ' + min2hm(tour.fin) : ''}` : `${cands.length} clients à voir dans la zone`}</p>
        <div class="list compact">${(tour ? ids.map(id => idx().byId.get(id)).filter(Boolean) : cands.slice(0, 6).map(x => x.c)).slice(0, 8).map(x => `<div class="item">${typeDot(x.typeEtab)}<div class="main"><div class="t">${esc(x.enseigne || x.nom)}</div><div class="s">${esc(x.ville || '')}</div></div></div>`).join('')}</div>
        <a class="btn block ${tour ? '' : 'primary'}" href="#/tournee/${d}" data-open>${tour ? 'Ouvrir' : 'Préparer'}</a></div>`;
    }).join('')}</div>
    <p class="muted small" style="margin-top:12px">Les zones de chaque jour se règlent dans <a href="#/plus/reglages">Plus → Réglages</a>.</p>`;
  $('[data-prev]', body).onclick = () => { location.hash = '#/tournee/' + addDays(lundi, -7); };
  $('[data-next]', body).onclick = () => { location.hash = '#/tournee/' + addDays(lundi, 7); };
  $$('[data-open]', body).forEach(a => a.addEventListener('click', () => { mode = 'jour'; }));
}
