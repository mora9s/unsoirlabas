# Atlas Motion

Static browser-based cinematic journey studio. Published through Sites using `.openai/hosting.json`.

The application supports city/place search via Photon, decimal GPS coordinates and Maps URLs containing coordinates, four transport markers, adaptive globe camera movements, local satellite tiles, timeline controls, and landscape or portrait video export using the browser's MediaRecorder API.

Car and walking journeys use the corresponding OSRM / FOSSGIS routing profiles over OpenStreetMap. The camera follows the distance-sampled route geometry, at a lower altitude for walks. Search errors and disconnected routes block playback and export rather than drawing a straight-line substitute. Plane and boat journeys remain illustrative great-circle connections; there is no maritime routing. Satellite detail depends on Esri availability; city lookup depends on the public Photon service. World imagery, Three.js, D3 and Lucide are served with the application. Video encoding depends on browser support and requires a foreground tab.

## Validation

`node tests/core.test.mjs`

`node tests/routing.test.mjs`

Routing checks cover profile URLs, geometry validation, unsuccessful routes, cancellation, caching, turns without cutting corners, and camera heights. Real car and foot service responses were checked for Nice → Menton and a walk in Nice, including cross-origin access. The pure-coordinate checks exercise decimal GPS formats, Google Maps URLs, invalid bounds, identical endpoints and international date-line handling. JavaScript syntax and local asset references are checked before publication. Managed preview does not provide a compatible browser test surface for this static build; real browser recording and optional WebMCP registration still need runtime verification.

## Sources

- Three.js r160: https://threejs.org/ — MIT.
- D3 7.9.0: https://d3js.org/ — ISC.
- Lucide 0.468.0: https://lucide.dev/ — ISC.
- Earth image: https://github.com/vasturiano/three-globe/tree/master/example/img
- Detailed satellite imagery: Esri World Imagery, credit returned by the service: Esri, Vantor, Earthstar Geographics, and the GIS User Community.
- Routing: https://routing.openstreetmap.de/about.html — OSRM / FOSSGIS; OpenStreetMap contributors. Requests are cached and spaced at least 1.1 seconds apart.
- Place data: OpenStreetMap contributors, searched through https://photon.komoot.io/.

## Agent support

When `document.modelContext` is present, `configure_journey` updates the same visible journey state, while `read_journey` returns the current configuration. Neither tool starts recording or downloads a file.
