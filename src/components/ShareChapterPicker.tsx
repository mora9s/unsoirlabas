import Icon from './Icon'

export type ShareChoice = { key: string; title: string; source: string; image?: string; open: () => void }

export default function ShareChapterPicker({ choices, demo }: { choices: ShareChoice[]; demo: () => void }) {
  return <section className="share-chapter-picker page-width" data-testid="share-chapter-picker">
    <header className="workspace-heading">
      <p className="eyebrow">Le studio de partage</p>
      <h1>Quel chapitre partager ?</h1>
      <p>Choisissez une page enregistrée, quel que soit le voyage. Vos mots et vos images restent liés à ce chapitre.</p>
    </header>
    <div className="share-choice-list">
      {choices.map(choice => <button className="share-choice" key={choice.key} onClick={choice.open}>
        {choice.image ? <img src={choice.image} alt="" /> : <span className="share-choice-placeholder" aria-hidden="true">✳</span>}
        <span><small>{choice.source}</small><strong>{choice.title}</strong></span><Icon name="arrow" />
      </button>)}
      <button className="share-choice share-demo-choice" onClick={demo}>
        <span className="share-choice-placeholder" aria-hidden="true">✳</span>
        <span><small>Démo · Philippines · Jour 03</small><strong>Le bonheur à fleur d’eau</strong></span><Icon name="arrow" />
      </button>
      {!choices.length && <p className="share-picker-empty">Aucun chapitre personnel enregistré pour le moment.</p>}
    </div>
  </section>
}
