import { stages } from "./family-data";
export type FlightPacket = {
  format: "family-flights-v1";
  source: string;
  outbound: string;
  inbound: string;
  baggage: string;
  seats: string;
  followUp: string;
  total: number;
  paid: number;
};
export const transferFields = {
  pickup: "Hôtel de départ, chauffeur et point de rendez-vous",
  departure: "Port de départ, opérateur et traversée",
  timing: "Heure du bateau, limite de présentation et source datée",
  arrival: "Port d’arrivée, chauffeur et hôtel de destination",
  family: "Bagages, sièges enfants, pauses et contacts",
  fallback: "Plan de repli et personnes à prévenir",
} as const;
export type Transfer = Record<keyof typeof transferFields, string> & {
  status: "planned" | "partial" | "confirmed";
};
export const transferStatuses = {
  planned: "À organiser",
  partial: "Partiellement confirmé",
  confirmed: "Confirmé par la famille",
} as const;
export const transferRoutes: Record<string, string[]> = {
  moalboal: [
    "Aéroport de Mactan-Cebu",
    "Voiture privée avec pause",
    "Hôtel de Moalboal",
  ],
  negros: [
    "Hôtel de Moalboal",
    "Liloan / Santander",
    "Ferry vers Sibulan",
    "Hôtel de Dauin ou Zamboanguita",
  ],
  siquijor: [
    "Hôtel de Dauin",
    "Port de Dumaguete",
    "Ferry vers Siquijor",
    "Hôtel de San Juan",
  ],
  bohol: [
    "Hôtel de San Juan",
    "Port de Siquijor à préciser",
    "Ferry vers Tagbilaran",
    "Hôtel de Panglao",
  ],
  mactan: [
    "Hôtel de Panglao",
    "Port de Tagbilaran",
    "Ferry vers Cebu, quai à confirmer",
    "Chauffeur vers l’hôtel de Mactan",
  ],
};
export function emptyTransfer(): Transfer {
  return {
    pickup: "",
    departure: "",
    timing: "",
    arrival: "",
    family: "",
    fallback: "",
    status: "planned",
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const shortText = (v: unknown, limit: number) =>
  typeof v === "string" && v.length <= limit;
const cash = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000000;
export function validFlightPacket(v: unknown): v is FlightPacket {
  const fields = [
    "source",
    "outbound",
    "inbound",
    "baggage",
    "seats",
    "followUp",
  ];
  return (
    record(v) &&
    Object.keys(v).length === 9 &&
    v.format === "family-flights-v1" &&
    fields.every(
      (k) => shortText(v[k], 3000) && String(v[k]).trim().length > 0,
    ) &&
    cash(v.total) &&
    cash(v.paid) &&
    v.paid <= v.total
  );
}
export function validTransfers(v: unknown) {
  return (
    record(v) &&
    Object.entries(v).every(
      ([stage, t]) =>
        stages.some((s) => s.id === stage) &&
        record(t) &&
        Object.hasOwn(transferStatuses, String(t.status)) &&
        Object.keys(t).length === Object.keys(transferFields).length + 1 &&
        Object.keys(transferFields).every((k) => shortText(t[k], 1200)),
    )
  );
}
