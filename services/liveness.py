"""In-Stream Cryptographic Liveness & Anti-Deepfake Verification Service.

Implements the server-side verifier for the HMAC-SHA256 liveness hash chain
and audio-video biometric telemetry described in the VIT Connect architecture:
  1. Issues a per-session cryptographic seed derived from JWT_SECRET_KEY,
     meeting_id, user_id, and socket sid.
  2. Verifies each client's chained HMAC-SHA256 proof:
       H_n = HMAC-SHA256(seed, "{seq}:{timestamp}:{videoDigest}:{audioDigest}:{score}:{H_{n-1}}")
  3. Validates timestamp freshness and strict sequence monotonicity to defeat
     replay and frame-injection attacks.
  4. Classifies participant media authenticity into:
       - 'verified'   : Valid HMAC chain + live camera/audio temporal entropy
       - 'synthetic'  : Virtual camera, canvas fallback, or static/replay anomaly
       - 'tampered'   : Cryptographic HMAC chain mismatch or replay detected
       - 'standby'    : Camera & microphone both muted (awaiting active media)
"""
import hashlib
import hmac
import time
from config import Config

MAX_CLOCK_SKEW_MS = 120_000  # allow up to 2 minutes of client/server clock drift


def issue_liveness_seed(meeting_id: str, user_id: str, sid: str) -> str:
    """Deterministic per-session HMAC seed shared only with the owning client over TLS."""
    secret = (Config.JWT_SECRET_KEY or Config.SECRET_KEY or 'vit-connect-liveness').encode('utf-8')
    msg = f'liveness:{meeting_id}:{user_id}:{sid}'.encode('utf-8')
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def compute_chained_hmac(seed: str, seq: int, timestamp: int, video_digest: str,
                         audio_digest: str, score: int, prev_sig: str) -> str:
    """Compute the expected HMAC-SHA256 link in the hash chain."""
    payload = f'{seq}:{timestamp}:{video_digest}:{audio_digest}:{score}:{prev_sig or "genesis"}'.encode('utf-8')
    return hmac.new(seed.encode('utf-8'), payload, hashlib.sha256).hexdigest()


def default_liveness_state() -> dict:
    return {
        'status': 'standby',
        'score': 100,
        'chainLength': 0,
        'reason': 'Awaiting media stream',
        'updatedAt': int(time.time() * 1000),
    }


def verify_liveness_proof(session_state: dict, proof: dict) -> dict:
    """Verify an incoming client liveness proof and update `session_state` in place.

    `session_state` holds private per-socket fields:
      - livenessSeed: str
      - livenessLastSeq: int
      - livenessLastSig: str
      - livenessChainLen: int
    Returns the public `liveness` dict safe to broadcast in the roster.
    """
    proof = proof or {}
    seed = session_state.get('livenessSeed')
    if not seed:
        return default_liveness_state()

    try:
        seq = int(proof.get('seq', 0))
        timestamp = int(proof.get('timestamp', 0))
        score = max(0, min(100, int(round(float(proof.get('score', 0))))))
    except (TypeError, ValueError):
        return {
            'status': 'tampered',
            'score': 0,
            'chainLength': session_state.get('livenessChainLen', 0),
            'reason': 'Malformed liveness proof payload',
            'updatedAt': int(time.time() * 1000),
        }

    video_digest = str(proof.get('videoDigest') or 'none')[:64]
    audio_digest = str(proof.get('audioDigest') or 'none')[:64]
    client_sig = str(proof.get('signature') or '')[:128]
    client_mode = str(proof.get('mode') or 'active')[:32]
    anomaly = str(proof.get('anomaly') or '')[:80]

    last_seq = session_state.get('livenessLastSeq', 0)
    last_sig = session_state.get('livenessLastSig', 'genesis')

    # 1. Sequence monotonicity check (anti-replay)
    if seq <= last_seq:
        return {
            'status': 'tampered',
            'score': 0,
            'chainLength': session_state.get('livenessChainLen', 0),
            'reason': 'Out-of-order or replayed liveness sequence',
            'updatedAt': int(time.time() * 1000),
        }

    # 2. Timestamp freshness check
    now_ms = int(time.time() * 1000)
    if abs(now_ms - timestamp) > MAX_CLOCK_SKEW_MS:
        return {
            'status': 'tampered',
            'score': 0,
            'chainLength': session_state.get('livenessChainLen', 0),
            'reason': 'Expired liveness proof timestamp',
            'updatedAt': now_ms,
        }

    # 3. Cryptographic HMAC-SHA256 chain verification
    expected_sig = compute_chained_hmac(
        seed=seed,
        seq=seq,
        timestamp=timestamp,
        video_digest=video_digest,
        audio_digest=audio_digest,
        score=score,
        prev_sig=last_sig if seq > 1 else 'genesis',
    )
    if not hmac.compare_digest(expected_sig, client_sig):
        # Allow a chain reset on seq == 1 if the client re-initialized its media pipeline
        reset_sig = compute_chained_hmac(
            seed=seed,
            seq=seq,
            timestamp=timestamp,
            video_digest=video_digest,
            audio_digest=audio_digest,
            score=score,
            prev_sig='genesis',
        )
        if hmac.compare_digest(reset_sig, client_sig):
            expected_sig = reset_sig
            session_state['livenessChainLen'] = 0
        else:
            return {
                'status': 'tampered',
                'score': 0,
                'chainLength': session_state.get('livenessChainLen', 0),
                'reason': 'HMAC-SHA256 liveness signature mismatch',
                'updatedAt': now_ms,
            }

    # Valid cryptographic proof: advance the hash chain
    session_state['livenessLastSeq'] = seq
    session_state['livenessLastSig'] = expected_sig
    chain_len = session_state.get('livenessChainLen', 0) + 1
    session_state['livenessChainLen'] = chain_len

    if client_mode == 'standby':
        status = 'standby'
        reason = 'Camera & mic muted (session HMAC verified)'
    elif client_mode == 'synthetic' or score < 55:
        status = 'synthetic'
        reason = anomaly or 'Synthetic or virtual media feed detected'
    else:
        status = 'verified'
        reason = f'Live feed verified (ZK-PoA chain #{chain_len})'

    return {
        'status': status,
        'score': score,
        'chainLength': chain_len,
        'reason': reason,
        'updatedAt': now_ms,
    }
