/**
 * Utility tool helpers.
 * Mostly pure functions — no heavy dependencies needed.
 *
 * NOTE: Hash generation has been implemented in `./hashGenerator.ts`.
 * The functions below delegate there for backward compatibility.
 */

import { generateHashes, type HashAlgorithm } from '@/features/utility/utils/hashGenerator'

export { generateHashes, type HashAlgorithm } from '@/features/utility/utils/hashGenerator'

export async function generateHash(
  text: string,
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512' = 'sha256',
): Promise<string> {
  const algoMap: Record<string, HashAlgorithm> = {
    md5: 'MD5',
    sha1: 'SHA-1',
    sha256: 'SHA-256',
    sha384: 'SHA-384',
    sha512: 'SHA-512',
  }
  const results = await generateHashes(text, [algoMap[algorithm] || 'SHA-256'])
  return results[0]?.hash || ''
}
