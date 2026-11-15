import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

DEFAULT_SECRET = 'dev-secret-key-change-in-production'
DEFAULT_JWT_SECRET = 'jwt-secret-key-change-in-production'
DEFAULT_SQLITE_URL = 'sqlite:///vit_connect.db'


def _split_csv(value):
    return [item.strip() for item in (value or '').split(',') if item.strip()]


def normalize_database_url(url):
    """Render/Heroku hand out postgres:// URLs; SQLAlchemy 2 only accepts postgresql://."""
    url = (url or '').strip()
    if not url:
        return DEFAULT_SQLITE_URL
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    return url


class Config:
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    IS_PRODUCTION = FLASK_ENV == 'production'
    SECRET_KEY = os.getenv('SECRET_KEY', DEFAULT_SECRET)
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', DEFAULT_JWT_SECRET)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    JSON_SORT_KEYS = False

    # Database. Without DATABASE_URL the app uses a local SQLite file, which is
    # NOT durable on hosts with an ephemeral filesystem (Render web services).
    SQLALCHEMY_DATABASE_URI = normalize_database_url(os.getenv('DATABASE_URL'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DATABASE_IS_SQLITE = SQLALCHEMY_DATABASE_URI.startswith('sqlite')
    SQLALCHEMY_ENGINE_OPTIONS = (
        {} if DATABASE_IS_SQLITE
        else {'pool_pre_ping': True, 'pool_recycle': 280, 'pool_size': 5, 'max_overflow': 5}
    )

    # Browser origins allowed to call the API / open sockets. "*" keeps the
    # previous behaviour; auth is by bearer token, not cookies.
    CORS_ORIGINS = _split_csv(os.getenv('CORS_ORIGINS')) or '*'
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

    # Email. EMAIL_PROVIDER: auto | brevo | resend | smtp
    EMAIL_PROVIDER = os.getenv('EMAIL_PROVIDER', 'auto').strip().lower()
    BREVO_API_KEY = os.getenv('BREVO_API_KEY', '').strip()
    RESEND_API_KEY = os.getenv('RESEND_API_KEY', '').strip()
    SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587') or 587)
    SMTP_USER = os.getenv('SMTP_USER', os.getenv('GMAIL_USER', '')).strip()
    # Gmail shows app passwords in groups of four separated by spaces.
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', os.getenv('GMAIL_APP_PASSWORD', '')).replace(' ', '')
    EMAIL_FROM = os.getenv('EMAIL_FROM', '').strip() or SMTP_USER
    EMAIL_FROM_NAME = os.getenv('EMAIL_FROM_NAME', 'VIT Connect')
    EMAIL_TIMEOUT_SECONDS = int(os.getenv('EMAIL_TIMEOUT_SECONDS', '12') or 12)

    # WebRTC ICE servers handed to browsers by GET /api/ice-servers.
    # Uses fast global STUN servers by default; optional external TURN servers can
    # be configured via TURN_URLS, while built-in HTTPS Socket.IO media_relay
    # handles symmetric NAT / firewall traversal automatically on port 443.
    STUN_URLS = _split_csv(os.getenv('STUN_URLS')) or [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
    ]
    TURN_URLS = _split_csv(os.getenv('TURN_URLS'))
    TURN_USERNAME = os.getenv('TURN_USERNAME', '')
    TURN_CREDENTIAL = os.getenv('TURN_CREDENTIAL', '')

    @classmethod
    def email_provider(cls):
        """The provider that will actually be used, or None when nothing is configured."""
        choice = cls.EMAIL_PROVIDER
        if choice == 'brevo':
            return 'brevo' if cls.BREVO_API_KEY else None
        if choice == 'resend':
            return 'resend' if cls.RESEND_API_KEY else None
        if choice == 'smtp':
            return 'smtp' if (cls.SMTP_USER and cls.SMTP_PASSWORD) else None
        if cls.BREVO_API_KEY:
            return 'brevo'
        if cls.RESEND_API_KEY:
            return 'resend'
        if cls.SMTP_USER and cls.SMTP_PASSWORD:
            return 'smtp'
        return None

    @classmethod
    def ice_servers(cls):
        servers = []
        if cls.STUN_URLS:
            servers.append({'urls': cls.STUN_URLS})
        if cls.TURN_URLS:
            servers.append({
                'urls': cls.TURN_URLS,
                'username': cls.TURN_USERNAME,
                'credential': cls.TURN_CREDENTIAL,
            })
        return servers

    @classmethod
    def startup_warnings(cls):
        warnings = []
        if cls.DATABASE_IS_SQLITE:
            warnings.append(
                'The database is a local SQLite file (DATABASE_URL unset or sqlite://). On Render (and any host with an '
                'ephemeral filesystem) every deploy/restart ERASES all users and meetings. '
                'Set DATABASE_URL to a PostgreSQL connection string.'
            )
        if cls.IS_PRODUCTION and (cls.SECRET_KEY == DEFAULT_SECRET or cls.JWT_SECRET_KEY == DEFAULT_JWT_SECRET):
            warnings.append('SECRET_KEY / JWT_SECRET_KEY are using the built-in defaults. Set real secrets.')
        provider = cls.email_provider()
        if provider is None:
            warnings.append('No email provider is configured: invitation emails will fail (and say so).')
        elif provider == 'smtp':
            warnings.append(
                'Email uses raw SMTP. Render free web services block outbound ports 25/465/587; '
                'set BREVO_API_KEY or RESEND_API_KEY to send over HTTPS instead.'
            )
        if not cls.TURN_URLS:
            warnings.append(
                'TURN_URLS is not set: participants behind strict/mobile NATs may be unable to '
                'exchange audio/video. Configure a TURN server for reliable calls.'
            )
        return warnings
