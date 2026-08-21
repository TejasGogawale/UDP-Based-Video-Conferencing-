from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from config import Config
from database import db, init_db
from routes.auth import auth_bp
from routes.meetings import meetings_bp
from events.socket_events import setup_socket_events

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
    setup_socket_events(socketio)

    with app.app_context():
        init_db()

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(meetings_bp, url_prefix='/api/meetings')

    @app.shell_context_processor
    def make_shell_context():
        return {'db': db}

    return app, socketio

if __name__ == '__main__':
    app, socketio = create_app()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
