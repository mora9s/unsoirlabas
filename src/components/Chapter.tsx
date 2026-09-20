import { asset, days, gallery } from '../journal'
import Icon from './Icon'

export default function Chapter({ dayNumber, openDay, home, share }: { dayNumber: number; openDay: (day: number) => void; home: () => void; share: () => void }) {
  const day = days.find(item => item.day === dayNumber) ?? days[1]
  const isElNido = day.day === 3
  return <article className="chapter" data-testid={isElNido ? 'day-detail' : undefined}>
    <div className="chapter-toolbar page-width"><button className="text-button" onClick={home}><Icon name="left" /> Le carnet</button><span className={`status ${day.status}`}><i />{day.label}</span></div>
    <header className="chapter-heading page-width"><p className="eyebrow">Jour {String(day.day).padStart(2, '0')} <span className="divider">/</span> {day.place}</p><h1>{day.title}</h1><p>{day.excerpt}</p><span className="quiet-note">{isElNido ? 'Une journée au rythme de l’eau · 4 min de lecture' : day.day === 1 ? 'La première page du voyage · 2 min de lecture' : 'Une étape à imaginer, pas encore à raconter'}</span></header>
    <figure className="chapter-cover"><img src={asset(day.image)} alt={day.alt} /><figcaption>{isElNido ? 'Le Big Lagoon, là où les falaises nous font oublier le reste.' : day.place}<span>PHILIPPINES / JOUR {String(day.day).padStart(2, '0')}</span></figcaption></figure>
    {isElNido ? <>
      <div className="editorial-body page-width">
        <aside>
          <span className="eyebrow">Sur cette page</span>
          <a href="#day-3/recit">Les mots du jour</a>
          <a href="#day-3/instants">Les instants</a>
          <a href="#day-3/images">L’album</a>
          <a href="#day-3/film">Une fenêtre ailleurs</a>
          <span className="aside-location">PALAWAN<br />11°10′ N<br />119°24′ E</span>
        </aside>
        <div className="prose" id="day-3/recit">
          <p className="lead drop-cap">Ce matin, El Nido s’est réveillé avant nous. Dans la rue, on entendait déjà les moteurs et les premières conversations. Nous avons pris un café, glissé une serviette dans le sac, puis rejoint la plage sans trop savoir quelle couleur aurait la journée.</p>
          <p>À peine le bateau éloigné du rivage, la ville a disparu derrière les reliefs. Devant nous, les îles de Bacuit se découpaient les unes après les autres. Le vent séchait nos bras ; de temps en temps, une éclaboussure nous rappelait que nous étions vraiment partis.</p>
          <h2>À hauteur de pagaie.</h2><p>Au Big Lagoon, nous avons laissé le bateau pour un kayak. Il a fallu trouver notre rythme : deux coups de pagaie à gauche, un rire, puis un petit détour involontaire. L’eau était si claire que nous ralentissions pour regarder le fond. À l’ombre des falaises, le turquoise devenait presque vert.</p>
          <blockquote>« On était venus voir les îles.<br />On a surtout appris à ralentir. »</blockquote>
          <p>À midi, nous avons partagé du riz, du poisson et des fruits sur le bateau. Rien de compliqué. Les cheveux encore mouillés, nous regardions les embarcations traverser la baie. Ce déjeuner restera peut-être autant que les paysages : le sel sur les lèvres, la faim, et le plaisir de n’avoir nulle part où courir.</p>
          <p>Sur le chemin du retour, personne ne parlait beaucoup. Les falaises défilaient et nous essayions de retenir leurs formes. Le soir, à El Nido, nous avons trié les photos sans chercher la plus parfaite. Nous avons gardé celles qui nous ramenaient là-bas : au ras de l’eau, ensemble, exactement à notre place.</p>
          <p className="handwritten">À garder : le silence entre deux coups de pagaie.</p>
        </div>
      </div>
      <section className="moments page-width" id="day-3/instants">
        <div className="section-heading">
          <div><p className="eyebrow">Les petits repères</p><h2>Une journée, trois instants.</h2></div>
        </div>
        <ol>
          <li>
            <span>01 / LE DÉPART</span><h3>La baie de Bacuit</h3>
            <p>Prendre le large et regarder la côte s’effacer doucement.</p>
          </li>
          <li>
            <span>02 / LA PARENTHÈSE</span><h3>Big Lagoon</h3>
            <p>Pagayer entre les falaises. Oublier l’heure, et presque tout le reste.</p>
          </li>
          <li>
            <span>03 / LE RETOUR</span><h3>El Nido</h3>
            <p>Retrouver la terre ferme, les rues animées et les mots du soir.</p>
          </li>
        </ol>
      </section>
      <section className="album page-width" id="day-3/images">
        <div className="section-heading">
          <div><p className="eyebrow">Fragments de Palawan</p><h2>Ce que les mots ne disent pas.</h2></div>
          <span className="quiet-note">06 photographies</span>
        </div>
        <div className="photo-mosaic">
          {gallery.map((photo, index) => (
            <figure key={photo.image} className={`photo-${index + 1}`}>
              <img src={asset(photo.image)} alt={photo.alt} loading="lazy" />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p className="album-note">Notre album d’El Nido, avec une image de Port Barton mise de côté pour la suite du voyage.</p>
      </section>
      <section className="film-section page-width" id="day-3/film">
        <div>
          <p className="eyebrow">Une fenêtre ailleurs</p>
          <h2>Le temps<br />d’une vague.</h2>
          <p>Une échappée à Nakabuang Beach, sur l’île de Sabtang, dans les Batanes. Un autre coin des Philippines à rêver, pas une vidéo tournée à El Nido.</p>
          <span className="quiet-note">Film du fonds local · lecture à votre rythme</span>
        </div>
        <figure>
          <video controls playsInline preload="metadata" aria-label="Vagues sur la plage de Nakabuang, île de Sabtang">
            <source src={asset('nakabuang-beach.webm')} type="video/webm" />
            Votre navigateur ne prend pas en charge cette vidéo.
          </video>
          <figcaption>Nakabuang Beach · Batanes, Philippines</figcaption>
        </figure>
      </section>
      <div className="chapter-share page-width"><p>Un petit bout de ce jour,<br /><em>à emporter avec soi.</em></p><button className="button" onClick={share}>Préparer un partage <Icon name="share" /></button><span className="local-note">Brouillon consultable · aucune publication automatique</span></div>
    </> : <div className="prose standalone-prose">{day.day === 1 ? <><p className="lead drop-cap">Manille nous a accueillis dans un grand mouvement. Le trajet depuis l’aéroport ressemblait déjà à une première visite : les façades, les enseignes, les jeepneys que l’on regardait passer sans encore comprendre leurs itinéraires.</p><p>Nous avons posé les sacs et marché sans ambition particulière. Après le voyage, il suffisait d’un repas chaud et d’une rue inconnue pour nous sentir ailleurs. En fin de journée, la baie a changé de couleur. Le ciel rose a fait taire un instant le bruit de la ville.</p><blockquote>Le voyage commence parfois simplement : on lève les yeux, et l’on est ailleurs.</blockquote><p>Demain, nous prendrons le temps de trouver nos repères. Ce soir, nous gardons ce premier ciel, la fatigue heureuse et la curiosité intacte.</p></> : <><p className="lead">Pour l’instant, Bohol est une promesse : des collines à perte de vue et un autre rythme après les journées en mer.</p><p>Nous aimerions découvrir les Chocolate Hills et nous laisser du temps sur la route. Rien n’est encore raconté ici : cette page accueillera nos photos et nos souvenirs lorsque nous y serons.</p><span className="status upcoming"><i />Le chapitre reste à écrire</span></>}</div>}
    <nav className="chapter-navigation page-width" aria-label="Jours voisins">{day.day !== 1 ? <button onClick={() => openDay(day.day === 3 ? 1 : 3)}><span><Icon name="left" /> Jour précédent</span><strong>{day.day === 3 ? '01 — Manille' : '03 — El Nido'}</strong></button> : <button onClick={home}><span><Icon name="left" /> Retour au voyage</span><strong>Le carnet des Philippines</strong></button>}{day.day !== 8 ? <button onClick={() => openDay(day.day === 1 ? 3 : 8)}><span>Jour suivant <Icon name="arrow" /></span><strong>{day.day === 1 ? '03 — El Nido' : '08 — Bohol'}</strong></button> : <button onClick={home}><span>Retour au voyage <Icon name="arrow" /></span><strong>Toutes les étapes</strong></button>}</nav>
  </article>
}
