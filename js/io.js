// Import Excel/CSV avec détection automatique des colonnes, modèle, export Excel, sauvegarde/restauration JSON.
import { S, STORES, bulkPut, bulkDel, put, clear, getFiles, loadAll, setKV } from './db.js';
import { typeOf, zoneOf, findCommune, appliquerRegles, codeTournee, cfg, saveCfg, livraisonNum, visiteDepuisLivraison } from './ref.js';
import { norm, uid, today, iso, downloadBlob, sum } from './util.js';
import { geocode } from './route.js';

// L'app ne gère plus que les clients (les ventes et le catalogue ne sont plus importés)
export const KINDS = { clients: 'Clients', tournees: 'Tournées (jours de livraison)' };

// Champs reconnus et synonymes d'en-têtes (comparés sans accents ni majuscules)
export const FIELDS = {
  tournees: [
    { k: 'tournee', label: 'Code tournée', req: true, syn: ['tournee', 'code tournee', 'n tournee', 'code', 'circuit', 'secteur'] },
    { k: 'jourLivraison', label: 'Jour de livraison', syn: ['jour de livraison', 'jour livraison', 'livraison', 'jour', 'jour tournee'] },
    { k: 'jourVisite', label: 'Jour de visite', syn: ['jour de visite', 'jour visite', 'visite'] },
    { k: 'jourAppel', label: 'Jour d\'appel télévente', syn: ['jour d appel', 'jour appel', 'televente', 'jour televente', 'appel'] },
    { k: 'libelle', label: 'Nom de la tournée', syn: ['libelle', 'nom', 'designation', 'nom tournee', 'libelle tournee', 'description'] },
  ],
  clients: [
    { k: 'enseigne', label: 'Nom / enseigne', req: true, syn: ['enseigne', 'nom commercial', 'nom', 'client', 'etablissement', 'raison sociale', 'societe', 'denomination', 'libelle client', 'nom client'] },
    { k: 'nom', label: 'Raison sociale', syn: ['raison sociale', 'societe', 'denomination sociale'] },
    { k: 'numClient', label: 'N° client', syn: ['n client', 'no client', 'num client', 'numero client', 'code client', 'code', 'id client', 'compte', 'ref client', 'n° client'] },
    { k: 'typeEtab', label: 'Type d\'établissement', syn: ['type', 'type etablissement', 'categorie', 'activite', 'segment', 'famille client', 'canal'] },
    { k: 'adresse', label: 'Adresse', syn: ['adresse', 'adresse 1', 'adresse1', 'rue', 'voie', 'adresse livraison'] },
    { k: 'adresse2', label: 'Complément d\'adresse', syn: ['adresse 3', 'complement adresse', 'complement d adresse', 'complement', 'adresse complementaire', 'lieu dit'] },
    { k: 'tournee', label: 'Code tournée', syn: ['tournee', 'code tournee', 'n tournee', 'secteur', 'circuit'] },
    { k: 'cp', label: 'Code postal', syn: ['cp', 'code postal', 'postal', 'zip'] },
    { k: 'ville', label: 'Commune', syn: ['ville', 'commune', 'localite', 'city'] },
    { k: 'tel', label: 'Téléphone', syn: ['tel', 'telephone', 'tel fixe', 'phone', 'portable', 'mobile', 'gsm'] },
    { k: 'email', label: 'Email', syn: ['email', 'e mail', 'mail', 'courriel', 'adresse mail'] },
    { k: 'contact', label: 'Contact (nom)', syn: ['contact', 'nom contact', 'interlocuteur', 'gerant', 'responsable', 'nom du contact'] },
    { k: 'siret', label: 'SIRET', syn: ['siret', 'siren', 'n siret'] },
    { k: 'jourLivraison', label: 'Jour de livraison', syn: ['jour livraison', 'jour de livraison', 'livraison', 'tournee livraison'] },
    { k: 'frequence', label: 'Fréquence de visite (j)', syn: ['frequence', 'frequence visite', 'periodicite'] },
    { k: 'objectifMensuel', label: 'Objectif mensuel (€)', syn: ['objectif', 'objectif mensuel', 'objectif ca'] },
    { k: 'finContrat', label: 'Fin de contrat', syn: ['fin contrat', 'fin de contrat', 'echeance contrat', 'date fin'] },
    { k: 'statut', label: 'Statut (client/prospect)', syn: ['statut', 'status', 'prospect'] },
    { k: 'tags', label: 'Tags', syn: ['tags', 'tag', 'etiquettes', 'mots cles'] },
    { k: 'moisFermes', label: 'Mois de fermeture (ex. 10-4 ou nov, déc)', syn: ['mois de fermeture', 'mois fermeture', 'fermeture annuelle', 'mois fermes', 'saison fermee'] },
    { k: 'situation', label: 'Situation (RAS, RJ…)', syn: ['situation', 'etat', 'situation juridique', 'statut juridique', 'procedure'] },
    { k: 'jourVisite', label: 'Jour de visite', syn: ['jour visite', 'jour de visite', 'jour passage', 'jour de passage'] },
    { k: 'jourAppel', label: 'Jour d\'appel télévente', syn: ['jour appel', 'jour d appel', 'televente', 'jour televente', 'jour de televente', 'appel televente'] },
    { k: 'notes', label: 'Notes', syn: ['notes', 'note', 'commentaire', 'commentaires', 'remarques', 'observations'] },
    { k: 'lat', label: 'Latitude', syn: ['lat', 'latitude'] },
    { k: 'lng', label: 'Longitude', syn: ['lng', 'lon', 'long', 'longitude'] },
  ],
  ventes: [
    { k: 'date', label: 'Date', req: true, alt: ['mois'], syn: ['date', 'date facture', 'date commande', 'date livraison', 'date piece', 'jour'] },
    { k: 'mois', label: 'Mois (si pas de date)', syn: ['mois', 'periode', 'month'] },
    { k: 'annee', label: 'Année', syn: ['annee', 'an', 'exercice', 'year'] },
    { k: 'numClient', label: 'N° client', req: true, alt: ['client'], syn: ['n client', 'no client', 'num client', 'numero client', 'code client', 'compte', 'id client', 'n° client'] },
    { k: 'client', label: 'Nom du client', syn: ['client', 'nom client', 'enseigne', 'raison sociale', 'nom', 'libelle client'] },
    { k: 'ref', label: 'Référence produit', syn: ['ref', 'reference', 'ref article', 'code article', 'article', 'code produit', 'sku', 'ean'] },
    { k: 'designation', label: 'Désignation', syn: ['designation', 'libelle', 'libelle article', 'produit', 'description', 'article libelle'] },
    { k: 'qte', label: 'Quantité', syn: ['qte', 'quantite', 'qty', 'nb', 'colis', 'quantite vendue', 'unites'] },
    { k: 'ht', label: 'Montant HT / CA', req: true, syn: ['ca', 'ca ht', 'montant', 'montant ht', 'total ht', 'chiffre affaires', 'chiffre d affaires', 'net ht', 'ht', 'vente ht', 'prix total'] },
    { k: 'pu', label: 'Prix unitaire HT', syn: ['pu', 'prix unitaire', 'pu ht', 'prix', 'prix vente'] },
    { k: 'marge', label: 'Marge (€)', syn: ['marge', 'marge brute', 'marge ht', 'mb'] },
    { k: 'achat', label: 'Prix d\'achat / coût', syn: ['prix achat', 'prix d achat', 'prix d achat ht', 'cout', 'pa', 'cout revient', 'prix de revient', 'pr'] },
  ],
  catalogue: [
    { k: 'ref', label: 'Référence', req: true, syn: ['ref', 'reference', 'code article', 'code', 'article', 'code produit', 'sku'] },
    { k: 'designation', label: 'Désignation', req: true, syn: ['designation', 'libelle', 'produit', 'description', 'nom', 'libelle article'] },
    { k: 'famille', label: 'Famille', syn: ['famille', 'categorie', 'rayon', 'gamme', 'univers', 'sous famille', 'type d article', 'type article', 'type produit'] },
    { k: 'infos', label: 'Désignation secondaire', syn: ['designation secondaire', 'designation 2', 'libelle 2', 'libelle secondaire', 'description courte'] },
    { k: 'marque', label: 'Marque', syn: ['marque', 'fabricant', 'fournisseur'] },
    { k: 'stock', label: 'Stock', syn: ['stock reel', 'stock', 'stock disponible', 'qte stock'] },
    { k: 'cond', label: 'Conditionnement', syn: ['cond', 'conditionnement', 'colisage', 'pcb', 'format', 'contenance', 'uv'] },
    { k: 'prix', label: 'Prix de vente HT', syn: ['prix', 'prix vente', 'pv', 'pv ht', 'tarif', 'prix ht', 'pu ht', 'prix unitaire'] },
    { k: 'achat', label: 'Prix d\'achat HT', syn: ['prix achat', 'prix d achat', 'prix d achat ht', 'pa', 'cout', 'pa ht', 'prix de revient'] },
    { k: 'ean', label: 'EAN / code-barres', syn: ['ean', 'gencod', 'code barre', 'code barres', 'ean13'] },
    { k: 'nouveaute', label: 'Nouveauté (oui/non)', syn: ['nouveaute', 'nouveau', 'new'] },
    { k: 'promo', label: 'Promo (oui/non)', syn: ['promo', 'promotion', 'offre'] },
  ],
};

