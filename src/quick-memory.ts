import { createId } from './id'
import type { Draft, Media } from './journal'
import { journalsKey, readJournals, validateJournals } from './trip-journals'
import { readUpcoming, upcomingKey, validateUpcomingTrips } from './upcoming-trips'

export function saveQuickMemory(tripId: string, date: string, stopId: string, text: string, media: Media[]): string {
  const upcoming = readUpcoming(), stored = readJournals()
  if (upcoming.error || stored.error) throw new Error(upcoming.error || stored.error)
  const trip = upcoming.trips.find(t => t.id === tripId)
  const stop = trip?.plan?.stops.find(s => s.id === stopId)
  if (!trip || (stopId && (!stop || stop.date !== date))) throw new Error('Cette étape a changé. Rechargez la journée ; votre saisie reste conservée.')
  const journal = stored.data.journals.find(j => j.tripId === tripId) ?? {tripId,destination:trip.destination,departure:trip.departure,chapters:[]}
  const existing = journal.chapters.find(c => c.id === stop?.chapterId)
  const id = existing?.id ?? createId()
  const story = [existing?.story, `${date}\n${text.trim()}`].filter(Boolean).join('\n\n')
  const photos = [...(existing?.media ?? []), ...media]
  const chapter: Draft = {id,title:existing?.title ?? `${stop?.place ?? trip.destination} · ${date}`.slice(0,120),story,memories:existing?.memories ?? '',tone:existing?.tone ?? '',media:photos,coverId:existing?.coverId || photos[0]?.id || '',status:'draft'}
  const next = {version:1 as const,journals:[...stored.data.journals.filter(j => j.tripId !== tripId),{...journal,chapters:[...journal.chapters.filter(c => c.id !== id),chapter]}]}
  const trips = upcoming.trips.map(t => t.id === tripId && t.plan && stop ? {...t,plan:{...t.plan,stops:t.plan.stops.map(s => s.id === stopId ? {...s,chapterId:id} : s)}} : t)
  if (!validateJournals(next) || !validateUpcomingTrips(trips)) throw new Error('Limite du carnet atteinte (12 photos par chapitre, 40 chapitres). Votre saisie est conservée.')
  const previous = localStorage.getItem(journalsKey)
  localStorage.setItem(journalsKey,JSON.stringify(next))
  try { localStorage.setItem(upcomingKey,JSON.stringify(trips)) }
  catch (error) { if(previous === null) localStorage.removeItem(journalsKey); else localStorage.setItem(journalsKey,previous); throw error }
  window.dispatchEvent(new Event('trip-journals-updated'))
  window.dispatchEvent(new Event('upcoming-trips-updated'))
  return id
}
