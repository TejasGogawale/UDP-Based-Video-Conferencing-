// Galois Field GF(2^8) Sub-Packet Reed-Solomon FEC & Telemetry Analyzer
//
// Implements Patent Sections 9.3, 9.4, and 9.5 in the browser:
//   * Composite Channel Impairment Index (CI):
//       CI = 0.40*(PLF / 0.30) + 0.25*(Jitter / 200) + 0.20*(RTT / 300) + 0.15*(CPU / 100)
//   * Node Capability Score (NCS):
//       NCS = 100 * (0.45*norm(Uplink) + 0.35*norm(1/RTT) + 0.20*(1 - CPU/100))
//   * Systematic Cauchy/Vandermonde Reed-Solomon (8, 6) and (10, 6) FEC encoder
//     and 0-RTT Gauss-Jordan decoder over GF(2^8) (primitive poly 0x11d).

const PRIMITIVE_POLY = 0x11d
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(function initGfTables() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= PRIMITIVE_POLY
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

export function gfInv(a) {
  if (a === 0) throw new Error('Zero has no inverse in GF(2^8)')
  return GF_EXP[255 - GF_LOG[a]]
}

export function buildGeneratorMatrix(n, k) {
  const matrix = []
  for (let r = 0; r < k; r++) {
    const row = new Uint8Array(k)
    row[r] = 1
    matrix.push(row)
  }
  for (let p = 0; p < n - k; p++) {
    const x = k + p
    const row = new Uint8Array(k)
    for (let j = 0; j < k; j++) {
      row[j] = gfInv(x ^ j)
    }
    matrix.push(row)
  }
  return matrix
}

export function invertMatrixGf256(mat) {
  const k = mat.length
  const aug = Array.from({ length: k }, (_, r) => {
    const row = new Uint8Array(2 * k)
    for (let c = 0; c < k; c++) row[c] = mat[r][c]
    row[k + r] = 1
    return row
  })

  for (let col = 0; col < k; col++) {
    let pivot = col
    while (pivot < k && aug[pivot][col] === 0) pivot++
    if (pivot === k) throw new Error('Matrix is singular in GF(2^8)')
    if (pivot !== col) {
      const tmp = aug[col]
      aug[col] = aug[pivot]
      aug[pivot] = tmp
    }
    const invP = gfInv(aug[col][col])
    for (let c = 0; c < 2 * k; c++) aug[col][c] = gfMul(aug[col][c], invP)

    for (let r = 0; r < k; r++) {
      if (r !== col && aug[r][col] !== 0) {
        const factor = aug[r][col]
        for (let c = 0; c < 2 * k; c++) {
          aug[r][c] ^= gfMul(factor, aug[col][c])
        }
      }
    }
  }
  return aug.map((row) => row.slice(k))
}

export function encodeFecShards(payloadBytes, n = 8, k = 6) {
  const origLen = payloadBytes.length
  const shardLen = Math.max(1, Math.ceil(origLen / k))
  const padded = new Uint8Array(shardLen * k)
  padded.set(payloadBytes)

  const source = []
  for (let i = 0; i < k; i++) {
    source.push(padded.subarray(i * shardLen, (i + 1) * shardLen))
  }

  const gen = buildGeneratorMatrix(n, k)
  const shards = []
  for (let idx = 0; idx < k; idx++) {
    shards.push({ index: idx, data: new Uint8Array(source[idx]) })
  }
  for (let idx = k; idx < n; idx++) {
    const row = gen[idx]
    const parity = new Uint8Array(shardLen)
    for (let c = 0; c < k; c++) {
      const coeff = row[c]
      const src = source[c]
      for (let b = 0; b < shardLen; b++) {
        parity[b] ^= gfMul(coeff, src[b])
      }
    }
    shards.push({ index: idx, data: parity })
  }
  return { shards, origLen, n, k }
}

export function decodeFecShards(receivedShards, n, k, origLen) {
  const chosen = []
  const seen = new Set()
  for (const s of receivedShards) {
    if (s.index >= 0 && s.index < n && !seen.has(s.index)) {
      seen.add(s.index)
      chosen.push(s)
    }
    if (chosen.length === k) break
  }
  if (chosen.length < k) throw new Error(`Need ${k} shards, got ${chosen.length}`)

  const shardLen = chosen[0].data.length
  const gen = buildGeneratorMatrix(n, k)
  const sub = chosen.map((s) => gen[s.index])
  const inv = invertMatrixGf256(sub)

  const out = new Uint8Array(shardLen * k)
  for (let r = 0; r < k; r++) {
    const row = inv[r]
    const offset = r * shardLen
    for (let c = 0; c < k; c++) {
      const coeff = row[c]
      if (!coeff) continue
      const inData = chosen[c].data
      for (let b = 0; b < shardLen; b++) {
        out[offset + b] ^= gfMul(coeff, inData[b])
      }
    }
  }
  return out.subarray(0, origLen)
}

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

export function computeChannelImpairment({ plf = 0, jitterMs = 0, rttMs = 30, cpuUtilPct = 20 } = {}) {
  const normPlf = clamp(plf / 0.30)
  const normJitter = clamp(jitterMs / 200)
  const normRtt = clamp(rttMs / 300)
  const normCpu = clamp(cpuUtilPct / 100)

  const ci = Number((0.40 * normPlf + 0.25 * normJitter + 0.20 * normRtt + 0.15 * normCpu).toFixed(4))
  if (ci < 0.25) {
    return { ci, level: 0, state: 'nominal', route: 'webrtc_mesh', fec: null }
  }
  if (ci < 0.60) {
    return { ci, level: 1, state: 'degraded', route: 'hybrid_udp_fec', fec: { n: 8, k: 6, code: 'RS(8,6)' } }
  }
  return { ci, level: 2, state: 'severe', route: 'udp_fallback_fec', fec: { n: 10, k: 6, code: 'RS(10,6)' } }
}

export function computeNodeCapabilityScore({ uplinkKbps = 2500, avgRttMs = 40, cpuUtilPct = 25 } = {}) {
  const bwNorm = clamp(uplinkKbps / 4000)
  const invRttNorm = clamp(25 / Math.max(10, avgRttMs))
  const cpuHeadroom = clamp((100 - cpuUtilPct) / 100)
  return Number((100 * (0.45 * bwNorm + 0.35 * invRttNorm + 0.20 * cpuHeadroom)).toFixed(2))
}
