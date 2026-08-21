from flask_socketio import emit, join_room, leave_room, rooms
from flask_jwt_extended import decode_token
from database import db
from models.participant import Participant
from models.message import Message
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

active_meetings = {}
meeting_state_store = {}  # { meeting_id: { polls: [], qas: [], whiteboard: [], host_locks: {...}, recording: False, breakouts: [], active_presenter: None } }

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
                'video_disabled': False
            },
            'recording': False,
            'breakouts': [],
            'active_presenter': None
        }
    return meeting_state_store[meeting_id]

def setup_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect(auth):
        try:
            token = auth.get('token') if auth else None
            if not token:
                return False
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            from models.user import User
            user = User.query.get(user_id)
            if not user:
                return False
            from flask import session
            session['user_id'] = user.id
            session['user_name'] = user.name
            logger.info(f'Client connected: {user.name} ({user.id})')
            return True
        except Exception as e:
            logger.error(f'Connection failed: {str(e)}')
            return False

    @socketio.on('join_meeting')
    def handle_join_meeting(data):
        meeting_id = data.get('meetingId')
        join_room(meeting_id)
        
        if meeting_id not in active_meetings:
            active_meetings[meeting_id] = []
        
        from flask import request, session
        user_id = session.get('user_id', request.sid)
        user_name = session.get('user_name', data.get('userName', 'Anonymous'))
        
        state = get_or_create_meeting_state(meeting_id)
        
        # Get list of existing users in the room
        existing_users = [
            {
                'userId': u['sid'], 
                'userName': u['userName'], 
                'dbUserId': u['dbUserId'],
                'handRaised': u.get('handRaised', False),
                'videoEnabled': u.get('videoEnabled', True),
                'audioEnabled': u.get('audioEnabled', True)
            }
            for u in active_meetings[meeting_id]
        ]
        
        # Add current user to active list if not already there
        user_entry = next((u for u in active_meetings[meeting_id] if u['sid'] == request.sid), None)
        if not user_entry:
            user_entry = {
                'sid': request.sid,
                'userName': user_name,
                'dbUserId': user_id,
                'handRaised': False,
                'videoEnabled': data.get('videoEnabled', True),
                'audioEnabled': data.get('audioEnabled', True)
            }
            active_meetings[meeting_id].append(user_entry)
        
        emit('user_joined', {
            'userId': request.sid,
            'userName': user_name,
            'dbUserId': user_id,
            'handRaised': False,
            'videoEnabled': data.get('videoEnabled', True),
            'audioEnabled': data.get('audioEnabled', True)
        }, room=meeting_id, skip_sid=request.sid)
        
        emit('current_users', {'users': existing_users})
        
        # Send current meeting activities state & active presenter
        emit('sync_meeting_state', {
            'polls': state['polls'],
            'qas': state['qas'],
            'host_locks': state['host_locks'],
            'recording': state['recording'],
            'active_presenter': state.get('active_presenter'),
            'whiteboard': state['whiteboard'][-200:] if state['whiteboard'] else []
        })
        
        logger.info(f'User {user_name} joined meeting {meeting_id}. Active users: {len(active_meetings[meeting_id])}')

    @socketio.on('offer')
    def handle_offer(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('offer', {
            'from': request.sid,
            'offer': data.get('offer'),
            'streamType': data.get('streamType', 'media')
        }, to=to_user)

    @socketio.on('answer')
    def handle_answer(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('answer', {
            'from': request.sid,
            'answer': data.get('answer'),
            'streamType': data.get('streamType', 'media')
        }, to=to_user)

    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('ice_candidate', {
            'from': request.sid,
            'candidate': data.get('candidate'),
            'streamType': data.get('streamType', 'media')
        }, to=to_user)

    @socketio.on('screen_share_status')
    def handle_screen_share_status(data):
        from flask import request, session
        meeting_id = data.get('meetingId')
        if meeting_id:
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            is_sharing = data.get('isSharing', False)
            state = get_or_create_meeting_state(meeting_id)
            
            if is_sharing:
                state['active_presenter'] = {
                    'userId': request.sid,
                    'userName': user_name
                }
            else:
                if state.get('active_presenter', {}).get('userId') == request.sid:
                    state['active_presenter'] = None

            emit('peer_screen_share_changed', {
                'userId': request.sid,
                'userName': user_name,
                'isSharing': is_sharing
            }, room=meeting_id, skip_sid=request.sid)

    @socketio.on('send_chat')
    def handle_send_chat(data):
        meeting_id = data.get('meetingId')
        if meeting_id:
            from models.message import Message
            from database import db
            from flask import session, request
            
            state = get_or_create_meeting_state(meeting_id)
            if state['host_locks'].get('chat_disabled', False):
                return
            
            user_id = session.get('user_id')
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            
            if user_id:
                try:
                    msg = Message(
                        author_id=user_id,
                        meeting_id=meeting_id,
                        content=data.get('message')
                    )
                    db.session.add(msg)
                    db.session.commit()
                except Exception as e:
                    logger.error(f'Error saving chat message: {str(e)}')
            
            chat_payload = {
                'id': data.get('id', datetime.now().isoformat()),
                'userId': request.sid,
                'userName': user_name,
                'message': data.get('message'),
                'timestamp': datetime.now().strftime('%I:%M %p')
            }
            emit('chat_message', chat_payload, room=meeting_id)

    @socketio.on('send_reaction')
    def handle_send_reaction(data):
        from flask import request, session
        meeting_id = data.get('meetingId')
        if meeting_id:
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            emit('user_reaction', {
                'id': f"rx_{datetime.now().timestamp()}_{request.sid}",
                'userId': request.sid,
                'userName': user_name,
                'emoji': data.get('emoji', '👍')
            }, room=meeting_id)

    @socketio.on('toggle_media')
    def handle_toggle_media(data):
        from flask import request
        meeting_id = data.get('meetingId')
        if meeting_id:
            if meeting_id in active_meetings:
                for u in active_meetings[meeting_id]:
                    if u['sid'] == request.sid:
                        if 'videoEnabled' in data:
                            u['videoEnabled'] = data['videoEnabled']
                        if 'audioEnabled' in data:
                            u['audioEnabled'] = data['audioEnabled']
            
            emit('peer_media_changed', {
                'userId': request.sid,
                'videoEnabled': data.get('videoEnabled'),
                'audioEnabled': data.get('audioEnabled')
            }, room=meeting_id, skip_sid=request.sid)

    @socketio.on('toggle_hand')
    def handle_toggle_hand(data):
        from flask import request, session
        meeting_id = data.get('meetingId')
        if meeting_id:
            hand_raised = data.get('handRaised', False)
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            
            if meeting_id in active_meetings:
                for u in active_meetings[meeting_id]:
                    if u['sid'] == request.sid:
                        u['handRaised'] = hand_raised
            
            emit('peer_hand_changed', {
                'userId': request.sid,
                'userName': user_name,
                'handRaised': hand_raised,
                'timestamp': datetime.now().isoformat()
            }, room=meeting_id)

    @socketio.on('live_caption')
    def handle_live_caption(data):
        from flask import request, session
        meeting_id = data.get('meetingId')
        if meeting_id:
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            emit('caption_received', {
                'userId': request.sid,
                'userName': user_name,
                'text': data.get('text', ''),
                'isFinal': data.get('isFinal', True)
            }, room=meeting_id, skip_sid=request.sid)

    @socketio.on('create_poll')
    def handle_create_poll(data):
        meeting_id = data.get('meetingId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            poll = {
                'id': data.get('id', f"poll_{len(state['polls'])+1}"),
                'question': data.get('question'),
                'options': [{'text': opt, 'votes': 0} for opt in data.get('options', [])],
                'creator': data.get('creator', 'Host'),
                'isActive': True,
                'votedUsers': {}
            }
            state['polls'].append(poll)
            emit('poll_updated', {'polls': state['polls']}, room=meeting_id)

    @socketio.on('vote_poll')
    def handle_vote_poll(data):
        from flask import request
        meeting_id = data.get('meetingId')
        poll_id = data.get('pollId')
        option_idx = data.get('optionIndex')
        
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            for poll in state['polls']:
                if poll['id'] == poll_id and poll['isActive']:
                    prev_vote = poll['votedUsers'].get(request.sid)
                    if prev_vote is not None and 0 <= prev_vote < len(poll['options']):
                        poll['options'][prev_vote]['votes'] = max(0, poll['options'][prev_vote]['votes'] - 1)
                    
                    if 0 <= option_idx < len(poll['options']):
                        poll['options'][option_idx]['votes'] += 1
                        poll['votedUsers'][request.sid] = option_idx
            
            emit('poll_updated', {'polls': state['polls']}, room=meeting_id)

    @socketio.on('end_poll')
    def handle_end_poll(data):
        meeting_id = data.get('meetingId')
        poll_id = data.get('pollId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            for poll in state['polls']:
                if poll['id'] == poll_id:
                    poll['isActive'] = False
            emit('poll_updated', {'polls': state['polls']}, room=meeting_id)

    @socketio.on('submit_qa')
    def handle_submit_qa(data):
        from flask import request, session
        meeting_id = data.get('meetingId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            user_name = session.get('user_name', data.get('userName', 'Participant'))
            qa_item = {
                'id': data.get('id', f"qa_{len(state['qas'])+1}"),
                'author': user_name,
                'authorId': request.sid,
                'question': data.get('question'),
                'upvotes': 0,
                'upvotedBy': [],
                'isAnswered': False,
                'timestamp': datetime.now().strftime('%I:%M %p')
            }
            state['qas'].append(qa_item)
            emit('qa_updated', {'qas': state['qas']}, room=meeting_id)

    @socketio.on('upvote_qa')
    def handle_upvote_qa(data):
        from flask import request
        meeting_id = data.get('meetingId')
        qa_id = data.get('qaId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            for item in state['qas']:
                if item['id'] == qa_id:
                    if request.sid in item['upvotedBy']:
                        item['upvotedBy'].remove(request.sid)
                        item['upvotes'] = max(0, item['upvotes'] - 1)
                    else:
                        item['upvotedBy'].append(request.sid)
                        item['upvotes'] += 1
            emit('qa_updated', {'qas': state['qas']}, room=meeting_id)

    @socketio.on('answer_qa')
    def handle_answer_qa(data):
        meeting_id = data.get('meetingId')
        qa_id = data.get('qaId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            for item in state['qas']:
                if item['id'] == qa_id:
                    item['isAnswered'] = data.get('isAnswered', True)
            emit('qa_updated', {'qas': state['qas']}, room=meeting_id)

    @socketio.on('whiteboard_draw')
    def handle_whiteboard_draw(data):
        from flask import request
        meeting_id = data.get('meetingId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            stroke = data.get('stroke')
            if stroke:
                state['whiteboard'].append(stroke)
                if len(state['whiteboard']) > 1000:
                    state['whiteboard'] = state['whiteboard'][-500:]
            emit('whiteboard_stroke', {'stroke': stroke}, room=meeting_id, skip_sid=request.sid)

    @socketio.on('whiteboard_clear')
    def handle_whiteboard_clear(data):
        meeting_id = data.get('meetingId')
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            state['whiteboard'] = []
            emit('whiteboard_cleared', {}, room=meeting_id)

    @socketio.on('host_action')
    def handle_host_action(data):
        meeting_id = data.get('meetingId')
        action = data.get('action')
        target_user = data.get('targetUserId')
        
        if meeting_id:
            state = get_or_create_meeting_state(meeting_id)
            
            if action == 'lock_toggle':
                lock_type = data.get('lockType')
                value = data.get('value', False)
                if lock_type in state['host_locks']:
                    state['host_locks'][lock_type] = value
                emit('host_locks_updated', {'host_locks': state['host_locks']}, room=meeting_id)
            elif action == 'recording_toggle':
                state['recording'] = data.get('isRecording', False)
                emit('recording_state_changed', {'isRecording': state['recording']}, room=meeting_id)
            else:
                emit('host_command', {
                    'action': action,
                    'targetUserId': target_user
                }, room=meeting_id)

    @socketio.on('leave_meeting')
    def handle_leave_meeting(data):
        from flask import request
        meeting_id = data.get('meetingId')
        leave_room(meeting_id)
        
        if meeting_id in active_meetings:
            active_meetings[meeting_id] = [u for u in active_meetings[meeting_id] if u['sid'] != request.sid]
            state = meeting_state_store.get(meeting_id)
            if state and state.get('active_presenter', {}).get('userId') == request.sid:
                state['active_presenter'] = None
                emit('peer_screen_share_changed', {
                    'userId': request.sid,
                    'userName': 'Presenter',
                    'isSharing': False
                }, room=meeting_id)

            if not active_meetings[meeting_id]:
                del active_meetings[meeting_id]
                if meeting_id in meeting_state_store:
                    del meeting_state_store[meeting_id]
        
        emit('user_left', {'userId': request.sid}, room=meeting_id)
        logger.info(f'User left meeting {meeting_id}')

    @socketio.on('disconnect')
    def handle_disconnect():
        from flask import request
        for meeting_id, users in list(active_meetings.items()):
            user_in_room = any(u['sid'] == request.sid for u in users)
            if user_in_room:
                active_meetings[meeting_id] = [u for u in users if u['sid'] != request.sid]
                state = meeting_state_store.get(meeting_id)
                if state and state.get('active_presenter', {}).get('userId') == request.sid:
                    state['active_presenter'] = None
                    emit('peer_screen_share_changed', {
                        'userId': request.sid,
                        'userName': 'Presenter',
                        'isSharing': False
                    }, room=meeting_id)

                if not active_meetings[meeting_id]:
                    del active_meetings[meeting_id]
                    if meeting_id in meeting_state_store:
                        del meeting_state_store[meeting_id]
                else:
                    emit('user_left', {'userId': request.sid}, room=meeting_id)
        logger.info(f'Client disconnected: {request.sid}')
