from database import db, BaseModel
import uuid
import string
import random

class Meeting(BaseModel):
    __tablename__ = 'meetings'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    meeting_code = db.Column(db.String(12), unique=True, nullable=False)
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # Scheduling & Google Calendar Integration
    is_scheduled = db.Column(db.Boolean, default=False)
    scheduled_date = db.Column(db.String(20), nullable=True)
    scheduled_start_time = db.Column(db.String(20), nullable=True)
    scheduled_end_time = db.Column(db.String(20), nullable=True)
    scheduled_start = db.Column(db.DateTime, nullable=True)
    scheduled_end = db.Column(db.DateTime, nullable=True)
    guest_emails = db.Column(db.Text, nullable=True)
    google_calendar_url = db.Column(db.Text, nullable=True)
    
    participants = db.relationship('Participant', backref='meeting', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='meeting', lazy=True, cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.meeting_code:
            self.meeting_code = self.generate_meeting_code()

    @staticmethod
    def generate_meeting_code():
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

    @property
    def participant_count(self):
        return len(self.participants)

    def get_guest_emails_list(self):
        if not self.guest_emails:
            return []
        import json
        try:
            parsed = json.loads(self.guest_emails)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [e.strip() for e in self.guest_emails.split(',') if e.strip()]

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'meeting_code': self.meeting_code,
            'creator_id': self.creator_id,
            'creator_name': self.creator.name if self.creator else None,
            'creator_email': self.creator.email if self.creator else None,
            'is_active': self.is_active,
            'is_scheduled': bool(self.is_scheduled),
            'scheduled_date': self.scheduled_date,
            'scheduled_start_time': self.scheduled_start_time,
            'scheduled_end_time': self.scheduled_end_time,
            'scheduled_start': self.scheduled_start.isoformat() if self.scheduled_start else None,
            'scheduled_end': self.scheduled_end.isoformat() if self.scheduled_end else None,
            'guest_emails': self.get_guest_emails_list(),
            'google_calendar_url': self.google_calendar_url,
            'participant_count': self.participant_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

