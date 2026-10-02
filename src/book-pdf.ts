import type { Draft, Media } from './journal'

export type BookChapter = Pick<Draft, 'title' | 'story' | 'media' | 'coverId'>
export type BookOptions = { destination: string; title?: string; conclusion?: string; cover?: ImagePayload; chapters: Array<{ chapter: BookChapter; images: ImagePayload[] }> }
export type ImagePayload = { bytes: Uint8Array; width: number; height: number }

const PAGE_W = 595.28
const PAGE_H = 841.89
const LEFT = 58
const RIGHT = 58
const BOTTOM = 58
const encoder = new TextEncoder()

function pdfText(input: string) {
  // WinAnsi is supported by PDF's built-in Helvetica. Unsupported glyphs are
  // called out in the document instead of silently disappearing.
  let fallback = false
  const normalized = input.normalize('NFC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '—')
  const safe = [...normalized].map(char => {
    const cp = char.codePointAt(0)!
    if (cp <= 0xff || cp === 0x20ac || cp === 0x2014 || cp === 0x2026 || cp === 0x0152 || cp === 0x0153 || cp === 0x0160 || cp === 0x0161 || cp === 0x0178 || cp === 0x017d || cp === 0x017e || cp === 0x0192 || cp >= 0x201a && cp <= 0x203a) return char
    fallback = true
    return '[symbole non imprimable]'
  }).join('')
  const cp1252: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f }
  const bytes: number[] = []
  for (const char of safe) { const cp = char.codePointAt(0)!; bytes.push(cp <= 0xff ? cp : cp1252[cp] ?? 0x3f) }
  return { hex: bytes.map(byte => byte.toString(16).padStart(2, '0')).join(''), fallback }
}

function wrapText(value: string, maxChars: number): string[] {
  const result: string[] = []
  for (const paragraph of value.split(/\r?\n/)) {
    if (!paragraph.trim()) { result.push(''); continue }
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) { result.push(line); line = '' }
        for (let i = 0; i < word.length; i += maxChars) result.push(word.slice(i, i + maxChars))
        continue
      }
      const next = line ? `${line} ${word}` : word
      if (next.length > maxChars && line) { result.push(line); line = word }
      else line = next
    }
    if (line) result.push(line)
  }
  return result
}

