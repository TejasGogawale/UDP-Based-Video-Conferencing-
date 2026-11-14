import React, { useEffect, useRef, useState } from 'react'
import { Monitor, StopCircle, Loader2 } from 'lucide-react'
import { ParticipantTile } from './ParticipantTile'
import { MediaVideo } from './media/MediaVideo'

const GAP = 8

/** Pick the column count that gives the largest 16:9 tiles inside width x height. */
function bestGrid(count, width, height) {
  if (!count || !width || !height) return { cols: 1, tileW: width, tileH: height }
  let best = { cols: 1, tileW: 0, tileH: 0 }
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const maxW = (width - GAP * (cols - 1)) / cols
    const maxH = (height - GAP * (rows - 1)) / rows
    // Prefer 16:9, but let tiles get taller on portrait phones (down to 4:5).
    let tileW = Math.min(maxW, maxH * (16 / 9))
    let tileH = tileW * (9 / 16)
    if (tileH < maxH && width < height) {
      tileH = Math.min(maxH, tileW * 1.25)
    }
    if (tileW * tileH > best.tileW * best.tileH) best = { cols, tileW, tileH }
  }
  return best
}

function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

const Tile = ({ tile, compact, pinnedId, onPin }) => (
  <ParticipantTile
    {...tile}
    compact={compact}
    pinned={pinnedId === tile.id}
    onPin={onPin ? (pin) => onPin(pin ? tile.id : null) : undefined}
  />
)

const Gallery = ({ tiles, pinnedId, onPin }) => {
  const ref = useRef(null)
  const { width, height } = useSize(ref)
  const MAX_TILES = 16
  const visible = tiles.slice(0, MAX_TILES)
  const hidden = tiles.length - visible.length
  const { cols, tileW, tileH } = bestGrid(visible.length + (hidden > 0 ? 1 : 0), width, height)
  const compact = tileW < 220

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      {width > 0 && (
        <div
          className="grid justify-center content-center"
          style={{ gridTemplateColumns: `repeat(${cols}, ${Math.floor(tileW)}px)`, gridAutoRows: `${Math.floor(tileH)}px`, gap: GAP }}
        >
          {visible.map((tile) => (
            <Tile key={tile.id} tile={tile} compact={compact} pinnedId={pinnedId} onPin={onPin} />
          ))}
          {hidden > 0 && (
            <div className="rounded-2xl bg-[#3c4043] flex items-center justify-center text-sm text-gray-200">
              +{hidden} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Horizontal strip on narrow/portrait screens, vertical column on wide screens. */
const Filmstrip = ({ tiles, vertical, pinnedId, onPin }) => (
  <div
    className={`shrink-0 flex gap-2 ${
      vertical ? 'flex-col w-48 lg:w-56 h-full overflow-y-auto' : 'flex-row h-24 sm:h-28 w-full overflow-x-auto'
    }`}
    style={{ scrollbarWidth: 'thin' }}
  >
    {tiles.map((tile) => (
      <div key={tile.id} className={vertical ? 'w-full aspect-video shrink-0' : 'h-full aspect-video shrink-0'}>
        <Tile tile={tile} compact pinnedId={pinnedId} onPin={onPin} />
      </div>
    ))}
  </div>
)

const PresentationStage = ({ presentation, onStopScreenShare }) => {
  const { stream, presenterName, isSelf, hasVideo } = presentation
  const label = isSelf ? 'You are presenting' : `${presenterName} is presenting`

  const waiting = (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[#1e1e1e]">
      <Monitor className="w-12 h-12 text-[#8ab4f8]" />
      <p className="text-sm sm:text-base font-medium text-white">{label}</p>
      {!isSelf && (
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {stream ? 'Waiting for the first frames of the shared screen…' : 'Connecting to the presentation…'}
        </p>
      )}
    </div>
  )

  return (
    <div className="relative flex-1 min-h-0 min-w-0 bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-[#3c4043]">
      {stream && hasVideo ? <MediaVideo stream={stream} fit="contain" fallback={waiting} /> : waiting}

      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-2 px-3 py-1.5 bg-[#202124]/90 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/10 z-20 max-w-[70%]">
        <Monitor className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {isSelf && (
        <button
          onClick={onStopScreenShare}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow"
        >
          <StopCircle className="w-3.5 h-3.5" /> Stop presenting
        </button>
      )}
    </div>
  )
}

/**
 * Layout is chosen by the caller (the top bar offers the presentation/gallery switch).
 * layout: 'auto' (presentation when someone shares, otherwise gallery) |
 *         'gallery' (always tiles, even while presenting) | 'spotlight' (one big tile)
 */
export const VideoGrid = ({ tiles, presentation, layout = 'auto', pinnedId, onPin, activeSpeakerId, onStopScreenShare }) => {
  const rootRef = useRef(null)
  const { width, height } = useSize(rootRef)
  const wide = width > height * 1.15 && width >= 640

  let mode = layout === 'auto' ? (presentation ? 'presentation' : 'gallery') : layout
  if (mode === 'presentation' && !presentation) mode = 'gallery'
  if (pinnedId && mode === 'gallery' && tiles.some((t) => t.id === pinnedId)) mode = 'spotlight'

  let content
  if (mode === 'presentation') {
    content = (
      <div className={`w-full h-full flex gap-2 ${wide ? 'flex-row' : 'flex-col'}`}>
        <PresentationStage presentation={presentation} onStopScreenShare={onStopScreenShare} />
        <Filmstrip tiles={tiles} vertical={wide} pinnedId={pinnedId} onPin={onPin} />
      </div>
    )
  } else if (mode === 'spotlight') {
    const main =
      tiles.find((t) => t.id === pinnedId) ||
      tiles.find((t) => t.id === activeSpeakerId && !t.isSelf) ||
      tiles.find((t) => !t.isSelf) ||
      tiles[0]
    const rest = tiles.filter((t) => t !== main)
    content = (
      <div className={`w-full h-full flex gap-2 ${wide ? 'flex-row' : 'flex-col'}`}>
        <div className="flex-1 min-h-0 min-w-0">{main && <Tile tile={main} pinnedId={pinnedId} onPin={onPin} />}</div>
        {rest.length > 0 && <Filmstrip tiles={rest} vertical={wide} pinnedId={pinnedId} onPin={onPin} />}
      </div>
    )
  } else {
    content = <Gallery tiles={tiles} pinnedId={pinnedId} onPin={onPin} />
  }

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0 min-h-0 p-2 sm:p-3">
      {content}
    </div>
  )
}
