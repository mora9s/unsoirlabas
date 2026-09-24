import { asset, days } from '../journal'
import Icon from './Icon'

export default function Demo({ openDay }: { openDay: (day: number) => void }) {
  return <>
    <section className="demo-hero" aria-labelledby="demo-title">
      <img src={asset('el-nido-big-lagoon.jpg')} alt="Le Big Lagoon d’El Nido, entre eau turquoise et falaises de calcaire" />
      <div><p className="eyebrow">Voyage de démonstration · Philippines</p><h1 id="demo-title">Un carnet pour découvrir le format.</h1><p>Trois journées racontées sur place. Ce contenu est éditorial et reste distinct de vos voyages et souvenirs personnels.</p></div>
    </section>
    <section className="demo-chronicle page-width" aria-labelledby="demo-chronicle-title">
      <header className="library-section-heading"><div><p className="eyebrow">Le fil du voyage</p><h2 id="demo-chronicle-title">D’une île à l’autre.</h2></div><span>3 étapes · un même carnet</span></header>
      <div className="day-list">
        {days.map(day => <article className={`day-entry day-${day.status}`} key={day.day} data-testid="day-card" data-status={day.status}>
          <div className="timeline-marker"><span>JOUR</span><strong>{String(day.day).padStart(2, '0')}</strong><span className="timeline-dot" /></div>
          <button className="day-image" aria-label={`Voir le jour ${day.day} — ${day.place}`} onClick={() => openDay(day.day)}><img src={asset(day.image)} alt={day.alt} /><span className="image-place">{day.place}</span></button>
          <div className="day-copy"><span className={`status ${day.status}`}><i />{day.label}</span><h3>{day.title}</h3><p>{day.excerpt}</p><button className="text-button" onClick={() => openDay(day.day)}>{day.day === 3 ? 'Explorer ce chapitre' : day.day === 1 ? 'Relire cette journée' : 'Imaginer la suite'}<Icon name="arrow" /></button></div>
        </article>)}
      </div>
    </section>
  </>
}
