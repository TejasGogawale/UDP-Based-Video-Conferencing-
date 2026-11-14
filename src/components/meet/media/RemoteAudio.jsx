import React, { useEffect, useRef } from 'react'

/**
 * Plays the audio of one remote stream. Rendered once per stream (not per
 * tile), so the same voice is never played twice. If the browser blocks
 * unmuted autoplay, `onBlocked` is called; a later 'vit:resume-audio' event
 * (dispatched from a user gesture) retries playback.
 */
export const RemoteAudio = ({ stream, sinkId = '', onBlocked }) => {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (el.srcObject !== stream) el.srcObject = stream || null
    const tryPlay = () => {
      if (!el.srcObject) return
      el.play().catch((err) => {
        if (err?.name === 'NotAllowedError') onBlocked?.()
      })
    }
    tryPlay()
    window.addEventListener('vit:resume-audio', tryPlay)
    stream?.addEventListener?.('addtrack', tryPlay)
    return () => {
      window.removeEventListener('vit:resume-audio', tryPlay)
      stream?.removeEventListener?.('addtrack', tryPlay)
    }
  }, [stream, onBlocked])

  useEffect(() => {
    const el = ref.current
    if (el && typeof el.setSinkId === 'function') {
      el.setSinkId(sinkId || '').catch(() => {})
    }
  }, [sinkId])

  return <audio ref={ref} autoPlay playsInline className="hidden" />
}
