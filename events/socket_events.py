"""Socket.IO signaling and live meeting state.

Design rules:
  * A room is always the meeting's database id (resolved server-side).
  * `services.presence` is the only record of who is in a meeting. After every
    change the full roster is broadcast (`roster_update`) and clients reconcile
    against it, so a missed event can never leave a ghost participant.
  * Handlers take the room from the caller's registered session, never from a
    client-supplied meeting id.
"""
import logging
from datetime import datetime

from flask import request, session
from flask_jwt_extended import decode_token
from flask_socketio import emit, join_room, leave_room, disconnect

from database import db
from models.meeting import Meeting
from models.message import Message
from models.participant import Participant
from models.user import User
from services.presence import presence

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CHAT_HISTORY_LIMIT = 100
MAX_CHAT_LENGTH = 2000
MAX_CAPTION_LENGTH = 500

# Collaboration state that lives only while a meeting has participants.
meeting_state_store = {}


def get_or_create_meeting_state(meeting_id):
    if meeting_id not in meeting_state_store:
        meeting_state_store[meeting_id] = {
            'polls': [],
            'qas': [],
            'whiteboard': [],
            'host_locks': {
                'chat_disabled': False,
                'screenshare_disabled': False,
                'mic_disabled': False,
                'video_disabled': False,
            },
            'recording': None,  # {'userId', 'userName'} while someone records
        }
    return meeting_state_store[meeting_id]


def lobby_room(meeting_id):
    return f'lobby:{meeting_id}'


def resolve_meeting(raw_id):
    """Map any identifier a client may hold (db id, code, dashed code) to a Meeting."""
    if not raw_id:
        return None
    raw_id = str(raw_id).strip()
    meeting = db.session.get(Meeting, raw_id)
    if meeting:
        return meeting
    code = ''.join(ch for ch in raw_id if ch.isalnum()).upper()
    if code:
        meeting = Meeting.query.filter_by(meeting_code=code).first()
        if meeting:
            return meeting
    return Meeting.query.filter(db.func.lower(Meeting.id) == raw_id.lower()).first()


def presence_payload(meeting_id):
    roster = presence.roster(meeting_id)
    return {
        'meetingId': meeting_id,
        'count': len(roster),
        'participants': [{'userName': p['userName'], 'isHost': p['isHost']} for p in roster],
    }


def iso_utc(dt):
    return dt.replace(microsecond=0).isoformat() + 'Z'


