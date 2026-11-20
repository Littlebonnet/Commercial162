// Chiffres : N vs N-1 par mois, CA/marge par client, zone, type, objectifs, top 20, nouveaux clients, activité.
import { S } from '../db.js';
import { cfg, ZONE_NAMES, TYPE_NAMES, zoneColor, typeColor } from '../ref.js';
import { $, $$, esc, eur, num, pct, today, addDays, MOIS, ym, iso, sum, groupBy, parseD } from '../util.js';
import { idx, client, clientName, clients, serieMensuelle, objectifMois, monthRange, thisMonth, shiftMonth, topProduits, caOf, margeOf, ventesEntre, activite } from '../metrics.js';
import { chart, fmtK, typeDot } from '../ui.js';
import { ic } from '../icons.js';

let periode = 'mois';
let triClients = 'ca';

function bornes() {
  const t = today(), y = +t.slice(0, 4);
  if (periode === 'mois') { const [a] = monthRange(thisMonth()); const [ap, bp] = monthRange(shiftMonth(thisMonth(), -12)); return { from: a, to: t, fromN1: ap, toN1: addDays(t, -365) < bp ? addDays(t, -365) : bp, lbl: 'Mois en cours' }; }
  if (periode === 'annee') return { from: `${y}-01-01`, to: t, fromN1: `${y - 1}-01-01`, toN1: `${y - 1}${t.slice(4)}`, lbl: 'Depuis le 1er janvier' };
  if (periode === 'saison') { // saison d'hiver : 1er novembre → 30 avril
    const s = +t.slice(5, 7) >= 11 ? y : y - 1;
    return { from: `${s}-11-01`, to: t, fromN1: `${s - 1}-11-01`, toN1: addDays(t, -365), lbl: `Saison d'hiver ${s}-${s + 1}` };
  }
  return { from: addDays(t, -365), to: t, fromN1: addDays(t, -730), toN1: addDays(t, -365), lbl: '12 derniers mois' };
}

