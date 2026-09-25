import { useEffect, useRef, useState } from 'react'
import Home from './components/Home'
import Chapter from './components/Chapter'
import CustomChapter from './components/CustomChapter'
import Creator from './components/Creator'
import ShareStudio from './components/ShareStudio'
import TripPlanner from './components/TripPlanner'
import TripJournal from './components/TripJournal'
import Icon from './components/Icon'
import { readTrip } from './journal'
import { readJournals, journalForTrip, saveChapter } from './trip-journals'
import type { PersonalJournal } from './trip-journals'
import { readUpcoming } from './upcoming-trips'
import type { Draft } from './journal'
import './journal.css'

type View = 'home' | 'create' | 'share' | 'day-1' | 'day-3' | 'day-8' | 'missing' | `draft/${string}` | `share/${string}` | `trip/${string}` | `journal/${string}` | `journey/${string}` | `trip-create/${string}` | `journal-share/${string}`
function currentView(): View {
  const hash = window.location.hash.slice(1)
  if (/^(draft|share|trip|journal|journey|trip-create|journal-share)\//.test(hash)) return hash as View
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
  const [journals, setJournals] = useState(readJournals)
  const [editing, setEditing] = useState<Draft>()
  const [newDraftNumber, setNewDraftNumber] = useState(0)
  const [creatorOpened, setCreatorOpened] = useState(view === 'create')
  const [savedId, setSavedId] = useState<string>()
  const personalRoute = view.startsWith('draft/') || view.startsWith('share/')
  const draft = personalRoute ? stored.trip.drafts.find(item => item.id === draftId(view)) : undefined
  const parts = view.split('/').map(part => { try { return decodeURIComponent(part) } catch { return '' } })
  const journalId = parts[1] ?? ''
  const upcomingTrips = readUpcoming().trips
  const upcoming = upcomingTrips.find(item => item.id === journalId)
  const storedJournal = journals.data.journals.find(item => item.tripId === journalId)
  const journal = storedJournal ? (upcoming ? { ...storedJournal, destination: upcoming.destination, departure: upcoming.departure } : storedJournal) : (upcoming ? journalForTrip(journals.data, upcoming) : undefined)
  const journalChapter = journal?.chapters.find(item => item.id === parts[2])
  const journalTitle = journal?.destination
  const chapterTitle = journalChapter?.title
  const shareChapter = journalChapter ?? journal?.chapters.at(-1)
  const tripEditor = view.startsWith('trip-create/')
  const journalShare = view.startsWith('journal-share/')
  const missing = view === 'missing' || (personalRoute && !draft) || ((view.startsWith('journal/') || tripEditor) && !journal) || ((view.startsWith('journey/') || journalShare || (tripEditor && parts.length > 2)) && !journalChapter)
  const sharing = view === 'share' || view.startsWith('share/') || journalShare
  const mainRef = useRef<HTMLElement>(null)
  const lastView = useRef(view)

  useEffect(() => {
    const updateView = () => {
      if (window.location.hash === '#main') return
      const next = currentView()
      setView(next)
      setSavedId(undefined)
      setStored(readTrip())
      setJournals(readJournals())
      if (next === 'create') setCreatorOpened(true)
    }
    const updateStorage = () => { setStored(readTrip()); setJournals(readJournals()) }
    window.addEventListener('upcoming-trips-updated', updateStorage)
    window.addEventListener('popstate', updateView)
    window.addEventListener('hashchange', updateView)
    window.addEventListener('storage', updateStorage)
    return () => {
      window.removeEventListener('upcoming-trips-updated', updateStorage)
      window.removeEventListener('popstate', updateView)
      window.removeEventListener('hashchange', updateView)
      window.removeEventListener('storage', updateStorage)
    }
  }, [])

  useEffect(() => {
    const title = missing ? 'Cette page est introuvable' : chapterTitle ? `${sharing ? 'Partager — ' : ''}${chapterTitle}` : journalTitle ? `Carnet — ${journalTitle}` : view.startsWith('trip/') ? 'Planifier un voyage' : draft ? `${sharing ? 'Partager — ' : ''}${draft.title}` : view === 'home' ? 'Philippines — 18 jours entre îles et lumière' : view === 'create' ? 'Créer une journée' : sharing ? 'Studio de partage' : `Jour ${view.slice(4)} — Philippines`
    document.title = `${title} · Un soir là-bas`
    if (lastView.current !== view) {
      mainRef.current?.focus({ preventScroll: true })
      const anchor = document.getElementById(window.location.hash.slice(1))
      if (anchor) anchor.scrollIntoView({ behavior: 'instant' })
      else window.scrollTo({ top: 0, behavior: 'instant' })
      lastView.current = view
    }
  }, [view, draft, journalTitle, chapterTitle, missing, sharing])

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
  function createTripChapter(item: PersonalJournal) {
    navigate(`trip-create/${encodeURIComponent(item.tripId)}`)
  }
  function editTripChapter(item: PersonalJournal, chapter: Draft) {
    navigate(`trip-create/${encodeURIComponent(item.tripId)}/${encodeURIComponent(chapter.id)}`)
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
          className={view === 'create' || tripEditor ? 'active' : ''}
          aria-current={view === 'create' || tripEditor ? 'page' : undefined}
          onClick={() => journal ? createTripChapter(journal) : newDay()}
        ><Icon name="plus" /><span>Créer</span></button>
        <button
          className={`share-nav ${sharing ? 'active' : ''}`}
          aria-current={sharing ? 'page' : undefined}
          onClick={() => navigate(journal && shareChapter ? `journal-share/${encodeURIComponent(journal.tripId)}/${encodeURIComponent(shareChapter.id)}` : draft ? `share/${encodeURIComponent(draft.id)}` : 'share')}
          disabled={!!journal && !shareChapter}
        ><Icon name="share" /><span>Partager</span></button>
      </nav>
    </header>
    <main id="main" ref={mainRef} tabIndex={-1}>
      {stored.error && <p role="alert" className="error-message page-width">{stored.error}</p>}
      {journals.error && <p role="alert" className="error-message page-width">{journals.error}</p>}
      {view === 'home' && (
        <Home
          openDay={openDay}
          openTrip={id => navigate(`trip/${encodeURIComponent(id)}`)}
          openJournal={id => navigate(`journal/${encodeURIComponent(id)}`)}
          journals={journals.data.journals.map(item => { const trip = upcomingTrips.find(candidate => candidate.id === item.tripId); return trip ? { ...item, destination: trip.destination, departure: trip.departure } : item })}
          create={newDay}
          drafts={stored.trip.drafts}
          openDraft={draft => navigate(`draft/${encodeURIComponent(draft.id)}`)}
          editDraft={editDraft}
          trip={stored.trip}
          onRestore={trip => {
            setStored({ trip, error: '' })
            setJournals(readJournals())
            navigate('home')
          }}
        />
      )}
      {view.startsWith('trip/') && <TripPlanner key={view} id={draftId(view) ?? ''} back={() => navigate('home')} openJournal={() => navigate(`journal/${encodeURIComponent(journalId)}`)} />}
      {view.startsWith('journal/') && journal && <TripJournal journal={journal} back={() => navigate(upcoming ? `trip/${encodeURIComponent(journalId)}` : 'home')} open={chapter => navigate(`journey/${encodeURIComponent(journalId)}/${encodeURIComponent(chapter.id)}`)} create={() => createTripChapter(journal)} edit={chapter => editTripChapter(journal, chapter)} />}
      {view.startsWith('journey/') && journal && journalChapter && <CustomChapter draft={journalChapter} home={() => navigate(`journal/${encodeURIComponent(journalId)}`)} edit={() => editTripChapter(journal, journalChapter)} share={() => navigate(`journal-share/${encodeURIComponent(journalId)}/${encodeURIComponent(journalChapter.id)}`)} />}
      {tripEditor && journal && !missing && <Creator key={view} initialDraft={journalChapter} journalDestination={journal.destination} saveToJournal={chapter => saveChapter(journal.tripId, journal.destination, journal.departure, chapter)} onSave={(_trip, saved) => { setJournals(readJournals()); navigate(`journey/${encodeURIComponent(journalId)}/${encodeURIComponent(saved.id)}`) }} />}
      {journalShare && journalChapter && <ShareStudio key={`journal-${journalId}-${journalChapter.id}`} draft={journalChapter} backHref={`#journey/${encodeURIComponent(journalId)}/${encodeURIComponent(journalChapter.id)}`} />}
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
      {sharing && !journalShare && !missing && <ShareStudio key={draft?.id ?? 'el-nido'} draft={draft} />}
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