const nh = s => norm(s).replace(/[°º.()_/\\-]/g, ' ').replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- Lecture ----------
export async function readFile(file) {
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    // Encodage : UTF-8, sinon Windows-1252 (exports Excel français)
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    const first = txt.split(/\r?\n/)[0] || '';
    const FS = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    wb = XLSX.read(txt, { type: 'string', FS, raw: true, cellDates: false });
  } else wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheets = wb.SheetNames.map(name => {
    const all = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false });
    // Ligne d'en-tête : la première ligne avec au moins 2 cellules texte, parmi les 15 premières, qui reconnaît le plus de champs
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(15, all.length); i++) {
      const r = all[i]; const txt = r.filter(v => typeof v === 'string' && v.trim()).length;
      if (txt < 2) continue;
      const sc = Math.max(...Object.keys(FIELDS).map(k => scoreKind(k, r.map(String)))) * 10 + txt;
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    const headers = (all[best] || []).map(h => String(h).trim());
    const rows = all.slice(best + 1).filter(r => r.some(v => String(v).trim() !== ''));
    // Score : nombre de colonnes reconnues (sert à ouvrir d'office le bon onglet, pas un « Lisez-moi »)
    const score = rows.length ? Math.max(scoreKind('clients', headers), scoreKind('tournees', headers)) : 0;
    return { name, headers, rows, headerRow: best, score };
  });
  return { sheets };
}

