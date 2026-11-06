// Times are suggested family pacing, never operator schedules.
type Kind = "Repas" | "Trajet" | "Activité" | "Repos";
export type Stop = readonly [when: string, kind: Kind, title: string, detail: string, destination?: string, mode?: "driving" | "walking"];
type Guide = { pack: string; next: string; stops: Stop[] };
export const guide: Record<string, Guide> = {
  "2027-02-17": {
    pack: "Dans le bagage cabine : change léger, gourdes, en-cas et maillots. Garder le contact du chauffeur accessible sans réseau.",
    stops: [
      ["06:10", "Trajet", "Arrivée prévue à Cebu", "Suivre les indications pour les bagages. Une fois réunis, prévenir le chauffeur au point convenu.", "Mactan Cebu International Airport, Lapu-Lapu City"],
      ["Après les bagages", "Repas", "Petit-déjeuner avant la route", "Passer aux toilettes et remplir les gourdes avant de monter en voiture."],
      ["Matinée", "Trajet", "Voiture privée vers Moalboal", "Compter environ 3 h 30 à 5 h selon le trafic. Montrer l’adresse de l’hôtel réellement réservé et demander une pause à mi-chemin."],
      ["À l’arrivée", "Repas", "Déjeuner près de la chambre", "Si vous logez au Pescadores, Island Wok évite un autre trajet. Vérifier que la cuisine sert à l’arrivée.", "Island Wok, Pescadores Suites, Moalboal"],
      ["14:00", "Repos", "Douche, rideaux fermés, sieste", "Demander la bagagerie si la chambre n’est pas prête. Laisser chacun récupérer du vol."],
      ["17:30", "Activité", "Prendre l’air à Panagsama", "Petite boucle à pied depuis l’hôtel si la distance le permet. Garder le dîner tout près.", "Panagsama Beach, Moalboal"],
      ["18:30", "Repas", "Dîner tôt à l’hôtel", "Préparer les affaires de piscine avant de se coucher."]
    ], next: "Demain : demander à la réception le trajet aller-retour pour White Beach et garder le numéro du chauffeur."
  },
  "2027-02-18": {
    pack: "Masques, gilets à la taille des enfants, chapeaux, eau et vêtements secs pour le retour.",
    stops: [
      ["08:30", "Repas", "Petit-déjeuner sans réveil", "Manger à l’hôtel. Décaler toute la matinée si les enfants dorment encore."],
      ["10:00", "Activité", "Premiers essais en piscine", "Essayer masque et gilet avec un adulte auprès de chaque enfant. Quelques minutes suffisent."],
      ["12:00", "Repas", "Déjeuner près de la chambre", "Choisir un plat familier, remplir les gourdes et garder le goûter pour la plage."],
      ["13:00", "Repos", "Sieste au frais", "Faire confirmer le retour par le même chauffeur."],
      ["15:30", "Trajet", "Voiture jusqu’à White Beach", "Demander la dépose à l’accès de Basdaku et convenir du point exact de reprise avant de descendre.", "Basdaku White Beach, Moalboal, Cebu", "driving"],
      ["16:00", "Activité", "Jeux sur le sable", "Chercher l’ombre et garder le temps de se changer avant la voiture."],
      ["18:30", "Repas", "Retour et dîner à Panagsama", "Manger près de l’hôtel pour pouvoir rentrer à pied si l’accès s’y prête."]
    ], next: "Demain : obtenir le lieu de rendez-vous précis du guide de Panagsama, l’heure adaptée aux conditions et le matériel prévu pour chaque enfant."
  },
  "2027-02-19": {
    pack: "Gilets essayés la veille, serviettes, change, eau et collation pour la sortie de l’eau.",
    stops: [
      ["06:45", "Repas", "Petite collation au réveil", "Caler le réveil sur le rendez-vous réel et la consigne du guide."],
      ["Avant la mise à l’eau", "Trajet", "Rejoindre le guide à Panagsama", "Le repère de plage sert à s’orienter. Utiliser le point envoyé par le guide pour le retrouver.", "Panagsama Beach, Moalboal"],
      ["Matin frais", "Activité", "Observer le banc de sardines", "Demander une session courte et une sortie facile. Un adulte reste avec chaque enfant, sans poursuivre les animaux."],
      ["10:00", "Repas", "Brunch au retour", "Sécher les enfants, prendre un vrai repas et vérifier que tout le matériel a été rendu."],
      ["13:00", "Repos", "Sieste puis carnet des poissons", "Laisser libre le reste de l’après-midi, sans deuxième excursion."],
      ["18:00", "Repas", "Dîner et préparer le départ", "Dîner à proximité puis séparer le petit sac du ferry des grandes valises."]
    ], next: "Demain : Moalboal → Liloan (Santander) → Sibulan → hôtel de Negros. Confirmer les deux chauffeurs et le port sur le billet."
  },
  "2027-02-20": {
    pack: "Billets et coordonnées des deux chauffeurs en capture d’écran, goûter, eau, change et jeux dans le petit sac.",
    stops: [
      ["Avant le départ", "Repas", "Petit-déjeuner et départ de l’hôtel", "Vérifier les tiroirs et régler la chambre. Adapter le réveil au billet du jour."],
      ["Selon le billet", "Trajet", "Moalboal → Liloan, à Santander", "Faire confirmer le terminal par le chauffeur. Il s’agit de Santander, au sud de Cebu.", "Liloan Port, Santander, Cebu", "driving"],
      ["Au port", "Trajet", "Traversée vers Sibulan", "Suivre la limite de présentation de l’opérateur. Garder billets, eau et vêtements secs avec vous.", "Sibulan Port, Negros Oriental"],
      ["À terre", "Trajet", "Retrouver le chauffeur côté Negros", "Envoyer le point de rendez-vous à la descente et donner l’adresse du resort de Dauin ou Zamboanguita."],
      ["À l’arrivée", "Repas", "Déjeuner au resort", "Prévoir un en-cas au port si l’attente repousse le déjeuner."],
      ["Après-midi", "Repos", "Installation pour cinq nuits", "Commencer par les lits, la salle de bain et le coin piscine."],
      ["18:30", "Repas", "Dîner au resort", "Demander à l’équipe qui organise Apo et comment elle confirme les conditions le matin."]
    ], next: "Demain : journée près de l’hôtel. Faire préciser le point d’entrée dans l’eau à Dauin et les tailles de gilets disponibles."
  },
  "2027-02-21": {
    pack: "Chaussures pour le rivage, eau, serviettes et masques. Garder les vêtements secs à portée de main.",
    stops: [
      ["08:00", "Repas", "Petit-déjeuner au resort", "Demander au guide à quel endroit rejoindre le rivage depuis l’hôtel."],
      ["09:30", "Activité", "Découvrir le bord de mer à Dauin", "Observer d’abord depuis le bord. Une courte mise à l’eau accompagnée suffit si l’accès et la mer conviennent."],
      ["11:00", "Repos", "Douche et jeux au sec", "Ranger les affaires mouillées et regarder ensemble les poissons reconnus."],
      ["12:00", "Repas", "Déjeuner sur place", "Prévoir un repas simple et prendre le goûter pour plus tard."],
      ["13:30", "Repos", "Sieste puis piscine", "Essayer les gilets prévus pour Apo sans organiser une nouvelle sortie."],
      ["18:00", "Repas", "Dîner et préparer le sac bateau", "Vérifier l’encadrement et l’endroit où un adulte peut attendre avec un enfant."]
    ], next: "Demain : noter le lieu réel d’embarquement pour Apo, le transport de l’hôtel au bateau, l’heure de retour et la décision météo du guide."
  },
  "2027-02-22": {
    pack: "Gilets enfants, protections contre le soleil, serviettes, eau et collation. Confirmer qui reste à terre avec un enfant s’il le souhaite.",
    stops: [
      ["Avant le rendez-vous", "Repas", "Petit-déjeuner au resort", "Demander la décision du guide sur la mer avant de quitter la chambre."],
      ["Selon le guide", "Trajet", "Hôtel → embarcadère convenu", "Utiliser la localisation fournie par le prestataire. Apo Island sur la carte est la destination, pas le point de départ."],
      ["Matinée", "Activité", "Bateau et observation à Apo Island", "Après la traversée, repérer où ressortir de l’eau. Garder la session courte, avec un adulte par enfant et à distance des tortues.", "Apo Island, Dauin, Negros Oriental"],
      ["Après la sortie", "Repas", "Collation puis déjeuner", "Se changer d’abord. Confirmer au départ si le déjeuner se prend sur l’île ou au retour."],
      ["Au retour", "Repos", "Douche et sieste à l’hôtel", "Aucune autre route aujourd’hui."],
      ["18:30", "Repas", "Dîner et regarder les photos", "Laisser les enfants raconter leur rencontre préférée."]
    ], next: "Demain : convenir avec le chauffeur d’une boucle courte à Dumaguete, avec reprise après le déjeuner."
  },
  "2027-02-23": {
    pack: "Petite monnaie pour le marché, eau, chapeaux et point de reprise envoyé au chauffeur.",
    stops: [
      ["07:30", "Repas", "Petit-déjeuner avant la ville", "Réserver la matinée au marché pour marcher avant la chaleur."],
      ["08:30", "Trajet", "Voiture de Dauin à Dumaguete", "Demander une dépose près du marché et convenir de la reprise sur le front de mer.", "Dumaguete Public Market, Dumaguete", "driving"],
      ["09:30", "Activité", "Marché puis front de mer", "Choisir un fruit ensemble. Rejoindre Rizal Boulevard pour une courte promenade et une pause à l’ombre.", "Rizal Boulevard, Dumaguete"],
      ["11:45", "Repas", "Déjeuner au Sans Rival Bistro", "Vérifier le service du jour avant de quitter le marché. Prévenir le chauffeur à la commande.", "Sans Rival Bistro, Rizal Boulevard, Dumaguete"],
      ["13:00", "Trajet", "Retour au resort", "Demander au chauffeur de reprendre la famille au point convenu."],
      ["14:00", "Repos", "Sieste et après-midi libre", "Pas d’autre sortie après le trajet."],
      ["18:30", "Repas", "Dîner à l’hôtel", "Choisir un repas tranquille sur place."]
    ], next: "Demain : garder Dauin libre et organiser les billets pour Siquijor avant de quitter Negros."
  },
  "2027-02-24": {
    pack: "Journée légère : affaires de piscine. Mettre à part billets, vêtements et en-cas du transfert de demain.",
    stops: [
      ["08:30", "Repas", "Petit-déjeuner sans départ imposé", "Le programme principal reste sur place après la première journée prévue pour Apo."],
      ["10:00", "Activité", "Matinée libre à Dauin", "Revenir sur le rivage près du resort pour chercher des coquilles du regard et dessiner les formes dans le sable."],
      ["12:00", "Repas", "Déjeuner au resort", "Demander à la réception si un petit-déjeuner à emporter est possible pour demain."],
      ["13:30", "Repos", "Sieste puis piscine", "Garder le même hôtel toute la journée."],
      ["16:30", "Trajet", "Préparer le port de Dumaguete", "Recopier la limite de présentation du billet, le terminal et le nom du chauffeur à l’arrivée.", "Port of Dumaguete, Negros Oriental"],
      ["18:30", "Repas", "Dernier dîner à Dauin", "Fermer les grandes valises en gardant le change du ferry à part."]
    ], next: "Demain : hôtel → port de Dumaguete → Siquijor → San Juan. Le port d’arrivée exact est celui du billet."
  },
  "2027-02-25": {
    pack: "Billets, bagages étiquetés, goûter, eau et coordonnées du chauffeur côté Siquijor.",
    stops: [
      ["Avant le départ", "Repas", "Petit-déjeuner et bagages", "Régler l’hôtel et vérifier que le chauffeur a bien l’heure limite de présentation."],
      ["Selon le billet", "Trajet", "Rejoindre le port de Dumaguete", "Montrer le billet au chauffeur pour vérifier l’entrée passagers.", "Port of Dumaguete, Negros Oriental", "driving"],
      ["À l’embarquement", "Trajet", "Traverser vers Siquijor", "Garder le petit sac avec vous. Attendre la confirmation du quai et prévenir le chauffeur de l’heure réelle d’arrivée."],
      ["Au débarquement", "Trajet", "Voiture jusqu’à San Juan", "Retrouver le chauffeur au port inscrit sur le billet et lui montrer l’adresse de l’hôtel réservé."],
      ["À l’arrivée", "Repas", "Déjeuner près de la chambre", "Commander avant de déballer toutes les valises."],
      ["Après-midi", "Repos", "Installation pour sept nuits", "Découvrir la piscine et repérer un coin de repos à l’ombre."],
      ["18:30", "Repas", "Premier dîner à San Juan", "Choisir une table proche avec retour court à l’hôtel."]
    ], next: "Demain : réserver un aller-retour vers Cambugahay, demander l’état des marches et laisser le chauffeur joignable pour le retour."
  },
  "2027-02-26": {
    pack: "Chaussures qui tiennent aux pieds, serviettes, eau, change et petit sac laissant les mains libres.",
    stops: [
      ["07:30", "Repas", "Petit-déjeuner à San Juan", "Faire vérifier l’accès et l’état de la rivière avant de prendre la route."],
      ["08:30", "Trajet", "San Juan → Cambugahay Falls", "Voiture privée jusqu’à l’entrée. Convenir d’une reprise au même endroit.", "Cambugahay Falls, Lazi, Siquijor", "driving"],
      ["09:30", "Activité", "Descente accompagnée vers la cascade", "Prévoir du temps pour les marches à l’aller et à la remontée. Rester près du premier point adapté, sans saut ni balançoire."],
      ["11:30", "Repas", "Déjeuner dans le secteur de Lazi", "Demander au chauffeur une table ouverte sur le trajet retour, avec toilettes."],
      ["13:00", "Trajet", "Rentrer à San Juan", "Garder serviettes et vêtements secs dans la voiture."],
      ["14:00", "Repos", "Sieste après les marches", "Laisser les enfants choisir leur photo préférée en fin d’après-midi."],
      ["18:00", "Repas", "Dîner près de l’hôtel", "Rester à San Juan pour une soirée courte."]
    ], next: "Demain : demander au chauffeur un aller-retour jusqu’à l’église de Lazi avec une dépose près de l’entrée."
  },
  "2027-02-27": {
    pack: "Eau, chapeaux et vêtements adaptés pour entrer dans un lieu de culte. Garder de la petite monnaie pour le déjeuner.",
    stops: [
      ["08:00", "Repas", "Petit-déjeuner à San Juan", "Demander si la visite de l’église est possible ce matin."],
      ["09:00", "Trajet", "Route vers le village de Lazi", "Confirmer la dépose devant San Isidro Labrador et la reprise au même endroit.", "San Isidro Labrador Church, Lazi, Siquijor", "driving"],
      ["10:00", "Activité", "Église et quartier de Lazi", "Demander avant d’entrer ou de prendre une photo. Faire chercher aux enfants un détail de la façade."],
      ["11:45", "Repas", "Déjeuner local à Lazi", "Choisir avec le chauffeur une table ombragée sur la route du retour."],
      ["13:00", "Trajet", "Retour direct à San Juan", "Garder l’après-midi pour l’hôtel."],
      ["14:00", "Repos", "Sieste et temps libre", "Préparer les masques et gilets pour demain."],
      ["18:30", "Repas", "Dîner dans le quartier de l’hôtel", "Revenir tôt pour la sortie au récif."]
    ], next: "Demain : demander au guide de Tubod le créneau de marée, les conditions d’entrée et un repère précis pour se retrouver."
  },
  "2027-02-28": {
    pack: "Masques et gilets, serviettes, vêtements secs, eau. Garder le contact du guide de Tubod.",
    stops: [
      ["Avant la sortie", "Repas", "Petit-déjeuner selon la marée", "Attendre le feu vert du guide et déplacer le réveil selon son vrai rendez-vous."],
      ["Selon le guide", "Trajet", "Rejoindre l’accès au récif de Tubod", "Demander où stationner et où retrouver le guide. Le repère indique le sanctuaire.", "Tubod Marine Sanctuary, San Juan, Siquijor"],
      ["Matinée", "Activité", "Courte observation du récif", "Repérer l’endroit où ressortir. Un adulte accompagne chaque enfant. Laisser coraux et animaux à distance."],
      ["12:00", "Repas", "Déjeuner à San Juan", "Se changer et déjeuner près de l’hôtel après la sortie."],
      ["13:30", "Repos", "Sieste et après-midi au sec", "Faire un petit dessin du récif pour le carnet."],
      ["18:00", "Repas", "Dîner au Baha Ba’r", "Vérifier l’ouverture et le menu enfants, puis organiser le court trajet retour avant de s’installer.", "Baha Bar, San Juan, Siquijor"]
    ], next: "Demain : réserver surtout le retour de Paliton Beach pour ne pas chercher un véhicule avec deux enfants à la tombée du jour."

  },
  "2027-03-01": {
    pack: "Goûter préparé avec les enfants, eau, chapeaux et serviette à étendre sur le sable.",
    stops: [
      ["08:30", "Repas", "Petit-déjeuner en famille", "Choisir ensemble les fruits du goûter."],
      ["10:00", "Activité", "Piscine à San Juan", "Rester au resort pour la matinée et garder l’énergie pour la plage."],
      ["12:00", "Repas", "Déjeuner à l’hôtel", "Commander tôt pour préserver la sieste."],
      ["13:00", "Repos", "Sieste au frais", "Faire confirmer le point de reprise de la voiture."],
      ["15:30", "Trajet", "Voiture vers Paliton Beach", "Descendre près de l’accès autorisé et photographier le point où retrouver le chauffeur.", "Paliton Beach, San Juan, Siquijor", "driving"],
      ["16:00", "Activité", "Goûter puis jouer sur le sable", "S’installer à l’ombre. Profiter de la lumière de fin de journée sans attendre que les enfants soient épuisés."],
      ["18:30", "Repas", "Retour et dîner à San Juan", "Retrouver la voiture à l’heure convenue et dîner près de la chambre."]
    ], next: "Demain : journée sans voiture. Repérer près de l’hôtel une petite portion ombragée pour jouer le matin."
  },
  "2027-03-02": {
    pack: "Carnet, crayons, photos des poissons et gourdes. Pas de sac d’excursion aujourd’hui.",
    stops: [
      ["08:30", "Repas", "Petit-déjeuner et choix du jeu", "Proposer aux enfants une chasse aux traces de crabes ou un dessin des poissons de Tubod."],
      ["09:30", "Activité", "La matinée des enfants à San Juan", "Rejoindre à pied le coin de sable repéré près de l’hôtel, avec un adulte. Revenir avant la chaleur."],
      ["11:00", "Repos", "Douche et temps calme", "Laisser les dessins sécher et ranger les affaires de plage."],
      ["12:00", "Repas", "Déjeuner à deux pas de la chambre", "Pas de voiture à organiser avant la sieste."],
      ["13:30", "Repos", "Sieste et piscine", "Prendre le goûter à l’ombre."],
      ["17:00", "Activité", "Petite promenade autour de l’hôtel", "Faire choisir à chaque enfant la photo du jour."],
      ["18:00", "Repas", "Dîner tôt à San Juan", "Garder le retour court et la soirée libre."]
    ], next: "Demain : récupérer les informations de traversée vers Bohol et demander à l’hôtel combien de temps prévoir jusqu’au port indiqué."
  },
  "2027-03-03": {
    pack: "Maillots pour la matinée. Laisser les grandes valises ouvertes jusqu’après la sieste.",
    stops: [
      ["08:30", "Repas", "Petit-déjeuner sans réveil imposé", "Laisser les enfants choisir leur moment préféré à refaire près du resort."],
      ["10:00", "Activité", "Une dernière piscine à San Juan", "Finir la matinée tranquillement au même hôtel, sans longue excursion."],
      ["12:00", "Repas", "Déjeuner près de la chambre", "Prévoir le goûter de cet après-midi et celui du bateau."],
      ["13:30", "Repos", "Sieste puis valises", "Séparer change, eau et billets des affaires qui iront en soute."],
      ["16:00", "Trajet", "Préparer Siquijor → Tagbilaran", "Lire le port exact sur le billet et partager son emplacement avec le chauffeur. Confirmer une seconde voiture côté Bohol.", "Tagbilaran City Tourist Port, Bohol"],
      ["18:00", "Repas", "Dernier dîner à San Juan", "Régler ce qui peut l’être à la réception et convenir du petit-déjeuner selon le départ."]
    ], next: "Demain : hôtel → port indiqué sur le billet → ferry → port de Tagbilaran → hôtel de Panglao. Garder les deux contacts en capture d’écran."
  },
  "2027-03-04": {
    pack: "Billets, petit sac bateau, change et adresse de l’hôtel de Panglao en capture d’écran.",
    stops: [
      ["Avant la voiture", "Repas", "Petit-déjeuner et départ de San Juan", "Vérifier les bagages avec les enfants et demander à l’hôtel de confirmer le bon port."],
      ["Selon le billet", "Trajet", "San Juan → port de départ", "Utiliser le port exact du billet. Ne pas confondre Siquijor et Larena."],
      ["À l’embarquement", "Trajet", "Ferry vers Tagbilaran", "Demander où déposer les grandes valises. Prévenir le chauffeur côté Bohol en cas de décalage.", "Tagbilaran City Tourist Port, Bohol"],
      ["Au débarquement", "Trajet", "Voiture vers Panglao", "Rejoindre l’hôtel réellement réservé. La base prévue est du côté de Dumaluan."],
      ["À l’arrivée", "Repas", "Déjeuner à l’hôtel", "Manger puis préparer la chambre pour trois nuits au même endroit."],
      ["Après-midi", "Repos", "Sieste puis piscine", "Garder la fin de journée sur place."],
      ["18:30", "Repas", "Dîner près de l’hôtel", "Reconfirmer avec le chauffeur le circuit Corella puis Loboc pour demain."]
    ], next: "Demain : demander un prix aller-retour avec attente à Corella, déjeuner à Loboc et retour à Panglao. Faire préciser les sièges enfants."
  },
  "2027-03-05": {
    pack: "Eau, goûter, petite monnaie et appareil photo sans flash. Demander des sièges adaptés dans la voiture.",
    stops: [
      ["07:30", "Repas", "Petit-déjeuner à Panglao", "Faire vérifier l’ouverture du sanctuaire et l’heure du rendez-vous avec le chauffeur."],
      ["08:15", "Trajet", "Panglao → Corella en voiture", "Montrer au chauffeur le Philippine Tarsier Sanctuary de Corella.", "Philippine Tarsier Sanctuary, Corella, Bohol", "driving"],
      ["Vers 09:30", "Activité", "Observer les tarsiers avec le guide", "Marcher sans bruit et garder le flash éteint. Laisser les enfants observer à leur rythme, sans chercher à approcher les animaux."],
      ["Fin de matinée", "Trajet", "Corella → Loboc", "Convenir d’une table accessible près de la rivière et d’un lieu de reprise.", "Loboc, Bohol", "driving"],
      ["12:00", "Repas", "Déjeuner près de la rivière Loboc", "Privilégier une table à terre pour repartir dès que les enfants ont fini."],
      ["13:30", "Trajet", "Retour au même hôtel de Panglao", "Garder la fin d’après-midi pour le repos et la piscine."],
      ["18:30", "Repas", "Dîner près de la plage", "Choisir une table proche de l’hôtel pour ne pas reprendre la route."]
    ], next: "Demain : demander quel accès à Dumaluan est le plus simple depuis votre hôtel et préparer la traversée du 7 mars."
  },
  "2027-03-06": {
    pack: "Jouets de sable, serviettes, chapeaux, eau puis sac séparé pour le ferry du lendemain.",
    stops: [
      ["08:00", "Repas", "Petit-déjeuner à Panglao", "Demander à l’hôtel l’accès autorisé à Dumaluan et les conditions du jour."],
      ["09:00", "Trajet", "Rejoindre Dumaluan Beach", "Depuis un hôtel en bord de plage, suivre son accès. Depuis une autre adresse, demander la dépose adaptée.", "Dumaluan Beach, Panglao, Bohol"],
      ["09:30", "Activité", "Jeux sur le sable", "Installer le point de retour à l’ombre. Garder l’entrée à l’eau courte et accompagnée."],
      ["12:00", "Repas", "Déjeuner près de la plage", "Rejoindre le restaurant du resort ou la table repérée à l’entrée avant la sieste."],
      ["13:30", "Repos", "Sieste et piscine", "Préparer un change propre pour la route de demain."],
      ["16:00", "Trajet", "Vérifier le retour vers Cebu", "Consulter l’opérateur, la limite de présentation et la prise en charge à Tagbilaran. Vérifier les avis de perturbation dès aujourd’hui.", "Tagbilaran City Tourist Port, Bohol"],
      ["18:00", "Repas", "Dernier dîner à Panglao", "Fermer les valises après le repas. Garder billets et contacts hors de la soute."]
    ], next: "Demain : Panglao → Tagbilaran → Cebu → Mactan. Réserver une traversée qui laisse de la marge et partager le quai réel avec le chauffeur côté Cebu."
  },
  "2027-03-07": {
    pack: "Billets, capture des rendez-vous des deux côtés, en-cas, change, eau et documents de vol à portée de main.",
    stops: [
      ["Avant le départ", "Repas", "Petit-déjeuner et départ de Panglao", "Régler la chambre puis compter les sacs avant la voiture."],
      ["Selon le billet", "Trajet", "Voiture au port de Tagbilaran", "Appliquer la limite de présentation du billet et prévoir le trafic depuis Panglao.", "Tagbilaran City Tourist Port, Bohol", "driving"],
      ["Au port", "Trajet", "Ferry Tagbilaran → Cebu", "Vérifier le départ auprès de l’opérateur. Garder le petit sac avec vous. Le quai à Cebu est celui annoncé pour cette traversée."],
      ["À l’arrivée", "Repas", "Collation ou déjeuner selon l’heure", "Avant de quitter le terminal, faire une pause toilettes et retrouver le chauffeur au point convenu."],
      ["Après le ferry", "Trajet", "Cebu → hôtel de Mactan", "Donner l’adresse exacte de l’hôtel et prévoir la circulation jusqu’à l’île de l’aéroport."],
      ["Après-midi", "Repos", "S’installer pour deux nuits", "Laisser les chambres et les bagages au même endroit jusqu’au jour du vol."],
      ["18:30", "Repas", "Dîner à Mactan", "Demander la douche ou le départ tardif et le transfert aéroport pour le 9."]
    ], next: "Le 8 reste disponible pour rallier Cebu si la traversée du 7 échoue. Une fois à Mactan, aucun ferry n’est prévu le jour du vol."
  },
  "2027-03-08": {
    pack: "Eau pour la visite, puis billets et vêtements confortables à trier pour le long vol.",
    stops: [
      ["08:00", "Repas", "Petit-déjeuner à Mactan", "Demander à la réception de vérifier l’accueil des familles chez Alegre avant toute prise en charge."],
      ["09:30", "Trajet", "Voiture vers l’atelier Alegre", "Organiser l’aller-retour et le point de reprise avec le même chauffeur.", "Alegre Guitar Factory, Lapu-Lapu City, Cebu", "driving"],
      ["10:00", "Activité", "Découvrir la fabrication des guitares", "Visite si l’atelier a confirmé. Laisser les enfants regarder une étape de fabrication et poser une question."],
      ["11:30", "Trajet", "Retour à l’hôtel de Mactan", "Pas de deuxième arrêt sur la route."],
      ["12:00", "Repas", "Déjeuner au resort", "Garder l’après-midi disponible pour les derniers préparatifs."],
      ["13:30", "Repos", "Sieste et piscine", "Préparer le bagage cabine : change, jeux et vêtements pour la nuit."],
      ["18:30", "Repas", "Dîner et vérifier le départ de demain", "Relire le billet, le terminal, l’heure de présentation et le rendez-vous du chauffeur."]
    ], next: "Demain : hôtel de Mactan → aéroport international. Fixer le départ avec l’hôtel en tenant compte du trafic et des consignes de la compagnie."
  },
  "2027-03-09": {
    pack: "Passeports, billets, bagages cabine, vêtements de nuit et jeu individuel pour chaque enfant. Garder une tenue sèche après la piscine.",
    stops: [
      ["08:30", "Repas", "Dernier petit-déjeuner", "Vérifier le statut du vol et les consignes de la compagnie avant de quitter la chambre."],
      ["09:30", "Activité", "Dernière matinée à l’hôtel", "Rester à proximité des bagages. Faire la douche avant la restitution de la chambre ou selon l’accord de départ tardif."],
      ["12:00", "Repas", "Déjeuner sur place", "Garder passeports et billets avec un adulte. Vérifier que le chauffeur a l’heure convenue."],
      ["Début d’après-midi", "Repos", "Temps calme et contrôle des bagages", "Récupérer les valises à la bagagerie et repasser aux toilettes avant la route."],
      ["Selon le billet", "Trajet", "Hôtel → aéroport de Mactan-Cebu", "Viser une arrivée vers 16 h 30 pour le vol prévu à 19 h 35, à avancer si la compagnie le demande. Recalculer le départ selon le trafic et le terminal confirmé.", "Mactan Cebu International Airport, Lapu-Lapu City", "driving"],
      ["Après les contrôles", "Repas", "Collation près de la porte", "Vérifier la porte et l’heure d’embarquement avant de s’installer."],
      ["19:35", "Trajet", "Départ international prévu", "Le billet à jour prime. Garder la correspondance et le prochain numéro de vol accessibles sans réseau."]
    ], next: "Pour la suite vers Nice, ouvrir votre confirmation de vol privée. À chaque escale, suivre la porte annoncée sur les écrans."
  },
};

export function stopMap(stop: Stop) {
  if (!stop[4]) return undefined;
  const destination = stop[4] + ", Philippines";
  const search = new URLSearchParams(stop[5] ? { api: "1", destination, travelmode: stop[5] } : { api: "1", query: destination });
  return "https://www.google.com/maps/" + (stop[5] ? "dir/" : "search/") + "?" + search;
}
export const fieldTiming = "Heures locales proposées pour rythmer la journée. Les billets et rendez-vous confirmés priment. Vérifier l’ouverture des lieux et des cuisines le jour même.";
