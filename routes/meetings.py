from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.user import User
from models.meeting import Meeting
from models.participant import Participant
from models.message import Message
from datetime import datetime, timedelta
import json
import re
from config import Config
from services.mail_service import send_meeting_schedule_notifications, send_email_message, build_meeting_html_email
from services.calendar_service import generate_google_calendar_url, generate_ics_content

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

def clean_email_list(raw_guests):
    if not raw_guests:
        return []
    if isinstance(raw_guests, str):
        emails = [e.strip() for e in re.split(r'[,;\s]+', raw_guests) if e.strip()]
    elif isinstance(raw_guests, list):
        emails = [str(e).strip() for e in raw_guests if str(e).strip()]
    else:
        emails = []
    # Filter valid emails
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return [e for e in emails if re.match(email_pattern, e)]

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

@meetings_bp.route('/schedule', methods=['POST'])
@jwt_required()
def schedule_meeting():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Meeting title is required'}), 400

    date_str = data.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
    start_time_str = data.get('start_time', '10:00')
    end_time_str = data.get('end_time', '11:00')
    description = data.get('description', '').strip()
    raw_guests = data.get('guest_emails', [])
    send_email = data.get('send_email', True)

    guest_emails = clean_email_list(raw_guests)

    # Parse start and end timestamps
    try:
        start_dt = datetime.strptime(f"{date_str} {start_time_str}", '%Y-%m-%d %H:%M')
    except Exception:
        start_dt = datetime.utcnow()
        date_str = start_dt.strftime('%Y-%m-%d')
        start_time_str = start_dt.strftime('%H:%M')

    try:
        end_dt = datetime.strptime(f"{date_str} {end_time_str}", '%Y-%m-%d %H:%M')
    except Exception:
        end_dt = start_dt + timedelta(hours=1)
        end_time_str = end_dt.strftime('%H:%M')

    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(minutes=30)
        end_time_str = end_dt.strftime('%H:%M')

    meeting = Meeting(
        title=title,
        description=description,
        creator_id=user_id,
        is_scheduled=True,
        scheduled_date=date_str,
        scheduled_start_time=start_time_str,
        scheduled_end_time=end_time_str,
        scheduled_start=start_dt,
        scheduled_end=end_dt,
        guest_emails=json.dumps(guest_emails)
    )

    db.session.add(meeting)
    db.session.commit()

    # Add host as participant
    participant = Participant(user_id=user_id, meeting_id=meeting.id)
    db.session.add(participant)

    # Generate Google Calendar Link
    base_url = Config.FRONTEND_URL.rstrip('/')
    meeting_link = f"{base_url}/conference/{meeting.meeting_code}"
    gcal_url = generate_google_calendar_url(
        title=meeting.title,
        description=meeting.description or f"VIT Connect video conference hosted by {user.name}",
        start_dt=start_dt,
        end_dt=end_dt,
        meeting_link=meeting_link,
        guest_emails=guest_emails
    )
    meeting.google_calendar_url = gcal_url
    db.session.commit()

    email_notifications = None
    if send_email:
        email_notifications = send_meeting_schedule_notifications(
            meeting=meeting,
            host_user=user,
            guest_emails=guest_emails,
            start_dt=start_dt,
            end_dt=end_dt,
            date_str=date_str,
            start_time_str=start_time_str,
            end_time_str=end_time_str
        )

    return jsonify({
        'message': 'Meeting scheduled successfully',
        'meeting': meeting.to_dict(),
        'google_calendar_url': gcal_url,
        'meeting_link': meeting_link,
        'email_notifications': email_notifications
    }), 201

@meetings_bp.route('/scheduled', methods=['GET'])
@jwt_required()
def get_scheduled_meetings():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Fetch meetings scheduled by user or where user is participant
    meetings = Meeting.query.filter_by(is_scheduled=True).order_by(Meeting.scheduled_start.asc(), Meeting.created_at.desc()).all()
    
    user_scheduled = []
    for m in meetings:
        is_creator = m.creator_id == user_id
        is_part = any(p.user_id == user_id for p in m.participants)
        is_guest = user.email.lower() in [g.lower() for g in m.get_guest_emails_list()]
        if is_creator or is_part or is_guest:
            user_scheduled.append(m.to_dict())

    return jsonify({'scheduled_meetings': user_scheduled}), 200

@meetings_bp.route('/<meeting_id>/send-reminder', methods=['POST'])
@jwt_required()
def send_meeting_reminder(meeting_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    if meeting.creator_id != user_id:
        return jsonify({'error': 'Only the meeting host can send reminder emails'}), 403

    start_dt = meeting.scheduled_start or meeting.created_at
    end_dt = meeting.scheduled_end or (start_dt + timedelta(hours=1))
    date_str = meeting.scheduled_date or start_dt.strftime('%Y-%m-%d')
    start_time_str = meeting.scheduled_start_time or start_dt.strftime('%H:%M')
    end_time_str = meeting.scheduled_end_time or end_dt.strftime('%H:%M')
    guest_emails = meeting.get_guest_emails_list()

    email_notifications = send_meeting_schedule_notifications(
        meeting=meeting,
        host_user=user,
        guest_emails=guest_emails,
        start_dt=start_dt,
        end_dt=end_dt,
        date_str=date_str,
        start_time_str=start_time_str,
        end_time_str=end_time_str
    )

    return jsonify({
        'message': 'Reminder emails dispatched successfully',
        'email_notifications': email_notifications
    }), 200

@meetings_bp.route('/<meeting_id>/calendar.ics', methods=['GET'])
def get_calendar_ics(meeting_id):
    meeting = get_clean_meeting(meeting_id)
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    host = meeting.creator or User.query.get(meeting.creator_id)
    host_name = host.name if host else 'Host'
    host_email = host.email if host else 'noreply@vitconnect.edu'

    start_dt = meeting.scheduled_start or meeting.created_at
    end_dt = meeting.scheduled_end or (start_dt + timedelta(hours=1))
    base_url = Config.FRONTEND_URL.rstrip('/')
    meeting_link = f"{base_url}/conference/{meeting.meeting_code}"

    ics_data = generate_ics_content(
        meeting_id=meeting.id,
        title=meeting.title,
        description=meeting.description or f"VIT Connect video conference hosted by {host_name}",
        start_dt=start_dt,
        end_dt=end_dt,
        meeting_link=meeting_link,
        organizer_name=host_name,
        organizer_email=host_email,
        guest_emails=meeting.get_guest_emails_list()
    )

    return Response(
        ics_data,
        mimetype='text/calendar',
        headers={'Content-Disposition': f'attachment; filename="{meeting.meeting_code}.ics"'}
    )

@meetings_bp.route('', methods=['GET'])
@jwt_required()
def get_meetings():
    user_id = get_jwt_identity()
    meetings = Meeting.query.filter(
        (Meeting.creator_id == user_id) |
        (Meeting.participants.any(Participant.user_id == user_id))
    ).order_by(Meeting.created_at.desc()).all()

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

