// Tous les calculs : CA, marge, objectifs, prime, alertes, top produits, suggestions.
import { S } from './db.js';
import { cfg } from './ref.js';
import { today, addDays, daysBetween, ym, sum, parseD, iso } from './util.js';

let memo = { rev: -1 };
export function idx() {
  if (memo.rev === S.rev) return memo;
  const byId = new Map(S.clients.map(c => [c.id, c]));
  const lastVisit = new Map(), lastOrder = new Map(), firstOrder = new Map();
  const ventesBy = new Map();
  for (const v of S.visites) if (!lastVisit.has(v.clientId) || v.date > lastVisit.get(v.clientId)) lastVisit.set(v.clientId, v.date);
  for (const l of S.ventes) {
    if (!ventesBy.has(l.clientId)) ventesBy.set(l.clientId, []);
    ventesBy.get(l.clientId).push(l);
    if (!lastOrder.has(l.clientId) || l.date > lastOrder.get(l.clientId)) lastOrder.set(l.clientId, l.date);
    if (!firstOrder.has(l.clientId) || l.date < firstOrder.get(l.clientId)) firstOrder.set(l.clientId, l.date);
  }
  const prod = new Map(S.produits.map(p => [p.ref, p]));
  memo = { rev: S.rev, byId, lastVisit, lastOrder, firstOrder, ventesBy, prod };
  return memo;
}

export const client = id => idx().byId.get(id);
export const clientName = id => { const c = client(id); return c ? (c.enseigne || c.nom) : '(client supprimé)'; };
export const clients = () => S.clients.filter(c => c.statut !== 'prospect' && !c.archive);
export const prospects = () => S.clients.filter(c => c.statut === 'prospect' && !c.archive);

export function ventesEntre(from, to, f) {
  return S.ventes.filter(l => l.date >= from && l.date <= to && (!f || f(l)));
}
export const caOf = lines => sum(lines, l => l.ht);
export const margeOf = lines => sum(lines, l => l.marge);

export function monthRange(key) { // '2026-11'
  const [y, m] = key.split('-').map(Number);
  return [`${key}-01`, iso(new Date(y, m, 0))];
}
export const thisMonth = () => ym(today());
export function shiftMonth(key, n) { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return ym(iso(d)); }

// Même période l'an dernier (jusqu'au même jour du mois)
export function moisEnCours() {
  const k = thisMonth(), t = today();
  const [from] = monthRange(k);
  const kPrev = shiftMonth(k, -12);
  const [fromPrev, endPrev] = monthRange(kPrev);
  const toPrev = (kPrev + t.slice(7)) > endPrev ? endPrev : kPrev + t.slice(7);
  const cur = ventesEntre(from, t), prev = ventesEntre(fromPrev, toPrev), prevFull = ventesEntre(fromPrev, endPrev);
  return { key: k, ca: caOf(cur), marge: margeOf(cur), caN1: caOf(prev), caN1Mois: caOf(prevFull), lines: cur };
}

export function serieMensuelle(year, f) {
  const ca = Array(12).fill(0), mg = Array(12).fill(0);
  for (const l of S.ventes) {
    if (!l.date.startsWith(String(year))) continue;
    if (f && !f(l)) continue;
    const m = +l.date.slice(5, 7) - 1;
    ca[m] += l.ht || 0; mg[m] += l.marge || 0;
  }
  return { ca, mg };
}

export function objectifMois(key = thisMonth()) {
  const c = cfg();
  if (c.objectifs[key]) return c.objectifs[key];
  // À défaut : somme des objectifs mensuels par client
  return sum(clients(), x => x.objectifMensuel || 0);
}

export function prime(key = thisMonth()) {
  const c = cfg();
  const [from, to] = monthRange(key);
  const lines = ventesEntre(from, to);
  const ca = caOf(lines), marge = margeOf(lines);
  const obj = objectifMois(key);
  const atteinte = obj ? ca / obj * 100 : 0;
  const base = c.prime.base === 'marge' ? marge : ca;
  let fixe = 0;
  for (const p of (c.prime.paliers || []).slice().sort((a, b) => a.seuil - b.seuil)) if (obj && atteinte >= p.seuil) fixe = +p.montant || 0;
  const variable = base * (+c.prime.taux || 0) / 100;
  // Palier suivant
  const next = (c.prime.paliers || []).slice().sort((a, b) => a.seuil - b.seuil).find(p => atteinte < p.seuil && +p.montant > fixe);
  return { ca, marge, obj, atteinte, fixe, variable, total: fixe + variable, next, manque: next && obj ? obj * next.seuil / 100 - ca : 0 };
}

export function nouveauxClients(key = thisMonth()) {
  return clients().filter(c => (c.depuis || '').startsWith(key));
}

export function freqOf(c) { return +c.frequence || cfg().frequenceDefaut; }
export function prochaineVisite(c) {
  const lv = idx().lastVisit.get(c.id);
  return lv ? addDays(lv, freqOf(c)) : null;
}
export function retard(c, date = today()) { // jours de retard (>0 = en retard)
  const nv = prochaineVisite(c);
  return nv ? daysBetween(nv, date) : 999;
}

