// Jeu de démonstration réaliste (≈ 60 clients dans tes communes, ≈ 85 produits, 18 mois de ventes, visites, prospects).
// Tout est marqué demo:true et s'efface sans toucher aux vraies données.
import { S, bulkPut, bulkDel, kv, setKV } from './db.js';
import { COMMUNES, cfg, saveCfg, TYPES } from './ref.js';
import { today, addDays, parseD, iso, ym } from './util.js';

let seed = 162;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const r2 = v => Math.round(v * 100) / 100;
let idn = 0; const did = p => `demo-${p}-${(idn++).toString(36)}`;

// ---------- Catalogue ----------
const CAT = [
  // [ref, désignation, famille, cond, prix, achat]
  ...[['VAN', 'Vanille de Madagascar'], ['CHO', 'Chocolat noir'], ['CAF', 'Café'], ['FRA', 'Fraise'], ['CIT', 'Sorbet citron'], ['FRB', 'Sorbet framboise'], ['PIS', 'Pistache'], ['CBS', 'Caramel beurre salé'], ['MEN', 'Menthe chocolat'], ['COC', 'Noix de coco'], ['MAN', 'Sorbet mangue'], ['RHU', 'Rhum raisin'], ['GEN', 'Génépi des Alpes'], ['MYR', 'Sorbet myrtille']]
    .map(([r, n], i) => [`GL-${r}-25`, `Glace ${n} bac 2,5 L`, 'Glaces en bac', 'carton 4 × 2,5 L', 14.9 + (i % 3) * 0.8, 9.6 + (i % 3) * 0.5]),
  ...[['VAN', 'Vanille'], ['CHO', 'Chocolat'], ['FRA', 'Fraise'], ['CIT', 'Sorbet citron']].map(([r, n]) => [`GL-${r}-50`, `Glace ${n} bac 5 L`, 'Glaces en bac', 'carton 2 × 5 L', 26.5, 17.2]),
  ['GI-CON-VF', 'Cône vanille-fraise', 'Glaces individuelles', 'carton 24', 21.6, 13.9], ['GI-CON-CH', 'Cône chocolat', 'Glaces individuelles', 'carton 24', 21.6, 13.9],
  ['GI-BAT-CH', 'Bâtonnet chocolat lait', 'Glaces individuelles', 'carton 30', 18.9, 11.8], ['GI-ESQ-AM', 'Esquimau amande', 'Glaces individuelles', 'carton 24', 24.5, 15.6],
  ['GI-POT-VA', 'Pot vanille 120 ml', 'Glaces individuelles', 'carton 24', 13.2, 8.1], ['GI-POT-CI', 'Pot sorbet citron 120 ml', 'Glaces individuelles', 'carton 24', 13.2, 8.1],
  ['GI-SAN-VA', 'Sandwich glacé vanille', 'Glaces individuelles', 'carton 20', 17.8, 11.2], ['GI-FUS-FR', 'Fusée aux fruits', 'Glaces individuelles', 'carton 40', 16.4, 9.9],
  ['DG-NOU-12', 'Nougat glacé 12 parts', 'Desserts glacés', 'pièce', 16.9, 10.4], ['DG-VAC-10', 'Vacherin vanille-framboise 10 parts', 'Desserts glacés', 'pièce', 18.5, 11.6],
  ['DG-OMN-08', 'Omelette norvégienne 8 parts', 'Desserts glacés', 'pièce', 19.9, 12.9], ['DG-PRO-60', 'Profiteroles × 60', 'Desserts glacés', 'carton', 14.8, 8.9], ['DG-CAF-24', 'Café liégeois verrine × 24', 'Desserts glacés', 'carton', 22.4, 14.1],
  ['SS-FRI-09', 'Frites 9/9 mm', 'Surgelés salés', 'carton 4 × 2,5 kg', 16.8, 11.3], ['SS-FRI-SH', 'Frites steakhouse', 'Surgelés salés', 'carton 4 × 2,5 kg', 19.2, 12.9],
  ['SS-RIS-25', 'Pommes rissolées', 'Surgelés salés', 'sac 2,5 kg', 7.9, 5.1], ['SS-GRA-25', 'Gratin dauphinois', 'Surgelés salés', 'barquette 2,5 kg', 14.6, 9.4],
  ['SS-TAR-20', 'Tartiflette au reblochon', 'Surgelés salés', 'barquette 2 kg', 18.9, 12.2], ['SS-DIO-30', 'Diots de Savoie', 'Surgelés salés', 'sac 30 pièces', 27.5, 18.4],
  ['SS-CRO-20', 'Croziflette', 'Surgelés salés', 'barquette 2 kg', 19.8, 12.8], ['SS-RAV-10', 'Ravioles du Dauphiné', 'Surgelés salés', 'sac 1 kg', 11.4, 7.3],
  ['SS-STE-40', 'Steak haché 15 % × 40', 'Surgelés salés', 'carton 4 kg', 34.9, 24.6], ['SS-COR-30', 'Cordon bleu de dinde × 30', 'Surgelés salés', 'carton', 22.8, 15.2],
  ['SS-NUG-1K', 'Nuggets de poulet', 'Surgelés salés', 'sac 1 kg', 9.9, 6.4], ['SS-COL-50', 'Filet de colin pané', 'Surgelés salés', 'carton 5 kg', 41.5, 29.8],
  ['SS-SAU-20', 'Pavé de saumon 140 g × 20', 'Surgelés salés', 'carton', 46.9, 33.5], ['SS-POE-25', 'Poêlée montagnarde', 'Surgelés salés', 'sac 2,5 kg', 9.8, 6.1],
  ['SS-HAR-25', 'Haricots verts extra-fins', 'Surgelés salés', 'sac 2,5 kg', 8.6, 5.4], ['SS-EPI-25', 'Épinards hachés', 'Surgelés salés', 'sac 2,5 kg', 6.9, 4.2],
  ['SS-RAT-25', 'Ratatouille', 'Surgelés salés', 'sac 2,5 kg', 9.4, 5.9], ['SS-LAS-30', 'Lasagnes bolognaise', 'Surgelés salés', 'barquette 3 kg', 21.9, 14.6],
  ['SS-PIZ-10', 'Pizza margherita × 10', 'Surgelés salés', 'carton', 24.5, 15.9], ['SS-QUI-08', 'Quiche lorraine 8 parts × 2', 'Surgelés salés', 'carton', 15.8, 9.8],
  ['SS-BUR-40', 'Pain burger brioché × 40', 'Surgelés salés', 'carton', 17.4, 10.9],
  ['PS-TMY-10', 'Tarte aux myrtilles 10 parts', 'Pâtisserie surgelée', 'pièce', 15.9, 9.7], ['PS-TAT-10', 'Tarte Tatin 10 parts', 'Pâtisserie surgelée', 'pièce', 14.9, 9.1],
  ['PS-TCM-10', 'Tarte citron meringuée', 'Pâtisserie surgelée', 'pièce', 15.4, 9.4], ['PS-FON-12', 'Fondant chocolat cœur coulant × 12', 'Pâtisserie surgelée', 'carton', 13.9, 8.2],
  ['PS-MOE-24', 'Moelleux amande × 24', 'Pâtisserie surgelée', 'carton', 16.2, 9.9], ['PS-CRO-60', 'Croissant pur beurre × 60', 'Pâtisserie surgelée', 'carton', 27.9, 18.6],
  ['PS-PAC-60', 'Pain au chocolat × 60', 'Pâtisserie surgelée', 'carton', 29.4, 19.7], ['PS-PAR-50', 'Pain aux raisins × 50', 'Pâtisserie surgelée', 'carton', 28.6, 18.9],
  ['PS-BAG-50', 'Baguette précuite × 50', 'Pâtisserie surgelée', 'carton', 19.5, 12.4], ['PS-BRI-06', 'Brioche tressée × 6', 'Pâtisserie surgelée', 'carton', 14.2, 8.8],
  ['PS-CRE-40', 'Crêpes de froment × 40', 'Pâtisserie surgelée', 'carton', 12.9, 7.6], ['PS-GAU-30', 'Gaufres de Liège × 30', 'Pâtisserie surgelée', 'carton', 16.8, 10.3],
  ['PS-BEI-48', 'Beignets framboise × 48', 'Pâtisserie surgelée', 'carton', 18.4, 11.2], ['PS-TIR-24', 'Tiramisu verrine × 24', 'Pâtisserie surgelée', 'carton', 23.6, 14.8],
  ['PS-CRB-24', 'Crème brûlée × 24', 'Pâtisserie surgelée', 'carton', 21.8, 13.5], ['PS-MOU-24', 'Mousse au chocolat × 24', 'Pâtisserie surgelée', 'carton', 19.6, 12.1],
  ['PF-CRE-35', 'Crème fraîche 35 % 1 L', 'Produits frais', 'carton 6 × 1 L', 21.4, 15.8], ['PF-BEU-1K', 'Beurre doux plaque 1 kg', 'Produits frais', 'carton 10 kg', 82.0, 63.0],
  ['PF-CHA-1L', 'Crème Chantilly 1 L', 'Produits frais', 'carton 6', 24.6, 17.9], ['PF-LAI-1L', 'Lait entier 1 L × 6', 'Produits frais', 'pack', 7.8, 5.6],
  ['PF-REB-AOP', 'Reblochon AOP', 'Produits frais', 'pièce 450 g', 7.9, 5.6], ['PF-TOM-1K', 'Tomme de Savoie IGP', 'Produits frais', 'kg', 15.8, 11.4],
  ['PF-BEA-1K', 'Beaufort AOP', 'Produits frais', 'kg', 26.9, 20.1], ['PF-RAC-2K', 'Raclette tranchée', 'Produits frais', 'barquette 2 kg', 29.5, 21.7],
  ['PF-MOZ-1K', 'Mozzarella râpée', 'Produits frais', 'sac 1 kg', 8.9, 6.2], ['PF-OEU-90', 'Œufs plein air × 90', 'Produits frais', 'plateau', 27.0, 20.2],
  ['CO-COR-200', 'Cornets gaufrés × 200', 'Consommables', 'carton', 24.8, 15.2], ['CO-POT-1000', 'Pots carton glace 120 ml × 1000', 'Consommables', 'carton', 38.5, 24.1],
  ['CO-CUI-1000', 'Cuillères à glace × 1000', 'Consommables', 'carton', 14.6, 8.7], ['CO-SER-2000', 'Serviettes 2 plis × 2000', 'Consommables', 'carton', 19.9, 12.4],
  ['CO-GOB-1000', 'Gobelets carton 25 cl × 1000', 'Consommables', 'carton', 42.0, 27.8], ['CO-BAR-500', 'Barquettes frites × 500', 'Consommables', 'carton', 26.4, 16.3],
  ['CO-FIL-300', 'Film étirable 300 m', 'Consommables', 'rouleau', 9.8, 5.9], ['CO-GAN-100', 'Gants nitrile × 100', 'Consommables', 'boîte', 7.4, 4.3],
  ['CO-SAC-500', 'Sacs isothermes × 50', 'Consommables', 'carton', 21.5, 13.2],
];
const NOUVEAUTES = ['GL-GEN-25', 'SS-CRO-20', 'GI-SAN-VA', 'PS-TMY-10', 'GL-MYR-25'];
const PROMOS = { 'SS-FRI-09': '-10 % sur le carton ce mois-ci', 'PS-CRO-60': '1 carton offert pour 10', 'GL-VAN-50': '-12 % jusqu\'à fin du mois', 'SS-STE-40': 'prix spécial saison' };

