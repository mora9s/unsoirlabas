import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { daily, kindLabels, places, stages, tasks } from "../family-data";
import type { Kind, Place, StageId } from "../family-data";
import {
  dateLabel,
  downloadFile,
  emptyChoice,
  exportFamily,
  exportReading,
  familyKey,
  money,
  parseFamilyExport,
  readFamily,
  safeUrl,
  saveFamily,
  statusLabels,
  totals,
} from "../family-store";
import type { Choice, FamilyState } from "../family-store";
import OfflineAccess from "./OfflineAccess";
import { createId } from "../id";
import { readUpcoming } from "../upcoming-trips";
import { saveUpcomingMetadata } from "../trip-journals";
import "./family-planner.css";
const FamilyMap = lazy(() => import("./FamilyMap"));
type Tab = "explore" | "days" | "budget" | "prepare";
function DayNote({
  date,
  saved,
  onSave,
}: {
  date: string;
  saved: string;
  onSave: (value: string, original: string) => boolean;
}) {
  const [draft, setDraft] = useState(saved);
  const original = useRef(saved);
  const dirty = useRef(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!dirty.current) {
      setDraft(saved);
      original.current = saved;
    }
  }, [saved]);
  return (
    <label className="fp-day-note">
      Nos notes pour le {dateLabel(date)}
      <textarea
        value={draft}
        rows={2}
        maxLength={3000}
        placeholder="Un horaire, un rendez-vous, une envie…"
        onChange={(e) => {
          setDraft(e.target.value);
          dirty.current = true;
          setMessage("");
        }}
        onBlur={() => {
          if (dirty.current && draft !== original.current) {
            if (onSave(draft, original.current)) {
              dirty.current = false;
              original.current = draft;
              setMessage("Notes enregistrées.");
            } else
              setMessage(
                "Notes non enregistrées : conservez ce texte et vérifiez le message ci-dessus.",
              );
          }
        }}
      />
      {message && <small role="status">{message}</small>}
    </label>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="fp-dialog"
      aria-labelledby="fp-dialog-title"
      onCancel={close}
    >
      <header>
        <p className="eyebrow">Votre préparation</p>
        <button
          type="button"
          className="fp-close"
          onClick={close}
          aria-label="Fermer la fiche"
        >
          ×
        </button>
        <h2 id="fp-dialog-title">{title}</h2>
      </header>
      {children}
    </dialog>
  );
}
function ChoiceEditor({
  place,
  choice,
  onSave,
  close,
  editPlace,
  removePlace,
}: {
  place: Place;
  choice: Choice;
  onSave: (choice: Choice, original: Choice) => boolean;
  close: () => void;
  editPlace?: () => void;
  removePlace?: () => void;
}) {
  const [draft, setDraft] = useState(choice),
    [error, setError] = useState("");
  const original = useRef(choice);
  const stage = stages.find((s) => s.id === place.stage)!;
  const patch = (v: Partial<Choice>) => setDraft((c) => ({ ...c, ...v }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (Number(draft.paid) > Number(draft.cost)) {
      setError("Le montant payé ne peut pas dépasser le total renseigné.");
      return;
    }
    if (
      Number(draft.paid) > 0 &&
      !["chosen", "booked"].includes(draft.status)
    ) {
      setError(
        "Une option avec un paiement doit être retenue ou réservée pour figurer dans le budget.",
      );
      return;
    }
    if (onSave(draft, original.current)) close();
    else
      setError(
        "Enregistrement impossible. Consultez le message de stockage et exportez votre copie si nécessaire.",
      );
  }
  return (
    <Modal title={place.name} close={close}>
      <div className="fp-detail-intro">
        <span className={`fp-kind ${place.kind}`}>
          {kindLabels[place.kind]}
        </span>
        <span>
          {stage.name} · {place.duration}
        </span>
      </div>
      <p>{place.description}</p>
      {editPlace && (
        <div className="fp-source-links">
          <button type="button" className="fp-inline" onClick={editPlace}>
            Modifier mon lieu
          </button>
          <button type="button" className="fp-inline" onClick={removePlace}>
            Supprimer mon lieu
          </button>
        </div>
      )}
      <div className="fp-advice">
        <strong>Avec les enfants</strong>
        <p>{place.family}</p>
        <strong>Avant de choisir</strong>
        <p>{place.caution}</p>
      </div>
      {place.price && <p className="fp-price-note">{place.price}</p>}
      <div className="fp-source-links">
        {place.source && safeUrl(place.source) && (
          <a href={place.source} target="_blank" rel="noreferrer">
            Site / source ↗
          </a>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${stage.name} Philippines`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Chercher l’adresse ↗
        </a>
      </div>
      <p className="fp-fine">
        {place.verified
          ? "Source consultée le 5 novembre 2026."
          : "Piste à vérifier auprès de l’établissement ou de l’office local."}{" "}
        Prix, horaires et disponibilités 2027 non confirmés. Position
        indicative.
      </p>
      <form onSubmit={submit} className="fp-edit-form">
        <div className="fp-form-grid">
          <label>
            Notre décision
            <select
              value={draft.status}
              onChange={(e) =>
                patch({ status: e.target.value as Choice["status"] })
              }
            >
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            {place.kind === "hotel"
              ? "Date d’arrivée envisagée"
              : "Ajouter à une journée"}
            <input
              type="date"
              min={stage.start}
              max={stage.end}
              value={draft.date}
              onChange={(e) =>
                patch({
                  date: e.target.value,
                  ...(e.target.value && draft.status === "idea"
                    ? { status: "chosen" as const }
                    : {}),
                })
              }
            />
          </label>
        </div>
        <p className="fp-fine">
          « Réservé » est votre déclaration : l’application ne réserve rien. Une
          date associe cette option à votre programme.
        </p>
        <label>
          Nos notes
          <textarea
            value={draft.notes}
            maxLength={4000}
            rows={3}
            placeholder="Ce qui nous plaît, questions à poser, alternative en cas de pluie…"
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        <details className="fp-cost-details">
          <summary>Prix, paiement et réservation</summary>
          <div className="fp-form-grid">
            <label>
              {place.kind === "hotel"
                ? `Total du séjour · ${stage.nights} nuits · 4 personnes (€)`
                : "Montant total pour quatre (€)"}
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={draft.cost}
                onChange={(e) => patch({ cost: e.target.value })}
              />
            </label>
            <label>
              Déjà payé pour quatre (€)
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={draft.paid}
                onChange={(e) => patch({ paid: e.target.value })}
              />
            </label>
            <label>
              Nature du prix
              <select
                value={draft.priceType}
                onChange={(e) =>
                  patch({ priceType: e.target.value as Choice["priceType"] })
                }
              >
                <option value="estimate">Estimation personnelle</option>
                <option value="quote">Devis reçu</option>
                <option value="confirmed">Prix confirmé par vous</option>
              </select>
            </label>
            <label>
              Date de vérification du prix
              <input
                type="date"
                value={draft.checked}
                onChange={(e) => patch({ checked: e.target.value })}
              />
            </label>
          </div>
          <label>
            Référence / conditions d’annulation
            <input
              maxLength={300}
              value={draft.reference}
              onChange={(e) => patch({ reference: e.target.value })}
            />
          </label>
        </details>
        {error && (
          <p role="alert" className="fp-error">
            {error}
          </p>
        )}
        <div className="fp-dialog-actions">
          <button className="fp-primary" type="submit">
            Enregistrer mon choix
          </button>
          <button className="fp-secondary" type="button" onClick={close}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AddPlace({
  stage,
  onAdd,
  close,
  initial,
}: {
  stage: StageId;
  onAdd: (place: Place) => boolean;
  close: () => void;
  initial?: Place;
}) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      s = stages.find((s) => s.id === d.get("stage"))!;
    const source = String(d.get("source") || "").trim();
    if (source && !safeUrl(source)) {
      setError("Utilisez un lien HTTPS complet.");
      return;
    }
    const lat = d.get("lat"),
      lon = d.get("lon");
    if (Boolean(lat) !== Boolean(lon)) {
      setError(
        "Renseignez latitude et longitude ensemble, ou laissez les deux vides.",
      );
      return;
    }
    const p: Place = {
      id: initial?.id ?? `custom-${createId()}`,
      stage: s.id,
      kind: d.get("kind") as Kind,
      name: String(d.get("name")).trim(),
      description: String(d.get("description")).trim(),
      family: "À vérifier selon nos besoins.",
      caution: lat
        ? "Position saisie par vous, à vérifier."
        : "Repère placé au centre de l’étape ; adresse exacte à vérifier.",
      lat: lat ? Number(lat) : s.lat,
      lon: lon ? Number(lon) : s.lon,
      source,
      verified: false,
      tags: ["Ajout personnel"],
      duration: "À préciser",
    };
    if (onAdd(p)) close();
    else
      setError(
        "Impossible d’ajouter ce lieu. Vérifiez les données et le stockage.",
      );
  }
  return (
    <Modal
      title={initial ? "Modifier mon idée" : "Une nouvelle idée"}
      close={close}
    >
      <form onSubmit={submit} className="fp-edit-form">
        <label>
          Nom du lieu
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={initial?.name}
          />
        </label>
        <div className="fp-form-grid">
          <label>
            Étape
            <select name="stage" defaultValue={stage}>
              {stages.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select name="kind" defaultValue={initial?.kind ?? "hotel"}>
              {Object.entries(kindLabels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Ce qui nous attire
          <textarea
            name="description"
            maxLength={2000}
            rows={3}
            defaultValue={initial?.description}
          />
        </label>
        <label>
          Lien de l’établissement
          <input
            name="source"
            defaultValue={initial?.source}
            type="url"
            placeholder="https://…"
            maxLength={1000}
          />
        </label>
        <details>
          <summary>Situer précisément sur la carte</summary>
          <p className="fp-fine">
            Facultatif. Sans coordonnées, le repère reste au centre de l’étape.
          </p>
          <div className="fp-form-grid">
            <label>
              Latitude
              <input
                name="lat"
                type="number"
                min="-90"
                max="90"
                step="any"
                defaultValue={initial?.lat}
              />
            </label>
            <label>
              Longitude
              <input
                name="lon"
                type="number"
                min="-180"
                max="180"
                step="any"
                defaultValue={initial?.lon}
              />
            </label>
          </div>
        </details>
        {error && (
          <p role="alert" className="fp-error">
            {error}
          </p>
        )}
        <button className="fp-primary" type="submit">
          {initial ? "Enregistrer mon lieu" : "Ajouter mon idée"}
        </button>
      </form>
    </Modal>
  );
}
export default function FamilyPlanner() {
  const [stored, setStored] = useState(readFamily),
    [stage, setStage] = useState<StageId | "all">("moalboal"),
    [tab, setTab] = useState<Tab>("explore");
  const [kind, setKind] = useState<Kind | "all">("all"),
    [query, setQuery] = useState(""),
    [savedOnly, setSavedOnly] = useState(false),
    [relaxed, setRelaxed] = useState(false);
  const [layout, setLayout] = useState<"both" | "list" | "map">("both"),
    [selected, setSelected] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [compare, setCompare] = useState<string[]>([]),
    [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState(""),
    [staged, setStaged] = useState<FamilyState | null>(null),
    [importConfirmed, setImportConfirmed] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | undefined>();
  const data = stored.data,
    all = useMemo(() => [...places, ...data.custom], [data.custom]),
    current = stages.find((s) => s.id === stage),
    sums = totals(data);
  const file = useRef<HTMLInputElement>(null);
  const backupSnapshot = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => setStored(readFamily());
    const showMap = () => {
      setTab("explore");
      setLayout("map");
      document
        .getElementById("family-content")
        ?.scrollIntoView({ behavior: "instant" });
    };
    window.addEventListener("family-show-map", showMap);
    window.addEventListener("storage", refresh);
    window.addEventListener("family-planner-updated", refresh);
    return () => {
      window.removeEventListener("family-show-map", showMap);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("family-planner-updated", refresh);
    };
  }, []);
  function openJournal() {
    try {
      const current = readUpcoming();
      if (current.error) throw new Error(current.error);
      const id = "family-philippines-2027";
      if (!current.trips.some((t) => t.id === id)) {
        saveUpcomingMetadata([
          ...current.trips,
          {
            id,
            destination: "Philippines · notre voyage",
            departure: "2027-02-15",
            endDate: "2027-03-10",
            plan: {
              ideas: [],
              notes:
                "Voyage familial envisagé, aucune réservation confirmée automatiquement. Préparation détaillée, alternatives et budget dans Philippines 2027 (#philippines).",
              stops: stages.map((s) => ({
                id: `base-${s.id}`,
                place: s.name,
                date: s.start,
                point: { lat: s.lat, lon: s.lon },
                kind: "stay" as const,
                notes: `${s.nights} nuit${s.nights > 1 ? "s envisagées" : " envisagée"}. ${s.transfer}`,
              })),
            },
          },
        ]);
        window.dispatchEvent(new Event("upcoming-trips-updated"));
      }
      window.location.hash = `trip/${id}`;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Impossible d’ouvrir le carnet.",
      );
    }
  }
  const filtered = useMemo(() => {
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return all.filter(
      (p) =>
        (stage === "all" || p.stage === stage) &&
        (kind === "all" || p.kind === kind) &&
        (!savedOnly ||
          (data.choices[p.id] && data.choices[p.id].status !== "idea")) &&
        (!relaxed ||
          p.kind !== "activity" ||
          p.tags.some((t) =>
            ["Repos", "Culture", "Sans bateau", "Sortie courte"].includes(t),
          )) &&
        norm(`${p.name} ${p.description} ${p.tags.join(" ")}`).includes(
          norm(query),
        ),
    );
  }, [all, stage, kind, savedOnly, relaxed, query, data.choices]);
  function update(fn: (d: FamilyState) => FamilyState) {
    try {
      const next = saveFamily(fn);
      setStored({ data: next, error: "" });
      setNotice("Enregistré sur cet appareil.");
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Enregistrement impossible.");
      return false;
    }
  }
  function choose(id: string, choice: Choice, original: Choice) {
    return update((d) => {
      if (
        JSON.stringify(d.choices[id] ?? emptyChoice()) !==
        JSON.stringify(original)
      ) {
        throw new Error(
          "Cette fiche a changé dans un autre onglet. Copiez vos notes puis fermez et rouvrez la fiche pour retrouver la dernière version.",
        );
      }
      return { ...d, choices: { ...d.choices, [id]: choice } };
    });
  }
  function favorite(p: Place) {
    update((d) => {
      const c = d.choices[p.id] ?? emptyChoice();
      if (c.status === "chosen" || c.status === "booked") return d;
      return {
        ...d,
        choices: {
          ...d.choices,
          [p.id]: {
            ...c,
            status: c.status === "shortlist" ? "idea" : "shortlist",
          },
        },
      };
    });
  }
  function changeStage(id: StageId | "all") {
    setStage(id);
    setQuery("");
    setCompare([]);
  }
  function toggleCompare(id: string) {
    if (compare.includes(id)) setCompare(compare.filter((v) => v !== id));
    else if (compare.length < 3) setCompare([...compare, id]);
    else setNotice("Comparez jusqu’à trois options à la fois.");
  }
  function doExport() {
    if (stored.error) {
      downloadFile(
        localStorage.getItem(familyKey) ?? "",
        "philippines-preparation-donnees-brutes.txt",
        "text/plain",
      );
      return;
    }
    exportFamily(data);
    setNotice(
      "Copie de préparation téléchargée. Conservez-la avec vos documents de voyage.",
    );
  }
  const chosen = all.find((p) => p.id === selected);
  return (
    <div className="fp-page">
      <section className="fp-hero">
        <div className="fp-hero-copy">
          <p className="eyebrow">NOTRE GRANDE ÉCHAPPÉE · PHILIPPINES 2027</p>
          <h1>
            Des îles.
            <br />
            Du temps.
            <br />
            <em>Nous quatre.</em>
          </h1>
          <p className="fp-hero-description">
            Un voyage à construire, une envie à la fois.
            <br />
            Les Visayas en famille, sans prendre l’avion entre les îles.
          </p>
          <div className="fp-trip-facts">
            <span>
              <strong>20</strong> nuits
            </span>
            <span>
              <strong>6</strong> escales
            </span>
            <span>
              <strong>2 + 2</strong> adultes & enfants
            </span>
          </div>
          <p className="fp-dates">
            17 février — 9 mars 2027 <span>· dates envisagées</span>
          </p>
          <button
            className="fp-hero-start"
            onClick={() =>
              document
                .getElementById("family-content")
                ?.scrollIntoView({ behavior: "instant" })
            }
          >
            Explorer nos escales ↓
          </button>
        </div>
        <figure>
          <img
            src="/assets/visayas/apo.jpg"
            alt="Bateaux traditionnels devant Apo Island dans les Visayas"
          />
          <figcaption>
            Apo Island · CariolaMinze ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>{" "}
            · photo recadrée
          </figcaption>
          <div className="fp-photo-note">
            <span>
              Le bonheur tient parfois
              <br />
              dans une journée sans programme.
            </span>
          </div>
        </figure>
      </section>
      <div className="fp-body">
        <div className="fp-topline">
          <p>
            <i />
            Votre espace de préparation <span>· sauvegarde locale</span>
          </p>
          <div>
            <button onClick={doExport}>Exporter</button>
            <button
              onClick={() => exportReading(data)}
              disabled={!!stored.error}
            >
              Copie de lecture ↗
            </button>
          </div>
        </div>
        {stored.error && (
          <p role="alert" className="fp-error">
            {stored.error}
          </p>
        )}
        <p role="status" className="fp-notice">
          {notice}
        </p>
        <nav
          id="family-content"
          className="fp-tabs"
          aria-label="Préparation familiale"
        >
          {(
            [
              ["explore", "Explorer & choisir"],
              ["days", "Jour par jour"],
              ["budget", "Notre budget"],
              ["prepare", "Avant le départ"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <button onClick={openJournal}>Notre carnet ↗</button>
        </nav>
        {(tab === "explore" || tab === "days") && (
          <nav className="fp-stages" aria-label="Les six étapes">
            <button
              className={stage === "all" ? "selected" : ""}
              onClick={() => changeStage("all")}
            >
              <span>LE VOYAGE</span>
              <strong>Tout voir</strong>
              <small>21 journées</small>
            </button>
            {stages.map((s, i) => (
              <button
                key={s.id}
                className={stage === s.id ? "selected" : ""}
                onClick={() => changeStage(s.id)}
              >
                <span>
                  0{i + 1} · {s.island}
                </span>
                <strong>{s.name}</strong>
                <small>
                  {dateLabel(s.start)} — {dateLabel(s.end)} · {s.nights} nuit
                  {s.nights > 1 ? "s" : ""}
                </small>
              </button>
            ))}
          </nav>
        )}
        {tab === "explore" && (
          <>
            <section className="fp-stage-heading">
              <div>
                <p className="eyebrow">
                  {current
                    ? `${current.island} · ${current.nights} nuit${current.nights > 1 ? "s" : ""}`
                    : "LES VISAYAS, À VOTRE RYTHME"}
                </p>
                <h2>
                  {current ? current.name : "Toutes nos escales"}
                  <em>
                    {current ? " et ses possibles." : ", toutes nos envies."}
                  </em>
                </h2>
                <p>
                  {current?.intro ??
                    "Des options à comparer, des idées à garder. Rien n’est réservé tant que vous ne l’avez pas confirmé."}
                </p>
              </div>
              <button className="fp-secondary" onClick={() => setAdding(true)}>
                ＋ Ajouter une idée
              </button>
            </section>
            {current && (
              <details className="fp-transfer">
                <summary>
                  <span>↗</span> Rejoindre {current.name}{" "}
                  <small>Transport & plan de repli</small>
                </summary>
                <p>{current.transfer}</p>
                <p>
                  <strong>Si le programme change.</strong> {current.fallback}
                </p>
                <a
                  href="https://www.oceanjet.net/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vérifier les liaisons OceanJet ↗
                </a>
              </details>
            )}
            <div className="fp-filterbar">
              <div
                className="fp-kind-filters"
                role="group"
                aria-label="Catégories"
              >
                <button
                  aria-pressed={kind === "all"}
                  onClick={() => setKind("all")}
                >
                  Tout{" "}
                  <small>
                    {
                      all.filter((p) => stage === "all" || p.stage === stage)
                        .length
                    }
                  </small>
                </button>
                {Object.entries(kindLabels).map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={kind === id}
                    onClick={() => setKind(id as Kind)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="fp-search">
                <span className="sr-only">Rechercher une option</span>
                <input
                  placeholder="Un lieu, une envie…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="fp-resultbar">
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={savedOnly}
                    onChange={(e) => setSavedOnly(e.target.checked)}
                  />{" "}
                  Nos favoris & choix
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={relaxed}
                    onChange={(e) => setRelaxed(e.target.checked)}
                  />{" "}
                  Activités douces / sans bateau
                </label>
              </div>
              <div className="fp-layout" aria-label="Affichage">
                {(
                  [
                    ["both", "Liste + carte"],
                    ["list", "Liste"],
                    ["map", "Carte"],
                  ] as const
                ).map(([id, l]) => (
                  <button
                    aria-pressed={layout === id}
                    onClick={() => setLayout(id)}
                    key={id}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className={`fp-explorer fp-view-${layout}`}>
              <section className="fp-results" aria-label="Liste des options">
                <div className="fp-list-heading">
                  <span>
                    {filtered.length} option{filtered.length !== 1 ? "s" : ""}
                  </span>
                  <small>Prix & disponibilité à confirmer</small>
                </div>
                {filtered.length === 0 ? (
                  <div className="fp-empty">
                    <h3>Un peu trop de filtres ?</h3>
                    <p>Aucune option ne correspond à cette sélection.</p>
                    <button
                      className="fp-secondary"
                      onClick={() => {
                        setKind("all");
                        setQuery("");
                        setSavedOnly(false);
                        setRelaxed(false);
                      }}
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  <div className="fp-cards">
                    {filtered.map((p) => {
                      const c = data.choices[p.id] ?? emptyChoice();
                      return (
                        <article
                          className={`fp-card ${c.status === "chosen" || c.status === "booked" ? "is-chosen" : ""}`}
                          key={p.id}
                        >
                          <div className="fp-card-top">
                            <span className={`fp-kind ${p.kind}`}>
                              {kindLabels[p.kind]}
                            </span>
                            <button
                              className="fp-heart"
                              aria-label={
                                c.status === "idea"
                                  ? `Garder ${p.name} dans les favoris`
                                  : `Retirer ${p.name} des favoris`
                              }
                              aria-pressed={c.status !== "idea"}
                              disabled={
                                c.status === "chosen" || c.status === "booked"
                              }
                              onClick={() => favorite(p)}
                            >
                              {c.status === "idea" ? "♡" : "♥"}
                            </button>
                          </div>
                          <h3>
                            <button onClick={() => setSelected(p.id)}>
                              {p.name}
                            </button>
                          </h3>
                          <p>{p.description}</p>
                          <div className="fp-tags">
                            {p.tags.map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                            {stage === "all" && (
                              <span>
                                {stages.find((s) => s.id === p.stage)?.name}
                              </span>
                            )}
                          </div>
                          {c.status !== "idea" && (
                            <p className="fp-choice-label">
                              ✓ {statusLabels[c.status]}
                              {c.date ? ` · ${dateLabel(c.date)}` : ""}
                              {c.cost ? ` · ${money(Number(c.cost))}` : ""}
                            </p>
                          )}
                          <div className="fp-card-bottom">
                            <label>
                              <input
                                type="checkbox"
                                checked={compare.includes(p.id)}
                                onChange={() => toggleCompare(p.id)}
                              />{" "}
                              Comparer
                            </label>
                            <button onClick={() => setSelected(p.id)}>
                              Voir la fiche <span>↗</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
              <aside className="fp-map-aside">
                <Suspense
                  fallback={
                    <div className="fp-map-loading" role="status">
                      La carte se déplie…
                    </div>
                  }
                >
                  <FamilyMap
                    items={filtered}
                    stage={stage}
                    onSelect={setSelected}
                  />
                </Suspense>
                <div className="fp-map-caption">
                  <strong>Les bonnes idées, au bon endroit.</strong>
                  <p>
                    Choisissez un repère pour ouvrir sa fiche. Les numéros
                    regroupent les options au même endroit.
                  </p>
                </div>
              </aside>
            </div>
            {layout === "map" && (
              <details className="fp-map-list">
                <summary>
                  Liste accessible des {filtered.length} options
                </summary>
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p.id)}>
                    {p.name} · {kindLabels[p.kind]}
                  </button>
                ))}
              </details>
            )}
            {compare.length > 0 && (
              <div className="fp-compare-bar">
                <span>
                  {compare.length} option{compare.length > 1 ? "s" : ""} à
                  comparer
                </span>
                <button
                  className="fp-primary"
                  onClick={() => setComparing(true)}
                >
                  Comparer les choix
                </button>
                <button onClick={() => setCompare([])}>Effacer</button>
              </div>
            )}
          </>
        )}
        {tab === "days" && (
          <section className="fp-days">
            <div className="fp-section-title">
              <p className="eyebrow">UN PROGRAMME QUI RESPIRE</p>
              <h2>
                Chaque jour, <em>à notre rythme.</em>
              </h2>
              <p>
                La trame reste une proposition. Vos options datées et notes
                complètent chaque journée.
              </p>
            </div>
            {daily
              .filter((d) => stage === "all" || d[1] === stage)
              .map(([date, id, title, description]) => {
                const s = stages.find((s) => s.id === id)!;
                const options = all.filter(
                  (p) =>
                    data.choices[p.id]?.date === date &&
                    data.choices[p.id]?.status !== "idea",
                );
                return (
                  <article key={date} className="fp-day">
                    <div className="fp-day-date">
                      <strong>{date.slice(8)}</strong>
                      <span>
                        {dateLabel(date).split(" ").slice(1).join(" ")}
                      </span>
                    </div>
                    <div>
                      <p className="eyebrow">
                        {s.name} · Jour{" "}
                        {daily.findIndex((d) => d[0] === date) + 1}
                      </p>
                      <h3>{title}</h3>
                      <p>{description}</p>
                      {date === s.start && (
                        <details>
                          <summary>Le transfert de cette journée</summary>
                          <p>{s.transfer}</p>
                          <p>{s.fallback}</p>
                        </details>
                      )}
                      <div className="fp-day-options">
                        {options.map((p) => (
                          <button key={p.id} onClick={() => setSelected(p.id)}>
                            <span className={`fp-kind ${p.kind}`}>
                              {kindLabels[p.kind]}
                            </span>
                            {p.name}
                            <small>
                              {statusLabels[data.choices[p.id].status]}
                            </small>
                          </button>
                        ))}
                      </div>
                      <DayNote
                        date={date}
                        saved={data.dayNotes[date] ?? ""}
                        onSave={(value, original) =>
                          update((d) => {
                            if ((d.dayNotes[date] ?? "") !== original)
                              throw Error(
                                "Ces notes ont changé dans un autre onglet. Copiez votre brouillon avant de recharger.",
                              );
                            return {
                              ...d,
                              dayNotes: { ...d.dayNotes, [date]: value },
                            };
                          })
                        }
                      />
                      <button
                        className="fp-inline"
                        onClick={() => {
                          setStage(id);
                          setTab("explore");
                        }}
                      >
                        Choisir parmi les alternatives de {s.name} →
                      </button>
                    </div>
                  </article>
                );
              })}
          </section>
        )}
        {tab === "budget" && (
          <section className="fp-budget">
            <div className="fp-section-title">
              <p className="eyebrow">TOUT EN EUROS, POUR NOUS QUATRE</p>
              <h2>
                Le plaisir, <em>et les comptes.</em>
              </h2>
              <p>
                Seules les options retenues ou réservées entrent dans le total,
                avec les autres dépenses ci-dessous. Les favoris restent des
                alternatives.
              </p>
            </div>
            <div className="fp-budget-metrics">
              <div>
                <span>Budget cible</span>
                <strong>{money(data.budget)}</strong>
              </div>
              <div>
                <span>Montants renseignés</span>
                <strong>{money(sums.estimated)}</strong>
              </div>
              <div>
                <span>Payé déclaré</span>
                <strong>{money(sums.paid)}</strong>
              </div>
              <div className={sums.remaining < 0 ? "over" : ""}>
                <span>
                  {sums.remaining < 0 ? "Dépassement" : "Marge non affectée"}
                </span>
                <strong>{money(Math.abs(sums.remaining))}</strong>
              </div>
            </div>
            <div className="fp-budget-progress">
              <span
                style={{
                  width: `${Math.min(100, (sums.estimated / Math.max(1, data.budget)) * 100)}%`,
                }}
              />
            </div>
            <p className="fp-fine">
              Ce n’est pas encore un coût final : {sums.kept} option(s)
              retenue(s), dont {sums.missing} sans prix. Les autres postes non
              saisis restent à chiffrer. « Payé » correspond uniquement à vos
              saisies.
            </p>
            <label className="fp-budget-target">
              Ajuster le budget cible (€)
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                defaultValue={data.budget}
                key={data.budget}
                onBlur={(e) => {
                  if (e.target.value && e.target.validity.valid)
                    update((d) => ({ ...d, budget: Number(e.target.value) }));
                }}
              />
            </label>
            <h3>Nos choix retenus</h3>
            <div
              className="fp-stage-budgets"
              aria-label="Budget des choix par étape"
            >
              {stages.map((s) => {
                const selected = all.filter(
                  (p) =>
                    p.stage === s.id &&
                    ["chosen", "booked"].includes(data.choices[p.id]?.status),
                );
                const total = selected.reduce(
                  (sum, p) => sum + Number(data.choices[p.id].cost || 0),
                  0,
                );
                const missing = selected.filter(
                  (p) => !data.choices[p.id].cost,
                ).length;
                const hotels = selected.filter(
                  (p) => p.kind === "hotel",
                ).length;
                return (
                  <article key={s.id}>
                    <h4>{s.name}</h4>
                    <strong>{money(total)}</strong>
                    <p>
                      {selected.length} choix · {missing} à chiffrer
                    </p>
                    {hotels > 1 && (
                      <p className="fp-budget-warning">
                        Plusieurs hôtels retenus : vérifiez que ces séjours se
                        cumulent vraiment.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="fp-fine">
              Ces sous-totaux détaillent les choix ci-dessous ; les vols et
              autres dépenses restent dans leur liste séparée.
            </p>
            <div className="fp-budget-choices">
              {all
                .filter((p) =>
                  ["chosen", "booked"].includes(data.choices[p.id]?.status),
                )
                .map((p) => (
                  <button key={p.id} onClick={() => setSelected(p.id)}>
                    <span>
                      {p.name}
                      <small>
                        {statusLabels[data.choices[p.id].status]} ·{" "}
                        {data.choices[p.id].priceType === "estimate"
                          ? "Estimation"
                          : data.choices[p.id].priceType === "quote"
                            ? "Devis"
                            : "Prix confirmé par vous"}
                      </small>
                    </span>
                    <strong>
                      {data.choices[p.id].cost
                        ? money(Number(data.choices[p.id].cost))
                        : "À chiffrer"}{" "}
                      ↗
                    </strong>
                  </button>
                ))}
              {!sums.kept && (
                <p>
                  Aucun choix retenu pour l’instant. Ouvrez une fiche pour
                  sélectionner une option et renseigner son montant familial.
                </p>
              )}
            </div>
            <h3>Vols, transports et autres dépenses</h3>
            <p className="fp-fine">
              Ne ressaisissez pas ici un montant déjà renseigné dans une fiche.
            </p>
            {data.expenses.map((e) => (
              <form
                className="fp-expense"
                key={`${e.id}-${e.cost}-${e.paid}-${e.label}-${e.confirmed}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  const f = new FormData(event.currentTarget);
                  const next = {
                    ...e,
                    label: String(f.get("label")).trim(),
                    cost: Number(f.get("cost")),
                    paid: Number(f.get("paid")),
                    confirmed: f.get("confirmed") === "on",
                  };
                  if (next.paid > next.cost) {
                    setNotice("Le montant payé ne peut pas dépasser le total.");
                    return;
                  }
                  update((d) => ({
                    ...d,
                    expenses: d.expenses.map((x) => (x.id === e.id ? next : x)),
                  }));
                }}
              >
                <label>
                  Poste
                  <input
                    name="label"
                    required
                    maxLength={160}
                    defaultValue={e.label}
                  />
                </label>
                <label>
                  Total familial (€)
                  <input
                    name="cost"
                    required
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue={e.cost}
                  />
                </label>
                <label>
                  Payé (€)
                  <input
                    name="paid"
                    required
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue={e.paid}
                  />
                </label>
                <label className="fp-check-inline">
                  <input
                    type="checkbox"
                    name="confirmed"
                    defaultChecked={e.confirmed}
                  />{" "}
                  Prix confirmé
                </label>
                <button className="fp-secondary" type="submit">
                  Enregistrer
                </button>
                <button
                  type="button"
                  aria-label={`Retirer ${e.label}`}
                  onClick={() => {
                    if (window.confirm(`Retirer « ${e.label} » du budget ?`))
                      update((d) => ({
                        ...d,
                        expenses: d.expenses.filter((x) => x.id !== e.id),
                      }));
                  }}
                >
                  Retirer
                </button>
              </form>
            ))}
            <button
              className="fp-secondary"
              onClick={() =>
                update((d) => ({
                  ...d,
                  expenses: [
                    ...d.expenses,
                    {
                      id: createId(),
                      label: "Nouveau poste à préciser",
                      cost: 0,
                      paid: 0,
                      confirmed: false,
                    },
                  ],
                }))
              }
            >
              ＋ Ajouter une dépense
            </button>
            <details className="fp-envelope">
              <summary>Notre enveloppe de départ · 10 500 €</summary>
              <p>
                Repères de travail, pas devis : vols 2 577,96 € · hébergements 2
                800 € · repas 1 470 € · transports 900 € · activités 900 € ·
                transit/sièges/bagages 500 € · assurance/connectivité/divers 300
                € · réserve 1 052,04 €. Ces enveloppes ne s’ajoutent pas
                automatiquement au total.
              </p>
            </details>
          </section>
        )}
        {tab === "prepare" && (
          <section className="fp-prepare">
            <div className="fp-section-title">
              <p className="eyebrow">PARTIR L’ESPRIT LÉGER</p>
              <h2>
                Les petits détails <em>qui changent tout.</em>
              </h2>
              <p>
                {data.checks.length} / {tasks.length} préparatifs terminés
              </p>
            </div>
            <div className="fp-checklist">
              {tasks.map(([id, title, desc], i) => (
                <label
                  className={data.checks.includes(id) ? "done" : ""}
                  key={id}
                >
                  <input
                    type="checkbox"
                    checked={data.checks.includes(id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      update((d) => ({
                        ...d,
                        checks: checked
                          ? [...new Set([...d.checks, id])]
                          : d.checks.filter((v) => v !== id),
                      }));
                    }}
                  />
                  <span>
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </span>
                </label>
              ))}
            </div>
            <div className="fp-backup-panel">
              <h3>Du départ au retour.</h3>
              <p>
                Scénario aérien transmis pour préparer le voyage. Aucune
                réservation confirmée et aucune disponibilité vérifiée ici.
              </p>
              <div className="fp-flight-grid">
                <article>
                  <span className="eyebrow">ALLER · 15 → 17 FÉVRIER 2027</span>
                  <h4>Nice → Zurich → Singapour → Cebu</h4>
                  <p>
                    Préférence SWISS / Scoot. Départ étudié vers 19h10 ; arrivée
                    à Cebu le 17 à 06h10.
                  </p>
                  <p>
                    Escales envisagées : 2h15 à Zurich, 8h15 à Singapour. Repos
                    en hôtel de transit pour quatre à organiser.
                  </p>
                </article>
                <article>
                  <span className="eyebrow">RETOUR · 9 → 10 MARS 2027</span>
                  <h4>Cebu → Hong Kong → Francfort → Nice</h4>
                  <p>
                    Départ étudié à 19h35 ; arrivée à Nice le lendemain vers
                    09h30.
                  </p>
                  <p>
                    Correspondances envisagées : 1h15 à Hong Kong, 1h50 à
                    Francfort. Vérifier le billet unique et la protection
                    effective de chaque segment.
                  </p>
                </article>
              </div>
              <p className="fp-fine">
                Offre historique : 2 577,96 € pour quatre. Bagages, sièges
                ensemble, conditions et transferts des bagages restent à
                confirmer avant paiement.
              </p>
              <details className="fp-transfer-index">
                <summary>Les six arrivées, sans vol intérieur</summary>
                {stages.map((s) => (
                  <article key={s.id}>
                    <h4>
                      {dateLabel(s.start)} · {s.name}
                    </h4>
                    <p>{s.transfer}</p>
                    <p className="fp-fine">
                      Notre marge de manœuvre : {s.fallback}
                    </p>
                  </article>
                ))}
              </details>
            </div>
            <div className="fp-backup-panel">
              <h3>Votre préparation vous accompagne.</h3>
              <p>
                Choix, prix, notes et checklist sont enregistrés dans ce
                navigateur. Exportez ce dossier pour le conserver ou le
                transférer sur l’autre téléphone. Cette préparation dispose de
                son propre fichier JSON, distinct du ZIP des carnets.
              </p>
              <div className="fp-backup-actions">
                <button className="fp-primary" onClick={doExport}>
                  Exporter la préparation
                </button>
                <button
                  className="fp-secondary"
                  onClick={() => file.current?.click()}
                >
                  Importer une préparation
                </button>
                <button
                  className="fp-secondary"
                  disabled={!!stored.error}
                  onClick={() => exportReading(data)}
                >
                  Télécharger la copie de lecture
                </button>
              </div>
              <input
                ref={file}
                className="fp-file"
                type="file"
                accept=".json,application/json"
                aria-label="Importer un fichier de préparation"
                onChange={async (e) => {
                  const selected = e.target.files?.[0];
                  if (!selected) return;
                  try {
                    if (selected.size > 2000000)
                      throw Error("Fichier trop volumineux.");
                    setStaged(parseFamilyExport(await selected.text()));
                    setImportConfirmed(false);
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Fichier illisible.",
                    );
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
              <OfflineAccess />
            </div>
            <div className="fp-source-links">
              <a
                href="https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/"
                target="_blank"
                rel="noreferrer"
              >
                Conseils France Diplomatie ↗
              </a>
              <a
                href="https://etravel.gov.ph/"
                target="_blank"
                rel="noreferrer"
              >
                eTravel officiel ↗
              </a>
              <a
                href="https://www.oceanjet.net/"
                target="_blank"
                rel="noreferrer"
              >
                Traversées OceanJet ↗
              </a>
            </div>
          </section>
        )}
        <footer className="fp-local-footer">
          <span>Un soir là-bas · préparer, vivre, raconter.</span>
          <p>
            Propositions à adapter · 2 adultes, enfants de 5 et 8 ans · aucun
            vol intérieur.
            <br />
            Aucun tarif ni disponibilité 2027 confirmé automatiquement. Vos
            décisions restent sur cet appareil.
          </p>
          <a href="#carnet">Retrouver mes carnets →</a>
        </footer>
      </div>
      {chosen && (
        <ChoiceEditor
          key={chosen.id}
          place={chosen}
          choice={data.choices[chosen.id] ?? emptyChoice()}
          onSave={(c, original) => choose(chosen.id, c, original)}
          close={() => setSelected(null)}
          editPlace={
            chosen.id.startsWith("custom-")
              ? () => {
                  setEditingPlace(chosen);
                  setSelected(null);
                  setAdding(true);
                }
              : undefined
          }
          removePlace={
            chosen.id.startsWith("custom-")
              ? () => {
                  if (
                    !window.confirm(
                      `Supprimer « ${chosen.name} », ses notes et ses montants de cette préparation ?`,
                    )
                  )
                    return;
                  if (
                    update((d) => {
                      const choices = { ...d.choices };
                      delete choices[chosen.id];
                      return {
                        ...d,
                        choices,
                        custom: d.custom.filter((p) => p.id !== chosen.id),
                      };
                    })
                  ) {
                    setSelected(null);
                    setCompare((ids) => ids.filter((id) => id !== chosen.id));
                  }
                }
              : undefined
          }
        />
      )}
      {adding && (
        <AddPlace
          stage={editingPlace?.stage ?? (stage === "all" ? "moalboal" : stage)}
          initial={editingPlace}
          onAdd={(p) =>
            update((d) => {
              const nextStage = stages.find((s) => s.id === p.stage)!;
              const old = d.choices[p.id];
              return {
                ...d,
                custom: editingPlace
                  ? d.custom.map((item) => (item.id === p.id ? p : item))
                  : [...d.custom, p],
                choices:
                  old?.date &&
                  (old.date < nextStage.start || old.date > nextStage.end)
                    ? { ...d.choices, [p.id]: { ...old, date: "" } }
                    : d.choices,
              };
            })
          }
          close={() => {
            setAdding(false);
            setEditingPlace(undefined);
          }}
        />
      )}
      {comparing && (
        <Modal
          title="Trouver notre préférence"
          close={() => setComparing(false)}
        >
          <p>
            Comparer aide à choisir ; la disponibilité reste à vérifier pour vos
            dates.
          </p>
          <div className="fp-comparison">
            {compare
              .map((id) => all.find((p) => p.id === id))
              .filter((p): p is Place => !!p)
              .map((p) => (
                <article key={p.id}>
                  <span className={`fp-kind ${p.kind}`}>
                    {kindLabels[p.kind]}
                  </span>
                  <h3>{p.name}</h3>
                  <strong>Pourquoi y aller</strong>
                  <p>{p.description}</p>
                  <strong>En famille</strong>
                  <p>{p.family}</p>
                  <strong>À vérifier</strong>
                  <p>{p.caution}</p>
                  <strong>Prix pour quatre</strong>
                  <p>
                    {data.choices[p.id]?.cost
                      ? money(Number(data.choices[p.id].cost))
                      : (p.price ?? "Devis à obtenir")}
                  </p>
                  <button
                    className="fp-primary"
                    onClick={() => {
                      setComparing(false);
                      setSelected(p.id);
                    }}
                  >
                    Ouvrir ce choix
                  </button>
                </article>
              ))}
          </div>
        </Modal>
      )}
      {staged && (
        <Modal
          title="Restaurer cette préparation ?"
          close={() => setStaged(null)}
        >
          <p>
            Ce fichier contient {Object.keys(staged.choices).length} choix,{" "}
            {staged.custom.length} lieux personnels, {staged.checks.length}{" "}
            préparatifs cochés et {staged.expenses.length} autres dépenses. Il
            remplacera la préparation familiale sur cet appareil. Les carnets ne
            sont pas concernés.
          </p>
          <button
            className="fp-secondary"
            onClick={() => {
              doExport();
              backupSnapshot.current = localStorage.getItem(familyKey);
              setImportConfirmed(true);
            }}
          >
            1. Télécharger la copie actuelle
          </button>
          <p className="fp-fine">
            Conservez et vérifiez ce fichier avant de continuer. Il n’y a pas de
            fusion automatique entre les téléphones.
          </p>
          <button
            className="fp-primary"
            disabled={!importConfirmed}
            onClick={() => {
              try {
                if (
                  localStorage.getItem(familyKey) !== backupSnapshot.current
                ) {
                  setImportConfirmed(false);
                  setNotice(
                    "La préparation a changé depuis la copie. Téléchargez une nouvelle sauvegarde avant de remplacer les données.",
                  );
                  return;
                }
                localStorage.setItem(familyKey, JSON.stringify(staged));
                setStored({ data: staged, error: "" });
                window.dispatchEvent(new Event("family-planner-updated"));
                setStaged(null);
                setNotice("Préparation restaurée.");
              } catch {
                setNotice(
                  "Restauration impossible : le stockage est indisponible.",
                );
              }
            }}
          >
            2. Remplacer par la préparation importée
          </button>
        </Modal>
      )}
    </div>
  );
}
