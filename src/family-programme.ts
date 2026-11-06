import type { StageId } from "./family-data";
import credits from "../public/assets/visayas/credits.json";

export { credits };
export const photoLabels = {
  moalboal: "Plage de Basdako à Moalboal",
  apo: "Apo Island, au large de Negros",
  turtle: "Tortue photographiée à Apo Island",
  siquijor: "Les cascades de Cambugahay à Siquijor",
  bohol: "Les Chocolate Hills à Carmen, dans l’intérieur de Bohol",
  cebu: "La Croix de Magellan à Cebu ville, sur l’île voisine de Mactan",
} as const;
export interface PlanDay {
  date: string;
  stage: StageId;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
  alternative: string;
  photo?: keyof typeof photoLabels;
}
export const daily: PlanDay[] = [
  {
    date: "2027-02-17",
    stage: "moalboal",
    title: "Arriver, souffler, se poser",
    morning:
      "À l’arrivée envisagée à Cebu à 06h10, retrouver le chauffeur et prendre un petit-déjeuner. Prévoir environ 3h30 à 5h de route vers Moalboal, avec une pause pour les enfants.",
    afternoon:
      "Déjeuner près de l’hôtel, poser les bagages puis dormir. Demander à l’avance si une chambre sera prête tôt.",
    evening:
      "Si tout le monde est réveillé, petite promenade à Panagsama et dîner simple, par exemple à Island Wok si vous logez au Pescadores.",
    alternative:
      "Chambre encore occupée ou enfants épuisés ? Prévoir un sac de change accessible, une table au calme et annuler la promenade.",
    photo: "moalboal",
  },
  {
    date: "2027-02-18",
    stage: "moalboal",
    title: "Le premier masque, à la piscine",
    morning:
      "Prendre le petit-déjeuner sans réveil. Essayer les masques et les gilets dans la piscine, un adulte auprès de chaque enfant.",
    afternoon:
      "Après un déjeuner léger et une sieste, rejoindre White Beach pour jouer dans le sable. Garder l’entrée dans l’eau facultative.",
    evening:
      "Rester pour la lumière de fin de journée, puis dîner près de l’hôtel.",
    alternative:
      "Vent sur la plage ? Garder la piscine si elle est ouverte ou choisir un goûter à l’abri. White Beach peut attendre le 21.",
  },
  {
    date: "2027-02-19",
    stage: "moalboal",
    title: "Les sardines de Panagsama",
    morning:
      "Retrouver un guide pour une courte mise à l’eau depuis le bord, seulement si les conditions conviennent aux enfants. Observer le banc de sardines et, si elle passe, une tortue à distance.",
    afternoon:
      "Brunch et repos à l’hôtel. Laisser les enfants choisir entre piscine et dessin des poissons observés.",
    evening:
      "Dîner tôt à Panagsama. Vérifier avec le chauffeur les possibilités d’accès à Kawasan le lendemain.",
    alternative:
      "Courant, fatigue ou appréhension ? Un parent reste à terre avec l’enfant. Reporter la sortie au 21 si la mer s’améliore.",
  },
  {
    date: "2027-02-20",
    stage: "moalboal",
    title: "Kawasan à hauteur d’enfant",
    morning:
      "Faire confirmer la veille un accès simple à la cascade pour un enfant de 5 ans. Partir avec le chauffeur uniquement si cette formule est possible.",
    afternoon:
      "Déjeuner en route et rentrer pour une sieste. Une baignade dépend des zones autorisées et des conditions du jour.",
    evening: "Repas tranquille près de l’hôtel, sans autre déplacement.",
    alternative:
      "Si l’accès impose des sauts ou si l’eau monte après la pluie, laisser Kawasan de côté. Préférer une matinée au village et un déjeuner en famille.",
  },
  {
    date: "2027-02-21",
    stage: "moalboal",
    title: "Une journée à garder libre",
    morning:
      "Reprendre le snorkeling si une sortie a été reportée. Sinon, retourner à White Beach avec une serviette et des jeux de sable.",
    afternoon:
      "Déjeuner sur place ou rentrer pour la piscine. Pescador Island reste une option uniquement si tous ont envie de bateau et si la mer est calme.",
    evening:
      "Préparer les petits sacs du ferry et confirmer le chauffeur du lendemain.",
    alternative:
      "Si les enfants ont déjà fait le plein de mer, rester au resort. Une sieste et un goûter suffisent pour cette dernière journée.",
  },
  {
    date: "2027-02-22",
    stage: "negros",
    title: "Changer d’île par le sud de Cebu",
    morning:
      "Départ en voiture privée vers Liloan/Santander. Garder une marge pour l’attente au port et prendre le ferry envisagé vers Sibulan.",
    afternoon:
      "Retrouver le chauffeur côté Negros. Déjeuner en route vers Dauin ou Zamboanguita, puis s’installer dans la même chambre pour cinq nuits.",
    evening:
      "Repérer le restaurant du resort et convenir de deux créneaux possibles pour Apo avec un prestataire.",
    alternative:
      "Traversée retardée ? Prévenir le chauffeur et l’hôtel. Supprimer toute visite à l’arrivée et ne prendre qu’une liaison autorisée.",
    photo: "apo",
  },
  {
    date: "2027-02-23",
    stage: "negros",
    title: "Découvrir le rivage de Dauin",
    morning:
      "Prendre ses repères au resort. Demander au guide où l’entrée dans l’eau est adaptée, puis essayer une courte observation depuis le bord.",
    afternoon:
      "Déjeuner sur place et garder l’après-midi pour la sieste ou la piscine. Essayer les gilets des enfants avant la sortie d’Apo.",
    evening:
      "Valider avec le prestataire la météo, le point de départ et la durée réelle de bateau avant de préparer les affaires.",
    alternative:
      "Si la mer bouge, rester sur le rivage. Choisir les masques en piscine et reporter l’essai en mer.",
  },
  {
    date: "2027-02-24",
    stage: "negros",
    title: "Apo Island, au rythme des tortues",
    morning:
      "Premier créneau proposé pour Apo. Partir avec des gilets à la bonne taille et un guide qui accepte une sortie courte. Observer depuis la surface, sans toucher ni suivre les tortues.",
    afternoon:
      "Retour, déjeuner et repos. Si l’un des enfants préfère rester à terre avec un adulte, prévoir cette option avant le départ.",
    evening: "Dîner au resort et trier les photos ensemble.",
    alternative:
      "Si la traversée est déconseillée, déplacer Apo au 26. Inverser avec la promenade à Dumaguete ou rester près de la piscine.",
    photo: "turtle",
  },
  {
    date: "2027-02-25",
    stage: "negros",
    title: "Un matin à Dumaguete",
    morning:
      "Faire une courte balade avec chauffeur entre le marché et le front de mer. Choisir un fruit à goûter et s’arrêter avant la grosse chaleur.",
    afternoon:
      "Déjeuner en ville, par exemple au Sans Rival Bistro si les horaires conviennent. Retour à Dauin pour le repos.",
    evening: "Fin d’après-midi libre au resort et dîner sur place.",
    alternative:
      "Fatigue après le bateau ? Raccourcir la visite à un seul arrêt pour le déjeuner ou la décaler au lendemain.",
  },
  {
    date: "2027-02-26",
    stage: "negros",
    title: "Le créneau de secours pour Apo",
    morning:
      "Si Apo a été reportée, reprendre la décision avec le guide selon l’état de la mer. Sinon, laisser la matinée libre à Dauin.",
    afternoon:
      "Après le déjeuner, choisir entre une balade courte côté terre et les jeux au resort. Garder du temps pour préparer le transfert.",
    evening:
      "Confirmer les billets, le port exact de Dumaguete et le rendez-vous à l’arrivée à Siquijor.",
    alternative:
      "Si les bateaux restent à quai, profiter de Negros. Une journée de plage ou de lecture garde toute sa place dans le voyage.",
  },
  {
    date: "2027-02-27",
    stage: "siquijor",
    title: "Arriver à San Juan",
    morning:
      "Chauffeur jusqu’au port de Dumaguete puis traversée envisagée vers Siquijor. Vérifier le quai, les bagages et la prise en charge côté île.",
    afternoon:
      "Rejoindre San Juan. Déjeuner, installation pour six nuits et découverte de la piscine.",
    evening:
      "Premier dîner près de la chambre. La plage au coucher du soleil dépendra de l’heure d’arrivée.",
    alternative:
      "Ferry décalé ? Prévenir les deux hôtels et demander un transfert adapté au nouveau port ou à l’heure effective.",
    photo: "siquijor",
  },
  {
    date: "2027-02-28",
    stage: "siquijor",
    title: "Cambugahay, une cascade sans se presser",
    morning:
      "Faire confirmer la praticabilité des marches et l’état de la rivière. Descendre tranquillement avec un guide local, sans prévoir de saut.",
    afternoon:
      "Déjeuner puis retour à San Juan. Préserver une vraie pause au frais après les marches.",
    evening:
      "Dîner près de l’hôtel et laisser chacun choisir sa photo de la cascade.",
    alternative:
      "Après de fortes pluies, renoncer à la rivière. Avancer la visite de Lazi si la route est praticable, sinon rester au resort.",
  },
  {
    date: "2027-03-01",
    stage: "siquijor",
    title: "La vie locale autour de Lazi",
    morning:
      "Partir en voiture pour une visite courte du secteur de l’église de Lazi. Demander avant d’entrer ou de photographier et garder du temps pour observer la vie du village.",
    afternoon:
      "Déjeuner sur la route du retour. Le Balete Tree est un arrêt facultatif si les enfants ont encore de l’énergie.",
    evening:
      "Soirée libre à San Juan. Choisir un restaurant accessible avec un retour court.",
    alternative:
      "Fatigue ou lieu fermé ? Garder seulement le déjeuner local. Le lendemain peut commencer plus tard.",
  },
  {
    date: "2027-03-02",
    stage: "siquijor",
    title: "Le récif de Tubod",
    morning:
      "Vérifier l’ouverture du sanctuaire, la marée, le courant et les consignes locales. Prévoir une seule courte session guidée, avec possibilité de rester sur la plage.",
    afternoon:
      "Déjeuner à San Juan puis sieste. Laisser les palmes de côté le reste de la journée.",
    evening:
      "Dîner dans le secteur de San Juan, par exemple au Baha Bar si la carte et l’horaire conviennent aux enfants.",
    alternative:
      "Si la mer ou l’entrée à l’eau est difficile, reporter au 4 mars. Choisir un jeu au sec ou la piscine si elle est accessible.",
  },
  {
    date: "2027-03-03",
    stage: "siquijor",
    title: "Paliton en fin de journée",
    morning:
      "Matinée libre à la piscine. Faire participer les enfants au choix des fruits ou du goûter à emporter.",
    afternoon:
      "Après la sieste, partir vers Paliton Beach pour marcher sur le sable et chercher un endroit où s’asseoir à l’ombre.",
    evening:
      "Rester pour le coucher de soleil si la météo s’y prête. Organiser le retour en voiture avant de s’installer.",
    alternative:
      "Ciel couvert ? Garder la courte promenade si les conditions sont bonnes, ou choisir un goûter abrité à San Juan.",
  },
  {
    date: "2027-03-04",
    stage: "siquijor",
    title: "Une dernière journée sans valises",
    morning:
      "Rattraper une activité manquée si tout le monde en a envie. Sinon, laisser les enfants choisir leur plage ou leur piscine préférée.",
    afternoon:
      "Déjeuner tranquillement et se reposer. Vérifier la liaison Siquijor–Tagbilaran et le chauffeur vers Panglao.",
    evening:
      "Préparer un petit sac avec boissons, change et jeux pour la traversée. Dîner tôt.",
    alternative:
      "Si la traversée du lendemain est incertaine, contacter l’opérateur et les hôtels pour connaître les possibilités réelles de report.",
  },
  {
    date: "2027-03-05",
    stage: "bohol",
    title: "Bohol, un seul hôtel à Panglao",
    morning:
      "Rejoindre le port puis prendre le ferry envisagé pour Tagbilaran. Retrouver le chauffeur pour Panglao, idéalement côté Dumaluan.",
    afternoon:
      "S’installer pour trois nuits. Déjeuner à l’hôtel et profiter de la piscine ou du sable selon la fatigue.",
    evening:
      "Dîner à proximité. Confirmer le chauffeur privé et les deux arrêts retenus pour le lendemain.",
    alternative:
      "Arrivée tardive ? Garder simplement le dîner et le sommeil. Si la traversée est annulée, adapter la durée à Bohol en préservant le retour à Cebu le 8.",
    photo: "bohol",
  },
  {
    date: "2027-03-06",
    stage: "bohol",
    title: "Corella et la rivière de Loboc",
    morning:
      "Avec un chauffeur privé, découvrir le Philippine Tarsier Sanctuary à Corella si la visite est ouverte. Suivre le guide, parler bas et garder le flash éteint.",
    afternoon:
      "Poursuivre vers Loboc pour déjeuner près de la rivière. Revenir à Panglao assez tôt pour la piscine. Si les Chocolate Hills sont votre priorité, choisir Carmen à la place de Loboc.",
    evening: "Dîner près de la plage sans reprendre une longue route.",
    alternative:
      "Si les enfants sont fatigués, garder uniquement Corella. En cas de fortes pluies, reporter la sortie au 7 et rester à l’hôtel.",
  },
  {
    date: "2027-03-07",
    stage: "bohol",
    title: "Dumaluan, les pieds dans le sable",
    morning:
      "Choix principal : matinée à Dumaluan, baignade si les conditions sont bonnes et jeux à l’ombre. Balicasag peut remplacer cette matinée si la mer et l’encadrement conviennent.",
    afternoon:
      "Déjeuner près de la plage, sieste et piscine. Confirmer la traversée vers Cebu et l’horaire de prise en charge à Panglao.",
    evening:
      "Dernier dîner à Bohol. Préparer les bagages en gardant un change accessible pour Mactan.",
    alternative:
      "Mer agitée ? Rester à terre. Si la sortie à Corella a été décalée, la faire aujourd’hui à la place de la plage.",
  },
  {
    date: "2027-03-08",
    stage: "mactan",
    title: "Rejoindre Cebu la veille du vol",
    morning:
      "Chauffeur jusqu’au port de Tagbilaran puis ferry envisagé vers Cebu. Choisir une traversée laissant de la marge pour les attentes.",
    afternoon:
      "Transfert jusqu’à Mactan et installation pour une nuit. Garder le reste de l’après-midi pour se reposer.",
    evening:
      "Dîner sur place. Reconfirmer le vol, le transfert et les possibilités de douche après la libération de la chambre.",
    alternative:
      "En cas d’avis de perturbation, étudier dès le 7 mars un retour anticipé. Contacter l’opérateur si le départ choisi est annulé.",
    photo: "cebu",
  },
  {
    date: "2027-03-09",
    stage: "mactan",
    title: "Une dernière matinée avant le retour",
    morning:
      "Petit-déjeuner tranquille et baignade à l’hôtel si possible. Vérifier bagages, documents et heure recommandée d’arrivée à l’aéroport.",
    afternoon:
      "Déjeuner, douche ou chambre tardive selon l’accord de l’hôtel. Partir avec une marge adaptée au trafic et aux formalités.",
    evening:
      "Départ international étudié à 19h35, arrivée à Nice envisagée le 10 mars. Prévoir des vêtements confortables pour la nuit.",
    alternative:
      "Sans départ tardif, réserver une solution de douche ou utiliser la bagagerie. Avancer le transfert si le trafic ou l’horaire de vol change.",
  },
];
