from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.user import User
from models.meeting import Meeting
from models.participant import Participant
from models.message import Message
from models.invitation import Invitation
from datetime import datetime, timedelta
import json
import re
from services.mail_service import (
    send_meeting_schedule_notifications, send_meeting_invitations, meeting_link_for,
)
from services.calendar_service import generate_google_calendar_url, generate_ics_content
from services.presence import presence

meetings_bp = Blueprint('meetings', __name__)

EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
MAX_INVITES_PER_REQUEST = 25


def get_clean_meeting(meeting_id):
    """Resolve a db id, a meeting code, or a dashed/spaced code to a Meeting."""
    if not meeting_id:
        return None
    meeting_id = str(meeting_id).strip()
    meeting = db.session.get(Meeting, meeting_id)
    if meeting:
        return meeting
    clean_code = re.sub(r'[^A-Za-z0-9]', '', meeting_id).upper()
    if clean_code:
        meeting = Meeting.query.filter_by(meeting_code=clean_code).first()
        if meeting:
            return meeting
    return Meeting.query.filter(db.func.lower(Meeting.id) == meeting_id.lower()).first()


def clean_email_list(raw_guests):
    """Valid, lower-cased, de-duplicated addresses in their original order."""
    if not raw_guests:
        return []
    if isinstance(raw_guests, str):
        emails = re.split(r'[,;\s]+', raw_guests)
    elif isinstance(raw_guests, list):
        emails = [str(e) for e in raw_guests]
    else:
        emails = []
    seen, cleaned = set(), []
    for email in emails:
        email = email.strip().lower()
        if email and EMAIL_PATTERN.match(email) and email not in seen:
            seen.add(email)
            cleaned.append(email)
    return cleaned


def meeting_payload(meeting):
    data = meeting.to_dict()
    data['active_participants'] = presence.count(meeting.id)
    return data


def record_invitations(meeting, inviter_id, summary):
    """Persist the per-recipient outcome of a send."""
    now = datetime.utcnow()
    for item in summary['results']:
        if item['target'] != 'guest':
            continue
        row = Invitation.query.filter_by(meeting_id=meeting.id, email=item['email'].lower()).first()
        if row is None:
            row = Invitation(meeting_id=meeting.id, email=item['email'].lower(), invited_by=inviter_id)
            db.session.add(row)
        row.status = 'sent' if item['success'] else 'failed'
        row.provider = summary.get('provider')
        row.error = None if item['success'] else item['error']
        if item['success']:
            row.send_count = (row.send_count or 0) + 1
            row.last_sent_at = now
    db.session.commit()


@meetings_bp.route('/create', methods=['POST'])
@jwt_required()
def create_meeting():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    title = str(data.get('title') or '').strip()[:255]

    if not title:
        return jsonify({'error': 'Title is required'}), 400

    meeting = Meeting(
        title=title,
        description=str(data.get('description') or '').strip(),
        creator_id=user_id
    )
    db.session.add(meeting)
    db.session.flush()
    db.session.add(Participant(user_id=user_id, meeting_id=meeting.id))
    db.session.commit()

    return jsonify({
        'message': 'Meeting created successfully',
        'meeting': meeting_payload(meeting)
    }), 201


@meetings_bp.route('/schedule', methods=['POST'])
@jwt_required()
def schedule_meeting():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    title = str(data.get('title') or '').strip()[:255]
    if not title:
        return jsonify({'error': 'Meeting title is required'}), 400

    date_str = data.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
    start_time_str = data.get('start_time') or '10:00'
    end_time_str = data.get('end_time') or '11:00'
    description = str(data.get('description') or '').strip()
    send_email = data.get('send_email', True)
    guest_emails = clean_email_list(data.get('guest_emails', []))

    try:
        start_dt = datetime.strptime(f"{date_str} {start_time_str}", '%Y-%m-%d %H:%M')
    except Exception:
        return jsonify({'error': 'Invalid date or start time'}), 400

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
    db.session.flush()
    db.session.add(Participant(user_id=user_id, meeting_id=meeting.id))

    meeting_link = meeting_link_for(meeting)
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
        record_invitations(meeting, user_id, email_notifications)

    # The meeting itself was created, so this is a 201 either way; the email
    # outcome is reported honestly in `email_notifications`.
    return jsonify({
        'message': 'Meeting scheduled successfully',
        'meeting': meeting_payload(meeting),
        'google_calendar_url': gcal_url,
        'meeting_link': meeting_link,
        'email_notifications': email_notifications
    }), 201


