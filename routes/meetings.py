from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.user import User
from models.meeting import Meeting
from models.participant import Participant
from models.message import Message
from datetime import datetime

meetings_bp = Blueprint('meetings', __name__)

def get_clean_meeting(meeting_id):
    if not meeting_id:
        return None
    meeting = Meeting.query.filter_by(id=meeting_id).first()
    if meeting:
        return meeting
    clean_code = meeting_id.replace('-', '').replace(' ', '').upper()
    meeting = Meeting.query.filter_by(meeting_code=clean_code).first()
    if meeting:
        return meeting
    meeting = Meeting.query.filter(db.func.lower(Meeting.id) == meeting_id.lower()).first()
    return meeting

@meetings_bp.route('/create', methods=['POST'])
@jwt_required()
def create_meeting():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400

    meeting = Meeting(
        title=data['title'],
        description=data.get('description', ''),
        creator_id=user_id
    )

    db.session.add(meeting)
    db.session.commit()

    participant = Participant(user_id=user_id, meeting_id=meeting.id)
    db.session.add(participant)
    db.session.commit()

    return jsonify({
        'message': 'Meeting created successfully',
        'meeting': meeting.to_dict()
    }), 201

@meetings_bp.route('', methods=['GET'])
@jwt_required()
def get_meetings():
    user_id = get_jwt_identity()
    meetings = Meeting.query.filter(
        (Meeting.creator_id == user_id) |
        (Meeting.participants.any(Participant.user_id == user_id))
    ).all()

    return jsonify({
        'meetings': [m.to_dict() for m in meetings]
    }), 200

@meetings_bp.route('/<meeting_id>', methods=['GET'])
@jwt_required()
def get_meeting(meeting_id):
    user_id = get_jwt_identity()
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    participant = Participant.query.filter_by(user_id=user_id, meeting_id=meeting.id).first()
    if not participant:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({'meeting': meeting.to_dict()}), 200

@meetings_bp.route('/<meeting_id>/join', methods=['POST'])
@jwt_required()
def join_meeting(meeting_id):
    user_id = get_jwt_identity()
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    existing = Participant.query.filter_by(user_id=user_id, meeting_id=meeting.id).first()
    if existing:
        return jsonify({'message': 'Already in meeting', 'meeting': meeting.to_dict()}), 200

    participant = Participant(user_id=user_id, meeting_id=meeting.id)
    db.session.add(participant)
    db.session.commit()

    return jsonify({
        'message': 'Joined meeting successfully',
        'meeting': meeting.to_dict()
    }), 200

@meetings_bp.route('/<meeting_id>/leave', methods=['POST'])
@jwt_required()
def leave_meeting(meeting_id):
    user_id = get_jwt_identity()
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    participant = Participant.query.filter_by(user_id=user_id, meeting_id=meeting.id).first()

    if not participant:
        return jsonify({'error': 'Not in meeting'}), 404

    participant.left_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': 'Left meeting successfully'}), 200

@meetings_bp.route('/<meeting_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(meeting_id):
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    messages = Message.query.filter_by(meeting_id=meeting.id).order_by(Message.created_at).all()
    return jsonify({
        'messages': [m.to_dict() for m in messages]
    }), 200
