import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { FamilyState } from "../family-store";
import { money, dateLabel } from "../family-store";
import {
  emptyTransfer,
  transferRoutes,
  transferFields,
  transferStatuses,
  validFlightPacket,
} from "../family-logistics";
import type { FlightPacket, Transfer } from "../family-logistics";
import type { Stage } from "../family-data";
type Update = (fn: (data: FamilyState) => FamilyState) => boolean;

export function DecisionForm({
  id,
  data,
  update,
}: {
  id: string;
  data: FamilyState;
  update: Update;
}) {
  const previous = data.decisions?.[id];
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    update((d) => ({
      ...d,
      decisions: {
        ...d.decisions,
        [id]: {
          due: String(fields.get("due") ?? ""),
          answer: String(fields.get("answer") ?? "").trim(),
        },
      },
    }));
  }
  return (
    <form
      key={JSON.stringify(previous)}
      onSubmit={save}
      className="fp-edit-form"
    >
      <label>
        Échéance
        <input name="due" type="date" defaultValue={previous?.due} />
      </label>
      <label>
        Réponse obtenue
        <textarea
          name="answer"
          rows={2}
          maxLength={1000}
          defaultValue={previous?.answer}
        />
      </label>
      <button className="fp-secondary">Garder ces renseignements</button>
    </form>
  );
}

