import type { PlanStop } from './upcoming-trips'

/** Apply only edited fields under the durability lock; reject same-field conflicts. */
export function mergeStopUpdate(stops: PlanStop[], before: PlanStop, updated: PlanStop): PlanStop[] {
  const current = stops.find(stop => stop.id === before.id)
  if (!current) throw new Error('Cette étape a été retirée. Rechargez le programme avant de continuer.')
  const next = { ...current } as Record<string, unknown>
  const original = before as unknown as Record<string, unknown>
  const changes = updated as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(original), ...Object.keys(changes)])) {
    if (key === 'id' || JSON.stringify(original[key]) === JSON.stringify(changes[key])) continue
    if (JSON.stringify(next[key]) !== JSON.stringify(original[key])) throw new Error('Cette étape a changé dans un autre onglet. Rechargez le programme avant de continuer.')
    if (Object.hasOwn(changes, key)) next[key] = changes[key]
    else delete next[key]
  }
  return stops.map(stop => stop.id === before.id ? next as PlanStop : stop)
}
