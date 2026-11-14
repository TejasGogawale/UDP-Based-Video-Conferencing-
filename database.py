import logging
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text

db = SQLAlchemy()
logger = logging.getLogger(__name__)

# Columns added after the first release. create_all() never alters an existing
# table, so they are added here. Types are chosen to be valid on both SQLite and
# PostgreSQL (the old code used SQLite-only PRAGMA and DATETIME).
_ADDED_COLUMNS = {
    'meetings': [
        ('is_scheduled', 'BOOLEAN DEFAULT FALSE'),
        ('scheduled_date', 'VARCHAR(20)'),
        ('scheduled_start_time', 'VARCHAR(20)'),
        ('scheduled_end_time', 'VARCHAR(20)'),
        ('scheduled_start', 'TIMESTAMP'),
        ('scheduled_end', 'TIMESTAMP'),
        ('guest_emails', 'TEXT'),
        ('google_calendar_url', 'TEXT'),
    ],
}

_INDEXES = [
    ('ix_participants_meeting_id', 'participants', 'meeting_id'),
    ('ix_participants_user_id', 'participants', 'user_id'),
    ('ix_messages_meeting_created', 'messages', 'meeting_id, created_at'),
    ('ix_meetings_creator_id', 'meetings', 'creator_id'),
    ('ix_invitations_meeting_id', 'invitations', 'meeting_id'),
]


def init_db():
    from models.user import User  # noqa: F401
    from models.meeting import Meeting  # noqa: F401
    from models.participant import Participant  # noqa: F401
    from models.message import Message  # noqa: F401
    from models.invitation import Invitation  # noqa: F401

    db.create_all()
    _migrate()


def _migrate():
    engine = db.engine
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        with engine.begin() as conn:
            for table, columns in _ADDED_COLUMNS.items():
                if table not in tables:
                    continue
                existing = {col['name'] for col in inspector.get_columns(table)}
                for name, ddl in columns:
                    if name not in existing:
                        conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}'))
                        logger.info('Added column %s.%s', table, name)
            for name, table, cols in _INDEXES:
                if table in tables:
                    conn.execute(text(f'CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})'))
    except Exception:
        logger.exception('Database migration check failed')


def database_summary():
    """Non-secret description of the active database, for logs and /api/health."""
    engine = db.engine
    dialect = engine.dialect.name
    return {
        'dialect': dialect,
        'durable': dialect != 'sqlite',
        'note': (
            'SQLite file on local disk. Data is lost when the host recreates the filesystem.'
            if dialect == 'sqlite' else 'External database server.'
        ),
    }


class BaseModel(db.Model):
    __abstract__ = True
    id = db.Column(db.String(36), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