export function topProduits({ clientId, months = 12, by = 'qte', limit = 20, f } = {}) {
  const from = addDays(today(), -months * 30.4);
  const m = new Map();
  const src = clientId ? (idx().ventesBy.get(clientId) || []) : S.ventes;
  for (const l of src) {
    if (l.date < from) continue;
    if (f && !f(l)) continue;
    if (!m.has(l.ref)) m.set(l.ref, { ref: l.ref, designation: l.designation, qte: 0, ht: 0, marge: 0, n: 0, last: l.date });
    const o = m.get(l.ref);
    o.qte += +l.qte || 0; o.ht += +l.ht || 0; o.marge += +l.marge || 0; o.n++;
    if (l.date > o.last) o.last = l.date;
    if (!o.designation && l.designation) o.designation = l.designation;
  }
  const key = by === 'ca' ? 'ht' : by;
  return [...m.values()].sort((a, b) => b[key] - a[key]).slice(0, limit);
}

// Produits pris par les clients du même type, que ce client ne prend pas
export function suggestions(clientId, limit = 12) {
  const c = client(clientId); if (!c) return [];
  const from = addDays(today(), -365);
  const pairs = clients().filter(x => x.id !== c.id && x.typeEtab === c.typeEtab);
  if (!pairs.length) return [];
  const mine = new Set((idx().ventesBy.get(c.id) || []).filter(l => l.date >= from).map(l => l.ref));
  const pen = new Map();
  for (const p of pairs) {
    const refs = new Set((idx().ventesBy.get(p.id) || []).filter(l => l.date >= from).map(l => l.ref));
    for (const r of refs) if (!mine.has(r)) pen.set(r, (pen.get(r) || 0) + 1);
  }
  const P = idx().prod;
  return [...pen.entries()].map(([ref, n]) => ({ ref, designation: (P.get(ref) || {}).designation || ref, taux: n / pairs.length * 100, n }))
    .filter(x => x.taux >= 25).sort((a, b) => b.taux - a.taux).slice(0, limit);
}

// Produits que le client prenait régulièrement et qu'il ne prend plus
export function produitsArretes(clientId) {
  const lines = idx().ventesBy.get(clientId) || [];
  const t = today(), recent = addDays(t, -60), from = addDays(t, -240);
  const m = new Map();
  for (const l of lines) {
    if (l.date < from) continue;
    if (!m.has(l.ref)) m.set(l.ref, { ref: l.ref, designation: l.designation, avant: 0, recent: 0, last: l.date });
    const o = m.get(l.ref);
    if (l.date >= recent) o.recent++; else o.avant++;
    if (l.date > o.last) o.last = l.date;
  }
  return [...m.values()].filter(o => o.avant >= 3 && o.recent === 0).sort((a, b) => b.avant - a.avant);
}

export function nouveautes() { return S.produits.filter(p => p.nouveaute || p.promo); }

export function evolutionClient(clientId) {
  const t = today();
  const lines = idx().ventesBy.get(clientId) || [];
  const a = addDays(t, -90), b = addDays(t, -365), c2 = addDays(t, -455);
  const r3 = caOf(lines.filter(l => l.date > a));
  const r3n1 = caOf(lines.filter(l => l.date > c2 && l.date <= b));
  const r12 = caOf(lines.filter(l => l.date > b));
  return { r3, r3n1, r12, evo: r3n1 ? (r3 - r3n1) / r3n1 * 100 : null };
}

export function alertes() {
  const c = cfg(), t = today(), I = idx();
  const out = [];
  for (const x of clients()) {
    if (x.situation === 'Fermé définitivement' || x.situation === 'Liquidation judiciaire') continue;
    const lv = I.lastVisit.get(x.id);
    const sinceV = lv ? daysBetween(lv, t) : null;
    // Pas d'alerte « pas vu » pendant une fermeture (saison, congés)
    const md = t.slice(5);
    const ferme = (x.periodesFermeture || []).some(p => p.du && p.au && (p.annuel ? (p.du.slice(5) <= p.au.slice(5) ? md >= p.du.slice(5) && md <= p.au.slice(5) : md >= p.du.slice(5) || md <= p.au.slice(5)) : t >= p.du && t <= p.au));
    if (!ferme && sinceV !== null && sinceV > c.alerteSansVisite) out.push({ id: x.id, niveau: 'amber', type: 'visite', txt: `Pas vu depuis ${sinceV} jours`, score: sinceV });
    if (x.finContrat) {
      const d = daysBetween(t, x.finContrat);
      if (d >= 0 && d <= c.alerteFinContrat) out.push({ id: x.id, niveau: 'blue', type: 'contrat', txt: `Fin de contrat ${d === 0 ? "aujourd'hui" : 'dans ' + d + ' j'}`, score: 100 - d });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function rappelsDus(date = today()) {
  return S.rappels.filter(r => !r.fait && r.date <= date).sort((a, b) => a.date.localeCompare(b.date));
}

export function activite(jours = 28) {
  const t = today(), from = addDays(t, -jours);
  const vis = S.visites.filter(v => v.date > from && v.date <= t);
  const joursTravailles = new Set(vis.map(v => v.date)).size || 1;
  const avecCmd = vis.filter(v => v.resultat === 'Commande prise').length;
  const won = S.clients.filter(c => c.etape === 'Gagné').length, lost = S.clients.filter(c => c.etape === 'Perdu').length;
  return {
    visites: vis.length, parJour: vis.length / joursTravailles, joursTravailles,
    commandes: avecCmd, clientsVus: new Set(vis.map(v => v.clientId)).size,
    tauxVisiteCommande: vis.length ? vis.filter(v => v.resultat === 'Commande prise').length / vis.length * 100 : 0,
    transfo: won + lost ? won / (won + lost) * 100 : null, won, lost,
  };
}

export function semaine(dateStr = today()) {
  const d = parseD(dateStr); const dow = (d.getDay() + 6) % 7;
  const lundi = addDays(dateStr, -dow);
  return { lundi, dimanche: addDays(lundi, 6) };
}
