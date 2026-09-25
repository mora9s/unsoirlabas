import { coverOf, storyExcerpt } from '../journal'
import type { Draft } from '../journal'
import type { PersonalJournal } from '../trip-journals'

export default function TripJournal({ journal, open, create, edit, back }: { journal: PersonalJournal; open: (chapter: Draft) => void; create: () => void; edit: (chapter: Draft) => void; back: () => void }) {
  const lead = journal.chapters.find(item => coverOf(item))
  const cover = lead && coverOf(lead)
  return <section className="trip-journal page-width" data-testid="trip-journal">
    <button className="text-button" onClick={back}>← Retour au voyage</button>
    <header className="trip-journal-hero">
      {cover && <img src={cover.src} alt={`Couverture personnelle : ${cover.name}`} />}
      <div><p className="eyebrow">Carnet personnel · {journal.destination}</p><h1>{journal.destination}<span>Les jours que l’on garde.</span></h1><p>Vos mots, vos photos, un voyage à la fois.</p><button className="button button-light" onClick={create}>Raconter cette journée →</button></div>
    </header>
    {journal.chapters.length === 0 ? <div className="trip-journal-empty"><p className="eyebrow">La première page vous attend</p><h2>Tout commence par un souvenir.</h2><p>Vos étapes préparées ne deviennent pas des journées vécues automatiquement. Quand vous le souhaitez, racontez la première.</p></div> : <div className="trip-journal-list" aria-label="Journées de ce voyage">{journal.chapters.map((chapter, index) => {
      const photo = coverOf(chapter)
      return <article key={chapter.id} className="trip-journal-card" data-testid="journal-chapter-card">
        <div className="trip-journal-card-cover">{photo ? <img src={photo.src} alt={`Couverture : ${photo.name}`} /> : <span>Chapitre {String(index + 1).padStart(2, '0')}</span>}</div>
        <div><p className="eyebrow">Page {String(index + 1).padStart(2, '0')} · Brouillon privé</p><h2>{chapter.title}</h2><p>{storyExcerpt(chapter.story)}</p><div className="personal-actions"><button className="text-button" onClick={() => open(chapter)}>Lire la journée →</button><button className="text-button" onClick={() => edit(chapter)}>Modifier</button></div></div>
      </article>
    })}</div>}
  </section>
}
