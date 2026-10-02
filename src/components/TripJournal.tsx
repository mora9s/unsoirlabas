import type { PersonalJournal } from '../trip-journals'
import type { Draft } from '../journal'
import { upcomingForJournal } from '../trip-journals'

export default function TripJournal({ journal, open, create, edit }: { journal: PersonalJournal; open: (draft: Draft) => void; create: () => void; edit: (draft: Draft) => void }) {
  const currentPlan = upcomingForJournal(journal.tripId)?.plan
  return <section className="trip-journal page-width" data-testid="trip-journal">
    <p className="eyebrow">Carnet personnel · {journal.departure || 'sans date ajoutée'}</p>
    <h1>{journal.destination}<span>Les pages de ce voyage</span></h1>
    <p className="journal-intro">Un carnet indépendant, avec vos mots et vos images. Aucun souvenir n’est ajouté sans vous.</p>
    <p className="journal-intro">Ce soir à {journal.destination}, quelques mots et les photos de votre choix suffisent.</p>
    {journal.chapters.some(chapter => chapter.plannedStep) && <ul className="journal-intro planned-step-links" aria-label="Liens entre étapes prévues et chapitres">{journal.chapters.filter(chapter => chapter.plannedStep).map(chapter => {
      const link = chapter.plannedStep!
      const stop = link.tripId === journal.tripId ? currentPlan?.stops.find(item => item.id === link.stepId) : undefined
      return <li key={chapter.id} data-testid="planned-step-link"><strong>{stop ? `Étape prévue · ${stop.place}` : `Étape prévue retirée du plan · ${link.place}`}</strong><span> · {chapter.title}</span></li>
    })}</ul>}
    <button className="button" onClick={create}>Écrire un chapitre pour {journal.destination}<span aria-hidden="true">＋</span></button>
    {!journal.chapters.length ? <p className="journal-empty">Les pages de ce voyage apparaîtront ici.</p> : <div className="journal-chapters">{journal.chapters.map(chapter => <article key={chapter.id} data-testid="journal-chapter-card">
      <div>{chapter.media[0] && <img src={(chapter.media.find(item => item.id === chapter.coverId) ?? chapter.media[0]).src} alt="" />}<span className="eyebrow">Chapitre personnel</span><h2>{chapter.title}</h2><p>{chapter.story.replace(/\s+/g, ' ').slice(0, 180)}</p>{chapter.plannedStep && (() => { const link = chapter.plannedStep!; const stop = link.tripId === journal.tripId ? currentPlan?.stops.find(item => item.id === link.stepId) : undefined; return <p className="planned-step-link" data-testid="planned-step-link">{stop ? `Étape prévue · ${stop.place}` : `Étape prévue retirée du plan · ${link.place}`}</p> })()}</div>
      <div className="personal-actions"><button className="text-button" onClick={() => open(chapter)}>Lire</button><button className="text-button" onClick={() => edit(chapter)}>Modifier</button></div>
    </article>)}</div>}
  </section>
}
