import { createId } from './id'

export const asset = (name: string) => `/assets/${name}`

export const days = [
  { day: 1, title: 'Premiers battements à Manille', place: 'Manille', status: 'published', label: 'Publié', image: 'manila-sunset.jpg', alt: 'Ciel rose et orangé au-dessus de la baie de Manille', excerpt: 'Le bruit de la ville, les premiers détours et ce ciel qui nous invite à ralentir.' },
  { day: 3, title: 'Entre lagons et falaises à El Nido', place: 'El Nido · Palawan', status: 'draft', label: 'Brouillon', image: 'el-nido-big-lagoon.jpg', alt: 'Eau turquoise du Big Lagoon entre les falaises calcaires d’El Nido', excerpt: 'Une pagaie dans l’eau, le sel sur la peau. Et soudain, plus aucune envie de regarder l’heure.' },
  { day: 8, title: 'Les collines de Bohol', place: 'Bohol', status: 'upcoming', label: 'À venir', image: 'chocolate-hills.jpg', alt: 'Les collines arrondies de Chocolate Hills dans la végétation de Bohol', excerpt: 'Quitter le bleu pour le vert. La suite du carnet attend encore ses souvenirs.' },
] as const

export const gallery = [
  { image: 'el-nido-bay.jpg', alt: 'Une plage bordée de végétation au pied des reliefs de la baie d’El Nido', caption: '01 — La baie, avant de prendre le large' },
  { image: 'el-nido-big-lagoon.jpg', alt: 'Une embarcation au milieu des eaux claires du Big Lagoon', caption: '02 — Tout paraît plus petit, ici' },
  { image: 'el-nido-lagoon.jpg', alt: 'Lagon d’El Nido entouré de falaises couvertes de végétation', caption: '03 — Une autre nuance de bleu' },
  { image: 'bacuit-island.jpg', alt: 'Îlot rocheux et lagon dans l’archipel de Bacuit', caption: '04 — Les îles de Bacuit' },
  { image: 'limestone-island.jpg', alt: 'Relief calcaire escarpé émergeant de la baie de Bacuit', caption: '05 — La pierre rencontre la mer' },
  { image: 'port-barton.jpg', alt: 'Plage de Port Barton sur l’île de Palawan', caption: '06 — Port Barton, une envie pour la suite' },
]

export type Media = { id: string; name: string; src: string }
export type Draft = { id: string; title: string; memories: string; tone: string; story: string; media: Media[]; coverId: string; status: 'draft' }
export type Trip = { version: 1; drafts: Draft[] }
export const storageKey = 'philippines-trip'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMedia(value: unknown): value is Media {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && typeof value.src === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.src)
}

function isDraft(value: unknown): value is Draft {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.title === 'string' && typeof value.story === 'string' &&
    typeof value.memories === 'string' && typeof value.tone === 'string' &&
    typeof value.coverId === 'string' && value.status === 'draft' &&
    Array.isArray(value.media) && value.media.every(isMedia) &&
    new Set(value.media.map(item => item.id)).size === value.media.length
}

export function coverOf(draft: Draft): Media | undefined {
  return draft.media.find(item => item.id === draft.coverId) ?? draft.media[0]
}

export function storyExcerpt(story: string, limit = 160): string {
  const text = story.trim().replace(/\s+/g, ' ')
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`
}

export function readTrip(): { trip: Trip; error: string } {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return { trip: { version: 1, drafts: [] }, error: '' }
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.drafts) ||
      !value.drafts.every(isDraft) || new Set(value.drafts.map(draft => draft.id)).size !== value.drafts.length) {
      throw new Error('Format non reconnu')
    }
    return { trip: { version: 1, drafts: value.drafts }, error: '' }
  } catch {
    return { trip: { version: 1, drafts: [] }, error: 'Le carnet enregistré ne peut pas être lu. Vos données n’ont pas été modifiées ; exportez ou rétablissez le stockage de ce navigateur avant d’enregistrer.' }
  }
}

export function generateStory(memories: string, tone: string): string {
  const openings: Record<string, string> = {
    Aventure: 'Aujourd’hui, aux Philippines, nous avons suivi notre envie d’explorer plutôt qu’un itinéraire tout tracé.',
    Contemplatif: 'Il y a des journées que l’on voudrait retenir un peu plus longtemps. Aux Philippines, celle-ci en fait partie.',
    Spontané: 'On voulait garder une trace de cette journée aux Philippines, avant que les petits détails ne nous échappent.',
  }
  const endings: Record<string, string> = {
    Aventure: 'Ce soir, nous gardons le goût du départ et l’envie de recommencer. L’aventure tient aussi dans ces petits moments que l’on prend enfin le temps de raconter.',
    Contemplatif: 'En relisant ces mots, nous retrouvons le rythme de la journée. Rien à ajouter : seulement l’envie de laisser à ces souvenirs la place qu’ils méritent.',
    Spontané: 'Voilà ce que l’on veut emporter avec nous. Pas une journée parfaite sur le papier, mais la nôtre, avec ces instants qu’on se racontera encore au retour.',
  }
  const text = memories.trim()
  return `${openings[tone] ?? openings.Contemplatif}\n\n${text}${/[.!?…]$/.test(text) ? '' : '.'}\n\n${endings[tone] ?? endings.Contemplatif}`
}

/** Keep imported pictures portable and small enough for browser storage. */
export async function importImage(file: File): Promise<Media> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error(`« ${file.name} » : choisissez une image JPEG, PNG, WebP, GIF ou AVIF.`)
  if (file.size > 12 * 1024 * 1024) throw new Error(`« ${file.name} » dépasse 12 Mo.`)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('La préparation des images est indisponible dans ce navigateur.')
    context.fillStyle = '#f6f2e9'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { id: createId(), name: file.name, src: canvas.toDataURL('image/jpeg', 0.82) }
  } catch (error) {
    throw new Error(error instanceof Error && error.message.startsWith('La préparation') ? error.message : `Impossible de lire « ${file.name} ». Essayez une autre image.`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
