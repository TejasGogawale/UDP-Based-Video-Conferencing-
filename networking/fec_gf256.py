"""Sub-Packet Reed-Solomon Forward Error Correction over Galois Field GF(2^8).

Implements Patent Sections 9.3–9.4 (Claims 1, 5, 6, 14):
  * Irreducible primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11d).
  * Systematic MDS generator matrix G (N x K) over GF(2^8):
      - Top K x K rows form the identity matrix I_K (unmodified source shards).
      - Bottom P = N - K rows form Cauchy parity rows C_{i,j} = (x_i ^ y_j)^(-1),
        guaranteeing that ANY K x K submatrix is strictly invertible over GF(2^8).
  * Supports (8, 6) parity for Level 1 Degraded (0.25 <= CI < 0.60) and
    (10, 6) parity for Level 2 Severe (CI >= 0.60).
  * Reconstructs arbitrary missing packets in 0-RTT upon receiving any K of N shards.
"""
from typing import List, Tuple

PRIMITIVE_POLY = 0x11D

GF_EXP = [0] * 512
GF_LOG = [0] * 256


def _init_tables():
    x = 1
    for i in range(255):
        GF_EXP[i] = x
        GF_LOG[x] = i
        x <<= 1
        if x & 0x100:
            x ^= PRIMITIVE_POLY
    for i in range(255, 512):
        GF_EXP[i] = GF_EXP[i - 255]


_init_tables()


def gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return GF_EXP[GF_LOG[a] + GF_LOG[b]]


def gf_div(a: int, b: int) -> int:
    if b == 0:
        raise ZeroDivisionError('Division by zero in GF(2^8)')
    if a == 0:
        return 0
    return GF_EXP[(GF_LOG[a] - GF_LOG[b]) % 255]


def gf_inv(a: int) -> int:
    if a == 0:
        raise ZeroDivisionError('Zero has no inverse in GF(2^8)')
    return GF_EXP[255 - GF_LOG[a]]


def build_generator_matrix(n: int, k: int) -> List[List[int]]:
    """Build an N x K systematic MDS generator matrix over GF(2^8)."""
    if not (1 <= k <= n <= 128):
        raise ValueError(f'Invalid (N={n}, K={k}) parameters for GF(2^8) FEC')
    matrix: List[List[int]] = []
    # Top K rows: Identity matrix I_K
    for r in range(k):
        row = [0] * k
        row[r] = 1
        matrix.append(row)
    # Bottom N - K rows: Cauchy parity rows 1 / (x_i ^ y_j) where x_i = k + i, y_j = j
    for p in range(n - k):
        x_i = k + p
        row = [gf_inv(x_i ^ j) for j in range(k)]
        matrix.append(row)
    return matrix


def invert_matrix_gf256(mat: List[List[int]]) -> List[List[int]]:
    """Invert a K x K matrix over GF(2^8) using Gauss-Jordan elimination."""
    k = len(mat)
    aug = [ list(mat[r]) + [1 if r == c else 0 for c in range(k)] for r in range(k) ]

    for col in range(k):
        pivot = col
        while pivot < k and aug[pivot][col] == 0:
            pivot += 1
        if pivot == k:
            raise ValueError('Matrix is singular in GF(2^8)')
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]

        inv_p = gf_inv(aug[col][col])
        for c in range(2 * k):
            aug[col][c] = gf_mul(aug[col][c], inv_p)

        for r in range(k):
            if r != col and aug[r][col] != 0:
                factor = aug[r][col]
                for c in range(2 * k):
                    aug[r][c] ^= gf_mul(factor, aug[col][c])

    return [row[k:] for row in aug]


def encode_fec_shards(payload: bytes, n: int = 8, k: int = 6) -> Tuple[List[Tuple[int, bytes]], int]:
    """Partition `payload` into K source shards and generate N - K parity shards.

    Returns (shards, original_length) where each item in `shards` is (shard_index, shard_bytes).
    """
    orig_len = len(payload)
    shard_len = max(1, (orig_len + k - 1) // k)
    padded = payload.ljust(shard_len * k, b'\x00')

    source_shards = [
        padded[i * shard_len:(i + 1) * shard_len]
        for i in range(k)
    ]
    gen = build_generator_matrix(n, k)
    shards: List[Tuple[int, bytes]] = []

    for idx in range(k):
        shards.append((idx, source_shards[idx]))

    for idx in range(k, n):
        row = gen[idx]
        parity = bytearray(shard_len)
        for c in range(k):
            coeff = row[c]
            src = source_shards[c]
            for b_idx in range(shard_len):
                parity[b_idx] ^= gf_mul(coeff, src[b_idx])
        shards.append((idx, bytes(parity)))

    return shards, orig_len


def decode_fec_shards(received_shards: List[Tuple[int, bytes]], n: int, k: int, orig_len: int) -> bytes:
    """Reconstruct the original payload in 0-RTT from ANY K out of N shards."""
    if len(received_shards) < k:
        raise ValueError(f'Need at least K={k} shards to reconstruct, got {len(received_shards)}')

    # De-duplicate and take the first K valid shards
    seen = set()
    chosen: List[Tuple[int, bytes]] = []
    for idx, data in received_shards:
        if 0 <= idx < n and idx not in seen:
            seen.add(idx)
            chosen.append((idx, data))
        if len(chosen) == k:
            break

    if len(chosen) < k:
        raise ValueError(f'Need {k} distinct shards, got {len(chosen)}')

    shard_len = len(chosen[0][1])

    # Fast path: all K source shards (0..K-1) arrived intact
    by_idx = dict(chosen)
    if all(i in by_idx for i in range(k)):
        raw = b''.join(by_idx[i] for i in range(k))
        return raw[:orig_len]

    gen = build_generator_matrix(n, k)
    submatrix = [gen[idx] for idx, _ in chosen]
    inv_matrix = invert_matrix_gf256(submatrix)

    recovered: List[bytes] = []
    for r in range(k):
        row = inv_matrix[r]
        out_shard = bytearray(shard_len)
        for c in range(k):
            coeff = row[c]
            if coeff == 0:
                continue
            in_shard = chosen[c][1]
            for b_idx in range(shard_len):
                out_shard[b_idx] ^= gf_mul(coeff, in_shard[b_idx])
        recovered.append(bytes(out_shard))

    return b''.join(recovered)[:orig_len]
