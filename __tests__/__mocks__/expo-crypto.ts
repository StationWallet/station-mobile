import { randomBytes as nodeRandomBytes } from 'node:crypto'

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(byteCount))
}
