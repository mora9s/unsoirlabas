import { coverOf, storyExcerpt } from '../journal'
import type { Draft } from '../journal'
import Icon from './Icon'
import UpcomingTrips from './UpcomingTrips'
import '../travel-library.css'

export default function Home({ openTools, create, drafts, openDraft, editDraft, onOpenJournal, openPlanner, journals }: { openDay: (day: number) => void; openTools: () => void; create: () => void; drafts: Draft[]; openDraft: (draft: Draft) => void; editDraft: (draft: Draft) => void; onOpenJournal: (trip: import('../upcoming-trips').UpcomingTrip) => void; openPlanner: (id: string) => void; journals: import('../trip-journals').PersonalJournal[] }) {
  return <>
    <UpcomingTrips openJournal={onOpenJournal} openPlanner={openPlanner} journals={journals} />
    <div className="discover-demo inspiration-card page-width"><img src="/assets/visayas/apo.jpg" alt="Apo Island, au large de Negros" /><div><p className="eyebrow">Une envie d’ailleurs</p><h2>20 jours dans les Visayas</h2><p>D’île en île, un exemple à explorer puis à adapter à vos envies.</p><small>Apo Island · CariolaMinze · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></small></div><a className="button" href="#visayas">Explorer cet exemple →</a></div>
    <section className="home-pages page-width" aria-labelledby="home-pages-title">
      <header className="library-section-heading"><div><p className="eyebrow">Vos récits</p><h2 id="home-pages-title">Pages personnelles</h2></div><button className="button home-create" onClick={create}>Créer une journée <Icon name="plus" /></button></header>
      {drafts.length ? <div className="personal-memory-grid">{drafts.map(draft => {
        const cover = coverOf(draft)
        return <article key={draft.id} className="personal-memory-card">
          {cover ? <img src={cover.src} alt={`Couverture : ${cover.name}`} /> : <div className="personal-memory-type" aria-hidden="true"><Icon name="book"/><span>Un souvenir à soi</span></div>}
          <div className="personal-memory-copy"><span className="eyebrow">Brouillon personnel</span><h3>{draft.title}</h3><p>{storyExcerpt(draft.story)}</p><div className="personal-actions"><button className="text-button" onClick={() => openDraft(draft)} aria-label={`Lire ${draft.title}`}>Lire</button><button className="text-button" onClick={() => editDraft(draft)} aria-label={`Modifier ${draft.title}`}>Modifier</button></div></div>
        </article>
      })}</div> : <div className="pages-empty"><p>Une journée, une page.</p><span>Gardez les mots et les images que vous voudrez retrouver.</span></div>}

      <button className="text-button home-tools-link" onClick={openTools}>Outils et sauvegarde du carnet <Icon name="arrow" /></button>
    </section>
  </>
}
