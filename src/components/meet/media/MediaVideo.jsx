import React, { useEffect, useRef, useState } from 'react'

/**
 * Renders the VIDEO of a MediaStream. Always muted: audio is played by
 * <RemoteAudio>, so autoplay is never blocked (iOS/Android allow muted
 * autoplay with playsInline). Until real frames arrive, `fallback` is shown
 * instead of a black rectangle.
 */
export const MediaVideo = ({ stream, mirror = false, fit = 'cover', className = '', fallback = null, onFrameState }) => {
  const ref = useRef(null)
  const [hasFrames, setHasFrames] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setHasFrames(false)
    if (el.srcObject !== stream) el.srcObject = stream || null
    if (!stream) return undefined

    const markReady = () => {
      if (el.videoWidth > 0) setHasFrames(true)
    }
    const markLost = () => setHasFrames(false)
    el.addEventListener('loadeddata', markReady)
    el.addEventListener('resize', markReady)
    el.addEventListener('playing', markReady)
    el.addEventListener('emptied', markLost)

    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    // Track changes inside the same stream object (e.g. track replaced) need a nudge.
    stream.addEventListener?.('addtrack', tryPlay)
    // Some mobile browsers pause media when the page is backgrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = setInterval(markReady, 500)

    return () => {
      clearInterval(poll)
      el.removeEventListener('loadeddata', markReady)
      el.removeEventListener('resize', markReady)
      el.removeEventListener('playing', markReady)
      el.removeEventListener('emptied', markLost)
      stream.removeEventListener?.('addtrack', tryPlay)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [stream])

  useEffect(() => {
    onFrameState?.(hasFrames)
  }, [hasFrames, onFrameState])

  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${
          mirror ? '-scale-x-100' : ''
        } ${hasFrames ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 ${className}`}
      />
      {!hasFrames && fallback && <div className="absolute inset-0">{fallback}</div>}
    </>
  )
}
