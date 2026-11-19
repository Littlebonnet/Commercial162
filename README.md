# Tournée Alpagel

Application de suivi commercial pour iPad et iPhone : fiches clients, tournées GPS optimisées, prise de commande avec bon PDF signé, chiffres N vs N-1, objectifs et prime.

- **Gratuite** : pas d'App Store ni de Mac, elle s'installe depuis Safari.
- **Fonctionne hors connexion** : seuls le géocodage des adresses et le calcul des trajets réels utilisent Internet. Sans réseau, les trajets sont estimés.
- **Données uniquement sur l'appareil** : rien n'est envoyé à un serveur, à part les adresses (API Adresse de l'État) et les coordonnées des arrêts (calcul d'itinéraire OSRM).

---

## 1. Mettre l'application en ligne (GitHub Pages, gratuit)

À faire une seule fois, depuis un ordinateur.

1. Crée un compte sur <https://github.com> si tu n'en as pas.
2. Crée un dépôt : bouton **New repository**, nom `tournee` par exemple, visibilité **Public** (GitHub Pages gratuit ne fonctionne qu'avec un dépôt public, mais **tes données clients ne sont jamais dans le dépôt** : elles restent dans l'iPad).
3. Envoie les fichiers de ce dossier dans le dépôt, au choix :
   - **Sans outil** : sur la page du dépôt, **Add file → Upload files**, glisse tout le contenu du dossier (`index.html`, `sw.js`, `manifest.webmanifest`, les dossiers `css`, `js`, `icons`), puis **Commit changes**.
   - **Avec GitHub Desktop** : ajoute ce dossier comme dépôt, fais un commit puis **Publish repository**.
   - **En ligne de commande** :

     ```bash
     git add index.html sw.js manifest.webmanifest css js icons README.md
     ```

     ```bash
     git commit -m "Tournée Alpagel"
     ```

     ```bash
     git remote add origin https://github.com/TON-COMPTE/tournee.git
     ```

     ```bash
     git push -u origin main
     ```
4. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche **main**, dossier **/ (root)**, **Save**.
5. Après une à deux minutes, l'adresse s'affiche en haut de la page Pages : `https://TON-COMPTE.github.io/tournee/`.

> `PROMPT.md` et `carte_communes_A1.png` ne sont pas nécessaires à l'application ; tu peux ne pas les envoyer.

### Mettre à jour l'application plus tard
Remplace les fichiers modifiés dans le dépôt, puis **change le numéro de version** en haut de `sw.js` (`const VERSION = 'v1.0.1'`). Au lancement suivant, l'iPad affiche « Nouvelle version installée » et l'utilise au lancement d'après. Tes données ne sont pas touchées.

---

## 2. Installer sur l'iPad (et l'iPhone)

1. Ouvre **Safari** (pas Chrome) à l'adresse `https://TON-COMPTE.github.io/tournee/`.
2. Touche le bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Lance l'application depuis l'icône : elle s'ouvre en plein écran, sans barre Safari.
4. Au premier calcul de tournée, accepte la **localisation** (utile pour « Je suis en retard »).

Les données de l'iPad et de l'iPhone sont **séparées** : pour passer de l'un à l'autre, fais une sauvegarde sur l'un et restaure-la sur l'autre (voir § 5).

---

## 3. Premiers réglages (Plus → Réglages)