function base64Bytes(source: string): Uint8Array {
  const payload = source.slice(source.indexOf(',') + 1)
  const binary = atob(payload)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

export async function imagePayload(media: Media): Promise<ImagePayload> {
  const response = await fetch(media.src)
  if (!response.ok) throw new Error(`Impossible de lire la photo « ${media.name} » sur cet appareil.`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('La préparation locale des photos est indisponible.')
    context.fillStyle = '#f6f2e9'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return { bytes: base64Bytes(canvas.toDataURL('image/jpeg', 0.86)), width: canvas.width, height: canvas.height }
  } finally { bitmap.close() }
}

export function createBookPdf(options: BookOptions): Uint8Array {
  const objects: Uint8Array[] = []
  const add = (text: string) => { objects.push(encoder.encode(text)); return objects.length }
  const addStream = (dict: string, data: Uint8Array) => {
    const prefix = encoder.encode(`<< ${dict} /Length ${data.length} >>\nstream\n`)
    const suffix = encoder.encode('\nendstream')
    const bytes = new Uint8Array(prefix.length + data.length + suffix.length)
    bytes.set(prefix); bytes.set(data, prefix.length); bytes.set(suffix, prefix.length + data.length)
    objects.push(bytes)
    return objects.length
  }
  const catalogId = add('')
  const pagesId = add('')
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const pageRefs: number[] = []
  const pushPage = (lines: string[], image?: { payload: ImagePayload; x: number; y: number; w: number; h: number }) => {
    const commands = ['0.20 0.29 0.27 rg 58 790 34 2 re f', 'BT /F1 8 Tf 0.35 0.39 0.36 rg 58 35 Td (UN SOIR LA-BAS) Tj ET']
    for (const line of lines) commands.push(line)
    const embeds = image ? [{ name: 'Im1', ...image }] : []
    const ids = embeds.map(({ payload }) => addStream(`/Type /XObject /Subtype /Image /Width ${payload.width} /Height ${payload.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, payload.bytes))
    if (image) commands.push(`q ${image.w.toFixed(2)} 0 0 ${image.h.toFixed(2)} ${image.x.toFixed(2)} ${image.y.toFixed(2)} cm /Im1 Do Q`)
    const contentId = addStream('', encoder.encode(commands.join('\n')))
    const resourceString = ids.length ? `/XObject << /Im1 ${ids[0]} 0 R >>` : ''
    pageRefs.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R >> ${resourceString} >> /Contents ${contentId} 0 R >>`))
  }
  // Editorial title page. Cover image is optional and never inferred from source chapters.
  const titleLines: string[] = []
  const titleText = options.title?.trim() || `Carnet de ${options.destination}`
  titleLines.push(textCommand('UN SOIR LÀ-BAS', 8, LEFT, 790, true))
  titleLines.push(textCommand(titleText, 30, LEFT, 700, true))
  titleLines.push(textCommand(options.destination, 15, LEFT, 655, false))
  let coverImage: { payload: ImagePayload; x: number; y: number; w: number; h: number } | undefined
  if (options.cover) {
    const ratio = Math.min(480 / options.cover.width, 320 / options.cover.height)
    const w = options.cover.width * ratio, h = options.cover.height * ratio
    coverImage = { payload: options.cover, x: LEFT, y: 270, w, h }
  }
  titleLines.push(textCommand(`${options.chapters.length} ${options.chapters.length === 1 ? 'chapitre' : 'chapitres'}`, 10, LEFT, 235, false))
  pushPage(titleLines, coverImage)

  let pageLines: string[] = []
  let pageImage: { payload: ImagePayload; x: number; y: number; w: number; h: number } | undefined
  let cursor = 760
  let chapterIndex = 0
  const freshPage = () => { pushPage(pageLines, pageImage); pageLines = []; pageImage = undefined; cursor = 760 }
  const addText = (text: string, size: number, bold = false, gapAfter = 8) => {
    const wrapped = wrapText(text, Math.max(20, Math.floor((PAGE_W - LEFT - RIGHT) / (size * 0.52))))
    for (const line of wrapped) {
      if (cursor < BOTTOM + size + 10) freshPage()
      pageLines.push(textCommand(line, size, LEFT, cursor, bold))
      cursor -= size * 1.45
    }
    cursor -= gapAfter
  }
  for (const entry of options.chapters) {
    chapterIndex += 1
    if (cursor < 570) freshPage()
    addText(`CHAPITRE ${chapterIndex}`, 8, true, 7)
    addText(entry.chapter.title.trim() || 'Chapitre sans titre', 21, true, 13)
    const selectedCover = entry.images[0]
    if (selectedCover) {
      const ratio = Math.min(479 / selectedCover.width, 215 / selectedCover.height)
      const w = selectedCover.width * ratio, h = selectedCover.height * ratio
      if (cursor - h < BOTTOM + 40) freshPage()
      const imgY = cursor - h
      pageImage = { payload: selectedCover, x: LEFT, y: imgY, w, h }
      cursor = imgY - 22
    }
    addText(entry.chapter.story.trim(), 11, false, 13)
    for (const payload of entry.images.slice(1)) {
      const ratio = Math.min(479 / payload.width, 250 / payload.height)
      const w = payload.width * ratio, h = payload.height * ratio
      if (cursor - h < BOTTOM + 25) freshPage()
      const imgY = cursor - h
      freshPage()
      pageImage = { payload, x: LEFT, y: imgY, w, h }
      cursor = imgY - 25
    }
  }
  if (options.conclusion?.trim()) {
    if (cursor < 200) freshPage()
    addText('POUR LA SUITE', 8, true, 10)
    addText(options.conclusion.trim(), 11, false, 0)
  }
  if (pageLines.length || pageImage) pushPage(pageLines, pageImage)
  objects[catalogId - 1] = encoder.encode(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects[pagesId - 1] = encoder.encode(`<< /Type /Pages /Kids [${pageRefs.map(id => `${id} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`)
  const header = encoder.encode('%PDF-1.4\n%âãÏÓ\n')
  const chunks: Uint8Array[] = [header]
  const offsets = [0]
  let offset = header.length
  objects.forEach((object, index) => {
    offsets.push(offset)
    const start = encoder.encode(`${index + 1} 0 obj\n`), end = encoder.encode('\nendobj\n')
    chunks.push(start, object, end); offset += start.length + object.length + end.length
  })
  const xrefOffset = offset
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) xref += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(encoder.encode(xref))
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const pdf = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) { pdf.set(chunk, at); at += chunk.length }
  return pdf
}

function textCommand(value: string, size: number, x: number, y: number, bold: boolean) {
  const text = pdfText(value).hex
  return `BT /F1 ${size} Tf ${bold ? '0.20 0.29 0.27 rg' : '0.16 0.18 0.17 rg'} ${x} ${y.toFixed(2)} Td <${text}> Tj ET`
}
