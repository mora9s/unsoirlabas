import { daily, kindLabels, places, stages, tasks } from "./family-data";
import type { Place } from "./family-data";

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
    Object.keys(v).sort().join() !==
    ["version", "choices", "custom", "checks", "budget", "expenses", "dayNotes"]
      .sort()
      .join()
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
  const ids = new Set([
    ...places.map((p) => p.id),
    ...v.custom.map((p) => p.id),
  ]);
  if (ids.size !== places.length + v.custom.length) return false;
  if (
    !Object.entries(v.choices).every(
      ([id, c]) =>
        ids.has(id) &&
        object(c) &&
        Object.hasOwn(statusLabels, String(c.status)) &&
        str(c.notes, 4000) &&
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
          (validDate(c.date) &&
            stages.some(
              (s) =>
                s.id ===
                  [...places, ...(v.custom as Place[])].find((p) => p.id === id)
                    ?.stage &&
                String(c.date) >= s.start &&
                String(c.date) <= s.end,
            ))) &&
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
export function readFamily(): { data: FamilyState; error: string } {
  try {
    const raw = localStorage.getItem(familyKey);
    if (raw === null) return { data: initialState(), error: "" };
    const data: unknown = JSON.parse(raw);
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
  if (
    !object(v) ||
    v.format !== "unsoirlabas-family" ||
    !validateFamily(v.data)
  )
    throw Error("Ce fichier de préparation est invalide ou incompatible.");
  return v.data;
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
    return `<article><h3>${escape(p.name)}</h3><p>${kindLabels[p.kind]} · ${statusLabels[c.status]} ${c.date ? "· " + dateLabel(c.date) : ""}</p><p>${escape(p.description)}</p><p>${escape(p.family)}</p><p>${escape(p.caution)}</p><p>${c.cost ? money(Number(c.cost)) + " pour quatre · " + (c.priceType === "estimate" ? "estimation" : c.priceType === "quote" ? "devis" : "prix déclaré confirmé") : escape(p.price ?? "Prix non renseigné")}</p>${c.paid ? `<p>Payé déclaré : ${money(Number(c.paid))}</p>` : ""}<p>${escape(c.notes).replace(/\n/g, "<br>")}</p>${c.reference ? `<p>Référence : ${escape(c.reference)}</p>` : ""}${safeUrl(p.source) ? `<a href="${escape(p.source)}">Source / établissement</a>` : ""}</article>`;
  }
  const body = stages
    .map(
      (s) =>
        `<section><h2>${escape(s.name)} · ${s.nights} nuit${s.nights > 1 ? "s" : ""}</h2><p>${dateLabel(s.start)} → ${dateLabel(s.end)}</p><p>${escape(s.transfer)}</p><p><b>Alternative :</b> ${escape(s.fallback)}</p><details open><summary>Programme proposé</summary>${daily
          .filter((d) => d[1] === s.id)
          .map(
            (d) =>
              `<p><b>${dateLabel(d[0])} · ${escape(d[2])}</b><br>${escape(d[3])}</p>`,
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
  const notes = Object.entries(data.dayNotes)
    .filter(([, n]) => n.trim())
    .map(
      ([d, n]) =>
        `<p><b>${dateLabel(d)}</b> ${escape(n).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  downloadFile(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Philippines 2027 — notre préparation</title><style>body{font:16px/1.65 system-ui;max-width:850px;margin:40px auto;padding:0 24px;color:#243e35;background:#faf8f0}h1,h2,h3{font-family:Georgia}h1{font-size:44px}section{border-top:1px solid #aaa;margin-top:32px}article{padding:12px 20px;border-left:3px solid #45796b;margin:16px 0;break-inside:avoid}a{color:inherit}p{overflow-wrap:anywhere}@media print{body{margin:0;background:white}a{color:black}}</style><h1>Philippines, ensemble.</h1><p>17 février – 9 mars 2027 · 20 nuits · 2 adultes et 2 enfants</p><p>Copie de lecture personnelle. Les statuts sont ceux saisis par la famille ; aucune réservation n’est réalisée par l’application.</p><p>Budget cible ${money(data.budget)} · montants renseignés ${money(sums.estimated)} · payé déclaré ${money(sums.paid)}.</p>${body}<h2>Notes quotidiennes</h2>${notes}<h2>Avant le départ</h2>${tasks.map((t) => `<p>${data.checks.includes(t[0]) ? "✓" : "□"} ${escape(t[1])} — ${escape(t[2])}</p>`).join("")}<h2>Autres dépenses</h2>${data.expenses.map((e) => `<p>${escape(e.label)} : ${money(e.cost)} · payé ${money(e.paid)} · ${e.confirmed ? "confirmé par vous" : "estimation"}</p>`).join("")}<p>Exporté le ${new Date().toLocaleDateString("fr-FR")}. Montants pour quatre. Liens externes nécessitant Internet.</p></html>`,
    "philippines-2027-copie-de-lecture.html",
    "text/html",
  );
}
