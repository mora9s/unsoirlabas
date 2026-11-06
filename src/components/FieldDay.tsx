import { daily } from "../family-programme";
import type { PlanDay } from "../family-programme";
import { places, stages } from "../family-data";
import { fieldTiming, guide, stopMap } from "../field-guide";
import { transferFields, transferStatuses } from "../family-logistics";
import { dateLabel, downloadFile, statusLabels } from "../family-store";
import type { FamilyState } from "../family-store";
import "./field-guide.css";

export default function FieldDay({day, data, move}: {day: PlanDay; data: FamilyState; move: (day: PlanDay) => void}) {
  const {pack, stops, next} = guide[day.date];
  const index = daily.indexOf(day);
  const stage = stages.find(s => s.id === day.stage)!;
  const leg = stages.find(s => s.start === day.date || (s.start === daily[index + 1]?.date));
  const transfer = leg && data.transfers?.[leg.id];
  const confirmed = [...places, ...data.custom].filter(p => {
    const c = data.choices[p.id];
    return c && (c.status === "chosen" || c.status === "booked") && c.date === day.date;
  });
  const personal = [
    ...confirmed.map(p => p.name + " · " + statusLabels[data.choices[p.id].status] + (data.choices[p.id].notes ? " — " + data.choices[p.id].notes : "")),
    ...(transfer && leg ? ["Transfert du " + dateLabel(leg.start) + " · " + transferStatuses[transfer.status], ...Object.entries(transferFields).flatMap(([key, label]) => {
      const v = transfer[key as keyof typeof transferFields]; return v ? [label + " : " + v] : [];
    })] : []),
    ...(data.dayNotes[day.date] ? ["Note du jour : " + data.dayNotes[day.date]] : []),
    ...(data.flights && (index === 0 || index === daily.length - 1) ? ["Vols · confirmation importée : " + (index === 0 ? data.flights.outbound : data.flights.inbound)] : [])
  ];
  const altActive = data.alternatives?.includes(day.date);
  function download() {
    const rows = stops.map(s => [s[0] + " · " + s[1] + " · " + s[2], s[3], s[4] && "Lieu : " + s[4], stopMap(s)].filter(Boolean).join("\n"));
    downloadFile([dateLabel(day.date) + " 2027 · " + stage.name + " · " + day.title, "Programme principal", altActive && "Vous avez activé une alternative pour cette date.", fieldTiming, "Dans le sac : " + pack, ...rows, "Prochain trajet : " + next, ...personal].filter(Boolean).join("\n\n"), "jour-" + day.date + ".txt", "text/plain;charset=utf-8");
  }
  return <div className="field-guide">
    <p className="field-kicker">{dateLabel(day.date)} · {stage.name} · Jour {index+1} sur {daily.length}</p>
    {altActive && <p className="field-notice">Une alternative est activée pour ce jour. Vous consultez le programme principal.</p>}
    <p>{fieldTiming}</p>
    {personal.length > 0 && <section className="field-callout"><h3>Vos repères enregistrés</h3>{personal.map((p,i) => <p key={i}>{p}</p>)}</section>}
    <section className="field-pack"><h3>Dans le sac</h3><p>{pack}</p></section>
    <ol className="field-line">{stops.map(s => <li key={s[2]}>
      <div className="field-hour">{s[0]}</div>
      <div className="field-stop"><small>{s[1]}</small><h3>{s[2]}</h3><p>{s[3]}</p>
        {s[4] && <><p className="field-address">{s[4]}</p><a href={stopMap(s)} target="_blank" rel="noreferrer">{s[5] ? "Itinéraire en voiture" : "Voir le lieu"} sur Google Maps ↗</a></>}
      </div>
    </li>)}</ol>
    <section className="field-callout"><h3>Prochain trajet à préparer</h3><p>{next}</p></section>
    <button type="button" className="fp-secondary" onClick={download}>Enregistrer la fiche hors ligne (.txt)</button>
    <p className="fp-fine">Le texte et les noms des lieux restent lisibles sans réseau. Ouvrez les liens Maps avec une connexion.</p>
    <nav className="field-nav" aria-label="Parcourir les fiches du voyage">
      <button type="button" className="fp-secondary" disabled={!index} onClick={() => move(daily[index-1])}>← Veille</button>
      <button type="button" className="fp-secondary" disabled={index === daily.length-1} onClick={() => move(daily[index+1])}>Lendemain →</button>
    </nav>
  </div>;
}