function matchField(fd, header) {
  const h = nh(header);
  if (!h) return 0;
  for (const s of fd.syn) if (h === nh(s)) return 3;
  for (const s of fd.syn) { const n = nh(s); if (n.length >= 3 && (h.startsWith(n + ' ') || h.endsWith(' ' + n))) return 2; }
  // Mot entier seulement (« secondaire » ne doit pas être pris pour « cond »)
  for (const s of fd.syn) { const n = nh(s); if (n.length >= 4 && (' ' + h + ' ').includes(' ' + n + ' ')) return 1; }
  return 0;
}
function scoreKind(kind, headers) {
  let sc = 0;
  for (const fd of FIELDS[kind]) if (headers.some(h => matchField(fd, h) >= 2)) sc += fd.req ? 3 : 1;
  return sc;
}
export function detectKind(headers = []) {
  const fd = (kind, k) => FIELDS[kind].find(f => f.k === k);
  const iT = headers.findIndex(h => matchField(fd('tournees', 'tournee'), h) >= 2);
  const jour = ['jourLivraison', 'jourVisite', 'jourAppel'].some(k => headers.some((h, i) => i !== iT && matchField(fd('tournees', k), h) >= 2));
  // Une colonne de nom ou de n° client (autre que celle de la tournée) signale un fichier clients
  const client = headers.some((h, i) => i !== iT && (matchField(fd('clients', 'enseigne'), h) === 3 || matchField(fd('clients', 'numClient'), h) === 3 || matchField(fd('clients', 'ville'), h) === 3));
  return iT >= 0 && jour && !client ? 'tournees' : 'clients';
}
export function autoMap(kind, headers) {
  const map = {}, used = new Set();
  // On attribue d'abord les correspondances exactes, puis les approximatives
  // Correspondances exactes, dans l'ordre de préférence des synonymes (« Enseigne » avant « Raison sociale »)
  for (const fd of FIELDS[kind]) for (const s of fd.syn) {
    if (map[fd.k] != null) break;
    const i = headers.findIndex((h, j) => !used.has(j) && nh(h) === nh(s));
    if (i >= 0) { map[fd.k] = i; used.add(i); }
  }
  for (const lvl of [2, 1]) for (const fd of FIELDS[kind]) {
    if (map[fd.k] != null) continue;
    const i = headers.findIndex((h, j) => !used.has(j) && matchField(fd, h) === lvl);
    if (i >= 0) { map[fd.k] = i; used.add(i); }
  }
  for (const fd of FIELDS[kind]) if (map[fd.k] === undefined) map[fd.k] = null;
  return map;
}

// ---------- Conversion des valeurs ----------
export function toNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[\s €%]/g, '');
  if (!s) return null;
  if (/,\d{1,3}$/.test(s) && s.includes('.')) s = s.replace(/\./g, ''); // 1.234,56
  s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const MOISN = { janv: 1, jan: 1, janvier: 1, fevr: 2, fev: 2, fevrier: 2, mars: 3, mar: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, sept: 9, sep: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };
