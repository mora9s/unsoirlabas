# Exemple Visayas · 20 jours

Branche : feat/visayas-showcase. Entrée : `/#visayas`, depuis l’accueil et la démonstration historique. Film sans écriture : `/#motion/visayas`.

## Contenu

20 journées et 20 chapitres fictifs, 25 points géographiques indicatifs. Cebu (J1–2), Bohol (J3–6), Siquijor (J7–10), Negros oriental (J11–14), sud de Cebu et retour (J15–20). Les points intermédiaires représentent l’aéroport et les ports de transfert. Le vol international est hors circuit ; aucun train ou vol intérieur inventé pour illustrer un mode de transport.

Chaque journée comprend matin, après-midi, soirée, secteur suggéré pour la nuit et récit original clairement fictif. Les heures de visite sont des propositions, pas des horaires d’ouverture. Aucun tarif, disponibilité, numéro de réservation ou horaire de ferry n’est présenté comme réel. Sources géographiques consultées le 25/09/2026 : Philippine Department of Tourism (philippines.travel), carte TPB des Visayas et OceanJet. Les conditions réelles doivent être vérifiées avant départ.

## Copie et conservation

Le visiteur choisit une date puis ajoute explicitement une copie séparée (`visayas-20-demo`). L’import charge six photographies locales et prépare des JPEG allégés intégrés dans les 20 chapitres. Les lectures et validations sont répétées après les téléchargements. Une copie déjà présente ne peut pas être écrasée ; limites et erreurs de stockage sont explicites. L’échec de la seconde écriture restaure la première collection. Les données entrent dans les sauvegardes ZIP existantes et les copies HTML.

Le bouton donne ensuite accès au plan, à Aujourd’hui, au carnet, au film et aux outils. La consultation du modèle reste sans écriture. Le film illustré de 25 étapes dure 4 min 05 au rythme dynamique ; les rythmes plus longs dépassent la limite existante de cinq minutes et sont donc bloqués.

## Images et crédits

Six photographies documentaires de Wikimedia Commons, détails dans `public/assets/visayas/credits.json` : auteur, page source, licence, URL d’origine et consultation. Elles illustrent leur région et ne représentent pas toutes le lieu précis de chaque journée. Aucun paysage de Palawan n’illustre une escale des Visayas.

Les crédits sont visibles sur la page, dans les récits et noms des médias exportés en ZIP/HTML. Le film et les cartes PNG affichent aussi le crédit des photos concernées. Les photos gardent leurs licences CC BY/CC BY-SA ; les miniatures, compressions et cadrages sont signalés. Les récits sont du contenu éditorial original, pas des citations de guides.

## Vérification

Tests Playwright : 20 journées, 25 repères, lecteur prêt, durée du film, zéro écriture pendant la consultation, affichage mobile, import avec conservation d’un voyage existant, dates consécutives et limite mémoire, 20 photos embarquées dans le ZIP, absence de doublon et rollback en cas de quota. Build TypeScript/Vite et lint.
