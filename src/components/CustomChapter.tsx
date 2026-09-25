import { coverOf } from '../journal'
import type { Draft } from '../journal'
import Icon from './Icon'

type Props = { draft: Draft; home: () => void; edit: () => void; share: () => void }

export default function CustomChapter({ draft, home, edit, share }: Props) {
  const cover = coverOf(draft)
  const album = draft.media.filter(item => item.id !== cover?.id)

  return <article className="chapter custom-chapter" data-testid="custom-chapter">
    <div className="chapter-toolbar page-width">
      <button className="text-button" onClick={home}><Icon name="left" />Retour au carnet</button>
      <span className="status draft"><i />Brouillon personnel</span>
    </div>
    <header className="chapter-heading page-width">
      <p className="eyebrow">Les mots que l’on garde</p>
      <h1>{draft.title}</h1>
      <div className="personal-metadata">
        <span>Enregistré sur cet appareil</span>
        <span>Ton choisi : {draft.tone}</span>
        <span>{draft.media.length} photo{draft.media.length > 1 ? 's' : ''}</span>
      </div>
      <div className="personal-actions">
        <button className="button button-outline" onClick={edit}>Modifier cette journée<Icon name="book" /></button>
        <button className="button" onClick={share}>Préparer le partage<Icon name="share" /></button>
      </div>
    </header>
    {cover ? <figure className="chapter-cover">
      <img src={cover.src} alt={`Couverture : ${cover.name}`} />
      <figcaption>{cover.name.includes('| Crédit : ') ? 'Photographie documentaire · crédits dans le récit' : 'Votre photo de couverture'}<span>CARNET PERSONNEL</span></figcaption>
    </figure> : <div className="chapter-cover cover-without-photo" aria-label="Chapitre sans photo de couverture">
      <span className="tiny-sun" aria-hidden="true" /><p>Il reste les mots.</p><span className="eyebrow">Une page à soi</span>
    </div>}
    <div className="prose standalone-prose">
      {draft.story.split(/\n\s*\n|\n/).filter(paragraph => paragraph.trim()).map((paragraph, index) => <p className={index === 0 ? 'lead' : undefined} key={index}>{paragraph}</p>)}
    </div>
    {album.length > 0 && <section className="album page-width" aria-labelledby="personal-album-title">
      <div className="section-heading"><div><p className="eyebrow">Les autres instants</p><h2 id="personal-album-title">L’album de cette journée.</h2></div></div>
      <div className="photo-mosaic">{album.map((photo, index) => <figure className={`photo-${index % 6 + 1}`} key={photo.id}>
        <img src={photo.src} alt={`Souvenir : ${photo.name}`} loading="lazy" />
        <figcaption>{photo.name}</figcaption>
      </figure>)}</div>
    </section>}
    <div className="chapter-share page-width"><p>Ce jour est le vôtre.<br /><em>Gardez-en une trace.</em></p><button className="text-button" onClick={home}>Revenir aux pages du carnet<Icon name="arrow" /></button><span className="local-note">Aucune publication. Ce chapitre reste dans ce navigateur.</span></div>
  </article>
}
