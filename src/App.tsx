import { useEffect, useRef, useState } from 'react'
import Home from './components/Home'
import Chapter from './components/Chapter'
import Creator from './components/Creator'
import ShareStudio from './components/ShareStudio'
import Icon from './components/Icon'
import { readTrip } from './journal'
import type { Draft } from './journal'
import './journal.css'

type View = 'home' | 'create' | 'share' | 'day-1' | 'day-3' | 'day-8'
function currentView(): View {
  const hash = window.location.hash.slice(1).split('/')[0]
  return ['create', 'share', 'day-1', 'day-3', 'day-8'].includes(hash) ? hash as View : 'home'
}

export default function App() {
  const [view, setView] = useState<View>(currentView)
  const [stored, setStored] = useState(readTrip)
  const [editing, setEditing] = useState<Draft>()
  const [newDraftNumber, setNewDraftNumber] = useState(0)
  const [creatorOpened, setCreatorOpened] = useState(view === 'create')
  const mainRef = useRef<HTMLElement>(null)
  const lastView = useRef(view)

  useEffect(() => {
    const updateView = () => {
      const hash = window.location.hash.slice(1).split('/')[0]
      if (hash && !['carnet', 'create', 'share', 'day-1', 'day-3', 'day-8'].includes(hash)) return
      const next = currentView()
      setView(next)
      if (next === 'create') setCreatorOpened(true)
    }
    const updateStorage = () => setStored(readTrip())
    window.addEventListener('popstate', updateView)
    window.addEventListener('hashchange', updateView)
    window.addEventListener('storage', updateStorage)
    return () => {
      window.removeEventListener('popstate', updateView)
      window.removeEventListener('hashchange', updateView)
      window.removeEventListener('storage', updateStorage)
    }
  }, [])

  useEffect(() => {
    const title = view === 'home' ? 'Philippines — 18 jours entre îles et lumière' : view === 'create' ? 'Créer une journée' : view === 'share' ? 'Studio de partage' : `Jour ${view.slice(4)} — Philippines`
    document.title = `${title} · Les jours au large`
    if (lastView.current !== view) {
      mainRef.current?.focus({ preventScroll: true })
      const anchor = document.getElementById(window.location.hash.slice(1))
      if (anchor) anchor.scrollIntoView({ behavior: 'instant' })
      else window.scrollTo({ top: 0, behavior: 'instant' })
      lastView.current = view
    }
  }, [view])

  function navigate(next: View) {
    window.history.pushState(null, '', next === 'home' ? '#carnet' : `#${next}`)
    setView(next)
    if (next === 'create') setCreatorOpened(true)
    if (next === view) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  function openDay(day: number) { navigate(`day-${day}` as View) }
  function newDay() {
    setEditing(undefined)
    setNewDraftNumber(previous => previous + 1)
    navigate('create')
  }

  return <>
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="site-header">
      <button className="wordmark" onClick={() => navigate('home')} aria-label="Les jours au large — accueil">
        <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
        <span>les jours <em>au large</em><small>LES VOYAGES PASSENT. LES HISTOIRES RESTENT.</small></span>
      </button>
      <nav aria-label="Navigation principale">
        <button
          className={view === 'home' || view.startsWith('day') ? 'active' : ''}
          aria-current={view === 'home' || view.startsWith('day') ? 'page' : undefined}
          onClick={() => navigate('home')}
        ><Icon name="book" /><span>Le carnet</span></button>
        <button
          className={view === 'create' ? 'active' : ''}
          aria-current={view === 'create' ? 'page' : undefined}
          onClick={() => navigate('create')}
        ><Icon name="plus" /><span>Créer</span></button>
        <button
          className={`share-nav ${view === 'share' ? 'active' : ''}`}
          aria-current={view === 'share' ? 'page' : undefined}
          onClick={() => navigate('share')}
        ><Icon name="share" /><span>Partager</span></button>
      </nav>
    </header>
    <main id="main" ref={mainRef} tabIndex={-1}>
      {stored.error && <p role="alert" className="error-message page-width">{stored.error}</p>}
      {view === 'home' && (
        <Home
          openDay={openDay}
          create={newDay}
          drafts={stored.trip.drafts}
          openDraft={draft => { setEditing(draft); navigate('create') }}
        />
      )}
      {view.startsWith('day') && (
        <Chapter
          dayNumber={Number(view.slice(4))}
          openDay={openDay}
          home={() => navigate('home')}
          share={() => navigate('share')}
        />
      )}
      {creatorOpened && (
        <div hidden={view !== 'create'}>
          <Creator
            key={editing?.id ?? `new-${newDraftNumber}`}
            initialDraft={editing}
            onSave={trip => setStored({ trip, error: '' })}
          />
        </div>
      )}
      {view === 'share' && <ShareStudio />}
    </main>
    <footer className="site-footer page-width">
      <div className="footer-brand">
        les jours <em>au large</em><p>Des îles, des histoires, et nous au milieu.</p>
      </div>
      <div>
        <span>Philippines — le journal vivant</span>
        <small>Prototype local · rien n’est publié en ligne<br />Photographies et vidéo : fonds Wikimedia fourni.</small>
      </div>
      <button
        className="text-button"
        onClick={() => window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        })}
      >Tout là-haut ↑</button>
    </footer>
  </>
}