- **Ton nom, téléphone, email** : ils apparaissent sur les bons de commande.
- **Adresse du domicile** : point de départ et de retour des tournées (Crolles par défaut).
- **Journée type** : départ, retour au plus tard, pause déjeuner (12 h – 13 h), nombre maximal de visites.
- **Zones par jour** : lundi rive droite, mardi rive gauche, mercredi Allevard, jeudi Méribel, vendredi Grenoble et rattrapage (modifiable).
- **Durée et créneaux par type d'établissement** : les créneaux évitent les heures de service. Chaque fiche peut avoir ses propres créneaux, sa durée, ses jours et **mois de fermeture** (saisonniers).
- **Alertes, objectifs mensuels, prime** (paliers d'atteinte + % du CA ou de la marge), **thème** clair / sombre / automatique.

### Essayer avec la démo
**Plus → Réglages → Charger la démo** crée environ 60 clients dans tes communes, 87 produits, 18 mois de ventes, des visites, des prospects et des rappels. **Effacer la démo** les retire sans toucher à tes vraies données. Pense à l'effacer avant d'importer tes fichiers.

---

## 4. Importer mes données (Plus → Import / export)

1. Touche **Modèle Excel** pour voir les colonnes reconnues (onglets Clients, Ventes, Catalogue). Tu n'es pas obligé de l'utiliser : l'application lit aussi tes propres fichiers.
2. Touche **Choisir un fichier** (.xlsx, .xls, .csv) depuis Fichiers / iCloud Drive / pièce jointe enregistrée.
3. L'application **détecte le type de fichier** (clients, ventes ou catalogue), la ligne d'en-tête et **les colonnes** (« Code client », « N° client », « CA HT », « Libellé article », « CP »…). Vérifie la correspondance proposée, corrige si besoin, regarde l'aperçu puis **Importer**.

Ordre conseillé :

| Étape | Fichier | Ce qui se passe |
|---|---|---|
| 1 | **Catalogue** (export de ton PDF de plus de 1000 références vers Excel) | Références, désignations, familles, prix de vente et d'achat. Ré-importer met à jour les prix. |
| 2 | **Clients** | Fiches créées ou mises à jour (reconnues par n° client, sinon nom + commune). Les adresses sont géolocalisées et la zone de tournée est déduite de la commune. |
| 3 | **Ventes / CA** | Lignes rattachées aux clients par n° client ou par nom. Accepte des lignes détaillées (date, produit, quantité, montant) ou un simple CA par client et par mois. Cocher « Remplacer les ventes déjà importées sur la période » évite les doublons quand tu ré-importes un mois. |

Astuces :
- Les dates `15/11/2025`, `2025-11-15`, `11/2025`, `nov. 2025` et les montants `1 234,56 €` sont compris.
- Une colonne « Mois de fermeture » (`10-4`, `nov, déc`) marque les saisonniers.
- **Géolocaliser les fiches sans coordonnées** relance le géocodage (utile après un import hors connexion).
- **Export Excel complet** : toutes tes données dans un classeur (clients, contacts, matériel, visites, commandes, ventes, catalogue, rappels).

Les commandes validées dans l'application alimentent aussi le chiffre d'affaires et la marge.

---

## 5. Sauvegarder (à faire chaque semaine)

Les données vivent dans l'iPad. Si l'application est supprimée ou l'iPad perdu, **seule la sauvegarde permet de les récupérer**.

- **Plus → Sauvegarde → Sauvegarder maintenant** → **Enregistrer dans Fichiers** → **iCloud Drive**. Le fichier `.json` contient tout, photos comprises.
- **Restaurer** remplace les données de l'appareil par celles du fichier (changement d'iPad, passage sur l'iPhone).
- Un rappel s'affiche dans l'onglet **Plus** quand la dernière sauvegarde a plus de 7 jours.

> Ne vide pas les « données de sites web » de Safari pour cette adresse : cela effacerait les données de l'application.

---

## 6. Au quotidien

- **Accueil** : tournée du jour, CA du mois vs objectif et N-1, prime estimée et ce qu'il manque pour le palier suivant, relances dues, alertes (pas vu depuis X jours, ne commande plus, CA en baisse, fin de contrat), indicateurs d'activité.
- **Tournée** : proposition automatique (zone du jour, fréquence de visite, retards, rappels, prospects), heures d'arrivée, créneaux, attentes et pause. Ajoute, retire ou déplace des clients : la tournée se réoptimise. Par arrêt : **Waze**, **Appeler**, **Visite faite** (un appui sur le résultat suffit, note et rappel facultatifs), **Commande**. **Je suis en retard** recalcule le reste de la journée depuis ta position GPS ; **Reporter les visites impossibles** retire ce qui ne tient plus. Bouton **Semaine** : vue des 5 jours par zones.
- **Clients** : recherche, filtres (zone, type, tag, prospects, en retard), liste ou carte colorée par type d'établissement. La fiche regroupe contacts, créneaux, fermetures, matériel prêté avec n° de série, photos et documents, historique, CA 12 mois et N-1, objectif, top 20 produits en quantités, produits arrêtés et suggestions.
- **Commandes** : produits habituels du client avec +/-, recherche dans le catalogue, nouveautés et promos, suggestions, total HT et marge, signature au doigt, **Envoyer le bon (PDF)** via le partage iOS (Mail, Messages, AirDrop).
- **Chiffres** : N vs N-1 par mois, par zone, par type, par client, objectifs par client, top 20 global, nouveaux clients, activité.
- **Plus** : prospection (à contacter → RDV pris → devis envoyé → gagné / perdu), rappels, catalogue, import/export, **rapport hebdo PDF** pour ton manager, sauvegarde, réglages.

---

## 7. Pour le développement

- HTML/CSS/JavaScript en modules ES, **sans étape de build**. Bibliothèques chargées depuis cdnjs (Leaflet 1.9.4, Chart.js 4.4.1, SheetJS 0.18.5, jsPDF 2.5.1 + autotable 3.8.2) et mises en cache par `sw.js`.
- Serveur local : la configuration `.claude/launch.json` sert le dossier sur <http://localhost:8162> sans cache. En local, le service worker est désactivé ; ajoute `?sw=1` à l'adresse pour tester le mode hors connexion.
- Structure :
  - `js/app.js` : routeur par hash, thème, service worker
  - `js/db.js` : IndexedDB + cache mémoire
  - `js/ref.js` : types, communes, zones, réglages
  - `js/metrics.js` : calculs
  - `js/route.js` : géocodage, trajets, optimisation
  - `js/pdf.js` : bons de commande et rapports
  - `js/io.js` : import, export, sauvegarde
  - `js/demo.js` : jeu de démonstration
  - `js/ui.js` : composants partagés
  - `js/views/` : un fichier par écran
