import { expect, test } from '@playwright/test'
import { composeDays, haversineKm, safeSourceUrl, validateStayPlan } from '../src/stay-composer'
import { validateUpcomingTrips } from '../src/upcoming-trips'
import type { StayPlace, StayPlan } from '../src/stay-composer'

const wishes: StayPlace[] = [
  { id: 'a', name: 'Musée', category: 'activity', latitude: 48.86, longitude: 2.35, source: 'manual' },
  { id: 'b', name: 'Café', category: 'restaurant', latitude: 48.87, longitude: 2.36, source: 'manual' },
  { id: 'c', name: 'Parc', category: 'activity', latitude: 48.88, longitude: 2.37, source: 'manual' },
]

test('compose des journées souples sans perdre les envies non placées', () => {
  const result = composeDays(wishes, 2)
  expect(result.days).toHaveLength(2)
  expect(result.days.flatMap(day => day.placeIds).sort()).toEqual(['a', 'b', 'c'])
  expect(result.days.every(day => day.placeIds.length > 0)).toBeTruthy()
  expect(result.warnings).toEqual([])
})

test('recalcule en préservant le contenu des journées verrouillées et avertit des envies non placées', () => {
  const extra = Array.from({ length: 4 }, (_, index) => ({ ...wishes[0], id: `extra-${index}`, name: `Envie ${index}` }))
  const result = composeDays([...wishes, ...extra], 2, [{ id: 'stay-day-1', title: 'Jour 1', placeIds: ['b'], locked: true }])
  expect(result.days[0]).toMatchObject({ placeIds: ['b'], locked: true })
  expect(result.warnings).toContain('2 envies restent à placer.')
})

test('recomposer ne supprime pas une journée verrouillée quand la durée demandée diminue', () => {
  const locked = [
    { id: 'day-1', title: 'Jour 1', placeIds: ['a'], locked: true },
    { id: 'day-2', title: 'Jour 2', placeIds: ['b'], locked: true },
  ]
  const result = composeDays(wishes, 1, locked)
  expect(result.days).toEqual(locked)
})
test('préserve une journée verrouillée sparse après tous les index proposés', () => {
  const locked = { id: 'day-2', title: 'Jour 2', placeIds: ['b'], locked: true }
  const result = composeDays(wishes, 1, [
    { id: 'day-1', title: 'Jour 1', placeIds: ['a'], locked: false },
    locked,
  ])
  expect(result.days.find(day => day.id === 'day-2')).toEqual(locked)
  expect(result.days.flatMap(day => day.placeIds)).toContain('b')
})

test('distance droite et URL source explicite sont bornées et honnêtes', () => {
  expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.2, 0)
  expect(safeSourceUrl('https://www.openstreetmap.org/node/42')).toBe('https://www.openstreetmap.org/node/42')
  expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined()
  expect(safeSourceUrl('https://user:pass@example.org/x')).toBeUndefined()
})

test('preserves strict legacy plan records and validates serialized stay data', () => {
  expect(validateUpcomingTrips([{ id: 'legacy', destination: 'Kyoto', departure: '2027-04-12', plan: { ideas: [], stops: [], notes: '' } }])).toBeTruthy()
  expect(validateUpcomingTrips([{ id: 'stay', destination: 'Philippines', departure: '2027-04-12', plan: { ideas: [], stops: [], notes: '', stay: {
    anchor: { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 },
    places: [{ id: 'osm:node/9', name: 'Place', category: 'activity', source: 'osm', sourceId: 'node/9', sourceUrl: 'https://www.openstreetmap.org/node/9', latitude: 10.31, longitude: 123.88 }],
    days: [{ id: 'day-1', title: 'Jour 1', placeIds: ['osm:node/9'], locked: true }], daysCount: 1,
  } } }])).toBeTruthy()
  expect(validateUpcomingTrips([{ id: 'stay', destination: 'Philippines', departure: '2027-04-12', plan: { ideas: [], stops: [], notes: '', stay: { anchor: { name: 'Cebu', latitude: 91, longitude: 0 }, places: [], days: [], daysCount: 1 } } }])).toBeFalsy()
})

test('valide des contextes de séjour nommés et bornés sans invalider les anciens plans', () => {
  const cebu: StayPlan = { anchor: { name: 'Cebu', latitude: 10.3157, longitude: 123.8854 }, places: [], days: [], daysCount: 1 }
  const panglao: StayPlan = { anchor: { name: 'Panglao', latitude: 9.6, longitude: 123.85 }, places: [], days: [], daysCount: 1 }
  const record = [{ id: 'trip', destination: 'Philippines', departure: '2027-04-12', plan: { ideas: [], stops: [], notes: '', stay: cebu,
    stayContexts: [{ key: '10.31570,123.88540', stay: cebu }, { key: '9.60000,123.85000', stay: panglao }], selectedStayContextKey: '10.31570,123.88540' } }]
  expect(validateUpcomingTrips(record)).toBeTruthy()
  expect(validateUpcomingTrips([{ ...record[0], plan: { ...record[0].plan, stayContexts: [...record[0].plan.stayContexts, record[0].plan.stayContexts[0]] } }])).toBeFalsy()
})

test('valide les choix persistés et refuse coordonnées, doublons ou URLs source invalides', () => {
  const plan: StayPlan = {
    anchor: { name: 'Paris', latitude: 48.85, longitude: 2.35 },
    places: [{ ...wishes[0], sourceUrl: 'https://www.openstreetmap.org/node/1' }],
    days: [{ id: 'day-1', title: 'Jour 1', placeIds: ['a'], locked: false }],
    daysCount: 1,
  }
  expect(validateStayPlan(plan)).toBeTruthy()
  expect(validateStayPlan({ ...plan, places: [{ ...plan.places[0], latitude: 91 }] })).toBeFalsy()
  expect(validateStayPlan({ ...plan, places: [{ ...plan.places[0], sourceUrl: 'javascript:bad' }] })).toBeFalsy()
  expect(validateStayPlan({ ...plan, daysCount: 8 })).toBeFalsy()
})
