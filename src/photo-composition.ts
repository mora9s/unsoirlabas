import type { Media } from './journal'

export type PhotoComposition = {
  coverId: string
  mediaIds: string[]
  duplicateGroups: string[][]
}

/** A local, stable suggestion only. It never edits or removes source media. */
export function proposePhotoComposition(media: Media[], bytePayloads: ReadonlyMap<string, Uint8Array> = new Map()): PhotoComposition {
  if (!media.length) return { coverId: '', mediaIds: [], duplicateGroups: [] }

  const groups: string[][] = []
  const bytesEqual = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index])
  for (let index = 0; index < media.length; index += 1) {
    const photo = media[index]
    const bytes = bytePayloads.get(photo.id)
    let group = groups.find(ids => {
      const first = media.find(item => item.id === ids[0])!
      const firstBytes = bytePayloads.get(first.id)
      return bytes && firstBytes ? bytesEqual(bytes, firstBytes) : !bytes && !firstBytes && photo.src.startsWith('data:image/') && first.src === photo.src
    })
    if (!group) { group = []; groups.push(group) }
    group.push(photo.id)
  }
  const duplicateGroups = groups.filter(ids => ids.length > 1)
    .map(ids => [...ids].sort((a, b) => a.localeCompare(b)))
    .sort((a, b) => a[0].localeCompare(b[0]))

  const area = (photo: Media) => Math.max(0, photo.width ?? 0) * Math.max(0, photo.height ?? 0)
  const coverScore = (photo: Media) => {
    const width = Math.max(0, photo.width ?? 0)
    const height = Math.max(0, photo.height ?? 0)
    // A modest landscape preference suits the existing wide cover crop; dimensions
    // break ties, while stable original order breaks exact ties.
    const landscape = width > height ? 1 : 0
    return [landscape, area(photo)]
  }
  const originalPosition = new Map(media.map((photo, index) => [photo.id, index]))
  const sorted = [...media].sort((a, b) => {
    const [aLandscape, aArea] = coverScore(a)
    const [bLandscape, bArea] = coverScore(b)
    return bLandscape - aLandscape || bArea - aArea || originalPosition.get(a.id)! - originalPosition.get(b.id)!
  })
  return { coverId: sorted[0].id, mediaIds: sorted.map(photo => photo.id), duplicateGroups }
}
