// Minimal ambient declaration for the `ripemd160` standalone package
// (a Node-style `HashBase` subclass). We only use the small subset
// `new RIPEMD160().update(Buffer).digest() → Buffer`.
declare module 'ripemd160' {
  import { Buffer as NodeBuffer } from 'node:buffer'

  class RIPEMD160 {
    update(data: NodeBuffer | string): this
    digest(): NodeBuffer
    digest(encoding: 'hex'): string
  }
  export default RIPEMD160
}
