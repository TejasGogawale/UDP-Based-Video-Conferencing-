from database import db, BaseModel
import uuid

class Participant(BaseModel):
    __tablename__ = 'participants'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=db.func.now())
    left_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'meeting_id': self.meeting_id,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'left_at': self.left_at.isoformat() if self.left_at else None
        }
