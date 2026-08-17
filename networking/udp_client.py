import socket
import json
import threading
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class UDPClient:
    def __init__(self, server_host, server_port, user_name='Anonymous'):
        self.server_host = server_host
        self.server_port = server_port
        self.user_name = user_name
        self.socket = None
        self.running = False
        self.room_id = None

    def connect(self):
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.running = True
            logger.info(f'UDP Client initialized for {self.server_host}:{self.server_port}')

            listen_thread = threading.Thread(target=self.listen, daemon=True)
            listen_thread.start()
        except Exception as e:
            logger.error(f'Connection error: {str(e)}')

    def join_room(self, room_id):
        self.room_id = room_id
        message = {
            'action': 'join',
            'room_id': room_id,
            'user_name': self.user_name
        }
        self.send_message(message)
        logger.info(f'Joined room: {room_id}')

    def leave_room(self):
        if self.room_id:
            message = {
                'action': 'leave',
                'room_id': self.room_id
            }
            self.send_message(message)
            logger.info(f'Left room: {self.room_id}')
            self.room_id = None

    def send_message(self, message):
        try:
            data = json.dumps(message).encode('utf-8')
            self.socket.sendto(data, (self.server_host, self.server_port))
        except Exception as e:
            logger.error(f'Send error: {str(e)}')

    def broadcast(self, content):
        if self.room_id:
            message = {
                'action': 'broadcast',
                'room_id': self.room_id,
                'content': content
            }
            self.send_message(message)

    def ping(self):
        message = {'action': 'ping'}
        self.send_message(message)

    def listen(self):
        while self.running:
            try:
                data, _ = self.socket.recvfrom(1024)
                message = json.loads(data.decode('utf-8'))
                self.handle_message(message)
            except Exception as e:
                if self.running:
                    logger.error(f'Listen error: {str(e)}')

    def handle_message(self, message):
        action = message.get('action')

        if action == 'user_joined':
            logger.info(f"User '{message.get('user_name')}' joined. Total: {message.get('room_participants')}")
        elif action == 'user_left':
            logger.info(f"User '{message.get('user_name')}' left. Remaining: {message.get('room_participants')}")
        elif action == 'message':
            logger.info(f"{message.get('user_name')}: {message.get('content')}")
        elif action == 'pong':
            logger.info('Pong received')

    def close(self):
        self.running = False
        if self.socket:
            self.socket.close()
        logger.info('UDP Client closed')
