Je suis commercial chez Alpagel (distributeur de glaces, surgelés salés, pâtisserie surgelée, produits frais et consommables pour la restauration). Termine l'application iPad de suivi commercial commencée dans ce dossier. Je veux un outil très complet, en français, que j'utilise tous les jours en tournée.

## Choix déjà faits (ne pas remettre en question)
- **App web installable (PWA)**, gratuite : pas d'App Store, pas de Mac. Ajout à l'écran d'accueil depuis Safari, plein écran, fonctionne hors connexion.
- HTML/CSS/JS **sans étape de build** (modules ES), bibliothèques chargées depuis cdnjs et mises en cache par le service worker : Leaflet 1.9.4 + OpenStreetMap, Chart.js 4.4.1, SheetJS (xlsx) 0.18.5, jsPDF 2.5.1 + autotable 3.8.2.
- Géocodage : API Adresse de l'État (api-adresse.data.gouv.fr). Temps de trajet : OSRM public (router.project-osrm.org), estimation à vol d'oiseau hors ligne.
- **Données uniquement sur l'appareil** (IndexedDB), avec sauvegarde/restauration en un clic (fichier JSON, partage vers iCloud Drive). Aucun serveur, rien envoyé à un tiers à part les adresses pour le géocodage et les coordonnées pour les trajets.
- Hébergement final gratuit sur **GitHub Pages** (donne-moi les étapes à la fin).
- Couleurs Alpagel : bleu `#1B6DB5`, rouge `#DD4B3E`. Mode sombre (auto + forcé), **gros boutons** (cibles ≥ 52 px), utilisable debout ou dans la voiture.

## Déjà écrit (à relire et réutiliser, corriger si besoin)
- `index.html` : coque avec barre d'onglets (Accueil, Tournée, Clients, Commandes, Chiffres, Plus), scripts CDN, `js/app.js` en module.
- `css/app.css` : tout le style (cartes, listes, boutons, modales, kanban, carte, tableaux, mode sombre).
- `js/db.js` : IndexedDB (stores clients, visites, commandes, produits, ventes, rappels, fichiers, kv) + cache mémoire `S` avec compteur `S.rev`.
- `js/util.js` : formatage €, dates, heures, modale, toast, confirmation, partage natif iOS, téléchargement.
- `js/ref.js` : types d'établissement (couleur, durée et créneaux par défaut), **les 36 communes de mon secteur** avec coordonnées, nombre d'adresses et zone, alias de lieux-dits, étapes de prospection, réglages par défaut `cfg()`.
- `js/metrics.js` : CA, marge, N vs N-1, objectifs, prime, nouveaux clients, retard de visite, top produits, suggestions « clients similaires », produits arrêtés, alertes, activité.
- `js/route.js` : géocodage, matrice de trajets, planification avec créneaux stricts et pause déjeuner, optimisation (plusieurs départs + 2-opt + or-opt + recuit simulé), sélection automatique des clients du jour, liens Waze/Plans/Google Maps.
- `js/pdf.js` : bon de commande PDF (avec signature) et rapport hebdo PDF.
- `carte_communes_A1.png` : carte de mon secteur (36 communes, 205 adresses).

## Reste à faire
1. `js/app.js` : routeur par hash (`#/accueil`, `#/clients/:id`…), bouton retour, thème, enregistrement du service worker.
2. Les vues (dans `js/views/`) décrites plus bas.
3. `js/io.js` : import Excel/CSV avec **détection automatique des colonnes** (clients, ventes/CA, catalogue), modèle Excel à télécharger, export Excel complet, sauvegarde/restauration JSON (photos comprises).
4. `js/demo.js` : jeu de démo réaliste (≈ 60 clients dans mes communes, ≈ 80 produits, 18 mois de ventes, visites, prospects) chargeable et effaçable depuis Réglages, pour essayer avant d'importer mes vraies données.
5. `sw.js`, `manifest.webmanifest`, icônes PNG (180, 192, 512).
6. `.claude/launch.json` pour servir le dossier en local, puis **tester dans le navigateur en format iPad** (paysage et portrait, clair et sombre) et corriger.
7. `README.md` en français : installation sur iPad, import de mes données, sauvegarde, publication sur GitHub Pages.

