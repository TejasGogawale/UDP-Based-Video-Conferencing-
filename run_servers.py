import os
import threading
import time
from app import create_app
from networking.udp_server import UDPConferencingServer

def run_flask(app, socketio, port):
    socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)

def run_udp(udp_port):
    server = UDPConferencingServer(host='0.0.0.0', port=udp_port)
    server.start()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    udp_port = int(os.environ.get('UDP_PORT', 5001))
    app, socketio = create_app()

    flask_thread = threading.Thread(target=run_flask, args=(app, socketio, port), daemon=False)
    udp_thread = threading.Thread(target=run_udp, args=(udp_port,), daemon=True)

    print('Starting VIT Connect Servers...')
    print(f'Flask + WebRTC Server on port {port}')
    print(f'UDP Demonstration Server on port {udp_port}')

    flask_thread.start()
    udp_thread.start()

    try:
        flask_thread.join()
    except KeyboardInterrupt:
        print('\nServers shutting down...')

