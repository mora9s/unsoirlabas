import { useEffect, useRef, useState } from 'react'
import Home from './components/Home'
import Demo from './components/Demo'
import Chapter from './components/Chapter'
import CustomChapter from './components/CustomChapter'
import Creator from './components/Creator'
import ShareStudio from './components/ShareStudio'
import ChapterShareStudio from './components/ChapterShareStudio'
import Icon from './components/Icon'
import { readTrip } from './journal'
import { readJournals, journalForTrip, saveChapter, upcomingForJournal } from './trip-journals'
import { hydrateJournals, hydrateTrip, prepareMediaStorage, releaseHydratedMedia } from './media-store'
import type { PersonalJournal } from './trip-journals'
import TripJournal from './components/TripJournal'
import ShareChapterPicker from './components/ShareChapterPicker'
import Backup from './components/Backup'
import TripPlanner from './components/TripPlanner'
import type { ShareChoice } from './components/ShareChapterPicker'
import type { Draft, PlannedStepLink } from './journal'
import './journal.css'

type View = string
function currentView(): View {
  const hash = window.location.hash.slice(1)
  if (/^(draft|share|share-trip|trip|plan|journey|journal-share|trip-create)\//.test(hash)) return hash
  const base = hash.split('/')[0]
  if (['create', 'share', 'share-demo', 'demo', 'tools', 'day-1', 'day-3', 'day-8'].includes(base)) return base
  return ['', 'carnet', 'main'].includes(hash) ? 'home' : 'missing'
}

function initialMediaReady() {
  try { return ![localStorage.getItem('philippines-trip'), localStorage.getItem('un-soir-la-bas-journals-v1')].some(value => value?.includes('idb:media:')) }
  catch { return true }
}

function draftId(view: View): string | undefined {
  const parts = view.split('/')
  if (parts.length !== 2 || !parts[1]) return undefined
  try { return decodeURIComponent(parts[1]) } catch { return undefined }
}

function plannedStepLabel(tripId: string, link?: PlannedStepLink): string | undefined {
  if (!link) return undefined
  const stop = link.tripId === tripId ? upcomingForJournal(tripId)?.plan?.stops.find(item => item.id === link.stepId) : undefined
  return stop ? `Étape prévue · ${stop.place}` : `Étape prévue retirée du plan · ${link.place}`
}

export default function App() {
  const [view, setView] = useState<View>(currentView)
  const [stored, setStored] = useState(readTrip)
  const [journals, setJournals] = useState(readJournals)
  const [editing, setEditing] = useState<Draft>()
  const [newDraftNumber, setNewDraftNumber] = useState(0)
  const [creatorOpened, setCreatorOpened] = useState(view === 'create' || view.startsWith('trip-create/'))
  const [savedId, setSavedId] = useState<string>()
  const [mediaReady, setMediaReady] = useState(initialMediaReady)
  const [mediaError, setMediaError] = useState('')
  const personalRoute = view.startsWith('draft/') || view.startsWith('share/')
  const draft = personalRoute ? stored.trip.drafts.find(item => item.id === draftId(view)) : undefined
  const tripParts = view.split('/').map(part => { try { return decodeURIComponent(part) } catch { return '' } })
  const journalTripId = tripParts[1] ?? ''
  const journal = journals.data.journals.find(item => item.tripId === journalTripId) ?? (() => { const upcoming = upcomingForJournal(journalTripId); return upcoming ? journalForTrip(journals.data, upcoming) : undefined })()
  const journalChapterId = tripParts[2]
  const journalChapter = journal?.chapters.find(item => item.id === journalChapterId)
  const tripCreating = view.startsWith('trip-create/')
  const plannedRoute = tripCreating && tripParts[2] === 'planned'
  const tripCreatePlanLink: PlannedStepLink | undefined = plannedRoute && tripParts[3] && tripParts[4] ? { tripId: journalTripId, stepId: tripParts[3], place: tripParts[4] } : undefined
  const tripCreateContext = tripCreating ? (journal ? { id: journal.tripId, destination: journal.destination, departure: journal.departure } : (() => { const upcoming = upcomingForJournal(journalTripId); return upcoming ? { id: upcoming.id, destination: upcoming.destination, departure: upcoming.departure } : undefined })()) : undefined
  const tripEditDraft = tripCreating && !plannedRoute && journalChapterId ? journal?.chapters.find(item => item.id === journalChapterId) : undefined
  const journalRoute = view.startsWith('trip/') || view.startsWith('journey/') || view.startsWith('journal-share/')
  const journalSharing = view.startsWith('journal-share/')
  const tripSharing = view.startsWith('share-trip/')
  const shareTripId = tripSharing ? tripParts[1] : ''
  const shareChapterId = tripSharing ? tripParts[2] : ''
  const shareJournal = tripSharing ? journals.data.journals.find(item => item.tripId === shareTripId) : undefined
  const shareDraft = shareJournal?.chapters.find(item => item.id === shareChapterId)
  const missing = view === 'missing' || (personalRoute && !draft) || (tripSharing && !shareDraft) || (tripCreating && (!tripCreateContext || (Boolean(journalChapterId) && !tripEditDraft))) || (journalRoute && (!journal || (tripParts[0] !== 'trip' && !journalChapter)))
  const sharing = view === 'share' || view === 'share-demo' || view.startsWith('share/') || tripSharing || journalSharing
  const shareChoices: ShareChoice[] = [
    ...stored.trip.drafts.filter(item => !journals.data.journals.some(journalItem => journalItem.chapters.some(chapter => chapter.id === item.id))).map(item => ({ key: `legacy:${item.id}`, title: item.title, source: 'Philippines · carnet personnel', image: item.media.find(media => media.id === item.coverId)?.src ?? item.media[0]?.src, open: () => navigate(`share/${encodeURIComponent(item.id)}`) })),
    ...journals.data.journals.flatMap(journalItem => journalItem.chapters.map(chapter => ({ key: `${journalItem.tripId}:${chapter.id}`, title: chapter.title, source: `${journalItem.destination} · carnet personnel`, image: chapter.media.find(media => media.id === chapter.coverId)?.src ?? chapter.media[0]?.src, open: () => navigate(`share-trip/${encodeURIComponent(journalItem.tripId)}/${encodeURIComponent(chapter.id)}`) }))),
  ]
  const mainRef = useRef<HTMLElement>(null)
  const lastView = useRef(view)

  async function refreshStorage() {
    const migrationError = await prepareMediaStorage()
    const nextTrip = readTrip()
    const nextJournals = readJournals()
    try {
      setStored({ trip: await hydrateTrip(nextTrip.trip), error: nextTrip.error })
      setJournals({ data: await hydrateJournals(nextJournals.data), error: nextJournals.error })
      setMediaError(migrationError)
    } catch (error) {
      setStored(nextTrip)
      setJournals(nextJournals)
      setMediaError(error instanceof Error ? error.message : migrationError)
    } finally { setMediaReady(true) }
  }

  useEffect(() => {
    const updateView = () => {
      if (window.location.hash === '#main') return
      const next = currentView()
      setView(next)
      setSavedId(undefined)
      void refreshStorage()
      if (next === 'create' || next.startsWith('trip-create/')) setCreatorOpened(true)
    }
    const updateStorage = () => { void refreshStorage() }
    window.addEventListener('upcoming-trips-updated', updateStorage)
    window.addEventListener('trip-journals-updated', updateStorage)
    window.addEventListener('popstate', updateView)
    window.addEventListener('hashchange', updateView)
    window.addEventListener('storage', updateStorage)
    const bootstrap = window.setTimeout(() => { void refreshStorage() }, 0)
    return () => {
      window.clearTimeout(bootstrap)
      releaseHydratedMedia()
      window.removeEventListener('trip-journals-updated', updateStorage)
      window.removeEventListener('upcoming-trips-updated', updateStorage)
      window.removeEventListener('popstate', updateView)
      window.removeEventListener('hashchange', updateView)
      window.removeEventListener('storage', updateStorage)
    }
  }, [])

  useEffect(() => {
    const title = missing ? 'Cette page est introuvable' : draft ? `${sharing ? 'Partager — ' : ''}${draft.title}` : view === 'home' ? 'La bibliothèque des voyages' : view === 'demo' ? 'Démonstration Philippines' : view === 'tools' ? 'Outils du carnet' : view === 'create' ? 'Créer une journée' : sharing ? 'Studio de partage' : `Jour ${view.slice(4)} — Philippines`
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
    if (next === 'create' || next.startsWith('trip-create/')) setCreatorOpened(true)
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
  function openUpcomingJournal(trip: { id: string; destination: string; departure: string }) {
    navigate(`trip/${encodeURIComponent(trip.id)}`)
  }
  function createTripChapter(item: PersonalJournal) {
    setEditing(undefined)
    setNewDraftNumber(previous => previous + 1)
    navigate(`trip-create/${encodeURIComponent(item.tripId)}`)
  }
  function editTripChapter(item: PersonalJournal, chapter: Draft) {
    setEditing(chapter)
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
        <button className={view === 'home' ? 'active' : ''} aria-current={view === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><Icon name="book" /><span>Le carnet</span></button>
        {view !== 'home' && <button className={view === 'create' ? 'active' : ''} aria-label="Créer une journée" aria-current={view === 'create' ? 'page' : undefined} onClick={newDay}><Icon name="plus" /><span>Créer</span></button>}
        <button className={`share-nav ${sharing ? 'active' : ''}`} aria-current={sharing ? 'page' : undefined} onClick={() => navigate('share')}><Icon name="share" /><span>Partager</span></button>
      </nav>
    </header>
    <main id="main" ref={mainRef} tabIndex={-1}>
      {!mediaReady ? <p role="status" className="page-width">Ouverture de vos médias locaux…</p> : <>
      {(stored.error || mediaError) && <p role="alert" className="error-message page-width">{stored.error || mediaError}</p>}
      {view === 'home' && (
        <Home
          openDay={day => day === 0 ? navigate('demo') : openDay(day)}
          openTools={() => navigate('tools')}
          create={newDay}
          drafts={stored.trip.drafts}
          openDraft={draft => navigate(`draft/${encodeURIComponent(draft.id)}`)}
          editDraft={editDraft}
          onOpenJournal={openUpcomingJournal}
          openPlanner={id => navigate(`plan/${encodeURIComponent(id)}`)}
          journals={journals.data.journals}
        />
      )}
      {view === 'demo' && <Demo openDay={openDay} />}
      {view === 'tools' && <section className="tools-page page-width" aria-labelledby="tools-title"><p className="eyebrow">Réglages et conservation</p><h1 id="tools-title">Outils du carnet</h1><Backup trip={stored.trip} onRestore={() => { void refreshStorage() }} /></section>}
      {view.startsWith('plan/') && <TripPlanner key={view} id={draftId(view) ?? ''} back={() => navigate('home')} openJournal={() => navigate(`trip/${encodeURIComponent(journalTripId)}`)} openPlannedStep={stop => { setEditing(undefined); navigate(`trip-create/${encodeURIComponent(journalTripId)}/planned/${encodeURIComponent(stop.id)}/${encodeURIComponent(stop.place)}`) }} />}
      {view.startsWith('day') && (
        <Chapter
          dayNumber={Number(view.slice(4))}
          openDay={openDay}
          home={() => navigate('home')}
          share={() => navigate('share')}
        />
      )}
      {view.startsWith('trip/') && journal && <TripJournal journal={journal} open={chapter => navigate(`journey/${encodeURIComponent(journal.tripId)}/${encodeURIComponent(chapter.id)}`)} create={() => createTripChapter(journal)} edit={chapter => editTripChapter(journal, chapter)} />}
      {view.startsWith('journey/') && journal && journalChapter && <CustomChapter draft={journalChapter} plannedStepLabel={plannedStepLabel(journal.tripId, journalChapter.plannedStep)} home={() => navigate(`trip/${encodeURIComponent(journal.tripId)}`)} edit={() => editTripChapter(journal, journalChapter)} share={() => navigate(`journal-share/${encodeURIComponent(journal.tripId)}/${encodeURIComponent(journalChapter.id)}`)} />}
      {tripCreating && tripCreateContext && <Creator localStore={false} firstChapter={Boolean(!tripEditDraft && journal?.chapters.length === 0)} personalDestination={tripCreateContext.destination} plannedStep={tripEditDraft?.plannedStep ?? tripCreatePlanLink} recoveryScope={`trip:${tripCreateContext.id}:${tripEditDraft?.id ?? (tripCreatePlanLink ? `planned:${tripCreatePlanLink.stepId}` : 'new')}`} key={tripEditDraft?.id ?? `trip-${tripCreateContext.id}-${tripCreatePlanLink?.stepId ?? newDraftNumber}`} initialDraft={tripEditDraft ?? (plannedRoute ? undefined : editing)} onSave={async (_trip, saved) => {
        await saveChapter(tripCreateContext.id, tripCreateContext.destination, tripCreateContext.departure, saved)
        await refreshStorage()
        setEditing(saved)
        navigate(`journey/${encodeURIComponent(tripCreateContext.id)}/${encodeURIComponent(saved.id)}`)
      }} />}
      {journalSharing && journalChapter && <ChapterShareStudio key={`trip-${journalTripId}-${journalChapter.id}`} draft={journalChapter} destination={journal?.destination ?? ''} departure={journal?.departure ?? ''} returnHref={`#journey/${encodeURIComponent(journalTripId)}/${encodeURIComponent(journalChapter.id)}`} />}
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
      {creatorOpened && view === 'create' && (
        <div>
          <Creator
            key={editing?.id ?? `new-${newDraftNumber}`}
            recoveryScope={editing ? `personal:chapter:${editing.id}` : 'personal:new'}
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
      {sharing && !journalSharing && !missing && view === 'share' && <ShareChapterPicker choices={shareChoices} demo={() => navigate('share-demo')} />}
      {view === 'share-demo' && <ShareStudio key="el-nido" />}
      {sharing && !journalSharing && !missing && view.startsWith('share/') && draft && <ShareStudio key={draft.id} draft={draft} />}
      {tripSharing && shareDraft && <ChapterShareStudio key={`trip-${shareTripId}-${shareDraft.id}`} draft={shareDraft} destination={shareJournal?.destination ?? ''} departure={shareJournal?.departure ?? ''} returnHref={`#journey/${encodeURIComponent(shareTripId)}/${encodeURIComponent(shareDraft.id)}`} />}
      </>}
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