@meetings_bp.route('/scheduled', methods=['GET'])
@jwt_required()
def get_scheduled_meetings():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    meetings = Meeting.query.filter_by(is_scheduled=True).order_by(
        Meeting.scheduled_start.asc(), Meeting.created_at.desc()).all()

    user_scheduled = []
    for m in meetings:
        is_creator = m.creator_id == user_id
        is_part = any(p.user_id == user_id for p in m.participants)
        is_guest = user.email.lower() in [g.lower() for g in m.get_guest_emails_list()]
        if is_creator or is_part or is_guest:
            user_scheduled.append(meeting_payload(m))

    return jsonify({'scheduled_meetings': user_scheduled}), 200


@meetings_bp.route('/<meeting_id>/send-reminder', methods=['POST'])
@jwt_required()
def send_meeting_reminder(meeting_id):
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    meeting = get_clean_meeting(meeting_id)

    if not meeting or not user:
        return jsonify({'error': 'Meeting not found'}), 404

    if meeting.creator_id != user_id:
        return jsonify({'error': 'Only the meeting host can send reminder emails'}), 403

    start_dt = meeting.scheduled_start or meeting.created_at
    end_dt = meeting.scheduled_end or (start_dt + timedelta(hours=1))

    summary = send_meeting_schedule_notifications(
        meeting=meeting,
        host_user=user,
        guest_emails=meeting.get_guest_emails_list(),
        start_dt=start_dt,
        end_dt=end_dt,
        date_str=meeting.scheduled_date or start_dt.strftime('%Y-%m-%d'),
        start_time_str=meeting.scheduled_start_time or start_dt.strftime('%H:%M'),
        end_time_str=meeting.scheduled_end_time or end_dt.strftime('%H:%M')
    )
    record_invitations(meeting, user_id, summary)

    if summary['delivered'] == 0:
        first_error = next((r['error'] for r in summary['results'] if r['error']), 'Email could not be sent.')
        return jsonify({'error': first_error, 'email_notifications': summary}), 502

    return jsonify({
        'message': f"Sent {summary['delivered']} of {summary['attempted']} reminder emails.",
        'email_notifications': summary
    }), 200


