# Voyages animés

L’intégration reprend le moteur original d’Atlas Motion (Sites, version 3, source `0a0150d99da9a9dedd0c2b75e69187d21904703d`), conservé dans `public/atlas`. Elle ne dépend pas de l’accès au Site privé : le globe, Three.js, D3, Lucide et la texture terrestre sont servis avec le carnet. Les bibliothèques conservent leurs mentions de licence ; les sources et attributions sont recensées dans `public/atlas/ORIGIN.md`.

## Utilisation

Depuis **Planifier**, ajouter le départ puis les escales. Ouvrir les détails de chaque étape pour choisir un résultat de recherche ou saisir sa latitude et sa longitude. Sélectionner le transport vers chaque étape après la première et, si souhaité, le chapitre dont les photos doivent apparaître à l’arrivée.

**Voir le voyage** est accessible depuis le plan et le carnet. La lecture parcourt toutes les liaisons et ménage quatre secondes à chaque arrivée, avec jusqu’à trois photos du chapitre associé, couverture en premier. Le curseur, le choix du trajet et « Voir l’arrivée » permettent une consultation directe. Le mode carte numérote les étapes et représente leurs liaisons illustrées. La durée sélectionnée (12/18/24 s) concerne l’animation, pas le temps de transport réel.

La démonstration `#motion/demo` ne crée ni ne modifie de données personnelles. Elle est accessible depuis le carnet de démonstration.

## Données et comportement

- `PlanStop` conserve son identifiant et accepte `point: {lat, lon}`, `transport` et `chapterId`, tous facultatifs pour lire les anciens plans. Le transport décrit l’arrivée depuis l’étape précédente ; après réorganisation il convient de le vérifier.
- Les nouvelles propriétés sont validées à la lecture, à l’écriture et à l’import. Elles voyagent dans les archives ZIP existantes. Aucun nouveau stockage ne duplique les photos.
- Une étape non localisée ou un transport manquant bloque le film complet ; aucune étape intermédiaire n’est sautée. Une référence de chapitre absente conserve le trajet, sans afficher de photos étrangères.
- Le plan appartient à la fiche de préparation. Retirer cette fiche supprime ses étapes ; le carnet conservé garde ses chapitres, mais pas le parcours. Sauvegarder avant retrait.
- Le lecteur et les ressources 3D se chargent seulement en ouvrant la vue. L’iframe locale isole le moteur ; les messages vérifient origine, fenêtre et identifiant de requête. Les photos sont affichées dans React et ne sont pas envoyées au moteur.
- Lecture interrompue quand l’onglet devient caché, lors des changements de données ou de vue ; ressources du lecteur libérées en quittant la vue. Avec mouvements réduits, la navigation est manuelle.

## Services et limites

