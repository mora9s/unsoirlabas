import {
  validFlightPacket,
  validTransfers,
  transferFields,
  transferRoutes,
  transferStatuses,
} from "./family-logistics";
import type { FlightPacket, Transfer } from "./family-logistics";
import { daily } from "./family-programme";
import { fieldTiming, guide, stopMap } from "./field-guide";
import { kindLabels, places, stages, tasks } from "./family-data";
import type { Place, StageId } from "./family-data";

export const familyKey = "unsoirlabas-family-planner-v1";
export const statusLabels = {
  idea: "À explorer",
  shortlist: "En favoris",
  chosen: "Retenu",
  booked: "Réservé",
} as const;
export type Choice = {
  status: keyof typeof statusLabels;
  date: string;
  notes: string;
  cost: string;
  paid: string;
  reference: string;
  priceType: "estimate" | "quote" | "confirmed";
  checked: string;
  room?: string;
  included?: string;
  cancelBy?: string;
};
export type Expense = {
  id: string;
  label: string;
  cost: number;
  paid: number;
  confirmed: boolean;
};
export type FamilyState = {
  version: 1;
  flights?: FlightPacket;
  transfers?: Partial<Record<StageId, Transfer>>;
  alternatives?: string[];
  decisions?: Record<string, { due: string; answer: string }>;
  choices: Record<string, Choice>;
  custom: Place[];
  checks: string[];
  budget: number;
  expenses: Expense[];
  dayNotes: Record<string, string>;
};
export const emptyChoice = (): Choice => ({
  status: "idea",
  date: "",
  notes: "",
  cost: "",
  paid: "",
  reference: "",
  priceType: "estimate",
  checked: "",
});
export const initialState = (): FamilyState => ({
  version: 1,
  choices: {},
  custom: [],
  checks: [],
  budget: 10500,
  expenses: [
    {
      id: "flights",
      label: "Vols internationaux · offre étudiée pour quatre",
      cost: 2577.96,
      paid: 0,
      confirmed: false,
    },
  ],
  dayNotes: {},
});
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
const amount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000000;
export function validDate(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function safeUrl(v: string) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
// Earlier published calendars remain valid for saved choices and imported backups.
const previousWindows: Record<StageId, [string, string]> = {
  moalboal: ["2027-02-17", "2027-02-22"],
  negros: ["2027-02-22", "2027-02-27"],
  siquijor: ["2027-02-25", "2027-03-05"],
  bohol: ["2027-03-01", "2027-03-08"],
  mactan: ["2027-03-08", "2027-03-09"],
};
function validChoiceDate(stageId: StageId | undefined, date: string) {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return false;
  const [oldStart, oldEnd] = previousWindows[stage.id];
  return (
    (date >= stage.start && date <= stage.end) ||
    (date >= oldStart && date <= oldEnd)
  );
}
export function validateFamily(v: unknown): v is FamilyState {
  if (
    !object(v) ||
    v.version !== 1 ||
    !object(v.choices) ||
    !object(v.dayNotes) ||
    !Array.isArray(v.custom) ||
    !Array.isArray(v.checks) ||
    !Array.isArray(v.expenses) ||
    !amount(v.budget)
  )
    return false;
  if (
    Object.keys(v)
      .filter(
        (k) =>
          !["flights", "transfers", "alternatives", "decisions"].includes(k),
      )
      .sort()
      .join() !==
    ["version", "choices", "custom", "checks", "budget", "expenses", "dayNotes"]
      .sort()
      .join()
  )
    return false;
  if (
    "decisions" in v &&
    (!object(v.decisions) ||
      !Object.entries(v.decisions).every(
        ([id, x]) =>
          tasks.some((t) => t[0] === id) &&
          object(x) &&
          str(x.answer, 1000) &&
          (x.due === "" || validDate(x.due)),
      ))
  )
    return false;
  if (
    ("flights" in v && !validFlightPacket(v.flights)) ||
    ("transfers" in v && !validTransfers(v.transfers)) ||
    ("alternatives" in v &&
      (!Array.isArray(v.alternatives) ||
        v.alternatives.length > daily.length ||
        !v.alternatives.every((date) => daily.some((d) => d.date === date)) ||
        new Set(v.alternatives).size !== v.alternatives.length))
  )
    return false;
  if (
    v.custom.length > 200 ||
    v.expenses.length > 200 ||
    Object.keys(v.choices).length > 500 ||
    Object.keys(v.dayNotes).length > 30
  )
    return false;
  if (
    !v.custom.every(
      (p) =>
        object(p) &&
        typeof p.id === "string" &&
        /^custom-[a-zA-Z0-9-]{1,80}$/.test(p.id) &&
        stages.some((s) => s.id === p.stage) &&
        ["hotel", "food", "activity"].includes(String(p.kind)) &&
        str(p.name, 160) &&
        String(p.name).trim() &&
        str(p.description, 2000) &&
        str(p.family, 1000) &&
        str(p.caution, 1000) &&
        str(p.source, 1000) &&
        (p.source === "" || safeUrl(String(p.source))) &&
        typeof p.verified === "boolean" &&
        Array.isArray(p.tags) &&
        p.tags.length <= 8 &&
        p.tags.every((t: unknown) => str(t, 50)) &&
        str(p.duration, 100) &&
        typeof p.lat === "number" &&
        Number.isFinite(p.lat) &&
        Math.abs(p.lat) <= 90 &&
        typeof p.lon === "number" &&
        Number.isFinite(p.lon) &&
        Math.abs(p.lon) <= 180 &&
        (!("price" in p) || str(p.price, 500)),
    )
  )
    return false;
  const ids = new Map(
    [...places, ...(v.custom as Place[])].map((p) => [p.id, p.stage]),
  );
  if (ids.size !== places.length + v.custom.length) return false;
  if (
    !Object.entries(v.choices).every(
      ([id, c]) =>
        ids.has(id) &&
        object(c) &&
        Object.hasOwn(statusLabels, String(c.status)) &&
        str(c.notes, 4000) &&
        (c.room === undefined || str(c.room, 500)) &&
        (c.included === undefined || str(c.included, 500)) &&
        (c.cancelBy === undefined ||
          c.cancelBy === "" ||
          validDate(c.cancelBy)) &&
        str(c.reference, 300) &&
        str(c.cost, 20) &&
        str(c.paid, 20) &&
        [c.cost, c.paid].every(
          (a) =>
            a === "" ||
            (/^\d+(\.\d{1,2})?$/.test(String(a)) && amount(Number(a))),
        ) &&
        ["estimate", "quote", "confirmed"].includes(String(c.priceType)) &&
        (c.date === "" ||
          (validDate(c.date) && validChoiceDate(ids.get(id), c.date))) &&
        (c.checked === "" || validDate(c.checked)),
    )
  )
    return false;
  if (
    Object.values(v.choices).some(
      (c) =>
        !object(c) ||
        Number(c.paid || 0) > Number(c.cost || 0) ||
        (Number(c.paid) > 0 &&
          !["chosen", "booked"].includes(String(c.status))),
    )
  )
    return false;
  if (
    !v.checks.every((id) => tasks.some((t) => t[0] === id)) ||
    new Set(v.checks).size !== v.checks.length
  )
    return false;
  if (
    !v.expenses.every(
      (e) =>
        object(e) &&
        typeof e.id === "string" &&
        /^[a-zA-Z0-9-]{1,100}$/.test(e.id) &&
        str(e.label, 160) &&
        String(e.label).trim() &&
        amount(e.cost) &&
        amount(e.paid) &&
        e.paid <= e.cost &&
        typeof e.confirmed === "boolean",
    ) ||
    new Set(v.expenses.map((e) => e.id)).size !== v.expenses.length
  )
    return false;
  return Object.entries(v.dayNotes).every(
    ([d, n]) =>
      validDate(d) && d >= "2027-02-17" && d <= "2027-03-09" && str(n, 3000),
  );
}
// Read earlier exports without moving a booked date or modifying storage on load.
function normalizeFamily(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.custom)) return value;
  return {
    ...value,
    custom: value.custom.map((p) =>
      object(p) && (p.stage === "loboc" || p.stage === "panglao")
        ? { ...p, stage: "bohol" }
        : p,
    ),
  };
}
export function readFamily(): { data: FamilyState; error: string } {
  try {
    const raw = localStorage.getItem(familyKey);
    if (raw === null) return { data: initialState(), error: "" };
    const data = normalizeFamily(JSON.parse(raw));
    if (!validateFamily(data)) throw Error();
    return { data, error: "" };
  } catch {
    return {
      data: initialState(),
      error:
        "Votre préparation enregistrée ne peut pas être lue. Elle est conservée intacte. Exportez les données brutes avant toute restauration.",
    };
  }
}
export function saveFamily(
  update: (latest: FamilyState) => FamilyState,
): FamilyState {
  const latest = readFamily();
  if (latest.error) throw Error(latest.error);
  const next = update(latest.data);
  if (!validateFamily(next))
    throw Error(
      "Une donnée est invalide ou une limite est atteinte. Rien n’a été enregistré.",
    );
  try {
    localStorage.setItem(familyKey, JSON.stringify(next));
  } catch {
    throw Error(
      "Stockage plein ou indisponible. Exportez votre préparation ; la dernière copie enregistrée est conservée.",
    );
  }
  window.dispatchEvent(new Event("family-planner-updated"));
  return next;
}
export function money(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function totals(data: FamilyState) {
  const kept = Object.values(data.choices).filter(
    (c) => c.status === "chosen" || c.status === "booked",
  );
  const estimated =
    Math.round(
      (kept.reduce((s, c) => s + Number(c.cost || 0), 0) +
        data.expenses.reduce((s, e) => s + e.cost, 0)) *
        100,
    ) / 100;
  const paid =
    Math.round(
      (kept.reduce((s, c) => s + Number(c.paid || 0), 0) +
        data.expenses.reduce((s, e) => s + e.paid, 0)) *
        100,
    ) / 100;
  return {
    estimated,
    paid,
    remaining: Math.round((data.budget - estimated) * 100) / 100,
    missing: kept.filter((c) => !c.cost).length,
    kept: kept.length,
  };
}
export function downloadFile(
  content: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportFamily(data: FamilyState) {
  downloadFile(
    JSON.stringify(
      {
        format: "unsoirlabas-family",
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2,
    ),
    "philippines-2027-preparation.json",
  );
}
export function parseFamilyExport(text: string): FamilyState {
  if (text.length > 2000000) throw Error("Fichier trop volumineux.");
  const v: unknown = JSON.parse(text);
  const data = object(v) ? normalizeFamily(v.data) : null;
  if (!object(v) || v.format !== "unsoirlabas-family" || !validateFamily(data))
    throw Error("Ce fichier de préparation est invalide ou incompatible.");
  return data;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function exportReading(data: FamilyState) {
  const all = [...places, ...data.custom];
  const sums = totals(data);
  function optionCard(p: Place) {
    const c = data.choices[p.id] ?? emptyChoice();
    return `<article><h3>${escape(p.name)}</h3><p>${kindLabels[p.kind]} · ${statusLabels[c.status]} ${c.date ? "· " + dateLabel(c.date) : ""}</p><p>${escape(p.description)}</p><p>${escape(p.family)}</p><p>${escape(p.caution)}</p><p>${c.cost ? money(Number(c.cost)) + " pour quatre · " + (c.priceType === "estimate" ? "estimation" : c.priceType === "quote" ? "devis" : "prix déclaré confirmé") : escape(p.price ?? "Prix non renseigné")}</p>${c.paid ? `<p>Payé déclaré : ${money(Number(c.paid))}</p>` : ""}<p>${escape(c.notes).replace(/\n/g, "<br>")}</p>${c.reference ? `<p>Référence : ${escape(c.reference)}</p>` : ""}${[
      c.room,
      c.included,
      c.cancelBy,
    ]
      .filter(Boolean)
      .map((x) => `<p>${escape(x!)}</p>`)
      .join(
        "",
      )}${safeUrl(p.source) ? `<a href="${escape(p.source)}">Source / établissement</a>` : ""}</article>`;
  }
  const body = stages
    .map(
      (s) =>
        `<section><h2>${escape(s.name)} · ${s.nights} nuit${s.nights > 1 ? "s" : ""}</h2><p>${dateLabel(s.start)} → ${dateLabel(s.end)}</p><p>${escape(s.transfer)}</p><p><b>Alternative :</b> ${escape(s.fallback)}</p><details open><summary>Programme proposé</summary>${daily
          .filter((d) => d.stage === s.id)
          .map(
            (d) =>
              `<article><h3>${dateLabel(d.date)} · ${escape(d.title)}</h3><b>Programme principal</b><p>${fieldTiming}</p><p>Dans le sac : ${escape(guide[d.date].pack)}</p><ol>${guide[d.date].stops.map(s => `<li><b>${escape(s[0])} · ${escape(s[2])}</b> (${s[1]})<br>${escape(s[3])}${s[4] ? `<br><a href="${escape(stopMap(s)!)}">${escape(s[4])} · Maps</a>` : ""}</li>`).join("")}</ol><p><b>Prochain trajet :</b> ${escape(guide[d.date].next)}</p><details><summary>${data.alternatives?.includes(d.date) ? "Alternative retenue" : "Alternative du jour"}</summary>${escape(d.alternative)}</details></article>`,
          )
          .join("")}</details>${all
          .filter(
            (p) =>
              p.stage === s.id &&
              data.choices[p.id] &&
              data.choices[p.id].status !== "idea",
          )
          .map(optionCard)
          .join(
            "",
          )}<details><summary>Les autres hôtels, restaurants et activités</summary>${all
          .filter(
            (p) =>
              p.stage === s.id &&
              (!data.choices[p.id] || data.choices[p.id].status === "idea"),
          )
          .map(optionCard)
          .join("")}</details></section>`,
    )
    .join("");
  const transfers = stages
    .map((s) => {
      const t = data.transfers?.[s.id];
      const fields = t
        ? Object.entries(transferFields)
            .map(
              ([k, label]) =>
                `<p><b>${escape(label)}</b> · ${escape(t[k as keyof typeof transferFields] || "À confirmer")}</p>`,
            )
            .join("")
        : "";
      return `<article><h3>${dateLabel(s.start)} · ${escape(s.name)}</h3><p>${escape(transferRoutes[s.id].join(" → "))}</p><p>${t ? transferStatuses[t.status] : "À organiser"}</p>${fields}<p>${escape(s.fallback)}</p></article>`;
    })
    .join("");
  const flights = data.flights
    ? [
        data.flights.source,
        data.flights.outbound,
        data.flights.inbound,
        data.flights.baggage,
        data.flights.seats,
        data.flights.followUp,
      ]
        .map((s) => `<p>${escape(s).replace(/\n/g, "<br>")}</p>`)
        .join("")
    : "<p>Confirmation privée à importer sur cet appareil.</p>";
  const notes = Object.entries(data.dayNotes)
    .filter(([, n]) => n.trim())
    .map(
      ([d, n]) =>
        `<p><b>${dateLabel(d)}</b> ${escape(n).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  downloadFile(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Philippines 2027 — notre préparation</title><style>body{font:16px/1.65 system-ui;max-width:850px;margin:40px auto;padding:0 24px;color:#243e35;background:#faf8f0}h1,h2,h3{font-family:Georgia}h1{font-size:44px}section{border-top:1px solid #aaa;margin-top:32px}article{padding:12px 20px;border-left:3px solid #45796b;margin:16px 0;break-inside:avoid}a{color:inherit}p{overflow-wrap:anywhere}@media print{body{margin:0;background:white}a{color:black}}</style><h1>Philippines, ensemble.</h1><p>17 février – 9 mars 2027 · 20 nuits · 2 adultes et 2 enfants</p><p>Copie de lecture personnelle. Les statuts sont ceux saisis par la famille ; aucune réservation n’est réalisée par l’application.</p><p>Budget cible ${money(data.budget)} · montants renseignés ${money(sums.estimated)} · payé déclaré ${money(sums.paid)}.</p>${body}<h2>Vols internationaux</h2>${flights}<h2>Fiches de transfert</h2>${transfers}<h2>Alternatives utilisées</h2>${(data.alternatives ?? []).map((date) => `<p>${dateLabel(date)} · ${escape(daily.find((d) => d.date === date)!.alternative)}</p>`).join("")}<h2>Notes quotidiennes</h2>${notes}<h2>Avant le départ</h2>${tasks.map((t) => `<p>${data.checks.includes(t[0]) ? "✓" : "□"} ${escape(t[1])} — ${escape(t[2])} · ${escape(data.decisions?.[t[0]]?.due || "")} ${escape(data.decisions?.[t[0]]?.answer || "")}</p>`).join("")}<h2>Autres dépenses</h2>${data.expenses.map((e) => `<p>${escape(e.label)} : ${money(e.cost)} · payé ${money(e.paid)} · ${e.confirmed ? "confirmé par vous" : "estimation"}</p>`).join("")}<p>Exporté le ${new Date().toLocaleDateString("fr-FR")}. Montants pour quatre. Liens externes nécessitant Internet.</p></html>`,
    "philippines-2027-copie-de-lecture.html",
    "text/html",
  );
}
