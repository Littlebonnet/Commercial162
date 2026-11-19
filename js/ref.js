import { kv, setKV } from './db.js';
import { norm } from './util.js';

// Types d'établissement : couleur sur la carte, durée de visite et créneaux par défaut
// (les créneaux évitent les heures de service ; tout est modifiable dans Réglages et sur chaque fiche).
export const TYPES = {
  'Restaurant':      { color: '#DD4B3E', duree: 30, creneaux: [['09:00', '11:30'], ['14:30', '17:30']] },
  'Hôtel':           { color: '#1B6DB5', duree: 40, creneaux: [['09:30', '11:45'], ['14:00', '18:00']] },
  'Camping':         { color: '#2E8B57', duree: 30, creneaux: [['09:00', '12:00'], ['14:00', '18:00']] },
  'Café / bar':      { color: '#8E5AC8', duree: 20, creneaux: [['08:00', '11:30'], ['14:00', '17:30']] },
  'Boulangerie':     { color: '#C9A27A', duree: 20, creneaux: [['08:30', '11:00'], ['14:00', '16:30']] },
  'Glacier':         { color: '#E05A9A', duree: 30, creneaux: [['09:00', '11:30'], ['14:00', '17:00']] },
  'Plage / snack':   { color: '#F2A93B', duree: 20, creneaux: [['09:00', '11:00'], ['15:00', '17:30']] },
  'Station de ski':  { color: '#16A3B5', duree: 45, creneaux: [['08:30', '11:30'], ['14:30', '17:30']] },
  'Collectivité':    { color: '#5E6E7B', duree: 40, creneaux: [['08:30', '11:00'], ['13:30', '16:30']] },
  'GMS / supérette': { color: '#6B8E23', duree: 30, creneaux: [['08:00', '12:00'], ['14:00', '18:00']] },
  'Autre':           { color: '#7A7A7A', duree: 30, creneaux: [['08:30', '12:00'], ['14:00', '18:00']] },
};
export const TYPE_NAMES = Object.keys(TYPES);
export function typeOf(name) {
  if (TYPES[name]) return name;
  const n = norm(name);
  const rules = [['resto', 'Restaurant'], ['restaur', 'Restaurant'], ['brasserie', 'Restaurant'], ['pizz', 'Restaurant'], ['hotel', 'Hôtel'], ['camping', 'Camping'],
    ['cafe', 'Café / bar'], ['bar', 'Café / bar'], ['boulan', 'Boulangerie'], ['patiss', 'Boulangerie'], ['glac', 'Glacier'], ['plage', 'Plage / snack'], ['snack', 'Plage / snack'],
    ['ski', 'Station de ski'], ['station', 'Station de ski'], ['altitude', 'Station de ski'], ['cantine', 'Collectivité'], ['collect', 'Collectivité'], ['ehpad', 'Collectivité'], ['ecole', 'Collectivité'],
    ['gms', 'GMS / supérette'], ['super', 'GMS / supérette'], ['epicerie', 'GMS / supérette'], ['carrefour', 'GMS / supérette'], ['spar', 'GMS / supérette'], ['sherpa', 'GMS / supérette']];
  for (const [k, v] of rules) if (n.includes(k)) return v;
  return 'Autre';
}
export const typeColor = t => (TYPES[t] || TYPES.Autre).color;

