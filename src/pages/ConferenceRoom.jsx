import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Circle, Wifi, WifiOff, Volume2, X, LayoutGrid, Presentation, Loader2, Monitor } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConference } from '../hooks/useConference'
import { formatMeetingCode } from '../lib/meetingCode'

import { GreenRoomLobby } from '../components/meet/GreenRoomLobby'
import { VideoGrid } from '../components/meet/VideoGrid'
import { ControlDock } from '../components/meet/ControlDock'
import { LiveCaptions } from '../components/meet/LiveCaptions'
import { ReactionsOverlay } from '../components/meet/ReactionsOverlay'
import { MeetingEndedScreen } from '../components/meet/MeetingEndedScreen'
import { RemoteAudio } from '../components/meet/media/RemoteAudio'
import { DeviceSettingsModal } from '../components/meet/DeviceSettingsModal'

import { MeetingDetailsDrawer } from '../components/meet/drawers/MeetingDetailsDrawer'
import { PeopleDrawer } from '../components/meet/drawers/PeopleDrawer'
import { ChatDrawer } from '../components/meet/drawers/ChatDrawer'
import { ActivitiesDrawer } from '../components/meet/drawers/ActivitiesDrawer'
import { HostControlsDrawer } from '../components/meet/drawers/HostControlsDrawer'
import { VisualEffectsDrawer } from '../components/meet/drawers/VisualEffectsDrawer'

import { PollsModal } from '../components/meet/activities/PollsModal'
import { QAModal } from '../components/meet/activities/QAModal'
import { WhiteboardModal } from '../components/meet/activities/WhiteboardModal'

const QUALITY_UI = {
  good: { icon: Wifi, color: 'text-[#81c995]', label: 'Connection: good' },
  fair: { icon: Wifi, color: 'text-[#fbbc04]', label: 'Connection: unstable' },
  poor: { icon: WifiOff, color: 'text-[#f28b82]', label: 'Connection: poor' },
  reconnecting: { icon: Loader2, color: 'text-[#fbbc04] animate-spin', label: 'Reconnecting…' },
  offline: { icon: WifiOff, color: 'text-[#f28b82]', label: 'You are offline' }
}

/** Pick the camera stream of a participant out of the streams received from them. */
function cameraMedia(participant, media) {
  if (!media) return null
  const primary = participant.cameraStreamId && media[participant.cameraStreamId]
  if (primary && primary.videoFlowing) return primary
  if (media['relay-camera']) return media['relay-camera']
  if (primary) return primary
  const entry = Object.entries(media).find(
    ([id]) => id !== participant.screenStreamId && id !== 'relay-screen'
  )
  return entry ? entry[1] : null
}