export function toDate(v, annee) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getTime() + 12 * 3600e3)); // évite les décalages de fuseau
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400e3)); return iso(new Date(d.getTime() + d.getTimezoneOffset() * 60e3)); }
    if (v >= 1 && v <= 12 && annee) return `${annee}-${String(v).padStart(2, '0')}-15`;
    if (v > 190001 && v < 210012) return `${String(v).slice(0, 4)}-${String(v).slice(4, 6)}-15`; // 202511
  }
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if ((m = s.match(/^(\d{1,2})[/.-](\d{4})$/))) return `${m[2]}-${m[1].padStart(2, '0')}-15`; // 11/2025
  if ((m = s.match(/^(\d{4})[/.-](\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, '0')}-15`;
  const n = norm(s).replace(/\./g, '');
  if ((m = n.match(/^([a-z]+)\s*(\d{2,4})?$/)) && MOISN[m[1]]) { const y = m[2] ? (m[2].length === 2 ? '20' + m[2] : m[2]) : annee; if (y) return `${y}-${String(MOISN[m[1]]).padStart(2, '0')}-15`; }
  return null;
}
// « 10-4 » (octobre à avril), « nov, déc, janv » ou « 11;12;1 » → numéros de mois
export function parseMois(v) {
  const s = norm(v).replace(/\./g, '');
  if (!s) return [];
  const tok = x => { x = x.trim(); return /^\d+$/.test(x) ? +x : MOISN[x] || MOISN[x.slice(0, 4)] || MOISN[x.slice(0, 3)] || null; };
  const out = new Set();
  for (const part of s.split(/[,;]+/).map(x => x.trim()).filter(Boolean)) {
    const m = part.split(/\s*(?:-|\sa\s)\s*/);
    if (m.length === 2 && tok(m[0]) && tok(m[1])) { let a = tok(m[0]); const b = tok(m[1]); for (let i = 0; i < 12; i++) { out.add(a); if (a === b) break; a = a % 12 + 1; } }
    else for (const x of part.split(/\s+/)) { const n = tok(x); if (n >= 1 && n <= 12) out.add(n); }
  }
  return [...out].filter(n => n >= 1 && n <= 12).sort((a, b) => a - b);
}
// Codes famille des exports Alpagel → libellés lisibles (le code reste visible)
const FAMILLES = { GLA: 'Glaces (GLA)', SNG: 'Surgelés (SNG)', SSG: 'Surgelés (SSG)', FRA: 'Produits frais (FRA)', EPI: 'Épicerie (EPI)', PUB: 'Publicité / PLV (PUB)', MEU: 'Meubles / matériel (MEU)', AUT: 'Autres (AUT)' };
// « LA FARANDOLE » → « La Farandole » (uniquement si tout est en majuscules)
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'sur', 'a', 'à', 'd', 'l']);
export function joli(s) {
  s = String(s || '').trim();
  if (!s || s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s;
  return s.toLowerCase().replace(/[\p{L}\d]+/gu, (w, i) => (i > 0 && PETITS.has(w)) ? w : w[0].toUpperCase() + w.slice(1))
    .replace(/\b(Sarl|Sas|Sasu|Eurl|Snc|Sci)\b/g, x => x.toUpperCase());
}
// « 0476522298 » → « 04 76 52 22 98 »
export function telFr(t) {
  const d = String(t).replace(/\D/g, '');
  const n = d.length === 9 ? '0' + d : d.startsWith('33') && d.length === 11 ? '0' + d.slice(2) : d;
  return n.length === 10 ? n.replace(/(\d\d)(?=\d)/g, '$1 ') : String(t).trim();
}
// « mardi », « MAR », « 2 » → 2 (lundi = 1)
export function parseJour(v) {
  const n = norm(v).replace(/\./g, '').trim();
  if (!n) return null;
  if (/^[1-6]$/.test(n)) return +n;
  const J = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const i = J.indexOf(n.slice(0, 3));
  return i >= 0 ? i + 1 : null;
}
// « RJ », « redressement », « liquidation »… → situation connue
export function parseSituation(v) {
  const n = norm(v);
  if (!n) return null;
  if (/^ras$|^ok$|^normal/.test(n)) return 'RAS';
  if (/\brj\b|redress/.test(n)) return 'Redressement judiciaire';
  if (/\blj\b|liquid/.test(n)) return 'Liquidation judiciaire';
  if (/sauvegarde/.test(n)) return 'Procédure de sauvegarde';
  if (/bloq/.test(n)) return 'Compte bloqué';
  if (/ferme|cess/.test(n)) return 'Fermé définitivement';
  if (/vente|gerant|repris/.test(n)) return 'En vente / changement de gérant';
  if (/paie|impay|retard/.test(n)) return 'Paiement à surveiller';
  return null;
}
// « mardi, jeudi », « MAR/JEU », « lundi et vendredi » → [2, 4]…
export function parseJours(v) {
  return [...new Set(String(v ?? '').split(/[,;/+&]|\set\s/i).map(parseJour).filter(Boolean))].sort();
}
const yes = v => /^(1|o|oui|x|y|yes|vrai|true)$/i.test(String(v ?? '').trim());
const str = v => (v instanceof Date ? iso(v) : String(v ?? '')).trim();

// ---------- Import ----------
export async function importRows(kind, rows, map, opts = {}, progress = () => { }) {
  const get = (r, k) => map[k] == null ? '' : r[map[k]];
  if (kind === 'tournees') {
    const regles = { ...(cfg().joursTournees || {}) };
    const NOMS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    let n = 0;
    for (const r of rows) {
      const code = codeTournee(get(r, 'tournee')); if (!code) continue;
      const regle = { ...(regles[code] || {}) };
      // « mardi, jeudi » : la tournée est livrée plusieurs jours
      const liv = parseJours(get(r, 'jourLivraison'));
      if (liv.length) { regle.livraisons = [...new Set([...(regle.livraisons || []), ...liv])].sort(); delete regle.jourLivraison; }
      for (const k of ['jourVisite', 'jourAppel']) { const jj = parseJour(get(r, k)); if (jj) regle[k] = jj; }
      const lib = str(get(r, 'libelle')); if (lib) regle.libelle = lib;
      regles[code] = regle; n++;
    }
    await saveCfg({ joursTournees: JSON.parse(JSON.stringify(regles)) });
    // Clients déjà présents sur ces tournées : jour de livraison si la tournée n'en a qu'un, visite la veille
    const maj = []; let aRepartir = 0;
    for (const c of S.clients) {
      const regle = c.tournee && regles[codeTournee(c.tournee)]; if (!regle) continue;
      const liv = regle.livraisons || [];
      let chg = false;
      const actuel = livraisonNum(c);
      if (liv.length === 1 && (!actuel || (opts.ecraser && actuel !== liv[0]))) { c.jourLivraison = NOMS[liv[0]]; chg = true; }
      else if (liv.length > 1 && !actuel) aRepartir++;
      if (visiteDepuisLivraison(c)) chg = true;
      for (const k of ['jourVisite', 'jourAppel']) {
        if (!regle[k] || (c[k] && !opts.ecraser)) continue;
        if (c[k] !== regle[k]) { c[k] = regle[k]; if (k === 'jourVisite') c.visiteAuto = undefined; chg = true; }
      }
      if (chg) maj.push(c);
    }
    if (maj.length) await bulkPut('clients', maj);
    return `${n} tournée${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}, ${maj.length} client${maj.length > 1 ? 's' : ''} mis à jour (visite placée la veille de la livraison).`
      + (aRepartir ? ` ${aRepartir} client${aRepartir > 1 ? 's' : ''} d'une tournée livrée plusieurs jours n'${aRepartir > 1 ? 'ont' : 'a'} pas encore de jour : Clients → Jours → Par tournée.` : '');
  }

  if (kind === 'catalogue') {
    const out = [];
    const ex = new Map(S.produits.map(p => [p.ref, p]));
    for (const r of rows) {
      const ref = str(get(r, 'ref')); if (!ref) continue;
      let des = str(get(r, 'designation')) || ref;
      const p = { ...(ex.get(ref) || {}), ref };
      // « SAUCE BEARNAISE        6X1K » : le conditionnement en fin de libellé, après de grands espaces
      const mc = des.match(/^(.*\S)\s{3,}(\S+)$/);
      if (mc && map.cond == null) { des = mc[1]; p.cond = mc[2]; }
      p.designation = des.replace(/\s+/g, ' ');
      for (const k of ['famille', 'cond', 'ean', 'marque']) { const v = str(get(r, k)); if (v) p[k] = v; }
      if (p.famille) p.famille = FAMILLES[p.famille.toUpperCase()] || p.famille;
      const inf = str(get(r, 'infos')).replace(/\s+/g, ' '); if (inf) p.infos = inf;
      const stock = toNum(get(r, 'stock')); if (map.stock != null) p.stock = stock;
      const prix = toNum(get(r, 'prix')); if (prix != null) p.prix = prix;
      const achat = toNum(get(r, 'achat')); if (achat != null) p.achat = achat;
      if (map.nouveaute != null) p.nouveaute = yes(get(r, 'nouveaute'));
      if (map.promo != null) p.promo = yes(get(r, 'promo'));
      if (p.actif === undefined) p.actif = true;
      out.push(p);
    }
    await bulkPut('produits', out);
    const nNew = out.filter(p => !ex.has(p.ref)).length;
    return `${out.length} produits importés (${nNew} nouveaux, ${out.length - nNew} mis à jour).`;
  }

  if (kind === 'clients') {
    const byNum = new Map(S.clients.filter(c => c.numClient).map(c => [norm(c.numClient), c]));
    const byName = new Map(S.clients.map(c => [norm(c.enseigne || c.nom) + '|' + norm(c.ville), c]));
    const out = []; let nNew = 0;
    for (const r of rows) {
      const ens = str(get(r, 'enseigne')) || str(get(r, 'nom')); if (!ens) continue;
      const num = str(get(r, 'numClient')), ville = str(get(r, 'ville'));
      let c = (num && byNum.get(norm(num))) || byName.get(norm(ens) + '|' + norm(ville));
      const isNew = !c;
      // « Client depuis » vient de la première vente importée (sinon tous compteraient comme nouveaux ce mois-ci)
      c = c ? { ...c } : { id: uid(), contacts: [], tags: [], materiel: [], creneaux: [], fermeture: [], statut: 'client', importe: today() };
      if (isNew) nNew++;
      c.enseigne = joli(ens);
      for (const k of ['nom', 'numClient', 'adresse', 'adresse2', 'cp', 'ville', 'tel', 'email', 'siret', 'jourLivraison', 'notes']) { const v = str(get(r, k)).replace(/\s+/g, ' '); if (v) c[k] = v; }
      for (const k of ['nom', 'adresse', 'adresse2']) if (c[k]) c[k] = joli(c[k]);
      // Adresse principale vide mais complément rempli : on les échange
      if (!c.adresse && c.adresse2) { c.adresse = c.adresse2; delete c.adresse2; }
      if (c.tel) c.tel = telFr(c.tel);
      if (c.jourLivraison) { const j = parseJour(c.jourLivraison); c.jourLivraison = j ? ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][j] : undefined; }
      if (c.cp && /^\d{4}$/.test(c.cp)) c.cp = '0' + c.cp;
      const tr = str(get(r, 'tournee')).toUpperCase();
      if (tr) { if (c.tournee && c.tournee !== tr) c.tags = (c.tags || []).filter(t => t !== 'Tournée ' + c.tournee); c.tournee = tr; c.tags = [...new Set([...(c.tags || []), 'Tournée ' + tr])]; }
      const t = str(get(r, 'typeEtab')); if (t) c.typeEtab = typeOf(t); else if (!c.typeEtab) c.typeEtab = typeOf(ens);
      const st = norm(get(r, 'statut')); if (st) c.statut = st.startsWith('prosp') ? 'prospect' : 'client';
      if (c.statut === 'prospect' && !c.etape) c.etape = 'À contacter';
      for (const k of ['frequence', 'objectifMensuel']) { const v = toNum(get(r, k)); if (v != null) c[k] = v; }
      const fc = toDate(get(r, 'finContrat')); if (fc) c.finContrat = fc;
      const mf = parseMois(get(r, 'moisFermes')); if (mf.length) c.moisFermes = mf;
      const sit = parseSituation(get(r, 'situation')); if (sit) c.situation = sit === 'RAS' ? undefined : sit;
      const jv = parseJour(get(r, 'jourVisite')); if (jv) c.jourVisite = jv;
      const ja = parseJour(get(r, 'jourAppel')); if (ja) c.jourAppel = ja;
      const tg = str(get(r, 'tags')); if (tg) c.tags = [...new Set([...(c.tags || []), ...tg.split(/[,;|]/).map(s => s.trim()).filter(Boolean)])];
      const ct = str(get(r, 'contact'));
      if (ct && !(c.contacts || []).some(k => norm(k.nom) === norm(ct))) c.contacts = [...(c.contacts || []), { nom: ct, tel: str(get(r, 'tel')), email: str(get(r, 'email')) }];
      const lat = toNum(get(r, 'lat')), lng = toNum(get(r, 'lng'));
      if (lat && lng) { c.lat = lat; c.lng = lng; }
      c.zone = zoneOf(c.ville);
      appliquerRegles(c); // jours définis pour la tournée ou la commune, si la fiche n'en a pas
      out.push(c);
      if (c.numClient) byNum.set(norm(c.numClient), c);
      byName.set(norm(c.enseigne) + '|' + norm(c.ville), c);
    }
    await bulkPut('clients', out);
    let geo = 0;
    if (opts.geocode) geo = await geocoderTous(out.filter(c => c.lat == null), (i, n) => progress(`Géolocalisation ${i} / ${n}…`));
    // Zone des communes hors liste : celle de la majorité des clients du même code tournée, sinon la commune la plus proche
    const parCode = new Map();
    for (const c of out) if (c.tournee && findCommune(c.ville)) { const m = parCode.get(c.tournee) || {}; m[c.zone] = (m[c.zone] || 0) + 1; parCode.set(c.tournee, m); }
    const fix = [];
    for (const c of out) {
      if (findCommune(c.ville)) continue;
      const m = parCode.get(c.tournee);
      const z = m ? Object.entries(m).sort((a, b) => b[1] - a[1])[0][0] : zoneOf(c.ville, c.lat, c.lng);
      if (z !== c.zone) { c.zone = z; fix.push(c); }
    }
    if (fix.length) await bulkPut('clients', fix);
    const sansGeo = out.filter(c => c.lat == null).length;
    return `${out.length} fiches importées (${nNew} nouvelles, ${out.length - nNew} mises à jour)${opts.geocode ? `, ${geo} géolocalisées` : ''}${sansGeo ? `, ${sansGeo} sans position (adresse à compléter)` : ''}.`;
  }

  // Ventes
  const byNum = new Map(S.clients.filter(c => c.numClient).map(c => [norm(c.numClient), c]));
  const byName = new Map(); for (const c of S.clients) { byName.set(norm(c.enseigne), c); if (c.nom) byName.set(norm(c.nom), c); }
  const lines = [], created = []; let skipped = 0;
  const P = new Map(S.produits.map(p => [p.ref, p]));
  for (const r of rows) {
    const an = toNum(get(r, 'annee'));
    const date = toDate(get(r, 'date'), an) || toDate(get(r, 'mois'), an);
    let ht = toNum(get(r, 'ht'));
    const qte = toNum(get(r, 'qte')), pu = toNum(get(r, 'pu'));
    if (ht == null && qte != null && pu != null) ht = qte * pu;
    if (!date || ht == null) { skipped++; continue; }
    const num = str(get(r, 'numClient')), nm = str(get(r, 'client'));
    let c = (num && byNum.get(norm(num))) || (nm && byName.get(norm(nm)));
    if (!c) {
      if (!opts.create || !(num || nm)) { skipped++; continue; }
      c = { id: uid(), enseigne: nm || ('Client ' + num), numClient: num || undefined, typeEtab: typeOf(nm), statut: 'client', contacts: [], tags: [], materiel: [], creneaux: [], fermeture: [], zone: 'Grenoble & loin', importe: today() };
      created.push(c); if (num) byNum.set(norm(num), c); if (nm) byName.set(norm(nm), c);
    }
    const ref = str(get(r, 'ref')) || '(global)';
    let marge = toNum(get(r, 'marge'));
    const achat = toNum(get(r, 'achat'));
    if (marge == null && achat != null) marge = ht - achat * (qte || 1);
    if (marge == null && P.get(ref)?.achat != null && qte != null) marge = ht - P.get(ref).achat * qte;
    lines.push({ id: uid(), clientId: c.id, date, ref, designation: str(get(r, 'designation')) || P.get(ref)?.designation || (ref === '(global)' ? 'CA global' : ref), qte: qte ?? 0, ht, marge: marge ?? 0, source: 'import' });
  }
  if (created.length) await bulkPut('clients', created);
  let removed = 0;
  if (opts.replace && lines.length) {
    const min = lines.reduce((a, l) => l.date < a ? l.date : a, '9999'), max = lines.reduce((a, l) => l.date > a ? l.date : a, '0000');
    const old = S.ventes.filter(v => v.source === 'import' && v.date >= min && v.date <= max).map(v => v.id);
    removed = old.length;
    if (old.length) await bulkDel('ventes', old);
  }
  for (let i = 0; i < lines.length; i += 5000) { await bulkPut('ventes', lines.slice(i, i + 5000)); progress(`${Math.min(i + 5000, lines.length)} / ${lines.length} lignes…`); }
  // Date de premier achat = client depuis
  const first = new Map(); for (const l of S.ventes) if (!first.has(l.clientId) || l.date < first.get(l.clientId)) first.set(l.clientId, l.date);
  const upd = S.clients.filter(c => first.has(c.id) && (!c.depuis || c.importe) && c.depuis !== first.get(c.id)).map(c => ({ ...c, depuis: first.get(c.id) }));
  if (upd.length) await bulkPut('clients', upd);
  return `${lines.length} lignes de ventes importées (${eur0(sum(lines, l => l.ht))})${removed ? `, ${removed} anciennes lignes remplacées` : ''}${created.length ? `, ${created.length} clients créés (à compléter)` : ''}${skipped ? `, ${skipped} lignes ignorées (date, montant ou client manquant)` : ''}.`;
}
const eur0 = v => Math.round(v).toLocaleString('fr-FR') + ' €';

// Géocodage en série (5 requêtes en parallèle), repli sur le centre de la commune
export async function geocoderTous(list, progress = () => { }) {
  let i = 0, ok = 0;
  const todo = list.slice();
  const worker = async () => {
    while (todo.length) {
      const c = todo.shift();
      let g = null;
      // On essaie l'adresse puis le complément (souvent l'un des deux porte le n° et la rue), on garde le meilleur
      const cm = findCommune(c.ville);
      const villeQ = cm ? cm.nom : c.ville;
      for (const a of [c.adresse, c.adresse2].filter(Boolean).concat((c.adresse || c.adresse2) ? [] : [''])) {
        try {
          if (!navigator.onLine) break;
          const r = await geocode([a, c.cp, villeQ].filter(Boolean).join(' '), c.cp);
          if (r && (!g || r.score > g.score)) g = r;
        } catch (e) { }
        if (g && g.score > 0.7) break;
      }
      // Commune hors liste et adresse introuvable : au moins le centre de la commune (ex. une aire d'autoroute)
      if ((!g || g.score <= 0.45) && !cm && c.ville && navigator.onLine) {
        try { const r = await geocode(`${c.cp || ''} ${c.ville}`.trim(), c.cp); if (r) { r.score = Math.max(r.score, 0.46); g = r; c.geoApprox = true; } } catch (e) { }
      }
      if (g && g.score > 0.45) { c.lat = g.lat; c.lng = g.lng; ok++; }
      else if (cm) { c.lat = cm.lat + (Math.random() - .5) * .006; c.lng = cm.lng + (Math.random() - .5) * .006; c.geoApprox = true; ok++; }
      if (!cm && c.lat != null) c.zone = zoneOf(c.ville, c.lat, c.lng);
      if (c.lat != null) await put('clients', c);
      progress(++i, list.length);
    }
  };
  await Promise.all([1, 2, 3, 4, 5].map(worker));
  return ok;
}

// ---------- Modèle et export ----------
export function downloadModele() {
  const wb = XLSX.utils.book_new();
  const cl = [['N° client', 'Enseigne', 'Raison sociale', 'Type', 'Adresse', 'Code postal', 'Commune', 'Téléphone', 'Email', 'Contact', 'SIRET', 'Jour de livraison', 'Jour de visite', 'Jour d\'appel télévente', 'Fréquence', 'Objectif mensuel', 'Fin de contrat', 'Mois de fermeture', 'Situation', 'Statut', 'Tags', 'Notes'],
    ['C0001', 'Le Chalet des Neiges', 'SARL Chalet', 'Restaurant', '120 route du Belvédère', '73550', 'Les Allues', '04 79 00 00 00', 'contact@exemple.fr', 'Marie Dupont', '12345678900011', 'mardi', 'lundi', 'jeudi', 14, 1500, '2027-04-30', '5-11', 'RAS', 'client', 'saisonnier, terrasse', 'Ouvert de décembre à avril']];
  const ve = [['Date', 'N° client', 'Client', 'Référence', 'Désignation', 'Quantité', 'Montant HT', 'Marge'],
    ['15/11/2025', 'C0001', 'Le Chalet des Neiges', 'GL-VAN-25', 'Glace vanille bac 2,5 L', 6, 89.4, 31.2]];
  const ca = [['Référence', 'Désignation', 'Famille', 'Conditionnement', 'Prix de vente HT', 'Prix d\'achat HT', 'EAN', 'Nouveauté', 'Promo'],
    ['GL-VAN-25', 'Glace vanille bac 2,5 L', 'Glaces', 'carton 4 × 2,5 L', 14.9, 9.7, '3700000000000', 'non', 'non']];
  const tr = [['Code tournée', 'Nom de la tournée', 'Jour de livraison'], ['GC', 'Grésivaudan Crolles', 'mardi'], ['TP', 'Méribel', 'jeudi']];
  for (const [n, d] of [['Clients', cl], ['Tournées', tr]]) { const ws = XLSX.utils.aoa_to_sheet(d); ws['!cols'] = d[0].map(() => ({ wch: 18 })); XLSX.utils.book_append_sheet(wb, ws, n); }
  XLSX.writeFile(wb, 'Modele import Tournee Alpagel.xlsx');
}

export function exportExcel() {
  const wb = XLSX.utils.book_new();
  const cName = new Map(S.clients.map(c => [c.id, c.enseigne || c.nom]));
  const add = (name, rows) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]); XLSX.utils.book_append_sheet(wb, ws, name); };
  add('Clients', S.clients.map(c => ({ 'N° client': c.numClient || '', Enseigne: c.enseigne || '', 'Raison sociale': c.nom || '', Statut: c.statut, Étape: c.etape || '', Type: c.typeEtab || '', Zone: c.zone || '', Adresse: c.adresse || '', 'Code postal': c.cp || '', Commune: c.ville || '', Téléphone: c.tel || '', Email: c.email || '', SIRET: c.siret || '', 'Jour de livraison': c.jourLivraison || '', 'Jour de visite': c.jourVisite ? ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][c.jourVisite] : '', 'Jour d\'appel télévente': c.jourAppel ? ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][c.jourAppel] : '', Situation: c.situation || 'RAS', Fréquence: c.frequence || '', 'Objectif mensuel': c.objectifMensuel || '', 'Fin de contrat': c.finContrat || '', 'Client depuis': c.depuis || '', Tags: (c.tags || []).join(', '), Notes: c.notes || '', Latitude: c.lat ?? '', Longitude: c.lng ?? '', Archivé: c.archive ? 'oui' : '' })));
  add('Contacts', S.clients.flatMap(c => (c.contacts || []).map(k => ({ Client: cName.get(c.id), Nom: k.nom, Fonction: k.role || '', Téléphone: k.tel || '', Email: k.email || '' }))));
  add('Matériel', S.clients.flatMap(c => (c.materiel || []).map(m => ({ Client: cName.get(c.id), Matériel: m.designation, 'N° de série': m.serie || '', Date: m.date || '', Note: m.note || '' }))));
  add('Visites', S.visites.slice().sort((a, b) => a.date.localeCompare(b.date)).map(v => ({ Date: v.date, Heure: v.heure || '', Client: cName.get(v.clientId) || '', Résultat: v.resultat || '', Note: v.note || '' })));
  add('Rappels', S.rappels.map(r => ({ Date: r.date, Client: cName.get(r.clientId) || '', Objet: r.texte || '', Fait: r.fait ? 'oui' : '' })));
  XLSX.writeFile(wb, `Export Tournee Alpagel ${today()}.xlsx`);
}

// ---------- Sauvegarde / restauration ----------
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async d => (await fetch(d)).blob();

export async function backupBlob() {
  const data = { app: 'tournee-alpagel', version: 1, date: new Date().toISOString(), stores: {} };
  for (const s of STORES) {
    if (s === 'fichiers') {
      const files = await getFiles();
      data.stores.fichiers = await Promise.all(files.map(async f => ({ ...f, blob: undefined, data: f.blob ? await blobToDataURL(f.blob) : null })));
    } else if (s === 'kv') data.stores.kv = Object.entries(S.kv).filter(([k]) => k !== 'matCache2').map(([k, v]) => ({ k, v }));
    else data.stores[s] = S[s];
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function restoreFile(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'tournee-alpagel' || !data.stores) throw new Error('ce n\'est pas une sauvegarde de Tournée Alpagel');
  for (const s of STORES) {
    await clear(s);
    const rows = data.stores[s] || [];
    if (s === 'fichiers') { for (const f of rows) { const { data: d, ...rest } = f; await put('fichiers', { ...rest, blob: d ? await dataURLToBlob(d) : null }); } }
    else if (s === 'kv') { for (const { k, v } of rows) await setKV(k, v); }
    else if (rows.length) await bulkPut(s, rows);
  }
  await loadAll();
  return S.clients.length;
}

export async function toutEffacer() { for (const s of STORES) await clear(s); }
