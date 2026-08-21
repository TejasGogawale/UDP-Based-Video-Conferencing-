from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

def init_db():
    from models.user import User
    from models.meeting import Meeting
    from models.participant import Participant
    from models.message import Message
    db.create_all()

    # Safely migrate existing tables if columns are missing
    try:
        engine = db.engine
        with engine.connect() as conn:
            from sqlalchemy import text
            # Check existing columns in meetings
            result = conn.execute(text("PRAGMA table_info(meetings)"))
            existing_cols = [row[1] for row in result.fetchall()]
            
            new_columns = [
                ("is_scheduled", "BOOLEAN DEFAULT 0"),
                ("scheduled_date", "VARCHAR(20)"),
                ("scheduled_start_time", "VARCHAR(20)"),
                ("scheduled_end_time", "VARCHAR(20)"),
                ("scheduled_start", "DATETIME"),
                ("scheduled_end", "DATETIME"),
                ("guest_emails", "TEXT"),
                ("google_calendar_url", "TEXT")
            ]
            
            for col_name, col_type in new_columns:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE meetings ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
    except Exception as e:
        print(f"[DB Migration Check]: {e}")


class BaseModel(db.Model):
    __abstract__ = True
    id = db.Column(db.String(36), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
