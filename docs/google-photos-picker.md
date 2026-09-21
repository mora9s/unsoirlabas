# Google Photos Picker

## Deux accès distincts

`PHILIPPINES 2027` est un album partagé public de référence :

<https://photos.app.goo.gl/y4cpr6M1oJZZHwro7>

Le bouton **Ouvrir l’album** l’ouvre dans un nouvel onglet, sans l’énumérer ni le
scraper. Ce lien ne donne pas à l’application un droit API. Le Picker Google peut
permettre à une personne de chercher ce titre elle-même, mais ne peut pas être
pré-ouvert ni forcé sur cet album.

## Activer le Picker réel

1. Créer un **client OAuth 2.0 Web** dans Google Cloud et configurer l’écran de
   consentement/les utilisateurs de test selon le compte réel.
2. Ajouter chaque origine HTTPS de déploiement aux *Authorized JavaScript origins*.
   Pour ce prototype privé, l’origine préparée est
   `https://smora-precision-3550.taildf8f08.ts.net:7443`. Elle n’est accessible
   qu’aux appareils autorisés sur le réseau Tailscale. Une adresse LAN HTTP n’est
   pas suffisante pour Google Identity Services.
3. Fournir uniquement l’identifiant public du client, soit à la compilation :

   ```sh
   VITE_GOOGLE_PHOTOS_CLIENT_ID=1234567890-example.apps.googleusercontent.com npm run build
   ```

   soit au démarrage, avant l’application :

   ```html
   <script>
     window.__GOOGLE_PHOTOS_CONFIG__ = {
       clientId: '1234567890-example.apps.googleusercontent.com'
     }
   </script>
   ```

Sans cet identifiant, l’interface désactive honnêtement la connexion Google tout
en laissant l’album partagé et l’import depuis l’appareil utilisables. Aucun secret
OAuth ne doit figurer dans Vite, le dépôt ou le navigateur.

## Flux utilisé

Le client charge Google Identity Services, demande exclusivement le scope :

`https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

L’access token court est conservé seulement dans la mémoire du module. Après une
ouverture de popup synchrone au clic, le client :

1. `POST https://photospicker.googleapis.com/v1/sessions` ;
2. navigue la popup vers le `pickerUri` reçu avec `/autoclose` ;
3. interroge la session avec la configuration de sondage fournie par le serveur,
   dans une limite de temps et avec annulation ;
4. lit les sélections avec `GET /v1/mediaItems?sessionId=...` (100 par page) ;
5. télécharge seulement les images explicitement sélectionnées avec un `baseUrl`
   temporaire (les `baseUrl` durent environ 60 minutes), redimensionné via
   `=w2048-h2048` ;
6. supprime la session dans `finally`.

Les réponses JSON, URL et MIME sont validés. Le client n’appelle que
`photospicker.googleapis.com` pour l’API et accepte seulement des bases HTTPS
Google pour les octets sélectionnés. Les vidéos sont signalées et ignorées dans
cette première version. Le maximum de 12 photos, 12 Mo par photo et une limite de
lot restent appliqués avant la conversion ; une conversion de lot échouée ne modifie
pas le carnet existant.

Les photos réussies sont immédiatement converties par l’import local existant en
JPEG data URL. Elles restent donc disponibles hors ligne, après rechargement et
après sauvegarde/restauration Drive. Les tokens, IDs Google et base URLs ne sont
jamais stockés dans `localStorage`, les brouillons ni les sauvegardes.

Références officielles :

- <https://developers.google.com/photos/picker/guides/get-started-picker>
- <https://developers.google.com/photos/picker/guides/sessions>
- <https://developers.google.com/photos/picker/guides/media-items>
- <https://developers.google.com/photos/picker/guides/picking-experience>