export function FlightCard({
  data,
  update,
}: {
  data: FamilyState;
  update: Update;
}) {
  const [pending, setPending] = useState<FlightPacket | null>(null);
  const [message, setMessage] = useState("");
  const [beforeImport, setBeforeImport] = useState("");
  function flightSnapshot(d: FamilyState) {
    return JSON.stringify([
      d.flights,
      d.expenses.find((row) => row.id === "flights"),
    ]);
  }
  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPending(null);
    setMessage("");
    try {
      if (file.size > 60000) throw Error();
      const packet: unknown = JSON.parse(await file.text());
      if (!validFlightPacket(packet)) throw Error();
      setBeforeImport(flightSnapshot(data));
      setPending(packet);
    } catch {
      setMessage(
        "Choisissez le récapitulatif privé de vols au format JSON. Vos données sont conservées.",
      );
    }
  }
  const flights = pending ?? data.flights;
  function apply() {
    if (!pending) return;
    if (
      update((d) => {
        if (flightSnapshot(d) !== beforeImport)
          throw Error(
            "Les vols ou leur prix ont changé. Rouvrez le fichier avant de confirmer.",
          );
        const expense = {
          id: "flights",
          label: "Vols internationaux · quatre billets",
          cost: pending.total,
          paid: pending.paid,
          confirmed: true,
        };
        return {
          ...d,
          flights: pending,
          expenses: [...d.expenses.filter((x) => x.id !== "flights"), expense],
        };
      })
    ) {
      setPending(null);
      setMessage("Confirmation et budget enregistrés sur cet appareil.");
    }
  }
  return (
    <section className="fp-backup-panel">
      <h3>Nos vols internationaux</h3>
      {flights ? (
        <>
          <p>{flights.source}</p>
          <div className="fp-flight-grid">
            {[
              ["Aller", flights.outbound],
              ["Retour", flights.inbound],
            ].map(([label, details]) => (
              <article key={label}>
                <h4>{label}</h4>
                <p className="fp-lines">{details}</p>
              </article>
            ))}
          </div>
          <p>
            <strong>Bagages</strong> · {flights.baggage}
          </p>
          <p>
            <strong>Sièges</strong> · {flights.seats}
          </p>
          <p>{flights.followUp}</p>
          <p>
            Total familial {money(flights.total)} · payé {money(flights.paid)}
          </p>
        </>
      ) : (
        <p>
          Importez le récapitulatif de confirmation pour afficher les six
          segments, les bagages et le prix des billets sur ce téléphone.
        </p>
      )}
      <label>
        Importer le récapitulatif privé de vols{" "}
        <input
          type="file"
          accept=".json,application/json"
          onChange={readFile}
        />
      </label>
      {pending && (
        <div>
          <p>
            Cette opération remplace uniquement la fiche de vols et le poste «
            Vols internationaux » du budget. Vérifiez le total et le montant
            payé ci-dessus.
          </p>
          <button className="fp-primary" onClick={apply}>
            Appliquer la confirmation et son montant
          </button>
          <button className="fp-secondary" onClick={() => setPending(null)}>
            Annuler
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function TransferSheet({
  stage,
  data,
  update,
}: {
  stage: Stage;
  data: FamilyState;
  update: Update;
}) {
  const saved = data.transfers?.[stage.id] ?? emptyTransfer();
  const expenseId = "transfer-" + stage.id;
  const expense = data.expenses.find((x) => x.id === expenseId);
  const [editing, setEditing] = useState(false),
    [snapshot, setSnapshot] = useState(""),
    [error, setError] = useState("");
  function edit() {
    setSnapshot(JSON.stringify([saved, expense]));
    setEditing(true);
    setError("");
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const t = emptyTransfer();
    for (const k of Object.keys(
      transferFields,
    ) as (keyof typeof transferFields)[])
      t[k] = String(form.get(k) ?? "").trim();
    t.status = String(form.get("status")) as Transfer["status"];
    const amount = String(form.get("cost") ?? "");
    const paid = Number(form.get("paid") || 0);
    if (paid > Number(amount)) {
      setError("Le montant payé dépasse le prix familial saisi.");
      return;
    }
    const ok = update((d) => {
      const row = d.expenses.find((x) => x.id === expenseId);
      if (
        JSON.stringify([d.transfers?.[stage.id] ?? emptyTransfer(), row]) !==
        snapshot
      )
        throw Error(
          "Cette fiche a changé dans un autre onglet. Gardez votre brouillon puis rouvrez la fiche.",
        );
      const expenses = d.expenses.filter((x) => x.id !== expenseId);
      if (amount !== "")
        expenses.push({
          id: expenseId,
          label: "Transfert · " + stage.name,
          cost: Number(amount),
          paid,
          confirmed: form.get("quote") === "on",
        });
      return { ...d, transfers: { ...d.transfers, [stage.id]: t }, expenses };
    });
    if (ok) {
      setEditing(false);
      setError("");
    } else
      setError(
        "La fiche n’a pas été enregistrée. Consultez le message de stockage avant de réessayer.",
      );
  }
  return (
    <details className="fp-transfer-sheet">
      <summary>
        Fiche de transfert · {dateLabel(stage.start)} · {stage.name}
      </summary>
      <p>
        <b>{transferRoutes[stage.id].join(" → ")}</b>
      </p>
      <p>{stage.transfer}</p>
      <p>
        <b>{transferStatuses[saved.status]}</b>
      </p>
      {stage.id === "mactan" && (
        <p>
          Traversée visée le 7 mars. En cas d’annulation, vérifier une place le
          8, prévenir les chauffeurs et l’hôtel. Vol international prévu le 9 au
          soir.
        </p>
      )}
      {editing ? (
        <form onSubmit={submit} className="fp-edit-form">
          <label>
            État du transfert
            <select name="status" defaultValue={saved.status}>
              {Object.entries(transferStatuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {Object.entries(transferFields).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={key}
                rows={2}
                maxLength={1200}
                defaultValue={saved[key as keyof typeof transferFields]}
              />
            </label>
          ))}
          <div className="fp-form-grid">
            <label>
              Prix total du transfert pour quatre (€)
              <input
                name="cost"
                type="number"
                min="0"
                step=".01"
                max="1000000"
                defaultValue={expense?.cost}
              />
            </label>
            <label>
              Déjà payé (€)
              <input
                name="paid"
                type="number"
                min="0"
                step=".01"
                max="1000000"
                defaultValue={expense?.paid}
              />
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              name="quote"
              defaultChecked={expense?.confirmed}
            />{" "}
            Prix confirmé par le prestataire
          </label>
          <p>
            Le montant crée ou actualise une seule ligne dans le budget
            familial.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="fp-primary">Enregistrer le transfert</button>
          <button
            type="button"
            className="fp-secondary"
            onClick={() => setEditing(false)}
          >
            Annuler
          </button>
        </form>
      ) : (
        <>
          <dl>
            {Object.entries(transferFields).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="fp-lines">
                  {saved[key as keyof typeof transferFields] ||
                    (key === "fallback" ? stage.fallback : "À confirmer")}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            {expense
              ? money(expense.cost) +
                " pour quatre · payé " +
                money(expense.paid)
              : "Prix familial à obtenir"}
          </p>
          <button className="fp-secondary" onClick={edit}>
            Modifier le transfert
          </button>
        </>
      )}
    </details>
  );
}