export function render(main, ctx) {
  ctx.title('Chiffres');
  const charts = [];
  ctx.onLeave(() => charts.forEach(c => c.destroy()));
  const t = today(), y = +t.slice(0, 4);
  const b = bornes();
  const cur = ventesEntre(b.from, b.to), prev = ventesEntre(b.fromN1, b.toN1);
  const ca = caOf(cur), caN1 = caOf(prev), mg = margeOf(cur), mgN1 = margeOf(prev);
  const evo = (a, z) => z ? (a - z) / z * 100 : null;
  const evoTxt = (a, z) => { const e = evo(a, z); return e === null ? '<span class="muted">—</span>' : `<span class="${e >= 0 ? 'up' : 'down'}">${e >= 0 ? '+' : '−'}${pct(Math.abs(e))}</span>`; };

  const sN = serieMensuelle(y), sN1 = serieMensuelle(y - 1);
  const objs = Array.from({ length: 12 }, (_, i) => objectifMois(`${y}-${String(i + 1).padStart(2, '0')}`) || null);

  // Agrégats par client / zone / type
  const agg = (lines, key) => { const m = new Map(); for (const l of lines) { const k = key(l); if (k == null) continue; const o = m.get(k) || { ca: 0, mg: 0 }; o.ca += l.ht || 0; o.mg += l.marge || 0; m.set(k, o); } return m; };
  const I = idx();
  const zoneOfL = l => I.byId.get(l.clientId)?.zone || 'Inconnue';
  const typeOfL = l => I.byId.get(l.clientId)?.typeEtab || 'Autre';
  const byZ = agg(cur, zoneOfL), byZ1 = agg(prev, zoneOfL);
  const byT = agg(cur, typeOfL), byT1 = agg(prev, typeOfL);
  const byC = agg(cur, l => l.clientId), byC1 = agg(prev, l => l.clientId);
  const [mFrom, mTo] = monthRange(thisMonth());
  const byCM = agg(ventesEntre(mFrom, mTo), l => l.clientId);

  const clientRows = [...new Set([...byC.keys(), ...byC1.keys()])].map(id => ({ id, ca: byC.get(id)?.ca || 0, mg: byC.get(id)?.mg || 0, n1: byC1.get(id)?.ca || 0 }))
    .map(r => ({ ...r, evo: r.n1 ? (r.ca - r.n1) / r.n1 * 100 : null, tm: r.ca ? r.mg / r.ca * 100 : 0 }));
  const sorters = { ca: (a, b) => b.ca - a.ca, mg: (a, b) => b.mg - a.mg, n1: (a, b) => b.n1 - a.n1, evo: (a, b) => (a.evo ?? 999) - (b.evo ?? 999), tm: (a, b) => b.tm - a.tm };
  clientRows.sort(sorters[triClients]);

  const objClients = clients().filter(c => c.objectifMensuel > 0).map(c => ({ c, ca: byCM.get(c.id)?.ca || 0 })).map(r => ({ ...r, att: r.ca / r.c.objectifMensuel * 100 })).sort((a, b) => a.att - b.att);
  const top = topProduits({ limit: 20, months: periode === 'mois' ? 1 : 12 });

  // Nouveaux clients par mois (12 derniers)
  const mois12 = []; for (let i = 11; i >= 0; i--) mois12.push(shiftMonth(thisMonth(), -i));
  const nouveaux = mois12.map(k => clients().filter(c => (c.depuis || '').startsWith(k)).length);
  // Activité : visites et commandes par semaine (12 semaines)
  const sem = []; { const d = parseD(t); const lundi = addDays(t, -((d.getDay() + 6) % 7)); for (let i = 11; i >= 0; i--) sem.push(addDays(lundi, -7 * i)); }
  const visSem = sem.map(l => S.visites.filter(v => v.date >= l && v.date < addDays(l, 7)).length);
  const cmdSem = sem.map(l => S.visites.filter(v => v.date >= l && v.date < addDays(l, 7) && v.resultat === 'Commande prise').length);
  const act = activite(90);

  const tableAgg = (names, m, m1, colorF) => {
    const rows = [...new Set([...names, ...m.keys()])].map(k => ({ k, ca: m.get(k)?.ca || 0, mg: m.get(k)?.mg || 0, n1: m1.get(k)?.ca || 0 })).filter(r => r.ca || r.n1).sort((a, b) => b.ca - a.ca);
    const max = Math.max(1, ...rows.map(r => Math.max(r.ca, r.n1)));
    return `<table class="tbl"><thead><tr><th></th><th class="n">CA</th><th class="n">N-1</th><th class="n">Évol.</th><th class="n">Marge</th></tr></thead><tbody>${rows.map(r => `<tr>
      <td><div class="row" style="gap:8px"><span class="dot" style="background:${colorF(r.k)}"></span>${esc(r.k)}</div><div class="bar"><div style="width:${r.ca / max * 100}%;background:${colorF(r.k)}"></div></div></td>
      <td class="n"><b>${eur(r.ca)}</b></td><td class="n muted">${eur(r.n1)}</td><td class="n">${evoTxt(r.ca, r.n1)}</td><td class="n">${eur(r.mg)}<div class="muted small">${r.ca ? pct(r.mg / r.ca * 100) : ''}</div></td></tr>`).join('')}</tbody></table>`;
  };

  main.innerHTML = `<div class="wrap">
    <div class="row wrap-r" style="margin-bottom:12px"><div class="seg">${[['mois', 'Mois'], ['saison', 'Saison hiver'], ['annee', 'Année'], ['12m', '12 mois']].map(([k, l]) => `<button class="${periode === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('')}</div>
      <span class="muted small">${esc(b.lbl)} · comparé à la même période N-1</span></div>
    <div class="grid g4">
      <div class="card kpi"><div class="lbl">Chiffre d'affaires</div><div class="val">${eur(ca)}</div><div class="sub">N-1 ${eur(caN1)} ${evoTxt(ca, caN1)}</div></div>
      <div class="card kpi"><div class="lbl">Marge</div><div class="val">${eur(mg)}</div><div class="sub">N-1 ${eur(mgN1)} ${evoTxt(mg, mgN1)}</div></div>
      <div class="card kpi"><div class="lbl">Taux de marge</div><div class="val">${ca ? pct(mg / ca * 100) : '—'}</div><div class="sub">N-1 ${caN1 ? pct(mgN1 / caN1 * 100) : '—'}</div></div>
      <div class="card kpi"><div class="lbl">Clients actifs</div><div class="val">${byC.size}</div><div class="sub">N-1 ${byC1.size}</div></div>
    </div>

    <div class="card" style="margin-top:14px"><h2>${ic('chart')}CA mensuel ${y} vs ${y - 1} <span class="right muted small">barres = CA · ligne = objectif</span></h2><div class="chart-box tall"><canvas data-c="mois"></canvas></div></div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>${ic('map')}Par zone</h2>${tableAgg(ZONE_NAMES, byZ, byZ1, zoneColor)}</div>
      <div class="card"><h2>${ic('users')}Par type de client</h2>${tableAgg(TYPE_NAMES, byT, byT1, typeColor)}</div>
    </div>

    <div class="card" style="margin-top:14px"><h2>${ic('euro')}CA et marge par client <span class="right muted small">${clientRows.length} clients · touche un en-tête pour trier</span></h2>
      <div class="scroll-x scroll-y"><table class="tbl"><thead><tr><th>Client</th>${[['ca', 'CA'], ['n1', 'N-1'], ['evo', 'Évol.'], ['mg', 'Marge'], ['tm', 'Taux']].map(([k, l]) => `<th class="n" data-sort="${k}">${l}${triClients === k ? ' ▾' : ''}</th>`).join('')}</tr></thead>
      <tbody>${clientRows.slice(0, 300).map(r => { const c = I.byId.get(r.id); return `<tr class="clickable" data-go="${r.id}"><td>${typeDot(c?.typeEtab)} ${esc(clientName(r.id))}<div class="muted small">${esc(c?.ville || '')}</div></td><td class="n"><b>${eur(r.ca)}</b></td><td class="n muted">${eur(r.n1)}</td><td class="n">${evoTxt(r.ca, r.n1)}</td><td class="n">${eur(r.mg)}</td><td class="n">${pct(r.tm)}</td></tr>`; }).join('')}</tbody></table></div></div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>${ic('check')}Objectifs par client <span class="right muted small">mois en cours</span></h2>
        ${objClients.length ? `<div class="scroll-y">${objClients.map(r => `<a class="obj-row" href="#/clients/${r.c.id}"><div class="row"><span class="grow">${esc(r.c.enseigne || r.c.nom)}</span><span class="small">${eur(r.ca)} / ${eur(r.c.objectifMensuel)} · <b>${pct(r.att)}</b></span></div><div class="progress ${r.att >= 100 ? 'ok' : ''}"><div style="width:${Math.min(100, r.att)}%"></div></div></a>`).join('')}</div>`
        : '<div class="empty">Aucun objectif par client. Renseigne « Objectif CA mensuel » dans les fiches.</div>'}</div>
      <div class="card"><h2>${ic('star')}Top 20 produits <span class="right muted small">quantités · tous clients</span></h2>
        ${top.length ? `<div class="scroll-y"><table class="tbl"><thead><tr><th>#</th><th>Produit</th><th class="n">Qté</th><th class="n">CA</th></tr></thead><tbody>${top.map((p, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(p.designation || p.ref)}<div class="muted small">${esc(p.ref)}</div></td><td class="n"><b>${num(p.qte)}</b></td><td class="n">${eur(p.ht)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Pas de ventes</div>'}</div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>${ic('user')}Nouveaux clients <span class="right muted small">objectif ${cfg().objectifNouveaux} / mois</span></h2><div class="chart-box"><canvas data-c="nouveaux"></canvas></div></div>
      <div class="card"><h2>${ic('calendar')}Activité <span class="right muted small">12 semaines</span></h2><div class="chart-box"><canvas data-c="activite"></canvas></div>
        <div class="row wrap-r small" style="margin-top:8px;gap:16px"><span>Visites/jour : <b>${num(act.parJour)}</b></span><span>Visites avec commande : <b>${pct(act.tauxVisiteCommande)}</b></span><span>Clients vus : <b>${act.clientsVus}</b></span><span>Transformation prospects : <b>${act.transfo === null ? '—' : pct(act.transfo)}</b></span></div></div>
    </div>
  </div>`;

  const grey = 'rgba(140,152,165,.45)';
  charts.push(chart($('[data-c="mois"]', main), {
    type: 'bar',
    data: { labels: MOIS, datasets: [
      { label: String(y), data: sN.ca, backgroundColor: '#1B6DB5', borderRadius: 4, order: 2 },
      { label: String(y - 1), data: sN1.ca, backgroundColor: grey, borderRadius: 4, order: 3 },
      { label: 'Marge ' + y, data: sN.mg, type: 'line', borderColor: '#2E8B57', backgroundColor: '#1F7A4C', tension: .3, order: 1 },
      { label: 'Objectif', data: objs, type: 'line', borderColor: '#DD4B3E', borderDash: [6, 4], pointRadius: 0, order: 0, spanGaps: true },
    ] },
    options: { scales: { y: { ticks: { callback: fmtK } } }, plugins: { tooltip: { callbacks: { label: x => x.dataset.label + ' : ' + eur(x.raw) } } } },
  }));
  charts.push(chart($('[data-c="nouveaux"]', main), {
    type: 'bar',
    data: { labels: mois12.map(k => MOIS[+k.slice(5) - 1]), datasets: [
      { label: 'Nouveaux clients', data: nouveaux, backgroundColor: '#1F7A4C', borderRadius: 4 },
      { label: 'Objectif', data: mois12.map(() => cfg().objectifNouveaux), type: 'line', borderColor: '#DD4B3E', borderDash: [6, 4], pointRadius: 0 },
    ] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  }));
  charts.push(chart($('[data-c="activite"]', main), {
    type: 'bar',
    data: { labels: sem.map(l => parseD(l).getDate() + ' ' + MOIS[parseD(l).getMonth()]), datasets: [
      { label: 'Visites', data: visSem, backgroundColor: '#1B6DB5', borderRadius: 4 },
      { label: 'Avec commande', data: cmdSem, backgroundColor: '#1F7A4C', borderRadius: 4 },
    ] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  }));

  $$('[data-p]', main).forEach(x => x.onclick = () => { periode = x.dataset.p; ctx.refresh(); });
  $$('[data-sort]', main).forEach(x => x.onclick = () => { triClients = x.dataset.sort; ctx.refresh(); });
  $$('[data-go]', main).forEach(x => x.onclick = () => { location.hash = '#/clients/' + x.dataset.go; });
}
