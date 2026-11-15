"""Backend integration tests: auth persistence, canonical rooms, presence,
roster lifecycle, signaling authorisation, host moderation, email honesty.

Run:  python -m unittest discover -s tests -v
Uses a throwaway database (TEST_DATABASE_URL, default: temp SQLite file).
"""
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

_tmp_dir = tempfile.mkdtemp(prefix='vitconnect-test-')
os.environ['DATABASE_URL'] = os.environ.get(
    'TEST_DATABASE_URL', 'sqlite:///' + os.path.join(_tmp_dir, 'test.db').replace('\\', '/'))
# Make sure no real mail can leave during tests.
for key in ('BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_USER', 'SMTP_PASSWORD', 'GMAIL_USER',
            'GMAIL_APP_PASSWORD', 'EMAIL_FROM'):
    os.environ[key] = ''
os.environ['EMAIL_PROVIDER'] = 'auto'

from app import create_app  # noqa: E402
from config import Config  # noqa: E402
from database import db  # noqa: E402
from services import mail_service  # noqa: E402
from services.presence import presence  # noqa: E402

app, socketio = create_app()
_counter = 0


def make_user(http, name):
    global _counter
    _counter += 1
    res = http.post('/api/auth/register', json={
        'name': name, 'email': f'{name.lower()}{_counter}@example.com', 'password': 'secret123'})
    assert res.status_code == 201, res.get_json()
    body = res.get_json()
    return body['token'], body['user']


def auth(token):
    return {'Authorization': f'Bearer {token}'}


def last(client, event):
    """Most recent payload of `event` received by a socket test client (and drain)."""
    found = None
    for packet in client.get_received():
        if packet['name'] == event:
            found = packet['args'][0]
    return found