def setup_socket_events(socketio):

    def broadcast_roster(meeting_id):
        socketio.emit('roster_update', {'participants': presence.roster(meeting_id)}, to=meeting_id)
        socketio.emit('presence_update', presence_payload(meeting_id), to=lobby_room(meeting_id))

    def broadcast_captions_demand(meeting_id):
        socketio.emit('captions_demand', {'active': presence.any_wants_captions(meeting_id)}, to=meeting_id)

    def mark_left_in_db(entry, meeting_id):
        if not entry or not entry.get('dbUserId'):
            return
        try:
            row = Participant.query.filter_by(user_id=entry['dbUserId'], meeting_id=meeting_id).first()
            if row:
                row.left_at = datetime.utcnow()
                db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception('Could not record leave time')

    def remove_participant(sid):
        """Take a socket out of its meeting and tell everyone. Safe to call twice."""
        meeting_id, entry = presence.leave(sid)
        if meeting_id is None:
            return
        try:
            leave_room(meeting_id, sid=sid)
        except Exception:
            pass
        mark_left_in_db(entry, meeting_id)

        state = meeting_state_store.get(meeting_id)
        if state and state.get('recording') and state['recording'].get('userId') == sid:
            state['recording'] = None
            socketio.emit('recording_state_changed', {'recording': None}, to=meeting_id)

        if presence.is_empty(meeting_id):
            meeting_state_store.pop(meeting_id, None)
        else:
            broadcast_captions_demand(meeting_id)
        broadcast_roster(meeting_id)
        logger.info('%s left meeting %s (%d remaining)',
                    (entry or {}).get('userName'), meeting_id, presence.count(meeting_id))

    def caller():
        """(meeting_id, entry) for the calling socket, or (None, None) if not in a meeting."""
        entry = presence.get(request.sid)
        if not entry:
            return None, None
        return presence.room_of(request.sid), entry

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------
    @socketio.on('connect')
    def handle_connect(auth):
        try:
            token = auth.get('token') if auth else None
            if not token:
                return False
            user_id = decode_token(token).get('sub')
            user = db.session.get(User, user_id)
            if not user:
                return False
            session['user_id'] = user.id
            session['user_name'] = user.name
            return True
        except Exception as exc:
            logger.warning('Socket connection rejected: %s', exc)
            return False

    @socketio.on('disconnect')
    def handle_disconnect(*_args):
        remove_participant(request.sid)

    # ------------------------------------------------------------------
    # Lobby presence (before joining)
    # ------------------------------------------------------------------
    @socketio.on('watch_meeting')
    def handle_watch_meeting(data):
        meeting = resolve_meeting((data or {}).get('meetingId'))
        if not meeting:
            emit('meeting_error', {'code': 'not_found', 'message': 'This meeting does not exist.'})
            return
        join_room(lobby_room(meeting.id))
        emit('presence_update', presence_payload(meeting.id))

    # ------------------------------------------------------------------
    # Join / leave
    # ------------------------------------------------------------------
    @socketio.on('join_meeting')
    def handle_join_meeting(data):
        data = data or {}
        user_id = session.get('user_id')
        meeting = resolve_meeting(data.get('meetingId'))
        if not meeting or not user_id:
            emit('meeting_error', {'code': 'not_found', 'message': 'This meeting does not exist.'})
            return
        meeting_id = meeting.id

        # A socket can only be in one meeting.
        if presence.room_of(request.sid) not in (None, meeting_id):
            remove_participant(request.sid)

        evicted = presence.join(meeting_id, request.sid, {
            'clientId': str(data.get('clientId') or '')[:64],
            'dbUserId': user_id,
            'userName': session.get('user_name') or 'Participant',
            'isHost': meeting.creator_id == user_id,
            'audioEnabled': bool(data.get('audioEnabled', True)),
            'videoEnabled': bool(data.get('videoEnabled', True)),
            'handRaised': False,
            'cameraStreamId': data.get('cameraStreamId'),
            'screenStreamId': None,
            'captions': False,
        })
        for stale_sid in evicted:
            # Same browser tab came back on a new socket: drop the old one.
            try:
                leave_room(meeting_id, sid=stale_sid)
                socketio.emit('session_replaced', {}, to=stale_sid)
                disconnect(sid=stale_sid)
            except Exception:
                pass

        leave_room(lobby_room(meeting_id))
        join_room(meeting_id)

        # Persist attendance so the meeting shows up in the user's history.
        try:
            row = Participant.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
            if row is None:
                db.session.add(Participant(user_id=user_id, meeting_id=meeting_id))
            else:
                row.left_at = None
            db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception('Could not record attendance')

        history = (Message.query.filter_by(meeting_id=meeting_id)
                   .order_by(Message.created_at.desc()).limit(CHAT_HISTORY_LIMIT).all())
        state = get_or_create_meeting_state(meeting_id)

        emit('joined', {
            'selfId': request.sid,
            'meeting': meeting.to_dict(),
            'isHost': meeting.creator_id == user_id,
            'participants': presence.roster(meeting_id),
            'chatHistory': [
                {
                    'id': m.id,
                    'authorId': m.author_id,
                    'userName': m.author.name if m.author else 'Participant',
                    'message': m.content,
                    'createdAt': iso_utc(m.created_at),
                }
                for m in reversed(history)
            ],
            'state': {
                'polls': state['polls'],
                'qas': state['qas'],
                'host_locks': state['host_locks'],
                'recording': state['recording'],
                'whiteboard': state['whiteboard'][-200:],
                'captionsDemand': presence.any_wants_captions(meeting_id),
            },
        })
        broadcast_roster(meeting_id)
        logger.info('%s joined meeting %s (%d present)',
                    session.get('user_name'), meeting_id, presence.count(meeting_id))

    @socketio.on('leave_meeting')
    def handle_leave_meeting(_data=None):
        remove_participant(request.sid)

    # ------------------------------------------------------------------
    # WebRTC signaling relay
    # ------------------------------------------------------------------
    @socketio.on('signal')
    def handle_signal(data):
        target = (data or {}).get('to')
        # Only relay between two sockets that are in the same meeting.
        if not target or not presence.same_room(request.sid, target):
            return
        socketio.emit('signal', {'from': request.sid, 'data': data.get('data')}, to=target)

    # ------------------------------------------------------------------
    # Per-participant state (all reflected in the roster)
    # ------------------------------------------------------------------
    @socketio.on('media_state')
    def handle_media_state(data):
        data = data or {}
        fields = {}
        for key in ('audioEnabled', 'videoEnabled'):
            if key in data:
                fields[key] = bool(data[key])
        if 'cameraStreamId' in data:
            fields['cameraStreamId'] = data['cameraStreamId']
        meeting_id = presence.update(request.sid, **fields)
        if meeting_id:
            broadcast_roster(meeting_id)

    @socketio.on('toggle_hand')
    def handle_toggle_hand(data):
        meeting_id = presence.update(request.sid, handRaised=bool((data or {}).get('handRaised')))
        if meeting_id:
            broadcast_roster(meeting_id)

    @socketio.on('screen_share_status')
    def handle_screen_share_status(data):
        data = data or {}
        meeting_id, entry = caller()
        if not meeting_id:
            return
        if data.get('isSharing'):
            state = get_or_create_meeting_state(meeting_id)
            if state['host_locks'].get('screenshare_disabled') and not entry.get('isHost'):
                emit('host_command', {'action': 'stop_presenting', 'reason': 'Screen sharing is disabled by the host.'})
                return
            # One presenter at a time: the newest share takes over.
            for other in presence.roster(meeting_id):
                if other['isPresenting'] and other['userId'] != request.sid:
                    presence.update(other['userId'], screenStreamId=None)
                    socketio.emit('host_command', {
                        'action': 'stop_presenting',
                        'reason': f"{entry.get('userName')} started presenting.",
                    }, to=other['userId'])
            presence.update(request.sid, screenStreamId=data.get('streamId') or 'screen')
        else:
            presence.update(request.sid, screenStreamId=None)
        broadcast_roster(meeting_id)

    # ------------------------------------------------------------------
    # Chat, reactions, captions
    # ------------------------------------------------------------------
    @socketio.on('send_chat')
    def handle_send_chat(data):
        meeting_id, entry = caller()
        text_body = str((data or {}).get('message') or '').strip()[:MAX_CHAT_LENGTH]
        if not meeting_id or not text_body:
            return
        state = get_or_create_meeting_state(meeting_id)
        if state['host_locks'].get('chat_disabled') and not entry.get('isHost'):
            return

        message_id = None
        created = datetime.utcnow()
        try:
            msg = Message(author_id=entry['dbUserId'], meeting_id=meeting_id, content=text_body)
            db.session.add(msg)
            db.session.commit()
            message_id, created = msg.id, msg.created_at
        except Exception:
            db.session.rollback()
            logger.exception('Could not save chat message')

        emit('chat_message', {
            'id': message_id or f'{request.sid}-{created.timestamp()}',
            'userId': request.sid,
            'authorId': entry['dbUserId'],
            'userName': entry['userName'],
            'message': text_body,
            'createdAt': iso_utc(created),
        }, to=meeting_id)

    @socketio.on('send_reaction')
    def handle_send_reaction(data):
        meeting_id, entry = caller()
        if not meeting_id:
            return
        emit('user_reaction', {
            'id': f'rx_{datetime.utcnow().timestamp()}_{request.sid}',
            'userId': request.sid,
            'userName': entry['userName'],
            'emoji': str((data or {}).get('emoji', '👍'))[:8],
        }, to=meeting_id)

    @socketio.on('captions_toggle')
    def handle_captions_toggle(data):
        meeting_id = presence.update(request.sid, captions=bool((data or {}).get('enabled')))
        if meeting_id:
            broadcast_captions_demand(meeting_id)

    @socketio.on('live_caption')
    def handle_live_caption(data):
        meeting_id, entry = caller()
        text_body = str((data or {}).get('text') or '').strip()[:MAX_CAPTION_LENGTH]
        if not meeting_id or not text_body:
            return
        emit('caption_received', {
            'userId': request.sid,
            'userName': entry['userName'],
            'text': text_body,
            'isFinal': bool(data.get('isFinal', True)),
        }, to=meeting_id, skip_sid=request.sid)

    # ------------------------------------------------------------------
    # Activities (polls, Q&A, whiteboard)
    # ------------------------------------------------------------------
    @socketio.on('create_poll')
    def handle_create_poll(data):
        meeting_id, entry = caller()
        data = data or {}
        options = [str(opt).strip()[:200] for opt in data.get('options', []) if str(opt).strip()]
        question = str(data.get('question') or '').strip()[:500]
        if not meeting_id or not question or len(options) < 2:
            return
        state = get_or_create_meeting_state(meeting_id)
        state['polls'].append({
            'id': data.get('id') or f"poll_{len(state['polls']) + 1}_{int(datetime.utcnow().timestamp())}",
            'question': question,
            'options': [{'text': opt, 'votes': 0} for opt in options],
            'creator': entry['userName'],
            'isActive': True,
            'votedUsers': {},
        })
        emit('poll_updated', {'polls': state['polls']}, to=meeting_id)

    @socketio.on('vote_poll')
    def handle_vote_poll(data):
        meeting_id, entry = caller()
        data = data or {}
        option_idx = data.get('optionIndex')
        if not meeting_id or not isinstance(option_idx, int):
            return
        voter = entry['dbUserId']  # one vote per account, survives reconnects
        state = get_or_create_meeting_state(meeting_id)
        for poll in state['polls']:
            if poll['id'] == data.get('pollId') and poll['isActive'] and 0 <= option_idx < len(poll['options']):
                prev_vote = poll['votedUsers'].get(voter)
                if prev_vote is not None and 0 <= prev_vote < len(poll['options']):
                    poll['options'][prev_vote]['votes'] = max(0, poll['options'][prev_vote]['votes'] - 1)
                poll['options'][option_idx]['votes'] += 1
                poll['votedUsers'][voter] = option_idx
        emit('poll_updated', {'polls': state['polls']}, to=meeting_id)

    @socketio.on('end_poll')
    def handle_end_poll(data):
        meeting_id, _entry = caller()
        if not meeting_id:
            return
        state = get_or_create_meeting_state(meeting_id)
        for poll in state['polls']:
            if poll['id'] == (data or {}).get('pollId'):
                poll['isActive'] = False
        emit('poll_updated', {'polls': state['polls']}, to=meeting_id)

    @socketio.on('submit_qa')
    def handle_submit_qa(data):
        meeting_id, entry = caller()
        question = str((data or {}).get('question') or '').strip()[:1000]
        if not meeting_id or not question:
            return
        state = get_or_create_meeting_state(meeting_id)
        state['qas'].append({
            'id': f"qa_{len(state['qas']) + 1}_{int(datetime.utcnow().timestamp())}",
            'author': entry['userName'],
            'authorId': entry['dbUserId'],
            'question': question,
            'upvotes': 0,
            'upvotedBy': [],
            'isAnswered': False,
            'createdAt': iso_utc(datetime.utcnow()),
        })
        emit('qa_updated', {'qas': state['qas']}, to=meeting_id)

    @socketio.on('upvote_qa')
    def handle_upvote_qa(data):
        meeting_id, entry = caller()
        if not meeting_id:
            return
        voter = entry['dbUserId']
        state = get_or_create_meeting_state(meeting_id)
        for item in state['qas']:
            if item['id'] == (data or {}).get('qaId'):
                if voter in item['upvotedBy']:
                    item['upvotedBy'].remove(voter)
                else:
                    item['upvotedBy'].append(voter)
                item['upvotes'] = len(item['upvotedBy'])
        emit('qa_updated', {'qas': state['qas']}, to=meeting_id)

    @socketio.on('answer_qa')
    def handle_answer_qa(data):
        meeting_id, _entry = caller()
        if not meeting_id:
            return
        state = get_or_create_meeting_state(meeting_id)
        for item in state['qas']:
            if item['id'] == (data or {}).get('qaId'):
                item['isAnswered'] = bool((data or {}).get('isAnswered', True))
        emit('qa_updated', {'qas': state['qas']}, to=meeting_id)

    @socketio.on('whiteboard_draw')
    def handle_whiteboard_draw(data):
        meeting_id, _entry = caller()
        stroke = (data or {}).get('stroke')
        if not meeting_id or not stroke:
            return
        state = get_or_create_meeting_state(meeting_id)
        state['whiteboard'].append(stroke)
        if len(state['whiteboard']) > 1000:
            state['whiteboard'] = state['whiteboard'][-500:]
        emit('whiteboard_stroke', {'stroke': stroke}, to=meeting_id, skip_sid=request.sid)

    @socketio.on('whiteboard_clear')
    def handle_whiteboard_clear(_data=None):
        meeting_id, _entry = caller()
        if not meeting_id:
            return
        get_or_create_meeting_state(meeting_id)['whiteboard'] = []
        emit('whiteboard_cleared', {}, to=meeting_id)

    # ------------------------------------------------------------------
    # Recording notice (the recording itself happens in the recorder's browser)
    # ------------------------------------------------------------------
    @socketio.on('recording_status')
    def handle_recording_status(data):
        meeting_id, entry = caller()
        if not meeting_id:
            return
        state = get_or_create_meeting_state(meeting_id)
        if (data or {}).get('isRecording'):
            state['recording'] = {'userId': request.sid, 'userName': entry['userName']}
        elif state['recording'] and state['recording'].get('userId') == request.sid:
            state['recording'] = None
        emit('recording_state_changed', {'recording': state['recording']}, to=meeting_id)

    # ------------------------------------------------------------------
    # Host moderation (verified server-side)
    # ------------------------------------------------------------------
    @socketio.on('host_action')
    def handle_host_action(data):
        data = data or {}
        meeting_id, entry = caller()
        if not meeting_id or not entry.get('isHost'):
            emit('host_command', {'action': 'denied', 'reason': 'Only the host can do that.'})
            return
        action = data.get('action')
        target = data.get('targetUserId')
        state = get_or_create_meeting_state(meeting_id)
        target_ok = bool(target) and target != request.sid and presence.same_room(request.sid, target)

        if action == 'lock_toggle':
            lock_type = data.get('lockType')
            if lock_type in state['host_locks']:
                state['host_locks'][lock_type] = bool(data.get('value'))
            emit('host_locks_updated', {'host_locks': state['host_locks']}, to=meeting_id)
        elif action == 'mute_user' and target_ok:
            socketio.emit('host_command', {'action': 'mute', 'by': entry['userName']}, to=target)
        elif action == 'mute_all':
            for sid in presence.sids(meeting_id):
                if sid != request.sid:
                    socketio.emit('host_command', {'action': 'mute', 'by': entry['userName']}, to=sid)
        elif action == 'remove_user' and target_ok:
            socketio.emit('host_command', {'action': 'removed', 'by': entry['userName']}, to=target)
            remove_participant(target)
        elif action == 'end_meeting_for_all':
            socketio.emit('meeting_ended', {'by': entry['userName']}, to=meeting_id, skip_sid=request.sid)
            for sid in presence.sids(meeting_id):
                remove_participant(sid)
