from database import db, BaseModel
import uuid

class Message(BaseModel):
    __tablename__ = 'messages'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'author_id': self.author_id,
            'author_name': self.author.name,
            'meeting_id': self.meeting_id,
            'content': self.content,
            'created_at': self.created_at.isoformat()
        }
