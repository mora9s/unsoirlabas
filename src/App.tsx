import { useEffect, useRef, useState } from 'react'
import Home from './components/Home'
import Chapter from './components/Chapter'
import CustomChapter from './components/CustomChapter'
import Creator from './components/Creator'
import ShareStudio from './components/ShareStudio'
import TripPlanner from './components/TripPlanner'
import Icon from './components/Icon'
import { readTrip } from './journal'
import type { Draft } from './journal'
import './journal.css'

type View = 'home' | 'create' | 'share' | 'day-1' | 'day-3' | 'day-8' | 'missing' | `draft/${string}` | `share/${string}` | `trip/${string}`
function currentView(): View {
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('draft/') || hash.startsWith('share/') || hash.startsWith('trip/')) return hash as View
  const base = hash.split('/')[0]
  if (['create', 'share', 'day-1', 'day-3', 'day-8'].includes(base)) return base as View
  return ['', 'carnet', 'main'].includes(hash) ? 'home' : 'missing'
}

function draftId(view: View): string | undefined {
  const parts = view.split('/')
  if (parts.length !== 2 || !parts[1]) return undefined
  try { return decodeURIComponent(parts[1]) } catch { return undefined }
}

export default function App() {
  const [view, setView] = useState<View>(currentView)
  const [stored, setStored] = useState(readTrip)
  const [editing, setEditing] = useState<Draft>()
  const [newDraftNumber, setNewDraftNumber] = useState(0)
  const [creatorOpened, setCreatorOpened] = useState(view === 'create')
  const [savedId, setSavedId] = useState<string>()
  const personalRoute = view.startsWith('draft/') || view.startsWith('share/')
  const draft = personalRoute ? stored.trip.drafts.find(item => item.id === draftId(view)) : undefined
  const missing = view === 'missing' || (personalRoute && !draft)
  const sharing = view === 'share' || view.startsWith('share/')
  const mainRef = useRef<HTMLElement>(null)
  const lastView = useRef(view)

  useEffect(() => {
    const updateView = () => {
      if (window.location.hash === '#main') return
      const next = currentView()
      setView(next)
      setSavedId(undefined)
      setStored(readTrip())
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
    const title = missing ? 'Cette page est introuvable' : view.startsWith('trip/') ? 'Planifier un voyage' : draft ? `${sharing ? 'Partager — ' : ''}${draft.title}` : view === 'home' ? 'Philippines — 18 jours entre îles et lumière' : view === 'create' ? 'Créer une journée' : sharing ? 'Studio de partage' : `Jour ${view.slice(4)} — Philippines`
    document.title = `${title} · Un soir là-bas`
    if (lastView.current !== view) {
      mainRef.current?.focus({ preventScroll: true })
      const anchor = document.getElementById(window.location.hash.slice(1))
      if (anchor) anchor.scrollIntoView({ behavior: 'instant' })
      else window.scrollTo({ top: 0, behavior: 'instant' })
      lastView.current = view
    }
  }, [view, draft, missing, sharing])

  function navigate(next: View) {
    setSavedId(undefined)
    window.history.pushState(null, '', next === 'home' ? '#carnet' : `#${next}`)
    setView(next)
    if (next === 'create') setCreatorOpened(true)
    if (next === view) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  function openDay(day: number) { navigate(`day-${day}` as View) }
  function editDraft(item: Draft) {
    setEditing(item)
    navigate('create')
  }
  function newDay() {
    setEditing(undefined)
    setNewDraftNumber(previous => previous + 1)
    navigate('create')
  }

  return <>
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="site-header">
      <button className="wordmark" onClick={() => navigate('home')} aria-label="Un soir là-bas — accueil">
        <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
        <span>un soir <em>là-bas</em><small>RACONTÉ SUR PLACE. PARTAGÉ EN DIX MINUTES.</small></span>
      </button>
      <nav aria-label="Navigation principale">
        <button
          className={view === 'home' || view.startsWith('day') || view.startsWith('draft/') ? 'active' : ''}
          aria-current={view === 'home' || view.startsWith('day') || view.startsWith('draft/') ? 'page' : undefined}
          onClick={() => navigate('home')}
        ><Icon name="book" /><span>Le carnet</span></button>
        <button
          className={view === 'create' ? 'active' : ''}
          aria-current={view === 'create' ? 'page' : undefined}
          onClick={newDay}
        ><Icon name="plus" /><span>Créer</span></button>
        <button
          className={`share-nav ${sharing ? 'active' : ''}`}
          aria-current={sharing ? 'page' : undefined}
          onClick={() => navigate(draft ? `share/${encodeURIComponent(draft.id)}` : 'share')}
        ><Icon name="share" /><span>Partager</span></button>
      </nav>
    </header>
    <main id="main" ref={mainRef} tabIndex={-1}>
      {stored.error && <p role="alert" className="error-message page-width">{stored.error}</p>}
      {view === 'home' && (
        <Home
          openDay={openDay}
          openTrip={id => navigate(`trip/${encodeURIComponent(id)}`)}
          create={newDay}
          drafts={stored.trip.drafts}
          openDraft={draft => navigate(`draft/${encodeURIComponent(draft.id)}`)}
          editDraft={editDraft}
          trip={stored.trip}
          onRestore={trip => {
            setStored({ trip, error: '' })
            navigate('home')
          }}
        />
      )}
      {view.startsWith('trip/') && <TripPlanner key={view} id={draftId(view) ?? ''} back={() => navigate('home')} />}
      {view.startsWith('day') && (
        <Chapter
          dayNumber={Number(view.slice(4))}
          openDay={openDay}
          home={() => navigate('home')}
          share={() => navigate('share')}
        />
      )}
      {missing && <section className="workspace-heading page-width recovery-page">
        <p className="eyebrow">Le carnet personnel</p><h1>Cette page est introuvable</h1>
        <p>Ce chapitre n’est pas disponible dans ce navigateur. Les journées personnelles restent sur l’appareil où elles ont été enregistrées.</p>
        <button className="button" onClick={() => navigate('home')}>Retour au carnet<Icon name="left" /></button>
      </section>}
      {view.startsWith('draft/') && draft && <>
        {/* Keep the creation receipt accessible after leaving the editor. */}
        {savedId === draft.id && <div className="page-width" data-testid="creator"><p role="status" aria-live="polite" className="success-message">Votre journée a été ajoutée au voyage. Le brouillon est enregistré sur cet appareil, jamais publié.</p></div>}
        <CustomChapter draft={draft} home={() => navigate('home')} edit={() => editDraft(draft)} share={() => navigate(`share/${encodeURIComponent(draft.id)}`)} />
      </>}
      {creatorOpened && (
        <div hidden={view !== 'create'}>
          <Creator
            key={editing?.id ?? `new-${newDraftNumber}`}
            initialDraft={editing}
            onSave={(trip, saved) => {
              setStored({ trip, error: '' })
              setEditing(saved)
              setCreatorOpened(false)
              navigate(`draft/${encodeURIComponent(saved.id)}`)
              setSavedId(saved.id)
            }}
          />
        </div>
      )}
      {sharing && !missing && <ShareStudio key={draft?.id ?? 'el-nido'} draft={draft} />}
    </main>
    <footer className="site-footer page-width">
      <div className="footer-brand">
        les jours <em>au large</em><p>Des îles, des histoires, et nous au milieu.</p>
      </div>
      <div>
        <span>Philippines — le journal vivant</span>
        <small>Prototype local · rien n’est publié en ligne<br />Chapitres de démonstration : fonds Wikimedia fourni.<br />Journées personnelles : vos photos et vos mots.</small>
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