// Préférences de familles par type d'établissement (poids)
const PREF = {
  'Restaurant': { 'Surgelés salés': 5, 'Pâtisserie surgelée': 3, 'Glaces en bac': 3, 'Desserts glacés': 2, 'Produits frais': 2, 'Consommables': 0.5 },
  'Hôtel': { 'Pâtisserie surgelée': 5, 'Surgelés salés': 3, 'Glaces en bac': 2, 'Desserts glacés': 2, 'Produits frais': 3, 'Consommables': 1 },
  'Camping': { 'Glaces individuelles': 6, 'Surgelés salés': 3, 'Pâtisserie surgelée': 2, 'Consommables': 3, 'Produits frais': 1 },
  'Café / bar': { 'Glaces individuelles': 4, 'Pâtisserie surgelée': 4, 'Consommables': 3, 'Surgelés salés': 1, 'Glaces en bac': 1 },
  'Boulangerie': { 'Pâtisserie surgelée': 6, 'Glaces individuelles': 3, 'Produits frais': 3, 'Consommables': 1 },
  'Glacier': { 'Glaces en bac': 7, 'Consommables': 4, 'Produits frais': 2, 'Desserts glacés': 2, 'Glaces individuelles': 1 },
  'Plage / snack': { 'Surgelés salés': 4, 'Glaces individuelles': 5, 'Consommables': 4, 'Pâtisserie surgelée': 1 },
  'Station de ski': { 'Surgelés salés': 6, 'Pâtisserie surgelée': 3, 'Glaces en bac': 2, 'Consommables': 3, 'Produits frais': 3, 'Glaces individuelles': 1 },
  'Collectivité': { 'Surgelés salés': 7, 'Desserts glacés': 2, 'Glaces individuelles': 2, 'Pâtisserie surgelée': 2, 'Produits frais': 1 },
  'GMS / supérette': { 'Glaces individuelles': 5, 'Surgelés salés': 4, 'Pâtisserie surgelée': 3, 'Produits frais': 3, 'Glaces en bac': 1 },
};
const SAISON = {
  hiver: [1.6, 1.8, 1.5, 0.8, 0.05, 0.05, 0.3, 0.35, 0.05, 0.05, 0.35, 1.3],
  ete: [0, 0, 0.1, 0.4, 0.8, 1.4, 1.9, 1.8, 0.8, 0.2, 0, 0],
  annuel: [0.9, 0.95, 1, 1, 1.05, 1.1, 1.0, 0.75, 1.05, 1, 0.95, 1.15],
};

