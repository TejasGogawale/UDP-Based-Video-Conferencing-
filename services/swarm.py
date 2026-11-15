"""Telemetry-Driven Channel Impairment Analysis & Autonomous Swarm Micro-SFU Election.

Implements Patent Sections 9.3, 9.4, and 9.5 (Claims 1, 4, 5, 7, 8, 9, 14, 15):
  1. Composite Channel Impairment Index (CI):
       CI = 0.40*(PLF / 0.30) + 0.25*(Jitter / 200) + 0.20*(RTT / 300) + 0.15*(CPU / 100)
     Maps CI into Table 1 operational states:
       - Level 0 (Nominal, CI < 0.25)        : WebRTC P2P Mesh, no extra FEC
       - Level 1 (Degraded, 0.25 <= CI < 0.60): Hybrid UDP + (8, 6) RS Parity FEC
       - Level 2 (Severe, CI >= 0.60)        : Full UDP Fallback + (10, 6) RS Parity FEC
  2. Node Capability Score (NCS) & Autonomous Super-Peer Election:
       NCS_i = w1 * norm(Uplink_BW_i) + w2 * norm(1 / Avg_RTT_i) + w3 * (1 - CPU_util_i / 100)
     When room size > SWARM_THRESHOLD (5 participants), transitions topology from
     'full_mesh' to 'swarm_micro_sfu' and elects the highest-NCS participant as
     Super-Peer (with runner-up pre-selected for <150ms instant failover).
"""
from typing import Dict, List, Optional

# Patent Section 9.3 weighting coefficients (alpha + beta + gamma + delta = 1.0)
ALPHA_PLF = 0.40
BETA_JITTER = 0.25
GAMMA_RTT = 0.20
DELTA_CPU = 0.15

PLF_MAX = 0.30       # 30% packet loss normalization ceiling
JITTER_MAX_MS = 200.0
RTT_MAX_MS = 300.0

# Patent Section 9.5 Super-Peer election threshold & NCS weights
SWARM_THRESHOLD = 5
W1_UPLINK = 0.45
W2_RTT = 0.35
W3_CPU = 0.20
UPLINK_REF_KBPS = 4000.0


def clamp(val: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, val))


def compute_channel_impairment(
    plf: float = 0.0,
    jitter_ms: float = 0.0,
    rtt_ms: float = 30.0,
    cpu_util_pct: float = 20.0,
) -> dict:
    """Compute the patent Channel Impairment Index (CI) and transport policy."""
    norm_plf = clamp(float(plf) / PLF_MAX)
    norm_jitter = clamp(float(jitter_ms) / JITTER_MAX_MS)
    norm_rtt = clamp(float(rtt_ms) / RTT_MAX_MS)
    norm_cpu = clamp(float(cpu_util_pct) / 100.0)

    ci = round(
        ALPHA_PLF * norm_plf
        + BETA_JITTER * norm_jitter
        + GAMMA_RTT * norm_rtt
        + DELTA_CPU * norm_cpu,
        4,
    )

    if ci < 0.25:
        level = 0
        state_name = 'nominal'
        route = 'webrtc_mesh'
        fec = None
    elif ci < 0.60:
        level = 1
        state_name = 'degraded'
        route = 'hybrid_udp_fec'
        fec = {'n': 8, 'k': 6, 'code': 'RS(8,6)'}
    else:
        level = 2
        state_name = 'severe'
        route = 'udp_fallback_fec'
        fec = {'n': 10, 'k': 6, 'code': 'RS(10,6)'}

    return {
        'ci': ci,
        'level': level,
        'state': state_name,
        'route': route,
        'fec': fec,
    }


def compute_node_capability_score(
    uplink_kbps: float = 2500.0,
    avg_rtt_ms: float = 40.0,
    cpu_util_pct: float = 25.0,
) -> float:
    """Compute normalized Node Capability Score (NCS, 0..100) per Patent Section 9.5."""
    bw_norm = clamp(float(uplink_kbps) / UPLINK_REF_KBPS)
    # Inverse RTT: 10ms -> 1.0, 100ms -> 0.25, 300ms -> 0.08
    safe_rtt = max(10.0, float(avg_rtt_ms))
    inv_rtt_norm = clamp(25.0 / safe_rtt)
    cpu_headroom_norm = clamp((100.0 - float(cpu_util_pct)) / 100.0)

    ncs = 100.0 * (
        W1_UPLINK * bw_norm
        + W2_RTT * inv_rtt_norm
        + W3_CPU * cpu_headroom_norm
    )
    return round(ncs, 2)


def evaluate_swarm_topology(participants: List[Dict], threshold: int = SWARM_THRESHOLD) -> dict:
    """Elect the optimal Super-Peer (and failover backup) by highest NCS score.

    When participant count > `threshold` (5), switches room mode from 'full_mesh'
    to 'swarm_micro_sfu' so non-elected peers route uplinks via the Super-Peer
    (O(N) bandwidth scaling instead of O(N^2)).
    """
    count = len(participants)
    if count == 0:
        return {
            'mode': 'full_mesh',
            'participantCount': 0,
            'superPeerId': None,
            'backupSuperPeerId': None,
            'scores': {},
        }

    ranked = sorted(
        participants,
        key=lambda p: (
            float((p.get('telemetry') or {}).get('ncs', 50.0)),
            1 if p.get('isHost') else 0,
            -float(p.get('joinedAt', 0.0)),
        ),
        reverse=True,
    )

    super_peer_id: Optional[str] = ranked[0]['userId'] if ranked else None
    backup_peer_id: Optional[str] = ranked[1]['userId'] if len(ranked) > 1 else None
    mode = 'swarm_micro_sfu' if count > threshold else 'full_mesh'

    return {
        'mode': mode,
        'participantCount': count,
        'superPeerId': super_peer_id,
        'backupSuperPeerId': backup_peer_id,
        'scores': {
            p['userId']: float((p.get('telemetry') or {}).get('ncs', 50.0))
            for p in participants
        },
    }
