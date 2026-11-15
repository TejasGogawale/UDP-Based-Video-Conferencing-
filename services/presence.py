"""Single source of truth for who is in a live meeting.

Everything that needs to know the active participants (socket roster
broadcasts, the pre-join lobby count, REST presence, host checks, signaling
authorisation) reads this registry. Rooms are keyed by the meeting's database
id, never by whatever string happened to be in a client's URL.

State lives in process memory, so the backend must run as ONE process
(threads are fine). That matches the current deployment.
"""
import threading
import time
from services.liveness import default_liveness_state, verify_liveness_proof
from services.swarm import (
    compute_channel_impairment,
    compute_node_capability_score,
    evaluate_swarm_topology,
)


class PresenceRegistry:
    def __init__(self):
        self._lock = threading.RLock()
        self._rooms = {}      # meeting_id -> {sid: entry}
        self._sid_room = {}   # sid -> meeting_id

    def join(self, meeting_id, sid, entry):
        """Add a participant. Returns the sids of stale sessions that were
        replaced (same browser tab reconnecting with a new socket)."""
        with self._lock:
            room = self._rooms.setdefault(meeting_id, {})
            evicted = [
                other_sid for other_sid, other in room.items()
                if other_sid != sid and other.get('clientId') and other.get('clientId') == entry.get('clientId')
            ]
            for other_sid in evicted:
                room.pop(other_sid, None)
                self._sid_room.pop(other_sid, None)
            entry = dict(entry, sid=sid, joinedAt=time.time())
            room[sid] = entry
            self._sid_room[sid] = meeting_id
            return evicted

    def leave(self, sid):
        """Remove a participant. Returns (meeting_id, entry) or (None, None)."""
        with self._lock:
            meeting_id = self._sid_room.pop(sid, None)
            if meeting_id is None:
                return None, None
            room = self._rooms.get(meeting_id, {})
            entry = room.pop(sid, None)
            if not room:
                self._rooms.pop(meeting_id, None)
            return meeting_id, entry

    def clear_room(self, meeting_id):
        with self._lock:
            room = self._rooms.pop(meeting_id, {})
            for sid in room:
                self._sid_room.pop(sid, None)
            return list(room.keys())

    def room_of(self, sid):
        with self._lock:
            return self._sid_room.get(sid)

    def get(self, sid):
        with self._lock:
            meeting_id = self._sid_room.get(sid)
            if meeting_id is None:
                return None
            entry = self._rooms.get(meeting_id, {}).get(sid)
            return dict(entry) if entry else None

    def update(self, sid, **fields):
        with self._lock:
            meeting_id = self._sid_room.get(sid)
            if meeting_id is None:
                return None
            entry = self._rooms.get(meeting_id, {}).get(sid)
            if entry is None:
                return None
            entry.update(fields)
            return meeting_id

    def same_room(self, sid_a, sid_b):
        with self._lock:
            room = self._sid_room.get(sid_a)
            return room is not None and room == self._sid_room.get(sid_b)

    def is_empty(self, meeting_id):
        with self._lock:
            return not self._rooms.get(meeting_id)

    def count(self, meeting_id):
        with self._lock:
            return len(self._rooms.get(meeting_id, {}))

    def sids(self, meeting_id):
        with self._lock:
            return list(self._rooms.get(meeting_id, {}).keys())

    def roster(self, meeting_id):
        """Public view of a room, oldest participant first."""
        with self._lock:
            entries = sorted(self._rooms.get(meeting_id, {}).values(), key=lambda e: e['joinedAt'])
            raw_list = [
                {
                    'userId': e['sid'],
                    'dbUserId': e.get('dbUserId'),
                    'userName': e.get('userName') or 'Participant',
                    'isHost': bool(e.get('isHost')),
                    'joinedAt': e.get('joinedAt', 0.0),
                    'audioEnabled': bool(e.get('audioEnabled', True)),
                    'videoEnabled': bool(e.get('videoEnabled', True)),
                    'handRaised': bool(e.get('handRaised', False)),
                    'isPresenting': bool(e.get('screenStreamId')),
                    'screenStreamId': e.get('screenStreamId'),
                    'cameraStreamId': e.get('cameraStreamId'),
                    'liveness': e.get('liveness') or default_liveness_state(),
                    'telemetry': e.get('telemetry') or {
                        'ci': 0.05, 'level': 0, 'state': 'nominal', 'route': 'webrtc_mesh', 'fec': None, 'ncs': 75.0
                    },
                }
                for e in entries
            ]
            swarm = evaluate_swarm_topology(raw_list)
            for item in raw_list:
                item.pop('joinedAt', None)
                item['isSuperPeer'] = item['userId'] == swarm['superPeerId']
                item['isBackupSuperPeer'] = item['userId'] == swarm['backupSuperPeerId']
                item['topologyMode'] = swarm['mode']
            return raw_list

    def update_telemetry(self, sid, data):
        """Compute Channel Impairment Index (CI), Node Capability Score (NCS),
        and re-evaluate the room's Autonomous Swarm Super-Peer topology."""
        data = data or {}
        with self._lock:
            meeting_id = self._sid_room.get(sid)
            if meeting_id is None:
                return None, None, None
            entry = self._rooms.get(meeting_id, {}).get(sid)
            if entry is None:
                return None, None, None
            try:
                plf = float(data.get('plf', 0.0))
                jitter_ms = float(data.get('jitterMs', 0.0))
                rtt_ms = float(data.get('rttMs', 30.0))
                uplink_kbps = float(data.get('uplinkKbps', 2500.0))
                cpu_util_pct = float(data.get('cpuUtilPct', 20.0))
            except (TypeError, ValueError):
                return None, None, None

            impairment = compute_channel_impairment(
                plf=plf, jitter_ms=jitter_ms, rtt_ms=rtt_ms, cpu_util_pct=cpu_util_pct
            )
            ncs = compute_node_capability_score(
                uplink_kbps=uplink_kbps, avg_rtt_ms=rtt_ms, cpu_util_pct=cpu_util_pct
            )
            telemetry = {
                **impairment,
                'ncs': ncs,
                'plf': round(plf, 4),
                'jitterMs': round(jitter_ms, 2),
                'rttMs': round(rtt_ms, 2),
                'uplinkKbps': round(uplink_kbps, 1),
            }
            entry['telemetry'] = telemetry
            current_roster = self.roster(meeting_id)
            swarm = evaluate_swarm_topology(current_roster)
            return meeting_id, telemetry, swarm

    def verify_liveness(self, sid, proof):
        """Verify and record a participant's cryptographic liveness proof."""
        with self._lock:
            meeting_id = self._sid_room.get(sid)
            if meeting_id is None:
                return None, None
            entry = self._rooms.get(meeting_id, {}).get(sid)
            if entry is None:
                return None, None
            result = verify_liveness_proof(entry, proof)
            entry['liveness'] = result
            return meeting_id, result

    def any_wants_captions(self, meeting_id):
        with self._lock:
            return any(e.get('captions') for e in self._rooms.get(meeting_id, {}).values())


presence = PresenceRegistry()
