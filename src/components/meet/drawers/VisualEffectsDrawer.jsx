import React, { useRef, useState } from 'react'
import { Sparkles, Ban, Check, Upload, Palette, Loader2, AlertTriangle, Droplets } from 'lucide-react'
import { DrawerShell } from './DrawerShell'

export const PRESET_BACKGROUNDS = [
  { id: 'office', label: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1280&q=75' },
  { id: 'loft', label: 'Loft', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1280&q=75' },
  { id: 'library', label: 'Library', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1280&q=75' },
  { id: 'beach', label: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1280&q=75' },
  { id: 'studio', label: 'Studio', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1280&q=75' }
]

const FILTERS = [
  { id: 'none', label: 'Natural' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'noir', label: 'Black & white' },
  { id: 'vivid', label: 'Vivid' }
]

const Option = ({ selected, onClick, label, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`relative rounded-xl overflow-hidden aspect-video border-2 flex items-end justify-center p-1.5 disabled:opacity-40 ${
      selected ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]/30' : 'border-[#3c4043] hover:border-gray-400'
    }`}
  >
    {children}
    <span className="relative z-10 text-[11px] font-medium text-white drop-shadow truncate">{label}</span>
    {selected && (
      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#8ab4f8] text-[#202124] flex items-center justify-center z-10">
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      </span>
    )}
  </button>
)

export const VisualEffectsDrawer = ({ onClose, effect, status, supported, cameraOn, onChange, customBackgrounds, onAddCustomBackground }) => {
  const fileRef = useRef(null)
  const { background, imageUrl, filter } = effect
  const disabled = !supported.backgrounds
  const [fileError, setFileError] = useState('')

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('Choose an image file (JPG, PNG or WebP).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setFileError('Choose an image smaller than 8 MB.')
      return
    }
    setFileError('')
    const url = URL.createObjectURL(file)
    onAddCustomBackground({ id: `custom-${Date.now()}`, label: 'Your image', url })
    onChange({ background: 'image', imageUrl: url })
  }

  return (
    <DrawerShell icon={Sparkles} title="Backgrounds and effects" onClose={onClose}>
      <div className="px-4 sm:px-5 py-5 space-y-6">
        {!cameraOn && (
          <p className="text-xs text-gray-400 p-3 bg-[#28292c] rounded-xl">Turn your camera on to see the effect. Your choice is kept.</p>
        )}
        {disabled && (
          <p className="text-xs text-[#fbbc04] p-3 bg-[#fbbc04]/10 border border-[#fbbc04]/30 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> This browser cannot process camera video, so effects are unavailable.
          </p>
        )}
        {status.loading && (
          <p className="text-xs text-gray-300 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the background model…</p>
        )}
        {status.error && (
          <p className="text-xs text-[#f28b82] p-3 bg-[#ea4335]/10 border border-[#ea4335]/30 rounded-xl" role="alert">{status.error}</p>
        )}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Blur</h3>
          <div className="grid grid-cols-3 gap-2">
            <Option selected={background === 'none'} onClick={() => onChange({ background: 'none' })} label="Off">
              <span className="absolute inset-0 bg-[#28292c] flex items-center justify-center"><Ban className="w-6 h-6 text-gray-400" /></span>
            </Option>
            <Option selected={background === 'blur-sm'} disabled={disabled} onClick={() => onChange({ background: 'blur-sm' })} label="Slight blur">
              <span className="absolute inset-0 bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center"><Droplets className="w-5 h-5 text-white/80" /></span>
            </Option>
            <Option selected={background === 'blur-lg'} disabled={disabled} onClick={() => onChange({ background: 'blur-lg' })} label="Blur">
              <span className="absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-800 flex items-center justify-center"><Droplets className="w-6 h-6 text-white" /></span>
            </Option>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Backgrounds</h3>
          <div className="grid grid-cols-3 gap-2">
            <Option selected={false} disabled={disabled} onClick={() => fileRef.current?.click()} label="Upload">
              <span className="absolute inset-0 bg-[#28292c] flex items-center justify-center"><Upload className="w-5 h-5 text-[#8ab4f8]" /></span>
            </Option>
            {[...customBackgrounds, ...PRESET_BACKGROUNDS].map((bg) => (
              <Option
                key={bg.id}
                disabled={disabled}
                selected={background === 'image' && imageUrl === bg.url}
                onClick={() => onChange({ background: 'image', imageUrl: bg.url })}
                label={bg.label}
              >
                <img src={bg.url} alt="" crossOrigin="anonymous" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              </Option>
            ))}
          </div>
          {fileError && <p className="text-xs text-[#f28b82]" role="alert">{fileError}</p>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          <p className="text-[11px] text-gray-500">Uploaded images stay on this device. Effects run in your browser and everyone sees the result.</p>
        </section>

        <section className="space-y-3 pt-2 border-t border-[#3c4043]">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Colour</h3>
          <div className="grid grid-cols-2 gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => onChange({ filter: f.id })}
                disabled={!supported.colorFilters && f.id !== 'none'}
                aria-pressed={filter === f.id}
                className={`p-2.5 rounded-xl text-xs font-medium border text-left flex items-center justify-between disabled:opacity-40 ${
                  filter === f.id ? 'bg-[#8ab4f8]/20 border-[#8ab4f8] text-[#8ab4f8]' : 'bg-[#28292c] border-[#3c4043] text-gray-300 hover:bg-[#323639]'
                }`}
              >
                {f.label}
                {filter === f.id && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </section>
      </div>
    </DrawerShell>
  )
}
