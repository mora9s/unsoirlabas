import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export const backupStatusKey = 'un-soir-la-bas-backup-status-v1'
export function backupFingerprint(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(value))))
}
export function recordBackup(fingerprint: string) {
  try {
    localStorage.setItem(backupStatusKey, JSON.stringify({fingerprint,createdAt:new Date().toISOString()}))
    window.dispatchEvent(new Event('backup-updated'))
  } catch { /* A tracking failure must not prevent downloading the archive. */ }
}
export function backupStatus(fingerprint: string): string {
  try {
    const stored = JSON.parse(localStorage.getItem(backupStatusKey) ?? 'null')
    if (!stored || !/^[a-f0-9]{64}$/.test(stored.fingerprint) || typeof stored.createdAt !== 'string' || !Number.isFinite(Date.parse(stored.createdAt))) return 'Aucune archive préparée sur ce navigateur. Pensez à conserver une copie de vos voyages.'
    const date = new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(stored.createdAt))
    return `Dernière archive préparée le ${date}. ${stored.fingerprint === fingerprint ? 'Aucun changement depuis cette archive.' : 'Des changements ne figurent pas dans cette archive : préparez une nouvelle copie.'} Vérifiez que vous avez conservé le fichier téléchargé ou partagé.`
  } catch { return 'Le suivi des sauvegardes est indisponible. Vous pouvez toujours télécharger une archive.' }
}
