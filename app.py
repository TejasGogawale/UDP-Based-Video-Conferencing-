import logging
import os
from datetime import datetime

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required
from flask_socketio import SocketIO

from config import Config
from database import db, init_db, database_summary
from routes.auth import auth_bp
from routes.meetings import meetings_bp
from events.socket_events import setup_socket_events

logger = logging.getLogger('vit_connect')


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})

    # ping_interval + ping_timeout bound how long a participant whose browser
    # vanished (closed tab, dead network) stays in the roster: 25 s worst case.
    socketio = SocketIO(
        app,
        cors_allowed_origins=Config.CORS_ORIGINS,
        async_mode='threading',
        ping_interval=10,
        ping_timeout=15,
    )
    setup_socket_events(socketio)

    with app.app_context():
        init_db()
        summary = database_summary()
        logger.warning('Database: %s (durable=%s)', summary['dialect'], summary['durable'])
        logger.warning('Email provider: %s', Config.email_provider() or 'NOT CONFIGURED')
        for warning in Config.startup_warnings():
            logger.warning('CONFIG WARNING: %s', warning)

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(meetings_bp, url_prefix='/api/meetings')

    @app.route('/')
    def index():
        return jsonify({'service': 'VIT Connect API', 'status': 'ok', 'health': '/api/health'})

    @app.route('/api/health')
    def health():
        """Non-secret runtime facts, so a deployment can be checked from a browser."""
        try:
            db.session.execute(db.text('SELECT 1'))
            db_ok = True
        except Exception:
            db_ok = False
        provider = Config.email_provider()
        return jsonify({
            'status': 'ok' if db_ok else 'degraded',
            'time': datetime.utcnow().isoformat() + 'Z',
            'database': dict(database_summary(), connected=db_ok),
            'email': {
                'configured': provider is not None,
                'provider': provider,
                'uses_https_api': provider in ('brevo', 'resend'),
            },
            'webrtc': {'turn_configured': bool(Config.TURN_URLS)},
            'warnings': Config.startup_warnings(),
        }), (200 if db_ok else 503)

    @app.route('/api/ice-servers')
    @jwt_required()
    def ice_servers():
        return jsonify({'iceServers': Config.ice_servers()})

    @app.shell_context_processor
    def make_shell_context():
        return {'db': db}

    return app, socketio


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app, socketio = create_app()
    # The interactive debugger is opt-in (FLASK_DEBUG=1) and never on in production.
    debug = not Config.IS_PRODUCTION and os.environ.get('FLASK_DEBUG', '0') == '1'
    socketio.run(app, debug=debug, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
