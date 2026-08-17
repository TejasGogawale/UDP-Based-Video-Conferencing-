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
    
    participants = db.relationship('Participant', backref='meeting', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='meeting', lazy=True, cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.meeting_code = self.generate_meeting_code()

    @staticmethod
    def generate_meeting_code():
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

    @property
    def participant_count(self):
        return len(self.participants)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'meeting_code': self.meeting_code,
            'creator_id': self.creator_id,
            'is_active': self.is_active,
            'participant_count': self.participant_count,
            'created_at': self.created_at.isoformat()
        }
