const durabilityLockName = 'un-soir-la-bas-media-durability-v1'

/** Cross-tab mutual exclusion; fail closed when Web Locks are unavailable. */
export async function withMediaDurabilityLock<T>(operation: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) throw new Error('Les opérations sur les médias sont suspendues : ce navigateur ne fournit pas de verrouillage multi-onglets sûr.')
  return locks.request(durabilityLockName, { mode: 'exclusive' }, operation)
}
