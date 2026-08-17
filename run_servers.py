import threading
import time
from app import create_app
from networking.udp_server import UDPConferencingServer

def run_flask(app, socketio):
    socketio.run(app, debug=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

def run_udp():
    server = UDPConferencingServer(host='0.0.0.0', port=5001)
    server.start()

if __name__ == '__main__':
    app, socketio = create_app()

    flask_thread = threading.Thread(target=run_flask, args=(app, socketio), daemon=False)
    udp_thread = threading.Thread(target=run_udp, daemon=True)

    print('Starting VIT Connect Servers...')
    print('Flask + WebRTC Server: http://localhost:5000')
    print('UDP Demonstration Server: localhost:5001')

    flask_thread.start()
    udp_thread.start()

    try:
        flask_thread.join()
    except KeyboardInterrupt:
        print('\nServers shutting down...')