const ConferenceRoom = () => {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const conf = useConference({ meetingRef: meetingId, user })

  const [activeDrawer, setActiveDrawer] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [layoutMode, setLayoutMode] = useState('auto')
  const [pinnedId, setPinnedId] = useState(null)
  const [customBackgrounds, setCustomBackgrounds] = useState([])
  const [now, setNow] = useState(new Date())
  const callSecondsRef = useRef(0)

  const { stage, setChatOpen } = conf
  useEffect(() => setChatOpen(activeDrawer === 'chat'), [activeDrawer, setChatOpen])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Freeze the call duration when the call ends.
  if (stage === 'in_call' && conf.joinedAt) callSecondsRef.current = Math.round((now.getTime() - conf.joinedAt) / 1000)

  // Release uploaded background images when leaving the page.
  useEffect(() => () => customBackgrounds.forEach((bg) => URL.revokeObjectURL(bg.url)), [customBackgrounds])

  // Drop a pin on someone who left.
  useEffect(() => {
    if (pinnedId && !conf.roster.some((p) => p.userId === pinnedId)) setPinnedId(null)
  }, [conf.roster, pinnedId])

  // Keyboard shortcuts (ignored while typing).
  const { toggleAudio, toggleVideo } = conf
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      const key = e.key.toLowerCase()
      if (key === 'd') {
        e.preventDefault()
        toggleAudio()
      } else if (key === 'e') {
        e.preventDefault()
        toggleVideo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleAudio, toggleVideo])

  const toggleDrawer = useCallback((name) => setActiveDrawer((cur) => (cur === name ? null : name)), [])

  const meetingCode = conf.meeting?.meeting_code || meetingId
  const selfKey = conf.selfId || 'self'

  // ---------- tiles (derived from the server roster + received media) ----------
  const tiles = useMemo(() => {
    const list = [{
      id: selfKey,
      name: user?.name || 'You',
      isSelf: true,
      isOwnerHost: conf.isHost,
      stream: conf.localStream,
      videoOn: conf.videoEnabled,
      audioOn: conf.audioEnabled,
      handRaised: conf.handRaised,
      isPresenting: conf.isScreenSharing,
      speaking: conf.activeSpeakerId === conf.selfId && conf.audioEnabled,
      level: conf.levels.self || 0,
      connection: 'connected',
      liveness: conf.self?.liveness || null,
      isSuperPeer: Boolean(conf.self?.isSuperPeer),
      telemetry: conf.self?.telemetry || null,
      mirror: true
    }]
    for (const p of conf.others) {
      const cam = cameraMedia(p, conf.remoteMedia[p.userId])
      list.push({
        id: p.userId,
        name: p.userName,
        isSelf: false,
        isOwnerHost: p.isHost,
        stream: cam?.stream || null,
        relayFrame: cam?.relayFrame || null,
        videoOn: p.videoEnabled && Boolean(cam?.hasVideo || cam?.relayFrame),
        audioOn: p.audioEnabled,
        handRaised: p.handRaised,
        isPresenting: p.isPresenting,
        speaking: conf.activeSpeakerId === p.userId && p.audioEnabled,
        level: conf.levels[p.userId] || 0,
        connection: conf.peerStates[p.userId] || 'connecting',
        quality: conf.peerStats[p.userId]?.quality,
        liveness: p.liveness || null,
        isSuperPeer: Boolean(p.isSuperPeer),
        telemetry: p.telemetry || null,
        canModerate: conf.isHost,
        // Removal is offered only in the People panel, behind a confirmation.
        onMute: () => conf.hostAction('mute_user', { targetUserId: p.userId })
      })
    }
    return list
  }, [conf, selfKey, user?.name])

  const presentation = useMemo(() => {
    const presenter = conf.presenter
    if (!presenter) return null
    if (presenter.userId === conf.selfId) {
      return conf.localScreenStream
        ? { stream: conf.localScreenStream, hasVideo: true, isSelf: true, presenterName: 'You' }
        : null
    }
    const peerMedia = conf.remoteMedia[presenter.userId] || {}
    const nativeScreen = presenter.screenStreamId ? peerMedia[presenter.screenStreamId] : null
    const screen = (nativeScreen && nativeScreen.videoFlowing)
      ? nativeScreen
      : peerMedia['relay-screen'] || nativeScreen
    return {
      stream: screen?.stream || null,
      relayFrame: screen?.relayFrame || null,
      hasVideo: Boolean(screen?.hasVideo || screen?.relayFrame),
      isSelf: false,
      presenterName: presenter.userName
    }
  }, [conf.presenter, conf.selfId, conf.localScreenStream, conf.remoteMedia])

  // Every remote stream gets exactly one audio element.
  const remoteAudioStreams = useMemo(() => {
    const list = []
    for (const [peerId, media] of Object.entries(conf.remoteMedia)) {
      for (const [streamId, { stream }] of Object.entries(media)) {
        if (stream?.getAudioTracks?.().length) list.push({ key: `${peerId}:${streamId}`, stream })
      }
    }
    return list
  }, [conf.remoteMedia])

  const people = tiles.map((t) => ({
    id: t.id, name: t.name, isSelf: t.isSelf, isOwnerHost: t.isOwnerHost, audioOn: t.audioOn, videoOn: t.videoOn,
    handRaised: t.handRaised, isPresenting: t.isPresenting, connection: t.connection, liveness: t.liveness,
    isSuperPeer: t.isSuperPeer, telemetry: t.telemetry
  }))

  const downloadChat = () => {
    const text = conf.chatMessages
      .map((m) => `[${new Date(m.createdAt).toLocaleString()}] ${m.userName}: ${m.message}`)
      .join('\n')
    const url = URL.createObjectURL(new Blob([text || 'No messages.'], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `vit-connect-chat-${meetingCode}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const effectsDrawer = (
    <VisualEffectsDrawer
      onClose={() => setActiveDrawer(null)}
      effect={conf.effect}
      status={conf.effectStatus}
      supported={conf.effectsSupported}
      cameraOn={conf.videoEnabled}
      onChange={conf.setVisualEffect}
      customBackgrounds={customBackgrounds}
      onAddCustomBackground={(bg) => setCustomBackgrounds((prev) => [bg, ...prev].slice(0, 6))}
    />
  )

  const settingsModal = activeModal === 'settings' && (
    <DeviceSettingsModal
      onClose={() => setActiveModal(null)}
      devices={conf.devices}
      selected={conf.selectedDevices}
      micLevel={conf.levels.self || 0}
      onSelectMic={conf.selectMicrophone}
      onSelectCamera={conf.selectCamera}
      onSelectSpeaker={conf.selectSpeaker}
      onRefresh={conf.refreshDevices}
    />
  )

  const toasts = (
    <div className="pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] inset-x-0 z-[70] flex flex-col items-center gap-2 px-3">
      {conf.notices.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`pointer-events-auto max-w-md w-fit flex items-start gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-sm border ${
            n.tone === 'error' ? 'bg-[#3c1f1f] border-[#ea4335]/40 text-[#f6aea9]' : 'bg-[#303134] border-[#5f6368]/50 text-white'
          }`}
        >
          <span className="flex-1">{n.message}</span>
          <button onClick={() => conf.dismissNotice(n.id)} className="text-gray-400 hover:text-white" aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  )

  // ---------------- stages ----------------
  if (stage === 'loading') {
    return (
      <div className="h-app bg-[#202124] text-gray-300 flex items-center justify-center gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#8ab4f8]" /> Loading meeting…
      </div>
    )
  }

  if (stage === 'not_found') {
    return (
      <div className="h-app bg-[#202124] text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl">Meeting not found</h1>
        <p className="text-sm text-gray-400 max-w-sm">Check the code or link. <span className="font-mono">{meetingId}</span> does not match any meeting.</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full font-semibold text-sm">Back to dashboard</button>
      </div>
    )
  }

  if (stage === 'ended') {
    return (
      <MeetingEndedScreen
        reason={conf.endInfo?.reason}
        canRejoin={conf.endInfo?.canRejoin}
        onRejoin={() => {
          setActiveDrawer(null)
          setPinnedId(null)
          conf.rejoin()
        }}
        elapsedSeconds={callSecondsRef.current}
      />
    )
  }

  if (stage === 'lobby' || stage === 'joining') {
    return (
      <>
        <GreenRoomLobby
          stream={conf.localStream}
          audioEnabled={conf.audioEnabled}
          videoEnabled={conf.videoEnabled}
          micLevel={conf.levels.self || 0}
          mediaReady={conf.mediaReady}
          mediaErrors={conf.mediaErrors}
          onToggleAudio={conf.toggleAudio}
          onToggleVideo={conf.toggleVideo}
          onJoinMeeting={conf.joinMeeting}
          onOpenSettings={() => setActiveModal('settings')}
          onOpenEffects={() => setActiveDrawer('effects')}
          meetingCode={meetingCode}
          meetingTitle={conf.meeting?.title}
          presence={conf.lobbyPresence}
          joining={stage === 'joining'}
          socketStatus={conf.socketStatus}
          userName={user?.name || 'You'}
          effectActive={conf.effect.background !== 'none' || conf.effect.filter !== 'none'}
        />
        {activeDrawer === 'effects' && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setActiveDrawer(null)} />
            <div className="relative w-full sm:w-96 h-full shadow-2xl">{effectsDrawer}</div>
          </div>
        )}
        {settingsModal}
        {toasts}
      </>
    )
  }

  // ---------------- in call ----------------
  const quality = QUALITY_UI[conf.connectionQuality] || QUALITY_UI.good
  const QualityIcon = quality.icon

  return (
    <div
      className="h-app w-full bg-[#202124] text-white flex flex-col overflow-hidden select-none overscroll-none"
      onPointerDown={() => conf.audioBlocked && conf.resumeAudio()}
    >
      {remoteAudioStreams.map(({ key, stream }) => (
        <RemoteAudio key={key} stream={stream} sinkId={conf.selectedDevices.speaker} onBlocked={() => conf.setAudioBlocked(true)} />
      ))}

      {/* Top bar */}
      <div className="shrink-0 h-12 flex items-center justify-between gap-3 box-content pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{conf.meeting?.title || formatMeetingCode(meetingCode)}</span>
          {conf.recording && (
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ea4335]/20 text-[#f28b82] text-[11px] font-semibold" title={`${conf.recording.userName} is recording`}>
              <Circle className="w-2.5 h-2.5 fill-current" /> REC
            </span>
          )}
          {conf.presenter && (
            <span className="hidden sm:flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
              <Monitor className="w-3.5 h-3.5 text-[#8ab4f8]" />
              {conf.presenter.userId === conf.selfId ? 'You are presenting' : `${conf.presenter.userName} is presenting`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {presentation && (
            <button
              onClick={() => setLayoutMode((m) => (m === 'gallery' ? 'auto' : 'gallery'))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-xs"
              title="Switch between presentation and gallery"
            >
              {layoutMode === 'gallery' ? <Presentation className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{layoutMode === 'gallery' ? 'Presentation' : 'Gallery'}</span>
            </button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-300" title={quality.label} aria-label={quality.label}>
            <QualityIcon className={`w-4 h-4 ${quality.color}`} />
            <span className="hidden md:inline">{conf.connectionQuality === 'good' ? '' : quality.label}</span>
          </span>
        </div>
      </div>

      {(conf.connectionQuality === 'offline' || conf.connectionQuality === 'reconnecting') && (
        <div className="shrink-0 mx-3 mb-1 px-3 py-2 rounded-xl bg-[#fbbc04]/15 border border-[#fbbc04]/30 text-xs text-[#fde293] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {conf.connectionQuality === 'offline' ? 'You are offline. The call resumes when your connection returns.' : 'Connection lost. Reconnecting to the meeting…'}
        </div>
      )}

      {conf.audioBlocked && (
        <button onClick={conf.resumeAudio} className="shrink-0 mx-3 mb-1 px-3 py-2 rounded-xl bg-[#8ab4f8] text-[#202124] text-xs font-semibold flex items-center justify-center gap-2">
          <Volume2 className="w-4 h-4" /> Tap to hear the other participants
        </button>
      )}

      {/* Stage + side panel */}
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 min-h-0 flex relative">
          <VideoGrid
            tiles={tiles}
            presentation={presentation}
            layout={layoutMode}
            pinnedId={pinnedId}
            onPin={setPinnedId}
            activeSpeakerId={conf.activeSpeakerId}
            onStopScreenShare={() => conf.stopScreenShare()}
          />
          <ReactionsOverlay reactions={conf.reactions} />
          <LiveCaptions lines={conf.captionLines} isVisible={conf.captionsEnabled} error={conf.captionError} />
        </div>

        {activeDrawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setActiveDrawer(null)} />
            <aside className="fixed inset-0 z-50 sm:static sm:z-auto sm:w-80 md:w-96 sm:shrink-0 sm:h-full">
              {activeDrawer === 'info' && (
                <MeetingDetailsDrawer
                  onClose={() => setActiveDrawer(null)}
                  meeting={conf.meeting}
                  meetingCode={meetingCode}
                  hostName={conf.roster.find((p) => p.isHost)?.userName}
                  participantCount={conf.roster.length}
                />
              )}
              {activeDrawer === 'people' && (
                <PeopleDrawer
                  onClose={() => setActiveDrawer(null)}
                  people={people}
                  isHost={conf.isHost}
                  meetingId={conf.meeting?.id}
                  pinnedId={pinnedId}
                  onPin={setPinnedId}
                  onMuteUser={(id) => conf.hostAction('mute_user', { targetUserId: id })}
                  onRemoveUser={(id) => conf.hostAction('remove_user', { targetUserId: id })}
                  onMuteAll={() => conf.hostAction('mute_all')}
                />
              )}
              {activeDrawer === 'chat' && (
                <ChatDrawer
                  onClose={() => setActiveDrawer(null)}
                  messages={conf.chatMessages}
                  onSendMessage={conf.sendChat}
                  currentUserId={user?.id}
                  isHost={conf.isHost}
                  isChatLocked={conf.hostLocks.chat_disabled}
                  onToggleChatLock={(locked) => conf.hostAction('lock_toggle', { lockType: 'chat_disabled', value: locked })}
                />
              )}
              {activeDrawer === 'activities' && (
                <ActivitiesDrawer
                  onClose={() => setActiveDrawer(null)}
                  onOpenWhiteboard={() => setActiveModal('whiteboard')}
                  onOpenPolls={() => setActiveModal('polls')}
                  onOpenQA={() => setActiveModal('qa')}
                  onToggleRecording={conf.toggleRecording}
                  isRecording={Boolean(conf.recording && conf.recording.userId === conf.selfId)}
                  onDownloadTranscript={downloadChat}
                />
              )}
              {activeDrawer === 'host' && conf.isHost && (
                <HostControlsDrawer
                  onClose={() => setActiveDrawer(null)}
                  hostLocks={conf.hostLocks}
                  onToggleLock={(lockType, currentlyAllowed) => conf.hostAction('lock_toggle', { lockType, value: currentlyAllowed })}
                  onEndMeetingForAll={() => {
                    conf.hostAction('end_meeting_for_all')
                    conf.leaveMeeting()
                  }}
                />
              )}
              {activeDrawer === 'effects' && effectsDrawer}
            </aside>
          </>
        )}
      </div>

      <ControlDock
        meetingCode={meetingCode}
        currentTime={now}
        audioEnabled={conf.audioEnabled}
        videoEnabled={conf.videoEnabled}
        onToggleAudio={conf.toggleAudio}
        onToggleVideo={conf.toggleVideo}
        isScreenSharing={conf.isScreenSharing}
        canShareScreen={conf.canShareScreen}
        onToggleScreenShare={conf.toggleScreenShare}
        handRaised={conf.handRaised}
        onToggleHand={conf.toggleHand}
        captionsEnabled={conf.captionsEnabled}
        onToggleCaptions={conf.toggleCaptions}
        onSendReaction={conf.sendReaction}
        activeDrawer={activeDrawer}
        onToggleDrawer={toggleDrawer}
        participantsCount={conf.roster.length || 1}
        unreadMessages={conf.unreadMessages}
        isHost={conf.isHost}
        onLeaveCall={conf.leaveMeeting}
        onOpenSettings={() => setActiveModal('settings')}
        onOpenWhiteboard={() => setActiveModal('whiteboard')}
        hasPresentation={Boolean(presentation)}
        layoutMode={layoutMode}
        onSelectLayout={setLayoutMode}
        isRecording={Boolean(conf.recording && conf.recording.userId === conf.selfId)}
        onToggleRecording={conf.toggleRecording}
      />

      {activeModal === 'polls' && (
        <PollsModal
          onClose={() => setActiveModal(null)}
          polls={conf.polls}
          onCreatePoll={conf.activities.createPoll}
          onVotePoll={conf.activities.votePoll}
          onEndPoll={conf.activities.endPoll}
          currentUser={{ sid: user?.id, name: user?.name }}
          isHost={conf.isHost}
        />
      )}
      {activeModal === 'qa' && (
        <QAModal
          onClose={() => setActiveModal(null)}
          qas={conf.qas}
          onSubmitQA={conf.activities.submitQA}
          onUpvoteQA={conf.activities.upvoteQA}
          onAnswerQA={conf.activities.answerQA}
          currentUser={{ sid: user?.id, name: user?.name }}
          isHost={conf.isHost}
        />
      )}
      {activeModal === 'whiteboard' && (
        <WhiteboardModal
          onClose={() => setActiveModal(null)}
          strokes={conf.whiteboardStrokes}
          onDrawStroke={conf.activities.drawStroke}
          onClearWhiteboard={conf.activities.clearWhiteboard}
        />
      )}
      {settingsModal}
      {toasts}
    </div>
  )
}

export default ConferenceRoom
