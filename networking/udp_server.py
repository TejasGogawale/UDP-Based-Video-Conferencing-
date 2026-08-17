import socket
import threading
import logging
import json
from datetime import datetime
from collections import defaultdict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class UDPConferencingServer:
    def __init__(self, host='0.0.0.0', port=5001):
        self.host = host
        self.port = port
        self.socket = None
        self.rooms = defaultdict(dict)
        self.running = False
        self.client_threads = []

    def start(self):
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind((self.host, self.port))
            self.running = True
            logger.info(f'UDP Server started on {self.host}:{self.port}')

            self.accept_connections()
        except Exception as e:
            logger.error(f'Server error: {str(e)}')
        finally:
            self.shutdown()

    def accept_connections(self):
        while self.running:
            try:
                data, addr = self.socket.recvfrom(1024)
                thread = threading.Thread(
                    target=self.handle_client,
                    args=(data, addr),
                    daemon=True
                )
                thread.start()
                self.client_threads.append(thread)
            except Exception as e:
                if self.running:
                    logger.error(f'Error accepting connection: {str(e)}')

    def handle_client(self, data, addr):
        try:
            message = json.loads(data.decode('utf-8'))
            action = message.get('action')

            if action == 'join':
                self.handle_join(addr, message)
            elif action == 'leave':
                self.handle_leave(addr, message)
            elif action == 'broadcast':
                self.handle_broadcast(addr, message)
            elif action == 'ping':
                self.handle_ping(addr)
            else:
                logger.warning(f'Unknown action from {addr}: {action}')

        except json.JSONDecodeError:
            logger.error(f'Invalid JSON from {addr}')
        except Exception as e:
            logger.error(f'Error handling client {addr}: {str(e)}')

    def handle_join(self, addr, message):
        room_id = message.get('room_id')
        user_name = message.get('user_name', 'Anonymous')
        user_id = str(addr)

        self.rooms[room_id][user_id] = {
            'addr': addr,
            'name': user_name,
            'joined_at': datetime.now().isoformat()
        }

        logger.info(f'{user_name} ({addr}) joined room {room_id}')
        self.broadcast_to_room(room_id, {
            'action': 'user_joined',
            'user_id': user_id,
            'user_name': user_name,
            'room_participants': len(self.rooms[room_id])
        })

    def handle_leave(self, addr, message):
        room_id = message.get('room_id')
        user_id = str(addr)

        if room_id in self.rooms and user_id in self.rooms[room_id]:
            user_name = self.rooms[room_id][user_id]['name']
            del self.rooms[room_id][user_id]
            logger.info(f'{user_name} ({addr}) left room {room_id}')

            self.broadcast_to_room(room_id, {
                'action': 'user_left',
                'user_id': user_id,
                'user_name': user_name,
                'room_participants': len(self.rooms[room_id])
            })

            if not self.rooms[room_id]:
                del self.rooms[room_id]

    def handle_broadcast(self, addr, message):
        room_id = message.get('room_id')
        content = message.get('content')
        user_id = str(addr)

        if room_id in self.rooms and user_id in self.rooms[room_id]:
            user_name = self.rooms[room_id][user_id]['name']
            logger.info(f'Broadcast from {user_name} in room {room_id}: {content}')

            self.broadcast_to_room(room_id, {
                'action': 'message',
                'user_id': user_id,
                'user_name': user_name,
                'content': content,
                'timestamp': datetime.now().isoformat()
            })

    def handle_ping(self, addr):
        response = {'action': 'pong', 'timestamp': datetime.now().isoformat()}
        self.socket.sendto(
            json.dumps(response).encode('utf-8'),
            addr
        )

    def broadcast_to_room(self, room_id, message):
        if room_id not in self.rooms:
            return

        message_data = json.dumps(message).encode('utf-8')
        for user_id, client_info in self.rooms[room_id].items():
            try:
                self.socket.sendto(message_data, client_info['addr'])
            except Exception as e:
                logger.error(f'Error sending to {client_info["addr"]}: {str(e)}')

    def shutdown(self):
        self.running = False
        if self.socket:
            self.socket.close()
        logger.info('UDP Server shutdown')

if __name__ == '__main__':
    server = UDPConferencingServer(port=5001)
    server.start()
