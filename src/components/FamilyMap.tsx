import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { stages, kindLabels } from "../family-data";
import type { Place, StageId } from "../family-data";

export default function FamilyMap({
  items,
  stage,
  onSelect,
}: {
  items: Place[];
  stage: StageId | "all";
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    tiles = useRef<L.TileLayer | null>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    select = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
    }).setView([9.7, 123.65], 9);
    map.current = m;
    tiles.current = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    )
      .on("tileerror", () => setFailed(true))
      .addTo(m);
    markers.current = L.layerGroup().addTo(m);
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      markers.current = null;
      tiles.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current,
      group = markers.current;
    if (!m || !group) return;
    group.clearLayers();
    if (stage === "all")
      L.polyline(
        stages.map((s) => [s.lat, s.lon]),
        {
          color: "#537e70",
          weight: 2,
          dashArray: "5 8",
          opacity: 0.5,
          interactive: false,
        },
      ).addTo(group);
    // Overlapping venues remain individually accessible in a popup as well as the list.
    const clusters = new Map<string, Place[]>();
    for (const item of items) {
      const key = `${item.lat.toFixed(3)},${item.lon.toFixed(3)}`;
      clusters.set(key, [...(clusters.get(key) ?? []), item]);
    }
    for (const cluster of clusters.values()) {
      const p = cluster[0],
        symbol =
          cluster.length > 1
            ? String(cluster.length)
            : p.kind === "hotel"
              ? "H"
              : p.kind === "food"
                ? "R"
                : "A";
      const marker = L.marker([p.lat, p.lon], {
        title: cluster.map((p) => p.name).join(", "),
        alt: cluster.map((p) => p.name).join(", "),
        icon: L.divIcon({
          className: "fp-pin-wrap",
          html: `<span class="fp-pin fp-pin-${p.kind}">${symbol}</span>`,
          iconSize: [34, 40],
          iconAnchor: [17, 40],
        }),
      }).addTo(group);
      if (cluster.length === 1) marker.on("click", () => select.current(p.id));
      else {
        const box = document.createElement("div");
        box.className = "fp-cluster";
        for (const item of cluster) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `${item.name} · ${kindLabels[item.kind]}`;
          button.onclick = () => select.current(item.id);
          box.append(button);
        }
        marker.bindPopup(box);
      }
    }
    const current = stages.find((s) => s.id === stage);
    const points = items.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    if (points.length)
      m.fitBounds(points, {
        padding: [35, 35],
        maxZoom: stage === "all" ? 10 : 13,
        animate: false,
      });
    else if (current) m.setView([current.lat, current.lon], 12);
  }, [items, stage]);
  return (
    <div className="fp-map-shell">
      <div
        ref={host}
        className="fp-map"
        aria-label="Carte des options du voyage"
      />
      <div className="fp-map-legend">
        <span>
          <i className="hotel" />
          Hôtels
        </span>
        <span>
          <i className="activity" />
          Activités
        </span>
        <span>
          <i className="food" />
          Restaurants
        </span>
      </div>
      <p>
        {failed
          ? "Fond de carte indisponible. Les repères et la liste restent utilisables."
          : "Positions indicatives · vérifiez l’adresse avant de partir."}{" "}
        {stage === "all" && "Liaisons schématiques, sans calcul de trajet."}
      </p>
      {failed && (
        <button
          className="fp-inline"
          onClick={() => {
            setFailed(false);
            tiles.current?.redraw();
          }}
        >
          Réessayer le fond de carte
        </button>
      )}
    </div>
  );
}
