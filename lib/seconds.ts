export const SECS_PER_DAY = 86_400

const ENC_SPARSE = 0
const ENC_DENSE = 1

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function decodeSecondsBlob(b64: string | null | undefined): Set<number> {
  const out = new Set<number>()
  if (!b64) return out

  let bytes: Uint8Array
  try {
    bytes = fromBase64(b64)
  } catch {
    return out
  }
  if (bytes.length === 0) return out

  if (bytes[0] === ENC_SPARSE) {
    let i = 1
    const uvarint = (): number | null => {
      let val = 0
      let shift = 0
      for (;;) {
        if (i >= bytes.length) return null
        const byte = bytes[i++]
        val += (byte & 0x7f) * Math.pow(2, shift)
        if ((byte & 0x80) === 0) return val
        shift += 7
        if (shift > 35) return null
      }
    }
    const n = uvarint()
    if (n === null) return out
    let acc = 0
    for (let k = 0; k < n; k++) {
      const d = uvarint()
      if (d === null) return out
      acc += d
      out.add(acc)
    }
    return out
  }

  if (bytes[0] === ENC_DENSE) {
    for (let b = 1; b < bytes.length; b++) {
      const byte = bytes[b]
      if (byte === 0) continue
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (1 << (7 - bit))) out.add((b - 1) * 8 + bit)
      }
    }
    return out
  }

  return out
}