Recherche explicite via [Photon](https://photon.komoot.io/), avec sélection d’un résultat par l’utilisateur ; saisie GPS disponible si le service échoue. Voiture et marche utilisent [OSRM / FOSSGIS](https://routing.openstreetmap.de/about.html), cache en mémoire et intervalle de 1,1 seconde entre requêtes. Échec explicite, puis repli illustré uniquement sur demande. Avion, bateau et train restent illustratifs ; le train ne prétend pas suivre les rails. Ce lecteur n’est pas un outil de navigation.

Les détails satellite dépendent d’Esri. Le globe de base est local ; les lieux recherchés, coordonnées de calcul et zones de tuiles demandées sont transmis aux services concernés. Les photos et textes ne le sont pas. Les attributions sont visibles dans le rendu et sous le lecteur.

Le panneau **Créer mon film** exporte maintenant tout le voyage, avec un titre, les liaisons et les photos des chapitres. Format horizontal 1280 × 720 ou vertical 720 × 1280 ; 6, 12 ou 18 secondes par liaison, quatre secondes à chaque arrivée, cinq secondes d’introduction/conclusion. MP4 si disponible, sinon WebM. Le fichier est prévisualisable et téléchargeable, puis partageable via le partage natif lorsque le navigateur le propose.

L’encodage MediaRecorder s’effectue en temps réel dans l’onglet visible, avec une musique locale facultative. La limite est de cinq minutes et 200 Mo. Annulation, perte de contexte 3D, changement d’onglet, suspension prolongée et erreurs d’encodage ne proposent pas de fichier partiel. Les itinéraires et photos sont préparés avant le démarrage ; une erreur routière bloque l’export, sauf choix explicite de l’option « Illustrer toutes les liaisons ». La navigation des carnets et leurs sauvegardes restent utilisables sans WebGL.

## Construction sur la carte

Le filtre « Journée sur la carte » affiche les escales d’une date ou celles à programmer. Les numéros restent ceux du parcours complet ; aucune liaison artificielle ne relie deux escales séparées par une étape masquée. Choisir une date recadre la carte et préremplit la date des nouvelles escales. Sélectionner un repère ouvre ses informations pratiques et jusqu’à trois photos, avec un accès au chapitre du carnet.

Le plan affiche une carte Leaflet chargée à la demande avec le module de préparation. Rechercher via Photon, choisir un résultat ou cliquer sur la carte, nommer le lieu, choisir son transport et éventuellement sa date et son chapitre, puis enregistrer. Les repères se déplacent à la souris ou au toucher ; l’enregistrement reste explicite. La liste et les champs GPS existants fournissent une alternative au pointage. Les retraits depuis la carte sont annulables tant que le parcours n’a pas changé.

Le fond utilise les tuiles standard OpenStreetMap à la demande, avec attribution et sans préchargement ni cache hors connexion spécifique. Les pointillés sont des liaisons illustrées, pas des routes calculées. Aucun service payant ni clé API n’est ajouté.

Le cadrage regroupe les escales qui traversent le méridien 180° (par exemple Fidji–Samoa), sans modifier leurs coordonnées enregistrées. Un chargement incomplet du fond de carte affiche un bouton de reprise ; les étapes restent conservées. Les tests couvrent ce cadrage sur ordinateur et téléphone, ainsi qu’une panne partielle de tuiles suivie d’une reprise avec images de test. L’accès réel aux tuiles reste à vérifier hors du navigateur de test, dont le proxy refuse actuellement ces connexions.

## Montage du film

Chaque arrivée propose une sélection de zéro à trois photos du chapitre associé, leur ordre, une légende de 120 caractères et un cadrage photo entière ou remplissage centré. L’aperçu avant export utilise le même dessin que la vidéo, en horizontal ou vertical. Les choix durent pendant la visite du lecteur ; ils ne modifient pas le carnet et ne sont pas conservés après fermeture de la page. Les quatre secondes d’arrivée sont partagées entre les photos retenues.

Une musique locale facultative (30 Mo maximum, durée décodée de dix minutes maximum) est intégrée par Web Audio à la piste vidéo. Volume réglable, boucle si nécessaire, fondu d’entrée d’une seconde et sortie de deux secondes. Le MP4 avec AAC est choisi lorsqu’il est accepté, sinon WebM avec Opus. Une musique illisible bloque l’export avec un message ; l’annulation et la fin ferment le contexte audio. Aucune donnée n’est transmise à un service de montage.

## Programme quotidien et sauvegardes

### Accès hors connexion

Un téléchargement explicite est proposé dans la préparation, « Aujourd’hui » et les outils de sauvegarde. Le build produit un service worker versionné avec le HTML, les modules JavaScript/CSS et les icônes nécessaires. L’installation ne réussit que lorsque tous ces fichiers sont présents ; aucun serveur tiers, API, carte, moteur 3D ou album distant n’est précaché. Les carnets et leurs photos intégrées restent dans leur stockage local existant. Le mode fonctionne sur HTTPS ou localhost, après une première préparation en ligne ; le serveur de développement ne produit pas ce téléchargement.

Le statut vérifie la présence des fichiers du cache et affiche l’état de connexion du navigateur. Le bouton d’actualisation prépare la version disponible sur le serveur. Une installation échouée ne supprime pas une ancienne version fonctionnelle ; les caches antérieurs sont conservés pour les onglets encore ouverts. Les données et caches peuvent être effacés par le navigateur : l’interface rappelle de vérifier le fonctionnement avant de partir et de conserver une archive ZIP.

Test navigateur : téléchargement, fermeture de la page, coupure réseau, ouverture d’une nouvelle page sur le programme, lecture d’une photo, ajout d’un souvenir, ouverture du plan et actualisation au retour de la connexion. Un refus de téléchargement laisse un statut incomplet et préserve les données.

### Pendant le voyage

La vue `#today/<voyage>` est accessible depuis la bibliothèque, la préparation et le carnet. Elle utilise la date locale de l’appareil, actualisée toutes les trente secondes, et permet de consulter une autre journée. Les escales datées sont triées par heure, les horaires libres viennent ensuite. Le prochain horaire saisi est mis en avant ; aucune durée de trajet ni disponibilité n’est déduite. Les réservations, notes et adresses restent locales.

L’ajout rapide accepte un texte et jusqu’à trois photos par ajout, optimisées avec le même import que le carnet. Un brouillon séparé par voyage, date et escale est récupérable après rechargement. L’enregistrement relit les données courantes, ajoute au chapitre lié ou crée un chapitre daté, puis associe l’escale. Si l’écriture de l’association échoue, l’écriture du carnet est annulée ; la saisie reste disponible pour réessayer. Les limites existantes du carnet s’appliquent toujours. Sans escale, une nouvelle page datée est créée. Cette vue est accessible sans réseau après le téléchargement explicite de l’application décrit ci-dessus.

La préparation regroupe les étapes par date, puis les étapes sans date dans « À programmer ». Chaque étape accepte un type (visite, hébergement, repas ou transport), une heure facultative, une adresse, une référence de réservation et des notes. Changer la date déplace la fiche entre les journées sans réordonner le parcours géographique. À partir de cinq étapes, une indication invite à prévoir les pauses ; elle n’est pas une estimation de durée. Les dates hors du voyage restent possibles et sont signalées.

Le lien d’itinéraire transmet uniquement la destination à Google Maps, à la demande. Les informations pratiques sont facultatives, validées et incluses dans le ZIP ; l’édition cartographique les préserve. La copie HTML destinée au partage conserve son périmètre actuel et n’ajoute pas les références de réservation.

Le panneau de sauvegarde mémorise la date et une empreinte SHA-256 des données réellement utilisées pour la dernière archive téléchargée ou partagée. Il signale les changements ultérieurs. Un partage annulé ne met pas ce suivi à jour. Ce suivi local ne garantit ni le stockage final du fichier, ni sa présence dans Drive ; cette limite est indiquée dans l’interface. Les archives précédentes restent importables.

## Copie de lecture autonome

Chaque carnet personnel propose **Télécharger la copie de lecture** : un fichier HTML autonome contenant ses chapitres, leurs photos, un sommaire et la liste des escales. Il se lit sans connexion et peut être envoyé comme fichier aux proches. Ce n’est ni un lien hébergé, ni une synchronisation, ni une sauvegarde réimportable ; le ZIP reste le format de restauration.

Les textes sont échappés ; seules les images PNG/JPEG/WebP intégrées sont acceptées. Le document exporté interdit scripts, formulaires et connexions externes via sa CSP. Il ne contient aucun script ni référence à un service distant. Limite : 25 Mo.

## Vérification

`npm run build`, `npm run lint` et tests Playwright : globe réel dans Chromium, progression et enchaînement complet, photos et lien du chapitre, saisie GPS et persistance, train et mouvements réduits, panne de routage avec repli explicite, étapes incomplètes et archive ZIP contenant les positions/transports/associations. Le studio est également testé par recherche de lieu, ajout sur carte, retrait/annulation, encodage et décodage de vraies vidéos aux deux formats, annulation d’export, affichage mobile et ouverture hors connexion de la copie HTML avec texte hostile rendu inerte.