const A = ['du Lac', 'des Sapins', 'de la Marmotte', 'du Grand Pic', 'de Belledonne', 'du Vieux Moulin', 'des Alpages', 'de la Cascade', 'du Torrent', "de l'Edelweiss", 'du Chamois', 'de la Gentiane', 'du Granier', 'des Bouquetins', 'de la Forge', 'du Tilleul', 'de Chartreuse', 'du Bréda', 'des Myrtilles', 'du Belvédère', 'de la Source', 'du Col', 'des Cimes', 'du Mont'];
const TPL = {
  'Restaurant': ['Le Bistrot {A}', 'Auberge {A}', 'La Table {A}', 'Pizzeria {A}', 'Brasserie {A}', 'Le Refuge {A}', 'Le Relais {A}'],
  'Hôtel': ['Hôtel {A}', 'Hôtel-restaurant {A}', 'Chalet-hôtel {A}', 'Résidence {A}'],
  'Camping': ['Camping {A}', 'Camping municipal {V}'],
  'Café / bar': ['Café {A}', 'Bar {A}', 'Le Comptoir {A}', 'Après-ski {A}'],
  'Boulangerie': ['Boulangerie {A}', 'Fournil {A}', 'Pâtisserie {A}'],
  'Glacier': ['Glacier {A}', 'Les Glaces {A}'],
  'Plage / snack': ['Snack {A}', 'Paillote {A}', 'Snack de la base de loisirs {A}'],
  'Station de ski': ["Restaurant d'altitude {A}", 'Snack des pistes {A}', 'Bar des pistes {A}', 'Self du domaine {A}'],
  'Collectivité': ['Cantine scolaire de {V}', 'EHPAD {A}', 'Restaurant municipal de {V}', 'Collège de {V}'],
  'GMS / supérette': ['Supérette {A}', 'Épicerie {A}', 'Marché fermier de {V}'],
};
const RUES = ['rue de la Gare', 'route de Grenoble', 'place de la Mairie', 'chemin des Écoles', 'avenue de la Libération', 'rue du Lac', 'route des Pistes', 'rue de Belledonne', 'impasse des Chalets', 'Grande Rue', 'route du Col', 'allée des Érables', 'rue des Alpes', 'chemin du Moulin'];
const PRENOMS = ['Marie', 'Julien', 'Sophie', 'Thomas', 'Camille', 'Nicolas', 'Laura', 'Pierre', 'Émilie', 'Antoine', 'Claire', 'Mathieu', 'Céline', 'Romain', 'Anaïs', 'Olivier', 'Pauline', 'Sébastien'];
const NOMS = ['Martin', 'Bernard', 'Rey', 'Blanc', 'Girard', 'Perrin', 'Roux', 'Faure', 'Chabert', 'Arnaud', 'Gauthier', 'Bonnet', 'Mollard', 'Jacquier', 'Buisson', 'Vial', 'Michallet', 'Favre'];
const ROLES = ['Gérant', 'Chef de cuisine', 'Responsable achats', 'Directrice', 'Économe', 'Second de cuisine', 'Propriétaire'];
const NOTES_V = { 'Commande prise': ['Commande habituelle', 'A pris la nouveauté en test', 'Commande + promo du mois', 'Réassort avant le week-end'], 'RAS': ['Stock OK, repasse la semaine prochaine', 'Tout va bien', 'Pas de besoin cette semaine'], 'À rappeler': ['Rappeler pour la carte d\'hiver', 'Attend le retour du chef', 'Veut un devis pour la saison'], 'Absent': ['Fermé à mon passage', 'Gérant absent'], 'Problème': ['Livraison en retard, à suivre', 'Erreur de facturation signalée'], 'Prospection': ['Présentation de la gamme', 'Échantillons laissés'] };
const fakeTel = (mobile) => (mobile ? '06 39 98 ' : '04 65 71 ') + String(int(10, 99)) + ' ' + String(int(10, 99));
const slug = s => s.normalize('NFD').replace(/[^\w]/g, '').toLowerCase().slice(0, 16);

