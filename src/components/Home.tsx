import { asset, coverOf, days, storyExcerpt } from '../journal'
import type { Draft } from '../journal'
import Backup from './Backup'
import Icon from './Icon'

export default function Home({ openDay, create, drafts, openDraft, editDraft, trip, onRestore }: { openDay: (day: number) => void; create: () => void; drafts: Draft[]; openDraft: (draft: Draft) => void; editDraft: (draft: Draft) => void; trip: import('../journal').Trip; onRestore: (trip: import('../journal').Trip) => void }) {
  return <>
    <section className="trip-hero" aria-labelledby="trip-title">
      <img className="hero-photo" src={asset('el-nido-big-lagoon.jpg')} alt="Le Big Lagoon d’El Nido, entre eau turquoise et falaises de calcaire" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-top"><span className="eyebrow">Carnet de voyage · Asie du Sud-Est</span><span className="coordinates">11°10′ N — 119°24′ E</span></div>
      <div className="hero-copy">
        <p className="eyebrow">Loin du quotidien. Tout près de l’essentiel.</p>
        <h1 id="trip-title">Philippines<span>18 jours entre îles et lumière</span></h1>
        <button className="button button-light" onClick={() => openDay(3)} aria-label="Découvrir le jour 3">Ouvrir le carnet <Icon name="arrow" /></button>
      </div>
      <div className="hero-bottom"><span>Manille <i /> Palawan <i /> Bohol</span><span>18 jours <span className="divider">/</span> Mille façons de se souvenir</span></div>
      <div className="travel-seal" aria-hidden="true"><span>PRENDRE LE TEMPS</span><strong>18</strong><span>JOURS D’AILLEURS</span></div>
    </section>
    <section className="intro page-width">
      <span className="eyebrow"><span className="tiny-sun" aria-hidden="true" /> Le bonheur de garder une trace</span>
      <p>Les journées passent.<br />Les <em>souvenirs</em> restent.</p>
      <div>Chaque soir, dix minutes pour transformer la journée en souvenir durable et partageable.<br /><span>Un lieu, une lumière, une histoire à nous.</span></div>
    </section>
    <section className="chronicle page-width" aria-labelledby="chronicle-title">
      <div className="section-heading"><div><p className="eyebrow">Le fil du voyage</p><h2 id="chronicle-title">D’une île à l’autre.</h2></div><span className="quiet-note">3 étapes · un même carnet</span></div>
      <div className="day-list">
        {days.map(day => <article className={`day-entry day-${day.status}`} key={day.day} data-testid="day-card" data-status={day.status}>
          <div className="timeline-marker"><span>JOUR</span><strong>{String(day.day).padStart(2, '0')}</strong><span className="timeline-dot" /></div>
          <button className="day-image" aria-label={`Voir le jour ${day.day} — ${day.place}`} onClick={() => openDay(day.day)}><img src={asset(day.image)} alt={day.alt} /><span className="image-place">{day.place}</span></button>
          <div className="day-copy"><span className={`status ${day.status}`}><i />{day.label}</span><h3>{day.title}</h3><p>{day.excerpt}</p><button className="text-button" onClick={() => openDay(day.day)}>{day.day === 3 ? 'Explorer ce chapitre' : day.day === 1 ? 'Relire cette journée' : 'Imaginer la suite'}<Icon name="arrow" /></button></div>
        </article>)}
      </div>
    </section>
    <Backup trip={trip} onRestore={onRestore} />
    {drafts.length > 0 && <section className="saved-drafts page-width" aria-labelledby="drafts-title"><p className="eyebrow">Conservés sur cet appareil</p><h2 id="drafts-title">Vos nouvelles pages</h2>{drafts.map(draft => {
      const cover = coverOf(draft)
      return <article key={draft.id} className="personal-entry">
        <div className={`personal-cover ${cover ? '' : 'cover-without-photo'}`}>
          {cover ? <img src={cover.src} alt={`Couverture : ${cover.name}`} /> : <><Icon name="book" /><p>Il reste les mots.</p></>}
        </div>
        <div className="day-copy"><span className="status draft"><i />Brouillon personnel</span><h3>{draft.title}</h3><p>{storyExcerpt(draft.story)}</p>
          <div className="personal-actions">
            <button className="text-button" onClick={() => openDraft(draft)} aria-label={`Lire ${draft.title}`}>Lire ce chapitre<Icon name="arrow" /></button>
            <button className="text-button" onClick={() => editDraft(draft)} aria-label={`Modifier ${draft.title}`}>Modifier la journée<Icon name="book" /></button>
          </div>
        </div>
      </article>
    })}</section>}
    <section className="invitation page-width"><span className="eyebrow">Le rituel du soir</span><h2>Et aujourd’hui,<br />qu’allez-vous <em>garder</em> ?</h2><p>Quelques photos. Vos mots. Une nouvelle page du voyage.</p><button className="button" onClick={create}>Raconter ma journée <Icon name="plus" /></button><span className="local-note">Votre carnet reste sur cet appareil.</span></section>
  </>
}
