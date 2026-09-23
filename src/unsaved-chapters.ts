import type { Draft } from './journal'
import { validateTrip } from './journal'

export const unsavedChaptersKey = 'un-soir-la-bas-unsaved-chapters-v1'
type Entry = { scope: string; updatedAt: number; draft: Draft }
type Envelope = { version: 1; drafts: Entry[] }

function validEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const envelope = value as Record<string, unknown>
  if (envelope.version !== 1 || !Array.isArray(envelope.drafts) || envelope.drafts.length > 52) return false
  const scopes = new Set<string>()
  return envelope.drafts.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const entry = item as Record<string, unknown>
    if (typeof entry.scope !== 'string' || !entry.scope || entry.scope.length > 220 || scopes.has(entry.scope) ||
      typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt) || !validateTrip({ version: 1, drafts: [entry.draft] })) return false
    scopes.add(entry.scope)
    return true
  })
}

export function readUnsavedChapter(scope: string): { draft?: Draft; error: string } {
  try {
    const raw = localStorage.getItem(unsavedChaptersKey)
    if (raw === null) return { error: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!validEnvelope(parsed)) throw new Error('format')
    return { draft: parsed.drafts.find(entry => entry.scope === scope)?.draft, error: '' }
  } catch {
    return { error: 'Les brouillons non enregistrés ne peuvent pas être lus. Vos données originales sont conservées ; ce chapitre reste ouvert sans les remplacer.' }
  }
}

export function writeUnsavedChapter(scope: string, draft: Draft): string {
  let entries: Entry[] = []
  let raw: string | null
  try { raw = localStorage.getItem(unsavedChaptersKey) }
  catch { return 'Le brouillon ne peut pas être récupéré après fermeture : le stockage est plein ou indisponible. Votre travail reste ouvert ici.' }
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!validEnvelope(parsed)) return 'Les brouillons non enregistrés ne peuvent pas être lus. Vos données originales sont conservées ; ce chapitre reste ouvert sans les remplacer.'
      entries = parsed.drafts
    } catch {
      return 'Les brouillons non enregistrés ne peuvent pas être lus. Vos données originales sont conservées ; ce chapitre reste ouvert sans les remplacer.'
    }
  }
  const next: Envelope = { version: 1, drafts: [...entries.filter(item => item.scope !== scope), { scope, updatedAt: Date.now(), draft }] }
  try {
    localStorage.setItem(unsavedChaptersKey, JSON.stringify(next))
    return ''
  } catch {
    return 'Le brouillon ne peut pas être récupéré après fermeture : le stockage est plein ou indisponible. Votre travail reste ouvert ici.'
  }
}

export function discardUnsavedChapter(scope: string): string {
  try {
    const raw = localStorage.getItem(unsavedChaptersKey)
    if (raw === null) return ''
    const parsed: unknown = JSON.parse(raw)
    if (!validEnvelope(parsed)) return 'Les brouillons non enregistrés ne peuvent pas être lus. Vos données originales sont conservées ; ce chapitre reste ouvert sans les remplacer.'
    const next: Envelope = { version: 1, drafts: parsed.drafts.filter(item => item.scope !== scope) }
    if (next.drafts.length) localStorage.setItem(unsavedChaptersKey, JSON.stringify(next))
    else localStorage.removeItem(unsavedChaptersKey)
    return ''
  } catch {
    return 'Impossible d’abandonner ce brouillon : le stockage est indisponible. Les données originales sont conservées.'
  }
}