function typesFor(commune) {
  if (commune.nom === 'Les Allues') return ['Hôtel', 'Restaurant', 'Restaurant', 'Station de ski', 'Station de ski', 'Café / bar', 'GMS / supérette', 'Hôtel'];
  if (commune.nom === 'Le Haut-Bréda') return ['Station de ski', 'Restaurant', 'Hôtel', 'Café / bar', 'Station de ski'];
  if (commune.nom === 'Allevard') return ['Restaurant', 'Hôtel', 'Camping', 'Boulangerie', 'Café / bar', 'Collectivité', 'Glacier', 'Restaurant'];
  return ['Restaurant', 'Restaurant', 'Boulangerie', 'Café / bar', 'Collectivité', 'GMS / supérette', 'Camping', 'Glacier', 'Plage / snack', 'Hôtel', 'Restaurant'];
}
const workday = d => { const w = parseD(d).getDay(); return w === 0 ? addDays(d, 1) : w === 6 ? addDays(d, 2) : d; };

export async function chargerDemo() {
  seed = 162; idn = 0;
  const t = today();
  const c0 = cfg();
  // Produits
  const produits = CAT.map(([ref, designation, famille, cond, prix, achat]) => ({ ref, designation, famille, cond, prix: r2(prix), achat: r2(achat), actif: true, nouveaute: NOUVEAUTES.includes(ref), promo: !!PROMOS[ref], promoTexte: PROMOS[ref] || '', demo: true }));
  const byFam = {}; for (const p of produits) (byFam[p.famille] ||= []).push(p);

  // Communes pondérées par le nombre d'adresses de la carte
  const weighted = COMMUNES.flatMap(c => Array(Math.max(1, Math.round(c.n / 2))).fill(c));
  const clients = [];
  const used = new Set();
  const N_CLIENTS = 60, N_PROSP = 14;
  for (let i = 0; i < N_CLIENTS + N_PROSP; i++) {
    const cm = i < 8 ? COMMUNES[[0, 0, 0, 1, 1, 2, 3, 4][i]] : pick(weighted);
    const type = pick(typesFor(cm));
    let name, tries = 0;
    do { name = pick(TPL[type]).replace('{A}', pick(A)).replace('{V}', cm.nom); tries++; } while (used.has(name) && tries < 20);
    used.add(name);
    const big = cm.n > 15;
    const lat = cm.lat + (rnd() - .5) * (big ? 0.03 : 0.012), lng = cm.lng + (rnd() - .5) * (big ? 0.03 : 0.012);
    const prospect = i >= N_CLIENTS;
    const saison = (cm.zone === 'Méribel' || cm.nom === 'Le Haut-Bréda' || type === 'Station de ski') ? 'hiver' : ['Camping', 'Plage / snack', 'Glacier'].includes(type) ? 'ete' : 'annuel';
    const prenom = pick(PRENOMS), nomF = pick(NOMS);
    const c = {
      id: did('c'), demo: true, enseigne: name, nom: rnd() < .5 ? `SARL ${name}` : undefined,
      statut: prospect ? 'prospect' : 'client', typeEtab: type,
      adresse: `${int(1, 180)} ${pick(RUES)}`, cp: String(cm.cp), ville: cm.nom, lat, lng, zone: cm.zone,
      tel: fakeTel(false), email: `contact@${slug(name)}.demo-alpagel.test`,
      numClient: prospect ? undefined : 'C' + String(1000 + i), siret: prospect ? undefined : String(int(300000000, 899999999)) + '000' + int(10, 99),
      jourLivraison: pick(['mardi', 'mercredi', 'jeudi', 'vendredi']),
      contacts: [{ nom: `${prenom} ${nomF}`, role: pick(ROLES), tel: fakeTel(true), email: `${slug(prenom)}.${slug(nomF)}@demo-alpagel.test` }, ...(rnd() < .35 ? [{ nom: `${pick(PRENOMS)} ${pick(NOMS)}`, role: pick(ROLES), tel: fakeTel(true) }] : [])],
      tags: [...new Set([saison !== 'annuel' ? 'saisonnier' : null, rnd() < .25 ? 'terrasse' : null, rnd() < .15 ? 'gros potentiel' : null, rnd() < .1 ? 'paiement à surveiller' : null, rnd() < .2 ? 'fidèle' : null, rnd() < .1 ? 'livraison difficile' : null].filter(Boolean))],
      materiel: [], creneaux: [], fermeture: [],
      frequence: pick(type === 'Collectivité' || type === 'GMS / supérette' ? [21, 28] : saison === 'hiver' ? [7, 14] : [14, 14, 21, 28]),
      saison, moisFermes: saison === 'ete' ? [1, 2, 3, 10, 11, 12] : saison === 'hiver' && type === 'Station de ski' ? [5, 6, 7, 8, 9, 10] : saison === 'hiver' ? [5, 6, 10] : [], _size: 0.6 * Math.exp(between(-0.6, 1.0)) * (type === 'Hôtel' || type === 'Station de ski' || type === 'Collectivité' ? 1.6 : 1),
      notes: saison === 'hiver' ? 'Ouvert de mi-décembre à mi-avril. Commandes de mise en place fin novembre.' : saison === 'ete' ? 'Saison de mai à septembre.' : '',
    };
    if (type === 'Restaurant') c.fermeture = [pick([1, 3])];
    if (type === 'Boulangerie') c.fermeture = [1];
    if (rnd() < .12) c.creneaux = [['09:30', '11:00'], ['15:00', '17:00']];
    if (['Glacier', 'Camping', 'Café / bar', 'Plage / snack', 'GMS / supérette'].includes(type) && !prospect) {
      c.materiel.push({ designation: pick(['Vitrine à glaces 10 bacs', 'Congélateur coffre 400 L', 'Congélateur vitré']), serie: `${pick(['VG', 'CC', 'CV'])}-${int(2019, 2025)}-${int(1000, 9999)}`, date: addDays(t, -int(60, 1500)), note: rnd() < .3 ? 'Contrat de prêt signé' : '' });
    }
    if (!prospect && rnd() < .07) c.finContrat = addDays(t, int(3, 28));
    else if (!prospect && rnd() < .1) c.finContrat = addDays(t, int(60, 400));
    clients.push(c);
  }
  // Clients récents (nouveaux) et ancienneté
  const start = addDays(t, -548); // 18 mois
  clients.filter(c => c.statut === 'client').forEach((c, i) => {
    c.depuis = i < 2 ? addDays(t, -int(2, 12)) : i < 5 ? addDays(t, -int(40, 120)) : addDays(start, -int(30, 2000));
    if (i < 5) { c.etape = 'Gagné'; c.etapeDate = c.depuis; }
  });
  // Prospects
  const etapes = ['À contacter', 'À contacter', 'À contacter', 'À contacter', 'À contacter', 'RDV pris', 'RDV pris', 'RDV pris', 'RDV pris', 'Devis envoyé', 'Devis envoyé', 'Devis envoyé', 'Perdu', 'Perdu'];
  clients.filter(c => c.statut === 'prospect').forEach((c, i) => {
    c.etape = etapes[i]; c.etapeDate = addDays(t, -int(1, 40));
    c.prochainContact = c.etape === 'Perdu' ? undefined : addDays(t, int(-5, 15));
    c.notes = pick(['Travaille avec un concurrent, intéressé par nos glaces artisanales', 'Nouveau gérant depuis septembre', 'Ouverture prévue pour la saison', 'Demande des prix sur les surgelés salés']);
    c.frequence = 21;
  });

  // Ventes : commandes hebdo / bimensuelles avec saisonnalité, croissance et quelques cas d'alerte
  const ventes = [], commandes = [], visites = [];
  const actifs = clients.filter(c => c.statut === 'client');
  const stopped = new Set(actifs.slice(6, 9).filter(c => c.saison === 'annuel').map(c => c.id));
  actifs.forEach((c, ci) => {
    const pref = PREF[c.typeEtab] || PREF.Restaurant;
    const fams = Object.entries(pref);
    const totalW = fams.reduce((a, [, w]) => a + w, 0);
    const nProd = int(8, 20);
    const habit = new Map();
    for (let k = 0; k < nProd * 3 && habit.size < nProd; k++) {
      let x = rnd() * totalW, fam = fams[0][0];
      for (const [f, w] of fams) { x -= w; if (x <= 0) { fam = f; break; } }
      const p = pick(byFam[fam]);
      if (!habit.has(p.ref)) habit.set(p.ref, { p, base: between(1, 4) * c._size, prob: between(.35, .9) });
    }
    const arretRef = ci % 7 === 0 ? [...habit.keys()][0] : null;
    const arretDate = addDays(t, -int(80, 120));
    const remise = between(0, 0.08);
    const ordFreq = c.saison === 'hiver' ? 7 : pick([7, 14]);
    const stopAt = stopped.has(c.id) ? addDays(t, -int(55, 95)) : null;
    const baisse = ci % 11 === 3; // CA en baisse sur 3 mois
    let d = workday(addDays(c.depuis > start ? c.depuis : start, int(0, 6)));
    while (d <= t) {
      if (stopAt && d > stopAt) break;
      const m = parseD(d).getMonth();
      const f = SAISON[c.saison][m] * (1 + 0.07 * (1 - (parseD(t) - parseD(d)) / (365 * 86400e3))) * (baisse && d > addDays(t, -95) ? 0.55 : 1);
      if (rnd() < Math.min(1, f * 1.15) && f > 0.02) {
        const cmdId = null; // plus de saisie de commandes dans l'app : tout passe par les ventes
        const lignes = [];
        for (const [ref, h] of habit) {
          if (ref === arretRef && d > arretDate) continue;
          if (rnd() > h.prob) continue;
          const qte = Math.max(1, Math.round(h.base * Math.max(1, f) * between(.6, 1.4)));
          const pu = r2(h.p.prix * (1 - remise));
          lignes.push({ ref, designation: h.p.designation, cond: h.p.cond, qte, pu, pa: h.p.achat });
        }
        if (lignes.length) {
          lignes.forEach((l, i) => ventes.push({ id: cmdId ? cmdId + '-' + i : did('v'), cmdId: cmdId || undefined, clientId: c.id, date: d, ref: l.ref, designation: l.designation, qte: l.qte, ht: r2(l.qte * l.pu), marge: r2(l.qte * (l.pu - l.pa)), source: cmdId ? 'commande' : 'import', demo: true }));
          if (cmdId) {
            const totalHT = r2(lignes.reduce((a, l) => a + l.qte * l.pu, 0));
            commandes.push({ id: cmdId, numero: `${d.replace(/-/g, '').slice(2)}-${String(commandes.length + 1).padStart(3, '0')}`, clientId: c.id, date: d, livraison: workday(addDays(d, 2)), lignes, totalHT, marge: r2(lignes.reduce((a, l) => a + l.qte * (l.pu - l.pa), 0)), statut: 'envoyée', note: '', demo: true });
          }
        }
      }
      d = workday(addDays(d, ordFreq + (rnd() < .2 ? 7 : 0)));
    }
    // Objectif mensuel pour les plus gros clients
    if (c._size > 0.8) {
      const ca12 = ventes.filter(v => v.clientId === c.id && v.date > addDays(t, -365)).reduce((a, v) => a + v.ht, 0);
      if (ca12 > 2000) c.objectifMensuel = Math.round(ca12 / 12 * 1.08 / 50) * 50;
    }
  });

  // Visites : le jour de la zone, selon la fréquence, sur les 6 derniers mois
  const jz = c0.joursZones;
  const dayOfZone = z => { for (const d of [1, 2, 3, 4, 5]) if ((jz[d] || []).includes(z)) return d; return 5; };
  const cmdDates = new Map(); for (const v of ventes) cmdDates.set(v.clientId + v.date, true);
  for (const c of clients) {
    const dz = dayOfZone(c.zone);
    const late = rnd() < .22;
    let d = addDays(t, -int(1, 7) - (late ? int(30, 50) : 0));
    while (parseD(d).getDay() !== dz) d = addDays(d, -1);
    const first = c.statut === 'prospect' ? addDays(t, -60) : addDays(t, -183);
    let n = 0;
    while (d > first && n < 30) {
      if (d <= t && !(c.depuis && d < c.depuis)) {
        let res;
        if (c.statut === 'prospect') res = c.etape === 'À contacter' ? null : 'Prospection';
        else { const wk = [0, 1, 2, 3, 4].some(k => cmdDates.has(c.id + addDays(d, k)) || cmdDates.has(c.id + addDays(d, -k))); res = wk && rnd() < .8 ? 'Commande prise' : pick(['RAS', 'RAS', 'À rappeler', 'Absent', 'RAS', 'Problème']); }
        if (res) visites.push({ id: did('vi'), clientId: c.id, date: d, heure: `${int(8, 17)}:${pick(['00', '15', '30', '45'])}`, resultat: res, note: rnd() < .55 ? pick(NOTES_V[res]) : '', demo: true });
        if (c.statut === 'prospect' && n >= 1) break;
      }
      d = addDays(d, -Math.max(7, Math.round((c.frequence || 14) / 7) * 7) * (c.saison === 'hiver' && parseD(d).getMonth() >= 4 && parseD(d).getMonth() <= 10 ? 2 : 1));
      n++;
    }
  }

  // Rappels
  const rappels = [];
  const R = ['Envoyer le tarif saison d\'hiver', 'Rappeler pour la mise en place de la vitrine', 'Proposer la croziflette (nouveauté)', 'Faire signer le contrat de prêt', 'Relancer le devis', 'Point sur la carte des desserts', 'Vérifier la livraison de jeudi', 'Présenter les promos du mois'];
  for (let i = 0; i < 10; i++) rappels.push({ id: did('r'), clientId: pick(clients).id, date: addDays(t, int(-6, 18)), texte: pick(R), fait: false, cree: addDays(t, -int(1, 20)), demo: true });
  for (let i = 0; i < 6; i++) rappels.push({ id: did('r'), clientId: pick(clients).id, date: addDays(t, -int(8, 60)), texte: pick(R), fait: true, faitLe: addDays(t, -int(1, 7)), demo: true });

  // Situation, jours de visite et de télévente, périodes de fermeture
  const SIT = ['Redressement judiciaire', 'Paiement à surveiller', 'Paiement à surveiller', 'En vente / changement de gérant', 'Compte bloqué'];
  clients.filter(c => c.statut === 'client').slice(10, 15).forEach((c, i) => { c.situation = SIT[i]; c.situationDate = addDays(t, -int(20, 200)); if (i === 0) c.situationNote = 'Mandataire nommé, paiement à la commande'; });
  const jz2 = cfg().joursZones;
  for (const c of clients) {
    if (c.statut === 'client' && rnd() < .45) { const d = [1, 2, 3, 4, 5].find(j => (jz2[j] || []).includes(c.zone)); if (d) c.jourVisite = d; }
    if (c.statut === 'client' && rnd() < .5) c.jourAppel = int(1, 5);
    const y = parseD(t).getFullYear();
    if ((c.moisFermes || []).length) {
      const m = c.moisFermes;
      c.periodesFermeture = c.saison === 'ete' ? [{ du: `${y}-10-01`, au: `${y}-03-31`, annuel: true, motif: 'Fermeture hivernale' }]
        : c.type === 'Station de ski' || c.typeEtab === 'Station de ski' ? [{ du: `${y}-04-25`, au: `${y}-11-30`, annuel: true, motif: 'Hors saison' }]
        : [{ du: `${y}-05-01`, au: `${y}-06-30`, annuel: true, motif: 'Intersaison' }, { du: `${y}-10-01`, au: `${y}-11-30`, annuel: true, motif: 'Intersaison' }];
      delete c.moisFermes;
    }
  }
  const conges = clients.filter(c => c.saison === 'annuel' && c.statut === 'client');
  if (conges[3]) conges[3].periodesFermeture = [{ du: addDays(t, 2), au: addDays(t, 12), annuel: false, motif: 'Congés' }];
  if (conges[7]) conges[7].periodesFermeture = [{ du: addDays(t, -3), au: addDays(t, 6), annuel: false, motif: 'Travaux' }];
  for (const c of clients) delete c._size;
  await bulkPut('produits', produits);
  await bulkPut('clients', clients);
  for (let i = 0; i < ventes.length; i += 4000) await bulkPut('ventes', ventes.slice(i, i + 4000));
  await bulkPut('visites', visites);
  await bulkPut('rappels', rappels);

  // Objectifs mensuels (N-1 + 7 %) et prime d'exemple, mémorisés pour pouvoir les retirer
  const objectifs = { ...c0.objectifs }, added = [];
  const caMois = new Map(); for (const v of ventes) { const k = v.date.slice(0, 7); caMois.set(k, (caMois.get(k) || 0) + v.ht); }
  for (let i = -2; i <= 10; i++) {
    const d = new Date(parseD(t).getFullYear(), parseD(t).getMonth() + i, 1); const k = ym(iso(d));
    const kn1 = `${+k.slice(0, 4) - 1}${k.slice(4)}`;
    if (objectifs[k] == null && caMois.get(kn1)) { objectifs[k] = Math.round(caMois.get(kn1) * 1.07 / 500) * 500; added.push(k); }
  }
  await setKV('demoBackup', { objectifs: added, prime: c0.prime });
  const primeVide = !(c0.prime.paliers || []).some(p => +p.montant > 0) && !c0.prime.taux;
  await saveCfg({ demo: true, objectifs, ...(primeVide ? { prime: { base: 'ca', taux: 0.5, paliers: [{ seuil: 90, montant: 150 }, { seuil: 100, montant: 350 }, { seuil: 110, montant: 600 }] } } : {}) });
  await setKV('tournees', {});
}

export async function effacerDemo() {
  const demoC = new Set(S.clients.filter(c => c.demo).map(c => c.id));
  for (const s of ['clients', 'visites', 'commandes', 'produits', 'ventes', 'rappels']) {
    const key = s === 'produits' ? 'ref' : 'id';
    const ids = S[s].filter(x => x.demo).map(x => x[key]);
    // Les ventes issues d'une commande saisie sur une fiche démo partent aussi
    if (s !== 'clients' && s !== 'produits') for (const v of S[s]) if (!v.demo && demoC.has(v.clientId)) ids.push(v.id);
    if (ids.length) await bulkDel(s, ids);
  }
  const bk = kv('demoBackup', { objectifs: [] });
  const c = cfg();
  const objectifs = { ...c.objectifs }; for (const k of bk.objectifs || []) delete objectifs[k];
  await saveCfg({ demo: false, objectifs, ...(bk.prime ? { prime: bk.prime } : {}) });
  await setKV('tournees', {});
  await setKV('matCache2', []);
}
