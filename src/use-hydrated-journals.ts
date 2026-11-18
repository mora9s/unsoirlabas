import { useEffect, useState } from 'react'
import { hydrateJournals } from './media-store'
import { readJournals } from './trip-journals'

/** All consumers receive decoded media, never persisted IndexedDB reference URLs. */
export function useHydratedJournals() {
  const [stored, setStored] = useState<ReturnType<typeof readJournals>>({ data: { version: 1, journals: [] }, error: '' })
  useEffect(() => {
    let active = true, generation = 0
    const refresh = () => {
      const current = ++generation, raw = readJournals()
      if (raw.error) { setStored(raw); return }
      void hydrateJournals(raw.data).then(data => { if (active && generation === current) setStored({ data, error: '' }) })
        .catch(error => { if (active && generation === current) setStored({ data: { version: 1, journals: [] }, error: error instanceof Error ? error.message : 'Photo indisponible.' }) })
    }
    refresh()
    window.addEventListener('storage', refresh); window.addEventListener('trip-journals-updated', refresh); window.addEventListener('upcoming-trips-updated', refresh)
    return () => { active = false; window.removeEventListener('storage', refresh); window.removeEventListener('trip-journals-updated', refresh); window.removeEventListener('upcoming-trips-updated', refresh) }
  }, [])
  return stored
}
