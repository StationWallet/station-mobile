import { randomBytes as nodeRandomBytes } from 'crypto'

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(byteCount))
}
