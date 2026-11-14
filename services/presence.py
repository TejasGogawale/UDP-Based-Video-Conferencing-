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
            return [
                {
                    'userId': e['sid'],
                    'dbUserId': e.get('dbUserId'),
                    'userName': e.get('userName') or 'Participant',
                    'isHost': bool(e.get('isHost')),
                    'audioEnabled': bool(e.get('audioEnabled', True)),
                    'videoEnabled': bool(e.get('videoEnabled', True)),
                    'handRaised': bool(e.get('handRaised', False)),
                    'isPresenting': bool(e.get('screenStreamId')),
                    'screenStreamId': e.get('screenStreamId'),
                    'cameraStreamId': e.get('cameraStreamId'),
                }
                for e in entries
            ]

    def any_wants_captions(self, meeting_id):
        with self._lock:
            return any(e.get('captions') for e in self._rooms.get(meeting_id, {}).values())


presence = PresenceRegistry()
