import type { UpcomingTrip } from './upcoming-trips'
import type { Draft } from './journal'

// Read-only editorial example; never inserted into the visitor's local storage.
export const journeyDemo: UpcomingTrip = { id: 'demo', destination: 'Cap sur les Philippines', departure: '2027-04-12', plan: { ideas: [], notes: '', stops: [
  { id: 'nice', place: 'Nice', point: { lat: 43.7031, lon: 7.2661 } },
  { id: 'cebu', place: 'Cebu', point: { lat: 10.3157, lon: 123.8854 }, transport: 'plane' },
  { id: 'bohol', place: 'Bohol', point: { lat: 9.6496, lon: 123.8556 }, transport: 'boat', chapterId: 'bohol-demo' },
] } }
export const journeyDemoChapters: Draft[] = [{ id: 'bohol-demo', title: 'Les collines de Bohol', story: '', memories: '', tone: '', status: 'draft', coverId: 'bohol-image', media: [{ id: 'bohol-image', name: 'Les Chocolate Hills de Bohol · photo de démonstration', src: '/assets/chocolate-hills.jpg' }] }]
