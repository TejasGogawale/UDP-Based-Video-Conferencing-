from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

def init_db():
    from models.user import User
    from models.meeting import Meeting
    from models.participant import Participant
    from models.message import Message
    db.create_all()

class BaseModel(db.Model):
    __abstract__ = True
    id = db.Column(db.String(36), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