@meetings_bp.route('/<meeting_id>/invite', methods=['POST'])
@jwt_required()
def invite_to_meeting(meeting_id):
    """Email an invitation for this meeting to one or more addresses.

    Body: {"emails": [...], "resend": false}
    Addresses already invited successfully are skipped unless resend is true.
    Responds 200 if every attempted email was accepted by the provider, 207 if
    only some were, 502 if none were, 400 if there was nothing valid to send.
    """
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    meeting = get_clean_meeting(meeting_id)
    if not meeting or not user:
        return jsonify({'error': 'Meeting not found'}), 404

    is_member = meeting.creator_id == user_id or Participant.query.filter_by(
        user_id=user_id, meeting_id=meeting.id).first() is not None
    if not is_member:
        return jsonify({'error': 'Join the meeting before inviting others'}), 403

    data = request.get_json(silent=True) or {}
    emails = clean_email_list(data.get('emails'))
    if not emails:
        return jsonify({'error': 'Enter at least one valid email address'}), 400
    if len(emails) > MAX_INVITES_PER_REQUEST:
        return jsonify({'error': f'Invite at most {MAX_INVITES_PER_REQUEST} people at a time'}), 400

    resend = bool(data.get('resend'))
    already_sent = set()
    if not resend:
        already_sent = {
            row.email for row in Invitation.query.filter(
                Invitation.meeting_id == meeting.id,
                Invitation.status == 'sent',
                Invitation.email.in_(emails)).all()
        }
    to_send = [e for e in emails if e not in already_sent and e != user.email.lower()]

    results = [{'email': e, 'status': 'already_invited', 'error': None} for e in emails if e in already_sent]
    results += [{'email': e, 'status': 'skipped_self', 'error': None} for e in emails if e == user.email.lower()]

    summary = {'provider': None, 'attempted': 0, 'delivered': 0, 'failed': 0, 'results': []}
    if to_send:
        summary = send_meeting_invitations(
            meeting, user, to_send,
            start_dt=meeting.scheduled_start if meeting.is_scheduled else None,
            end_dt=meeting.scheduled_end if meeting.is_scheduled else None,
            date_str=meeting.scheduled_date or '',
            start_time_str=meeting.scheduled_start_time or '',
            end_time_str=meeting.scheduled_end_time or '')
        record_invitations(meeting, user_id, summary)
        results += [
            {'email': r['email'], 'status': 'sent' if r['success'] else 'failed', 'error': r['error']}
            for r in summary['results']
        ]

        # Keep the meeting's guest list in sync so reminders reach new invitees.
        guests = meeting.get_guest_emails_list()
        known = {g.lower() for g in guests}
        guests += [r['email'] for r in summary['results'] if r['success'] and r['email'].lower() not in known]
        meeting.guest_emails = json.dumps(guests)
        db.session.commit()

    body = {
        'provider': summary['provider'],
        'attempted': summary['attempted'],
        'delivered': summary['delivered'],
        'failed': summary['failed'],
        'results': results,
    }
    if summary['attempted'] == 0:
        body['message'] = 'Everyone on the list has already been invited.'
        return jsonify(body), 200
    if summary['delivered'] == 0:
        body['error'] = next((r['error'] for r in results if r['error']), 'Email could not be sent.')
        return jsonify(body), 502
    if summary['failed']:
        body['message'] = f"Sent {summary['delivered']} of {summary['attempted']} invitations."
        return jsonify(body), 207
    body['message'] = f"Sent {summary['delivered']} invitation{'s' if summary['delivered'] != 1 else ''}."
    return jsonify(body), 200


@meetings_bp.route('/<meeting_id>/calendar.ics', methods=['GET'])
def get_calendar_ics(meeting_id):
    meeting = get_clean_meeting(meeting_id)
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    host = meeting.creator or db.session.get(User, meeting.creator_id)
    host_name = host.name if host else 'Host'
    host_email = host.email if host else 'noreply@vitconnect.edu'

    start_dt = meeting.scheduled_start or meeting.created_at
    end_dt = meeting.scheduled_end or (start_dt + timedelta(hours=1))

    ics_data = generate_ics_content(
        meeting_id=meeting.id,
        title=meeting.title,
        description=meeting.description or f"VIT Connect video conference hosted by {host_name}",
        start_dt=start_dt,
        end_dt=end_dt,
        meeting_link=meeting_link_for(meeting),
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
        'meetings': [meeting_payload(m) for m in meetings]
    }), 200


@meetings_bp.route('/<meeting_id>', methods=['GET'])
@jwt_required()
def get_meeting(meeting_id):
    # Knowing the meeting code/link is what grants access (as with any
    # link-based meeting), so any signed-in user may look a meeting up.
    meeting = get_clean_meeting(meeting_id)
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404
    return jsonify({'meeting': meeting_payload(meeting)}), 200


@meetings_bp.route('/<meeting_id>/presence', methods=['GET'])
@jwt_required()
def get_meeting_presence(meeting_id):
    """Who is in the live call right now (same registry the sockets use)."""
    meeting = get_clean_meeting(meeting_id)
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404
    roster = presence.roster(meeting.id)
    return jsonify({
        'meetingId': meeting.id,
        'count': len(roster),
        'participants': [{'userName': p['userName'], 'isHost': p['isHost']} for p in roster],
    }), 200


@meetings_bp.route('/<meeting_id>/join', methods=['POST'])
@jwt_required()
def join_meeting(meeting_id):
    user_id = get_jwt_identity()
    meeting = get_clean_meeting(meeting_id)

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    existing = Participant.query.filter_by(user_id=user_id, meeting_id=meeting.id).first()
    if existing:
        return jsonify({'message': 'Already in meeting', 'meeting': meeting_payload(meeting)}), 200

    db.session.add(Participant(user_id=user_id, meeting_id=meeting.id))
    db.session.commit()

    return jsonify({
        'message': 'Joined meeting successfully',
        'meeting': meeting_payload(meeting)
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