def events(client):
    return [(p['name'], p['args'][0] if p['args'] else None) for p in client.get_received()]


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.http = app.test_client()
        self.sockets = []

    def tearDown(self):
        for sock in self.sockets:
            if sock.is_connected():
                sock.disconnect()

    def connect(self, token):
        sock = socketio.test_client(app, auth={'token': token})
        self.assertTrue(sock.is_connected())
        self.sockets.append(sock)
        return sock

    def create_meeting(self, token, title='Standup'):
        res = self.http.post('/api/meetings/create', json={'title': title}, headers=auth(token))
        self.assertEqual(res.status_code, 201)
        return res.get_json()['meeting']

    # -- auth & persistence -------------------------------------------------
    def test_registration_persists_and_passwords_are_hashed(self):
        token, user = make_user(self.http, 'Asha')
        from models.user import User
        with app.app_context():
            row = db.session.get(User, user['id'])
            self.assertIsNotNone(row)
            self.assertNotIn('secret123', row.password_hash)
            self.assertTrue(row.check_password('secret123'))
        # A second app on the same database (a "restart") still knows the user.
        app2, _ = create_app()
        res = app2.test_client().post('/api/auth/login', json={
            'email': user['email'].upper(), 'password': 'secret123'})
        self.assertEqual(res.status_code, 200)

    def test_duplicate_email_is_rejected_case_insensitively(self):
        _, user = make_user(self.http, 'Bina')
        res = self.http.post('/api/auth/register', json={
            'name': 'Other', 'email': user['email'].upper(), 'password': 'secret123'})
        self.assertEqual(res.status_code, 409)

    def test_socket_requires_valid_token(self):
        self.assertFalse(socketio.test_client(app, auth={'token': 'garbage'}).is_connected())
        self.assertFalse(socketio.test_client(app).is_connected())

    # -- canonical room & presence -----------------------------------------
    def test_id_code_and_dashed_code_reach_the_same_room(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'GuestA')
        t3, _ = make_user(self.http, 'GuestB')
        meeting = self.create_meeting(t1)
        code = meeting['meeting_code']
        dashed = f'{code[:4]}-{code[4:8]}-{code[8:]}'.lower()

        a, b, c = self.connect(t1), self.connect(t2), self.connect(t3)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': code, 'clientId': 'b'})
        c.emit('join_meeting', {'meetingId': dashed, 'clientId': 'c'})

        for sock in (a, b, c):
            roster = last(sock, 'roster_update')
            self.assertEqual(len(roster['participants']), 3)
        self.assertEqual(presence.count(meeting['id']), 3)

    def test_lobby_sees_live_count_before_joining(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Watcher')
        meeting = self.create_meeting(t1)

        watcher = self.connect(t2)
        watcher.emit('watch_meeting', {'meetingId': meeting['meeting_code']})
        self.assertEqual(last(watcher, 'presence_update')['count'], 0)

        host = self.connect(t1)
        host.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'h'})
        update = last(watcher, 'presence_update')
        self.assertEqual(update['count'], 1)
        self.assertEqual(update['participants'][0]['userName'], 'Host')

        # REST reads the same registry.
        res = self.http.get(f"/api/meetings/{meeting['meeting_code']}/presence", headers=auth(t2))
        self.assertEqual(res.get_json()['count'], 1)

        host.emit('leave_meeting', {})
        self.assertEqual(last(watcher, 'presence_update')['count'], 0)
        # Watching never makes you a participant.
        self.assertEqual(presence.count(meeting['id']), 0)

    def test_unknown_meeting_is_reported(self):
        t1, _ = make_user(self.http, 'Lost')
        sock = self.connect(t1)
        sock.emit('join_meeting', {'meetingId': 'NOPE-NOPE'})
        self.assertEqual(last(sock, 'meeting_error')['code'], 'not_found')

    # -- lifecycle ---------------------------------------------------------
    def test_leave_and_disconnect_remove_participant_everywhere(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        a.get_received()

        b.disconnect()  # browser closed, no explicit leave
        roster = last(a, 'roster_update')
        self.assertEqual([p['userName'] for p in roster['participants']], ['Host'])

    def test_rejoin_from_same_tab_does_not_duplicate(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'tab-b'})

        # Network blip: a new socket appears for the same tab while the old one lingers.
        b2 = self.connect(t2)
        b2.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'tab-b'})

        roster = last(a, 'roster_update')
        names = [p['userName'] for p in roster['participants']]
        self.assertEqual(sorted(names), ['Guest', 'Host'])
        self.assertEqual(presence.count(meeting['id']), 2)
        self.assertFalse(b.is_connected())  # stale session was dropped

    def test_attendance_is_recorded_for_history(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        b = self.connect(t2)
        b.emit('join_meeting', {'meetingId': meeting['meeting_code'], 'clientId': 'b'})
        res = self.http.get('/api/meetings', headers=auth(t2))
        self.assertIn(meeting['id'], [m['id'] for m in res.get_json()['meetings']])

    # -- signaling ---------------------------------------------------------
    def test_signal_is_relayed_only_within_a_meeting(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        t3, _ = make_user(self.http, 'Outsider')
        meeting = self.create_meeting(t1)
        other = self.create_meeting(t3, 'Other')
        a, b, c = self.connect(t1), self.connect(t2), self.connect(t3)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        c.emit('join_meeting', {'meetingId': other['id'], 'clientId': 'c'})
        a_id = last(a, 'joined')['selfId']
        b_id = last(b, 'joined')['selfId']
        c.get_received()

        a.emit('signal', {'to': b_id, 'data': {'candidate': 'x'}})
        got = last(b, 'signal')
        self.assertEqual(got, {'from': a_id, 'data': {'candidate': 'x'}})

        c.emit('signal', {'to': b_id, 'data': {'candidate': 'evil'}})
        self.assertIsNone(last(b, 'signal'))

    def test_media_hand_and_screen_state_are_in_the_roster(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        b_id = last(b, 'joined')['selfId']

        b.emit('media_state', {'videoEnabled': False})
        b.emit('toggle_hand', {'handRaised': True})
        b.emit('screen_share_status', {'isSharing': True, 'streamId': 'screen-1'})
        me = next(p for p in last(a, 'roster_update')['participants'] if p['userId'] == b_id)
        self.assertFalse(me['videoEnabled'])
        self.assertTrue(me['handRaised'])
        self.assertTrue(me['isPresenting'])
        self.assertEqual(me['screenStreamId'], 'screen-1')

        # A second presenter takes over; the first is told to stop.
        a.emit('screen_share_status', {'isSharing': True, 'streamId': 'screen-2'})
        self.assertIn(('host_command', mock.ANY), [(n, mock.ANY) for n, _ in events(b)])
        presenting = [p['userName'] for p in presence.roster(meeting['id']) if p['isPresenting']]
        self.assertEqual(presenting, ['Host'])

    # -- chat ---------------------------------------------------------------
    def test_chat_is_broadcast_persisted_and_replayed(self):
        t1, u1 = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a = self.connect(t1)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        a.emit('send_chat', {'message': 'hello there'})
        msg = last(a, 'chat_message')
        self.assertEqual(msg['message'], 'hello there')
        self.assertEqual(msg['authorId'], u1['id'])
        self.assertTrue(msg['createdAt'].endswith('Z'))

        b = self.connect(t2)
        b.emit('join_meeting', {'meetingId': meeting['meeting_code'], 'clientId': 'b'})
        history = last(b, 'joined')['chatHistory']
        self.assertEqual([m['message'] for m in history], ['hello there'])

    # -- captions ------------------------------------------------------------
    def test_captions_demand_follows_any_viewer(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        b.get_received()

        a.emit('captions_toggle', {'enabled': True})
        self.assertTrue(last(b, 'captions_demand')['active'])

        b.emit('live_caption', {'text': 'good morning', 'isFinal': True})
        cap = last(a, 'caption_received')
        self.assertEqual((cap['userName'], cap['text']), ('Guest', 'good morning'))

        a.emit('captions_toggle', {'enabled': False})
        self.assertFalse(last(b, 'captions_demand')['active'])

    # -- host moderation ------------------------------------------------------
    def test_only_host_can_moderate(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        a_id = last(a, 'joined')['selfId']
        b_id = last(b, 'joined')['selfId']

        b.emit('host_action', {'action': 'mute_user', 'targetUserId': a_id})
        self.assertEqual(last(b, 'host_command')['action'], 'denied')
        self.assertIsNone(last(a, 'host_command'))

        a.emit('host_action', {'action': 'mute_user', 'targetUserId': b_id})
        self.assertEqual(last(b, 'host_command')['action'], 'mute')

        a.emit('host_action', {'action': 'remove_user', 'targetUserId': b_id})
        self.assertEqual(last(b, 'host_command')['action'], 'removed')
        self.assertEqual(presence.count(meeting['id']), 1)

    def test_host_can_end_meeting_for_everyone(self):
        t1, _ = make_user(self.http, 'Host')
        t2, _ = make_user(self.http, 'Guest')
        meeting = self.create_meeting(t1)
        a, b = self.connect(t1), self.connect(t2)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        b.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'b'})
        b.get_received()
        a.emit('host_action', {'action': 'end_meeting_for_all'})
        self.assertIn('meeting_ended', [name for name, _ in events(b)])
        self.assertEqual(presence.count(meeting['id']), 0)

    # -- email ----------------------------------------------------------------
    def test_unconfigured_email_never_reports_success(self):
        t1, _ = make_user(self.http, 'Host')
        meeting = self.create_meeting(t1)
        self.assertIsNone(Config.email_provider())
        res = self.http.post(f"/api/meetings/{meeting['id']}/invite",
                             json={'emails': ['friend@example.com']}, headers=auth(t1))
        self.assertEqual(res.status_code, 502)
        body = res.get_json()
        self.assertEqual(body['delivered'], 0)
        self.assertEqual(body['results'][0]['status'], 'failed')
        self.assertIn('not configured', body['error'])

    def test_invites_are_sent_once_and_duplicates_skipped(self):
        t1, _ = make_user(self.http, 'Host')
        meeting = self.create_meeting(t1)
        sent = []

        def fake_send(messages):
            sent.extend(m['to'] for m in messages)
            return [mail_service._result(m['to'], 'brevo', True, message_id='x') for m in messages]

        with mock.patch.object(mail_service, 'send_emails', side_effect=fake_send):
            res = self.http.post(f"/api/meetings/{meeting['id']}/invite", headers=auth(t1), json={
                'emails': ['a@example.com', 'A@Example.com', 'b@example.com', 'not-an-email']})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(sorted(sent), ['a@example.com', 'b@example.com'])

            res = self.http.post(f"/api/meetings/{meeting['id']}/invite", headers=auth(t1), json={
                'emails': ['a@example.com', 'c@example.com']})
            statuses = {r['email']: r['status'] for r in res.get_json()['results']}
            self.assertEqual(statuses, {'a@example.com': 'already_invited', 'c@example.com': 'sent'})
            self.assertEqual(sent.count('a@example.com'), 1)

    def test_partial_email_failure_is_reported(self):
        t1, _ = make_user(self.http, 'Host')
        meeting = self.create_meeting(t1)

        def fake_send(messages):
            return [mail_service._result(m['to'], 'brevo', m['to'].startswith('ok'), error=None
                                         if m['to'].startswith('ok') else 'mailbox unavailable')
                    for m in messages]

        with mock.patch.object(mail_service, 'send_emails', side_effect=fake_send):
            res = self.http.post(f"/api/meetings/{meeting['id']}/invite", headers=auth(t1), json={
                'emails': ['ok@example.com', 'bad@example.com']})
        self.assertEqual(res.status_code, 207)
        self.assertEqual((res.get_json()['delivered'], res.get_json()['failed']), (1, 1))

    def test_invitation_email_contains_required_details(self):
        html = mail_service.build_meeting_html_email(
            recipient_name='sam', is_host=False, meeting_title='Design <Review>', meeting_description='',
            date_str='', start_time_str='', end_time_str='',
            meeting_link='https://app.example/conference/ABCDEFGH1234', gcal_url='',
            host_name='Asha', host_email='asha@example.com', guest_emails=[], meeting_code='ABCDEFGH1234')
        self.assertIn('Design &lt;Review&gt;', html)       # meeting name, escaped
        self.assertIn('https://app.example/conference/ABCDEFGH1234', html)  # link
        self.assertIn('Asha', html)                         # host
        self.assertIn('How to join', html)                  # instructions

    # -- health ---------------------------------------------------------------
    def test_health_reports_database_and_email_state(self):
        body = self.http.get('/api/health').get_json()
        self.assertTrue(body['database']['connected'])
        self.assertIn(body['database']['dialect'], ('sqlite', 'postgresql'))
        self.assertFalse(body['email']['configured'])

    # -- liveness & anti-deepfake verification --------------------------------
    def test_liveness_hmac_chain_and_deepfake_detection(self):
        import time
        from services.liveness import compute_chained_hmac

        t1, _ = make_user(self.http, 'Host')
        meeting = self.create_meeting(t1)
        a = self.connect(t1)
        a.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': 'a'})
        joined = last(a, 'joined')
        seed = joined['livenessSeed']
        self.assertTrue(seed)

        # 1. Valid cryptographic liveness proof #1
        ts1 = int(time.time() * 1000)
        sig1 = compute_chained_hmac(seed, 1, ts1, 'f0f0a1a1', '88776655', 94, 'genesis')
        a.emit('liveness_proof', {
            'seq': 1,
            'timestamp': ts1,
            'videoDigest': 'f0f0a1a1',
            'audioDigest': '88776655',
            'score': 94,
            'mode': 'active',
            'signature': sig1,
        })
        upd1 = last(a, 'liveness_update')
        self.assertEqual(upd1['liveness']['status'], 'verified')
        self.assertEqual(upd1['liveness']['chainLength'], 1)

        # 2. Chained proof #2 reporting synthetic/virtual camera feed
        ts2 = int(time.time() * 1000)
        sig2 = compute_chained_hmac(seed, 2, ts2, '00000000', '88776655', 35, sig1)
        a.emit('liveness_proof', {
            'seq': 2,
            'timestamp': ts2,
            'videoDigest': '00000000',
            'audioDigest': '88776655',
            'score': 35,
            'mode': 'synthetic',
            'anomaly': 'Virtual camera feed (OBS Virtual Camera)',
            'signature': sig2,
        })
        upd2 = last(a, 'liveness_update')
        self.assertEqual(upd2['liveness']['status'], 'synthetic')
        self.assertEqual(upd2['liveness']['chainLength'], 2)

        # 3. Tampered signature or replay attack is flagged as 'tampered'
        a.emit('liveness_proof', {
            'seq': 3,
            'timestamp': ts2,
            'videoDigest': 'f0f0a1a1',
            'audioDigest': '88776655',
            'score': 99,
            'mode': 'active',
            'signature': 'deadbeef' * 8,
        })
        upd3 = last(a, 'liveness_update')
        self.assertEqual(upd3['liveness']['status'], 'tampered')
        self.assertEqual(upd3['liveness']['score'], 0)

    # -- GF(2^8) Reed-Solomon FEC & Swarm Super-Peer Election -----------------
    def test_gf256_reed_solomon_fec_0rtt_reconstruction(self):
        from networking.fec_gf256 import decode_fec_shards, encode_fec_shards

        payload = b'VIT-Connect critical audio PCM & keyframe delta stream!' * 7
        # 1. Level 1 Degraded (8, 6) RS-FEC: drop shards 0 and 3 (2 source shards lost)
        shards_8_6, orig_len = encode_fec_shards(payload, n=8, k=6)
        surviving_8_6 = [s for s in shards_8_6 if s[0] not in (0, 3)]
        self.assertEqual(len(surviving_8_6), 6)
        recovered_8_6 = decode_fec_shards(surviving_8_6, n=8, k=6, orig_len=orig_len)
        self.assertEqual(recovered_8_6, payload)

        # 2. Level 2 Severe (10, 6) RS-FEC: drop 4 shards (shards 1, 2, 4, 7)
        shards_10_6, orig_len = encode_fec_shards(payload, n=10, k=6)
        surviving_10_6 = [s for s in shards_10_6 if s[0] not in (1, 2, 4, 7)]
        self.assertEqual(len(surviving_10_6), 6)
        recovered_10_6 = decode_fec_shards(surviving_10_6, n=10, k=6, orig_len=orig_len)
        self.assertEqual(recovered_10_6, payload)

    def test_channel_impairment_index_and_swarm_super_peer_election(self):
        from services.swarm import compute_channel_impairment

        # Verify patent Table 1 thresholds
        lvl0 = compute_channel_impairment(plf=0.01, jitter_ms=10, rtt_ms=30, cpu_util_pct=20)
        self.assertEqual((lvl0['level'], lvl0['fec']), (0, None))
        lvl1 = compute_channel_impairment(plf=0.12, jitter_ms=90, rtt_ms=120, cpu_util_pct=35)
        self.assertEqual((lvl1['level'], lvl1['fec']['code']), (1, 'RS(8,6)'))
        lvl2 = compute_channel_impairment(plf=0.25, jitter_ms=170, rtt_ms=260, cpu_util_pct=70)
        self.assertEqual((lvl2['level'], lvl2['fec']['code']), (2, 'RS(10,6)'))

        # Verify 6-participant room transitions to 'swarm_micro_sfu' and elects highest-NCS peer
        tokens = [make_user(self.http, f'Peer{i}')[0] for i in range(6)]
        meeting = self.create_meeting(tokens[0])
        clients = [self.connect(t) for t in tokens]
        sids = []
        for idx, c in enumerate(clients):
            c.emit('join_meeting', {'meetingId': meeting['id'], 'clientId': f'c{idx}'})
            sids.append(last(c, 'joined')['selfId'])

        # Peer 3 reports fiber-grade uplink (4000 kbps, 12ms RTT, 10% CPU) -> highest NCS
        clients[3].emit('telemetry_report', {
            'plf': 0.0, 'jitterMs': 2.0, 'rttMs': 12.0, 'uplinkKbps': 4000.0, 'cpuUtilPct': 10.0
        })
        # Peer 1 reports second-best capability (runner-up backup Super-Peer)
        clients[1].emit('telemetry_report', {
            'plf': 0.01, 'jitterMs': 8.0, 'rttMs': 22.0, 'uplinkKbps': 3200.0, 'cpuUtilPct': 18.0
        })
        swarm_evt = last(clients[0], 'swarm_topology_update')
        self.assertEqual(swarm_evt['swarm']['mode'], 'swarm_micro_sfu')
        self.assertEqual(swarm_evt['swarm']['superPeerId'], sids[3])
        self.assertEqual(swarm_evt['swarm']['backupSuperPeerId'], sids[1])

        # Failover test: when Super-Peer (Peer 3) leaves, Peer 1 is immediately promoted
        clients[3].emit('leave_meeting')
        updated_roster = last(clients[0], 'roster_update')['participants']
        by_id = {p['userId']: p for p in updated_roster}
        self.assertTrue(by_id[sids[1]]['isSuperPeer'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
