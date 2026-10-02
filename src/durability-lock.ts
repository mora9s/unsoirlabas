const durabilityLockName = 'un-soir-la-bas-media-durability-v1'

/** Shared cross-tab lock for media and all read-modify-write durable state. */
export async function withDurabilityLock<T>(operation: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) throw new Error('Les enregistrements sont suspendus : ce navigateur ne fournit pas de verrouillage multi-onglets sûr.')
  return locks.request(durabilityLockName, { mode: 'exclusive' }, operation)
}

/** Kept as a compatibility alias for existing media callers. */
export const withMediaDurabilityLock = withDurabilityLock