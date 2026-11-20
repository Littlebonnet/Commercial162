// Géocodage, temps de trajet et optimisation de tournée avec créneaux horaires.
import { S, kv, setKV } from './db.js';
import { cfg, TYPES, situationOf } from './ref.js';
import { haversine, hm2min, today, parseD, daysBetween } from './util.js';
import { idx, freqOf, retard, clients, rappelsDus } from './metrics.js';

// ---------- Géocodage (API Adresse de l'État, gratuite) ----------
export async function geocode(q, citycode) {
  const url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(q) + (citycode ? '&postcode=' + citycode : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Géocodage indisponible');
  const j = await r.json();
  const f = j.features && j.features[0];
  if (!f) return null;
  return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], score: f.properties.score, label: f.properties.label };
}
export async function suggestAdresses(q) {
  if (q.length < 4) return [];
  const r = await fetch('https://api-adresse.data.gouv.fr/search/?limit=5&autocomplete=1&q=' + encodeURIComponent(q));
  const j = await r.json();
  return (j.features || []).map(f => ({ label: f.properties.label, adresse: f.properties.name, cp: f.properties.postcode, ville: f.properties.city, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
}

// ---------- Matrice des temps de trajet ----------
// En ligne : serveur OSRM (routes réelles, gratuit). Hors ligne : distance à vol d'oiseau × facteur de route.
function estime(a, b) {
  const c = cfg();
  const km = haversine(a, b) * c.facteurRoute;
  const montagne = Math.abs((a.lat - b.lat)) > 0.02 ? 1.1 : 1;
  return { min: km / c.vitesseKmh * 60 * montagne + (km > 0.2 ? 2 : 0), km };
}
export async function matrice(points) {
  const n = points.length;
  const key = points.map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join('|');
  // Cache des dernières matrices (mémoire + appareil) : la tournée se recalcule hors ligne
  const cache = kv('matCache2', []);
  const hit = cache.find(e => e.key === key);
  if (hit) return copyM(hit.m);
  if (navigator.onLine && n <= 90) {
    try {
      const coords = points.map(p => p.lng + ',' + p.lat).join(';');
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`, { signal: ctl.signal });
      clearTimeout(to);
      const j = await r.json();
      if (j.code === 'Ok') {
        const m = { min: j.durations.map(row => row.map(s => s / 60 * 1.12)), km: j.distances.map(row => row.map(d => d / 1000)), source: 'osrm' };
        setKV('matCache2', [{ key, m }, ...cache.filter(e => e.key !== key)].slice(0, 12));
        return copyM(m);
      }
    } catch (e) { /* hors ligne ou serveur occupé : estimation */ }
  }
  const min = [], km = [];
  for (let i = 0; i < n; i++) { min.push([]); km.push([]); for (let j = 0; j < n; j++) { const e = i === j ? { min: 0, km: 0 } : estime(points[i], points[j]); min[i].push(e.min); km[i].push(e.km); } }
  return { min, km, source: 'estimation' };
}

const copyM = m => ({ min: m.min.map(r => r.slice()), km: m.km.map(r => r.slice()), source: m.source });

export async function traceRoute(points) {
  if (!navigator.onLine || points.length < 2) return null;
  try {
    const coords = points.map(p => p.lng + ',' + p.lat).join(';');
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const j = await r.json();
    if (j.code === 'Ok') return j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch (e) { }
  return null;
}

// ---------- Paramètres de visite ----------
export function dureeVisite(c) {
  return +c.duree || +cfg().dureeDefaut || 30;
}
// Créneaux du client ; s'il n'en a pas, il peut être vu à toute heure de la journée de travail
export function creneaux(c) {
  const conf = cfg();
  const src = c.creneaux && c.creneaux.length ? c.creneaux : [[conf.heureDebut, conf.heureFin]];
  return src.map(([a, b]) => [hm2min(a), hm2min(b)]).filter(([a, b]) => a != null && b != null && b > a).sort((x, y) => x[0] - y[0]);
}
// Fermé ce jour-là : jour de fermeture hebdomadaire ou mois de fermeture (saisonniers)
export function fermeLe(c, dateStr) {
  const d = parseD(dateStr);
  return (c.fermeture || []).map(Number).includes(d.getDay()) || (c.moisFermes || []).map(Number).includes(d.getMonth() + 1) || !!periodeFermee(c, dateStr);
}
// Période de fermeture en cours (du … au …, éventuellement « chaque année »)
export function periodeFermee(c, dateStr) {
  const md = dateStr.slice(5);
  for (const p of c.periodesFermeture || []) {
    if (!p.du || !p.au) continue;
    if (p.annuel) {
      const a = p.du.slice(5), b = p.au.slice(5);
      if (a <= b ? (md >= a && md <= b) : (md >= a || md <= b)) return p;
    } else if (dateStr >= p.du && dateStr <= p.au) return p;
  }
  return null;
}

// ---------- Planification d'une séquence ----------
// Calcule heures d'arrivée, attentes, pause déjeuner et pénalités de créneau.
export function planifier(order, M, stops, opt) {
  const { debut, fin, pauseDebut, pauseFin, pauseDuree, retour } = opt;
  let t = debut, prev = 0, wait = 0, late = 0, travel = 0, km = 0, lunch = null;
  const rows = [];
  const takeLunch = () => { if (!lunch && t >= pauseDebut && t <= pauseFin + 90) { lunch = { start: t, end: t + pauseDuree }; t += pauseDuree; } };
  for (const k of order) {
    const s = stops[k];
    const tr = M.min[prev][s.mi];
    travel += tr; km += M.km[prev][s.mi];
    takeLunch();
    t += tr;
    let arr = t;
    // Créneau compatible : on attend l'ouverture si besoin
    let start = arr, win = null;
    for (const w of s.win) {
      if (arr <= w[1] - s.duree) { win = w; start = Math.max(arr, w[0]); break; }
    }
    if (!win) { late += (arr - (s.win.length ? s.win[s.win.length - 1][1] : arr)) + 60; start = arr; }
    // Si on attend longtemps pendant l'heure du déjeuner, on y place la pause
    if (!lunch && start - arr >= 30 && arr < pauseFin && start > pauseDebut) {
      const ls = Math.max(arr, pauseDebut);
      lunch = { start: ls, end: ls + pauseDuree };
      if (lunch.end > start) start = Math.max(start, lunch.end);
    }
    // La pause déjeuner prise pendant l'attente ne compte pas comme de l'attente
    const overlap = lunch ? Math.max(0, Math.min(start, lunch.end) - Math.max(arr, lunch.start)) : 0;
    wait += start - arr - overlap;
    t = start + s.duree;
    rows.push({ k, arr, start, end: t, trajet: tr, kmIn: M.km[prev][s.mi], hors: !win });
    prev = s.mi;
  }
  let retourMin = 0;
  if (retour && order.length) { retourMin = M.min[prev][0]; travel += retourMin; km += M.km[prev][0]; t += retourMin; }
  const over = Math.max(0, t - fin);
  return { rows, travel, km, wait, late, over, finTour: t, lunch, retourMin, cost: travel + wait * 0.35 + late * 25 + over * 8 };
}

// ---------- Optimisation : plusieurs départs + recherche locale + recuit simulé ----------
export function optimiser(stops, M, opt, locked, rapide = false) {
  const n = stops.length;
  if (n <= 1) return [...Array(n).keys()];
  if (locked) return locked;
  const evalO = o => planifier(o, M, stops, opt).cost;
  const starts = [];
  // 1) Plus proche voisin
  {
    const left = new Set(stops.keys()); const o = []; let cur = 0;
    while (left.size) { let best = null, bd = Infinity; for (const k of left) { const d = M.min[cur][stops[k].mi]; if (d < bd) { bd = d; best = k; } } o.push(best); left.delete(best); cur = stops[best].mi; }
    starts.push(o);
  }
  // 2) Tri par début de créneau puis distance
  starts.push([...stops.keys()].sort((a, b) => (stops[a].win[0]?.[0] ?? 0) - (stops[b].win[0]?.[0] ?? 0) || M.min[0][stops[a].mi] - M.min[0][stops[b].mi]));
  // 3) Le plus loin d'abord (aller loin le matin, revenir vers la maison)
  starts.push([...stops.keys()].sort((a, b) => M.min[0][stops[b].mi] - M.min[0][stops[a].mi]));
  // 4) Insertion la moins coûteuse
  {
    let o = [];
    for (const k of [...stops.keys()].sort((a, b) => M.min[0][stops[b].mi] - M.min[0][stops[a].mi])) {
      let best = null, bc = Infinity;
      for (let i = 0; i <= o.length; i++) { const t = [...o.slice(0, i), k, ...o.slice(i)]; const c = evalO(t); if (c < bc) { bc = c; best = t; } }
      o = best;
    }
    starts.push(o);
  }
  let bestO = null, bestC = Infinity;
  if (rapide) {
    for (const s of starts) { const c = evalO(s); if (c < bestC) { bestC = c; bestO = s; } }
    return localSearch(bestO, evalO);
  }
  const budget = Math.min(60000, 1500 * n * n);
  for (const s of starts) {
    let o = localSearch(s, evalO);
    o = anneal(o, evalO, Math.floor(budget / starts.length));
    o = localSearch(o, evalO);
    const c = evalO(o);
    if (c < bestC) { bestC = c; bestO = o; }
  }
  return bestO;
}
function localSearch(o, evalO) {
  let best = o.slice(), bc = evalO(best), improved = true;
  while (improved) {
    improved = false;
    const n = best.length;
    // 2-opt
    for (let i = 0; i < n - 1 && !improved; i++) for (let j = i + 1; j < n && !improved; j++) {
      const t = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
      const c = evalO(t); if (c < bc - 1e-6) { best = t; bc = c; improved = true; }
    }
    // Déplacement d'un arrêt (or-opt)
    for (let i = 0; i < n && !improved; i++) for (let j = 0; j < n && !improved; j++) {
      if (i === j) continue;
      const t = best.slice(); const [x] = t.splice(i, 1); t.splice(j, 0, x);
      const c = evalO(t); if (c < bc - 1e-6) { best = t; bc = c; improved = true; }
    }
  }
  return best;
}
function anneal(o, evalO, iters) {
  let cur = o.slice(), cc = evalO(cur), best = cur.slice(), bc = cc;
  const n = cur.length; if (n < 3) return cur;
  let T = Math.max(5, cc * 0.05);
  const cool = Math.pow(0.01 / T, 1 / Math.max(1, iters));
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let it = 0; it < iters; it++) {
    const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); if (i === j) continue;
    const t = cur.slice();
    const mv = rnd();
    if (mv < 0.4) { const [a, b] = i < j ? [i, j] : [j, i]; t.splice(a, b - a + 1, ...t.slice(a, b + 1).reverse()); }
    else if (mv < 0.8) { const [x] = t.splice(i, 1); t.splice(j, 0, x); }
    else { [t[i], t[j]] = [t[j], t[i]]; }
    const c = evalO(t);
    if (c < cc || rnd() < Math.exp((cc - c) / T)) { cur = t; cc = c; if (c < bc) { best = t.slice(); bc = c; } }
    T *= cool;
  }
  return best;
}

// ---------- Choix des clients à voir ----------
// Score : retard sur la fréquence, rappels dus, zone du jour, alertes, prospects en cours.
export function candidats(dateStr) {
  const c = cfg();
  const dow = parseD(dateStr).getDay();
  const zones = new Set(c.joursZones[dow] || []);
  const rap = new Set(rappelsDus(dateStr).map(r => r.clientId));
  const I = idx();
  const out = [];
  for (const x of S.clients) {
    if (x.archive || x.lat == null) continue;
    if (fermeLe(x, dateStr)) continue;
    if (x.statut === 'prospect' && ['Gagné', 'Perdu'].includes(x.etape)) continue;
    if (situationOf(x).exclu) continue;
    // Jour de visite fixé sur la fiche : il prime sur la zone du jour
    const jourFixe = x.jourVisite ? +x.jourVisite : null;
    const inZone = jourFixe ? jourFixe === dow : zones.has(x.zone);
    const r = x.statut === 'prospect' ? (x.prochainContact && x.prochainContact <= dateStr ? 10 : -5) : retard(x, dateStr);
    let score = 0; const why = [];
    if (inZone) { score += jourFixe ? 45 : 30; why.push(jourFixe ? 'son jour de visite' : 'zone du jour'); }
    if (r >= 0 && x.statut !== 'prospect') { score += 40 + Math.min(r, 60); why.push(r >= 999 ? 'jamais visité' : r === 0 ? 'visite due' : `en retard de ${r} j`); }
    else if (r > -4 && x.statut !== 'prospect') { score += 15; why.push('bientôt dû'); }
    if (rap.has(x.id)) { score += 60; why.push('rappel'); }
    if (x.statut === 'prospect') { score += r > 0 ? 35 : 5; why.push('prospect'); }
    const lv = I.lastVisit.get(x.id);
    if (lv === dateStr) continue;
    if (!inZone && !rap.has(x.id)) score -= 45;
    out.push({ c: x, score, why });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Sélection automatique : on ajoute les meilleurs candidats tant que la journée tient.
export async function proposer(dateStr) {
  const c = cfg();
  const cands = candidats(dateStr).filter(x => x.score >= 40);
  const chosen = [];
  const max = c.maxVisites;
  let pool = cands.slice(0, 45);
  if (!pool.length) return [];
  const home = c.maison;
  const pts = [home, ...pool.map(p => p.c)];
  const M = await matrice(pts);
  const opt = optionsJour(c);
  const toStops = list => list.map(p => ({ c: p.c, mi: pts.indexOf(p.c), duree: dureeVisite(p.c), win: creneaux(p.c) }));
  for (const p of pool) {
    if (chosen.length >= max) break;
    const trial = [...chosen, p];
    const stops = toStops(trial);
    const o = optimiser(stops, M, opt, null, true);
    const plan = planifier(o, M, stops, opt);
    if (plan.over <= 0 && plan.late === 0) chosen.push(p);
  }
  return chosen.map(p => p.c.id);
}

export function optionsJour(c = cfg()) {
  return {
    debut: hm2min(c.heureDebut), fin: hm2min(c.heureFin),
    pauseDebut: hm2min(c.pause.debut), pauseFin: hm2min(c.pause.fin), pauseDuree: +c.pause.duree || 60,
    retour: true,
  };
}

// Calcule la tournée complète d'un jour (ids → ordre optimisé + horaires)
export async function calculerTournee(ids, { verrouille = false, depart = null, heureDepart = null } = {}) {
  const c = cfg();
  const list = ids.map(id => S.clients.find(x => x.id === id)).filter(x => x && x.lat != null);
  const start = depart || c.maison;
  const pts = [start, ...list];
  if (depart) pts.push(c.maison);
  const M = await matrice(pts);
  if (depart) { // retour vers la maison et non vers le point de départ
    const h = pts.length - 1;
    for (let i = 0; i < pts.length; i++) { M.min[i][0] = M.min[i][h]; M.km[i][0] = M.km[i][h]; }
  }
  const stops = list.map((x, i) => ({ c: x, mi: i + 1, duree: dureeVisite(x), win: creneaux(x) }));
  const opt = optionsJour(c);
  if (heureDepart != null) opt.debut = heureDepart;
  const order = optimiser(stops, M, opt, verrouille ? stops.map((_, i) => i) : null);
  const plan = planifier(order, M, stops, opt);
  return { order: order.map(k => stops[k].c.id), plan, stops, M, source: M.source, opt };
}

// Liens de navigation
export const wazeUrl = c => `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;
export const plansUrl = c => `https://maps.apple.com/?daddr=${c.lat},${c.lng}&dirflg=d`;
export const gmapsUrl = c => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
