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
        user_name = session.get('user_name', 'Anonymous')
        
        # Get list of existing users in the room
        existing_users = [
            {'userId': u['sid'], 'userName': u['userName'], 'dbUserId': u['dbUserId']}
            for u in active_meetings[meeting_id]
        ]
        
        # Add current user to active list if not already there
        if not any(u['sid'] == request.sid for u in active_meetings[meeting_id]):
            active_meetings[meeting_id].append({
                'sid': request.sid,
                'userName': user_name,
                'dbUserId': user_id
            })
        
        emit('user_joined', {
            'userId': request.sid,
            'userName': user_name,
            'dbUserId': user_id
        }, room=meeting_id, skip_sid=request.sid)
        
        emit('current_users', {'users': existing_users})
        
        logger.info(f'User {user_name} joined meeting {meeting_id}. Active users: {len(active_meetings[meeting_id])}')

    @socketio.on('offer')
    def handle_offer(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('offer', {
            'from': request.sid,
            'offer': data.get('offer')
        }, to=to_user)

    @socketio.on('answer')
    def handle_answer(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('answer', {
            'from': request.sid,
            'answer': data.get('answer')
        }, to=to_user)

    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        from flask import request
        to_user = data.get('to')
        socketio.emit('ice_candidate', {
            'from': request.sid,
            'candidate': data.get('candidate')
        }, to=to_user)

    @socketio.on('send_chat')
    def handle_send_chat(data):
        meeting_id = data.get('meetingId')
        if meeting_id:
            from models.message import Message
            from database import db
            from flask import session
            user_id = session.get('user_id')
            if user_id:
                msg = Message(
                    author_id=user_id,
                    meeting_id=meeting_id,
                    content=data.get('message')
                )
                db.session.add(msg)
                db.session.commit()
            
            emit('chat_message', data, room=meeting_id)

    @socketio.on('toggle_media')
    def handle_toggle_media(data):
        from flask import request
        meeting_id = data.get('meetingId')
        if meeting_id:
            emit('peer_media_changed', {
                'userId': request.sid,
                'videoEnabled': data.get('videoEnabled'),
                'audioEnabled': data.get('audioEnabled')
            }, room=meeting_id, skip_sid=request.sid)

    @socketio.on('toggle_hand')
    def handle_toggle_hand(data):
        from flask import request
        meeting_id = data.get('meetingId')
        if meeting_id:
            emit('peer_hand_changed', {
                'userId': request.sid,
                'handRaised': data.get('handRaised')
            }, room=meeting_id, skip_sid=request.sid)

    @socketio.on('leave_meeting')
    def handle_leave_meeting(data):
        from flask import request
        meeting_id = data.get('meetingId')
        leave_room(meeting_id)
        
        if meeting_id in active_meetings:
            active_meetings[meeting_id] = [u for u in active_meetings[meeting_id] if u['sid'] != request.sid]
            if not active_meetings[meeting_id]:
                del active_meetings[meeting_id]
        
        emit('user_left', {'userId': request.sid}, room=meeting_id)
        logger.info(f'User left meeting {meeting_id}')

    @socketio.on('disconnect')
    def handle_disconnect():
        from flask import request
        for meeting_id, users in list(active_meetings.items()):
            user_in_room = any(u['sid'] == request.sid for u in users)
            if user_in_room:
                active_meetings[meeting_id] = [u for u in users if u['sid'] != request.sid]
                if not active_meetings[meeting_id]:
                    del active_meetings[meeting_id]
                else:
                    emit('user_left', {'userId': request.sid}, room=meeting_id)
        logger.info(f'Client disconnected: {request.sid}')