// Les 36 communes de ta carte (nombre d'adresses), avec un centre approximatif et une zone de tournée.
export const ZONES = {
  'Rive droite':      { color: '#1B6DB5', label: 'Grésivaudan rive droite (Montbonnot → Chapareillan)' },
  'Rive gauche':      { color: '#2E8B57', label: 'Grésivaudan rive gauche + Combe de Savoie (Domène → Pontcharra)' },
  'Allevard':         { color: '#C27C0E', label: 'Allevard, Crêts en Belledonne, Le Haut-Bréda (7 Laux, Collet)' },
  'Méribel':          { color: '#DD4B3E', label: 'Les Allues · Méribel' },
  'Grenoble & loin':  { color: '#5E6E7B', label: 'Grenoble, Fontaine, St-Martin-le-Vinoux, Tullins, Valence, Cheyssieu' },
};
export const ZONE_NAMES = Object.keys(ZONES);
export const COMMUNES = [
  ['Les Allues', 73550, 45.432, 6.556, 41, 'Méribel'],
  ['Allevard', 38580, 45.394, 6.075, 28, 'Allevard'],
  ['Le Haut-Bréda', 38580, 45.317, 6.098, 19, 'Allevard'],
  ['Crolles', 38920, 45.284, 5.881, 11, 'Rive droite'],
  ['Le Versoud', 38420, 45.219, 5.862, 10, 'Rive gauche'],
  ['Le Touvet', 38660, 45.358, 5.951, 9, 'Rive droite'],
  ['Plateau-des-Petites-Roches', 38660, 45.313, 5.888, 8, 'Rive droite'],
  ['Villard-Bonnot', 38190, 45.243, 5.890, 7, 'Rive gauche'],
  ['La Terrasse', 38660, 45.324, 5.928, 6, 'Rive droite'],
  ['Domène', 38420, 45.203, 5.839, 6, 'Rive gauche'],
  ['Pontcharra', 38530, 45.434, 6.018, 5, 'Rive gauche'],
  ['Bernin', 38190, 45.268, 5.865, 5, 'Rive droite'],
  ['Chapareillan', 38530, 45.466, 5.993, 4, 'Rive droite'],
  ['Saint-Vincent-de-Mercuze', 38660, 45.372, 5.955, 4, 'Rive droite'],
  ['Crêts en Belledonne', 38830, 45.370, 6.040, 4, 'Allevard'],
  ['Lumbin', 38660, 45.307, 5.913, 4, 'Rive droite'],
  ['Saint-Ismier', 38330, 45.250, 5.829, 4, 'Rive droite'],
  ['Montbonnot-Saint-Martin', 38330, 45.225, 5.803, 4, 'Rive droite'],
  ['Froges', 38190, 45.273, 5.920, 3, 'Rive gauche'],
  ['Porte-de-Savoie', 73800, 45.505, 6.017, 2, 'Rive gauche'],
  ['Les Mollettes', 73800, 45.470, 6.052, 2, 'Rive gauche'],
  ['Barraux', 38530, 45.432, 5.982, 2, 'Rive droite'],
  ['Tencin', 38570, 45.311, 5.958, 2, 'Rive gauche'],
  ['Biviers', 38330, 45.234, 5.801, 2, 'Rive droite'],
  ['Grenoble', 38000, 45.188, 5.724, 2, 'Grenoble & loin'],
  ['Sainte-Hélène-du-Lac', 73800, 45.483, 6.063, 1, 'Rive gauche'],
  ['La Flachère', 38530, 45.401, 5.976, 1, 'Rive droite'],
  ["Sainte-Marie-d'Alloix", 38660, 45.385, 5.970, 1, 'Rive droite'],
  ['Le Cheylas', 38570, 45.371, 5.995, 1, 'Rive gauche'],
  ['Goncelin', 38570, 45.343, 5.978, 1, 'Rive gauche'],
  ['Le Champ-près-Froges', 38190, 45.282, 5.940, 1, 'Rive gauche'],
  ['Saint-Martin-le-Vinoux', 38950, 45.203, 5.716, 1, 'Grenoble & loin'],
  ['Fontaine', 38600, 45.193, 5.686, 1, 'Grenoble & loin'],
  ['Valence', 26000, 44.933, 4.892, 1, 'Grenoble & loin'],
  ['Tullins', 38210, 45.300, 5.486, 1, 'Grenoble & loin'],
  ['Cheyssieu', 38550, 45.427, 4.842, 1, 'Grenoble & loin'],
].map(([nom, cp, lat, lng, n, zone]) => ({ nom, cp, lat, lng, n, zone }));

