// WebRTC full-mesh manager.
//
// One RTCPeerConnection per remote participant carries everything: microphone,
// camera and (when presenting) the screen and its audio. Tracks can be added,
// swapped and removed at any time; the "perfect negotiation" pattern
// (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example) makes
// simultaneous offers from both sides safe.
//
// Outgoing tracks are tagged with one of two caller-owned stream ids
// (`outStreams.camera`, `outStreams.screen`). Those ids are published
// in the server roster, so a receiver can tell a camera from a screen share
// without depending on message ordering.

const SLOT_STREAM = { mic: 'camera', cam: 'camera', screen: 'screen', screenAudio: 'screen' }
const STATS_INTERVAL_MS = 4000
const DISCONNECT_GRACE_MS = 5000
// How long the answering side waits for the first offer before starting
// negotiation itself (covers an initiator that never sends one).
const FIRST_OFFER_TIMEOUT_MS = 5000

export class PeerMesh {
  constructor({ selfId, iceServers, outStreams, sendSignal, onRemoteStreams, onPeerState, onPeerStats }) {
    this.selfId = selfId
    this.rtcConfig = { iceServers: iceServers?.length ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }] }
    this.sendSignal = sendSignal
    this.onRemoteStreams = onRemoteStreams || (() => {})
    this.onPeerState = onPeerState || (() => {})
    this.onPeerStats = onPeerStats || (() => {})

    this.peers = new Map()
    this.closed = false
    // Only their ids matter: they become the msid of outgoing tracks and are
    // published in the roster. The caller owns them so the ids survive a
    // mesh rebuild after a signaling reconnect.
    this.outStreams = outStreams || { camera: new MediaStream(), screen: new MediaStream() }
    this.localTracks = { mic: null, cam: null, screen: null, screenAudio: null }
    this.statsTimer = setInterval(() => this.collectStats(), STATS_INTERVAL_MS)
  }

  // ---- public API ------------------------------------------------------

  /** Make the set of connections match the roster (ids of everyone but us). */
  syncPeers(peerIds) {
    if (this.closed) return
    const wanted = new Set(peerIds)
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.removePeer(id)
    }
    for (const id of wanted) {
      if (!this.peers.has(id)) this.createPeer(id)
    }
    this.tuneSenders()
  }

  /** Set (or clear with null) what we send. Unspecified slots are left alone. */
  setLocalTracks(tracks) {
    if (this.closed) return
    Object.assign(this.localTracks, tracks)
    for (const peer of this.peers.values()) this.applyTracks(peer)
    this.tuneSenders()
  }

  handleSignal(from, data) {
    if (this.closed || !data) return
    const peer = this.peers.get(from) || this.createPeer(from)
    // Serialise per peer so async steps of two messages never interleave.
    peer.queue = peer.queue.then(() => this.processSignal(peer, data)).catch((err) => {
      console.warn('[rtc] signal handling failed', err)
    })
  }

  close() {
    this.closed = true
    clearInterval(this.statsTimer)
    for (const id of [...this.peers.keys()]) this.removePeer(id)
  }

  // ---- peers -----------------------------------------------------------

  createPeer(peerId) {
    const pc = new RTCPeerConnection(this.rtcConfig)
    const peer = {
      id: peerId,
      pc,
      // Exactly one side of each pair is polite; both compute it the same way.
      // The impolite side makes the FIRST offer. The polite side attaches its
      // tracks only after applying that offer, so the two never offer at the
      // same time on a fresh connection. (Initial glare made Chrome stop
      // gathering ICE candidates on the side that rolled back, leaving the
      // pair stuck in iceConnectionState "new".)
      polite: this.selfId > peerId,
      started: false,
      startTimer: null,
      makingOffer: false,
      ignoreOffer: false,
      senders: {},
      remote: new Map(), // streamId -> Set<MediaStreamTrack>
      streamCache: new Map(), // streamId -> { key, stream }
      queue: Promise.resolve(),
      disconnectTimer: null,
      lastStats: null,
      // Signaling counters, readable from devtools when diagnosing a call.
      debug: { offersSent: 0, answersSent: 0, candidatesSent: 0, offersIn: 0, answersIn: 0, candidatesIn: 0, candidateErrors: 0, lastError: null }
    }
    this.peers.set(peerId, peer)

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true
        await pc.setLocalDescription()
        peer.debug.offersSent++
        this.sendSignal(peerId, { description: pc.localDescription })
      } catch (err) {
        peer.debug.lastError = String(err)
        console.warn('[rtc] negotiation failed', err)
      } finally {
        peer.makingOffer = false
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        peer.debug.candidatesSent++
        this.sendSignal(peerId, { candidate })
      }
    }

    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0]
      const streamId = stream?.id || 'default'
      this.addRemoteTrack(peer, streamId, track)
      if (stream) {
        stream.onremovetrack = (event) => this.dropRemoteTrack(peer, streamId, event.track)
      }
      track.onended = () => this.dropRemoteTrack(peer, streamId, track)
      // A track is muted until media actually flows; re-emit so the UI can
      // distinguish "connected but no frames yet" from "playing".
      track.onunmute = () => this.emitRemote(peer)
      track.onmute = () => this.emitRemote(peer)
    }

    pc.oniceconnectionstatechange = () => {
      clearTimeout(peer.disconnectTimer)
      const state = pc.iceConnectionState
      if (state === 'failed') {
        pc.restartIce()
      } else if (state === 'disconnected') {
        // Often recovers by itself; if not, renegotiate ICE.
        peer.disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') pc.restartIce()
        }, DISCONNECT_GRACE_MS)
      }
      this.onPeerState(peerId, this.describeState(pc))
    }
    pc.onconnectionstatechange = () => this.onPeerState(peerId, this.describeState(pc))

    if (peer.polite) {
      peer.startTimer = setTimeout(() => this.startPeer(peer), FIRST_OFFER_TIMEOUT_MS)
    } else {
      this.startPeer(peer)
    }
    this.onPeerState(peerId, 'connecting')
    return peer
  }

  /** Begin sending on a connection (triggers negotiation on the initiating side). */
  startPeer(peer) {
    if (peer.started || !this.peers.has(peer.id)) return
    peer.started = true
    clearTimeout(peer.startTimer)
    // A pre-agreed data channel (same id on both sides, so only one exists)
    // guarantees an ICE connection even when neither side sends media,
    // which keeps connection-state and quality reporting meaningful.
    try {
      peer.channel = peer.pc.createDataChannel('presence', { negotiated: true, id: 0 })
    } catch {
      // Data channels unavailable: media negotiation still works.
    }
    this.applyTracks(peer)
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId)
    if (!peer) return
    clearTimeout(peer.disconnectTimer)
    clearTimeout(peer.startTimer)
    peer.pc.onnegotiationneeded = null
    peer.pc.onicecandidate = null
    peer.pc.ontrack = null
    peer.pc.oniceconnectionstatechange = null
    peer.pc.onconnectionstatechange = null
    peer.pc.close()
    this.peers.delete(peerId)
    this.onRemoteStreams(peerId, null)
    this.onPeerState(peerId, null)
  }

  describeState(pc) {
    const ice = pc.iceConnectionState
    if (ice === 'connected' || ice === 'completed') return 'connected'
    if (ice === 'failed' || pc.connectionState === 'failed') return 'failed'
    if (ice === 'disconnected') return 'reconnecting'
    return 'connecting'
  }

  // ---- outgoing tracks -------------------------------------------------

  applyTracks(peer) {
    if (!peer.started) return // tracks are attached when the peer starts
    const { pc, senders } = peer
    for (const slot of Object.keys(SLOT_STREAM)) {
      const track = this.localTracks[slot]
      const sender = senders[slot]
      try {
        if (track && !sender) {
          senders[slot] = pc.addTrack(track, this.outStreams[SLOT_STREAM[slot]])
          if (slot === 'screen' && 'contentHint' in track) track.contentHint = 'detail'
        } else if (track && sender && sender.track !== track) {
          // Same kind, new source (device switch, virtual background): no renegotiation.
          sender.replaceTrack(track).catch((err) => console.warn('[rtc] replaceTrack failed', err))
        } else if (!track && sender) {
          if (SLOT_STREAM[slot] === 'screen') {
            // Stop offering the screen so receivers see the stream end.
            pc.removeTrack(sender)
            delete senders[slot]
          } else if (sender.track) {
            sender.replaceTrack(null).catch(() => {})
          }
        }
      } catch (err) {
        console.warn(`[rtc] could not apply ${slot} track`, err)
      }
    }
  }

  /** Cap upload per peer so a mesh of N people stays within a home uplink. */
  tuneSenders() {
    const peerCount = this.peers.size
    const camBitrate = peerCount <= 1 ? 1_500_000 : peerCount <= 3 ? 700_000 : peerCount <= 5 ? 400_000 : 250_000
    const camScale = peerCount <= 3 ? 1 : peerCount <= 5 ? 1.5 : 2
    for (const { senders } of this.peers.values()) {
      this.setEncoding(senders.cam, { maxBitrate: camBitrate, scaleResolutionDownBy: camScale })
      this.setEncoding(senders.screen, { maxBitrate: peerCount <= 3 ? 2_000_000 : 1_000_000 })
    }
  }

  setEncoding(sender, values) {
    if (!sender?.track) return
    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) return // not negotiated yet; tuned on the next pass
      Object.assign(params.encodings[0], values)
      sender.setParameters(params).catch(() => {})
    } catch {
      // Unsupported on this browser: keep defaults.
    }
  }

  // ---- signaling -------------------------------------------------------

  async processSignal(peer, { description, candidate }) {
    const { pc } = peer
    if (description) {
      if (description.type === 'offer') peer.debug.offersIn++
      else peer.debug.answersIn++
      const collision = description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable')
      peer.ignoreOffer = !peer.polite && collision
      if (peer.ignoreOffer) return
      await pc.setRemoteDescription(description)
      if (description.type === 'offer') {
        // First offer on the answering side: attach our tracks now so they go
        // out in this answer (addTrack reuses the offer's transceivers).
        if (!peer.started) this.startPeer(peer)
        await pc.setLocalDescription()
        peer.debug.answersSent++
        this.sendSignal(peer.id, { description: pc.localDescription })
      }
      this.tuneSenders()
    } else if (candidate) {
      peer.debug.candidatesIn++
      try {
        await pc.addIceCandidate(candidate)
      } catch (err) {
        peer.debug.candidateErrors++
        peer.debug.lastError = String(err)
        if (!peer.ignoreOffer) throw err
      }
    }
  }

  // ---- incoming tracks -------------------------------------------------

  addRemoteTrack(peer, streamId, track) {
    if (!peer.remote.has(streamId)) peer.remote.set(streamId, new Set())
    peer.remote.get(streamId).add(track)
    this.emitRemote(peer)
  }

  dropRemoteTrack(peer, streamId, track) {
    const tracks = peer.remote.get(streamId)
    if (!tracks || !tracks.delete(track)) return
    if (tracks.size === 0) peer.remote.delete(streamId)
    this.emitRemote(peer)
  }

  emitRemote(peer) {
    if (!this.peers.has(peer.id)) return
    // A new MediaStream object is created whenever the SET of tracks changes
    // (never mutated in place): changing a stream that is already attached to
    // a <video> is not picked up reliably, notably by WebKit/iOS.
    const streams = {}
    for (const [streamId, tracks] of peer.remote) {
      const live = [...tracks].filter((t) => t.readyState === 'live')
      if (!live.length) continue
      const key = live.map((t) => t.id).sort().join('|')
      let cached = peer.streamCache.get(streamId)
      if (!cached || cached.key !== key) {
        cached = { key, stream: new MediaStream(live) }
        peer.streamCache.set(streamId, cached)
      }
      streams[streamId] = {
        stream: cached.stream,
        hasVideo: live.some((t) => t.kind === 'video'),
        videoFlowing: live.some((t) => t.kind === 'video' && !t.muted)
      }
    }
    for (const streamId of [...peer.streamCache.keys()]) {
      if (!streams[streamId]) peer.streamCache.delete(streamId)
    }
    this.onRemoteStreams(peer.id, streams)
  }

  // ---- connection quality ---------------------------------------------

  async collectStats() {
    for (const peer of this.peers.values()) {
      if (peer.pc.connectionState !== 'connected') continue
      try {
        const report = await peer.pc.getStats()
        let rtt = null
        let lost = 0
        let received = 0
        let relayed = false
        const candidates = new Map()
        report.forEach((stat) => {
          if (stat.type === 'local-candidate') candidates.set(stat.id, stat)
        })
        report.forEach((stat) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
            if (typeof stat.currentRoundTripTime === 'number') rtt = stat.currentRoundTripTime * 1000
            relayed = candidates.get(stat.localCandidateId)?.candidateType === 'relay'
          }
          if (stat.type === 'inbound-rtp' && !stat.isRemote) {
            lost += stat.packetsLost || 0
            received += stat.packetsReceived || 0
          }
        })
        const prev = peer.lastStats
        peer.lastStats = { lost, received }
        let lossPct = 0
        if (prev) {
          const dLost = Math.max(0, lost - prev.lost)
          const dTotal = dLost + Math.max(0, received - prev.received)
          lossPct = dTotal > 0 ? (dLost / dTotal) * 100 : 0
        }
        const quality =
          lossPct > 8 || (rtt !== null && rtt > 600) ? 'poor'
            : lossPct > 2 || (rtt !== null && rtt > 250) ? 'fair'
              : 'good'
        this.onPeerStats(peer.id, { rtt, lossPct, quality, relayed })
      } catch {
        // Connection closed mid-read.
      }
    }
  }
}
