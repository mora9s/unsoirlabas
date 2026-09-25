import type { PersonalJournal } from '../trip-journals'
import type { Draft } from '../journal'

export default function TripJournal({ journal, open, create, edit, openMotion }: { journal: PersonalJournal; openMotion?: () => void; open: (draft: Draft) => void; create: () => void; edit: (draft: Draft) => void }) {
  return <section className="trip-journal page-width" data-testid="trip-journal">
    <p className="eyebrow">Carnet personnel · {journal.departure || 'sans date ajoutée'}</p>
    <h1>{journal.destination}<span>Les pages de ce voyage</span></h1>
    <p className="journal-intro">Un carnet indépendant, avec vos mots et vos images. Aucun souvenir n’est ajouté sans vous.</p>
    <button className="button" onClick={create}>Écrire un chapitre pour {journal.destination}<span aria-hidden="true">＋</span></button>
    {openMotion && <button className="button button-outline" onClick={openMotion}>Voir le voyage →</button>}
    {!journal.chapters.length ? <p className="journal-empty">Les pages de ce voyage apparaîtront ici.</p> : <div className="journal-chapters">{journal.chapters.map(chapter => <article key={chapter.id} data-testid="journal-chapter-card">
      <div>{chapter.media[0] && <img src={(chapter.media.find(item => item.id === chapter.coverId) ?? chapter.media[0]).src} alt="" />}<span className="eyebrow">Chapitre personnel</span><h2>{chapter.title}</h2><p>{chapter.story.replace(/\s+/g, ' ').slice(0, 180)}</p></div>
      <div className="personal-actions"><button className="text-button" onClick={() => open(chapter)}>Lire</button><button className="text-button" onClick={() => edit(chapter)}>Modifier</button></div>
    </article>)}</div>}
  </section>
}