// Anciennes communes / lieux-dits regroupés sur la commune actuelle
const ALIAS = {
  'meribel': 'Les Allues', 'meribel mottaret': 'Les Allues', 'mottaret': 'Les Allues',
  'pinsot': 'Le Haut-Bréda', 'la ferriere': 'Le Haut-Bréda', 'fond de france': 'Le Haut-Bréda', 'le pleynet': 'Le Haut-Bréda', 'les 7 laux': 'Le Haut-Bréda',
  'saint-pierre-d\'allevard': 'Crêts en Belledonne', 'st pierre d allevard': 'Crêts en Belledonne', 'moretel-de-mailles': 'Crêts en Belledonne',
  'saint-hilaire': 'Plateau-des-Petites-Roches', 'saint-hilaire-du-touvet': 'Plateau-des-Petites-Roches', 'saint-bernard': 'Plateau-des-Petites-Roches', 'saint-pancrasse': 'Plateau-des-Petites-Roches',
  'les marches': 'Porte-de-Savoie', 'francin': 'Porte-de-Savoie', 'montbonnot': 'Montbonnot-Saint-Martin', 'brignoud': 'Villard-Bonnot', 'lancey': 'Villard-Bonnot',
  'le collet d\'allevard': 'Allevard', 'le collet': 'Allevard', 'collet d\'allevard': 'Allevard', 'allevard les bains': 'Allevard',
  'haut breda': 'Le Haut-Bréda', 'pleynet': 'Le Haut-Bréda', 'la ferriere d\'allevard': 'Le Haut-Bréda', 'les sept laux': 'Le Haut-Bréda',
  'moretel de maille': 'Crêts en Belledonne', 'moretel': 'Crêts en Belledonne',
  'la terasse': 'La Terrasse', 'saint helene du lac': 'Sainte-Hélène-du-Lac', 'champ pres froges': 'Le Champ-près-Froges',
};
// Clé de comparaison : sans accents, tirets, chiffres (« MERIBEL 1600 »), articles en double espaces…
const keyC = s => norm(s).replace(/[-'’]/g, ' ').replace(/\d+/g, ' ').replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte').replace(/\s+/g, ' ').trim();
const CMAP = new Map(COMMUNES.map(c => [keyC(c.nom), c]));
for (const [a, n] of Object.entries(ALIAS)) CMAP.set(keyC(a), CMAP.get(keyC(n)));
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const cacheC = new Map();
export function findCommune(ville) {
  const k = keyC(ville);
  if (!k) return null;
  if (cacheC.has(k)) return cacheC.get(k);
  let c = CMAP.get(k) || null;
  // Méribel, Mottaret, Méribel-Village, Altiport… → Les Allues
  if (!c && /^meribel\b|\bmottaret\b|\ballues\b/.test(k)) c = CMAP.get('les allues');
  // Sans l'article (« COLLET D ALLEVARD » / « LE COLLET D ALLEVARD »), puis faute de frappe légère
  if (!c) { const sa = k.replace(/^(le|la|les|l) /, ''); for (const [kk, v] of CMAP) if (kk.replace(/^(le|la|les|l) /, '') === sa) { c = v; break; } }
  if (!c && k.length >= 6) { let best = 3; for (const [kk, v] of CMAP) { const d = lev(k, kk); if (d < best) { best = d; c = v; } } }
  cacheC.set(k, c);
  return c;
}
// Commune connue la plus proche (pour une commune hors liste, ex. Apremont ou Myans)
export function nearestCommune(lat, lng, maxKm = 20) {
  let best = null, bd = Infinity;
  for (const c of COMMUNES) { const d = Math.hypot((c.lat - lat) * 111, (c.lng - lng) * 78); if (d < bd) { bd = d; best = c; } }
  return bd <= maxKm ? best : null;
}
export function zoneOf(ville, lat, lng) {
  const c = findCommune(ville) || (lat != null ? nearestCommune(lat, lng) : null);
  return c ? c.zone : 'Grenoble & loin';
}
export const zoneColor = z => (ZONES[z] || { color: '#7A7A7A' }).color;

export const ETAPES = ['À contacter', 'RDV pris', 'Devis envoyé', 'Gagné', 'Perdu'];
export const RESULTATS = ['Commande prise', 'RAS', 'À rappeler', 'Absent', 'Problème', 'Prospection'];

// Réglages par défaut (modifiables dans Plus → Réglages)
export const DEFAULT_CFG = {
  nom: '', email: '', telephone: '',
  maison: { adresse: '', lat: 45.2846, lng: 5.8833 }, // Crolles par défaut, à remplacer par ton adresse
  heureDebut: '08:00', heureFin: '18:30',
  pause: { debut: '12:00', fin: '13:00', duree: 60 },
  maxVisites: 14,
  // Zones fixes par jour (1 = lundi … 5 = vendredi). Pensé pour l'hiver : Méribel le jeudi.
  joursZones: { 1: ['Rive droite'], 2: ['Rive gauche'], 3: ['Allevard'], 4: ['Méribel'], 5: ['Grenoble & loin', 'Rive droite'] },
  frequenceDefaut: 14,
  alerteSansVisite: 30,
  alerteSansCommande: 45,
  alerteBaisse: 30,
  alerteFinContrat: 30,
  dureesType: Object.fromEntries(TYPE_NAMES.map(t => [t, TYPES[t].duree])),
  creneauxType: Object.fromEntries(TYPE_NAMES.map(t => [t, TYPES[t].creneaux])),
  objectifs: {}, // { '2026-12': 45000 }
  objectifNouveaux: 2, // nouveaux clients par mois
  prime: { base: 'ca', taux: 0, paliers: [{ seuil: 100, montant: 0 }] },
  tva: 5.5,
  theme: 'auto',
  vitesseKmh: 45, // utilisé hors connexion pour estimer les trajets
  facteurRoute: 1.4,
  demo: false,
};

export function cfg() {
  const c = kv('cfg', {});
  return {
    ...DEFAULT_CFG, ...c,
    pause: { ...DEFAULT_CFG.pause, ...(c.pause || {}) },
    maison: { ...DEFAULT_CFG.maison, ...(c.maison || {}) },
    dureesType: { ...DEFAULT_CFG.dureesType, ...(c.dureesType || {}) },
    creneauxType: { ...DEFAULT_CFG.creneauxType, ...(c.creneauxType || {}) },
    joursZones: { ...DEFAULT_CFG.joursZones, ...(c.joursZones || {}) },
    prime: { ...DEFAULT_CFG.prime, ...(c.prime || {}) },
    objectifs: { ...(c.objectifs || {}) },
  };
}
export async function saveCfg(patch) { await setKV('cfg', { ...kv('cfg', {}), ...patch }); }
