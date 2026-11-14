from database import db, BaseModel
import uuid


class Invitation(BaseModel):
    """One row per (meeting, recipient). Used to report delivery state and to
    stop the same invitation being emailed twice by accident."""
    __tablename__ = 'invitations'
    __table_args__ = (db.UniqueConstraint('meeting_id', 'email', name='uq_invitation_meeting_email'),)

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    invited_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending | sent | failed
    provider = db.Column(db.String(20))
    error = db.Column(db.Text)
    send_count = db.Column(db.Integer, nullable=False, default=0)
    last_sent_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'email': self.email,
            'status': self.status,
            'provider': self.provider,
            'error': self.error,
            'send_count': self.send_count,
            'last_sent_at': self.last_sent_at.isoformat() + 'Z' if self.last_sent_at else None,
        }
