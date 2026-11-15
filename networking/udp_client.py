import base64
import socket
import json
import threading
import logging
import uuid
from datetime import datetime
from networking.fec_gf256 import decode_fec_shards, encode_fec_shards

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

    def broadcast_with_fec(self, payload: bytes, n: int = 8, k: int = 6):
        """Partition `payload` into K source shards and N-K GF(2^8) parity shards
        and transmit all N datagrams over UDP."""
        if not self.room_id:
            return
        if isinstance(payload, str):
            payload = payload.encode('utf-8')
        shards, orig_len = encode_fec_shards(payload, n=n, k=k)
        frame_id = uuid.uuid4().hex[:12]
        for shard_idx, shard_bytes in shards:
            self.send_message({
                'action': 'fec_shard',
                'room_id': self.room_id,
                'frame_id': frame_id,
                'shard_idx': shard_idx,
                'n': n,
                'k': k,
                'orig_len': orig_len,
                'shard_b64': base64.b64encode(shard_bytes).decode('ascii'),
            })

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