## Mes réponses au questionnaire
- Appareils : iPad, iPhone. Réseau : presque toujours. Stockage : sur l'iPad + sauvegarde. Moi seul. Logiciel Alpagel : inconnu, donc import flexible.
- Clients : restaurants, hôtels, campings, cafés/bars, boulangeries, glaciers, plages/snacks, **stations de ski**, collectivités, GMS/supérettes. 150 à 300 clients, 50 à 200 prospects. **Saison forte en hiver.**
- Fiche client : contact, téléphone, email, adresse, type d'établissement, SIRET / n° client, jour de livraison, notes libres. **Plusieurs contacts** par client. Pas de classement A/B/C. **Tags libres**. **Photos et documents**. **Matériel prêté avec n° de série** et date. Compte rendu de visite **rapide (1 clic + note)**.
- Relances : client pas vu depuis X jours, rappels datés, client qui ne commande plus, fin de contrat.
- Tournée : départ et retour **à mon domicile**, **plus de 12 visites/jour**, durée selon le type de client, **créneaux clients stricts** (jamais pendant le service), **fréquence de visite fixe par client**, l'app propose la tournée **et** je peux la modifier (puis elle réoptimise), **zones fixes par jour** (lundi rive droite, mardi rive gauche, mercredi Allevard, jeudi Méribel, vendredi Grenoble et rattrapage, modifiable), navigation **Waze**, pas de suivi km, pause déjeuner 12 h - 13 h, carte colorée **par type d'établissement**. Bouton « je suis en retard » qui réoptimise depuis ma position GPS.
- Chiffres : source du CA inconnue, donc saisie via mes commandes **et** import Excel. Analyse par client, mois, zone, type de client. Objectifs mensuels, par client, nouveaux clients. **N vs N-1**. **CA + marge**. **Prime calculée en temps réel** (paliers d'atteinte d'objectif + % du CA ou de la marge, réglables).
- Commandes : je les prends chez le client, **bon de commande PDF envoyé par email** (partage iOS). Catalogue actuel en **PDF, plus de 1000 références**, donc import Excel/CSV + recherche rapide + ajout manuel.
- Top 20 produits **en quantités, par client** (et global en bonus). Aides à la vente : produits que prennent les clients similaires, nouveautés/promos du mois.
- Pipeline de prospection : à contacter → RDV pris → devis envoyé → gagné (devient client) / perdu.
- Accueil le matin : tournée du jour, CA du mois vs objectif, relances, alertes.
- Rapport hebdo PDF pour mon manager. Indicateurs d'activité (visites/jour, taux visite → commande, transformation des prospects).
- **Priorités du jour 1 : fiches clients, tournée GPS optimisée, prise de commande.** Elles doivent être parfaites avant le reste.

## Vues attendues
- **Accueil** : tournée du jour (nombre de visites, heure de fin, bouton démarrer), CA du mois vs objectif avec N-1, prime estimée et ce qu'il manque pour le palier suivant, relances dues, alertes, indicateurs d'activité.
- **Tournée** : choix du jour, proposition automatique, ajout/retrait de clients, carte avec arrêts numérotés et tracé, liste avec heures d'arrivée, créneaux, attentes et pause. Par arrêt : Waze, appeler, visite faite (compte rendu 1 clic + note + rappel), commande. Vue semaine par zones.
- **Clients** : recherche, filtres (zone, type, tag, prospects, en retard), liste et carte. Fiche complète : contacts, créneaux, fermeture, fréquence, matériel, photos/documents, historique des visites et commandes, CA 12 mois et N-1, objectif, top 20 en quantités, produits arrêtés, suggestions. Création/modification avec auto-complétion d'adresse et zone déduite de la commune.
- **Commandes** : liste, éditeur rapide (produits habituels du client avec +/-, recherche catalogue, nouveautés, suggestions), total HT et marge, signature au doigt, PDF et partage.
- **Chiffres** : graphiques N vs N-1 par mois, CA/marge par client, zone et type, objectifs par client, top 20 global, nouveaux clients, activité.
- **Plus** : prospection (kanban), rappels, catalogue, import/export, rapport hebdo, sauvegarde, réglages (domicile, horaires, pause, zones par jour, durées et créneaux par type, fréquence, seuils d'alerte, objectifs, prime, thème, démo).

Lis d'abord les fichiers existants, puis avance par étapes en testant au fur et à mesure.
