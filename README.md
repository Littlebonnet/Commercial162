# Tournée Alpagel

Application de suivi commercial pour iPad et iPhone : fiches clients et tournées GPS optimisées, avec comptes rendus de visite et rappels. Les commandes et le chiffre d'affaires restent dans le logiciel de l'entreprise : l'app ne s'en occupe pas.

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

- **Ton nom, téléphone, email** : ils apparaissent sur le rapport hebdo.
- **Adresse du domicile** : point de départ et de retour des tournées (Crolles par défaut).
- **Journée type** : départ, retour au plus tard, pause déjeuner (12 h – 13 h), nombre maximal de visites, durée de visite par défaut.
- **Zones par jour** : lundi rive droite, mardi rive gauche, mercredi Allevard, jeudi Méribel, vendredi Grenoble et rattrapage (modifiable).
- **Alertes** (pas vu depuis X jours, fin de contrat) et **affichage** clair / sombre.

Les **créneaux de passage** et la durée de visite se règlent sur chaque fiche client (jusqu'à 4 créneaux). Un client sans créneau peut être vu à toute heure de ta journée.

### Essayer avec la démo
**Plus → Réglages → Charger la démo** crée environ 60 clients dans tes communes, avec leurs créneaux, des visites, des prospects et des rappels. **Effacer la démo** les retire sans toucher à tes vraies données. Pense à l'effacer avant d'importer tes fichiers.

---

## 4. Importer mes clients (Plus → Import et export)

1. Touche **Modèle Excel** pour voir les colonnes reconnues. Tu n'es pas obligé de l'utiliser : l'application lit aussi ton propre fichier clients.
2. Touche **Choisir un fichier** (.xlsx, .xls, .csv) depuis Fichiers / iCloud Drive / pièce jointe enregistrée.
3. L'application trouve la ligne d'en-tête et **les colonnes** (« N° client », « Nom client », « Adresse 2 », « Tournée », « Jour de visite », « Situation »…). Vérifie la correspondance proposée, corrige si besoin, regarde l'aperçu puis **Importer**.

Les fiches sont créées ou mises à jour (reconnues par n° client, sinon nom + commune), les adresses sont placées sur la carte et la zone de tournée est déduite de la commune.

**Fichier de tournées** : un fichier avec une colonne « Code tournée » et une colonne « Jour de livraison » (et éventuellement le nom de la tournée) est reconnu automatiquement. Les clients de chaque tournée reçoivent son jour de livraison, et ceux importés ensuite aussi. Le modèle Excel contient un onglet Tournées d'exemple.

Astuces :
- **Géolocaliser les fiches sans coordonnées** relance le placement sur la carte (utile après un import hors connexion).
- **Export Excel** : clients, contacts, matériel, visites et rappels dans un classeur.

---

## 5. Sauvegarder (à faire chaque semaine)

Les données vivent dans l'iPad. Si l'application est supprimée ou l'iPad perdu, **seule la sauvegarde permet de les récupérer**.

- **Plus → Sauvegarde → Sauvegarder maintenant** → **Enregistrer dans Fichiers** → **iCloud Drive**. Le fichier `.json` contient tout, photos comprises.
- **Restaurer** remplace les données de l'appareil par celles du fichier (changement d'iPad, passage sur l'iPhone).
- Un rappel s'affiche dans l'onglet **Plus** quand la dernière sauvegarde a plus de 7 jours.

> Ne vide pas les « données de sites web » de Safari pour cette adresse : cela effacerait les données de l'application.

---

## 6. Au quotidien

- **Accueil** : tournée du jour, relances dues, clients appelés aujourd'hui par la télévendeuse, alertes (pas vu depuis X jours, fin de contrat), activité des 4 dernières semaines.
- **Tournée** : proposition automatique (jour de visite de chaque client sinon zone du jour, fréquence de visite, retards, rappels, prospects), heures d'arrivée, créneaux, attentes et pause. Ajoute, retire ou déplace des clients : la tournée se réoptimise. Par arrêt : **Waze**, **Appeler**, **Visite faite** (un appui sur le résultat suffit, note et rappel facultatifs). **Je suis en retard** recalcule le reste de la journée depuis ta position GPS ; **Reporter les visites impossibles** retire ce qui ne tient plus. Bouton **Semaine** : vue des 5 jours par zones.
- **Clients** : recherche, filtres (zone, type, situation, jour de visite ou de télévente, étiquette, prospects, en retard), liste ou carte colorée par type d'établissement. La fiche regroupe la situation (RAS, redressement judiciaire…), le jour de visite et le jour d'appel de la télévendeuse, les créneaux spécifiques, les fermetures (jours de la semaine et périodes datées, éventuellement chaque année), les contacts, matériel prêté avec n° de série, photos et documents et l'historique des visites.
- **Jours des clients** (bouton **Jours** en haut de la liste) : tous les clients en liste avec des boutons Lun → Sam pour le jour de visite, de livraison et, si besoin, de télévente. Un appui choisit, un second efface, tout est enregistré tout de suite. Les mêmes boutons sont sur chaque fiche. Le mode **Par commune** règle d'un coup le jour de visite et le jour de télévente (et, si besoin, de livraison) de tous les clients d'une commune ; ces jours sont aussi donnés aux nouveaux clients importés ou créés dans la commune, sauf si leur fiche en indique un autre. Le mode **Par tournée** règle le ou les jours de livraison de chaque code tournée (GC, TP…) : tu peux créer une tournée et ses jours avant d'importer les clients. Si la tournée n'a qu'un jour, ses clients le reçoivent ; si elle en a plusieurs, le bouton « Choisir le jour de N clients » liste ceux à répartir.
- **Visite la veille de la livraison** : un client livré le mercredi est proposé en tournée le mardi (livré lundi ou samedi → vendredi). Un jour de visite choisi à la main n'est jamais remplacé. Réglable dans Réglages → Journée type.
- **Plus** : prospection (à contacter → RDV pris → devis envoyé → gagné / perdu), rappels, import/export des clients, **rapport hebdo PDF** des visites, sauvegarde, réglages.

---

### Logo
Le petit logo en haut à gauche est un pictogramme provisoire. Pour mettre le logo officiel, dépose-le dans `icons/` (par exemple `icons/logo.png`) et demande son intégration.

## 7. Pour le développement

- HTML/CSS/JavaScript en modules ES, **sans étape de build**. Bibliothèques chargées depuis cdnjs (Leaflet 1.9.4, SheetJS 0.18.5, jsPDF 2.5.1 + autotable 3.8.2) et mises en cache par `sw.js`.
- Serveur local : la configuration `.claude/launch.json` sert le dossier sur <http://localhost:8162> sans cache. En local, le service worker est désactivé ; ajoute `?sw=1` à l'adresse pour tester le mode hors connexion.
- Structure :
  - `js/app.js` : routeur par hash, thème, service worker
  - `js/db.js` : IndexedDB + cache mémoire
  - `js/ref.js` : types, communes, zones, réglages
  - `js/metrics.js` : calculs
  - `js/route.js` : géocodage, trajets, optimisation
  - `js/pdf.js` : rapport hebdo PDF
  - `js/icons.js` : icônes et logo
  - `js/io.js` : import, export, sauvegarde
  - `js/demo.js` : jeu de démonstration
  - `js/ui.js` : composants partagés
  - `js/views/` : un fichier par écran
